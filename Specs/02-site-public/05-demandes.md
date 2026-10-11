# Demandes : les formulaires publics

Une **demande** (`Lead`) est tout formulaire envoyé avec des coordonnées. Ce fichier décrit chaque formulaire, ce qu'il enregistre et ce que voit le visiteur. Ce qui se passe ensuite côté équipe est dans `01-domaine/06` (CYC-001 à CYC-007) et `04-back-office/03`.

Principe : **une demande envoyée est une demande enregistrée** (D-030). L'écran ne dit « merci » qu'une fois la demande écrite en base.

---

## 1. Règles communes

**DEM-001** `[P1]` Tous les formulaires suivent `00-cadre/04` : validation double (TRV-060), messages (TRV-064), champs facultatifs marqués (TRV-062), bouton inactif pendant l'envoi (TRV-090), clé d'idempotence (TRV-091), saisies conservées en cas de rechargement (TRV-092), accusé de réception par e-mail (TRV-097).

**DEM-002** `[P1]` À l'envoi, le serveur fait, dans **une seule transaction**, ce que décrit CYC-001 : fiche client retrouvée ou créée, demande créée, consentements enregistrés, dossier ouvert ou rejoint selon la nature, échéance de premier contact, événement `lead.created`. L'e-mail, les notifications et les règles partent ensuite (AUT-003). Si la transaction échoue, rien n'est créé et le visiteur voit l'erreur (DEM-040).

**DEM-003** `[P1]` Avec chaque demande, sans que le visiteur les saisisse : la page d'envoi, l'origine de la visite (NAV-053), la langue, le fuseau horaire du navigateur (`callerTimezone`), l'empreinte de l'adresse IP, le navigateur.

**DEM-004** `[P1]` **Attributs de saisie.** Chaque champ porte l'attribut `autocomplete` qui convient (`given-name`, `family-name`, `email`, `tel`, `country-name`) et le clavier adapté sur téléphone (e-mail, téléphone, nombre).

**DEM-005** `[P1]` **Aide à la saisie de l'e-mail.** Si le domaine saisi ressemble à un domaine courant mal orthographié (`gmial.com`, `hotmal.fr`), une suggestion apparaît sous le champ : « Vouliez-vous dire {adresse corrigée} ? », avec un clic pour l'accepter. Elle ne bloque pas l'envoi.

**DEM-006** `[P1]` **Pays de résidence** : liste de TRV-044. Si le champ est encore vide quand le téléphone est saisi, il prend le pays de l'indicatif.

