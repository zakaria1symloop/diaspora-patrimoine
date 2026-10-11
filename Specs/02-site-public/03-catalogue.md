# Catalogue

Écrans **EP-02** (catalogue) et **EP-03** (filtres : panneau à droite sur ordinateur, fenêtre plein écran sur téléphone). Adresse : `/programmes`.

Le catalogue liste des **biens** (`Property`) : une typologie d'un programme, ou un bien isolé (D-010). Un programme de trois typologies donne trois cartes. Seuls les biens **publiés** apparaissent.

---

## 1. La page

**CAT-001** `[P1]` De haut en bas :

| Zone | Contenu |
|---|---|
| Titre | Sans filtre, ou avec plusieurs régions ou plusieurs types : « Tous les programmes ». Avec une région : « Programmes neufs à {région} ». Avec un type : « {Type au pluriel} en Algérie » (le nom du pays actif). Avec un type et une région : « {Type au pluriel} à {région} » (« Villas neuves à Oran »). « {Type au pluriel} » est le libellé pluriel du type, adjectif compris (`01-domaine/01`, § 3.4). Le titre se pose **centré, sur deux lignes** (DSN-022, maquette EP-02) : le lieu (« à Alger », « en Algérie ») sur la ligne dorée ; sans lieu, le dernier mot (« Tous les » · « programmes »). Pas de fil d'Ariane sur le catalogue (NAV-039 : fiches seulement) — D-100. |
| Introduction | Bloc `listing.intro` : « Des biens neufs sélectionnés auprès de promoteurs partenaires, avec leur prix. » Quand `features.monthlyBudgetSearch` est vrai, le bloc `listing.introMonthly` le remplace : « … avec leur prix et leur mensualité indicative. » Centrée sous le titre, en deux lignes coupées après la première virgule. |
| Barre de recherche | La même que sur l'accueil (ACC-052), préremplie avec les critères en cours, et qui les **reflète en continu** : retirer la pastille « Alger × » vide le champ Ville sans rechargement (TRV-107). |
| En-tête des résultats | Le nombre de biens ; le résumé des critères (CAT-022) ; le champ de recherche par mot ; les boutons « Filtres » (avec le nombre de filtres actifs) et « Trier : {tri en cours} ». |
| Filtres rapides | CAT-012. |
| Filtres actifs | Une pastille par filtre, chacune supprimable ; « Tout effacer » ; « Créer une alerte » `[P1]` — sur téléphone aussi —, qui envoie les nouveautés par e-mail (CAT-070), et à côté « Enregistrer cette recherche » (CAT-093), qui la garde dans le compte sans rien envoyer. Ce sont les deux seuls libellés de ces actions. |
| Résultats | Grille de cartes (CAT-040) : 3 colonnes à partir de 1024 px, 2 de 640 à 1023 px, 1 en dessous. 12 cartes par page. |
| Pagination | CAT-055. |
| Note | La note des mensualités (TRV-023) si la page en affiche une, la mention des prix convertis (TRV-022), et `legal.illustrationNote` si une carte de la page montre une image d'illustration. |
| Appel | « Vous ne trouvez pas le bien idéal ? » · « Décrivez votre projet et votre budget : un conseiller vous rappelle et vous propose des biens adaptés à votre capacité de financement. » · boutons « Simuler mon éligibilité » et « Être rappelé » (repli : ACC-090). |

**CAT-002** `[P1]` **Nombre de biens** : « {n} biens disponibles » sans filtre ; « {n} biens correspondent » avec filtres ; « 1 bien correspond » ; le cas zéro suit CAT-060. Le nombre vient du serveur (TRV-106). « Afficher aussi les biens réservés ou vendus » (`availability=all`) compte comme un filtre actif : pastille « Réservés et vendus inclus », et le nombre se lit « {n} biens correspondent ».

**CAT-003** `[P1]` Tout l'état de la page (critères, tri, page, fenêtre ouverte) est dans l'adresse (TRV-101). Modifier un critère remet la pagination à la page 1.

## 2. Critères

