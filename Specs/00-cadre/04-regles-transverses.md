# Règles transverses

Ces règles valent pour **tous** les écrans et toutes les routes, sur le web comme sur le mobile. Un fichier de module ne les répète pas : il ne mentionne que ses exceptions.

---

## 1. Langues et traduction

**TRV-001** `[P1]` La Phase 1 est en **français** uniquement. Aucun sélecteur de langue n'est affiché tant qu'une seule langue est active (paramètre `i18n.activeLocales`, par défaut `["fr"]`).

**TRV-002** `[P1]` Aucun texte visible n'est écrit dans le code. Tout passe par des fichiers de traduction, avec les clés de `07-design/03-microcopie.md`. Cela vaut pour les écrans, les e-mails, les notifications, les messages d'erreur, les PDF.

**TRV-003** `[P1]` Les langues prévues sont `fr`, `ar`, `en`. Le code est prêt pour l'écriture de droite à gauche : mise en page avec des propriétés logiques (`margin-inline-start`, `padding-inline-end`…), jamais `left` / `right` ; icônes directionnelles (flèches, chevrons) retournées en `ar` ; attribut `dir` posé sur la racine d'après la langue.

**TRV-004** `[P1]` Les contenus saisis dans le back-office (nom et description d'un programme, question de FAQ…) sont en français dans les colonnes principales. Leur traduction se range dans la table `Translation` (`01-domaine/05`) — sauf les modèles d'e-mail, qui ont une ligne par langue (`EmailTemplate.locale`). À l'affichage : traduction de la langue demandée si elle existe, sinon le français. `[V2]` Écrans de traduction dans le back-office.

**TRV-005** `[P1]` La langue d'un e-mail ou d'une notification est celle du destinataire (`User.locale`, sinon `Client.preferredLanguage`, sinon `fr`), jamais celle de l'expéditeur.

**TRV-006** `[V2]` Quand plusieurs langues sont actives : la langue est portée par un préfixe d'adresse (`/ar/…`, `/en/…`) ; le français n'a pas de préfixe. Le premier affichage suit l'en-tête `Accept-Language` ; le choix de l'utilisateur est mémorisé (cookie `locale`, puis `User.locale`).

## 2. Typographie des textes français

**TRV-010** `[P1]` Les textes d'interface suivent la typographie française :
- apostrophe typographique `’` (jamais `'`) ;
- guillemets `« »` avec espaces insécables à l'intérieur ;
- espace insécable avant `:` `;` `?` `!` `%` `€` et entre un nombre et son unité (`85 m²`, `48 h`, `20 %`) ;
- tiret demi-cadratin `–` pour les intervalles (`10 h – 13 h`, `2026 – 2027`) ;
- majuscules accentuées (`À`, `É`, `Ç`) ;
- pas de point à la fin d'un titre, d'un bouton, d'une étiquette.

**TRV-011** `[P1]` Les boutons commencent par un verbe à l'infinitif ou à la première personne quand l'action engage l'utilisateur (« Rechercher », « Je m'inscris », « Recevoir ma projection »). On s'adresse à l'utilisateur au **vous**.

**TRV-012** `[P1]` Majuscule en début de phrase et aux noms propres seulement. Pas de Majuscule À Chaque Mot. Les surtitres en capitales sont mis en capitales par le style, pas dans le texte source.

## 3. Formats

**TRV-020** `[P1]` Les nombres, montants, dates et heures sont formatés par les API de localisation du langage (`Intl` en JavaScript, `intl` en Dart) avec la langue active, jamais à la main.

### 3.1 Nombres et montants

| Donnée | Format (`fr`) | Exemple |
|---|---|---|
| Entier | séparateur de milliers insécable | `12 500` |
| Décimal | virgule | `85,5` |
| Prix d'un bien, apport, capacité | sans décimale, devise après | `150 000 €`, `22 275 000 DA` |
| Mensualité sur une carte ou une liste | sans décimale | `810 € / mois` |
| Montants d'un simulateur (détail, échéancier) | deux décimales | `412,37 €` |
| Pourcentage | zéro à deux décimales, sans zéros inutiles | `20 %`, `5,5 %`, `33,33 %` |
| Taux ou marge | deux décimales | `5,50 %` |
| Surface | sans décimale si entière, une décimale sinon | `85 m²`, `62,5 m²` |
| Prix au mètre carré | sans décimale ; arrondi à la dizaine quand il est converti (CAL-024) | `1 760 € / m²` |
| Grand nombre abrégé (filtres, graphiques) | `k`, `M` | `250 k€`, `8 M DA` |

**TRV-021** `[P1]` Symboles de devise : `€` pour EUR, `DA` pour DZD, `$` pour USD, `$ CA` pour CAD, `£` pour GBP, `CHF` pour CHF. Pour toute autre devise, le code ISO (`MAD`, `TND`, `XOF`). Le symbole suit le nombre, séparé par une espace insécable.

**TRV-022** `[P1]` Un montant **converti** dans une autre devise que celle du bien est précédé de `≈` sur les fiches et dans les simulateurs, et la date du taux est indiquée une fois par écran : « Taux indicatif du 12/09/2026 ». Sur les cartes et l'accueil, pour rester fidèle à la maquette validée, le `≈` n'est pas affiché ; la note de bas de section porte la mention « Prix convertis à titre indicatif » (paramètre `legal.convertedPricesNote`). Dans l'espace client, les e-mails et les PDF, la règle est celle des fiches : `≈` devant le montant converti, et la date du taux une fois par écran ou par document. Un montant affiché dans **sa** devise d'origine (le prix d'un lot en dinars, un résultat de simulateur calculé sans conversion) ne porte jamais `≈`. Règles d'arrondi : `01-domaine/07`, CAL-020 à CAL-028.

**TRV-023** `[P1]` Toute **mensualité estimée** porte un astérisque et renvoie à une note sur le même écran. Texte de la note par défaut : « *Exemple indicatif et non contractuel : mensualité hors assurance, selon la banque, la durée et le dossier. » (paramètre `legal.monthlyFootnote`). Ce texte est le même partout : cartes, accueil, fiches, simulateurs, e-mails, PDF. Il accepte trois champs, remplacés par les hypothèses **du calcul que la note accompagne** quand l'administrateur les y place — celles du financement de référence sous une carte ou une fiche ; celles de la simulation sous un résultat de simulateur et dans son PDF ; celles de la projection dans la sienne. Sous le comparatif de l'accueil, qui a deux scénarios, les trois champs sont retirés de la note : les hypothèses de chaque colonne s'écrivent sous le bloc (ACC-042) — : `{apport}` (une part du prix, « 20 % », ou un montant quand le calcul en porte un, « 30 000 € »), `{durée}` (« 25 ans »), `{taux}` (« 5,50 % ») — pour pouvoir afficher les hypothèses si le conseil juridique le demande (Q-010). Quand le calcul ne porte pas l'une de ces valeurs — pas d'apport dans le mode « Je connais le montant à financer » —, c'est la valeur par défaut du paramètre, sans champ, qui s'affiche.

**TRV-024** `[P1]` Tout écran qui affiche un résultat de simulateur affiche la mention : « Les simulateurs fournissent une estimation indicative et ne constituent pas une offre de crédit, laquelle relève exclusivement de la banque. » (paramètre `legal.simulatorDisclaimer`).

**TRV-025** `[P1]` Une valeur absente s'affiche `—` dans un tableau et la ligne ou la tuile est **masquée** sur une fiche publique. Jamais `null`, `undefined`, `NaN`, `0` par défaut, ni une étiquette sans valeur.

**TRV-026** `[P1]` **Saisie d'un montant.** Le champ accepte les chiffres, les espaces, l'apostrophe, la virgule et le point. La même lecture vaut pour un champ d'écran et pour une colonne d'import (CTL-100) :

| Saisie | Lecture | Exemples |
|---|---|---|
| Espaces (simples ou insécables), apostrophes | Séparateurs de milliers, ignorés | `150 000` → 150 000 · `1'500` → 1 500 |
| Un point **et** une virgule | Le dernier des deux est le séparateur décimal, l'autre un séparateur de milliers | `1.250,50` → 1 250,50 · `1,250.50` → 1 250,50 |
| Le même séparateur plusieurs fois | Séparateurs de milliers | `22.350.000` → 22 350 000 |
| Un seul séparateur suivi d'**exactement trois** chiffres | Séparateur de milliers (aucun montant n'a trois décimales) | `150,000` → 150 000 · `1.500` → 1 500 |
| Un seul séparateur suivi d'un ou deux chiffres | Séparateur décimal | `825,5` → 825,50 · `99.99` → 99,99 |
| Autre chose (lettres, signe moins, plus de deux décimales après le séparateur décimal) | Refus : « Saisissez un montant, par exemple 150 000. » | |

