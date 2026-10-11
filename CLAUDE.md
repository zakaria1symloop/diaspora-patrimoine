# Diaspora Patrimoine — instructions pour l'agent

> Ce fichier est chargé automatiquement par Claude Code dans chaque session ouverte dans ce dossier.
> **Commence toujours par lire `SUIVI.md`** (état partagé du projet : ce qui est fait, ce qui est en cours et par qui,
> ce qui reste) — et **mets-le à jour avant de terminer ta session** (voir « Travailler à plusieurs » plus bas).
>
> **Nouveau sur le projet ?** Lis d'abord `HANDOFF.md` (porte d'entrée : quoi lire, comment lancer, où en est le
> travail, ce qui était en cours), puis `docs/contexte-claude.md` (la façon de penser du donneur d'ordre et les pièges
> de méthode appris par les sessions précédentes).

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

*(Les dix points ci-dessus sont le texte imposé par `Specs/08-tracabilite/02-plan-de-realisation.md`, § 2. Ce qui suit
le complète pour le dépôt tel qu'il existe.)*

---

## Règles du donneur d'ordre (Zakaria, SYMLOOP) — elles priment

- **Tout passe par la vraie API et PostgreSQL.** Aucune donnée fictive dans le front, aucune donnée « seed ». Seules
  existent : les données d'installation (PAR-080, PAR-081 : paramètres, référentiels, blocs de contenu, modèles d'e-mail,
  règles) et les données de démonstration créées **par les cas d'usage du back-office** (PAR-082 : commande `demo`,
  refusée en production, retirable par `demo:remove`).
- **Question sans réponse dans les specs** : applique la valeur prudente recommandée, note-la (Q-nnn), continue.
- **Livrer par tranches** qui fonctionnent (≈ 20 %), jamais « tout à la fin » (D-006).
- **Les phases sont des acteurs, pas des fonctions retenues** (D-089) : chaque page se construit complète ; une section
  se masque quand sa donnée manque.
- **Pages vivantes** (D-091 à D-093) : pas de page blanche nue, un dessin animé sur les pages à tâche unique, une porte
  par acteur (site public, espace client, espace partenaire, back-office).
