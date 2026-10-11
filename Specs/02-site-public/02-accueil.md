# Accueil

Écran **EP-01**. Maquette validée : Figma, « Accueil — Bleu & Or » (D-003). Cette page est une page de **conversion** : chaque section mène à l'une de trois actions — voir des biens, s'inscrire à un Café, demander une projection ou un rappel.

Les textes cités sont ceux de la maquette validée. Ils sont stockés dans des **blocs de contenu** (`ContentBlock`, liste complète : CMS-020) et modifiables dans le back-office. Les nombres, les dates et les biens viennent des données.

---

## 1. Vue d'ensemble

**ACC-001** `[P1]` Sections, dans cet ordre :

| # | Section | Titre | Action principale |
|---|---|---|---|
| 1 | En-tête | — | NAV-010 |
| 2 | Héros | « Votre projet immobilier en Afrique prend vie ici » | S'inscrire au prochain Café |
| 3 | Comparatif (dans le héros) | « 2 biens équivalents, 1 même apport, 2 mensualités » | — |
| 4 | Six motivations | « Pourquoi acheter en Algérie en 2026 ? » | — |
| 5 | Biens | « Des biens pour différents budgets » | Rechercher · Voir tous les programmes |
| 6 | Le Café | « Rencontrez promoteur et banquier autour d'un café » | Je m'inscris |
| 7 | Services | « Pourquoi choisir Diaspora Patrimoine ? » | Être rappelé |
| 8 | Financement et projection | « Un crédit bancaire, une vraie garantie » | Recevoir ma projection |
| 9 | Appel final | « L'histoire de votre projet commence ici » | S'inscrire · Recevoir ma projection |
| 10 | Pied de page | — | NAV-020 |

**ACC-002** `[P1]` Une section dont les données manquent suit son **repli** (§ 9). Jamais de section vide, jamais de bouton sans effet (D-043).

**ACC-003** `[P1]` Un seul titre de niveau 1 : celui du héros. Chaque section a un titre de niveau 2. Les titres en deux lignes de la maquette (une ligne droite, une ligne en italique doré) forment **un seul** titre pour les lecteurs d'écran.

## 2. Héros

**ACC-010** `[P1]` **Titre**, sur trois lignes : « Votre projet immobilier » · « en Afrique » · « prend vie ici » (blocs `home.hero.line1` à `line3`). Image de fond : `home.hero.image`, chargée en priorité (c'est le plus grand élément de la page, TRV-132).

**ACC-011** `[P1]` **Carte « Le Café »**, à droite du titre :
- surtitre « LE CAFÉ » et « DIASPORA PATRIMOINE » ;
- « Vous venez avec vos questions, promoteur et banquier vous accueillent dans leurs espaces quand vous le souhaitez pour vous répondre. » ;
- « Vous repartez avec une projection, l'histoire de votre projet commence. » ;
- « À Paris » · « et dans le Sud de la France » ;
- la pastille **« PROCHAIN CAFÉ »** (ACC-030) ;
- le bouton **« Je m'inscris au prochain café »** et, en second, le bouton **« Voir les biens »** → `/programmes` (D-095 : l'intention la plus fréquente, atteignable sans défiler).

**ACC-012** `[P1]` Sous le comparatif, deux mentions cliquables : « Un crédit bancaire, une vraie garantie » → `/financements#credit` ; « Des solutions de financements islamiques » → `/financements#islamique`.

### Le prochain Café

