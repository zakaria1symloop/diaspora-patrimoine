# Espace client — profil, sécurité, confidentialité, avis

Écrans **EC-50** (profil), **EC-51** (sécurité), **EC-52** (notifications), **EC-53** (confidentialité), **EC-54** (avis), et les pages publiques à jeton **EP-25** (répondre à une enquête) et **EP-27** (préférences d'e-mail).

---

## 1. Profil (EC-50)

**PRO-001** `[P1]` Adresse `/espace-client/profil`. Cinq sections, chacune avec son propre bouton « Enregistrer ». Les champs sont ceux de la fiche `Client` (`01-domaine/04`).

| Section | Champs |
|---|---|
| **Identité** | Prénom · Nom · Date de naissance (facultatif) · Nationalités (facultatif) |
| **Coordonnées** | E-mail (affiché ; « Modifier » lance AUTH-080) · Téléphone · case « Joignable sur WhatsApp à ce numéro » · Pays de résidence · Ville · Moyen de contact préféré · Moment préféré · Fuseau horaire (détecté, modifiable) |
| **Situation** | Situation de résidence · Situation professionnelle · Profession · Employeur · Depuis le |
| **Mon projet** | Régions souhaitées · Types de bien · Nombre de pièces minimum · Budget total, avec son propre choix de devise (`budgetCurrency` : présélectionnée sur la devise de « Mes finances », sinon `display.referenceCurrency`) · Budget mensuel `[P1]`, dans la même devise (`budgetMonthlyCurrency`) · Raison de l'achat · Horizon · Financement souhaité |
| **Mes finances** | Revenus nets mensuels · Autres revenus · Mensualités de crédits en cours · Apport disponible — tous dans **une seule devise**, choisie une fois en tête de la section (MOD-303) ; elle renseigne `incomeCurrency` et `downPaymentCurrency` ensemble. Changer de devise ne convertit rien : l'écran demande de ressaisir les montants. |

En tête de « Mes finances » : « Ces informations servent à préparer votre financement. Elles ne sont vues que par l'équipe qui suit votre dossier et, avec votre accord, par les banques que nous sollicitons pour vous. ». Tous les champs de « Situation », « Mon projet » et « Mes finances » sont facultatifs.

**PRO-002** `[P1]` Enregistrer une section ne touche pas les autres. Si le conseiller a modifié la fiche entre-temps : conflit de version (TRV-094). Quitter avec des modifications non enregistrées : TRV-093 — dans le premier code, l'avertissement ne couvre que la navigation du navigateur (fermer l'onglet, recharger, revenir en arrière), pas les liens internes de l'espace (D-097).

**Disposition** (D-099) : à côté des sections, un rail qui reste visible sur un grand écran — le message d'encouragement (« Profil complété à {n} % » · « Plus qu'une information à indiquer pour préparer notre échange. » / « Plus que {n} informations… » ; complet : « Votre profil est complet » · « Merci. Votre conseiller a ce qu'il lui faut pour préparer votre projet avec vous. »), « Il vous reste à indiquer » avec une pastille par information manquante qui mène à sa section, et la liste des sections avec leur état (coche, « {n} à indiquer », « Non enregistré »). Sécurité et Mes accords posent leurs sections côte à côte quand deux tiennent ; « Mes données » devient une section, avec « Écrire à mon conseiller ».

**PRO-003** `[P1]` **Profil complété.** Un indicateur « Profil complété à {n} % » compte neuf informations : prénom, nom, téléphone, pays de résidence, situation de résidence, horizon, budget (total ou mensuel), apport, financement souhaité. Il nourrit la carte « À faire » du tableau de bord (ECL-011). `{n}` = partie entière de 100 × informations renseignées / 9 ; le budget compte pour une information s'il est renseigné, total **ou** mensuel.

**PRO-004** `[P1]` Une modification du profil par le client : s'inscrit dans l'historique de sa fiche côté équipe (« Le client a modifié son profil : {champs} ») ; recalcule son score (CAL-070) ; et, si sa situation professionnelle ou de résidence change alors que son dossier est à l'étape `DOCUMENTS`, réévalue sa liste de pièces (GED-031), avec le message « Votre liste de pièces a été mise à jour : {n} pièces ajoutées, {m} retirées. ». Son conseiller en est prévenu (`NS_CHECKLIST_CHANGED`) : la liste d'un dossier ne change jamais sans qu'il le sache. Le fuseau horaire choisi ici (`Client.timezone`) est celui de tous les horaires qu'on lui écrit (TRV-031).

