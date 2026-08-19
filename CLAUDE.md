# CARBU-TRACKER

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
- **Tout tourne en local sur le Mac** : pas de déploiement, pas de base distante.
  L'ingestion est planifiée par launchd (`scripts/launchd/`), toutes les 30 minutes.
- `tsx` pour exécuter les scripts TypeScript sans étape de build.

### Carte du code

| Fichier | Rôle |
|---|---|
| `src/config/stations.ts` | périmètre : les 9 ids suivis, et l'enseigne saisie à la main |
| `src/lib/fuels.ts` | carburants, mapping vers la source, conversion des prix en millièmes |
| `src/lib/db.ts` | connexion SQLite, schéma, synchro des stations |
| `src/lib/prices.ts` | écriture idempotente, lecture de l'historique, filtrage des pics aberrants |
| `src/lib/paris-time.ts` | manipulation des horodatages naïfs en heure de Paris |
| `src/lib/trends.ts` | variations 7/30/90 j, min/max, moyenne pondérée, classement |
| `scripts/backfill.ts` | archives annuelles → base (streaming, ISO-8859-1) |
| `scripts/ingest.ts` | flux instantané → base |

## Modèle de données (cible)

- `stations` : id (id national, entier, stable entre les deux sources), adresse, ville, cp, lat, lon,
  enseigne (saisie manuellement), active.
- `prices` : station_id, fuel (`gazole|sp95|sp98|e10|e85|gplc`), price_milli (entier, millièmes d'euro),
  recorded_at (chaîne naïve ISO en heure de Paris, telle que fournie par la source).
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
- [ ] Éventuellement : comparer plusieurs stations sur une même courbe
