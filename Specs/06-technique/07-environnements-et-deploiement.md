# Environnements et déploiement

Contrat : offre technique, § 5 (hébergement, CI/CD) et Lot 1 (socle), Lot 6 (mise en production). Hébergeur et région : Q-017 ; fournisseur d'e-mail : Q-030 ; nom de domaine : Q-023.

---

## 1. Environnements

**ENV-001** `[P1]`

| Environnement | Sert à | Données | Mise à jour |
|---|---|---|---|
| **Local** | Développer | Données de départ et de démonstration ; PostgreSQL embarqué, sans conteneur, et services remplacés par leurs réalisations locales (ENV-041) | À la main |
| **Éphémère** | Relire une proposition de modification | Données de démonstration ; détruit à la fusion | À chaque proposition |
| **Recette** | Validation par la cliente ; formation | Données de démonstration (PAR-082) ; jamais de données réelles | À chaque fusion sur la branche principale |
| **Production** | Le service réel. Créée dès la livraison 1, fermée au public jusqu'à l'ouverture (ENV-054) | Données réelles | Sur version étiquetée, après approbation |

**ENV-002** `[P1]` Les environnements sont **étanches** : bases, stockages, clés, secrets et comptes de service distincts. Aucun ne peut lire ou écrire dans un autre.

## 2. Adresses

**ENV-010** `[P1]` En production, sous le nom de domaine de Diaspora Patrimoine (Q-023) :

| Hôte | Application |
|---|---|
| `www.{domaine}` (le domaine nu y redirige) | `web` : site public et espace client |
| `admin.{domaine}` | `admin` : back-office |
| `api.{domaine}` | API |
| `media.{domaine}` | CDN des médias publics |
| `partenaires.{domaine}` `[P2]` | Portails |

En recette : les mêmes, sous un sous-domaine `recette`. Tout en HTTPS, avec redirection de HTTP ; certificats renouvelés automatiquement.

## 3. Garde-fous hors production

**ENV-030** `[P1]` Sur tout environnement autre que la production :
- **aucun e-mail ne part vers un vrai destinataire** : tous sont redirigés vers une boîte de recette (`MAIL_SANDBOX_RECIPIENT`), le destinataire d'origine étant rappelé dans l'objet (NOT-013) ;
- toutes les pages portent `noindex` (NAV-030) et l'accès au site passe par la porte d'accès (`SITE_GATE_PASSWORD`, NAV-064) ;
- un bandeau « RECETTE » est affiché en permanence dans le back-office (BO-014) et, discrètement, sur le site ;
- les produits bancaires d'exemple sont utilisables (PAR-040) ;
- les comptes d'essai du jeu de démonstration existent, un par rôle (PAR-082) ;
- aucune notification push réelle ;
- la mesure d'audience est coupée.

**ENV-032** `[P1]` **Horloge de recette.** Pour démontrer en une séance ce qui prend des jours (une relance à J+3, une option qui expire, une enquête à J+7), la recette — et elle seule — permet de **décaler l'horloge** de l'application : le diagnostic (ADM-080) y montre « Horloge de recette : +{n} jours » avec les boutons « Avancer d'un jour », « Avancer de {n} jours » et « Revenir à l'heure réelle ». Toute lecture de l'heure par le code passe par la même horloge (ARC-060) : échéances, tâches planifiées, expirations la suivent. La fonction dépend de la variable `CLOCK_OFFSET_ALLOWED`, interdite en production : l'application refuse de démarrer si elle y est définie.
- **Où vit le décalage.** Dans le paramètre `clock.offsetDays` (`01-domaine/10`, § 1.10) : il est partagé par toutes les instances de l'API et par les travailleurs, et survit aux redémarrages. `Clock` le relit à chaque appel, avec un cache de 5 secondes.
- **La route.** `shift-clock` (API-100) reçoit `{"days": n}`, `n` entier de 0 à 365 : c'est le décalage **total** voulu, pas un ajout. « Avancer d'un jour » envoie le décalage courant + 1 ; « Avancer de {n} jours », le décalage courant + {n} ; « Revenir à l'heure réelle », `0`. Quand l'horloge recule, les dates techniques postérieures au nouvel instant sont ramenées à cet instant : `availableAt` et `claimedAt` des événements non traités, `nextAttemptAt` des exécutions de règles ; les lignes de clé d'idempotence sans réponse sont supprimées (API-040). Elle est refusée si `CLOCK_OFFSET_ALLOWED` n'est pas défini. Chaque changement est écrit au journal d'audit (`system.clock_shifted`, avant et après : le décalage).
- **Ce qui est rattrapé.** Après un décalage vers l'avant, chaque tâche de AUT-081 dont au moins un passage prévu tombe entre l'ancienne et la nouvelle heure de l'application est lancée **une fois**, dans l'ordre du tableau de AUT-081, l'une après l'autre ; ses surveillances rattrapent d'elles-mêmes tout ce qui est devenu dû (AUT-082).

