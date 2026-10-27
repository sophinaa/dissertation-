import { deleteChats, listChats } from '@/lib/auth/db.ts';
import { authError, currentUser, json, sameOrigin } from '@/lib/auth/server.ts';

/** The signed-in customer's saved assistant chats, newest first. */
export async function GET(request: Request) {
  const auth = await currentUser(request);
  if (!auth) return authError('You’re not signed in.', 401);
  return json({ chats: await listChats(auth.db, auth.user.id) });
}

/** Delete all of the signed-in customer's chats. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return authError('Request blocked.', 403);
  const auth = await currentUser(request);
  if (!auth) return authError('You’re not signed in.', 401);
  await deleteChats(auth.db, auth.user.id, null);
  return json({ deleted: true });
}
