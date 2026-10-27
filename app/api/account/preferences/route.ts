import { getPreferences, savePreferences } from '@/lib/auth/db.ts';
import { authError, currentUser, json, sameOrigin } from '@/lib/auth/server.ts';
import { hasAnswers, normalisePreferences } from '@/lib/preferences.ts';

export async function GET(request: Request) {
  const auth = await currentUser(request);
  if (!auth) return authError('You’re not signed in.', 401);
  return json({ preferences: await getPreferences(auth.db, auth.user.id) });
}

/** Save the signed-in user's preferences (validated server-side), or clear them with null. */
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return authError('Request blocked.', 403);
  const auth = await currentUser(request);
  if (!auth) return authError('You’re not signed in.', 401);
  const body = (await request.json().catch(() => null)) as { preferences?: unknown } | null;
  if (!body || !('preferences' in body)) return authError('Missing preferences.');
  const prefs = body.preferences === null ? null : normalisePreferences(body.preferences);
  await savePreferences(auth.db, auth.user.id, prefs && hasAnswers(prefs) ? prefs : null);
  return json({ saved: true });
}
