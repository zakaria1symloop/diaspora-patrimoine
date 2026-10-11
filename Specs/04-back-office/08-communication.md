# Back-office — communication

Écrans **EA-70** (messagerie), **EA-71** (journal des envois), **EA-72** et **EA-73** (modèles d'e-mail), **EA-74** et **EA-75** (automatisations), **EA-76** (envoi groupé). Contrat : offre technique, § 4.7 — modèles paramétrables, envoi manuel ou déclenché, journal et statuts, relances automatiques, chronologie par dossier, notifications internes.

Ce qui part, quand et avec quel texte : `01-domaine/08` et `01-domaine/09`. Ce fichier décrit les écrans qui permettent de **voir, écrire et régler**.

---

## 1. Messagerie (EA-70)

**COM-001** `[P1]` **Liste des fils** (`message.read`). Colonnes : Client · Dossier · Dernier message (extrait, deux lignes) · Date · Non lus · **En attente de réponse** depuis {durée}. Vues d'origine : « À répondre » (fils où le dernier message **écrit par une personne** vient du client, dans mon périmètre — vue par défaut ; un message automatique inséré dans le fil ne fait pas sortir une question de cette vue, AUT-020) · « Mes fils » · « Sans conseiller » (clients sans conseiller affecté, ou dont le conseiller n'est plus en poste) · « Tous ». Ordre de « À répondre » : l'attente la plus longue d'abord.

**COM-002** `[P1]` Les rôles Lecture seule et Support n'ont pas accès à la messagerie — ni à l'écran, ni aux messages repris dans une chronologie (ROL-019). Un conseiller voit tous les fils (ROL-014) ; en périmètre restreint, ceux de son périmètre (ROL-018).

**COM-010** `[P1]` **Un fil.** Même présentation que côté client (MSG-010 à MSG-016), vue de l'autre bord. En plus :
- l'en-tête montre le client, son dossier, son heure locale, et « Lu par le client le {date} » pour le dernier message de l'équipe ;
- chaque pièce jointe du client porte « Classer dans une pièce » (GED-050) ;
- un bouton « Ajouter une note interne » écrit une **note** (BO-055), pas un message ;
- tout membre de l'équipe qui a le droit peut répondre ; le message porte son nom.

Le fil est marqué lu par l'équipe dès qu'un membre l'ouvre.

**COM-011** `[P1]` **Client sans espace actif** : il ne peut pas lire un message. La zone de saisie est remplacée par : « {client} n'a pas encore d'espace : il ne verrait pas votre message. » (le serveur refuse un message vers ce client : raison `CLIENT_NO_ACTIVE_SPACE`) · boutons « Inviter le client » (CRM-070) · « Lui envoyer un e-mail » (COM-020).

**COM-012** `[P1]` La messagerie n'envoie rien par WhatsApp. Si un client répond par un autre canal, le conseiller le **note** (CRM-031, COM-030).

## 2. Écrire un e-mail (COM-020)

**COM-020** `[P1]` **Fenêtre d'envoi** (`email.send`), ouverte depuis un client, une demande, un dossier, une soumission, un promoteur ou une banque.