À la sortie du champ, la valeur est **reformatée** dans la langue de l'écran : la personne voit ce qui a été compris avant d'envoyer. Les valeurs négatives sont refusées. Maximum : 12 chiffres avant la virgule (`Decimal(14,2)`) ; chaque champ a en plus ses propres bornes. Un montant voyage dans l'API sous forme de **texte décimal** (`"22350000.00"`), jamais de nombre flottant (API-002). Un **cours de change** et un **taux** ne sont pas des montants : leurs champs ont leur propre lecture (BNK-061, BNK-021).

### 3.2 Dates et heures

| Usage | Format (`fr`) | Exemple |
|---|---|---|
| Date longue (pages publiques, e-mails) | jour de semaine, jour, mois, année | `samedi 17 octobre 2026` |
| Date moyenne (cartes, listes client) | jour, mois abrégé, année | `17 oct. 2026` |
| Date courte (tableaux du back-office) | `JJ/MM/AAAA` | `17/10/2026` |
| Date et heure (back-office) | `JJ/MM/AAAA HH:mm` | `17/10/2026 14:05` |
| Heure (pages publiques, e-mails) | `H h` ou `H h mm` | `10 h`, `18 h 30` |
| Plage horaire | avec « de … à … » ou un tiret demi-cadratin | `de 10 h à 13 h`, `10 h – 13 h` |
| Mois et année (livraison) | mois en lettres | `juin 2027` |
| Trimestre (livraison) | `T` + numéro | `T2 2027` |
| Durée d'un prêt | années, ou années et mois | `25 ans`, `12 ans et 6 mois` |

**TRV-030** `[P1]` **Dates relatives.** Dans les fils et les listes : « à l'instant » (moins d'une minute), « il y a 12 min », « il y a 3 h », « hier », « il y a 4 jours ». Au-delà de 7 jours, la date moyenne. La date exacte est toujours disponible au survol et pour les lecteurs d'écran.

**TRV-031** `[P1]` Toutes les dates sont **stockées en UTC**. L'affichage dépend du contexte :
- espace client et e-mails au client : fuseau du client (`Client.timezone` : celui de son compte, sinon de sa dernière demande, sinon le fuseau principal de son pays de résidence — un seul ordre, fixé par le modèle ; inconnu : le fuseau du calendrier de travail) ; dans un e-mail, toute heure est suivie de son fuseau en clair (« 18 h 30, heure de Paris ») ;
- back-office : fuseau du membre du personnel (`User.timezone`, par défaut `Europe/Paris`) ;
- l'**échéance d'une option** (`Reservation.optionExpiresAt`) : une date sans heure, celle du pays du bien, montrée telle quelle partout (CYC-105) ;
- un **Café** : toujours dans le fuseau du lieu (`Event.timezone`), suivi de la mention « (heure de Paris) » ou équivalent quand le fuseau de l'utilisateur est différent ;
- un **rendez-vous à distance** (appel, visio) : dans le fuseau du client, avec le fuseau du conseiller en complément s'il diffère (« 18 h 30, heure de Paris · 17 h 30 à Alger ») ;
- un **rendez-vous sur place** (visite d'un bien, rencontre) : d'abord dans le fuseau **du lieu** (`Appointment.placeTimezone`), puis dans celui du client s'il diffère (« 10 h 00, heure d'Alger · 11 h 00 à Paris ») : celui qui se déplace lit l'heure du lieu.

**TRV-032** `[P1]` Une **échéance** montrée au client est une date sans heure (« avant le 10 octobre »). Elle expire à la fin de ce jour dans le fuseau du client. Exception : l'échéance d'une option, qui expire à la fin du jour dans le fuseau du pays du bien et se montre partout sans conversion (CYC-105).

**TRV-033** `[P1]` Les délais internes exprimés en **heures ouvrées** ou en **jours ouvrés** suivent le calendrier de travail des paramètres (`business.calendar.*`). Calcul : `01-domaine/07`, CAL-060.

### 3.3 Téléphones, noms, adresses

**TRV-040** `[P1]` Un numéro de téléphone est saisi avec un **sélecteur de pays** (drapeau et indicatif). Pays présélectionné : le pays de résidence connu, sinon la France (`+33`). Il est validé avec la bibliothèque `libphonenumber` et stocké au format E.164 (`+33612345678`). Il est affiché au format international (`+33 6 12 34 56 78`).

**TRV-041** `[P1]` Un numéro affiché est cliquable : lien `tel:`. Un lien WhatsApp a la forme `https://wa.me/<numéro sans +>` avec, quand c'est utile, un texte prérempli (référence du bien).

**TRV-042** `[P1]` Prénom et nom : 1 à 80 caractères ; lettres de tout alphabet, espaces, tirets, apostrophes, points. Les espaces en début et en fin sont retirés, les espaces multiples réduits à un seul. La casse saisie est conservée. Affichage : « Prénom Nom » ; dans les tableaux triés par nom : « NOM Prénom ».

**TRV-043** `[P1]` Adresse e-mail : 254 caractères au plus ; retirée de ses espaces et **mise en minuscules** avant stockage et comparaison. Validation de forme à la saisie. Une vérification du domaine (enregistrement MX) est faite pendant l'envoi, en 500 ms au plus (elle compte dans le score de DEM-031) ; sans réponse dans ce délai, elle est refaite en arrière-plan. Un domaine sans MX ne bloque pas l'envoi du formulaire mais marque le client « e-mail douteux » dans le back-office.

**TRV-044** `[P1]` Pays : liste ISO 3166, nom dans la langue active, triée par ordre alphabétique après un groupe de pays fréquents (paramètre `display.frequentCountries`, par défaut : France, Belgique, Suisse, Canada, Allemagne, Royaume-Uni, Espagne, Italie, États-Unis, Émirats arabes unis, Algérie).

**TRV-045** `[P1]` L'**adresse exacte** d'un bien ou d'un programme n'est jamais publique. Le public voit la ville et la région ; la carte est centrée sur un point approximatif (`02-site-public/04`, FIC-060). Le lieu exact d'un Café n'est communiqué qu'aux inscrits.

## 4. Identifiants et références

**TRV-050** `[P1]` Chaque enregistrement a un identifiant technique `id` (UUID version 7), hors les exceptions de MOD-003. Il n'est jamais montré à un client. Il peut apparaître dans les adresses du back-office.

**TRV-051** `[P1]` Les objets que l'on cite à l'oral ou par écrit portent une **référence lisible**, unique et définitive :

