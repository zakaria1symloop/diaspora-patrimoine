# Fichiers et médias

Deux familles de fichiers, deux régimes opposés :

| | **Médias publics** | **Fichiers privés** |
|---|---|---|
| Quoi | Photos, images 3D, plans, brochures, vues 360° des programmes et des biens ; logos ; images des contenus | Pièces des dossiers ; pièces jointes des messages ; documents des partenaires ; paquets de soumission ; exports |
| Modèle | `Media` | `DocumentFile`, `MessageAttachment`, `PartnerDocument`, `SubmissionPackage`, `ExportJob` |
| Stockage | Déclinaisons dans un espace public, servi par un CDN | Espace privé, chiffré, sans accès public |
| Accès | Adresse publique, stable | Adresse signée de 5 minutes, après contrôle des droits |

---

## 1. Limites

**MED-010** `[P1]`

| Fichier | Formats | Taille maximale | Nombre |
|---|---|---|---|
| Pièce d'un dossier | Ceux de la pièce ; par défaut PDF, JPG, PNG, HEIC | `documents.maxFileSizeMb` (15 Mo) par fichier déposé | `maxFiles` de la pièce (5 par défaut), comptés après réunion des images en un PDF ; 30 images au plus par dépôt (MED-032) |
| Pièce jointe d'un message | PDF, JPG, PNG, HEIC | 15 Mo | 5 par message |
| Pièce jointe d'un e-mail manuel | PDF, JPG, PNG, DOCX, XLSX | 10 Mo au total | 5 |
| Document d'un partenaire | PDF, JPG, PNG | 25 Mo | — |
| Photo, image 3D | JPG, PNG, WebP, HEIC | 20 Mo | — |
| Plan, brochure | PDF, JPG, PNG | 25 Mo | — |
| Vue 360° `[P1]` | JPG équirectangulaire, rapport 2:1, 4 096 × 2 048 px au moins | 50 Mo | — |
| Logo | PNG, SVG, WebP | 2 Mo | — |
| Grille de lots | CSV, XLSX | 5 Mo, 2 000 lignes | — |

**MED-011** `[P1]` **Type réel.** Le type d'un fichier est lu dans son contenu, pas dans son nom ni dans ce qu'annonce le navigateur. Un fichier dont le contenu ne correspond pas à un format permis est refusé (`UNSUPPORTED_FILE_TYPE`). Un SVG est nettoyé de tout script avant d'être accepté. Un PDF chiffré ou protégé par mot de passe est refusé (`FILE_PASSWORD_PROTECTED`), de même qu'un fichier vide ou dont le contenu ne se lit pas (`FILE_UNREADABLE`) : TRV-064, DOS-011.

**MED-012** `[P1]` **Nom.** Le nom d'origine est gardé pour l'affichage, nettoyé : sans chemin, sans caractère de contrôle, 200 caractères au plus. La clé de stockage ne contient jamais ce nom : elle est faite d'identifiants.

## 2. Dépôt

**MED-015** `[P1]` Protocole en trois temps (API-080). L'adresse d'envoi signée fixe le type et la taille exacte attendus : le stockage refuse autre chose. L'empreinte SHA-256 est annoncée par le déposant au premier temps, calculée par l'API à la confirmation et comparée à l'annonce ; c'est elle qui est stockée (FIA-100).

**MED-016** `[P1]` Organisation du stockage. `public/` et `private/` désignent les deux espaces de ENV-040 (`STORAGE_PUBLIC_BUCKET`, `STORAGE_PRIVATE_BUCKET`) ; les chemins qui suivent sont les clés à l'intérieur de chacun, et c'est cette clé seule qui est enregistrée (`storageKey`) :

```
public/   media/{ownerType}/{ownerId}/{mediaId}/{déclinaison}.{format}
private/  originals/{mediaId}                      (originaux des médias)
private/  leads/{leadId}/{fileId}                  (justificatifs d'une candidature de partenaire, `LeadFile`)
          documents/{dossierId}/{documentId}/{fileId}
          attachments/{conversationId}/{attachmentId}
          partners/{ownerType}/{ownerId}/{documentId}
          packages/{submissionId}/{packageId}.zip
          exports/{jobId}
          uploads/{uploadId}                       (dépôts non confirmés)
```

## 3. Médias publics

**MED-020** `[P1]` **Traitement d'une image**, en arrière-plan, après le dépôt :
1. lecture, redressement selon l'orientation, conversion dans l'espace de couleur standard ;
2. **retrait de toutes les métadonnées** (dont la position GPS) ;
3. production des **déclinaisons** : `thumb` (320 px de large) · `card` (640) · `large` (1 280) · `xl` (1 920) · `og` (1 200 × 630, recadrée au centre) ; chacune en AVIF, WebP et JPEG (qualité : AVIF 50, WebP 80, JPEG 82) ; jamais agrandie au-delà de l'original ;
4. un aperçu très léger, flouté, pour l'affichage immédiat : WebP de 24 px de large, moins de 1 ko, gardé en ligne dans `Media.renditions` (clé `blur`) ;
5. enregistrement des dimensions et des déclinaisons dans `Media.renditions` ; état `READY`.