| Champ | Règles |
|---|---|
| Destinataire | Selon l'endroit d'où la fenêtre est ouverte : le **client** (son adresse, non modifiable ; absente : la fenêtre ne s'ouvre pas, MOD-302) ; un **contact du partenaire** (promoteur ou banque ; un second contact du même partenaire peut être mis en copie) ; la **personne qui a signalé une erreur** et laissé son adresse (depuis un retour, FBK-005) ; le **demandeur** d'un exercice de droits qui n'a pas de fiche (ADM-063) ; l'**auteur d'une candidature de partenaire** (`Lead.email`, depuis la demande `PARTNER_REQUEST` ; modèle « Message libre »). Pas de copie pour un e-mail à un client. L'e-mail se rattache à l'objet d'où il part (`Communication` : client, dossier, promoteur, banque, retour, demande d'exercice de droits, candidature de partenaire) et figure dans sa chronologie. |
| Modèle | Les modèles « Manuel » du public concerné, et « Message libre ». |
| Objet · Corps | Préremplis par le modèle, **modifiables pour cet envoi**. Même format que le corps d'un modèle (NOT-061) : gras, italique, listes, liens, et le bouton du modèle. Les champs dynamiques sont déjà remplacés par leurs valeurs. |
| Pièces jointes | Cinq fichiers, 10 Mo au total, depuis l'ordinateur ; chacun passe le contrôle de sécurité avant que l'e-mail parte (MED-021). Une pièce du dossier ne se joint **pas** (NOT-008) : pour transmettre un dossier à une banque, on passe par le lien sécurisé (BNK-111). |
| Envoi | « Envoyer » · « Envoyer plus tard » (date et heure). Un envoi différé s'annule tant qu'il n'est pas parti (état `CANCELLED` ; déjà parti : raison `EMAIL_ALREADY_SENT`). |

Un **aperçu** montre l'e-mail dans son habillage. Avertissements avant l'envoi : adresse en erreur (NOT-014) ; client « Ne pas contacter » (CRM-060) ; traitement limité (ADM-063 : seul un e-mail qui répond à sa demande est permis) ; adresse douteuse. Un envoi différé est **revérifié à l'heure du départ** : si entre-temps le client s'est opposé au contact, a été archivé ou effacé, l'e-mail ne part pas (état `SUPPRESSED`, avec la raison) et son auteur en est notifié.

**COM-021** `[P1]` L'e-mail part au nom de Diaspora Patrimoine (`mail.fromName`, `mail.fromAddress`), avec `mail.replyTo` pour les réponses. Il est signé du conseiller : « {Prénom N.} — {fonction} », puis sa signature (BO-070).

**COM-022** `[P1]` Après l'envoi : l'e-mail figure dans la chronologie avec son état ; un e-mail manuel à un client vaut **premier contact** (CYC-004). S'il échoue ou est rejeté, son auteur est notifié (`NS_EMAIL_FAILED`).

**COM-030** `[P1]` **Noter un e-mail reçu.** Les réponses des clients arrivent dans la boîte `mail.replyTo`, hors plateforme (NOT-003). « Noter un e-mail reçu » en garde la trace : date, objet, texte collé, fichiers éventuels. L'entrée paraît dans la chronologie comme un e-mail entrant.

## 3. Journal des envois (EA-71)

**COM-040** `[P1]` Tous les e-mails de la plateforme (`communication.read`). Colonnes : Date · Destinataire · Objet · Modèle · **Origine** (Manuel, par {auteur} · Événement · Règle {nom} · Système) · **État** · Client · Dossier. En tête, pour la période : envoyés, remis, rejetés (M18). Filtres : état, modèle, origine, période, destinataire, « en échec ».

| État | Sens |
|---|---|
| En file | Créé, pas encore remis au fournisseur ; ou programmé pour plus tard. |
| Envoyé | Remis au fournisseur. |
| Remis | Accepté par la messagerie du destinataire. |
| Adresse en erreur | Rejet définitif (AUT-071). |
| Signalé indésirable | Le destinataire a signalé l'e-mail. |
| Échec | Non parti, après tous les essais ; la raison est indiquée. |
| Annulé | Envoi différé annulé avant son départ (COM-020). |
| Non envoyé | Écarté par une condition d'arrêt (AUT-007) ; la raison est indiquée. |
| Ouvert · Cliqué | Seulement si le suivi est activé (NOT-015). |

**COM-041** `[P1]` **Détail d'un envoi** : le contenu tel qu'il est parti (habillage compris), ses pièces jointes, la suite de ses états avec leurs dates (`stateHistory`), la raison d'un échec, et, pour un envoi automatique, la règle ou l'événement qui l'a déclenché. **Exception, sans dérogation possible** : un lien à jeton ou un code — activation, connexion, mot de passe, invitation d'un collègue, lien et code d'un partage vers une banque, lien d'une enquête ou d'une inscription — n'est **jamais** conservé ni affiché. À sa place : « [lien personnel] » ou « [code] » (NOT-002). De même, l'extrait d'un message repris dans un e-mail « nouveau message » n'y est pas gardé : « [extrait du message] » (NOT-017). Lire le journal ne donne donc accès ni à un compte, ni à un dossier.

**COM-042** `[P1]` **Renvoyer.** Un e-mail en échec ou rejeté peut être renvoyé après correction de l'adresse : c'est un **nouvel** envoi, relié au premier (`Communication.resentFromId`). Un e-mail manuel repart avec son objet et son corps conservés ; un e-mail automatique est rendu de nouveau, avec la version courante du modèle et l'état courant des objets auxquels la ligne est rattachée, et prend la clé `{clé d'origine}:resend:{n}`. Un e-mail qui contient un lien à jeton (activation, mot de passe) ne se renvoie pas ici : on relance son parcours, qui produit un nouveau lien ; un e-mail dont le corps conservé contient « [extrait du message] » ne se renvoie pas non plus (raison `EMAIL_NOT_RESENDABLE`). Le rôle Support voit les états et les dates, pas le contenu ni l'adresse complète.

## 4. Modèles d'e-mail (EA-72, EA-73)

**COM-050** `[P1]` **Liste** (`template.manage`), par catégorie (`EmailTemplateCategory` : Compte, Demandes, Dossier, Pièces, Financement, Le Café, Enquêtes, Alertes, Interne, Partenaires, Actualités, Données personnelles, Envois libres). Colonnes : Nom · Code · Public · Envoyé par (`sentBy`) · Quand (`description`) · Actif · Modifié le. Catalogue et textes d'origine : NOT-040, NOT-060.

**COM-051** `[P1]` **Éditeur.**
- **Objet**, **texte d'aperçu** (la ligne grise que montre la messagerie), **corps** ;
- le corps suit NOT-061 : titres, paragraphes, gras, italique, listes, liens, un **bouton**, et les blocs du modèle montrés comme des étiquettes ; pas de couleurs ni de polices libres : l'habillage est commun (NOT-004) ;
- un **sélecteur de champs** insère un champ dynamique parmi ceux du modèle (NOT-050) ; un champ inconnu (`UNKNOWN_TEMPLATE_FIELD`), l'absence d'un champ **obligatoire** — le lien d'un e-mail à jeton — (`MISSING_REQUIRED_FIELD`) ou une erreur de syntaxe, bouton qui peut être rendu en plus d'un autre compris (NOT-061) (`INVALID_TEMPLATE_SYNTAX`), empêche l'enregistrement et dit lequel (TRV-064) ;
- **Aperçu** : avec des données d'exemple, ou avec un vrai client ou dossier choisi ; en version ordinateur et téléphone ; données d'exemple et champs que l'objet ne fournit pas : NOT-052 ;
- **Envoyer un test** : à ma propre adresse (NOT-052) ;
- **Versions** : les vingt dernières, avec leur auteur et leur date ; « Rétablir cette version » ; « Rétablir le texte d'origine ». Quand une mise à jour de l'application apporte un nouveau texte d'origine à un modèle que l'équipe avait modifié, l'éditeur le signale — « Une nouvelle version du texte d'origine existe » · « Comparer » — sans rien écraser (PAR-081).

**COM-052** `[P1]` **Activer, désactiver.** Un modèle « Système » ne se désactive pas (NOT-041 ; raison `TEMPLATE_IS_SYSTEM`). Désactiver un autre modèle annonce son effet : « Cet e-mail ne partira plus : {quand il part}. ».

**COM-053** `[P1]` **Modèles manuels.** « Créer un modèle » : nom, public (client ou partenaire), objet, corps ; code préfixé `M_` ; et son **usage** : « Envoi individuel par un conseiller » (sans groupe de préférences), ou « Envoi par une règle ou envoi groupé » — il faut alors choisir le **groupe de préférences** auquel il appartient (NOT-020), et son pied porte d'office « Gérer mes préférences ». Une règle n'accepte qu'un modèle qui a un groupe, un envoi groupé qu'un modèle du groupe « Actualités » (raison `TEMPLATE_HAS_NO_GROUP`) : aucun e-mail automatique ne part vers un client sans qu'il puisse s'en désinscrire (NOT-042). Un modèle du public « partenaire » n'a que l'usage individuel. Un modèle manuel se duplique et se supprime (suppression logique), sauf s'il sert à une règle (raison `IN_USE`).

## 5. Automatisations (EA-74, EA-75)

**COM-060** `[P1]` **Liste des règles** (`workflow.manage`). Colonnes : Nom · Quand (déclencheur) · Délai · Ce qu'elle fait · Active · Dernière exécution · Sur 30 jours : faites, ignorées, en échec. Les règles livrées d'origine (`01-domaine/08`, § 5 à § 7) portent la mention « D'origine ». Ces règles **fonctionnent avant que cet écran existe** : chaque module livre les siennes avec ses écrans (AUT-083) ; cet écran apporte leur réglage, pas leur existence.

**COM-061** `[P1]` **Une règle.**

| Zone | Contenu |
|---|---|
| Identité | Nom, description, active ou non. |
| Quand | Le déclencheur, choisi dans la liste des événements (AUT-010) des fonctions livrées et actives, chacun avec la phrase de sa colonne « Émis quand », sans ses renvois. |
| À condition que | Des conditions sur les objets de l'événement (AUT-020) : champ, opérateur, valeur ; « toutes » ou « au moins une ». |
| Après | Un délai : aucun, ou un nombre et son unité — minutes · heures · jours · heures ouvrées · jours ouvrés (`delayValue`, `delayUnit`, AUT-004). L'écran dit ce que cela donne : « 3 jours ouvrés après, soit par exemple le mercredi suivant pour un vendredi ». |
| Alors | Une à cinq actions (AUT-030 à AUT-034) : envoyer un e-mail · créer une tâche · notifier l'équipe · envoyer une enquête. |

Une règle **d'origine** garde son déclencheur ; on peut la désactiver, changer son délai, ses conditions, le modèle d'e-mail, le titre, la priorité et le destinataire d'une tâche. « Rétablir la règle d'origine » annule ces réglages. Une règle créée ici se modifie librement et se supprime (son journal reste lisible) ; une règle d'origine ne se supprime pas (raison `RULE_IS_SYSTEM`). Modifier une règle vaut aussi pour ses exécutions déjà en attente : à leur échéance, c'est la règle du moment qui s'applique (AUT-004) — sauf le délai, qui ne vaut que pour les événements suivants : une exécution en attente garde sa date.

**COM-062** `[P1]` **Essayer une règle.** « Essayer sur… » : on choisit un objet réel (un dossier, une demande) ; l'écran dit si les conditions seraient remplies, et ce que chaque action ferait — destinataire, texte de l'e-mail, titre de la tâche — **sans rien envoyer ni créer**. L'essai rejoue le dernier événement de ce déclencheur pour cet objet que garde la boîte d'envoi (30 jours) ; s'il n'y en a pas, les conditions sur `event.data.*` s'affichent « Non évaluable sans événement » et sont tenues pour vraies, ce que l'écran dit. Il donne aussi la date d'exécution que fixerait le délai.

**COM-063** `[P1]` **Journal d'une règle** : ses exécutions — date prévue, date réelle, objet (lien), état (`PENDING`, `DONE`, `SKIPPED`, `FAILED`), raison. Une exécution en attente peut être **annulée** : elle passe `SKIPPED`, raison « Annulée par {nom} » ; une exécution qui n'est plus en attente ne s'annule pas (raison `EXECUTION_NOT_PENDING`).

**COM-064** `[P1]` Désactiver une règle d'origine annonce son effet : « Les clients ne recevront plus de relance automatique pour leurs pièces. » pour `R_DOC_REMINDER`, « {nom} ne s'appliquera plus. » pour les autres (`01-domaine/08`, § 5). Les exécutions déjà en attente sont ignorées à leur échéance si la règle est toujours désactivée (« Règle désactivée ») ; réactivée d'ici là, elles s'exécutent (AUT-004).

## 6. Envoi groupé (EA-76)

**COM-070** `[P1]` **Envoi d'un e-mail à plusieurs clients** (`email.bulk`). Il ne sert qu'aux **actualités** : nouveau programme, prochaine date. Les messages de service partent par les événements, pas par ici.

1. **Destinataires** : une vue enregistrée de la liste des clients, ou des filtres. L'écran affiche le décompte : « {n} clients correspondent · {m} ont accepté les actualités · {k} recevront l'e-mail ». Sont **toujours** écartés : ceux qui n'ont pas donné l'accord `MARKETING_EMAIL`, ceux marqués « Ne pas contacter », ceux dont le traitement est limité, les adresses en erreur, les fiches sans adresse, les fiches archivées. Pour un envoi **programmé**, cette liste est recalculée **à l'heure du départ** : quelqu'un qui s'est désinscrit entre la programmation et l'envoi ne reçoit rien.
2. **Message** : le modèle `C_NEWSLETTER` ou un modèle manuel du groupe « Actualités » ; objet et corps.
3. **Aperçu et test** à ma propre adresse.
4. **Envoi** : maintenant ou à une date ; `mail.bulkMaxRecipients` destinataires au plus par envoi (500) : au-delà, l'envoi est refusé (raison `BULK_TOO_MANY_RECIPIENTS`) ; au départ d'un envoi programmé, si le recalcul dépasse le plafond, l'e-mail part aux {max} premiers par date d'accord et l'auteur en est notifié.

Chaque e-mail est tracé dans la chronologie du client et dans le journal. Le pied porte d'office le lien de désinscription du groupe « Actualités » (NOT-022). L'écran d'un envoi groupé montre ensuite : envoyés, remis, rejetés, désinscrits.

## 7. Autres canaux

**COM-080** `[P1]` **Téléphone.** Chaque numéro est un lien d'appel (TRV-041). Après l'appel : « Noter un appel » (CRM-030).

**COM-081** `[P1]` **WhatsApp** (Q-015). Si le client a indiqué être joignable sur WhatsApp, sa fiche propose « Ouvrir WhatsApp », qui ouvre la conversation dans l'application du conseiller. La plateforme n'envoie ni ne reçoit aucun message WhatsApp. L'échange se **note** (CRM-031) ; toute décision prise sur WhatsApp est reportée dans le dossier par le conseiller.

**COM-082** `[P1]` **Notifications internes** : NOT-030, § 3.2, et BO-060.
