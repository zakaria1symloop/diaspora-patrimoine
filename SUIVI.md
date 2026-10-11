# Diaspora Patrimoine — suivi partagé

> **À quoi sert ce fichier.** C'est la mémoire commune du projet : chaque développeur (et sa session Claude) le lit en
> arrivant et le met à jour en partant. Il dit où on en est, qui fait quoi, et ce qui reste. Les règles de travail sont
> dans `CLAUDE.md` ; la référence fonctionnelle est `Specs/` (v1.5) ; le plan est
> `Specs/08-tracabilite/02-plan-de-realisation.md`.
>
> **Comment l'écrire.** Court, daté (AAAA-MM-JJ), au présent. On n'efface pas le journal : on ajoute en haut.

Dernière mise à jour : **2026-10-11** — Amrani-Mahdi01 (session Claude).

---

## 1. Où on en est, en trois lignes

- **Site public et espace client : construits**, branchés sur la vraie API (NestJS + PostgreSQL), vérifiés à l'écran
  (1440 et 390 px) et par des tests de bout en bout. Tout tourne en local.
- **Back-office : en cours** — l'application `apps/admin` et le moteur d'automatisations sont en construction ; les
  écrans du Lot 3 viennent ensuite.
- **Rien n'est déployé.** Dépôt git : `github.com/zakaria1symloop/diaspora-patrimoine` (depuis le 2026-10-11, partie
  technique seulement). Recette en ligne depuis le 2026-10-11 : https://patrimoine.72-60-190-211.sslip.io et https://admin.patrimoine.72-60-190-211.sslip.io
  (VPS de SYMLOOP, `HANDOFF.md` § 4 bis). Production : hébergeur et domaine à choisir. Nouveau développeur : lire `HANDOFF.md`.

## 2. État par paquet du plan

Légende : ✅ fait · 🟡 partiel (ce qui manque est dit) · 🔵 en cours · ⬜ à faire.

### Lot 1 — Socle

| Paquet | État | Remarques |
|---|---|---|
| 1.1 Dépôt et outillage | 🟡 | Monorepo pnpm + Turborepo, contrôles locaux. **Manquent** : git, chaîne d'intégration, environnements en ligne, conteneurs (PostgreSQL embarqué en local, D-097). |
| 1.2 Schéma de données | ✅ | Schéma Prisma complet toutes phases, migrations dans `apps/api/prisma/migrations`. |
| 1.3 Contrats et domaine | ✅ | `packages/contracts`, `packages/domain` (calculs testés). |
| 1.4 Fondations de l'API | 🟡 | Erreurs, idempotence, références, paramètres, audit, boîte d'envoi faits. ✅ **Moteur des automatisations** (`apps/api/src/automation/`, mode d'emploi : son `README.md`) : exécution des règles, 16 règles semées, planificateur unique avec journal `JobRun`, tâches et notifications du personnel, alertes techniques, routes `/admin/diagnostics/jobs`. **Manquent** : files et limites de débit hors mémoire (pas de Redis), flux temps réel, `cache.audit`, écran de diagnostic. |
| 1.5 Fichiers | 🟡 | Stockage local, déclinaisons d'images, fichiers privés à lien signé, dépôt en trois temps côté client. Antivirus : bouchon « toujours sain » en local. Stockage objet réel : à brancher. |
| 1.6 Identité | ✅ | Comptes, sessions, 2FA, rôles et permissions, garde globale. |
| 1.7 E-mails | 🟡 | Rendu des modèles, pièces jointes, préférences. **Fournisseur réel non branché** : en local les e-mails sont des `.eml` dans `.local/mail/`. |
| 1.8 Données de départ, design en code, gabarit back-office | ✅ | Installation rejouable, `packages/ui` (dont tableau, filtres, suggestions, messages d'erreur, aide « ? », fenêtres, messages brefs — registre « Outil »). Gabarit du back-office livré : `apps/admin` (connexion EA-00, cadre, liste, fiche). Mode d'emploi : `apps/admin/src/components/shell/README.md`. |
| 1.9 Première livraison utilisable | 🟡 | ✅ Équipe (EA-96), « Mes préférences » Profil et Sécurité (EA-104), modèle `S_TEAM_CHANGE` et `NS_TEAM_CHANGE`, page d'attente du site. **Manque** : le déploiement (recette et production par la chaîne), la photo du profil (Q-074). |

### Lot 2 — Espace public, espace client, simulateurs

| Paquet | État | Remarques |
|---|---|---|
| 2.1 Structure du site | ✅ | En-tête, pied, cookies, pages d'erreur, porte, plan du site, données structurées. |
| 2.2 Catalogue | ✅ | Recherche, filtres, tri, carte, regroupement, suggestions, budget estimé. |
| 2.3 Fiches bien et programme | ✅ | Galerie, carte, biens similaires. |
| 2.4 Accueil | ✅ | Avec les photos de la maquette comme images d'origine (« Image d'illustration », Q-031). |
| 2.5 Demandes | ✅ | Intérêt, rappel, contact, projection, partenaire ; accusés avec lien d'activation. |
| 2.6 Simulateurs | ✅ | Éligibilité, crédit, PDF, e-mail, rappel ; chiffres de référence reproduits. |
| 2.7 Pages | ✅ | Concept, Financements, Promoteurs, Partenaires, FAQ, Contact, légales, pages libres. |
| 2.8 Espace client | ✅ | Cadre propre, tableau de bord, suivi, intérêts, biens proposés (lecture), profil, sécurité, accords, « Écrire à mon conseiller ». Panneau des notifications EC-31 : paquet 5.1. |
| 2.9 Pièces côté client | ✅ | Liste, dépôt (photos réunies en PDF), versions, accord ; simulations enregistrées. |
| 2.10 Compte client | ✅ | Inscription, vérification, connexion, lien, 2FA, mot de passe oublié, nouvelles conditions. |
| 2.11 Demandes reçues (lecture) | ✅ | EA-10 et EA-11 en lecture dans `apps/admin` (`/demandes`), messages de « Écrire à mon conseiller » compris ; `S_LEAD_NEW` et, depuis ce paquet, la cloche `NS_LEAD_NEW`. |
| A.2 Projection · A.5 Assistant guidé · A.9 Devenir partenaire | ✅ | |
| A.6 Favoris et alertes · A.11 Carte, comparateur, recherches enregistrées | ✅ | |
| A.13 Assistant conversationnel | ✅ | Sans clé (`AI_PROVIDER`, `AI_API_KEY`) : repli sur le questionnaire. Jamais essayé avec un vrai modèle. |
| A.14 Inscription des partenaires | ✅ | Côté partenaire. L'étude de la candidature (ACP-084) est au back-office : à faire. |
| Le Café (EP-13 à EP-15) | ✅ | Liste, page, inscription, liste d'attente, « Gérer mon inscription », agenda et QR. |

### Lots 3 à 6

| Paquet | État | Remarques |
|---|---|---|
| 3.1 Socle du back-office | ✅ | Recherche globale, « + Créer » (registre prêt, absent tant qu'aucun formulaire n'est livré), listes à vues enregistrées, colonnes, mémoire, chronologie et notes, cloche et page des notifications, aide « ? ». **Reste hors paquet** : flux temps réel (API-070), exports (lot 5), regroupement et préférences des notifications (5.1). |
| 3.2 Demandes · 3.3 Clients | ⬜ | Les **services** d'écriture du catalogue et des Cafés existent déjà côté API (`catalogue-admin/`, `events-admin/`, routes `/admin/…` protégées) : il reste leurs écrans. |
| 3.4 Promoteurs · 3.5 Programmes, biens, lots · 3.6 Médias, import | 🟡 | Écrans EA-40 à EA-47, EA-50, EA-51 et leurs routes (API-100) : programmes, biens, lots (table modifiable, prix en nombre, doublons, livraison), complétude, publication, mise en avant (CTL-150), éligibilité (CTL-130), à proximité (CTL-140), chantier (CTL-145), médias (CTL-080 à CTL-084, PDF et 360°), import CSV/XLSX avec contrôle à blanc (CTL-100 à CTL-102), promoteurs (CTL-001 à CTL-005, CTL-007 ; suspension annoncée puis « Les republier »), autres partenaires (CTL-170), candidatures (ACP-084), veille `partner.scan` (AUT-073, AUT-079). **Reste** : « Régénérer l'adresse » (TRV-052) et « Aperçu » par lien signé (FIC-120) des programmes et des biens ; placement par clic sur la carte (CTL-021, Q-094 : latitude et longitude en attendant) ; proposition de reporter une nouvelle date de livraison sur les lots (textes prêts, fenêtre non branchée) ; « Signaler une erreur » sur une fiche et sa tâche (DEM-018, `R_LISTING_ERROR`) ; livraison dépassée (AUT-074, `R_DELIVERY_OVERDUE`) et programme entièrement vendu (AUT-078, `R_PROGRAM_SOLD_OUT`) ; archivage automatique des biens vendus (CYC-123) ; « Écrire au promoteur » (CTL-006, à brancher sur la fenêtre d'e-mail manuel du paquet 3.2) ; plans PDF sur la fiche publique (Q-095) ; entrée de règle `R_LOT_IMPORT_CONFLICT` (la tâche est créée par un gestionnaire système en attendant le paquet 4.4). |
| 3.7 Dossier | ✅ | Création (PIP-015), liste EA-21, fiche EA-22 (frise, « Ce qu'il manque », aperçu, biens envisagés et panneau « Proposer des biens », échanges, historique), qualification avec complément de la fiche (CYC-021, CRM-050), rapprochement et propositions (PIP-031), réponses du client côté API (EC-12, EC-13 : `/client/candidates/{id}/…`), bien retenu et lot visé (EC-11 `…/property`), pause, reprise, clôture, réouverture, recul, suppression, changement de conseiller ; règles AUT-043 ; e-mails `C_PROPOSAL_*`, `C_ADVISOR_CHANGED`, `C_DOSSIER_*`. **Limite** : avancée jusqu'à « Mise en relation » (Q-078). **Reste** : boutons de réponse dans l'espace client (voir § 3, note de l'agent 7). |
| 3.8 Tâches et rendez-vous | ✅ | EA-30 Tâches (vues, groupes, terminer/annuler, reporter, réaffecter, actions groupées, détail à droite, compteur du menu), EA-31 Agenda (jour, semaine, mois, liste, superposition, créneau → rendez-vous ou tâche, panneau à droite), fenêtre de rendez-vous (fuseaux, avertissements, accueil sur place TAC-045), onglet Tâches du dossier ; tâches automatiques et fermetures (AUT-032, AUT-035), AUT-051, résumé du matin (AUT-070), `R_EMAIL_BOUNCED` (sans émetteur, Q-082) ; routes client `GET /client/appointments`, `…/cancel`, `…/calendar`. **Reste** : la page « Mes rendez-vous » de l'espace client (EC-14). |
| Lot 4 (GED, pipeline, banques) · Lot 5 (communication) · Lot 6 (ouverture) | ⬜ | |

