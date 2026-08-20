import type { Metadata, Viewport } from 'next';
import { Familjen_Grotesk, IBM_Plex_Mono } from 'next/font/google';

import './globals.css';

const sans = Familjen_Grotesk({ subsets: ['latin'], variable: '--font-familjen' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex' });

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Où faire le plein',
  description: 'Prix du gazole à Vannes et Séné : où c’est le moins cher, et quand y aller.',
  /*
   * iOS ignore le manifeste pour l'icône de l'écran d'accueil : il lui faut apple-touch-icon,
   * un PNG opaque de 180 px.
   *
   * Le SVG vient en premier pour l'onglet du navigateur : c'est le seul des trois qui suive le
   * thème système, parce qu'il est chargé comme un document et que sa media query s'applique.
   * L'icône de l'écran d'accueil, matricée à l'installation, en est incapable (docs/ICONE.md).
   */
  icons: {
    icon: [
      { url: `${base}/favicon.svg`, type: 'image/svg+xml' },
      { url: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    ],
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
