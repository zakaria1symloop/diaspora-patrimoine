# Spécifications — Plateforme Diaspora Patrimoine

> **Version 1.5 — 9 octobre 2026.** Rédigées par SYMLOOP.
> Ce dossier est la **référence unique** pour construire la plateforme : le code (NestJS, Next.js, Flutter) se développe à partir d'ici, les maquettes Figma servent à faire valider les écrans par la cliente.
> Quand une maquette et une spec se contredisent sur un **comportement**, la spec gagne. Sur un **visuel**, la maquette validée gagne.

---

## 1. À quoi sert ce dossier

La plateforme accompagne la diaspora dans l'achat d'un bien immobilier neuf en Afrique (Algérie d'abord), de la découverte du bien jusqu'au financement et à l'acte. Quatre acteurs : le **client** (acquéreur), l'**administrateur** Diaspora Patrimoine (pivot), le **promoteur** et la **banque**.

Ces spécifications décrivent **tout le produit**, de A à Z : chaque écran, chaque règle, chaque cas limite, chaque message, chaque calcul. Elles couvrent toutes les phases (site public, espace client, back-office, portails promoteur et banque, application mobile, IA). Chaque exigence porte une **étiquette de phase** pour savoir ce qui se construit maintenant et ce qui vient plus tard.

## 2. Comment lire

| Si vous cherchez… | Lisez |
|---|---|
| ce que fait le produit et ce qui est dans le contrat | `00-cadre/01-vision-perimetre-phases.md` |
| qui a le droit de faire quoi | `00-cadre/02-acteurs-roles-permissions.md` |
| le sens d'un mot métier ou d'un identifiant | `00-cadre/03-glossaire.md` |
| une règle valable partout (formats, erreurs, états d'écran) | `00-cadre/04-regles-transverses.md` |
| pourquoi un choix a été fait, ou ce qui reste à confirmer | `00-cadre/05-decisions-et-questions.md` |
| ce qu'un promoteur ou une banque fait lui-même, et à quel niveau d'accès | `00-cadre/06-acces-des-partenaires.md` |
| une table, un champ, un statut | `01-domaine/` |
| le comportement d'un écran | `02-site-public/`, `03-espace-client/`, `04-back-office/` |
| les phases suivantes | `05-phases-ulterieures/` |
| l'architecture, l'API, la sécurité, les tests | `06-technique/` |
| le design et la liste des écrans à maquetter | `07-design/` |
| le lien avec le contrat, l'ordre de construction et les **cinq livraisons** | `08-tracabilite/` |
| ce que l'audit de la version 1.2 a trouvé, et comment chaque point a été réglé | `08-tracabilite/03-audit-et-corrections.md` |
| ce que l'audit de codabilité de la version 1.3 a trouvé, la Phase 1 simplifiée, et ce qui reste à fournir avant de coder | `08-tracabilite/04-audit-de-codabilite.md` |

Ordre de lecture conseillé pour un nouveau venu : `00-cadre` (dans l'ordre), puis `01-domaine/01`, `01-domaine/06`, puis le module qui vous concerne.

## 3. Sommaire

```
Specs/
├── README.md
├── 00-cadre/
│   ├── 01-vision-perimetre-phases.md
│   ├── 02-acteurs-roles-permissions.md
│   ├── 03-glossaire.md
│   ├── 04-regles-transverses.md
│   ├── 05-decisions-et-questions.md
│   └── 06-acces-des-partenaires.md
├── 01-domaine/
│   ├── 01-modele-conventions-et-vue-d-ensemble.md
│   ├── 02-modele-identite-referentiels-partenaires.md
│   ├── 03-modele-catalogue.md
│   ├── 04-modele-crm-dossiers-pieces-financement.md
│   ├── 05-modele-communication-evenements-contenus-plateforme.md
│   ├── 06-cycles-de-vie.md
│   ├── 07-regles-de-calcul.md
│   ├── 08-automatisations.md
│   ├── 09-notifications-et-emails.md
│   └── 10-parametres-et-donnees-de-reference.md
├── 02-site-public/
│   ├── 01-structure-navigation-seo.md
│   ├── 02-accueil.md
│   ├── 03-catalogue.md
│   ├── 04-fiches-programme-et-bien.md
│   ├── 05-demandes.md
│   ├── 06-simulateurs.md
│   ├── 07-le-cafe.md
│   ├── 08-pages-editoriales.md
│   └── 09-assistant-de-recherche.md
├── 03-espace-client/
│   ├── 01-compte-et-authentification.md
│   ├── 02-tableau-de-bord-et-suivi.md
│   ├── 03-interets-propositions-visites.md
│   ├── 04-dossier-et-pieces.md
│   ├── 05-messagerie-et-notifications.md
│   ├── 06-simulations-favoris-alertes-cafes.md
│   └── 07-profil-confidentialite-feedback.md
├── 04-back-office/
│   ├── 01-socle.md
│   ├── 02-tableau-de-bord-et-rapports.md
│   ├── 03-demandes-et-crm.md
│   ├── 04-catalogue.md
│   ├── 05-banques-et-financement.md
│   ├── 06-dossiers-et-pipeline.md
│   ├── 07-ged.md
│   ├── 08-communication.md
│   ├── 09-taches-et-rendez-vous.md
│   ├── 10-cafes.md
│   ├── 11-feedback-et-enquetes.md
│   ├── 12-contenus-et-seo.md
│   └── 13-administration.md
├── 05-phases-ulterieures/
│   ├── 01-portail-promoteur.md
│   ├── 02-portail-banque.md
│   ├── 03-application-mobile.md
│   └── 04-intelligence-artificielle.md
├── 06-technique/
│   ├── 01-architecture.md
│   ├── 02-api.md
│   ├── 03-securite-et-conformite.md
│   ├── 04-fiabilite-des-donnees.md
│   ├── 05-fichiers-et-medias.md
│   ├── 06-qualite-tests-recette.md
│   └── 07-environnements-et-deploiement.md
├── 07-design/
│   ├── 01-systeme-de-design.md
│   ├── 02-inventaire-des-ecrans.md
│   └── 03-microcopie.md
├── 08-tracabilite/
│   ├── 01-matrice-contrat-specs.md
│   ├── 02-plan-de-realisation.md
│   ├── 03-audit-et-corrections.md
│   └── 04-audit-de-codabilite.md
└── _outils/
    └── verifier_specs.py
```

En chiffres, à la version 1.5 : 64 fichiers, 1 534 règles identifiées, 97 décisions, 101 questions ouvertes (chacune avec sa valeur par défaut), 120 modèles d'e-mail, 133 écrans, 45 parcours de recette, 5 livraisons.

`_outils/verifier_specs.py` contrôle la cohérence du dossier, en douze points (QUA-025) : chaque règle, décision, question, modèle d'e-mail, règle d'automatisation, notification, écran, champ, permission, paramètre, événement, bloc de contenu, valeur d'énumération, parcours de recette ou indicateur cité quelque part doit exister ; chaque statut a son ton ; chaque écran a sa page et sa livraison ; et les chiffres ci-dessus sont ceux du dossier. À lancer après toute modification des specs : `python Specs/_outils/verifier_specs.py` — il doit finir par « Tout est cohérent. ».

## 4. Conventions d'écriture

### 4.1 Identifiants de règles

Chaque exigence testable porte un identifiant **stable** : un préfixe de module et un numéro, par exemple `CAT-012`. On ne renumérote jamais. Une règle supprimée garde son numéro avec la mention « supprimée ». Le code, les tests et les messages de commit citent ces identifiants.

| Préfixe | Domaine | Fichier |
|---|---|---|
| `ROL` | rôles et permissions | `00-cadre/02` |
| `TRV` | règles transverses | `00-cadre/04` |
| `ACP` | accès des promoteurs et des banques : trois niveaux, un seul chemin | `00-cadre/06` |
| `MOD` | contraintes du modèle de données | `01-domaine/01` à `05` |
| `CYC` | cycles de vie (statuts, transitions) | `01-domaine/06` |
| `CAL` | calculs | `01-domaine/07` |
| `AUT` | automatisations et tâches planifiées | `01-domaine/08` |
| `NOT` | notifications et e-mails | `01-domaine/09` |
| `PAR` | paramètres et référentiels | `01-domaine/10` |
| `NAV` | navigation, SEO, cookies | `02-site-public/01` |
| `ACC` | page d'accueil | `02-site-public/02` |
| `CAT` | catalogue | `02-site-public/03` |
| `FIC` | fiches programme et bien | `02-site-public/04` |
| `DEM` | demandes (formulaires publics) | `02-site-public/05` |
| `SIM` | simulateurs | `02-site-public/06` |
| `CAF` | Le Café (côté public) | `02-site-public/07` |
| `EDI` | pages éditoriales | `02-site-public/08` |
| `ASS` | assistant de recherche | `02-site-public/09` |
| `AUTH` | compte et authentification | `03-espace-client/01` |
| `ECL` | tableau de bord client | `03-espace-client/02` |
| `INT` | intérêts, propositions, visites | `03-espace-client/03` |
| `DOS` | dossier et pièces (côté client) | `03-espace-client/04` |
| `MSG` | messagerie et notifications | `03-espace-client/05` |
| `SFA` | simulations, favoris, alertes, cafés | `03-espace-client/06` |
| `PRO` | profil, confidentialité, feedback | `03-espace-client/07` |
| `BO` | socle du back-office | `04-back-office/01` |
| `TDB` | tableau de bord et rapports | `04-back-office/02` |
| `CRM` | demandes et CRM | `04-back-office/03` |
| `CTL` | catalogue (gestion) | `04-back-office/04` |
| `BNK` | banques et financement | `04-back-office/05` |
| `PIP` | dossiers et pipeline | `04-back-office/06` |
| `GED` | gestion des pièces | `04-back-office/07` |
| `COM` | communication | `04-back-office/08` |
| `TAC` | tâches et rendez-vous | `04-back-office/09` |
| `EVT` | Le Café (gestion) | `04-back-office/10` |
| `FBK` | feedback et enquêtes | `04-back-office/11` |
| `CMS` | contenus et SEO | `04-back-office/12` |
| `ADM` | administration | `04-back-office/13` |
| `PPR` | portail promoteur | `05-phases-ulterieures/01` |
| `PBQ` | portail banque | `05-phases-ulterieures/02` |
| `MOB` | application mobile | `05-phases-ulterieures/03` |
| `IA` | intelligence artificielle | `05-phases-ulterieures/04` |
| `ARC` | architecture | `06-technique/01` |
| `API` | conventions d'API | `06-technique/02` |
| `SEC` | sécurité et conformité | `06-technique/03` |
| `FIA` | fiabilité des données | `06-technique/04` |
| `MED` | fichiers et médias | `06-technique/05` |
| `QUA` | qualité, tests, recette | `06-technique/06` |
| `ENV` | environnements et déploiement | `06-technique/07` |
| `DSN` | système de design | `07-design/01` |

Les écrans portent un identifiant à part : `EP-nn` (site public), `EC-nn` (espace client), `EA-nn` (back-office). Liste complète dans `07-design/02-inventaire-des-ecrans.md`.

### 4.2 Étiquettes de phase

Chaque règle ou section porte une étiquette entre crochets.

| Étiquette | Sens |
|---|---|
| `[P1]` | Dans le contrat de la Phase 1 (offre technique SYM-OT-DP-2026-06). À construire maintenant. |
| `[P1]` | **Plus employée depuis le 7 octobre 2026 (D-089).** Elle marquait les fonctions ajoutées après la signature ; toutes sont intégrées à la Phase 1 et portent `[P1]`. Liste et origine : `00-cadre/01`, section 6. |
| `[P2]` | Accès des promoteurs au-delà du niveau 1 : réponse par lien (niveau 2), puis portail (niveau 3) — `00-cadre/06`. |
| `[P3]` | Accès des banques au-delà du niveau 1 : réponse par lien, puis portail. |
| `[MOB]` | Application mobile Flutter. |
| `[IA]` | Fonctions d'intelligence artificielle. |
| `[V2]` | Amélioration souhaitable, sans date. |

Une règle sans étiquette hérite de l'étiquette de sa section.

### 4.3 Décisions et questions

- `D-nnn` : une **décision** prise, avec sa raison. Elle s'applique.
- `Q-nnn` : une **question ouverte** pour la cliente ou pour SYMLOOP. Chaque question porte une **valeur par défaut** : c'est elle que le code applique tant que la réponse n'est pas arrivée. Aucun comportement ne reste donc indéfini.

Les deux registres sont dans `00-cadre/05-decisions-et-questions.md`.

### 4.4 Mots normatifs

- **doit** : obligatoire.
- **ne doit pas** : interdit.
- **peut** : autorisé, facultatif.
- **par défaut** : valeur initiale d'un paramètre modifiable dans le back-office.

### 4.5 Langue et nommage

- Les specs sont écrites en **français**.
- Les identifiants techniques sont en **anglais** : tables, champs, énumérations, routes d'API, noms de composants, clés de paramètres. Exemple : la table `Dossier`, le champ `stage`, la valeur `BANK_REVIEW`.
- Les **adresses publiques** du site et tous les textes d'interface sont en français (puis en arabe et en anglais quand ces langues seront ouvertes).
- Le texte exact d'un écran est donné dans le fichier de son module, entre guillemets « » : il fait foi. `07-design/03-microcopie.md` fixe la façon d'écrire, le nommage des clés, les textes communs et les messages d'erreur.

## 5. Guide pour l'agent de développement (Claude Code)

Ces règles s'appliquent à toute session de développement sur ce projet.

1. **Lire avant de coder.** Pour une fonctionnalité, lire dans l'ordre : le fichier du module, `00-cadre/04-regles-transverses.md`, les entités concernées dans `01-domaine/`, puis `06-technique/01` et `06-technique/02`. Garder sous la main, pour chaque paquet : `07-design/03-microcopie.md` (clés et textes communs, messages d'erreur), `01-domaine/01` § 3 (énumérations et leurs libellés), `00-cadre/05` (décisions, et la valeur par défaut de chaque question ouverte), `01-domaine/10` (paramètres).
2. **Ne jamais inventer un comportement.** Si une situation n'est pas décrite : chercher dans les règles transverses, puis dans le registre des décisions et questions. Si elle n'y est toujours pas, **ajouter une question `Q-nnn`** dans `00-cadre/05` avec une valeur par défaut prudente, l'appliquer, et la signaler dans le compte rendu de la session. Ne pas trancher en silence.
3. **Rester dans la phase demandée.** Ne construire que les règles de l'étiquette en cours (`[P1]` par défaut). Le modèle de données prévoit dès maintenant les champs des phases suivantes quand la spec le dit ; les écrans et les routes des phases suivantes ne se construisent pas d'avance.
4. **Citer les règles.** Chaque test porte le ou les identifiants qu'il vérifie (`CAT-012`). Chaque message de commit cite les règles implémentées.
5. **Aucun paramètre métier en dur.** Délais, seuils, taux, textes légaux, listes de pièces : tout vient des paramètres (`01-domaine/10`) ou des tables de référence — seuls font exception les garde-fous fixes de PAR-102, qui sont des constantes du code. Le code ne contient que les valeurs par défaut des données de départ.
6. **Aucun texte en dur.** Tout texte visible passe par les fichiers de traduction, selon les règles de `07-design/03-microcopie.md`. Les textes que l'administrateur peut changer sont des blocs de contenu (CMS-020) ou des modèles d'e-mail (`01-domaine/09`), jamais du code.
7. **Ne pas perdre de données.** Appliquer `06-technique/04-fiabilite-des-donnees.md` : transactions, verrouillage optimiste, boîte d'envoi transactionnelle, idempotence des formulaires, suppression logique.
8. **Mettre les specs à jour.** Si une décision change en cours de route, la spec est modifiée dans le même commit que le code, et la ligne de la version en cours du journal ci-dessous (§ 8) le dit (« 1.5 – en cours »). Le contrôle de cohérence (`_outils/verifier_specs.py`) doit rester vert.
9. **Design.** Les écrans suivent `07-design/01-systeme-de-design.md` et les maquettes Figma listées dans `07-design/02-inventaire-des-ecrans.md`. Un écran sans maquette validée se construit avec les composants du système de design, sans inventer de nouveau style.
10. **Suivre le plan.** L'ordre de construction et le découpage en paquets de travail sont dans `08-tracabilite/02-plan-de-realisation.md`. Un paquet par session.
11. **Livrer par étapes.** Le projet se livre en cinq livraisons d'environ 20 % (D-006). Chacune doit fonctionner seule, de bout en bout : on ne commence pas la suivante avant d'avoir clos la précédente (QUA-074), et aucun écran ne mène à une fonction qui n'est pas encore livrée.
12. **Un geste de partenaire, une commande.** Tout ce qu'un promoteur ou une banque « dit » — confirmer une option, donner une décision, déclarer un lot vendu — est une commande unique de l'API, qui porte tous ses contrôles et tous ses effets (ARC-014). En Phase 1, seul le back-office l'appelle ; aucune règle métier ne s'écrit dans un écran. C'est tout ce qu'il faut pour ouvrir plus tard les niveaux 2 et 3 sans rien refaire — et il ne faut rien construire d'autre pour eux en Phase 1 (`00-cadre/06`, ACP-070).

## 6. Hiérarchie des sources

1. **Contrat** de prestation et ses annexes (offre technique, offre financière) — documents contractuels conservés hors du dépôt de code (`Legal/` et `Strategie/` ne sont pas versionnés). Pour le **périmètre**, l'offre technique prévaut (contrat, article 2).
2. **Procès-verbaux** d'atelier signés.
3. **Ces spécifications**, qui détaillent le contrat et les décisions prises depuis.
4. **Maquettes Figma validées** par la cliente, pour le visuel. Pour les lire et pour coder à partir d'elles : `Design/guide-de-construction.md` (organisation du fichier, composants, ce que les maquettes ne montrent pas) et `Design/donnees-de-reference.md` (les chiffres et noms d'exemple, les mêmes partout, futurs jeux de données de test).
5. Les documents de vision (accessibilité et UX, guide des visites 360°, argumentaire commercial) : ils inspirent le produit cible mais **n'engagent pas** la Phase 1.

Les phases sont des **acteurs**, pas des fonctions retenues (D-089) : la Phase 1 construit tout ce qui sert au client et à l'équipe, chaque page avec toutes ses fonctions ; une section dont la donnée manque ne s'affiche pas. Les fonctions ajoutées depuis la signature sont listées dans `00-cadre/01`, section 6.

## 7. Sources utilisées pour la version 1.0

| Source | Emplacement |
|---|---|
| Offre technique SYM-OT-DP-2026-06 (7 juin 2026) | `Legal/Offre_Technique_DIASPORA_PATRIMOINE (2).pdf` |
| Offre financière SYM-OF-DP-2026-06 | `Legal/Offre_Financiere_DIASPORA_PATRIMOINE(Updated).pdf` |
| Contrat de prestation, Phase 1 | `Legal/Contrat_Prestation_SYMLOOP_DIASPORA_PATRIMOINE.pdf` |
| Accessibilité et expérience utilisateur (vision) | `Legal/Accessibilite_UX_DIASPORA_PATRIMOINE.pdf` |
| Guide promoteur, visites 360° (vision) | `Legal/Guide_Promoteur_Visites360_DIASPORA_PATRIMOINE.pdf` |
| PV de l'atelier de cadrage n° 2 (31 août 2026) | `Legal/PV_Atelier_31-08-2026_DIASPORA_PATRIMOINE.pdf` |
| Analyse « pourquoi la diaspora achète » | `Strategie/pourquoi-la-diaspora-achete.md` |
| Argumentaire commercial et maquette de Mme Mouhoubi (27/09/2026) | `Strategie/argumentaire-commercial-mme-mouhoubi.md` |
| Maquette d'accueil retenue par Mme Mouhoubi le 01/10/2026 | Figma, fichier `H7XVzqkkeUViNnecDdCrdG`, cadre `290:102` |
| Brouillon du modèle de données (août 2026) | `Dev/db/schema.prisma` — **remplacé** par `01-domaine/` |
| Règles de complétude de la fiche bien (août 2026) | reprises dans `02-site-public/04` et `04-back-office/04` |
| Réponses saisies dans l'assistant projet le 06/09/2026 | reprises comme valeurs par défaut, voir `00-cadre/05` |

Le « business model » transmis par Diaspora Patrimoine (cité dans le PV du 31 août) n'est pas dans le dossier du projet. Les points qui en dépendent sont des questions ouvertes (`Q-001` à `Q-004`).

## 8. Journal des versions

| Version | Date | Changement |
|---|---|---|
| 1.0 | 01/10/2026 | Première version complète. Remplace les spécifications éparses (FigJam, pages « Specs » de Figma, brouillon Prisma). |
| 1.1 | 01/10/2026 | **Livraison par étapes** (D-006) : cinq livraisons d'environ 20 %, chacune utilisable seule — plan réécrit (`08-tracabilite/02`), QUA-074, ENV-054, NAV-064, Q-044 ; paquets 1.9, 2.10 et 2.11 ajoutés ; une livraison par écran dans l'inventaire. **Système de design** aligné sur la bibliothèque Figma : jetons ajoutés à DSN-010 et DSN-021, couleur des icônes par mode (DSN-040), états des boutons (DSN-051), état de la bibliothèque (DSN-052), accueil validé mis au propre (DSN-102). |
| 1.2 | 03/10/2026 | **Audit de bout en bout** (`08-tracabilite/03`) : 206 constats relevés par neuf lectures indépendantes, des recoupements mécaniques et une vérification chiffrée ; tous traités, puis relus en trois passes contre le texte corrigé. Vingt et une décisions (D-060 à D-079, D-085) : l'argent (cours, capacité, budget, frais, acompte, offre de banque), la livraison par étapes (moteur d'automatisation au socle, textes légaux provisoires, porte d'accès, horloge de recette, ouverture au public à la livraison 5), le compte du client, les pièces et les banques, les notifications (une opération, une notification), le catalogue, la sécurité et l'effacement. **Accès des promoteurs et des banques en trois niveaux, sur un seul chemin** (`00-cadre/06`, ACP-001 à ACP-073, D-080 à D-084) : la Phase 1 est le niveau 1, et garde trois informations pour que les suivants ne soient que des ajouts. Inventaire des écrans recompté. Outil de contrôle porté à douze points (QUA-025). Le même jour, premières maquettes au-delà de l'accueil : page `Draft` du fichier Figma, onze écrans à valider (`07-design/02`, § 1) ; trois précisions de mise en page en découlent (FIC-001, CAT-042, DSN-052). |
| 1.5 | 08/10/2026 | **Inscription des partenaires et scènes illustrées** : promoteurs et banques s'inscrivent sur leur propre porte, avec un compte dès l'inscription en deux étapes, puis un dossier à compléter depuis l'espace partenaire avant l'examen par l'équipe — candidature dans le modèle (`Lead.applicationStatus`, `LeadFile`), charte des partenaires, événements et règle d'examen, routes `/partner` (D-091, ACP-080 à ACP-086, EP-32, EP-33, cinq modèles d'e-mail) ; « Devenir partenaire » reste celle des notaires, assureurs, institutions et médias ; les pages à une seule tâche portent une scène dessinée qui s'anime une fois (D-092, DSN-076) ; la page Financements devient vivante : calcul express, sélecteur de solutions, frise du parcours, moins de cartes et de texte (D-093, EDI-023) ; **la logique, c'est le comportement du visiteur** : quarante corrections issues d'une relecture page par page — entrée « Les biens », favoris sans compte, brouillon des filtres gardé, fiche qui se souvient d'une demande, un seul élément fixe sur téléphone, éligibilité explicable et modifiable, alerte non confirmée relancée, jeton de préférences sans expiration… (D-095). **Cohérence avant développement** (09/10/2026, D-096) : relecture croisée des specs, des maquettes et des données de référence — financement de référence de départ à 6,50 % au lieu de 0 % (810 € pour 150 000 €), lot B-304 à 22 275 000 DA, échéancier d'exemple conforme à CAL-043, fiche, simulateur et calcul express qui se retrouvent ; « Les biens » partout dans la navigation ; charte des partenaires provisoire ; délais, messages d'erreur et stockages alignés ; assistant conversationnel en Phase 1 partout ; questions Q-051 à Q-055. **1.5 – en cours — Écarts assumés par le premier code** (09/10/2026, D-097) : les specs décrivent ce que l'API NestJS et le site Next.js des livraisons 1 et 2 ont construit — exceptions de la porte et de la maintenance, audience et cookies en local ; carte des routes complétée (plan du site, assistant, simulateurs, liens « Recevoir un nouveau lien », espace client, pièces, comptes) ; deux modèles d'e-mail (`C_ALERT_MANAGE`, `C_PREFERENCES_LINK`) et les événements techniques de la boîte d'envoi (AUT-013) ; deux modèles de données pour l'assistant (MOD-431) et sa réalisation (ASS-053) ; environnement local sans Docker ni Redis et commandes `pnpm` (ENV-041) ; tâches planifiées dans le processus de l'API en attendant le travailleur (AUT-084) ; alertes, favoris, Café, simulateurs et pièces tels qu'ils se comportent ; questions Q-056 à Q-070 (fonds de carte, fournisseur d'IA et son contrat, textes rédigés par SYMLOOP, jeu de démonstration, flux en direct, réévaluation des pièces, photos HEIC…). **Retours d'usage (D-098, 11/10/2026)** : en-tête à une seule hauteur (NAV-012) ; filtres du catalogue en panneau à droite sur ordinateur, appliqués au fil des choix (CAT-030, CAT-031, CAT-036). **11/10/2026, socle du back-office** : routes du socle ajoutées à API-100 (`me/shell`, `me/profile`, `notifications`, `notes`, `saved-views/default`, `search`) ; questions Q-071 à Q-076 (gestes sur son propre compte, destinataires de `NS_TEAM_CHANGE`, coordonnées du support, photo du profil, vues d'origine des demandes, « + Créer » et recherche tant que tout n'est pas livré). **Passe de qualité de l'espace client (D-099, 11/10/2026)** : pleine largeur, message d'encouragement par page (ECL-015…), cartes propres à l'espace, filtres et compteurs (TRV-100 amendée pour les listes bornées, suivi filtré par le serveur), panneau à droite pour le travail secondaire, « Comparer » dans les favoris ; textes à valider (Q-077). **Passe de qualité du site public (D-100, 11/10/2026)** : catalogue au titre centré sur deux lignes, sans fil d'Ariane (CAT-001) ; accueil sur téléphone en défilements à points, services et financements en rangées, barre d'action fixe (ACC-100) ; « Favori » et « Partager » dans le bloc du prix de la fiche (FIC-052) ; biens du programme en lignes cliquables (FIC-111) ; mouvements des points de défilement et de la barre d'action (DSN-072) ; textes ajoutés à Q-066. **Dossier et tâches au back-office (paquets 3.7, 3.8, 11/10/2026)** : routes complétées dans API-100 — fiche, historique, effets, conditions et sélecteurs d'un dossier, suppression avec raison, biens envisagés (lecture, recherche, note, retrait d'un bien en préparation ; l'envoi passe par `propose` avec `send`), réponses du client (`…/lots`, `VISIT_TO_CANCEL`, `SELECTION_PENDING`), tâches (`postpone`, `assign`, `bulk`), agenda et rendez-vous (`GET /admin/agenda`, sélecteur de client, avertissements, `.ics` côté client) ; questions Q-078 à Q-085 (avancée limitée à « Mise en relation » avant le Lot 4, raison de suppression, changement de conseiller sans e-mail, premier contact par un rendez-vous, adresse en erreur et messages sans réponse avant leur émetteur, résumé du matin, tâches d'un conseiller limité, clients choisissables). **Catalogue du back-office (paquets 3.4 à 3.6, 11/10/2026)** : routes complétées dans API-100 — lectures des écrans EA-40 à EA-46, éligibilité, à proximité, chantier, prix en nombre, doublons et livraison des lots, médias (routes déclarées `catalogue.read`, la permission d'écriture du propriétaire vérifiée par le service), import (modèles, historique, dépôt), promoteurs (effets d'une suspension, relation, attentes, sélection, contacts, documents), autres partenaires (`move`), panneau d'une candidature (ACP-084) ; questions Q-086 à Q-095 (pays d'un bien autonome d'une autre monnaie, clé d'idempotence des créations du back-office, résultat d'une candidature, suppression logique, « Sans photo réelle », ordre des partenaires, destinations des liens de suivi, notes et messages, placement sur la carte, plans PDF sur le site). **Premier serveur de recette (11/10/2026)** : antivirus de remplacement déclaré (`VIRUS_SCAN_STUB`, refusé en production, Q-096). **Motivations de l'accueil en vitrine animée (D-101, 11/10/2026)** : liste et photo sur ordinateur, photo à segments sur téléphone, défilement automatique qui s'arrête au survol, au focus et dès qu'on choisit (ACC-045, ACC-100, DSN-072). Retour de recette du 11/10/2026 (D-102 à D-104) : filtres appliqués au bouton et compteur économe (CAT-031, CAT-032), minimum et maximum contrôlés (CAT-034), favori réservé au compte (SFA-020, SFA-021), partage par e-mail détaillé (NAV-037). Retour de recette du 12/10/2026 (D-105) : promoteurs en cartes à image, filtrés et paginés (EDI-030, EDI-031, EDI-035), banques en cartes (EDI-020), filtres des dates du Café (CAF-003), choix de l'assistant structurés (ASS-010). Demandes d’un client connecté (D-106) : coordonnées du compte, non redemandées, et rattachement par la session, pas par l’e-mail saisi (DEM-022, CAF-020). Retour de recette du 13/10/2026 (D-107) : e-mail « autre espace » à l’inscription (AUTH-003), double envoi évité, âge minimum (SEC-095), changements non enregistrés du profil (TRV-093), message retrouvé (MSG-021), « Mon espace » (NAV-013), menus du back-office jamais coupés. Retour de recette du 14/10/2026 (D-108) : réponses du client sur un bien dans son espace (INT-004, INT-020, INT-021, INT-030, INT-031), « Demander une visite » vers « Écrire à mon conseiller » tant qu’INT-040 n’est pas livré (ECL-006), demande au back-office lisible — réponses de la recherche guidée sous leur question, critères déduits non répétés, région nommée (CRM-010), choix lisibles par le Support (SEC-032). Paquet 3.2 terminé (15/10/2026) : pièces jointes d'un e-mail écrit à la main et d'un e-mail reçu (API-100, COM-020, COM-030), « Créer la fiche partenaire » par `content.manage` (CRM-011), noms d'audit ajoutés (SEC-080), Q-097 à Q-101. Paquet 3.3 terminé (15/10/2026) : tâches planifiées `client.status` (statut et score) et `preview.expiry` (08-automatisations). |
| 1.4 | 07/10/2026 | **Expérience fluide et confort** (D-087) : règles communes à tous les écrans pour un public âgé — taille du texte réglable, texte de 16 px et cibles de 48 px dans l'espace client (TRV-123 à TRV-125) ; listes sans rechargement, suggestions pendant la frappe, listes qui se retrouvent comme on les a laissées (TRV-105, TRV-107 à TRV-109) ; aide « ? » et visite de l'espace client (TRV-126) ; erreurs claires, au bon endroit, sans perte de saisie (TRV-113 à TRV-118) ; tableau vivant, filtres sans bouton (DSN-053 à DSN-056) ; jetons et catalogue du mouvement, moments de réussite, réduction des animations (DSN-071 à DSN-075) ; route `GET /public/search/suggest`. **Tout est intégré à la Phase 1** (D-089) : les fonctions ajoutées depuis la signature (Le Café, projection et rappel, mensualité, financement islamique, assistant guidé, favoris et alertes, visite 360°, chantier, à proximité, rendez-vous du client, « Devenir partenaire ») passent de `[P1+]` à `[P1]`, chacune dans sa livraison ; une section dont la donnée manque ne s'affiche pas. **100 % des fonctions** (D-090) : la simplification D-086 est annulée — toutes ses fonctions sont construites, entières — et le site gagne la carte, le comparateur (EP-31), le regroupement par programme, les recherches enregistrées, le mode simplifié, l'aide vocale et l'assistant conversationnel. |
| 1.3 | 07/10/2026 | **Audit de codabilité** (`08-tracabilite/04`) : un agent de développement doit pouvoir coder la Phase 1 sans rien deviner. 426 constats (13 bloquants) relevés par des recoupements mécaniques, douze lectures « à blanc » paquet par paquet, une lecture à la place du client et une relecture d'ensemble ; tous corrigés, puis vérifiés par sept lecteurs neufs, et leurs 80 constats nouveaux corrigés et revérifiés. Écrits désormais : les contrats des routes sensibles, la permission de chaque route, les conditions manquantes d'une transition, l'idempotence, la boîte d'envoi, la résolution des objets du moteur, l'horloge de recette, le dépôt de fichiers et les versions de pièces, le rendu des e-mails à l'envoi, les libellés de chaque énumération, des valeurs par défaut d'exploitation et des textes légaux provisoires. **Trois phases, une Phase 1 simplifiée** (D-086) : client et back-office, l'équipe fait tout ; dix-neuf mécanismes simplifiés ou différés `[V2]`, sans toucher au modèle de données ; le confort du client n'est jamais réduit (délai dépassé annoncé, une seule promesse de délai, acompte expliqué, un contact sur chaque écran de connexion). |
