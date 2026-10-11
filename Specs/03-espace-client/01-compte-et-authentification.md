# Espace client — compte et authentification

Écrans **EC-01** à **EC-09**. Ces pages appartiennent à l'application `web`, ne sont pas indexées, et suivent les règles de sécurité de `06-technique/03` (jetons, sessions, hachage, limites de débit).

Deux principes guident tout le fichier :
- **ne jamais révéler** si une adresse e-mail possède un compte (TRV-112) ;
- **ne jamais donner accès** à des données existantes sans preuve que la personne possède l'adresse e-mail.

---

## 1. Écrans

| Écran | Adresse | Rôle |
|---|---|---|
| EC-01 | `/connexion` | Se connecter |
| EC-02 | `/inscription` | Créer son espace |
| EC-03 | `/verification` et `/verification/{jeton}` ; `/nouvelle-adresse/{jeton}` | Confirmer son adresse e-mail : à l'inscription, ou une nouvelle adresse (AUTH-080) |
| EC-04 | `/mot-de-passe-oublie` | Demander un nouveau mot de passe |
| EC-05 | `/reinitialisation/{jeton}` | Choisir un nouveau mot de passe |
| EC-06 | `/activation/{jeton}` | Activer un espace préparé par l'équipe ou par une demande |
| EC-07 | `/connexion/lien` et `/connexion/lien/{jeton}` | Se connecter par un lien reçu par e-mail |
| EC-08 | (étape de la connexion) | Saisir le code de double authentification |
| EC-09 | (étape après la connexion) | Accepter une nouvelle version des conditions |

## 2. Inscription (EC-02)

**AUTH-001** `[P1]` **Champs** (D-032) :

| Champ | Oblig. | Règles |
|---|---|---|
| Prénom, Nom | oui | TRV-042 |
| E-mail | oui | TRV-043. C'est l'identifiant du compte. |
| Téléphone | oui | TRV-040 |
| Mot de passe | oui | AUTH-002. Un seul champ, avec le bouton « Afficher ». |
| « J'accepte les conditions générales et la politique de confidentialité. » | oui | Case non cochée ; liens vers les deux textes. Écrit deux lignes `Consent` (`TERMS_OF_USE`, `PRIVACY_POLICY`) avec la version en vigueur. |
| « Je souhaite recevoir les actualités et les nouveaux programmes par e-mail. » | — | Case non cochée (`MARKETING_EMAIL`). |

Bouton « Créer mon espace ». Sous le formulaire : « Déjà un espace ? Se connecter ».

