# Back-office — demandes et CRM

Écrans **EA-10** (demandes), **EA-11** (une demande), **EA-12** (clients), **EA-13** (fiche d'un client). Contrat : offre technique, § 4.3 — CRM client, gestion des intérêts entrants.

Cycle de vie d'une demande : CYC-001 à CYC-007. Modèle : `Lead`, `Client` (`01-domaine/04`).

---

## 1. Demandes (EA-10)

**CRM-001** `[P1]` La liste des demandes est la **boîte d'arrivée** de l'équipe. Colonnes : Référence · Reçue le · Nature · Client · Objet (bien ou programme) · Origine · Conseiller · **Premier contact** · État. Tri par défaut : la plus récente d'abord. Paramètres de la liste (API-011) : `status`, `kind`, `source`, `assignedAgentId`, `createdFrom`, `createdTo`, `propertyId`, `programId`, `countryOfResidence` (celui de la fiche), `hasDossier` ; `q` sur la référence et le nom du client (API-012). Champs triables : `createdAt` (défaut, décroissant), `slaDueAt` (colonne « Premier contact »), `kind`, `status`. En livraison 2, les vues d'origine de CRM-003 sont des **liens préréglés** (adresse avec ses filtres, TRV-101) ; elles deviennent des vues enregistrées avec le paquet 3.1 (BO-040).

**CRM-002** `[P1]` **Colonne « Premier contact »** : le temps restant avant l'échéance (`slaDueAt`), en temps ouvré — « dans 1 j 4 h » (vert), « dans 3 h » (orange, moins d'un jour ouvré), « en retard de 5 h » (rouge) ; une fois le contact fait : « Contacté en 6 h ». Toute demande a cette échéance, qu'elle ouvre un dossier ou non — un message de contact attend aussi sa réponse (CAL-061) ; seule une candidature de partenaire n'en a pas. Quand la personne a choisi un jour de rappel plus lointain, l'échéance est ce jour-là et la colonne l'indique (« rappel demandé jeudi »). Une demande clôturée sans premier contact, une demande indésirable et une candidature de partenaire affichent « — » (TRV-025) : jamais un retard en rouge sur une demande qui n'attend plus rien.

**CRM-003** `[P1]` **Vues d'origine** : « À prendre en charge » (état `NEW`, non affectées) · « Mes demandes » (affectées à moi, non clôturées) · « En retard » · « À vérifier » (`needsReview` : demandes suspectes acceptées, et demandes **écartées** par le filtre sans champ piège, DEM-031) · « Candidatures partenaires » (inscriptions partenaires, filtrées par `applicationStatus` ; la colonne « Premier contact » affiche « — », CAL-061) · « Toutes » · « Indésirables ». Sur une demande à vérifier, deux boutons : **« Demande légitime »** (retire la marque ; si la demande avait été écartée, la restaure : CYC-006) et **« Indésirable »** (la classe, et retire la marque). Le nombre de demandes écartées à vérifier figure sur le tableau de bord (TDB-010) : aucune vraie demande ne reste dans un filtre que personne n'ouvre. **Filtres** : état, nature, origine, conseiller, période, bien, programme, pays de résidence, avec ou sans dossier. **Vue par défaut** : « À prendre en charge » pour un conseiller, « Toutes » pour les autres rôles.

**CRM-004** `[P1]` **Actions groupées** : affecter à un conseiller (`lead.assign`) · marquer comme indésirable · clôturer avec une issue · exporter (`client.export`).

## 2. Une demande (EA-11)

**CRM-010** `[P1]` **En-tête** : la référence, la nature, l'état, l'échéance de premier contact, le conseiller. **Corps**, en trois colonnes :

