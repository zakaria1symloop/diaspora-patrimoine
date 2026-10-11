# Back-office — socle

Le back-office est l'application `admin` : le poste de travail du personnel de Diaspora Patrimoine. Ce fichier décrit ce qui est **commun à tous ses écrans** : accès, mise en page, navigation, recherche, listes, fiches, chronologie, préférences. Les modules sont dans les fichiers `02` à `13`.

Droits : la matrice de `00-cadre/02`. Largeur de référence : 1280 px et plus (TRV-130).

---

## 1. Accès

**BO-001** `[P1]` Le back-office est servi sur un **hôte distinct** du site public (D-051). Il n'est jamais indexé. Seuls les comptes de nature `STAFF` y entrent (ROL-004) ; un compte client qui tente de s'y connecter reçoit « E-mail ou mot de passe incorrect. » (`401 INVALID_CREDENTIALS`).

**BO-002** `[P1]` **Connexion** (EA-00) : e-mail, mot de passe, puis **code de double authentification**, obligatoire pour tout le personnel (D-033, `security.staff.twoFactorRequired`). Pas de « Se souvenir de moi », pas de connexion par lien. Verrou après échecs : AUTH-032. Mot de passe oublié : même parcours que le client (AUTH-045), avec les modèles `S_`. Adresses de l'application `admin` : `/connexion` (EA-00), `/invitation/{jeton}` (première connexion, BO-003), `/mot-de-passe-oublie`, `/reinitialisation/{jeton}`, `/equipe` (EA-96), `/preferences` et `/preferences/securite` (EA-104), `/diagnostic` (EA-102) ; les liens des modèles `S_` y mènent (`01-domaine/09`, § 6.1).

**BO-003** `[P1]` **Première connexion d'un compte invité** (`S_INVITATION`, lien de 7 jours) : choix du mot de passe (AUTH-002), puis **configuration obligatoire** de la double authentification (étapes de PRO-020), puis acceptation de la charte d'utilisation (bloc `admin.charter`, CMS-020 ; date gardée dans `User.charterAcceptedAt`). Aucun écran du back-office n'est accessible avant la fin de ces trois étapes : tant qu'elles ne sont pas finies, le compte n'a pas de session, seulement le jeton d'étape `STAFF_SETUP`, qui n'ouvre que ces trois écrans (AUTH-026). Un parcours interrompu reprend où il s'était arrêté, par le même lien d'invitation tant qu'il est valable, sinon par une nouvelle invitation. Quand le texte de la charte change, elle est présentée de nouveau à la connexion suivante de chacun.

**Lien et états.** Le bouton de `S_INVITATION` ouvre `/invitation/{jeton}` sur l'hôte du back-office (`ADMIN_URL`) — jusqu'à la livraison de l'application `admin`, le côté du personnel n'existe que dans l'API, et ce lien n'a pas encore de page (D-097) —, qui appelle `POST /auth/staff-setup/start` : le jeton `STAFF_INVITATION` est vérifié ; la réponse `200` pose le jeton d'étape `STAFF_SETUP` (AUTH-026) et donne `remainingSteps` ; un lien introuvable, expiré ou déjà consommé répond `410 GONE`. Le choix du mot de passe ne consomme pas le lien d'invitation : il reste valable jusqu'à la dernière étape franchie, qui le consomme (`AuthToken.usedAt`) ; à ce même instant, le compte passe `ACTIVE`, `User.emailVerifiedAt` et `Membership.acceptedAt` sont renseignés (CYC-200). Entre-temps, l'invité qui revient par la page de connexion avec son mot de passe reprend à l'étape manquante (`STAFF_SETUP`, AUTH-022). « Mot de passe oublié » pour un compte du personnel encore « Invité » renvoie un nouveau `S_INVITATION` (MOD-105). Un jeton d'étape obtenu par le lien d'invitation permet toujours `…/password`, même si un mot de passe existe ; obtenu avec le mot de passe (AUTH-022), jamais. Un lien d'invitation expiré ou consommé affiche « Ce lien a expiré ou a déjà été utilisé. Demandez à un administrateur de vous renvoyer l'invitation. » (ADM-030).

Texte d'origine du bloc `admin.charter` — **provisoire**, à relire par Diaspora Patrimoine avec ses textes légaux (PAR-083) :

