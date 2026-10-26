import type { Metadata, Viewport } from 'next';
import { SiteShell } from '@/components/site-shell';
import { StoreProvider } from '@/components/store';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Botanical & You — natural oils for skin and hair (prototype)',
    template: '%s · Botanical & You (prototype)',
  },
  description:
    'A prototype shop for natural skin and hair care oils, with optional personalised recommendations, a product finder and a catalogue-grounded shopping assistant.',
  openGraph: {
    title: 'Botanical & You (prototype)',
    description: 'Natural oils for skin and hair — a dissertation prototype.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>
        <StoreProvider>
          <SiteShell>{children}</SiteShell>
        </StoreProvider>
      </body>
    </html>
  );
}
