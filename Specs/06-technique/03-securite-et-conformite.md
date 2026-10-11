# Sécurité et conformité

La plateforme détient des pièces d'identité, des bulletins de salaire, des relevés de compte. Sa sécurité n'est pas une option du Lot 6 : chaque règle ci-dessous s'applique dès la première ligne de code. Contrat : offre technique, § 7.

Les points juridiques (durées, mentions, transferts) portent la mention **« à valider par le conseil juridique »** : les valeurs données sont des valeurs par défaut prudentes (Q-010, Q-017, Q-040).

---

## 1. Mots de passe et double authentification

**SEC-010** `[P1]` **Mots de passe.** Hachés avec Argon2id (mémoire 19 Mio, 2 passes, 1 fil au minimum), avec un sel par mot de passe ; jamais chiffrés, jamais journalisés, jamais renvoyés. Règles de choix : AUTH-002. La liste des mots de passe courants refusés est embarquée dans l'application (au moins les 10 000 plus fréquents). Les paramètres de hachage sont revus chaque année ; un mot de passe haché avec d'anciens paramètres est rehaché à la connexion suivante.

**SEC-011** `[P1]` **Double authentification** : codes à usage unique fondés sur le temps (6 chiffres, 30 secondes, tolérance d'un pas avant et après). Le secret est chiffré par l'application (MOD-016). Dix codes de secours, hachés, à usage unique. Un code déjà accepté est refusé s'il est rejoué. Cinq échecs : la tentative de connexion est annulée (AUTH-050). **Enrôlement** : le QR code porte `otpauth://totp/{émetteur}:{email}?secret={clé}&issuer={émetteur}&algorithm=SHA1&digits=6&period=30`, l'émetteur étant `contact.companyName`, encodé pour l'adresse. **Codes de secours** : dix codes de 10 caractères `[a-z0-9]`, affichés par groupes de 5 (`k7m2p-x9q4t`), hachés en SHA-256 comme un jeton (SEC-040) ; « Télécharger » produit le fichier texte `codes-de-secours-diaspora-patrimoine.txt`, un code par ligne.

## 2. Sessions

**SEC-020** `[P1]` **Deux jetons.** Un jeton d'**accès**, signé, valable 15 minutes, qui porte l'identifiant du compte, sa nature, son audience et l'identifiant de session. Un jeton de **renouvellement**, aléatoire (256 bits), dont seule l'empreinte est stockée (`Session.refreshTokenHash`).

**SEC-021** `[P1]` **Rotation.** Chaque renouvellement remet un **nouveau** jeton de renouvellement et invalide le précédent. Présenter un jeton déjà utilisé signale un vol possible : **toute la famille** de sessions (`familyId`) est révoquée (`REUSE_DETECTED`), le compte doit se reconnecter, et l'événement est journalisé.

**Délai de grâce.** Deux onglets du même navigateur renouvellent parfois au même instant avec le même jeton : ce n'est pas un vol. Le jeton qui vient d'être remplacé reste reconnu **10 secondes** (`Session.previousRefreshTokenHash`, `rotatedAt`) : présenté dans ce délai, il obtient un jeton d'accès neuf, **sans** nouveau jeton de renouvellement, sans rotation et sans alerte : le navigateur a déjà reçu celui du premier appel dans ses cookies, communs à ses onglets. Rien n'a donc à être gardé en clair (SEC-020). Passé ce délai, la règle de réutilisation s'applique. Les applications web ne lancent de toute façon qu'un renouvellement à la fois par onglet et se le partagent entre onglets quand le navigateur le permet.

**SEC-022** `[P1]` **Cookies** des applications web : `HttpOnly`, `Secure`, `SameSite=Lax`, préfixe `__Host-`, un nom par application (le cookie du site public n'est pas celui du back-office). Aucun jeton de session — accès, renouvellement — n'est accessible au code de la page, ni rangé dans le stockage du navigateur ; seul le jeton anti-falsification l'est, par construction (SEC-027). **Noms**, posés par l'API pour son propre hôte : `__Host-dp_web_access` et `__Host-dp_admin_access` (accès), `__Host-dp_web_refresh` et `__Host-dp_admin_refresh` (renouvellement), `__Host-dp_web_step` et `__Host-dp_admin_step` (jeton d'étape, AUTH-026), `__Host-dp_web_device` et `__Host-dp_admin_device` (appareil, AUTH-033). Le jeton anti-falsification lisible par la page : cookie `dp_web_csrf` ou `dp_admin_csrf`, posé pour le domaine commun (donc sans préfixe `__Host-`), et renvoyé dans l'en-tête `X-CSRF-Token`. **En local** (`APP_ENV` = `local`, servi en HTTP), les noms perdent leur préfixe `__Host-` et l'attribut `Secure`, que le navigateur n'accepte qu'en HTTPS ; partout ailleurs, ils les portent (D-097). Les partenaires (EP-33) ont leurs propres cookies de session, mais partagent le cookie d'appareil du site (AUTH-033).

**SEC-023** `[P1]` **Durées.**

| Audience | Inactivité | Durée maximale |
|---|---|---|
| Client, sans « Se souvenir de moi » | 12 heures ; cookie de session | 12 heures |
| Client, avec « Se souvenir de moi » | 30 jours, prolongés à chaque usage | 90 jours |
| Personnel | `security.staff.idleMinutes` (60 minutes) | 12 heures |
| Mobile `[MOB]` | 90 jours, prolongés à chaque usage | 1 an |
| Partenaire, espace du site `[P1]` (EP-33) | comme un client, sans « Se souvenir de moi » | 12 heures |
| Partenaire, portail `[P2]` | 60 minutes | 12 heures |

L'**inactivité** se mesure sur les gestes de la personne — clic, saisie, navigation —, que l'application rapporte à chaque renouvellement. Un écran qui se rafraîchit seul (ECL-003), le flux temps réel (API-070) et le renouvellement silencieux du jeton d'accès ne prolongent rien : un onglet oublié finit par se fermer.

**SEC-024** `[P1]` **Révocation immédiate** de toutes les sessions d'un compte quand : son mot de passe change (sauf la session en cours, pour un changement fait depuis le profil) ; son rôle change ; il est suspendu ou supprimé ; un administrateur ferme ses sessions. La vérification d'un jeton d'accès contrôle que sa session n'est pas révoquée.

**SEC-025** `[P1]` Dix sessions ouvertes au plus par compte ; la onzième ferme la plus ancienne. Une session d'aperçu ouverte par l'équipe (ROL-017) n'est pas une session du compte : elle ne compte pas ici. Chaque session garde un libellé d'appareil et la date de son dernier usage (PRO-021).

**SEC-026** `[P1]` **Se déconnecter** révoque la session côté serveur et efface les cookies. Un jeton d'accès encore valable quelques minutes ne suffit pas à agir : sa session est révoquée (SEC-024).

**SEC-027** `[P1]` **Requêtes falsifiées.** `SameSite=Lax` sur les cookies, et, pour toute requête qui modifie quelque chose depuis un navigateur, un jeton anti-falsification envoyé dans un en-tête et comparé à celui de la session. Ce jeton est remis par l'API à l'ouverture de la session et à chaque renouvellement (dans la réponse, et dans un cookie lisible par la page, propre à l'application) ; les formulaires publics, sans session, sont protégés par leur jeton de formulaire (DEM-030). Les routes n'acceptent en écriture que du JSON, et seulement depuis les origines des applications. **Écritures publiques qui lisent la session** (D-097) : une inscription au Café ou une alerte envoyée par un client connecté lit sa session pour la rattacher (CYC-186, CAT-071) sans exiger l'en-tête anti-falsification — les cookies de session sont `SameSite=Lax`, une requête d'un autre site n'en porte donc aucun, et l'écriture est alors traitée comme anonyme. **Audience** (API-003) : l'origine de la requête (`Origin`, à défaut `Referer`) la désigne ; une lecture (`GET`, `HEAD`) sans aucune des deux — une page servie avec `Referrer-Policy: no-referrer` (SEC-040) n'en envoie pas — vaut audience du site ; une écriture sans origine connue est refusée (`400 BAD_REQUEST`).

**SEC-028** `[P1]` **Adresse IP du visiteur.** L'API ne se fie à l'en-tête d'adresse transmise que s'il vient du CDN ou du répartiteur de l'hébergement (liste d'adresses de confiance de l'environnement) ; sinon elle prend l'adresse de la connexion. Toutes les limites par adresse IP (SEC-070) reposent sur cette adresse-là : un visiteur ne peut pas en changer en ajoutant un en-tête. Le flux en direct (API-070) est coupé dans la minute qui suit la révocation de sa session.

## 3. Autorisation

**SEC-030** `[P1]` **Tout est refusé par défaut.** Chaque route déclare : son audience, la nature de compte admise, la permission requise. Une route sans déclaration ne démarre pas. Quatre contrôles, dans l'ordre : session valide · bonne nature et bonne audience (ROL-004) · permission du rôle effectif (ROL-020, MOD-104) · **droit sur l'objet** (SEC-031).

**SEC-031** `[P1]` **Droit sur l'objet.**
- Client : toute requête de l'espace client filtre sur le client de la session ; l'identifiant d'un autre répond `404` (ROL-030).
- Conseiller : selon `access.agentScope` (ROL-014), étendu à tout ce qui se rattache à un dossier ou à un client (ROL-018).
- Partenaire `[P2]` : son organisation (ROL-040).

Le filtre est appliqué **dans la requête à la base**, pas après lecture.

**SEC-032** `[P1]` **Masquage du rôle Support** (ROL-015) : fait par le serveur, dans la forme de réponse propre à ce rôle. Les champs masqués ne sont **jamais envoyés** au navigateur, même cachés. Ce qui est masqué, partout où cela figure (réponses de l'API, listes, fiches, chronologies, journal d'audit, journal des e-mails, recherche) :

| Nature | Champs | Forme |
|---|---|---|
| Identité | Prénoms et noms des clients, des emprunteurs, des proches, des inscrits, des contacts de partenaires ; date de naissance | Initiale et points (`N••••• B•••••`) ; date : absente |
| Coordonnées | E-mails, téléphones, adresses postales, ville de résidence de ces mêmes personnes ; les coordonnées professionnelles des membres du personnel (`User.email`, `phone`, `jobTitle`) restent lisibles | `n•••@•••.fr` · `+33 • •• •• •• 78` · absente |
| Montants | Revenus, charges, apport, budget, prix convenu, montants d'une soumission et d'une offre, acompte, commission | `•••` |
| Texte libre | Notes, messages, comptes rendus, objet et corps des e-mails, titre et description des tâches manuelles, motifs et raisons saisis, questions d'un inscrit, texte d'un avis, précisions d'un rejet | « Contenu masqué » |
| Fichiers | Nom d'un fichier déposé ; le fichier lui-même, jamais accessible | « Fichier » |

Restent lisibles : identifiants, références, statuts, dates, types, compteurs, journaux techniques. Une recherche ou un tri sur un champ masqué est refusé pour ce rôle.

**SEC-033** `[P1]` **Champs sensibles** (`client.sensitive.read`, ROL-019). Sans la permission, ils sont omis de la réponse et nommés dans `withheld` (API-002) — **partout** où ils sont enregistrés, et pas seulement sur la fiche du client :

| Entité | Champs sensibles |
|---|---|
| `Client` | `birthDate`, `monthlyIncome`, `otherMonthlyIncome`, `monthlyDebts`, `incomeCurrency`, `downPayment`, `downPaymentCurrency`, `employmentType`, `employerName`, `employedSince`, `profession` |
| `DossierParty` | `birthDate`, `monthlyIncome`, `monthlyDebts`, `incomeCurrency`, `employmentType`, `profession` |
| `Dossier` | `downPayment`, `loanAmountRequested`, `commissionAmount`, `clientFeeAmount` (ces deux derniers : `dossier.commission.manage`) |
| `Lead` | dans `payload` et `supplements` : apport, mensualité confortable, revenus, et toute simulation jointe |
| `Simulation` | `inputs` en entier ; dans `outputs` : la mensualité maximale et le détail par produit |
| `BankSubmission` | montant demandé, montant accordé, taux, mensualité, assurance, frais, conditions |
| Exports, PDF internes, chronologie | Les mêmes champs, où qu'ils soient repris |

Le prix d'un bien, le budget visé et l'étape d'un dossier ne sont pas sensibles. La liste est tenue dans le code en un seul endroit, d'où sortent le filtrage des réponses, le masquage du journal d'audit (SEC-081) et les tests (QUA-021).

**SEC-034** `[P1]` La matrice rôle → permissions est testée automatiquement : pour chaque route et chaque rôle, un test vérifie l'accès ou le refus attendu (QUA-021).

## 4. Jetons à usage unique

**SEC-040** `[P1]` Liens d'activation, de vérification, de mot de passe, de connexion, d'enquête, d'inscription à un Café, d'alerte, de partage : un jeton aléatoire d'au moins 256 bits, dont seule l'empreinte SHA-256 est stockée ; comparaison à temps constant ; durée de vie par usage (`01-domaine/02`, § 1.5) ; **un seul usage** pour ceux qui ouvrent une session ou changent un secret (le lien d'invitation du personnel, qui n'ouvre pas de session, sert jusqu'à la fin de la première connexion : BO-003) ; un nouveau jeton invalide les précédents du même usage (MOD-105, avec son exception pour les liens d'activation). Un jeton ou un code n'apparaît **nulle part** en clair après son émission : ni dans un journal, ni dans le journal d'audit, ni dans le contenu conservé d'un e-mail (NOT-002), ni dans une réponse de l'API autre que celle qui le crée. Les pages à jeton portent le jeton dans leur adresse : les journaux d'accès du serveur et du CDN enregistrent ces adresses avec le jeton remplacé par `{jeton}`, et ces pages répondent avec `Referrer-Policy: no-referrer` et `Cache-Control: no-store`, pour que l'adresse ne parte pas vers un autre site.

## 5. Entrées et sorties

**SEC-050** `[P1]` Toute entrée est validée par son schéma (ARC-030) : types, bornes, longueurs, listes de valeurs. Un champ inconnu est refusé. Les requêtes à la base sont toujours paramétrées.

**SEC-060** `[P1]` **Texte riche.** Les contenus saisis dans le back-office (pages, réponses de questions fréquentes, blocs de texte riche) sont nettoyés **à l'enregistrement et à l'affichage** par une liste blanche : `h2`, `h3`, `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, `a` (attribut `href` en `https:`, `mailto:` ou `tel:`), `blockquote`, `img` (source dans la médiathèque seulement), `table`, `thead`, `tbody`, `tr`, `th`, `td`. Aucun script, aucun style, aucun gestionnaire d'événement, aucun cadre. Le corps d'un modèle d'e-mail n'est pas du HTML saisi : il suit NOT-061, et c'est son **rendu** qui passe par cette liste blanche, à l'envoi comme à l'aperçu ; le bouton et les blocs sont ajoutés ensuite par l'habillage, qui est du code. Tout texte saisi par un client est affiché échappé (TRV-065).

**SEC-061** `[P1]` **En-têtes.** Sur toutes les applications : transport sécurisé strict (HSTS), politique de sécurité du contenu sans script en ligne non signé, interdiction d'affichage dans un cadre, pas de devinette de type de contenu, politique de référent limitée à l'origine. Le back-office et les pages à jeton ajoutent `Cache-Control: no-store`.

**SEC-062** `[P1]` **Redirections.** Aucune redirection vers une adresse fournie par l'utilisateur, hors chemins internes (AUTH-023). **Adresses externes saisies** (vidéo d'un bien) : limitées aux domaines permis ; l'API ne va jamais chercher une adresse fournie par un utilisateur.

## 6. Débit et robots

**SEC-070** `[P1]` **Limites**, comptées par adresse IP et, quand elle est connue, par identité. Dépassement : `429`. Les compteurs vivent dans Redis (ARC-075) ; tant que Redis n'est pas dans l'environnement, ils sont tenus **en mémoire** par l'instance, derrière la même interface — valable pour une instance unique, ce qu'est le local (D-097).

| Action | Limite |
|---|---|
| Connexion | 5 échecs par compte, puis verrou de 15 minutes (AUTH-032) ; 20 tentatives par IP et par 10 minutes |
| Inscription | 5 par IP et par heure |
| Lien de connexion, mot de passe oublié, renvoi de vérification, code de confirmation, e-mail déclenché par une inscription sur une adresse déjà connue (AUTH-003, AUTH-005) | 1 par adresse et par minute, 3 par heure, 5 par jour ; 10 par IP et par heure |
| Porte d'accès (NAV-064) | 5 mots de passe faux par IP en 10 minutes, puis 15 minutes d'attente |
| Simulation envoyée par e-mail | 3 par adresse et par jour |
| Signal de vue d'une fiche (FIC-100) | 120 par IP et par minute ; au-delà, ignoré sans erreur |
| Demandes (tous formulaires publics ; « Écrire à mon conseiller » suit la ligne des messages, MSG-021) | 5 par IP et par heure, 20 par jour ; 5 par adresse e-mail et par jour (DEM-032) |
| Inscriptions à un Café, alertes, « Me prévenir » | 10 par IP et par heure ; au plus 10 alertes non confirmées par adresse — au-delà, la demande reçoit la même réponse et rien n'est créé (CAT-072) |
| Assistant conversationnel (ASS-052) | Messages : 6 par IP et par minute, 40 par heure ; modifications des pastilles de critères (sans appel au modèle) : 30 par IP et par minute |
| Simulations | 60 calculs par IP et par minute ; 10 PDF par heure |
| Messages, et « Écrire à mon conseiller » (MSG-021) | 30 par compte et par 10 minutes |
| Dépôts de fichiers d'un client | 20 dépôts et 200 fichiers par compte et par heure — les photos d'un dépôt se comptent une à une, avant d'être réunies (MED-032) |
| Dépôts de médias et de pièces par l'équipe | 100 fichiers par lot de dépôt ; pas de limite horaire (comptés dans la limite du back-office) |
| Espace client | 300 requêtes par compte et par minute |
| Page de partage (code) | 5 codes faux par lien, puis verrou (BNK-112) ; 20 tentatives par IP et par heure |
| Lecture publique | 300 requêtes par IP et par minute |
| Back-office | 600 requêtes par compte et par minute |

**SEC-072** `[P2]` `[P3]` **Réponse d'un partenaire par lien** (ACP-041). Un lien de réponse a les protections du lien de téléchargement (BNK-112, SEC-070) : jeton imprévisible, code à part, verrou au cinquième code faux, expiration, révocation, journal de chaque ouverture, aucune information avant le bon code. Il ne donne accès qu'à **son** objet — pour l'état du stock : les programmes à vérifier du promoteur et leurs lots — et aux gestes qu'il liste. Ce qu'il permet de lire est limité à ce qu'un partenaire peut savoir (ACP-017). **Par un lien seul, rien ne change de ce que lisent le public ou le client** : ne s'appliquent directement que l'accusé de réception d'un dossier, le dépôt d'un fichier — qui reste à vérifier —, « tout est à jour » et « barème inchangé » ; tout le reste attend la relecture d'un membre de l'équipe (ACP-031, D-083). Le renouvellement d'un lien expiré est limité : trois par jour, seulement tant que la demande attend une réponse et que l'interlocuteur répond encore aux demandes ; l'ancien lien est révoqué. Suspendre ou terminer un partenaire, ou le repasser au niveau 1, ferme ses liens de réponse dans la même transaction ; les liens de téléchargement des dossiers en cours restent valables (CYC-241).

**SEC-071** `[P1]` **Pas d'énumération.** Les réponses, et leur durée, sont les mêmes qu'un compte existe ou non (TRV-112, AUTH-021). Les identifiants sont des UUID ; aucune route publique ne liste des objets non publiés.

## 7. Fichiers

**SEC-075** `[P1]` Tout fichier reçu — pièce, pièce jointe, média du catalogue, document d'un partenaire, fichier d'import — : type **constaté** d'après son contenu, comparé à la liste permise ; taille bornée ; nom nettoyé ; contrôle antivirus avant toute lecture et avant toute mise en ligne (MOD-350, MED-021) ; stockage hors de tout répertoire exécutable ; téléchargement avec un type sûr et en pièce jointe. Les images publiques sont **réencodées**, ce qui retire leurs métadonnées, dont la position GPS de la prise de vue (MED-020). Détail : `05-fichiers-et-medias.md`.

## 8. Chiffrement et secrets

**SEC-085** `[P1]`
- **En transit** : TLS 1.2 au minimum, partout, y compris entre l'API, la base et le stockage.
- **Au repos** : base de données et stockage chiffrés par l'hébergeur ; sauvegardes chiffrées.
- **Par l'application** (AES-256-GCM, MOD-016) : le secret de double authentification. La clé est dans le coffre de secrets de l'hébergement, jamais en base ni dans le dépôt ; elle est renouvelable sans perte (identifiant de clé stocké avec chaque valeur).
- **Hachés, jamais relisibles** : mots de passe, jetons, code d'un lien de partage, code de confirmation d'une action, codes de secours.
- **Adresses IP** : seule une empreinte à clé (HMAC) est stockée ; la clé est propre à la plateforme.

**SEC-086** `[P1]` **Secrets** (clés d'API, mots de passe de base, clé de chiffrement, clé de signature des jetons) : dans le coffre de l'hébergement, distincts par environnement, jamais dans le code, les journaux, les messages d'erreur ou les tickets. Un secret exposé est renouvelé sans délai.

**SEC-087** `[P1]` **Dépendances.** Versions figées ; contrôle des vulnérabilités connues à chaque intégration ; correctif sous 72 heures pour une faille critique, à la mise à jour mensuelle sinon.

## 9. Journal d'audit

**SEC-080** `[P1]` **Actions tracées** (`AuditLog.action`). Pour chacune : l'auteur, son rôle effectif, l'objet, les valeurs avant et après pour une modification, la raison quand elle est demandée, l'identifiant de requête, l'empreinte de l'adresse IP.

**Portée.** Deux étages, pour que le journal n'ait pas de trou (BO-084) :
1. les actions **nommées** du tableau ci-dessous : chacune a son code, parce qu'on la cherchera par ce nom ;
2. toute **autre** écriture faite par un membre du personnel ou par le système sur un objet métier : une ligne au code générique `{objet}.created`, `{objet}.updated` ou `{objet}.deleted` (`task.updated`, `note.created`, `appointment.updated`, `faq_item.deleted`…), avec les champs modifiés. `{objet}` est le nom du modèle Prisma en `snake_case` (`bank_product`, `checklist_template`, `faq_item`) ; les codes **nommés** du tableau gardent leur graphie (`bankproduct.changed`) : ce sont des codes, pas des noms de modèle. Pour le filtre du journal (ADM-051), un code générique appartient à la famille de son objet : `user` → Équipe ; `client`, `client_contact` → Client ; `lead` → Demande ; `dossier`, `dossier_party`, `dossier_candidate`, `reservation`, `appointment` → Dossier ; `dossier_document`, `document_version`, `checklist_template` → Pièce ; `bank_submission`, `bank`, `bank_product`, `exchange_rate` → Financement ; `program`, `property`, `lot`, `media`, `promoter`, `partner` → Catalogue ; `communication`, `email_template`, `workflow_rule`, `survey`, `feedback`, `event`, `event_registration` → Communication ; `content_block`, `page`, `faq_item`, `testimonial`, `legal_document`, `redirect` → Contenus ; `setting`, `country`, `region`, `commune`, `holiday` → Paramètres ; `data_request` → Données personnelles. Un objet qui se rattache à un autre (`task`, `note`) prend la famille de cet autre (Dossier, Client, Demande…) ; à défaut, Système.

Les lectures ne sont tracées que pour ce qui est sensible : fichier d'une pièce ou d'une pièce jointe, champs sensibles d'un client, aperçu de l'espace d'un client, exports. Ce vocabulaire est **distinct** de celui des événements de domaine (AUT-010) : un événement déclenche des effets, une ligne d'audit répond à « qui a fait quoi » ; quand les deux décrivent le même fait, ils peuvent porter des noms différents, et le code ne déduit jamais l'un de l'autre.

| Famille | Actions |
|---|---|
| Connexion | `auth.login_succeeded`, `auth.login_failed`, `auth.locked`, `auth.logout`, `auth.password_reset_requested`, `auth.password_changed`, `auth.two_factor_enabled`, `auth.two_factor_disabled`, `auth.two_factor_reset`, `auth.email_changed`, `auth.session_revoked`, `auth.reuse_detected`, `auth.signup_disowned` |
| Équipe | `user.invited`, `user.role_changed`, `user.suspended`, `user.reactivated`, `user.deleted`, `user.email_changed`, `user.charter_accepted`, `user.recovered`, `support.elevation_granted`, `support.elevation_ended` |
| Client | `client.created`, `client.updated`, `client.merged`, `client.archived`, `client.unarchived`, `client.assigned`, `client.do_not_contact_changed`, `client.not_duplicate_marked`, `client.restriction_set`, `client.restriction_lifted`, `client.account_invited`, `client.account_suspended`, `client.account_reactivated`, `client.sessions_revoked`, `client.impersonated`, `client.impersonation_ended`, `client.sensitive_viewed`, `client.exported` |
| Demande | `lead.created_by_staff`, `lead.taken`, `lead.assigned`, `lead.released`, `lead.reopened`, `lead.reviewed`, `lead.closed`, `lead.marked_spam`, `lead.restored`, `lead.application_approved`, `lead.application_declined`, `lead.application_info_requested` |
| Dossier | `dossier.created`, `dossier.updated`, `dossier.stage_changed`, `dossier.held`, `dossier.resumed`, `dossier.closed`, `dossier.reopened`, `dossier.assigned`, `dossier.deleted`, `dossier.financing_mode_changed`, `dossier.commission_changed`, `dossier.exported`, `candidate.status_changed`, `reservation.created`, `reservation.changed`, `reservation.option_acknowledged`, `reservation.option_refused`, `reservation.deposit_settled`, `appointment.outcome_corrected` |
| Pièce | `document.file_viewed`, `document.file_downloaded`, `document.uploaded`, `document.validated`, `document.rejected`, `document.waived`, `document.validation_reverted`, `document.version_deleted`, `document.bulk_downloaded`, `document.requested`, `document.reminded`, `checklist.reevaluated`, `checklist_template.changed`, `attachment.viewed`, `attachment.filed`, `consent.recorded_by_staff` |
| Financement | `submission.created`, `submission.package_generated`, `submission.shared`, `submission.share_revoked`, `submission.package_downloaded`, `submission.status_changed`, `submission.decision_recorded`, `submission.decision_corrected`, `submission.decision_reverted`, `submission.offer_extended`, `bank.updated`, `bankproduct.changed`, `exchange_rate.created`, `exchange_rate.voided`, `reference_financing.changed`, `indicative_scale.changed`, `eligibility.changed` |
| Catalogue | `property.published`, `property.unpublished`, `property.archived`, `property.unarchived`, `property.updated`, `property.deleted`, `property.pinned`, `lot.created`, `lot.deleted`, `lot.price_changed`, `lot.status_changed`, `lot.sale_corrected`, `media.deleted`, `program.published`, `program.unpublished`, `program.archived`, `program.unarchived`, `program.updated`, `program.deleted`, `promoter.updated`, `promoter.deleted`, `promoter.status_changed`, `promoter.republished`, `bank.status_changed`, `partner.changed`, `partner.document_viewed`, `partner.access_level_changed`, `partner.answer_applied`, `partner.answer_dismissed`, `program.stock_confirmed`, `bankproduct.rates_confirmed`, `import.executed` |
| Communication | `email.sent_manually`, `email.resent`, `email.bulk_sent`, `template.changed`, `workflow_rule.changed`, `survey.changed` |
| Contenus | `content.changed`, `legal_document.published`, `redirect.changed` |
| Paramètres | `setting.changed`, `feature.toggled`, `referential.changed` |
| Données personnelles | `data_request.created`, `data_request.identity_verified`, `data_request.closed`, `person.exported`, `person.erased`, `consent.changed`, `export.created`, `export.downloaded`, `export.link_shared` |
| Corbeille | `trash.restored`, `trash.purged` |
| Système | `system.job_failed`, `system.job_run_manually`, `system.cache_drift`, `system.purge_executed`, `system.retention_executed`, `system.retention_held`, `system.clock_shifted` |

**SEC-081** `[P1]` **Ce que le journal ne contient pas** : mots de passe, jetons, codes, contenu des pièces, corps des messages. Les valeurs sensibles d'une modification (SEC-033) sont remplacées par `"***"` ; le journal dit **qu'**un revenu a changé, pas sa valeur. Il ne garde pas non plus de **valeur d'identité** : le libellé d'un objet (`entityLabel`) est sa référence (« DOS-2026-0042 », « DP-DZ-0142 »), ou le nom d'un objet qui n'est pas une personne (programme, banque), jamais le nom d'une personne — une fiche client, qui n'a pas de référence, n'a pas de libellé : l'écran retrouve le nom par `clientId` (`AuditLog.entityLabel`) ; un changement de nom, d'e-mail ou de téléphone y figure comme « modifié », sans l'ancienne ni la nouvelle valeur. C'est ce qui permet de garder le journal cinq ans après l'effacement d'une personne sans y garder la personne. Les journaux techniques (ARC-073) ne contiennent aucune donnée personnelle.

**SEC-082** `[P1]` Le journal est immuable (MOD-430) et conservé `retention.auditYears` ans. Consulter le fichier d'une pièce ou les champs sensibles d'un client y laisse une trace : c'est ce qui permet de répondre à « qui a vu mon dossier ? ».

## 10. Protection des données personnelles

**SEC-090** `[P1]` **Cadre.** Règlement européen (RGPD) pour les personnes qui résident dans l'Union ; loi algérienne 18-07 pour les traitements liés à l'Algérie. **Diaspora Patrimoine** est responsable du traitement ; **SYMLOOP** est son sous-traitant ; l'hébergeur et le fournisseur d'e-mail sont des sous-traitants ultérieurs, liés par contrat. Données hébergées dans l'Union européenne (D-059).

**SEC-091** `[P1]` **Registre des traitements** — à valider par le conseil juridique.

| Finalité | Données | Base | Durée (SEC-110) |
|---|---|---|---|
| Répondre à une demande, recontacter | Identité, coordonnées, projet | Mesures précontractuelles à la demande de la personne | Prospect |
| Suivre un projet d'acquisition | Identité, situation, projet, échanges | Exécution du service demandé | Dossier |
| Constituer et transmettre un dossier de financement | Pièces d'identité, de revenus, bancaires | Service demandé ; **consentement** pour la transmission aux banques et aux promoteurs, y compris hors de l'Union | Dossier |
| Simuler | Revenus, charges, apport | Service demandé | 30 jours sans compte — y compris une simulation reçue par e-mail, qui ne crée aucune fiche (SIM-032) ; sinon prospect |
| Compte et sécurité | Identifiants, sessions, journaux | Intérêt légitime (sécurité) | Vie du compte ; journaux : SEC-110 |
| Le Café | Identité, coordonnées, présence | Service demandé | Prospect |
| Actualités | E-mail | **Consentement** | Jusqu'au retrait |
| Enquêtes | Réponses | Intérêt légitime (amélioration du service) ; opposition possible | Dossier |
| Mesure d'audience | Données de navigation | **Consentement** | 13 mois |
| Preuve | Consentements, journal d'audit | Obligation légale, intérêt légitime | 5 ans |

**SEC-092** `[P1]` **Transferts hors de l'Union.** Deux cas : (1) la transmission d'un dossier à une banque ou à un promoteur établi en Algérie — elle repose sur le **consentement explicite** du client, informé du pays de destination (DOS-040), et ne porte que sur les pièces utiles ; (2) l'accès de l'équipe de support de SYMLOOP depuis l'Algérie — lecture à données masquées (ROL-015, SEC-032), accès complet seulement sur octroi temporaire et tracé (ROL-015, ROL-016, Q-040). Les deux points sont à valider par le conseil juridique avant la mise en ligne.

**SEC-093** `[P1]` **Information des personnes.** Chaque formulaire porte sa mention courte et le lien vers la politique de confidentialité (DEM-020). La politique de confidentialité, les conditions générales, les mentions légales et la politique de cookies sont rédigées par Diaspora Patrimoine et son conseil ; la plateforme en fournit le cadre et les versions (CMS-060). Les données de départ contiennent une version « 0.1 – projet » de chaque texte, **provisoire et en vigueur** dès l'installation, pour qu'un consentement cite toujours une version (PAR-083) ; elle est remplacée par les textes validés avant l'ouverture au public (PAR-100).

**SEC-094** `[P1]` **Minimisation.** On ne demande une donnée que quand elle sert : les revenus au simulateur ou au dossier, jamais à l'inscription. Les exports ne contiennent les champs sensibles que pour les rôles qui y ont droit (BO-041). Les environnements hors production ne reçoivent **jamais** de données réelles (ENV-030).

**SEC-095** `[P1]` **Mineurs.** La plateforme s'adresse à des personnes majeures : une date de naissance qui donne moins de 18 ans est refusée.

**SEC-096** `[P1]` **Analyse d'impact.** Le traitement à grande échelle de pièces d'identité et de données financières justifie une analyse d'impact, à conduire par Diaspora Patrimoine avec son conseil avant la mise en ligne ; ces spécifications en fournissent la description technique.

**SEC-100** `[P1]` **Droits des personnes** : accès, rectification, effacement, limitation, portabilité, opposition, retrait du consentement. Réponse sous **un mois** (alerte à J+20, AUT-075). Parcours : PRO-050 à PRO-060 côté client, ADM-060 à ADM-064 côté équipe. L'exercice d'un droit est gratuit et ne demande pas de justification.

**SEC-105** `[P1]` **Violation de données.** Tout incident qui touche des données personnelles (accès non autorisé, fuite, perte) est : contenu (révocation des sessions et des secrets concernés) ; consigné (nature, données et personnes touchées, mesures) ; **signalé par SYMLOOP à Diaspora Patrimoine sans délai, et au plus tard sous 48 heures** ; puis, par Diaspora Patrimoine, à l'autorité de contrôle sous 72 heures et aux personnes concernées si le risque est élevé. Le journal d'audit et les journaux d'accès aux fichiers servent à mesurer l'étendue.

## 11. Conservation et effacement

**SEC-110** `[P1]` **Durées par défaut** — à valider par le conseil juridique (Q-017). La tâche `retention` (AUT-081) les applique chaque semaine.

| Donnée | Conservée | Ensuite |
|---|---|---|
| **Prospect** : fiche sans dossier abouti, ses demandes, ses simulations, ses inscriptions aux Cafés, ses messages | `retention.prospectYears` (3 ans) après le **dernier contact** (dernière activité de la personne ou dernier échange avec elle) | Anonymisation |
| Dossier clôturé sans acquisition | Avec la fiche du prospect | Anonymisation |
| **Fichiers des pièces** d'un dossier clôturé sans acquisition | `retention.closedDossierFilesMonths` (12 mois) après la clôture | Suppression des fichiers ; la liste des pièces reste. Exception : la preuve d'un accord recueilli par l'équipe (pièce interne, GED-070) est gardée aussi longtemps que le consentement qu'elle prouve |
| **Dossier abouti**, ses pièces, ses soumissions | `retention.dossierYears` (5 ans) après l'acte | Suppression des fichiers, anonymisation |
| Anciennes versions d'une pièce | `retention.oldVersionMonths` (12 mois) après leur remplacement | Suppression des fichiers |
| Compte client inactif, sans dossier en cours | `retention.inactiveAccountYears` (3 ans) sans connexion | E-mail `C_ACCOUNT_INACTIVE_NOTICE` 30 jours avant ; sans réaction : traité comme un prospect |
| Candidature de partenaire non suivie | `retention.partnerApplicationYears` (2 ans) | Suppression |
| Consentements | 5 ans après leur retrait ou la fin de la relation. « Jamais modifiés ni supprimés » (MOD-106) s'entend de l'application : seule cette échéance les retire, par le chemin réservé de MOD-430 | Suppression |
| Réservations et acomptes d'un dossier clôturé sans acquisition | Tant qu'un acompte est « à suivre », puis avec la fiche du prospect | Anonymisation |
| Co-emprunteurs, garants, personnes de confiance | Comme le dossier ou la fiche auxquels ils tiennent | Effacés avec eux |
| Demandes d'exercice de droits | `retention.dataRequestYears` (5 ans) après leur clôture | Suppression |
| Journal d'audit | `retention.auditYears` (5 ans) | Suppression |
| Journaux techniques | 6 mois — valeur d'exploitation, pas un paramètre (ENV-071) | Suppression |
| Sauvegardes | 30 jours glissants | Écrasement |

Purges courtes (corbeille, jetons, simulations anonymes…) : AUT-091.

**Garde-fous de la tâche `retention`** (PAR-006). Elle agit sur des durées bornées (jamais zéro) ; avant d'effacer, elle compte ; si un passage devait toucher plus de `retention.maxPerRun` objets, elle n'efface rien, alerte le support et attend la confirmation de la Direction dans l'écran de diagnostic. Chaque passage laisse une ligne d'audit avec ses compteurs (`system.retention_executed`). Quand elle supprime les fichiers d'un dossier clôturé, chaque pièce concernée revient à `PENDING` (CYC-149). Une personne dont le traitement est limité **à sa demande** (`restrictedAt`, ADM-063) n'est pas anonymisée par la tâche tant que la limitation dure : elle a demandé qu'on conserve. Cette protection ne vaut pas pour le reliquat d'un acquéreur effacé (SEC-111), qui part à son échéance.

**SEC-111** `[P1]` **Anonymiser une fiche** (effacement demandé, ou durée atteinte). Ce qui est effacé dépend de ce que la personne a fait avec Diaspora Patrimoine : un effacement demandé ne peut pas faire disparaître la trace d'une vente.

| Cas | Effacé tout de suite | Conservé, et jusqu'à quand |
|---|---|---|
| **Contact** : des demandes, pas de dossier au-delà de la qualification | Tout ce qui suit. | Rien d'identifiant. |
| **Dossier clôturé sans acquisition** | Tout ce qui suit, fichiers des pièces compris. Un acompte encore « à suivre » bloque l'effacement tant que son issue n'est pas enregistrée (CYC-108). | Rien d'identifiant. |
| **Acquéreur** (au moins un dossier gagné) | Tout ce qui n'est pas dans la colonne de droite : coordonnées de contact, situation, finances, simulations, messages, notes, pièces de revenus et de banque, proches, alertes, favoris, compte. | Le **minimum de la vente**, jusqu'à `retention.dossierYears` après l'acte : prénom et nom de l'acquéreur et de ses co-emprunteurs, bien et lot, prix de vente, dates de réservation et d'acte, acompte et son issue, banque et conditions de l'offre acceptée, contrat de réservation et acte s'ils sont déposés. La fiche, marquée effacée (`gdprErasedAt`), ne garde que ce minimum : visible de la Direction et des administrateurs seulement, exclue de toute liste, de tout envoi et de toute statistique nominative. À l'échéance, la tâche `retention` efface ce reste. |

Dans une seule opération, pour ce qui est effacé :
- `Client` : identité et coordonnées vidées — sauf, pour un **acquéreur**, son prénom et son nom, seuls champs d'identité gardés avec la vente ; adresse remplacée par une valeur neutre unique ; adresses secondaires vidées ; situation, finances, projet : vidés ; `gdprErasedAt` renseigné ;
- `ClientContact` : supprimés. `DossierParty` : supprimés, sauf ceux d'un **dossier gagné conservé**, réduits au rôle, au prénom et au nom (l'emprunteur principal n'y porte pas de nom, MOD-322 : le sien est sur la fiche), et, parmi les autres, sauf ceux qu'une ligne `Consent` référence (`PARTY_AUTHORIZATION`, MOD-321) : ceux-là restent, vidés de toute identité et de toute donnée de SEC-033, marqués retirés (`removedAt`) ; la preuve d'accord garde ainsi sa cible sans nommer personne ;
- `EventNotifyRequest` (adresse), `Appointment` (notes, lieu saisi, lien de visio, nom de qui fait la visite), `DossierCandidate` (commentaire et raison donnés par le client), `Conversation.lastMessagePreview`, `DocumentFile.fileName` : vidés ; les `Notification` du personnel qui nomment la personne voient leur texte remplacé par le libellé de leur type ;
- **règle de fermeture** : tout champ de texte libre d'un objet rattaché à la personne est vidé. Un champ ajouté plus tard au modèle suit cette règle sans avoir à figurer dans cette liste, et un test la vérifie champ par champ (QUA-026) ;
- `Lead` : `payload`, `supplements`, message, coordonnées de l'envoi, empreinte d'adresse IP : vidés ;
- `Message`, `MessageAttachment`, `Note`, `Communication` (objet, corps, adresse du destinataire, comptes rendus), `Feedback` (commentaire, et réponses de type `TEXT` dans `answers` ; les notes restent), `Task` (titre et description d'une tâche manuelle remplacés par « Tâche », les titres des tâches automatiques par leur modèle sans le nom) : supprimés ou vidés ;
- fichiers des pièces, pièces jointes, PDF de simulations et de projections, exports : supprimés du stockage — à une exception près : la **preuve d'un accord** recueilli par l'équipe (GED-070) reste avec la ligne de consentement qu'elle prouve, pour la même durée, lisible de la Direction seule : c'est une preuve à produire, pas une donnée d'exploitation ;
- `EventRegistration` : coordonnées et questions vidées, la présence reste comme un nombre ; `Testimonial` lié : sans accord de maintien (`Testimonial.keepAfterErasureConsentAt`), supprimé, photo comprise ; avec cet accord, il reste publié et seul son lien au client (`clientId`) est vidé ;
- `Simulation` : entrées vidées ; `SearchAlert`, `Favorite`, `PushDevice`, `Session`, `AuthToken` : supprimés ; `User` : `DELETED` (MOD-100) ;
- fiches **fusionnées** dans celle-ci (`mergedIntoId`) : traitées de même ;
- **restent**, sans lien avec une personne : les lignes nécessaires aux statistiques (une demande de telle nature à telle date, un dossier passé par telles étapes, un pays de résidence), les consentements et le journal d'audit — qui ne contient pas de valeur d'identité (SEC-081) — pour leur durée propre.

L'e-mail de confirmation (`C_ACCOUNT_DELETED` ou `C_DATA_REQUEST_DONE`) est mis en file **avant** l'opération, avec l'adresse encore connue ; sa ligne `Communication` est ensuite vidée de son adresse. L'opération est irréversible. Elle n'est pas possible tant qu'un dossier est ouvert, qu'une réservation est active ou qu'une soumission est en cours (ADM-064). Restaurer un objet de la corbeille ne ramène rien de ce qu'elle a effacé.

**SEC-112** `[P1]` Une personne dont les données sont anonymisées et qui revient est une **nouvelle** personne : rien ne la relie à son ancienne fiche.

## 12. Avant la mise en ligne

**SEC-130** `[P1]` Le Lot 6 comprend une **revue de sécurité** : contrôle des routes contre la matrice des permissions ; essais d'accès croisés entre clients ; essais sur les dépôts de fichiers ; revue des en-têtes et des cookies ; revue des secrets et des sauvegardes ; essai de restauration. Référence visée : les exigences de niveau 2 du standard de vérification de la sécurité applicative de l'OWASP (ASVS 4.0). La revue est conduite par SYMLOOP, sur la liste des exigences de niveau 2 applicables, chacune notée « conforme », « non conforme » ou « sans objet » ; son compte rendu suit QUA-080. **Défaut grave** : une faille de score CVSS 3.1 égal ou supérieur à 7, ou toute exposition des données d'une personne à une autre. Les défauts graves sont corrigés avant l'ouverture.
