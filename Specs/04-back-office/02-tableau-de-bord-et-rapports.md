# Back-office — tableau de bord et rapports

Écrans **EA-01** (tableau de bord) et **EA-02** à **EA-09** (rapports). Contrat : offre technique, § 4.9 — indicateurs clés, satisfaction, performance commerciale, filtres et exports, vue d'activité.

Ce fichier fixe la **définition exacte** de chaque indicateur : un chiffre affiché doit pouvoir être recompté à la main.

---

## 1. Tableau de bord (EA-01)

**TDB-001** `[P1]` Première page après la connexion. Son contenu dépend du rôle :

| Bloc | Direction, Administrateur | Conseiller | Lecture seule | Support |
|---|---|---|---|---|
| Ma journée (TDB-005) | oui | oui | — | — |
| À régler (TDB-010) | oui | les lignes qui le concernent | — | — |
| Indicateurs clés (TDB-012) | toute l'équipe | son périmètre | toute l'équipe | — |
| Entonnoir des dossiers | oui | son périmètre | oui | — |
| Activité récente (TDB-015) | oui | son périmètre | oui | — |
| Catalogue en bref | oui | oui | oui | — |
| Diagnostic | — | — | — | redirigé vers ADM-080 |

**TDB-005** `[P1]` **Ma journée.** Cinq cartes, chacune avec un compteur et la liste de ses cinq premiers éléments ; un clic ouvre la liste complète, filtrée.

| Carte | Contenu | Ordre |
|---|---|---|
| Demandes à contacter | Mes demandes sans premier contact, et les demandes non affectées. | Échéance de premier contact la plus proche d'abord ; les dépassées en rouge. |
| Tâches | Mes tâches en retard et celles du jour. | Retard d'abord, puis échéance. |
| Pièces à vérifier | Les dossiers que je suis ayant des pièces à vérifier : reçues, ou renouvelées (GED-040). | Dépôt le plus ancien d'abord. |
| Messages | Les fils où un client attend ma réponse. | Le plus ancien d'abord. |
| Rendez-vous | Mes rendez-vous du jour et du lendemain. | Chronologique. |

Tout est vide : « Rien d'urgent. Bonne journée. ».

**TDB-010** `[P1]` **À régler** — un bandeau de lignes, chacune avec un lien vers l'écran qui la règle. Une ligne disparaît quand sa cause disparaît.

| Ligne | Condition |
|---|---|
| « Avant la mise en ligne : {n} points à régler » | PAR-100 |
| « Le financement de référence est à 0 % » | `finance.reference.*` dont le taux a été mis à 0 par l'administrateur (PAR-041) ; jamais avec la valeur de départ (650) |
| « Le taux de change est une valeur d'exemple » · « … date du {date} » | PAR-042, AUT-072 |
| « Le barème indicatif des simulateurs est une valeur d'exemple » | PAR-044, tant qu'il n'a pas été enregistré par la Direction |
| « {n} demandes attendent d'être prises en charge » | Demandes `NEW` non affectées |
| « {n} demandes écartées par le filtre sont à vérifier » | Demandes `SPAM` avec `needsReview` (DEM-031) |
| « {n} demandes ont dépassé le délai de premier contact » | CYC-007 |
| « {n} dossiers sont en retard sur leur étape » | CAL-062 |
| « {n} e-mails n'ont pas pu être remis » | E-mails `BOUNCED` ou `FAILED` des 7 derniers jours |
| « {n} acomptes sont à suivre » | Réservations terminées dont l'acompte est `DUE` (CYC-108) |
| « {n} options attendent la confirmation du promoteur » | Réservations `OPTION` posées depuis plus d'un jour ouvré, sans confirmation (CYC-107) |
| « {n} programmes ont des disponibilités à vérifier » · « {n} barèmes sont à vérifier » | AUT-079 |
| `[P2]` `[P3]` « {n} réponses de partenaires sont à relire » | Réponses `PENDING` (ACP-031) |
| « {prénom} est absent ou suspendu : {n} demandes, dossiers et tâches à réaffecter » | CRM-021, ADM-030 |
| « Une purge de conservation attend votre confirmation » | PAR-006 (Direction) |
| « {n} conventions arrivent à échéance » | AUT-073 |
| « {n} programmes ont une date de livraison dépassée » | AUT-074 |
| « {n} demandes d'exercice de droits à traiter » | CYC-230 |
| « {n} biens publiés ont une fiche incomplète » | Score inférieur à `catalogue.completeScore` |
| « Recalcul des prix en cours » | AUT-080 |