Dans **tous** les environnements, production comprise, les textes légaux de départ sont en vigueur sous le libellé « 0.1 – projet » jusqu'à leur remplacement (PAR-083) : l'inscription et les demandes citent toujours une version.

**ENV-031** `[P1]` **Aucune donnée réelle hors production.** Pour reproduire un défaut, on utilise des données de démonstration ; si une copie de production est indispensable, elle est **anonymisée** par un script (SEC-111 appliqué à toutes les fiches, fichiers exclus) avant de quitter la production, et l'opération est tracée.

## 4. Infrastructure

**ENV-020** `[P1]` Dans une région de l'Union européenne (D-059), chez un seul hébergeur :

| Brique | Exigence |
|---|---|
| API et travailleurs | Conteneurs ; au moins deux instances de l'API en production ; les travailleurs à part ; redémarrage automatique |
| Applications web | Conteneurs, ou plate-forme d'hébergement Next.js située dans l'Union |
| PostgreSQL 16 | Service géré ; restauration à un instant donné (FIA-090) ; réplique de secours ; extensions de MOD-001 |
| Redis | Service géré, avec persistance |
| Stockage objet | Compatible S3 ; un espace public derrière le CDN, des espaces privés chiffrés sans accès public ; conservation des versions (FIA-062) |
| Antivirus | ClamAV, dans un conteneur à part, signatures mises à jour chaque jour (ARC-060) |
| Coffre de secrets | Celui de l'hébergeur (SEC-086) |
| Pare-feu applicatif et CDN | Devant les applications publiques ; limitation de débit en amont de SEC-070 |
| E-mail | Fournisseur transactionnel européen, avec retours de statut (D-055) |

Aucune base ni aucun stockage n'est joignable depuis Internet : seuls les hôtes de ENV-010 le sont.

**ENV-022** `[P1]` **Ce que le contrat couvre.** La mise en place des environnements, le déploiement et la mise en production font partie de la Phase 1 (contrat, article 3). L'hébergement après la mise en production, la supervision et la maintenance au-delà de la garantie relèvent d'un contrat distinct (article 14) : les exigences de ce fichier décrivent le service à tenir, quel que soit celui qui l'opère.

**ENV-021** `[P1]` **Dimensionnement de départ** : celui qui passe l'essai de charge de QUA-080. Il se relève sans changer l'architecture (plus d'instances de l'API et de travailleurs, base plus grande).

## 5. Configuration

**ENV-040** `[P1]` Tout ce qui diffère d'un environnement à l'autre est une variable d'environnement, validée au démarrage (ARC-072). Les valeurs **métier** n'en font pas partie : ce sont des paramètres (PAR-004).

