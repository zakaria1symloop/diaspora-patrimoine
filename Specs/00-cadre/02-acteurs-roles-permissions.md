# Acteurs, rôles et permissions

## 1. Les acteurs

| Acteur | Qui | Accès | Phase |
|---|---|---|---|
| **Visiteur** | Toute personne sur le site sans être connectée | Site public, simulateurs, formulaires | `[P1]` |
| **Client** | Acquéreur ou futur acquéreur avec un compte | Espace client (web, puis mobile) | `[P1]` |
| **Co-emprunteur, garant** | Personne associée au dossier d'un client | Aucun compte : ses informations et ses pièces sont gérées par le client et le conseiller | `[P1]` |
| **Proche** | Personne de confiance du client (visite sur place, aide) | Aucun compte : coordonnées notées sur la fiche du client | `[P1]` |
| **Personnel de Diaspora Patrimoine** | Direction, administrateurs, conseillers | Back-office | `[P1]` |
| **Support technique** | Ingénieurs SYMLOOP | Back-office, accès restreint | `[P1]` |
| **Interlocuteur d'un promoteur ou d'une banque** | Personne chez un partenaire, sans compte | Niveau 1 d'accès (`00-cadre/06`) : il reçoit les e-mails de l'équipe, et, pour une banque, télécharge un dossier soumis par une page sécurisée (lien et code) ; ses réponses sont saisies par l'équipe | `[P1]` |
| **Le même, au niveau 2** | Interlocuteur marqué « Répond aux demandes » | Il répond lui-même à ce qu'on lui demande, par un lien sécurisé (ROL-041) | `[P2]` promoteur · `[P3]` banque |
| **Utilisateur promoteur** | Salarié d'un promoteur partenaire, au niveau 3 | Portail promoteur | `[P2]` |
| **Utilisateur banque** | Analyste ou responsable d'une banque partenaire, au niveau 3 | Portail banque | `[P3]` |
| **Système** | Tâches planifiées, automatisations, webhooks | — | `[P1]` |

Dans tout le produit, le mot **« conseiller »** désigne côté client la personne de Diaspora Patrimoine qui suit son dossier (rôle `AGENT` ou `ADMIN`). Le contrat emploie « Administrateur » pour l'ensemble du personnel.

## 2. Comptes, organisations, appartenances

Le modèle d'accès repose sur trois tables (`01-domaine/02`) :

- `User` : une personne qui se connecte. Un e-mail = un compte.
- `Organization` : Diaspora Patrimoine elle-même (type `OPERATOR`, une seule ligne), chaque promoteur (`PROMOTER`), chaque banque (`BANK`).
- `Membership` : le lien entre un `User` et une `Organization`, avec un **rôle**.

