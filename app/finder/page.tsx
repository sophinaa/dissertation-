import type { Metadata } from 'next';
import { FinderClient } from './finder-client';

export const metadata: Metadata = { title: 'Product finder' };

export default function FinderPage() {
  return <FinderClient />;
}
