# Espace client — pièces et financement

Écrans **EC-20** (mes pièces), **EC-21** (déposer une pièce), **EC-22** (financement). Ce sont les onglets « Pièces » et « Financement » de « Mon dossier » (ECL-030).

Cycle de vie d'une pièce : CYC-140 à CYC-148. Règles de fichiers : `06-technique/05`. Gestion côté équipe : `04-back-office/07`.

---

## 1. Mes pièces (EC-20)

**DOS-001** `[P1]` **En tête** : la barre de complétude — « Votre dossier est complet à {n} % » · « {x} pièces validées ou non demandées sur {y} » (CAL-055 : une pièce dispensée, que le client lit « Non demandée », compte comme satisfaite ; Q-052) ; pas sur un dossier clôturé (DOS-016) —, puis le bloc « Qui emprunte ? » — « Qui achète ? » sans financement — (DOS-030), puis, si l'accord de transmission n'est pas donné, le bloc DOS-040. Si une information manque pour établir la liste (situation professionnelle ou de résidence d'un emprunteur, GED-020), un bandeau le dit : « Complétez la situation de {prénom} : la liste de ses pièces en dépend. » · « Compléter ».

**DOS-002** `[P1]` **Liste**, groupée :
1. par **personne**, quand le dossier compte plusieurs emprunteurs : « Vous » · « {Prénom}, co-emprunteur » (« co-acquéreur » sur un dossier sans financement, DOS-030) · « {Prénom}, garant » ; puis « Le dossier » pour les pièces communes ;
2. dans chaque groupe, par **catégorie**, dans cet ordre : Identité · Résidence · Situation professionnelle · Revenus · Comptes bancaires · Bien · Financement · Autres.

Un filtre en tête : « À fournir ({n}) » · « En vérification ({n}) » · « Validées ({n}) » · « Toutes ({n}) » (D-099) — un choix à zéro n'est pas proposé, sauf « À fournir » et « Toutes ». Par défaut « À fournir » s'il reste quelque chose à fournir, « Toutes » sinon ; le choix est gardé dans l'adresse (`pieces=`, TRV-101) ; au-delà de huit pièces, une recherche par libellé. Chaque ligne commence par un médaillon dans le ton de son état (DSN-015), toujours à côté de son libellé.

**Disposition** (D-099) : la liste occupe la largeur ; à côté d'elle sur un grand écran (au-dessus ailleurs, dans l'ordre de DOS-001), ce qui la cadre : le message d'encouragement avec la barre de complétude et ses chiffres — « Plus qu'une pièce à déposer » / « Plus que {n} pièces à déposer » · « Une photo nette avec votre téléphone suffit. Déposez-les une à une : nous les vérifions au fur et à mesure. » ; tout déposé : « Toutes vos pièces sont déposées » · « Nous les vérifions une à une. Vous êtes prévenu dès que l'une d'elles est validée, ou s'il faut la refaire. » ; complet : « Votre dossier est complet » · « Toutes les pièces demandées sont validées. Votre conseiller s'occupe de la suite. », avec le médaillon `Celebration` (DSN-073) —, « Qui emprunte ? » avec « Écrire à mon conseiller », l'accord de transmission. « Déposer » et « Voir » s'ouvrent dans un panneau à droite qui laisse la liste visible (plein écran sur téléphone, DOS-010) ; le premier dépôt du client sur un dossier montre le médaillon et « Votre première pièce est déposée ! » (moment `first_document`).

**DOS-003** `[P1]` **Une ligne par pièce** : son libellé ; « facultatif » si elle n'est pas obligatoire ; son statut ; son échéance (« avant le 10 oct. », en rouge si elle est passée) ; un « ? » qui déplie l'aide (`description`) et l'exemple s'il existe ; une action.