> **Charte d'utilisation du back-office**
> 1. Mon compte est personnel : je ne prête ni mon mot de passe ni mon second facteur.
> 2. Je ne consulte les fiches et les dossiers que pour mon travail.
> 3. Les pièces des clients — identité, revenus, relevés — restent dans la plateforme : je ne les télécharge et ne les transmets que pour les besoins du dossier.
> 4. Un dossier ne part chez une banque ou chez un promoteur que par les moyens de la plateforme, et avec l'accord du client.
> 5. Ce que j'écris dans une note ou un message peut être communiqué à la personne concernée si elle le demande : j'écris des faits, avec respect.
> 6. Je signale sans attendre à la Direction un appareil perdu, un accès suspect ou un envoi fait par erreur.
> 7. Mes actions sont tracées dans un journal que la Direction peut consulter.
>
> Case : « J'ai lu la charte et je l'accepte. » — bouton « Continuer ».

**BO-004** `[P1]` **Session.** Elle se ferme après `security.staff.idleMinutes` minutes sans activité (60) et, dans tous les cas, 12 heures après la connexion. Deux minutes avant la fermeture pour inactivité : « Votre session va se fermer. » · « Rester connecté ». Après la fermeture : reconnexion sur place, sans perdre la saisie en cours (TRV-083). L'activité, ce sont les gestes de la personne — clic, saisie, navigation — : ni un écran qui se rafraîchit seul, ni le flux temps réel, ni le renouvellement silencieux de la session ne la prolongent (SEC-023).

**BO-005** `[P1]` **Confirmation renforcée.** Certaines actions redemandent le mot de passe s'il n'a pas été saisi depuis 15 minutes : exporter des données ; effacer les données d'une personne ; changer un rôle ; modifier un paramètre sensible ; générer un lien de partage vers une banque ; désactiver la double authentification d'un compte. La dernière saisie du mot de passe est notée sur la session (`Session.passwordConfirmedAt`, renseigné à la connexion et par `POST /auth/confirm-password`). Une de ces actions appelée plus de 15 minutes après cette saisie répond `403 FORBIDDEN`, raison `REAUTH_REQUIRED` : l'écran ouvre la fenêtre de confirmation (« Confirmez votre mot de passe pour continuer. », `07-design/03`, § 4), puis rejoue l'action. Un mot de passe faux dans cette fenêtre répond `401 INVALID_CREDENTIALS` et compte comme un échec de connexion (AUTH-032).

**BO-006** `[P1]` **Appareil perdu.** Un membre du personnel qui n'a plus son application de codes utilise un code de secours. Sans code de secours : un compte Direction réinitialise sa double authentification (`user.twofactor.reset`, ADM-032) ; il devra la reconfigurer à la connexion suivante. Si c'est le **seul** compte Direction qui a perdu l'accès, personne ne peut le faire depuis les écrans : une commande d'exploitation tracée le rétablit (ADM-040).

**BO-007** `[P1]` Une connexion depuis un nouvel appareil envoie `S_NEW_DEVICE_LOGIN`. Chaque connexion, réussie ou non, est écrite dans le journal d'audit.

## 2. Mise en page

**BO-010** `[P1]` Trois zones :
- un **menu latéral**, repliable en icônes ;
- une **barre du haut** : la recherche globale, le bouton « + Créer », la cloche des notifications, le menu du compte ;
- la **zone de travail** : un fil d'Ariane, un titre, les actions de la page, puis le contenu.

La barre du haut grandit avec les livraisons, comme le menu (BO-011) : le menu du compte dès la première ; la recherche globale, « + Créer » et la cloche avec le socle complet du back-office (paquet 3.1). Avant, ces trois éléments sont absents, pas grisés.

**BO-011** `[P1]` **Menu latéral.** Une entrée n'apparaît que si le rôle a la permission de lecture correspondante (ROL-023) **et** si son écran est livré : à chaque livraison, le menu ne montre que ce qui existe (`08-tracabilite/02`, § 4). Tout écran du back-office s'atteint par une entrée de ce menu, par le menu du compte ou par la barre du haut : aucun n'est orphelin.

