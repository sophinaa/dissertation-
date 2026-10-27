import { NextResponse } from 'next/server';

/** Baseline security headers for every response. */
export function proxy() {
  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|favicon.svg).*)'],
};
