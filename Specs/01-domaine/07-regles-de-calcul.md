# Règles de calcul

Tous les calculs sont faits **par le serveur**, avec des nombres décimaux exacts (jamais de flottants). L'interface affiche ; elle ne recalcule pas. Chaque fonction décrite ici vit dans un module unique (`packages/domain/finance`, `packages/domain/calendar`…) partagé par l'API et testé avec les exemples de ce fichier.

Convention : « arrondi » = arrondi au plus proche, la moitié vers le haut.

---

## 1. Conversion de devises

**CAL-010** `[P1]` **Choix du cours.** Pour convertir un montant de la devise X vers la devise Y :
1. si X = Y : le montant est inchangé ;
2. sinon, parmi les cours **non annulés** de nature `finance.exchangeRateKind` (défaut `OFFICIAL`) qui lient X et Y **dans un sens ou dans l'autre**, on retient le **plus récent** : la date `asOf` la plus haute (≤ aujourd'hui), puis, à date égale, la saisie la plus récente (`createdAt`). Sens X → Y : montant × `rate` ; sens Y → X : montant ÷ `rate` ;
3. à défaut, en passant par la devise de référence R (`display.referenceCurrency`, défaut `EUR`) : X → R puis R → Y, chaque étape selon 2 ;
4. à défaut : **conversion impossible**. Le résultat est nul.

Le sens de saisie ne donne donc aucune priorité : seul compte le cours le plus récent. Il n'y a **pas de repli sur l'autre nature** : la nature est un choix de présentation (Q-007), et un couple sans cours de la nature choisie est signalé « Manquant » (BNK-060).

**CAL-011** `[P1]` Conversion impossible : sur une fiche ou une carte, le montant est affiché dans sa devise d'origine, sans équivalent. Dans un simulateur, le produit concerné est écarté avec la raison `RATE_MISSING`. Le back-office affiche une alerte « Taux de change manquant : {X} → {Y} ».

**CAL-012** `[P1]` La **date du cours** utilisé accompagne tout résultat converti (TRV-022). Si elle a plus de `finance.exchangeRateMaxAgeDays` jours (7), la conversion reste faite, et le back-office affiche « Taux de change ancien ({date}). Mettez-le à jour. » (AUT-072).

**CAL-013** `[P1]` Une simulation **garde** le cours utilisé au moment du calcul (`parametersSnapshot`) ; une soumission le garde dans le sommaire de son paquet (BNK-110), qui ne change plus. Un nouveau cours ne change aucun résultat enregistré.

## 2. Arrondis d'affichage

**CAL-020** `[P1]` Un montant dans sa devise d'origine (prix d'un lot en dinars) est affiché arrondi à l'unité.

**CAL-021** `[P1]` Un **prix de bien converti** dans la devise de référence est arrondi par paliers, puis stocké tel quel (`priceFromRef`) :

| Montant converti | Arrondi au plus proche |
|---|---|
| moins de 10 000 | 100 |
| de 10 000 à moins de 100 000 | 500 |
| 100 000 et plus | 1 000 |

Exemples, à 148,50 DA pour 1 € : le lot B-304 de la Résidence El Yasmine, 22 275 000 DA = 150 000,00 € → **150 000 €** ; un lot à 22 350 000 DA = 150 505,05 € → **151 000 €**.

**CAL-022** `[P1]` Une **mensualité indicative** — celle des cartes, des listes et du filtre, `[P1]` (CAL-030), et celle du comparatif de l'accueil (ACC-043) — est arrondie à la **dizaine** la plus proche. Exemple : 406,25 € → **410 €**.

**CAL-023** `[P1]` L'**apport de référence** d'une carte = `priceFromRef` × pourcentage d'apport, arrondi à la centaine la plus proche.

**CAL-024** `[P1]` **Prix au mètre carré** : toujours celui d'un **lot** — son prix ÷ sa surface, calculé dans la devise du bien, arrondi à l'unité, puis converti pour l'affichage (arrondi à la dizaine). Sur une fiche de bien, quand les lots disponibles n'ont pas tous le même prix au mètre carré : « de {min} à {max} / m² ». Il n'est jamais calculé à partir d'un prix déjà arrondi.

**CAL-027** `[P1]` **Bornes des montants saisis.** Elles valent pour toute devise ; ce sont des garde-fous techniques, pas un jugement sur le projet.

| Montant | Borne basse | Borne haute |
|---|---|---|
| Revenu, charges, mensualité (par mois) | 0 (ou strictement plus, si la règle le dit) | 1 000 000 000 |
| Prix, apport, montant à financer, budget, acompte, commission, frais | 0 (ou strictement plus) | 100 000 000 000 |

Deux décimales au plus. Au-delà de la borne : « Ce montant est trop élevé. Vérifiez votre saisie. ». En deçà d'un seuil de vraisemblance, l'écran avertit sans bloquer : un prix de bien inférieur à 1 000 unités de la devise de référence une fois converti, ou un revenu mensuel supérieur à 100 000 unités, affiche « Vérifiez ce montant : {montant reformaté} ».

**CAL-028** `[P1]` **Prix d'un lot et d'un programme à l'affichage.** Le prix d'un lot converti suit les paliers de CAL-021. Un programme affiche « à partir de {prix} » : le plus petit `priceFromRef` de ses biens publiés et disponibles (`Program.priceFromRef`, cache recalculé avec ceux de ses biens, MOD-220) ; sans bien disponible, pas de prix. À côté de ce prix, `[P1]`, la mensualité indicative est celle **du bien qui donne ce prix** (`monthlyFromRef`) : un programme n'a pas de mensualité propre.

**CAL-025** `[P1]` Dans le détail d'un simulateur et dans un échéancier, les montants gardent **deux décimales**.

**CAL-026** `[P1]` **Capacité et budget d'un résultat d'éligibilité.** Ils sont calculés et enregistrés à l'unité, arrondis **vers le bas** (on ne promet jamais plus que le calcul). À l'écran, dans le PDF et dans l'e-mail, ils sont en plus arrondis **vers le bas** au palier de CAL-021 : 199 356 € s'affiche « ≈ 199 000 € ». Le filtre « biens dans mon budget » utilise la valeur affichée. Le **financement** montré dans le détail du budget (SIM-012) est celui du budget **affiché** : budget affiché × (1 + frais) − apport — pour que les chiffres à l'écran s'additionnent, ce que deux arrondis séparés ne garantiraient pas. Les frais montrés sont de même ceux du budget affiché. Ces valeurs sont calculées une fois, avec le résultat (bloc `shown`, CAL-104).