| Groupe | Entrées | Écrans | Fichier |
|---|---|---|---|
| — | Tableau de bord | EA-01 | `02` |
| Relation client | Demandes · Clients | EA-10 à EA-13 | `03` |
| Dossiers | Pipeline · Tous les dossiers | EA-20 à EA-22 | `06` |
| Organisation | Tâches · Agenda | EA-30, EA-31 | `09` |
| Catalogue | Programmes · Biens · Médias · Import de lots · Mise en avant · Promoteurs · Autres partenaires | EA-40 à EA-47, EA-50, EA-51 | `04` |
| Financement | Soumissions · Banques · Taux de change · Financement de référence `[P1]` · Projections `[P1]` | EA-52 à EA-59 | `05` |
| Pièces | À vérifier · Recherche de pièces · Modèles de listes | EA-60 à EA-64 | `07` |
| Communication | Messagerie · Envois · Envoi groupé · Modèles · Automatisations | EA-70 à EA-76 | `08` |
| Le Café `[P1]` | Cafés | EA-80 à EA-82 | `10` |
| Satisfaction | Retours · Enquêtes | EA-85, EA-86 | `11` |
| Contenus | Textes du site · Pages · Questions fréquentes · Témoignages · Textes légaux · Redirections | EA-90 à EA-95 | `12` |
| Pilotage | Rapports | EA-02 à EA-09 | `02` |
| Administration | Équipe · Paramètres · Référentiels · Journal d'audit · Données personnelles · Corbeille · Imports et exports · Diagnostic | EA-96 à EA-103 | `13` |

Hors du menu latéral : « Mes préférences » (EA-104) dans le menu du compte ; la cloche (EA-105) et la recherche globale (EA-106) dans la barre du haut. Avant la livraison du tableau de bord (EA-01), la page d'arrivée est la première entrée du menu que le rôle peut ouvrir — l'Équipe à la première livraison, puis « Demandes ».

Des **pastilles** portent les compteurs utiles : demandes non prises en charge ; pièces à vérifier ; messages non lus ; tâches en retard.

**BO-012** `[P1]` **« + Créer »** ouvre un menu selon les droits : Demande · Client · Dossier · Tâche · Rendez-vous · Programme · Bien · Café `[P1]`.

**BO-013** `[P1]` **Menu du compte** : le nom et le rôle ; « Mes préférences » (BO-070) ; « Je suis absent » (CRM-021), à partir du traitement des demandes (paquet 3.2) ; « Se déconnecter ».

**BO-014** `[P1]` **Bandeaux permanents**, en haut de la zone de travail, quand ils s'appliquent :
- hors production : « ENVIRONNEMENT DE RECETTE — les e-mails ne partent pas vers les vrais destinataires » ; quand l'horloge de recette est avancée (ENV-032) : « Horloge avancée : nous sommes le {date} pour l'application. » ;
- accès exceptionnel en cours (ROL-016) : « Accès administrateur temporaire jusqu'au {date}. Vos actions sont tracées. » ;
- maintenance du site public active ;
- rôle `SUPPORT` : « Données personnelles masquées. ».

**BO-015** `[P1]` Une adresse du back-office ouverte sans le droit nécessaire affiche « Vous n'avez pas accès à cette page. » (`403`). Une adresse d'un objet hors du périmètre d'un conseiller (ROL-014) affiche « Cet élément est introuvable. » (`404`).

## 3. Recherche globale

**BO-030** `[P1]` Un champ dans la barre du haut, atteint aussi par la touche `/` ou `Ctrl + K`. À partir de 2 caractères, il cherche (TRV-103) dans :

| Objet | Champs cherchés | Résultat affiché |
|---|---|---|
| Clients | nom, prénom, e-mail, téléphone, ville | « NOM Prénom » · e-mail · statut |
| Demandes | référence, nom et e-mail de l'envoi | référence · nature · date |
| Dossiers | référence, nom du client, titre du bien | référence · client · étape |
| Soumissions | référence, référence de la banque | référence · banque · statut |
| Biens | référence, titre | référence · titre · publication |
| Programmes | nom | nom · région |
| Promoteurs, banques | nom | nom · statut |
| Cafés `[P1]` | référence, lieu | lieu · date |

Cinq résultats au plus par type, puis « Voir tous les résultats » vers la liste filtrée. Une **référence exacte** (`DOS-2026-0042`) arrive en tête et `Entrée` l'ouvre directement. Les résultats respectent le périmètre et le masquage du rôle (ROL-018, ROL-015) : un compte Support ne cherche que par référence ou par identifiant — une recherche sur un nom, un e-mail ou un téléphone ne lui renvoie rien, pour qu'il ne puisse pas deviner une valeur masquée à force d'essais. Navigation au clavier : flèches, `Entrée`, `Échap`.

