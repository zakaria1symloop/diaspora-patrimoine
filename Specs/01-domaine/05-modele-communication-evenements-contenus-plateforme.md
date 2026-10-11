# Modèle de données — communication, satisfaction, Le Café, contenus, plateforme

Conventions : `01-modele-conventions-et-vue-d-ensemble.md`. ⌫ = `deletedAt`. ⟳ = `version`.

---

## 1. Communication

### 1.1 `EmailTemplate` et `EmailTemplateVersion`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `code` | `Varchar(60)` | oui | Code stable (`C_DOC_REQUEST`). Liste complète : `09-notifications-et-emails.md`. |
| `locale` | `Locale` | oui | Unicité : (`code`, `locale`). Une ligne par langue — les modèles n'utilisent pas la table `Translation` (TRV-004) ; seule la ligne `fr` existe en Phase 1, et elle sert pour toute langue sans ligne propre (TRV-005). |
| `audience` | `EmailAudience` | oui | |
| `category` | `EmailTemplateCategory` | oui | Modèles livrés : NOT-040. |
| `name` | `Varchar(120)` | oui | Nom lisible dans le back-office ; pour un modèle livré : NOT-040. |
| `description` | `Varchar(300)` | non | Quand ce modèle part. |
| `subject` | `Varchar(200)` | oui | Peut contenir des champs dynamiques. |
| `preheader` | `Varchar(160)` | non | Texte d'aperçu. |
| `bodyHtml` | texte | oui | Corps du message, sans l'habillage commun, au format de NOT-061 (Markdown restreint et champs dynamiques ; le nom du champ est resté) ; c'est son rendu qui est nettoyé (SEC-060). |
| `bodyText` | texte | non | Version texte ; produite au rendu à partir du corps si elle est vide (NOT-061). |
| `variables` | `Varchar(60)[]` | oui | Champs dynamiques autorisés dans ce modèle. |
| `requiredVariables` | `Varchar(60)[]` | oui | Champs qui **doivent** figurer dans le corps ou le sujet (le lien d'un e-mail à jeton, par exemple). L'éditeur refuse d'enregistrer un modèle qui en omet un (COM-051). Fixé par le code. |
| `secretVariables` | `Varchar(60)[]` | oui | Champs dont la valeur est un **lien à jeton**, un **code** (activation, connexion, invitation, partage, enquête, gestion d'une inscription, préférences) ou l'**extrait d'un message** (NOT-017). Leur valeur n'est jamais conservée : NOT-002. Fixé par le code. |
| `preferenceGroup` | `Varchar(40)` | non | Groupe de préférences du destinataire dont dépend l'envoi (NOT-020). Nul = e-mail de service, toujours envoyé. Fixé par le code pour les modèles livrés ; choisi à la création pour un modèle `M_` (NOT-042), puis non modifiable. |
| `originSubject`, `originPreheader`, `originBodyHtml` | texte | non | Texte **d'origine** du modèle livré, tel que les données de départ l'ont posé pour la dernière fois. Sert à savoir si le texte a été modifié dans le back-office, et à « Rétablir le texte d'origine » (PAR-081). |
| `isSystem` | booléen | oui | Vrai : ne peut être ni supprimé ni désactivé (e-mails de compte et de sécurité). Son texte reste modifiable. |
| `isActive` | booléen | oui | Faux : le modèle n'est plus envoyé ; l'automatisation qui l'utilise est ignorée et le signale dans son journal. |
| `sentBy` | `TriggerKind[]` | oui | Comment ce modèle part (NOT-040) : source de la colonne « Envoyé par » (COM-050). Fixé par le code ; pour un modèle `M_` : `MANUAL`, plus `WORKFLOW` s'il porte un groupe. |
| `deletedAt` | date-heure | non | Suppression logique d'un modèle `M_` (COM-053, TRV-096). |
| `version` | entier | oui | Augmente à chaque enregistrement ; sert aussi au verrouillage optimiste (MOD-007). |
| `updatedById` | UUID → `User` | non | |

À chaque enregistrement, l'état précédent est copié dans `EmailTemplateVersion` (immuable : `createdAt` seulement, MOD-004). Les vingt dernières versions sont conservées et peuvent être restaurées.

`EmailTemplateVersion` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `templateId` | UUID → `EmailTemplate` | oui | Cascade. |
| `version` | entier | oui | Numéro de la version copiée. Unicité : (`templateId`, `version`). |
| `subject` | `Varchar(200)` | oui | |
| `preheader` | `Varchar(160)` | non | |
| `bodyHtml` | texte | oui | |
| `updatedById` | UUID → `User` | non | Auteur de la version copiée. |

### 1.2 `Communication` — échange tracé

Une ligne par e-mail envoyé, et par appel, échange WhatsApp ou rencontre **noté** par le personnel.

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `channel` | `Channel` | oui | |
| `direction` | `Direction` | oui | Défaut `OUTBOUND`. |
| `clientId`, `dossierId`, `leadId`, `submissionId`, `eventId`, `registrationId`, `simulationId`, `promoterId`, `bankId`, `feedbackId`, `dataRequestId`, `exportJobId` | UUID | non | Rattachements. Au moins un est renseigné, sauf pour un e-mail interne (`staffUserId`). Sans `clientId`, la ligne s'adresse à quelqu'un qui n'a pas de fiche : un promoteur ou une banque écrit depuis sa fiche (`promoterId`, `bankId`), la personne qui a signalé une erreur et laissé son adresse (`feedbackId`), le demandeur d'un exercice de droits sans fiche (`dataRequestId`), le destinataire d'un export remis par lien (`exportJobId`), l'auteur d'une candidature de partenaire (`leadId`, COM-020), un visiteur à qui une simulation est envoyée (`simulationId`, SIM-032 ; clé étrangère `CASCADE` : la ligne d'envoi d'une simulation anonyme disparaît avec elle, MOD-371). La ligne apparaît dans la chronologie de l'objet auquel elle se rattache. |
| `staffUserId` | UUID → `User` | non | Destinataire d'un e-mail interne. |
| `templateCode` | `Varchar(60)` | non | |
| `templateVersion` | entier | non | |
| `subject` | `Varchar(200)` | non | |
| `body` | texte | selon | E-mail : nul tant que la ligne est `QUEUED` ; écrit par le travailleur au moment de l'envoi (NOT-010) : le HTML tel qu'envoyé, **expurgé** de ses liens à jeton, de ses codes et de l'extrait d'un message (`secretVariables`), remplacés par « [lien personnel] », « [code] » et « [extrait du message] » (NOT-002, NOT-017). Autre canal : le compte rendu saisi. |
| `toAddress` | `Citext` (254) | selon | E-mail. |
| `ccAddresses` | `Citext[]` | non | |
| `fromAddress`, `replyTo` | `Citext` (254) | non | |
| `attachments` | `Json` | non | `[{name, storageKey, sizeBytes, mimeType}]`. |
| `providerMessageId` | `Varchar(200)` | non | Identifiant chez le fournisseur d'e-mail ; sert à recevoir les statuts. |
| `deliveryState` | `DeliveryState` | selon | E-mail seulement. Défaut `QUEUED`. |
| `triggeredBy` | `TriggerKind` | oui | |
| `ruleId` | UUID → `WorkflowRule` | non | |
| `sentById` | UUID → `User` | non | Nul = automatique. |
| `scheduledFor` | date-heure | non | Envoi différé. |
| `sentAt`, `deliveredAt`, `openedAt`, `clickedAt`, `failedAt` | date-heure | non | |
| `failureReason` | `Varchar(300)` | non | Raison d'un échec, ou d'un e-mail écarté (`SUPPRESSED`, AUT-007). |
| `cancelledAt`, `bouncedAt`, `complainedAt` | date-heure | non | Annulation d'un envoi différé (`CANCELLED`, COM-020) ; rejet définitif ; signalement. |
| `stateHistory` | `Json` | oui | Défaut `[]`. Chaque état et chaque retour du fournisseur, avec sa date : `[{state, at}]` — y compris un retour qui ne change pas l'état (API-095). C'est la « suite des états » du détail d'un envoi (COM-041). |
| `resentFromId` | UUID → `Communication` | non | Ligne d'origine d'un e-mail renvoyé (COM-042). |
| `occurredAt` | date-heure | oui | Moment de l'échange. Pour un appel noté après coup, l'heure réelle de l'appel. |
| `durationMinutes` | entier | non | Appel, rencontre. |
| `callOutcome` | `CallOutcome` | selon | Obligatoire pour un appel. |
| `dedupeKey` | `Varchar(200)` | non | Unique. Renseigné pour tout envoi automatique : `{templateCode}:{identifiant de l'événement}:{destinataire}`. Empêche un double envoi si un événement est traité deux fois (NOT-011). Pour un e-mail regroupé, la clé désigne l'objet commun (NOT-011). |
| `metadata` | `Json` | non | E-mail en file : de quoi le rendre à l'envoi, sous la clé `render` (NOT-010) — jamais un jeton ni un code. |

Index : (`dossierId`, `occurredAt`) · (`clientId`, `occurredAt`) · `providerMessageId` · (`deliveryState`, `scheduledFor`) · `dedupeKey` (unique).

**MOD-400** Le corps d'un e-mail envoyé n'est jamais modifié. Une ligne `Communication` d'e-mail ne se supprime pas ; un compte rendu d'appel, d'échange WhatsApp ou de rencontre peut être corrigé (texte, issue, date) ou supprimé par son auteur dans les 24 heures — le premier contact est alors recalculé (CYC-004). Le texte complet d'un e-mail qui porte un lien à jeton ou un code n'existe qu'en mémoire du travailleur, au moment de l'envoi (NOT-010) ; il n'est écrit ni en base, ni dans une file d'attente, ni dans un journal (SEC-040).

#### `MailWebhookEvent` — retour du fournisseur déjà traité

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `providerEventId` | `Varchar(200)` | oui | Identifiant du retour chez le fournisseur. Unique : un retour reçu deux fois n'est traité qu'une fois (API-095). |
| `providerMessageId` | `Varchar(200)` | oui | L'e-mail concerné (`Communication.providerMessageId`). |
| `kind` | `Varchar(40)` | oui | Nature du retour, telle que le fournisseur la nomme. |
| `receivedAt` | date-heure | oui | |

Purgé après 30 jours (AUT-091).

### 1.3 `Conversation`, `Message`, `MessageAttachment`

`Conversation` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `clientId` | UUID → `Client` | oui | |
| `dossierId` | UUID → `Dossier` | non | Un fil par dossier ; un seul fil général (sans dossier) par client, pour ce qui ne relève d'aucun dossier (MSG-001). Unicité : (`clientId`, `dossierId`, `partnerOrganizationId`), un seul fil général par client (colonnes vides comptées comme des valeurs, MOD-019). |
| `partnerOrganizationId` | UUID → `Organization` | non | `[P2]` `[P3]` Nul : fil entre le client et l'équipe. Renseigné : fil entre l'équipe et un promoteur ou une banque au sujet de ce dossier, **invisible du client** (PPR-023, PBQ-012). |
| `lastMessageAt` | date-heure | non | |
| `lastMessagePreview` | `Varchar(160)` | non | |
| `unreadByClient`, `unreadByStaff` | entier (cache) | oui | |
| `clientEmailedAt`, `staffEmailedAt` | date-heure | non | Dernier e-mail « nouveau message » envoyé à chaque partie ; limite la fréquence (NOT-017). |

`Message` ⌫ :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `conversationId` | UUID → `Conversation` | oui | |
| `senderType` | `MessageSenderType` | oui | `SYSTEM` : message automatique inséré dans le fil (« Votre pièce Passeport a été validée. »). |
| `senderUserId` | UUID → `User` | non | |
| `body` | texte (4 000) | oui | Texte brut. Peut être vide si le message a une pièce jointe. |
| `readByClientAt`, `readByStaffAt` | date-heure | non | |

`MessageAttachment` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `messageId` | UUID → `Message` | oui | Cascade. |
| `storageKey` | `Varchar(400)` | oui | Stockage privé, chiffré au repos. |
| `fileName` | `Varchar(200)` | oui | Nom d'origine, nettoyé. |
| `mimeType` | `Varchar(100)` | oui | Type constaté à la lecture du fichier. |
| `sizeBytes` | entier long | oui | |
| `checksumSha256` | `Char(64)` | oui | |
| `scanStatus` | `ScanStatus` | oui | Défaut `PENDING`. |
| `filedAsDocumentId` | UUID → `DossierDocument` | non | Pièce du dossier dans laquelle le conseiller a classé ce fichier (GED-050). `SET NULL` à la suppression de la pièce. |
| `filesPurgedAt` | date-heure | non | Fichier effacé par la politique de conservation (SEC-110) ; la ligne reste. |

Cinq fichiers au plus par message, mêmes règles que les pièces : contrôle antivirus, lecture par adresse signée, ouverture par l'équipe tracée (GED-002), et même durée de conservation que les fichiers des pièces du dossier (SEC-110). Classer une pièce jointe la **copie** dans la pièce : le fil garde la sienne.

**MOD-401** Un message ne se modifie pas. Son auteur — client ou membre de l'équipe — peut le supprimer dans les 5 minutes qui suivent l'envoi ; le fil affiche alors « Message supprimé » (effets : MSG-015). Passé ce délai, il reste.

### 1.4 `Notification` et `NotificationPreference`

`Notification` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `userId` | UUID → `User` | oui | Cascade. |
| `type` | `Varchar(60)` | oui | Code de la liste de `09-notifications-et-emails.md`. |
| `title` | `Varchar(160)` | oui | |
| `titlePlural` | `Varchar(160)` | non | Forme plurielle d'une notification regroupée, rendue à la création avec `{n}` laissé en place ; l'écran l'affiche, `{n}` remplacé par `count`, dès que `count` dépasse 1 (NOT-016, NOT-031). |
| `body` | `Varchar(400)` | non | |
| `link` | `Varchar(400)` | non | Chemin dans l'application du destinataire. |
| `entityType`, `entityId` | `Varchar(40)` (nom du modèle Prisma), UUID | non | Objet concerné : celui que son lien ouvre (NOT-032). |
| `count` | entier | oui | Défaut 1. Nombre d'événements regroupés dans cette notification (NOT-016). |
| `dedupeKey` | `Varchar(200)` | non | Unique par utilisateur. `{type}:{objet commun}:{identifiant de la requête d'origine}` — la requête, non chaque événement : un geste qui émet plusieurs événements ne notifie qu'une fois (NOT-035). |
| `readAt` | date-heure | non | |

Index : (`userId`, `readAt`, `updatedAt`) · (`userId`, `dedupeKey`) unique. Les listes sont triées sur `updatedAt`, qu'un regroupement avance (NOT-016). Les notifications de plus de `retention.notificationDays` jours (180) sont purgées (AUT-091).

`NotificationPreference` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `userId` | UUID → `User` | selon | Membre du personnel. Cascade. Exactement l'un des deux champs `userId`, `clientId` est renseigné. |
| `clientId` | UUID → `Client` | selon | Client, avec ou sans compte. Cascade. |
| `group` | `Varchar(40)` | oui | Groupe de préférences (NOT-020). |
| `emailEnabled` | booléen | oui | |
| `pushEnabled` | booléen | oui | |

Unicité : (`userId`, `group`) parmi les lignes où `userId` est renseigné, (`clientId`, `group`) parmi celles où `clientId` l'est (deux index partiels : ici la colonne vide ne compte **pas** comme une valeur, à l'inverse du second cas de MOD-019). Les préférences d'un client tiennent à sa **fiche**, pas à son compte : la page sans connexion (PRO-031) les règle aussi pour une personne qui n'a pas d'espace, et elles restent quand elle en crée un. Groupes et valeurs par défaut : NOT-020. Le groupe `NEWS` n'a pas de ligne : il se lit sur le dernier `Consent` `MARKETING_EMAIL` de la fiche (MOD-106).

### 1.5 `WorkflowRule` et `WorkflowExecution`

`WorkflowRule` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `code` | `Varchar(60)` | non | Unique. Renseigné pour les règles livrées d'origine. |
| `name` | `Varchar(160)` | oui | |
| `description` | `Varchar(500)` | non | |
| `trigger` | `Varchar(60)` | oui | Déclencheur (liste : AUT-010). |
| `conditions` | `Json` | non | Schéma : AUT-020. |
| `delayValue` | entier | oui | Défaut 0. De 0 à 365. |
| `delayUnit` | `DelayUnit` | oui | Défaut `MINUTES`. `MINUTES`, `HOURS`, `DAYS` : temps calendaire. `BUSINESS_HOURS`, `BUSINESS_DAYS` : temps ouvré (AUT-004, CAL-060). |
| `actions` | `Json` | oui | Schéma : AUT-030. |
| `isActive` | booléen | oui | |
| `isSystem` | booléen | oui | Vrai : ne peut pas être supprimée, seulement désactivée ou ajustée. |
| `originDefinition` | `Json` | non | Pour une règle livrée : ses conditions, son délai et ses actions **d'origine**, tels que les données de départ les ont posés pour la dernière fois. Sert à savoir si l'équipe l'a ajustée, et à « Rétablir le réglage d'origine » (PAR-081, COM-061). |
| `sortOrder` | entier | oui | Ordre d'affichage, et ordre d'exécution des règles d'un même déclencheur. |
| `version` | entier | oui | Verrouillage optimiste (MOD-007). |
| `updatedById` | UUID → `User` | non | |
| `deletedAt` | date-heure | non | Suppression logique d'une règle créée dans le back-office : elle ne s'exécute plus, son journal reste lisible (AUT-004). |

`WorkflowExecution` — journal :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `ruleId` | UUID → `WorkflowRule` | oui | |
| `triggerEventId` | UUID | oui | Identifiant de l'événement déclencheur, **sans clé étrangère** : les événements traités sont purgés à 30 jours, les exécutions gardées 180 (AUT-091 ; exception à MOD-013). |
| `entityType`, `entityId` | `Varchar(40)` (nom du modèle Prisma), UUID | oui | |
| `scheduledFor` | date-heure | oui | |
| `executedAt` | date-heure | non | |
| `status` | `ExecutionStatus` | oui | |
| `skipReason` | `Varchar(200)` | non | « Conditions non remplies au moment de l'exécution », « Modèle désactivé », « Dossier en pause », « Annulée par {nom} » (COM-063)… |
| `error` | `Varchar(500)` | non | |
| `attempts` | entier | oui | Défaut 0. Essais faits après un échec d'action (AUT-004). |
| `nextAttemptAt` | date-heure | non | Prochain essai après un échec ; `workflow.execute` le prend comme une échéance. |
| `actionsDone` | entier | oui | Défaut 0. Nombre d'actions terminées, dans l'ordre : un nouvel essai reprend à la suivante. |

Unicité : (`ruleId`, `triggerEventId`) — une règle ne s'exécute qu'une fois par événement. Index : (`status`, `scheduledFor`) · (`status`, `nextAttemptAt`).

### 1.6 `Task` ⌫ ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `title` | `Varchar(160)` | oui | |
| `description` | texte (2 000) | non | |
| `type` | `TaskType` | oui | Défaut `FOLLOW_UP`. |
| `status` | `TaskStatus` | oui | Défaut `OPEN`. |
| `priority` | `Priority` | oui | Défaut `NORMAL`. |
| `dossierId`, `clientId`, `leadId`, `submissionId`, `eventId`, `propertyId`, `promoterId`, `bankId`, `bankProductId`, `appointmentId`, `reservationId`, `feedbackId` | UUID | non | Rattachements. |
| `suggestedTemplateCode` | `Varchar(60)` | non | Code du modèle d'e-mail que la tâche propose (`suggestedTemplate`, AUT-032) ; l'action « Écrire » l'ouvre (TAC-005). |
| `assigneeId` | UUID → `User` | non | Nul = à prendre par l'équipe. |
| `createdById` | UUID → `User` | non | |
| `origin` | `TaskOrigin` | oui | |
| `ruleId` | UUID → `WorkflowRule` | non | |
| `dedupeKey` | `Varchar(120)` | non | Empêche qu'une automatisation crée deux fois la même tâche : unique parmi les tâches `OPEN`. |
| `dueAt` | date-heure | non | |
| `dueHasTime` | booléen | oui | Défaut `true`. Faux : échéance « dans la journée » (TAC-003) — `dueAt` vaut alors la fin de la journée de travail de ce jour, la tâche n'est en retard que le lendemain, et son rappel part à 9 h. |
| `reminderKind` | `ReminderKind` | oui | Défaut `AT_DUE`. Réglage du rappel (TAC-003), d'où `remindAt` est calculé : `NONE` → nul ; `AT_DUE` → `dueAt` ; `BEFORE_15M`, `BEFORE_1H`, `BEFORE_1D` → `dueAt` moins ce délai ; `CUSTOM` → la date choisie, qui ne suit pas un report (TAC-005). Échéance sans heure : le rappel part à 9 h (TAC-030), le jour même, ou la veille pour `BEFORE_1D`. Sans échéance : nul, sauf `CUSTOM`. |
| `remindAt` | date-heure | non | Calculé d'après `reminderKind` ; recalculé quand l'échéance change. |
| `completedAt` | date-heure | non | |
| `completedById` | UUID → `User` | non | Nul si la tâche s'est terminée automatiquement (AUT-035). |
| `completionNote` | `Varchar(1000)` | non | Ce qui a été fait. |
| `cancelReason` | `Varchar(300)` | non | |

Index : (`assigneeId`, `status`, `dueAt`) · `dossierId` · `clientId`.

---

## 2. Satisfaction

### 2.1 `Survey` ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `code` | `Varchar(40)` | oui | Unique. Enquête créée dans le back-office : FBK-021. |
| `name` | `Varchar(120)` | oui | |
| `trigger` | `SurveyTrigger` | oui | |
| `delayHours` | entier | oui | Délai entre l'événement et l'envoi. |
| `intro` | `Varchar(400)` | non | |
| `originDefinition` | `Json` | non | Introduction et questions **d'origine** d'une enquête livrée (PAR-081). |
| `questions` | `Json` | oui | `[{id, type, label, required, options?, removedAt?}]`. Types (`SurveyQuestionType`) : `NPS` (0 à 10), `CSAT` (1 à 5), `CHOICE` (une réponse parmi `options`), `TEXT` (3 000 caractères). Huit questions posées au plus ; libellé de 200 caractères. Une option de `CHOICE` est `{id, label, action?}` (2 à 8 options, libellé de 80 caractères) : `action` est une nature de demande (`LeadKind`), limitée à `CALLBACK_REQUEST` et `PROJECTION_REQUEST`, et crée la demande correspondante quand elle est choisie (FBK-031). Les `id` des questions et des options sont stables : donnés à la création (les données de départ en donnent un à chacune), ils ne changent plus. Une question retirée reste, marquée `removedAt`, et n'est plus posée (FBK-022). |
| `isActive` | booléen | oui | |

### 2.2 `SurveyInvitation`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `surveyId` | UUID → `Survey` | oui | |
| `clientId` | UUID → `Client` | oui | |
| `dossierId`, `eventId` | UUID | non | Contexte. |
| `tokenHash` | `Char(64)` | oui | Unique. Permet de répondre sans se connecter. |
| `reminderTokenHash` | `Char(64)` | non | Unique. Jeton tiré pour le lien du rappel (AUT-066) : celui du premier e-mail n'est gardé qu'en empreinte (NOT-002) et ne peut pas être renvoyé. L'un et l'autre ouvrent l'invitation jusqu'à `expiresAt`. |
| `scheduledFor` | date-heure | oui | Moment d'envoi prévu : événement déclencheur + `Survey.delayHours`. |
| `sentAt`, `reminderSentAt`, `answeredAt` | date-heure | non | |
| `cancelledAt` | date-heure | non | Invitation annulée avant l'envoi (AUT-065). |
| `cancelReason` | `SurveyCancelReason` | selon | Obligatoire avec `cancelledAt` (AUT-065, FBK-041). |
| `expiresAt` | date-heure | oui | 30 jours après `scheduledFor`. |

Unicité : (`surveyId`, `clientId`, `dossierId`, `eventId`) parmi les invitations **non annulées** — une personne n'est invitée qu'une fois par enquête et par contexte (colonnes vides comptées comme des valeurs, MOD-019).

### 2.3 `Feedback`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `kind` | `FeedbackKind` | oui | |
| `surveyId`, `invitationId` | UUID | non | |
| `clientId`, `dossierId`, `propertyId`, `eventId` | UUID | non | |
| `promoterId`, `bankId` | UUID | non | Partenaire concerné par le retour : renseigné d'office quand le retour porte sur un bien (son promoteur) ou sur une décision bancaire (la banque). Sert aux indices par partenaire (FBK-050). |
| `authorOrganizationId` | UUID → `Organization` | non | `[P2]` `[P3]` Retour émis par un utilisateur d'un promoteur ou d'une banque, depuis son portail. |
| `stage` | `DossierStage` | non | Étape du dossier au moment du retour. |
| `npsScore` | entier | non | 0 à 10. |
| `csatScore` | entier | non | 1 à 5. Pour un avis spontané : sa note facultative (PRO-071). |
| `answers` | `Json` | non | `{idQuestion: {questionLabel, value, optionLabel?}}` : `value` est la note, le texte, ou, pour un choix, l'`id` de l'option ; les libellés sont ceux du moment de la réponse (FBK-003). |
| `comment` | texte (3 000) | non | |
| `category` | `FeedbackCategory` | non | |
| `contactEmail` | `Citext` (254) | non | Pour un signalement fait sans compte. |
| `listingErrorKind` | `ListingErrorKind` | selon | Obligatoire pour un retour `LISTING_ERROR` : ce que le visiteur dit inexact (DEM-018). |
| `status` | `FeedbackStatus` | oui | Défaut `NEW`. |
| `handledById` | UUID → `User` | non | |
| `handledAt` | date-heure | non | Passage à `ACTIONED` ou à `DISMISSED` (FBK-004) ; point de départ de l'effacement de `contactEmail` (AUT-091). |
| `actionNote` | `Varchar(1000)` | non | Ce qui a été fait ; pour « Sans suite », la raison facultative. |

Index : (`status`, `createdAt`) · `surveyId` · `dossierId`.

---

## 3. Le Café `[P1]`

### 3.1 `Event` ⌫ ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `reference` | `Varchar(24)` | oui | Unique (TRV-051). |
| `slug` | `Varchar(80)` | oui | Unique : `paris-17-octobre-2026`. |
| `title` | `Varchar(120)` | oui | Défaut : « Le Café – {lieu} – {date longue} ». |
| `locationLabel` | `Varchar(80)` | oui | Libellé public du lieu, tel qu'il figure sur l'accueil : « Paris », « Sud de la France ». |
| `cityName` | `Varchar(80)` | oui | Ville exacte (« Marseille »). |
| `countryCode` | `Char(2)` | oui | Défaut `FR`. |
| `venueName` | `Varchar(160)` | non | Communiqué aux inscrits seulement (TRV-045). |
| `venueAddress` | `Varchar(300)` | non | Idem. Obligatoire pour publier. |
| `venueNotes` | `Varchar(500)` | non | Accès, étage, code. Idem. |
| `startsAt`, `endsAt` | date-heure | oui | `endsAt` > `startsAt`. |
| `timezone` | `Varchar(64)` | oui | Défaut `Europe/Paris`. |
| `capacity` | entier | oui | 1 à 500. |
| `maxSeatsPerRegistration` | entier | oui | Défaut `events.maxSeatsPerRegistration` (4). |
| `registrationOpensAt` | date-heure | non | Nul = dès la publication. |
| `registrationClosesAt` | date-heure | oui | Défaut : `startsAt` − `events.closeHoursBefore` (24 h). |
| `description` | texte (3 000) | non | |
| `coverMediaId` | UUID → `Media` | non | |
| `hostUserId` | UUID → `User` | non | Membre du personnel responsable. |
| `status` | `EventStatus` | oui | Défaut `DRAFT`. |
| `publishedAt`, `cancelledAt` | date-heure | non | |
| `cancelReason` | `Varchar(500)` | selon | Obligatoire à l'annulation. Montré aux inscrits. |
| `seatsTaken` | entier (cache) | oui | Somme des places des inscriptions `REGISTERED` et `ATTENDED`. |
| `waitlistSeats` | entier (cache) | oui | |
| `attendedSeats` | entier (cache) | oui | Somme des présents des inscriptions `ATTENDED`. |
| `walkInSeats` | entier | oui | Défaut 0. Visiteurs venus sans inscription et qui n'ont pas laissé d'adresse e-mail, comptés à la main au pointage (EVT-053). |

**MOD-410** `seatsTaken` ne dépasse jamais `capacity` : l'inscription et la promotion depuis la liste d'attente se font sous verrou de ligne sur l'événement (`06-technique/04`, FIA-020).

### 3.2 `EventPartner`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `eventId` | UUID → `Event` | oui | Cascade. |
| `promoterId`, `bankId`, `partnerId` | UUID | un seul | Exactement un des trois. |
| `roleLabel` | `Varchar(80)` | non | « Promoteur », « Banque », « Notaire ». |
| `contactName` | `Varchar(160)` | non | Personne présente. Interne. |
| `isPublic` | booléen | oui | Défaut `true`. Vrai : nom et logo montrés sur la page du Café. |
| `sortOrder` | entier | oui | |

### 3.3 `EventRegistration` ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `eventId` | UUID → `Event` | oui | |
| `clientId` | UUID → `Client` | oui | Fiche créée ou retrouvée à l'inscription. |
| `firstName`, `lastName` | `Varchar(80)` | oui | |
| `email` | `Citext` (254) | oui | |
| `phone` | `Varchar(20)` | non | |
| `seats` | entier | oui | 1 à `maxSeatsPerRegistration`. |
| `status` | `RegistrationStatus` | oui | |
| `questions` | `Varchar(1000)` | non | « Vos questions pour le promoteur et le banquier ». |
| `topics` | `EventTopic[]` | oui | Sujets d'intérêt. Vide possible. `ISLAMIC_FINANCE` n'est proposé que si `features.islamicFinance` est vrai. |
| `source` | `LeadSource` | oui | |
| `manageTokenHash` | `Char(64)` | oui | Unique. Lien « Gérer mon inscription » des e-mails. |
| `checkInCode` | `Varchar(8)` | oui | Code court, unique par événement ; affiché en clair et en QR code. |
| `registeredAt` | date-heure | oui | |
| `promotedAt` | date-heure | non | Sortie de liste d'attente. |
| `cancelledAt` | date-heure | non | |
| `cancelledBy` | `CancelledBy` | non | |
| `cancelReason` | `Varchar(300)` | non | |
| `attendedAt` | date-heure | non | |
| `checkedInById` | UUID → `User` | non | |
| `reminder7SentAt`, `reminder1SentAt`, `followUpSentAt` | date-heure | non | |
| `utm` | `Json` | non | |
| `locale` | `Locale` | oui | |

Unicité : (`eventId`, `email`) parmi les inscriptions non annulées.

### 3.4 `EventNotifyRequest`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `email` | `Citext` (254) | oui | |
| `eventId` | UUID → `Event` | non | Café précis dont les inscriptions ne sont pas ouvertes. |
| `locationLabel` | `Varchar(80)` | non | « Prévenez-moi du prochain Café à Paris. » Nul = tous les lieux. |
| `clientId` | UUID → `Client` | non | |
| `notifiedAt` | date-heure | non | |
| `unsubscribeTokenHash` | `Char(64)` | oui | |

Unicité : (`email`, `eventId`, `locationLabel`).

---

## 4. Contenus

### 4.1 `ContentBlock` ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `key` | `Varchar(120)` | oui | `home.comparison`, `home.why.items`… Liste complète : CMS-020. Les coordonnées de contact ne sont pas des blocs : ce sont des paramètres (`contact.*`). |
| `locale` | `Locale` | oui | Unicité : (`key`, `locale`). |
| `type` | `ContentBlockType` | oui | |
| `value` | `Json` | oui | Selon le type ; schéma par clé. |
| `originValue` | `Json` | non | Valeur **d'origine** du bloc, telle que les données de départ l'ont posée pour la dernière fois : sert à savoir s'il a été modifié, et à « Rétablir le texte d'origine » (PAR-081, CMS-003). |
| `label` | `Varchar(160)` | oui | Nom dans le back-office. |
| `group` | `Varchar(60)` | oui | Page ou zone : « Accueil », « Pied de page », « Financements »… |
| `updatedById` | UUID → `User` | non | |

Les clés sont **fixées par le code** ; le back-office modifie les valeurs, il ne crée pas de nouvelles clés.

`ContentBlockVersion` : `blockId`, `value`, `updatedById`, `createdAt`. À chaque enregistrement d'un bloc, sa valeur précédente y est copiée ; les vingt dernières sont gardées par bloc (la plus ancienne est supprimée à l'arrivée de la vingt et unième) et peuvent être rétablies (CMS-003).

