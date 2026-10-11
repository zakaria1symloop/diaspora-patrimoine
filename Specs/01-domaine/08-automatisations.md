# Automatisations

Ce fichier décrit tout ce que la plateforme fait **sans qu'un utilisateur clique** : ce qui part après un événement, les relances, les tâches créées pour le personnel, les surveillances périodiques et les purges.

Il complète deux autres fichiers :
- `06-cycles-de-vie.md` dit **quand** un objet change d'état ;
- `09-notifications-et-emails.md` dit **quel message** part, à qui, avec quel texte.

---

## 1. Principes

**AUT-001** `[P1]` **Trois mécanismes, sans recouvrement** (D-044). Chaque effet automatique appartient à un seul d'entre eux.

| Mécanisme | Ce qu'il fait | Réglable dans le back-office ? |
|---|---|---|
| **Effets système** | Tout ce qui fait partie d'une transition : changement d'état, recalcul des caches, notifications dans l'application, **e-mails d'événement** (« Votre pièce a été rejetée », « Financement accordé »), e-mails de compte et de sécurité. | Le texte des modèles, et leur activation (sauf modèles système). Pas le déclenchement. |
| **Règles d'automatisation** (`WorkflowRule`) | Ce qui **relance** ou **fait agir** : relances au client, tâches créées pour le personnel, alertes internes, suivis différés. | Oui : activer, désactiver, changer le délai, les conditions, le modèle ; créer de nouvelles règles. |
| **Tâches planifiées** | Surveillances périodiques (échéances, expirations), calculs de fond, purges. | Leurs seuils sont des paramètres. |

**AUT-002** `[P1]` Tout part d'un **événement de domaine** écrit dans la boîte d'envoi (`OutboxEvent`) dans la même transaction que le changement (`06-technique/04`, FIA-040). Une transition n'appelle jamais directement le service d'e-mail, ni la création de tâches.

**AUT-003** `[P1]` Traitement d'un événement, dans cet ordre : (1) effets système ; (2) notifications et e-mails d'événement (NOT-030, NOT-040) ; (3) règles d'automatisation dont le déclencheur est cet événement. Les trois sont **indépendants** : l'échec de l'un n'empêche pas les autres. L'événement n'est marqué traité (`processedAt`) que quand les trois ont réussi ; sinon, c'est l'**événement entier** qui est réessayé (FIA-040), et les groupes déjà réussis, rappelés, ne refont rien, parce que chacun de leurs effets porte sa clé (AUT-005, NOT-011). `lastError` nomme le groupe en échec.

**AUT-004** `[P1]` **Exécution d'une règle.**
1. À l'arrivée de l'événement, pour chaque règle active qui a ce déclencheur : les conditions sont évaluées sur l'état courant. Si elles sont fausses, rien n'est enregistré.
2. Si elles sont vraies : une ligne `WorkflowExecution` est créée à l'état `PENDING`, avec `scheduledFor` = date de l'événement + délai de la règle. Le délai est un nombre et une **unité** (`delayValue`, `delayUnit`) : `MINUTES`, `HOURS` et `DAYS` se comptent au calendrier ; `BUSINESS_HOURS` par `ajouterMinutesOuvrées` (60 minutes ouvrées par heure) ; `BUSINESS_DAYS` par `ajouterJoursOuvrés` (CAL-060). « 3 jours ouvrés » n'a donc qu'un sens. Une règle à délai 0 crée sa ligne et l'exécute aussitôt, dans le traitement de l'événement (étape 3 de AUT-003) ; `workflow.execute` ne prend que les exécutions différées et les nouveaux essais.
3. À `scheduledFor` : l'objet est **relu**, les conditions sont **réévaluées**, les conditions d'arrêt sont vérifiées (AUT-007). Si quelque chose ne tient plus : état `SKIPPED` avec la raison. Sinon les actions s'exécutent dans l'ordre et l'état passe à `DONE`.
4. Une action qui échoue est rejouée trois fois (après 1 minute, 10 minutes, 1 heure). Après le troisième échec : état `FAILED`, erreur enregistrée, alerte au support (AUT-076). Les actions déjà faites ne sont pas refaites : l'exécution compte ses essais (`attempts`), date le suivant (`nextAttemptAt`) et retient les actions terminées (`actionsDone`).
5. Une exécution en attente suit la règle **telle qu'elle est au moment d'agir** : si la règle **est** désactivée ou supprimée à ce moment-là, l'exécution passe `SKIPPED` (« Règle désactivée ») — désactivée puis réactivée avant l'échéance, elle s'exécute ; si elle a été modifiée, ce sont ses nouvelles conditions et ses nouvelles actions qui valent, mais pas son nouveau délai : la date d'une exécution en attente (`scheduledFor`) ne bouge pas. Supprimer une règle créée dans le back-office est une suppression logique : son journal reste lisible.

**AUT-005** `[P1]` **Rien ne part deux fois.** Une règle ne s'exécute qu'une fois par événement (unicité `ruleId` + `triggerEventId`). Chaque action porte en plus sa propre clé : `Communication.dedupeKey` pour un e-mail, `Task.dedupeKey` pour une tâche, `Notification.dedupeKey` pour une notification. **Pas de boucle** : un événement produit par l'action d'une règle (une tâche créée, par exemple) ne déclenche aucune règle.

**AUT-006** `[P1]` **Heures calmes.** Une **relance** envoyée à un client par une règle (action `SEND_EMAIL` avec `respectQuietHours`, vrai par défaut) ne part qu'entre 8 h et 20 h dans le fuseau du destinataire (`Client.timezone`, à défaut celui du calendrier de travail). En dehors, elle attend 8 h. Paramètre : `mail.quietHours` = `{"start": "20:00", "end": "08:00"}`. Les e-mails d'événement et les e-mails de compte partent tout de suite, à toute heure.

**AUT-007** `[P1]` **Conditions d'arrêt.** Avant toute action qui s'adresse à un client, dans cet ordre :

| Situation | Effet |
|---|---|
| Données du client effacées (`gdprErasedAt`), traitement limité (`restrictedAt`), ou compte `DELETED` ou `SUSPENDED` | Rien ne part. Seules exceptions : les e-mails qui **répondent à la démarche de la personne** — accusé d'une demande d'exercice de droits, confirmation de suppression (`C_ACCOUNT_DELETED`, mis en file **avant** l'effacement de l'adresse), accusé d'une nouvelle demande (CYC-009). Pour un traitement limité **à la demande de la personne** (`restrictionReason = REQUEST`, compte actif), les e-mails de compte et de sécurité (modèles système : lien de connexion, réinitialisation, code d'action, alerte de connexion) partent aussi : elle doit pouvoir entrer dans son espace et y exercer ses droits (ADM-063). Pour une personne effacée ou dont le traitement est limité, les règles de **relance commerciale** — demande non prise, délai de premier contact, propositions sans réponse, dossier inactif — ne créent pas non plus de tâche ni d'alerte pour l'équipe. Ce qui protège la personne ou tient un engagement envers elle continue : l'accueil d'une nouvelle demande (CYC-009), sa demande de droits, un acompte à suivre (CYC-108), un accord retiré (GED-071), un message d'elle resté sans réponse. |
| Demande à l'état `SPAM` | Rien ne part pour cette demande. |
| Client sans adresse e-mail (MOD-302) | Aucun e-mail. Un e-mail de service est remplacé par une tâche pour le conseiller (NOT-025) ; les autres sont omis. |
| `Client.emailBouncedAt` renseigné | Aucun e-mail automatique, **sauf** les e-mails de compte et de sécurité (modèles système) — une adresse rejetée une fois ne doit pas enfermer la personne dehors (NOT-014) — et l'accusé de réception d'une **nouvelle demande**, qui part à l'adresse que la personne vient de saisir (TRV-097) : c'est aussi ce qui lève la marque si l'adresse est redevenue bonne (AUT-071). Les notifications dans l'application restent. |
| Modèle d'e-mail inactif | L'action est ignorée, avec la raison « Modèle désactivé ». |
| Rendez-vous créé sans informer le client (`clientNotifiedAt` nul, CYC-080) | Aucun e-mail au client au sujet de ce rendez-vous — ni rappel, ni annulation. Les notifications dans l'application, pour lui comme pour l'équipe, et les tâches restent : le rendez-vous figure dans son espace (TAC-040). |
| `Client.doNotContact` vrai | Seuls partent : les e-mails **de service** (modèle sans `preferenceGroup`) liés à un dossier `OPEN` ou `ON_HOLD` ; les e-mails de compte et de sécurité (modèles système) ; ceux qui répondent à une démarche de la personne (accusé d'une demande, d'un exercice de droits). « Ne pas contacter » n'enferme personne hors de son espace. |
| Groupe de préférences désactivé par le destinataire (NOT-020) | L'e-mail ne part pas ; la notification dans l'application reste. |
| Dossier `ON_HOLD` | Les relances **qui poussent le client à avancer** sont ignorées (« Dossier en pause ») : relances de pièces, de pièces à renouveler, de propositions, d'accord de transmission (`skipWhenOnHold`, AUT-031) ; une enquête due pendant la pause est reportée à la reprise (AUT-065). Ce qui **court malgré la pause** part : rappel d'une option, d'une offre, d'un rendez-vous ; e-mails d'événement, dont les décisions des banques (CYC-034). Les tâches internes sont créées. |
| Dossier `WON` ou `LOST` | Tout ce qui se rattache au dossier est ignoré, sauf : les règles déclenchées par la clôture elle-même ; les enquêtes (AUT-065) — celle de l'acquisition porte justement sur un dossier gagné ; le suivi d'un acompte à rembourser (CYC-108) ; et ce qui suit un **message du client** (`message.sent`) — quelqu'un qui écrit sur un dossier clos doit recevoir une réponse (MSG-018). |