| Objet | Format | Exemple |
|---|---|---|
| Bien | `DP-{pays}-{numéro sur 4 chiffres ou plus}` | `DP-DZ-0142` |
| Demande | `DEM-{année}-{numéro sur 5 chiffres}` | `DEM-2026-00231` |
| Dossier | `DOS-{année}-{numéro sur 4 chiffres}` | `DOS-2026-0042` |
| Soumission bancaire | `SOU-{année}-{numéro sur 4 chiffres}` | `SOU-2026-0017` |
| Réservation | `RES-{année}-{numéro sur 4 chiffres}` | `RES-2026-0009` |
| Café | `CAF-{année}-{mois}-{code du lieu}` + suffixe si doublon | `CAF-2026-10-PAR` |
| Demande d'exercice de droits | `RGPD-{année}-{numéro sur 4 chiffres}` | `RGPD-2026-0003` |

Les numéros sont attribués par une séquence par type et par année, sans trou visible pour l'utilisateur ni réutilisation (`06-technique/04`, FIA-030).

**TRV-052** `[P1]` Les adresses publiques utilisent des **slugs** : minuscules, sans accent, mots séparés par des tirets, 80 caractères au plus — 120 pour un bien, dont le slug porte aussi la région et la référence (`Property.slug`). Un slug est généré à la création à partir du nom ; en cas de doublon, un suffixe numérique est ajouté (`-2`). Quand un nom change, le slug **ne change pas** sauf action explicite « Régénérer l'adresse » ; l'ancienne adresse redirige alors vers la nouvelle (`301`).

**TRV-053** `[P1]` Aucune donnée personnelle n'apparaît dans une adresse : ni e-mail, ni nom, ni téléphone. Les liens envoyés par e-mail portent des jetons opaques.

## 5. Saisie et validation

**TRV-060** `[P1]` Chaque formulaire est validé **deux fois** avec les mêmes règles : dans l'interface pour le confort, sur le serveur pour la sécurité. Les règles sont décrites une seule fois, dans un schéma partagé (`06-technique/01`, ARC-030).

**TRV-061** `[P1]` Un champ est validé quand on en sort, puis à chaque modification une fois qu'il est en erreur. Le message d'erreur s'affiche **sous** le champ, en phrase complète qui dit quoi faire. À l'envoi, si des erreurs subsistent, le premier champ en erreur reçoit le focus ; dès deux erreurs, l'encart des points à corriger s'affiche aussi en tête de formulaire (TRV-114).

**TRV-062** `[P1]` Les champs **facultatifs** portent la mention « (facultatif) » après leur libellé. Tous les autres sont obligatoires, sans astérisque.

**TRV-063** `[P1]` Longueurs par défaut, quand le modèle de données ne précise pas :

| Type de champ | Maximum |
|---|---|
| Titre, libellé, nom d'objet | 120 caractères |
| Ligne courte (ville, profession) | 80 |
| Message d'un formulaire public | 2 000 |
| Message de la messagerie | 4 000 |
| Note interne, description d'un bien, d'un programme | 5 000 |
| Motif (rejet, perte, pause) | 500 |
| Question de FAQ | 200 ; réponse : 3 000 |

Un compteur « 1 850 / 2 000 » apparaît sous un champ de texte long quand il reste moins de 20 % de la limite.

**TRV-064** `[P1]` Les messages d'erreur de validation standard. Le **code** est celui que l'API renvoie pour le champ (`details[].code`, API-020) ; l'écran le traduit en message. Un formulaire qui a besoin d'un message plus précis définit son propre code dans sa règle.

| Cas | Code | Message |
|---|---|---|
| Champ obligatoire vide | `REQUIRED` | « Ce champ est obligatoire. » |
| E-mail mal formé | `INVALID_EMAIL` | « Cette adresse e-mail ne semble pas valide. Exemple : prenom.nom@exemple.fr » |
| Téléphone invalide | `INVALID_PHONE` | « Ce numéro ne semble pas valide pour le pays choisi. » |
| Trop long | `TOO_LONG` | « {n} caractères au maximum. » |
| Trop court | `TOO_SHORT` | « {n} caractères au minimum. » |
| Montant illisible | `INVALID_AMOUNT` | « Saisissez un montant, par exemple 150 000. » (TRV-026) |
| Montant hors bornes | `OUT_OF_RANGE` | « Indiquez un montant entre {min} et {max}. » |
| Montant au-delà du plafond technique | `AMOUNT_TOO_HIGH` | « Ce montant est trop élevé. Vérifiez votre saisie. » (CAL-027) |
| Nombre attendu | `NOT_A_NUMBER` | « Indiquez un nombre. » |
| Date invalide | `INVALID_DATE` | « Cette date n'est pas valide. » |
| Date dans le passé alors qu'elle doit être future | `DATE_NOT_FUTURE` | « Choisissez une date à venir. » |
| Date dans le futur alors qu'elle doit être passée | `DATE_IN_FUTURE` | « Cette date ne peut pas être dans le futur. » |
| Case de consentement non cochée | `MUST_ACCEPT` | « Vous devez accepter pour continuer. » |
| Valeur déjà utilisée | `ALREADY_USED` | « Cette valeur est déjà utilisée. » |
| Valeur hors de la liste permise | `INVALID_CHOICE` | « Choisissez une valeur dans la liste. » |
| Fichier modifié pendant l'envoi : taille ou empreinte différente de l'annonce (API-080) | `CHECKSUM_MISMATCH` | « Le fichier a été modifié pendant l'envoi. Déposez-le à nouveau. » |
| Fichier vide, ou contenu illisible (API-080, DOS-011) | `FILE_UNREADABLE` | « Ce fichier semble vide ou endommagé. » |
| PDF chiffré ou protégé par un mot de passe (MED-011, DOS-011) | `FILE_PASSWORD_PROTECTED` | « Ce PDF est protégé par un mot de passe. Déposez une version non protégée. » |
| Modèle d'e-mail : champ inconnu (COM-051) | `UNKNOWN_TEMPLATE_FIELD` | « Champ inconnu : {champ}. » |
| Modèle d'e-mail : champ obligatoire absent (COM-051) | `MISSING_REQUIRED_FIELD` | « Ce modèle doit contenir {champ}. » |
| Modèle d'e-mail : syntaxe incorrecte, bouton qui peut être rendu en plus d'un autre (NOT-061) | `INVALID_TEMPLATE_SYNTAX` | « Le texte contient une erreur : {détail}. » |
| Règle : champ, opérateur ou objet que le déclencheur ne fournit pas (AUT-021) | `INVALID_RULE_FIELD` | « Ce champ ne peut pas servir avec ce déclencheur : {champ}. » |
| Règle : modèle qui cite un champ que le déclencheur ne fournit pas (AUT-031) | `TEMPLATE_FIELD_UNAVAILABLE` | « Ce modèle cite un champ que ce déclencheur ne fournit pas : {champ}. » |
| Mot de passe trop courant, ou contenant le nom ou l'adresse | `WEAK_PASSWORD` | Messages de AUTH-002. |

**TRV-065** `[P1]` Les textes saisis par un utilisateur sont affichés **échappés**. Aucun HTML saisi par un client n'est interprété. Les seuls contenus riches viennent du back-office (pages, modèles d'e-mails) et sont nettoyés par une liste blanche de balises (`06-technique/03`, SEC-060).

## 6. Longueur et troncature à l'affichage

**TRV-070** `[P1]` Un texte trop long pour sa zone est **tronqué avec des points de suspension** `…`, d'après la largeur disponible et non d'après un nombre de caractères. Le texte complet reste accessible : au survol (infobulle), au lecteur d'écran, et sur l'écran de détail.

**TRV-071** `[P1]` Nombre de lignes avant troncature :

| Élément | Lignes |
|---|---|
| Nom d'une personne, d'une banque, d'un promoteur dans une liste, un tableau, un en-tête | 1 |
| Titre d'un bien sur une carte | 2 |
| Nom d'un programme sur une carte | 1 |
| Extrait de message dans une liste | 2 |
| Description d'un bien sur sa fiche | 6, puis « Lire la suite » |
| Cellule de tableau du back-office | 1 |

