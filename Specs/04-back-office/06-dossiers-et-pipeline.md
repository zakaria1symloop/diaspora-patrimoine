# Back-office — dossiers et pipeline

Écrans **EA-20** (pipeline), **EA-21** (tous les dossiers), **EA-22** (un dossier). Contrat : offre technique, § 4.3 (rapprochement client / bien, pilotage des dossiers) et § 4.8 (pipeline Kanban, machine à états, vues filtrées).

Les transitions, leurs conditions et leurs effets sont dans `01-domaine/06` (CYC-020 à CYC-040). Ce fichier décrit **les écrans qui les déclenchent**. Aucun écran ne permet une transition que les cycles de vie n'autorisent pas.

---

## 1. Pipeline (EA-20)

**PIP-001** `[P1]` Sept **colonnes**, une par étape : Intérêt · Qualification · Mise en relation · Dossier · Étude bancaire · Accord · Acquisition. En tête de chaque colonne : son nom, le nombre de dossiers, « dont {n} en retard ». Seuls les dossiers `OPEN` et `ON_HOLD` y figurent.

**PIP-002** `[P1]` **Carte d'un dossier.**

| Élément | Règle |
|---|---|
| Client | « NOM Prénom », une ligne (TRV-071). |
| Référence et bien | « DOS-2026-0042 · Appartement T3 – Résidence El Yasmine » ; sans bien retenu : « Bien à définir ». |
| Ancienneté dans l'étape | « 5 j dans cette étape » : jours de calendrier depuis `stageEnteredAt`, pauses comprises ; en rouge avec « en retard de 2 j » si l'échéance de l'étape est passée (CAL-062) — jours ouvrés écoulés depuis `slaDueAt`. |
| Selon l'étape | `MATCHING` : « 3 biens proposés · 1 retenu ». `DOCUMENTS` : barre de complétude et « {n} pièces à vérifier ». `BANK_REVIEW` : « 2 banques · 1 complément demandé ». `APPROVED` : « Offre valable jusqu'au {date} ». `ACQUISITION` : le prochain jalon. |
| Signaux | Priorité haute ou urgente · message du client en attente (absent avant la livraison de la messagerie) · tâche en retard · « En pause » (carte estompée) · « Ne pas contacter ». |
| Conseiller | Photo ou initiales. |

**PIP-003** `[P1]` **Ordre dans une colonne** : les dossiers en retard d'abord ; puis par priorité, de la plus haute à la plus basse ; puis par échéance d'étape la plus proche. Les dossiers en pause sont en bas. Cinquante cartes par colonne, puis « Afficher plus ».

**PIP-004** `[P1]` **Filtres** : conseiller · promoteur · programme · banque · pays du bien · priorité · avec ou sans financement · en pause · en retard ; recherche par client ou référence. Vues d'origine : « Mes dossiers » (par défaut pour un conseiller) · « Tous » (par défaut pour un administrateur) · « En retard ». Les vues s'enregistrent (BO-040).

**PIP-005** `[P1]` **Glisser-déposer** (CYC-030). Déposer une carte dans la colonne **suivante** tente la transition. Si une condition manque : la carte revient, et une fenêtre liste ce qui manque, chaque ligne menant au bon endroit. Colonne non adjacente : « On ne peut pas sauter une étape. » — sauf pour un achat sans financement, qui passe de « Dossier » à « Acquisition » (CYC-024). Colonne atteinte seulement par une transition automatique (Étude bancaire, Accord) : « Cette étape se déclenche à l'envoi d'une soumission. » · « … à l'accord d'une banque. ». Colonne précédente : « Pour reculer d'une étape, utilisez le menu du dossier. ». Un rôle sans `dossier.transition` ne peut rien déplacer. Au dépôt, la transition s'ouvre dans la même fenêtre que l'action principale (PIP-021), avec ses champs et ses confirmations (situations à saisir de CYC-022, soumissions retirées de CYC-026) ; fermer la fenêtre remet la carte en place. Intérêt → Qualification affecte le dossier à celui qui glisse (`assign`, note 3 de la matrice des rôles). Les colonnes « Aboutis » et « Clôturés » (PIP-007) n'acceptent aucun dépôt : « Utilisez le menu du dossier pour le clôturer. ». Un dossier sans financement déposé dans « Étude bancaire » : « Ce dossier est sans financement : il passe de “Dossier” à “Acquisition”. ».

