# Accès des partenaires : trois niveaux, un seul chemin

Un promoteur ou une banque n'a pas besoin, le premier jour, d'un compte sur la plateforme : l'équipe de Diaspora Patrimoine le connaît, lui téléphone, et saisit ce qu'il répond. Plus tard, certains voudront répondre eux-mêmes ; quelques-uns voudront un vrai portail. Ce fichier fixe la façon de passer de l'un à l'autre **sans rien refaire** : le parcours est le même aux trois niveaux ; seuls changent **qui saisit** et **par quelle voie**.

Le client, lui, ne voit aucune différence : son site, son espace et ses e-mails sont les mêmes, quel que soit le niveau de ses interlocuteurs (ACP-010).

Demandé par SYMLOOP le 3 octobre 2026 (D-080). Dans ce fichier, « partenaire » désigne un **promoteur** ou une **banque** — pas les « autres partenaires » de la page publique (CTL-170).

---

## 1. Les trois niveaux

| | Niveau 1 — **Simple** | Niveau 2 — **Intermédiaire** | Niveau 3 — **Complet** |
|---|---|---|---|
| En une phrase | L'équipe saisit pour lui. | Il répond lui-même, par un lien sécurisé. | Il se connecte à son portail. |
| Valeur (`PartnerAccessLevel`) | `MANAGED` | `LINK` | `PORTAL` |
| Compte, mot de passe | Aucun | Aucun | Un compte par personne, avec double authentification |
| Ce qu'il reçoit | Les e-mails que l'équipe lui écrit ; pour une banque, le dossier par un lien de téléchargement à code (BNK-111), ou hors plateforme | Les mêmes demandes, envoyées d'office, avec un bouton « Répondre en ligne » : une demande, une page, un code | Ses demandes, ses dossiers, ses fichiers et son historique, réunis au même endroit ; les e-mails l'y ramènent |
| Comment il répond | Par téléphone, e-mail, WhatsApp : l'équipe saisit sa réponse | Sur la page de la demande — ou comme au niveau 1 | Dans le portail — ou comme aux niveaux 1 et 2 |
| Ce qu'il fait de lui-même | Rien | Il répond à ce qu'on lui demande | Il répond, et il agit sans qu'on lui demande : il tient son stock, suit ses dossiers, gère son équipe |
| Ce que l'équipe garde | Tout | La relecture de ce qui touche le public ou le client | La même relecture |
| Pour qui | Tous, au lancement | Le partenaire régulier, qui ne veut pas d'un outil de plus | Le partenaire à fort volume |
| Phase | `[P1]` : c'est la Phase 1 | Promoteur `[P2]`, banque `[P3]` : première étape | Promoteur `[P2]`, banque `[P3]` : seconde étape |

**ACP-001** `[P1]` **Un seul chemin.** Les objets, leurs statuts, leurs transitions, leurs échéances, leurs notifications et ce que lit le client sont définis une fois (`01-domaine/06`) et valent aux trois niveaux. Un niveau n'ajoute ni statut, ni étape, ni écran côté client : il ouvre une **voie** de plus pour faire les mêmes gestes.

**ACP-002** `[P1]` **Un niveau par partenaire.** Chaque promoteur et chaque banque a le sien (`Promoter.accessLevel`, `Bank.accessLevel`) : `MANAGED` à la création. Des partenaires de niveaux différents se côtoient dans un même dossier — un promoteur au niveau 1, une banque au niveau 3 — sans que le dossier s'en ressente.

**ACP-003** `[P1]` **Les niveaux s'emboîtent.** Chaque niveau garde tout ce que permettent les précédents. La saisie par l'équipe n'est **jamais** fermée : un partenaire de niveau 3 qui répond au téléphone est servi comme au niveau 1. Au niveau 3, un interlocuteur qui n'a pas encore de compte répond par lien, comme au niveau 2.

**ACP-004** `[P1]` **En Phase 1, il n'y a qu'un niveau.** Tous les partenaires sont au niveau 1 ; rien ne se règle, et aucun écran n'en parle — l'inscription d'un partenaire (§ 9) non plus. Le choix d'un niveau apparaît avec les niveaux 2 et 3 (§ 8).

## 2. Les règles du chemin

**ACP-010** `[P1]` **Le client ne voit pas le niveau.** Ni son espace, ni ses e-mails, ni les délais qu'on lui annonce ne dépendent du niveau d'un partenaire. Un partenaire n'écrit jamais au client par la plateforme, et rien de ce qu'un partenaire saisit lui-même n'atteint le client sans être passé par un membre de l'équipe (ACP-031) : l'équipe de Diaspora Patrimoine reste le pivot (`00-cadre/01`, § 1).

**ACP-011** `[P1]` **Le geste.** Toute information qui vient d'un partenaire entre par un **geste** d'une liste fermée (§ 3) : confirmer une option, donner une décision, dire que le stock est à jour… Un geste est **une** commande de l'API : mêmes contrôles, mêmes effets, mêmes événements, quelle que soit la voie par laquelle il arrive. Aucune de ses règles n'est écrite dans un écran (ARC-014).

**ACP-012** `[P1]` **Trois voies** (`GestureRoute`). La Phase 1 n'en a qu'une : la première.

| Voie | Qui agit | Ce qui prouve son identité | Ouverte |
|---|---|---|---|
| `BACK_OFFICE` | Un membre de l'équipe, **pour le compte** du partenaire | Sa session du back-office | Toujours |
| `LINK` | Un interlocuteur du partenaire, sans compte | Le lien reçu par e-mail, et son code (ACP-041) | `[P2]` `[P3]` À partir du niveau 2. Au niveau 1, un lien ne sert qu'à télécharger un dossier ; son seul effet est l'accusé de réception d'une banque, automatique au premier téléchargement (BNK-112) |
| `PORTAL` | Un utilisateur du partenaire | Son compte et sa double authentification | `[P2]` `[P3]` Au niveau 3 |