L'original reste dans l'espace privé ; seules les déclinaisons sont publiques. Un HEIC est converti. Échec : état `FAILED`, raison lisible, « Réessayer » (CTL-082).

**MED-021** `[P1]` **Tout fichier reçu est contrôlé avant de servir**, public ou privé. Un média déposé dans le back-office passe l'antivirus **avant** son traitement : tant que le contrôle n'est pas passé, il reste « Traitement en cours » ; s'il est refusé, il passe `FAILED` avec la raison « Fichier refusé par le contrôle de sécurité » et son fichier est supprimé. Il n'y a pas d'état de contrôle séparé sur `Media` : `READY` signifie contrôlé **et** traité. La même règle vaut pour la pièce jointe d'un e-mail manuel (contrôlée avant le départ) et pour un fichier d'import (contrôlé avant d'être lu).

**Plan ou brochure en PDF** : une fois contrôlé, le fichier est servi tel quel, publiquement ; une image de sa première page sert de vignette ; le nombre de pages est noté. **Vue 360°** : deux déclinaisons (4 096 et 8 192 px de large quand l'original le permet), en WebP et JPEG ; la visionneuse charge la plus légère d'abord. **Vidéo** : jamais stockée ; seule l'adresse externe est gardée. Le serveur ne va chercher **aucune** adresse saisie par un utilisateur (SEC-062) : il vérifie seulement que l'adresse a la forme d'une vidéo YouTube ou Vimeo ; la vignette affichée est celle que le lecteur de la plateforme vidéo fournit au navigateur, après le clic du visiteur (NAV-051).

**MED-022** `[P1]` **Adresses et cache.** L'adresse d'une déclinaison contient l'identifiant du média : elle ne change jamais et peut être gardée un an par les navigateurs. Remplacer une image crée un **nouveau** média. Les pages réservent la place de chaque image (rapport connu) et la chargent à la taille de l'écran (TRV-133).

**MED-023** `[P1]` **Texte de remplacement** : celui du média, sinon généré : « {titre du bien} – {pièce} » ; pour un média de programme, « {nom du programme} – {pièce} » ; sans pièce, le titre ou le nom seul. Une image purement décorative a un texte vide.

## 4. Fichiers privés

**MED-030** `[P1]` **Lecture.** Jamais d'adresse publique ni durable. Pour ouvrir un fichier : l'application appelle une route de l'API, qui vérifie la session, la permission (`document.file.read` pour l'équipe — `promoter.read` ou `bank.read` pour un document de promoteur ou de banque, CTL-003 ; propriété pour le client) et le droit sur l'objet, écrit la trace (GED-002), puis rend une adresse signée valable **5 minutes**, propre à cette lecture (clé, nom et type fixés dans la signature) ; l'application l'ouvre aussitôt, sans l'afficher ni la conserver. Le fichier est servi avec son type sûr et son nom nettoyé, en pièce jointe ou pour être affiché selon le paramètre `disposition` de la route (MED-031). **Réalisation** (D-097) : la route du module rend `{url, expiresAt}` ; l'adresse est celle de l'API, `GET /api/v1/files/private/{jeton}`, où le jeton signé ne porte que des identifiants — la sorte de fichier, son identifiant, la disposition, l'échéance — et jamais de nom de fichier, qui serait une donnée personnelle dans une adresse ou un journal ; chaque module y résout ses propres fichiers. Côté client aussi, chaque ouverture est écrite au journal d'audit (GED-002).

**MED-031** `[P1]` **Aperçu.** Pour la visionneuse (GED-041, DOS-005) : une image est servie dans une version d'affichage (2 000 px au plus, JPEG) produite à la volée et non conservée ; un HEIC est converti ; un PDF est rendu par le navigateur à partir de son adresse signée. La route de lecture prend `disposition=inline|attachment` : `inline` pour la visionneuse — le fichier est servi pour être affiché, jamais téléchargé d'office, et l'adresse accepte plusieurs requêtes par plages (`Range`) pendant ses 5 minutes, ce dont un lecteur de PDF a besoin pour les pages et le zoom — ; `attachment` (par défaut) pour « Télécharger ». Chaque demande d'adresse, de l'une ou l'autre sorte, est une ouverture tracée (GED-002). Aucun aperçu n'est rendu public ni mis en cache hors de la session.