**PIP-006** `[P1]` **Actions rapides** sur une carte (au survol, ou par son menu) : ouvrir · ajouter une note · créer une tâche · changer de conseiller · mettre en pause.

**PIP-007** `[P1]` Une bascule « Afficher les dossiers terminés » ajoute deux colonnes repliées : « Aboutis » et « Clôturés », limitées aux 30 derniers jours.

**PIP-008** `[P1]` Le pipeline se met à jour en direct : une carte déplacée par un collègue change de colonne sans rechargement. Deux déplacements simultanés du même dossier : le second échoue (`409 CONFLICT_VERSION`, API-051) ; la carte revient à sa place à jour et « Ce dossier vient d'être déplacé par {prénom}. » s'affiche, sans bouton — pas la fenêtre de TRV-094.

## 2. Tous les dossiers (EA-21)

**PIP-010** `[P1]` Colonnes : Référence · Client · Bien · Promoteur · Étape · État · Conseiller · Priorité · Complétude · Dans l'étape depuis · Échéance · Dernière activité · Ouvert le. Vues d'origine : « Mes dossiers » · « En retard » · « En pause » · « Complets, à soumettre » (dossier `OPEN` à l'étape `DOCUMENTS`, complet au sens de CAL-055, avec financement, sans aucune soumission envoyée) · « En étude bancaire » · « Acomptes à suivre » (CYC-108) · « Sans activité depuis 30 jours » · « Aboutis » · « Clôturés » · « Tous ». Actions groupées : changer de conseiller · changer la priorité · exporter (`dossier.export`).

**PIP-015** `[P1]` **Ouvrir un dossier à la main** (`dossier.create`) : client (recherche ou création, CRM-041) · bien (facultatif) · avec ou sans financement · conseiller (moi, par défaut). Le dossier naît à l'étape `INTEREST` et passe aussitôt à `QUALIFICATION` puisqu'il a un conseiller (CYC-020). Le bien indiqué (un bien publié) entre au dossier comme **bien envisagé** — candidat `CLIENT_INTEREST`, statut `INTERESTED`, sans demande d'origine (`leadId` vide) —, jamais comme bien retenu : retenir passe par CYC-071, et le client n'est prévenu de rien. Si le client a déjà un dossier `OPEN` ou `ON_HOLD` qui **a retenu** ce bien, l'ouverture est refusée (MOD-310, raison `DOSSIER_ALREADY_OPEN_FOR_PROPERTY`), avec un lien vers ce dossier ; s'il en a un qui l'**envisage** seulement, la fenêtre le signale (« {référence} envisage déjà ce bien ») et propose d'ouvrir ce dossier ; « Créer quand même » reste possible.

## 3. Un dossier (EA-22)

**PIP-020** `[P1]` **En-tête.**
- la référence, le client (lien vers sa fiche), le bien retenu ;
- la **frise** des sept étapes, l'étape en cours mise en valeur, les dates d'entrée des étapes passées ;
- l'état, la priorité, le conseiller, l'échéance de l'étape ;
- l'**action principale**, qui dépend de l'étape (PIP-021) ;
- le menu « ⋯ » : Mettre en pause · Reprendre · Clôturer · Rouvrir · Reculer d'une étape · Changer de conseiller · Imprimer le récapitulatif · Supprimer.

**PIP-021** `[P1]` **Action principale et « Ce qu'il manque ».** Sous l'en-tête, un encart liste les conditions de la transition suivante, chacune « remplie » ou « manquante », avec un lien. Le bouton n'est actif que si tout est rempli. Sur un dossier **en pause**, l'action principale est remplacée par « Reprendre le dossier » : aucune avancée à la main ne se fait pendant une pause ; les avancées automatiques — une banque qui répond — se font, et le dossier change alors d'étape en restant en pause (CYC-034).

| Étape | Action principale | Conditions |
|---|---|---|
| `INTEREST` | Prendre en charge | CYC-020 |
| `QUALIFICATION` | Marquer comme qualifié | CYC-021 (fenêtre de CRM-050) |
| `MATCHING` | Constituer le dossier | CYC-022 |
| `DOCUMENTS`, avec financement | Soumettre à une banque | Ouvre BNK-101. Le passage à l'étape suivante se fait à l'envoi (CYC-023). |
| `DOCUMENTS`, sans financement | Passer à l'acquisition | CYC-024 |
| `BANK_REVIEW` | — (l'accord d'une banque fait avancer, CYC-025) ; bouton « Soumettre à une autre banque » | |
| `APPROVED` | Conditions acceptées | CYC-026 |
| `ACQUISITION` | Acte signé : clôturer le dossier | CYC-027 (PIP-052). Si la réservation a été annulée entre-temps : « Réserver un lot » d'abord — l'acte ne s'enregistre pas sans lot réservé. |

**PIP-022** `[P1]` **Onglets** : Aperçu · Biens · Pièces · Financement · Réservation et acquisition · Emprunteurs · Échanges · Tâches · Historique. Chaque onglet porte un compteur quand il y a quelque chose à traiter (pièces à vérifier, messages non lus, tâches en retard).

### Aperçu

**PIP-025** `[P1]`

| Bloc | Contenu |
|---|---|
| Bandeaux | Ceux qui s'appliquent : dossier en pause (motif, reprise prévue, et ce qui court malgré la pause : option, offre, rendez-vous) · « Du nouveau pendant la pause : {ce qui s'est passé} » · « Aucune soumission en cours » (CYC-029) · bien retenu plus disponible · « Bien hors ligne depuis le {date} » (CYC-121) · « Le lot visé n'est plus libre » (CYC-102) · « Plus de lot réservé » (CYC-105) · option qui expire · « Acompte de {montant} à suivre » (CYC-108) · accord de transmission manquant · « Information manquante pour établir la liste de pièces » (GED-020) · client « Ne pas contacter » · client sans e-mail · e-mail du client rejeté · traitement limité · suppression du compte demandée · dossier inactif. Textes : ceux qui portent sur le client reprennent mot pour mot ceux de sa fiche (CRM-045) ; « En pause depuis le {date} : {motif}{, reprise prévue le {date}} » ; « Dossier inactif depuis {n} jours » (CYC-039). |
| Client | Nom, score, coordonnées, moyen et moment préférés, son heure locale. |
| Plan de financement | Avec ou sans financement (affiché ; il se change par la bascule de PIP-055, CYC-041) · type souhaité (avec financement seulement : `CONVENTIONAL`, `ISLAMIC`, `NO_PREFERENCE`) · **prix du projet** · apport · montant à financer · durée — modifiables (`dossier.update`). Le prix du projet n'a qu'une valeur (`Dossier.purchasePrice`, MOD-313) : prérempli avec le prix du lot visé (à défaut, le « à partir de » du bien), modifiable par le conseiller après une négociation — l'écart avec le prix public est affiché. Tant qu'une option ou une réservation est active, ce prix et le prix convenu de la réservation sont un seul et même chiffre : le modifier d'un côté le modifie de l'autre. Le montant à financer est proposé (prix − apport, l'apport étant converti dans la devise du bien s'il est dans une autre, MOD-313) et reste modifiable ; s'il s'écarte de ce calcul, l'écart est affiché. Rappel de la dernière simulation d'éligibilité. Tant qu'aucun bien n'est retenu, le prix du projet n'est pas saisissable (« Retenez d'abord un bien. ») — sa devise est celle du bien — ; l'apport, le montant à financer et la durée le sont. |
| Prochaine étape affichée au client | Le texte par défaut de l'étape (ECL-021), et un champ pour le remplacer (`clientNextStep`, 300 caractères). « Rétablir le texte automatique » le vide. |
| À faire | Les tâches ouvertes du dossier, le prochain rendez-vous. |
| Activité | Les cinq dernières entrées de la chronologie. |