**DEM-007** `[P1]` **Montants saisis dans un formulaire** (budget, apport, mensualité confortable) : dans la **devise de référence** du site (`display.referenceCurrency`, l'euro), dont le symbole suit le champ. La demande garde le montant **et** sa devise (`budgetCurrency`) : un changement ultérieur de la devise de référence ne change pas ce que la personne a écrit.

**DEM-008** `[P1]` **Quand vous appeler ?** Deux champs facultatifs, présents sur les formulaires qui promettent un appel :
- **le jour** (`preferredCallbackDate`) : « Dès que possible » (défaut), puis les cinq prochains **jours travaillés** du calendrier de l'équipe (PAR-030), hors jours fériés ;
- **le moment** (`preferredSlot`, `ContactTimeSlot`) : « Peu importe » (défaut), puis seulement les moments où l'équipe travaille. Les créneaux se lisent dans l'heure du visiteur (`callerTimezone`), avec la mention « Créneaux dans votre heure locale ». Un créneau n'est proposé que si au moins une heure de ce créneau, convertie dans le fuseau du calendrier de travail, tombe dans les heures travaillées : avec un calendrier de 9 h à 18 h à Paris, un visiteur de France ne se voit pas proposer « Le soir, 18 h – 20 h » ; un visiteur de Montréal se voit proposer « Le matin » (15 h – 18 h à Paris), pas « L'après-midi ». Si aucun créneau ne convient, le champ n'apparaît pas et la phrase « Nous vous appelons pendant nos heures d'ouverture : {contact.openingHoursLabel}. » le remplace.

Ce que la personne lit ensuite — à l'écran, dans l'accusé de réception, dans son espace — est une seule et même expression, composée d'après ces deux champs (NOT-053) : jamais « sous 48 h » si elle a choisi un jour plus lointain.

## 2. Les formulaires

**DEM-010** `[P1]`

| Formulaire | Nature (`LeadKind`) | Où | Écran | Phase |
|---|---|---|---|---|
| Intérêt pour un bien | `PROPERTY_INTEREST` | Fiche d'un bien | EP-07 | P1 |
| Intérêt pour un programme | `PROPERTY_INTEREST` | Fiche d'un programme | EP-07 | P1 |
| Projection | `PROJECTION_REQUEST` | Accueil, `/projection` | EP-20 | P1 |
| Rappel | `CALLBACK_REQUEST` | Fenêtre dédiée : accueil, pied de page, catalogue | EP-21 | P1 |
| Contact | `CONTACT_MESSAGE` | `/contact` | EP-19 | P1 |
| Suite de simulation | `SIMULATION_FOLLOWUP` | Résultat d'un simulateur | EP-11, EP-12 | P1 |
| Recherche guidée | `GUIDED_SEARCH` | Fin de l'assistant | EP-22 | P1 |
| Devenir partenaire | `PARTNER_REQUEST` | `/devenir-partenaire` | EP-23 | P1 |
| Signaler une erreur | — (`Feedback`) | Fiche d'un bien | EP-05 | P1 |

L'inscription à un Café et la création d'une alerte ne sont pas des demandes : `07-le-cafe.md`, CAT-070.

### 2.1 Intérêt pour un bien

**DEM-011** `[P1]` Fenêtre centrée sur ordinateur (720 px), plein écran sur téléphone. En tête : « Exprimer mon intérêt » · « Un conseiller vous rappelle pour faire le point sur votre projet. Sans engagement, avec ou sans compte. » — le délai n'est dit qu'une fois, sous le bouton, d'après le jour choisi. Puis le rappel du bien : vignette, titre, « {ville} · {prix} · Réf. {référence} » ; et, si un lot a été choisi, « Lot {référence} ».

| Champ | Clé | Oblig. | Règles |
|---|---|---|---|
| Prénom | `firstName` | oui | TRV-042 |
| Nom | `lastName` | oui | TRV-042 |
| E-mail | `email` | oui | TRV-043 |
| Téléphone | `phone` | oui | TRV-040 |
| « Je suis joignable sur WhatsApp à ce numéro » | `whatsappOptIn` | — | Case, décochée. |
| Pays de résidence | `countryOfResidence` | oui | DEM-006 |
| **Pour préparer notre échange (facultatif)** — section **repliée** par défaut derrière « Ajouter des précisions (facultatif) » : le bouton d'envoi est visible dès le pays de résidence, surtout sur téléphone (D-095) | | | |
| Comment vous joindre ? | `preferredChannel` | non | Appel · WhatsApp (si `contact.whatsapp`) · E-mail. Défaut : Appel. Gardé dans `payload` ; NOT-053 adapte la phrase (« Un conseiller vous écrit sur WhatsApp {quand} », « vous répond par e-mail {quand} »). |
| Votre situation | `residencyStatus` | non | Libellés de `ResidencyStatus`. |
| Horizon d'achat | `purchaseTimeframe` | non | Libellés de `PurchaseTimeframe`. |
| Budget envisagé | `budget`, `budgetKind` | non | Montant (DEM-007) ; sélecteur « au total » / « par mois » `[P1]`. Tant que `features.monthlyBudgetSearch` est faux, le sélecteur n'existe pas : le libellé du champ est « Budget envisagé (au total) » et `budgetKind` vaut `TOTAL`. Le montant complète, s'il est vide, `Client.budgetMax` (`MONTHLY` : `Client.budgetMonthly`), selon MOD-300 et MOD-303. |
| Financement souhaité | `financingPreference` | non | Crédit bancaire classique · Financement islamique `[P1]` · Sans préférence · Sans financement. |
| Quand vous appeler ? | `preferredCallbackDate`, `preferredSlot` | non | DEM-008. |
| « Je souhaite une visite en visio » | `wantsVideoVisit` | — | Case, décochée ; cochée d'office en venant de FIC-020. |
| Votre message | `message` | non | 2 000 caractères. |
| Consentement | `consentContact` | oui | DEM-020 |
| « Je souhaite recevoir les actualités et les nouveaux programmes par e-mail. » | `marketingOptIn` | — | Case, décochée. |
| « Créer mon espace client en même temps » | `createAccount` | — | Case, décochée. DEM-021. |

Fermer la fenêtre garde le brouillon pour la session (TRV-092) ; la rouvrir le restaure. Un lien partagé peut viser un lot : `?interet=1&lot={référence}` (un lot indisponible est ignoré). Bouton : **« Envoyer ma demande »**. Sous le bouton : « Un conseiller vous appelle {quand} · Sans engagement », `{quand}` étant l'expression de NOT-053, recalculée à chaque changement des champs « Quand vous appeler ? » (« sous 48 h ouvrées » tant qu'ils sont vides), et, si `contact.whatsapp` est renseigné, « Vous pouvez aussi nous écrire sur WhatsApp. ».