**Pour un conseiller** (« les lignes qui le concernent », TDB-001), seules s'affichent, comptées sur son périmètre (TDB-032) : les demandes qui attendent d'être prises en charge (non affectées) ; les demandes qui ont dépassé le délai de premier contact (les siennes et les non affectées) ; ses dossiers en retard ; les e-mails non remis qu'il a envoyés ou qui étaient adressés à ses clients ; les acomptes et les options de ses dossiers. Les autres lignes sont réservées à la Direction et aux administrateurs.

**TDB-012** `[P1]` **Indicateurs clés** : huit tuiles, pour la période choisie (TDB-030), chacune avec sa valeur et son évolution par rapport à la période précédente de même durée : Nouvelles demandes (M01) · Premier contact dans le délai (M04) · Dossiers ouverts (M06) · Dossiers complets en attente d'envoi (M24) · Soumissions envoyées (M10) · Taux d'accord (M11) · Dossiers gagnés (M13) · Satisfaction (M19). Un clic sur une tuile ouvre le rapport correspondant. La tuile M24 est un **état du jour** : elle ne dépend pas de la période choisie et n'affiche pas d'évolution. La tuile Satisfaction montre l'indice de satisfaction de M19 ; la tuile Dossiers gagnés, le nombre (les montants sont dans le rapport). **Évolution** : écart absolu pour un nombre (« +3 », « −2 »), en points pour un taux ou un indice (« +4 pts ») ; « — » quand la période précédente n'a pas de donnée.

**TDB-013** `[P1]` **Entonnoir des dossiers** : une barre par étape, avec le nombre de dossiers ouverts (M06), dont ceux en pause et ceux en retard. Un clic sur une étape ouvre le pipeline filtré.

**TDB-014** `[P1]` **Catalogue en bref** : biens publiés · lots disponibles, sous option, réservés, vendus · les cinq biens les plus vus et les cinq qui reçoivent le plus d'intérêts **sur la période** — comptés dans `PropertyDailyStat`, jour par jour (FIC-100), et non dans le total cumulé de la fiche.

