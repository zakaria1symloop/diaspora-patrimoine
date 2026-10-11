# Modèle de données — catalogue

Trois niveaux (décision D-010) :

```
Promoter ──< Program ──< Property ──< Lot
                          (bien)      (unité vendue)
Promoter ──< Property (bien isolé, sans programme) ──< Lot (un seul)
```

- Le visiteur parcourt des **biens** (`Property`) : une carte, une fiche, un intérêt portent sur un bien.
- Un bien d'un programme est une **typologie** (« Appartement T3 – Résidence El Yasmine ») qui regroupe les lots de même nature.
- La réservation et la vente portent sur un **lot** précis.

Conventions : `01-modele-conventions-et-vue-d-ensemble.md`. ⌫ = `deletedAt`. ⟳ = `version`.

---

## 1. `Program` ⌫ ⟳ — programme immobilier

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `promoterId` | UUID → `Promoter` | oui | Non modifiable après la première publication. |
| `name` | `Varchar(120)` | oui | « Résidence El Yasmine ». |
| `slug` | `Varchar(80)` | oui | Unique. |
| `tagline` | `Varchar(160)` | non | Phrase d'accroche de la fiche. |
| `description` | texte (5 000) | non | 100 caractères au moins pour publier. |
| `standing` | `Standing` | oui | Choisi à la main (Q-036). |
| `countryCode` | `Char(2)` → `Country` | oui | Le pays doit avoir `isCatalogueActive`. |
| `regionId` | UUID → `Region` | oui | Du même pays. |
| `cityId` | UUID → `City` | non | De la même région. |
| `addressLine` | `Varchar(200)` | non | **Interne.** Jamais publiée (TRV-045). |
| `latitude`, `longitude` | `Decimal(9,6)` | non | Position exacte, interne. La position montrée au public est arrondie (FIC-060). |
| `deliveryStatus` | `DeliveryStatus` | oui | |
| `deliveryDate` | date | selon statut | Obligatoire si le statut n'est pas `DELIVERED`. Premier jour de la période annoncée. |
| `deliveryDatePrecision` | `DatePrecision` | oui | Défaut `QUARTER`. Détermine l'affichage : « juin 2027 », « T2 2027 », « 2027 » — et la **fin** de la période (MOD-202). |
| `totalUnits` | entier | non | Nombre total de logements du programme (information commerciale, pas le nombre de lots saisis). |
| `amenities` | `Varchar(40)[]` | oui | Codes de la liste `catalogue.amenities` (`01-domaine/10`, § 6). Vide possible. |
| `guarantees` | `Varchar(600)` | non | Garanties annoncées par le promoteur, montrées au public. |
| `highlightLabel` | `Varchar(40)` | non | Étiquette manuelle sur la photo (« Prix de lancement »). |
| `highlightUntil` | date | non | Au-delà, l'étiquette n'est plus affichée. |
| `publication` | `PublicationStatus` | oui | Défaut `DRAFT`. |
| `publishedAt` | date-heure | non | Dernière publication. |
| `firstPublishedAt` | date-heure | non | Jamais remis à nul. |
| `unpublishedBySuspensionAt` | date-heure | non | Renseigné quand la fiche a été dépubliée **par la suspension de son promoteur** (MOD-110) ; vidé à toute publication ou dépublication faite à la main. Sert à « Republier les fiches dépubliées par la suspension » (CTL-004). |
| `seoTitle` | `Varchar(70)` | non | À défaut : généré (NAV-032). |
| `seoDescription` | `Varchar(160)` | non | |
| `lotsTotal` | entier (cache) | oui | Lots non supprimés de ses biens **publiés**, plus les lots **vendus** de ses biens archivés : ce que le public voit, et ce qui a été réalisé. Les lots d'un bien en brouillon ne comptent pas (le back-office les montre dans son propre tableau, CTL-060) ; ni les lots non vendus d'un bien archivé à la main. |
| `lotsAvailable` | entier (cache) | oui | Lots `AVAILABLE` de ses biens publiés. |
| `lotsHeld` | entier (cache) | oui | Lots `OPTIONED` ou `RESERVED` de ses biens publiés. |
| `lotsSold` | entier (cache) | oui | Lots `SOLD` de ses biens publiés ou archivés. Avec les trois compteurs précédents et `listedPropertyCount`, il donne l'état commercial du programme (CYC-127). |
| `listedPropertyCount` | entier (cache) | oui | Nombre de ses biens publiés ou archivés. Zéro : le programme n'a encore rien mis en vente (« À venir »). |
| `lastSoldAt` | date-heure (cache) | non | Dernier passage d'un lot à `SOLD`. |
| `priceFrom` | `Decimal(14,2)` (cache) | non | Plus petit prix d'un lot `AVAILABLE`, dans la devise du pays. |
| `priceFromRef` | `Decimal(14,2)` (cache) | non | Plus petit `priceFromRef` de ses biens publiés et disponibles (CAL-028). C'est le « à partir de » de la page du programme. |
| `stockConfirmedAt` | date-heure | non | Dernière vérification des disponibilités et des prix avec le promoteur (CTL-064). Sert à la vérification périodique (AUT-079). |
| `stockConfirmedBy` | `Varchar(160)` | non | Nom de l'interlocuteur du promoteur qui les a confirmés. |
| `submittedForReviewAt`, `reviewedAt` | date-heure | non | `[P2]` Publication proposée par le promoteur, puis examinée (PPR-011). |
| `reviewedById` | UUID → `User` | non | `[P2]` |
| `reviewNote` | `Varchar(1000)` | non | `[P2]` Commentaire de l'examen, montré au promoteur. |

