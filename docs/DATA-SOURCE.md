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

## Volumétrie

~4 800 changements de prix en 2026 (jusqu'au 19/08) pour les stations de Vannes et Séné.
Sur 19 ans, l'ordre de grandeur est de quelques dizaines de milliers de lignes.
SQLite est très largement suffisant.