**TDB-015** `[P1]` **Activité récente** (« vue d'activité » du contrat) : les 30 derniers faits marquants de l'équipe, du plus récent au plus ancien : demande reçue, demande prise en charge, dossier changé d'étape, pièce validée ou rejetée, soumission envoyée, décision d'une banque, réservation, dossier gagné ou clôturé, bien publié, inscription à un Café. Chaque ligne : l'auteur, le fait, l'objet (lien), la date relative. **Source** : le journal d'audit pour les faits de l'équipe et du système — `lead.taken`, `dossier.stage_changed`, `document.validated`, `document.rejected`, `submission.status_changed` (passage à « Envoyée »), `submission.decision_recorded`, `reservation.created`, `dossier.closed` (gagné ou clôturé, selon l'état d'arrivée), `property.published` — et, pour les deux faits d'un visiteur, que le journal ne trace pas (SEC-080), les objets eux-mêmes : une demande reçue (`Lead.createdAt`, hors `SPAM`) et une inscription à un Café `[P1]` (`EventRegistration.registeredAt`), avec l'auteur « Site ». Les deux sources sont fusionnées par date ; un conseiller n'y voit que son périmètre (TDB-032). Le détail complet et la recherche sont dans le journal d'audit (ADM-050).

## 2. Indicateurs

**TDB-020** `[P1]` Définitions. « P » = la période choisie. Les demandes à l'état `SPAM` sont **toujours exclues**. Les objets supprimés aussi.

| Code | Indicateur | Définition |
|---|---|---|
| M01 | Nouvelles demandes | Demandes créées pendant P. Ventilation : par nature, par origine (`source`), par campagne (`utm`). |
| M02 | Demandes prises en charge | Parmi M01, hors candidatures de partenaires : part de celles dont `takenAt` est renseigné. |
| M03 | Délai de premier contact | Pour les demandes créées pendant P qui ont une échéance de premier contact (toutes, sauf les candidatures de partenaires : CAL-061) et un premier contact : temps **ouvré** entre `createdAt` et `firstContactAt`. Moyenne et médiane, en heures ouvrées. |
| M04 | Premier contact dans le délai | Parmi les demandes créées pendant P qui ont une échéance et dont l'échéance est passée : part de celles contactées avant `slaDueAt` (pour un rappel demandé à un jour précis, l'échéance est ce jour-là). Une demande non contactée dont l'échéance est passée compte comme hors délai. |
| M05 | Taux de qualification | Parmi les dossiers ouverts pendant P : part de ceux qui ont atteint l'étape `MATCHING`. |
| M06 | Dossiers ouverts | À la fin de P : dossiers `OPEN` ou `ON_HOLD`, par étape. |
| M07 | Dossiers en retard | Aujourd'hui : dossiers `OPEN` dont `slaDueAt` est passé. |
| M08 | Complétude moyenne | Moyenne de `completenessPct` des dossiers `OPEN` à l'étape `DOCUMENTS`. |
| M09 | Délai de constitution | Pour les dossiers devenus complets pendant P : jours ouvrés entre l'entrée à l'étape `DOCUMENTS` et `completedAt`. Moyenne et médiane. |
| M10 | Soumissions envoyées | Soumissions dont `submittedAt` est dans P. Par banque, par type de financement. |
| M11 | Accords, refus, taux d'accord | Soumissions dont `decisionAt` est dans P, par statut. Taux d'accord = accordées ÷ (accordées + refusées). |
| M12 | Délai de décision | Pour les décisions de P : jours calendaires entre `submittedAt` et `decisionAt`. Moyenne et médiane. |
| M13 | Dossiers gagnés | Dossiers dont `wonAt` est dans P. Nombre, et somme de `saleAmount` par devise. |
| M14 | Dossiers clôturés | Dossiers dont `lostAt` est dans P, par motif et par étape au moment de la clôture. |
| M15 | Taux de transformation | Parmi les dossiers **ouverts** pendant P : part de ceux qui sont gagnés à ce jour. Affiché avec la part encore en cours, pour ne pas lire trop tôt une cohorte récente. |
| M16 | Durée par étape | Pour les sorties d'étape de P : moyenne du temps **ouvré** passé dans l'étape, hors pauses (`DossierStageHistory.businessMinutesInPreviousStage`), exprimée en jours ouvrés, comparée au délai cible `sla.stage.*`, lui aussi en jours ouvrés (CAL-063) : on compare des jours ouvrés à des jours ouvrés. La durée calendaire est donnée à côté, à titre d'information. |
| M17 | Simulations | Simulations créées pendant P, par type. « Devenues demande » : part de celles rattachées à une demande, ou dont le client a envoyé une demande dans les 30 jours. |
| M18 | E-mails | E-mails sortants dont `sentAt` est dans P : envoyés, taux de remise, taux de rejet ; par modèle. |
| M19 | Satisfaction | Sur les réponses aux enquêtes (retours de nature `SURVEY_RESPONSE`) reçues pendant P ; un avis spontané n'y entre pas (PRO-071). **Recommandation** = part des notes 9 et 10 − part des notes 0 à 6, exprimée en points : un entier signé de −100 à +100, sans « % ». **Satisfaction** = part des notes 4 et 5. **Taux de réponse** = parmi les invitations envoyées pendant P, part de celles qui sont répondues à ce jour. Par enquête. Moins de 5 réponses : « Pas assez de réponses ». |
| M20 | Cafés `[P1]` | Pour chaque Café de P : capacité, places inscrites, places présentes, taux de présence (présentes ÷ inscrites, seulement si un pointage a été fait), liste d'attente, et demandes envoyées par les présents dans les 30 jours. |
| M21 | Catalogue | Par bien, programme, promoteur, sur P : vues et intérêts (somme des lignes `PropertyDailyStat` de P), taux d'intérêt (intérêts ÷ vues), options, réservations, ventes (définitions de CTL-005). |
| M22 | Revenus notés (Q-001) | Somme de `commissionAmount` et de `clientFeeAmount` des dossiers gagnés pendant P, chacun par devise. Visible avec la permission `dossier.commission.manage` seulement. |
| M23 | Activité par conseiller | Par conseiller, sur P : demandes prises en charge, M03, dossiers ouverts à ce jour, gagnés, clôturés, tâches terminées et en retard, pièces vérifiées, délai moyen de réponse aux messages. |
| M24 | Dossiers complets en attente d'envoi | Aujourd'hui : dossiers `OPEN` à l'étape `DOCUMENTS`, complets (CAL-055), avec financement, sans aucune soumission envoyée. Ventilation : avec ou sans accord de transmission du client. |

