# Back-office — catalogue et promoteurs

Écrans **EA-40** (programmes), **EA-41** (un programme), **EA-42** (biens), **EA-43** (un bien), **EA-44** (médias), **EA-45** (import de lots), **EA-46** (mise en avant sur l'accueil), **EA-47** (autres partenaires), **EA-50** (promoteurs), **EA-51** (un promoteur). Contrat : offre technique, § 4.3 (gestion des annonces) et § 4.4 (promoteurs, programmes, inventaire des lots, médiathèque, suivi de la relation).

Modèle : `01-domaine/03`. Publication : CYC-120 à CYC-126. Complétude : CAL-050. En Phase 1, c'est l'équipe de Diaspora Patrimoine qui saisit pour le compte des promoteurs ; les mêmes écrans serviront au portail promoteur (`05-phases-ulterieures/01`).

Objectif repris de la conception d'origine : **une fiche publiable en cinq minutes** — huit champs, un prix et quelques photos —, que l'on enrichit ensuite. La règle exacte est celle de CYC-120 et du score de CAL-050, qui demande **60 points** : les huit champs obligatoires en donnent 40 ; les 20 autres viennent, au plus court, de **six photos** — ou de **trois photos et d'une description rédigée** d'au moins 300 caractères. Tant que la visite 360° et les points d'intérêt sont désactivés — le cas de la Phase 1 —, leurs points sortent du calcul et le score est ramené sur 100 : **trois photos suffisent** alors (CAL-050). Une typologie qui n'a pas encore ses propres photos compte celles de son programme (MOD-236) : si le programme en a six, elle est publiable dès ses huit champs et son premier lot. La carte de complétude (CTL-043) dit toujours ce qui manque pour atteindre le seuil.

---

## 1. Promoteurs (EA-50, EA-51)

**CTL-001** `[P1]` **Liste.** Colonnes : Nom · Statut · Région · Programmes · Biens publiés · Dossiers en cours · Fin de convention · Public. Vues d'origine : « Sélectionnés » (`ACTIVE`) · « En discussion » · « Suspendus et terminés » · « Tous ».

**CTL-002** `[P1]` **Créer** (`promoter.write`) : raison sociale (obligatoire), nom commercial, pays (obligatoire). Le promoteur naît `PROSPECT`, avec son organisation (MOD-103) et son slug, formé du nom affiché (`brandName`, sinon `legalName` ; TRV-052).

**CTL-003** `[P1]` **Fiche**, en onglets :

| Onglet | Contenu |
|---|---|
| Identité | Tous les champs de `Promoter` : raison sociale, nom commercial, registre de commerce, identifiant fiscal, agrément, pays, région, commune, adresse, site web, e-mail, téléphone. |
| Contacts | Les interlocuteurs (`PromoterContact`) : nom, fonction, e-mail, téléphone, note ; un contact principal. |
| Sélection | La liste de contrôle (`vettingChecklist`) : des lignes à cocher, chacune avec une note. Lignes proposées à la création, modifiables (Q-003) : Registre de commerce vérifié · Agrément de promoteur vérifié · Références de programmes livrés · Garanties du programme examinées · Chantier ou programme livré visité · Convention signée. Puis la date de sélection. |
| Convention | Date de signature, date de fin, conditions de commission (texte interne). Onglet visible et modifiable avec `partner.convention.manage` seulement ; les autres rôles ne voient que les deux dates, dans l'en-tête. |
| Documents | Les pièces du promoteur (`PartnerDocument`) : libellé, catégorie, dates d'émission et d'expiration, fichier. Alerte 30 jours avant une expiration (AUT-073). Ouvrir un fichier demande `promoter.read` (lien signé, MED-030) ; chaque ouverture est tracée (`partner.document_viewed`). |
| Page publique | Bascule « Visible sur le site » ; présentation ; références ; année de création ; logements livrés ; logo ; image de couverture ; lien « Voir la page ». |
| Programmes | Ses programmes et leurs biens, avec leur état de publication. |
| Relation | CTL-005. |
| Accès `[P2]` | CTL-008. |
| Historique | Notes et chronologie. |

**CTL-004** `[P1]` **Changer de statut** (CYC-240). « Sélectionner » (`PROSPECT` → `ACTIVE`) exige la date de sélection et la date de signature de la convention. « Suspendre » et « Terminer » demandent une raison et annoncent leurs effets : « 2 programmes et 7 biens seront dépubliés. 3 dossiers en cours sont concernés ; leurs conseillers seront prévenus. » (MOD-110) — terminer une relation n'exige pas de dépublier d'abord à la main : la fenêtre le fait, après confirmation. La page publique d'un promoteur ne peut être activée que s'il est `ACTIVE`. Une suspension ou une fin de relation ne touche pas à la bascule « Visible sur le site » (`isPublic`) : la page n'est servie que si le promoteur est public **et** `ACTIVE` (EDI-031), et elle revient d'elle-même à son retour à `ACTIVE`. La raison donnée est gardée sur la fiche, avec la date (`statusReason`, `statusChangedAt`), et affichée dans son en-tête.

**Après une suspension.** Quand le promoteur redevient `ACTIVE`, rien n'est republié d'office (une suspension a ses raisons). Sa fiche affiche : « {n} fiches ont été dépubliées par la suspension du {date}. » ({date} : la plus récente des marques `unpublishedBySuspensionAt` de ces fiches) · bouton **« Les republier »** (`catalogue.publish`). Les fiches qui remplissent toujours les conditions de publication sont republiées en une fois ; les autres sont listées avec ce qui leur manque. Une fiche dépubliée ou republiée à la main entre-temps ne fait plus partie du lot.

**CTL-005** `[P1]` **Onglet Relation** — le suivi demandé par le contrat. Sur une période choisie : biens de ce promoteur proposés à des clients · intérêts reçus · visites tenues · options en cours · réservations confirmées · ventes · dossiers clôturés et leurs motifs. Période par défaut : les 90 derniers jours. Un bien « de ce promoteur » est un bien dont `promoterId` est le sien. *Proposés* : biens candidats `ADVISOR_PROPOSAL` dont `sentAt` tombe dans la période (un bien proposé à deux clients compte deux fois) ; *intérêts reçus* : demandes `PROPERTY_INTEREST` créées dans la période sur un de ses biens ou de ses programmes ; *visites tenues* : rendez-vous `PROPERTY_VISIT` ou `VISIO` sur un de ses biens, passés `DONE`, dont `startsAt` tombe dans la période ; *options en cours* : réservations `OPTION` actives aujourd'hui, quelle que soit la période ; *réservations confirmées* : `reservedAt` dans la période ; *ventes* : dossiers gagnés (`wonAt` dans la période) sur ses biens, et, sur une ligne à part, ses lots passés `SOLD` hors plateforme (`externalSale`, `statusChangedAt` dans la période) ; *dossiers clôturés* : dossiers `LOST` dont `lostAt` tombe dans la période et dont `promoterId` est le sien, groupés par `lostReason`. M21 emploie les mêmes définitions. Dessous : la liste des dossiers en cours sur ses biens (référence, client, bien, lot, étape, conseiller), et celle des options et réservations avec leurs échéances.

En tête de l'onglet, le bloc **« Ce que nous attendons de lui »** (ACP-015, ACP-020) : les options qu'il n'a pas encore confirmées · les options confirmées dont la réservation reste à signer · les réservations sans contrat · les pièces attendues de lui · les acomptes à rembourser · les visites confirmées sans personne désignée pour accueillir · les programmes dont les disponibilités sont à vérifier · les livraisons dépassées · ses documents qui expirent. Chaque ligne donne son échéance, depuis combien de jours elle attend, et « Saisir la réponse », qui ouvre la fenêtre du geste (ACP-016). Vide : « Rien n'attend ce promoteur. ». C'est la liste que le promoteur recevra par lien au niveau 2, et lira dans son portail au niveau 3 : elle n'est écrite qu'une fois.

**CTL-006** `[P1]` **Écrire au promoteur.** Depuis la fiche ou depuis un dossier : un e-mail manuel à l'un de ses contacts, avec les modèles `P_PROMOTER_OPTION_REQUEST`, `P_PROMOTER_VISIT_REQUEST` et `P_PROMOTER_STOCK_CHECK` (COM-020). L'e-mail figure dans l'historique du promoteur (`Communication.promoterId`) et, s'il part d'un dossier, dans celui du dossier — sans y figurer côté client. Un rejet de l'adresse du contact prévient l'auteur ; il ne touche aucune fiche client (AUT-071).

**CTL-007** `[P1]` **Supprimer** (`promoter.delete`, rôle Direction) : seulement s'il n'a ni programme, ni bien, ni dossier (MOD-111). Sinon : « Terminer » la relation.

**CTL-008** `[P2]` **Onglet Accès** (`00-cadre/06`). Il n'existe pas en Phase 1, où tous les partenaires sont au niveau 1 (ACP-004). À l'ouverture du niveau 2 : le niveau du promoteur et son changement (`partner.access.manage`, CYC-241), avec l'annonce chiffrée de ses effets · la case « Répond aux demandes » de chaque interlocuteur · les liens envoyés et leur état · les réponses à relire (ACP-031) et celles déjà traitées. Au niveau 3 : les utilisateurs du portail (PPR-004).

## 2. Programmes (EA-40, EA-41)

**CTL-020** `[P1]` **Liste.** Colonnes : Nom · Promoteur · Région · Standing · Livraison · Biens · Lots disponibles / total · Prix à partir de · Publication · Modifié le. Vues d'origine : « Publiés » · « Brouillons » · « Archivés » · « Tous ».

**CTL-021** `[P1]` **Fiche**, en onglets : Informations · Biens · Lots · Médias · Financement · Chantier `[P1]` · À proximité `[P1]` · Dossiers · Historique.

**CTL-022** `[P1]` **Onglet Informations**, par sections :

| Section | Champs |
|---|---|
| Identité | Nom · promoteur (seuls les promoteurs non terminés sont proposés) · accroche · standing (Q-036) · nombre total de logements. |
| Localisation | Pays · région · commune (facultative : elle précise le lieu sur la fiche, sans être exigée pour publier) · adresse (interne) · position sur une carte (clic pour placer le repère). Rappel affiché : « L'adresse et la position exactes ne sont jamais publiées. » (FIC-060). |
| Livraison | Statut · date · précision (mois, trimestre, année). |
| Description | 5 000 caractères ; 100 au moins pour publier. |
| Équipements | Cases de la liste `catalogue.amenities`. |
| Garanties | 600 caractères, texte public. |
| Mise en avant | Étiquette (40 caractères) et date de fin. |
| Référencement | Titre (70) et description (160), avec compteur et aperçu du résultat de recherche ; adresse de la page et bouton « Régénérer l'adresse » (TRV-052). |

Modifier le lieu, le standing ou la livraison d'un programme qui a des biens annonce : « Ce changement s'applique aux {n} biens du programme. » (MOD-201).

**CTL-023** `[P1]` **Onglet Biens** : les typologies du programme, avec surface, prix, lots, publication, complétude ; bouton « Ajouter une typologie » (CTL-041). **Onglet Lots** : tous les lots du programme dans un seul tableau (CTL-060), avec le filtre par typologie.

**CTL-024** `[P1]` **Actions** : Enregistrer · **Publier** (CYC-125 ; si une condition manque, la liste de ce qui manque) · Dépublier · Archiver (CYC-126 : la fenêtre donne le nombre de biens touchés et, pour un archivage, les dossiers ouverts qui en dépendent) · Republier et Désarchiver proposent de faire revenir les biens partis avec le programme (CYC-126) · Aperçu (FIC-120) · Dupliquer (copie les informations, pas les biens, ni les médias ; voir « Copie » ci-dessous) · Supprimer (`catalogue.delete`) : seulement un programme **sans bien** — ses biens se suppriment ou s'archivent d'abord (MOD-013) ; sinon, refus `409 CONFLICT_STATE`, raison `PROGRAM_HAS_PROPERTIES`. Modifier un programme **publié** est contrôlé comme l'est un bien publié : un changement qui rendrait le programme, ou l'un de ses biens en ligne, non publiable est refusé, et la fenêtre nomme les biens concernés (CYC-122). **Copie.** Un programme ou un bien dupliqué naît `DRAFT`, avec un nouveau slug (TRV-052) ; un programme copié se nomme « {nom} (copie) », raccourci au besoin ; un bien copié reçoit une nouvelle référence (TRV-051) et son titre automatique (MOD-210). Ne sont pas copiés : la mise en avant et l'épingle, le référencement, les dates de publication et les marques de dépublication, les compteurs et les caches (recalculés), la vérification des disponibilités (`stockConfirmedAt`, `stockConfirmedBy`), l'éligibilité au financement (CTL-130), les médias. Le lot unique d'un bien isolé copié prend la référence du nouveau bien (MOD-212) : il n'a pas de référence provisoire.

## 3. Biens (EA-42, EA-43)

**CTL-040** `[P1]` **Liste.** Colonnes : Référence · Titre · Programme · Promoteur · Région · Type · Pièces · Surface · Prix à partir de (devise du bien et devise de référence) · Lots disponibles / total · Disponibilité · Publication · Complétude · Vues · Intérêts · Modifié le. Vues d'origine : « Publiés » · « Brouillons » · « À compléter » (publiés, score inférieur à `catalogue.completeScore`) · « Sans photo réelle » · « Réservés et vendus » · « Archivés » · « Tous ».

**CTL-041** `[P1]` **Créer un bien** — deux entrées :
- **Typologie d'un programme** : le programme, puis type, pièces, surface. Le lieu, le standing, le promoteur et la livraison viennent du programme (MOD-200).
- **Bien isolé** : promoteur, type, pièces, surface, pays, région, commune, standing, livraison, prix. Son lot unique est créé avec lui (MOD-212).

La référence (`DP-{pays}-{numéro}`) est attribuée à la création et ne change plus. Le titre est généré (MOD-210).

**CTL-042** `[P1]` **Fiche**, en onglets : Informations · Lots · Médias · Financement · À proximité `[P1]` · Demandes et dossiers · Historique. **Sections de l'onglet Informations** :

| Section | Champs |
|---|---|
| Identité | Type · pièces · chambres · salles de bain · titre (avec « Titre automatique » et « Revenir au titre automatique ») · description (avec « Description automatique », même principe, MOD-211). |
| Surfaces | Surface de référence · terrasse ou balcon · terrain. |
| Caractéristiques | Cases de la liste `catalogue.features`. |
| Livraison | Bascule « Reprendre la livraison du programme » ; sinon statut, date, précision. |
| Localisation | Bien isolé seulement : comme le programme. |
| Mise en avant | Étiquette et date de fin · « Épingler sur l'accueil » avec un rang (`catalogue.publish`, CTL-150). |
| Référencement | Comme le programme. |

Après la première publication, type, pièces et programme ne se modifient plus si le bien a reçu une demande (MOD-213) : les champs sont verrouillés, avec l'explication.

**CTL-043** `[P1]` **Carte de complétude**, toujours visible à droite de la fiche (CAL-050, CAL-051) :
- le score, et son état : « Brouillon · {n} obligatoires manquants » · « Publiable · à améliorer » · « Fiche complète » ;
- les **actions** qui rapportent le plus, trois au plus : « Ajouter 5 photos (+12) », « Ajouter le plan (+10) », « Ajouter la visite 360° (+10) » ; les champs obligatoires manquants d'abord, marqués « obligatoire » ; chaque ligne mène au bon endroit ;
- le bouton « Publier », actif dès que les conditions de CYC-120 sont réunies.

**CTL-044** `[P1]` **Actions** : Enregistrer · Publier · Dépublier · Archiver · Désarchiver (retour en brouillon, pour retravailler la fiche avant de la republier) · Aperçu · Dupliquer (copie les informations, selon la « Copie » de CTL-024, et, au choix, les lots — sans leur statut ; chaque lot copié reçoit une **référence provisoire**, unique dans le programme (« {référence}-copie », numérotée au besoin), que le tableau signale « Référence à saisir » ; tant qu'elle n'est pas remplacée, le lot reste retiré de la vente (MOD-230) ; pas les médias) · Supprimer (`catalogue.delete` ; refusé si le bien a une demande, un dossier, une réservation : il s'archive). **Publier** refusé : la fenêtre liste tout ce qui manque (CYC-120). **Archiver** annonce ce qui en dépend : « {n} dossiers ouverts envisagent ce bien ; {m} l'ont retenu. Leurs clients liront “Ce bien n'est plus disponible”. » (CYC-073). Une modification qui rendrait un bien publié non publiable est refusée (CYC-122).

**CTL-045** `[P1]` **Onglet Demandes et dossiers** : les demandes reçues pour ce bien, les dossiers où il est envisagé (avec le statut du bien candidat), ceux où il est retenu. Compteurs : vues, intérêts, propositions, visites.

## 4. Lots

**CTL-060** `[P1]` **Tableau des lots**, modifiable ligne par ligne. Colonnes : Lot · Typologie (dans le tableau d'un programme, qui réunit les lots de tous ses biens, brouillons compris) · Bâtiment · Étage · Porte · Orientation · Surface · Terrasse · Terrain · Prix · Prix au m² (calculé, CAL-024) · Statut · Parking inclus · Options · Plan · Livré le. Actions : ajouter un lot · dupliquer un lot (la copie naît retirée de la vente, avec une référence provisoire ; la remplacer permet de la mettre en vente : MOD-230) · supprimer (MOD-230) · modifier le prix de plusieurs lots à la fois · « Marquer livrés » (date de livraison réelle, pour les lots sélectionnés ; jamais future — Q-014). Quand un bien ou un programme passe au statut « Livré », l'écran propose de reporter la date sur tous ses lots.

**CTL-061** `[P1]` **Prix.** Saisi dans la devise du bien ; l'équivalent dans la devise de référence s'affiche à côté. Tout changement est historisé (MOD-231) : une icône ouvre l'historique des prix du lot (date, ancien prix, nouveau prix, auteur). **Modification groupée** : « Augmenter ou baisser de {x} % » ({x} de −90 à +500, deux décimales au plus ; le nouveau prix est arrondi à l'unité la plus proche de la devise du bien) ou « Fixer à {montant} », sur les lots sélectionnés ; un récapitulatif avant validation. Les lots qui ont une réservation active sont **inclus** et signalés dans le récapitulatif : c'est leur prix **public** qui change, celui qu'ils retrouveront s'ils reviennent en vente ; le prix convenu de leur réservation ne bouge pas (MOD-313). Il en va de même d'une modification ligne par ligne.

**CTL-062** `[P1]` **Statut.** Un lot **sous option ou réservé par un dossier** affiche le dossier (lien) et son échéance ; son statut ne se change pas ici (CYC-100). Les autres changements manuels — vendu ou réservé hors plateforme, retiré, remis en vente (refusé tant que la référence du lot est provisoire : « Saisissez d'abord la référence de ce lot. », MOD-230) — demandent une note et cochent `externalSale` quand il y a lieu. Chaque changement recalcule la disponibilité du bien (CYC-110) et met le site à jour. Avant de marquer « vendu » ou « retiré » un lot dont dépendent des dossiers, la fenêtre l'annonce : « {n} dossiers envisagent ce bien ; {m} visent ce lot. Leurs conseillers seront prévenus. » (CYC-073, CYC-102). Une vente hors plateforme **saisie par erreur** se corrige : « Annuler cette vente » (`catalogue.publish`, raison obligatoire) remet le lot en vente (CYC-100) ; un lot vendu par un dossier ne se corrige pas ici.

**CTL-063** `[P1]` **Bien isolé** : pas de tableau ; les champs de son lot unique (prix, étage, orientation, statut…) figurent dans l'onglet Informations. Rien ne se saisit deux fois : la référence du lot est celle du bien, ses surfaces sont celles de la section « Surfaces » (MOD-212).

**CTL-064** `[P1]` **Disponibilités vérifiées** (`catalogue.write`, AUT-079). En tête du tableau des lots d'un programme (et sur un bien isolé) : « Disponibilités vérifiées le {date} avec {interlocuteur} », ou, passé `catalogue.stockCheckDays` jours, l'alerte « À vérifier avec le promoteur ». Le bouton **« Disponibilités vérifiées »** ouvre une fenêtre : qui chez le promoteur l'a confirmé (un de ses contacts, ou un nom ; facultatif) · note. La note, si elle est saisie, devient une note interne du programme (ou du bien isolé), préfixée « Disponibilités vérifiées : » ; sans interlocuteur, l'en-tête lit « Disponibilités vérifiées le {date} ». Sur un bien isolé, la route est `POST /admin/properties/{id}/confirm-stock`, et l'événement le même que pour un programme (`program.stock_confirmed`, avec `propertyId`). Il s'emploie **après** avoir corrigé les lots qui ont changé (CTL-061, CTL-062) : il dit que tout le tableau est juste à cette date. « Écrire au promoteur » ouvre `P_PROMOTER_STOCK_CHECK` (CTL-006). C'est le geste `STOCK_UPDATE` (ACP-020). Quand plus aucun programme du promoteur n'est à vérifier, la tâche de vérification se termine (AUT-079).

## 5. Médias (EA-44)

**CTL-080** `[P1]` **Onglet Médias** d'un programme ou d'un bien. Dépôt par glisser-déposer ou par sélection, plusieurs fichiers à la fois ; chaque fichier montre sa progression, puis « Traitement en cours », puis sa vignette.

| Nature | Formats | Limites |
|---|---|---|
| Photo, image 3D | JPG, PNG, WebP, HEIC | 20 Mo ; avertissement sous 1 600 × 1 000 px (« Image petite : elle sera floue en grand. ») |
| Plan | PDF, JPG, PNG | 25 Mo |
| Brochure | PDF | 25 Mo |
| Vue 360° `[P1]` | JPG équirectangulaire, rapport 2:1 | 50 Mo ; 4 096 × 2 048 px au moins ; refus si le rapport n'est pas 2:1 |
| Vidéo | Adresse YouTube ou Vimeo | Seule la **forme** de l'adresse est vérifiée à la saisie (hôte et identifiant de vidéo reconnus) ; le serveur ne va chercher aucune adresse (SEC-062). L'aperçu du back-office montre si la vidéo se lit. |

Natures permises selon le propriétaire : MOD-235. Détail du traitement : `06-technique/05`. Tout fichier déposé est contrôlé par l'antivirus **avant** d'être traité et de pouvoir passer « Prêt » (MED-021). Le dépôt de médias par l'équipe n'est pas soumis à la limite horaire des dépôts de pièces : cent fichiers par lot de dépôt (SEC-070).

**CTL-081** `[P1]` **Pour chaque média** : nature · pièce (`roomLabel`, liste fermée, chaque valeur enregistrée en toutes lettres, en français : Façade · Séjour · Cuisine · Chambre 1 à 5 · Salle de bain · Balcon ou terrasse · Vue · Parties communes · Parking · Extérieur · Autre ; obligatoire pour une vue 360°) · légende · texte de remplacement (proposé automatiquement, MED-023) · date de prise de vue · « Image d'illustration » (Q-031) · « Couverture » — proposée seulement sur une photo ou une image 3D prête ; une seule par propriétaire ; si la couverture est supprimée, la suivante dans l'ordre la remplace (MOD-203). L'ordre se règle par glisser-déposer.

**CTL-082** `[P1]` **États.** « Traitement en cours » : le média n'est pas encore public. « Échec » : le motif et « Réessayer » (action `retry`, qui relance le contrôle et le traitement du fichier déjà reçu ; elle n'est pas proposée quand l'antivirus a refusé le fichier, qui est alors supprimé — on le dépose à nouveau, MED-021). Une vidéo n'a pas de traitement : elle naît « Prêt » dès que la forme de son adresse est acceptée (CTL-080). Un média n'apparaît sur le site qu'à l'état « Prêt ».

**CTL-083** `[P1]` **Supprimer** un média demande confirmation ; refusé s'il est la dernière image dont dispose un bien publié — les siennes ou, à défaut, celles de son programme (MOD-236) —, ou si sa suppression ferait tomber un bien publié sous le seuil de publication (CYC-122). La règle vaut aussi pour un média **du programme** dont dépendent des typologies sans photo propre : « {n} biens en ligne n'ont pas d'autre photo que celles du programme : {liste}. ». Un bien sans photo propre affiche le rappel : « Ce bien utilise les photos de son programme. » (MOD-236).

**CTL-084** `[P1]` **Actions groupées** sur des médias sélectionnés : changer la nature · marquer « Image d'illustration » · supprimer.

## 6. Import de lots (EA-45)

**CTL-100** `[P1]` **Import d'une grille** (`catalogue.import`), depuis l'onglet Lots d'un programme. Fichier CSV ou XLSX, 5 Mo et 2 000 lignes au plus. Un **modèle** se télécharge, en XLSX et en CSV (séparateur `;`, UTF-8) : sa première ligne porte les noms des colonnes ci-dessous. Un CSV déposé est lu en UTF-8, avec ou sans BOM, avec le séparateur `;` ou `,` reconnu sur la ligne d'en-tête ; un XLSX, sur sa première feuille. Une ligne = un lot.

| Colonne | Oblig. | Règles |
|---|---|---|
| `lot` | oui | Référence du lot chez le promoteur. Sert de clé dans le programme. |
| `bien` | l'un des deux | Référence d'un bien existant du programme (`DP-DZ-0142`). |
| `type`, `pieces` | l'un des deux | À défaut de `bien` : désignent la typologie (« Appartement », 3). Si elle n'existe pas dans le programme, elle est **créée en brouillon**, avec pour surface de référence la plus petite surface de ses lots dans le fichier. Si **plusieurs** typologies du programme ont ce type et ce nombre de pièces, la ligne est en erreur : « Plusieurs typologies correspondent : indiquez la colonne `bien`. ». Pour un lot **déjà présent**, ces deux colonnes sont ignorées : le lot reste dans son bien ; si elles désignent une autre typologie que la sienne, la ligne est signalée (« Typologie différente dans le fichier : le lot reste dans {bien}. »). |
| `surface` | oui | m² |
| `prix` | oui | Dans la devise du programme. Nombres lus selon TRV-026 : « 22 350 000 », « 22.350.000 » et « 22350000 » sont le même prix ; une valeur ambiguë met la ligne en erreur plutôt que d'être devinée. |
| `batiment`, `etage`, `porte`, `orientation`, `terrasse`, `terrain`, `parking`, `options` | non | Lecture ci-dessous. |
| `statut` | non | Disponible · Réservé · Vendu · Retiré. **Vide : le statut n'est pas touché** (un lot nouveau naît disponible). « Réservé » et « Vendu » sont enregistrés comme hors plateforme. |

**Lecture des colonnes.** Les espaces de début et de fin d'une cellule sont retirés avant toute lecture ; « sans casse ni accent » veut dire que majuscules, accents, tirets et espaces ne comptent pas.
- `lot` : texte, 40 caractères au plus. `bien` : une référence de bien, sans casse.
- `type` : libellé (« Appartement ») ou code (`APARTMENT`) de `PropertyType`, sans casse ni accent. `pieces` : entier de 1 à 12, vide pour un terrain ou un local (`Property.rooms`).
- `surface`, `terrasse`, `terrain`, `prix` : nombres lus selon TRV-026, deux décimales au plus, dans les bornes du modèle (`Lot`) ; dans un XLSX, une cellule de type nombre est prise telle quelle.
- `etage` : entier de −2 à 80 ; « RDC » et « rez-de-chaussée » valent 0, sans casse ni accent. Toute autre écriture (« 3e », « RDJ ») est illisible.
- `orientation` : code (`NE`) ou libellé (« Nord-Est », « nord est ») de `Orientation`, sans casse ni accent.
- `parking` : « oui », « x » ou « 1 » → inclus ; « non » ou « 0 » → non inclus ; sans casse.
- `batiment` : 40 caractères au plus ; `porte` : 20 ; `options` : 300.
- `statut` : libellé ou code de `LotStatus`, sans casse ni accent, parmi Disponible, Réservé, Vendu, Retiré ; « Sous option » est illisible : une option se pose depuis un dossier.

Une valeur illisible ou hors bornes, dans une colonne obligatoire **ou facultative**, met la ligne **en erreur** (rien n'est écrit pour elle), avec la colonne et la raison : on ne devine pas, et l'on ne tronque pas. Une cellule vide d'une colonne obligatoire met aussi la ligne en erreur ; une cellule vide d'une colonne facultative ne change rien (CTL-102).

**CTL-101** `[P1]` **Déroulement.**
1. Dépôt du fichier ; l'écran propose la correspondance entre les colonnes du fichier et les champs, modifiable.
2. **Contrôle à blanc**, sans rien écrire : « {n} lots à créer · {m} à mettre à jour · {k} typologies à créer · {s} lignes signalées · {e} lignes en erreur », avec le détail des erreurs et des signalements par ligne (numéro de ligne, colonne, raison) dans un fichier téléchargeable : un CSV (séparateur `;`, UTF-8 avec BOM, pour Excel), colonnes `ligne ; colonne ; niveau ; code ; message`, le niveau valant « erreur » ou « signalement ». Codes : `REQUIRED` (cellule obligatoire vide) · `INVALID_VALUE` (valeur illisible ou hors bornes) · `DUPLICATE_LOT` (même lot deux fois) · `AMBIGUOUS_TYPOLOGY` · `TYPOLOGY_MISMATCH` · `LOT_ELSEWHERE` (la colonne `bien` désigne un autre bien) · `STATUS_UNCHANGED` · `RESERVATION_PRICE` (prix public changé, prix convenu inchangé) · `HELD_BY_DOSSIER` (CTL-102). Une ligne **signalée** est appliquée, sauf pour le point qu'elle nomme ; une ligne **en erreur** n'est pas appliquée. L'écran liste aussi les lots du programme **absents du fichier** : « {a} lots ne figurent pas dans le fichier : ils ne sont pas touchés. ».
3. **Confirmation** : l'import s'exécute en arrière-plan et **rejoue tous les contrôles** sur l'état du moment — un lot a pu être vendu ou mis sous option depuis le contrôle à blanc. Son rapport (`ImportJob.report`) fait foi et peut différer de l'aperçu ; la notification de fin en donne les compteurs (`NS_IMPORT_FINISHED`).

**CTL-102** `[P1]` **Règles.** Un lot déjà présent (même référence dans le programme) est **mis à jour**. Réimporter la grille du promoteur des mois plus tard ne défait rien :
- pour un lot déjà présent, une cellule **vide** d'une colonne facultative, ou une colonne facultative **absente** du fichier, laisse le champ tel qu'il est ; seule une valeur écrite remplace. **Un import n'efface jamais une donnée** ;
- un statut n'est changé que si la colonne le demande **et** que la transition est permise à la main (CYC-100). Un lot sous option, réservé ou vendu par un dossier garde son statut ; un lot vendu ne revient pas en vente par un import ; dans ces cas la ligne est **signalée** (« Statut inchangé : {raison} »), et ses autres champs — prix, surface, étage — sont appliqués ;
- le prix **public** d'un lot qui a une réservation active est mis à jour comme les autres ; le prix convenu de sa réservation ne change pas (MOD-313) : la ligne est signalée, pour information ;
- quand le fichier dit « Vendu », « Réservé » ou « Retiré » pour un lot qu'un **dossier** tient sous option ou a réservé, le statut ne change pas, la ligne est signalée, et le conseiller de ce dossier reçoit une tâche prioritaire — « Le fichier de {promoteur} donne le lot {lot} comme {statut}, alors que le dossier {référence} le tient : à vérifier. » (`R_LOT_IMPORT_CONFLICT`) : c'est peut-être une vente faite de son côté par le promoteur (CYC-107) ;
- une ligne dont la colonne `bien` désigne un autre bien que celui où le lot se trouve déjà est en erreur : un import ne déplace pas un lot ;
- la même référence de lot deux fois dans le fichier : la seconde ligne est en erreur.

Une ligne en erreur n'empêche pas les autres ; rien n'est écrit pour elle. Importer deux fois le même fichier ne change rien la seconde fois. Un import ne supprime jamais un lot absent du fichier. Chaque import laisse une trace consultable (ADM-085) : fichier, auteur, date, compteurs, erreurs et signalements.

## 7. Financement des biens

**CTL-130** `[P1]` **Onglet Financement** d'un programme ou d'un bien (`catalogue.eligibility.manage`) : une ligne par banque `ACTIVE`, avec trois états — « Accepte de financer » · « Refuse » · « Non renseigné » —, une note et la date de la vérification (`FinancingEligibility`). La ligne posée sur un bien l'emporte sur celle de son programme (MOD-240). L'étiquette publique « Éligible au financement » en découle. L'onglet arrive avec le module des banques : tant qu'aucune banque n'existe, il n'apparaît pas, aucun bien n'est « éligible », et le filtre public correspondant n'est pas proposé (CAT-012).

## 8. Enrichissements

**CTL-140** `[P1]` **À proximité** : jusqu'à huit points d'intérêt — libellé, catégorie, durée en minutes, mode (à pied, en voiture, en transports) ; l'ordre se règle à la main. Le site en montre cinq (FIC-062).

**CTL-145** `[P1]` **Chantier** : « Ajouter un point d'avancement » — étape, pourcentage (jamais inférieur au précédent), note, date, photos. À l'enregistrement, le point paraît sur le site et les clients dont le dossier porte sur ce programme sont prévenus (`NC_PROGRAM_UPDATE`), sauf si la case « Ne pas prévenir les clients » est cochée. Un point se corrige ou se supprime.

## 9. Mise en avant sur l'accueil

**CTL-150** `[P1]` L'écran « Mise en avant » (EA-46, menu Catalogue, `catalogue.publish`) montre les **trois cartes** que l'accueil affiche en ce moment (ACC-051), en disant pour chacune si elle est épinglée ou choisie automatiquement. L'administrateur épingle jusqu'à **trois** biens publiés et disponibles, et règle leur rang (1, 2, 3) ; épingler un quatrième demande d'en retirer un. Un bien épinglé qui cesse d'être publié ou disponible **garde son épingle mais n'est plus affiché** : l'accueil le remplace par un choix automatique, l'écran le signale (« Épinglé, hors ligne » · « Épinglé, plus disponible »), et il reprend sa place s'il redevient disponible. Archiver un bien retire son épingle. Un aperçu de la section est affiché.

## 10. Droits et traces

**CTL-160** `[P1]` Un conseiller consulte tout le catalogue, brouillons compris. Il ne le modifie que si `access.agentCanEditCatalogue` est vrai, et ne publie jamais (matrice, note 4).

**CTL-161** `[P1]` Sont tracés avec les valeurs avant et après, sous les codes de SEC-080 : toute publication, dépublication, archivage, désarchivage d'un bien **ou d'un programme** ; toute suppression ; tout changement de prix ou de statut d'un lot, dont la correction d'une vente ; tout changement de promoteur, de lieu, de livraison ; l'éligibilité au financement ; l'épinglage sur l'accueil ; tout import.

## 11. Autres partenaires (EA-47)

**CTL-170** `[P1]` Les « autres partenaires » de la page publique « Nos partenaires » (EDI-035) — notaires, assureurs, institutions, médias — se gèrent dans une liste simple (menu Catalogue, `content.manage`) : nom · catégorie (`PartnerCategory`) · présentation (600 caractères) · site web (facultatif) · logo · « Visible sur le site » · ordre. Créer, modifier, masquer, supprimer (corbeille). Ce ne sont ni des promoteurs ni des banques : ils n'ont ni convention suivie, ni dossier, ni compte. Une candidature reçue par le formulaire « Devenir partenaire » peut créer une de ces fiches (CRM-011).