| Variable | Rôle |
|---|---|
| `APP_ENV` | `local`, `preview`, `staging`, `production` |
| `APP_ROLE` | `api`, `worker` ou `all` (les deux rôles dans un même processus : permis en local et en éphémère seulement). Un processus `worker` n'ouvre aucun port HTTP, hors le contrôle de santé (API-100). |
| `WEB_URL`, `ADMIN_URL`, `API_URL`, `MEDIA_URL` | Adresses publiques des applications |
| `DATABASE_URL`, `REDIS_URL` | Connexions |
| `MIGRATION_DATABASE_URL` | Compte propriétaire du schéma, qui applique les migrations (FIA-080, MOD-430). Utilisé par le déploiement seulement, jamais par l'application en service. |
| `RETENTION_DATABASE_URL` | Compte réservé à la tâche `retention`, seul autorisé à supprimer des lignes du journal d'audit et des consentements (MOD-430). Obligatoire. |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_PUBLIC_BUCKET`, `STORAGE_PRIVATE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | Stockage objet |
| `JWT_SIGNING_KEY` | Signature des jetons d'accès |
| `ENCRYPTION_KEY`, `ENCRYPTION_KEY_ID`, `ENCRYPTION_KEYS_RETIRED` | Chiffrement applicatif (SEC-085) : la clé en service (32 octets, base64 ou hexadécimal) et son identifiant ; les clés retirées, qui savent encore déchiffrer (`id:clé,id:clé`, facultatif) |
| `IP_HASH_KEY` | Empreinte des adresses IP |
| `LINK_SIGNING_KEY` | Liens signés (aperçus, préférences, désinscription) |
| `REVALIDATE_SECRET` | Signature des appels de l'API qui invalident le cache des pages de `web` (ARC-040) |
| `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_WEBHOOK_SECRET` | Fournisseur d'e-mail. `MAIL_PROVIDER` vaut `log` en local par défaut (un fichier `.eml` par e-mail, dans `MAIL_LOG_DIR`, à défaut `.local/mail` : ENV-041), `smtp` en éphémère (la boîte de test Mailpit, sans authentification ni retours de statut), `memory` pour les tests automatisés, ou le code du fournisseur transactionnel retenu (Q-030), avec `MAIL_API_KEY` et `MAIL_WEBHOOK_SECRET`. La redirection vers `MAIL_SANDBOX_RECIPIENT` (NOT-013) s'applique quel que soit le fournisseur. |
| `SMTP_HOST`, `SMTP_PORT` | Boîte de test, quand `MAIL_PROVIDER` vaut `smtp` |
| `MAIL_SANDBOX_RECIPIENT` | Boîte de recette (obligatoire hors production, interdite en production) |
| `MAIL_FROM_ADDRESS`, `MAIL_REPLY_TO` | Adresse d'expédition et adresse de réponse **par défaut**, sur le domaine authentifié chez le fournisseur. Tant que le domaine de Diaspora Patrimoine n'est pas connu (Q-023), un sous-domaine technique de SYMLOOP, authentifié de même, en tient lieu. Obligatoires : sans elles, aucun e-mail ne peut partir, pas même la première invitation. Les paramètres `mail.fromAddress` et `mail.replyTo` les remplacent quand ils sont renseignés (NOT-003). |
| `CLAMAV_HOST`, `CLAMAV_PORT` | Antivirus |
| `TECH_ALERT_EMAIL` | Destinataire des alertes techniques (AUT-076) : l'astreinte de SYMLOOP (ENV-070). Obligatoire. |
| `STORAGE_QUOTA_GB` | Volume de stockage prévu pour l'environnement ; sert aux alertes à 80 % et au refus des dépôts à 100 % (MED-071) |
| `TRUSTED_PROXIES` | Adresses du CDN et du répartiteur dont l'en-tête d'adresse IP est cru (SEC-028) |
| `CHALLENGE_SITE_KEY`, `CHALLENGE_SECRET` | Défi contre les robots (facultatif) : clés du service retenu (Q-034), branché derrière l'interface de DEM-030 |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | Assistant de recherche en mode conversationnel (ASS-052) : fournisseur (`anthropic`, seul connu du code, Q-057), clé, modèle (défaut `claude-sonnet-5-5`). Vides : l'assistant reste en mode guidé. Avec `AI_PROVIDER` = `anthropic`, la clé peut aussi venir de `ANTHROPIC_API_KEY`, la variable que lisent les outils du fournisseur. |
| `ANALYTICS_SITE_ID` | Mesure d'audience (facultatif) |
| `MAP_STYLE_URL` | Variable de `web`. Adresse du style MapLibre : fonds OpenStreetMap servis par un fournisseur qui en permet l'usage commercial (D-056). Facultative : sans elle, la section Localisation affiche « {ville}, {région} » en texte, sans bouton « Carte » (FIC-061), et le catalogue n'offre pas la vue carte (CAT-090). En local : OpenFreeMap, style « liberty », gratuit et sans clé ; recette et production : fournisseur à choisir (Q-056) |
| `ERROR_TRACKING_DSN` | Suivi des erreurs (facultatif) : un SDK compatible Sentry, vers une instance hébergée par SYMLOOP ou située dans l'Union. Vide : le suivi est coupé, les erreurs restent dans les journaux techniques (ARC-073). |
| `SEED_OWNER_EMAIL`, `SEED_OWNER_FIRST_NAME`, `SEED_OWNER_LAST_NAME` | Adresse, prénom et nom du premier compte Direction (PAR-080) ; obligatoires ensemble pour la commande d'installation |
| `SITE_GATE_PASSWORD` | Mot de passe de la porte d'accès (NAV-064). **Obligatoire hors production** (recette, environnements éphémères). En production : défini tant que le site n'est pas ouvert au public (ENV-054) ; le retirer ouvre le site. Douze caractères au moins. |
| `CLOCK_OFFSET_ALLOWED` | Autorise l'horloge de recette (ENV-032). Interdite en production. |
| `PORT` | Port HTTP de l'API (défaut 4000) |

