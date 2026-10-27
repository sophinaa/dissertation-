// Account storage on Cloudflare D1 (SQLite). Written against a minimal D1-shaped
// interface so it can be tested with Node's built-in SQLite.
//
// Privacy: only an email address, linked sign-in methods and saved shopping
// preferences are stored. Session tokens, email codes and IP addresses are only
// ever stored as keyed hashes.

import { hmac, randomToken, safeEqual, sha256, sixDigitCode } from './crypto.ts';
import { normalisePreferences, type Preferences } from '../preferences.ts';

export interface DbStatement {
  bind(...values: unknown[]): DbStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Db {
  prepare(sql: string): DbStatement;
  batch?(statements: DbStatement[]): Promise<unknown>;
}

export type Provider = 'email' | 'google' | 'apple';

export const SESSION_DAYS = 30;
export const CODE_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS identities (
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (provider, subject)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS email_codes (
    email TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
];

const schemaReady = new WeakMap<Db, Promise<void>>();

/** Create tables on first use (idempotent). The same SQL lives in migrations/. */
export function ensureSchema(db: Db): Promise<void> {
  let ready = schemaReady.get(db);
  if (!ready) {
    ready = (async () => {
      for (const sql of SCHEMA) await db.prepare(sql).run();
    })();
    schemaReady.set(db, ready);
  }
  return ready;
}

export interface User {
  id: string;
  email: string;
  providers: Provider[];
}

async function loadUser(db: Db, id: string): Promise<User | null> {
  const row = await db.prepare('SELECT id, email FROM users WHERE id = ?').bind(id).first<{ id: string; email: string }>();
  if (!row) return null;
  const { results } = await db
    .prepare('SELECT provider FROM identities WHERE user_id = ? ORDER BY provider')
    .bind(id)
    .all<{ provider: Provider }>();
  return { id: row.id, email: row.email, providers: results.map((r) => r.provider) };
}

/**
 * Find or create the user for a verified sign-in. Identities are matched by
 * provider + subject first; otherwise a verified email links to the existing
 * account with that email, so one person gets one account across methods.
 */
export async function upsertUserForIdentity(
  db: Db,
  provider: Provider,
  subject: string,
  verifiedEmail: string,
  now = Date.now(),
): Promise<User> {
  const identity = await db
    .prepare('SELECT user_id FROM identities WHERE provider = ? AND subject = ?')
    .bind(provider, subject)
    .first<{ user_id: string }>();
  if (identity) return (await loadUser(db, identity.user_id))!;

  let user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(verifiedEmail).first<{ id: string }>();
  if (!user) {
    user = { id: randomToken(16) };
    await db.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)').bind(user.id, verifiedEmail, now).run();
  }
  await db
    .prepare('INSERT OR IGNORE INTO identities (provider, subject, user_id, created_at) VALUES (?, ?, ?, ?)')
    .bind(provider, subject, user.id, now)
    .run();
  return (await loadUser(db, user.id))!;
}

// ---------- Sessions ----------

/** Returns the raw token for the cookie; only its hash is stored. */
export async function createSession(db: Db, userId: string, now = Date.now()): Promise<{ token: string; expiresAt: number }> {
  const token = randomToken(32);
  const expiresAt = now + SESSION_DAYS * 86_400_000;
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, expiresAt, now)
    .run();
  return { token, expiresAt };
}

export async function getSessionUser(db: Db, token: string | null, now = Date.now()): Promise<User | null> {
  if (!token || token.length > 100) return null;
  const hash = await sha256(token);
  const row = await db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .bind(hash)
    .first<{ user_id: string; expires_at: number }>();
  if (!row) return null;
  if (row.expires_at <= now) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  return loadUser(db, row.user_id);
}

export async function deleteSession(db: Db, token: string | null): Promise<void> {
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

/** Remove the account and everything linked to it. */
export async function deleteUser(db: Db, userId: string): Promise<void> {
  // Explicit deletes rather than relying on foreign-key cascades being enabled.
  for (const table of ['sessions', 'identities', 'preferences']) {
    await db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId).run();
  }
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}

// ---------- Email verification codes ----------

export async function issueEmailCode(db: Db, secret: string, email: string, now = Date.now()): Promise<string> {
  const code = sixDigitCode();
  await db
    .prepare(
      `INSERT INTO email_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
       ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`,
    )
    .bind(email, await hmac(secret, `${email}:${code}`), now + CODE_MINUTES * 60_000)
    .run();
  return code;
}

export type CodeResult = 'ok' | 'invalid' | 'expired' | 'too-many-attempts';

/** Check a code. Codes are single-use, expire, and lock after MAX_CODE_ATTEMPTS wrong tries. */
export async function verifyEmailCode(
  db: Db,
  secret: string,
  email: string,
  code: string,
  now = Date.now(),
): Promise<CodeResult> {
  const row = await db
    .prepare('SELECT code_hash, expires_at, attempts FROM email_codes WHERE email = ?')
    .bind(email)
    .first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!row) return 'invalid';
  if (row.expires_at <= now) {
    await db.prepare('DELETE FROM email_codes WHERE email = ?').bind(email).run();
    return 'expired';
  }
  if (row.attempts >= MAX_CODE_ATTEMPTS) return 'too-many-attempts';
  const candidate = /^\d{6}$/.test(code) ? await hmac(secret, `${email}:${code}`) : '';
  if (!candidate || !safeEqual(candidate, row.code_hash)) {
    await db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
    return row.attempts + 1 >= MAX_CODE_ATTEMPTS ? 'too-many-attempts' : 'invalid';
  }
  await db.prepare('DELETE FROM email_codes WHERE email = ?').bind(email).run();
  return 'ok';
}

// ---------- Rate limiting ----------

/** Fixed-window limiter. Keys should already be hashed if they contain personal data. */
export async function rateLimit(db: Db, key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const row = await db
    .prepare('SELECT window_start, count FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ window_start: number; count: number }>();
  if (!row || now - row.window_start >= windowMs) {
    await db
      .prepare(
        `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
         ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
      )
      .bind(key, now)
      .run();
    return true;
  }
  if (row.count >= limit) return false;
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

// ---------- Saved preferences ----------

export async function getPreferences(db: Db, userId: string): Promise<Preferences | null> {
  const row = await db.prepare('SELECT data FROM preferences WHERE user_id = ?').bind(userId).first<{ data: string }>();
  if (!row) return null;
  try {
    return normalisePreferences(JSON.parse(row.data));
  } catch {
    return null;
  }
}

/** Saves validated preferences, or removes them when null. */
export async function savePreferences(db: Db, userId: string, prefs: Preferences | null, now = Date.now()): Promise<void> {
  if (!prefs) {
    await db.prepare('DELETE FROM preferences WHERE user_id = ?').bind(userId).run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO preferences (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(userId, JSON.stringify(normalisePreferences(prefs)), now)
    .run();
}