Index : `promoterId` · (`countryCode`, `regionId`, `publication`) · `slug`.

**MOD-200** Les biens d'un programme **héritent** de son pays, de sa région, de sa ville, de son standing, de son statut et de sa date de livraison. Un bien peut redéfinir la livraison (tranche livrée plus tôt) ; il ne peut pas redéfinir le lieu ni le standing.

**MOD-201** Changer le lieu, le standing ou la livraison d'un programme recalcule dans la même transaction les champs hérités et les caches de ses biens (un bien dont la livraison est redéfinie garde la sienne).

**MOD-202** **Livraison dépassée.** `deliveryDate` porte le **premier** jour de la période annoncée ; une livraison promise « T2 2027 » n'est pas en retard le 2 avril. La période se termine : précision `MONTH` → le dernier jour du mois ; `QUARTER` → le dernier jour du trimestre ; `YEAR` → le 31 décembre. Une livraison est **dépassée** quand cette fin de période est passée et que le statut n'est pas `DELIVERED`. Toutes les règles qui parlent d'une date de livraison « passée » emploient cette définition (FIC-040, AUT-074, filtre `delivery` de CAT-020) ; elle vaut pour un programme, pour un bien isolé et pour un bien dont la livraison est redéfinie (`deliveryOverridden`).

**MOD-203** **Image de couverture.** Une seule source : le média marqué `isCover` (§ 4). À défaut, le premier média prêt de nature `PHOTO`, puis `RENDER_3D`, dans l'ordre d'affichage. Un programme sans photo ni image 3D n'a pas de couverture : sa carte emploie le visuel neutre de TRV-133.