**DEM-012** `[P1]` **Depuis la fiche d'un programme** : même formulaire, précédé du champ « Quel bien vous intéresse ? » — la liste des biens publiés et encore proposés du programme (« Appartement T3 · à partir de 150 000 € »), puis « Je ne sais pas encore ». Avec un bien choisi : la demande porte ce bien. Avec « Je ne sais pas encore » : la demande porte le programme seul (`programId`). Si le programme est « À venir » — il n'a encore mis **aucun bien** en vente (CYC-127) —, le champ n'apparaît pas : la demande porte le programme, et le rappel en tête de la fenêtre montre le programme (visuel, nom, « {région} »), sans prix ni référence de bien. L'accusé de réception et la confirmation nomment alors le programme (NOT-060, `C_LEAD_ACK_INTEREST`).

### 2.2 Projection

**DEM-013** `[P1]` **En deux temps** (D-031).

**Premier écran** — les quatre champs de la maquette :

| Champ | Clé | Oblig. | Règles |
|---|---|---|---|
| Où souhaitez-vous acheter ? | `regionSlug` | non | Régions avec des biens publiés, puis « Je ne sais pas encore ». |
| Votre apport | `downPayment` | oui | Montant ≥ 0 (DEM-007). |
| Mensualité confortable | `monthlyBudget` | oui | Montant > 0, par mois (DEM-007). |
| Votre e-mail | `email` | oui | |
| Consentement | `consentContact` | oui | DEM-020 |

Bouton **« Recevoir ma projection »** → la demande est **créée**. L'écran devient :

> « C'est noté. Votre projection arrive {quand} à {e-mail}. » (`{quand}` : NOT-053)
> « Pour une projection plus juste, dites-nous comment vous joindre (facultatif). »
> L'adresse saisie est répétée avec « Modifier » : une adresse mal tapée se corrige ici, dans les 30 minutes, par le même jeton de complétion (D-095) — DEM-005 a déjà suggéré les fautes de domaine.

**Second écran**, facultatif : Prénom · Nom · Téléphone (avec la case WhatsApp) · Pays de résidence · Quand vous appeler ? — boutons « Compléter ma demande » et « Terminer ».

« Compléter ma demande » **complète la même demande**, une seule fois, dans les 30 minutes qui suivent sa création (jeton de complétion remis par le premier envoi). Passé ce délai, ou après une première complétion, la demande est immuable. Fermer la page au second écran ne perd rien : la demande existe déjà.

### 2.3 Rappel

**DEM-014** `[P1]` Fenêtre « Être rappelé » : « Un conseiller vous rappelle, au moment qui vous convient. »

| Champ | Clé | Oblig. | Règles |
|---|---|---|---|
| Prénom | `firstName` | oui | |
| Nom | `lastName` | non | |
| Téléphone | `phone` | oui | Avec la case WhatsApp. |
| E-mail | `email` | oui | Sert à confirmer la demande. |
| Quel jour ? | `preferredCallbackDate` | non | DEM-008. |
| À quel moment ? | `preferredSlot` | non | DEM-008. |
| À quel sujet ? | `subject` | non | `ContactSubject`, sans « Être rappelé » ni « Mon dossier » : Un bien ou un programme (`PROPERTY`) · Le financement (`FINANCING`) · Le Café (`CAFE`, si `features.cafe`) · Autre (`OTHER`). |
| Votre message | `message` | non | |
| Consentement | `consentContact` | oui | |

Ouverte depuis la fiche d'un bien ou d'un programme, la demande en garde la référence. Sous le bouton, si `contact.phone` est renseigné : « Vous préférez appeler ? {contact.phone}{, horaires} » (NAV-060) — pour qui veut parler tout de suite.

### 2.4 Contact

