# Espace client — messagerie et notifications

Écrans **EC-30** (messages) et **EC-31** (notifications). Côté équipe : `04-back-office/08`. Modèle : `Conversation`, `Message`, `MessageAttachment`, `Notification` (`01-domaine/05`). Règles d'envoi des e-mails associés : NOT-017, NOT-030.

---

## 1. Messagerie (EC-30)

**MSG-001** `[P1]` La messagerie est l'**échange écrit entre le client et son conseiller**, avec tout son historique. Un fil par dossier (« Dossier {référence} – {bien} ») et un fil général (« Mes échanges avec Diaspora Patrimoine ») pour ce qui ne relève d'aucun dossier. Un fil est créé au premier message, d'un côté ou de l'autre (`POST /conversations`, qui rend le fil existant s'il y en a déjà un) ; tant que le dossier n'a pas de bien, son fil s'appelle « Dossier {référence} ». **Écrire sans fil** (MSG-019) : le message va au fil du dossier montré par le tableau de bord (ECL-014) s'il est ouvert ou en pause, sinon au fil général ; une liste « À propos de » (les dossiers ouverts ou en pause · « Autre sujet ») permet de changer avant d'envoyer. Le client peut toujours ouvrir le fil général, même quand ses dossiers ont le leur. Côté équipe, le premier message s'écrit depuis l'onglet Échanges du dossier (PIP-022) ou, pour le fil général, depuis la fiche du client.

**MSG-002** `[P1]` **Un seul fil** : la page l'ouvre directement. **Plusieurs** : une liste à gauche (titre, extrait du dernier message sur deux lignes, date relative, pastille des non-lus), le fil à droite ; sur téléphone, la liste puis le fil.

**MSG-003** `[P1]` **Qui répond.** Le conseiller du dossier. Sans conseiller affecté, dans le fil général d'un client sans conseiller, ou quand le conseiller ne peut plus répondre (compte suspendu ou supprimé, NOT-018) : l'équipe ; l'en-tête du fil indique alors « L'équipe Diaspora Patrimoine », et le message est notifié aux administrateurs. Un message n'arrive jamais dans une boîte que personne ne lit. Côté client, chaque message de l'équipe est signé du prénom et de l'initiale de son auteur (TRV-145).

**MSG-004** `[P1]` **En-tête du fil** : le conseiller (photo, nom), et le délai de réponse attendu : « {conseiller} vous répond {n, plural, one {sous un jour ouvré} other {sous # jours ouvrés}}. » ({n} = `sla.messageReplyBusinessDays`). Hors des heures de travail (CAL-060) : « Nous sommes fermés en ce moment. Votre message sera lu {jour d'ouverture suivant} à partir de {heure}, heure de {ville}. » — le jour et l'heure de la prochaine ouverture sont convertis dans le fuseau du client (TRV-031), et {ville} est la ville de ce fuseau (« Paris » pour `Europe/Paris`, « Montréal » pour `America/Montreal`) : le client lit l'heure de chez lui, sans calcul.

**MSG-010** `[P1]` **Écrire.**
- texte brut, 4 000 caractères au plus ; les retours à la ligne sont gardés ; les adresses web deviennent des liens (TRV-140) ; aucun HTML n'est interprété ;
- **Entrée** va à la ligne ; le bouton « Envoyer » ou **Ctrl + Entrée** envoie ;
- jusqu'à **cinq fichiers** par message, aux formats et tailles des pièces (DOS-011) ; un message peut ne contenir que des fichiers ;
- un message vide et sans fichier ne part pas ;
- le brouillon en cours est gardé par fil dans le stockage de session.

**MSG-011** `[P1]` **Envoi.** Le message apparaît tout de suite dans le fil, marqué « Envoi… », puis « Envoyé ». En cas d'échec : « Non envoyé » et « Réessayer » ; le texte n'est jamais perdu. Une clé d'idempotence empêche le double envoi (TRV-091). Limite : 30 messages par 10 minutes.

**MSG-012** `[P1]` **Messages automatiques.** Ces événements, et eux seuls, s'inscrivent dans le fil, centrés et discrets, sans auteur (`senderType = SYSTEM`) : « Votre pièce {libellé} a été validée. » (`document.validated`, pièce fournie par le client) · « {conseiller} suit désormais votre dossier. » (`dossier.assigned`) · « Votre dossier est complet. » (`dossier.completed`) · « Votre dossier a été envoyé à {banque}. » (`submission.submitted`) · « Rendez-vous confirmé le {date}. » (`appointment.confirmed`, `appointment.rescheduled`, si le client en est informé) · « Classé dans la pièce {libellé}. » (classement d'une pièce jointe, MSG-013). Ils s'écrivent dans le fil du dossier — le classement, dans le fil du message —, qu'ils créent s'il n'existe pas, même pour un client sans espace actif ; ils avancent `lastMessageAt` (le fil remonte dans les listes) sans changer `lastMessagePreview` ; ils émettent `message.created` vers l'écran (API-070), mais pas l'événement `message.sent`. Ils ne comptent pas comme non lus et n'envoient pas d'e-mail « nouveau message ». Ils ne comptent pas non plus comme une **réponse** : un fil où le client a posé une question reste « à répondre » pour l'équipe, même si un message automatique s'y est inscrit depuis (AUT-020).

**MSG-013** `[P1]` **Fichiers joints.** Chaque fichier affiche son nom, sa taille et, pour une image, une vignette. Il n'est consultable qu'après son contrôle de sécurité : d'ici là, « Vérification en cours » ; s'il est refusé : « Fichier refusé pour des raisons de sécurité. ». Si le conseiller classe un fichier dans une pièce du dossier, le fil le signale : « Classé dans la pièce {libellé}. » (DOS-015).

**MSG-014** `[P1]` **Lecture.** Les messages de l'équipe sont marqués lus quand le fil est affiché, page au premier plan, pendant au moins une seconde. Sous le **dernier** message du client, une fois lu par l'équipe : « Lu ».

**MSG-015** `[P1]` **Supprimer.** Le client peut supprimer un de ses messages dans les 5 minutes qui suivent l'envoi ; le fil garde la trace « Message supprimé » (MOD-401) ; au-delà, le serveur refuse (raison `MESSAGE_DELETE_EXPIRED`). Un message ne se modifie pas. Effets d'une suppression : la ligne garde `deletedAt` et la trace ; son texte et ses fichiers sont effacés au bout de 30 jours, la ligne reste (AUT-091) ; s'il n'était pas lu, les non-lus du fil et le compteur de la notification diminuent, et la notification disparaît à zéro ; l'e-mail « nouveau message » ne part que si un message non supprimé reste non lu (NOT-017) ; `awaitingStaffReply` est recalculé. Une copie déjà classée dans une pièce (GED-050) reste. La même règle vaut pour un membre de l'équipe et son propre message.

**MSG-016** `[P1]` **Historique.** Les 30 derniers messages à l'ouverture ; les précédents se chargent en remontant. Des séparateurs de date (« Aujourd'hui », « Hier », « 12 octobre 2026 »). Un nouveau message reçu pendant la lecture d'anciens messages n'emporte pas l'écran : un bouton « Nouveau message ↓ » apparaît.

**MSG-017** `[P1]` **Messages préremplis.** Certaines actions ouvrent la messagerie avec un début de message, que le client complète et envoie lui-même : « Au sujet de {bien} (réf. {référence}) : » (INT-004) · « Je souhaite reprendre mon projet. » (ECL-022). Rien ne part sans son clic sur « Envoyer ».

**MSG-018** `[P1]` **Dossier clôturé ou gagné** : le fil reste lisible et ouvert à l'écriture ; les messages arrivent à l'ancien conseiller du dossier s'il est toujours en poste, sinon aux administrateurs (MSG-003). Le suivi des messages sans réponse continue de courir sur un dossier clos (AUT-007) : quelqu'un qui écrit « je voudrais relancer mon projet » reçoit une réponse.

**MSG-019** `[P1]` **Aucun message** : « Une question ? Écrivez-nous ici : {conseiller} vous répond sous un jour ouvré. ». Le délai et sa forme plurielle sont ceux de MSG-004 ; écrire depuis cet état : MSG-001.

**MSG-020** `[P1]` La messagerie n'est **pas** un canal d'urgence ni de validation : aucune décision (acceptation d'une offre, choix d'un bien) ne se prend par un simple message. Ces actions ont leurs boutons (INT-030, DOS-052), tracés.

**MSG-021** `[P1]` **Écrire à mon conseiller, avant la messagerie.** L'espace client est livré avant la messagerie (`08-tracabilite/02`, § 4). D'ici là, l'adresse `/espace-client/messages` et tous les boutons qui y mènent (« Écrire », « Reprendre mon projet », « Au sujet de ce bien », « En parler à mon conseiller », boutons des e-mails) ouvrent un **formulaire court** :

> « Écrire à {conseiller} » (sans conseiller : « Écrire à l'équipe »)
> Votre message (10 à 2 000 caractères, prérempli quand le bouton d'origine le prévoit) — **Envoyer**
> « {conseiller} vous répond sous 48 h ouvrées, par e-mail ou par téléphone. » — le délai suit `sla.firstContactBusinessDays`, avec les mots de NOT-053 : la même promesse que pour toute demande (CAL-061).

L'envoi (`POST /client/leads`) enregistre une demande de nature `CONTACT_MESSAGE`, affectée au conseiller du dossier quand il en a un, objet « Mon dossier » quand elle porte un dossier (sinon « Autre », voir « Données de la demande »), rattachée au client et qui **porte** son dossier sans y changer quoi que ce soit (CYC-002) — sur un dossier en pause ou clôturé, c'est cette demande, avec son échéance, qui porte la reprise : elle arrive dans « Demandes » chez le conseiller (ou chez l'équipe), avec son échéance de premier contact et la mention « Écrit depuis le dossier {référence} », qui y mène, et le client la retrouve dans « Mes demandes » (INT-001) avec son état. Confirmation : « Votre message est envoyé à {conseiller}. ». Le jour où la messagerie est livrée, la même adresse ouvre le fil ; les messages envoyés par ce formulaire restent dans l'historique des demandes. Ce formulaire est aussi le repli des fonctions `[P1]` inactives qui passent par un message (ECL-006).

À côté du formulaire (D-099) : « Comment ça se passe » en trois temps — « Vous écrivez votre message, à votre rythme. Rien ne part avant « Envoyer ». » · « {conseiller} le reçoit et vous répond {quand}, par e-mail ou par téléphone. » · « Vous retrouvez votre demande et sa suite dans « Mes demandes ». » —, les autres moyens renseignés (`contact.phone`, `contact.whatsapp`) et les trois dernières demandes en cours, chacune menant à sa ligne de « Mes demandes » ; chacune montre le début du message écrit (deux lignes), et la liste se met à jour dès l'envoi. Dans « Mes demandes », chaque demande montre le message tel qu'il a été écrit (D-107).

**Données de la demande** (`POST /client/leads`). Limite : celle des messages (SEC-070 : 30 par compte et par 10 minutes), pas celle des formulaires publics (DEM-032). `Lead.payload` : `{"form": "CLIENT_SPACE_MESSAGE", "formVersion": 1, "fields": {"message": "…", "prefilledFrom": "…"}, "context": {"dossierReference": "…"}}` — `prefilledFrom` nomme le bouton d'origine, `null` sans préremplissage ; `dossierReference` est `null` sans dossier. Coordonnées de la demande (`firstName`, `lastName`, `email`, `phone`) : celles de la fiche, recopiées à l'envoi. `subject` = `DOSSIER` si la demande porte un dossier (`contextDossierId`), `OTHER` sinon. Aucune case de consentement, aucune ligne `Consent` : le client écrit depuis son espace.

## 2. Notifications (EC-31)

**MSG-040** `[P1]` **La cloche**, dans la barre du haut, porte le nombre de notifications non lues (« 99+ » au-delà). Un clic ouvre les **dix dernières** : une icône selon la destination de son lien (colonne « Lien » de NOT-030 : pièce, dossier, financement, message, rendez-vous, bien, Café ; à défaut, une cloche), le texte, la date relative ; les non lues sont mises en valeur. En pied : « Tout marquer comme lu » · « Tout voir ».

**MSG-041** `[P1]` **Page « Notifications »** (`/espace-client/notifications`) : toutes les notifications des `retention.notificationDays` derniers jours (180), vingt par page, avec le filtre « Non lues ». Catalogue des notifications et de leurs liens : NOT-030.

**MSG-042** `[P1]` Cliquer une notification mène à son objet et la marque lue. Ouvrir l'objet par un autre chemin marque lues les notifications qui le concernent (NOT-032). Si l'objet n'existe plus : NOT-033.

**MSG-043** `[P1]` **En direct.** Une notification qui arrive pendant que le client est dans son espace fait apparaître, 8 secondes (TRV-081), un message bref en bas de l'écran, cliquable ; le compteur de la cloche augmente. Si la page affichée est justement l'objet de la notification (le fil ouvert, la liste des pièces), elle se met à jour et la notification est marquée lue.

**MSG-044** `[P1]` **Aucune notification** : « Aucune notification pour le moment. ».

**MSG-045** `[P1]` Le lien « Gérer mes préférences » mène au réglage des e-mails (PRO-030). Les notifications dans l'application ne se désactivent pas (NOT-021).

**MSG-046** `[P1]` **Avant la livraison de cet écran**, les notifications existent déjà — chaque module crée les siennes dès sa livraison — et se lisent dans le bloc « Dernières nouvelles » du tableau de bord, vers lequel mène la cloche (ECL-002, ECL-010). Aucune notification n'attend la page pour être vue.