## 2. Sécurité (EC-51)

**PRO-020** `[P1]` **Mot de passe** : AUTH-081. **Double authentification** (facultative) :

1. le client confirme que c'est bien lui — son mot de passe, ou, s'il n'en a pas, un code reçu par e-mail (AUTH-086) ;
2. l'écran affiche un QR code et la clé en clair, à ajouter dans une application de codes ;
3. il saisit le code à 6 chiffres affiché par l'application ;
4. l'écran montre **dix codes de secours**, avec « Copier » et « Télécharger », et la case « J'ai conservé mes codes de secours » ; ce n'est qu'après cette case que la double authentification est activée.

Routes : API-100 (Moi, `…/me/two-factor`). Jusqu'à la case, le secret est gardé sur le compte (`User.twoFactorSecret`) sans que `twoFactorEnabled` soit vrai ; recommencer remplace ce secret. Pour un client dont la double authentification est déjà active, `setup` répond `409 CONFLICT_STATE` : son secret actif n'est jamais écrasé, et pour changer de téléphone il la désactive d'abord. Seul le personnel la reconfigure sans la désactiver, le nouveau secret attendant dans `User.twoFactorPendingSecret` (BO-070).

Désactiver : la même confirmation (AUTH-086) et un code de l'application. « Générer de nouveaux codes de secours » invalide les anciens. Chaque changement envoie `C_TWO_FACTOR_CHANGED`.

**PRO-021** `[P1]` **Appareils connectés** : la liste des sessions ouvertes — l'appareil (« Chrome sur Windows », « iPhone »), la dernière utilisation, et « Cet appareil » pour la session en cours. Actions : « Déconnecter » une session ; « Me déconnecter de tous les autres appareils » (la session en cours reste, AUTH-085). Aucune localisation n'est affichée. Un appareil est « connu » par un identifiant rangé dans son navigateur (`dp_device`, AUTH-033) : l'e-mail « Nouvelle connexion » ne part que pour un appareil que ce compte n'a jamais utilisé.

## 3. Notifications (EC-52)

**PRO-030** `[P1]` Une ligne par groupe (NOT-020), avec une bascule « E-mail » (et, `[MOB]`, « Notification sur mon téléphone »). Le groupe « Indispensables » est affiché, toujours actif, avec la liste de ce qu'il contient et la phrase : « Ces messages concernent votre compte et votre dossier ; ils ne peuvent pas être désactivés. ». Chaque bascule s'enregistre aussitôt (« Préférence enregistrée. »). La bascule « Actualités de Diaspora Patrimoine » vaut consentement : l'activer ou la couper écrit une ligne `Consent` (`MARKETING_EMAIL`).