**ACP-013** `[P1]` **On sait qui a dit quoi.** En Phase 1, un geste est saisi par un membre de l'équipe : le journal d'audit garde son auteur et sa date, et le **nom de l'interlocuteur** du partenaire est gardé là où il compte — celui qui tient le lot (`Reservation.optionAcknowledgedBy`), celui qui confirme la réservation (`Reservation.promoterConfirmedBy`), celui qui confirme les disponibilités (`Program.stockConfirmedBy`) ou le barème (`BankProduct.ratesConfirmedBy`), celui de la banque qui donne une réponse (`BankSubmissionEvent.reportedBy`). Ce champ est facultatif — sauf pour prolonger une option, où il est obligatoire (CYC-107) — et prérempli : pour un promoteur, avec son contact principal ; pour une banque, avec le destinataire de la soumission. Le jour d'un désaccord — « nous n'avons jamais confirmé cette option » —, on sait qui a dit quoi, et quand. À partir du niveau 2, chaque geste fait par le partenaire lui-même a sa ligne (`PartnerAnswer` : voie, auteur, contenu), et le journal d'audit porte la voie.

**ACP-014** `[P1]` **Un geste se fait une fois.** Si l'équipe a déjà saisi la réponse, la page du lien et le portail l'affichent (« Réponse enregistrée le {date} par l'équipe de Diaspora Patrimoine. ») et ne la redemandent pas ; et inversement. De deux gestes appliqués au même instant, le second est refusé comme tout conflit d'état (TRV-110). Les réponses qui attendent une relecture suivent ACP-032.

**ACP-015** `[P1]` **Ce qu'on attend d'un partenaire se lit dans les objets.** Aucune « demande » n'est créée à part : une option que le promoteur n'a pas confirmée, une soumission sans décision, une livraison dépassée **sont** l'attente (§ 3). La même liste sert donc aux trois niveaux : au niveau 1, c'est le pense-bête de l'équipe sur la fiche du partenaire (CTL-005, BNK-004) ; au niveau 2, c'est ce que portent les liens ; au niveau 3, c'est la page d'accueil du portail. Changer de niveau ne demande de reprendre aucune donnée.

**ACP-016** `[P1]` **Les écrans du conseiller ne changent pas avec le niveau.** Sous chaque attente, le bouton « Saisir la réponse » ouvre la fenêtre du geste : il est là à tous les niveaux. `[P2]` `[P3]` À partir du niveau 2, une ligne dit en plus où en est la demande : « Lien envoyé à {interlocuteur} le {date} » · « Visible dans le portail de {partenaire} » · « Réponse à relire ».

**ACP-017** `[P1]` **Ce qu'un partenaire peut savoir** est fixé une fois, et vaut pour un e-mail, pour une page de lien et pour le portail.
- Un **promoteur** connaît d'un dossier : sa référence, le bien et le lot, les dates, le prix convenu. Il lit « Client de Diaspora Patrimoine » à la place du nom. Deux exceptions, parce qu'il en a besoin et qu'il le sait déjà : pour une **visite sur place confirmée**, le nom de la personne qui vient — le client, ou le proche qui le représente — et l'heure ; à partir d'une **réservation confirmée**, le nom du client, avec qui il a signé le contrat. Les coordonnées du client et toute pièce ne lui parviennent que si le client a donné l'accord `DATA_SHARING_PARTNERS`. Jamais les revenus, les pièces d'identité ou de revenus, ni le financement.
- Une **banque** connaît d'un dossier ce que contient le **paquet** qui lui a été transmis, dans la version transmise (BNK-110), et rien d'autre : ni les autres banques sollicitées, ni les notes, ni les échanges avec le client. Rien ne lui parvient sans l'accord de transmission du client (CYC-161).

En Phase 1, cette règle gouverne ce que l'équipe écrit à un partenaire : les modèles d'e-mail la respectent (« l'un de nos clients »).

**ACP-018** `[P1]` **Ce qui n'est pas un geste de partenaire.** L'équipe tient le catalogue comme elle l'entend : corriger une ligne de la grille des lots, changer des prix en nombre, importer une grille (CTL-061, CTL-062, CTL-100). Ces modifications passent par les mêmes commandes — changer le statut d'un lot, changer son prix — mais ce sont des saisies ordinaires : elles ne demandent ni interlocuteur, ni voie, et ne figurent pas dans les tableaux du § 3.

## 3. Ce qu'on attend d'un partenaire, et ses gestes

Les deux dernières colonnes ne jouent qu'à partir du niveau 2 : l'e-mail qui porte la demande, et ce que devient le geste quand le partenaire le fait **lui-même** — appliqué aussitôt (« direct ») ou après relecture par l'équipe (« relu », § 4).

**ACP-020** `[P1]` **Promoteur.**

| Ce que l'état des objets révèle | Geste (`PartnerGesture`) | Au niveau 1, l'équipe le saisit par | Au niveau 2, la demande part avec | Fait par lui-même |
|---|---|---|---|---|
| Une option est posée, ou sa prolongation est souhaitée ; le promoteur n'a pas dit qu'il tient le lot (CYC-107) | `OPTION_ANSWER` — « Je tiens le lot jusqu'au {date} », ou « Je ne peux pas » : raison, et ce qu'est devenu le lot (toujours libre, vendu, réservé ailleurs, retiré) | PIP-053 | `P_PROMOTER_OPTION_REQUEST` | relu |
| Une option court, confirmée | `RESERVATION_CONFIRM` — la réservation est signée : date, acompte reçu (montant, devise, date), contrat, livraison prévue au contrat | PIP-050 | Le lien de l'option (ACP-043) | relu |
| Une réservation est confirmée sans son contrat ; une pièce du dossier est attendue du promoteur | `DOCUMENT_PROVIDE` — déposer le fichier | GED-037 (le contrat), GED-055 (une autre pièce) | `P_PARTNER_REQUEST` | **direct** : la pièce passe « reçue », et se vérifie comme toute pièce |
| Une réservation qui portait un acompte a pris fin (CYC-108) | `DEPOSIT_OUTCOME` — remboursé (montant, date, justificatif) ou conservé (ce que prévoit le contrat) | PIP-050 | `P_PARTNER_REQUEST` | relu |
| Une visite sur place est confirmée, sans personne désignée pour accueillir le visiteur | `VISIT_HOST` — qui accueille : nom, téléphone | TAC-045 | `P_PARTNER_REQUEST` | relu |
| Les disponibilités de ses programmes n'ont pas été vérifiées depuis `catalogue.stockCheckDays` jours (AUT-079) | `STOCK_UPDATE` — les lots qui ont changé (vendu ou réservé hors plateforme, retiré, remis en vente ; nouveau prix), puis « tout est à jour » | CTL-064, après avoir corrigé la grille | `P_PROMOTER_STOCK_CHECK` | « Tout est à jour », sans rien changer : **direct** ; avec des changements : relu |
| La livraison d'un programme ou d'un bien est dépassée (AUT-074) | `DELIVERY_UPDATE` — nouvelle date, ou « livré » | CTL-022 | `P_PARTNER_REQUEST` | relu |
| Sa convention ou l'un de ses documents expire dans moins de 30 jours (AUT-073) | `PARTNER_DOCUMENT` — déposer le document renouvelé | CTL-003 | `P_PARTNER_REQUEST` | relu |

**ACP-021** `[P1]` **Banque.**

| Ce que l'état des objets révèle | Geste (`PartnerGesture`) | Au niveau 1, l'équipe le saisit par | Au niveau 2, la demande part avec | Fait par elle-même |
|---|---|---|---|---|
| Un dossier lui a été envoyé (`SUBMITTED`) | `SUBMISSION_ACK` — bien reçu, avec sa référence | BNK-120 ; automatique au premier téléchargement (BNK-112) | `P_BANK_SHARE_LINK` | **direct** |
| Un dossier est en cours chez elle (`SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED`) | `INFO_REQUEST` — il manque des éléments : lesquels | BNK-120 | Le lien du dossier (ACP-044) ; `P_BANK_FOLLOW_UP` en relance | relu : c'est le conseiller qui s'adresse au client |
| Idem | `DECISION` — accord (montant, taux ou marge, durée, mensualité, validité, conditions, document de l'offre) ou refus (motif, communicable ou non) | BNK-130, BNK-131 | Idem | relu |
| Une offre accordée approche de son échéance | `OFFER_EXTEND` — nouvelle date de validité | CYC-169 | Le lien du dossier | relu |
| Un barème n'a pas été vérifié depuis `finance.productCheckDays` jours (AUT-079), et rien n'a changé | `PRODUCT_CONFIRM` — « Inchangé » | BNK-024 | `P_BANK_PRODUCT_CHECK` | **direct** |
| Idem, et quelque chose a changé | `PRODUCT_UPDATE` — les nouvelles conditions | BNK-021, puis BNK-024 | `P_BANK_PRODUCT_CHECK` | relu |
| Sa convention ou l'un de ses documents expire (AUT-073) | `PARTNER_DOCUMENT` — déposer le document renouvelé | BNK-002 | `P_PARTNER_REQUEST` | relu |

**ACP-022** `[P1]` **Ce que ces tableaux ne listent pas** ne se fait pas par un partenaire aux niveaux 1 et 2 : créer un programme, ajouter un lot ou des photos, proposer un nouveau produit, dire quels programmes une banque finance. L'équipe le fait pour lui (ACP-018) ; le portail l'ouvre au niveau 3 (§ 6).

**ACP-023** `[P1]` **Quand ce qui était convenu tombe.** Un promoteur a dit qu'il tenait un lot, ou confirmé une réservation ; puis l'option expire, est annulée, ou le dossier est clôturé. Ou bien une visite où il devait accueillir quelqu'un est annulée ou déplacée. Il faut le lui dire : sinon il tient un lot pour rien, ou attend un visiteur qui ne viendra pas. Au niveau 1, une tâche le demande au conseiller — « Prévenir {promoteur} : le lot {lot} est libéré » (`R_PROMOTER_RELEASE`) · « Prévenir {promoteur} : la visite du {date} est annulée » (`R_VISIT_HOST_CANCELLED`) · « Prévenir {promoteur} : la visite est déplacée au {date} à {heure} » (`R_VISIT_HOST_RESCHEDULED`) —, avec le modèle `P_PROMOTER_RELEASE` prêt à partir. À partir du niveau 2, l'e-mail part de lui-même, sans réponse attendue. Dans l'autre sens — le promoteur ne peut plus tenir un lot qu'il avait confirmé —, il n'y a de geste en ligne à aucun niveau : il appelle son interlocuteur, qui annule l'option ou la réservation en disant ce qu'est devenu le lot (PIP-050, CYC-107), et prévient le client.

## 4. Direct ou relu

**ACP-030** `[P1]` **Saisi par l'équipe, un geste s'applique aussitôt.** C'est le fonctionnement de la Phase 1 ; rien ne l'alourdit.

**ACP-031** `[P2]` `[P3]` **Fait par le partenaire lui-même, un geste n'est direct que s'il ne change rien de ce que lisent le public ou le client.** Quatre gestes seulement : accuser réception d'un dossier (`SUBMISSION_ACK`) · déposer un fichier, qui sera vérifié comme toute pièce (`DOCUMENT_PROVIDE`) · dire que le stock est à jour, sans rien y changer (`STOCK_UPDATE`) · dire qu'un barème est inchangé (`PRODUCT_CONFIRM`). Tous les autres sont **relus** — par lien comme dans le portail : ils engagent de l'argent, changent ce que le public lit, ou touchent ce que l'on dit au client.

- **Direct.** La commande s'exécute comme si l'équipe l'avait saisie ; le conseiller concerné en est informé (`NS_PARTNER_ANSWER`).
- **Relu.** La réponse est gardée telle quelle (`PartnerAnswer`, état `PENDING`) et **rien ne change** : ni l'objet, ni ce que lit le client. Le conseiller reçoit une tâche prioritaire, à un jour ouvré (`R_PARTNER_ANSWER`). Il ouvre la **même fenêtre** que s'il saisissait lui-même, préremplie avec la réponse, sous le bandeau « Répondu par {interlocuteur} le {date}, par lien » (ou « dans le portail »). Trois issues : « Appliquer » · « Modifier puis appliquer » (ses corrections sont gardées à côté de la réponse d'origine) · « Écarter » (raison obligatoire ; c'est le conseiller qui en parle au partenaire). Appliquer, c'est exécuter la commande : la suite est celle de la Phase 1, délais compris — les dix minutes avant la publication d'un accord, par exemple (CYC-165) ; un contrat de réservation appliqué ainsi naît validé, comme lorsque le conseiller le dépose (GED-037). Le droit d'appliquer est celui du geste (`reservation.manage`, `submission.decide`…).

**ACP-032** `[P2]` `[P3]` **Plusieurs réponses, et celles qui n'ont plus d'objet.**
- Une réponse ne se modifie pas : le partenaire en donne une autre. Pour un geste qui **tranche** — option, réservation, acompte, accueil d'une visite, livraison, décision, prolongation d'une offre, nouvelles conditions d'un barème —, la nouvelle remplace celle qui attendait (`SUPERSEDED`) ; le relecteur voit les deux, et qui les a données. Pour un geste qui **s'ajoute** — complément demandé, fichier déposé, document renouvelé, état du stock —, chacune est gardée et relue.
- La page et le portail montrent la réponse déjà donnée par un collègue : « {interlocuteur} a répondu le {date} : {résumé}. Vous pouvez la remplacer. ».
- Une réponse dont l'objet n'attend plus rien — l'option a expiré, la soumission a été retirée, l'équipe a saisi entre-temps — passe à `SUPERSEDED`, et sa tâche se ferme.

**ACP-033** `[P2]` `[P3]` Le tableau de bord de l'équipe compte les « Réponses de partenaires à relire » (TDB-010). Le délai entre une réponse et son application se lit par partenaire, sur sa fiche.

## 5. Niveau 2 : répondre par lien

**ACP-040** `[P2]` `[P3]` **Qui reçoit une demande.** Une seule personne par demande : le contact principal du partenaire s'il est marqué « Répond aux demandes » (`PromoterContact.answersRequests`, `BankContact.answersRequests`), sinon le premier qui l'est ; pour un dossier de financement, le destinataire de la soumission. Le conseiller peut l'envoyer en plus à un autre interlocuteur : chacun reçoit alors son propre lien. Un partenaire de niveau 2 ou 3 garde toujours **au moins un** interlocuteur qui répond, avec une adresse e-mail : retirer le dernier est refusé (« Désignez d'abord un autre interlocuteur, ou repassez ce partenaire au niveau 1. »).

**ACP-041** `[P2]` `[P3]` **Le lien** est celui que la Phase 1 emploie pour remettre un dossier à une banque (`SecureShare`, BNK-111, BNK-112), avec une portée élargie : il désigne **un objet** (`SecureShare.entityType`, `SecureShare.entityId`) et les **gestes** qu'il autorise (`SecureShare.gestures`). Même mécanique : le lien dans un e-mail, le code à six chiffres dans un second (`P_PARTNER_ACCESS_CODE`) ; rien d'affiché avant le bon code ; verrou après cinq codes faux, levé par l'envoi d'un nouveau code ; révocation par l'équipe ; journal de chaque ouverture. Ni le lien ni le code ne figurent au journal des e-mails (NOT-002). Validité : `partner.linkValidityDays` jours (14), sans dépasser l'échéance de ce qui est attendu. Un lien expiré se redemande depuis sa propre page (« Recevoir un nouveau lien »), à trois conditions : la demande attend toujours une réponse ; l'interlocuteur répond toujours aux demandes ; pas plus de trois renouvellements par jour. Le nouveau lien part à la même adresse, et à elle seule ; l'ancien est révoqué.

**ACP-042** `[P2]` `[P3]` **La page** (`/partage/{jeton}`, sur le modèle de EP-28) montre, après le code : ce que l'on demande, en une phrase ; ce que le partenaire a le droit de savoir de l'objet (ACP-017) ; le formulaire du geste — les mêmes champs, les mêmes contrôles et les mêmes messages que la fenêtre du back-office ; un champ « Un mot pour l'équipe » ; puis, la réponse donnée : « Réponse transmise à Diaspora Patrimoine le {date}. », suivie, pour un geste relu, de « Votre interlocuteur la prend en compte sous un jour ouvré. ». Quand la demande n'attend plus rien : « Cette demande n'attend plus de réponse : {raison} » — l'option a pris fin le {date}, une réponse a été enregistrée le {date}… — et rien d'autre. La page n'est ni indexée ni mise en cache ; elle est conçue pour un téléphone.

**ACP-043** `[P2]` **Promoteur.**
- **Un lien par réservation.** Il part avec `P_PROMOTER_OPTION_REQUEST` quand une option est posée sans confirmation, et vit autant qu'elle. Ce qu'il permet suit l'état : répondre à l'option, puis confirmer la réservation, déposer son contrat, et, si elle prend fin avec un acompte, dire ce qu'il devient. Une prolongation souhaitée par le conseiller y redemande « Tenez-vous le lot jusqu'au {date} ? ».
- **La page du stock.** La vérification des disponibilités (`P_PROMOTER_STOCK_CHECK`) ouvre, pour **ce promoteur**, ses programmes à vérifier et leurs lots : statut, prix. Il note ce qui a changé, puis confirme « Tout est à jour ». Sans changement, la vérification est enregistrée aussitôt. Avec des changements, l'ensemble part en relecture en **une** réponse : le conseiller l'applique d'un bloc ou ligne par ligne. Les lots sous option ou réservés par un dossier y sont en lecture seule ; un lot vendu ne se remet pas en vente par lien (CYC-100).
- **Le reste** — une pièce à fournir, un accueil de visite à désigner, une livraison à mettre à jour, un document à renouveler — part avec le modèle commun `P_PARTNER_REQUEST`, qui dit en une phrase ce qui est attendu.

**ACP-044** `[P3]` **Banque.** La page du dossier est la page de téléchargement de la Phase 1 (BNK-112), à laquelle s'ajoute le panneau « Votre réponse » : « Indiquer votre référence de dossier » — qui accuse aussi réception si ce n'est pas fait — · « Il me manque des éléments » · « Donner la décision » · « Prolonger l'offre », sur une offre accordée (PBQ-040). Le téléchargement des pièces garde sa validité courte et son nombre de téléchargements (BNK-111) ; le droit de **répondre** dure jusqu'à la fin de la soumission (`SecureShare.answerUntil`) : passé la validité des pièces, la page ne montre plus que la référence du dossier et le panneau de réponse. Une banque qui impose son propre canal (`MANUAL`) ne reçoit pas de lien : l'équipe saisit, comme au niveau 1.

**ACP-045** `[P2]` `[P3]` **Silence.** Une demande envoyée par lien et restée sans réponse `partner.reminderBusinessDays` jours ouvrés (2) est relancée **une fois** par e-mail (`P_PARTNER_REMINDER`, `SecureShare.remindedAt`). Un jour ouvré plus tard, toujours sans réponse, le conseiller reçoit sa tâche — « {partenaire} n'a pas répondu : {demande} » (`R_PARTNER_SILENT`) — et reprend la main comme au niveau 1. Si l'adresse de l'interlocuteur est rejetée : le conseiller du dossier (à défaut, les administrateurs) est prévenu, la ligne de contact est marquée « adresse en erreur », et la demande revient à la saisie par l'équipe (AUT-071).

**ACP-046** `[P2]` `[P3]` **Les demandes partent d'elles-mêmes.** Au niveau 1, c'est une tâche qui rappelle au conseiller d'appeler le partenaire ; à partir du niveau 2, l'événement qui créait cette tâche envoie la demande à l'interlocuteur, et la tâche ne naît qu'après son silence (ACP-045). Les règles livrées en Phase 1 pour ces tâches (`R_OPTION_UNCONFIRMED`, `R_STOCK_CHECK`, `R_PRODUCT_CHECK`, `R_PROMOTER_RELEASE`…) reçoivent alors la condition « partenaire au niveau 1 » (`event.data.accessLevel`), et leurs jumelles envoient l'e-mail aux autres. Ces jumelles, le destinataire « interlocuteur du partenaire » et le niveau porté par les événements concernés s'écrivent à l'étape B.0 : le moteur de la Phase 1 n'en a pas besoin (ACP-071).

## 6. Niveau 3 : le portail

**ACP-050** `[P2]` `[P3]` Le portail est décrit dans `05-phases-ulterieures/01` (promoteur) et `05-phases-ulterieures/02` (banque). Il ajoute au niveau 2 : des **comptes** nominatifs (nature `PARTNER`, double authentification, rôles `ADMIN`, `AGENT`, `VIEWER`) ; la **liste** de tout ce qui attend le partenaire et de tout ce qu'il a traité ; ses **fichiers** en ligne ; son **tableau de bord** ; un **fil d'échanges** avec l'équipe ; et ce qu'il fait **sans qu'on lui demande** (ACP-022). Pour ce dernier point, la règle est la même qu'ailleurs : le promoteur tient son **stock** lui-même — statut d'un lot, prix dans la limite de `catalogue.partnerPriceTolerancePct`, lots ajoutés (PPR-012) — ; tout **contenu** que le public ou le client lit — textes, photos, avancement du chantier, nouveau programme, nouveau produit — passe par la validation de l'équipe (PPR-011, PBQ-020). Les gestes du § 3 y gardent leur mode.

**ACP-051** `[P2]` `[P3]` **Un interlocuteur devient un utilisateur.** L'invitation part de sa ligne de contact (`PromoterContact.userId`, `BankContact.userId`) : son nom, son adresse et l'historique de ses réponses par lien le suivent. Tant qu'il n'a pas activé son compte, il continue de recevoir des liens (ACP-003).

## 7. Changer de niveau

**ACP-060** `[P2]` `[P3]` **Qui, comment** (`partner.access.manage`, CYC-241). Depuis l'onglet « Accès » de la fiche du partenaire. La fenêtre annonce ce qui va se passer, chiffres à l'appui : « 3 demandes en attente seront envoyées par lien à {interlocuteur}. » · « 2 liens de réponse seront fermés : leurs demandes reviennent à la saisie par l'équipe. ».

| Changement | Conditions | Effets |
|---|---|---|
| Monter au niveau 2 | Partenaire `ACTIVE` ; un interlocuteur « Répond aux demandes » | Ce qui est attendu de lui (§ 3) part par lien, si l'auteur du changement le demande. |
| Monter au niveau 3 (depuis 1 ou 2) | Les conditions du niveau 2 ; un premier utilisateur `ADMIN` invité (PPR-004) | Ce qui est attendu apparaît dans le portail. Les liens restent valables. |
| Redescendre du niveau 3 | Raison | Les **appartenances** des utilisateurs à ce partenaire sont suspendues (`Membership.suspendedAt`), leurs sessions sur ce partenaire fermées ; un utilisateur qui appartient aussi à un autre partenaire garde l'autre. Une soumission en mode `PORTAL` reçoit un lien sécurisé, et le mode par défaut de la banque redevient `SECURE_LINK`. Remonter rétablit les appartenances. |
| Redescendre au niveau 1 | Raison | Les liens perdent leurs gestes : un lien de dossier redevient un simple lien de téléchargement — la banque garde ses pièces — ; les liens qui ne servaient qu'à répondre sont fermés. Les réponses reçues et non relues restent à relire. |

Dans tous les cas : aucun objet ne change d'état, aucune échéance ne bouge, le client n'est prévenu de rien. Un partenaire `SUSPENDED` ou `ENDED` n'a plus de voie pour répondre, quel que soit son niveau, qui est conservé pour le jour où il redevient `ACTIVE` ; les dossiers déjà envoyés à une banque suspendue gardent leur lien de téléchargement (CYC-240).

## 8. Ce que la Phase 1 construit, pour ne rien refaire

**ACP-070** `[P1]` La Phase 1 livre le **niveau 1, complet**, et rien des niveaux suivants. Trois choses suffisent pour qu'ils ne soient, le moment venu, que des ajouts :

1. **Les règles sont dans les commandes de l'API, pas dans les écrans** (ARC-001, ARC-014). Une fenêtre du back-office qui enregistre la réponse d'un partenaire appelle une commande qui porte tous ses contrôles et tous ses effets : une page de lien ou un portail pourra appeler la même.
2. **L'état des objets dit ce qu'on attend, et de qui** (ACP-015). D'où trois informations que la Phase 1 garde : le promoteur **tient-il le lot** d'une option (CYC-107) ; **qui accueille** une visite sur place (TAC-045) ; **quand** les disponibilités d'un programme et le barème d'un produit ont été vérifiés pour la dernière fois (AUT-079). Chacune sert l'équipe dès le premier jour — c'est ce qui évite une option que le promoteur ignore, ou un lot vendu qui reste affiché.
3. **Le nom de celui qui a répondu** est gardé avec la réponse (ACP-013).

**ACP-071** `[P1]` **Ce que la Phase 1 ne construit pas** : le choix d'un niveau et l'onglet « Accès », les demandes envoyées d'office, les pages de réponse, la relecture des réponses, les relances aux partenaires, les comptes de partenaires, le portail. Le schéma de données les prévoit (`PartnerAnswer`, la portée d'un lien, « Répond aux demandes », la voie au journal d'audit) — comme pour toute fonction d'une phase ultérieure — ; aucun écran, aucune route, aucun test ne les concerne en Phase 1.

**ACP-072** `[P2]` `[P3]` **Ordre de réalisation, après la Phase 1** (Q-047).

| Étape | Contenu | Après | Étiquette |
|---|---|---|---|
| B.0 | **Socle des accès** : choix du niveau, interlocuteurs qui répondent, lien de réponse et sa page, demandes envoyées d'office, réponses à relire, relance, silence | Phase 1 | `[P2]` `[P3]` |
| B.1 | Niveau 2 pour les **promoteurs** : ses gestes par lien, page du stock | B.0 | `[P2]` |
| B.2 | Niveau 2 pour les **banques** : panneau « Votre réponse », barème par lien | B.0 | `[P3]` |
| B.3 | Niveau 3 : comptes de partenaires, application du portail, portail promoteur | B.0, B.1 | `[P2]` |
| B.4 | Niveau 3 : portail banque | B.2, B.3 | `[P3]` |

B.1 et B.2 sont indépendantes l'une de l'autre. Tout le niveau 2 vient avant le premier portail : il coûte peu — les commandes existent, le lien et sa page aussi — et sert dès le premier partenaire qui le demande.

**ACP-073** `[P1]` **Recette.** Niveau 1 : P39 (option confirmée ou refusée par le promoteur), P40 (vérification des disponibilités et du barème), P41 (ce que l'équipe attend d'un partenaire, et qui a répondu). `[P2]` `[P3]` Niveaux 2 et 3 : P42 (promoteur, par lien), P43 (banque, par lien), P44 (changement de niveau en plein dossier), P45 (portail : comptes, puis retour au niveau 2).

## 9. S'inscrire comme partenaire (D-091)

**ACP-080** `[P1]` **Deux portes.** Le client s'inscrit et se connecte par `/inscription` et `/connexion` (EC-01 à EC-08) ; le promoteur et la banque, par `/partenaires/inscription` (EP-32) et `/partenaires/connexion` (EP-33). Les deux portes se renvoient l'une à l'autre : « Vous êtes promoteur ou banque ? Espace partenaire » sous la connexion client, « Vous cherchez un bien ? Espace client » sous la connexion partenaire. Un compte n'a qu'une nature (ROL-001) : une adresse déjà prise par un compte client, du personnel ou d'un autre partenaire ne sert pas à une inscription partenaire. L'écran répond alors comme toujours (« Vérifiez votre boîte e-mail. », TRV-112) et l'e-mail envoyé à cette adresse explique la situation (`P_PARTNER_EMAIL_VERIFICATION`, variante « adresse déjà utilisée »). Seuls les promoteurs et les banques s'inscrivent ; les notaires, assureurs, institutions et médias écrivent par « Devenir partenaire » (EP-23, DEM-019).

**ACP-081** `[P1]` **Le formulaire d'inscription** (EP-32), en deux étapes courtes, sans aucun document : « Étape {n} sur 2 », « Continuer », « Retour » ; on ne passe à la suivante que si l'étape est valide (TRV-061) ; les saisies restent en cas de rechargement (TRV-092), sauf le mot de passe.

| Étape | Champs |
|---|---|
| 1. Vous êtes | Promoteur immobilier · Banque ou établissement financier (grandes cartes à choisir, avec une phrase sur ce que l'espace leur apportera). Sous les cartes, trois lignes pour le partenaire pressé : « Inscription gratuite » · « Une convention après acceptation, rien avant » · « Un interlocuteur dédié vous contacte » — sans chiffre (D-048). |
| 2. Votre société et vous | Raison sociale (oui) · Pays (oui) · Ville (oui) · Prénom, Nom (oui, TRV-042) · Fonction (oui) · E-mail professionnel (oui, TRV-043) · Téléphone (oui, TRV-040) · Mot de passe (oui, AUTH-002) · case « J'ai lu et j'accepte la charte des partenaires » (oui, lien vers `/charte-partenaires`, EDI-060 ; écrit une ligne `Consent` de type `PARTNER_CHARTER`, source `partner-signup`, avec la version en vigueur) · case de consentement de DEM-020 (oui, source `partner-signup`). |

Bouton : **« Créer mon espace partenaire »**. Mêmes protections que les demandes : jeton de formulaire, limites et défi (DEM-030, AUTH-005).

**ACP-087** `[P1]` **Le dossier partenaire**, à compléter depuis l'espace partenaire (EP-33), une fois l'adresse confirmée. Une liste de trois rubriques, chacune avec son état (« À compléter » · « Complété ») et une barre « {n} sur 2 rubriques obligatoires » :

| Rubrique | Contenu |
|---|---|
| Votre activité (oui) | **Promoteur** : numéro d'immatriculation au registre du commerce · année de création · programmes en cours (nombre) · régions où vous construisez (choix multiple). **Banque** : numéro d'agrément · financements proposés — crédit classique · financement islamique (au moins un) · pays de résidence des clients que vous financez (choix multiple) · agence ou direction (facultatif). Site web (facultatif). |
| Justificatifs (oui) | Extrait d'immatriculation, ou agrément pour une banque (PDF ou image, 10 Mo au plus, MED-011) · présentation de la société (facultatif, PDF). |
| Votre image (facultatif) | Logo (image) · une phrase de présentation (200 caractères) · votre message à l'équipe (2 000 caractères). |

Chaque rubrique s'enregistre seule (« Enregistré. », `PATCH /partner/application/sections/{rubrique}`) et peut se reprendre plus tard ; les fichiers sont des `LeadFile`. Quand les deux rubriques obligatoires sont complétées, le bouton **« Envoyer mon dossier pour examen »** devient actif (`POST /partner/application/submit` → `applicationStatus = SUBMITTED`, événement `lead.application_submitted`). L'équipe peut aussi demander un complément à tout moment (ACP-084).

Ce que devient chaque réponse à l'acceptation (ACP-084) :

| Réponse | Promoteur | Banque |
|---|---|---|
| Raison sociale | `legalName` (et `name` de l'organisation) | `name` |
| Pays · Ville | `countryCode` · `addressLine` (la ville en texte ; `cityId` si une commune du référentiel porte ce nom) | `countryCode` · — |
| Site web | `website` | — |
| Immatriculation · agrément | `registrationNumber` | `licenseNumber` |
| Année de création | `foundedYear` | — |
| Financements proposés | — | `offersIslamicFinance` (vrai si « financement islamique » est coché) |
| Phrase de présentation | `descriptionPublic` | `descriptionPublic` |
| Logo | `Media` du propriétaire `PROMOTER`, `logoMediaId` | `Media` `BANK`, `logoMediaId` |
| Justificatifs | `PartnerDocument` « Registre de commerce » (et « Autre » pour la présentation) | `PartnerDocument` « Agrément » |
| Personne : prénom, nom, fonction, e-mail, téléphone | `PromoterContact` principal (`role` = fonction, `userId` = le compte) | `BankContact` (`agency` = agence ou direction, `userId`) |
| Programmes en cours, régions, pays des clients, message | Gardés dans `application`, lus sur la demande, non reportés sur la fiche | idem |

**ACP-082** `[P1]` **Après l'envoi.** L'écran est toujours le même : « Vérifiez votre boîte e-mail. Nous venons d'écrire à {adresse} pour confirmer qu'elle est bien la vôtre. » La candidature est enregistrée aussitôt : une demande `PARTNER_REQUEST` d'origine `WEB_FORM`, qui garde toutes les saisies et le compte qui l'a déposée ; le dossier (ACP-087) s'y ajoute au fur et à mesure, les justificatifs étant des fichiers attachés. Le lien de `P_PARTNER_EMAIL_VERIFICATION` est valable 24 heures (AUTH-013) ; tant qu'il n'est pas suivi, la candidature porte « Adresse non vérifiée » dans le back-office. L'adresse confirmée, la personne arrive dans son espace sur son dossier à compléter et reçoit `P_PARTNER_APPLICATION_ACK`. La candidature porte « Dossier à compléter » et n'est examinée qu'une fois le dossier envoyé ; la Direction et les administrateurs sont alors notifiés, comme pour DEM-019.

**ACP-083** `[P1]` **Ce que voit la personne en se connectant** (EP-33), selon l'état de sa candidature :

| État | Écran |
|---|---|
| Adresse non vérifiée | « Confirmez votre adresse e-mail pour ouvrir votre espace partenaire. » · « Renvoyer le lien » (AUTH-012). |
| Dossier à compléter | « Bienvenue, {prénom}. Complétez votre dossier pour que nous puissions l'étudier. » · la liste des rubriques d'ACP-087, leur état, la barre de progression · « Envoyer mon dossier pour examen ». |
| Tous les états | Un bloc « Une question ? » avec `contact.partnersEmail` (sinon `contact.email`) et `contact.phone` : l'équipe peut aider à compléter (ACP-084), le candidat doit le voir. |
| En cours d'examen | « Nous étudions votre candidature. » · « Nous vous répondons sous {n} jours ouvrés. » (`partner.applicationReviewDays`, 5) · le récapitulatif de ce qui a été envoyé · « Une question ? Écrivez-nous. » |
| Complément demandé | Le message de l'équipe, mot pour mot · « Ajouter un document » et « Répondre » · « Envoyer ». La candidature repasse « En cours d'examen ». |
| Acceptée | La page **« Votre espace partenaire »** : bienvenue, votre interlocuteur chez Diaspora Patrimoine (`accountManagerId` : son `displayName`, `contact.phone`, `contact.partnersEmail` sinon `contact.email`), votre présence sur le site — tant que la fiche est `PROSPECT` (le cas à l'acceptation, ACP-084) : « Votre fiche sera en ligne après votre échange avec {interlocuteur} : préparez votre logo, votre présentation et vos programmes. » ; ensuite (promoteur : lien vers `/promoteurs/{slug}` quand la fiche est `ACTIVE` et publique ; banque : « votre logo figure sur la page Financements » aux mêmes conditions) —, et ce qui vient ensuite : « Votre espace s'enrichira : vous pourrez bientôt répondre aux demandes et suivre vos dossiers ici. ». |
| Refusée | « Votre candidature n'a pas été retenue. » · le motif s'il a été écrit pour la personne · « Nous écrire ». Le compte est fermé 30 jours plus tard (`DELETED`, MOD-100). |

**ACP-084** `[P1]` **L'examen par l'équipe** — un écran du back-office, livré avec lui ; d'ici là, l'inscription, le dossier et son envoi fonctionnent, et la règle `R_PARTNER_APPLICATION_SUBMITTED` prévient l'équipe (AUT-084, D-097). La demande d'une inscription montre, en plus de DEM-019, le panneau « Candidature partenaire » : la société, la personne, l'état de l'adresse et du dossier (rubriques complétées, justificatifs). Tant que le dossier n'est pas envoyé, la demande est rangée à part (« Dossier à compléter ») et l'équipe peut appeler la personne pour l'aider. Trois actions (`lead.process`) : **Accepter** — crée la fiche du promoteur ou de la banque au statut `PROSPECT`, comme si l'équipe l'avait saisie, et son organisation (MOD-103), d'après la table d'ACP-087 ; ou la rattache à une fiche qui existe déjà (« Rattacher à {nom} », proposé quand le nom ou le numéro d'immatriculation correspond : le contact principal existant est conservé, la personne devient un contact secondaire) ; la personne devient contact (principal pour une fiche créée), avec son compte (`PromoterContact.userId`, `BankContact.userId`), et membre de son organisation avec le rôle `ADMIN` ; l'auteur de l'acceptation devient l'interlocuteur du partenaire (`accountManagerId`) ; événement `lead.application_approved`, e-mail `P_PARTNER_APPLICATION_APPROVED`. **Demander un complément** — un message écrit pour la personne (`applicationStatus = INFO_REQUESTED`) ; événement `lead.application_info_requested`, e-mail `P_PARTNER_INFO_REQUESTED`. **Refuser** — un motif interne et, facultatif, une phrase pour la personne (`DECLINED`) ; événement `lead.application_declined`, e-mail `P_PARTNER_APPLICATION_DECLINED`. La demande est close à l'acceptation et au refus ; le journal d'audit garde qui a décidé et quand (SEC-080). Ces trois actions demandent `lead.process` et `promoter.write` ou `bank.write` (un conseiller seul ne crée pas un partenaire).

**ACP-085** `[P1]` **Ce que le compte permet en Phase 1.** Rien d'autre que EP-33 : l'appartenance ne donne aucun droit sur les objets tant que le portail n'existe pas, et ACP-004 reste vrai (aucun niveau d'accès n'est montré). Quand le portail ouvre (ACP-050), ces comptes y entrent sans nouvelle invitation ; l'invitation d'ACP-051 reste la voie des interlocuteurs ajoutés par l'équipe. Les règles de mot de passe, de verrouillage et de session sont celles des clients (AUTH-002, AUTH-032, SEC-023) ; la double authentification arrive avec le portail.

**ACP-086** `[P1]` **Recette.** P39 à P41 restent ceux du niveau 1. L'inscription se recette avec eux : une inscription de promoteur jusqu'à l'acceptation (inscription, dossier complété en deux fois, envoi, acceptation), une inscription de banque jusqu'au refus, une adresse déjà utilisée par un client.
