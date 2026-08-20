# Icône

La **goutte-niveau** : le carburant et la jauge dans une seule forme. La goutte est remplie au
tiers, comme la jauge de position de l'app — bas dans la fourchette 90 jours, c'est le moment d'y
aller. L'ambre est celui du pistolet gazole des pompes françaises, le même jeton `accent-bright`
que l'app.

## Non, iOS ne bascule pas entre une version claire et une version sombre

Vérifié le 20/08/2026, parce que c'est contre-intuitif :

- **Le manifeste n'a pas de sélecteur de thème pour les icônes.** Un `color_scheme` sur les
  `icons` est une [proposition ouverte chez le W3C](https://github.com/w3c/manifest/issues/975),
  pas une fonctionnalité livrée.
- **`apple-touch-icon` n'honore pas d'attribut `media`.** Le seul contournement connu est de
  remplacer le `<link>` en JavaScript au chargement — il ne joue qu'au moment de l'ajout à
  l'écran d'accueil, et iOS met l'icône en cache ensuite. Changer de thème après coup ne change
  rien. Le fil Apple sur le sujet est
  [resté sans réponse depuis décembre 2024](https://developer.apple.com/forums/thread/761615),
  celui de [septembre 2025](https://developer.apple.com/forums/thread/801448) aussi.
- **Les apparences Sombre / Teintée / Claire d'iOS 18+ existent bien, mais pas pour nous.** Une
  app native fournit trois variantes de son icône ; une web app n'a aucun moyen de les fournir,
  le système dérive les siennes tout seul et le rendu est souvent mauvais. Et c'est un réglage
  global de l'écran d'accueil, pas un suivi du thème.

**Conséquence pratique : ça n'a aucune importance.** Une icône d'app porte son propre fond
opaque — elle ne se pose pas sur une surface qui change. La goutte-niveau sombre est identique
que le téléphone soit en clair ou en sombre. Le choix clair/sombre est un choix de goût, fait une
fois, pas une adaptation.

**Le seul endroit où l'adaptation marche vraiment : l'onglet du navigateur.** Un favicon SVG est
chargé comme un document, donc sa media query s'applique et suit le réglage système en direct.
C'est ce que fait `public/favicon.svg`, et c'est pour ça qu'il est déclaré avant le PNG dans
`layout.tsx`.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `public/icon.svg` | **la source.** Version sombre, celle qui est installée |
| `public/icon-light.svg` | la version claire, prête à prendre sa place |
| `public/favicon.svg` | l'onglet du navigateur, seul à suivre le thème |
| `public/icon-192.png`, `icon-512.png` | manifeste |
| `public/apple-touch-icon.png` | écran d'accueil iOS — 180 px, **opaque obligatoire** |
| `src/app/favicon.ico` | repli des vieux navigateurs |

Safari 26 sait matricer lui-même un SVG déclaré dans le manifeste, à toutes les tailles dont il a
besoin ; `icon.svg` y est donc déclaré en premier, les PNG restant le repli.

## Regénérer

Après toute modification de `public/icon.svg` :

```sh
rsvg-convert -w 192 -h 192 public/icon.svg -o public/icon-192.png
rsvg-convert -w 512 -h 512 public/icon.svg -o public/icon-512.png
rsvg-convert -w 180 -h 180 public/icon.svg -o public/apple-touch-icon.png
rsvg-convert -w 64  -h 64  public/icon.svg -o /tmp/ico64.png
magick /tmp/ico64.png -define icon:auto-resize=64,32,16 src/app/favicon.ico
```

Pour passer à la version claire : recopier le contenu de `icon-light.svg` dans `icon.svg`, puis
rejouer les cinq commandes.

**Sur le téléphone, il faut retirer puis rajouter l'app à l'écran d'accueil.** iOS met l'ancienne
icône en cache et ne la rafraîchit jamais tout seul.

## Règles de dessin

- **Fond opaque**, toujours : iOS refuse la transparence pour l'écran d'accueil.
- **Tout dans le carré central.** iOS masque par une superellipse (~22,4 % de rayon) : les coins
  sont rognés.
- **Quatre traits au maximum.** L'icône se juge à 60 px, pas à 512. L'ancienne — une courbe en
  escalier à sept segments — s'y refermait en « W » et ne voulait plus rien dire. Toutes les
  propositions ont été rendues puis regardées à 60 px avant d'être retenues.
- Trois pistes écartées sur ce qu'elles donnaient à l'écran, pour ne pas les redessiner : le
  pistolet seul (une pièce d'échecs une fois simplifié), la jauge à aiguille (l'aiguille se lit
  comme un marteau) et la goutte pleine (le logo générique de n'importe quelle app d'huile).
