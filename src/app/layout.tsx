import type { Metadata, Viewport } from 'next';
import { Familjen_Grotesk, IBM_Plex_Mono } from 'next/font/google';

import './globals.css';

const sans = Familjen_Grotesk({ subsets: ['latin'], variable: '--font-familjen' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex' });

export const metadata: Metadata = {
  title: 'Où faire le plein',
  description: 'Prix du gazole à Vannes et Séné : où c’est le moins cher, et quand y aller.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1f3f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0e100f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
