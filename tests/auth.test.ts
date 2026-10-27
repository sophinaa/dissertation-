import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { base64url, hmac, normaliseEmail, safeEqual, sixDigitCode } from '../lib/auth/crypto.ts';
import {
  MAX_CODE_ATTEMPTS,
  createSession,
  deleteSession,
  deleteUser,
  ensureSchema,
  getPreferences,
  getSessionUser,
  issueEmailCode,
  rateLimit,
  savePreferences,
  upsertUserForIdentity,
  verifyEmailCode,
  type Db,
  type DbStatement,
} from '../lib/auth/db.ts';
import { OAuthError, appleClientSecret, exchangeCode, safeReturnTo, validateIdToken } from '../lib/auth/oauth.ts';

/** Minimal Cloudflare D1-compatible wrapper around Node's built-in SQLite, for tests only. */
function testDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  const statement = (sql: string, params: unknown[] = []): DbStatement => ({
    bind: (...values) => statement(sql, values),
    first: async <T,>() => (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null,
    all: async <T,>() => ({ results: raw.prepare(sql).all(...(params as never[])) as T[] }),
    run: async () => raw.prepare(sql).run(...(params as never[])),
  });
  return { raw, prepare: (sql) => statement(sql) };
}

async function freshDb() {
  const db = testDb();
  await ensureSchema(db);
  return db;
}

const SECRET = 'test-secret-that-is-long-enough-for-hmac-0123456789';
const fakeJwt = (claims: Record<string, unknown>) =>
  `${base64url(new TextEncoder().encode('{"alg":"none"}'))}.${base64url(new TextEncoder().encode(JSON.stringify(claims)))}.sig`;

test('codes are 6 digits and secrets compare safely', async () => {
  for (let i = 0; i < 200; i++) assert.match(sixDigitCode(), /^\d{6}$/);
  assert.ok(safeEqual('abc', 'abc'));
  assert.ok(!safeEqual('abc', 'abd'));
  assert.ok(!safeEqual('abc', 'abcd'));
  assert.equal(await hmac('k', 'm'), await hmac('k', 'm'));
  assert.notEqual(await hmac('k', 'm'), await hmac('k2', 'm'));
  assert.equal(normaliseEmail('  Sam@Example.COM '), 'sam@example.com');
  assert.equal(normaliseEmail('not-an-email'), null);
});

test('email codes are hashed, single-use, expire and lock after repeated failures', async () => {
  const db = await freshDb();
  const code = await issueEmailCode(db, SECRET, 'a@example.com', 1_000);
  const stored = db.raw.prepare('SELECT code_hash FROM email_codes').get() as { code_hash: string };
  assert.ok(!stored.code_hash.includes(code), 'the raw code is never stored');

  const wrong = code === '000000' ? '111111' : '000000';
  assert.equal(await verifyEmailCode(db, SECRET, 'a@example.com', wrong, 2_000), 'invalid');
  assert.equal(await verifyEmailCode(db, SECRET, 'b@example.com', code, 2_000), 'invalid', 'codes are bound to the email');
  assert.equal(await verifyEmailCode(db, SECRET, 'a@example.com', code, 2_000), 'ok');
  assert.equal(await verifyEmailCode(db, SECRET, 'a@example.com', code, 2_000), 'invalid', 'single use');

  const code2 = await issueEmailCode(db, SECRET, 'a@example.com', 0);
  assert.equal(await verifyEmailCode(db, SECRET, 'a@example.com', code2, 11 * 60_000), 'expired');

  const code3 = await issueEmailCode(db, SECRET, 'a@example.com', 0);
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) await verifyEmailCode(db, SECRET, 'a@example.com', 'abcdef', 1);
  assert.equal(await verifyEmailCode(db, SECRET, 'a@example.com', code3, 1), 'too-many-attempts', 'locked even with the right code');
});

test('one verified email maps to one account across sign-in methods', async () => {
  const db = await freshDb();
  const viaEmail = await upsertUserForIdentity(db, 'email', 'h1', 'sam@example.com');
  const viaGoogle = await upsertUserForIdentity(db, 'google', 'g-123', 'sam@example.com');
  const again = await upsertUserForIdentity(db, 'google', 'g-123', 'sam@example.com');
  assert.equal(viaEmail.id, viaGoogle.id);
  assert.equal(again.id, viaEmail.id);
  assert.deepEqual(viaGoogle.providers, ['email', 'google']);
  const other = await upsertUserForIdentity(db, 'apple', 'a-9', 'someone@else.com');
  assert.notEqual(other.id, viaEmail.id);
});

test('sessions store only a token hash and expire', async () => {
  const db = await freshDb();
  const user = await upsertUserForIdentity(db, 'email', 'h', 'x@example.com');
  const { token } = await createSession(db, user.id, 0);
  const row = db.raw.prepare('SELECT token_hash FROM sessions').get() as { token_hash: string };
  assert.notEqual(row.token_hash, token);
  assert.equal((await getSessionUser(db, token, 1_000))?.email, 'x@example.com');
  assert.equal(await getSessionUser(db, 'forged-token', 1_000), null);
  assert.equal(await getSessionUser(db, token, 31 * 86_400_000), null, 'expired after 30 days');
  const { token: t2 } = await createSession(db, user.id);
  await deleteSession(db, t2);
  assert.equal(await getSessionUser(db, t2), null, 'sign-out ends the session');
});

