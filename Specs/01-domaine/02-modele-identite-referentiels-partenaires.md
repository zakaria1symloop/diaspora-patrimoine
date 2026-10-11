# Modèle de données — identité, référentiels, partenaires

Conventions et énumérations : `01-modele-conventions-et-vue-d-ensemble.md`.
Dans les tableaux, « Oblig. » = obligatoire. Les champs `id`, `createdAt`, `updatedAt` existent partout (MOD-003, MOD-004) et ne sont pas répétés. ⌫ = `deletedAt`. ⟳ = `version`.

---

## 1. Identité et accès

### 1.1 `User` — compte de connexion

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `kind` | `UserKind` | oui | Fixé à la création, jamais modifié (ROL-001). |
| `email` | `Citext` (254) | oui | Unique. Stocké en minuscules. Un compte `DELETED` garde sa ligne, avec une adresse de remplacement unique (MOD-100) : l'adresse d'origine redevient libre. |
| `emailVerifiedAt` | date-heure | non | Nul tant que l'adresse n'est pas vérifiée. |
| `pendingEmail` | `Citext` (254) | non | Nouvelle adresse en attente de confirmation (AUTH-080). |
| `passwordHash` | texte | non | Argon2id. Nul si le compte n'a jamais défini de mot de passe (créé par une demande ou une invitation). |
| `passwordChangedAt` | date-heure | non | |
| `firstName`, `lastName` | `Varchar(80)` | selon `kind` | Obligatoires pour `STAFF` et `PARTNER`. Facultatifs pour `CLIENT` : la valeur de référence est sur la fiche `Client` ; ces champs en sont la copie, tenue à jour. |
| `phone` | `Varchar(20)` | non | E.164. |
| `locale` | `Locale` | oui | Défaut `fr`. |
| `timezone` | `Varchar(64)` | oui | Défaut `Europe/Paris`. À la création d'un compte client : fuseau détecté par le navigateur. |
| `status` | `UserStatus` | oui | Défaut `ACTIVE` ; `INVITED` pour un compte sans mot de passe en attente d'activation. Un compte du personnel reste `INVITED` jusqu'à la fin de sa première connexion (BO-003), même après avoir choisi son mot de passe. |
| `suspendedAt` | date-heure | non | |
| `suspendedReason` | `SuspensionReason` | selon | Obligatoire à l'état `SUSPENDED`. `DELETION_PENDING` : le client a demandé la suppression de son compte, qui attend son traitement (PRO-060) ; `STAFF_DECISION` : suspension décidée par l'équipe. C'est ce champ qui choisit le message de la connexion (AUTH-022). |
| `suspendedNote` | `Varchar(300)` | selon | Raison saisie par l'équipe, pour `STAFF_DECISION`. Interne. |
| `jobTitle` | `Varchar(80)` | non | Personnel : fonction montrée au client (« Conseillère »). Partenaire : fonction saisie à l'inscription (ACP-081). |
| `signature` | `Varchar(500)` | non | Personnel : signature ajoutée à ses e-mails manuels, sous son nom (COM-021). Texte brut. |
| `avatarMediaId` | UUID | non | Photo de profil (`Media`, propriétaire `USER`). |
| `twoFactorEnabled` | booléen | oui | Défaut `false`. |
| `twoFactorSecret` | texte 🔒 | non | Secret TOTP. |
| `twoFactorPendingSecret` | texte 🔒 | non | Nouveau secret pendant une reconfiguration (BO-070) ; il remplace `twoFactorSecret` à la case « J'ai conservé mes codes de secours » (`…/enable`) ; `…/confirm` vérifie un code de la nouvelle application et rend les nouveaux codes de secours, qui ne remplacent les anciens qu'à ce même instant. Il est vidé si la reconfiguration est abandonnée ou recommencée. |
| `twoFactorRecoveryHashes` | `Json` | non | Dix codes de secours, hachés ; chaque code sert une fois. Forme : `{codes, pending, lastStep}` — les codes en service, ceux qui attendent la confirmation de leur création (PRO-020), et le dernier pas de temps accepté de l'application de codes : un même code à usage unique ne sert pas deux fois (D-097). |
| `failedLoginCount` | entier | oui | Défaut 0 ; remis à 0 à chaque connexion réussie. |
| `lockedUntil` | date-heure | non | Verrou temporaire après échecs (AUTH-032). |
| `lastLoginAt`, `lastSeenAt` | date-heure | non | |
| `charterAcceptedAt` | date-heure | non | Personnel : acceptation de la charte d'utilisation du back-office (BO-003). Nul : la charte est présentée à la connexion suivante. Remis à nul quand le texte de la charte change. |

Index : `email` (unique), `status`, `kind`.

**MOD-100** Un compte `DELETED` a ses champs personnels effacés (`email` remplacé par `deleted+{id}@invalid`, noms et téléphone vidés, mot de passe et secrets vidés). La ligne reste pour l'intégrité des journaux. `User` n'a pas de suppression logique (MOD-006) : un compte ne passe jamais par la corbeille, et sa ligne reste lisible par toutes les jointures — l'auteur d'un objet, une ligne du journal —, que l'écran signe « Utilisateur supprimé » (`common.deletedUser`).

