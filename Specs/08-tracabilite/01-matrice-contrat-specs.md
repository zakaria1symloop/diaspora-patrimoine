# Matrice contrat ↔ spécifications

Chaque engagement de l'**offre technique SYM-OT-DP-2026-06** (annexe du contrat, qui fait foi pour le périmètre : contrat, article 2) est relié ici aux règles qui le réalisent, au lot qui le livre et au parcours de recette qui le vérifie (`06-technique/06`, QUA-030).

Lecture : une ligne sans règle serait un oubli des specs ; une règle `[P1]` qui ne se rattache à aucune ligne serait un dépassement du contrat. Les éléments ajoutés depuis la signature sont à part (§ 3). Une plage de règles ne couvre que ses règles `[P1]` ; celles d'une étiquette ultérieure qu'elle contient relèvent du § 3.

La colonne « Lot » donne aussi la **livraison** (D-006) : le Lot 1 est la livraison 1, le Lot 2 la livraison 2, le Lot 3 la livraison 3, le Lot 4 la livraison 4 ; les Lots 5 et 6 forment la livraison 5. Un engagement noté sur deux lots (« 2, 4 ») se livre en deux temps ; ce qui est utilisable à chaque temps est dit dans `08-tracabilite/02`, § 4.

---

## 1. Périmètre fonctionnel (offre, § 4)

### 4.1 Espace public et catalogue des biens

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| Catalogue des biens avec recherche et filtres (type, localisation, budget, surface, statut) | CAT-001 à CAT-063 ; modèle D-010 | 2 | P01 |
| Fiches biens détaillées : descriptif, caractéristiques, médias (photos, plans), promoteur et programme | FIC-001 à FIC-120 | 2 | P01 |
| Pages optimisées pour le référencement et le partage | NAV-030 à NAV-042, CMS-080, CMS-081 | 2 | P01 |
| Expression d'intérêt depuis une fiche, avec ou sans compte, par un formulaire qualifiant | DEM-001 à DEM-040, CYC-001, CYC-002, D-049 | 2 | P02, P03, P27 |
| Pages institutionnelles : présentation, fonctionnement, FAQ, contact | EDI-001 à EDI-071, DEM-015 | 2 | P01 |
| Architecture multilingue prévue (français en Phase 1) | TRV-001 à TRV-006, `Translation`, ARC-043 | 1 | — |

