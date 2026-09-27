import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
 metadataBase: new URL('https://personal-shopping-dissertation.robust-jay-3871.chatgpt.site'),
 openGraph: { title: 'Your Brand — Personal Shopping Prototype', description: 'An interactive e-commerce dissertation prototype.', images: ['/og.png'] },
 twitter: { card: 'summary_large_image', title: 'Your Brand — Personal Shopping Prototype', images: ['/og.png'] },
 title: 'Your Brand — Personal Shopping Prototype',
 description: 'An interactive e-commerce dissertation prototype: discover products, set preferences and explore a sample shopping assistant.',
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