### 4.2 `Page` ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `slug` | `Varchar(80)` | oui | Unicité : (`slug`, `locale`). |
| `locale` | `Locale` | oui | |
| `kind` | `PageKind` | oui | Toujours `EDITORIAL` : les textes légaux sont des `LegalDocument` (§ 4.5) ; la valeur `LEGAL` n'est pas employée. |
| `title` | `Varchar(120)` | oui | |
| `body` | texte | oui | HTML nettoyé. |
| `seoTitle`, `seoDescription` | `Varchar(70)`, `Varchar(160)` | non | |
| `status` | `PublicationStatus` | oui | |
| `publishedAt` | date-heure | non | |

### 4.3 `FaqItem` ⌫

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `locale` | `Locale` | oui | |
| `category` | `FaqCategory` | oui | |
| `question` | `Varchar(200)` | oui | |
| `slug` | `Varchar(80)` | oui | Généré depuis la question (TRV-052) ; ancre de la question sur le site (EDI-040). Unicité : (`slug`, `locale`). |
| `answer` | texte (3 000) | oui | HTML nettoyé (gras, liens, listes). |
| `placements` | `FaqPlacement[]` | oui | Pages où la question apparaît. |
| `sortOrder` | entier | oui | |
| `isPublished` | booléen | oui | |
| `requiredFeature` | `Varchar(60)` | non | Clé d'un indicateur de PAR-010 (`features.cafe`…). Renseignée : la question n'est servie au public que si l'indicateur est vrai, quel que soit `isPublished` (EDI-040). |