**TRV-072** `[P1]` Un nombre, un montant, une date, une référence ne sont **jamais** tronqués. Si la place manque, c'est le libellé voisin qui cède, ou la mise en page passe à la ligne.

## 7. États d'un écran

**TRV-080** `[P1]` Tout écran ou bloc qui affiche des données a **cinq états** conçus et développés :

| État | Comportement |
|---|---|
| **Chargement** | Premier affichage : squelette qui reprend la forme du contenu. Il n'apparaît que si la réponse tarde plus de 300 ms. Jamais d'écran blanc, jamais de simple roue pour une page entière. **Rechargement** d'un contenu déjà affiché (autre page, filtre, tri, recherche) : le contenu reste en place, estompé (opacité 60 %), sous une fine barre de progression en haut de la zone, puis le nouveau le remplace en fondu (DSN-072) ; la mise en page ne saute pas. |
| **Vide** | Une phrase qui explique pourquoi c'est vide et une action pour avancer. Exemple : « Vous n'avez pas encore exprimé d'intérêt. » + bouton « Découvrir les biens ». |
| **Erreur** | Une phrase claire, un bouton « Réessayer ». L'erreur d'un bloc ne casse pas le reste de la page. |
| **Contenu** | L'état normal. |
| **Partiel** | Quand une partie des données manque, la zone concernée est masquée ou remplacée (principe « aucune zone vide »). |

**TRV-081** `[P1]` Une action réussie est confirmée par un **message bref** en bas de l'écran pendant 5 secondes dans le back-office, 8 secondes sur le site et dans l'espace client (TRV-124) — le compte s'arrête tant que le pointeur ou le focus est sur le message — (« Pièce validée. »), qui peut proposer « Annuler » quand l'action est réversible. Une action qui engage l'utilisateur (envoi d'une demande, inscription, dépôt d'une pièce) affiche en plus un **écran ou un encart de confirmation** qui dit ce qui va se passer ensuite.

**TRV-082** `[P1]` Hors connexion ou serveur injoignable : un bandeau « Connexion interrompue. Vos saisies sont conservées, nous réessayons… » ; les boutons d'envoi sont désactivés ; l'envoi reprend dès le retour de la connexion si l'utilisateur est resté sur l'écran.

**TRV-083** `[P1]` Session expirée pendant une saisie : une fenêtre demande de se reconnecter **sans quitter l'écran** ; après reconnexion, l'action interrompue est rejouée. Aucune saisie n'est perdue.

**TRV-084** `[P1]` Pages d'erreur globales (EP-29), avec l'en-tête et le pied de page habituels :

| Cas | Titre | Contenu |
|---|---|---|
| `404` | « Cette page n'existe pas ou n'existe plus. » | Champ de recherche de biens, liens vers l'accueil, les programmes et — si `features.cafe` est vrai — Le Café. |
| `410` (bien retiré) | « Ce bien n'est plus proposé. » | Trois biens similaires, lien vers le programme (`02-site-public/04`, FIC-090). |
| `410` (programme archivé) | « Ce programme n'est plus proposé. » | Jusqu'à trois programmes publiés de la même région, en cartes (nom, région, « à partir de ») ; à défaut, le lien « Voir tous les programmes » et la barre de recherche (NAV-041). |
| `403` (connecté, non autorisé) | « Vous n'avez pas accès à cette page. » | Lien vers son espace. |
| `500` | « Un problème est survenu de notre côté. » | « Réessayer », moyen de contact, identifiant de l'erreur à communiquer au support. |
| Maintenance | « Nous revenons dans quelques minutes. » | Heure de retour prévue si elle est connue (paramètre `maintenance.until`). |

## 8. Formulaires : comportement commun

**TRV-090** `[P1]` Pendant l'envoi, le bouton affiche un indicateur de progression et devient inactif. Un second clic n'envoie rien.

**TRV-091** `[P1]` Tout formulaire qui **crée** quelque chose (demande, inscription, compte, message, pièce) envoie une **clé d'idempotence** générée à l'ouverture du formulaire. Si la même clé arrive deux fois (double clic, nouvel essai après coupure), le serveur renvoie le résultat du premier envoi **réussi** sans rien créer de plus (`06-technique/02`, API-040). Un envoi **refusé** par le serveur (champ invalide, limite de débit, plus assez de places) ne consomme pas la clé : la personne corrige et renvoie, et l'écran prend alors une **nouvelle clé**. Après une coupure ou une erreur `5xx`, la même clé est réutilisée, pour qu'un envoi déjà arrivé ne soit pas doublé.

**TRV-092** `[P1]` Les valeurs d'un formulaire public sont conservées dans le stockage de session du navigateur jusqu'à l'envoi réussi : un rechargement de page ne les efface pas. Les mots de passe ne sont jamais conservés.

**TRV-093** `[P1]` Dans le back-office et dans le profil du client, quitter un formulaire modifié et non enregistré déclenche : « Vous avez des modifications non enregistrées. Quitter sans enregistrer ? » — « Rester » / « Quitter ».

**TRV-094** `[P1]` **Modification simultanée.** Si un enregistrement a été modifié par quelqu'un d'autre depuis son ouverture, l'enregistrement est refusé (`409`, code `CONFLICT_VERSION`) : « Cette fiche a été modifiée par {prénom} à {heure}. Rechargez-la pour voir la dernière version ; vos changements ne sont pas enregistrés. » avec les boutons « Recharger » et « Copier mes changements ». Mécanisme : `06-technique/04`, FIA-010.

**TRV-095** `[P1]` Une action **destructive** ou difficile à défaire demande une confirmation qui nomme l'objet : « Archiver le programme Résidence El Yasmine ? Ses 4 biens ne seront plus visibles sur le site. » Les actions irréversibles (effacer les données d'une personne, supprimer un promoteur) demandent de **saisir un mot** de confirmation.

