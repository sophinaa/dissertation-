import { isChatId, normaliseConversation } from '@/lib/assistant/chats.ts';
import { deleteChats, saveChat } from '@/lib/auth/db.ts';
import { authError, currentUser, json, sameOrigin } from '@/lib/auth/server.ts';

type Params = { params: Promise<{ id: string }> };

/** Save one chat (validated server-side). Messages are stored, never logged. */
export async function PUT(request: Request, { params }: Params) {
  if (!sameOrigin(request)) return authError('Request blocked.', 403);
  const auth = await currentUser(request);
  if (!auth) return authError('You’re not signed in.', 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { chat?: unknown } | null;
  const chat = normaliseConversation(body?.chat);
  if (!isChatId(id) || !chat || chat.id !== id) return authError('That chat couldn’t be saved.');
  await saveChat(auth.db, auth.user.id, chat);
  return json({ saved: true });
}

export async function DELETE(request: Request, { params }: Params) {
  if (!sameOrigin(request)) return authError('Request blocked.', 403);
  const auth = await currentUser(request);
  if (!auth) return authError('You’re not signed in.', 401);
  const { id } = await params;
  if (!isChatId(id)) return authError('Unknown chat.', 404);
  await deleteChats(auth.db, auth.user.id, id);
  return json({ deleted: true });
}
