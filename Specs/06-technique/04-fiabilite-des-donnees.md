# Fiabilité des données

Principe 3 du produit : **rien ne se perd.** Ce fichier réunit les mécanismes qui le garantissent : une demande envoyée est enregistrée, deux personnes ne s'écrasent pas, un lot n'est pas promis deux fois, un e-mail en panne ne fait pas perdre une action, et ce qui est supprimé peut revenir.

---

## 1. Transactions et invariants

**FIA-001** `[P1]` **Une action = une transaction.** Tout ce qu'une action écrit en base — l'objet, ses caches (MOD-014), son journal d'audit, ses événements (FIA-040) — est validé **ensemble**, ou pas du tout. Aucun appel à un service extérieur (e-mail, stockage, antivirus) n'est fait à l'intérieur d'une transaction.

**FIA-002** `[P1]` **Les règles vitales sont dans la base**, pas seulement dans le code : clés étrangères (MOD-013), contraintes d'unicité, index uniques partiels, contraintes de valeur. Même un défaut du code ne peut pas les violer.

| Invariant | Garanti par | Erreur renvoyée |
|---|---|---|
| Une seule réservation active par lot (MOD-330) | Index unique partiel sur `Reservation(lotId)` pour les statuts `OPTION`, `RESERVED` | `CONFLICT_STATE`, raison `LOT_ALREADY_OPTIONED` |
| Une seule réservation active par dossier (MOD-331) | Index unique partiel sur `Reservation(dossierId)` | `CONFLICT_STATE`, raison `DOSSIER_HAS_RESERVATION` |
| Un seul bien retenu par dossier | Index unique partiel sur `DossierCandidate(dossierId)` pour `SELECTED` | `CONFLICT_STATE`, raison `TRANSITION_NOT_ALLOWED` |
| Un seul dossier ouvert par client et par bien (MOD-310) | Index unique partiel | `CONFLICT_STATE`, raison `DOSSIER_ALREADY_OPEN_FOR_PROPERTY` |
| Une seule soumission en cours par dossier et par banque (MOD-355) | Index unique partiel | `CONFLICT_STATE`, raison `SUBMISSION_ALREADY_EXISTS` |
| Un e-mail = un compte, une fiche | Index unique sur `User.email` (un compte supprimé garde une adresse de remplacement, MOD-100) ; index unique partiel sur `Client.email` | Compte : `CONFLICT_STATE`, raison `EMAIL_IN_USE` · fiche : `DUPLICATE`, avec le lien vers la fiche existante (CRM-080) |
| Une inscription par personne et par Café | Index unique partiel sur (`eventId`, `email`) | `DUPLICATE` |
| Une seule organisation opérateur (MOD-102) | Index unique partiel | `DUPLICATE` |
| Bornes des valeurs : **toute borne numérique écrite dans la colonne Règles d'une table** (`01-domaine/02` à `05`) — montants positifs, fin après début, pourcentage entre 0 et 100, `floor` de −2 à 80, `nominalRateBps` de 0 à 3 000, `minAmount` ≤ `maxAmount`… —, et capacité ≥ places prises | Contraintes de valeur (`CHECK`) en base, **en plus** de la validation du schéma partagé (ARC-030) | `VALIDATION_ERROR` : le schéma refuse avant la base. Capacité : `CONFLICT_STATE`, raison `CAPACITY_BELOW_TAKEN` |
| Une tâche automatique unique par objet | Index unique partiel sur `Task(dedupeKey)` pour `OPEN` | Aucune : le refus est absorbé, l'effet existe déjà (FIA-041) |
| Un envoi automatique unique | Index unique sur `Communication(dedupeKey)` | Idem |
| Une règle exécutée une fois par événement | Index unique sur (`ruleId`, `triggerEventId`) | Idem |
| Une pièce par dossier, par emprunteur et par code — y compris les pièces **communes**, sans emprunteur | Index unique où une colonne vide compte comme une valeur (MOD-019) | `DUPLICATE` |
| Un seul fil général par client ; une invitation par enquête et par contexte ; un compteur de références par nom et par portée | Idem (MOD-019) : dans PostgreSQL, deux lignes à colonne vide ne sont pas « égales » par défaut — l'index le dit explicitement | Aucune : l'écriture relit la ligne existante et s'en sert |
| Une seule version en cours par pièce ; un numéro de version unique par pièce | Unicité (`documentId`, `number`) ; `currentVersion` écrit sous le verrou de la pièce | — (sous verrou, le cas ne se présente pas) |
| Il reste toujours un compte Direction actif (ROL-010) | Contrôle fait sous verrou de l'organisation opérateur (FIA-020) | `CONFLICT_STATE`, raison `LAST_OWNER` |

