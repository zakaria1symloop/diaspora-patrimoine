# Back-office — Le Café

`[P1]` — écart E1, actif quand `features.cafe` est vrai. Écrans **EA-80** (Cafés), **EA-81** (un Café), **EA-82** (pointage). Côté public : `02-site-public/07`. Modèle : `Event`, `EventPartner`, `EventRegistration`, `EventNotifyRequest`. Cycles de vie : CYC-180 à CYC-187. Règles automatiques : AUT-056.

Toutes les règles de ce fichier portent l'étiquette `[P1]`.

---

## 1. Liste (EA-80)

**EVT-001** Colonnes : Référence · Lieu · Date · État · Places (prises / capacité, en barre) · Liste d'attente · Présents · Responsable. Vues d'origine : « À venir » (par défaut) · « Brouillons » · « Passés » · « Annulés ». En tête : le bouton « Créer un Café » (`event.manage`) et le lien « Demandes “Me prévenir” » (EVT-060).

## 2. Un Café (EA-81)

**EVT-002** **Onglets** : Informations · Participants · Inscriptions · Communications · Bilan (après le Café).

**EVT-003** **Informations** (`event.manage`).

| Champ | Règles |
|---|---|
| Lieu affiché | « Paris », « Sud de la France »… Les lieux déjà utilisés sont proposés ; un nouveau se saisit librement. C'est le libellé public. |
| Ville · Pays | Ville exacte (« Marseille »). |
| Nom du lieu · Adresse · Indications d'accès | **Communiqués aux inscrits seulement** (TRV-045). L'adresse est obligatoire pour publier. |
| Début · Fin · Fuseau | Fuseau du lieu, `Europe/Paris` par défaut. La fin est après le début. |
| Capacité | Défaut `events.defaultCapacity`. |
| Places par inscription | Défaut `events.maxSeatsPerRegistration`. |
| Ouverture des inscriptions | Facultative ; vide : dès la publication. |
| Clôture des inscriptions | Défaut : début − `events.closeHoursBefore` heures. Jamais après le début. |
| Titre | Proposé : « Le Café – {lieu} – {date longue} » ; modifiable. |
| Description · Image | Facultatives. |
| Responsable | Un membre de l'équipe. Il reçoit les alertes et les tâches de ce Café. |

La référence (`CAF-{année}-{mois}-{trois premières lettres du lieu}`) et l'adresse de la page (`{lieu}-{jour}-{mois}-{année}`) sont créées à l'enregistrement.

**EVT-004** **Participants** : les promoteurs, banques et autres partenaires présents (`EventPartner`), choisis dans les listes existantes. Pour chacun : rôle affiché, nom de la personne présente (interne), « Visible sur la page » (Q-041), ordre. C'est ce qui produit « promoteur et banquier présents » sur le site (ACC-061).

**EVT-005** **Actions** (CYC-180).

| Action | Règle |
|---|---|
| **Publier** | Les conditions manquantes sont listées. Effet : la page est en ligne ; les demandes « Me prévenir » sont servies à l'ouverture des inscriptions. |
| Clore · Rouvrir les inscriptions | À la main, avant le début. |
| **Modifier** un Café publié | Si la date, l'heure ou le lieu changent et qu'il y a des inscrits : « {n} inscrits vont être prévenus par e-mail. » avec le résumé des changements. Pas d'option pour ne pas prévenir. |
| Changer la capacité | À la hausse : les inscriptions en attente sont promues selon CYC-185. À la baisse : refusé sous le nombre de places prises. |
| **Annuler** | Motif obligatoire, **montré aux inscrits**. « {n} inscrits et {m} personnes en liste d'attente vont être prévenus. » |
| Dupliquer | Copie tout, sauf les dates et les inscriptions. |
| Remettre en brouillon · Supprimer | Seulement sans aucune inscription. |

## 3. Inscriptions

**EVT-010** **Onglet Inscriptions.** En tête : places inscrites / capacité · liste d'attente · annulées · présents. Colonnes : Nom · E-mail · Téléphone · Places · État · Inscrit le · Sujets · Questions (extrait) · Fiche client (statut, dossier en cours) · Origine. Filtre par état. Recherche par nom, e-mail, code.

**EVT-011** **Actions** (`registration.manage`).

| Action | Règle |
|---|---|
| Inscrire quelqu'un | Recherche d'un client ou saisie (prénom, nom, e-mail, téléphone, places). Possible même après la clôture des inscriptions. S'il ne reste pas assez de places : « Inscrire sur la liste d'attente », ou augmenter d'abord la capacité — la capacité n'est **jamais** dépassée (MOD-410). |
| Modifier les places | CYC-187. |
| Annuler | Raison ; l'inscrit reçoit `C_CAFE_REGISTRATION_CANCELLED`. |
| Promouvoir | Fait passer une inscription en attente à « Inscrit », s'il y a la place ; possible à tout moment, y compris dans les 12 dernières heures. |
| Renvoyer la confirmation | Même e-mail, même code. |
| Ouvrir la fiche client | — |
| Créer une demande de rappel | Crée une demande `CALLBACK_REQUEST` d'origine `CAFE` au nom de l'inscrit ; elle ouvre ou rejoint un dossier (CYC-002). |

