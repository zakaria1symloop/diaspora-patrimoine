# Back-office — administration

Écrans **EA-96** (équipe), **EA-97** (paramètres), **EA-98** (référentiels), **EA-99** (journal d'audit), **EA-100** (données personnelles), **EA-101** (corbeille), **EA-102** (diagnostic), **EA-103** (imports et exports). Contrat : offre technique, § 4.9 (journal d'audit) et § 7 (sécurité, RGPD).

---

## 1. Paramètres (EA-97)

**ADM-010** `[P1]` L'écran présente les paramètres de `01-domaine/10`, § 1, par groupes : Accès et organisation · Calendrier et délais · Financement · Pièces · Catalogue et affichage · Le Café · E-mails et enquêtes · Coordonnées et identité · Textes légaux courts · Sécurité et conservation · Fonctionnalités. Pour chaque paramètre : son libellé, sa description, sa valeur, sa valeur par défaut, l'auteur et la date de sa dernière modification, et « Rétablir la valeur par défaut ». Libellé et description sont des textes d'interface (`07-design/03`), rédigés d'après la colonne « Effet » de `01-domaine/10`, § 1, et relus par la cliente avec le paquet 6.4. N'y figurent pas : les listes `catalogue.amenities` et `catalogue.features`, qui se modifient dans Référentiels (ADM-020) ; `clock.offsetDays` et `launch.confirmations`, qui ne s'écrivent que par leurs propres gestes (ENV-032, ADM-015).

**ADM-011** `[P1]` **Droits.** `settings.read` : voir. `settings.manage` : modifier les paramètres courants. `settings.sensitive.manage` (rôle Direction) : modifier les paramètres sensibles (🔐) ; les autres rôles les voient, grisés, avec « Réservé à la Direction ». Modifier un paramètre sensible demande la confirmation renforcée (BO-005). La maintenance a son propre droit, `maintenance.manage` : un administrateur ou le support l'active pour une intervention sans attendre la Direction.

**ADM-012** `[P1]` **Changements à effet large** : l'écran annonce l'effet avant d'enregistrer.

| Paramètre | Annonce |
|---|---|
| `access.agentScope` → `ASSIGNED_ONLY` | « Les conseillers ne verront plus que les demandes, clients et dossiers qui leur sont affectés. » |
| `display.referenceCurrency` | « Tous les prix affichés seront recalculés dans cette devise. » Refusé s'il manque un cours entre cette devise et celle d'un pays actif. |
| `finance.exchangeRateKind` | « Les prix seront recalculés avec les cours {officiels / indicatifs}. » Refusé s'il n'existe aucun cours de cette nature pour un couple utile. |
| `finance.reference.*` | « Les mensualités de {n} biens publiés vont être recalculées. » |
| `finance.indicative` | « Les estimations des simulateurs changent dès maintenant. Les simulations déjà enregistrées ne changent pas. » |
| `seo.allowIndexing` → vrai | « Le site deviendra visible dans les moteurs de recherche. » C'est le dernier geste de l'ouverture (ENV-054) : il suppose fermée la carte « Avant la mise en ligne » (PAR-100). Tant qu'un point non confirmable y reste ouvert, l'activation est refusée (raison `LAUNCH_CHECKLIST_OPEN`) ; les points confirmables encore ouverts sont nommés et se confirment dans la même fenêtre (ADM-015). L'indexation n'étant pas un point de cette carte, rien ne tourne en rond. |
| `maintenance.enabled` → vrai | « Le site public et l'espace client afficheront la page de maintenance. » |
| `security.staff.twoFactorRequired` → faux | « La double authentification ne sera plus exigée du personnel. » avec saisie d'une raison. |
| Une clé `retention.*` abaissée | « {n} éléments seraient effacés {cette nuit · dimanche} : {détail par type}. » · saisie de {n} pour confirmer (PAR-006). |
| Un indicateur `features.*` → faux | Ce qui est en cours pour cette fonction, et ce qui s'arrête (PAR-011, ADM-090). |
| `business.calendar.*`, `sla.*` | « Les échéances déjà calculées ne changent pas ; les nouvelles suivront ce réglage. » |