**DEM-015** `[P1]` Page `/contact` (EP-19).

| Champ | Clé | Oblig. | Règles |
|---|---|---|---|
| Prénom, Nom | `firstName`, `lastName` | oui | |
| E-mail | `email` | oui | |
| Téléphone | `phone` | selon | Facultatif ; **obligatoire** si l'objet est « Être rappelé ». |
| Objet | `subject` | oui | Un bien ou un programme (`PROPERTY`) · Le financement (`FINANCING`) · Mon dossier (`DOSSIER`) · Le Café (`CAFE`) · Être rappelé (`CALLBACK`) · Une question générale (`OTHER`, libellé affiché). |
| Quand vous appeler ? | `preferredCallbackDate`, `preferredSlot` | non | Affichés seulement pour « Être rappelé » (DEM-008). |
| Votre message | `message` | oui | 10 à 2 000 caractères. Facultatif pour « Être rappelé ». |
| Consentement | `consentContact` | oui | |

« Le Café » n'est proposé que si `features.cafe` est vrai ; « Mon dossier », qu'à un client connecté. L'objet peut être présélectionné par l'adresse (`/contact?objet=rappel`), et une simulation jointe (`/contact?objet=rappel&simulation={id}` → `Lead.simulationId`, comme DEM-016) : c'est le lien de `C_SIMULATION_RESULT`. Un message de contact n'ouvre pas de dossier (CYC-002).

**« Être rappelé » depuis la page de contact est une vraie demande de rappel.** Avec l'objet `CALLBACK`, la demande est enregistrée avec la nature `CALLBACK_REQUEST` — pas comme un simple message : elle ouvre ou rejoint un dossier (CYC-002), porte la même échéance de premier contact, reçoit l'accusé `C_LEAD_ACK_CALLBACK`, et sa confirmation dit « Un conseiller vous appelle {quand} » (DEM-023). Ouverte depuis une fiche (`/contact?objet=rappel&bien={référence}` ou `&programme={slug}`), elle garde le bien ou le programme, rappelé en tête du formulaire. C'est le chemin de Phase 1 de tous les boutons « Être rappelé » du site tant que la fenêtre dédiée (DEM-014, `features.callbackRequest`) n'est pas activée (ACC-090) : même promesse, même traitement, seul l'écran diffère.

### 2.5 Suite de simulation

**DEM-016** `[P1]` Sur l'écran de résultat d'un simulateur, « Être rappelé par un conseiller » déplie : Prénom · Nom · E-mail · Téléphone (case WhatsApp) · Quand vous appeler ? · Consentement. Mention : « Votre simulation sera transmise à votre conseiller. ». À l'envoi : la simulation — écrite au préalable si elle ne l'est pas encore (SIM-032, « Routes ») — est jointe à la demande (`Lead.simulationId`) et rattachée à la fiche du client ; ses données (revenus, charges, apport, budget) complètent les champs **vides** de la fiche (MOD-300), **dans une seule devise** : si la fiche porte déjà des montants dans une autre devise que celle de la simulation, ceux de la simulation sont convertis dans la devise de la fiche avant de compléter ses champs vides ; sans cours disponible, ils ne sont pas repris (MOD-303). Dans tous les cas la simulation reste jointe à la demande, où le conseiller la lit telle qu'elle a été faite ; le score est calculé (CAL-070). La demande garde le bien d'où venait le visiteur, s'il y en avait un (`propertyId`, `lotId`).

### 2.6 Recherche guidée, partenaire, signalement

**DEM-017** `[P1]` **Fin de l'assistant** : Prénom · E-mail · Téléphone (facultatif) · Consentement. La demande porte les réponses au questionnaire et les biens trouvés (ASS-030).

**DEM-019** `[P1]` **Devenir partenaire** (`/devenir-partenaire`) : Société (oui) · Vous êtes (Notaire · Assureur · Institution ou administration · Média · Autre) (oui) — un promoteur ou une banque est dirigé vers l'inscription partenaire (EP-32, ACP-080), et la page le dit en tête : « Vous êtes promoteur ou banque ? Créez votre espace partenaire » · Prénom, Nom (oui) · Fonction (non) · E-mail professionnel (oui) · Téléphone (oui) · Pays (oui) · Site web (non ; saisi sans `https://`, il est complété — « www.exemple.fr » devient « https://www.exemple.fr », D-097) · Votre message (oui) · Consentement (oui). Cette demande ne crée **pas** de fiche client. Seuls les rôles Direction et Administrateur en sont notifiés. La confirmation annonce « Nous revenons vers vous sous {`partner.applicationReviewDays`} jours ouvrés. ».

