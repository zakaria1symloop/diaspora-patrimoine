# Banques : réponse par lien, puis portail

`[P3]` — hors du contrat de Phase 1. En Phase 1, la banque reçoit un dossier par un lien sécurisé ou hors plateforme (D-036), et c'est le conseiller qui saisit ses réponses : c'est le **niveau 1** d'accès (`00-cadre/06`). Au **niveau 2**, elle répond elle-même depuis la page du dossier, sans compte (§ 4 ci-dessous). Au **niveau 3**, le portail lui donne la main sur ces mêmes objets : la soumission, ses pièces, sa décision (§ 1 à 3). Le chemin est le même aux trois niveaux ; ce qu'ils partagent est dans `00-cadre/06`.

Toutes les règles portent l'étiquette `[P3]`.

---

## 1. Principes

**PBQ-001** Même application et mêmes règles d'accès que le portail promoteur (PPR-001 à PPR-004) : compte de nature `PARTNER`, appartenance à l'organisation de la banque, rôle `ADMIN`, `AGENT` (analyste) ou `VIEWER`, double authentification obligatoire.

**PBQ-002** **Cloisonnement.** Un utilisateur de banque ne voit que les **soumissions adressées à sa banque**, et, dans chacune, que les pièces **incluses dans le paquet** qui lui a été transmis, dans la version transmise. Il ne voit ni les autres banques sollicitées, ni les notes, ni la messagerie du client, ni le score.

**PBQ-003** Aucune soumission n'arrive dans le portail sans l'accord `DATA_SHARING_PARTNERS` du client (CYC-161).

**PBQ-004** Chaque ouverture et chaque téléchargement d'une pièce par un utilisateur de banque est journalisé, comme dans le back-office (GED-002).

## 2. Traitement d'un dossier

**PBQ-010** **Mode de transmission `PORTAL`** — possible pour une banque de niveau 3 seulement. À l'envoi d'une soumission, au lieu d'un lien : le dossier apparaît dans la file de la banque, et ses utilisateurs sont notifiés. Le paquet (sommaire et pièces) est consultable en ligne et téléchargeable.

**PBQ-011** **File des dossiers** : Référence · Reçu le · Montant demandé · Produit · État · Analyste · Échéance (délai d'étude de la banque). Vues : « À prendre » · « Mes dossiers » · « Compléments attendus » · « Décidés ».

**PBQ-012** **Un dossier**, pour l'analyste : le sommaire (emprunteurs, synthèse financière, bien, demande) ; les pièces, dans une visionneuse ; le journal ; les actions.

| Action | Effet — celui de la saisie du conseiller en Phase 1, par la même commande (ACP-011) |
|---|---|
| Prendre le dossier | Soumission → `UNDER_REVIEW` (CYC-162). **Direct.** |
| **Demander un complément** | Liste de pièces (choisies dans la liste de la banque, ou libellé libre) et précisions. **Relu** : le conseiller applique la demande — il vérifie d'abord si la pièce n'est pas déjà au dossier —, et c'est alors que la soumission passe `INFO_REQUESTED` (CYC-163) et que le client est prévenu ; les pièces fournies puis validées reviennent dans le dossier de la banque. |
| **Accorder** | Montant, taux ou marge, durée, mensualité, validité de l'offre, conditions, document d'offre. **Relu** : à l'application par le conseiller, → `APPROVED` (CYC-164), avec les effets et les délais de BNK-130. |
| **Refuser** | Motif, et « Communicable au client ». **Relu** : à l'application, → `REJECTED` (CYC-165). |
| Écrire au conseiller | Fil de discussion du dossier, entre la banque et Diaspora Patrimoine. Jamais avec le client. |

**PBQ-013** Selon le rôle : un `AGENT` instruit et **propose** une décision ; si la banque l'exige (réglage de l'organisation), un `ADMIN` la **valide** avant qu'elle ne soit transmise. Tant qu'elle n'est pas validée chez la banque, la réponse reste à l'état `INTERNAL` (`PartnerAnswerStatus`) : l'équipe de Diaspora Patrimoine ne la voit pas ; validée, elle devient une réponse à relire comme les autres (ACP-031).

