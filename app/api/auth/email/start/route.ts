import { normaliseEmail, hmac } from '@/lib/auth/crypto.ts';
import { issueEmailCode, rateLimit } from '@/lib/auth/db.ts';
import { sendCodeEmail } from '@/lib/auth/email.ts';
import { IS_DEV, authError, authSecret, availability, clientKey, getDb, json, sameOrigin, setting } from '@/lib/auth/server.ts';

const WINDOW = 15 * 60_000;

/** Send a 6-digit sign-in code. The response never reveals whether an account exists. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return authError('Request blocked.', 403);
  const secret = authSecret();
  const db = await getDb();
  if (!db || !secret || !availability().email) return authError('Email sign-in isn’t set up on this server yet.', 503);

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = normaliseEmail(body?.email);
  if (!email) return authError('Enter a valid email address.');

  const perEmail = await rateLimit(db, `send:${await hmac(secret, email)}`, 3, WINDOW);
  const perClient = await rateLimit(db, `send-ip:${await clientKey(request, secret)}`, 10, WINDOW);
  if (!perEmail || !perClient) return authError('Too many codes requested. Please wait 15 minutes and try again.', 429);

  const code = await issueEmailCode(db, secret, email);
  const apiKey = setting('RESEND_API_KEY');
  const from = setting('EMAIL_FROM');
  if (apiKey && from) {
    if (!(await sendCodeEmail(apiKey, from, email, code)))
      return authError('We couldn’t send the email. Please try again in a moment.', 502);
    return json({ sent: true });
  }
  // Local development without an email service: show the code on screen instead.
  // import.meta.env.DEV is false in production builds, so this branch is removed there.
  if (IS_DEV) return json({ sent: true, devCode: code });
  return authError('Email sign-in isn’t set up on this server yet.', 503);
}
