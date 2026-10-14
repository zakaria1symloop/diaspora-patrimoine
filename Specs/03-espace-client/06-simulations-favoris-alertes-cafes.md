# Espace client — simulations, favoris, alertes, Cafés

Écrans **EC-40** (Mes simulations), **EC-41** (Favoris), **EC-42** (Alertes), **EC-43** (Mes Cafés), et la page publique à jeton **EP-26** (gérer une alerte sans compte).

---

## 1. Mes simulations (EC-40)

**SFA-010** `[P1]` La page liste, de la plus récente à la plus ancienne :
- les simulations **enregistrées** par le client (`isSaved`) ;
- les **projections** que son conseiller lui a envoyées `[P1]`.

Chaque ligne : le type (« Éligibilité » · « Crédit » · « Projection »), le nom, la date, le résultat principal tel qu'il a été calculé (« Budget maximal : 175 000 € » ; sans budget : « Capacité d'emprunt : 154 000 € », arrondie comme à l'écran du résultat (CAL-026) · « 894,69 € / mois sur 20 ans » (120 000 € à 6,50 %) — au centime, comme sur l'écran du simulateur ; l'arrondi à la dizaine ne vaut que pour la mensualité indicative des cartes et de la fiche, CAL-022), et le bien concerné s'il y en a un. « ≈ » seulement devant un montant converti (SIM-003).

**Présentation** (D-099). Une carte par simulation, le résultat d'abord ; « Ouvrir » affiche le résultat dans un panneau à droite qui laisse la liste visible (l'adresse le garde : `ouvrir={id}`), avec ses autres actions ; « Renommer » se fait sur la carte, sans fenêtre ; « Supprimer » garde sa confirmation. Filtre par type (« Toutes » · « Éligibilité » · « Crédit » · « Projections », avec compteurs), tri (« Les plus récentes » · « Les plus anciennes » · « Par nom ») et, au-delà de quatre, recherche — dans la page (trente au plus, SFA-012), état dans l'adresse. En tête, la dernière estimation, présentée comme telle et jamais comme un prix : un budget — « Votre budget estimé : {montant} » · « D'après votre simulation du {date}. C'est une estimation : votre conseiller peut la préciser avec vous. » · « Voir les biens dans ce budget » (catalogue filtré par `priceMax`, seulement pour un montant non converti) · « En parler à mon conseiller » ; sinon une mensualité — « Votre dernière estimation : {montant} par mois » · « D'après votre simulation du {date}. C'est une estimation, pas une offre de crédit. ». Les deux simulateurs restent à un geste, en tête de page.

**SFA-011** `[P1]` **Actions.**

| Action | Effet |
|---|---|
| Ouvrir | Affiche le résultat **tel qu'il a été calculé**, avec la mention « Calculée le {date}, avec les barèmes et les taux de ce jour-là. » (MOD-370). |
| Refaire avec les barèmes actuels | Ouvre le simulateur prérempli avec les mêmes réglages. Le nouveau résultat est une nouvelle simulation. Si la solution de financement choisie à l'époque n'est plus proposée : le simulateur s'ouvre sur le barème indicatif, avec « La solution utilisée le {date} n'est plus proposée : le calcul repart du barème indicatif. ». Si le bien n'est plus en ligne : le simulateur s'ouvre sans lui, avec le prix d'alors. |
| Renommer | Nom libre, 120 caractères. À défaut : « Simulation du {date} ». |
| Télécharger (PDF) | SIM-040. |
| En parler à mon conseiller | Ouvre la messagerie (ou son repli, MSG-021) avec « Au sujet de ma simulation du {date} : ». Le conseiller voit les simulations du client dans sa fiche. |
| Supprimer | Après confirmation (`DELETE /client/simulations/{id}`). `isSaved` passe à faux : la simulation disparaît de « Mes simulations ». Rien n'est effacé par ce geste : rattachée à une demande ou à un dossier, elle reste visible du conseiller, comme pièce du suivi ; sinon, la tâche `purge` l'efface (AUT-091, MOD-371). |

Une projection ne se renomme pas et ne se supprime pas.

**SFA-012** `[P1]` Trente simulations enregistrées au plus. Au-delà : « Vous avez atteint le nombre maximal de simulations enregistrées. Supprimez-en une pour en garder une nouvelle. ».

**SFA-013** `[P1]` **Aucune simulation** : « Vous n'avez pas encore de simulation enregistrée. » · boutons « Tester mon éligibilité » · « Calculer mes mensualités ».

## 2. Favoris (EC-41)

**SFA-020** `[P1]` **Le cœur** figure sur chaque carte de bien et sur chaque fiche (`features.favorites`). Un clic ajoute ou retire le bien des favoris, sans recharger la page, avec « Ajouté à vos favoris » · « Retiré de vos favoris » (et « Annuler »). **Ajouter un favori demande un compte (D-103)** : sans session, le clic n’ajoute rien et ouvre la fenêtre « Gardez ce bien dans vos favoris » (SFA-021).