**Requête** `POST /auth/signup` : les champs ci-dessus et, sans saisie, `timezone` (fuseau IANA détecté par le navigateur : `User.timezone`, `Client.timezone`), `locale` (langue de l'écran), `next` (page de retour, chemin interne, AUTH-023 ; gardé dans le jeton de vérification), `simulationId` (facultatif : la simulation à enregistrer, SIM-032 ; gardée dans le même jeton) et `utm` (origine de la visite notée par NAV-053). L'identifiant anonyme est lu dans le cookie `dp_anon` (AUTH-004), jamais dans le corps.

**AUTH-002** `[P1]` **Mot de passe.** Au moins `security.password.minLength` caractères (10), 128 au plus. Aucune règle de composition imposée (ni majuscule, ni chiffre obligatoires). Refusés : un mot de passe figurant dans la liste des mots de passe les plus courants ; un mot de passe qui contient l'adresse e-mail, le prénom ou le nom. Un indicateur de robustesse accompagne la saisie. Le collage est permis. Messages : « 10 caractères au minimum. » · « Ce mot de passe est trop courant. Choisissez-en un autre. » · « Évitez d'utiliser votre nom ou votre adresse e-mail. ».

**AUTH-003** `[P1]` **Après l'envoi**, l'écran est **toujours le même** : « Vérifiez votre boîte e-mail. Nous venons d'écrire à {adresse}. », puis « Pas d'e-mail dans les minutes qui viennent ? Regardez vos indésirables{, ou écrivez-nous à {contact.email}}. » et le bouton « Renvoyer l'e-mail ». Ce bouton rejoue l'inscription (`POST /auth/signup`, avec les champs que la page a gardés en mémoire et une **nouvelle** clé d'idempotence, API-040 — avec l'ancienne, la réponse gardée reviendrait sans que rien ne reparte) : la ligne du tableau qui s'applique alors fait repartir le bon e-mail, sans rien créer de plus, avec les limites de AUTH-012 (une fois par minute, trois fois par heure, cinq fois par jour) ; l'écran ne change pas (TRV-112). Ce qui se passe réellement dépend de l'adresse :

| Situation de l'adresse | Effet |
|---|---|
| Inconnue | Une fiche `Client` et un compte sont créés ; la fiche porte `source` = `SIGNUP` et l'`utm` reçue ; le mot de passe est enregistré ; l'e-mail `C_EMAIL_VERIFICATION` part. Le navigateur de l'inscription reçoit un témoin d'inscription (AUTH-013). |
| Une fiche client existe **sans compte** (créée par une demande, une inscription à un Café, ou l'équipe) | Un compte est créé à l'état `INVITED`, **sans** le mot de passe saisi ; l'e-mail `C_ACCOUNT_ACTIVATION` part, dans sa version « inscription » (`action.fromSignup`), qui explique pourquoi le mot de passe se choisit depuis l'e-mail ; le jeton garde cette origine (`fromSignup`, dans son `payload`). La personne choisira son mot de passe après avoir prouvé qu'elle possède l'adresse (AUTH-040). Le prénom, le nom et le téléphone saisis ne touchent pas la fiche ; les cases cochées ne sont pas enregistrées : elles sont redemandées à l'activation. |
| L'adresse est l'adresse secondaire d'une fiche (`alternateEmails`, après une fusion) | Comme si la personne avait saisi l'adresse principale de cette fiche : s'applique la ligne de ce tableau qui correspond à l'état de la fiche et de son compte ; l'e-mail part à l'adresse saisie. |
| Un compte `INVITED` existe | Un nouveau lien d'activation part, dans la même version « inscription » de `C_ACCOUNT_ACTIVATION`. |
| Un compte client existe, adresse **non vérifiée** | Un nouveau lien de vérification part. Le mot de passe saisi est ignoré : le compte garde le sien. |
| Un compte client actif et vérifié existe | L'e-mail `C_ACCOUNT_EXISTS` part : « Vous avez déjà un espace », avec les liens pour se connecter et pour réinitialiser le mot de passe. |
| Un compte client **suspendu** existe | Rien n'est créé ; aucun e-mail. |
| Un compte du personnel ou d'un partenaire existe | Rien n'est créé ; aucun e-mail (ROL-003). |

Raison de la deuxième ligne : sinon, quelqu'un pourrait s'inscrire avec l'adresse d'une autre personne et, après un clic distrait de celle-ci, accéder à ses demandes. La première ligne a la même parade, côté vérification (AUTH-013).

Le témoin `dp_signup` est déposé **dans tous les cas**, avec une valeur qui ne correspond à rien quand aucune inscription n'a été créée : sa présence n'apprend rien sur l'adresse saisie (TRV-112). Un témoin déjà valable pour ce même compte non vérifié (rejeu de « Renvoyer l'e-mail ») est gardé tel quel.

**AUTH-004** `[P1]` À la création d'un compte, tout ce qui tient à la **fiche** de cette adresse lui est rattaché : demandes passées, inscriptions aux Cafés, alertes. Les simulations anonymes du même navigateur le sont aussi (SIM-034, MOD-371) ; une simulation simplement envoyée par e-mail à cette adresse ne l'est pas. Ces éléments ne deviennent **visibles** qu'une fois l'adresse vérifiée.

**AUTH-005** `[P1]` Limites : 5 inscriptions par heure et par adresse IP ; un défi non intrusif en cas de soupçon (DEM-030). Les e-mails qu'une inscription déclenche vers une adresse déjà connue (AUTH-003) suivent en plus la limite par adresse de SEC-070 ; au-delà, l'écran reste « Vérifiez votre boîte e-mail » et rien ne part (TRV-112).

## 3. Vérification de l'adresse (EC-03)

**AUTH-012** `[P1]` Tant que l'adresse n'est pas vérifiée, le compte **n'entre pas** dans l'espace client (ROL-033). Une connexion réussie avec une adresse non vérifiée mène à l'écran d'attente :

> « Confirmez votre adresse e-mail » — « Nous avons écrit à {adresse}. Cliquez sur le lien de l'e-mail pour ouvrir votre espace. »
> **Renvoyer l'e-mail** · **Modifier mon adresse**

« Renvoyer » : une fois par minute, trois fois par heure, cinq fois par jour (SEC-070). « Modifier mon adresse » : possible seulement pour un compte qui n'a encore rien d'autre (ni demande, ni dossier) ; elle demande le mot de passe. L'écran répond toujours « Nous avons écrit à {nouvelle adresse}. ». Si cette adresse est déjà celle d'un compte ou d'une fiche, rien ne change sur le compte non vérifié, et c'est l'e-mail envoyé à la nouvelle adresse qui dit quoi faire, comme à l'inscription (AUTH-003) : ni indice sur l'existence d'un compte, ni rattachement à la fiche d'un autre.

**AUTH-013** `[P1]` **Lien de vérification** (24 heures, un seul usage). Il prouve que la personne lit cette boîte ; il ne prouve pas qu'elle a choisi le mot de passe du compte. Donc :
- ouvert **dans le navigateur de l'inscription** (témoin `dp_signup`, `HttpOnly`, 24 heures, déposé à l'inscription) : l'adresse est vérifiée et la personne est connectée ;
- ouvert **ailleurs** (un autre appareil, un autre navigateur) : l'écran demande le mot de passe du compte, puis vérifie et connecte. Dessous : « Vous n'avez pas créé cet espace ? » · « Ce n'est pas moi » — qui supprime le compte non vérifié et ce qu'il avait créé, sans rien demander d'autre. Troisième sortie, pour qui s'est inscrit deux fois ou ne retrouve plus son mot de passe : « Choisir un nouveau mot de passe », qui envoie le lien de réinitialisation — il vérifie l'adresse du même coup (AUTH-045). Un mot de passe faux sur cet écran compte comme un échec de connexion (AUTH-032).

