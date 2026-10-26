import type { Metadata } from 'next';
import { StudyClient } from './study-client';

export const metadata: Metadata = { title: 'Study session', robots: { index: false, follow: false } };

export default function StudyPage() {
  return <StudyClient />;
}
