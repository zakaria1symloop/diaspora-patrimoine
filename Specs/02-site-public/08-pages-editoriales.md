# Pages éditoriales

Écrans **EP-16** (Notre concept), **EP-10** (Financements), **EP-08** et **EP-09** (Promoteurs), **EP-17** (Nos partenaires), **EP-18** (Questions fréquentes), **EP-19** (Contact), **EP-24** (pages légales).

---

## 1. Règles communes

**EDI-001** `[P1]` Les pages institutionnelles ont une **structure fixe**, construite par le code, et des **textes modifiables**, portés par des blocs de contenu (CMS-020). Elles existent donc toujours : jamais de lien de menu vers une page vide. Un bloc vidé par l'administrateur masque sa section ; il ne laisse pas de trou.

**EDI-002** `[P1]` L'administrateur peut créer des **pages libres** (`Page`, nature `EDITORIAL`) : un titre, un texte riche, un titre et une description pour le référencement. Elles sont servies à `/infos/{slug}` quand elles sont publiées, et répondent `404` sinon. Elles ne figurent dans aucun menu d'office : l'administrateur y renvoie depuis un texte.

**EDI-003** `[P1]` Le texte riche de ces pages est nettoyé (SEC-060). Sont permis : titres de niveaux 2 et 3, paragraphes, gras, italique, listes, liens, citations, images de la médiathèque, tableaux simples.

**EDI-004** `[P1]` Chaque page se termine par un **appel** : « Parlons de votre projet » · « Un conseiller vous rappelle, au moment qui vous convient. » · bouton « Être rappelé » (replis : ACC-090).

## 2. Notre concept (EP-16)

**EDI-010** `[P1]` Adresse `/notre-concept`. Sections :

| # | Section | Contenu | Bloc |
|---|---|---|---|
| 1 | Titre | « Notre concept » · « Une plateforme de mise en relation sélective pour acheter un bien neuf en Afrique depuis l'étranger. » | `concept.intro` |
| 2 | Deux freins, deux réponses | « Vous ne rencontrez les promoteurs qu'une fois par an. » → « Le Café : un promoteur et un banquier, chaque mois, près de chez vous. » · « Vous ne connaissez pas le parcours bancaire. » → « Un conseiller, six étapes claires, un dossier suivi en ligne. » | `concept.answers` |
| 3 | Comment ça marche | Les six étapes (EDI-011). | `concept.steps` |
| 4 | Nos services | Les sept services de l'accueil (ACC-070), mêmes règles de masquage. | `home.services.items` |
| 5 | Accompagnement administratif et consulaire (ancre `#accompagnement`) | Texte libre. | `concept.support` |
| 6 | Chiffres clés | EDI-070. | `concept.keyFigures` |
| 7 | Témoignages | EDI-071. | — |
| 8 | Appel | EDI-004. | — |

Tant que `features.cafe` est faux, la première réponse de la section 2 est masquée.

**EDI-011** `[P1]` **Les six étapes**, telles que le client les vit (`00-cadre/01`, § 3) :

| # | Étape | Texte |
|---|---|---|
| 1 | Découverte des biens | Parcourez les programmes, simulez votre financement. — avec le Café (`features.cafe`) : « Parcourez les programmes, simulez votre financement, venez à un Café. » |
| 2 | Expression d'intérêt | Un formulaire simple, avec ou sans compte. |
| 3 | Qualification et mise en relation | Un conseiller vous rappelle sous 48 h ouvrées, précise votre projet et vous propose des biens. |
| 4 | Constitution du dossier | Vous déposez vos pièces en ligne ; nous les vérifions une à une. |
| 5 | Soumission à la banque | Nous présentons votre dossier aux banques partenaires et suivons leur réponse. |
| 6 | Octroi du crédit et acquisition | Accord de la banque, conditions, signature : vous êtes propriétaire. |