**ACC-030** `[P1]` Le **prochain Café** affiché dans le héros, dans l'appel final et dans le pied de page est choisi ainsi, parmi les Cafés publiés, non annulés, dont le début est à venir :
1. le plus proche dont les inscriptions sont ouvertes **et** qui a des places ;
2. à défaut, le plus proche dont les inscriptions sont ouvertes (complet : liste d'attente) ;
3. à défaut, le plus proche dont les inscriptions ne sont pas encore ouvertes ;
4. à défaut : aucun (repli, § 9).

**ACC-031** `[P1]` **Pastille** : « PROCHAIN CAFÉ » · la date abrégée (« Sam. 17 octobre ») · le lieu et l'état :

| État | Texte | Bouton |
|---|---|---|
| Places restantes ≤ `events.showSeatsBelow` | « {lieu} · {n} places » (« 1 place ») | « Je m'inscris au prochain café » |
| Places restantes au-dessus du seuil | « {lieu} · inscriptions ouvertes » | idem |
| Complet | « {lieu} · complet » | « M'inscrire sur la liste d'attente » |
| Inscriptions pas encore ouvertes | « {lieu} · ouverture le {date} » | « Me prévenir » |

Le bouton mène à la page du Café, sur son formulaire (`/le-cafe/{slug}#inscription`). La date est donnée dans le fuseau du lieu (TRV-031).

## 3. Comparatif

**ACC-040** `[P1]` Le bloc `home.comparison` affiche deux colonnes, « À ALGER » et « EN FRANCE », pour un même bien type :

| | À ALGER | EN FRANCE |
|---|---|---|
| Bien | Appartement T3 – Résidence El Yasmine | Appartement T3 équivalent |
| Prix du bien | 150 000 € | 350 000 € |
| Apport | 30 000 € | 30 000 € |
| Mensualité* | 810 € / mois | 1 600 € / mois |

Titre : « 2 biens équivalents, 1 même apport, 2 mensualités, » · « 1 seule belle opportunité de constituer ou accroître son patrimoine. ». Entre les deux colonnes : « − 790 € » · « chaque mois ». Note : la ligne d'hypothèses d'ACC-042 (« Hypothèses : Alger, 25 ans, 6,50 % · France, 25 ans, 3,50 %. »), puis `legal.monthlyFootnote`.

Les prix, l'apport, la durée et le taux de chaque colonne sont du **contenu** saisi par l'administrateur ; la mensualité est calculée dès que la durée et le taux sont renseignés (ACC-043). Valeurs de départ : celles du tableau (`Design/donnees-de-reference.md`, § 4), qui remplacent les « 400 € / 1 300 € » de la maquette cliente, impossibles à justifier par un calcul (le point correspondant de PAR-100 est clos). Forme du bloc :

```json
{
  "currency": "EUR",
  "left":  { "label": "À ALGER",   "title": "Appartement T3 – Résidence El Yasmine", "price": "150000", "downPayment": "30000", "monthly": "810",  "durationMonths": 300, "annualRateBps": 650 },
  "right": { "label": "EN FRANCE", "title": "Appartement T3 équivalent",            "price": "350000", "downPayment": "30000", "monthly": "1600", "durationMonths": 300, "annualRateBps": 350 },
  "propertyId": null
}
```

**ACC-041** `[P1]` L'apport est saisi par colonne (`downPayment`, un montant dans `currency`) et affiché sous le libellé « Apport », sans pourcentage. L'écart est calculé (`right.monthly − left.monthly`, arrondi à la dizaine comme les mensualités, CAL-022) ; s'il est nul ou négatif, la pastille d'écart est masquée. **Un bien réel dans le comparatif** (D-095) : `propertyId`, facultatif, désigne le bien de la colonne de gauche ; s'il est renseigné, le titre de la colonne est un lien vers sa fiche, et la page d'accueil est invalidée (ACC-110) quand ce bien quitte `AVAILABLE` — le back-office affiche alors sur le bloc « Le bien du comparatif n'est plus disponible : choisissez-en un autre. » (PAR-100). `GET /public/home` rend ce bien (`comparisonProperty` : son slug, s'il est disponible, et sa photo de couverture, `cover`). Tant que l'écran des blocs (CMS-020) n'est pas livré, c'est la commande de démonstration qui renseigne `propertyId` avec le bien DP-DZ-0142 — une mise à jour directe du bloc, écrite au journal d'audit — et qui le remet à `null` quand la démonstration est retirée (PAR-082, D-097).

**ACC-042** `[P1]` Quand `durationMonths` et `annualRateBps` sont renseignés des deux côtés, une ligne discrète apparaît sous le bloc : « Hypothèses : Alger, {durée}, {taux} · France, {durée}, {taux}. ». Tant qu'ils ne le sont pas, le back-office affiche sur ce bloc l'avertissement de Q-009 : « Ces deux mensualités supposent des durées ou des taux différents. Renseignez-les pour que le comparatif soit vérifiable. »