### 4.4 `Testimonial` ⌫

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `displayName` | `Varchar(80)` | oui | « Nadia B. » |
| `residenceCity` | `Varchar(80)` | non | « Lyon ». |
| `purchaseSummary` | `Varchar(120)` | non | « T3 à Alger ». |
| `quote` | `Varchar(600)` | oui | |
| `photoMediaId` | UUID → `Media` | non | |
| `clientId` | UUID → `Client` | non | |
| `consentAt` | date | selon | Accord écrit de la personne. **Obligatoire pour publier.** |
| `keepAfterErasureConsentAt` | date | non | Accord écrit, distinct, de garder le témoignage publié si la personne fait effacer ses données (SEC-111). |
| `isPublished` | booléen | oui | |
| `sortOrder` | entier | oui | |

### 4.5 `LegalDocument`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `type` | `LegalDocumentType` | oui | |
| `version` | `Varchar(40)` | oui | « 2026-10 ». Unicité : (`type`, `version`, `locale`). |
| `locale` | `Locale` | oui | |
| `title` | `Varchar(120)` | oui | |
| `body` | texte | oui | |
| `effectiveAt` | date-heure | oui | |
| `publishedAt` | date-heure | non | |
| `requiresReacceptance` | booléen | oui | Défaut `true`. Faux pour une correction sans portée (faute de frappe) : l'acceptation n'est pas redemandée. |
| `changeSummary` | `Varchar(500)` | non | Ce qui change, en clair ; montré au client quand son acceptation est redemandée. |
| `createdById` | UUID → `User` | non | |