**TRV-096** `[P1]` Rien de ce qui a une valeur métier n'est supprimé physiquement par une action d'écran. « Supprimer » signifie une **suppression logique** : l'objet disparaît des listes, reste dans la base, et un administrateur peut le restaurer pendant 30 jours (paramètre `retention.trashDays`). Un **client** ne se supprime pas : il s'archive (CYC-061) ; ses données ne s'effacent que par l'exercice d'un droit (PRO-060) ou par les durées de conservation (SEC-110). Deux exceptions, sans geste « Supprimer » : la fiche née d'une demande classée indésirable, et qui n'a rien d'autre, part à la corbeille avec elle (CYC-006) ; la fiche née d'une inscription que le titulaire de l'adresse désavoue (« Ce n'est pas moi », AUTH-013) y part de même. La fiche absorbée par une fusion n'est plus qu'un renvoi vers la fiche conservée : elle ne figure pas dans la corbeille et ne se restaure pas (CRM-080). Un **dossier** se clôture ; il ne se supprime que dans le cas étroit d'une ouverture par erreur (MOD-312, CYC-038), et c'est alors une suppression logique comme les autres. Les purges définitives sont faites par des tâches planifiées (`01-domaine/08`, AUT-091), ou, pour un objet de la corbeille, par « Supprimer définitivement » (ADM-070), qui applique la même routine.

**TRV-097** `[P1]` Formulaires publics : après un envoi réussi, un e-mail d'accusé de réception part **toujours** vers l'adresse indiquée (`01-domaine/09`) — y compris pour une personne qui s'était opposée à tout contact : en envoyant elle-même une demande, avec sa case de consentement, elle lève cette opposition (CYC-009). Seule exception : une demande classée indésirable à sa création (DEM-031), qui n'envoie rien.

## 9. Listes, tableaux, recherche

**TRV-100** `[P1]` Toute liste est paginée, triée et filtrée **par le serveur**. Taille de page : 12 cartes sur le catalogue public ; 20 lignes dans l'espace client ; 25 lignes dans le back-office, réglable à 50 ou 100. **Exception** (D-099) : une liste de l'espace client bornée par une limite de la spec et envoyée entière par le serveur (favoris, cent ; simulations, trente ; alertes et recherches ; biens envisagés et demandes d'un client ; pièces d'un dossier ; dossiers d'un client) se filtre, se trie et se cherche dans la page, sans aller-retour ; ses compteurs sont ceux de la liste complète envoyée par le serveur (TRV-106), et son état reste dans l'adresse (TRV-101). Le fil « Suivi », qui s'allonge sans limite, reste filtré par le serveur (ECL-031).

**TRV-101** `[P1]` L'état d'une liste (page, tri, filtres, recherche) est porté par l'**adresse**. Copier l'adresse redonne exactement la même vue. Le bouton « Retour » du navigateur revient à l'état précédent.

**TRV-102** `[P1]` Tri par défaut : du plus récent au plus ancien, sauf mention contraire. Le tri est stable : à égalité, l'identifiant sert de second critère.

**TRV-103** `[P1]` La recherche textuelle ignore la casse et les accents, tolère une faute de frappe (similarité par trigrammes), part à partir de 2 caractères, et attend 300 ms après la dernière frappe avant d'interroger le serveur.

**TRV-104** `[P1]` Une liste filtrée sans résultat affiche les filtres actifs et propose « Effacer les filtres ». Une liste vide parce qu'elle ne contient encore rien affiche l'état vide (TRV-080).

**TRV-105** `[P1]` **Une liste se retrouve comme on l'a laissée** (D-087). Dans le back-office, chaque liste retient, pour chaque utilisateur, dans le stockage local du navigateur (clé `dp_list_{liste}_{utilisateur}`) : l'onglet de vue ouvert (BO-040), les filtres, le tri, les colonnes affichées et leur ordre, la taille de page. Revenir à la liste par le menu, un lien ou un rechargement la rouvre dans cet état — à la page 1, sauf retour arrière du navigateur (TRV-108). Une adresse qui porte déjà des critères (lien partagé, TRV-101) l'emporte sur ce qui est retenu. Quand des filtres retenus s'appliquent, une ligne le dit au-dessus des résultats : « Filtres de votre dernière visite » · « Tout effacer » (`common.list.restored`). Ne sont **pas** retenus : le texte de recherche (il peut contenir un nom ou un téléphone), la sélection, la page. « Se déconnecter » efface les clés `dp_list_*` de ce navigateur. Une **vue enregistrée** nommée (BO-040) garde ses propres filtres : l'ouvrir les applique, et la ligne « Filtres de votre dernière visite » ne s'affiche pas. Dans l'espace client et sur le catalogue, l'état est porté par l'adresse (TRV-101) et retrouvé au retour (TRV-108).

**TRV-106** `[P1]` Les compteurs affichés (« 42 biens », « 12 places ») sont calculés par le serveur au moment de la requête. Ils ne sont jamais déduits dans l'interface.

**TRV-107** `[P1]` **Listes fluides** (D-087). Partout — catalogue, espace client, back-office :
- **pas de rechargement de page** : changer de page, de tri, de filtre ou de recherche interroge le serveur et remplace les résultats en place (TRV-080, rechargement) ; l'adresse suit (TRV-101) ;
- **une seule requête utile** : une requête partie est annulée quand une nouvelle la remplace (frappe, clic rapide) ; seule la réponse de la dernière s'affiche, jamais une réponse arrivée en retard ;
- **le total se lit toujours** : « {début}–{fin} sur {total} » (`common.list.range`) au-dessus et sous le tableau du back-office ; « {n} biens » sur le catalogue (CAT-032) ;
- **pagination numérotée**, jamais de défilement infini : chaque page a son adresse, et l'on sait où l'on est. Changer de page ramène en haut des résultats, focus sur leur titre (annoncé). **Seule exception** : le catalogue sur téléphone (moins de 640 px), où le bouton « Voir les 12 biens suivants » charge la page suivante à la suite des cartes (CAT-055) — jamais au défilement seul ; le total reste lu, et l'adresse porte `page={n}` pour que le retour (TRV-108) rende toutes les cartes chargées ;
- **une ligne mise à jour pendant qu'on regarde** (en direct, NOT-019 ; sans liaison en direct, rafraîchissement toutes les 60 secondes et au retour sur l'onglet, comme partout : ECL-003, API-070) ne déplace pas la liste sous le pointeur : les nouveautés s'annoncent par « {n} nouveaux éléments · Afficher » (`common.list.newItems`) en haut de la liste, et s'insèrent au clic, surlignées (DSN-072).

**TRV-108** `[P1]` **Retour à la liste.** Revenir d'une fiche (bouton « Retour » du navigateur, fil d'Ariane, lien « Retour aux résultats ») rend la liste **exactement** où on l'avait quittée : mêmes critères, même page, même position de défilement ; la carte ou la ligne ouverte est brièvement surlignée (fond `ciel-pale` qui s'efface en 1,2 s ; rien si l'utilisateur a demandé à réduire les animations) et reçoit le focus. Les résultats de la page sont gardés en mémoire pendant 5 minutes pour que ce retour soit immédiat, puis relus en arrière-plan.

**TRV-109** `[P1]` **Suggestions pendant la frappe** (D-087). Un champ de recherche propose des suggestions sous lui, dès 2 caractères et 300 ms après la dernière frappe (TRV-103) :
- **catalogue** (CAT-010) et page 404 : `GET /public/search/suggest?q=` rend, dans l'ordre, la référence exacte d'un bien s'il en existe un publié (« Ouvrir le bien {référence} »), puis jusqu'à quatre régions ou villes, trois programmes et deux promoteurs qui ont au moins un bien listable (CAT-021) — chaque ligne avec son nombre de biens ; huit lignes au plus, groupées sous « Villes », « Programmes », « Promoteurs ». Choisir une ville ou un promoteur applique le critère correspondant (`region`, `city`, `promoter`) ; un programme ouvre sa page ; `Entrée` sans choix lance la recherche par mot ;
- **barre de l'accueil** : le champ Ville est une liste où l'on peut taper (`Combobox`) ; la saisie filtre les régions déjà chargées (`GET /public/search-options`), sans requête de plus (ACC-052) ;
- **back-office** : la recherche du haut (BO-030) ; la recherche d'une liste filtre la liste elle-même, sans liste de suggestions (TRV-107).

Règles communes : la partie qui correspond à la saisie est en gras ; flèches, `Entrée`, `Échap` ; la liste est un `listbox` annoncé (« 5 suggestions ») ; sur téléphone, les lignes font 48 px. **Recherches récentes** (catalogue seulement) : au focus d'un champ vide, les cinq dernières recherches de ce navigateur (stockage local, clé `dp_recent_searches`), avec « Effacer » (`common.search.recent`, `common.search.clearRecent`). **Aucune suggestion** : « Aucun résultat pour « {saisie} ». Vérifiez l'orthographe, ou cherchez une ville. » suivi des trois régions qui ont le plus de biens (`common.search.noResult`).

## 10. Erreurs fonctionnelles

**TRV-110** `[P1]` L'API renvoie des erreurs dans un format unique (`06-technique/02`, API-020) avec un **code** stable. L'interface traduit le code en message ; elle n'affiche jamais un message technique brut.

