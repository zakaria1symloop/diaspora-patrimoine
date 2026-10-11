# Diaspora Patrimoine — dossier de reprise pour un nouveau développeur

> Écrit le 2026-10-11 par Zakaria (SYMLOOP) avec sa session Claude, au moment d'ouvrir le projet à un autre
> développeur. Ce fichier est la **porte d'entrée** : il dit quoi lire, comment lancer, où en est le travail et ce qui
> était en cours. Il ne remplace pas les trois fichiers vivants : `CLAUDE.md` (règles de travail), `SUIVI.md` (état et
> journal de toutes les sessions), `Specs/` (la référence fonctionnelle).

---

## 1. Le projet en dix lignes

Diaspora Patrimoine est une plateforme d'immobilier neuf en Algérie pour la diaspora algérienne (France d'abord). Trois
portes pour quatre acteurs :

- **site public** (`apps/web`, port 3000) — catalogue de programmes et de biens, fiches, simulateurs de crédit et
  d'éligibilité, « Le Café » (rencontres clients–promoteurs–banques), assistant de projet, pages éditoriales ;
- **espace client** (dans `apps/web`, `/espace-client`) — suivi du dossier d'achat, pièces, biens proposés, favoris,
  alertes, simulations, messages au conseiller ;
- **espace partenaire** (dans `apps/web`, `/partenaires`) — inscription des promoteurs et des banques ;
- **back-office** (`apps/admin`, port 3001) — l'équipe de Diaspora Patrimoine : demandes, clients, dossiers, tâches,
  agenda, catalogue, promoteurs, équipe.

Une seule API (`apps/api`, NestJS, port 4000) sur PostgreSQL 16, partagée par les deux applications Next.js.

## 2. Par quoi commencer (ordre de lecture)

1. **Ce fichier.**
2. **`CLAUDE.md`** — les règles de travail, la carte du dépôt, le démarrage local, les pièges déjà rencontrés. Il est
   chargé automatiquement par Claude Code dans chaque session ouverte dans ce dossier.
3. **`SUIVI.md`** — l'état par paquet (§ 2), qui fait quoi (§ 3), la suite (§ 4), les questions ouvertes (§ 5) et le
   **journal de toutes les sessions** (§ 7, le plus récent en haut). C'est l'historique du projet : chaque session de
   travail y a laissé ce qu'elle a fait, testé, décidé et laissé ouvert.
4. **`Specs/README.md`** puis le plan **`Specs/08-tracabilite/02-plan-de-realisation.md`** (lots, paquets, scénarios de
   démonstration) et les règles transverses **`Specs/00-cadre/04-regles-transverses.md`**.
5. Les modes d'emploi de code : `apps/admin/src/components/shell/README.md` (cadre du back-office),
   `apps/web/src/components/client-space/README.md` (espace client), `apps/api/src/automation/README.md`
   (automatisations).

## 3. Les règles qui ne se discutent pas

Elles viennent du donneur d'ordre et sont détaillées dans `CLAUDE.md` ; les voici pour mémoire.

- **Les specs sont la seule référence.** Rien n'est inventé : une situation non décrite devient une question Q-nnn
  dans `Specs/00-cadre/05-decisions-et-questions.md`, avec une valeur par défaut prudente qu'on applique. Si le code
  s'écarte d'une spec, on corrige la spec dans la même passe (et le journal « 1.5 – en cours » du `Specs/README.md`).
  `PYTHONUTF8=1 python Specs/_outils/verifier_specs.py` doit finir par « Tout est cohérent. ».
- **Tout passe par la vraie API et PostgreSQL.** Aucune donnée fictive dans le front, aucun « seed » : seules les
  données d'installation (`pnpm --filter @dp/api install:run`) et la démonstration créée par les cas d'usage
  (`pnpm --filter @dp/api demo`, retirable par `demo:remove`).
- **Aucun texte visible ni paramètre métier en dur** : textes dans `packages/i18n/messages/fr/*.json`, paramètres dans
  le registre de `packages/contracts`.
- **Un défaut signalé est un exemple** (D-098) : on applique son principe à toutes les pages.
- **Pages vivantes, pleine largeur dans les espaces connectés, chaque bouton montré fonctionne, des listes malignes
  (filtres, tris, compteurs), des animations sobres** (D-089 à D-100).
- **Tout changement visible du site se reporte dans Figma** : une ligne dans `Design/a-reporter-dans-figma.md`.
- **Travail à plusieurs** : on s'inscrit dans `SUIVI.md` § 3 avant de commencer, on reste dans son périmètre, on
  ajoute une entrée datée au journal en partant.

