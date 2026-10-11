# Données de référence des maquettes

Une seule source pour tous les chiffres et noms d'exemple des écrans Figma, des parcours et, plus tard, des jeux de données de test. Toute maquette qui montre un bien, un Café, une personne ou un montant prend ses valeurs **ici** ; rien n'est inventé écran par écran. Les montants suivent le barème indicatif des specs (CAL-103, PAR-044) : **6,50 % l'an, mensualités constantes, 25 ans (300 mois), apport 20 %, endettement 35 %, âge limite 70 ans, frais 0**. Tous les chiffres sont des exemples indicatifs (TRV-023).

## 1. Personnes

| Rôle | Valeurs |
|---|---|
| Client | **Yacine Benali**, 38 ans (né en 1988), vit à Lyon ; `yacine.benali@exemple.fr` ; `+33 6 12 34 56 78` ; co-emprunteuse **Sonia Benali** (`sonia.benali@exemple.fr`). Initiales « YB ». |
| Conseiller | **Karim Haddad**, affiché « Karim H. » (NOT-050), Conseiller ; initiales « KH ». Second conseiller du back-office : **Amel Kaci**, « Amel K. ». |
| Direction | **Leïla Benyahia**, Direction ; initiales « LB » ; interlocutrice des partenaires (`partenaires@diaspora-patrimoine.exemple`). |
| Candidate promoteur | **Nadia Kerbouche**, Directrice commerciale, **Atlas Promotion** (Oran, RC 31/00-2345678 B 19, créée en 2015, 3 programmes en cours, Oran et Mostaganem) — un promoteur qui n'est **pas encore** partenaire ; `n.kerbouche@atlas-promotion.dz` ; `+213 550 12 34 56`. Bahia Promotion, déjà partenaire, sert au cas « Rattacher à {nom} ». |
| Candidate banque | **Samia Bouzid**, Direction de la clientèle internationale, **Trust Bank Algeria** (agrément BA-2012-021, financement islamique) — une banque qui n'est pas encore partenaire ; `s.bouzid@trustbank.exemple`. |
| Notaire (Devenir partenaire) | **Maître Rachid Haddad**, Étude Haddad, Alger. |

## 2. Diaspora Patrimoine (paramètres `contact.*`)

`contact@diaspora-patrimoine.exemple` · téléphone `+33 1 23 45 67 89` · WhatsApp `+33 7 00 00 00 01` · « Le Café : à Paris et dans le Sud de la France » · adresse : 12 rue de l'Exemple, 69002 Lyon (page Contact) · réponse « sous 48 h ouvrées ».

## 3. Biens, programmes, promoteurs

| Bien | Programme · ville | Standing | Prix | Apport 20 % | Financé | Mensualité* | Réf. |
|---|---|---|---|---|---|---|---|
| **Appartement T3 – Résidence El Yasmine** (bien du parcours) | Résidence El Yasmine · Chéraga, Alger | Habitat confortable | **150 000 €** (22 275 000 DA) | 30 000 € | 120 000 € | **810,25 €** (≈ 810 €) | `DP-DZ-0142` |
| Appartement T3 – Les Terrasses de la Baie | Les Terrasses de la Baie · Oran | Résidence de standing | 240 000 € | 48 000 € | 192 000 € | 1 296,40 € (≈ 1 300 €) | `DP-DZ-0203` |
| Appartement T4 – Le Belvédère | Le Belvédère · Hydra, Alger | Très haut standing | 410 000 € | 82 000 € | 328 000 € | 2 214,68 € (≈ 2 210 €) | `DP-DZ-0177` |

Arrondi des mensualités à l'écran : à la dizaine sur les cartes et la fiche (CAL-022, CAL-030) → 810 € · 1 300 € · 2 210 € (« ≈ 810 € / mois* ») ; au centime dans les simulateurs (CAL-025) → 810,25 € · 1 296,40 € · 2 214,68 €.

**Résidence El Yasmine** (Bahia Promotion) : Chéraga, à quinze minutes du centre d'Alger · 3 bâtiments de 5 étages · **64 logements** · du T2 au T5 · livraison **T4 2027** · chantier à **40 %** · résidence fermée, gardiennage, ascenseur, parking en sous-sol, jardin, aire de jeux. Types : T2 à partir de 118 000 € (3 lots) · **T3 à partir de 150 000 € (7 lots)** · T4 186 000 € (réservé) · Duplex T5 248 000 € (2 lots).

**Lot du parcours : B-304** · 3e étage · Est · 85 m² + 12 m² de terrasse · 2 chambres · 1 salle de bain · 1 place de parking · 22 275 000 DA (exactement 150 000 € au cours de 148,50 DA, CAL-021 ; 22 275 000 ÷ 85 = 262 059 DA / m² → ≈ 1 760 € / m², CAL-024). Les 7 lots T3 (par prix croissant) : B-304 150 000 · A-102 152 000 · B-404 154 000 · A-302 156 000 · B-504 158 000 · A-402 161 000 · A-502 165 000 (84 à 85 m²).

