import type { Metadata } from 'next';
import { RecommendationsClient } from './recommendations-client';

export const metadata: Metadata = { title: 'Your recommendations' };

export default function RecommendationsPage() {
  return <RecommendationsClient />;
}
