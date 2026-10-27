import { randomToken } from '@/lib/auth/crypto.ts';
import { authorizationUrl, isConfigured, safeReturnTo, type OAuthProvider } from '@/lib/auth/oauth.ts';
import { OAUTH_COOKIE, availability, cookie, oauthEnv, redirect } from '@/lib/auth/server.ts';

type Props = { params: Promise<{ provider: string }> };

/** Begin "Sign in with Google/Apple": store state, nonce and PKCE verifier in a short-lived cookie. */
export async function GET(request: Request, { params }: Props) {
  const { provider } = await params;
  const url = new URL(request.url);
  if ((provider !== 'google' && provider !== 'apple') || !availability().enabled || !isConfigured(provider, oauthEnv()))
    return redirect('/signin?error=unavailable');

  const state = {
    provider: provider as OAuthProvider,
    state: randomToken(16),
    nonce: randomToken(16),
    verifier: randomToken(32),
    returnTo: safeReturnTo(url.searchParams.get('returnTo')),
  };
  const redirectUri = `${url.origin}/api/auth/oauth/${provider}/callback`;
  // Apple posts the result back cross-site, so its cookie must be SameSite=None (HTTPS only).
  const stateCookie = cookie(request, OAUTH_COOKIE, JSON.stringify(state), {
    maxAge: 600,
    sameSite: provider === 'apple' ? 'None' : 'Lax',
  });
  return redirect(await authorizationUrl(oauthEnv(), state, redirectUri), [stateCookie], 302);
}
