import { hmac, normaliseEmail } from '@/lib/auth/crypto.ts';
import { createSession, rateLimit, upsertUserForIdentity, verifyEmailCode } from '@/lib/auth/db.ts';
import { authError, authSecret, clientKey, getDb, json, sameOrigin, sessionCookie } from '@/lib/auth/server.ts';

const MESSAGES = {
  invalid: 'That code isn’t right. Check the email and try again.',
  expired: 'That code has expired. Request a new one.',
  'too-many-attempts': 'Too many wrong codes. Request a new one.',
} as const;

/** Check the code; on success, create the account if needed and start a session. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return authError('Request blocked.', 403);
  const secret = authSecret();
  const db = await getDb();
  if (!db || !secret) return authError('Accounts aren’t set up on this server yet.', 503);

  const body = (await request.json().catch(() => null)) as { email?: unknown; code?: unknown } | null;
  const email = normaliseEmail(body?.email);
  const code = typeof body?.code === 'string' ? body.code.replace(/\s/g, '') : '';
  if (!email || !/^\d{6}$/.test(code)) return authError('Enter the 6-digit code from the email.');

  if (!(await rateLimit(db, `verify-ip:${await clientKey(request, secret)}`, 30, 15 * 60_000)))
    return authError('Too many attempts. Please wait 15 minutes and try again.', 429);

  const result = await verifyEmailCode(db, secret, email, code);
  if (result !== 'ok') return authError(MESSAGES[result], result === 'invalid' ? 400 : 410);

  const user = await upsertUserForIdentity(db, 'email', await hmac(secret, `email:${email}`), email);
  const session = await createSession(db, user.id);
  return json(
    { user: { email: user.email, providers: user.providers } },
    { cookies: [sessionCookie(request, session.token, session.expiresAt)] },
  );
}