**ROL-001** `[P1]` Un compte a une **nature** fixée à sa création (`User.kind`) : `CLIENT`, `STAFF` (personnel de l'opérateur) ou `PARTNER` (promoteur ou banque). Elle ne change jamais.

**ROL-002** `[P1]` Un compte `CLIENT` possède une fiche `Client` et aucune appartenance. Un compte `STAFF` possède exactement une appartenance, à l'organisation `OPERATOR`. Un compte `PARTNER` possède une ou plusieurs appartenances à des organisations `PROMOTER` ou `BANK` — ou aucune tant que sa candidature n'est pas acceptée (ACP-084).

**ROL-003** `[P1]` Une adresse e-mail ne peut servir qu'à **un seul** compte, toutes natures confondues. Un membre du personnel qui veut tester l'espace client utilise une autre adresse.

**ROL-004** `[P1]` Chaque nature a sa propre application et sa propre session : site public et espace client pour `CLIENT`, back-office pour `STAFF`, portails pour `PARTNER`. Une session d'une nature est refusée par les routes d'une autre (réponse `403`). Un compte `PARTNER` naît à l'inscription du partenaire (ACP-080) ; jusqu'au portail, sa seule application est l'espace partenaire du site (EP-33, audience `PARTNER`), qui ne donne accès à aucun objet (ACP-085). Les interlocuteurs ajoutés par l'équipe n'ont pas de compte avant le niveau 3 (`00-cadre/06`).

## 3. Rôles du personnel (organisation `OPERATOR`)

| Rôle | Libellé affiché | Pour qui | En bref |
|---|---|---|---|
| `OWNER` | Direction | Mme Mouhoubi et toute personne qu'elle désigne | Tout, y compris la gestion des autres directions et les paramètres sensibles |
| `ADMIN` | Administrateur | Responsable opérationnel | Tout le back-office, sauf la gestion des comptes Direction |
| `AGENT` | Conseiller | Personne qui suit les clients et les dossiers | Demandes, clients, dossiers, pièces, soumissions, communication ; catalogue en lecture |
| `VIEWER` | Lecture seule | Associé, stagiaire, auditeur | Consultation, sans fichiers de pièces ni données sensibles, sans export |
| `SUPPORT` | Support technique | SYMLOOP | Diagnostic technique ; données personnelles masquées |

**ROL-010** `[P1]` Il existe toujours **au moins un** compte `OWNER` actif. La suppression, la suspension ou le changement de rôle du dernier `OWNER` est refusé avec le message « Il doit rester au moins un compte Direction. ». Le contrôle se fait **sous verrou** (FIA-020) : si deux Directions se retirent le rôle l'une à l'autre au même instant, la seconde opération est refusée. Si le seul compte Direction perd l'accès (téléphone perdu, adresse fermée), il se rétablit par une commande d'exploitation tracée, jamais par un compte de secours (ADM-040).

**ROL-011** `[P1]` Seul un `OWNER` peut créer, modifier, suspendre ou supprimer un compte `OWNER`.

**ROL-012** `[P1]` Tout changement de rôle, toute invitation, suspension, réactivation ou suppression de compte — et, pour un compte du personnel, tout changement d'adresse e-mail, toute réinitialisation de sa double authentification par un tiers, tout rétablissement (ADM-040) — est écrit dans le journal d'audit et notifié par e-mail aux comptes `OWNER` (`NS_TEAM_CHANGE`, `S_TEAM_CHANGE`).

**ROL-013** `[P1]` Un changement de rôle prend effet **immédiatement** : les sessions ouvertes du compte concerné sont révoquées, il doit se reconnecter.

**ROL-014** `[P1]` La visibilité des conseillers dépend du paramètre `access.agentScope` :
- `ALL` (par défaut) : un conseiller voit toutes les demandes, tous les clients et tous les dossiers ;
- `ASSIGNED_ONLY` : il voit ce qui lui est affecté, plus les demandes non affectées. Les recherches et les listes n'affichent pas le reste ; une adresse directe renvoie `404`.

**ROL-018** `[P1]` **Périmètre restreint : ce qui suit le dossier.** En mode `ASSIGNED_ONLY`, un conseiller voit :
- un **dossier** s'il en est le conseiller ;
- un **client** s'il en est le conseiller référent, ou s'il suit l'un de ses dossiers ou l'une de ses demandes — il voit donc toujours le client de son propre dossier, même si le référent est un collègue ;
- une **demande** qui lui est affectée, ou qui n'est affectée à personne ;
- et tout ce qui **se rattache** à un dossier ou à un client qu'il voit : pièces et fichiers, soumissions, simulations, échanges tracés, messagerie, rendez-vous, tâches, retours. Ces objets n'ont pas de visibilité propre : ils suivent celle de leur dossier, à défaut de leur client. Un retour qui n'a ni dossier ni client (erreur signalée sur une fiche, FBK-005) est visible de tous ceux qui ont `feedback.read`. Les permissions marquées ¹ dans la matrice appliquent cette règle.

Ce qu'il ne voit pas ne se devine pas : la détection des doublons ne nomme ni la fiche ni son conseiller (« Une fiche existe déjà pour ces coordonnées. Elle est suivie par un autre conseiller : adressez-vous à un administrateur. », CRM-041), et les compteurs des listes ne comptent que son périmètre.

**ROL-015** `[P1]` **Lecture à données masquées.** Le rôle `SUPPORT` ne voit jamais le contenu d'une pièce, d'un message ou d'une note. Partout — listes, fiches, chronologies, journal d'audit, journal des e-mails —, les noms, e-mails, téléphones, adresses et montants sont **masqués** (`N••••• B•••••`, `n•••@•••.fr`, `+33 • •• •• •• 78`, `•••`), et tout **texte libre** écrit par une personne (note, message, compte rendu, objet et corps d'un e-mail, titre et description d'une tâche manuelle, motif saisi, nom d'un fichier déposé) est remplacé par « Contenu masqué ». Le masquage est fait **par le serveur** : la valeur ne quitte pas l'API. Un compte Support ne peut ni chercher ni trier sur un champ masqué (il cherche par référence ou par identifiant), ni exporter. Il voit les identifiants, les références, les statuts, les dates et les journaux techniques. La liste des champs masqués est celle de SEC-032.

**ROL-016** `[P1]` **Accès exceptionnel.** Un `OWNER` peut accorder à un compte `SUPPORT` un rôle `ADMIN` temporaire, avec une date de fin obligatoire (au plus 72 heures) et un motif. À l'échéance le rôle revient à `SUPPORT` sans intervention. L'octroi, chaque action faite pendant la période et la fin sont tracés ; les `OWNER` reçoivent un e-mail à l'octroi et à la fin.

**ROL-017** `[P1]` **Voir comme le client.** Les rôles qui ont la permission `client.impersonate` peuvent ouvrir l'espace client d'un client en **lecture seule**. Un bandeau permanent indique « Vous consultez l'espace de {prénom nom} en lecture seule ». Aucune action n'est possible (boutons désactivés, routes d'écriture refusées : `403 FORBIDDEN`, raison `PREVIEW_READ_ONLY`). L'ouverture est tracée ; le client n'est pas notifié.

Mécanisme (l'espace client n'accepte que des sessions de nature `CLIENT`, ROL-004) :
1. le back-office demande un **code d'aperçu** pour ce client : à usage unique, valable 60 secondes, lié au membre du personnel qui le demande ;
2. il ouvre l'espace client dans un nouvel onglet avec ce code ; l'application web l'échange contre une **session d'aperçu** : un cookie distinct de celui d'un vrai client, valable **30 minutes**, non renouvelable, qui porte l'identité du membre du personnel (`Session.impersonatedById`) ;
3. cette session n'est **pas** une session du client : elle ne compte pas dans ses dix sessions (SEC-025), n'apparaît pas dans « Appareils connectés » (PRO-021), et ne fait pas de l'appareil du conseiller un appareil reconnu du compte (AUTH-033). Elle n'ouvre que les **lectures** de l'espace client. Lire ne laisse **aucune trace côté client** : un message n'est pas marqué lu, un bien proposé ne passe pas « vu », une notification reste non lue, la date de dernière connexion ne bouge pas ;
4. ouvrir le fichier d'une pièce demande en plus `document.file.read` ; sinon la pièce apparaît sans son fichier ;
5. « Quitter l'aperçu », la fin des 30 minutes ou la fermeture de l'onglet terminent la session. Début et fin sont écrits au journal d'audit, avec le client consulté.

Un aperçu ne permet jamais de se connecter « à la place » du client : aucune écriture, aucun lien de connexion, aucun changement de mot de passe.

## 4. Matrice des permissions du personnel

Légende : ● oui · ◐ oui, limité (voir la note) · — non.

### 4.1 Demandes, clients, dossiers

| Permission | Action | OWNER | ADMIN | AGENT | VIEWER | SUPPORT |
|---|---|---|---|---|---|---|
| `lead.read` | Voir les demandes entrantes | ● | ● | ◐ ¹ | ● | ◐ ² |
| `lead.create` | Saisir une demande reçue par téléphone, par WhatsApp ou en rendez-vous | ● | ● | ● | — | — |
| `lead.assign` | Affecter une demande | ● | ● | ◐ ³ | — | — |
| `lead.process` | Traiter, clôturer, marquer comme indésirable | ● | ● | ● | — | — |
| `client.read` | Voir les fiches clients | ● | ● | ◐ ¹ | ● | ◐ ² |
| `client.sensitive.read` | Voir revenus, charges, apport, date de naissance | ● | ● | ● | — | — |
| `client.create` | Créer un client | ● | ● | ● | — | — |
| `client.update` | Modifier un client ; écarter un doublon signalé (« Ce n'est pas un doublon ») | ● | ● | ● | — | — |
| `client.assign` | Changer le conseiller référent d'un client | ● | ● | ◐ ³ | — | — |
| `client.invite` | Inviter un client à ouvrir son espace, renvoyer son lien d'activation | ● | ● | ● | — | — |
| `client.account.manage` | Agir sur le compte d'un client : fermer ses sessions, désactiver sa double authentification, corriger son adresse de connexion, suspendre ou rétablir le compte | ● | ● | — | — | — |
| `client.merge` | Fusionner deux fiches | ● | ● | — | — | — |
| `client.archive` | Archiver un client | ● | ● | — | — | — |
| `client.export` | Exporter la liste des clients | ● | ● | — | — | — |
| `client.impersonate` | Voir comme le client (lecture seule) | ● | ● | ● | — | — |
| `dossier.read` | Voir les dossiers | ● | ● | ◐ ¹ | ● | ◐ ² |
| `dossier.create` | Ouvrir un dossier | ● | ● | ● | — | — |
| `dossier.update` | Modifier un dossier | ● | ● | ● | — | — |
| `dossier.assign` | Changer le conseiller d'un dossier | ● | ● | ◐ ³ | — | — |
| `dossier.transition` | Faire avancer d'une étape, mettre en pause, reprendre | ● | ● | ● | — | — |
| `dossier.transition.backward` | Faire reculer d'une étape | ● | ● | — | — | — |
| `dossier.close` | Clôturer : gagné ou perdu | ● | ● | ● | — | — |
| `dossier.reopen` | Rouvrir un dossier clôturé | ● | ● | — | — | — |
| `dossier.delete` | Supprimer un dossier ouvert par erreur | ● | ● | — | — | — |
| `dossier.export` | Exporter la liste des dossiers | ● | ● | — | — | — |
| `dossier.commission.manage` | Voir et saisir la commission et les honoraires d'un dossier (Q-001) | ● | ● | — | — | — |
| `candidate.manage` | Proposer des biens, suivre visites et retours | ● | ● | ● | — | — |
| `reservation.manage` | Poser une option, enregistrer une réservation, l'annuler | ● | ● | ● | — | — |
| `reservation.override` | Prolonger une option au-delà du nombre de prolongations permis (PIP-050) | ● | ● | — | — | — |
| `note.read` | Lire les notes internes des objets qu'on voit | ● | ● | ● | ● | — |
| `note.manage` | Écrire des notes internes ; modifier ou supprimer les siennes | ● | ● | ● | — | — |
| `note.moderate` | Supprimer la note interne d'un collègue (BO-055) | ● | ● | — | — | — |

### 4.2 Pièces et financement

| Permission | Action | OWNER | ADMIN | AGENT | VIEWER | SUPPORT |
|---|---|---|---|---|---|---|
| `document.read` | Voir la liste des pièces et leur statut | ● | ● | ◐ ¹ | ● | ◐ ² |
| `document.file.read` | Ouvrir ou télécharger le fichier d'une pièce, ou une pièce jointe de la messagerie | ● | ● | ◐ ¹ | — | — |
| `document.request` | Ajouter une pièce à la liste d'un dossier, réévaluer la liste, relancer le client, suspendre les relances | ● | ● | ● | — | — |
| `document.upload` | Déposer une pièce pour le compte du client | ● | ● | ● | — | — |
| `document.validate` | Valider, rejeter, annuler une validation | ● | ● | ● | — | — |
| `document.waive` | Dispenser d'une pièce | ● | ● | ● | — | — |
| `document.delete` | Supprimer une version de pièce | ● | ● | — | — | — |
| `consent.record` | Enregistrer un accord donné hors de la plateforme (accord de transmission, accord d'un co-emprunteur), avec sa preuve | ● | ● | ● | — | — |
| `checklist.manage` | Gérer les modèles de listes de pièces | ● | ● | — | — | — |
| `submission.read` | Voir les soumissions bancaires | ● | ● | ◐ ¹ | ● | ◐ ² |
| `submission.manage` | Préparer une soumission, suivre la banque, enregistrer la réponse du client, retirer une soumission | ● | ● | ● | — | — |
| `submission.share` | Faire sortir les pièces vers la banque : envoyer le dossier (lien sécurisé ou transmission hors plateforme), transmettre un complément, télécharger le paquet, gérer les liens (BNK-110) | ● | ● | ● | — | — |
| `submission.decide` | Enregistrer la décision de la banque, la corriger, prolonger une offre | ● | ● | ● | — | — |
| `simulation.read` | Voir les simulations d'un client (pour `VIEWER` : sans les revenus, charges et apport saisis, ROL-019) | ● | ● | ◐ ¹ | ◐ ⁹ | — |
| `simulation.create` | Lancer une simulation pour un client ; créer une projection | ● | ● | ● | — | — |

### 4.3 Catalogue et partenaires

| Permission | Action | OWNER | ADMIN | AGENT | VIEWER | SUPPORT |
|---|---|---|---|---|---|---|
| `catalogue.read` | Voir programmes, biens, lots, médias (brouillons compris) | ● | ● | ● | ● | ● |
| `catalogue.write` | Créer et modifier programmes, biens, lots, médias | ● | ● | ◐ ⁴ | — | — |
| `catalogue.publish` | Publier, dépublier, archiver, désarchiver ; épingler un bien sur l'accueil ; corriger une vente hors plateforme saisie par erreur | ● | ● | — | — | — |
| `catalogue.eligibility.manage` | Dire quelles banques acceptent de financer un programme ou un bien | ● | ● | — | — | — |
| `catalogue.import` | Importer une grille de lots | ● | ● | — | — | — |
| `catalogue.delete` | Supprimer un programme, un bien, un lot | ● | ● | — | — | — |
| `promoter.read` | Voir les fiches promoteurs | ● | ● | ● | ● | ● |
| `promoter.write` | Créer et modifier un promoteur, ses contacts, ses documents | ● | ● | — | — | — |
| `promoter.delete` | Supprimer un promoteur | ● | — | — | — | — |
| `partner.convention.manage` | Voir et modifier la convention et les conditions commerciales d'un promoteur ou d'une banque (`commissionTerms`, onglet Convention) | ● | ● | — | — | — |
| `partner.access.manage` `[P2]` `[P3]` | Changer le niveau d'accès d'un promoteur ou d'une banque ; désigner les interlocuteurs qui répondent par lien ; inviter son premier utilisateur au portail ; révoquer un lien (CYC-241) | ● | ● | — | — | — |
| `bank.read` | Voir les fiches banques et leurs produits | ● | ● | ● | ● | ● |
| `bank.write` | Créer et modifier une banque, ses contacts, ses documents | ● | ● | — | — | — |
| `bankproduct.write` | Gérer les barèmes (produits bancaires) | ● | ● | — | — | — |
| `bank.delete` | Supprimer une banque | ● | — | — | — | — |

### 4.4 Communication, tâches, événements

| Permission | Action | OWNER | ADMIN | AGENT | VIEWER | SUPPORT |
|---|---|---|---|---|---|---|
| `message.read` | Lire la messagerie avec les clients | ● | ● | ◐ ¹ | — | — |
| `message.send` | Écrire à un client dans la messagerie | ● | ● | ● | — | — |
| `email.send` | Envoyer un e-mail manuel depuis la plateforme | ● | ● | ● | — | — |
| `email.bulk` | Faire un envoi groupé aux clients qui ont accepté les actualités | ● | ● | — | — | — |
| `communication.read` | Voir le journal des envois et la chronologie | ● | ● | ◐ ¹ | ● | ◐ ² |
| `communication.log` | Noter un appel, un échange WhatsApp, une rencontre | ● | ● | ● | — | — |
| `template.manage` | Gérer les modèles d'e-mails | ● | ● | — | — | — |
| `task.read` | Voir les tâches | ● | ● | ◐ ⁵ | ● | — |
| `task.manage` | Créer, modifier, terminer ses tâches | ● | ● | ● | — | — |
| `task.manage.all` | Modifier et réaffecter les tâches des autres | ● | ● | — | — | — |
| `appointment.read` | Voir l'agenda et les rendez-vous | ● | ● | ◐ ¹ | ● | — |
| `appointment.manage` | Créer, confirmer, annuler un rendez-vous ; corriger son issue | ● | ● | ● | — | — |
| `view.share` | Partager une vue enregistrée avec toute l'équipe | ● | ● | — | — | — |
| `event.read` | Voir les Cafés et les inscriptions | ● | ● | ● | ● | ◐ ² |
| `event.manage` | Créer, modifier, publier, annuler un Café | ● | ● | — | — | — |
| `registration.manage` | Inscrire, annuler, pointer les présents | ● | ● | ● | — | — |
| `registration.export` | Exporter la liste des inscrits | ● | ● | — | — | — |
| `feedback.read` | Voir les retours et les réponses aux enquêtes | ● | ● | ◐ ¹ | ● | — |
| `feedback.manage` | Traiter un retour | ● | ● | ● | — | — |
| `survey.manage` | Gérer les enquêtes | ● | ● | — | — | — |

### 4.5 Contenus, pilotage, administration

| Permission | Action | OWNER | ADMIN | AGENT | VIEWER | SUPPORT |
|---|---|---|---|---|---|---|
| `content.manage` | Gérer pages, FAQ, témoignages, blocs de l'accueil, SEO | ● | ● | — | — | — |
| `report.read` | Voir le tableau de bord et les rapports | ● | ● | ◐ ⁶ | ● | — |
| `report.export` | Exporter un rapport | ● | ● | — | — | — |
| `workflow.manage` | Gérer les règles d'automatisation | ● | ● | — | — | — |
| `settings.read` | Voir les paramètres | ● | ● | — | — | ● |
| `settings.manage` | Modifier les paramètres courants | ● | ● | — | — | — |
| `settings.sensitive.manage` | Modifier sécurité, conservation des données, textes légaux | ● | — | — | — | — |
| `maintenance.manage` | Mettre le site en maintenance, l'en sortir | ● | ● | — | — | ● |
| `user.read` | Voir l'équipe (noms, rôles, état des comptes) | ● | ● | ● | ● | ● |
| `user.manage` | Inviter, modifier, suspendre un compte du personnel ; changer son adresse e-mail | ● | ◐ ⁷ | — | — | — |
| `user.twofactor.reset` | Réinitialiser la double authentification d'un membre du personnel | ● | — | — | — | — |
| `support.elevate` | Accorder un accès exceptionnel à un compte Support (ROL-016) | ● | — | — | — | — |
| `audit.read` | Consulter le journal d'audit | ● | ● | — | — | ◐ ⁸ |
| `audit.export` | Exporter le journal d'audit | ● | — | — | — | — |
| `trash.manage` | Restaurer un objet de la corbeille, ou le supprimer définitivement avant l'heure | ● | ● | — | — | — |
| `gdpr.manage` | Traiter les demandes d'exercice de droits : exporter, effacer, limiter le traitement des données d'une personne, lever une limitation | ● | ● | — | — | — |
| `support.diagnostics` | Voir l'état des files d'attente, des tâches planifiées, des envois ; relancer une tâche planifiée | ● | ● | — | — | ● |

Notes :

1. Selon `access.agentScope` (ROL-014).
2. Données personnelles masquées (ROL-015).
3. Un conseiller ne peut l'affecter qu'à **lui-même** : devenir le référent d'un client qui n'en a pas, reprendre un dossier sans conseiller. Pour une demande, « Prendre en charge » et « Rendre » relèvent de `lead.process` (CRM-011) : `lead.assign` ne lui ajoute rien. Un dossier ne se « rend » pas : il change de conseiller (PIP-026).
4. Selon le paramètre `access.agentCanEditCatalogue` (par défaut : non). Quand il est activé, le conseiller modifie sans pouvoir publier.
5. Ses tâches et celles des dossiers qu'il voit.
6. Indicateurs limités à son propre périmètre (ses demandes, ses dossiers).
7. Tous les comptes sauf `OWNER` (ROL-011).
8. Familles Connexion et Système du journal seulement (SEC-080, ADM-052) ; pas les consultations de dossiers.
9. Résultats seulement ; les montants saisis sont masqués (ROL-019).

**ROL-019** `[P1]` **Une donnée sensible l'est partout.** Revenus, charges, apport, date de naissance, situation professionnelle et montants d'une offre de financement ne se lisent qu'avec `client.sensitive.read`, **où qu'ils soient enregistrés** : fiche du client, emprunteurs du dossier, contenu d'une demande, entrées d'une simulation, soumission bancaire, projection, export. Pour un rôle qui ne l'a pas (`VIEWER`), l'API les omet et les nomme dans `withheld` (API-002), et l'écran affiche « Réservé ». La liste des champs concernés, entité par entité, est en SEC-033. De même, la **chronologie** d'un client ou d'un dossier (BO-050) ne montre une ligne que si le lecteur a la permission de sa **source** : un message demande `message.read`, un e-mail ou un appel `communication.read`, une note `note.read`, une pièce `document.read` ; les lignes qu'il ne peut pas lire n'apparaissent pas, sans trou visible.

**ROL-023** `[P1]` **Chaque écran de liste dit son droit.** Une entrée du menu du back-office (BO-011) n'apparaît que si le rôle a la permission de son module. Le tableau de bord est ouvert à tous : son contenu dépend du rôle (TDB-001). Relation client : Demandes `lead.read` · Clients `client.read`. Dossiers : Pipeline et Tous les dossiers `dossier.read`. Organisation : Tâches `task.read` · Agenda `appointment.read`. Catalogue : Programmes, Biens, Médias, Mise en avant `catalogue.read` · Import de lots `catalogue.import` · Promoteurs `promoter.read` · Autres partenaires `content.manage`. Financement : Soumissions `submission.read` · Banques (et sa vue « Tous les produits ») `bank.read` · Taux de change `settings.read`. Pièces : À vérifier et Recherche de pièces `document.read` · Modèles de listes `checklist.manage`. Communication : Messagerie `message.read` · Envois `communication.read` · Envoi groupé `email.bulk` · Modèles `template.manage` · Automatisations `workflow.manage`. Le Café : Cafés `event.read`. Satisfaction : Retours `feedback.read` · Enquêtes `survey.manage`. Contenus : Textes du site, Pages, Questions fréquentes, Témoignages, Textes légaux, Redirections `content.manage`. Pilotage : Rapports `report.read`. Administration : Équipe `user.read` · Paramètres et Référentiels `settings.read` · Journal d'audit `audit.read` · Données personnelles `gdpr.manage` · Corbeille `trash.manage` · Imports et exports `catalogue.import` ou l'une des permissions d'export · Diagnostic `support.diagnostics`. Les simulations d'un client n'ont pas d'entrée de menu : elles se lisent dans sa fiche (`simulation.read`). Un rôle qui voit une liste sans pouvoir y agir la voit sans ses boutons d'action.

**ROL-020** `[P1]` Les permissions sont vérifiées **côté serveur** sur chaque route. L'interface masque les actions interdites, mais ne constitue jamais la protection.

**ROL-021** `[P1]` Une action refusée renvoie `403` avec le code `FORBIDDEN` ; l'interface affiche « Vous n'avez pas le droit de faire cette action. Adressez-vous à un administrateur. ».

**ROL-022** `[P1]` La matrice est **codée en dur** dans une table de correspondance rôle → permissions, côté serveur, et testée. Il n'y a pas d'éditeur de rôles en Phase 1. `[V2]` Rôles personnalisés.

## 5. Droits du client

**ROL-030** `[P1]` Un client n'accède qu'à **ses** données : son profil, ses demandes, ses biens proposés, ses dossiers, ses pièces, ses messages, ses simulations, ses inscriptions aux Cafés, ses rendez-vous, ses favoris, ses alertes, ses retours. Toute route de l'espace client filtre sur le client de la session ; un identifiant qui n'est pas le sien renvoie `404` (jamais `403`, pour ne pas révéler l'existence de la ressource).

**ROL-031** `[P1]` Le client **ne voit jamais** : les notes internes, les tâches, le score de préqualification, le motif interne de perte d'un dossier, les échanges entre le conseiller et la banque ou le promoteur, le nom de la personne de la banque, la commission.

**ROL-032** `[P1]` Le client voit sur son dossier : l'étape, les pièces et leur statut (avec le motif d'un rejet), le nom et la photo de son conseiller, le nom des banques sollicitées et le statut de chaque soumission, les conditions d'un accord, ses rendez-vous.

**ROL-033** `[P1]` Tant que l'adresse e-mail du compte n'est pas vérifiée, le client ne peut pas entrer dans l'espace client (`03-espace-client/01`, AUTH-012).

## 6. Partenaires : trois niveaux d'accès

Un promoteur ou une banque a l'un de trois niveaux d'accès (`00-cadre/06`) : au **niveau 1**, l'équipe saisit pour lui — c'est la Phase 1 ; au **niveau 2**, ses interlocuteurs répondent par un lien sécurisé, sans compte ; au **niveau 3**, ils ont un compte et un portail. Les rôles ci-dessous n'existent qu'au niveau 3 : mêmes noms que ceux du personnel, portée limitée à l'organisation d'appartenance.

| Organisation | `ADMIN` | `AGENT` | `VIEWER` |
|---|---|---|---|
| Promoteur `[P2]` | Gère l'équipe du promoteur, le catalogue, les réservations | Commercial : catalogue, lots, demandes sur ses programmes | Consultation |
| Banque `[P3]` | Gère l'équipe de la banque, les barèmes proposés, décide | Analyste : étudie, demande des compléments, propose une décision | Consultation |

**ROL-041** `[P2]` `[P3]` **L'interlocuteur qui répond par lien** (niveau 2) n'est pas un compte : c'est une ligne de contact du partenaire (`PromoterContact`, `BankContact`) marquée « Répond aux demandes ». Il n'a aucun rôle ni aucune permission ; son droit tient tout entier dans le lien qu'il a reçu — un objet, des gestes, une durée (ACP-041). Ses actions sont tracées avec `actorType = LINK` et le nom du contact.

**ROL-040** `[P2]` `[P3]` Un utilisateur partenaire ne voit que les données rattachées à **son** organisation : ses programmes et lots, les demandes et dossiers qui portent sur ses biens (promoteur), les soumissions qui lui sont adressées (banque). Le détail est dans `05-phases-ulterieures/01` et `02`.

## 7. Le compte « Système »

**ROL-050** `[P1]` Les actions faites par une automatisation, une tâche planifiée ou un webhook sont enregistrées avec `actorType = SYSTEM` (ou `WEBHOOK`) et sans utilisateur. Dans l'interface, l'auteur affiché est « Automatique ».
