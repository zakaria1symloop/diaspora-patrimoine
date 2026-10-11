# Vision, périmètre et phases

## 1. Le produit en une page

**Diaspora Patrimoine** est une plateforme de mise en relation sélective pour acheter un bien immobilier **neuf** en Afrique depuis l'étranger. Premier pays ouvert : l'Algérie. Public visé : la diaspora, d'abord algérienne, qui vit en France, en Europe, en Amérique du Nord ou dans le Golfe.

La promesse faite au visiteur, telle que la page d'accueil validée la formule : « Votre projet immobilier en Afrique prend vie ici ».

Le produit réunit quatre acteurs autour d'un même dossier :

- le **client** découvre des biens, exprime un intérêt, dépose ses pièces et suit son dossier ;
- l'**administrateur** de Diaspora Patrimoine qualifie, propose des biens, vérifie le dossier, le soumet aux banques et pilote toute la communication ;
- le **promoteur** propose des programmes et des lots ;
- la **banque** étudie le dossier et accorde le financement, classique ou islamique.

En Phase 1, seuls le client et l'administrateur se connectent. Le promoteur et la banque existent déjà comme **entités complètes** dans les données (fiches, documents, relations), gérées pour leur compte par l'administrateur. Ouvrir leurs portails plus tard revient à leur donner un accès, pas à refaire la plateforme. C'est la décision d'architecture la plus structurante du projet (offre technique, § 2.2).

Cet accès a **trois niveaux**, sur un seul chemin (`00-cadre/06`) : au niveau 1, l'équipe saisit pour le partenaire — c'est la Phase 1 ; au niveau 2, il répond lui-même par un lien sécurisé, sans compte ; au niveau 3, il se connecte à son portail. Le niveau se règle partenaire par partenaire : on commence à la main, on ouvre quand le partenaire le demande.

### Ce qui fait acheter, ce qui bloque

Le produit est construit sur l'analyse faite avec Mme Mouhoubi (`Strategie/`) :

| | Ce que le visiteur ressent | Ce que la plateforme montre |
|---|---|---|
| Moteur 1 | un ancrage sûr au pays, parmi les siens | des biens réels, des promoteurs sélectionnés, un suivi transparent |
| Moteur 2 | l'euro travaille pour lui | la mensualité de chaque bien, les simulateurs, la comparaison avec la France |
| Blocage 1 | il ne rencontre les promoteurs qu'une fois par an | **Le Café** : promoteur et banquier à Paris et dans le Sud de la France, au moins une fois par mois |
| Blocage 2 | il ne connaît pas le parcours bancaire | six étapes visibles, un conseiller, la liste des pièces, le suivi du dossier |

## 2. Objectifs et mesures de réussite

Objectifs repris de l'offre technique (§ 2.1), avec la mesure qui permet de dire s'ils sont atteints.

| # | Objectif | Mesure (tableau de bord, `04-back-office/02`) |
|---|---|---|
| O1 | Centraliser les demandes des clients et les biens des promoteurs | 100 % des demandes entrantes créées dans la plateforme ; aucun bien suivi hors plateforme |
| O2 | Outiller l'administrateur pour qualifier, mettre en relation et accompagner | délai de premier contact ; taux de demandes qualifiées |
| O3 | Constituer, vérifier et suivre les dossiers jusqu'à complétude | taux de complétude ; délai moyen de constitution |
| O4 | Gérer la soumission aux banques et les décisions | dossiers soumis, accordés, refusés ; délai de décision |
| O5 | Permettre au client d'évaluer son éligibilité et de simuler son crédit | simulations lancées ; part des simulations qui deviennent une demande |
| O6 | Piloter toute la communication par e-mail depuis la plateforme | 100 % des e-mails clients envoyés et tracés depuis la plateforme |
| O7 | Recueillir et exploiter les retours | taux de réponse aux enquêtes ; indice de satisfaction et de recommandation |
| O8 | Préparer les portails promoteur et banque, puis le mobile | aucune refonte du modèle de données à l'ouverture des portails ; un partenaire passe du niveau 1 au niveau 2 ou 3 sans reprise de données (ACP-070) |
| O9 `[P1]` | Faire venir les prospects aux Cafés | inscriptions par Café ; taux de présence ; demandes ouvertes après un Café |

## 3. Le parcours de bout en bout

Le client voit **six étapes**. La plateforme en gère **sept** en interne (`DossierStage`), plus les issues « gagné », « perdu » et « en pause ».

