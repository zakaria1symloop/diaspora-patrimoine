# Promoteurs : réponse par lien, puis portail

`[P2]` — hors du contrat de Phase 1. Ce fichier fixe la **cible** pour que la Phase 1 ne ferme aucune porte : en Phase 1, le promoteur existe déjà comme entité complète (fiche, contacts, documents, programmes, lots, médias), tenue pour son compte par l'équipe de Diaspora Patrimoine. Lui ouvrir un accès, c'est **lui donner la main** sur ces mêmes données, pas refaire la plateforme (`00-cadre/01`, § 1).

L'accès d'un promoteur a trois niveaux, sur un seul chemin (`00-cadre/06`) : le **niveau 1** est la Phase 1 — l'équipe saisit pour lui ; le **niveau 2** lui permet de répondre par un lien sécurisé, sans compte (§ 5 ci-dessous) ; le **niveau 3** est le portail (§ 1 à 4). Ce fichier décrit les niveaux 2 et 3 ; ce qu'ils partagent avec le niveau 1 — les gestes, leurs effets, ce qu'un promoteur peut savoir — est dans `00-cadre/06` et n'est pas répété ici.

Toutes les règles portent l'étiquette `[P2]`.

---

## 1. Principes

**PPR-001** Le portail est une application à part (`apps/partner`), sur son propre hôte, commune aux promoteurs et aux banques. Elle appelle la même API que les autres applications.

**PPR-002** **Comptes.** Un utilisateur de promoteur est un compte de nature `PARTNER`, lié à l'organisation du promoteur par une appartenance (`Membership`) avec un rôle : `ADMIN`, `AGENT` ou `VIEWER` (`00-cadre/02`, § 6). Double authentification obligatoire. Un même compte peut appartenir à plusieurs promoteurs (groupe) : il choisit l'organisation à la connexion.

**PPR-003** **Cloisonnement** (ROL-040). Un utilisateur ne voit que ce qui tient à **son** organisation : ses programmes, ses biens, ses lots, ses médias, et les demandes qui portent sur eux. Toute route filtre sur l'organisation de la session ; un identifiant étranger répond `404`.

**PPR-004** **Ouverture d'un accès.** Depuis la fiche du promoteur, onglet « Accès » (CTL-008 ; permission `partner.access.manage`) : inviter un premier utilisateur `ADMIN` chez le promoteur. Celui-ci invite ensuite ses collègues. Diaspora Patrimoine peut suspendre tout accès. Un promoteur `SUSPENDED` ou `ENDED` perd l'accès de tous ses utilisateurs : leurs appartenances à ce promoteur sont suspendues, pas leurs comptes (ACP-060).

**PPR-005** **Ce qui reste à Diaspora Patrimoine** : la relation avec le client ; son identité — son nom jusqu'à une réservation confirmée, ses coordonnées jusqu'à son accord de transmission (ACP-017) — ; le financement ; la décision de **publier** ; le statut « sélectionné » ; la page publique du promoteur.

## 2. Catalogue

**PPR-010** Le promoteur gère ses **programmes**, **biens**, **lots** et **médias** avec les mêmes formulaires et les mêmes règles que le back-office (`04-back-office/04`), carte de complétude comprise.

**PPR-011** **Publication modérée.** Le promoteur ne publie pas : il **propose**. « Proposer à la publication » fait entrer le programme ou le bien dans une file de validation chez Diaspora Patrimoine, qui publie, ou renvoie avec un commentaire. Ajouts au modèle : `submittedForReviewAt`, `reviewedAt`, `reviewedById`, `reviewNote` sur `Program` et `Property`.

**PPR-012** **Sur un bien déjà publié : le stock, oui ; le contenu, non.** Le promoteur tient son **stock** lui-même, et ces changements s'appliquent **tout de suite**, avec notification à Diaspora Patrimoine : le statut d'un lot (vendu ou réservé hors plateforme, retiré, remis en vente) ; son prix, jusqu'à `catalogue.partnerPriceTolerancePct` % d'écart — au-delà, il attend la validation ; un lot ajouté. Tout **contenu** passe par la validation de l'équipe avant d'être vu : le titre, la description, le type, les surfaces, la livraison, les photos ajoutées ou retirées, un point d'avancement du chantier — qui part aussi chez les clients (ACP-010, ACP-050).

**PPR-013** **Lots.** Le promoteur déclare une vente ou une réservation faite hors plateforme (`externalSale`). Il ne peut pas modifier un lot **sous option ou réservé** par un dossier de la plateforme autrement qu'en répondant à la demande correspondante (PPR-021).

**PPR-014** **Import de lots** : même mécanisme que CTL-100. **Guide** : le guide des visites 360° est proposé au téléchargement dans l'onglet Médias.

## 3. Demandes des clients

**PPR-020** **Tableau de bord** du promoteur : pour chaque programme et chaque bien — vues, intérêts, propositions faites aux clients, visites, options, réservations, ventes ; et la liste de ce qui attend sa réponse.

**PPR-021** **Demandes à traiter.** C'est la liste « Ce que nous attendons de lui » que l'équipe lit déjà sur la fiche du promoteur (ACP-015, CTL-005), vue de son côté. Chaque réponse est un geste de ACP-020 et garde son mode : seul le dépôt d'une pièce s'applique aussitôt ; les autres réponses sont relues par l'équipe (ACP-031).

