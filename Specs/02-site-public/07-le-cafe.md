# Le Café

`[P1]` — écart E1, actif quand `features.cafe` est vrai. Écrans **EP-13** (prochaines dates), **EP-14** (un Café et son inscription), **EP-15** (gérer mon inscription). La gestion côté équipe est dans `04-back-office/10`. Les statuts et leurs transitions : CYC-180 à CYC-187.

**Le Café** répond au premier blocage de la diaspora : ne rencontrer les promoteurs qu'une fois par an. Au moins une fois par mois, à Paris et dans le Sud de la France, un promoteur et un banquier reçoivent les visiteurs autour d'un café. C'est gratuit, sur inscription, et le lieu exact n'est donné qu'aux inscrits.

Toutes les règles de ce fichier portent l'étiquette `[P1]`.

---

## 1. Prochaines dates (EP-13)

**CAF-001** Adresse `/le-cafe`. De haut en bas :

| Zone | Contenu |
|---|---|
| Surtitre | Le nom complet de l'événement, `events.fullBrandName` (« Le Café Diaspora Patrimoine ») ; c'est aussi la balise de titre de la page. Le nom court `events.brandName` sert au menu, au fil d'Ariane et aux boutons. |
| Titre | « Rencontrez promoteur et banquier » · « autour d'un café » ; à côté, la photo de la section Café de l'accueil (bloc `home.cafe.photo`), et, sans elle, la scène dessinée (DSN-076, D-097) |
| Présentation | Bloc `cafe.intro` : « Vous venez avec vos questions, vous repartez avec une projection. À Paris et dans le Sud de la France, au moins une fois par mois. » |
| Comment ça se passe | Trois temps (bloc `cafe.steps`) : « Vous vous inscrivez » — « En deux minutes. Le lieu exact vous est envoyé par e-mail. » · « Vous échangez » — « Un promoteur et un banquier répondent à vos questions, autour d'un café. » · « Vous repartez avec votre projection » — « Budget, mensualité, biens possibles : votre projet prend forme. » |
| Prochaines dates | Une carte par Café (CAF-002). |
| Rappel | « Gratuit, sur inscription. Le lieu exact vous est communiqué à l'inscription. » |
| Me prévenir | CAF-040. |
| Questions fréquentes | Les questions dont l'emplacement est `LE_CAFE` (EDI-040). |

**CAF-002** **Cafés listés** : publiés ou aux inscriptions closes, dont le début est à venir, par date croissante. Un Café annulé reste listé 7 jours avec la mention « Annulé ». Chaque carte : le lieu (`locationLabel`), le jour de la semaine, le numéro du jour, le mois, l'horaire, la ligne sur les présents (ACC-061), l'état et le bouton (CYC-181). La carte entière mène à la page du Café.

**CAF-003** S'il existe au moins deux lieux différents parmi les Cafés listés : des pastilles « Tous » · « {lieu} » · « {lieu} » filtrent la liste.

**CAF-004** **Aucun Café à venir** : la liste est remplacée par « Les prochaines dates seront bientôt annoncées. » et le bloc « Me prévenir », ouvert.

## 2. Un Café (EP-14)

**CAF-010** Adresse `/le-cafe/{slug}`. Sur ordinateur, deux colonnes : les informations à gauche, le **formulaire d'inscription** à droite, collant.

| Zone | Contenu |
|---|---|
| En-tête | Fil d'Ariane · « Le Café – {lieu} » · la date longue · « de {début} à {fin} (heure de {ville}) » · l'état (CYC-181) · « Partager ». |
| Lieu | `locationLabel` et la ville. Phrase fixe : « L'adresse exacte vous est envoyée par e-mail à l'inscription. ». Aucune carte, aucune adresse. |
| Qui sera là | Les participants publics du Café (`EventPartner.isPublic`), par type : « Promoteurs » · « Banques » · « Autres », avec logo et nom. Sans participant public : bloc masqué. |
| Description | `Event.description` ; à défaut, le bloc `cafe.defaultDescription`. |
| En pratique | « Gratuit » · « Sur inscription, jusqu'à {n} personnes par inscription » · « Durée : {durée} » · « Venez avec vos questions : budget, financement, délais ». |
| Questions fréquentes | Emplacement `LE_CAFE`. |

