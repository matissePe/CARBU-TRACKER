# CARBU-TRACKER

Suivi personnel de l'évolution des prix des carburants dans les stations-service de
**Vannes** et **Séné** (Morbihan).

Sélectionner une station et un carburant, voir la courbe historique et les tendances.
Historique complet **depuis 2007**, prolongé automatiquement par le flux instantané.

## Démarrage

```bash
nvm use                 # Node 24 — le Node par défaut de la machine est trop ancien
npm install
npm run backfill        # ~98 000 lignes, 2007 → aujourd'hui (une seule fois, ~10 min)
npm run ingest          # prix actuels
npm run dev             # http://localhost:3000
```

Le backfill met en cache les archives annuelles dans `.cache/` : le relancer ne retélécharge
rien. L'ingestion est idempotente, on peut la rejouer sans risque de doublon.

## Ingestion automatique

```bash
sed "s|__PROJECT_DIR__|$PWD|g" scripts/launchd/fr.carbu-tracker.ingest.plist \
  > ~/Library/LaunchAgents/fr.carbu-tracker.ingest.plist
launchctl load ~/Library/LaunchAgents/fr.carbu-tracker.ingest.plist
```

Toutes les 30 minutes, les prix sont relus et une ligne n'est ajoutée que si un prix a
réellement changé. Journal dans `data/ingest.log`.

## Documentation

- [CLAUDE.md](CLAUDE.md) — contexte, règles, carte du code, avancement
- [docs/DATA-SOURCE.md](docs/DATA-SOURCE.md) — les deux sources publiques et **11 pièges vérifiés**
  sur les vraies données (fuseau horaire mal étiqueté, unité des prix qui change en 2022,
  encodage ISO-8859-1, fautes de saisie…) — à lire avant de toucher à l'ingestion
- [docs/STATIONS.md](docs/STATIONS.md) — les 9 stations suivies

## Données

Sources publiques sous Licence Ouverte v2.0, sans authentification :
le [flux instantané](https://www.data.gouv.fr/datasets/prix-des-carburants-en-france-flux-instantane-v2-amelioree)
et les archives annuelles de `donnees.roulez-eco.fr`.
La base SQLite (`data/`) et le cache (`.cache/`) ne sont pas versionnés.
