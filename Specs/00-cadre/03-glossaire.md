# Glossaire

Chaque mot a **un seul sens** dans tout le projet. La colonne « Identifiant » donne le nom utilisé dans le code et dans les données. La colonne « À l'écran » donne le mot montré aux utilisateurs.

## 1. Les biens

| Terme | Identifiant | À l'écran | Définition |
|---|---|---|---|
| Programme | `Program` | « programme », « résidence » | Ensemble immobilier neuf d'un promoteur, à une adresse. Contient un ou plusieurs biens. |
| Bien | `Property` | « bien » | Ce que le visiteur consulte et pour quoi il exprime un intérêt. Dans un programme, un bien est une **typologie** : par exemple « Appartement T3 – Résidence El Yasmine ». Hors programme (villa, terrain isolé), le bien est l'unité elle-même. Un bien regroupe un ou plusieurs lots. |
| Lot | `Lot` | « lot » | L'unité réellement vendue : tel appartement, à tel étage, à tel prix. C'est le lot qui est réservé puis vendu. Un bien isolé a exactement un lot. |
| Typologie | — | « T2 », « T3 », « T4 »… | Un type de logement d'un programme — « T3 de 72 m² » — : c'est un **bien** (`Property`) rattaché à un programme, qui réunit des lots semblables (CTL-023). Le mot désigne aussi, par extension, le nombre de pièces principales : T3 = un séjour et deux chambres, affiché avec la lettre « T » (paramètre `display.roomsPrefix`). |
| Type de bien | `PropertyType` | « Appartement », « Studio », « Duplex », « Villa », « Terrain », « Local commercial » | Nature du bien. |
| Standing | `Standing` | « Habitat confortable », « Résidence de standing », « Très haut standing » | Niveau de gamme d'un programme : `COMFORT`, `STANDING`, `PREMIUM`. Il détermine la couleur du bandeau des cartes. |
| Sur plan | `ON_PLAN` | « sur plan » | Bien vendu avant construction. |
| En construction | `UNDER_CONSTRUCTION` | « en construction » | Chantier commencé, bien non livré. |
| Livré | `DELIVERED` | « livré » | Bien achevé, disponible. |
| Disponibilité | `LotStatus` | « Disponible », « Sous option », « Réservé », « Vendu », « Retiré » | État commercial d'un lot. La disponibilité d'un bien se déduit de celle de ses lots. |
| Publication | `PublicationStatus` | « Brouillon », « Publié », « Archivé » | Visibilité d'un programme ou d'un bien sur le site public. |
| Score de complétude | `completenessScore` | « Complétude de la fiche » | Note de 0 à 100 qui mesure si une fiche bien est assez renseignée pour être publiée (seuil 60) puis jugée complète (85). Jamais montrée au public. |
| Média | `Media` | « photo », « plan », « vue 360° », « vidéo », « brochure », « image 3D » | Fichier attaché à un programme, un bien, un promoteur. |
| Image 3D | `RENDER_3D` | « Image 3D non contractuelle » | Image d'architecte d'un bien non construit. Toujours marquée « non contractuelle ». |
| Référence | `reference` | « Réf. DP-DZ-0142 » | Identifiant public lisible d'un bien, d'un dossier, d'une demande. Ne change jamais. |

## 2. Les partenaires

| Terme | Identifiant | À l'écran | Définition |
|---|---|---|---|
| Promoteur | `Promoter` | « promoteur » | Société qui construit et vend les programmes. |
| Promoteur sélectionné | `Promoter.status = ACTIVE` | « Promoteur sélectionné » | Promoteur dont Diaspora Patrimoine a examiné les références et les garanties, et avec qui une convention est signée. Seuls ses biens peuvent être publiés. |
| Banque | `Bank` | « banque », « banque partenaire » | Établissement qui finance. |
| Produit bancaire, barème | `BankProduct` | « solution de financement » | Offre d'une banque : type, taux ou marge, durée, apport minimum, taux d'endettement maximum, conditions d'accès. Alimente les simulateurs. |
| Financement classique | `CONVENTIONAL` | « crédit bancaire » | Prêt à intérêts. |
| Financement islamique | `ISLAMIC` | « financement islamique » | Financement sans intérêt, où la banque se rémunère par une marge (par exemple la mourabaha). On dit « marge » et non « taux d'intérêt », « financement » et non « prêt ». |
| Partenaire | `Partner` | « partenaire » | Autre organisme présenté sur la page « Nos partenaires » : notaire, assureur, institution. Dans `00-cadre/06` seulement, « partenaire » désigne un promoteur ou une banque. |
| Niveau d'accès | `PartnerAccessLevel` | « Niveau 1 — l'équipe saisit pour lui », « Niveau 2 — il répond par lien », « Niveau 3 — il se connecte à son portail » | Ce qu'un promoteur ou une banque peut faire lui-même sur la plateforme. Le parcours est le même aux trois niveaux ; seuls changent celui qui saisit et la porte par laquelle il passe (`00-cadre/06`). |
| Geste de partenaire | `PartnerGesture` | — | Une information qui vient d'un promoteur ou d'une banque : confirmer une option, donner une décision, déclarer un lot vendu… Liste fermée (ACP-020, ACP-021). |
| Voie | `GestureRoute` | « Saisi par l'équipe », « Répondu par lien », « Fait dans le portail » | Le chemin par lequel un geste de partenaire est entré. En Phase 1, il n'y en a qu'un : la saisie par l'équipe. |
| Réponse à relire | `PartnerAnswer` | « Réponse à relire » | Réponse donnée par un partenaire lui-même, que l'équipe applique, corrige ou écarte avant qu'elle ne change quoi que ce soit (ACP-031). Niveaux 2 et 3. |
| Éligibilité au financement | `FinancingEligibility` | « Éligible au financement » | Le fait qu'au moins une banque partenaire accepte de financer un programme ou un bien. |