**CAF-011** Les heures sont celles du **lieu** (TRV-031). Si le fuseau du visiteur diffère, rien n'est converti : c'est un rendez-vous physique.

**CAF-012** **Selon l'état du Café.**

| État | Zone d'inscription |
|---|---|
| Inscriptions à venir | « Ouverture des inscriptions le {date}. » et le formulaire « Me prévenir » pour ce Café (CAF-040). |
| Ouvert, places disponibles | Le formulaire (CAF-020), bouton « Je m'inscris ». |
| Ouvert, complet | Le formulaire, précédé de « Ce Café est complet. Inscrivez-vous sur la liste d'attente : nous vous prévenons dès qu'une place se libère. », bouton « M'inscrire sur la liste d'attente ». |
| Inscriptions closes | « Les inscriptions sont closes. » et les prochains Cafés. |
| Annulé | Bandeau « Ce Café est annulé. » avec le motif public, et les prochains Cafés. |
| Passé | « Ce Café a eu lieu. » et les prochains Cafés. La page reste en ligne 30 jours (NAV-041). |

## 3. Inscription

**CAF-020** **Formulaire.**

| Champ | Clé | Oblig. | Règles |
|---|---|---|---|
| Prénom | `firstName` | oui | |
| Nom | `lastName` | oui | |
| E-mail | `email` | oui | Reçoit le lieu exact. |
| Téléphone | `phone` | non | Avec la case WhatsApp. |
| Vous venez à combien ? | `seats` | oui | De 1 à `Event.maxSeatsPerRegistration` ; défaut 1. Jamais plus que les places restantes, sauf sur liste d'attente. |
| Ce qui vous intéresse | `topics` | non | Cases : Les programmes disponibles · Le financement · Le financement islamique (si `features.islamicFinance`) · Les démarches. Valeurs envoyées à l'API : `PROGRAMS`, `FINANCING`, `ISLAMIC_FINANCING`, `PROCEDURES`, enregistrées en `EventTopic` (`PROGRAMMES`, `FINANCING`, `ISLAMIC_FINANCE`, `PROCEDURE`, D-097). |
| Vos questions pour le promoteur et le banquier | `questions` | non | 1 000 caractères. |
| Consentement | — | oui | « J'accepte que Diaspora Patrimoine m'envoie les informations pratiques de ce Café et me recontacte au sujet de mon projet. [Politique de confidentialité] » |
| Actualités | `marketingOptIn` | — | Case décochée (DEM-020). |

Pour un client connecté : coordonnées déjà connues, non redemandées (DEM-022).

**CAF-021** **À l'envoi**, dans une transaction, sous verrou du Café (MOD-410) :
1. la fiche client est retrouvée par l'e-mail ou créée, avec l'origine `CAFE` ;
2. les consentements sont enregistrés (source `cafe:registration`) ;
3. s'il reste assez de places : inscription `REGISTERED` — même si le visiteur demandait la liste d'attente : des places se sont libérées entre-temps (D-097) ; sinon : `WAITLISTED` — **seulement** si le visiteur l'a demandé (CAF-022) ;
4. un code d'accueil et un lien de gestion sont créés (CAF-030) ;
5. l'événement `registration.created` ou `registration.waitlisted` est émis (e-mails `C_CAFE_REGISTERED`, `C_CAFE_WAITLISTED`).

Une inscription n'est **pas** une demande : elle n'ouvre pas de dossier. Le suivi après le Café passe par une tâche (AUT-056) et par l'enquête (PAR-070).

**CAF-022** **Plus assez de places au moment de l'envoi** (un autre visiteur a été plus rapide). Rien n'est créé. Le formulaire affiche :

> « Il ne reste que {n} places. » — **Réserver {n} places** · **M'inscrire sur la liste d'attente pour {demandé} places**

et s'il ne reste aucune place : « Ce Café vient d'afficher complet. » — **M'inscrire sur la liste d'attente**.

