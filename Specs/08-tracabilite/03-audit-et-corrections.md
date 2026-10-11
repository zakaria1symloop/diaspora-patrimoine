# Audit des spécifications et corrections — version 1.2

Avant d'écrire la première ligne de code, les spécifications ont été relues de bout en bout, comme on recette un produit : en jouant chaque parcours, avec ses cas tordus, en comptant l'argent, et en se mettant à la place de celui qui clique. Ce fichier dit ce que cette relecture a trouvé, ce qui a été corrigé, et ce qui reste à décider. Il sert de trace : chaque constat y figure, avec la règle qui le règle.

Demande de SYMLOOP du 2 octobre 2026 : « auditer les specs, fermer chaque trou, penser à tous les scénarios — comportement, argent, expérience — pour que les specs décrivent un produit de bout en bout ».

---

## 1. Méthode

1. **Neuf lectures indépendantes**, une par parcours (§ 2). Chacune a lu les fichiers de son parcours sans connaître les conclusions des autres, et a rendu une liste de constats, chacun avec la règle en cause et le scénario qui le révèle.
2. **Des recoupements mécaniques** : tout identifiant cité quelque part — règle, écran, champ, permission, paramètre, événement, modèle d'e-mail — a été cherché là où il doit être défini.
3. **Une vérification chiffrée** : les exemples de calcul (mensualité, capacité d'emprunt, budget) ont été refaits à la main.
4. **Chaque constat a été vérifié dans le texte avant d'être corrigé.** Un constat faux ou sans objet est noté comme tel (§ 6), pas corrigé.
5. **Les corrections sont dans les specs**, pas dans ce fichier : une règle modifiée garde son numéro, une règle nouvelle prend le numéro suivant, un choix structurant devient une décision (`00-cadre/05`, § 1.5).
6. **Une vérification de clôture, en trois passes.** Les corrections faites, chaque constat a été relu **contre le texte corrigé** par un lecteur qui n'avait pas écrit la correction : 145 constats étaient réglés, 61 ne l'étaient qu'en partie. Ces lecteurs ont relevé au passage une centaine de points de plus — contradictions restantes, scénarios sans réponse, exemples chiffrés faux, règles que le moteur d'automatisation n'aurait pas su exécuter. Tout a été repris. Une deuxième passe a relu ces corrections et cherché ce qu'elles avaient pu défaire : une dizaine de points encore ouverts et quelque quatre-vingts retombées — le plus souvent une correction écrite dans une règle et oubliée dans ses voisines. Une troisième a suivi douze mécanismes d'un bout à l'autre du dossier (§ 3.11) : une centaine de retouches, de plus en plus petites, relues à leur tour. La relecture s'est arrêtée quand elle ne trouvait plus que des détails de formulation. Rien ne garantit qu'il n'en reste aucun : pour ce cas, l'agent de développement a sa consigne (plan, § 2) — toute situation non décrite devient une question, avec une valeur par défaut prudente.
7. **L'outil de contrôle a été étendu** (§ 8), pour que les défauts d'une même famille ne reviennent pas.

Gravité : **bloquant** — un parcours de Phase 1 ne peut pas se jouer, ou une donnée sensible est exposée ; **majeur** — le comportement est indéfini, contradictoire, ou trompe quelqu'un ; **mineur** — une précision manque, sans conséquence sur un parcours.

## 2. Les constats, en chiffres

| Lecture | Ce qu'elle regarde | Bloquants | Majeurs | Mineurs | Total |
|---|---|---|---|---|---|
| Du visiteur à la demande | Le site public, les formulaires, les simulateurs, les accusés de réception. | 2 | 12 | 8 | 22 |
| De bout en bout, livraison par livraison | Chaque parcours joué en entier ; chaque livraison prise seule. | 3 | 11 | 10 | 24 |
| L'argent | Prix, devises, taux, mensualités, capacité d'emprunt, acompte, offre de banque. | 1 | 16 | 3 | 20 |
| Le quotidien du conseiller | Demandes, fiches clients, dossiers, pipeline, tâches, droits. | 0 | 17 | 3 | 20 |
| Le compte et l'espace du client | Inscription, connexion, tableau de bord, biens proposés, suppression. | 1 | 13 | 7 | 21 |
| Les pièces et les banques | Listes de pièces, dépôts, versions, soumissions, liens, décisions. | 1 | 12 | 9 | 22 |
| Rôles, sécurité, vie privée, fiabilité | Permissions, sessions, journal d'audit, effacement, pannes. | 1 | 17 | 7 | 25 |
| E-mails, notifications, automatisations | Qui est prévenu de quoi, quand, et combien de fois. | 1 | 16 | 1 | 18 |
| Catalogue, lots, réservations | Publication, disponibilités, import, options, compteurs. | 1 | 11 | 5 | 17 |
| Recoupements mécaniques | Tout identifiant cité doit exister ; toute liste doit être complète. | 0 | 1 | 10 | 11 |
| Vérification chiffrée | Les exemples de calcul refaits à la main. | 0 | 4 | 2 | 6 |
| **Total** | | **11** | **130** | **65** | **206** |

Suite donnée : les 206 constats sont corrigés dans les specs (206 sur 206) ; aucun n'a été écarté comme faux, aucun n'est reporté. L'annexe donne, pour chacun, la règle qui le règle.

## 3. Ce qui a changé, thème par thème

### 3.1 L'argent

Ce qui n'allait pas, vu de l'utilisateur :
- un administrateur tape 1 485 au lieu de 148,5 pour un taux de change : tous les prix du site sont multipliés par dix, et rien ne permet de corriger avant le lendemain ;
- un visiteur sans apport lit « Bonne nouvelle » au-dessus d'un budget de 0 € ;
- le financement « à 0 % » qui sert d'accroche aux cartes pilotait aussi les simulateurs : la capacité d'emprunt affichée était le double de la réalité ;
- le budget annoncé ignorait les frais de notaire et d'enregistrement ;
- le prix d'un projet vivait dans quatre champs ; un acompte versé puis une réservation annulée ne laissaient aucune trace de ce qui était dû au client ;
- la mensualité d'une offre de banque ne pouvait pas être recalculée, faute d'en garder les conditions ; une décision saisie par erreur partait chez le client sans retour possible.

Ce qui est décidé : un cours se corrige et s'annule, avec un contrôle de vraisemblance à la saisie (D-060, CAL-010, BNK-064) · les chiffres d'un résultat viennent d'un seul produit, un budget nul n'est jamais une bonne nouvelle, et le budget se lit comme l'apport plus le financement, moins les frais — des chiffres qui s'additionnent à l'écran (D-061, CAL-101 à CAL-104, CAL-026) · un barème indicatif propre aux simulateurs, jamais sous 1 %, avec un montant et une durée minimum (D-062, PAR-044) · des frais d'acquisition par pays, et la mention « hors frais » tant qu'ils ne sont pas fournis (D-063, CAL-106, SIM-009) · un seul prix par projet, un acompte suivi jusqu'à son issue (D-064, MOD-313, CYC-108) · l'offre d'une banque porte ses propres conditions, se corrige, s'annule, se prolonge (D-065, BNK-130, CYC-169) · un barème par durée (CAL-048) · une saisie de montant qui ne confond plus milliers et décimales (TRV-026) · des revenus de deux emprunteurs jamais additionnés dans deux devises (MOD-322, BNK-110).

### 3.2 Livrer par étapes

Ce qui n'allait pas : la plateforme se livre en cinq fois, mais des parcours des livraisons 3 et 4 dépendaient de pièces prévues à la 5 — le moteur des relances, l'adresse d'expéditeur, les textes légaux, l'e-mail écrit à la main ; l'espace client montrait des onglets et des boutons vers des fonctions pas encore livrées ; rien ne permettait de démontrer en une séance une option qui expire dans sept jours.

Ce qui est décidé : le moteur d'automatisation est dans le socle, et chaque module livre ses règles avec ses écrans (D-068, AUT-083) · des textes légaux provisoires sont en vigueur dès l'installation (D-073, PAR-083) · l'expéditeur vient de l'environnement tant que le paramètre est vide (NOT-003) · une seule porte d'accès, qui couvre aussi l'API (D-069, NAV-064) · une horloge de recette (D-070, ENV-032) · « Écrire à mon conseiller » tient lieu de messagerie jusqu'à la dernière livraison (MSG-021) · rien ne mène à une fonction qui n'est pas là — menu, barre du haut, préférences, boutons des e-mails (ECL-006, BO-010, BO-070, QUA-074, parcours P36) · le plan dit, livraison par livraison, ce que le client voit (`08-tracabilite/02`, § 4) · le site s'ouvre au public à la livraison 5 ; l'ouvrir plus tôt est un paquet à part, qui avance les paramètres, les textes légaux, les droits sur les données et les essais de durcissement (D-085).

### 3.3 Le visiteur et sa demande

Ce qui n'allait pas : une demande corrigée après une erreur était refusée une seconde fois ; l'accusé de réception d'un intérêt pour un programme citait un bien inexistant ; « Être rappelé » devenait un simple message, sans dossier ni délai ; une demande pouvait être classée indésirable sans que personne ne la relise ; « Enregistrer » une simulation sans compte ne gardait rien ; les réponses de certains formulaires révélaient l'existence d'un compte.

Ce qui est décidé : une clé d'idempotence ne retient que les réussites (D-075, API-040) · les montants d'un formulaire ont une devise dite (DEM-007) · « Quand vous appeler ? » (DEM-008) · une demande de rappel est une vraie demande, avec son délai (DEM-015) · une demande écartée par le filtre est relue (DEM-031, TDB-010) · une même confirmation, qu'un compte existe ou non (DEM-021, DEM-023) · un défi anti-robots qui garde la saisie (TRV-110).

### 3.4 Le compte et l'espace du client

Ce qui n'allait pas : quelqu'un pouvait créer un compte avec l'adresse d'un autre, puis s'y connecter après que le vrai titulaire avait cliqué sur le lien de vérification ; chaque nouvel e-mail tuait le bouton du précédent ; un compte activé par lien ne pouvait ni exporter ni supprimer ses données ; l'accord de transmission bloquait le dossier sans que le client le sache ; une adresse rejetée pouvait enfermer le client dehors.

Ce qui est décidé : le lien de vérification ne connecte que dans le navigateur de l'inscription, les liens d'activation restent valables jusqu'à leur premier usage, une action sensible se confirme par un code (D-072, AUTH-013, AUTH-040, AUTH-086) · l'accord de transmission est demandé par une carte « À faire » (DOS-040, ECL-011) · le tableau de bord est défini dans chaque situation (ECL-014) · les e-mails de compte et de sécurité partent malgré un rejet passé (D-078, NOT-014) · une suppression demandée en plein dossier a un déroulé (PRO-060) · un lien de connexion ne confirme jamais une inscription que quelqu'un d'autre a faite avec votre adresse (AUTH-041) · un lien d'activation périmé n'enferme personne dehors (AUTH-040).

### 3.5 Le quotidien du conseiller

Ce qui n'allait pas : impossible d'enregistrer quelqu'un qui appelle sans donner d'e-mail ; ce qui se passe pendant une pause n'était pas dit ; rouvrir un dossier restaurait une étape dont les conditions n'existaient plus ; un cache recalculé en fond faisait échouer l'enregistrement du conseiller ; des gestes d'écran n'avaient pas de permission.

Ce qui est décidé : une fiche peut exister sans e-mail, et une tâche remplace alors l'e-mail de service (D-071, MOD-302, NOT-025) · la pause suspend les relances, pas les échéances (D-076, CYC-034) · la réouverture ne rétablit rien d'office (CYC-036) · le changement de conseiller emporte tâches, rendez-vous et demandes (CYC-040) · les écritures du système ne changent pas la version d'un objet (D-074, MOD-007) · chaque geste a sa permission, et chaque route la sienne (ROL-018, ROL-019, ROL-023, API-100) · un conseiller absent ne reçoit ni la demande ni le dossier qu'il ne pourrait pas traiter à temps (CRM-020, CYC-002) · un rendez-vous figure toujours dans l'espace du client ; la case « Informer le client par e-mail » ne règle que les e-mails (TAC-040, INT-041).

### 3.6 Les pièces et les banques

Ce qui n'allait pas : le lien du dossier envoyé à une banque, et son code, se lisaient dans le journal des e-mails ; les versions d'une pièce n'avaient pas de table ; une pièce de dix pages photographiées dépassait la limite et arrivait en images à la banque ; les pièces d'un emprunteur retiré restaient cochées pour l'envoi ; l'accord du client n'était vérifié qu'au premier envoi.

Ce qui est décidé : un e-mail qui porte un lien à jeton ou un code est conservé expurgé (D-067, NOT-002) · chaque dépôt est une version, et les photos d'un dépôt deviennent un PDF (D-066, MED-032) · les fichiers nés d'un geste du dossier deviennent des pièces, toujours de la même façon (GED-037) · seules les bonnes pièces sont proposées à l'envoi (BNK-103) · l'accord de transmission est revérifié à chaque geste qui fait sortir une pièce (CYC-161, BNK-113) · la décision d'une banque est **publiée** dix minutes après sa saisie : d'ici là rien ne bouge pour le client, et une saisie par erreur s'annule sans trace (CYC-165, CYC-169) · renouveler une pièce validée ne la fait pas cesser d'être valable (CYC-141) · un acheteur comptant n'est plus relancé pour les pièces d'un financement (CYC-041, GED-031).

### 3.7 E-mails, notifications, automatisations

Ce qui n'allait pas : un client en pause découvrait que son option avait expiré sans avoir été prévenu ; trois biens proposés ensemble valaient trois relances ; la même personne était alertée deux ou trois fois pour un seul geste ; le rejet de la boîte d'une banque coupait les e-mails du client ; « 3 jours ouvrés » ne pouvait pas s'enregistrer comme délai d'une règle.

Ce qui est décidé : les rappels d'une échéance qui court partent malgré la pause (D-076, AUT-007) · une opération, une notification (D-077, NOT-035) · un rejet concerne une adresse, pas une personne (D-078, AUT-071) · un délai a une valeur et une unité (AUT-004) · les relances de pièces repartent proprement après une reprise (AUT-042) · chaque notification employée est au catalogue, avec son texte (NOT-030) · une notification du catalogue l'emporte sur l'alerte d'une règle, qui l'emporte sur l'avis d'une tâche : une personne, un fait, une notification (NOT-035) · chaque règle livrée n'emploie que des champs, des destinataires et des échéances que le moteur sait exécuter (AUT-020, AUT-031 à AUT-033).

### 3.8 Le catalogue

Ce qui n'allait pas : une livraison promise « au 2e trimestre » était dite « dépassée » dès le premier jour du trimestre ; un programme entièrement vendu annonçait des biens « bientôt » ; réimporter une grille remettait en vente des lots réservés ; un lot marqué « vendu » par erreur ne revenait pas ; une fiche mise hors ligne pour correction était traitée comme un bien indisponible.

Ce qui est décidé : la livraison est dépassée à la fin de sa période (MOD-202) · un programme a un état commercial (CYC-127) · l'import ne touche pas au statut d'un lot existant (CTL-102) · une vente hors plateforme saisie par erreur se corrige (CYC-100) · le dossier qui visait un lot pris par un autre est prévenu (CYC-102) · « hors ligne » n'est pas « indisponible » (CYC-121) · les vues se comptent par un signal, pas par l'affichage d'une page en cache (FIC-100) · un lot que le promoteur reprend ne repasse jamais en vente entre deux saisies (CYC-105, CYC-107) · celui qui vient d'acheter un bien ne lit pas qu'il « n'est plus disponible » (CYC-073) · un programme dépublié revient avec ses biens (CYC-126) · un réimport qui contredit un dossier prévient son conseiller (CTL-102).

### 3.9 Rôles, sécurité, vie privée

Ce qui n'allait pas : les liens de connexion et d'invitation se lisaient dans le journal des e-mails ; le rôle Lecture seule lisait par d'autres écrans les revenus que ses permissions lui cachent ; « Voir comme le client » n'avait pas de mécanisme ; deux onglets ouverts déconnectaient l'utilisateur ; une durée de conservation mal saisie effaçait des données pour de bon ; effacer un acquéreur avait trois réponses.

Ce qui est décidé : D-067, déjà cité · la liste des champs sensibles vaut pour tous les écrans (SEC-033), et le masquage du Support aussi (SEC-032) · l'aperçu de l'espace d'un client est une session en lecture seule, de trente minutes, sans effet de lecture (ROL-017) · un renouvellement de session tolère dix secondes (SEC-021) · les durées de conservation ont des bornes, et une purge inhabituelle attend une confirmation (PAR-006) · ce qui reste d'une personne effacée dépend de ce qu'elle a été — contact, dossier perdu, acquéreur (SEC-111) · la limitation du traitement a ses gestes, sa raison, et vaut aussi pour un co-emprunteur ou un garant (ADM-063) · un effacement vide tout champ de texte libre, sans liste à tenir à jour (SEC-111, QUA-026) · aucune action ne se contente d'un nom de rôle (API-100).

### 3.10 La cohérence d'ensemble

Chaque statut a désormais son ton, sans oubli (DSN-015) ; les petites listes fermées sont au catalogue des énumérations (`01-domaine/01`, § 3.11) ; l'inventaire compte ses écrans juste, et chaque écran a sa page et sa livraison ; chaque permission, paramètre, événement ou bloc de contenu cité est défini là où il doit l'être.

### 3.11 Ce que la vérification de clôture a encore changé

Les corrections les plus délicates ont été celles où un comportement nouveau devait se retrouver dans dix règles à la fois. Douze mécanismes ont été réécrits pendant la vérification, puis suivis d'un bout à l'autre du dossier : la **publication différée** d'une décision de banque (CYC-165) ; le **renouvellement** d'une pièce validée (CYC-141) ; le **message écrit depuis l'espace client**, qui cite un dossier sans y être rattaché (MSG-021) ; les **rendez-vous**, toujours visibles du client (TAC-040) ; l'**achat sans financement** — un seul texte d'accord, un co-acquéreur, pas de garant (DOS-040, CYC-041) ; les **chiffres d'un résultat d'éligibilité** et leur reprise par le simulateur de crédit (CAL-104, SIM-031) ; le **lot repris par le promoteur** (CYC-107) ; la **demande d'un client dont le conseiller est absent** (CRM-020) ; la **limitation et l'effacement**, y compris pour un co-emprunteur (ADM-063) ; **une opération, une notification**, avec son ordre de priorité (NOT-035) ; le **lot dupliqué**, jamais en vente sous une référence provisoire (MOD-230) ; l'**état commercial d'un programme** et son retour en ligne (CYC-126, CYC-127).

## 4. Décisions prises

Vingt et une décisions — D-060 à D-079, et D-085 — sont au registre (`00-cadre/05`, § 1.5), chacune avec sa raison. Elles sont citées au § 3 avec le thème qu'elles règlent.

## 5. Ajout du 3 octobre : trois niveaux d'accès pour les promoteurs et les banques

Pendant l'audit, SYMLOOP a demandé que l'accès des promoteurs et des banques ait trois versions — simple, intermédiaire, complète — **sur un seul chemin**, pour commencer à la main et ouvrir des accès plus tard sans rien refaire. Le côté client ne change pas.

C'est le fichier `00-cadre/06` (règles ACP-001 à ACP-073, décisions D-080 à D-084) : au niveau 1, l'équipe saisit pour le partenaire — c'est la Phase 1 ; au niveau 2, il répond par un lien sécurisé ; au niveau 3, il a son portail. Pour que le chemin soit le même dès le premier jour, la Phase 1 applique une règle — les gestes d'un partenaire sont des commandes de l'API, jamais des règles d'écran (ARC-014) — et garde trois informations, qui ferment au passage trois risques d'un catalogue tenu à la main : le **promoteur tient-il le lot** d'une option — le client n'apprend qu'une option est posée que lorsque c'est le cas (CYC-107) ; **qui accueille** une visite sur place (TAC-045) ; **quand** les disponibilités et les barèmes ont été vérifiés pour la dernière fois (AUT-079). Rien d'autre des niveaux 2 et 3 n'est construit en Phase 1 : ni réglage, ni écran, ni test (ACP-071). Cette conception a été relue à son tour par un lecteur indépendant ; ses constats ont été traités avec les autres.

## 6. Ce qui reste à décider

- **Questions ouvertes**, chacune avec la valeur par défaut que le code applique : Q-044 (ouvrir ou non le site avant la livraison 5), Q-045 (frais d'acquisition), Q-046 (barème indicatif), Q-047 (ordre d'ouverture des niveaux 2 et 3), Q-048 (rythme des vérifications avec les partenaires) — et les questions antérieures, toujours ouvertes (`00-cadre/05`, § 2).
- **À dire à la cliente** : onze points (`00-cadre/05`, § 3).
- **Hors contrat** : dix éléments `[P1+]` attendent leur arbitrage (`00-cadre/01`, § 6).
- **Constats sans suite ou reportés** : aucun. Ce qui reste ouvert, ce sont des décisions à prendre, pas des défauts connus.

## 7. Ce que l'audit n'a pas couvert

- L'application mobile et les fonctions d'intelligence artificielle (`05-phases-ulterieures/03` et `04`) : lues pour leur cohérence avec la Phase 1, pas jouées scénario par scénario.
- Les éléments `[P1+]` — Le Café, l'assistant, la projection, les favoris et alertes : vérifiés là où ils touchent un parcours de Phase 1 (replis de l'accueil, statuts, notifications), pas audités pour eux-mêmes.
- Les maquettes : seul l'accueil existe ; l'inventaire des écrans a été mis à jour, pas dessiné.
- Les textes légaux : provisoires, à faire relire par le conseil de Diaspora Patrimoine.
- Les valeurs chiffrées de départ — taux, barèmes, frais : ce sont des exemples, marqués comme tels.
- La tenue en charge, les temps de réponse : objectifs posés (`06-technique/06`), à mesurer sur le produit.