**MOD-420** La version **en vigueur** d'un texte est la plus récente dont `publishedAt` et `effectiveAt` sont passés. Une version publiée ne se modifie plus : on en crée une nouvelle. La publication d'une nouvelle version des conditions générales ou de la politique de confidentialité redemande leur acceptation à la prochaine connexion (AUTH-090), sauf si `requiresReacceptance` est faux.

### 4.6 `Redirect` et `Translation`

`Redirect` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `fromPath` | `Varchar(400)` | oui | Chemin d'origine, commençant par `/`. Unique. |
| `toPath` | `Varchar(400)` | oui | Chemin de destination. |
| `statusCode` | entier | oui | `301` ou `302`. |
| `createdById` | UUID → `User` | non | |

`Translation` `[V2]` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `entityType` | `Varchar(40)` | oui | Nom du modèle Prisma. |
| `entityId` | UUID | oui | |
| `field` | `Varchar(60)` | oui | |
| `locale` | `Locale` | oui | |
| `value` | texte | oui | |

Unicité : (`entityType`, `entityId`, `field`, `locale`). Voir TRV-004.

---

## 5. Plateforme

### 5.1 `Setting`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `key` | `Varchar(120)` | oui | Clé primaire. Liste et valeurs par défaut : `10-parametres-et-donnees-de-reference.md`. |
| `value` | `Json` | oui | Validée par le schéma de la clé. |
| `updatedById` | UUID → `User` | non | |

