# Back-office — tâches et rendez-vous

Écrans **EA-30** (tâches) et **EA-31** (agenda). Contrat : offre technique, § 4.3 — tâches et rappels.

Modèle : `Task` (`01-domaine/05`), `Appointment` (`01-domaine/04`). Cycles de vie : CYC-220 (tâche), CYC-080 (rendez-vous). Tâches créées par les règles : `01-domaine/08`, § 5.

---

## 1. Tâches (EA-30)

**TAC-001** `[P1]` **Liste.** Colonnes : case « Terminer » · Titre · Type · Priorité · Échéance · Rattachée à (client, dossier, demande, soumission, bien, Café, promoteur, banque, produit bancaire, rendez-vous, réservation, retour) · Affectée à · Origine · État. Les tâches ouvertes sont groupées par échéance : **En retard** · **Aujourd'hui** · **Demain** · **Cette semaine** · **Plus tard** · **Sans échéance**. Dans chaque groupe : par priorité, puis par échéance.

**TAC-002** `[P1]` **Vues d'origine** : « Mes tâches » (par défaut) · « À prendre » (non affectées) · « En retard » · « Terminées » (30 derniers jours) · « Toute l'équipe » (lecture pour tous ceux qui ont `task.read` ; modification avec `task.manage.all`). Filtres : type, priorité, affectée à, origine (manuelle, automatique), objet rattaché, période d'échéance. **Actions groupées** (BO-035) : terminer · réaffecter · annuler — chacune sous les droits de TAC-004, ligne par ligne.

**TAC-003** `[P1]` **Créer ou modifier** (`task.manage`).

| Champ | Règles |
|---|---|
| Titre | Obligatoire, 160 caractères. |
| Type | `TaskType` ; défaut « Relance ». |
| Priorité | Défaut « Normale ». |
| Échéance (facultatif) | Date, et heure facultative. Sans heure : la tâche est due **dans la journée** (`dueHasTime` faux) — elle n'est en retard que le lendemain, et son rappel part à 9 h. Sans date : la tâche va dans le groupe « Sans échéance » (TAC-001). |
| Rappel | Aucun · à l'échéance (défaut) · 15 minutes, 1 heure ou 1 jour avant · une date choisie (`Task.reminderKind`, d'où `remindAt` est calculé). « 15 minutes » et « 1 heure avant » ne sont proposés que pour une échéance avec heure ; sans échéance, seuls « Aucun » et « une date choisie ». |
| Affectée à | Moi (défaut) · un collègue · « L'équipe » (non affectée). |
| Rattachée à | Rempli d'office quand la tâche est créée depuis une fiche ; sinon recherche d'un client, d'un dossier, d'une demande… |
| Description | 2 000 caractères. |

**TAC-004** `[P1]` **Qui modifie quoi.** La personne affectée et l'auteur d'une tâche peuvent la modifier, la terminer, l'annuler, la réaffecter. Les autres : seulement avec `task.manage.all`. Chacun peut **prendre** une tâche non affectée. Confier une tâche à un collègue le notifie (`NS_TASK_ASSIGNED`, avec son e-mail). Une tâche créée par une **règle** ne passe pas par là : elle n'envoie pas d'e-mail ; une tâche automatique haute ou urgente fait une notification dans l'application (`NS_TASK_AUTO`) — sauf si la personne est déjà notifiée du même fait (NOT-035) —, et toutes figurent dans « Ma journée » et dans le résumé du matin (AUT-032) — vingt tâches automatiques dans la journée ne font pas vingt e-mails.

**TAC-005** `[P1]` **Actions.**

| Action | Effet |
|---|---|
| Terminer | Un clic sur la case. « Tâche terminée. » · « Annuler » pendant 5 secondes. Une note de fin, facultative, dit ce qui a été fait ; elle paraît dans la chronologie de l'objet rattaché. |
| Reporter | « Demain » (aujourd'hui + 1 jour) · « Dans 3 jours » (aujourd'hui + 3 jours calendaires) · « La semaine prochaine » (le lundi suivant) · une date. L'heure et `dueHasTime` sont gardés. Le rappel suit : `remindAt` est recalculé d'après `reminderKind` ; une date de rappel choisie (`CUSTOM`) ne bouge pas. |
| Réaffecter | À un collègue, ou à l'équipe. |
| Annuler | Raison facultative. |
| Rouvrir | Une tâche terminée ou annulée, dans les 30 jours (CYC-220). |
| Écrire | Seulement sur une tâche qui propose un modèle (`Task.suggestedTemplateCode`, AUT-032) : ouvre la fenêtre d'envoi (COM-020) avec ce modèle, adressée au contact principal du promoteur ou de la banque rattachés, à défaut au client rattaché. |

