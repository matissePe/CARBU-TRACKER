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
d'écrire la moindre ligne d'ingestion. Il contient 7 pièges vérifiés sur les vraies données ;
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

## Stack (hypothèse initiale, à confirmer)

- **Next.js (App Router) + TypeScript** — front + routes API dans un seul projet.
- **SQLite** (fichier `data/carbu.db`) via un client léger — suffisant pour un usage perso.
- **Recharts** pour les courbes.
- **Tailwind CSS** pour le style.
- Script d'ingestion `scripts/ingest.ts` lancé manuellement ou par cron/launchd.

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

_(à créer avec le projet — mettre à jour cette section dès que le `package.json` existe)_

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de dev |
| `npm run build` | build de production |
| `npm run ingest` | récupère les prix du jour et les insère en base |
| `npm run backfill` | importe les archives annuelles 2007→année courante |
| `npm run lint` / `npm run typecheck` | qualité |

## État d'avancement

- [x] Init du dépôt et de la documentation
- [x] Valider la source de données et son schéma ([docs/DATA-SOURCE.md](docs/DATA-SOURCE.md))
- [x] Recenser les stations de Vannes et Séné ([docs/STATIONS.md](docs/STATIONS.md))
- [x] Trancher le cas de la station 56000008 → elle est à Vannes, incluse
- [ ] Renseigner les enseignes des 9 stations dans docs/STATIONS.md
- [ ] Scaffolding Next.js + TypeScript
- [ ] Schéma SQLite + migration initiale
- [ ] Backfill depuis les archives annuelles 2007→2026 (parsing XML en streaming)
- [ ] Script d'ingestion idempotent depuis le flux instantané
- [ ] UI : sélection station + carburant
- [ ] UI : courbe d'historique (stepAfter)
- [ ] UI : indicateurs de tendance