| Statut | Code | Message à l'écran |
|---|---|---|
| `400` | `BAD_REQUEST` | « La demande n'a pas pu être traitée. Rechargez la page et réessayez. » |
| `401` | `UNAUTHENTICATED` | Ouverture de la fenêtre de reconnexion (TRV-083). |
| `401` | `INVALID_CREDENTIALS` | « E-mail ou mot de passe incorrect. » — connexion (AUTH-021) ; « Mot de passe incorrect. Mot de passe oublié ? Choisissez-en un nouveau depuis la page de connexion. » — confirmation du mot de passe (BO-005) et preuve d'une action sensible du client (AUTH-086). |
| `401` | `INVALID_CODE` | « Code incorrect. Il vous reste {n} essais. » — code de double authentification, code de secours (AUTH-050), code de confirmation d'une action (AUTH-086) ; `{n}` vient de `params` (API-020). |
| `401` | `GATE_PASSWORD_INVALID` | « Ce mot de passe n'est pas le bon. » — sous le champ de la porte d'accès, sans fenêtre de reconnexion (NAV-064). |
| `403` | `FORBIDDEN` | « Vous n'avez pas le droit de faire cette action. » |
| `403` | `ACCOUNT_SUSPENDED` | Selon la raison (AUTH-022) : « Ce compte est suspendu. Contactez-nous. » · « Votre demande de suppression est en cours de traitement. » |
| `403` | `GATE_CLOSED` | Aucun message : l'application affiche la page d'attente (NAV-064). |
| `403` | `CHALLENGE_REQUIRED` | Aucun message : le formulaire affiche le défi anti-robots, garde la saisie, puis renvoie la demande (DEM-030). |
| `404` | `NOT_FOUND` | « Cet élément est introuvable. Il a peut-être été supprimé. » |
| `409` | `CONFLICT_VERSION` | Voir TRV-094. |
| `409` | `CONFLICT_STATE` | « Cette action n'est plus possible. » La raison vient du serveur, sous forme de code ; si elle a sa phrase (`07-design/03`, § 4), cette phrase s'affiche seule, à la place du message. |
| `409` | `DUPLICATE` | « Cet élément existe déjà. » avec un lien vers l'existant quand l'utilisateur a le droit de le voir. |
| `409` | `REQUEST_IN_PROGRESS` | Aucun message : l'interface attend la fin du premier envoi (API-040). |
| `422` | `IDEMPOTENCY_KEY_REUSED` | « La demande n'a pas pu être traitée. Rechargez la page et réessayez. » (défaut de l'application, à signaler). |
| `410` | `GONE` | « Ce lien a expiré ou a déjà été utilisé. » |
| `413` | `FILE_TOO_LARGE` | « Ce fichier dépasse {n} Mo. » |
| `415` | `UNSUPPORTED_FILE_TYPE` | « Ce format n'est pas accepté. Formats possibles : {liste}. » |
| `422` | `VALIDATION_ERROR` | Messages par champ (TRV-064). |
| `423` | `ACCOUNT_LOCKED` | « Trop de tentatives. Réessayez dans {n} minutes ou réinitialisez votre mot de passe. » |
| `429` | `RATE_LIMITED` | Pour les formulaires de demande (intérêt, projection, rappel, contact, « Devenir partenaire », inscription partenaire), ce sont les textes de DEM-032 qui s'affichent ; ceux de cette ligne valent partout ailleurs. Limite à la minute : « Trop de demandes en peu de temps. Réessayez dans un instant. » · limite à l'heure ou à la journée (`Retry-After` de plus de 5 minutes) : « Vous avez atteint le nombre maximal d'envois pour le moment. Réessayez plus tard, ou contactez-nous : {téléphone ou e-mail de contact}. » |
| `500` | `INTERNAL_ERROR` | « Un problème est survenu de notre côté. Réessayez ; si cela continue, contactez-nous en indiquant le code {identifiant}. » |
| `503` | `MAINTENANCE` | Page de maintenance (TRV-084). |

**TRV-111** `[P1]` Chaque réponse d'erreur `5xx` porte un **identifiant de requête**. Il est affiché à l'utilisateur et permet de retrouver l'erreur dans les journaux.

**TRV-112** `[P1]` Un formulaire public ne révèle jamais si une adresse e-mail possède déjà un compte. « Mot de passe oublié », « Recevoir un lien de connexion » et les formulaires de demande répondent de la même façon dans les deux cas.

**TRV-113** `[P1]` **Ce que dit un message d'erreur** (D-087). Quatre parties, dans cet ordre ; les deux premières toujours, les deux suivantes dès qu'elles existent :

| Partie | Exemple |
|---|---|
| **Ce qui s'est passé**, en mots simples | « Le fichier n'a pas pu être envoyé. » |
| **Ce que cela veut dire pour vous** — surtout : ce qui est sauvé, ce qui ne l'est pas | « Votre demande n'est pas encore envoyée ; ce que vous avez saisi est conservé. » |
| **Quoi faire**, avec le bouton qui le fait | « Réessayer » · « Choisir un autre fichier » · « Recevoir un nouveau code » |
| **Une issue humaine**, quand on peut rester bloqué (site et espace client) | « Besoin d'aide ? Appelez-nous au {téléphone} ou écrivez-nous sur WhatsApp. » (`common.error.help`) ; dans l'espace client : « Écrire à mon conseiller » |

Jamais : « Erreur », « Oups », un code seul, un message technique ou en anglais, un reproche (« Vous avez mal saisi »), une majuscule criée, un message qui disparaît avant qu'on l'ait lu. Toujours : une icône d'état **et** le texte (jamais la couleur seule, TRV-121), couleur `texte/erreur`, annonce par `aria-live` (`assertive` pour une erreur qui bloque, `polite` sinon). « Issue humaine » : `common.error.help` n'affiche que les moyens renseignés (`contact.phone`, `contact.whatsapp`, sinon `contact.email`).

**TRV-114** `[P1]` **Où s'affiche une erreur.** Une erreur s'affiche **au plus près de ce qu'elle concerne**, une seule fois :

| Cas | Affichage |
|---|---|
| Un champ | Sous le champ (TRV-061) : icône, phrase, bordure du champ en erreur ; relié au champ (`aria-describedby`, `aria-invalid`). Le message disparaît dès que la valeur est juste, avec une coche verte brève sur le champ (DSN-072). |
| Un formulaire envoyé avec des erreurs | Les messages sous les champs, **et** dès deux erreurs un encart `ErrorSummary` en tête du formulaire : « {n} points sont à corriger avant d'envoyer » (`common.error.summary`), chaque point étant un lien qui mène au champ. Le focus va sur l'encart (une seule erreur : sur le champ) ; défilement doux. |
| Un envoi refusé par le serveur (`409`, `403`, `5xx`, connexion) | Le bouton reprend son état ; un `Banner` d'erreur au-dessus du formulaire ou de la zone, avec le message de TRV-110 ou de sa raison (`07-design/03`, § 4) et son action. La saisie reste (TRV-115). |
| Des conditions manquantes (`MISSING_CONDITIONS`, API-102) | Dans la fenêtre de l'action : la liste des conditions, chacune avec sa phrase (`condition.*`) et le lien qui mène où la remplir. |
| Une action rapide sans formulaire (marquer lu, épingler, réordonner) | Message bref d'erreur (`Toast`) avec « Réessayer » ; il reste jusqu'à ce qu'on le ferme. L'action affichée d'avance est annulée à l'écran (TRV-116). |
| Un bloc qui ne se charge pas | L'état d'erreur du bloc (TRV-080) : « Ce contenu n'a pas pu être chargé. » · « Réessayer » ; le reste de la page fonctionne. |
| Un fichier | Sur la ligne du fichier, dans `FileDropzone` : son nom, la raison (TRV-110, `UploadStatus`), « Choisir un autre fichier » ; les autres fichiers continuent. |
| Une action groupée | Le résultat ligne par ligne (BO-035) : « 12 dossiers affectés, 2 refusés » et, pour chaque refus, sa raison. |
| Une tâche en arrière-plan (export, import) | Une notification à la fin, et l'état sur l'écran de la tâche, avec la raison. |
| Une page entière | Les pages de TRV-084. |
| La connexion | Le bandeau de TRV-082 ; il se retire de lui-même au retour, avec « Connexion rétablie. » pendant 3 secondes. |