Un paramètre absent de la table prend sa valeur par défaut, définie dans le code. Toute modification est écrite dans le journal d'audit.

### 5.2 `AuditLog` — journal d'audit (immuable)

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `actorType` | `ActorType` | oui | |
| `actorId` | UUID → `User` | non | |
| `actorRole` | `Varchar(20)` | non | Rôle effectif au moment de l'action. |
| `elevationAuditId` | UUID → `AuditLog` | non | Action faite sous un accès exceptionnel (ROL-016) : l'identifiant de la ligne `support.elevation_granted` qui l'a ouvert. Sert au décompte de `S_ELEVATION_ENDED` et au filtre « Accès exceptionnel » (ADM-051). |
| `route` | `GestureRoute` | non | `[P2]` `[P3]` Pour un **geste de partenaire** (ACP-013) : la voie par laquelle il est entré. Les lignes écrites en Phase 1 valent `BACK_OFFICE`. |
| `partnerOrganizationId` | UUID → `Organization` | non | `[P2]` `[P3]` Le promoteur ou la banque au nom de qui le geste est fait. |
| `action` | `Varchar(60)` | oui | Code (liste : SEC-080). |
| `entityType` | `Varchar(40)` | oui | |
| `entityId` | UUID | non | |
| `entityLabel` | `Varchar(200)` | non | Référence de l'objet au moment de l'action (`DOS-2026-0042`, `DP-DZ-0142`), ou son nom s'il n'est pas une personne (programme, banque). **Jamais le nom, l'adresse ou le téléphone d'une personne** : le journal est immuable et survit à l'effacement des données (SEC-111) ; pour un client, l'écran retrouve son nom par `clientId` tant que la fiche existe, et affiche « Personne effacée » ensuite. |
| `clientId`, `dossierId` | UUID | non | Pour retrouver tout ce qui touche une personne ou un dossier. |
| `before`, `after` | `Json` | non | Champs modifiés seulement. Les valeurs sensibles sont remplacées par `"***"`. |
| `reason` | `Varchar(500)` | non | |
| `requestId` | `Varchar(40)` | non | |
| `ipHash` | `Char(64)` | non | |
| `userAgent` | `Varchar(400)` | non | |
| `createdAt` | date-heure | oui | |

