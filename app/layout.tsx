import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Botanical & You — Wellness Shopping Prototype',
  description:
    'Explore botanical oils and everyday skin, hair and body care in a personalised wellness shopping prototype.',
  openGraph: {
    title: 'Botanical & You',
    description: 'Small rituals. Everyday wellbeing.',
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
