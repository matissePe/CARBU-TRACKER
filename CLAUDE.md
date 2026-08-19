# CARBU-TRACKER

Site web **personnel** (mono-utilisateur, pas d'authentification, pas de multi-tenant) qui suit
l'évolution des prix des carburants dans les stations-service de **Vannes** et **Séné** (Morbihan, 56).

## Objectif fonctionnel

1. Lister toutes les stations-service de Vannes (INSEE 56260, CP 56000) et Séné (INSEE 56243, CP 56860).
2. Permettre de sélectionner une (ou plusieurs) station(s).
3. Permettre de sélectionner un carburant (Gazole, SP95, SP95-E10, SP98, E85, GPLc).
4. Afficher l'**historique des prix sous forme de courbe** + les **tendances**
   (variation sur 7/30/90 jours, min/max, moyenne, station la moins chère du moment).

Tout le reste est hors périmètre tant que ce n'est pas explicitement demandé.

## Source de données

Données publiques françaises sur les prix des carburants.
👉 **Détails, URL exacte et schéma : [docs/DATA-SOURCE.md](docs/DATA-SOURCE.md)** — à compléter/valider
avant d'écrire le moindre parseur. Ne pas deviner le format : le vérifier sur la vraie réponse.

Contrainte structurante : la source publique expose surtout un **instantané** des prix.
L'historique long terme est donc **construit et stocké par nous** via une ingestion régulière.
=> La base locale est la source de vérité de l'historique ; ne jamais la réinitialiser sans demander.

## Stack (hypothèse initiale, à confirmer)

- **Next.js (App Router) + TypeScript** — front + routes API dans un seul projet.
- **SQLite** (fichier `data/carbu.db`) via un client léger — suffisant pour un usage perso.
- **Recharts** pour les courbes.
- **Tailwind CSS** pour le style.
- Script d'ingestion `scripts/ingest.ts` lancé manuellement ou par cron/launchd.

## Modèle de données (cible)

- `stations` : id (id national de la station), nom/enseigne, adresse, ville, cp, lat, lon.
- `prices` : station_id, fuel (enum), price (centimes en entier, jamais de float pour l'argent), recorded_at (UTC ISO).
  - Contrainte d'unicité `(station_id, fuel, recorded_at)` pour rendre l'ingestion **idempotente**.
  - On n'insère un point que si le prix a changé depuis le dernier relevé (stockage en escalier),
    et l'affichage interpole en marches d'escalier (`stepAfter`), pas en ligne droite.

## Règles de travail

- **Langue** : réponses et commentaires de commit en français ; code, noms de variables et de fichiers en anglais.
- **Périmètre géographique** : filtrer Vannes + Séné à l'ingestion, pas à l'affichage.
  Les deux communes sont configurées dans un seul endroit (`src/config/cities.ts`), pas en dur dans le code.
- **Prix** : stockés en **entiers (millièmes d'euro)** pour éviter les erreurs de flottants. Formatage à l'affichage seulement.
- **Dates** : stockage en UTC ISO-8601, affichage en `Europe/Paris`.
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
| `npm run backfill` | importe l'historique annuel disponible dans la source publique |
| `npm run lint` / `npm run typecheck` | qualité |

## État d'avancement

- [x] Init du dépôt et de la documentation
- [ ] Valider la source de données et son schéma (`docs/DATA-SOURCE.md`)
- [ ] Scaffolding Next.js + TypeScript
- [ ] Schéma SQLite + migration initiale
- [ ] Script d'ingestion idempotent
- [ ] Backfill de l'historique
- [ ] UI : sélection station + carburant
- [ ] UI : courbe d'historique
- [ ] UI : indicateurs de tendance
