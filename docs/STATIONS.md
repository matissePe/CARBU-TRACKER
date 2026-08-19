# Stations suivies

Liste établie le 19/08/2026 à partir du flux instantané (`where=cp in ("56000","56860")`).
**9 stations dans le périmètre.**

Les données publiques **n'incluent ni le nom ni l'enseigne** des stations : la colonne « Enseigne »
est une correspondance manuelle, à compléter par Matisse. Elle sert uniquement à l'affichage.

## Périmètre (9 stations actives)

| id | CP | Commune | Adresse | Enseigne (à compléter) | Carburants observés |
|---|---|---|---|---|---|
| 56000003 | 56000 | Vannes | rue Jean Perrin | _à compléter_ | Gazole, SP95, E10, SP98 |
| 56000004 | 56000 | Vannes | ZC Parc Lann | _à compléter_ | Gazole, E10, SP98, E85, GPLc |
| 56000005 | 56000 | Vannes | 8 avenue de Suffren | _à compléter_ | Gazole, E10, SP98, E85 |
| 56000006 | 56000 | Vannes | 6 avenue Georges Pompidou | _à compléter_ | Gazole, E10, SP98 |
| 56000008 | 56000 | Vannes | 16 avenue de la Marne | _à compléter_ | Gazole, E10, SP98 |
| 56000009 | 56000 | Vannes | boulevard de la Paix | _à compléter_ | Gazole, E10, E85 |
| 56006001 | 56000 | Vannes | 101 avenue de la Marne | _à compléter_ | les 6 carburants |
| 56860003 | 56860 | Séné | route de Nantes | _à compléter_ | Gazole, E10, SP98, E85 |
| 56860004 | 56860 | Séné | 165 route de Nantes | _à compléter_ | Gazole, E10, E85 |

## Note sur la station 56000008

Le flux instantané la rattache à **Ploeren**, les archives annuelles à **VANNES**.
Tranché par Matisse le 19/08/2026 : elle est **à Vannes**, elle fait partie du périmètre.

C'est l'illustration la plus nette du piège n°3 : la commune renvoyée par la source est
peu fiable, seul l'id de station fait foi.

## Ids présents dans les archives mais sans aucun prix (stations fermées)

`56000001` (bd de la Paix), `56000002` (16 av. de la Marne), `56000010` (39 bd de la Paix),
`56000011` (16 av. de la Marne), `56860001` (165 route de Nantes).

Elles apparaissent avec un `<prix/>` vide. À ignorer à l'ingestion, mais leur existence explique
pourquoi le filtre « toutes les stations de la commune » renvoie plus de lignes que prévu.

## Règle

Cette liste d'ids est **la source de vérité du périmètre**, pas le champ `ville` ni le code postal
(cf. piège n°3 dans [DATA-SOURCE.md](DATA-SOURCE.md)). Elle doit vivre dans `src/config/stations.ts`.
Si une nouvelle station ouvre à Vannes ou Séné, elle est ajoutée ici manuellement.
