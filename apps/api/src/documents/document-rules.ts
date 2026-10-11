// Pure rules of a dossier's pieces, shared by the client side (EC-20, EC-21), the processing of a deposit and, later,
// the back office: the line state the client reads (DOS-003), what he may do (DOS-006, DOS-014, DOS-016, CYC-141), the
// controls of a new version (API-081 points 1 to 5), the completeness (CAL-055) and the real type of a file (MED-011).
import type { ClientDocumentState, VersionMode } from '@dp/contracts';
import { DEFAULT_DOCUMENT_FORMATS, DEPOSIT_MAX_IMAGES, DOCUMENT_MIME_BY_FORMAT } from '@dp/contracts';

export type DocStatus = 'PENDING' | 'RECEIVED' | 'VALIDATED' | 'REJECTED' | 'EXPIRED' | 'WAIVED';
export type DossierStatusCode = 'OPEN' | 'ON_HOLD' | 'WON' | 'LOST';

/** `YYYY-MM-DD` of a date column (stored at midnight UTC). */
export const dayOf = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

/** Whole days from `today` to `day` (both `YYYY-MM-DD`). */
export function daysUntil(day: string, today: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export interface RenewalWindowInput {
  status: DocStatus;
  expiresAt: string | null;
  dossierStage: string;
  dossierStatus: DossierStatusCode;
  today: string;
  warningDays: number;
}

/** CYC-141 — a validated piece close to its end, while the dossier is at the DOCUMENTS step (open or paused). */
export function inRenewalWindow(i: RenewalWindowInput): boolean {
  if (i.status !== 'VALIDATED' || !i.expiresAt) return false;
  if (i.dossierStage !== 'DOCUMENTS' || i.dossierStatus === 'WON' || i.dossierStatus === 'LOST') return false;
  const left = daysUntil(i.expiresAt, i.today);
  return left > 0 && left <= i.warningDays;
}

export interface StateInput extends RenewalWindowInput {
  scanning: boolean;
  hasRenewal: boolean;
}

/** DOS-003 — the label the client reads. A security check in progress takes the line until it ends (CYC-140). */
export function clientState(i: StateInput): ClientDocumentState {
  if (i.scanning) return 'SCANNING';
  if (i.status !== 'VALIDATED') return i.status;
  if (i.hasRenewal) return 'VALIDATED_RENEWAL_PENDING';
  return inRenewalWindow(i) ? 'VALIDATED_TO_RENEW' : 'VALIDATED';
}

/**
 * DOS-003 — « valable jusqu'au {date} » only for a validity to come; a passed validity on a paused dossier, or one
 * already sent to the bank, is not shown: nothing is asked of the client (CYC-145).
 */
export function shownValidity(i: { status: DocStatus; expiresAt: string | null; today: string }): string | null {
  if (i.status !== 'VALIDATED' || !i.expiresAt) return null;
  return daysUntil(i.expiresAt, i.today) > 0 ? i.expiresAt : null;
}

export interface ActionInput extends RenewalWindowInput {
  providedBy: string;
  isInternal: boolean;
  scanning: boolean;
  hasCurrentFiles: boolean;
  partyRestricted: boolean;
  filesPurged: boolean;
}

/** DOS-006, DOS-014, DOS-016, DOS-032, CYC-141 — the buttons of a line. */
export function clientActions(i: ActionInput): { deposit: boolean; edit: boolean; renew: boolean; view: boolean } {
  const view = i.hasCurrentFiles && !i.filesPurged;
  const closed = i.dossierStatus === 'WON' || i.dossierStatus === 'LOST';
  if (closed || i.providedBy !== 'CLIENT' || i.isInternal || i.partyRestricted || i.scanning) return { deposit: false, edit: false, renew: false, view };
  const open = i.status === 'PENDING' || i.status === 'RECEIVED' || i.status === 'REJECTED' || i.status === 'EXPIRED';
  return {
    deposit: i.status === 'PENDING' || i.status === 'REJECTED' || i.status === 'EXPIRED' || (i.status === 'RECEIVED' && !i.hasCurrentFiles),
    edit: open && i.hasCurrentFiles,
    renew: inRenewalWindow(i),
    view,
  };
}

/** API-081 point 3 — the nature of a deposit, fixed at the deposit from the piece's state (CYC-140). */
export function depositKind(i: RenewalWindowInput & { isRenewal: boolean }): 'REPLACEMENT' | 'RENEWAL' | 'LOCKED' {
  if (i.status === 'PENDING' || i.status === 'RECEIVED' || i.status === 'REJECTED' || i.status === 'EXPIRED') return 'REPLACEMENT';
  if (i.status === 'VALIDATED' && i.isRenewal && inRenewalWindow(i)) return 'RENEWAL';
  return 'LOCKED';
}

export interface PlanInput {
  mode: VersionMode;
  keptFileIds: string[];
  uploadIds: string[];
  /** Files of the current version (`currentVersion`), in their order. */
  currentFileIds: string[];
  /** Confirmed uploads of this account for this piece, with their real type. */
  uploads: Map<string, { mimeType: string }>;
  /** Mime types of the kept files. */
  keptMime: Map<string, string>;
  maxFiles: number;
}

export type PlanResult =
  | { ok: true; kept: string[]; uploads: string[]; imageCount: number; fileCount: number }
  | { ok: false; error: 'MODE_INVALID' | 'KEPT_INVALID' | 'TOO_MANY_IMAGES' | 'TOO_MANY_FILES' };

export const isImageMime = (mime: string) => mime.startsWith('image/');

/** API-081 points 4 and 5 — lists consistent with the mode; limits of DOS-011 on the whole version (MED-032). */
export function planVersion(i: PlanInput): PlanResult {
  const unique = (list: string[]) => new Set(list).size === list.length;
  if (!unique(i.keptFileIds)) return { ok: false, error: 'KEPT_INVALID' };
  if (i.keptFileIds.some((id) => !i.currentFileIds.includes(id))) return { ok: false, error: 'KEPT_INVALID' };
  if (!unique(i.uploadIds)) return { ok: false, error: 'MODE_INVALID' };
  if (i.mode === 'ADD') {
    if (i.keptFileIds.length !== i.currentFileIds.length || i.uploadIds.length < 1) return { ok: false, error: i.uploadIds.length < 1 ? 'MODE_INVALID' : 'KEPT_INVALID' };
  } else if (i.mode === 'REMOVE') {
    if (i.uploadIds.length !== 0 || i.keptFileIds.length < 1 || i.keptFileIds.length >= i.currentFileIds.length) return { ok: false, error: 'KEPT_INVALID' };
  } else if (i.keptFileIds.length !== 0 || i.uploadIds.length < 1) {
    return { ok: false, error: i.keptFileIds.length ? 'KEPT_INVALID' : 'MODE_INVALID' };
  }
  const newImages = i.uploadIds.filter((id) => isImageMime(i.uploads.get(id)?.mimeType ?? '')).length;
  if (newImages > DEPOSIT_MAX_IMAGES) return { ok: false, error: 'TOO_MANY_IMAGES' };
  // MED-032 — every image of the deposit counts as one file; PDFs count one each. Kept files are already PDFs
  // (images of an earlier deposit were joined), but a kept image (legacy) counts for one as well.
  const keptCount = i.keptFileIds.length;
  const newPdfs = i.uploadIds.length - newImages;
  const fileCount = keptCount + newPdfs + (newImages > 0 ? 1 : 0);
  if (fileCount > i.maxFiles) return { ok: false, error: 'TOO_MANY_FILES' };
  return { ok: true, kept: i.keptFileIds, uploads: i.uploadIds, imageCount: newImages, fileCount };
}

/** CAL-055 — required pieces (removed borrowers excluded, internal pieces excluded), satisfied = VALIDATED or WAIVED. */
export function completeness(docs: { isRequired: boolean; isInternal: boolean; status: DocStatus; partyRemoved: boolean }[]): {
  required: number;
  satisfied: number;
  pct: number;
} {
  const required = docs.filter((d) => d.isRequired && !d.isInternal && !d.partyRemoved);
  const satisfied = required.filter((d) => d.status === 'VALIDATED' || d.status === 'WAIVED').length;
  return { required: required.length, satisfied, pct: required.length ? Math.floor((100 * satisfied) / required.length) : 100 };
}

// ---------- MED-011 — real type ----------

/** The real type read in the content: PDF, JPEG, PNG, HEIC/HEIF (ftyp brands), WebP. */
export function sniffDocumentType(buf: Buffer): string | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
}

