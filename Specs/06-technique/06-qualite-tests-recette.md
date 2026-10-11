# Qualité, tests, recette

Comment on sait qu'une règle des specs est **réellement** en place, et comment la cliente valide chaque livraison (contrat, article 7 : sept jours ouvrés par lot). La Phase 1 se livre en cinq fois, chaque livraison étant un produit qui fonctionne (D-006, QUA-074).

---

## 1. Terminé veut dire

**QUA-001** `[P1]` Une fonction est **terminée** quand :
1. chaque règle qu'elle réalise a au moins un test qui porte son identifiant (README, § 5, règle 4) ;
2. ses cinq états d'écran existent (TRV-080) et ses messages viennent des fichiers de traduction ;
3. elle passe au clavier et au lecteur d'écran (TRV-121), avec les animations réduites (DSN-074) et, sur le site et dans l'espace client, au niveau de texte « Très grande » (TRV-123) ; ses erreurs suivent TRV-113 et TRV-114 ;
4. elle est correcte à 390 px et à 1 440 px (site et espace client), à 1 280 px (back-office) ;
5. ses droits sont vérifiés côté serveur et testés (QUA-021) ;
6. ses actions sensibles sont tracées (SEC-080) ;
7. toute situation non prévue par les specs a donné lieu à une question `Q-nnn` (README, § 5, règle 2) ;
8. les specs sont à jour si une décision a changé.

## 2. Tests automatisés

**QUA-010** `[P1]` **Trois niveaux.**

| Niveau | Porte sur | Outils | Exigence |
|---|---|---|---|
| Unitaire | `packages/domain` : calculs, calendrier, complétude, gardes des transitions, libellés | Vitest (ARC-002) | Les exemples chiffrés de `01-domaine/07` sont des tests. Couverture : 95 % des lignes de `domain`. |
| Intégration | Chaque cas d'usage de l'API, contre une **vraie** base PostgreSQL et un vrai Redis, démarrés pour le test | Vitest, conteneurs de test — en local, la base embarquée d'ENV-041, chaque scénario dans une transaction annulée à la fin, et le test sauté si la base ne répond pas (D-097) | Couverture : 80 % des cas d'usage. Aucune base simulée : les contraintes de FIA-002 doivent jouer. |
| Bout en bout | Les parcours de QUA-030, dans un navigateur | Playwright | Avant chaque livraison : ses parcours et ceux des livraisons précédentes, tous verts (QUA-074). |

**QUA-020** `[P1]` **Cycles de vie.** Pour chaque objet à statut : un test par transition **permise** (gardes remplies → effets constatés), un test par garde (garde non remplie → refus et raison), et un test qui vérifie que **toute autre** transition est refusée. Le tableau des transitions du code (ARC-012) et celui de `01-domaine/06` sont comparés par un test. Chaque **geste de partenaire** (ACP-020, ACP-021) est testé comme une commande : gardes, effets, auteur — sans passer par un écran (ARC-014). Les voies « lien » et « portail » se testent quand elles existent.

**QUA-021** `[P1]` **Permissions.** Un test généré parcourt toutes les routes du back-office et, pour chaque rôle, vérifie l'accès ou le refus attendu d'après la matrice de `00-cadre/02`. S'y ajoutent : un client ne lit jamais les données d'un autre (toutes les routes `/client`) ; un conseiller en périmètre restreint ne voit ni le dossier d'un collègue, ni ses pièces, ses soumissions, ses échanges (ROL-018) ; le rôle Support ne reçoit aucun champ masqué ni aucun texte libre (SEC-032) ; le rôle Lecture seule ne reçoit aucun champ sensible, sur aucune entité, et sa chronologie ne contient aucun message (SEC-033, ROL-019) ; une session d'aperçu ne peut rien écrire et ne marque rien comme lu (ROL-017) ; chaque permission de la matrice est citée par au moins une route, hors la table d'exceptions d'API-101, et chaque route par une permission (API-100).

**QUA-022** `[P1]` **Concurrence.** Les situations de FIA-121, rejouées avec de vraies requêtes simultanées : un seul gagnant, un refus propre pour l'autre, aucune donnée incohérente.

**QUA-023** `[P1]` **Automatisations.** Pour chaque règle livrée d'origine (`01-domaine/08`, § 5 à § 7) : déclenchement, respect du délai et de son unité (avec une horloge de test), nouvelle vérification des conditions à l'exécution, absence de doublon quand l'événement est rejoué, conditions d'arrêt (AUT-007) — dont : un rappel d'échéance part malgré une pause, une relance de pièces non. Pour chaque geste qui émet plusieurs événements : une seule notification par destinataire (NOT-035).

