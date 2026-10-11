# Fiches programme et bien

Écrans **EP-05** (fiche d'un bien), **EP-06** (galerie plein écran), **EP-04** (fiche d'un programme). Le formulaire d'intérêt (EP-07) est décrit dans `05-demandes.md`.

Règle d'or de ces pages : **une fiche se publie avec peu de données, et ne montre jamais une zone vide.** Chaque élément a un comportement prévu quand sa donnée manque.

---

## 1. Fiche d'un bien : structure

**FIC-001** `[P1]` Sections, dans l'ordre, avec ce qui se passe quand la donnée manque.

| # | Section | Source | Si la donnée manque |
|---|---|---|---|
| 1 | Fil d'Ariane | NAV-039 | Les niveaux sans objet (programme) sont omis. |
| 2 | En-tête : étiquettes, titre, lieu, actions | FIC-004 | — |
| 3 | Galerie | Médias du bien, puis du programme (MOD-236) | Variantes FIC-020 à FIC-022. |
| 4 | Faits clés | Champs du bien et de ses lots | Chaque tuile absente est masquée ; la grille se resserre, de dix tuiles au plus à trois au moins, sans trou (FIC-030). |
| 5 | Description | `description` | Description générée (MOD-211) ; pas de « Lire la suite ». |
| 6 | Caractéristiques | `features` | Section masquée. |
| 7 | Lots disponibles | Lots du bien | Section masquée pour un bien à lot unique (FIC-033). |
| 8 | Plans et visite 360° | Médias `PLAN`, `PANO_360` | Sans plan : carte du plan masquée. Sans 360° : FIC-020. |
| 9 | Le programme | `Program` | Bien isolé : section masquée ; la carte du promoteur reste. |
| 10 | Avancement du chantier `[P1]` | `ProgramUpdate` | Aucun point d'avancement, ou bien livré : section masquée. |
| 11 | Le promoteur | `Promoter` | Toujours présent (champ obligatoire). |
| 12 | Localisation | Coordonnées, ville, points d'intérêt, temps de vol | FIC-060 à FIC-065. |
| 13 | Biens similaires | CAL-081 | Moins de deux résultats : section masquée. |
| 14 | Référence et signalement | FIC-055 | — |
| — | Barre d'action : prix, financement, boutons | FIC-050 à FIC-053 | — |

Sur ordinateur, la barre d'action est une **colonne de droite collante** ; les sections 4 à 12 occupent la colonne de gauche. Les sections 13 et 14 suivent en pleine largeur, sous les deux colonnes : trois cartes de bien ne tiennent pas dans la colonne de gauche.

**FIC-004** `[P1]` **En-tête.**
- **Étiquettes**, dans cet ordre, chacune seulement si elle s'applique : la disponibilité (« Disponible », « Réservé », « Vendu ») · l'étiquette de CAT-041 · « Éligible au financement » · « Financement islamique » `[P1]` · « Visite 360° » `[P1]` · « Images 3D non contractuelles » (FIC-021) · « Photos à venir » (FIC-022).
- **Titre** : `Property.title`. C'est le titre de niveau 1 de la page.
- **Lieu** : « {ville}, {région} » ; sans ville : « {région} ». Suivi, `[P1]`, de « à {durée} de {ville de départ} » (FIC-065).
- **Actions** : « Partager » (NAV-037) · « Favori » `[P1]`.

## 2. Galerie

**FIC-010** `[P1]` **Mosaïque** en tête de fiche : une grande image (la couverture) et jusqu'à quatre vignettes. Un compteur « {n} photos · {m} plans » ouvre la galerie plein écran. La dernière vignette porte « + {n} photos » s'il en reste. Selon le nombre d'images : une seule → une grande image pleine largeur ; deux à quatre → une grande et les autres en vignettes, sans « + » ; cinq et plus → une grande, quatre vignettes.

