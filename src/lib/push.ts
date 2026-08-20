/**
 * Le peu que le navigateur et l'expéditeur doivent connaître en commun.
 *
 * Les notifications sont un signal de *timing*, et rien d'autre : la question « où c'est le
 * moins cher » se regarde au moment de partir, elle ne se pousse pas. Mesuré sur les 12 derniers
 * mois de la base : la station la moins chère change 109 fois par an pour 1,30 € d'écart moyen
 * sur un plein — 109 dérangements pour 12 pleins. Le feu vert, lui, bascule 5 fois par an.
 */

/** Clé publique VAPID. Publique par construction : elle voyage dans le bundle du site. */
export const VAPID_PUBLIC_KEY =
  'BBNPHLlutHjC19k9svkjkDEDpK-eX6HgcYTJub4IaDUN2TdKFS503cqiJI4U3JeuH8h2XzVOvb7xgNUGtfRQrXM';

/**
 * Le sujet VAPID doit être un `mailto:` ou un `https:` réel : Apple rejette tout le reste avec
 * un 403 « BadJwtToken », y compris un `https://localhost`. L'adresse du site fait l'affaire et
 * évite d'écrire une adresse mail dans le dépôt.
 */
export const VAPID_SUBJECT = 'https://matissepe.github.io/CARBU-TRACKER/';

/** Adresse publique du site, pour que le lien d'une notification ouvre la bonne page. */
export const SITE_URL = 'https://matissepe.github.io/CARBU-TRACKER';

/**
 * Empreinte courte d'un abonnement.
 *
 * L'abonnement lui-même est recopié à la main dans un secret du dépôt (il n'y a pas de serveur
 * pour le recevoir). Sans garde-fou, le jour où iOS l'invalide — réinstallation, permission
 * retirée, purge — les notifications s'arrêteraient sans que rien ne le dise. Le site publie
 * donc l'empreinte de l'abonnement qu'il utilise réellement ; l'app compare avec le sien à
 * l'ouverture et réclame un nouveau copier-coller si les deux ont divergé.
 *
 * Une empreinte et non l'abonnement : l'endpoint est un jeton d'envoi, il n'a rien à faire en
 * clair dans du HTML public.
 */
export async function fingerprint(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Empreinte de l'abonnement réellement utilisé par l'expéditeur, figée au build. */
export const PUBLISHED_FINGERPRINT = process.env.NEXT_PUBLIC_PUSH_FINGERPRINT ?? '';
