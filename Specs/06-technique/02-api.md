# API

Conventions communes à toutes les routes, puis la carte des ressources. Le détail de chaque route (champs, exemples) est produit par l'API elle-même au format OpenAPI (ARC-031) ; ce fichier fixe ce qui ne doit pas varier d'une route à l'autre.

---

## 1. Conventions

**API-001** `[P1]` Base : `/api/v1`. HTTPS seulement. Contenu JSON en UTF-8. Noms de champs en `camelCase`. Les identifiants sont des UUID ; les objets qui ont une référence lisible (TRV-051) sont aussi adressables par elle dans les routes d'administration.

**API-002** `[P1]` **Formats.**

| Donnée | Format | Exemple |
|---|---|---|
| Instant | ISO 8601, en UTC | `"2026-10-17T08:00:00Z"` |
| Date sans heure | `AAAA-MM-JJ` | `"2026-10-17"` |
| Montant | Objet : valeur en **chaîne** décimale et devise | `{"amount": "150000.00", "currency": "EUR"}` |
| Taux | Entier, en points de base | `650` |
| Pourcentage | Chaîne décimale | `"20.00"` |
| Téléphone | E.164 | `"+33612345678"` |
| Énumération | La valeur du modèle | `"BANK_REVIEW"` |
| Valeur absente | `null` ; jamais une chaîne vide ni un champ omis | |

Exception : un champ sensible (SEC-033) que le lecteur n'a pas le droit de lire est **omis**, et l'objet qui le contient porte `"withheld": ["monthlyIncome", …]`, la liste des champs omis — toujours présente sur les entités de SEC-033, vide (`[]`) quand rien n'est omis ; une clé d'un champ JSON y est nommée par son chemin (`"payload.monthlyIncome"`). L'écran affiche « Réservé » pour un champ de cette liste, « — » pour une valeur `null` (TRV-025). Le schéma partagé (ARC-030) déclare facultatifs ces champs-là, et eux seuls.

L'API ne renvoie **aucun texte destiné à l'écran**, sauf les contenus saisis (titres, descriptions, messages) : les libellés sont l'affaire des applications (TRV-002).

**API-003** `[P1]` **Session.** Applications web : deux cookies `HttpOnly`, posés par l'API — un jeton d'accès de courte durée et un jeton de renouvellement (SEC-020). Application mobile : les mêmes jetons, transmis dans l'en-tête `Authorization`. Toute requête qui modifie quelque chose depuis un navigateur porte en plus un jeton anti-falsification (SEC-027).

**Audience.** L'audience d'une requête `/auth` est déduite de l'en-tête `Origin` (à défaut `Referer`), comparé à `WEB_URL` (→ `WEB`) et à `ADMIN_URL` (→ `ADMIN`) ; `[MOB]` l'application mobile envoie l'en-tête `X-Audience: MOBILE`. Depuis l'origine de `WEB_URL`, l'espace partenaire envoie `X-Audience: PARTNER` (→ `PARTNER`, EP-33). Aucun champ du corps ne la choisit ; une origine inconnue répond `400 BAD_REQUEST`, sauf pour une lecture (`GET`, `HEAD`) sans `Origin` ni `Referer` — une page à jeton servie avec `Referrer-Policy: no-referrer` n'en envoie pas —, qui vaut audience `WEB` (ou `PARTNER` avec son en-tête) : elle ne change rien, et `SameSite=Lax` tient les cookies à l'écart des requêtes d'un autre site (SEC-027, D-097). L'audience fixe les noms des cookies (SEC-022), la durée de la session (SEC-023) et les comptes admis (ROL-004).

**Renouvellement.** `POST /auth/refresh` reçoit `{ "userActive": true | false }` : vrai si la personne a fait un geste (clic, saisie, navigation) depuis le renouvellement précédent ; seul `true` repousse l'échéance d'inactivité (`Session.lastUsedAt`, SEC-023). Sa réponse, et celle de toute route qui ouvre une session, contient `{ "csrfToken", "accessExpiresAt", "idleExpiresAt", "absoluteExpiresAt", "user": { "id", "kind", "firstName", "lastName", "role" } }` ; l'écran avertit deux minutes avant `idleExpiresAt` (BO-004).

**API-004** `[P1]` **Langue.** L'en-tête `Accept-Language` choisit la langue des contenus traduisibles (TRV-004) ; à défaut, le français.

## 2. Listes

**API-010** `[P1]` **Pagination.** Paramètres `page` (à partir de 1) et `pageSize` (bornée par liste : 12, 20, 25, 50, 100). La route des suggestions (`GET /public/properties/suggestions`, API-100) n'est pas paginée : trois biens au plus. Réponse :

```json
{ "data": [ … ], "meta": { "page": 1, "pageSize": 25, "total": 137, "totalPages": 6 } }
```

Les fils chronologiques (chronologie, messages, notifications) sont paginés par **curseur** : `before` ou `after`, et `limit` ; la réponse porte `meta.nextCursor`.

**API-011** `[P1]` **Tri** : `sort=champ` ou `sort=-champ` (décroissant). Seuls les champs déclarés triables sont acceptés. **Filtres** : un paramètre par critère ; plusieurs valeurs séparées par des virgules (« ou ») ; bornes par `champMin` et `champMax` ; périodes par `champFrom` et `champTo`. Un paramètre inconnu est ignoré sur les routes publiques (CAT-020) et refusé (`400`) ailleurs.

**API-012** `[P1]` **Recherche** : `q`, à partir de 2 caractères (TRV-103).

## 3. Erreurs