**PBQ-014** **Fin d'accès.** 90 jours après une décision ou un retrait, les pièces d'une soumission ne sont plus consultables par la banque ; restent le sommaire et le journal. Une soumission **retirée** (CYC-168) disparaît de la file et ses pièces deviennent inaccessibles aussitôt.

## 3. Barèmes et critères

**PBQ-020** La banque gère ses **produits** (`BankProduct`) : elle propose un nouveau produit ou une modification ; Diaspora Patrimoine la valide avant qu'elle ne s'applique aux simulateurs. Elle gère sa **liste de pièces** (modèle `BANK_FILE`) de la même façon.

**PBQ-021** Elle indique les **programmes** qu'elle accepte ou refuse de financer (`FinancingEligibility`), ce qui alimente l'étiquette « Éligible au financement » du site.

**PBQ-022** **Tableau de bord** de la banque : dossiers reçus, en cours, accordés, refusés ; délai moyen de décision ; compléments demandés ; offres en attente de réponse du client.

## 4. Niveau 2 : répondre par lien, avant le portail

Le niveau 2 se livre avant le portail, et sans lui (ACP-072). Mécanique commune : ACP-040 à ACP-045.

**PBQ-040** **Le panneau « Votre réponse »** s'ajoute à la page du dossier (BNK-112, ACP-044). Il propose, tant que la soumission est en cours (`SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED`) : « Indiquer votre référence de dossier » — qui accuse aussi réception si le premier téléchargement ne l'a pas fait (`SUBMISSION_ACK`) · « Il me manque des éléments » — un texte, et les pièces voulues, cochées dans la liste de la banque ou décrites librement (`INFO_REQUEST`) · « Donner la décision » — accord : montant, taux ou marge, durée, mensualité, validité de l'offre, conditions, document de l'offre ; refus : motif, et « Ce motif peut être communiqué au client » (`DECISION`) · « Prolonger l'offre » sur une offre accordée (`OFFER_EXTEND`). Les champs, leurs bornes et leurs messages sont ceux des fenêtres du conseiller (BNK-120, BNK-130, BNK-131). Sous chaque réponse envoyée : « Transmise à Diaspora Patrimoine le {date}. Votre interlocuteur la prend en compte sous un jour ouvré. ».

**PBQ-041** **Le barème par lien.** L'e-mail de vérification d'un barème (`P_BANK_PRODUCT_CHECK`) part de lui-même à l'échéance (AUT-079) et ouvre, pour **un** produit, ses conditions affichées. Deux réponses : « Inchangé » (`PRODUCT_CONFIRM`), enregistré aussitôt ; ou « Voici ce qui change » (`PRODUCT_UPDATE`) — taux ou marge, durées, apport minimum, endettement maximum, frais —, relu par l'équipe : elle ouvre le formulaire du produit (BNK-021) prérempli avec ces valeurs, et rien ne touche les simulateurs avant qu'elle l'enregistre.

**PBQ-042** **Ce que le niveau 2 n'a pas** : aucune file de dossiers, aucun historique en ligne, aucune pièce consultable au-delà de la validité du lien (BNK-111), aucun produit proposé de sa propre initiative. C'est ce que le portail ajoute.

## 5. Ce que la Phase 1 prépare déjà

**PBQ-030** `[P1]` Récapitulatif : chaque point est déjà une règle de Phase 1 (ACP-070). Sont en place dès la Phase 1 : le niveau d'accès sur chaque banque ; les sept gestes de la banque, écrits comme des commandes à trois portes (ACP-021) ; le lien sécurisé et sa page, prêts à porter une réponse ; et aussi : `Bank.organizationId` ; `TransmissionMode.PORTAL` ; le paquet avec son manifeste (pièce, version, empreinte) ; le journal d'une soumission (`BankSubmissionEvent`) avec un acteur qui pourra être un utilisateur de banque ; les pièces `providedBy = BANK` ; les statuts et transitions d'une soumission, qui ne changent pas — seul **l'auteur** des transitions change.
