import { deleteUser } from '@/lib/auth/db.ts';
import { authError, clearSessionCookie, currentUser, json, sameOrigin } from '@/lib/auth/server.ts';

/** Permanently delete the signed-in account and all data linked to it. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return authError('Request blocked.', 403);
  const auth = await currentUser(request);
  if (!auth) return authError('You’re not signed in.', 401);
  await deleteUser(auth.db, auth.user.id);
  return json({ deleted: true }, { cookies: [clearSessionCookie(request)] });
}