| Zone | Contenu |
|---|---|
| Ce que la personne a envoyé | Tous les champs du formulaire, tels qu'envoyés (`Lead.payload`) — sans les critères que le serveur déduit d'une recherche guidée (ASS-030) ; chaque réponse de celle-ci sous la question posée, dans les mots du client ; une région par son nom (D-108) —, avec ce qu'elle **voyait** alors (titre, prix, mensualité du bien) ; son message ; le créneau souhaité, dans le fuseau du visiteur puis dans le mien : « le matin, heure de Montréal (15 h – 18 h à Paris) » — bornes de `ContactTimeSlot` lues dans `Lead.callerTimezone` et converties dans le fuseau du lecteur (`User.timezone`) ; sans `callerTimezone`, le libellé seul ; `ANYTIME` : « peu importe » ; pour une projection complétée, les deux écrans. Rien de tout cela n'est modifiable. |
| Contexte | Le bien ou le programme (lien, disponibilité actuelle) ; la simulation jointe ; la page d'envoi (`submittedFromPath`) ; l'origine et la campagne ; la langue ; le score d'indésirabilité et ses raisons (`spamSignals`, avec les libellés de `SpamSignal`). |
| Client et suite | La fiche client (lien, statut, score) ; les **alertes** : « Informations différentes de la fiche » (MOD-300), « Doublon possible » (MOD-301), « Adresse e-mail douteuse », « E-mail rejeté » ; le dossier ouvert ou rejoint (lien, étape) ; les autres demandes du même client. |

Dessous : la chronologie de la demande (BO-050).

**En livraison 2** (paquet 2.11, lecture seule) : la zone « Client et suite » et la mention « Écrit depuis le dossier {référence} » (MSG-021) s'affichent **en texte**, sans lien ni score — la fiche client, le dossier et le score arrivent avec leurs écrans (paquets 3.3 et 3.7) ; les autres demandes du même client restent des liens (EA-11 est livré) ; la zone « Contexte » garde le lien vers la fiche publique du bien ; la chronologie (BO-050, paquet 3.1) et les actions de CRM-011 sont absentes (ECL-006 vaut aussi pour le back-office : rien ne mène à ce qui n'est pas livré).

**CRM-011** `[P1]` **Actions.**

| Action | Permission | Effet |
|---|---|---|
| **Prendre en charge** | `lead.process` | CYC-003. Si un collègue vient de la prendre : « Cette demande vient d'être prise en charge par {prénom}. ». |
| Affecter à… · Réaffecter | `lead.assign` | Choix d'un conseiller actif, non absent ; il est notifié. Son dossier le suit tant qu'il est à `INTEREST` ou `QUALIFICATION` (CYC-008). |
| Rendre | `lead.process`, sur une demande à soi ; sur celle d'un collègue, `lead.assign` sans restriction (Direction, Administrateur : CYC-008) | La demande redevient « à prendre en charge », tant qu'elle n'a pas de premier contact ; son dossier revient à `INTEREST` (CYC-008). Les conseillers sont de nouveau prévenus (`R_LEAD_RELEASED`). |
| Rouvrir | `lead.process` | Une demande clôturée à la main depuis moins de 90 jours, non rattachée à un dossier (CYC-008). |
| Noter un appel, un échange | `communication.log` | CRM-030, CRM-031. |
| Envoyer un e-mail | `email.send` | COM-020. |
| Clôturer | `lead.process` | Issue obligatoire (`LeadOutcome`), note facultative (CYC-005). |
| Indésirable · Restaurer | `lead.process` | CYC-006. |
| Ouvrir un dossier | `dossier.create` | Pour une demande qui n'en a pas (message de contact) : crée le dossier à l'étape `INTEREST`, avec `originLeadId`, et y rattache la demande (`Lead.dossierId`). Si la demande a déjà un conseiller, le dossier le reçoit et passe aussitôt à `QUALIFICATION` (CYC-020) ; sinon il attend la prise en charge (CYC-003). La demande se clôt au premier contact (CYC-005) — aussitôt, avec l'issue `DOSSIER_OPENED`, si un premier contact est déjà noté sur elle ; le dossier reçoit alors le `firstContactAt` de la demande : il n'est pas « ouvert à la main » au sens de CYC-004. |
| Rattacher au dossier · Ouvrir un second dossier | `dossier.create` | Quand la demande attend une décision (CYC-002, dernier cas). **Rattacher** : `Lead.dossierId` renseigné, `lead.attached` émis ; pour un `PROPERTY_INTEREST`, le bien devient candidat `INTERESTED` (`origin = CLIENT_INTEREST`) s'il n'y figure pas, et un candidat existant suit la règle de CYC-002 — le bien retenu n'est jamais touché ; la demande se clôt au premier contact (CYC-005), aussitôt (`ATTACHED_TO_DOSSIER`) si un premier contact est déjà noté sur elle. **Ouvrir un second dossier** : comme « Ouvrir un dossier », le bien d'un `PROPERTY_INTEREST` devenant candidat comme à la création (CYC-002). |
| Créer la fiche partenaire | `promoter.write` ou `bank.write` | Pour une demande « Devenir partenaire » (EP-23) : ouvre le formulaire de création d'un promoteur, d'une banque ou d'un partenaire, prérempli ; la demande est clôturée avec l'issue « Réponse apportée ». |
| Accepter · Demander un complément · Refuser | `lead.process` **et** `promoter.write` ou `bank.write` | Pour une inscription partenaire (EP-32) : ACP-084. La fiche est créée (ou rattachée) d'office ; la demande est clôturée `ANSWERED` à l'acceptation et au refus. |