## 4. Listes

**BO-035** `[P1]` Toutes les listes partagent le même composant, sur les règles de TRV-100 à TRV-106 :

| Fonction | Comportement |
|---|---|
| Recherche | Un champ propre à la liste ; les résultats suivent la frappe (TRV-103, TRV-107). |
| Filtres | La rangée de pastilles de DSN-054, appliquées sans bouton ; les filtres actifs montrent leur valeur et se retirent d'une croix ; « Tout effacer ». |
| Tri | Par clic sur un en-tête de colonne ; un second clic inverse. |
| Colonnes | « Colonnes » : choisir celles qui s'affichent et leur ordre ; mémorisé par utilisateur (TRV-105). |
| Pagination | 25 lignes ; réglable à 50 ou 100 ; « {début}–{fin} sur {total} » ; pagination numérotée (DSN-053). |
| Mémoire | La liste se rouvre comme on l'a laissée : vue, filtres, tri, colonnes, taille de page (TRV-105). |
| Sélection | Une case par ligne, « Tout sélectionner » sur la page, puis « Sélectionner les {n} résultats ». |
| Actions groupées | Selon la liste (affecter, clôturer, exporter…) ; chaque action groupée annonce le nombre d'objets et demande confirmation ; son résultat précise les réussites et les refus, ligne par ligne. |
| Ouverture | Un clic sur une ligne ouvre la fiche ; `Ctrl + clic` l'ouvre dans un nouvel onglet. |
| États | Chargement, vide, aucun résultat, erreur (TRV-080, TRV-104). |

L'en-tête de la liste reste visible au défilement. Une cellule tronquée montre son contenu au survol (TRV-070). Comportement détaillé du tableau : DSN-053 ; listes fluides : TRV-107 ; retour à la liste : TRV-108.

**BO-040** `[P1]` **Vues enregistrées** (`SavedView`). « Enregistrer cette vue » garde les filtres, le tri, les colonnes et la taille de page sous un nom. Les vues apparaissent en onglets au-dessus de la liste. Une vue est **personnelle** ; un administrateur peut la **partager** avec l'équipe (`view.share`). Chaque utilisateur choisit **sa** vue par défaut pour chaque liste, parmi ses vues, les vues partagées et les vues d'origine (`SavedViewDefault`) : la vue par défaut de l'un n'est pas celle de l'autre. Chaque liste a des **vues d'origine**, non supprimables, décrites dans son module (« Mes demandes », « Non affectées »…). Modifier une vue partagée demande le droit de son propriétaire ou d'un administrateur.

**BO-041** `[P1]` **Export d'une liste** (bouton « Exporter », permission d'export du module) : exporte **les lignes filtrées**, avec les colonnes affichées, en CSV ou XLSX. Au-delà de 1 000 lignes, l'export se prépare en arrière-plan et une notification prévient quand il est prêt (`NS_EXPORT_READY`) ; le fichier reste 24 heures. Les colonnes sensibles (revenus, charges, apport, date de naissance) ne sont exportées que par un rôle qui a `client.sensitive.read`. Tout export est tracé avec ses filtres et son nombre de lignes, et demande la confirmation renforcée (BO-005). Dans un fichier CSV ou XLSX, une cellule de texte qui commence par `=`, `+`, `-`, `@` ou une tabulation est précédée d'une apostrophe : un nom saisi dans un formulaire public ne s'exécute pas comme une formule à l'ouverture du fichier. Le rôle `SUPPORT` n'exporte rien.

## 5. Fiches

**BO-045** `[P1]` Une fiche (client, demande, dossier, bien, programme, promoteur, banque, soumission, Café) a :
- un **en-tête** : titre, référence, pastilles d'état, action principale, menu « ⋯ » des autres actions ;
- des **onglets**, dont l'adresse garde la trace ;
- une **colonne de droite** : les informations clés, le conseiller affecté, la prochaine tâche, les objets liés ;
- la **chronologie** (BO-050), en onglet ou en bas de page.

**BO-046** `[P1]` **Modification.** Les champs se modifient par **section** (bouton « Modifier », puis « Enregistrer » · « Annuler »). Conflit de version : TRV-094. Sortie sans enregistrer : TRV-093. Après l'enregistrement : « Modifications enregistrées. ».

