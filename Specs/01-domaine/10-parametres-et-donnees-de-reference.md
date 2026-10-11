# Paramètres et données de référence

Tout ce que l'administrateur peut vouloir changer sans développement est ici : les **paramètres** (`Setting`), les **référentiels** (pays, régions, jours fériés, listes du catalogue) et les **données de départ** installées au premier déploiement.

Les valeurs marquées **« exemple indicatif »** sont des valeurs de démarrage, à remplacer par celles de Diaspora Patrimoine avant la mise en ligne (§ 10).

---

## 1. Paramètres

**PAR-001** `[P1]` Un paramètre est une ligne `Setting` (`key`, `value`). Chaque clé est **déclarée dans le code** avec : son type, ses bornes, sa valeur par défaut, son libellé, sa description, et son niveau (`courant` ou `sensible`). Un paramètre absent de la table prend sa valeur par défaut. Une clé inconnue est refusée. **Types de déclaration** (liste fermée) : `boolean` · `integer{min,max}` · `decimal{min,max}` · `string{max}` (200 caractères par défaut) · `enum{énumération}` (une énumération de `01-domaine/01`, § 3) · `email` · `phone` · `url` (`https://` seulement) · `timezone` · `currency` · `time` (`HH:mm`) · `datetime` · `locale[]` · `country[]` · `integer[]` (croissants quand la ligne le dit) · `object{schéma}` et `object{schéma}[]`. Une **clé à motif** (`finance.reference.{pays}`, `finance.acquisitionFeesPct.{pays}`) est déclarée une fois avec son motif ; sa partie variable doit être le code d'un `Country` existant, sinon la clé est inconnue. Les clés `sla.stage.*` sont déclarées une à une (§ 3).

**PAR-002** `[P1]` Modifier un paramètre **courant** demande la permission `settings.manage` ; un paramètre **sensible** (marqué 🔐), `settings.sensitive.manage`. Toute modification est validée par le schéma de la clé, écrite dans le journal d'audit (ancienne et nouvelle valeur) et émet `setting.changed`.

**PAR-003** `[P1]` Un changement prend effet **tout de suite** pour les lectures suivantes (le cache des paramètres est invalidé dans la même opération). Il n'est **pas rétroactif** : une échéance déjà calculée, un e-mail déjà planifié, une simulation enregistrée gardent leurs valeurs. Exceptions, qui déclenchent un recalcul des prix et des mensualités affichés : `finance.reference.*`, `finance.exchangeRateKind` et `display.referenceCurrency` (AUT-080).

