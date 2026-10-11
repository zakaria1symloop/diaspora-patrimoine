# Simulateurs

Écrans **EP-11** (éligibilité) et **EP-12** (crédit). Les formules, les entrées et les sorties sont dans `01-domaine/07` (CAL-040 à CAL-112) : ce fichier décrit les écrans et les parcours.

Deux outils, deux questions :
- **Éligibilité** : « Combien puis-je emprunter, et quel budget cela me donne-t-il ? »
- **Crédit** : « Pour tel montant, quelle mensualité, quel coût, quel échéancier ? »

---

## 1. Règles communes

**SIM-001** `[P1]` Les deux simulateurs sont utilisables **sans compte**. Aucun calcul n'est fait dans le navigateur : chaque résultat vient du serveur (`01-domaine/07`).

**SIM-002** `[P1]` La mention `legal.simulatorDisclaimer` (TRV-024) est visible **en même temps** que tout résultat, sans défilement sur ordinateur. Toute mensualité porte l'astérisque de TRV-023.

**SIM-003** `[P1]` **Devise.** Une simulation a **une** devise, dans laquelle tout son résultat est affiché.
- **Éligibilité** : c'est la devise des **revenus** (`displayCurrency`, CAL-100), choisie à l'étape 2 parmi celles de PAR-025. Proposée d'office : la devise du pays de résidence saisi à l'étape 1 si elle figure dans la liste, sinon la devise de référence. Charges et apport se saisissent dans cette même devise. Le prix du bien visé a son propre sélecteur (`targetCurrency`) : par défaut la devise des revenus ; en venant d'une fiche, la devise de référence, avec le prix affiché sur la fiche.
- **Crédit** : la devise de référence par défaut, modifiable dans les options avancées (CAL-110).
- Le signe « ≈ » précède un montant **seulement s'il sort d'une conversion** (produit bancaire dans une autre devise, prix d'un bien dans une autre devise) ; un montant calculé directement dans la devise de la simulation — c'est le cas avec le barème indicatif — s'écrit sans « ≈ ». Dès qu'un montant converti est à l'écran, la ligne « Taux indicatif du {date} » y figure une fois.
- Quand un produit bancaire est dans une autre devise, le calcul se fait dans la devise du produit, puis le résultat est converti (CAL-101, CAL-110).
- Un **prix venu d'une fiche** reste lié au bien tant que le visiteur ne le modifie pas : le calcul part du prix d'origine du bien, dans sa devise, et non du prix arrondi affiché (CAL-100). La mensualité du simulateur est donc exacte, au centime ; une mensualité indicative de fiche `[P1]`, elle, est arrondie à la dizaine (CAL-022) : les deux peuvent différer de quelques unités, jamais plus.
- Le budget maximal est aussi gardé dans la devise de référence (`maxBudgetRef`) : c'est lui qui filtre le catalogue (CAT-035).

**SIM-004** `[P1]` **Vocabulaire.** Pour un financement islamique, les libellés changent (CAL-047) : « marge » au lieu de « taux » et d'« intérêts », « financement » au lieu de « crédit ». Le type islamique n'est proposé que si `features.islamicFinance` est vrai.

**SIM-005** `[P1]` **Barème indicatif.** Quand le calcul n'emploie aucun produit bancaire réel (CAL-103, PAR-043, PAR-044), un bandeau le dit : « Estimation réalisée avec un barème indicatif. Un conseiller l'affinera avec les banques partenaires. ».

**SIM-009** `[P1]` **Frais d'acquisition.** Tout résultat qui annonce un **budget** porte, sous les chiffres clés, la mention de CAL-106 : tant que les frais ne sont pas paramétrés, « Hors frais d'acquisition (notaire, droits d'enregistrement), à prévoir en plus : votre conseiller vous les précise. » (`legal.feesExcludedNote`) ; quand ils le sont, « Frais d'acquisition estimés à {pct} % du prix, inclus dans le calcul. ». Le simulateur de crédit, qui porte sur un prix et non sur un budget, ne l'affiche pas — sauf au retour d'un résultat d'éligibilité, où il dit ce que son montant comprend (SIM-031).

**SIM-006** `[P1]` **Nom des banques.** Un produit dont la banque est publique (`Bank.isPublic`) est désigné par « {banque} – {nom du produit} ». Sinon : « Solution de crédit classique n° 1 », « Solution de financement islamique n° 1 ». Les conditions détaillées d'un produit (taux, plafonds) ne sont pas listées : seul le résultat du calcul est montré.

**SIM-007** `[P1]` Les saisies sont gardées dans le stockage de session : un rechargement ou un aller-retour vers une fiche ne les efface pas. Avec des saisies en session **et** un résultat obtenu, l'adresse du simulateur rouvre directement le résultat (recalculé) — retour du catalogue, lien de l'e-mail, rechargement ; chaque ligne du récapitulatif « Votre simulation » ouvre son étape, et « Voir mon résultat » y revient. « Recommencer » vide tout.

**SIM-008** `[P1]` **Indisponibilité.** Si le calcul est impossible (aucun taux de change utilisable pour la devise choisie, service en erreur) : « Le simulateur est momentanément indisponible. Un conseiller peut faire le calcul avec vous. » et le bouton « Être rappelé ». Jamais un résultat partiel, ni des zéros affichés comme un résultat : quand il n'y a rien à financer, l'écran le dit en une phrase (SIM-022).

## 2. Simulateur d'éligibilité (EP-11)

**SIM-010** `[P1]` En tête : « Testez votre éligibilité » · « 2 minutes, sans engagement, sans compte. ». Trois étapes, avec « Étape {n} sur 3 », les boutons « Continuer » et « Retour ». Les champs, leurs bornes et leurs clés : CAL-100.

| Étape | Titre | Champs |
|---|---|---|
| 1 | Votre situation | Pays d'achat (masqué s'il n'y en a qu'un) · Votre situation (`ResidencyStatus`, avec une phrase d'aide par choix) · Pays de résidence · Année de naissance |
| 2 | Vos revenus et vos charges | Revenus nets mensuels et leur devise · bascule « J'achète à deux » → Revenus du co-emprunteur · Autres revenus réguliers (facultatif) · Mensualités de vos crédits en cours (« 0 si vous n'en avez pas ») |
| 3 | Votre projet | Apport disponible · Durée souhaitée (curseur par années ; défaut « La plus longue possible ») · Type de financement (Classique · Islamique `[P1]` · Sans préférence) · Prix du bien visé (facultatif ; prérempli en venant d'une fiche) |

**SIM-011** `[P1]` On ne passe à l'étape suivante que si l'étape en cours est valide. L'étape 3 se termine par **« Voir mon résultat »**. Aucune coordonnée n'est demandée avant le résultat.

**SIM-012** `[P1]` **Écran de résultat.** Un titre selon le statut (CAL-102), puis : « Barème indicatif », « capacité d'emprunt » et « durée retenue » portent leur « ? » (`ui.help.indicativeScale`, `ui.help.borrowingCapacity`, TRV-126).

| Bloc | Contenu |
|---|---|
| Chiffres clés | « Votre budget maximal : {budget} », avec son détail : « votre apport de {apport} + un financement de {financement} » (et « − {frais} de frais d'acquisition » quand ils sont comptés) · « Vous pouvez emprunter jusqu'à {capacité} » · « Mensualité maximale : {montant} / mois* » · « Durée retenue : {durée} », suivie de sa raison quand elle diffère de la durée souhaitée (CAL-101, contrôle 5). Tous viennent de la **même** solution, la meilleure (CAL-102). Le budget est l'apport plus le financement, moins les frais : ces chiffres s'additionnent à l'écran comme dans le calcul (CAL-026). Quand ce sont les revenus qui limitent, le financement est la capacité, à l'arrondi du budget près ; quand c'est l'apport, il lui est nettement inférieur, et le bloc suivant le dit. « ≈ » selon SIM-003. |
| Ce qui limite | Facteur `INCOME` : « C'est votre capacité de remboursement qui fixe ce budget. » — Facteur `DOWN_PAYMENT` : « C'est votre apport qui fixe ce budget : les solutions disponibles demandent au moins {`minDownPaymentPct`} % d'apport. Avec {apport conseillé}, vous atteindriez {budget}. » Dans les deux cas, une ligne de plus : « Mensualité pour ce budget : {m} / mois* » — la mensualité du financement retenu (celle que SIM-031 reprend), pour que « mensualité maximale » ne soit pas lue comme ce qu'on paiera. |
| Frais | SIM-009. |
| Solutions | « {n} solutions de crédit classique » · « {n} solutions de financement islamique » (SIM-006 pour les noms). Avec le barème indicatif : bloc absent. |
| Votre bien | Seulement si un prix est visé : SIM-013. |
| Biens à votre portée | Trois biens publiés et disponibles dont le prix (`priceFromRef`) tient dans le budget **affiché** — arrondi vers le bas, la même valeur que le filtre du catalogue (CAL-026, CAT-035, Q-054) — (pays choisi ; les trois premiers de `GET /public/properties?priceMax={budget affiché}&sort=price_asc`, du moins cher au plus cher — la route des suggestions n'est pas employée ici, D-097), et le lien « Voir les {n} biens dans mon budget » → catalogue filtré sur `maxBudgetRef` arrondi comme à l'écran (CAT-035) : le nombre annoncé est celui que le catalogue affiche. Aucun bien : bloc masqué. Sans budget à annoncer (statut `CONDITIONAL` faute d'apport) : le bloc suit le paragraphe ci-dessous. |
| Actions | SIM-032. |

**Statut `CONDITIONAL` faute d'apport** (aucune solution mobilisable en l'état, CAL-102) : il n'y a **pas** de budget maximal à annoncer, et l'écran n'affiche jamais « 0 ». Titre : « Votre projet est finançable avec un ajustement. ». Chiffres clés : « Vous pouvez emprunter jusqu'à {capacité} » · « Mensualité maximale : {montant} / mois* » · « Durée retenue : {durée} ». Puis, à la place du budget : « Il vous faut un apport : les solutions disponibles demandent au moins {pct} % du prix. Avec {apport conseillé} d'apport, votre budget atteindrait {budget}. » — trois valeurs que le calcul fournit (`minDownPaymentPct`, `advisedDownPayment`, `reachableBudget`, CAL-104) : l'écran ne recalcule rien. Le bloc « Biens à votre portée » montre alors les biens dont le prix tient dans ce budget atteignable (`reachableBudgetRef`), sous le titre « Avec cet apport, à votre portée ».

**SIM-013** `[P1]` **Avec un prix visé.**

| Cas | Texte |
|---|---|
| Finançable (`FINANCEABLE`) | « Ce bien est dans votre budget. Mensualité estimée : {montant} / mois* sur {durée}. » |
| Apport insuffisant (`DOWN_PAYMENT_SHORT`) | « Il manque {montant} d'apport pour ce bien. » |
| Mensualité trop haute (`PAYMENT_TOO_HIGH`) | « La mensualité de ce bien ({x}) dépasse votre capacité ({y}). Un apport plus élevé ou une durée plus longue peuvent le rendre finançable. » |
| Apport **et** mensualité font défaut | Les deux phrases, l'apport d'abord : « Il manque {montant} d'apport pour ce bien. Même avec cet apport, sa mensualité ({x}) dépasserait votre capacité ({y}). » — `{x}` est la mensualité du prêt **une fois l'apport complété** (CAL-101) : la phrase n'est affichée que si elle est vraie. |
| Montant trop faible (`AMOUNT_BELOW_MIN`) | « Le montant à financer pour ce bien ({x}) est en dessous du minimum des solutions disponibles. Un conseiller vous dira ce qui est possible. » |
| Sans financement (`NO_FINANCING_NEEDED`) | « Votre apport couvre le prix{ et les frais} : vous n'avez pas besoin de financement. » |

Les montants de ce bloc viennent de la solution qui finance le bien avec la mensualité la plus basse (CAL-102) ; « ≈ » selon SIM-003.

**SIM-014** `[P1]` **Statut `NOT_ELIGIBLE`.** Titre : « En l'état, nous ne trouvons pas de solution standard. Parlons-en. ». Puis les raisons, en langage simple, sans le mot « refus » :

| Raison (CAL-101) | Phrase |
|---|---|
| `RESIDENCY`, `RESIDENCE_COUNTRY`, `INCOME_CURRENCY` | « Les solutions disponibles ne couvrent pas encore votre situation. » |
| `AGE_OR_DURATION` | « La durée de financement possible est trop courte. » |
| `INCOME_TOO_LOW` | « Vos revenus sont en dessous du minimum demandé par les banques. » |
| `DEBT_RATIO` | « Vos crédits en cours laissent trop peu de marge pour une nouvelle mensualité. » |
| `AMOUNT_BELOW_MIN` | « Le montant finançable est en dessous du minimum des banques. » |

Les raisons identiques ne sont dites qu'une fois. Conclusion : « Des solutions existent souvent : un conseiller peut étudier votre situation. », le bouton « Être rappelé par un conseiller » et le bouton secondaire **« Modifier ma simulation »** (D-095) : il rouvre l'étape qui porte la raison — l'étape 2 pour `DEBT_RATIO` et `INCOME_TOO_LOW` (ajouter le co-emprunteur, corriger les charges), l'étape 3 pour `AGE_OR_DURATION` et `AMOUNT_BELOW_MIN`, l'étape 1 sinon — avec le récapitulatif « Votre simulation » conservé. Pas de cul-de-sac pour qui ne veut pas encore être appelé. La raison `RATE_MISSING` n'est jamais montrée : un produit qui la porte est ignoré ; si tous la portent, SIM-008.

**SIM-015** `[P1]` À l'arrivée sur l'écran de résultat, la simulation est enregistrée de façon anonyme (CAL-112) et le cookie `dp_anon` est déposé s'il ne l'est pas (NAV-051). C'est ce qui permet au catalogue d'afficher le budget estimé (CAT-035).

## 3. Simulateur de crédit (EP-12)

**SIM-020** `[P1]` Une page, deux zones : les **réglages** à gauche (en haut sur téléphone), le **résultat** à droite, recalculé à chaque changement (CAL-112). Sur téléphone, une barre collante en bas montre « {mensualité} / mois* » tant que le résultat n'est pas à l'écran (même mécanisme que CAF-061) : on n'a pas à redescendre après chaque curseur. Entrées et bornes : CAL-110.

| Réglage | Saisie |
|---|---|
| Point de départ | « Je connais le prix du bien » (défaut) · « Je connais le montant à financer » |
| Prix du bien · Apport | Deux montants ; l'apport se règle aussi en pourcentage, les deux restent synchronisés. Le montant à financer s'affiche, calculé. |
| Montant à financer | Seul champ dans le second mode. |
| Durée | Curseur par années, doublé d'un champ ; bornes du produit choisi, sinon 1 à 40 ans. Valeur de départ : la durée du barème indicatif (PAR-044). `[P1]` En venant d'une fiche qui affiche une mensualité indicative : celle du financement de référence (SIM-030). |
| Solution de financement | « Barème indicatif » (défaut), puis les produits utilisables et publics (SIM-006). |
| Taux annuel (ou marge) | Modifiable seulement avec « Barème indicatif » : curseur de 0 à 15 %, par pas de 0,05, doublé d'un champ qui accepte jusqu'à 30 %. Valeur de départ : le taux du **barème indicatif** (PAR-044). `[P1]` En venant d'une fiche qui affiche une mensualité indicative : celui du financement de référence, pour retrouver cette mensualité (SIM-030). À 0 %, une ligne le signale sous le champ : « À 0 %, le financement ne coûte rien : c'est une hypothèse d'exemple. Réglez le taux pour une estimation réaliste. ». Avec un produit : affiché (selon la durée, CAL-048), non modifiable. |
| Type | Avec « Barème indicatif » : Crédit classique · Financement islamique `[P1]`. Détermine la méthode de calcul (D-021). |
| Options avancées (repliées) | Assurance (taux annuel, facultatif) · Devise. |

**SIM-021** `[P1]` **Résultat.**
- en grand : « {mensualité} / mois* » (hors assurance) ; dessous, si une assurance est saisie : « {total} / mois assurance comprise » ;
- « Montant financé » · « Coût du crédit » (intérêts, ou marge) · « Assurance » · « Frais de dossier » (si le produit en a), suivis de ses autres frais en clair s'il en indique (`BankProduct.otherFeesNote`) · « Coût total » · « Total remboursé » ;
- un graphique simple : la part du capital et la part du coût dans le total ;
- l'**échéancier** : un tableau par année (échéances, capital, intérêts ou marge, assurance, capital restant dû) ; chaque année se déplie en ses douze mois (CAL-043).

Les montants du détail ont deux décimales (CAL-025). **Adresse** : le simulateur accepte `montant`, `duree`, `mois`, `taux`, `devise`, `produit`, `methode` (SIM-031) ; `duree` se lit en années jusqu'à 40, en mois au-delà (le calcul express d'EP-10 l'envoie en années), `mois` est toujours un nombre de mois (D-097).

**SIM-022** `[P1]` **Avertissements**, sous le réglage concerné, sans bloquer le calcul :

| Cas | Message |
|---|---|
| Apport supérieur ou égal au prix | « L'apport couvre le prix : aucun financement n'est nécessaire. » La zone de résultat affiche cette phrase **à la place** des chiffres (`nothingToFinance`, CAL-110) : ni mensualité, ni échéancier, ni zéros. |
| Montant hors des bornes du produit | « Cette solution finance entre {min} et {max}. » |
| Durée hors des bornes du produit | « Cette solution porte sur {min} à {max}. » La durée est ramenée à la borne. |
| Apport sous le minimum du produit — sans produit choisi, sous celui du barème indicatif (`minDownPaymentPct`, PAR-044, Q-053) | « Cette solution demande au moins {pct} % d'apport, soit {montant}. » |

**SIM-023** `[P1]` **Comparer des scénarios** (CAL-111). « Comparer un autre scénario » copie le scénario en cours dans une nouvelle colonne ; trois colonnes au plus. Chaque colonne rappelle son apport, sa durée, son taux, et donne sa mensualité, son coût total, son total remboursé. La mensualité la plus basse et le coût total le plus bas sont marqués. Cliquer une colonne la rend modifiable ; une croix la supprime. Sur téléphone : les colonnes défilent horizontalement.

## 4. Préremplir, garder, donner suite

**SIM-030** `[P1]` **Depuis une fiche** (« Ajuster la simulation », FIC-051) : le simulateur de crédit s'ouvre avec le bien en rappel (vignette, titre, prix) et le prix **affiché sur la fiche**. La fiche montre sa mensualité indicative (FIC-051, D-089) : l'apport, la durée et le taux sont ceux du financement de référence (PAR-041, CAL-030), et la mensualité de départ est celle de la fiche, à son arrondi près (CAL-022 : 810,25 € au centime pour « 810 € / mois » sur la fiche) — le résultat s'affiche donc dès l'ouverture, et tout se règle. L'adresse porte la référence du bien (`?bien={référence}`). Si ce bien n'existe plus : le simulateur s'ouvre vide, sans message d'erreur.

**SIM-031** `[P1]` **D'un simulateur à l'autre.** Du résultat d'éligibilité, « Calculer mes mensualités » ouvre le simulateur de crédit sur le **montant à financer** du résultat (mode « Je connais le montant à financer ») — celui du bien visé, à défaut celui du budget maximal tel qu'il est affiché (CAL-026) —, avec la durée retenue, **la solution du résultat** (le produit qui finance le bien visé, à défaut la meilleure solution ; avec le barème indicatif, son taux), la devise de la simulation et, s'il y en a un, le bien en rappel. Sous le montant, une ligne dit d'où il vient — « Prix {prix} + frais d'acquisition {frais} − apport {apport} » ; sans bien visé, « Budget {budget} + frais d'acquisition {frais} − apport {apport} » ; sans les frais quand ils ne sont pas comptés (CAL-106) — ; elle disparaît dès que le visiteur change le montant ou le mode. S'il passe au mode « Je connais le prix du bien », le prix (ou le budget) et l'apport du résultat y sont repris, et le montant redevient prix − apport : ce mode ne compte pas de frais d'acquisition, et une ligne le dit quand ils sont paramétrés — « Hors frais d'acquisition. ». Avec un bien visé **finançable**, la mensualité qu'il y lit est celle du résultat qu'il quitte ; s'il ne l'est pas, c'est celle du bien avec l'apport saisi — ce qu'il coûterait tel quel — : ce qui manque, apport ou revenus, a été dit par le résultat qu'il quitte (SIM-013) ; sans bien visé, c'est celle du financement de son budget maximal — au plus sa mensualité maximale, moins quand c'est l'apport qui limite. Sans prix visé ni budget à annoncer, ou quand l'apport couvre le bien, le bouton n'est pas proposé. Du simulateur de crédit, « Tester mon éligibilité » ouvre l'étape 1 avec le prix comme bien visé.

**SIM-032** `[P1]` **Actions sur un résultat.**

| Action | Visiteur sans compte | Client connecté |
|---|---|---|
| **Être rappelé par un conseiller** | Formulaire DEM-016, déplié sous les actions. À l'envoi, la confirmation DEM-023 **remplace** le formulaire déplié, le résultat restant à l'écran (état « rappel envoyé »). | Idem, coordonnées déjà connues. |
| **Recevoir par e-mail** | L'e-mail part pendant la requête, sans passer par la boîte d'envoi : c'est ce qui permet de ne garder l'adresse que sur la ligne de l'e-mail (D-097). Demande l'adresse e-mail — « la vôtre, ou celle d'un proche » —, avec la mention « Nous utilisons cette adresse pour envoyer cette simulation, rien d'autre. » → e-mail `C_SIMULATION_RESULT` avec le PDF. La promesse est tenue : la simulation est écrite **sans nom** pour produire le PDF, **aucune fiche n'est créée**, l'adresse n'est gardée que dans la ligne de cet e-mail, et le tout est purgé après 30 jours (CAL-112, AUT-091, SEC-091). Trois envois au plus par adresse et par jour. | Son adresse est préremplie, modifiable. Pour garder la simulation dans « Mes simulations », il clique « Enregistrer ». |
| **Enregistrer** | La simulation — éligibilité ou crédit, scénarios compris — est écrite **tout de suite**, sans nom, puis : « Créez votre espace pour la retrouver » → inscription ou connexion (`/inscription?simulation={id}`, `/connexion?simulation={id}`). Son identifiant voyage avec le parcours (dans le lien de vérification de l'adresse, `AuthToken.payload` ; pour quelqu'un qui a déjà un espace et se connecte, dans le champ `simulationId` de la connexion (AUTH-020) — elle lui est rattachée à la connexion, MOD-371) : même si le lien est ouvert dans un autre onglet ou sur un autre appareil, la simulation est rattachée au compte dès qu'il est vérifié, et le client arrive sur « Mes simulations », la simulation ouverte. Rien ne dépend du stockage de l'onglet d'origine. | Enregistrée dans « Mes simulations » (SFA-010), avec un nom modifiable. S'il a un dossier ouvert, la simulation y est **rattachée** (`Simulation.dossierId`) : son conseiller la voit dans le dossier. |
| **Télécharger (PDF)** | Téléchargement direct, sans rien enregistrer. | Idem. |
| Voir les biens dans mon budget | Catalogue filtré. | Idem. |

**Routes** (API-100). Une simulation d'éligibilité est écrite dès l'écran de résultat (SIM-015) : `POST /public/simulations/eligibility` rend son `id`. Une simulation de crédit n'est écrite qu'à la demande, par `POST /public/simulations`, scénarios compris, avec `isSaved = true` pour « Enregistrer », `false` pour « Recevoir par e-mail » et « Être rappelé ». « Enregistrer » un résultat d'éligibilité, déjà écrit, le marque seulement (`POST /public/simulations/{id}/save`). L'`id` est ensuite passé à l'e-mail (`POST /public/simulations/{id}/email`), à l'inscription (champ `simulationId`, gardé dans `AuthToken.payload`), à la connexion (champ `simulationId`, AUTH-020) ou à la demande (`Lead.simulationId`, DEM-016). « Télécharger (PDF) » n'écrit rien (`POST /public/simulations/pdf`).

**SIM-033** `[P1]` **Client connecté** : l'étape 1 et 2 de l'éligibilité sont préremplies avec ce que sa fiche contient (situation, pays, année de naissance, revenus, charges, apport) — `GET /client/simulations/prefill`. À la fin, une case **non cochée** propose : « Mettre à jour mon profil avec ces informations » (`POST /client/simulations/{id}/profile`). Sans cette case, la fiche n'est pas modifiée. La mise à jour n'écrit jamais une **date** de naissance à partir d'une année : une date connue reste, une date absente le reste (D-097). Une simulation d'éligibilité d'un client connecté porte son `clientId` dès sa création, sans être « enregistrée » (`isSaved` faux) ; le budget estimé du catalogue est alors lu sur son compte (CAT-035). À la trente et unième simulation enregistrée : SFA-012 (`SIMULATIONS_LIMIT`). Les envois des simulateurs portent l'en-tête anti-falsification dès qu'un cookie de session existe (SEC-027).

**SIM-034** `[P1]` Quand un visiteur crée un compte, ou envoie une demande depuis une simulation (« Être rappelé », `SIMULATION_FOLLOWUP`), ses simulations anonymes (même `dp_anon`) sont rattachées à sa fiche ; une autre demande ne les emporte pas (Q-062). Quand il se connecte à un espace qui existe déjà, seule celle qu'il vient de demander à enregistrer l'est (MOD-371).

**SIM-040** `[P1]` **PDF d'une simulation** (TRV-142) : la date, les réglages, le résultat, l'échéancier par année, les scénarios comparés s'il y en a, le rappel du bien s'il y en a un, les mentions TRV-023 et TRV-024, la mention des frais d'acquisition pour un résultat d'éligibilité (SIM-009), « barème indicatif » s'il a servi, et les coordonnées de contact. Une à trois pages. En tête, le nom d'usage de la société, en texte : le logo vectoriel ne se dessine pas dans le PDF ; le signe « ≈ » est écrit avec une police de symboles (D-097). Le PDF garde les valeurs exactes du calcul ; c'est l'écran qui arrondit la capacité d'emprunt et le budget atteignable selon CAL-026 (« ≈ 154 000 € », « ≈ 192 000 € »).

## 5. Accessibilité

**SIM-050** `[P1]` Chaque curseur est doublé d'un champ numérique et se règle au clavier. Le résultat recalculé est annoncé aux lecteurs d'écran de façon discrète, une fois la saisie stabilisée. L'échéancier est un vrai tableau, avec ses en-têtes. Le graphique a un équivalent textuel.
