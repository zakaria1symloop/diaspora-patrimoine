# Espace client — intérêts, biens proposés, visites

Écrans **EC-12** (Mes intérêts), **EC-13** (Biens proposés), **EC-14** (Rendez-vous). C'est l'étape « Qualification et mise en relation » vue par le client : il dit ce qui l'intéresse, son conseiller propose, il répond, il visite, il retient un bien.

Les statuts d'un bien envisagé et leurs transitions : CYC-070 à CYC-073.

---

## 1. Mes intérêts (EC-12)

**INT-001** `[P1]` Deux parties.

**Les biens qui m'intéressent** : les biens envisagés nés d'un intérêt du client (`origin = CLIENT_INTEREST`), plus les biens proposés dès qu'ils n'attendent plus de réponse : marqués comme intéressants, ou qui ont une visite prévue ou faite, ou retenus (statut `INTERESTED`, `VISIT_REQUESTED`, `VISIT_PLANNED`, `VISITED` ou `SELECTED`). Un bien que le conseiller a fait visiter sans attendre la réponse du client s'y trouve donc, avec « Je retiens ce bien ». Une carte par bien : photo, titre, ville, prix et mensualité (CAT-040), la date de l'intérêt, l'**état**, les actions.

**Mes demandes** : les autres demandes envoyées (projection, rappel, contact, recherche guidée, suite de simulation, intérêt pour un programme sans bien précis), en liste : nature, date, état. Y figure aussi tout intérêt qui n'a **pas** créé de bien envisagé — celui envoyé alors qu'un dossier est déjà à la constitution des pièces ou au-delà (CYC-002) —, avec son bien et la mention « Votre conseiller revient vers vous à ce sujet. ». Aucune demande envoyée n'est donc invisible : le lien « Suivre dans mon espace » d'une fiche (FIC-054) mène toujours à une ligne de cette page.

**Listes** (D-099). La carte d'un bien est propre à l'espace, pas celle du catalogue : l'état d'abord, la date, le titre et le lieu, les chiffres qui comptent (prix, mensualité indicative avec son astérisque et sa note sous la liste, TRV-023, surface), le chemin vers « Bien retenu » en trois marques (Intérêt envoyé · Visite · Bien retenu), la promesse en cours, puis **une** action principale (« Voir le bien » ; « Ouvrir mon dossier » pour le bien retenu) et des actions secondaires en texte. « Les biens qui m'intéressent » se filtrent par état — « Tous » · « En attente » · « Visite » · « Retenu » · « Écartés ou indisponibles », avec leurs compteurs —, se trient (« Les plus récents » · « Prix croissant » · « Prix décroissant ») et, au-delà de quatre biens, se cherchent par titre ou ville (TRV-103). « Mes demandes » se filtrent : « Toutes » · « En cours » · « Traitées » ; une demande en cours propose « Écrire à ce sujet ». Ces listes sont bornées (les biens envisagés d'un client, ses cent dernières demandes) : filtrées dans la page, avec les compteurs de la liste complète envoyée par le serveur ; l'état est gardé dans l'adresse (`etat`, `tri`, `q`, `demandes`, TRV-101). Sur un grand écran, « Mes demandes » est à côté des biens. Message d'encouragement (ECL-015) : un bien retenu — « Votre bien est retenu » · « {bien} est le bien de votre dossier. La suite se passe dans « Mon dossier ». » · « Ouvrir mon dossier » ; sinon, des intérêts en attente de premier contact — « Votre intérêt est bien arrivé » · « Vous pouvez continuer à regarder des biens : chaque intérêt envoyé s'ajoute ici. ».

**INT-002** `[P1]` **État d'un bien, tel que le client le lit.**