**Validation, paquet par paquet** (D-097). Le démarrage valide les variables qu'emploie le code **livré** ; une variable dite obligatoire ci-dessus le devient avec le paquet qui l'emploie — `RETENTION_DATABASE_URL` avec la tâche `retention`, `TECH_ALERT_EMAIL` avec les alertes techniques (AUT-076), `MAIL_FROM_ADDRESS`, `MAIL_API_KEY` et `MAIL_WEBHOOK_SECRET` avec le fournisseur d'e-mail, `STORAGE_*` avec le stockage objet, `REDIS_URL` avec Redis, `CLAMAV_*` avec l'antivirus. Au premier code, sont obligatoires : `APP_ENV`, `DATABASE_URL`, `WEB_URL`, `API_URL`, `REVALIDATE_SECRET`, `JWT_SIGNING_KEY`, `IP_HASH_KEY`, `LINK_SIGNING_KEY` (32 caractères au moins pour ces quatre secrets), `ENCRYPTION_KEY` et `ENCRYPTION_KEY_ID` ; `SITE_GATE_PASSWORD` hors local et hors production ; `MAIL_SANDBOX_RECIPIENT` en éphémère et en recette.

**ENV-041** `[P1]` **Environnement local** (D-097). Le poste de développement n'a besoin ni de Docker ni d'un service extérieur :
- **Base** : PostgreSQL 16 embarqué (paquet `embedded-postgres`), données dans `.local/pg` à la racine du dépôt (hors du suivi de version), identifiants lus dans `DATABASE_URL`. `pnpm db:install` crée la grappe et la base, `pnpm db:start` la démarre, `pnpm db:migrate` applique les migrations.
- **Services** : stockage sur le disque (`.local/storage`, ou `STORAGE_LOCAL_ROOT`), médias publics servis par l'API ; e-mails écrits en fichiers `.eml` (`.local/mail`) ; antivirus remplacé par un contrôle qui déclare tout fichier sain et le dit au journal (ARC-060) ; limites de débit et caches en mémoire, tant que Redis n'est pas là (SEC-070, ARC-075) ; boîte d'envoi et tâches planifiées dans le processus de l'API (AUT-084).
- **Commandes** : installation des données de départ, rejouable (PAR-080) : `pnpm --filter @dp/api install:run` ; démonstration (PAR-082) : `pnpm --filter @dp/api demo`, avec `-- --dossier-pour={adresse}` pour donner un dossier de démonstration à un compte client existant, et `pnpm --filter @dp/api demo:remove` pour tout retirer ; exploitation (ENV-060), sans jamais afficher de lien ni de secret : `pnpm ops owner:invite --email … --first-name … --last-name …` (premier compte Direction, tant qu'il n'en existe aucun), `pnpm ops owner:resend-invitation --email …`, `pnpm ops owner:recover --email … [--new-email …] --request {référence de la demande écrite}` (ADM-040), `pnpm ops setting:get --key …` et `pnpm ops setting:set --key … --value {JSON} --reason …` — un paramètre validé par sa déclaration et écrit au journal d'audit, en attendant l'écran des paramètres (EA-90) : c'est ainsi que `features.assistant.mode` passe à `AI` une fois le fournisseur configuré.