**FIC-011** `[P1]` **Ordre** : la couverture (MOD-203), puis `sortOrder` ; les médias du bien d'abord, ceux du programme ensuite. Les plans ne figurent **jamais** dans la mosaïque : ils ont leur onglet et leur carte (FIC-034). Un bien qui n'a que des plans suit FIC-022.

**FIC-012** `[P1]` **Mentions sur les images.** Sur chaque image `RENDER_3D` : le texte du paramètre `legal.render3dNote` (« Image 3D non contractuelle »). Sur chaque image `isIllustration` : celui de `legal.illustrationNote` (« Image d'illustration »). Ces deux paramètres sont la seule source de ces mentions, sur les fiches comme sur les cartes. La légende (`caption`) et la pièce (`roomLabel`) s'affichent dans la galerie plein écran.

**FIC-013** `[P1]` Si le bien a une visite 360° : un bouton « Lancer la visite 360° » sur la grande image.

### Galerie plein écran (EP-06)

**FIC-014** `[P1]` S'ouvre au clic sur une image ou sur le compteur. En-tête : le titre, « {ville} · {prix} · Réf. {référence} », le bouton principal de la fiche — « Exprimer mon intérêt » pour un bien disponible, celui de FIC-080 pour un bien réservé, aucun pour un bien vendu ou retiré —, la croix. Onglets, chacun seulement s'il a du contenu : **Photos** ({n}) · **Plans** ({n}) · **Visite 360°** ({n} pièces) `[P1]` · **Vidéo** ({n}). Pour un bien `AVAILABLE`, l'en-tête porte aussi le lien secondaire « Demander une visite en visio » (FIC-020) : depuis les photos, un chemin vers « voir en vrai ». Sur téléphone (390) : le bouton principal est dans une barre basse (FIC-053), les vignettes sont masquées, « {i} / {n} » reste.

**FIC-015** `[P1]` **Onglet Photos.** Une image à la fois, avec « {i} / {n} », la pièce et la légende (« Séjour · Photo de l'appartement témoin · mars 2026 »), une bande de vignettes. Navigation : flèches à l'écran, flèches du clavier, balayage au doigt, et un clic sur la moitié droite ou gauche de l'image (suivante, précédente) — un visiteur âgé clique pour « la suivante ». Zoom : bouton « + » et pincement, jamais le simple clic. Échap ferme. Si le bien ou le programme a une brochure : « Télécharger la brochure (PDF, {taille}) ».

**FIC-016** `[P1]` **Onglet Plans.** La liste des plans (« Plan de l'appartement », « Plan d'étage », « Plan de masse », d'après leur légende), un plan à la fois, zoom de 50 à 400 %, déplacement à la souris ou au doigt, « Télécharger les plans (PDF) ». Mention : « Plans fournis par le promoteur. Surfaces indicatives : les surfaces contractuelles figurent dans l'acte. ».

**FIC-017** `[P1]` **Onglet Visite 360°.** Une visionneuse panoramique et la liste des pièces (« Séjour », « Cuisine », « Chambre 1 »…). On regarde autour de soi en glissant ; au clavier, avec les flèches ; sur téléphone, en bougeant l'appareil si l'utilisateur l'autorise. Légende du média affichée sous la vue (« Photos 360° prises dans l'appartement témoin du même type. Les finitions peuvent varier. »). Bouton « Partager cette vue » (lien vers la pièce affichée). Si le navigateur ne peut pas afficher la visionneuse : l'image panoramique à plat, défilable.

**FIC-018** `[P1]` **Onglet Vidéo.** Vidéo externe, chargée après un clic sur sa vignette (NAV-051).

**FIC-019** `[P1]` L'onglet et l'image affichés sont dans l'adresse (`?galerie=photos&i=3`, `?galerie=360&piece=sejour`). Un lien direct vers un onglet sans contenu ouvre l'onglet Photos ; pour la visite 360° absente, il affiche l'état vide : « Pas encore de visite 360° pour ce bien. » · « Les photos et le plan restent consultables dans les autres onglets. » · bouton « Demander une visite en visio ».

### Variantes selon les médias

**FIC-020** `[P1]` **Photos et plan, sans visite 360°.** L'étiquette et l'onglet « Visite 360° » n'existent pas. Dans la section 8, la carte de la visite est remplacée par « Visite en visio avec votre conseiller » : « Votre conseiller peut vous faire visiter l'appartement témoin en visio, ou vous envoyer une vidéo commentée. » · bouton « Demander une visite en visio » (ouvre le formulaire d'intérêt avec la case « Je souhaite une visite en visio » cochée, DEM-011).

**FIC-021** `[P1]` **Images 3D seulement** (aucune `PHOTO`, au moins une `RENDER_3D`). L'étiquette « Images 3D non contractuelles » est ajoutée à l'en-tête, et la mention figure sur chaque image.

**FIC-022** `[P1]` **Aucune photo ni image 3D.** La mosaïque est remplacée par une composition aux couleurs de la marque : « Photos en cours de préparation » · « En attendant : le plan, les chiffres clés et un échange avec votre conseiller. » · bouton « Voir le plan » s'il y en a un. L'étiquette « Photos à venir » s'ajoute à l'en-tête. Sur les cartes du catalogue, la même composition tient lieu de photo. Jamais de rectangle gris.

## 3. Contenu

**FIC-030** `[P1]` **Faits clés**, en tuiles. Quatre sont toujours là : **Type** · **Pièces** (« T3 · 2 chambres » ; masquée pour un terrain ou un local) · **Surface** (« 85 m² », « de 76 à 84 m² », suivie de « + 12 m² de terrasse » si elle existe) · **Livraison** (FIC-040). Les autres apparaissent si la donnée existe : **Salles de bain** · **Terrain** (« 400 m² ») · **Étages** (étages des lots disponibles : « du 1er au 5e », « rez-de-chaussée ») · **Stationnement** (« 1 place incluse » si tous les lots disponibles l'incluent) · **Standing** · **Lots disponibles** (« 7 lots »).

**FIC-031** `[P1]` **Description.** Six lignes, puis « Lire la suite » qui déplie le texte sur place (TRV-071). Les retours à la ligne saisis sont respectés ; aucun HTML n'est interprété.

**FIC-032** `[P1]` **Caractéristiques.** Les caractéristiques cochées du bien, chacune avec son icône et son libellé (PAR-060), dans l'ordre de la liste. Titre : « Ce qui est compris ».

**FIC-033** `[P1]` **Lots disponibles**, pour un bien de plusieurs lots. Tableau des lots `AVAILABLE`, par prix croissant : Lot · Étage · Surface · Orientation · Prix · bouton « Ce lot m'intéresse » (ouvre le formulaire d'intérêt avec ce lot). Huit lignes, puis « Voir les {n} lots ». Sur téléphone : une carte par lot. Un lot sous option ou réservé n'apparaît pas. Le prix de chaque lot est donné dans la devise de référence (converti et arrondi comme `priceFromRef`, CAL-028), avec le prix d'origine en dessous (FIC-050) et son prix au mètre carré (CAL-024).

**FIC-034** `[P1]` **Plans et visite.** Deux cartes : la visite 360° (ou son remplacement, FIC-020) et le plan (« Plan de l'appartement » · « PDF · {taille} » · « Télécharger les plans »).

**FIC-040** `[P1]` **Livraison.**

| Situation | Affichage |
|---|---|
| `DELIVERED` | « Livré » |
| Date à venir, précision `MONTH` | « Livraison juin 2027 » |
| Précision `QUARTER` | « Livraison T2 2027 » |
| Précision `YEAR` | « Livraison 2027 » |
| Livraison **dépassée** (MOD-202 : la fin de la période annoncée est passée — fin du mois, du trimestre ou de l'année — et le statut n'est pas `DELIVERED`) | « Livraison en cours de confirmation » (AUT-074) |

Suivi du statut : « sur plan » ou « en construction ».

**FIC-041** `[P1]` **Le programme.** Son nom, son accroche, le début de sa description, le nombre total de logements, ses équipements (PAR-060), le lien « Voir le programme ». Puis « Autres biens de ce programme » : les autres typologies publiées, en cartes compactes (titre, surface, prix, mensualité).

**FIC-042** `[P1]` **Avancement du chantier.** Une frise de cinq étapes (Fondations, Gros œuvre, Second œuvre, Finitions, Livraison) : les étapes passées avec leur date, l'étape en cours marquée « En cours », le pourcentage global, « Mis à jour le {date} », et les photos du dernier point. Clic sur une photo : galerie.

**FIC-043** `[P1]` **Le promoteur.** Logo, nom, mention « Promoteur sélectionné », `referencesPublic`, « {n} programmes au catalogue », lien « Voir le promoteur ». Les garanties annoncées (`Program.guarantees`) suivent, sous le titre « Garanties du programme », si elles existent.

## 4. Prix, financement, actions

**FIC-050** `[P1]` **Prix.**
- en grand : « ≈ {prix dans la devise de référence} », précédé de « À partir de » si les lots disponibles n'ont pas tous le même prix ;
- dessous : le prix **dans la devise du bien** (« 22 275 000 DA »), qui est le prix fixé par le promoteur ;
- puis : « {prix au m²} / m² · Taux indicatif du {date} » (TRV-022) ; le prix au mètre carré suit CAL-024 — celui du lot quand il n'y en a qu'un, « de {min} à {max} / m² » quand les lots disponibles diffèrent.

Si la conversion est impossible (CAL-011) : le prix dans la devise du bien, seul, et le prix au mètre carré dans cette devise.

**FIC-051** `[P1]` **Financement.**
- `[P1]` « Mensualité indicative* » · « {montant} / mois » · les hypothèses : « sur {durée} · apport {pct} % · {taux} · hors assurance » (financement de référence, CAL-030) ;
- le lien **« Ajuster la simulation »** → simulateur de crédit, prérempli avec ce bien (SIM-030) ; si une simulation de crédit de ce bien existe pour la personne (son compte, ou `dp_anon`, comme CAT-035), une ligne la rappelle : « Votre simulation : {x} € / mois sur {durée} · Revoir » — la fiche ne remontre pas 810 € à qui vient de calculer 760 € ;
- si le bien est éligible (`financingEligible`) : « Financement possible auprès de nos banques partenaires » ; sinon : « Nous étudions votre financement avec nos banques partenaires. » et le lien « Tester mon éligibilité » ;
- la note de TRV-023.

Sans mensualité (fonction inactive ou non calculable) : seuls restent le lien vers le simulateur et la phrase sur l'éligibilité.

**FIC-052** `[P1]` **Boutons.**

| Bouton | Effet | Condition |
|---|---|---|
| **Exprimer mon intérêt** (principal) | Ouvre le formulaire d'intérêt (EP-07, DEM-011). L'adresse `…?interet=1` ouvre la fiche avec ce formulaire déjà ouvert (liens des e-mails et des partages) ; si le bien n'est plus disponible, le paramètre est ignoré et la fiche s'affiche dans son état du moment (FIC-080 à FIC-090). | Bien `AVAILABLE`. |
| Demander une visite ou une visio | Client connecté avec un dossier : demande de rendez-vous (INT-040). Sinon : formulaire d'intérêt, case « visite en visio » cochée. | `[P1]` `features.clientAppointments` pour la demande de rendez-vous. |
| Poser une question sur WhatsApp | Ouvre WhatsApp avec « Bonjour, je m'intéresse au bien {titre} (réf. {référence}). » | `contact.whatsapp` renseigné. |

Les boutons et liens qui ouvrent le formulaire d'intérêt — « Demander une visite ou une visio », « Demander une visite en visio » (FIC-019, FIC-020), « Ce lot m'intéresse » (FIC-033) — ne sont proposés que pour un bien `AVAILABLE`. Pour un bien `RESERVED`, ils cèdent la place à « Être rappelé » (DEM-015, avec la référence du bien) ; pour un bien `SOLD` ou `WITHDRAWN`, ils sont absents.

Sous les boutons, deux boutons de même poids : **« Favori »** (SFA-020) et **« Partager »** (FIC-012), les mêmes que ceux de l'en-tête de la fiche — on garde ou on partage le bien sans remonter la page (maquette EP-05, « Prix et actions » ; D-100). Bien `SOLD` ou `WITHDRAWN` : absents.

Sous les boutons, le bloc `propertyPage.reassurance` : « Un conseiller vous rappelle sous 48 h ouvrées » · « Sans engagement ». Aucune promesse de gratuité n'y figure tant que Q-002 n'est pas tranchée.

**FIC-053** `[P1]` **Téléphone.** La barre d'action devient une barre fixe en bas de l'écran : le prix (ou la mensualité) à gauche, « Exprimer mon intérêt » à droite. Le bloc complet (prix, financement, boutons) figure dans la page après la galerie.

**FIC-054** `[P1]` **Client connecté.**

| Situation | Affichage |
|---|---|
| Il a déjà exprimé un intérêt pour ce bien | Le bouton principal est remplacé par « Intérêt envoyé le {date} » et le lien « Suivre dans mon espace ». |
| Le bien lui a été **proposé** par son conseiller | Un bandeau « {conseiller} vous a proposé ce bien » avec « Ce bien m'intéresse » et « Ce bien ne me convient pas » (INT-020), tant qu'il n'a pas répondu. Ensuite le bandeau dit où il en est — « Visite le {date} », « Écarté » avec « Finalement, il m'intéresse »… — et mène à son espace (INT-002, INT-010). |
| Le bien est **retenu** dans son dossier | Bandeau « C'est le bien de votre dossier {référence} » et lien « Ouvrir mon dossier ». |

**Visiteur sans compte, après l'envoi** (D-095) : la fiche se souvient, pour la session (TRV-092), que la demande est partie — le bouton principal devient « Demande envoyée » (inactif) avec, dessous, « Envoyer une autre demande » ; `?interet=1` est retiré de l'adresse à la fermeture de la fenêtre, et un rechargement ne rouvre pas un formulaire vide. Sans cela, la personne doute et renvoie (DEM-024 absorbe, mais ne rassure pas).

**FIC-055** `[P1]` **Pied de fiche** : « Réf. {référence} · Publié le {date} · Mis à jour le {date} » — une date, pas une durée (« il y a 3 jours » vieillirait dans une page en cache) —, et le lien « Signaler une erreur sur cette fiche » (DEM-018).

**FIC-056** `[P1]` Le nombre de vues et le nombre d'intérêts d'un bien ne sont **pas publics** (D-047). Le seul signal de rareté affiché est le nombre de lots disponibles.

## 5. Localisation

**FIC-060** `[P1]` **Carte.** Fond OpenStreetMap (D-056), servi par le fournisseur de `MAP_STYLE_URL` (ENV-040), qui en permet l'usage commercial — jamais directement par les serveurs de tuiles de la fondation OpenStreetMap. La position affichée n'est **jamais** l'adresse exacte :
- si le bien ou son programme a des coordonnées : elles sont ramenées par le serveur au centre d'une maille d'environ 500 m (latitude et longitude arrondies à 0,005°), et la carte dessine un **cercle** de 600 m de rayon, sans épingle ;
- sinon : la carte est centrée sur la commune (niveau de zoom 12), à défaut sur la région (niveau 9), sans cercle, avec le libellé « Secteur de {ville} ».

Sous la carte : « Adresse exacte communiquée après qualification. ». Les coordonnées exactes ne sortent jamais par une route publique de l'API.

**FIC-061** `[P1]` La carte et ses fonds ne sont chargés que lorsque la section approche de l'écran. Si les fonds de carte ne répondent pas, ou si `MAP_STYLE_URL` n'est pas définie : la section affiche « {ville}, {région} » en texte, sans zone vide et sans bouton « Carte ». Fournisseur des fonds : OpenFreeMap en local, à choisir pour la recette et la production (Q-056).

**FIC-062** `[P1]` **À proximité.** Cinq points d'intérêt au plus, chacun avec l'icône de sa catégorie et sa durée : « Université USTHB · 5 min en voiture », « École primaire · 4 min à pied ». Sans point d'intérêt : liste masquée.

**FIC-065** `[P1]` **Depuis l'étranger.** Les temps de vol vers la région du bien (PAR-024) : « Paris · 2 h 15 », « Marseille · 1 h 30 » ; un vol avec escale porte sa note (« via Paris »). Dans l'en-tête de la fiche, une seule durée : celle de la ville de départ du pays de résidence du visiteur s'il est connu (client connecté), sinon Paris. Sans donnée pour la région : rien n'est affiché.

## 6. Biens similaires

**FIC-070** `[P1]` Trois cartes au plus (CAL-081), sous le titre « Biens similaires » — neutre, parce que CAL-081 peut élargir la recherche hors de la région, à ± 40 % du prix et à d'autres types de bien —, avec le lien « Voir les {n} biens à {région} » vers le catalogue filtré.

## 7. Selon la disponibilité

**FIC-080** `[P1]` **Réservé** (plus aucun lot disponible, au moins un sous option ou réservé). Bandeau en tête : « Tous les lots de ce bien sont réservés pour le moment. ». Le bouton principal devient « M'alerter si un lot se libère » `[P1]` (alerte sur ce bien ; repli : « Être rappelé », qui garde la référence du bien — DEM-014, DEM-015). Les biens similaires remontent juste après la galerie. Une demande envoyée pendant qu'un bien se réserve est tout de même enregistrée (DEM-026).

**FIC-081** `[P1]` **Vendu.** Bandeau : « Ce bien est vendu. ». Plus de bouton d'intérêt ; les biens similaires remontent. La fiche reste en ligne `catalogue.soldVisibleDays` jours, puis est archivée (CYC-123).

**FIC-082** `[P1]` **Retiré de la vente** (tous les lots retirés) : « Ce bien n'est plus proposé pour le moment. », sans prix ni bouton d'intérêt, avec les biens similaires.

**FIC-090** `[P1]` **Bien archivé** : la page répond `410` avec « Ce bien n'est plus proposé. », trois biens similaires, le lien vers son programme s'il est publié, et la barre de recherche. Un bien jamais publié répond `404`.

## 8. Mesure

**FIC-100** `[P1]` **Compteur de vues.** La fiche sort d'un cache : ce n'est pas son affichage qui compte la vue, mais un **signal** que la page envoie une fois chargée dans un navigateur (`POST /public/properties/{référence}/view`, sans corps ; la requête porte les cookies du site — dont `dp_gate`, NAV-064 — mais la vue est comptée sans tenir compte d'une session éventuelle ; un robot qui ne joue pas les scripts n'envoie rien). Le serveur compte au plus une vue par visiteur, par bien et par jour (empreinte de l'adresse IP et du navigateur, gardée 24 heures en mémoire partagée, jamais stockée en clair) et ignore les robots connus ; un aperçu ouvert depuis le back-office (FIC-120) n'envoie pas le signal. Une visite ordinaire d'un membre de l'équipe sur le site public compte comme une autre : rien ne la distingue — le back-office est sur un autre domaine —, et c'est sans effet sur les chiffres. Les vues s'accumulent en mémoire, puis la tâche `stats.flush` les reporte toutes les cinq minutes dans `PropertyDailyStat` (une ligne par bien et par jour) et dans le total `viewCount`. Les demandes d'intérêt sont comptées de même, à leur création. C'est ce qui permet les chiffres « sur la période » du back-office (TDB-012). Si le signal échoue, rien n'est dit au visiteur.

## 9. Fiche d'un programme (EP-04)

**FIC-110** `[P1]` Sections :

| # | Section | Si la donnée manque |
|---|---|---|
| 1 | Fil d'Ariane, étiquettes (standing, livraison, étiquette manuelle), nom, accroche, « {ville}, {région} », « Partager » | — |
| 2 | Galerie (photos, images 3D, plan de masse, vidéo, brochure) | Mêmes variantes que le bien. |
| 3 | Faits clés : standing · livraison · nombre de logements · prix « à partir de » · lots disponibles | Tuile masquée. |
| 4 | Description | Obligatoire à la publication. |
| 5 | Équipements | Section masquée. |
| 6 | **Les biens du programme** | FIC-111. |
| 7 | Avancement du chantier `[P1]` | Section masquée. |
| 8 | Promoteur et garanties | — |
| 9 | Localisation | FIC-060 à FIC-065. |
| 10 | Autres programmes de la région | Section masquée s'il n'y en a pas. |

**FIC-111** `[P1]` **Les biens du programme.** Une ligne (ou une carte, sur téléphone) par bien publié, par prix croissant : vignette (la couverture du bien) · titre · surface · « à partir de {prix} » · mensualité `[P1]` · pastille « Disponible », « Réservé » ou « Vendu » · chevron ; **toute la ligne est le lien** vers la fiche du bien (survol, focus et appui visibles ; maquette EP-04 ; D-100). Ce que la section affiche quand aucun bien n'est à vendre dépend de l'**état commercial** du programme (CYC-127) :

| État | Section |
|---|---|
| À venir (aucun bien publié ni archivé : le programme n'a encore rien mis en vente) | « Les biens de ce programme arrivent bientôt. » · `[P1]` « Me prévenir » (alerte sur ce programme). Le bouton « Ce programme m'intéresse » reste : la demande porte le programme (DEM-012). |
| Tout est réservé | Les biens, marqués « Réservé » · « Tous les biens de ce programme sont réservés pour le moment. » · `[P1]` « Me prévenir si un bien se libère » (repli : « Être rappelé »). |
| Vendu | « Programme entièrement vendu. » · les biens vendus encore en ligne · puis « Autres programmes de {promoteur} », à défaut de la région. Jamais « arrivent bientôt ». |
| Retiré | « Ce programme n'est plus proposé pour le moment. » |

**FIC-112** `[P1]` **Barre d'action du programme** : « À partir de {prix} » (`Program.priceFromRef`, CAL-028), la mensualité `[P1]`, et le bouton **« Ce programme m'intéresse »** → formulaire d'intérêt avec le choix de la typologie (DEM-012). Programme « À venir » : pas de prix (aucun n'est encore public), le bouton seul. Programme « Tout est réservé » : le bouton devient « Être rappelé ». Programme « Vendu » ou « Retiré » : ni prix ni bouton. Mêmes boutons secondaires que FIC-052 (« Demander une visite ou une visio », « Poser une question sur WhatsApp » si `contact.whatsapp` est renseigné), le message préparé disant « Je m'intéresse au programme {nom} ».

## 10. Aperçu avant publication

**FIC-120** `[P1]` Depuis le back-office, « Aperçu » ouvre la fiche d'un bien ou d'un programme **non publié** sur le site public, par un lien signé valable une heure. Un bandeau fixe l'indique : « Aperçu : cette fiche n'est pas en ligne. ». L'aperçu n'est pas indexé, ne compte aucune vue et n'accepte aucune demande.

Adresse : `/biens/{slug}?apercu={jeton}` et `/programmes/{slug}?apercu={jeton}`. Le jeton est signé (`LINK_SIGNING_KEY`, ENV-040) et porte l'identifiant de l'objet, celui du membre du personnel et une expiration à une heure. `GET /public/properties/{slug}` et `GET /public/programs/{slug}` acceptent le paramètre `preview={jeton}` : jeton valable → la fiche est rendue quel que soit son état de publication, avec `isPreview: true`, sans mise en cache (`Cache-Control: no-store`), sans signal de vue (FIC-100) et sans bouton d'intérêt ; jeton absent, faux ou expiré → NAV-041. L'aperçu d'une page libre (CMS-030) suit le même principe : `/infos/{slug}?apercu={jeton}`, `GET /public/pages/{slug}?preview={jeton}`.