**QUA-024** `[P1]` **E-mails.** Chaque modèle d'origine est rendu avec des données d'exemple — et avec chaque variante que le modèle prévoit (demande sur un programme sans bien, société sans téléphone, client qui a déjà un espace) : aucun champ dynamique non remplacé, aucune phrase tronquée, lien présent, version texte produite. Un test vérifie que chaque code cité dans les specs existe dans les données de départ. Un test vérifie, pour chaque modèle qui porte un lien à jeton ou un code, que la ligne conservée ne contient ni l'un ni l'autre (NOT-002) ; de même pour l'extrait d'un message (NOT-017).

**QUA-025** `[P1]` **Références croisées.** Un script vérifie que chaque identifiant de règle cité dans un test ou un message de commit existe dans `Specs/`, et que chaque lien entre fichiers des specs aboutit.

Les specs elles-mêmes sont contrôlées par `Specs/_outils/verifier_specs.py`, en douze points : (1) chaque règle citée est définie, une seule fois ; (2) chaque décision et chaque question citée est au registre ; (3) chaque modèle d'e-mail cité est au catalogue, avec son texte d'origine ; (4) chaque règle d'automatisation et chaque type de notification cité est défini, et le déclencheur de chaque règle est un événement du catalogue ; (5) chaque écran cité est à l'inventaire, a sa page Figma et sa place dans l'ordre de maquettage ; (6) chaque renvoi vers un fichier aboutit ; (7) chaque champ cité existe au modèle ; (8) chaque code à points cité — permission, paramètre, événement, champ de condition, tâche planifiée, champ dynamique, action du journal d'audit, bloc de contenu, texte d'interface, jeton de design — est défini dans son registre ; (9) chaque valeur d'énumération citée existe, et chaque statut a son ton (DSN-015) ; (10) chaque parcours de recette et chaque indicateur cité est défini, et chaque parcours de Phase 1 est rattaché à un paquet du plan ; (11) chaque code d'erreur cité avec son statut est celui de TRV-110 ; (12) les chiffres du README sont ceux du dossier. Le contrôle tourne dans la chaîne d'intégration du dépôt des specs ; une modification des specs n'est pas fusionnée tant qu'il n'est pas vert.

**QUA-026** `[P1]` **Données personnelles.** Un test efface une fiche de chacun des trois cas de SEC-111 — contact, dossier clôturé, acquéreur —, puis parcourt **tous** les champs de texte et de coordonnées rattachés à cette personne : aucun ne garde sa valeur, sauf ceux que SEC-111 conserve. La liste des champs est tirée du schéma, pas écrite à la main : un champ ajouté plus tard est couvert d'office. Un second test prépare l'export d'un client (PRO-050) et vérifie que l'archive contient tout ce que PRO-075 y fait entrer, et rien de ce qu'elle exclut.

## 3. Intégration continue

**QUA-040** `[P1]` À chaque proposition de modification, dans cet ordre ; un échec arrête tout :