## 6. Livraison

**ENV-050** `[P1]` **Chaîne.**
1. Une proposition de modification déclenche les contrôles de QUA-040 et un environnement éphémère.
2. La fusion sur la branche principale construit les images et déploie la **recette**.
3. Une **version étiquetée** se déploie en **production** après une approbation manuelle.

Plate-forme d'intégration, registre d'images et forme des déploiements : valeur par défaut de Q-017, tant que l'hébergeur n'est pas choisi.

**ENV-051** `[P1]` **Déploiement sans coupure.** Les migrations s'appliquent d'abord (FIA-080) ; puis la nouvelle version remplace l'ancienne instance par instance ; une instance n'entre en service que si son contrôle de santé répond (`GET /api/v1/public/health/ready`, API-100) ; les travailleurs terminent leur travail en cours avant de s'arrêter.

**ENV-052** `[P1]` **Retour arrière.** L'application revient à la version précédente en une commande. Le schéma, lui, ne recule pas : c'est pourquoi une migration reste compatible avec la version précédente du code (FIA-080).

**ENV-053** `[P1]` Chaque version a un numéro, une date et la liste de ses changements ; le numéro est visible dans le diagnostic (ADM-080).

**ENV-054** `[P1]` **Une version par livraison** (D-006). Chaque livraison du plan (`08-tracabilite/02`, § 1) est une version étiquetée — 0.2, 0.4, 0.6, 0.8, puis 1.0 — déployée en recette, puis en production après approbation, par la même chaîne (ENV-050). La production existe donc dès la livraison 1 ; chaque livraison y répète le déploiement, et la mise en ligne finale n'est pas un premier essai.

Jusqu'à l'ouverture, la production est **fermée au public** : tant que `SITE_GATE_PASSWORD` y est défini, le site public, l'espace client et leurs routes d'API sont derrière la porte d'accès (NAV-064) et portent `noindex` ; le back-office reste accessible à l'équipe. Pendant cette période, la production suit déjà toutes ses règles : aucune donnée de démonstration (PAR-082), sauvegardes (FIA-090), secrets propres, accès nominatifs (ENV-090). À partir de la livraison 3, l'équipe de Diaspora Patrimoine peut y saisir ses vrais promoteurs, programmes et biens. Aucun vrai client n'y est invité avant l'ouverture : les e-mails qui en partent vont à l'équipe, qui teste avec ses propres adresses.

**Ouvrir** le site, dans cet ordre : (1) fermer la liste technique de ENV-100 et la liste fonctionnelle de PAR-100 ; (2) retirer `SITE_GATE_PASSWORD` ; (3) activer `seo.allowIndexing` — c'est le **dernier** geste, et il ne figure dans aucune des deux listes : il les suppose fermées (ADM-012). L'ouverture a lieu à la livraison 5 (D-085) : c'est elle qui apporte ce sans quoi un site ne s'ouvre pas — l'écran des paramètres et sa carte « Avant la mise en ligne », la publication des textes légaux définitifs, l'exercice des droits sur les données, les essais de durcissement. Une ouverture plus tôt reste possible, mais c'est un **paquet à part** (« Ouverture anticipée », `08-tracabilite/02`, § 3), qui avance ces éléments pour le périmètre déjà livré et se décide avant le début de la livraison concernée (Q-044). Les points de PAR-100 qui portent sur des fonctions non livrées (banques, pièces) sont alors notés d'office « sans objet à cette livraison » (PAR-100).

## 7. Exploitation

**ENV-060** `[P1]` **Guide d'exploitation**, livré avec la recette finale (QUA-090) : déployer une version ; revenir en arrière ; restaurer la base à un instant donné ; restaurer un fichier ; renouveler un secret ; rejouer un événement ou un travail en échec ; mettre le site en maintenance ; traiter une alerte ; confirmer une purge de conservation retenue (PAR-006) ; rétablir un compte Direction qui a perdu l'accès (ADM-040) ; conduire un incident de sécurité (SEC-105).