- **« La logique », c'est le comportement de la personne** (D-095) : relis chaque page en marchant comme le visiteur
  (d'où il arrive, ce qu'il veut, où mène chaque action, ce dont le site se souvient, les chemins d'erreur).
- Stack imposée : **NestJS + Next.js**.
- **Un défaut signalé est un exemple** (D-098) : applique son principe à toutes les pages sans attendre une liste. Les
  principes déjà donnés : pleine largeur dans les espaces connectés ; jamais un composant du site public posé tel quel
  ailleurs (chaque carte se dessine pour ce qu'on fait sur sa page) ; chaque bouton montré fonctionne là où il est ;
  on voit d'un coup d'œil où cliquer ; les données importantes d'abord ; des messages d'encouragement mis en forme ;
  des listes malignes (filtres, tris, compteurs) ; des animations sobres ; aucun bloc « par défaut ».
- **Tout changement visible fait dans le site se fait aussi dans Figma** : ajoute ta ligne dans
  `Design/a-reporter-dans-figma.md` dans la même passe (écran, changement, règle, date).

## Le dépôt

```
apps/api      NestJS 12 (ESM), Prisma 7 + PostgreSQL 16 — port 4000
apps/web      Next.js 16 : site public + espace client + espace partenaire — port 3000
apps/admin    Next.js 16 : back-office — port 3001 (en construction, voir SUIVI.md)
packages/contracts   types, schémas zod, permissions, paramètres, blocs de contenu (partagés API ↔ fronts)
packages/domain      calculs (crédit, éligibilité, projection, calendrier, complétude…)
packages/i18n        textes : messages/fr/<espace-de-noms>.json — clés typées t('ui.<ns>.<clé>')
packages/ui          système de design en code (jetons CSS, Button, Icon, Scene…)
e2e/                 Playwright (tests/, helpers/, shots.mjs pour les captures)
Specs/               LA référence (v1.5). Ne se duplique pas : on la corrige sur place.
Design/              maquette de la cliente, exports Figma, images d'origine
Dev/                 ecarts-code-specs.md (écarts code ↔ specs, déjà reportés par D-097)
docs/                contexte-claude.md (façon de penser, méthode), figma-mcp-pieges.md
HANDOFF.md           dossier de reprise pour un nouveau développeur
Legal/, Strategie/   contrat, PV, documents de cadrage — hors du dépôt git (chez SYMLOOP seulement)
```

### Démarrer en local (Windows, sans Docker)

```bash
pnpm install                                   # Node 22, pnpm 12 ; « pnpm approve-builds » si demandé
cp apps/api/.env.example apps/api/.env         # puis remplir les clés (voir ci-dessous)
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
pnpm --filter @dp/api db:install               # une fois : PostgreSQL 16 embarqué, port 5433, données dans .local/pg
pnpm --filter @dp/api db:start                 # à laisser tourner
pnpm --filter @dp/contracts build && pnpm --filter @dp/domain build && pnpm --filter @dp/i18n build
pnpm --filter @dp/api build && pnpm --filter @dp/api db:deploy
pnpm --filter @dp/api install:run              # données d'installation (rejouable)
pnpm --filter @dp/api demo                     # facultatif : catalogue et Cafés de démonstration
pnpm --filter @dp/api dev                      # API en mode veille (recompile et redémarre)
cd apps/web && npx next dev --port 3000        # site ; cd apps/admin && npx next dev --port 3001
```

- Les secrets de `.env` (`JWT_SIGNING_KEY`, `IP_HASH_KEY`, `LINK_SIGNING_KEY`, `ENCRYPTION_KEY`, `REVALIDATE_SECRET`) se
  génèrent localement, chacun avec `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
  **Jamais** dans un message, un commit ou un fichier suivi. `.env*` et `.local/` sont ignorés par git.
- **Les e-mails ne partent pas en local** : ils sont écrits en `.eml` dans `.local/mail/` (lien de vérification, lien de
  connexion, invitation du personnel…). Pour tester un parcours, lis le lien dans le dernier fichier.
- **Ouvrir le site depuis une autre machine du réseau** (`http://<adresse-de-la-machine>:3000`, `:3001` pour le
  back-office) fonctionne en local : `allowedDevOrigins` dans les deux `next.config.ts` (rechargement à chaud, bouton
  des outils Next), connexion acceptée depuis une adresse privée quand `APP_ENV=local` (`identity/http.ts`), images
  servies par le site lui-même (`/media-files`, relayé vers l'API). Limite : les liens des e-mails (`.eml`) restent en
  `localhost` — remplacer l'hôte à la main, ou ouvrir le lien sur la machine qui héberge.
- Premier compte Direction : `pnpm ops owner:invite --email … --first-name … --last-name …` (invitation en `.eml`).
- Paramètre à changer hors écran : `pnpm ops setting:set --key … --value '…' --reason "…"` (journalisé).
- Carte : `MAP_STYLE_URL` (web). Assistant conversationnel : `AI_PROVIDER`, `AI_API_KEY` (sans clé : questionnaire guidé).

### Vérifier avant de dire « fait »

```bash
PYTHONUTF8=1 python Specs/_outils/verifier_specs.py     # doit finir par « Tout est cohérent. » après toute retouche des specs
cd apps/api && npx tsc -p tsconfig.build.json --noEmit && npx vitest run
cd apps/web && npx tsc --noEmit                         # idem apps/admin
cd e2e && npx playwright test                           # un seul worker ; pile locale démarrée
cd e2e && MSYS_NO_PATHCONV=1 node shots.mjs <dossier> /chemin …   # captures 1440 et 390 px, à regarder
```

### Conventions qui évitent les pièges déjà rencontrés

- **ESM partout** côté API et paquets : imports avec suffixe `.js`. Client Prisma généré dans `apps/api/src/generated/prisma`.
  Le schéma Prisma couvre toutes les phases : on n'y touche que si c'est inévitable, par une migration.
- **Après avoir modifié `packages/contracts` ou `packages/i18n`**, reconstruis-les (`npx tsc -p tsconfig.json` / `pnpm --filter @dp/i18n build`).
  Si Next ne voit pas les nouvelles clés : redémarre `next dev`.
- **Un espace de noms i18n par module**, et on **ajoute** à `packages/contracts/src/index.ts` (une ligne d'export) sans
  réécrire le fichier : plusieurs personnes y touchent.
- Routes : `/public/*` (anonyme), `/client/*` (`@ClientAccess()`), `/admin/*` (`@RequirePermission('…')`), `/partner/*` ;
  une route protégée sans déclaration est refusée au démarrage. Session facultative sur une route publique :
  `@UseGuards(OptionalClientSession)`. Tout est dans `apps/api/src/identity/access.ts`.
- Écritures : idempotence (`Idempotency-Key`), événements par la boîte d'envoi (`platform/outbox.ts`) dans la même
  transaction, journal d'audit (`admin/audit.ts`) avec **les noms de la spec** (`Specs/06-technique/03`, table d'audit).
- Lecture de données privées dans un composant serveur : transmettre les cookies du visiteur, **jamais** le cache partagé
  (`apiGet` est réservé au public). Espace client : `apps/web/src/components/client-space/README.md`. Back-office :
  `apps/admin/src/components/shell/README.md`. Automatisations : `apps/api/src/automation/README.md`.
- **Dans le navigateur, jamais `crypto.randomUUID`, `crypto.subtle` ni `navigator.clipboard` en direct** : ils
  n'existent que sur https ou localhost, et la page plante (« Un problème est survenu de notre côté ») dès qu'on
  l'ouvre par l'adresse réseau d'une machine. Utiliser `newUuid()`, `sha256Hex()`, `copyText()` de `@dp/ui`.
- Limites de débit en mémoire (pas de Redis en local) : entre deux séries complètes de tests, redémarre l'API.
- Sous Windows : `PYTHONUTF8=1` pour tout script Python ; `MSYS_NO_PATHCONV=1` quand un chemin d'URL passe par Git Bash.
- Le disque de la machine de Zakaria est presque plein : pas de dépendance lourde sans nécessité.

### Sécurité

- Ne jamais afficher ni recopier une valeur de `.env`. La clé de `Dev/chatbot/.env` est à révoquer : ne pas l'utiliser.
- Le PV contient un lien personnel de la cliente : ne pas l'utiliser ni le citer.
- Les comptes de test locaux se notent dans `.local/test-accounts.txt` (ignoré), nulle part ailleurs.

## Travailler à plusieurs (toi, les autres développeurs, leurs sessions Claude)

1. **Avant de commencer** : lis `SUIVI.md`. Vérifie dans « En cours » que personne ne travaille déjà sur ton paquet ou
   sur les mêmes fichiers. Inscris-toi dans « En cours » (qui, quel paquet, quels dossiers, depuis quand).
2. **Pendant** : reste dans le périmètre annoncé. Si tu dois toucher le module d'un autre, fais-le petit, sans changer
   son comportement, et note-le dans le journal.
3. **Avant de terminer** : déplace ta ligne de « En cours » vers « Fait » (ou laisse-la avec ce qui reste), ajoute une
   entrée datée au journal de `SUIVI.md` (ce qui a été fait, tests, écarts, questions), mets à jour le tableau du plan
   (`Specs/08-tracabilite/02-plan-de-realisation.md`, § 5) si un paquet change d'état.
4. Une décision prise en discutant (taux, wording, choix de fournisseur…) va dans `Specs/00-cadre/05` (D-nnn ou Q-nnn),
   pas seulement dans un message.
5. Le projet est sous git (dépôt GitHub `zakaria1symloop/diaspora-patrimoine`, branche `main`, depuis le 2026-10-11).
   Une branche par paquet (`paquet/3.2-demandes`…), des commits qui citent les règles réalisées, une demande de fusion
   relue avant `main`. Même avec git, on ne travaille pas à deux sur le même fichier en même temps : `SUIVI.md` § 3 le
   dit. **Jamais de secret, de contrat ni de prix dans le dépôt** : `.env*`, `.local/`, `Legal/`, `Strategie/` sont
   ignorés.