**EVT-012** **Export** (`registration.export`) : la liste des inscrits en CSV ou XLSX (BO-041). **Imprimer la feuille de présence** : nom, places, code, case de présence — secours si le réseau manque sur place. **Imprimer les questions** : les questions des inscrits, **sans** leurs coordonnées, à remettre au promoteur et au banquier pour préparer la rencontre.

**EVT-013** **Onglet Communications** : pour ce Café, le nombre d'e-mails partis par modèle (confirmation, rappels, changement…), les **prochains envois** prévus avec leur date (rappel à J−7, rappel la veille, suivi du lendemain), et « Écrire aux inscrits » : un e-mail manuel à tous les inscrits `REGISTERED`, pour une information pratique sur ce Café (COM-020) — il ne dépend pas de l'accord pour les actualités, puisqu'il concerne leur inscription.

## 4. Pointage (EA-82)

**EVT-050** Écran conçu pour un **téléphone** ou une tablette, à l'entrée du Café. Ouvert de 2 heures avant le début à 24 heures après la fin (CYC-185). En tête : « Présents : {n} / {inscrits} ».

**EVT-051** **Trois façons de pointer.**
- **Scanner le QR code** de l'inscrit avec l'appareil photo : l'adresse du code ouvre la fiche de l'inscrit dans cet écran (CAF-051).
- **Chercher** : par nom, e-mail ou code d'accueil.
- **Parcourir la liste** des inscrits, par ordre alphabétique.

La fiche d'un inscrit montre : son nom, ses places, ses sujets d'intérêt, et le bouton **« Confirmer la présence »**, avec le nombre de personnes venues (de 1 à ses places).

**EVT-052** **Cas rencontrés à l'entrée.**

| Cas | Écran |
|---|---|
| Déjà pointé | « Déjà pointé à {heure} par {prénom}. » · « Annuler le pointage ». |
| Sur liste d'attente | « Sur liste d'attente. » · « Inscrire et pointer » s'il reste des places. |
| Inscription annulée | « Inscription annulée le {date}. » · « Réinscrire et pointer » s'il reste des places. |
| Code inconnu, ou code d'un autre Café | « Code inconnu pour ce Café. » · « Chercher par nom ». |
| Personne non inscrite | EVT-053. |

**EVT-053** **Visiteur sans inscription.** « Ajouter un participant » : prénom, nom, e-mail, téléphone (facultatif), places → inscription créée et pointée, s'il reste des places ; sinon l'écran demande d'augmenter la capacité (rôle `event.manage`). Si la personne ne souhaite pas laisser d'adresse : « Compter un visiteur » augmente le compteur des visiteurs non inscrits (`walkInSeats`), sans créer de fiche.

**EVT-054** **Sans réseau** sur place : le pointage en ligne est impossible ; l'équipe utilise la feuille de présence imprimée (EVT-012), puis saisit les présents ensuite par « Saisir les présents » — la liste des inscrits avec une case par personne —, dans les 24 heures qui suivent la fin.

**EVT-055** Les absents ne sont marqués qu'**après** le délai de pointage, et seulement si au moins un pointage a été fait (CYC-185). Sans aucun pointage, la tâche « Pointer les présents » est créée (`R_CAFE_CHECKIN_MISSING`).

## 5. Bilan

**EVT-056** **Onglet Bilan**, disponible dès la fin du Café : capacité · places inscrites · présents · visiteurs non inscrits · absents · taux de présence · liste d'attente restante ; les sujets d'intérêt, en nombre ; les questions posées ; les résultats de l'enquête du Café (PAR-070) ; et le **suivi** : la liste des présents avec, pour chacun, « a un dossier », « a demandé à être rappelé », la date du dernier contact, et l'action « Créer une demande de rappel ». Les demandes envoyées par les présents dans les 30 jours sont comptées (M20).

## 6. Demandes « Me prévenir »

**EVT-060** Liste des demandes (`EventNotifyRequest`) : E-mail · Lieu souhaité · Café visé · Demandée le · Prévenue le. Une demande se supprime. Les demandes servies sont purgées 90 jours après l'envoi.

## 7. Droits

**EVT-070** Créer, modifier, publier, annuler un Café : `event.manage` (Direction, Administrateur). Inscrire, annuler, pointer : `registration.manage` (conseillers compris). Exporter les inscrits : `registration.export`. Lecture : `event.read` ; le rôle Support voit les compteurs, pas les coordonnées.