**PRO-031** `[P1]` **Sans connexion** (EP-27, `/preferences/{jeton}`) : la même liste de groupes pour l'adresse concernée, plus le bouton « Ne garder que l'indispensable ». Elle fonctionne aussi pour une personne sans compte : les préférences tiennent à sa **fiche** (`NotificationPreference.clientId`), pas à un compte. Elle ne montre alors que les groupes qui la concernent — actualités, alertes, Café, et, si elle a un dossier, rappels et nouveautés du projet. Ses choix restent quand elle ouvre un espace. Cette page est livrée avec le **premier** e-mail qui porte un lien « Gérer mes préférences » (`08-tracabilite/02`), pas après. Le lien de désinscription à un clic d'un e-mail coupe son groupe et affiche : « C'est fait. Vous ne recevrez plus ces e-mails. » avec « Gérer mes autres préférences ». Le jeton de préférences **n'expire pas** (D-095) : il est révoqué seulement quand l'adresse change ou que la fiche est supprimée — on doit toujours pouvoir se désinscrire depuis un vieil e-mail (NAV-061) ; un jeton révoqué donne une page `410` avec « Recevoir un nouveau lien » (même réponse quelle que soit l'adresse, TRV-112). En bas de la page : « Pour ne plus rien recevoir, ou changer d'adresse : écrivez-nous » (→ `/contact`).

## 4. Personnes de confiance

**PRO-040** `[P1]` Dans le profil, section « Personnes de confiance » : jusqu'à cinq proches (`ClientContact`) — nom, lien avec le client, téléphone, e-mail, case « Peut visiter un bien à ma place », note. Elles servent aux visites sur place (INT-040) et sont visibles du conseiller. Une case est demandée à l'ajout : « Je confirme avoir informé cette personne que je communique ses coordonnées. » ; sa date est gardée (`ClientContact.informedConfirmedAt`). Une personne liée à un rendez-vous à venir ne se supprime pas : « {nom} doit faire une visite le {date}. Annulez ou modifiez d'abord ce rendez-vous. ».

## 5. Confidentialité (EC-53)

**PRO-050** `[P1]` **Mes données.** La page explique en quelques lignes quelles données sont conservées et pourquoi, renvoie à la politique de confidentialité, et propose :

| Action | Effet |
|---|---|
| **Télécharger mes données** | Demande une confirmation (mot de passe, ou code reçu par e-mail pour un compte sans mot de passe : AUTH-086), puis prépare l'archive de PRO-075. Quand elle est prête : e-mail `C_DATA_EXPORT_READY` ; le téléchargement est possible 7 jours depuis cette page. Une demande par 24 heures : une seconde est refusée (raison `EXPORT_TOO_SOON`). |
| **Corriger mes données** | Renvoie au profil ; pour une donnée qu'il ne peut pas modifier lui-même : le formulaire ci-dessous. |
| **Faire une autre demande** | Formulaire : nature (Limiter le traitement · M'opposer à un traitement · Portabilité · Autre) et précisions → crée une `DataRequest` ; accusé `C_DATA_REQUEST_ACK` ; réponse sous un mois (CYC-230). |

La page liste aussi les demandes déjà faites, avec leur état (aucune : « Vous n'avez fait aucune demande. »). L'export demandé s'affiche selon son état : en préparation, « Votre export est en préparation. Nous vous prévenons par e-mail dès qu'il est prêt. » ; prêt, « Votre export est prêt. Vous pouvez le télécharger jusqu'au {date}. » et « Télécharger » ; expiré, « Votre export a expiré. » et « Préparer un nouvel export ».

**PRO-075** `[P1]` **Contenu de l'archive** — celle de « Télécharger mes données », et celle qu'un administrateur prépare pour un client (accès, portabilité : ADM-063). Un fichier ZIP, `mes-donnees-{AAAA-MM-JJ}.zip`, qui contient :
- « resume.pdf » : un résumé lisible de tout ce qui suit, une section par catégorie (TRV-142) ;
- un fichier JSON par catégorie — chaque objet avec ses champs et leurs valeurs, les énumérations sous leur libellé : `profil.json` (fiche et compte : identité, coordonnées, situation, projet, finances, préférences d'e-mail), `demandes.json`, `dossiers.json` (étapes et dates, biens proposés et ses réponses, rendez-vous, réservations, soumissions : banque, état, conditions d'un accord), `pieces.json` (pièces de ses dossiers : état, motif d'un rejet, versions), `co-emprunteurs-et-garants.json`, `messages.json`, `simulations.json`, `consentements.json`, `avis.json` (retours et réponses aux enquêtes), `proches.json` (personnes de confiance), `cafes.json` et `alertes-et-favoris.json` `[P1]`, `emails.json` (e-mails reçus : date, objet, modèle) ;
- `pieces/{référence du dossier}/` : le fichier de la version en cours de chacune de ses pièces.

**Co-emprunteurs et garants.** Leurs données, telles que l'espace du client les lui montre, figurent dans `co-emprunteurs-et-garants.json` ; les fichiers que le client a lui-même déposés pour eux (`DocumentVersion.uploadedById`) figurent dans `pieces/{référence du dossier}/fournies-pour-{prénom}/`. Les deux sont marqués « Fournies pour {prénom} {nom} ». Les fichiers déposés pour eux par l'équipe n'y sont pas.

**Exclus** : ce que le client ne voit pas (ROL-031) — notes internes, tâches, score de préqualification, motif interne de perte d'un dossier (`lostReason`, `lostNote`), échanges entre l'équipe et une banque ou un promoteur, nom des interlocuteurs des banques, commission — ; les pièces internes (`DossierDocument.isInternal`) ; le journal d'audit. Une note interne demandée expressément est jointe à la main, après relecture (ADM-063).

**PRO-051** `[P1]` **Mes accords.** La liste des consentements et leur état :

| Accord | Affichage | Action |
|---|---|---|
| Conditions générales, politique de confidentialité | « Acceptées le {date} (version {version}). » | Lien vers le texte. |
| Actualités par e-mail | Bascule. | PRO-030. |
| Transmission du dossier aux partenaires | « Donné le {date}. » · « Enregistré par {conseiller} le {date}. » (GED-070) · « Retiré le {date}. » — ou « Retrait enregistré par {conseiller} le {date}. » (GED-071) · ou « Non donné. » | « Donner mon accord » (DOS-040) · « Retirer mon accord ». |
| Accord d'un co-emprunteur ou d'un garant | « Vous avez confirmé l'accord de {prénom} le {date}. » (DOS-032) | — (retirer la personne du dossier : DOS-031). |

**Retirer l'accord de transmission** demande une confirmation : « Nous ne pourrons plus transmettre votre dossier aux banques ni au promoteur. Les transmissions déjà faites ne peuvent pas être annulées. ». Effets : une ligne `Consent` de retrait ; les liens de partage encore actifs sont révoqués ; plus aucun envoi ni téléchargement par une banque n'est possible (CYC-161) ; l'événement `consent.changed` part : le conseiller est notifié et reçoit la tâche « {client} a retiré son accord de transmission » (`R_CONSENT_WITHDRAWN`) ; une ligne s'ajoute à la chronologie de chaque dossier ouvert. Tant que le moteur de règles n'est pas livré, la tâche (priorité haute) est créée directement par l'action, avec la clé de la règle (AUT-084, D-097). Les soumissions en cours ne sont pas retirées d'office — la banque a déjà le dossier — : le conseiller décide avec le client.

**PRO-060** `[P1]` **Supprimer mon compte.** L'écran explique : « Votre compte et vos données personnelles seront effacés. Certaines informations doivent être conservées quelques années pour des raisons légales ; elles ne servent alors à rien d'autre. Cette action est définitive. ». Le client confirme que c'est bien lui (mot de passe, ou code reçu par e-mail : AUTH-086) et saisit le mot « SUPPRIMER » (TRV-095). Puis, selon sa situation :

| Situation | Traitement |
|---|---|
| Aucun dossier au-delà de l'étape `QUALIFICATION`, aucune pièce déposée, et la personne n'est ni co-emprunteur ni garant dans le dossier d'un autre client (reconnue à son adresse e-mail ; une ligne saisie sans adresse ne peut pas l'être : elle part avec le dossier qui la porte, SEC-110) | **Immédiat et automatique**, dans cet ordre : l'e-mail `C_ACCOUNT_DELETED` est mis en file (il doit partir avant que l'adresse disparaisse) ; ses dossiers ouverts sont clôturés (`CLIENT_WITHDREW`) et ses demandes ouvertes avec eux (CYC-035) — aucune relance ne court donc plus sur lui ; ses données sont effacées (SEC-111) ; le compte passe `DELETED`. Une `DataRequest` d'effacement est créée **déjà traitée**, pour la trace ; le conseiller qui le suivait en est prévenu (`NS_CLIENT_ERASURE`). |
| Un dossier plus avancé, ou des pièces déposées, ou un dossier gagné — ou la personne figure dans le dossier d'un autre client, que l'administrateur traitera avec le sien (ADM-063) | Une `DataRequest` d'effacement est créée, identité réputée vérifiée (il est connecté). **Rien ne reste en suspens** (CYC-200) : le compte est suspendu aussitôt et les sessions fermées ; ses dossiers ouverts sont mis en pause ; le traitement de sa fiche est limité — plus aucune relance, plus aucun e-mail automatique — ; ses liens de partage sont révoqués ; son conseiller référent reçoit une tâche prioritaire (`R_DELETION_REQUESTED` ; sans référent, elle est à prendre et les administrateurs en sont notifiés), et les administrateurs la demande à traiter. La connexion affiche « Votre demande de suppression est en cours de traitement. ». Un administrateur la traite sous un mois (ADM-062) : clôture des dossiers, retrait des soumissions, effacement de ce qui peut l'être, conservation de ce que la loi impose (SEC-111). L'e-mail `C_DATA_REQUEST_DONE` confirme la fin. |

Dans les deux cas, un écran final confirme : « Votre demande est enregistrée. ». Avant de valider, si un dossier est en cours : « Vous avez un dossier en cours ({référence}). La suppression y met fin. ». Tant que la demande n'est pas traitée, le client peut se **rétracter** en écrivant à l'équipe (l'adresse de contact figure sur l'écran final et sur l'écran de connexion) : le compte est rétabli, ses dossiers restent en pause jusqu'à ce que son conseiller les reprenne, et la demande est close selon CYC-230.

## 6. Avis (EC-54)

**PRO-070** `[P1]` La page « Mon avis » s'ouvre par l'entrée « Mon avis » du menu (ECL-001), par la carte « Votre avis en 2 minutes » du tableau de bord, et par la notification d'une enquête. Elle réunit :
- les **enquêtes en attente** : une carte par invitation non répondue et non expirée, avec « Répondre » ;
- **« Donner mon avis »** : à tout moment (PRO-071) ;
- **mes avis** : la liste de ce qu'il a déjà envoyé (date, sujet), en lecture seule.

Sans enquête en attente : « Aucune enquête en attente. Vous pouvez à tout moment nous donner votre avis. » ; sans avis envoyé : « Vous n'avez pas encore donné votre avis. »

**PRO-071** `[P1]` **Avis spontané.** « À quel sujet ? » (Mon parcours · La communication · Un bien · Le financement · Le site · Le Café · Autre) · une note de 1 à 5, facultative · « Votre message » (10 à 3 000 caractères). Envoi : un `Feedback` de nature `SPONTANEOUS`, rattaché au client, à son dossier en cours et à l'étape de ce dossier — avec plusieurs dossiers ouverts, celui dont `lastActivityAt` est le plus récent ; sans dossier ouvert, aucun. La note est rangée dans `csatScore` : une note de 1 ou 2 met l'avis dans la vue « Négatifs » et déclenche `R_FEEDBACK_NEGATIVE` (FBK-002, AUT-067) ; un avis spontané n'entre pas dans les indices de M19. Confirmation : « Merci. Votre avis est transmis à l'équipe. ».

**PRO-072** `[P1]` **Répondre à une enquête** — depuis l'espace, par les routes de l'invitation, sans jeton (`GET /client/surveys/{invitationId}`, API-100), ou sans connexion par le lien de l'e-mail (EP-25, `/enquete/{jeton}` ; le lien du rappel porte un autre jeton, qui ouvre la même invitation : AUT-066). Une seule page : l'introduction de l'enquête, puis ses questions.

| Type | Saisie |
|---|---|
| `NPS` | Onze boutons de 0 à 10, avec « Certainement pas » à gauche et « Certainement » à droite. |
| `CSAT` | Cinq boutons de 1 à 5, avec « Pas du tout » et « Tout à fait ». |
| `CHOICE` | Boutons radio. |
| `TEXT` | Zone de texte, 3 000 caractères. |

Les questions obligatoires sont signalées par l'absence de « (facultatif) » (TRV-062). Bouton « Envoyer mes réponses ». Les réponses ne sont enregistrées qu'à l'envoi. Ensuite : « Merci pour votre retour. Il nous aide à mieux vous accompagner. » ; si une option avec action a été choisie (FBK-031), la page ajoute « Un conseiller vous appelle {quand}. » (NOT-053) ou « Votre projection arrive {quand}. ». La page « déjà répondu » dit « …écrivez-nous à {contact.email} » (l'invité d'un Café n'a souvent pas d'espace).

**PRO-073** `[P1]` **Cas particuliers d'une enquête.**

| Cas | Écran |
|---|---|
| Déjà répondu | « Vous avez déjà répondu à cette enquête. Merci. » |
| Lien expiré (30 jours) ou enquête annulée | « Cette enquête est terminée. » et, pour un client connecté, « Donner mon avis ». |
| Jeton inconnu | « Ce lien a expiré ou a déjà été utilisé. » |

**PRO-074** `[P1]` Une réponse dont une option porte une action (« Être rappelé », « Recevoir une projection ») crée la demande correspondante au nom du client (FBK-031) ; l'écran de remerciement l'annonce : « C'est noté : un conseiller vous rappelle {quand}. » (NOT-053).
