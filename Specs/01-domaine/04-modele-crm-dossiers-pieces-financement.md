# Modèle de données — CRM, dossiers, pièces, financement

Conventions : `01-modele-conventions-et-vue-d-ensemble.md`. ⌫ = `deletedAt`. ⟳ = `version`. Les cycles de vie (statuts, transitions) sont dans `06-cycles-de-vie.md`.

---

## 1. CRM

### 1.1 `Client` ⌫ ⟳ — fiche d'un acquéreur

Une fiche peut exister **sans compte** (créée par une demande ou par un conseiller). `userId` est rempli quand la personne crée ou active son compte.

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `userId` | UUID → `User` | non | Unique. |
| `email` | `Citext` (254) | selon | Unique parmi les fiches non supprimées. Obligatoire, sauf pour une fiche **créée par l'équipe** avec un téléphone (prospect joint par téléphone ou WhatsApp, MOD-302). |
| `alternateEmails` | `Citext[]` | oui | Vide par défaut. Adresses des fiches absorbées par une **fusion** (CRM-080), et elles seules : une demande venant de l'une d'elles se rattache à cette fiche. Une adresse ne figure que dans une seule fiche. L'ancienne adresse d'un client qui en change n'y entre **pas** (AUTH-080) : elle peut appartenir à quelqu'un d'autre. |
| `emailDoubtful` | booléen | oui | Défaut `false`. Vrai si le domaine n'a pas d'enregistrement MX (TRV-043). |
| `emailBouncedAt` | date-heure | non | Dernier rejet définitif d'un e-mail. Tant qu'il est renseigné, aucun e-mail automatique n'est envoyé, hors e-mails de compte et de sécurité et accusé d'une nouvelle demande (NOT-014, AUT-007). |
| `firstName`, `lastName` | `Varchar(80)` | non | Peuvent manquer pour une demande faite avec la seule adresse e-mail (D-031). Obligatoires pour passer un dossier à l'étape `MATCHING`. |
| `phone` | `Varchar(20)` | non | E.164. |
| `phoneCheckNeeded` | booléen | oui | Défaut `false`. Vrai après un appel noté « Faux numéro » (CRM-030) : la fiche affiche « Téléphone à vérifier ». Remis à faux quand le téléphone est modifié, ou par « Numéro vérifié ». |
| `whatsappOptIn` | booléen | oui | Défaut `false`. « Je suis joignable sur WhatsApp à ce numéro. » |
| `preferredContactChannel` | `ContactChannel` | non | |
| `preferredContactSlot` | `ContactTimeSlot` | non | |
| `timezone` | `Varchar(64)` | non | Fuseau du client. Pris, dans l'ordre : de son compte à l'inscription (navigateur) ; de sa dernière demande (`Lead.callerTimezone`) ; du fuseau principal de son pays de résidence (`Country.timezone`). Modifiable par le client (profil) et par l'équipe. Pour un compte `CLIENT`, `User.timezone` en est la copie. Sert à l'heure locale montrée au conseiller (CRM-046), aux e-mails de rendez-vous (TRV-031) et aux heures calmes (AUT-006). Inconnu : fuseau du calendrier de travail. |
| `countryOfResidence` | `Char(2)` → `Country` | non | |
| `cityOfResidence` | `Varchar(80)` | non | |
| `nationalities` | `Char(2)[]` | oui | Vide possible. |
| `residencyStatus` | `ResidencyStatus` | non | |
| `birthDate` | date | non | Âge entre 18 et 100 ans. Donnée sensible (`client.sensitive.read`). |
| `preferredLanguage` | `Locale` | oui | Défaut `fr`. |
| `profession` | `Varchar(80)` | non | |
| `employmentType` | `EmploymentType` | non | |
| `employerName` | `Varchar(120)` | non | |
| `employedSince` | date | non | |
| `monthlyIncome` | `Decimal(12,2)` | non | Revenu net mensuel. Sensible. |
| `otherMonthlyIncome` | `Decimal(12,2)` | non | Sensible. |
| `monthlyDebts` | `Decimal(12,2)` | non | Mensualités des crédits en cours. Sensible. |
| `incomeCurrency` | `Char(3)` | selon | Obligatoire si l'un des trois montants ci-dessus est renseigné. |
| `downPayment` | `Decimal(14,2)` | non | Apport disponible. Sensible. |
| `downPaymentCurrency` | `Char(3)` | selon | |
| `budgetMax` | `Decimal(14,2)` | non | Budget total visé. |
| `budgetCurrency` | `Char(3)` | selon | |
| `budgetMonthly` | `Decimal(12,2)` | non | Mensualité visée. |
| `budgetMonthlyCurrency` | `Char(3)` | selon | |
| `preferredCountries` | `Char(2)[]` | oui | |
| `preferredRegionIds` | UUID[] | oui | |
| `preferredTypes` | `PropertyType[]` | oui | |
| `minRooms` | entier | non | |
| `purchasePurpose` | `PurchasePurpose` | non | |
| `purchaseTimeframe` | `PurchaseTimeframe` | non | |
| `financingPreference` | `FinancingPreference` | non | |
| `source` | `LeadSource` | non | Origine du premier contact. Jamais modifiée ensuite. |
| `utm` | `Json` | non | Paramètres de campagne du premier contact : `{source, medium, campaign, term, content}`. |
| `status` | `ClientStatus` (cache) | oui | Calculé (CYC-060). Défaut `PROSPECT`. |
| `qualifiedAt` | date-heure | non | |
| `qualifiedById` | UUID → `User` | non | |
| `score` | entier | non | 0 à 100 (CAL-070). Jamais montré au client. |
| `assignedAgentId` | UUID → `User` | non | Conseiller référent. |
| `marketingOptIn` | booléen (cache) | oui | État courant du consentement `MARKETING_EMAIL`. |
| `doNotContact` | booléen | oui | Défaut `false`. Vrai : opposition à tout contact commercial ; seuls partent les e-mails de service d'un dossier en cours, ceux du compte et de la sécurité, et ceux qui répondent à une démarche de la personne (AUT-007). |
| `doNotContactReason` | `Varchar(300)` | selon | Obligatoire quand `doNotContact` est vrai (CRM-060). |
| `doNotContactAt` | date-heure | non | |
| `mergedIntoId` | UUID → `Client` | non | Fiche absorbante après fusion (CRM-080). |
| `notDuplicateOfIds` | UUID[] | oui | Vide par défaut. Fiches avec lesquelles un doublon possible a été écarté (« Ce n'est pas un doublon », CRM-081) ; écrit des deux côtés. |
| `lastActivityAt` | date-heure | oui | Dernière action du client ou sur le client. |
| `archivedAt` | date-heure | non | |
| `archivedReason` | `Varchar(300)` | non | |
| `restrictedAt` | date-heure | non | Traitement **limité** : ses données sont conservées mais ne servent plus — aucune automatisation, aucun envoi, aucune modification hors du traitement de sa demande (seules exceptions : celles de AUT-007). |
| `restrictionReason` | `RestrictionReason` | selon | Obligatoire avec `restrictedAt`. `REQUEST` : limitation demandée par la personne (ADM-063). `DELETION_PENDING` : posée par une suppression de compte en attente (CYC-200) — elle ne remplace jamais une limitation demandée, et se rétracter ne lève que celle-ci. |
| `gdprErasedAt` | date-heure | non | Données personnelles effacées (SEC-110). |
| `searchText` | texte (généré) | oui | Nom, prénom, e-mail, téléphone, ville. Index GIN par trigrammes. |

Index : `email` (unique partiel) · `phone` · (`status`, `assignedAgentId`) · `lastActivityAt` · `countryOfResidence`.

**MOD-300** Une nouvelle demande pour une adresse e-mail déjà connue **se rattache** à la fiche existante. Elle ne modifie que les champs **vides** de la fiche ; les valeurs envoyées restent intégralement dans `Lead.payload`. Si une valeur envoyée diffère d'une valeur déjà présente (autre téléphone, autre pays), la fiche affiche un encart « Informations différentes dans la dernière demande » avec un bouton « Mettre à jour la fiche ».

**MOD-301** Deux fiches avec le même téléphone et des e-mails différents sont signalées comme **doublon possible** ; elles ne sont jamais fusionnées automatiquement.

**MOD-302** **Fiche sans adresse e-mail.** Elle n'existe que créée par l'équipe (CRM-025, CRM-041), avec un téléphone. Tant que l'adresse manque : la fiche porte « Sans e-mail » ; aucun compte ne peut être créé ni invité ; aucun e-mail ne part — à la place d'un e-mail **de service** lié à une demande ou à un dossier, une tâche « Prévenir {client} : {objet de l'e-mail} » est créée pour son conseiller (NOT-025), pour que rien ne se perde en silence ; les pièces sont déposées pour lui par le conseiller (GED-055) et son accord de transmission est enregistré par l'équipe, avec sa preuve (GED-070). Ajouter l'adresse plus tard rétablit le fonctionnement normal ; si elle appartient déjà à une autre fiche, l'écran propose la fusion (CRM-080).

**MOD-303** **Montants de la fiche repris d'une demande ou d'une simulation.** Un montant ne complète un champ vide de la fiche que dans **la devise de ce groupe** : si la fiche a déjà une devise de revenus (ou d'apport, ou de budget) différente de celle du montant reçu, le montant est converti dans la devise de la fiche (CAL-010), arrondi à l'unité ; sans cours, il n'est pas repris. Jamais deux montants d'un même groupe dans deux devises.

### 1.2 `ClientContact` — personne de confiance

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `clientId` | UUID → `Client` | oui | Cascade. |
| `fullName` | `Varchar(160)` | oui | |
| `relation` | `Varchar(60)` | non | « Frère », « Mère ». |
| `phone` | `Varchar(20)` | non | |
| `email` | `Citext` (254) | non | |
| `canVisitOnBehalf` | booléen | oui | Défaut `false`. |
| `notes` | `Varchar(300)` | non | |
| `informedConfirmedAt` | date-heure | non | Le client a coché « Je confirme avoir informé cette personne que je communique ses coordonnées. » (PRO-040). Nul pour une personne ajoutée par l'équipe. |

Cinq personnes au plus par client.

### 1.3 `Lead` — demande entrante

Ce que le visiteur a envoyé est **immuable** (`kind`, `payload`, `message`, coordonnées, contexte). Seuls les champs de traitement changent. Deux exceptions : une demande de projection peut être **complétée une fois** par son second écran, dans les 30 minutes (DEM-013) ; le dossier d'une candidature de partenaire (`application`) se modifie jusqu'à son envoi (ACP-087).

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `reference` | `Varchar(20)` | oui | Unique (TRV-051). |
| `kind` | `LeadKind` | oui | Immuable. |
| `source` | `LeadSource` | oui | Défaut `WEB_FORM`. Immuable. |
| `clientId` | UUID → `Client` | selon | Obligatoire, sauf pour `PARTNER_REQUEST` et pour une demande classée indésirable dès sa création (DEM-031), tant qu'elle n'est pas restaurée. |
| `firstName`, `lastName`, `email`, `phone` | `Varchar(80)`, `Varchar(80)`, `Citext` (254), `Varchar(20)` | selon le formulaire | Coordonnées **telles qu'envoyées**. Immuables. |
| `propertyId`, `programId`, `lotId` | UUID | non | Objet de la demande. Pour `PROPERTY_INTEREST` : `propertyId` obligatoire, ou à défaut `programId` (intérêt pour un programme sans typologie choisie, DEM-012). |
| `simulationId` | UUID → `Simulation` | non | Pour `SIMULATION_FOLLOWUP`. |
| `applicantUserId` | UUID → `User` | non | Inscription partenaire (EP-32) : le compte `PARTNER` créé par l'inscription (ACP-082). Nul pour « Devenir partenaire » (EP-23). |
| `partnerKind` | `PartnerDocumentOwner` | selon | Obligatoire pour une inscription partenaire : `PROMOTER` ou `BANK`. |
| `applicationStatus` | `PartnerApplicationStatus` | selon | Obligatoire pour une inscription partenaire ; nul sinon. Défaut `EMAIL_UNVERIFIED` ; `DRAFT` à la confirmation de l'adresse ; `SUBMITTED` à l'envoi du dossier ; `INFO_REQUESTED`, `APPROVED`, `DECLINED` par l'équipe (ACP-083, ACP-084). |
| `application` | `Json` | non | Les rubriques du dossier partenaire (ACP-087), sous leurs clés : `activity`, `documents` (références des `LeadFile`), `image`. Modifiable par le candidat jusqu'à `SUBMITTED`, puis par ses compléments seulement (ACP-083). |
| `applicationSubmittedAt` | date-heure | non | Envoi du dossier pour examen (ACP-087). |
| `payload` | `Json` | oui | Tous les champs du formulaire, tels qu'envoyés. Schéma par `kind` : `02-site-public/05`. |
| `message` | texte (2 000) | non | |
| `subject` | `ContactSubject` | selon | Objet choisi dans le formulaire de contact (obligatoire, DEM-015) ou de rappel (facultatif, DEM-014). |
| `preferredCallbackDate` | date | non | Demande de rappel. |
| `preferredSlot` | `ContactTimeSlot` | non | |
| `callerTimezone` | `Varchar(64)` | non | Fuseau du navigateur à l'envoi. Les créneaux souhaités se lisent dans ce fuseau. |
| `supplements` | `Json` | non | Envois répétés de la même demande dans les 24 heures (DEM-024) : `[{receivedAt, fields, message}]`. Immuable, comme le reste de l'envoi. |
| `locale` | `Locale` | oui | Langue de l'écran d'envoi. |
| `utm` | `Json` | non | |
| `referrer` | `Varchar(400)` | non | |
| `landingPath` | `Varchar(400)` | non | Première page vue dans la session. |
| `submittedFromPath` | `Varchar(400)` | non | Chemin de la page d'où le formulaire a été envoyé, sans paramètres ; pour « Écrire à mon conseiller » (MSG-021), la page de l'espace client d'où part le message. Envoyé par le formulaire. |
| `ipHash` | `Char(64)` | non | |
| `userAgent` | `Varchar(400)` | non | |
| `spamScore` | entier | oui | 0 à 100 (DEM-031). |
| `spamSignals` | `Json` | oui | Signaux de DEM-031 retenus à la création, avec leurs points : `[{"code": "FAST_SUBMIT", "points": 35}]`, `code` étant une valeur de `SpamSignal` ; `[]` si aucun (et pour une demande saisie par l'équipe). Immuable. |
| `needsReview` | booléen | oui | Défaut `false`. Vrai : demande suspecte, à vérifier par le personnel (DEM-031). Remis à faux par « Demande légitime » ou par un classement en indésirable (CRM-011). |
| `reviewedById`, `reviewedAt` | UUID → `User`, date-heure | non | Qui a levé le doute, et quand. |
| `completionTokenHash` | `Char(64)` | non | Jeton du second écran d'une projection. Vidé à la complétion ou à l'expiration. |
| `completionExpiresAt` | date-heure | non | Création + 30 minutes. |
| **Traitement** | | | |
| `status` | `LeadStatus` | oui | Défaut `NEW`. |
| `dossierId` | UUID → `Dossier` | non | Dossier ouvert ou rejoint (CYC-002). |
| `contextDossierId` | UUID → `Dossier` | non | Pour un message écrit depuis l'espace client (MSG-021) : le dossier d'où il part. Un simple repère pour le conseiller : il n'entraîne **aucun** des effets d'un rattachement — ni clôture d'office au premier contact, ni reprise du dossier, ni contrôle de cohérence. Une seule chose le lie au dossier : la demande change de conseiller avec lui (CYC-040). |
| `assignedAgentId` | UUID → `User` | non | |
| `takenAt` | date-heure | non | Prise en charge. |
| `firstContactAt` | date-heure | non | Premier échange noté avec le client après la demande. |
| `slaDueAt` | date-heure | non | Échéance du premier contact (CAL-061). |
| `slaBreachedAt` | date-heure | non | Renseigné par la tâche de surveillance quand l'échéance est dépassée sans contact. |
| `outcome` | `LeadOutcome` | selon | Obligatoire à la clôture. |
| `closedAt` | date-heure | non | |
| `closedById` | UUID → `User` | non | |
| `closeNote` | `Varchar(500)` | non | |

Index : (`status`, `createdAt`) · `clientId` · `assignedAgentId` · `kind` · `dossierId` · `slaDueAt`.

### 1.3 bis `LeadFile` ⌫ — fichier joint à une candidature de partenaire

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `leadId` | UUID → `Lead` | oui | Cascade. Demande d'une inscription partenaire seulement. |
| `section` | `Varchar(30)` | oui | `documents` (extrait d'immatriculation ou agrément, présentation) · `image` (logo) · `addition` (complément, ACP-083). |
| `label` | `Varchar(160)` | oui | « Extrait d'immatriculation », « Agrément », « Présentation de la société », « Logo », « Complément ». |
| `storageKey` | `Varchar(400)` | oui | `private/leads/{leadId}/{fileId}` (MED-016). |
| `fileName`, `mimeType`, `sizeBytes`, `checksumSha256` | `Varchar(200)`, `Varchar(100)`, entier, `Char(64)` | oui | Comme un `DocumentFile` (API-080, MED-011). |
| `scanStatus` | `ScanStatus` | oui | Analyse antivirus (MED-012). Un fichier infecté n'est jamais servi ni reporté. |
| `uploadedById` | UUID → `User` | oui | Le candidat. |

À l'acceptation (ACP-084), les fichiers de `documents` deviennent des `PartnerDocument` du promoteur ou de la banque créé (copie de l'objet de stockage), le logo un `Media` du partenaire ; les `LeadFile` restent sur la demande, qui garde l'historique de la candidature.

### 1.4 `Favorite` `[P1]`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `clientId` | UUID → `Client` | oui | Cascade. |
| `propertyId` | UUID → `Property` | oui | Cascade. |

Clé primaire : (`clientId`, `propertyId`). Cent favoris au plus par client.

### 1.5 `SearchAlert` `[P1]` et `AlertDelivery`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `clientId` | UUID → `Client` | non | Nul pour une alerte créée sans compte. |
| `email` | `Citext` (254) | oui | |
| `label` | `Varchar(120)` | non | Généré d'après les critères (« Appartement T3 · Alger · jusqu'à 500 € / mois »). |
| `criteria` | `Json` | oui | Mêmes clés que les filtres du catalogue (CAT-020), sauf celles que CAT-072 n'enregistre pas (`sort`, `page`, `availability`, `vue`, `groupe`, `bbox`). |
| `frequency` | `AlertFrequency` | oui | Défaut `DAILY`. |
| `isActive` | booléen | oui | |
| `confirmedAt` | date-heure | non | Alerte sans compte : confirmation par un lien reçu par e-mail. Aucune alerte n'est envoyée avant. |
| `unsubscribeTokenHash` | `Char(64)` | oui | Unique. |
| `lastSentAt` | date-heure | non | |
| `expiresAt` | date-heure | oui | Création ou dernière prolongation + `alerts.lifetimeDays` (180 jours). |
| `expiryNoticeSentAt` | date-heure | non | Envoi de `C_ALERT_EXPIRING`. Remis à nul à chaque prolongation. |
| `deactivatedAt` | date-heure | non | |
| `deactivatedReason` | `AlertDeactivationReason` | non | |

Dix alertes actives au plus par adresse e-mail ; seules comptent les alertes qui envoient (fréquence autre que `NONE`). Les recherches enregistrées (fréquence `NONE`, CAT-093) ont leur propre limite : vingt par compte (Q-051). Une alerte non prolongée est désactivée à `expiresAt` (`EXPIRED`, AUT-061).

`AlertDelivery` — bien déjà envoyé pour une alerte :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `alertId` | UUID → `SearchAlert` | oui | Cascade. |
| `propertyId` | UUID → `Property` | oui | Cascade. |
| `sentAt` | date-heure | oui | |

Clé primaire : (`alertId`, `propertyId`) — un bien n'est envoyé qu'une fois par alerte.

### 1.6 `Note` ⌫ — note interne

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `entityType` | `NoteEntityType` | oui | |
| `entityId` | UUID | oui | |
| `body` | texte (5 000) | oui | |
| `authorId` | UUID → `User` | oui | |
| `isPinned` | booléen | oui | Défaut `false`. Les notes épinglées restent en tête. |

Seul son auteur modifie ou supprime une note ; supprimer celle d'un collègue demande `note.moderate` (BO-055). Une note n'est **jamais** visible d'un client (ROL-031) ni incluse dans un export de ses données, sauf demande d'accès RGPD traitée à la main.

---

## 2. Dossiers

### 2.1 `Dossier` ⌫ ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `reference` | `Varchar(20)` | oui | Unique (TRV-051). |
| `clientId` | UUID → `Client` | oui | Non modifiable. |
| `originLeadId` | UUID → `Lead` | non | Demande qui a ouvert le dossier. |
| `stage` | `DossierStage` | oui | Défaut `INTEREST`. |
| `status` | `DossierStatus` | oui | Défaut `OPEN`. |
| `priority` | `Priority` | oui | Défaut `NORMAL`. |
| `assignedAgentId` | UUID → `User` | non | Obligatoire à partir de `QUALIFICATION`. |
| `propertyId` | UUID → `Property` | non | Bien retenu. Obligatoire à partir de `DOCUMENTS`. |
| `lotId` | UUID → `Lot` | non | Lot visé. Obligatoire pour réserver et pour entrer en `ACQUISITION`. |
| `programId`, `promoterId` | UUID | non | Recopiés du bien retenu. |
| `propertyCountryCode` | `Char(2)` | non | Pays du projet : celui du bien retenu, sinon le premier pays préféré du client. Sert à choisir la liste de pièces et les produits bancaires. |
| `financingRequested` | booléen | oui | Faux : achat sans financement ; les étapes bancaires sont sautées (CYC-024). Valeur à l'ouverture : faux si le client a indiqué « Sans financement », vrai sinon (CYC-041). |
| `financingType` | `FinancingPreference` | non | Repris de la demande ou de la fiche du client à l'ouverture ; demandé de nouveau au passage « avec financement » (CYC-041). Correspondance avec les modèles et les lignes de pièces : MOD-340. |
| `purchasePrice` | `Decimal(14,2)` | non | Prix convenu du projet : la référence unique (MOD-313). |
| `purchaseCurrency` | `Char(3)` | selon | Devise du bien. |
| `downPayment` | `Decimal(14,2)` | non | Prérempli avec l'apport de la fiche du client à l'ouverture. |
| `downPaymentCurrency` | `Char(3)` | selon | |
| `loanAmountRequested` | `Decimal(14,2)` | non | Prérempli : prix convenu − apport (MOD-313). |
| `loanCurrency` | `Char(3)` | selon | |
| `remindersPaused` | booléen | oui | Défaut `false`. Vrai : toutes les relances de pièces du dossier sont suspendues (GED-060). |
| `durationMonths` | entier | non | 12 à 480. |
| `checklistTemplateId` | UUID → `ChecklistTemplate` | non | Liste de pièces appliquée. |
| `checklistTemplateVersion` | entier | non | Version du modèle dont la liste suit les lignes : celle de la création de la liste, puis celle de la dernière « Appliquer la nouvelle version » (MOD-342). La réévaluation (GED-031) lit les lignes de **cette** version. |
| `checklistInstantiatedAt` | date-heure | non | |
| `requiredDocsCount` | entier (cache) | oui | Pièces obligatoires. |
| `satisfiedDocsCount` | entier (cache) | oui | Pièces obligatoires `VALIDATED` ou `WAIVED`. |
| `completenessPct` | entier (cache) | oui | 0 à 100 (CAL-055). |
| `completedAt` | date-heure | non | Première fois où le dossier a été complet. |
| `firstContactAt` | date-heure | non | |
| `qualifiedAt` | date-heure | non | |
| `stageEnteredAt` | date-heure | oui | |
| `slaDueAt` | date-heure | non | Échéance de l'étape courante (CAL-062). Nul pendant une pause. |
| `slaPausedRemainingMinutes` | entier | non | Minutes ouvrées qui restaient avant l'échéance au moment de la mise en pause (CYC-031). Peut être négatif si l'étape était déjà en retard. Vidé à la reprise. |
| `lastActivityAt` | date-heure | oui | |
| `holdReason` | `HoldReason` | selon | Obligatoire si `status = ON_HOLD`. |
| `holdNote` | `Varchar(500)` | non | |
| `holdUntil` | date | non | Date de reprise prévue. |
| `holdClientNote` | `Varchar(300)` | non | Ce que l'équipe attend du client, écrit pour lui (CYC-031) : montré dans `C_DOSSIER_ON_HOLD` et sous le bandeau de pause (ECL-022). Vidé à la reprise. |
| `heldAt` | date-heure | non | |
| `acceptedSubmissionId` | UUID → `BankSubmission` | non | Offre de financement retenue par le client. |
| `conditionsAcceptedAt` | date-heure | non | Jalon d'acquisition. |
| `signingScheduledFor` | date-heure | non | Jalon : date du rendez-vous de signature. |
| `deedSignedAt` | date | non | Jalon : acte signé. Obligatoire pour gagner le dossier. |
| `keysHandedAt` | date | non | Jalon : clés remises. |
| `wonAt`, `lostAt` | date-heure | non | |
| `lostReason` | `LostReason` | selon | Obligatoire si `status = LOST`. |
| `lostNote` | `Varchar(500)` | selon | Obligatoire si `lostReason = OTHER`. |
| `saleAmount` | `Decimal(14,2)` | selon | Prix de vente final. Obligatoire pour gagner le dossier. |
| `saleCurrency` | `Char(3)` | selon | |
| `commissionAmount` | `Decimal(14,2)` | non | Commission versée par le promoteur (Q-001). |
| `commissionCurrency` | `Char(3)` | selon | Obligatoire si la commission est saisie. Défaut : devise du bien. |
| `clientFeeAmount` | `Decimal(14,2)` | non | Honoraires payés par le client (Q-001). |
| `clientFeeCurrency` | `Char(3)` | selon | Obligatoire si les honoraires sont saisis. Défaut : devise de référence. |
| `clientNextStep` | `Varchar(300)` | non | Phrase « prochaine étape » montrée au client. Si elle est vide, le texte par défaut de l'étape est affiché (ECL-021). |
| `createdById` | UUID → `User` | non | Nul si ouvert par une demande. |

Index : (`stage`, `status`) · (`assignedAgentId`, `status`) · `clientId` · `lastActivityAt` · `slaDueAt` · `propertyId` · `promoterId`.

**MOD-310** Pour un même client et un même bien retenu, il existe au plus **un** dossier `OPEN` ou `ON_HOLD` (index unique partiel sur (`clientId`, `propertyId`) quand `propertyId` n'est pas nul).

**MOD-311** `lastActivityAt` est mis à jour par : un changement d'étape ou d'état, une pièce déposée, validée ou rejetée, un message, un e-mail envoyé, un appel noté, une note, une tâche terminée, un rendez-vous, un événement de soumission.

**MOD-312** Un dossier ne se supprime que s'il est en `INTEREST` ou `QUALIFICATION`, sans pièce déposée ni soumission (erreur de saisie, doublon). Dans tous les autres cas, il se clôture.

**MOD-313** **Un seul prix de projet.** Quatre champs parlent de prix ; ils ne vivent pas chacun de leur côté.

| Champ | Rôle | Règle |
|---|---|---|
| `Lot.price` | Prix public du lot | Fixé par le catalogue. Ne change jamais du fait d'un dossier. |
| `Dossier.purchasePrice` | **Prix convenu** du projet : la référence du plan de financement, de la réservation et de ce que voit le client | Prérempli avec le prix du lot quand un lot est choisi (ou `priceFrom` du bien retenu sans lot) ; modifiable par le conseiller (remise négociée). L'écran montre l'écart avec le prix public. Devise : celle du bien. |
| `Reservation.agreedPrice` | Copie du prix convenu au moment de l'option | Préremplie avec `Dossier.purchasePrice`. Si le conseiller la change en posant l'option, `Dossier.purchasePrice` prend la même valeur dans la même transaction : tant que la réservation est active, les deux sont égaux. |
| `Dossier.saleAmount` | Prix de vente **final**, à l'acte | Prérempli avec `purchasePrice` à la clôture ; une valeur différente est acceptée et n'efface pas le prix convenu. |

`loanAmountRequested` est prérempli avec `purchasePrice` − `downPayment` et reste modifiable. Quand l'apport est dans une autre devise que le bien — le cas courant : un apport en euros, un prix en dinars —, il est converti dans la devise du bien au cours du jour (CAL-010), et l'écran montre le cours et sa date. Tant que montant à financer + apport s'écarte du prix convenu — de plus d'une unité dans la même devise, de plus de 1 % quand une conversion intervient —, l'aperçu du dossier affiche « Le plan de financement ne couvre pas le prix : écart de {montant}. » ; ce n'est pas bloquant. Le client ne voit qu'un prix : le prix convenu (ECL-032, DOS-050).

### 2.2 `DossierParty` ⟳ — emprunteurs et garants

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `dossierId` | UUID → `Dossier` | oui | Cascade. |
| `role` | `PartyRole` | oui | |
| `clientId` | UUID → `Client` | selon | Obligatoire et égal à `Dossier.clientId` pour `PRIMARY` ; nul sinon. |
| `firstName`, `lastName` | `Varchar(80)` | selon | Obligatoires pour un co-emprunteur et un garant. Vides pour `PRIMARY` (MOD-322). |
| `relationship` | `Varchar(60)` | non | « Conjoint », « Frère ». |
| `birthDate` | date | non | |
| `email` | `Citext` (254) | non | |
| `phone` | `Varchar(20)` | non | |
| `countryOfResidence` | `Char(2)` | non | |
| `residencyStatus` | `ResidencyStatus` | selon | Obligatoire pour un co-emprunteur et un garant : elle décide de leurs pièces. |
| `employmentType` | `EmploymentType` | selon | Idem. |
| `profession` | `Varchar(80)` | non | |
| `monthlyIncome` | `Decimal(12,2)` | non | Sensible (`client.sensitive.read`). |
| `monthlyDebts` | `Decimal(12,2)` | non | Sensible. |
| `incomeCurrency` | `Char(3)` | selon | |
| `sortOrder` | entier | oui | |
| `removedAt` | date-heure | non | Partie retirée du dossier (MOD-321). |
| `restrictedAt` | date-heure | non | Traitement limité à la demande de cette personne (ADM-063) : sa ligne ne se modifie plus et ses pièces ne sortent dans aucun paquet, tant que la limitation dure. |

**MOD-320** Un dossier a exactement une partie `PRIMARY`, créée avec lui. Il a au plus `dossier.maxCoBorrowers` co-emprunteurs (défaut 1) et `dossier.maxGuarantors` garants (défaut 1), parties retirées non comptées. Un garant ne s'ajoute qu'à un dossier **avec financement** (CYC-041).

**MOD-322** **Emprunteur principal : une seule source.** Sur la ligne `PRIMARY`, les champs d'identité, de coordonnées, de situation et de revenus restent **vides** : ils sont lus sur la fiche `Client` (`clientId`), que l'API joint à la partie. Le profil du client, la fiche vue par le conseiller et le dossier ne peuvent donc pas se contredire. Seuls les co-emprunteurs et les garants portent leurs propres valeurs. La synthèse financière d'un dossier (BNK-110) donne une ligne par personne, dans sa devise, puis un total converti dans la devise de la demande, avec la date du cours.

**MOD-321** Ajouter une partie crée ses pièces « par emprunteur » (GED-030). Retirer une partie : si aucune de ses pièces n'a de fichier **et qu'aucune ligne `Consent` ne la référence** (accord confirmé par le client, DOS-032), la partie et ses pièces sont supprimées ; sinon ses pièces passent `WAIVED` avec le motif « Emprunteur retiré du dossier » (`waiveKind = PARTY_REMOVED`) et la partie est conservée, marquée retirée (`removedAt`). La partie `PRIMARY` ne se retire pas.

### 2.3 `DossierStageHistory` — journal des étapes (immuable)

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `dossierId` | UUID → `Dossier` | oui | Cascade. |
| `fromStage`, `toStage` | `DossierStage` | non / oui | `fromStage` nul à la création. |
| `fromStatus`, `toStatus` | `DossierStatus` | non / oui | |
| `isBackward` | booléen | oui | Recul d'étape. |
| `reason` | `Varchar(500)` | selon | Obligatoire pour un recul, une pause, une clôture, une réouverture. Pour une pause et une clôture : le code du motif (`HoldReason`, `LostReason` — `WAITING_CLIENT`, `BANK_REFUSAL`…), suivi de la note s'il y en a une. |
| `actorType` | `ActorType` | oui | |
| `changedById` | UUID → `User` | non | |
| `changedAt` | date-heure | oui | |
| `secondsInPreviousStage` | entier long | non | Durée passée dans l'étape quittée, **hors pauses**, en temps de calendrier. |
| `businessMinutesInPreviousStage` | entier long | non | La même durée, en minutes ouvrées (CAL-063). Sert aux délais moyens par étape, comparés aux cibles en jours ouvrés. |

Une ligne est écrite à chaque changement d'étape **ou** d'état.

### 2.4 `DossierCandidate` ⟳ — bien envisagé

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `dossierId` | UUID → `Dossier` | oui | Cascade. |
| `propertyId` | UUID → `Property` | oui | |
| `lotId` | UUID → `Lot` | non | Lot préféré. |
| `origin` | `CandidateOrigin` | oui | |
| `leadId` | UUID → `Lead` | non | Demande d'origine, pour `CLIENT_INTEREST`. |
| `proposedById` | UUID → `User` | non | Pour `ADVISOR_PROPOSAL`. |
| `message` | `Varchar(1000)` | non | Mot du conseiller qui accompagne la proposition, montré au client. |
| `sentAt` | date-heure | non | Proposition notifiée au client. |
| `status` | `CandidateStatus` | oui | Défaut `INTERESTED` pour un intérêt du client, `PROPOSED` pour une proposition. |
| `statusChangedAt` | date-heure | oui | |
| `viewedAt` | date-heure | non | Première ouverture par le client. |
| `selectionRequestedAt` | date-heure | non | Le client a cliqué « Je retiens ce bien » ; en attente de confirmation par le conseiller (INT-030). Vidé à la confirmation, au refus ou si le client se ravise. Un seul candidat par dossier peut le porter. |
| `selectionDeclineNote` | `Varchar(500)` | non | Raison donnée par le conseiller qui refuse le choix demandé ; montrée au client (CYC-071). Vidée à la demande suivante. |
| `clientComment` | `Varchar(1000)` | non | Retour du client. |
| `declineReason` | `DeclineReason` | non | |
| `declineNote` | `Varchar(500)` | non | |
| `advisorNote` | `Varchar(1000)` | non | Interne. |

Unicité : (`dossierId`, `propertyId`). Au plus **un** candidat `SELECTED` par dossier (index unique partiel).

### 2.5 `Reservation` ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `reference` | `Varchar(20)` | oui | Unique. |
| `lotId` | UUID → `Lot` | oui | |
| `dossierId` | UUID → `Dossier` | oui | |
| `clientId` | UUID → `Client` | oui | Celui du dossier. |
| `status` | `ReservationStatus` | oui | Défaut `OPTION`. |
| `optionExpiresAt` | date-heure | selon | Obligatoire à l'état `OPTION`. Défaut : fin du jour dans le fuseau du pays du bien (CYC-105), `reservation.optionDays` jours plus tard (7). |
| `optionExtendedCount` | entier | oui | Défaut 0. Au plus `reservation.maxExtensions` prolongations (2). |
| `optionAcknowledgedAt` | date-heure | non | Le promoteur a dit qu'il tient le lot jusqu'à `optionExpiresAt` (CYC-107). Nul : l'option est posée sur la plateforme, mais le promoteur ne l'a pas encore confirmée. Renseigné de nouveau à chaque prolongation, qui exige son accord. |
| `optionAcknowledgedBy` | `Varchar(160)` | non | Nom de l'interlocuteur du promoteur qui l'a dit. |
| `agreedPrice` | `Decimal(14,2)` | non | Prix convenu ; défaut : `Dossier.purchasePrice`, à défaut le prix du lot à la pose de l'option (MOD-313). |
| `currency` | `Char(3)` | oui | Devise du bien. |
| `reservedAt` | date-heure | non | Passage à `RESERVED`. |
| `depositAmount` | `Decimal(14,2)` | non | Acompte versé hors plateforme. Strictement positif s'il est saisi. |
| `depositCurrency` | `Char(3)` | selon | Obligatoire si un acompte est saisi. Défaut : `currency`. |
| `depositPaidAt` | date | non | |
| `depositProofDocumentId` | UUID → `DossierDocument` | non | Justificatif. |
| `depositRefundStatus` | `DepositRefundStatus` | oui | Défaut `NONE`. Passe à `DUE` quand une réservation qui porte un acompte est annulée ou que son dossier est clôturé sans acquisition (CYC-108). |
| `depositRefundedAmount` | `Decimal(14,2)` | selon | Obligatoire à l'état `REFUNDED`. Même devise que l'acompte. |
| `depositRefundedAt` | date | selon | Idem. |
| `depositRefundProofDocumentId` | UUID → `DossierDocument` | non | Justificatif du remboursement. |
| `depositRefundNote` | `Varchar(500)` | selon | Obligatoire à l'état `RETAINED` : ce que prévoit le contrat de réservation. Montré au client. |
| `contractDocumentId` | UUID → `DossierDocument` | non | Contrat de réservation signé. |
| `promoterConfirmedAt` | date-heure | non | |
| `promoterConfirmedBy` | `Varchar(160)` | non | Nom de l'interlocuteur du promoteur. |
| `contractualDeliveryDate` | date | non | Q-014. |
| `completedAt`, `cancelledAt`, `expiredAt` | date-heure | non | |
| `cancelReason` | `Varchar(500)` | selon | Obligatoire à l'annulation. |
| `createdById` | UUID → `User` | oui | |

**MOD-330** Un lot a au plus **une** réservation active (`OPTION` ou `RESERVED`) : index unique partiel sur `lotId`. Une seconde tentative échoue avec `CONFLICT_STATE` et le message « Ce lot est déjà sous option pour un autre client jusqu'au {date}. ».

**MOD-331** Un dossier a au plus une réservation active : index unique partiel sur `dossierId` quand `status` ∈ (`OPTION`, `RESERVED`). Une seconde tentative échoue avec `CONFLICT_STATE`, raison `DOSSIER_HAS_RESERVATION`.

### 2.6 `Appointment` ⟳ — rendez-vous

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `type` | `AppointmentType` | oui | |
| `status` | `AppointmentStatus` | oui | Défaut `REQUESTED` si demandé par le client, `CONFIRMED` si créé par le personnel avec une date. |
| `clientId` | UUID → `Client` | oui | |
| `dossierId` | UUID → `Dossier` | non | |
| `candidateId` | UUID → `DossierCandidate` | non | Visite ou visio d'un bien précis. |
| `propertyId` | UUID → `Property` | non | |
| `staffUserId` | UUID → `User` | non | Conseiller. Obligatoire à l'état `CONFIRMED`. |
| `requestedSlots` | `Json` | non | Souhaits du client : `[{date, slot}]`, trois au plus. |
| `startsAt`, `endsAt` | date-heure | selon | Obligatoires à l'état `CONFIRMED`. `endsAt` > `startsAt`. Durée par défaut : 30 minutes. |
| `timezone` | `Varchar(64)` | oui | Fuseau du client (`Client.timezone`) au moment de la création. |
| `placeTimezone` | `Varchar(64)` | non | Fuseau du **lieu**, pour une visite sur place ou une rencontre (par défaut `Country.timezone` du pays du bien ; sans bien, `business.calendar.timezone`). L'heure du rendez-vous est alors donnée d'abord dans ce fuseau : « 10 h 00, heure d'Alger (11 h 00 à Paris) » (TRV-031). |
| `clientNotifiedAt` | date-heure | non | Un e-mail a informé le client du rendez-vous (CYC-080). Nul : ni rappel ni e-mail d'annulation ne partent. Renseigné d'office, dès la demande, pour un rendez-vous que le client a lui-même demandé : il en suit toujours la suite. |
| `locationText` | `Varchar(200)` | non | Lieu d'une visite ou d'une rencontre. |
| `hostName` | `Varchar(160)` | non | Visite sur place : la personne du promoteur qui accueille le visiteur. Montrée au client (« Sur place, vous serez accueilli par {nom}. »). |
| `hostPhone` | `Varchar(20)` | non | Son téléphone, montré au client avec son nom. |
| `meetingUrl` | `Varchar(400)` | non | Lien de visio. |
| `onBehalfContactId` | UUID → `ClientContact` | non | Proche qui fait la visite à la place du client. |
| `clientNote` | `Varchar(1000)` | non | |
| `internalNote` | `Varchar(1000)` | non | |
| `outcomeNote` | `Varchar(1000)` | non | Compte rendu. |
| `cancelledBy` | `CancelledBy` | non | `SYSTEM` : annulé par la clôture du dossier. |
| `cancelReason` | `Varchar(300)` | non | |
| `reminderSentAt` | date-heure | non | |
| `createdById` | UUID → `User` | non | |

### 2.7 `ClientTimelineEntry` — fil du suivi vu par le client (immuable)

Une ligne par fait que le client voit dans l'onglet « Suivi » de son dossier (ECL-031). Écrite dans la transaction du geste ou de la tâche qui produit le fait ; jamais modifiée, jamais recalculée.

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `dossierId` | UUID → `Dossier` | oui | Cascade. |
| `kind` | `ClientTimelineKind` | oui | Le fait ; sa phrase est dans ECL-031. |
| `occurredAt` | date-heure | oui | Date du fait, affichée. |
| `params` | `Json` | oui | Les valeurs de la phrase, figées au moment du fait, sous les noms des champs de la phrase : `conseiller` (« Prénom N. », TRV-145), `banque`, `bien` (titre), `lot` (référence), `n`, `montant` et `devise`, `date`, `nature` (`LeadKind`), `type` (`AppointmentType`), `jalon` (`AcquisitionMilestone`), `raison` (libellé montré au client). `{}` si la phrase n'a rien à compléter. Aucune donnée d'identité du client. |

Index : (`dossierId`, `occurredAt`).

---

## 3. Pièces

### 3.1 `ChecklistTemplate` ⌫ — modèle de liste de pièces

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `name` | `Varchar(160)` | oui | |
| `scope` | `ChecklistScope` | oui | |
| `bankId` | UUID → `Bank` | selon | Obligatoire pour `BANK_FILE`, interdit pour `CLIENT_FILE`. |
| `countryCode` | `Char(2)` | non | Pays du bien. Nul = tous les pays. |
| `residencyFilter` | `ResidencyStatus[]` | oui | Vide = toutes les situations. |
| `financingTypeFilter` | `FinancingType` | non | Nul = les deux. |
| `isDefault` | booléen | oui | Une seule liste par défaut par portée (et par banque). |
| `isActive` | booléen | oui | |
| `version` | entier | oui | Défaut 1. Augmente de 1 à chaque enregistrement qui ajoute, retire ou modifie au moins une ligne (MOD-342) ; l'en-tête (nom, filtres, note, actif, par défaut) et l'ordre des lignes se modifient sans changer de version. |
| `notes` | `Varchar(500)` | non | |

**MOD-340** **Choix de la liste « dossier client »** pour un dossier : parmi les modèles `CLIENT_FILE` actifs dont les filtres correspondent au dossier (pays du bien, situation du client, type de financement), le plus **spécifique** (le plus de filtres renseignés) ; à égalité, le plus récemment modifié ; sinon le modèle par défaut, même si ses filtres ne correspondent pas (GED-013). **Type de financement** — pour le filtre d'un modèle comme pour la condition `financingType` d'une ligne : un dossier `CONVENTIONAL` ou `ISLAMIC` correspond aux modèles et aux lignes sans filtre de type ou du même type ; un dossier `NO_PREFERENCE`, `CASH` ou sans type ne correspond qu'aux modèles et aux lignes **sans** filtre de type. Le type n'est jamais une information « manquante » au sens de GED-020. S'il n'existe aucun modèle, le passage à l'étape `DOCUMENTS` est refusé (`NO_CHECKLIST_TEMPLATE`, `07-design/03`).

**MOD-341** Modifier un modèle **ne change pas** les dossiers déjà ouverts : leurs pièces sont une copie, et leur liste suit la version notée sur le dossier (`checklistTemplateVersion`). Seul le bouton « Appliquer la nouvelle version » d'un dossier lui fait suivre la version courante (MOD-342) ; rien n'est retiré sans confirmation.

**MOD-342** `[P1]` **Versions des lignes.** Une ligne de modèle ne se supprime pas physiquement : elle porte la version qui l'a introduite (`addedInVersion`) et, une fois retirée, celle qui l'a retirée (`retiredInVersion`). Modifier une ligne en vigueur — tout champ sauf l'ordre (`sortOrder`) — la retire et crée une nouvelle ligne de même code. Les lignes de la version *n* d'un modèle sont celles où `addedInVersion` ≤ *n* et où `retiredInVersion` est nul ou > *n*. Une pièce garde donc toujours sa ligne d'origine (`checklistItemId`). **« Appliquer la nouvelle version »** (`apply-template`, `document.request`), qui sert aussi à « Changer de modèle » (GED-031), compare par code les lignes de la version du dossier à celles de la version courante du modèle (ou du modèle choisi) : une ligne nouvelle crée ses pièces, conditions évaluées comme en GED-020 ; une ligne disparue propose de dispenser ses pièces (`waiveKind = NOT_APPLICABLE`) — une pièce dont la dispense est refusée n'est plus touchée par la réévaluation, comme une pièce ajoutée à la main ; une ligne modifiée reporte sur ses pièces encore `PENDING` le libellé (sauf `labelEdited`), l'aide, « obligatoire », les formats, le nombre de fichiers et la validité — jamais sur une pièce qui a déjà un fichier —, et toutes ses pièces prennent le `checklistItemId` de la nouvelle ligne. Puis `checklistTemplateId` et `checklistTemplateVersion` prennent les nouvelles valeurs, et la liste est réévaluée (GED-031). L'écran montre le résultat avant de l'appliquer.

### 3.2 `ChecklistItem` — ligne d'un modèle

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `templateId` | UUID → `ChecklistTemplate` | oui | Cascade. |
| `addedInVersion` | entier | oui | Version du modèle qui a introduit la ligne (MOD-342). |
| `retiredInVersion` | entier | non | Version du modèle qui l'a retirée ou remplacée ; nul tant qu'elle est en vigueur. Une ligne ne se supprime pas physiquement. |
| `code` | `Varchar(60)` | oui | Stable, en majuscules (`ID_PASSPORT`). Unique parmi les lignes en vigueur du modèle (index partiel : `retiredInVersion` nul). Le même code dans deux modèles désigne **la même pièce** (réemploi, MOD-360). |
| `label` | `Varchar(160)` | oui | Libellé montré au client. |
| `labelWhenCash` | `Varchar(160)` | non | Libellé de remplacement quand le dossier est sans financement (« Justificatif des fonds » au lieu de « Justificatif de l'apport », PAR-050). |
| `description` | `Varchar(600)` | non | Aide : ce qu'il faut exactement, de quelle date. |
| `category` | `DocumentCategory` | oui | |
| `isRequired` | booléen | oui | Défaut `true`. |
| `perParty` | booléen | oui | Défaut `false`. Vrai : une pièce par emprunteur concerné. |
| `appliesToRoles` | `PartyRole[]` | oui | Quand `perParty` : rôles concernés. Défaut `[PRIMARY, CO_BORROWER]`. |
| `appliesWhen` | `Json` | non | Conditions (toutes doivent être vraies) : `{"employmentType": ["PERMANENT","FIXED_TERM"], "residencyStatus": ["NON_RESIDENT"], "financingType": ["ISLAMIC"], "financingRequested": true, "hasCoBorrower": true}`. Les deux premières sont évaluées sur l'emprunteur concerné (ou sur le client) ; les autres, sur le dossier — `financingType` selon la correspondance de MOD-340. Une condition dont la donnée est **inconnue** n'est pas remplie : la pièce n'est pas créée, et le dossier signale l'information manquante pour que la liste soit complétée (GED-020, GED-031). |
| `providedBy` | `DocumentProvider` | oui | Défaut `CLIENT`. |
| `maxFiles` | entier | oui | Défaut 5 ; 1 à 20. |
| `acceptedFormats` | `Varchar(10)[]` | oui | Défaut `pdf, jpg, jpeg, png, heic`. |
| `validityDays` | entier | non | Durée de validité à partir de la date du document. |
| `exampleMediaId` | UUID → `Media` | non | Exemple montré au client. |
| `sortOrder` | entier | oui | |

### 3.3 `DossierDocument` ⟳ — pièce d'un dossier

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `dossierId` | UUID → `Dossier` | oui | Cascade. |
| `partyId` | UUID → `DossierParty` | non | Emprunteur concerné, pour une pièce « par emprunteur ». |
| `checklistItemId` | UUID → `ChecklistItem` | non | Ligne d'origine. Nul pour une pièce ajoutée à la main. |
| `code` | `Varchar(60)` | non | Recopié de la ligne. |
| `label` | `Varchar(160)` | oui | Recopié de la ligne (`labelWhenCash` pour un dossier sans financement), modifiable. Recalculé à chaque changement de mode (CYC-041) pour une pièce dont la ligne a un `labelWhenCash`, sauf si `labelEdited`. |
| `labelEdited` | booléen | oui | Défaut `false`. Vrai dès que le personnel modifie le libellé : il n'est plus ni recalculé ni recopié. |
| `description` | `Varchar(600)` | non | |
| `category` | `DocumentCategory` | oui | |
| `isRequired` | booléen | oui | |
| `providedBy` | `DocumentProvider` | oui | |
| `source` | `DocumentSource` | oui | `CHECKLIST`, `AD_HOC` (ajoutée par le conseiller, ou créée par une action du dossier : GED-037), `BANK_REQUEST` (complément demandé par une banque). |
| `submissionId` | UUID → `BankSubmission` | non | Pour `BANK_REQUEST` : la soumission qui la demande. Pour un document d'offre : la soumission dont il vient ; il n'est jamais proposé dans le paquet d'une autre banque (BNK-103). |
| `isInternal` | booléen | oui | Défaut `false`. Vrai : pièce que le client ne voit pas (preuve d'un accord saisi par l'équipe, justificatif de remboursement d'acompte). Elle ne compte pas dans la complétude et n'entre dans aucun paquet. |
| `maxFiles`, `acceptedFormats`, `validityDays` | entier, `Varchar(10)[]`, entier | oui / oui / non | Recopiés de la ligne (`ChecklistItem`). |
| `status` | `DocumentStatus` | oui | Défaut `PENDING`. |
| `statusChangedAt` | date-heure | oui | |
| `dueAt` | date | non | Échéance montrée au client. Défaut : `documents.defaultDueDays` jours après la demande (10). |
| `reminderCount` | entier | oui | Défaut 0. |
| `reminderBaseAt` | date-heure | non | Point de départ du calendrier des relances (AUT-042) : la demande, le rejet ou l'expiration de la pièce ; remis à la date du jour quand le dossier reprend après une pause ou est rouvert, quand les relances de la pièce ou du dossier reprennent (GED-060), quand sa dispense est levée (CYC-146) ou qu'elle est redemandée (CYC-145). |
| `lastRemindedAt` | date-heure | non | |
| `remindersPaused` | booléen | oui | Défaut `false`. |
| `currentVersion` | entier | oui | Défaut 0 = aucun fichier. Numéro de la **version en cours** (`DocumentVersion.number`) : celle que le dernier dépôt réussi a installée (CYC-140). Elle ne revient jamais d'elle-même à une version antérieure : si la version en cours est supprimée, ou ses fichiers purgés, `currentVersion` repasse à 0 et la pièce à `PENDING` (CYC-149) — sauf si un renouvellement attend : il devient la version en cours ; une pièce née d'un geste du dossier, elle, est retirée avec sa version. |
| `renewalVersion` | entier | non | Numéro de la version déposée pour **renouveler** une pièce validée, tant qu'elle attend sa vérification (CYC-141). La pièce reste `VALIDATED` avec sa version en cours. Nul sinon. |
| `transmittedVersion` | entier | non | Dernière version partie chez une banque dans un paquet. Une pièce transmise ne se supprime plus ; sa validation ne s'annule pas tant que la soumission est en cours (CYC-144). |
| `rejectionReason` | `RejectionReason` | selon | Obligatoire à l'état `REJECTED`. |
| `rejectionNote` | `Varchar(500)` | selon | Obligatoire si le motif est `OTHER`. Montrée au client. |
| `validatedById` | UUID → `User` | non | |
| `validatedAt` | date-heure | non | |
| `issuedAt` | date | non | Date du document, saisie à la validation. |
| `expiresAt` | date | non | `issuedAt` (sinon date du dépôt) + `validityDays`. |
| `waivedById` | UUID → `User` | non | |
| `waiveReason` | `Varchar(300)` | selon | Obligatoire à l'état `WAIVED`. |
| `waiveKind` | `WaiveKind` | selon | Obligatoire à l'état `WAIVED` : `MANUAL` (CYC-146), `NOT_APPLICABLE` (GED-031, CYC-041, MOD-342), `PARTY_REMOVED` (MOD-321), `SUBMISSION_ENDED` (CYC-170). Le conseiller peut annuler toute dispense (CYC-146) ; d'elles-mêmes, la réévaluation ne lève qu'une dispense `NOT_APPLICABLE` (GED-031), et la reprise d'une soumission qu'une dispense `SUBMISSION_ENDED` (CYC-170). |

Index : (`dossierId`, `status`) · (`status`, `dueAt`) · `expiresAt`.
Unicité : (`dossierId`, `partyId`, `code`) quand `code` n'est pas nul — une pièce commune (`partyId` vide) compte comme une valeur (MOD-019).

### 3.4 `DocumentVersion` — version d'une pièce

Une ligne par **dépôt**. Rien n'est écrasé (GED-003) : l'historique d'une pièce est la suite de ses versions.

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `documentId` | UUID → `DossierDocument` | oui | Cascade. |
| `number` | entier | oui | 1, 2, 3… Unicité : (`documentId`, `number`). |
| `uploadedById` | UUID → `User` | non | Client ou membre du personnel. |
| `uploadedVia` | `UploadChannel` | oui | |
| `uploadedAt` | date-heure | oui | |
| `outcome` | `VersionOutcome` | oui | Défaut `SCANNING`. Évolue selon CYC-140 à CYC-149. |
| `isRenewal` | booléen | oui | Fixé au dépôt : vrai si la pièce était `VALIDATED` à cet instant (renouvellement, CYC-141), faux sinon (remplacement). CYC-140 dit ce qu'il advient quand le statut de la pièce a changé pendant le contrôle. |
| `decidedById` | UUID → `User` | non | Qui a validé ou rejeté cette version. |
| `decidedAt` | date-heure | non | |
| `rejectionReason` | `RejectionReason` | non | Copie du motif, pour l'historique. |
| `rejectionNote` | `Varchar(500)` | non | |
| `deletedAt` | date-heure | non | Version supprimée (GED-080) : ses fichiers sont effacés du stockage. |
| `deletedById` | UUID → `User` | non | |
| `deleteReason` | `Varchar(300)` | selon | Obligatoire à la suppression. |
| `filesPurgedAt` | date-heure | non | Fichiers effacés par la politique de conservation (SEC-110) ; la ligne reste. |

### 3.5 `DocumentFile` ⌫ — fichier d'une version

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `versionId` | UUID → `DocumentVersion` | oui | Cascade. |
| `documentId` | UUID → `DossierDocument` | oui | Redondant avec la version ; évite une jointure. |
| `sortOrder` | entier | oui | Ordre des fichiers dans la version, choisi au dépôt (DOS-012). |
| `storageKey` | `Varchar(400)` | oui | Stockage privé, chiffré au repos. |
| `fileName` | `Varchar(200)` | oui | Nom d'origine, nettoyé ; pour un PDF assemblé à partir d'images : le libellé de la pièce. |
| `mimeType` | `Varchar(100)` | oui | Type **constaté** à la lecture du fichier, pas celui annoncé. |
| `sizeBytes` | entier long | oui | |
| `checksumSha256` | `Char(64)` | oui | |
| `pageCount` | entier | non | Pour un PDF. |
| `assembledFromImages` | entier | non | Nombre d'images réunies dans ce PDF (MED-032). Nul pour un fichier déposé tel quel. |
| `scanStatus` | `ScanStatus` | oui | Défaut `PENDING`. |
| `scanCheckedAt` | date-heure | non | |

**MOD-350** Un fichier n'est lisible par personne tant que son contrôle antivirus n'est pas `CLEAN`. Un fichier `INFECTED` est supprimé du stockage ; sa ligne reste, marquée supprimée, pour la trace.

**MOD-351** Les anciennes versions restent consultables par le personnel (`document.file.read`) jusqu'à la purge prévue par la politique de conservation. Le client ne voit que la version en cours et, s'il en a déposé un, son renouvellement en attente (DOS-005).

**MOD-352** Les fichiers « en cours » d'une pièce sont ceux de la version dont le numéro est `DossierDocument.currentVersion`. Une version encore `SCANNING` ne remplace pas la version en cours : si le contrôle écarte tous ses fichiers, elle devient `DISCARDED` et la pièce n'a pas bougé (CYC-140).

### 3.6 `DocumentReminder` — relance de pièces

Une ligne par relance d'un dossier, automatique ou manuelle, écrite à l'émission de `document.reminder_due` (AUT-042) ; elle fait l'historique des relances (GED-060).

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `dossierId` | UUID → `Dossier` | oui | Cascade. |
| `remindedAt` | date-heure | oui | Émission de la relance. |
| `isManual` | booléen | oui | Vrai pour « Relancer maintenant » (GED-060). |
| `triggeredById` | UUID → `User` | non | Auteur d'une relance manuelle ; nul si automatique. |
| `documentIds` | UUID[] | oui | Pièces citées dans l'e-mail : toutes les pièces attendues (AUT-042, point 1). |
| `countedDocumentIds` | UUID[] | oui | Pièces dont le compteur a avancé : les pièces dues (AUT-042, point 4). Peut être vide pour une relance manuelle. |
| `communicationId` | UUID → `Communication` | non | L'e-mail parti. Nul si aucun e-mail n'est parti. |
| `skipReason` | `Varchar(100)` | non | Pourquoi l'e-mail n'est pas parti : la raison de l'exécution `SKIPPED` de `R_DOC_REMINDER` (AUT-007). |

La ligne ne change plus, sauf `communicationId` et `skipReason`, renseignés quand `R_DOC_REMINDER` s'exécute. Index : (`dossierId`, `remindedAt`).

---

## 4. Financement

### 4.1 `BankSubmission` ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `reference` | `Varchar(20)` | oui | Unique. |
| `dossierId` | UUID → `Dossier` | oui | |
| `bankId` | UUID → `Bank` | oui | |
| `bankProductId` | UUID → `BankProduct` | non | |
| `financingType` | `FinancingType` | oui | Recopié du produit, sinon choisi. |
| `status` | `SubmissionStatus` | oui | Défaut `DRAFT`. |
| `transmissionMode` | `TransmissionMode` | oui | Défaut : celui de la banque. |
| `recipientContactId` | UUID → `BankContact` | non | |
| `recipientEmail` | `Citext` (254) | selon | Obligatoire en mode `SECURE_LINK`. |
| `requestedAmount` | `Decimal(14,2)` | oui | Strictement positif. |
| `currency` | `Char(3)` | oui | |
| `requestedDurationMonths` | entier | oui | 12 à 480. |
| `submittedById` | UUID → `User` | non | |
| `submittedAt` | date-heure | non | |
| `manualTransmissionMeans` | `Varchar(120)` | selon | Mode `MANUAL` : par quel moyen le dossier a été remis à la banque (« remis en agence », « messagerie sécurisée de la banque »). Obligatoire à l'envoi. |
| `bankReference` | `Varchar(60)` | non | Numéro de dossier côté banque. |
| `expectedDecisionAt` | date | non | `submittedAt` + `Bank.reviewSlaDays` (à défaut `submission.defaultReviewDays`). Repart de la date d'un complément transmis (CYC-163). Modifiable. |
| `followUpCount` | entier | oui | Défaut 0. |
| `lastFollowUpAt` | date-heure | non | |
| `infoRequestedAt` | date-heure | non | Dernière demande de complément. |
| `infoRequestNote` | texte (4 000) | non | Ce que la banque demande. **Montré au client.** Chaque demande y est ajoutée sous la forme « {JJ/MM/AAAA} — {texte} », le texte d'une demande faisant au plus 1 000 caractères. Si le total dépassait 4 000 caractères, la demande est refusée (`422 VALIDATION_ERROR`, code `INFO_REQUEST_FULL`, « Résumez la demande : la place est épuisée. »). |
| `decisionAt` | date-heure | non | Date de l'accord **ou du refus** ; vidée si la décision est annulée (CYC-169). Sert au taux d'accord (M11) et au délai de décision (M12). |
| `decisionPublishedAt` | date-heure | non | Moment où la décision est **publiée** : dix minutes après sa saisie. C'est alors que partent l'événement, le changement d'étape du dossier, la notification et l'e-mail (CYC-165). Nul : la décision n'est encore connue que de l'équipe. Vidé avec la décision si elle est annulée (CYC-169). |
| `approvedAmount` | `Decimal(14,2)` | selon | Obligatoire à l'état `APPROVED`. Strictement positif. |
| `approvedRateBps` | entier | selon | Idem. Taux ou marge. 0 à 3 000. |
| `approvedDurationMonths` | entier | selon | Idem. 12 à 480. |
| `approvedPricingMethod` | `PricingMethod` | selon | Idem. Méthode de l'offre, **copiée** à l'enregistrement de l'accord : celle du produit s'il y en a un, sinon `AMORTIZED_RATE` pour un crédit classique et `FLAT_MARGIN` pour un financement islamique ; modifiable. |
| `approvedInsuranceRateBps` | entier | non | Assurance de l'offre, si la banque l'indique. 0 à 500. |
| `approvedFileFees` | `Decimal(14,2)` | non | Frais de dossier de l'offre, dans `currency`. |
| `monthlyPayment` | `Decimal(14,2)` | selon | Obligatoire à l'état `APPROVED`. Mensualité hors assurance **écrite sur l'offre**. Proposée par le calcul (CAL-040 ou CAL-041 selon `approvedPricingMethod`), puis modifiable : c'est le chiffre de la banque qui fait foi (BNK-130). |
| `offerValidUntil` | date | non | Sans date : l'offre n'expire pas d'elle-même (CYC-164). |
| `acceptRequestedAt` | date-heure | non | Le client a cliqué « Je souhaite accepter cette offre » (CYC-166). Vidé s'il se ravise, s'il souhaite accepter une autre offre (CYC-166), quand l'acceptation est enregistrée, ou quand la décision est annulée (CYC-169). |
| `conditions` | texte (2 000) | non | Conditions d'octroi, montrées au client. |
| `offerDocumentId` | UUID → `DossierDocument` | non | Offre ou accord de la banque. |
| `rejectionReason` | `Varchar(500)` | non | Montré au client si la case « Communiquer le motif au client » est cochée. |
| `shareRejectionReason` | booléen | oui | Défaut `false`. |
| `decisionNotes` | texte (2 000) | non | Interne. |
| `acceptedByClientAt` | date-heure | non | |
| `declinedByClientAt` | date-heure | non | |
| `withdrawnAt` | date-heure | non | |
| `withdrawReason` | `Varchar(300)` | non | |

Index : (`bankId`, `status`) · `dossierId` · `expectedDecisionAt`.

**MOD-355** Pour un dossier et une banque, au plus **une** soumission non terminée (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED`, `APPROVED`). Une nouvelle soumission à la même banque est possible après `REJECTED`, `WITHDRAWN` ou `EXPIRED`. Une soumission `APPROVED` dont l'offre est **acceptée** reste dans cet état jusqu'à la fin du dossier : quand le dossier est **gagné**, elle est figée (lecture seule) et ne compte plus comme « en cours » dans les listes et les chiffres ; quand il est **clôturé comme perdu**, elle est retirée comme les autres (CYC-035).

### 4.2 `SubmissionDocument`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `submissionId` | UUID → `BankSubmission` | oui | Cascade. |
| `dossierDocumentId` | UUID → `DossierDocument` | oui | |
| `checklistItemCode` | `Varchar(60)` | non | Ligne de la liste de la banque que cette pièce satisfait. |
| `isIncluded` | booléen | oui | La case « Inclure » de la préparation (BNK-103). |
| `includedVersion` | entier | non | Version de la pièce incluse dans le dernier paquet ; nul tant qu'aucun paquet ne la contient. |

Unicité : (`submissionId`, `dossierDocumentId`). Les lignes sont créées à la création du brouillon, pour chaque pièce proposable (BNK-103) du dossier et de la liste de la banque ; puis pour chaque pièce ajoutée au dossier tant que la soumission est `DRAFT`, et pour chaque pièce d'un complément demandé (CYC-163). Une pièce qui cesse d'être proposable garde sa ligne, décochée.

**MOD-360** **Réemploi des pièces.** Quand une soumission est préparée pour une banque qui a une liste de pièces, chaque ligne de cette liste est d'abord cherchée, **par son code**, parmi les pièces du dossier (même emprunteur). Si la pièce existe : elle est reliée à la soumission. Sinon : une nouvelle pièce `PENDING` est créée dans le dossier (`source = CHECKLIST`) et reliée. Le client ne dépose jamais deux fois le même justificatif. Les pièces ainsi créées sont **annoncées** au client comme toute pièce demandée : un seul événement `document.requested` pour la préparation, avec le nom de la banque (« {banque} demande aussi : … ») — il n'apprend pas leur existence par une relance.

**MOD-361** **Quelle liste de banque.** La liste appliquée à une soumission est, dans l'ordre : celle du **produit** choisi (`BankProduct.requiredChecklistId`) ; à défaut, la liste par défaut de la **banque** (modèle `BANK_FILE` marqué par défaut) ; à défaut, aucune. Ses lignes « par emprunteur » et ses conditions s'évaluent comme pour la liste du dossier (GED-020). Quand le dossier change (co-emprunteur ajouté ou retiré, situation modifiée) alors qu'une soumission est encore `DRAFT`, ses pièces de banque sont réévaluées avec celles du dossier (GED-031) ; après l'envoi, plus rien ne s'ajoute seul : un complément passe par CYC-163.

### 4.3 `SubmissionPackage` et `SecureShare`

`SubmissionPackage` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `submissionId` | UUID → `BankSubmission` | oui | |
| `storageKey` | `Varchar(400)` | oui | Archive ZIP, stockage privé. |
| `summaryStorageKey` | `Varchar(400)` | oui | Sommaire PDF. Gardé avec l'archive et supprimé avec elle, à `purgeAt` (MED-055). |
| `isComplement` | booléen | oui | Défaut `false`. Vrai pour un paquet de complément, qui ne contient que les pièces nouvelles (BNK-120) et ne révoque pas les liens du dernier paquet complet (BNK-113). |
| `manifest` | `Json` | oui | Liste des fichiers : pièce, version, nom, taille, empreinte. |
| `sizeBytes` | entier long | oui | |
| `checksumSha256` | `Char(64)` | oui | |
| `generatedById` | UUID → `User` | oui | |
| `generatedAt` | date-heure | oui | |
| `purgeAt` | date-heure | oui | L'archive est supprimée du stockage `submission.packageRetentionDays` jours après sa génération (30) ; le manifeste reste. |

`SecureShare` :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `purpose` | `SharePurpose` | oui | Ce que porte le lien. |
| `packageId` | UUID → `SubmissionPackage` | selon | Partage d'un paquet de soumission avec une banque (`SUBMISSION_PACKAGE`). |
| `exportJobId` | UUID → `ExportJob` | selon | Remise à une personne **sans compte** de l'export de ses données (`PERSONAL_DATA_EXPORT`, ADM-063) : même page, même code, textes neutres. |
| `organizationId` | UUID → `Organization` | non | `[P2]` `[P3]` Le partenaire à qui le lien est adressé. |
| `entityType`, `entityId` | `Varchar(40)`, UUID | selon | `[P2]` `[P3]` L'objet d'une demande faite à un partenaire (`PARTNER_REQUEST`, ACP-041). |
| `gestures` | `PartnerGesture[]` | oui | `[P2]` `[P3]` Défaut : vide — le lien ne permet que de lire ou de télécharger, comme en Phase 1. Les gestes que son porteur peut faire. |
| `answerUntil` | date-heure | non | `[P3]` Fin du droit de répondre, distincte de la validité des pièces (ACP-044). |
| `remindedAt` | date-heure | non | `[P2]` `[P3]` La relance unique d'une demande restée sans réponse est partie (ACP-045). |
| `tokenHash` | `Char(64)` | oui | Unique. |
| `recipientEmail` | `Citext` (254) | oui | |
| `recipientName` | `Varchar(160)` | non | |
| `accessCodeHash` | texte | oui | Code à 6 chiffres, **haché** (Argon2id) — jamais chiffré ni relisible : il n'est montré qu'une fois, à sa création. Envoyé dans un **second** e-mail. |
| `expiresAt` | date-heure | oui | Défaut : `submission.shareValidityDays` jours (7). |
| `maxDownloads` | entier | oui | Défaut 5. |
| `downloadCount` | entier | oui | |
| `failedCodeAttempts` | entier | oui | Verrouillage au cinquième échec. |
| `lockedAt`, `revokedAt`, `lastAccessAt` | date-heure | non | |
| `revokedById`, `createdById` | UUID → `User` | non / oui | |

### 4.4 `BankSubmissionEvent` — journal d'une soumission (immuable)

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `submissionId` | UUID → `BankSubmission` | oui | Cascade. |
| `type` | `SubmissionEventType` | oui | |
| `fromStatus`, `toStatus` | `SubmissionStatus` | non | |
| `note` | `Varchar(2000)` | non | |
| `actorType` | `ActorType` | oui | |
| `actorId` | UUID → `User` | non | |
| `reportedBy` | `Varchar(160)` | non | Pour une réponse de la banque saisie par l'équipe (accusé de réception, complément, décision, prolongation) : le nom de la personne de la banque qui l'a donnée (ACP-013). Facultatif. |
| `route` | `GestureRoute` | non | `[P3]` La voie par laquelle la réponse est entrée. En Phase 1, `actorType` suffit : `USER` pour une saisie par l'équipe, `LINK` pour l'accusé de réception automatique du premier téléchargement. |
| `metadata` | `Json` | non | Pour une ouverture du lien, une lecture du sommaire ou un téléchargement (BNK-112) : empreinte de l'adresse IP, navigateur. Pour un échec de l'envoi (`PACKAGE_FAILED`) : la raison et la pièce en cause. |

### 4.5 `Simulation`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `type` | `SimulationType` | oui | |
| `clientId` | UUID → `Client` | non | |
| `dossierId` | UUID → `Dossier` | non | |
| `leadId` | UUID → `Lead` | non | Demande de projection d'origine. |
| `propertyId`, `lotId` | UUID | non | Bien simulé. |
| `bankProductId` | UUID → `BankProduct` | non | |
| `anonymousId` | `Varchar(64)` | non | Identifiant du visiteur non connecté (cookie technique). |
| `label` | `Varchar(120)` | non | |
| `inputs` | `Json` | oui | Schémas : CAL-100 et suivants. |
| `outputs` | `Json` | oui | |
| `parametersSnapshot` | `Json` | oui | Copie des barèmes, du financement de référence et des taux de change utilisés. |
| `isSaved` | booléen | oui | Défaut `false`. Vrai : conservée par le client dans son espace. |
| `createdById` | UUID → `User` | non | Membre de l'équipe qui l'a faite : projection, ou simulation faite depuis la fiche du client (CRM-046). Nul pour une simulation faite par le client ou un visiteur (AUT-091). |
| `sentAt` | date-heure | non | Projection envoyée au client. |
| `pdfStorageKey` | `Varchar(400)` | non | |
| `locale` | `Locale` | oui | |

**MOD-370** `inputs`, `outputs` et `parametersSnapshot` sont immuables. Modifier une simulation revient à en créer une autre.

**MOD-371** **Simulations anonymes.** Une simulation sans client ni dossier est purgée `retention.anonymousSimulationDays` jours (30) après sa création, qu'elle soit marquée « enregistrée » ou non. Quand un visiteur **crée un compte** ou **envoie une demande**, les simulations de son `anonymousId` (même navigateur) sont rattachées à sa fiche :
- celle qu'il avait demandé à enregistrer garde `isSaved = true` : il la retrouve dans « Mes simulations » une fois son adresse vérifiée ;
- la plus récente simulation d'éligibilité est marquée enregistrée elle aussi : c'est elle qui donne son « budget estimé » (CAT-035) ;
- les autres restent non enregistrées : le conseiller les voit sur la fiche (elles l'aident à préparer l'appel), le client ne les voit pas, et elles sont purgées au même délai de 30 jours, sauf si elles sont liées à une demande ou à un dossier.

À la **connexion** d'une personne qui a déjà un espace, seule la simulation qu'elle venait de demander à enregistrer lui est rattachée (son identifiant accompagne la connexion, SIM-032). Les autres simulations anonymes du navigateur ne le sont pas : sur un appareil partagé, elles peuvent être celles de quelqu'un d'autre.

Le rattachement ne se fait **jamais par l'adresse e-mail** : une simulation envoyée par e-mail à une adresse (SIM-032) ne rejoint pas la fiche de cette adresse.