## 3. Les personnes et la relation

| Terme | Identifiant | À l'écran | Définition |
|---|---|---|---|
| Visiteur | — | — | Personne non connectée. |
| Client | `Client` | « client » | Fiche d'une personne dans le CRM, qu'elle ait un compte ou non. Statuts : `PROSPECT`, `QUALIFIED`, `ACTIVE`, `CUSTOMER`, `INACTIVE`, `ARCHIVED`. |
| Prospect | `Client.status = PROSPECT` | « prospect » (back-office seulement) | Client dont le projet n'est pas encore qualifié. |
| Conseiller | `User` de nature `STAFF` | « votre conseiller », « votre conseillère » | Personne de Diaspora Patrimoine qui suit le client. |
| Conseiller affecté | `assignedAgentId` | — | Le conseiller responsable d'une demande, d'un client ou d'un dossier. |
| Co-emprunteur | `DossierParty.role = CO_BORROWER` | « co-emprunteur » | Personne qui emprunte avec le client. Ses revenus comptent, ses pièces sont demandées. |
| Garant | `DossierParty.role = GUARANTOR` | « garant » | Personne qui se porte caution. |
| Proche | `ClientContact` | « personne de confiance » | Personne désignée par le client, par exemple pour visiter un bien à sa place. |
| Situation de résidence | `ResidencyStatus` | « Non-résident », « Expatrié », « Résident du pays d'achat », « Autre situation » | `NON_RESIDENT` : vit à l'étranger, revenus à l'étranger (le cas central). `EXPATRIATE` : résident du pays d'achat, temporairement à l'étranger. `RESIDENT` : vit dans le pays d'achat. `OTHER` : aucune des trois. |

## 4. Le parcours

| Terme | Identifiant | À l'écran | Définition |
|---|---|---|---|
| Demande | `Lead` | « demande » | Tout formulaire envoyé par un visiteur ou un client avec ses coordonnées : intérêt pour un bien, demande de projection, demande de rappel, recherche guidée, suite de simulation, message de contact, candidature de partenaire. Une demande est un enregistrement **immuable** de ce qui a été envoyé. |
| Intérêt | `Lead.kind = PROPERTY_INTEREST` | « Mes intérêts » | Demande qui porte sur un bien précis. C'est l'« expression d'intérêt » du contrat. |
| Dossier | `Dossier` | « dossier », « votre projet » | Le projet d'acquisition d'un client, de la première demande jusqu'à l'acte. Il relie le client, le bien, le lot, le promoteur et la ou les banques. Tout s'y rattache : pièces, soumissions, messages, tâches, enquêtes. |
| Étape | `DossierStage` | les six étapes du client | Position du dossier dans le parcours : `INTEREST`, `QUALIFICATION`, `MATCHING`, `DOCUMENTS`, `BANK_REVIEW`, `APPROVED`, `ACQUISITION`. |
| État du dossier | `DossierStatus` | « En cours », « En pause », « Abouti », « Clôturé » | `OPEN`, `ON_HOLD`, `WON`, `LOST`. |
| Pipeline | — | « Pipeline » | Vue en colonnes (Kanban) des dossiers par étape, dans le back-office. |
| Qualification | — | — | Échange où le conseiller recueille le besoin, le budget, la situation et la capacité de financement du client. |
| Bien candidat | `DossierCandidate` | « Mes intérêts » et « Biens proposés » | Bien envisagé dans un dossier, qu'il vienne d'un intérêt du client (`CLIENT_INTEREST`) ou d'une proposition du conseiller (`ADVISOR_PROPOSAL`). |
| Rapprochement | — | — | Le fait de proposer des biens à un client et de suivre ses retours. |
| Bien retenu | `DossierCandidate.status = SELECTED` | « Bien retenu » | Le bien que le client choisit d'acheter. Un seul par dossier. |
| Option | `Reservation.status = OPTION` | « Option jusqu'au… » | Blocage temporaire d'un lot pour un client, avec une date de fin. |
| Réservation | `Reservation.status = RESERVED` | « Réservé » | Engagement confirmé sur un lot (contrat de réservation signé, acompte versé hors plateforme). |
| Rendez-vous | `Appointment` | « rendez-vous » | Appel, visio, visite d'un bien ou rencontre, avec une date. |
| Délai de premier contact | `sla.firstContactBusinessDays` | « Un conseiller vous rappelle sous 48 h ouvrées » | Temps maximum, en **jours ouvrés** (2 par défaut), entre une demande et le premier contact (CAL-061). |
| Jours ouvrés, heures ouvrées | `business.calendar.*` | — | Jours et heures de travail de Diaspora Patrimoine, définis dans les paramètres (par défaut : lundi à vendredi, 9 h – 18 h, heure de Paris, hors jours fériés français). |