Index : (`entityType`, `entityId`, `createdAt`) · (`actorId`, `createdAt`) · (`clientId`, `createdAt`) · (`dossierId`, `createdAt`) · `action`.

**MOD-430** Aucune route ne modifie ni ne supprime une ligne du journal. Le compte de base de données de l'application n'a que le droit d'**insertion** et de **lecture** sur cette table. La seule suppression est celle de la conservation (`retention.auditYears`, SEC-110) : elle est faite par la tâche `retention`, sous un compte de base **distinct**, qui n'a le droit de supprimer que les lignes plus anciennes que cette durée. De même, les lignes `Consent` ne sont jamais modifiées par l'application ; leur suppression à l'échéance de conservation suit le même chemin. Trois comptes de base distincts : le propriétaire du schéma (`MIGRATION_DATABASE_URL`), l'application (`DATABASE_URL`), la conservation (`RETENTION_DATABASE_URL`) — ENV-040. Ils existent avant la première migration (créés par le fichier `compose` en local, par la mise en place de l'environnement ailleurs) ; la première migration leur donne leurs droits ; les migrations suivantes, appliquées sous le compte propriétaire que seul le déploiement utilise (FIA-080), donnent au compte de l'application les droits ordinaires sur toute table qu'elles créent. Un test d'intégration vérifie que le compte de l'application ne peut ni modifier ni supprimer une ligne de `audit_logs` ou de `consents`.