## 2. `Property` ⌫ ⟳ — bien

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `reference` | `Varchar(20)` | oui | Unique, attribuée à la création, définitive (TRV-051). |
| `slug` | `Varchar(120)` | oui | Unique. Formé du titre, de la région et de la référence : `appartement-t3-residence-el-yasmine-alger-dp-dz-0142`. |
| `promoterId` | UUID → `Promoter` | oui | Celui du programme s'il y en a un. |
| `programId` | UUID → `Program` | non | Nul pour un bien isolé. |
| `title` | `Varchar(120)` | oui | Saisi ou généré (MOD-210). |
| `titleAuto` | booléen | oui | Vrai tant que le titre est le titre généré. |
| `description` | texte (5 000) | non | Saisie ou générée (MOD-211). |
| `descriptionAuto` | booléen | oui | |
| `type` | `PropertyType` | oui | |
| `rooms` | entier | selon type | Nombre de pièces principales. Obligatoire pour `APARTMENT`, `DUPLEX`, `VILLA` (1 à 12). Fixé à 1 pour `STUDIO`. Nul pour `LAND` et `COMMERCIAL`. |
| `bedrooms` | entier | non | 0 à 11 ; inférieur à `rooms`. |
| `bathrooms` | entier | non | 0 à 10. |
| `surfaceM2` | `Decimal(8,2)` | oui | Surface habitable de référence. Supérieure à 0, au plus 100 000. |
| `terraceM2` | `Decimal(8,2)` | non | Balcon ou terrasse. |
| `landM2` | `Decimal(10,2)` | non | Terrain (villa, terrain). |
| `features` | `Varchar(40)[]` | oui | Codes de la liste `catalogue.features`. Vide possible. |
| `standing` | `Standing` | oui | Hérité du programme ; saisi pour un bien isolé. |
| `deliveryStatus` | `DeliveryStatus` | oui | Hérité ou redéfini. |
| `deliveryDate` | date | selon statut | Idem `Program`. |
| `deliveryDatePrecision` | `DatePrecision` | oui | |
| `deliveryOverridden` | booléen | oui | Vrai : la livraison du bien diffère de celle du programme et n'est plus recopiée. |
| `countryCode`, `regionId`, `cityId` | `Char(2)` → `Country`, UUID → `Region`, UUID → `City` | oui / oui / non | Recopiés du programme ; saisis pour un bien isolé. |
| `addressLine`, `latitude`, `longitude` | `Varchar(200)`, `Decimal(9,6)`, `Decimal(9,6)` | non | Bien isolé seulement. Internes. |
| `priceCurrency` | `Char(3)` | oui | Devise du pays (D-019). |
| `highlightLabel`, `highlightUntil` | `Varchar(40)`, date | non | Étiquette manuelle propre au bien ; prime sur celle du programme. |
| `featuredRank` | entier | non | Épingle sur l'accueil : plus le nombre est petit, plus le bien passe devant (ACC-051). |
| `publication` | `PublicationStatus` | oui | Défaut `DRAFT`. |
| `publishedAt`, `firstPublishedAt`, `archivedAt` | date-heure | non | |
| `unpublishedBySuspensionAt` | date-heure | non | Comme sur `Program`. |
| `unpublishedAt` | date-heure | non | Dernière dépublication, quelle qu'en soit la cause ; vidé à la publication. C'est la date du bandeau « Bien hors ligne depuis le {date} » (CYC-121). |
| `programCascadeAt` | date-heure | non | Renseigné quand le bien a été dépublié ou archivé **par** son programme (CYC-126) ; vidé dès qu'il est publié, dépublié, archivé ou désarchivé à la main. Sert à proposer de le faire revenir avec son programme. |
| `stockConfirmedAt`, `stockConfirmedBy` | date-heure, `Varchar(160)` | non | Pour un **bien isolé** seulement : comme sur `Program` (CTL-064). Un bien d'un programme suit la vérification de son programme. |
| `seoTitle`, `seoDescription` | `Varchar(70)`, `Varchar(160)` | non | |
| `submittedForReviewAt`, `reviewedAt`, `reviewedById`, `reviewNote` | date-heure, date-heure, UUID → `User`, `Varchar(500)` | non | `[P2]` Mêmes champs que sur `Program` (PPR-011). |
| `relevanceScore` | entier | oui | 0 à 100 (CAL-080). Sert au tri « Pertinence ». |
| **Caches** | | | Recalculés selon MOD-220. |
| `lotsTotal`, `lotsAvailable` | entier | oui | Lots non supprimés ; lots `AVAILABLE`. |
| `lotsTaken` | entier | oui | Lots sous option, réservés ou vendus (`OPTIONED`, `RESERVED`, `SOLD`). Sert à l'étiquette de rareté (CAT-041). |
| `availability` | `Availability` | oui | Déduite des lots (CYC-110). |
| `availabilityChangedAt` | date-heure | oui | Dernier changement de `availability`. C'est d'après lui qu'un bien est « vendu depuis {n} jours » (CYC-123). |
| `priceFrom`, `priceTo` | `Decimal(14,2)` | non | Plus petit et plus grand prix des lots `AVAILABLE` ; s'il n'y en a aucun, des lots non retirés. Dans `priceCurrency`. |
| `surfaceMin`, `surfaceMax` | `Decimal(8,2)` | non | Sur les mêmes lots. |
| `priceFromRef` | `Decimal(14,2)` | non | `priceFrom` converti dans la devise de référence (`display.referenceCurrency`, EUR), **arrondi** selon CAL-021. Sert au tri et au filtre de budget. |
| `downPaymentRef` | `Decimal(14,2)` | non | Apport du financement de référence (CAL-031). |
| `monthlyFromRef` | `Decimal(12,2)` | non | Mensualité indicative dans la devise de référence (CAL-030). |
| `financingEligible` | booléen | oui | Au moins une banque active l'accepte (MOD-240). |
| `islamicFinancingEligible` | booléen | oui | Idem, avec un produit islamique utilisable. |
| `has360Tour`, `hasPlan`, `hasVideo` | booléen | oui | Présence d'un média prêt de la nature voulue. |
| `photoCount` | entier | oui | Médias `PHOTO` et `RENDER_3D` prêts. |
| `completenessScore` | entier | oui | 0 à 100 (CAL-050). |
| `interestCount` | entier | oui | Demandes `PROPERTY_INTEREST` reçues. |
| `viewCount` | entier | oui | Vues de la fiche depuis sa création, une par visiteur et par jour (FIC-100). Le détail par jour est dans `PropertyDailyStat` (§ 9). |
| `searchText` | texte (cache) | oui | Titre, programme, promoteur, ville, région, référence, sans accents, en minuscules. Index GIN par trigrammes. Recalculé aussi quand le programme, le promoteur, la ville ou la région sont renommés (MOD-220). |