## 8. L'outil de contrôle

`python Specs/_outils/verifier_specs.py` fait désormais douze contrôles (QUA-025). Cinq ont été ajoutés ou refaits par l'audit, parce qu'un constat avait montré leur absence :

| Contrôle | Le constat qui l'a fait naître |
|---|---|
| Un écran n'existe que s'il a sa ligne à l'inventaire ; il a sa page et sa place dans l'ordre de maquettage | Le contrôle « créait » les écrans enjambés par une plage : EA-47, cité, n'existait pas ; le README annonçait 143 écrans pour 130. |
| Chaque code à points cité est défini dans son registre | Des permissions, des paramètres et des événements étaient cités sans exister, ou sous deux noms. |
| Le déclencheur de chaque règle d'automatisation est un événement du catalogue | Des règles attendaient un événement que rien n'émettait. |
| Chaque statut a son ton, une seule fois | Des statuts sans couleur, d'autres avec deux. |
| Les chiffres du README sont ceux du dossier | Ils ne l'étaient plus. |

Il se lance après toute modification des specs et doit finir par « Tout est cohérent. ».

---

## Annexe — les 206 constats

« Suite » : **Corrigé** — la règle citée règle le constat. « Réglé par » nomme la ou les règles où lire la réponse ; d'autres règles ont souvent été alignées avec elles.

