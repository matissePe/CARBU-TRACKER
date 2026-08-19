import type { Metadata, Viewport } from 'next';
import { Familjen_Grotesk, IBM_Plex_Mono } from 'next/font/google';

import './globals.css';

const sans = Familjen_Grotesk({ subsets: ['latin'], variable: '--font-familjen' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex' });

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Où faire le plein',
  description: 'Prix du gazole à Vannes et Séné : où c’est le moins cher, et quand y aller.',
  // iOS ignore le manifeste pour l'icône de l'écran d'accueil : il lui faut apple-touch-icon.
  icons: {
    icon: [{ url: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png' }],
    apple: [{ url: `${base}/apple-touch-icon.png`, sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Le plein',
    // La barre d'état se fond dans l'en-tête sombre de l'app.
    statusBarStyle: 'black-translucent',
  },
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