Quand la base refuse une écriture pour l'une de ces raisons, l'API renvoie l'erreur de la dernière colonne, avec la raison (API-020) — jamais une erreur `500`. Tout nouvel index unique ou contrôle de cette table nomme ici son erreur.

## 2. Modifications simultanées

**FIA-010** `[P1]` **Verrouillage optimiste** (MOD-007, TRV-094). Chaque objet marqué « ⟳ » a un numéro de `version`. Une modification porte la version lue ; l'écriture se fait par `UPDATE … WHERE id = ? AND version = ?`, qui augmente la version. Aucune ligne touchée : quelqu'un d'autre a modifié entre-temps → `409 CONFLICT_VERSION`. Les transitions de statut suivent la même règle.

**FIA-011** `[P1]` Le conflit se décide **par objet**, pas par champ : on ne fusionne pas en silence deux modifications. L'utilisateur recharge et refait son changement ; l'écran lui laisse copier ce qu'il avait saisi (TRV-094).

**FIA-020** `[P1]` **Verrou de ligne** là où un compteur ou une disponibilité est en jeu. L'opération commence par verrouiller la ligne qui porte le compteur (`SELECT … FOR UPDATE`), dans la transaction :

| Opération | Ligne verrouillée |
|---|---|
| Inscription à un Café, modification de places, promotion depuis la liste d'attente, changement de capacité | L'`Event` (MOD-410) |
| Option, réservation, changement de statut d'un lot | Le `Lot` |
| Création d'un lot, changement de sa référence, rattachement d'un bien à un autre programme (MOD-213) | Le `Program` — le `Property` pour un bien isolé : la référence d'un lot est unique dans le programme, par un contrôle applicatif (`Lot.reference`) |
| Prise en charge d'une demande | La `Lead` |
| Dépôt d'une nouvelle version d'une pièce | Le `DossierDocument` |
| Attribution d'une référence | La ligne `Sequence` (FIA-030) |
| Fusion de deux clients | Les deux `Client`, dans l'ordre de leurs identifiants |
| Changement de rôle, suspension ou suppression d'un compte Direction | La ligne de l'organisation opérateur : deux Directions qui se retirent le rôle l'une à l'autre passent l'une après l'autre, et la seconde est refusée (ROL-010) |
| Décision d'une banque, correction, prolongation | La `BankSubmission`, puis le `Dossier` |
| Clôture, réouverture, changement d'étape | Le `Dossier` |
| Rotation d'un jeton de renouvellement | La `Session` (SEC-021) |

Deux opérations concurrentes passent donc l'une après l'autre ; la seconde voit l'état laissé par la première et réussit ou échoue proprement (« Il ne reste que 2 places. »). Quand plusieurs lignes sont verrouillées, c'est toujours dans le même ordre, pour éviter tout interblocage.

## 3. Références