### Du visiteur à la demande

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| A1.1 | Bloquant | Intérêt pour un programme sans bien précis : l'accusé de réception citait un bien qui n'existe pas. | Corrigé | NOT-050, NOT-060 |
| A1.2 | Bloquant | Aucun texte légal en vigueur avant la dernière livraison : l'inscription ne pouvait pas citer la version acceptée. | Corrigé | PAR-083 |
| A1.3 | Majeur | Clé d'idempotence posée à l'ouverture du formulaire : une saisie corrigée après une erreur était refusée. | Corrigé | TRV-091, API-040 |
| A1.4 | Majeur | Demande en double sous 24 h : les corrections étaient perdues, et la réponse révélait l'existence d'une demande. | Corrigé | DEM-024 |
| A1.5 | Majeur | « Être rappelé » retombait sur un message de contact : ni dossier, ni délai, ni créneau. | Corrigé | DEM-015 |
| A1.6 | Majeur | Accusé de rappel : phrase cassée quand le téléphone de la société est vide. | Corrigé | NOT-053 |
| A1.7 | Majeur | Demande classée indésirable en silence, sans que personne ne la relise. | Corrigé | DEM-031, TDB-010 |
| A1.8 | Majeur | « Enregistrer » une simulation sans compte : le résultat n'était gardé nulle part. | Corrigé | SIM-032, MOD-371 |
| A1.9 | Majeur | « Recevoir par e-mail » créait une fiche prospect sans que la mention le dise. | Corrigé | SIM-032, SEC-091 |
| A1.10 | Majeur | Éligibilité : « Bonne nouvelle » avec un budget nul ; revenu nul expliqué par un mauvais motif. | Corrigé | CAL-100 à CAL-102 |
| A1.11 | Majeur | Devises des simulateurs indéfinies ; budget réemployé comme prix maximal sans conversion. | Corrigé | SIM-003, CAL-104 |
| A1.12 | Majeur | Financement islamique fermé : la carte de l'accueil menait à une ancre absente. | Corrigé | ACC-090 |
| A1.13 | Majeur | La confirmation d'une demande révélait si un compte existait. | Corrigé | DEM-021, DEM-023 |
| A1.14 | Majeur | Page d'attente et porte de recette : deux mécanismes, l'un interdit là où l'on en avait besoin. | Corrigé | NAV-064 |
| A1.15 | Mineur | Apport supérieur ou égal au prix : trois règles, trois réponses. | Corrigé | CAL-110, SIM-022 |
| A1.16 | Mineur | Intérêt pour un bien indisponible : statuts et messages contradictoires. | Corrigé | DEM-026, CYC-073 |
| A1.17 | Mineur | États vides et replis qui promettaient une fonction fermée (alertes, biens tous réservés). | Corrigé | CAT-060, CAT-064 |
| A1.18 | Mineur | Montants affichés : prix au m², arrondis, prix en euros d'un programme non définis. | Corrigé | CAL-024 |
| A1.19 | Mineur | Souhaits de rappel hors des heures ouvrées ou trop lointains. | Corrigé | DEM-008, NOT-053, ECL-021 |
| A1.20 | Mineur | Limite de débit à l'heure : « Réessayez dans un instant », sans autre voie. | Corrigé | DEM-032 |
| A1.21 | Mineur | Étiquette de rareté fausse pour une villa seule ou une petite typologie neuve. | Corrigé | CAT-041 |
| A1.22 | Mineur | Petits manques : fenêtre des cookies, image en échec, prix visé, liens de partage. | Corrigé | NAV-050, SIM-013, CAT-020, CAL-081 |

