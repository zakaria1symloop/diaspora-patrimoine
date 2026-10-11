# Système de design « Bleu & Or »

Direction graphique retenue par Mme Mouhoubi le 1er octobre 2026 (D-003). Sa référence visuelle est la maquette d'accueil validée dans Figma (fichier `H7XVzqkkeUViNnecDdCrdG`). Ce fichier décrit les **règles** tirées de cette maquette, pour que tous les autres écrans — site public, espace client, back-office, application mobile — soient de la même famille sans réinventer un style.

Rappel : sur un **visuel**, la maquette validée fait foi ; sur un **comportement**, les specs font foi (README).

---

## 1. Principes

**DSN-001** `[P1]` **Trois registres, une seule palette.**

| Registre | Où | Caractère |
|---|---|---|
| **Vitrine** | Site public | Expressif : grands titres en italique, or, cartes à bandeau, photos. C'est la maquette validée. |
| **Accompagnement** | Espace client | Mêmes couleurs et mêmes composants, en plus calme : fonds clairs, peu d'or, l'information d'abord. |
| **Outil** | Back-office | Sobre et dense : fond gris clair, surfaces blanches, bleu pour les actions. L'or n'y sert qu'à la marque. |

**DSN-002** `[P1]` **Les jetons d'abord.** Aucune couleur, taille, marge, rayon ou ombre n'est écrite en dur dans le code : tout vient des jetons de ce fichier, portés par `packages/ui` et, dans Figma, par trois collections de variables — « Bleu & Or » (couleurs), « Mesures » (espaces, rayons, traits), « Icônes » (couleur des icônes selon le fond, DSN-040) — et par les styles de texte, d'ombre et de dégradé. Un besoin nouveau donne un jeton nouveau, pas une valeur isolée.

**DSN-003** `[P1]` **Un écran sans maquette validée** se construit avec les composants de ce fichier, sans style nouveau (README, § 5, règle 9).

## 2. Couleurs

**DSN-010** `[P1]` **Palette.** Noms des variables Figma ; dans le code : `--bo-{groupe}-{nom}`.

| Variable | Valeur | Emploi |
|---|---|---|
| `bo/fond/blanc` | `#FFFFFF` | Surfaces, cartes |
| `bo/fond/ivoire` | `#FBF8F3` | Fond de page de la vitrine |
| `bo/fond/creme` | `#FDF6EC` | Sections claires, départ des dégradés doux |
| `bo/fond/or-clair` | `#F5E8D6` | Aplats dorés légers |
| `bo/fond/champagne` | `#E4C09A` | Or de la marque |
| `bo/fond/champagne-clair` | `#EED3B2` | Survol d'un élément doré |
| `bo/fond/ciel-pale` | `#EAF3FD` | Sections bleutées, information |
| `bo/fond/ciel` | `#AAD1FC` | Accents clairs |
| `bo/fond/bleu-roi` | `#06177A` | Bandeau « très haut standing », action principale du back-office |
| `bo/fond/bleu-nuit` | `#01295B` | Bandeaux, cartes d'appel, pied de page |
| `bo/fond/bleu-profond` | `#001B40` | Fonds les plus sombres |
| `bo/fond/vert-algerie` | `#02512E` | Bandeau « habitat confortable », rappel du pays |
| `bo/fond/vert-profond` | `#03452D` | Survol du vert |
| `bo/fond/vert-pale` | `#E3F0E8` | Fond d'un message de succès |
| `bo/fond/gris` | `#F4F5F8` | Fond de page du back-office |
| `bo/fond/alerte-pale` | `#FBF0DC` | Fond d'un avertissement |
| `bo/fond/erreur-pale` | `#FBEAE8` | Fond d'un message d'erreur |
| `bo/fond/erreur` | `#B3372C` | Fond du bouton d'action destructive, compteur d'alerte |
| `bo/fond/erreur-fonce` | `#982F25` | Survol du bouton d'action destructive |
| `bo/texte/encre` | `#0C1C47` | Texte courant ; texte sur l'or |
| `bo/texte/roi` | `#06177A` | Titres, libellés de champs, liens |
| `bo/texte/nuit` | `#01295B` | Titres sur fond clair |
| `bo/texte/doux` | `#4A5580` | Texte secondaire |
| `bo/texte/discret` | `#667094` | Aides, textes d'exemple dans un champ |
| `bo/texte/or` | `#8F6326` | Petit texte doré (rapport de contraste 5,3) |
| `bo/texte/or-titre` | `#B98A4E` | Titres dorés de **24 px et plus seulement** (rapport 3,1) |
| `bo/texte/champagne` | `#E4C09A` | Texte doré sur fond sombre |
| `bo/texte/blanc` | `#FFFFFF` | Texte sur fond sombre |
| `bo/texte/ciel` | `#BFDBFA` | Texte secondaire sur fond sombre |
| `bo/texte/vert` | `#02512E` | Texte vert de marque |
| `bo/texte/succes` | `#1F6B43` | Texte d'un succès |
| `bo/texte/erreur` | `#B3372C` | Texte d'une erreur |
| `bo/accent/or` | `#C9A06A` | Filets et icônes dorés |
| `bo/accent/or-vif` | `#D48C1E` | Icône d'avertissement |
| `bo/accent/bleu` | `#4F9BEA` | Contour de focus, icône d'information |
| `bo/accent/vert` | `#2F8F5B` | Icône de succès |
| `bo/accent/corail` | `#D4574B` | Icône d'erreur, bordure d'un champ en erreur |
| `bo/ligne/douce` | `#E8E1D5` | Séparateurs sur fond ivoire |
| `bo/ligne/bleue` | `#C9D3EE` | Bordures de champs, séparateurs sur fond blanc |
| `bo/ligne/or` | `#E4C09A` | Bordure du bouton secondaire |
| `bo/drapeau/*` | — | Couleurs des drapeaux ; aucun autre usage |

**Dégradé doré** (`bo/degrade/or`) : linéaire, `#DDB487` → `#F0D8B8` → `#E0B98E`. C'est le fond du bouton principal de la vitrine, des étiquettes et des pastilles.
**Dégradé doux** (`bo/degrade/doux`) : `#FDF6EC` → `#EAF3FD`. Fond des grands blocs d'appel (formulaire de projection).
**Fonds de section** de la vitrine, de haut en bas : « ivoire-ciel » (`#FBF8F3` → `#EAF3FD` → `#FDF6EC`, section des motivations) ; « crème-or » (`#FDF6EC` → `#F5E8D6`, section du Café) ; « ciel-blanc » (`#CFE4FB` → `#EAF3FD` → `#FFFFFF`, section des services). Les autres sections sont sur fond blanc. Deux sections voisines n'ont jamais le même fond.

**DSN-011** `[P1]` **Contraste** (TRV-121). Texte courant : 4,5 au moins. Texte de 24 px et plus, icônes, bordures utiles : 3 au moins. Conséquences : `or-titre` est interdit sous 24 px ; un petit texte doré emploie `texte/or` ; un texte de succès ou d'erreur emploie `texte/succes` ou `texte/erreur`, jamais les accents, qui sont réservés aux icônes et aux bordures. Sur le dégradé doré, le texte est `texte/encre`.

**DSN-012** `[P1]` **Standing** (D-038) : bandeau `vert-algerie` pour `COMFORT`, `bleu-nuit` pour `STANDING`, `bleu-roi` pour `PREMIUM`. Le libellé du standing accompagne toujours la couleur.

**DSN-015** `[P1]` **Tons des pastilles d'état.** Sept tons ; chaque statut a le sien, et porte **toujours** son libellé (jamais la couleur seule).

