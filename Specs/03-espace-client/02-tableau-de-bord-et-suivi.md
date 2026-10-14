# Espace client — structure, tableau de bord, suivi

Écrans **EC-10** (tableau de bord) et **EC-11** (mon dossier, onglets « Suivi » et « Mon bien »). L'espace client répond au principe 2 : **le client sait toujours où il en est, ce qu'il doit faire, et qui l'accompagne.**

Droits : ROL-030 à ROL-033. Le client ne voit que ses données ; il ne voit jamais les notes internes, les tâches, son score, ni les échanges avec les banques et les promoteurs.

---

## 1. Structure de l'espace

**ECL-001** `[P1]` **Navigation.** L'espace a son propre cadre, sans l'en-tête ni le pied de page du site public. Sur ordinateur : un menu latéral et la barre du haut (ECL-002). Sur téléphone : une barre de cinq onglets en bas de l'écran. Le cadre lit ce dont il a besoin par `GET /client/space` (API-100).

| Entrée | Adresse | Affichée | Écran |
|---|---|---|---|
| Tableau de bord | `/espace-client` | toujours | EC-10 |
| Mon dossier | `/espace-client/dossiers/{référence}` | dès qu'un dossier existe ; avec plusieurs dossiers, `/espace-client/dossiers` les liste | EC-11, EC-20 à EC-22 |
| — Mes pièces | `/espace-client/dossiers/{référence}/pieces` | sous-entrée de « Mon dossier », pour un dossier qui a une liste de pièces (D-097) | EC-20, EC-21 |
| Mes intérêts | `/espace-client/interets` | toujours | EC-12 |
| Biens proposés | `/espace-client/biens-proposes` | toujours ; pastille : nombre de propositions non consultées | EC-13 |
| Rendez-vous `[P1]` | `/espace-client/rendez-vous` | si `features.clientAppointments`, ou s'il a au moins un rendez-vous | EC-14 |
| Messages | `/espace-client/messages` | toujours ; pastille : messages non lus | EC-30 |
| Simulations | `/espace-client/simulations` | toujours | EC-40 |
| Favoris `[P1]` | `/espace-client/favoris` | si `features.favorites` | EC-41 |
| Alertes `[P1]` | `/espace-client/alertes` | si `features.searchAlerts` | EC-42 |
| Mes Cafés `[P1]` | `/espace-client/cafes` | si `features.cafe` | EC-43 |
| Mon avis | `/espace-client/avis` | toujours, une fois les enquêtes livrées (ECL-006) ; pastille quand une enquête attend | EC-54 |
| Profil | `/espace-client/profil` | toujours | EC-50 à EC-53 |

Onglets du téléphone : **Accueil** · **Dossier** · **Biens** (intérêts et propositions) · **Messages** · **Plus** (le reste). L'onglet « Dossier » sans dossier mène au tableau de bord. « Biens » ouvre une page à deux onglets, « Mes intérêts » (EC-12) puis « Biens proposés » (EC-13) ; sa pastille est celle de EC-13. « Messages » garde ce libellé à toutes les livraisons : avant la messagerie, sa page est le formulaire de MSG-021. « Plus » liste les autres entrées du menu latéral, dans leur ordre et avec leurs pastilles, puis « Mon profil » et « Se déconnecter ».

**ECL-002** `[P1]` **Barre du haut** : le logo (retour au site public), le lien « Voir les programmes », la **cloche** des notifications avec son compteur (MSG-040), le bouton « Aa » de la taille du texte (TRV-123), et le menu du compte (prénom, « Mon profil », « Revoir la visite » (TRV-126), « Se déconnecter »). Le bouton « Écrire à mon conseiller » (`common.writeToAdvisor`) est visible sur chaque écran de l'espace — dans la barre du haut sur ordinateur, au-dessus de la barre d'onglets sur téléphone — et mène à la messagerie, ou à son repli (MSG-021). La cloche et son compteur existent dès la première livraison de l'espace : tant que le panneau et la page des notifications ne sont pas livrés (EC-31), un clic sur la cloche mène au bloc « Dernières nouvelles » du tableau de bord, qui en tient lieu (ECL-010).

**ECL-003** `[P1]` **Mise à jour en direct.** Les pastilles, la cloche, l'étape du dossier, le statut des pièces et le fil des messages se mettent à jour sans recharger la page (NOT-019). Si la liaison en direct est coupée, la page se rafraîchit toutes les 60 secondes et à chaque retour sur l'onglet. Tant que le flux (API-070) n'est pas livré, ce rafraîchissement est le seul mécanisme (Q-068, D-097).

**ECL-004** `[P1]` **Consultation par l'équipe** (ROL-017) : quand un membre du personnel ouvre l'espace d'un client, un bandeau fixe l'indique — « Vous consultez l'espace de {prénom nom} en lecture seule » · « Quitter l'aperçu » —, toutes les actions sont inactives, et rien de ce qu'il lit n'est marqué comme lu ou vu pour le client. L'aperçu dure 30 minutes au plus.

