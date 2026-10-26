import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PreferencesClient } from './preferences-client';

export const metadata: Metadata = { title: 'Your preferences' };

export default function PreferencesPage() {
  return (
    <Suspense fallback={<div className="page narrow"><p>Loading…</p></div>}>
      <PreferencesClient />
    </Suspense>
  );
}