**CAT-010** `[P1]` **Recherche par mot** (`q`) : porte sur le titre du bien, le nom du programme, le nom du promoteur, la ville, la région, la référence. Règles : TRV-103 ; suggestions pendant la frappe et recherches récentes : TRV-109. Elle se combine avec les filtres.

**CAT-012** `[P1]` **Filtres rapides**, sous forme de pastilles à bascule : « Appartements » · « Villas » · « Livrés » · « Éligibles au financement » · « Nouveautés » · « Visite 360° » `[P1]`. Une pastille n'est proposée que si elle donne au moins un résultat dans le catalogue entier. Activer une pastille pose le critère correspondant ; elle apparaît alors aussi parmi les filtres actifs.

**CAT-020** `[P1]` **Liste des critères.** Ce sont les paramètres de l'adresse, les clés de l'API publique et les clés de `SearchAlert.criteria`.

| Clé | Valeurs | Sens |
|---|---|---|
| `q` | texte, 2 à 80 caractères | Recherche par mot. |
| `country` `[P1]` | code de pays | Pays du bien. Masqué tant qu'un seul pays est actif. |
| `region` | un ou plusieurs slugs | Région (« Ville » pour le visiteur). |
| `city` | un ou plusieurs slugs | Commune. N'a de sens qu'avec **une seule** région. |
| `type` | `apartment`, `studio`, `duplex`, `villa`, `land`, `commercial` | Type de bien. |
| `rooms` | `1`, `2`, `3`, `4`, `5plus` | Nombre de pièces. `5plus` : cinq pièces ou plus. Un studio compte pour une pièce. |
| `priceMin`, `priceMax` | entiers | Prix, dans la devise de référence. Portent sur `priceFromRef`. |
| `monthlyMax` `[P1]` | entier | Mensualité indicative maximale (CAL-032). Exclut `priceMin` et `priceMax`. |
| `surfaceMin`, `surfaceMax` | entiers, en m² | Un bien correspond si sa plage de surfaces recoupe la plage demandée. |
| `delivery` | `delivered`, une année (`2027`), `later` | Livraison : « Déjà livré », une année, ou « {année en cours + 3} et après ». Un bien dont la livraison est **dépassée** (MOD-202 : la fin de la période annoncée est passée sans qu'il soit livré) est rangé dans l'année en cours. |
| `standing` | `comfort`, `standing`, `premium` | Standing. |
| `promoter` | un ou plusieurs slugs | Promoteur. |
| `program` | un slug | Biens d'un programme. |
| `financing` | `1` | Éligible au financement (`financingEligible`). |
| `islamic` `[P1]` | `1` | Éligible à un financement islamique. |
| `tour360` `[P1]` | `1` | Avec visite 360°. |
| `new` | `1` | Publié depuis `catalogue.newBadgeDays` jours ou moins. |
| `availability` | `all` | Inclure les biens réservés (`RESERVED`) et vendus (`SOLD`, tant qu'ils sont en ligne). Absent : biens `AVAILABLE` seulement. Un bien retiré de la vente (`WITHDRAWN`) n'est jamais listé : sa fiche ne s'atteint que par son adresse (FIC-082). |
| `sort` | CAT-050 | Tri. |
| `page` | entier ≥ 1 | Page. |
| `vue` | `liste` (défaut, absent de l'adresse), `carte` | Présentation des résultats : liste de cartes ou vue sur carte (CAT-090). Ne filtre rien. |
| `groupe` | `programme` | Une carte par programme, dépliable en ses biens (CAT-091). Ne filtre rien ; la pagination compte alors les programmes. |
| `bbox` | quatre nombres décimaux séparés par des virgules : ouest, sud, est, nord (degrés, WGS 84) | Zone de la carte, posée par « Rechercher dans cette zone » (CAT-090) : seuls les biens dont le point approximatif (FIC-060) tombe dans le rectangle. Une zone mal formée est ignorée (alinéa suivant). |

Plusieurs valeurs d'une même clé : séparées par des virgules, reliées par **ou**. Clés différentes : reliées par **et**. Avec `rooms`, les terrains et les locaux sont exclus. Une valeur inconnue ou mal formée est **ignorée** et retirée de l'adresse ; la page ne renvoie jamais une erreur pour un critère invalide.

**CAT-021** `[P1]` Les listes de régions, de communes et de promoteurs ne proposent que des valeurs qui donnent **au moins un résultat** : au moins un bien publié et disponible (ou, quand « Afficher aussi les biens réservés ou vendus » est actif, au moins un bien publié listable). Chaque valeur est suivie de ce nombre (« Alger · 46 biens ») : choisir une région proposée ne mène donc jamais à zéro résultat. La barre de recherche de l'accueil suit la même règle (ACC-052).

**CAT-022** `[P1]` **Résumé des critères**, en une ligne, dans cet ordre, séparés par « · » : type et pièces (« Appartement T3 ») · région, et communes entre parenthèses, « {n} communes » au-delà de deux · budget (« jusqu'à 500 € / mois », « de 100 000 à 200 000 € ») · surface (« 60 – 120 m² ») · livraison · standing · promoteur · options. Sans critère : « Tous les biens ». Ce résumé sert aussi de libellé à une alerte (`SearchAlert.label`).

## 3. Fenêtre des filtres

**CAT-030** `[P1]` S'ouvre par le bouton « Filtres », ou par « Filtres » de la barre de l'accueil. **Sur ordinateur (1024 px et plus) : un panneau à droite**, de 384 px, sous l'en-tête, sur toute la hauteur, contenu défilant (D-098). Il n'assombrit pas la page et ne la recouvre pas : le contenu et le pied de page se décalent pour lui laisser sa place, la grille prend les colonnes qui tiennent, et les résultats restent visibles et utilisables à côté. Sur téléphone : fenêtre plein écran. En tête : « Filtres » et « {n} filtres actifs · {m} biens ». En pied, toujours visibles : « Réinitialiser » et le bouton principal **« Voir {m} biens »**.

**CAT-031** `[P1]` **Sur ordinateur, chaque choix s'applique seul** : 300 ms après le dernier changement, l'adresse prend les nouveaux critères et les résultats se rafraîchissent à côté du panneau, qui reste ouvert ; il n'y a pas de brouillon. « Voir {m} biens », la croix et Échap ferment le panneau en gardant les critères ; un changement fait hors du panneau (une pastille retirée, la barre de recherche) s'y reflète. **Sur téléphone**, les choix faits dans la fenêtre sont un **brouillon** : ils ne s'appliquent qu'au clic sur « Voir {m} biens ». Fermer (croix, Échap) garde le brouillon en stockage de session (TRV-092) : rouvrir la fenêtre le retrouve, avec « Réinitialiser » pour le vider. Un clic hors de la fenêtre ne la ferme **pas** tant que le brouillon diffère des critères appliqués (sur téléphone, le bouton Retour du navigateur ferme la fenêtre, brouillon gardé) : après neuf groupes réglés, un clic maladroit ne perd rien (D-095). « Réinitialiser » vide le brouillon sans fermer.

**CAT-032** `[P1]` **Compteur vivant.** À chaque changement, après 300 ms sans action, le nombre de biens du bouton principal et les compteurs de chaque option sont recalculés par le serveur. Pendant le calcul, le bouton montre un indicateur. Si le résultat est zéro : le bouton affiche « Aucun bien ne correspond » et reste actif (il mène à l'état vide, CAT-060). Si le recompte échoue (coupure, après les trois essais de TRV-115) : le bouton redevient « Voir les biens », sans nombre, actif ; les compteurs d'options gardent leur dernière valeur ; sous le bouton, en petit : « Nombre indisponible pour l'instant. ».

**CAT-033** `[P1]` **Compteurs des options.** Le nombre affiché à côté d'une option est le nombre de biens qu'on obtiendrait en la cochant, compte tenu des **autres** groupes de filtres. Une option à zéro reste visible, grisée et non cochable ; si elle est déjà cochée, elle reste décochable.

**CAT-034** `[P1]` **Groupes**, dans cet ordre :

| Groupe | Saisie |
|---|---|
| Type de bien | Cases : Appartement · Studio · Duplex · Villa · Terrain · Local commercial. |
| Pièces | Pastilles : T1 · T2 · T3 · T4 · T5 et plus (préfixe selon `display.roomsPrefix`). Masqué si seuls « Terrain » ou « Local commercial » sont cochés. |
| Budget | Un sélecteur « Mensualité » / « Prix total » `[P1]` (défaut : « Mensualité »). Mensualité : un curseur à une poignée, « Jusqu'à {n} € / mois ». Prix total : un curseur à deux poignées, « de {min} à {max} € ». Deux champs numériques doublent chaque curseur. Bornes : de 0 au plus grand montant du catalogue, arrondi vers le haut au pas de CAL-021 qui correspond à ce montant (au multiple de 1 000 supérieur au-delà de 100 000) ; pour la mensualité, à la dizaine supérieure (CAL-022). Tant que `features.monthlyBudgetSearch` est faux : prix total seul. |
| Surface | Curseur à deux poignées, de 0 à la plus grande surface du catalogue, par pas de 5 m². |
| Localisation | La région (liste avec recherche et compteurs), puis, pour **une** région choisie, ses communes en cases à cocher : les six qui ont le plus de biens, puis « Toutes les communes de {région} ({n}) ». |
| Livraison | Cases : Déjà livré · {année en cours} · {+1} · {+2} · {+3} et après. |
| Standing | Cases : Habitat confortable · Résidence de standing · Très haut standing. |
| Promoteur | Cases, par ordre alphabétique ; champ de recherche au-delà de huit. |
| Options | Bascules : « Éligible au financement » (« Biens acceptés par au moins une banque partenaire ») · « Financement islamique » `[P1]` · « Visite 360° » `[P1]` (« Découvrir le bien sans se déplacer ») · « Nouveautés » (« Publiés ces {n} derniers jours ») · « Afficher aussi les biens réservés ou vendus ». |

**CAT-035** `[P1]` **Budget estimé.** Si le visiteur a une simulation d'éligibilité de moins de 90 jours (sur son compte ; ou, sans compte, sur son identifiant anonyme `dp_anon`, qui vit 30 jours — NAV-051 — tant qu'elle n'est pas purgée) dont le budget maximal est connu, le groupe « Budget » affiche : « Avec votre budget estimé ({montant}), {x} biens sur {m} sont finançables. » et le lien « Afficher seulement ces biens », qui pose `priceMax` à ce budget. Le budget employé est `maxBudgetRef` — le budget **dans la devise de référence**, celle des prix du catalogue —, arrondi comme à l'écran du résultat (CAL-026) ; une simulation faite en dollars canadiens ne filtre donc pas des prix en euros avec un nombre de dollars. Si la devise de référence a changé depuis la simulation (`refCurrency`, CAL-104), ce budget est converti au cours du jour avant de filtrer. Sans simulation : le lien « Estimer mon budget » mène au simulateur d'éligibilité. Source du budget et du nombre {x} : `GET /public/simulations/estimated-budget`, appelé par la fenêtre des filtres **dans le navigateur**, avec les critères affichés (compte de la session, sinon `dp_anon`) ; `GET /public/search-options`, mis en cache pour tous, rend `estimatedBudget` toujours `null` (API-100, D-097). « {m} » est le nombre de biens pour les mêmes critères sans aucun budget. Pour un client connecté, la simulation lue est celle de son compte.

**CAT-036** `[P1]` Accessibilité : sur téléphone, la fenêtre suit TRV-121 (focus piégé, Échap, retour du focus) ; sur ordinateur, le panneau n'est pas une fenêtre modale — le focus y entre à l'ouverture, n'y est pas piégé, et Échap le ferme. Chaque curseur se règle au clavier (flèches : un pas ; Page précédente et suivante : dix pas).

## 4. Carte de bien

**CAT-040** `[P1]` **Anatomie**, d'après la maquette validée. La carte entière est un lien vers la fiche du bien.

| # | Élément | Règle |
|---|---|---|
| 1 | **Bandeau** coloré | Couleur selon le standing (D-038) : vert pour `COMFORT`, bleu nuit pour `STANDING`, bleu roi pour `PREMIUM`. Texte : « À {RÉGION} », en capitales. |
| 2 | **Photo** | La couverture du bien (à défaut, celle du programme), fournie au rapport 4:3 ; la carte en montre la bande centrale (DSN-041), cernée de blanc. Texte de remplacement : `Media.alt`, sinon « {titre} ». Sans aucune image : la composition « Photos en cours de préparation » (FIC-022), jamais un rectangle vide. |
| 3 | **Étiquette** sur la photo | Une au plus (CAT-041). |
| 4 | **Favori** `[P1]` | Un cœur, en haut à droite de la photo (SFA-020). Il ne déclenche pas le lien de la carte. |
| 5 | Standing | « HABITAT CONFORTABLE », « RÉSIDENCE DE STANDING », « TRÈS HAUT STANDING ». |
| 6 | **Titre** | `Property.title`, deux lignes au plus (TRV-071). |
| 7 | Faits clés | Dans le catalogue : « {surface} m² · {livraison} » (« 85 m² · Livraison T2 2027 », « de 76 à 84 m² · Livré »). Sur l'accueil : ligne absente, comme sur la maquette. |
| 8 | **Prix** | Libellé « Prix du bien » ; « À partir de » si les lots disponibles n'ont pas tous le même prix. Valeur : `priceFromRef`. |
| 9 | **Apport** | « Apport ({pct} %) » · `downPaymentRef`. Le pourcentage est celui du financement de référence. |
| 10 | **Mensualité** | « Mensualité* » · `monthlyFromRef` en grand · « / mois ». |

**CAT-041** `[P1]` **Étiquette.** La première qui s'applique :
1. l'étiquette manuelle du bien (`highlightLabel`, tant que `highlightUntil` n'est pas passé), sinon celle de son programme : « Prix de lancement », « Derniers duplex » ;
2. la rareté, seulement quand des lots sont **déjà partis** — au moins un lot du bien sous option, réservé ou vendu (`lotsTaken` > 0 ; un lot simplement retiré de la vente n'est pas « parti ») : « Dernier lot » si `lotsAvailable` = 1 ; « Plus que {n} lots » si `lotsAvailable` ≤ `catalogue.lowStockThreshold`. Un bien neuf dont tous les lots sont encore libres, ou un bien isolé, ne porte pas cette étiquette ;
3. « Nouveau » si la première publication date de `catalogue.newBadgeDays` jours ou moins ;
4. aucune.

Les étiquettes qui dépendent de la date du jour (« Nouveau », étiquette manuelle à durée limitée) sont rafraîchies chaque nuit sur les pages en cache (NAV-042, tâche `catalogue.nightly`) : une étiquette ne survit pas d'un jour à sa durée.

**CAT-042** `[P1]` **Sans mensualité** (fonction inactive, ou valeur non calculable, CAL-031) : le bandeau du bas porte le **prix en grand**, sous le libellé de la ligne 8 (« Prix du bien », ou « À partir de ») ; la rangée des lignes 8 et 9 porte alors les faits clés en deux cases, chacune avec son icône — « Surface » et « Livraison » —, et la ligne 7 n'est pas répétée. Une case sans valeur est masquée ; l'autre garde sa place. La carte garde la même hauteur que ses voisines.

**CAT-043** `[P1]` **Bien réservé ou vendu** (visible avec `availability=all`, ou vendu depuis moins de `catalogue.soldVisibleDays` jours et atteint par un lien direct) : la photo est voilée et porte le bandeau « Réservé » ou « Vendu » ; pas d'étiquette ; le prix reste affiché ; la mensualité est masquée.

**CAT-044** `[P1]` Toutes les cartes d'une même rangée ont la même hauteur. Le survol soulève légèrement la carte ; le focus au clavier l'entoure (TRV-121). Pendant le chargement : des cartes-squelettes de même forme.

**CAT-045** `[P1]` Les montants d'une carte sont dans la devise de référence, sans le signe « ≈ » (TRV-022) ; la note de la page le dit.

## 5. Tri et pagination

**CAT-050** `[P1]` **Tris** (`sort`) ; le libellé du bouton reprend le tri actif.

| Valeur | Libellé | Ordre |
|---|---|---|
| `relevance` (défaut) | Pertinence | CAL-080 : biens épinglés, puis score. |
| `price_asc` | Prix croissant | `priceFromRef` croissant. |
| `price_desc` | Prix décroissant | `priceFromRef` décroissant. |
| `monthly_asc` `[P1]` | Mensualité croissante | `monthlyFromRef` croissant. |
| `surface_desc` | Surface décroissante | `surfaceMax` décroissant. |
| `delivery_asc` | Livraison la plus proche | Les biens livrés d'abord, puis par date de livraison croissante. |
| `newest` | Nouveautés d'abord | Première publication, de la plus récente à la plus ancienne. |

Un bien sans valeur pour le critère de tri passe en dernier. À égalité : pertinence, puis identifiant (TRV-102).

**CAT-055** `[P1]` **Pagination** numérotée : « Précédent » · 1 · 2 · 3 · … · {dernière} · « Suivant ». La page en cours est marquée. Changer de page ramène l'écran en haut des résultats. Une page au-delà de la dernière redirige vers la dernière ; `page=1` est retiré de l'adresse. Sur téléphone (moins de 640 px), la pagination numérotée est remplacée par le bouton « Voir les 12 biens suivants », qui charge la page suivante **à la suite** des cartes et pose `page={n}` dans l'adresse (TRV-107) ; au retour (TRV-108), toutes les cartes chargées sont encore là, à la même position.

## 6. États

**CAT-060** `[P1]` **Aucun résultat avec des filtres.**
- « Aucun bien ne correspond à ces filtres pour l'instant. »
- avec `features.searchAlerts` : « Le catalogue s'enrichit régulièrement. Élargissez le budget ou la zone, ou laissez-nous vous prévenir dès qu'un bien correspond à votre recherche. » ; sans : « Le catalogue s'enrichit régulièrement. Élargissez le budget ou la zone, ou dites-nous ce que vous cherchez : un conseiller cherche pour vous. »
- Boutons : « Élargir le budget (+20 %) », seulement si un budget est fixé (il augmente `priceMax` ou `monthlyMax` de 20 %, arrondi vers le haut comme les bornes du curseur, CAT-034) ; « Réinitialiser les filtres » ; sans alertes : « Être rappelé » (repli : ACC-090).
- `[P1]` Le bloc de création d'alerte (CAT-070), ouvert d'office.

**CAT-061** `[P1]` Sous l'état vide : « Ces biens pourraient vous intéresser », avec trois biens au plus, obtenus en relâchant les critères dans cet ordre jusqu'à trouver des résultats : les communes ; le budget (+20 %) ; les pièces ; la livraison ; la région — un seul appel, `GET /public/properties/suggestions` (API-100) : les trois premières cartes du premier relâchement qui donne des résultats. L'ordre des relâchements est une fonction du domaine, partagée avec l'assistant (ASS-021). Si rien n'est trouvé, ce bloc est masqué.

**CAT-062** `[P1]` **Catalogue vide** (aucun bien publié) : « Les premiers programmes arrivent bientôt. » et l'appel du bas de page ; ni barre de recherche, ni filtres.

**CAT-064** `[P1]` **Aucun bien disponible, sans filtre** (des biens sont publiés, mais tous réservés ou vendus) : « Tous nos biens sont réservés pour le moment. De nouveaux programmes arrivent : dites-nous ce que vous cherchez. » · bouton « Être rappelé » (repli : ACC-090) · puis les biens réservés et vendus, voilés (CAT-043), sous le titre « Récemment réservés ». Jamais la phrase « ces filtres » quand aucun filtre n'est posé.

**CAT-063** `[P1]` Chargement, erreur, hors connexion : TRV-080, TRV-082. Une erreur de chargement des résultats laisse la barre de recherche et les filtres utilisables.

## 7. Alerte depuis le catalogue

**CAT-070** `[P1]` « Créer une alerte » ouvre un bloc (dans la page à l'état vide, en fenêtre sinon) :
- le rappel des critères en pastilles (CAT-022) ; sans critère : « Tous les nouveaux biens » ;
- l'adresse e-mail (préremplie et non modifiable pour un client connecté) ;
- la fréquence : « Dès qu'un bien correspond » · « Une fois par jour » (défaut) · « Une fois par semaine » ;
- le bouton « Créer l'alerte » ;
- la mention : « Sans créer de compte. Désinscription en un clic. Vos données sont hébergées dans l'Union européenne. »

**CAT-071** `[P1]` **Client connecté** : l'alerte porte l'adresse du compte (champ en lecture seule), elle est active tout de suite, rattachée au client, et aucun e-mail de confirmation ne part ; une alerte non confirmée de la même adresse et des mêmes critères devient active. **Sans compte** : l'alerte est créée inactive et l'e-mail `C_ALERT_CONFIRM` est envoyé ; elle s'active au clic sur le lien (7 jours). Écran après l'envoi : « Vérifiez votre boîte : un e-mail vous attend pour activer l'alerte. ». Une alerte sans compte ne crée **pas** de fiche client : elle ne tient qu'à son adresse (D-097). La confirmation et la prolongation ne s'appliquent que lorsque la page s'exécute dans un navigateur : un logiciel qui parcourt les liens d'un e-mail pour les vérifier ne confirme rien.

**CAT-072** `[P1]` Cas particuliers : mêmes critères et même adresse qu'une alerte existante et **active** → « Vous avez déjà une alerte pour cette recherche. », sans doublon ; alerte existante **non confirmée** (sans compte, lien non suivi) → l'e-mail `C_ALERT_CONFIRM` repart et l'écran est celui de CAT-071, sans dire qu'une alerte existait (TRV-112) ; dix alertes actives pour cette adresse → « Vous avez atteint le nombre maximal d'alertes. Supprimez-en une pour en créer une nouvelle. » — seules comptent les alertes qui envoient ; une recherche enregistrée (fréquence `NONE`, CAT-093) n'en est pas une (Q-051) ; les critères `sort`, `page`, `availability`, `vue`, `groupe` et `bbox` ne sont pas enregistrés dans l'alerte (Q-055). Le refus des dix alertes est `409 CONFLICT_STATE`, raison `ALERT_LIMIT`. Au plus dix alertes **non confirmées** par adresse : au-delà, la réponse reste celle de CAT-071 et rien n'est créé ni envoyé — un formulaire ne peut pas inonder une boîte (D-097). Le libellé d'une alerte commence par le mot cherché, s'il y en a un (« « terrasse » · Appartement · Alger »).

## 8. Plus tard

**CAT-090** `[P1]` **Vue sur carte** (D-090). Le bouton « Liste · Carte » de l'en-tête des résultats bascule la vue (`vue=carte` dans l'adresse, TRV-101). Sur ordinateur : la liste en cartes compactes à gauche (40 %), la carte à droite (60 %), sur le fond de FIC-060. Un repère par **programme**, au point approximatif de FIC-060 — jamais l'adresse exacte (TRV-045) —, avec le nombre de biens qui répondent aux critères ; les repères proches se regroupent en une pastille chiffrée qui zoome au clic. Survoler une carte de la liste grossit son repère ; cliquer un repère ouvre une bulle : programme, ville, « à partir de », nombre de biens, « Voir les biens ». Déplacer ou zoomer ne relance pas la recherche : un bouton « Rechercher dans cette zone » apparaît (critère `bbox`, CAT-020), qui filtre sur ce même point approximatif, jamais sur l'adresse exacte. Sur téléphone : carte plein écran, liste dans un panneau qui glisse du bas (trois hauteurs). La liste reste l'équivalent accessible de la carte ; les repères s'atteignent au clavier. Carte indisponible (FIC-061) : le bouton « Carte » est masqué.

**CAT-091** `[P1]` **Grouper par programme.** La bascule « Grouper par programme » (`groupe=programme`) montre une carte par programme — photo, nom, ville, « {n} biens · de {min} à {max} » — qui se déplie en ses biens (cartes compactes). Tri et filtres inchangés ; la pagination compte les programmes (12 par page).

**CAT-092** `[P1]` **Comparateur** (EP-31). Une case « Comparer » sur chaque carte et sur la fiche d'un bien ; trois biens au plus, gardés dans le navigateur (`dp_compare`). Un bac collant en bas de l'écran montre les vignettes, « Comparer ({n}) », actif dès deux biens, et « Tout retirer ». Un quatrième : « Vous comparez déjà trois biens : retirez-en un pour ajouter celui-ci. ». La page `/comparer?biens={réf},{réf},{réf}` montre une colonne par bien : photo, titre, ville, prix (devise de référence et devise du bien), mensualité indicative, surface, pièces, salles de bain, étages, livraison, standing, programme, promoteur, lots disponibles, caractéristiques (« ✓ » ou « — »), à proximité, temps de vol, visite 360° ; « Afficher seulement les différences » ; en tête de colonne « Retirer », en pied « Exprimer mon intérêt » et « Sauvegarder » (ajoute le bien aux favoris, SFA-020). Une ligne sans valeur pour aucun bien est masquée. Un bien devenu indisponible garde sa colonne, voilée, avec sa disponibilité. Sur téléphone : deux colonnes visibles, défilement horizontal aimanté, colonne des libellés collante. Route : `GET /public/properties/compare?refs=` (trois références au plus). **Depuis le comparateur** (D-095) : « Revenir aux résultats » revient à la page précédente si c'est `/programmes` (TRV-108), sinon ouvre `/programmes` ; « Exprimer mon intérêt » sous une colonne ouvre la fiche du bien avec `?interet=1` ; une référence inconnue ou archivée dans l'adresse est omise, avec la ligne « Un bien de cette comparaison n'est plus proposé. » — la page s'affiche dès qu'une référence est valable ; la mensualité indicative est arrondie comme sur les cartes (CAL-022), puisqu'on compare des cartes. Un lien de comparaison reçu d'un proche s'affiche sans jamais écrire `dp_compare` : il ne remplace pas la sélection de celui qui l'ouvre (D-097).

**CAT-093** `[P1]` **Recherches enregistrées.** « Enregistrer cette recherche », à côté de « Créer une alerte » : pour un client connecté, la recherche est enregistrée sur son compte (`SearchAlert` de fréquence `NONE`, sans envoi), nommée d'après le résumé des critères (CAT-022) et renommable ; sans compte, la page propose de se connecter ou de créer un espace (`/connexion?suite=…`, `/inscription?suite=…`) et l'enregistre au retour. Une recherche enregistrée n'expire jamais (son `expiresAt`, renseigné, est ignoré, D-097). Elles se retrouvent dans « Mes alertes et recherches » (EC-42), avec « Lancer », « Recevoir les nouveautés » (la recherche devient une alerte, CAT-070, qui n'envoie que les biens publiés **après** ce geste ; refusé avec le message de CAT-072 si dix alertes sont déjà actives) et « Supprimer ». Vingt au plus par compte, comptées à part des dix alertes actives (Q-051) ; à la vingt et unième : « Vous avez atteint le nombre maximal de recherches enregistrées. Supprimez-en une pour en enregistrer une nouvelle. » (`409 CONFLICT_STATE`, raison `SEARCH_LIMIT`). Comme une alerte, elle n'enregistre ni `sort`, ni `page`, ni `availability`, ni `vue`, ni `groupe`, ni `bbox` (CAT-072).