### 4.2 Espace client

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| Création de compte et authentification sécurisée ; profil et coordonnées | AUTH-001 à AUTH-096, PRO-001 à PRO-021, SEC-010 à SEC-028 | 1–2 | P04, P06, P30 |
| « Mes intérêts » | INT-001 à INT-005 | 2 | P04 |
| « Biens proposés » | INT-010 à INT-032 | 2–3 | P08 |
| Dépôt des pièces selon une liste de pièces | DOS-001 à DOS-040 | 2, 4 | P12, P13 |
| Suivi du statut du dossier en temps réel | ECL-001 à ECL-034, NOT-019, API-070 | 2, 4 | P12, P13 |
| Notifications (e-mail et dans l'application) à chaque étape et à chaque demande de pièce | NOT-030, NOT-040, MSG-040 à MSG-045 | 2, 5 | P13, P19 |
| Échange avec l'administrateur, avec historique | MSG-001 à MSG-020 ; d'ici la livraison 5 : MSG-021 (« Écrire à mon conseiller ») | 2, 5 | P19, P36 |

### 4.3 Back-office administrateur

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| CRM client : fiches complètes, qualification, historique, segmentation et recherche | CRM-040 à CRM-090, BO-030 à BO-055, CAL-070 | 3 | P07, P26, P31, P37 |
| Gestion des intérêts entrants : réception, attribution, traitement, conversion | CRM-001 à CRM-031, CYC-001 à CYC-007 | 3 | P02, P07 |
| Rapprochement client / bien : propositions, biens présentés, visites, retours | PIP-030 à PIP-033, CYC-070 à CYC-073, TAC-040 à TAC-046 | 3 | P08 |
| Gestion des annonces : création, publication, mise à jour, retrait | CTL-020 à CTL-161, CYC-120 à CYC-127, CAL-050 | 3 | P09, P10 |
| Pilotage des dossiers : ouverture, association client / bien / promoteur / banque, complétude, statut | PIP-001 à PIP-095, CYC-020 à CYC-040 | 3–4 | P07, P18 |
| Tâches et rappels : affectation, échéances, alertes | TAC-001 à TAC-031, AUT-040 à AUT-045 | 3–5 | P14 |

### 4.4 Gestion des promoteurs

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| Fiche promoteur : informations légales, contact, documents, interlocuteurs | CTL-001 à CTL-007, MOD-110, MOD-111 | 3 | P09 |
| Programmes immobiliers rattachés à un promoteur | CTL-020 à CTL-024, MOD-200, MOD-201 | 3 | P09 |
| Inventaire des lots : type, surface, prix, disponibilité, statut | CTL-060 à CTL-063, CTL-100 à CTL-102, CYC-100 à CYC-110, MOD-230 à MOD-232 | 3 | P09, P11, P33 |
| Médiathèque : photos, plans, brochures | CTL-080 à CTL-084, MED-020 à MED-023 | 3 | P09 |
| Suivi de la relation : biens proposés, réservations, avancement | CTL-005, CTL-008, CTL-064, PIP-050, PIP-053, CYC-105, CYC-107, AUT-079 | 3–4 | P11, P39, P40 |
| Préparation du portail promoteur | ROL-001 à ROL-004, ROL-040, MOD-102, MOD-103, MOD-115, PPR-040 ; trois niveaux d'accès sur un seul chemin : ACP-001 à ACP-030, ACP-070, ARC-014 | 1, 3 | P41 |

### 4.5 Gestion bancaire et financement

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| Fiche banque : établissements, conditions, interlocuteurs, documents | BNK-001 à BNK-023 ; taux de change : BNK-060 à BNK-064 | 4 | P15, P32 |
| Constitution du dossier de financement à partir du dossier client | BNK-101 à BNK-103, MOD-360, GED-010 | 4 | P15 |
| Soumission à la banque : transmission, suivi de l'envoi et des échanges | BNK-110 à BNK-121, CYC-160 à CYC-163, D-036 | 4 | P15, P16 |
| Suivi de la décision : statut, conditions d'octroi, montant, échéancier | BNK-130 à BNK-134, CYC-164 à CYC-168, DOS-050 à DOS-054 | 4 | P16, P17, P34 |
| Historique complet par dossier et par banque ; traçabilité | `BankSubmissionEvent`, BNK-102, SEC-080 | 4 | P16, P38 |
| Préparation du portail banque | `TransmissionMode.PORTAL`, MOD-115, PBQ-030 ; trois niveaux d'accès sur un seul chemin : ACP-021, ACP-070, BNK-004, ARC-014 | 1, 4 | P41 |

### 4.6 Gestion électronique des dossiers

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| Listes de pièces paramétrables par type de dossier | GED-010 à GED-014, MOD-340, MOD-341, PAR-050 | 4 | P12 |
| Téléversement sécurisé (client ou administrateur), formats contrôlés, stockage chiffré | DOS-010 à DOS-016, GED-037, GED-055, MED-010 à MED-035, SEC-075, SEC-085 | 4 | P13 |
| Cycle de validation par pièce : en attente, reçue, validée, rejetée (avec motif), relancée | CYC-140 à CYC-148, GED-040 à GED-043, GED-060 | 4 | P13, P14 |
| Indicateur de complétude : progression et pièces manquantes | CAL-055, ECL-023, GED-036 | 4 | P13 |
| Versionnement et horodatage ; journal des actions | GED-003, GED-080, MOD-351, SEC-080 | 4 | P13 |
| Organisation par dossier, client et promoteur ; recherche et archivage | GED-036, GED-090, GED-091 | 4 | — |

« Relancée » est un **indicateur** de la pièce (nombre de relances, date de la dernière), pas un statut : une pièce relancée reste « en attente ».

### 4.7 Centre de communication et e-mailing

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| Modèles d'e-mails paramétrables | COM-050 à COM-053, NOT-040 à NOT-060 | 5 | P21 |
| Envoi depuis la plateforme, manuel ou déclenché, avec champs dynamiques | COM-020 à COM-022, COM-070, AUT-001 à AUT-036, NOT-050 | 3 (e-mail écrit à la main), 5 | P19, P21 |
| Journalisation de tous les envois et suivi des statuts | COM-040 à COM-042, NOT-010, API-095 | 5 | P20 |
| Relances automatiques par files d'attente | AUT-042, AUT-006 à AUT-008, ARC-050 | 4–5 | P14, P35 |
| Chronologie de communication par dossier | BO-050, BO-051, PIP-060 | 3–5 | P19 |
| Notifications internes pour l'administrateur | NOT-030 (§ 3.2), BO-060, AUT-070 | 2–5 | P02 |

« Ouvert le cas échéant » : le suivi des ouvertures existe et reste désactivé par défaut (NOT-015, D-046, Q-042).

Le **moteur** d'automatisation est livré avec le socle (Lot 1), et chaque lot apporte les règles, les e-mails et les relances de ses propres fonctions (D-068, AUT-083) : la demande reçue au Lot 2 a son accusé de réception, la pièce demandée au Lot 4 a sa relance. Le Lot 5 livre les **écrans** — centre de communication, modèles modifiables, réglage des règles — et les e-mails écrits à la main depuis un dossier sont disponibles dès le Lot 3.

### 4.8 Moteur de workflow et pipeline

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| Pipeline visuel (Kanban) en sept étapes | PIP-001 à PIP-008 | 4 | P07 |
| Machine à états : règles de passage et conditions | CYC-020 à CYC-040, ARC-012, QUA-020 | 4 | P15, P17 |
| Déclencheurs automatiques : e-mails, tâches, notifications aux changements d'étape | AUT-010 à AUT-045, COM-060 à COM-064 | 4–5 | P14, P21 |
| Vues filtrées : par statut, administrateur, promoteur, banque | PIP-004, PIP-010, BO-040 | 4 | P07 |

### 4.9 Tableau de bord et reporting

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| Indicateurs clés : intérêts, clients qualifiés, dossiers en cours, complétude, soumis et accordés, délais par étape | TDB-012, TDB-020 (M01 à M16) | 6 | P22 |
| Satisfaction et retours clients | TDB-020 (M19), FBK-050 | 6 | P22, P23 |
| Performance commerciale par promoteur, par bien, par période | TDB-050 (EA-06), M21 | 6 | P22 |
| Filtres et export | TDB-030 à TDB-033, TDB-060, BO-041 | 6 | P22 |
| Vue d'activité et journal d'audit | TDB-015, ADM-050 à ADM-052, SEC-080 | 6 | P24 |

### 4.10 Système de feedback et de satisfaction

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| Collecte structurée des retours tout au long du parcours | PRO-070, PRO-071, DEM-018 | 3 (DEM-018), 6 | P23 |
| Enquêtes déclenchées aux étapes clés (proposition, complétude, décision bancaire, acquisition) | AUT-065, AUT-066, PAR-070, PRO-072 à PRO-074 | 6 | P18, P23 |
| Mesure de la satisfaction et de la recommandation ; points de friction | TDB-020 (M19), FBK-050 | 6 | P22 |
| Console de gestion des retours | FBK-001 à FBK-041 | 6 | P23 |
| Boucle d'amélioration | FBK-004, AUT-067 | 6 | P23 |
| Extensible aux futurs portails | `Feedback.promoterId`, `bankId`, `authorOrganizationId` | 1 | — |

### 4.11 Simulateurs

| Engagement | Règles | Lot | Recette |
|---|---|---|---|
| Éligibilité à partir des revenus, de l'apport, de la situation, de la durée | SIM-010 à SIM-015, CAL-100 à CAL-104 | 2 | P05 |
| Capacité d'emprunt ; orientation vers les profils et les banques compatibles | CAL-042, CAL-101, CAL-102, SIM-006 | 2 | P05 |
| Préqualification : le résultat alimente le CRM | DEM-016, CAL-070, CRM-047 | 2–3 | P05 |
| Adapté aux dossiers non résidents | `ResidencyStatus`, `BankProduct.eligibleResidency`, CAL-101 | 2 | P05 |
| Mensualité, coût total, durée | SIM-020, SIM-021, CAL-040 à CAL-045, CAL-110 | 2 | P05 |
| Tableau d'amortissement indicatif | CAL-043, SIM-021 | 2 | P05 |
| Comparaison de scénarios | CAL-111, SIM-023 | 2 | P05 |
| Enregistrer une simulation, la rattacher au dossier | SIM-032, SFA-010 à SFA-013, `Simulation.dossierId` | 2 | P05 |
| Barèmes paramétrables sans intervention technique | BNK-020 à BNK-023, BNK-060 à BNK-063 | 4 | P15 |
| Mention : estimation indicative, pas une offre de crédit | TRV-023, TRV-024, SIM-002 | 2 | P05 |

Les simulateurs sont livrés au Lot 2 avec le barème indicatif (CAL-103) ; l'écran de gestion des barèmes arrive avec le Lot 4.

## 2. Architecture, sécurité, organisation (offre, § 5 à § 10)

| Engagement | Règles | Lot |
|---|---|---|
| § 5.1 Next.js, NestJS, PostgreSQL, Redis, stockage S3, e-mail transactionnel, conteneurs, CI/CD | D-001, D-050 à D-059, ARC-001 à ARC-075, ENV-001 à ENV-053 | 1 |
| § 5.1 Jetons et contrôle d'accès par rôles, conçu pour le multi-portail | SEC-020 à SEC-034, ROL-001 à ROL-050 — dont le masquage pour le Support (SEC-032), le périmètre restreint (ROL-018) et l'aperçu (ROL-017) | 1 |
| § 6 Entités Promoteur et Banque définies dès la Phase 1 | `01-domaine/02`, MOD-017 | 1 |
| § 7 Chiffrement des échanges et des documents au repos | SEC-085, MOD-016 | 1 |
| § 7 Authentification sécurisée, moindre privilège | SEC-010, SEC-011, SEC-030, ROL-020 | 1 |
| § 7 Journal d'audit des actions sensibles | SEC-080 à SEC-082, MOD-430 | 1–6 |
| § 7 Sauvegardes et plan de restauration ; supervision | FIA-090 à FIA-092, ENV-060, ENV-070 | 1, 6 |
| § 7 Consentements et mentions légales | DEM-020, DOS-040, NAV-050, PAR-083, `Consent` ; écran de publication des textes : CMS-060 | 1–2, 6 |
| § 7 RGPD : minimisation, finalité, droits, registre, durées ; loi 18-07 | SEC-090 à SEC-112, PRO-050 à PRO-060, ADM-060 à ADM-064 | 1–6 |
| § 8 Entités et API pensées pour les phases 2, 3 et le mobile | `05-phases-ulterieures/`, `00-cadre/06`, ARC-013, ARC-014, ARC-031 | 1 |
| § 9 Cadrage : spécifications, parcours, maquettes, design système | Ce dossier ; `07-design/` ; Figma | 0 |
| § 9 Recette continue ; environnements séparés | QUA-070 à QUA-073, ENV-001, ENV-032 (horloge de recette) ; P36 à chaque livraison | 1–6 |
| § 9 Documentation et formation | QUA-090 | 6 |
| Contrat, art. 7 : vérification de chaque lot sous sept jours ouvrés | QUA-070 à QUA-072 | — |
| Contrat, art. 11 : remise du code source et de la documentation | QUA-090 | 6 |
| Contrat, art. 12 : garantie de trois mois | QUA-072 | — |
| Contrat, art. 16 : rôles de responsable de traitement et de sous-traitant | SEC-090 | — |

## 3. Fonctions ajoutées depuis la signature (intégrées, D-089)

Elles figurent sur l'accueil validé, dans les documents de vision ou découlent de la conception du Lot 0. Elles sont **construites avec la Phase 1** (D-089 ; `00-cadre/01`, § 6), dans la livraison du plan (`08-tracabilite/02`, § 3). La dernière colonne dit ce qui s'affiche quand la donnée manque ou que l'administrateur coupe la fonction.

| Écart | Élément | Règles | Indicateur | Donnée absente ou fonction coupée |
|---|---|---|---|---|
| E1 | Le Café | CAF-001 à CAF-061, EVT-001 à EVT-070, CYC-180 à CYC-187, AUT-056, SFA-040 à SFA-042 | `features.cafe` | Carte et boutons de l'accueil remplacés par « Être rappelé » et « Découvrir les programmes » |
| E2 | Plusieurs pays | D-018, D-019, PAR-020, PAR-091, critère `country` | `features.multiCountry` | Un seul pays actif ; le modèle est déjà multi-pays |
| E3 | Financement islamique | D-021, CAL-047, EDI-022, SIM-004 | `features.islamicFinance` | Carte et mention masquées sur l'accueil (ACC-090) ; simulateurs sans le type islamique — un barème à marge fixe reste calculable (D-079) |
| E4 | Projection et rappel | DEM-013, DEM-014, BNK-080, BNK-081, CAL-120 | `features.projectionRequest`, `features.callbackRequest` | Simulateurs et formulaire de contact |
| E5 | Assistant de recherche | ASS-001 à ASS-050 | `features.assistant.mode` | Lien masqué |
| E6 | Recherche par mensualité ; mensualité sur les cartes | D-020, CAL-023, CAL-030 à CAL-033, BNK-070, CAT-042 | `features.monthlyBudgetSearch` | Recherche par prix ; cartes au prix |
| E7 | Visite 360°, chantier, points d'intérêt, temps de vol | FIC-013, FIC-017, FIC-042, FIC-062, FIC-065, CTL-140, CTL-145 | `features.tour360`, `features.constructionProgress`, `features.poi` | Photos et plans, comme au contrat |
| E8 | Favoris et alertes | SFA-020 à SFA-035, CAT-070 à CAT-072, AUT-060 à AUT-062 | `features.favorites`, `features.searchAlerts` | Aucun |
| E9 | Rendez-vous demandés par le client | INT-040, TAC-041 | `features.clientAppointments` | Rendez-vous créés par l'équipe (au contrat) |
| E10 | Devenir partenaire | DEM-019 | `features.partnerForm` | Formulaire de contact |

## 4. Ce que les specs ajoutent pour tenir les engagements

Ces mécanismes ne sont pas nommés dans l'offre, mais sans eux un engagement ne tient pas. Ils font partie de la Phase 1.

| Mécanisme | Sert l'engagement | Règles |
|---|---|---|
| Trois niveaux programme, bien, lot | « Inventaire des lots » (§ 4.4) | D-010 |
| Option et réservation d'un lot | « Réservations » (§ 4.4) | D-013, CYC-105 |
| Co-emprunteurs et garants | « Dossier de financement » (§ 4.5) | D-015, MOD-320 |
| Lien de partage sécurisé à code | « Transmission du dossier » (§ 4.5) | D-036, BNK-110 à BNK-114 |
| Boîte d'envoi transactionnelle, idempotence, verrouillage | « Traçabilité de bout en bout », « robustesse » (§ 4.5, § 5.1) | FIA-001 à FIA-121 |
| Double authentification du personnel | « Authentification sécurisée » (§ 7) | D-033, BO-002 |
| Calendrier ouvré et délais par étape | « Délais moyens par étape » (§ 4.9), relances (§ 4.7) | CAL-060 à CAL-062 |
| Score de préqualification | « Prioriser les leads sérieux » (§ 4.11) | CAL-070 |
| Complétude d'une fiche et publication contrôlée | « Gestion des annonces » (§ 4.3) | CAL-050, CYC-120 |
| Rôles Lecture seule et Support | « Moindre privilège » (§ 7) | ROL-015, ROL-016 |
| Corbeille, fusion de fiches, détection des doublons | « CRM » (§ 4.3), « rien ne se perd » | ADM-070, CRM-080, CRM-081 |
| Fiche client sans adresse e-mail | « Gestion des intérêts entrants » (§ 4.3) : la personne qui appelle | D-071, MOD-302, CRM-025, NOT-025, P31 |
| Correction d'une saisie : cours de change, décision bancaire, vente d'un lot | « Traçabilité » (§ 4.5) : une erreur se corrige sans effacer l'historique | D-060, BNK-064, D-065, CYC-169, CYC-100, P32, P34 |
| Suivi de l'acompte d'une réservation annulée | « Réservations » (§ 4.4) : l'argent du client ne se perd pas de vue | D-064, MOD-313, P33 |
| Aperçu de l'espace du client par l'équipe | « Échange avec l'administrateur » (§ 4.2) : aider sans se connecter à sa place | ROL-017, P37 |
| Barème indicatif des simulateurs | « Simulateurs » (§ 4.11), livrés avant l'écran des banques | D-062, PAR-044 |
| Textes légaux provisoires en vigueur dès l'installation | « Consentements et mentions légales » (§ 7) | D-073, PAR-083 |
| Porte d'accès avant l'ouverture au public | Livraison par étapes (contrat, art. 7) : le client vérifie un site fermé au public | D-069, NAV-064 |
| Les règles d'un geste de partenaire dans une commande de l'API, jamais dans un écran | « Structure prête pour le portail » (§ 4.4, § 4.5) : ouvrir plus tard une réponse par lien, puis un portail, sans rien refaire | D-080 à D-083, ACP-001 à ACP-030, ACP-070, ARC-014 |
| Le promoteur tient-il le lot ; qui accueille une visite ; prévenir le promoteur quand un lot est libéré | « Réservations », « Suivi de la relation » (§ 4.4) : le client n'apprend une option que lorsque le promoteur tient le lot | D-084, CYC-107, PIP-053, TAC-045, ACP-023, P39 |
| Vérification périodique des disponibilités et des barèmes | « Inventaire des lots » (§ 4.4), « Barèmes paramétrables » (§ 4.11) : un catalogue tenu à la main ne vieillit pas sans qu'on le sache | D-084, AUT-079, CTL-064, BNK-024, P40 |