**Promoteurs** : **Bahia Promotion** (Alger, depuis 2009 — 17 ans d'activité, 4 programmes dont 3 en cours, RC 16/00-1234567 B 21) · El Djazaïr Habitat (Alger) · Sahel Immobilier (Oran) · Résidences du Littoral (Oran). **Banques** publiques : BNP Paribas El Djazaïr · Société Générale Algérie · Al Salam Bank Algeria (produit « Mourabaha Habitat », financement islamique, agrément BA-2008-014) · Banque Extérieure d'Algérie. **Autres partenaires** : Étude Maître Haddad (notaire, Alger) · Saa Assurances · Consulat général d'Algérie à Lyon.

## 4. Comparatif du héros (ACC-040 à ACC-043)

| | À Alger | En France |
|---|---|---|
| Bien | Appartement T3 – Résidence El Yasmine, 150 000 € | « Appartement T3 équivalent » (titre du bloc), 350 000 € |
| Apport | 30 000 € | 30 000 € |
| Financement | 120 000 € sur 25 ans à 6,50 % | 320 000 € sur 25 ans à 3,50 % |
| Mensualité* | **810 €** | **1 600 €** |

Écart : **− 790 € chaque mois**. Ligne d'hypothèses (ACC-042) : « Hypothèses : Alger, 25 ans, 6,50 % · France, 25 ans, 3,50 %. ». Remplace les « 400 € / 1 300 € » de la maquette cliente, qui ne correspondaient à aucun calcul (Q-009, point 1 de `Specs/00-cadre/05`, § 3).

## 5. Simulateurs

**Calcul express (EP-10, EDI-023)** : apport 30 000 € + mensualité 500 € → financement 74 051 € → budget estimé **104 000 €** (affiché « dont 74 000 € de financement sur 25 ans »). Curseurs bougés : 45 000 € + 800 € → 118 482 € → **163 000 €** (« dont 118 000 € »).

**Éligibilité (EP-11)** : l'exemple de contrôle de CAL-103, à reprendre tel quel — visiteur de 38 ans, revenus nets 3 400 € / mois, charges 150 €, apport 35 000 €, prix visé 151 000 € (saisi à la main, le visiteur ne vient pas d'une fiche) → mensualité maximale 1 040,00 € · durée 25 ans · capacité **154 026 €** · budget maximal **175 000 €** (apport 35 000 + financement 140 000 ; c'est l'apport qui limite) · apport conseillé 38 600 € → budget atteignable 192 532 € · bien visé finançable, mensualité **783,24 €** · statut `ELIGIBLE`. Sans apport : `CONDITIONAL`, apport manquant 30 200 €.

**Crédit (EP-12)** : 150 000 € − 30 000 € = 120 000 € sur 25 ans à 6,50 % → **810,25 € / mois** · coût du crédit **123 073,90 €** · total remboursé **243 073,90 €** (mensualité arrondie au centime d'abord, intérêts additionnés sur l'échéancier, CAL-043 ; 299 échéances de 810,25 €, une dernière de 809,15 €). Échéancier : année 1 — capital 1 981,34 €, intérêts 7 741,66 €, restant dû 118 018,66 € (janvier : 650,00 € d'intérêts, 160,25 € de capital) ; année 2 — 2 114,02 / 7 608,98 / 115 904,64 ; année 3 — 2 255,59 / 7 467,41 / 113 649,05. Trois scénarios sur 120 000 € : 20 ans **894,69 €** (coût 94 725 €) · 25 ans **810,25 €** (123 074 €) · 30 ans **758,48 €** (153 055 €) — « Mensualité la plus basse » : 30 ans. Avertissements : apport 15 000 € → financé 135 000 € sur 20 ans → 1 006,52 €.

## 6. Le Café

| Café | Date | Lieu | État |
|---|---|---|---|
| `CAF-2026-10-PAR` | **Samedi 17 octobre 2026, de 10 h à 13 h** | Paris, un salon de thé du Marais (Paris 4e) — adresse exacte envoyée à l'inscription | Il reste 12 places · promoteur (Bahia Promotion) et banquier (Al Salam Bank) présents |
| `CAF-2026-11-MRS` | Samedi 14 novembre 2026, de 10 h à 13 h | Marseille (Sud de la France) | Inscriptions ouvertes · promoteur présent |
| `CAF-2026-12-PAR` | Samedi 12 décembre 2026, de 10 h à 13 h | Paris | Ouverture des inscriptions le 1er novembre |

Calendrier 2026 : le 17 octobre, le 14 novembre et le 12 décembre sont des samedis ; le 15 octobre est un jeudi. Inscription du parcours : 2 personnes, code d'entrée `K7PX4R`.

## 7. Dates, références, délais

- Aujourd'hui dans les maquettes : **jeudi 8 octobre 2026**. Rappel choisi : **jeudi 15 octobre, le matin (9 h – 12 h, heure de France)**.
- Références : bien `DP-DZ-0142` · demande `DEM-2026-00187` · dossier `DOS-2026-0042` · soumission `SOU-2026-0017`.
- Alerte de recherche : « Appartement · Alger · jusqu'à 200 000 € », une fois par jour, active jusqu'au 6 avril 2027 (180 jours).
- Examen d'une candidature partenaire : sous 5 jours ouvrés. Clôture d'un compte refusé : 7 novembre 2026 (30 jours après le refus du 8 octobre).