Une erreur n'est jamais montrée **seulement** par un message bref qui s'efface.

**TRV-115** `[P1]` **Rien ne se perd sur une erreur.** Après un refus, une coupure ou une session expirée (TRV-083), tout ce qui a été saisi est encore là. **Lectures** (`GET`) : sur une coupure ou un `502`, `503` hors maintenance, `504`, l'application réessaie seule trois fois (après 1, 3 et 10 secondes) avant d'afficher l'erreur ; pendant ce temps, rien ne change à l'écran. **Écritures** : jamais réessayées en silence, sauf l'envoi repris au retour de la connexion (TRV-082), protégé par sa clé d'idempotence (TRV-091). Un long texte en cours (message, note, motif) est gardé dans le stockage de session du navigateur jusqu'à son envoi réussi, comme un formulaire public (TRV-092).

**TRV-116** `[P1]` **Prévenir plutôt qu'afficher une erreur.**
- Une action impossible est grisée et dit pourquoi (BO-047) — sur le site et dans l'espace client aussi.
- Les formats et la taille acceptés sont écrits **avant** le dépôt, sous la zone de dépôt ; les règles d'un mot de passe, avant la saisie.
- Les dates impossibles ne sont pas proposées ; une longueur limitée a son compteur (TRV-063).
- Adresse e-mail : à la sortie du champ, une faute de frappe probable dans un domaine courant (`gmal.com`, `hotmial.fr`…) propose « Vouliez-vous dire {adresse} ? » (`common.emailSuggestion`), à accepter d'un clic ; rien n'est corrigé sans l'accord de l'utilisateur.
- Mot de passe : « Afficher » · « Masquer » (`common.password.show`, `common.password.hide`) ; « Les majuscules sont activées. » (`common.capsLock`) quand c'est le cas.
- Le collage est permis dans tous les champs, codes compris ; un code se saisit dans un seul champ, clavier numérique, `autocomplete="one-time-code"`.
- **Affichage d'avance** (l'écran change avant la réponse du serveur) seulement pour les actions sans effet métier : marquer lu, épingler, réordonner, plier un bloc. Toute autre action attend la réponse, avec l'indicateur du bouton (TRV-090).

**TRV-117** `[P1]` **Erreurs dans le back-office.** Mêmes règles, plus : sous un message d'une erreur `5xx` ou inattendue, un lien « Détails » (`common.error.details`) déplie le code, l'identifiant de requête (TRV-111), l'heure, et un bouton « Copier les détails » (`common.error.copyDetails`) pour les transmettre au support. Un conflit nomme qui et quand (TRV-094).

**TRV-118** `[P1]` **Erreurs suivies.** Toute erreur inattendue d'une application web (exception, réponse `5xx`) est envoyée au suivi des erreurs quand `ERROR_TRACKING_DSN` est renseigné (ENV-040), avec l'identifiant de requête, l'écran et la version, **sans** donnée personnelle ni contenu saisi. Chaque bloc de page a sa frontière d'erreur : une exception dans un bloc donne l'état d'erreur de ce bloc (TRV-080) ; une exception hors bloc, la page `500` (TRV-084).

## 11. Accessibilité

**TRV-120** `[P1]` Le site public, l'espace client et l'application mobile visent le niveau **AA** des WCAG 2.1. Le back-office vise le même niveau pour le contraste, le clavier et les libellés.

**TRV-121** `[P1]` Exigences minimales, vérifiées en recette :
- contraste d'au moins 4,5 : 1 pour le texte courant, 3 : 1 pour le texte de 24 px ou plus et pour les éléments d'interface. Le doré clair (`#B98A4E`) est **réservé aux titres de 24 px ou plus** ; le petit texte doré utilise le doré soutenu (`#8F6326`) ;
- tout est utilisable **au clavier**, dans un ordre logique, avec un indicateur de focus toujours visible ;
- chaque champ a un libellé visible relié au champ ; les erreurs sont reliées au champ et annoncées ;
- chaque image porteuse de sens a un texte de remplacement ; les images décoratives n'en ont pas ;
- une information n'est jamais portée par la couleur seule : un statut a toujours un libellé, souvent une icône ;
- les zones tactiles font au moins 44 × 44 px — 48 × 48 px sur le site et dans l'espace client sur écran tactile, avec 8 px au moins entre deux cibles voisines (TRV-124) ;
- la page reste lisible et utilisable avec un texte agrandi à 200 % ;
- les animations respectent le réglage « réduire les animations » du système (DSN-074) ;
- les fenêtres modales piègent le focus, se ferment avec Échap, et rendent le focus à l'élément d'origine ;
- les messages qui apparaissent sans rechargement (confirmation, erreur) sont annoncés par une zone `aria-live`.

**TRV-122** `[P1]` **Mode simplifié** (D-090). Une bascule « Affichage simplifié » dans le réglage « Aa » (TRV-123), retenue dans le navigateur (`dp_simple_mode`). Quand elle est active, sur le site et dans l'espace client : le texte passe au moins au niveau « Grande » ; tout tient sur **une colonne** ; les sections d'agrément (chiffres, témoignages, appels secondaires) sont masquées ; l'accueil montre le titre, la recherche et trois grands boutons — « Chercher un bien », « Simuler mon financement », « Parler à un conseiller » ; un formulaire de plus de quatre champs (intérêt, inscription, simulateurs, dépôt d'une pièce) passe à **un écran par question**, avec « Étape {n} sur {total} », « Précédent » et un récapitulatif avant l'envoi ; la fiche d'un bien garde la galerie, le prix, les faits clés, la description et les boutons, le reste derrière « Voir tous les détails ». Les fonctions ne changent pas : seul l'affichage s'allège. Textes : `common.simpleMode.*`.

**TRV-127** `[P1]` **Aide vocale** (D-090). **Écouter** : un bouton haut-parleur en tête du contenu de chaque page du site et de l'espace client, et dans chaque bulle « ? » (TRV-126) ; la synthèse vocale du navigateur lit le texte principal en français (vitesse 0,9), surligne la phrase lue, propose « Pause » et « Arrêter » ; rien ne part vers nos serveurs. **Dicter** : un bouton micro dans la recherche, l'assistant, les champs de message et la zone « Votre message » du formulaire d'intérêt ; la reconnaissance vocale du navigateur, lancée par un clic, écrit dans le champ, que la personne relit avant d'envoyer. Un navigateur qui ne connaît pas l'une ou l'autre ne montre pas le bouton. La politique de confidentialité dit que la dictée passe par le service du navigateur. Textes : `common.voice.*`.

**TRV-123** `[P1]` **Taille du texte** (D-087). Sur le site public et dans l'espace client, un réglage « Taille du texte » propose trois niveaux : **Normale** (100 %), **Grande** (115 %), **Très grande** (130 %) (`common.textSize.*`). Il s'ouvre par le bouton « Aa » de la barre du haut de l'espace client (ECL-002), par le pied de page et par le menu du téléphone (NAV-014, NAV-020). Le choix s'applique tout de suite, sans recharger, et se retient dans le stockage local du navigateur (clé `dp_text_size`). Réalisation : toutes les tailles de texte, d'espacement vertical et de composant sont en `rem` ; le réglage change la taille de base de la page. Chaque écran reste juste au niveau « Très grande » à 390 px comme à 1 440 px (QUA-001) : les rangées passent à la ligne, rien ne se coupe ni ne se chevauche. Le back-office n'a pas ce réglage : le zoom du navigateur suffit (TRV-121).