Ce refus n'est pas retenu par la clé d'idempotence, qui ne garde que les réussites (API-040) : le second envoi, avec le choix du visiteur, est traité comme un envoi neuf.

**CAF-023** **Confirmation**, à la place du formulaire :

> **« C'est noté, {prénom}. Votre place est réservée. »** (ou « Vos {n} places sont réservées. »)
> « {date longue}, de {début} à {fin} »
> « {nom du lieu}, {adresse} » — {indications d'accès}
> « Votre code d'accueil : {code} » et son QR code
> « Tout est récapitulé dans l'e-mail que nous venons de vous envoyer. »

Boutons : « Ajouter à mon agenda » (CAF-050) · « Gérer mon inscription » · « Découvrir les programmes ». Sur liste d'attente : « Vous êtes sur la liste d'attente. Dès qu'une place se libère, elle vous est attribuée et nous vous prévenons par e-mail. », sans lieu ni code.

**CAF-024** **Déjà inscrit** (même e-mail, inscription non annulée).
- **Client connecté** — on sait qui il est : son inscription est mise à jour (CYC-186) et l'écran dit « Vous étiez déjà inscrit à ce Café : nous avons mis à jour votre inscription. ».
- **Ordre des contrôles** (D-097) : les places sont contrôlées d'abord (CAF-022) — la réponse ne dépend donc pas de l'existence d'une inscription —, puis l'inscription existante est cherchée.
- **Sans connexion** — une adresse saisie ne prouve rien : l'inscription existante **n'est pas modifiée**, et l'écran ne dit pas qu'elle existe (TRV-112). Il affiche : « C'est noté. Vous recevez un e-mail avec toutes les informations et le lien pour gérer votre inscription. », sans lieu ni code. La réponse est celle d'un envoi réussi (`outcome` = `SENT`) et l'événement technique `registration.confirmation_requested` (AUT-013) renvoie l'e-mail de confirmation à l'adresse, avec son lien de gestion : c'est par ce lien que son titulaire change le nombre de places ou ses questions (CAF-030). Personne ne peut donc modifier, ni découvrir, l'inscription d'un autre en saisissant son adresse.

**CAF-025** Le Café s'est fermé, a été annulé ou a commencé pendant la saisie : rien n'est créé ; le formulaire est remplacé par l'état correspondant de CAF-012.

**CAF-026** **Protection.** Champ piège, jeton de formulaire et limites de débit comme pour les demandes (DEM-030, DEM-032). Une inscription dont le score atteint le seuil d'indésirabilité n'est **pas** créée — elle prendrait une vraie place : le visiteur voit « Votre inscription n'a pas pu être enregistrée. Contactez-nous. » (réponse `409 CONFLICT_STATE`, raison `REGISTRATION_REFUSED`). Le défi anti-robots de DEM-030 (point 4) ne s'applique pas à une inscription : seul compte le seuil (D-097).

## 4. Gérer mon inscription (EP-15)

**CAF-030** Adresse `/le-cafe/inscription/{jeton}`, reçue dans chaque e-mail. Aucune connexion n'est demandée. Le jeton est calculé (HMAC de l'identifiant de l'inscription par `LINK_SIGNING_KEY`, en hexadécimal minuscule) et n'est gardé qu'en empreinte SHA-256 : le même lien peut être remis dans chaque e-mail de l'inscription, et il survit à la mise en minuscules des adresses (NAV-002, D-097). La page affiche : le Café, la date, le lieu exact, le nombre de places, le code d'accueil et son QR code, l'état de l'inscription.

**CAF-031** **Actions**, jusqu'au début du Café :

| Action | Règle |
|---|---|
| Modifier le nombre de places | À la baisse : toujours. À la hausse : dans la limite des places libres, sinon « Il ne reste que {n} places. » (CYC-187). |
| Modifier mes questions et centres d'intérêt | Les mêmes champs qu'à l'inscription (CAF-020), préremplis ; « Enregistré. ». C'est ce que CAF-024 promet au titulaire du lien. |
| Annuler mon inscription | Confirmation : « Annuler votre inscription au Café du {date} ? Votre place sera proposée à une autre personne. » · motif facultatif. Effets : CYC-185. |
| Ajouter à mon agenda | CAF-050. |

**CAF-032** **Selon l'état.**

| État | Affichage |
|---|---|
| `WAITLISTED` | « Vous êtes sur la liste d'attente. » · actions : modifier le nombre de places, annuler. Ni lieu ni code. |
| `CANCELLED` | « Votre inscription est annulée. » et, si le Café est encore ouvert, « Me réinscrire ». |
| `ATTENDED`, ou Café passé | « Ce Café a eu lieu. Merci de votre présence. Un conseiller vous rappelle si vous l'avez demandé ; sinon, écrivez-nous quand vous voulez. » (le texte de `C_CAFE_THANKS` ; l'inscription n'ouvre pas de dossier et ne promet pas de projection, CAF-021), « Donner mon avis » tant que l'enquête du Café est ouverte (SFA-040), et les prochains Cafés. |
| Café annulé | « Ce Café est annulé. » avec le motif, et les prochains Cafés. |
| Jeton inconnu | Page « Ce lien a expiré ou a déjà été utilisé. » (`410` de l'API ; la page est servie en `200` avec `noindex`, NAV-041), avec le lien vers `/le-cafe`. |

Un client connecté retrouve les mêmes actions dans « Mes Cafés » (SFA-040).

## 5. Me prévenir

**CAF-040** Un champ e-mail et, s'il existe plusieurs lieux, le choix « Tous les lieux » · « {lieu} ». Sur la page d'un Café dont les inscriptions ne sont pas ouvertes, la demande porte **ce** Café. Mention sous le champ : « Vous recevrez un seul e-mail, à l'ouverture des inscriptions. ». Bouton « Me prévenir ». Confirmation : « C'est noté. Nous vous écrivons dès l'ouverture des inscriptions. ». Une demande identique déjà enregistrée donne la même confirmation, sans doublon.

**CAF-041** À l'ouverture des inscriptions d'un Café (`R_CAFE_OPENING`), reçoivent `C_CAFE_OPENING` : les demandes qui portent ce Café ; celles qui portent son lieu ; celles sans lieu. Chaque demande n'est servie **qu'une fois** (`notifiedAt`). L'e-mail contient un lien de désinscription. Pour continuer à recevoir les dates, la personne s'inscrit aux actualités (groupe `NEWS`).

## 6. Agenda et code d'accueil

**CAF-050** **Fichier d'agenda** (`.ics`), joint aux e-mails de confirmation et téléchargeable : titre « Le Café Diaspora Patrimoine – {lieu} » ; début et fin avec le fuseau du lieu ; lieu exact ; description avec le lien « Gérer mon inscription » ; un identifiant stable par inscription, pour qu'un changement de date **remplace** l'entrée au lieu d'en créer une seconde ; un rappel la veille.

**CAF-051** **Code d'accueil** : six caractères, lettres capitales et chiffres, sans caractère ambigu (ni `0`, ni `O`, ni `1`, ni `I`, ni `L`), unique par Café. Le QR code contient l'adresse de pointage du back-office avec ce code — `{ADMIN_URL}/back-office/cafes/pointage?cafe={référence du Café}&code={code}` (à défaut de `ADMIN_URL`, `WEB_URL`), chemin provisoire tant que l'écran de pointage (EVT-050) n'est pas livré (D-097) : scanné par un membre de l'équipe connecté, il ouvre la fiche de l'inscrit, prête à pointer (EVT-050). Scanné par quelqu'un d'autre, il mène à la page de connexion du back-office et ne révèle rien.

## 7. Référencement et téléphone

**CAF-060** Données structurées et titre : NAV-032, NAV-035. Le lieu exact ne figure dans aucune donnée publique.

**CAF-061** Sur téléphone : le formulaire d'inscription vient juste après l'en-tête du Café, avant « Qui sera là » ; un bouton fixe « Je m'inscris » fait défiler jusqu'à lui tant qu'il n'est pas à l'écran. Tant que le bandeau des cookies est ouvert, le bouton fixe est masqué (NAV-050 : un seul élément fixe en bas).
