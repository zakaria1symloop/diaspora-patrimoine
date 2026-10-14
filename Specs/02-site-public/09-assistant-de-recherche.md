# Assistant de recherche

`[P1]` — écart E5. Écran **EP-22**, adresse `/assistant`. Toutes les règles de ce fichier portent l'étiquette `[P1]`, sauf mention contraire.

Le lien de l'accueil dit : « Vous préférez le dire avec vos mots ? Notre assistant vous écoute et cherche pour vous ». Deux réalisations sont prévues derrière ce même point d'entrée (D-042), choisies par `features.assistant.mode` :

| Mode | Ce que c'est | Où |
|---|---|---|
| `OFF` | Rien : la page répond `404`, les liens qui y mènent sont masqués (ACC-090). | — |
| `GUIDED` | Un **questionnaire guidé**, sans intelligence artificielle : cinq questions à choix, puis les biens correspondants. | Ce fichier |
| `AI` | Une conversation en langage libre. | `05-phases-ulterieures/04` |

---

## 1. Principes du mode guidé

**ASS-001** L'assistant ne prétend pas comprendre un texte libre. Sa première phrase le dit simplement : « Bonjour. Cinq questions, et je vous montre les biens qui vous correspondent. ». Aucune mention d'« intelligence artificielle ».

**ASS-002** Présentation en **fil de discussion** : l'assistant pose une question, le visiteur répond en touchant un ou plusieurs choix, sa réponse s'affiche comme un message, la question suivante arrive. Une question à la fois. En tête : « Question {n} sur 5 ». Sous chaque question : « Retour » (revient à la précédente, réponse conservée). Le numéro de la question est porté par l'adresse (`/assistant?q={n}`, TRV-101) : le bouton Retour du navigateur revient lui aussi à la question précédente au lieu de quitter la page. Valeurs : `1` à `5`, `2bis` (le nombre de pièces), `precision` (le texte libre d'ASS-011), `resultats` (D-097).

**ASS-003** Chaque question propose une sortie neutre (« Peu importe », « Je ne sais pas encore », « Je préfère ne pas répondre ») : on arrive toujours au résultat.

**ASS-004** Les réponses sont gardées dans le stockage de session. Quitter la page et y revenir reprend à la dernière question. « Recommencer » efface tout.

**ASS-005** Sous l'habillage en discussion, chaque question est un groupe de cases ou de boutons radio ordinaire, utilisable au clavier et au lecteur d'écran. Aucune attente artificielle de plus de 300 ms entre deux questions ; aucune animation si l'utilisateur a demandé à les réduire.

## 2. Les cinq questions

**ASS-010**

| # | Question | Choix | Critère produit (CAT-020) |
|---|---|---|---|
| 1 | « Où souhaitez-vous acheter ? » | Les régions qui ont des biens publiés et disponibles, comme dans le catalogue (CAT-021 ; plusieurs choix possibles) · « Peu importe » | `region` |
| 2 | « Quel type de bien cherchez-vous ? » | Appartement · Villa · Duplex · Studio · Terrain · Local commercial (plusieurs choix) · « Peu importe » | `type` |
| 2 bis | « Combien de pièces ? » — posée seulement si un appartement, une villa ou un duplex est choisi | T2 · T3 · T4 · T5 et plus (plusieurs choix) · « Peu importe » | `rooms` |
| 3 | « Quel est votre budget ? » | Bascule « par mois » / « au total », puis les paliers de `catalogue.monthlyBudgetSteps` ou de `catalogue.priceBudgetSteps` (« Jusqu'à 500 € / mois ») · « Je ne sais pas encore » | `monthlyMax` ou `priceMax` |
| 4 | « Pour quand ? » | « Disponible tout de suite » · « D'ici un à deux ans » · « Peu importe » | `delivery` : `delivered` ; ou `delivered`, l'année en cours et les deux suivantes (Q-063) |
| 5 | « C'est pour quel projet ? » | Les libellés de `PurchasePurpose` (un seul choix) · « Je préfère ne pas répondre » | Aucun : information pour le conseiller |

Un choix sans aucun bien n'est pas proposé : les choix de chaque question sont calculés d'après les réponses précédentes, et seuls restent ceux qui ont encore des biens (`GET /public/assistant/questions`). Si `features.monthlyBudgetSearch` est faux, la question 3 ne propose que le budget « au total ». **Lectures retenues** (D-097) : « D'ici un à deux ans » couvre les biens livrés et ceux livrés dans l'année en cours ou les deux suivantes (Q-063) ; « Peu importe » au type fait sauter la question 2 bis (Q-064) ; un nombre de pièces écarte les terrains et les locaux commerciaux, comme le filtre du catalogue (Q-065).

**Présentation des choix (D-105)** : les choix d'une question s'alignent en colonnes de même largeur ; la question 2 les range sous deux titres dès qu'ils existent tous deux — « Pour habiter » (appartement, studio, duplex, villa) et « Autres biens » (terrain, local commercial) ; au-delà de huit choix (les régions, quand le catalogue grandit), un champ « Filtrer les choix » restreint la liste sans effacer ce qui est coché (« Aucun choix ne correspond. Effacez quelques lettres. ») ; à côté de « Plusieurs choix possibles. », le nombre retenu (« Aucun choix pour l'instant », « 2 choix retenus ») ; la réponse neutre est mise à part, sous un trait, après « Ou bien ».

