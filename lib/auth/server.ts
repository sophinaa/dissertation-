// Server-only helpers shared by the auth API routes. Never import from client code.

import { env as cfEnv } from 'cloudflare:workers';
import { hmac } from './crypto.ts';
import { ensureSchema, getSessionUser, type Db, type User } from './db.ts';
import { isConfigured, type OAuthEnv } from './oauth.ts';

type ServerEnv = Cloudflare.Env & OAuthEnv;

/** Read a setting from Cloudflare bindings/secrets, falling back to .env files in local dev. */
export function setting<K extends keyof ServerEnv>(key: K): ServerEnv[K] | undefined {
  const fromCf = (cfEnv as ServerEnv | undefined)?.[key];
  if (fromCf) return fromCf;
  const fromProcess = typeof process !== 'undefined' ? process.env[key as string] : undefined;
  return (fromProcess || undefined) as ServerEnv[K] | undefined;
}

export const IS_DEV = import.meta.env.DEV;

/** Secret used to hash codes and IPs. A fixed fallback is allowed only in local development. */
export function authSecret(): string | null {
  const secret = setting('AUTH_SECRET');
  if (secret && secret.length >= 32) return secret;
  return IS_DEV ? 'local-development-only-secret-not-for-production-use' : null;
}

export async function getDb(): Promise<Db | null> {
  const db = setting('DB') as unknown as Db | undefined;
  if (!db) return null;
  await ensureSchema(db);
  return db;
}

export function oauthEnv(): OAuthEnv {
  return {
    GOOGLE_CLIENT_ID: setting('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: setting('GOOGLE_CLIENT_SECRET'),
    APPLE_CLIENT_ID: setting('APPLE_CLIENT_ID'),
    APPLE_TEAM_ID: setting('APPLE_TEAM_ID'),
    APPLE_KEY_ID: setting('APPLE_KEY_ID'),
    APPLE_PRIVATE_KEY: setting('APPLE_PRIVATE_KEY'),
  };
}

export interface AuthAvailability {
  /** Accounts need a database and a secret. */
  enabled: boolean;
  email: boolean;
  /** Email codes are shown on screen because no email service is configured (local dev only). */
  devCodes: boolean;
  google: boolean;
  apple: boolean;
}

export function availability(): AuthAvailability {
  const enabled = !!setting('DB') && !!authSecret();
  const canSend = !!(setting('RESEND_API_KEY') && setting('EMAIL_FROM'));
  const o = oauthEnv();
  return {
    enabled,
    email: enabled && (canSend || IS_DEV),
    devCodes: enabled && !canSend && IS_DEV,
    google: enabled && isConfigured('google', o),
    apple: enabled && isConfigured('apple', o),
  };
}

// ---------- Cookies ----------

const SESSION_COOKIE = 'bny_session';
const SECURE_SESSION_COOKIE = '__Host-bny_session';
export const OAUTH_COOKIE = 'bny_oauth';

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function isHttps(request: Request): boolean {
  return new URL(request.url).protocol === 'https:';
}

export function cookie(
  request: Request,
  name: string,
  value: string,
  opts: { maxAge: number; sameSite?: 'Lax' | 'None' | 'Strict' },
): string {
  const secure = isHttps(request);
  const sameSite = opts.sameSite === 'None' && !secure ? 'Lax' : (opts.sameSite ?? 'Lax');
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    `Max-Age=${opts.maxAge}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** __Host- prefix (Secure, no Domain, Path=/) on HTTPS; plain name for http://localhost. */
function sessionCookieName(request: Request): string {
  return isHttps(request) ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
}

export function sessionToken(request: Request): string | null {
  return readCookie(request, SECURE_SESSION_COOKIE) ?? readCookie(request, SESSION_COOKIE);
}

export function sessionCookie(request: Request, token: string, expiresAt: number): string {
  return cookie(request, sessionCookieName(request), token, {
    maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  });
}

export function clearSessionCookie(request: Request): string {
  return cookie(request, sessionCookieName(request), '', { maxAge: 0 });
}

// ---------- Request checks ----------

/** Rejects cross-site state-changing requests (CSRF), alongside SameSite cookies. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}

export async function currentUser(request: Request): Promise<{ db: Db; user: User } | null> {
  const db = await getDb();
  if (!db) return null;
  const user = await getSessionUser(db, sessionToken(request));
  return user ? { db, user } : null;
}

/** Hash of the client IP for rate limiting; the raw address is never stored. */
export async function clientKey(request: Request, secret: string): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'local';
  return hmac(secret, `ip:${ip.split(',')[0].trim()}`);
}

export function json(body: unknown, init: ResponseInit & { cookies?: string[] } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  headers.set('cache-control', 'no-store');
  for (const c of init.cookies ?? []) headers.append('set-cookie', c);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

export function redirect(location: string, cookies: string[] = [], status = 303): Response {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status, headers });
}

export function authError(message: string, status = 400): Response {
  return json({ error: message }, { status });
}