## 3. Mensualité indicative et financement de référence

**CAL-030** `[P1]` Chaque bien publié porte une **mensualité indicative** `monthlyFromRef`, dans la devise de référence, calculée ainsi :

1. paramètres : `finance.reference.{pays du bien}` = `{downPaymentPct, durationMonths, annualRateBps, pricingMethod}` ; à défaut de paramètre pour ce pays, `finance.reference.default` ;
2. `priceFromRef` = conversion de `priceFrom` (CAL-010), arrondie (CAL-021) ;
3. `downPaymentRef` = `priceFromRef` × `downPaymentPct` ÷ 100, arrondi (CAL-023) ;
4. montant financé = `priceFromRef` − `downPaymentRef` ;
5. mensualité = formule de la méthode (CAL-040 ou CAL-041) sur ce montant, cette durée, ce taux ;
6. `monthlyFromRef` = mensualité arrondie (CAL-022).

Valeurs de départ (PAR-041, Q-006) : apport 20 %, 300 mois, 6,50 % (650 points de base), `AMORTIZED_RATE`. Exemple : 150 000 € → apport 30 000 € → financé 120 000 € → r = 0,065 ÷ 12 → M = 120 000 × r ÷ (1 − (1 + r)^(−300)) = 810,2486… → **810 € / mois** (CAL-022 ; 810,25 € au centime dans un simulateur, CAL-025).

**CAL-031** `[P1]` Si `priceFrom` est nul (aucun lot) ou si la conversion est impossible, `priceFromRef`, `downPaymentRef` et `monthlyFromRef` sont nuls : la carte n'affiche pas de mensualité, et le bien n'apparaît pas dans une recherche filtrée par budget.

**CAL-032** `[P1]` **Recherche par budget mensuel.** Le filtre « Budget mensuel : jusqu'à M » retient les biens dont `monthlyFromRef` ≤ M. Le filtre « Budget total : jusqu'à B » retient ceux dont `priceFromRef` ≤ B. Les deux filtres s'excluent : choisir l'un efface l'autre.

**CAL-033** `[P1]` Ces caches sont recalculés quand change : le prix ou le statut d'un lot du bien ; le cours de change de la devise du bien (nouveau cours, cours annulé) ; la nature de cours utilisée (`finance.exchangeRateKind`) ; la devise de référence (`display.referenceCurrency`) ; le financement de référence du pays (MOD-220, AUT-080). `priceFromRef` (étape 2 de CAL-030) est calculé dès la Phase 1 : c'est le prix affiché sur toutes les cartes. `downPaymentRef` et `monthlyFromRef` sont `[P1]` : ils restent nuls tant que la mensualité des cartes n'est pas développée (CAT-042).

## 4. Formules de financement

Notations : `P` montant financé · `n` durée en mois · `t` taux annuel = taux du produit pour cette durée (CAL-048), en points de base ÷ 10 000 · `r` = `t` ÷ 12.

**CAL-040** `[P1]` **Mensualités constantes** (`AMORTIZED_RATE`) :

```
si r = 0 :  M = P / n
sinon    :  M = P × r / (1 − (1 + r)^(−n))
```

Exemples de contrôle : P = 120 000, n = 300, t = 0 → M = 400,00 · P = 120 000, n = 240, t = 5,5 % → M = 825,46 · P = 100 000, n = 180, t = 4 % → M = 739,69.

