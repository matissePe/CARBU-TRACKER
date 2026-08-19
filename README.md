# CARBU-TRACKER

Suivi personnel de l'évolution des prix des carburants dans les stations-service de
**Vannes** et **Séné** (Morbihan).

L'app répond à deux questions : **où c'est le moins cher** et **quand y aller**.
Gazole par défaut, écarts exprimés en euros sur un plein, historique complet **depuis 2007**
prolongé automatiquement par le flux instantané.

Le conseil repose sur deux faits mesurés — la position du prix dans sa fourchette des 90 derniers
jours et son sens de variation sur deux semaines. Ce n'est jamais une prévision.

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

## En ligne

👉 **https://matissepe.github.io/CARBU-TRACKER/**

Site statique régénéré toutes les deux heures par GitHub Actions
([`.github/workflows/publish.yml`](.github/workflows/publish.yml)) : il récupère la base,
ingère les prix du moment, régénère les 103 pages, republie la base et déploie.

La base vit entre deux exécutions comme asset de la release `data`, jamais dans git.
Si elle disparaissait, le job la reconstruirait depuis les archives annuelles.

Depuis Safari sur iPhone : **Partager → Sur l'écran d'accueil**. L'app s'ouvre alors sans
barre d'adresse, sous le nom « Le plein ».

## Consulter depuis le téléphone en dev

Depuis un appareil du même réseau Wi-Fi, ouvrir `http://<ip-du-mac>:3000`
(`ipconfig getifaddr en0` donne l'adresse).

L'IP doit figurer dans `allowedDevOrigins` (`next.config.ts`), sinon Next bloque les fichiers
`/_next/` en mode dev : la page s'affiche mais **le graphique reste vide**. Les plages privées
courantes sont déjà autorisées ; si ton réseau utilise un autre préfixe, l'ajouter là.

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