| Ton | Fond · texte | Sens |
|---|---|---|
| Information | `ciel-pale` · `roi` | En cours, entre de bonnes mains. |
| Attente | `or-clair` · `or` | Quelqu'un doit agir. |
| Succès | `vert-pale` · `succes` | Acquis, disponible, fait. |
| Alerte | `alerte-pale` · `or` | À regarder : un délai, un écart. |
| Erreur | `erreur-pale` · `erreur` | Refusé, en échec, à refaire. |
| Neutre | `fond/gris` · `doux` | Passé, ou sans action attendue. |
| Inactif | blanc, bordure `ligne/bleue` · `discret` | Écarté, retiré, annulé. |

**Chaque valeur de chaque liste d'états a son ton** — la table ci-dessous est complète, et l'outil de vérification des specs contrôle qu'aucune valeur n'y manque ni n'y figure deux fois. Une énumération absente de cette table ne s'affiche pas en pastille.

| Énumération | Ton de chaque valeur |
|---|---|
| `LeadStatus` | `NEW` : Information · `IN_PROGRESS` : Attente · `CLOSED` : Neutre · `SPAM` : Inactif |
| `ClientStatus` | `PROSPECT` : Neutre · `QUALIFIED` : Information · `ACTIVE` : Attente · `CUSTOMER` : Succès · `INACTIVE` : Inactif · `ARCHIVED` : Inactif |
| `DossierStatus` | `OPEN` : Information · `ON_HOLD` : Alerte · `WON` : Succès · `LOST` : Neutre |
| `CandidateStatus` | `PROPOSED` : Information · `VIEWED` : Neutre · `INTERESTED` : Succès · `DECLINED` : Inactif · `VISIT_REQUESTED` : Attente · `VISIT_PLANNED` : Information · `VISITED` : Neutre · `SELECTED` : Succès · `UNAVAILABLE` : Alerte |
| `ReservationStatus` | `OPTION` : Attente · `RESERVED` : Succès · `COMPLETED` : Neutre · `CANCELLED` : Inactif · `EXPIRED` : Alerte |
| `DepositRefundStatus` | `NONE` : Inactif · `DUE` : Alerte · `REFUNDED` : Succès · `RETAINED` : Neutre |
| `AppointmentStatus` | `REQUESTED` : Attente · `CONFIRMED` : Information · `DONE` : Succès · `NO_SHOW` : Alerte · `CANCELLED` : Inactif |
| `LotStatus` | `AVAILABLE` : Succès · `OPTIONED` : Attente · `RESERVED` : Information · `SOLD` : Neutre · `WITHDRAWN` : Inactif |
| `Availability` | `AVAILABLE` : Succès · `RESERVED` : Information · `SOLD` : Neutre · `WITHDRAWN` : Inactif |
| `PublicationStatus` | `DRAFT` : Neutre · `PUBLISHED` : Succès · `ARCHIVED` : Inactif |
| `DeliveryStatus` | `ON_PLAN` : Neutre · `UNDER_CONSTRUCTION` : Information · `DELIVERED` : Succès |
| `ProcessingStatus` | `PENDING` : Attente · `READY` : Succès · `FAILED` : Erreur |
| `PartnerStatus` | `PROSPECT` : Attente · `ACTIVE` : Succès · `SUSPENDED` : Alerte · `ENDED` : Inactif |
| `DocumentStatus` | `PENDING` : Attente · `RECEIVED` : Information · `VALIDATED` : Succès · `REJECTED` : Erreur · `EXPIRED` : Alerte · `WAIVED` : Inactif |
| `VersionOutcome` | `SCANNING` : Attente · `IN_REVIEW` : Information · `VALIDATED` : Succès · `REJECTED` : Erreur · `REPLACED` : Neutre · `DISCARDED` : Alerte · `DELETED` : Inactif |
| `SubmissionStatus` | `DRAFT` : Neutre · `SUBMITTED` : Information · `UNDER_REVIEW` : Information · `INFO_REQUESTED` : Alerte · `APPROVED` : Succès · `REJECTED` : Erreur · `WITHDRAWN` : Inactif · `EXPIRED` : Alerte |
| `DeliveryState` | `QUEUED` : Neutre · `SENT` : Information · `DELIVERED` : Succès · `OPENED` : Succès · `CLICKED` : Succès · `BOUNCED` : Erreur · `COMPLAINED` : Erreur · `FAILED` : Erreur · `CANCELLED` : Inactif · `SUPPRESSED` : Alerte |
| `TaskStatus` | `OPEN` : Information · `DONE` : Succès · `CANCELLED` : Inactif |
| `Priority` | `LOW` : Inactif · `NORMAL` : Neutre · `HIGH` : Alerte · `URGENT` : Erreur |
| `ExecutionStatus` | `PENDING` : Attente · `DONE` : Succès · `SKIPPED` : Neutre · `FAILED` : Erreur |
| `JobStatus` | `PENDING` : Attente · `RUNNING` : Information · `DONE` : Succès · `FAILED` : Erreur |
| `UserStatus` | `INVITED` : Attente · `ACTIVE` : Succès · `SUSPENDED` : Alerte · `DELETED` : Inactif |
| `FeedbackStatus` | `NEW` : Information · `REVIEWED` : Attente · `ACTIONED` : Succès · `DISMISSED` : Inactif |
| `DataRequestStatus` | `RECEIVED` : Information · `IN_PROGRESS` : Attente · `DONE` : Succès · `REJECTED` : Neutre |
| `PartnerAnswerStatus` | `INTERNAL` : Neutre · `PENDING` : Attente · `APPLIED` : Succès · `DISMISSED` : Inactif · `SUPERSEDED` : Neutre |
| `EventStatus` | `DRAFT` : Neutre · `PUBLISHED` : Succès · `CLOSED` : Attente · `DONE` : Neutre · `CANCELLED` : Erreur |
| `RegistrationStatus` | `REGISTERED` : Succès · `WAITLISTED` : Attente · `CANCELLED` : Inactif · `ATTENDED` : Information · `NO_SHOW` : Alerte |
| `EligibilityStatus` | `ELIGIBLE` : Succès · `CONDITIONAL` : Alerte · `NOT_ELIGIBLE` : Neutre |

États **calculés**, qui ne sont pas une valeur d'énumération : « en retard » (échéance dépassée) : Alerte · « à vérifier » (`needsReview`) : Alerte · « sans e-mail », « téléphone à vérifier », « traitement limité », « hors ligne » : Alerte · « à confirmer par le promoteur » (CYC-107), « à vérifier avec le promoteur », « à vérifier avec la banque » (AUT-079) : Alerte · le niveau d'accès d'un partenaire n'est pas un état : il s'écrit en texte, sans pastille · une tâche ouverte en retard prend le ton Alerte à la place d'Information · état commercial d'un programme (CYC-127) : « En vente » Succès, « Tout est réservé » Information, « À venir » et « Vendu » Neutre, « Retiré » Inactif. Un résultat d'éligibilité n'emploie jamais le ton Erreur : la plateforme ne « refuse » personne (CAL-102).

## 3. Typographie

**DSN-020** `[P1]` **Trois polices**, libres de droits, servies par la plateforme elle-même (pas par un service tiers) :
- **Playfair Display**, gras italique : les titres de la vitrine. Jamais pour un texte courant, jamais dans un tableau.
- **Red Hat Display** (400, 500, 600, 700) : tout le reste — interface, textes, chiffres.
- **Cinzel**, gras : le mot-symbole « DIASPORA PATRIMOINE », et rien d'autre.