| Statut (`CandidateStatus`) | Libellé | Précision |
|---|---|---|
| `INTERESTED` | « Intérêt envoyé » | Tant qu'aucun premier contact n'a eu lieu (`firstContactAt` de la demande) : « Un conseiller vous appelle {quand}. », avec l'expression de NOT-053 — la même qu'à l'écran de confirmation et dans l'accusé de réception (DEM-008) ; délai dépassé : ECL-035. |
| `INTERESTED`, choix en attente (`selectionRequestedAt`) | « Choix envoyé à votre conseiller » | |
| `INTERESTED`, choix non confirmé par le conseiller (CYC-071) | « Intérêt envoyé » | « {conseiller} n'a pas pu retenir ce bien : {raison}. », jusqu'au prochain changement d'état. |
| `SELECTED`, bien entièrement réservé par d'autres dossiers, sans lot tenu pour celui-ci (CYC-073) | « Bien retenu » | « Tous les lots sont réservés pour le moment. {conseiller} vous tient informé. » |
| `INTERESTED`, bien entièrement réservé (CYC-073) | « Réservé pour le moment » | « Tous les lots sont réservés pour le moment. {conseiller} vous prévient si l'un d'eux se libère. » Pas de « Je retiens ce bien ». |
| Tout statut, fiche hors ligne (CYC-121) | (le libellé du statut) | Mention « Fiche en cours de mise à jour ». « Je retiens ce bien » attend la remise en ligne. |
| `VISIT_REQUESTED` | « Visite demandée » | « Votre conseiller confirme le créneau. » |
| `VISIT_PLANNED` | « Visite le {date} » | Si la visite est annulée ou manquée, le bien revient à « Intérêt envoyé » : le client peut de nouveau le retenir, l'écarter ou reprendre rendez-vous (CYC-070). |
| `VISITED` | « Visité » | |
| `SELECTED` | « Bien retenu » | Lien « Ouvrir mon dossier ». |
| `DECLINED` | « Écarté » | Bouton « Finalement, il m'intéresse ». |
| `UNAVAILABLE` | « Plus disponible » | Trois biens similaires (CAL-081). |

**INT-003** `[P1]` **État d'une demande** : `NEW` → « Reçue » · `IN_PROGRESS` → « Prise en charge par {conseiller} » · `CLOSED` → « Traitée ». Une demande classée indésirable n'apparaît pas.

**INT-004** `[P1]` **Actions sur un bien**, selon son état :

| Action | Disponible quand | Effet |
|---|---|---|
| Voir le bien | toujours | Ouvre la fiche publique. Si elle n'est plus en ligne (dépubliée, archivée) : la carte se déplie sur place en un **résumé** du bien — photos, titre, ville, surface, prix au moment de l'intérêt — avec « Fiche en cours de mise à jour » ou « Ce bien n'est plus proposé ». Jamais une page d'erreur. |
| Demander une visite ou une visio `[P1]` | `INTERESTED`, `VISITED` ; dossier en cours ; bien encore proposé | INT-040. Repli tant que la demande de rendez-vous n'est pas livrée ou que `features.clientAppointments` est faux : « Demander une visite » ouvre « Écrire à mon conseiller », message prérempli « Je souhaite visiter {bien} (réf. {référence}). » (ECL-006, D-108). |
| Je retiens ce bien | `INTERESTED`, `VISITED` ; dossier à l'étape `MATCHING` ; bien en ligne, avec au moins un lot disponible | INT-030 |
| Ce bien ne m'intéresse plus | `INTERESTED`, `VISIT_REQUESTED`, `VISIT_PLANNED`, `VISITED` | Raison (INT-021) → `DECLINED`. Un rendez-vous de visite à venir pour ce bien est annulé, après confirmation ; un choix en attente est retiré. |
| Écrire à mon conseiller | toujours | Ouvre la messagerie (ou son repli, MSG-021) avec « Au sujet de {bien} (réf. {référence}) : ». |

**INT-005** `[P1]` **Aucun intérêt** : « Vous n'avez pas encore exprimé d'intérêt. » · bouton « Découvrir les biens ».

## 2. Biens proposés (EC-13)

**INT-010** `[P1]` Les biens que le conseiller a proposés et **envoyés** (`origin = ADVISOR_PROPOSAL`, `sentAt` renseigné), du plus récent au plus ancien, groupés par envoi : « Proposés par {conseiller} le {date} », avec son mot d'accompagnement s'il en a écrit un. Une carte par bien : photo, titre, ville, prix, mensualité, la pastille « Nouveau » tant qu'il n'a pas été ouvert, l'état, et les deux boutons de réponse tant que le bien attend une réponse (`PROPOSED`, `VIEWED`). Ensuite la carte montre son état (INT-002) : un bien écarté y garde « Finalement, il m'intéresse » (INT-021) ; un bien devenu indisponible, ses biens similaires ; les autres — intérêt envoyé, visite, bien retenu — le lien « Voir dans mes intérêts », où sont leurs actions.