### 5.3 `OutboxEvent` — boîte d'envoi transactionnelle

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `type` | `Varchar(80)` | oui | Nom de l'événement de domaine (`lead.created`, `dossier.stage_changed`…). Liste : AUT-010, et les événements techniques d'AUT-013. |
| `aggregateType`, `aggregateId` | `Varchar(40)` (nom du modèle Prisma), UUID | oui | Objet à l'origine. |
| `payload` | `Json` | oui | |
| `dedupeKey` | `Varchar(200)` | non | Unique. Renseigné pour les événements émis par une surveillance périodique, afin qu'un même fait ne soit signalé qu'une fois (AUT-012). |
| `occurredAt` | date-heure | oui | |
| `availableAt` | date-heure | oui | Pas de traitement avant. |
| `processedAt` | date-heure | non | |
| `attempts` | entier | oui | |
| `lastError` | `Varchar(500)` | non | Dernière erreur ; nomme le groupe d'effets en échec (AUT-003). |
| `claimedAt` | date-heure | non | Réservation par un travailleur (FIA-040) ; vidée à la fin du traitement. Plus de 5 minutes sans issue : réservation abandonnée (instance tombée), l'événement redevient disponible. |
| `parkedAt` | date-heure | non | Mis de côté au dixième échec (FIA-040) : plus aucun essai automatique. « Rejouer » (ADM-080) le vide, ainsi que `attempts`. |

Index : (`processedAt`, `parkedAt`, `availableAt`) · (`aggregateType`, `aggregateId`, `occurredAt`). Fonctionnement : `06-technique/04`, FIA-040.

### 5.4 `IdempotencyKey`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `key` | UUID | oui | Envoyée par le client de l'API, en minuscules (API-040). |
| `scope` | `Varchar(250)` | oui | Méthode, route et appelant : `user:{userId}` avec une session, sinon `ip:{ipHash}` (API-040). Unicité : (`key`, `scope`). |
| `requestHash` | `Char(64)` | oui | Empreinte du corps de la requête. |
| `responseStatus` | entier | non | Nul tant que la requête est en cours. Renseigné pour une réponse **réussie** ; une réponse d'erreur supprime la ligne : la clé reste libre (API-040). |
| `responseBody` | `Json` | non | |
| `userId` | UUID | non | |
| `expiresAt` | date-heure | oui | 24 heures. |

### 5.5 `Sequence`

Clé primaire : (`name`, `scope`), toutes deux obligatoires. Champ : `lastValue`. `scope` est l'**année** (`2026`) pour les références annuelles — `lead`, `dossier`, `submission`, `reservation`, `data_request` — et le **code du pays** (`DZ`) pour les biens (`property`), dont la numérotation ne repart pas chaque année. La ligne est créée à la première référence de l'année ou du pays ; l'incrément se fait sous verrou de ligne (FIA-030).

### 5.6 `DataRequest` — demande d'exercice de droits

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `reference` | `Varchar(20)` | oui | Unique. |
| `type` | `DataRequestType` | oui | |
| `status` | `DataRequestStatus` | oui | Défaut `RECEIVED`. |
| `clientId` | UUID → `Client` | non | |
| `requesterEmail` | `Citext` (254) | oui | |
| `details` | texte (2 000) | non | Ce que la personne demande. |
| `receivedAt` | date-heure | oui | |
| `dueAt` | date | oui | `receivedAt` + 30 jours. |
| `identityVerifiedAt` | date-heure | non | Obligatoire avant tout traitement. |
| `verificationMethod` | `Varchar(300)` | non | Comment l'identité a été vérifiée, quand la demande ne vient pas de l'espace client (ADM-062). |
| `handledById` | UUID → `User` | non | |
| `completedAt` | date-heure | non | |
| `rejectionReason` | `Varchar(500)` | selon | Obligatoire à l'état `REJECTED`. Envoyé au demandeur (`C_DATA_REQUEST_DONE`). |
| `outcomeNote` | texte (2 000) | non | Compte rendu interne de la clôture ; jamais envoyé. |
| `requesterMessage` | `Varchar(1000)` | non | Message au demandeur, saisi à la clôture, repris dans `C_DATA_REQUEST_DONE`. |
| `erasureResult` | `Json` | non | Effacement : nombre d'objets effacés et conservés, par type (ADM-064). |
| `exportJobId` | UUID → `ExportJob` | non | |
| `notes` | texte (2 000) | non | |

### 5.7 `SavedView` — vue enregistrée d'une liste du back-office

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `listKey` | `Varchar(60)` | oui | Liste concernée : `leads`, `clients`, `dossiers`, `tasks`, `properties`, `submissions`… |
| `name` | `Varchar(80)` | oui | Unique par propriétaire et par liste. |
| `ownerId` | UUID → `User` | oui | Cascade. |
| `isShared` | booléen | oui | Défaut `false`. Vrai : visible de toute l'équipe (BO-040). |
| `config` | `Json` | oui | `{filters, sort, columns, pageSize}`. |

`SavedViewDefault` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `userId` | UUID → `User` | oui | Cascade. |
| `listKey` | `Varchar(60)` | oui | Comme `SavedView.listKey`. |
| `viewKey` | `Varchar(60)` | oui | Identifiant d'une `SavedView`, écrit en texte, ou code d'une vue d'origine : pas de clé étrangère. |

Clé primaire : (`userId`, `listKey`). La vue ouverte d'office **pour cet utilisateur** sur cette liste, choisie parmi ses vues, les vues partagées et les vues d'origine (`viewKey` est l'identifiant d'une `SavedView` ou le code d'une vue d'origine). Une ligne au plus par utilisateur et par liste ; sans ligne, la vue d'origine par défaut du module s'ouvre. Si la vue choisie disparaît, la ligne est supprimée.

### 5.9 `JobRun` — exécution d'une tâche planifiée

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `jobName` | `Varchar(60)` | oui | Nom de la tâche (AUT-081). |
| `status` | `JobStatus` | oui | |
| `startedAt`, `finishedAt` | date-heure | oui / non | |
| `counters` | `Json` | non | Ce que la tâche a fait : `{scanned, changed, sent, skipped, failed}`. |
| `error` | `Varchar(500)` | non | |
| `triggeredById` | UUID → `User` | non | Renseigné quand la tâche a été lancée à la main depuis le diagnostic (ADM-080) ; nul pour une exécution planifiée. |

Une ligne par exécution. C'est ce que montre le diagnostic (AUT-082). Les lignes de plus de 90 jours sont purgées (AUT-091).

### 5.8 `ImportJob` et `ExportJob`

Un fichier d'import passe le contrôle antivirus avant d'être lu (MED-035). Dans un fichier d'export, une cellule qui commence par `=`, `+`, `-` ou `@` est précédée d'une apostrophe : aucun tableur ne l'exécute comme une formule (BO-041).

`ImportJob` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `type` | `ImportType` | oui | |
| `status` | `JobStatus` | oui | |
| `fileStorageKey`, `fileName` | `Varchar(300)` (clé dans le stockage privé), `Varchar(200)` | oui | |
| `target` | `Json` | oui | Pour `LOTS` : `{programId}`. |
| `mapping` | `Json` | oui | Colonne du fichier → champ. |
| `dryRun` | booléen | oui | Vrai : contrôle sans écriture. |
| `totalRows`, `validRows`, `flaggedRows`, `errorRows`, `createdCount`, `updatedCount` | entier | non | `flaggedRows` : lignes appliquées mais signalées (CTL-102). |
| `report` | `Json` | non | Erreurs et signalements par ligne : `[{row, field, level, code, message}]`, `level` = `ERROR` ou `FLAG` ; codes : CTL-101. |
| `createdById` | UUID → `User` | oui | |
| `startedAt`, `finishedAt` | date-heure | non | |