Index : (`publication`, `availability`) · `type` · `rooms` · (`countryCode`, `regionId`, `cityId`) · `priceFromRef` · `monthlyFromRef` · `surfaceMin` · `deliveryDate` · `standing` · `promoterId` · `programId` · `financingEligible` · `firstPublishedAt` · `featuredRank`.

**MOD-210** **Titre généré.** Tant que `titleAuto` est vrai, le titre est recalculé à chaque changement des champs dont il dépend :
- logement dans un programme : « {Type} T{rooms} – {nom du programme} » → « Appartement T3 – Résidence El Yasmine » ;
- studio : « Studio – {nom du programme} » ;
- bien isolé : « {Type} T{rooms} – {ville, sinon région} » → « Villa T5 – Chéraga » ;
- terrain ou local : « {Type} {surface} m² – {programme, sinon ville, sinon région} » → « Terrain 400 m² – Zéralda ».

Le tiret est un demi-cadratin entouré d'espaces. Le préfixe « T » suit `display.roomsPrefix`. Dès que l'administrateur modifie le titre à la main, `titleAuto` passe à faux et le titre n'est plus recalculé ; un bouton « Revenir au titre automatique » le rétablit.

**MOD-211** **Description générée.** Si la description est vide, une description est composée à partir des champs structurés : type, pièces, surface, ville, livraison, caractéristiques. Modèle : « {Type} T{rooms} de {surface} m² à {ville} ({région}), {livraison}. {Liste des caractéristiques}. ». Sans ville — elle est facultative (CYC-120) — : « … de {surface} m² à {région}, {livraison}. ». Elle est stockée avec `descriptionAuto = true`, recalculée comme le titre, et ne rapporte aucun point de complétude.

**MOD-212** Un bien a **au moins un lot** pour être publié. Un bien isolé (sans programme) a **exactement un lot**, créé avec le bien et supprimé avec lui ; l'interface ne montre pas de tableau de lots pour lui, seulement ses champs (prix, étage, statut). Ce lot n'a rien à saisir en double : sa **référence** est celle du bien (`Property.reference`), et ses surfaces (`surfaceM2`, `terraceM2`, `landM2`) sont **celles du bien**, recopiées à chaque enregistrement. Dans un e-mail ou un écran, « le lot {référence} » d'un bien isolé se lit donc « le bien {référence} ».

**MOD-213** `rooms`, `type` et `programId` d'un bien ne changent plus après sa première publication s'il a reçu au moins une demande. Il faut créer un autre bien. Avant cela, changer `programId` (rattacher un bien isolé à un programme, ou déplacer une typologie) : le bien prend le lieu, le standing et la livraison du nouveau programme (MOD-200), son promoteur doit être le même, les références de ses lots doivent rester uniques dans le programme d'arrivée, et les caches des deux programmes sont recalculés.

**MOD-220** **Recalcul des caches d'un bien.** Dans la même transaction que le changement :

