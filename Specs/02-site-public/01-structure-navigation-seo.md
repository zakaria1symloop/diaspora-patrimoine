# Site public — structure, navigation, référencement

Le site public est l'application `web` : tout ce qu'on voit sans se connecter, plus l'espace client sous `/espace-client` (`03-espace-client/`). Les règles transverses (`00-cadre/04`) s'appliquent à toutes ses pages.

---

## 1. Plan du site

**NAV-001** `[P1]` Adresses, en français, sans préfixe de langue tant qu'une seule langue est active (TRV-006).

| Adresse | Page | Écran | Phase | Indexée |
|---|---|---|---|---|
| `/` | Accueil | EP-01 | P1 | oui |
| `/programmes` | Catalogue des biens | EP-02, EP-03 | P1 | oui (NAV-038) |
| `/programmes/{slug}` | Fiche d'un programme | EP-04 | P1 | oui |
| `/biens/{slug}` | Fiche d'un bien | EP-05, EP-06, EP-07 | P1 | oui |
| `/promoteurs` | Promoteurs sélectionnés | EP-08 | P1 | oui |
| `/promoteurs/{slug}` | Fiche d'un promoteur | EP-09 | P1 | oui |
| `/financements` | Financements | EP-10 | P1 | oui |
| `/financements/simulateur-eligibilite` | Simulateur d'éligibilité | EP-11 | P1 | oui |
| `/financements/simulateur-credit` | Simulateur de crédit | EP-12 | P1 | oui |
| `/le-cafe` | Le Café : prochaines dates | EP-13 | P1 | oui |
| `/le-cafe/{slug}` | Un Café et son inscription | EP-14 | P1 | oui |
| `/le-cafe/inscription/{jeton}` | Gérer mon inscription | EP-15 | P1 | non |
| `/notre-concept` | Notre concept | EP-16 | P1 | oui |
| `/nos-partenaires` | Nos partenaires | EP-17 | P1 | oui |
| `/faq` | Questions fréquentes | EP-18 | P1 | oui |
| `/contact` | Contact | EP-19 | P1 | oui |
| `/comparer` | Comparer jusqu'à trois biens | EP-31 | P1 | non |
| `/projection` | Recevez votre projection | EP-20 | P1 | oui |
| `/assistant` | Assistant de recherche | EP-22 | P1 | non |
| `/devenir-partenaire` | Devenir partenaire | EP-23 | P1 | oui |
| `/partenaires/inscription`, `/partenaires/connexion`, `/partenaires/mot-de-passe-oublie` | Espace partenaire : inscription, connexion, candidature | EP-32, EP-33 | P1 | non |
| `/mentions-legales`, `/confidentialite`, `/conditions-generales`, `/cookies` | Pages légales | EP-24 | P1 | oui |
| `/charte-partenaires` | Charte des partenaires (EDI-060, liée depuis l'inscription partenaire, ACP-081) | EP-24 | P1 | oui |
| `/favoris` | Mes favoris sans compte (SFA-021) | EC-41 (sans compte) | P1 | non |
| `/infos/{slug}` | Page libre créée par l'administrateur (EDI-002) | EP-24 | P1 | oui |
| `/enquete/{jeton}` | Répondre à une enquête | EP-25 | P1 | non |
| `/alertes/{jeton}`, `/alertes/{jeton}/arreter` | Confirmer, prolonger ou gérer une alerte ; l'arrêter (lien d'arrêt et désinscription à un clic, NOT-022) | EP-26 | P1 | non |
| `/preferences/{jeton}` | Préférences d'e-mail sans connexion | EP-27 | P1 | non |
| `/partage/{jeton}` | Téléchargement sécurisé d'un dossier (banque) | EP-28 | P1 | non |
| `/connexion`, `/inscription`, `/mot-de-passe-oublie` et pages à jeton | Compte | EC-01 à EC-08 | P1 | non |
| `/espace-client/…` | Espace client | EC-10 et suivants | P1 | non |