| Étape vue par le client | Étape interne | Ce qui se passe |
|---|---|---|
| 1. Découverte des biens | — (avant le dossier) | Le visiteur parcourt le catalogue, simule, s'inscrit à un Café. |
| 2. Expression d'intérêt | `INTEREST` | Il envoie une demande (intérêt pour un bien, projection, rappel). Un dossier s'ouvre. |
| 3. Qualification et mise en relation | `QUALIFICATION` puis `MATCHING` | Un conseiller le rappelle, qualifie son projet, lui propose des biens, organise visites et visios. |
| 4. Constitution et vérification du dossier | `DOCUMENTS` | Le client dépose ses pièces ; le conseiller les valide. |
| 5. Soumission à la banque | `BANK_REVIEW` | Le dossier complet part chez une ou plusieurs banques ; suivi des échanges. |
| 6. Octroi du crédit et acquisition | `APPROVED` puis `ACQUISITION` | Accord de la banque, acceptation des conditions, signature de l'acte. Le dossier est gagné. |

Détail des transitions : `01-domaine/06-cycles-de-vie.md`.

## 4. Périmètre par phase

### 4.1 Vue d'ensemble

| Module | Phase | Spec |
|---|---|---|
| Site public : accueil, pages institutionnelles, FAQ, contact | `[P1]` | `02-site-public/01`, `02`, `08` |
| Catalogue des biens, recherche et filtres | `[P1]` | `02-site-public/03` |
| Fiches programme et bien, médias (photos, plans) | `[P1]` | `02-site-public/04` |
| Expression d'intérêt avec ou sans compte | `[P1]` | `02-site-public/05` |
| Simulateurs d'éligibilité et de crédit | `[P1]` | `02-site-public/06`, `01-domaine/07` |
| SEO, partage, consentements, mentions légales | `[P1]` | `02-site-public/01` |
| Espace client : compte, intérêts, biens proposés, pièces, suivi, notifications, messagerie | `[P1]` | `03-espace-client/` |
| Back-office : CRM, demandes entrantes, rapprochement, annonces, dossiers, tâches | `[P1]` | `04-back-office/03`, `04`, `06`, `09` |
| Gestion des promoteurs, programmes, lots, médiathèque | `[P1]` | `04-back-office/04` |
| Gestion des banques, soumissions, décisions | `[P1]` | `04-back-office/05` |
| GED : listes de pièces, validation, complétude, versions | `[P1]` | `04-back-office/07` |
| Centre de communication et e-mailing, relances | `[P1]` | `04-back-office/08`, `01-domaine/09` |
| Moteur de workflow, pipeline Kanban | `[P1]` | `04-back-office/06`, `01-domaine/08` |
| Tableau de bord, reporting, exports, journal d'audit | `[P1]` | `04-back-office/02`, `13` |
| Feedback et enquêtes de satisfaction | `[P1]` | `04-back-office/11` |
| Authentification, rôles, sécurité, RGPD | `[P1]` | `06-technique/03` |
| Le Café : événements, inscriptions, rappels, pointage | `[P1]` | `02-site-public/07`, `04-back-office/10` |
| Demandes de projection et de rappel, outil de projection | `[P1]` | `02-site-public/05`, `04-back-office/05` |
| Recherche par mensualité, mensualité indicative sur les cartes | `[P1]` | `02-site-public/03`, `01-domaine/07` |
| Financement islamique (type de produit, vocabulaire, contenus) — la formule à marge fixe est `[P1]` (D-079) | `[P1]` | `01-domaine/07`, `04-back-office/05` |
| Plusieurs pays (référentiel, devise par pays) | `[P1]` | `01-domaine/02` |
| Assistant de recherche, mode guidé | `[P1]` | `02-site-public/09` |
| Visite 360°, avancement du chantier, points d'intérêt | `[P1]` | `02-site-public/04` |
| Favoris et alertes de recherche | `[P1]` | `03-espace-client/06` |
| Rendez-vous demandés par le client (visio, visite) | `[P1]` | `03-espace-client/03`, `04-back-office/09` |
| Promoteurs et banques au niveau 1 d'accès : l'équipe saisit pour eux | `[P1]` | `00-cadre/06` |
| Accès des promoteurs : niveau 2 (réponse par lien), puis niveau 3 (portail) | `[P2]` | `00-cadre/06`, `05-phases-ulterieures/01` |
| Accès des banques : niveau 2 (réponse par lien), puis niveau 3 (portail) | `[P3]` | `00-cadre/06`, `05-phases-ulterieures/02` |
| Application mobile Flutter | `[MOB]` | `05-phases-ulterieures/03` |
| Recommandation, lecture automatique des pièces (l'assistant conversationnel est en Phase 1 depuis D-090, ligne ci-dessous) | `[IA]` | `05-phases-ulterieures/04` |
| Arabe et anglais | `[V2]` | `00-cadre/04`, § 2 |
| Comparateur, vue sur carte, regroupement par programme, recherches enregistrées ; mode simplifié et aide vocale ; assistant conversationnel (D-090) | `[P1]` | `02-site-public/03`, `00-cadre/04` |

Les devises de revenus des simulateurs (PAR-025) et leurs cours (BNK-060) sont `[P1]`.

### 4.2 Ce que la Phase 1 contient, module par module

Repris de l'offre technique, § 4. C'est la **liste de contrôle contractuelle** ; la correspondance fine avec les règles est dans `08-tracabilite/01-matrice-contrat-specs.md`.

1. **Espace public et catalogue (§ 4.1)** : catalogue avec recherche et filtres (type, localisation, budget, surface, statut) ; fiches détaillées (descriptif, caractéristiques, photos, plans, promoteur, programme) ; pages optimisées SEO et partage ; expression d'intérêt avec ou sans compte par un formulaire qualifiant ; pages institutionnelles (présentation, fonctionnement, FAQ, contact) ; architecture multilingue prévue, français seul en Phase 1.
2. **Espace client (§ 4.2)** : compte et authentification, profil ; « Mes intérêts » ; « Biens proposés » ; dépôt des pièces selon une liste ; suivi du statut en temps réel ; notifications e-mail et dans l'application ; échange avec l'administrateur, avec historique.
3. **Back-office (§ 4.3)** : CRM client ; gestion des intérêts entrants ; rapprochement client / bien ; gestion des annonces ; pilotage des dossiers ; tâches et rappels.
4. **Promoteurs (§ 4.4)** : fiche, programmes, inventaire des lots, médiathèque, suivi de la relation (biens proposés, réservations), structure prête pour le portail.
5. **Banques (§ 4.5)** : fiche, constitution du dossier de financement, soumission, suivi de la décision, historique, structure prête pour le portail.
6. **GED (§ 4.6)** : listes de pièces paramétrables, téléversement sécurisé, cycle de validation par pièce, indicateur de complétude, versions et horodatage, organisation, recherche, archivage.
7. **Communication (§ 4.7)** : modèles d'e-mails paramétrables, envoi manuel ou déclenché, journal et statuts, relances automatiques, timeline par dossier, notifications internes.
8. **Workflow (§ 4.8)** : pipeline Kanban, machine à états, déclencheurs automatiques, vues filtrées.
9. **Tableau de bord (§ 4.9)** : indicateurs clés, satisfaction, performance commerciale, filtres et exports, vue d'activité et journal d'audit.
10. **Feedback (§ 4.10)** : collecte structurée, enquêtes déclenchées aux étapes clés, mesure, console de gestion.
11. **Simulateurs (§ 4.11)** : éligibilité (capacité d'emprunt, banques compatibles, préqualification dans le CRM) ; crédit (mensualité, coût total, tableau d'amortissement, comparaison de scénarios, enregistrement, barèmes paramétrables, mention légale).

## 5. Lots contractuels

Planning indicatif d'environ quatre mois (offre technique, § 10). Les conditions commerciales relèvent du contrat, qui n'est pas dans le dépôt.

| Lot | Contenu | Semaines | Montant (DZD) | Livraison | Cumul |
|---|---|---|---|---|---|
| Lot 0 | Cadrage et conception détaillée : UX, spécifications, design système | 1–2 | 300 000 | — | 11 % |
| Lot 1 | Socle technique : modèle de données, authentification, rôles, CI/CD, hébergement | 3–4 | 350 000 | L1 | 24 % |
| Lot 2 | Espace public et catalogue, espace client, simulateurs | 5–7 | 480 000 | L2 | 42 % |
| Lot 3 | Back-office : CRM, promoteurs, annonces, rapprochement | 8–10 | 510 000 | L3 | 61 % |
| Lot 4 | GED, moteur de workflow et pipeline, suivi bancaire | 11–13 | 480 000 | L4 | 79 % |
| Lot 5 | Centre de communication, e-mailing, notifications | 13–14 | 270 000 | L5 | 89 % |
| Lot 6 | Tableau de bord, feedback, recette globale, durcissement, mise en production, formation | 15–16 | 310 000 | L5 | 100 % |

Ces spécifications et les maquettes Figma sont les livrables du **Lot 0**. L'ordre de construction détaillé est dans `08-tracabilite/02-plan-de-realisation.md`.

**Livraison par étapes** (D-006). La plateforme se livre en **cinq livraisons d'environ 20 %**, une par lot, les Lots 5 et 6 formant la dernière. À chaque livraison, ce qui est livré fonctionne de bout en bout, est déployé, et se démontre ; rien n'est finalisé d'un seul coup à la fin. Ce que chaque livraison rend utilisable, et ce qu'elle laisse pour la suivante : `08-tracabilite/02`, § 1 et § 4.

Chaque lot livré est vérifié par la cliente sous **sept jours ouvrés** ; sans retour écrit, il est réputé accepté (contrat, article 7).

## 6. Fonctions ajoutées depuis la signature — intégrées à la Phase 1 (D-089)

Ces éléments sont apparus **après** la signature : dans la maquette et l'argumentaire de Mme Mouhoubi du 27 septembre 2026, dans les documents de vision (visites 360°, accessibilité) ou dans les choix de conception du Lot 0. **Ils sont construits avec la Phase 1** (D-089, 7 octobre 2026) : livrer par étapes, c'est livrer par acteurs (le client et l'équipe d'abord), jamais retirer une fonction d'une page. Chacune se construit dans la page où elle vit ; quand sa donnée manque — un bien sans visite 360°, aucun Café programmé —, sa section ne s'affiche pas. La table garde leur origine ; leur formalisation contractuelle (article 18) relève de SYMLOOP.

| # | Fonction | Origine | Ce que cela ajoute | Quand la donnée manque |
|---|---|---|---|---|
| E1 | **Le Café** : événements mensuels, inscription, liste d'attente, rappels, pointage, suivi après l'événement | Maquette validée (carte « Le Café », menu, section dédiée, appel final) | 4 tables, 3 pages publiques, 1 module de back-office, 11 modèles d'e-mail | Les boutons « Je m'inscris au prochain café » de l'accueil n'aboutissent à rien |
| E2 | **Plusieurs pays** (« immobilier neuf en Afrique ») | Titre et devise de la maquette | Référentiel de pays, régions et villes ; devise par pays ; un seul pays actif au lancement | Le modèle ne connaît que l'Algérie ; l'ouvrir plus tard coûte une migration |
| E3 | **Financement islamique** | Maquette et argumentaire | Type de produit `ISLAMIC`, vocabulaire adapté, contenus | Pas de produit islamique ni de vocabulaire dédié ; un barème à marge fixe reste calculable (D-079) |
| E4 | **Demande de projection** et **demande de rappel** | Maquette (« Recevez votre projection », « Être rappelé ») | 2 formulaires, 1 outil de projection pour le conseiller, 1 PDF | Deux blocs de l'accueil validé sans effet |
| E5 | **Assistant de recherche**, mode guidé | Argumentaire (« Recherche avec un chatbot ») et lien sur l'accueil | Un questionnaire en 5 questions qui remplit les filtres ; la version conversationnelle est aussi construite en Phase 1 (D-090, ASS-050) | Lien de l'accueil sans destination |
| E6 | **Recherche par mensualité** et mensualité indicative sur chaque carte | Maquette (champ « Budget mensuel », cartes à mensualité) | Paramètres de financement de référence, calcul mis en cache | Recherche par prix seulement ; les cartes de l'accueil ne peuvent pas afficher de mensualité |
| E7 | **Visite 360°**, **avancement du chantier**, **points d'intérêt** | Guide promoteur et conception du Lot 0 | Visionneuse, 2 tables | Fiches limitées aux photos et aux plans, comme dans l'offre |
| E8 | **Favoris** et **alertes de recherche** | Conception du Lot 0 | 2 tables, 1 tâche planifiée, 2 e-mails | Pas de relance automatique des visiteurs |
| E9 | **Rendez-vous** demandés par le client (visio, visite) | Conception du Lot 0 | 1 table, 3 e-mails | Les visites restent suivies par l'administrateur seul (prévu au contrat) |
| E10 | Formulaire **« Devenir partenaire »** | Conception du Lot 0 | 1 formulaire | Contact par le formulaire général |

Restent **dans** le contrat, même si le mot n'y figure pas tel quel, parce qu'ils sont nécessaires aux modules prévus : la réservation d'un lot (§ 4.4 « réservations »), les co-emprunteurs (§ 4.5 « constitution du dossier de financement »), le lien de partage sécurisé vers la banque (§ 4.5 « transmission du dossier »), la double authentification du personnel (§ 7 et Lot 6 « durcissement sécurité »), les typologies de biens et les lots (§ 4.4 « inventaire des lots »).

**Règle pour le développement :** chaque fonction de cette table est construite — modèle, routes, écrans, e-mails, tâches — dans la livraison indiquée au plan (`08-tracabilite/02`, § 3). Son indicateur (PAR-010) est **vrai par défaut** : il reste un interrupteur d'administration. Les replis de l'accueil (`02-site-public/02-accueil.md`, ACC-090) ne servent plus que quand la donnée manque ou que l'administrateur coupe la fonction.

## 7. Hors périmètre

Ce que la plateforme **ne fait pas**, quelle que soit la phase, sauf nouvelle décision :

- **Aucun paiement en ligne.** L'apport, l'acompte de réservation et les mensualités ne transitent pas par la plateforme. Elle enregistre des montants et des justificatifs, pas des transactions.
- **Aucune signature électronique** de contrat de réservation, d'offre de prêt ou d'acte. Les documents signés sont déposés comme pièces.
- **Aucune offre de crédit.** Les simulateurs donnent une estimation indicative ; l'offre relève de la banque. La mention est affichée partout où un montant de mensualité apparaît.
- **Pas de comptabilité ni de facturation.** Les honoraires et commissions peuvent être notés sur un dossier pour le reporting ; aucune facture n'est émise.
- **Pas de gestion locative**, de syndic, ni de revente.
- **Pas de conseil en investissement.** Les contenus restent factuels : ni promesse de rendement, ni comparaison présentée comme un conseil.
- **Pas de vérification d'identité automatisée** (KYC) ni de contrôle anti-blanchiment : ces contrôles relèvent des banques et des notaires.
- **Pas de messagerie WhatsApp intégrée.** Un lien ouvre WhatsApp ; les échanges sont notés à la main dans la chronologie du dossier.
- **Pas de calcul de pénalités** de retard de livraison. La date de livraison contractuelle et la date réelle sont enregistrées (voir `Q-014`).

## 8. Hypothèses et contraintes

| # | Hypothèse | Si elle tombe |
|---|---|---|
| H1 | La Phase 1 est en **français** seulement ; les textes et les données sont prêts pour l'arabe et l'anglais. | L'ouverture d'une langue devient un chantier de contenu, pas de code. |
| H2 | Un seul pays est actif au lancement : l'**Algérie**. | Chaque nouveau pays demande son référentiel géographique, sa devise, ses banques, ses listes de pièces. |
| H3 | Les données sont **hébergées dans l'Union européenne**. | Revoir `06-technique/03` et les mentions légales. |
| H4 | L'équipe de Diaspora Patrimoine compte **peu de personnes** au lancement (1 à 5 comptes). | L'affectation des demandes est paramétrable (`leads.assignmentMode`) ; la visibilité restreinte des conseillers se règle par `access.agentScope` (ROL-014). |
| H5 | Les **barèmes bancaires**, les **listes de pièces** et les **taux de change** sont fournis par Diaspora Patrimoine et ses banques. La plateforme les rend paramétrables ; les valeurs de départ sont des exemples marqués comme tels. | Les simulateurs affichent des montants faux. Voir `Q-005` à `Q-008`. |
| H6 | Les **photos des biens** sont fournies par les promoteurs. Les images actuelles sont des illustrations générées. | Les fiches affichent l'état « Photos en cours de préparation ». |
| H7 | Le client final utilise surtout un **téléphone**. Chaque écran public et client est conçu pour le mobile d'abord. | — |
| H8 | Les utilisateurs du back-office travaillent sur **ordinateur** (largeur d'au moins 1280 px). Le back-office reste utilisable sur tablette, sans optimisation pour téléphone. | — |

## 9. Principes produit

Ils servent à trancher quand une règle manque.

1. **Aucune zone vide, aucun bouton mort.** Si une donnée manque, la section est masquée ou remplacée par un état prévu. Si une fonction n'est pas ouverte, son bouton mène à un repli utile.
2. **Le client sait toujours où il en est** et ce qui vient ensuite : étape en cours, pièces manquantes, prochaine action, nom de son conseiller.
3. **Rien ne se perd.** Une demande envoyée est enregistrée avant même la réponse de l'écran. Une pièce déposée garde toutes ses versions. Chaque action sensible est tracée.
4. **Les chiffres sont honnêtes.** Tout montant estimé est marqué « ≈ » ou d'un astérisque, daté, et accompagné de ses hypothèses.
5. **L'humain reste présent.** Chaque écran clé propose un moyen de joindre un conseiller : message, rappel, WhatsApp, Café.
6. **Tout ce que l'administrateur peut vouloir changer est une donnée**, pas du code : listes de pièces, modèles d'e-mails, délais, barèmes, textes légaux.
7. **Un ton rassurant et positif.** On parle de ce que le client gagne, jamais d'une menace. Pas de jargon sans explication.