**MOD-101** `firstName` et `lastName` d'un compte `CLIENT` sont recopiés depuis `Client` à chaque modification de la fiche.

### 1.2 `Organization`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `type` | `OrganizationType` | oui | |
| `name` | `Varchar(160)` | oui | |
| `slug` | `Varchar(80)` | oui | Unique. |

**MOD-102** Il existe **exactement une** organisation de type `OPERATOR` (index unique partiel), créée par les données de départ sous le nom « Diaspora Patrimoine ». Elle ne peut être ni supprimée ni dupliquée.

**MOD-103** Créer un `Promoter` ou une `Bank` crée son `Organization` dans la même transaction (même nom, même slug). `Organization.slug` est unique parmi **toutes** les organisations, quel que soit leur type : si le slug est déjà pris par une organisation d'un autre type (une banque et un promoteur de même nom, ou le slug de l'opérateur), l'`Organization` reçoit le slug suffixé (`-2`, TRV-052) ; le slug public du promoteur ou de la banque n'est pas touché.

### 1.3 `Membership`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `userId` | UUID → `User` | oui | Suppression en cascade. |
| `organizationId` | UUID → `Organization` | oui | |
| `role` | `MembershipRole` | oui | `SUPPORT` n'est valable que dans l'organisation `OPERATOR`. `OWNER` aussi. |
| `invitedById` | UUID → `User` | non | |
| `invitedAt` | date-heure | oui | |
| `acceptedAt` | date-heure | non | Nul tant que l'invitation n'est pas acceptée. |
| `revokedAt` | date-heure | non | Appartenance retirée. |
| `suspendedAt` | date-heure | non | `[P2]` `[P3]` Appartenance d'un utilisateur de partenaire suspendue parce que son organisation est redescendue du niveau 3, ou n'est plus `ACTIVE` (ACP-060). Elle ne donne plus aucun droit ; remonter au niveau 3 la rétablit. Les autres appartenances du même compte ne sont pas touchées. |
| `elevatedRole` | `MembershipRole` | non | Rôle temporaire (ROL-016). |
| `elevatedUntil` | date-heure | non | Obligatoire si `elevatedRole` est renseigné ; au plus 72 h après l'octroi. |
| `elevationReason` | `Varchar(500)` | non | Obligatoire si `elevatedRole` est renseigné. |
| `receivesLeads` | booléen | oui | Défaut : `true` pour `AGENT`, `false` pour les autres rôles. Vrai : le compte entre dans la répartition automatique des demandes (CRM-020). |
| `absentUntil` | date | non | Absence déclarée : jusqu'à cette date incluse, le compte ne reçoit aucune nouvelle demande par répartition automatique. |

Unicité : (`userId`, `organizationId`) parmi les appartenances non retirées (index partiel `WHERE revoked_at IS NULL`) ; réinviter un utilisateur retiré crée une nouvelle ligne. Index : (`organizationId`, `role`).

**MOD-104** Le rôle effectif est `elevatedRole` si `elevatedUntil` est dans le futur, sinon `role`. Une appartenance dont `revokedAt` ou `suspendedAt` est renseigné ne donne aucun droit.