**Filtre et message** (D-099) : « Tous » · « À découvrir » · « Consultés » · « Suivis » · « Écartés ou indisponibles », avec leurs compteurs, gardé dans l'adresse (`etat=`). Le mot du conseiller est présenté comme une bulle signée « Le mot de {conseiller} ». En tête : des biens non ouverts — « Un bien vous attend » / « {n} biens vous attendent » · « Ouvrez-les à votre rythme, puis dites à {conseiller} ce que vous en pensez : cela l'aide à mieux vous proposer. » ; tous ouverts, des réponses attendues — « Vous avez tout regardé » · « Un avis, une question, une préférence ? Dites-le à {conseiller} : sa prochaine sélection en tiendra compte. » · « Donner mon avis » (MSG-021, ECL-006). L'état vide (INT-023) propose aussi « Écrire à mon conseiller ».

**INT-011** `[P1]` **Ouverture.** Un bien proposé est « vu » (`PROPOSED` → `VIEWED`, `viewedAt`) quand le client ouvre son détail dans l'espace, ou sa fiche publique depuis la proposition. Afficher la liste ne suffit pas.

**INT-020** `[P1]` **Répondre.**

| Bouton | Effet |
|---|---|
| **Ce bien m'intéresse** | Statut `INTERESTED`. Un commentaire facultatif (« Qu'est-ce qui vous plaît ? »). Le bien rejoint « Mes intérêts ». |
| **Ce bien ne me convient pas** | Demande la raison (INT-021), puis statut `DECLINED`. |

Le conseiller est notifié de chaque réponse (`NS_CANDIDATE_RESPONSE`). Message de confirmation : « Merci, {conseiller} est prévenu. ». Les mêmes boutons figurent sur la fiche publique du bien quand le client est connecté (FIC-054).

