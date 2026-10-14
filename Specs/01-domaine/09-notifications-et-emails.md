# Notifications et e-mails

Ce fichier dit **quel message part, à qui, par quel canal, avec quel texte**. Le déclenchement est décrit dans `06-cycles-de-vie.md` (événements) et `08-automatisations.md` (règles et relances). Les écrans qui affichent les notifications sont dans `03-espace-client/05` et `04-back-office/01`.

Dans les textes cités, l'apostrophe droite est employée par commodité d'écriture ; les fichiers de traduction utilisent l'apostrophe typographique (TRV-010).

---

## 1. Principes

**NOT-001** `[P1]` **Canaux.** Trois canaux : la **notification dans l'application** (cloche), l'**e-mail**, et `[MOB]` la notification **push**. Aucun SMS. Aucun message WhatsApp automatique : WhatsApp est un lien de contact (Q-015).

**NOT-002** `[P1]` Tout e-mail adressé à un client, à une banque ou à un promoteur part **de la plateforme** et laisse une ligne `Communication` avec son contenu, son statut et son auteur (objectif O6). Le personnel n'envoie pas d'e-mail client depuis sa messagerie personnelle.

**Ce que la ligne conserve.** Le contenu tel qu'il a été envoyé — **sauf les secrets**. Un lien à jeton (activation, vérification, mot de passe, connexion, invitation, partage d'un dossier, enquête, gestion d'une inscription, préférences, désinscription) et un code (accès à un partage, confirmation d'une action) donnent accès à un compte ou à des pièces : ils ne sont **jamais écrits** dans `Communication.body`, ni dans un journal. Chaque modèle déclare ses champs secrets (`EmailTemplate.secretVariables`) ; à l'enregistrement de la ligne, leur valeur est remplacée par « [lien personnel] » ou « [code] ». Lire le journal des e-mails ne permet donc ni de se connecter à la place d'un client, ni d'ouvrir le dossier envoyé à une banque, ni d'accepter une invitation à la place d'un collègue. Le texte complet n'existe qu'en mémoire du travailleur, le temps de le remettre au fournisseur (NOT-010, MOD-400). « Renvoyer » un tel e-mail en produit un **nouveau**, avec un nouveau lien.

**NOT-003** `[P1]` **Expéditeur.** Nom : `mail.fromName` (« Diaspora Patrimoine »). Adresse : le paramètre `mail.fromAddress` s'il est renseigné, sinon la variable `MAIL_FROM_ADDRESS` de l'environnement ; adresse de réponse : `mail.replyTo`, sinon `MAIL_REPLY_TO` (ENV-040). Il y a donc toujours un expéditeur, dès la première invitation. Les réponses arrivent dans cette boîte, lue par l'équipe ; la plateforme ne lit pas les e-mails entrants en Phase 1. Le conseiller note une réponse reçue dans la chronologie (COM-030). `[V2]` Lecture automatique des réponses.

**NOT-004** `[P1]` **Habillage commun** (EM-01). Chaque e-mail : logo en tête ; un titre ; un corps court ; **un seul bouton** principal ; une signature ; un pied avec le nom d'usage (`contact.companyName`), la raison sociale et l'adresse postale si elles sont renseignées (`contact.legalName`, `contact.address`), le téléphone et l'e-mail de contact (`contact.phone`, `contact.email`), la raison de l'envoi (une phrase choisie selon `EmailTemplate.audience` et `EmailTemplate.category` : textes `notice.emailReason.*`, `07-design/03`, § 7) et, pour un e-mail non obligatoire, le lien « Gérer mes préférences ». Largeur 600 px, lisible sans images, compatible avec le mode sombre. Une version texte accompagne toujours la version HTML. Le modèle ne contient que le corps ; l'habillage est ajouté à l'envoi. Le **titre** est l'objet de l'e-mail. La raison de l'envoi est l'une des quatre mentions `notice.emailReason.*` (`07-design/03`, § 7).

**NOT-005** `[P1]` **Ton.** On vouvoie. Phrases courtes. Une idée, une action par e-mail. On dit ce qui s'est passé, ce que la personne doit faire, et ce qui se passera ensuite. On n'écrit jamais « refusé » ni « rejeté » à propos d'une personne : une pièce est « à refaire », une banque « n'a pas donné suite ».

**NOT-006** `[P1]` **Salutation et signature.** « Bonjour {prénom}, » ; sans prénom connu : « Bonjour, ». Signature : le conseiller du dossier s'il existe (« Amel K. — Diaspora Patrimoine », TRV-145), sinon « L'équipe Diaspora Patrimoine ».

**NOT-007** `[P1]` **Liens.** Toujours en HTTPS, vers le site. Un lien vers l'espace client passe par la connexion puis ramène à la page visée. Les liens qui doivent marcher sans connexion portent un **jeton opaque** : activation, vérification, mot de passe, connexion par lien, enquête, gestion d'une inscription au Café, alerte, préférences. Aucune donnée personnelle dans une adresse (TRV-053).

**NOT-024** `[P1]` **Destinataire sans espace actif.** Quand le bouton d'un e-mail mène à l'espace client et que le destinataire n'a pas de compte, un compte est créé à l'état `INVITED` à cet instant ; s'il a un compte `INVITED`, un nouveau lien d'activation est émis, **sans invalider les précédents** (MOD-105) : le bouton d'un e-mail reçu la semaine dernière marche encore. Dans les deux cas, le bouton porte le **lien d'activation**, qui conduit ensuite à la page visée (AUTH-040). Le client n'a donc jamais à chercher comment entrer : pièces à fournir, biens proposés, projection, offre de la banque — un clic, un mot de passe à choisir, et il y est. Une fois l'espace actif, ces mêmes boutons mènent à la connexion, puis à la page visée.

**NOT-025** `[P1]` **Destinataire sans adresse e-mail** (MOD-302). Aucun e-mail ne part ; la ligne `SUPPRESSED` d'AUT-007 en garde la trace. Si le modèle est un e-mail **de service** (sans groupe de préférences) lié à une demande ou à un dossier — pièces demandées ou à refaire, envoi à la banque, décision, option, réservation, clôture —, une tâche est créée à sa place pour le conseiller : « Prévenir {client} : {objet de l'e-mail} », priorité haute, échéance un jour ouvré, clé `client-notify:{modèle}:{objet}`. Les e-mails d'un **rendez-vous** n'entrent pas dans cette règle : sans adresse, le conseiller est prévenu à la saisie (TAC-040), `clientNotifiedAt` reste vide, et ni rappel, ni report, ni annulation ne créent de tâche. Les relances et les e-mails d'un groupe sont simplement omis — à une exception près : les **biens proposés** (`C_PROPOSAL_NEW`). C'est par cet e-mail seul que le client apprend qu'on lui propose des biens, et sans adresse il n'a pas d'espace où les lire : la tâche « Présenter les biens proposés à {client} » le remplace (PIP-031). Il en va de même quand `C_PROPOSAL_NEW` ne part pas vers un client **sans espace actif**, quelle qu'en soit la raison — groupe « Nouveautés de mon projet » coupé, adresse en erreur, « Ne pas contacter » : la même tâche est créée, clé `client-notify:C_PROPOSAL_NEW:{dossierId}`. La chronologie garde la trace : « E-mail non envoyé : pas d'adresse. Tâche créée. ».

**NOT-026** `[P1]` **Un bouton mène toujours quelque part.** La destination d'un bouton est une adresse de l'application ; si la fonction visée n'est pas disponible pour ce destinataire — messagerie pas encore livrée (`08-tracabilite/02`, § 4), demande de rendez-vous inactive (`features.clientAppointments`) —, l'adresse applique son **repli** : `/espace-client/messages` ouvre le formulaire d'écriture au conseiller (MSG-021) ; `/espace-client/rendez-vous` montre les rendez-vous et, à la place de « Demander un rendez-vous », « Écrire à mon conseiller ». Aucun modèle n'a donc à changer d'une livraison à l'autre.

**NOT-008** `[P1]` **Données sensibles.** Un e-mail ne contient jamais : une pièce du dossier, un revenu, une charge, une date de naissance, un mot de passe. Les montants d'une offre de financement ne figurent pas dans l'e-mail : il renvoie à l'espace client. Seules pièces jointes permises : le PDF d'une simulation ou d'une projection, et un fichier d'agenda (`.ics`).

**NOT-009** `[P1]` Un e-mail qui montre le prix d'un bien avec une mensualité (proposition, alerte, favoris) porte l'astérisque et la note de TRV-023 dans son pied.

**NOT-010** `[P1]` **Chaîne d'envoi.** (1) La ligne `Communication` est créée à l'état `QUEUED`, **sans contenu** : `templateCode`, destinataire (`toAddress`), rattachements, et dans `metadata` (clé `render`) l'identifiant de l'événement, ceux des objets que cite le modèle et ses champs propres non secrets — pour un e-mail manuel, le sujet et le corps validés par son auteur (NOT-043). (2) Un travailleur **rend** l'e-mail au moment de l'envoi (NOT-012) : il émet alors les jetons et les codes de ses champs secrets (MOD-105), remet le texte complet au fournisseur, puis écrit sur la ligne l'objet, le corps expurgé (NOT-002) et `templateVersion` : état `SENT`, `providerMessageId` renseigné. Un jeton n'est donc créé que pour un envoi effectif, et n'existe en clair ni en base ni dans une file d'attente ; un nouvel essai rend l'e-mail de nouveau, avec un nouveau jeton ; une ligne restée `FAILED` sans corps n'est jamais partie. (3) Les retours du fournisseur (webhooks signés) font évoluer l'état : `DELIVERED`, `BOUNCED`, `COMPLAINED`, et, si le suivi est activé, `OPENED`, `CLICKED`. Deux sortes d'échec à la remise au fournisseur :
- le fournisseur est **injoignable ou en erreur passagère** : l'envoi est retardé, pas annulé (FIA-043) — nouvel essai après 1 min, 5 min, 30 min, 2 h, 6 h, puis toutes les 6 heures, pendant 72 heures ; au-delà, `FAILED` (« Fournisseur indisponible ») ;
- le fournisseur **refuse** le message (adresse invalide, contenu rejeté) : `FAILED` tout de suite, sans nouvel essai.

Un e-mail **manuel**, ou adressé à une banque ou à un promoteur, en échec ou rejeté notifie son auteur (`NS_EMAIL_FAILED`) ; un e-mail automatique en échec alimente l'alerte technique (AUT-076).

**NOT-011** `[P1]` **Pas de doublon.** Tout envoi automatique porte une clé `Communication.dedupeKey` = `{code du modèle}:{identifiant de l'événement}:{destinataire}`. Si la clé existe déjà, rien n'est créé. Pour un e-mail **regroupé** (NOT-016), la clé désigne l'objet commun, non l'événement. `C_DOC_REJECTED` : un rejet cherche d'abord une ligne `QUEUED` de ce modèle pour le même dossier et s'y rattache, sans rien créer ; sinon il crée la ligne, clé `C_DOC_REJECTED:{dossierId}:{instant du rejet}`, à envoyer dix minutes plus tard. `C_DOC_EXPIRED` : clé `C_DOC_EXPIRED:{dossierId}:{date}` — le premier événement de la nuit crée la ligne, les suivants trouvent la clé. Le contenu est rendu au départ (NOT-012) et liste ce qui est concerné à cet instant ; pour `C_DOC_REJECTED`, les pièces rejetées depuis le `sentAt` de la dernière ligne de ce modèle partie pour ce dossier. `C_DOC_EXPIRING` et `C_FAVORITE_UPDATE` se regroupent autrement : par la fenêtre de leur règle (`dedupeWindowHours`, AUT-031) et par l'envoi quotidien (AUT-062).

**NOT-012** `[P1]` **Rendu.** Le sujet et le corps sont rendus au moment de l'**envoi** (NOT-010), y compris pour un e-mail différé (regroupement, heures calmes), dans la langue du destinataire (TRV-005), avec la version du modèle en vigueur à cet instant (`templateVersion` conservé) et les données du moment. Si un champ dynamique **obligatoire** n'a pas de valeur, l'e-mail n'est pas envoyé : état `FAILED`, raison « Champ manquant : {champ} », alerte technique. Est **obligatoire** au rendu tout champ cité hors de tout bloc `{{#if}}` ou `{{#each}}` ; à l'intérieur d'un tel bloc, un champ sans valeur est simplement omis. `advisor.firstName` et `advisor.displayName` ont toujours une valeur (repli de NOT-050) ; `company.name` a toujours une valeur (`contact.companyName` ne peut pas être vide) ; les autres champs de `company` ne se citent que dans un `{{#if}}`.