**DEM-018** `[P1]` **Signaler une erreur sur une fiche.** Fenêtre : « Qu'est-ce qui est inexact ? » (Le prix · La surface ou les pièces · Les photos · La localisation · La disponibilité · Autre) (oui) · « Précisez » (oui, 10 à 1 000 caractères) · « Votre e-mail, si vous souhaitez une réponse » (non). Crée un `Feedback` de nature `LISTING_ERROR` rattaché au bien, avec ce qui est inexact (`Feedback.listingErrorKind`, `ListingErrorKind`) ; aucune fiche client. Confirmation : « Merci. Nous vérifions cette fiche. ».

## 3. Consentement et compte

**DEM-020** `[P1]` **Case de consentement**, jamais cochée d'avance (TRV-143), obligatoire : Le lien « Politique de confidentialité » s'ouvre dans un nouvel onglet : dans une fenêtre, une navigation en place fermerait le formulaire.

> « J'accepte que Diaspora Patrimoine me contacte au sujet de ma demande et traite mes données à cette fin. [Politique de confidentialité] »

Sous chaque formulaire : « Vos données sont hébergées dans l'Union européenne. ». À l'envoi, une ligne `Consent` de type `CONTACT_REQUEST` est écrite avec la **phrase exacte** affichée, la version de la politique de confidentialité en vigueur et la source `lead:{NATURE}`. La case des actualités, si elle est cochée, écrit une ligne `MARKETING_EMAIL`. L'accord pour transmettre un dossier aux banques et aux promoteurs n'est **pas** demandé ici : il l'est à la constitution du dossier (GED-070).

**DEM-021** `[P1]` **« Créer mon espace client en même temps. »** Sous la case : « Pour suivre votre demande, retrouver vos simulations et, plus tard, déposer vos pièces. ». Si elle est cochée et qu'aucun compte n'existe pour cette adresse : un compte est créé à l'état `INVITED` et l'accusé de réception porte le lien d'activation (un seul e-mail). Si un compte **actif** existe déjà : l'accusé de réception invite à se connecter (`action.hasAccount`). Ce paragraphe du compte — « Activer mon espace » ou « Vous avez déjà un espace » — est porté par les quatre accusés de réception, `C_LEAD_ACK_INTEREST`, `C_LEAD_ACK_PROJECTION`, `C_LEAD_ACK_CALLBACK` et `C_LEAD_ACK_CONTACT` (D-097). Si le compte existe sans être utilisable — encore `INVITED`, ou inscrit sans avoir vérifié son adresse — l'accusé porte un lien d'activation ou de vérification, comme pour un compte créé à l'instant (NOT-024, AUTH-013). Dans tous les cas l'écran affiche **la même** confirmation, mot pour mot (TRV-112) : rien à l'écran ne dit si un espace existait déjà pour cette adresse — seul l'e-mail, lu par son titulaire, le dit.

**DEM-022** `[P1]` **Client connecté.** Les coordonnées ne sont pas redemandées : le formulaire montre « {Prénom Nom} · {e-mail} · {téléphone} » et le lien « Modifier mes coordonnées ». Tout champ obligatoire du formulaire qui manque à sa fiche lui est demandé — le téléphone, le pays de résidence — et complète la fiche à l'envoi. La case de consentement est remplacée par la phrase « En envoyant, vous demandez à être contacté au sujet de cette demande. », enregistrée comme consentement. Les cases « actualités » et « créer mon espace » n'apparaissent pas.

## 4. Après l'envoi

**DEM-023** `[P1]` **Confirmation**, à la place du formulaire :

> **« Merci {prénom}, votre demande est enregistrée. »**
> « Référence : {référence} » — pour un client **connecté** seulement ; un visiteur la trouve dans l'e-mail de confirmation, que seul le titulaire de l'adresse reçoit (DEM-024)
> **Et maintenant ?**
> 1. « Vous recevez un e-mail de confirmation à {e-mail}. » — dessous, en petit : « Pas d'e-mail dans les minutes qui viennent ? Regardez vos indésirables{, ou écrivez-nous à {contact.email}}. »
> 2. « Un conseiller vous appelle {quand}{, depuis le {contact.phone}}. »
> 3. « Vous faites le point ensemble sur votre projet et son financement. »

