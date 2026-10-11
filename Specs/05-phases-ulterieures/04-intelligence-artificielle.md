# Intelligence artificielle

`[IA]` — hors du contrat de Phase 1. Quatre usages sont envisagés. Aucun n'est nécessaire au fonctionnement de la plateforme : chacun **s'ajoute** à une fonction qui existe sans lui.

Toutes les règles portent l'étiquette `[IA]`. **Exception (D-090)** : l'assistant conversationnel est construit en Phase 1 (ASS-050 à ASS-052) ; IA-001 à IA-005 et IA-010 à IA-013 s'y appliquent dès la Phase 1.

---

## 1. Principes

**IA-001** **L'humain décide.** L'IA propose, rédige, classe, signale. Elle ne valide ni ne rejette une pièce, ne qualifie pas un client, n'accorde ni ne refuse rien, n'envoie rien à un client sans relecture — hormis les réponses de l'assistant, encadrées par IA-012.

**IA-002** **Transparence.** Tout contenu produit par une IA et montré à un client le dit : « Réponse générée automatiquement ». Le client peut toujours demander un humain.

**IA-003** **Données.** Les données envoyées à un modèle sont réduites au nécessaire. Elles ne servent pas à entraîner un modèle. Le traitement a lieu dans l'Union européenne, ou sous des garanties équivalentes validées par le conseil juridique (Q-017). La politique de confidentialité décrit chaque usage. Pour l'assistant : fournisseur et contrat de traitement à valider (Q-057), mention dans la politique (Q-058) ; coordonnées du visiteur masquées avant tout envoi (ASS-053).

**IA-004** **Pas de conseil en investissement ni d'offre de crédit.** Aucune IA n'annonce un rendement, ne recommande d'acheter, ne promet un financement. Les montants viennent **toujours** des calculs de `01-domaine/07`, jamais du texte d'un modèle.

**IA-005** **Mesure.** Chaque usage a un jeu d'essai (questions et réponses attendues) rejoué à chaque changement de modèle ou de consigne. Chaque usage a un budget mensuel plafonné et un interrupteur (`features.ai.*`) — pour l'assistant, `ai.assistant.monthlyBudget` et `features.assistant.mode` (MOD-431). Jeu d'essai de l'assistant : Q-059 ; destinataire de l'alerte de plafond : Q-060.

## 2. Assistant conversationnel

**IA-010** Mode `AI` de l'assistant de recherche (`02-site-public/09`). Le visiteur écrit avec ses mots ; l'assistant :
1. en **extrait des critères** de recherche (CAT-020) et montre les biens correspondants, avec les mêmes cartes et les mêmes actions qu'en mode guidé (ASS-020) ;
2. **répond aux questions** sur le fonctionnement de la plateforme, en s'appuyant **uniquement** sur les questions fréquentes et les pages publiées, dont il cite la source ;
3. **passe la main** à un conseiller dès que la question porte sur une situation personnelle : il propose alors « Être rappelé » (DEM-017).

**IA-011** Les critères compris sont **toujours affichés** en clair (« Je cherche : Appartement T3 · Alger · jusqu'à 500 € / mois ») et modifiables, pour que le visiteur voie ce que l'assistant a retenu.

**IA-012** **Garde-fous.** L'assistant ne donne aucun prix, aucune mensualité, aucun délai qui ne vienne des données. Il refuse poliment ce qui sort de son rôle. Il ne demande jamais de revenus ni de documents. Sans réponse fiable : « Je préfère vous mettre en relation avec un conseiller. » — c'est aussi la suite d'un refus du modèle : aucun autre modèle n'est essayé (D-097). S'il est indisponible : repli sur le mode guidé.

**IA-013** Les conversations sont conservées 30 jours pour le contrôle de la qualité, sans lien avec l'identité tant que le visiteur n'a pas laissé ses coordonnées ; quand il les laisse, le résumé de sa recherche rejoint sa demande (ASS-030). La conversation elle-même reste anonyme et est supprimée au trentième jour (`AssistantConversation`, purge toutes les 6 heures) ; aucun écran du back-office ne la montre (Q-061).

## 3. Recommandation de biens

**IA-020** **Pour le conseiller** : dans « Proposer des biens » (PIP-032), le classement des suggestions tient compte, en plus du projet déclaré, de ce que le client a consulté, mis en favori, accepté ou écarté, et de la raison de ses refus. Chaque suggestion porte sa **raison** (« Dans son budget · proche des biens qu'il a aimés · livré »).

**IA-021** **Pour le client** : dans son espace, « Ces biens pourraient vous plaire », au plus trois, avec la même transparence. Désactivable dans ses préférences.

## 4. Lecture automatique des pièces

**IA-030** Au dépôt d'une pièce, une analyse **aide** le client puis le conseiller :
- au client, **avant l'envoi** : « La photo semble floue. », « Un coin du document est coupé. », « Ce document ne ressemble pas à un passeport. » — il peut passer outre ;
- au conseiller, **dans la visionneuse** (GED-041) : le type de document reconnu, le nom lu, la date du document et sa date d'expiration proposées, un signal si le nom ne correspond pas à l'emprunteur ou si le document semble trop ancien.

**IA-031** Le conseiller **valide ou rejette lui-même** (IA-001). Les valeurs proposées préremplissent le formulaire ; il les confirme ou les corrige. Rien n'est validé automatiquement.

## 5. Aide à la rédaction

**IA-040** Dans le back-office, un bouton « Proposer un texte » produit un **brouillon**, toujours relu et modifiable avant d'être enregistré ou envoyé :
- la **description d'un bien** à partir de ses champs (elle remplace alors la description générée de MOD-211) ;
- une **réponse à un client**, à partir du fil et du dossier ;
- le **résumé d'un dossier**, pour un collègue qui le reprend ;
- la **traduction** d'un contenu vers l'arabe ou l'anglais (TRV-004), à faire relire par une personne qui lit la langue.

**IA-041** Un texte produit ainsi et publié **tel quel** est marqué en interne (`descriptionAuto` pour un bien), pour qu'on puisse le retrouver et le relire.

## 6. Ce que la Phase 1 prépare déjà

**IA-050** Le point d'entrée de l'assistant et son mode guidé ; des critères de recherche formalisés (CAT-020) ; des questions fréquentes et des pages structurées ; la chronologie complète d'un dossier ; les champs `issuedAt` et `expiresAt` d'une pièce ; la table `Translation` ; un journal de toutes les actions, qui permettra de dire ce qu'une IA a proposé et ce qu'un humain a décidé.