## 4. Lancer le projet

Tout est dans `CLAUDE.md`, « Démarrer en local » (Windows sans Docker : PostgreSQL embarqué sur le port 5433). En bref :

```bash
pnpm install
cp apps/api/.env.example apps/api/.env          # générer chaque secret localement (voir CLAUDE.md)
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
pnpm --filter @dp/api db:install && pnpm --filter @dp/api db:start
pnpm --filter @dp/contracts build && pnpm --filter @dp/domain build && pnpm --filter @dp/i18n build
pnpm --filter @dp/api build && pnpm --filter @dp/api db:deploy
pnpm --filter @dp/api install:run
pnpm --filter @dp/api demo                       # catalogue et Cafés de démonstration
pnpm --filter @dp/api dev                        # API
cd apps/web && npx next dev --hostname 0.0.0.0 --port 3000
cd apps/admin && npx next dev --hostname 0.0.0.0 --port 3001
```

- **Aucun secret n'est dans le dépôt.** Les fichiers `.env` sont à créer à partir des `.env.example`.
- **Comptes** : aucun compte n'est fourni. Le premier compte Direction du back-office se crée avec
  `pnpm ops owner:invite --email … --first-name … --last-name …` ; le lien d'invitation est écrit dans `.local/mail/`
  (les e-mails ne partent jamais en local, ils sont écrits en `.eml`). Le back-office demande un code d'application
  d'authentification (TOTP) à l'activation du compte. Un compte client se crée par `/inscription` sur le site.
- **Depuis une autre machine du réseau** : `http://<adresse-de-la-machine>:3000` et `:3001` fonctionnent (voir
  `CLAUDE.md`). Dans le navigateur, jamais `crypto.randomUUID`, `crypto.subtle` ni `navigator.clipboard` en direct :
  ils n'existent pas sur une adresse réseau en http (utiliser `newUuid()`, `sha256Hex()`, `copyText()` de `@dp/ui`).

## 5. Vérifier avant de dire « fait »

```bash
PYTHONUTF8=1 python Specs/_outils/verifier_specs.py
cd apps/api && npx tsc -p tsconfig.build.json --noEmit && npx vitest run
cd apps/web && npx tsc --noEmit ; cd apps/admin && npx tsc --noEmit
cd e2e && npx playwright test        # un seul worker, pile locale démarrée ; redémarrer l'API entre deux séries
```

Chaque test porte l'identifiant de la règle qu'il vérifie (ex. `ACC-045`), chaque changement cite les règles réalisées.

## 6. Où en est le travail (2026-10-11)

Le détail par paquet est dans `SUIVI.md` § 2. En résumé :

| Partie | État |
|---|---|
| **Lot 1 — socle** (schéma, contrats, API, identité, fichiers, e-mails, automatisations) | Fait en local. Manquent : déploiement, chaîne d'intégration, fournisseur d'e-mail réel, stockage objet, antivirus, Redis. |
| **Lot 2 — site public, espace client, simulateurs, Café, assistant, inscription des partenaires** | Fait et vérifié (1440 et 390 px, tests de bout en bout). Deux passes de qualité faites le 2026-10-11 (D-099 espace client, D-100 site public), plus la vitrine animée des motivations de l'accueil (D-101). |
| **Lot 3 — back-office** | 3.1 socle ✅ · 3.4 à 3.6 catalogue 🟡 (fait, avec une liste de restes) · 3.7 dossier ✅ · 3.8 tâches et agenda ✅ · **3.2 demandes et 3.3 clients : en cours, interrompus** (voir § 7). |
| **Lots 4 à 6** (GED et banques, communication, ouverture) | À faire. |

**Rien n'est déployé** : pas d'hébergeur choisi, pas de recette en ligne (questions au `SUIVI.md` § 5).

## 7. Ce qui était en cours quand le travail s'est arrêté

Le 2026-10-11, plusieurs sessions Claude travaillaient en parallèle ; elles ont été **mises en pause** au milieu de leur
travail (le code compile — voir § 8 — mais ces parties ne sont pas finies) :