**TAC-006** `[P1]` **Tâches automatiques.** Une tâche créée par une règle porte « Automatique » et le nom de la règle (lien, pour qui a `workflow.manage`). Elle se termine ou s'annule d'elle-même quand son objet est réglé (AUT-035) ; elle affiche alors « Terminée automatiquement : {raison} ». On peut aussi la traiter à la main comme une autre.

**TAC-007** `[P1]` **Retard.** Une tâche ouverte dont l'échéance est passée est en rouge ; le menu latéral en porte le compteur ; elle figure dans « Ma journée » (TDB-005) et dans le résumé du matin (AUT-070). Aucune tâche n'est fermée ni supprimée pour cause de retard.

**TAC-030** `[P1]` **Rappels.** À l'heure du rappel, la personne affectée reçoit la notification `NS_TASK_DUE`, dans l'application seulement : le rappel n'envoie pas d'e-mail. Une échéance sans heure déclenche son rappel à 9 h, dans le fuseau de cette personne. Une tâche non affectée ne rappelle personne : elle paraît dans « À prendre ».

**TAC-031** `[P1]` Une tâche est aussi visible là où elle se rattache : l'onglet Tâches d'un dossier, la colonne de droite d'une fiche (« Prochaine tâche »), la carte du pipeline (signal « tâche en retard »).

**TAC-032** `[V2]` Tâches récurrentes. Modèles de tâches. Mention d'un collègue dans une description.

## 2. Agenda (EA-31)

**TAC-035** `[P1]` L'agenda (`appointment.read`) réunit, dans le fuseau du membre de l'équipe : ses **rendez-vous**, ses **tâches** datées (celles qui ont une heure à leur heure ; les autres en tête du jour), et `[P1]` les **Cafés** dont il est responsable. Affichages : semaine (défaut) · jour · mois · liste. Un administrateur peut superposer les agendas de plusieurs collègues, chacun avec sa couleur et son nom.

**TAC-036** `[P1]` Cliquer un créneau vide propose « Rendez-vous » ou « Tâche », à cette date. Cliquer un élément ouvre son détail. Déplacer un rendez-vous confirmé à la souris ouvre la confirmation du report (TAC-042), car le client sera prévenu.

**TAC-037** `[V2]` Synchronisation avec un agenda externe (Google, Outlook).

## 3. Rendez-vous

**TAC-040** `[P1]` **Créer un rendez-vous** (`appointment.manage`).