test('deleting an account removes every linked row', async () => {
  const db = await freshDb();
  const user = await upsertUserForIdentity(db, 'google', 'g', 'del@example.com');
  await createSession(db, user.id);
  await savePreferences(db, user.id, { area: 'hair' } as never);
  await deleteUser(db, user.id);
  for (const table of ['users', 'identities', 'sessions', 'preferences']) {
    const { n } = db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    assert.equal(n, 0, table);
  }
});

test('saved preferences are validated and can be cleared', async () => {
  const db = await freshDb();
  const user = await upsertUserForIdentity(db, 'email', 'p', 'p@example.com');
  await savePreferences(db, user.id, { area: 'hair', exclude: ['nut', 'nonsense'], hairType: 'thick' } as never);
  const prefs = await getPreferences(db, user.id);
  assert.equal(prefs?.area, 'hair');
  assert.deepEqual(prefs?.exclude, ['nut']);
  await savePreferences(db, user.id, null);
  assert.equal(await getPreferences(db, user.id), null);
});

test('rate limits block after the limit and reset each window', async () => {
  const db = await freshDb();
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await rateLimit(db, 'k', 3, 1000, 100));
  assert.deepEqual(results, [true, true, true, false]);
  assert.equal(await rateLimit(db, 'k', 3, 1000, 1200), true);
});

test('ID tokens are rejected unless issuer, audience, expiry, nonce and verified email all check out', () => {
  const now = 1_700_000_000_000;
  const good = { iss: 'https://accounts.google.com', aud: 'client', exp: now / 1000 + 600, nonce: 'n', sub: 's', email: 'A@B.com', email_verified: true };
  assert.deepEqual(validateIdToken('google', fakeJwt(good), { clientId: 'client', nonce: 'n' }, now), { subject: 's', email: 'a@b.com' });
  const bad: Record<string, unknown>[] = [
    { ...good, iss: 'https://evil.example' },
    { ...good, aud: 'other-client' },
    { ...good, exp: now / 1000 - 3600 },
    { ...good, nonce: 'replayed' },
    { ...good, email_verified: false },
  ];
  for (const claims of bad)
    assert.throws(() => validateIdToken('google', fakeJwt(claims), { clientId: 'client', nonce: 'n' }, now), OAuthError);
  const apple = { ...good, iss: 'https://appleid.apple.com', email_verified: 'true' };
  assert.equal(validateIdToken('apple', fakeJwt(apple), { clientId: 'client', nonce: 'n' }, now).subject, 's');
});

test('code exchange sends the PKCE verifier and validates the returned token', async () => {
  const nonce = 'nonce-1';
  let sentBody = '';
  const fetcher = (async (_url: string, init: RequestInit) => {
    sentBody = (init.body as URLSearchParams).toString();
    const token = fakeJwt({ iss: 'https://accounts.google.com', aud: 'gid', exp: Date.now() / 1000 + 600, nonce, sub: 'g1', email: 'g@x.com', email_verified: true });
    return new Response(JSON.stringify({ id_token: token }), { status: 200 });
  }) as typeof fetch;
  const identity = await exchangeCode(
    { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' },
    { provider: 'google', state: 's', nonce, verifier: 'the-verifier', returnTo: '/account' },
    'auth-code',
    'https://shop.example/api/auth/oauth/google/callback',
    fetcher,
  );
  assert.equal(identity.email, 'g@x.com');
  assert.match(sentBody, /code_verifier=the-verifier/);
  assert.match(sentBody, /code=auth-code/);
});

test('Apple client secret is a valid ES256 JWT with the required claims', async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----`;
  const jwt = await appleClientSecret(
    { APPLE_CLIENT_ID: 'com.example.web', APPLE_TEAM_ID: 'TEAM123', APPLE_KEY_ID: 'KEY456', APPLE_PRIVATE_KEY: pem },
    1_700_000_000_000,
  );
  const [h, p, sig] = jwt.split('.');
  const decode = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString());
  assert.deepEqual(decode(h), { alg: 'ES256', typ: 'JWT', kid: 'KEY456' });
  assert.deepEqual(decode(p), { iss: 'TEAM123', iat: 1_700_000_000, exp: 1_700_000_300, aud: 'https://appleid.apple.com', sub: 'com.example.web' });
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pair.publicKey,
    Buffer.from(sig, 'base64url'),
    new TextEncoder().encode(`${h}.${p}`),
  );
  assert.ok(valid, 'signature verifies with the public key');
});

test('post-sign-in redirects stay on this site', () => {
  assert.equal(safeReturnTo('/account'), '/account');
  assert.equal(safeReturnTo('/shop?area=hair'), '/shop?area=hair');
  for (const evil of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', 42])
    assert.equal(safeReturnTo(evil), '/account', String(evil));
});