**NOT-013** `[P1]` **Hors production**, aucun e-mail ne part vers une adresse réelle : tous sont redirigés vers la boîte de recette définie par la configuration de l'environnement (`MAIL_SANDBOX_RECIPIENT`), avec le destinataire d'origine rappelé en tête de l'objet — `[→ {adresse d'origine}] {objet}` —, sans copie ni copie cachée ; la ligne `Communication` garde l'adresse d'origine dans `toAddress` (ENV-030).

**NOT-014** `[P1]` **Adresse en erreur.** Tant que `Client.emailBouncedAt` est renseigné, aucun e-mail automatique ne part vers ce client — **sauf** les e-mails de compte et de sécurité (modèles système : mot de passe, lien de connexion, confirmation d'un changement d'adresse, code de confirmation) et l'accusé de réception d'une nouvelle demande, qui part à l'adresse que la personne vient de saisir (AUT-007) : un rejet passé ne doit pas empêcher quelqu'un de retrouver l'accès à son espace. Un envoi manuel reste possible après un avertissement (« Cette adresse a rejeté notre dernier e-mail le {date}. »). Traitement du rejet, et ce que voit le client : AUT-071.

**NOT-015** `[P1]` **Suivi des ouvertures et des clics : désactivé par défaut** (`mail.trackOpens`, `mail.trackClicks` = faux, Q-042). Le statut de remise (`DELIVERED`, `BOUNCED`) est toujours suivi. Les e-mails de compte et de sécurité ne sont jamais suivis, quel que soit le réglage. Aucune règle de gestion ne dépend d'une ouverture.

**NOT-016** `[P1]` **Regroupement.** Pour ne pas inonder le destinataire :

| Cas | Règle |
|---|---|
| Pièces demandées | Un seul e-mail `C_DOC_REQUEST` par opération, qui liste toutes les pièces. |
| Pièces rejetées | `C_DOC_REJECTED` part **10 minutes** après le premier rejet et liste les pièces **fournies par le client** rejetées depuis le précédent envoi — un renouvellement rejeté y figure avec la mention « l'actuel reste valable jusqu'au {date} » (CYC-141) ; une pièce fournie par l'équipe, le promoteur ou la banque n'y figure pas (CYC-143). |
| Pièces validées | Pas d'e-mail. Une notification par dossier : « Votre pièce Passeport est validée. », puis « 3 pièces validées » si d'autres validations suivent avant lecture. |
| Pièces expirées, pièces qui expirent bientôt | Un seul e-mail `C_DOC_EXPIRED` par dossier et par nuit ; un seul `C_DOC_EXPIRING` par dossier et par jour ; chacun liste les pièces et leur date de fin de validité (CYC-145). |
| Décision d'une banque | `C_BANK_APPROVED` et `C_BANK_REJECTED` partent à la **publication** de la décision, dix minutes après sa saisie, avec tout ce que le client en lit (CYC-165) ; une décision annulée dans ce délai n'envoie rien et ne montre rien (CYC-169). |
| Pièces reçues (personnel) | Une notification non lue par dossier et par destinataire ; chaque nouveau dépôt en augmente le compteur. |
| Messages | Une notification non lue par fil ; chaque nouveau message en augmente le compteur. E-mail : NOT-017. |
| Biens proposés | Les propositions envoyées dans la même opération font un seul e-mail `C_PROPOSAL_NEW`. |
| Favoris | Un e-mail par jour (AUT-062). |

Une notification regroupée garde le lien vers l'objet commun (le dossier, le fil) et porte son compteur (`Notification.count`). Types regroupés, et eux seuls : `NC_DOC_VALIDATED`, `NS_DOC_RECEIVED`, `NC_MESSAGE_NEW`, `NS_MESSAGE_NEW`. Un nouvel événement cherche la notification **non lue** de ce type pour ce destinataire et cet objet : s'il la trouve, il augmente `count`, avance `updatedAt` — les listes de notifications sont triées sur ce champ : elle remonte en tête —, et l'écran la montre aussitôt, avec le message bref de MSG-043 (événement `notification.created`, API-070) ; sinon, il en crée une. Le titre ne change pas (NOT-031) : dès que `count` dépasse 1, l'écran affiche la forme plurielle, rendue à la création dans `Notification.titlePlural` avec `{n}` laissé en place, `{n}` remplacé par `count` : « {n} pièces de votre dossier sont validées. » (`NC_DOC_VALIDATED`) · « {client} a déposé {n} pièces. » (`NS_DOC_RECEIVED`) · « {n} nouveaux messages de {conseiller}. » (`NC_MESSAGE_NEW`) · « {n} nouveaux messages de {client}. » (`NS_MESSAGE_NEW`).

**NOT-017** `[P1]` **E-mail « nouveau message ».**
- Vers le **client** : si le message du conseiller est encore non lu **10 minutes** après son envoi, `C_NEW_MESSAGE` part, avec les 160 premiers caractères du dernier message et sans pièce jointe. Cet extrait n'est **pas conservé** avec l'e-mail : dans le journal des envois, il est remplacé par « [extrait du message] », comme un lien personnel (COM-041) — lire un message demande `message.read`, pas seulement l'accès au journal. Il en va de même pour `S_NEW_CLIENT_MESSAGE`. Tant que le client n'a pas lu, pas plus d'un e-mail par fil toutes les 60 minutes.
- Vers le **personnel** : si le message du client est encore non lu après **30 minutes ouvrées**, `S_NEW_CLIENT_MESSAGE` part vers le conseiller retenu par NOT-018 (sans conseiller qui puisse agir : vers les `OWNER` et `ADMIN`, comme la notification `NS_MESSAGE_NEW`). Pas plus d'un e-mail par fil toutes les 2 heures.

**NOT-018** `[P1]` **Destinataires internes.** « Le conseiller » d'une notification est `assignedAgentId` de l'objet (dossier, sinon demande, sinon client). S'il est nul, **ou si ce compte ne peut pas agir** — suspendu, supprimé, passé à un rôle qui n'est pas celui d'un conseiller — : tous les comptes actifs des rôles `OWNER` et `ADMIN` la reçoivent, et tous les `AGENT` s'il s'agit d'une demande à prendre. S'il est **absent** (CRM-021) : il la reçoit, et les `OWNER` et `ADMIN` aussi — le doublement vaut pour la notification dans l'application ; l'e-mail éventuel ne part qu'au conseiller. L'auteur d'une action n'est jamais notifié de sa propre action. Un compte suspendu ne reçoit rien. Les rôles `VIEWER` et `SUPPORT` ne reçoivent pas les notifications métier. Ce qui est confié à quelqu'un qui n'est plus là arrive donc toujours à quelqu'un.

**NOT-019** `[P1]` **Temps réel.** Une notification apparaît dans l'application ouverte sans rechargement, en moins de 5 secondes (`06-technique/02`, API-070). Le statut d'un dossier et de ses pièces se met à jour de la même façon sur l'écran ouvert.

---

## 2. Préférences

**NOT-020** `[P1]` Chaque e-mail appartient à un **groupe** (`EmailTemplate.preferenceGroup`). Un e-mail **sans groupe** est un e-mail de service : il part toujours.

Groupes du **client** (écran `03-espace-client/07`, PRO-030) :

| Groupe | Libellé | Contenu | E-mail par défaut |
|---|---|---|---|
| — (service) | « Indispensables » | Compte et sécurité ; accusés de réception, et l'excuse d'un premier contact en retard ; pièces demandées, à refaire, expirées ; accord de transmission ; envoi à la banque et décisions ; rendez-vous confirmé, annulé, et son rappel de la veille ; option et réservation, et l'échéance d'une option ou d'une offre ; inscription à un Café (confirmation, changement, annulation) ; pause et clôture du dossier ; appel manqué ; changement de conseiller ; fichier refusé ; dossier complet ; projection prête ; offre arrivée à échéance ; acquisition finalisée ; demandes concernant vos données | Toujours envoyés |
| `REMINDERS` | « Rappels » | Relances de pièces, pièces bientôt expirées, propositions en attente | Oui |
| `MESSAGES` | « Messages de mon conseiller » | E-mail quand un message attend | Oui |
| `PROJECT_NEWS` | « Nouveautés de mon projet » | Biens proposés, avancement du chantier | Oui |
| `CAFE` | « Le Café » | Rappels avant un Café, suites d'un Café | Oui |
| `ALERTS` | « Alertes et favoris » | Biens correspondant à une alerte, changements sur un favori | Oui |
| `SURVEYS` | « Enquêtes de satisfaction » | Invitations à donner son avis | Oui |
| `NEWS` | « Actualités de Diaspora Patrimoine » | Envois groupés, nouveautés | **Non** : suit le consentement `MARKETING_EMAIL` |

Groupes du **personnel** (écran `04-back-office/01`, BO-070) :

| Groupe | Libellé | E-mail par défaut |
|---|---|---|
| `STAFF_LEADS` | « Nouvelles demandes » | Oui |
| `STAFF_DOSSIERS` | « Activité de mes dossiers » (pièces reçues, réponses aux propositions, messages) | Messages : oui (NOT-017). Le reste : notification seulement. |
| `STAFF_TASKS` | « Tâches » (tâche confiée par un collègue : `S_TASK_ASSIGNED`). Le rappel d'une tâche n'envoie pas d'e-mail (TAC-030). | Oui |
| `STAFF_ALERTS` | « Alertes d'équipe » (délais dépassés : `S_LEAD_SLA_BREACHED`). L'échéance légale `S_GDPR_DUE` n'est dans aucun groupe : elle ne se coupe pas (AUT-075). Les alertes des règles (`NS_RULE_ALERT`) sont des notifications dans l'application, reprises dans le résumé du matin ; elles n'envoient pas d'e-mail. | Oui |
| `STAFF_DIGEST` | « Résumé du matin » | Oui |

**NOT-021** `[P1]` La notification **dans l'application** est toujours créée, quel que soit le réglage : les préférences ne coupent que l'e-mail (et, `[MOB]`, le push). Une relance dont l'e-mail est coupé compte quand même dans les compteurs de relance (AUT-042) : le conseiller est alerté au même moment.

**NOT-022** `[P1]` **Désinscription sans connexion.** Tout e-mail d'un groupe porte, dans son pied, le lien « Gérer mes préférences » (page `/preferences/{jeton}`, jeton signé sans date de fin) et l'en-tête `List-Unsubscribe` à un clic, qui coupe **ce groupe**. Le jeton est décrit plus bas ; `POST /unsubscribe/{jeton}` répond `200` même si le groupe était déjà coupé ; un logiciel de messagerie qui **ouvre** cette adresse au lieu de l'appeler (`GET /unsubscribe/{jeton}`) est renvoyé (`303`) vers la page qui fait la même chose et le dit : `/preferences/{jeton}?arret=1`, ou `/alertes/{jeton}/arreter` pour une alerte (D-097). Signature invalide ou fiche effacée (`gdprErasedAt`) : `410 GONE`. Les préférences tiennent à la fiche, pas à l'adresse : un changement d'adresse ne change pas le jeton. Les alertes et les demandes « Me prévenir » faites sans compte ont leur propre lien de désinscription. Couper `NEWS` enregistre un retrait de consentement (`Consent`, `granted = false`). Le jeton (signé par `LINK_SIGNING_KEY`) porte la fiche (`clientId`) — ou le compte (`userId`) pour le personnel —, le groupe et la ligne `Communication` de l'e-mail : `/preferences/{jeton}` ouvre les préférences de cette fiche ; `POST /unsubscribe/{jeton}` coupe ce groupe et, pour `NEWS`, garde l'e-mail d'origine sur la ligne `Consent` qu'il écrit (`Consent.sourceCommunicationId`). Le jeton d'une fiche absorbée par une fusion vaut pour la fiche conservée (CRM-080). Pour le **personnel**, le lien mène à « Mes préférences », section Notifications (BO-070), après connexion ; il n'apparaît dans ses e-mails, avec l'en-tête à un clic (jeton `userId`), qu'une fois cette section livrée (paquet 5.1). D'ici là, un e-mail de travail n'a pas de lien de préférence : la page sans connexion (EP-27) est celle des clients.

---

## 3. Notifications dans l'application

**NOT-030** `[P1]` **Catalogue.** Colonne « E-mail » : modèle envoyé pour le même événement (par l'effet système, ou par la règle citée).

### 3.1 Vers le client

| Type | Événement | Texte | Lien | E-mail |
|---|---|---|---|---|
| `NC_LEAD_RECEIVED` | `lead.created` ; sur `lead.supplemented`, l'e-mail seul repart, sans nouvelle notification (DEM-024) | « Votre demande est enregistrée. Un conseiller vous contacte {quand} » (`lead.callbackLabel`, NOT-053). Message de contact : « Votre message est bien reçu. Nous vous répondons {quand}. » | Mes intérêts | `C_LEAD_ACK_*` |
| `NC_ADVISOR_ASSIGNED` | `lead.taken`, `dossier.assigned` (premier conseiller) — une seule fois par conseiller (NOT-035) | « {conseiller} suit désormais votre projet. » | Tableau de bord | — |
| `NC_ADVISOR_CHANGED` | `dossier.assigned` (changement) | « Votre conseiller est désormais {conseiller}. » | Tableau de bord | `C_ADVISOR_CHANGED` |
| `NC_PROJECT_QUALIFIED` | `client.qualified` | « Nous avons fait le point sur votre projet. {conseiller} va vous proposer des biens. » | Tableau de bord | — |
| `NC_PROPOSAL_NEW` | `candidate.proposed` | « {conseiller} vous propose un bien. » · « … {n} biens. » | Biens proposés | `C_PROPOSAL_NEW` |
| `NC_CANDIDATE_UNAVAILABLE` | `candidate.unavailable` | « Le bien {titre} n'est plus disponible. » | Mes intérêts | — |
| `NC_SELECTION_CONFIRMED` | `candidate.selected` | « Votre choix est confirmé : {titre}. » | Dossier | — |
| `NC_SELECTION_DECLINED` | `candidate.selection_declined` | « {conseiller} n'a pas pu retenir {titre} : {raison}. » | Mes intérêts | — |
| `NC_SELECTION_WITHDRAWN` | `candidate.unselected` | « {titre} n'est plus votre bien retenu. {conseiller} revient vers vous. » | Mes intérêts | — |
| `NC_PROJECTION_READY` | `simulation.projection_sent` | « Votre projection est prête. » | Simulations | `C_PROJECTION_READY` |
| `NC_DOC_REQUESTED` | `document.requested` (liste du dossier, pièce ajoutée, pièces de la liste d'une banque ; **pas** un complément demandé par une banque, annoncé par `NC_BANK_INFO_REQUESTED`) | « {n} pièces sont à fournir pour votre dossier. » · « Une pièce est à fournir… » · pour la liste d'une banque : « {banque} demande {n} pièces de plus. » | Pièces | `C_DOC_REQUEST` |
| `NC_DOC_VALIDATED` | `document.validated` | « Votre pièce {libellé} est validée. » | Pièces | — |
| `NC_DOC_REJECTED` | `document.rejected`, pièce fournie par le client | « Votre pièce {libellé} est à refaire : {motif}. » · renouvellement : « Votre nouveau document pour {libellé} n'a pas pu être retenu : {motif}. L'actuel reste valable jusqu'au {date}. » | Pièces | `C_DOC_REJECTED` |
| `NC_DOC_EXPIRED` | `document.expired`, pièce fournie par le client | « Votre pièce {libellé} a expiré. Merci de la renouveler. » | Pièces | `C_DOC_EXPIRED` |
| `NC_FILE_REFUSED` | Issue du traitement d'une version déposée par le client (CYC-140), écrite aussitôt ; « le client a quitté l'écran » se lit ainsi : `C_FILE_REFUSED` ne part, deux minutes plus tard, que si la notification est encore non lue — « Mes pièces » marque lues les notifications du dossier (NOT-032, D-097) : dépôt écarté en entier, en partie, ou photos impossibles à réunir (CYC-140) | « Le fichier déposé pour {libellé} a été refusé pour des raisons de sécurité. Déposez-le à nouveau depuis un autre appareil. » · en partie : « Un fichier déposé pour {libellé} a été refusé ; les autres sont bien reçus. Vérifiez qu'il ne manque pas une page. » · photos : « Nous n'avons pas pu lire une de vos photos pour {libellé}. Reprenez-la et déposez à nouveau. » | Pièces | `C_FILE_REFUSED` |
| `NC_DOSSIER_COMPLETE` | `dossier.completed`, sauf quand `NC_CONSENT_NEEDED` la remplace (NOT-035) | « Votre dossier est complet. » | Dossier | `C_DOSSIER_COMPLETE` |
| `NC_CONSENT_NEEDED` | `dossier.completed`, avec financement, accord de transmission non donné | « Votre dossier est complet. Il ne manque que votre accord pour le transmettre à la banque. » | Pièces | (dans `C_DOSSIER_COMPLETE`) |
| `NC_BANK_SUBMITTED` | `submission.submitted` | « Votre dossier est envoyé à {banque}. » | Financement | `C_BANK_SUBMITTED` |
| `NC_BANK_INFO_REQUESTED` | `submission.info_requested` | « {banque} demande un complément. » | Pièces | `C_BANK_INFO_REQUESTED` |
| `NC_BANK_APPROVED` | `submission.approved`, dix minutes après la saisie (CYC-165) | « Bonne nouvelle : {banque} accorde votre financement. » | Financement | `C_BANK_APPROVED` |
| `NC_BANK_REJECTED` | `submission.rejected`, dix minutes après la saisie (CYC-165) | « {banque} n'a pas donné suite à votre demande. » | Financement | `C_BANK_REJECTED` |
| `NC_OFFER_UPDATED` | `submission.offer_updated`, si l'accord est déjà publié (CYC-165) | « L'offre de {banque} a été mise à jour. » · « L'offre de {banque} est prolongée jusqu'au {date}. » | Financement | — |
| `NC_DECISION_CORRECTED` | `submission.decision_reverted`, quand le client avait été prévenu de la décision | « La réponse de {banque} a été corrigée : votre dossier est de nouveau à l'étude. {conseiller} vous explique. » | Financement | — (le conseiller appelle : `R_DECISION_CORRECTED`) |
| `NC_OFFER_EXPIRED` | `submission.offer_expired` | « L'offre de {banque} est arrivée à échéance. » | Financement | `C_OFFER_EXPIRED` |
| `NC_SUBMISSION_WITHDRAWN` | `submission.withdrawn`, soumission déjà envoyée, sauf refus de l'offre par le client (`declinedByClient`, CYC-166) | « Votre demande auprès de {banque} a été retirée. » | Financement | — |
| `NC_ACQUISITION_STARTED` | `dossier.stage_changed` vers `ACQUISITION` | « Conditions acceptées. Place à l'acquisition. » | Dossier | — |
| `NC_ACQUISITION_DONE` | `dossier.won` | « Félicitations : votre acquisition est finalisée. » | Dossier | `C_ACQUISITION_DONE` |
| `NC_DOSSIER_ON_HOLD` | `dossier.put_on_hold` | « Votre projet est en pause. » | Dossier | `C_DOSSIER_ON_HOLD`, si la case « Informer le client » est cochée (PIP-080) |
| `NC_DOSSIER_RESUMED` | `dossier.resumed`, `dossier.reopened` | « Votre projet reprend. » | Dossier | — |
| `NC_DOSSIER_CLOSED` | `dossier.lost` avec `notifyClient` | « Votre dossier {référence} est clôturé. » | Dossier | `C_DOSSIER_CLOSED` |
| `NC_OPTION_PLACED` | `reservation.option_acknowledged` : le promoteur a confirmé qu'il tient le lot (CYC-107) | « Une option est posée sur le lot {lot} jusqu'au {date}. » | Dossier | `C_OPTION_PLACED` |
| `NC_OPTION_EXPIRED` | `reservation.expired`, si l'option avait été confirmée par le promoteur | « L'option sur le lot {lot} a pris fin. » | Dossier | `C_OPTION_EXPIRED` |
| `NC_RESERVATION_CONFIRMED` | `reservation.confirmed` | « Votre réservation du lot {lot} est confirmée. » | Dossier | `C_RESERVATION_CONFIRMED` |
| `NC_RESERVATION_CANCELLED` | `reservation.cancelled` avec `notifyClient` | « La réservation du lot {lot} est annulée. » · pour une option (`wasOption`) : « L'option sur le lot {lot} a pris fin. » | Dossier | `C_RESERVATION_CANCELLED` |
| `NC_DEPOSIT_UPDATE` | `reservation.deposit_refund_due`, `reservation.deposit_settled` | « Acompte de {montant} : remboursement à suivre avec {conseiller}. » · « Acompte remboursé : {montant}. » · « Acompte conservé par le promoteur. » | Mon bien | — |
| `NC_APPOINTMENT_CONFIRMED` | `appointment.confirmed`, `appointment.rescheduled` ; l'e-mail ne part que si le conseiller a choisi d'en envoyer pour ce rendez-vous (`clientNotifiedAt`, TAC-040) | « Rendez-vous confirmé le {date} à {heure}. » | Rendez-vous | `C_APPOINTMENT_CONFIRMED` |
| `NC_APPOINTMENT_CANCELLED` | `appointment.cancelled` par le personnel ou par la clôture du dossier ; l'e-mail, à la même condition, et si la case reste cochée à l'annulation (CYC-080) | « Votre rendez-vous du {date} est annulé. » | Rendez-vous | `C_APPOINTMENT_CANCELLED` |
| `NC_MESSAGE_NEW` | `message.sent` par le personnel | « Nouveau message de {conseiller}. » | Messages | `C_NEW_MESSAGE` (NOT-017) |
| `NC_PROGRAM_UPDATE` `[P1]` | `program.update_published`, pour les clients dont le dossier porte sur ce programme | « Le chantier de {programme} avance : {étape}, {n} %. » | Dossier | `C_PROGRAM_UPDATE` |
| `NC_CAFE_REGISTERED` `[P1]` | `registration.created`, `registration.promoted` | « Votre place au Café du {date} est réservée. » | Mes Cafés | `C_CAFE_REGISTERED`, `C_CAFE_PROMOTED` |
| `NC_CAFE_UPDATED` `[P1]` | `event.updated` | « Le Café du {date} change : {ce qui change}. » | Mes Cafés | `C_CAFE_UPDATED` |
| `NC_CAFE_CANCELLED` `[P1]` | `event.cancelled` | « Le Café du {date} est annulé. » | Mes Cafés | `C_CAFE_CANCELLED` |
| `NC_ALERT_MATCHES` `[P1]` | Envoi d'une alerte (AUT-060) | « {n} nouveaux biens correspondent à votre alerte {libellé}. » | Catalogue filtré | `C_ALERT_MATCHES` |
| `NC_FAVORITE_UPDATE` `[P1]` | AUT-062 | « {titre} : le prix a baissé. » · « … plus que {n} lots. » · « … n'est plus disponible. » | Fiche du bien | `C_FAVORITE_UPDATE` |
| `NC_SURVEY` | Envoi d'une enquête (AUT-065) | « Votre avis compte : 2 minutes pour nous dire comment cela se passe. » | Enquête | `C_SURVEY` |
| `NC_REMINDER` | Toute action `SEND_EMAIL` d'une règle vers un client dont le compte est `ACTIVE`, au moment où l'action s'exécute — que l'e-mail parte, soit retardé (AUT-006, AUT-008) ou soit écarté par une condition d'arrêt (AUT-007, NOT-021), sauf quand l'action est ignorée parce que le modèle est désactivé. Jamais pour un modèle système ni pour un e-mail de compte (`C_ACCOUNT_ACTIVATION_REMINDER`, `C_EMAIL_VERIFICATION`) | Le sujet de l'e-mail | Le chemin du bouton de l'e-mail ; le tableau de bord quand le bouton porte un lien à jeton | (l'e-mail de la règle) |
| `NC_DATA_REQUEST_DONE` | `data_request.completed`, `data_request.rejected` | « Votre demande concernant vos données a été traitée. » · refusée : « Votre demande concernant vos données a reçu une réponse. » | Confidentialité | `C_DATA_REQUEST_DONE` |

Un client **sans compte** ne reçoit que les e-mails : pour lui, les notifications qui n'ont pas d'e-mail (un conseiller affecté, une pièce validée) n'existent pas, et c'est sans gravité — aucune ne lui demande d'agir. Toute notification qui **demande une action** au client a son e-mail.

### 3.2 Vers le personnel

Le lien d'une notification du personnel mène à l'objet qu'elle nomme : la demande, le dossier (sur l'onglet concerné), la soumission, la tâche, la fiche du client ou du partenaire, l'écran des taux. `ADMINS` : les comptes actifs des rôles `OWNER` et `ADMIN` (AUT-033).

| Type | Événement | Destinataires | Texte | E-mail |
|---|---|---|---|---|
| `NS_LEAD_NEW` | `lead.created` — sauf quand la demande rejoint un dossier existant dont le conseiller peut la traiter à temps (`NS_LEAD_ATTACHED` la remplace, NOT-035) | Le conseiller de la demande ; si elle n'est pas affectée : tous les conseillers. Candidature partenaire : `OWNER` et `ADMIN` seulement. | « Nouvelle demande : {nature} – {client}. » · affectée d'office : la même, suivie de « Elle vous est confiée. » · pendant un dossier en cours (CYC-002) : suivie de « {client} a déjà un dossier en cours ({référence}). » | `S_LEAD_NEW` |
| `NS_LEAD_ATTACHED` | `lead.attached` | Conseiller du dossier | « {client} a envoyé une nouvelle demande (dossier {référence}). » | — |
| `NS_LEAD_SUPPLEMENTED` | `lead.supplemented` | Conseiller de la demande ; à défaut, tous les conseillers | « {client} a complété sa demande {référence}. » | — |
| `NS_ASSIGNED` | `lead.taken`, `dossier.assigned`, par un autre que le destinataire — une seule notification quand la demande et son dossier sont confiés ensemble (NOT-035) | Nouveau conseiller | « {auteur} vous a confié {la demande / le dossier} {référence}. » | `S_ASSIGNED` |
| `NS_UNASSIGNED` | `dossier.assigned` | Ancien conseiller | « Le dossier {référence} est désormais suivi par {conseiller}. » | — |
| `NS_DOC_RECEIVED` | `document.received` par le client | Conseiller du dossier | « {client} a déposé une pièce. » · « … {n} pièces. » | — |
| `NS_FILE_REFUSED` | `document.file_infected`, dépôt d'un membre de l'équipe écarté, en entier ou en partie | Le déposant | « Le fichier déposé pour {libellé} a été refusé pour des raisons de sécurité. » | — |
| `NS_CHECKLIST_CHANGED` | `dossier.checklist_reevaluated`, par une action du client (PRO-004, DOS-030) | Conseiller du dossier | « La liste de pièces de {client} a changé : {n} ajoutées, {m} qui ne sont plus exigées. » · avec `applied` faux (`BANK_REVIEW` et au-delà, GED-031) : « La liste de pièces de {client} pourrait changer : réévaluez-la si nécessaire. » | — |
| `NS_DOSSIER_COMPLETE` | `dossier.completed` | Conseiller du dossier | « Le dossier {référence} est complet. » | — |
| `NS_MESSAGE_NEW` | `message.sent` par le client | Conseiller du dossier | « Nouveau message de {client}. » | `S_NEW_CLIENT_MESSAGE` (NOT-017) |
| `NS_CANDIDATE_RESPONSE` | `candidate.interested`, `candidate.declined` par le client | Conseiller du dossier | « {client} est intéressé par {bien}. » · « … a écarté {bien} : {raison}. » | — |
| `NS_APPOINTMENT_CANCELLED` | `appointment.cancelled` par le client | Conseiller du rendez-vous | « {client} a annulé le rendez-vous du {date}. » | `S_APPOINTMENT_CANCELLED` |
| `NS_OPTION_EXPIRED` | `reservation.expired` | Conseiller du dossier | « L'option sur le lot {lot} a expiré. Le lot est de nouveau disponible. » | — |
| `NS_PARTNER_ANSWER` `[P2]` `[P3]` | `partner.answer_received` | Conseiller du dossier ; à défaut `ADMINS` | « {partenaire} a répondu : {geste}. » — suivi de « À relire. » quand la réponse attend sa relecture (ACP-031) | — |
| `NS_PROPERTY_RESERVED` | `property.availability_changed` vers `RESERVED` (CYC-073) | Conseiller de chaque dossier ouvert qui a **retenu** ce bien sans y tenir de lot | « Tous les lots de {titre}, retenu par le dossier {référence}, sont maintenant réservés. » | — |
| `NS_PROPERTY_UNAVAILABLE` | `candidate.unavailable` | Conseiller de chaque dossier concerné | « Le bien {titre} n'est plus disponible (dossier {référence}). » | — |
| `NS_PROPERTY_AVAILABLE` | `property.availability_changed` vers `AVAILABLE`, ou `lot.status_changed` vers `AVAILABLE` sur un bien resté disponible, ou `property.published` d'une fiche qui avait été archivée, si elle a un lot libre (CYC-102, CYC-126) | Conseiller de chaque dossier ouvert ou en pause qui a un candidat vivant sur ce bien — hors le dossier dont l'option ou la réservation vient de prendre fin : son conseiller le sait déjà | « {titre} est de nouveau disponible (dossier {référence}). » | — |
| `NS_LOT_TAKEN` | `lot.status_changed` : un lot visé sans réservation quitte `AVAILABLE` (CYC-102) | Conseiller du dossier qui le visait | « Le lot {lot} visé par le dossier {référence} vient d'être {réservé / vendu / retiré}. » | — |
| `NS_PARTNER_SUSPENDED` | `promoter.status_changed` vers `SUSPENDED` ou `ENDED` | Conseillers des dossiers en cours sur ses biens | Suspension : « Le promoteur {nom} est suspendu. » · fin : « La relation avec le promoteur {nom} est terminée. » ; puis « {n} de vos dossiers sont concernés. » | — |
| `NS_SUBMISSION_DOWNLOADED` | `submission.package_downloaded` (premier téléchargement) | Conseiller du dossier | « {banque} a téléchargé le dossier {référence}. » | — |
| `NS_SHARE_LOCKED` | Lien de partage verrouillé après cinq codes faux | Conseiller du dossier, `ADMINS` ; pour un lien d'export de données : `ADMINS` | « Le lien envoyé à {destinataire} est verrouillé : trop de codes erronés. » | — |
| `NS_OFFER_ACCEPT_WITHDRAWN` | `submission.offer_accept_withdrawn` dont l'auteur est le client (« Je ne suis plus sûr », ou souhait posé sur une autre offre) | Conseiller du dossier | « {client} ne souhaite plus accepter l'offre de {banque} pour le moment. » | — |
| `NS_OFFER_EXPIRED` | `submission.offer_expired` | Conseiller du dossier | « L'offre de {banque} pour le dossier {référence} a expiré. » | — |
| `NS_FEEDBACK_NEW` | `feedback.received`, avis spontané ou signalement | `OWNER`, `ADMIN` | « Nouvel avis de {client}. » · « Erreur signalée sur {bien}. » | — |
| `NS_CAFE_FULL` `[P1]` | Un Café atteint sa capacité | Responsable du Café, `ADMINS` | « Le Café {lieu} du {date} est complet. » | — |
| `NS_TASK_ASSIGNED` | `task.assigned` : une **personne** confie une tâche à quelqu'un d'autre | La personne affectée | « {auteur} vous a confié une tâche : {titre}. » | `S_TASK_ASSIGNED` |
| `NS_TASK_AUTO` | Une règle, ou un effet du système, crée une tâche de priorité `HIGH` ou `URGENT` sans que son destinataire soit déjà notifié du même fait (NOT-035) ; ou une tâche, quelle que soit sa priorité, que personne n'a pu recevoir (AUT-032) | La personne affectée ; tâche non affectée : `ADMINS` | « Nouvelle tâche : {titre}. » | — (les tâches automatiques figurent dans le résumé du matin) |
| `NS_EMAIL_BOUNCED` | `client.email_bounced` | Conseiller du client | « L'adresse e-mail de {client} rejette nos messages. » | — |
| `NS_RATE_STALE` | `exchange_rate.stale` | `ADMINS` | « Le taux {devises} date du {date}. » | — |
| `NS_PARTNER_EXPIRING` | `partner.convention_expiring`, `partner.document_expiring` | `ADMINS` | « La convention de {partenaire} arrive à échéance le {date}. » · « Un document de {partenaire} expire le {date}. » | — |
| `NS_DATA_REQUEST_DUE` | `data_request.due_soon` | `OWNER`, `ADMIN` | « La demande {référence} doit être traitée avant le {date}. » | `S_GDPR_DUE` |
| `NS_TASK_DUE` | `task.due` | La personne affectée | « À faire : {titre}. » | — |
| `NS_EXPORT_READY`, `NS_IMPORT_FINISHED` | `export.ready`, `import.finished` | Le demandeur | « Votre export est prêt. » · « Import terminé : {n} lignes, {s} signalées, {m} en erreur. » | `S_EXPORT_READY` |
| `NS_EMAIL_FAILED` | Un e-mail manuel échoue ou est rejeté | Son auteur | « L'e-mail envoyé à {client} n'a pas pu être remis. » | — |
| `NS_CLIENT_ERASURE` | `data_request.received`, effacement | Conseiller référent du client, s'il ne reçoit pas déjà `NS_DATA_REQUEST_NEW` ; sans copie aux administrateurs s'il est absent : ils ont la leur | « Un client que vous suivez ({référence}) a demandé la suppression de son compte. » · traitée d'office : « … a supprimé son compte. » — la référence, jamais le nom : l'effacement suit | — |
| `NS_DATA_REQUEST_NEW` | `data_request.received` | `OWNER`, `ADMIN` | « Nouvelle demande d'exercice de droits : {type}. » | — |
| `NS_TEAM_CHANGE` | `user.invited`, `user.role_changed`, `user.suspended`, `user.reactivated`, `user.deleted`, `user.recovered` ; pour un compte du personnel : `user.email_changed`, `user.two_factor_changed` par un tiers | `OWNER` ; pour un rétablissement, aussi `ADMIN` (ADM-040) | « {auteur} a {invité / modifié / suspendu / réactivé / supprimé / rétabli} le compte de {nom}. » ({auteur} : « La plateforme » pour un rétablissement, ADM-040) · « L'adresse du compte de {nom} a changé. » · « La double authentification de {nom} a été réinitialisée par {auteur}. » | `S_TEAM_CHANGE` |
| `NS_ELEVATION` | `support.elevation_granted`, `support.elevation_ended` | `OWNER` | « Accès exceptionnel accordé à {nom} jusqu'au {date}. » · « … terminé. » | `S_ELEVATION_GRANTED`, `S_ELEVATION_ENDED` |
| `NS_RULE_ALERT` | Action `NOTIFY_STAFF` d'une règle | Selon la règle | Le titre de l'action | — |
| `NS_EMAIL_COMPLAINT` | `email.complained` sur un e-mail de service (AUT-071) | Conseiller référent du client ; à défaut `ADMINS` | « {client} a signalé un de nos e-mails comme indésirable : c'est le moment de l'appeler. » | — |
| `NS_HOLIDAYS_MISSING` | Le 1er décembre, aucun jour férié mobile saisi pour l'année suivante (PAR-032) | `ADMINS` | « Ajoutez les jours fériés mobiles de {année}. » | — |
| `NS_TECH_ALERT` | AUT-076 | `SUPPORT` | « Alerte technique : {cause}. » | `S_TECH_ALERT` |

**NOT-031** `[P1]` Une notification a un titre (160 caractères), un texte facultatif, un lien, un objet. Le titre est rendu dans la langue du destinataire au moment de la création et n'est plus modifié ensuite, même pour une notification regroupée : sa forme plurielle est rendue en même temps (`titlePlural`), et l'écran choisit d'après `count` (NOT-016).

**NOT-032** `[P1]` **Lecture.** Cliquer une notification l'ouvre et la marque lue. « Tout marquer comme lu » existe. Ouvrir l'objet par un autre chemin marque lues les notifications non lues qui portent sur cet objet. L'**objet** d'une notification (`entityType`, `entityId`) est celui que son lien ouvre : côté client, le **dossier** pour toute notification née d'un événement de dossier (liens Dossier, Pièces, Financement, Mon bien, Biens proposés, Mes intérêts, Rendez-vous), le **fil** pour Messages, la **demande** pour une notification née d'une demande sans dossier ; côté personnel, l'objet que nomme la notification (demande, dossier, soumission, tâche, fiche, fil). Une notification dont le lien mène à une page sans objet (Tableau de bord, Simulations, Mes Cafés, Catalogue filtré, Enquête, Confidentialité) n'en a pas : seul son clic la marque lue. Afficher l'écran d'un objet — pour un dossier, n'importe lequel de ses onglets — appelle `POST …/notifications/read` avec `{entityType, entityId}`, qui marque lues les notifications non lues de cet objet ; une session d'aperçu (ROL-017) ne l'appelle pas. Le compteur de la cloche affiche le nombre de notifications non lues, « 99+ » au-delà de 99.

**NOT-033** `[P1]` Si l'objet d'une notification n'existe plus ou n'est plus accessible au destinataire, le clic affiche « Cet élément n'est plus disponible. » et la notification est marquée lue.

**NOT-035** `[P1]` **Une opération, une notification.** Un même geste émet parfois plusieurs événements. Le destinataire n'est prévenu qu'une fois :

| Geste | Événements | Notification créée |
|---|---|---|
| Une demande arrive et rejoint un dossier | `lead.created`, `lead.attached` | `NS_LEAD_ATTACHED` pour le conseiller du dossier ; pas de `NS_LEAD_NEW`. Si ce conseiller est absent au-delà de l'échéance de premier contact, la demande suit la règle du mode (CRM-020) : `NS_LEAD_NEW` part à celui qui la reçoit, ou à tous les conseillers si elle reste à prendre ; l'absent garde `NS_LEAD_ATTACHED` pour son retour, sans copie aux administrateurs. |
| Une demande est confiée, et son dossier la suit | `lead.taken`, `dossier.assigned` | Une seule `NS_ASSIGNED`, qui cite la demande. Côté client : une seule `NC_ADVISOR_ASSIGNED`. |
| Plusieurs biens sont proposés dans le même envoi | un seul `candidate.proposed` pour l'envoi | Une `NC_PROPOSAL_NEW`, un e-mail (NOT-016). |
| Un complément est demandé par une banque | `submission.info_requested` (les pièces créées n'émettent pas `document.requested`) | `NC_BANK_INFO_REQUESTED` et son e-mail. |
| Le dossier devient complet sans accord de transmission | `dossier.completed` | `NC_CONSENT_NEEDED` seule, qui dit les deux ; pas de `NC_DOSSIER_COMPLETE` ; un seul e-mail. |
| Une demande est affectée d'office à sa création (CRM-020) | `lead.created`, `lead.taken` | Une seule `NS_LEAD_NEW` pour le conseiller désigné (« Nouvelle demande : {nature} – {client}. Elle vous est confiée. ») et un seul e-mail, `S_LEAD_NEW` ; ni `NS_ASSIGNED` ni `S_ASSIGNED`. |
| Une demande arrive pendant un dossier en cours (CYC-002, dernier cas) | `lead.created` | Le référent reçoit `NS_LEAD_NEW` ; l'alerte de `R_LEAD_DURING_DOSSIER` ne s'y ajoute pas pour lui — elle garde son utilité pour un autre destinataire. |
| Un événement notifie quelqu'un par un type de ce catalogue, et une règle **sans délai** lui adresse une alerte ou une tâche pour ce même événement | l'événement | Une seule notification : celle du catalogue, qui ouvre la tâche quand il y en a une ; ni `NS_RULE_ALERT` ni `NS_TASK_AUTO` pour lui. Désactiver la règle ne retire donc jamais la notification du catalogue (AUT-003). Une règle **différée** — relance, délai dépassé — dit autre chose, plus tard : sa notification part normalement (`R_LEAD_NOT_TAKEN`, `R_MESSAGE_UNANSWERED`). Exemples : `NS_OPTION_EXPIRED` et la tâche de `R_OPTION_UNCONFIRMED_ENDED` ; `NS_PROPERTY_UNAVAILABLE` et `R_SELECTED_UNAVAILABLE` ; `NS_CLIENT_ERASURE` et `R_DELETION_REQUESTED` ; `NS_PARTNER_ANSWER` et `R_PARTNER_ANSWER`. |
| Une règle notifie quelqu'un **et** lui crée une tâche | l'événement de la règle | Une seule notification : celle de la règle, qui ouvre la tâche ; pas de `NS_TASK_AUTO` (AUT-032). |

Mécanisme : la clé de la notification (`Notification.dedupeKey`) est faite du type, du destinataire, de l'objet commun et de l'identifiant de la **requête** d'origine, et non de chaque événement. Pour un événement né d'une tâche planifiée, c'est le **passage** de la tâche qui tient lieu de requête : dix pièces qui arrivent à échéance la même nuit dans un dossier font une notification, pas dix. Les remplacements d'un type par un autre sont une table de priorité du code — un type du catalogue l'emporte sur l'alerte d'une règle, qui l'emporte sur `NS_TASK_AUTO` —, appliquée avant toute création : pour un même **événement** — ou les événements d'un même geste que ce tableau réunit —, un même destinataire et un même objet, seul le type retenu existe. Deux événements distincts d'une même requête — une option qui expire, et l'acompte qu'elle laisse à suivre — font deux notifications : ce sont deux faits. L'exécution différée d'une règle est une requête à part. Quand une requête fait naître plusieurs tâches pour la même personne, la notification retenue mène au dossier, où elles figurent toutes. **L'e-mail suit la notification retenue** : celui d'une notification remplacée ne part pas — `S_LEAD_NEW` ne part pas quand `NS_LEAD_ATTACHED` remplace `NS_LEAD_NEW`.

**NOT-034** `[MOB]` **Push.** Chaque notification vers un client peut partir en push sur ses appareils enregistrés, selon `NotificationPreference.pushEnabled` de son groupe. Le texte du push est le titre de la notification, sans montant ni nom de banque (« Du nouveau dans votre dossier. ») quand l'écran verrouillé pourrait l'afficher à un tiers. Détail : `05-phases-ulterieures/03`.

---

## 4. E-mails : catalogue

**NOT-040** `[P1]` « Envoyé par » : **Système** (compte et sécurité, non désactivable) · **Événement** (effet système d'un événement, AUT-001) · **Règle** (règle d'automatisation, avec son code) · **Manuel** (choisi par le personnel). Ce sont les valeurs de `TriggerKind` (`SYSTEM`, `EVENT`, `WORKFLOW`, `MANUAL`) : `EmailTemplate.sentBy` les liste pour chaque modèle, fixé par le code d'après ce catalogue — un modèle qui part de deux façons a deux valeurs (`C_EMAIL_VERIFICATION` : Système et Règle) —, et `Communication.triggeredBy` dit celle qui a produit l'envoi.

**Nom et catégorie des modèles livrés.** Le nom (`EmailTemplate.name`) est le texte de la colonne « Quand », sans ses renvois ; quand cette colonne ne donne qu'un code de règle, c'est le nom de cette règle (`01-domaine/08`, § 5). La description est la colonne « Quand » complète. La catégorie suit la section : 4.1 → `ACCOUNT` ; 4.2 → `LEADS` ; 4.3 → `DOSSIER` ; 4.4 → `FINANCING` pour `C_BANK_*` et `C_OFFER_*`, `DOCUMENTS` pour les autres modèles destinés au client ; 4.5 → `CAFE` ; 4.6 → `ALERTS` pour `C_ALERT_*` et `C_FAVORITE_UPDATE`, `SURVEYS` pour `C_SURVEY*`, `PRIVACY` pour `C_DATA_*` et `C_PREFERENCES_LINK`, `MANUAL` pour `C_MANUAL_*`, `NEWS` pour `C_NEWSLETTER` ; 4.7 → `INTERNAL`. Tout modèle adressé à un partenaire (préfixe `P_`), quelle que soit sa section, → `PARTNERS` ; un modèle `M_` → `MANUAL`.

### 4.1 Compte et sécurité (modèles système)

| Code | Quand | Envoyé par | Groupe |
|---|---|---|---|
| `C_EMAIL_VERIFICATION` | Inscription ; rappel à 24 h (`R_VERIFICATION_REMINDER`) | Système | — |
| `C_WELCOME` | Compte activé ou vérifié pour la première fois | Événement | — |
| `C_ACCOUNT_ACTIVATION` | Compte créé à l'état `INVITED` **sans** qu'un autre e-mail porte déjà le lien d'activation : invitation par l'équipe (CRM-070), inscription sur une fiche existante (AUTH-003). Quand le lien voyage dans un accusé de réception (DEM-021) ou dans le bouton d'un autre e-mail (NOT-024), celui-ci ne part pas. | Système | — |
| `C_ACCOUNT_ACTIVATION_REMINDER` | `R_ACTIVATION_REMINDER` | Règle | — |
| `C_ACTION_CODE` | Code de confirmation d'une action sensible, pour un compte sans mot de passe (AUTH-086) | Système | — |
| `C_ACCOUNT_EXISTS` | Inscription avec une adresse qui a déjà un compte (AUTH-003) ; version « autre espace » : l'adresse d'un compte partenaire ou de l'équipe (D-107) | Système | — |
| `C_PASSWORD_RESET` | « Mot de passe oublié » | Système | — |
| `C_PASSWORD_CHANGED` | Mot de passe modifié | Système | — |
| `C_MAGIC_LOGIN` | « Recevoir un lien de connexion » | Système | — |
| `C_EMAIL_CHANGE_CONFIRM` | Changement d'adresse : vers la **nouvelle** adresse | Système | — |
| `C_EMAIL_CHANGE_NOTICE` | Changement d'adresse : vers l'**ancienne** adresse | Système | — |
| `C_NEW_DEVICE_LOGIN` | Connexion depuis un nouvel appareil | Système | — |
| `C_TWO_FACTOR_CHANGED` | Double authentification activée ou désactivée | Système | — |
| `C_ACCOUNT_DELETED` | Compte supprimé à la demande du client | Système | — |
| `C_ACCOUNT_INACTIVE_NOTICE` | 30 jours avant l'effacement d'un compte inactif (SEC-110) | Système | — |
| `S_INVITATION` | Invitation d'un membre du personnel | Système | — |
| `S_PASSWORD_RESET`, `S_PASSWORD_CHANGED`, `S_NEW_DEVICE_LOGIN`, `S_EMAIL_CHANGE_CONFIRM`, `S_EMAIL_CHANGE_NOTICE`, `S_TWO_FACTOR_CHANGED` | Idem, pour le personnel (changement d'adresse : ADM-030 ; double authentification reconfigurée, nouveaux codes de secours : BO-070) | Système | — |

### 4.2 Demandes

| Code | Quand | Envoyé par | Groupe |
|---|---|---|---|
| `C_LEAD_ACK_INTEREST` | Demande `PROPERTY_INTEREST` | Événement | — |
| `C_LEAD_ACK_PROJECTION` | Demande `PROJECTION_REQUEST` | Événement | — |
| `C_LEAD_ACK_CALLBACK` | Demandes `CALLBACK_REQUEST`, `SIMULATION_FOLLOWUP`, `GUIDED_SEARCH` | Événement | — |
| `C_LEAD_ACK_CONTACT` | Demande `CONTACT_MESSAGE` | Événement | — |
| `P_PARTNER_REQUEST_ACK` | Demande `PARTNER_REQUEST` déposée par « Devenir partenaire » (EP-23, `payload.form = PARTNER_REQUEST`) ; jamais pour une inscription partenaire | Événement | — |
| `P_PARTNER_EMAIL_VERIFICATION` | Inscription d'un partenaire (ACP-082) ; variante « adresse déjà utilisée » (ACP-080) | Système | — |
| `P_PARTNER_APPLICATION_ACK` | Adresse d'une inscription partenaire confirmée : l'espace est ouvert, le dossier est à compléter (ACP-082) | Événement | — |
| `P_PARTNER_INFO_REQUESTED` | `lead.application_info_requested` (ACP-084) | Événement | — |
| `P_PARTNER_APPLICATION_APPROVED` | `lead.application_approved` (ACP-084) ; `action.managerName` est le `displayName` (NOT-050) de l'interlocuteur `accountManagerId` | Événement | — |
| `P_PARTNER_APPLICATION_DECLINED` | `lead.application_declined` (ACP-084) ; `action.note` : la phrase écrite pour la personne, absente sinon | Événement | — |
| `C_CALL_MISSED` | `R_CALL_MISSED` | Règle | — |
| `C_LEAD_DELAYED` | `R_LEAD_SLA_BREACHED` : délai de premier contact dépassé | Règle | — |
| `C_SIMULATION_RESULT` | Le visiteur clique « Recevoir par e-mail » | Événement | — |
| `C_PROJECTION_READY` | Projection envoyée par le conseiller | Événement | — |
| `S_LEAD_NEW` | Nouvelle demande | Événement | `STAFF_LEADS` |
| `S_LEAD_SLA_BREACHED` | `R_LEAD_SLA_BREACHED` | Règle | `STAFF_ALERTS` |
| `S_ASSIGNED` | Demande ou dossier confié | Événement | `STAFF_LEADS` |

### 4.3 Dossier

| Code | Quand | Envoyé par | Groupe |
|---|---|---|---|
| `C_PROPOSAL_NEW` | Biens proposés | Événement | `PROJECT_NEWS` |
| `C_PROPOSAL_REMINDER` | `R_PROPOSAL_REMINDER` | Règle | `REMINDERS` |
| `C_ADVISOR_CHANGED` | Changement de conseiller | Événement | — |
| `C_APPOINTMENT_CONFIRMED` | Rendez-vous confirmé ou déplacé | Événement | — |
| `C_APPOINTMENT_CANCELLED` | Rendez-vous annulé par le personnel | Événement | — |
| `C_APPOINTMENT_REMINDER` | `R_APPOINTMENT_REMINDER` | Règle | — |
| `S_APPOINTMENT_CANCELLED` | Rendez-vous annulé par le client | Événement | `STAFF_DOSSIERS` |
| `C_OPTION_PLACED` | Option confirmée par le promoteur (CYC-107) | Événement | — |
| `C_OPTION_EXPIRING` | `R_OPTION_EXPIRING_CLIENT` | Règle | — |
| `C_OPTION_EXPIRED` | Option expirée | Événement | — |
| `C_RESERVATION_CONFIRMED` | Réservation confirmée | Événement | — |
| `C_RESERVATION_CANCELLED` | Réservation annulée, case cochée | Événement | — |
| `C_PROGRAM_UPDATE` `[P1]` | Point d'avancement du chantier | Événement | `PROJECT_NEWS` |
| `C_ACQUISITION_DONE` | Dossier gagné | Événement | — |
| `C_DOSSIER_CLOSED` | Dossier clôturé, case cochée | Événement | — |
| `C_DOSSIER_ON_HOLD` | Dossier mis en pause, case « Informer le client » cochée (d'office quand le motif est « En attente du client ») | Événement | — |
| `C_NEW_MESSAGE` | Message non lu (NOT-017) | Événement | `MESSAGES` |
| `S_NEW_CLIENT_MESSAGE` | Message non lu (NOT-017) | Événement | `STAFF_DOSSIERS` |

### 4.4 Pièces et financement

| Code | Quand | Envoyé par | Groupe |
|---|---|---|---|
| `C_DOC_REQUEST` | Pièces demandées | Événement | — |
| `C_DOC_REMINDER` | `R_DOC_REMINDER` | Règle | `REMINDERS` |
| `C_DOC_REJECTED` | Pièce à refaire | Événement | — |
| `C_DOC_EXPIRING` | `R_DOC_EXPIRING` | Règle | `REMINDERS` |
| `C_DOC_EXPIRED` | Pièce expirée | Événement | — |
| `C_FILE_REFUSED` | Dépôt refusé par le contrôle de sécurité, en entier ou en partie, ou photos impossibles à réunir, quand le client a quitté l'écran (CYC-140) : deux minutes après la notification `NC_FILE_REFUSED`, si elle est encore non lue (AUT-013) | Événement | — |
| `C_DOSSIER_COMPLETE` | Dossier complet | Événement | — |
| `C_CONSENT_REMINDER` | `R_CONSENT_MISSING` | Règle | — |
| `C_CONSENT_RECORDED` | Accord de transmission enregistré par l'équipe (GED-070) | Système | — |
| `C_CONSENT_WITHDRAWN_RECORDED` | Retrait de l'accord de transmission enregistré par l'équipe (GED-071) | Système | — |
| `C_BANK_SUBMITTED` | Dossier envoyé à une banque | Événement | — |
| `C_BANK_INFO_REQUESTED` | Complément demandé | Événement | — |
| `C_BANK_APPROVED` | Accord | Événement | — |
| `C_BANK_REJECTED` | Refus | Événement | — |
| `C_OFFER_EXPIRING` | `R_OFFER_EXPIRING` | Règle | — |
| `C_OFFER_EXPIRED` | Offre expirée (CYC-167) | Événement | — |
| `P_BANK_SHARE_LINK` | Envoi du lien de téléchargement à la banque | Système | — |
| `P_BANK_SHARE_CODE` | Envoi du code d'accès, dans un second e-mail | Système | — |
| `P_BANK_FOLLOW_UP` | Relance d'une banque | Manuel | — |
| `P_BANK_WITHDRAWAL` | Retrait d'une soumission | Manuel | — |
| `P_PROMOTER_OPTION_REQUEST` | Demande d'option à un promoteur | Manuel | — |
| `P_PROMOTER_VISIT_REQUEST` | Demande de visite à un promoteur | Manuel | — |
| `P_PROMOTER_STOCK_CHECK` | Vérification des disponibilités des programmes d'un promoteur (AUT-079) | Manuel | — |
| `P_PROMOTER_RELEASE` | Lot libéré : une option confirmée ou une réservation a pris fin (ACP-023) | Manuel | — |
| `P_BANK_PRODUCT_CHECK` | Vérification d'un barème (AUT-079) | Manuel | — |
| `P_PARTNER_REQUEST` `[P2]` `[P3]` | Demande faite à un partenaire, quand aucun modèle propre ne la porte (ACP-043) | Système | — |
| `P_PARTNER_ACCESS_CODE` `[P2]` `[P3]` | Code d'accès à une demande envoyée par lien (ACP-041) | Système | — |
| `P_PARTNER_REMINDER` `[P2]` `[P3]` | Relance d'une demande par lien restée sans réponse (ACP-045) | Système | — |

### 4.5 Le Café `[P1]`

| Code | Quand | Envoyé par | Groupe |
|---|---|---|---|
| `C_CAFE_REGISTERED` | Inscription confirmée | Événement | — |
| `C_CAFE_WAITLISTED` | Inscription en liste d'attente | Événement | — |
| `C_CAFE_PROMOTED` | Sortie de liste d'attente | Événement | — |
| `C_CAFE_REGISTRATION_CANCELLED` | Annulation d'une inscription | Événement | — |
| `C_CAFE_UPDATED` | Date, heure ou lieu modifiés | Événement | — |
| `C_CAFE_CANCELLED` | Café annulé | Événement | — |
| `C_CAFE_OPENING` | `R_CAFE_OPENING` | Règle | propre lien de désinscription |
| `C_CAFE_REMINDER_7D` | `R_CAFE_REMINDER_7D` | Règle | `CAFE` |
| `C_CAFE_REMINDER_1D` | `R_CAFE_REMINDER_1D` | Règle | `CAFE` |
| `C_CAFE_THANKS` | `R_CAFE_THANKS` | Règle | `CAFE` |
| `C_CAFE_MISSED` | `R_CAFE_MISSED` | Règle | `CAFE` |

### 4.6 Alertes, enquêtes, données, envois libres

| Code | Quand | Envoyé par | Groupe |
|---|---|---|---|
| `C_ALERT_CONFIRM` `[P1]` | Alerte créée sans compte : confirmation de l'adresse | Système | — |
| `C_ALERT_MATCHES` `[P1]` | AUT-060 | Événement | `ALERTS` |
| `C_ALERT_EXPIRING` `[P1]` | AUT-061 | Événement | `ALERTS` |
| `C_ALERT_MANAGE` `[P1]` | « Recevoir un nouveau lien » pour des alertes déjà confirmées : le lien de gestion de chacune (SFA-035, AUT-013) | Système | — |
| `C_FAVORITE_UPDATE` `[P1]` | AUT-062 | Événement | `ALERTS` |
| `C_SURVEY` | AUT-065 | Événement | `SURVEYS` |
| `C_SURVEY_REMINDER` | AUT-066 | Événement | `SURVEYS` |
| `C_PREFERENCES_LINK` `[P1]` | « Recevoir un nouveau lien » sur la page des préférences d'e-mail (PRO-031, AUT-013) | Système | — |
| `C_DATA_REQUEST_ACK` | Demande d'exercice de droits reçue | Événement | — |
| `C_DATA_EXPORT_READY` | Export des données personnelles prêt, pour une personne qui a un espace | Événement | — |
| `C_DATA_EXPORT_LINK` | Export remis à une personne sans espace : le lien de téléchargement (ADM-063) | Système | — |
| `C_DATA_EXPORT_CODE` | Idem : le code d'accès, dans un second e-mail | Système | — |
| `C_DATA_REQUEST_DONE` | Demande traitée ou refusée | Événement | — |
| `C_MANUAL_BLANK` | Message libre du conseiller | Manuel | — |
| `C_MANUAL_FOLLOW_UP` | « Je reviens vers vous » | Manuel | — |
| `C_NEWSLETTER` | Envoi groupé (COM-070) | Manuel | `NEWS` |

### 4.7 Interne

| Code | Quand | Envoyé par | Groupe |
|---|---|---|---|
| `S_DAILY_DIGEST` | AUT-070 | Événement | `STAFF_DIGEST` |
| `S_TASK_ASSIGNED` | Tâche confiée | Événement | `STAFF_TASKS` |
| `S_EXPORT_READY` | Export prêt | Événement | — |
| `S_TEAM_CHANGE` | ROL-012 | Système | — |
| `S_ELEVATION_GRANTED`, `S_ELEVATION_ENDED` | ROL-016 | Système | — |
| `S_GDPR_DUE` | AUT-075 | Événement | — |
| `S_TECH_ALERT` | AUT-076 | Système | — |

**NOT-041** `[P1]` Les modèles « Système » ont `isSystem = true` : leur texte se modifie, mais ils ne peuvent être ni désactivés ni supprimés. Le sont aussi, bien qu'envoyés par un événement, ceux dont dépend une **promesse faite à l'écran** ou une obligation : les accusés de réception (`C_LEAD_ACK_*`, `P_PARTNER_REQUEST_ACK`, TRV-097), `C_DATA_REQUEST_ACK`, `C_DATA_REQUEST_DONE`, `C_DATA_EXPORT_READY`, et l'alerte d'échéance légale `S_GDPR_DUE` (AUT-075). Tout autre modèle peut être désactivé ; l'effet ou la règle qui l'utilise est alors ignoré et le signale (AUT-007).

Trois rappels d'**échéance** — option (`C_OPTION_EXPIRING`), offre (`C_OFFER_EXPIRING`), rendez-vous (`C_APPOINTMENT_REMINDER`) — sont des e-mails de service, sans groupe : ils préviennent d'une date qui court, que le client veuille ou non des relances, que son dossier soit en pause ou non (AUT-031).

**NOT-042** `[P1]` Le personnel peut **créer** des modèles manuels supplémentaires (code libre préfixé `M_`), pour le public `CLIENT` ou `PARTNER`. Un modèle manuel n'est jamais envoyé par une règle livrée d'origine ; il peut l'être par une règle créée dans le back-office, **à condition de porter un groupe de préférences** (choisi à sa création parmi ceux de NOT-020), ou par un envoi groupé, à condition d'appartenir au groupe `NEWS` : son pied reçoit alors le lien « Gérer mes préférences », et les destinataires qui ont coupé ce groupe ne le reçoivent pas. Sans groupe, un modèle `M_` ne sert qu'à un envoi **individuel**, fait à la main par un conseiller à son client. Un modèle `M_` peut citer les champs de `client`, `advisor`, `company`, `dossier` et `lead` (sa liste `variables`) ; un modèle `M_` du public `PARTNER` ne sert qu'à l'envoi individuel.

**NOT-043** `[P1]` **E-mail manuel.** Le conseiller choisit un modèle, voit l'aperçu rempli, peut modifier le sujet et le corps **pour cet envoi**, joindre jusqu'à cinq fichiers (10 Mo au total ; jamais une pièce du dossier, NOT-008), puis envoie. L'e-mail part au nom de la plateforme, signé du conseiller. Détail : `04-back-office/08`.

---

## 5. Champs dynamiques

**NOT-050** `[P1]` Syntaxe : `{{objet.champ}}`. Conditions : `{{#if objet.champ}} … {{/if}}`, avec au besoin une branche `{{else}}` : `{{#if objet.champ}} … {{else}} … {{/if}}`. Listes : `{{#each documents}} … {{/each}}`. Toute valeur est **échappée**. Un modèle ne peut utiliser que les champs de sa liste `variables` ; l'éditeur refuse l'enregistrement d'un modèle qui en cite un autre.

| Espace | Champs |
|---|---|
| `client` | `firstName`, `lastName`, `fullName`, `phone` (au format international ; absent s'il n'est pas renseigné) |
| `feedback` | `listingErrorKindLabel` (libellé de `ListingErrorKind`), `comment` |
| `advisor` | `displayName` (« Amel K. »), `firstName`, `jobTitle`, `phone`, `photoUrl`. Le conseiller est celui de l'objet de l'e-mail — `assignedAgentId` du dossier, sinon de la demande, sinon de la fiche (NOT-018) —, s'il peut agir. Sans conseiller qui puisse agir, l'e-mail part quand même : `firstName` vaut « votre conseiller » et `displayName` « l'équipe Diaspora Patrimoine » ; `jobTitle`, `phone` et `photoUrl` sont absents. `advisor.firstName` et `advisor.displayName` ont donc toujours une valeur et se citent hors d'un `{{#if}}` ; le moteur met en capitale la première lettre d'un champ qui ouvre une phrase. |
| `lead` | `reference`, `kindLabel`, `createdDate`, `callbackLabel` (NOT-053), `slaLabel` (échéance du premier contact), `agentLabel` |
| `dossier` | `reference`, `stageLabel`, `nextStepLabel` (ECL-021), `url`, `completenessPct`, `isComplete`, `consentMissing` (dossier avec financement dont l'accord de transmission n'est pas donné) |
| `property` | `title`, `reference`, `programName`, `cityRegion`, `priceLabel`, `monthlyLabel`, `imageUrl`, `url` (absent pour une demande qui porte sur un programme sans bien précis) |
| `program` | `name`, `cityRegion`, `url` |
| `promoter` | `name`, `contactName`, `contactPhone` — le promoteur du bien de l'objet (rendez-vous, réservation, dossier) et son contact principal (`isPrimary`) ; le contact absent s'il n'y en a pas. C'est aussi celui que lisent les règles (résolution d'AUT-020). |
| `properties` (liste) | les mêmes champs, pour une proposition, une alerte, une projection ; `properties.count` ; `properties.countLabel` (« un bien », « 3 biens ») |
| `lot` | `reference` |
| `documents` (liste) | `label`, `partyName`, `statusLabel`, `rejectionReasonLabel`, `rejectionNote`, `dueDate` (échéance de dépôt), `expiryDate` (fin de validité), `isRenewal` (la ligne porte sur un renouvellement : l'actuel reste valable, CYC-141) ; `documents.count` ; `documents.first` |
| `bank` | `name` |
| `submission` | `reference`, `offerValidUntil`, `expectedDecisionAt` (réponse attendue de la banque, DOS-051), `otherPendingCount`, `rejectionReason`, `infoRequestNote` |
| `reservation` | `reference`, `optionExpiresAt`, `wasOption` (une option, pas une réservation confirmée) |
| `request` | `bankName` (la banque dont la liste demande ces pièces ; absent sinon) |
| `deposit` | `isPartial` (un fichier refusé, les autres reçus), `isUnreadable` (photos impossibles à réunir) |
| `appointment` | `typeLabel`, `dateLabel`, `timeLabel`, `timezoneLabel`, `location`, `hostLabel` (la personne qui accueille une visite sur place, avec son téléphone : TAC-045 ; absent s'il n'est pas renseigné), `meetingUrl`, `isRescheduled`, `dossierClosed` (annulé par la clôture du dossier), `staffNote` (mot du conseiller à l'annulation) |
| `cafe` | `brandName` (`events.fullBrandName`), `title`, `capacity`, `locationLabel`, `dateLabel`, `timeLabel`, `venueName`, `venueAddress`, `venueNotes`, `url`, `changes`, `cancelReason` |
| `registration` | `seats`, `checkInCode`, `qrCodeUrl`, `manageUrl` |
| `nextCafe` | `locationLabel`, `dateLabel`, `url` (absent s'il n'y a pas de prochain Café) |
| `alert` | `label`, `manageUrl`, `extendUrl`, `resultsUrl`, `totalCount` |
| `survey` | `url`, `intro` |
| `action` | `url` et `expiresLabel` (lien à jeton), `adminUrl` (pour un modèle `S_` : l'adresse back-office de l'objet que nomme son bouton — demande, dossier, fil, rendez-vous, demande d'exercice de droits ; pour `S_ELEVATION_ENDED`, le journal d'audit filtré sur ce compte et sur la période de l'accès), plus les champs **propres à un modèle**, cités dans son texte au § 6 (`deviceLabel`, `roleLabel`, `recipientName`, `code`, `reason`…). Ils figurent dans la liste `variables` du modèle. |
| `message` | `excerpt` (les 160 premiers caractères du dernier message ; un message sans texte : « 1 fichier joint » · « {n} fichiers joints »), `authorFirstName` (prénom de l'auteur du dernier message, qui n'est pas toujours le conseiller, COM-010) |
| `task` | `title`, `dueLabel`, `url` |
| `staff` | `firstName`, `fullName` |
| `actor` | `fullName` (auteur de l'action) |
| `product` | `name` (produit de financement, pour les règles : AUT-020) |
| `partner` | `name` : le nom du promoteur ou de la banque dont parle un événement de partenaire (AUT-020) |
| `partnerDocument` | `label` (document d'un partenaire) |
| `document` | `label` (une pièce seule, objet de l'événement d'une règle) |
| `event` | `data.*` : les données de l'événement déclencheur (AUT-010), pour les titres et textes des actions d'une règle (AUT-036) ; s'y ajoute `data.fileStatusLabel`, le libellé du statut que donne le fichier d'import (`lot.import_conflict`) |
| `rule` | `delayLabel` : le délai de la règle en clair (« 4 h ouvrées », « 3 jours »), pour les titres et textes des actions (AUT-036) |
| `company` | `name` (`contact.companyName`), `phone`, `email`, `whatsappUrl`, `siteUrl` — `name` toujours renseigné ; les autres, chacun absent si son paramètre est vide : un modèle ne les cite que dans un `{{#if}}` |
| `digest` | les listes du résumé du matin (AUT-070) |

**NOT-061** `[P1]` **Format du corps d'un modèle.** Le corps (`EmailTemplate.bodyHtml`, dont le nom est resté) n'est pas du HTML : c'est un **Markdown restreint** mêlé de champs dynamiques (NOT-050). Permis : paragraphes, titres `##` et `###`, `**gras**`, `*italique*`, listes à puces et numérotées, liens `[texte](adresse)` ; rien d'autre — une balise HTML saisie s'affiche telle quelle. S'y ajoutent deux formes propres aux e-mails :
- le **bouton** : `{{button "Libellé" adresse}}`. Un seul bouton est rendu (NOT-004) : plusieurs ne sont permis que dans des branches qui s'excluent (`{{#if}} … {{else}} … {{/if}}`, imbrications comprises), de sorte qu'un seul est jamais rendu ;
- les **blocs**, construits par le code : `{{> properties}}` (liste des biens : photo, titre, ville, prix, mensualité*), `{{> documents}}` (liste des pièces, avec les colonnes que le texte du modèle annonce), `{{> favorites}}` (biens et ce qui a changé), `{{> digest}}` (sections du résumé du matin). L'éditeur les montre comme des étiquettes non modifiables, qu'on peut déplacer ou retirer, jamais créer.

Une adresse, de lien ou de bouton, est un chemin du site qui commence par `/`, un champ (`{{action.url}}`, `{{dossier.url}}/pieces`) ou une adresse `https:`, `mailto:` ou `tel:` ; un chemin devient une adresse complète du site (NOT-007). **Rendu**, dans cet ordre : conditions et listes évaluées, champs remplacés et échappés ; Markdown converti en HTML ; HTML nettoyé par la liste blanche de SEC-060 ; bouton et blocs insérés par l'habillage. La version texte (`bodyText`, quand elle n'est pas saisie) vient du même rendu : liens écrits en clair, bouton sous la forme « Libellé : adresse ». À l'enregistrement, l'éditeur vérifie la syntaxe des conditions, des listes, du bouton et des blocs (COM-051).

**NOT-051** `[P1]` Dates et montants arrivent **déjà formatés** dans la langue et le fuseau du destinataire (TRV-020, TRV-031) : le modèle ne formate rien.

**NOT-053** `[P1]` **`lead.callbackLabel`** — quand la personne sera rappelée, en une expression que la phrase « Un conseiller vous appelle … » complète (avec `preferredChannel` = WhatsApp : « vous écrit sur WhatsApp … » ; e-mail : « vous répond par e-mail … », DEM-011), composée d'après le jour et le moment souhaités (`preferredCallbackDate`, `preferredSlot`), dans le fuseau de la personne :

| Jour souhaité | Moment souhaité | Valeur |
|---|---|---|
| aucun, ou « Dès que possible » | aucun, ou « Peu importe » | « sous 48 h ouvrées » |
| aucun | un moment | « sous 48 h ouvrées, de préférence {le matin} ({heure de votre pays}) » |
| un jour | aucun | « {jeudi 15 octobre} » |
| un jour | un moment | « {jeudi 15 octobre}, de préférence {le matin} ({heure de votre pays}) » |

« 48 h ouvrées » suit le paramètre `sla.firstContactBusinessDays` (2 jours ouvrés → 48 ; 1 → « sous 24 h ouvrées » ; 3 et plus : « sous {n} jours ouvrés »). La même valeur sert à l'écran de confirmation (DEM-023). Elle ne promet jamais « 48 heures » quand la personne a choisi un jour plus lointain (CAL-061). Les demandes où l'on ne choisit pas de jour (projection, message de contact) ont la même expression, sans jour ni moment : « sous 48 h ouvrées ». Aucun texte qui parle d'une demande précise n'écrit ce délai en dur : il passe par cette expression. Les textes de présentation, qui ne parlent d'aucune demande (FIC-052, ACC-081, EDI-011, le glossaire), écrivent « 48 h ouvrées » dans leur texte ; si le paramètre change, l'équipe les met à jour à la main. Dans un e-mail, où l'explication des jours ouvrés n'existe pas (`07-design/03`, § 1), la valeur sans jour choisi se lit « sous 48 h ouvrées (deux jours ouvrés, {jours}) » — « sous 24 h ouvrées (un jour ouvré, {jours}) » pour un jour —, `{jours}` étant tiré de `business.calendar.workdays` comme dans `common.businessDays` (« du lundi au vendredi ») ; « sous {n} jours ouvrés » ne change pas.

**NOT-052** `[P1]` L'éditeur de modèles propose un **aperçu** avec des données d'exemple et un **envoi de test** à l'adresse du membre du personnel connecté. Les **données d'exemple** sont un jeu fixe livré avec le code, qui remplit tous les champs de NOT-050 (une cliente « Karima B. », le conseiller « Amel K. », le dossier DOS-2026-0042, le bien DP-DZ-0142…) ; l'aperçu sur un client ou un dossier réel (COM-051) complète par ces exemples les champs que l'objet ne fournit pas (`appointment`, `submission`, `cafe`, champs `action`). L'**envoi de test** part avec l'objet « [Test] {objet} » et des liens factices qui mènent à l'accueil du site — aucun jeton n'est créé — ; il laisse une ligne `Communication` adressée au membre du personnel (`staffUserId`), avec `triggeredBy = MANUAL` et `test` vrai dans `metadata`. Chaque enregistrement crée une version (`EmailTemplateVersion`) ; on peut revenir à une version précédente.

---

## 6. Textes d'origine des modèles

**NOT-060** `[P1]` Les textes ci-dessous sont les **données de départ**. Ils sont modifiables dans le back-office. Format : **Objet** · corps · **Bouton** → destination. La salutation, la signature et le pied (NOT-004, NOT-006) ne sont pas répétés. Les données de départ les écrivent au format de NOT-061 : la ligne **Bouton** devient l'aide `{{button}}`, et une liste décrite entre parenthèses le bloc correspondant (`{{> properties}}`, `{{> documents}}`, `{{> favorites}}`, `{{> digest}}`). Dans un modèle `S_`, une destination qui nomme un objet (« → la demande », « → le dossier », « → le fil », « → la demande, dans Données personnelles ») s'écrit `{{action.adminUrl}}`.

Les données de départ remplissent aussi, pour chaque modèle, les champs fixés par le code (`01-domaine/05`, § 1.1) :
- `audience` : préfixe `C_` → `CLIENT`, `S_` → `STAFF`, `P_` → `PARTNER` ;
- `category` : la valeur de `EmailTemplateCategory` que donne NOT-040 (« Nom et catégorie des modèles livrés ») ;
- `isSystem` : les modèles « Système » du § 4 et ceux de NOT-041 ; `preferenceGroup` : la colonne « Groupe » du § 4 ;
- `variables` : les champs cités dans son texte, ci-dessous, plus ceux de la salutation et de la signature (NOT-006) ;
- `requiredVariables` : `action.url` quand le bouton y mène, `action.code` quand le texte le cite ;
- `secretVariables` : parmi ses champs, `action.url`, `action.code`, `message.excerpt`, `registration.manageUrl`, `alert.manageUrl`, `alert.extendUrl`, `survey.url`. Tout autre lien qui, au rendu, porte un jeton — un bouton vers l'espace client devenu lien d'activation (NOT-024) — est expurgé de la même façon.

### 6.1 Compte et sécurité

**`C_EMAIL_VERIFICATION`** — **Objet** : Confirmez votre adresse e-mail
Merci d'avoir créé votre espace {{company.name}}. Pour l'ouvrir, confirmez votre adresse. Ce lien est valable 24 heures. Si vous l'ouvrez sur un autre appareil que celui de votre inscription, votre mot de passe vous sera demandé.
**Bouton** : « Confirmer mon adresse » → `{{action.url}}`
Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.

**`C_WELCOME`** — **Objet** : Bienvenue dans votre espace
Votre espace est ouvert. Vous y retrouvez vos intérêts, les biens que nous vous proposons, vos simulations et, le moment venu, votre dossier et ses pièces.
**Bouton** : « Ouvrir mon espace » → `/espace-client`

**`C_ACCOUNT_ACTIVATION`** — **Objet** : Activez votre espace {{company.name}}
{{#if action.fromSignup}}Vous venez de créer votre espace {{company.name}}, et cette adresse nous était déjà connue. Par sécurité, nous vous demandons de choisir votre mot de passe **depuis cet e-mail** : c'est ce qui prouve que cette adresse est bien la vôtre. Ce que vous nous avez déjà confié vous attend dans votre espace.{{else}}Nous avons préparé votre espace personnel. Vous y suivrez votre projet et y déposerez vos pièces en toute sécurité. Choisissez votre mot de passe pour l'activer.{{/if}} Ce lien est valable 7 jours.
**Bouton** : « Activer mon espace » → `{{action.url}}`
`action.fromSignup` : l'e-mail répond à une inscription faite avec une adresse déjà connue (AUTH-003, deuxième et quatrième lignes).

**`C_ACCOUNT_ACTIVATION_REMINDER`** — **Objet** : Votre espace vous attend
Votre dossier avance, et votre espace n'est pas encore activé. Il vous permet de déposer vos pièces et de suivre chaque étape. Voici un nouveau lien, valable 7 jours.
**Bouton** : « Activer mon espace » → `{{action.url}}`

**`C_ACCOUNT_EXISTS`** — **Objet** : Vous avez déjà un espace {{company.name}}
Quelqu'un — sans doute vous — vient de demander à utiliser cette adresse pour un espace {{company.name}}. Vous en avez déjà un avec cette adresse : il suffit de vous connecter. Mot de passe oublié ? Vous pouvez en choisir un nouveau depuis la page de connexion. Si vous vouliez réunir deux espaces, contactez-nous : nous regroupons vos informations.
**Bouton** : « Me connecter » → `/connexion`
Version « autre espace » (`action.otherSpace`, D-107), sans bouton : « Quelqu'un — sans doute vous — vient de demander à utiliser cette adresse pour un espace client {{company.name}}. Cette adresse est déjà celle d'un compte partenaire ou de l'équipe {{company.name}}, et une adresse ne sert qu'à un seul compte : pour créer un espace client, inscrivez-vous avec une autre adresse, ou écrivez-nous. »
Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : rien n'a changé.

**`C_PASSWORD_RESET`** — **Objet** : Réinitialisez votre mot de passe
Vous avez demandé un nouveau mot de passe. Ce lien est valable 1 heure et ne sert qu'une fois.
**Bouton** : « Choisir un nouveau mot de passe » → `{{action.url}}`
Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe actuel reste valable.

**`C_PASSWORD_CHANGED`** — **Objet** : Votre mot de passe a été modifié
Le mot de passe de votre espace vient d'être modifié. Si c'est vous, tout va bien. Sinon, réinitialisez-le tout de suite et contactez-nous.
**Bouton** : « Ce n'est pas moi » → `/mot-de-passe-oublie`

**`C_MAGIC_LOGIN`** — **Objet** : Votre lien de connexion
Voici votre lien pour vous connecter sans mot de passe. Il est valable 15 minutes et ne sert qu'une fois.
**Bouton** : « Me connecter » → `{{action.url}}`

**`C_EMAIL_CHANGE_CONFIRM`** — **Objet** : Confirmez votre nouvelle adresse e-mail
Vous avez demandé à utiliser cette adresse pour votre espace. Confirmez-la : le changement prendra effet aussitôt. Ce lien est valable 24 heures.
**Bouton** : « Confirmer cette adresse » → `{{action.url}}`

**`C_EMAIL_CHANGE_NOTICE`** — **Objet** : Changement d'adresse e-mail demandé
Un changement d'adresse e-mail a été demandé pour votre espace. Tant qu'il n'est pas confirmé depuis la nouvelle adresse, rien ne change. Si vous n'êtes pas à l'origine de cette demande, modifiez votre mot de passe et contactez-nous.
**Bouton** : « Sécuriser mon compte » → `/espace-client/profil/securite`

**`C_NEW_DEVICE_LOGIN`** — **Objet** : Nouvelle connexion à votre espace
Une connexion à votre espace vient d'avoir lieu depuis un nouvel appareil : {{action.deviceLabel}}, le {{action.dateLabel}}. Si c'est vous, vous n'avez rien à faire.
**Bouton** : « Ce n'est pas moi » → `/espace-client/profil/securite`

**`C_TWO_FACTOR_CHANGED`** — **Objet** : La sécurité de votre compte a changé
`action.stateLabel` : « activée » ou « désactivée ».
La double authentification de votre espace vient d'être {{action.stateLabel}}. Si vous n'êtes pas à l'origine de ce changement, modifiez votre mot de passe et contactez-nous.
**Bouton** : « Vérifier ma sécurité » → `/espace-client/profil/securite`

**`C_ACCOUNT_DELETED`** — **Objet** : Votre compte a été supprimé
Comme vous l'avez demandé, votre compte est supprimé et vos données personnelles sont effacées, à l'exception de celles que la loi nous oblige à conserver. Merci de la confiance que vous nous avez accordée.

**`C_ACCOUNT_INACTIVE_NOTICE`** — **Objet** : Souhaitez-vous garder votre espace ?
Vous ne vous êtes pas connecté à votre espace depuis longtemps. Pour protéger vos données, nous l'effacerons le {{action.dateLabel}}. Pour le garder, il suffit de vous connecter avant cette date.
**Bouton** : « Garder mon espace » → `/connexion`

**`C_ACTION_CODE`** — **Objet** : Votre code de confirmation
Pour confirmer l'action que vous venez de demander dans votre espace, saisissez ce code : **{{action.code}}**. Il est valable 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : rien ne change.

**`S_INVITATION`** — **Objet** : Votre invitation sur {{company.name}}
{{#if actor.fullName}}{{actor.fullName}} vous invite à rejoindre l'équipe. {{/if}}Votre rôle sur la plateforme : {{action.roleLabel}}. Choisissez votre mot de passe, puis configurez la double authentification. Ce lien est valable 7 jours.
L'invitation du premier compte Direction, créée à l'installation, et celle d'un rétablissement (ADM-040) n'ont pas d'auteur : `actor` y est vide, et la première phrase absente.
**Bouton** : « Rejoindre l'équipe » → `{{action.url}}`

`S_PASSWORD_RESET`, `S_PASSWORD_CHANGED`, `S_NEW_DEVICE_LOGIN`, `S_EMAIL_CHANGE_CONFIRM`, `S_EMAIL_CHANGE_NOTICE`, `S_TWO_FACTOR_CHANGED` : mêmes textes que leurs équivalents `C_`, avec « votre compte » à la place de « votre espace » et les adresses du back-office (BO-002) : `/espace-client/profil/securite` y devient `/preferences/securite` ; `/mot-de-passe-oublie` garde son chemin, sur l'hôte du back-office.

### 6.2 Demandes

**`C_LEAD_ACK_INTEREST`** — **Objet** : Votre demande pour {{#if property.title}}{{property.title}}{{else}}{{program.name}}{{/if}} est bien reçue
{{#if property.title}}Nous avons bien reçu votre intérêt pour {{property.title}} ({{property.cityRegion}}, réf. {{property.reference}}).{{else}}Nous avons bien reçu votre intérêt pour le programme {{program.name}} ({{program.cityRegion}}). Votre conseiller vous présentera les biens du programme qui correspondent à votre projet.{{/if}} Un conseiller vous contacte {{lead.callbackLabel}} pour faire le point sur votre projet. {{#if company.phone}}L'appel viendra du {{company.phone}} : enregistrez-le pour le reconnaître. {{/if}}Votre demande porte la référence {{lead.reference}}.
**Bouton** : {{#if action.url}}« Activer mon espace » → `{{action.url}}`{{else}}{{#if property.url}}« Revoir ce bien » → `{{property.url}}`{{else}}« Revoir ce programme » → `{{program.url}}`{{/if}}{{/if}}
{{#if action.url}}Votre espace vous permet de suivre votre demande. {{#if property.url}}Revoir ce bien : {{property.url}}{{else}}Revoir ce programme : {{program.url}}{{/if}}{{/if}}{{#if action.hasAccount}}Vous avez déjà un espace : connectez-vous pour y suivre votre demande.{{/if}}

Une demande qui porte sur un programme sans bien précis (DEM-012) n'a pas de champ `property` : le modèle emploie alors `program`. Aucun des deux n'est obligatoire ; l'un des deux est toujours présent.

**`C_LEAD_ACK_PROJECTION`** — **Objet** : Votre projection est en préparation
Merci. Un conseiller prépare votre projection personnalisée : budget, mensualité, solutions de financement et exemples de biens. Vous la recevez {{lead.callbackLabel}}. Référence : {{lead.reference}}.
**Bouton** : « Découvrir les programmes » → `/programmes`
**Espace** (DEM-021, D-097) : {{#if action.url}}second bouton « Activer mon espace » → `{{action.url}}`, puis « Votre espace vous permet de suivre votre demande. »{{/if}}{{#if action.hasAccount}}« Vous avez déjà un espace : connectez-vous pour y suivre votre demande. »{{/if}}

**`C_LEAD_ACK_CALLBACK`** — **Objet** : Votre demande de rappel est bien reçue
Votre demande est enregistrée (référence {{lead.reference}}). Un conseiller vous appelle {{lead.callbackLabel}}. {{#if company.phone}}L'appel viendra du {{company.phone}}.{{/if}}
**Bouton** : « Découvrir les programmes » → `/programmes`
**Espace** (DEM-021, D-097) : {{#if action.url}}second bouton « Activer mon espace » → `{{action.url}}`, puis « Votre espace vous permet de suivre votre demande. »{{/if}}{{#if action.hasAccount}}« Vous avez déjà un espace : connectez-vous pour y suivre votre demande. »{{/if}}

**`C_LEAD_ACK_CONTACT`** — **Objet** : Votre message est bien reçu
Nous avons bien reçu votre message (référence {{lead.reference}}) et vous répondons {{lead.callbackLabel}}.
**Espace** (DEM-021, D-097) : {{#if action.url}}bouton « Activer mon espace » → `{{action.url}}`, puis « Votre espace vous permet de suivre votre demande. »{{/if}}{{#if action.hasAccount}}« Vous avez déjà un espace : connectez-vous pour y suivre votre demande. »{{/if}}

**`P_PARTNER_REQUEST_ACK`** — **Objet** : Votre demande de partenariat est bien reçue
Merci de votre intérêt pour {{company.name}}. Notre équipe étudie votre demande et revient vers vous.

**`P_PARTNER_EMAIL_VERIFICATION`** — **Objet** : Confirmez votre adresse pour votre candidature
Merci de votre candidature au réseau de partenaires de {{company.name}}. Pour que nous puissions l'étudier, confirmez votre adresse. Ce lien est valable 24 heures.
**Bouton** : « Confirmer mon adresse » → `{{action.url}}`
Variante « adresse déjà utilisée » : « Cette adresse est déjà celle d'un compte {{company.name}}. Une adresse ne sert qu'à un seul compte : pour inscrire votre société, utilisez une autre adresse professionnelle, ou écrivez-nous. » (pas de bouton).
Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.

**`P_PARTNER_APPLICATION_ACK`** — **Objet** : Votre espace partenaire est ouvert
Votre adresse est confirmée : votre espace partenaire est ouvert. Il reste une étape : compléter votre dossier (votre activité et un justificatif d'immatriculation ou d'agrément). Vous pouvez le faire en plusieurs fois. Dès qu'il est envoyé, nous l'étudions et vous répondons sous {{action.reviewDaysLabel}}.
**Bouton** : « Compléter mon dossier » → `/partenaires/connexion`

**`P_PARTNER_INFO_REQUESTED`** — **Objet** : Un complément pour votre candidature
Pour poursuivre l'examen de votre candidature, nous avons besoin d'un complément :
{{action.note}}
**Bouton** : « Compléter ma candidature » → `/partenaires/connexion`

**`P_PARTNER_APPLICATION_APPROVED`** — **Objet** : Bienvenue parmi les partenaires de {{company.name}}
Votre candidature est acceptée. Votre interlocuteur, {{action.managerName}}, vous contacte pour préparer la présentation de votre société sur la plateforme. Votre espace partenaire vous attend : il s'enrichira au fil des prochaines étapes.
**Bouton** : « Ouvrir mon espace partenaire » → `/partenaires/connexion`

**`P_PARTNER_APPLICATION_DECLINED`** — **Objet** : Votre candidature
Merci de l'intérêt que vous portez à {{company.name}}. Après examen, votre candidature n'a pas été retenue.{{#if action.note}} {{action.note}}{{/if}} Vous pouvez nous écrire pour en parler.

**`C_CALL_MISSED`** — **Objet** : Nous avons essayé de vous joindre
{{advisor.firstName}} a tenté de vous appeler au sujet de votre projet, sans succès. Dites-nous quand vous êtes disponible : par message dans votre espace{{#if company.whatsappUrl}}, par WhatsApp{{/if}}, ou en répondant à cet e-mail.
**Bouton** : « Proposer un créneau » → `/espace-client/messages`

**`C_LEAD_DELAYED`** — **Objet** : Votre demande {{lead.reference}} n'est pas oubliée
Nous vous avions promis de vous {{#if action.isContactMessage}}répondre{{else}}appeler{{/if}} dans un délai que nous n'avons pas tenu, et nous vous prions de nous en excuser. Votre demande {{lead.reference}} est bien entre nos mains : un conseiller vous contacte au plus vite. {{#if company.phone}}Si vous préférez, appelez-nous au {{company.phone}}{{#if company.whatsappUrl}} ou écrivez-nous sur WhatsApp{{/if}}. {{else}}{{#if company.whatsappUrl}}Si vous préférez, écrivez-nous sur WhatsApp. {{/if}}{{/if}}Vous pouvez aussi simplement répondre à cet e-mail : nous le lisons.
**Bouton** : {{#if company.whatsappUrl}}« Nous écrire sur WhatsApp » → `{{company.whatsappUrl}}`{{/if}}
`action.isContactMessage` : la demande est un message de contact (`CONTACT_MESSAGE`). Sans WhatsApp, l'e-mail n'a pas de bouton.

**`C_SIMULATION_RESULT`** — **Objet** : Votre simulation
Voici le résultat de votre simulation, en pièce jointe. C'est une estimation indicative : un conseiller peut l'affiner avec les banques partenaires.
**Bouton** : « Être rappelé par un conseiller » → `/contact?objet=rappel&simulation={{simulation.id}}` (la simulation est jointe à la demande, DEM-015)

**`C_PROJECTION_READY`** — **Objet** : Votre projection personnalisée est prête
{{advisor.firstName}} a préparé votre projection : votre budget, votre mensualité, et {{properties.count}} biens qui correspondent. Elle est jointe à cet e-mail et disponible dans votre espace.
**Bouton** : « Voir ma projection » → `/espace-client/simulations`

**`S_LEAD_NEW`** — **Objet** : Nouvelle demande : {{lead.kindLabel}} – {{client.fullName}}
Demande {{lead.reference}}, reçue le {{lead.createdDate}}. {{#if property.title}}Bien : {{property.title}}.{{/if}} Premier contact attendu avant le {{lead.slaLabel}}.
**Bouton** : « Ouvrir la demande » → la demande

**`S_LEAD_SLA_BREACHED`** — **Objet** : Délai dépassé : {{client.fullName}} attend un premier contact
La demande {{lead.reference}} n'a pas reçu de premier contact dans le délai prévu. Conseiller : {{lead.agentLabel}}.
**Bouton** : « Ouvrir la demande » → la demande

**`S_ASSIGNED`** — **Objet** : {{actor.fullName}} vous a confié {{action.objectLabel}}
`action.objectLabel` : « la demande {référence} » ou « le dossier {référence} ».
**Bouton** : « Ouvrir » → la demande ou le dossier confié

### 6.3 Dossier

**`C_PROPOSAL_NEW`** — **Objet** : {{advisor.firstName}} vous propose {{properties.countLabel}}
D'après votre projet, {{advisor.firstName}} a sélectionné pour vous {{properties.countLabel}}. {{#if action.advisorMessage}}« {{action.advisorMessage}} »{{/if}} Dites-nous ce que vous en pensez : c'est ce qui nous permet d'affiner.
(liste des biens : photo, titre, ville, prix, mensualité*)
**Bouton** : « Voir les biens proposés » → `/espace-client/biens-proposes`

**`C_PROPOSAL_REMINDER`** — **Objet** : Des biens vous attendent
{{advisor.firstName}} vous a proposé des biens il y a quelques jours. Un coup d'œil suffit pour nous dire s'ils vous plaisent.
**Bouton** : « Voir les biens proposés » → `/espace-client/biens-proposes`

**`C_ADVISOR_CHANGED`** — **Objet** : Votre conseiller change
Votre projet est désormais suivi par {{advisor.displayName}}. Tout votre historique lui a été transmis : vous n'avez rien à refaire.
**Bouton** : « Écrire à {{advisor.firstName}} » → `/espace-client/messages`

**`C_APPOINTMENT_CONFIRMED`** — **Objet** : {{#if appointment.isRescheduled}}Nouvelle date : {{/if}}rendez-vous le {{appointment.dateLabel}} à {{appointment.timeLabel}}
Votre {{appointment.typeLabel}} avec {{advisor.displayName}} est confirmé le {{appointment.dateLabel}} à {{appointment.timeLabel}} ({{appointment.timezoneLabel}}). {{#if appointment.location}}Lieu : {{appointment.location}}.{{/if}} {{#if appointment.hostLabel}}Sur place, vous serez accueilli par {{appointment.hostLabel}}, à qui nous avons communiqué votre nom.{{/if}} {{#if appointment.meetingUrl}}Lien de la visio : {{appointment.meetingUrl}}.{{/if}} Un fichier d'agenda est joint.
**Bouton** : « Voir mon rendez-vous » → `/espace-client/rendez-vous`
Un empêchement ? Prévenez-nous depuis votre espace.

**`C_APPOINTMENT_CANCELLED`** — **Objet** : Votre rendez-vous du {{appointment.dateLabel}} est annulé
{{#if appointment.dossierClosed}}Votre {{appointment.typeLabel}} du {{appointment.dateLabel}} est annulé, votre dossier étant clôturé. Si votre projet reprend, écrivez-nous : nous reprendrons rendez-vous.{{else}}Nous devons annuler votre {{appointment.typeLabel}} du {{appointment.dateLabel}}. {{#if appointment.staffNote}}« {{appointment.staffNote}} » {{/if}}{{advisor.firstName}} vous propose rapidement un autre créneau.{{/if}}
**Bouton** : « Voir mes rendez-vous » → `/espace-client/rendez-vous`

**`C_APPOINTMENT_REMINDER`** — **Objet** : Rappel : rendez-vous demain à {{appointment.timeLabel}}
Votre {{appointment.typeLabel}} avec {{advisor.displayName}} a lieu demain, {{appointment.dateLabel}}, à {{appointment.timeLabel}} ({{appointment.timezoneLabel}}). {{#if appointment.hostLabel}}Sur place, vous serez accueilli par {{appointment.hostLabel}}.{{/if}}
**Bouton** : « Voir mon rendez-vous » → `/espace-client/rendez-vous`

**`S_APPOINTMENT_CANCELLED`** — **Objet** : {{client.fullName}} a annulé le rendez-vous du {{appointment.dateLabel}}
**Bouton** : « Ouvrir le dossier » → le dossier

**`C_OPTION_PLACED`** — **Objet** : Une option est posée sur votre lot
Bonne nouvelle : le lot {{lot.reference}} de {{property.title}} vous est réservé à titre d'option jusqu'au {{reservation.optionExpiresAt}}. Pendant ce délai, personne d'autre ne peut le réserver. Pour transformer cette option en réservation, vous signerez un contrat de réservation avec le promoteur, qui peut demander un acompte ; {{advisor.firstName}} vous en explique le montant, le moyen de paiement et ce qu'il devient si votre projet ne va pas à son terme. Rien ne se verse à {{company.name}}.
**Bouton** : « Suivre mon dossier » → `{{dossier.url}}`

**`C_OPTION_EXPIRING`** — **Objet** : Votre option se termine le {{reservation.optionExpiresAt}}
L'option sur le lot {{lot.reference}} prend fin le {{reservation.optionExpiresAt}}. Pour la transformer en réservation ou la prolonger, contactez {{advisor.firstName}}.
**Bouton** : « Écrire à {{advisor.firstName}} » → `/espace-client/messages`

**`C_OPTION_EXPIRED`** — **Objet** : Votre option a pris fin
L'option sur le lot {{lot.reference}} est arrivée à son terme. Le lot est de nouveau proposé à la vente. Si vous souhaitez toujours ce bien, dites-le à {{advisor.firstName}} : nous vérifions sa disponibilité.
**Bouton** : « Écrire à {{advisor.firstName}} » → `/espace-client/messages`

**`C_RESERVATION_CONFIRMED`** — **Objet** : Votre réservation est confirmée
Le promoteur a confirmé la réservation du lot {{lot.reference}} de {{property.title}}. Prochaine étape : {{dossier.nextStepLabel}}.
**Bouton** : « Suivre mon dossier » → `{{dossier.url}}`

**`C_RESERVATION_CANCELLED`** — **Objet** : {{#if reservation.wasOption}}Votre option a pris fin{{else}}Votre réservation est annulée{{/if}}
{{#if reservation.wasOption}}L'option posée sur le lot {{lot.reference}} a pris fin : ce lot n'est plus retenu pour vous.{{else}}La réservation du lot {{lot.reference}} est annulée.{{/if}} {{advisor.firstName}} reste à votre disposition pour en parler et envisager la suite.
**Bouton** : « Écrire à {{advisor.firstName}} » → `/espace-client/messages`

**`C_PROGRAM_UPDATE`** — **Objet** : Le chantier de {{property.programName}} avance
Nouveau point d'avancement : {{action.stageLabel}}, {{action.percent}} %. {{#if action.note}}{{action.note}}{{/if}}
**Bouton** : « Voir les photos du chantier » → `{{dossier.url}}`

**`C_ACQUISITION_DONE`** — **Objet** : Félicitations, vous êtes propriétaire
L'acte est signé : {{property.title}} est à vous. Toute l'équipe vous félicite et vous remercie de votre confiance. Vos documents restent disponibles dans votre espace.
**Bouton** : « Ouvrir mon espace » → `{{dossier.url}}`

**`C_DOSSIER_CLOSED`** — **Objet** : Votre dossier {{dossier.reference}}
Nous clôturons votre dossier {{dossier.reference}}. Votre espace et vos documents restent accessibles. Votre projet peut reprendre à tout moment : il suffit de nous écrire.
**Bouton** : « Nous écrire » → `/espace-client/messages`

**`C_DOSSIER_ON_HOLD`** — **Objet** : Votre projet est en pause
Votre dossier {{dossier.reference}} est mis en pause{{#if action.waitingClient}} : nous attendons de vos nouvelles pour avancer{{#if action.holdClientNote}} — {{action.holdClientNote}}{{/if}}{{/if}}. {{#if action.holdUntilLabel}}Reprise prévue le {{action.holdUntilLabel}}. {{/if}}Rien n'est perdu : vos pièces et votre historique sont conservés. Pour reprendre, il suffit de nous écrire.
**Bouton** : « Reprendre mon projet » → `/espace-client/messages`
`action.holdClientNote` : `Dossier.holdClientNote` (CYC-031).

**`C_NEW_MESSAGE`** — **Objet** : Nouveau message de {{message.authorFirstName}}
« {{message.excerpt}} »
**Bouton** : « Lire et répondre » → `/espace-client/messages`

**`S_NEW_CLIENT_MESSAGE`** — **Objet** : Message de {{client.fullName}} en attente
« {{message.excerpt}} »
**Bouton** : « Répondre » → le fil, dans la messagerie (EA-70)

### 6.4 Pièces et financement

**`C_DOC_REQUEST`** — **Objet** : Les pièces à fournir pour votre dossier
{{#if request.bankName}}Pour étudier votre dossier, {{request.bankName}} demande {{documents.count}} pièce(s) de plus.{{else}}Pour constituer votre dossier, nous avons besoin de {{documents.count}} pièces.{{/if}} Vous pouvez les déposer depuis votre téléphone, en photo ou en PDF, à votre rythme. Chaque pièce est vérifiée par {{advisor.firstName}}.
(liste : libellé, personne concernée, à fournir avant le)
**Bouton** : « Déposer mes pièces » → `{{dossier.url}}/pieces`
Vos documents sont chiffrés et hébergés dans l'Union européenne.

**`C_DOC_REMINDER`** — **Objet** : Il manque {{documents.count}} pièces à votre dossier
{{#if dossier.isComplete}}Pour l'étude de votre financement, il reste à fournir :{{else}}Votre dossier est complet à {{dossier.completenessPct}} %. Il reste à fournir :{{/if}}
(liste : libellé, personne concernée, statut)
Une difficulté pour obtenir un document ? Répondez à cet e-mail, nous trouverons une solution.
**Bouton** : « Déposer mes pièces » → `{{dossier.url}}/pieces`

**`C_DOC_REJECTED`** — **Objet** : Une pièce est à refaire
Nous avons vérifié vos documents. {{documents.count}} pièce(s) ne peuvent pas être acceptées en l'état :
(liste : libellé — motif — précision du conseiller ; pour un renouvellement : « votre document actuel reste valable jusqu'au {date} »)
Déposez une nouvelle version : elle remplacera celle qui n'a pas été retenue.
**Bouton** : « Remplacer la pièce » → `{{dossier.url}}/pieces`

**`C_DOC_EXPIRING`** — **Objet** : {{documents.count}} pièce(s) à renouveler bientôt
Certaines pièces de votre dossier ne seront bientôt plus valables :
(liste : libellé — personne concernée — valable jusqu'au `expiryDate`)
Pour ne pas retarder votre dossier, déposez dès maintenant une version plus récente : le bouton « Renouveler » de chaque pièce le permet.
**Bouton** : « Renouveler mes pièces » → `{{dossier.url}}/pieces`

**`C_DOC_EXPIRED`** — **Objet** : {{documents.count}} pièce(s) à renouveler
Ces pièces ne sont plus valables :
(liste : libellé — personne concernée — expirée le `expiryDate`)
Merci d'en déposer une version récente pour que votre dossier reste complet.
**Bouton** : « Renouveler mes pièces » → `{{dossier.url}}/pieces`

**`C_FILE_REFUSED`** — **Objet** : Un fichier n'a pas pu être reçu
{{#if deposit.isPartial}}Un des fichiers que vous avez déposés pour « {{documents.first.label}} » a été refusé par notre contrôle de sécurité ; les autres sont bien reçus. Vérifiez qu'il ne manque pas une page, et déposez-la à nouveau.{{else}}{{#if deposit.isUnreadable}}Nous n'avons pas pu lire une des photos déposées pour « {{documents.first.label}} » : le dépôt n'a pas été enregistré. Reprenez la photo et déposez à nouveau.{{else}}Le fichier que vous avez déposé pour « {{documents.first.label}} » a été refusé par notre contrôle de sécurité : il n'a pas été enregistré. Merci de le déposer à nouveau, si possible depuis un autre appareil.{{/if}}{{/if}} Si le problème persiste, répondez à cet e-mail.
**Bouton** : « Déposer à nouveau » → `{{dossier.url}}/pieces`

**`C_DOSSIER_COMPLETE`** — **Objet** : Votre dossier est complet
Toutes vos pièces sont validées. Votre dossier est prêt. {{#if dossier.consentMissing}}Il nous manque une seule chose pour l'envoyer à la banque : **votre accord de transmission**. Il se donne en un clic, dans votre espace.{{else}}Prochaine étape : {{dossier.nextStepLabel}}.{{/if}}
**Bouton** : {{#if dossier.consentMissing}}« Donner mon accord » → `{{dossier.url}}/pieces`{{else}}« Suivre mon dossier » → `{{dossier.url}}`{{/if}}

**`C_CONSENT_REMINDER`** — **Objet** : Votre accord pour transmettre votre dossier
Votre dossier est complet. Pour le soumettre aux banques partenaires, nous avons besoin de votre accord de transmission : il se donne en un clic dans votre espace, et vous pouvez le retirer à tout moment. Une question ? {{advisor.firstName}} vous répond.
**Bouton** : « Donner mon accord » → `{{dossier.url}}/pieces`

**`C_CONSENT_RECORDED`** — **Objet** : Votre accord pour transmettre votre dossier
Comme convenu avec {{advisor.firstName}} le {{action.dateLabel}}, nous avons enregistré votre accord pour transmettre votre dossier aux banques partenaires et au promoteur de votre bien, dont certains sont établis hors de l'Union européenne. Vous pouvez retirer cet accord à tout moment depuis votre espace ; nous ne pourrons alors plus soumettre votre dossier.
**Bouton** : « Voir mes accords » → `/espace-client/profil/confidentialite`
Si vous n'avez pas donné cet accord, répondez à cet e-mail.

**`C_CONSENT_WITHDRAWN_RECORDED`** — **Objet** : Le retrait de votre accord est enregistré
Comme convenu avec {{advisor.firstName}} le {{action.dateLabel}}, nous avons enregistré le retrait de votre accord pour transmettre votre dossier aux banques partenaires et au promoteur de votre bien. Nous ne transmettrons plus votre dossier ; les transmissions déjà faites ne peuvent pas être annulées. Vous pouvez redonner votre accord à tout moment depuis votre espace.
**Bouton** : « Voir mes accords » → `/espace-client/profil/confidentialite`
Si vous n'avez pas demandé ce retrait, répondez à cet e-mail.

**`C_BANK_SUBMITTED`** — **Objet** : Votre dossier est entre les mains de {{bank.name}}
Votre dossier vient d'être transmis à {{bank.name}}. La banque l'étudie{{#if submission.expectedDecisionAt}} ; sa réponse est attendue vers le {{submission.expectedDecisionAt}}. Au-delà, nous la relançons pour vous{{/if}}. Nous suivons sa réponse et vous tenons informé à chaque étape. Vous n'avez rien à faire pour le moment.
**Bouton** : « Suivre mon dossier » → `{{dossier.url}}/financement`

**`C_BANK_INFO_REQUESTED`** — **Objet** : {{bank.name}} demande un complément
Pour poursuivre l'étude de votre dossier, {{bank.name}} a besoin d'éléments complémentaires : {{submission.infoRequestNote}}
(liste des pièces demandées, s'il y en a)
Plus vite ils sont fournis, plus vite la banque répond.
**Bouton** : « Fournir le complément » → `{{dossier.url}}/pieces`

**`C_BANK_APPROVED`** — **Objet** : Bonne nouvelle : votre financement est accordé
{{bank.name}} a donné son accord pour financer votre projet. Les conditions de l'offre sont dans votre espace. {{advisor.firstName}} vous appelle pour vous les présenter. {{#if submission.offerValidUntil}}L'offre est valable jusqu'au {{submission.offerValidUntil}}.{{/if}}
**Bouton** : « Voir l'offre » → `{{dossier.url}}/financement`

**`C_BANK_REJECTED`** — **Objet** : Réponse de {{bank.name}}
{{bank.name}} n'a pas donné suite à votre demande de financement. {{#if submission.rejectionReason}}Raison indiquée par la banque : {{submission.rejectionReason}}. {{/if}}{{#if submission.otherPendingCount}}Votre dossier reste à l'étude auprès de {{submission.otherPendingCount}} autre(s) banque(s).{{else}}Ce n'est pas la fin de votre projet : {{advisor.firstName}} vous appelle pour étudier les autres solutions.{{/if}}
**Bouton** : « Suivre mon dossier » → `{{dossier.url}}/financement`

**`C_OFFER_EXPIRING`** — **Objet** : L'offre de {{bank.name}} expire le {{submission.offerValidUntil}}
L'offre de financement de {{bank.name}} est valable jusqu'au {{submission.offerValidUntil}}. Pour l'accepter ou poser vos questions, contactez {{advisor.firstName}}.
**Bouton** : « Voir l'offre » → `{{dossier.url}}/financement`

**`C_OFFER_EXPIRED`** — **Objet** : L'offre de {{bank.name}} est arrivée à échéance
L'offre de financement de {{bank.name}} n'a pas été acceptée avant sa date limite : elle n'est plus valable. Ce n'est pas la fin de votre projet : {{advisor.firstName}} fait le point avec vous sur la suite — nouvelle offre, autre banque.
**Bouton** : « Suivre mon dossier » → `{{dossier.url}}/financement`

**`P_BANK_SHARE_LINK`** — **Objet** : Dossier de financement {{submission.reference}} – {{company.name}}
Bonjour {{action.recipientName}}, vous trouverez ci-dessous le lien pour télécharger le dossier de financement {{submission.reference}} : sommaire et pièces justificatives. Le lien est valable jusqu'au {{action.expiresLabel}}. Le code d'accès vous parvient dans un second e-mail.
**Bouton** : « Accéder au dossier » → `{{action.url}}`
Ce dossier contient des données personnelles. Merci de ne pas le transférer.

**`P_BANK_SHARE_CODE`** — **Objet** : Code d'accès – dossier {{submission.reference}}
Votre code d'accès au dossier {{submission.reference}} : **{{action.code}}**. Il vous sera demandé à l'ouverture du lien reçu séparément.

**`P_BANK_FOLLOW_UP`** — **Objet** : Dossier {{submission.reference}} – point d'avancement
Bonjour {{action.recipientName}}, nous vous avons transmis le dossier {{submission.reference}} le {{action.submittedDate}}. Pourriez-vous nous indiquer où en est son étude, et s'il vous manque un élément ? Merci d'avance.

**`P_BANK_WITHDRAWAL`** — **Objet** : Dossier {{submission.reference}} – retrait de la demande
Bonjour {{action.recipientName}}, nous vous informons que la demande de financement {{submission.reference}} est retirée. Merci de ne pas poursuivre son étude et de détruire les pièces reçues. Nous vous remercions du temps consacré à ce dossier.

**`P_PROMOTER_OPTION_REQUEST`** — **Objet** : Demande d'option – {{#if property.programName}}lot {{lot.reference}}, {{property.programName}}{{else}}bien {{property.reference}}{{/if}}
Bonjour {{action.recipientName}}, nous souhaitons poser une option sur {{#if property.programName}}le lot {{lot.reference}} du programme {{property.programName}}{{else}}le bien {{property.reference}} ({{property.title}}){{/if}} pour l'un de nos clients, jusqu'au {{action.untilLabel}}. Pouvez-vous nous la confirmer ?
`action.untilLabel` : l'échéance de l'option si elle est déjà posée (`reservation.optionExpiresAt`) ; sinon — cas de la Phase 1, où l'accord du promoteur précède la pose (PIP-050) — la date du jour plus `reservation.optionDays` jours.

**`P_PROMOTER_VISIT_REQUEST`** — **Objet** : Demande de visite – {{property.title}}
Bonjour {{action.recipientName}}, l'un de nos clients souhaite visiter {{property.title}}. Créneaux souhaités : {{action.slotsLabel}}. Pouvez-vous nous confirmer une date ?

**`P_PROMOTER_STOCK_CHECK`** — **Objet** : Vos disponibilités sont-elles à jour ?
Bonjour {{action.recipientName}}, voici ce que nous présentons aujourd'hui pour vos programmes : {{action.lotsLabel}}. Pouvez-vous nous confirmer que ces disponibilités et ces prix sont à jour, ou nous indiquer ce qui a changé ? Merci d'avance.

**`P_PROMOTER_RELEASE`** — **Objet** : {{#if property.programName}}Lot {{lot.reference}}, {{property.programName}} – le lot est libéré{{else}}Bien {{property.reference}} – le bien est libéré{{/if}}
Bonjour {{action.recipientName}}, {{action.reasonLabel}} : vous pouvez remettre en vente {{#if property.programName}}le lot {{lot.reference}} du programme {{property.programName}}{{else}}le bien {{property.reference}} ({{property.title}}){{/if}}. Merci de l'avoir tenu pour notre client.
`action.reasonLabel`, selon la fin de la réservation : option arrivée à échéance → « l'option posée pour notre client est arrivée à échéance » · option annulée → « notre client ne donne pas suite » · dossier clôturé → « le projet de notre client est clos » · réservation confirmée puis annulée → « la réservation de notre client est annulée ».

**`P_PARTNER_REQUEST`** — **Objet** : {{action.requestLabel}}
Bonjour {{action.recipientName}}, nous attendons de votre part : {{action.requestLabel}}. Vous pouvez répondre en ligne, en quelques instants, ou nous appeler.
**Bouton** : « Répondre en ligne » → `{{action.url}}`

**`P_BANK_PRODUCT_CHECK`** — **Objet** : {{bank.name}} – vos conditions sont-elles à jour ?
Bonjour {{action.recipientName}}, nos simulateurs présentent votre offre « {{action.productLabel}} » aux conditions suivantes : {{action.conditionsLabel}}. Pouvez-vous nous confirmer qu'elles sont toujours en vigueur, ou nous indiquer ce qui a changé ? Merci d'avance.
`action.productLabel` : le nom du produit (`BankProduct.name`). `action.conditionsLabel` : « taux {t} % » (« marge {t} % » pour une marge fixe ; avec un barème par durée : « jusqu'à {n} ans : {t} % ; … »), puis « , de {min} à {max} {devise}, sur {durée min} à {durée max} ans, apport minimum {a} %, endettement maximum {e} % », suivis, s'ils sont renseignés, de « , assurance {i} % » et « , frais de dossier {f} ».

**`P_PARTNER_ACCESS_CODE`** — **Objet** : Votre code d'accès – {{company.name}}
Votre code d'accès : **{{action.code}}**. Il vous sera demandé à l'ouverture du lien reçu séparément.

**`P_PARTNER_REMINDER`** — **Objet** : Rappel – {{action.requestLabel}}
Bonjour {{action.recipientName}}, notre demande du {{action.sentDate}} attend toujours votre réponse : {{action.requestLabel}}. Vous pouvez y répondre en ligne, ou nous appeler.
**Bouton** : « Répondre en ligne » → `{{action.url}}`

Aux niveaux 2 et 3 (`00-cadre/06`), les modèles adressés à un partenaire qui portent une demande — `P_PROMOTER_OPTION_REQUEST`, `P_PROMOTER_STOCK_CHECK`, `P_BANK_PRODUCT_CHECK`, `P_BANK_FOLLOW_UP` — reçoivent un bouton « Répondre en ligne » → `{{action.url}}`, affiché seulement quand le lien existe : le texte reste le même au niveau 1, sans bouton. `P_PROMOTER_VISIT_REQUEST` et `P_PROMOTER_RELEASE` n'attendent pas de réponse en ligne : le premier sert à convenir d'une date, par téléphone ou par e-mail ; le second informe.

### 6.5 Le Café

**`C_CAFE_REGISTERED`** — **Objet** : Votre place au Café du {{cafe.dateLabel}} est réservée
C'est noté : {{registration.seats}} place(s) pour {{cafe.brandName}}, {{cafe.dateLabel}}, {{cafe.timeLabel}}.
Lieu : {{#if cafe.venueName}}{{cafe.venueName}}, {{/if}}{{cafe.venueAddress}}.{{#if cafe.venueNotes}} {{cafe.venueNotes}}{{/if}}
Sur place : un promoteur et un banquier répondent à vos questions, autour d'un café. Votre code d'accueil : **{{registration.checkInCode}}** (QR code joint). Un fichier d'agenda est joint.
**Bouton** : « Gérer mon inscription » → `{{registration.manageUrl}}`

**`C_CAFE_WAITLISTED`** — **Objet** : Vous êtes sur la liste d'attente du Café du {{cafe.dateLabel}}
Ce Café est complet. Vous êtes inscrit sur la liste d'attente pour {{registration.seats}} place(s) : dès qu'une place se libère, elle vous est attribuée et nous vous prévenons aussitôt.
**Bouton** : « Gérer mon inscription » → `{{registration.manageUrl}}`

**`C_CAFE_PROMOTED`** — **Objet** : Une place s'est libérée : vous êtes inscrit au Café du {{cafe.dateLabel}}
Bonne nouvelle : vos {{registration.seats}} place(s) sont confirmées pour {{cafe.brandName}}, {{cafe.dateLabel}}, {{cafe.timeLabel}}.
Lieu : {{#if cafe.venueName}}{{cafe.venueName}}, {{/if}}{{cafe.venueAddress}}.{{#if cafe.venueNotes}} {{cafe.venueNotes}}{{/if}}
Sur place : un promoteur et un banquier répondent à vos questions, autour d'un café. Votre code d'accueil : **{{registration.checkInCode}}** (QR code joint). Un fichier d'agenda est joint.
**Bouton** : « Gérer mon inscription » → `{{registration.manageUrl}}`

**`C_CAFE_REGISTRATION_CANCELLED`** — **Objet** : Votre inscription au Café du {{cafe.dateLabel}} est annulée
Votre inscription est annulée. {{#if nextCafe.dateLabel}}Prochain Café : {{nextCafe.locationLabel}}, {{nextCafe.dateLabel}}.{{/if}}
**Bouton** : « Voir les prochains Cafés » → `/le-cafe`

**`C_CAFE_UPDATED`** — **Objet** : Changement pour le Café du {{cafe.dateLabel}}
Le Café auquel vous êtes inscrit change : {{cafe.changes}}. Votre inscription reste valable. Si la nouvelle organisation ne vous convient pas, vous pouvez l'annuler.
**Bouton** : « Gérer mon inscription » → `{{registration.manageUrl}}`

**`C_CAFE_CANCELLED`** — **Objet** : Le Café du {{cafe.dateLabel}} est annulé
Nous sommes désolés : le Café prévu le {{cafe.dateLabel}} à {{cafe.locationLabel}} est annulé. {{cafe.cancelReason}} {{#if nextCafe.dateLabel}}Prochain Café : {{nextCafe.locationLabel}}, {{nextCafe.dateLabel}}.{{/if}}
**Bouton** : « Voir les prochains Cafés » → `/le-cafe`

**`C_CAFE_OPENING`** — **Objet** : Les inscriptions sont ouvertes : Café à {{cafe.locationLabel}} le {{cafe.dateLabel}}
Vous nous avez demandé de vous prévenir. Les inscriptions au prochain Café sont ouvertes : {{cafe.locationLabel}}, {{cafe.dateLabel}}, {{cafe.timeLabel}}. Les places sont limitées.
**Bouton** : « Je m'inscris » → `{{cafe.url}}`

**`C_CAFE_REMINDER_7D`** — **Objet** : Dans une semaine : Le Café à {{cafe.locationLabel}}
Rendez-vous {{cafe.dateLabel}}, {{cafe.timeLabel}}. Pensez à vos questions pour le promoteur et le banquier : budget, financement, délais. Un empêchement ? Libérez votre place pour quelqu'un d'autre.
**Bouton** : « Gérer mon inscription » → `{{registration.manageUrl}}`

**`C_CAFE_REMINDER_1D`** — **Objet** : C'est demain : Le Café à {{cafe.locationLabel}}
À demain, {{cafe.timeLabel}}. Lieu : {{#if cafe.venueName}}{{cafe.venueName}}, {{/if}}{{cafe.venueAddress}}.{{#if cafe.venueNotes}} {{cafe.venueNotes}}{{/if}} Votre code d'accueil : **{{registration.checkInCode}}**.
**Bouton** : « Voir mon inscription » → `{{registration.manageUrl}}`

**`C_CAFE_THANKS`** — **Objet** : Merci d'être venu au Café
Merci de votre présence. Un conseiller vous rappelle dans les prochains jours pour donner suite à vos échanges. En attendant, dites-nous en deux minutes ce que vous avez pensé de ce Café.
**Bouton** : « Donner mon avis » → `{{survey.url}}`

**`C_CAFE_MISSED`** — **Objet** : Nous ne vous avons pas vu au Café
Vous n'avez pas pu venir : ce n'est que partie remise. {{#if nextCafe.dateLabel}}Prochain Café : {{nextCafe.locationLabel}}, {{nextCafe.dateLabel}}.{{/if}} Vous pouvez aussi être rappelé par un conseiller.
**Bouton** : « Voir les prochains Cafés » → `/le-cafe`

### 6.6 Alertes, enquêtes, données, envois libres

**`C_ALERT_CONFIRM`** — **Objet** : Confirmez votre alerte
Vous avez demandé à être prévenu des nouveaux biens correspondant à : {{alert.label}}. Confirmez votre adresse pour activer l'alerte. Ce lien est valable 7 jours.
**Bouton** : « Activer mon alerte » → `{{action.url}}`

**`C_ALERT_MATCHES`** — **Objet** : {{alert.totalCount}} nouveaux biens pour « {{alert.label}} »
(liste de six biens au plus : photo, titre, ville, prix, mensualité*)
**Bouton** : « Voir tous les biens » → `{{alert.resultsUrl}}`
Pied : « Modifier ou arrêter cette alerte » → `{{alert.manageUrl}}`

**`C_ALERT_EXPIRING`** — **Objet** : Votre alerte « {{alert.label}} » se termine bientôt
Votre alerte arrive à échéance dans 15 jours. Si votre recherche est toujours d'actualité, prolongez-la d'un clic.
**Bouton** : « Prolonger mon alerte » → `{{alert.extendUrl}}`

**`C_ALERT_MANAGE`** — **Objet** : Vos alertes de recherche
Voici le lien de chacune de vos alertes : vous pouvez y changer la fréquence des e-mails, mettre l'alerte en pause ou l'arrêter.
(liste : le libellé de chaque alerte confirmée et non arrêtée de l'adresse, lien vers sa page de gestion)

**`C_PREFERENCES_LINK`** — **Objet** : Vos préférences d'e-mail
Voici un nouveau lien pour choisir les e-mails que vous recevez de notre part.
**Bouton** : « Gérer mes préférences » → `{{action.url}}`

**`C_FAVORITE_UPDATE`** — **Objet** : Du nouveau sur vos favoris
(liste : bien — ce qui a changé)
**Bouton** : « Voir mes favoris » → `/espace-client/favoris`

**`C_SURVEY`** — **Objet** : Votre avis en 2 minutes
{{survey.intro}} Vos réponses nous aident à mieux vous accompagner. Elles sont lues par l'équipe.
**Bouton** : « Donner mon avis » → `{{survey.url}}`

**`C_SURVEY_REMINDER`** — **Objet** : Votre avis nous intéresse toujours
Il vous reste quelques jours pour nous donner votre avis. Deux minutes suffisent.
**Bouton** : « Donner mon avis » → `{{survey.url}}`

**`C_DATA_REQUEST_ACK`** — **Objet** : Votre demande concernant vos données est bien reçue
Nous avons bien reçu votre demande ({{action.typeLabel}}, référence {{action.reference}}). Nous y répondons dans un délai d'un mois au plus. Pour protéger vos données, nous pouvons vous demander de confirmer votre identité.

**`C_DATA_EXPORT_READY`** — **Objet** : L'export de vos données est prêt
Vous pouvez télécharger vos données depuis votre espace. Le fichier reste disponible 7 jours.
**Bouton** : « Télécharger mes données » → `/espace-client/profil/confidentialite`

**`C_DATA_EXPORT_LINK`** — **Objet** : Vos données sont prêtes
Comme vous l'avez demandé (référence {{action.reference}}), nous avons préparé une copie de vos données. Vous pouvez la télécharger par le lien ci-dessous, valable jusqu'au {{action.expiresLabel}}. Le code d'accès vous parvient dans un second e-mail.
**Bouton** : « Télécharger mes données » → `{{action.url}}`

**`C_DATA_EXPORT_CODE`** — **Objet** : Votre code d'accès
Votre code pour télécharger vos données (référence {{action.reference}}) : **{{action.code}}**. Il vous sera demandé à l'ouverture du lien reçu séparément.

**`C_DATA_REQUEST_DONE`** — **Objet** : Votre demande concernant vos données{{#if action.rejected}} : notre réponse{{else}} a été traitée{{/if}}
{{#if action.rejected}}Nous ne pouvons pas donner suite à votre demande ({{action.typeLabel}}, référence {{action.reference}}) : {{action.reason}}. Vous pouvez nous répondre pour en parler, ou adresser une réclamation à l'autorité de protection des données.{{else}}Votre demande ({{action.typeLabel}}, référence {{action.reference}}) a été traitée. {{#if action.isErasure}}Vos données ont été effacées. Seules restent, sans servir à rien d'autre, les informations que la loi nous oblige à conserver. {{/if}}{{#if action.note}}{{action.note}}{{/if}}{{/if}}
`action.rejected` : la demande est `REJECTED` ; `action.reason` : son motif (`DataRequest.rejectionReason`) ; `action.isErasure` : la demande traitée est un effacement. `action.note` : le message au demandeur saisi à la clôture « Traitée » (`DataRequest.requesterMessage`, ADM-062) — jamais le compte rendu interne (`outcomeNote`). Une demande retirée par la personne n'envoie rien (CYC-230). Texte à faire relire par le conseil de la cliente (Q-010).

**`C_MANUAL_BLANK`** — **Objet** : (saisi par le conseiller) — corps saisi par le conseiller.

**`C_MANUAL_FOLLOW_UP`** — **Objet** : Où en est votre projet ?
Je reviens vers vous au sujet de votre projet. Avez-vous eu le temps d'y réfléchir ? Je reste à votre disposition pour répondre à vos questions ou organiser un échange.
**Bouton** : « Répondre à {{advisor.firstName}} » → `/espace-client/messages`

**`C_NEWSLETTER`** — **Objet** : (saisi) — corps saisi. Pied obligatoire : lien de désinscription du groupe `NEWS`.

### 6.7 Interne

**`S_DAILY_DIGEST`** — **Objet** : Votre journée du {{digest.dateLabel}}
Sections, chacune masquée si elle est vide : « En retard » · « À faire aujourd'hui » · « Nouvelles tâches » (créées par une règle ou par le système depuis le dernier résumé) · « Alertes » (alertes des règles non lues) · « Demandes à prendre en charge » · « Demandes écartées à vérifier » (administrateurs) · « Tâches à prendre » (administrateurs) · « Pièces à vérifier » · « Rendez-vous du jour » · « Banques à relancer » · « Dossiers en retard » · « Acomptes à suivre ».
**Bouton** : « Ouvrir ma journée » → le tableau de bord ; tant qu'il n'est pas livré, la liste « Mes tâches » (EA-30)

**`S_TASK_ASSIGNED`** — **Objet** : Nouvelle tâche : {{task.title}}
{{actor.fullName}} vous a confié cette tâche. {{#if task.dueLabel}}Échéance : {{task.dueLabel}}.{{/if}}
**Bouton** : « Ouvrir la tâche » → `{{task.url}}`

**`S_EXPORT_READY`** — **Objet** : Votre export est prêt
Le fichier est disponible pendant 24 heures.
**Bouton** : « Télécharger » → Imports et exports (EA-103)

**`S_TEAM_CHANGE`** — **Objet** : Équipe : {{action.summary}}
{{#if actor.fullName}}{{actor.fullName}}{{/if}}{{#if action.isSystem}}La plateforme{{/if}} a {{action.summary}} le {{action.dateLabel}}.
`action.summary`, selon l'événement (`NS_TEAM_CHANGE`) : « invité le compte de {nom} » · « modifié le rôle de {nom} » · « suspendu le compte de {nom} » · « réactivé le compte de {nom} » · « supprimé le compte de {nom} » · « rétabli le compte de {nom} » · « changé l'adresse du compte de {nom} » · « réinitialisé la double authentification de {nom} ». `action.isSystem` est vrai quand l'action n'a pas d'auteur : le rétablissement par la commande d'exploitation (ADM-040).
**Bouton** : « Voir l'équipe » → `/equipe` (BO-002)

**`S_ELEVATION_GRANTED`** — **Objet** : Accès exceptionnel accordé à {{staff.fullName}}
{{actor.fullName}} a accordé à {{staff.fullName}} un accès administrateur jusqu'au {{action.expiresLabel}}. Motif : {{action.reason}}. Toutes les actions faites pendant cette période sont tracées.

**`S_ELEVATION_ENDED`** — **Objet** : Fin de l'accès exceptionnel de {{staff.fullName}}
L'accès administrateur temporaire de {{staff.fullName}} a pris fin. {{action.count}} actions ont été tracées.
`action.count` : le nombre de lignes du journal d'audit écrites par ce compte pendant l'accès.
**Bouton** : « Voir le journal » → Journal d'audit (EA-99), filtré sur ce compte et sur la période de l'accès

**`S_GDPR_DUE`** — **Objet** : Demande {{action.reference}} : 10 jours avant l'échéance légale
La demande d'exercice de droits {{action.reference}} ({{action.typeLabel}}) n'est pas clôturée. Échéance légale : {{action.dueLabel}}.
**Bouton** : « Traiter la demande » → la demande, dans Données personnelles (EA-100)

**`S_TECH_ALERT`** — **Objet** : [Alerte] {{action.cause}}
{{action.details}} Identifiant : {{action.requestId}}.
`action.cause` : la cause d'AUT-076 en clair (« Exécution de règle en échec : R_DOC_REMINDER », « Taux de rejet des e-mails : 6 % sur 24 h ») ; `action.details` : ce qui s'est passé, le nombre d'occurrences dans l'heure et le dernier message d'erreur, sans aucune donnée personnelle ; `action.requestId` : l'identifiant de la requête ou du travail en cause (TRV-111).
