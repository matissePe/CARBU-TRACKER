import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 est un module natif : il doit rester en require() côté serveur
  // au lieu d'être passé au bundler.
  serverExternalPackages: ['better-sqlite3'],

  /*
   * Sans ça, consulter l'app depuis le téléphone est cassé — et de façon trompeuse.
   *
   * En mode dev, Next 16 refuse de servir les fichiers /_next/ à une requête dont l'origine
   * n'est pas localhost : ouvrir http://192.168.x.x:3000 sur un mobile renvoie le HTML (200)
   * mais des 403 sur tous les chunks. La page s'affiche donc entièrement, puisqu'elle est
   * rendue côté serveur, sauf les composants clients — c'est-à-dire, ici, le seul graphique.
   *
   * On autorise le réseau local privé. Le mode production (`npm run start`) n'est pas concerné.
   */
  allowedDevOrigins: ['192.168.1.*', '192.168.0.*', '10.0.0.*', '*.local'],
};

export default nextConfig;