**BO-047** `[P1]` **Actions selon l'état.** Une action impossible dans l'état en cours n'est pas masquée sans explication : elle est grisée, et son survol dit pourquoi (« Disponible quand le dossier est complet »). Une action interdite par le rôle est absente.

**BO-048** `[P1]` **Lecture seule.** Le rôle `VIEWER` voit les fiches sans aucun bouton de modification, et sans les données sensibles, où qu'elles figurent : revenus, charges, apport, date de naissance, montants d'une offre s'affichent « Réservé » (ROL-019). Le rôle `SUPPORT` voit les mêmes fiches avec les données personnelles et tout texte libre masqués (ROL-015), et sans accès aux fichiers, aux messages ni aux notes.

## 6. Chronologie

**BO-050** `[P1]` La **chronologie** est le fil de tout ce qui s'est passé sur un client, une demande ou un dossier, du plus récent au plus ancien. La chronologie d'un client réunit celles de ses demandes et de ses dossiers.

| Type d'entrée | Exemples | Source |
|---|---|---|
| E-mail | Envoyé, avec son état (remis, rejeté) ; clic : le contenu tel qu'il est parti, **sans** ses liens personnels ni ses codes, remplacés par « [lien personnel] » et « [code] » (NOT-002) | `Communication` |
| Message | Message du client ou du conseiller | `Message` |
| Appel, WhatsApp, rencontre | Compte rendu noté | `Communication` |
| Note | Note interne | `Note` |
| Pièce | Demandée, reçue, validée, rejetée, dispensée, expirée | `DocumentVersion` (dépôts et leurs issues) et `AuditLog` `document.*` (SEC-080) ; l'expiration : `DossierDocument.expiresAt` passée |
| Étape | Changement d'étape ou d'état, avec la raison | `DossierStageHistory` |
| Bien | Proposé, vu, intéressé, écarté, retenu | `AuditLog` `candidate.status_changed` (SEC-080) |
| Financement | Soumission créée, envoyée, complément, décision | `BankSubmissionEvent` |
| Réservation, rendez-vous, tâche | Création, changement, issue | `AuditLog` (SEC-080) : codes nommés (`reservation.*`, `appointment.outcome_corrected`) et codes génériques de l'étage 2 (`{objet}.created`, `{objet}.updated`). `Task` et `Appointment` ne gardent que leur état courant : le journal d'audit est leur seul historique. |
| Demande | Reçue, prise en charge, clôturée | Réception : la création de la `Lead` ; le reste : `AuditLog` `lead.*` (SEC-080) |
| Système | Relance automatique, règle exécutée, consentement, connexion du client | Relance : `Communication` automatique (`sentById` nul) ; règle : `WorkflowExecution` ; consentement : `Consent` ; connexion : `AuditLog` `auth.login_succeeded` du compte du client. Auteur affiché : « Automatique », sauf pour la connexion et pour un accord donné par le client lui-même — le client. |

Chaque entrée : une icône, l'auteur (ou « Automatique »), la date relative (exacte au survol), un résumé, un détail dépliable. Des **filtres** par type, en pastilles. Les vingt dernières entrées s'affichent ; les précédentes se chargent au défilement.

La chronologie ne donne pas plus de droits que ses sources : une entrée n'apparaît que si le lecteur a la permission de son type (message : `message.read` ; e-mail, appel : `communication.read` ; note : `note.read` ; pièce : `document.read` ; financement : `submission.read`). Le filtrage est fait par le serveur ; les entrées écartées ne laissent ni ligne vide ni compteur (ROL-019). Une entrée tirée du journal d'audit suit la permission de lecture de son objet (`task.read`, `appointment.read`, `lead.read`, `dossier.read`), jamais `audit.read` : la chronologie n'ouvre pas le journal. Route : `…/{id}/timeline` (API-100).

**BO-051** `[P1]` **Barre d'ajout rapide**, au-dessus de la chronologie : **Note** · **Appel** · **E-mail** · **Tâche** · **Rendez-vous**. Chaque bouton ouvre le formulaire correspondant, déjà rattaché à l'objet affiché.

**BO-055** `[P1]` **Notes internes** (`Note`). Texte de 5 000 caractères au plus. Lire : `note.read` ; écrire : `note.manage`. Seul l'auteur modifie ou supprime sa note ; supprimer celle d'un collègue demande `note.moderate` ; chacun peut l'épingler en tête. Une note n'est **jamais** visible du client (ROL-031) : le champ de saisie le rappelle (« Note interne : le client ne la voit pas. »).