| Champ | Règles |
|---|---|
| Client | Obligatoire. Son dossier en cours est rattaché d'office : le plus récemment actif de ses dossiers `OPEN`, à défaut `ON_HOLD` ; modifiable parmi ses dossiers ouverts ou en pause, ou « Aucun dossier ». |
| Type | Appel téléphonique · Visio · Visite du bien · Rendez-vous sur place. |
| Bien | Pour une visite ou une visio de bien : choisi parmi les biens envisagés du dossier rattaché. Sans dossier, ou sans bien envisagé, le type « Visite du bien » est grisé (BO-047) : « Ajoutez d'abord le bien aux biens envisagés du dossier. » |
| Date, heure, durée | Durée par défaut : 30 minutes ; 60 pour une visite. Pour un appel ou une visio, l'heure est saisie dans **mon** fuseau, et l'heure du client s'affiche à côté (« 18 h 30 à Paris · 12 h 30 à Montréal », d'après `Client.timezone`). Pour une **visite du bien** ou un rendez-vous sur place, l'heure est celle **du lieu** (`placeTimezone` : le fuseau du pays du bien ; sans bien, `business.calendar.timezone` ; modifiable), parce que c'est là que quelqu'un attend ; l'écran montre alors les trois : « 14 h 30 à Alger · 15 h 30 à Paris (vous) · 9 h 30 à Montréal (client) ». |
| Conseiller | Moi, par défaut. |
| Lieu ou lien | Lieu pour une visite ou une rencontre ; lien pour une visio (collé ; aucune visio n'est créée par la plateforme). |
| Qui fait la visite | Le client, ou une de ses personnes de confiance (PRO-040). |
| Note pour le client · Note interne | 1 000 caractères chacune. |
| Informer le client par e-mail | Case cochée : e-mail `C_APPOINTMENT_CONFIRMED` avec le fichier d'agenda, et le rendez-vous retient que cet e-mail est parti (`clientNotifiedAt`). Décochée — le client est déjà prévenu de vive voix, ou ne veut pas d'e-mail — : aucun e-mail ne part pour ce rendez-vous, ni confirmation, ni rappel de la veille, ni annulation (CYC-080). Dans les deux cas le rendez-vous figure dans l'espace du client : c'est le sien (INT-041). Pour un simple pense-bête d'appel, on crée une tâche, pas un rendez-vous. Client sans adresse e-mail : la case est remplacée par « Prévenez le client par téléphone. ». |

Le rendez-vous naît `CONFIRMED`. Pour une visite, le bien passe à `VISIT_PLANNED` (CYC-070).

**TAC-041** `[P1]` **Confirmer une demande du client** (rendez-vous `REQUESTED`, INT-040). L'écran montre ses souhaits, convertis dans mon fuseau. Le conseiller en retient un, ou saisit un autre créneau, complète le lieu ou le lien, et confirme : le client reçoit `C_APPOINTMENT_CONFIRMED`. Refuser la demande l'annule, avec un mot au client.

**TAC-042** `[P1]` **Suite d'un rendez-vous** (CYC-080).

| Action | Champs | Effet |
|---|---|---|
| Déplacer | Nouvelle date, nouvelle heure | E-mail au client avec « Nouvelle date », s'il avait été informé du rendez-vous ; rappel réarmé. |
| Annuler | Raison ; un mot pour le client (facultatif) ; « Informer le client » (coché, proposé seulement s'il avait été informé du rendez-vous) | `C_APPOINTMENT_CANCELLED`, avec le mot. Le bien revient à « Intéressé ». |
| Tenu | Compte rendu (facultatif) | Vaut premier contact (CYC-004). Pour une visite : le bien passe à `VISITED`. |
| Absent | — | Tâche « Recontacter le client » (`R_APPOINTMENT_NO_SHOW`). Le bien revient à « Intéressé » : le client peut reprendre rendez-vous, le retenir ou l'écarter. |
| Corriger l'issue | Raison | Dans les 7 jours : « Tenu » ↔ « Absent » ↔ « Annulé ». Les effets sur le bien et sur le premier contact sont rejoués (CYC-080). Rien d'autre : une correction n'émet ni `appointment.no_show` ni `appointment.cancelled`, n'envoie aucun e-mail au client et ne crée aucune tâche. |

« Tenu » et « Absent » ne sont possibles qu'après l'heure de début.

**TAC-043** `[P1]` **Avertissements à la saisie**, sans blocage : « Vous avez déjà un rendez-vous de {début} à {fin}. » · « Ce créneau est en dehors des heures de travail. » · « Il sera {heure} chez le client. » quand l'heure locale du client (`Client.timezone`) est avant 8 h ou après 21 h — pour un appel ou une visio, où c'est lui qui décroche.

**TAC-044** `[P1]` **Noter un rendez-vous passé** : une date passée est acceptée à la création ; le rendez-vous est alors créé directement à l'état « Tenu », sans e-mail au client.

**TAC-045** `[P1]` **Visite sur place avec le promoteur.** « Demander une visite au promoteur » s'ouvre depuis un **bien envisagé** d'un dossier (onglet Biens) ou depuis la fiche du promoteur (CTL-006), où il choisit d'abord le bien parmi les biens publiés de ce promoteur : le conseiller saisit un à trois créneaux, dans le fuseau du lieu (`action.slotsLabel`), et l'e-mail `P_PROMOTER_VISIT_REQUEST` part à un contact du promoteur, sans rendez-vous. La date se convient avec lui par téléphone ou par e-mail, **avant** de créer le rendez-vous : un rendez-vous a toujours sa date. Depuis un rendez-vous de visite déjà créé, le même bouton préremplit le créneau avec l'heure du lieu du rendez-vous. Le formulaire du rendez-vous porte ensuite **qui accueille le visiteur sur place** (`hostName`, `hostPhone`) : c'est le geste `VISIT_HOST` (ACP-020). Renseigné à la création, il figure dans la confirmation du client ; renseigné plus tard, dans son rappel et sur la page de ses rendez-vous : « Sur place, vous serez accueilli par {nom} ({téléphone}). ». Le promoteur, lui, apprend le nom de la personne qui vient — le client, ou le proche qui le représente — et l'heure, rien d'autre (ACP-017). Tant que personne n'est désigné, la visite figure dans « Ce que nous attendons de lui » (CTL-005). Si une visite où quelqu'un devait accueillir est annulée ou déplacée, une tâche demande de prévenir le promoteur (`R_VISIT_HOST_CANCELLED`, `R_VISIT_HOST_RESCHEDULED`). Si le bien de la visite devient indisponible avant la date, le rendez-vous n'est pas annulé d'office : une tâche demande au conseiller de trancher (`R_VISIT_UNAVAILABLE`).

**TAC-046** `[P1]` **Liste des rendez-vous** (dans l'agenda, affichage « liste ») : Date · Type · Client · Bien · Conseiller · État. Vues : « À confirmer » `[P1]` · « À venir » · « À renseigner » (confirmés, dont l'heure est passée) · « Passés ».

**TAC-047** `[P1]` Les rendez-vous créés par l'équipe font partie de la Phase 1 (suivi des visites, § 4.3 du contrat). Seule la **demande** de rendez-vous par le client depuis son espace est `[P1]` (`features.clientAppointments`).