## 5. Les pièces et le financement

| Terme | Identifiant | À l'écran | Définition |
|---|---|---|---|
| Pièce | `DossierDocument` | « pièce », « document » | Justificatif demandé dans un dossier, avec son statut. Une pièce peut contenir plusieurs fichiers (les pages d'un relevé). |
| Fichier | `DocumentFile` | — | Un fichier déposé pour une pièce. Les dépôts successifs sont des **versions**. |
| Liste de pièces | `ChecklistTemplate`, `ChecklistItem` | « liste de pièces » | Modèle paramétrable de pièces à fournir : pour le dossier du client (`CLIENT_FILE`) ou pour une banque donnée (`BANK_FILE`). |
| Statut d'une pièce | `DocumentStatus` | Équipe : « En attente », « Reçue », « Validée », « Rejetée », « Expirée », « Dispensée » · client : « À fournir », « Reçue, en cours de vérification », « Validée », « À refaire », « Expirée, à renouveler », « Non demandée » | `PENDING`, `RECEIVED`, `VALIDATED`, `REJECTED`, `EXPIRED`, `WAIVED`. Les libellés sont ceux de l'énumération (`01-domaine/01`, § 3), qui fait foi. |
| Complétude du dossier | `completenessPct` | « Votre dossier est complet à 70 % » | Part des pièces obligatoires validées ou dispensées. |
| Dossier complet | — | « Dossier complet » | Complétude à 100 %, aucune pièce obligatoire expirée, et aucune information manquante pour établir la liste (GED-020). |
| Relance | — | — | Rappel automatique envoyé au client pour une pièce manquante. |
| Soumission | `BankSubmission` | « Dossier envoyé à {banque} » | Envoi du dossier à **une** banque pour **un** produit. Un dossier peut avoir plusieurs soumissions. |
| Paquet de soumission | `SubmissionPackage` | — | Archive (ZIP et sommaire PDF) des pièces envoyées à une banque. |
| Partage sécurisé | `SecureShare` | « lien sécurisé » | Lien à durée limitée, protégé par un code, par lequel la banque télécharge un paquet. |
| Complément demandé | `INFO_REQUESTED` | « La banque demande un complément » | La banque demande des pièces ou des informations supplémentaires. |
| Accord | `SubmissionStatus = APPROVED` | « Financement accordé » | Décision favorable de la banque, avec ses conditions. |
| Apport | `downPayment` | « apport » | Somme que le client paie lui-même, sans emprunt. |
| Mensualité | `monthlyPayment` | « mensualité » | Somme payée chaque mois à la banque. |
| Mensualité indicative | `monthlyFromRef` | « Mensualité* », « à partir de 810 € / mois* » | Mensualité estimée d'un bien, calculée avec le financement de référence. Toujours suivie d'un astérisque et de sa note. |
| Financement de référence | `finance.reference.*` | — | Hypothèses communes (apport en %, durée, taux, méthode) servant à calculer la mensualité indicative des cartes et la recherche par budget mensuel. |
| Capacité d'emprunt | `capacity` | « Vous pouvez emprunter jusqu'à… » | Montant maximal finançable d'après les revenus, les charges et un produit bancaire. |
| Taux d'endettement | `maxDebtRatioPct` | « taux d'endettement » | Part maximale des revenus consacrée aux remboursements. |
| Simulation | `Simulation` | « simulation » | Résultat d'un calcul d'éligibilité ou de crédit, enregistré ou non. |
| Projection | `Simulation.type = PROJECTION` | « votre projection » | Étude personnalisée préparée par un conseiller à partir d'une demande : budget, mensualité, solutions de financement, exemples de biens. Envoyée en PDF. |
| Devise d'affichage, devise de référence | `display.referenceCurrency` | « € » | Devise dans laquelle le visiteur voit les montants. Par défaut l'euro (Q-029). |
| Devise du bien | `priceCurrency` | « DA » | Devise dans laquelle le promoteur fixe le prix : celle du pays du bien. |
| Taux de change | `ExchangeRate` | « taux indicatif du 12/09/2026 » | Cours utilisé pour convertir. Deux natures : `OFFICIAL` et `INDICATIVE`. |

## 6. La communication

| Terme | Identifiant | À l'écran | Définition |
|---|---|---|---|
| Chronologie | — | « Historique » | Fil de tout ce qui s'est passé sur un client ou un dossier : e-mails, messages, appels notés, notes, changements d'étape, pièces. |
| Communication | `Communication` | — | Une entrée d'échange : e-mail envoyé, appel ou échange WhatsApp noté. |
| Message | `Message`, `Conversation` | « Messages » | Messagerie intégrée entre le client et son conseiller. |
| Note | `Note` | « Note interne » | Texte interne au personnel, jamais visible du client. |
| Modèle d'e-mail | `EmailTemplate` | « modèle » | Texte paramétrable avec des champs dynamiques. |
| Notification | `Notification` | cloche | Alerte dans l'application. |
| Règle d'automatisation | `WorkflowRule` | « automatisation » | « Quand tel événement se produit, faire telle action après tel délai. » |
| Tâche | `Task` | « tâche » | Action à faire par un membre du personnel, avec une échéance. |
| Enquête | `Survey` | « Votre avis » | Questionnaire de satisfaction envoyé à une étape clé. |
| Retour | `Feedback` | « avis », « retour » | Réponse à une enquête, avis spontané ou signalement d'erreur sur une fiche. |
| Indice de recommandation | `npsScore` | — | Note de 0 à 10 à la question « Recommanderiez-vous… ». Indice = % de 9–10 moins % de 0–6. |
| Indice de satisfaction | `csatScore` | — | Note de 1 à 5. Indice = part des notes 4 et 5. |

## 7. Le Café

| Terme | Identifiant | À l'écran | Définition |
|---|---|---|---|
| Le Café | `Event` | « Le Café Diaspora Patrimoine », « Café » | Rencontre conviviale où promoteurs et banquiers reçoivent les clients, à Paris et dans le Sud de la France, au moins une fois par mois. |
| Inscription | `EventRegistration` | « inscription » | Réservation d'une ou plusieurs places à un Café. |
| Place | `seats` | « Il reste 12 places » | Une personne présente. Une inscription peut compter plusieurs places. |
| Liste d'attente | `WAITLISTED` | « liste d'attente » | Inscriptions reçues quand le Café est complet. |
| Pointage | `ATTENDED` | — | Le fait de noter qu'un inscrit est venu. |

## 8. La plateforme

| Terme | Identifiant | À l'écran | Définition |
|---|---|---|---|
| Site public | application `web` | — | Tout ce qui est visible sans se connecter. |
| Espace client | application `web`, zone `/espace-client` | « Mon espace » | Zone réservée au client connecté. |
| Back-office | application `admin` | — | Poste de travail du personnel. |
| Bloc de contenu | `ContentBlock` | — | Morceau de page modifiable depuis le back-office (titres et textes de l'accueil, chiffres du comparatif…). Les coordonnées de contact sont des paramètres (`contact.*`). |
| Paramètre | `Setting` | « Paramètres » | Valeur réglable sans développement. |
| Journal d'audit | `AuditLog` | « Journal d'audit » | Registre non modifiable des actions sensibles. |
| Consentement | `Consent` | — | Trace de l'acceptation d'un texte ou d'un usage par une personne, avec la version du texte. |
| Demande d'exercice de droits | `DataRequest` | — | Demande d'une personne sur ses données : accès, rectification, effacement, limitation, portabilité, opposition. |
| Jeton | `AuthToken` | — | Code à usage unique contenu dans un lien (vérification d'e-mail, mot de passe, connexion). |
| Slug | `slug` | — | Partie lisible d'une adresse : `residence-el-yasmine`. |

## 9. Abréviations

| Sigle | Sens |
|---|---|
| CRM | Gestion de la relation client : fiches, historique, qualification. |
| GED | Gestion électronique des documents : les pièces des dossiers. |
| SEO | Référencement naturel dans les moteurs de recherche. |
| RGPD | Règlement général sur la protection des données (Union européenne). |
| Loi 18-07 | Loi algérienne sur la protection des données personnelles. |
| VEFA | Vente en l'état futur d'achèvement : vente sur plan. |
| SLA | Délai de traitement attendu pour une étape. |
| TMA | Tierce maintenance applicative (contrat optionnel). |
| DA, DZD | Dinar algérien. |