**PIP-026** `[P1]` **Changer de conseiller** (`dossier.assign`, CYC-040) : choix du nouveau conseiller — un compte du personnel actif, non absent (CRM-021), qui a `dossier.update` —, et la case « Ne pas informer le client ». En action groupée (PIP-010), la même fenêtre vaut pour tous les dossiers choisis, case comprise ; chaque dossier change de conseiller pour son compte (CYC-040) : son propre `dossier.assigned`, et son propre e-mail au client si la case n'est pas cochée. **Priorité** : Basse · Normale · Haute · Urgente, modifiable par tout rôle qui a `dossier.update`.

### Biens — le rapprochement

**PIP-030** `[P1]` L'onglet liste les **biens envisagés** : photo, titre, prix, disponibilité, origine (« Intérêt du client » · « Proposé par {conseiller} »), statut (libellés de `CandidateStatus`), dates, commentaire du client, raison d'un refus, note interne. Si le client a cliqué « Je retiens ce bien » : un bandeau « {client} souhaite retenir {bien} (lot {lot}) » — ou, si ce lot a été pris entre-temps, « … Le lot que {client} préférait n'est plus libre. » (CYC-102) — avec **Confirmer** (→ CYC-071) et **Refuser** (raison obligatoire, montrée au client ; il est prévenu par la notification `NC_SELECTION_DECLINED`, et son écran « Mes intérêts » affiche la raison : INT-002).

