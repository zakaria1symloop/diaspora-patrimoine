# Back-office — contenus et référencement

Écrans **EA-90** (textes du site), **EA-91** (pages libres), **EA-92** (questions fréquentes), **EA-93** (témoignages), **EA-94** (textes légaux), **EA-95** (redirections). Permission : `content.manage` ; les textes légaux demandent `settings.sensitive.manage`.

Principe 6 : tout ce que l'administrateur peut vouloir changer est une donnée. Le **texte** se change ici ; la **mise en page** reste celle des maquettes validées.

---

## 1. Textes du site (EA-90)

**CMS-001** `[P1]` Les textes modifiables des pages sont des **blocs** (`ContentBlock`). La liste des blocs est **fixée par le code** (CMS-020) : on en change la valeur, on n'en crée pas. L'écran les présente par page, dans l'ordre où ils apparaissent à l'écran.

**CMS-002** `[P1]` **Modifier un bloc.** Selon son type : une ligne de texte · un texte riche (EDI-003) · un nombre · un montant · une bascule · une image (choisie dans la médiathèque des contenus) · un **formulaire** pour un bloc composé (les six motivations, les sept services, le comparatif…), avec ses lignes ordonnables. Chaque champ a une **longueur maximale**, affichée : 1,3 fois la longueur de son texte d'origine, arrondie à la dizaine supérieure, et au moins 20 caractères. Un bloc composé garde le **nombre de lignes** de son texte d'origine : ses lignes se réordonnent et se modifient, elles ne s'ajoutent ni ne se retirent. Vider un champ n'est jamais refusé ; si la section du bloc n'a pas de repli (ACC-090), l'avertissement de CMS-021 le dit.

**CMS-003** `[P1]` « Enregistrer » met le site à jour (NAV-042) et propose « Voir la page ». Chaque bloc a son **historique** (les vingt dernières valeurs, avec auteur et date : `ContentBlockVersion`, `01-domaine/05`, § 4.1) et les boutons « Rétablir cette valeur » et « Rétablir le texte d'origine ». Toute modification est tracée. Deux personnes qui modifient le même bloc ne s'écrasent pas : le second enregistrement est refusé avec le message de TRV-094 (un bloc porte une version, MOD-007). Quand une mise à jour de l'application apporte un nouveau texte d'origine à un bloc que l'équipe avait modifié, rien n'est écrasé : l'écran le signale et propose de comparer (PAR-081).