## 3. En cours — qui fait quoi

> Inscris-toi ici **avant** de commencer. Une ligne par personne et par paquet.

| Qui | Paquet / sujet | Dossiers touchés | Depuis | État |
|---|---|---|---|---|
| Zakaria (Claude, agent 1) | 1.8, 1.9, 2.11, 3.1 — application back-office, équipe, préférences, demandes en lecture | `apps/admin/`, `apps/api/src/back-office/`, `packages/ui` (tableau, filtres…) | 2026-10-11 | **terminé** (voir journal) — le Lot 3 peut se brancher dans le cadre |
| Zakaria (Claude, agent 2) | 1.4 — moteur des automatisations, planificateur, tâches et notifications du personnel | `apps/api/src/automation/`, `apps/api/src/install/` (règles, modèles `S_*`), `apps/api/src/events/event-scan.ts` | 2026-10-11 | **terminé** le 2026-10-11 (voir journal) |
| Zakaria (Claude, agent 3) | Passe de qualité de l'espace client (largeur, composants propres, filtres, messages d'encouragement, animations, contrôles morts) | `apps/web/src/components/client-space/`, `client-tools/`, `client-documents/`, `apps/web/src/app/espace-client/`, `apps/api/src/client-space/`, `client-tools/`, `packages/i18n/messages/fr/client*.json`, `e2e/` | 2026-10-11 | fait (voir journal 2026-10-11, agent 3) |
| Zakaria (Claude, agent 4) | Report dans Figma des changements du site (D-098) — liste `Design/a-reporter-dans-figma.md` | Fichier Figma ; `Design/a-reporter-dans-figma.md`, `Design/figma-ledger.json` (ni code ni specs) | 2026-10-11 | **terminé** le 2026-10-11 (voir journal) — restent les lignes ☐ de `Design/a-reporter-dans-figma.md` (espace client : passe en cours ; six écarts à arbitrer) |
| Zakaria (Claude, agent 5 — six sessions en parallèle) | 3.2 Demandes (saisie, traitement, appels et échanges, e-mail écrit à la main, signature et absence, ligne de l'équipe) · 3.3 Clients (liste, fiche, modification, doublons, fusion, compte, « Voir comme le client », simulations) | API : `apps/api/src/crm/` (noyau commun : premier contact, fiche créée par l'équipe, doublons, conseillers), `leads-admin/`, `exchanges-admin/`, `clients-admin/`, `client-account-admin/`, `simulations-admin/`, `clients-merge-admin/`, `back-office/` (ajouts), `leads/lead-mail.handler.ts`, `identity/` (session d'aperçu) · admin : `app/(shell)/demandes`, `/clients`, `/preferences`, `components/leads`, `clients`, `exchanges`, `crm`, `preferences`, `team`, `shell/timeline`, `shell/TopBar.tsx` (menu du compte) · web : `app/apercu/`, `components/preview/` · contrats `admin-leads`, `admin-crm`, `admin-clients`, `admin-exchanges`, `admin-client-*`, `admin-simulations`, `admin-team` · i18n `admin-leads`, `admin-crm`, `admin-clients`, `admin-exchanges`, `admin-client-*`, `admin-simulations`, `admin-preferences`, `admin-team` · `e2e/tests/admin-leads-*`, `admin-exchanges*`, `admin-absence*`, `admin-client*` | 2026-10-11 | en cours |
| Zakaria (Claude, agent 6) | 3.4 Promoteurs · 3.5 Programmes, biens, lots · 3.6 Médias et import de lots · étude des candidatures de partenaires (ACP-084) | `apps/api/src/catalogue-admin/` (ajouts), `apps/api/src/files/` (dépôt API-080), `apps/admin/src/app/(shell)/promoteurs`, `/programmes`, `/biens`, `/partenaires`, `apps/admin/src/components/catalogue`, `packages/contracts/src/admin-catalogue*.ts`, `packages/i18n/messages/fr/admin-catalogue*.json`, `e2e/tests/admin-catalogue*` | 2026-10-11 | fait le 2026-10-11 (voir journal) — reste ce qui est listé au § 2, ligne 3.4 · 3.5 · 3.6 |
| Zakaria (Claude, agent 7) | 3.7 Dossier (création, fiche, rapprochement, réponses du client, pause, clôture, recul…) · 3.8 Tâches et rendez-vous (écrans, règles AUT-043 / AUT-051, résumé du matin, `R_EMAIL_BOUNCED`) | `apps/api/src/dossiers-admin/`, `apps/api/src/tasks-admin/`, `apps/api/src/client-space/` (routes de réponse du client, ajouts), `apps/api/src/automation/rule-seeds.ts` (ajouts), `apps/admin/src/app/(shell)/dossiers`, `/taches`, `/agenda`, `apps/admin/src/components/dossiers`, `tasks`, `agenda`, `packages/contracts/src/admin-dossiers.ts`, `admin-tasks.ts`, `packages/i18n/messages/fr/admin-dossiers.json`, `admin-tasks.json`, `e2e/tests/admin-dossiers*`, `admin-tasks*` | 2026-10-11 | en cours |
| Zakaria (Claude, agent 8) | Passe de qualité de tout le site public (alignement sur Figma : tête du catalogue, cartes de motivation, carrousels 390, fiches bien et programme ; principes D-098 sur chaque page ; contrôle de chaque bouton) + report dans Figma | `apps/web/src/app/(site)/`, `apps/web/src/components/` (sauf `client-*`), `packages/i18n/messages/fr/` (espaces de noms du site, ajouts), `e2e/tests/public-controls.spec.ts`, `Design/`, fichier Figma (page Site public) | 2026-10-11 | **terminé** le 2026-10-11 (voir journal) — restent les têtes d'EP-11 / EP-12 dans Figma et l'affichage simplifié des autres pages |
| Amrani-Mahdi01 (Claude) | Retour de recette du site public du 11/10/2026 (`docs/retours-site-2026-10-11.md`) : menu, cartes cliquables, listes de choix, filtres appliqués au bouton, contrôle minimum / maximum, favori réservé au compte, défilements du téléphone, squelettes, carte de localisation, partage par e-mail, pied de page en grand texte | `apps/web/src/components/` (`vitrine`, `catalogue`, `home`, `layout`, `discovery`, `property`, `forms/QueryDialog.tsx`), `apps/web/src/app/(site)/programmes/page.tsx`, `apps/web/src/lib/` (`discovery`, `account-favorites`, `after-sign-in`), `packages/ui` (`Flag`, `map/`, `TextSizeControl`), `packages/i18n/messages/fr/` (`catalogue`, `favorites`, `common`), `e2e/tests/` (`public-review`, `catalogue-filters`, `discovery`), `Specs/` (D-102 à D-104) | 2026-10-11 | **terminé** le 2026-10-11 (voir journal) — branche `retours/site-public-2026-10-11` |
|  |  |  |  |  |

## 4. À faire ensuite (dans l'ordre conseillé)

1. ~~Mettre le dossier sous git~~ — fait le 2026-10-11 (`zakaria1symloop/diaspora-patrimoine`). Reprendre 3.2 · 3.3,
   interrompus (voir `HANDOFF.md` § 7).
2. Les écrans du Lot 3 dans le cadre du back-office (lire `apps/admin/src/components/shell/README.md`), un paquet par personne :
   3.2 Demandes · 3.3 Clients · 3.4 Promoteurs · 3.5 Programmes, biens, lots · 3.6 Médias et import · 3.7 Dossier ·
   3.8 Tâches et rendez-vous.
   Reste de 3.4 à 3.6 (faits en partie le 2026-10-11) : « Régénérer l'adresse » (TRV-052) et « Aperçu » par lien signé (FIC-120) des programmes et des biens ; placement par clic sur la carte (CTL-021, Q-094 : latitude et longitude en attendant) ; proposition de reporter une nouvelle date de livraison sur les lots (textes prêts, fenêtre non branchée) ; « Signaler une erreur » sur une fiche et sa tâche (DEM-018, `R_LISTING_ERROR`) ; livraison dépassée (AUT-074, `R_DELIVERY_OVERDUE`) et programme entièrement vendu (AUT-078, `R_PROGRAM_SOLD_OUT`) ; archivage automatique des biens vendus (CYC-123) ; « Écrire au promoteur » (CTL-006, à brancher sur la fenêtre d'e-mail manuel du paquet 3.2) ; plans PDF sur la fiche publique (Q-095) ; entrée de règle `R_LOT_IMPORT_CONFLICT` (la tâche est créée par un gestionnaire système en attendant le paquet 4.4).