**ENV-070** `[P1]` **Surveillance et alertes.**

| Surveillé | Alerte quand |
|---|---|
| Disponibilité du site, du back-office, de l'API (sonde externe, chaque minute) | Deux échecs de suite |
| Taux d'erreurs du serveur | Plus de 1 % sur 5 minutes |
| Temps de réponse | Au-delà des objectifs de TRV-132 pendant 10 minutes |
| Files d'attente, boîte d'envoi, tâches planifiées | AUT-076 |
| Base de données | Espace disque à 80 % ; connexions saturées ; réplique en retard |
| Sauvegardes | Une sauvegarde manquée |
| Certificats, nom de domaine | 21 jours avant l'échéance |
| E-mails | Taux de rejet au-delà de 5 % ; réputation du domaine d'envoi dégradée |

Les alertes vont à l'équipe de SYMLOOP (astreinte selon le contrat de maintenance) ; les alertes **métier** vont à l'équipe de Diaspora Patrimoine dans le back-office (TDB-010).

**ENV-071** `[P1]` **Journaux** : centralisés, consultables par identifiant de requête, conservés 6 mois (SEC-110), sans donnée personnelle (ARC-073). **Erreurs** : chaque erreur du serveur et chaque erreur d'écran non prévue est remontée à un outil de suivi, avec la version, sans donnée personnelle.

**ENV-080** `[P1]` **E-mail.** Avant la mise en ligne, le domaine d'expédition est authentifié (SPF, DKIM, DMARC) et vérifié chez le fournisseur ; l'adresse d'expédition et l'adresse de réponse existent et sont lues (NOT-003).

**ENV-090** `[P1]` **Accès à la production.** Réservé à des personnes nommées de SYMLOOP, par des comptes personnels avec double authentification ; aucun compte partagé ; chaque accès à la base ou au stockage est journalisé par l'hébergeur. L'accès aux **données** par le back-office suit ROL-015 et ROL-016.

## 8. Mise en ligne

**ENV-100** `[P1]` **Liste de contrôle technique**, en plus de la liste fonctionnelle de PAR-100 :
- [ ] essai de restauration réussi (FIA-092) ;
- [ ] revue de sécurité faite, défauts graves corrigés (SEC-130) ;
- [ ] essais de charge passés (QUA-080) ;
- [ ] domaine, certificats, authentification de l'e-mail en place (ENV-080) ;
- [ ] alertes branchées et testées (ENV-070) ;
- [ ] secrets de production distincts, jamais utilisés ailleurs ;
- [ ] données de démonstration absentes de la production ;
- [ ] premier compte Direction activé, double authentification en place ;
- [ ] textes légaux **définitifs** publiés, à la place des versions provisoires « 0.1 – projet » (PAR-083) ; bandeau de cookies vérifié ;
- [ ] mentions relues par le conseil juridique : mensualités, simulateurs, transferts hors de l'Union (Q-010, SEC-092) ;
- [ ] `CLOCK_OFFSET_ALLOWED` et `MAIL_SANDBOX_RECIPIENT` absents de la production.

Puis, la liste fermée, dans cet ordre (ENV-054) : SYMLOOP retire `SITE_GATE_PASSWORD` par un déploiement ; la Direction active `seo.allowIndexing` (ADM-012) ; SYMLOOP soumet le plan du site aux outils pour webmestres des moteurs de recherche. Ces comptes sont ouverts au nom de Diaspora Patrimoine et vérifiés sur son domaine (Q-023) ; SYMLOOP y est ajouté comme utilisateur.

**ENV-101** `[P1]` **Maintenance.** Une opération qui coupe le service est annoncée 48 heures avant à Diaspora Patrimoine, faite hors des heures de travail (CAL-060), avec la page de maintenance (NAV-061) et l'heure de retour prévue.

**ENV-110** `[MOB]` **Application mobile** : comptes des magasins au nom de Diaspora Patrimoine ; une voie d'essai interne par plate-forme ; chaque version passe la recette avant d'être proposée au public ; la version minimale acceptée par l'API est relevée quand une version devient incompatible (MOB-040).