Fenêtres et panneaux sans adresse propre : filtres du catalogue (EP-03, un panneau à droite sur ordinateur, CAT-030), galerie plein écran (EP-06), formulaire d'intérêt (EP-07), demande de rappel (EP-21). Leur ouverture est portée par un paramètre d'adresse (`?filtres=1`, `?galerie=photos`, `?interet=1`, `?rappel=1`) : le lien se partage, et le bouton « Retour » ferme la fenêtre.

**NAV-002** `[P1]` `/biens` redirige vers `/programmes` (`301`). Une adresse terminée par `/` redirige vers la même sans `/` final. Les adresses sont en minuscules ; une adresse avec des majuscules redirige vers sa forme en minuscules — sauf les pages à jeton (`/alertes/{jeton}`, `/preferences/{jeton}`, `/le-cafe/inscription/{jeton}`, `/partage/{jeton}` et les liens des e-mails de compte), qui gardent la casse de leur jeton (D-097). Les jetons que la plateforme fabrique pour les liens envoyés — gestion d'une inscription au Café, alerte, préférences — sont de toute façon écrits en minuscules (CAF-030).

**NAV-003** `[P1]` Une page `[P1]` dont l'indicateur de fonctionnalité est faux répond `404` (PAR-010).

## 2. En-tête

**NAV-010** `[P1]` **Contenu**, conforme à la maquette validée (D-041) :
- à gauche : le mot-symbole « DIASPORA PATRIMOINE » et, dessous, « LA PLATEFORME DE L'IMMOBILIER NEUF EN AFRIQUE » ; l'ensemble est un lien vers l'accueil ;
- au centre : **Les biens** · **Promoteurs** · **Financements** · **LE CAFÉ** · **Notre concept** · **Nos partenaires** — « Les biens » (→ `/programmes`) est ajouté à la maquette validée (D-095) : sur ordinateur, le visiteur qui vient « voir des appartements » n'avait aucune entrée avant 2 600 px de défilement ;
- à droite : le bouton **Se connecter**.

« LE CAFÉ » est mis en valeur (capitales, doré). Destinations : `/programmes`, `/promoteurs`, `/financements`, `/le-cafe`, `/notre-concept`, `/nos-partenaires`, `/connexion`.

**NAV-011** `[P1]` L'entrée de la page courante est soulignée et porte `aria-current="page"`. Une fiche de promoteur active « Promoteurs » ; un simulateur active « Financements » ; la page d'un Café active « LE CAFÉ ».

**NAV-012** `[P1]` L'en-tête reste **collé** en haut de l'écran, à **une seule hauteur** : 80 px sur ordinateur (logo de 56 px, mot-symbole et devise ; de 1024 à 1279 px, logo de 48 px et mot-symbole seul), 72 px sous 1024 px. Rien n'y change de taille au défilement : dès que la page a défilé, il prend seulement son fond plein et son ombre (D-098) — un en-tête collé qui rétrécit change la hauteur de la page et fait sauter le défilement autour du seuil. Sur l'accueil, au-dessus du héros, son fond est transparent.

**NAV-013** `[P1]` **Visiteur connecté** (session client valide) : « Se connecter » devient **Mon espace**, avec une pastille quand il a des notifications non lues. « Mon espace » mène au tableau de bord ; à côté, un chevron — un bouton à lui, « Ouvrir le menu de mon espace » — ouvre le menu, au survol ou au clic (un clic après le survol le laisse ouvert) (D-107). Le menu : Tableau de bord · Messages · Mon dossier (s'il en a un) · Mon profil · Se déconnecter — chaque entrée seulement si sa page est livrée (`08-tracabilite/02`, § 4). « Messages » est là dès la livraison de l'espace client, comme dans son menu (ECL-001) : avant la messagerie, sa page `/espace-client/messages` est le formulaire « Écrire à mon conseiller » (MSG-021), une fonction livrée. Un membre du personnel connecté au back-office reste un visiteur anonyme sur le site public (ROL-004). La pastille et la présence de « Mon dossier » viennent de `GET /client/me`, qui rend aussi `unreadNotifications` et `hasDossier` (API-100).

**NAV-014** `[P1]` **Téléphone et tablette** (moins de 1024 px) : logo à gauche, bouton de menu à droite. Le menu s'ouvre en plein écran et liste, dans cet ordre : Les biens (→ `/programmes`, même libellé que l'en-tête, NAV-010) · Promoteurs · Financements · Le Café · Notre concept · Nos partenaires · Questions fréquentes · Contact, puis le bouton « Se connecter » (ou « Mon espace »), puis « Taille du texte » (TRV-123). Il se ferme par la croix, par Échap, ou en choisissant une entrée. Le défilement de la page est bloqué tant qu'il est ouvert.