**PIP-031** `[P1]` **Proposer des biens** (`candidate.manage`).
1. Un panneau de recherche s'ouvre, avec les filtres du catalogue (CAT-020), **préremplis** d'après le projet du client : régions et types souhaités, pièces, budget — et, s'il a une simulation d'éligibilité, son budget maximal **dans la devise de référence** (`maxBudgetRef`, celle des prix du catalogue). Seuls les biens publiés et disponibles (disponibilité `AVAILABLE`) sont proposés ; ceux déjà envisagés dans le dossier sont marqués.
2. Le conseiller coche un ou plusieurs biens.
3. Il écrit un mot d'accompagnement (facultatif, 1 000 caractères, montré au client).
4. **« Proposer et envoyer »** : les biens entrent au dossier à l'état `PROPOSED`, `sentAt` est renseigné, le client est prévenu (notification et e-mail `C_PROPOSAL_NEW`, un seul pour l'envoi : un envoi est **un** événement, quel que soit le nombre de biens ; sa relance et l'enquête qui suit portent sur l'envoi, pas sur chaque bien, AUT-043). Si le client n'a pas encore d'espace, l'e-mail lui permet de l'activer en un clic (NOT-024). S'il n'a pas d'adresse e-mail : une tâche « Présenter les biens proposés à {client} » remplace l'e-mail (NOT-025). **« Enregistrer sans envoyer »** : les biens sont en préparation ; le client ne les voit pas tant qu'ils ne sont pas envoyés. **Un envoi** part avec tous les biens en préparation du dossier — ceux qu'on vient de cocher et ceux enregistrés auparavant, que la fenêtre liste avant l'envoi — : ils reçoivent le même `sentAt` et le mot d'accompagnement saisi à l'envoi. Le client les voit groupés par `sentAt` (INT-010) : c'est la seule clé d'un envoi.

**PIP-032** `[P1]` **Suggestions.** En tête du panneau : « Biens suggérés » — les cinq biens publiés et disponibles les plus pertinents pour ce projet (mêmes critères, CAL-080). C'est une aide ; rien n'est proposé sans le choix du conseiller.

**PIP-033** `[P1]` **Agir pour le client** : passer un bien à « Intéressé », « Écarté » (avec la raison), noter une visite ; **retenir un bien** (choix du lot facultatif ; CYC-071) ; **retirer le choix** (CYC-242) ou **changer de bien retenu** (CYC-072, avec l'annonce de ses effets sur les pièces et l'option) ; **viser un lot** : sous la ligne du bien retenu, « Choisir le lot » — le geste de PIP-050, mêmes champs et même avertissement —, seul moyen de viser un lot ou d'en changer en livraison 3, avant l'onglet Réservation. Une proposition encore en préparation se supprime ; une proposition envoyée ne se supprime pas.

