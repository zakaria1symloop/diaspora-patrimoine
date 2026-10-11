# Application mobile

`[MOB]` — hors du contrat de Phase 1. Application **Flutter** (D-001), pour iOS et Android, destinée au **client**. Le personnel continue de travailler dans le back-office, sur ordinateur ; seul l'écran de pointage d'un Café est pensé pour le téléphone, et c'est une page web (EVT-050).

Toutes les règles portent l'étiquette `[MOB]`.

---

## 1. Périmètre

**MOB-001** L'application reprend, **avec les mêmes règles**, ce que le client fait sur le web. Aucune règle métier n'est propre au mobile : tout passe par la même API (`06-technique/02`).

| Zone | Écrans web repris | Fichier |
|---|---|---|
| Découvrir | Accueil (version courte), catalogue, filtres, fiche d'un bien et d'un programme, galerie, visite 360° | `02-site-public/02` à `04` |
| Demander | Intérêt, rappel, projection | `02-site-public/05` |
| Simuler | Éligibilité, crédit | `02-site-public/06` |
| Le Café | Dates, inscription, mon billet (code et QR code) | `02-site-public/07` |
| Mon espace | Tableau de bord, suivi, biens proposés, pièces, financement, rendez-vous, messages, notifications, favoris, alertes, simulations, profil | `03-espace-client/` |

Restent sur le web : les pages éditoriales longues (ouvertes dans une vue web interne), les pages légales, l'export des données personnelles.

**MOB-002** **Navigation** : cinq onglets — Accueil · Biens · Mon dossier · Messages · Profil. Un visiteur non connecté a accès à Accueil et Biens ; les autres onglets proposent de se connecter ou de créer son espace.

## 2. Ce que le téléphone apporte

**MOB-010** **Notifications push** (NOT-034). Demandées **au bon moment** : jamais au premier lancement ; après une première action qui le justifie (envoi d'une demande, dépôt d'une pièce), avec un écran qui explique à quoi elles servent. Refus : l'application fonctionne ; le réglage reste accessible dans le profil. Un appareil est enregistré à la connexion (`PushDevice`) et retiré à la déconnexion.

**MOB-011** Le texte d'une notification push ne contient **ni montant, ni nom de banque, ni contenu de message** : « Du nouveau dans votre dossier. », « {conseiller} vous a écrit. ». Toucher la notification ouvre l'écran concerné.

**MOB-012** **Numériser une pièce.** « Prendre une photo » ouvre un appareil photo guidé : détection des bords du document, redressement, amélioration du contraste, plusieurs pages à la suite, puis assemblage en **un PDF**. Le client vérifie chaque page, peut la reprendre, puis envoie. Les contrôles de DOS-011 s'appliquent.

**MOB-013** **Déverrouillage biométrique.** Après la première connexion, le client peut activer l'empreinte ou le visage pour rouvrir l'application. L'activer ne remplace pas le mot de passe : il reste demandé pour changer d'adresse e-mail, de mot de passe, pour exporter ou supprimer le compte.

**MOB-014** **Liens.** Un lien d'e-mail (pièces à fournir, nouveau message, proposition) ouvre l'application sur le bon écran si elle est installée, le site sinon (liens universels). Un lien à jeton (activation, mot de passe) fonctionne dans les deux cas.

**MOB-015** **Billet d'un Café** : le code d'accueil et son QR code sont consultables **hors connexion**, une fois chargés.

## 3. Compte et session

**MOB-020** Mêmes parcours que `03-espace-client/01`. Session d'audience `MOBILE` : 90 jours, prolongée à chaque usage ; le jeton de renouvellement est gardé dans le stockage sécurisé du système. Se déconnecter le détruit et retire l'appareil des notifications. « Appareils connectés » (PRO-021) liste aussi les téléphones.

**MOB-021** **Suppression du compte** : accessible dans l'application (PRO-060), comme l'exigent les magasins d'applications.

## 4. Hors connexion et réseau faible

**MOB-030** L'application garde en cache, pour lecture hors connexion : le tableau de bord, le suivi du dossier, la liste des pièces et leur statut, les derniers messages, les favoris, les billets des Cafés. Un bandeau l'indique : « Hors connexion : dernière mise à jour à {heure}. ».

**MOB-031** **Rien ne s'envoie hors connexion**, mais rien ne se perd : un message ou une demande rédigés sans réseau restent en brouillon, avec « À envoyer » ; l'envoi reprend au retour du réseau si l'application est ouverte. Un dépôt de pièce interrompu reprend là où il s'était arrêté ; s'il ne peut pas reprendre, le client est invité à recommencer, ses fichiers encore à l'écran.

## 5. Qualité

**MOB-040** **Versions.** L'API annonce la version minimale acceptée. Une application trop ancienne affiche « Mettez à jour l'application pour continuer. » avec le lien vers le magasin ; une version simplement ancienne affiche un rappel qu'on peut fermer.

**MOB-041** **Accessibilité** : TRV-120 et TRV-121, avec les lecteurs d'écran des deux systèmes, les tailles de police du système, les zones tactiles de 44 points.

**MOB-042** **Langues** : français ; l'application est prête pour l'arabe (écriture de droite à gauche) et l'anglais (TRV-003).

**MOB-043** **Mesure d'audience** : mêmes événements que NAV-052, après consentement ; sur iOS, la demande d'autorisation de suivi n'est pas présentée, parce qu'aucun suivi entre applications n'est fait.

**MOB-044** **Sécurité** : aucune donnée personnelle dans les journaux de l'appareil ; l'aperçu de l'application dans le sélecteur de tâches est masqué sur les écrans de pièces et de financement ; le cache local est chiffré et vidé à la déconnexion.

## 6. Ce que la Phase 1 prépare déjà

**MOB-050** `SessionAudience.MOBILE` ; la table `PushDevice` ; `NotificationPreference.pushEnabled` ; `LeadSource.MOBILE_APP` ; `DocumentVersion.uploadedVia = MOBILE` ; une API unique et versionnée, qui ne suppose jamais un navigateur ; des fichiers de traduction partagés.