**ACC-043** `[P1]` **Un comparatif vérifiable.** Dès qu'un côté porte sa durée et son taux, sa mensualité n'est plus une saisie libre : elle est **calculée** (CAL-040, sur le prix moins l'apport), arrondie à la dizaine comme sur les cartes (CAL-022), et c'est ce chiffre qui s'affiche. L'écran du bloc (CMS-020) montre le calcul à côté de la valeur saisie auparavant ; si elles diffèrent, il le dit avant d'enregistrer : « Avec ces hypothèses, la mensualité est de {x} € / mois (vous aviez saisi {y} €). ». Sans hypothèses, la mensualité saisie reste du contenu — c'est l'état de la maquette — et le point « Comparatif de l'accueil » reste ouvert dans la carte « Avant la mise en ligne » (PAR-100). On ne publie donc pas, à l'ouverture, deux mensualités que rien n'explique.

## 4. Six motivations

**ACC-045** `[P1]` Titre : « Pourquoi acheter en Algérie » · « en {année} ? » — `{année}` est remplacé par l'année en cours. Sous-titre : « 6 motivations possibles pour la diaspora algérienne, » · « et sans doute la vôtre parmi elles. ».

Six motivations numérotées (bloc `home.why.items`), chacune avec une image, un numéro, un titre, un texte (D-039), présentées en vitrine animée (D-101) :

| # | Titre | Texte |
|---|---|---|
| 01 | SÉCURITÉ | Avoir un logement à soi pour ses séjours et préparer, si on le souhaite, un retour futur. Constituer un patrimoine familial. |
| 02 | FIERTÉ | Concrétiser un projet dans son pays d'origine et en partager la fierté avec ses proches. |
| 03 | NOUVEAUTÉ | Découvrir des résidences contemporaines aux prestations évoluées, avec l'arrivée récente du crédit bancaire classique et islamique : une possibilité de financement avec des revenus perçus à l'étranger, selon la banque et le dossier. |
| 04 | CONFORT | Choisir un appartement contemporain, décoré avec goût, ou une résidence où boulangerie, épicerie et salle de sport sont accessibles à pied, selon les programmes. |
| 05 | BUDGET | Comparer ce que son budget permet d'acheter en Algérie et dans son pays de résidence, avec parfois davantage d'espace ou de prestations. |
| 06 | RACINES | Garder un lien concret avec ses racines et transmettre un lieu de repère à ses enfants. |

**Vitrine (D-101).** Sur ordinateur : à gauche la liste des six (onglets : numéro, pastille d'icône, titre ; la motivation choisie en bleu nuit, avec une barre de progression or) ; à droite la photo de la motivation choisie, son grand numéro, et une carte blanche posée sur le bas de la photo avec la pastille, le titre, « 0n/06 », le texte et deux flèches « Motivation précédente » / « Motivation suivante ». Sur téléphone et tablette (sous 1024 px) : la photo en haut avec six segments de progression (des boutons de 44 px, « Afficher la motivation {n} sur {total} : {titre} »), la carte du texte dessous ; un glissement horizontal sur la photo passe à la suivante ou à la précédente, un glissement vertical fait défiler la page. **Défilement automatique** : la vitrine passe à la motivation suivante toutes les 7 secondes, en boucle, seulement si la section est à l'écran, la page visible, et que personne ne la survole ni n'y a le focus ; elle s'arrête pour de bon dès que le visiteur choisit une motivation (onglet, segment, flèche, glissement) ; un bouton « Mettre en pause le défilement des motivations » / « Reprendre… » est toujours présent sur la photo. Avec les animations réduites ou en affichage simplifié (TRV-122), rien ne défile seul : le visiteur choisit. Clavier : flèches, Début et Fin dans la liste ; la photo et le texte forment le panneau de l'onglet choisi. Sans script, la première motivation s'affiche. Une motivation dont le texte est vidé dans le back-office est retirée ; les numéros se recalculent. Images de départ : six photos distinctes, tirées de la maquette validée ; celle de la carte 03 est un recadrage de la photo du héros (D-097).

## 5. Biens

**ACC-050** `[P1]` Titre : « Des biens pour » · « différents budgets ». Sous-titre : « De l'habitat confortable aux résidences de très haut standing, » · « selon les offres de nos promoteurs sélectionnés. ». Puis : la barre de recherche, le lien de l'assistant, trois cartes, le bouton « Voir tous les programmes » (→ `/programmes`), la note.

**ACC-051** `[P1]` **Choix des trois biens.** Les étapes ci-dessous sont jouées sur les biens publiés dont la disponibilité est `AVAILABLE` ; s'il reste des places, elles sont rejouées sur les biens publiés `RESERVED`, dont la carte porte l'étiquette « Réservé » (CAT-041). Un bien réservé, même épinglé, ne passe donc jamais devant un bien disponible :
1. d'abord les biens **épinglés** (`featuredRank` renseigné), par rang croissant, trois au plus ;
2. s'il en manque : pour chaque standing absent de la sélection, dans l'ordre `COMFORT`, `STANDING`, `PREMIUM`, le bien de ce standing le mieux classé par pertinence (CAL-080) ;
3. s'il en manque encore : les biens les mieux classés par pertinence.

Les trois cartes sont **affichées par prix croissant** : la section montre une échelle de budgets. Anatomie de la carte : CAT-040.

**ACC-052** `[P1]` **Barre de recherche**, trois champs et deux boutons :

| Champ | Contenu | Défaut |
|---|---|---|
| **Ville** | Les régions qui ont au moins un bien publié et disponible (PAR-023, CAT-021), précédées de « Toutes les villes ». | « Toutes les villes » |
| **Budget** `[P1]` | « Peu importe », puis « Jusqu'à {n} € / mois » pour chaque palier de `catalogue.monthlyBudgetSteps` (→ `monthlyMax`), puis, après un séparateur, « Jusqu'à {n} € au total » pour chaque palier de `catalogue.priceBudgetSteps` (→ `priceMax`) : la personne qui pense « 150 000 € » n'a pas à convertir (D-095). | « Peu importe » |
| **Type de bien** | « Tous les types », puis une ligne par couple type et pièces présent au catalogue (« Appartement T2 », « Appartement T3 », « Duplex T4 », « Villa T5 »…), puis « Studio », « Terrain », « Local commercial » s'il en existe. | « Tous les types » |

- **Rechercher** → `/programmes` avec les critères choisis (`region`, `monthlyMax` ou `priceMax` selon le palier choisi — les deux s'excluent, CAL-032 —, `type`, `rooms`).
- **Filtres** → `/programmes?filtres=1` avec les mêmes critères : le catalogue s'ouvre avec ses filtres ouverts (CAT-030).

Une option sans aucun bien n'est pas proposée. Aucun champ n'est obligatoire. Le champ **Ville** accepte la frappe : elle filtre la liste des régions (TRV-109). Les choix faits dans la barre sont gardés en stockage de session (TRV-092) jusqu'au clic « Rechercher » : un détour par le Café et un retour les retrouvent. « Mensualité » et « apport » portent leur « ? » (`ui.help.monthlyIndicative`, `ui.help.downPayment`, TRV-126) à leur première apparition sur la page, et « projection » le sien (`ui.help.projection`).

**ACC-053** `[P1]` Sous la barre : « Vous préférez le dire avec vos mots ? » · « Notre assistant vous écoute et cherche pour vous › » → `/assistant`.

**ACC-054** `[P1]` **Note** sous les cartes, composée des mentions paramétrées — aucune n'est réécrite ici (PAR, § 1.9) : `legal.monthlyFootnote` si une mensualité est affichée ; `legal.illustrationNote` si l'une des trois cartes montre une image d'illustration ; `legal.convertedPricesNote` si un prix est converti.

**ACC-055** `[P1]` **Moins de trois biens.** Deux biens : deux cartes centrées. Un bien : une carte, à côté d'une carte d'appel « D'autres programmes arrivent » · « Dites-nous ce que vous cherchez : un conseiller vous rappelle. » · bouton « Être rappelé » (ou son repli, § 9). **Aucun bien publié** : la barre de recherche et les cartes laissent place à « Les premiers programmes arrivent bientôt. » et au formulaire de projection (ou à son repli) ; le bouton « Voir tous les programmes » est masqué. Des biens publiés mais **tous réservés** ne sont pas ce cas : leurs cartes s'affichent, avec « Réservé » (ACC-051), et la barre de recherche reste. Des biens publiés mais **tous vendus ou retirés** : le même repli que « Aucun bien publié » — l'accueil ne met pas en avant ce qui ne s'achète plus ; ces biens restent au catalogue, avec leur bandeau.

## 6. Le Café

**ACC-060** `[P1]` Titre : « Rencontrez promoteur et banquier » · « autour d'un café ». Sous-titre : « Vous venez avec vos questions, vous repartez avec une projection, » · « l'histoire de votre projet commence. ».

**ACC-061** `[P1]` **Trois cartes** : les trois prochains Cafés publiés, non annulés, par date croissante. Chaque carte :
- le lieu (`locationLabel`) : « À Paris », « Dans le Sud de la France » ;
- le jour de la semaine, le numéro du jour, le mois (« SAMEDI · 17 · OCTOBRE ») ;
- une ligne : « {jour} · de {début} à {fin} » suivie de « · promoteur et banquier présents » si le Café a au moins un promoteur **et** une banque parmi ses participants publics ; « · promoteur présent » ou « · banquier présent » s'il n'y a que l'un des deux ; rien sinon ;
- l'état et le bouton, selon CYC-181 : « Il reste 12 places » → « Je m'inscris » ; « Inscriptions ouvertes » → « Je m'inscris » ; « Complet » → « Liste d'attente » ; « Ouverture le 1er novembre » → « Me prévenir » ; « Inscriptions closes » → pas de bouton.

À côté des cartes : « LE CAFÉ » · « À Paris » · « et dans le Sud de la France » · « Au moins une fois par mois ». Sous les cartes : « Gratuit, sur inscription. Le lieu exact vous est communiqué à l'inscription. ».

**ACC-062** `[P1]` Moins de trois Cafés : les cartes existantes, complétées par une carte « Prochaines dates bientôt annoncées » avec le bouton « Me prévenir » (EP-13, CAF-040). Aucun Café : une seule carte, la même, pleine largeur.

## 7. Services

**ACC-070** `[P1]` Titre : « Pourquoi choisir » · « Diaspora Patrimoine ? ». Sous-titre : « Une plateforme de mise en relation sélective » · « pour acheter un bien neuf en Afrique depuis l'étranger. ». Sept services numérotés (bloc `home.services.items`) :

| # | Titre | Texte | Lien |
|---|---|---|---|
| 01 | Recherche autonome | Grâce à des filtres détaillés, trouvez les programmes selon la ville, votre budget et vos exigences. | `/programmes` |
| 02 | Recherche avec un chatbot | Un agent est là pour vous écouter et trouver le bien que vous recherchez selon vos critères. | `/assistant` |
| 03 | Promoteurs sélectionnés | Notre plateforme choisit les promoteurs et examine leurs références ainsi que les garanties de chaque programme. | `/promoteurs` |
| 04 | Des biens pour différents budgets | De l'habitat confortable aux résidences de très haut standing, selon les offres. | `/programmes` |
| 05 | Cafés Promoteurs – Diaspora | Les promoteurs viennent à votre rencontre à Paris et dans le sud de la France, autour d'un café et dans un lieu convivial, au moins une fois par mois. | `/le-cafe` |
| 06 | Expertise financière | Un conseiller financier peut vous accompagner dans vos démarches bancaires, de manière à obtenir la meilleure offre auprès des banques partenaires européennes ou africaines. | `/financements` |
| 07 | Accompagnement administratif et consulaire | Vous avez la possibilité de nous déléguer la tâche de constitution de certaines pièces ou éléments auprès de certains services consulaires pour la constitution de votre dossier. | `/notre-concept#accompagnement` |

**ACC-071** `[P1]` Huitième carte, d'appel : « Parlons de votre projet » · « Un conseiller vous rappelle, au moment qui vous convient. » · bouton **« Être rappelé »** → demande de rappel (EP-21, DEM-014).

**ACC-072** `[P1]` Un service dont la fonctionnalité n'est pas active est **masqué**, et les numéros se recalculent : le 02 si `features.assistant.mode = OFF` ; le 05 si `features.cafe` est faux.

## 8. Financement, projection, appel final

**ACC-080** `[P1]` Titre : « Un crédit bancaire, » · « une vraie garantie ». Sous-titre : « Crédit classique ou financement islamique, » · « avec des revenus perçus à l'étranger, selon la banque et le dossier. ». Trois cartes (bloc `home.financing.items`) :

| Surtitre | Titre | Texte | Trois points |
|---|---|---|---|
| CRÉDIT BANCAIRE | Un crédit bancaire, une vraie garantie | Un prêt classique auprès d'une banque partenaire, européenne ou africaine. | Des revenus perçus à l'étranger · Un apport de {apport} % dans notre exemple · Une offre étudiée selon votre dossier |
| FINANCEMENT ISLAMIQUE | Des solutions de financements islamiques | Une alternative au crédit classique, proposée par certaines banques partenaires. | Des revenus perçus à l'étranger · Des solutions selon la banque · Une offre étudiée selon votre dossier |
| EXPERTISE FINANCIÈRE | Un conseiller financier à vos côtés | Il peut vous accompagner dans vos démarches bancaires, de manière à obtenir la meilleure offre. | Des banques partenaires européennes ou africaines · Présent aux Cafés, avec le banquier · Un seul interlocuteur pour votre dossier |

`{apport}` est remplacé par le pourcentage d'apport du financement de référence (CAL-030). Chaque carte mène à son ancre de `/financements`. Une carte peut être masquée par l'administrateur (case « Afficher » du bloc).

**ACC-081** `[P1]` **Formulaire « Recevez votre projection »**, à côté des cartes :
- « Recevez votre projection » · « GRATUIT · SANS ENGAGEMENT » · « Trois réponses suffisent. Un conseiller vous l'envoie sous 48 h ouvrées, sans engagement. » ;
- quatre champs : « Où souhaitez-vous acheter ? » (liste des régions, comme ACC-052 ; **facultatif**, comme dans DEM-013, et marqué comme tel) · « Votre apport » (montant, DEM-007) · « Mensualité confortable » (montant par mois) · « Votre e-mail » ;
- la case de consentement (DEM-020) ;
- le bouton **« Recevoir ma projection »**.

« Projection », « apport » et « mensualité » portent leur « ? » (TRV-126) s'ils n'en ont pas encore eu un plus haut dans la page.

« Trois réponses » sont les trois champs obligatoires : l'apport, la mensualité et l'e-mail (DEM-013). Comportement, validation et second écran : DEM-013 (D-031).

**ACC-086** `[P1]` **Appel final.** « L'histoire de votre projet » · « commence ici » · « Venez avec vos questions, repartez avec votre projection. » · une ligne sur le prochain Café : « Prochain café : {date longue}, à {lieu} · il reste {n} places » (formes de ACC-031) · deux boutons : **« Je m'inscris au prochain café »** et **« Recevoir ma projection »** (fait défiler jusqu'au formulaire de la section 8 et y place le curseur).

## 9. Replis

**ACC-090** `[P1]` Tant qu'un élément `[P1]` n'est pas actif, ou que ses données manquent, l'accueil applique le repli ci-dessous. Tous les replis reposent sur des fonctions `[P1]`.

| Élément | Condition | Repli |
|---|---|---|
| Carte « Le Café » du héros (ACC-011) | `features.cafe` faux | Carte « Parlons de votre projet » : « Un conseiller vous rappelle, au moment qui vous convient. » · bouton « Être rappelé ». |
| Pastille « Prochain Café » | Aucun Café à venir (ACC-030, cas 4) | « Prochaines dates bientôt annoncées » · bouton « Me prévenir ». |
| Section 6 « Le Café » | `features.cafe` faux | Section masquée. |
| Bouton « Je m'inscris au prochain café » (appel final, pied de page) | `features.cafe` faux | « Découvrir les programmes » → `/programmes`. La ligne « Prochain café : … » est masquée. |
| Champ « Budget mensuel » | `features.monthlyBudgetSearch` faux | Champ « Budget » : « Peu importe », puis « Jusqu'à {n} € » pour chaque palier de `catalogue.priceBudgetSteps` → critère `priceMax`. |
| Mensualité des cartes | `features.monthlyBudgetSearch` faux, ou mensualité non calculable (CAL-031) | La carte met le **prix** en grand, à la place de la mensualité (CAT-042). |
| Lien de l'assistant (ACC-053) | `features.assistant.mode = OFF` | Lien masqué. |
| Formulaire de projection (ACC-081) | `features.projectionRequest` faux | Bloc « Simulez votre projet » : « Capacité d'emprunt, mensualité, coût total : faites le point en 2 minutes. » · boutons « Tester mon éligibilité » et « Calculer mes mensualités » (simulateurs `[P1]`). |
| Bouton « Recevoir ma projection » (appel final) | idem | « Simuler mon projet » → `/financements/simulateur-eligibilite`. |
| Bouton « Être rappelé » | `features.callbackRequest` faux | Mène à `/contact?objet=rappel` : le formulaire de contact `[P1]`, objet « Être rappelé » présélectionné. La demande est une vraie demande de rappel : même traitement, même délai, même accusé (DEM-015). |
| Mention « Des solutions de financements islamiques » (ACC-012) | `features.islamicFinance` faux | Mention masquée ; « Un crédit bancaire, une vraie garantie » reste seule. |
| Carte « FINANCEMENT ISLAMIQUE » (ACC-080) | `features.islamicFinance` faux | Carte masquée : deux cartes, centrées. Le sous-titre de la section devient « Avec des revenus perçus à l'étranger, selon la banque et le dossier. » (bloc `home.financing.subtitleNoIslamic`). |
| Phrase de l'appel final « Venez avec vos questions, repartez avec votre projection. » (ACC-086) | `features.cafe` **et** `features.projectionRequest` faux | « Simulez votre projet en 2 minutes, puis parlez-en avec un conseiller. » (bloc `home.final.textFallback`). Avec un seul des deux actif, la phrase d'origine reste : elle est encore vraie. |
| Service 06, « Présent aux Cafés, avec le banquier » (ACC-080, troisième point de la carte Expertise) | `features.cafe` faux | Ce point est masqué. |
| Trois cartes de biens | Moins de trois biens publiés | ACC-055. |
| Comparatif | Bloc désactivé par l'administrateur | Section masquée ; les deux mentions de ACC-012 restent. |

**ACC-091** `[P1]` L'état de chaque repli est décidé **par le serveur** au rendu de la page. Aucun élément n'apparaît puis disparaît après chargement.

## 10. Téléphone

**ACC-100** `[P1]` Sous 768 px :
- héros : le titre, puis la carte du Café (ou son repli), puis le comparatif, l'un sous l'autre ; les deux colonnes du comparatif restent **côte à côte**, resserrées, avec la pastille d'écart entre elles ;
- motivations : la vitrine en version téléphone, photo en haut avec ses segments de progression, texte dessous, glissement d'une motivation à l'autre (D-101) ; services et cartes de financement : de courtes rangées — numéro ou icône, titre, chevron — qui mènent chacune à sa page (D-100) ;
- barre de recherche : les trois champs empilés, « Rechercher » pleine largeur, « Filtres » en lien ;
- cartes de biens et cartes des Cafés : un défilement horizontal aimanté, une carte et demie visible, avec des points de position (des boutons de 44 px qui amènent leur carte, le point courant suit le défilement) ; chaque carte reste atteignable au clavier et au lecteur d'écran ;
- formulaire de projection : pleine largeur, avant les trois cartes de financement ;
- une barre d'action fixe en bas de l'écran apparaît après le héros : « Je m'inscris au prochain café » (ou son repli). Elle disparaît quand le formulaire de projection ou le pied de page est à l'écran.

## 11. Données et performance

**ACC-110** `[P1]` La page est servie depuis le cache et invalidée quand change : un bloc de contenu de l'accueil ; l'un des trois biens affichés ou la sélection elle-même ; un Café affiché ; un paramètre d'affichage ; le financement de référence ; un taux de change (NAV-042). Le nombre de places d'un Café est relu au plus toutes les 60 secondes.

**ACC-111** `[P1]` Les images sous la première hauteur d'écran sont chargées à l'approche. Les images de cartes réservent leur place (la hauteur de leur fenêtre, DSN-041) pour éviter tout saut de mise en page.