**CRM-012** `[P1]` Une demande **rattachée à un dossier** se traite surtout **dans le dossier** : la fiche de la demande affiche « Suivi dans le dossier {référence} » et y mène. Elle se clôt d'elle-même au premier contact (CYC-005).

## 3. Affectation

**CRM-020** `[P1]` Selon `leads.assignmentMode` (Q-021) :

| Mode | Règle |
|---|---|
| `MANUAL` (défaut) | La demande arrive **non affectée**. Tous les conseillers sont notifiés. Le premier qui clique « Prendre en charge » l'obtient. |
| `ROUND_ROBIN` | La demande est affectée d'office au compte **disponible** qui a reçu sa dernière demande depuis le plus longtemps : le plus petit `max(Lead.takenAt)` des demandes dont il est le conseiller (`assignedAgentId`), toutes voies d'affectation confondues ; un compte qui n'a encore aucune demande passe en premier ; à égalité, l'ordre alphabétique du nom. Disponible : actif, `receivesLeads` vrai, non absent (CRM-021). Aucun compte disponible : elle reste non affectée, comme en mode manuel. |

Dans les deux modes : si le client a **déjà un conseiller référent**, la demande lui est affectée ; s'il n'existe qu'**un seul** compte actif parmi les rôles Direction, Administrateur et Conseiller (`OWNER`, `ADMIN`, `AGENT`), elle lui est affectée d'office, quel que soit son réglage « Reçoit des demandes » (`receivesLeads`). Une demande n'est jamais affectée à un compte Lecture seule ou Support.

**Une affectation d'office ne confie rien à un absent.** Le référent ne reçoit la demande que s'il **peut la traiter à temps** : compte actif, et pas absent au-delà de l'échéance de premier contact de la demande (CRM-021). Sinon elle suit la règle du mode (non affectée, ou répartie) ; le référent la retrouve à son retour dans la chronologie de son client. Quand la demande **rejoint un dossier ouvert**, c'est le conseiller de ce dossier qui la reçoit — et non le référent du client, s'ils diffèrent —, à la même condition de présence. Une demande affectée d'office est `IN_PROGRESS` dès sa création, avec `takenAt` (CYC-003) : son suivi repose sur son échéance de premier contact — avertissement un jour ouvré avant, alerte et tâche au dépassement (AUT-040) —, pas sur la règle des demandes « non prises ».

**CRM-021** `[P1]` **Absence.** Chaque membre de l'équipe peut se déclarer absent jusqu'à une date (menu du compte, ou « Mes préférences »). Pendant l'absence : il ne reçoit aucune nouvelle demande par répartition ; comme référent, il ne reçoit que celles qu'il pourra traiter à temps — son retour précède leur échéance de premier contact (CRM-020) ; ses demandes et ses tâches en cours **restent** les siennes, et un bandeau le rappelle aux administrateurs sur la liste de l'équipe (« {prénom} est absent jusqu'au {date} : 3 demandes et 5 tâches en cours »), avec le bouton « Réaffecter ». Ce qui lui arrive pendant ce temps ne se perd pas : ses notifications sont doublées vers les administrateurs (NOT-018), et une tâche automatique dont l'échéance tombe avant son retour est créée non affectée (AUT-032). Le retour est automatique le lendemain de la date : il a lieu le lendemain d'`absentUntil` à `business.calendar.start`, dans `business.calendar.timezone`. Être « absent au-delà » d'une échéance — celle d'une demande ou d'une tâche (CRM-020, AUT-032, NOT-035) — veut dire que ce retour est postérieur à l'échéance. « Je suis de retour », dans le menu du compte, vide `absentUntil` à tout moment.

