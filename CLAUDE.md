# CARBU-TRACKER

En ligne : **https://matissepe.github.io/CARBU-TRACKER/**

Site web **personnel** (mono-utilisateur, pas d'authentification, pas de multi-tenant) qui suit
l'évolution des prix des carburants dans les stations-service de **Vannes** et **Séné** (Morbihan, 56).

## Objectif fonctionnel

1. Lister les stations-service de Vannes et Séné (9 actives recensées, cf. docs/STATIONS.md).
2. Permettre de sélectionner une (ou plusieurs) station(s).
3. Permettre de sélectionner un carburant (Gazole, SP95, E10, SP98, E85, GPLc — ids 1 à 6 à la source).
4. Afficher l'**historique des prix sous forme de courbe** + les **tendances**
   (variation sur 7/30/90 jours, min/max, moyenne, station la moins chère du moment).

Tout le reste est hors périmètre tant que ce n'est pas explicitement demandé.

## Source de données

Deux sources publiques complémentaires, sous Licence Ouverte v2.0, sans authentification.
👉 **Tout est documenté et vérifié dans [docs/DATA-SOURCE.md](docs/DATA-SOURCE.md)** — le lire avant
d'écrire la moindre ligne d'ingestion. Il contient 11 pièges vérifiés sur les vraies données ;
ne pas les redécouvrir à la main.

1. **Flux instantané** (Opendatasoft Explore v2.1, `data.economie.gouv.fr`) — prix actuels,
   rafraîchi toutes les 15 min, filtrable côté serveur. Sert à prolonger la courbe au fil de l'eau.
2. **Archives annuelles** (`donnees.roulez-eco.fr/opendata/annee/YYYY`) — **tout l'historique des
   changements de prix depuis 2007**. Sert au backfill initial.

Les deux sources partagent les mêmes `id` de station, les mêmes horodatages `maj` et les mêmes valeurs,
donc la clé `(station_id, fuel, maj)` déduplique naturellement entre backfill et flux.

Les trois pièges les plus coûteux, en résumé :

- Les horodatages sont en **heure murale `Europe/Paris`** malgré le suffixe `+00:00` de l'API. Ne jamais convertir de fuseau.
- Le champ `ville` a une casse incohérente et le CP 56000 déborde sur Ploeren → le périmètre est une
  **liste explicite d'ids de stations** ([docs/STATIONS.md](docs/STATIONS.md)), pas un filtre géographique.
- Les données **ne contiennent ni nom ni enseigne** de station : c'est exclu à la source. Correspondance manuelle.
- L'**unité des prix change en 2022** : millièmes entiers avant, euros décimaux après. `toMilli()`
  tranche sur l'ordre de grandeur, ne pas le « simplifier ».

## Stack (en place)

- **Next.js 16 (App Router) + React 19 + TypeScript**. Node 24 (`.nvmrc`) — Next exige ≥ 18.18.
- **SQLite** (`data/carbu.db`) via `better-sqlite3`, déclaré dans `serverExternalPackages`.
- **Recharts** pour les courbes, **Tailwind CSS 4** pour le style.
- **Le site est publié en HTML statique** sur GitHub Pages, régénéré toutes les deux heures par
  GitHub Actions (`.github/workflows/publish.yml`). SQLite ne tourne plus qu'à la génération :
  le site publié ne contient aucune base, seulement 103 pages.
  - La base vit entre deux exécutions comme **asset de la release `data`**, jamais dans git.
  - Le backfill reste une opération locale (`.cache/` fait 411 Mo). En CI il ne sert que de
    filet : si l'asset a disparu, le job reconstruit tout depuis les archives annuelles.
  - `scripts/launchd/` reste utilisable pour ingérer depuis le Mac, mais n'est plus nécessaire.
- **Conséquence des pages statiques : jamais de date relative rendue côté serveur.** Un « il y a
  13 h » figé dans du HTML régénéré toutes les deux heures devient faux dès la minute suivante.
  Le serveur rend donc toujours l'absolu, et `RelativeTime` (composant client) le remplace par
  le relatif après hydratation, à partir de l'heure réelle et rafraîchi chaque minute.
  Le premier rendu client doit rester identique au rendu serveur, sinon React signale un écart
  d'hydratation — d'où le passage au relatif dans un `useEffect` et non à la volée.
  Corollaire : ne jamais calculer d'âge au build. `ranking()` ne renvoie plus `ageHours`.
- `tsx` pour exécuter les scripts TypeScript sans étape de build.

### Carte du code

| Fichier | Rôle |
|---|---|
| `src/config/stations.ts` | périmètre : les 9 ids suivis, et l'enseigne saisie à la main |
| `src/lib/fuels.ts` | carburants, mapping vers la source, conversion des prix en millièmes |
| `src/lib/db.ts` | connexion SQLite, schéma, synchro des stations |
| `src/lib/prices.ts` | écriture idempotente, historique, série du meilleur prix, filtrage des pics |
| `src/lib/advice.ts` | position dans la fourchette 90 j, sens de variation 14 j, formulation du conseil |
| `src/lib/paris-time.ts` | manipulation des horodatages naïfs en heure de Paris |
| `src/lib/trends.ts` | variations 7/30/90 j, min/max, moyenne pondérée, classement des stations |
| `src/config/vehicle.ts` | réservoir de référence, conversion d'un écart de prix en euros par plein |
| `scripts/backfill.ts` | archives annuelles → base (streaming, ISO-8859-1) |
| `scripts/ingest.ts` | flux instantané → base |

## Modèle de données (cible)

- `stations` : id (id national, entier, stable entre les deux sources), adresse, ville, cp, lat, lon,
  enseigne (saisie manuellement), active.
- `prices` : station_id, fuel (`gazole|sp95|sp98|e10|e85|gplc`), price_milli (entier, millièmes d'euro),
  recorded_at (chaîne naïve ISO en heure de Paris, telle que fournie par la source).
- `station_fuels` : ce que chaque station distribue **aujourd'hui**, réécrit à chaque ingestion.
  Sans cette table, une station qui a cessé de vendre le GPLc en 2011 réapparaît dans le classement
  avec son prix de l'époque — `prices` est un historique, pas un état courant.
  - Clé unique `(station_id, fuel, recorded_at)` → ingestion **idempotente**, backfill et flux
    peuvent se recouvrir sans dégât.
- Chaque ligne est un **changement de prix**, pas un relevé périodique : ~200 par an et par carburant,
  soit un changement tous les 1 à 2 jours. La courbe se trace donc en escalier (`stepAfter`) et jamais
  en interpolation linéaire, qui inventerait des variations inexistantes. Le prix « du jour J » est le
  dernier point antérieur à J.
- Backfill complet estimé à ~100 000 lignes pour les 9 stations sur 2007→2026.
- **La profondeur d'historique dépend du carburant** (Gazole/SP95 depuis 2007, E10 ~2010, SP98 ~2013,
  E85 ~2016, GPLc quasi rien avant 2022). L'UI ne doit proposer que les carburants réellement
  distribués par la station sélectionnée. Détail dans docs/DATA-SOURCE.md.

## Décisions produit (tranchées le 19/08/2026)

L'app répond à **deux questions**, dans cet ordre : *où c'est le moins cher* et *quand y aller*.
Ce n'est pas un explorateur d'historique — la courbe justifie le conseil, elle ne le remplace pas.

- **Le gazole est le carburant par défaut** (voiture au gazole). Les cinq autres restent accessibles
  mais ne sont pas mis en avant.
- **Rythme d'achat : environ un plein par mois.** L'utilisateur peut donc décaler son plein de
  quelques jours ; c'est ce qui rend le conseil « maintenant ou plus tard » utile.
- **Réservoir de référence : 50 L** (Peugeot 207 SW de 2008) — voir `src/config/vehicle.ts`.
  Les écarts de prix s'affichent **en euros sur un plein**, pas en centimes par litre.
- **Le mobile est la version de référence**, l'écran d'ordinateur est celui qui gagne de la place.
  Les deux mises en page peuvent diverger franchement.
- **Aucune projection de prix.** L'app affiche une position dans la fourchette et une direction
  récente, jamais une prévision : une tendance s'inverse en trois jours.
- **L'app ne conseille jamais d'attendre plus d'une à deux semaines.** C'est la souplesse réelle
  d'un plein mensuel, et guetter au-delà fait perdre de l'argent (voir ci-dessous).

### Ce que la simulation a montré (19/08/2026)

Backtest d'un plein tous les 30 jours avec 14 jours de souplesse, moyenné sur 30 phases de départ,
sur l'historique réel. Un signe **+** signifie qu'on paie plus cher qu'en ignorant l'app.

| Règle | 2022 → 2026 | 12 derniers mois |
|---|---|---|
| position **30 j** < 30 % | +0,41 €/an | +6,08 €/an |
| position **90 j** < 30 % | −2,16 €/an | +1,89 €/an |
| position **180 j** < 30 % | −10,08 €/an | +4,25 €/an |
| position 90 j < 50 % **ou** rebond | −1,49 €/an | −5,03 €/an |

Trois conclusions, qui pilotent `src/lib/advice.ts` :

1. **Ne pas raccourcir la fenêtre sous 90 jours.** Sur une baisse continue, le prix est chaque jour
   proche de son plus bas des 30 derniers jours : la jauge donne le feu vert en permanence alors
   qu'attendre aurait été meilleur. Une fenêtre courte efface la tendance, qui porte l'information.
2. **Ne pas l'allonger non plus.** 180 jours est plus juste mais ne donne le feu vert que 1 % des
   jours et reste muet jusqu'à 229 jours d'affilée — inutilisable à raison d'un plein par mois.
3. **Acheter quand le prix est raisonnable, pas parfait.** Seule règle gagnante sur les 12 derniers
   mois : position < 50 % **ou** creux manifestement passé.

**Et surtout : la question « où » vaut trois à dix fois la question « quand ».** Aller à la moins
chère plutôt qu'à une station quelconque vaut ~29 €/an (écart moyen mesuré de 0,048 €/L) ; le
meilleur réglage de timing, ~10 €/an au mieux. D'où le classement au-dessus du conseil.

### Ajouter à l'écran d'accueil

`src/app/manifest.ts` et les métadonnées `appleWebApp` de `layout.tsx` font que « Sur l'écran
d'accueil » depuis Safari installe l'app sans barre d'adresse, avec son icône. iOS ignore le
manifeste pour l'icône : il lui faut le lien `apple-touch-icon` (180×180, opaque).
Les icônes sont générées depuis `public/icon.svg`.

### Consulter depuis le téléphone en dev

`allowedDevOrigins` doit rester renseigné dans `next.config.ts`. En mode dev, Next 16 refuse de
servir les fichiers `/_next/` à une requête venant d'une autre origine que localhost : ouvrir
`http://192.168.x.x:3000` depuis un mobile renvoie le HTML en 200 mais des **403 sur tous les
chunks**. La page paraît donc complète — sauf la courbe. Diagnostiqué le 19/08/2026 après une
fausse piste sur la version de Safari : l'iPhone n'y était pour rien.

### Écarté explicitement

- **Pas de carte.** Imposerait un fond de carte externe à une app qui tourne en local ; 9 stations
  connues, l'enseigne suffit.
- **Pas de superposition de plusieurs stations sur une même courbe.** Illisible au-delà de
  4 séries qui se croisent.
- **Le graphique est le seul composant client de la page.** Conséquence à garder en tête :
  si le bundle ne s'exécute pas, toute la page s'affiche normalement et **seule la courbe
  disparaît**. Un symptôme « le graphique ne s'affiche pas » est donc presque toujours un
  problème de chargement du JavaScript, pas un problème de graphique.

## Règles de travail

- **Langue** : réponses et commentaires de commit en français ; code, noms de variables et de fichiers en anglais.
- **Périmètre** : filtrer à l'ingestion, pas à l'affichage.
  Le périmètre est une liste explicite d’ids de stations dans `src/config/stations.ts`, pas un filtre sur la commune ni sur le code postal.
- **Prix** : stockés en **entiers (millièmes d’euro)** — la source donne 3 décimales (`2.179` → `2179`). Jamais de flottant.
- **Dates** : la source publie de l’heure murale `Europe/Paris` (mal étiquetée `+00:00` par l’API). On la stocke telle quelle, sans conversion de fuseau. Voir le piège n°1 dans docs/DATA-SOURCE.md.
- **Pas de sur-ingénierie** : projet perso, un seul utilisateur. Pas d'auth, pas de queue, pas de Docker,
  pas de microservices, pas d'abstraction "au cas où".
- **Réseau** : toujours mettre en cache les réponses de l'API publique en local pendant le dev
  (`.cache/`) pour ne pas marteler le service et pouvoir travailler hors ligne.
- **Respect de la source** : un seul appel d'ingestion par exécution, User-Agent explicite, pas de scraping HTML
  si un flux de données ouvert existe.
- Ne jamais committer le fichier de base de données ni le cache (cf. `.gitignore`).
- Avant d'ajouter une dépendance : vérifier qu'elle est vraiment nécessaire.

## Commandes

Faire `nvm use` avant tout (Node 24 ; le Node par défaut de la machine est trop ancien).

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de dev sur http://localhost:3000 |
| `npm run build` / `npm run start` | build et serveur de production |
| `npm run ingest` | récupère les prix actuels et insère les changements |
| `npm run backfill` | importe les archives annuelles 2007→année courante |
| `npm run backfill -- 2024 2026` | rejoue une plage précise |
| `npm run lint` / `npm run typecheck` | qualité |

## État d'avancement

- [x] Init du dépôt et de la documentation
- [x] Valider la source de données et son schéma ([docs/DATA-SOURCE.md](docs/DATA-SOURCE.md))
- [x] Recenser les stations de Vannes et Séné ([docs/STATIONS.md](docs/STATIONS.md))
- [x] Trancher le cas de la station 56000008 → elle est à Vannes, incluse
- [x] Scaffolding Next.js + TypeScript
- [x] Schéma SQLite
- [x] Backfill des archives annuelles 2007→2026 — 98 069 lignes
- [x] Script d'ingestion idempotent depuis le flux instantané
- [x] UI : sélection station + carburant + période
- [x] UI : courbe d'historique (stepAfter)
- [x] UI : indicateurs de tendance et classement des stations
- [ ] **Renseigner les enseignes des 9 stations dans `src/config/stations.ts`** (seul point bloquant
      pour la lisibilité : sans elles, l'UI n'affiche que des adresses)
- [ ] Installer l'agent launchd d'ingestion (cf. `scripts/launchd/`)
- [x] Refonte autour des deux questions : conseil, jauge de position, classement, mobile d'abord
- [ ] Alerte quand le prix descend dans le quart bas de sa fourchette 90 jours
- [ ] Rétrospective « combien j'aurais économisé » sur 12 mois

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
