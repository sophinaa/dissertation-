import type { Metadata } from 'next';
import { AccountClient } from './account-client';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

export default function AccountPage() {
  return <AccountClient />;
}