**NAV-015** `[P1]` Tant que `features.cafe` est faux, l'entrée « LE CAFÉ » est absente de l'en-tête, du menu mobile et du pied de page.

**NAV-016** `[P1]` Premier élément de chaque page, visible au clavier seulement : le lien « Aller au contenu ».

## 3. Pied de page

**NAV-020** `[P1]` Contenu, d'après la maquette validée, complété des liens obligatoires :

| Zone | Contenu |
|---|---|
| Identité | Mot-symbole et devise. |
| Navigation | **Les biens** (`/programmes`, même libellé que l'en-tête, NAV-010) · Promoteurs · Financements · LE CAFÉ · Notre concept · Nos partenaires · **Simulateurs** (`/financements#simulateurs`) · **Questions fréquentes** · **Contact**. |
| Actions | Bouton « Je m'inscris au prochain café » (ACC-090 pour son repli) · lien « Un conseiller vous rappelle » (ouvre la demande de rappel, EP-21 ; repli : `/contact?objet=rappel`, ACC-090). |
| Coordonnées | `contact.email`, `contact.phone`, lien WhatsApp (`contact.whatsapp`), réseaux sociaux (`contact.social.*`) : chacun affiché seulement s'il est renseigné. Ligne « Le Café : à Paris et dans le Sud de la France » (bloc `footer.cafeLine`), seulement si `features.cafe` est vrai. |
| Légal | « © {année} {`contact.companyName`} » · Mentions légales · Confidentialité · Conditions générales · Cookies · « Gérer mes cookies » (rouvre le choix, NAV-050 ; absent si aucun service soumis au consentement n'est actif) · Espace partenaire (EP-33) · Devenir partenaire `[P1]`. |
| Confort | « Taille du texte » et ses trois niveaux (TRV-123), au-dessus de la ligne légale. |
| Note | « *Exemples chiffrés indicatifs et non contractuels. » (bloc `footer.note`), suivie de `legal.illustrationNote` si la page affiche au moins une image d'illustration. |

L'année est celle du jour, pas une valeur écrite dans le code.

**NAV-021** `[P1]` Le pied de page est le même sur toutes les pages publiques. Dans l'espace client, il est réduit à la ligne légale (le réglage « Taille du texte » y est dans la barre du haut, ECL-002).

## 4. Référencement et partage

**NAV-030** `[P1]` **Indexation générale.** Tant que `seo.allowIndexing` est faux, **toutes** les pages portent `noindex, nofollow` (balise et en-tête `X-Robots-Tag`) et `robots.txt` interdit tout. Hors production, c'est toujours le cas, quel que soit le paramètre.

**NAV-031** `[P1]` Quand l'indexation est ouverte : les pages « non » du tableau NAV-001 portent `noindex` et sont interdites dans `robots.txt`, avec `/api`. Une fiche de bien dont la disponibilité est `SOLD` reste indexée tant qu'elle est en ligne.

**NAV-032** `[P1]` **Titre et description.** Le champ `seoTitle` ou `seoDescription` de l'objet l'emporte s'il est renseigné. Sinon :

| Page | Titre (70 caractères au plus) | Description (160 au plus) |
|---|---|---|
| Accueil | « Immobilier neuf en Algérie pour la diaspora – Diaspora Patrimoine » (bloc `home.seoTitle`) | `seo.defaultDescription` |
| Catalogue | « Programmes neufs en Algérie – Diaspora Patrimoine » | « {n} biens neufs sélectionnés en Algérie : appartements, villas, duplex. Prix, mensualités et financement depuis l'étranger. » |
| Catalogue, une région | « Programmes neufs à {région} – Diaspora Patrimoine » | Idem, avec la région. |
| Catalogue, un type | « {Type au pluriel} en Algérie – Diaspora Patrimoine » (le nom du pays actif) | Idem, avec le type. |
| Catalogue, un type et une région | « {Type au pluriel} à {région} – Diaspora Patrimoine » | Idem. |
| Catalogue, plusieurs régions ou plusieurs types | Celui du catalogue sans filtre | Idem. |
| Fiche bien | « {titre} à {ville ou région} – {à partir de }{prix} » | « {Type} {T}{pièces} de {surface} m² à {ville} ({région}), {livraison}. À partir de {prix}. Promoteur sélectionné, financement possible depuis l'étranger. » |
| Fiche programme | « {nom} à {région} – programme neuf » | Les 155 premiers caractères de la description, coupés à un mot. |
| Promoteur | « {nom} – promoteur sélectionné – Diaspora Patrimoine » | `referencesPublic`, sinon le début de la description. |
| Un Café | « Le Café à {lieu}, {date longue} – Diaspora Patrimoine » | « Rencontrez promoteur et banquier autour d'un café, {date}, {lieu}. Gratuit, sur inscription. » |
| Page éditoriale | `title` + « – Diaspora Patrimoine » | Le début du texte. |

Un titre trop long est coupé à un mot, sans points de suspension. « {Type au pluriel} » est le libellé pluriel du type, adjectif compris (« Villas neuves », `01-domaine/01`, § 3.4). Sur une fiche de bien, « à partir de » — dans le titre comme dans la description — ne figure que si les lots disponibles n'ont pas tous le même prix (CAT-040, ligne 8) ; sinon, la description dit « Prix : {prix}. ». Pour un bien sans ville — elle est facultative (CYC-120) —, « à {ville} ({région}) » devient « à {région} ». Les prix d'un titre sont dans la devise de référence, arrondis (CAL-021). Dans ce tableau, « Diaspora Patrimoine » est la valeur du paramètre `seo.siteName`, et le mot « mensualités » de la description du catalogue n'y figure que si `features.monthlyBudgetSearch` est vrai.

**NAV-033** `[P1]` Chaque page indexée porte une adresse **canonique** absolue, sans paramètre de suivi (`utm_*`, `gclid`, `fbclid`) ni paramètre de fenêtre (NAV-001).

**NAV-034** `[P1]` **Plan du site.** `/sitemap.xml` est un index qui renvoie vers un fichier par famille : `/sitemaps/pages.xml`, `/sitemaps/biens.xml`, `/sitemaps/programmes.xml`, `/sitemaps/promoteurs.xml`, `/sitemaps/cafes.xml`. Chaque fichier ne liste que les objets **publiés**, avec `lastmod` ; les pages fixes du site (accueil, catalogue, pages éditoriales construites par le code) y figurent sans `lastmod`, faute de date de modification. Les biens sont exactement ceux que montre le catalogue. Les fichiers sont construits par `web` d'après `GET /public/sitemap` (API-100). Régénéré quand un objet est publié, dépublié ou modifié ; servi depuis un cache d'une heure au plus.

**NAV-035** `[P1]` **Données structurées** (JSON-LD) :

| Page | Types |
|---|---|
| Toutes | `Organization` : nom (`contact.companyName`), logo, adresse du site, réseaux sociaux (`contact.social.*`, en `sameAs`), point de contact (`contact.phone`, `contact.email`) — chaque élément seulement s'il est renseigné |
| Accueil | `WebSite`, avec l'action de recherche vers `/programmes?q=` |
| Fiches bien, programme, promoteur, Café | `BreadcrumbList` |
| Fiche bien | `RealEstateListing` : nom, description, image, date de publication ; `offers` → `Offer` avec le prix « à partir de » **dans la devise du bien**, et la disponibilité : `InStock` (`AVAILABLE`) · `LimitedAvailability` quand la carte porte une étiquette de rareté (CAT-041) · `OutOfStock` (`RESERVED`) · `SoldOut` (`SOLD`) · `Discontinued` (`WITHDRAWN` : sans prix). Lieu : ville et région seulement (TRV-045). |
| Un Café | `Event` : nom, dates avec fuseau, mode présentiel, lieu limité à la **ville**, organisateur, offre gratuite — disponibilité `SoldOut` quand le Café est complet —, statut (`EventScheduled`, `EventCancelled`). `EventRescheduled` n'est pas émis : le modèle public n'a pas d'état « reporté » (D-097). |
| FAQ | `FAQPage` avec les questions publiées de la page. |

Aucune donnée structurée ne contient une mensualité : une mensualité est une estimation, pas un prix.

**NAV-036** `[P1]` **Partage.** Chaque page indexée fournit `og:title`, `og:description`, `og:url`, `og:type`, `og:locale` (`fr_FR`), `og:site_name` (`seo.siteName`), `og:image` (1200 × 630) et la carte Twitter grand format. Image : la déclinaison `og` de la photo de couverture ; à défaut, l'image de marque (bloc `brand.shareImage`). Pour une fiche de bien, le titre partagé est « {titre} – {prix} ».

**NAV-037** `[P1]` **Bouton « Partager »** (fiches bien et programme, page d'un Café) : sur téléphone, la feuille de partage du système ; ailleurs, un menu : Copier le lien · WhatsApp · E-mail · Facebook. Le lien partagé est l'adresse canonique. « Lien copié. » confirme la copie. La page du comparateur (EP-31) a aussi son bouton « Partager » : le lien est l'adresse courante avec ses références (CAT-092) — la page est faite pour être envoyée à un proche. « E-mail » se déplie en plusieurs façons d'écrire : « Mon application de messagerie » (lien `mailto:`, qui ne fait rien sur un ordinateur sans application configurée — d'où les autres) et les messageries lues dans le navigateur (Gmail, Outlook, Yahoo Mail), chacune ouverte sur un nouveau message déjà rempli : le titre en objet, le titre et le lien dans le corps.

**NAV-038** `[P1]` **Catalogue filtré.** Sont indexables : le catalogue sans filtre ; avec une **région** seule ; avec un **type** seul ; avec une région et un type. Toute autre combinaison (budget, surface, tri, pagination au-delà de la page 1…) porte `noindex, follow` et une adresse canonique qui pointe vers la combinaison indexable la plus proche. Les paramètres d'une adresse canonique sont rangés dans un ordre fixe (`region`, `type`).

**NAV-039** `[P1]` **Fil d'Ariane** sur les fiches : « Programmes › {région} › {programme} › {bien} » ; « Promoteurs › {nom} » ; « Le Café › {lieu, date} ». Chaque niveau est un lien, sauf le dernier. Le niveau « région » mène au catalogue filtré.

**NAV-040** `[P1]` **Redirections.** Dans l'ordre : (1) table `Redirect` (adresses saisies par l'administrateur) ; (2) historique des slugs (`SlugHistory`) → `301` vers l'adresse actuelle ; (3) sinon `404`. Une chaîne de redirections est résolue côté serveur : le visiteur ne reçoit qu'une redirection.

**NAV-041** `[P1]` **Objet non publié.** Brouillon ou jamais publié → `404`. Bien archivé → `410` avec la page de FIC-090. Programme archivé → `410` (TRV-084). Café passé → la page reste en ligne 30 jours avec « Ce Café a eu lieu », puis `410` avec les prochains Cafés. **Rendu** (D-097) : les pages de `web` étant envoyées en flux, leur statut est fixé avant que la donnée soit lue ; une page « disparue » (`410`) — bien, programme ou Café archivé, page à jeton dont le lien n'est plus valable — est donc servie avec le statut `200` et `noindex`, son contenu restant celui de la page `410`. Il en va de même d'une page introuvable de l'espace client (un dossier qui n'existe pas). Le `410` reste celui de l'API.

**NAV-042** `[P1]` **Rendu.** Les pages publiques sont rendues par le serveur et mises en cache. Le cache d'une page est **invalidé** dès qu'une donnée qu'elle affiche change (publication, prix, disponibilité, contenu, paramètre d'affichage) : c'est la « revalidation » citée dans les cycles de vie. Délai visé entre un changement dans le back-office et son apparition sur le site : moins d'une minute. Ce qui dépend **de la date du jour** et non d'une donnée — l'étiquette « Nouveau », une étiquette à durée limitée, une livraison devenue « en cours de confirmation », l'année du titre de l'accueil — est rafraîchi chaque nuit par la tâche `catalogue.nightly`, qui revalide les pages concernées (AUT-081). Les compteurs sensibles (places restantes d'un Café) sont relus à chaque affichage et **toujours revérifiés** par le serveur au moment de l'action.

**NAV-043** `[V2]` Quand plusieurs langues sont actives : balises `hreflang` entre les versions d'une même page, et un plan du site par langue.

## 5. Cookies et mesure d'audience

**NAV-050** `[P1]` **Choix du visiteur.** Si au moins un service soumis au consentement est actif (`analytics.enabled`), un bandeau (EP-30) s'affiche à la première visite, en bas de l'écran, sans bloquer la lecture :

> « Nous utilisons des cookies pour mesurer l'audience du site et l'améliorer. Vous pouvez accepter, refuser, ou choisir. »
> **Tout refuser** · **Personnaliser** · **Tout accepter**

Les trois boutons ont le même poids visuel. Aucun service soumis au consentement n'est chargé avant un « oui ». **Un seul élément fixe en bas de l'écran à la fois** (D-095) : le bandeau des cookies passe avant la barre d'action d'une page (FIC-053, FIC-112, CAF-061, ACC-100) et le bac de comparaison (CAT-092) ; tant qu'il est ouvert, les autres sont masqués ; sur téléphone, le bac devient une pastille « Comparer ({n}) » dans la barre d'action. Le choix est gardé 6 mois (cookie `dp_consent`), puis redemandé. « Gérer mes cookies », dans le pied de page, rouvre le choix à tout moment. Si aucun service soumis au consentement n'est actif, **aucun bandeau** n'est affiché.

**« Personnaliser »** ouvre une fenêtre à deux lignes : « Nécessaires » — toujours actifs, avec le lien vers leur liste (page `/cookies`, EDI-061) — et « Mesure d'audience », une bascule éteinte par défaut, avec une phrase : « Compter les visites et comprendre ce qui est utile, sans vous identifier. ». Boutons : « Enregistrer mes choix » · « Tout refuser » · « Tout accepter ». Fermer la fenêtre sans choisir ne vaut ni accord ni refus : le bandeau reste.

**NAV-051** `[P1]` **Ce qui est déposé sans consentement**, parce que le service demandé en dépend :

| Nom | Rôle | Durée |
|---|---|---|
| Cookie de session (`HttpOnly`) | Connexion à l'espace client | SEC-020 |
| `dp_consent` | Mémoriser le choix sur les cookies | 6 mois |
| `dp_anon` | Retrouver ses simulations avant d'avoir un compte (`Simulation.anonymousId`). Déposé seulement quand le visiteur lance une simulation. | 30 jours |
| `dp_device` (`HttpOnly`) | Reconnaître un appareil déjà utilisé par un compte, pour ne prévenir que d'une connexion depuis un **nouvel** appareil (AUTH-033). Déposé à la première connexion réussie. Identifiant aléatoire, sans aucune caractéristique de l'appareil. | 13 mois |
| Jeton anti-falsification | Protéger les envois de formulaires d'un compte connecté (SEC-027). | La session |
| `dp_gate` (`HttpOnly`) | Garder l'accès réservé avant l'ouverture, et en recette (NAV-064). | 30 jours |
| `dp_share` (`HttpOnly`) | Garder ouvert, après le bon code, le dossier ou l'export d'un lien de partage (BNK-112). Déposé seulement après le bon code. | 30 minutes |
| `dp_signup` (`HttpOnly`) | Reconnaître le navigateur qui vient de créer un espace, pour que le lien de vérification y connecte sans redemander le mot de passe (AUTH-013). | 24 heures |
| Jeton d'étape (`HttpOnly`) | Tenir une connexion en cours entre deux étapes (AUTH-026). | 10 minutes |
| `locale` `[V2]` | Langue choisie | 12 mois |
| Stockage de session du navigateur | Saisies de formulaire en cours (TRV-092), long texte en cours (TRV-115), origine de la visite (NAV-053), réponses de l'assistant guidé (ASS-004), invitation des favoris déjà montrée (`dp_favorites_nudge`, SFA-021), critères d'une alerte en cours de modification (`dp_alert_edit`, SFA-031) | La session |
| Stockage local du navigateur | Réglages de confort demandés par l'utilisateur, sans donnée personnelle : `dp_text_size` (TRV-123), `dp_recent_searches` (TRV-109), `dp_tour_space` (TRV-126), `dp_seen_step_{dossier}` et `dp_celebrated_{moment}_{objet}` (DSN-072, DSN-073) | Jusqu'à ce que l'utilisateur les efface |
| `dp_compare` (stockage local du navigateur) | Les trois biens au plus mis de côté pour le comparateur (CAT-092) : des références de biens, rien d'autre. Écrit seulement quand le visiteur coche « Comparer ». | Jusqu'à ce que le visiteur retire les biens (« Tout retirer ») ou efface son navigateur |
| `dp_favorites` (stockage local du navigateur) | Les favoris d'un visiteur sans compte, vingt biens au plus (SFA-021) : des références de biens et leur date d'ajout, rien d'autre. Écrit seulement quand le visiteur touche un cœur ; rapatrié sur le compte à l'inscription ou à la connexion (`POST /client/favorites/merge`). | Jusqu'à ce que le visiteur retire ses favoris ou efface son navigateur |
| `dp_simple_mode` (stockage local du navigateur) | Retenir l'« Affichage simplifié » choisi dans le réglage « Aa » (TRV-122). | Jusqu'à ce que l'utilisateur le désactive ou efface son navigateur |

Aucun cookie publicitaire, aucun traceur de réseau social. Les vidéos externes (YouTube, Vimeo) sont chargées en mode sans cookie, et seulement après un clic sur leur vignette.

**NAV-052** `[P1]` **Mesure d'audience** (Q-033), après consentement seulement : pages vues, et les événements `search`, `view_property`, `open_interest_form`, `submit_lead` (avec la nature), `run_simulation` (avec le type), `cafe_register`. Aucune donnée personnelle n'est envoyée à l'outil : ni e-mail, ni nom, ni montant saisi. Le signal « Global Privacy Control » du navigateur vaut refus.

**NAV-053** `[P1]` **Origine de la visite.** À l'arrivée, le site note dans le stockage de session : les paramètres `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` s'ils existent, le **domaine** du site d'où vient le visiteur, et la première page vue. Ces valeurs sont jointes à toute demande envoyée pendant la session (`Lead.utm`, `referrer`, `landingPath`). Rien n'est gardé au-delà de la session ni envoyé sans demande.

## 6. Éléments communs

**NAV-060** `[P1]` **Contacter un conseiller.** Chaque page publique offre, sans défilement excessif, un chemin vers un humain (principe 5) : sur les fiches, la barre d'action ; ailleurs, le lien « Un conseiller vous rappelle » du pied de page et la page Contact. Un lien WhatsApp n'apparaît que si `contact.whatsapp` est renseigné.

**NAV-061** `[P1]` **Maintenance.** Quand `maintenance.enabled` est vrai, toutes les adresses publiques et de l'espace client répondent `503` avec la page de maintenance (TRV-084) et l'en-tête `Retry-After` ; les routes `/public`, `/auth` (audience client) et `/client` de l'API répondent `503 MAINTENANCE`. Le back-office et la page `/partage/{jeton}` restent accessibles, ainsi que les pages à jeton qui ne servent qu'à **arrêter** des envois (`/preferences/{jeton}`, désinscription d'une alerte) : on doit toujours pouvoir se désinscrire. Côté API, échappent donc à la maintenance : `/public/preferences/{jeton}`, `/public/unsubscribe/{jeton}`, l'arrêt d'une alerte (`DELETE /public/alerts/{jeton}`), `/public/shares`, `/public/health` — et `GET /public/settings/public`, que lit la page de maintenance pour afficher `maintenance.until` (D-097). Le `503 MAINTENANCE` porte `Retry-After: 600`.

**NAV-062** `[P1]` **Impression.** Les fiches de bien et de programme ont une feuille de style d'impression : pas d'en-tête ni de pied, une photo, les caractéristiques, le prix, la référence et l'adresse de la page.

**NAV-063** `[P1]` **Navigation au clavier et retour.** Revenir d'une fiche au catalogue par le bouton « Retour » restaure la position de défilement, les filtres et la page de résultats.

**NAV-064** `[P1]` **Porte d'accès : avant l'ouverture au public, et en recette.** Une seule porte, commandée par la variable `SITE_GATE_PASSWORD` (ENV-040) : elle est fermée sur tout environnement où cette variable est définie — toujours en recette, et en production tant que le site n'est pas ouvert (ENV-054).

- **Ce que voit le visiteur.** Toute adresse du site public, des pages de compte et de l'espace client affiche la **page d'attente** (EP-29) : le logo et le mot-symbole, « Notre plateforme ouvre bientôt. », l'adresse de contact si elle est renseignée (D-045), et le lien discret « Accès réservé ». La page répond `200`, porte `noindex`, et `robots.txt` interdit tout.
- **Accès réservé.** Le lien demande le mot de passe ; une fois saisi, un cookie signé (`dp_gate`, `HttpOnly`, 30 jours) ouvre le site sur cet appareil, et le visiteur arrive sur **l'adresse qu'il demandait** — un lien d'activation ou de vérification reçu par e-mail continue donc son chemin après la porte. Cinq mots de passe faux en dix minutes bloquent l'accès réservé pendant quinze minutes pour cette adresse IP (SEC-070).
- **Saisie.** Titre « Accès réservé » · champ « Mot de passe » (type mot de passe, `autocomplete="current-password"`) · bouton « Entrer ». `POST /public/gate` : corps `{password}`, sans clé d'idempotence ; succès : `204` et le cookie ; mot de passe faux : `401 GATE_PASSWORD_INVALID`, message sous le champ ; au-delà de la limite : `429 RATE_LIMITED` avec `Retry-After`, et l'écran affiche « Trop de tentatives. Réessayez dans {n} minutes. » ({n} d'après `Retry-After`) à la place des messages de TRV-110. Le champ n'est jamais prérempli ni conservé (TRV-092).
- **L'API suit la porte.** Sans le cookie, les routes `/public`, `/auth` (audience client) et `/client` répondent `403 GATE_CLOSED` : aucun formulaire ne peut être envoyé, aucune donnée lue, par un script qui contournerait les pages. Exceptions : la route de la porte elle-même (`POST /public/gate`, qui pose le cookie), `GET /public/settings/public` (la page d'attente affiche `contact.email`, D-045 ; ces clés sont publiques par construction, PAR-101 — D-097), `/public/shares` (une banque télécharge un dossier), `/hooks`, et le contrôle de santé (`/public/health`, API-100). Les routes `/auth` appelées depuis le back-office (audience `ADMIN`) ne sont pas concernées.
- **Ne sont pas concernés** : le back-office, la page `/partage/{jeton}`.
- **À la première livraison**, aucune page n'existe encore derrière la porte : la page d'attente est seule, **sans** le lien « Accès réservé ». Le lien et la saisie du mot de passe arrivent avec la structure du site (paquet 2.1).
- **Avec la maintenance** (NAV-061) : la page d'attente passe avant ; seul un visiteur qui a franchi la porte voit la page de maintenance.
- **Ouverture** : retirer `SITE_GATE_PASSWORD` en production. La page d'attente disparaît au redémarrage des instances, sans nouvelle version.

En recette, un bandeau discret « RECETTE » rappelle l'environnement une fois la porte franchie (ENV-030).