**FIA-030** `[P1]` Les références lisibles (TRV-051) sont attribuées par la table `Sequence` : dans la transaction de création, la ligne du compteur (`name`, `scope` : le type de référence et sa portée, l'année pour les références annuelles, le pays pour les biens) est verrouillée, augmentée de un, et la référence est formée. Une référence n'est **jamais réutilisée**. Si la transaction échoue, le numéro est perdu : un trou est possible, un doublon ne l'est pas. Au premier objet d'une nouvelle année, la ligne de cette année est créée à 1. L'année est celle de la création, dans le fuseau du calendrier de travail.

## 4. Événements et effets différés

**FIA-040** `[P1]` **Boîte d'envoi transactionnelle** (D-030).
1. L'action écrit son **événement** (`OutboxEvent`) dans la même transaction que ses données. Si la transaction échoue, l'événement n'existe pas ; si elle réussit, il existe : il n'y a pas d'entre-deux.
2. Un travailleur lit les événements non traités et disponibles, par ordre de date, et les **réserve** (`claimedAt`, posé sous `SELECT … FOR UPDATE SKIP LOCKED` le temps de la réservation seulement), de sorte que plusieurs travailleurs ne traitent jamais le même. La réservation est levée à la fin du traitement ; une réservation de plus de 5 minutes sans issue est tenue pour abandonnée (instance tombée) et l'événement redevient disponible. Un événement n'est réservé que si aucun événement plus ancien du même objet n'est non traité — réservé, disponible, ou en attente d'un nouvel essai avant son cinquième échec (point 4).
3. Il exécute leurs effets (AUT-003), puis marque l'événement traité.
4. En cas d'échec : `attempts` augmente, l'erreur est notée, un nouvel essai est programmé (1 min, 5 min, 30 min, 2 h, 6 h, puis toutes les 6 h). Au **cinquième** échec, une alerte part au support (AUT-076) : l'événement est encore réessayé. Au **dixième**, il est mis de côté (`parkedAt`) et une seconde alerte part ; seul « Rejouer », depuis le diagnostic (ADM-080), le reprend. Tant qu'un événement attend un nouvel essai, les événements **plus récents du même objet** attendent avec lui (FIA-042) — au plus jusqu'à son **cinquième** échec (environ 2 h 30) : à partir de là, ils sont traités, chacun relisant l'état réel, et l'événement en échec poursuit seul ses essais.

**FIA-041** `[P1]` **Au moins une fois, jamais deux effets.** Un événement peut être traité deux fois (panne entre l'effet et le marquage). Chaque effet est donc protégé par sa propre clé (AUT-005) : rejouer un événement ne renvoie pas un e-mail, ne recrée pas une tâche.

**FIA-042** `[P1]` **Ordre.** Les événements d'un même objet (même `aggregateType` et `aggregateId`) sont traités dans l'ordre où ils ont été écrits, sauf derrière un événement qui a échoué cinq fois (FIA-040, point 4). Un effet ne suppose jamais l'état décrit par l'événement : il **relit** l'objet (AUT-011), et s'abstient si l'état ne correspond plus (une pièce rejetée puis redéposée avant l'envoi de l'e-mail de rejet).

**FIA-043** `[P1]` Un service extérieur indisponible **retarde** un effet, il ne l'annule pas : l'e-mail part au retour du fournisseur — réessayé pendant 72 heures (NOT-010) ; un e-mail dont le lien aurait expiré entre-temps est régénéré, pas envoyé périmé — ; le contrôle antivirus reprend ; l'utilisateur, lui, a déjà reçu sa confirmation. Seul un **refus** définitif du fournisseur (adresse invalide) met fin aux essais.

**FIA-044** `[P1]` **Si le cache et les files d'attente tombent** (Redis). La base reste la vérité : les événements sont dans la boîte d'envoi, les exécutions de règles et les envois programmés dans leurs tables.
- **Ce qui continue** : toutes les écritures (une demande est enregistrée, une pièce déposée) ; la lecture des pages publiques déjà en cache chez le CDN.
- **Ce qui attend** : les effets différés (e-mails, tâches, traitement des médias, contrôle antivirus) ; ils reprennent au retour, sans perte ni doublon (FIA-041).
- **Ce qui se dégrade** : la vérification d'une session relit la base ; les mises à jour en direct s'arrêtent et les écrans se rafraîchissent d'eux-mêmes (ECL-003) ; les limites de débit sont comptées par instance, avec des seuils divisés par deux ; le compteur de vues n'enregistre rien.
- Une alerte technique part dès la première minute (AUT-076) ; l'écran de diagnostic affiche « Files indisponibles ».

## 5. Envois doublés et reprises

**FIA-050** `[P1]` **Idempotence des formulaires** (API-040) : double clic, nouvel essai après une coupure, rechargement — la création n'a lieu qu'une fois. **Détection des secondes demandes** délibérées : DEM-024.

**FIA-051** `[P1]` **Reprise d'un dépôt de fichier** : un fichier arrivé au stockage mais jamais confirmé n'appartient à aucune pièce ; il est effacé après 24 heures. Un dépôt de pièce confirmé n'appartient à la pièce qu'à la création de la version (API-081), qui crée ses lignes dans la même transaction ; confirmé mais jamais rattaché, il est effacé avec sa ligne `Upload` (AUT-091). Il n'existe pas de version sans fichier, ni de fichier de pièce sans version.

## 6. Suppression et restauration

**FIA-060** `[P1]` **Suppression logique** (MOD-006, TRV-096). `deletedAt` est posé ; l'objet sort de toutes les lectures par défaut ; ses contraintes d'unicité ne s'appliquent plus (index partiels), ce qui libère son adresse ou son e-mail. Ses enfants suivent quand ils n'ont pas d'existence propre (les lots d'un bien, les médias d'un programme). Un objet **référencé** par un objet vivant ne se supprime pas : l'écran propose de l'archiver.

**FIA-061** `[P1]` **Restauration** (ADM-070) : `deletedAt` est vidé, pour l'objet et pour les enfants supprimés **avec lui** (même instant de suppression). Si une contrainte d'unicité est désormais prise par un autre objet, la restauration le dit et demande une autre valeur.

**FIA-062** `[P1]` **Purge.** La suppression physique n'est faite que par les tâches planifiées (AUT-091, SEC-110), et par « Supprimer définitivement » (ADM-070), qui applique la même routine à un objet de la corbeille. Elle supprime d'abord les **fichiers**, puis les lignes ; si la suppression d'un fichier échoue, la ligne reste et la purge réessaie la nuit suivante. Le stockage privé garde les versions effacées 30 jours (protection contre une suppression par erreur), après quoi elles disparaissent pour de bon.

## 7. Caches et valeurs calculées

**FIA-070** `[P1]` Un champ « (cache) » est recalculé dans la transaction qui le rend faux (MOD-014). Il n'est **jamais** modifié à la main ni par une route. Le contrôle nocturne (AUT-090) recalcule tout depuis les sources et signale tout écart : un écart est un défaut du code.

**FIA-071** `[P1]` Ce qui a été **montré** ou **promis** à une date est figé à cette date : le prix convenu d'une réservation, les barèmes d'une simulation (`parametersSnapshot`), les conditions d'une offre de banque, le contenu d'un e-mail envoyé (hors ses liens personnels et ses codes, jamais conservés : NOT-002), le texte d'un consentement, ce que le visiteur voyait en envoyant sa demande (`Lead.payload.context`). Changer un prix, un barème, un modèle ou un texte légal ne réécrit pas le passé.

## 8. Migrations et données de départ

**FIA-080** `[P1]` **Migrations du schéma** : versionnées, relues, appliquées par le déploiement avant le démarrage de la nouvelle version, sous un verrou qui empêche deux exécutions. Elles vont toujours de l'avant ; une erreur se corrige par une nouvelle migration. Tout changement qui retire ou transforme une colonne se fait en deux livraisons : la première ajoute et recopie, la seconde retire — l'ancienne version de l'application continue donc de fonctionner pendant le déploiement.

**FIA-081** `[P1]` Une migration qui transforme des données est accompagnée d'un test sur une copie anonymisée, et précédée d'une sauvegarde vérifiée.

**FIA-082** `[P1]` Les **données de départ** se rejouent sans doublon et sans écraser ce que l'administrateur a modifié (PAR-080, PAR-081).

## 9. Sauvegardes

**FIA-090** `[P1]` **Base de données** : journalisation continue permettant de revenir à **n'importe quel instant** des 7 derniers jours, et une sauvegarde complète quotidienne gardée 30 jours, chiffrée, dans une autre zone que la base. **Fichiers** : stockage répliqué, avec conservation des versions 30 jours.

**FIA-091** `[P1]` **Objectifs** : perte de données maximale de **15 minutes** ; retour en service en **4 heures** au plus.

**FIA-092** `[P1]` **Une sauvegarde qui n'a pas été restaurée n'est pas une sauvegarde.** Un essai de restauration complet (base et fichiers, sur un environnement à part) est fait avant la mise en ligne, puis chaque trimestre ; son résultat est consigné. La procédure est écrite (ENV-060).

## 10. Intégrité des fichiers

**FIA-100** `[P1]` Chaque fichier reçu a son empreinte SHA-256 : annoncée par le déposant, calculée par l'API à la confirmation du dépôt, comparée à l'annonce, puis stockée (API-080). Elle est revérifiée quand le fichier entre dans un paquet de soumission (dont le manifeste garde l'empreinte). Un fichier dont l'empreinte ne correspond plus est signalé et n'est pas servi.

## 11. Erreurs

**FIA-110** `[P1]` **Aucune erreur n'est avalée.** Une action qui échoue le dit à l'utilisateur (TRV-110) et laisse la base dans l'état d'avant. Une action en plusieurs objets (clôturer un dossier : réservation, soumissions, tâches, rendez-vous) est **une** transaction : tout, ou rien. Une action groupée sur plusieurs objets indépendants (affecter 20 demandes) traite chaque objet dans sa propre transaction et rend un compte ligne par ligne (BO-035).

**FIA-111** `[P1]` **Un import** est contrôlé à blanc avant d'écrire (CTL-101) ; à l'exécution, chaque ligne est écrite dans sa propre transaction ; une ligne en erreur n'emporte pas les autres ; le rapport dit ce qui a été fait.

## 12. Contrôles automatiques

**FIA-120** `[P1]` En plus du contrôle des caches, la nuit, une **vérification de cohérence** recherche ce qui ne devrait pas exister : un dossier sans emprunteur principal ; un dossier à l'étape `DOCUMENTS` sans pièce ; un lot `OPTIONED` ou `RESERVED` sans réservation active ni vente hors plateforme ; une réservation active dont le lot est `AVAILABLE` ; une soumission `SUBMITTED` sans paquet en mode lien sécurisé ; une pièce `VALIDATED` sans fichier ; un compte client sans fiche ; une demande rattachée à un dossier supprimé ; une demande encore ouverte sur un dossier clôturé ; une réservation aboutie dont le lot n'est pas `SOLD` ; une réservation terminée dont l'acompte est « à suivre » depuis plus de 60 jours ; une tâche ouverte affectée à un compte suspendu ou supprimé ; un client actif sans e-mail **ni** téléphone. Chaque anomalie est journalisée et signalée au support (AUT-076). Rien n'est corrigé automatiquement. Le lot visé par un dossier ouvert et qui n'est plus libre n'est pas dans cette liste : c'est le contrôle des caches qui le vide et prévient le conseiller (AUT-090).

**FIA-121** `[P1]` **Essais de concurrence** exigés (QUA-022) : deux conseillers prennent la même demande ; deux options sur le même lot ; plus d'inscriptions simultanées que de places ; deux validations de la même pièce ; deux déplacements du même dossier ; double envoi d'un même formulaire ; un événement traité deux fois.
