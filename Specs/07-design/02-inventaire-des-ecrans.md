# Inventaire des écrans

La liste de **tous les écrans** de la plateforme, avec, pour chacun, les variantes et les états à maquetter, et la **livraison** qui le met en service. C'est le plan de travail du fichier Figma et la table de correspondance entre une maquette et ses règles.

Périmètre de maquettage demandé le 1er octobre 2026 : le **côté client** (site public et espace client) et le **back-office**. Les portails et l'application mobile ne sont pas maquettés à ce stade ; les pages de réponse par lien des promoteurs et des banques (niveau 2 d'accès, `00-cadre/06`) non plus : elles reprendront le gabarit de EP-28 et les fenêtres du back-office, le moment venu.

Identifiants : `EP` site public · `EC` espace client · `EA` back-office · `EM` e-mails.

Colonne « Livr. » : la livraison du plan (`08-tracabilite/02`, § 1) où l'écran devient utilisable — L1 à L5. Deux livraisons séparées par une barre : l'écran arrive en deux temps (ce qui vient d'abord est précisé). « Arb. » (plus employé depuis D-089) : élément autrefois `[P1]` (`00-cadre/01`, § 6).

---

## 1. Organisation du fichier Figma

Fichier « Diaspora Patrimoine — Design » (`H7XVzqkkeUViNnecDdCrdG`).

| Page · section de famille | Écrans |
|---|---|
| `Couverture` | Le plan du fichier, l'**index de tous les écrans** (une ligne par ligne de cet inventaire, avec sa page, sa livraison, son état et un lien vers sa section), la légende des états, les livraisons, les règles du fichier. |
| `Fondations` | Couleurs, typographie, espaces, rayons, traits, ombres, icônes et drapeaux, photos, mouvement (`01-systeme-de-design.md`, § 2 à 5 et § 7). |
| `Composants` | La bibliothèque (DSN-050), rangée par familles, et les gabarits des écrans : menus et barres du haut du back-office et de l'espace client. |
| `———  ÉCRANS  ———` | Séparateur. |
| `Site public` · Parcours | Les scénarios du visiteur, écran par écran (pas d'écran propre). |
| `Site public` · Accueil | EP-01. |
| `Site public` · Recherche | EP-02, EP-03, EP-31. |
| `Site public` · Programmes et biens | EP-04 à EP-07. |
| `Site public` · Financement | EP-10 à EP-12, EP-20, EP-21. |
| `Site public` · Promoteurs et partenaires | EP-08, EP-09, EP-17, EP-23, EP-32, EP-33. |
| `Site public` · Le Café | EP-13 à EP-15. |
| `Site public` · Découvrir et contact | EP-16, EP-18, EP-19, EP-22, EP-24. |
| `Site public` · Liens reçus par e-mail | EP-25 à EP-27. |
| `Site public` · Système | EP-29, EP-30. |
| `Site public` · E-mails | EM-01. |
| `Espace client` · Compte | EC-01 à EC-09. |
| `Espace client` · Suivi et dossier | EC-10, EC-11, EC-20 à EC-22. |
| `Espace client` · Biens et rendez-vous | EC-12 à EC-14. |
| `Espace client` · Messages | EC-30, EC-31. |
| `Espace client` · Outils et profil | EC-40 à EC-43, EC-50 à EC-54. |
| `Back-office` · Socle et pilotage | EA-00 à EA-09, EA-104 à EA-106. |
| `Back-office` · Demandes et clients | EA-10 à EA-13. |
| `Back-office` · Dossiers | EA-20 à EA-22. |
| `Back-office` · Catalogue et partenaires | EA-40 à EA-47, EA-50 à EA-54. |
| `Back-office` · Financement et pièces | EA-55 à EA-64. |
| `Back-office` · Communication et organisation | EA-30, EA-31, EA-70 à EA-76. |
| `Back-office` · Café, satisfaction, contenus | EA-80 à EA-82, EA-85, EA-86, EA-90 à EA-95. |
| `Back-office` · Administration | EA-96 à EA-103. |
| `Espace promoteur` | Phase 2 (niveaux 2 et 3 d'accès, `00-cadre/06`) : rien en Phase 1, où l'équipe fait tout. |
| `Espace banque` · Téléchargement du dossier | EP-28 — la seule page qu'une banque voit en Phase 1 ; la réponse par lien et le portail viennent avec la Phase 3. |
| `———  ARCHIVE  ———` | Séparateur. |
| `Maquette validée (01/10/2026)` | La maquette d'accueil telle que Mme Mouhoubi l'a validée, conservée sans modification pour mémoire. La version de travail est dans `Site public` · Accueil. |

**Règles de tenue.**
- **Une page par espace** (7 octobre 2026) : site public, espace client, back-office, espace promoteur, espace banque. Dans une page : une **section par famille** (tableau ci-dessus), et dedans **une section par ligne de cet inventaire**, nommée par sa première colonne et son nom (« EC-10 · Tableau de bord », « EA-40, EA-41 · Programmes, un programme »). La section existe dès que la ligne existe : tant que l'écran n'est pas dessiné, elle porte son étiquette « À maquetter » et la liste des variantes. Dans une page, **chaque famille est une rangée** : ses écrans se suivent de gauche à droite dans l'ordre de l'inventaire, et les variantes d'un écran se rangent dans sa section en grille de trois par rangée (le 1 440 d'abord, puis le 390) ; les **scénarios** (enchaînement d'écrans d'un parcours) se rangent dans une section « Scénarios » de la page.
- Chaque page commence, à gauche, par son **sommaire** : ses écrans par famille — identifiant (lien vers la section), nom, livraison, phase, état. La Couverture porte l'**index** de tous les écrans.
- **Synchronisation** : `Specs/_outils/inventaire_figma.py` lit cet inventaire, écrit `Design/inventaire-ecrans.json` et prépare dans `Design/sync/` les scripts qui recréent le sommaire de chaque page et l'index de la Couverture à partir des sections et de l'état de leurs étiquettes. À relancer après tout changement de l'inventaire ou toute séance de maquettes ; une ligne ajoutée ici reçoit sa section à la séance suivante.
- Au-dessus de chaque cadre, une **étiquette** : identifiant, nom, format, état — « À maquetter », « En cours », « À valider », « Validé le … ».
- Nommage des calques : DSN-101.
- Un écran dessiné est « À valider » ; validé, son étiquette passe à « Validé le … », et les éléments dessinés en place deviennent des composants (DSN-052). La page `Draft` (3 octobre 2026) a été retirée le 7 octobre 2026 : ses onze écrans, validés par la cliente, ont rejoint leurs pages.
- Les anciennes propositions (Le Pont, L'Adresse, pastel, propositions A à H) ont été retirées du fichier le 1er octobre 2026 ; elles restent dans son historique des versions et dans `Design/archive/`.

**Formats.** Site public et espace client : **390 px** et **1 440 px**. Back-office : **1 440 px** (utilisable dès 1 280). Pointage d'un Café (EA-82) : 390 px.

## 2. Site public

| # | Écran | Adresse | Variantes et états à maquetter | Specs | Phase | Livr. |
|---|---|---|---|---|---|---|
| EP-01 | Accueil | `/` | **Validé en 1 440.** À faire : 390 ; replis (sans Café, sans projection, sans financement islamique, moins de trois biens, biens tous réservés) ; en-tête compact ; menu mobile ouvert ; visiteur connecté. | `02/02`, `02/01` | P1 | L2 |
| EP-02 | Catalogue | `/programmes` | Résultats · vue sur carte · groupé par programme · bac de comparaison · « Enregistrer cette recherche » · filtres actifs en pastilles · menu de tri ouvert · liste « Ville » ouverte · aucun résultat (avec alerte et suggestions) · catalogue vide · chargement. | `02/03` | P1 | L2 |
| EP-03 | Filtres | `?filtres=1` | Panneau à droite, résultats à côté (1 440) · plein écran (390) · avec sélections · budget estimé · aucun bien. | `02/03` | P1 | L2 |
| EP-31 | Comparateur | `/comparer` | Deux et trois biens · seulement les différences · bien devenu indisponible · bac de comparaison (sur le catalogue et la fiche) · 390 (deux colonnes, défilement). | `02/03` | P1 | L2 |
| EP-04 | Fiche programme | `/programmes/{slug}` | Complète · à venir (rien encore en vente) · tout est réservé · vendu · retiré · barre d'action. | `02/04` | P1 | L2 |
| EP-05 | Fiche bien | `/biens/{slug}` | Complète · sans visite 360° · images 3D · sans photo · réservé · vendu · client connecté (bien proposé, intérêt déjà envoyé) · barre fixe (390). | `02/04` | P1 | L2 |
| EP-06 | Galerie plein écran | `?galerie=…` | Photos · plans · visite 360° · vidéo · visite 360° absente. | `02/04` | P1 | L2 |
| EP-07 | Formulaire d'intérêt | `?interet=1` | Vide · erreurs · client connecté · depuis un programme (avec et sans bien publié) · confirmation (avec le jour de rappel choisi ; avec « créer mon espace ») · bien devenu indisponible pendant la saisie · défi anti-robots. | `02/05` | P1 | L2 |
| EP-08 | Promoteurs | `/promoteurs` | Liste · vide. | `02/08` | P1 | L2 |
| EP-09 | Fiche promoteur | `/promoteurs/{slug}` | — | `02/08` | P1 | L2 |
| EP-10 | Financements | `/financements` | Calcul express (curseurs, budget qui change) · onglet crédit classique · onglet financement islamique, « En savoir plus » déplié · sans financement islamique · frise du parcours, pièces dépliées · sans banque publique · 390 (frise verticale). | `02/08` | P1 | L2 |
| EP-11 | Simulateur d'éligibilité | `/financements/simulateur-eligibilite` | Étapes 1, 2, 3 · résultat favorable · avec ajustement · avec ajustement faute d'apport (sans budget) · sans solution standard · barème indicatif · mention des frais · demande de rappel dépliée. | `02/06` | P1 | L2 |
| EP-12 | Simulateur de crédit | `/financements/simulateur-credit` | Résultat · échéancier déplié · trois scénarios · avertissements · rien à financer · depuis une fiche. | `02/06` | P1 | L2 |
| EP-13 | Le Café | `/le-cafe` | Avec dates · sans date. | `02/07` | P1 | L5 |
| EP-14 | Un Café | `/le-cafe/{slug}` | Ouvert · complet · à venir · clos · annulé · passé · « plus assez de places » · confirmation · liste d'attente. | `02/07` | P1 | L5 |
| EP-15 | Gérer mon inscription | `/le-cafe/inscription/{jeton}` | Inscrit · en attente · annulé · passé. | `02/07` | P1 | L5 |
| EP-16 | Notre concept | `/notre-concept` | — | `02/08` | P1 | L2 |
| EP-17 | Nos partenaires | `/nos-partenaires` | — | `02/08` | P1 | L2 |
| EP-18 | Questions fréquentes | `/faq` | Liste · recherche sans résultat. | `02/08` | P1 | L2 |
| EP-19 | Contact | `/contact` | Vide · objet « Être rappelé » (jour et moment, depuis une fiche) · confirmation. | `02/08`, `02/05` | P1 | L2 |
| EP-20 | Projection | `/projection` | Premier écran · second écran · confirmation ; scène illustrée « Projection » (DSN-076). | `02/05` | P1 | L2 |
| EP-21 | Être rappelé | `?rappel=1` | Fenêtre · confirmation. | `02/05` | P1 | L2 |
| EP-22 | Assistant de recherche | `/assistant` | Conversation libre (critères compris, biens, dictée, « Réponse générée automatiquement », passage de main à un conseiller, conversation trop longue) · mode guidé : une question · résultat · aucun résultat. | `02/09` | P1 | L2 |
| EP-23 | Devenir partenaire | `/devenir-partenaire` | Formulaire des notaires, assureurs, institutions et médias, avec le renvoi des promoteurs et banques vers EP-32 · confirmation ; scène illustrée « Partenaire » (DSN-076). | `02/05` | P1 | L2 |
| EP-32 | Inscription partenaire | `/partenaires/inscription` | Étape 1 (promoteur ou banque) · étape 2 (société et personne, charte) · erreurs · « Vérifiez votre boîte e-mail » · 390 ; scène illustrée « Partenaire » (DSN-076). | `00/06` | P1 | L2 |
| EP-33 | Espace partenaire : connexion et candidature | `/partenaires/connexion` | Connexion · mot de passe oublié · adresse non vérifiée · dossier à compléter (promoteur ; banque ; une rubrique ouverte ; prêt à envoyer) · candidature en cours d'examen · complément demandé · acceptée (« Votre espace partenaire ») · refusée · 390 ; scène illustrée « Partenaire » (DSN-076). | `00/06` | P1 | L2 |
| EP-24 | Page légale, page libre | `/mentions-legales`… | Texte publié · version provisoire (bandeau). | `02/08` | P1 | L2 |
| EP-25 | Enquête | `/enquete/{jeton}` | Questionnaire · merci · déjà répondu · terminée. | `03/07` | P1 | L5 |
| EP-26 | Alerte | `/alertes/{jeton}` | Activée · prolongée · gestion · lien expiré. | `03/06` | P1 | L3 |
| EP-27 | Préférences d'e-mail | `/preferences/{jeton}` | Liste · désinscription faite. | `03/07` | P1 | L3 |
| EP-28 | Téléchargement sécurisé | `/partage/{jeton}` | Saisie du code · code faux · contenu (dossier d'une banque ; données d'une personne) · verrouillé · lien expiré. | `04/05` | P1 | L4 |
| EP-29 | Pages d'erreur et d'attente | — | **Page d'attente avant l'ouverture (NAV-064)** · sa saisie du mot de passe, à partir de la livraison 2 · `404` · `410` · `500` · maintenance · `403`. | `00/04`, `02/01` | P1 | L1 (attente) / L2 |
| EP-30 | Cookies | — | Bandeau · fenêtre « Personnaliser ». | `02/01` | P1 | L2 |
| EM-01 | E-mails | — | L'habillage commun, et trois exemples : accusé de réception, pièces à fournir, inscription à un Café. | `01/09` | P1 | L1 (habillage) / L2 |

## 3. Espace client

| # | Écran | Adresse | Variantes et états à maquetter | Specs | Phase | Livr. |
|---|---|---|---|---|---|---|
| EC-01 | Connexion | `/connexion` | Vide · erreur · verrou · compte suspendu. | `03/01` | P1 | L2 |
| EC-02 | Inscription | `/inscription` | Vide · erreurs · « Vérifiez votre boîte ». | `03/01` | P1 | L2 |
| EC-03 | Vérification de l'adresse | `/verification` · `/nouvelle-adresse/{jeton}` | Attente · lien expiré · « Ce n'est pas moi » fait · nouvelle adresse confirmée · regroupement en attente · adresse déjà utilisée. | `03/01` | P1 | L2 |
| EC-04 | Mot de passe oublié | `/mot-de-passe-oublie` | Formulaire · message envoyé. | `03/01` | P1 | L2 |
| EC-05 | Nouveau mot de passe | `/reinitialisation/{jeton}` | Formulaire · lien expiré. | `03/01` | P1 | L2 |
| EC-06 | Activation | `/activation/{jeton}` | Formulaire · lien expiré. | `03/01` | P1 | L2 |
| EC-07 | Connexion par lien | `/connexion/lien` | Formulaire · message envoyé. | `03/01` | P1 | L2 |
| EC-08 | Code de double authentification | — | Code · code de secours. | `03/01` | P1 | L2 |
| EC-09 | Nouvelles conditions | — | — | `03/01` | P1 | L2 |
| EC-10 | Tableau de bord | `/espace-client` | Compte sans demande · demande envoyée · dossier en cours · pièces à fournir · accord de transmission à donner · en pause · clôturé · abouti · adresse e-mail en erreur (bandeau) · aperçu en lecture seule par l'équipe (bandeau) · gabarit de l'espace (menu, cloche, « Écrire à mon conseiller »). | `03/02`, `03/05` | P1 | L2 |
| EC-11 | Mon dossier : suivi, mon bien | `/espace-client/dossiers/{référence}` | Onglet Suivi · onglet Mon bien (lot envisagé, option demandée au promoteur, option, réservation, acompte à suivre, bien hors ligne) · sans financement · plusieurs dossiers. | `03/02` | P1 | L2 (Suivi) / L3 (Mon bien : bien retenu) / L4 (réservation, acompte, jalons) |
| EC-12 | Mes intérêts | `/espace-client/interets` | Liste · vide · fenêtre « Je retiens ce bien ». | `03/03` | P1 | L2 / L3 (« Je retiens ce bien ») |
| EC-13 | Biens proposés | `/espace-client/biens-proposes` | Liste · réponse « ne me convient pas » · vide · bien indisponible. | `03/03` | P1 | L2 (vide) / L3 |
| EC-14 | Rendez-vous | `/espace-client/rendez-vous` | Liste · demande · vide. | `03/03` | P1 | L3 |
| EC-20 | Mes pièces | `…/pieces` | Liste groupée (tous les statuts, dont « En préparation par nos soins ») · pièce à renouveler · accord de transmission · bloc « Qui emprunte ? » avec co-emprunteur · information manquante · dossier complet. | `03/04` | P1 | L2 (écran) / L4 (vrais dossiers, emprunteurs) |
| EC-21 | Déposer une pièce | — | Choix des fichiers · envoi en cours · erreur de fichier · prise de photo (390), photos réunies en un document · fichier refusé par le contrôle de sécurité. | `03/04` | P1 | L2 / L4 |
| EC-22 | Financement | `…/financement` | Aucune soumission · en étude · complément demandé · accordé (offre, souhait d'accepter transmis, offre mise à jour) · offre expirée · sans suite. | `03/04` | P1 | L4 |
| EC-30 | Messages | `/espace-client/messages` | Fil · liste de fils · vide · pièce jointe · hors horaires. | `03/05` | P1 | L5 |
| EC-31 | Notifications | `/espace-client/notifications` | Cloche ouverte · page · vide. | `03/05` | P1 | L5 |
| EC-40 | Mes simulations | `/espace-client/simulations` | Liste · détail · vide. | `03/06` | P1 | L2 |
| EC-41 | Favoris | `/espace-client/favoris` | Liste · vide. | `03/06` | P1 | L3 |
| EC-42 | Alertes | `/espace-client/alertes` | Liste · vide. | `03/06` | P1 | L3 |
| EC-43 | Mes Cafés | `/espace-client/cafes` | À venir (billet) · passés. | `03/06` | P1 | L5 |
| EC-50 | Profil | `/espace-client/profil` | Cinq sections · personnes de confiance. | `03/07` | P1 | L2 |
| EC-51 | Sécurité | `…/profil/securite` | Mot de passe · activation de la double authentification (4 étapes) · appareils. | `03/07` | P1 | L2 |
| EC-52 | Notifications | `…/profil/notifications` | — | `03/07` | P1 | L5 |
| EC-53 | Confidentialité | `…/profil/confidentialite` | Mes données · mes accords · suppression du compte. | `03/07` | P1 | L2 (accords) / L5 |
| EC-54 | Avis | `/espace-client/avis` | Enquêtes en attente · avis spontané · envoyé. | `03/07` | P1 | L5 |

## 4. Back-office

| # | Écran | Variantes et états à maquetter | Specs | Phase | Livr. |
|---|---|---|---|---|---|
| EA-00 | Connexion | Mot de passe · code · première connexion (mot de passe, double authentification, charte). | `04/01` | P1 | L1 |
| EA-01 | Tableau de bord | Conseiller · administrateur · « Avant la mise en ligne ». | `04/02` | P1 | L5 |
| EA-02 | Rapport « Activité commerciale » | Un gabarit de rapport (tuiles, graphique, tableau), détaillé ici. | `04/02` | P1 | L5 |
| EA-03 à EA-05 | Rapports « Demandes et origines », « Dossiers », « Financement » | Sur le gabarit de EA-02. | `04/02` | P1 | L5 |
| EA-06, EA-07 | Rapports « Catalogue », « Satisfaction » | Sur le gabarit de EA-02 ; EA-07 détaillé. | `04/02` | P1 | L5 |
| EA-08 | Rapport « Cafés » | Sur le gabarit de EA-02. | `04/02` | P1 | L5 |
| EA-09 | Rapport « Équipe » | Sur le gabarit de EA-02. | `04/02` | P1 | L5 |
| EA-10 | Demandes | Liste · vues · filtres ouverts · actions groupées. | `04/03` | P1 | L2 (lecture) / L3 |
| EA-11 | Une demande | Nouvelle · prise en charge · avec alertes (doublon, informations différentes) · indésirable · fenêtre « Noter un appel » · fenêtre « Clôturer ». | `04/03` | P1 | L2 (lecture) / L3 |
| EA-12 | Clients | Liste · création (adresse déjà connue). | `04/03` | P1 | L3 |
| EA-13 | Fiche d'un client | Aperçu (bandeaux : sans e-mail, e-mail rejeté, téléphone à vérifier, traitement limité) · projet et finances · compte · accords · fusion de deux fiches. | `04/03` | P1 | L3 |
| EA-20 | Pipeline | Sept colonnes · carte en retard, en pause · refus d'un déplacement (ce qui manque) · filtres. | `04/06` | P1 | L4 |
| EA-21 | Tous les dossiers | Liste. | `04/06` | P1 | L3 |
| EA-22 | Un dossier | Aperçu (bandeaux : en pause, lot visé perdu, bien hors ligne, acompte à suivre) · Biens (et « Proposer des biens ») · Pièces · Financement · Réservation et acquisition (option à confirmer par le promoteur : tient le lot, refuse ; prolonger ; issue de l'acompte) · Emprunteurs (avec ou sans financement) · Échanges · Tâches · Historique · fenêtres : qualifier, mettre en pause (ce qui court), clôturer, rouvrir, clôturer comme abouti. | `04/06` | P1 | L3 (Aperçu, Biens, Échanges : chronologie et ajout rapide, Tâches, Historique, pause et clôture) / L4 (Pièces, Financement, Réservation, Emprunteurs) / L5 (Échanges : fil de messagerie) |
| EA-30 | Tâches | Liste groupée · création. | `04/09` | P1 | L3 |
| EA-31 | Agenda | Semaine · création d'un rendez-vous · confirmation d'une demande. | `04/09` | P1 | L3 |
| EA-40, EA-41 | Programmes, un programme | Liste · Informations · Biens · Lots (disponibilités vérifiées le… ; à vérifier) · publication refusée · modification refusée (biens en ligne concernés) · Financement. | `04/04` | P1 | L3 / L4 (Financement) |
| EA-42, EA-43 | Biens, un bien | Liste · Informations avec la carte de complétude (brouillon, publiable, complète) · Lots (corriger une vente) · dépubliée par suspension · archivée (désarchiver) · Financement. | `04/04` | P1 | L3 / L4 (Financement) |
| EA-44 | Médias | Grille · dépôt en cours · échec · détail d'un média. | `04/04` | P1 | L3 |
| EA-45 | Import de lots | Dépôt · correspondance · contrôle à blanc · résultat. | `04/04` | P1 | L3 |
| EA-46 | Mise en avant sur l'accueil | Trois cartes · épinglé hors ligne. | `04/04` | P1 | L3 |
| EA-47 | Autres partenaires | Liste · formulaire. | `04/04` | P1 | L3 |
| EA-50, EA-51 | Promoteurs, un promoteur | Liste · Identité · Sélection · Relation (bloc « Ce que nous attendons de lui » : rempli, vide) · suspension · republier les fiches dépubliées. | `04/04`, `00/06` | P1 | L3 |
| EA-52, EA-53 | Banques, une banque | Liste (vue « Tous les produits ») · Identité · Produits · Soumissions (bloc « Ce que nous attendons d'elle »). | `04/05`, `00/06` | P1 | L4 |
| EA-54 | Un produit bancaire | Formulaire avec « Essayer le barème » · barème vérifié le… ; à vérifier. | `04/05` | P1 | L4 |
| EA-55, EA-56 | Soumissions, une soumission | Liste · Préparation · Transmission · Suivi · Décision (accord, refus, corriger, annuler, prolonger). | `04/05` | P1 | L4 |
| EA-57 | Taux de change | Liste · saisie (avertissement d'écart) · historique · annuler un cours. | `04/05` | P1 | L4 |
| EA-58 | Financement de référence | — | `04/05` | P1 | L2 |
| EA-59 | Projection | Les cinq étapes · aperçu du PDF. | `04/05` | P1 | L4 |
| EA-60 | Pièces à vérifier | Liste par dossier. | `04/07` | P1 | L4 |
| EA-61, EA-62 | Modèles de listes, un modèle | Liste · lignes · aperçu pour un profil. | `04/07` | P1 | L4 |
| EA-63 | Visionneuse | Validation · rejet · versions. | `04/07` | P1 | L4 |
| EA-64 | Recherche de pièces | — | `04/07` | P1 | L4 |
| EA-70 | Messagerie | Liste · fil · client sans espace. | `04/08` | P1 | L5 |
| EA-71 | Journal des envois | Liste · détail. | `04/08` | P1 | L5 |
| EA-72, EA-73 | Modèles d'e-mail, éditeur | Liste · éditeur · aperçu · versions. | `04/08` | P1 | L5 |
| EA-74, EA-75 | Automatisations, une règle | Liste · règle · essai · journal. | `04/08` | P1 | L5 |
| EA-76 | Envoi groupé | Destinataires · message · résultat. | `04/08` | P1 | L5 |
| EA-80, EA-81 | Cafés, un Café | Liste · Informations · Participants · Inscriptions · Communications · Bilan. | `04/10` | P1 | L5 |
| EA-82 | Pointage | 390 px : recherche · fiche d'un inscrit · déjà pointé · ajout d'un participant. | `04/10` | P1 | L5 |
| EA-85 | Retours | Liste · détail · traitement. | `04/11` | P1 | L5 |
| EA-86 | Enquêtes | Liste · édition · invitations. | `04/11` | P1 | L5 |
| EA-90 | Textes du site | Liste par page · bloc simple · bloc composé · historique · onglet « Images ». | `04/12` | P1 | L5 |
| EA-91 à EA-95 | Pages, questions fréquentes, témoignages, textes légaux, redirections | Un gabarit de liste et un gabarit d'édition ; EA-91 : vue « Référencement » ; EA-94 (versions) détaillé. | `04/12` | P1 | L5 |
| EA-96 | Équipe | Liste · invitation (renvoyer, annuler) · changer le rôle · suspendre · suppression avec réaffectation. | `04/13` | P1 | L1 (liste, invitation, rôle, fonction, suspension, double authentification) / L3 (« Reçoit des demandes », absence) / L5 (suppression, réaffectation, changement d'adresse) |
| EA-97 | Paramètres | Un groupe · paramètre sensible · changement à effet large (annonce chiffrée) · fonctionnalités · « Avant la mise en ligne ». | `04/13` | P1 | L5 |
| EA-98 | Référentiels | — | `04/13` | P1 | L5 |
| EA-99 | Journal d'audit | Liste · détail avant et après. | `04/13` | P1 | L5 |
| EA-100 | Données personnelles | Liste · recherche d'une personne · limitation · effacement (ce qui reste, selon le cas). | `04/13` | P1 | L5 |
| EA-101 | Corbeille | — | `04/13` | P1 | L5 |
| EA-102 | Diagnostic | Santé · tâches planifiées (lancer maintenant) · horloge de recette · purge en attente de confirmation. | `04/13` | P1 | L1 (minimal) / L5 |
| EA-103 | Imports et exports | — | `04/13` | P1 | L5 |
| EA-104 | Mes préférences | Profil · Sécurité · Signature · Absence · Notifications. | `04/01` | P1 | L1 (Profil, Sécurité) / L3 (Signature, Absence) / L5 (Notifications) |
| EA-105 | Notifications | Cloche ouverte · page. | `04/01` | P1 | L3 (dont « une opération, une notification », NOT-035) / L5 (regroupement par compteur NOT-016, préférences) |
| EA-106 | Recherche globale | Résultats groupés · aucun résultat. | `04/01` | P1 | L3 |

## 5. Ordre de maquettage : livraison par livraison

Les maquettes ne sont pas toutes dessinées d'avance. Celles d'une livraison sont dessinées et validées **juste avant** son développement (D-006) : la cliente valide de petits ensembles, et un choix fait sur les premiers écrans profite aux suivants. L'ordre se réordonne librement à l'intérieur d'une livraison.

| Vague | Écrans | Pour |
|---|---|---|
| 0 — fait | Fondations, composants, EP-01 en 1 440 | Tout le reste en dépend. |
| L1 | EA-00 · gabarit du back-office (menu, barre du haut, liste, fiche) avec EA-96 · EA-104 (Profil, Sécurité) · EA-102 (minimal) · EP-29 (page d'attente) · EM-01 (habillage des e-mails) | Le socle en ligne. |
| L2 | EP-01 en 390 et ses états · EP-02, EP-03 · EP-05, EP-06, EP-07 · EP-04 · EP-11, EP-12 · EP-10, EP-08, EP-09, EP-16 à EP-19, EP-24, EP-29, EP-30 · EP-20 à EP-23 · EP-32, EP-33 · EP-31 · EA-58 · EC-01 à EC-09 · gabarit de l'espace client avec EC-10 · EC-11 (Suivi), EC-12, EC-13 · EC-20, EC-21 · EC-40, EC-50, EC-51, EC-53 · EM-01 (les e-mails de la livraison) · EA-10, EA-11 en lecture | Le site et l'espace client. D'abord le chemin de conversion : chercher, voir, demander. |
| L3 | EA-10, EA-11 complets · EA-12, EA-13 · EA-50, EA-51 · EA-40 à EA-47 · EA-21, EA-22 (Aperçu, Biens, Échanges, Tâches, Historique) · EA-30, EA-31 · EA-96 (« Reçoit des demandes », absence) · EA-104 à EA-106 · EC-12 (« Je retiens ce bien »), EC-13 (biens proposés par l'équipe), EC-14 · EC-11 (Mon bien) · EP-27 · EP-26, EC-41, EC-42 | Le quotidien commercial de l'équipe. |
| L4 | EA-61, EA-62 · EA-60, EA-63, EA-64 · EA-20 · EA-22 (Pièces, Financement, Réservation, Emprunteurs) · EA-52 à EA-57 · EA-40 à EA-43 (onglet Financement) · EC-20, EC-21 (vrais dossiers, emprunteurs) · EC-22, EC-11 (réservation, acompte, jalons) · EP-28 · EA-59 | Dossiers, pièces, banques. |
| L5 | EC-30, EC-31, EC-52 · EA-70 à EA-76 · EA-22 (Échanges : messagerie) · EA-104 (Notifications), EA-105 (regroupement par compteur) · EA-01 à EA-09 · EA-85, EA-86, EC-54, EP-25 · EA-90 à EA-95 · EA-96 à EA-103 · EC-53 (données, suppression) · EP-13 à EP-15, EC-43, EA-08, EA-80 à EA-82 (Le Café) | Communication, pilotage, administration. |

## 6. États communs à maquetter une fois

Ils valent pour tous les écrans (TRV-080 à TRV-084) : chargement (squelettes) · vide · erreur d'un bloc · hors connexion · session expirée (fenêtre de reconnexion) · message bref de confirmation · confirmation d'une action destructive · conflit de modification (TRV-094).
