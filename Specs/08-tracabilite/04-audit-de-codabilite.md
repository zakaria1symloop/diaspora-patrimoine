# Audit de codabilité — version 1.3

Le premier audit (version 1.2, `03-audit-et-corrections.md`) a vérifié que le produit tenait debout : parcours, argent, expérience. Celui-ci pose une autre question : **un agent de développement peut-il coder la Phase 1 à partir de ce dossier seul, sans rien deviner ?** Il trace ce qui a été trouvé, corrigé, simplifié et vérifié.

Demande de SYMLOOP du 5 octobre 2026 : « faire un audit des specs, zéro défaut ; je veux laisser Opus coder dessus : des specs détaillées, sans trou, sans erreur, sans rien de caché ». Le 7 octobre, SYMLOOP a précisé le cadre : trois phases — la première avec le client et le back-office seulement, l'équipe faisant tout pour les promoteurs et les banques ; la deuxième avec le portail des promoteurs ; la troisième avec les banques — une Phase 1 simple, et un client parfaitement à l'aise.

---

## 1. Méthode

1. **Recoupements mécaniques** (deux scripts, en plus de l'outil de contrôle) : écrans livrés par un paquet, listes « À lire » qui renvoient à des sections et des règles existantes, parcours de recette, cellules vides des tables du modèle et des paramètres, énumérations sans libellé, permissions sans route, variables d'e-mail non déclarées, événements sans émetteur.
2. **Douze lectures « à blanc »**, une par groupe de paquets du plan (`02-plan-de-realisation.md`, § 3) : chaque lecteur jouait l'agent de développement à qui l'on dit « Réalise le paquet 3.2 », lisait ce que le paquet demande, et notait chaque point où il aurait dû décider seul. Une treizième lecture a parcouru tout le chemin du client, à sa place — membre de la diaspora, premier achat, inquiet pour son argent et ses documents —, et une quatorzième a relu le dossier d'un bout à l'autre pour sa cohérence et pour la simplicité de la Phase 1.
3. **Chaque constat vérifié avant correction**, puis corrigé dans les specs par un rédacteur qui n'était pas son lecteur, avec une résolution relue contre le texte du moment. Les corrections ont été appliquées une à une ; l'outil de contrôle est resté vert à chaque étape.
4. **Une simplification de la Phase 1**, décidée par SYMLOOP sur un tableau de dix-neuf mécanismes (D-086, § 4).
5. **Une vérification de clôture** par sept lecteurs neufs : chaque constat relu contre le texte corrigé, et chaque paquet rejoué pour chercher ce que les corrections avaient pu casser. Ce qu'ils ont trouvé a été corrigé à son tour.

Gravité : **bloquant** — le paquet ne se code pas sans inventer un comportement qui touche l'argent, les données personnelles, la sécurité ou un parcours visible ; **majeur** — un comportement indéfini ou contradictoire, dont un défaut prudent est évident ; **mineur** — une précision.

## 2. Les constats, en chiffres

| Lecture | Paquets | Bloquants | Majeurs | Mineurs | Total |
|---|---|---|---|---|---|
| Recoupements mécaniques | tous | 0 | 3 | 2 | 5 |
| Dépôt, socle de l'API, moteur, fichiers | 1.1, 1.4, 1.5 | 1 | 22 | 16 | 39 |
| Modèle de données, contrats, calculs | 1.2, 1.3 | 0 | 5 | 16 | 21 |
| Identité, e-mails, données de départ, livraison 1 | 1.6 à 1.9 | 1 | 17 | 24 | 42 |
| Site public | 2.1 à 2.7 | 2 | 6 | 22 | 30 |
| Espace client et compte | 2.8 à 2.11 | 2 | 11 | 12 | 25 |
| Socle du back-office, demandes, clients, tâches | 3.1 à 3.3, 3.8 | 1 | 15 | 14 | 30 |
| Promoteurs, catalogue, import, dossier | 3.4 à 3.7 | 0 | 11 | 14 | 25 |
| Pièces, machine à états, pipeline | 4.1 à 4.3 | 1 | 27 | 16 | 44 |
| Réservation, banques, soumissions, décisions | 4.4 à 4.7 | 1 | 21 | 15 | 37 |
| Communication et notifications | 5.1 à 5.6 | 1 | 24 | 12 | 37 |
| Pilotage, satisfaction, contenus, administration, données | 6.1 à 6.8 | 1 | 35 | 14 | 50 |
| Cohérence d'ensemble | — | 1 | 9 | 10 | 20 |
| Le confort du client | parcours | 1 | 9 | 11 | 21 |
| **Total** | | **13** | **215** | **198** | **426** |

Aucun exemple chiffré n'était faux : tous ceux de `01-domaine/07` ont été refaits et tombent juste.

## 3. Ce qui manquait, et ce qui est écrit maintenant

- **Les contrats que le code échange.** Ce que rend chaque route publique sensible (la réponse d'une demande ne révèle jamais qu'une autre existe, DEM-027) ; la forme unique d'une erreur et ses `params` (API-020) ; la liste fermée des conditions manquantes d'une transition (API-102) et l'erreur de chaque index unique (FIA-002) ; la permission de chaque route (API-101) ; les paramètres exposés au site (PAR-101) ; les champs sensibles retirés et nommés dans `withheld` (API-002).
- **Les mécanismes du socle.** La clé d'idempotence, son format et son appelant (API-040) ; la boîte d'envoi, ses réservations et ses mises de côté ; la table de résolution des objets et des destinataires du moteur (AUT-020) ; l'horloge de recette partagée par toutes les instances (ENV-032) ; le dépôt de fichiers en trois temps, sa table `Upload` et ses codes d'échec (API-080) ; la version d'une pièce construite à partir de plusieurs dépôts (API-081) ; le rendu des e-mails au moment de l'envoi, sans jeton conservé en clair (NOT-010, NOT-012) ; le format du corps d'un modèle d'e-mail (NOT-061).
- **Le modèle.** Les types de chaque ligne, les exceptions à la suppression logique, les clés étrangères qui bloquaient une purge, les versions des modèles de listes de pièces (MOD-342), le fil de suivi du client stocké (`ClientTimelineEntry`), les libellés de chaque énumération affichée.
- **Ce que l'agent ne pouvait pas inventer.** Un cadre d'exploitation par défaut tant que l'hébergeur n'est pas choisi (Q-017), un fournisseur d'e-mail par défaut (Q-030), les prérequis à remettre avant le paquet 1.1 (plan, § 6), le premier compte Direction, des textes légaux provisoires (`01-domaine/10`, § 11), le repli des communes et du logo tant que leurs fichiers manquent, ce qu'est une livraison « close » pour l'agent (QUA-074).
- **Les écrans.** Les variantes et les états manquants, les textes des écrans de compte, la page de téléchargement d'une banque et son déverrouillage, l'export des données d'une personne (PRO-075), le tableau de bord et son jeu de contrôle chiffré (TDB-061, TDB-062).

## 4. La Phase 1 simplifiée (D-086)

Dix-neuf mécanismes ont été examinés : coûteux à construire, ils ne sont pas nécessaires tant que l'équipe fait tout à la main. SYMLOOP a retenu toutes les recommandations. **Le modèle de données ne change pas** : tout peut revenir sans migration.

- **Simplifiés** : le moteur des automatisations (les règles d'origine, conditions écrites dans le code, réglages modifiables à l'écran) ; la recherche globale (une référence exacte, ou les clients) ; le résumé du matin (trois rubriques) ; le temps réel (rafraîchissement en 30 secondes) ; l'option posée sur un lot (« Confirmée par » obligatoire) ; l'annulation d'une décision de banque (avant sa publication seulement) ; les droits sur les données (avec la question Q-050 au conseil juridique) ; l'import de lots (colonnes fixes, contrôle à blanc gardé) ; les rapports (tableau de bord et trois rapports) ; le rôle Support (diagnostic et journal technique) ; les devises des simulateurs (euro et dinar).
- **Différés** `[V2]` ou aux accès des partenaires : vues enregistrées, envoi groupé, défi anti-robots, périmètre restreint des conseillers, « Voir comme le client », application d'une nouvelle version de liste de pièces, bloc « Ce que nous attendons de lui / d'elle ».
- **Gardés** : l'interlocuteur noté à chaque réponse d'un partenaire, les vérifications périodiques du stock et des barèmes, le mécanisme de conversion des devises.
- **Jamais simplifiés** — le confort du client : une demande qui ne se perd jamais, savoir à tout moment où l'on en est et ce qui vient, les pièces depuis le téléphone, des chiffres honnêtes, être prévenu à chaque étape clé, un compte sans friction.

Chaque ligne du contrat reste tenue par une règle `[P1]` (`01-matrice-contrat-specs.md`).

## 5. Le confort du client

La lecture faite à la place du client a ajouté, sans fonction nouvelle :
- quand le délai de premier contact est dépassé, le client n'attend plus en silence : son espace le dit, et un e-mail d'excuse lui donne un moyen de joindre l'équipe (ECL-035, `C_LEAD_DELAYED`) ;
- une seule promesse de délai partout, celle qu'il a choisie (NOT-053), y compris sous le bouton d'envoi ;
- un moyen de joindre quelqu'un depuis chaque écran de connexion où l'on peut rester bloqué (AUTH-098) ;
- la date de réponse attendue d'une banque, et ce que fait l'équipe au-delà ;
- l'acompte annoncé avant d'être demandé : à qui, comment, ce qu'il devient (`C_OPTION_PLACED`, questions fréquentes) ;
- une clôture qui ne fait plus peur (« vos documents restent accessibles »), une pause qui dit ce qu'on attend de lui, des mots simples sous chaque étape de son projet.

## 6. Vérification de clôture

Sept lecteurs neufs ont relu les 445 points (426 constats et 19 simplifications) contre le texte corrigé : 396 réglés, 35 réglés en partie, 1 non réglé, 13 différés à juste titre par la simplification. Ils ont aussi rejoué les paquets pour chercher ce que les corrections avaient pu casser : 80 points nouveaux, dont aucun bloquant (18 majeurs, 62 mineurs) — le plus souvent deux rédacteurs qui avaient réglé le même manque de deux façons, ou une règle `[P1]` qui citait encore un mécanisme différé. Tout a été corrigé, et ces corrections ont été relues à leur tour par deux lecteurs : 112 confirmées, 3 à compléter, et 15 derniers points, dont un majeur — tous corrigés. L'outil de contrôle finit par « Tout est cohérent. ».

Comme pour la version 1.2, rien ne garantit qu'il ne reste aucun défaut. Pour ce cas, l'agent a sa consigne (README, § 5, règle 2) : une situation non décrite devient une question `Q-nnn`, avec une valeur par défaut prudente, signalée dans son compte rendu.

## 7. Ce qui reste à fournir

Rien de ce qui suit ne bloque l'écriture du code ; chaque point a sa valeur par défaut.

| Quoi | Qui | Avant | Où |
|---|---|---|---|
| Hébergeur et région, noms d'hôte, accès remis à l'agent (variables d'ENV-040) | SYMLOOP | Paquet 1.1 | Plan, § 6 ; Q-017 |
| Fournisseur d'e-mail (Brevo par défaut) | SYMLOOP | Paquet 1.7 | Q-030 |
| Logo et icônes exportés de Figma (`Design/assets/`) | SYMLOOP | Paquet 1.8 | Plan, § 6 ; DSN-003 |
| Fichier des communes d'Algérie | SYMLOOP | Paquet 1.8 (repli : une commune chef-lieu par wilaya) | PAR-022 ; Q-043 |
| Textes légaux définitifs | Diaspora Patrimoine (conseil juridique) | Ouverture au public | PAR-083 ; § 11 de `01-domaine/10` |
| Version réduite des droits sur les données | Conseil juridique | Paquet 6.5 | Q-050 |
| Formation de l'équipe | Diaspora Patrimoine | Livraison 5 | Q-049 |
