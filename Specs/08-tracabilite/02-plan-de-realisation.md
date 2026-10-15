# Plan de réalisation

Dans quel ordre construire la Phase 1, comment la **livrer par étapes**, et comment s'y prendre avec un agent de développement (Claude Code). Le plan suit les **lots contractuels** (`00-cadre/01`, § 5), les regroupe en **cinq livraisons d'environ 20 %**, et les découpe en **paquets de travail** : chacun tient dans une session de développement, se lit dans quelques fichiers de specs, et se termine par des tests verts.

Toutes les règles `[P1]` sont construites, **entières** (D-090) : une page se construit avec 100 % de ses fonctions. Seul ce qui reste marqué `[V2]` ne l'est pas (§ 3, « Hors Phase 1 »). Les fonctions ajoutées depuis la signature sont construites elles aussi, chacune dans sa livraison (§ 3, D-089) : une page se construit avec toutes ses fonctions, et une section dont la donnée manque ne s'affiche pas.

---

## 1. Livrer par étapes

La plateforme n'est pas livrée d'un bloc à la fin. Elle est livrée en **cinq fois**. À chaque livraison, ce qui est livré **fonctionne de bout en bout**, est **déployé**, et se **démontre** (D-006). La mise en ligne n'est alors plus un saut : c'est l'ouverture au public d'un produit déjà déployé et vérifié quatre fois.

### 1.1 Les cinq livraisons

Le pourcentage est la part du prix du contrat atteinte à la fin de la livraison, Lot 0 compris (`00-cadre/01`, § 5).

| Livraison | Lots | Cumul | Version | À la fin, ce qui fonctionne | Paiement (contrat, art. 10) |
|---|---|---|---|---|---|
| **L1 — Le socle en ligne** | 1 | 24 % | 0.2 | Les environnements se déploient seuls. L'équipe se connecte au back-office, la Direction invite ses collaborateurs et règle leurs droits. Le site affiche une page d'attente. | 30 % déjà versés à la signature |
| **L2 — Le site et l'espace client** | 2 | 42 % | 0.4 | Un visiteur cherche un bien, ouvre une fiche, simule son financement, envoie une demande, crée son espace et y retrouve ses demandes. L'équipe reçoit chaque demande et la lit dans le back-office. | — |
| **L3 — Le back-office commercial** | 3 | 61 % | 0.6 | L'équipe traite les demandes, tient les fiches clients, gère promoteurs, programmes, biens et lots, publie sur le site, ouvre des dossiers, propose des biens ; le client répond depuis son espace. | 35 % à la livraison du Lot 3 |
| **L4 — Dossiers, pièces et banques** | 4 | 79 % | 0.8 | Le client dépose ses pièces, le conseiller les vérifie, le dossier avance d'étape en étape, part chez les banques par un lien sécurisé, reçoit sa décision ; un lot se réserve et se vend. | — |
| **L5 — Communication, pilotage, ouverture** | 5 et 6 | 100 % | 1.0 | Tout le périmètre `[P1]` : messagerie, notifications, modèles d'e-mails, relances, tableau de bord, enquêtes, contenus, administration, données personnelles ; essais de durcissement ; ouverture au public ; formation. | 35 % à la recette définitive |

La cinquième livraison peut se faire en deux temps si le calendrier le demande : le Lot 5 (version 0.9), puis le Lot 6 (version 1.0).

### 1.2 Ce qu'est une livraison