| Changement | Caches recalculés |
|---|---|
| Création, modification (prix, surface, statut), suppression d'un lot | `lotsTotal`, `lotsAvailable`, `lotsTaken`, `availability`, `priceFrom`, `priceTo`, `surfaceMin`, `surfaceMax`, puis `priceFromRef`, `downPaymentRef`, `monthlyFromRef` ; sur le programme : `lotsTotal`, `lotsAvailable`, `lotsHeld`, `lotsSold`, `lastSoldAt`, `priceFrom`, `priceFromRef` |
| Publication, dépublication, archivage, désarchivage, suppression, restauration d'un bien | Sur son programme : `lotsTotal`, `lotsAvailable`, `lotsHeld`, `lotsSold`, `listedPropertyCount`, `priceFrom`, `priceFromRef` (les lots d'un bien en brouillon n'y comptent pas ; d'un bien archivé, seuls ses lots vendus) |
| Changement de `availability` | `availabilityChangedAt` |
| Ajout, retrait, fin de traitement d'un média **du programme** | `photoCount`, `hasPlan`, `hasVideo`, `completenessScore` de chacun de ses biens qui s'appuie sur les médias du programme (MOD-236) |
| Programme, promoteur, ville ou région renommé | `searchText` des biens concernés |
| Nouveau taux de change ou taux annulé ; changement du financement de référence, de la nature de cours utilisée ou de la devise de référence | `priceFromRef`, `downPaymentRef`, `monthlyFromRef` de **tous** les biens concernés, par une tâche de fond (AUT-080) |
| Ajout, retrait, fin de traitement d'un média | `has360Tour`, `hasPlan`, `hasVideo`, `photoCount`, `completenessScore` |
| Modification des champs du bien | `completenessScore`, `searchText` |
| Changement d'une `FinancingEligibility`, d'une banque, d'un produit | `financingEligible`, `islamicFinancingEligible` |
| Nouvelle demande d'intérêt | `interestCount` |

