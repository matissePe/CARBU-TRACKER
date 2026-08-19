# Source de données

Vérifié le 19/08/2026 contre les vraies réponses. Deux sources complémentaires, **même identifiants**,
**même format de prix**, donc parfaitement fusionnables.

| | Flux instantané | Archives annuelles |
|---|---|---|
| Contenu | prix **actuels** uniquement | **tout l'historique** des changements de prix |
| Couverture | maintenant | **2007 → année en cours** |
| Rôle | ingestion continue (le futur) | backfill unique (le passé) |
| Licence | Licence Ouverte v2.0 | Licence Ouverte v2.0 |

> ⚠️ **Correction d'une hypothèse initiale** : on pensait devoir construire l'historique nous-mêmes à
> partir de zéro. C'est faux. Les archives annuelles contiennent **tous les changements de prix depuis
> 2007**. On peut donc démarrer avec ~19 ans d'historique réel, et le flux instantané ne sert qu'à
> prolonger la courbe au fil de l'eau.

---

## 1. Flux instantané (ingestion continue)

- Page data.gouv.fr : https://www.data.gouv.fr/datasets/prix-des-carburants-en-france-flux-instantane-v2-amelioree
- Hébergé sur **Opendatasoft** → API `Explore v2.1` avec **filtrage côté serveur** :
  inutile de télécharger l'export complet de 28 Mo.
- Rafraîchi toutes les ~10 min à la source, moissonné toutes les 15 min.

### Requête à utiliser

```
GET https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/
    prix-des-carburants-en-france-flux-instantane-v2/records
    ?where=cp in ("56000","56860")
    &limit=100
```

- Toujours envoyer `Accept-Encoding: gzip` (la réponse est gzippée ; `curl` nécessite `--compressed`).
- Pas de clé d'API, pas d'authentification.
- Le filtre `where=ville in ("Vannes","Séné")` fonctionne aussi mais il est **sensible à la casse**
  (`"VANNES"` renvoie 0 résultat) → préférer le filtre sur `cp` puis normaliser côté client (cf. pièges).

### Champs utiles

| Champ | Type | Note |
|---|---|---|
| `id` | int | identifiant national de la station, **stable dans le temps et commun aux deux sources** |
| `cp`, `ville`, `adresse` | text | casse **non normalisée** |
| `geom` | geo_point | `{lon, lat}` en degrés décimaux → **utiliser celui-ci** |
| `latitude`, `longitude` | text | entiers ×100000 (`4766600` = 47.666) → piège, ne pas utiliser |
| `<fuel>_prix` | double | euros, 3 décimales (`2.179`) — `null` si non distribué |
| `<fuel>_maj` | datetime | date du dernier changement de ce prix → **clé d'historisation** |
| `<fuel>_rupture_debut` / `_type` | | rupture temporaire ou définitive |
| `carburants_disponibles` / `_indisponibles` | text | |
| `services_service`, `horaires_jour` | text | |

Préfixes carburants : `gazole`, `sp95`, `sp98`, `e10`, `e85`, `gplc`.

---

## 2. Archives annuelles (backfill de l'historique)

```
GET https://donnees.roulez-eco.fr/opendata/annee/2025   → ZIP → PrixCarburants_annuel_2025.xml
```

- Années **2007 à 2026** disponibles (2027 renvoie un fichier vide → sentinelle de fin).
- Volume : ZIP de 9 à 32 Mo, XML décompressé de ~390 Mo pour 2025. **Parser en streaming**
  (`iterparse` / SAX), jamais en chargeant l'arbre complet en mémoire.
