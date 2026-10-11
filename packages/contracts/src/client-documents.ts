// EC-20, EC-21 (03-espace-client/04 § 1, § 2, § 4), API-080, API-081, MED-030 — the client's pieces of a dossier:
// the list as the client reads it, the three-step upload, the version of a piece, the signed reading address and the
// transmission consent (DOS-040). Shapes shared by the API and the site.
import { z } from 'zod';

/** MED-032 — 30 images at most in one deposit. */
export const DEPOSIT_MAX_IMAGES = 30;
/** DOS-011 — default accepted formats of a piece. */
export const DEFAULT_DOCUMENT_FORMATS = ['pdf', 'jpg', 'jpeg', 'png', 'heic'] as const;
/** Real types (MED-011) a client file may have, by extension of `acceptedFormats`. */
export const DOCUMENT_MIME_BY_FORMAT: Record<string, string[]> = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  heic: ['image/heic', 'image/heif'],
};
export const DOCUMENT_CATEGORIES = ['IDENTITY', 'RESIDENCE', 'EMPLOYMENT', 'INCOME', 'BANKING', 'PROPERTY', 'FINANCING', 'OTHER'] as const;
export type DocumentCategoryCode = (typeof DOCUMENT_CATEGORIES)[number];
export type DocumentStatusCode = 'PENDING' | 'RECEIVED' | 'VALIDATED' | 'REJECTED' | 'EXPIRED' | 'WAIVED';
export type DocumentProviderCode = 'CLIENT' | 'OPERATOR' | 'PROMOTER' | 'BANK';
export type PartyRoleCode = 'PRIMARY' | 'CO_BORROWER' | 'GUARANTOR';
export type RejectionReasonCode = 'ILLEGIBLE' | 'INCOMPLETE' | 'TOO_OLD' | 'WRONG_DOCUMENT' | string;

/**
 * DOS-003 — the line's state as the client reads it (one label each, `ui.documents.state.*`):
 * a security check in progress hides the status until it ends (CYC-140).
 */
export type ClientDocumentState =
  | 'SCANNING'
  | 'PENDING'
  | 'RECEIVED'
  | 'VALIDATED'
  | 'VALIDATED_RENEWAL_PENDING'
  | 'VALIDATED_TO_RENEW'
  | 'REJECTED'
  | 'EXPIRED'
  | 'WAIVED';

export interface ClientDocumentFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  /** MED-032 — number of photos joined in this PDF; null for a file deposited as is. */
  assembledFromImages: number | null;
  /** MOD-350 — readable once the security check is CLEAN. */
  readable: boolean;
}

export interface ClientDocumentVersion {
  number: number;
  uploadedAt: string;
  files: ClientDocumentFile[];
  /** DOS-015 — filed by the advisor from a message. */
  viaMessage: boolean;
}

/** The outcome of the last deposit, shown once on the screen (DOS-013, CYC-140, MED-032). */
export interface ClientDepositOutcome {
  number: number;
  at: string;
  /** `REFUSED`: every file refused by the security check; `PARTIAL`: one file refused, the others kept; `UNREADABLE`: photos impossible to join. */
  kind: 'REFUSED' | 'PARTIAL' | 'UNREADABLE';
}

export interface ClientDocument {
  id: string;
  partyId: string | null;
  label: string;
  description: string | null;
  category: DocumentCategoryCode;
  isRequired: boolean;
  providedBy: DocumentProviderCode;
  status: DocumentStatusCode;
  state: ClientDocumentState;
  statusChangedAt: string;
  /** « avant le 10 oct. » — shown for a piece to provide (red once past). */
  dueAt: string | null;
  /** « valable jusqu'au {date} » (VALIDATED with a validity to come). */
  validUntil: string | null;
  rejection: { reason: RejectionReasonCode; note: string | null } | null;
  /** CYC-141 — a renewal just rejected: its reason is shown on the line « à renouveler ». */
  renewalRejection: { reason: RejectionReasonCode; note: string | null } | null;
  current: ClientDocumentVersion | null;
  /** CYC-141 — a renewal waiting for its check (`renewalVersion`). */
  renewal: ClientDocumentVersion | null;
  /** A version still in its security check (`SCANNING`). */
  scanning: { number: number; uploadedAt: string; isRenewal: boolean } | null;
  lastOutcome: ClientDepositOutcome | null;
  maxFiles: number;
  acceptedFormats: string[];
  /** What the client may do (DOS-006, DOS-014, DOS-016, CYC-141). */
  actions: {
    /** « Déposer », « Déposer à nouveau », « Déposer une nouvelle version ». */
    deposit: boolean;
    /** « Modifier » the current deposit: add, remove, replace all. */
    edit: boolean;
    /** « Renouveler » / « Le remplacer » (renewal, REPLACE_ALL only). */
    renew: boolean;
    view: boolean;
  };
}

