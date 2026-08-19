# Source de données

> ⚠️ **À COMPLÉTER** — le lien exact est fourni par Matisse. Tant que ce fichier n'est pas rempli
> et vérifié contre une vraie réponse de l'API, ne pas écrire de parseur.

## Lien fourni

- URL : _(à remplir)_
- Type : _(API REST / export CSV / XML / flux ODS ?)_
- Licence : _(à vérifier — probablement Licence Ouverte / Etalab)_
- Authentification : _(a priori aucune)_

## Piste attendue

Les prix des carburants en France sont publiés en open data par le gouvernement
(jeux de données « Prix des carburants » : flux instantané, flux quotidien, et archives annuelles).
Deux natures de données à distinguer :

| Nature | Usage ici |
|---|---|
| **Instantané / quotidien** | ingestion régulière → construit notre historique au fil de l'eau |
| **Archives annuelles** | backfill unique → remplit le passé d'un coup |

## À vérifier avant de coder

- [ ] Nom exact des champs (id station, latitude/longitude — attention au facteur ×100000 sur certains flux)
- [ ] Comment filtrer par commune / code postal (Vannes 56000, Séné 56860) ou par code INSEE
- [ ] Nom exact des carburants (`Gazole`, `SP95`, `E10`, `SP98`, `E85`, `GPLc` ?) et leur identifiant numérique
- [ ] Unité des prix (euros décimaux ou millièmes d'euro ?)
- [ ] Fuseau et format des dates de relevé
- [ ] Pagination / limite de résultats par requête
- [ ] Fréquence de mise à jour réelle du flux (→ cadence de notre cron)
- [ ] Stations fermées ou saisonnières : comment sont-elles marquées ?

## Échantillon de réponse

```
(coller ici un extrait réel une fois l'URL testée)
```

## Stations attendues (à confirmer avec les données réelles)

Vannes et Séné comptent une poignée de stations : hypermarchés (Leclerc, Intermarché, Carrefour,
Super U) et réseaux classiques (Total, Avia, Esso…). Le nombre exact viendra de la source,
il ne doit pas être codé en dur.