**ECL-006** `[P1]` **Rien ne mène à une fonction qui n'est pas là.** L'espace client se livre par étapes (`08-tracabilite/02`, § 4) et certaines fonctions dépendent d'un indicateur. Une entrée de menu, un onglet, une carte ou un bouton n'apparaît que si ce qu'il ouvre est **livré et actif** ; sinon il est absent, ou remplacé par son repli :

| Élément | Tant que… | Repli |
|---|---|---|
| Boutons « Écrire », « Reprendre mon projet », « Relancer mon projet », « Poser une question » | la messagerie n'est pas livrée | « Écrire à mon conseiller » : un formulaire court dans l'espace (MSG-021), avec le même message prérempli. Le conseiller reçoit la demande et répond par e-mail ou par téléphone. L'entrée « Messages » reste, elle, au menu et dans les onglets (ECL-001) : sa page est ce même formulaire, qui est livré — elle ne mène donc pas à une fonction absente. |
| Onglets « Pièces », « Financement », « Mon bien » | leur module n'est pas livré | Onglet absent ; l'onglet « Suivi » reste. |
| « Je retiens ce bien » | le choix d'un bien n'est pas encore traité par l'équipe (paquet 3.7) | Bouton absent ; « Écrire à mon conseiller », message prérempli (« Je souhaite retenir {bien}. »). |
| « Ce bien ne m'intéresse plus », « Finalement, il m'intéresse », « Annuler mon choix » | les réponses sur un bien envisagé ne sont pas encore traitées par l'équipe (paquet 3.7) | Boutons absents ; « Écrire à mon conseiller », message prérempli « Au sujet de {bien} (réf. {référence}) : ». |
| « Tout voir » sous « Dernières nouvelles » ; page des notifications | EC-31 n'est pas livré | Lien absent ; le bloc montre les dix dernières nouvelles. |
| « Demander une visite », « Reprendre rendez-vous », « Proposer un créneau » | la demande de rendez-vous (INT-040) n'est pas livrée, ou `features.clientAppointments` est faux | Le bouton garde son libellé et ouvre « Écrire à mon conseiller » avec un message prérempli (« Je souhaite visiter {bien} (réf. {référence}). »), comme « Reprendre mon projet » (D-108). |
| « Gérer mes préférences », réglages des notifications | la page des préférences n'est pas livrée | Lien absent des écrans. Les e-mails d'un groupe portent leur lien de désinscription dès leur premier envoi (NOT-022). |

Les boutons des e-mails suivent la même règle (NOT-026).

**ECL-005** `[P1]` Toutes les pages de l'espace suivent les états de TRV-080, la reconnexion sans perte de TRV-083 et le pied de page réduit (NAV-021).

## 2. Tableau de bord (EC-10)

**ECL-010** `[P1]` Blocs, dans l'ordre. Un bloc sans contenu est masqué.

| # | Bloc | Contenu |
|---|---|---|
| 1 | Accueil | « Bonjour {prénom} » ; sans prénom : « Bonjour ». |
| 2 | **À faire** | ECL-011. |
| 3 | **Votre projet** | Les six étapes et la prochaine étape (§ 3), pour le dossier montré (ECL-014). |
| 4 | **Votre conseiller** | ECL-012. |
| 5 | Votre bien | Le bien retenu : photo, titre, lot, état de la réservation (ECL-032). Lien « Voir le détail ». |
| 6 | Prochain Café `[P1]` | S'il est inscrit à un Café à venir : date, lieu, « Gérer mon inscription ». Sinon, s'il n'a pas de dossier au-delà de `MATCHING` : le prochain Café et « Je m'inscris ». |
| 7 | Dernières nouvelles | Les cinq dernières notifications (NOT-030), non lues d'abord, et « Tout voir ». Cliquer une ligne ouvre ce qu'elle annonce et la marque lue. Avant la livraison de la page des notifications : dix lignes, sans « Tout voir » (ECL-006). Le bloc porte « Tout marquer comme lu » dès la livraison 2 (`POST /client/notifications/read-all`). |
| 8 | Raccourcis | « Voir les programmes » · « Simuler mon projet ». |

**Disposition** (D-099) : l'espace occupe toute la largeur à côté du menu. En tête, à côté du « Bonjour », le message d'encouragement de ECL-015 ; dessous, **« Vos repères »** : une tuile par chiffre utile, chacune menant à sa page — l'étape (« Étape {n} sur 6 » et son libellé), les pièces à déposer, les biens à découvrir (pastille « Nouveau »), les biens qui m'intéressent, les demandes en cours, les favoris, les simulations enregistrées, les alertes actives ; une tuile à zéro n'est pas affichée, six au plus, et la rangée entière est masquée sous deux tuiles. Les chiffres sont calculés par le serveur (`GET /client/dashboard`, champ `overview`, TRV-106). Puis les blocs, en trois colonnes sur un grand écran (À faire et Votre projet · Dernières nouvelles et Raccourcis · Votre conseiller, Votre bien, Café), deux sur un ordinateur, une sur un téléphone dans l'ordre du tableau. « Votre bien » montre les trois chiffres qui comptent (CAT-040) : prix, apport du financement de référence, mensualité indicative avec son astérisque et sa note (TRV-023) ; la carte entière ouvre la fiche. « Votre conseiller » rappelle le délai de réponse (« {conseiller} vous répond {quand}, par e-mail ou par téléphone. », NOT-053). « Dernières nouvelles » porte le filtre « Toutes ({n}) » · « Non lues ({n}) », gardé dans l'adresse (`nouvelles=non-lues`, TRV-101) ; une fois tout lu sous ce filtre : « Vous avez tout lu. ».