**ADM-013** `[P1]` **Calendrier** : jours et heures de travail, fuseau, et la table des **jours fériés** — date, libellé, « Chaque année » ; ajout, modification, suppression (PAR-030 à PAR-032).

**ADM-090** `[P1]` **Fonctionnalités** (PAR-010). La liste des éléments `[P1]` livrés, chacun avec sa description, son état, et ce que le site affiche à sa place quand il est inactif (son repli, ACC-090). Activer ou désactiver : rôle Direction, confirmation renforcée. À l'activation, l'écran rappelle les textes du site qui peuvent maintenant en parler : « Pensez à compléter la page Notre concept et les questions fréquentes. » (EDI-011, EDI-041). Désactiver une fonction qui a des données (des Cafés publiés, des alertes actives) l'annonce, et dit comment ne laisser personne sans nouvelles : « 2 Cafés publiés ne seront plus visibles, et leurs 41 inscrits ne recevront plus de rappel. Annulez d'abord ces Cafés pour les prévenir, ou confirmez. » · « 127 alertes actives cesseront d'envoyer des biens ; leurs liens de désinscription continueront de fonctionner. ». Ce qui se passe ensuite : PAR-011.

**ADM-015** `[P1]` **Avant la mise en ligne.** L'écran de PAR-100 : chaque point, son état, le lien pour le régler, et, pour les points confirmables (PAR-100), « Confirmer en l'état » et « Retirer la confirmation » (`settings.sensitive.manage`, raison obligatoire ; tracés `setting.changed`).

## 2. Référentiels (EA-98)

**ADM-020** `[P1]` Un onglet par référentiel, avec les règles communes de PAR-090 (on désactive, on ne supprime pas ce qui sert ; un code ne change pas).

| Référentiel | Champs | Particularités |
|---|---|---|
| Pays | Nom, devise, indicatif, mots employés pour « région » et « commune », « Proposé comme pays de résidence », **« Catalogue actif »** | Activer un pays pour le catalogue : PAR-091. |
| Régions | Pays, code, nom (français, arabe), position du centre, active | |
| Communes | Région, nom (français, arabe), position du centre, active | Recherche par nom ; ajout à la main. |
| Équipements · Caractéristiques | Code, libellé, icône, ordre, actif | PAR-060. |
| Temps de vol `[P1]` | Région, ville de départ, aéroport, durée, direct ou non, note | PAR-024. |

## 3. Équipe (EA-96)

**ADM-030** `[P1]` **Liste** (`user.read`). Colonnes : Nom · E-mail · Rôle · État · Double authentification · Dernière connexion · Reçoit des demandes · Absent jusqu'au · En cours (demandes, dossiers, tâches). Les comptes supprimés n'y figurent pas. Tri par défaut : Nom ; triables : Nom, Rôle, État, Dernière connexion. Filtres : Rôle, État. Recherche : nom, e-mail. Double authentification : « Oui » · « Non » · « — » pour un compte invité. « Reçoit des demandes », « Absent jusqu'au » et « En cours » arrivent avec le traitement des demandes (paquet 3.2) : avant, ces colonnes sont absentes.

