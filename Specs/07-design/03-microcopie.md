# Microcopie

Les mots que lit l'utilisateur. Aucun n'est écrit dans le code (TRV-002) : ils vivent dans `packages/i18n`, un fichier par langue et par espace de noms.

**Où est le texte exact d'un écran ?** Dans le fichier de son module, cité entre guillemets « ». Ce texte **fait foi**. Le présent fichier fixe : la façon d'écrire, la façon de nommer les clés, les textes **communs à plusieurs écrans**, et les messages d'erreur. Dans tous ces fichiers, l'apostrophe droite est employée par commodité ; les fichiers de traduction utilisent l'apostrophe typographique et les espaces insécables (TRV-010).

---

## 1. Écrire

**Voix.** On parle au client comme un conseiller compétent et bienveillant : phrases courtes, mots simples, au **vous**, au présent. On dit ce qui se passe, ce qu'il doit faire, ce qui vient ensuite (principe 2). On ne s'excuse pas à sa place ; on ne s'exclame pas ; on ne promet rien que la plateforme ne tient pas (principe 4).

**Lexique.** Un mot, un sens (`00-cadre/03`).

| On écrit | On n'écrit pas | Pourquoi |
|---|---|---|
| un **bien**, un **programme**, un **lot** | une annonce, un produit, une propriété | Vocabulaire de la maquette validée. |
| votre **espace** | votre compte, votre tableau de bord | « Compte » est réservé à la sécurité (« votre compte est suspendu »). |
| votre **conseiller** | votre agent, votre gestionnaire, l'administrateur | |
| une **pièce** (ce qu'on demande) ; un **fichier** (ce qu'on dépose) | un document à uploader | |
| **déposer**, **envoyer** | uploader, soumettre | |
| une pièce **à refaire** | une pièce rejetée, refusée | NOT-005. |
| la banque **n'a pas donné suite** | la banque a refusé, vous êtes refusé | |
| **financement** ; **crédit bancaire** ; **financement islamique** | prêt halal, crédit islamique | CAL-047. |
| **mensualité indicative**, **estimation** | votre mensualité, votre taux | Rien n'est une offre (TRV-024). |
| **sous 48 h ouvrées** | immédiatement, très vite | Ce que l'équipe tient vraiment (CAL-061). À l'écran, la première occurrence de « ouvrées » ou « ouvrés » porte l'explication `common.businessDays` : en infobulle, et sur téléphone en une ligne dessous. Dans un e-mail : NOT-053. |
| **Le Café** | l'événement, le salon, le webinaire | Q-035. |
| **Se connecter**, **Créer mon espace** | Login, S'enregistrer | |