**TDB-021** `[P1]` Un indicateur sans donnée affiche « — », jamais « 0 % » ni une division par zéro. Une moyenne calculée sur moins de trois objets le signale (« sur 2 dossiers »). Moyennes et médianes s'affichent avec une décimale (« 11,0 h », « 4,5 jours ») ; la médiane d'un nombre pair de valeurs est la moyenne des deux valeurs centrales.

**TDB-022** `[P1]` Les montants de devises différentes ne sont **pas additionnés** : ils sont présentés par devise. Un total converti, quand il est affiché, porte « ≈ » et la date du taux.

## 3. Période, filtres, périmètre

**TDB-030** `[P1]` **Période** : 7 derniers jours · 30 derniers jours (défaut) · Ce mois · Mois dernier · Ce trimestre · Cette année · Personnalisée (deux dates, 24 mois au plus). Les bornes sont des journées entières dans le fuseau du calendrier de travail ; une période qui atteint aujourd'hui inclut aujourd'hui (« 30 derniers jours » = aujourd'hui et les 29 jours qui précèdent). **Période de comparaison** : pour « 7 derniers jours », « 30 derniers jours » et « Personnalisée », les jours, en même nombre, qui précèdent immédiatement ; pour « Ce mois », « Ce trimestre » et « Cette année », la même portion de la période calendaire précédente (le 7 octobre, « Ce mois » = 1er–7 octobre, comparé au 1er–7 septembre ; une portion qui déborderait la période précédente s'arrête à sa fin) ; pour « Mois dernier », le mois calendaire d'avant, entier.

**TDB-031** `[P1]` **Filtres** communs aux rapports : conseiller · pays · région · promoteur · banque · origine de la demande · type de financement. Ils sont dans l'adresse (TRV-101).

**TDB-061** `[P1]` **Sens des filtres.** Chaque filtre porte sur un attribut précis, selon l'objet compté :

| Filtre | Demandes (M01 à M04) | Dossiers (M05 à M09, M13 à M16, M22 à M24) et soumissions (M10 à M12) | Retours (M19) | Catalogue (M21, TDB-014) |
|---|---|---|---|---|
| Conseiller | `Lead.assignedAgentId` | `Dossier.assignedAgentId` (pour une soumission : celui de son dossier) | conseiller du dossier du retour | — |
| Pays | pays de résidence du client (`Client.countryOfResidence`) | idem | idem | pays du bien |
| Région | région du bien de la demande | région du bien retenu du dossier | région du bien du retour (`Feedback.propertyId`), sinon du bien retenu de son dossier | région du bien |
| Promoteur | promoteur du bien ou du programme de la demande | `Dossier.promoterId` | `Feedback.promoterId` | promoteur du bien |
| Banque | — | banque de la soumission (M10 à M12 seulement) | `Feedback.bankId` | — |
| Origine de la demande | `Lead.source` | origine de la demande qui a ouvert le dossier (`Dossier.originLeadId`) ; un dossier sans demande d'origine est écarté quand ce filtre est posé | — | — |
| Type de financement | — | `Dossier.financingType` | — | — |

« — » : le filtre ne s'applique pas. À côté d'un indicateur auquel un filtre posé ne s'applique pas, le filtre est grisé avec « Ce filtre ne s'applique pas à ces chiffres », et l'indicateur est calculé sans lui. Les indicateurs absents de ce tableau (M17, M18, M20) ne prennent que la période et le périmètre du lecteur (TDB-032).

