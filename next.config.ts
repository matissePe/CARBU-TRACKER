import type { NextConfig } from 'next';

/*
 * Le site est publié en HTML statique sur GitHub Pages, sous un chemin de projet
 * (matissepe.github.io/CARBU-TRACKER). En local le chemin racine reste `/`, d'où la variable.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  // GitHub Pages sert des répertoires : un chemin doit donc correspondre à un index.html,
  // sinon /gazole/56000005/90 renvoie 404.
  trailingSlash: true,

  // better-sqlite3 est un module natif. Il n'est plus utilisé qu'à la génération — le site
  // publié ne contient aucune base de données, seulement du HTML.
  serverExternalPackages: ['better-sqlite3'],

  /*
   * En mode dev, Next 16 refuse de servir les fichiers /_next/ à une requête dont l'origine
   * n'est pas localhost : ouvrir http://192.168.x.x:3000 sur un mobile renvoie le HTML mais
   * des 403 sur tous les chunks, et seuls les composants clients disparaissent.
   */
  allowedDevOrigins: ['192.168.1.*', '192.168.0.*', '10.0.0.*', '*.local'],
};

export default nextConfig;
