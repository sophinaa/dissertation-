import { availability, currentUser, json } from '@/lib/auth/server.ts';

/** Who is signed in (if anyone) and which sign-in methods are available. */
export async function GET(request: Request) {
  const auth = await currentUser(request).catch(() => null);
  return json({
    user: auth ? { email: auth.user.email, providers: auth.user.providers } : null,
    methods: availability(),
  });
}
