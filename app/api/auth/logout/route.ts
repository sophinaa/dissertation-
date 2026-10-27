import { deleteSession } from '@/lib/auth/db.ts';
import { authError, clearSessionCookie, getDb, json, sameOrigin, sessionToken } from '@/lib/auth/server.ts';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return authError('Request blocked.', 403);
  const db = await getDb();
  if (db) await deleteSession(db, sessionToken(request));
  return json({ ok: true }, { cookies: [clearSessionCookie(request)] });
}
