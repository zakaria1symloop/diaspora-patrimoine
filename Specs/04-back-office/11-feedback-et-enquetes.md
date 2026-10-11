# Back-office — retours et enquêtes

Écrans **EA-85** (retours) et **EA-86** (enquêtes). Contrat : offre technique, § 4.10 — collecte structurée, enquêtes déclenchées aux étapes clés, mesure, console de gestion.

Modèle : `Survey`, `SurveyInvitation`, `Feedback` (`01-domaine/05`, § 2). Envoi automatique : AUT-065 à AUT-067. Côté client : PRO-070 à PRO-074. Enquêtes de départ : PAR-070.

---

## 1. Retours (EA-85)

**FBK-001** `[P1]` **Liste** (`feedback.read`). Colonnes : Date · Nature · Client · Contexte (dossier, bien ou Café) · Étape du dossier · Recommandation (0 à 10) · Satisfaction (1 à 5) · Commentaire (extrait) · Sujet · État · Traité par. En tête, pour la période choisie : l'indice de recommandation, l'indice de satisfaction, le taux de réponse (M19). Vue « À traiter » vide : « Aucun retour à traiter. » ; ailleurs, sans résultat : `common.empty.filtered`.

**FBK-002** `[P1]` **Vues d'origine** : « À traiter » (état `NEW`, par défaut) · « Négatifs » (recommandation ≤ 6 ou satisfaction ≤ 2) · « Erreurs signalées » · « Avis spontanés » · « Tous ». Filtres : nature, enquête, sujet, état, conseiller du dossier, promoteur, période, note.

**FBK-003** `[P1]` **Un retour.** Chaque question et sa réponse, avec les libellés **enregistrés avec la réponse** (`Feedback.answers`), même si l'enquête a changé depuis ; le commentaire ; le contexte — le dossier et son étape **au moment du retour**, le conseiller, le bien, le Café ; le client (lien). La première ouverture par un rôle qui a `feedback.manage` appelle l'action `review`, qui fait passer le retour de `NEW` à `REVIEWED` (CYC-225) ; une ouverture par un autre rôle (Lecture seule) ne change rien.

**FBK-004** `[P1]` **Actions** (`feedback.manage`).

| Action | Effet |
|---|---|
| Classer | Choisir ou corriger le sujet (`FeedbackCategory`). |
| **Traiter** | Note obligatoire : ce qui a été fait. → `ACTIONED`. |
| Sans suite | → `DISMISSED`. Raison facultative, rangée dans `actionNote`. |
| Rouvrir | Retour à `REVIEWED`. |
| Créer une tâche · Écrire au client · Noter un appel | Rattachés au client et à son dossier. |
| Proposer comme témoignage | Crée un témoignage **en préparation** avec le commentaire pour citation (CMS-050). Il ne pourra être publié qu'avec l'accord écrit du client. |

Routes (`feedback.manage`, API-100) : `review`, `handle`, `dismiss`, `reopen`, `categorize`, `propose-testimonial`. « Traiter » et « Sans suite » renseignent `handledById` et `handledAt`, et terminent la tâche `R_FEEDBACK_NEGATIVE` du retour (FBK-006).