Ainsi, quelqu'un qui s'inscrit avec l'adresse d'une autre personne n'obtient jamais un compte vérifié dont il connaît le mot de passe. La première vérification envoie `C_WELCOME` et mène à la page demandée à l'origine, ou au tableau de bord. Lien expiré ou déjà utilisé : « Ce lien a expiré ou a déjà été utilisé. » et le bouton « Recevoir un nouveau lien » (qui demande l'adresse). Si l'adresse est déjà vérifiée, le lien mène simplement à la connexion.

**« Ce n'est pas moi »** appelle `POST /auth/verify-email/disown`, avec le jeton du lien. Dans une transaction : le jeton est consommé ; le compte, encore non vérifié, passe `DELETED` (MOD-100) et ses autres jetons meurent ; la fiche `Client` née de cette inscription (première ligne de AUTH-003) part à la corbeille avec ses lignes `Consent` (TRV-096), sauf si quelque chose s'y est rattaché depuis — une demande, une inscription à un Café : elle reste alors, sans compte ; les simulations rattachées à l'inscription (AUTH-004) redeviennent anonymes (`clientId` vidé) et suivent la purge des simulations anonymes (AUT-091). Aucun e-mail ne part ; le journal note `auth.signup_disowned`. Écran : « C'est noté : cet espace n'a pas été créé. ». Le lien ne sert plus : un second clic mène à « Ce lien a expiré ou a déjà été utilisé. » (`410 GONE`). Rien d'autre n'est à défaire : un compte jamais vérifié n'a rien montré (AUTH-004).

## 4. Connexion (EC-01)

**AUTH-020** `[P1]` Champs : E-mail · Mot de passe (bouton « Afficher ») · case « Se souvenir de moi » (non cochée). Liens : « Mot de passe oublié ? » · « Recevoir un lien de connexion » · « Créer mon espace ». Sous le formulaire, une ligne de contact, chaque élément seulement si son paramètre est renseigné : « Une difficulté pour vous connecter ? {contact.phone} · {contact.email} » (EDI-050). Requête `POST /auth/login` : `email`, `password`, `rememberMe` et `simulationId` (facultatif, SIM-032) — cette simulation est rattachée à la fiche si elle est encore anonyme et porte le `dp_anon` de ce navigateur (MOD-371) ; sinon il est ignoré.

**AUTH-021** `[P1]` **Échec** : un seul message, quel que soit le motif (adresse inconnue, mauvais mot de passe, compte sans mot de passe, compte supprimé) : « E-mail ou mot de passe incorrect. ». Sous le message, dans tous les cas : « Première connexion, ou mot de passe oublié ? Recevez un lien de connexion par e-mail. » → `/connexion/lien` (AUTH-041) ; ce texte ne dépend pas du motif et ne révèle donc rien (TRV-112). Le temps de réponse est le même dans tous les cas. Réponse de l'API : `401 INVALID_CREDENTIALS`.

**AUTH-022** `[P1]` **Après des identifiants corrects**, dans cet ordre :

| Contrôle | Si oui | Réponse de l'API |
|---|---|---|
| Compte `SUSPENDED` | Selon `suspendedReason` : « Ce compte est suspendu. Contactez-nous. » (`STAFF_DECISION`) · « Votre demande de suppression est en cours de traitement. » (`DELETION_PENDING`) | `403 ACCOUNT_SUSPENDED`, avec la raison |
| Compte du personnel ou d'un partenaire | « Ce compte est un compte professionnel. Connectez-vous depuis votre espace dédié. » (ROL-004) | `403 FORBIDDEN`, raison `WRONG_AUDIENCE` |
| Double authentification activée | Écran EC-08 (AUTH-050). | étape `TWO_FACTOR` |
| Compte du personnel (audience `ADMIN`) dont la première connexion n'est pas finie : double authentification exigée (`security.staff.twoFactorRequired`) mais non configurée — invité à mi-parcours, ou double authentification réinitialisée (ADM-032) —, ou charte non acceptée (`User.charterAcceptedAt` nul) | Écran de première connexion, à l'étape manquante (BO-003). | étape `STAFF_SETUP` |
| Adresse non vérifiée | Écran EC-03 (AUTH-012). | étape `EMAIL_VERIFICATION` |
| Conditions jamais acceptées, ou nouvelle version | Écran EC-09 (AUTH-090). | étape `TERMS` |
| Sinon | La session s'ouvre ; retour à la page demandée (AUTH-023). | `200`, session ouverte |

Les lignes « Adresse non vérifiée » et « Conditions » ne valent que pour les comptes `CLIENT` : l'adresse d'un membre du personnel est prouvée par son lien d'invitation (BO-003), et il accepte la charte, pas les conditions générales. Le tableau se lit dans l'audience de la requête (API-003). La ligne « Compte du personnel ou d'un partenaire » ne vaut que pour l'audience `WEB`, la ligne `STAFF_SETUP` que pour l'audience `ADMIN`. Sur l'audience `ADMIN`, un compte qui n'est pas `STAFF` reçoit d'abord `401 INVALID_CREDENTIALS` (BO-001).

**AUTH-026** `[P1]` **Étapes intermédiaires.** Quand une étape reste à franchir, la connexion répond `200` **sans ouvrir de session**, avec `nextStep` (l'une des valeurs ci-dessus ; pour le personnel s'ajoute `STAFF_SETUP`, BO-003) et un **jeton d'étape** : un cookie `HttpOnly` de 10 minutes, lié au compte et à l'étape. Ce jeton ne donne accès à **aucune** donnée ; il n'autorise que les routes de son étape :

| Étape | Routes permises |
|---|---|
| `TWO_FACTOR` | saisir le code, ou un code de secours |
| `EMAIL_VERIFICATION` | renvoyer l'e-mail · modifier l'adresse d'un compte encore vide (AUTH-012) |
| `TERMS` | lire les textes · accepter · refuser et se déconnecter |
| `STAFF_SETUP` | choisir le mot de passe · configurer la double authentification · accepter la charte |

Chaque étape franchie rend la suivante, ou ouvre la session. Jeton expiré : retour à la connexion, avec « Votre connexion a expiré. Recommencez. ».

Pour `STAFF_SETUP`, les étapes restantes — `PASSWORD`, `TWO_FACTOR`, `CHARTER` — se déduisent de l'état du compte à chaque appel (mot de passe nul ; double authentification exigée et non configurée ; charte non acceptée) et sont rendues dans `remainingSteps`. Avec un jeton d'étape obtenu par le lien d'invitation, `remainingSteps` commence toujours par `PASSWORD` (BO-003). La route d'une étape déjà franchie répond `403 FORBIDDEN` : `…/password` n'est permise que si `User.passwordHash` est nul, ou si le jeton d'étape vient du lien d'invitation (BO-003). Un jeton d'étape obtenu avec le mot de passe ne permet donc jamais de changer ce mot de passe.

**AUTH-023** `[P1]` **Page de retour.** Une page de l'espace client ouverte sans session mène à la connexion, puis ramène à cette page (`?next=`). Seul un chemin **interne** est accepté ; toute autre valeur est ignorée et mène au tableau de bord.

**AUTH-024** `[P1]` **Durée.** Sans « Se souvenir de moi » : la session se ferme à la fermeture du navigateur, et après 12 heures sans activité. Avec : 30 jours, prolongés à chaque visite, 90 jours au plus. Mécanisme : SEC-020 à SEC-026.

**AUTH-025** `[P1]` Un client **déjà connecté** qui ouvre `/connexion` ou `/inscription` est mené à son tableau de bord.

### Sécurité de la connexion

**AUTH-032** `[P1]` **Verrou.** Après `security.login.maxAttempts` échecs consécutifs (5) sur une même adresse, la connexion par mot de passe est verrouillée pendant `security.login.lockMinutes` minutes (15) : « Trop de tentatives. Réessayez dans {n} minutes ou réinitialisez votre mot de passe. » (`ACCOUNT_LOCKED`). Le compteur vaut aussi pour une adresse inconnue : le comportement est identique. Une connexion réussie, une réinitialisation du mot de passe ou une connexion par lien remettent le compteur à zéro. Par adresse IP : 20 tentatives par 10 minutes au plus. Le verrou ne vaut pas pour une tentative faite depuis un **appareil déjà reconnu** de ce compte (AUTH-033) : son titulaire, sur son appareil habituel, entre toujours avec le bon mot de passe, même si quelqu'un d'autre multiplie les échecs pour le bloquer. Cette exception a sa propre borne : dix échecs consécutifs depuis un même appareil reconnu lui retirent sa reconnaissance — il redevient un appareil ordinaire, soumis au verrou (un ordinateur partagé ou volé ne donne pas des essais sans fin). Ce compteur par appareil vit dans le cache — il n'a pas à survivre à un redémarrage —, comme celui d'une adresse inconnue, qui n'a pas de compte où le ranger ; celui d'un compte est `User.failedLoginCount` ; retirer la reconnaissance, c'est vider `deviceKey` sur les sessions passées de ce compte qui la portent : la prochaine connexion réussie depuis cet appareil sera celle d'un nouvel appareil (AUTH-033).

**AUTH-033** `[P1]` **Nouvel appareil.** À chaque connexion réussie, le navigateur garde un identifiant d'appareil aléatoire (cookie `dp_device`, NAV-051), dont l'empreinte est notée sur la session (`Session.deviceKey`). Un appareil est **reconnu** si une session passée de ce compte porte la même empreinte. Une connexion depuis un appareil non reconnu, alors que le compte s'est déjà connecté auparavant, envoie `C_NEW_DEVICE_LOGIN`. Effacer ses cookies fait de l'appareil un nouvel appareil : l'e-mail part, c'est voulu. Le cookie existe pour chaque application — site et espace client, back-office (BO-007) —, posé par l'API, `HttpOnly`, 13 mois (noms : SEC-022) ; `dp_device` les désigne tous deux dans ce dossier, et l'exception de AUTH-032 vaut de même pour le personnel.

## 5. Connexion par lien (EC-07)

**AUTH-040** `[P1]` **Activation d'un espace préparé** (EC-06). Lien de 7 jours, un seul usage. L'écran : « Bienvenue {prénom}. Choisissez votre mot de passe pour activer votre espace. » — ouvert depuis le lien d'une inscription (AUTH-003, `fromSignup`), il ajoute sous le titre : « Vos coordonnées nous sont déjà connues ; seuls le mot de passe et les cases sont à confirmer ici. » · Mot de passe (AUTH-002) · la case d'acceptation des conditions et la case facultative des actualités (AUTH-001) · « Activer mon espace ». Effets : compte `ACTIVE`, adresse vérifiée, consentements enregistrés, session ouverte, `C_WELCOME`, puis la page visée par le lien (les pièces du dossier, s'il vient de `C_DOC_REQUEST`). Lien expiré ou introuvable : l'écran « Ce lien n'est plus valable. », décrit plus bas — un nouveau lien se redemande toujours (CYC-201). Lien déjà utilisé : l'espace est donc actif, et le lien mène à la connexion, comme dit ci-dessous.

Un client reçoit souvent **plusieurs** e-mails avant d'activer son espace ; chacun porte un lien d'activation, et tous restent bons jusqu'au premier utilisé (MOD-105). Une fois l'espace actif, ouvrir l'un de ces liens — le bouton d'un ancien e-mail — mène à la connexion, puis à la page que ce lien visait.

Un lien d'activation qui ne peut plus servir n'enferme personne. La page visée est écrite dans l'adresse du lien (un chemin interne de l'espace, vérifié), pas seulement dans le jeton, que la purge finit par emporter (AUT-091). L'état du compte passe d'abord : pour un espace déjà actif, un lien retrouvé — expiré ou non — mène à la connexion, puis à la page visée (MOD-105). Sinon, jeton introuvable ou expiré : l'écran dit « Ce lien n'est plus valable. », avec « Me connecter » — qui mène, après connexion, à la page visée — et « Recevoir un nouveau lien », qui demande l'adresse et répond toujours la même phrase : un compte `INVITED` reçoit un lien d'activation, un compte actif un lien de connexion (AUTH-041). **Routes** (D-097) : la page lit d'abord l'état du lien sans le consommer (`POST /auth/activate/check`, la page visée dans le paramètre `suite`) ; « Recevoir un nouveau lien » appelle `POST /auth/activate/resend`.

**AUTH-041** `[P1]` **Lien de connexion.** Sur `/connexion/lien` : un champ e-mail, puis, dans tous les cas : « Si un espace existe pour cette adresse, un lien de connexion vient d'être envoyé. Il est valable 15 minutes. ». Ouvrir le lien : connecte la personne (après le code de double authentification si elle est activée) et vérifie l'adresse. Le lien fonctionne depuis un autre appareil que celui de la demande. Pour un compte dont l'adresse n'est **pas encore vérifiée** (inscription non confirmée), aucun lien de connexion ne part : c'est le lien de vérification qui est renvoyé, avec ses précautions (AUTH-013) — sinon, quelqu'un qui s'est inscrit avec l'adresse d'un autre obtiendrait, par un clic distrait de celui-ci, un compte vérifié dont il connaît le mot de passe. Pour un compte `INVITED`, il vaut activation : le compte devient actif, sans mot de passe ; la première page est alors celle des conditions (EC-09, avec le texte de première acceptation : « Avant de continuer, merci d'accepter nos conditions. ») ; la personne pourra choisir un mot de passe dans son profil. Trois demandes par heure et par adresse. Seule la porte des clients offre le lien de connexion : ni le personnel (BO-002) ni les partenaires (ACP-085) n'en ont (D-097).

