import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignInClient } from './signin-client';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="page narrow"><p>Loading…</p></div>}>
      <SignInClient />
    </Suspense>
  );
}