**SFA-021** `[P1]` **Visiteur sans compte (D-103)** : le cœur ouvre la fenêtre « Gardez ce bien dans vos favoris » — « Vos favoris se retrouvent dans votre espace, sur tous vos appareils. Connectez-vous ou créez votre espace : ce bien y sera ajouté aussitôt. » — avec « Se connecter », « Créer mon espace » et « Plus tard ». Le bien est retenu dans le navigateur (`dp_favorite_pending`, NAV-051) et rejoint les favoris du compte dès la session ouverte (connexion, vérification de l'e-mail, activation, lien), puis le visiteur revient où il était ; « Plus tard » l'oublie. Rien n'est ajouté sans compte. Les favoris qu'un navigateur gardait d'avant cette règle (`dp_favorites`, jusqu'à vingt, référence et date d'ajout) restent lisibles sur « Mes favoris » (`/favoris`, biens relus en cartes par `GET /public/properties/cards`, API-100), peuvent en être retirés, et sont rapatriés sur le compte à la connexion ou à l'inscription (sans doublon). Un client connecté qui ouvre `/favoris` est mené à `/espace-client/favoris`.

**SFA-022** `[P1]` **Page Favoris** : les biens en cartes (CAT-040), du plus récemment ajouté au plus ancien, chacun avec la date d'ajout, le bouton « Exprimer mon intérêt » et le cœur. Un bien devenu réservé ou vendu reste, voilé, avec son bandeau. Un bien archivé reste 30 jours avec « Ce bien n'est plus proposé », puis est retiré.

**Carte d'un favori** (D-099) — propre à cette page, pas celle du catalogue : ce qui a changé depuis l'ajout (la dernière notification `NC_FAVORITE_UPDATE` de ce bien : « Prix en baisse » · « Derniers lots » · « Plus disponible », sa phrase et sa date, AUT-062), la date d'ajout, le programme, le lieu, la surface et la livraison, les trois chiffres de CAT-040 (prix, apport, mensualité indicative avec astérisque et note), puis **une** action principale — « Exprimer mon intérêt » (la fiche avec la fenêtre d'intérêt), ou « Suivre dans mes intérêts » quand un intérêt est déjà envoyé (`interest`) — et « Voir le bien » ; en secondaire : « Comparer », « Écrire à mon conseiller » (message prérempli), « Retirer » (avec « Annuler » dans le message bref). La photo et le titre ouvrent la fiche. **Comparer dans l'espace** : la case alimente la même sélection que le site (`dp_compare`, trois au plus, CAT-092) ; une barre en bas de la page dit combien de biens sont choisis et mène au comparateur avec ces références (`/comparer?biens=…`), dès deux. Filtre « Tous » · « Disponibles » · « Ont changé » · « Intérêt envoyé » · « Plus proposés », tri « Ajout récent » · « Prix croissant » · « Mensualité croissante », recherche au-delà de quatre — dans la page (cent au plus), état dans l'adresse. En tête : des favoris ont changé — « Un de vos favoris a changé » / « {n} de vos favoris ont changé » · « Prix, disponibilité : regardez ce qui a bougé depuis que vous les avez mis de côté. » · « Voir ce qui a changé » ; sinon, aucun intérêt envoyé — « {n} biens mis de côté » · « Un bien vous plaît vraiment ? Exprimez votre intérêt : un conseiller vous rappelle pour en parler, sans engagement. » (et l'invitation à comparer).

**SFA-023** `[P1]` Cent favoris au plus. Les changements sur un favori sont signalés (AUT-062). Le conseiller du client voit ses favoris : ils l'aident à proposer.

**SFA-024** `[P1]` **Aucun favori** : « Touchez le cœur d'un bien pour le retrouver ici. » · bouton « Découvrir les biens ».

## 3. Alertes (EC-42)

**SFA-030** `[P1]` La page liste les alertes du client (`features.searchAlerts`), y compris celles créées sans compte avec la même adresse e-mail. Chaque ligne : le libellé (CAT-022), la fréquence, l'état (« Active jusqu'au {date} » · « En pause » · « Expirée »), la date du dernier envoi.

**SFA-031** `[P1]` **Actions.**

| Action | Effet |
|---|---|
| Voir les biens | Catalogue avec les critères de l'alerte. |
| Modifier les critères | Ouvre le catalogue et ses filtres (CAT-030) avec ces critères ; le bouton principal devient « Mettre à jour l'alerte ». L'alerte visée est gardée dans le stockage de session de l'onglet (`dp_alert_edit`, NAV-051), le catalogue retirant de l'adresse les paramètres qu'il ne connaît pas (D-097). |
| Changer la fréquence | « Dès qu'un bien correspond » · « Une fois par jour » · « Une fois par semaine ». |
| Mettre en pause · Réactiver | Une alerte en pause n'envoie rien ; sa durée de vie continue de courir. |
| Prolonger | Repousse la fin de `alerts.lifetimeDays` jours (AUT-061). Réactive une alerte expirée. |
| Supprimer | Après confirmation ; définitif. |