1. **3.2 Demandes · 3.3 Clients** (back-office, « agent 5 » dans `SUIVI.md` § 3). Fichiers : `apps/api/src/crm/`,
   `leads-admin/`, `exchanges-admin/`, `clients-admin/`, `client-account-admin/`, `simulations-admin/`,
   `clients-merge-admin/`, `apps/admin/src/app/(shell)/demandes`, `/clients`, `apps/admin/src/components/leads`,
   `clients`. Une partie des écrans existe (listes, fiches, fusion, compte du client) ; la saisie, le traitement
   complet d'une demande, les appels et échanges, l'e-mail écrit à la main, la signature et l'absence restent à finir
   et à vérifier. Reprendre en relisant la ligne de l'agent 5 dans `SUIVI.md` § 3, puis les fichiers, puis
   `Specs/04-back-office/03` et `05`.
2. **3.7 / 3.8 Dossier, tâches et agenda** (« agent 7 ») : fait ; sa dernière série de tests de bout en bout n'a pas pu
   être relancée jusqu'au bout avant la pause. À rejouer : `cd e2e && npx playwright test tests/admin-dossier*
   tests/admin-tasks* tests/admin-agenda*`.
3. **Suite de la passe de qualité du site public** (« agent 8 ») : démarrée puis interrompue. Restent : zones de clic
   ambiguës sur la carte du catalogue (« Comparer » et le cœur posés sur une carte qui est un lien), carte propre aux
   favoris publics (ce qui a changé depuis l'enregistrement), « Comparer » utilisable hors du cadre du site, carte
   d'encouragement / étape suivante après les simulateurs et sur Financements, filtres et compteurs sur la liste des
   Cafés, affichage simplifié sur les pages restantes.

Restes connus des paquets finis : `SUIVI.md` § 4 (liste complète, notamment pour 3.4 à 3.6).

## 8. État technique au moment de la reprise

- Le code compile : `apps/api` (`tsc`), `apps/web` et `apps/admin` (`tsc --noEmit`) — voir le premier commit.
- `Specs/` : vérificateur vert, version 1.5 en cours, 90 décisions, 95 questions ouvertes.
- Pièges vus récemment (tous documentés dans `CLAUDE.md` ou le journal) :
  - après une modification de `packages/contracts` ou `packages/i18n`, **reconstruire le paquet** puis redémarrer
    `next dev` si les nouvelles clés ne sont pas vues (un paquet mal reconstruit a fait planter tout le site : « Export
    ContactChannel doesn't exist ») ;
  - un texte i18n ne doit pas contenir d'accolades littérales (`{pays}` est lu comme une variable ICU et la page plante) ;
  - l'API en mode veille redémarre à chaque recompilation : quand plusieurs personnes y travaillent, une page peut
    afficher « Connexion interrompue » quelques secondes ;
  - plusieurs séries Playwright en même temps se marchent dessus (`test-results/` effacé) : une à la fois ;
  - sur téléphone par l'adresse réseau, la session s'est parfois perdue juste après la confirmation de l'e-mail
    (renouvellement de session coupé) : non traité, côté identité.

## 9. Ce qui n'est pas dans ce dépôt

Le dépôt ne contient que la partie technique. Restent chez SYMLOOP : le contrat, les offres technique et financière, le
PV de l'atelier, les documents commerciaux et de stratégie (`Legal/`, `Strategie/`), les maquettes et documents
d'origine de la cliente (`Design/references/`, `Design/archive/`), un ancien prototype d'assistant (`Dev/chatbot/`), les
données locales (`.local/` : base, fichiers, e-mails, comptes de test) et tous les secrets. Les specs y font parfois
référence par leur nom ; leur contenu n'est pas nécessaire pour développer.

Le fichier de design est dans Figma (clé et structure : `Design/figma-ledger.json`, `Specs/07-design/`). Demander
l'accès à Zakaria.

## 10. Travailler avec Claude Code sur ce projet

- Ouvrir Claude Code **à la racine du dépôt** : `CLAUDE.md` se charge seul, et renvoie vers ce fichier et vers
  `docs/contexte-claude.md` (la façon de penser du donneur d'ordre, la méthode des sessions, les pièges).
- Pour Figma : accès au fichier à demander à Zakaria ; pièges de l'outil dans `docs/figma-mcp-pieges.md`.
- Première consigne utile : « lis `HANDOFF.md`, `SUIVI.md` et inscris-toi dans `SUIVI.md` § 3 pour le paquet X ».
- Une session = un paquet ou un sujet, un périmètre de fichiers annoncé dans `SUIVI.md`, une entrée au journal en fin
  de session. Les décisions prises en discutant vont dans `Specs/00-cadre/05` (D-nnn ou Q-nnn).
- Contact : Zakaria, SYMLOOP (donneur d'ordre technique, il valide les choix et fait le lien avec la cliente).