### Pièces, financement

**PIP-040** `[P1]` L'onglet **Pièces** est l'écran de vérification de `07-ged.md`, limité à ce dossier. L'onglet **Financement** liste les soumissions du dossier (BNK-100), permet d'en créer (BNK-101) et compare les offres (BNK-133).

### Réservation et acquisition

**PIP-050** `[P1]` **Réservation** (`reservation.manage`, CYC-105, CYC-106).

| Action | Champs | Règles |
|---|---|---|
| Choisir le lot | Parmi les lots disponibles du bien retenu | Renseigne `Dossier.lotId` (`PATCH /admin/dossiers/{id}`, `dossier.update` ; vide : plus de lot visé ; refusé tant qu'une option ou une réservation est active, raison `DOSSIER_HAS_RESERVATION`) : c'est le lot **visé**. Proposé aussi dans l'onglet Biens (PIP-033). La fenêtre le dit : « Viser un lot ne le réserve pas. Posez une option pour le bloquer. ». Si un collègue le prend entre-temps, le dossier perd ce lot et le conseiller est prévenu (CYC-102). |
| Poser une option | Date de fin (défaut : `reservation.optionDays` jours) · prix convenu (défaut : le prix du projet déjà saisi au dossier, `Dossier.purchasePrice` ; à défaut, le prix du lot — MOD-313) · **« Le promoteur tient-il ce lot ? »** : « Oui » (son interlocuteur) ou « Pas encore » (PIP-053) | Lot `AVAILABLE`, bien en ligne, dossier ni en pause ni terminé (CYC-105). Le prix convenu devient le prix du projet (MOD-313). Si le lot vient d'être pris : « Ce lot est déjà sous option pour un autre client jusqu'au {date}. » (MOD-330). |
| Réserver directement | Lot · prix convenu · les champs de « Confirmer la réservation » | Réservation déjà signée quand on la saisit : mêmes conditions que la pose d'une option. La réservation naît « Réservé », sans option ni demande de confirmation au promoteur (CYC-106). |
| Prolonger l'option | Nouvelle date · l'interlocuteur du promoteur qui accepte de tenir le lot jusque-là (obligatoire) | `reservation.maxExtensions` prolongations au plus ; au-delà, il faut `reservation.override`. On ne prolonge pas sans l'accord du promoteur : tant qu'il ne l'a pas donné, l'échéance ne change pas (CYC-107). |
| Confirmer la réservation | Date de confirmation du promoteur · nom de son interlocuteur · acompte (montant, **devise**, date, justificatif) · contrat de réservation (fichier) · date de livraison prévue au contrat | Les fichiers deviennent des pièces du dossier, selon GED-037 : le contrat remplit la pièce « Contrat de réservation signé » de la liste ; le justificatif d'acompte est une pièce fournie par l'équipe. Tous ces champs se complètent aussi **après coup**, tant que le dossier n'est pas terminé. |
| Annuler | Motif · **ce que devient le lot** : « Libre » (par défaut) ou, quand le promoteur l'a repris, « Vendu », « Réservé ailleurs », « Retiré » · case « Informer le client », proposée et cochée seulement si le client avait été prévenu de l'option ou de la réservation (CYC-107) | Le lot redevient disponible, ou prend l'état indiqué, dans la même opération (CYC-105) ; si cet état rend le bien indisponible, la fenêtre l'annonce avant d'enregistrer : « {n} dossiers envisagent ce bien : leurs conseillers seront prévenus. » (CYC-073). Si le promoteur tenait le lot et ne l'a pas repris lui-même, une tâche demande de le prévenir (ACP-023). Si un acompte avait été versé, la fenêtre l'annonce : « Un acompte de {montant} a été enregistré : son remboursement sera à suivre. » (CYC-108). |
| Enregistrer l'issue de l'acompte | « Remboursé » : montant (au plus l'acompte), date, justificatif facultatif, note si le montant est partiel · « Conservé par le promoteur » : note obligatoire | Possible sur toute réservation terminée dont l'acompte est « à suivre », y compris sur un dossier clôturé. Termine la tâche de suivi ; le client lit l'issue dans son espace (ECL-032). Une issue mal saisie se corrige par le même geste, avec une raison obligatoire (CYC-108). |

L'historique des options et réservations du dossier reste affiché, y compris celles expirées ou annulées, chacune avec le sort de son acompte.

**PIP-051** `[P1]` **Jalons d'acquisition** (Q-026), à l'étape `ACQUISITION` : Conditions acceptées (date posée par la transition) · Signature planifiée (date et heure ; propose de créer un rendez-vous) · Acte signé (date) · Clés remises (date). Chaque jalon se coche avec sa date, se corrige, et paraît dans le suivi du client (ECL-032).

**PIP-052** `[P1]` **Clôturer comme abouti** (`dossier.close`, CYC-027). Fenêtre : date de l'acte (obligatoire, non future) · prix de vente final et devise (obligatoires ; préremplis avec le prix du projet, MOD-313) · commission du promoteur et honoraires du client, chacun avec sa devise (facultatifs, Q-001 ; visibles et modifiables avec la permission `dossier.commission.manage` seulement — les autres rôles ne voient pas ces deux lignes, ni ici, ni dans les exports, ni dans les rapports) · note. Elle annonce les effets : « Le lot {lot} passe à Vendu. Les tâches ouvertes sont annulées. Le client reçoit un e-mail de félicitations. ».

**PIP-053** `[P1]` **Le promoteur tient-il le lot ?** (CYC-107). Une option posée « Pas encore » confirmée porte, dans l'onglet et dans l'en-tête du dossier, la mention « À confirmer par le promoteur », avec trois gestes : « Écrire au promoteur » (`P_PROMOTER_OPTION_REQUEST`, CTL-006) · **« Le promoteur tient le lot »** — son interlocuteur, et jusqu'à quelle date s'il en donne une autre que l'échéance (une date plus lointaine est aussi une prolongation, CYC-107) ; le client est alors prévenu que l'option est posée — · **« Le promoteur refuse »** — la raison, et ce qu'est devenu le lot : toujours libre, vendu, réservé ailleurs, retiré. Le refus annule l'option et met le lot dans l'état indiqué ; la fenêtre dit ce qui va suivre : « L'option sera annulée. Le client n'en a pas été prévenu : appelez-le pour lui proposer un autre lot. », et, si ce refus rend le bien indisponible — son dernier lot est vendu ou retiré —, « Le client lira que ce bien n'est plus disponible. » (CYC-073) ; s'il lui reste des lots, tous tenus par d'autres dossiers, le client lira « Tous les lots sont réservés pour le moment. ». Sur l'option, la ligne se lit ensuite « Le promoteur tient le lot depuis le {date} ({interlocuteur}) » — à ne pas confondre avec « Réservation confirmée par le promoteur le {date} », qui vient avec le contrat. Tant que rien n'est saisi, une tâche le rappelle au conseiller au bout d'un jour ouvré (`R_OPTION_UNCONFIRMED`). C'est le geste `OPTION_ANSWER` (ACP-020).

### Emprunteurs

**PIP-055** `[P1]` L'onglet liste l'emprunteur principal, les co-emprunteurs et les garants (`DossierParty`), avec leurs informations et le compte de leurs pièces. Ajouter, modifier, retirer : MOD-320, MOD-321, avec l'annonce des pièces créées ou dispensées. La ligne de l'emprunteur principal renvoie à la fiche du client pour sa situation et ses revenus : il n'y a pas deux endroits où les saisir (MOD-322). Sur un dossier sans financement, l'onglet garde l'acheteur et son co-acquéreur ; un garant est retiré au changement (CYC-041). Une personne dont le traitement est limité à sa demande porte la mention « Traitement limité » : sa ligne ne se modifie pas, et on ne dépose plus pour elle (ADM-063).

**Avec ou sans financement** (CYC-041). Une bascule en tête de l'onglet. Vers « sans financement » : possible jusqu'à l'étape Dossier ; à l'étape Étude bancaire ou Accord, seulement s'il ne reste aucune soumission en cours — la fenêtre propose de les retirer d'abord —, et le dossier revient alors à l'étape Dossier. Vers « avec financement » : jusqu'à l'étape Dossier ; la fenêtre demande le type de financement souhaité (CYC-041). Dans les deux sens, la liste de pièces est réévaluée (GED-031) et la fenêtre annonce ce qui change : « 6 pièces de financement ne seront plus demandées. » · « 6 pièces seront demandées au client. ».

### Échanges, tâches, historique

**PIP-060** `[P1]` **Échanges** : la chronologie du dossier (BO-050), sa barre d'ajout rapide (BO-051), et le fil de messagerie du dossier, où l'on répond au client (COM-010). L'onglet est livré avec le dossier (paquet 3.7), chronologie et ajout rapide ; le fil s'y ajoute avec la messagerie (paquet 5.3). **Tâches** : les tâches du dossier (TAC-001). **Historique** : le journal des étapes (de, vers, date, auteur, raison, durée passée dans l'étape), puis les entrées du journal d'audit qui concernent le dossier (`audit.read`).

## 4. Pause, clôture, réouverture, recul

**PIP-080** `[P1]` **Mettre en pause** (CYC-031) : motif (`HoldReason`), note, date de reprise prévue (facultative), et la case « Informer le client par e-mail » (`C_DOSSIER_ON_HOLD`) — décochée par défaut, cochée d'office et non modifiable quand le motif est « En attente du client » ; pour ce motif, le champ « Ce que nous attendons du client (il le lira) » s'y ajoute (CYC-031). La fenêtre rappelle : « Les relances au client sont suspendues. Les délais de l'étape sont gelés. », puis **ce qui continue de courir** malgré la pause, s'il y a lieu : « Option sur le lot {lot} jusqu'au {date} » · « Offre de {banque} valable jusqu'au {date} » · « Rendez-vous le {date} » — leurs rappels au client partiront quand même (AUT-007). **Reprendre** (CYC-032) : un clic, avec confirmation ; les relances de pièces repartent de zéro.

**PIP-081** `[P1]` **Clôturer** (`dossier.close`, CYC-035) : motif (`LostReason`), note (obligatoire pour « Autre »). La fenêtre **liste les effets** avant validation — option ou réservation annulée, soumissions retirées, tâches annulées, rendez-vous annulés (le client en est prévenu par un e-mail qui mentionne la clôture, CYC-035) — avec leurs nombres, puis la case « Informer le client par e-mail » (cochée d'office, sauf pour les motifs « Doublon » et « Abandon du client », CYC-035). Le motif n'est jamais montré au client.

**PIP-082** `[P1]` **Rouvrir** (`dossier.reopen`, CYC-036) : raison obligatoire ; rappel « Rien n'est rétabli automatiquement. ». **Reculer d'une étape** (`dossier.transition.backward`, CYC-037) : raison obligatoire ; l'étape visée et ses conditions sont celles du tableau de CYC-037 — la fenêtre dit vers quelle étape le dossier revient, et ce qui l'empêche le cas échéant (`SUBMISSION_IN_PROGRESS` : « Retirez d'abord les soumissions en cours ({banques}). » ; `RESERVATION_ACTIVE`). **Supprimer** (`dossier.delete`, CYC-038) : seulement dans les cas de MOD-312.

**PIP-090** `[P1]` **Dossier terminé** (abouti ou clôturé) : tous les onglets passent en lecture seule. Restent possibles : écrire une note ; répondre au client ; enregistrer l'issue d'un acompte (PIP-050) ; pour un dossier abouti, renseigner « Clés remises » — parfois des mois après l'acte —, **ajouter un document** fourni par l'équipe (acte signé, procès-verbal de remise des clés : `document.upload`, pièce `AD_HOC`), corriger les montants de la vente et la commission (`dossier.commission.manage`), créer un témoignage à partir du dossier (CMS-050).

**PIP-095** `[P1]` **Récapitulatif imprimable** (PDF, TRV-142), à usage interne : client, emprunteurs, bien et lot, plan de financement, état des pièces, soumissions et décisions, réservation, jalons, journal des étapes. Il ne contient pas les notes.