### 1.4 `Session`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `userId` | UUID → `User` | oui | Cascade. |
| `audience` | `SessionAudience` | oui | |
| `familyId` | UUID | oui | Identifie la chaîne de renouvellements d'une même connexion. |
| `refreshTokenHash` | `Char(64)` | oui | SHA-256 du jeton de renouvellement courant. Unique. |
| `previousRefreshTokenHash` | `Char(64)` | non | Jeton qui vient d'être remplacé. Présenté de nouveau dans les 10 secondes qui suivent la rotation (deux onglets qui renouvellent en même temps), il donne un jeton d'accès neuf, sans nouvelle rotation, au lieu de déclencher l'alerte de réutilisation (SEC-021). |
| `rotatedAt` | date-heure | non | Moment de la dernière rotation. |
| `impersonatedById` | UUID → `User` | non | Session d'**aperçu** ouverte par un membre du personnel sur l'espace d'un client (ROL-017) : lecture seule, 30 minutes, sans renouvellement. Nul pour une session ordinaire. |
| `rememberMe` | booléen | oui | |
| `userAgent` | `Varchar(400)` | non | |
| `deviceLabel` | `Varchar(120)` | non | Libellé lisible : « Chrome sur Windows », « iPhone ». |
| `ipHash` | `Char(64)` | non | Empreinte de l'adresse IP (HMAC, clé serveur). |
| `lastUsedAt` | date-heure | oui | |
| `passwordConfirmedAt` | date-heure | non | Dernière saisie du mot de passe sur cette session : à la connexion, puis à chaque confirmation (`POST /auth/confirm-password`). Sert à la confirmation renforcée du back-office (BO-005). |
| `expiresAt` | date-heure | oui | |
| `revokedAt` | date-heure | non | |
| `revokedReason` | `SessionRevokedReason` | non | |
| `deviceKey` | `Char(64)` | non | Empreinte d'un identifiant d'appareil rangé dans un cookie durable du navigateur (ou fourni par l'application mobile). Sert à reconnaître un appareil déjà vu (AUTH-033) ; ne contient aucune caractéristique de l'appareil. |

Règles de durée et de rotation : `06-technique/03`, SEC-020 à SEC-026. Une session ouverte par un lien (connexion par lien, activation, vérification, réinitialisation) a la durée d'une session **sans** « Se souvenir de moi ».

### 1.5 `AuthToken` — jeton à usage unique

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `purpose` | `AuthTokenPurpose` | oui | |
| `userId` | UUID → `User` | non | |
| `email` | `Citext` (254) | oui | Adresse à laquelle le lien ou le code a été envoyé. Pour `CLIENT_PREVIEW` et `LOGIN_CHALLENGE`, qui ne partent pas par e-mail : l'adresse du compte concerné (`userId` alors obligatoire). |
| `tokenHash` | `Char(64)` | oui | SHA-256 du jeton. Unique. Le jeton en clair n'est jamais stocké. |
| `payload` | `Json` | non | Selon l'usage : nouvelle adresse e-mail, page de retour (`next`, chemin interne seulement), simulation à enregistrer, origine d'une activation demandée par une inscription (`fromSignup`, AUTH-003), action que confirme un code (`ACTION_CODE` : `action`, AUTH-086). |
| `expiresAt` | date-heure | oui | Durées : `EMAIL_VERIFICATION` 24 h · `PASSWORD_RESET` 1 h · `MAGIC_LOGIN` 15 min · `ACCOUNT_ACTIVATION` 7 jours · `STAFF_INVITATION` 7 jours · `EMAIL_CHANGE` 24 h · `ACTION_CODE` 10 min · `CLIENT_PREVIEW` 60 s · `LOGIN_CHALLENGE` 10 min. |
| `attempts` | entier | oui | Défaut 0. Essais faux d'un **code** — `ACTION_CODE` ; `LOGIN_CHALLENGE` à l'étape `TWO_FACTOR`, codes de l'application et de secours confondus (AUTH-050) : au cinquième, le jeton est mort. |
| `usedAt` | date-heure | non | Renseigné à la première utilisation ; le jeton est alors mort — sauf `STAFF_INVITATION`, consommé par la dernière étape de la première connexion (BO-003, SEC-040). |
| `ipHash` | `Char(64)` | non | |

**MOD-105** Émettre un nouveau jeton pour un même (`userId` ou `email`, `purpose`) **invalide** les précédents non utilisés. **Exception : `ACCOUNT_ACTIVATION`.** Un client invité reçoit plusieurs e-mails dont le bouton porte un lien d'activation (pièces demandées, biens proposés, projection : NOT-024) ; chacun de ces liens reste valable jusqu'à son expiration, et le **premier utilisé** les tue tous. Ainsi le bouton d'un e-mail plus ancien marche encore. Une fois le compte actif, un lien d'activation — utilisé ou non — ne dit pas « expiré » : il mène à la connexion, puis à la page qu'il visait (AUTH-040).

### 1.6 `Consent` — preuve de consentement (immuable)

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `type` | `ConsentType` | oui | |
| `granted` | booléen | oui | `false` = retrait. |
| `userId` | UUID → `User` | non | |
| `clientId` | UUID → `Client` | non | |
| `leadId` | UUID → `Lead` | non | |
| `registrationId` | UUID → `EventRegistration` | non | |
| `partyId` | UUID → `DossierParty` | selon | Obligatoire pour `PARTY_AUTHORIZATION` : la personne dont le client confirme l'accord (DOS-032). Clé étrangère `RESTRICT` : une partie que référence un consentement ne se supprime pas, elle est marquée retirée (MOD-321). |
| `documentVersion` | `Varchar(40)` | non | Version du texte légal accepté (`LegalDocument.version`). Obligatoire pour `TERMS_OF_USE` et `PRIVACY_POLICY`. |
| `wording` | texte | non | Phrase exacte affichée. Obligatoire pour `CONTACT_REQUEST`, `MARKETING_EMAIL`, `DATA_SHARING_PARTNERS`, `PARTY_AUTHORIZATION`. |
| `source` | `Varchar(60)` | oui | Écran d'origine : `signup`, `activation`, `lead:PROPERTY_INTEREST`, `partner-signup` (ACP-081), `cafe:registration`, `profile`, `dossier:documents`, `preferences-link`, `complaint` (signalement d'un e-mail comme indésirable, AUT-071) ; pour un accord enregistré par l'équipe : `staff:phone`, `staff:email`, `staff:paper` (GED-070), `staff:lead` (demande saisie par l'équipe, CRM-025). |
| `sourceCommunicationId` | UUID → `Communication` | non | E-mail d'où vient un retrait fait par son lien de désinscription ou par un signalement (NOT-022, AUT-071) ; sert au décompte des désinscrits d'un envoi groupé (COM-070). |
| `givenAt` | date-heure | oui | Moment où la personne a donné (ou retiré) son accord. Par défaut, celui de l'enregistrement ; une date antérieure n'est possible que pour un accord saisi par l'équipe. |
| `recordedById` | UUID → `User` | non | Membre de l'équipe qui a saisi l'accord à la place du client. Nul quand la personne l'a donné elle-même. |
| `proofDocumentId` | UUID → `DossierDocument` | non | Preuve d'un accord saisi par l'équipe : e-mail ou document signé, déposé comme pièce du dossier (GED-037). |
| `proofNote` | `Varchar(1000)` | selon | Compte rendu d'un accord oral. Pour un accord saisi par l'équipe : la preuve ou le compte rendu est obligatoire. |
| `ipHash` | `Char(64)` | non | |
| `userAgent` | `Varchar(400)` | non | |