Sous le tableau, un paragraphe : « Réserver un bien : votre conseiller demande au promoteur de tenir le lot pour vous (une option, jusqu'à une date). Vous signez ensuite un contrat de réservation avec le promoteur, qui peut demander un acompte. Rien ne se verse à Diaspora Patrimoine. » (`00-cadre/01`, § 7).

Ces six libellés sont les mêmes que ceux du suivi dans l'espace client (ECL-020).

## 3. Financements (EP-10)

**EDI-020** `[P1]` Adresse `/financements`. Ancres : `#credit`, `#islamique`, `#expertise`, `#simulateurs`, `#parcours`, `#banques`, `#questions`.

| # | Section | Contenu |
|---|---|---|
| 1 | Titre et calcul express | À gauche : « Un crédit bancaire, » · « une vraie garantie » · « Crédit classique ou financement islamique, avec des revenus perçus à l'étranger, selon la banque et le dossier. » — tant que `features.islamicFinance` est faux : « Avec des revenus perçus à l'étranger, selon la banque et le dossier. » (ACC-090). À droite : le **calcul express** (EDI-023), ancre `#simulateurs`. |
| 2 | Deux façons de financer | Un sélecteur à deux onglets, « Crédit classique » · « Financement islamique » (`#credit`, `#islamique` ouvrent l'onglet ; sans `features.islamicFinance`, pas de sélecteur : le crédit classique seul, EDI-022). Sous l'onglet choisi : l'image de la carte correspondante de `home.financing.items` (`FeatureCard` Photo), sa phrase d'accroche et ses trois points (ACC-080), puis « En savoir plus », qui déplie le texte long (`financing.credit.body`, `financing.islamic.body`). Le changement d'onglet fait glisser le contenu (DSN-072). Dessous, une seule ligne, ancre `#expertise` : la photo du bloc `financing.expertise.photo` (média ; repli : la scène « Partenaire », DSN-076), « Un conseiller financier à vos côtés, du premier chiffre à l'accord de la banque. » et « En savoir plus » (`financing.expertise.body`). Les titres de la section 1 sont les blocs de l'accueil `home.financing.title1`, `.title2`, `.subtitle1`, `.subtitle2` et `home.financing.subtitleNoIslamic` (CMS-020) ; les libellés des onglets sont ceux des surtitres des cartes `home.financing.items`. Sous 768 px : le titre, puis la carte du calcul express, puis le sélecteur. |
| 3 | Le parcours de financement | Une **frise** horizontale des étapes 4 à 6 (EDI-011) : un rond numéroté, un titre, une phrase par étape ; la ligne qui les relie se trace quand la frise entre à l'écran (une fois). Dessous, repliée : « Voir les pièces généralement demandées » (EDI-021). Sur téléphone, la frise est verticale. |
| 4 | Banques partenaires | Logo et nom des banques `ACTIVE` et publiques, par `sortOrder`. Aucune : seule reste la phrase du bloc `financing.banks.intro` (« Nous travaillons avec des banques partenaires européennes et africaines. »). |
| 5 | Questions fréquentes | Emplacement `FINANCEMENTS` (`FaqPlacement`). |
| 6 | Mentions | TRV-023, TRV-024. |
| 7 | Appel | « Recevoir ma projection » et « Être rappelé » (replis : ACC-090). |

**EDI-021** `[P1]` **« Les pièces généralement demandées »** : la liste des libellés des pièces **obligatoires** du modèle de liste par défaut (`CLIENT_FILE`), regroupés par catégorie, sans les conditions. Dessous : « La liste exacte dépend de votre situation et de la banque. Elle vous est donnée dans votre espace. ». Elle se met à jour quand le modèle change.

**EDI-022** `[P1]` L'onglet et le contenu du financement islamique ne s'affichent que si `features.islamicFinance` est vrai ; sinon l'ancre `#islamique` n'existe pas, et **aucun lien du site n'y mène** (ACC-090). Leur contenu reste général (Q-012) : ce qu'est un financement sans intérêt, le principe de la marge, « proposé par certaines banques partenaires ». Aucun nom de montage ni de banque n'est avancé sans produit réel.

**EDI-023** `[P1]` **Calcul express** (EP-10, D-093). Une carte : « Combien pourriez-vous acheter ? » · deux curseurs doublés d'un champ (DEM-007) — « Votre apport » (de 0 à 300 000, par pas de 1 000 ; départ : 30 000) et « Mensualité confortable » (de 100 à 3 000 par mois, par pas de 10 ; départ : 500) · le résultat, en grand : « Budget estimé : {montant} », et dessous « dont {financement} de financement sur {durée} ». Le calcul est celui du barème indicatif (CAL-103), sans contrôle d'apport minimum, de montant minimum ni de revenus : le financement est le capital dont la mensualité constante (CAL-040) vaut la mensualité saisie, sur `maxDurationMonths` du barème ; le budget affiché est l'apport plus ce financement, **arrondi vers le bas** au palier de CAL-021 ; le financement affiché est le budget affiché moins l'apport (30 000 € + 500 € / mois → 74 051 € → « Budget estimé : 104 000 € », « dont 74 000 € de financement sur 25 ans »). Service indisponible : le message de SIM-008 dans la carte, sans chiffre. Il est fait par le serveur (`POST /public/simulations/quick`), 300 ms après le dernier mouvement ; le chiffre défile de l'ancienne valeur à la nouvelle (DSN-072). Sous le résultat : « Exemple indicatif, hors frais d'acquisition. » (SIM-005, SIM-009) et deux boutons : **« Affiner avec le simulateur »** → `/financements/simulateur-eligibilite?apport={apport}&mensualite={mensualité}` (étape 3 préremplie), et **« Voir les biens dans ce budget »** → `/programmes?priceMax={budget affiché}` (sans simulation enregistrée : CAT-035 ne s'applique pas). Le résultat recalculé est annoncé aux lecteurs d'écran comme en SIM-050. Le lien « Calculer mes mensualités » → EP-12 en mode « Je connais le montant à financer », prérempli avec le financement **calculé, non arrondi** (à l'euro : 74 051 €, et non les 74 000 € affichés) et la durée du barème (SIM-031) : la personne retrouve sa mensualité de 500,00 €, pas une autre (74 000 € donneraient 499,65 €). La réponse de `POST /public/simulations/quick` porte donc ce financement calculé (`financingComputed`) à côté du financement affiché. Quand EP-11 s'ouvre par « Affiner », avec `?apport=` et `?mensualite=`, un bandeau rappelle « Vous souhaitiez {m} / mois » au-dessus du résultat. Dessous, le lien « Quelles pièces la banque demandera ? » → `#parcours`. Rien n'est enregistré, aucune coordonnée n'est demandée.

## 4. Promoteurs (EP-08, EP-09)

**EDI-030** `[P1]` **Liste**, `/promoteurs`. Titre « Promoteurs sélectionnés ». Bloc `promoters.intro` : « Notre plateforme choisit les promoteurs et examine leurs références ainsi que les garanties de chaque programme. ». Bloc `promoters.selection` : « Comment nous sélectionnons » (texte libre, Q-003 ; masqué s'il est vide). Puis une carte par promoteur `ACTIVE` et public, par `sortOrder` puis par nom : une image (la couverture du promoteur, sinon celle de son dernier programme publié qui en a une ; aucune : un fond doux et l'icône d'immeuble), le logo posé sur son bord (sinon ses initiales en médaillon), nom affiché, région, « {n} programmes », « {n} programmes en vente » sur l'image quand il y en a, le début de `referencesPublic` ; toute la carte mène à la fiche (D-105). **Filtres** (dès deux promoteurs) : nom (sans tenir compte des accents), région (liste du site, avec le nombre de promoteurs), « Avec des biens en vente » ; appliqués par « Afficher » (D-102), gardés dans l'adresse (`q`, `region`, `vente=1`), « Effacer les filtres », le nombre de promoteurs trouvés ; aucun : « Aucun promoteur ne correspond à ces critères. ». **Pages de neuf** (`page`), avec la pagination du catalogue (CAT-055) et, sur téléphone, « Voir les promoteurs suivants ». Aucun promoteur public : « Nos premiers promoteurs partenaires seront bientôt présentés. ».

**EDI-031** `[P1]` **Fiche**, `/promoteurs/{slug}`. En tête, à côté du nom, une image : la couverture, sinon celle d'un de ses programmes (sinon le dessin) (D-105). Logo, nom, « Promoteur sélectionné depuis {année} », présentation (`descriptionPublic`), références (`referencesPublic`), faits : « Depuis {année de création} » · « {n} logements livrés » · « {n} programmes au catalogue » · « {n} programmes en vente » (chacun seulement s'il est renseigné). Puis ses programmes publiés, en cartes — d'abord les programmes en cours : états « En vente », « Tout est réservé » et « À venir », chacun avec sa pastille ; puis, sous le titre « Programmes réalisés », ceux dont l'état est « Vendu » (CYC-127) ; un programme « Retiré » n'y figure pas — et l'appel « Être rappelé » (DEM-015, sans paramètre de promoteur). Un promoteur qui n'est plus `ACTIVE` ou plus public répond `404`.

**EDI-032** `[P1]` Ne sont **jamais** publics : le site web, l'adresse, le téléphone et l'e-mail du promoteur, ses interlocuteurs, ses documents, ses conditions de commission (D-048). Le contact passe par Diaspora Patrimoine.

## 5. Nos partenaires (EP-17)

**EDI-035** `[P1]` Adresse `/nos-partenaires`. Trois groupes, chacun masqué s'il est vide : **Promoteurs** (les cartes et les filtres de `/promoteurs`, EDI-030, sans pagination) · **Banques** (banques publiques, en cartes : logo, sinon initiales en médaillon, nom, « Banque partenaire » ; les mêmes que sur Financements, `#banques`) · **Autres partenaires** (`Partner` publics, par catégorie : notaires, assureurs, institutions, médias ; logo, nom, présentation, lien vers leur site s'il est renseigné ; gérés dans le back-office, écran EA-47, CTL-170). Dès deux groupes, « Afficher » propose « Tous nos partenaires » et chaque groupe avec son nombre (`?groupe=promoteurs|banques|autres`) (D-105). Si les trois groupes sont vides : « Nos premiers partenaires seront bientôt présentés. ». Puis deux appels : « Vous êtes promoteur ou banque ? » · bouton « Créer mon espace partenaire » (EP-32) · lien « Déjà partenaire ? Se connecter » (EP-33) ; « Notaire, assureur, institution ? » · bouton « Devenir partenaire » `[P1]` (EP-23 ; repli : `/contact`).

## 6. Questions fréquentes (EP-18)

**EDI-040** `[P1]` Adresse `/faq`. Les questions publiées (`FaqItem`), groupées par catégorie, dans l'ordre : Acheter · Financement · Votre dossier · Le Café · La plateforme. Chaque question se déplie sur place ; une seule ouverte à la fois n'est **pas** imposé. Un champ « Rechercher une question » filtre la liste à la frappe, sans appel au serveur. Chaque question a une ancre (`#q-{slug}`, `FaqItem.slug`) : un lien direct l'ouvre. En bas : « Vous n'avez pas trouvé votre réponse ? » → `/contact`. Une question dont l'indicateur (`requiredFeature`) est faux n'est servie nulle part — ni ici, ni sur les autres pages —, quel que soit `isPublished`. Une catégorie sans question servie est masquée : ainsi « Le Café », tant que `features.cafe` est faux. Sur une page d'emplacement (Financements, Le Café, Notre concept), les questions de plusieurs catégories suivent le même ordre : catégorie, puis `sortOrder`.

Une même question peut apparaître sur d'autres pages selon ses **emplacements** (`FaqItem.placements`) : `FINANCEMENTS`, `LE_CAFE`, `NOTRE_CONCEPT`. Sur ces pages : six questions au plus, puis « Toutes les questions ».

**EDI-041** `[P1]` **Questions de départ**, à valider par Diaspora Patrimoine. « Publiée : non » = créée mais masquée, parce que sa réponse dépend d'une question ouverte. « Publiée : selon {indicateur} » = créée avec `isPublished = true` et `requiredFeature` égal à cet indicateur : elle paraît d'elle-même quand la fonction est activée, et disparaît si elle est coupée (EDI-040). Une réponse ne cite que ce qui est livré : quand une fonction `[P1]` est activée (visite 360°, suivi de chantier, Café), l'administrateur complète les réponses concernées — l'écran d'activation le lui rappelle (ADM-090).

| Catégorie | Question | Réponse | Publiée |
|---|---|---|---|
| Acheter | Qui peut acheter avec Diaspora Patrimoine ? | Toute personne qui souhaite acheter un bien immobilier neuf en Algérie, qu'elle vive à l'étranger ou sur place. La plateforme est pensée d'abord pour la diaspora : tout se fait à distance, avec un conseiller. | oui |
| Acheter | Comment sont choisis les promoteurs ? | Nous examinons les références de chaque promoteur et les garanties de chaque programme avant de le présenter. Seuls les promoteurs avec lesquels une convention est signée figurent sur la plateforme. | oui |
| Acheter | Puis-je visiter un bien sans me déplacer ? | Oui. Selon les programmes : photos, plans, vidéo, ou visite en visio avec votre conseiller. Un proche peut aussi visiter pour vous. | oui |
| Le Café | Dans quelle langue se passe un Café ? | En français ; les promoteurs et les banquiers présents parlent aussi l'arabe. Venez avec vos questions, dans la langue qui vous est la plus facile. | selon `features.cafe` |
| Acheter | Les prix sont-ils en euros ou en dinars ? | Le prix d'un bien est fixé par le promoteur en dinars algériens. Nous affichons son équivalent en euros, à titre indicatif, avec la date du taux utilisé. | oui |
| Acheter | Que signifie « sur plan » ? | Le bien est vendu avant ou pendant sa construction. La fiche indique la date de livraison prévue. | oui |
| Acheter | Combien coûte le service de Diaspora Patrimoine ? | À rédiger (Q-001, Q-002). | non |
| Acheter | Que se passe-t-il si le promoteur livre en retard ? | À rédiger (Q-014). | non |
| Acheter | Dois-je me déplacer pour signer ? | À rédiger (DP, JUR) : signature chez le notaire en Algérie, possibilité de procuration, documents à prévoir. | non |
| Financement | Puis-je obtenir un crédit en Algérie avec des revenus perçus à l'étranger ? | Des banques partenaires proposent des solutions pour des revenus perçus à l'étranger, selon la banque et le dossier. Le simulateur d'éligibilité vous donne une première estimation ; un conseiller l'affine avec vous. | oui |
| Financement | Qu'est-ce que le financement islamique ? | Un financement sans intérêt : la banque achète le bien et vous le revend avec une marge connue à l'avance, payée par mensualités. Il est proposé par certaines banques partenaires. | selon `features.islamicFinance` |
| Financement | Quel apport faut-il prévoir ? | L'apport demandé dépend de la banque et de votre dossier. Nos exemples sont calculés avec un apport de 20 %. | oui |
| Financement | Les simulateurs m'engagent-ils ? | Non. Ils donnent une estimation indicative et ne constituent pas une offre de crédit, qui relève de la banque. | oui |
| Financement | Quelles pièces devrai-je fournir ? | Une pièce d'identité, des justificatifs de domicile, de revenus et de situation professionnelle, des relevés de compte. La liste exacte dépend de votre situation ; elle vous est donnée dans votre espace. | oui |
| Votre dossier | Comment suivre l'avancement de mon dossier ? | Dans votre espace : l'étape en cours, les pièces attendues, les messages de votre conseiller. Nous vous écrivons par e-mail dès que vous avez quelque chose à faire, et à chaque grande étape : dossier complet, réponse de la banque, réservation. | oui |
| Votre dossier | Mes documents sont-ils en sécurité ? | Oui. Ils sont chiffrés, hébergés dans l'Union européenne et accessibles seulement à vous et à l'équipe qui suit votre dossier. Ils ne sont transmis à une banque ou à un promoteur qu'avec votre accord. | oui |
| Votre dossier | Puis-je acheter à deux ? | Oui. Un co-emprunteur peut être ajouté à votre dossier ; ses pièces se déposent dans le même espace. | oui |
| Votre dossier | Comment se passe la réservation d'un bien ? | Votre conseiller demande au promoteur de tenir le lot pour vous (une option, jusqu'à une date). Vous signez ensuite un contrat de réservation avec le promoteur, qui peut demander un acompte. Cet acompte se verse au promoteur, jamais à Diaspora Patrimoine ; votre espace en garde la trace, et dit ce qu'il devient si le projet s'arrête. | oui |
| Votre dossier | Que se passe-t-il si la banque ne donne pas suite ? | Votre conseiller étudie avec vous les autres solutions : une autre banque partenaire, un apport différent, un autre bien. | oui |
| Le Café | Qu'est-ce que Le Café ? | Une rencontre conviviale où un promoteur et un banquier répondent à vos questions. Vous venez avec votre projet, vous repartez avec une projection. | selon `features.cafe` |
| Le Café | Le Café est-il payant ? | Non. Il est gratuit, sur inscription. | selon `features.cafe` |
| Le Café | Où a lieu Le Café ? | À Paris et dans le Sud de la France, au moins une fois par mois. Le lieu exact vous est envoyé par e-mail à l'inscription. | selon `features.cafe` |
| Le Café | Puis-je venir accompagné ? | Oui, jusqu'à quatre personnes par inscription. | selon `features.cafe` |
| La plateforme | Faut-il créer un compte ? | Non pour découvrir les biens, simuler ou envoyer une demande. Oui pour suivre votre dossier et déposer vos pièces. | oui |
| La plateforme | Comment sont utilisées mes données ? | Uniquement pour traiter votre demande et suivre votre projet. Vous pouvez à tout moment les consulter, les corriger ou demander leur suppression, depuis votre espace ou en nous écrivant. | oui |

## 7. Contact (EP-19)

**EDI-050** `[P1]` Adresse `/contact`. À gauche, le formulaire (DEM-015). À droite, les coordonnées, chacune seulement si son paramètre est renseigné : téléphone (lien d'appel) · WhatsApp · e-mail · adresse postale · horaires (`contact.openingHoursLabel`) · réseaux sociaux. Puis, si `features.cafe` est vrai et qu'un Café est à venir : « Rencontrons-nous au prochain Café » avec sa date et son bouton. Aucune carte.

## 8. Pages légales (EP-24)

**EDI-060** `[P1]` Cinq pages, servies depuis `LegalDocument` : `/mentions-legales` (`LEGAL_NOTICE`), `/confidentialite` (`PRIVACY_POLICY`), `/conditions-generales` (`TERMS_OF_USE`), `/cookies` (`COOKIE_POLICY`), `/charte-partenaires` (`PARTNER_CHARTER`, liée depuis l'inscription partenaire, ACP-081). Chaque page affiche la version **en vigueur** (MOD-420) : son titre, « Version du {date d'effet} », son texte. Il y a toujours une version en vigueur : l'installation publie une version « 0.1 – projet » de chaque texte (PAR-083), affichée avec le bandeau « Version provisoire, en cours de validation » et non indexée ; tant qu'elle est en vigueur, le point « Textes légaux » de PAR-100 reste ouvert.

La page des mentions légales affiche d'office, au-dessus de son texte, l'identité de l'éditeur tirée des paramètres : raison sociale (`contact.legalName`), immatriculation (`contact.registration`), adresse (`contact.address`), contact (`contact.email`, `contact.phone`) — chacun seulement s'il est renseigné. On ne les recopie donc pas à la main dans le texte.

**EDI-061** `[P1]` La page `/cookies` se termine par le tableau des cookies et stockages réellement utilisés (NAV-051), **produit par le code**, et par le bouton « Gérer mes cookies ». La page `/confidentialite` se termine par le lien vers l'exercice des droits (client connecté : son espace, PRO-050 ; sinon : `/contact`).

## 9. Chiffres clés, témoignages

**EDI-070** `[P1]` **Chiffres clés** (bloc `concept.keyFigures`, liste de `{valeur, libellé}`) : affichés seulement si au moins **trois** sont renseignés (Q-025). Aucun chiffre n'est calculé ni inventé par la plateforme.

**EDI-071** `[P1]` **Témoignages** : ceux qui sont publiés, par `sortOrder` ; chacun exige la date de l'accord écrit de la personne (`consentAt`). Affichés seulement s'il y en a au moins **deux**. Présentation : la citation, « {Prénom N.} », la ville, « {T3 à Alger} », la photo si elle existe. Six au plus sur une page.