### De bout en bout, livraison par livraison

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| A2.1 | Bloquant | Les parcours des livraisons 3 et 4 avaient besoin du moteur d'automatisation, livré seulement à la 5. | Corrigé | AUT-083 |
| A2.2 | Bloquant | Inscription de la livraison 2 sans texte légal en vigueur ; matrice du contrat à corriger. | Corrigé | PAR-083 |
| A2.3 | Bloquant | Aucune adresse d'expéditeur avant la livraison 5 : aucun e-mail ne pouvait partir. | Corrigé | NOT-003 |
| A2.4 | Majeur | Démonstration de la livraison 1 impossible en recette (porte d'accès interdite hors production). | Corrigé | NAV-064 |
| A2.5 | Majeur | Démonstration de la livraison 1 contraire à la matrice des permissions. | Corrigé | ADM-030 ; plan, paquet 1.9 |
| A2.6 | Majeur | Entrées vers la messagerie visibles avant sa livraison. | Corrigé | MSG-021, ECL-006 |
| A2.7 | Majeur | L'e-mail écrit à la main, appelé dès la livraison 3, n'était livré qu'à la 5. | Corrigé | COM-020 ; plan, paquet 3.2 |
| A2.8 | Majeur | L'espace client montrait des onglets et des liens pas encore livrés. | Corrigé | PAR-082, ECL-006 |
| A2.9 | Majeur | Livraison 3 : impossible de mettre en pause, de clôturer ou de supprimer un dossier. | Corrigé | plan, § 3 |
| A2.10 | Majeur | Liste « Avant la mise en ligne » circulaire : l'indexation exigée par la liste qui l'interdisait. | Corrigé | D-085, ENV-054, PAR-100 |
| A2.11 | Majeur | Onglets d'un dossier et financement d'un programme rattachés à aucun paquet. | Corrigé | PIP-060 ; plan, paquets 3.7 et 5.3 |
| A2.12 | Majeur | Les démonstrations qui dépendent du temps n'avaient pas d'horloge réglable. | Corrigé | ENV-032 |
| A2.13 | Majeur | Programme entièrement vendu : la fiche disait « arrivent bientôt ». | Corrigé | CYC-127 |
| A2.14 | Majeur | Des demandes ouvertes survivaient à un dossier perdu ou à un compte effacé. | Corrigé | CYC-035, PRO-060 |
| A2.15 | Mineur | « Signaler une erreur » sans lecteur avant la livraison 5. | Corrigé | plan, § 4 |
| A2.16 | Mineur | Accusé de rappel : phrase cassée sans téléphone (doublon de A1.6). | Corrigé | NOT-060 |
| A2.17 | Mineur | Textes de Phase 1 qui pointaient vers des fonctions hors contrat. | Corrigé | ACC-090, EDI-011, EDI-041 |
| A2.18 | Mineur | Seuil de publication : la promesse « huit champs et un média » ne faisait pas le compte. | Corrigé | CAL-050 |
| A2.19 | Mineur | Changer de bien ou acheter sans financement : conditions floues. | Corrigé | CYC-072, CYC-024 |
| A2.20 | Mineur | Une seconde demande pendant un dossier restait invisible du client. | Corrigé | INT-001, ECL-031 |
| A2.21 | Mineur | Renvois faux dans le plan (règles, parcours, écrans). | Corrigé | BO-010, BO-013, BO-070 |
| A2.22 | Mineur | Suppression : une règle disait « jamais », une autre supprimait. | Corrigé | TRV-096, AUT-091 |
| A2.23 | Mineur | Éléments manquants : texte de la charte, saisie de la date de livraison d'un lot, notification d'un refus. | Corrigé | BO-003 |
| A2.24 | Mineur | Cinq écrans sans entrée de menu. | Corrigé | BNK-020, CMS-081, CMS-090 |

### L'argent

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| A3.1 | Bloquant | Un taux de change mal saisi ne pouvait pas être corrigé le jour même : tous les prix faux jusqu'au lendemain. | Corrigé | CAL-010, BNK-061, BNK-064 |
| A3.2 | Majeur | Le sens d'un cours l'emportait sur sa date ; changer de devise de référence n'était pas réglé. | Corrigé | CAL-010, AUT-080, PAR-003 |
| A3.3 | Majeur | La mensualité et le coût d'une offre de banque n'étaient pas calculables : conditions non enregistrées. | Corrigé | BNK-102, CAL-045, BNK-134 |
| A3.4 | Majeur | Apport nul : « Bonne nouvelle » avec un budget nul (doublon). | Corrigé | CAL-101, CAL-103, PAR-044 |
| A3.5 | Majeur | Sans produit public, tout le monde était « non éligible », sans raison. | Corrigé | CAL-101, CAL-103 |
| A3.6 | Majeur | Devise de l'éligibilité indéfinie (doublon de A1.11). | Corrigé | CAL-100, CAT-035 |
| A3.7 | Majeur | Plusieurs produits possibles : les chiffres affichés mélangeaient les produits. | Corrigé | CAL-101, CAL-102, SIM-012 |
| A3.8 | Majeur | Le financement de référence à 0 % pilotait les simulateurs : capacité doublée. | Corrigé | CAL-110, SIM-030, PAR-044 |
| A3.9 | Majeur | Le comparatif de l'accueil est un contenu libre que rien ne recalcule. | Corrigé | ACC-043, CMS-020 |
| A3.10 | Majeur | « 150,000 » lu comme 150 : séparateur de milliers pris pour une virgule. | Corrigé | TRV-026, CTL-100 |
| A3.11 | Majeur | Saisies sans borne et dépassements de capacité des champs de montant. | Corrigé | CAL-027, TRV-026 |
| A3.12 | Majeur | Le prix du projet vivait dans quatre champs non synchronisés. | Corrigé | MOD-313, PIP-025 |
| A3.13 | Majeur | Acompte sans devise, et sans suivi du remboursement quand la réservation tombe. | Corrigé | CYC-108 |
| A3.14 | Majeur | Impossible de saisir un barème par durée. | Corrigé | SIM-021, BNK-110 |
| A3.15 | Majeur | Deux emprunteurs, deux devises : revenus additionnés tels quels. | Corrigé | MOD-303, DEM-016 |
| A3.16 | Majeur | Simulation dans une devise, produit dans une autre : montants repris sans conversion. | Corrigé | CAL-100, CAL-110 |
| A3.17 | Majeur | Projection : « mensualité » non définie pour le client. | Corrigé | CAL-120 |
| A3.18 | Mineur | Arrondis de la mensualité, de l'échéancier et de l'assurance non fixés. | Corrigé | CAL-043, CAL-044, SFA-010 |
| A3.19 | Mineur | Aucune ligne « relecture juridique » avant la mise en ligne ; mention des mensualités incomplète. | Corrigé | TRV-022, TRV-023, PAR-100 |
| A3.20 | Mineur | Divers : devise commune aux commissions et aux honoraires, bornes, motifs. | Corrigé | CAL-104, ACC-040 |

### Le quotidien du conseiller

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| A4.1 | Majeur | Impossible d'enregistrer un prospect sans adresse e-mail. | Corrigé | MOD-302, CRM-025, NOT-025 |
| A4.2 | Majeur | Libérer, réaffecter, rouvrir une demande : hors du cycle de vie. | Corrigé | CYC-008, CYC-003 |
| A4.3 | Majeur | Recul d'étape : règles contradictoires selon les soumissions en cours. | Corrigé | CYC-037 |
| A4.4 | Majeur | Ce qui se passe pendant une pause n'était pas défini (accord de banque, avancées, délais). | Corrigé | CYC-034 |
| A4.5 | Majeur | Rouvrir un dossier restaurait une étape dont les conditions n'existent plus. | Corrigé | CYC-035, CYC-036, MOD-355 |
| A4.6 | Majeur | « Premier contact » défini de trois façons. | Corrigé | CYC-004 |
| A4.7 | Majeur | Affectation automatique : absences ignorées, pas d'état. | Corrigé | CRM-020, CRM-021, CYC-002 |
| A4.8 | Majeur | Pas de fuseau horaire pour un client sans compte. | Corrigé | TRV-031 (`Country.timezone`) |
| A4.9 | Majeur | Changement de conseiller : rendez-vous, demandes et référent oubliés. | Corrigé | CYC-040 |
| A4.10 | Majeur | Des gestes d'écran sans permission définie. | Corrigé | ROL-018, API-100 |
| A4.11 | Majeur | Périmètre « mes dossiers » limité à trois objets. | Corrigé | ROL-018, ROL-014 |
| A4.12 | Majeur | Écritures de fond : conflits de version pour le conseiller qui enregistre. | Corrigé | MOD-007 |
| A4.13 | Majeur | Passer « sans financement » après l'étude bancaire : aucun chemin. | Corrigé | CYC-041, CYC-161 |
| A4.14 | Majeur | « Ne pas contacter » : cas limites non réglés. | Corrigé | CYC-009, CRM-060 |
| A4.15 | Majeur | Statuts d'un bien proposé : transitions manquantes au diagramme. | Corrigé | CYC-070 |
| A4.16 | Majeur | Indicateurs impossibles à calculer (vues sur une période, durée par étape). | Corrigé | TDB-014, TDB-012 |
| A4.17 | Majeur | Fusion de deux fiches : objets oubliés, choix perdus. | Corrigé | CRM-080 |
| A4.18 | Mineur | Valeurs et gestes employés mais jamais définis. | Corrigé | `01-domaine/04` (champs ajoutés au modèle) |
| A4.19 | Mineur | E-mails de rendez-vous envoyés malgré « ne pas informer le client ». | Corrigé | CYC-080, AUT-051, INT-041 |
| A4.20 | Mineur | Premières livraisons : pas de page d'accueil du back-office, e-mail manuel absent. | Corrigé | BO-011 ; plan, § 4 |

### Le compte et l'espace du client

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| A5.1 | Bloquant | Biens proposés : le cycle de vie contredisait les écrans (visites, sélection). | Corrigé | CYC-070, CYC-002 |
| A5.2 | Majeur | Liens d'activation : chaque nouvel e-mail tuait le lien du précédent. | Corrigé | AUTH-040, MOD-105 |
| A5.3 | Majeur | L'accord de transmission bloquait le dossier sans que le client le sache. | Corrigé | ECL-011, DOS-040 |
| A5.4 | Majeur | Livraisons 2 à 4 : boutons et liens vers des fonctions pas encore livrées. | Corrigé | ECL-006 |
| A5.5 | Majeur | Le lien de vérification validait un mot de passe que son destinataire n'avait pas choisi. | Corrigé | AUTH-013, AUTH-041 |
| A5.6 | Majeur | L'ancienne adresse restait un alias après un changement d'e-mail. | Corrigé | AUTH-080 |
| A5.7 | Majeur | Table des cas d'inscription incomplète : adresse non vérifiée, compte suspendu, alias. | Corrigé | AUTH-003, AUTH-040 |
| A5.8 | Majeur | Comptes sans mot de passe bloqués pour les actions sensibles. | Corrigé | AUTH-086 |
| A5.9 | Majeur | Tableau de bord non défini sans dossier ouvert. | Corrigé | ECL-014, ECL-021 |
| A5.10 | Majeur | Suppression demandée avec un dossier avancé : des semaines de flou. | Corrigé | PRO-060, AUT-045 |
| A5.11 | Majeur | Une adresse rejetée pouvait enfermer le client dehors (plus d'e-mail de réinitialisation). | Corrigé | NOT-014, AUT-071 |
| A5.12 | Majeur | Un message sur un dossier clôturé pouvait n'atteindre personne. | Corrigé | AUT-007, MSG-018 |
| A5.13 | Majeur | Parcours de rendez-vous de Phase 1 qui finissaient dans une fonction hors contrat. | Corrigé | INT-041, INT-044 |
| A5.14 | Majeur | Dossier rouvert après la purge des fichiers : pièces « validées » sans fichier. | Corrigé | CYC-149, CYC-036 |
| A5.15 | Mineur | Notifications manquantes : choix refusé, dossier rouvert, liste modifiée. | Corrigé | PIP-030, ECL-031 |
| A5.16 | Mineur | « Mon avis » introuvable : écran dans aucun menu. | Corrigé | ECL-001 |
| A5.17 | Mineur | Petits manques d'affichage : souhait d'accepter l'offre, cartes « À faire ». | Corrigé | DOS-052 |
| A5.18 | Mineur | Acheteur sans financement : la préférence « sans financement » ne réglait pas le dossier. | Corrigé | CYC-041, DOS-040 |
| A5.19 | Mineur | Emprunteurs : pas d'entrée d'écran, pas de retrait, accord non enregistré. | Corrigé | DOS-030 à DOS-032 |
| A5.20 | Mineur | Sessions : « tous les appareils » ou « les autres », durée après un lien. | Corrigé | AUTH-033, AUT-091 |
| A5.21 | Mineur | Client sans compte : rendez-vous à l'heure de Paris malgré un fuseau connu. | Corrigé | TRV-031 |

### Les pièces et les banques

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| A6.1 | Bloquant | Le lien du dossier bancaire et son code étaient lisibles dans le journal des e-mails. | Corrigé | NOT-002, COM-041 |
| A6.2 | Majeur | Mauvaises pièces précochées pour une banque (emprunteur retiré, offre d'une autre banque). | Corrigé | BNK-103 |
| A6.3 | Majeur | Gagner ou rouvrir un dossier cassait les conditions d'étape (réservation annulée). | Corrigé | CYC-027, CYC-036 |
| A6.4 | Majeur | Une décision de banque saisie par erreur ne se corrigeait pas ; une offre ne se prolongeait pas. | Corrigé | CYC-165, CYC-169 |
| A6.5 | Majeur | Dossier « complet » sans justificatif de revenus quand la situation est inconnue. | Corrigé | GED-020, CAL-055 |
| A6.6 | Majeur | Les versions d'une pièce n'avaient pas de modèle de données. | Corrigé | MOD-352, CYC-149 |
| A6.7 | Majeur | Fichiers reçus par message : seul le dernier devenait la version en cours. | Corrigé | GED-050 |
| A6.8 | Majeur | Pages photographiées : trop de fichiers, et la banque recevait des images. | Corrigé | MED-032 |
| A6.9 | Majeur | Client relancé pour les pièces d'une soumission terminée. | Corrigé | CYC-170 |
| A6.10 | Majeur | Pièces qui expirent pendant l'étude de la banque : rafale d'e-mails. | Corrigé | CYC-141, CYC-145 |
| A6.11 | Majeur | La suppression du compte laissait le dossier tourner (doublon de A5.10). | Corrigé | PRO-060, CYC-200 |
| A6.12 | Majeur | Des fichiers « deviennent des pièces » sans règle (contrat, acompte, offre). | Corrigé | GED-037, CYC-140 |
| A6.13 | Majeur | Accord de transmission vérifié au premier envoi seulement. | Corrigé | CYC-161, GED-071 |
| A6.14 | Mineur | Droits ambigus sur les pièces et les soumissions. | Corrigé | ROL-018 |
| A6.15 | Mineur | Boucle du complément : pas de seconde demande, pièces dispensées bloquantes. | Corrigé | CYC-163, BNK-120 |
| A6.16 | Mineur | Quelle liste de pièces de banque s'applique : ordre non dit. | Corrigé | MOD-361, GED-031 |
| A6.17 | Mineur | Type de financement du dossier comparé à une préférence qui n'a pas les mêmes valeurs. | Corrigé | CYC-041, GED-031 |
| A6.18 | Mineur | Compteurs « à fournir » : une pièce facultative masquait « dossier complet ». | Corrigé | CYC-143, AUT-042 |
| A6.19 | Mineur | Page de la banque : messages de code et de verrou non définis. | Corrigé | BNK-112, BNK-113 |
| A6.20 | Mineur | Effets sans destinataire : fichier infecté, accord retiré, liste réévaluée. | Corrigé | CYC-140, NOT-030 |
| A6.21 | Mineur | Champs manquants : ordre des fichiers, souhait d'acceptation, pause des relances. | Corrigé | `01-domaine/04` (champs ajoutés au modèle) |
| A6.22 | Mineur | Après la clôture ou en pause : dépôt impossible, soumission acceptée jamais figée. | Corrigé | SEC-111, MOD-355 |

### Rôles, sécurité, vie privée, fiabilité

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| A7.1 | Bloquant | Liens de connexion et d'invitation lisibles dans le journal des e-mails. | Corrigé | NOT-002 |
| A7.2 | Majeur | Le rôle Lecture seule lisait par d'autres écrans ce que ses permissions lui cachent. | Corrigé | SEC-033, NOT-017 |
| A7.3 | Majeur | Gestes réservés à la Direction placés sous des permissions que d'autres ont. | Corrigé | API-100, ADM-015, BO-055 |
| A7.4 | Majeur | « Voir comme le client » sans mécanisme : aucune session ne le permettait. | Corrigé | ROL-017 |
| A7.5 | Majeur | La porte d'avant ouverture fermait les pages, pas l'API ni les e-mails. | Corrigé | NAV-064 |
| A7.6 | Majeur | Renouvellement des sessions : deux onglets déconnectaient l'utilisateur. | Corrigé | SEC-021 |
| A7.7 | Majeur | États intermédiaires d'une connexion non définis. | Corrigé | AUTH-022, AUTH-026 |
| A7.8 | Majeur | Une durée de conservation mal saisie effaçait des données pour de bon. | Corrigé | PAR-006 |
| A7.9 | Majeur | Effacer un acquéreur : trois réponses différentes. | Corrigé | SEC-111, ADM-064 |
| A7.10 | Majeur | L'anonymisation laissait des copies dans d'autres tables. | Corrigé | SEC-111, QUA-026 |
| A7.11 | Majeur | Co-emprunteurs, garants, proches : accords enregistrés nulle part. | Corrigé | ADM-061 |
| A7.12 | Majeur | Export des données d'une personne sans compte : impossible à remettre. | Corrigé | ADM-063, ADM-085 |
| A7.13 | Majeur | Limitation du traitement : droit prévu, mais aucun geste pour l'appliquer. | Corrigé | ADM-063, AUT-007 |
| A7.14 | Majeur | Journal d'audit : « toute écriture » contre une liste fermée incomplète. | Corrigé | BO-084, SEC-080 |
| A7.15 | Majeur | Compte Direction unique verrouillé hors de la plateforme. | Corrigé | ADM-040, ADM-030 |
| A7.16 | Majeur | Le travail affecté à un compte suspendu devenait silencieux. | Corrigé | NOT-018, AUT-032 |
| A7.17 | Majeur | Masquage du rôle Support incomplet. | Corrigé | ROL-015, SEC-032 |
| A7.18 | Majeur | Unicités sur des colonnes vides : non tenues par la base. | Corrigé | MOD-019 |
| A7.19 | Mineur | Reprises, pannes, concurrence : règles contradictoires. | Corrigé | FIA-040, FIA-043 |
| A7.20 | Mineur | Conservation et corbeille : « jamais supprimé » et supprimé après cinq ans. | Corrigé | SEC-110, MOD-430 |
| A7.21 | Mineur | Paramètres d'authentification donnés deux fois, avec deux valeurs. | Corrigé | SEC-023, SEC-027, AUTH-033 |
| A7.22 | Mineur | Formulaires publics qui révèlent l'existence d'un compte. | Corrigé | AUTH-080, DEM-023 |
| A7.23 | Mineur | Jetons présents dans les adresses, donc dans les journaux. | Corrigé | SEC-040, MED-021 |
| A7.24 | Mineur | Paramètres : indexation circulaire, maintenance sans droit propre. | Corrigé | PAR-100, ADM-012 |
| A7.25 | Mineur | Identifiants non définis : codes d'erreur de champ, valeurs absentes. | Corrigé | PAR-081, TRV-064 |

### E-mails, notifications, automatisations

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| A8.1 | Bloquant | L'avis d'expiration d'une pièce demandait un geste que le client ne pouvait pas faire. | Corrigé | CYC-141, DOS-003 |
| A8.2 | Majeur | Pièces demandées par une banque : annoncées deux fois. | Corrigé | AUT-010, MOD-360 |
| A8.3 | Majeur | La pause coupait les rappels alors que les échéances couraient. | Corrigé | AUT-007, AUT-031 |
| A8.4 | Majeur | Compteurs de relance : rafale après une reprise ou une réouverture. | Corrigé | AUT-042, CYC-032 |
| A8.5 | Majeur | Un rejet d'e-mail n'était pas rattaché à l'adresse rejetée. | Corrigé | AUT-071, NOT-014 |
| A8.6 | Majeur | Trois biens proposés ensemble : trois relances et trois enquêtes. | Corrigé | AUT-010, AUT-043 |
| A8.7 | Majeur | Nouvelle demande : la même personne alertée deux ou trois fois. | Corrigé | NOT-035 |
| A8.8 | Majeur | Tâches automatiques : avalanche d'e-mails, ou silence. | Corrigé | AUT-032, AUT-070 |
| A8.9 | Majeur | Table d'arrêt des envois : comptes suspendus, effacés, « ne pas contacter ». | Corrigé | AUT-007, CYC-009 |
| A8.10 | Majeur | Avant la livraison 5 : pas de cloche, pas de réglage des notifications. | Corrigé | ECL-002, NOT-022, AUT-070 |
| A8.11 | Majeur | Règles créées par l'équipe et envois différés : consentement contourné. | Corrigé | NOT-042, COM-053 |
| A8.12 | Majeur | Événements dont personne n'était prévenu. | Corrigé | CYC-140, NOT-030 |
| A8.13 | Majeur | Unités de délai impossibles à enregistrer (« 3 jours ouvrés »). | Corrigé | AUT-004 |
| A8.14 | Majeur | « En attente de réponse » effacé par un message automatique. | Corrigé | AUT-020, MSG-012 |
| A8.15 | Majeur | La relance d'activation ne partait jamais. | Corrigé | AUT-045, CYC-201 |
| A8.16 | Majeur | Notifications de l'équipe employées mais absentes du catalogue. | Corrigé | NOT-030, NOT-041, PAR-080 |
| A8.17 | Majeur | E-mails à des non-clients sans rattachement. | Corrigé | COM-020 |
| A8.18 | Mineur | Points mineurs : fuseaux, reports, changement d'heure. | Corrigé | AUT-006, PAR-081 |

### Catalogue, lots, réservations

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| A9.1 | Bloquant | « Livraison dépassée » testée au premier jour de la période annoncée. | Corrigé | MOD-202, AUT-074 |
| A9.2 | Majeur | La fiche d'un programme comptait les lots de typologies non publiées. | Corrigé | CYC-127 |
| A9.3 | Majeur | Réimporter une grille de lots remettait « disponible » des lots réservés ou retirés. | Corrigé | CTL-100 à CTL-102 |
| A9.4 | Majeur | Un lot marqué « vendu » par erreur ne revenait pas. | Corrigé | CYC-100, CTL-062 |
| A9.5 | Majeur | Terminer un promoteur : deux règles contradictoires sur la dépublication. | Corrigé | CYC-240, CTL-004 |
| A9.6 | Majeur | Lot visé sans option puis pris par un collègue : le dossier n'en savait rien. | Corrigé | CYC-102, AUT-090 |
| A9.7 | Majeur | Modifier un programme pouvait casser en silence ses biens publiés. | Corrigé | CYC-122, MOD-236, CTL-083 |
| A9.8 | Majeur | Ville exigée pour publier, facultative partout ailleurs. | Corrigé | CYC-120, CAL-050 |
| A9.9 | Majeur | Bien isolé : son lot unique sans référence ni surface. | Corrigé | MOD-212, CTL-063 |
| A9.10 | Majeur | Compter les vues était infaisable : pages en cache, aucune route. | Corrigé | FIC-100 |
| A9.11 | Majeur | Onglet Financement, droits et traces du catalogue dans aucun paquet. | Corrigé | CTL-130 ; plan, paquets 3.5 et 4.5 |
| A9.12 | Majeur | « Hors ligne » confondu avec « indisponible ». | Corrigé | CYC-121, CYC-161 |
| A9.13 | Mineur | Transitions de publication et étiquettes liées à la date. | Corrigé | CYC-121, CYC-123 |
| A9.14 | Mineur | Médias : règles de contrôle contradictoires. | Corrigé | MED-021, SEC-075 |
| A9.15 | Mineur | Image de couverture : deux sources. | Corrigé | MOD-203, CTL-044 |
| A9.16 | Mineur | Droits, traces et épinglage du catalogue incomplets. | Corrigé | SEC-080, CTL-161 |
| A9.17 | Mineur | Petites incohérences : régions listées, compteurs, caches. | Corrigé | CAT-021, ACC-055 |

### Recoupements mécaniques

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| M1 | Mineur | Le README annonçait 143 écrans ; l'inventaire en compte 130. L'outil de contrôle « créait » les écrans enjambés par une plage. | Corrigé | QUA-025 ; `_outils/verifier_specs.py` |
| M2 | Majeur | Table des tons des pastilles incomplète : des statuts sans couleur, d'autres cités deux fois. | Corrigé | DSN-015 |
| M3 | Mineur | Exemples de blocs de contenu avec des clés absentes de la liste des blocs. | Corrigé | CMS-020 |
| M4 | Mineur | Objet du formulaire de contact et créneaux de rappel : listes de valeurs non rattachées aux énumérations. | Corrigé | DEM-015 (`ContactSubject`) |
| M5 | Mineur | Clés de traduction du financement nommées comme des clés de paramètres. | Corrigé | CAL-047 |
| M6 | Mineur | Paramètres définis mais lus par aucune règle. | Corrigé | `01-domaine/10`, § 1 (chaque paramètre cite sa règle) |
| M7 | Mineur | Permissions de lecture jamais citées par les écrans qui en dépendent. | Corrigé | ROL-023 |
| M8 | Mineur | Écrans de l'inventaire cités par aucun module ni aucun paquet du plan. | Corrigé | NAV-064, TRV-084, NOT-004 |
| M9 | Mineur | Flux temps réel : liste d'événements propre, sans lien dit avec le catalogue des événements. | Corrigé | API-070 |
| M10 | Mineur | Un même fait porte deux noms : action du journal d'audit et événement du domaine. | Corrigé | SEC-080 |
| M11 | Mineur | Dix-sept petites listes fermées définies au fil des champs, absentes du catalogue des énumérations. | Corrigé | MOD-018 |

### Vérification chiffrée

| # | Gravité | Constat | Suite | Réglé par |
|---|---|---|---|---|
| S1 | Majeur | Exemple de contrôle de la mensualité faux d'un centime. | Corrigé | CAL-040 |
| S2 | Majeur | Exemple chiffré de l'éligibilité incohérent (capacité, mensualité, budget). | Corrigé | CAL-104 |
| S3 | Majeur | Éligibilité sans apport : « Bonne nouvelle » avec un budget nul. | Corrigé | CAL-101 à CAL-103, PAR-044 |
| S4 | Majeur | Frais d'acquisition absents : le budget annoncé ignorait notaire et droits. | Corrigé | CAL-106, CAL-120, BNK-080 |
| S5 | Mineur | Montants : 13 chiffres admis à la saisie, 12 en base ; bornes de prix incohérentes. | Corrigé | TRV-026, CAL-027 |
| S6 | Mineur | Chiffres d'un résultat d'éligibilité tirés de produits différents. | Corrigé | CAL-101, CAL-102 |