**FBK-005** `[P1]` **Erreur signalée sur une fiche** (`LISTING_ERROR`) : le retour montre le bien (lien vers sa fiche d'édition), ce qui est signalé et la précision. « Corriger la fiche » ouvre le bien. Si le visiteur a laissé une adresse, « Lui répondre » ouvre la fenêtre d'e-mail (COM-020) vers cette adresse ; l'e-mail est rattaché au retour (`Communication.feedbackId`) et figure dans son historique — la personne n'a pas de fiche client, et n'en reçoit pas pour autant. Une tâche a déjà été créée (`R_LISTING_ERROR`) ; elle porte le texte du signalement, de sorte que l'erreur se traite dès la livraison du catalogue, avant même que cet écran existe (`08-tracabilite/02`). L'adresse laissée est effacée selon AUT-091, avec celle des e-mails qui lui ont répondu.

**FBK-006** `[P1]` **Retour négatif** : il porte un bandeau « À rappeler » tant qu'il n'est pas traité ; la tâche de rappel a été créée (`R_FEEDBACK_NEGATIVE`). Traiter le retour, ou le classer sans suite, termine la tâche.

## 2. Enquêtes (EA-86)

**FBK-020** `[P1]` **Liste** (`survey.manage`). Colonnes : Nom · Déclencheur · Délai · Active · Envoyées · Réponses · Taux de réponse · Note moyenne. « Note moyenne » : moyenne des notes de satisfaction (`csatScore`) de ses réponses, à défaut des notes de recommandation (`npsScore`), avec leur échelle (« 4,2 / 5 »). Une enquête ne se supprime pas : elle se désactive. Vide : « Aucune enquête. » et « Créer une enquête ».

**FBK-021** `[P1]` **Une enquête.**

| Champ | Règles |
|---|---|
| Nom | Interne. |
| Déclencheur | `SurveyTrigger` (AUT-065). Une seule enquête **active** par déclencheur automatique (raison `SURVEY_TRIGGER_TAKEN`) ; plusieurs enquêtes manuelles sont possibles. Le déclencheur d'une enquête de départ ne se change pas (raison `SURVEY_TRIGGER_LOCKED`). |
| Délai | Heures entre l'événement et l'envoi (0 à 720). Masqué pour une enquête manuelle. |
| Introduction | 400 caractères, reprise dans l'e-mail et en tête du questionnaire. |
| Questions | Huit au plus. Pour chacune : type (`NPS`, `CSAT`, `CHOICE`, `TEXT`), libellé (200 caractères), obligatoire ou non ; pour un choix : de 2 à 8 options (80 caractères chacune), et, par option, une **action** facultative (FBK-031). L'ordre se règle par glisser-déposer. |
| Active | Une enquête inactive n'est plus envoyée ; les invitations déjà parties restent valables. |

Un **aperçu** montre le questionnaire tel que le client le verra. Le **code** d'une enquête créée dans le back-office (`Survey.code`, qui sert aussi à la source du consentement de FBK-031) est tiré de son nom à la création : majuscules sans accent, mots séparés par `_`, 40 caractères au plus, suffixe `_2`, `_3`… en cas de doublon ; il ne change plus.

**FBK-022** `[P1]` **Modifier une enquête qui a déjà des réponses.** Chaque question garde un identifiant stable. Changer un libellé est permis. Changer le **type** d'une question ne l'est pas (raison `QUESTION_TYPE_LOCKED`) : on la retire et on en ajoute une autre. Une question retirée reste dans les questions de l'enquête, marquée `removedAt` : elle n'est plus posée, et ses réponses passées sont présentées sous « Question retirée ». Une option de choix garde de même son identifiant : la renommer ne coupe pas ses résultats en deux. Les résultats se lisent toujours question par question.

**FBK-030** `[P1]` **À la réception d'une réponse** : un `Feedback` de nature `SURVEY_RESPONSE` est créé, avec — la note de la première question `NPS` (`npsScore`), celle de la première question `CSAT` (`csatScore`), la première réponse de type texte (`comment`), toutes les réponses (`answers`), l'étape du dossier à cet instant, et un sujet par défaut selon le déclencheur : `PROPOSAL_SENT` → Bien · `DOSSIER_COMPLETE` et `ACQUISITION` → Parcours · `BANK_DECISION` → Financement · `CAFE_ATTENDED` → Café. L'invitation est marquée répondue. L'événement `feedback.received` part (AUT-067).

**FBK-031** `[P1]` **Option avec action.** Quand la réponse choisie porte une action : `CALLBACK_REQUEST` ou `PROJECTION_REQUEST`, une **demande** de cette nature est créée au nom du client, d'origine `CAFE` pour l'enquête d'un Café, `WEB_FORM` sinon, avec la mention « Créée depuis l'enquête {nom} ». Elle suit le parcours normal d'une demande (CYC-001, DEM-024 pour les doublons). La réponse vaut demande de contact : une ligne `Consent` est écrite (source `survey:{code}`).

**FBK-040** `[P1]` **Envoyer une enquête à la main** : depuis la fiche d'un client ou d'un dossier, ou pour plusieurs clients cochés dans leur liste. On choisit une enquête active ; l'invitation part aussitôt. Une personne déjà invitée pour ce contexte n'est pas réinvitée (l'écran dit combien sont écartées, et pourquoi : déjà invitées, « Ne pas contacter », enquêtes désactivées dans leurs préférences, adresse en erreur, et les autres conditions d'annulation de AUT-065). Un envoi manuel ne tient compte ni de `surveys.minGapDays` ni du délai de l'enquête ; il respecte les heures calmes (AUT-006) et toutes les conditions d'annulation de AUT-065.

**FBK-041** `[P1]` **Invitations d'une enquête** : la liste — client, contexte, prévue le, envoyée le, rappelée le, répondue le, état (prévue, envoyée, répondue, expirée, annulée avec sa raison, `SurveyCancelReason`). Une invitation prévue peut être annulée (action `cancel`, `survey.manage` ; raison `MANUAL`). Vide : « Aucune invitation pour cette enquête. »

## 3. Mesure

**FBK-050** `[P1]` Le rapport Satisfaction (EA-07, M19) présente, pour une période :
- l'indice de recommandation et l'indice de satisfaction, par enquête, avec leur évolution mois par mois ;
- la répartition des notes ;
- le taux de réponse par enquête ;
- les indices par conseiller, par promoteur (retours sur un bien), par Café ;
- les commentaires, filtrables par note et par sujet ;
- les retours négatifs non traités, et le délai moyen entre un retour négatif et son traitement.

Un indice calculé sur moins de 5 réponses n'est pas affiché (« Pas assez de réponses »), pour ne pas juger sur trois avis.

**FBK-051** `[P1]` Les réponses ne sont **pas anonymes** : elles sont rattachées au client pour permettre le rappel. L'e-mail d'invitation le dit (« Elles sont lues par l'équipe. »). Dans les rapports par conseiller, les commentaires restent visibles des rôles Direction, Administrateur et Lecture seule ; un conseiller voit les retours de ses propres dossiers.