| Demande | Envoyée par | Réponse du promoteur |
|---|---|---|
| Option sur un lot | Le conseiller, en posant une option | Confirmer · Refuser (avec une raison). Sans réponse à l'échéance de l'option : elle expire. |
| Réservation | Le conseiller | Confirmer (date, interlocuteur), déposer le contrat de réservation et l'attestation de dépôt. |
| Accueil d'une visite | Automatique, quand une visite sur place est confirmée sans personne désignée pour accueillir | Désigner qui accueille : nom, téléphone. Un empêchement se dit dans le fil d'échanges. |
| Acompte à rembourser | Automatique, quand une réservation qui portait un acompte prend fin (CYC-108) | Remboursé (montant, date, justificatif) ou conservé (ce que prévoit le contrat). |
| Disponibilités à vérifier | Automatique, à l'échéance (AUT-079) | « Tout est à jour », après avoir corrigé son stock. |
| Pièce à fournir | Le conseiller (pièce `providedBy = PROMOTER`) | Déposer le document. |
| Date de livraison | Automatique, quand une date de livraison est dépassée (AUT-074) | Mettre à jour la livraison. |

**PPR-022** **Identité du client.** Le promoteur voit une demande sous la forme « Client de Diaspora Patrimoine · dossier {référence} ». Le nom du client ne lui est montré qu'à partir de la **réservation confirmée** ; ses coordonnées et toute pièce, seulement si le client a donné l'accord `DATA_SHARING_PARTNERS` (ACP-017). Il ne voit jamais les revenus, les pièces d'identité ou de revenus, ni le financement.

**PPR-023** **Échanges.** Un fil de discussion par dossier entre le conseiller et le promoteur, distinct du fil du client. Ajout au modèle : un type de fil « partenaire » (`Conversation.partnerOrganizationId`), invisible du client.

## 4. Notifications

**PPR-030** Le promoteur est notifié (application et e-mail) : d'une nouvelle demande à traiter ; d'une décision de publication ; d'une option qui expire ; d'un rappel de date de livraison ; d'une vente conclue. Modèles d'e-mail de public `PARTNER`, sur le modèle de NOT-040.

## 5. Niveau 2 : répondre par lien, avant le portail

Le niveau 2 se livre avant le portail, et sans lui (ACP-072). Mécanique commune aux promoteurs et aux banques : ACP-040 à ACP-045.

**PPR-050** **Ce qu'un promoteur fait par lien.** Répondre à une option (`OPTION_ANSWER`) · confirmer une réservation et déposer son contrat (`RESERVATION_CONFIRM`, `DOCUMENT_PROVIDE`) · dire ce qu'est devenu un acompte (`DEPOSIT_OUTCOME`) · désigner qui accueille une visite (`VISIT_HOST`) · mettre à jour une livraison (`DELIVERY_UPDATE`) · déposer un document renouvelé (`PARTNER_DOCUMENT`) · dire l'état de son stock (`STOCK_UPDATE`, PPR-051). Rien d'autre : il ne crée ni programme, ni bien, ni lot, et n'ajoute pas de photos — l'équipe le fait pour lui, ou le portail le lui ouvre (ACP-022). Par lien, rien de ce qu'il répond ne change ce que lisent le public ou le client avant d'avoir été relu (ACP-031).

**PPR-051** **La page du stock.** L'e-mail de vérification des disponibilités (`P_PROMOTER_STOCK_CHECK`) part de lui-même à l'échéance (AUT-079) et ouvre, pour **ce promoteur**, ses programmes à vérifier, chacun avec le tableau de ses lots : référence, typologie, étage, surface, prix, statut. Sur une ligne libre, il note ce qui a changé : « Vendu » · « Réservé hors plateforme » · « Retiré » · « Nouveau prix » ; sur un lot qu'il avait lui-même réservé ou retiré : « De nouveau en vente ». Un lot vendu ne se remet pas en vente ici (CYC-100). Les lots sous option ou réservés par un dossier de la plateforme sont en lecture seule, avec la mention « Réservé par un client de Diaspora Patrimoine ». En bas : « Tout est à jour ». Sans aucun changement, la vérification est enregistrée aussitôt. Avec des changements, la page dit « Transmis à Diaspora Patrimoine : vos modifications sont prises en compte sous un jour ouvré. » : l'ensemble forme **une** réponse (`STOCK_UPDATE`), que le conseiller applique d'un bloc ou ligne par ligne — rien ne change sur le site avant. Le promoteur peut rouvrir la page tant que le lien vaut ; la vérification suivante lui en envoie un autre.

**PPR-052** **Accueil d'une visite.** Une visite a toujours sa date : le conseiller la convient avec le promoteur avant de créer le rendez-vous, à tous les niveaux (TAC-045). Ce qui reste à demander, c'est **qui accueille** : au niveau 2, la demande part par lien dès qu'une visite sur place est confirmée sans personne désignée ; la page montre le bien, la date, l'heure du lieu et le nom de la personne qui vient (ACP-017). La réponse est relue : c'est le conseiller qui transmet le nom de l'accueillant au client.

**PPR-053** **Ce que le niveau 2 n'a pas** : aucune liste — chaque lien ne montre que son objet ; aucun historique en ligne ; aucun fichier à télécharger en dehors de ce que porte la demande ; aucune action sans demande préalable, hors la page du stock. C'est ce que le portail ajoute.

## 6. Ce que la Phase 1 prépare déjà

**PPR-040** `[P1]` Récapitulatif : chaque point est déjà une règle de Phase 1 (ACP-070). Sont en place dès la Phase 1, pour que ni le niveau 2 ni ce portail ne demandent de migration (ACP-070) : le niveau d'accès sur chaque promoteur ; les gestes écrits comme des commandes à trois portes ; la confirmation de l'option par le promoteur et la vérification périodique des disponibilités ; et aussi : `Organization` et `Membership` ; `User.kind = PARTNER` ; `SessionAudience = PARTNER` ; `Promoter.organizationId` ; les pièces `providedBy = PROMOTER` ; la complétude et la publication contrôlée ; l'historique des prix ; le journal d'audit par organisation.