| Étape | Contrôle |
|---|---|
| Forme | Mise en forme, règles de style, types stricts. |
| Textes | Aucune clé de traduction manquante ou inutilisée (ARC-043) ; aucun texte visible en dur. |
| Specs | `python Specs/_outils/verifier_specs.py` finit par « Tout est cohérent. » (QUA-025). |
| Tests | Unitaires, intégration. |
| Schéma | Les migrations s'appliquent sur une base vide **et** sur la base de la version précédente. |
| Contrat | La description OpenAPI ne casse pas la version en cours (API-090). |
| Dépendances | Aucune faille connue de niveau élevé ou critique (SEC-087). |
| Construction | Les applications se construisent. |
| Bout en bout | Parcours critiques, sur l'environnement éphémère de la proposition. |
| Accessibilité | Contrôle automatique des pages clés (accueil, catalogue, fiche, formulaire d'intérêt, connexion, pièces). |
| Performance | Budgets de TRV-132 sur l'accueil, le catalogue et une fiche. |

**QUA-041** `[P1]` **Messages de commit et propositions.** Chaque commit cite les règles réalisées (« CYC-142, GED-041 : validation d'une pièce »). Chaque proposition liste : les règles couvertes, les questions `Q-nnn` ajoutées, les fichiers des specs modifiés.

## 4. Parcours de bout en bout

**QUA-030** `[P1]` Les parcours ci-dessous sont à la fois les tests automatisés de bout en bout et la trame du **cahier de recette**. « Livraison » : celle où le parcours devient jouable en entier (`08-tracabilite/02`, § 1 : L1 = Lot 1, L2 = Lot 2, L3 = Lot 3, L4 = Lot 4, L5 = Lots 5 et 6). Quand une partie du parcours se joue plus tôt, elle est indiquée entre parenthèses et fait partie de la recette de cette livraison-là.

| # | Parcours | Livraison |
|---|---|---|
| P01 | Un visiteur cherche un bien par ville et par budget, filtre, trie, ouvre une fiche, parcourt la galerie. | L2 |
| P02 | Il envoie une demande d'intérêt **sans compte** ; il voit la confirmation, reçoit l'accusé ; la demande apparaît dans le back-office avec son échéance. | L2 (prise en charge : L3) |
| P03 | Il envoie la même demande deux fois (double clic, puis de nouveau une heure après avec un téléphone corrigé) : une seule demande existe, le second envoi la complète, et l'écran affiche la confirmation ordinaire sans dire qu'une demande existait. | L2 |
| P04 | Il crée son espace, vérifie son adresse, se connecte ; sa demande y figure. | L2 |
| P05 | Il fait une simulation d'éligibilité, puis de crédit, compare deux scénarios, reçoit le PDF par e-mail, demande à être rappelé. | L2 |
| P06 | Mot de passe oublié ; connexion par lien ; verrou après cinq échecs ; changement d'adresse e-mail. | L2 |
| P07 | Un conseiller prend en charge une demande, note un appel, qualifie le client : le dossier passe à « Mise en relation ». | L3 |
| P08 | Il propose trois biens ; le client en écarte un avec une raison, s'intéresse à un autre, le retient ; le conseiller confirme. | L3 |
| P09 | L'administrateur crée un promoteur, un programme, une typologie, importe une grille de lots, ajoute des photos, publie ; le bien paraît sur le site en moins d'une minute. | L3 |
| P10 | Une fiche incomplète ne se publie pas ; la liste de ce qui manque est exacte ; une fois complétée, elle se publie. | L3 |
| P11 | Le conseiller pose une option sur un lot ; un collègue tente la même option sur le même lot et est refusé ; l'option expire et le lot redevient disponible. | L4 |
| P12 | Passage à « Dossier » : la liste de pièces est créée selon le profil ; le client reçoit l'e-mail et active son espace. | L4 |
| P13 | Le client dépose une pièce depuis son téléphone ; le conseiller la rejette avec un motif ; le client la redépose ; elle est validée ; la complétude avance. | L4 (dépôt seul, sur un dossier de démonstration : L2) |
| P14 | Une pièce n'est pas déposée : relances à J+3, J+7, J+14, puis tâche d'appel ; la mise en pause du dossier les arrête ; à la reprise elles repartent de zéro. Joué avec l'horloge de recette (ENV-032). | L4 |
| P15 | Dossier complet : le conseiller prépare une soumission, génère le paquet, envoie le lien ; la banque télécharge avec son code ; cinq codes faux verrouillent le lien. | L4 |
| P16 | La banque demande un complément ; le client le fournit ; la banque accorde ; le client demande à accepter ; le conseiller enregistre l'acceptation. | L4 |
| P17 | Toutes les banques refusent : le dossier reste en étude, une tâche demande une décision ; le conseiller clôture ; le client est informé sans le motif interne. | L4 |
| P18 | Acquisition : jalons, acte signé, dossier abouti ; le lot passe à « Vendu » ; l'enquête part à J+7. | L4 (enquête : L5) |
| P19 | Le client et le conseiller échangent des messages avec une pièce jointe ; l'e-mail « nouveau message » ne part que si le message reste non lu. | L5 |
| P20 | Un e-mail est rejeté par le fournisseur : la fiche le signale, les envois automatiques s'arrêtent — pas la réinitialisation du mot de passe —, une tâche est créée ; l'adresse corrigée les rétablit. Le rejet de l'adresse d'un promoteur ne touche aucune fiche client. | L3 |
| P21 | Un modèle d'e-mail est modifié, testé, puis rétabli ; une règle est désactivée et son effet cesse. | L5 |
| P22 | Le tableau de bord et les rapports donnent, pour le jeu de contrôle de TDB-062, les chiffres qu'il annonce, filtre compris. | L5 |
| P23 | Le client répond à une enquête avec une mauvaise note : une tâche de rappel est créée ; le retour est traité. | L5 |
| P24 | Droits : un conseiller ne peut ni publier, ni fusionner, ni exporter ; un lecteur ne modifie rien ; le support ne voit aucune donnée d'un client (ROL-015). | L1 à L5, sur le périmètre livré |
| P25 | Le client télécharge ses données (l'archive contient ce que prévoit PRO-075), puis supprime son compte. Sans dossier au-delà de la qualification ni pièce déposée, l'effacement est immédiat et rien ne l'identifie plus. Un acquéreur qui supprime son compte : la demande va à un administrateur, qui la traite (ADM-062) ; ne reste que le minimum de la vente (SEC-111), visible de la Direction et des administrateurs seulement. | L5 |
| P26 | Deux administrateurs modifient la même fiche : le second est prévenu, rien n'est écrasé. | L3 |
| P27 | Le fournisseur d'e-mail est coupé pendant une demande : la demande est enregistrée, l'accusé part au retour du service. | L2 |
| P28 | Café : publication, inscription, complet, liste d'attente, annulation et promotion, rappels, pointage par QR code, remerciement et enquête. | — |
| P29 | Projection : demande en deux temps, préparation, envoi du PDF. Alerte : création sans compte, confirmation, envoi, prolongation. | — |
| P30 | La Direction invite un collaborateur ; il active son compte, configure sa double authentification, se connecte ; suspendu, il perd sa session et ne peut plus entrer. | L1 |
| P31 | Une personne appelle : le conseiller saisit sa demande **sans adresse e-mail** ; la fiche porte « Sans e-mail », aucun e-mail ne part, une tâche « Prévenir » remplace l'e-mail de service ; l'adresse ajoutée ensuite rétablit tout. | L3 |
| P32 | Un taux de change est saisi avec une virgule déplacée : l'écran avertit ; saisi quand même, il est annulé ; les prix du site reviennent à leur valeur. | L4 |
| P33 | Une réservation avec acompte est annulée : l'acompte passe « à suivre », le client le lit, le conseiller enregistre le remboursement, la tâche se ferme — y compris sur un dossier clôturé. | L4 |
| P34 | Un accord de banque est saisi par erreur puis annulé dans les dix minutes : aucun e-mail ne part, et le client n'a rien vu dans son espace — ni étape, ni carte, ni offre ; une offre expirée est prolongée et le dossier revient à « Accord ». | L4 |
| P35 | Un dossier est mis en pause alors qu'une option court : les relances de pièces s'arrêtent, le rappel de l'option part quand même ; le client « en attente » est prévenu de la pause. | L4 |
| P36 | À chaque livraison : aucun menu, onglet, bouton ni lien d'e-mail ne mène à une fonction non livrée ; « Écrire à mon conseiller » tient lieu de messagerie ; la cloche mène aux dernières nouvelles. | L2 à L4 |
| P37 | Un conseiller ouvre l'espace d'un client en aperçu : il lit tout, ne peut rien modifier, et rien n'est marqué lu ou vu pour le client ; l'aperçu se ferme après 30 minutes. | L3 |
| P38 | Le journal des e-mails ne permet d'ouvrir ni un lien d'activation ou d'invitation, ni le dossier envoyé à une banque : lien et code y sont remplacés. | L5, à l'écran du journal (EA-71). Dès L1 (invitation) et L4 (partage), la même règle est tenue par un test automatisé (QUA-010) |
| P39 | Le conseiller pose une option « pas encore confirmée » : le client lit « Option demandée au promoteur », sans notification ni ligne dans son suivi ; la tâche de confirmation naît un jour ouvré plus tard ; « Le promoteur tient le lot » prévient le client ; prolonger exige l'accord du promoteur. Sur une autre option, « Le promoteur refuse » annule l'option, met le lot dans l'état dit, crée la tâche d'appeler le client, et rien n'est envoyé au client au sujet de l'option — sauf, si le bien devient indisponible (son dernier lot est vendu ou retiré), « Ce bien n'est plus disponible ». Une option **confirmée** dont le promoteur reprend le lot s'annule en disant ce qu'il est devenu : le lot ne repasse pas en vente. Une option confirmée puis annulée crée la tâche de prévenir le promoteur. **Inscription des partenaires** (ACP-086, L2) : un promoteur s'inscrit en deux étapes, confirme son adresse, complète son dossier en deux fois, l'envoie ; la Direction est notifiée, la tâche d'examen naît ; l'acceptation crée la fiche `PROSPECT`, le contact principal avec son compte, l'interlocuteur ; l'espace montre « Acceptée ». Une banque est refusée avec une phrase : l'espace la montre, le compte est fermé 30 jours plus tard (horloge de recette). Une adresse déjà client reçoit la variante « adresse déjà utilisée » et l'écran ne dit rien (TRV-112). | L4 |
| P40 | Les disponibilités d'un programme n'ont pas été vérifiées depuis 30 jours : la tâche naît (horloge de recette) ; le conseiller corrige un lot vendu hors plateforme puis clique « Disponibilités vérifiées » ; la fiche affiche la date et l'interlocuteur, la tâche se termine. De même pour le barème d'un produit, à 90 jours. | L3 (disponibilités) · L4 (barème) |
| P41 | Sur la fiche d'un promoteur, « Ce que nous attendons de lui » liste des disponibilités à vérifier, une livraison dépassée et une visite sans accueil désigné (L3), puis une option à confirmer (L4) ; sur celle d'une banque, un dossier sans accusé de réception et une décision attendue. « Saisir la réponse » ouvre la fenêtre du geste ; le nom de l'interlocuteur saisi se retrouve sur l'objet, l'auteur au journal d'audit. | L3 (disponibilités, livraison, visite) · L4 (option, banque) |
| P42 `[P2]` | Un promoteur passe au niveau 2 : l'option en attente lui est envoyée par lien ; il confirme depuis son téléphone, le client est prévenu ; il déclare un lot vendu depuis la page du stock (appliqué, équipe notifiée), puis propose un prix très différent (à relire) ; entre-temps l'équipe saisit une réponse au téléphone : le lien affiche « Réponse enregistrée ». | — |
| P43 `[P3]` | Une banque au niveau 2 télécharge le dossier — ce qui en accuse réception —, indique sa référence, demande un complément puis donne son accord depuis la page : le complément et l'accord attendent le conseiller, qui les applique ; l'e-mail au client part comme en Phase 1. Un lien dont les pièces ont expiré permet encore de répondre, sans rien montrer du client. | — |
| P44 `[P2]` `[P3]` | Un partenaire passe au niveau 2 puis revient au niveau 1, en plein dossier : aucun statut ne change, aucune échéance ne bouge, le client ne reçoit rien ; à la montée, ce qui était attendu part par lien ; à la descente, les liens de réponse sont fermés, une banque garde son lien de téléchargement, les réponses reçues restent à relire. Sans réponse à un lien : une relance, puis la tâche du conseiller. | — |
| P45 `[P2]` `[P3]` | Un partenaire passe au niveau 3 : son premier utilisateur active son compte et retrouve, dans le portail, ce qui l'attendait par lien ; un interlocuteur sans compte continue de répondre par lien. Redescendu au niveau 2 : les appartenances sont suspendues, pas les comptes ; un utilisateur qui appartient à un autre promoteur garde l'autre portail. | — |

## 5. Recette

**QUA-070** `[P1]` **Déroulement** (contrat, article 7). À chaque livraison (QUA-074), SYMLOOP remet : l'accès à l'environnement de recette, avec des données de démonstration (PAR-082) et les comptes d'essai de chaque rôle ; l'accès à la **boîte de recette**, où arrivent tous les e-mails que la plateforme envoie en recette (NOT-013) — c'est là que la cliente lit un accusé de réception ou clique un lien d'activation ; le mot de passe de la porte d'accès (NAV-064) ; le **cahier de recette** de la livraison ; la liste des règles couvertes. La cliente dispose de **sept jours ouvrés** pour vérifier ; sans retour écrit, le ou les lots livrés sont réputés acceptés.

**QUA-074** `[P1]` **Livraison par étapes** (D-006). La Phase 1 se livre en cinq livraisons (`08-tracabilite/02`, § 1). Une livraison est **recevable** quand :
1. chacun de ses parcours (colonne « Livraison » de QUA-030) se joue de bout en bout sur l'environnement de recette, sans dépendre d'une fonction qui n'est pas livrée ;
2. aucune entrée de menu, aucun bouton, aucun lien ne mène à une fonction non livrée : l'entrée est absente, ou l'écran applique le repli prévu ;
3. les e-mails et les notifications des événements livrés partent, avec leurs textes d'origine (NOT-060) ;
4. la version est étiquetée et déployée en recette et en production (ENV-054) ;
5. SYMLOOP a joué le scénario de démonstration devant la cliente (`08-tracabilite/02`, § 4) et remis, avec le cahier de recette, la liste de ce qui n'est pas encore là et de ce que l'écran fait à la place.

Pour l'agent de développement, une livraison est **close** quand les points 1 à 3 sont tenus en recette et que la version est étiquetée et déployée en recette. Le déploiement en production après approbation (ENV-054), la démonstration (point 5) et la vérification par la cliente (QUA-070) sont faits par SYMLOOP et ne bloquent pas le paquet suivant ; leurs remarques entrent dans la livraison suivante (`08-tracabilite/02`, § 1.2, point 4).

Les parcours des livraisons précédentes restent verts : une livraison ne défait pas ce qui a été accepté.

**QUA-071** `[P1]` **Cahier de recette.** Pour chaque parcours du lot : les étapes à suivre, le résultat attendu, les règles vérifiées, une case « conforme » ou « non conforme » et une zone de remarque. Il est rédigé pour être suivi par quelqu'un qui n'est pas technicien.

**QUA-072** `[P1]` **Gravité d'une anomalie.**

| Gravité | Définition | Effet sur l'acceptation (contrat, article 7) |
|---|---|---|
| Bloquante | Elle empêche l'usage normal : un parcours du lot ne peut pas aboutir ; une donnée est perdue ou exposée ; un calcul est faux. | Corrigée dans un délai raisonnable ; le lot est accepté une fois les anomalies bloquantes levées. |
| Mineure | Une règle des specs n'est pas respectée mais l'usage reste possible ; défaut d'affichage ou de texte. | Ne bloque pas la recette. Traitée ensuite : au lot suivant, et au plus tard pendant la garantie de trois mois (article 12). |
| Évolution | Demande qui ne figure pas dans les specs. | Hors recette : question `Q-nnn`, ou avenant (article 18). |

Sans notification écrite dans les sept jours ouvrés, ou si le livrable est mis en exploitation, le lot est réputé accepté (article 7).

**QUA-073** `[P1]` Une anomalie se décrit par : le parcours, l'étape, ce qui était attendu (avec l'identifiant de la règle), ce qui a été constaté, une capture d'écran, et l'identifiant de l'erreur s'il y en a un (TRV-111).

## 6. Essais non fonctionnels (Lot 6, livraison 5)

**QUA-080** `[P1]`

| Essai | Cible |
|---|---|
| Charge | 100 visiteurs simultanés sur le site public et 20 utilisateurs du back-office, pendant 30 minutes, sur un environnement à part dimensionné comme la production. Scénario : 80 % de lectures du site (accueil, catalogue, fiche), 20 % d'écritures (demande, connexion), 5 secondes de réflexion entre deux pages. Critère : les réponses d'API de TRV-132 tenues au 95e centile, moins de 0,1 % d'erreurs. Les objectifs d'affichage de TRV-132 (LCP, CLS, INP) se mesurent hors charge (QUA-040). |
| Volume | Base chargée avec 5 000 biens, 20 000 lots, 50 000 clients, 100 000 demandes, 10 000 dossiers : les listes restent sous 500 ms (BO-083). |
| Sécurité | SEC-130. |
| Restauration | FIA-092. |
| Accessibilité | Revue manuelle des parcours P01 à P06 et P13 au clavier et au lecteur d'écran. |
| Navigateurs et appareils | TRV-131 : parcours P01, P02, P04, P13 sur chaque navigateur pris en charge, et sur un téléphone Android et un iPhone réels. |
| E-mails | Affichage des modèles dans les messageries courantes (Gmail, Outlook, Apple Mail, mobile), en clair et en mode sombre. Critère : aucun texte coupé, boutons cliquables, logo visible. |

Chaque essai fait l'objet d'un **compte rendu** : objet, date, version, environnement, méthode, résultats chiffrés, défauts trouvés et leur suite.

## 7. Documents livrés

**QUA-090** `[P1]` Avec la recette finale : le guide d'utilisation du back-office, illustré, par rôle ; le guide d'exploitation (ENV-060 : déploiement, sauvegarde, restauration, incidents) ; la description de l'API ; ces spécifications, à jour ; la formation des utilisateurs (Lot 6, Q-049). Le guide d'utilisation est un PDF par rôle, servi par le back-office : le « ? » ouvre celui du rôle de la personne connectée (BO-081). Le guide d'exploitation est un document Markdown du dépôt.