**CAL-041** `[P1]` **Marge fixe répartie** (`FLAT_MARGIN`). La formule fait partie du socle (un barème peut l'employer) ; seuls le type islamique, son vocabulaire et ses contenus sont `[P1]` (CAL-047).

```
marge totale = P × t × (n / 12)
M            = (P + marge totale) / n
```

Exemple : P = 120 000, n = 240, t = 4 % → marge totale 96 000 → M = 900,00.

**CAL-042** `[P1]` **Capacité** : montant maximal finançable pour une mensualité maximale `Mmax`.

```
AMORTIZED_RATE, r = 0 :  P = Mmax × n
AMORTIZED_RATE, r > 0 :  P = Mmax × (1 − (1 + r)^(−n)) / r
FLAT_MARGIN           :  P = Mmax × n / (1 + t × n / 12)
```

Le résultat est arrondi **vers le bas** à l'unité. Exemples de contrôle : `Mmax` = 1 040, n = 300, t = 0 → P = 312 000 · `Mmax` = 154 440, n = 300, t = 5,5 %, `AMORTIZED_RATE` → P = 25 149 510 · `Mmax` = 900, n = 240, t = 4 %, `FLAT_MARGIN` → P = 120 000.

**CAL-043** `[P1]` **Échéancier.** Première échéance : un mois après la date de départ (par défaut le premier jour du mois suivant le calcul).
- `AMORTIZED_RATE` : la mensualité `M` est d'abord arrondie à 2 décimales. Pour chaque mois, intérêts = capital restant × `r` (arrondi à 2 décimales) ; capital remboursé = `M` − intérêts ; capital restant diminué d'autant. **Dernière échéance** : capital remboursé = capital restant ; l'échéance est ajustée de l'écart d'arrondi.
- `FLAT_MARGIN` : chaque échéance = `P` ÷ `n` de capital + marge totale ÷ `n` de marge ; la dernière absorbe l'écart d'arrondi.

Chaque ligne : numéro, date, échéance, part de capital, part d'intérêts (ou de marge), assurance, capital restant dû. Le tableau est aussi fourni **par année** (sommes). Le **total des intérêts** d'un résultat est la somme des intérêts de l'échéancier, pas `M` × `n` − `P`.

Exemple de contrôle : P = 120 000, n = 240, t = 5,5 % → 239 échéances de 825,46, une dernière de 827,70, total des intérêts 78 112,64, capital restant final 0,00.

**CAL-044** `[P1]` **Assurance et frais**, quand le produit les définit :
- assurance mensuelle = `P` × `insuranceRateBps` ÷ 10 000 ÷ 12, arrondie à 2 décimales, constante sur toute la durée ; total de l'assurance = cette mensualité arrondie × `n` ;
- frais de dossier = `fileFeeFixed` + `P` × `fileFeePct` ÷ 100, arrondis à 2 décimales.

Exemple de contrôle : P = 120 000, assurance 0,36 %, n = 240 → 36,00 par mois, 8 640,00 au total.

**CAL-045** `[P1]` **Coût total** = total des intérêts de l'échéancier (ou marge totale) + total de l'assurance + frais de dossier. **Total remboursé** = `P` + coût total. La mensualité affichée en grand est **hors assurance** ; la mensualité assurance comprise est donnée en dessous. Pour une **offre de banque** enregistrée (BNK-130), le chiffre affiché en grand est la mensualité **de l'offre** (`BankSubmission.monthlyPayment`), et le coût du crédit affiché est : mensualité de l'offre × `n` − montant accordé (plus l'assurance et les frais de l'offre, s'ils sont saisis). L'échéancier indicatif (BNK-134) est calculé par CAL-043 avec le montant, le taux, la durée et la méthode de l'offre ; si sa mensualité calculée s'écarte de celle de l'offre de plus de 1 %, le conseiller est averti à la saisie (« La mensualité saisie ({x}) diffère du calcul ({y}) : vérifiez le taux, la durée, ou une assurance comprise. ») et l'échéancier porte la mention « Calcul indicatif ; la mensualité de l'offre est de {x}. ».

**CAL-046** `[P1]` Taux annuel effectif global indicatif, masqué tant que `finance.showApr` est faux (défaut) : taux mensuel `i` tel que `P − frais = Σ (M + assurance) / (1 + i)^k`, puis `i × 12`.

**CAL-047** `[P1]` **Vocabulaire selon le type de financement.** Pour un produit `ISLAMIC` : « marge » au lieu de « taux » et d'« intérêts », « financement » au lieu de « crédit » et de « prêt », « montant financé » au lieu de « capital emprunté ». Les libellés viennent de deux jeux de clés de traduction (`ui.finance.conventional.*`, `ui.finance.islamic.*`), à ne pas confondre avec les paramètres `finance.*`. Quand le résultat mêle les deux types (préférence `NO_PREFERENCE`), les titres emploient les mots neutres « financement », « montant finançable », « mensualité ».

**CAL-048** `[P1]` **Taux d'un produit selon la durée.** Si le produit porte un barème par durée (`BankProduct.rateBands`), le taux retenu pour une durée `n` est celui de la **première tranche** dont `maxDurationMonths` ≥ `n` ; au-delà de la dernière tranche, celui de la dernière. Sans barème par durée : `nominalRateBps`. Exemple : tranches 180 mois → 5,90 % et 300 mois → 6,50 % ; pour 144 mois : 5,90 % ; pour 240 mois : 6,50 %. Dans le simulateur d'éligibilité, la durée est fixée d'abord (CAL-101, contrôle 5), le taux ensuite. Un produit à plusieurs tranches reste **une** solution dans les décomptes.

## 5. Simulateur d'éligibilité

**CAL-100** `[P1]` **Entrées** (`Simulation.inputs`, type `ELIGIBILITY`) :

| Champ | Type | Oblig. | Bornes |
|---|---|---|---|
| `propertyCountry` | pays | oui | Un pays dont le catalogue est actif. Présélectionné s'il n'y en a qu'un. |
| `residencyStatus` | `ResidencyStatus` | oui | |
| `countryOfResidence` | pays | oui | |
| `birthYear` | entier | oui | Âge entre 18 et 85 ans. |
| `monthlyIncome` | montant | oui | Strictement supérieur à 0 (CAL-027). Revenu net mensuel. |
| `incomeCurrency` | devise | oui | Parmi PAR-025. Proposée d'après le pays de résidence (la devise de ce pays si elle est dans la liste) ; à défaut, la devise de référence. |
| `coBorrowerIncome` | montant | non | Même devise. |
| `otherIncome` | montant | non | Même devise. |
| `monthlyDebts` | montant | oui | 0 accepté. Mensualités des crédits en cours. Même devise. |
| `downPayment` | montant | oui | 0 accepté. |
| `downPaymentCurrency` | devise | oui | Défaut : celle des revenus. |
| `desiredDurationMonths` | entier | non | 12 à 480. |
| `financingPreference` | `CONVENTIONAL`, `ISLAMIC`, `NO_PREFERENCE` | oui | Défaut `NO_PREFERENCE`. `ISLAMIC` n'est proposé que si `features.islamicFinance` est vrai. |
| `targetPrice` | montant | non | Prix du bien visé. En venant d'une fiche : prérempli avec le prix **affiché** sur la fiche (`priceFromRef`, ou le prix du lot choisi converti et arrondi selon CAL-021), pour que le visiteur retrouve le même chiffre. |
| `targetCurrency` | devise | selon | Obligatoire si un prix est saisi. Défaut : celle des revenus ; en venant d'une fiche : la devise de référence. |
| `propertyId`, `lotId` | UUID | non | Le bien d'où vient le visiteur ; sert au rappel du bien sur le résultat et à la demande qui suit (DEM-016). |

La **devise de la simulation** (`displayCurrency`) est celle des revenus : tous les chiffres du résultat sont dans cette devise. Le budget maximal est aussi enregistré **dans la devise de référence** (`maxBudgetRef`) : c'est cette valeur qui sert au filtre du catalogue (CAT-035) et aux propositions du conseiller (PIP-031), dont les prix sont dans la devise de référence. L'**âge** retenu est l'année en cours moins `birthYear`, pour l'emprunteur principal seulement.

**Prix lié à un bien.** Tant que le visiteur ne modifie pas un prix prérempli depuis une fiche, le calcul part du **prix d'origine** du bien, dans sa devise (`priceFrom`, ou le prix du lot choisi) — pas du prix arrondi affiché. L'écran continue de montrer le prix arrondi. Dès qu'il saisit un autre prix, c'est ce montant, dans la devise choisie, qui est converti. La même règle vaut pour le simulateur de crédit (CAL-110).

**CAL-101** `[P1]` **Calcul, pour chaque produit à évaluer** : les produits utilisables (MOD-113) dont `propertyCountryCode` est le pays choisi, visibles dans les simulateurs (`isPublicInSimulators`), et dont le type correspond à la préférence (`NO_PREFERENCE` : les deux types). Si cet ensemble est vide : CAL-103. Les étapes s'arrêtent à la première qui échoue ; la raison est notée.

| # | Contrôle | Raison en cas d'échec |
|---|---|---|
| 1 | Situation de résidence acceptée (`eligibleResidency` vide ou la contient) | `RESIDENCY` |
| 2 | Pays de résidence accepté | `RESIDENCE_COUNTRY` |
| 3 | Devise des revenus acceptée | `INCOME_CURRENCY` |
| 4 | Conversion des montants dans la devise du produit possible | `RATE_MISSING` |
| 5 | **Durée** : la durée de base est la durée souhaitée si elle est donnée, sinon la durée maximale du produit ; elle est **ramenée dans les bornes du produit** (une durée souhaitée plus courte que le minimum devient le minimum, plus longue que le maximum devient le maximum). `nAge` = (`maxAgeAtEnd` − âge) × 12 si le produit a un âge limite, sinon illimitée. `n` = le plus petit de la durée de base et de `nAge`, arrondi à l'année entière inférieure, puis **ramené à la durée minimale du produit** s'il tombe en dessous (pour le barème indicatif : `minDurationMonths`) — une durée minimale qui n'est pas un nombre entier d'années reste ainsi possible. Il faut alors `n` ≤ `nAge` : seul l'âge peut donc faire échouer ce contrôle — à l'âge limite ou au-delà, ou quand l'âge laisse moins que la durée minimale, le contrôle échoue. Quand `n` diffère de la durée souhaitée, l'écran le dit (« Durée retenue : {n} — c'est le minimum de cette solution. » · « … limitée par l'âge en fin de financement. »). | `AGE_OR_DURATION` |
| 6 | **Revenus** : `I` = revenus + revenus du co-emprunteur + autres revenus, convertis. Il faut `I` ≥ `minMonthlyIncome` si le produit en fixe un. | `INCOME_TOO_LOW` |
| 7 | **Mensualité maximale** : `Mmax` = `I` × `maxDebtRatioPct` ÷ 100 − charges converties. Il faut `Mmax` > 0. | `DEBT_RATIO` |
| 8 | **Capacité** : `C` = CAL-042 avec `Mmax`, `n`, le taux du produit pour `n` (CAL-048) et sa méthode, plafonnée à `maxAmount`. Il faut `C` ≥ `minAmount`. | `AMOUNT_BELOW_MIN` |

Puis, pour un produit qui passe les huit contrôles, avec `D` = apport converti, `a` = `minDownPaymentPct` ÷ 100 et `f` = frais d'acquisition du pays ÷ 100 (CAL-106 ; 0 par défaut) :

- **budget maximal** `B` = le plus petit de (`C` + `D`) ÷ (1 + `f`) et, quand `a` + `f` > 0, de `D` ÷ (`a` + `f`) : l'apport doit couvrir les frais et au moins la part `a` du prix. Arrondi vers le bas à l'unité ;
- **facteur limitant** : `DOWN_PAYMENT` si la seconde limite est la plus basse, sinon `INCOME` ;
- **apport conseillé** pour utiliser toute la capacité : (`a` + `f`) × `C` ÷ (1 − `a`), arrondi à la centaine supérieure ; le **budget atteignable** serait alors `C` ÷ (1 − `a`), arrondi vers le bas à l'unité. Calculés seulement si le facteur limitant est l'apport ;
- **financement au budget maximal** `Lmax` = `B` × (1 + `f`) − `D` : ce que la banque prêterait pour ce budget. Il vaut `C` quand ce sont les revenus qui limitent, moins quand c'est l'apport. La relation qui tient toujours est donc : **budget × (1 + frais) = financement + apport**. Le produit est **mobilisable en l'état** si `Lmax` ≥ `minAmount` — tout produit, et le barème indicatif aussi, a un montant minimum (PAR-044). Exemple : un apport nul face à un produit qui exige 20 % d'apport donne `B` = 0 ; un apport de 100 € donne `B` = 500 € et un financement de 400 €, sous le minimum : dans les deux cas le produit passe les contrôles, mais il n'est pas mobilisable tant que l'apport manque (CAL-102).

Si un **prix visé** `T` est donné (converti) : frais `F` = `f` × `T` ; besoin de financement `L` = `T` + `F` − `D`. Cinq cas ; le premier qui s'applique, dans cet ordre, donne `target.case`. Quand l'apport manque **et** que, même une fois l'apport complété à (`a` + `f`) × `T`, le prêt restant — `T` × (1 − `a`) — dépasserait encore `C`, le résultat porte les deux manques : l'apport manquant, et la mensualité nécessaire **pour ce prêt-là**. L'écran dit les deux (SIM-013).

| Cas | Condition | Résultat pour ce produit |
|---|---|---|
| Sans financement | `L` ≤ 0 | L'apport couvre le prix et les frais. Finançable ; aucune mensualité. |
| Finançable | `D` ≥ (`a` + `f`) × `T`, `L` ≤ `C` et `L` ≥ `minAmount` | Mensualité pour `L` sur `n` (CAL-040 ou CAL-041). |
| Apport insuffisant | `D` < (`a` + `f`) × `T` | Apport manquant = (`a` + `f`) × `T` − `D`, arrondi à la centaine supérieure. |
| Mensualité trop haute | `L` > `C` | Mensualité nécessaire (pour `L` sur `n`) comparée à `Mmax`. |
| Montant trop faible | `L` < `minAmount` | Le besoin de financement est sous le minimum du produit. |

**CAL-102** `[P1]` **Résultat global** :

| Statut | Condition | Titre affiché |
|---|---|---|
| `ELIGIBLE` | Au moins un produit passe et est mobilisable en l'état ; et, si un prix est visé, au moins un produit le finance. | « Bonne nouvelle : votre projet semble finançable. » |
| `CONDITIONAL` | Au moins un produit passe, mais aucun n'est mobilisable en l'état (l'apport manque), ou le prix visé n'est finançable par aucun. | « Votre projet est finançable avec un ajustement. » suivi de ce qu'il faut ajuster. |
| `NOT_ELIGIBLE` | Aucun produit ne passe. | « En l'état, nous ne trouvons pas de solution standard. Parlons-en. » suivi des raisons en langage simple et du bouton « Être rappelé ». |

Le résultat ne dit jamais « refusé ». Ses chiffres clés viennent d'**un seul produit**, pour rester cohérents entre eux (budget × (1 + frais) = financement + apport, CAL-101) : la **meilleure solution**, c'est-à-dire, parmi les produits mobilisables, celui dont le budget `B` est le plus grand (à égalité : la plus grande capacité, puis le taux le plus bas) ; si aucun n'est mobilisable, celui dont la capacité est la plus grande. De ce produit viennent la capacité, le budget maximal et son financement, la mensualité maximale, la durée retenue, le facteur limitant, l'apport minimum demandé, l'apport conseillé et le budget atteignable. Si aucun produit n'est mobilisable, le budget maximal est **absent** (jamais « 0 ») : l'écran dit l'apport qu'il faut (SIM-012).

Avec un prix visé, le bloc « Votre bien » vient du produit qui finance ce prix avec la **mensualité la plus basse** ; si aucun ne le finance, de la meilleure solution, avec le cas qui s'applique (CAL-101).

Le résultat donne aussi le nombre de solutions compatibles par type (« 2 solutions de crédit classique, 1 solution de financement islamique ») : les produits qui passent les huit contrôles. Le nom d'une banque n'apparaît que si `Bank.isPublic` est vrai.

**CAL-103** `[P1]` **Aucun produit à évaluer** — cas des données de départ ; cas aussi où les produits réels ne sont pas ouverts aux simulateurs publics, ou bien où aucun produit du type voulu n'existe. Le calcul est alors fait avec le **barème indicatif** `finance.indicative` (PAR-044), dans la devise de la simulation : son taux, ses durées minimale et maximale, sa méthode, son taux d'endettement, son apport minimum, son âge limite en fin de financement et son montant minimum (converti dans la devise de la simulation) ; ni contrôle de résidence, ni montant maximum. Le barème tient lieu de produit unique : CAL-101 et CAL-102 s'appliquent tels quels. Le résultat porte `indicative = true`, `solutions` est vide, et l'écran affiche « Estimation réalisée avec un barème indicatif. Un conseiller l'affinera avec les banques partenaires. ». Si le visiteur avait choisi un type de financement pour lequel aucune solution n'est référencée alors que l'autre type en a : la phrase « Nous n'avons pas encore de solution de {type} référencée : un conseiller vous dira ce qui existe. » s'ajoute.

Le barème indicatif est **distinct** du financement de référence des cartes (CAL-030) : l'un nourrit une accroche commerciale, l'autre une estimation de capacité. Un barème indicatif à 0 % surestimerait toute capacité d'emprunt : le taux du barème indicatif est borné à 1 % au moins (PAR-044).

Exemple de contrôle (barème indicatif de départ : 6,50 %, 60 à 300 mois, mensualités constantes, endettement 35 %, apport 20 %, âge limite 70 ans, montant minimum 10 000 €, frais 0) : visiteur de 38 ans, revenus 3 400 €, charges 150 €, apport 35 000 €, prix visé 151 000 € → `Mmax` = 1 040,00 · `n` = 300 · `C` = **154 026** · `B` = le plus petit de 189 026 et de 175 000 = **175 000**, financement `Lmax` = 175 000 − 35 000 = **140 000** (moins que la capacité : c'est l'apport qui limite), facteur `DOWN_PAYMENT`, apport conseillé 38 600 (budget atteignable : 192 532) · prix visé : apport minimal 30 200 ≤ 35 000, `L` = 116 000 ≤ `C` → finançable, mensualité **783,24** · statut `ELIGIBLE`. Avec un apport de 0 € : `B` = 0, produit non mobilisable → `CONDITIONAL`, apport manquant pour le bien visé 30 200. Avec un apport de 100 € : `B` = 500, financement 400 < 10 000 → non mobilisable, `CONDITIONAL` aussi : on n'annonce pas « Bonne nouvelle » pour un budget de 500 €. Visiteur de 67 ans : `nAge` = 36 mois, moins que la durée minimale (60) → `AGE_OR_DURATION`.

**CAL-104** `[P1]` **Sorties** (`Simulation.outputs`). Exemple avec un produit en dinars — valeurs d'exemple, sans rapport avec une offre réelle : cours 1 € = 148,50 DA ; produit à 5,50 %, 60 à 300 mois, âge limite 70 ans, endettement 35 %, apport minimum 10 %, de 1 000 000 à 30 000 000 DA ; visiteur né en 1988, revenus 3 400 €, charges 150 €, apport 30 000 €, prix visé 151 000 €.

```json
{
  "status": "ELIGIBLE",
  "indicative": false,
  "displayCurrency": "EUR",
  "bestProductId": "…",
  "maxMonthlyPayment": "1040.00",
  "capacity": "169356",
  "maxBudget": "199356",
  "maxLoan": "169356",
  "maxBudgetRef": "199356",
  "refCurrency": "EUR",
  "minDownPaymentPct": "10.00",
  "reachableBudget": null,
  "reachableBudgetRef": null,
  "durationMonths": 300,
  "limitingFactor": "INCOME",
  "advisedDownPayment": null,
  "acquisitionFeesPct": "0.00",
  "shown": { "capacity": "169000", "maxBudget": "199000", "maxLoan": "169000", "fees": "0", "reachableBudget": null },
  "target": { "price": "151000", "productId": "…", "case": "FINANCEABLE", "financeable": true, "fees": "0",
              "loan": "121000", "monthlyPayment": "743.05", "missingDownPayment": "0", "requiredMonthlyPayment": null },
  "solutions": { "CONVENTIONAL": 1, "ISLAMIC": 0 },
  "products": [
    { "productId": "…", "bankName": null, "financingType": "CONVENTIONAL", "eligible": true, "usable": true,
      "reasons": [], "durationMonths": 300, "rateBps": 550, "maxMonthlyPayment": "154440.00", "capacity": "25149510",
      "maxBudget": "29604510", "limitingFactor": "INCOME", "currency": "DZD" }
  ],
  "rateDates": { "EUR/DZD": "2026-09-28" }
}
```

Dans ce JSON, un montant est une **chaîne décimale**, jamais un nombre flottant ; sa devise est `displayCurrency` (`currency` pour une ligne de `products`, `refCurrency` pour les deux valeurs « Ref »). Quand l'API le sert, il prend la forme commune de API-002 (`amount`, `currency`). Un pourcentage (`minDownPaymentPct`, `acquisitionFeesPct`) est une chaîne à deux décimales, comme partout (API-002).

Détail du calcul de cet exemple, dans la devise du produit : revenus 504 900 DA, charges 22 275 DA → `Mmax` = 154 440 DA ; `n` = le plus petit de 300 et de (70 − 38) × 12 = 384, soit 300 ; `C` = 25 149 510 DA ; apport 4 455 000 DA ; `B` = le plus petit de 29 604 510 et de 44 550 000 = 29 604 510 DA ; prix visé 22 423 500 DA, `L` = 17 968 500 DA, mensualité 110 342,31 DA, soit 743,05 €.

Les montants de premier niveau sont dans la devise de la simulation, convertis depuis la devise du produit (capacité et budget arrondis vers le bas à l'unité, mensualités à 2 décimales) ; ceux de `products` sont dans la devise du produit. `target.case` vaut `NO_FINANCING_NEEDED`, `FINANCEABLE`, `DOWN_PAYMENT_SHORT`, `PAYMENT_TOO_HIGH` ou `AMOUNT_BELOW_MIN` (les cinq cas de CAL-101). `maxBudget` et `maxLoan` sont `null` quand aucun produit n'est mobilisable ; `reachableBudget` (et sa valeur dans la devise de référence) n'est renseigné qu'avec `advisedDownPayment`, quand l'apport limite. `refCurrency` est la devise de référence **au moment du calcul** : si elle change ensuite (PAR-003), le filtre du catalogue et les propositions du conseiller convertissent `maxBudgetRef` au cours du jour au lieu de comparer des nombres de deux devises (CAT-035). `bankName` est `null` pour une banque non publique (SIM-006). Le bloc `shown` porte les chiffres **tels qu'ils s'affichent** (CAL-026) : capacité, budget et budget atteignable arrondis au palier, financement et frais d'acquisition recalculés sur le budget affiché, pour que le détail s'additionne. L'écran, le PDF et l'e-mail les reprennent sans rien recalculer, et c'est ce financement que reçoit le simulateur de crédit quand aucun bien n'est visé (SIM-031). Sans budget à annoncer, son budget, son financement et ses frais sont `null` ; la capacité et le budget atteignable y restent (SIM-012).

**CAL-106** `[P1]` **Frais d'acquisition** (notaire, droits d'enregistrement, frais de dossier du promoteur). Paramètre `finance.acquisitionFeesPct.{pays}` : pourcentage du prix, **0 par défaut** (Q-045). Tant qu'il vaut 0, les frais ne sont pas comptés et tout résultat d'éligibilité et toute projection portent la mention `legal.feesExcludedNote` : « Hors frais d'acquisition (notaire, droits d'enregistrement), à prévoir en plus : votre conseiller vous les précise. ». Quand il est renseigné, le budget en tient compte (CAL-101) et la mention devient « Frais d'acquisition estimés à {pct} % du prix, inclus dans le calcul. ». Les frais sont supposés payés sur l'apport, jamais financés. La mensualité indicative des cartes (CAL-030) et le simulateur de crédit n'en tiennent pas compte : ils portent sur le prix seul.

**CAL-107** `[P1]` **Simplifications assumées** du simulateur d'éligibilité, pour qu'aucune ne soit réinventée : un seul âge (celui de l'emprunteur principal) ; les revenus du co-emprunteur s'ajoutent, ses crédits en cours font partie des charges saisies ; taux fixe sur toute la durée ; la mensualité maximale s'entend hors assurance ; aucun impôt, aucun reste à vivre minimal. Le conseiller affine avec la banque : c'est ce que dit la mention TRV-024.

## 6. Simulateur de crédit

**CAL-110** `[P1]` **Entrées** (`type = CREDIT`) :

| Champ | Type | Oblig. | Bornes |
|---|---|---|---|
| `mode` | `FROM_PRICE` ou `FROM_AMOUNT` | oui | |
| `price` | montant | selon | `FROM_PRICE`. Strictement positif (CAL-027). Prérempli depuis une fiche : « prix lié à un bien » (CAL-100). |
| `downPayment` | montant | selon | `FROM_PRICE`. 0 accepté. Un apport supérieur ou égal au prix n'est pas une erreur : il n'y a rien à financer (SIM-022). En venant d'une fiche : prérempli à la part d'apport du financement de référence (`downPaymentPct`, PAR-041), comme le taux et la durée (SIM-030). |
| `amount` | montant | selon | `FROM_AMOUNT` : strictement positif. Sinon calculé : prix − apport. |
| `currency` | devise | oui | Devise de la simulation. Défaut : la devise de référence. |
| `durationMonths` | entier | oui | 12 à 480. Curseur par pas de 12. Défaut : la durée la plus longue du barème indicatif (PAR-044) ; en venant d'une fiche : celle du financement de référence (SIM-030). |
| `bankProductId` | UUID | non | Si un produit est choisi : taux (selon la durée, CAL-048), méthode, assurance et frais viennent du produit et ne sont pas modifiables. |
| `annualRateBps` | entier | selon | Sans produit : 0 à 3 000. Défaut : celui du barème indicatif (PAR-044). En venant d'une fiche : celui du financement de référence, pour retrouver la mensualité de la fiche (SIM-030). |
| `pricingMethod` | `PricingMethod` | selon | Sans produit. Défaut `AMORTIZED_RATE`. |
| `insuranceRateBps` | entier | non | Sans produit. 0 à 500. |
| `propertyId`, `lotId` | UUID | non | |

**Sorties** : mensualité hors assurance ; assurance mensuelle ; mensualité totale ; total des intérêts ou de la marge ; frais ; coût total ; total remboursé ; échéancier mensuel et annuel (CAL-043) ; avertissements (`AMOUNT_OUT_OF_PRODUCT_BOUNDS`, `DURATION_OUT_OF_PRODUCT_BOUNDS`, `DOWN_PAYMENT_BELOW_MIN` — sans produit choisi, par rapport à l'apport minimum du barème indicatif, PAR-044, Q-053) ; ou, quand il n'y a rien à financer, le seul indicateur `nothingToFinance`.

**Devise d'un produit.** Quand le produit choisi est dans une autre devise que la simulation : le montant à financer est converti dans la devise du produit (CAL-010) — sauf prix lié à un bien dans cette devise, pris tel quel — ; mensualité, coût, bornes et échéancier sont **calculés dans la devise du produit** ; chaque montant est ensuite converti pour l'affichage (2 décimales), au cours du jour du calcul. Les totaux affichés sont la conversion des totaux, non la somme des lignes converties. L'écran rappelle : « Financement en {devise du produit} ; équivalents à titre indicatif. ».

**CAL-111** `[P1]` **Comparaison de scénarios.** Jusqu'à **trois** scénarios côte à côte, chacun étant un jeu d'entrées complet. « Dupliquer ce scénario » copie les entrées ; l'utilisateur change l'apport, la durée ou le montant. Le tableau comparatif met en évidence la mensualité la plus basse et le coût total le plus bas.

**CAL-112** `[P1]` Le calcul se relance à chaque modification, après 300 ms sans frappe. Les calculs intermédiaires ne sont **pas stockés**. Une simulation est **enregistrée** en base dans ces seuls cas :
- le visiteur arrive à l'écran de résultat du simulateur d'éligibilité : enregistrement **anonyme** (`anonymousId`, `isSaved = false`), purgé après 30 jours (MOD-371) ; pour un client connecté, la simulation porte son `clientId` ;
- il clique « Enregistrer » — éligibilité ou crédit, scénarios compris : la simulation est écrite **tout de suite**, avec `isSaved = true` ; connecté, elle est à lui ; sans compte, elle reste anonyme le temps qu'il crée son espace ou s'y connecte, puis lui est rattachée (SIM-032, MOD-371) ;
- il clique « Recevoir par e-mail » : la simulation est écrite pour produire le PDF ; sans compte, elle reste **anonyme** (SIM-032) ;
- il envoie une demande depuis le simulateur (DEM-016) ;
- un conseiller la crée.

## 7. Projection

**CAL-120** `[P1]` Une **projection** (`type = PROJECTION`) est préparée par un conseiller à partir d'une demande (BNK-080). Entrées : région souhaitée, apport, mensualité confortable — tous deux dans la devise de la demande (la devise de référence, DEM-013) —, puis, au choix du conseiller, un produit bancaire ou le barème indicatif (PAR-044), et une durée. Calcul :

1. montant finançable = capacité (CAL-042) pour la mensualité indiquée, à cette durée et au taux qui lui correspond (CAL-048) ;
2. budget = montant finançable + apport, limité par l'apport minimum et diminué des frais d'acquisition s'ils sont renseignés (formule de `B`, CAL-101) ;
3. biens correspondants : publiés, disponibles, de la région (ou de tout le pays si aucune région n'est donnée), avec `priceFromRef` ≤ budget, triés par pertinence ; le conseiller en garde jusqu'à trois ;
4. pour **chaque bien retenu** : son prix, l'apport du client, le montant à financer — prix + frais d'acquisition − apport, jamais négatif : les frais se paient sur l'apport (CAL-106), comme dans CAL-101 — et **sa** mensualité (formule de la méthode, sur ce montant, cette durée, ce taux) — ce n'est pas la mensualité indicative de la carte, qui suppose un autre apport ;
5. une variante facultative « avec un apport de X » ou « sur une durée de Y », qui refait les étapes 1 à 4.

Sorties : budget, montant finançable, mensualité confortable rappelée, durée, taux ou marge, biens retenus avec leur mensualité, texte libre du conseiller, mention des frais d'acquisition (CAL-106). Rendu : PDF (TRV-142) et page dans l'espace client.

## 8. Complétude

**CAL-050** `[P1]` **Score de complétude d'un bien**, de 0 à 100 :

| Points | Critère |
|---|---|
| 40 | Les **8 champs obligatoires**, 5 points chacun : titre · type · pièces (compté d'office pour un terrain ou un local) · surface · prix (au moins un lot avec un prix) · région (la ville, facultative, n'entre pas dans le compte) · promoteur · livraison (statut, et date si non livré). |
| 20 | **Photos** (`PHOTO` ou `RENDER_3D`, celles du bien ; s'il n'en a aucune, celles de son programme : MOD-236) : 1 → 8 · 2 → 10 · 3 → 12 · 4 → 14 · 5 → 16 · 6 et plus → 20. |
| 10 | Au moins un **plan** (`PLAN`) sur le bien ou sur un de ses lots ; à défaut, sur son programme (MOD-236). |
| 10 | **Visite 360°** : au moins une vue `PANO_360`. |
| 8 | **Description** d'au moins 300 caractères, non générée automatiquement. Deux seuils distincts : publier un programme demande 100 caractères (`DESCRIPTION_LENGTH`, CYC-125) ; ces points de complétude en demandent 300. |
| 6 | Au moins 5 **caractéristiques** cochées. |
| 6 | **Localisation** : 3 points si le bien ou son programme a des coordonnées ; 3 points s'il a au moins 3 points d'intérêt. |

Seuils : **publiable** à partir de `catalogue.publishMinScore` (60) ; **fiche complète** à partir de `catalogue.completeScore` (85). Le score n'est jamais public.

Quand une fonction `[P1]` est désactivée, les points qu'elle seule permet de gagner sortent du calcul — 10 pour la visite 360° (`features.tour360`), 3 pour les points d'intérêt (`features.poi`) — et le score est ramené sur 100 : score = arrondi (100 × points obtenus ÷ points possibles). Les actions correspondantes ne sont pas proposées (CAL-051). Exemple, les deux fonctions désactivées (87 points possibles) : les 8 champs obligatoires et 3 photos = 52 points → 60, publiable ; les 8 champs et 1 photo = 48 points → 55, pas encore.

**CAL-051** `[P1]` Le back-office accompagne le score d'une liste d'**actions** triées par gain décroissant : « Ajouter 5 photos (+12) », « Ajouter le plan (+10) », « Ajouter la visite 360° (+10) »… Les champs obligatoires manquants passent en premier, marqués « obligatoire ».

**CAL-055** `[P1]` **Complétude d'un dossier** :

```
pièces obligatoires = pièces du dossier avec isRequired, hors emprunteurs retirés
pièces satisfaites  = parmi elles, celles à l'état VALIDATED ou WAIVED
completenessPct     = partie entière de (100 × satisfaites / obligatoires)   ; 100 s'il n'y a aucune pièce obligatoire
```

Le dossier est **complet** quand `completenessPct` = 100 et qu'aucune information nécessaire à sa liste ne manque (GED-020). Une pièce `EXPIRED` n'est pas satisfaite. Ne comptent que les pièces de la liste du client et celles ajoutées à la main ; les pièces propres à une banque (liste `BANK_FILE`, compléments `BANK_REQUEST`) sont comptées par soumission (CYC-161). Exemple : 8 pièces satisfaites sur 12 → 66 %. Côté client, le compteur dit la même chose : « {x} pièces validées ou non demandées sur {y} », avec `x` = satisfaites et `y` = obligatoires (DOS-001, Q-052).

## 9. Calendrier de travail et délais

**CAL-060** `[P1]` **Calendrier.** Paramètres : `business.calendar.workdays` (défaut lundi à vendredi), `business.calendar.start` (`09:00`), `business.calendar.end` (`18:00`), `business.calendar.timezone` (`Europe/Paris`), et la table `Holiday`. Un instant est **ouvré** s'il tombe un jour travaillé, non férié, entre l'heure de début et l'heure de fin.

Deux fonctions :
- `ajouterJoursOuvrés(instant, j)` : si l'instant n'est pas ouvré, il est d'abord repoussé à la prochaine ouverture ; puis on avance de `j` jours travaillés non fériés, à la même heure ;
- `ajouterMinutesOuvrées(instant, m)` : on consomme `m` minutes en ne comptant que le temps ouvré ; avec `m` négatif, on recule d'autant de minutes ouvrées (une étape déjà en retard au moment d'une pause l'est encore à la reprise, CYC-032).

Exemples (calendrier par défaut) : vendredi 16 h + 2 jours ouvrés → mardi 16 h · samedi 11 h + 2 jours ouvrés → mercredi 9 h · jeudi 17 h 30 + 60 minutes ouvrées → vendredi 9 h 30.

**CAL-061** `[P1]` **Délai de premier contact** d'une demande : `slaDueAt` = `ajouterJoursOuvrés(createdAt, sla.firstContactBusinessDays)`. Défaut : 2 jours ouvrés. C'est ce que le site appelle « sous 48 h ouvrées ». Toute demande reçoit cette échéance, qu'elle ouvre un dossier ou non (un message de contact attend aussi sa réponse) ; seule une candidature de partenaire n'en a pas.

Si le visiteur a choisi un **jour de rappel** (`preferredCallbackDate`) plus tardif que cette échéance, l'échéance devient la fin de ce jour-là (heure de fermeture du calendrier) : on ne compte pas en retard un rappel demandé pour plus tard. La confirmation et l'accusé de réception disent alors « le {jour choisi} », pas « sous 48 h ».

**CAL-062** `[P1]` **Échéance d'une étape** de dossier : `slaDueAt` = `ajouterJoursOuvrés(stageEnteredAt, sla.stage.{ÉTAPE})`. Valeurs par défaut (Q-038) :

| Étape | Jours ouvrés |
|---|---|
| `INTEREST` | 1 |
| `QUALIFICATION` | 5 |
| `MATCHING` | 20 |
| `DOCUMENTS` | 30 |
| `BANK_REVIEW` | 45 |
| `APPROVED` | 10 |
| `ACQUISITION` | 90 |

Un dossier dont `slaDueAt` est passé est **en retard** : pastille rouge dans le pipeline, compté dans le tableau de bord. La pause suspend le décompte (CYC-031).

**CAL-063** `[P1]` **Durées mesurées.** Le temps passé dans une étape est enregistré deux fois à la sortie de l'étape (`DossierStageHistory`) : en secondes de calendrier (`secondsInPreviousStage`) et en **minutes ouvrées** (`businessMinutesInPreviousStage`, par `ajouterMinutesOuvrées` à l'envers), pauses exclues dans les deux cas. Les délais moyens des rapports (M16) se comparent aux cibles de CAL-062 en **jours ouvrés** : minutes ouvrées ÷ minutes d'une journée de travail (540 avec le calendrier par défaut). Le délai de premier contact se mesure de la même façon.

## 10. Score de préqualification

**CAL-070** `[P1]` Le **score** d'un client (0 à 100) aide le conseiller à prioriser. Il est recalculé quand change : la fiche du client, une simulation d'éligibilité, une demande, une inscription à un Café, son compte.

| Bloc | Points | Règle |
|---|---|---|
| **Joignable** | 20 | Téléphone valide (`Client.phone` renseigné et `Client.phoneCheckNeeded` faux) : 10 · e-mail vérifié (`User.emailVerifiedAt` renseigné ; 0 sans compte) : 5 · joignable sur WhatsApp : 5. |
| **Projet** | 20 | Horizon d'achat : dans les 6 mois 20 · 6 à 12 mois 14 · plus d'un an 6 · inconnu 0. |
| **Financement** | 40 | D'après la simulation d'éligibilité la plus récente : `ELIGIBLE` 40 · `CONDITIONAL` 25 · `NOT_ELIGIBLE` 5. Sans simulation : la **ligne la plus élevée** qui s'applique, sans cumul — achat sans financement (`financingPreference = CASH`) avec un budget indiqué 40 · apport connu d'au moins 15 % du budget 20 (`Client.downPayment` comparé à `Client.budgetMax`, converti dans la devise du budget, CAL-010 ; sans `budgetMax` ou sans cours, ce critère ne rapporte rien) · revenus connus 10 · rien 0. |
| **Engagement** | 20 | Compte créé : 5 · au moins un intérêt pour un bien précis : 5 · inscrit à un Café : 5, ou présent à un Café : 10. Plafonné à 20. |

Exemple : téléphone valide, e-mail vérifié, horizon de 6 à 12 mois, aucune simulation, crédit souhaité, apport de 30 000 € pour un budget de 150 000 €, revenus connus, compte créé, un intérêt pour un bien : 15 + 14 + 20 + 10 = **59**, Tiède.

Libellés dans le back-office : **Chaud** (70 et plus), **Tiède** (40 à 69), **Froid** (moins de 40). Le score et son détail ne sont jamais montrés au client (ROL-031).

## 11. Pertinence et biens similaires

**CAL-080** `[P1]` **Tri « Pertinence »** du catalogue. `Property.relevanceScore` (cache, 0 à 100), recalculé à chaque changement du bien et chaque nuit :

```
40 × disponibilité   (AVAILABLE 1 · RESERVED 0,3 · sinon 0)
+ 25 × fraîcheur     (1 si publié depuis 14 jours ou moins, puis décroissance linéaire jusqu'à 0 à 180 jours)
+ 20 × complétude    (completenessScore / 100)
+ 15 × financement   (1 si financingEligible)
```

La fraîcheur se compte depuis `firstPublishedAt` : une republication ne rajeunit pas un bien.

Ordre : biens épinglés d'abord (`featuredRank` croissant), puis `relevanceScore` décroissant, puis date de première publication décroissante.

**CAL-081** `[P1]` **Biens similaires** d'un bien : même pays, même type, publiés, disponibilité `AVAILABLE`, `priceFromRef` à ± 25 %, hors le bien lui-même. Tri : même région d'abord, puis écart de prix croissant. Trois résultats au plus. S'il y en a moins de deux : la recherche est élargie à ± 40 %, tous types de bien confondus (toujours dans le même pays). S'il y en a encore moins de deux : la section est masquée.