**INT-021** `[P1]` **Raison d'un refus** — elle aide le conseiller à mieux proposer : « Trop cher » · « L'emplacement ne convient pas » · « Surface ou nombre de pièces » · « Date de livraison » · « Autre raison », et une précision facultative (500 caractères). Le client peut se raviser à tout moment (« Finalement, il m'intéresse »).

**INT-022** `[P1]` **Bien proposé devenu indisponible** (vendu, retiré, archivé) : la carte reste, voilée, avec « Ce bien n'est plus disponible » et trois biens similaires. Ses boutons de réponse disparaissent. Un bien seulement **réservé** garde ses boutons de réponse, avec la mention « Tous les lots sont réservés pour le moment » ; un bien **hors ligne** les garde aussi, avec « Fiche en cours de mise à jour », et son détail s'ouvre en résumé (INT-004).

**INT-023** `[P1]` **Aucune proposition** : « Votre conseiller n'a pas encore proposé de bien. » · selon l'étape : avant la qualification, « Il vous contacte d'abord pour comprendre votre projet. » ; après, « Sa sélection arrive. » · bouton « Découvrir les biens ».

## 3. Retenir un bien

**INT-030** `[P1]` « Je retiens ce bien » ouvre une fenêtre :

> « Vous indiquez à {conseiller} que c'est ce bien que vous souhaitez acheter. Il vous recontacte pour confirmer et préparer votre dossier. **Cela ne vous engage pas.** »

- si le bien a plusieurs lots disponibles : « Un lot vous attire en particulier ? » (liste des lots disponibles : référence, étage, surface, prix ; facultatif) ;
- un commentaire facultatif ;
- bouton « Envoyer mon choix ».

Effets : `selectionRequestedAt` est renseigné, le lot préféré est noté, l'événement `candidate.selection_requested` part (notification et tâche pour le conseiller). Le statut du bien **ne change pas** : c'est le conseiller qui confirme (CYC-071). L'état affiché devient « Choix envoyé à votre conseiller ».

**INT-031** `[P1]` Un seul choix en attente par dossier : envoyer un choix sur un autre bien remplace le précédent, après confirmation (« Vous aviez indiqué {autre bien}. Le remplacer ? »). Le client peut annuler son choix tant qu'il n'est pas confirmé (« Annuler mon choix »).

**INT-032** `[P1]` Une fois le bien **retenu** par le conseiller, le client ne peut plus en changer seul : il écrit à son conseiller (CYC-072).

## 4. Visites et rendez-vous (EC-14)

**INT-040** `[P1]` **Demander un rendez-vous** (`features.clientAppointments`). Depuis un bien, ou depuis la page Rendez-vous.

| Champ | Oblig. | Règles |
|---|---|---|
| Type | oui | « Visite du bien sur place » · « Visite en visio » · « Appel avec mon conseiller ». Les deux premiers demandent un bien. |
| Qui fera la visite ? | pour une visite sur place | « Moi » · une **personne de confiance** du profil (PRO-040) · « Une autre personne » (nom, téléphone, lien avec moi), qui est ajoutée au profil. |
| Vos disponibilités | oui | Un à trois souhaits, chacun : une date (de demain à 60 jours) et un moment (`ContactTimeSlot`). |
| Précisions | non | 1 000 caractères. |

Mention : « Créneaux dans votre heure locale ({fuseau}). ». Envoi : rendez-vous créé à l'état `REQUESTED`, bien à l'état `VISIT_REQUESTED`, tâche pour le conseiller (CYC-080). Confirmation : « Votre demande est envoyée. {conseiller} vous confirme le créneau. ».

**INT-041** `[P1]` **Liste des rendez-vous** — visible même sans la fonction ci-dessus, pour les rendez-vous créés par l'équipe. Tous y figurent, y compris ceux pour lesquels le conseiller a choisi de n'envoyer aucun e-mail (TAC-040) : c'est le rendez-vous du client. Deux groupes : « À venir » et « Passés ».

| Statut | Libellé | Détail |
|---|---|---|
| `REQUESTED` | « Demandé » | Les souhaits envoyés. Actions : modifier les souhaits, annuler. |
| `CONFIRMED` | « Confirmé » | Date et heure (TRV-031) : pour une **visite sur place**, l'heure du **lieu** (« 14 h 30, heure d'Alger »), suivie de l'équivalent chez le client s'il diffère ; pour une visio ou un appel, l'heure du client, suivie de celle du conseiller si elle diffère · type · conseiller · lieu ou lien de visio · personne qui fait la visite. Actions : « Ajouter à mon agenda » (`.ics`), « Annuler ». |
| `DONE` | « Tenu » | |
| `NO_SHOW` | « Manqué » | Bouton « Reprendre rendez-vous » `[P1]` ; tant que `features.clientAppointments` est faux : « Écrire à mon conseiller », message prérempli « Je souhaite reprendre rendez-vous. ». |
| `CANCELLED` | « Annulé » | Par qui — « par vous », « par {conseiller} », ou « à la clôture de votre dossier » —, et la raison si elle a été donnée au client. |

**INT-042** `[P1]` **Annuler** (jusqu'à l'heure de début) : confirmation « Annuler votre rendez-vous du {date} ? », raison facultative. Effets : CYC-080 ; le conseiller reçoit une notification et un e-mail. Pour déplacer un rendez-vous confirmé, le client écrit à son conseiller ou annule et redemande.

**INT-043** `[P1]` Un rappel part par e-mail 24 heures avant un rendez-vous confirmé, sauf si le conseiller a choisi de n'envoyer aucun e-mail pour ce rendez-vous (TAC-040, AUT-051). Le lien de visio est visible dès la confirmation.

**INT-044** `[P1]` **Aucun rendez-vous** : « Aucun rendez-vous pour le moment. » · bouton « Demander un rendez-vous » `[P1]` ; tant que `features.clientAppointments` est faux : « Votre conseiller vous propose un créneau quand c'est utile. » · « Écrire à mon conseiller ». La page n'apparaît au menu que si le client a au moins un rendez-vous, ou si la fonction est active (ECL-001).