**API-020** `[P1]` Forme unique :

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "reason": null,
    "details": [ { "field": "phone", "code": "INVALID_PHONE" } ],
    "requestId": "req_01J9…"
  }
}
```

- `code` : l'un des codes de TRV-110 ;
- `reason` : le code de la raison, pour `CONFLICT_STATE` (`LOT_ALREADY_OPTIONED`, `MISSING_CONDITIONS`, `EVENT_FULL`… ; catalogue : `07-design/03`, § 4), pour `ACCOUNT_SUSPENDED` (une valeur de `SuspensionReason`) et pour `FORBIDDEN` (`WRONG_AUDIENCE`, un compte du personnel ou d'un partenaire qui se connecte à l'espace client, AUTH-022 ; sa phrase : `07-design/03`, § 4 ; et `REAUTH_REQUIRED`, une action du back-office qui redemande le mot de passe, BO-005 ; et `PREVIEW_READ_ONLY`, une écriture tentée depuis une session d'aperçu, ROL-017) ; `null` sinon ;
- `params` : objet, `null` quand le message n'a rien à compléter. Il porte, pour tout code, ce que le message affiche : pour une raison de `CONFLICT_STATE`, les champs de sa phrase sous leur nom (`{"prenom": "Amel"}`, `{"date": "2026-10-17"}`, `{"n": 2}`) ; `CONFLICT_VERSION` : `{"currentVersion": 7, "updatedByFirstName": "Amel", "updatedAt": "2026-10-12T09:41:07Z"}` ; `DUPLICATE` : `{"existingId": "…", "existingReference": "DOS-2026-0042"}`, sans ces champs si l'appelant n'a pas le droit de voir l'existant ; `RATE_LIMITED` : `{"retryAfterSeconds": 60}` ; `ACCOUNT_LOCKED` : `{"minutes": 15}` ; `FILE_TOO_LARGE` : `{"maxMb": 15}` ; `UNSUPPORTED_FILE_TYPE` : `{"allowed": ["pdf", "jpg"]}` ; `INVALID_CODE` : `{"remaining": 3}` (AUTH-050) ; une réponse `423` porte aussi l'en-tête `Retry-After` ;
- `details` : pour `VALIDATION_ERROR`, une entrée par champ, avec un code de TRV-064 ; pour une transition refusée faute de conditions, une entrée par condition manquante (`code: "MISSING_CONDITION"`, `field: "SELECTED_CANDIDATE"`, API-102) ;
- `requestId` : toujours présent.

Aucun message technique, aucune trace d'exécution, aucun nom de table ne sort dans une réponse.

**API-102** `[P1]` **Conditions d'une transition.** Une transition (ARC-012) se contrôle en deux temps.
1. **Refus d'état**, contrôlés d'abord : le premier rencontré est renvoyé seul, `409 CONFLICT_STATE` avec sa raison. Ce sont : une transition absente de la table ou une étape sautée (`TRANSITION_NOT_ALLOWED`, `CANNOT_SKIP_STAGE`), une transition automatique tentée à la main (`STAGE_IS_AUTOMATIC`), un dossier en pause, pour les seuls gestes que CYC-034 et CYC-105 refusent pendant une pause (`DOSSIER_ON_HOLD`), et ceux que nomme la dernière colonne du tableau.
2. **Conditions** : toutes sont évaluées ; chacune qui manque donne une entrée de `details[]`, avec `code` = `"MISSING_CONDITION"` et `field` = le code de la condition. Réponse : `409 CONFLICT_STATE`, `reason` = `MISSING_CONDITIONS` — `NOT_PUBLISHABLE` pour une publication (CYC-120, CYC-125). Le code de détail est au singulier (une condition), la raison au pluriel (la liste) : deux niveaux, à ne pas confondre.

Un champ que la fenêtre du geste demande elle-même (motif, date de confirmation du promoteur, nouvelle échéance d'une option) n'est pas une condition : s'il manque, la réponse est `422 VALIDATION_ERROR` (TRV-064).

| Transition | Codes de condition (`field`) | Refus d'état nommés |
|---|---|---|
| CYC-020 | `AGENT_ASSIGNED` | — |
| CYC-021 | (a) `FIRST_CONTACT` · (b) `CLIENT_NAME`, `CLIENT_RESIDENCE_COUNTRY`, `CLIENT_RESIDENCY_STATUS`, `CLIENT_BUDGET`, `CLIENT_DOWN_PAYMENT`, `CLIENT_FINANCING_PREFERENCE`, `CLIENT_TIMEFRAME` · (c) `CLIENT_CONTACT_ALLOWED` | — |
| CYC-022 | (a) `SELECTED_CANDIDATE` · (b) `PROPERTY_AVAILABLE` · (d) `CLIENT_EMPLOYMENT`, `CLIENT_RESIDENCY_STATUS` | (b) bien hors ligne : `PROPERTY_OFFLINE` (CYC-121) · (c) `NO_CHECKLIST_TEMPLATE` (MOD-340) |
| CYC-024 | `DOSSIER_COMPLETE` · `LOT_SELECTED` · `LOT_RESERVED` | — |
| CYC-026 | (a) `ACCEPTED_SUBMISSION` · (b) `LOT_SELECTED` · (c) `LOT_RESERVED` | — |
| CYC-027 | (a) `DEED_SIGNED` · (b) `SALE_AMOUNT` · (c) `LOT_SELECTED`, puis `LOT_RESERVED` — `LOT_AVAILABLE` quand la réservation n'est pas exigée | — |
| CYC-105 (pose d'une option), CYC-106 | `LOT_OF_SELECTED_PROPERTY` | `LOT_ALREADY_OPTIONED` (MOD-330) · `LOT_NOT_AVAILABLE` (lot vendu, retiré ou réservé hors plateforme) · `DOSSIER_HAS_RESERVATION` (MOD-331) · `PROPERTY_OFFLINE` (CYC-121) · étape antérieure à `MATCHING` : `TRANSITION_NOT_ALLOWED` |
| CYC-105 (prolongation) | — | `MAX_EXTENSIONS_REACHED` |
| CYC-120 | (1) `REQUIRED_FIELDS` · (2) `LOT_WITH_PRICE` · (3) `READY_MEDIA` · (4) `COMPLETENESS_SCORE` · (5) `PROMOTER_ACTIVE` · (6) `PROGRAM_PUBLISHED` · (7) `COUNTRY_ACTIVE` | — |
| CYC-125 | `REQUIRED_FIELDS` · `DESCRIPTION_LENGTH` · `PROMOTER_ACTIVE` · `READY_MEDIA` · `COUNTRY_ACTIVE` | — |
| CYC-161 (et CYC-023, qui en découle) | (1) `DOSSIER_COMPLETE` · (2) `BANK_DOCS_VALIDATED` · (3) `LOAN_REQUEST` · (5) `PROPERTY_AVAILABLE` · (6) `TRANSMISSION_DETAILS` · (7) `FINANCING_REQUESTED` | (4) `CONSENT_REQUIRED` · (6) `PACKAGE_OUTDATED` (mode `MANUAL`) · (8) `PARTY_CONSENT_MISSING`, `PARTY_RESTRICTED` · (9) `BANK_NOT_ACTIVE` |

Cette liste est fermée ; `packages/contracts` la publie (ARC-030). Le libellé de chaque code est dans `07-design/03`, sous la clé `ui.condition.{CODE}`. Une nouvelle condition reçoit son code ici et son libellé là.

**API-021** `[P1]` **Statuts HTTP** : `200` lecture ou modification réussie · `201` création · `202` travail accepté, fait en arrière-plan (export, import, paquet) · `204` suppression · les statuts d'erreur de TRV-110. Une ressource que l'appelant n'a pas le droit de **connaître** répond `404` ; une action qu'il n'a pas le droit de **faire** sur une ressource qu'il voit répond `403`.

## 4. Écriture sûre

**API-040** `[P1]` **Idempotence.** Toute route qui **crée** depuis un formulaire public ou client exige l'en-tête `Idempotency-Key` (TRV-091) : demandes, inscriptions, messages, dépôts, création de compte. Comportement :

| Situation | Réponse |
|---|---|
| Clé inconnue | La requête est traitée. Si elle **réussit** (`2xx`), la réponse est gardée 24 heures avec l'empreinte du corps. Une réponse d'erreur (`4xx`, `5xx`) n'est **pas gardée** : la clé reste libre, et un nouvel envoi — corrigé ou non — est traité normalement. |
| Même clé, même corps, après une réussite | La **même réponse** est renvoyée, sans rien refaire. |
| Même clé, corps différent, après une réussite | `422`, code `IDEMPOTENCY_KEY_REUSED`. |
| Même clé, première requête encore en cours | `409`, code `REQUEST_IN_PROGRESS`. |

**La clé** est un UUID (version 4 ou 7) écrit en minuscules. Absente sur une route qui l'exige, ou d'une autre forme : `400 BAD_REQUEST`.

**Une clé appartient à son appelant.** La portée de la ligne `IdempotencyKey` (`scope`) contient l'appelant : le compte de la session, sinon l'empreinte de l'adresse IP (`IP_HASH_KEY`). Une réponse gardée n'est rendue qu'au même appelant ; la même clé présentée par un autre est, pour lui, une clé inconnue.

**Mécanisme.** La ligne est insérée et validée **seule**, avant le traitement : c'est ce qui rend `REQUEST_IN_PROGRESS` visible. Sa complétion (statut, corps, empreinte du corps de la requête) est écrite **dans la transaction même de l'action** (FIA-001) : une action validée a toujours sa réponse gardée. Une ligne sans réponse plus vieille que 30 s ne peut donc venir que d'une action non validée, et la reprendre ne double rien. Réponse `4xx` ou `5xx`, ou exception : la ligne est **supprimée**. `REQUEST_IN_PROGRESS` n'est rendu que si la ligne existe sans réponse depuis moins de 30 secondes (durée maximale d'une requête, API-060) ; plus ancienne, elle est tenue pour abandonnée (instance tombée), remplacée, et la requête est traitée.

Les routes du back-office acceptent la même clé, sans l'exiger. Côté écran : TRV-091 (nouvelle clé après un refus du serveur, même clé après une coupure).

**API-050** `[P1]` **Modification simultanée.** Toute modification d'un objet à version (MOD-007) envoie la version lue (`version` dans le corps). Si elle ne correspond plus : `409 CONFLICT_VERSION`, avec la version courante, le nom du dernier auteur et l'heure (dans `params`, API-020 ; écran : TRV-094).

**API-051** `[P1]` **Transitions.** Un changement de statut ne se fait **jamais** en modifiant le champ : chaque transition a sa route d'action (`POST /admin/dossiers/{id}/qualify`, `…/hold`, `…/close`). La réponse renvoie l'objet à jour.

**API-052** `[P1]` **Annonce des effets.** Une fenêtre qui annonce, avant confirmation, les effets chiffrés d'une action ne les calcule pas elle-même (TRV-106) : elle appelle la route de l'action, avec le même corps, et le paramètre `dryRun=1`. La route fait les mêmes contrôles — permission, refus d'état, conditions, avec les mêmes erreurs — puis répond `200` avec `{ "effects": [ { "code": "PROPERTIES_UNPUBLISHED", "count": 7, "items": [ { "id": "…", "label": "Appartement T3 – Résidence El Yasmine" } ] } ] }`, **sans rien écrire** ni rien émettre. `items` donne au plus 50 objets (`count` reste le total), avec `date` et `amount` quand la phrase de la fenêtre en affiche ; un effet nul n'est pas listé. L'écran compose ses phrases d'après les codes. La confirmation rappelle la route sans `dryRun`, et l'action recalcule tout : si l'état a changé entre-temps, l'effet réel l'emporte sur l'annonce. Codes par action :

| Action | Codes d'effet |
|---|---|
| Suspendre ou terminer un promoteur (CTL-004) | `PROGRAMS_UNPUBLISHED`, `PROPERTIES_UNPUBLISHED`, `OPEN_DOSSIERS` |
| Dépublier ou archiver un programme (CTL-024, CYC-126) | `PROPERTIES_UNPUBLISHED` ou `PROPERTIES_ARCHIVED`, `OPEN_DOSSIERS` |
| Archiver un bien (CTL-044) | `DOSSIERS_CONSIDERING`, `DOSSIERS_SELECTED` |
| Marquer un lot vendu ou retiré (CTL-062) | `DOSSIERS_CONSIDERING`, `DOSSIERS_TARGETING_LOT` |
| Modifier le prix de plusieurs lots (CTL-061) | `LOTS_REPRICED` (`amount` : nouveau prix ; `previousAmount` : ancien), `LOTS_WITH_RESERVATION` |
| Annuler une option ou une réservation (PIP-050) | `DOSSIERS_CONSIDERING`, `DEPOSIT_TO_FOLLOW` |
| Changer de bien retenu (CYC-072) | `PROPERTY_DOCUMENTS_RESET`, `OPTION_CANCELLED` |
| Mettre un dossier en pause (PIP-080) | `OPTION_RUNNING`, `OFFER_RUNNING`, `APPOINTMENT_UPCOMING` |
| Clôturer un dossier (PIP-081) | `RESERVATION_CANCELLED`, `SUBMISSIONS_WITHDRAWN`, `TASKS_CANCELLED`, `APPOINTMENTS_CANCELLED` |
| Passer avec ou sans financement (PIP-055, CYC-041) | `DOCUMENTS_WAIVED`, `DOCUMENTS_CREATED`, `WAIVERS_LIFTED`, `DRAFT_SUBMISSIONS_WITHDRAWN`, `GUARANTORS_REMOVED`, `STAGE_BACK_TO_DOCUMENTS` |
| Réévaluer la liste de pièces (GED-031, `reevaluate`) | `DOCUMENTS_CREATED`, `DOCUMENTS_WAIVED`, `WAIVERS_LIFTED` |
| Ajouter ou retirer un emprunteur (PIP-055, MOD-320, MOD-321) | `DOCUMENTS_CREATED`, `DOCUMENTS_WAIVED`, `WAIVERS_LIFTED` |
| Conditions acceptées (CYC-026) | `SUBMISSIONS_WITHDRAWN` |

Une nouvelle fenêtre à effets chiffrés reçoit ses codes ici. Une route de transition d'un objet à version envoie, comme toute modification, la `version` lue (API-050) : de deux transitions simultanées, la seconde reçoit `409 CONFLICT_VERSION` (pipeline : PIP-008).

## 5. Débit et limites

**API-060** `[P1]` Les limites de débit sont dans SEC-070. Une réponse `429` porte `Retry-After`. Corps JSON : 1 Mo au plus. Les fichiers ne passent pas par l'API (API-080). Délai de réponse au-delà duquel une requête est abandonnée : 30 secondes ; tout travail plus long est fait en arrière-plan (`202`).

## 6. Temps réel

**API-070** `[P1]` Un **flux d'événements** par utilisateur connecté (`GET /client/stream`, `GET /admin/stream`), à sens unique, du serveur vers l'écran. Chaque événement nomme ce qui a changé ; l'écran **relit** alors la ressource par sa route habituelle — le flux ne transporte pas les données.

| Événement | Envoyé à | Signifie |
|---|---|---|
| `notification.created` | le destinataire | Une notification est arrivée (compteur, liste). |
| `message.created` | les participants du fil | Un message est arrivé. |
| `dossier.updated` | le client du dossier, les membres de l'équipe qui le voient | Étape, état, complétude ou prochaine étape a changé ; ou bien un bien proposé, une soumission, une offre, une option ou une réservation du dossier. |
| `document.updated` | idem | Statut d'une pièce. |
| `lead.created`, `lead.updated` | l'équipe | Boîte d'arrivée, compteurs. |
| `pipeline.changed` | l'équipe | Une carte a bougé. |
| `task.updated` | la personne affectée | |
| `event.seats_changed` `[P1]` | l'équipe | Places d'un Café. |

Cette liste est **complète** : ce sont les neuf noms du flux d'écran. Ils ne sont pas les événements métier du catalogue AUT-010, même quand un nom coïncide (`lead.created`) : aucune règle d'automatisation ne s'y abonne, et un événement métier n'atteint l'écran que par l'un d'eux.

Une liaison coupée se rétablit seule et reprend là où elle en était (`Last-Event-ID`). Un battement toutes les 25 secondes la maintient. Sans flux : rafraîchissement toutes les 60 secondes (ECL-003). Le flux est fermé dans la minute qui suit la révocation de sa session (SEC-028) ; une session d'aperçu (ROL-017) n'ouvre pas de flux.

**Protocole.** Server-Sent Events (`text/event-stream`), ouvert avec les cookies de session — une lecture, donc sans jeton anti-falsification ; l'application mobile passe l'en-tête `Authorization` (API-003). Chaque message porte `id` (ULID, croissant), `event` (l'un des neuf noms) et `data`, en JSON : `{"id": "…", "reference": "…"}` — l'identifiant de la ressource à relire et sa référence lisible, `null` si elle n'en a pas ; rien d'autre. **Diffusion** : le travailleur de la boîte d'envoi publie sur un canal Redis par destinataire (`stream:user:{userId}`) ; les destinataires « de l'équipe » sont les comptes du personnel qui voient l'objet (ROL-014). **Reprise** : les messages des 5 dernières minutes sont gardés par utilisateur ; un `Last-Event-ID` plus ancien reçoit le message `reset` (hors des neuf noms), et l'écran recharge ce qu'il affiche. **Session** : revérifiée à chaque battement (la session de SEC-020, pas le jeton d'accès) ; révoquée ou expirée, le flux se ferme.

## 7. Fichiers

**API-080** `[P1]` **Dépôt en trois temps**, pour tout fichier (pièce, pièce jointe, média) :
1. `POST …/uploads` avec le nom, le type, la taille **et l'empreinte SHA-256** de chaque fichier → l'API vérifie les droits et les limites (MED-010 : `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_FILE_TYPE`), enregistre un dépôt annoncé par fichier (`Upload`, `01-domaine/05`, § 5.10), puis rend, pour chacun, son identifiant et une adresse d'envoi signée, valable 15 minutes ;
2. le navigateur ou l'application envoie le fichier **directement au stockage**, sous la clé `uploads/{uploadId}` (MED-016) ;
3. `POST …/uploads/{id}/complete` → l'API relit le fichier au stockage, contrôle son type réel (MED-011), sa taille et son empreinte, puis rattache le fichier : sa ligne (`DocumentFile`, `MessageAttachment`, `Media`…) est créée avec sa clé **définitive** (MED-016), dans une transaction, et les traitements sont lancés — **sauf pour une pièce** : la confirmation marque seulement le dépôt `COMPLETED`, et c'est la création de la version (API-081) qui crée les lignes `DocumentFile` et lance les traitements. Le premier travail de la file (`documents` ou `media`, ARC-050) copie le fichier de `uploads/{uploadId}` vers sa clé définitive et efface l'original ; le contrôle antivirus et les déclinaisons suivent. D'ici là, le fichier n'est pas lisible (`PENDING`).

| À la confirmation | Réponse |
|---|---|
| Fichier absent du stockage, adresse encore valable | `409 CONFLICT_STATE`, raison `UPLOAD_NOT_RECEIVED` |
| Fichier absent du stockage, `expiresAt` passé | `410 GONE` : il faut annoncer un nouveau dépôt |
| Dépôt déjà confirmé | La même réponse que la première fois (`resultFileId`), sans rien refaire |
| Type réel non permis | `415 UNSUPPORTED_FILE_TYPE` ; dépôt `REJECTED` |
| Taille ou empreinte différente de l'annonce | `422 VALIDATION_ERROR`, `details` : `field` = `file`, `code` = `CHECKSUM_MISMATCH` (TRV-064) ; dépôt `REJECTED` |
| Fichier vide, ou contenu illisible | `422 VALIDATION_ERROR`, `details` : `field` = `file`, `code` = `FILE_UNREADABLE` (TRV-064) ; dépôt `REJECTED` |
| PDF chiffré ou protégé par un mot de passe (MED-011) | `422 VALIDATION_ERROR`, `details` : `field` = `file`, `code` = `FILE_PASSWORD_PROTECTED` (TRV-064) ; dépôt `REJECTED` |
| Dépôt annoncé par un autre compte | `404 NOT_FOUND` |

Un dépôt commencé et jamais terminé est effacé après 24 heures (AUT-091) — pour une pièce, de même un dépôt confirmé que personne n'a rattaché à une version (API-081). **Réalisation** (D-097) : tant que le stockage objet n'est pas branché, le deuxième temps est un `PUT` vers l'API elle-même (`PUT /client/uploads/{id}/content?e=&s=` pour une pièce, `PUT /partner/application/uploads/{id}` pour une candidature) : adresse signée de 15 minutes, corps brut de la taille annoncée exactement. À la confirmation d'une pièce, une image est aussi décodée : illisible, elle est refusée tout de suite (`FILE_UNREADABLE`), sans attendre la réunion en PDF ; le type constaté remplace le type annoncé (`Upload.declaredMimeType`). **Lecture** d'un fichier privé : une route de l'API vérifie les droits puis rend une adresse signée de 5 minutes (MED-030).

**API-081** `[P1]` **Version d'une pièce.** Un dépôt de pièce se fait en deux gestes : chaque fichier est annoncé, envoyé et confirmé seul (API-080) — la confirmation contrôle le fichier et marque son `Upload` `COMPLETED`, sans toucher à la pièce — ; puis le clic « Envoyer {n} fichiers » (DOS-012) crée la version : `POST /client/dossiers/{référence}/documents/{id}/versions`, clé d'idempotence exigée (API-040). Chaque appel compte pour un dépôt dans la limite de SEC-070. Corps :

| Champ | Contenu |
|---|---|
| `mode` | `ADD` (les fichiers en cours et les nouveaux) · `REMOVE` (les fichiers en cours, moins un ou plusieurs) · `REPLACE_ALL` (les nouveaux seulement) : les trois gestes de DOS-014. |
| `keptFileIds` | Fichiers gardés de la version en cours (`currentVersion`), dans l'ordre voulu : tous pour `ADD` ; au moins un, et pas tous, pour `REMOVE` ; vide pour `REPLACE_ALL`. |
| `uploadIds` | Dépôts confirmés, dans l'ordre choisi par le client : au moins un pour `ADD` et `REPLACE_ALL` ; vide pour `REMOVE`. |
| `isRenewal` | Vrai pour le renouvellement d'une pièce validée (CYC-141, bouton « Renouveler ») ; seul `REPLACE_ALL` est alors permis. |

**Contrôles**, dans cet ordre (le premier refus est renvoyé) :
1. la pièce est une pièce de ce dossier que le client fournit (`providedBy` = `CLIENT`, hors `isInternal`), sinon `404 NOT_FOUND` ; dossier clôturé ou gagné (DOS-016) : `409 CONFLICT_STATE`, raison `TRANSITION_NOT_ALLOWED` ; pièce d'une personne dont le traitement est limité : raison `PARTY_RESTRICTED`, ou sans accord confirmé pour elle (`Consent` `PARTY_AUTHORIZATION`) : raison `PARTY_CONSENT_MISSING` (DOS-032) ;
2. une version de la pièce est encore `SCANNING` : `409 CONFLICT_STATE`, raison `DOCUMENT_SCANNING` — les versions d'une pièce naissent une à la fois ;
3. état de la pièce : `PENDING`, `RECEIVED`, `REJECTED` ou `EXPIRED` → dépôt ordinaire (un `isRenewal` vrai y est sans effet) ; `VALIDATED`, dans la fenêtre de renouvellement de CYC-141, avec `isRenewal` vrai → renouvellement (autre `mode` que `REPLACE_ALL` : `422 VALIDATION_ERROR`, `field` = `mode`, `code` = `INVALID_CHOICE`) ; tout autre cas — `WAIVED`, ou `VALIDATED` hors de ce cas — : `409 CONFLICT_STATE`, raison `DOCUMENT_LOCKED` ;
4. listes conformes au `mode` ; un fichier qui n'est pas de la version en cours, ou cité deux fois : `422 VALIDATION_ERROR`, `field` = `keptFileIds`, `code` = `INVALID_CHOICE` ; un dépôt qui n'est pas un `Upload` de ce compte pour cette pièce (`ownerType` = `DOCUMENT`, `ownerId` = la pièce), ou déjà rattaché (`resultFileId` renseigné) : `404 NOT_FOUND` ; un dépôt encore `PENDING` : `409 CONFLICT_STATE`, raison `UPLOAD_NOT_RECEIVED` ;
5. limites de DOS-011 sur la version entière : plus de 30 images parmi les dépôts : raison `TOO_MANY_IMAGES` ; plus de `maxFiles` fichiers, les images comptant pour un seul (MED-032) : raison `TOO_MANY_FILES`, `params` `{"n": maxFiles}` — `409 CONFLICT_STATE`.

La route d'annonce (`POST …/documents/{id}/uploads`) applique déjà les contrôles 1 à 3 : aucun fichier n'est envoyé vers une pièce où il ne pourra pas entrer.

**Effets**, dans une transaction (FIA-051) : une `DocumentVersion` au numéro suivant, issue `SCANNING`, `uploadedById` = le client, `uploadedVia` = `WEB` (`MOBILE` depuis l'application) ; une ligne `DocumentFile` par fichier, `sortOrder` = 1, 2, 3… dans l'ordre de `keptFileIds` puis de `uploadIds`, chacune avec sa clé définitive (MED-016), `scanStatus` = `PENDING`, et le nom, le type constaté, la taille et l'empreinte relevés à la confirmation — ou ceux du fichier gardé ; pour chaque dépôt, `Upload.resultFileId` est renseigné. Le premier travail de la file `documents` copie chaque objet vers sa clé définitive : depuis `uploads/{uploadId}` pour un dépôt (l'original est effacé), depuis la clé du fichier d'origine pour un fichier gardé. Chaque version a ainsi ses propres objets : supprimer ou purger l'une ne touche pas l'autre. Puis tous les fichiers de la version — gardés compris — passent le contrôle antivirus, les images saines sont réunies (MED-032), et CYC-140 s'applique : la version en cours et le statut de la pièce ne changent qu'à cette issue (pour un renouvellement : `renewalVersion`). Journal : `document.uploaded`. Réponse `201` : la pièce à jour, sous la forme de `GET …/documents`, avec la nouvelle version.

**Équipe.** Le back-office crée une version par la même route, sous `/admin/dossiers/{id}/documents/{documentId}/versions` (`document.upload`) : même corps, mêmes effets, `uploadedVia` = `ADMIN` ; ce que l'équipe peut déposer, et sur quelle pièce : GED-055.

## 8. Travaux longs

**API-085** `[P1]` Exports, imports, paquets de soumission, archive « Tout télécharger » des pièces d'un dossier (GED-085), effacement de données : la route de lancement répond `202` avec l'identifiant du travail ; `GET …/jobs/{id}` en donne l'état (`PENDING`, `RUNNING`, `DONE`, `FAILED`), l'avancement et, à la fin, le lien du résultat. Une notification prévient à la fin.

## 9. Évolution

**API-090** `[P1]` La version figure dans l'adresse (`/v1`). Ajouter un champ ou une route n'est pas une rupture. Retirer ou renommer un champ, changer un type, rendre obligatoire un champ facultatif : c'est une rupture, donc une nouvelle version, l'ancienne restant servie tant que des applications mobiles l'utilisent (MOB-040).

## 10. Retours du fournisseur d'e-mail

**API-095** `[P1]` `POST /hooks/mail` : l'authenticité de l'appel est vérifiée (signature du fournisseur, ou à défaut le secret partagé `MAIL_WEBHOOK_SECRET`) ; un retour déjà traité est ignoré (son identifiant est gardé dans `MailWebhookEvent`, `01-domaine/05`, § 1.2) ; le statut est reporté sur la ligne `Communication` retrouvée par `providerMessageId` : `delivered` → `DELIVERED`, rejet définitif → `BOUNCED`, plainte → `COMPLAINED`, et, si le suivi est activé, `OPENED`, `CLICKED`. Un état ne **recule** jamais : `QUEUED` < `SENT` < `DELIVERED` < `OPENED` < `CLICKED` ; `BOUNCED` et `FAILED` ne remplacent que `QUEUED` ou `SENT` ; `COMPLAINED` remplace tout état sauf `BOUNCED` et `FAILED` ; un retour qui ferait reculer l'état (un « remis » après un « ouvert ») ne change pas l'état ; il est pourtant écrit, avec sa date, dans `stateHistory` et dans le champ de date qui lui correspond (`deliveredAt`, `bouncedAt`, `complainedAt`…). Les événements `email.bounced` et `email.complained` sont émis dès que leur retour arrive, même quand l'état de la ligne ne change pas (AUT-071).

La réalisation `MailProvider` du fournisseur (Q-030) traduit ses noms de retours dans ces familles :

| Retour du fournisseur | État |
|---|---|
| Remis | `DELIVERED` |
| Rejet définitif (adresse ou domaine inexistant, envoi bloqué) | `BOUNCED` |
| Rejet temporaire, envoi différé | aucun : le fournisseur réessaie de lui-même |
| Plainte (signalé comme indésirable) | `COMPLAINED` |
| Ouverture · clic | `OPENED` · `CLICKED`, seulement si le suivi est activé (NOT-015) |
| Tout autre retour | ignoré, mais mémorisé |

## 11. Carte des ressources

**API-100** `[P1]` Les ressources par famille de routes. « Actions » = routes d'action (API-051).

### Public (`/public`)

| Ressource | Routes | Specs |
|---|---|---|
| Accueil | `GET /home` : blocs, biens mis en avant, prochains Cafés, état des replis | `02-site-public/02` |
| Biens | `GET /properties` (critères CAT-020, `facets=1` pour les compteurs) · `GET /properties/{slug}` (accepte aussi la référence du bien, SIM-030 ; `preview={jeton}` : FIC-120) · `GET /properties/{slug}/similar` · `GET /properties/suggestions` (mêmes critères que `GET /properties` ; trois biens au plus : les premiers du premier relâchement qui donne des résultats, dans l'ordre de CAT-061 ; le mot `suggestions` est réservé et n'est jamais un slug ; le bloc « Biens à votre portée » de SIM-012 lit, lui, `GET /properties`) · `POST /properties/{référence}/view` (signal de vue, sans corps : FIC-100) · `GET /properties/compare?refs=` (comparateur, trois références au plus ; les références inconnues ou archivées sont rendues dans `missing` : CAT-092) · `GET /properties/cards?refs=` (les favoris gardés dans le navigateur, relus en cartes, vingt références au plus : SFA-021) · `GET /search/suggest?q=` (suggestions de la recherche par mot : `{groups: [{kind: REFERENCE | REGION | CITY | PROGRAM | PROMOTER, items: [{label, slug, count}]}]}`, TRV-109 ; 2 caractères au moins, sinon `422 VALIDATION_ERROR`) | `03`, `04` |
| Assistant | `GET /assistant/status` (`{mode}` : `GUIDED` ou `AI`, le mode que reçoit le visiteur maintenant — `AI` seulement si le paramètre le demande, que le fournisseur est configuré et que le plafond du mois n'est pas atteint ; jamais mis en cache) · `POST /assistant/messages` (assistant conversationnel, réponse en flux `text/event-stream` ; les erreurs d'avant le flux — `404` si l'assistant est coupé, `422`, `429` — sont des réponses ordinaires : ASS-052) · `GET /assistant/questions` (choix de chaque question du mode guidé, d'après les réponses précédentes : ASS-010) · `GET /assistant/results` (six cartes au plus, critères relâchés selon CAT-061 : ASS-020, ASS-021) | `09` |
| Plan du site | `GET /sitemap` : les objets publiés de chaque famille de NAV-034, avec leur date de modification (cache public de 5 minutes) | `01` |
| Porte d'accès | `POST /gate` (mot de passe → cookie `dp_gate`, NAV-064) | `01` |
| Santé | `GET /health` : `200` et `{"status": "ok", "version": "0.2.0"}` si la base répond, `503` sinon ; la sonde externe le lit (ENV-070) · `GET /health/ready` : vérifie en plus Redis et le stockage ; le déploiement le lit (ENV-051). Sans session ; hors porte d'accès, hors maintenance, hors limites de débit ; jamais mis en cache ni écrit au journal d'audit. Chemins complets : `/api/v1/public/health` et `/api/v1/public/health/ready`. Un processus `worker` (`APP_ROLE`, ENV-040) ne sert que ces deux routes | ENV-051 |
| Programmes | `GET /programs/{slug}` (`preview={jeton}` : FIC-120) | `04` |
| Promoteurs, banques, partenaires | `GET /promoters` · `GET /promoters/{slug}` · `GET /partners` (les `Partner` publics seulement, par catégorie puis `sortOrder`, EDI-035) · `GET /banks` (banques `ACTIVE` et publiques, par `sortOrder` : nom et logo, EDI-020, EDI-035) | `08` |
| Référentiels | `GET /regions` (avec compteurs) · `GET /countries` · `GET /search-options` : options de la barre de recherche (régions avec compteurs, couples type et pièces présents, paliers de budget) et `estimatedBudget`, toujours `null` : cette réponse est mise en cache pour tous, le budget estimé d'un visiteur se lit donc à part (D-097) · `GET /simulations/estimated-budget` (`{amount, currency, simulationId, matchingCount}` ou `null`, d'après la dernière simulation d'éligibilité de moins de 90 jours du client de la session, sinon du `dp_anon` ; `matchingCount` compte les biens listables dont `priceFromRef` ne dépasse pas ce budget, compte tenu des autres critères passés en paramètres ; jamais mis en cache : CAT-035) | `03` |
| Demandes | `POST /leads` (peut répondre `403 CHALLENGE_REQUIRED`, DEM-030 ; réponse : DEM-027) · `POST /leads/complete` (`[P1]` second écran d'une projection, avec le jeton de complétion et sans identifiant : DEM-013, DEM-027) · `POST /form-token` (DEM-030) | `05` |
| Signalement | `POST /listing-reports` | `05` |
| Simulateurs | `GET /simulations/options` (bornes, devises et produits proposés aux simulateurs) · `GET /simulations/property/{référence}` (le bien en rappel, SIM-030) · `POST /simulations/quick` (calcul express de EP-10, EDI-023 : corps `{downPayment, monthlyPayment}` dans la devise de référence ; réponse `{budget, financing, financingComputed, durationMonths, annualRateBps, currency}` — `budget` et `financing` arrondis pour l'affichage, `financingComputed` le financement calculé, à l'euro, qui préremplit EP-12 ; rien n'est enregistré, pas de clé d'idempotence, limite de débit de SEC-070) · `POST /simulations/eligibility` (calcule **et** enregistre, SIM-015 ; rend l'`id`) · `POST /simulations/credit` (calcule sans enregistrer) · `POST /simulations` (enregistre une simulation de crédit, scénarios compris ; `isSaved` : `true` pour « Enregistrer », `false` pour « Recevoir par e-mail » et « Être rappelé » ; anonyme sous `dp_anon`, ou au client de la session ; `Idempotency-Key` exigée, API-040 ; répond `201` avec l'`id`) · `POST /simulations/{id}/save` (« Enregistrer » une simulation déjà écrite : `isSaved = true`) · `POST /simulations/{id}/email` (corps `{email}`) — ces deux routes n'acceptent qu'une simulation du même `dp_anon` ou du client de la session · `POST /simulations/pdf` (entrées dans le corps, rien d'enregistré). Enchaînement : SIM-032 | `06` |
| Cafés `[P1]` | `GET /events` · `GET /events/{slug}` · `POST /events/{slug}/registrations` (refus d'une inscription indésirable : `409 CONFLICT_STATE`, raison `REGISTRATION_REFUSED`, CAF-026) · `GET`, `PATCH`, `DELETE /registrations/{jeton}` · `GET /registrations/{jeton}/ics` (fichier d'agenda, CAF-050) · `POST /event-notify-requests` | `07` |
| Contenus | `GET /pages/{slug}` (`preview={jeton}` : FIC-120) · `GET /faq` (questions servies selon EDI-040) · `GET /legal/{type}` · `GET /settings/public` (les clés de PAR-101) · `GET /content-blocks?group={groupe}` (blocs d'une page ou d'une zone, groupes de CMS-020 — jamais le groupe « Back-office » ; EDI-001) · `GET /testimonials` (publiés, par `sortOrder`, six au plus, EDI-071) · `GET /checklist/public` (libellés des pièces obligatoires du modèle `CLIENT_FILE` par défaut, groupés par catégorie, EDI-021) | `08` |
| Alertes `[P1]` | `POST /alerts` (`409 CONFLICT_STATE`, raison `ALERT_LIMIT`, au-delà de dix alertes actives : CAT-072) · `GET`, `PATCH`, `DELETE /alerts/{jeton}` · `POST /alerts/{jeton}/confirm` · `…/extend` · `POST /alerts/links` (« Recevoir un nouveau lien », corps `{email}`, même réponse pour toute adresse : SFA-035) | `03` |
| Enquêtes | `GET /surveys/{jeton}` · `POST /surveys/{jeton}/answers` | `03-espace-client/07` |
| Préférences | `GET`, `PATCH /preferences/{jeton}` · `POST /preferences/links` (« Recevoir un nouveau lien », corps `{email}`, même réponse pour toute adresse : PRO-031) · `POST /unsubscribe/{jeton}` (désinscription à un clic) · `GET /unsubscribe/{jeton}` (adresse ouverte par un logiciel de messagerie : `303` vers la page qui fait la même chose) | NOT-022 |
| Médias | `GET /media/{id}` : les déclinaisons d'une image des blocs de contenu (un bloc image garde `{mediaId, alt}`, CMS-020) ; médias de contenu publics et prêts seulement, sinon `404` | `04-back-office/12` |
| Partage | `POST /shares/{jeton}/unlock` (corps `{code}` ; bon code : cookie de session de partage) · `GET /shares/{jeton}` · `GET /shares/{jeton}/summary` · `POST /shares/{jeton}/download` (BNK-112) — pour le dossier envoyé à une banque (BNK-112) et pour l'export remis à une personne sans espace (ADM-063). `[P2]` `[P3]` `POST /shares/{jeton}/answers` : la réponse d'un partenaire à une demande envoyée par lien, pour l'un des gestes que le lien autorise (ACP-041) ; `POST /shares/{jeton}/renew` : recevoir un nouveau lien, à la même adresse | BNK-112, ACP-042 |

### Compte (`/auth`)

`POST /signup` · `POST /login` · `POST /login/two-factor` · `GET /step` (l'étape en cours d'un jeton d'étape, AUTH-026) · `POST /logout` · `POST /refresh` · `POST /verify-email` · `POST /verify-email/resend` · `PATCH /signup/email` (adresse d'un compte encore vide, AUTH-012) · `POST /activate/check` (état d'un lien d'activation, sans le consommer) · `POST /activate` · `POST /activate/resend` (AUTH-040) · `POST /magic-link` · `POST /magic-link/consume` · `POST /password/forgot` · `POST /password/reset/check` (état d'un lien, sans le consommer, AUTH-045) · `POST /password/reset` · `GET /legal` (les textes à accepter, AUTH-090) · `POST /legal/accept` · `POST /action-code` (code de confirmation d'une action sensible, pour l'action qu'il nomme ; il se vérifie avec elle ; `409 CONFLICT_STATE`, raison `HAS_PASSWORD`, pour un compte qui a un mot de passe : AUTH-086) · `POST /email-change/confirm` (lien de confirmation d'une nouvelle adresse, AUTH-080) · `POST /verify-email/disown` (« Ce n'est pas moi », AUTH-013) · `POST /legal/decline` (jeton d'étape `TERMS` : le détruit, répond `204`, AUTH-090) · `POST /preview/exchange` (code d'aperçu → session d'aperçu, ROL-017) — `03-espace-client/01`. Les mêmes routes servent le back-office, avec l'audience `ADMIN` ; s'y ajoutent `POST /confirm-password` (confirmation renforcée, BO-005) et celles de la première connexion : `POST /staff-setup/start` (lien d'invitation → jeton d'étape), `GET /staff-setup` (étapes restantes), `POST /staff-setup/password`, `…/two-factor`, `…/charter` (BO-003). Les routes ouvertes par un jeton d'étape sont celles de AUTH-026, et elles seules.

Partenaires `[P1]` (ACP-080 à ACP-087) : `POST /auth/partner-signup` (étapes 1 et 2 d'ACP-081, sans fichier ; même réponse dans tous les cas, TRV-112). Les routes `/auth` servent aussi l'audience `PARTNER` : connexion, mot de passe oublié, vérification de l'adresse (AUTH-013, retour sur `/partenaires/connexion`). Famille `/partner` (session `PARTNER`) : `GET /application` (état, rubriques et récapitulatif, EP-33) · `GET /regions` (les régions actives des pays du catalogue, pour « Régions où vous construisez », ACP-087) · `PATCH /application/sections/{activity|documents|image}` (une rubrique, « Enregistré. ») · `POST /application/uploads`, `PUT /application/uploads/{id}` (envoi du fichier à l'API, à la place du stockage objet tant qu'il n'est pas branché : adresse signée de 15 minutes, API-080), `POST /application/uploads/{id}/complete` (un justificatif ou le logo, API-080, MED-011) · `DELETE /application/files/{id}` · `POST /application/submit` (`409 CONFLICT_STATE`, raison `APPLICATION_INCOMPLETE`, si une rubrique obligatoire manque) · `POST /application/additions` (complément : message et fichiers, ACP-083).

### Client (`/client`)

| Ressource | Routes |
|---|---|
| Espace | `GET /space` : ce dont le cadre de chaque page a besoin — prénom, nom, adresse, fuseau, compteur de la cloche, adresse en erreur, dossiers du menu (avec la présence d'une liste de pièces), dossier montré, pastille des biens proposés (ECL-001, ECL-002) |
| Moi | `GET /me` (compte et session ; rend aussi `unreadNotifications` et `hasDossier`, que lit l'en-tête du site, NAV-013) · `GET /me/profile` (la fiche telle que le profil l'affiche, par rubrique, PRO-001) · `PATCH /me` (une rubrique à la fois, version lue exigée, PRO-002) · `…/me/email` · `…/me/password` · `…/me/two-factor` : `POST …/setup` (preuve AUTH-086 ; rend la clé et le QR code), `POST …/confirm` (un code de l'application → dix codes de secours), `POST …/enable` (case « J'ai conservé mes codes de secours » → activée), `DELETE` (preuve et code de l'application), `POST …/recovery-codes` (preuve ; nouveaux codes, les anciens meurent) — PRO-020 · `GET`, `DELETE /me/sessions` (toutes les autres) · `DELETE /me/sessions/{id}` (une session, autre que celle en cours, PRO-021) · `POST /me/email/confirm-valid` (« Mon adresse est correcte » : vide `Client.emailBouncedAt`, AUT-071) · `GET`, `PATCH /me/preferences` · `GET /me/consents` · `POST /me/consents` · `POST /me/export` · `POST /me/delete` |
| Tableau de bord | `GET /dashboard` |
| Dossiers | `GET /dossiers` · `GET /dossiers/{référence}` · `…/timeline` (lignes `ClientTimelineEntry`, ECL-031) · `…/property` · `…/parties` (lecture, ajout, modification, retrait : DOS-031) · `POST /dossiers/{référence}/consent` (accord de transmission donné depuis « Mes pièces », DOS-040) · `POST /dossiers/{référence}/parties/{partyId}/authorization` (« Je confirme avoir l'accord de {prénom} », DOS-032) — ces deux accords se donnent depuis le dossier ; `POST /me/consents` garde les autres consentements (D-097) |
| Pièces | `GET /dossiers/{référence}/documents` · `GET …/documents/{id}` (une pièce seule, relue pendant le contrôle de sécurité) · `POST …/documents/{id}/uploads` (corps `{files: […], isRenewal}`) · `PUT /uploads/{id}/content?e=&s=` (envoi du fichier à l'API, à la place du stockage objet tant qu'il n'est pas branché : adresse signée de 15 minutes, taille exacte, API-080) · `…/uploads/{uploadId}/complete` · `POST …/documents/{id}/versions` (crée la version à partir des dépôts confirmés, API-081) · `GET …/documents/{id}/files/{fileId}?disposition=` (`{url, expiresAt}` : adresse signée de lecture, MED-030) |
| Financement | `GET /dossiers/{référence}/submissions` · `POST …/submissions/{id}/accept-request` · `DELETE …/submissions/{id}/accept-request` (« Je ne suis plus sûr ») |
| Biens | `GET /interests` · `GET /proposals` · actions sur un bien envisagé (`/candidates/{id}`) : `…/view` (livrée avec l'espace, INT-011), `…/interested` (`{comment}`), `…/decline` (`{reason, note, cancelVisit}` ; une visite prévue sans `cancelVisit` : `409 CONFLICT_STATE`, raison `VISIT_TO_CANCEL` avec la date de la visite), `…/select-request` (`{lotId, comment, replace}` ; un autre choix en attente sans `replace` : raison `SELECTION_PENDING` avec le titre du bien en attente), `…/cancel-select` · `GET /candidates/{id}/lots` (lots libres du bien, pour « Je retiens ce bien », INT-030) |
| Demandes | `GET /leads` · `POST /leads` (dont « Écrire à mon conseiller », MSG-021 : demande `CONTACT_MESSAGE` rattachée au dossier et affectée à son conseiller) · `GET /advisor-contact` (à qui écrit « Écrire à mon conseiller ») |
| Rendez-vous | `GET /appointments` (`{upcoming, past}`, EC-14) · `…/cancel` (INT-042, `{reason}`) · `GET /appointments/{id}/calendar` (`.ics` d'un rendez-vous confirmé) · `[P1]` `POST /appointments` (demande, INT-040), `PATCH` |
| Messages | `GET /conversations` · `POST /conversations` (`{dossierId}`, ou `null` pour le fil général ; rend le fil existant s'il y en a un, MSG-001) · `GET`, `POST /conversations/{id}/messages` · `…/read` · `DELETE …/messages/{id}` · pièces jointes : `POST /conversations/{id}/uploads` · `…/complete` (API-080) · `GET …/messages/{id}/attachments/{attachmentId}` |
| Notifications | `GET /notifications` · `POST /notifications/read` (`{ids}`, ou `{entityType, entityId}` : NOT-032) · `…/read-all` |
| Simulations | `GET /simulations` (la création passe par les routes publiques, avec la session : SIM-032) · `GET /simulations/prefill` (préremplissage de l'éligibilité, SIM-033) · `GET`, `PATCH`, `DELETE /simulations/{id}` · `GET …/pdf` · `POST /simulations/{id}/profile` (« Mettre à jour mon profil avec ces informations », SIM-033). Au-delà de trente simulations enregistrées : `409 CONFLICT_STATE`, raison `SIMULATIONS_LIMIT` (SFA-012) |
| Favoris, alertes `[P1]` | `GET /favorites` · `PUT`, `DELETE /favorites/{propertyId ou référence}` (`409 CONFLICT_STATE`, raison `FAVORITES_LIMIT`, au-delà de cent : SFA-023) · `POST /favorites/merge` (favoris du navigateur rapatriés à la connexion, SFA-021) · `GET`, `POST`, `PATCH`, `DELETE /alerts` (raisons `ALERT_LIMIT`, `SEARCH_LIMIT` : CAT-072, CAT-093) |
| Cafés `[P1]` | `GET /registrations` · `PATCH`, `DELETE /registrations/{id}` |
| Proches | `GET`, `POST`, `PATCH`, `DELETE /contacts` |
| Avis | `GET`, `POST /feedback` · `GET /surveys/pending` · `GET /surveys/{invitationId}` · `POST /surveys/{invitationId}/answers` (répondre depuis l'espace, sans jeton : PRO-072) |
| Droits | `GET`, `POST /data-requests` |
| Flux | `GET /stream` |

### Back-office (`/admin`)

Chaque ressource a ses routes de lecture (`GET` liste et détail), d'écriture (`POST`, `PATCH`, `DELETE`) et d'action, protégées par les permissions de `00-cadre/02`.

| Ressource | Actions principales | Permission |
|---|---|---|
| `leads` | création (`lead.create`) · `take`, `release`, `close`, `reopen`, `spam`, `restore`, `review` (`lead.process`) · `attach`, `open-dossier` (`dossier.create`) · `approve-partner`, `request-partner-info`, `decline-partner` (`lead.process` **et** `promoter.write` ou `bank.write`, ACP-084) · `GET /admin/leads/{id}/partner-application` (le panneau de la candidature) et `…/partner-application/files/{fileId}` (adresse signée d'un justificatif) (`lead.read`) · `assign` (`lead.assign`) | `lead.*` |
| `clients` | `merge` (`client.merge`) · `archive`, `unarchive` (`client.archive`) · `assign` (`client.assign`) · `invite` (`client.invite`) · `suspend`, `reactivate`, `revoke-sessions`, `disable-two-factor`, `change-email` (`client.account.manage`) · `preview-code` (`client.impersonate`, ROL-017) · `not-duplicate`, `confirm-phone`, `confirm-email` (`client.update`) · `restrict`, `lift-restriction` (`gdpr.manage` ; les mêmes gestes existent sur la ligne d'un co-emprunteur ou d'un garant, ADM-063) | `client.*`, `gdpr.manage` |
| `communications` | noter, corriger, supprimer un appel, un échange, une rencontre | `communication.log` |
| `notes` | lire · écrire, modifier, épingler, supprimer la sienne · supprimer celle d'un collègue (`note.moderate`) | `note.read`, `note.manage`, `note.moderate` |
| `dossiers` | `qualify`, `build-file`, `to-acquisition`, `accept-conditions`, `win`, `hold`, `resume`, `close`, `reopen`, `move-back` (`dossier.transition.backward`), `assign` (`dossier.assign`), `set-financing-mode` · `export` (`dossier.export`) · commission et honoraires (`dossier.commission.manage`) · `GET /admin/dossiers/{référence ou id}` (fiche EA-22) · `…/history` (étapes et journal, SEC-080), `…/effects` (ce que pause, clôture ou suppression emportent, CYC-031, CYC-035), `…/qualification` (conditions et champs de la fiche, CRM-050) (`dossier.read`) · sélecteurs de PIP-015 : `GET /admin/dossiers/pickers/clients`, `…/pickers/properties` (`dossier.create`), `…/pickers/agents` (`dossier.read`) · `DELETE` (`{reason}` obligatoire, MOD-312 ; `dossier.delete`) | `dossier.*` |
| `pipeline` | `GET /admin/pipeline` : filtres de PIP-004 ; `stage` et `page` pour « Afficher plus » dans une colonne (PIP-003) ; réponse : pour chaque étape, `total`, `overdue` et les cartes, avec les champs agrégés de PIP-002 | `dossier.read` |
| `dossiers/{id}/parties` | création, modification, `remove` (MOD-320, MOD-321, PIP-055) | `dossier.update` |
| `dossiers/{id}/candidates` | lecture `GET …/candidates` et `…/candidates/{cid}/lots` (`dossier.read`) · `GET …/candidates/search` (biens à proposer, PIP-031) · `propose` (corps `{propertyIds, message, send}` : `send: false` met en préparation, `send: true` envoie aussi les biens en préparation — l'envoi n'a pas de route à part), `set-status`, `PATCH …/candidates/{cid}` (note du conseiller), `DELETE …/candidates/{cid}` (un bien en préparation seulement), `select` et `confirm-selection` (corps : `lotId` facultatif, CYC-071), `unselect` (CYC-242), `decline-selection` | `candidate.manage` |
| `reservations` | création — option, ou réservation directe (CYC-106) — et modification après coup : acompte, contrat, prix convenu (`reservation.manage`) · `extend` (au-delà de `reservation.maxExtensions` : `reservation.override`), `acknowledge-option`, `refuse-option` (CYC-107), `confirm`, `cancel`, `settle-deposit` | `reservation.manage`, `reservation.override` |
| `dossiers/{id}/documents` | `validate` (une pièce, ou une liste : GED-043), `reject`, `revert` (`document.validate`) · `waive`, `unwaive` (`document.waive`) · ajout d'une pièce, `PATCH` d'une pièce, `DELETE` d'une pièce `AD_HOC` sans fichier (CYC-148), `remind`, `request-again`, `set-due-date`, `pause-reminders` et `resume-reminders` (d'une pièce, ou de tout le dossier : `Dossier.remindersPaused`), `reevaluate`, `apply-template` (MOD-342, GED-031) (`document.request`) · `GET …/document-reminders` (`document.read`, GED-060) · dépôt, `file-from-messages` (classer des pièces jointes, GED-050) (`document.upload` ; `…/versions`, API-081) · `delete-version` (`document.delete`) · `bulk-download` (`document.file.read`) | `document.*` |
| `documents` | `GET /admin/documents` (recherche de pièces, EA-64, filtres de GED-090) · `GET /admin/documents/review-queue` (pièces à vérifier, EA-60, GED-040) | `document.read` |
| `dossiers/{id}/consents` | `proof` (crée la pièce interne de preuve), `record` (accord ou retrait : GED-070, GED-071) | `consent.record` |
| `checklist-templates` | `preview` (GED-014) · suppression logique (GED-013) | `checklist.manage` |
| `submissions` | création, modification (case « Inclure », destinataire, montant, durée, produit, « Décision attendue le ») · `package`, `acknowledge`, `request-info`, `accept`, `unaccept`, `decline`, `withdraw`, `follow-up`, `note` (`submission.manage`) · `submit`, `provide-info`, `download-package`, `share`, `revoke-share`, `resend-code` (`submission.share` : ce qui fait sortir des pièces vers la banque, ou en gère la sortie ; BNK-110) · `approve`, `reject`, `correct-decision`, `revert-decision`, `extend-offer` (`submission.decide`) | `submission.*` |
| `simulations`, `projections` | `send` · `attach` (corps `{dossierId}` : un dossier du même client) et `detach` (CRM-046) | `simulation.*` |
| `programs`, `properties`, `lots`, `media` | écriture (`catalogue.write`) · `publish`, `unpublish`, `archive`, `unarchive`, `feature`, `correct-sale` (`catalogue.publish`) · `duplicate`, `preview` · `retry` d'un média en échec (`catalogue.write`, CTL-082) · `eligibility` (`catalogue.eligibility.manage`) · suppression (`catalogue.delete`) · lectures des écrans EA-40 à EA-46 (`catalogue.read`) : `GET /admin/programs`, `GET /admin/properties` (vues, facettes et tris de CTL-020 et CTL-040), `…/{id}`, `…/{id}/dossiers`, `…/{id}/lots`, `…/{id}/eligibility`, `…/{id}/pois`, `GET /admin/lots/{id}/price-history`, `GET /admin/featured` (CTL-150), `GET /admin/programs/{id}/updates`, `GET /admin/media?ownerType=&ownerId=`, `GET /admin/media/library` (EA-44) · `PUT …/{id}/eligibility/{bankId}` (`catalogue.eligibility.manage`, CTL-130) · `POST /admin/lots/{id}/duplicate`, `POST /admin/lots/bulk-price` (aperçu, puis application, CTL-061), `POST /admin/lots/mark-delivered`, `PUT …/{id}/pois` (CTL-140), `POST /admin/programs/{id}/updates`, `PATCH` et `DELETE /admin/program-updates/{id}` (chantier, CTL-145) (`catalogue.write`) · médias (API-080) : `POST /admin/media/uploads`, `PUT …/uploads/{id}/content`, `POST …/uploads/{id}/complete`, `POST /admin/media/videos`, `POST /admin/media/reorder`, `POST /admin/media/bulk`, `PATCH` et `DELETE /admin/media/{id}`, `POST …/{id}/retry` — routes déclarées `catalogue.read` : un média appartient à un programme, un bien, un promoteur, une banque, un partenaire ou une actualité de chantier, et le service exige la permission d'écriture de son propriétaire (`catalogue.write`, `promoter.write`, `bank.write` ou `content.manage`) | `catalogue.*` |
| `imports` | `dry-run`, `confirm` · `GET /admin/imports` (historique), `GET /admin/imports/{id}`, `…/{id}/issues.csv`, `GET /admin/imports/template.xlsx` et `…/template.csv` · `POST /admin/imports/uploads`, `PUT …/uploads/{id}/content`, `POST /admin/imports` (l'import naît du fichier déposé, CTL-100) | `catalogue.import` |
| `promoters`, `banks`, `bank-products` | `activate`, `suspend`, `end` · `republish` (`catalogue.publish`) · convention et conditions commerciales (`partner.convention.manage`) · `expectations` : ce qu'on attend du partenaire (ACP-015) · `confirm-stock` sur un programme ou un bien isolé (`catalogue.write`, CTL-064), `confirm-rates` sur un produit (`bankproduct.write`) (AUT-079) · promoteurs (EA-50, EA-51) : `GET …/{id}/impact` (ce que `suspend` ou `end` dépublieraient, MOD-110), `…/relation` (CTL-005), `…/expectations` (`promoter.read`) · `PUT …/{id}/vetting` (CTL-003), `resume`, contacts (`POST …/contacts`, `PATCH` et `DELETE …/contacts/{contactId}`), documents (`POST …/document-uploads`, `PUT …/document-uploads/{uploadId}/content`, `POST …/document-uploads/{uploadId}/complete`, `PATCH` et `DELETE …/documents/{documentId}`) (`promoter.write`) · `GET …/documents/{documentId}/file` (adresse signée, `promoter.read`) · `DELETE /admin/promoters/{id}` (`promoter.delete`, sans contenu dépendant, Q-089) · `[P2]` `[P3]` `set-access-level`, liens de réponse, `partner-answers` : `apply`, `dismiss` (`partner.access.manage` pour le niveau et les liens ; la permission du geste pour appliquer une réponse, ACP-031) | `promoter.*`, `bank.*`, `bankproduct.write` |
| `partners` (autres partenaires, CTL-170) | `move` (échange de place avec le voisin, Q-091) · suppression logique (Q-089) | `content.manage` |
| `exchange-rates` | création, `void` | `settings.manage` |
| `reference-financing`, `indicative-scale` | — | `settings.manage` |
| `conversations`, `messages` | `read` · création d'un fil (`{clientId, dossierId}`, rend le fil existant), dépôt d'une pièce jointe, suppression de son propre message (`message.send`) · lecture d'une pièce jointe (`document.file.read`) | `message.*` |
| `emails` | lire le journal des envois (`communication.read`) · `send`, `resend`, `cancel` ; `bulk` (création, liste et détail des envois groupés, `cancel` d'un envoi programmé) | `communication.read`, `email.send`, `email.bulk` |
| `email-templates` | `test`, `restore`, `activate`, `duplicate` ; `DELETE` d'un modèle `M_` (COM-053) | `template.manage` |
| `workflow-rules` | `simulate`, `reset` ; `DELETE` d'une règle créée dans le back-office (COM-061) | `workflow.manage` |
| `workflow-executions` | liste (COM-063) ; `cancel` d'une exécution en attente | `workflow.manage` |
| `tasks` | lecture (`task.read`, vues et filtres de TAC-001, TAC-002) · création, `PATCH` (version lue) · `complete` (`{note}`), `cancel` (`{reason}`), `reopen`, `take`, `postpone` (`{to}` : `TOMORROW`, `IN_3_DAYS`, `NEXT_WEEK` ou une date), `assign` (`{assigneeId}` ou `null` pour l'équipe), `bulk` (`{action, ids, assigneeId}`, ligne par ligne, rend `{done, refused}`) (`task.manage`) | `task.*` |
| `appointments` | lecture (`appointment.read`, vues de TAC-046) · `GET /admin/agenda?from=&to=&staff=` (rendez-vous, tâches datées, Cafés animés ; plusieurs `staff` pour la superposition d'un administrateur, TAC-035 ; `appointment.read`) · création, `PATCH` (lieu, lien, accueil sur place, notes : TAC-045), `confirm`, `reschedule`, `cancel` (`{reason, clientWord, notifyClient}`), `done`, `no-show`, `correct-outcome` · `GET /admin/appointments/pickers/clients` (le client, ses dossiers vivants et leurs biens envisagés, ses proches), `GET /admin/appointments/warnings` (TAC-043, jamais bloquant) (`appointment.manage`) | `appointment.*` |
| `events`, `registrations` `[P1]` | `publish`, `close`, `cancel`, `promote`, `check-in`, `undo-check-in` | `event.*`, `registration.*` |
| `feedback`, `surveys`, `survey-invitations` | `feedback` : `review`, `handle`, `dismiss`, `reopen`, `categorize`, `propose-testimonial` (`feedback.manage` ; FBK-003, FBK-004) · `surveys` : lecture, création, modification, `send` (`survey.manage`) · `survey-invitations` : lecture, `cancel` (`survey.manage`, FBK-041) | `feedback.*`, `survey.manage` |
| `content-blocks`, `pages`, `faq`, `testimonials`, `legal-documents`, `redirects`, `seo` | `publish` · `content-blocks` : `history`, `restore` (une valeur de l'historique), `restore-origin` (CMS-003) · `pages` : `regenerate-slug`, `preview` (CMS-030) · `seo` : lecture de la vue d'ensemble, `regenerate-sitemap` (CMS-081) — tout cela sous `content.manage` ; les textes légaux sous `settings.sensitive.manage` | `content.manage`, `settings.sensitive.manage` |
| `reports/*` | `export` | `report.*` |
| `settings`, `referentials/*`, `holidays` | `preview` (annonce d'un changement à effet large avant de l'enregistrer, ADM-012 ; `settings.manage`) ; `maintenance` (`maintenance.manage`) · `launch-checklist` : lecture (`settings.read`), `confirm`, `unconfirm` (`settings.sensitive.manage`, ADM-015) | `settings.*`, `maintenance.manage` |
| `users` | `invite`, `resend-invitation`, `cancel-invitation`, `change-role`, `suspend`, `reactivate`, `delete`, `change-email` (`user.manage`) · `reassign` (réaffectation en nombre, ADM-033 : la permission de chaque objet transféré, vérifiée objet par objet) · `reset-two-factor` (`user.twofactor.reset`) · `elevate`, `end-elevation` (`support.elevate`) | `user.*`, `support.elevate` |
| `audit-logs` | lecture (`audit.read`) · `export` (`audit.export`) | `audit.*` |
| `data-requests` | création (demande reçue par e-mail ou par courrier, ADM-060) · `person-search` (ADM-061) · `verify`, `export-person`, `resend-code`, `revoke-share` (lien d'export), `erase-person`, `complete`, `reject` | `gdpr.manage` |
| `trash` | `restore`, `purge` (travail de fond, ADM-070) | `trash.manage` |
| `exports` | lecture de la liste et `download` : ses propres exports seulement (ADM-085) ; la liste des imports est celle de `imports` (`catalogue.import`) | compte connecté |
| `diagnostics` | `retry-job`, `run-job`, `retry-event` ; `confirm-retention` (`settings.sensitive.manage` : la Direction, PAR-006) ; en recette seulement : `shift-clock` (ENV-032) | `support.diagnostics`, `settings.sensitive.manage` |
| `clients/{id}/timeline`, `leads/{id}/timeline`, `dossiers/{id}/timeline` | chronologie (BO-050) : pagination par curseur (API-010) ; `type` filtre par type d'entrée (plusieurs valeurs) | la lecture de l'objet ; chaque entrée filtrée selon BO-050 |
| `search` | recherche globale (BO-030) : `GET /search?q=&types=` — cinq résultats au plus par type, `more` quand la liste en contient d'autres ; chaque type n'est interrogé que si le rôle a sa permission de lecture | selon l'objet |
| `saved-views` | `GET /saved-views?listKey=` (ses vues et les vues partagées d'une liste, avec sa vue par défaut) · création, renommage et mise à jour, suppression (son propriétaire ; un administrateur pour une vue partagée) · `share` (`view.share`) · `PUT /saved-views/default` (`{listKey, viewKey}` : `origin:{clé}` pour une vue d'origine, l'identifiant d'une vue enregistrée, ou `null`) — BO-040 | compte connecté |
| `notes` | `GET /notes?entityType=&entityId=` (`note.read`) · création, modification de sa note, `pin` (`note.manage`) · suppression de sa note (`note.manage`) ou de celle d'un collègue (`note.moderate`) — BO-055 ; l'objet de la note doit être visible de l'appelant (ROL-018), sinon `404` | `note.*` |
| `me` | `GET`, `PATCH /me` (profil, signature, `absentUntil` : CRM-021) · `PATCH /me/password` · `POST /me/two-factor/reconfigure` (mot de passe et code actuel ; rend la nouvelle clé et le QR code), `…/confirm`, `…/enable`, `POST /me/two-factor/recovery-codes` (mot de passe) · `GET`, `DELETE /me/sessions`, `DELETE /me/sessions/{id}` (BO-070) · `GET`, `PATCH /me/preferences` (groupes du personnel, NOT-020 ; paquet 5.1) · `GET /me/shell` (ce que le cadre affiche autour de chaque page : rôle effectif, permissions, compteurs du menu, bandeaux de BO-014, durée d'inactivité) · `GET /me/profile` (BO-070, Profil et état de la sécurité) | compte connecté |
| `notifications`, `stream` | `GET /notifications` (`page`, `pageSize` : 10 pour le panneau, 25 ou 50 ; `unread=1`) · `POST /notifications/read` (`{ids}`, ou `{entityType, entityId}` : NOT-032) · `POST /notifications/read-all` | compte connecté |

Les actions nommées ci-dessus portent leur permission ; les autres routes suivent API-101. Aucune route ne se contente d'un nom de rôle.

**API-101** `[P1]` **Permission d'une route.** Une route du back-office exige **une** permission, déterminée ainsi :

| Route | Permission |
|---|---|
| `GET` liste et détail d'une ressource | `{ressource}.read` : `lead.read`, `client.read`, `dossier.read`, `submission.read`, `document.read` (les métadonnées des pièces ; le fichier lui-même : `document.file.read`), `catalogue.read` (programmes, biens, lots, médias, imports), `promoter.read`, `bank.read` (banques et produits), `task.read`, `appointment.read`, `message.read` (conversations et messages), `event.read`, `feedback.read` (retours), `survey.manage` (enquêtes et invitations), `report.read`, `settings.read` (paramètres et référentiels), `user.read` (équipe), `audit.read`, `simulation.read` (simulations et projections) |
| `POST` de création | la permission de création nommée : `lead.create`, `client.create`, `dossier.create`, `reservation.manage`, `submission.manage`, `simulation.create` (simulation ou projection faite pour un client), `task.manage`, `appointment.manage`, `catalogue.write`, `promoter.write`, `bank.write`, `bankproduct.write`, `checklist.manage`, `template.manage`, `workflow.manage`, `content.manage`, `user.manage`, `settings.manage` (cours de change, référentiels, jours fériés), `survey.manage` (enquête), `gdpr.manage` (demande d'exercice de droits saisie) |
| `PATCH` | la permission de mise à jour de la ressource : `lead.process`, `client.update`, `dossier.update`, `reservation.manage`, `submission.manage`, `task.manage` (`task.manage.all` pour la tâche d'un collègue), `appointment.manage`, `catalogue.write`, `promoter.write`, `bank.write`, `bankproduct.write`, `checklist.manage`, `template.manage`, `workflow.manage`, `content.manage`, `user.manage`, `survey.manage`, `settings.manage` (`settings.sensitive.manage` pour un paramètre sensible, PAR-002) |
| `DELETE` | `dossier.delete`, `catalogue.delete`, `promoter.delete`, `bank.delete`, `bankproduct.write` (un produit jamais employé, BNK-023), `document.delete` (une version), `document.request` (une pièce `AD_HOC` sans fichier, CYC-148), `checklist.manage` (un modèle de liste : suppression logique, GED-013), `note.manage` (sa note) ou `note.moderate`, `user.manage`, `template.manage` (un modèle `M_`), `workflow.manage` (une règle créée dans le back-office) , `content.manage` (question fréquente, témoignage, redirection saisie, image des contenus inutilisée), `settings.manage` (jour férié, entrée de référentiel jamais utilisée, PAR-090), `settings.sensitive.manage` (version d'un texte légal jamais publiée, CMS-061) ; les autres ressources ne se suppriment pas par l'API. Une suppression logique met l'objet à la corbeille (TRV-096) ; l'en sortir ou l'y purger demande `trash.manage` |
| Actions d'un dossier | `dossier.transition` : `qualify`, `build-file`, `to-acquisition`, `accept-conditions`, `win`, `hold`, `resume`, `set-financing-mode` · `dossier.transition.backward` : `move-back` · `dossier.close` : `close` · `dossier.reopen` : `reopen` · `dossier.assign` : `assign` · `dossier.export` : `export` |
| Actions des autres ressources | `client.export` : `export` d'une fiche ou d'une liste de clients · `task.manage` : `complete`, `cancel`, `reopen`, `take` · `appointment.manage` : `confirm`, `reschedule`, `cancel`, `done`, `no-show`, `correct-outcome` · `message.send` : `POST …/messages` · `event.manage` : `publish`, `close`, `cancel` · `registration.manage` : `promote`, `check-in`, `undo-check-in` · `registration.export` : export des inscriptions · `feedback.manage` : `review`, `handle`, `dismiss`, `reopen`, `categorize`, `propose-testimonial` · `survey.manage` : `send`, `cancel` · `report.export` : `export` d'un rapport · `simulation.create` : `attach`, `detach` (CRM-046) |
| Champs sensibles | `client.sensitive.read` ne garde aucune route : elle décide, dans **toute** réponse, de la présence des champs sensibles (SEC-033). Sans elle, ils sont omis et nommés dans `withheld` (API-002), jamais masqués par des étoiles. |

Une route qui ne trouve pas sa permission dans ce tableau ni dans API-100 n'existe pas : on l'ajoute ici avant de la coder. Le test de la matrice des permissions (paquet 1.6) parcourt les deux tableaux et vérifie que chaque permission de `00-cadre/02`, § 4, garde au moins une route. Le test ne porte que sur les routes livrées. Une permission dont toutes les routes sont `[P1]`, `[P2]` ou `[P3]`, ou appartiennent à un paquet pas encore livré, figure dans une table d'exceptions du test avec son étiquette ou son paquet ; `client.sensitive.read`, qui décide des champs et non d'une route, y figure aussi. À la livraison 5, cette table ne contient plus aucune permission dont une route est `[P1]`.
