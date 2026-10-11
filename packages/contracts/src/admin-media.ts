// Package 3.6 « Médias » (EA-44; 04-back-office/04 § 5: CTL-080 … CTL-084; 06-technique/05: MED-010 … MED-023) — the
// media of a programme, a property, a lot, a point of progress, a promoter or another partner: upload in three steps
// (API-080), list, edit, order, cover, delete, retry, bulk actions; and the lot import (EA-45, CTL-100 … CTL-102).
import { z } from 'zod';
import type { AdminImageRef } from './admin-catalogue.js';

export const ADMIN_MEDIA_OWNERS = ['PROGRAM', 'PROPERTY', 'LOT', 'PROGRAM_UPDATE', 'PROMOTER', 'PARTNER'] as const;
export type AdminMediaOwner = (typeof ADMIN_MEDIA_OWNERS)[number];
export const ADMIN_MEDIA_KINDS = ['PHOTO', 'RENDER_3D', 'PLAN', 'BROCHURE', 'VIDEO', 'PANO_360', 'LOGO'] as const;
export type AdminMediaKind = (typeof ADMIN_MEDIA_KINDS)[number];

/** MOD-235 — kinds allowed per owner, in the order of the « Nature » picker. */
export const MEDIA_KINDS_BY_OWNER: Record<AdminMediaOwner, AdminMediaKind[]> = {
  PROGRAM: ['PHOTO', 'RENDER_3D', 'PLAN', 'BROCHURE', 'VIDEO'],
  PROPERTY: ['PHOTO', 'RENDER_3D', 'PLAN', 'PANO_360', 'VIDEO', 'BROCHURE'],
  LOT: ['PLAN'],
  PROGRAM_UPDATE: ['PHOTO'],
  PROMOTER: ['LOGO', 'PHOTO'],
  PARTNER: ['LOGO'],
};

/** MED-010 — what each kind accepts (MIME types announced by the browser; the API reads the real type). */
export const MEDIA_RULES: Record<Exclude<AdminMediaKind, 'VIDEO'>, { types: string[]; maxMb: number }> = {
  PHOTO: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], maxMb: 20 },
  RENDER_3D: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], maxMb: 20 },
  PLAN: { types: ['application/pdf', 'image/jpeg', 'image/png'], maxMb: 25 },
  BROCHURE: { types: ['application/pdf'], maxMb: 25 },
  PANO_360: { types: ['image/jpeg'], maxMb: 50 },
  LOGO: { types: ['image/png', 'image/svg+xml', 'image/webp'], maxMb: 2 },
};
/** CTL-080 — under this, « Image petite : elle sera floue en grand. » */
export const SMALL_IMAGE = { width: 1600, height: 1000 };