Règles : QUA-074 (contenu d'une livraison) et ENV-054 (déploiement).

1. **Elle fonctionne seule.** Aucun de ses parcours ne dépend d'un paquet d'une livraison suivante. Les fonctions à venir ne laissent ni bouton mort ni page vide : leur entrée de menu n'existe pas encore, ou l'écran applique un repli (`00-cadre/01`, § 9, principe 1).
2. **Elle est déployée.** En **recette**, où la cliente la vérifie ; et en **production**, fermée au public tant que l'ouverture n'est pas décidée (ENV-054). Chaque livraison répète donc le déploiement de production.
3. **Elle se démontre.** SYMLOOP joue le scénario de démonstration du § 4 devant la cliente, puis lui remet le cahier de recette de la livraison (QUA-071).
4. **Elle est vérifiée.** La cliente a sept jours ouvrés (contrat, article 7 ; QUA-070). Ses remarques mineures sont traitées dans la livraison suivante.
5. **Elle a un numéro** et sa liste de changements (ENV-053) : 0.2, 0.4, 0.6, 0.8, 1.0.
6. **Ses maquettes sont prêtes juste avant elle** (`07-design/02`, § 5) : on ne dessine pas tous les écrans d'avance, on valide ceux de la livraison qui commence.
7. **Rien n'est refait.** Une livraison ajoute ; elle ne reprend pas ce qui a été accepté, sauf anomalie ou décision écrite.

### 1.3 Ce que cela change dans l'ordre des travaux

Pour que chaque livraison tienne debout sans la suivante, plusieurs choses sont avancées ou précisées par rapport à un découpage strict par module :

- **L'équipe** (inviter, régler un rôle, désactiver) est livrée avec le socle (paquet 1.9), pas avec l'administration du Lot 6 : sans elle, la première livraison ne servirait à personne.
- **Les demandes reçues** se lisent dans le back-office dès la livraison 2 (paquet 2.11) : un formulaire dont personne ne peut lire les réponses ne « fonctionne » pas. Leur traitement complet reste au Lot 3.
- **Chaque paquet branche les e-mails et les notifications de ses propres événements**, avec les textes d'origine (NOT-060). Le Lot 5 livre ce qui permet de les **piloter** : préférences, modèles modifiables, journal, écran des règles, envoi groupé.
- **Le moteur des automatisations est dans le socle** (paquet 1.4 : boîte d'envoi, exécution des règles, planificateur). Chaque paquet livre ensuite **ses** règles, **ses** tâches planifiées et **ses** modèles (AUT-083, D-068) : l'option qui expire fonctionne avec la réservation (4.4), les relances de pièces avec les pièces (4.2), le suivi des banques avec les soumissions (4.7). Le paquet 5.5 n'apporte que l'**écran de réglage** des règles.
- **L'e-mail écrit à la main** (fenêtre d'envoi, COM-020) arrive avec le traitement des demandes (paquet 3.2) : les écrans des livraisons 3 et 4 en ont besoin (écrire à un client, prévenir un promoteur, relancer une banque). Le journal des envois et l'éditeur de modèles restent au Lot 5.
- **Mettre en pause, clôturer, rouvrir, supprimer un dossier** arrivent avec le dossier (paquet 3.7), pas avec le pipeline : une demande sans suite doit pouvoir se clore dès la livraison 3.
- **Des textes légaux provisoires sont en vigueur dès l'installation** (PAR-083), et les e-mails partent de l'adresse de l'environnement tant que celle de la société n'est pas réglée (NOT-003) : l'inscription et les invitations fonctionnent donc dès les livraisons 1 et 2, bien avant les écrans qui règlent ces deux points (Lot 6).
- **Une horloge de recette** (ENV-032, paquet 1.4) permet de démontrer ce qui dépend du temps : une option qui expire, une relance à J+3.
- **La production existe dès la livraison 1.** Le Lot 6 n'y fait plus un premier déploiement : il passe les essais de durcissement et **ouvre** le site.

## 2. Travailler avec un agent de développement

**1. Un paquet par session.** La consigne donnée à l'agent nomme le paquet (« Réalise le paquet 3.2 ») et rien d'autre. L'agent lit d'abord les fichiers de la colonne « À lire », puis `00-cadre/04` (règles transverses) et le guide du README (§ 5).

**2. Le fichier d'instructions du dépôt.** À la racine du dépôt de code, un fichier `CLAUDE.md` contient, tel quel :

```markdown
# Diaspora Patrimoine — instructions pour l'agent

Les spécifications du dossier `Specs/` sont la seule référence. Avant d'écrire du code :
1. Lis `Specs/README.md`, § 5 (guide), puis les fichiers cités par le paquet de travail
   dans `Specs/08-tracabilite/02-plan-de-realisation.md`, puis `Specs/00-cadre/04` (règles
   transverses). Garde sous la main `Specs/07-design/03` (textes), `Specs/01-domaine/01` § 3
   (énumérations), `Specs/00-cadre/05` (décisions et valeurs par défaut), `Specs/01-domaine/10`
   (paramètres), `Specs/00-cadre/02` (permissions) et `Specs/06-technique/02` (API-100,
   API-101 : toute route s'y ajoute avant d'être codée). Dans le plan, `06/01` désigne
   `Specs/06-technique/01-…` : le dossier, puis le numéro du fichier.
2. Ne construis que ce qui est [P1] : une règle sans étiquette prend celle de sa section ;
   dans une règle [P1], une phrase marquée [P1+], [P2], [P3], [MOB], [IA] ou [V2] ne se
   construit pas — seul son repli, s'il est décrit. Les tables des phases suivantes sont
   créées par le paquet 1.2 ; leurs écrans et leurs routes ne se construisent pas.
3. N'invente aucun comportement. Situation non décrite : ajoute une question Q-nnn dans
   `Specs/00-cadre/05-decisions-et-questions.md`, avec une valeur par défaut prudente,
   applique-la, et signale-la dans ton compte rendu.
4. Chaque test porte l'identifiant de la règle qu'il vérifie. Chaque commit cite les
   règles réalisées.
5. Aucun texte visible et aucun paramètre métier en dur.
6. Toute écriture suit `Specs/06-technique/04-fiabilite-des-donnees.md`.
7. Si le code s'écarte d'une spec, corrige la spec dans le même commit et complète, dans
   le journal du README, la ligne de la version en cours (« 1.5 – en cours »).
8. Termine par : les règles couvertes, les tests ajoutés, les questions ouvertes, ce qui reste.
9. Le projet se livre en cinq livraisons (plan, § 1). Ne commence pas un paquet d'une
   livraison tant que la précédente n'est pas close (ce que « close » veut dire pour toi :
   QUA-074). Un paquet branche les e-mails et les notifications de ses propres événements. Aucune entrée de menu, aucun bouton ne mène
   à une fonction qui n'est pas encore livrée.
10. Pour clore une livraison : joue son scénario de démonstration (plan, § 4) de bout en
    bout sur l'environnement de recette, vérifie que ses parcours de recette sont verts,
    étiquette la version, mets à jour le tableau de suivi (plan, § 5).
```

**3. Tranches verticales.** Un paquet livre ensemble : le cas d'usage de l'API, son écran, ses tests, ses textes, ses e-mails. On ne construit pas « toute l'API », puis « tous les écrans ».

**4. Les maquettes.** Un écran se construit d'après sa maquette Figma validée (`07-design/02`). Sans maquette validée : avec les composants du système de design, sans style nouveau (DSN-003).

**5. Fin d'un paquet.** Tests verts ; contrôles de QUA-040 verts ; la ligne du paquet mise à jour dans le tableau du § 5.

**6. Fin d'une livraison.** Tous ses paquets sont faits ; son scénario de démonstration se joue sans accroc en recette ; ses parcours de bout en bout sont verts (QUA-010) ; la version est étiquetée et déployée en recette et en production (ENV-054) ; le cahier de recette est remis (QUA-071). Pour l'agent, la livraison est close plus tôt, sans attendre la production ni la démonstration (QUA-074).

## 3. Paquets de travail

« Recette » renvoie aux parcours de QUA-030.

| Lot | Contenu contractuel | Paquets | Livraison |
|---|---|---|---|
| 0 | Cadrage et conception : UX, spécifications, design système | Ces specs ; maquettes Figma | Avant L1, puis au fil des livraisons pour les maquettes |
| 1 | Socle : modèle de données, authentification, rôles, CI/CD, hébergement | 1.1 à 1.9 | L1 |
| 2 | Espace public et catalogue ; espace client ; simulateurs | 2.1 à 2.11 | L2 |
| 3 | Back-office : CRM, promoteurs, annonces, rapprochement | 3.1 à 3.8 | L3 |
| 4 | GED ; workflow et pipeline ; suivi bancaire | 4.1 à 4.7 | L4 |
| 5 | Communication, e-mailing, notifications | 5.1 à 5.6 | L5 |
| 6 | Tableau de bord ; feedback ; recette ; durcissement ; mise en production ; formation | 6.1 à 6.8 | L5 |

### Lot 1 — Socle (livraison 1)

| # | Paquet | À lire | Livre | Recette |
|---|---|---|---|---|
| 1.1 | **Dépôt et outillage** : structure, paquets partagés, contrôles automatiques, environnements local et éphémère | `06/01`, `06/06` (QUA-040), `06/07` | Dépôt qui se construit ; chaîne d'intégration verte ; environnement local sans conteneur : PostgreSQL embarqué, stockage sur disque, e-mails en fichiers, limites et caches en mémoire (ENV-041, D-097) ; Redis, antivirus et Mailpit rejoignent les environnements hébergés | — |
| 1.2 | **Schéma de données** complet, toutes phases | `01/01` à `01/05`, `06/04` (FIA-002), `05/01` (§ 6), `05/02` (§ 5) | Schéma Prisma ; première migration ; contraintes et index uniques partiels ; extensions | — |
| 1.3 | **Contrats et domaine** : énumérations et libellés, codes d'erreur, permissions ; calculs, calendrier, complétude | `01/01` (§ 3), `01/07`, `00/02`, `00/04`, `06/02` (API-002, API-020, API-102), `07/03` (§ 4) | `packages/contracts`, `packages/domain`, avec les exemples chiffrés en tests. Les tables de transitions (ARC-012) s'ajoutent à `packages/domain` avec le paquet qui livre chaque objet (3.2, 3.5, 3.7, 3.8, 4.x) | — |
| 1.4 | **Fondations de l'API** : erreurs, idempotence, verrouillage, références, paramètres, journal d'audit, boîte d'envoi, files, flux temps réel ; **moteur des automatisations** (exécution des règles, planificateur, journal des tâches planifiées) ; horloge de l'application et son décalage de recette ; alertes techniques (AUT-076) | `06/02`, `06/04`, `01/10` (§ 1), `01/08` (§ 1 à 4, § 8, AUT-076), `06/07` (ENV-032), `04/13` (§ 7) | Modules `platform` ; travailleurs ; diagnostic minimal (EA-102 : blocs Version, Santé, Files d'attente, Tâches planifiées, Horloge, Boîte d'envoi, E-mails, Erreurs et Contrôle des caches de ADM-080 ; Stockage et Règles arrivent avec le paquet 6.4) ; tâches `outbox.dispatch`, `workflow.execute`, `jobs.watchdog`, `cache.audit` (contrôles de la plateforme) et `purge` (lignes de AUT-091 qui touchent la plateforme et l'identité : clés d'idempotence, événements traités, exécutions de règles, `JobRun`, jetons, sessions) | — |
| 1.5 | **Fichiers** : dépôt en trois temps, antivirus, liens signés, déclinaisons d'images | `06/05`, `06/02` (API-080) | Service de fichiers, public et privé ; ligne « dépôts annoncés » de `purge` (AUT-091) | — |
| 1.6 | **Identité** : comptes, sessions, jetons, double authentification, rôles et permissions | `03/01`, `06/03` (§ 1 à 6), `00/02`, `04/01` (BO-001 à BO-005), `06/02` (API-003), `01/02` (§ 1) | Routes `/auth` communes et du personnel : `login`, `login/two-factor`, `logout`, `refresh`, `confirm-password`, `password/forgot`, `password/reset`, `staff-setup/*` ; gardes ; test de la matrice des permissions | P24 |
| 1.7 | **E-mails** : interface du fournisseur, habillage, rendu des modèles, retours de statut, garde-fou de recette ; conservation **sans** liens personnels ni codes (NOT-002) ; expéditeur pris dans l'environnement tant que le paramètre est vide (NOT-003) ; adresse en erreur (marque sur la fiche, AUT-071) | `01/09` (§ 1, § 4, § 5, § 6.1, § 6.7), `06/02` (API-095), `07/03` (§ 7) | Envoi et journalisation ; modèles de compte ; EM-01 (habillage) | — (la règle de P38 est tenue ici par un test automatisé) |
| 1.8 | **Données de départ** — dont les textes légaux provisoires, en vigueur (PAR-083) — et de démonstration, limitées à ce que la livraison sait montrer (PAR-082) ; **système de design** en code ; gabarit du back-office (connexion, menu, liste, fiche) | `01/10`, `07/01`, `04/01`, `00/04` (§ 7 à § 11) | Installation rejouable ; `packages/ui` avec les jetons de mouvement et les comportements communs : tableau, pastilles de filtres, suggestions, messages d'erreur, aide « ? », taille du texte (DSN-053 à DSN-056, DSN-071 à DSN-075 ; TRV-105, TRV-107 à TRV-109, TRV-113 à TRV-118, TRV-123 à TRV-126) ; coquille du back-office ; EA-00 | — |
| 1.9 | **Première livraison utilisable** : équipe (liste, invitation, rôle, fonction, suspension, double authentification réinitialisée, rétablissement d'un compte Direction) ; « Mes préférences » pour ce qui touche au compte (profil, mot de passe, double authentification, appareils) ; page d'attente du site, encore sans accès réservé (NAV-064) ; recette et production déployées par la chaîne | `04/13` (§ 3 : ADM-030 à ADM-040), `04/01` (BO-002 à BO-007, BO-070), `06/07` (ENV-054), `02/01` (NAV-064), `03/07` (PRO-020, PRO-021), `01/09` (§ 3.2, `NS_TEAM_CHANGE` ; § 6.7) | EA-96 ; EA-104 (Profil, Sécurité) ; EP-29 (page d'attente) ; version 0.2 en recette et en production | P24, P30 |

### Lot 2 — Site public, espace client, simulateurs (livraison 2)

| # | Paquet | À lire | Livre | Recette |
|---|---|---|---|---|
| 2.1 | **Structure du site** : en-tête, pied, référencement, plan du site, cookies, pages d'erreur ; accès réservé de la porte (saisie du mot de passe) | `02/01` | Coquille du site ; données structurées ; EP-29 (accès réservé, pages d'erreur), EP-30 | P01 |
| 2.2 | **Catalogue** : lecture publique, recherche, filtres, tri, pagination, carte de bien | `02/03`, `01/03`, `01/07` (CAL-020 à CAL-033, CAL-080) | EP-02, EP-03 | P01 |
| 2.3 | **Fiches** bien et programme, galerie, carte, biens similaires | `02/04` | EP-04 à EP-06 | P01 |
| 2.4 | **Accueil**, avec ses replis | `02/02` | EP-01 | P01 |
| 2.5 | **Demandes** : formulaires, protection, enregistrement, accusés de réception | `02/05`, `01/06` (§ 1), `01/04` (§ 1, § 2.1, § 2.4), `01/07` (CAL-060 à CAL-062) | EP-07 ; le formulaire de EP-19, dont « Être rappelé » ; fiche client et dossier créés. Le lien « Signaler une erreur » (DEM-018) arrive avec le paquet 3.5, quand de vraies fiches existent et que quelqu'un peut le lire | P02, P03, P27 |
| 2.6 | **Simulateurs** d'éligibilité et de crédit, PDF, envoi par e-mail, demande de rappel | `02/06`, `01/07` (§ 4 à 6) | EP-11, EP-12 | P05 |
| 2.7 | **Pages** : Notre concept, Financements, Promoteurs, Partenaires, questions fréquentes, Contact (la page ; son formulaire vient du paquet 2.5), pages légales | `02/08` | EP-08 à EP-10, EP-16 à EP-19, EP-24 | P01 |
| 2.8 | **Espace client** : gabarit, tableau de bord, suivi, intérêts et demandes, biens proposés (lecture), profil, sécurité, accords donnés ; **« Écrire à mon conseiller »** en attendant la messagerie (MSG-021) ; la cloche et le bloc « Dernières nouvelles », où se lisent les notifications dès maintenant (ECL-002, ECL-010) ; les replis de ECL-006 | `03/02`, `03/03`, `03/07`, `03/05` (MSG-021, MSG-046) | EC-10 à EC-13, EC-50, EC-51, EC-53 (mes accords). « Je retiens ce bien » (EC-12) arrive avec le paquet 3.7, qui le traite ; d'ici là, son repli (ECL-006). De même pour les autres réponses sur un bien envisagé (« Ce bien ne m'intéresse plus », « Finalement, il m'intéresse », « Annuler mon choix ») : en livraison 2, la carte de EC-12 n'a que « Voir le bien » et « Écrire à mon conseiller » (ECL-006). Le panneau et la page des notifications (EC-31) et leurs préférences (EC-52) arrivent avec le paquet 5.1 ; l'export et la suppression du compte, avec le paquet 6.5 | P04, P36 |
| 2.9 | **Pièces côté client** : liste, dépôt (photos réunies en PDF, MED-032), versions, accord de transmission ; simulations enregistrées | `03/04` (§ 1, § 2, § 4), `03/06` (§ 1), `01/06` (§ 8), `06/05` (MED-032) | EC-20, EC-21, EC-40. « Mes pièces » n'apparaît que sur un dossier qui a une liste de pièces : en livraison 2, les dossiers de démonstration (`pnpm --filter @dp/api demo -- --dossier-pour={adresse}`, PAR-082) ; pour les vrais dossiers, à partir du paquet 4.1. Les emprunteurs côté client (`03/04`, § 3) arrivent avec le paquet 4.1 | P13 (dépôt) |
| 2.10 | **Compte client** : inscription, vérification de l'adresse et sa relance (`R_VERIFICATION_REMINDER`), connexion, mot de passe oublié, connexion par lien, double authentification, nouvelles conditions | `03/01`, `01/08` (AUT-045) | EC-01 à EC-09 ; les routes `/auth` du client : `signup`, `signup/email`, `verify-email`, `verify-email/resend`, `verify-email/disown`, `email-change/confirm`, `activate`, `magic-link`, `magic-link/consume`, `legal/accept`, `legal/decline`, `action-code` (`preview/exchange` : paquet 3.3) | P04, P06 |
| 2.11 | **Demandes reçues, en lecture** : liste et fiche d'une demande dans le back-office, y compris les messages envoyés par « Écrire à mon conseiller » ; alerte par e-mail à l'équipe (`S_LEAD_NEW`) | `04/03` (§ 1, § 2), `01/09` (NOT-030), `03/05` (MSG-021) | EA-10, EA-11, en lecture seule | P02 |

### Lot 3 — Back-office : CRM, promoteurs, annonces, rapprochement (livraison 3)

| # | Paquet | À lire | Livre | Recette |
|---|---|---|---|---|
| 3.1 | **Socle du back-office** complet : recherche globale, « + Créer », listes, vues, chronologie, notes, cloche des notifications de l'équipe | `04/01` | EA-105, EA-106 (regroupement par compteur, NOT-016, et préférences de notification : paquet 5.1 ; la règle « une opération, une notification » — NOT-035, `Notification.dedupeKey` et sa table de priorité — fait partie de ce paquet-ci) ; l'aide « ? » (BO-081) | P24 |
| 3.2 | **Demandes** : saisie par l'équipe, prise en charge, affectation, appels, clôture, demandes à vérifier (complète le paquet 2.11) ; leurs règles (AUT-040) ; **e-mail écrit à la main** (fenêtre d'envoi et modèles manuels d'origine, COM-020 à COM-030) ; signature et absence dans « Mes préférences » (BO-070, CRM-021), et, sur la ligne d'un membre de l'équipe, « Reçoit des demandes » et l'absence (ADM-030) | `04/03` (§ 1 à 5), `01/06` (§ 1), `01/07` (CAL-060, CAL-061), `04/08` (§ 2), `01/08` (AUT-040), `04/01` (BO-013, BO-070) | EA-10, EA-11 ; EA-104 (Signature, Absence) | P02, P07, P31 |
| 3.3 | **Clients** : liste, fiche (avec ou sans e-mail), qualification, score, doublons, fusion, compte, « Voir comme le client » ; onglet Simulations de la fiche, avec « Faire une simulation » (simulateurs de EP-11 et EP-12 dans le gabarit du back-office, préremplis avec la fiche, enregistrés avec `Simulation.clientId` et `createdById`) | `04/03` (§ 6 à 9), `01/07` (CAL-070), `00/02` (ROL-017) | EA-12, EA-13 | P07, P20, P26, P37 |
| 3.4 | **Promoteurs** : fiche, contacts, sélection, convention, relation ; bloc « Ce que nous attendons de lui », avec ce que la livraison sait déjà suivre — disponibilités, livraisons, documents ; les visites s'y ajoutent au paquet 3.8, les options, réservations et acomptes au paquet 4.4 (ACP-015) ; échéance d'une convention ou d'un document (AUT-073) | `04/04` (§ 1), `01/06` (§ 13), `00/06`, `01/08` (AUT-073) | EA-50, EA-51 | P09, P41 (disponibilités, livraison) |
| 3.5 | **Programmes, biens, lots**, complétude, publication, mise en avant ; autres partenaires ; droits et traces du catalogue ; « Signaler une erreur » sur une fiche et sa tâche (DEM-018, `R_LISTING_ERROR`) ; **disponibilités vérifiées** avec le promoteur et leur tâche périodique (CTL-064, AUT-079) ; livraison dépassée (AUT-074), programme entièrement vendu (AUT-078) | `04/04` (§ 2 à 4, § 9 à 11), `01/06` (§ 6, § 7), `01/07` (CAL-050), `01/08` (AUT-067, AUT-074, AUT-078, AUT-079, `R_LISTING_ERROR`), `01/05` (`Feedback`), `02/05` (DEM-018), `02/04` (FIC-055), `04/11` (FBK-005) | EA-40 à EA-43, EA-46, EA-47 | P09, P10, P40 |
| 3.6 | **Médias** et **import de lots** | `04/04` (§ 5, § 6), `06/05`, `01/05` (`ImportJob`) | EA-44, EA-45 | P09 |
| 3.7 | **Dossier** : création, fiche, aperçu, qualification, rapprochement (biens envisagés, propositions), réponses du client, bien retenu et lot envisagé ; **pause, reprise, clôture, réouverture, recul, suppression, changement de conseiller** pour les étapes livrées ; ses règles (AUT-043) ; la page des **préférences d'e-mail sans connexion** (EP-27), puisque le premier e-mail désinscriptible part ici | `04/06` (§ 2 à 4), `01/06` (§ 2 à 4), `03/03`, `01/08` (AUT-043), `03/07` (PRO-031), `03/02` (§ 4), `01/09` (NOT-022) | EA-21, EA-22 (Aperçu, Biens, Échanges — chronologie et ajout rapide —, Historique) ; EC-13 complet ; EC-12 (« Je retiens ce bien ») ; EC-11 (Mon bien : bien retenu, lot envisagé) ; EP-27 | P07, P08 |
| 3.8 | **Tâches et rendez-vous** ; tâches automatiques et leur fermeture (AUT-032, AUT-035) ; règles des rendez-vous (AUT-051) ; résumé du matin (AUT-070) ; adresse en erreur : tâche de correction (`R_EMAIL_BOUNCED`) ; accueil d'une visite sur place par le promoteur, et tâche de le prévenir si elle est annulée ou déplacée (TAC-045, `R_VISIT_HOST_CANCELLED`, `R_VISIT_HOST_RESCHEDULED`) | `04/09`, `01/06` (§ 5, § 12), `01/08` (AUT-032, AUT-035, AUT-051, AUT-070, AUT-071), `03/03` (§ 4), `00/06` (ACP-023) | EA-30, EA-31 ; EA-22 (Tâches) ; EC-14 (liste et annulation, INT-041 à INT-044) | P20, P41 (visite) |

### Lot 4 — GED, workflow et pipeline, suivi bancaire (livraison 4)

| # | Paquet | À lire | Livre | Recette |
|---|---|---|---|---|
| 4.1 | **Modèles de listes** de pièces ; création et réévaluation de la liste d'un dossier ; emprunteurs, côté équipe et côté client | `04/07` (§ 2, § 3), `01/04` (§ 3), `03/04` (§ 3), `04/06` (§ 3, Emprunteurs) | EA-61, EA-62 ; EA-22 (Emprunteurs) | P12 |
| 4.2 | **Vérification des pièces** : visionneuse, validation, rejet, dispense, versions, accord de transmission ; **relances de pièces**, expirations et leurs règles (AUT-042) | `04/07` (§ 4 à 7), `01/06` (§ 8), `01/08` (AUT-042), `06/05` (MED-030, MED-031), `01/02` (§ 1.6, MOD-106), `01/08` (AUT-012), `01/06` (CYC-170) | EA-60, EA-63, EA-64 ; EA-22 (Pièces) | P13, P14 |
| 4.3 | **Pipeline** et machine à états complète : toutes les avancées, le passage avec ou sans financement, et la pause, la clôture, la réouverture et le recul étendus aux étapes de cette livraison ; relance d'activation du compte au passage à « Dossier » (`R_ACTIVATION_REMINDER`) | `04/06` (§ 1, § 4 ; PIP-055, bascule), `01/06` (§ 2), `01/08` (AUT-045), `01/07` (CAL-060 à CAL-062) | EA-20 | P07, P17, P35 |
| 4.4 | **Réservation et acquisition** : option, sa **confirmation par le promoteur** (CYC-107, PIP-053), sa prolongation et son expiration (tâche planifiée et rappel), la tâche de prévenir le promoteur quand un lot est libéré (ACP-023), le lot repris par le promoteur, le conflit signalé par un import sur un lot tenu (`R_LOT_IMPORT_CONFLICT`), réservation, acompte et son suivi, jalons, dossier abouti | `04/06` (PIP-050 à PIP-053), `01/06` (§ 6), `01/08` (AUT-044), `03/02` (§ 4), `04/04` (CTL-102), `00/06` (ACP-020, ACP-023) | EA-22 (Réservation et acquisition) ; EC-11 (Mon bien : réservation, acompte, jalons) | P11, P18, P33, P39, P41 (option) |
| 4.5 | **Banques, produits, taux de change** ; financement des biens (banques qui acceptent un programme ou un bien) ; **barème vérifié** et sa tâche périodique (BNK-024, AUT-079) ; taux de change ancien (AUT-072) ; échéance d'une convention (AUT-073) | `04/05` (§ 1 à 4), `01/02` (§ 3), `04/04` (§ 7), `01/08` (AUT-072, AUT-073, AUT-079) | EA-52 à EA-54, EA-57 ; onglet Financement de EA-41 et EA-43 ; simulateurs branchés sur les produits réels | P15, P32, P40 |
| 4.6 | **Soumissions** : préparation, paquet, lien sécurisé, page de téléchargement | `04/05` (§ 6), `01/06` (§ 9), `06/05` (MED-050) | EA-55, EA-56 ; EA-22 (Financement) ; EP-28 | P15 |
| 4.7 | **Suivi et décision** des banques, correction d'une décision, prolongation d'une offre — chaque réponse avec le nom de l'interlocuteur qui l'a donnée (ACP-013) —, et le bloc « Ce que nous attendons d'elle » (BNK-004) ; leurs règles (AUT-041) ; financement côté client | `04/05` (BNK-004, BNK-120 à BNK-134), `03/04` (§ 5), `01/08` (AUT-041), `00/06` (ACP-021) | EA-56 (Suivi, Décision) ; EC-22 | P16, P17, P34, P41 (banque) |

### Lot 5 — Communication et notifications (livraison 5)

| # | Paquet | À lire | Livre | Recette |
|---|---|---|---|---|
| 5.1 | **Notifications** : panneau et page des notifications, regroupement par compteur (NOT-016), préférences ; couverture complète du catalogue (chaque module crée déjà les siennes) | `01/09` (§ 1 à 3), `03/05` (§ 2), `04/01` (BO-070) | EC-31, EC-52, EA-105 (regroupement par compteur), EA-104 (Notifications) ; le lien « Gérer mes préférences » entre dans les e-mails du personnel (NOT-022) | P13, P19 |
| 5.2 | **E-mails d'événement** : couverture complète — les modèles déjà branchés avec leurs fonctions sont vérifiés un par un, les autres ajoutés | `01/09` (§ 4, § 6), `01/08` (§ 1, § 2) | Tous les e-mails `[P1]` | P02, P16 |
| 5.3 | **Messagerie** client et équipe | `03/05` (§ 1), `04/08` (§ 1) | EC-30, EA-70 ; EA-22 (Échanges : le fil de messagerie rejoint la chronologie) | P19 |
| 5.4 | **Journal des envois**, éditeur de modèles (la fenêtre d'envoi existe depuis le paquet 3.2) | `04/08` (§ 3, § 4) | EA-71 à EA-73 | P21, P38 |
| 5.5 | **Écran des automatisations** : liste des règles, réglage, essai, journal, règles créées par l'équipe (le moteur et les règles d'origine tournent depuis leurs paquets) | `01/08`, `04/08` (§ 5) | EA-74, EA-75 | P21 |
| 5.6 | **Envoi groupé** ; signalements comme indésirable | `04/08` (§ 6), `01/08` (AUT-071) | EA-76 | — |

### Lot 6 — Pilotage, satisfaction, ouverture (livraison 5)

| # | Paquet | À lire | Livre | Recette |
|---|---|---|---|---|
| 6.1 | **Tableau de bord et rapports** | `04/02` | EA-01 à EA-09 | P22 |
| 6.2 | **Enquêtes et retours** | `04/11`, `03/07` (§ 6), `01/08` (AUT-065 à AUT-067) | EA-85, EA-86 ; EC-54 ; EP-25 | P23 |
| 6.3 | **Contenus** : textes du site, pages, questions fréquentes, témoignages, textes légaux, redirections | `04/12` | EA-90 à EA-95 | — |
| 6.4 | **Administration** : équipe (complète le paquet 1.9 : suppression avec réaffectation (ADM-031), réaffectation en nombre, accès exceptionnel du support et sa fin (AUT-077), changement d'adresse), paramètres et carte « Avant la mise en ligne », référentiels, journal d'audit, corbeille, diagnostic complet, imports et exports | `04/13` | EA-96 à EA-99, EA-101 à EA-103 | P24 |
| 6.5 | **Données personnelles** : export, effacement, demandes et leurs alertes (AUT-075, `R_DELETION_REQUESTED`), conservation | `04/13` (§ 5), `03/07` (§ 5), `06/03` (§ 10, § 11), `01/08` (AUT-045, AUT-075) | EA-100 ; EC-53 | P25 |
| 6.6 | **Durcissement** : revue de sécurité, charge, volume, restauration, accessibilité, navigateurs, e-mails | `06/03` (SEC-130), `06/06` (§ 6), `06/04` (§ 9) | Comptes rendus des essais | QUA-080 |
| 6.7 | **Ouverture au public** : listes de contrôle fermées, données de démonstration absentes de la production, indexation ouverte en dernier | `06/07`, `01/10` (§ 10) | Production ouverte ; listes de contrôle fermées | ENV-100, PAR-100 |
| 6.8 | **Documentation et formation** | `06/06` (QUA-090), `04/01` (BO-081) | Guides ; formation de l'équipe ; lien du guide dans l'aide du back-office | — |

### Fonctions ajoutées depuis la signature (D-089)

Chaque paquet se construit **dans la livraison indiquée**, après les paquets de cette livraison dont il dépend ; son indicateur (PAR-010) est vrai par défaut.

| # | Paquet | À lire | Livre |
|---|---|---|---|
| A.1 | **Le Café** — livraison 5 · parcours P28 | `02/07`, `04/10`, `01/06` (§ 10), `01/08` (AUT-056) | EP-13 à EP-15, EA-80 à EA-82, EC-43 |
| A.2 | **Projection et rappel** — livraison 2 (formulaires), livraison 4 (outil de projection, EA-59) · parcours P29 | `02/05` (DEM-013, DEM-014), `04/05` (§ 5) | EP-20, EP-21, EA-59 |
| A.3 | **Mensualité indicative et recherche par budget mensuel** — livraison 2 | `01/07` (§ 3), `04/05` (§ 4), `02/03` | EA-58 ; cartes et filtres |
| A.4 | **Financement islamique** — livraison 2 (contenus, simulateurs), livraison 4 (produits) | `01/07` (CAL-047), `02/08` (EDI-022) | Produits, simulateurs, contenus |
| A.5 | **Assistant guidé** — livraison 2 | `02/09` | EP-22 |
| A.6 | **Favoris et alertes** — livraison 3 · parcours P29 (alertes) | `03/06` (§ 2, § 3), `02/03` (§ 7), `01/08` (AUT-060 à AUT-062) | EC-41, EC-42, EP-26 |
| A.7 | **Visite 360°, chantier, à proximité** — livraison 3 (saisie au back-office et affichage sur les fiches) | `02/04`, `04/04` (§ 8) | Visionneuse ; EA-41 (Chantier, À proximité) |
| A.8 | **Rendez-vous demandés par le client** — livraison 3 | `03/03` (§ 4), `04/09` (TAC-041) | EC-14 : demande de rendez-vous (INT-040) |
| A.9 | **Devenir partenaire** — livraison 2 | `02/05` (DEM-019) | EP-23 |
| A.11 | **Carte, comparateur, regroupement, recherches enregistrées** — livraison 2 (carte, regroupement, comparateur), livraison 3 (recherches enregistrées) | `02/03` (CAT-090 à CAT-093) | EP-02 (vue carte, groupée), EP-31, EC-42 |
| A.12 | **Mode simplifié et aide vocale** — livraison 2 | `00/04` (TRV-122, TRV-127) | Réglage « Aa », formulaires pas à pas, Écouter, Dicter |
| A.13 | **Assistant conversationnel** — livraison 2, après A.5 | `02/09` (ASS-050 à ASS-052), `05/04` (IA-001 à IA-013) | EP-22 en mode conversationnel |
| A.14 | **Inscription des partenaires** — livraison 2 (D-091) | `00/06` (ACP-080 à ACP-087) | EP-32, EP-33 ; panneau « Candidature partenaire » de EA-10 |
| A.10 | **Plusieurs pays** — livraison 5 (activation d'un deuxième pays depuis les référentiels) | `01/10` (PAR-091), `02/03` | Activation d'un pays |

### Sur décision — ouverture anticipée

Le site s'ouvre à la livraison 5 (D-085). L'ouvrir après la livraison 3 ou 4 est possible avec ce paquet, à commander **avant le début** de la livraison concernée (Q-044). Il avance, pour le périmètre déjà livré, ce sans quoi un site ne s'ouvre pas ; rien n'est refait ensuite, les paquets d'origine complètent.

| # | Paquet | Avance | Livre |
|---|---|---|---|
| O | **Ouverture anticipée** | 6.4 (paramètres, carte « Avant la mise en ligne ») · 6.3 (textes du site — dont le comparatif de l'accueil, qui doit être expliqué avant l'ouverture, ACC-043 — et textes légaux : versions, publication) · 4.5 (taux de change), si l'ouverture précède la livraison 4 · 6.5 (export et effacement des données, demandes de droits) · 6.6 (essais de durcissement, sur ce qui est ouvert) · 6.7 (ouverture) | EA-97, EA-90, EA-94, EA-57, EA-100 ; EC-53 (données, suppression) ; production ouverte |

Ce que le site ouvert ne fait pas encore est alors dit au visiteur comme au client par les replis déjà prévus (ECL-006, ACC-090) : aucun bouton ne mène à une fonction absente.

### Après la Phase 1 — accès des promoteurs et des banques (niveaux 2 et 3)

La Phase 1 livre le niveau 1 : l'équipe saisit pour les partenaires. Les niveaux suivants s'ajoutent sans rien refaire (ACP-070), en cinq étapes, chacune objet d'un devis (Q-047). Elles ne font pas partie des cinq livraisons.

| # | Paquet | Après | À lire | Livre |
|---|---|---|---|---|
| B.0 `[P2]` `[P3]` | **Socle des accès** : choix du niveau, interlocuteurs qui répondent, lien de réponse et sa page, demandes envoyées d'office, réponses à relire, relance et silence | Phase 1 | `00/06` (§ 4, § 5, § 7), `01/06` (CYC-241) | Onglet Accès de EA-51 et EA-53 ; page de réponse ; P44 |
| B.1 `[P2]` | **Niveau 2, promoteurs** : ses gestes par lien, page du stock | B.0 | `00/06` (ACP-043), `05/01` (§ 5) | P42 |
| B.2 `[P3]` | **Niveau 2, banques** : panneau « Votre réponse » sur la page du dossier, barème par lien | B.0 | `00/06` (ACP-044), `05/02` (§ 4) | EP-28 étendu ; P43 |
| B.3 `[P2]` | **Niveau 3** : comptes de partenaires, application du portail, portail promoteur | B.0, B.1 | `05/01` (§ 1 à 4) | Application `apps/partner` ; P45 |
| B.4 `[P3]` | **Niveau 3, banques** : portail banque | B.2, B.3 | `05/02` (§ 1 à 3) | Portail banque |

Ce que la Phase 1 fait pour elles tient en une règle — les gestes d'un partenaire sont des commandes de l'API, jamais des règles d'écran (ARC-014) — et en trois informations gardées sur les objets : le promoteur tient-il le lot (paquet 4.4), qui accueille une visite (3.8), quand les disponibilités et les barèmes ont été vérifiés (3.5, 4.5). Le schéma de données (1.2) prévoit déjà leurs tables et leurs champs.

### Hors Phase 1 — ce qui reste `[V2]`

La simplification du 7 octobre (D-086) est annulée (D-090) : toutes les fonctions qu'elle avait différées ou réduites sont construites, entières, dans leur livraison. Reste hors Phase 1 l'interface en arabe et en anglais (TRV-006, NAV-043) : le code est prêt pour plusieurs langues et pour l'écriture de droite à gauche (TRV-003), mais la Phase 1 est servie en français (TRV-001).

## 4. Les cinq livraisons, une par une

Pour chacune : ce qui fonctionne, ce qui n'est pas encore là et ce que l'écran fait à la place, la démonstration, la recette, l'état de la production.

### Livraison 1 — Le socle en ligne (Lot 1, version 0.2, 24 %)

**Ce qui fonctionne.** La chaîne construit, teste et déploie seule la recette et la production. La base contient tout le modèle de données et les données de départ. Un membre de l'équipe se connecte au back-office avec la double authentification ; la Direction invite un collaborateur, règle son rôle, le suspend, réinitialise sa double authentification ; le mot de passe oublié fonctionne ; chaque action sensible est tracée. Un e-mail part et son statut revient. Un fichier se dépose, passe l'antivirus, se relit par un lien signé. Le site public répond par sa page d'attente.

**Pas encore là.** Tout le métier. Le menu du back-office ne montre que « Équipe », « Diagnostic » (pour qui en a le droit) et le menu du compte, avec « Mes préférences » (profil et sécurité) ; il s'allonge à chaque livraison (BO-011). La barre du haut n'a encore ni recherche, ni « + Créer », ni cloche (BO-010). La page d'arrivée est « Équipe ». La page d'attente du site n'a pas encore d'accès réservé : rien n'existe derrière (NAV-064).

**Démonstration** (10 minutes).
1. L'adresse du site affiche la page d'attente ; l'adresse du back-office, la connexion.
2. La Direction se connecte, configure sa double authentification, accepte la charte.
3. Elle invite un conseiller. L'invitation arrive ; il choisit son mot de passe, configure sa double authentification, entre.
4. Le conseiller ouvre « Équipe » : il voit la liste de ses collègues, sans aucun bouton pour inviter, modifier ou suspendre (il a `user.read`, pas `user.manage`) ; l'adresse du diagnostic lui répond « Vous n'avez pas accès à cette page. ».
5. Le conseiller ouvre « Mes préférences » : il change son mot de passe, voit ses appareils connectés.
6. La Direction suspend le compte : la session du conseiller se ferme.
7. Le diagnostic affiche la version 0.2 et les services au vert.

Le journal d'audit de ces gestes existe en base, et l'e-mail d'invitation y est conservé **sans** son lien : un test automatisé le vérifie à chaque livraison ; la cliente le constate à l'écran avec le journal des envois, à la livraison 5 (P38).

**Recette.** P24 (droits, sur le périmètre livré), P30.

**Production.** Créée, déployée par la chaîne, fermée (ENV-054). Le premier compte Direction y est activé.

### Livraison 2 — Le site et l'espace client (Lot 2, version 0.4, 42 %)

**Ce qui fonctionne.** L'accueil (avec ses replis), le catalogue, ses filtres, les fiches, la galerie ; les pages Notre concept, Financements, Promoteurs, Partenaires, questions fréquentes, Contact, pages légales ; les deux simulateurs, leur PDF, leur envoi par e-mail. Une demande s'enregistre, son accusé de réception part, la fiche du client et son dossier se créent. Le visiteur crée son espace, vérifie son adresse, se connecte, y retrouve ses demandes, ses simulations, son profil, ses réglages de sécurité. L'équipe reçoit un e-mail pour chaque demande et la lit dans le back-office.

**Pas encore là, et ce que l'écran fait à la place.**

| Fonction | Arrive en | En attendant |
|---|---|---|
| Gérer les biens dans le back-office | L3 | Les biens affichés sont ceux du jeu de démonstration (PAR-082). |
| Traiter une demande (prise en charge, appels, clôture) | L3 | La demande se lit ; l'équipe rappelle le client par ses propres moyens. |
| Biens proposés par le conseiller | L3 | L'écran existe, avec son état vide (INT-023) : « Votre conseiller n'a pas encore proposé de bien. » |
| Pièces d'un vrai dossier | L4 | « Mes pièces » n'apparaît que lorsqu'une liste de pièces existe. |
| Messagerie | L5 | « Écrire à mon conseiller » (MSG-021) : un formulaire court dans l'espace ; le message arrive dans les demandes de l'équipe. Tous les boutons « Écrire » y mènent. |
| Panneau et page des notifications | L5 | La cloche mène au bloc « Dernières nouvelles » du tableau de bord, où chaque notification se lit et s'ouvre. |
| Modifier les textes du site, publier les textes légaux | L5 | Les textes sont ceux des données de départ ; SYMLOOP les corrige sur demande. Les textes légaux sont les versions provisoires « 0.1 – projet », en vigueur et marquées comme telles (PAR-083). |
| « Signaler une erreur » sur une fiche | L3 | Le lien n'existe pas encore (les fiches sont celles du jeu de démonstration). |

**Démonstration** (20 minutes). P01 sur ordinateur, puis sur téléphone ; P05 ; P02 jusqu'à la lecture de la demande dans le back-office ; P03 ; P04 ; P06.

**Recette.** P01, P02 (jusqu'à la lecture), P03, P04, P05, P06, P27, P36, et P13 pour le dépôt d'une pièce sur un dossier de démonstration.

**Production.** Version 0.4 déployée, fermée. Les biens réels n'y sont pas encore.

### Livraison 3 — Le back-office commercial (Lot 3, version 0.6, 61 %)

**Ce qui fonctionne.** La boîte d'arrivée des demandes avec ses échéances, la saisie d'une demande reçue par téléphone (avec ou sans e-mail), la prise en charge, l'affectation, les appels, l'e-mail écrit à la main, la clôture ; les fiches clients, leur qualification, les doublons, la fusion, l'aperçu de l'espace d'un client ; les promoteurs ; les programmes, les biens, les lots, la complétude, la publication, la mise en avant sur l'accueil ; les médias ; l'import d'une grille de lots ; le dossier, sa qualification, le rapprochement, sa mise en pause, sa clôture, sa réouverture ; les réponses du client depuis son espace, son bien retenu ; les tâches — celles que l'équipe crée et celles que les règles créent —, les rendez-vous, le résumé du matin ; la recherche globale, les vues, la chronologie.

**Pas encore là.**

| Fonction | Arrive en | En attendant |
|---|---|---|
| Étapes « Dossier », « Banque », « Accord », « Acquisition » | L4 | Un dossier avance jusqu'à « Mise en relation » ; l'action suivante n'est pas proposée. Les deux dossiers de démonstration déjà à « Dossier » (PAR-082) s'ouvrent tels quels, sans les onglets à venir. |
| Réserver un lot | L4 | Le lot reste « Disponible » ; le conseiller peut le **viser** pour son dossier (« Choisir le lot », onglet Biens, PIP-033), et son état se change à la main dans la grille des lots. |
| Onglets Pièces, Financement, Réservation, Emprunteurs d'un dossier ; onglet Financement d'un bien | L4 | Onglets absents. |
| Fil de messagerie d'un dossier | L5 | L'onglet Échanges montre déjà la chronologie du dossier et sa barre d'ajout rapide (note, appel, e-mail) ; les messages du client arrivent par « Écrire à mon conseiller », dans les demandes. |
| Régler les règles, modifier les modèles d'e-mails, journal des envois | L5 | Les règles et les e-mails de cette livraison tournent avec leurs réglages et leurs textes d'origine ; chaque e-mail envoyé se lit dans la chronologie de son client. |
| Tableau de bord | L5 | La page d'accueil du back-office est la boîte d'arrivée des demandes. |
| Taux de change (EA-57) | L4 | Le cours de départ (PAR-042) convertit les prix en dinars que l'équipe saisit ; le site étant fermé (D-085), seule l'équipe voit ces conversions. Le cours réel se saisit à la livraison 4, ou plus tôt avec le paquet « Ouverture anticipée », qui avance l'écran des taux. |

**Démonstration** (30 minutes). P09 et P10 : créer un promoteur, un programme, importer ses lots, publier, voir le bien sur le site ; P02, P07 : une demande arrive, elle est prise en charge, le client est qualifié ; P08 : trois biens proposés, le client répond ; P26.

**Recette.** P02 (complet), P07, P08, P09, P10, P20, P24, P26, P31, P36, P37, P40 (disponibilités), P41 (promoteur : disponibilités, livraison, visite).

**Production.** Version 0.6 déployée. À partir de cette livraison, l'équipe de Diaspora Patrimoine peut y saisir ses vrais promoteurs, programmes et biens, site fermé. Le site reste fermé jusqu'à la livraison 5 (D-085) ; l'ouvrir plus tôt demande le paquet « Ouverture anticipée » (§ 3), commandé avant le début de la livraison (Q-044).

### Livraison 4 — Dossiers, pièces et banques (Lot 4, version 0.8, 79 %)

**Ce qui fonctionne.** Le passage à « Dossier » crée la liste des pièces selon le profil ; le client les dépose, depuis son téléphone aussi ; le conseiller les valide, les rejette avec un motif, en dispense ; la complétude avance ; le pipeline et toutes ses transitions, la pause, la clôture, la réouverture ; l'option, la réservation, l'acquisition, le lot vendu ; les banques, leurs produits, les taux de change, les simulateurs branchés sur les vrais barèmes ; la soumission, son paquet, son lien sécurisé, la page de téléchargement de la banque ; le suivi, le complément demandé, la décision ; le financement vu par le client.

**Pas encore là.**

| Fonction | Arrive en | En attendant |
|---|---|---|
| Régler les relances (délais, textes) | L5 | Les relances de pièces, le rappel d'une option, le suivi des banques tournent avec leurs réglages d'origine. |
| Messagerie | L5 | « Écrire à mon conseiller » côté client ; les échanges se notent dans la chronologie du dossier. |
| Enquêtes (après proposition, dossier complet, décision bancaire, après acquisition) | L5 | Aucune n'est envoyée ; elles ne sont pas rattrapées à la livraison du paquet 6.2. |
| Message automatique de validation dans le fil du client (CYC-142) | L5 | La notification `NC_DOC_VALIDATED` seule. |

**Démonstration** (35 minutes). P12, P13 avec un vrai téléphone, P14 et P11 avec l'horloge de recette (une relance à J+3, une option qui expire), P15, P16, P18 jusqu'au dossier abouti.

**Recette.** P11, P12, P13, P14, P15, P16, P17, P18 (hors enquête), P32 à P36, P39, P40 (barème), P41 (option, banque).

**Production.** Version 0.8 déployée.

### Livraison 5 — Communication, pilotage, ouverture (Lots 5 et 6, version 1.0, 100 %)

**Ce qui fonctionne.** Tout le périmètre `[P1]` : la messagerie ; le panneau, la page et les préférences de notification ; le journal des envois, les modèles modifiables ; l'écran des règles d'automatisation ; l'envoi groupé ; le tableau de bord et les rapports ; les enquêtes et les retours ; les textes du site, les pages, les questions fréquentes, les textes légaux ; les paramètres, les référentiels, le journal d'audit, la corbeille ; les données personnelles.

**Démonstration** (45 minutes). P19, P21, P22, P23, P25.

**Recette.** La **recette définitive** : tous les parcours P01 à P27 et P30 à P41, les essais de QUA-080, les listes de ENV-100 et de PAR-100.

**Production.** Version 1.0. Ouverture au public (paquet 6.7), formation, remise des guides (QUA-090).

### Ce que chaque livraison montre au client

Un bouton ou une entrée n'apparaît qu'avec sa fonction (ECL-006). Récapitulatif pour l'espace client et pour les e-mails :

| Élément | L2 | L3 | L4 | L5 |
|---|---|---|---|---|
| Tableau de bord, Mes intérêts et mes demandes, Simulations, Profil, Sécurité, Mes accords | ● | ● | ● | ● |
| Écrire à son conseiller | Formulaire court (MSG-021) | idem | idem | Messagerie |
| Notifications | Cloche → « Dernières nouvelles » | idem | idem | Panneau, page, préférences |
| « Je retiens ce bien » | « Écrire à mon conseiller » | ● | ● | ● |
| Biens proposés | État vide | Propositions et réponses | ● | ● |
| Rendez-vous | — | Liste, annulation | ● | ● |
| Mon dossier › Suivi | ● | ● | ● | ● |
| Mon dossier › Mon bien | — | Bien retenu, lot envisagé | Réservation, acompte, jalons | ● |
| Mon dossier › Pièces | Sur un dossier de démonstration | idem | Vrais dossiers, emprunteurs | ● |
| Mon dossier › Financement | — | — | ● | ● |
| Lien « Gérer mes préférences » des e-mails | (aucun e-mail désinscriptible) | Page sans connexion (EP-27) | ● | + écran du profil |
| Mon avis, enquêtes | — | — | — | ● |
| Télécharger mes données, supprimer mon compte | — | — | — | ● |

Les dossiers du jeu de démonstration ne dépassent jamais l'étape que la livraison sait montrer (PAR-082) : « Dossier » aux livraisons 2 et 3, pour « Mes pièces » ; toutes les étapes ensuite.

## 5. Suivi

À tenir à jour par l'agent à la fin de chaque paquet : « À faire », « En cours », « Fait », avec la date et la version livrée.

| Livraison | Paquets | État | Date | Version | Remarques |
|---|---|---|---|---|---|
| Lot 0 | Spécifications | Fait | 03/10/2026 | 1.2 | Audit de bout en bout (`08-tracabilite/03`) |
| Lot 0 | Maquettes | En cours | | | Système de design et accueil faits ; suite livraison par livraison (`07-design/02`, § 5) |
| L1 | 1.1 à 1.9 | En cours | 11/10/2026 | 0.2 | Faits : 1.2, 1.3, 1.6. Partiels : 1.1 (ni git ni chaîne d'intégration ni environnements en ligne), 1.4 (moteur des automatisations en cours), 1.5 et 1.7 (stockage, antivirus et fournisseur d'e-mail à brancher). Faits le 11/10/2026 : 1.8 (gabarit du back-office, `apps/admin`) et, de 1.9, l'équipe et « Mes préférences » — reste le déploiement. Détail : fichier de suivi à la racine du dépôt |
| L2 | 2.1 à 2.11 | En cours | 11/10/2026 | 0.4 | Faits : 2.1 à 2.10, et les paquets A.2, A.5, A.6, A.9, A.11, A.13, A.14 (côté partenaire). 2.11 fait le 11/10/2026. Rien n'est déployé |
| L3 | 3.1 à 3.8 | En cours | 11/10/2026 | 0.6 | Fait : 3.1 (socle du back-office, 11/10/2026) ; 3.7 (dossier) et 3.8 (tâches et rendez-vous) le 11/10/2026 — avancées jusqu'à « Mise en relation » (Q-078), routes des réponses du client prêtes, boutons de l'espace client (EC-12, EC-14) à brancher (SUIVI, § 3). Les services d'écriture du catalogue et des Cafés existent déjà côté API. 3.4, 3.5, 3.6 en partie (🟡) le 11/10/2026 : écrans du catalogue, des promoteurs et des autres partenaires, médias, import de lots, candidatures (ACP-084), veille `partner.scan` ; reste : « Régénérer l'adresse » (TRV-052) et « Aperçu » par lien signé (FIC-120) des programmes et des biens ; placement par clic sur la carte (CTL-021, Q-094 : latitude et longitude en attendant) ; proposition de reporter une nouvelle date de livraison sur les lots (textes prêts, fenêtre non branchée) ; « Signaler une erreur » sur une fiche et sa tâche (DEM-018, `R_LISTING_ERROR`) ; livraison dépassée (AUT-074, `R_DELIVERY_OVERDUE`) et programme entièrement vendu (AUT-078, `R_PROGRAM_SOLD_OUT`) ; archivage automatique des biens vendus (CYC-123) ; « Écrire au promoteur » (CTL-006, à brancher sur la fenêtre d'e-mail manuel du paquet 3.2) ; plans PDF sur la fiche publique (Q-095) ; entrée de règle `R_LOT_IMPORT_CONFLICT` (la tâche est créée par un gestionnaire système en attendant le paquet 4.4) Le 15/10/2026 : 3.2 terminé (pièces jointes, e-mail reçu, échanges depuis un dossier, clôture avec le dossier, fiche partenaire, affectation des demandes saisies). |
| L4 | 4.1 à 4.7 | À faire | | 0.8 | |
| L5 | 5.1 à 5.6, 6.1 à 6.8 | À faire | | 1.0 | |

## 6. Dépendances à lever côté Diaspora Patrimoine et SYMLOOP

La première ligne revient à SYMLOOP et précède le travail de l'agent de développement : ce sont des choix d'hébergement et de sous-traitants (D-059) qu'il ne peut ni faire ni ouvrir, et sans eux le paquet 1.1 ne déploie rien. Les autres ne bloquent pas le développement — chacune a une valeur par défaut (`00-cadre/05`) — mais elles conditionnent ce que la livraison peut **montrer de réel**, puis l'ouverture.

| Avant | Il faut | Question |
|---|---|---|
| Paquet 1.1 | SYMLOOP choisit et remet : l'hébergeur et sa région dans l'Union ; le fournisseur d'e-mail (la valeur par défaut de Q-030, confirmée au plus tard avant le paquet 1.7) ; l'outil de suivi des erreurs (facultatif, `ERROR_TRACKING_DSN`) ; les noms d'hôte de la recette et de la production (ENV-010 ; un domaine provisoire tant que celui de Q-023 n'est pas choisi) ; les valeurs des variables de ENV-040 pour chaque environnement, déposées dans le coffre de la chaîne d'intégration, jamais dans le dépôt | Q-017, Q-030 |
| L1 | Adresse, prénom et nom du premier compte Direction (ENV-040) ; un domaine d'expédition authentifié chez le fournisseur d'e-mail — à défaut, un sous-domaine technique de SYMLOOP, remplacé à la livraison 2 ; logo validé, exporté du fichier Figma avec les icônes dans `Design/assets/` (livrable du Lot 0 ; repli : DSN-040) | Q-017, Q-023, Q-030 |
| L2 | Nom de domaine ; adresses d'expédition et de réponse ; coordonnées | Q-023 |
| L2 | Barème indicatif des simulateurs ; frais d'acquisition | Q-046, Q-045 |
| L2 | Textes des pages (Notre concept, Financements, questions fréquentes) relus | Q-002, Q-003, Q-025 |
| L3 | Premiers promoteurs, programmes, lots, photos réelles | Q-031, Q-036 |
| L3 | Décision : commander ou non l'ouverture anticipée (paquet O) ; sans décision, le site s'ouvre à la livraison 5 | Q-044 |
| L4 | Banques partenaires, barèmes, listes de pièces | Q-005, Q-008, Q-027, Q-032 |
| L4 | Hypothèses de la mensualité affichée ; taux de change | Q-006, Q-007, Q-009 |
| L5 | Textes des e-mails relus | NOT-060 |
| L5 | Textes légaux définitifs, à la place des textes provisoires ; durées de conservation | Q-010, Q-017, Q-040, PAR-083 |
| L5 | Jours et horaires de travail ; délais cibles | Q-016, Q-038 |
| Arbitrage | Les dix écarts `[P1]` | `00-cadre/01`, § 6 |