| Action (`user.manage`) | Règles |
|---|---|
| **Inviter** | Prénom, nom, e-mail, rôle, fonction. L'adresse ne doit appartenir à aucun compte (ROL-003) : « Cette adresse est déjà utilisée par un compte. ». E-mail `S_INVITATION` (7 jours). « Renvoyer l'invitation » (`resend-invitation`) : un nouveau lien, qui invalide le précédent (MOD-105), et `S_INVITATION` repart ; tracé `user.invited`, sans nouvelle notification. « Annuler l'invitation » (`cancel-invitation`), pour un compte encore « Invité » seulement : le compte passe `DELETED` (MOD-100, CYC-200), son appartenance est révoquée (`Membership.revokedAt`), son lien invalidé ; tracé `user.deleted` et notifié comme une suppression (ROL-012). |
| **Changer le rôle** | Effet immédiat ; les sessions du compte sont fermées (ROL-013). Seul un compte Direction touche à un compte Direction (ROL-011). Il doit rester un compte Direction actif (ROL-010). |
| Modifier | Fonction, « Reçoit des demandes », absence. Le nom, la photo et le mot de passe appartiennent à l'intéressé. |
| Changer l'adresse e-mail | Nouvelle adresse (libre, ROL-003) ; un lien de confirmation part à la nouvelle adresse, un avis à l'ancienne ; l'adresse ne change qu'à la confirmation ; les sessions sont alors fermées. C'est le chemin d'un changement de nom de domaine de la société. |
| Suspendre · Réactiver | Compte actif seulement : un compte « Invité » ne se suspend pas, son invitation se renvoie ou s'annule (ci-dessus). Raison. Les sessions sont fermées. Ses demandes, dossiers et tâches restent les siens ; l'écran les compte et propose de les réaffecter. Tant qu'ils ne le sont pas, rien ne se tait : ses notifications vont aux administrateurs, ses nouvelles tâches automatiques naissent non affectées (NOT-018, AUT-032), et la liste de l'équipe garde le bandeau « {prénom} est suspendu : 3 demandes, 5 dossiers et 4 tâches à réaffecter ». Il en va de même quand son rôle devient Lecture seule ou Support. |
| **Supprimer** | ADM-031. |
| Réinitialiser la double authentification | ADM-032. |

Chaque action est tracée, et notifiée aux comptes Direction (ROL-012).

**ADM-031** `[P1]` **Supprimer un compte du personnel.** Refusé tant qu'il porte du travail en cours. L'écran liste : ses demandes non clôturées, ses dossiers ouverts, ses tâches ouvertes, ses rendez-vous à venir, les Cafés dont il est responsable, les clients dont il est le conseiller référent — et demande, pour chaque groupe (ou pour tous), **à qui les confier**. Une fois la réaffectation faite : le compte passe `DELETED`, ses données personnelles sont effacées (MOD-100) ; ce qu'il a créé reste, signé « Utilisateur supprimé ».

**ADM-032** `[P1]` **Réinitialiser la double authentification** d'un collègue qui a perdu son appareil : permission `user.twofactor.reset` (rôle Direction), raison obligatoire, confirmation renforcée. Ses sessions sont fermées ; à sa prochaine connexion, il doit la reconfigurer avant d'entrer (BO-003).

**ADM-033** `[P1]` **Réaffecter en nombre** : depuis la ligne d'un membre (absent, suspendu, surchargé), « Réaffecter » transfère tout ou partie de ses demandes, dossiers, tâches, rendez-vous à venir et clients dont il est le référent à un ou plusieurs collègues (`dossier.assign`, `lead.assign`, `client.assign`, `task.manage.all`). Un dossier emporte avec lui ses tâches, ses rendez-vous et ses demandes ouvertes (CYC-040). Les clients concernés ne sont prévenus du changement de conseiller que si la case « Informer les clients » est cochée (CYC-040).

**ADM-040** `[P1]` **Premier compte, et compte Direction perdu.** L'installation crée un compte Direction invité à l'adresse fournie par la configuration (PAR-080) ; l'invitation part de l'adresse d'expédition de l'environnement (NOT-003). Si elle expire, une commande d'exploitation en renvoie une : `pnpm ops owner:resend-invitation --email <adresse>`. Il n'existe aucun compte par défaut avec un mot de passe connu.