**TDB-032** `[P1]` **Périmètre.** Un conseiller ne voit que les objets qui lui sont affectés (ROL-018), et ne peut pas choisir un autre conseiller dans le filtre (`report.read` limité). Ce qui n'est affecté à personne se lit ainsi : le catalogue (TDB-014, M21, EA-06) est celui de toute l'équipe ; M17 compte les simulations de ses clients ; M18, les e-mails qu'il a envoyés et les e-mails automatiques adressés à ses clients ; M19, les retours rattachés à ses dossiers, à défaut à ses clients. Le rapport de l'équipe (EA-09) lui est fermé ; M22 l'est à quiconque n'a pas `dossier.commission.manage`.

**TDB-033** `[P1]` **Fraîcheur.** Les indicateurs sont calculés à la demande, à partir des données, puis gardés 5 minutes. Chaque rapport affiche « Calculé à {heure} » et un bouton « Actualiser ».

## 4. Rapports

**TDB-050** `[P1]`

| Écran | Rapport | Contenu |
|---|---|---|
| EA-02 | Activité commerciale | M01 à M07, M13, M15 ; courbe des demandes et des dossiers gagnés par semaine ; entonnoir. |
| EA-03 | Demandes et origines | M01 par nature, origine, campagne, première page vue ; pour chaque origine : demandes, dossiers ouverts, dossiers gagnés. |
| EA-04 | Dossiers | Entonnoir ; M16 par étape avec le délai cible ; M14 par motif et par étape ; M08, M09 ; liste des dossiers en retard. |
| EA-05 | Financement | Par banque et par produit : M10, M11, M12 ; soumissions en cours et leur ancienneté ; offres à échéance proche. |
| EA-06 | Catalogue | M21 par promoteur, programme, bien ; lots par statut ; biens sans photo réelle ; biens à fiche incomplète. |
| EA-07 | Satisfaction | M19 par enquête et dans le temps ; répartition des notes ; derniers commentaires ; retours négatifs non traités. |
| EA-08 | Cafés `[P1]` | M20 par Café ; évolution des inscriptions. |
| EA-09 | Équipe | M23 ; M22. |

**TDB-051** `[P1]` Chaque rapport présente : ses tuiles, un ou deux graphiques, puis le **tableau** des données, triable. Un clic sur un chiffre ouvre la liste des objets qui le composent, filtrée de la même façon : Demandes (M01 à M04), Dossiers (M05 à M08, M13, M15, M16, M24), Soumissions (M10, M11), Retours (M19), Biens (M21), M09, M12, M14. Ces listes acceptent, dans leur adresse (TRV-101) et dans leur route d'API, le paramètre `metric` (code de l'indicateur), avec la période (`periodFrom`, `periodTo`) et les filtres de TDB-031 : le serveur applique la définition de l'indicateur et rend exactement les objets comptés — pour un taux ou une moyenne, ceux sur lesquels il est calculé. La liste affiche la pastille « Depuis le rapport {nom} : {indicateur} » ; la retirer rend la liste ordinaire. Les autres indicateurs ne s'ouvrent pas au clic.

**TDB-052** `[P1]` **Graphiques.** Courbe pour une évolution dans le temps ; barres pour une comparaison ; entonnoir pour les étapes. Pas de camembert au-delà de cinq parts. Chaque graphique a un titre qui dit ce qu'il montre, des axes libellés, et son tableau de données juste dessous (accessibilité, TRV-121). Les couleurs viennent du système de design ; une information n'est jamais portée par la couleur seule.

**TDB-060** `[P1]` **Exports** (`report.export`) : le tableau d'un rapport en CSV ou XLSX ; le rapport complet en PDF (TRV-142), avec la période, les filtres et l'heure du calcul. Tracés (BO-041).

## 5. Jeu de contrôle