| Statut | Libellé | Détail affiché | Action |
|---|---|---|---|
| `PENDING` | « À fournir » | L'échéance. | **Déposer** |
| Contrôle de sécurité en cours | « Vérification de sécurité en cours » | — | — |
| `RECEIVED` | « Reçue, en cours de vérification » | La date du dépôt, le nombre de fichiers. | Voir · Modifier |
| `VALIDATED` | « Validée » | La date ; « valable jusqu'au {date} » si la pièce a une validité à venir. Une validité dépassée sur un dossier en pause, ou déjà parti chez la banque, ne s'affiche pas : rien n'est demandé au client (CYC-145). | Voir |
| `VALIDATED`, renouvellement déposé (`renewalVersion`) | « Validée · nouveau document en cours de vérification » | La date du dépôt. | Voir · Voir le nouveau document · Le remplacer |
| `VALIDATED`, dossier à l'étape des pièces, à moins de `documents.expiryWarningDays` jours de sa fin de validité (CYC-141) | « Validée · à renouveler avant le {date} » | « Ce document ne sera bientôt plus valable. Déposez-en un plus récent : nous le vérifions, l'actuel reste valable d'ici là. » Si un renouvellement vient d'être rejeté, son motif s'affiche : « Votre nouveau document n'a pas été retenu : {motif}. » | Voir · **Renouveler** |
| `REJECTED` | « À refaire » | Le **motif** (libellé de `RejectionReason`) et la précision du conseiller. | **Déposer à nouveau** |
| `EXPIRED` | « Expirée, à renouveler » | « Ce document n'est plus valable depuis le {date}. » | **Déposer une nouvelle version** |
| `WAIVED` | « Non demandée » | Ligne estompée. | — |

**DOS-004** `[P1]` **Pièces fournies par d'autres** (`providedBy` autre que le client : Diaspora Patrimoine, le promoteur, la banque) : dans un groupe à part, « Fournies par nos soins », avec leur statut et, si un fichier existe, « Voir ». Le client ne les dépose pas. Une telle pièce encore attendue (`PENDING`) se lit « En préparation par nos soins » (D-097).

