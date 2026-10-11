# Guide de construction — lire ceci avant de coder le Site public

Ce guide dit où trouver chaque chose et comment lire les maquettes. Il ne remplace rien : les **specs** (`Specs/`) font foi pour le comportement, les **maquettes Figma** pour le visuel, et les **données de référence** (`Design/donnees-de-reference.md`) pour les chiffres et les noms d'exemple.

## 1. Les trois sources, et leur ordre

| Source | Fait foi pour | Où |
|---|---|---|
| Specs v1.5 | Règles, textes, états, calculs, API, modèle de données, e-mails. Chaque règle a un identifiant (`CAT-032`, `TRV-114`…) cité par les maquettes. | `Specs/` — commencer par `README.md`, puis `07-design/02-inventaire-des-ecrans.md` (la liste des écrans et de leurs états) |
| Maquettes Figma | Mise en page, composants, variantes, animations (décrites dans les descriptions de composants). | Fichier `H7XVzqkkeUViNnecDdCrdG`, page « Site public » (puis « Espace client », « Back-office »…) |
| Données de référence | Les chiffres, dates, noms, références des exemples : les mêmes partout, et les futurs jeux de données de test. | `Design/donnees-de-reference.md` |

En cas de désaccord entre une maquette et une règle, **la règle gagne** et la maquette est à corriger (le signaler). Un écran sans maquette se construit d'après les specs et le système de design (`Specs/07-design/01`).

## 2. Lire la page « Site public »

- À gauche : le **Sommaire** (un tableau : écran, nom, livraison, phase, état ; chaque identifiant est un lien vers la section de l'écran).
- Des **rangées de familles** (sections) dans l'ordre d'un visiteur : Parcours · Accueil · Recherche · Programmes et biens · Financement · Promoteurs et partenaires · Le Café · Découvrir et contact · Liens reçus par e-mail · Système · E-mails.
- Dans une famille, **une section par écran de l'inventaire** (« EP-02 · Catalogue »), avec ses cadres en grille de trois : l'état nominal d'abord, puis chaque état (vide, erreur, chargement, connecté, repli…), puis les versions téléphone (390). Chaque cadre porte une **étiquette** au-dessus : identifiant, nom de l'état, format, statut (À valider / Validé).
- Les notes de conception sont **hors** des cadres (« Note · EP-xx · … », à droite du cadre) : rien de ce qui est dans un cadre n'est une note.
- La rangée **Parcours** contient six tableaux de scénarios (PA-01 à PA-06) : à chaque étape, l'écran (lien), ce que fait le visiteur, ce que fait la plateforme, les règles et e-mails concernés ; dessous, les variantes et cas d'erreur. C'est le fil conducteur pour comprendre comment les écrans s'enchaînent.

Nommage des calques : français ; une instance s'appelle « Rôle · contenu » (« Bouton · Rechercher », « Champ · E-mail ») ; un cadre d'écran s'appelle « EP-xx · Nom, état — 1440 » ou « — 390 ».

## 3. Les composants (page « Composants »)

Dix familles. Les plus utilisés sur le site : `Header` (variantes Version Default/Compact × Account Guest/Connected, propriété Show café), `Footer` (Show café/phone/socials, rangée « Taille du texte »), `HeaderMobile`, `FooterMobile`, `SearchBar`/`SearchField` (propriété Dictate), `PropertyCard` (Standing, Show save/Saved), `ComparisonBlock`, `EventCard`, `Button` (Type Primary/Secondary/Tool/Tertiary/Danger, Size, State, Loading), `TextField`/`Select`/`Textarea` (State Default/Filled/Focus/Error/Disabled, Error message, Dictate)/`Checkbox`/`Radio`/`Switch`, `Chip`, `Tag`, `StatusTag` (Tone), `Banner` (Tone), `Toast`, `ErrorSummary`, `Illustration` (Scène : Projection, Partenaire, Rappel, Alerte, Avis, Attente, Perdu — chaque description dit ce qui s'anime), `Celebration`, `Avatar`, `Badge`, `Pagination`, `Breadcrumb`.

Chaque composant correspond à un composant de code du même nom (`Specs/07-design/01`, § 6) ; ses variantes sont ses propriétés. Les couleurs, espacements, rayons et ombres sont des **variables** (`bo/…`, `espace/…`, `rayon/…`, `Ombre/…`) : jamais de valeur écrite en dur (DSN-002). Les tailles de texte sont les styles `Vitrine/*` (1 440) et `Téléphone/*` (390).

## 4. Ce que les maquettes ne montrent pas (et où c'est écrit)

- **Les mouvements** : `Specs/07-design/01` DSN-070 à DSN-076 (durées, courbes, ce qui bouge, moments de réussite, scènes illustrées, réduction des animations).
- **Les textes d'interface** et leurs clés : `Specs/07-design/03-microcopie.md`.
- **Les erreurs** : forme (TRV-113), emplacement (TRV-114), messages standard (TRV-064), rien ne se perd (TRV-115).
- **Le mode simplifié, la taille du texte, l'aide vocale** : TRV-122, TRV-123, TRV-127 — maquettés sur l'accueil (EP-01 « affichage simplifié », « lecture à voix haute ») et valables sur toutes les pages.
- **Les replis** quand une donnée ou une fonction manque : chaque page a sa règle (ACC-090 pour l'accueil, FIC-* pour les fiches…) ; une section se masque, jamais de bloc vide.
- **Les calculs** : `Specs/01-domaine/07-regles-de-calcul.md` ; les chiffres des maquettes sont ceux de l'exemple de contrôle CAL-103 et du barème indicatif (6,50 %, 25 ans).

## 5. Outils

- `python Specs/_outils/verifier_specs.py` : cohérence des specs (doit finir par « Tout est cohérent. »).
- `python Specs/_outils/inventaire_figma.py` : régénère `Design/inventaire-ecrans.json` et les scripts de synchronisation des sommaires Figma (`Design/sync/`).
- `Design/kit.js` : le kit de dessin déclaratif (pour modifier les maquettes par script) ; `Design/figma-ledger.json` : identifiants de nœuds, propriétés, pièges.
- `Design/audit-site-public-2026-10-08.md` : le dernier audit des maquettes et ce qui en a été corrigé.