Si le **seul** compte Direction ne peut plus entrer — appareil de codes perdu sans code de secours, boîte e-mail fermée —, aucun écran ne peut le rétablir, et c'est voulu. SYMLOOP lance alors, sur demande **écrite** de la cliente, la commande de rétablissement : elle renvoie une invitation à l'adresse du compte (ou à une nouvelle adresse désignée dans la demande), remet à zéro son mot de passe et sa double authentification, ferme ses sessions. Elle écrit une ligne au journal d'audit (`user.recovered`, acteur système, avec la référence de la demande) et prévient par e-mail toutes les adresses Direction et Administrateur connues. Commande : `pnpm ops owner:recover --email <adresse> [--new-email <adresse>] --request <référence de la demande écrite>` ; la référence va dans `AuditLog.reason` ; le compte garde son nom ; la commande affiche son résultat sans aucun secret (ni lien, ni jeton). La bonne pratique, rappelée sur l'écran de l'équipe tant qu'il n'y a qu'un compte Direction : « Désignez un second compte Direction. ».

**ADM-095** `[P1]` **Accès exceptionnel du support** (ROL-016). Permission `support.elevate` (rôle Direction) : choisir un compte Support, une durée (72 heures au plus), une raison. Pendant la période : le compte agit avec le rôle Administrateur, un bandeau le lui rappelle, chaque action est tracée avec la mention de l'accès exceptionnel (`AuditLog.elevationAuditId`). On peut y mettre fin avant l'échéance. À la fin : e-mail `S_ELEVATION_ENDED` aux comptes Direction, avec le nombre d'actions faites et le lien vers le journal filtré (filtre « Accès exceptionnel », ADM-051).

## 4. Journal d'audit (EA-99)

**ADM-050** `[P1]` Le journal (`audit.read`) liste toutes les actions tracées : celles qui ont un code propre, et les écritures ordinaires sous leur code générique (SEC-080). Colonnes : Date · Auteur et rôle · Action · Objet · Raison. Ouvrir une ligne montre les valeurs **avant** et **après**, champ par champ (les valeurs sensibles sont masquées, MOD-430), l'identifiant de la requête et l'appareil.

**ADM-051** `[P1]` **Filtres** : période · auteur · famille d'actions — les quatorze familles de SEC-080 : Connexion, Équipe, Client, Demande, Dossier, Pièce, Financement, Catalogue, Communication, Contenus, Paramètres, Données personnelles, Corbeille, Système · « Accès exceptionnel » (actions faites sous un accès exceptionnel du support, `AuditLog.elevationAuditId`) · type d'objet · un client · un dossier. Recherche par référence. La fiche d'un client et celle d'un dossier ont un raccourci vers le journal filtré sur eux.

**ADM-052** `[P1]` Le journal est **en lecture seule** pour tous, sans exception : aucune ligne ne se modifie ni ne se supprime (MOD-430). Il s'exporte avec la permission `audit.export` (rôle Direction ; l'export est lui-même tracé). Le rôle Support n'y voit que les familles Connexion et Système (SEC-080) ; les erreurs du serveur se lisent dans le diagnostic (ADM-080).

## 5. Données personnelles (EA-100)

**ADM-060** `[P1]` **Demandes d'exercice de droits** (`gdpr.manage`). Liste : Référence · Nature · Demandeur · Reçue le · **Échéance** (30 jours, en orange à 10 jours, en rouge dépassée) · État · Traitée par. « Enregistrer une demande » saisit une demande reçue par e-mail ou par courrier : nature, adresse e-mail du demandeur, précisions, date de réception. Vide : « Aucune demande d'exercice de droits. » et « Enregistrer une demande ».

**ADM-061** `[P1]` **Rechercher une personne** : par adresse e-mail, par téléphone ou par nom, l'écran réunit tout ce que la plateforme détient sur elle — fiche client (et les fiches fusionnées en elle), compte, demandes, dossiers, pièces, messages, inscriptions aux Cafés, alertes, demandes « Me prévenir », avis, consentements, e-mails envoyés. Il cherche aussi là où une personne figure **sans être cliente** : co-emprunteur ou garant d'un dossier (`DossierParty`), personne de confiance d'un client (`ClientContact`), auteur d'un signalement qui a laissé son adresse, candidature de partenaire, interlocuteur d'un promoteur ou d'une banque (`PromoterContact`, `BankContact`), simulation reçue par e-mail, compte du personnel. C'est le point de départ de toute demande, y compris celle d'une personne qui n'a pas de compte.