`ExportJob` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `type` | `ExportType` | oui | |
| `status` | `JobStatus` | oui | |
| `format` | `ExportFormat` | oui | |
| `filters` | `Json` | oui | Filtres de la liste au moment de la demande. |
| `storageKey` | `Varchar(400)` | non | Stockage privé. |
| `rowCount` | entier | non | |
| `requestedById` | UUID → `User` | oui | |
| `expiresAt` | date-heure | non | Le fichier est supprimé 24 heures après sa production ; 7 jours pour un export de données personnelles (`PERSONAL_DATA`). |
| `downloadedAt` | date-heure | non | |
| `error` | `Varchar(500)` | non | |

Tout export est tracé dans le journal d'audit avec ses filtres et son nombre de lignes.

### 5.10 `Upload` — dépôt annoncé, en attente de confirmation

Une ligne par fichier annoncé au premier temps d'un dépôt (API-080) : ce qui a été annoncé, par qui, pour quel objet, jusqu'à quand. Elle sert à la confirmation, puis à la purge.

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `ownerType` | `UploadTarget` | oui | Ce que deviendra le fichier. |
| `ownerId` | UUID | oui | L'objet auquel il sera rattaché, désigné par la route du dépôt : la pièce (`DOCUMENT`), le fil (`MESSAGE`), le propriétaire du média (`MEDIA`), le promoteur ou la banque (`PARTNER_DOCUMENT`), le programme visé (`IMPORT`), le client destinataire (`EMAIL_ATTACHMENT`). La confirmation passe par une route du même objet. |
| `requestedById` | UUID → `User` | non | Compte qui a annoncé le dépôt ; lui seul peut le confirmer (API-080). `[P2]` Nul pour un dépôt fait par lien. |
| `fileName` | `Varchar(200)` | oui | Nom d'origine, nettoyé (MED-012). |
| `declaredMimeType` | `Varchar(100)` | oui | Type annoncé ; pour une pièce, remplacé à la confirmation par le type **constaté** dans le contenu (MED-011), que reprend la `DocumentFile` créée avec la version (API-081, D-097). |
| `declaredSizeBytes` | entier long | oui | Taille annoncée ; l'adresse d'envoi l'impose (MED-015). |
| `declaredSha256` | `Char(64)` | oui | Empreinte annoncée (FIA-100). |
| `storageKey` | `Varchar(400)` | oui | `uploads/{id}`, dans l'espace privé (MED-016). |
| `status` | `UploadStatus` | oui | Défaut `PENDING`. `COMPLETED` : confirmé. `REJECTED` : refusé à la confirmation (type, taille ou empreinte), fichier effacé ; il faut annoncer un nouveau dépôt. |
| `expiresAt` | date-heure | oui | Annonce + 15 minutes : fin de validité de l'adresse d'envoi. |
| `completedAt` | date-heure | non | |
| `resultFileId` | UUID | non | Ligne de fichier créée à partir de ce dépôt (`DocumentFile`, `MessageAttachment`, `Media`…) : une seconde confirmation rend la même réponse (API-080). Pour une pièce (`DOCUMENT`), renseigné à la création de la version (API-081), pas à la confirmation : un dépôt confirmé sans `resultFileId` attend encore sa version. |

Index : (`status`, `expiresAt`). Toute ligne est purgée 24 heures après `expiresAt`, avec le fichier `uploads/{id}` s'il reste (AUT-091).

### 5.11 `AssistantConversation` — conversation de l'assistant `[P1]`

Une ligne par conversation de l'assistant conversationnel (ASS-052), **sans lien avec une identité** (IA-013) : ni client, ni compte, ni adresse IP.

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `provider`, `model` | `Varchar(40)`, `Varchar(80)` | oui | Fournisseur et modèle qui ont répondu (`AI_PROVIDER`, `AI_MODEL`, ENV-040). |
| `messages` | `Json` | oui | `[{role, text, at}]`, `role` = `visitor` ou `assistant` : les textes seuls, données personnelles masquées avant l'écriture (IA-003). Défaut `[]`. |
| `criteria` | `Json` | oui | Les critères compris, validés (clés de CAT-020). Défaut `{}`. |
| `propertyReferences` | `Text[]` | oui | Les biens montrés, vingt références au plus (ASS-030). |
| `handoffReason` | `Varchar(40)` | non | Raison du passage de main à un conseiller : `PERSONAL_SITUATION`, `NO_RELIABLE_ANSWER`, `VISITOR_ASKED`, `OUT_OF_SCOPE` (IA-010, IA-012). |
| `visitorTurns` | entier | oui | Messages du visiteur ; douze au plus (ASS-052). |
| `inputTokens`, `outputTokens`, `costMicros` | entier, entier, entier long | oui | Consommation de la conversation ; coût en millionièmes d'euro (IA-005). |
| `flags` | `Text[]` | oui | Signaux de qualité posés par le serveur, jamais montrés : `REFUSAL`, `STEP_LIMIT`, `INVALID_OUTPUT`, `FIGURE_NOT_FROM_DATA` (Q-061). |
| `expiresAt` | date-heure | oui | Début + 30 jours (IA-013). |

Index : (`expiresAt`). Pas de `version` ni de suppression logique : la ligne est supprimée physiquement à `expiresAt`, par un passage toutes les 6 heures (AUT-091). Une demande envoyée depuis la conversation (`assistantConversationId`, ASS-030) en copie le résumé dans `Lead.payload` : la conversation elle-même reste anonyme.

### 5.12 `AiUsageMonth` — consommation mensuelle d'un usage de l'IA `[P1]`

Clé primaire : (`usage`, `month`) — `usage` (`Varchar(40)`, `assistant` pour l'assistant), `month` (`Char(7)`, `AAAA-MM` dans le fuseau du calendrier de travail). Champs : `calls`, `inputTokens`, `outputTokens`, `costMicros` (cumul en millionièmes d'euro, IA-005), `alertedAt` (date-heure, facultatif : le premier dépassement du plafond du mois, signalé une seule fois, Q-060), `updatedAt`.

**MOD-431** `[P1]` **Plafond d'un usage de l'IA.** Avant chaque tour de l'assistant, le cumul `costMicros` du mois est comparé au plafond `ai.assistant.monthlyBudget` ; plafond atteint, ou plafond à 0 : l'assistant est servi en mode guidé jusqu'au mois suivant (ASS-052). Les prix des fournisseurs, en dollars, sont comptés un dollar pour un euro, et un modèle inconnu au prix le plus élevé connu : le plafond est atteint un peu tôt, jamais tard.