- Le fichier de l'**année en cours est régénéré périodiquement mais avec un retard de quelques jours**
  (au 19/08, le fichier contenait des données jusqu'au 18/08 selon les carburants).
  → Le flux instantané reste indispensable pour la fin de la courbe.
- Autres endpoints du même service : `/opendata/instantane` (~950 Ko) et `/opendata/jour` (~1,1 Mo).

### Structure XML

```xml
<pdv id="56000004" latitude="4766600" longitude="-279400" cp="56000" pop="R">
  <adresse>ZC PARC LANN</adresse>
  <ville>Vannes</ville>
  <horaires automate-24-24="1">
    <jour id="1" nom="Lundi" ferme="">
      <horaire ouverture="08.00" fermeture="13.15" />
    </jour>
    ...
  </horaires>
  <services><service>Laverie</service>...</services>
  <prix nom="Gazole" id="1" maj="2025-01-03T07:32:42" valeur="1.619" />
  <prix nom="Gazole" id="1" maj="2025-01-04T07:30:29" valeur="1.629" />
  ...
</pdv>
```

Chaque `<prix>` est un **changement de prix**, pas un relevé périodique : la courbe est donc
un escalier, à tracer en `stepAfter`.

### Mapping des identifiants de carburant

| id | nom |
|---|---|
| 1 | Gazole |
| 2 | SP95 |
| 3 | E85 |
| 4 | GPLc |
| 5 | E10 |
| 6 | SP98 |

---

## Pièges vérifiés (à ne pas redécouvrir)

1. **Les timestamps ne sont PAS en UTC malgré le suffixe `+00:00`.**
   Vérifié : station 56000004, E10 à 1,989 € — l'archive donne `2026-08-18T07:00:00` (naïf) et l'API
   donne `2026-08-18T07:00:00+00:00`. Même heure murale, même valeur. L'API se contente d'agrafer
   `+00:00` sur une heure locale de Paris.
   → **Traiter les deux sources comme de l'heure murale `Europe/Paris`. Ne jamais convertir de fuseau.**
   Conséquence : stocker la chaîne naïve telle quelle et la considérer comme du temps local.

2. **La casse de `ville` est incohérente** — on trouve `Vannes`, `VANNES`, `vannes`, `Séné`, `SENE`
   dans les mêmes fichiers. → Normaliser systématiquement (NFD, suppression des accents, majuscules)
   avant toute comparaison.

3. **Le code postal 56000 ne veut pas dire Vannes.** La station `56000008` (16 avenue de la Marne) est
   à **Ploeren** dans le flux instantané, mais rattachée à `VANNES` dans les archives.
   → Ne pas se fier au CP ni à la commune : maintenir une **liste explicite d'ids de stations**
   dans la config (cf. `docs/STATIONS.md`), établie une fois pour toutes.

4. **Ni le nom ni la marque de la station ne sont dans les données.** C'est explicitement exclu à la
   source (« Sont exclus les noms des stations et de la marque associée »). Les stations ne sont
   identifiables que par leur adresse. → Table de correspondance manuelle id → enseigne
   (8 stations, c'est tenable).

5. **Stations fermées** : elles apparaissent dans les archives avec un `<prix/>` vide (aucun attribut).
   Le parseur doit ignorer ces éléments sans planter (`p.get("nom")` vaut `None`).

6. **Prix en euros à 3 décimales** (`2.179`). → Stocker en **entiers de millièmes d'euro** (`2179`),
   jamais en flottant.

7. **`latitude`/`longitude` sont des entiers ×100000 sous forme de texte**, avec des signes négatifs
   pour la Bretagne (`-279400` = −2.794). Utiliser `geom` dans le flux ODS, ou diviser par 100000
   dans les archives.


8. **Les archives sont encodées en ISO-8859-1**, pas en UTF-8 (`<?xml version="1.0"
   encoding="ISO-8859-1"?>`). Décoder en latin1, sinon « Séné » devient « SÃ©nÃ© ».

9. **Le séparateur date/heure change en 2015.** Les archives 2007→2014 écrivent
   `maj="2007-01-02 07:12:15"` (espace, parfois avec des microsecondes), celles de 2015 et
   après `maj="2015-01-02T11:01:45"` (T). Il faut normaliser sur le `T`, sinon un même
   changement de prix peut être stocké deux fois et le tri chronologique de SQLite mélange les
   deux formats (l'espace se classe avant le `T`).

10. **L'unité des prix change en 2022.** C'est le piège le plus coûteux après le fuseau :
    - archives **2007→2021** : entiers en **millièmes d'euro** — `valeur="1141"` = 1,141 €
    - archives **2022→** et flux instantané : **euros décimaux** — `valeur="1.572"`

    Multiplier aveuglément par 1000 donne des gazoles à 1 141 € le litre sur 15 ans d'historique.
    Trancher sur l'ordre de grandeur plutôt que sur l'année (les deux échelles ne se recouvrent
    pas : en euros un prix reste sous 10, en millièmes il dépasse 200) rend la règle robuste si
    la source rebascule.

11. **La source contient de vraies fautes de saisie**, rares mais dévastatrices pour les min/max.
    Deux familles, qui demandent deux parades :
    - **Hors bornes** : 5 relevés sur 98 000 (E10 à `4469`, gazole à `5.579`, E10 à `304`…).
      Un simple contrôle de plausibilité (0,50 € à 3,50 €) les élimine à l'ingestion.
    - **Dans les bornes, mais contredites en quelques minutes** : 11 relevés sur 98 000. Par
      exemple le gazole publié à 1,329 € le 07/04/2026 à 07:20 puis remis à 2,329 € à 07:54.
      La valeur est plausible : seule sa brièveté combinée au retour au niveau précédent la
      trahit. Filtré à la lecture, pas à l'ingestion, pour garder la table fidèle à la source.

---

## Stratégie d'ingestion

1. **Backfill** (une fois) : boucle sur `annee/2007` … `annee/<année courante>`, parsing en streaming,
   filtrage sur la liste d'ids de stations, insertion.
2. **Ingestion continue** (cron, toutes les 15–30 min) : appel filtré à l'API ODS, et pour chaque
   couple (station, carburant) insertion d'un point **si et seulement si** `(station_id, fuel, maj)`
   n'existe pas déjà.
3. **Rattrapage** (optionnel, hebdomadaire) : re-télécharger l'archive de l'année en cours pour
   combler les trous si le cron a été interrompu. L'idempotence de la clé `(station_id, fuel, maj)`
   rend l'opération sans risque.

Les deux sources partagent exactement les mêmes `id`, `maj` et `valeur` : la déduplication fonctionne
telle quelle entre backfill et flux, sans réconciliation particulière.

## Granularité de l'historique

Mesuré le 19/08/2026 sur les 9 stations du périmètre, années 2007 à 2026.

La granularité est **événementielle, pas périodique** : une ligne = un changement de prix,
horodaté à la seconde. Il n'y a donc pas de « pas de temps » fixe, mais en pratique la fréquence
est quasi quotidienne par carburant.

| Année | Stations | Points/an/station | Écart médian | Écart moyen | % d'écarts < 2 j |
|---|---|---|---|---|---|
| 2007 | 6 | 189 | 2,0 j | 3,3 j | 53 % |
| 2010 | 6 | 342 | 1,0 j | 2,4 j | 65 % |
| 2013 | 6 | 502 | 1,0 j | 2,2 j | 69 % |
| 2016 | 9 | 845 | 1,0 j | 1,5 j | 85 % |
| 2019 | 8 | 864 | 1,0 j | 1,5 j | 88 % |
| 2022 | 9 | 784 | 1,0 j | 1,7 j | 78 % |
| 2024 | 9 | 854 | 1,0 j | 1,7 j | 82 % |
| 2025 | 9 | 810 | 1,0 j | 1,8 j | 82 % |
| 2026 (au 19/08) | 9 | 532 | 1,0 j | 1,7 j | 80 % |

Détail par carburant sur 2025 :

| Carburant | Stations qui le vendent | Points/station/an | Écart médian | Plus longue période sans changement |
|---|---|---|---|---|
| Gazole | 9 | 221 | 1,0 j | 30 j |
| E10 | 8 | 226 | 1,0 j | 30 j |
| SP98 | 9 | 206 | 1,0 j | 30 j |
| E85 | 6 | 176 | 1,0 j | 135 j |
| SP95 | 3 | 130 | 1,0 j | 26 j |
| GPLc | 2 | 98 | 1,0 j | 84 j |

### Ce qu'il faut en retenir pour l'UI

- Environ **200 changements de prix par an et par carburant**, soit un changement tous les 1 à 2 jours.
  Largement suffisant pour des tendances 7 / 30 / 90 jours, et même pour un zoom sur une semaine.
- Les écarts maximums (30 j sur le gazole, 135 j sur l'E85) sont **réels, pas des trous de données** :
  le prix n'a simplement pas bougé. C'est exactement pourquoi la courbe doit être un escalier
  (`stepAfter`) et non une interpolation linéaire, qui inventerait des variations inexistantes.
- **La profondeur utile dépend du carburant** :
  | Carburant | Premier relevé | Lignes en base | Vraiment exploitable à partir de |
  |---|---|---|---|
  | Gazole | 2007 | 30 718 | 2007 |
  | SP95 | 2007 | 14 086 | 2007 (mais 3 stations seulement aujourd'hui) |
  | E10 | 2009 | 22 060 | 2010 |
  | SP98 | 2013 | 21 353 | 2013 |
  | E85 | 2010 | 8 648 | 2016 |
  | GPLc | 2007 | 1 224 | 2022 (2 stations) |
  → L'UI doit ne proposer que les carburants réellement distribués par la station sélectionnée,
  et ne pas laisser croire à un historique de 19 ans pour l'E85.
- Les premières années sont plus grossières (2007 : 1 changement tous les 2 jours, 6 stations
  seulement). La qualité devient homogène **à partir de 2016**.

## Volumétrie

**98 069 lignes** pour le backfill complet 2007→2026 sur les 9 stations
(entre 5 000 et 8 000 changements de prix par an depuis 2016), 5 relevés écartés comme
invraisemblables.
SQLite est très largement suffisant : une table `prices` indexée sur `(station_id, fuel, recorded_at)`
rend chaque requête de courbe instantanée.