## 4. Demande saisie par l'équipe

**CRM-025** `[P1]` « + Créer › Demande » (`lead.create`) enregistre une demande reçue hors du site (téléphone, WhatsApp, e-mail, Café) : origine (obligatoire) · client (recherche d'une fiche existante, ou création : prénom, nom, e-mail, téléphone, pays) · nature · bien ou programme · message · conseiller (moi, par défaut). Elle suit ensuite le même parcours qu'une demande du site (CYC-001), **sans** accusé de réception automatique, sauf si la case « Envoyer un e-mail de confirmation au client » est cochée.

**Accord.** Le formulaire porte une case **obligatoire** « La personne a accepté d'être recontactée au sujet de sa demande » : elle écrit une ligne `Consent` `CONTACT_REQUEST` — `granted` vrai, `wording` = ce libellé, `source` = `staff:lead`, `recordedById` = l'auteur de la saisie, `leadId` (et `clientId` s'il y a une fiche), `documentVersion` = version en vigueur de la politique de confidentialité, `proofNote` composé d'office : « Accord oral recueilli par {prénom nom} le {date}, origine : {origine} ». Sans elle, la demande ne s'enregistre pas (`MUST_ACCEPT`, TRV-064). Une case **facultative**, décochée par défaut, « La personne souhaite recevoir les actualités » écrit de même une ligne `MARKETING_EMAIL` ; décochée, rien n'est écrit.

**Sans adresse e-mail.** Quelqu'un qui appelle ou écrit sur WhatsApp n'a pas toujours donné son e-mail : la fiche se crée alors avec un **téléphone**, l'e-mail restant vide (MOD-302). La fiche porte la pastille « Sans e-mail » ; la case de confirmation est absente ; tant que l'adresse manque, les e-mails de service de son dossier sont remplacés par une tâche pour le conseiller (« Prévenir {client} : … », NOT-025), il ne peut pas recevoir d'invitation à son espace : le dépôt des pièces se fait par le conseiller (GED-055), et son accord de transmission est recueilli puis enregistré par l'équipe, avec sa preuve (MOD-302, GED-070) — son dossier part alors chez une banque comme un autre. Dès qu'une adresse est saisie, tout reprend son cours. Son échéance de premier contact court à partir de sa création ; si l'origine est « Téléphone » et que la case « Échange déjà eu avec le client » est cochée, le premier contact est noté d'emblée.

## 5. Noter un échange

**CRM-030** `[P1]` **Noter un appel** (depuis une demande, un client ou un dossier) :

| Champ | Règles |
|---|---|
| Sens | Sortant (défaut) · Entrant |
| Issue | Joint · Pas de réponse · Messagerie · Faux numéro (`callOutcome`) |
| Date et heure | Maintenant, par défaut ; modifiable, jamais dans le futur |
| Durée | Minutes, facultatif |
| Compte rendu | 5 000 caractères ; obligatoire si l'issue est « Joint » |
| Suite | Facultatif : « Me rappeler de… » crée une tâche d'appel, avec une échéance |

Une issue « Joint » vaut **premier contact** (CYC-004). Une issue « Pas de réponse » ou « Messagerie » sur un appel sortant peut déclencher l'e-mail « Nous avons essayé de vous joindre » (`R_CALL_MISSED`). « Faux numéro » marque la fiche (`Client.phoneCheckNeeded`) : le bandeau « Téléphone à vérifier » y reste jusqu'à ce que le numéro soit modifié, ou confirmé par « Numéro vérifié ». Un compte rendu se corrige ou se supprime par son auteur dans les 24 heures (MOD-400) ; si l'issue change, le premier contact est recalculé (CYC-004).

**CRM-031** `[P1]` **Noter un échange WhatsApp ou une rencontre** : même fenêtre, sans l'issue ; canal `WHATSAPP` ou `MEETING`. Un échange WhatsApp ou une rencontre noté vaut premier contact. Le lien WhatsApp du client (TRV-041) est proposé sur sa fiche si `whatsappOptIn` est vrai.

## 6. Clients (EA-12)

**CRM-040** `[P1]` Colonnes : Nom · E-mail · Téléphone · Pays de résidence · Statut · Score · Conseiller · Dernière activité · Origine. **Vues d'origine** : « Mes clients » · « Prospects chauds » (score ≥ 70, sans dossier au-delà de `MATCHING`) · « Dossiers en cours » (statut `ACTIVE`) · « Acquéreurs » · « Inactifs » · « Tous » · « Archivés ». **Filtres** : statut, conseiller, pays, score (Chaud, Tiède, Froid), origine, avec ou sans compte, accord pour les actualités, période de création, période de dernière activité. **Vue par défaut** : « Mes clients » pour un conseiller, « Tous » pour les autres rôles. **Actions groupées** (BO-035) : changer le conseiller référent (`client.assign`) · archiver (`client.archive`) · exporter (`client.export`).

**CRM-041** `[P1]` **Créer un client** (`client.create`) : prénom, nom, e-mail, téléphone, pays de résidence, origine, conseiller. Il faut **l'e-mail ou le téléphone** : l'un des deux suffit (MOD-302). À la saisie de l'e-mail : si une fiche existe, la création est remplacée par « Cette adresse appartient déjà à {nom}. Ouvrir sa fiche ». À la saisie du téléphone : si une autre fiche le porte, un avertissement « Ce numéro figure aussi sur la fiche de {nom} » — sans bloquer. En périmètre restreint (ROL-018), si cette fiche est hors de la vue du conseiller, aucun nom n'est donné : « Une fiche existe déjà pour ces coordonnées. Elle est suivie par un autre conseiller : adressez-vous à un administrateur. ».

## 7. Fiche d'un client (EA-13)

**CRM-045** `[P1]` **En-tête** : nom, statut (calculé, CYC-060), score et son niveau, conseiller référent, « Voir comme le client » (CRM-075), menu « ⋯ ». **Bandeaux**, quand ils s'appliquent : « Ne pas contacter » (avec sa raison et sa date) · « Traitement limité depuis le {date} » (ADM-063) · « Sans e-mail » · « E-mail rejeté le {date} » (boutons « Corriger l'adresse » · « Adresse vérifiée », AUT-071) · « Téléphone à vérifier » · « Suppression du compte demandée le {date} » · « Doublon possible avec {nom} » (lien « Comparer et fusionner ») · « Informations différentes dans la dernière demande » (bouton « Mettre à jour la fiche », qui montre côte à côte la valeur de la fiche et celle de la demande, champ par champ).

**CRM-046** `[P1]` **Onglets.**

| Onglet | Contenu |
|---|---|
| Aperçu | Coordonnées, préférences de contact, heure locale du client (« 14 h 05 à Montréal », d'après `Client.timezone`, TRV-031), dossier en cours, dernière demande, prochaine tâche, prochain rendez-vous, chronologie. |
| Projet et finances | Les sections « Situation », « Mon projet », « Mes finances » du profil (PRO-001). Les montants sensibles ne s'affichent qu'avec `client.sensitive.read` — ici comme dans ses simulations, ses demandes et ses dossiers (ROL-019). Dernière simulation d'éligibilité et son résultat. |
| Demandes | Toutes ses demandes. |
| Dossiers | Ses dossiers, avec étape et état. |
| Simulations | Enregistrées, reçues par e-mail, projections. Pour chacune : « Rattacher au dossier » ou « Détacher ». « Faire une simulation » ouvre les deux simulateurs dans le back-office, préremplis avec la fiche du client ; le résultat est enregistré sur sa fiche (`simulation.create`) : `clientId` et `createdById` renseignés, `isSaved` faux — le client ne la voit pas dans « Mes simulations », et elle n'est pas purgée (AUT-091). « Créer une projection » `[P1]`. |
| Favoris et alertes `[P1]` | Ses favoris ; ses alertes et leurs critères. |
| Cafés `[P1]` | Ses inscriptions et sa présence. |
| Avis | Ses réponses aux enquêtes, ses avis. |
| Proches | Personnes de confiance (PRO-040), modifiables par l'équipe. |
| Accords | L'historique de ses consentements (type, donné ou retiré, date, texte accepté, origine). |
| Compte | CRM-070. |

**CRM-047** `[P1]` **Score** (CAL-070) : la note, son niveau, et son **détail** en quatre lignes (« Joignable 15 / 20 · Projet 14 / 20 · Financement 25 / 40 · Engagement 10 / 20 »). Jamais montré au client.

**CRM-048** `[P1]` **Modifier la fiche** (`client.update`) : mêmes champs et mêmes validations que le profil du client. L'adresse e-mail d'un client **qui a un compte** ne se modifie pas ici : le client la change lui-même (AUTH-080), ou un administrateur lance « Changer l'adresse du compte » (`client.account.manage`), qui envoie le lien de confirmation à la nouvelle adresse ; l'adresse ne change qu'à la confirmation. L'ancienne adresse **n'est pas gardée comme alias** : une fois quittée, elle peut appartenir à quelqu'un d'autre, dont une demande ne doit pas atterrir dans cet espace (`alternateEmails` ne sert qu'aux fusions, CRM-080). Pour un client **sans compte**, l'adresse se modifie ici, sous la même règle d'unicité que la création (CRM-041). Corriger l'adresse, ou cliquer « Adresse vérifiée », lève le bandeau « E-mail rejeté » (AUT-071).

**CRM-050** `[P1]` **Qualifier** (Q-037). Le bouton « Marquer comme qualifié », sur le dossier à l'étape `QUALIFICATION`, ouvre une fenêtre qui liste les conditions de CYC-021 avec, pour chacune, « fait » ou « manquant » et un champ pour compléter sur place : premier contact noté · prénom et nom · pays de résidence · situation de résidence · budget (total ou mensuel) · apport · financement souhaité · horizon d'achat · et la personne n'est pas marquée « Ne pas contacter » (si elle l'est, la ligne le dit et mène à la fiche : on ne qualifie pas quelqu'un qu'on ne peut pas appeler). Tant qu'une condition manque, le bouton de validation reste inactif, et la ligne qui manque est toujours visible : jamais un bouton grisé sans raison.