**ASS-011** Après la question 5, un champ facultatif : « Une précision à ajouter, avec vos mots ? » (500 caractères). Ce texte n'est **pas interprété** : il est transmis tel quel au conseiller si le visiteur laisse ses coordonnées.

## 3. Résultat

**ASS-020** L'assistant conclut : « Voici {n} biens qui correspondent à vos réponses. » et affiche six cartes au plus (CAT-040), par pertinence. Puis trois actions :

| Action | Effet |
|---|---|
| **Voir tous les résultats** | Catalogue avec les critères du questionnaire. |
| **Recevoir ces biens et être accompagné** | Formulaire DEM-017. |
| **Créer une alerte** (si `features.searchAlerts`) | CAT-070, avec les mêmes critères. |

**ASS-021** **Aucun bien ne correspond.** Les critères sont relâchés comme en CAT-061 — les communes, le budget (+20 %), les pièces, la livraison, la région —, par la même fonction du domaine (`GET /public/assistant/results`). S'il en sort des biens : « Aucun bien ne correspond exactement. Voici les plus proches. ». Sinon : « Nous n'avons pas encore de bien pour cette recherche. Laissez-nous vos coordonnées : un conseiller cherche pour vous. » et le formulaire DEM-017, ouvert.

**ASS-030** **Demande envoyée depuis l'assistant** (`GUIDED_SEARCH`). Son contenu (`Lead.payload`) porte : les réponses brutes à chaque question, les critères produits, la liste des biens affichés, le texte libre. Le serveur **recalcule** les critères à partir des réponses — il ne prend jamais ceux du navigateur — et ne garde que les références des cartes montrées, six au plus (D-097). Depuis l'assistant conversationnel, la demande porte `assistantConversationId` : critères, biens montrés (vingt références au plus) et résumé de la recherche — les messages du visiteur, déjà masqués, et la raison du passage de main — sont repris de la conversation que garde le serveur (`AssistantConversation`), jamais du navigateur ; une conversation purgée ou inconnue fait refuser ce champ (`422`, `INVALID_CHOICE`) et le site envoie la demande sans lui. Elle ouvre ou rejoint un dossier (CYC-002). Les biens affichés ne deviennent **pas** des biens candidats : le visiteur n'a exprimé d'intérêt pour aucun en particulier ; le conseiller les voit dans la demande et choisit quoi proposer.

**ASS-031** Les réponses complètent les champs **vides** de la fiche du client : régions et types préférés, nombre de pièces, budget, raison de l'achat (MOD-300).

## 4. Plus tard

**ASS-050** `[P1]` **Mode conversationnel** (D-090 ; `features.assistant.mode` = `AI`). La conversation libre vient en premier ; « Je préfère répondre à des questions » ramène au mode guidé, qui reste en place et sert de repli. IA-001 à IA-005 et IA-010 à IA-013 s'appliquent en Phase 1.