## 6. Mot de passe oublié (EC-04, EC-05)

**AUTH-045** `[P1]` Un champ e-mail, puis, dans tous les cas : « Si un espace existe pour cette adresse, un e-mail vient d'être envoyé. ». Lien d'une heure, un seul usage. L'écran de réinitialisation demande le nouveau mot de passe (AUTH-002). Effets : mot de passe changé ; **toutes** les sessions du compte sont fermées ; `C_PASSWORD_CHANGED` part ; la personne est connectée (après le code de double authentification si elle est activée). Le lien prouve la possession de l'adresse : pour un compte dont l'adresse n'était pas vérifiée, il la **vérifie** du même coup. Pour un compte `INVITED`, la demande envoie le lien d'activation. Pour un compte suspendu : aucun e-mail. **Chaque porte ne sert que ses comptes** (ROL-004, D-097) : une demande faite depuis le back-office pour un compte qui n'est pas du personnel, ou l'inverse, reçoit la même réponse et n'envoie rien ; le lien d'un partenaire mène toujours à sa porte (`/partenaires/reinitialisation`). La page du lien vérifie d'abord le jeton sans le consommer (`POST /auth/password/reset/check`) : un lien mort affiche tout de suite « Ce lien a expiré ou a déjà été utilisé. », avant toute saisie.