**Boutons.** Un verbe à l'infinitif, ou à la première personne quand l'action engage (« Je m'inscris », « Recevoir ma projection »). Jamais « OK », « Valider », « Cliquez ici ». Le bouton dit ce qui va se passer : « Envoyer ma demande », pas « Envoyer ».

**Messages d'erreur.** Ce qui ne va pas, puis quoi faire. Jamais « Erreur », jamais un code seul, jamais de reproche (« Vous avez mal saisi… »).

**Écriture inclusive.** Formules qui évitent le genre plutôt que parenthèses ou points médians : « Vous êtes bien inscrit » devient « Votre inscription est confirmée ». « Votre conseiller » vaut pour toute personne qui conseille.

## 2. Clés

**Trois familles de clés, à ne pas confondre.**

| Famille | Où elle vit | Qui la change | Référence |
|---|---|---|---|
| **Textes d'interface** | Fichiers de traduction (`packages/i18n`) | Une mise à jour de l'application | Ce fichier |
| **Blocs de contenu** | Table `ContentBlock` | L'administrateur, dans « Textes du site » | CMS-020 |
| **Paramètres** | Table `Setting` | L'administrateur, dans « Paramètres » | `01-domaine/10`, § 1 |

Les modèles d'e-mail sont une quatrième chose : des données de la table `EmailTemplate` (`01-domaine/09`).

**Forme d'une clé de texte d'interface.** `{espace}.{écran ou objet}.{élément}` en `camelCase` : `ui.catalogue.filters.submit`, `ui.space.documents.status.rejected`, `ui.admin.dossier.close.confirm`. Toutes commencent par `ui.`, ce qui les distingue des blocs et des paramètres ; dans la suite de ce fichier, ce préfixe est omis pour alléger.

| Espace de noms | Contenu |
|---|---|
| `common` | Boutons, états, mots communs (§ 3) |
| `validation`, `error` | Messages de TRV-064 et § 4 |
| `condition` | Conditions manquantes d'une transition (§ 4) |
| `enum` | Libellés des énumérations : `enum.{Énumération}.{VALEUR}` ; quand le libellé du client diffère de celui du back-office : `enum.{Énumération}.{VALEUR}.client` ; libellé au pluriel employé dans un titre : `enum.{Énumération}.{VALEUR}.plural` (`01-domaine/01`, § 3) |
| `nav`, `home`, `catalogue`, `property`, `lead`, `sim`, `cafe`, `pages` | Site public |
| `auth` | Compte et authentification |
| `client` | Espace client : cadre, menu, onglets, tableau de bord, visite de la première venue, suivi, profil (le premier code a nommé cet espace `client`, et non `space` — D-097) ; les sous-espaces `documents` (« Mes pièces »), `clientTools` (simulations, favoris, alertes de l'espace), `notifications` (titres des notifications, par type) |
| `favorites`, `alerts`, `compare`, `preferences`, `assistant`, `projection`, `partner`, `editorial`, `help`, `notice`, `email` | Favoris et alertes sans compte, comparateur, préférences d'e-mail, assistant, projection, espace partenaire, pages éditoriales, aides « ? », mentions, morceaux communs des e-mails |
| `admin` | Back-office |
| `pdf` | Documents produits |
| `notice` | Mentions fixes, non modifiables par paramètre (§ 7) |

**Variables et pluriels.** Variables entre accolades : `{prenom}`, `{n}`, `{date}`. Les pluriels suivent le format ICU, avec **toutes** les formes utiles :

```
catalogue.count = {n, plural, =0 {Aucun bien} one {# bien correspond} other {# biens correspondent}}
cafe.seats      = {n, plural, one {Il reste # place} other {Il reste # places}}
```

Un texte n'est jamais construit en collant des morceaux : l'ordre des mots change d'une langue à l'autre.

## 3. Textes communs

| Clé | Texte |
|---|---|
| `common.save` | Enregistrer |
| `common.cancel` | Annuler |
| `common.edit` | Modifier |
| `common.delete` | Supprimer |
| `common.close` | Fermer |
| `common.back` | Retour |
| `common.continue` | Continuer |
| `common.send` | Envoyer |
| `common.retry` | Réessayer |
| `common.search` | Rechercher |
| `common.filters` | Filtres |
| `common.clearAll` | Tout effacer |
| `common.export` | Exporter |
| `common.download` | Télécharger |
| `common.share` | Partager |
| `common.copyLink` | Copier le lien |
| `common.linkCopied` | Lien copié. |
| `common.seeAll` | Tout voir |
| `common.readMore` | Lire la suite |
| `common.optional` | (facultatif) |
| `common.yes` · `common.no` | Oui · Non |
| `common.none` | — |
| `common.loading` | Chargement… |
| `common.saved` | Modifications enregistrées. |
| `common.undo` | Annuler |
| `common.automatic` | Automatique |
| `common.deletedUser` | Utilisateur supprimé |
| `common.team` | L'équipe Diaspora Patrimoine |
| `common.perMonth` | / mois |
| `common.from` | À partir de |
| `common.rateDate` | Taux indicatif du {date} |
| `common.empty.generic` | Rien à afficher pour le moment. |
| `common.empty.filtered` | Aucun résultat pour ces filtres. |
| `common.error.block` | Ce contenu n'a pas pu être chargé. |
| `common.offline` | Connexion interrompue. Vos saisies sont conservées, nous réessayons… |
| `common.sessionExpired.title` | Votre session a expiré |
| `common.sessionExpired.text` | Reconnectez-vous pour continuer. Rien de ce que vous avez saisi n'est perdu. |
| `common.unsaved.title` | Vous avez des modifications non enregistrées. |
| `common.unsaved.text` | Quitter sans enregistrer ? |
| `common.unsaved.stay` · `common.unsaved.leave` | Rester · Quitter |
| `common.conflict.text` | Cette fiche a été modifiée par {prenom} à {heure}. Rechargez-la pour voir la dernière version ; vos changements ne sont pas enregistrés. |
| `common.conflict.reload` · `common.conflict.copy` | Recharger · Copier mes changements |
| `common.confirm.typeWord` | Pour confirmer, saisissez {mot}. |
| `common.time.now` | à l'instant |
| `common.time.minutes` | il y a {n} min |
| `common.time.hours` | il y a {n} h |
| `common.time.yesterday` | hier |
| `common.time.days` | il y a {n} jours |
| `common.euHosting` | Vos données sont hébergées dans l'Union européenne. |
| `common.writeToAdvisor` | Écrire à mon conseiller |
| `common.businessDays` | Jours ouvrés : {jours}, hors jours fériés français. — `{jours}` d'après `business.calendar.workdays` (« du lundi au vendredi » par défaut) |
| `common.provisional` | Version provisoire, en cours de validation |
| `common.list.range` | {debut}–{fin} sur {total} |
| `common.list.pageSize` | Lignes par page |
| `common.list.restored` | Filtres de votre dernière visite |
| `common.list.newItems` | {n, plural, one {# nouvel élément} other {# nouveaux éléments}} · Afficher |
| `common.list.selected` | {n, plural, one {# sélectionné} other {# sélectionnés}} |
| `common.list.unselectAll` | Tout désélectionner |
| `common.list.moreFilters` | Plus de filtres |
| `common.search.suggestions` | {n, plural, one {# suggestion} other {# suggestions}} — annoncé aux lecteurs d'écran |
| `common.search.recent` | Recherches récentes |
| `common.search.clearRecent` | Effacer |
| `common.search.noResult` | Aucun résultat pour « {saisie} ». Vérifiez l'orthographe, ou cherchez une ville. |
| `common.search.openReference` | Ouvrir le bien {reference} |
| `common.textSize.title` | Taille du texte |
| `common.textSize.normal` · `common.textSize.large` · `common.textSize.xlarge` | Normale · Grande · Très grande |
| `common.tour.next` · `common.tour.done` · `common.tour.skip` · `common.tour.replay` | Suivant · Terminer · Passer · Revoir la visite |
| `common.tour.step` | {n} sur {total} |
| `common.tour.1.title` · `common.tour.1.text` | Votre projet, étape par étape · Ici, vous voyez où en est votre projet et ce qui vient ensuite. |
| `common.tour.2.title` · `common.tour.2.text` | Ce que vous avez à faire · Quand nous avons besoin de vous, c'est ici que vous le voyez en premier. |
| `common.tour.3.title` · `common.tour.3.text` | Votre conseiller · Une question ? Écrivez-lui : il vous répond. |
| `common.saving.done` | Enregistré |
| `common.online` | Connexion rétablie. |
| `common.password.show` · `common.password.hide` | Afficher · Masquer |
| `common.capsLock` | Les majuscules sont activées. |
| `common.emailSuggestion` | Vouliez-vous dire {adresse} ? |
| `common.codeValidity` | Ce code est valable {n} minutes. |
| `common.stepOf` | Étape {n} sur {total} |
| `common.simpleMode.label` · `common.simpleMode.help` | Affichage simplifié · Moins d’éléments à l’écran, une question à la fois. |
| `common.simpleMode.more` | Voir tous les détails |
| `common.voice.listen` · `common.voice.pause` · `common.voice.stop` | Écouter · Pause · Arrêter |
| `common.voice.dictate` · `common.voice.listening` | Dicter · Je vous écoute… |
| `common.compare.add` · `common.compare.tray` · `common.compare.full` | Comparer · Comparer ({n}) · Vous comparez déjà trois biens : retirez-en un pour ajouter celui-ci. |
| `common.compare.diffOnly` | Afficher seulement les différences |
| `common.map.toggle` · `common.map.searchArea` | Liste · Carte · Rechercher dans cette zone |
| `common.search.save` | Enregistrer cette recherche |
| `space.steps.{n}.hint` | Phrase sous l'étape {n} (1 à 6) de la frise de l'espace client : textes et variante sans financement dans ECL-020 |

## 4. Erreurs

**Comment l'écrire et où l'afficher** : TRV-113, TRV-114. Textes communs :

| Clé | Texte |
|---|---|
| `common.error.summary` | {n, plural, one {Un point est à corriger avant d'envoyer} other {# points sont à corriger avant d'envoyer}} |
| `common.error.help` | Besoin d'aide ? Appelez-nous au {telephone} ou écrivez-nous sur WhatsApp. — chaque moyen n'apparaît que s'il est renseigné ; sans téléphone ni WhatsApp : « Besoin d'aide ? Écrivez-nous à {email}. » |
| `common.error.notSent` | Rien n'a encore été envoyé ; ce que vous avez saisi est conservé. |
| `common.error.details` | Détails |
| `common.error.copyDetails` | Copier les détails |
| `common.error.detailsCopied` | Détails copiés. |
| `common.error.newCode` | Recevoir un nouveau code |
| `common.error.otherFile` | Choisir un autre fichier |

**Par code** : TRV-110. **Par champ** : TRV-064. **Par raison**, pour les codes `CONFLICT_STATE` et `FORBIDDEN` (API-020) — le serveur envoie la raison, l'interface affiche la phrase **seule**, à la place du message général du code (TRV-110) ; le message général ne sert qu'à une raison sans phrase :

| Raison | Message |
|---|---|
| `LEAD_ALREADY_TAKEN` | Cette demande vient d'être prise en charge par {prenom}. |
| `LEAD_ALREADY_CONTACTED` | Un premier contact est noté : la demande ne se rend plus. |
| `LEAD_REOPEN_TOO_OLD` | Cette demande est clôturée depuis plus de 90 jours. |
| `LEAD_ATTACHED` | Cette demande se traite dans le dossier {reference}. |
| `TASK_REOPEN_TOO_OLD` | Cette tâche est fermée depuis plus de 30 jours. |
| `APPOINTMENT_NOT_STARTED` | Le rendez-vous n'a pas encore commencé. |
| `APPOINTMENT_STARTED` | Le rendez-vous a commencé : renseignez son issue. |
| `OUTCOME_TOO_OLD` | Cette issue date de plus de 7 jours : elle ne se corrige plus. |
| `LOG_TOO_OLD` | Ce compte rendu a plus de 24 heures : ajoutez-en un autre. |
| `LOT_ALREADY_OPTIONED` | Ce lot est déjà sous option pour un autre client jusqu'au {date}. |
| `LOT_NOT_AVAILABLE` | Ce lot n'est plus disponible. |
| `LOT_HAS_ACTIVE_RESERVATION` | Ce lot a une réservation en cours : modifiez-la depuis le dossier. |
| `DOSSIER_HAS_RESERVATION` | Ce dossier a déjà une option ou une réservation en cours. Annulez-la d'abord pour en poser une autre. |
| `DOSSIER_ALREADY_OPEN_FOR_PROPERTY` | Ce client a déjà un dossier ouvert pour ce bien. |
| `TRANSITION_NOT_ALLOWED` | Cette action n'est pas possible à cette étape. |
| `MISSING_CONDITIONS` | Il manque : {liste}. |
| `STAGE_IS_AUTOMATIC` | Cette étape se déclenche {explication}. — {explication} : « à l'envoi d'une soumission » (Étude bancaire), « à l'accord d'une banque » (Accord). |
| `CANNOT_SKIP_STAGE` | On ne peut pas sauter une étape. |
| `SUBMISSION_IN_PROGRESS` | Retirez d'abord les soumissions en cours ({banques}). — {banques} : les banques des soumissions non terminées, envoyées par le serveur. |
| `SUBMISSION_ALREADY_EXISTS` | Une soumission est déjà en cours auprès de cette banque. |
| `BANK_NOT_ACTIVE` | Cette banque est suspendue : aucun dossier ne peut lui être envoyé. |
| `CONSENT_REQUIRED` | Le client n'a pas donné (ou a retiré) son accord de transmission. |
| `PARTY_CONSENT_MISSING` | L'accord de {prenom} pour transmettre ses documents n'est pas confirmé. |
| `PARTY_RESTRICTED` | Le traitement des données de {prenom} est limité à sa demande : ses pièces ne peuvent pas être transmises. |
| `LOT_REFERENCE_PENDING` | Saisissez d'abord la référence de ce lot. |
| `DOSSIER_ON_HOLD` | Reprenez d'abord le dossier. |
| `DOSSIER_CLOSED` | Ce dossier est terminé : ses pièces sont en lecture seule. |
| `RESERVATION_ACTIVE` | Annulez d'abord la réservation du lot {lot}. |
| `PROPERTY_OFFLINE` | Ce bien est hors ligne. Republiez sa fiche, ou choisissez-en un autre. |
| `LOT_NOT_DELETABLE` | Ce lot est sous option, réservé ou vendu. Passez par sa réservation. |
| `SALE_NOT_EXTERNAL` | Ce lot a été vendu par un dossier : sa vente ne se corrige pas ici. |
| `DEPOSIT_PENDING` | Enregistrez d'abord l'issue de l'acompte. |
| `DECISION_TOO_OLD` | Cette décision date de plus de 7 jours : elle ne s'annule plus. Corrigez-la, ou retirez la soumission. |
| `DECISION_NOT_PUBLISHED` | Cette décision sera publiée à {heure} : réessayez ensuite. |
| `VERSION_IN_SENT_PACKAGE` | Cette version a été transmise à {banque}. Retirez d'abord la soumission, ou générez un paquet sans elle. |
| `PACKAGE_PURGED` | Cette archive n'existe plus. Générez un nouveau paquet. |
| `PACKAGE_OUTDATED` | Téléchargez le paquet à jour et transmettez-le à la banque avant de confirmer l'envoi. |
| `RATE_IS_LAST` | C'est le seul cours de ce couple de devises : saisissez-en un autre avant de l'annuler. |
| `CLIENT_HAS_NO_EMAIL` | Ce client n'a pas d'adresse e-mail. |
| `CLIENT_RESTRICTED` | Le traitement des données de cette personne est limité à sa demande. |
| `WOULD_UNPUBLISH_CHILDREN` | Ce changement rendrait non publiables : {liste}. |
| `PROGRAM_HAS_PROPERTIES` | Ce programme a {n} biens : archivez-le, ou supprimez d'abord ses biens. |
| `FEATURE_DISABLED` | Cette fonction n'est pas disponible pour le moment. |
| `STORAGE_FULL` | Le dépôt de fichiers est momentanément indisponible. Réessayez plus tard. |
| `TOO_MANY_IMAGES` | 30 photos au maximum par dépôt. Pour un document plus long, déposez un PDF. |
| `TOO_MANY_FILES` | {n} fichiers au maximum pour cette pièce. Réunissez vos pages en un seul PDF, ou retirez un fichier. |
| `DOCUMENT_SCANNING` | Le dépôt précédent de cette pièce est en cours de vérification de sécurité. Réessayez dans un instant. |
| `UPLOAD_NOT_RECEIVED` | Le fichier n'est pas arrivé. Déposez-le à nouveau. |
| `PREVIEW_READ_ONLY` | Aperçu en lecture seule : aucune action n'est possible. |
| `MODE_SWITCH_BLOCKED` | Retirez d'abord les soumissions en cours pour passer ce dossier sans financement. |
| `OPTION_ALREADY_ANSWERED` | Le promoteur a déjà répondu à cette option le {date}. |
| `LOT_HELD_BY_DOSSIER` `[P2]` | Ce lot est sous option ou réservé par un client de Diaspora Patrimoine : répondez à la demande correspondante. |
| `REQUEST_ALREADY_ANSWERED` `[P2]` `[P3]` | Une réponse a déjà été enregistrée le {date}. |
| `ALERT_LIMIT` | Vous avez atteint le nombre maximal d'alertes. Supprimez-en une pour en créer une nouvelle. (CAT-072) |
| `SEARCH_LIMIT` | Vous avez atteint le nombre maximal de recherches enregistrées. Supprimez-en une pour en enregistrer une nouvelle. (CAT-093) |
| `SIMULATIONS_LIMIT` | Vous avez atteint le nombre maximal de simulations enregistrées. Supprimez-en une pour en garder une nouvelle. (SFA-012) |
| `FAVORITES_LIMIT` | Vous avez atteint le nombre maximal de favoris ({n}). Retirez-en un pour en ajouter un autre. (SFA-023) |
| `REGISTRATION_REFUSED` | Votre inscription n'a pas pu être enregistrée. Contactez-nous. (CAF-026) |
| `HAS_PASSWORD` | Votre compte a un mot de passe : saisissez-le pour confirmer. (AUTH-086) |
| `ACCESS_LEVEL_REQUIREMENTS` `[P2]` `[P3]` | Désignez d'abord un interlocuteur qui répond aux demandes, avec une adresse e-mail. |
| `OFFER_EXPIRED` | Cette offre a expiré. |
| `DOCUMENT_TOO_OLD` | Ce document est trop ancien (validité : {n} jours). Rejetez-le avec le motif « Document trop ancien ». |
| `DOCUMENT_LOCKED` | Cette pièce est validée. Pour la modifier, écrivez à votre conseiller. |
| `DOCUMENT_IN_SENT_PACKAGE` | Cette pièce fait partie d'un dossier déjà envoyé à une banque. |
| `NO_CHECKLIST_TEMPLATE` | Aucune liste de pièces n'est définie. Créez-en une dans Pièces › Modèles de listes. |
| `DEFAULT_TEMPLATE_REQUIRED` | Il doit rester un modèle de dossier client actif et par défaut. |
| `DOCUMENT_HAS_FILES` | Cette pièce a déjà un fichier : dispensez-la. |
| `CONSENT_PROOF` | La preuve d'un accord ne se supprime pas. |
| `CONSENT_SUPERSEDED` | Le client a modifié son accord le {date}, après la date saisie. |
| `NOT_PUBLISHABLE` | Cette fiche ne peut pas encore être publiée. Il manque : {liste}. |
| `WOULD_UNPUBLISH` | Ce changement rendrait la fiche non publiable. Dépubliez-la d'abord. |
| `EVENT_FULL` | Ce Café vient d'afficher complet. |
| `NOT_ENOUGH_SEATS` | Il ne reste que {n} places. |
| `REGISTRATION_CLOSED` | Les inscriptions sont closes. |
| `EVENT_NOT_OPEN` | Les inscriptions ne sont pas encore ouvertes. |
| `EVENT_CANCELLED` | Ce Café est annulé. |
| `CAPACITY_BELOW_TAKEN` | La capacité ne peut pas être inférieure aux {n} places déjà prises. |
| `LAST_OWNER` | Il doit rester au moins un compte Direction. |
| `USER_HAS_OPEN_WORK` | Réaffectez d'abord ses demandes, ses dossiers et ses tâches. |
| `EMAIL_IN_USE` | Cette adresse est déjà utilisée par un compte. |
| `BOTH_HAVE_ACCOUNTS` | Ces deux fiches ont chacune un compte. L'une des deux personnes doit d'abord supprimer le sien. |
| `CLIENT_ERASED` | Les données de cette fiche ont été effacées : elle ne se fusionne pas. |
| `HAS_OPEN_DOSSIER` | Ce client a un dossier en cours. |
| `IN_USE` | Cet élément est utilisé : il ne peut pas être supprimé. Vous pouvez le désactiver. |
| `MAX_REACHED` | Vous avez atteint le maximum ({n}). |
| `MAX_EXTENSIONS_REACHED` | Cette option a déjà été prolongée {n} fois. |
| `LINK_EXPIRED` | Ce lien a expiré ou a déjà été utilisé. |
| `SHARE_LOCKED` | Ce lien est verrouillé après plusieurs codes erronés. Contactez votre interlocuteur chez Diaspora Patrimoine. |
| `ALREADY_ANSWERED` | Vous avez déjà répondu à cette enquête. Merci. |
| `RATE_MISSING` | Il manque un taux de change pour cette devise. |
| `MESSAGE_DELETE_EXPIRED` | Un message ne se supprime que dans les 5 minutes qui suivent son envoi. |
| `CLIENT_NO_ACTIVE_SPACE` | {client} n'a pas encore d'espace : il ne verrait pas votre message. |
| `EMAIL_ALREADY_SENT` | Cet e-mail est déjà parti. |
| `EMAIL_NOT_RESENDABLE` | Cet e-mail ne se renvoie pas : il contenait un lien personnel ou l'extrait d'un message. |
| `EXECUTION_NOT_PENDING` | Cette exécution n'est plus en attente. |
| `TEMPLATE_IS_SYSTEM` | Ce modèle est indispensable : il ne peut être ni désactivé ni supprimé. |
| `RULE_IS_SYSTEM` | Une règle d'origine se désactive, elle ne se supprime pas. |
| `TEMPLATE_HAS_NO_GROUP` | Choisissez un modèle qui appartient à un groupe de préférences — pour un envoi groupé, au groupe « Actualités ». |
| `BULK_TOO_MANY_RECIPIENTS` | {k} destinataires : {max} au plus par envoi. Affinez les filtres. |
| `WRONG_AUDIENCE` | Ce compte est un compte professionnel. Connectez-vous depuis votre espace dédié. |
| `TESTIMONIAL_CONSENT_MISSING` | L'accord écrit de la personne est nécessaire pour publier son témoignage. |
| `SURVEY_TRIGGER_TAKEN` | Une autre enquête active utilise déjà ce déclencheur : {nom}. |
| `SURVEY_TRIGGER_LOCKED` | Le déclencheur d'une enquête de départ ne se change pas. |
| `QUESTION_TYPE_LOCKED` | Cette question a déjà des réponses : retirez-la et ajoutez-en une autre. |
| `REDIRECT_INVALID` | Cette redirection mènerait à elle-même, formerait une boucle, ou partirait d'une page existante. |
| `LEGAL_VERSION_PUBLISHED` | Cette version est publiée : elle ne se modifie plus. Créez-en une nouvelle. |
| `RESTORE_CONFLICT` | Cette adresse est reprise par {objet} : choisissez-en une autre. |
| `IDENTITY_NOT_VERIFIED` | Vérifiez d'abord l'identité du demandeur. |
| `ERASURE_BLOCKED` | L'effacement n'est pas possible tant que reste : {liste}. |
| `EXPORT_TOO_SOON` | Vous avez déjà demandé vos données il y a moins de 24 heures. Vous pourrez renouveler la demande le {date}. |
| `LAUNCH_CHECKLIST_OPEN` | Il reste des points à régler avant la mise en ligne : {liste}. |
| `REAUTH_REQUIRED` | Confirmez votre mot de passe pour continuer. — titre de la fenêtre de confirmation, qui rejoue ensuite l'action (BO-005) |

Une raison absente de ce tableau s'affiche avec le message général de son code (TRV-110) et est signalée comme un défaut : toute raison que le serveur peut renvoyer doit avoir sa phrase.

**Conditions manquantes** (`ui.condition.{CODE}`, API-102). Avec les raisons `MISSING_CONDITIONS` et `NOT_PUBLISHABLE`, chaque entrée de `details[]` porte le code d'une condition ; l'interface compose « Il manque : {liste} » avec ces libellés, séparés par des virgules, et la fenêtre de CYC-030 en fait une ligne chacun.

| Clé | Texte |
|---|---|
| `condition.AGENT_ASSIGNED` | un conseiller affecté |
| `condition.FIRST_CONTACT` | le premier contact avec le client |
| `condition.CLIENT_NAME` | le prénom et le nom du client |
| `condition.CLIENT_RESIDENCE_COUNTRY` | le pays de résidence du client |
| `condition.CLIENT_RESIDENCY_STATUS` | la situation de résidence du client |
| `condition.CLIENT_BUDGET` | le budget du client (total ou mensuel) |
| `condition.CLIENT_DOWN_PAYMENT` | l'apport du client (0 est accepté) |
| `condition.CLIENT_FINANCING_PREFERENCE` | le mode de financement souhaité |
| `condition.CLIENT_TIMEFRAME` | l'horizon d'achat |
| `condition.CLIENT_CONTACT_ALLOWED` | l'accord du client pour être contacté (« Ne plus contacter » est coché sur sa fiche) |
| `condition.SELECTED_CANDIDATE` | un bien retenu, et un seul |
| `condition.PROPERTY_AVAILABLE` | un bien retenu encore disponible |
| `condition.CLIENT_EMPLOYMENT` | la situation professionnelle du client |
| `condition.DOSSIER_COMPLETE` | un dossier complet |
| `condition.LOT_SELECTED` | un lot choisi |
| `condition.LOT_RESERVED` | une réservation confirmée du lot |
| `condition.LOT_AVAILABLE` | un lot encore disponible |
| `condition.ACCEPTED_SUBMISSION` | une offre de banque acceptée et encore valable |
| `condition.DEED_SIGNED` | la date de signature de l'acte (au plus tard aujourd'hui) |
| `condition.SALE_AMOUNT` | le prix de vente final |
| `condition.LOT_OF_SELECTED_PROPERTY` | un lot du bien retenu par ce dossier |
| `condition.REQUIRED_FIELDS` | les champs obligatoires de la fiche |
| `condition.LOT_WITH_PRICE` | au moins un lot avec un prix |
| `condition.READY_MEDIA` | au moins un média prêt (photo, image 3D ou plan) |
| `condition.COMPLETENESS_SCORE` | un score de complétude suffisant |
| `condition.PROMOTER_ACTIVE` | un promoteur sélectionné |
| `condition.PROGRAM_PUBLISHED` | le programme publié |
| `condition.COUNTRY_ACTIVE` | un pays ouvert au catalogue |
| `condition.DESCRIPTION_LENGTH` | une description d'au moins 100 caractères |
| `condition.BANK_DOCS_VALIDATED` | les pièces obligatoires de la banque, validées ou dispensées |
| `condition.LOAN_REQUEST` | le montant demandé et la durée |
| `condition.TRANSMISSION_DETAILS` | les informations d'envoi (destinataire avec une adresse e-mail, ou envoi hors plateforme confirmé) |
| `condition.FINANCING_REQUESTED` | un dossier avec financement |

## 5. Aides de saisie

| Champ | Exemple affiché dans le champ vide | Aide sous le champ |
|---|---|---|
| E-mail | `prenom.nom@exemple.fr` | — |
| Téléphone | `6 12 34 56 78` | Avec l'indicatif de votre pays. |
| Mot de passe | — | 10 caractères au minimum. Une phrase que vous seul connaissez fait un bon mot de passe. |
| Apport | `30 000` | La somme que vous pouvez payer sans emprunter. |
| Mensualité confortable | `400` | Ce que vous pouvez rembourser chaque mois sans vous priver. |
| Revenus nets mensuels | — | Vos revenus après impôts et cotisations, tous revenus réguliers compris. |
| Mensualités de vos crédits en cours | — | 0 si vous n'en avez pas. |
| Année de naissance | `1985` | Elle sert seulement à calculer la durée de financement possible. |
| Votre situation | — | Les phrases de `enum.ResidencyStatus`. |
| Message | — | Dites-nous ce qui compte pour vous : le moment où vous joindre, vos questions. |
| Code d'accès (banque) | `000000` | Le code à 6 chiffres reçu dans un second e-mail. |

### 5.1 Explications « ? » (TRV-126)

| Clé | Terme | Explication |
|---|---|---|
| `ui.help.downPayment` | Apport | La somme que vous payez vous-même, sans l'emprunter. Plus elle est élevée, plus la mensualité baisse. |
| `ui.help.monthlyIndicative` | Mensualité indicative | Une estimation de ce que vous rembourseriez chaque mois. Le montant réel dépend de la banque et de votre dossier. |
| `ui.help.islamicFinancing` | Financement islamique | Un financement sans intérêt : la banque achète le bien et vous le revend avec une marge connue d'avance, payée chaque mois. |
| `ui.help.option` | Option | Le bien est mis de côté pour vous quelques jours, le temps de confirmer. Personne d'autre ne peut le prendre pendant ce temps. |
| `ui.help.reservation` | Réservation | Vous confirmez votre choix auprès du promoteur, en général avec un acompte. Le bien est retiré de la vente. |
| `ui.help.document` | Pièce | Un document que la banque ou le promoteur demande : pièce d'identité, bulletins de salaire, avis d'imposition… Vous pouvez la photographier avec votre téléphone. |
| `ui.help.businessDays` | Jours ouvrés | `common.businessDays`. |
| `ui.help.completeness` | Dossier complet à {n} % | La part des pièces demandées qui sont validées par votre conseiller. |
| `ui.help.borrowingCapacity` | Capacité d'emprunt | La somme qu'une banque pourrait vous prêter d'après vos revenus et vos charges. C'est une estimation. |
| `ui.help.vefa` | Vente sur plan | Vous achetez un logement avant ou pendant sa construction ; vous payez par étapes, au fil du chantier. |
| `ui.help.projection` | Projection | Un chiffrage de ce que vous pouvez acheter et rembourser chaque mois, préparé par un conseiller d'après votre apport et votre budget. |
| `ui.help.rooms` | Pièces | T3 : trois pièces principales — un séjour et deux chambres. La cuisine et la salle de bain ne sont pas comptées. |
| `ui.help.indicativeScale` | Barème indicatif | Des conditions moyennes (taux, durée) utilisées pour l'estimation tant qu'aucune banque n'a étudié votre dossier. |

## 6. Pièces : textes d'aide

Les aides de la liste de départ (PAR-050), montrées au client sous chaque pièce.

| Code | Aide |
|---|---|
| `ID_PASSPORT` | La double page avec votre photo, bien lisible, sans reflet. |
| `ID_RESIDENCE_PERMIT` | Le recto et le verso de votre titre de séjour, ou de votre carte d'identité si vous avez la nationalité de votre pays de résidence. |
| `ID_CONSULAR_CARD` | Le recto et le verso. Facultative : elle peut faciliter certaines démarches. |
| `CIVIL_BIRTH_CERT` | Un extrait d'acte de naissance de moins d'un an. |
| `CIVIL_FAMILY_RECORD` | Les pages qui vous concernent. |
| `RES_PROOF_ADDRESS` | Une facture d'énergie, d'eau ou d'internet, ou une quittance de loyer, à votre nom, de moins de trois mois. |
| `EMP_CONTRACT` | Votre contrat de travail, ou une attestation de votre employeur de moins de trois mois qui indique votre poste et votre date d'entrée. |
| `INC_PAYSLIPS` | Vos trois derniers bulletins de salaire, complets. |
| `INC_TAX_NOTICE` | Toutes les pages de votre dernier avis d'imposition. |
| `INC_BUSINESS_ACCOUNTS` | Vos deux derniers bilans, ou vos deux dernières déclarations de revenus professionnels. |
| `INC_PENSION` | Votre dernier relevé ou votre attestation de pension. |
| `BNK_STATEMENTS` | Les relevés complets, toutes les pages, de tous vos comptes courants, sur les trois derniers mois. |
| `BNK_DOWN_PAYMENT_PROOF` | Un relevé d'épargne ou une attestation de votre banque montrant que la somme de votre apport est disponible. |
| `PRP_RESERVATION_CONTRACT` | Le contrat de réservation signé avec le promoteur. Votre conseiller le dépose pour vous. |

## 7. Mentions

| Clé | Texte | Source |
|---|---|---|
| Note des mensualités | `legal.monthlyFootnote` | Paramètre (TRV-023) |
| Mention des simulateurs | `legal.simulatorDisclaimer` | Paramètre (TRV-024) |
| Prix convertis | `legal.convertedPricesNote` | Paramètre (TRV-022) |
| Frais d'acquisition | `legal.feesExcludedNote` | Paramètre (CAL-106) |
| Image d'illustration | `legal.illustrationNote` | Paramètre (FIC-012) — seule source de cette mention : aucune clé de traduction ne la double |
| Image 3D | `legal.render3dNote` | Paramètre (FIC-012), idem |
| `notice.offer` | Conditions communiquées par la banque. Seule l'offre écrite de la banque fait foi. | DOS-054 |
| `notice.plans` | Plans fournis par le promoteur. Surfaces indicatives : les surfaces contractuelles figurent dans l'acte. | FIC-016 |
| `notice.address` | Adresse exacte communiquée après qualification. | FIC-060 |
| `notice.cafeVenue` | Gratuit, sur inscription. Le lieu exact vous est communiqué à l'inscription. | ACC-061 |
| `notice.ai` | Réponse générée automatiquement. | IA-002, ASS-051 (assistant conversationnel, Phase 1 depuis D-090) |
| `notice.emailReason.account` | Vous recevez cet e-mail à la suite d'une démarche liée à cette adresse sur {societe}. | Pied des e-mails (NOT-004) : modèle `CLIENT` de catégorie `ACCOUNT` ; `{societe}` = `contact.companyName` |
| `notice.emailReason.client` | Vous recevez cet e-mail dans le cadre de vos échanges avec {societe}. | Idem : tout autre modèle `CLIENT` |
| `notice.emailReason.staff` | Vous recevez cet e-mail parce que vous faites partie de l'équipe {societe}. | Idem : modèle `STAFF` |
| `notice.emailReason.partner` | Vous recevez cet e-mail en tant que partenaire de {societe}. | Idem : modèle `PARTNER`, partenaire accepté |
| `notice.emailReason.partnerApplicant` | Vous recevez cet e-mail au sujet de votre candidature de partenaire. | Modèles `P_PARTNER_*` d'une candidature (ACP-082 à ACP-084) |