**CRM-060** `[P1]` **Ne pas contacter.** Une bascule sur la fiche (`client.update`), avec une raison obligatoire (gardée avec sa date). Effets : AUT-007 ; un bandeau sur la fiche et sur ses dossiers ; un e-mail écrit à la main reste possible, après confirmation (« {client} a demandé à ne pas être contacté : {raison}. Envoyer quand même ? ») — au conseiller de juger s'il répond à une demande de la personne ou à son dossier en cours ; un envoi groupé l'écarte toujours (COM-070). Si cette personne **envoie elle-même** une nouvelle demande, l'opposition est levée par cet envoi, et la fiche le note (CYC-009) : on ne laisse pas sans réponse quelqu'un qui demande à être rappelé.

**CRM-065** `[P1]` **Archiver** (`client.archive`) : CYC-061. « Désarchiver » rétablit la fiche.

**CRM-070** `[P1]` **Onglet Compte.**

| Élément | Contenu et actions |
|---|---|
| État | « Aucun compte » · « Invité le {date} » · « Actif, dernière connexion le {date} » · « Suspendu ». |
| Inviter | `client.invite`. Crée le compte à l'état `INVITED` et envoie `C_ACCOUNT_ACTIVATION`. « Renvoyer l'invitation » ensuite. Absent pour un client sans adresse e-mail. |
| Suspendre · Réactiver | `client.account.manage`, raison obligatoire (CYC-200). |
| Fermer ses sessions | `client.account.manage`. Déconnecte tous ses appareils. |
| Désactiver la double authentification | `client.account.manage`. Après vérification de son identité (AUTH-051) ; raison obligatoire ; confirmation renforcée (BO-005) ; le client reçoit `C_TWO_FACTOR_CHANGED`. |
| Changer l'adresse du compte | `client.account.manage` (CRM-048). |
| Appareils et dernières connexions | Lecture seule. |

