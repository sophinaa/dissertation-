import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ShopClient } from './shop-client';

export const metadata: Metadata = { title: 'Shop' };

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="page"><p>Loading products…</p></div>}>
      <ShopClient />
    </Suspense>
  );
}