## 7. Double authentification (EC-08)

**AUTH-050** `[P1]` Facultative pour un client (D-033). Elle s'active dans le profil (PRO-020), avec une application de codes. À la connexion, après le mot de passe : « Saisissez le code à 6 chiffres de votre application. » · lien « Utiliser un code de secours ». Chaque code faux — de l'application ou de secours — répond `401 INVALID_CODE`, avec le nombre d'essais restants. Les codes faux sont comptés sur le jeton d'étape (`AuthToken.attempts`, usage `LOGIN_CHALLENGE`) ; au cinquième, le jeton d'étape est détruit et le compte est **verrouillé** aussitôt `security.login.lockMinutes` minutes (`User.lockedUntil`), comme après cinq mots de passe faux (AUTH-032) : la réponse est `423 ACCOUNT_LOCKED`. Un code de secours ne sert qu'une fois.

**AUTH-051** `[P1]` **Appareil perdu, plus de code de secours** : le client contacte l'équipe. Après vérification de son identité (rappel au numéro connu, question sur son dossier), un administrateur désactive la double authentification du compte (CRM-070) ; le client reçoit `C_TWO_FACTOR_CHANGED`.

## 8. Changements du compte

**AUTH-080** `[P1]` **Changer d'adresse e-mail** (depuis le profil). Le client saisit la nouvelle adresse et confirme que c'est bien lui (mot de passe, ou code reçu par e-mail : AUTH-086). La nouvelle adresse est mise **en attente** (`pendingEmail`) ; `C_EMAIL_CHANGE_CONFIRM` part vers la nouvelle, `C_EMAIL_CHANGE_NOTICE` vers l'ancienne. Rien ne change tant que le lien de la nouvelle adresse n'est pas ouvert (24 heures). À la confirmation : l'adresse du compte et celle de la fiche client changent ensemble ; les autres sessions sont fermées ; l'ancienne adresse n'est **pas** gardée comme adresse secondaire (le journal d'audit note le changement sans les valeurs, SEC-081 ; l'ancienne adresse reste lisible dans le journal des envois, comme destinataire de l'avis de changement) : elle peut avoir été saisie par erreur, ou appartenir à quelqu'un d'autre. Si la nouvelle adresse est portée par une **autre fiche sans compte** (la même personne a écrit un jour avec cette adresse) : le lien de confirmation part normalement ; à son ouverture — la preuve que l'adresse est la sienne —, le changement attend la fusion des deux fiches : l'écran dit « Cette adresse nous est déjà connue : nous regroupons vos informations et vous prévenons. », et les administrateurs reçoivent la tâche « Fusionner les fiches de {client} : il a confirmé l'adresse d'une autre fiche » (`HIGH`). La fusion garde la fiche qui a le compte (CRM-080) ; l'administrateur y applique ensuite la nouvelle adresse (CRM-070). Si la nouvelle adresse appartient déjà à un **autre compte** au moment de la demande : l'écran du profil répond comme d'habitude (« Un e-mail de confirmation vient d'être envoyé à {adresse}. »), rien n'est changé, et c'est l'e-mail envoyé à cette adresse qui le dit (`C_ACCOUNT_EXISTS`), avec « Contactez-nous pour regrouper vos informations. ». Prise entre-temps : c'est l'ouverture du lien qui le dit (`409`, tableau ci-dessous), sans autre e-mail.