L'équipe ne voit ni ne définit **jamais** le mot de passe d'un client.

**CRM-075** `[P1]` **Voir comme le client** (`client.impersonate`, ROL-017) : ouvre son espace en lecture seule dans un nouvel onglet, pour 30 minutes, sans rien marquer comme lu ou vu à sa place. Disponible seulement s'il a un compte actif. L'ouverture et la fermeture sont tracées, avec une raison facultative.

## 8. Doublons et fusion

**CRM-080** `[P1]` **Fusionner deux fiches** (`client.merge`). L'écran présente les deux fiches côte à côte.

1. **Fiche conservée.** Si une seule des deux a un compte : c'est elle. Si aucune : celle que choisit l'administrateur (par défaut, la plus ancienne). Si **les deux** ont un compte : la fusion est refusée — « Ces deux fiches ont chacune un compte. L'une des deux personnes doit d'abord supprimer le sien. ».
2. **Champs.** Pour chaque champ : la valeur de la fiche conservée, si elle en a une ; sinon celle de l'autre. Quand les deux valeurs diffèrent, l'administrateur choisit.
3. **Rattachements.** **Tout** ce qui tenait à la fiche absorbée passe à la fiche conservée — la règle vaut pour tout objet qui porte l'identifiant du client, présent ou à venir : demandes, dossiers (et avec eux leurs emprunteurs, pièces, réservations, soumissions), rendez-vous, simulations, inscriptions aux Cafés, consentements, communications, messages (les fils généraux sont réunis, dans l'ordre des dates), notes, tâches, avis et invitations aux enquêtes, personnes de confiance (sans doublon), favoris et alertes (sans doublon), préférences de notification, demandes d'exercice de droits.
4. **Ce qui protège la personne l'emporte toujours**, quel que soit le choix fait à l'étape 2 : si l'une des deux fiches est marquée « Ne pas contacter », la fiche conservée l'est ; de même pour un traitement limité (`restrictedAt`), un téléphone à vérifier, et un rejet d'e-mail s'il porte sur l'adresse conservée. Pour chaque type de consentement, c'est la ligne la **plus récente** des deux fiches qui vaut : un retrait récent n'est pas effacé par un accord ancien. Les préférences d'e-mail coupées sur l'une restent coupées. Une fiche dont les données ont été effacées (`gdprErasedAt`) ne se fusionne pas.
5. **Adresse.** L'adresse e-mail de la fiche absorbée rejoint `alternateEmails` de la fiche conservée : c'est la même personne, une demande envoyée avec l'une ou l'autre la retrouve.
6. Le conseiller référent est celui de la fiche conservée ; à défaut, celui de l'autre.
7. La fiche absorbée est supprimée logiquement, avec `mergedIntoId`. Vidée de tout, elle n'est plus qu'un **renvoi** : son adresse dans le back-office redirige vers la fiche conservée ; elle ne figure pas dans la corbeille, ne se restaure pas, et disparaît avec la fiche conservée (TRV-096).

Refus : si les deux fiches ont chacune un dossier ouvert sur le **même** bien (MOD-310) — clôturer l'un d'abord. La fusion est **irréversible** : elle demande de saisir « FUSIONNER » (TRV-095). Elle est tracée avec la liste des champs choisis.

**CRM-081** `[P1]` **Détection.** Un doublon possible est signalé quand deux fiches ont : le même téléphone ; ou le même nom, le même prénom et le même pays de résidence. Les noms se comparent après la normalisation de TRV-042, sans tenir compte de la casse ni des accents. Le signalement est calculé à la lecture de la fiche et de la demande — il n'est pas stocké —, parmi les fiches non supprimées et non archivées, hors `notDuplicateOfIds`. Le signalement n'entraîne **jamais** de fusion automatique. « Ce n'est pas un doublon » (`client.update`) le fait disparaître pour ce couple, durablement : chaque fiche retient l'autre (`Client.notDuplicateOfIds`), et le signalement ne revient pas à la prochaine modification.

## 9. Exports

**CRM-090** `[P1]` Export des demandes et des clients : BO-041. L'export des clients porte, pour chacun, l'état de ses consentements ; une ligne dont l'accord pour les actualités n'est pas donné porte « Ne pas démarcher ».