export interface ClientDossierParty {
  id: string;
  role: PartyRoleCode;
  /** Null for the client himself (« Vous »), MOD-322. */
  firstName: string | null;
  lastName: string | null;
  /** DOS-031 — « Informations gelées à la demande de {prénom} ». */
  restricted: boolean;
  /** DOS-032 — the client confirmed he may send this person's documents. Always true for PRIMARY. */
  authorizationGiven: boolean;
  /** GED-020 — a piece list depends on this person's missing situation. */
  missingSituation: boolean;
}

export interface ClientDocumentsView {
  dossier: {
    id: string;
    reference: string;
    stage: string;
    status: 'OPEN' | 'ON_HOLD' | 'WON' | 'LOST';
    financingRequested: boolean;
    /** DOS-016 — closed or won: read-only. */
    readOnly: boolean;
    /** DOS-016 — the files of a closed dossier were deleted at the end of their retention. */
    filesPurgedAt: string | null;
    completenessPct: number;
    satisfiedCount: number;
    requiredCount: number;
  };
  /** DOS-040 — the transmission consent. */
  consent: { given: boolean; givenAt: string | null; recordedBy: string | null };
  parties: ClientDossierParty[];
  documents: ClientDocument[];
  limits: { maxFileSizeMb: number; maxImagesPerDeposit: number; expiryWarningDays: number };
}

/** A dossier of the client that has a piece list (« Mes pièces » only exists for those, plan 2.9). */
export interface ClientDossierWithDocuments {
  reference: string;
  stage: string;
  status: 'OPEN' | 'ON_HOLD' | 'WON' | 'LOST';
  propertyTitle: string | null;
  completenessPct: number;
  toProvide: number;
}

// ---------- API-080 — three-step upload ----------

export const announceUploadSchema = z.strictObject({
  files: z
    .array(
      z.strictObject({
        fileName: z.string().trim().min(1).max(255),
        contentType: z.string().trim().min(1).max(100),
        size: z.number().int().positive(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/, { error: 'INVALID_CHOICE' }),
      }),
    )
    .min(1)
    .max(DEPOSIT_MAX_IMAGES),
  /** DOS-012 — the deposit is a renewal (« Renouveler »): the announce applies the controls 1 to 3 of API-081 for it. */
  isRenewal: z.boolean().default(false),
});
export type AnnounceUploadInput = z.input<typeof announceUploadSchema>;

export interface AnnouncedUpload {
  id: string;
  /** Signed address valid 15 minutes: the bytes are sent there (PUT), directly to the storage. */
  uploadUrl: string;
  expiresAt: string;
}

export interface AnnounceUploadResponse {
  uploads: AnnouncedUpload[];
}

export interface CompletedUpload {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isImage: boolean;
}

// ---------- API-081 — version of a piece ----------

export const VERSION_MODES = ['ADD', 'REMOVE', 'REPLACE_ALL'] as const;
export type VersionMode = (typeof VERSION_MODES)[number];

export const createVersionSchema = z.strictObject({
  mode: z.enum(VERSION_MODES),
  keptFileIds: z.array(z.uuid()).max(20).default([]),
  uploadIds: z.array(z.uuid()).max(DEPOSIT_MAX_IMAGES + 20).default([]),
  isRenewal: z.boolean().default(false),
});
export type CreateVersionInput = z.input<typeof createVersionSchema>;

// ---------- MED-030 — reading a private file ----------

export interface SignedFileUrl {
  /** Relative address (`/api/v1/files/private/…`), valid 5 minutes, for this reading only. */
  url: string;
  expiresAt: string;
}

// ---------- DOS-040, DOS-032 — consents given from « Mes pièces » ----------

export const transmissionConsentSchema = z.strictObject({ accepted: z.literal(true, { error: 'MUST_ACCEPT' }) });
export const partyAuthorizationSchema = z.strictObject({ accepted: z.literal(true, { error: 'MUST_ACCEPT' }) });