**TRV-124** `[P1]` **Confort d'un public âgé** (D-087). Une partie des clients a plus de 60 ans et découvre les démarches en ligne. Sur le site et dans l'espace client :
- **lire** : le texte courant de l'espace client est en `body.xl` (16 px, DSN-021) ; aucun texte de l'espace client sous 13 px, sauf les libellés d'une valeur (`caption`, 12 px au moins) ; une information utile n'est jamais écrite en gris clair ;
- **toucher** : cibles de 48 × 48 px sur écran tactile (TRV-121) ; l'action principale d'un écran est un bouton de grande taille (52 px), seul de son poids sur l'écran ;
- **comprendre** : une idée par phrase ; un terme du métier (apport, mensualité indicative, option, réservation, pièce, jours ouvrés, financement islamique) porte son explication « ? » à sa première apparition sur l'écran (TRV-126) ; une icône de navigation ou d'action a toujours son libellé visible, sauf fermer, retour, menu et la cloche (qui ont un nom accessible) ;
- **ne rien cacher** : aucune information ni action n'est accessible au seul survol ; une infobulle s'ouvre aussi au toucher et au focus ; les liens dans un texte sont soulignés ;
- **rien ne bouge seul** : pas de carrousel qui défile seul, pas de contenu qui change sans action, pas de fenêtre qui s'ouvre d'elle-même (hors TRV-083) ;
- **avoir le temps** : un message bref reste 8 secondes et s'arrête au survol ou au focus (TRV-081) ; une erreur reste jusqu'à ce qu'on la ferme (TRV-114) ; aucun compte à rebours hors sécurité (TRV-125) ;
- **savoir où l'on est** : un formulaire en plusieurs écrans dit « Étape {n} sur {total} » ; l'écran courant est marqué dans le menu ; chaque page a un titre visible qui dit où l'on est ;
- **pouvoir revenir** : « Retour » ramène toujours à l'écran précédent sans perte (TRV-108, TRV-092) ; une action réversible propose « Annuler » plutôt qu'une confirmation (TRV-081) ;
- **trouver quelqu'un** : depuis chaque écran de l'espace client, « Écrire à mon conseiller » est à un geste (ECL-002) ; sur le site, le téléphone et WhatsApp sont dans le pied de page (NAV-020).

**TRV-125** `[P1]` **Le temps laissé.** Aucune limite de temps sur le site ni dans l'espace client, hors sécurité : durée des sessions (SEC-023, reconnexion sans perte : TRV-083), codes et liens à usage unique. Un code ou un lien qui expire dit sa durée **avant** (« Ce code est valable 10 minutes. ») et, une fois expiré, propose d'en recevoir un nouveau en un clic, sans tout recommencer. Dans le back-office : l'avertissement de BO-004.

**TRV-126** `[P1]` **Aide à portée de main** (D-087). Trois aides, en plus de l'assistant de recherche (EP-22, ASS-050) :
1. **« ? » à côté d'un terme ou d'un champ** (`HelpTip`, DSN-055) : une explication de une à trois phrases (`07-design/03`, § 5.1), qui s'ouvre au clic, au toucher ou au focus, se ferme par Échap ou un clic ailleurs. Une même explication ne s'affiche qu'une fois par écran.
2. **Première visite de l'espace client** : trois bulles successives (`GuideTip`, DSN-055) présentent le tableau de bord — « Votre projet, étape par étape » (la frise), « Ce que vous avez à faire » (bloc « À faire »), « Votre conseiller » (son bloc) —, avec « Suivant » · « Passer » ; vue une fois par navigateur (stockage local, clé `dp_tour_space`) ; « Revoir la visite » dans le menu du compte la relance (`common.tour.*`). Une bulle ne cache jamais l'élément qu'elle présente, et l'écran reste utilisable derrière elle.
3. **États vides qui guident** (TRV-080) : chaque liste vide de l'espace client dit ce qui viendra, et quand, et propose l'action utile.

Dans le back-office : la fenêtre « ? » (BO-081) ; l'en-tête d'une colonne ou une tuile d'indicateur dont le sens n'est pas évident porte son « ? » (définition des indicateurs : `04-back-office/02`).

## 12. Affichage adaptatif, navigateurs, performance

**TRV-130** `[P1]` Le site public et l'espace client sont conçus **pour le téléphone d'abord**. Points de rupture :

| Nom | Largeur | Maquette de référence |
|---|---|---|
| Téléphone | 360 – 767 px | 390 px |
| Tablette | 768 – 1023 px | — |
| Ordinateur | 1024 – 1439 px | — |
| Grand écran | 1440 px et plus | 1440 px, contenu limité à 1344 px |

Le back-office est conçu pour 1280 px et plus ; il reste utilisable à partir de 1024 px, et n'est pas optimisé en dessous.

**TRV-131** `[P1]` Navigateurs pris en charge : les deux dernières versions de Chrome, Safari, Firefox et Edge ; Safari sur iOS 16 et plus ; Chrome sur Android 9 et plus.

**TRV-132** `[P1]` Objectifs de performance des pages publiques, mesurés sur un téléphone de milieu de gamme en 4G :

| Mesure | Objectif |
|---|---|
| Affichage du plus grand élément (LCP) | 2,5 s au plus |
| Stabilité visuelle (CLS) | 0,1 au plus |
| Réactivité (INP) | 200 ms au plus |
| JavaScript initial | 180 ko compressés au plus |
| Réponse d'API en lecture, 95e centile | 400 ms au plus |
| Réponse d'API en écriture, 95e centile | 800 ms au plus |

**TRV-133** `[P1]` Les images sont servies dans plusieurs tailles et en formats modernes (AVIF, WebP, repli JPEG), chargées à la demande sous la ligne de flottaison, avec leurs dimensions réservées pour éviter les sauts de mise en page (`06-technique/05`). Une image qui ne se charge pas laisse sa place à un fond uni de la couleur de la marque, avec son texte de remplacement lisible : jamais d'icône d'image cassée, jamais de zone qui se replie.

## 13. Divers

**TRV-140** `[P1]` Un lien vers un site extérieur s'ouvre dans un nouvel onglet avec `rel="noopener noreferrer"` et le signale aux lecteurs d'écran.

**TRV-141** `[P1]` Toute action d'écriture du personnel ou du système est écrite dans le **journal d'audit** : qui, quoi, sur quel objet, quand, avec les champs modifiés — sans valeur d'identité ni valeur sensible (SEC-081). Les actions qui ont un code propre, et le code générique des autres, sont dans `06-technique/03`, SEC-080.

**TRV-142** `[P1]` Les **documents PDF** produits par la plateforme (simulation, projection, récapitulatif de dossier, sommaire d'un paquet de soumission) portent en tête le logo et le nom d'usage (`contact.companyName`), la date de génération, la référence de l'objet ; en pied, le numéro de page et les coordonnées renseignées (`contact.legalName`, `contact.address`, `contact.phone`, `contact.email`) ; et les mentions TRV-023 et TRV-024 quand ils contiennent des montants estimés.

**TRV-143** `[P1]` Les **cases à cocher de consentement** ne sont jamais cochées d'avance. Chaque consentement recueilli est enregistré avec la version du texte accepté (`01-domaine/02`, entité `Consent`).

**TRV-144** `[P1]` Un booléen s'affiche « Oui » / « Non ». Une liste de valeurs s'affiche séparée par des virgules, la dernière précédée de « et ».

**TRV-145** `[P1]` Le **nom du conseiller** montré au client est son prénom suivi de l'initiale du nom (« Amel K. »), avec sa photo si elle existe, sinon ses initiales dans un médaillon.