3. Données de démonstration complètes (PAR-082 : 12 clients, 8 dossiers, comptes du personnel) — possibles seulement
   quand le back-office sait faire avancer un dossier (Q-067).
4. Brancher ce qui est encore local : fournisseur d'e-mail, stockage objet, antivirus, Redis, hébergement, chaîne
   d'intégration (dépendances SYMLOOP, plan § 6).
5. Reporter dans Figma ce qui change dans le site : la liste se tient dans `Design/a-reporter-dans-figma.md` (faite le 2026-10-11 pour la vitrine, le cadre de l'espace client et le back-office ; restent les écrans de l'espace client quand leur passe de qualité est finie, et six écarts à arbitrer).
6. Lots 4, 5, 6.

## 5. Ce qu'on attend de quelqu'un (questions ouvertes)

Toutes sont dans `Specs/00-cadre/05-decisions-et-questions.md`, avec la valeur appliquée en attendant.

| Sujet | Question | Qui répond |
|---|---|---|
| Fournisseur de cartes en production (OpenFreeMap en local) | Q-056 | SYMLOOP |
| Fournisseur d'IA et accord de traitement des données ; mention dans la politique de confidentialité ; jeu d'essai | Q-057 à Q-061 | Cliente, conseil juridique |
| Textes écrits par SYMLOOP à valider (contact, projection, page partenaire, description du Café) | Q-066 | Cliente |
| « Les biens » dans les menus ; exemple à 810 € / mois | D-096 | Cliente |
| Données de démonstration : volume et qui les tient | Q-067 | SYMLOOP |
| Mise à jour en direct de l'espace client, ou rafraîchissement de 60 s | Q-068 | SYMLOOP |
| Photos HEIC (iPhone) | Q-070 | SYMLOOP |
| Simulations anonymes jointes à quelles demandes ; lectures de l'assistant guidé | Q-062 à Q-065 | Cliente |
| Hébergeur, fournisseur d'e-mail, domaine, premier compte Direction | plan § 6 | SYMLOOP, cliente |
| Catalogue du back-office : pays d'un bien autonome, suppression logique, « Sans photo réelle », ordre des partenaires, plans PDF sur le site… | Q-086 à Q-095 | SYMLOOP, cliente |

## 6. Voir le projet tourner

Démarrage : `CLAUDE.md`, « Démarrer en local ». Une fois lancé :

| Quoi | Adresse | Remarque |
|---|---|---|
| Site public | http://localhost:3000 | Catalogue de démonstration : `pnpm --filter @dp/api demo` |
| Inscription / connexion | http://localhost:3000/inscription · `/connexion` | Le lien de vérification est dans le dernier `.eml` de `.local/mail/` |
| Espace client | http://localhost:3000/espace-client | Dossier de démonstration avec pièces : `pnpm --filter @dp/api demo -- --dossier-pour=<adresse du compte>` |
| Espace partenaire | http://localhost:3000/partenaires/inscription | |
| API | http://localhost:4000/api/v1/public/health | |
| Back-office | http://localhost:3001 | `cd apps/admin && npx next dev --port 3001`. Premier compte : `pnpm ops owner:invite …` puis le lien de `S_INVITATION` (`.local/mail/`). Écrans : `/equipe`, `/demandes`, `/preferences`, `/notifications` |