export interface AdminMedia {
  id: string;
  ownerType: AdminMediaOwner;
  ownerId: string;
  kind: AdminMediaKind;
  processingStatus: 'PENDING' | 'READY' | 'FAILED';
  processingError: string | null;
  /** CTL-082 — `retry` is offered unless the antivirus refused the file (it is gone). */
  canRetry: boolean;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  /** CTL-080 — under 1 600 × 1 000 px. */
  small: boolean;
  thumb: AdminImageRef | null;
  /** The file as published (`original.pdf` of a plan or a brochure), or the video address. */
  url: string | null;
  alt: string | null;
  /** MED-023 — the text proposed when `alt` is empty. */
  altProposed: string;
  caption: string | null;
  roomLabel: string | null;
  isCover: boolean;
  isIllustration: boolean;
  takenAt: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface MediaListResponse {
  data: AdminMedia[];
  owner: { type: AdminMediaOwner; id: string; label: string };
  /** MOD-236 — a property without own image uses its programme's: « Ce bien utilise les photos de son programme. » */
  usesProgramPhotos: boolean;
  /** The caller may write here (CTL-160). */
  canWrite: boolean;
}

/** API-080 step 1 — `POST /admin/media/uploads`. */
export const mediaUploadSchema = z.object({
  ownerType: z.enum(ADMIN_MEDIA_OWNERS),
  ownerId: z.uuid(),
  kind: z.enum(ADMIN_MEDIA_KINDS).exclude(['VIDEO']),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().max(100),
  size: z.number().int().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type MediaUploadInput = z.input<typeof mediaUploadSchema>;
export interface MediaUploadResponse {
  id: string;
  uploadUrl: string;
  expiresAt: string;
}
/** API-080 step 3 — `POST /admin/media/uploads/{id}/complete`: the fields of CTL-081 that may be set at once. */
export const mediaCompleteSchema = z.object({
  roomLabel: z.string().max(40).nullable().optional(),
  caption: z.string().trim().max(300).nullable().optional(),
  isIllustration: z.boolean().optional(),
});

/** CTL-080 — `POST /admin/media/videos`: only the FORM of the address is checked (host and video id), never fetched (SEC-062). */
export const mediaVideoSchema = z.object({
  ownerType: z.enum(['PROGRAM', 'PROPERTY']),
  ownerId: z.uuid(),
  url: z.string().trim().max(500),
  caption: z.string().trim().max(300).nullable().optional(),
});

/** CTL-081 — `PATCH /admin/media/{id}`. */
export const mediaUpdateSchema = z.object({
  kind: z.enum(ADMIN_MEDIA_KINDS).optional(),
  roomLabel: z.string().max(40).nullable().optional(),
  caption: z.string().trim().max(300).nullable().optional(),
  alt: z.string().trim().max(200).nullable().optional(),
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE').nullable().optional(),
  isIllustration: z.boolean().optional(),
  isCover: z.literal(true).optional(),
});
export type MediaUpdateInput = z.input<typeof mediaUpdateSchema>;

/** CTL-081 — `POST /admin/media/reorder`: the whole order of an owner's media. */
export const mediaReorderSchema = z.object({ ownerType: z.enum(ADMIN_MEDIA_OWNERS), ownerId: z.uuid(), ids: z.array(z.uuid()).min(1).max(500) });

/** CTL-084 — `POST /admin/media/bulk`. */
export const mediaBulkSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
  action: z.enum(['kind', 'illustration', 'delete']),
  kind: z.enum(ADMIN_MEDIA_KINDS).optional(),
  isIllustration: z.boolean().optional(),
});
export type MediaBulkInput = z.input<typeof mediaBulkSchema>;
export interface MediaBulkResult {
  done: number;
  /** Media refused one by one, with the reason (CTL-083: the last image of a published property…). */
  refused: { id: string; reason: string; params?: Record<string, string | number> }[];
}

/** EA-44 « Médias » — `GET /admin/media/library`: every media of the catalogue, with its owner. */
export const MEDIA_LIBRARY_VIEWS = ['all', 'failed', 'pending', 'small', 'no-room'] as const;
export const mediaLibraryQuerySchema = z.strictObject({
  view: z.enum(MEDIA_LIBRARY_VIEWS).optional(),
  q: z.string().trim().max(120).optional(),
  kind: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(ADMIN_MEDIA_KINDS)).max(ADMIN_MEDIA_KINDS.length)),
  ownerType: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(['PROGRAM', 'PROPERTY'])).max(2)),
  sort: z.enum(['createdAt', '-createdAt', 'sizeBytes', '-sizeBytes']).default('-createdAt'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .refine((n) => [25, 50, 100].includes(n))
    .default(50),
});
export interface MediaLibraryItem extends AdminMedia {
  owner: { type: 'PROGRAM' | 'PROPERTY'; id: string; label: string; reference: string | null };
}
export interface MediaLibrary {
  data: MediaLibraryItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  views: Record<(typeof MEDIA_LIBRARY_VIEWS)[number], number>;
  facets: { kind: Record<string, number>; ownerType: Record<string, number> };
}

// ─── Lot import (EA-45, CTL-100 … CTL-102) ───────────────────────────────────

/** CTL-100 — the columns of the grid, in the order of the template. */
export const IMPORT_COLUMNS = ['lot', 'bien', 'type', 'pieces', 'surface', 'prix', 'batiment', 'etage', 'porte', 'orientation', 'terrasse', 'terrain', 'parking', 'options', 'statut'] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export const IMPORT_ISSUE_CODES = ['REQUIRED', 'INVALID_VALUE', 'DUPLICATE_LOT', 'AMBIGUOUS_TYPOLOGY', 'TYPOLOGY_MISMATCH', 'LOT_ELSEWHERE', 'STATUS_UNCHANGED', 'RESERVATION_PRICE', 'HELD_BY_DOSSIER'] as const;
export type ImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

export interface ImportIssue {
  /** Line of the file (the header is line 1). */
  line: number;
  column: string | null;
  level: 'ERROR' | 'FLAG';
  code: ImportIssueCode;
  /** The values the sentence needs (`{bien}`, `{raison}`, `{statut}`). */
  params: Record<string, string>;
}

export interface ImportCounters {
  rows: number;
  toCreate: number;
  toUpdate: number;
  typologiesToCreate: number;
  flagged: number;
  errors: number;
  /** Lots of the programme absent from the file: « {a} lots ne figurent pas dans le fichier : ils ne sont pas touchés. » */
  absent: number;
}

/** The file read once and kept (`ImportJob`); the screen proposes the mapping, modifiable (CTL-101 step 1). */
export interface ImportJobView {
  id: string;
  programId: string;
  programName: string;
  fileName: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  dryRun: boolean;
  /** Headers found in the file and the field each one feeds (null: ignored). */
  headers: string[];
  mapping: Record<string, ImportColumn | null>;
  /** CTL-101 step 2 — the dry run, or the report of the execution (it is authoritative, `ImportJob.report`). */
  counters: ImportCounters | null;
  issues: ImportIssue[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  author: string | null;
  canConfirm: boolean;
}

export interface ImportJobList {
  data: { id: string; programId: string; programName: string; fileName: string; status: ImportJobView['status']; dryRun: boolean; counters: ImportCounters | null; createdAt: string; author: string | null }[];
}

export const importMappingSchema = z.object({ mapping: z.record(z.string(), z.enum(IMPORT_COLUMNS).nullable()) });