`{quand}` est l'expression de NOT-053 : « sous 48 h ouvrées », « sous 48 h ouvrées, de préférence le matin (heure de France) », « jeudi 15 octobre, de préférence l'après-midi »… — la même que dans l'accusé de réception. La première occurrence de « ouvrées » porte l'explication des jours ouvrés (`07-design/03`, § 1).

Boutons : « Continuer ma visite » (ferme) · « Simuler mon financement » → simulateur d'éligibilité. Si la case « Créer mon espace client » était cochée, une ligne s'ajoute, **identique qu'un espace existe déjà ou non** (DEM-021) : « Pour suivre votre demande, ouvrez l'e-mail que nous venons de vous envoyer : il contient le lien vers votre espace. » (les deux e-mails en ont un ; pas de devinette à l'écran). Sans prénom connu (projection) : « Merci, votre demande est enregistrée. ». Le texte de l'étape 2 s'adapte à la nature : projection → « Votre projection arrive {quand}. » ; message de contact → « Nous vous répondons {quand}. » (sans jour choisi, `{quand}` vaut « sous 48 h ouvrées ») ; « Être rappelé » depuis la page de contact → le texte d'un rappel (DEM-015).

**DEM-024** `[P1]` **Seconde demande identique.** Même adresse e-mail, même nature, même objet (même bien, ou même programme, ou aucun), moins de 24 heures après la première, première non clôturée : **aucune nouvelle demande** n'est créée.
- **Rien ne se perd.** Tout ce que ce second envoi dit de différent — téléphone corrigé, nom mieux écrit, autre créneau, autre message, case WhatsApp — est gardé sur la première demande comme **complément** (`Lead.supplements` : date, champs différents, message). Les champs **vides** de la fiche sont complétés ; un champ déjà rempli n'est pas écrasé : le conseiller voit « Autre téléphone indiqué : … » et tranche. Il est notifié (`lead.supplemented`, `NS_LEAD_SUPPLEMENTED`).
- **Rien ne fuit.** L'écran affiche la **confirmation ordinaire** (DEM-023) — sans référence pour un visiteur : les références se suivent, et celle d'une demande plus ancienne trahirait son existence. Il ne dit ni « déjà reçue », ni la date de la première : quelqu'un qui saisit l'adresse d'un autre n'apprend pas que cette personne a fait une demande (TRV-112).
- **L'accusé de réception repart**, identique, avec la référence de la première demande : la confirmation à l'écran l'annonce (DEM-023), et celui qui n'avait pas reçu le premier — adresse corrigée, boîte pleine — l'obtient (TRV-097). Les limites de DEM-032 bornent le nombre d'envois vers une même adresse.

**DEM-026** `[P1]` **Bien devenu indisponible pendant la saisie.** La demande est créée quand même ; ce qui suit dépend de ce qui est arrivé au bien (CYC-073) :

| Le bien est devenu | Le bien entre au dossier | La confirmation ajoute |
|---|---|---|
| Entièrement **réservé** (`RESERVED`) | `INTERESTED` : une option peut tomber | « Tous les lots de ce bien sont réservés pour le moment. Votre conseiller vous dit s'il s'en libère un, et vous propose des biens équivalents. » |
| **Vendu**, **retiré** ou archivé | `UNAVAILABLE` | « Ce bien n'est plus disponible. Votre conseiller vous propose des biens équivalents. » |
| Hors ligne (fiche dépubliée, CYC-121) | `INTERESTED` | Rien : la demande est reçue normalement. |

La fenêtre d'intérêt ne s'ouvre pas sur une fiche qui affiche déjà « Réservé », « Vendu » ou « n'est plus proposé » (FIC-052) : ce tableau ne sert qu'à la course entre la saisie et le changement.

**DEM-025** `[P1]` **Contenu enregistré** (`Lead.payload`) : tous les champs du formulaire, sous leurs clés, tels qu'ils ont été saisis — un champ facultatif laissé vide est envoyé `null`, et l'API l'accepte comme absent (D-097) —, plus :

```json
{
  "form": "PROPERTY_INTEREST",
  "formVersion": 1,
  "fields": { "firstName": "Yacine", "lastName": "Benali", "countryOfResidence": "FR", "budget": "150000", "budgetKind": "TOTAL", "wantsVideoVisit": true },
  "context": { "propertyReference": "DP-DZ-0142", "propertyTitle": "Appartement T3 – Résidence El Yasmine", "priceShown": "150000", "monthlyShown": "810", "currencyShown": "EUR" },
  "step2": null
}
```

`form` vaut `PARTNER_REQUEST` pour « Devenir partenaire » (EP-23) et `PARTNER_SIGNUP` pour une inscription partenaire (EP-32, ACP-081) : les deux ont la nature `PARTNER_REQUEST`, et c'est `form` qui les distingue. `context` garde ce que le visiteur **voyait** au moment d'envoyer (titre, prix, mensualité) : ces valeurs peuvent changer ensuite. Pour une demande sur un programme sans bien précis : `programName`, `programSlug`, sans prix. `formVersion` augmente quand la liste des champs d'un formulaire change. `step2` reçoit la complétion d'une projection (DEM-013). `form` est la nature de la demande (`LeadKind`), sauf pour un message écrit depuis l'espace client : `CLIENT_SPACE_MESSAGE` (MSG-021).

**DEM-027** `[P1]` **Réponse de `POST /public/leads`.** Elle n'en dit pas plus que l'écran (DEM-021, DEM-024, TRV-112). Pour un visiteur non connecté, elle est **toujours** `201` et ne porte que : `kind` ; `firstName` et `email`, tels qu'envoyés ; `preferredCallbackDate` et `preferredSlot`, d'après lesquels l'écran compose `{quand}` selon NOT-053 (l'API ne rend pas de texte, API-002) ; `accountHint` (`true` si la case « Créer mon espace client en même temps » était cochée, sans dire si un espace existait) ; `propertyOutcome` (`RESERVED`, `UNAVAILABLE` ou `null` : la phrase de DEM-026). Ni `id`, ni `reference`, ni date, ni indication qu'une demande existait déjà — y compris quand l'envoi complète une demande (DEM-024) ou est classé indésirable (DEM-031) : la réponse a alors exactement la même forme. Pour un client connecté, elle ajoute `reference` (DEM-023). `[P1]` Pour une projection, elle ajoute le jeton du second écran (`completionToken`, DEM-013), que `POST /public/leads/complete` reçoit à la place d'un identifiant ; quand l'envoi complète une demande déjà reçue, le second écran s'ajoute à ce complément.