**ASS-051** `[P1]` **Écran.** Un champ « Dites-nous ce que vous cherchez, avec vos mots » (500 caractères au plus) et le bouton « Dicter » (TRV-127 ; construit dans l'assistant lui-même, tant que le composant commun de dictée n'existe pas, D-097) ; trois exemples à toucher (« Un T3 à Alger pour moins de 600 € par mois », « Une maison près de la mer pour ma retraite », « Que se passe-t-il après ma demande ? ») ; la réponse s'écrit au fil de l'eau ; les critères compris s'affichent en pastilles modifiables (IA-011) ; les biens en cartes (CAT-040) avec les actions d'ASS-020 ; la mention « Réponse générée automatiquement » sous chaque réponse (IA-002) ; « Parler à un conseiller » toujours visible (DEM-017). L'assistant comprend le français, l'arabe et la darija, et répond dans la langue de la question ; l'interface reste en français (TRV-001).

**ASS-052** `[P1]` **Fonctionnement.** `POST /public/assistant/messages` (réponse en flux). Le modèle ne dispose que de trois outils côté serveur : chercher des biens (`GET /public/properties`, critères CAT-020), lire les questions fréquentes et les pages publiées, proposer d'être rappelé ; tout prix, toute mensualité et tout délai affichés viennent de ces outils (IA-004, IA-012). Fournisseur, clé et modèle : `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` (ENV-040) ; sans eux, ou plafond `ai.assistant.monthlyBudget` atteint, ou erreur du fournisseur : repli sur le mode guidé, sans message d'erreur. Conservation : IA-013.

**ASS-053** `[P1]` **Réalisation du mode conversationnel** (D-097).
- **Mode servi.** `GET /public/assistant/status` dit au site le mode du visiteur : `AI` seulement si `features.assistant.mode` vaut `AI`, que le fournisseur est configuré et que le plafond du mois n'est pas atteint (MOD-431) ; sinon `GUIDED`. Le choix « Je préfère répondre à des questions » est gardé pour la visite ; une adresse de questionnaire (`?q=`) ouvre le questionnaire.
- **Un tour.** Le visiteur envoie son message (500 caractères au plus) ou modifie une pastille de critère — une modification ne fait pas appel au modèle : la recherche est relancée avec les critères corrigés. Le modèle dispose de trois outils : chercher des biens (`search_properties`), chercher dans les questions fréquentes et les pages publiées (`search_help`, une recherche par mots, sans accent ni casse), proposer d'être rappelé (`offer_callback`, avec sa raison). Limites d'un tour : quatre appels du modèle, 15 secondes pour la première sortie, 45 secondes en tout ; au-delà, ou réponse qui reste invalide, ou erreur du fournisseur : le tour finit en repli sur le mode guidé, sans trace d'erreur à l'écran. Les consignes du modèle sont écrites en anglais ; il répond dans la langue de la question (ASS-051).
- **Garde-fous.** Le texte du visiteur est **masqué** avant d'être envoyé ou gardé : adresses e-mail, numéros de téléphone, IBAN et numéros de pièce d'identité deviennent « [***] » ; les montants restent, ce sont des critères (IA-003). Une réponse qui cite un chiffre absent des données des outils est signalée (`FIGURE_NOT_FROM_DATA`, Q-061). Un refus du modèle n'appelle pas un autre modèle : il passe la main à un conseiller (« Je préfère vous mettre en relation avec un conseiller. », IA-012).
- **Longueur.** Douze messages du visiteur au plus par conversation ; au-delà : « Notre échange devient long : un conseiller peut prendre le relais et vous répondre de vive voix. », avec « Être rappelé » (DEM-017).
- **Coût.** Chaque tour ajoute sa consommation à la conversation et au cumul du mois (`AiUsageMonth`) ; les prix du fournisseur, en dollars, sont comptés un dollar pour un euro (MOD-431). Limites de débit : SEC-070.
- **Conversation.** Gardée 30 jours sans identité, puis supprimée (IA-013, `AssistantConversation`).
