# Fichiers de marque, d'icônes et d'illustrations

Exportés le 2026-10-08 du fichier Figma `H7XVzqkkeUViNnecDdCrdG`, en lecture seule (le fichier n'a pas été modifié). Règles : DSN-040 (icônes, couleurs par jetons), DSN-076 (scènes illustrées), `Specs/07-design/01-systeme-de-design.md`.

## Marque

| Fichier | Source Figma | Remarque |
|---|---|---|
| `logo.svg` | `Logo` 381:22 (page Composants) | Médaillon 86 px |
| `logo-dark.svg` | Logo de `Brand` · Tone=Dark 385:307 | Même médaillon, 76 px (voir plus bas) |
| `logo.png` | Image source du médaillon | PNG 1 200 × 1 200, fond transparent |
| `wordmark.svg` | « Mot-symbole » de `Brand` · Light 385:296 | « DIASPORA PATRIMOINE », texte vectorisé, `#06177A` + `#B98A4E` |
| `wordmark-dark.svg` | « Mot-symbole » de `Brand` · Dark 385:304 | Blanc + `#E4C09A` |
| `brand.svg` | `Brand` · Tone=Light, Size=Default 385:298 | Logo + mot-symbole + devise |
| `brand-dark.svg` | `Brand` · Tone=Dark, Size=Default 385:306 | Pour fond bleu nuit |
| `brand-compact.svg` | `Brand` · Tone=Light, Size=Compact 534:967 | Logo + mot-symbole, sans devise |

- Les textes (mot-symbole et devise) sont **vectorisés** : aucune police n'est requise pour les afficher.
- Le mot-symbole est rogné au plus près des lettres (379 × 23) et non à la boîte de texte Figma (381 × 36).
- **Le logo est une image, pas un tracé** : dans Figma, le médaillon est un cercle rempli d'un PNG. Les SVG du logo et de `brand*` contiennent donc ce PNG encodé en base64 et pèsent environ 2 Mo chacun. Sur le web, mieux vaut utiliser `logo.png` réduit (ou converti en WebP/AVIF) et afficher le mot-symbole à côté.
- Il n'existe **pas de version sombre du médaillon** dans Figma : `logo-dark.svg` est le même médaillon, à la taille du pied de page (76 px).

## Icônes — `icons/` (73 fichiers)

Composants `Icon/…` de la page Fondations (cadre « Icônes et drapeaux » 377:131). Grille 24 × 24, trait 1,7 px à bouts ronds, deux tons. Noms anglais en kebab-case, tirés du nom Figma, sauf `Icon/Coffee` → `cafe-cup` et `Icon/Pin` → `map-pin`.

| Fichier | Nœud | Fichier | Nœud | Fichier | Nœud |
|---|---|---|---|---|---|
| `building` | 289:109 | `home` | 289:228 | `trash` | 377:68 |
| `coins` | 289:117 | `phone` | 289:231 | `edit` | 377:72 |
| `cafe-cup` | 289:123 | `clock` | 289:235 | `bell` | 377:76 |
| `bulb` | 289:129 | `globe` | 289:239 | `user` | 377:80 |
| `partners` | 289:137 | `map-pin` | 289:243 | `lock` | 377:84 |
| `diamond` | 289:142 | `mail` | 289:247 | `external-link` | 377:88 |
| `bank` | 289:147 | `heart` | 289:250 | `paperclip` | 377:91 |
| `crescent` | 289:151 | `close` | 377:4 | `send` | 377:95 |
| `chevron-right` | 289:154 | `chevron-down` | 377:7 | `star` | 377:98 |
| `arrow-right` | 289:157 | `chevron-up` | 377:10 | `spinner` | 377:102 |
| `key` | 289:162 | `chevron-left` | 377:13 | `copy` | 377:106 |
| `medal` | 289:167 | `arrow-left` | 377:16 | `logout` | 377:110 |
| `sparkles` | 289:171 | `plus` | 377:19 | `camera` | 377:114 |
| `sofa` | 289:177 | `minus` | 377:22 | `file` | 377:118 |
| `scale` | 289:181 | `menu` | 377:26 | `shield` | 377:122 |
| `tree` | 289:186 | `more` | 377:29 | `bed` | 377:126 |
| `search` | 289:191 | `eye` | 377:33 | `surface` | 377:130 |
| `sliders` | 289:196 | `eye-off` | 377:37 | `status-info` | 391:468 |
| `chat` | 289:200 | `info` | 377:42 | `status-success` | 391:474 |
| `badge` | 289:204 | `warning` | 377:47 | `status-warning` | 391:479 |
| `folder` | 289:210 | `error` | 377:52 | `status-error` | 391:485 |
| `calculator` | 289:215 | `success` | 377:56 | `speaker` | 531:30260 |
| `calendar` | 289:220 | `upload` | 377:60 | `mic` | 531:30268 |
| `check` | 289:223 | `download` | 377:64 | `pause` | 531:30275 |
| | | | | `play` | 531:30281 |

### Couleurs réglables

Dans Figma, chaque tracé est lié à une variable de la collection « Icônes ». À l'export, la couleur de chaque tracé a été remplacée **selon sa variable** (et non selon sa valeur) :

| Variable Figma | Dans le SVG | Réglage dans le code |
|---|---|---|
| `icone/trait` | `currentColor` | `color` du conteneur |
| `icone/accent` | `var(--icon-accent, currentColor)` | `--icon-accent` |
| `icone/or` (tasse, repère) | `var(--icon-gold, #C9A06A)` | `--icon-gold` |
| `icone/creux` (creux du repère) | `var(--icon-hollow, #FFFFFF)` | `--icon-hollow` |

Les quatre `status-*` gardent leur couleur fixe (DSN-040) : `#4F9BEA`, `#2F8F5B`, `#D48C1E`, `#D4574B`. Les modes de DSN-040 (Clair, Sombre, Champagne, Or foncé, Encre) se reproduisent en posant `color` et ces variables sur le conteneur, par exemple en mode Sombre : `color: var(--bo-texte-blanc); --icon-accent: var(--bo-texte-ciel);`.

Les SVG utilisent `var()` dans les attributs de présentation : ils marchent **intégrés au DOM** (inline, sprite `<use>`, composant SVGR). Chargés par `<img>` ou en image de fond CSS, ils ne reçoivent ni `currentColor` ni les variables du document.

`bulb.svg` : le rayon du haut dépasse la case de 0,05 px dans Figma (export brut en 24 × 25). La `viewBox` a été recadrée en `0 0.0498 24 24` pour garder la case de 24 × 24 sans déplacer le dessin.

## Illustrations — `illustrations/`

Variantes du composant `Illustration` 561:1088 (page Composants), 480 × 400, propriété `Scène` :

| Fichier | Nœud |
|---|---|
| `projection.svg` | 561:971 |
| `partenaire.svg` | 561:998 |
| `rappel.svg` | 561:1026 |
| `alerte.svg` | 561:1039 |
| `avis.svg` | 561:1054 |
| `attente.svg` | 561:1063 |
| `perdu.svg` | 561:1074 |

Couleurs laissées telles quelles (`#06177A`, `#C9A06A`, aplats `#EAF3FD`, `#F5E8D6`, `#EED3B2`, `#C9D3EE`).

## Ce qui manque, et pourquoi

- **États « début » et « fin » des scènes** : DSN-076 les annonce, mais le jeu `Illustration` n'a qu'une propriété `Scène`, sans état d'animation. Chaque fichier est l'unique état dessiné, c'est-à-dire la scène finie. L'animation (tracé des traits, décalages de 120 ms) reste à écrire en CSS sur ces SVG.
- **Icônes de la livraison 1 sans équivalent dans la bibliothèque** : `team`, `diagnostics` et `settings` n'existent pas dans Figma. `partners` et `sliders` peuvent remplacer `team` et `settings`, sinon il faut prendre l'icône dans Lucide, comme le prévoit la règle des fichiers de marque. `chevron` correspond à `chevron-right`, `-left`, `-up` et `-down`.
- **Drapeaux** (`Flag/France` 289:251, `Flag/Algeria` 289:255, 40 × 40) : non exportés, car ils ne faisaient pas partie de la demande.
- **Médaillon vectoriel** : il n'existe pas dans le fichier (voir « Marque »).
