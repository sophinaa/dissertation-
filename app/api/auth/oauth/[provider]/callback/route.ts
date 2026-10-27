import { safeEqual } from '@/lib/auth/crypto.ts';
import { createSession, upsertUserForIdentity } from '@/lib/auth/db.ts';
import { OAuthError, exchangeCode, safeReturnTo, type OAuthState } from '@/lib/auth/oauth.ts';
import { OAUTH_COOKIE, cookie, getDb, oauthEnv, readCookie, redirect, sessionCookie } from '@/lib/auth/server.ts';

type Props = { params: Promise<{ provider: string }> };

function readState(request: Request, provider: string): OAuthState | null {
  try {
    const raw = readCookie(request, OAUTH_COOKIE);
    const s = raw ? (JSON.parse(raw) as OAuthState) : null;
    return s && s.provider === provider ? s : null;
  } catch {
    return null;
  }
}

async function handle(request: Request, provider: string, params: URLSearchParams): Promise<Response> {
  const clearState = cookie(request, OAUTH_COOKIE, '', { maxAge: 0 });
  const fail = (reason: string) => redirect(`/signin?error=${reason}`, [clearState]);
  if (provider !== 'google' && provider !== 'apple') return fail('unavailable');
  if (params.get('error')) return fail('cancelled');

  const state = readState(request, provider);
  const returnedState = params.get('state') ?? '';
  const code = params.get('code');
  if (!state || !code || !safeEqual(returnedState, state.state)) return fail('state');

  const db = await getDb();
  if (!db) return fail('unavailable');
  try {
    const origin = new URL(request.url).origin;
    const identity = await exchangeCode(oauthEnv(), state, code, `${origin}/api/auth/oauth/${provider}/callback`);
    const user = await upsertUserForIdentity(db, provider, identity.subject, identity.email);
    const session = await createSession(db, user.id);
    const destination = safeReturnTo(state.returnTo);
    return redirect(`${destination}${destination.includes('?') ? '&' : '?'}signedIn=1`, [
      clearState,
      sessionCookie(request, session.token, session.expiresAt),
    ]);
  } catch (err) {
    return fail(err instanceof OAuthError ? 'provider' : 'failed');
  }
}

/** Google returns here with a GET redirect. */
export async function GET(request: Request, { params }: Props) {
  const { provider } = await params;
  return handle(request, provider, new URL(request.url).searchParams);
}

/** Apple returns here with a form POST (response_mode=form_post). */
export async function POST(request: Request, { params }: Props) {
  const { provider } = await params;
  const form = await request.formData().catch(() => null);
  const fields = new URLSearchParams();
  for (const key of ['code', 'state', 'error']) {
    const value = form?.get(key);
    if (typeof value === 'string') fields.set(key, value);
  }
  return handle(request, provider, fields);
}