Fichiers : WOFF2 pris sur Google Fonts (licence OFL), sous-ensembles latin et latin étendu, rangés dans `packages/ui/fonts/` avec leur licence ; `font-display: swap`.

**DSN-021** `[P1]` **Échelle de la vitrine et de l'espace client.** Taille / interligne, en pixels ; la colonne « Téléphone » vaut sous 768 px.

| Jeton | Police, graisse | Ordinateur | Téléphone | Emploi |
|---|---|---|---|---|
| `display.accent` | Playfair, gras italique | 72 / 78 | 44 / 50 | Ligne dorée du héros |
| `display.lead` | Playfair, gras italique | 64 / 72 | 40 / 46 | Seconde ligne d'un titre de section |
| `title.section` | Playfair, gras italique | 40 / 50 | 28 / 36 | Première ligne d'un titre de section ; titre d'une page |
| `title.block` | Playfair, gras italique | 34 / 42 | 26 / 32 | Titre d'un bloc d'appel, d'une fenêtre |
| `title.card` | Playfair, gras italique | 28 / 34 | 22 / 28 | Titre d'une carte d'appel |
| `number.index` | Playfair, gras italique | 26 / 30 | 22 / 26 | Numéros « 01 » à « 07 » |
| `subtitle.l` | Red Hat, 600 | 23 / 31 | 18 / 26 | Sous-titre d'une section, ligne 1 |
| `subtitle.m` | Red Hat, 600 | 20 / 28 | 17 / 24 | Sous-titre, ligne 2 ; phrases d'appel |
| `heading.card` | Red Hat, 600 | 18 / 24 | 17 / 24 | Titre d'une carte, d'un service |
| `heading.item` | Red Hat, 600 | 16 / 22 | 16 / 22 | Titre d'un bien dans une carte |
| `overline.l` | Red Hat, 600, capitales, +0,6 px | 20 / 26 | 17 / 22 | « SÉCURITÉ », « À ALGER » |
| `body.xl` | Red Hat, 500 | 16 / 24 | 16 / 24 | Texte courant de l'espace client (TRV-124) |
| `body.l` | Red Hat, 500 | 15 / 22 | 15 / 22 | Texte courant |
| `body.m` | Red Hat, 500 | 14 / 21 | 14 / 21 | Texte de carte |
| `body.s` | Red Hat, 500 | 13 / 18 | 13 / 18 | Menu, mentions, texte des petites cartes |
| `body.l.strong`, `body.m.strong`, `body.s.strong` | Red Hat, 600 | comme `body.l`, `body.m`, `body.s` | idem | Le même texte, appuyé : valeur choisie, libellé de champ, étiquette, lien seul |
| `caption` | Red Hat, 500 | 12 / 16 | 12 / 16 | Libellés d'une valeur (« Prix du bien »), notes — jamais sous 12 px sur le site (TRV-124) |
| `overline.s` | Red Hat, 700, capitales, +1,6 px | 12 / 16 | 12 / 16 | Standing, surtitres |
| `button.l` | Red Hat, 600 | 16 / 22 | 16 / 22 | Bouton grand |
| `button.m` | Red Hat, 600 | 15 / 22 | 15 / 22 | Bouton moyen |
| `button.s` | Red Hat, 600 | 14 / 20 | 14 / 20 | Bouton petit, pastille de filtre |
| `price.card` | Red Hat, 700 | 18 / 22 | 17 / 21 | Prix, apport |
| `price.hero` | Red Hat, 600 ; « / mois » en Playfair, 400 (`price.unit`) | 36 / 44 ; 31 / 44 | 30 / 38 ; 26 / 38 | Mensualité |
| `date.day` | Red Hat, 600 | 46 / 50 | 38 / 42 | Jour d'un Café |
| `wordmark` | Cinzel, 700, +0,5 px | 30 / 36 | 20 / 26 | Mot-symbole |
| `wordmark.s` | Cinzel, 700, +0,5 px | 20 / 26 | 20 / 26 | Mot-symbole réduit (carte du Café, en-tête compact) |
| `tagline` | Red Hat, 500, capitales, +2 px | 12 / 16 | 12 / 16 | Devise sous le mot-symbole |
| `cafemark.l`, `cafemark.m`, `cafemark.s` | Red Hat, 700, capitales, +1 px (+0,6 pour `s`) | 27 / 32 ; 20 / 26 ; 15 / 18 | 22 / 26 ; 18 / 24 ; 15 / 18 | Le mot « LE CAFÉ » : carte du héros, sceau sur photo, menu |

**DSN-022** `[P1]` **Titre en deux lignes** — la signature de la vitrine : une première ligne en `title.section`, couleur `texte/roi` ; une seconde en `display.lead`, couleur `texte/or-titre`, soulignée du trait doré au pinceau. Les deux forment un seul titre (ACC-003). Un titre court tient sur la seconde ligne seule. Dessous, l'accroche tient elle aussi en deux lignes : `subtitle.l` en `texte/roi`, puis `subtitle.m` en `texte/or`.

**DSN-023** `[P1]` **Échelle du back-office** — Red Hat Display seul :

| Jeton | Graisse | Taille / interligne | Emploi |
|---|---|---|---|
| `admin.title` | 600 | 24 / 32 | Titre de page |
| `admin.h2` | 600 | 18 / 26 | Titre de section, de fenêtre |
| `admin.h3` | 600 | 15 / 22 | Titre de bloc |
| `admin.body` | 400 | 14 / 20 | Texte, cellules |
| `admin.strong` | 600 | 14 / 20 | Valeurs importantes |
| `admin.small` | 400 | 13 / 18 | Texte secondaire |
| `admin.caption` | 500 | 12 / 16 | Libellés, en-têtes de colonnes, pastilles |
| `admin.kpi` | 600 | 32 / 40 | Chiffre d'un indicateur |

**DSN-024** `[P1]` **Règles.** Aucun texte sous 12 px. Les chiffres d'un tableau sont à chasse fixe et alignés à droite. Une ligne de texte courant ne dépasse pas 75 caractères. Les capitales viennent du style, jamais du texte source (TRV-012). L'italique de Playfair ne sert qu'aux titres.

## 4. Espaces, grille, rayons, ombres

**DSN-030** `[P1]` **Pas d'espacement** : 4 · 6 · 8 · 10 · 12 · 16 · 20 · 24 · 32 · 48 · 64 · 96. Une section de la vitrine a 88 px de marge haute et 96 de marge basse sur ordinateur, 48 et 56 sur téléphone.

**DSN-031** `[P1]` **Grille.** Ordinateur : cadre de 1 440 px, marges de 48, contenu de **1 344 px** au plus, centré ; trois colonnes de 428 px séparées de 30. Téléphone : cadre de 390 px, marges de 20, une colonne. Entre les deux, le contenu se resserre de façon fluide (TRV-130).

**DSN-032** `[P1]` **Rayons.**

| Jeton | Valeur | Emploi |
|---|---|---|
| `radius.s` | 4 | Petites pastilles carrées, cases à cocher |
| `radius.m` | 12 | Champs, petits blocs |
| `radius.l` | 22 | Cartes |
| `radius.xl` | 30 | Grands blocs d'appel, fenêtres |
| `radius.pill` | 999 | Boutons, étiquettes, barre de recherche |

Back-office : `radius.s` pour les pastilles, 8 pour les champs et les boutons, 12 pour les cartes et les fenêtres.

**DSN-033** `[P1]` **Traits.** Cerne blanc de 3 px autour des cartes à photo de la vitrine. Bordure de 1,5 px pour le bouton secondaire et les champs. Séparateurs de 1 px.

