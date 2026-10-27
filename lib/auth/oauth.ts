// "Sign in with Google" and "Sign in with Apple" using the OpenID Connect
// authorization-code flow with state, nonce and PKCE.
//
// ID tokens are received directly from the provider's token endpoint over TLS,
// authenticated with our client secret, so (per OpenID Connect Core §3.1.3.7)
// TLS validation substitutes for signature checking. All claims (issuer,
// audience, expiry, nonce, verified email) are still validated.

import { decodeJwtPayload, pkceChallenge, signEs256Jwt } from './crypto.ts';

export type OAuthProvider = 'google' | 'apple';

export interface OAuthEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
}

export function isConfigured(provider: OAuthProvider, env: OAuthEnv): boolean {
  return provider === 'google'
    ? !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    : !!(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
}

const PROVIDERS = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
  },
  apple: {
    authorize: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    issuers: ['https://appleid.apple.com'],
  },
} as const;

export interface OAuthState {
  provider: OAuthProvider;
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
}

export async function authorizationUrl(env: OAuthEnv, s: OAuthState, redirectUri: string): Promise<string> {
  const p = PROVIDERS[s.provider];
  const params = new URLSearchParams({
    client_id: (s.provider === 'google' ? env.GOOGLE_CLIENT_ID : env.APPLE_CLIENT_ID)!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: s.provider === 'google' ? 'openid email' : 'email',
    state: s.state,
    nonce: s.nonce,
    code_challenge: await pkceChallenge(s.verifier),
    code_challenge_method: 'S256',
  });
  // Apple only returns the email scope via a form POST to the callback.
  if (s.provider === 'apple') params.set('response_mode', 'form_post');
  else params.set('prompt', 'select_account');
  return `${p.authorize}?${params}`;
}

/** Apple requires a short-lived ES256 JWT as the client secret. */
export async function appleClientSecret(env: OAuthEnv, now = Date.now()): Promise<string> {
  const iat = Math.floor(now / 1000);
  return signEs256Jwt(
    { kid: env.APPLE_KEY_ID },
    { iss: env.APPLE_TEAM_ID, iat, exp: iat + 300, aud: 'https://appleid.apple.com', sub: env.APPLE_CLIENT_ID },
    env.APPLE_PRIVATE_KEY!,
  );
}

export interface VerifiedIdentity {
  subject: string;
  email: string;
}

export class OAuthError extends Error {}

/** Validate ID token claims. Returns the identity only for a verified email. */
export function validateIdToken(
  provider: OAuthProvider,
  idToken: string,
  expected: { clientId: string; nonce: string },
  now = Date.now(),
): VerifiedIdentity {
  const claims = decodeJwtPayload(idToken);
  if (!claims) throw new OAuthError('The sign-in response could not be read.');
  const issuers: readonly string[] = PROVIDERS[provider].issuers;
  const aud = claims.aud;
  const audOk = Array.isArray(aud) ? aud.includes(expected.clientId) : aud === expected.clientId;
  if (!issuers.includes(String(claims.iss)) || !audOk) throw new OAuthError('The sign-in response was not meant for this site.');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < now - 60_000) throw new OAuthError('The sign-in response has expired.');
  if (claims.nonce !== expected.nonce) throw new OAuthError('The sign-in response did not match this browser.');
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string' || !verified)
    throw new OAuthError('Your account needs a verified email address to sign in.');
  return { subject: claims.sub, email: claims.email.toLowerCase() };
}

/** Exchange an authorization code for a verified identity. */
export async function exchangeCode(
  env: OAuthEnv,
  s: OAuthState,
  code: string,
  redirectUri: string,
  fetcher: typeof fetch = fetch,
): Promise<VerifiedIdentity> {
  const clientId = (s.provider === 'google' ? env.GOOGLE_CLIENT_ID : env.APPLE_CLIENT_ID)!;
  const clientSecret = s.provider === 'google' ? env.GOOGLE_CLIENT_SECRET! : await appleClientSecret(env);
  const res = await fetcher(PROVIDERS[s.provider].token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: s.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => null)) as { id_token?: string } | null;
  if (!res.ok || !data?.id_token) throw new OAuthError('The sign-in provider rejected the request. Please try again.');
  return validateIdToken(s.provider, data.id_token, { clientId, nonce: s.nonce });
}

/** Only allow same-site relative paths as post-sign-in destinations. */
export function safeReturnTo(value: unknown): string {
  return typeof value === 'string' && /^\/(?!\/)[\w\-./?=&%]*$/.test(value) ? value : '/account';
}