**Présentation** (D-099) : une carte par alerte, ses critères en pastilles (CAT-022) et son état d'abord ; la fréquence en trois choix enregistrés aussitôt ; **une** action principale — « Voir les biens », ou « Activer » / « Prolonger » quand c'est ce qui est attendu (en attente, expirée, ou à moins de quatorze jours de sa fin) — et les autres en secondaire. Une recherche enregistrée se renomme sur sa carte. Filtre « Tout » · « Alertes actives » · « En pause » · « À activer » · « Expirées » · « Recherches », avec leurs compteurs, gardé dans l'adresse (`etat=`). En tête : une alerte qui se termine bientôt — « Une alerte se termine bientôt » · « Prolongez-la d'un geste pour continuer à recevoir les nouveautés. » ; sinon des alertes actives — « Une alerte veille pour vous » / « {n} alertes veillent pour vous » · « Dès qu'un nouveau bien correspond, nous vous écrivons. Vous n'avez rien à surveiller. » ; sinon, toutes en pause — « Vos alertes sont en pause » · « Réactivez-en une pour recevoir de nouveau les biens qui correspondent. ». Créer une alerte se fait depuis le catalogue (CAT-070) ; la page y renvoie par le bouton « Créer une alerte ». Une alerte non confirmée de la même adresse, créée sans compte, s'y active d'un geste : l'adresse du compte est déjà prouvée (D-097). Dix alertes actives au plus ; les recherches enregistrées, qui n'envoient rien, n'y comptent pas et ont leur propre limite de vingt (CAT-093, Q-051).

**SFA-035** `[P1]` **Sans compte : la page à jeton** (EP-26, `/alertes/{jeton}`), atteinte depuis les e-mails. Selon le lien :

| Lien | Effet |
|---|---|
| Confirmation (`C_ALERT_CONFIRM`) | Active l'alerte : « Votre alerte est active. Vous recevrez les nouveaux biens correspondant à : {libellé}. » |
| Prolongation (`C_ALERT_EXPIRING`) | Prolonge : « Votre alerte est prolongée jusqu'au {date}. » |
| Gestion (pied de chaque e-mail d'alerte, et `C_ALERT_MANAGE`) | Affiche l'alerte et permet de changer la fréquence, de la mettre en pause, de la supprimer (« Vous ne recevrez plus cette alerte. »). |
| Arrêt (`/alertes/{jeton}/arreter`, désinscription à un clic, NOT-022) | Arrête l'alerte et le dit. |

Un jeton inconnu ou une alerte supprimée : « Ce lien a expiré ou a déjà été utilisé. », avec **« Recevoir un nouveau lien »** : un champ e-mail (`POST /public/alerts/links`) ; la réponse est la même quelle que soit l'adresse (TRV-112) et, si une alerte non confirmée ou active existe pour cette adresse, l'e-mail de confirmation (`C_ALERT_CONFIRM`) ou de gestion (`C_ALERT_MANAGE`, un seul par jour et par adresse, qui liste le lien de chaque alerte) repart (TRV-125). Le lien de prolongation reste bon 30 jours après la fin de l'alerte : une alerte expirée se réveille encore depuis l'e-mail. La confirmation et la prolongation ne s'appliquent que dans un navigateur (CAT-071). La page propose aussi « Créer mon espace pour gérer toutes mes alertes ». « Supprimer l'alerte » agit tout de suite avec un message bref de 8 secondes et « Annuler » (TRV-081), pas une confirmation — l'alerte arrêtée se rétablit pendant 10 minutes, puis le lien répond qu'il a expiré ; une alerte arrêtée, ou jamais confirmée, est supprimée 30 jours plus tard (`alerts.daily`, D-097) ; la fréquence et la pause s'enregistrent aussitôt (« Préférence enregistrée. »), sans bouton « Enregistrer » ; une alerte en pause le dit (« En pause depuis le {date} · Reprendre »).

## 4. Mes Cafés (EC-43)

**SFA-040** `[P1]` Deux groupes (`features.cafe`).

**À venir** — une carte par inscription : le Café, la date, l'horaire, le **lieu exact** (nom, adresse, indications), le nombre de places, l'état (« Inscrit » · « Sur liste d'attente »), le **code d'accueil** et son QR code. Actions : celles de CAF-031 (modifier le nombre de places, annuler, ajouter à mon agenda).

**Passés** — une ligne par Café : date, lieu, « A eu lieu ». La présence notée par l'équipe n'est pas affichée. Si l'enquête du Café attend une réponse : « Donner mon avis ».

**SFA-041** `[P1]` Sous les deux groupes : les prochains Cafés ouverts auxquels le client n'est pas inscrit, avec « Je m'inscris » — l'inscription se fait en un clic de confirmation, ses coordonnées étant connues (CAF-020).

**SFA-042** `[P1]` Un Café annulé apparaît 30 jours dans « À venir » avec « Annulé » et le motif, puis passe dans « Passés ».