**DSN-034** `[P1]` **Ombres**, teintées de bleu nuit (`#01295B`) :

| Jeton | Décalage · flou · opacité | Emploi |
|---|---|---|
| `shadow.s` | 0, 6 · 12 · 18 % | Étiquettes et pastilles posées sur une photo, bouton-icône |
| `shadow.m` | 0, 8 · 16 · 14 % | Bouton principal de la vitrine, champs flottants, petits blocs |
| `shadow.l` | 0, 16 · 36 · 15 % | Cartes, barre de recherche |
| `shadow.xl` | 0, 24 · 60 · 26 % | Fenêtres, menus ouverts, messages brefs, carte de l'appel final |

Back-office : `shadow.m` pour les menus et les fenêtres ; les cartes n'ont qu'une bordure.

## 5. Icônes et images

**DSN-040** `[P1]` **Icônes** : tracées sur une grille de 24 px, trait de 1,7 px à bouts ronds, en **deux tons** (un trait principal, un détail d'accent), tirées de la bibliothèque du fichier Figma. Tailles : 16, 20, 24, 32. Dans la vitrine, une icône de carte est posée sur une **pastille ronde** de 34, 44 ou 60 px (blanche, ciel ou or clair) ; une puce de liste est une coche de 14 px sur une pastille de 22 px. Une icône seule a toujours un nom accessible ; une icône décorative n'en a pas.

La **couleur d'une icône ne se règle pas icône par icône** : elle suit le fond sur lequel elle est posée, par quatre jetons — `icone/trait`, `icone/accent`, `icone/creux`, `icone/or` — qui prennent cinq jeux de valeurs :

| Mode | Trait · accent | Emploi |
|---|---|---|
| Clair (par défaut) | `texte/roi` · `accent/bleu` | Sur fond clair |
| Sombre | `texte/blanc` · `texte/ciel` | Sur fond bleu nuit ou bleu roi : pied de page, bouton de l'espace client et du back-office, pastille sélectionnée |
| Champagne | `texte/champagne` | Sur fond sombre, en doré : coordonnées du pied de page, carte d'appel |
| Or foncé | `texte/or` | Sur fond or clair : puces à coche, étiquette douce |
| Encre | `texte/encre` | Sur le dégradé doré : chevron du bouton principal |

La **tasse** du Café et le **repère** de lieu sont dorés par nature (`icone/or`) : `accent/or` sur fond clair, champagne sur fond sombre. Les quatre **icônes d'état** ont une couleur fixe : information `accent/bleu`, succès `accent/vert`, avertissement `accent/or-vif`, erreur `accent/corail`. Dans le code, ces jetons sont des variables de style posées sur le conteneur.

**Fichiers de marque et d'icônes.** Le logo (`Design/assets/logo.svg`, `Design/assets/logo-dark.svg`), le mot-symbole (`Design/assets/wordmark.svg`) et les icônes (`Design/assets/icons/{nom}.svg`, noms anglais) sont exportés du fichier Figma par la conception : c'est un livrable du Lot 0 (`08-tracabilite/02`, § 6). La livraison 1 a besoin au moins de : `team`, `diagnostics`, `settings`, `user`, `logout`, `info`, `success`, `warning`, `error`, `chevron`, `menu`, `close`, `search`. Tant qu'un fichier manque, rien n'attend (DSN-003) : `Logo` et `Brand` affichent le mot-symbole « DIASPORA PATRIMOINE » en Cinzel (DSN-020), et une icône manquante est prise dans un jeu libre au même tracé (Lucide, licence ISC), en un seul ton `icone/trait`.

**DSN-041** `[P1]` **Photos.** Les images sont fournies au rapport 4:3 (cartes) et 16:9 (héros, galeries) ; chaque emplacement en montre la partie centrale, sans la déformer. Dans la carte de bien de 428 px, la fenêtre de la photo fait 168 px de haut ; dans la carte d'une motivation, 164 px. Coins arrondis, cerne blanc dans les cartes de la vitrine. Pas de filtre de couleur. Une image d'illustration le dit (FIC-012). Sans image : la composition de FIC-022, jamais un gris vide.

**DSN-042** `[P1]` **Drapeaux** : petits, ronds, à côté d'un nom de pays ; jamais comme seul repère.

## 6. Composants

**DSN-050** `[P1]` Noms des composants en **anglais** dans Figma et dans le code. Chaque composant a ses états : repos, survol, appui, **focus** (contour de 3 px `accent/bleu`, décalé de 2 px, toujours visible au clavier), inactif (opacité 40 %, sans ombre), et, pour ceux qui déclenchent une action, **en cours** (indicateur, non cliquable, TRV-090).

| Composant | Variantes | Règles |
|---|---|---|
| `Button` | `Type` — **Primary** (primaire de la vitrine) : dégradé doré, texte `encre`, chevron à droite, `shadow.m`. **Secondary** : fond blanc, bordure `ligne/or` 1,5 px, texte `roi`, chevron. **Tool** (primaire de l'espace client hors appels, et du back-office) : fond `bleu-roi`, texte blanc. **Tertiary** : texte `roi`, sans fond. **Danger** : fond `fond/erreur`, texte blanc. `Size` — L 52 px (`button.l`), M 46 px (`button.m`), S 36 px (`button.s`). `State` — repos, inactif. Options : icône à gauche, chevron, envoi en cours, focus. | Un seul bouton primaire par écran ou par bloc. Libellé : TRV-011. Zone tactile de 44 px au moins. Le bouton S ne porte pas de chevron. Dans une rangée de champs (barre de recherche, formulaire en ligne), le bouton prend la hauteur des champs : 50 px. Survol et appui : DSN-051. |
| `Chip` | Pastille cliquable. `Size` L 44 px, M 36 px. `State` repos (fond `ciel-pale`, texte `roi`), sélectionnée (fond `bleu-roi`, texte blanc). Options : icône, croix pour retirer. | Le bouton « Filtres » ; un critère actif ; un choix dans une liste de critères (CAT-030 à CAT-036). |
| `Link` | **Inline**, dans un texte : souligné. **Standalone**, seul : `body.l.strong`, suivi d'un chevron. Tons : bleu (`roi`), doré (`texte/or`, lien de l'assistant). | Un lien mène ailleurs ; un bouton agit. |
| `IconButton` | Rond, 44 ou 36 px. **Ghost** : sans fond. **Surface** : blanc, `shadow.s`, posé sur une photo. | Toujours un nom accessible. |
| `TextField` | `State` — vide, rempli, focus, erreur, inactif. `Shape` — **Field** (`radius.m`, formulaires) ; **Pill** (en pilule, dans les bandeaux d'appel de la vitrine : formulaire de projection). Options : icône, suffixe (devise, « / mois »), icône à droite, aide, « (facultatif) ». | Libellé au-dessus (`body.s.strong`, `roi`). Champ de 50 px, bordure `ligne/bleue` 1,5 px, texte `body.l`. Focus : bordure `roi` et contour. Erreur : bordure `corail`, message `texte/erreur` dessous (TRV-061). Aide en `discret`. « (facultatif) » dans le libellé (TRV-062). |
| `Select`, `Menu`, `MenuItem`, `Combobox` | Le champ fermé, ouvert ; la liste (`radius.m`, `shadow.xl`), ses lignes de 44 px (repos, survol, choisie avec sa coche), compteur facultatif (CAT-021). | La liste s'ouvre sous le champ ; navigation au clavier. `Menu` sert aussi au menu « Mon espace » (NAV-013). |
| `PhoneField` | Sélecteur de pays (drapeau et indicatif) + numéro. | TRV-040. |
| `AmountField` | Avec devise fixe ou choisie. | TRV-026. |
| `DateField`, `SlotPicker` | Date ; date et moment de la journée. | Saisie au clavier possible. |
| `Textarea` | Avec compteur (TRV-063). | |
| `Checkbox`, `Radio`, `Switch` | | Libellé cliquable. Consentement jamais coché d'avance (TRV-143). |
| `RangeSlider` | Une ou deux poignées, doublées de champs. | CAT-036. |
| `FileDropzone` | Zone de dépôt, liste des fichiers avec progression. | DOS-010 à DOS-012. |
| `Tag` | **Gold** : étiquette dorée (dégradé, `shadow.s`), sur une photo. **White** : surtitre en capitales (`overline.s`, texte `or`) sur fond blanc. **Soft** : information douce, fond `or-clair`, avec icône. | Une étiquette au plus par photo (CAT-041). |
| `StatusTag` | Pastille d'état, sept tons (DSN-015). | Toujours avec son libellé. En pilule dans l'espace client ; rayon de 4 px dans le back-office. |
| `IconBadge`, `CafeMark`, `GoldRule`, `Logo`, `Brand` | La pastille d'icône (22, 34, 44, 60 px ; blanche, ciel, or clair) ; le mot « LE CAFÉ » et sa tasse ; le trait doré (au pinceau, en filet) ; le logo ; le logo avec le mot-symbole et la devise, sur fond clair ou sombre. | Éléments de marque : on les reprend tels quels. |
| `SectionTitle` | Les deux lignes du titre, le trait doré, l'accroche en deux lignes. | DSN-022. |
| `PropertyCard` | `Standing` — Comfort, Standing, Premium (bandeau vert, bleu nuit, bleu roi : DSN-012). Variantes à venir avec leurs écrans : catalogue, compacte (listes de l'espace client), voilée (réservé, vendu), sans mensualité (CAT-042). | CAT-040 à CAT-045. Bandeau, photo, panneau blanc qui recouvre le bas de la photo de 14 px. |
| `FeatureCard` | `Kind` — **Photo** (bandeau avec pastille d'icône, titre et numéro ; photo ; texte) ; **List** (bandeau ; titre ; texte ; trois points à coche). `Tone` du bandeau — bleu nuit, bleu roi, or. | Financement (ACC-080) ; les motivations ont quitté la carte pour la vitrine animée (ACC-045, D-101). Dans une rangée, les cartes prennent la hauteur de la plus haute. |
| `ServiceCard` | Médaillon d'icône (ciel, ou or pour Le Café), numéro, titre, texte. | ACC-070. |
| `EventCard` | Bloc de date (jour de semaine, numéro, mois) + lieu + ligne d'information + état + jauge + bouton. **Next** : le prochain Café (date bleu nuit, bouton doré) ; **Later** : les suivants (date bleu roi, bouton secondaire). | ACC-061. |
| `CallCard` | Fond `bleu-nuit`, titre Playfair blanc, texte `ciel`, bouton doré pleine largeur. | « Parlons de votre projet » (ACC-071). |
| `ComparisonCard`, `ComparisonBlock` | Une colonne du comparatif (Algérie, France) ; les deux colonnes et la pastille d'écart. | ACC-040 à ACC-042. |
| `SearchField`, `SearchBar` | Un champ (libellé, valeur, icône) ; le conteneur en pilule : trois champs séparés par un filet, la pastille « Filtres », le bouton « Rechercher ». | ACC-052. Empilée sur téléphone. |
| `NavItem`, `Header`, `Footer` | L'entrée de menu (icône de 32 px, libellé ; « LE CAFÉ » en doré ; page courante soulignée) ; l'en-tête et le pied de page de la vitrine. À venir avec leurs écrans : en-tête compact, visiteur connecté, téléphone ; espace client ; back-office. | NAV-010 à NAV-021. |
| `Breadcrumb`, `Tab`, `PageButton`, `Pagination` | Fil d'Ariane à quatre niveaux ; onglet (repos, actif) ; numéro de page (repos, en cours, inactif) et la pagination complète. | NAV-039, CAT-055. |
| `Modal` | Centrée (ordinateur) · plein écran (téléphone). | TRV-121. Largeurs : 480, 720, 800. `radius.xl`, `shadow.xl`, voile `bleu-profond` à 55 %. Les filtres du catalogue ne sont plus une fenêtre sur ordinateur : un panneau à droite, sans voile (CAT-030, D-098) ; ils restent une fenêtre plein écran sur téléphone. |
| `Toast` | Succès · information · erreur ; avec « Annuler » ou « Réessayer ». | TRV-081. En bas ; durée : TRV-081, TRV-124 ; l'erreur reste jusqu'à ce qu'on la ferme (TRV-114). Surface blanche, `shadow.xl`, icône d'état. |
| `Banner` | Information · succès · alerte · erreur. | Icône d'état, texte, titre et action facultatifs, croix facultative. Fonds : `ciel-pale`, `vert-pale`, `alerte-pale`, `erreur-pale`. |
| `EmptyState` | Illustration légère, phrase, bouton. | TRV-080. |
| `Skeleton` | Formes du contenu attendu. | Après 300 ms. |
| `Stepper` | Six étapes (client), sept (back-office) ; horizontal, vertical sur téléphone. | ECL-020. Faite : coche ; en cours : pleine ; à venir : estompée. |
| `ProgressBar` | Avec pourcentage. | Complétude (ECL-023, CTL-043). |
| `Avatar` | Photo, ou initiales sur fond `ciel-pale`. | TRV-145. |
| `Badge` | Compteur ; point. | « 99+ ». |
| `DataTable` | En-tête collant, tri, sélection, cellule tronquée. | BO-035. Lignes de 44 px. |
| `KanbanColumn`, `KanbanCard` | | PIP-001, PIP-002. |
| `TimelineItem` | Par type d'entrée. | BO-050. |
| `DocumentViewer`, `PanoViewer`, `Gallery` | | GED-041, FIC-014 à FIC-017. |
| `Tooltip`, `Popover`, `Menu` | | Texte complet d'une cellule tronquée (TRV-070). |
| `StatTile`, `Chart` | Tuile d'indicateur ; courbe, barres, entonnoir. | TDB-012, TDB-052. |
| `FilterBar`, `FilterChip` | La rangée de filtres d'une liste du back-office ; un filtre en pastille à liste (repos, ouvert, actif avec sa valeur). | DSN-054. |
| `SearchSuggest` | La liste de suggestions sous un champ de recherche : groupes, lignes (repos, survol, choisie), recherches récentes, aucun résultat. | TRV-109. |
| `ErrorSummary` | L'encart des points à corriger en tête d'un formulaire. | TRV-114. |
| `HelpTip`, `GuideTip` | Le « ? » et sa bulle ; la bulle de la visite guidée (titre, texte, « {n} sur 3 », « Suivant » · « Passer »). | TRV-126, DSN-055. |
| `TextSizeControl` | Le bouton « Aa » et ses trois niveaux, avec un aperçu. | TRV-123. |
| `Celebration` | Le médaillon de réussite : coche qui se dessine, anneau doré, points dorés. | DSN-073. |
| `Illustration` | Scènes dessinées au trait des pages à une seule tâche : Projection · Partenaire · Rappel · Alerte · Avis · Attente · Perdu ; chacune en état « début » et « fin » d'animation. | DSN-076. |

**DSN-051** `[P1]` **Survol et appui des boutons.** Le focus et l'état inactif sont ceux de DSN-050.

| Bouton | Repos | Survol | Appui |
|---|---|---|---|
| Primary | Dégradé doré, `shadow.m` | Fond `champagne-clair` uni, `shadow.m` | Fond `champagne`, sans ombre |
| Secondary | Fond blanc, bordure `ligne/or` | Fond `creme` | Fond `or-clair` |
| Tool | Fond `bleu-roi` | Fond `bleu-nuit` | Fond `bleu-profond` |
| Tertiary | Texte `roi` | Texte souligné | Texte souligné, `texte/nuit` |
| Danger | Fond `fond/erreur` | Fond `fond/erreur-fonce` | Fond `fond/erreur-fonce`, sans ombre |
| Chip | Fond `ciel-pale` | Fond `ciel` | Fond `bleu-roi`, texte blanc |

Une carte cliquable se soulève de 2 px (DSN-070) ; un lien se souligne.

**DSN-053** `[P1]` **`DataTable` : un tableau vivant** (BO-035, D-087).
- **En-tête collant** au défilement vertical ; première colonne (référence ou nom) collante au défilement horizontal, avec une ombre fine quand le reste passe dessous.
- **Tri** : en-tête cliquable, flèche du sens actif, `aria-sort` ; second clic : sens inverse ; troisième : tri par défaut.
- **Ligne** : survol en `ciel-pale` ; clic : la fiche ; les actions rapides d'une ligne (« ⋯ ») sont aussi au clavier et au toucher, jamais au seul survol.
- **Clavier** : flèches haut et bas d'une ligne à l'autre, `Entrée` ouvre, `Espace` sélectionne, `Échap` vide la sélection.
- **Sélection** : la barre d'actions groupées monte du bas (DSN-072), avec « {n} sélectionnés » et « Tout désélectionner ».
- **Pied** : « {début}–{fin} sur {total} » (`common.list.range`), « Lignes par page » 25 · 50 · 100 (`common.list.pageSize`), pagination numérotée (`Pagination`) avec Précédent et Suivant ; le pied reste collé en bas de l'écran quand le tableau est plus haut que lui.
- **Mémoire** : TRV-105. **Rechargement** : TRV-080. **Nouveautés** : TRV-107.
- **Téléphone** (espace client) : le tableau devient une liste de cartes (DSN-080), mêmes tri et pagination.

**DSN-054** `[P1]` **`FilterBar` : filtrer sans attendre** (back-office, D-087). Au-dessus du tableau : le champ de recherche de la liste, puis une pastille par filtre (« Étape », « Conseiller », « Créé le »…). Une pastille s'ouvre en liste : cases à cocher avec leur compteur, champ de recherche dans la liste au-delà de huit valeurs, ou dates (« Aujourd'hui », « 7 derniers jours », « Ce mois-ci », « Entre… »). **Chaque choix s'applique tout de suite**, 300 ms après le dernier clic, sans bouton « Appliquer » ; la pastille active montre sa valeur (« Étape : Pièces, Banque ») et sa croix. « Plus de filtres » ouvre les filtres rares dans la même forme. « Tout effacer » au bout de la rangée dès qu'un filtre est actif. Sur le site, les filtres du catalogue restent une fenêtre centrée à brouillon et compteur vivant (CAT-030 à CAT-032) : un visiteur compose plusieurs critères avant de voir le résultat.

**DSN-055** `[P1]` **`HelpTip` et `GuideTip`.** Le « ? » : rond de 20 px (cible de 44 px, 48 sur téléphone), `accent/bleu` sur fond `ciel-pale`, nom accessible « Qu'est-ce que {terme} ? ». La bulle : 320 px au plus, `radius.m`, `shadow.xl`, titre en `body.m.strong`, texte en `body.m`, flèche vers le « ? ». La bulle de visite (TRV-126) : même surface, `button.s` « Suivant » (« Terminer » à la dernière) et lien « Passer », pastille « {n} sur 3 » ; l'élément présenté est entouré d'un halo `accent/bleu` de 4 px ; le reste de l'écran n'est pas assombri.

**DSN-056** `[P1]` **`ErrorSummary` et messages d'erreur.** L'encart : `Banner` d'erreur, titre « {n} points sont à corriger avant d'envoyer », liste à puces de liens (le libellé du champ, puis le message) ; il reçoit le focus (`tabindex="-1"`, `role="alert"`). Un message sous un champ : icône d'erreur de 16 px, texte `body.s` en `texte/erreur`, 6 px sous le champ. Un message de réussite sous un champ (code accepté, adresse vérifiée) : même forme en `texte/succes`.

**DSN-052** `[P1]` **État de la bibliothèque Figma.** Sont construits, avec leurs variantes, leurs propriétés et leurs liens aux jetons : tous les composants de DSN-050 nommés ci-dessus de `Button` à `Banner`, sauf ceux de la liste suivante. `Illustration` (DSN-076) et `ErrorSummary` (DSN-056) sont construits. Se construisent **avec leur premier écran**, pour être validés dans leur contexte : `Modal`, `PhoneField`, `AmountField`, `DateField`, `SlotPicker`, `RangeSlider`, `FileDropzone`, `EmptyState`, `Skeleton`, `Stepper`, `DataTable`, `KanbanColumn`, `KanbanCard`, `TimelineItem`, `DocumentViewer`, `PanoViewer`, `Gallery`, `Tooltip`, `Popover`, `StatTile`, `Chart`, `FilterBar`, `FilterChip`, `SearchSuggest`, `ErrorSummary`, `HelpTip`, `GuideTip`, `TextSizeControl`, `Celebration`, l'en-tête et le menu de l'espace client, le menu latéral et la barre du haut du back-office. Ces éléments sont dessinés en place, dans leurs écrans ; chacun devient un composant de la bibliothèque à la validation de l'écran qui le porte. Le registre « Outil » du back-office (rayons de 8 et de 4 px, lignes de 44 px) se dérive des mêmes composants par un mode de variables, à la livraison 1.

## 7. Mouvement

**DSN-070** `[P1]` Transitions courtes : 150 ms pour un survol ou un focus, 250 ms pour une ouverture (fenêtre, menu, dépliage). Une carte se soulève de 2 px au survol. Pas de défilement à effet de profondeur, pas d'animation en boucle — sauf un indicateur d'attente (squelette, indicateur d'envoi), qui s'arrête dès que le contenu arrive. Tout mouvement s'efface quand l'utilisateur a demandé à réduire les animations (TRV-121, DSN-074). Durées, courbes et catalogue : DSN-071 à DSN-075.

**DSN-071** `[P1]` **Jetons de mouvement** (D-087), dans `packages/ui` à côté des autres jetons, exposés en variables de style (`--motion-base`, `--ease-out`…).

| Jeton | Valeur | Emploi |
|---|---|---|
| `motion.instant` | 100 ms | Appui, coche, changement de couleur |
| `motion.fast` | 150 ms | Survol, focus, infobulle, menu |
| `motion.base` | 250 ms | Fenêtre, dépliage, pastille qui apparaît, message bref |
| `motion.slow` | 400 ms | Changement d'écran, barre qui se remplit, chiffre qui change, étape franchie |
| `motion.celebrate` | 1 200 ms | Moment de réussite (DSN-073) |
| `ease.out` | `cubic-bezier(0.2, 0, 0, 1)` | Ce qui entre : rapide puis doux |
| `ease.in` | `cubic-bezier(0.3, 0, 1, 1)` | Ce qui sort ; la sortie dure 70 % de l'entrée |
| `ease.inOut` | `cubic-bezier(0.4, 0, 0.2, 1)` | Ce qui se déplace ou change de taille |
| `ease.spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Un léger rebond, réservé aux coches et aux réussites |

**DSN-072** `[P1]` **Catalogue des mouvements.** Ce qui bouge, et comment ; rien d'autre ne bouge.

| Élément | Mouvement |
|---|---|
| Bouton | Appui : réduit à 98 %, `motion.instant`. En cours : l'indicateur apparaît en fondu, la largeur du bouton ne change pas. Enregistrement réussi : « Enregistré » et une coche pendant 1,5 s, puis le libellé revient. |
| Carte cliquable | Survol : se soulève de 2 px, ombre plus large, `motion.fast`. |
| Champ | Focus : contour en fondu. Erreur : le message glisse de 4 px vers le bas en apparaissant ; jamais de secousse. Valeur juste après une erreur : coche verte brève. |
| Fenêtre | Voile en fondu ; la fenêtre passe de 96 % à 100 % en apparaissant, `motion.base`, `ease.out`. Téléphone : monte du bas de l'écran. |
| Menu, liste déroulante, suggestions, infobulle | Fondu et glissement de 4 px, `motion.fast`. |
| Message bref | Monte de 16 px en apparaissant, `motion.base` ; sort en fondu. |
| Pastille de filtre | Ajoutée : de 90 % à 100 % en fondu ; retirée : fondu, puis la rangée se resserre, `motion.base`. |
| Résultats d'une liste | Pendant le rechargement : estompés (TRV-080). Les nouveaux : fondu, `motion.base`. Au premier affichage d'une page seulement, les six premières cartes ou lignes apparaissent l'une après l'autre, à 30 ms d'écart ; les suivantes d'un coup. |
| Ligne ou carte qui arrive (TRV-107) ou que l'on retrouve (TRV-108) | Fond `ciel-pale` qui s'efface en 1,2 s. |
| Chiffre qui change (compteur de biens, indicateur, pourcentage, mensualité) | Défile de l'ancienne à la nouvelle valeur en `motion.slow`, en chiffres à chasse fixe. Au premier affichage : la valeur finale directement. |
| Onglets de contenu (EP-10, « Deux façons de financer ») | L'ancien contenu s'efface en fondu, le nouveau glisse de 12 px vers sa place, `motion.base`. |
| Frise horizontale (EP-10, « Le parcours de financement ») | La ligne qui relie les étapes se trace en `motion.slow` quand la frise entre à l'écran, une seule fois. |
| Barre de progression, complétude | Se remplit en `motion.slow`. |
| Frise des étapes | Étape franchie : la coche apparaît avec `ease.spring`, le trait vers l'étape suivante se remplit, `motion.slow`. Jouée une fois par étape et par navigateur, à la première visite qui suit le changement (clé `dp_seen_step_{dossier}`). |
| Onglets | Le soulignement glisse vers l'onglet choisi, `motion.base`. |
| Points d'un défilement horizontal (téléphone, ACC-100) | Le point courant s'allonge (échelle horizontale) et prend la couleur `texte/roi`, `motion.base` ; le défilement vers une carte est doux (immédiat si les animations sont réduites). |
| Cartes d'une liste de la vitrine (biens, Cafés, services, financements de l'accueil ; grille du catalogue) | Quand la liste entre à l'écran, une seule fois : les cartes arrivent l'une après l'autre (fondu et 12 px, `motion.base`, 40 ms d'écart). Une liste déjà visible au chargement ne bouge pas ; rien n'est caché sans script, avec les animations réduites ou en affichage simplifié (D-100). |
| Vitrine des motivations (ACC-045, D-101) | La barre (ordinateur) ou le segment (téléphone) de la motivation choisie se remplit en 7 s, puis la suivante vient ; la photo passe à la suivante en fondu (700 ms) et se pose lentement (zoom de 108 % à 100 % pendant l'affichage) ; le grand numéro et le texte arrivent en fondu en montant de 8 px, `motion.slow`. La progression s'arrête au survol, au focus, hors de l'écran, page cachée ; rien de tout cela avec les animations réduites ou en affichage simplifié (DSN-074, TRV-122). |
| Barre d'action fixe du téléphone (ACC-100, FIC-053) | Monte du bas en `motion.base` quand elle apparaît, redescend quand elle s'efface ; sa hauteur ne change jamais (D-098). |
| Dépliage (questions fréquentes, section de fiche) | Hauteur et fondu, `motion.base` ; le chevron tourne. |
| Changement d'écran (espace client, back-office) | Le contenu apparaît en fondu en montant de 8 px, `motion.fast` ; l'en-tête et le menu restent immobiles. Transitions de vue du navigateur quand il les connaît, sinon ce fondu seul. |
| Fichier déposé | Barre de progression par fichier ; à la fin, la ligne prend sa coche avec `ease.spring`. |
| Carte du tableau des dossiers (glisser) | Soulevée, ombre `shadow.xl`, inclinée de 2° ; la colonne visée s'éclaire. |
| Barre d'actions groupées | Monte du bas quand une ligne est sélectionnée, `motion.base`. |
| Défilement vers un champ en erreur, vers le haut des résultats | Défilement doux. |

**DSN-073** `[P1]` **Moments de réussite** (« animations joyeuses », D-087). Aux moments qui comptent pour le client, l'écran de confirmation montre le médaillon `Celebration` : une coche qui se dessine dans un cercle `bleu-roi`, un anneau doré qui se referme, et une gerbe discrète de douze points dorés et bleus qui s'éloignent et s'effacent — `motion.celebrate`, une seule fois. Moments : demande envoyée (DEM) ; espace créé ; première pièce déposée ; dossier complet à 100 % (« Votre dossier est complet. ») ; accord d'une banque montré au client ; dossier gagné (« Félicitations, vous êtes propriétaire ! » — texte de l'écran concerné). Une seule fois par moment et par navigateur (clé `dp_celebrated_{moment}_{objet}`). **Jamais** pour un événement négatif ou neutre, jamais dans un e-mail, jamais en boucle, jamais de son. Dans le back-office : pas de gerbe ; un dossier gagné reçoit seulement un éclat doré bref sur sa carte.

**DSN-074** `[P1]` **Règles du mouvement.**
- **Il ne fait jamais attendre** : aucune animation ne retarde un contenu, une navigation ou une action ; on peut cliquer, taper, fermer pendant qu'elle joue, et elle s'interrompt proprement.
- **Fluide** : seules l'opacité et la transformation (déplacement, échelle, rotation) sont animées — la hauteur d'un dépliage passe par une grille (`grid-template-rows`) ; 60 images par seconde visées sur un téléphone de milieu de gamme (TRV-132) ; rien n'anime la mise en page entière.
- **Réduire les animations** (`prefers-reduced-motion: reduce`) : tout déplacement, changement d'échelle et rebond est supprimé ; ne restent que des fondus de `motion.fast` au plus ; les chiffres prennent leur valeur finale ; pas de gerbe (le médaillon s'affiche coché) ; pas de surlignage animé (le fond reste 1,2 s puis disparaît d'un coup) ; défilement immédiat.
- **Outils** : transitions et animations de feuilles de style, avec les jetons ; la bibliothèque `motion` (React) pour l'apparition et la disparition d'éléments, la réorganisation d'une liste, la gerbe en SVG. Aucune autre bibliothèque d'animation, aucune vidéo, aucun fichier Lottie.

**DSN-075** `[P1]` **Dans Figma.** Les jetons de mouvement sont documentés sur la page « Fondations » (un cadre « Mouvement » : durées, courbes, exemples) ; les états des composants animés (bouton en cours et enregistré, champ juste, pastille ajoutée, médaillon) sont des variantes. Les prototypes Figma emploient les mêmes durées et courbes.

**DSN-076** `[P1]` **Scènes illustrées** (D-092). Composant `Illustration`, une scène par usage :

| Scène | Pages | Ce qui se dessine, puis bouge |
|---|---|---|
| `Projection` | EP-20 | Un arc pointillé part de Paris et se trace jusqu'à Alger, un petit avion le suit ; un immeuble se dessine trait par trait, ses fenêtres s'allument une à une ; une courbe monte jusqu'à une pastille « votre projection ». |
| `Partenaire` | EP-32, EP-33, EP-23 | Deux immeubles se dessinent face à face ; un pont de pointillés les relie ; une clé dorée se pose au milieu. |
| `Rappel` | EP-21 en page, confirmations de rappel | Un téléphone vibre deux fois ; une bulle apparaît ; l'aiguille d'une horloge fait un quart de tour. |
| `Alerte` | EP-26, EP-27 | Une cloche oscille une fois ; trois petites maisons s'éclairent l'une après l'autre. |
| `Avis` | EP-25 | Cinq étoiles se dessinent et se remplissent de gauche à droite. |
| `Attente` | EP-29 (attente, maintenance) | Une grue soulève un dernier bloc qui se pose sur un immeuble ; le soleil se lève derrière. |
| `Perdu` | EP-29 (`404`, `410`, `403`, `500`) | Une boussole cherche puis se fixe ; un chemin de pointillés mène à une maison. |

Style : dessin au trait de 1,7 px (comme les icônes, DSN-040), traits `texte/roi` et `accent/or`, aplats doux `fond/ciel-pale`, `fond/champagne-clair`, `fond/or-clair` ; jamais de personnage réaliste ni de texte dans l'image. Place : sur ordinateur, une colonne de 480 px à côté du contenu, sur le fond dégradé de la page ; sur téléphone, au-dessus du contenu, 200 px de haut. **Mouvement** : une seule fois, à l'arrivée sur la page — les traits se tracent (`motion.celebrate`), puis les éléments bougent l'un après l'autre, décalés de 120 ms, de 12 px au plus ; 2 400 ms en tout ; puis la scène reste immobile. Jamais en boucle (DSN-070). Réduire les animations : la scène s'affiche finie, sans mouvement (DSN-074). Décorative : `aria-hidden="true"`, aucune information qui ne soit aussi dans le texte. Réalisation : SVG animé en CSS, 30 Ko au plus par scène, chargé après le contenu ; un navigateur qui ne charge pas l'image ne perd rien.

## 8. Adaptation

**DSN-080** `[P1]` Points de rupture : TRV-130. Chaque écran de la vitrine et de l'espace client est dessiné en **390 px** et en **1 440 px**. Règles de passage : colonnes qui s'empilent ; rangées de cartes qui deviennent un défilement horizontal aimanté ; barre d'action fixe en bas de l'écran pour l'action principale d'une fiche ; fenêtres en plein écran ; tableaux remplacés par des cartes.

## 9. Back-office

**DSN-090** `[P1]` **Gabarit** : menu latéral de 248 px (64 replié), fond `bleu-nuit`, texte blanc, entrée active sur fond `bleu-roi` ; barre du haut de 64 px, blanche ; zone de travail sur fond `fond/gris`, contenu sur surfaces blanches à bordure `ligne/bleue`. Le mot-symbole figure en haut du menu.

**DSN-091** `[P1]` **Actions** : bouton primaire `bleu-roi` ; secondaire à bordure ; l'action destructive en `Danger`, toujours précédée d'une confirmation (TRV-095). **Densité** : lignes de 44 px, espacements de 8 à 16 px, quatorze pixels de texte. **Boutons** : taille S (36 px, `button.s`) dans les barres d'outils et les tableaux ; taille M (46 px, `button.m`) pour l'action principale d'une page et dans les fenêtres ; rayon 8. **Couleur** : réservée aux états (DSN-015), aux alertes et à l'action principale ; aucune décoration.

## 10. Dans le code et dans Figma

**DSN-100** `[P1]` **Code.** Les jetons sont définis une fois dans `packages/ui` (couleurs, typographie, espaces, rayons, ombres) et exposés au web sous forme de variables de style, à l'application mobile sous forme de thème. Les noms suivent ceux de ce fichier.

**DSN-101** `[P1]` **Figma.** Organisation du fichier : `07-design/02`, § 1. Règles de nommage : les calques d'un écran portent des **noms français lisibles** (« Section · Le Café », « Carte · Appartement T3 ») ; les composants, leurs variantes et leurs propriétés ont des **noms anglais** (`Button`, `Type=Primary`, `Label`) ; une instance se nomme « Rôle · contenu ». Chaque écran porte son identifiant (`EP-05`), son état (« À valider », « Validé le … ») et renvoie au fichier de specs qui le décrit.

Jetons dans Figma : variables `bo/{groupe}/{nom}` (collection « Bleu & Or »), `espace/*`, `rayon/*`, `trait/*` (« Mesures »), `icone/*` (« Icônes », cinq modes) ; styles de texte `Vitrine/{jeton}`, `Téléphone/{jeton}`, `Outil/{jeton}` ; styles d'ombre `Ombre/s` à `Ombre/xl` ; styles de dégradé `Dégradé/or`, `Dégradé/doux`, `Fond de section/…`. Un écran n'emploie aucune couleur, aucun texte, aucune ombre hors de ces jetons ; chaque variable porte son nom de variable de style pour le code (`var(--bo-fond-blanc)`).

**DSN-102** `[P1]` **L'accueil validé, mis au propre.** La maquette validée par Mme Mouhoubi le 1er octobre 2026 est conservée telle quelle (page `Maquette validée (01/10/2026)` du fichier, et `Design/archive/`). La version de travail (page `Accueil`) est la même page, reconstruite avec les composants et les jetons de ce fichier. Ce qui change, pour que la maquette et le code disent la même chose :

| Ce qui change | Avant | Après |
|---|---|---|
| Tailles de texte | Une trentaine de tailles, certaines à un demi-pixel près, quelques-unes sous 11,5 px | L'échelle de DSN-021 : écarts de 0,5 à 2 px ; aucun texte sous 12 px (DSN-024) |
| Boutons | Neuf boutons de hauteurs légèrement différentes (44 à 55 px) | Trois tailles : 52, 46, 36 px |
| Cartes du comparatif | Mesures propres | Celles de la carte de bien |
| Bandeaux des cartes | Titres de 19, 20 et 22 px ; numéros de 22 et 26 px | `overline.l` (20 px) ; `number.index` (26 px) |
| Grands blocs | Rayons de 26 et 32 px | `radius.xl` (30 px) |
| Icônes | Repères de lieu en deux dorés ; icônes de carte en bleu nuit | Un seul doré (`accent/or`) ; bleu roi |
| Marges de l'en-tête | 44 px | 48 px (grille, DSN-031) |
| Typographie française | « Apport (20%) », espaces simples | « Apport (20 %) », espaces insécables (TRV-010) |
| Lien de l'assistant | Texte suivi du caractère « › » | Lien avec son chevron |
| Pied de page | Cinq entrées, deux liens légaux | Complété des liens obligatoires (NAV-020) |
| Formulaire de projection | Quatre champs et le bouton | Complété de la case de consentement, du lien vers la politique de confidentialité et de la mention d'hébergement (DEM-020) ; le premier champ montre qu'il est une liste |
| Hauteur de la page | 7 344 px | 7 425 px |

Aucun texte, aucune image, aucun ordre de section n'a changé.