**DOS-005** `[P1]` **Voir.** Le client ouvre et télécharge les fichiers de la **version en cours** de ses pièces (aperçu d'image ou de PDF dans la page) — et, s'il a déposé un renouvellement, ceux de ce nouveau document. Les versions précédentes ne lui sont pas montrées (MOD-351). Chaque ouverture passe par un lien signé de courte durée (MED-030).

**DOS-006** `[P1]` Le client ne peut ni supprimer une pièce de la liste, ni la dispenser, ni toucher à une pièce validée — sauf pour la renouveler quand sa validité arrive à son terme (CYC-141) : « Cette pièce est validée. Pour la modifier, écrivez à votre conseiller. ».

## 2. Déposer une pièce (EC-21)

**DOS-010** `[P1]` « Déposer » ouvre un panneau (plein écran sur téléphone) : le libellé de la pièce, son aide, puis trois façons d'ajouter des fichiers :
- **Choisir des fichiers** (plusieurs à la fois) ;
- **Glisser-déposer**, sur ordinateur ;
- **Prendre une photo**, sur téléphone : on en prend autant qu'il y a de pages, jusqu'à 30 par dépôt.

Conseil affiché : « Document à plat, bien éclairé, les quatre coins visibles, sans reflet. ».

**Les photos d'un dépôt forment un seul document.** Toutes les images d'un même dépôt (photos prises, images choisies) sont réunies par le serveur en **un PDF**, dans l'ordre choisi (MED-032) : un relevé de dix pages photographiées donne un fichier, pas dix. L'écran le dit avant l'envoi : « Vos {n} photos seront réunies en un seul document. ». Les PDF déposés restent des fichiers à part.

**DOS-011** `[P1]` **Contrôles avant l'envoi**, dans le navigateur puis de nouveau par le serveur :

| Contrôle | Limite | Message |
|---|---|---|
| Format | Ceux de la pièce (`acceptedFormats` ; par défaut PDF, JPG, PNG, HEIC) | « Ce format n'est pas accepté. Formats possibles : {liste}. » |
| Taille d'un fichier | `documents.maxFileSizeMb` (15 Mo) | « Ce fichier dépasse 15 Mo. » |
| Nombre de fichiers | `maxFiles` de la pièce, comptés **après** réunion des images : chaque PDF compte pour un, toutes les images du dépôt pour un | « {n} fichiers au maximum pour cette pièce. » |
| Nombre d'images d'un dépôt | 30 | « 30 photos au maximum par dépôt. Pour un document plus long, déposez un PDF. » |
| Fichier vide ou illisible | — | « Ce fichier semble vide ou endommagé. » |
| PDF protégé par un mot de passe | — | « Ce PDF est protégé par un mot de passe. Déposez une version non protégée. » |

Un fichier refusé n'empêche pas les autres. Côté serveur : format et taille, à l'annonce (`415 UNSUPPORTED_FILE_TYPE`, `413 FILE_TOO_LARGE`, API-080) ; fichier vide ou illisible, PDF protégé, à la confirmation (`422 VALIDATION_ERROR`, codes `FILE_UNREADABLE` et `FILE_PASSWORD_PROTECTED`, TRV-064) ; nombre de fichiers et de photos, à la création de la version (`409 CONFLICT_STATE`, raisons `TOO_MANY_FILES` et `TOO_MANY_IMAGES`, API-081).

**DOS-012** `[P1]` **Envoi.** Chaque fichier a sa barre de progression. Avant de valider, le client peut retirer un fichier ou changer l'ordre. Chaque fichier est envoyé et confirmé dès qu'il est choisi (API-080), sans toucher à la pièce ; le bouton « Envoyer {n} fichiers » crée la nouvelle version, avec les fichiers dans l'ordre affiché (API-081). Si un fichier échoue en route : « Réessayer » sur ce fichier seul ; les autres sont gardés. Quitter la page pendant un envoi déclenche « Un envoi est en cours. Quitter quand même ? ».

**DOS-013** `[P1]` **Après l'envoi** : « Merci. Votre pièce est reçue : nous la vérifions. Si quelque chose ne va pas, nous vous écrivons ; sinon, elle passe simplement à « Validée » dans votre espace. » — sans promesse de délai. La pièce affiche « Vérification de sécurité en cours », puis « Reçue » (CYC-140) — pour un renouvellement, « Validée · nouveau document en cours de vérification » (DOS-003). Si un fichier est refusé par le contrôle de sécurité : « Un fichier a été refusé pour des raisons de sécurité. Déposez-le à nouveau depuis un autre appareil. » — la pièce garde son statut précédent si aucun fichier sain ne reste. Le contrôle peut finir après que le client a quitté la page : il est alors prévenu dans son espace et par e-mail (`NC_FILE_REFUSED`, `C_FILE_REFUSED`) — que le dépôt soit écarté en entier ou qu'il y manque un fichier —, pour ne pas croire sa pièce déposée.

**DOS-014** `[P1]` **Modifier un dépôt**, tant que la pièce est `PENDING`, `RECEIVED`, `REJECTED` ou `EXPIRED` (et, pour un renouvellement, `VALIDATED` proche de son terme : seul « Tout remplacer » est alors proposé) :

| Action | Effet |
|---|---|
| Ajouter des fichiers | Nouvelle version = les fichiers en cours + les nouveaux. |
| Retirer un fichier | Nouvelle version = les fichiers en cours, moins celui-ci. Le dernier fichier ne se retire pas : il se remplace. |
| Tout remplacer | Nouvelle version = les nouveaux fichiers seulement. |

Requête : API-081, `mode` = `ADD`, `REMOVE` ou `REPLACE_ALL` ; un renouvellement porte `isRenewal`. Chaque modification crée une version (rien n'est écrasé) et remet la pièce en vérification — sauf un renouvellement, qui se vérifie sans que la pièce cesse d'être validée (CYC-141).

**DOS-015** `[P1]` **Un fichier envoyé dans la messagerie** peut être classé par le conseiller dans une pièce du dossier (GED-050). Le client voit alors la pièce passer à « Reçue », avec la mention « Fichier reçu par message ».

**DOS-016** `[P1]` Le dépôt reste possible quand le dossier est en pause. Il ne l'est plus quand le dossier est clôturé ou gagné : les pièces sont en lecture seule. Quand les fichiers d'un dossier clos ont été supprimés à la fin de leur conservation (SEC-110), la page le dit à la place de la liste — « Les fichiers de ce dossier ont été supprimés le {date}, comme le prévoit notre politique de conservation. » —, jamais « À fournir ». Après l'acquisition, l'équipe peut encore ajouter des documents au dossier (acte signé, procès-verbal de remise des clés, PIP-090) : le client les trouve sous « Fournies par nos soins ».

## 3. Emprunteurs

**DOS-030** `[P1]` **Bloc « Qui emprunte ? »**, en tête de l'onglet Pièces — « Qui achète ? » sur un dossier sans financement, où un co-emprunteur se lit « co-acquéreur » et où il n'y a pas de garant (CYC-041) : une ligne par personne du dossier — « Vous » · « {Prénom Nom}, co-emprunteur » · « {Prénom Nom}, garant » — avec « Modifier », et les boutons « Ajouter un co-emprunteur » et « Ajouter un garant » — sur un dossier sans financement, le seul bouton « Ajouter un co-acquéreur » — tant que les limites de MOD-320 ne sont pas atteintes.

À l'étape `DOCUMENTS`, tant qu'aucune soumission n'a été envoyée, le client peut **ajouter** un co-emprunteur ou un garant : rôle · prénom · nom · lien avec lui (« conjoint », « frère »…) · situation professionnelle (`EmploymentType`) · situation de résidence. À l'enregistrement, les pièces de cette personne s'ajoutent à la liste (GED-030), un message le dit — « {n} pièces ont été ajoutées pour {prénom}. » — et le conseiller est prévenu que la liste a changé (`NS_CHECKLIST_CHANGED`). La ligne « Vous » n'a pas de saisie propre : la situation de l'emprunteur principal est celle du profil (MOD-322), où mène son lien « Modifier ».

**DOS-031** `[P1]` Le client peut **modifier** ces informations — à la livraison 2, le bloc est en lecture seule : ajouter ou modifier une personne arrive avec les vrais dossiers (paquet 4.1, D-097). Il ne peut **retirer** une personne que si aucune de ses pièces n'a de fichier ; sinon : « Pour retirer {prénom} du dossier, écrivez à votre conseiller. » (MOD-321). Après l'envoi à une banque, ces actions sont réservées au conseiller. Une personne dont le traitement est limité à sa demande (`DossierParty.restrictedAt`, ADM-063) : sa ligne est en lecture seule, avec la mention « Informations gelées à la demande de {prénom} ».

**DOS-032** `[P1]` Le co-emprunteur et le garant n'ont pas de compte : c'est le client qui dépose leurs pièces. Avant le premier dépôt pour une autre personne, une case est demandée une fois : « Je confirme avoir l'accord de {prénom} pour transmettre ses documents. ». Elle est enregistrée comme une preuve : une ligne `Consent` de type `PARTY_AUTHORIZATION`, avec la phrase exacte et la personne concernée (`partyId`) — route `POST /client/dossiers/{référence}/parties/{partyId}/authorization` (API-100). Sans cette ligne, aucun paquet contenant les pièces de cette personne ne part chez une banque (CYC-161). Pour une personne dont le traitement est limité, le dépôt est fermé et ses pièces ne partent dans aucun paquet.

## 4. Accord de transmission

**DOS-040** `[P1]` Tant que le consentement `DATA_SHARING_PARTNERS` n'est pas donné, l'onglet Pièces affiche en tête :

> **« Votre accord pour transmettre votre dossier »**
> « Pour réserver votre bien, nous transmettons vos coordonnées et les pièces utiles à la réservation au promoteur du bien retenu. Si vous le financez par un crédit, nous transmettons votre dossier de financement (identité, situation, revenus, pièces) aux banques partenaires que nous sollicitons pour vous. Certains sont établis hors de l'Union européenne, notamment en Algérie. Vous pouvez retirer cet accord à tout moment ; nous ne pourrons alors plus transmettre votre dossier. »
> ☐ « J'accepte la transmission de mon dossier à ces partenaires. » — **Enregistrer**

Le texte est **le même** avec ou sans financement : un seul accord, qui vaut encore si le projet change de mode en cours de route (CYC-041). Sur un dossier sans financement, il n'est ni demandé par une carte « À faire » ni relancé — ces rappels ne valent que pour l'envoi à une banque (ECL-011, `R_CONSENT_MISSING`) ; sans lui, le promoteur ne reçoit que le nom du client, à la réservation (ACP-017).

L'accord n'est pas nécessaire pour déposer des pièces. Il l'est pour qu'un dossier parte chez une banque (CYC-161). Il est enregistré avec la phrase exacte — le texte de l'accord suivi de la phrase de la case (`Consent`, source `dossier:documents`), par `POST /client/dossiers/{référence}/consent` (API-100, D-097). Son retrait se fait dans le profil (PRO-051).

Le client n'a pas à deviner que cet accord est attendu : dès que son dossier est **complet**, une carte « À faire » le lui demande (ECL-011), l'e-mail « Votre dossier est complet » le dit (`C_DOSSIER_COMPLETE`), et une relance part après deux jours ouvrés (`R_CONSENT_MISSING`). Une fois l'accord donné, le bloc devient une ligne : « Accord de transmission donné le {date}. » ; s'il a été recueilli par l'équipe (par téléphone, par e-mail, sur papier : GED-070) : « Accord enregistré par {conseiller} le {date}. » — le client en a été informé par e-mail (`C_CONSENT_RECORDED`) et peut le retirer de la même façon.

## 5. Financement (EC-22)

**DOS-050** `[P1]` Visible à partir de l'étape `DOCUMENTS` quand le dossier prévoit un financement, ou garde une soumission déjà envoyée après être passé « sans financement » (ECL-030). En tête, **« Votre plan de financement »**, si ces données existent : prix du bien — le prix du projet, le même que dans « Mon bien » (MOD-313) — · apport · montant à financer · durée souhaitée. Puis une carte par **soumission envoyée** (les soumissions en préparation ne sont pas montrées), de la plus récente à la plus ancienne.

**DOS-051** `[P1]` **Carte d'une soumission** (Q-019) : le nom de la banque ; le type (« Crédit bancaire » · « Financement islamique ») ; « Envoyé le {date} » ; l'état :

| Statut | Libellé | Détail |
|---|---|---|
| `SUBMITTED` | « Envoyé à la banque » | « La banque a reçu votre dossier. » · si une date de réponse est attendue (`expectedDecisionAt`) : « Réponse attendue vers le {date}. Au-delà, nous la relançons pour vous : vous n'avez rien à faire. » ; une fois cette date passée : « La banque n'a pas encore répondu : nous la relançons{ (dernière relance le {date})}. » — la date de la dernière relance notée (BNK-120) ; sans relance notée, la parenthèse est omise. |
| `UNDER_REVIEW` | « En cours d'étude » | Les phrases de la ligne `SUBMITTED` sur la réponse attendue, sans « La banque a reçu votre dossier. ». |
| `INFO_REQUESTED` | « Complément demandé » | Ce que la banque demande, et le bouton « Fournir le complément » → Pièces. |
| `APPROVED` | « Financement accordé » | DOS-052. |
| `REJECTED` | « Sans suite » | « {banque} n'a pas donné suite à votre demande. » · la raison, seulement si le conseiller a choisi de la communiquer · « D'autres solutions existent : {conseiller} fait le point avec vous. » |
| `WITHDRAWN` | « Demande retirée » | — |
| `EXPIRED` | « Offre expirée » | « L'offre n'a pas été acceptée avant le {date}. » |

Le client ne voit ni le nom de l'interlocuteur de la banque, ni les échanges, ni les notes. Une décision n'apparaît ici qu'à sa **publication** (CYC-165) : d'ici là, la carte garde l'état qu'elle avait.

**DOS-052** `[P1]` **Offre accordée.** Montant accordé · taux (ou marge) · durée · mensualité — celle **écrite sur l'offre** de la banque (CAL-045) · « Offre valable jusqu'au {date} », seulement si la banque a donné une date · les conditions d'octroi · le lien « Voir l'échéancier indicatif » (BNK-134) · le document de l'offre, s'il a été déposé (« Voir l'offre »). Si l'offre a été corrigée ou prolongée après coup (CYC-169) : « Offre mise à jour le {date}. ». Deux boutons :
- **« Je souhaite accepter cette offre »** → fenêtre : « Vous indiquez à {conseiller} que vous souhaitez accepter l'offre de {banque}. Il vous recontacte pour la suite. Cela ne vaut pas signature. » → envoi : le conseiller est notifié (CYC-166) ; la carte affiche « Votre souhait est transmis à {conseiller}, le {date}. » (`acceptRequestedAt`) et le lien « Je ne suis plus sûr » qui le retire, tant que l'acceptation n'est pas enregistrée ; le conseiller en est prévenu (CYC-166). Un dossier n'a qu'un souhait à la fois : le poser sur une autre offre retire celui-ci.
- **« En parler à mon conseiller »** → messagerie (ou son repli, MSG-021).

Une fois l'acceptation enregistrée par le conseiller : « Offre acceptée le {date}. ». Si le conseiller la retire (CYC-166), la carte revient à ses deux boutons.

**DOS-053** `[P1]` Tant qu'aucune soumission n'est envoyée : « Votre dossier n'a pas encore été envoyé à une banque. » · avec un dossier incomplet : « Il le sera dès qu'il sera complet. » · lien « Voir mes pièces ».

**DOS-054** `[P1]` Les mentions TRV-023 et TRV-024 ne s'appliquent pas à une offre réelle. La carte porte à la place : « Conditions communiquées par la banque. Seule l'offre écrite de la banque fait foi. ».
