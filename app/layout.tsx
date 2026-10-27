import type { Metadata, Viewport } from 'next';
import { AccountProvider } from '@/components/account';
import { SiteShell } from '@/components/site-shell';
import { StoreProvider } from '@/components/store';
import './globals.css';

export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
  title: {
    default: 'Botanical & You: natural oils for skin and hair (prototype)',
    template: '%s · Botanical & You (prototype)',
  },
  description:
    'A prototype shop for natural skin and hair care oils, with optional personalised recommendations, a product finder and a catalogue-grounded shopping assistant.',
  openGraph: {
    title: 'Botanical & You (prototype)',
    description: 'Natural oils for skin and hair. A dissertation prototype.',
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Root layout applies to every page, so this rule (written for pages/_document) doesn't apply. */}
        {/* oxlint-disable-next-line nextjs/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Fraunces:opsz,wght,SOFT@9..144,600..900,100&display=swap"
        />
      </head>
      <body>
        <StoreProvider>
          <AccountProvider>
            <SiteShell>{children}</SiteShell>
          </AccountProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