**MOD-106** Une ligne de consentement n'est jamais modifiée ni supprimée. L'état courant d'un consentement est celui de la ligne la plus récente (`givenAt`) pour le couple (personne, type) — et, pour `PARTY_AUTHORIZATION`, pour chaque personne concernée (`partyId`). Au moins un des champs `userId`, `clientId`, `leadId`, `registrationId` est renseigné. Toute nouvelle ligne `DATA_SHARING_PARTNERS` ou `MARKETING_EMAIL` émet l'événement `consent.changed` (AUT-010).

### 1.7 `PushDevice` `[MOB]`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `userId` | UUID → `User` | oui | Cascade. |
| `platform` | `PushPlatform` | oui | |
| `token` | `Varchar(400)` | oui | Unique. |
| `appVersion` | `Varchar(20)` | non | |
| `lastSeenAt` | date-heure | oui | |
| `revokedAt` | date-heure | non | Renseigné à la déconnexion ou quand le service de notification signale un jeton invalide. |

---

## 2. Référentiels

### 2.1 `Country`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `code` | `Char(2)` | oui | Clé primaire. ISO 3166-1 alpha-2. |
| `nameFr` | `Varchar(80)` | oui | |
| `nameAr`, `nameEn` | `Varchar(80)` | non | |
| `currency` | `Char(3)` | oui | Devise des prix des biens de ce pays. |
| `phonePrefix` | `Varchar(6)` | oui | `+213`. |
| `timezone` | `Varchar(64)` | oui | Fuseau principal du pays : celui de sa capitale (`Africa/Algiers`, `Europe/Paris`, `America/Toronto`). Valeur de repli pour l'heure d'un client (`Client.timezone`) et valeur d'origine du fuseau d'un lieu (`Appointment.placeTimezone`). |
| `regionLabelFr` | `Varchar(40)` | oui | Mot employé pour le premier niveau : « Wilaya » en Algérie. Défaut « Région ». |
| `cityLabelFr` | `Varchar(40)` | oui | Défaut « Ville » ; « Commune » en Algérie. |
| `isCatalogueActive` | booléen | oui | Défaut `false`. Vrai : on peut publier des biens dans ce pays. Au lancement, seul `DZ`. |
| `isResidenceOption` | booléen | oui | Défaut `true`. Le pays figure dans la liste « Pays de résidence ». |
| `sortOrder` | entier | oui | |

Données de départ : tous les pays ISO, chacun avec le fuseau de sa capitale ; `DZ` actif pour le catalogue (`01-domaine/10`, § 2).

### 2.2 `Region`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `countryCode` | `Char(2)` → `Country` | oui | |
| `code` | `Varchar(10)` | oui | Code officiel (« 16 » pour Alger). Unique par pays. |
| `nameFr` | `Varchar(120)` | oui | |
| `nameAr` | `Varchar(120)` | non | |
| `slug` | `Varchar(80)` | oui | Unique par pays. |
| `latitude`, `longitude` | `Decimal(9,6)` | non | Centre de la région. |
| `isActive` | booléen | oui | Défaut `true`. |
| `sortOrder` | entier | oui | |

Sur le site public, le filtre **« Ville »** de l'accueil et du catalogue porte sur la `Region` : pour le visiteur, « Alger » ou « Oran » sont des villes ; dans les données ce sont des wilayas. Le niveau `City` sert au filtre fin « Quartier ou commune ».

### 2.3 `City`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `regionId` | UUID → `Region` | oui | |
| `nameFr` | `Varchar(120)` | oui | |
| `nameAr` | `Varchar(120)` | non | |
| `slug` | `Varchar(80)` | oui | Unique par région. |
| `latitude`, `longitude` | `Decimal(9,6)` | non | Centre de la commune ; sert à centrer la carte quand le bien n'a pas de coordonnées. |
| `isActive` | booléen | oui | Défaut `true`. |

