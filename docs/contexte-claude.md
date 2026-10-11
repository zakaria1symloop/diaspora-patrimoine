# Contexte pour les sessions Claude Code

> Ce que les sessions Claude de Zakaria ont appris en travaillant avec lui (août → octobre 2026), pour qu'une nouvelle
> session — la tienne — ne reparte pas de zéro. `CLAUDE.md` donne les règles ; ce fichier donne **la façon de penser**
> derrière, et les pièges de méthode. À lire une fois, à relire quand tu touches au design ou à Figma.

## 1. Qui décide, comment il parle

- **Zakaria (SYMLOOP)** est le donneur d'ordre technique et l'architecte ; il fait le lien avec la cliente (Diaspora
  Patrimoine, Mme Mouhoubi, Direction). Il écrit vite, en anglais familier, parfois avec des fautes : lire l'intention.
  Les documents du projet sont en **français**.
- Comptes rendus **courts et concrets** : ce qui marche, comment c'est vérifié, ce qui reste. Une longue explication
  est survolée. Si une étape bloque (une autorisation, un accès), le dire en une phrase d'abord.
- Une décision prise en discutant va dans `Specs/00-cadre/05` (D-nnn) le jour même, pas seulement dans la conversation.

## 2. Sa façon de juger le travail

- **Un défaut signalé est un exemple** (D-098). Il donne le principe une fois ; on cherche et on corrige tous les autres
  endroits où il s'applique, sur tout le produit, sans attendre qu'il passe page par page. Les principes déjà donnés :
  pleine largeur dans les espaces connectés ; jamais un composant du site public posé tel quel ailleurs (chaque carte
  se dessine pour ce qu'on fait sur sa page) ; chaque bouton montré fonctionne là où il est ; on voit d'un coup d'œil
  où cliquer ; les données importantes d'abord ; des messages d'encouragement mis en forme ; des listes malignes
  (filtres, tris, compteurs, états vides utiles) ; des animations sobres ; aucun bloc « par défaut ».
- **« La logique », c'est le comportement de la personne** (D-095). Relire chaque page en marchant comme le visiteur :
  d'où il arrive (accueil, moteur de recherche, lien d'e-mail, bouton retour), ce qu'il veut, où mène chaque action, ce
  dont le site se souvient (filtres, formulaires, simulations après un rechargement ou le lendemain), la continuité des
  données entre pages et e-mails, les chemins d'erreur. Le public est souvent âgé et peu technique.
- **Pages vivantes** (D-091 à D-093) : pas de page blanche nue ; une scène dessinée qui s'anime une fois sur les pages
  à une seule tâche ; les pages de contenu commencent par quelque chose à essayer, peu de cartes, peu de texte ; une
  porte par acteur (client, partenaire, équipe).
- **Moderne et singulier, pas générique.** Il rejette le « déjà vu » (pastille à point, cartes immobiles en grille,
  mise en page fidèle d'un brief sans idée). Il attend un concept par section. Exemple récent : les six motivations de
  l'accueil sont passées de six cartes statiques à une vitrine animée (D-101).
- **Les phases sont des acteurs, pas des fonctions retenues** (D-089) : une page se construit complète une fois ; une
  section se masque quand sa donnée manque. On ne remplace jamais une vraie fonction par un repli.
- **Livrer par tranches qui marchent** (D-006) : environ 20 % ou un lot, chaque tranche utilisable de bout en bout,
  aucun bouton mort, rien qui attend un lot suivant.
- **Après une passe, regarder soi-même les captures** (1440 et 390 px), avec de vraies données dans les pages et pas
  seulement les états vides, avant de dire « fait ».

## 3. Design et Figma

- Ordre de travail : **`Specs/` d'abord** (règle, décision), puis le code, puis **Figma** — Figma est ce que la cliente
  valide. Tout changement visible du site s'ajoute à `Design/a-reporter-dans-figma.md` dans la même passe.
- Fichier Figma « Diaspora Patrimoine — Design » (clé et structure dans `Design/figma-ledger.json`, règles dans
  `Specs/07-design/`). Demander l'accès à Zakaria. Direction « Bleu & Or » (D-003), jetons `bo/…`.
- Une maquette transmise par la cliente est un **brouillon de contenu et de marque**, pas une mise en page à recopier :
  on garde son style (bleu nuit, or, « Le Café », la comparaison Alger/France) et on professionnalise l'exécution.
- Au stade des propositions, des **chiffres d'exemple** marqués « exemple indicatif », pas de recherche de taux réels.
- Filtres du catalogue : **panneau à droite** qui laisse les résultats visibles (décidé le 11/10/2026 après usage ; une
  modale centrée avait été choisie avant).
- Calques Figma nommés en français (« Section · Héros », « Bouton · Exprimer mon intérêt »), composants en anglais.
- Pièges de l'outil Figma (`use_figma`) : voir `docs/figma-mcp-pieges.md`.

## 4. Méthode des sessions (ce qui a marché, ce qui a cassé)

- Le travail du 11/10/2026 a été fait par **plusieurs sessions en parallèle**, une par paquet, chacune inscrite dans
  `SUIVI.md` § 3 avec ses dossiers. Ça marche à condition de :
  - ne jamais écrire à deux dans le même fichier ; dans un fichier partagé (`packages/contracts/src/index.ts`,
    `rule-seeds.ts`, fichiers i18n, `SUIVI.md`), **relire juste avant**, **ajouter** sans réécrire ;
  - **reconstruire `packages/contracts` / `packages/i18n` jusqu'au bout** après les avoir modifiés : une construction
    interrompue a laissé un paquet incomplet et toutes les pages du site ont planté (« Export ContactChannel doesn't
    exist ») ;
  - **garder les serveurs debout** : Zakaria regarde le site depuis une autre machine (`http://<adresse>:3000` et
    `:3001`). Si tu redémarres un serveur, relance-le aussitôt sur le **même port**, avec `--hostname 0.0.0.0` pour
    Next, et vérifie qu'il répond par l'adresse réseau ; ne tue jamais un serveur pour lancer ta propre copie ;
  - garder `npx tsc -p tsconfig.build.json --noEmit` propre dans `apps/api` après chaque modification : l'API en mode
    veille s'arrête quand la compilation échoue, pour tout le monde ;
  - **une seule série Playwright à la fois** : deux séries simultanées effacent `test-results/` l'une de l'autre.
- Un texte i18n ne contient pas d'accolades littérales : `DP-{pays}` est lu comme une variable et la page plante.
- Après l'ajout de clés i18n, si Next ne les voit pas : redémarrer `next dev`.
- Comptes de test : les créer soi-même par les vrais parcours (`pnpm ops owner:invite`, `/inscription`) et les noter
  dans `.local/test-accounts.txt` (ignoré par git), jamais ailleurs.