Un e-mail écarté par l'une de ces conditions laisse une ligne `Communication` à l'état `SUPPRESSED`, rattachée comme l'aurait été l'e-mail, sans corps, avec la raison dans `failureReason` (« Groupe désactivé », « Adresse en erreur », « Pas d'adresse », « Modèle désactivé »…) : c'est elle que montrent la chronologie et le journal des envois, pour un e-mail d'événement comme pour une relance. Rien n'est écrit pour une personne dont les données sont effacées.

**AUT-008** `[P1]` **Plafond.** Un client ne reçoit pas plus de `mail.maxRemindersPerDay` (2) relances automatiques par jour, tous dossiers confondus. Les suivantes sont **reportées** au lendemain 8 h, pas supprimées. Les e-mails d'événement ne comptent pas. Les trois rappels d'**échéance** — option, offre, rendez-vous — ne comptent pas non plus et ne sont jamais reportés : un rappel qui arrive après la date n'a plus de sens.

**AUT-009** `[P1]` **Traçabilité.** Toute action automatique apparaît dans la chronologie de l'objet avec l'auteur « Automatique » et le nom de la règle. L'écran d'une règle montre ses dernières exécutions, avec leur état et leur raison (`04-back-office/08`).

---

## 2. Déclencheurs

**AUT-010** `[P1]` Liste des événements de domaine. C'est aussi la liste des valeurs possibles de `OutboxEvent.type` et de `WorkflowRule.trigger`. Le signe ⏱ marque un événement **émis par une surveillance périodique** (AUT-012) et non par une action.

### 2.1 Demandes et clients

| Événement | Émis quand | Données |
|---|---|---|
| `lead.created` | Une demande est enregistrée (CYC-001). | `kind`, `source`, `propertyId`, `attachment` : `OPENED_DOSSIER`, `JOINED_DOSSIER`, `PENDING_DECISION`, `NONE` ; `ongoingDossierId` (avec `PENDING_DECISION` : le dossier en cours, que les règles lisent comme l'objet `dossier`) |
| `lead.attached` | Une demande rejoint un dossier existant, à la création ou plus tard. | `dossierId` |
| `lead.taken` | Prise en charge ou affectation (CYC-003). | `agentId`, `previousAgentId` |
| `lead.released`, `lead.reopened` | Demande rendue, demande rouverte (CYC-008). | `previousAgentId` |
| `lead.supplemented` | Un second envoi identique complète la demande (DEM-024) : l'accusé de réception repart (TRV-097). | `changedFields` |
| `lead.first_contact` | Premier contact noté (CYC-004). | `channel` |
| `lead.closed` | Clôture (CYC-005). | `outcome` |
| `lead.marked_spam`, `lead.restored` | CYC-006. | |
| `lead.application_submitted` | Un candidat partenaire envoie son dossier pour examen (ACP-087). | `partnerKind`, `companyName` |
| `lead.application_info_requested` | L'équipe demande un complément à une candidature (ACP-084). | `partnerKind`, `companyName`, `note` |
| `lead.application_approved` | Candidature acceptée : fiche du partenaire créée ou rattachée (ACP-084). | `partnerKind`, `companyName`, `promoterId` ou `bankId` |
| `lead.application_declined` | Candidature refusée (ACP-084). | `partnerKind`, `companyName`, `note` (vide si rien n'est écrit pour la personne) |
| `lead.sla_warning` ⏱ | Il reste un jour ouvré ou moins avant `slaDueAt`, sans premier contact. | `slaDueAt` |
| `lead.sla_breached` ⏱ | `slaDueAt` est passé sans premier contact (CYC-007). | `slaDueAt` |
| `client.created` | Fiche créée (demande, inscription, saisie interne, import). | `source` |
| `client.updated` | Champs de la fiche modifiés. | `changedFields` |
| `client.qualified` | CYC-021. | |
| `client.merged` | Fusion de deux fiches (CRM-080). | `mergedClientId` |
| `client.archived`, `client.unarchived` | CYC-061. | |
| `client.account_created` | Inscription avec mot de passe. | |
| `client.account_invited` | Compte créé à l'état `INVITED` (CYC-200). | `reason` |
| `client.account_activated` | Activation, ou e-mail vérifié. | |
| `client.email_bounced` | Rejet définitif d'un e-mail (AUT-071). | `address` |
| `consent.changed` | Un consentement `DATA_SHARING_PARTNERS` ou `MARKETING_EMAIL` est donné ou retiré (MOD-106). | `type`, `granted`, `by` : `CLIENT` ou `STAFF`, `dossierId` |
| `communication.call_logged` | Un appel est noté. | `direction`, `callOutcome`, `leadId`, `dossierId` |
| `communication.email_sent` | Un e-mail **manuel** est envoyé à un client. | `templateCode` |

### 2.2 Dossier, rapprochement, réservation

| Événement | Émis quand | Données |
|---|---|---|
| `dossier.opened` | Création d'un dossier. | `originLeadId` |
| `dossier.assigned` | Changement de conseiller (CYC-040). | `agentId`, `previousAgentId`, `notifyClient` |
| `dossier.stage_changed` | Changement d'étape. | `fromStage`, `toStage`, `isBackward` |
| `dossier.put_on_hold`, `dossier.resumed` | CYC-031, CYC-032. | `holdReason`, `holdUntil` |
| `dossier.hold_ended` ⏱ | Le jour de `holdUntil`, à 9 h (CYC-033). | |
| `dossier.activity_on_hold` | Il se passe quelque chose sur un dossier en pause : le client dépose une pièce, écrit, répond à une proposition ; une banque décide ou demande un complément (CYC-034). | `what` |
| `dossier.financing_mode_changed` | Passage avec ou sans financement (CYC-041). | `financingRequested` |
| `dossier.completed` | Le dossier devient complet pour la première fois (CYC-147). | |
| `dossier.all_banks_declined` | CYC-029. | |
| `dossier.won` | CYC-027. | `saleAmount`, `saleCurrency` |
| `dossier.lost` | CYC-035. | `lostReason`, `notifyClient` |
| `dossier.reopened` | CYC-036. | |
| `dossier.inactive` ⏱ | Aucune activité depuis `dossier.inactivityDays` jours (CYC-039). | `days` |
| `dossier.sla_breached` ⏱ | `slaDueAt` de l'étape est passé (CAL-062). | `stage` |
| `candidate.proposed` | Des biens sont envoyés au client (`sentAt`). **Un seul événement par envoi**, quel que soit le nombre de biens (PIP-031). | `candidateIds`, `isFirstOfDossier` |
| `candidate.viewed`, `candidate.interested`, `candidate.declined` | CYC-070. | `by` : `CLIENT` ou `STAFF`, `declineReason` |
| `candidate.selection_requested` | Le client clique « Je retiens ce bien ». | |
| `candidate.selection_declined` | Le conseiller refuse le choix demandé (CYC-071). | |
| `candidate.selected` | Le bien est retenu (CYC-071). | |
| `candidate.unselected` | Le conseiller retire le choix (CYC-242). | |
| `candidate.unavailable` | CYC-073. | `wasSelected`, `hasUpcomingVisit`, `upcomingAppointmentId` |
| `reservation.option_placed`, `reservation.option_extended` | CYC-105. | `lotId`, `optionExpiresAt`, `acknowledged`, `accessLevel` (niveau d'accès du promoteur) |
| `reservation.option_acknowledged`, `reservation.option_refused` | Le promoteur dit qu'il tient le lot, ou refuse l'option (CYC-107). Un refus émet aussi `reservation.cancelled`. | `route`, `refusalReason`, `lotOutcome` |
| `reservation.released` | Une option que le promoteur avait confirmée, ou une réservation, prend fin sans vente : il faut le libérer (ACP-023). Il n'est pas émis quand c'est le promoteur qui a repris le lot (CYC-107). | `lotId`, `accessLevel` |
| `reservation.option_expiring` ⏱ | Deux jours avant `optionExpiresAt`. | |
| `reservation.confirmed`, `reservation.cancelled`, `reservation.expired`, `reservation.completed` | CYC-105. Une réservation créée directement n'émet que `reservation.confirmed` (CYC-106). | `notifyClient`, `cancelReason`, `dossierStage`, `wasOption` (c'était une option, pas une réservation confirmée), `lotOutcome` (ce qu'est devenu le lot, quand le promoteur l'a repris) |
| `reservation.deposit_refund_due`, `reservation.deposit_settled` | Un acompte est à rembourser ; son issue est enregistrée (CYC-108). | `depositAmount`, `depositCurrency`, `refundStatus` |
| `appointment.requested`, `appointment.confirmed`, `appointment.rescheduled`, `appointment.cancelled`, `appointment.done`, `appointment.no_show` | CYC-080. | `type`, `cancelledBy`, `hadHost` (une personne du promoteur devait accueillir le visiteur), `accessLevel` (niveau d'accès de ce promoteur) |
| `appointment.upcoming` ⏱ | 24 heures avant `startsAt`, si le rendez-vous a été confirmé plus de 24 heures avant. | |
| `appointment.outcome_missing` ⏱ | Deux jours ouvrés après `endsAt`, rendez-vous encore `CONFIRMED`. | |

### 2.3 Pièces et financement

| Événement | Émis quand | Données |
|---|---|---|
| `document.requested` | Des pièces sont demandées au client : création de la liste du dossier, ajout d'une pièce, pièces de la liste d'une banque créées en préparant une soumission (MOD-360), pièce redemandée (CYC-149). Un seul événement par opération. Le **complément** demandé par une banque n'émet pas cet événement : il est annoncé par `submission.info_requested`. | `documentIds`, `source`, `bankId`, `notifyClient` (faux : « Ne pas prévenir le client », GED-035 — ni notification ni e-mail) |
| `dossier.checklist_reevaluated` | La liste de pièces est réévaluée (GED-031) — ou le serait, pour un changement fait par le client à `BANK_REVIEW` ou au-delà. | `added`, `removed`, `by` : `CLIENT` ou `STAFF`, `applied` (faux : rien n'a été appliqué, GED-031) |
| `document.received` | Dépôt réussi (CYC-140). | `documentId`, `by` : `CLIENT` ou `STAFF` |
| `document.validated`, `document.rejected`, `document.waived` | CYC-142, CYC-143, CYC-146. | `rejectionReason`, `isRenewal` (la décision porte sur un renouvellement, CYC-141) |
| `document.validation_reverted` | CYC-144. | |
| `document.expired` | CYC-145, ou « Redemander au client ». | `manual` (vrai : redemandée par le conseiller) |
| `document.expiring_soon` ⏱ | 15 jours avant `expiresAt` (`documents.expiryWarningDays`). | `expiresAt` |
| `document.reminder_due` ⏱ | Une relance de pièces est due pour un dossier (AUT-042), ou le conseiller relance maintenant (GED-060). | `documentIds`, `reminderNumber`, `manual` |
| `document.reminders_exhausted` ⏱ | Une pièce attendue a reçu toutes ses relances, sans dépôt (AUT-042, point 5) : un événement par pièce et par cycle de relances. | `documentIds` (cette pièce) |
| `document.file_infected` | Un fichier déposé est refusé par l'antivirus, ou les photos d'un dépôt n'ont pas pu être réunies (MED-032). | `by`, `versionDiscarded`, `cause` : `INFECTED` ou `UNREADABLE` |
| `document.version_deleted` | Une version est supprimée (CYC-149). | `wasCurrent` |
| `submission.created` | CYC-160. | `bankId` |
| `submission.submitted` | CYC-161. | `transmissionMode` |
| `submission.send_failed` | La génération du paquet a échoué à l'envoi ou à la transmission d'un complément : rien n'est parti (BNK-110). | `reason` : `FILE_UNAVAILABLE` (pièce sans fichier valide) ou `TECHNICAL`, `documentId` |
| `submission.under_review`, `submission.info_requested`, `submission.info_provided` | CYC-162, CYC-163. | |
| `submission.approved`, `submission.rejected`, `submission.withdrawn` | CYC-164, CYC-165, CYC-168. Les deux premiers sont émis à la **publication** de la décision, dix minutes après sa saisie (CYC-165). | `isFirstDecisionOfDossier` ; pour `submission.withdrawn`, `declinedByClient` (refus de l'offre par le client, CYC-166) |
| `submission.package_downloaded` | La banque télécharge le paquet. | `shareId` |
| `submission.decision_overdue` ⏱ | Décision attendue dépassée (AUT-041). | `expectedDecisionAt`, `followUpNumber`, `daysWaiting` |
| `submission.offer_expiring` ⏱ | Cinq jours avant `offerValidUntil`, offre non acceptée. | |
| `submission.offer_expired` | CYC-167. | |
| `submission.offer_accept_requested` | Le client clique « Je souhaite accepter cette offre ». | |
| `submission.offer_accept_withdrawn` | Le souhait du client est retiré : « Je ne suis plus sûr », ou souhait posé sur une autre offre, ou acceptation d'une autre offre (CYC-166). | |
| `submission.offer_unaccepted` | Une acceptation enregistrée est retirée (CYC-166). | |
| `submission.offer_accepted`, `submission.offer_declined` | CYC-166. | |
| `submission.offer_updated` | Un accord est corrigé, ou une offre prolongée (CYC-169). | `what` : `CORRECTED` ou `EXTENDED` |
| `submission.decision_reverted` | Une décision saisie par erreur est annulée (CYC-169). | `previousStatus`, `clientWasNotified` |
| `simulation.saved` | Une simulation est enregistrée. | `type`, `status` |
| `simulation.projection_sent` | Une projection est envoyée au client (BNK-080). | |

### 2.4 Messagerie, satisfaction

| Événement | Émis quand | Données |
|---|---|---|
| `message.sent` | Un message est envoyé dans un fil. | `senderType`, `conversationId` |
| `survey.invitation_created` | AUT-065. | `surveyCode`, `scheduledFor` |
| `feedback.received` | Réponse à une enquête, avis spontané, signalement. | `kind`, `npsScore`, `csatScore`, `surveyTrigger` |
| `feedback.handled` | Retour traité ou classé (CYC-225). | |

### 2.5 Catalogue et partenaires

| Événement | Émis quand | Données |
|---|---|---|
| `property.published` | CYC-120. | `isFirstPublication` |
| `property.unpublished`, `property.archived` | CYC-121, CYC-123. | |
| `property.availability_changed` | CYC-101. | `from`, `to`, `lotsAvailable` |
| `property.price_changed` | Le prix du bien change **dans sa devise** (`priceFrom`) : un lot change de prix, ou le lot le moins cher n'est plus le même. Un simple changement de cours de change ne l'émet pas. | `from`, `to`, `currency` |
| `program.published`, `program.unpublished`, `program.archived` | CYC-125, CYC-126. | |
| `program.update_published` | Nouveau point d'avancement du chantier. | `stage`, `percent` |
| `program.delivery_overdue` ⏱ | Date de livraison passée, statut non `DELIVERED` (AUT-074). | |
| `program.sold_out_review` ⏱ | Programme à l'état « Vendu », encore publié, 180 jours après sa dernière vente (`lastSoldAt`, CYC-127). | |
| `lot.status_changed` | CYC-100, CYC-105. | `from`, `to` |
| `lot.import_conflict` | Un import donne « Vendu », « Réservé » ou « Retiré » pour un lot qu'un dossier tient sous option ou a réservé (CTL-102). | `fileStatus`, `dossierId` |
| `promoter.status_changed`, `bank.status_changed` | CYC-240. | `from`, `to` |
| `partner.access_level_changed` | CYC-241. | `ownerType`, `from`, `to` |
| `partner.answer_received` `[P2]` `[P3]` | Un partenaire répond lui-même, par lien ou dans le portail (ACP-031). | `gesture`, `route`, `needsReview` |
| `partner.request_unanswered` ⏱ `[P2]` `[P3]` | Une demande envoyée par lien est restée sans réponse un jour ouvré après sa relance (ACP-045). | `gesture` |
| `partner.answer_applied`, `partner.answer_dismissed` `[P2]` `[P3]` | L'équipe applique ou écarte une réponse à relire. | `gesture` |
| `promoter.stock_check_due` ⏱ | Au moins un programme (ou un bien isolé) de ce promoteur a des disponibilités à vérifier, et aucune tâche de vérification n'est ouverte pour lui (AUT-079). | `programCount`, `accessLevel` |
| `program.stock_confirmed` | « Disponibilités vérifiées » (CTL-064), sur un programme ou sur un bien isolé. | `route`, `programId` ou, pour un bien isolé, `propertyId` |
| `bankproduct.check_due` ⏱ | Le barème d'un produit n'a pas été vérifié depuis `finance.productCheckDays` jours (AUT-079). | `ageDays`, `accessLevel` |
| `bankproduct.rates_confirmed` | « Barème vérifié » (BNK-024). | `route` |
| `partner.convention_expiring` ⏱ | 30 jours avant `conventionExpiresAt` (AUT-073). | `ownerType` |
| `partner.document_expiring` ⏱ | 30 jours avant `PartnerDocument.expiresAt`. | |
| `exchange_rate.created` | Nouveau cours saisi. | `fromCurrency`, `toCurrency` |
| `exchange_rate.voided` | Un cours est annulé (BNK-064). | `fromCurrency`, `toCurrency` |
| `exchange_rate.stale` ⏱ | AUT-072. Agrégat : le cours retenu (`ExchangeRate`). | `fromCurrency`, `toCurrency`, `asOf`, `ageDays` |

### 2.6 Le Café `[P1]`

| Événement | Émis quand | Données |
|---|---|---|
| `event.published`, `event.closed`, `event.cancelled`, `event.done` | CYC-180. | |
| `event.registration_opened` | Les inscriptions s'ouvrent : à la publication, ou à `registrationOpensAt`. | |
| `event.updated` | Date, heure ou lieu d'un Café publié modifiés (CYC-182). | `changedFields` |
| `event.upcoming` ⏱ | Sept jours avant, puis la veille à 10 h, heure du lieu. | `days` : 7 ou 1 |
| `event.followup_due` ⏱ | Le lendemain de la fin, à 10 h, heure du lieu. | |
| `event.checkin_missing` ⏱ | Deux jours ouvrés après la fin, aucun pointage. | |
| `registration.created`, `registration.waitlisted`, `registration.promoted`, `registration.cancelled`, `registration.attended`, `registration.no_show` | CYC-185. | `seats`, `cancelledBy` |

### 2.7 Comptes, données, plateforme

| Événement | Émis quand | Données |
|---|---|---|
| `user.invited`, `user.role_changed`, `user.suspended`, `user.reactivated`, `user.deleted`, `user.recovered` | ROL-012, CYC-200, ADM-040. | `role`, `previousRole` |
| `user.password_changed`, `user.two_factor_changed`, `user.email_changed` | `03-espace-client/01`. | |
| `user.new_device_login` | Connexion depuis un appareil jamais vu pour ce compte. | `deviceLabel` |
| `support.elevation_granted`, `support.elevation_ended` | ROL-016. | `until`, `reason` |
| `data_request.received`, `data_request.completed`, `data_request.rejected` | CYC-230. | `type`, `status` |
| `data_request.due_soon` ⏱ | Vingt jours après la réception, demande non close. | |
| `task.assigned` | Une **personne** confie une tâche à quelqu'un d'autre. Une tâche créée par une règle n'émet pas cet événement (AUT-032). | |
| `task.due` ⏱ | À l'heure de `remindAt`. Une tâche sans `remindAt` (rappel « Aucun », `NONE`, ou sans échéance hors `CUSTOM`) n'émet pas `task.due`. | |
| `import.finished`, `export.ready` | Fin d'un import ou d'un export. | `status` |
| `email.bounced`, `email.complained` | Statut reçu du fournisseur d'e-mail. | `communicationId` |
| `setting.changed` | Un paramètre est modifié. | `key` |
| `system.cache_drift` | AUT-090. | `entity`, `count` |
| `system.job_failed` | AUT-076. | `job` |

**AUT-011** `[P1]` **Forme commune** de `OutboxEvent.payload` :

```json
{
  "eventId": "0192…",
  "type": "document.rejected",
  "occurredAt": "2026-10-12T09:41:07Z",
  "actor": { "type": "USER", "id": "0191…" },
  "aggregate": { "type": "DossierDocument", "id": "0192…" },
  "clientId": "0190…",
  "dossierId": "0191…",
  "data": { "rejectionReason": "ILLEGIBLE" }
}
```

L'événement porte des **identifiants**, pas une copie des données : celui qui le traite relit l'objet. `clientId` et `dossierId` sont renseignés chaque fois qu'ils existent. Le `type` de `actor` est une valeur de `ActorType`. Un événement émis par l'action d'une règle porte en plus `causation`, avec le `ruleId` et l'`executionId` de l'exécution : l'étape 3 de AUT-003 l'ignore (pas de boucle, AUT-005) ; les effets système et les notifications s'appliquent normalement.

**AUT-012** `[P1]` **Événements ⏱.** Une tâche planifiée parcourt les objets concernés et dépose l'événement avec une clé `OutboxEvent.dedupeKey` qui identifie le **fait** : `lead.sla_breached:{leadId}`, `reservation.option_expiring:{reservationId}:{optionExpiresAt}`, `submission.decision_overdue:{submissionId}:{expectedDecisionAt}:{numéro}` (le numéro repart de 1 à chaque nouvelle échéance, AUT-041), `exchange_rate.stale:{from}:{to}:{asOf}:{semaine ISO}` (AUT-072). L'unicité de cette clé garantit qu'un même fait n'est signalé qu'une fois, même si la tâche tourne deux fois ou reprend après une panne. Une échéance modifiée (option prolongée) change la clé : le fait est signalé de nouveau, à bon droit. Clés des faits des dossiers et des pièces : `document.reminder_due:{dossierId}:{date du passage}` · `document.reminders_exhausted:{dossierId}:{documentId}:{reminderBaseAt}` · `document.expiring_soon:{documentId}:{expiresAt}` · `dossier.inactive:{dossierId}:{lastActivityAt}` · `dossier.sla_breached:{dossierId}:{stage}:{slaDueAt}` · `dossier.hold_ended:{dossierId}:{holdUntil}`. Une relance manuelle (GED-060) n'est pas un fait de surveillance : elle n'a pas de clé, et la clé d'idempotence de la requête l'empêche d'être doublée (API-040).

**AUT-013** `[P1]` **Événements techniques** (D-097). Quelques événements passent par la boîte d'envoi sans être des événements de domaine : ils portent un envoi ou un traitement à faire hors de la requête, avec les garanties de FIA-040 (même transaction que le changement, nouvel essai, aucune perte). Aucune règle d'automatisation ne s'y abonne et l'écran des règles ne les propose pas comme déclencheurs (COM-062) ; leurs envois sont des e-mails d'événement (AUT-006).

| Événement | Émis quand | Effet |
|---|---|---|
| `auth.email_requested` | Un e-mail de compte est demandé (`03-espace-client/01`) : vérification de l'adresse, activation, lien de connexion, mot de passe oublié, code de confirmation, changement d'adresse, nouvel appareil, invitation d'un membre du personnel, compte de partenaire. | Le modèle demandé part, avec un jeton produit au moment de l'envoi (NOT-010) ; les limites de SEC-070 sont contrôlées avant l'émission. |
| `alert.created` | Une alerte est créée sans compte : elle attend la confirmation de l'adresse (CAT-071). | `C_ALERT_CONFIRM`. |
| `alert.confirmation_requested` | La même alerte, encore non confirmée, est demandée de nouveau (CAT-072), ou « Recevoir un nouveau lien » est demandé pour elle (SFA-035). | `C_ALERT_CONFIRM` repart ; son lien vaut 7 jours à compter de ce nouvel envoi. |
| `alert.confirmed` | Une alerte devient active : adresse confirmée, ou alerte d'un client connecté (CAT-071). | Aucun envoi. |
| `alert.links_requested` | « Recevoir un nouveau lien » pour une adresse dont des alertes sont déjà confirmées (SFA-035). Un seul par adresse et par jour (clé `alert.links_requested:{alerte}:{date}`). | `C_ALERT_MANAGE` : le lien de gestion de chacune de ses alertes. |
| `preferences.link_requested` | « Recevoir un nouveau lien » sur la page des préférences (PRO-031). | `C_PREFERENCES_LINK`. |
| `registration.confirmation_requested` | Une inscription au Café déjà enregistrée est demandée de nouveau (CAF-024), ou un client connecté la modifie en s'inscrivant de nouveau (CYC-186). | La confirmation de l'inscription repart (`C_CAFE_REGISTERED` ou `C_CAFE_WAITLISTED`), avec son lien de gestion. |
| `document.version_created` | Une version de pièce est créée (API-081). | Le traitement de la file `documents` : copie vers les clés définitives, antivirus, assemblage des images (MED-032), puis l'issue de CYC-140. |
| `document.file_refused` | Ce traitement écarte un fichier déposé par le client (CYC-140) ; l'événement n'est disponible que deux minutes plus tard. | `C_FILE_REFUSED`, seulement si la notification `NC_FILE_REFUSED` écrite au même moment est encore non lue (NOT-032). |

---

## 3. Conditions

**AUT-020** `[P1]` **Conditions.** Celles d'une règle d'origine (§ 5 à § 7) sont livrées par les données de départ telles que les dit la colonne « Conditions » de leur tableau ; elles se modifient à l'écran comme celles d'une règle créée par l'équipe (COM-061, COM-062). Elles lisent l'état courant des objets (AUT-004), avec les champs et la résolution des objets ci-dessous. Un champ sans valeur rend sa condition fausse, sauf quand la condition porte sur son absence (« nul »). Une règle peut aussi lever, pour une exécution, les heures calmes et le plafond (AUT-006, AUT-008) : seule la relance manuelle de `R_DOC_REMINDER` le fait (`event.data.manual`). Forme : `WorkflowRule.conditions`, un groupe `all` (toutes vraies) ou `any` (au moins une vraie), dont chaque élément est une comparaison ou un groupe. Deux niveaux au plus.

```json
{
  "all": [
    { "field": "dossier.stage", "op": "in", "value": ["DOCUMENTS", "BANK_REVIEW"] },
    { "field": "client.countryOfResidence", "op": "eq", "value": "FR" },
    { "any": [
      { "field": "dossier.priority", "op": "eq", "value": "HIGH" },
      { "field": "client.score", "op": "gte", "value": 70 }
    ] }
  ]
}
```

Opérateurs : `eq`, `neq`, `in`, `nin`, `gt`, `gte`, `lt`, `lte`, `isNull`, `isNotNull`, `contains` (une liste contient la valeur).

Champs autorisés (liste fermée, validée à l'enregistrement de la règle) :

| Objet | Champs |
|---|---|
| `event` | `event.data.*` (les données de l'événement déclencheur) |
| `lead` | `kind`, `status`, `source`, `assignedAgentId`, `firstContactAt`, `propertyId` |
| `client` | `status`, `countryOfResidence`, `residencyStatus`, `score`, `hasAccount`, `accountStatus` (`NONE`, `INVITED`, `ACTIVE`, `SUSPENDED`), `hasEmail`, `marketingOptIn`, `preferredLanguage`, `assignedAgentId` |
| `dossier` | `stage`, `status`, `priority`, `financingRequested`, `financingType`, `propertyCountryCode`, `completenessPct`, `assignedAgentId`, `candidateCount`, `promoterId`, `firstContactAt`, `unopenedProposalCount` (biens proposés jamais ouverts : `PROPOSED`), `pendingProposalCount` (biens proposés sans réponse : `PROPOSED` ou `VIEWED`), `sharingConsentGranted` (l'accord de transmission du client est donné, GED-070) |
| `candidate` | `status`, `origin` |
| `document` | `status`, `category`, `providedBy`, `isRequired`, `source` |
| `submission` | `status`, `bankId`, `transmissionMode`, `financingType`, `downloadCount`, `acceptedByClientAt` |
| `reservation` | `status`, `contractDocumentId`, `optionAcknowledgedAt` |
| `appointment` | `type`, `status`, `startsAt`, `clientNotified` (le client a été informé du rendez-vous : `clientNotifiedAt` renseigné) |
| `event` (Café) | `cafe.status`, `cafe.seatsTaken`, `cafe.capacity`, `cafe.attendedSeats`, `cafe.fillPct` |
| `registration` | `status`, `seats`, `registeredAt` |
| `feedback` | `kind`, `npsScore`, `csatScore`, `category` |
| `conversation` | `awaitingStaffReply` (le dernier message **écrit par une personne** vient du client : les messages automatiques du fil, `SYSTEM`, ne comptent pas), `unreadByStaff` |
| `property` | `type`, `standing`, `availability`, `countryCode` |
| `user` | `status`, `emailVerifiedAt` |

Les objets disponibles dépendent du déclencheur : une règle sur `document.rejected` voit `document`, `dossier`, `client`.

**Résolution des objets**, pour les conditions, les champs dynamiques (AUT-036) et les personnes visées. Le moteur part de l'événement (AUT-011), puis suit les liens ; un objet qu'aucun lien n'atteint pour ce déclencheur n'est pas disponible ; la fonction de la règle ne le lit pas ; à l'exécution, un objet absent rend ses champs sans valeur.

| Objet | D'où il vient |
|---|---|
| L'objet de l'événement | `aggregate`, nommé d'après son modèle : `Lead` → `lead`, `Dossier` → `dossier`, `DossierCandidate` → `candidate`, `DossierDocument` → `document`, `BankSubmission` → `submission`, `Reservation` → `reservation`, `Appointment` → `appointment`, `EventRegistration` → `registration`, `Event` → `cafe`, `Feedback` → `feedback`, `Property` → `property`, `User` → `user`, `Promoter` → `promoter`, `Bank` → `bank`, `BankProduct` → `product`, `PartnerDocument` → `partnerDocument`, `Program` → `program`, `Lot` → `lot` |
| `client` | Le `clientId` de l'événement. |
| `dossier` | Le `dossierId` de l'événement ; pour `lead.created` avec `PENDING_DECISION`, le dossier en cours (`ongoingDossierId`). |
| `lead` | L'objet de l'événement, ou la demande que nomme `leadId` dans ses données. |
| `property` | Le bien de l'objet de l'événement (`Lead.propertyId`, `DossierCandidate.propertyId`, `Appointment.propertyId`, `Feedback.propertyId`, `Lot.propertyId`, le bien du lot d'une réservation) ; à défaut, le bien retenu du dossier (`Dossier.propertyId`). |
| `lot` | L'objet de l'événement ; sinon `Reservation.lotId` ; à défaut, le lot visé du dossier (`Dossier.lotId`). |
| `promoter` | L'objet de l'événement ; sinon le promoteur de `property`, à défaut celui de `program` ; pour `partnerDocument`, son partenaire s'il est un promoteur. |
| `bank` | L'objet de l'événement ; sinon `BankSubmission.bankId` ; à défaut, le `bankId` des données de l'événement ; pour `product`, la banque du produit (`BankProduct.bankId`) ; pour `partnerDocument`, son partenaire s'il est une banque. |
| `program` | L'objet de l'événement ; sinon le programme de `property` (`Property.programId` ; absent pour un bien isolé). |
| `partner` | Pour un événement de partenaire (convention, document de partenaire) : celui des deux, `promoter` ou `bank`, que la résolution ci-dessus atteint. |
| `appointment` | L'objet de l'événement ; pour `candidate.unavailable`, le rendez-vous `event.data.upcomingAppointmentId`. |
| `documents` (liste) | Les pièces de `event.data.documentIds` ; pour `document.expiring_soon`, les pièces du dossier fournies par le client qui expirent dans les `documents.expiryWarningDays` jours. |
| `conversation` | Le fil du message (`conversationId` des données de `message.sent`). |
| `cafe` | Le Café de l'inscription, s'il n'est pas l'objet de l'événement. |
| `user` | Le compte du client (`Client.userId`), sauf si l'objet de l'événement est un `User`. |

Personnes visées (`AssigneeRef`, `EmailRecipientRef`) : `DOSSIER_AGENT` = `Dossier.assignedAgentId` · `LEAD_AGENT` = `Lead.assignedAgentId` · `CLIENT_AGENT` = `Client.assignedAgentId` · `APPOINTMENT_AGENT` = `Appointment.staffUserId` · `EVENT_HOST` = `Event.hostUserId` · `CLIENT` = la fiche `client` · `REGISTRANT` = la personne de `registration`.

**AUT-021** `[P1]` Une règle qui cite un champ ou un opérateur inconnu, ou un objet absent de son déclencheur, **ne peut pas être enregistrée** (code de champ `INVALID_RULE_FIELD`, TRV-064). Les champs `event.data.*` permis sont ceux de la colonne « Données » de AUT-010 pour ce déclencheur. Valeurs de comparaison : une date ou un instant en ISO 8601 (API-002) ; une énumération ou un identifiant en chaîne ; un booléen en `true` ou `false` ; une liste pour `in`, `nin` et `contains`. Toute autre forme est refusée à l'enregistrement. À l'évaluation, un champ sans valeur rend sa comparaison fausse (sauf `isNull`).

---

## 4. Actions

**AUT-030** `[P1]` `WorkflowRule.actions` : une liste de une à cinq actions, exécutées dans l'ordre.

```json
[
  { "type": "SEND_EMAIL", "template": "C_DOC_REMINDER", "to": "CLIENT", "respectQuietHours": true },
  { "type": "CREATE_TASK", "title": "Appeler {{client.fullName}} : pièces en attente",
    "taskType": "CALL", "priority": "HIGH", "assignee": "DOSSIER_AGENT",
    "dueInBusinessDays": 1, "dedupeKey": "doc-call:{{dossier.id}}" },
  { "type": "NOTIFY_STAFF", "recipients": "ADMINS",
    "title": "Demande {{lead.reference}} non prise en charge depuis 4 h" }
]
```

**AUT-031** `[P1]` **`SEND_EMAIL`.**

| Clé | Valeurs | Règle |
|---|---|---|
| `template` | Code d'un modèle | Le public du modèle (`audience`) doit correspondre au destinataire, et le déclencheur fournir tous les champs que le modèle cite (sinon `TEMPLATE_FIELD_UNAVAILABLE`, à l'enregistrement) ; le sélecteur de COM-061 ne propose que ces modèles. Ce que fournit un déclencheur : les objets que la résolution d'AUT-020 atteint pour lui. Les champs `action.*` sont propres à un modèle : un modèle qui en cite n'est proposé que pour la règle qui l'emploie d'origine. |
| `to` | Une valeur de `EmailRecipientRef` : `CLIENT` · `REGISTRANT` (l'inscrit d'un Café) · `REGISTRANTS` (tous les inscrits `REGISTERED`) · `ATTENDEES` (inscrits `ATTENDED`) · `NOTIFY_REQUESTS` (demandes « Me prévenir » correspondantes) · `DOSSIER_AGENT` · `LEAD_AGENT` · `CLIENT_AGENT` · `APPOINTMENT_AGENT` · `EVENT_HOST` · `ADMINS` · `OWNERS` | Un destinataire introuvable (dossier sans conseiller) → l'action est ignorée avec la raison. |
| `respectQuietHours` | booléen, défaut `true` pour un client | AUT-006. |
| `skipWhenOnHold` | booléen, défaut `true` pour un client | Vrai : l'e-mail est ignoré quand le dossier est en pause (AUT-007). **Faux** pour les rappels d'une échéance qui court malgré la pause : `R_OPTION_EXPIRING_CLIENT`, `R_OFFER_EXPIRING`, `R_APPOINTMENT_REMINDER`. |
| `dedupeWindowHours` | entier, facultatif | Le même modèle n'est pas renvoyé au même destinataire dans cette fenêtre. C'est ce qui fait « un e-mail par dossier et par jour » quand l'événement est émis pièce par pièce : le premier envoie l'e-mail, qui liste tout ce qui est concerné à cet instant ; les suivants sont ignorés. |
| `dedupeKey` | gabarit, facultatif | Remplace, pour cet e-mail, la clé de NOT-011 (`C_LEAD_DELAYED:{leadId}`, `C_ACCOUNT_ACTIVATION_REMINDER:{dossierId}`, avec l'identifiant de l'objet). Fixée par les données de départ, non réglable. |
| `registeredBeforeHours` | entier, facultatif | Pour `REGISTRANTS` : ne garde que les inscrits depuis plus de ce délai. |
| `markField` | nom d'un champ, facultatif | Marque d'envoi posée sur l'objet quand l'e-mail est mis en file (`reminderSentAt`, `reminder7SentAt`, `followUpSentAt`…). C'est le moteur qui l'écrit : il n'y a pas d'action « écrire un champ ». |

Au moment d'envoyer, le destinataire et les conditions d'arrêt (AUT-007) sont **revérifiés** : un envoi programmé vendredi ne part pas lundi vers quelqu'un qui s'est désinscrit samedi.

**AUT-032** `[P1]` **`CREATE_TASK`.**

| Clé | Règle |
|---|---|
| `title` | 160 caractères au plus après remplacement des champs dynamiques. |
| `description` | Facultatif ; 2 000 caractères au plus après remplacement des champs dynamiques (au-delà, coupé et terminé par « … »). |
| `suggestedTemplate` | Facultatif. Code d'un modèle d'e-mail manuel (`Task.suggestedTemplateCode`) : la tâche porte l'action « Écrire » (TAC-005). |
| `taskType`, `priority` | `TaskType`, `Priority`. |
| `assignee` | `DOSSIER_AGENT` · `LEAD_AGENT` · `CLIENT_AGENT` (le conseiller référent du client, `Client.assignedAgentId`) · `APPOINTMENT_AGENT` (le conseiller du rendez-vous) · `EVENT_HOST` · `TEAM` (non affectée, à prendre) · un identifiant de compte. Si le conseiller attendu n'existe pas, **ou ne peut pas agir** — compte suspendu ou supprimé, rôle qui n'est plus celui d'un conseiller, absence déclarée au-delà de l'échéance de la tâche (CRM-021) — : la tâche est créée **non affectée** et les administrateurs sont notifiés. Un objet confié à quelqu'un qui n'est plus là ne se tait jamais. |
| `dueInBusinessDays`, `dueInDays`, `dueAtField` | L'un des trois. `0` : échéance immédiate. `dueAtField` : l'échéance est une date de l'objet déclencheur — `appointment.startsAt` pour « avant l'heure de la visite ». |
| `dedupeKey` | Obligatoire pour les règles livrées d'origine. S'il existe une tâche `OPEN` avec la même clé, **aucune tâche n'est créée**. |

**Valeurs par défaut**, pour qu'aucune tâche automatique ne reste sans responsable ni échéance : `assignee` absent → `DOSSIER_AGENT`, à défaut `LEAD_AGENT`, à défaut `CLIENT_AGENT`, à défaut `TEAM` ; échéance absente → **un jour ouvré** ; `priority` absente → `NORMAL` ; `taskType` absent → `FOLLOW_UP`. Les tableaux du § 5 ne citent que ce qui s'en écarte.

La tâche est rattachée aux objets de l'événement (dossier, client, demande, soumission, Café, bien, promoteur, banque, produit bancaire, rendez-vous, réservation, retour), avec `origin = WORKFLOW` et `ruleId`. Elle n'envoie **pas** l'e-mail « Nouvelle tâche » : une tâche `HIGH` ou `URGENT` crée la notification `NS_TASK_AUTO` — sauf si cette personne est déjà notifiée du même fait, par la règle elle-même ou par un type du catalogue : elle ne reçoit alors que cette notification, avec le lien vers la tâche (NOT-035) ; toutes figurent dans « Ma journée » (TDB-005) et dans le résumé du matin, sous « Nouvelles tâches » (AUT-070).

Les tâches créées par un **effet du système** plutôt que par une règle réglable — prévenir un client sans adresse e-mail (NOT-025), accueillir la demande d'une personne dont le traitement est limité (CYC-009), fusionner deux fiches (AUTH-080), revoir un financement après le retrait d'un co-emprunteur à sa demande (ADM-063) — suivent exactement les mêmes règles : mêmes valeurs par défaut, même clé contre les doublons, même notification, même place dans le résumé du matin. Comme les autres, elles naissent d'un événement de la boîte d'envoi, jamais dans la transaction du geste (AUT-002).

**AUT-033** `[P1]` **`NOTIFY_STAFF`.** Crée une notification dans l'application (type `NS_RULE_ALERT`, NOT-030).

| Clé | Règle |
|---|---|
| `recipients` | `DOSSIER_AGENT` · `LEAD_AGENT` · `CLIENT_AGENT` · `APPOINTMENT_AGENT` · `EVENT_HOST` · `ADMINS` (rôles `OWNER` et `ADMIN`) · `ALL_AGENTS` (`OWNER`, `ADMIN`, `AGENT`) · `SUPPORT`. Plusieurs valeurs possibles. Comptes actifs seulement ; une personne n'est notifiée qu'une fois. Si le conseiller visé ne peut pas agir — compte suspendu ou supprimé, rôle qui n'est plus celui d'un conseiller —, la notification va aux `ADMINS` à sa place ; s'il est seulement absent, il la reçoit, et les `ADMINS` aussi (NOT-018). |
| `title` | 160 caractères, champs dynamiques permis. |
| `body` | Facultatif, 400 caractères. |

Le lien de la notification mène à l'objet de l'événement. Quand une ligne des § 5 à § 7 dit « Notifier » sans donner de texte, le titre de l'alerte est celui de la tâche que la règle crée. Et quand cette tâche n'est pas créée parce qu'une tâche ouverte porte déjà sa clé (AUT-032), l'alerte n'est pas répétée non plus : trois messages sans réponse dans un fil font une tâche et une alerte, pas trois.

**AUT-034** `[P1]` **`SEND_SURVEY`.** Clé `survey` : code d'une enquête active. Crée une invitation à envoyer tout de suite. L'unicité de `SurveyInvitation` s'applique : une personne déjà invitée pour ce contexte ne l'est pas deux fois.

**AUT-035** `[P1]` **Fermeture automatique des tâches créées par une règle.** Une tâche automatique se ferme quand ce qu'elle demandait est arrivé (état `DONE`, mention « Terminée automatiquement ») ou n'a plus d'objet (état `CANCELLED`, avec la raison).

| Clé de la tâche | Se termine (`DONE`) quand | S'annule (`CANCELLED`) quand |
|---|---|---|
| `lead-contact:{leadId}` | Premier contact noté. | Demande clôturée ou indésirable. |
| `doc-review:{dossierId}` | Plus aucune pièce du dossier à l'état `RECEIVED`, ni renouvellement en attente. | Dossier clôturé. |
| `doc-redo:{documentId}` | La pièce est de nouveau `RECEIVED` ou `VALIDATED`. | Pièce dispensée ; dossier clôturé. |
| `doc-call:{dossierId}` | Le client dépose une pièce, ou il ne reste aucune pièce attendue. | Dossier clôturé ou mis en pause. |
| `bank-follow:{submissionId}` | Une relance est notée sur la soumission. | La soumission quitte `SUBMITTED` et `UNDER_REVIEW`. |
| `share-check:{submissionId}` | Le paquet est téléchargé. | La soumission change d'état. |
| `info-stale:{submissionId}` | Le complément est transmis. | La soumission quitte `INFO_REQUESTED`. |
| `offer-present:{submissionId}` | L'offre est acceptée ou refusée par le client. | La soumission n'est plus `APPROVED`. |
| `offer-expiring:{submissionId}` | Idem. | Idem. |
| `offer-accept:{submissionId}` | L'acceptation est enregistrée. | La soumission n'est plus `APPROVED` ; le souhait du client est retiré (`submission.offer_accept_withdrawn`). |
| `send-failed:{submissionId}` | La soumission est envoyée, ou le complément transmis. | La soumission est retirée. |
| `banks-declined:{dossierId}` | Une nouvelle soumission est créée, ou le dossier passe « sans financement » (CYC-041). | Dossier clôturé ; refus annulé (CYC-169). |
| `propose:{dossierId}` | Un bien est proposé. | Dossier clôturé, ou étape au-delà de `MATCHING`. |
| `proposal-feedback:{dossierId}` | Plus aucun bien `PROPOSED` ni `VIEWED`. | Dossier clôturé. |
| `selection:{candidateId}` | Le bien est `SELECTED`. | Le candidat change d'état autrement. |
| `resurfaced:{dossierId}`, `hold-ended:{dossierId}` | Dossier repris. | Dossier clôturé. |
| `inactive:{dossierId}` | Toute activité sur le dossier. | Dossier clôturé. |
| `message-reply:{conversationId}` | Un membre de l'équipe répond dans le fil. | — |
| `option:{reservationId}` | Option prolongée ou réservation confirmée. | Réservation annulée ou expirée. |
| `option-ack:{reservationId}` | Le promoteur a confirmé l'option, ou la réservation est confirmée. | Réservation annulée ou expirée. |
| `option-refused:{reservationId}`, `option-ended:{reservationId}` | À la main : le conseiller a appelé le client. | Dossier clôturé. |
| `promoter-release:{reservationId}`, `visit-host:{appointmentId}` | À la main : le promoteur est prévenu. | — |
| `visit-host-moved:{appointmentId}` | À la main : le promoteur est prévenu. | Le rendez-vous est annulé : la tâche de `R_VISIT_HOST_CANCELLED` prend le relais. |
| `lot-conflict:{lotId}` | À la main : le point est vérifié avec le promoteur. | La réservation prend fin. |
| `stock:{promoterId}` | Plus aucun programme de ce promoteur n'est à vérifier (CTL-064). | Promoteur suspendu ou terminé. |
| `product-check:{productId}` | « Barème vérifié » (BNK-024). | Produit désactivé ; banque suspendue ou terminée. |
| `partner-answer:{answerId}` `[P2]` `[P3]` | La réponse est appliquée ou écartée. | La réponse n'a plus d'objet (ACP-032). |
| `partner-silent:{shareId}` `[P2]` `[P3]` | Une réponse arrive, par n'importe quelle voie. | La demande n'attend plus rien. |
| `reservation-contract:{reservationId}` | Contrat déposé. | Réservation annulée. |
| `appt-confirm:{appointmentId}` | Rendez-vous confirmé. | Rendez-vous annulé. |
| `appt-outcome:{appointmentId}` | Issue renseignée. | — |
| `email-fix:{clientId}` | `Client.emailBouncedAt` redevient vide, quelle qu'en soit la cause : adresse corrigée, « Adresse vérifiée », « Mon adresse est correcte », e-mail remis (AUT-071). | Client archivé. |
| `convention:{type}:{id}`, `partner-doc:{id}` | Date mise à jour ou document remplacé. | Partenaire `ENDED`. |
| `delivery:{programId}`, `delivery:{propertyId}` | Livraison mise à jour. | Programme ou bien archivé. |
| `feedback-neg:{feedbackId}`, `listing-error:{feedbackId}` | Retour traité. | Retour classé sans suite. |
| `checkin:{eventId}` | Un pointage est fait. | — |
| `deposit-refund:{reservationId}` | L'issue de l'acompte est enregistrée (CYC-108). | — (elle survit à la clôture du dossier) |
| `acquisition-lot:{dossierId}` | Un lot est de nouveau réservé pour le dossier. | Dossier clôturé. |
| `unavailable:{dossierId}` | Un bien disponible est retenu. | Dossier clôturé. |
| `visit-unavailable:{appointmentId}` | Le rendez-vous est annulé, tenu ou marqué absent. | — |
| `consent:{dossierId}` | L'accord de transmission est donné. | Dossier clôturé, ou passé sans financement. |
| `decision-corrected:{submissionId}` | À la main. | Dossier clôturé. |
| `client-notify:{modèle}:{objet}` | À la main : le conseiller a prévenu le client. | Une adresse e-mail est ajoutée à la fiche, ou le dossier est clôturé. |
| `restricted-lead:{leadId}` | La limitation est levée ou confirmée. | Demande clôturée. |
| `client-merge:{clientId}`, `party-removed:{partyId}` | À la main : les fiches sont fusionnées ; le financement est revu avec le client. | Dossier clôturé. |
| `program-sold:{programId}` | Le programme est archivé. | Un lot du programme redevient disponible. |
| `deletion:{clientId}` | La demande de suppression est traitée. | Le client se rétracte. |

Les autres tâches automatiques (`appt-noshow`, `cafe-callback`, `testimonial`) se terminent à la main. Quand un dossier est gagné ou perdu, ses tâches ouvertes sont annulées (CYC-027, CYC-035), sauf celles que la clôture fait naître et le suivi d'un acompte.

**AUT-036** `[P1]` **Champs dynamiques** dans les titres et textes des actions : même syntaxe et mêmes champs que les modèles d'e-mail (NOT-050), par exemple `{{client.fullName}}`, `{{dossier.reference}}`, `{{property.title}}`, `{{bank.name}}`, `{{lot.reference}}`, `{{cafe.title}}`, `{{event.data.daysWaiting}}`. Les titres des § 5 à § 7 sont écrits avec des repères en français, que les données de départ remplacent par ces champs : {client} → `{{client.fullName}}` ; {référence} → la référence de l'objet nommé (`{{lead.reference}}`, `{{dossier.reference}}`, `{{submission.reference}}`) ; {banque} → `{{bank.name}}` ; {bien}, {titre} → `{{property.title}}` ; {lot} → `{{lot.reference}}` ; {promoteur} → `{{promoter.name}}` ; {produit} → `{{product.name}}` ; {partenaire} → `{{partner.name}}` ; {libellé} → `{{document.label}}` (`{{partnerDocument.label}}` pour un document de partenaire) ; {statut} → `{{event.data.fileStatusLabel}}` ; {étape} → `{{dossier.stageLabel}}` ; {nom} → `{{program.name}}` ; {programme ou bien} → `{{property.title}}`, à défaut `{{program.name}}` ; {capacité} → `{{cafe.capacity}}` ; {n} → la donnée de l'événement qui compte (`{{event.data.daysWaiting}}`…) ; {délai} → `{{rule.delayLabel}}`, qui suit le délai réglé ; {ce qui s'est passé} → `{{event.data.whatLabel}}` (« le client a déposé une pièce », « le client a écrit », « le client a répondu à une proposition », « la banque a décidé », « la banque demande un complément ») ; les autres ({date}, {montant}, {lieu}…) → le champ de NOT-050 de l'objet qu'ils nomment, déjà formaté (NOT-051).

---

## 5. Règles livrées d'origine

Elles sont créées par les données de départ avec `isSystem = true` : on peut les désactiver et les ajuster, pas les supprimer. Une règle dont la colonne « Conditions » commence par `[P2]`, `[P3]` ou `[V2]` n'est pas créée par les données de départ de la Phase 1 ; elle le sera par la mise à jour qui livre sa fonction (PAR-081). « À l'exécution » rappelle que la condition est revérifiée après le délai (AUT-004). Les tests citent la règle et son code : `AUT-042 / R_DOC_REMINDER`. Leur **nom** (`WorkflowRule.name`) est posé par les données de départ : ce que fait la règle, en un groupe nominal de 60 caractères au plus tiré de sa ligne (« Relance des pièces à fournir », « Demande non prise en charge », « Rappel du rendez-vous la veille ») ; leur description est la colonne « Actions », tronquée à 500 caractères. À la désactivation, COM-064 annonce « {nom} ne s'appliquera plus. », sauf pour `R_DOC_REMINDER`, qui a sa phrase.

### 5.1 Demandes

**AUT-040** `[P1]`

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_PARTNER_APPLICATION_SUBMITTED` | `lead.application_submitted` | — | 0 | Notifier `OWNERS` et `ADMINS` : « Candidature partenaire de {société} à examiner. » Tâche « Examiner la candidature de {société} », `TEAM`, échéance `partner.applicationReviewDays` jours ouvrés, clé `partner-app:{leadId}` (fermée à l'acceptation ou au refus). |
| `R_LEAD_NOT_TAKEN` | `lead.created` | À l'exécution : `lead.status = NEW` (personne ne l'a prise ; une demande affectée d'office est déjà `IN_PROGRESS` et relève des deux règles de délai ci-dessous). | 4 heures ouvrées | Notifier `ADMINS` : « La demande {référence} attend depuis {délai}. » |
| `R_LEAD_RELEASED` | `lead.released` | — | 0 | Notifier `ALL_AGENTS` : « La demande {référence} est de nouveau à prendre. » |
| `R_LEAD_DURING_DOSSIER` | `lead.created` | `event.data.attachment = PENDING_DECISION` | 0 | Notifier `CLIENT_AGENT` et `DOSSIER_AGENT` — le conseiller du dossier en cours, s'il n'est pas le référent — : « Nouvelle demande de {client} pendant un dossier en cours. » |
| `R_LEAD_SLA_WARNING` | `lead.sla_warning` ⏱ | `lead.firstContactAt` nul | 0 | Notifier `LEAD_AGENT` (à défaut `ALL_AGENTS`) : « Plus qu'un jour ouvré pour contacter {client}. » |
| `R_LEAD_SLA_BREACHED` | `lead.sla_breached` ⏱ | `lead.firstContactAt` nul | 0 | Notifier `LEAD_AGENT` et `ADMINS`. E-mail `S_LEAD_SLA_BREACHED` aux `ADMINS`. Tâche « Contacter {client} : délai de premier contact dépassé », `CALL`, `URGENT`, `LEAD_AGENT`, échéance immédiate, clé `lead-contact:{leadId}`. E-mail `C_LEAD_DELAYED` au client, une seule fois par demande : sa clé est `C_LEAD_DELAYED:{leadId}`, à la place de celle de NOT-011 ; client sans adresse e-mail : rien de plus, la tâche ci-dessus en tient lieu (NOT-025). |
| `R_CALL_MISSED` | `communication.call_logged` | Appel sortant, issue `NO_ANSWER` ou `VOICEMAIL` ; à l'exécution : ni la demande ni le dossier n'a de premier contact (`lead.firstContactAt`, `dossier.firstContactAt`). | 0 | E-mail `C_CALL_MISSED` au client, au plus un par 72 heures. |

### 5.2 Financement

**AUT-041** `[P1]` **Suivi des banques.** `submission.decision_overdue` est émis quand une soumission est `SUBMITTED` ou `UNDER_REVIEW` et que `expectedDecisionAt` est dépassé (`submittedAt` + `Bank.reviewSlaDays`, à défaut `submission.defaultReviewDays` = 15 jours), puis de nouveau tous les `submission.followUpEveryDays` jours (7) tant qu'elle reste sans décision. Le premier signal part le lendemain de `expectedDecisionAt` ; `followUpNumber` compte les signaux depuis la dernière échéance : quand `expectedDecisionAt` change (complément transmis, modification à la main), il repart de 1 (clé : AUT-012).

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_BANK_FOLLOW_UP` | `submission.decision_overdue` ⏱ | `submission.status` ∈ `SUBMITTED`, `UNDER_REVIEW` | 0 | Tâche « Relancer {banque} : dossier {référence} sans réponse depuis {n} jours », `BANK_FOLLOW_UP`, `DOSSIER_AGENT`, échéance 1 jour ouvré, clé `bank-follow:{submissionId}`. |
| `R_SHARE_NOT_DOWNLOADED` | `submission.submitted` | `transmissionMode = SECURE_LINK` ; à l'exécution : `status = SUBMITTED` et `downloadCount = 0`. | 3 jours ouvrés | Tâche « Vérifier que {banque} a bien reçu le dossier {référence} », `BANK_FOLLOW_UP`, clé `share-check:{submissionId}`. |
| `R_INFO_REQUEST_STALE` | `submission.info_requested` | À l'exécution : `status = INFO_REQUESTED`. | 10 jours ouvrés | Tâche « Complément demandé par {banque} toujours en attente », `BANK_FOLLOW_UP`, clé `info-stale:{submissionId}`. |
| `R_SUBMISSION_SEND_FAILED` | `submission.send_failed` | — | 0 | Tâche « L'envoi du dossier {référence} à {banque} a échoué : rien n'est parti », `BANK_FOLLOW_UP`, `HIGH`, `DOSSIER_AGENT`, échéance immédiate, clé `send-failed:{submissionId}`. |
| `R_OFFER_PRESENT` | `submission.approved` | — | 0 | Tâche « Présenter l'offre de {banque} à {client} », `CALL`, `HIGH`, échéance 2 jours ouvrés, clé `offer-present:{submissionId}`. |
| `R_OFFER_ACCEPT_REQUESTED` | `submission.offer_accept_requested` | — | 0 | Notifier `DOSSIER_AGENT`. Tâche « {client} souhaite accepter l'offre de {banque} », `HIGH`, échéance 1 jour ouvré, clé `offer-accept:{submissionId}`. |
| `R_OFFER_EXPIRING` | `submission.offer_expiring` ⏱ | `status = APPROVED`, `acceptedByClientAt` nul | 0 | E-mail `C_OFFER_EXPIRING` au client. Notifier `DOSSIER_AGENT`. Tâche « Offre de {banque} : expire le {date} », `HIGH`, clé `offer-expiring:{submissionId}`. |
| `R_ALL_BANKS_DECLINED` | `dossier.all_banks_declined` | — | 0 | Tâche « Décider de la suite : autre banque, achat sans financement ou clôture », `HIGH`, échéance 2 jours ouvrés, clé `banks-declined:{dossierId}`. |
| `R_DECISION_CORRECTED` | `submission.decision_reverted` | `event.data.clientWasNotified` vrai | 0 | Tâche « Appeler {client} : la réponse de {banque} a été corrigée », `CALL`, `URGENT`, échéance immédiate, clé `decision-corrected:{submissionId}`. |
| `R_CONSENT_MISSING` | `dossier.completed` | À l'exécution : `dossier.financingRequested` vrai, `dossier.sharingConsentGranted` faux, dossier `OPEN`. | 2 jours ouvrés | E-mail `C_CONSENT_REMINDER` au client. Tâche « Obtenir l'accord de transmission de {client} », clé `consent:{dossierId}`. |
| `R_CONSENT_WITHDRAWN` | `consent.changed` | `event.data.type = DATA_SHARING_PARTNERS`, `event.data.granted` faux, dossier `OPEN` ou `ON_HOLD` | 0 | Notifier `DOSSIER_AGENT`. Tâche « {client} a retiré son accord de transmission », `HIGH`, échéance 1 jour ouvré, clé `consent:{dossierId}`. |

### 5.3 Pièces

**AUT-042** `[P1]` **Relances de pièces.** Chaque jour ouvré à 10 h, pour chaque dossier `OPEN` à l'étape `DOCUMENTS`, `BANK_REVIEW` ou `APPROVED` :

1. **Pièces attendues** : pièces à fournir par le client (`providedBy = CLIENT`), à l'état `PENDING`, `REJECTED` ou `EXPIRED` — hors celles d'une personne dont le traitement est limité, pour qui le dépôt est fermé (DOS-032) —, obligatoires, ou demandées par une banque dont la soumission est **en cours** — non terminée, brouillon compris : ses pièces ont été demandées au client dès la préparation (MOD-360) ; celles d'une soumission terminée ont été dispensées (CYC-170) —, dont les relances ne sont suspendues ni sur la pièce ni sur le dossier (`DossierDocument.remindersPaused`, `Dossier.remindersPaused`).
2. Une pièce attendue est **due** si `reminderCount` est inférieur au nombre de relances prévues et si le nombre de jours **calendaires** écoulés depuis son point de départ (`reminderBaseAt`) atteint `documents.reminderDays[reminderCount]`. Valeur par défaut : `[3, 7, 14]`, soit trois relances, à J+3, J+7 et J+14. Les jours se comptent **en dates**, dans le fuseau du calendrier de travail, quelle que soit l'heure : J+3 est le troisième jour après la date de `reminderBaseAt`. La tâche ne tournant que les jours ouvrés, une relance dont le jour tombe un samedi, un dimanche ou un jour férié part au passage suivant ; le calendrier ne glisse pas pour autant : la relance d'après se compte toujours depuis `reminderBaseAt`. Le point de départ est la demande, le rejet ou l'expiration de la pièce ; il est **remis à la date du jour**, et le compteur à zéro, quand le dossier **reprend** après une pause ou est **rouvert** : un client dont le projet repart ne reçoit pas trois relances en une semaine.
3. Si au moins une pièce est due, et si la dernière relance de ce dossier, automatique ou manuelle, date d'au moins `documents.reminderMinGapDays` jours (2), comptés en dates comme au point 2 : l'événement `document.reminder_due` est émis **une fois pour le dossier**, avec **toutes** les pièces attendues, et la relance est inscrite à l'historique du dossier (`DocumentReminder`, GED-060). Le client reçoit un seul e-mail qui les liste.
4. À l'émission de l'événement, seules les pièces **dues** voient `reminderCount` augmenter de 1 et `lastRemindedAt` prendre la date du jour ; les autres pièces attendues sont citées dans l'e-mail sans que leur calendrier bouge. Cela vaut **que l'e-mail parte ou non** (groupe coupé, adresse en erreur, client sans adresse, modèle ou règle désactivé) : c'est le calendrier qui avance ; faute d'e-mail, l'épuisement conduit de toute façon à l'appel du conseiller. La chronologie dit si la relance est partie, et sinon pourquoi.
5. **Épuisement** : quand une pièce attendue a reçu toutes ses relances et que la dernière (`lastRemindedAt`, qui ne bouge plus) date d'au moins `documents.escalateAfterDays` jours (5), comptés en dates, `document.reminders_exhausted` est émis pour cette pièce — une fois par cycle de relances, grâce à sa clé (AUT-012), qui contient `reminderBaseAt` : un rejet, une expiration, une reprise du dossier, sa réouverture ou la reprise des relances ouvrent un nouveau cycle. `R_DOC_REMINDERS_EXHAUSTED` crée la tâche d'appel avec la clé `doc-call:{dossierId}` : une seule tâche ouverte par dossier, quel que soit le nombre de pièces épuisées ; une fois la tâche fermée, seule une pièce épuisée dans un nouveau cycle en crée une autre.

Un dépôt remet le compteur de la pièce à zéro (CYC-140). Le conseiller peut suspendre les relances d'une pièce, ou de tout un dossier (GED-060).

**Exemple** (réglages d'origine, sans jour férié). Pièce A demandée le lundi 5 octobre à 15 h ; pièce B rejetée le mercredi 7. Jeudi 8 à 10 h : A est due (3 dates depuis le 5), B non (1) ; aucune relance antérieure : relance du dossier, l'e-mail cite A et B, seule A passe à `reminderCount` 1. Samedi 10 (J+3 de B) n'est pas ouvré : B part au passage du lundi 12, avec A (J+7 de A) ; écart avec la relance du jeudi : 4 dates ; A passe à 2, B à 1. Mercredi 14 (J+7 de B ; écart : 2 dates) : B passe à 2. Lundi 19 (J+14 de A) : A passe à 3, sa dernière relance. Mercredi 21 (J+14 de B) : B passe à 3. Lundi 26 : A (7 dates depuis le 19) et B (5 dates depuis le 21) sont épuisées — deux événements `document.reminders_exhausted`, une seule tâche d'appel.

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_DOC_REVIEW` | `document.received` | — | 0 | Tâche « Vérifier les pièces de {client} », `DOC_REVIEW`, `DOSSIER_AGENT`, échéance 1 jour ouvré, clé `doc-review:{dossierId}`. |
| `R_DOC_REMINDER` | `document.reminder_due` ⏱ | `dossier.status = OPEN` | 0 | E-mail `C_DOC_REMINDER` au client. Relance manuelle (`event.data.manual`, GED-060) : sans attendre la fin des heures calmes (AUT-006) et hors plafond (AUT-008) ; les conditions d'arrêt (AUT-007) valent. |
| `R_DOC_REMINDERS_EXHAUSTED` | `document.reminders_exhausted` ⏱ | `dossier.status = OPEN` | 0 | Tâche « Appeler {client} : pièces en attente malgré les relances », `CALL`, `HIGH`, clé `doc-call:{dossierId}`. |
| `R_DOC_EXPIRING` | `document.expiring_soon` ⏱ | Dossier `OPEN` à l'étape `DOCUMENTS` (CYC-145) ; `document.providedBy = CLIENT` | 0 | E-mail `C_DOC_EXPIRING` au client, **un par dossier et par jour** (`dedupeWindowHours` 24), qui liste ses pièces et leur date de fin de validité. Notifier `DOSSIER_AGENT` : « Des pièces de {client} expirent bientôt (dossier {référence}). » — une seule alerte par dossier et par jour : les pièces suivantes du même jour n'en créent pas d'autre |
| `R_DOC_OPERATOR_EXPIRED` | `document.expired` | `document.providedBy` ≠ `CLIENT` | 0 | Tâche « Pièce à renouveler : {libellé} (dossier {référence}) », `DOSSIER_AGENT`, clé `doc-redo:{documentId}`. Rien n'est demandé au client : ce n'est pas lui qui la dépose (DOS-004). |
| `R_DOC_OPERATOR_REJECTED` | `document.rejected` | `document.providedBy` ≠ `CLIENT` | 0 | Tâche « Pièce à refaire : {libellé} (dossier {référence}) », `DOSSIER_AGENT`, clé `doc-redo:{documentId}`. |

### 5.4 Rapprochement et dossier

**AUT-043** `[P1]`

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_QUALIFIED_NO_PROPOSAL` | `dossier.stage_changed` | `event.data.toStage = MATCHING`, `event.data.isBackward` faux ; à l'exécution : `dossier.candidateCount = 0`, dossier `OPEN` à `MATCHING`. | 3 jours ouvrés | Tâche « Proposer des biens à {client} », clé `propose:{dossierId}`. |
| `R_PROPOSAL_REMINDER` | `candidate.proposed` | À l'exécution : `dossier.unopenedProposalCount` > 0 (au moins un bien proposé jamais ouvert), dossier `OPEN`. | 3 jours | Un e-mail `C_PROPOSAL_REMINDER` au client pour l'envoi ; au plus un par dossier et par 72 heures (`dedupeWindowHours`). |
| `R_PROPOSAL_FEEDBACK` | `candidate.proposed` | À l'exécution : `dossier.pendingProposalCount` > 0 (au moins un bien proposé sans réponse), dossier `OPEN`. | 7 jours | Tâche « Recueillir l'avis de {client} sur les biens proposés », clé `proposal-feedback:{dossierId}`. |
| `R_SELECTION_REQUESTED` | `candidate.selection_requested` | — | 0 | Notifier `DOSSIER_AGENT`. Tâche « Confirmer le bien retenu par {client} : {bien} », `HIGH`, échéance 1 jour ouvré, clé `selection:{candidateId}`. |
| `R_CLIENT_RESURFACED` | `lead.attached` | `dossier.status = ON_HOLD` | 0 | Tâche « Le client s'est manifesté : reprendre le dossier {référence} ? », `HIGH`, clé `resurfaced:{dossierId}`. |
| `R_HOLD_ACTIVITY` | `dossier.activity_on_hold` | `dossier.status = ON_HOLD` | 0 | Tâche « Du nouveau sur un dossier en pause ({ce qui s'est passé}) : reprendre le dossier {référence} ? », `HIGH`, même clé `resurfaced:{dossierId}` : une seule tâche, quel que soit le nombre de faits. |
| `R_SELECTED_UNAVAILABLE` | `candidate.unavailable` | `event.data.wasSelected` vrai ; dossier à l'étape `DOCUMENTS` ou au-delà | 0 | Notifier `DOSSIER_AGENT`. Tâche « Bien retenu indisponible : proposer un autre bien ou clôturer (dossier {référence}) », `HIGH`, échéance 1 jour ouvré, clé `unavailable:{dossierId}`. |
| `R_VISIT_UNAVAILABLE` | `candidate.unavailable` | `event.data.hasUpcomingVisit` vrai | 0 | Tâche « Visite prévue sur un bien devenu indisponible : annuler ou maintenir », `HIGH`, `APPOINTMENT_AGENT`, clé `visit-unavailable:{appointmentId}` (`event.data.upcomingAppointmentId`). |
| `R_HOLD_ENDED` | `dossier.hold_ended` ⏱ | `dossier.status = ON_HOLD` | 0 | Tâche « Reprendre le dossier {référence} », clé `hold-ended:{dossierId}`. |
| `R_DOSSIER_INACTIVE` | `dossier.inactive` ⏱ | `dossier.status = OPEN` | 0 | Tâche « Relancer ou clôturer : dossier {référence} inactif depuis {n} jours », clé `inactive:{dossierId}`. |
| `R_DOSSIER_SLA_BREACHED` | `dossier.sla_breached` ⏱ | `dossier.status = OPEN` | 0 | Notifier `DOSSIER_AGENT` : « Le dossier {référence} dépasse le délai de l'étape {étape}. » |
| `R_TESTIMONIAL` | `dossier.won` | — | 30 jours | Tâche « Demander un témoignage à {client} », `LOW`, clé `testimonial:{dossierId}`. |
| `R_MESSAGE_UNANSWERED` | `message.sent` | `event.data.senderType = CLIENT` ; à l'exécution : `conversation.awaitingStaffReply` vrai. | 1 jour ouvré | Notifier `ADMINS` — une fois par fil, tant que la tâche est ouverte (AUT-033). Tâche « Répondre à {client} », `HIGH`, `DOSSIER_AGENT` (à défaut `TEAM`), clé `message-reply:{conversationId}`. |

### 5.5 Réservation

**AUT-044** `[P1]`

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_OPTION_EXPIRING` | `reservation.option_expiring` ⏱ | `reservation.status = OPTION` | 0 | Tâche « Option sur le lot {lot} : confirmer, prolonger ou libérer avant le {date} », `HIGH`, clé `option:{reservationId}`. |
| `R_OPTION_EXPIRING_CLIENT` | `reservation.option_expiring` ⏱ | `reservation.status = OPTION` ; `reservation.optionAcknowledgedAt` renseigné : le client n'est rappelé que d'une option qu'on lui a annoncée (CYC-107). | 0 | E-mail `C_OPTION_EXPIRING` au client. |
| `R_OPTION_UNCONFIRMED` | `reservation.option_placed` | À l'exécution : `reservation.status = OPTION`, `reservation.optionAcknowledgedAt` nul. | 1 jour ouvré | Tâche « Faire confirmer par {promoteur} l'option sur le lot {lot} », `FOLLOW_UP`, `HIGH`, `DOSSIER_AGENT`, échéance 1 jour ouvré, clé `option-ack:{reservationId}`. |
| `R_OPTION_REFUSED` | `reservation.option_refused` | — | 0 | Tâche « {promoteur} refuse l'option sur le lot {lot} : appeler {client}, lui proposer un autre lot », `CALL`, `HIGH`, `DOSSIER_AGENT`, échéance 1 jour ouvré, clé `option-refused:{reservationId}` — quel que soit celui qui a saisi le refus. |
| `R_LOT_TAKEN_BACK` | `reservation.cancelled` | `event.data.lotOutcome` renseigné : le promoteur a repris le lot (CYC-107) | 0 | Tâche « {promoteur} a repris le lot {lot} : appeler {client}, lui proposer un autre lot », `CALL`, `HIGH`, `DOSSIER_AGENT`, échéance 1 jour ouvré, clé `option-refused:{reservationId}`. |
| `R_OPTION_UNCONFIRMED_ENDED` | `reservation.expired` | — (toute option expirée, confirmée ou non : le code garde son nom d'origine) | 0 | Tâche « L'option sur le lot {lot} a expiré : appeler {client} » — suivie de « (le promoteur ne l'avait pas confirmée) » quand c'est le cas —, `CALL`, `HIGH`, `DOSSIER_AGENT`, échéance 1 jour ouvré, clé `option-ended:{reservationId}`. |
| `R_PROMOTER_RELEASE` | `reservation.released` | — | 0 | Tâche « Prévenir {promoteur} : le lot {lot} est libéré », `FOLLOW_UP`, `DOSSIER_AGENT`, échéance 1 jour ouvré, clé `promoter-release:{reservationId}`, `suggestedTemplate` : `P_PROMOTER_RELEASE` (ACP-023). |
| `R_RESERVATION_CONTRACT` | `reservation.confirmed` | À l'exécution : `reservation.status = RESERVED`, `contractDocumentId` nul. | 5 jours ouvrés | Tâche « Déposer le contrat de réservation du lot {lot} », clé `reservation-contract:{reservationId}`. |
| `R_DEPOSIT_REFUND` | `reservation.deposit_refund_due` | — | 0 | Notifier `DOSSIER_AGENT` et `ADMINS`. Tâche « Suivre le remboursement de l'acompte de {montant} — {client}, lot {lot} », `HIGH`, échéance 10 jours ouvrés, clé `deposit-refund:{reservationId}`. |
| `R_LOT_IMPORT_CONFLICT` | `lot.import_conflict` | — | 0 | Tâche « Le fichier de {promoteur} donne le lot {lot} comme {statut}, alors que le dossier {référence} le tient : à vérifier », `HIGH`, `DOSSIER_AGENT`, échéance 1 jour ouvré, clé `lot-conflict:{lotId}`. |
| `R_ACQUISITION_LOT_LOST` | `reservation.cancelled` | `event.data.dossierStage = ACQUISITION` ; dossier `OPEN` | 0 | Tâche « Réservation annulée en cours d'acquisition : réserver un autre lot ou clôturer », `URGENT`, clé `acquisition-lot:{dossierId}`. |

### 5.6 Compte

**AUT-045** `[P1]`

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_ACTIVATION_REMINDER` | `dossier.stage_changed` | `event.data.toStage = DOCUMENTS`, `event.data.isBackward` faux ; à l'exécution : `client.accountStatus = INVITED`, dossier `OPEN`. | 3 jours | E-mail `C_ACCOUNT_ACTIVATION_REMINDER`, avec un nouveau lien (CYC-201). Une seule fois par dossier : la clé de l'e-mail est `C_ACCOUNT_ACTIVATION_REMINDER:{dossierId}`, à la place de celle de NOT-011 — un dossier qui recule puis revient à `DOCUMENTS` ne le reçoit pas deux fois. |
| `R_VERIFICATION_REMINDER` | `client.account_created` | À l'exécution : `user.emailVerifiedAt` nul. | 24 heures | E-mail `C_EMAIL_VERIFICATION`, avec un nouveau lien. Une seule fois. |
| `R_DELETION_REQUESTED` | `data_request.received` | `event.data.type = ERASURE` ; `event.data.status = RECEIVED` — une demande traitée d'office (PRO-060) ne crée pas de tâche | 0 | Tâche « {client} demande la suppression de son compte : ses dossiers et ses pièces sont à traiter », `HIGH`, `CLIENT_AGENT` (sans référent : non affectée, administrateurs notifiés — AUT-032), clé `deletion:{clientId}`. Elle vaut pour un dossier ouvert, gagné, ou clos avec des pièces. |

### 5.7 Rendez-vous

**AUT-051** `[P1]` (la première règle est `[P1]` : elle suit la demande de rendez-vous par le client)

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_APPOINTMENT_CONFIRM` | `appointment.requested` | — | 0 | Notifier `DOSSIER_AGENT` (à défaut `ADMINS`). Tâche « Confirmer le rendez-vous demandé par {client} », échéance 1 jour ouvré, clé `appt-confirm:{appointmentId}`. |
| `R_APPOINTMENT_REMINDER` | `appointment.upcoming` ⏱ | `appointment.status = CONFIRMED` | 0 | E-mail `C_APPOINTMENT_REMINDER` au client (hors heures calmes : part quand même ; jamais pour un rendez-vous dont il n'a pas été informé : AUT-007), marque `reminderSentAt`. Notifier `APPOINTMENT_AGENT` : « Rendez-vous demain à {heure} avec {client}. » |
| `R_APPOINTMENT_OUTCOME` | `appointment.outcome_missing` ⏱ | `appointment.status = CONFIRMED` | 0 | Tâche « Renseigner l'issue du rendez-vous avec {client} », `APPOINTMENT_AGENT`, clé `appt-outcome:{appointmentId}`. |
| `R_APPOINTMENT_NO_SHOW` | `appointment.no_show` | — | 0 | Tâche « Recontacter {client}, absent au rendez-vous », `CALL`, `APPOINTMENT_AGENT`, clé `appt-noshow:{appointmentId}`. |
| `R_VISIT_HOST_CANCELLED` | `appointment.cancelled` | `event.data.hadHost` vrai | 0 | Tâche « Prévenir {promoteur} : la visite du {date} est annulée », `FOLLOW_UP`, `APPOINTMENT_AGENT`, échéance : l'heure prévue de la visite (`dueAtField` : `appointment.startsAt`), clé `visit-host:{appointmentId}` (ACP-023). |
| `R_VISIT_HOST_RESCHEDULED` | `appointment.rescheduled` | `event.data.hadHost` vrai | 0 | Tâche « Prévenir {promoteur} : la visite est déplacée au {date} à {heure} », `FOLLOW_UP`, `HIGH`, `APPOINTMENT_AGENT`, échéance immédiate, clé `visit-host-moved:{appointmentId}` (ACP-023). |

### 5.8 Le Café

**AUT-056** `[P1]`

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_CAFE_OPENING` | `event.registration_opened` | — | 0 | E-mail `C_CAFE_OPENING` à `NOTIFY_REQUESTS` ; `notifiedAt` renseigné sur chaque demande servie. |
| `R_CAFE_REMINDER_7D` | `event.upcoming` ⏱ | `event.data.days = 7`, Café `PUBLISHED` ou `CLOSED` | 0 | E-mail `C_CAFE_REMINDER_7D` aux inscrits `REGISTERED` depuis plus de 48 heures (`to` : `REGISTRANTS`, `registeredBeforeHours` 48), marque `reminder7SentAt`. |
| `R_CAFE_REMINDER_1D` | `event.upcoming` ⏱ | `event.data.days = 1`, idem | 0 | E-mail `C_CAFE_REMINDER_1D` à tous les inscrits `REGISTERED`. `reminder1SentAt` renseigné. |
| `R_CAFE_LOW_FILL` | `event.upcoming` ⏱ | `event.data.days = 7`, `cafe.fillPct` < 50 | 0 | Notifier `EVENT_HOST` et `ADMINS` : « Le Café {lieu} du {date} compte {n} inscrits pour {capacité} places. » |
| `R_CAFE_THANKS` | `event.followup_due` ⏱ | — | 0 | E-mail `C_CAFE_THANKS` aux `ATTENDEES`, avec le lien de l'enquête `CAFE_ATTENDED`. `followUpSentAt` renseigné. |
| `R_CAFE_MISSED` | `registration.no_show` | — | 0 | E-mail `C_CAFE_MISSED` à l'inscrit, avec la date du prochain Café s'il y en a un. |
| `R_CAFE_CALLBACK` | `event.followup_due` ⏱ | `cafe.attendedSeats` > 0 | 0 | Tâche « Rappeler les participants du Café {lieu} du {date} », `CALL`, `EVENT_HOST` (à défaut `TEAM`), échéance 3 jours ouvrés, clé `cafe-callback:{eventId}`. |
| `R_CAFE_CHECKIN_MISSING` | `event.checkin_missing` ⏱ | — | 0 | Tâche « Pointer les présents du Café {lieu} du {date} », `EVENT_HOST`, clé `checkin:{eventId}`. |

---

## 6. Alertes, favoris, enquêtes

**AUT-060** `[P1]` **Alertes de recherche.**

- **Correspondance** : un bien correspond à une alerte s'il satisfait tous ses critères (mêmes règles que les filtres du catalogue, CAT-020), s'il est publié avec la disponibilité `AVAILABLE`, et s'il n'a pas déjà été envoyé pour cette alerte (`AlertDelivery`).
- **Biens nouveaux** : ceux dont l'événement `property.published` date d'après le dernier envoi de l'alerte (ou d'après sa création).
- **Fréquence** : `INSTANT` → 15 minutes après la publication (le temps de corriger une erreur de saisie), dans le respect des heures calmes ; `DAILY` → chaque jour à 8 h ; `WEEKLY` → le lundi à 8 h. Heure du destinataire, à défaut celle du calendrier de travail.
- **E-mail** `C_ALERT_MATCHES` : six biens au plus, puis « Voir les {n} biens » vers le catalogue filtré. Aucun bien nouveau : aucun e-mail.
- Pour un client qui a un compte : une notification dans l'application accompagne l'e-mail.
- Rien ne part si l'alerte est inactive ou non confirmée, ni si AUT-007 l'interdit.

**AUT-061** `[P1]` **Durée de vie d'une alerte.** Une alerte vit `alerts.lifetimeDays` jours (180) à partir de sa création ou de sa dernière prolongation. Quinze jours avant la fin, l'e-mail `C_ALERT_EXPIRING` propose « Prolonger mon alerte » (un clic, sans connexion). Sans prolongation, l'alerte est désactivée (`EXPIRED`) ; elle reste visible dans l'espace client, où on peut la réactiver. Cette règle ne dépend d'aucun suivi d'ouverture des e-mails (NOT-015). Un rejet définitif de l'adresse désactive toutes les alertes de cette adresse (`BOUNCE`).

**AUT-062** `[P1]` **Favoris.** Un client est prévenu quand un bien de ses favoris :
- baisse de prix d'au moins `favorites.priceDropPct` (3 %) **dans la devise du bien** (`property.price_changed`) : une variation du cours de change n'est pas une baisse de prix ;
- n'a plus que deux lots disponibles, ou un seul ;
- n'est plus disponible (`RESERVED`, `SOLD`, `WITHDRAWN`, ou archivé).

Notification dans l'application tout de suite ; un seul e-mail `C_FAVORITE_UPDATE` par jour et par client, à 8 h, qui regroupe les changements de la veille. **Réalisation** (D-097) : `property.price_changed` et `property.availability_changed` sont émis par le recalcul des caches d'un bien, y compris quand seul `lotsAvailable` change ; l'archivage d'un bien favori est repéré par la tâche `favorites.watch`, toutes les 15 minutes ; l'e-mail de 8 h (`favorites.daily`) regroupe les notifications `NC_FAVORITE_UPDATE` écrites depuis le passage précédent — elles sont la trace des changements — et le même passage retire les favoris archivés depuis plus de 30 jours (SFA-022).

**AUT-065** `[P1]` **Envoi des enquêtes.** Chaque enquête active (`Survey`) a un déclencheur et un délai. Correspondance fixe :

| `SurveyTrigger` | Événement | Contexte de l'invitation |
|---|---|---|
| `PROPOSAL_SENT` | La première fois que le client **ouvre** un bien proposé (`candidate.viewed`, `by = CLIENT`) : on ne demande pas son avis à quelqu'un qui n'a encore rien ouvert ; à défaut, `dossier.stage_changed` vers `DOCUMENTS` | dossier |
| `DOSSIER_COMPLETE` | `dossier.completed` | dossier |
| `BANK_DECISION` | `submission.approved` ou `submission.rejected` avec `isFirstDecisionOfDossier` | dossier |
| `ACQUISITION` | `dossier.won` | dossier |
| `CAFE_ATTENDED` | `registration.attended` | Café |
| `MANUAL` | Envoi par le personnel (FBK-040) ou action `SEND_SURVEY` | libre |

À l'événement, une `SurveyInvitation` est créée avec `scheduledFor` = événement + `Survey.delayHours`. L'unicité (enquête, client, dossier, Café) empêche toute seconde invitation ; une invitation **annulée** ne compte pas. Une décision annulée après sa publication (CYC-169) n'est pas une « première décision » : la vraie décision aura son enquête — sauf si celle de la décision annulée était déjà partie : on n'interroge pas deux fois la même personne sur le même dossier. Pour `CAFE_ATTENDED`, l'invitation n'envoie pas d'e-mail propre : son lien est porté par `C_CAFE_THANKS`.

À l'heure prévue, l'invitation est **annulée** au lieu d'être envoyée, avec sa raison (`SurveyCancelReason`), si : le client est archivé (`CLIENT_ARCHIVED`), effacé (`CLIENT_ERASED`), opposé au contact (`DO_NOT_CONTACT`), sans adresse e-mail (`NO_EMAIL`) ou d'adresse en erreur (`EMAIL_BOUNCED`), si son traitement est limité (`RESTRICTED`) ou son compte suspendu (`ACCOUNT_SUSPENDED`) ; le dossier a été supprimé (`DOSSIER_DELETED`) ; la décision de banque qui l'avait déclenchée a été annulée après sa publication (CYC-169, `DECISION_REVERTED`) ; le groupe de préférences « Enquêtes » est désactivé (`PREFERENCE_OFF`). L'état `WON` ou `LOST` du dossier n'arrête pas une invitation : l'enquête `ACQUISITION` porte justement sur un dossier gagné (AUT-007). Elle est **reportée** si le client a reçu une autre enquête depuis moins de `surveys.minGapDays` jours (14), ou si son dossier est en pause — elle part alors à la reprise ; au-delà de 30 jours après l'événement, elle est annulée (`TOO_LATE`). Une invitation annulée à la main porte `MANUAL` (FBK-041) ; un envoi manuel suit FBK-040.

**AUT-066** `[P1]` Sans réponse `surveys.reminderAfterDays` jours (5) après l'envoi : **un** rappel `C_SURVEY_REMINDER`, dont le lien porte un nouveau jeton (`SurveyInvitation.reminderTokenHash`) : le jeton du premier e-mail n'est gardé qu'en empreinte (NOT-002), et il reste valable. Le lien d'une invitation — l'un ou l'autre jeton — expire 30 jours après `scheduledFor`.

**AUT-067** `[P1]` **Retours.**

| Code | Déclencheur | Conditions | Actions |
|---|---|---|---|
| `R_FEEDBACK_NEGATIVE` | `feedback.received` | `feedback.npsScore` ≤ 6 **ou** `feedback.csatScore` ≤ 2 | Notifier `ADMINS` et `DOSSIER_AGENT` : « Retour négatif de {client} : {note}. » ({note} : « recommandation 4/10 » ou « satisfaction 2/5 »). Tâche « Rappeler {client} : retour négatif », `CALL`, `HIGH`, échéance 1 jour ouvré, clé `feedback-neg:{feedbackId}`. |
| `R_FEEDBACK_PROMOTER` | `feedback.received` | `feedback.npsScore` ≥ 9 et `event.data.surveyTrigger = ACQUISITION` | Tâche « Demander un témoignage à {client} », clé `testimonial:{dossierId}`. |
| `R_LISTING_ERROR` | `feedback.received` | `feedback.kind = LISTING_ERROR` | Tâche « Vérifier la fiche {bien} : erreur signalée », description `{{feedback.listingErrorKindLabel}} : {{feedback.comment}}`, `CONTENT`, `TEAM`, échéance 2 jours ouvrés, clé `listing-error:{feedbackId}`. |

---

## 7. Surveillance interne

**AUT-070** `[P1]` **Résumé du matin.** Chaque jour ouvré à 8 h 30 (fuseau du calendrier de travail), chaque membre du personnel reçoit l'e-mail `S_DAILY_DIGEST`, limité à son périmètre :
- ses tâches en retard et celles du jour ;
- les **nouvelles tâches** créées pour lui par une règle, ou par un effet du système, depuis le dernier résumé (elles n'envoient pas d'e-mail une à une, AUT-032) ;
- les alertes des règles reçues depuis le dernier résumé et pas encore lues (`NS_RULE_ALERT`) ;
- les demandes non prises en charge, et les siennes sans premier contact, avec leur échéance ;
- pour les administrateurs : les demandes écartées par le filtre qui attendent d'être relues (`needsReview`, DEM-031) ;
- les pièces à vérifier, par dossier ;
- ses rendez-vous du jour ;
- les soumissions dont la décision est en retard ;
- ses dossiers en retard sur leur étape ;
- les acomptes à suivre (CYC-108) ;
- pour les administrateurs : les tâches non affectées créées depuis le dernier résumé — une tâche « à prendre » ne rappelle personne d'elle-même (TAC-030).

L'e-mail ne part pas s'il n'a rien à dire. Chacun peut le couper dans ses préférences (groupe `STAFF_DIGEST` ; actif par défaut pour `OWNER`, `ADMIN`, `AGENT` ; les rôles `VIEWER` et `SUPPORT` ne le reçoivent pas, NOT-018), une fois cette section livrée (BO-070, paquet 5.1) ; d'ici là, il part pour tous ceux qui ont quelque chose à y lire.

**AUT-071** `[P1]` **Adresse en erreur, plainte.**
- **Rejet définitif** (`email.bounced`). Le rejet concerne **une adresse**, pas une personne :
  - l'adresse rejetée est l'adresse **actuelle** d'un client (`Client.email`) : `Client.emailBouncedAt` est renseigné et `client.email_bounced` est émis. Plus aucun e-mail automatique vers cette adresse, hors e-mails de compte et de sécurité et accusé d'une nouvelle demande (AUT-007) ; alertes désactivées ; le conseiller est notifié (`NS_EMAIL_BOUNCED`) et la règle `R_EMAIL_BOUNCED` lui crée une tâche. Dans son espace, le client lit en tête de chaque page : « Votre adresse e-mail a rejeté nos derniers messages. Vérifiez-la pour continuer à recevoir nos e-mails. » · « Modifier mon adresse » · « Mon adresse est correcte » ;
  - l'adresse rejetée est **autre chose** — une ancienne adresse du client, la nouvelle adresse qu'il vient de demander (AUTH-080 : le changement n'aboutit pas, rien d'autre ne change), l'adresse d'une banque, d'un promoteur, d'un inscrit au Café, d'un collègue : la fiche du client n'est **pas** touchée. L'auteur de l'e-mail est notifié (`NS_EMAIL_FAILED`) ; pour un e-mail automatique, l'alerte technique compte le rejet (AUT-076).
  - `emailBouncedAt` se vide quand l'adresse est corrigée, quand le client ou le conseiller confirme qu'elle est juste (« Mon adresse est correcte », « Adresse vérifiée » sur la fiche, CRM-048) — le prochain envoi dira si elle l'est —, et de lui-même dès qu'un e-mail ultérieur est **remis** (`DELIVERED`) à cette adresse.
- **Rejet temporaire** : le fournisseur réessaie ; rien ne change côté plateforme.
- **Signalement comme indésirable** (`email.complained`) : le **groupe** de l'e-mail signalé est coupé dans les préférences du destinataire ; le consentement `MARKETING_EMAIL` est retiré (nouvelle ligne `Consent`, source `complaint`) ; les alertes et les enquêtes sont coupées ; si l'e-mail signalé était un e-mail de service, le conseiller est notifié — les e-mails de service d'un dossier en cours continuent, parce qu'ils sont dus, mais c'est le moment d'appeler. Une note automatique est ajoutée à la fiche : « {client} a signalé comme indésirable l'e-mail « {objet} » du {date}. Actualités, alertes et enquêtes coupées. ». La ligne `Consent` porte l'e-mail signalé (`sourceCommunicationId`) ; les alertes sont désactivées avec la raison `USER` ; « enquêtes coupées » veut dire le groupe `SURVEYS` coupé. Un signalement sur un e-mail adressé à quelqu'un qui n'a pas de fiche — partenaire, inscrit sans fiche, membre de l'équipe — ne change que l'état de la ligne.

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_EMAIL_BOUNCED` | `client.email_bounced` | Client non archivé | 0 | Tâche « Corriger l'adresse e-mail de {client} », description `{{#if client.phone}}Téléphone : {{client.phone}}{{/if}}`, `CLIENT_AGENT`, clé `email-fix:{clientId}`. |

**AUT-072** `[P1]` **Taux de change ancien.** Pour chaque couple « devise d'un pays actif ↔ devise de référence », on regarde le cours que retient CAL-010 : non annulé, de nature `finance.exchangeRateKind`. Quand il a plus de `finance.exchangeRateMaxAgeDays` jours (7), `exchange_rate.stale` est émis, puis de nouveau chaque lundi tant que le cours n'est pas mis à jour — au plus une fois par semaine ISO (clé : AUT-012) : notification `NS_RATE_STALE` aux `ADMINS` (« Le taux EUR → DZD date du {date}. ») et, sur le tableau de bord, le bandeau « Taux de change ancien ({devises}, {date}). Mettez-le à jour. », qui mène à l'écran des taux (EA-57). Un couple sans aucun cours relève de CAL-011, pas de cette règle. Les conversions continuent avec le dernier cours connu (CAL-012).

**AUT-073** `[P1]` **Conventions et documents des partenaires.** Trente jours avant `conventionExpiresAt` d'un promoteur ou d'une banque `ACTIVE`, et trente jours avant `expiresAt` d'un `PartnerDocument` : notification `NS_PARTNER_EXPIRING` aux `ADMINS`, et une tâche. À l'échéance, rien n'est suspendu automatiquement : la fiche du partenaire affiche « Convention expirée ».

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_CONVENTION_EXPIRING` | `partner.convention_expiring` ⏱ | — (l'événement n'est émis que pour un partenaire `ACTIVE`) | 0 | Tâche « Renouveler la convention de {partenaire} (échéance le {date}) », `TEAM`, échéance 10 jours ouvrés, clé `convention:{type}:{id}`. |
| `R_PARTNER_DOC_EXPIRING` | `partner.document_expiring` ⏱ | — (même remarque) | 0 | Tâche « Renouveler un document de {partenaire} : {libellé} (échéance le {date}) », `TEAM`, échéance 10 jours ouvrés, clé `partner-doc:{id}`. |
| `R_STOCK_CHECK` | `promoter.stock_check_due` ⏱ | — (l'événement n'est émis que si la vérification est due, AUT-079) | 0 | Tâche « Vérifier les disponibilités avec {promoteur} : {n} programmes », `CONTENT`, `TEAM`, échéance 5 jours ouvrés, clé `stock:{promoterId}`, `suggestedTemplate` : `P_PROMOTER_STOCK_CHECK`. |
| `R_PRODUCT_CHECK` | `bankproduct.check_due` ⏱ | — | 0 | Tâche « Vérifier le barème de {banque} : {produit} », `TEAM`, échéance 10 jours ouvrés, clé `product-check:{productId}`, `suggestedTemplate` : `P_BANK_PRODUCT_CHECK`. |
| `R_PARTNER_ANSWER` | `partner.answer_received` | `[P2]` `[P3]` `event.data.needsReview` vrai | 0 | Tâche « Relire la réponse de {partenaire} : {geste} », `HIGH`, `DOSSIER_AGENT` (sans conseiller : non affectée, administrateurs notifiés — AUT-032), échéance 1 jour ouvré, clé `partner-answer:{answerId}`. La notification, elle, vient de `NS_PARTNER_ANSWER` : une seule (NOT-035). |
| `R_PARTNER_SILENT` | `partner.request_unanswered` ⏱ | `[P2]` `[P3]` — | 0 | Tâche « {partenaire} n'a pas répondu : {demande} », `FOLLOW_UP`, `DOSSIER_AGENT` (à défaut `TEAM`), échéance 1 jour ouvré, clé `partner-silent:{shareId}` (ACP-045). |

**AUT-078** `[P1]` **Programme vendu** (CYC-127). Rien n'est archivé d'office.

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_PROGRAM_SOLD_OUT` | `program.sold_out_review` ⏱ | — (l'événement n'est émis que pour un programme encore publié) | 0 | Notifier `ADMINS`. Tâche « Programme {nom} entièrement vendu depuis 6 mois : l'archiver ? », `CONTENT`, `TEAM`, clé `program-sold:{programId}`. |

**AUT-074** `[P1]` **Livraison dépassée.** Un programme, un bien isolé, ou un bien dont la livraison est redéfinie (`deliveryOverridden`), publié, dont la livraison est **dépassée** au sens de MOD-202 — la **fin** de la période annoncée est passée, pas son premier jour — émet `program.delivery_overdue`. Tant que la date n'est pas corrigée, le site affiche « Livraison en cours de confirmation » à la place de la date passée (FIC-040).

| Code | Déclencheur | Conditions | Délai | Actions |
|---|---|---|---|---|
| `R_DELIVERY_OVERDUE` | `program.delivery_overdue` ⏱ | — (l'événement n'est émis que pour un programme ou un bien encore publié) | 0 | Tâche « Mettre à jour la livraison de {programme ou bien} », `CONTENT`, `TEAM`, échéance 5 jours ouvrés, clé `delivery:{programId}` (ou `delivery:{propertyId}` pour un bien isolé ou à livraison redéfinie). |

**AUT-075** `[P1]` **Demandes d'exercice de droits.** À la réception : notification `NS_DATA_REQUEST_NEW` aux `OWNERS` et `ADMINS`. Pour un effacement, le conseiller référent du client est prévenu à part (`NS_CLIENT_ERASURE`) : il n'a pas accès à la demande, mais il doit savoir qu'un client qu'il suivait s'en va — même quand la suppression est traitée d'office. À J+20 sans clôture (`data_request.due_soon`) : notification `NS_DATA_REQUEST_DUE` et e-mail `S_GDPR_DUE` aux mêmes (CYC-230). Ce sont des effets système : une échéance légale ne se désactive pas comme une règle.

**AUT-076** `[P1]` **Alertes techniques**, vers le rôle `SUPPORT` (notification et e-mail `S_TECH_ALERT`) et, toujours, par e-mail vers l'adresse `TECH_ALERT_EMAIL` de l'environnement (ENV-040) — une alerte a donc un destinataire même avant l'invitation d'un premier compte `SUPPORT`. Au plus une par heure et par **cause** ; la cause est le type d'alerte et son objet : `outbox:{eventId}`, `rule:{ruleId}`, `job:{jobName}`, `queue:{file}`, `mail:bounce-rate`, `cache:{entité}`, `consistency:{contrôle}`, `storage:quota`, `redis`, `antivirus`. Alertes :
- un événement de la boîte d'envoi a échoué cinq fois (il est encore réessayé jusqu'au dixième échec, puis mis de côté : FIA-040) ;
- une exécution de règle est `FAILED` ;
- une tâche planifiée a échoué, ou n'a pas tourné depuis deux fois son intervalle (contrôlé par `jobs.watchdog`, AUT-081) ;
- plus de 500 messages en attente dans une file depuis 15 minutes ;
- le taux d'e-mails rejetés dépasse 5 % sur 24 heures ;
- le contrôle nocturne trouve un écart (AUT-090) ;
- l'antivirus est indisponible depuis 15 minutes (les fichiers restent en attente, MOD-350) ;
- le stockage atteint 80 % du quota de l'environnement, puis 100 %, où l'alerte est marquée urgente (MED-071).

**AUT-077** `[P1]` **Fin d'un accès exceptionnel.** À `elevatedUntil`, le rôle temporaire d'un compte `SUPPORT` est retiré, ses sessions sont révoquées, l'événement `support.elevation_ended` est émis et les `OWNERS` reçoivent `S_ELEVATION_ENDED` (ROL-016).

---

## 8. Tâches planifiées

**AUT-080** `[P1]` **Recalcul des montants de référence.** Après un nouveau cours de change ou l'annulation d'un cours (`exchange_rate.created`, `exchange_rate.voided`), ou après un changement d'un de ces paramètres (`setting.changed` sur `finance.reference.*`, `finance.exchangeRateKind`, `display.referenceCurrency`), une tâche de fond recalcule `priceFromRef`, `downPaymentRef` et `monthlyFromRef` de tous les biens concernés (CAL-033), par paquets de 500, puis revalide les pages publiques. Tant qu'elle tourne, le back-office affiche « Recalcul des prix en cours ({fait} / {total}) ». Une seconde demande pendant un recalcul attend la fin du premier, puis repart.

**AUT-081** `[P1]` **Calendrier.** Les heures sont celles du fuseau du calendrier de travail (`business.calendar.timezone`). Les nuits de changement d'heure, une tâche prévue à une heure qui n'existe pas (2 h 30 au printemps) tourne à l'heure suivante ; à une heure qui existe deux fois (à l'automne), elle tourne **une seule fois**, au premier passage. Les clés de AUT-012 rendent de toute façon un second passage sans effet.

| Tâche | Fréquence | Ce qu'elle fait | Règles |
|---|---|---|---|
| `outbox.dispatch` | En continu : un passage chaque seconde, 100 événements au plus | Traite les événements de la boîte d'envoi. N'écrit pas de `JobRun` (AUT-082). | FIA-040 |
| `workflow.execute` | Chaque minute | Exécute les règles différées arrivées à échéance (`scheduledFor`) et les nouveaux essais (`nextAttemptAt`) ; une règle à délai 0 n'attend pas ce passage (AUT-004). | AUT-004 |
| `jobs.watchdog` | Toutes les 5 min | Signale toute tâche à intervalle sans `JobRun` depuis deux intervalles ; pour `outbox.dispatch`, tout événement disponible depuis plus de 2 minutes sans être pris (`claimedAt` nul), hors ceux qui attendent derrière un événement en échec du même objet (FIA-040). | AUT-076 |
| `submission.publish_decisions` | Chaque minute | Publie les décisions dont `decisionAt` + 10 minutes est passé et `decisionPublishedAt` nul, selon l'horloge de l'application (ENV-032 en recette) ; `decisionPublishedAt` est posé dans la transaction qui dépose les événements : rejouée, la tâche ne publie rien deux fois. | CYC-165 |
| `sla.scan` | Toutes les 5 min | Demandes : avertissement et dépassement du délai. Dossiers : étape en retard. | CYC-007, CAL-062 |
| `reservation.scan` | Toutes les 15 min | Options expirées ; options qui expirent dans 2 jours. | CYC-105 |
| `appointment.scan` | Toutes les 15 min | Rappels à 24 h ; issues non renseignées. | CYC-080 |
| `event.scan` | Toutes les 5 min | Ouverture et clôture des inscriptions ; passage à `DONE` ; rappels à J−7 et J−1 ; suivi du lendemain ; absents 24 h après la fin. | CYC-180, CYC-185 |
| `elevation.expire` | Toutes les 5 min | Fin des accès exceptionnels. | AUT-077 |
| `message.digest` | Toutes les 5 min | E-mails « nouveau message » pour les messages restés non lus. | NOT-017 |
| `survey.dispatch` | Toutes les 15 min | Enquêtes à envoyer ; rappels. | AUT-065, AUT-066 |
| `alerts.instant` | Toutes les 15 min | Alertes immédiates. | AUT-060 |
| `task.scan` | Toutes les 15 min | Rappels de tâches (`task.due`). | TAC-030 |
| `share.expire` | Chaque heure | Liens de partage expirés. | BNK-110 |
| `document.expiry` | 2 h | Pièces expirées ; pièces qui expirent dans 15 jours. | CYC-145 |
| `client.status` | 3 h | Recalcul du statut des clients ; inactivité. | CYC-060 |
| `catalogue.nightly` | 3 h 30 | Archivage des biens vendus ; score de pertinence ; livraisons dépassées ; programmes vendus depuis 180 jours ; revalidation des pages dont un affichage dépend de la date du jour (étiquette « Nouveau », étiquette à durée limitée, livraison dépassée, « Mis à jour le »). | CYC-123, CAL-080, AUT-074, AUT-078, NAV-042 |
| `stats.flush` | Toutes les 5 min | Report des vues et des intérêts comptés dans `PropertyDailyStat` et dans les totaux des biens. | FIC-100 |
| `cache.audit` | 4 h | Contrôle des caches ; vérification de cohérence. | AUT-090, FIA-120 |
| `purge` | 4 h 30 | Purges. | AUT-091 |
| `retention` | 5 h, le dimanche | Conservation des données personnelles. | SEC-110 |
| `dossier.scan` | 7 h | Dossiers inactifs. | CYC-039 |
| `partner.scan` | 7 h 30 | Conventions et documents à renouveler ; taux de change anciens ; disponibilités et barèmes à vérifier ; compte `PARTNER` d'une candidature `DECLINED` depuis 30 jours → `DELETED` (ACP-083, MOD-100) ; `[P2]` `[P3]` relance d'une demande par lien restée sans réponse, puis signalement de son silence. | AUT-072, AUT-073, AUT-079, ACP-045 |
| `gdpr.scan` | 7 h 30 | Demandes d'exercice de droits à J+20. | AUT-075 |
| `alerts.daily` | 8 h | Alertes quotidiennes ; le lundi, alertes hebdomadaires ; avis de fin d'alerte ; alertes à désactiver ; suppression des alertes arrêtées par leur titulaire ou jamais confirmées depuis 30 jours. | AUT-060, AUT-061 |
| `favorites.watch` | Toutes les 15 min | Biens favoris archivés : notification `NC_FAVORITE_UPDATE`. | AUT-062 |
| `favorites.daily` | 8 h | E-mail quotidien des favoris ; favoris archivés depuis plus de 30 jours retirés. | AUT-062, SFA-022 |
| `digest.staff` | 8 h 30, jours ouvrés | Résumé du matin. | AUT-070 |
| `dossier.hold` | 9 h | Dossiers dont la reprise est prévue ce jour. | CYC-033 |
| `submission.scan` | 9 h | Décisions en retard ; offres qui expirent dans 5 jours ; offres expirées. | AUT-041, CYC-167 |
| `document.reminders` | 10 h, jours ouvrés | Relances de pièces. | AUT-042 |

**AUT-079** `[P1]` **Vérifications périodiques avec les partenaires.** Un catalogue tenu pour le compte des promoteurs vieillit sans bruit : un lot vendu hors plateforme reste « disponible », un taux change sans qu'on le sache. Deux vérifications ramènent l'équipe vers le partenaire à date fixe.
- **Disponibilités.** Un programme publié (ou un bien isolé publié) est **à vérifier** quand il a au moins un lot `AVAILABLE`, que son promoteur est `ACTIVE`, et que `stockConfirmedAt` — à défaut, sa première publication — a plus de `catalogue.stockCheckDays` jours (30). Tant qu'un promoteur a au moins un programme à vérifier et qu'aucune tâche de vérification n'est ouverte pour lui, la surveillance en crée une (`promoter.stock_check_due`, `R_STOCK_CHECK`) : **une par promoteur**, qui liste ses programmes — on l'appelle une fois, pas six. La tâche se termine quand plus aucun de ses programmes n'est à vérifier ; elle renaît quand la condition redevient vraie, y compris après une suspension ou une republication.
- **Barèmes.** Un produit utilisable (MOD-113) est à vérifier quand `ratesConfirmedAt` — à défaut, sa création — a plus de `finance.productCheckDays` jours (90) : `bankproduct.check_due`, d'où la tâche `R_PRODUCT_CHECK`, selon la même règle de renaissance.

Seul le geste explicite compte : « Disponibilités vérifiées » (CTL-064), « Barème vérifié » (BNK-024) — modifier un lot ou un taux ne vaut pas vérification de tous les autres. Une durée à 0 désactive la vérification correspondante. Au niveau 1, l'équipe appelle le partenaire ou lui écrit (`P_PROMOTER_STOCK_CHECK`, `P_BANK_PRODUCT_CHECK`), puis saisit ; à partir du niveau 2, l'e-mail part de lui-même et le partenaire répond par lien (ACP-043, ACP-046).

**AUT-082** `[P1]` **Règles d'exécution.**
- Une tâche planifiée ne tourne que sur **une** instance à la fois (verrou partagé). Si l'exécution précédente n'est pas finie, la nouvelle est sautée ; un passage sauté n'écrit pas de `JobRun`, et le diagnostic affiche « Passage précédent encore en cours » tant que le verrou est tenu.
- Elle est **rejouable** : la lancer deux fois de suite ne produit aucun doublon (clés de AUT-012).
- Elle travaille par paquets (500 objets au plus par transaction) et reprend là où elle s'est arrêtée.
- Après une panne, elle **rattrape** : une surveillance regarde tout ce qui est dû à l'instant où elle tourne, pas seulement ce qui est devenu dû depuis son dernier passage. Les **rappels datés** ne partent pas en retard quand ils n'ont plus de sens : un rappel de rendez-vous n'est pas envoyé après l'heure du rendez-vous ; un rappel de Café à J−1 n'est pas envoyé le jour même après le début.
- Son début, sa fin, sa durée et ses compteurs sont enregistrés (`JobRun`) — sauf pour `outbox.dispatch`, qui tourne en continu et se lit dans le bloc « Boîte d'envoi » — et visibles dans l'écran de diagnostic (ADM-080), d'où un compte Support peut la **lancer maintenant** ; ce lancement est tracé.
- Elle lit l'heure par l'horloge de l'application (ARC-060) : en recette, elle suit l'horloge décalée (ENV-032).

**AUT-083** `[P1]` **Les automatisations font partie du socle.** Le moteur — boîte d'envoi, exécution des règles, planificateur des tâches — est livré avec le Lot 1 ; ensuite, **chaque module livre ses propres règles, ses propres tâches planifiées et ses propres modèles d'e-mail** en même temps que ses écrans (`08-tracabilite/02`). Une transition qui dépend d'une échéance (une option qui expire, une tâche créée par une règle) fonctionne donc dès la livraison qui l'apporte. Ce qui arrive en dernier, c'est l'**écran de réglage** des règles (COM-060), pas les règles.

**AUT-084** `[P1]` **Avant le travailleur et Redis** (D-097). Tant que le processus `worker` à part, la file de travail sur Redis et le moteur de règles (`workflow.execute`) ne sont pas livrés, le processus de l'API porte lui-même, dans les rôles `worker` et `all` — et dans le rôle `api` en local — : la lecture de la boîte d'envoi (`outbox.dispatch`) ; les tâches `alerts.instant`, `alerts.daily`, `favorites.watch` et `favorites.daily`, chaque passage écrivant son `JobRun`, et un passage encore en cours depuis moins de 30 minutes empêchant le suivant (AUT-082) ; les purges des jetons et des sessions (AUT-091) et celle des conversations de l'assistant, toutes les 6 heures (IA-013) ; les deux règles dont la livraison 1 a besoin, `R_VERIFICATION_REMINDER` (AUT-045) et `R_PARTNER_APPLICATION_SUBMITTED` (§ 5.1), exécutées avec la clé de déduplication de leur règle — quand le moteur arrive, il les reprend sans double envoi. Les passages sont les mêmes ; seul leur déclencheur change.

**AUT-090** `[P1]` **Contrôle nocturne des caches.** La tâche `cache.audit` recalcule depuis les données sources, et compare :

| Objet | Champs contrôlés |
|---|---|
| `Property` | compteurs de lots, disponibilité, prix et surfaces, montants de référence, indicateurs de médias, score de complétude, indicateurs de financement. `viewCount` et `interestCount` ne sont **pas** contrôlés : ils cumulent depuis la création du bien, alors que le détail par jour n'est gardé que 25 mois (AUT-091) |
| `Dossier` (lot visé) | sur un dossier **ouvert ou en pause** : un `lotId` sans réservation active qui désigne un lot non `AVAILABLE` (CYC-102) : vidé, conseiller notifié. Un dossier gagné garde son lot. |
| `Program` | `lotsTotal`, `lotsAvailable`, `lotsHeld`, `lotsSold`, `listedPropertyCount`, `lastSoldAt`, `priceFrom`, `priceFromRef` |
| `Dossier` | `requiredDocsCount`, `satisfiedDocsCount`, `completenessPct` |
| `Event` | `seatsTaken`, `waitlistSeats`, `attendedSeats` |
| `Conversation` | `unreadByClient`, `unreadByStaff` |
| `Client` | `status`, `marketingOptIn` |
| `Lot` | cohérence entre `status` et réservation active (un lot `OPTIONED` ou `RESERVED` sans réservation active ni `externalSale`, ou l'inverse) |

Tout écart est **corrigé**, sauf le dernier (lot et réservation), qui est seulement signalé : il demande une décision humaine. Chaque écart est écrit dans le journal d'audit (acteur système) et déclenche `system.cache_drift` (AUT-076). Un écart est un défaut à corriger dans le code, pas une situation normale.

**AUT-091** `[P1]` **Purges.** Suppression **physique**, par la tâche `purge`.

| Objet | Supprimé après | Paramètre |
|---|---|---|
| Objets en corbeille (suppression logique) : programmes, biens, lots, médias, promoteurs, banques, produits bancaires, autres partenaires et leurs documents, Cafés, dossiers ouverts par erreur (CYC-038), fiches clients et dossiers écartés avec une demande indésirable (CYC-006), fiches d'une inscription désavouée (« Ce n'est pas moi », AUTH-013), notes, tâches, modèles d'e-mail `M_`, messages supprimés par leur auteur (leur texte et leurs fichiers seulement : la ligne reste, avec la trace « Message supprimé »), questions de FAQ, témoignages, modèles de listes ; avec leurs fichiers | 30 jours | `retention.trashDays` |
| Demandes indésirables (`SPAM`). La fiche et le dossier qu'une telle demande avait créés sont déjà partis avec la corbeille, à 30 jours (CYC-006) | 90 jours | `retention.spamDays` |
| Simulations anonymes, enregistrées ou non (MOD-371), avec l'e-mail qui les a envoyées (SIM-032) ; simulations d'un client faites par lui (`createdById` nul) qui ne sont pas enregistrées (`isSaved` faux : jamais enregistrées, ou retirées de « Mes simulations », SFA-011) et ne sont liées à aucune demande ni à aucun dossier | 30 jours | `retention.anonymousSimulationDays` |
| Fréquentation des biens par jour (`PropertyDailyStat`) | 25 mois | — |
| Exécutions des tâches planifiées (`JobRun`) | 90 jours | — |
| Comptes clients jamais vérifiés, sans demande, dossier ni inscription | 30 jours | `retention.unverifiedAccountDays` |
| Notifications | 180 jours | `retention.notificationDays` |
| Jetons à usage unique expirés ou utilisés | 7 jours après l'expiration | — |
| Sessions expirées ou révoquées | 30 jours. La dernière session de chaque appareil d'un compte (`deviceKey`) est gardée 13 mois — une ligne expirée ou révoquée, qui ne peut plus servir à se connecter — : c'est la mémoire des appareils reconnus (AUTH-033) | — |
| Clés d'idempotence | à `expiresAt` (24 heures) | — |
| Archives des paquets de soumission (le manifeste reste) | 30 jours | `submission.packageRetentionDays` |
| Fichiers d'export | 24 heures ; 7 jours pour un export de données personnelles | — |
| Fichiers d'import | 30 jours | — |
| Retours du fournisseur d'e-mail déjà traités (`MailWebhookEvent`) | 30 jours | — |
| Événements traités de la boîte d'envoi | 30 jours | `retention.outboxDays` |
| Exécutions de règles | 180 jours | — |
| Fichiers refusés par l'antivirus | immédiatement (MOD-350) | — |
| Adresse laissée avec un signalement (`Feedback.contactEmail`, champ vidé) et adresse des e-mails qui lui ont répondu (`Communication.toAddress` des lignes rattachées au retour, FBK-005) | 90 jours après `handledAt` (retour traité ou classé sans suite) ; 180 jours après sa création pour un retour jamais traité | — |
| Dépôts annoncés (`Upload`), confirmés ou non, avec le fichier `uploads/{id}` d'un dépôt abandonné | 24 heures après `expiresAt` | — |

Un objet en corbeille n'est pas purgé s'il est encore **référencé** par un objet vivant (un bien supprimé cité par un dossier) : il reste, invisible. La conservation des données personnelles (clients inactifs, dossiers clos, pièces, journal d'audit) suit une politique à part : `06-technique/03`, SEC-110.