**ADM-062** `[P1]` **Traiter une demande** (CYC-230).
1. **Vérifier l'identité** : pour une demande faite depuis l'espace client, c'est acquis ; sinon le traitant note comment il l'a vérifiée (`verificationMethod` : réponse depuis l'adresse connue, rappel au numéro connu). Sans vérification, aucune action n'est possible (raison `IDENTITY_NOT_VERIFIED`). Le premier geste de traitement fait passer la demande à `IN_PROGRESS` (CYC-230).
2. **Agir**, selon la nature (ADM-063).
3. **Clore** : « Traitée », avec un compte rendu interne (`outcomeNote`, jamais envoyé) et, au besoin, un message au demandeur (`requesterMessage`, repris dans l'e-mail) ; ou « Refusée », avec le motif (`rejectionReason`), qui est envoyé au demandeur. La personne reçoit `C_DATA_REQUEST_DONE` — cet e-mail part toujours, même vers une fiche limitée ou en cours d'effacement : il répond à sa démarche (AUT-007). Pour un effacement, il est mis en file avant que l'adresse disparaisse.

**ADM-063** `[P1]`

| Nature | Action |
|---|---|
| Accès · Portabilité | « Préparer l'export » : l'archive de PRO-075, mise à disposition dans l'espace du client, ou, sans compte, remise par un **lien de téléchargement sécurisé à code** : un `SecureShare` attaché à l'export (`exportJobId`), valable 7 jours, trois téléchargements, cinq essais de code ; le lien et le code partent dans deux e-mails distincts (`C_DATA_EXPORT_LINK`, `C_DATA_EXPORT_CODE`) à l'adresse **vérifiée** à l'étape 1. La page de téléchargement est neutre (« Vos données – Diaspora Patrimoine ») et ne montre rien avant le bon code. Cinq codes faux la verrouillent : les administrateurs en sont notifiés (`NS_SHARE_LOCKED`) et renvoient un code, ou révoquent le lien, depuis la demande. Les notes internes en sont exclues ; si la personne les demande expressément, un administrateur les joint à la main après relecture. |
| Rectification | Modifier la fiche ; le compte rendu dit ce qui a été corrigé. |
| Opposition | Retrait de l'accord pour les actualités, « Ne pas contacter », désactivation des alertes. |
| Limitation | « Limiter le traitement » renseigne `restrictedAt` (`restrictionReason = REQUEST` ; tracé : `client.restriction_set`), et marque de même les lignes où la personne figure comme co-emprunteur ou garant dans le dossier d'un autre (`DossierParty.restrictedAt` ; ADM-061 les montre). Les données sont conservées mais ne servent plus à rien jusqu'à la levée : aucune automatisation, aucun e-mail sauf ceux qui répondent à la demande de la personne (AUT-007), aucune modification par l'équipe hors de cet écran, aucun envoi à une banque, aucune proposition ; la fiche et ses dossiers portent « Traitement limité depuis le {date} ». La personne peut toujours se connecter — les e-mails de compte et de sécurité lui parviennent (AUT-007) —, lire son espace et exercer ses droits : télécharger ses données, demander la suppression de son compte, retirer un accord, régler ses préférences d'e-mail, changer son mot de passe et ses réglages de sécurité, écrire à l'équipe. Ses autres écritures sont refusées avec « Le traitement de vos données est limité à votre demande. Écrivez-nous pour le lever. ». Ses dossiers ouverts sont mis en pause. « Lever la limitation » (`lift-restriction`, `gdpr.manage`, raison obligatoire ; tracé `client.restriction_lifted`) rétablit les automatisations et les envois ; les dossiers restent en pause jusqu'à leur reprise. |
| **Effacement** | ADM-064. |
| Autre | Une réponse écrite (`requesterMessage`), sans action automatique. |

**Une personne qui n'est pas cliente** — co-emprunteur, garant, personne de confiance, interlocuteur d'un partenaire, auteur d'un signalement — a les mêmes droits ; ADM-061 la retrouve. **Accès** : l'administrateur prépare l'export de ce qui la concerne, elle seule — son nom, ses coordonnées, son rôle, la liste de ses pièces et leurs fichiers —, sans rien du client ; il est remis par le même lien à code. **Rectification** : sur la ligne qui la porte. **Limitation** : pour un co-emprunteur ou un garant, sa ligne est marquée (`DossierParty.restrictedAt`, par le même geste et sous les mêmes codes de trace que pour une fiche) ; elle ne se modifie plus, on ne dépose plus pour elle, et ses pièces ne sortent plus dans aucun paquet tant que la limitation dure (DOS-031, BNK-103). Ses pièces en attente ne sont plus relancées (AUT-042), et le conseiller du dossier reçoit la tâche de revoir le dossier avec le client, comme pour un retrait : sans elles, le dossier ne peut pas être complet. Pour une personne de confiance, un interlocuteur de partenaire ou l'auteur d'un signalement, il n'y a rien à geler — leurs lignes ne nourrissent aucun traitement automatique en Phase 1 — : l'administrateur le lui répond et consigne sa demande. **Effacement** d'un co-emprunteur ou d'un garant d'un dossier **ouvert**, en trois temps : (1) si une soumission envoyée et non terminée contient ses pièces, l'effacement attend son issue ou son retrait — l'administrateur l'explique à la personne : la banque a déjà son dossier ; (2) sinon la partie est retirée du dossier (MOD-321), puis **effacée** — nom remplacé par « Personne retirée », coordonnées et situation vidées, fichiers de ses pièces supprimés ; (3) le conseiller du dossier reçoit une tâche prioritaire, « {rôle} retiré du dossier {référence} à sa demande : revoir le financement avec {client} », et c'est lui qui en parle au client. Sur un dossier clos, sa ligne et ses pièces sont effacées, sauf le nom d'un co-emprunteur d'une vente, gardé avec elle (SEC-111). Une personne de confiance : sa ligne est supprimée. Un interlocuteur de partenaire : sa ligne est supprimée ; son nom reste avec les réponses qu'il a données, le temps du dossier (ACP-013).

**ADM-064** `[P1]` **Effacer les données d'une personne.** L'écran montre d'abord :
- **ce qui sera effacé** : identité, coordonnées, situation, finances, messages, pièces et leurs fichiers, simulations, alertes, favoris, inscriptions à venir ;
- **ce qui sera conservé**, et pourquoi, selon le cas de la personne — simple contact, dossier clôturé sans achat, ou acquéreur : la liste exacte, champ par champ, est celle de SEC-111. En bref : pour un acquéreur, ce que la vente oblige à garder (identité de l'acheteur, bien, prix, date de l'acte, réservation, acompte), jusqu'au terme de `retention.dossierYears` ; pour tous, les preuves de consentement et le journal d'audit, sans les données d'identité ;
- **ce qui bloque** : un dossier ouvert (il faut le clôturer), une réservation active, une soumission en cours (il faut la retirer), un acompte encore « à suivre » (son issue doit être enregistrée, CYC-108). Tant que l'un d'eux reste, la validation est refusée (raison `ERASURE_BLOCKED`).

La validation demande de saisir le nom de la personne et la confirmation renforcée. L'effacement est **irréversible** ; il s'exécute en arrière-plan et son résultat est consigné dans la demande (`erasureResult` : nombre d'objets effacés et conservés, par type).

## 6. Corbeille (EA-101)

**ADM-070** `[P1]` Les objets supprimés depuis les écrans (TRV-096) : type, nom ou référence, supprimé le, par qui, « Purge dans {n} jours ». **Restaurer** remet l'objet en place, dans l'état où il était, avec une exception : une restauration ne publie jamais. Un programme, un bien, une question fréquente, un témoignage reviennent non publiés ; un promoteur, une banque, un produit bancaire reviennent dans leur état, sans republier les biens qui en dépendent — republier reste un geste explicite. Si son adresse ou son identifiant a été repris entre-temps, la restauration est refusée (raison `RESTORE_CONFLICT`) et l'écran demande d'en choisir un autre. **Supprimer définitivement** avant l'heure : saisie du mot « SUPPRIMER » (TRV-095) ; l'objet sort de la corbeille et un travail de fond lui applique aussitôt la routine de la tâche `purge` (AUT-091, FIA-062) — fichiers d'abord, puis lignes ; un objet encore référencé par un objet vivant n'est pas purgé : il reste, invisible, et l'écran le dit. Les deux gestes demandent `trash.manage` et sont tracés. La corbeille liste tout ce qui se supprime depuis les écrans : programmes, biens, lots, médias, promoteurs, banques, produits, autres partenaires, Cafés, dossiers ouverts par erreur, fiches et dossiers écartés avec une demande indésirable (CYC-006), notes, tâches, questions fréquentes, témoignages, modèles de listes (AUT-091). Restaurer ne ramène jamais ce qu'un effacement de données personnelles a retiré : un dossier restauré dont le client a été effacé revient avec un client anonyme. Les purges automatiques : AUT-091. Vide : « La corbeille est vide. »

## 7. Diagnostic (EA-102)

**ADM-080** `[P1]` Réservé à `support.diagnostics`. Aucune donnée personnelle n'y figure.

| Bloc | Contenu | Actions |
|---|---|---|
| Version | Version de l'application, date de déploiement, environnement. | — |
| Santé | Base de données, cache, stockage, fournisseur d'e-mail, antivirus : « en service » ou « en panne », avec l'heure du dernier contrôle. | — |
| Files d'attente | Pour chaque file : en attente, en cours, en échec, différés. | Rejouer les travaux en échec. |
| Tâches planifiées | Celles de AUT-081 : dernier passage (début, durée, résultat, compteurs : `JobRun`), prochain passage. Une purge de conservation qui dépasserait son plafond attend ici la confirmation de la Direction (PAR-006). | « Lancer maintenant » (tracé). |
| Horloge | En recette seulement : la date de l'application, et son décalage (ENV-032). | « Avancer d'un jour » · « Avancer de {n} jours » · « Revenir à l'heure réelle » (tracés ; ENV-032). Absent en production. |
| Stockage | Volume occupé par famille de fichiers (pièces, médias, exports, paquets), et part du quota de l'environnement. Alerte technique à 80 %. | — |
| Boîte d'envoi | Événements en attente, ancienneté du plus vieux, événements en échec ou mis de côté (FIA-040), avec leur erreur. | Rejouer un événement. |
| Règles | Exécutions en échec des 7 derniers jours. | Ouvrir la règle. |
| E-mails | Sur 24 heures : envoyés, remis, rejetés, en échec ; taux de rejet. | — |
| Erreurs | Les 50 dernières erreurs du serveur : date, route, identifiant de requête (TRV-111). | — |
| Contrôle des caches | Résultat du dernier contrôle nocturne (AUT-090). | — |

## 8. Imports et exports (EA-103)

**ADM-085** `[P1]` Deux listes. **Imports** : type, fichier, auteur, date, état, lignes lues, créées, mises à jour, signalées, en erreur ; le rapport des erreurs et des signalements se télécharge. **Exports** : type, filtres appliqués, auteur, date, nombre de lignes, état, téléchargé ou non. Un export ne se télécharge que par son auteur, tant qu'il n'a pas expiré — sauf l'export des données d'une personne, remis à cette personne (ADM-063). Vide : « Aucun import. » · « Aucun export. »