**ECL-011** `[P1]` **« À faire »** : cinq cartes au plus, par ordre de priorité. Chaque carte dit quoi faire et y mène.

| Priorité | Condition | Texte | Mène à |
|---|---|---|---|
| 1 | Une offre de financement attend une réponse | « {banque} vous fait une offre de financement. » · si l'offre a une date : « Valable jusqu'au {date}. » · si le client a déjà dit vouloir l'accepter (`acceptRequestedAt`) : « Votre souhait d'accepter l'offre de {banque} est transmis à {conseiller}. », sans action à faire | Financement |
| 2 | Dossier avec financement, **complet**, accord de transmission non donné (GED-070) | « Il ne manque que votre accord pour transmettre votre dossier à la banque. » | Pièces (bloc de l'accord, DOS-040) |
| 2 | Pièces à refaire | « {n} pièces sont à refaire. » | Pièces |
| 3 | Complément demandé par une banque | « {banque} demande un complément. » · s'il comporte des pièces : « {n} pièces à fournir. » | Pièces |
| 4 | Pièces à fournir | « {n} pièces à fournir. » · avec l'échéance la plus proche : « avant le {date} » | Pièces |
| 4 | Pièces à renouveler bientôt, dossier à l'étape des pièces, sans renouvellement déjà déposé (CYC-141) | « {n} pièces à renouveler avant le {date}. » | Pièces |
| 5 | Rendez-vous dans les 7 jours | « {Type} le {date} à {heure}. » | Rendez-vous |
| 6 | Propositions non consultées | « {n} biens à découvrir. » | Biens proposés |
| 7 | Option **confirmée par le promoteur** qui expire dans les 3 jours (CYC-107) | « Votre option sur le lot {lot} se termine le {date}. » | Mon bien |
| 8 | Enquête en attente | « Votre avis en 2 minutes. » | Enquête |
| 9 | Profil incomplet — l'une des neuf informations de PRO-003 manque —, sans dossier au-delà de `QUALIFICATION` | « Complétez votre profil pour préparer notre échange. » | Profil |

Rien à faire : « Rien à faire pour le moment. Nous vous prévenons dès qu'il y a du nouveau. ».

**Ce qui compte.** Les cartes « à fournir » et « à refaire » ne comptent que les pièces que **le client** doit fournir (`providedBy = CLIENT`) : une pièce attendue de Diaspora Patrimoine, du promoteur ou de la banque n'est pas une chose à faire pour lui. Les pièces **facultatives** ne sont pas comptées : elles apparaissent dans l'onglet Pièces, sous « Facultatif », sans alourdir le compteur ni contredire « Votre dossier est complet ». Les cartes ne naissent que d'un dossier **ouvert** : un dossier en pause ne garde que ce qui court malgré la pause (offre, option, rendez-vous) ; un dossier clôturé n'en produit aucune.

**ECL-015** `[P1]` **Le message d'encouragement** (D-099). Le tableau de bord dit en une carte où en est la personne et ce qui vient : un médaillon, un titre, une phrase, la barre de progression quand elle a un sens, et l'action utile. Première ligne vraie :

| Situation | Titre | Phrase · barre · action |
|---|---|---|
| Dossier gagné | « Félicitations, vous êtes propriétaire ! » | La phrase de ECL-021 ; médaillon `Celebration` (DSN-073, moment `dossier_won`). |
| Une demande sans dossier (ECL-014) | « Votre demande est bien arrivée » | « Votre demande {référence} est enregistrée. » et la promesse de ECL-012. |
| Dossier en pause | « Votre projet vous attend » | « Votre projet est en pause. » · « Reprendre mon projet ». |
| À l'étape des pièces, des pièces obligatoires à fournir ou à refaire | « Plus qu'une pièce à déposer » / « Plus que {n} pièces à déposer » | « Vous pouvez les photographier avec votre téléphone, une à une. Nous les vérifions au fur et à mesure. » · la barre de ECL-023 avec « {x} pièces validées ou non demandées sur {y} » · « Déposer mes pièces ». |
| Toutes déposées, vérification en cours | « Toutes vos pièces sont déposées » | « Nous les vérifions une à une. Vous n'avez rien à faire pour le moment. » · la barre. |
| Dossier complet | « Votre dossier est complet » | La phrase de ECL-021 · la barre verte ; médaillon `Celebration` (moment `dossier_complete`). |
| Des propositions non consultées | « Un bien choisi pour vous » / « {n} biens choisis pour vous » | « {conseiller} les a sélectionnés d'après votre projet. Dites-lui ce que vous en pensez. » · « Découvrir la sélection ». |
| Profil incomplet, dossier à `INTEREST` ou `QUALIFICATION` | « Préparez notre premier échange » | La phrase de ECL-011 ligne 9 · la barre du profil (PRO-003) · « Compléter mon profil ». |
| Sinon | « Votre projet est lancé » | « Vous en êtes à l'étape {n} sur 6 : {étape}. » · six marques. |

Aucun délai n'y est promis, sinon celui de NOT-053 ; aucun montant n'y figure. Les textes sont des clés `ui.client.dashboard.encourage.*`, à valider par la cliente (Q-077). Les autres pages de l'espace ont leur message, dans la même forme, décrit avec elles (INT-001, INT-010, DOS-001, SFA-010, SFA-022, SFA-030, PRO-003).

**ECL-012** `[P1]` **Votre conseiller.** Photo ou initiales, « {Prénom N.} » (TRV-145), sa fonction (`jobTitle`, sinon « Votre conseiller »), et les boutons « Écrire » (messagerie) et, si `contact.whatsapp` est renseigné, « WhatsApp ». Tant qu'aucun conseiller n'est affecté : « L'équipe Diaspora Patrimoine » · « Un conseiller vous appelle {quand}. », avec l'expression de NOT-053 — la même promesse que partout ailleurs (DEM-008) ; délai dépassé : ECL-035. `{quand}` et le délai dépassé se lisent sur une seule demande : celle du client qui est encore ouverte (`NEW` ou `IN_PROGRESS`) sans premier contact noté (`firstContactAt` vide) — la plus récente s'il en a plusieurs. S'il n'en a aucune, la phrase n'est pas affichée : le bloc garde « L'équipe Diaspora Patrimoine » et ses boutons. Le numéro personnel d'un conseiller n'est jamais affiché ; le lien WhatsApp est celui de la société.

**ECL-013** `[P1]` **Compte sans demande ni dossier.** Les blocs 2 à 5 sont remplacés par : « Bienvenue dans votre espace » · « C'est ici que vous suivrez votre projet, de la première demande jusqu'aux clés. » · trois boutons : « Découvrir les programmes » · « Simuler mon projet » · « Être rappelé » (repli : ACC-090).

**ECL-014** `[P1]` **Quel dossier le tableau de bord montre.** Première ligne vraie :

| Situation du client | Tableau de bord |
|---|---|
| Au moins un dossier `OPEN` ou `ON_HOLD` | Celui dont l'activité est la plus récente : tous les blocs de ECL-010. S'il en a plusieurs : le lien « Voir mes autres dossiers » (ECL-033). |
| Aucun dossier ouvert, au moins un dossier **gagné** | Le dernier dossier gagné : bloc « Votre projet » avec les six étapes cochées et la phrase de ECL-021 ; bloc « Votre bien » ; « À faire » réduit à l'enquête en attente. Puis « Un nouveau projet ? » · « Découvrir les programmes ». |
| Seulement des dossiers **clôturés** sans acquisition | Le bandeau de ECL-022 (« Votre dossier {référence} est clôturé. », suivi des phrases du bandeau `LOST` · « Relancer mon projet »), sans frise ni « À faire » — on ne dit pas « Déposez vos pièces » à quelqu'un dont le dossier est clos —, puis les trois boutons de ECL-013. Un acompte encore à suivre reste affiché (ECL-032). S'il a écrit depuis la clôture, sa demande n'est pas invisible : sous le bandeau, « Votre message du {date} est bien reçu. {conseiller} vous répond {quand}. » (`{quand}` : NOT-053 ; délai dépassé : ECL-035), tant que cette demande est ouverte. |
| Une demande envoyée, sans dossier (message de contact, demande en attente de la décision du conseiller, CYC-002) | « Votre demande {référence} est enregistrée. » — la demande retenue par ECL-012 ; s'il n'y en a pas, sa demande ouverte la plus récente, sans phrase de promesse — · ce qui est promis, avec l'expression `{quand}` de NOT-053 : « Nous vous répondons {quand}. » pour un message de contact, « Un conseiller vous appelle {quand}. » sinon (délai dépassé : ECL-035) · le bloc « Votre conseiller » · les boutons de ECL-013. |
| Rien | ECL-013. |

## 3. Les six étapes

**ECL-020** `[P1]` Le client voit **six étapes** ; le dossier en compte sept en interne (`00-cadre/01`, § 3).

| # | Étape affichée | Étape(s) du dossier |
|---|---|---|
| 1 | Découverte des biens | — (faite dès qu'un dossier existe) |
| 2 | Expression d'intérêt | `INTEREST` |
| 3 | Qualification et mise en relation | `QUALIFICATION`, `MATCHING` |
| 4 | Constitution du dossier | `DOCUMENTS` |
| 5 | Soumission à la banque | `BANK_REVIEW` |
| 6 | Octroi du crédit et acquisition | `APPROVED`, `ACQUISITION` |

Les étapes passées sont cochées, avec leur date ; l'étape en cours est mise en valeur ; les suivantes sont estompées. Dossier gagné : les six sont cochées. Pour un achat **sans financement** (`financingRequested` faux) : l'étape 5 porte « Non concerné » — ou reste cochée, avec sa date, si le dossier est passé par une banque avant de continuer sans financement — et l'étape 6 s'appelle « Acquisition ». Sur téléphone, la frise est verticale.

Sous chaque libellé d'étape, en petit, une phrase d'explication — des textes d'interface (`space.steps.{n}.hint`), et non le bloc de contenu de EDI-011 : 1 « Vous découvrez les programmes et simulez votre financement. » · 2 « Vous nous dites ce qui vous intéresse. » · 3 « Votre conseiller précise votre projet avec vous et vous propose des biens. » · 4 « Vous déposez vos pièces en ligne ; nous les vérifions une à une. » · 5 « Nous présentons votre dossier aux banques partenaires et suivons leur réponse. » · 6 « Accord de la banque, conditions, signature : vous êtes propriétaire. ». Sans financement : pas de phrase sous l'étape 5 « Non concerné », et celle de l'étape 6 devient « Conditions, signature : vous êtes propriétaire. ». Aucune ne donne de délai : ce qui vient, et quand, c'est la phrase « Prochaine étape » qui le dit (ECL-021, ECL-035). Sur téléphone, la phrase ne s'affiche que sous l'étape en cours. Les libellés eux-mêmes ne changent pas (`00-cadre/01`, § 3).

**ECL-021** `[P1]` **« Prochaine étape. »** Sous la frise, une phrase dit ce qui vient. Si le conseiller a écrit la sienne (`Dossier.clientNextStep`), c'est elle qui s'affiche. Sinon, la première ligne vraie de ce tableau :

| Étape | Situation | Phrase |
|---|---|---|
| Dossier clôturé | — | Aucune phrase, ni celle du conseiller ni celle de l'étape : le bandeau de ECL-022 la remplace. |
| `INTEREST` | — | « Votre demande est enregistrée. Un conseiller vous appelle {quand}. » — `{quand}` est l'expression de NOT-053, d'après ce que la personne a demandé : « sous 48 h ouvrées » par défaut, « jeudi 15 octobre, de préférence le matin » si elle a choisi un jour (DEM-008). Délai dépassé : ECL-035. |
| `QUALIFICATION` | Aucun premier contact noté (`Dossier.firstContactAt` vide) | « {conseiller} vous appelle {quand} pour faire le point sur votre projet : budget, financement, délais. » — le même `{quand}` qu'à l'étape `INTEREST` ; délai dépassé : ECL-035. |
| | Sinon | « {conseiller} fait le point avec vous sur votre projet : budget, financement, délais. » |
| `MATCHING` | Un bien est retenu | « Votre bien est retenu. Nous préparons la liste de vos pièces. » |
| | Le client a demandé à retenir un bien, le conseiller n'a pas encore confirmé (`selectionRequestedAt`) | « Vous avez demandé à retenir {bien}. {conseiller} vous confirme sa disponibilité. » |
| | Des propositions attendent une réponse | « Des biens vous attendent : dites-nous ce que vous en pensez. » |
| | Un rendez-vous de visite est à venir | « Votre visite a lieu le {date}. » |
| | Au moins un bien vous intéresse | « Prochaine étape : choisir le bien que vous retenez. » |
| | Sinon | « {conseiller} prépare une sélection de biens pour vous. » |
| `DOCUMENTS` | Le bien retenu n'est plus disponible (CYC-073) | « Le bien que vous aviez retenu n'est plus disponible. {conseiller} revient vers vous avec d'autres biens. » |
| | Des pièces **obligatoires** sont à fournir ou à refaire par le client | « Déposez vos pièces : il en reste {n}. » |
| | Toutes déposées, vérification en cours | « Nous vérifions vos pièces. » |
| | Une information manque pour établir la liste (GED-020) | « Complétez votre situation pour que nous finalisions la liste de vos pièces. » (mène au profil) |
| | Dossier complet, avec financement, accord de transmission non donné | « Votre dossier est complet. Il ne manque que votre accord pour l'envoyer à la banque. » |
| | Dossier complet, avec financement | « Votre dossier est complet. Nous préparons l'envoi à la banque. » |
| | Dossier complet, sans financement | « Votre dossier est complet. Place à l'acquisition. » |
| `BANK_REVIEW` | Une banque demande un complément | « {banque} demande un complément : {n} pièces à fournir. » |
| | Au moins une soumission en cours | « Votre dossier est à l'étude chez {banques}. Nous vous tenons informé. » |
| | Aucune soumission en cours | « Nous étudions avec vous une autre solution de financement. » |
| `APPROVED` | Le client a dit vouloir accepter l'offre | « Vous souhaitez accepter l'offre de {banque}. {conseiller} finalise avec vous. » |
| | Sinon | « {banque} a donné son accord. Prenez connaissance de l'offre avec {conseiller}. » |
| `ACQUISITION` | Plus de lot réservé (réservation annulée, CYC-105) | « La réservation de votre lot a été annulée. {conseiller} revient vers vous. » |
| | Signature planifiée | « Signature prévue le {date}. » |
| | Sinon | « Prochaine étape : fixer la date de signature. » |
| Dossier gagné | Clés remises | « Les clés vous ont été remises le {date}. Bienvenue chez vous. » |
| | Sinon | « L'acte est signé : vous êtes propriétaire. Félicitations ! » |

Aux lignes `INTEREST` et `QUALIFICATION`, `{quand}` et le délai dépassé se lisent sur la demande que retient ECL-012 ; s'il n'y en a pas : à `INTEREST`, « Votre demande est enregistrée. » seul ; à `QUALIFICATION`, la phrase « Sinon ». Sans conseiller affecté, « {conseiller} » devient « Votre conseiller ». Une décision de banque ne compte, dans ce tableau comme dans les cartes « À faire » (ECL-011), qu'une fois **publiée** (CYC-165) : d'ici là, la soumission est lue dans l'état qu'elle avait.

**ECL-035** `[P1]` **Délai de premier contact dépassé.** Quand l'échéance de premier contact d'une demande est passée sans premier contact (`slaBreachedAt` renseigné, CYC-007), la promesse « Un conseiller vous appelle {quand}. » — et ses variantes : « {conseiller} vous appelle {quand}… », « Nous vous répondons {quand}. » — est remplacée partout où l'espace l'affiche (ECL-012, ECL-014, ECL-021, INT-002) par : « Nous n'avons pas encore pu vous appeler : nous vous contactons au plus vite. Vous pouvez aussi nous écrire{, nous appeler au {contact.phone}}{ ou nous joindre sur WhatsApp}. » — « nous écrire » mène à la messagerie ou à son repli (ECL-006) ; chaque coordonnée n'apparaît que si son paramètre est renseigné. Pour un message de contact, la première phrase devient « Nous n'avons pas encore pu vous répondre : nous le faisons au plus vite. ». La phrase disparaît au premier contact noté (`firstContactAt`). Le même jour, le client reçoit un e-mail d'excuse (`C_LEAD_DELAYED`, `R_LEAD_SLA_BREACHED`) : c'est tout ce que voit celui qui n'a pas d'espace.

**ECL-022** `[P1]` **États particuliers du dossier**, affichés en bandeau au-dessus de la frise :

| État | Bandeau | Action |
|---|---|---|
| `ON_HOLD` | « Votre projet est en pause. » · si le motif est `CLIENT_REQUEST` et qu'une date est prévue : « Reprise prévue le {date}. » · si le conseiller a écrit ce qu'il attend du client (`Dossier.holdClientNote`, CYC-031) : « Nous attendons de vos nouvelles : {note} », tant que la pause dure | « Reprendre mon projet » : ouvre la messagerie avec le message prérempli « Je souhaite reprendre mon projet. ». Le client ne change pas l'état lui-même. |
| `LOST` | « Ce dossier est clôturé. Vos documents et vos échanges restent accessibles ici. Votre projet peut reprendre à tout moment : {conseiller} vous explique où vous en êtes. » — sans conseiller : « l'équipe vous explique où vous en êtes » ; une fois les fichiers supprimés au terme de leur conservation (DOS-016), la deuxième phrase devient « Vos échanges restent accessibles ici. ». Le motif interne n'est jamais montré (CYC-035). | « Relancer mon projet » : même mécanisme. Les pièces restent consultables tant que leurs fichiers sont conservés (SEC-110). Quelqu'un répond toujours : un message envoyé sur un dossier clos arrive à son ancien conseiller, ou aux administrateurs s'il n'est plus là (MSG-018, NOT-018). |
| `WON` | « Votre acquisition est finalisée. » | Lien vers l'enquête si elle attend. |

**ECL-023** `[P1]` **Complétude.** À l'étape `DOCUMENTS` et au-delà, une barre accompagne la frise : « Votre dossier est complet à {n} %. » (CAL-055), avec le lien « Voir mes pièces ». Elle n'est pas affichée sur un dossier clôturé : ses pièces sont en lecture seule, et leurs fichiers finissent par être supprimés (DOS-016).

## 4. Mon dossier (EC-11)

**ECL-030** `[P1]` Adresse `/espace-client/dossiers/{référence}`. En tête : « Dossier {référence} », le bien retenu s'il existe, la frise. Quatre onglets, dont l'adresse garde la trace :

| Onglet | Adresse | Contenu | Visible |
|---|---|---|---|
| Suivi | `…/{référence}` | ECL-031 | toujours |
| Pièces | `…/pieces` | `04-dossier-et-pieces.md` | à partir de `DOCUMENTS` |
| Financement | `…/financement` | DOS-050 | à partir de `DOCUMENTS`, si `financingRequested` — ou si le dossier garde une soumission déjà envoyée, qui reste lisible après un passage « sans financement » |
| Mon bien | `…/bien` | ECL-032 | dès qu'un bien est retenu, ou qu'un acompte reste à suivre |

Une référence qui n'est pas celle d'un dossier du client répond `404` (ROL-030).

**ECL-031** `[P1]` **Onglet Suivi** : l'historique du dossier **tel que le client peut le voir**, du plus récent au plus ancien, chaque ligne avec sa date :

| Événement | Ligne affichée |
|---|---|
| Demande envoyée | « Vous avez envoyé une demande : {nature}{, bien}. » |
| Conseiller affecté ou changé | « {conseiller} suit votre projet. » |
| Projet qualifié | « Votre projet est précisé avec {conseiller} : budget, financement, délais. » |
| Biens proposés | « {conseiller} vous a proposé {n} biens. » |
| Rendez-vous tenu | « {Type de rendez-vous} avec {conseiller}. » |
| Bien retenu | « Vous avez retenu {bien}. » |
| Pièces demandées | « {n} pièces vous ont été demandées. » |
| Dossier complet | « Votre dossier est complet. » |
| Envoi à une banque | « Votre dossier a été envoyé à {banque}. » |
| Complément demandé | « {banque} a demandé un complément. » |
| Décision | « {banque} a accordé votre financement. » · « {banque} n'a pas donné suite. » · « La réponse de {banque} a été corrigée : votre dossier est de nouveau à l'étude. » (CYC-169) |
| Avec ou sans financement | « Votre projet se poursuit sans financement bancaire. » · « Votre projet se poursuit avec un financement. » (CYC-041) |
| Option, réservation | « Une option a été posée sur le lot {lot}. » — quand le promoteur a confirmé qu'il tient le lot, pas avant (CYC-107) · « Votre réservation est confirmée. » · « L'option sur le lot {lot} a pris fin. » (option confirmée, expirée ou annulée) · « La réservation du lot {lot} a été annulée. » |
| Jalons d'acquisition | « Conditions acceptées. » · « Signature planifiée le {date}. » · « Acte signé. » · « Clés remises. » |
| Pause, reprise, clôture, réouverture | « Votre projet a été mis en pause. » · « Votre projet a repris. » · « Votre dossier a été clôturé. » · « Votre dossier est rouvert. » |
| Choix d'un bien non confirmé | « {conseiller} n'a pas pu retenir {bien} : {raison}. » |
| Choix retiré (CYC-242) | « Le choix de {bien} a été retiré. » |
| Offre de financement | « L'offre de {banque} a été mise à jour. » · « L'offre de {banque} est prolongée jusqu'au {date}. » · « L'offre de {banque} est arrivée à échéance. » · « Votre demande auprès de {banque} a été retirée. » |
| Accord de transmission | « Vous avez donné votre accord pour transmettre votre dossier. » · « Vous avez retiré votre accord de transmission. » |
| Acompte | « Acompte de {montant} : remboursement à suivre. » · « Acompte remboursé : {montant}. » · « Acompte conservé par le promoteur. » |
| Seconde demande pendant le dossier | « Vous avez envoyé une nouvelle demande : {nature}{, bien}. » (elle figure aussi dans « Mes demandes », INT-001) |

N'y figurent jamais : les notes, les tâches, les appels notés, les relances, les reculs d'étape, les motifs internes, le nom d'un interlocuteur de banque ou de promoteur.

**Filtre** (D-099) : « Tout » · « Demandes » · « Bien » · « Pièces » · « Financement » · « Étapes », chacun avec son compteur ; une famille vide n'est pas proposée, ni le filtre sous deux familles. Chaque genre de ligne appartient à une famille (`TIMELINE_FAMILIES`, `@dp/contracts`). Le filtre et les compteurs viennent du serveur (`?family=`, avec le total et le compteur de chaque famille : cette liste peut s'allonger, TRV-100) ; la famille est gardée dans l'adresse (`suivi=pieces`, TRV-101). Chaque ligne porte l'icône de sa famille ; la plus récente est mise en valeur. À côté du fil, l'onglet montre la prochaine étape (ECL-021) et la complétude (ECL-023), le conseiller (ECL-012), le bien du dossier avec ses chiffres, et « En bref » : étape, financement, ouverture, dernière activité.

**Source.** Chaque ligne est une `ClientTimelineEntry` (`01-domaine/04`, § 2.7), écrite dans la transaction du geste ou de la tâche qui produit le fait — le cas d'usage qui émet l'événement correspondant (AUT-010) —, avec les valeurs de sa phrase figées ce jour-là. Le fil ne se recalcule jamais : il ne dépend ni des événements, purgés après `retention.outboxDays` jours (AUT-091), ni de l'état actuel des objets. Un fait défait plus tard (décision corrigée, option qui prend fin) garde sa ligne ; une nouvelle ligne le dit. Précisions :
- « Demande envoyée » : la demande d'origine du dossier (`originLeadId`), écrite à son ouverture ; un dossier ouvert par l'équipe sans demande n'a pas cette ligne ;
- « Seconde demande » : toute autre demande du client qui rejoint ce dossier (`Lead.dossierId`, CYC-002) ou le porte (`Lead.contextDossierId`, MSG-021), écrite à son rattachement ou à sa création ; une demande classée indésirable n'en écrit pas ;
- « Biens proposés » : un envoi, une ligne ; `{n}` = les biens de cet envoi ;
- « Choix retiré » : écrit par `unselect` (CYC-242), avec dans `params` le titre du bien (`bien`) ;
- « Rendez-vous tenu » : un rendez-vous de ce dossier (`Appointment.dossierId`) noté tenu ;
- « Pièces demandées » : une ligne par geste qui ajoute des pièces à fournir par le client (`providedBy` = `CLIENT`, hors `isInternal`) — liste créée ou réévaluée, personne ajoutée, complément d'une banque, pièce ajoutée à la main ; `{n}` = les pièces ajoutées par ce geste ; rien si ce nombre est nul ;
- « Décision », « Offre de financement » : à la publication de la décision (CYC-165), pas avant ; « Option » : à la confirmation du promoteur (CYC-107).

Lecture : `GET /client/dossiers/{référence}/timeline`, du plus récent au plus ancien (`occurredAt`, puis `id`), paginée (API-010, 20 lignes, TRV-100). L'API rend `kind`, `occurredAt` et `params` ; l'écran compose la phrase de ce tableau (API-002).

**ECL-032** `[P1]` **Onglet Mon bien.**
- le bien retenu : photos, titre, ville, lien vers sa fiche publique ;
- le **lot** : référence, étage, surface, orientation. Tant qu'il n'est ni sous option ni réservé pour ce dossier, il est présenté comme « Lot envisagé » avec la mention « Pas encore réservé » ; s'il est pris entre-temps par quelqu'un d'autre, la ligne disparaît et « Le lot envisagé n'est plus libre. {conseiller} vous en propose un autre. » la remplace (CYC-102) ;
- le **prix** — un seul chiffre, celui du projet (`Dossier.purchasePrice`, MOD-313), le même que dans le plan de financement : libellé « Prix convenu » dès qu'une option ou une réservation existe, « Prix » avant ; dans la devise du bien, avec son équivalent ;
- la **réservation** : « Option demandée au promoteur », sans date, tant qu'il ne l'a pas confirmée (CYC-107), puis « Option jusqu'au {date} » ; si une option se termine sans avoir été confirmée : « L'option demandée sur le lot {lot} n'a pas abouti. {conseiller} revient vers vous. », jusqu'au choix d'un autre lot ; si une option **confirmée** prend fin sans réservation : « L'option sur le lot {lot} a pris fin le {date}. {conseiller} revient vers vous. », de même · « Réservation confirmée le {date} » · « Acompte enregistré : {montant} {devise}, le {date} » · « Livraison prévue au contrat : {date} » — chaque ligne seulement si la donnée existe ;
- l'**acompte d'une réservation qui a pris fin** (CYC-108), tant que son issue compte : « Acompte de {montant} : remboursement à suivre avec {conseiller}. » · « Acompte remboursé : {montant}, le {date}. » · « Acompte conservé par le promoteur : {note}. ». Cette ligne reste visible après la clôture du dossier ;
- `[P1]` l'**avancement du chantier** du programme (FIC-042) ;
- à l'étape `ACQUISITION` : les quatre jalons (Q-026), cochés avec leur date : Conditions acceptées · Signature planifiée · Acte signé · Clés remises.

Si le bien retenu n'est plus disponible, sur un dossier en cours : « Ce bien n'est plus disponible. {conseiller} revient vers vous. » (CYC-073). Un dossier gagné affiche toujours son bien : c'est celui que le client a acheté. Si sa fiche est seulement **hors ligne** (CYC-121) : la mention « Fiche en cours de mise à jour », et le lien vers la fiche publique est retiré — les photos, le titre et les chiffres restent affichés ici, d'après les données du dossier.

**ECL-033** `[P1]` **Plusieurs dossiers.** Cas rare (CYC-002). Le menu « Mon dossier » ouvre alors une liste : référence, bien, étape, état, date de la dernière activité ; le dossier actif le plus récent en tête. Une carte par dossier, entièrement cliquable (D-099) : la photo du bien, « Étape {n} sur 6 · {étape} » avec six marques, la complétude à l'étape des pièces, la mention « Dossier affiché sur votre tableau de bord » pour celui de ECL-014. Filtre « Tous » · « En cours » · « Terminés » avec leurs compteurs, gardé dans l'adresse (`etat=`), quand les deux groupes existent. Le tableau de bord montre le dossier ouvert dont l'activité est la plus récente, avec le lien « Voir mes autres dossiers ».

**ECL-034** `[P1]` Le client ne peut pas modifier un dossier : ni l'étape, ni le bien retenu, ni les montants. Ses actions passent par ses biens (`03`), ses pièces (`04`) et la messagerie (`05`).