**MED-032** `[P1]` **Les images d'un dépôt deviennent un PDF.** Une pièce photographiée page par page ne doit ni dépasser la limite de fichiers, ni arriver chez une banque en vingt images.
1. Chaque image déposée (JPG, PNG, HEIC) est contrôlée par l'antivirus comme tout fichier.
2. Quand le contrôle du dépôt est terminé, les images **saines** sont réunies, dans l'ordre choisi par le déposant (`sortOrder`), en **un seul PDF** : une image par page, redressée selon son orientation, ramenée à 2 000 px de grand côté, métadonnées retirées (dont la position), HEIC converti. Les PDF déposés dans le même dépôt restent des fichiers à part, placés selon leur ordre.
3. Le PDF produit est le fichier de la version (`DocumentFile.assembledFromImages` = nombre d'images, `fileName` = le libellé de la pièce), à la place de la première image dans l'ordre des fichiers ; il n'est pas recontrôlé. Les images d'origine sont supprimées du stockage une fois le PDF écrit et son empreinte enregistrée ; leurs lignes `DocumentFile` restent, supprimées logiquement (`deletedAt`), pour la trace (D-097).
4. Limites : 30 images par dépôt ; au-delà, le dépôt est refusé avant l'envoi (DOS-011). Si la réunion échoue (image illisible), la version prend l'issue `DISCARDED`, le déposant lit « Nous n'avons pas pu lire une de vos photos. Reprenez-la et déposez à nouveau. » — à l'écran, ou par notification s'il l'a quitté (CYC-140) —, et rien ne remplace la version en cours.
5. La même réunion s'applique aux images classées depuis un message (GED-050) et aux dépôts faits par l'équipe.

La visionneuse, les paquets de soumission et l'export des données d'une personne ne manipulent donc que des PDF pour les pièces ; `maxFiles` se compte sur ces fichiers.

**MED-035** `[P1]` **Contrôle antivirus** (CYC-140, MOD-350). Chaque fichier privé naît `PENDING` et passe dans la file de contrôle.

| Résultat | Effet |
|---|---|
| `CLEAN` | Le fichier devient lisible. |
| `INFECTED` | Le fichier est supprimé du stockage ; sa ligne reste, marquée ; le déposant est prévenu. |
| `ERROR` (antivirus indisponible) | Le fichier reste `PENDING`, non lisible ; le contrôle est retenté. Après 15 minutes d'indisponibilité : alerte (AUT-076). L'écran affiche « Vérification de sécurité en cours ». **Rythme** (D-097) : pour une pièce, le contrôle est un travail de la boîte d'envoi (`document.version_created`, AUT-013) et suit ses nouveaux essais — 1 min, 5 min, 30 min, 2 h, 6 h, puis toutes les 6 heures, mis de côté au dixième échec (FIA-040) — au lieu de « chaque heure ». |

Les définitions de l'antivirus sont mises à jour chaque jour.

## 5. Documents produits par la plateforme

**MED-050** `[P1]` **Paquet de soumission** (BNK-110) : produit en arrière-plan, écrit directement dans le stockage privé sans passer par un disque local durable ; son manifeste et son empreinte sont enregistrés ; l'archive est supprimée après `submission.packageRetentionDays` jours, le manifeste reste.

**MED-055** `[P1]` **PDF** (simulation, projection, sommaire d'un paquet, récapitulatif d'un dossier, feuille de présence, rapport) : produits à partir de gabarits de `packages/emails`, aux couleurs de la marque, avec les éléments de TRV-142. Un PDF de simulation ou de projection est gardé (`pdfStorageKey`) ; le sommaire d'un paquet est gardé avec son archive et supprimé avec elle, à `SubmissionPackage.purgeAt` (MED-050) ; les autres sont produits à la demande et ne sont pas conservés au-delà de 24 heures.

**MED-060** `[P1]` **Fichier d'agenda** (`.ics`) : conforme au format iCalendar, avec fuseau explicite, identifiant stable et numéro de séquence (CAF-050, TAC-040). **QR code** : produit à la demande, en SVG pour l'écran et en PNG pour l'e-mail ; il ne contient qu'une adresse.

## 6. Suppression

**MED-070** `[P1]` Supprimer un média public le retire du site aussitôt (invalidation du cache et du CDN) ; ses fichiers sont effacés à la purge de la corbeille (AUT-091). Supprimer un fichier privé suit FIA-062. Un fichier n'est jamais effacé du stockage tant qu'une ligne vivante le référence.

**MED-071** `[P1]` **Surveillance** : volume stocké par famille, nombre de fichiers en attente de contrôle, de traitement, en échec — visibles dans le diagnostic (ADM-080). Chaque environnement déclare un **quota** de stockage (`STORAGE_QUOTA_GB`, ENV-040), comparé au **volume** : la somme des tailles enregistrées des fichiers non purgés — originaux et déclinaisons des médias (`Media.renditions`), fichiers des pièces et des messages, documents des partenaires, paquets, exports, dépôts annoncés —, calculée par une requête et gardée en cache 5 minutes ; les versions effacées que le stockage garde 30 jours (FIA-062) n'y comptent pas, et le quota se règle avec cette marge. à 80 % du quota, une alerte technique part (AUT-076) ; à 100 %, les nouveaux dépôts sont refusés avec « Le dépôt de fichiers est momentanément indisponible. Réessayez plus tard. » et l'alerte devient urgente — on ne découvre pas la limite par une facture ou par une panne.