## 5. Protection

**DEM-030** `[P1]` **Contre les robots** (Q-034), sans gêner les visiteurs :
1. un **champ piège** invisible ; s'il est rempli, la demande est indésirable ;
2. un **jeton de formulaire** signé, remis à l'ouverture, qui date l'ouverture : un envoi en moins de 3 secondes est suspect ;
3. la **limitation de débit** (DEM-032) ;
4. un **défi non intrusif**, seulement si le score de DEM-031 se situe entre 40 et le seuil, et si un service de défi est configuré : l'API répond `403` avec le code `CHALLENGE_REQUIRED` (TRV-110), le formulaire affiche le défi sans effacer la saisie, puis renvoie la demande avec la preuve. Sans service de défi, ou si le défi échoue trois fois : la demande est acceptée et marquée « À vérifier » (`needsReview`).

**Échanges avec l'API.** `POST /public/form-token` : corps `{form}` (la nature du formulaire, `LeadKind`), réponse `{token, expiresAt}` (24 heures, DEM-040). `POST /public/leads` porte ce jeton dans l'en-tête `X-Form-Token` et, après un `CHALLENGE_REQUIRED`, la preuve du défi dans le champ `challengeToken` du corps. Le service de défi est celui de Q-034, branché derrière cette interface (`CHALLENGE_SITE_KEY`, `CHALLENGE_SECRET`, ENV-040) : en changer ne touche que le composant du défi. Le nom et la forme du champ piège ne sont pas fixés par ce dossier : ils restent dans le code.

**DEM-031** `[P1]` **Score d'indésirabilité** (`spamScore`, 0 à 100), somme plafonnée à 100 :