Tests au dernier passage (2026-10-11) : 371 tests de l'API verts ; parcours de bout en bout ≈ 50 verts (un worker).

## 7. Journal (le plus récent en haut)

### 2026-10-11 — Amrani-Mahdi01 (Claude) · retour de recette du site public (D-102 à D-104)

- Liste reçue : `docs/retours-site-2026-10-11.md`. Chaque défaut est corrigé dans le composant qui le porte, donc sur
  toutes les pages qui l'emploient (D-098). Branche `retours/site-public-2026-10-11`.
- **Menu** (NAV-010, NAV-014) : plus de flèche sur les entrées sans sous-menu (« Se connecter », entrées du menu du
  téléphone) ; « Mon espace », seule entrée à menu, porte un chevron vers le bas.
- **Accueil** : drapeaux dessinés (composant `Flag` de `@dp/ui`, croissant et étoile) sur le comparatif et sur toutes
  les cartes de bien ; les deux colonnes du comparatif et la carte du Café sont cliquables en entier (« En France » mène
  au simulateur de crédit) ; « Lecture » relance les motivations aussitôt (le pointeur posé sur le bouton les retenait) ;
  autant de points que de cartes dans les défilements du téléphone (`Children.count` comptait une place vide).
- **Carte de bien** (CAT-040) : le lien couvrait le seul panneau blanc (le panneau positionné l'enfermait) ; il couvre
  maintenant bandeau, photo, panneau et mensualité, partout où la carte sert.
- **Listes de choix** (CAT-001, CAT-050) : composant `vitrine/Dropdown` à la place de la liste du navigateur — barre de
  recherche, tri, ville des filtres.
- **Filtres** (CAT-031, CAT-032, CAT-034, D-102) : brouillon sur ordinateur comme sur téléphone, appliqué par « Voir
  {m} biens » ; un seul recompte, 500 ms après le dernier choix, jamais deux fois pour les mêmes critères ; minimum
  au-dessus du maximum refusé (prix, surface) ; le champ de la mensualité ne se vide plus au sommet du curseur ; une
  pastille « pièces » choisie reste marquée sous le pointeur (elle pâlissait : on la croyait non cliquée).
- **Favoris** (SFA-020, SFA-021, D-103) : sans session, le cœur ouvre « Gardez ce bien dans vos favoris » ; le bien
  rejoint le compte à la connexion (`dp_favorite_pending`). **Écart assumé avec D-095** (le cœur sans compte), décidé
  par le retour de recette : à confirmer par Zakaria.
- **Chargements** (TRV-080) : squelettes de la forme des cartes pendant une recherche du catalogue
  (`catalogue/ResultsPending`), et à la place de « Chargement… » sur Mes favoris et le comparateur. Pas de
  `loading.tsx` sur les pages publiques : il ferait perdre le statut 404 et les redirections de l'adresse (CAT-020).
- **Fiche bien** : la carte cadre le cercle entier, crédits repliés, cadre plus haut sur téléphone ; `.env.example` du
  site donne le style OpenFreeMap (sans lui le lieu s'écrit sur une carte sobre, FIC-061) ; « Partager » par e-mail
  propose l'application de messagerie, Gmail, Outlook et Yahoo Mail (NAV-037).
- **Grand texte** (TRV-123) : plus aucun débordement en « Grande » et « Très grande » (en-tête à 1 100 px, téléphone) :
  l'en-tête passe plus tôt au menu du téléphone, le pied de page s'empile, ses séparateurs suivent leur élément.
- **Pagination du catalogue** (CAT-055) : elle existait déjà ; elle n'apparaît qu'au-delà de 12 biens, et la
  démonstration n'en a que 6 — non vue à l'écran pendant cette passe.
- Tests : `e2e/tests/public-review.spec.ts` (nouveau, un test par défaut), `catalogue-filters` et `discovery` mis à
  jour. Specs : vérificateur vert (93 décisions).
- Environnement : `pnpm` 10 installé globalement échoue en voulant passer à la 12.4.2 : utiliser `corepack pnpm …`.

### 2026-10-11 — Zakaria (Claude, coordination) · premier serveur de recette

- Recette en ligne sur le VPS partagé de SYMLOOP, à côté des autres projets sans les toucher : dossier
  `/opt/diaspora-patrimoine`, Node 22 propre au projet, PostgreSQL 16 en conteneur `dp-postgres`, trois processus pm2
  `dp-patrimoine-*`, un fichier nginx et ses certificats. Adresses : https://patrimoine.72-60-190-211.sslip.io (site,
  derrière la page d'attente) et https://admin.patrimoine.72-60-190-211.sslip.io (back-office). `APP_ENV=staging`,
  e-mails en `.eml` sur le serveur, données d'installation et démonstration chargées, compte Direction de recette créé
  par l'invitation réelle (identifiants chez Zakaria, jamais dans le dépôt).
- Code : `VIRUS_SCAN_STUB` (Q-096) — sans ClamAV, aucune image ne passait hors du local. Test ajouté.
- Pièges du serveur : Next écouté sur toutes les interfaces (le pare-feu ferme 3600/3601), sinon la page d'attente
  échoue (`localhost` → `::1`) ; les deux `next build` l'un après l'autre (mémoire partagée).
- Vérifié par un navigateur : page d'attente, accueil (20 images sur 20, vitrine des motivations), catalogue, accueil
  390 px (19 sur 19), connexion au back-office avec code d'application. Les autres applications pm2 du serveur sont
  restées en ligne.

### 2026-10-11 — Zakaria (Claude, coordination) · dépôt git public et dossier de reprise

- Projet mis sous git et poussé sur `github.com/zakaria1symloop/diaspora-patrimoine` (public, demande de Zakaria) :
  **partie technique seulement**. Hors dépôt (`.gitignore`) : `Legal/`, `Strategie/`, `Design/references/`,
  `Design/archive/`, `Dev/backup-Specs-avant-D097/`, `Dev/chatbot/`, les PDF, `.local/`, tous les `.env`.
- Prix et conditions de paiement du contrat retirés de `Specs/00-cadre/01` (« Les conditions commerciales relèvent du
  contrat, qui n'est pas dans le dépôt ») ; `Specs/README.md` précise que les documents contractuels sont hors dépôt.
- Contrôle avant envoi : aucune clé ni mot de passe dans les fichiers versionnés (motifs de clés d'API, clés privées,
  mots de passe et clés TOTP des comptes de test) ; `apps/api`, `apps/web`, `apps/admin` compilent ; specs vertes.
- Ajoutés : `HANDOFF.md` (dossier de reprise), `docs/contexte-claude.md` (façon de penser du donneur d'ordre, méthode
  des sessions parallèles et ses pièges), `docs/figma-mcp-pieges.md` ; `CLAUDE.md` y renvoie et décrit le travail
  avec git. Les sessions 3.2 · 3.3 et la suite de la passe du site public étaient en pause : `HANDOFF.md` § 7.

### 2026-10-11 — Zakaria (Claude, coordination) · motivations de l'accueil en vitrine animée (D-101)

- Demande de Zakaria : « éviter les cartes statiques ». Les six cartes de « Pourquoi acheter en Algérie en 2026 ? »
  deviennent une vitrine : liste des six + photo sur ordinateur, photo à segments + texte sur téléphone, défilement
  automatique de 7 s qui s'arrête au survol, au focus, hors écran et dès qu'on choisit ; pause toujours présente ; rien
  ne bouge avec les animations réduites ou en affichage simplifié. Fichiers : `apps/web/src/components/home/WhySpotlight.tsx`
  et `.module.css` (nouveaux), `Sections.tsx` (`WhySection`), textes `ui.home.why.*` (5 clés).
- Vérifié sur `http://192.168.100.36:3000` (1440 et 390) : clic, clavier (flèches, Début, Fin), pause et reprise,
  flèches, segments, glissement tactile (un glissement vertical fait toujours défiler la page), animations réduites,
  aucune cible sous 44 px, aucune erreur de console, pas de débordement horizontal. `apps/web` : `tsc` propre.
- Specs : D-101, ACC-045, ACC-100, DSN-072 (nouvelle ligne), `FeatureCard` ; journal du README ; vérificateur vert.
  Figma : une ligne ☐ dans `Design/a-reporter-dans-figma.md` (Accueil).

### 2026-10-11 — Zakaria (Claude, agent 6) · catalogue du back-office (3.4, 3.5, 3.6)

- **Fait** : écrans EA-40 à EA-47, EA-50, EA-51 (programmes, biens, lots, médias, import de lots, mise en avant,
  promoteurs, autres partenaires) et le panneau « Candidature partenaire » d'une demande (ACP-084) ; une centaine de
  routes `/admin/…` (ajoutées à API-100) ; événements de publication, de statut de lot et de promoteur ; veille
  `partner.scan` à 07:30 (conventions et documents qui expirent, disponibilités à vérifier, candidatures refusées
  effacées après 30 jours) et ses règles `R_CONVENTION_EXPIRING`, `R_PARTNER_DOC_EXPIRING`, `R_STOCK_CHECK` ;
  e-mail `C_PROGRAM_UPDATE` et notifications `NC_PROGRAM_UPDATE`, `NS_PARTNER_SUSPENDED`, `NS_PARTNER_EXPIRING`,
  `NS_IMPORT_FINISHED`. Lecteur et rédacteur XLSX sans dépendance.
- **Tests** : `apps/api/test/catalogue-admin-screens.test.ts` (18, avec les identifiants de règle) ;
  `e2e/tests/admin-catalogue.spec.ts`, parcours complet vert en 46 s (promoteur créé et sélectionné, programme,
  typologie, lot, trois photos, publication vérifiée sur le site, import avec une ligne en erreur, suspension → la fiche
  publique disparaît, réactivation et « Les republier » → elle revient ; tout est défait par les cas d'usage).
- **Questions** : Q-086 à Q-095 (valeurs appliquées).
- **Écart** : les routes des médias sont déclarées `catalogue.read` et le service exige la permission d'écriture du
  propriétaire du média (programme, bien, promoteur, banque, partenaire) — dit dans API-100.
- **Fichiers partagés touchés (ajouts)** : `automation/rule-seeds.ts`, `automation/event-catalogue.ts`,
  `install/email-templates.ts`, i18n `notifications.json`, `admin-shell.json`, `validation.json`,
  `apps/admin/src/components/shell/menu.ts` (entrées livrées), `components/leads/LeadDetailView.tsx` (une ligne).
- **Reste** : voir § 2, ligne 3.4 · 3.5 · 3.6. La fiche d'une banque (Lot 4) : une candidature de banque acceptée
  s'affiche sans lien.

### 2026-10-11 — Zakaria (Claude, coordination) · `ops setting:set` réparé

- `pnpm ops setting:set` échouait toujours (« invalid input syntax for type uuid ») : l'événement `setting.changed` mettait
  le nom du paramètre dans `OutboxEvent.aggregate_id`, une colonne UUID. Correctif dans `apps/api/src/install/ops.ts` :
  un UUID stable dérivé du nom (`settingAggregateId`, RFC 9562 § 5.5 ; le nom reste dans `payload.key`). Vérifié :
  `setting:get` puis `setting:set` sur `features.assistant.mode` (valeur inchangée, `GUIDED`).
- `e2e/tests/assistant-ai.spec.ts` ne bute plus sur la commande ; les échecs restants viennent des runs Playwright
  lancés en même temps par plusieurs agents (dossier `test-results/` effacé pendant l'écriture des traces, ENOENT).
- « Nouveau bien » (`/catalogue/biens/nouveau`) plantait : le texte `ui.admin-properties…reference` contenait
  `{pays}` et `{numéro}` pris pour des variables ICU (MissingValueError). Texte réécrit (« par exemple DP-DZ-0142 »).
  Contrôle de tous les textes avec l'analyseur ICU : aucun autre nom de variable invalide.
- Serveurs de développement lancés pour l'adresse réseau (`next dev --hostname 0.0.0.0`) : le site et le back-office
  se regardent depuis `http://192.168.100.36:3000` / `:3001`.

### 2026-10-11 — Zakaria (Claude, agent 8) · passe de qualité du site public (D-100)
- Paquet / sujet : tout le site public au niveau de la maquette Figma validée et des principes D-098 (un défaut signalé
  est un exemple), et Figma au niveau du site là où le site a raison. Les quatre agents d'aide lancés au départ ont été
  arrêtés par la limite d'usage avant d'avoir rien écrit : tout a été repris et fait par cet agent seul.
- Fait — **catalogue** : titre centré sur deux lignes construit depuis les critères, sans fil d'Ariane (CAT-001) ; sur
  téléphone, la barre à trois champs laisse la place au champ par mot, « Filtres » et « Trier » côte à côte ; cartes qui
  entrent l'une après l'autre. **Accueil** : bandeau des motivations au-dessus de la photo ; photo du Café à côté des dates ;
  photo et logo derrière l'appel final ; sur téléphone, motivations, biens et Cafés en défilements aimantés à points
  (`components/vitrine/Snap.tsx`), services et financements en courtes rangées, barre d'action fixe (ACC-100) ; marque du
  pied lisible sur téléphone. **Fiche bien / fiche programme** : sections composées (titres Playfair sur le fond de la page,
  tuiles, puces à icône, tableau des lots en carte, carte du programme avec ses biens en vignettes, carte du promoteur),
  « Favori » et « Partager » dans le bloc du prix (FIC-052), biens du programme en lignes cliquables (FIC-111), mosaïque du
  téléphone en pleine largeur (elle gardait la moitié). **Toutes les pages** : « Écouter cette page » (TRV-127,
  `layout/ListenButton.tsx` : synthèse vocale du navigateur, phrase lue surlignée, Pause / Reprendre / Arrêter) et
  « Affichage simplifié » (TRV-122, `layout/SimpleMode.tsx` : bascule dans le pied et le menu du téléphone, bandeau sous
  l'en-tête, accueil simplifié à trois portes, fiche réduite à l'essentiel avec « Voir tous les détails ») ; icônes du menu
  du téléphone ; slogan de l'en-tête retiré aux grandes tailles de texte (rien ne se chevauche à « Très grande ») ; FAQ :
  thèmes en pastilles avec leurs compteurs, gardés dans l'adresse ; cartes des listes de la vitrine qui entrent à l'écran
  (`layout/RevealOnScroll.tsx`). **Défauts trouvés et corrigés** : une page 404 à l'intérieur du site (bien, programme,
  promoteur, Café inconnu) dessinait l'en-tête, le contenu et le pied **deux fois** (`app/(site)/not-found.tsx`,
  `components/NotFoundContent.tsx`) ; le dinar s'affichait « DZD » au lieu de « DA » (TRV-020, `packages/i18n/src/format.ts`).
- Figma : cinq scènes ajoutées au jeu `Illustration` d'après le code (687:1115, 687:1125, 687:1134, 687:1145, 687:1180),
  têtes des pages intérieures refaites comme sur le site (EP-08, EP-16, EP-17, EP-18, EP-19, EP-24, EP-12 nominal), bascule
  « Affichage simplifié » dans le `Footer` (689:1099) ; les six écarts « site / Figma » sont arbitrés (cinq : le site suit
  Figma ou Figma suit le site ; le menu du back-office reste à son agent). Détail : `Design/a-reporter-dans-figma.md`.
- Tests : nouvel audit `e2e/tests/public-controls.spec.ts` (ouvre chaque page publique, clique chaque bouton, lien, onglet,
  bascule, puis chaque contrôle de la fenêtre ou du panneau ouvert ; échoue sur un contrôle mort, une erreur de console, un
  4xx/5xx, un lien vers rien, une page à deux cadres ; refait une page quand l'API ou le site redémarrent) : **vert** sur
  les neuf familles d'ordinateur (cadre, accueil, catalogue, fiches, Café, financement, pages, compte) et sur le contrôle du
  téléphone (aucune page plus large que l'écran, cibles de 44 px — trente-cinq cibles trop petites corrigées). Parcours
  existants : catalogue, contact, discovery, auth, assistant et projection, Café connecté, alerte connectée verts (rejoués
  seuls : sous la charge partagée certains échouent puis passent) ; deux rouges **hors de ce paquet** : `assistant-ai`
  (la commande `ops setting:set` lève « invalid input syntax for type uuid » dans `outboxEvent.create` — côté API) et
  `client-tools-ui` sur téléphone (le texte vide d'EC-40 a changé avec la passe de l'espace client — à l'agent 3).
  Typage `apps/web` sans erreur ; tests de l'API touchant aux montants (simulations, demandes, catalogue) verts. Captures avant / après 1 440 et 390 : `e2e/shots/public-pass/` ; aide `e2e/public-shots.mjs`
  (attend l'API, `SIMPLE=1` pour l'affichage simplifié).
- Specs : D-100 ; CAT-001, ACC-100, FIC-052, FIC-111, DSN-072 (trois mouvements) amendées ; Q-066 complétée ; README
  (journal 1.5, nombre de décisions) ; contrôle « Tout est cohérent. ».
- Fichiers partagés touchés (ajouts, sans changer l'existant) : `packages/ui/src/styles/base.css` (surlignage de la lecture,
  taille du texte en affichage simplifié, entrée des cartes `[data-reveal]`), `packages/i18n/src/format.ts` (« DA »),
  `packages/i18n/messages/fr/common.json`, `home.json`, `editorial.json` (clés ajoutées), `apps/web/src/app/layout.tsx`
  (script de l'affichage simplifié avant le premier rendu ; il ne s'applique pas sous `/espace-client`, qui a le sien).
- Reste à faire : têtes de page d'EP-11 et des autres états d'EP-12 dans Figma ; l'affichage simplifié des autres pages
  (une colonne partout, formulaires à une question par écran hors simulateurs) ; resynchroniser les sommaires Figma.

### 2026-10-11 — Zakaria (Claude, agent 3) · passe de qualité de l'espace client (D-099)
- Fait : toutes les pages de l'espace en pleine largeur et recomposées en colonnes (tableau de bord à 3 colonnes sur grand
  écran, listes à côté de ce qui les cadre) ; un message d'encouragement mis en forme par page (ECL-015 et règles de chaque
  page) ; « Vos repères » au tableau de bord ; cartes propres à l'espace (favori, bien envisagé, simulation, alerte,
  dossier) avec une action principale ; filtres + compteurs + tri + recherche, état dans l'adresse, sur intérêts,
  demandes, propositions, favoris, simulations, alertes, pièces, dossiers, nouvelles et suivi (filtré par le serveur) ;
  panneau latéral droit (dépôt et lecture d'une pièce, résultat d'une simulation), renommage sur place ; « Comparer »
  qui marche dans les favoris (barre propre à la page) ; médaillon `Celebration` (dossier complet, première pièce,
  dossier gagné) ; squelettes à la forme de chaque page ; bascule « Affichage simplifié » dans « Aa ». Kit réutilisable
  `components/client-space/kit/` (voir le README de l'espace).
- API : `overview` du tableau de bord, `documents` d'un dossier, apport des biens, liste des dossiers enrichie, suivi
  filtrable par famille (`?family=`, compteurs), ce qui a changé sur un favori et l'intérêt déjà envoyé ; démonstration
  `--dossier-pour` complétée (biens proposés, suivi, dates des étapes). Tests vitest ajoutés (ECL-023, ECL-031, EC-41).
- Specs : D-099, Q-077 (textes à valider), ECL-010/015/031/033, INT-001/010, DOS-002, SFA-010/022/030, MSG-021,
  PRO-003, TRV-100 (exception des listes bornées) ; vérificateur « Tout est cohérent. ». Figma : 16 lignes dans
  `Design/a-reporter-dans-figma.md` (table Espace client).
- Outils : `e2e/space-full-shots.mjs` (client rempli et vide créés par les vrais parcours, captures 1440/1920/390, se
  reconnecte seul), `e2e/tests/helpers/space-data.ts`, audit des contrôles morts `e2e/tests/client-space-controls.spec.ts`,
  `packages/i18n/scripts/merge-messages.py` (ajouter des clés sans réécrire un fichier). Captures avant/après :
  `e2e/shots/client-space-pass/`.
- Fichiers d'un autre module touchés : `e2e/tests/helpers/account.ts` (inscription qui attend l'hydratation et se relance
  si l'API redémarre). Agent 7 ajoute les routes de réponse du client (`client-space/`) : les boutons « Ce bien
  m'intéresse », « Je retiens ce bien »… se brancheront dans `properties/CandidateCard.tsx` (une action principale).
- Tests : audit des contrôles `client-space-controls.spec.ts` vert sur l'adresse réseau (`E2E_BASE_URL=http://192.168.100.36:3000`)
  — espace rempli (12,8 min), espace vide, téléphone (onglets, « Plus », cibles de 44 px) ; specs existantes de l'espace
  vertes (`client-space`, `client-tools-ui` [panneau fermé avant de renommer], `client-tools-api`, `client-documents-*`,
  `alert-signed-in`) ; vitest 51 verts (client-space, client-documents) ; `apps/web` sans erreur de types. Corrigés grâce à
  l'audit : hydratation du profil (fuseau lu après montage), dates relatives, boutons « ? » sans nom, mot de passe envoyé
  vide (422), interrupteur « Actualités » trop petit, `MarkRead` hors du cadre.
- Observé, hors de mon périmètre : sur téléphone par l'adresse réseau, une navigation juste après la vérification de
  l'adresse peut perdre la session (renouvellement coupé en vol) — à regarder côté identité.
- Remarque : l'API locale redémarre toutes les ~30 s quand plusieurs agents la recompilent ; les suites longues de bout en
  bout ne sont fiables qu'une fois le calme revenu.

### 2026-10-11 — Zakaria (Claude, agent 4) · report dans Figma (D-098)
- Paquet / sujet : mettre le fichier Figma « Diaspora Patrimoine — Design » au niveau du site construit, ligne par ligne
  d'après `Design/a-reporter-dans-figma.md`. Ni code ni specs touchés.
- Fait (détail et identifiants de nœuds : la liste elle-même, et `Design/figma-ledger.json`, section `session20261011`) :
  **vitrine** — `Header` de 1024 à 1279 px (variante, `Brand` étroit, cadre d'état), « Les biens » dans le pied et le menu du
  téléphone, `PropertyCard` avec la case « Comparer », la mention « Image d'illustration » et la ligne « surface · livraison »,
  boutons « Créer une alerte » et « Enregistrer cette recherche » (EP-02), « Autres programmes de la région » en vignettes
  (EP-04), fiche bien (22 275 000 DA, « Biens similaires », adresse, « Favori · Comparer · Partager », état « trois photos »),
  héros de l'accueil (fondu, halo, carte du Café avec sa photo, six photos des motivations, région facultative), EP-12
  recalculé avec `packages/domain`, dessin « questions » de l'assistant, page de la charte des partenaires ;
  **espace client** — cadre du site (menu latéral sur toute la hauteur avec la marque, « Mes pièces », « Messages », « Favoris »,
  « Alertes » ; barre du haut à droite ; `SpaceTopBarMobile` et `SpaceTabBar` à cinq onglets), EC-10 et EC-20 remis dans ce
  cadre, un cadre téléphone ; **back-office** — porte en douze états, barre du haut et entrée active, gabarit de liste avec ses
  états, gabarit de fiche, Équipe (liste, menu, huit fenêtres), Mes préférences, Demandes (liste, 390 avec tiroir), une demande,
  notifications, recherche globale, aide et fenêtres de session. Environ soixante cadres créés ou refaits.
- Tests (lesquels, résultat) : chaque écran comparé à une capture du site (`e2e/shots`, `e2e/shots/admin-2`, captures prises
  pour l'occasion) puis regardé dans Figma ; aucun test automatique (rien à tester côté code).
- Écarts aux specs / questions ajoutées (Q-nnn) : aucun fichier de `Specs/` modifié. Six écarts entre le site et Figma, hors
  liste, sont notés en fin de `Design/a-reporter-dans-figma.md` (tête de page du catalogue, ordre photo / bandeau des cartes de
  motivation, accueil 390 en carrousels, corps de la fiche bien, dessins des pages intérieures, menu du back-office) : à arbitrer
  avant de toucher l'un ou l'autre.
- Fichiers d'un autre module touchés : `Design/kit.js` (`hdrI` : le jeu `Header` n'a plus de propriété `Version` ; `spaceScreen`
  au nouveau cadre ; notes). Attention : trois captures de l'espace client ont été prises avec la session enregistrée
  `.local/space-shots/filled.json` de la passe de qualité (agent 3), sans la réécrire ; si le script `space-full-shots.mjs` la
  trouve fermée, le relancer avec `--fresh`.
- Reste à faire : EC-40 et tous les écrans de l'espace client (la passe de qualité complète d'abord sa table) ; les six
  arbitrages ; resynchroniser les sommaires des pages Figma et l'index de la Couverture (`Specs/_outils/inventaire_figma.py`) —
  les états affichés (« À maquetter », « En cours ») n'ont pas été mis à jour ; validation de la cliente (tout est « À valider »).

### 2026-10-11 — Zakaria (Claude, agent 2) — tests du moteur isolés de la base partagée
- Fait : `automation.int.test.ts` ne traite plus que ce qu'il a créé — `RuleEngine.runDue(limit, only?)`,
  `AutomationJobs.slaScan(ctx, scope?)` et `EventScan.scan(ctx, scope?)` acceptent une portée facultative, jamais posée
  par les tâches planifiées (comportement de production inchangé). Aucun effet sur la base locale : tout est écrit dans
  une transaction annulée, les e-mails vont au fournisseur en mémoire, les `JobRun` de test sont supprimés (vérifié).
- `identity.test.ts › MOD-016` : ce n'était pas un état partagé mais le test lui-même (le dernier caractère d'un segment
  base64url porte des bits inutilisés) ; il altère maintenant le premier caractère. Le code de chiffrement est inchangé.
- Tests : suite de l'API lancée trois fois de suite, 371 / 371 verts.

### 2026-10-11 — Zakaria (Claude, agent 1) · back-office, socle
- Paquet / sujet : 1.8 (gabarit du back-office, comportements communs de `packages/ui`), 1.9 (équipe, « Mes préférences »),
  2.11 (demandes en lecture), 3.1 (socle complet).
- Fait : nouvelle application **`apps/admin`** (Next 16, port 3001, registre « Outil » du système de design) —
  porte (`/connexion` avec double authentification, `/invitation/{jeton}` en trois étapes, mot de passe oublié,
  réinitialisation), **cadre** (menu par permission et par écran livré, barre du haut à hauteur fixe, bandeaux, session :
  renouvellement, avertissement, reconnexion sur place, confirmation du mot de passe), **gabarit de liste** (état dans
  l'adresse, filtres en ligne, vues enregistrées, colonnes, mémoire, retour à la liste, nouveautés), **gabarit de fiche**,
  **chronologie et notes**, recherche globale, cloche et page des notifications, aide « ? ». Écrans : Équipe (EA-96),
  Mes préférences (EA-104 : Profil, Sécurité), Demandes (EA-10, EA-11 en lecture).
  API : module `apps/api/src/back-office/` (`/admin/me/shell`, `/admin/me/profile`, `PATCH /admin/me`, `/admin/users/*`,
  `/admin/leads`, `/admin/leads/{référence}`, `/admin/leads/{id}/timeline`, `/admin/notes`, `/admin/saved-views`,
  `/admin/search`, `/admin/notifications`) ; périmètre du conseiller, masquage du rôle Support et champs sensibles
  appliqués par le serveur (`staff-view.ts`) ; `NS_TEAM_CHANGE` + `S_TEAM_CHANGE` (modèle semé) ; `NS_LEAD_NEW` écrite à
  l'arrivée d'une demande. `@dp/ui` : `DataTable`, `Pagination`, `FilterBar`, `SearchSuggest`, `Banner`, `ErrorSummary`,
  `FieldMessage`, `ErrorDetails`, `HelpTip`, `Modal`, `Menu`, `EmptyState`, `Skeleton`, `StatusTag`, messages brefs.
  **Mode d'emploi pour le Lot 3 : `apps/admin/src/components/shell/README.md`.**
- Tests (lesquels, résultat) : `apps/api/test/back-office.test.ts` (26, verts) ; parcours `e2e/tests/admin-shell`,
  `admin-team`, `admin-leads`, `admin-roles` (8, verts, projet `desktop` ; ignorés sur le projet téléphone) ; captures
  1 440 et 390 px regardées (`ADMIN_SHOTS=… npx playwright test tests/admin-shots.spec.ts`). Typage : API, web, admin, ui
  sans erreur ; contrôle des specs : « Tout est cohérent. ». Suite de l'API : 369 verts, 2 rouges dans
  `automation.int.test.ts › R_VERIFICATION_REMINDER` (hors de ce paquet, cause non établie : à regarder par qui tient le moteur).
- Écarts et questions (Q-nnn, D-nnn) : Q-071 à Q-076 ; détail dans `Dev/ecarts-code-specs.md`, « Back-office — socle ».
  Écrans à reporter dans Figma : `Design/a-reporter-dans-figma.md`, table « Back-office ».
- Fichiers d'autres modules touchés : `apps/api/src/identity/identity.module.ts` (export de `TwoFactorService`),
  `apps/api/src/leads/lead-mail.handler.ts` (écriture de `NS_LEAD_NEW`), `apps/api/src/install/auth-email-templates.ts`
  (modèle `S_TEAM_CHANGE`), `apps/api/src/install/ops.ts` (champs de `S_TEAM_CHANGE` au rétablissement),
  `packages/ui/src/components/Button.module.css` (rayon et bordure par variables : rien ne change pour le site),
  `packages/i18n/messages/fr/notifications.json` et `email.json` (clés ajoutées).
- Comptes de test locaux : Direction et un conseiller, créés par l'invitation réelle ; mots de passe et clés dans
  `.local/e2e-admin.json` (ignoré par git), voir `.local/test-accounts.txt`.
- Reste : déploiement (1.9) ; photo du profil ; flux temps réel ; pastilles des filtres bien, programme et pays des
  demandes ; puis le Lot 3 dans le cadre (3.2 d'abord : actions des demandes, « Appel », « Tâche » dans la barre d'ajout).

### 2026-10-11 — Zakaria (Claude) · retours d'usage (D-098)
- Sujet : en-tête et filtres du catalogue, d'après l'usage du site construit.
- Fait : en-tête à **une seule hauteur** (80 px, logo 56 px) — l'ancien passage en « compact » au défilement faisait
  sauter la page ; filtres du catalogue en **panneau à droite** sur ordinateur (résultats visibles à côté, chaque choix
  appliqué seul), fenêtre plein écran et brouillon gardés sur téléphone. Specs : D-098, NAV-012, CAT-030, CAT-031, CAT-036.
- Nouvelles règles de travail (dans `CLAUDE.md`) : un défaut signalé est un exemple, son principe s'applique partout ;
  tout changement visible va aussi dans Figma — liste tenue dans `Design/a-reporter-dans-figma.md`.
- Tests : `e2e/tests/catalogue-filters.spec.ts` (panneau, en-tête) verts ; parcours du catalogue (18) verts.
- En cours : passe de qualité de tout l'espace client (pleine largeur, cartes propres à chaque page, filtres,
  encouragements, animations, contrôle de chaque bouton).
- Reste : reporter la liste dans Figma (connexion Figma à rouvrir par Zakaria).

### 2026-10-11 — Zakaria (Claude, agent 2)
- Paquet / sujet : 1.4 — moteur des automatisations (API seulement).
- Fait : exécution des règles (`WorkflowRule` → `WorkflowExecution` : conditions relues à l'échéance, délais calendaires
  et ouvrés, trois nouveaux essais, heures calmes, plafond, conditions d'arrêt, clés contre les doublons) ; actions
  `SEND_EMAIL`, `CREATE_TASK`, `NOTIFY_STAFF` ; **16 règles semées** (demandes, accord retiré, pièces à vérifier, relance
  de vérification, Café) ; **planificateur unique** (`Scheduler`, journal `JobRun`, verrou PostgreSQL) qui reprend les
  tâches des alertes, des favoris, de l'identité et de l'assistant, plus `workflow.execute`, `jobs.watchdog`, `sla.scan`,
  `event.scan`, `purge` ; services `TasksService` (créer, confier, terminer, annuler, rouvrir, fermeture automatique) et
  `StaffNotifier` (`NS_*`, une opération = une notification, regroupement) ; alertes techniques (`S_TECH_ALERT`) ;
  modèles `C_LEAD_DELAYED`, `S_LEAD_SLA_BREACHED`, `S_TASK_ASSIGNED`, `S_TECH_ALERT` ; routes
  `GET /admin/diagnostics/jobs`, `…/jobs/{nom}/runs`, `POST /admin/diagnostics/run-job`.
  **Mode d'emploi pour les autres modules : `apps/api/src/automation/README.md`** (émettre un événement, déclarer un
  type, ajouter une règle, une tâche planifiée, créer une tâche ou une notification ; règles à venir par paquet).
- Tests (lesquels, résultat) : `apps/api/test/automation.test.ts` (40) et `automation.int.test.ts` (43, sur la base,
  transactions annulées) verts ; suite de l'API : 341 tests, verts sauf `identity.test.ts › MOD-016`, qui échoue environ
  une fois sur deux **indépendamment de ce travail** (le test remplace le dernier caractère du secret chiffré par « A » :
  quand cela ne change aucun octet, rien n'est levé) — à corriger par qui tient l'identité.
- Écarts aux specs / questions ajoutées (Q-nnn) : aucun fichier de `Specs/` modifié ; tout est listé dans
  `Dev/ecarts-code-specs.md`, § « Automatisations » (clés ajoutées au JSON des actions, `purge` à 4 h 30, e-mail de règle
  sans la fenêtre de 72 h, `C_CAFE_OPENING` sans lien de désinscription, routes de diagnostic à inscrire dans API-100,
  textes écrits par SYMLOOP à valider).
- Fichiers d'un autre module touchés : `platform/outbox.ts` (ordre des groupes : `order`), `communication/mailer.service.ts`
  (`links.ruleId`, raisons d'arrêt), `config/env.ts` (`TECH_ALERT_EMAIL`), `install/install.ts` et
  `install/email-templates.ts`, `alerts/alerts-jobs.ts`, `client-tools/favorites-watch.ts`, `assistant/ai/assistant-jobs.ts`,
  `identity/identity-jobs.ts` (minuteurs remplacés par une déclaration au planificateur, passages inchangés),
  `identity/partner.service.ts` (bouchon de `R_PARTNER_APPLICATION_SUBMITTED` retiré), `client-space/agreements.service.ts`
  (la tâche du retrait d'accord vient de la règle), `events/events.module.ts` + nouveau `events/event-scan.ts`,
  `app.module.ts`, `packages/i18n/messages/fr/automation.json` (nouveau) et `notifications.json` (trois clés `NS_*`).
- Reste à faire : écrire `NS_LEAD_NEW` à l'arrivée d'une demande (2.11 / 3.2, avec `StaffNotifier`) ; aligner
  `automation/staff-links.ts` sur les routes de `apps/admin` ; écran de diagnostic ; `cache.audit` ; flux temps réel ;
  les règles de chaque paquet à venir (tableau du README) ; relancer l'installation sur chaque environnement
  (`node --env-file=.env dist/install/install.js`) **avant** de démarrer l'API.

### 2026-10-11 — Zakaria (Claude)
- Lancement du back-office : application `apps/admin` (port 3001) et moteur des automatisations, en parallèle.
- Création de `CLAUDE.md` et de ce fichier pour travailler à plusieurs.

### 2026-10-09 → 2026-10-10 — Zakaria (Claude)
- **Specs v1.5** : D-096 (cohérence avant développement, 26 contradictions levées), puis **D-097** (écarts assumés par
  le premier code) et **Q-056 à Q-070**. Sauvegardes : `Dev/backup-Specs-avant-D097/`. Liste détaillée des écarts :
  `Dev/ecarts-code-specs.md`.
- **Construit** : tout le Lot 2 et ses paquets annexes (voir § 2), l'identité, l'assistant conversationnel.
- **Choix techniques** : NestJS 12 en ESM, Prisma 7, Next.js 16, PostgreSQL 16 embarqué en local (port 5433), limites de
  débit et boîte d'envoi dans le processus, e-mails en `.eml`, images de la maquette comme images d'origine.
- **À reporter dans Figma** (les specs ont bougé après les maquettes) : « Les biens » dans le menu mobile et le pied ;
  prix du lot B-304 en dinars ; titre « Biens similaires » ; chiffres de l'écran EP-12 ; arrondis des mensualités des
  cartes (1 300 / 2 210) ; région facultative dans la projection ; bouton « Enregistrer cette recherche » ; EC-40
  (894,69 €) ; « Adresse exacte communiquée après qualification. » ; « Messages » au menu de l'espace client ; charte
  des partenaires 0.1. Les 221 cadres Figma sont encore « À valider » côté cliente.
- **Non fait, à savoir** : rien n'est déployé ; pas de git ; l'assistant IA n'a jamais tourné avec un vrai modèle ;
  la clé de `Dev/chatbot/.env` est à révoquer.

<!-- Modèle d'entrée — copie, remplis, place en haut du journal :

### AAAA-MM-JJ — Prénom (Claude ou non)
- Paquet / sujet :
- Fait :
- Tests (lesquels, résultat) :
- Écarts aux specs / questions ajoutées (Q-nnn) :
- Fichiers d'un autre module touchés :
- Reste à faire :
-->
