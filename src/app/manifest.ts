import type { MetadataRoute } from 'next';

/*
 * Le site est publié sous un chemin de projet GitHub Pages, pas à la racine du domaine.
 * Next préfixe le lien vers le manifeste, mais pas les URL qu'il contient : elles sont
 * écrites explicitement, sinon l'icône et le lancement pointeraient vers la racine du domaine.
 */
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Où faire le plein',
    short_name: 'Le plein',
    description: 'Prix du gazole à Vannes et Séné : où c’est le moins cher, et quand y aller.',
    lang: 'fr',
    start_url: `${base}/`,
    scope: `${base}/`,
    // Ouvre sans la barre d'adresse de Safari, comme une application.
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f1f3f1',
    theme_color: '#141a18',
    icons: [
      // Safari 26 sait matricer un SVG de manifeste lui-même, à toutes les tailles dont il a
      // besoin. Les PNG restent la solution de repli pour tout le reste.
      { src: `${base}/icon.svg`, sizes: 'any', type: 'image/svg+xml' },
      { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