**Ouvrir le lien de confirmation** (`C_EMAIL_CHANGE_CONFIRM`, y compris pour un changement lancé par l'équipe, CRM-048) mène à la page `/nouvelle-adresse/{jeton}` (EC-03), qui appelle `POST /auth/email-change/confirm` (jeton `EMAIL_CHANGE`, un seul usage). Issues :

| Situation | Réponse | Écran |
|---|---|---|
| Adresse libre | `200` ; le changement est fait (ci-dessus) ; journal : `auth.email_changed` | « Votre nouvelle adresse est confirmée. » |
| Adresse portée par une autre fiche sans compte | `200` ; le changement attend la fusion (ci-dessus) | « Cette adresse nous est déjà connue : nous regroupons vos informations et vous prévenons. » |
| Adresse prise entre-temps par un autre compte | `409 CONFLICT_STATE`, raison `EMAIL_IN_USE` ; rien n'est changé, `pendingEmail` est vidé | La phrase de la raison, et « Contactez-nous pour regrouper vos informations. » |
| Jeton expiré, inconnu ou déjà utilisé | `410 GONE` | « Ce lien a expiré ou a déjà été utilisé. » et « Me connecter » ; le changement se redemande depuis le profil. |

La page ne connecte personne : avec une session de ce compte, elle mène au profil (`/espace-client/profil`), et cette session reste ouverte ; sans session, elle propose « Me connecter ». Quand le changement est fait, toutes les autres sessions du compte sont fermées.

**AUTH-081** `[P1]` **Changer de mot de passe** (depuis le profil) : mot de passe actuel, puis le nouveau. Les **autres** sessions sont fermées ; `C_PASSWORD_CHANGED` part. Un compte sans mot de passe (créé par lien) en choisit un sans saisir l'ancien, après la confirmation de AUTH-086.

**AUTH-086** `[P1]` **Confirmer une action sensible.** Changer d'adresse, activer ou désactiver la double authentification ou en régénérer les codes de secours (PRO-020), télécharger ses données, supprimer son compte demandent de prouver de nouveau qui l'on est :
- le compte a un mot de passe : le mot de passe ;
- le compte n'en a pas (activé par un lien de connexion) : un **code à 6 chiffres** envoyé à son adresse (`C_ACTION_CODE`, valable 10 minutes, cinq essais), saisi sur le même écran. Un code faux répond `401 INVALID_CODE` ; un code mort — expiré, ou après cinq essais faux (`AuthToken.attempts`) — répond `410 GONE`, et l'écran affiche « Ce code n'est plus valable. » avec « Recevoir un nouveau code ». L'écran propose aussi « Choisir un mot de passe ».

Aucune de ces actions n'est donc hors d'atteinte d'un client qui n'a jamais choisi de mot de passe. Un compte qui a un mot de passe ne reçoit jamais de code : `POST /auth/action-code` lui répond `409 CONFLICT_STATE`, raison `HAS_PASSWORD` (D-097).

**Mécanisme.** La preuve voyage **dans la requête de l'action** elle-même — `PATCH /client/me/email`, `POST /client/me/two-factor/setup`, `DELETE /client/me/two-factor`, `POST /client/me/two-factor/recovery-codes`, `POST /client/me/export`, `POST /client/me/delete`, et `PATCH /client/me/password` pour un compte sans mot de passe (AUTH-081) : champ `password` si le compte en a un, champ `actionCode` sinon. Aucune fenêtre de confiance n'est ouverte : deux actions demandent deux preuves. Le code se demande par `POST /auth/action-code`, avec l'action visée (`action` : `EMAIL_CHANGE` · `TWO_FACTOR` · `DATA_EXPORT` · `ACCOUNT_DELETION` · `PASSWORD_SET`), gardée dans le jeton (`AuthToken.payload`) : il ne vaut que pour cette action et se vérifie avec elle — il n'existe pas de route de vérification séparée. Preuve absente : `422 VALIDATION_ERROR`, `field` = `password` ou `actionCode`, `code` = `REQUIRED`. Mot de passe faux : `401 INVALID_CREDENTIALS`, compté comme un échec de connexion (AUTH-032). Code faux ou mort : ci-dessus.

**AUTH-082** `[P1]` Le téléphone se change dans le profil, sans vérification (aucun SMS n'est envoyé par la plateforme).

**AUTH-085** `[P1]` **Se déconnecter** ferme la session de l'appareil. Le profil donne la liste des sessions ouvertes et « Me déconnecter de tous les autres appareils », qui garde la session en cours (PRO-021).

## 9. Nouvelles conditions (EC-09)

**AUTH-090** `[P1]` Quand une nouvelle version des conditions générales ou de la politique de confidentialité est en vigueur (MOD-420) et que le client ne l'a pas acceptée — ou qu'il n'a encore **jamais** accepté les conditions (compte activé par un lien de connexion, AUTH-041) —, la première page après la connexion est :

> « Nos conditions ont évolué » (première acceptation : « Avant de continuer, merci d'accepter nos conditions. ») — « Version du {date}. » — ce qui change (`changeSummary`), s'il est renseigné — liens vers les textes — case « J'ai lu et j'accepte. » — **Continuer** · **Refuser et me déconnecter**

Tant que la case n'est pas validée, aucune page de l'espace n'est accessible. L'acceptation écrit les lignes `Consent` correspondantes. Refuser (`POST /auth/legal/decline`) déconnecte, sans rien supprimer, et affiche :

> « Vous êtes déconnecté » — « Votre espace et vos informations sont bien conservés : vous pourrez accepter nos conditions à votre prochaine connexion. Une question sur ces textes, ou vous souhaitez supprimer votre espace ? Contactez-nous, nous vous répondons. » — la ligne de contact (AUTH-098) — **Retour à l'accueil**

« Contactez-nous » mène à la page de contact (`/contact`, DEM-015), ouverte sans connexion.

## 10. Divers

**AUTH-095** `[P1]` Tous les champs portent les attributs qui permettent aux gestionnaires de mots de passe de fonctionner (`username`, `current-password`, `new-password`, `one-time-code`).

**AUTH-098** `[P1]` **Toujours un moyen de nous joindre.** Tout écran de ce fichier qui dit « Contactez-nous », « Trop de tentatives », « Ce lien n'est plus valable » ou « Ce lien a expiré » porte la ligne de contact de AUTH-020, chaque élément seulement si son paramètre est renseigné. C'est la ligne que cite PRO-060.

**AUTH-096** `[P1]` Chaque événement de ce fichier (inscription, connexion réussie ou échouée, verrou, réinitialisation, changement d'adresse, activation ou retrait de la double authentification) est écrit dans le journal d'audit, sans le mot de passe ni le jeton (SEC-080).

**AUTH-097** `[V2]` Connexion par un compte Google ou Apple. Mémorisation d'un appareil de confiance pour la double authentification.