| Signal | Code (`SpamSignal`) | Points |
|---|---|---|
| Champ piège rempli | `HONEYPOT` | 100 |
| Envoi moins de 3 secondes après l'affichage du formulaire | `FAST_SUBMIT` | 35 |
| Plus de deux liens dans le message | `MANY_LINKS` | 30 |
| Domaine d'e-mail jetable (liste tenue à jour) | `DISPOSABLE_DOMAIN` | 30 |
| Plus de trois demandes de la même adresse IP en 10 minutes | `IP_BURST` | 20 |
| Message identique à un message reçu d'une autre adresse dans les 24 heures | `DUPLICATE_MESSAGE` | 30 |
| Domaine d'e-mail sans serveur de messagerie (vérification faite pendant l'envoi, en 500 ms au plus ; sans réponse dans ce délai : 0 point) | `NO_MX` | 20 |
| Indicatif du téléphone sans rapport avec le pays de résidence | `PHONE_COUNTRY_MISMATCH` | 10 |
| Message entièrement en capitales | `ALL_CAPS` | 10 |

Les signaux retenus sont gardés avec la demande (`Lead.spamSignals`) : ils ne se recalculent pas après coup, et la fiche de la demande les montre (CRM-010).

Aucun signal ordinaire ne suffit seul, ni à deux, à écarter quelqu'un — les deux plus lourds font 65, sous le seuil : un réseau partagé (un Café, une famille) et un formulaire rempli d'un trait par le navigateur ne font pas un robot. Il en faut trois.

| Score | Ce qui arrive |
|---|---|
| Champ piège rempli (100) | Demande créée **directement** à l'état `SPAM`. Ni fiche client, ni dossier, ni e-mail, ni notification. Le visiteur voit la confirmation habituelle. |
| À partir de `leads.spamThreshold` (70), sans le champ piège | Même traitement, mais la demande porte `needsReview` : elle est **comptée** sur le tableau de bord (« Demandes écartées à vérifier », TDB-010) et dans le résumé du matin des administrateurs. Quelqu'un la regarde donc dans la journée : « Demande légitime » la restaure (CYC-006), « Indésirable » confirme. |
| De 40 au seuil | Défi (DEM-030), puis demande créée normalement, marquée « À vérifier » dans la liste des demandes. Son accusé de réception part. |
| Moins de 40 | Demande normale. |

Une demande `SPAM` reste `retention.spamDays` jours (90) dans le filtre « Indésirables », d'où le personnel peut la **restaurer** : la fiche client et le dossier sont alors créés comme pour une demande normale (CYC-006).

**DEM-032** `[P1]` **Limites**, par adresse IP : 5 demandes par heure et 20 par jour, tous formulaires confondus. Par adresse e-mail : 5 par jour. Au-delà : `429` (SEC-070), avec le délai avant le prochain envoi possible (`Retry-After`). Le message dit la vérité sur ce délai (TRV-110) :
- cinq minutes ou moins : « Trop de demandes en peu de temps. Réessayez dans un instant. » ;
- au-delà (limite de l'heure ou du jour) : « Vous avez envoyé plusieurs demandes aujourd'hui : nous les avons bien reçues. Pour une autre question, écrivez-nous{ à {contact.email}}{ ou appelez le {contact.phone}}. » — les coordonnées n'apparaissent que si elles sont renseignées ; la saisie en cours est conservée (TRV-092).

## 6. Erreurs

**DEM-040** `[P1]`

| Cas | Comportement |
|---|---|
| Champ invalide | Message sous le champ ; le premier champ en erreur reçoit le focus (TRV-061). |
| Erreur renvoyée par le serveur sur un champ | Affichée sous ce champ, comme une erreur de saisie. |
| Hors connexion, serveur injoignable, délai dépassé | Le bandeau de TRV-082 : « Connexion interrompue. Vos saisies sont conservées, nous réessayons… » ; le bouton d'envoi est désactivé ; l'envoi repart de lui-même au retour de la connexion si la personne est restée sur l'écran. La même clé d'idempotence est réutilisée, pour qu'un envoi déjà arrivé ne soit pas doublé. |
| Erreur du serveur | Le message de TRV-110 (`500`) : « Un problème est survenu de notre côté. Réessayez ; si cela continue, contactez-nous en indiquant le code {identifiant}. » (TRV-111) ; « contactez-nous » mène aux coordonnées renseignées (téléphone, e-mail), ou à `/contact`. La saisie est conservée. |
| Jeton de formulaire expiré (formulaire ouvert depuis plus de 24 h) | Un nouveau jeton est demandé en silence et l'envoi est rejoué une fois. |
