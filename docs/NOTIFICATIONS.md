# Notifications

Une seule alerte existe : **le passage au feu vert**. Une quinzaine de fois par an.

## Pourquoi celle-là, et pas les autres

Rejeu des 365 derniers jours sur la base, au 20/08/2026 :

| Événement candidat | Fois par an | Verdict |
|---|---|---|
| La station la moins chère change | **109** (écart moyen 1,30 € le plein) | écarté |
| Le conseil passe au feu vert | **13** bascules | **retenu** |
| Le prix entre dans le quart bas 90 j | 5 | doublon du feu vert |
| Baisse d'au moins 3 c/L d'un coup | 22 | trop fréquent pour 12 pleins |

La première ligne tranche le débat : la tête du classement change tous les trois jours pour
1,30 € d'écart. Notifier là-dessus, ce serait 109 dérangements par an pour 12 pleins.
**Le classement est une réponse qu'on va chercher au moment de partir, jamais une réponse qu'on
pousse.** Une notification ne peut donc adresser que le « quand » — plafonné à une dizaine
d'euros par an par la simulation de CLAUDE.md, contre ~29 €/an pour le « où ». Le bénéfice réel
est de ne pas rater les bons moments de l'année sans y penser, pas l'argent.

Un seul garde-fou, dans `src/lib/notifications.ts` : **seules les bascules notifient.** La couleur
du feu au tour précédent est mémorisée en base (`push_state`) ; sans ça, les 106 jours de feu vert
annuels sonneraient toutes les deux heures.

Un verrou de 21 jours et des heures calmes (8 h – 22 h) ont existé, puis ont été retirés à la
demande le 20/08/2026. Conséquence assumée : 13 alertes par an au lieu de 8, et une bascule de
nuit sonne à l'heure où elle tombe. `push_log` n'est plus qu'une trace, plus aucune règle ne le lit.

## Par quelle branche ça part

Rejeu correct des 12 derniers mois — en ancrant la fenêtre de direction sur le jour rejoué et non
sur l'horloge, erreur de la première mesure qui avait sous-estimé le compte à 5 :

| Branche du conseil | Bascules /an | Position du prix |
|---|---|---|
| « Le creux est passé, ça remonte » | **10** | 72 % à 100 % de la fourchette |
| « Prix correct, vas-y » (position < 50 %) | 3 | 45 % à 49 % |
| « Fais le plein maintenant » (position < 30 %) | 0 | — |

**Les trois quarts des alertes partent donc à un prix haut qui remonte**, pas à un bon prix. C'est
cohérent avec la simulation de CLAUDE.md — « position < 50 % ou rebond » est la seule règle qui bat
l'inaction — mais un écran qu'on consulte et une vibration ne se valent pas. Question ouverte : ne
notifier que par les branches de position (2 à 3 fois par an, toujours à un prix réellement bas).

## Ce qu'iOS exige

Vérifié sur la documentation WebKit, pas de mémoire :

- **iOS 16.4 minimum.**
- **L'app doit être lancée depuis l'écran d'accueil**, avec un manifeste en `display: standalone`
  — c'est déjà le cas. Un onglet Safari ne reçoit rien, et les deux contextes sont étanches :
  s'abonner depuis l'onglet ne compte pas pour l'icône.
- **La demande de permission doit partir d'un geste** (le bouton « Préviens-moi »), jamais d'un
  appel au chargement.
- **`userVisibleOnly` est obligatoire** : tout message reçu doit afficher une notification.
  Conséquence directe : **on ne peut pas éteindre la pastille à distance**, faute de push
  silencieux. Elle s'allume avec la notification et s'éteint à l'ouverture de l'app — elle dit
  donc « il y a un feu vert que tu n'as pas regardé », pas « le feu est vert ».

La peur de 2024 sur les PWA européennes ne s'applique pas : Apple a fait marche arrière le
1er mars 2024, les web apps de l'écran d'accueil et le push fonctionnent en France.

## Comment ça marche sans serveur

Le site est statique, mais **le workflow de publication est un serveur** : il tourne toutes les
deux heures, il a le réseau et la base. Latence maximale de deux heures, sans importance pour un
prix qui bouge tous les un à deux jours.

Reste l'abonnement, qu'aucun endpoint ne peut recevoir. Il est donc **recopié à la main** depuis
le téléphone vers un secret du dépôt. Pour qu'une invalidation ne passe pas inaperçue — le
silence étant le comportement normal cinq fois par an — le site publie l'**empreinte** de
l'abonnement qu'il utilise (`NEXT_PUBLIC_PUSH_FINGERPRINT`, six octets de SHA-256, jamais
l'endpoint en clair) ; l'app compare avec le sien à l'ouverture et réclame un nouveau
copier-coller si les deux ont divergé.

## Activation (une fois)

1. `VAPID_PRIVATE_KEY` en secret du dépôt (`gh secret set VAPID_PRIVATE_KEY`). La clé publique
   correspondante est en clair dans `src/lib/push.ts` — elle est publique par construction.
2. Sur le téléphone, ouvrir l'app **depuis l'icône de l'écran d'accueil**, descendre jusqu'à
   « Notifications », toucher « Préviens-moi », accepter, puis « Copier le code ».
3. Coller ce code dans `PUSH_SUBSCRIPTION` (`gh secret set PUSH_SUBSCRIPTION`). À la prochaine
   publication, la section affiche « Notifications actives ».
4. Vérifier tout de suite, sans attendre la prochaine bascule :
   `gh workflow run "Publier le site" -f notification_de_test=true`. Le test court-circuite la
   détection de bascule mais rien d'autre — même clé, même abonnement, même service worker — et
   n'entre pas dans l'historique des envois.

## Quand ça casse

- **L'app dit « Les notifications ont été déconnectées »** → iOS a invalidé l'abonnement.
  Refaire les étapes 2 et 3.
- **Le job affiche « Abonnement expiré ou révoqué »** → même chose, vu de l'autre côté. Le job
  n'échoue pas : la publication du site passe avant.
- **403 `BadJwtToken`** → le sujet VAPID n'est pas une URL acceptable pour Apple. Il doit être un
  `mailto:` ou un `https:` réel ; `localhost` est refusé.
- **Rien ne part depuis des mois** → possible, les bascules se regroupent. Lever le doute avec
  une notification de test (étape 4) plutôt qu'en attendant. Dans la base,
  `select * from push_state;` montre la couleur courante et `select * from push_log;`
  l'historique des envois.
- **Les tâches planifiées s'arrêtent** → GitHub désactive un `schedule` après 60 jours sans
  activité sur le dépôt. Le site cesse alors de se régénérer, et les notifications avec.

## Rejouer localement

```sh
CARBU_DB=/tmp/test.db npm run notify     # décide sans envoyer si PUSH_SUBSCRIPTION est absent
sqlite3 /tmp/test.db "update push_state set value='wait' where key='tone';"  # force une bascule
```

Perdu la clé privée ? En regénérer une paire avec `npx web-push generate-vapid-keys`, remplacer
`VAPID_PUBLIC_KEY` dans `src/lib/push.ts` et le secret — puis refaire l'étape 2, l'ancien
abonnement étant lié à l'ancienne clé.
