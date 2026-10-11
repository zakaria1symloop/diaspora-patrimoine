# Audit du Site public — 8 octobre 2026

Périmètre : page Figma « Site public » (33 écrans, 173 cadres), plus un coup d'œil en lecture sur les autres pages. Méthode : contrôles automatiques sur tous les cadres, puis relecture visuelle écran par écran par quatre relecteurs, chacun avec les specs (`Specs/` v1.5) et les principes du propriétaire. Rien n'a été modifié pendant l'audit. Gravité : **B** bloquant · **M** majeur · **m** mineur. Captures : `scratchpad/audit-A` à `audit-D`.

## 1. Problèmes qui traversent tout le site

| # | Gravité | Problème | Écrans | Correction |
|---|---|---|---|---|
| T1 | M | « LE CAFÉ » masqué dans l'en-tête (et pied en mode « sans Café ») alors que Le Café est actif (NAV-010, NAV-015). | 42 écrans : EP-02, EP-03, EP-05, EP-07, EP-11, EP-12, EP-21, EP-29, EP-31 | Show café = vrai partout sauf « sans Le Café ». |
| T2 | B | **Données de référence incohérentes** : mensualité du T3 El Yasmine à 400, 694, 712 et 810 €/mois ; prix 150 000 / « à partir de 146 000 » ; 64 ou 120 logements ; livraison T2 ou T4 2027 ; Le Belvédère à Alger ou Oran ; standing variable ; promoteur 12 ou 17 ans d'activité, 3 ou 4 programmes ; référence DP-DZ-0142 / DP-2026-0142. | Accueil, catalogue, comparateur, fiches, formulaires, simulateurs, EP-29 410, EP-32 | Une table de référence unique (biens, programmes, promoteurs, banques, Cafés, coordonnées) appliquée partout ; trancher 400 vs 810 (question ouverte). |
| T3 | M | **Jours de la semaine faux pour 2026** (calendrier 2025) : « samedi 18 octobre » (dimanche), « samedi 8 nov. », « dimanche 23 nov. », « jeudi 9 octobre » (vendredi). Calendrier des Cafés incohérent entre l'accueil (Paris, 17 oct., 12 places) et EP-13/14 (Lyon 18 oct., 6 places) ; Lyon contredit « Paris et Sud de la France ». | EP-13, EP-14, EP-15, EP-19, EP-20, EP-21, EM-01, PA-01 | Un calendrier unique : sam. 17 oct. Paris · sam. 14 nov. Sud · sam. 12 déc. Paris ; jeudi 15 oct. pour les rappels. |
| T4 | M | **Cadres d'états de EP-05 copiés de l'ancienne fiche du 03/10** (remplacée par la fiche complète) : chiffres, tableau des lots, section chantier absente. | EP-05 (8 cadres) | Refaire les états à partir de « Fiche bien, complète », archiver l'ancienne. |
| T5 | M | **« Écouter » et micro absents** (TRV-127, D-090) des pages : bouton haut-parleur en tête de contenu, micro dans recherche et « Votre message ». | Quasi tout le site (présent seulement sur l'accueil simplifié) | Ajouter au gabarit des pages et aux champs concernés. |
| T6 | M | **Consentement tronqué** : sans « et traite mes données à cette fin » ni lien « Politique de confidentialité » (DEM-020 : phrase enregistrée telle quelle). | EP-20, EP-21, EP-23, EP-14 | Phrase complète partout. |
| T7 | M | **Délai « sous 48 h ouvrées » affiché alors qu'un jour est choisi** (DEM-008, NOT-053). | EP-07 (tous), EP-21 | « Un conseiller vous appelle jeudi 15 octobre, de préférence le matin ». |
| T8 | M | **Repères de règles et notes de conception imprimés dans l'interface** (« (TRV-122) », « (CAT-061) », « (CAT-060)… »). | 539:34442, 539:34732, 508:8120, 548:40407 | Retirer ou déplacer en note hors écran. |
| T9 | M | **Pied de page 1 440 sans téléphone ni WhatsApp** (le 390 les a) ; « Notre Concept » au lieu de « Notre concept » (NAV-010). | Composant Footer, Header | Corriger les composants. |
| T10 | m | Compteurs « 0 / 2 000 » avec texte saisi ; limites fausses (1 000 pour le Café, 3 000 pour l'enquête). | EP-14, EP-19, EP-23, EP-25, EP-32, EP-33 | Compteur juste. |
| T11 | m | Légendes à 11,5 px (≈ 1 800 textes) : permis sur le site, petit pour un public âgé. | Tout le site | Proposition : `caption` et `overline.s` à 12–13 px (décision à prendre). |
| T12 | m | Visuels : une image délavée sur 40 % (bouton 360° dans le blanc), cartes « similaires » qui répètent le bien courant, carte vide (fond absent, repère coupé), QR code vide, plan en quatre rectangles. | EP-04, EP-05, EP-06, EP-09, EP-02 carte, EP-14, EP-15, EP-29 410 | Changer l'image, vraies données, fond de carte, QR et plan dessinés. |

## 2. Couverture : états de l'inventaire sans cadre

- **EP-01** : repli « sans projection », repli « sans financement islamique », « biens tous réservés ».
- **EP-02** : aucun cadre 1 440 n'est dans l'état nominal (mensualité sur les cartes) ; pas d'état d'erreur (TRV-080) ; « Créer une alerte », « Comparer » et la rangée « Liste · Carte · Grouper · Enregistrer » absents du cadre principal.
- **EP-04, EP-06** : pas de 390. **EP-05** : « sans visite 360° » (n'existe que dans l'ancienne fiche).
- **EP-07** : « vide », « programme sans bien publié », « défi anti-robots ».
- **EP-10** : « sans banque publique ». **EP-11** : « bien visé non finançable », « demande de rappel dépliée ».
- **EP-14** : « clos », « passé », confirmation de liste d'attente.
- **EP-22** : résultat du mode guidé, dictée en cours. **EP-29** : page d'attente L1 sans le lien « Accès réservé ».
- **EP-31** : « deux biens », bac sur la fiche, 390.
- **Sans 390** (DSN-080 : 390 et 1 440 pour chaque écran public) : EP-04, EP-06, EP-13, EP-15, EP-16, EP-18, EP-22, EP-24, EP-25, EP-26, EP-27, EP-30, EP-31.

## 3. Par famille

### Accueil et recherche (EP-01, EP-02, EP-03, EP-31)
- **B** EP-01 sans Le Café : le titre « prend vie ici » chevauche le titre du comparatif.
- **M** EP-01 sans Le Café : replis ACC-090 incomplets (service 05, « Présent aux Cafés », appel final, bouton du pied).
- **M** EP-01 390 : ne suit pas ACC-100 (comparatif côte à côte, cartes en défilement aimanté avec points, 3 biens, barre d'action fixe, projection avant les cartes de financement) ; dates des Cafés différentes du 1 440.
- **M** EP-01 simplifié : texte non agrandi (TRV-122 « Grande » au moins), valeurs des champs en gris.
- **M** EP-01 1 440 : « sous 48 h » → « sous 48 h ouvrées » (ACC-081).
- **M** EP-02 aucun résultat : critères différents entre l'en-tête et l'alerte ; suggestions identiques ; « 0 bien correspond » (CAT-060 ne compte pas).
- **M** EP-02 vue carte : données fausses, « ≈ » interdit (CAT-045), duplex hors filtres, fond de carte absent.
- **M** EP-02 suggestions : liste ancrée sous le compteur, champ sans « Hyd » (TRV-109).
- **M** EP-02 tous réservés : CAT-064 est le cas sans filtre.
- **M** EP-02 recherche enregistrée / aucun résultat : libellé « connecté » mais en-tête visiteur, e-mail prérempli.
- **M** EP-02 390 : titre, cartes hors filtres (Oran, 240 000, 410 000), « Voir 12 de plus » au lieu de la pagination (CAT-055).
- **M** EP-03 390 : 4 groupes sur 9 (CAT-034) ; options à zéro masquées au lieu de grisées (CAT-033).
- m EP-01 : pastille « − 900 € » sur la note, trait d'union ; barre de recherche préremplie (ACC-052 : valeurs par défaut) ; cartes étirées (ACC-055) ; menu téléphone marque « Tous les programmes » courant (NAV-011).
- m EP-03 états : compteurs d'options et encart de budget non mis à jour ; options grisées peu lisibles.
- m EP-31 indisponible : colonne non atténuée, badges et bouton actifs, « Retirer » sans libellé.
- m EP-02 catalogue vide : mauvais titre, page nue ; liste Ville : « Recherches récentes » réservé à la recherche par mots.

### Programmes et biens (EP-04 à EP-07)
- **B** EP-05 réservé / vendu : étiquettes « Disponible », « Plus que 7 lots », tuile « 7 lots » ; biens similaires non remontés (FIC-004, FIC-080, FIC-081).
- **M** EP-05 complète : biens similaires = le bien lui-même.
- **M** EP-05 images 3D : mentions superposées (FIC-012).
- **M** EP-06 plans : bouton coupé, « Plans (2) » pour trois, note FIC-016 absente.
- **M** EP-07 depuis un programme : liste ≠ EP-04 (T2 absent, T4 réservé proposé, prix faux).
- **M** EP-07 confirmation client connecté : boutons plus larges que le contenu.
- **M** EP-04 vendu : section « Autres programmes du promoteur » absente, phrase répétée (FIC-111) ; EP-04 retiré : impasse ; EP-04 complète : tuile « Lots disponibles » et section 10 absentes (FIC-110).
- **M** EP-04 / EP-05 : carte du quartier vide (FIC-060).
- m Libellés de rareté (« Dernier lot », seuil 10) ; « Pas d'e-mail… » absent des confirmations ; référence DEM-2026-00187 (TRV-051) ; sélecteur « au total / par mois » absent ; erreurs sans icône ; bouton « en cours » pas inactif ; étiquettes de fiche incohérentes ; « € » seul à la ligne ; légende et compteurs de la galerie 360° ; « sans 360 » à reformuler (FIC-019) ; cœur « Sauvegardé » vide ; format de livraison ; « ≈ » inversé (FIC-050) ; 7 lots à montrer (FIC-033) ; photos de chantier ; « sans photo » nu.

### Financement et partenaires (EP-08 à EP-12, EP-17, EP-20, EP-21, EP-23, EP-32, EP-33)
- **M** Calculs faux : EP-11 ajustement (apport conseillé 50 400 €, budget 251 000 €) ; EP-12 échéancier (810,25 €, échéancier recalculé, CAL-025) ; EP-12 trois scénarios (chiffres et étiquette « la plus basse ») ; EP-12 avertissements (montant financé 135 000 €, vocabulaire de la marge, CAL-047) ; EP-11 année de naissance 1979 vs 1986.
- **M** EP-12 : mentions SIM-002 / TRV-023 / SIM-005 manquantes ou fusionnées ; mises en page différentes de la référence ; 390 : durée en pastilles au lieu du curseur (SIM-020), « Enregistrer » absent.
- **M** EP-11 étape 3 : curseur de durée sans poignée, qui dépasse ; EP-11 ajustement : blocs SIM-012 / SIM-032 absents, textes SIM-005 / SIM-009 inexacts.
- **M** EP-10 sans financement islamique : accroche et question de FAQ à retirer (EDI-022) ; EP-10 390 incomplet (EDI-020).
- **M** EP-10 / EP-12 : quatre banques présentées, mais seuls le barème indicatif dans la liste « Solution de financement » (SIM-020) — lié au multi-banques.
- **M** EP-17 : le bandeau partenaires recouvre une carte, pas de marge avant le pied.
- **M** EP-23 : exemple de promoteur (doit être un notaire), message facultatif à tort ; confirmation sans scène.
- **M** EP-20 / EP-21 confirmations : textes, étapes et boutons ≠ DEM-023.
- **M** EP-33 390 : scène et lien « Espace client » absents.
- m EP-32 banque : avantages de promoteur, logo absent ; mot de passe sans « Afficher » ni robustesse ; charte non liée ; EP-33 : scènes `Attente`/`Perdu` au lieu de `Partenaire`, motif de refus à adapter (ACP-086) ; EP-08 « 1 programmes », monogrammes ; EP-08 vide (EDI-030) ; EP-09 image délavée, états sans pastille ; EP-10 libellés d'étapes (EDI-011), FAQ de départ (EDI-041), bouton qui déborde, chevron ; EP-11 aides ; EP-11 sans solution nu ; EP-21 vignette vide, téléphone coupé ; EP-12 échéance annuelle 9 723,00 €.

### Le Café, contenus, liens e-mail, système, e-mails, parcours
- **M** EP-14 : en-tête (pastille d'état, « Partager »), description, FAQ du Café absentes (CAF-010) ; 390 : ordre (CAF-061).
- **M** EP-14 / EP-15 : QR vide ; EM-01 Café : adresse « la veille » au lieu du lieu, du code et du QR (CAF-023).
- **M** EP-14 à venir : ouverture après la date du Café.
- **M** EP-18 : question non publiée affichée (Q-014), questions hors liste de départ (EDI-041).
- **M** EP-29 410 : trois fois le même bien (celui du client).
- **M** EP-16 : icônes identiques, cartes coupées, trop de cartes sans point focal (D-093).
- **M** EP-22 : pas de pied de page (NAV-021) ni de fond ; biens proposés hors filtre (Oran).
- m EP-13 : étape 03, FAQ, choix du lieu dans « Me prévenir » ; EP-13 sans date : pied « prochain café » ; EP-14 « Il ne reste que 1 place », « Découvrir les programmes » absent, pastilles « En pratique » inégales ; EP-15 états nus ; EP-19 coordonnées différentes entre 1 440 et 390 ; EP-18/EP-24 appel EDI-004 absent ; EP-24 date future et « … » ; EP-22 écarts ASS-002, IA-002, ASS-021 ; EP-25 échelles et textes (PRO-072) ; EP-26 lien « Créer mon espace » et nouveau lien (TRV-125) ; EP-27 carte hors colonne ; EP-29 attente : lien présent, photo au lieu de la scène ; EP-29 404 : lien Le Café ; EM-01 : codes de modèles inexistants (C_LEAD_ACK_INTEREST, C_DOC_REQUEST, C_CAFE_REGISTERED), objets, bouton, raisons d'envoi ; PA-02 à PA-06 : quelques étapes et renvois à corriger.

## 4. Hors Site public (lecture seule, à traiter quand le module sera ouvert)
- Back-office : conseiller nommé « Karim Hadj », « Karim HADDAD », « CHERIF Karim », « Karim H. » ; Direction « Narimen M. » ici, Leïla Benyahia dans les données de référence.
- Espace client : ses trois écrans datent d'avant D-087 et D-090.

## 5. Ce qui est sain
Aucune apostrophe droite, aucun texte sans style, aucun texte de remplissage oublié, chaque écran porte son étiquette, les liens des tableaux de parcours mènent tous à un écran existant.

## 6. Suite donnée (8 octobre 2026, soir)

**Tout ce qui précède est traité**, en quatre passes : (1) socle commun — en-tête et pied (Café visible, téléphone et WhatsApp, « Les biens »), chiffres et noms de `Design/donnees-de-reference.md`, calendrier 2026, consentement et délai de rappel, « Écouter cette page » et dictée, légendes à 12 px ; (2) reconstruction — les états de la fiche bien depuis la fiche complète (ancienne fiche archivée), chiffres des simulateurs, textes des confirmations, chevauchements ; (3) écarts aux specs écran par écran ; (4) états manquants et versions téléphone. Reste volontairement hors maquette : les règles de comportement sans effet visuel (brouillon des filtres, jeton sans expiration, `?q=` de l'assistant…), décrites dans les specs.

**Relecture « logique = comportement du visiteur »** (D-095, deux relectures page par page, 74 constats) : quarante règles modifiées dans les specs (`00-cadre/05`, D-095) et dix-huit états ajoutés aux maquettes — entrée « Les biens » et bouton « Voir les biens », favoris sans compte (invitation au troisième favori), recompte des filtres indisponible, fiche qui se souvient d'une demande envoyée, fiche avec une simulation récente, formulaire d'intérêt aux précisions repliées avec « Comment vous joindre ? », lien « Demander une visite en visio » dans la galerie, « Partager » sur le comparateur, pagination téléphone en bouton, éligibilité avec « Modifier ma simulation », explication de l'apport minimum et mensualité du budget, « rappel envoyé », rappel du calcul express, barre collante de la mensualité sur téléphone, adresse modifiable après une projection, « Vous préférez appeler ? », repères du partenaire pressé, bloc « Une question ? » sur tous les états de candidature, fiche « pas encore en ligne » à l'acceptation, « Modifier mes questions » et texte du Café passé, alerte en pause et suppression avec « Annuler », ligne « tout arrêter » des préférences, merci d'enquête avec le rappel promis, question « Dans quelle langue se passe un Café ? ».

**Hors Site public** : inchangé (Espace client, Back-office) — à traiter quand ces modules seront ouverts.