## 3. `Lot` ⌫ ⟳ — unité vendue

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `propertyId` | UUID → `Property` | oui | |
| `reference` | `Varchar(40)` | oui | Numéro du lot chez le promoteur (« B-304 »). Unique dans le programme (ou dans le bien s'il est isolé), parmi les lots non supprimés : le programme n'étant pas une colonne du lot, l'unicité est **applicative**, vérifiée dans la transaction sous verrou de ligne du `Program` — du `Property` pour un bien isolé (FIA-020). Refus : `409 DUPLICATE`. |
| `referencePending` | booléen | oui | Défaut `false`. Vrai pour un lot copié dont la référence provisoire n'a pas été remplacée (MOD-230) : il reste `WITHDRAWN` et ne se remet pas en vente tant qu'il l'est. |
| `building` | `Varchar(40)` | non | Bâtiment, bloc. |
| `floor` | entier | non | −2 à 80. 0 = rez-de-chaussée. |
| `door` | `Varchar(20)` | non | |
| `orientation` | `Orientation` | non | |
| `surfaceM2` | `Decimal(8,2)` | oui | Supérieure à 0. |
| `terraceM2` | `Decimal(8,2)` | non | |
| `landM2` | `Decimal(10,2)` | non | |
| `price` | `Decimal(14,2)` | oui | Strictement positif. Dans `Property.priceCurrency`. |
| `priceUpdatedAt` | date-heure | oui | |
| `status` | `LotStatus` | oui | Défaut `AVAILABLE`. Transitions : CYC-100. |
| `statusChangedAt` | date-heure | oui | |
| `statusNote` | `Varchar(300)` | non | |
| `externalSale` | booléen | oui | Défaut `false`. Vrai : réservé ou vendu **hors plateforme**, sans `Reservation`. |
| `parkingIncluded` | booléen | non | |
| `extras` | `Varchar(300)` | non | « Cave de 6 m² en option ». |
| `planMediaId` | UUID → `Media` | non | Plan propre à ce lot ; à défaut, les plans du bien. |
| `deliveredAt` | date | non | Date de livraison réelle (Q-014). Saisie dans le tableau des lots (CTL-060), ou pour tous les lots d'un bien à la fois quand il passe « Livré ». Jamais future. |
| `sortOrder` | entier | oui | |

Index : (`propertyId`, `status`) · `price` · (`propertyId`, `reference`), non unique.

**MOD-230** **Supprimer un lot.** Seul un lot `AVAILABLE` ou `WITHDRAWN` se supprime. S'il a déjà porté une réservation ou figure dans un dossier, il n'est pas supprimé : il passe `WITHDRAWN` (retiré de la vente), pour que l'historique garde son lot. Un lot `OPTIONED`, `RESERVED` ou `SOLD` ne se supprime ni ne se retire : « Ce lot est {réservé / vendu}. Passez par sa réservation. ». Dupliquer un lot, ou un bien avec ses lots, crée des lots à **référence provisoire** (« {référence}-copie », `referencePending`), **retirés de la vente** tant qu'elle n'est pas remplacée : une référence est unique dans le programme, et une copie ne paraît pas sur le site sous un numéro inventé.

**MOD-231** Toute modification de `price` ou de `status` est écrite dans le journal d'audit avec l'ancienne et la nouvelle valeur. L'historique des prix d'un lot se lit là.

**MOD-232** La surface et le prix d'un lot peuvent différer de ceux des autres lots du même bien (étage, orientation). La fiche du bien affiche alors des fourchettes (« de 76 à 84 m² », « à partir de 150 000 € »).

## 4. `Media` ⌫ — fichier média

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `ownerType` | `MediaOwnerType` | oui | |
| `ownerId` | UUID | oui | Identifiant de l'objet propriétaire. Vérifié par l'application ; les médias d'un propriétaire supprimé sont supprimés avec lui. |
| `kind` | `MediaKind` | oui | |
| `isPublic` | booléen | oui | Vrai : servi par le CDN public (catalogue, logos, contenus). Faux : stockage privé, liens signés. |
| `storageKey` | `Varchar(400)` | selon nature | Fichier d'origine. Nul pour une vidéo externe. |
| `externalUrl` | `Varchar(400)` | selon nature | Vidéo : adresse YouTube ou Vimeo (seul mode en Phase 1). |
| `fileName` | `Varchar(200)` | non | Nom d'origine. |
| `mimeType` | `Varchar(100)` | non | |
| `sizeBytes` | entier long | non | |
| `checksumSha256` | `Char(64)` | non | |
| `width`, `height` | entier | non | Pixels. |
| `renditions` | `Json` | non | Déclinaisons produites (`06-technique/05`, MED-020) : `{ "thumb": {"width": 320, "height": 213, "bytes": 61440, "formats": ["avif", "webp", "jpg"]}, "card": {…}, "large": {…}, "xl": {…}, "og": {…}, "blur": "data:image/webp;base64,…" }`. Chaque déclinaison donne ses dimensions réelles, la taille cumulée de ses formats (MED-071) et ses formats ; son adresse se forme d'après MED-016. `blur` est l'aperçu flouté, gardé en ligne (WebP de 24 px de large, moins de 1 ko). Vue 360° : `pano4096` et `pano8192` (formats WebP et JPEG). Plan ou brochure en PDF : `thumb` et `card`, tirées de la première page, et `pageCount`. |
| `alt` | `Varchar(200)` | non | Texte de remplacement. À défaut, généré (MED-023). |
| `caption` | `Varchar(200)` | non | Légende visible. |
| `roomLabel` | `Varchar(60)` | non | L'une des valeurs de la liste fermée de CTL-081, enregistrée en toutes lettres, en français (« Séjour », « Chambre 1 »). Obligatoire pour `PANO_360`. |
| `isCover` | booléen | oui | Au plus une couverture par propriétaire. Seul un média **prêt** de nature `PHOTO` ou `RENDER_3D` peut l'être (jamais un plan, une brochure, un média en échec). Si la couverture est supprimée, le média suivant qui remplit ces conditions la devient (MOD-203). |
| `isIllustration` | booléen | oui | Défaut `false`. Vrai : image d'illustration, qui ne montre pas le bien réel (Q-031). |
| `takenAt` | date | non | Date de prise de vue. |
| `sortOrder` | entier | oui | |
| `processingStatus` | `ProcessingStatus` | oui | Un média n'est visible du public qu'à l'état `READY`. |
| `processingError` | `Varchar(300)` | non | |
| `uploadedById` | UUID → `User` | non | |

Index : (`ownerType`, `ownerId`, `kind`, `sortOrder`).

**MOD-235** Natures autorisées par propriétaire :

| Propriétaire | Natures |
|---|---|
| `PROGRAM` | `PHOTO`, `RENDER_3D`, `PLAN` (plan de masse), `BROCHURE`, `VIDEO` |
| `PROPERTY` | `PHOTO`, `RENDER_3D`, `PLAN`, `PANO_360`, `VIDEO`, `BROCHURE` |
| `LOT` | `PLAN` |
| `PROGRAM_UPDATE` | `PHOTO` |
| `PROMOTER`, `BANK`, `PARTNER` | `LOGO`, `PHOTO` (couverture) |
| `EVENT` | `PHOTO` |
| `CONTENT` | `PHOTO`, `DOCUMENT` |
| `USER` | `PHOTO` (portrait) |

**MOD-236** **Médias d'un bien et de son programme.** La galerie d'un bien montre d'abord ses propres médias, puis ceux de son programme. Pour les **règles** — condition de publication (CYC-120), points de complétude (CAL-050), compteurs `photoCount`, `hasPlan`, `hasVideo` — on compte, par **famille** — les images (`PHOTO` et `RENDER_3D` ensemble), les plans (ceux du bien et de ses lots), les vidéos —, les médias prêts **du bien** ; s'il n'en a aucun de cette famille, ceux **du programme** en tiennent lieu (un repli, pas une addition : trois photos sur le bien et dix sur le programme comptent pour trois). Un bien qui s'appuie ainsi sur son programme dépend de lui : supprimer un média du programme est contrôlé (CYC-122).

## 5. `PropertyPoi` `[P1]` — point d'intérêt

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `programId` | UUID → `Program` | l'un des deux | Cascade. |
| `propertyId` | UUID → `Property` | l'un des deux | Cascade. Pour un bien isolé. |
| `label` | `Varchar(120)` | oui | « Université USTHB ». |
| `category` | `PoiCategory` | oui | |
| `minutes` | entier | oui | 1 à 120. |
| `mode` | `TravelMode` | oui | Défaut `CAR`. |
| `sortOrder` | entier | oui | |

Au plus 8 points par programme ou bien ; la fiche en montre 5.

## 6. `ProgramUpdate` ⌫ `[P1]` — avancement du chantier

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `programId` | UUID → `Program` | oui | Cascade. |
| `stage` | `ConstructionStage` | oui | |
| `percent` | entier | oui | 0 à 100. Ne peut pas être inférieur à celui du point précédent. |
| `note` | `Varchar(600)` | non | |
| `publishedAt` | date-heure | oui | Date du point d'avancement. |
| `createdById` | UUID → `User` | non | |

Photos : `Media` de propriétaire `PROGRAM_UPDATE`.

## 7. `FinancingEligibility` — acceptation par une banque

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `bankId` | UUID → `Bank` | oui | Cascade. |
| `programId` | UUID → `Program` | l'un des deux | Cascade. |
| `propertyId` | UUID → `Property` | l'un des deux | Cascade. |
| `accepted` | booléen | oui | Faux : la banque a explicitement refusé de financer ce programme ou ce bien. |
| `note` | `Varchar(300)` | non | |
| `checkedAt` | date | oui | |
| `checkedById` | UUID → `User` | non | |

Unicité : (`bankId`, `programId`) et (`bankId`, `propertyId`).

**MOD-240** Pour un bien et une banque : la ligne posée **sur le bien** l'emporte ; à défaut, celle posée sur son programme ; à défaut, la banque n'est pas réputée accepter. `Property.financingEligible` est vrai s'il existe au moins une banque `ACTIVE` qui accepte le bien.

## 8. `SlugHistory`

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `entityType` | `SlugEntityType` | oui | |
| `entityId` | UUID | oui | |
| `slug` | `Varchar(120)` | oui | Ancienne adresse. Unique par `entityType`. |

Quand un slug change (TRV-052), l'ancien y est inscrit ; une requête sur l'ancien renvoie une redirection `301` vers le nouveau. Un slug présent dans l'historique ne peut pas être réattribué à un autre objet.

## 9. `PropertyDailyStat` — fréquentation d'un bien, par jour

| Champ | Type | Oblig. | Règles |
|---|---|---|---|
| `propertyId` | UUID → `Property` | oui | Cascade. |
| `day` | date | oui | Jour, dans le fuseau du calendrier de travail. |
| `views` | entier | oui | Vues de la fiche ce jour-là (une par visiteur, FIC-100). |
| `interests` | entier | oui | Demandes d'intérêt reçues ce jour-là. |

Clé primaire : (`propertyId`, `day`). Une ligne n'existe que pour un jour où il s'est passé quelque chose. C'est la source des chiffres « sur la période » des rapports (TDB-012) ; `Property.viewCount` et `Property.interestCount` en sont les totaux. Les lignes de plus de 25 mois sont supprimées par la tâche `purge` (AUT-091).