**TDB-062** `[P1]` **Jeu de contrôle** du parcours P22. Une commande de test (refusée en production) le charge, en insérant tels quels les objets et l'historique des étapes (`DossierStageHistory`), sans rejouer les règles d'ouverture ni de prise en charge (CYC-002, CYC-003) ; pour la période « 30 derniers jours », il doit donner les chiffres ci-dessous, calculés à la main. Il couvre le tableau de bord et les rapports EA-02, EA-06 et EA-07. Calendrier de travail par défaut (lundi à vendredi, 9 h – 18 h, `Europe/Paris`, aucun jour férié en octobre 2026) ; horloge de l'application fixée au **vendredi 30 octobre 2026, 12 h** (ENV-032) : P = du 1er au 30 octobre 2026, période de comparaison = du 1er au 30 septembre 2026 (TDB-030). Heures de Paris.

**Demandes**

| Demande | Nature · origine | Créée le | Prise en charge | Premier contact | Échéance (CAL-061) |
|---|---|---|---|---|---|
| D1 | `PROPERTY_INTEREST` · `WEB_FORM` | lundi 5 oct., 10 h | 5 oct., 11 h | 5 oct., 14 h | mercredi 7 oct., 10 h |
| D2 | `CALLBACK_REQUEST` · `WEB_FORM` | mardi 6 oct., 17 h | 7 oct., 9 h 30 | 7 oct., 10 h | jeudi 8 oct., 17 h |
| D3 | `CONTACT_MESSAGE` · `WEB_FORM` | lundi 12 oct., 9 h | 12 oct., 10 h | jeudi 15 oct., 9 h | mercredi 14 oct., 9 h |
| D4 | `PROPERTY_INTEREST` · `PHONE` | lundi 26 oct., 10 h | — | — | mercredi 28 oct., 10 h |
| D5 | `PROPERTY_INTEREST` · `WEB_FORM` | jeudi 29 oct., 15 h | — | — | lundi 2 nov., 15 h |
| D6 | `PARTNER_REQUEST` · `WEB_FORM` | mercredi 7 oct., 11 h | — | — | aucune |
| D7 | `PROPERTY_INTEREST` · `WEB_FORM`, état `SPAM` | jeudi 8 oct., 3 h | — | — | — |
| D8 | `PROPERTY_INTEREST` · `WEB_FORM` | lundi 21 sept., 10 h | 21 sept., 10 h 30 | 21 sept., 11 h | mercredi 23 sept., 10 h |

**Dossiers et soumissions**

| Dossier | Ouvert le | Ce qui s'y passe | État le 30 oct. |
|---|---|---|---|
| A | 5 oct. (D1) | `MATCHING` le 12 oct., `DOCUMENTS` le 19 oct. ; complet le 27 oct., avec financement, accord de transmission donné, aucune soumission | `OPEN`, `DOCUMENTS` |
| B | 7 oct. (D2) | `QUALIFICATION` le 8 oct. ; mis en pause le 20 oct. | `ON_HOLD`, `QUALIFICATION` |
| C | 1er sept. | soumissions S1 (banque X) et S2 (banque Y) envoyées le 2 oct. ; S1 accordée le 16 oct., S2 refusée le 20 oct. ; gagné le 28 oct., 120 000 EUR | `WON` |
| D | 3 août | gagné le 15 oct., 18 000 000 DZD | `WON` |
| E | 12 oct. (D3) | `QUALIFICATION` le 13 oct. ; clôturé le 22 oct. (`UNREACHABLE`) | `LOST` |
| F | 14 oct. | `QUALIFICATION` le 14 oct., `MATCHING` le 16 oct., reculé en `QUALIFICATION` le mercredi 21 oct. à 10 h (échéance : mercredi 28 oct., 10 h) | `OPEN`, `QUALIFICATION` |

Heures des étapes : A est ouvert le 5 oct. à 15 h, à l'étape `QUALIFICATION`, et ses changements d'étape ont lieu à 15 h. Les autres ouvertures et changements d'étape ont lieu à 10 h : B (le 7 oct.) et E (le 12 oct.) sont ouverts à `INTEREST`, F (le 14 oct.) à `QUALIFICATION` ; C passe à `DOCUMENTS` le lundi 21 sept., à `BANK_REVIEW` le 2 oct. par l'envoi de ses soumissions (CYC-023), à `APPROVED` le 16 oct. (accord de S1 publié à 10 h) et à `ACQUISITION` le lundi 19 oct. ; D est à `ACQUISITION` depuis août.

