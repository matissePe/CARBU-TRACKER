/*
 * Service worker de notification, et rien d'autre.
 *
 * Volontairement sans `fetch` et sans cache : le site est régénéré toutes les deux heures, un
 * cache géré à la main n'y apporterait que des versions périmées. iOS impose un service worker
 * pour recevoir un push avant 18.4 ; le Declarative Web Push le rend optionnel au-delà, mais pas
 * absent, et quinze lignes coûtent moins cher qu'un plancher de version.
 *
 * Le format du message est celui du Declarative Web Push ({ web_push, notification }) pour
 * n'avoir qu'un seul format à produire côté expéditeur.
 */

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const notification = payload.notification ?? {};

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(notification.title ?? 'Où faire le plein', {
        body: notification.body,
        // Un seul tag : une nouvelle alerte remplace la précédente au lieu de s'empiler.
        tag: 'carbu',
        data: { navigate: notification.navigate },
      });

      // La pastille s'allume ici et s'éteint à l'ouverture de l'app : iOS interdit le push
      // silencieux (`userVisibleOnly`), donc rien ne peut l'éteindre à distance.
      if (typeof notification.app_badge === 'number' && self.navigator.setAppBadge) {
        await self.navigator.setAppBadge(notification.app_badge);
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.navigate;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // L'app est déjà ouverte quelque part : on la remet devant plutôt que d'en ouvrir une autre.
      for (const client of windows) {
        if ('focus' in client) return client.focus();
      }
      if (target) return self.clients.openWindow(target);
    })(),
  );
});