### 2.4 `TravelTime` `[P1]`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `regionId` | UUID → `Region` | oui | Cascade. |
| `originCity` | `Varchar(80)` | oui | « Paris », « Marseille », « Lyon », « Montréal »… |
| `originCountryCode` | `Char(2)` | oui | |
| `airportCode` | `Varchar(4)` | oui | Aéroport d'arrivée : « ALG », « ORN ». |
| `minutes` | entier | oui | Durée habituelle du vol. |
| `isDirect` | booléen | oui | Faux : afficher « via {note} ». |
| `note` | `Varchar(120)` | non | |

Unicité : (`regionId`, `originCity`).

### 2.5 `ExchangeRate`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `fromCurrency` | `Char(3)` | oui | |
| `toCurrency` | `Char(3)` | oui | Différente de `fromCurrency`. |
| `kind` | `ExchangeRateKind` | oui | |
| `rate` | `Decimal(18,8)` | oui | **1 unité de `fromCurrency` = `rate` unités de `toCurrency`.** Exemple : `EUR` → `DZD`, `148.50000000`. Strictement positif. |
| `asOf` | date | oui | Date de validité du cours. Pas dans le futur. |
| `source` | `Varchar(120)` | non | « Banque d'Algérie », « saisie manuelle ». |
| `createdById` | UUID → `User` | non | |
| `voidedAt` | date-heure | non | Cours **annulé** (erreur de saisie). Un cours annulé n'est plus jamais choisi. |
| `voidedById` | UUID → `User` | non | |
| `voidReason` | `Varchar(200)` | selon | Obligatoire à l'annulation. |

Pas de contrainte d'unicité : plusieurs cours peuvent porter la même date (une correction le jour même). Le cours, sa date et sa nature ne sont **jamais modifiés** : une correction est une nouvelle ligne, et un cours faux s'**annule** (BNK-064). Index : (`fromCurrency`, `toCurrency`, `kind`, `asOf` décroissant, `createdAt` décroissant). Règle de sélection du cours : `01-domaine/07`, CAL-010.

### 2.6 `Holiday`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `date` | date | oui | |
| `label` | `Varchar(120)` | oui | |
| `recurring` | booléen | oui | Vrai : même jour et même mois chaque année ; la date est alors stockée avec l'année 2000, et le calendrier (CAL-060) n'en compare que le jour et le mois. |

Unicité : `date`. Sert au calendrier de travail (CAL-060).

---

## 3. Partenaires

### 3.1 `Promoter` ⌫ ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `organizationId` | UUID → `Organization` | oui | Unique. |
| `legalName` | `Varchar(160)` | oui | Raison sociale. |
| `brandName` | `Varchar(160)` | non | Nom commercial. Le nom affiché est `brandName` s'il existe, sinon `legalName`. |
| `slug` | `Varchar(80)` | oui | Unique. |
| `countryCode` | `Char(2)` → `Country` | oui | |
| `registrationNumber` | `Varchar(60)` | non | Registre de commerce. |
| `taxId` | `Varchar(60)` | non | Identifiant fiscal. |
| `licenseNumber` | `Varchar(60)` | non | Agrément de promoteur. |
| `addressLine` | `Varchar(200)` | non | |
| `regionId`, `cityId` | UUID | non | |
| `website` | `Varchar(200)` | non | Adresse `https://`. |
| `email` | `Citext` (254) | non | Adresse générale. |
| `phone` | `Varchar(20)` | non | |
| `descriptionPublic` | texte (2 000) | non | Présentation montrée sur le site. |
| `referencesPublic` | `Varchar(600)` | non | Références montrées au public (« 214 logements livrés depuis 2018 »). |
| `foundedYear` | entier | non | Entre 1900 et l'année en cours. |
| `deliveredUnits` | entier | non | Logements déjà livrés. |
| `logoMediaId`, `coverMediaId` | UUID → `Media` | non | |
| `status` | `PartnerStatus` | oui | Défaut `PROSPECT`. |
| `statusChangedAt` | date-heure | non | Dernier changement de statut (CYC-240). |
| `accountManagerId` | UUID → `User` | non | L'interlocuteur du partenaire dans l'équipe (ACP-083) : renseigné à l'acceptation d'une candidature avec son auteur, modifiable sur la fiche (CTL-003). |
| `statusReason` | `Varchar(500)` | selon | Raison du dernier passage à `SUSPENDED` ou `ENDED` : obligatoire pour ces deux statuts, vidée au passage à `ACTIVE` ou `PROSPECT`. Affichée dans l'en-tête de la fiche, avec `statusChangedAt` : « Suspendu le {date} : {raison} » · « Relation terminée le {date} : {raison} ». |
| `accessLevel` | `PartnerAccessLevel` | oui | Défaut `MANAGED`. Niveau d'accès du promoteur à la plateforme (MOD-115). |
| `vettedAt` | date | non | Date de sélection. Obligatoire pour passer `ACTIVE`. |
| `vettedById` | UUID → `User` | non | |
| `vettingChecklist` | `Json` | non | Liste `[{label, done, note}]` : contrôles faits avant sélection (Q-003). |
| `conventionSignedAt` | date | non | Obligatoire pour passer `ACTIVE`. |
| `conventionExpiresAt` | date | non | Alerte 30 jours avant (AUT-073). |
| `commissionTerms` | texte (1 000) | non | Interne. Conditions commerciales de la convention : lues et modifiées avec la permission `partner.convention.manage` seulement (CTL-003) ; absentes des exports et des réponses de l'API pour les autres rôles. |
| `isPublic` | booléen | oui | Défaut `false`. Vrai : visible sur la page « Promoteurs ». Ne passe à vrai que si `status = ACTIVE` ; une suspension ou une fin de relation ne le modifie pas : la page n'est servie que si `isPublic` est vrai **et** `status = ACTIVE` (EDI-031, CTL-004). |
| `sortOrder` | entier | oui | Défaut 0. |

