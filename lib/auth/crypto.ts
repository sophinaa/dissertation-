// Small WebCrypto helpers for authentication. Runs on Cloudflare Workers and
// Node 22 (tests). Nothing here stores or logs secrets.

const encoder = new TextEncoder();

export function base64url(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Unguessable random token (default 32 bytes = 256 bits). */
export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Uniform 6-digit code using rejection sampling (no modulo bias). */
export function sixDigitCode(): string {
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

export async function sha256(text: string): Promise<string> {
  return base64url(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

export async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/** Constant-time string comparison for equal-length secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** PKCE code challenge (S256) for a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  return base64url(await crypto.subtle.digest('SHA-256', encoder.encode(verifier)));
}

/** Decode a JWT payload without verifying its signature (see validateIdToken). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1]))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0)).buffer;
}

/** Sign a JWT with an ES256 (P-256) private key in PEM/PKCS#8 form, as Apple requires. */
export async function signEs256Jwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const input = `${base64url(encoder.encode(JSON.stringify({ alg: 'ES256', typ: 'JWT', ...header })))}.${base64url(
    encoder.encode(JSON.stringify(payload)),
  )}`;
  // WebCrypto returns the raw r||s signature, which is exactly the JWS ES256 format.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(input));
  return `${input}.${base64url(signature)}`;
}

/** Light email validation and normalisation; the verification code proves ownership. */
export function normaliseEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