/** Real types allowed by a piece's formats (DOS-011: by default PDF, JPG, PNG, HEIC). */
export function allowedMimes(formats: string[]): Set<string> {
  const list = formats.length ? formats : [...DEFAULT_DOCUMENT_FORMATS];
  return new Set(list.flatMap((f) => DOCUMENT_MIME_BY_FORMAT[f.toLowerCase()] ?? []));
}

/** The formats as the client reads them (« PDF, JPG, PNG, HEIC »), `jpeg` folded into `jpg`. */
export function formatList(formats: string[]): string[] {
  const list = (formats.length ? formats : [...DEFAULT_DOCUMENT_FORMATS]).map((f) => (f.toLowerCase() === 'jpeg' ? 'jpg' : f.toLowerCase()));
  return [...new Set(list)];
}

/** MED-011 — a PDF with an `/Encrypt` dictionary is protected (password or restrictions): refused. */
export function isEncryptedPdf(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 4_000_000)).toString('latin1');
  return /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(head);
}

/** A PDF must end with `%%EOF` (within the last kilobyte) and carry at least one page object to be readable. */
export function pdfLooksReadable(buf: Buffer): boolean {
  if (buf.length < 64) return false;
  const tail = buf.subarray(Math.max(0, buf.length - 2048)).toString('latin1');
  return tail.includes('%%EOF');
}

/** Number of pages of a PDF, read from its `/Type /Page` objects (best effort, null when unknown). */
export function pdfPageCount(buf: Buffer): number | null {
  const text = buf.toString('latin1');
  const n = (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
  return n > 0 ? n : null;
}