**PAR-004** `[P1]` **Ne sont pas des paramètres** : les secrets (clés d'API, mots de passe de base, clé de chiffrement), les adresses des services et l'adresse de redirection des e-mails hors production. Ils vivent dans la configuration de l'environnement (`06-technique/07`).

**PAR-005** `[P1]` L'écran des paramètres (ADM-010) les présente par groupes, avec leur description, leur valeur par défaut et la date de leur dernière modification. Un bouton « Rétablir la valeur par défaut » existe pour chacun.

**PAR-101** `[P1]` **Paramètres publics.** `GET /public/settings/public` rend ces clés, et aucune autre : `contact.*` · `seo.siteName`, `seo.defaultDescription`, `seo.allowIndexing` · `legal.*` (§ 1.9) · `display.referenceCurrency`, `display.roomsPrefix`, `display.frequentCountries` · `catalogue.monthlyBudgetSteps`, `catalogue.priceBudgetSteps`, `catalogue.newBadgeDays` · `features.*` · `analytics.enabled` · `maintenance.enabled`, `maintenance.until` · `i18n.activeLocales` · `business.calendar.*` et `sla.firstContactBusinessDays` (créneaux de DEM-008, `{quand}` de NOT-053) · `events.brandName`, `events.fullBrandName`, `events.showSeatsBelow`, `events.maxSeatsPerRegistration` · `partner.applicationReviewDays` (délai annoncé par la confirmation de « Devenir partenaire » et de l'inscription partenaire, DEM-019, ACP-083 ; D-097). S'y ajoute `holidays` : les jours fériés (table `Holiday`) des 60 prochains jours, pour les jours proposés par DEM-008. Une clé ajoutée plus tard n'est publique que si cette liste la nomme : les paramètres d'accès, de sécurité et de conservation, l'adresse d'expédition et le seuil d'indésirabilité (`leads.spamThreshold`) ne le sont jamais. Réponse mise en cache une minute au plus, invalidée à `setting.changed`.

**PAR-102** `[P1]` **Constantes du code.** Ces garde-fous ne sont pas des paramètres : ils sont fixés dans le code, non réglables, et cités par leur règle. Publication d'une décision bancaire : 10 minutes après sa saisie (CYC-165). Annulation d'une décision : avant sa publication, soit 10 minutes après sa saisie (CYC-165), puis dans les 7 jours qui suivent sa publication (CYC-169). Prolongation d'une offre expirée : moins de 30 jours après son expiration (CYC-169). Rappel d'une offre : 5 jours avant `offerValidUntil` (CYC-167). Rappel d'une option : 2 jours avant son échéance (CYC-105). Écarts d'un nouveau cours de change : 10 % (confirmation) et 30 % (ressaisie) (BNK-061). Écart entre la mensualité saisie d'une offre et le calcul : 1 % (CAL-045). Lien de partage : 5 codes faux avant verrou, session de 30 minutes (BNK-112). **Ajoutés par le premier code** (D-097) — assistant conversationnel : 4 appels du modèle par tour, 15 secondes pour la première sortie, 45 secondes par tour, 500 caractères par message, 12 messages du visiteur par conversation, conversation gardée 30 jours (ASS-053, IA-013) ; alertes : 10 alertes non confirmées par adresse (CAT-072), lien de prolongation valable 30 jours après la fin, rétablissement d'une alerte arrêtée pendant 10 minutes, suppression des alertes arrêtées ou jamais confirmées après 30 jours (SFA-035) ; Café : pas de promotion automatique dans les 12 heures avant le début (CYC-185) ; notification « fichier refusé » : e-mail deux minutes après, si elle est encore non lue (AUT-013).

### 1.1 Accès et organisation

| Clé | Type | Défaut | Effet |
|---|---|---|---|
| `access.agentScope` 🔐 | `ALL` · `ASSIGNED_ONLY` | `ALL` | Ce que voit un conseiller (ROL-014). |
| `access.agentCanEditCatalogue` 🔐 | booléen | `false` | Un conseiller peut modifier le catalogue, sans publier. |
| `leads.assignmentMode` | `MANUAL` · `ROUND_ROBIN` | `MANUAL` | Affectation des nouvelles demandes (CRM-020). |
| `leads.spamThreshold` | entier 0–100 | `70` | Score à partir duquel une demande est mise à l'écart (DEM-031). |
| `dossier.maxCoBorrowers` | entier 0–3 | `1` | MOD-320. |
| `dossier.maxGuarantors` | entier 0–3 | `1` | MOD-320. |
| `dossier.inactivityDays` | entier 7–180 | `30` | CYC-039. |
| `clients.inactiveAfterDays` | entier 30–730 | `180` | CYC-060. |
| `acquisition.requireReservation` | booléen | `true` | CYC-026. |
| `reservation.optionDays` | entier 1–60 | `7` | Durée d'une option (Q-018). |
| `reservation.maxExtensions` | entier 0–10 | `2` | Prolongations d'une option. |
| `partner.linkValidityDays` | entier 1–60 | `14` | `[P2]` `[P3]` Validité d'un lien de réponse envoyé à un partenaire (ACP-041). |
| `partner.applicationReviewDays` | entier 1–30 | `5` | `[P1]` Jours ouvrés annoncés pour l'examen d'une candidature de partenaire (ACP-083, `P_PARTNER_APPLICATION_ACK`). |
| `partner.reminderBusinessDays` | entier 0–30 | `2` | `[P2]` `[P3]` Jours ouvrés avant la relance d'une demande par lien restée sans réponse (ACP-045). 0 : pas de relance. |

### 1.2 Calendrier et délais

Voir § 3.

### 1.3 Financement

| Clé | Type | Défaut | Effet |
|---|---|---|---|
| `finance.reference.default` | objet | voir § 4 | Financement de référence (CAL-030). |
| `finance.reference.{pays}` | objet, même forme que `finance.reference.default` (PAR-041) | absent | Financement de référence propre à un pays ; facultatif : sans lui, `finance.reference.default` s'applique (CAL-030). |
| `finance.exchangeRateKind` | `OFFICIAL` · `INDICATIVE` | `OFFICIAL` | Nature du cours utilisé (Q-007). |
| `finance.exchangeRateMaxAgeDays` | entier 1–90 | `7` | Âge au-delà duquel un cours est signalé (AUT-072). |
| `finance.indicative` | objet | voir PAR-044 | Barème indicatif des simulateurs quand aucun produit réel ne s'applique (CAL-103). |
| `finance.acquisitionFeesPct.{pays}` | décimal 0–30 | `0` | Frais d'acquisition estimés, en pourcentage du prix (CAL-106, Q-045). À 0 : les frais ne sont pas comptés et la mention `legal.feesExcludedNote` s'affiche. |
| `finance.showApr` | booléen | `false` | Afficher un taux annuel effectif indicatif (CAL-046). |
| `finance.productCheckDays` | entier 0–365 | `90` | Rythme de vérification du barème d'un produit avec sa banque (AUT-079). 0 : jamais. |
| `submission.shareValidityDays` | entier 1–30 | `7` | Validité d'un lien de partage. Un lien n'est jamais valable au-delà de la purge de son archive (BNK-113). |
| `submission.shareMaxDownloads` | entier 1–20 | `5` | Téléchargements permis par lien. |
| `submission.packageRetentionDays` | entier 7–180 | `30` | Conservation des archives. |
| `submission.defaultReviewDays` | entier 1–120 | `15` | Délai d'étude quand la banque n'en a pas (AUT-041). |
| `submission.followUpEveryDays` | entier 1–30 | `7` | Rythme des relances de banque. |

### 1.4 Pièces

| Clé | Type | Défaut | Effet |
|---|---|---|---|
| `documents.defaultDueDays` | entier 1–60 | `10` | Échéance d'une pièce demandée. |
| `documents.reminderDays` | liste d'entiers croissants, 0 à 5 valeurs | `[3, 7, 14]` | Relances (AUT-042). Liste vide : aucune relance. |
| `documents.reminderMinGapDays` | entier 1–14 | `2` | Écart minimal entre deux relances d'un dossier. |
| `documents.escalateAfterDays` | entier 1–30 | `5` | Délai avant la tâche d'appel. |
| `documents.expiryWarningDays` | entier 1–60 | `15` | Avertissement avant expiration. |
| `documents.maxFileSizeMb` | entier 1–50 | `15` | Taille maximale d'un fichier de pièce (MED-010). |

### 1.5 Catalogue et affichage

| Clé | Type | Défaut | Effet |
|---|---|---|---|
| `display.referenceCurrency` 🔐 | devise | `EUR` | Devise d'affichage des prix (Q-029). |
| `display.roomsPrefix` | `T` · `F` | `T` | D-040. |
| `display.frequentCountries` | liste de pays | `FR, BE, CH, CA, DE, GB, ES, IT, US, AE, DZ` | TRV-044. |
| `catalogue.publishMinScore` | entier 0–100 | `60` | Seuil de publication (CAL-050). |
| `catalogue.completeScore` | entier 0–100 | `85` | Seuil « fiche complète ». |
| `catalogue.soldVisibleDays` | entier 0–365 | `30` | CYC-123. |
| `catalogue.newBadgeDays` | entier 0–90 | `14` | Durée de l'étiquette « Nouveau » (CAT-041). |
| `catalogue.stockCheckDays` | entier 0–180 | `30` | Rythme de vérification des disponibilités d'un programme avec son promoteur (AUT-079). 0 : jamais. |
| `catalogue.partnerPriceTolerancePct` | entier 0–100 | `20` | `[P2]` Dans le portail seulement : écart de prix, en pourcentage, jusqu'auquel un prix changé par le promoteur lui-même s'applique sans relecture (ACP-050, PPR-012). |
| `catalogue.lowStockThreshold` | entier 0–50 | `10` | À partir de combien de lots la carte affiche « Plus que {n} lots » (CAT-041). |
| `catalogue.monthlyBudgetSteps` | liste d'entiers croissants | `[300, 400, 500, 650, 800, 1000, 1500, 2000, 3000]` | Paliers du champ « Budget mensuel », dans la devise de référence (ACC-052). |
| `catalogue.priceBudgetSteps` | liste d'entiers croissants | `[50000, 75000, 100000, 150000, 200000, 300000, 500000]` | Paliers du champ « Budget » (prix total). |
| `catalogue.amenities`, `catalogue.features` | `object{schéma}[]` : `[{code, labelFr, icon, sortOrder, isActive}]` ; `code` unique dans la liste ; `code` et `labelFr` obligatoires | voir § 6 | Équipements et caractéristiques. Ce sont des référentiels tenus chacun dans une ligne `Setting`, sans table : ils se modifient par leur écran de ADM-020, qui applique PAR-060 et PAR-090 — un code qu'un bien utilise ne se retire pas, ce que l'application vérifie, faute de clé étrangère. |
| `favorites.priceDropPct` | décimal 1–50 | `3` | AUT-062. |
| `alerts.lifetimeDays` | entier 30–730 | `180` | AUT-061. |

### 1.6 Le Café

| Clé | Type | Défaut | Effet |
|---|---|---|---|
| `events.brandName` | texte | « Le Café » | Nom court (Q-035) : menu, titres de section, boutons, fil d'Ariane. |
| `events.fullBrandName` | texte | « Le Café Diaspora Patrimoine » | Nom complet : titre de la page `/le-cafe` et balise de titre (CAF-001), objet et première phrase des e-mails du Café (variable `{{cafe.brandName}}`, NOT-050), données structurées d'un Café, invitation d'agenda. |
| `events.defaultCapacity` | entier 1–500 | `30` | Capacité proposée à la création. |
| `events.maxSeatsPerRegistration` | entier 1–10 | `4` | Places par inscription. |
| `events.closeHoursBefore` | entier 0–168 | `24` | Clôture des inscriptions avant le début. |
| `events.showSeatsBelow` | entier 0–500 | `20` | Seuil d'affichage « Il reste {n} places ». |

### 1.7 E-mails et enquêtes

| Clé | Type | Défaut | Effet |
|---|---|---|---|
| `mail.fromName` | texte | « Diaspora Patrimoine » | NOT-003. |
| `mail.fromAddress` 🔐 | e-mail | — (Q-023) | Adresse d'expédition. Son domaine doit être authentifié chez le fournisseur. Vide : la variable `MAIL_FROM_ADDRESS` de l'environnement sert d'expéditeur (NOT-003) — les e-mails partent donc dès la première livraison. |
| `mail.replyTo` | e-mail | — (Q-023) | Adresse de réponse. Vide : `MAIL_REPLY_TO`. |
| `mail.quietHours` | objet | `{"start":"20:00","end":"08:00"}` | AUT-006. |
| `mail.maxRemindersPerDay` | entier 1–10 | `2` | AUT-008. |
| `mail.bulkMaxRecipients` | entier 1–5000 | `500` | Destinataires d'un envoi groupé (COM-070). |
| `mail.trackOpens`, `mail.trackClicks` 🔐 | booléen | `false` | NOT-015 (Q-042). |
| `surveys.minGapDays` | entier 0–90 | `14` | AUT-065. |
| `surveys.reminderAfterDays` | entier 1–30 | `5` | AUT-066. |

### 1.8 Coordonnées et identité

Un élément dont le paramètre est vide **n'est pas affiché** (Q-023).

| Clé | Type | Défaut | Où il sert |
|---|---|---|---|
| `contact.companyName` | texte, obligatoire, non vide | « Diaspora Patrimoine » | Nom d'usage : signature et pied des e-mails (variable `{{company.name}}`, NOT-004), en-tête des PDF (TRV-142), données structurées `Organization` (NAV-035), ligne de droits du pied de page (NAV-020). |
| `contact.legalName`, `contact.registration`, `contact.address` | texte | — | Raison sociale, immatriculation, adresse postale : page des mentions légales (EDI-060), pied des e-mails (NOT-004), pied des PDF (TRV-142), page de contact pour l'adresse (EDI-050). |
| `contact.phone` | téléphone E.164 | vide (l'élément n'est pas affiché) | Pied de page, page de contact, e-mails (`{{company.phone}}`), écrans d'erreur (TRV-111), PDF. |
| `contact.whatsapp` | téléphone E.164 | vide (l'élément n'est pas affiché) | Lien WhatsApp du pied de page, de la page de contact et sous les formulaires (DEM-011). |
| `contact.email` | e-mail | vide (l'élément n'est pas affiché) | Pied de page, page de contact, e-mails (`{{company.email}}`), écrans d'erreur, PDF. |
| `contact.partnersEmail` | e-mail | vide | Adresse montrée aux partenaires (espace partenaire, ACP-083 ; e-mails `P_`) ; à défaut, `contact.email`. |
| `contact.openingHoursLabel` | texte | « Du lundi au vendredi, de 9 h à 18 h (heure de Paris) » | Page de contact (EDI-050), confirmation d'une demande de rappel. |
| `contact.social.facebook`, `.instagram`, `.linkedin`, `.youtube`, `.tiktok` | adresse `https://` | vide (l'icône n'est pas affichée) | Icônes du pied de page (NAV-020) et de la page de contact ; propriété `sameAs` des données structurées (NAV-035). |
| `seo.siteName` | texte | « Diaspora Patrimoine » | Suffixe de la balise de titre de chaque page (« {titre} – {nom du site} », NAV-032), `og:site_name` (NAV-036). |
| `seo.defaultDescription` | texte, 160 | « Achetez un bien immobilier neuf en Algérie depuis l'étranger : promoteurs sélectionnés, financement, accompagnement de A à Z. » | Description d'une page qui n'en a pas (NAV-032). |
| `seo.allowIndexing` 🔐 | booléen | `false` | NAV-030. |
| `analytics.enabled` 🔐 | booléen | `false` | Mesure d'audience (NAV-052). |

`seo.allowIndexing` reste faux jusqu'à la mise en ligne : tant qu'il est faux, toutes les pages portent `noindex` (NAV-030).

### 1.9 Textes légaux courts

| Clé | Défaut |
|---|---|
| `legal.monthlyFootnote` 🔐 | « *Exemple indicatif et non contractuel : mensualité hors assurance, selon la banque, la durée et le dossier. » |
| `legal.simulatorDisclaimer` 🔐 | « Les simulateurs fournissent une estimation indicative et ne constituent pas une offre de crédit, laquelle relève exclusivement de la banque. » |
| `legal.convertedPricesNote` 🔐 | « Prix convertis à titre indicatif. » |
| `legal.feesExcludedNote` 🔐 | « Hors frais d'acquisition (notaire, droits d'enregistrement), à prévoir en plus : votre conseiller vous les précise. » (CAL-106) |
| `legal.illustrationNote` | « Image d'illustration » — étiquette posée sur une image marquée `isIllustration` (FIC-012, CAT-040). |
| `legal.render3dNote` | « Image 3D non contractuelle » — étiquette posée sur une image de nature `RENDER_3D` (FIC-012). |

Ces textes sont la **seule source** de ces mentions : aucune clé de traduction ne les double.

Les textes longs (conditions générales, politique de confidentialité, mentions légales, politique de cookies) sont des `LegalDocument`, pas des paramètres.

### 1.10 Sécurité, conservation, langues, maintenance

| Clé | Type | Défaut | Effet |
|---|---|---|---|
| `security.password.minLength` 🔐 | entier 8–64 | `10` | SEC-010. |
| `security.login.maxAttempts` 🔐 | entier 3–20 | `5` | AUTH-032. |
| `security.login.lockMinutes` 🔐 | entier 1–1440 | `15` | AUTH-032. |
| `security.staff.twoFactorRequired` 🔐 | booléen | `true` | D-033. |
| `security.staff.idleMinutes` 🔐 | entier 5–480 | `60` | Inactivité avant déconnexion du back-office (SEC-023). |
| `retention.trashDays` 🔐 | entier 1–365 | `30` | AUT-091. |
| `retention.spamDays` 🔐 | entier 1–365 | `90` | |
| `retention.anonymousSimulationDays` 🔐 | entier 1–365 | `30` | |
| `retention.unverifiedAccountDays` 🔐 | entier 1–365 | `30` | |
| `retention.notificationDays` 🔐 | entier 30–730 | `180` | |
| `retention.outboxDays` 🔐 | entier 7–365 | `30` | |
| `retention.prospectYears` 🔐 | entier 1–10 | `3` | SEC-110 (Q-017). |
| `retention.dossierYears` 🔐 | entier 1–30 | `5` | SEC-110. |
| `retention.auditYears` 🔐 | entier 1–10 | `5` | SEC-110. |
| `retention.closedDossierFilesMonths`, `retention.oldVersionMonths` 🔐 | entiers 1–120 | `12`, `12` | Fichiers d'un dossier clôturé sans acquisition ; anciennes versions d'une pièce (SEC-110). |
| `retention.inactiveAccountYears` 🔐 | entier 1–10 | `3` | Compte client inactif, sans dossier en cours : années sans connexion (SEC-110). |
| `retention.partnerApplicationYears` 🔐 | entier 1–10 | `2` | Candidature de partenaire non suivie (SEC-110). |
| `retention.dataRequestYears` 🔐 | entier 1–10 | `5` | Demandes d'exercice de droits, après leur clôture (SEC-110). |
| `retention.maxPerRun` 🔐 | entier 50–10 000 | `500` | Nombre d'objets qu'un passage de la tâche `retention` peut effacer sans confirmation (PAR-006). Ne vaut pas pour la tâche `purge`. |
| `launch.confirmations` 🔐 | `object{schéma}` : `{point: {byId, at, reason}}`, `point` étant une valeur de `LaunchCheckPoint` | `{}` | Points de la carte « Avant la mise en ligne » confirmés en l'état (PAR-100). Absent de l'écran des paramètres : il ne s'écrit que par les actions `confirm` et `unconfirm` de la carte (ADM-015). |
| `i18n.activeLocales` 🔐 | liste de `Locale` | `["fr"]` | TRV-001. |
| `ai.assistant.monthlyBudget` 🔐 | montant en euros, 0–5 000 | `150` | Plafond mensuel des appels au modèle de l'assistant conversationnel (ASS-052, IA-005). Atteint : l'assistant repasse en mode guidé jusqu'au mois suivant et une alerte technique part (AUT-076 ; destinataire : Q-060). Les prix du fournisseur, en dollars, sont comptés un dollar pour un euro ; 0 coupe le mode conversationnel (MOD-431). |
| `maintenance.enabled` | booléen | `false` | Page de maintenance sur le site public et l'espace client ; le back-office reste ouvert. Permission propre : `maintenance.manage` (une intervention de nuit ne doit pas attendre la Direction). |
| `maintenance.until` | date-heure | vide (aucune heure annoncée) | Heure de retour annoncée (TRV-084). Même permission. |
| `clock.offsetDays` | entier 0–365 | `0` | Décalage de l'horloge de recette, en jours (ENV-032). Absent de l'écran des paramètres : il ne s'écrit que par la route `shift-clock` du diagnostic (`support.diagnostics`), refusée sans `CLOCK_OFFSET_ALLOWED`. |

**PAR-006** `[P1]` **Les durées de conservation ne se raccourcissent pas à la légère.** Aucune clé `retention.*` n'accepte 0. Abaisser l'une d'elles est un changement à effet large (ADM-012) : avant d'enregistrer, l'écran calcule et annonce ce que le prochain passage de la tâche qui applique la clé effacerait — cette nuit pour les clés de la tâche `purge` (AUT-091), dimanche pour celles de la tâche `retention` (SEC-110) : « 1 246 éléments seraient effacés dimanche : 214 fiches, 1 032 fichiers. » — et demande de recopier ce total pour confirmer. La tâche `retention` s'arrête et alerte le support si un passage devait effacer plus de `retention.maxPerRun` objets (défaut 500, 🔐) : elle n'efface alors rien et attend une confirmation de la Direction dans l'écran de diagnostic (`settings.sensitive.manage`, SEC-110). Une fois confirmé, le passage retenu repart aussitôt et recompte ; si le nouveau compte dépasse de plus de 10 % celui qui a été confirmé, il s'arrête de nouveau et attend une nouvelle confirmation.

### 1.11 Indicateurs de fonctionnalités

**PAR-010** `[P1]` Chaque fonction ajoutée depuis la signature (`00-cadre/01`, § 6) a un indicateur 🔐, **vrai par défaut** (D-089) : c'est un interrupteur d'administration, pas une attente d'arbitrage. Quand l'administrateur le passe à faux : ses écrans et ses routes répondent `404`, ses entrées de menu sont masquées, et les éléments de l'accueil qui en dépendent prennent leur **repli** (ACC-090). Un indicateur n'existe dans le back-office qu'une fois la fonction livrée ; avant, la fonction est absente, comme tout écran non livré.

**PAR-011** `[P1]` **Couper une fonction déjà utilisée.** Repasser un indicateur à faux est un changement à effet large (ADM-012) : l'écran annonce ce qui est en cours (« 3 Cafés publiés, 41 inscrits » · « 127 alertes actives ») avant de confirmer. Ensuite :
- les données restent, intactes ; rien n'est supprimé ;
- les envois automatiques de la fonction s'arrêtent : ses règles et ses tâches planifiées sont ignorées, avec la raison « Fonction désactivée » ;
- les liens déjà envoyés qui servent à **se désinscrire ou à annuler** (alerte, inscription à un Café, préférences) continuent de fonctionner — on ne retire à personne le moyen de dire non ;
- les autres liens de la fonction mènent à une page simple : « Cette page n'est pas disponible pour le moment. », avec un lien vers l'accueil, et non à une erreur brute ;
- dans l'espace client, les entrées de la fonction disparaissent du menu.

Réactiver l'indicateur rend tout, dans l'état où c'était ; les échéances passées entre-temps ne sont pas rattrapées (un rappel de Café dont la date est passée ne part pas).

| Clé | Élément | Écart |
|---|---|---|
| `features.cafe` | Le Café : pages publiques, inscriptions, module de gestion | E1 |
| `features.multiCountry` | Filtre « Pays », pages par pays — n'apparaît que lorsqu'au moins deux pays sont actifs | E2 |
| `features.islamicFinance` | Produits et contenus de financement islamique | E3 |
| `features.projectionRequest` | Formulaire « Recevez votre projection », outil de projection | E4 |
| `features.callbackRequest` | Formulaire « Être rappelé » | E4 |
| `features.assistant.mode` | `OFF` · `GUIDED` · `AI` (défaut `GUIDED` ; `AI`, l'assistant conversationnel, est construit en Phase 1 — D-090, ASS-050 à ASS-052 — et se choisit une fois le fournisseur configuré — par `pnpm ops setting:set` tant que l'écran des paramètres n'existe pas (ENV-041) ; sans lui, repli sur `GUIDED`) | E5 |
| `features.monthlyBudgetSearch` | Recherche par budget mensuel, mensualité sur les cartes | E6 |
| `features.tour360` | Visite 360° | E7 |
| `features.constructionProgress` | Avancement du chantier | E7 |
| `features.poi` | Points d'intérêt, temps de vol | E7 |
| `features.favorites` | Favoris | E8 |
| `features.searchAlerts` | Alertes de recherche | E8 |
| `features.clientAppointments` | Rendez-vous demandés par le client | E9 |
| `features.partnerForm` | Formulaire « Devenir partenaire » (EP-23) et inscription partenaire (EP-32, EP-33 ; un compte déjà créé se connecte toujours) | E10 |

---

## 2. Référentiel géographique

**PAR-020** `[P1]` **Pays.** La table `Country` est chargée avec tous les pays ISO 3166-1 (code, nom français, indicatif téléphonique, devise). `isResidenceOption` est vrai pour tous. `isCatalogueActive` est vrai pour **`DZ` seulement** (Q-011).

Algérie : devise `DZD`, indicatif `+213`, `regionLabelFr` = « Wilaya », `cityLabelFr` = « Commune ».

**PAR-021** `[P1]` **Régions de l'Algérie** : les 58 wilayas, avec leur code officiel.

| Code | Wilaya | Code | Wilaya | Code | Wilaya |
|---|---|---|---|---|---|
| 01 | Adrar | 21 | Skikda | 41 | Souk Ahras |
| 02 | Chlef | 22 | Sidi Bel Abbès | 42 | Tipaza |
| 03 | Laghouat | 23 | Annaba | 43 | Mila |
| 04 | Oum El Bouaghi | 24 | Guelma | 44 | Aïn Defla |
| 05 | Batna | 25 | Constantine | 45 | Naâma |
| 06 | Béjaïa | 26 | Médéa | 46 | Aïn Témouchent |
| 07 | Biskra | 27 | Mostaganem | 47 | Ghardaïa |
| 08 | Béchar | 28 | M'Sila | 48 | Relizane |
| 09 | Blida | 29 | Mascara | 49 | Timimoun |
| 10 | Bouira | 30 | Ouargla | 50 | Bordj Badji Mokhtar |
| 11 | Tamanrasset | 31 | Oran | 51 | Ouled Djellal |
| 12 | Tébessa | 32 | El Bayadh | 52 | Béni Abbès |
| 13 | Tlemcen | 33 | Illizi | 53 | In Salah |
| 14 | Tiaret | 34 | Bordj Bou Arréridj | 54 | In Guezzam |
| 15 | Tizi Ouzou | 35 | Boumerdès | 55 | Touggourt |
| 16 | Alger | 36 | El Tarf | 56 | Djanet |
| 17 | Djelfa | 37 | Tindouf | 57 | El M'Ghair |
| 18 | Jijel | 38 | Tissemsilt | 58 | El Meniaa |
| 19 | Sétif | 39 | El Oued | | |
| 20 | Saïda | 40 | Khenchela | | |

Le découpage administratif a pu évoluer depuis cette liste : il est **vérifié auprès de la source officielle** au moment de constituer le fichier de départ (Q-043). L'administrateur peut ajouter, renommer ou désactiver une région (ADM-020).

**PAR-022** `[P1]` **Communes.** Les communes d'Algérie sont chargées depuis un fichier de référence versionné dans le dépôt (`apps/api/prisma/seed/dz-communes.csv` : code de wilaya, nom français, nom arabe, latitude, longitude, chef-lieu de la wilaya — oui ou non), établi au paquet 1.8 à partir de la nomenclature officielle (Q-043). Tant que ce fichier n'est pas fourni, les données de départ créent pour chaque wilaya sa seule commune chef-lieu, sous le nom de la wilaya, sans nom arabe ni coordonnées ; l'administrateur ajoute les autres (PAR-090). Le fichier est donc **facultatif** : s'il manque, l'installation crée ces communes chefs-lieux et le signale dans son compte rendu ; rien d'autre n'en dépend (`Property.cityId` est facultatif), et le filtre « Quartier ou commune » ne propose que les communes saisies. Il peut être ajouté plus tard, sans autre changement : l'installation rejouée rapproche chaque ligne du fichier d'une commune existante par le code de wilaya et le nom français normalisé (comme un slug : minuscules, sans accent, mots séparés par des tirets, TRV-052) ; une commune trouvée est complétée (nom arabe, coordonnées), une commune absente est créée. La commune de repli d'une wilaya — celle dont le `slug` est celui de la wilaya — est rapprochée de la ligne que le fichier marque chef-lieu, quel que soit son nom : elle est mise à jour, nom compris, et jamais doublée. Une commune saisie à la main que le fichier ne nomme pas est gardée.

**PAR-023** `[P1]` **Ordre d'affichage des régions** dans les listes du site public : celles qui ont au moins un bien publié et disponible, par ordre alphabétique ; les autres ne sont pas proposées dans les filtres publics (CAT-021). Dans le back-office : toutes, par ordre alphabétique.

**PAR-024** `[P1]` **Temps de vol** (`TravelTime`) — exemple indicatif, à valider :

| Depuis | Vers | Durée | Direct |
|---|---|---|---|
| Paris | Alger (`ALG`) | 2 h 15 | oui |
| Marseille | Alger | 1 h 30 | oui |
| Lyon | Alger | 1 h 50 | oui |
| Paris | Oran (`ORN`) | 2 h 30 | oui |
| Marseille | Oran | 1 h 40 | oui |
| Paris | Constantine (`CZL`) | 2 h 20 | oui |

Le temps de vol affiché sur une fiche est celui de la ville de départ la plus proche du pays de résidence connu du visiteur ; sans information : Paris (FIC-065).

**PAR-025** `[P1]` **Devises.** Symboles : TRV-021. La liste des devises proposées pour les revenus et l'apport dans les simulateurs : `EUR`, `USD`, `CAD`, `GBP`, `CHF`, `AED`, `SAR`, `QAR`, `DZD` — celles que CAL-010 sait convertir vers la devise du pays actif, au besoin par la devise de référence. Une devise sans conversion possible n'est pas proposée ; l'écran des taux la signale « Manquant » (BNK-060).

---

## 3. Calendrier de travail et délais

**PAR-030** `[P1]` Paramètres du calendrier (Q-016) :

| Clé | Type | Défaut |
|---|---|---|
| `business.calendar.timezone` 🔐 | fuseau IANA | `Europe/Paris` |
| `business.calendar.workdays` | liste de jours (1 = lundi … 7 = dimanche) | `[1, 2, 3, 4, 5]` |
| `business.calendar.start` | heure | `09:00` |
| `business.calendar.end` | heure | `18:00` |

**PAR-031** `[P1]` **Jours fériés** de départ (table `Holiday`) — calendrier français :

| Récurrents | 1er janvier · 1er mai · 8 mai · 14 juillet · 15 août · 1er novembre · 11 novembre · 25 décembre |
|---|---|
| **2026** | lundi de Pâques 6 avril · Ascension 14 mai · lundi de Pentecôte 25 mai |
| **2027** | lundi de Pâques 29 mars · Ascension 6 mai · lundi de Pentecôte 17 mai |
| **2028** | lundi de Pâques 17 avril · Ascension 25 mai · lundi de Pentecôte 5 juin |

**PAR-032** `[P1]` Le 1er décembre, s'il n'existe aucun jour férié non récurrent pour l'année suivante, les administrateurs reçoivent la notification « Ajoutez les jours fériés mobiles de {année}. » (tâche `partner.scan`).

**PAR-033** `[P1]` **Délais** (Q-038), en jours ouvrés :

| Clé | Défaut | Sens |
|---|---|---|
| `sla.firstContactBusinessDays` | `2` | Premier contact après une demande (CAL-061). |
| `sla.messageReplyBusinessDays` | `1` | Délai de réponse **annoncé au client** dans la messagerie (MSG-004). La règle `R_MESSAGE_UNANSWERED` porte son propre délai : les deux se règlent ensemble. |
| `sla.stage.INTEREST` | `1` | Prise en charge. |
| `sla.stage.QUALIFICATION` | `5` | Qualification du projet. |
| `sla.stage.MATCHING` | `20` | Jusqu'au bien retenu. |
| `sla.stage.DOCUMENTS` | `30` | Constitution du dossier. |
| `sla.stage.BANK_REVIEW` | `45` | Étude par la banque. |
| `sla.stage.APPROVED` | `10` | Acceptation des conditions. |
| `sla.stage.ACQUISITION` | `90` | Jusqu'à l'acte. |

Bornes : 1 à 365. Ces délais servent au pilotage interne. Ils ne sont pas montrés au client, sauf le premier, dit en heures : « sous 48 h ouvrées » — soit `sla.firstContactBusinessDays` × 24 ; le texte suit le paramètre (NOT-053). La date de réponse attendue d'une banque (`expectedDecisionAt`), qui n'est pas l'un de ces délais, est montrée au client (DOS-051).

Les autres durées de la plateforme exprimées en **jours** sans autre précision — `documents.reminderDays`, `documents.defaultDueDays`, `Bank.reviewSlaDays`, `submission.followUpEveryDays`, `reservation.optionDays`, `dossier.inactivityDays` — sont des jours **calendaires**. Seuls les délais de ce tableau, ceux des tâches (« échéance n jours ouvrés ») et les délais d'une règle dont l'unité le dit (AUT-004) se comptent en temps ouvré.

---

## 4. Financement : données de départ

**PAR-040** `[P1]` **Produits d'exemple.** Un produit marqué `isExample` est **ignoré en production** par les simulateurs et par les soumissions, quel que soit son état. Hors production, il est utilisable et affiché avec la mention « Exemple ». Les données de départ créent une banque « Banque Exemple » (`PROSPECT` en production) et deux produits — **exemples indicatifs**, sans rapport avec un barème réel :

| | Exemple – Crédit immobilier | Exemple – Financement islamique |
|---|---|---|
| `financingType` | `CONVENTIONAL` | `ISLAMIC` (« Mourabaha ») |
| `pricingMethod` | `AMORTIZED_RATE` | `FLAT_MARGIN` |
| `propertyCountryCode`, `currency` | `DZ`, `DZD` | `DZ`, `DZD` |
| `nominalRateBps` | `650` | `450` |
| Montant | 1 000 000 à 50 000 000 | 1 000 000 à 40 000 000 |
| Durée | 60 à 300 mois | 60 à 240 mois |
| `maxDebtRatioPct` | `35` | `35` |
| `minDownPaymentPct` | `20` | `20` |
| `maxAgeAtEnd` | `70` | `70` |
| `isExample` | `true` | `true` |

**PAR-041** `[P1]` **Financement de référence** de départ (Q-006) :

```json
{ "downPaymentPct": 20, "durationMonths": 300, "annualRateBps": 650, "pricingMethod": "AMORTIZED_RATE" }
```

Ce sont les hypothèses des maquettes et du comparatif de l'accueil (ACC-040, `Design/donnees-de-reference.md`) : 6,50 %, 25 ans, apport 20 % — **exemple indicatif**, à confirmer par la cliente avant la mise en ligne (Q-006, D-096). Bornes : apport 0 à 90 % · durée 12 à 480 mois · taux 0 à 3 000 points de base. Le taux 0 reste permis ; si l'administrateur le choisit (`annualRateBps` à 0), le back-office affiche sur le tableau de bord : « Le financement de référence est à 0 % : les mensualités affichées sur le site sont sous-estimées. » Ce paramètre ne sert **qu'à** la mensualité indicative des cartes et des fiches (CAL-030) et, `[P1]`, au préremplissage du simulateur de crédit quand on vient d'une fiche qui affiche cette mensualité (SIM-030) ; aucune capacité d'emprunt n'en dépend (PAR-044).

**PAR-042** `[P1]` **Taux de change** de départ : `EUR` → `DZD`, nature `OFFICIAL`, `148.50`, source « exemple indicatif ». Un cours dont la source contient « exemple » déclenche sur le tableau de bord : « Le taux de change est une valeur d'exemple. Saisissez le taux réel. »

**PAR-043** `[P1]` Tant qu'aucun produit réel n'est utilisable **et ouvert aux simulateurs publics** pour un pays, les simulateurs emploient le barème indicatif (CAL-103, PAR-044) et l'affichent.

**PAR-044** `[P1]` **Barème indicatif** (`finance.indicative`) — ce qui sert à estimer une capacité d'emprunt quand aucun produit réel ne s'applique. Il est **distinct** du financement de référence (PAR-041), qui ne nourrit que la mensualité d'accroche des cartes. Valeur de départ, **exemple indicatif** à remplacer par un barème prudent convenu avec la cliente (Q-046) :

```json
{ "annualRateBps": 650, "minDurationMonths": 60, "maxDurationMonths": 300, "pricingMethod": "AMORTIZED_RATE",
  "maxDebtRatioPct": 35, "minDownPaymentPct": 20, "maxAgeAtEnd": 70, "minAmount": 10000 }
```

| Champ | Bornes | Sens |
|---|---|---|
| `annualRateBps` | **100** à 3 000 | Taux annuel. Jamais sous 1 % : à 0 %, toute capacité serait surestimée (CAL-103). |
| `minDurationMonths` | 12 à 240 | Durée la plus courte. Sert au contrôle de l'âge : quand l'âge limite ne laisse plus cette durée, il n'y a pas de solution (CAL-101, contrôle 5). |
| `maxDurationMonths` | 12 à 480 | Durée la plus longue ; c'est aussi la durée par défaut du simulateur de crédit. Au moins égale à la durée la plus courte. |
| `pricingMethod` | `PricingMethod` | Méthode de calcul. |
| `maxDebtRatioPct` | 10 à 60 | Part des revenus consacrée aux mensualités. |
| `minDownPaymentPct` | 0 à 90 | Apport minimum, en part du prix. |
| `maxAgeAtEnd` | 50 à 90, ou vide | Âge limite en fin de financement ; vide : pas de limite. |
| `minAmount` | 1 000 à 1 000 000 | Plus petit montant qu'une banque financerait, **dans la devise de référence** ; converti dans la devise de la simulation. Sous ce montant, on n'annonce ni capacité ni budget (CAL-101, contrôle 8 et « mobilisable »). |

Le barème n'a ni montant maximum, ni condition de résidence. Il sert : au simulateur d'éligibilité sans produit (CAL-103) ; au taux, à la durée et à l'apport par défaut du simulateur de crédit (CAL-110, SIM-030) ; à la projection quand le conseiller ne choisit pas de produit (CAL-120). Il se règle dans l'écran des paramètres, groupe « Financement » (ADM-010) ; un écran dédié, avec exemple en direct, est prévu en `[P1]` (BNK-070). Tant que l'écran des paramètres n'est pas livré, la valeur de départ s'applique. Tout résultat calculé avec lui le dit (« barème indicatif »).

---

## 5. Pièces : liste de départ

**PAR-050** `[P1]` Un modèle « Dossier client – standard » (`CLIENT_FILE`, par défaut, sans filtre) est créé avec **14 pièces** ; sa note (`notes`) vaut « Liste de départ à valider avec Diaspora Patrimoine (Q-008). ». Aucun modèle de banque n'est créé. Le modèle est installé par la commande d'installation dès la livraison 2 ; la création de la liste d'un dossier (GED-020) et la vérification d'une pièce (CYC-142, CYC-143) existent comme fonctions du domaine, employées par la démonstration avant le back-office des dossiers (paquet 4.1, D-097).

| # | Code | Libellé | Catégorie | Oblig. | Par emprunteur | S'applique quand | Validité |
|---|---|---|---|---|---|---|---|
| 1 | `ID_PASSPORT` | Passeport en cours de validité | `IDENTITY` | oui | oui (tous) | — | — |
| 2 | `ID_RESIDENCE_PERMIT` | Titre de séjour ou carte d'identité du pays de résidence | `RESIDENCE` | oui | oui (tous) | Situation `NON_RESIDENT` ou `EXPATRIATE` | — |
| 3 | `ID_CONSULAR_CARD` | Carte consulaire | `IDENTITY` | non | oui | Situation `NON_RESIDENT` | — |
| 4 | `CIVIL_BIRTH_CERT` | Acte de naissance | `IDENTITY` | oui | oui (tous) | — | 365 jours |
| 5 | `CIVIL_FAMILY_RECORD` | Fiche familiale ou livret de famille | `IDENTITY` | non | non | — | — |
| 6 | `RES_PROOF_ADDRESS` | Justificatif de domicile de moins de 3 mois | `RESIDENCE` | oui | oui | — | 90 jours |
| 7 | `EMP_CONTRACT` | Contrat de travail ou attestation de l'employeur | `EMPLOYMENT` | oui | oui | Emploi `PERMANENT`, `FIXED_TERM`, `CIVIL_SERVANT` | 90 jours |
| 8 | `INC_PAYSLIPS` | Trois derniers bulletins de salaire | `INCOME` | oui | oui | Idem | 90 jours |
| 9 | `INC_TAX_NOTICE` | Dernier avis d'imposition | `INCOME` | oui | oui | — | — |
| 10 | `INC_BUSINESS_ACCOUNTS` | Deux derniers bilans ou déclarations de revenus professionnels | `INCOME` | oui | oui | Emploi `SELF_EMPLOYED`, `BUSINESS_OWNER` | — |
| 11 | `INC_PENSION` | Justificatif de pension de retraite | `INCOME` | oui | oui | Emploi `RETIRED` | 365 jours |
| 12 | `BNK_STATEMENTS` | Relevés de compte des trois derniers mois | `BANKING` | oui | oui | — | 90 jours |
| 13 | `BNK_DOWN_PAYMENT_PROOF` | Justificatif de l'apport | `BANKING` | oui | non | — | 90 jours |
| 14 | `PRP_RESERVATION_CONTRACT` | Contrat de réservation signé | `PROPERTY` | non | non | — | — |

« Par emprunteur : oui » = emprunteur principal et co-emprunteur ; « (tous) » ajoute le garant. La pièce 14 est fournie par Diaspora Patrimoine (`providedBy = OPERATOR`) ; les autres par le client. Formats acceptés : `pdf, jpg, jpeg, png, heic`. Fichiers par pièce : 5, sauf `INC_PAYSLIPS` (6) et `BNK_STATEMENTS` (12) — un dépôt de photos est réuni en un seul PDF (MED-032) : une pièce de dix pages photographiées compte pour un fichier.

**Achat sans financement.** Les pièces 7 à 12 (emploi, revenus, relevés de compte) portent en plus la condition `financingRequested = true` : un acheteur comptant n'a pas à fournir ses bulletins de salaire. Pour lui, la pièce 13 se lit « Justificatif des fonds » (libellé de remplacement `labelWhenCash` de la ligne). Si le dossier change de mode en cours de route, la liste est réévaluée (CYC-041, GED-031).

**PAR-051** `[P1]` Chaque pièce porte une **aide** (`description`) rédigée pour le client. Exemples : passeport → « La double page avec votre photo, bien lisible, sans reflet. » ; relevés → « Les relevés complets, toutes les pages, de tous vos comptes courants. ». Les 14 aides sont dans `07-design/03-microcopie.md`, § Pièces.

---

## 6. Catalogue : listes de départ

**PAR-060** `[P1]` Chaque entrée d'une liste a : `code` (définitif), `labelFr`, `icon` (nom d'une icône du système de design), `sortOrder`, `isActive`. L'administrateur peut ajouter une entrée, la renommer, la désactiver ; il ne peut pas en changer le code ni la supprimer si un bien l'utilise.

**Équipements d'un programme** (`catalogue.amenities`) :

| Code | Libellé | Code | Libellé |
|---|---|---|---|
| `GATED` | Résidence fermée | `PLAYGROUND` | Aire de jeux |
| `SECURITY_24H` | Gardiennage 24 h/24 | `POOL` | Piscine |
| `VIDEO_SURVEILLANCE` | Vidéosurveillance | `GYM` | Salle de sport |
| `ELEVATOR` | Ascenseur | `SHOPS` | Commerces en pied d'immeuble |
| `PARKING` | Parking | `SCHOOL_NEARBY` | École à proximité |
| `UNDERGROUND_PARKING` | Parking en sous-sol | `MOSQUE_NEARBY` | Mosquée à proximité |
| `GREEN_SPACES` | Espaces verts | `GENERATOR` | Groupe électrogène |
| `WATER_TANK` | Réserve d'eau | `FIBER` | Fibre optique |

**Caractéristiques d'un bien** (`catalogue.features`) :

| Code | Libellé | Code | Libellé |
|---|---|---|---|
| `BALCONY` | Balcon | `ARMORED_DOOR` | Porte blindée |
| `TERRACE` | Terrasse | `INTERCOM` | Visiophone |
| `GARDEN` | Jardin | `PARKING_SPACE` | Place de parking |
| `SEA_VIEW` | Vue mer | `GARAGE` | Garage |
| `OPEN_VIEW` | Vue dégagée | `CELLAR` | Cave |
| `EQUIPPED_KITCHEN` | Cuisine équipée | `MASTER_SUITE` | Suite parentale |
| `AIR_CONDITIONING` | Climatisation | `DUAL_ASPECT` | Traversant |
| `CENTRAL_HEATING` | Chauffage central | `TOP_FLOOR` | Dernier étage |
| `DOUBLE_GLAZING` | Double vitrage | `TURNKEY` | Livré fini, clés en main |
| `FITTED_WARDROBES` | Placards intégrés | `SEMI_FINISHED` | Livré semi-fini |

`TURNKEY` et `SEMI_FINISHED` s'excluent.

---

## 7. Enquêtes de départ

**PAR-070** `[P1]` Cinq enquêtes actives. Texte des questions modifiable (FBK-020).

| Code | Déclencheur | Délai | Questions |
|---|---|---|---|
| `PROPOSAL_FEEDBACK` | `PROPOSAL_SENT` (après la première ouverture d'un bien proposé, AUT-065) | 72 h | 1. `CSAT` « Les biens proposés correspondent-ils à votre recherche ? » · 2. `CHOICE` « Qu'est-ce qui compte le plus pour vous ? » (Le prix · L'emplacement · La surface · La date de livraison · Le promoteur) · 3. `TEXT` « Un commentaire ? » (facultatif) |
| `DOSSIER_COMPLETE` | `DOSSIER_COMPLETE` | 24 h | 1. `CSAT` « Déposer vos pièces a-t-il été simple ? » · 2. `CHOICE` « Qu'est-ce qui a été le plus difficile ? » (Obtenir les documents · Les numériser · Comprendre ce qui était demandé · Rien de particulier) · 3. `TEXT` (facultatif) |
| `BANK_DECISION` | `BANK_DECISION` | 48 h | 1. `CSAT` « Êtes-vous satisfait de notre accompagnement pendant l'étude de votre financement ? » · 2. `CSAT` « Avez-vous été tenu informé à chaque étape ? » · 3. `TEXT` (facultatif) |
| `ACQUISITION` | `ACQUISITION` | 168 h | 1. `NPS` « Recommanderiez-vous Diaspora Patrimoine à un proche ? » · 2. `CSAT` « Globalement, êtes-vous satisfait de votre accompagnement ? » · 3. `TEXT` « Qu'est-ce qui vous a le plus aidé ? » · 4. `TEXT` « Que pourrions-nous améliorer ? » · 5. `CHOICE` « Acceptez-vous d'être recontacté pour un témoignage ? » (Oui · Non) |
| `CAFE_ATTENDED` `[P1]` | `CAFE_ATTENDED` | 20 h | 1. `CSAT` « Ce Café a-t-il répondu à vos questions ? » · 2. `NPS` « Recommanderiez-vous Le Café à un proche ? » · 3. `CHOICE` « Quelle suite souhaitez-vous ? » (Être rappelé · Recevoir une projection · Voir des biens · Rien pour le moment) · 4. `TEXT` (facultatif) |

Libellés des échelles : `CSAT` 1 « Pas du tout » → 5 « Tout à fait » ; `NPS` 0 « Certainement pas » → 10 « Certainement ».

---

## 8. Autres données de départ

**PAR-080** `[P1]` Créées par la commande d'installation, dans une seule transaction, et **rejouables sans doublon** (chaque ligne a une clé naturelle : code, clé, slug) :

| Donnée | Contenu | Détail |
|---|---|---|
| Organisation | « Diaspora Patrimoine », type `OPERATOR` | MOD-102 |
| Premier compte | Un compte `OWNER` à l'adresse et au nom fournis par la configuration (`SEED_OWNER_EMAIL`, `SEED_OWNER_FIRST_NAME`, `SEED_OWNER_LAST_NAME`, ENV-040), état `INVITED` ; l'invitation part par e-mail | ADM-040 |
| Pays, régions, communes, devises | § 2 | |
| Jours fériés | § 3 | |
| Paramètres | Aucune ligne : les valeurs par défaut du code s'appliquent | PAR-001 |
| Taux de change, financement de référence, produits d'exemple | § 4 | |
| Liste de pièces | § 5 | |
| Listes du catalogue | § 6 | |
| Enquêtes | § 7 | |
| Modèles d'e-mail | Ceux des modules livrés (dernier alinéa), parmi les modèles de `09-notifications-et-emails.md`, § 6 ; à la livraison 1 : ceux du § 6.1. `S_TEAM_CHANGE` arrive avec l'écran de l'équipe (EA-96) et `S_TECH_ALERT` avec les alertes techniques (AUT-076) : ni l'un ni l'autre n'est installé par le premier code (D-097) | NOT-060 |
| Règles d'automatisation | Celles des modules livrés, parmi les règles de `08-automatisations.md`, § 5 à § 7 ; aucune à la livraison 1 | |
| Blocs de contenu | Ceux des écrans livrés, parmi les blocs de CMS-020, avec les textes de la maquette validée ; à la livraison 1 : `admin.charter` | |
| Pages libres | Aucune. Les pages institutionnelles sont construites par le code et alimentées par les blocs de contenu | EDI-001 |
| Textes légaux | Une version « 0.1 – projet » de chaque texte (conditions générales, politique de confidentialité, mentions légales, politique de cookies, charte des partenaires), **en vigueur dès l'installation** ; textes au § 11 | PAR-083, SEC-090 |
| Questions fréquentes | Les questions de départ | EDI-041 |

Chaque **livraison** apporte les données de départ de ses modules (ses modèles d'e-mail, ses règles, ses blocs) : la commande, rejouée à chaque mise à jour, crée ce qui manque (AUT-083). Quand elle a créé ou mis à jour quelque chose, elle demande à `web` de revalider ses pages (étiquettes `settings`, `content`, `home`, `catalogue`, `events`, ARC-040, D-097).

**PAR-081** `[P1]` Mettre à jour l'application **ne réécrit pas** ce que l'administrateur a modifié : un modèle d'e-mail, une règle, un bloc de contenu ou une enquête dont le contenu diffère de celui d'origine est laissé tel quel. Seules les lignes absentes sont créées. Pour le savoir, chaque ligne livrée garde son **texte d'origine** à côté de son texte courant (`EmailTemplate.originSubject`, `originPreheader`, `originBodyHtml` ; `WorkflowRule.originDefinition` ; `ContentBlock.originValue` ; `Survey.originDefinition`) :
- texte courant = texte d'origine (jamais modifié) : une mise à jour qui corrige le texte livré **remplace les deux** — une faute corrigée par SYMLOOP arrive donc chez tout le monde. Pour un modèle d'e-mail, la commande d'installation le fait dès qu'elle livre un texte d'origine plus récent, et seulement tant que le texte courant est encore égal à l'ancien texte d'origine (D-097) ;
- texte courant ≠ texte d'origine (modifié par l'administrateur) : le texte courant est **laissé** ; seul le texte d'origine est mis à jour, et l'écran du modèle signale « Une nouvelle version du texte d'origine existe » avec « Comparer » et « Rétablir le texte d'origine ». Pour un modèle d'e-mail, la commande d'installation met ainsi à jour le seul texte d'origine (D-097).

**PAR-083** `[P1]` **Textes légaux de départ.** Une inscription, une demande, un consentement citent toujours la version du texte accepté (`Consent.documentVersion`) : il faut donc un texte **en vigueur** dès le premier formulaire livré. L'installation publie pour chaque texte — y compris la charte des partenaires (`PARTNER_CHARTER`, EDI-060) — une version « 0.1 – projet », au contenu provisoire rédigé par SYMLOOP — le texte de départ est au § 11 — et marqué en tête « Version provisoire, en cours de validation ». Le lien du pied de page l'affiche comme tout texte en vigueur. Tant qu'une version 0.1 est en vigueur : le point « Textes légaux » de la carte « Avant la mise en ligne » reste ouvert (PAR-100), et l'ouverture au public est déconseillée par cette carte. Quand la cliente publie ses textes validés (CMS-060), les personnes qui avaient accepté la version provisoire sont invitées à accepter la nouvelle à leur prochaine connexion (AUTH-090). La relecture juridique de ces textes revient à la cliente (Q-010).

**PAR-082** `[P1]` **Données de démonstration.** Une commande distincte, **refusée en production**, crée un jeu d'essai : 3 promoteurs, 6 programmes, 18 biens et leurs lots, des images d'illustration, 2 Cafés, 12 clients, 8 dossiers à différentes étapes, 5 comptes du personnel (un par rôle). Toutes ces lignes sont marquées par le journal d'audit : chaque création du jeu y est écrite sous son code générique (`{objet}.created`, SEC-080), avec l'acteur `SYSTEM` et la raison `demo`. Une commande, refusée elle aussi en production, retire physiquement les objets ainsi marqués, avec ce qui en dépend, et les comptes dont l'adresse finit par `@demo.invalid`. Elles servent aux tests, à la recette et aux démonstrations. **Premier code** (D-097, Q-067) : la commande (`pnpm --filter @dp/api demo`, ENV-041) passe par les cas d'usage du back-office et installe le catalogue — 4 promoteurs, une banque, trois programmes avec leurs biens et leurs lots, les images d'illustration —, deux Cafés, et le lien du comparatif de l'accueil vers le bien DP-DZ-0142 (ACC-041) ; ni client ni compte du personnel. Pour « Mes pièces » (paquet 2.9), `-- --dossier-pour={adresse}` donne au compte client **existant** de cette adresse — créé par le site, jamais inventé — un dossier à l'étape « Dossier » sur DP-DZ-0142, avec la liste de départ (PAR-050) et quatre pièces dans des états différents, par les fonctions du domaine (liste, dépôt par l'équipe, traitement, vérification) ; un seul par client, retiré par `demo:remove`.
- **Selon la livraison.** Le jeu ne contient que ce que la livraison installée sait montrer (`08-tracabilite/02`, § 4) : à la livraison 1, les 5 comptes du personnel seulement ; à partir de la livraison 2, le catalogue (promoteurs, programmes, biens, lots, images) et les 12 clients, dont 3 avec un compte ; pas de Café tant que le module n'y est pas, pas de dossier au-delà de l'étape que la livraison sait montrer. Aux livraisons 2 et 3, cette étape est « Dossier » : deux dossiers de démonstration y sont, avec leur liste de pièces, pour que « Mes pièces » se démontre côté client (paquet 2.9) ; le back-office, qui ne propose pas encore cette étape, les ouvre tels quels, sans les onglets à venir. Les 8 dossiers sont répartis sur les étapes disponibles.
- **Comptes.** Les 5 comptes du personnel et 3 comptes clients ont une adresse de la forme `{rôle}@demo.invalid` ; leurs mots de passe sont **tirés au hasard à chaque exécution** et affichés une seule fois par la commande, puis remis à la cliente avec le cahier de recette — aucun mot de passe de démonstration n'est écrit dans le dépôt. La double authentification des comptes du personnel de démonstration est déjà configurée ; son secret est remis de la même façon (un compte de démonstration ne doit pas obliger à contourner D-033).
- **Horloge.** Les dates du jeu sont relatives au jour de l'exécution : il y a toujours une option qui expire dans deux jours, une pièce à relancer, une offre proche de son échéance (ENV-032).

---

## 9. Référentiels modifiables : règles communes

**PAR-090** `[P1]` Pays, régions, communes, jours fériés, temps de vol, listes du catalogue : chacun a son écran dans Administration › Référentiels (ADM-020). Règles communes :
- une entrée **utilisée** ne se supprime pas, elle se **désactive** ; une entrée désactivée n'est plus proposée à la saisie, mais reste affichée sur les objets qui la portent ;
- le code d'une entrée ne change jamais ;
- chaque modification est tracée.

**PAR-091** `[P1]` **Activer un nouveau pays** pour le catalogue demande, dans l'ordre : ses régions (et ses communes) ; un taux de change entre sa devise et la devise de référence ; au moins un modèle de liste de pièces applicable ; puis `isCatalogueActive`. L'écran refuse l'activation tant qu'un de ces éléments manque, et dit lequel.

---

## 10. À remplacer avant la mise en ligne

**PAR-100** `[P1]` Le tableau de bord du back-office affiche une carte « Avant la mise en ligne » tant qu'un de ces points reste ouvert. Chaque ligne mène à l'écran où le régler.

| Point | Condition pour le fermer |
|---|---|
| Financement de référence | Modifié au moins une fois et taux supérieur à 0, ou confirmé explicitement par un compte Direction. |
| Taux de change | Pour chaque devise d'un pays actif, un cours vers la devise de référence dont la source ne contient pas « exemple », daté de moins de `finance.exchangeRateMaxAgeDays` jours. |
| Barème indicatif | `finance.indicative` enregistré au moins une fois par un compte Direction (PAR-044). |
| Banques et produits | Au moins un produit réel utilisable, ou choix confirmé de rester sur le barème indicatif. |
| Frais d'acquisition | `finance.acquisitionFeesPct` renseigné pour chaque pays actif, ou choix confirmé d'afficher « hors frais » (CAL-106). |
| Liste de pièces | Le modèle `CLIENT_FILE` par défaut a été enregistré au moins une fois par un membre du personnel (`updatedById` renseigné ; les données de départ le laissent vide). |
| Coordonnées | `contact.phone` ou `contact.email` renseigné ; `mail.fromAddress` et `mail.replyTo` renseignés (plus de valeur venue de l'environnement). |
| Textes légaux | Conditions générales, politique de confidentialité, mentions légales, politique de cookies et charte des partenaires publiées dans une version **autre que** « 0.1 – projet » (PAR-083). |
| Mentions financières | Les quatre mentions du § 1.9 relues par la cliente : case « Relues et validées le {date} » cochée par un compte Direction (Q-010) ; cocher la case vaut confirmation de ce point. |
| Comparatif de l'accueil | Durée et taux de chaque scénario renseignés (Q-009) ; et, si un bien est désigné (`propertyId`), ce bien publié et disponible (`AVAILABLE`, ACC-041). |
| Images | Aucun bien publié dont toutes les images sont des illustrations, ou choix confirmé (Q-031). |
| Double authentification | Tous les comptes du personnel à l'état `ACTIVE` l'ont activée (les comptes invités ou suspendus ne comptent pas). |

**Confirmer en l'état** (ADM-015) n'est offert que pour les points dont la condition le prévoit : financement de référence, banques et produits, frais d'acquisition, images, mentions financières. Une confirmation est gardée dans `launch.confirmations` (point, auteur, date, raison ; tracée `setting.changed`) ; elle vaut jusqu'à ce qu'un compte Direction la retire, même si la cause revient. Les autres points ne se ferment que par leur condition. Chaque point a son code (`LaunchCheckPoint`).

La carte arrive avec l'écran des paramètres (paquet 6.4) : le site s'ouvre à la livraison 5 (D-085). Dans une ouverture anticipée (paquet O du plan, Q-044), elle arrive plus tôt et liste tous les points ; ceux qui portent sur des fonctions pas encore livrées (banques, pièces) y figurent grisés, avec la mention « sans objet à cette livraison », posée d'office : personne n'a à les confirmer.

L'**indexation** (`seo.allowIndexing`) n'est pas un point de cette liste : c'est le **dernier geste** de l'ouverture, fait quand la liste est vide ou que chaque point restant est confirmé (ENV-054, ADM-012).

---

## 11. Annexe — textes légaux de départ

**Version 0.1 — provisoire, à remplacer (PAR-083).** Texte de la version « 0.1 – projet » de chacun des cinq textes, publiée par l'installation. Il est volontairement court et neutre : il dit ce que fait la plateforme, sans engagement qui n'aurait pas été validé. La page le complète d'office (EDI-060, EDI-061) : identité de l'éditeur au-dessus des mentions légales, tableau des cookies sous la politique de cookies, lien vers l'exercice des droits sous la politique de confidentialité. Diaspora Patrimoine et son conseil le remplacent par les textes validés avant l'ouverture au public (Q-010, PAR-100).

**Conditions générales d'utilisation** (`TERMS_OF_USE`)

> 1. **Objet.** Le site présente des biens immobiliers proposés par des promoteurs partenaires et permet d'être accompagné dans un projet d'acquisition, y compris dans la recherche d'un financement. Ces conditions encadrent l'usage du site et de l'espace client.
> 2. **Espace client.** Il est personnel. Vous gardez votre mot de passe secret et fournissez des informations exactes.
> 3. **Informations indicatives.** Prix, disponibilités, mensualités et résultats des simulateurs sont donnés à titre indicatif. Seuls les documents remis par le promoteur et l'offre écrite d'une banque font foi.
> 4. **Aucun engagement.** Une demande, une simulation ou l'ouverture d'un espace n'engagent ni vous, ni Diaspora Patrimoine, ni un promoteur, ni une banque.
> 5. **Service.** Nous veillons à la disponibilité du site, sans pouvoir la garantir en permanence.
> 6. **Données personnelles.** Leur traitement est décrit dans la politique de confidentialité.
> 7. **Évolution.** Une nouvelle version de ces conditions vous est présentée à votre prochaine connexion.

**Politique de confidentialité** (`PRIVACY_POLICY`)

> 1. **Responsable du traitement** : Diaspora Patrimoine, dont l'identité figure dans les mentions légales. Son prestataire technique, SYMLOOP, traite les données pour son compte.
> 2. **Données** : votre identité et vos coordonnées, les informations sur votre projet et, si vous constituez un dossier, les pièces utiles à son financement.
> 3. **Finalités** : répondre à vos demandes ; suivre votre projet et votre dossier ; le transmettre à une banque ou à un promoteur, avec votre accord ; vous envoyer nos actualités si vous l'avez accepté ; assurer la sécurité de la plateforme.
> 4. **Destinataires** : l'équipe de Diaspora Patrimoine ; avec votre accord, la banque ou le promoteur concerné par votre dossier ; nos prestataires techniques (hébergement dans l'Union européenne, envoi des e-mails), liés par contrat.
> 5. **Durée** : le temps nécessaire à ces finalités, puis celui que la loi impose.
> 6. **Vos droits** : accès, rectification, effacement, limitation, opposition, portabilité, et retrait de votre consentement à tout moment. Vous pouvez aussi saisir l'autorité de protection des données compétente.

**Mentions légales** (`LEGAL_NOTICE`)

> - **Éditeur** : Diaspora Patrimoine, identifié en tête de cette page. Directeur de la publication : son représentant légal.
> - **Conception et réalisation** : SYMLOOP.
> - **Hébergement** : un prestataire établi dans l'Union européenne, dont le nom et l'adresse sont précisés dans la version définitive.
> - **Propriété** : les textes, photographies et marques du site ne peuvent être reproduits sans autorisation ; les visuels fournis par les promoteurs restent leur propriété.

**Politique de cookies** (`COOKIE_POLICY`)

> Le site dépose les seuls cookies nécessaires à son fonctionnement : connexion à l'espace client, sécurité des formulaires, mémorisation de vos choix, simulations faites sans compte. Aucun ne sert à la publicité. La mesure d'audience, si elle est activée, n'est déposée qu'avec votre accord, que vous pouvez retirer à tout moment par « Gérer mes cookies ». La liste des cookies et leur durée figurent ci-dessous.

**Charte des partenaires** (`PARTNER_CHARTER`)

> 1. **Objet.** Cette charte s'applique aux promoteurs et aux banques qui créent un espace partenaire. La convention signée après l'acceptation d'une candidature la complète et prévaut sur elle.
> 2. **Inscription.** Elle est gratuite et n'engage à rien avant la convention. Les informations et les justificatifs fournis sont exacts ; Diaspora Patrimoine les examine et peut refuser une candidature.
> 3. **Le client a un seul interlocuteur.** Les échanges avec les clients passent par l'équipe de Diaspora Patrimoine. Les coordonnées du partenaire ne sont pas publiées sur le site.
> 4. **Informations exactes.** Les prix, les disponibilités et les descriptifs transmis par un promoteur, les conditions transmises par une banque, sont exacts et tenus à jour. Ce qui est montré au public ou au client est relu par l'équipe avant d'être publié.
> 5. **Confidentialité.** Les informations reçues sur un client et son dossier ne servent qu'à l'étude de son projet, et sont protégées comme le veut la réglementation sur les données personnelles.
> 6. **Évolution.** Une nouvelle version de cette charte est présentée au partenaire à sa prochaine connexion.