**Retours** : enquête `ACQUISITION`, 6 invitations envoyées pendant P ; 5 réponses reçues pendant P, notées (recommandation, satisfaction) : (10, 5) · (10, 4) · (9, 4) · (7, 3) · (4, 2). Un avis spontané noté 2, le 20 oct.

**Catalogue** : bien B1, lignes `PropertyDailyStat` de P : 200 vues, 10 intérêts (et 50 vues le 30 septembre, hors période) ; bien B2 : aucune vue, aucun intérêt.

**Chiffres attendus**

| Indicateur | Valeur attendue | Pourquoi |
|---|---|---|
| M01 | 6 — `PROPERTY_INTEREST` 3, `CALLBACK_REQUEST` 1, `CONTACT_MESSAGE` 1, `PARTNER_REQUEST` 1 ; `WEB_FORM` 5, `PHONE` 1 ; évolution « +5 » | D1 à D6 ; D7 exclue (`SPAM`), D8 hors période ; période de comparaison : D8 seule |
| M02 | 60 % | D1, D2, D3 prises en charge, sur D1 à D5 (D6, candidature, n'y entre pas) |
| M03 | moyenne 11,0 h ; médiane 4,0 h | D1 : 4 h ; D2 : 2 h (1 h le mardi, 1 h le mercredi) ; D3 : 27 h (trois journées de 9 h) |
| M04 | 50 % ; évolution « −50 pts » | échéance passée : D1, D2, D3, D4 ; dans le délai : D1, D2 (D3 contactée après son échéance, D4 jamais) ; D5 pas encore échue ; période de comparaison : D8 dans le délai, 100 % |
| M05 | 50 % | ouverts pendant P : A, B, E, F ; ont atteint `MATCHING` : A, F |
| M06 | 3 — `QUALIFICATION` 2 (dont 1 en pause), `DOCUMENTS` 1 | A, B, F |
| M07 | 1 | F |
| M08 | 100 % (sur 1 dossier) | A, seul dossier `OPEN` à l'étape `DOCUMENTS`, complet |
| M10 | 2 — banque X 1, banque Y 1 | S1, S2 |
| M11 | 1 accordée, 1 refusée ; taux d'accord 50 % | S1, S2 |
| M13 | 2 — 120 000 EUR et 18 000 000 DZD, non additionnés (TDB-022) | C, D |
| M15 | 0 % gagnés, 75 % encore en cours (« 0 % » et non « — » : il y a des dossiers) | A, B, F en cours, E clôturé, sur 4 |
| M16 | `INTEREST` 1,0 j (sur 2 dossiers) · `QUALIFICATION` 3,5 j (sur 2 dossiers) · `MATCHING` 5,0 j (sur 1 dossier) · `DOCUMENTS` 9,0 j (sur 1 dossier) · `BANK_REVIEW` 10,0 j (sur 1 dossier) · `APPROVED` 1,0 j (sur 1 dossier) ; en calendaire : 1,0 · 4,5 · 7,0 · 11,0 · 14,0 · 3,0 j | sorties de P : B et E depuis `INTEREST` (1 j ouvré chacun) ; A (5 j) et F (2 j) depuis `QUALIFICATION` ; A depuis `MATCHING` (5 j) ; C depuis `DOCUMENTS` (9 j), `BANK_REVIEW` (10 j) et `APPROVED` (1 j) ; le recul de F, la pause de B et les clôtures ne comptent pas |
| M19 | recommandation « +40 » ; satisfaction 60 % ; taux de réponse 83,33 % | 3 notes de 9 ou 10 et 1 de 0 à 6 sur 5 ; 3 notes de 4 ou 5 sur 5 ; 5 réponses sur 6 invitations ; l'avis spontané n'y entre pas |
| M21 | B1 : 200 vues, 10 intérêts, taux d'intérêt 5 % ; B2 : 0, 0, « — » | lignes de P seulement |
| M24 | 1 — avec accord de transmission 1 | A |

Vue « Négatifs » des retours (FBK-002) : 2 — la réponse notée (4, 2) et l'avis spontané. Filtre « banque = banque X » : M10 = 1 ; M11 = 1 accordée, taux d'accord 100 % ; M01 reste 6, le filtre étant grisé à côté de lui (TDB-061).
