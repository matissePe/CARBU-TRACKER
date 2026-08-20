/*
 * Envoie la notification de feu vert, si elle est due.
 *
 * Tourne dans le même job que l'ingestion, toutes les deux heures : un site statique n'a pas de
 * serveur, mais le workflow en est un — il a le réseau, la base, et il sait ce qui vient de
 * changer. La latence maximale est donc de deux heures, sans importance pour un prix qui bouge
 * tous les un à deux jours.
 *
 * L'abonnement arrive par le secret PUSH_SUBSCRIPTION, recopié à la main depuis le téléphone :
 * il n'y a pas d'endpoint pour le recevoir, et un seul utilisateur à abonner. Le site publie
 * l'empreinte de cet abonnement pour que l'app signale d'elle-même s'il a été invalidé.
 */
import webpush from 'web-push';

import { type Decision, decide, recordSent } from '@/lib/notifications';
import { SITE_URL, VAPID_PUBLIC_KEY, VAPID_SUBJECT, fingerprint } from '@/lib/push';

async function main() {
  /*
   * Le feu vert ne bascule que cinq fois par an : sans déclencheur manuel, on ne saurait pas
   * avant des semaines si la chaîne fonctionne, et le silence est indistinguable de la panne.
   * Le test court-circuite les trois garde-fous, mais rien d'autre — même clé, même abonnement,
   * même service worker.
   */
  const test = process.env.PUSH_TEST === '1';

  // Évalué avant même de savoir s'il y a un abonnement : c'est ce qui mémorise la couleur du
  // feu. Sans ça, le tout premier tour après un abonnement serait aveugle et raterait la bascule.
  const decision = test ? testDecision() : decide();
  if (!decision.send) {
    console.log(`Rien à notifier — ${decision.reason}.`);
    return;
  }

  const raw = process.env.PUSH_SUBSCRIPTION;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!raw || !privateKey) {
    console.log('Feu vert, mais notifications non configurées (PUSH_SUBSCRIPTION absent).');
    return;
  }

  const subscription = JSON.parse(raw) as webpush.PushSubscription;
  console.log(`Abonnement ${await fingerprint(subscription.endpoint)} · ${decision.detail}`);

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, privateKey);

  try {
    await webpush.sendNotification(subscription, JSON.stringify(decision.send));
    // Un test ne consomme pas le verrou de 21 jours : il ne dit rien sur le marché.
    if (!test) recordSent('green', decision.detail);
    console.log('Notification envoyée.');
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    /*
     * 404 et 410 sont les deux façons dont Apple dit « cet abonnement n'existe plus ». Le
     * workflow ne peut pas le renouveler tout seul : c'est l'app qui s'en apercevra, en
     * comparant son empreinte à celle publiée, et qui réclamera un nouveau copier-coller.
     * On n'échoue donc pas le job — le site doit continuer à se publier.
     */
    if (status === 404 || status === 410) {
      console.log('Abonnement expiré ou révoqué : à recopier depuis le téléphone.');
      return;
    }
    throw error;
  }
}

function testDecision(): Decision {
  return {
    detail: 'test manuel',
    send: {
      web_push: 8030,
      notification: {
        title: 'Test',
        body: 'Si tu lis ça, la chaîne de notification fonctionne de bout en bout.',
        navigate: `${SITE_URL}/`,
        app_badge: 1,
      },
    },
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