**CMS-004** `[P1]` **Champs remplacés à l'affichage** dans un bloc : `{année}` (l'année en cours) · `{apport}` (le pourcentage d'apport du financement de référence). Tout autre texte entre accolades est affiché tel quel.

**CMS-020** `[P1]` **Liste des blocs.** « Composé » = bloc au format structuré, modifié par un formulaire.

| Page | Clé | Type | Contenu (valeur d'origine : la maquette validée) |
|---|---|---|---|
| Marque | `brand.tagline` | texte | « La plateforme de l'immobilier neuf en Afrique » |
| Accueil | `home.hero.line1`, `.line2`, `.line3` | texte | ACC-010 |
| | `home.hero.image` | image | Image du héros |
| | `home.hero.cafeCard` | composé | Surtitres, deux textes, deux lieux (ACC-011) |
| | `home.hero.fallbackCard` | composé | Titre et texte de la carte de repli (ACC-090) |
| | `home.hero.mentions` | composé | Les deux mentions de ACC-012 |
| | `home.comparison` | composé | Titre en deux lignes, deux colonnes (prix, apport, mensualité, et pour chacune durée et taux), libellé de l'écart, bascule « Afficher » (ACC-040). Dès qu'une colonne a sa durée et son taux, sa mensualité est calculée et l'écran le montre (ACC-043) |
| | `home.why.title1`, `.title2`, `.subtitle1`, `.subtitle2` | texte | ACC-045 |
| | `home.why.items` | composé | Six cartes : titre, texte, image |
| | `home.properties.title1`, `.title2`, `.subtitle1`, `.subtitle2` | texte | ACC-050 |
| | `home.assistant.line1`, `.line2` | texte | ACC-053 |
| | `home.cafe.title1`, `.title2`, `.subtitle1`, `.subtitle2`, `.note` | texte | ACC-060, ACC-061 |
| | `home.cafe.places` | composé | « À Paris », « et dans le Sud de la France », « Au moins une fois par mois » |
| | `home.cafe.photo` | image | Photo de la section Café de l'accueil, reprise en tête de la liste des Cafés (CAF-001) à la place du dessin ; vide : le dessin (DSN-076) |
| | `home.services.title1`, `.title2`, `.subtitle1`, `.subtitle2` | texte | ACC-070 |
| | `home.services.items` | composé | Sept services : titre, texte |
| | `home.services.cta` | composé | « Parlons de votre projet », texte, libellé du bouton |
| | `home.financing.title1`, `.title2`, `.subtitle1`, `.subtitle2` | texte | ACC-080 |
| | `home.financing.subtitleNoIslamic` | texte | Sous-titre employé tant que `features.islamicFinance` est faux (ACC-090) |
| | `home.financing.items` | composé | Trois cartes : surtitre, titre, texte, trois points, bascule « Afficher » |
| | `home.projection` | composé | Titre, pastille, texte, libellé du bouton (ACC-081) |
| | `home.projection.fallback` | composé | Titre et texte du repli « Simulez votre projet » |
| | `home.final.title1`, `.title2`, `.text` | texte | ACC-086 |
| | `home.final.textFallback` | texte | Phrase de l'appel final quand ni le Café ni la projection ne sont actifs (ACC-090) |
| Catalogue | `listing.intro` | texte | CAT-001 |
| | `listing.introMonthly` | texte | Introduction employée quand `features.monthlyBudgetSearch` est vrai (CAT-001) |
| | `listing.help` | composé | « Vous ne trouvez pas le bien idéal ? » et son texte |
| Fiche | `propertyPage.reassurance` | composé | Lignes sous les boutons (FIC-052) |
| | `propertyPage.visio` | composé | Titre et texte de la carte « Visite en visio » (FIC-020) |
| Financements | `financing.credit.body`, `financing.islamic.body`, `financing.expertise.body` | texte riche | EDI-020 |
| | `financing.banks.intro` | texte | EDI-020 |
| | `financing.expertise.photo` | média | Photo de la ligne « Un conseiller financier à vos côtés » (EDI-020) ; vide : scène « Partenaire » (DSN-076) |
| Notre concept | `concept.intro` | texte | EDI-010 |
| | `concept.answers` | composé | Deux freins, deux réponses |
| | `concept.steps` | composé | Six étapes : titre, texte (EDI-011) |
| | `concept.support` | texte riche | Accompagnement administratif et consulaire |
| | `concept.keyFigures` | composé | Chiffres clés : valeur, libellé (EDI-070) |
| Promoteurs | `promoters.intro` | texte | EDI-030 |
| | `promoters.selection` | texte riche | « Comment nous sélectionnons » |
| Le Café `[P1]` | `cafe.intro` | texte | CAF-001 |
| | `cafe.steps` | composé | Trois temps |
| | `cafe.defaultDescription` | texte riche | Description par défaut d'un Café |
| Contact | `contactPage.intro` | texte | Phrase d'introduction de la page Contact (texte de SYMLOOP, à valider : Q-066) |
| Projection | `projectionPage.intro` | texte | Introduction de la page « Recevez votre projection » (EP-20) ; le formulaire garde les textes de `home.projection` (texte de SYMLOOP, Q-066) |
| | `projectionPage.contents` | composé | « Ce que contient la projection » : quatre éléments au plus, titre et texte (Q-039 ; texte de SYMLOOP, Q-066) |
| Devenir partenaire | `partnerPage.intro` | texte | Introduction de la page « Devenir partenaire » (EP-23, DEM-019 ; texte de SYMLOOP, Q-066) |
| | `partnerPage.points` | composé | « Pourquoi travailler ensemble » : quatre éléments au plus, titre et texte (texte de SYMLOOP, Q-066) |
| Pied de page | `footer.cafeLine` | texte | NAV-020 |
| | `footer.note` | texte | « *Exemples chiffrés indicatifs et non contractuels. » (NAV-020) |
| Référencement | `home.seoTitle` | texte | NAV-032 |
| | `brand.shareImage` | image | NAV-036 |
| Back-office | `admin.charter` | texte riche | Charte d'utilisation acceptée à la première connexion ; texte d'origine dans BO-003 |

Les libellés de boutons, de champs et de messages ne sont pas des blocs : ce sont des textes d'interface (`07-design/03`), changés par une mise à jour de l'application. Les coordonnées sont des paramètres (D-045).

**CMS-021** `[P1]` **Avertissements** affichés sur un bloc : le comparatif sans durée ni taux (ACC-042) ; un bloc obligatoire vidé (« Ce texte est nécessaire : la section serait masquée. ») ; une image d'un poids ou d'un format inadapté.

## 2. Pages libres (EA-91)

**CMS-030** `[P1]` Liste : Titre · Adresse · État · Modifiée le. Une page libre (EDI-002) a : un titre, une adresse (`/infos/{slug}`, modifiable tant qu'elle n'est pas publiée ; ensuite, « Régénérer l'adresse » crée une redirection), un texte riche, un titre et une description pour le référencement, un état : Brouillon · Publiée · Archivée. « Aperçu » montre la page avant publication (lien signé, FIC-120). Une page archivée n'est plus servie (`404`, EDI-002). Vide : « Aucune page libre. Les pages du site se modifient dans Textes du site ; une page libre sert à un contenu ponctuel. » et « Créer une page ».

## 3. Questions fréquentes (EA-92)

**CMS-040** `[P1]` Liste groupée par catégorie, ordonnable par glisser-déposer dans chaque catégorie. Une question : la question (200 caractères) · la réponse (3 000 ; gras, liens, listes) · la catégorie (Acheter · Financement · Votre dossier · Le Café · La plateforme) · les **emplacements** où elle apparaît en plus de la page des questions (Financements · Le Café · Notre concept) · « Publiée » · l'indicateur dont elle dépend, facultatif (`requiredFeature`, EDI-040). Supprimer une question la met à la corbeille. Questions de départ : EDI-041. Vide : « Aucune question fréquente. » et « Ajouter une question ».

## 4. Témoignages (EA-93)

**CMS-050** `[P1]` Liste : Nom affiché · Ville · Acquisition · Publié · Ordre. Un témoignage : le nom affiché (« Nadia B. ») · la ville de résidence · le résumé de l'acquisition (« T3 à Alger ») · la citation (600 caractères) · une photo · le client concerné (lien interne) · la **date de l'accord écrit** de la personne. Sans cette date, « Publier » est refusé (raison `TESTIMONIAL_CONSENT_MISSING`). Un second accord écrit, facultatif, permet de garder le témoignage si la personne fait effacer ses données (`Testimonial.keepAfterErasureConsentAt`, SEC-111). Un témoignage peut naître d'un retour positif (FBK-004) ou d'un dossier abouti (PIP-090) : il est alors prérempli, en préparation. Le site n'affiche les témoignages qu'à partir de deux publiés (EDI-071). Vide : « Aucun témoignage. Ils naissent d'un retour positif ou d'un dossier abouti, ou se saisissent ici. » et « Ajouter un témoignage ».

## 5. Textes légaux (EA-94)

**CMS-060** `[P1]` Quatre textes : conditions générales · politique de confidentialité · mentions légales · politique de cookies. Pour chacun, la liste de ses **versions** : libellé, date d'effet, date de publication, auteur, « En vigueur ». À l'installation, chacun a une version « 0.1 – projet », provisoire et **en vigueur** (PAR-083) : l'écran la marque « Provisoire : à remplacer avant l'ouverture au public », et la carte « Avant la mise en ligne » garde le point ouvert tant qu'elle l'est. Il y a donc toujours une version en vigueur. Une version publiée ne se dépublie pas : elle est remplacée par une version plus récente (CMS-062). La version provisoire est celle dont le libellé (`LegalDocument.version`) vaut « 0.1 – projet ».

**CMS-061** `[P1]` **Nouvelle version** (`settings.sensitive.manage`, rôle Direction). « Créer une version » part d'une copie de la version en vigueur. Champs : libellé de version (« 2026-11 ») · titre · texte riche · date d'effet (maintenant, ou plus tard) · « Ce qui change » (résumé montré aux clients) · « Redemander l'acceptation » (coché par défaut pour les conditions générales et la politique de confidentialité). Tant qu'elle n'est pas publiée, une version se modifie et se supprime — définitivement : une version jamais publiée n'a servi à aucun consentement. Une version publiée refuse toute modification (raison `LEGAL_VERSION_PUBLISHED`).

**CMS-062** `[P1]` **Publier** une version la rend **définitive** : elle ne se modifie plus (MOD-420). Avant validation : « À partir du {date d'effet}, cette version remplacera la version actuelle. {Tous les clients devront l'accepter à leur prochaine connexion.} ». Remplacer une version provisoire redemande toujours l'acceptation des conditions générales et de la politique de confidentialité aux personnes qui avaient accepté le texte provisoire (AUTH-090). La confirmation renforcée est demandée (BO-005). Les versions passées restent consultables : chaque consentement enregistré renvoie à la version qu'il a acceptée.

## 6. Redirections (EA-95)

**CMS-070** `[P1]` Liste : Depuis · Vers · Type (`301` définitive · `302` temporaire) · Créée le. Une redirection : l'adresse d'origine (commence par `/`, unique, ne peut pas être une page existante du site) · l'adresse d'arrivée (une adresse **interne**) · le type. Refus (raison `REDIRECT_INVALID`) : une redirection vers elle-même, qui formerait une boucle, ou qui partirait d'une page existante — une route du site ou le slug d'un objet publié. Les deux adresses sont des chemins sans paramètres (`?`) ni fragment (`#`). Les redirections créées automatiquement par un changement d'adresse (`SlugHistory`) apparaissent dans la liste, en lecture seule. Une redirection saisie se supprime (`content.manage`), sans passer par la corbeille ; la suppression est tracée (`redirect.changed`). Vide : « Aucune redirection. » et « Ajouter une redirection ».

## 7. Référencement

**CMS-080** `[P1]` Le titre et la description de référencement d'un programme, d'un bien, d'une page se saisissent dans leur propre fiche, avec un compteur et l'aperçu d'un résultat de recherche. Vide : la valeur générée s'applique (NAV-032), et l'aperçu la montre.

**CMS-081** `[P1]` La vue « Référencement » de l'écran « Pages » (EA-91) donne une vue d'ensemble : l'état de l'indexation (`seo.allowIndexing`) ; pour chaque page publiée, son titre et sa description avec leur longueur, et un signal quand ils sont absents, trop longs ou en double ; l'aperçu de la carte de partage ; la date du dernier plan du site et le bouton « Régénérer le plan du site ».

## 8. Médiathèque des contenus

**CMS-090** `[P1]` **Images des contenus** — l'onglet « Images » de l'écran « Textes du site » (EA-90). Les images des blocs et des pages libres (`Media`, propriétaire `CONTENT`) : dépôt (mêmes règles que les photos du catalogue, CTL-080), texte de remplacement obligatoire pour une image porteuse de sens, liste avec recherche. Une image **utilisée** par un bloc ou une page ne se supprime pas (raison `IN_USE`) : l'écran dit où elle sert.