**MOD-110** Un bien ne peut être **publié** que si son promoteur est `ACTIVE`. Quand un promoteur passe `SUSPENDED` ou `ENDED`, ses programmes et ses biens publiés sont **dépubliés** dans la même transaction (retour à `DRAFT`), après confirmation qui en donne le nombre ; chacun garde la marque `unpublishedBySuspensionAt`, pour pouvoir être republié en une fois si le promoteur redevient `ACTIVE` (CYC-240, CTL-004). Les dossiers en cours ne sont pas touchés (un bien hors ligne n'est pas un bien indisponible, CYC-121) ; leurs conseillers reçoivent une notification.

**MOD-111** Un promoteur ne peut pas être supprimé s'il a des programmes, des biens ou des dossiers. Il s'archive (`status = ENDED`).

**MOD-115** `[P1]` **Niveau d'accès** (`accessLevel`, sur `Promoter` et sur `Bank` ; `00-cadre/06`). Il dit par quelles portes le partenaire peut faire lui-même ce qu'on attend de lui : aucune (`MANAGED`), le lien sécurisé (`LINK`), le portail en plus (`PORTAL`). Il ne change **rien** aux objets, à leurs statuts ni à ce que lit le client (ACP-001). En Phase 1, il vaut `MANAGED` pour tous et ne se modifie pas (ACP-004) ; ses changements, ensuite : CYC-241.

### 3.2 `PromoterContact`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `promoterId` | UUID → `Promoter` | oui | Cascade. |
| `fullName` | `Varchar(160)` | oui | |
| `role` | `Varchar(80)` | non | « Directeur commercial ». |
| `email` | `Citext` (254) | non | |
| `phone` | `Varchar(20)` | non | |
| `isPrimary` | booléen | oui | Au plus un contact principal par promoteur (index unique partiel). |
| `notes` | `Varchar(500)` | non | |
| `answersRequests` | booléen | oui | `[P2]` Défaut `false`. Vrai : cet interlocuteur reçoit les demandes par lien et peut y répondre (ACP-040). Exige une adresse e-mail. |
| `userId` | UUID → `User` | non | `[P1]` Le compte de la personne qui a inscrit le promoteur (ACP-084). `[P2]` Son compte du portail, une fois invité (ACP-051). |

Au moins un des deux champs `email`, `phone` est renseigné.

### 3.3 `Bank` ⌫ ⟳

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `organizationId` | UUID → `Organization` | oui | Unique. |
| `name` | `Varchar(160)` | oui | |
| `shortName` | `Varchar(40)` | non | Sigle. |
| `slug` | `Varchar(80)` | oui | Unique. |
| `countryCode` | `Char(2)` → `Country` | oui | Pays du siège. |
| `logoMediaId` | UUID → `Media` | non | |
| `status` | `PartnerStatus` | oui | Défaut `PROSPECT`. |
| `statusChangedAt`, `statusReason` | date-heure, `Varchar(500)` | non, selon | Comme sur `Promoter`. |
| `accountManagerId` | UUID → `User` | non | Comme sur `Promoter` (ACP-083, BNK-002). |
| `accessLevel` | `PartnerAccessLevel` | oui | Défaut `MANAGED`. Niveau d'accès de la banque à la plateforme (MOD-115). |
| `conventionSignedAt`, `conventionExpiresAt` | date | non | |
| `descriptionPublic` | texte (1 500) | non | |
| `offersIslamicFinance` | booléen | oui | Défaut `false`. |
| `isPublic` | booléen | oui | Défaut `false`. Vrai : le nom et le logo peuvent apparaître sur le site (pages Financements et Partenaires, résultats du simulateur). |
| `defaultTransmissionMode` | `TransmissionMode` | oui | Défaut `SECURE_LINK`. `PORTAL` n'est possible que pour une banque de niveau 3 (`accessLevel = PORTAL`). |
| `submissionEmail` | `Citext` (254) | non | Boîte qui reçoit les dossiers, si la banque en impose une. |
| `reviewSlaDays` | entier | non | Délai d'étude habituel, en jours ; sert aux relances de suivi (AUT-041). |
| `sortOrder` | entier | oui | |

**MOD-112** Une soumission ne peut être créée que vers une banque `ACTIVE`.

### 3.4 `BankContact`

Mêmes champs que `PromoterContact` (avec `bankId`), plus :

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `bankId` | UUID → `Bank` | oui | Cascade. |
| `agency` | `Varchar(120)` | non | Agence ou direction. |
| `receivesSubmissions` | booléen | oui | Défaut `false`. Vrai : proposé comme destinataire d'un envoi de dossier. |
| `answersRequests` | booléen | oui | `[P3]` Défaut `false`. Comme pour un promoteur (ACP-040). |
| `userId` | UUID → `User` | non | `[P1]` Le compte de la personne qui a inscrit la banque (ACP-084). `[P3]` Son compte du portail (ACP-051). |

### 3.5 `BankProduct` ⌫ ⟳ — produit de financement (barème)

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `bankId` | UUID → `Bank` | oui | |
| `name` | `Varchar(160)` | oui | « Crédit immobilier diaspora ». |
| `financingType` | `FinancingType` | oui | |
| `islamicContractLabel` | `Varchar(60)` | non | Nom du montage (« Mourabaha »). Autorisé seulement si `financingType = ISLAMIC`. |
| `pricingMethod` | `PricingMethod` | oui | Défaut `AMORTIZED_RATE`. |
| `segment` | `TargetSegment` | oui | Défaut `DIASPORA`. Information de présentation (liste et fiche du produit), **sans effet sur le calcul** : les conditions de résidence sont portées par `eligibleResidency`. |
| `propertyCountryCode` | `Char(2)` → `Country` | oui | Pays des biens que ce produit finance. |
| `currency` | `Char(3)` | oui | Devise du financement. |
| `nominalRateBps` | entier | oui | Taux annuel de base, ou marge annuelle pour un produit islamique. 0 à 3 000. |
| `rateBands` | `Json` | non | Barème **par durée**, facultatif : `[{ "maxDurationMonths": 180, "rateBps": 590 }, { "maxDurationMonths": 300, "rateBps": 650 }]`. Durées strictement croissantes, six tranches au plus, chaque taux de 0 à 3 000. Règle de choix : CAL-048. |
| `minAmount`, `maxAmount` | `Decimal(14,2)` | oui | Strictement positifs ; `minAmount` ≤ `maxAmount`. Dans `currency`. |
| `minDurationMonths`, `maxDurationMonths` | entier | oui | 12 à 480 ; min ≤ max. |
| `maxDebtRatioPct` | `Decimal(5,2)` | oui | 1 à 100. Part maximale des revenus consacrée aux remboursements. |
| `minDownPaymentPct` | `Decimal(5,2)` | oui | 0 à 90. |
| `maxAgeAtEnd` | entier | non | Âge maximal à la dernière échéance. 50 à 90. |
| `minMonthlyIncome` | `Decimal(12,2)` | non | Revenu mensuel minimal, dans `currency`. |
| `eligibleResidency` | `ResidencyStatus[]` | oui | Vide = toutes les situations. |
| `acceptedIncomeCurrencies` | `Char(3)[]` | oui | Vide = toutes. |
| `acceptedResidenceCountries` | `Char(2)[]` | oui | Vide = tous. |
| `insuranceRateBps` | entier | non | Assurance : taux annuel appliqué au capital initial. 0 à 500. |
| `fileFeeFixed` | `Decimal(14,2)` | non | Frais de dossier fixes, dans `currency`. |
| `fileFeePct` | `Decimal(5,2)` | non | Frais de dossier en % du montant financé. 0 à 10. |
| `otherFeesNote` | `Varchar(500)` | non | Autres frais, en clair (« Frais d'expertise : selon devis »). Saisi dans la section Tarification (BNK-021) ; montré sous les frais dans le détail d'une simulation (SIM-021) et dans le sommaire d'une soumission. |
| `requiredChecklistId` | UUID → `ChecklistTemplate` | non | Liste de pièces exigée par ce produit (portée `BANK_FILE`). |
| `isExample` | booléen | oui | Défaut `false`. Vrai : produit fictif des données de départ ; jamais utilisé en production (PAR-040). |
| `isActive` | booléen | oui | Défaut `true`. |
| `isPublicInSimulators` | booléen | oui | Défaut `true`. Faux : utilisable par le personnel, invisible des simulateurs publics. |
| `validFrom`, `validTo` | date | non | Hors de cette période le produit est ignoré. |
| `ratesConfirmedAt` | date-heure | non | Dernière vérification du barème avec la banque (BNK-024). Sert à la vérification périodique (AUT-079). |
| `ratesConfirmedBy` | `Varchar(160)` | non | Nom de l'interlocuteur de la banque qui l'a confirmé. |
| `sortOrder` | entier | oui | |

**MOD-113** Un produit est **utilisable** par les simulateurs s'il est actif, non supprimé, dans sa période de validité, non fictif (sauf hors production), et si sa banque est `ACTIVE`.

**MOD-114** Modifier un produit n'affecte pas les simulations ni les soumissions déjà enregistrées : elles conservent une copie des paramètres utilisés (`Simulation.parametersSnapshot`, champs propres de `BankSubmission`).

### 3.6 `Partner` ⌫ — autre partenaire public

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `name` | `Varchar(160)` | oui | |
| `category` | `PartnerCategory` | oui | |
| `logoMediaId` | UUID → `Media` | non | |
| `url` | `Varchar(200)` | non | |
| `descriptionPublic` | `Varchar(600)` | non | |
| `isPublic` | booléen | oui | Défaut `false`. |
| `sortOrder` | entier | oui | |

### 3.7 `PartnerDocument` ⌫ — document d'un promoteur ou d'une banque

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `ownerType` | `PartnerDocumentOwner` | oui | |
| `ownerId` | UUID | oui | |
| `label` | `Varchar(160)` | oui | |
| `category` | `Varchar(60)` | oui | « Agrément », « Convention », « Registre de commerce », « Attestation », « Autre ». |
| `storageKey` | `Varchar(400)` | oui | Stockage privé. |
| `fileName` | `Varchar(200)` | oui | |
| `mimeType` | `Varchar(100)` | oui | |
| `sizeBytes` | entier | oui | |
| `checksumSha256` | `Char(64)` | oui | |
| `scanStatus` | `ScanStatus` | oui | |
| `issuedAt`, `expiresAt` | date | non | Alerte 30 jours avant l'expiration (AUT-073). |
| `uploadedById` | UUID → `User` | oui | |

### 3.8 `PartnerAnswer` `[P2]` `[P3]` — réponse d'un partenaire

Une ligne par réponse qu'un partenaire donne **lui-même**, par lien ou dans le portail (ACP-031). La saisie par l'équipe n'en crée pas : elle applique le geste, et le journal d'audit en garde l'auteur (ACP-013). La table est prévue au schéma dès la Phase 1 ; rien ne l'alimente avant le niveau 2.

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `organizationId` | UUID → `Organization` | oui | Le partenaire. |
| `gesture` | `PartnerGesture` | oui | |
| `entityType` | `Varchar(40)` | oui | L'objet du geste : `Reservation`, `BankSubmission`, `DossierDocument`, `Appointment`, `Promoter` (état du stock : ses programmes à vérifier et leurs lots), `Program`, `Property`, `BankProduct`, `Bank`, `PartnerDocument`. |
| `entityId` | UUID | oui | |
| `dossierId` | UUID → `Dossier` | non | Pour retrouver les réponses d'un dossier. |
| `route` | `GestureRoute` | oui | `LINK` ou `PORTAL`. |
| `secureShareId` | UUID → `SecureShare` | selon | Le lien employé. Obligatoire si `route = LINK`. |
| `userId` | UUID → `User` | selon | L'utilisateur du portail. Obligatoire si `route = PORTAL`. |
| `contactName` | `Varchar(160)` | oui | Nom de l'auteur, copié au moment de la réponse. |
| `payload` | `Json` | oui | Les champs du geste, tels que saisis. Validés par le même schéma que la commande. |
| `note` | `Varchar(1000)` | non | « Un mot pour l'équipe ». |
| `status` | `PartnerAnswerStatus` | oui | Un geste direct naît `APPLIED` ; un geste relu naît `PENDING` — ou `INTERNAL`, dans le portail d'une banque qui fait valider ses décisions par un responsable avant de les transmettre (PBQ-013). |
| `receivedAt` | date-heure | oui | |
| `reviewedById` | UUID → `User` | non | Le membre de l'équipe qui a appliqué ou écarté. |
| `reviewedAt` | date-heure | non | |
| `appliedPayload` | `Json` | non | Ce qui a été appliqué, s'il a été modifié avant de l'être. |
| `reviewNote` | `Varchar(500)` | selon | Obligatoire à l'état `DISMISSED`. |

Index : (`organizationId`, `status`) · (`entityType`, `entityId`) · `dossierId`.

**MOD-116** `[P2]` `[P3]` Pour un geste qui **tranche** (`OPTION_ANSWER`, `RESERVATION_CONFIRM`, `DEPOSIT_OUTCOME`, `VISIT_HOST`, `DELIVERY_UPDATE`, `DECISION`, `OFFER_EXTEND`, `PRODUCT_UPDATE`), au plus **une** réponse `PENDING` par objet : une nouvelle réponse fait passer la précédente à `SUPERSEDED`. Pour un geste qui **s'ajoute** (`INFO_REQUEST`, `DOCUMENT_PROVIDE`, `PARTNER_DOCUMENT`, `STOCK_UPDATE`), chaque réponse est gardée (ACP-032). Une réponse `APPLIED`, `DISMISSED` ou `SUPERSEDED` ne change plus. Les réponses suivent la conservation du dossier auquel elles se rattachent (SEC-110).

Mêmes règles de fichier que les pièces (`06-technique/05`).