## 7. Notifications et préférences

**BO-060** `[P1]` **La cloche** liste les notifications du catalogue NOT-030 (§ 3.2), avec leur compteur. Comportement : NOT-032, NOT-033. Même comportement que côté client (MSG-040 à MSG-044) : les dix dernières dans le panneau, « Tout marquer comme lu » et « Tout voir » en pied, message bref en direct ; icône selon l'objet que nomme la notification (demande, dossier, soumission, tâche, fiche, fil, partenaire ; à défaut, une cloche). Une page « Notifications » les présente toutes, 25 lignes par page (TRV-100), avec le filtre « Non lues ». Elles arrivent en direct (NOT-019).

**BO-070** `[P1]` **Mes préférences.**

| Section | Contenu |
|---|---|
| Profil | Prénom, nom, photo, fonction montrée aux clients (`jobTitle`), téléphone, fuseau horaire. |
| Signature | Texte ajouté sous le nom dans les e-mails manuels (500 caractères). |
| Notifications | Une bascule « E-mail » par groupe du personnel (NOT-020), pour les seuls groupes que son rôle peut recevoir : pas de section pour les rôles `VIEWER` et `SUPPORT`, qui ne reçoivent pas les notifications métier (NOT-018). |
| Sécurité | Changer de mot de passe ; reconfigurer la double authentification ; nouveaux codes de secours ; appareils connectés (comme PRO-021). |
| Absence | CRM-021. |

Un membre du personnel ne peut **pas** désactiver sa double authentification tant que `security.staff.twoFactorRequired` est vrai. **Reconfigurer** la double authentification (nouveau téléphone) : le mot de passe, saisi pour ce geste, puis un code de l'application actuelle ou un code de secours, puis les étapes 2 à 4 de PRO-020 ; le nouveau secret attend dans `User.twoFactorPendingSecret`, et l'ancien reste valable jusqu'à la confirmation du nouveau ; les codes de secours sont alors renouvelés, le journal note `auth.two_factor_enabled` et `S_TWO_FACTOR_CHANGED` part (`action.stateLabel` : « reconfigurée »). « Nouveaux codes de secours » demande aussi le mot de passe, invalide les anciens et envoie aussi `S_TWO_FACTOR_CHANGED` (« mise à jour : nouveaux codes de secours »).

Chaque section arrive avec ce qu'elle règle : **Profil** et **Sécurité** dès la première livraison (paquet 1.9) — qui a un compte doit pouvoir changer son mot de passe, reconfigurer sa double authentification et voir ses appareils ; **Signature** et **Absence** avec le traitement des demandes (paquet 3.2) ; **Notifications** avec les préférences (paquet 5.1). Une section non livrée est absente de l'écran.

## 8. Divers

**BO-080** `[P1]` **Raccourcis clavier** : `/` ou `Ctrl + K` recherche globale · `Échap` ferme une fenêtre · sur une fiche, `N` ouvre une note. La touche « ? » ouvre la fenêtre d'aide (BO-081), qui rappelle cette liste.

**BO-081** `[P1]` **Aide.** Un bouton « ? » dans la barre du haut (paquet 3.1) ouvre une fenêtre : les raccourcis clavier (BO-080), les coordonnées du support et, à partir du paquet 6.8, le lien vers le guide d'utilisation (QUA-090). La touche « ? » ouvre la même fenêtre.

**BO-082** `[P1]` **Dates et montants** : formats courts du back-office (TRV-020 et suivants), dans le fuseau du membre du personnel. Un montant est toujours suivi de sa devise.

**BO-083** `[P1]` **Performance.** Une liste de 10 000 lignes répond en moins de 500 ms au 95e centile. Une fiche s'affiche en moins d'une seconde ; ses onglets se chargent à la demande.

**BO-084** `[P1]` Toute action d'écriture du back-office est écrite dans le journal d'audit, avec son auteur et son rôle effectif : sous son code propre quand SEC-080 en donne un, sinon sous le code générique de son objet (`{objet}.created`, `{objet}.updated`, `{objet}.deleted`, SEC-080). Le journal n'a donc pas de trou : ce qui n'a pas de nom particulier a quand même sa ligne.
