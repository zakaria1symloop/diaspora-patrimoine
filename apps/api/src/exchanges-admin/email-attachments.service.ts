// COM-020 « Pièces jointes » and COM-030 « fichiers éventuels » — the files of a hand-written e-mail and of an e-mail
// noted as received (MED-010: PDF, JPG, PNG, DOCX, XLSX; 10 MB in all; 5 at most). They arrive through API-080:
//   1. `announce` — name, size, SHA-256: the format and the size are checked, an `Upload` (EMAIL_ATTACHMENT) is opened;
//   2. `receive` — the bytes, to a signed address of 15 minutes (local stand-in for the direct send to the storage, D-097);
//   3. `complete` — the file is read again: its fingerprint, its real type (MED-011) and the antivirus (MED-021: a manual
//      e-mail's attachment is checked before it leaves) — the upload is then `COMPLETED`, waiting for its e-mail.
// `claim` ties completed uploads to their `Communication` in the transaction that writes it: each file is copied to its
// final key `emails/{communication}/{upload}` (MED-016) and listed in `Communication.attachments`. A file of a dossier is
// never joined (NOT-008): only files from the computer are. Reading one goes through a signed link of 5 minutes (MED-030).
import { createHash, createHmac } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { ErrorCode, EMAIL_ATTACHMENT_FORMATS, EMAIL_ATTACHMENTS_MAX, EMAIL_ATTACHMENTS_MAX_BYTES, type EmailAttachment } from '@dp/contracts';
import { z } from 'zod';
import { ENV, type Env } from '../config/env.js';
import { isEncryptedPdf } from '../documents/document-rules.js';
import { cleanFileName } from '../files/media-pipeline.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../files/object-storage.js';
import { PrivateFileResolvers, privateFilePath, signPrivateFile } from '../files/private-files.js';
import { VIRUS_SCANNER, type VirusScanner } from '../files/virus-scanner.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';

const UPLOAD_TTL_MS = 15 * 60_000;
const MAX_MB = Math.round(EMAIL_ATTACHMENTS_MAX_BYTES / 1_000_000);
const announceSchema = z.strictObject({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().max(100).optional(),
  size: z.number().int().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

const MIME_BY_FORMAT: Record<(typeof EMAIL_ATTACHMENT_FORMATS)[number], string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** MED-011 — the real type, read in the content: PDF, JPEG, PNG, and the two Office formats (a ZIP holding `word/` or `xl/`). */
export function sniffAttachmentType(buf: Buffer): string | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return MIME_BY_FORMAT.pdf;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return MIME_BY_FORMAT.jpg;
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return MIME_BY_FORMAT.png;
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const names = buf.toString('latin1');
    if (names.includes('word/document')) return MIME_BY_FORMAT.docx;
    if (names.includes('xl/workbook')) return MIME_BY_FORMAT.xlsx;
  }
  return null;
}

const formatOf = (fileName: string) => fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]?.replace('jpeg', 'jpg') ?? '';

@Injectable()
export class EmailAttachmentsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly resolvers: PrivateFileResolvers,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    // MED-030 — `mailfile.{upload id}`: the file of an e-mail once tied to it.
    this.resolvers.register('mailfile', async (uploadId) => {
      const upload = await this.prisma.upload.findFirst({ where: { id: uploadId, ownerType: 'EMAIL_ATTACHMENT', status: 'COMPLETED', resultFileId: { not: null } }, select: { resultFileId: true } });
      if (!upload) return null;
      const row = await this.prisma.communication.findUnique({ where: { id: upload.resultFileId! }, select: { attachments: true } });
      const file = attachmentsOf(row?.attachments).find((a) => a.uploadId === uploadId);
      return file ? { storageKey: file.storageKey, fileName: file.name, mimeType: file.mimeType } : null;
    });
  }

  private signature(id: string, exp: number): string {
    return createHmac('sha256', this.env.LINK_SIGNING_KEY).update(`dp_mail_upload:${id}:${exp}`).digest('base64url');
  }

  /** API-080 step 1 — MED-010: one of the five formats, 10 MB at most (the total is checked when the e-mail is written). */
  async announce(auth: AuthContext, body: unknown, base: 'emails' | 'communications'): Promise<{ id: string; uploadUrl: string; expiresAt: string }> {
    const input = parseOrThrow(announceSchema, body);
    if (input.size > EMAIL_ATTACHMENTS_MAX_BYTES) throw new AppError(ErrorCode.FILE_TOO_LARGE, { params: { n: MAX_MB, maxMb: MAX_MB } });
    if (!(EMAIL_ATTACHMENT_FORMATS as readonly string[]).includes(formatOf(input.fileName))) throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: [...EMAIL_ATTACHMENT_FORMATS] } });
    const now = this.clock.now();
    const id = newId();
    const expiresAt = new Date(now.getTime() + UPLOAD_TTL_MS);
    await this.prisma.upload.create({
      data: { id, ownerType: 'EMAIL_ATTACHMENT', ownerId: id, requestedById: auth.userId, fileName: cleanFileName(input.fileName), declaredMimeType: input.contentType || 'application/octet-stream', declaredSizeBytes: BigInt(input.size), declaredSha256: input.sha256, storageKey: `uploads/${id}`, expiresAt, createdAt: now, updatedAt: now },
    });
    const exp = expiresAt.getTime();
    return { id, uploadUrl: `/api/v1/admin/${base}/uploads/${id}/content?e=${exp}&s=${this.signature(id, exp)}`, expiresAt: expiresAt.toISOString() };
  }

  private async mine(auth: AuthContext, id: string) {
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.requestedById !== auth.userId || upload.ownerType !== 'EMAIL_ATTACHMENT') throw AppError.notFound();
    return upload;
  }

  /** API-080 step 2 (D-097) — the raw bytes, exactly the announced size. */
  async receive(auth: AuthContext, id: string, query: { e?: string; s?: string }, body: unknown): Promise<void> {
    const exp = Number(query.e);
    if (!query.s || !Number.isFinite(exp) || exp < this.clock.now().getTime() || query.s !== this.signature(id, exp)) throw new AppError(ErrorCode.GONE);
    const upload = await this.mine(auth, id);
    if (upload.status !== 'PENDING') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (!Buffer.isBuffer(body) || body.length !== Number(upload.declaredSizeBytes)) throw AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]);
    await this.storage.put('private', upload.storageKey, body, 'application/octet-stream');
  }

  /** API-080 step 3 — fingerprint, real type (MED-011), antivirus (MED-021); refused: `REJECTED` and the file erased. */
  async complete(auth: AuthContext, id: string): Promise<EmailAttachment> {
    const upload = await this.mine(auth, id);
    const view = (mimeType: string): EmailAttachment => ({ uploadId: upload.id, name: upload.fileName, sizeBytes: Number(upload.declaredSizeBytes), mimeType });
    if (upload.status === 'COMPLETED') return view(upload.declaredMimeType);
    if (upload.status === 'REJECTED') throw AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]);
    const now = this.clock.now();
    const content = await this.storage.get('private', upload.storageKey);
    if (!content) {
      if (upload.expiresAt.getTime() < now.getTime()) throw new AppError(ErrorCode.GONE);
      throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
    }
    const reject = async (code: string, error?: AppError): Promise<never> => {
      await this.storage.delete('private', upload.storageKey).catch(() => undefined);
      await this.prisma.upload.update({ where: { id }, data: { status: 'REJECTED', updatedAt: now } });
      throw error ?? AppError.validation([{ field: 'file', code }]);
    };
    if (content.length !== Number(upload.declaredSizeBytes) || createHash('sha256').update(content).digest('hex') !== upload.declaredSha256) return reject('CHECKSUM_MISMATCH');
    const mime = sniffAttachmentType(content);
    if (!mime || mime !== MIME_BY_FORMAT[formatOf(upload.fileName) as keyof typeof MIME_BY_FORMAT]) return reject('', new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: [...EMAIL_ATTACHMENT_FORMATS] } }));
    if (mime === MIME_BY_FORMAT.pdf && isEncryptedPdf(content)) return reject('FILE_PASSWORD_PROTECTED');
    if ((await this.scanner.scan(content)) !== 'CLEAN') return reject('FILE_UNREADABLE'); // MED-021, as the lot import
    await this.prisma.upload.update({ where: { id }, data: { status: 'COMPLETED', completedAt: now, declaredMimeType: mime, updatedAt: now } });
    return view(mime);
  }

  /**
   * Ties completed uploads of the author to the communication being written (same transaction): MED-010 — five files,
   * 10 MB in all; each copied to `emails/{communication}/{upload}`. Returns the value of `Communication.attachments`.
   */
  async claim(tx: Tx, userId: string, uploadIds: readonly string[], communicationId: string, now: Date): Promise<StoredAttachment[] | null> {
    if (!uploadIds.length) return null;
    if (new Set(uploadIds).size !== uploadIds.length || uploadIds.length > EMAIL_ATTACHMENTS_MAX) throw AppError.validation([{ field: 'attachmentIds', code: 'TOO_LONG', params: { n: EMAIL_ATTACHMENTS_MAX } }]);
    const uploads = await tx.upload.findMany({ where: { id: { in: [...uploadIds] }, ownerType: 'EMAIL_ATTACHMENT', requestedById: userId, status: 'COMPLETED', resultFileId: null } });
    if (uploads.length !== uploadIds.length) throw AppError.validation([{ field: 'attachmentIds', code: 'INVALID_CHOICE' }]);
    const total = uploads.reduce((sum, u) => sum + Number(u.declaredSizeBytes), 0);
    if (total > EMAIL_ATTACHMENTS_MAX_BYTES) throw new AppError(ErrorCode.FILE_TOO_LARGE, { params: { n: MAX_MB, maxMb: MAX_MB } });
    const out: StoredAttachment[] = [];
    for (const id of uploadIds) {
      const u = uploads.find((x) => x.id === id)!;
      const content = await this.storage.get('private', u.storageKey);
      if (!content) throw AppError.validation([{ field: 'attachmentIds', code: 'INVALID_CHOICE' }]);
      const storageKey = `emails/${communicationId}/${u.id}`;
      await this.storage.put('private', storageKey, content, u.declaredMimeType);
      await tx.upload.update({ where: { id: u.id }, data: { resultFileId: communicationId, updatedAt: now } });
      out.push({ uploadId: u.id, name: u.fileName, storageKey, sizeBytes: Number(u.declaredSizeBytes), mimeType: u.declaredMimeType });
    }
    return out;
  }

  /** After the commit: the temporary copies are no longer needed. */
  async dropTemporary(attachments: readonly StoredAttachment[] | null): Promise<void> {
    for (const a of attachments ?? []) await this.storage.delete('private', `uploads/${a.uploadId}`).catch(() => undefined);
  }

  /** The files of an e-mail, for its sending (NOT-008: never a file of a dossier — only these). */
  async contents(attachments: unknown): Promise<{ filename: string; contentType: string; content: Buffer }[]> {
    const out: { filename: string; contentType: string; content: Buffer }[] = [];
    for (const a of attachmentsOf(attachments)) {
      const content = await this.storage.get('private', a.storageKey);
      if (!content) throw new Error(`attachment missing: ${a.uploadId}`);
      out.push({ filename: a.name, contentType: a.mimeType, content });
    }
    return out;
  }

  /** MED-030 — a link of 5 minutes to one file of an e-mail the reader may see (checked by the caller). */
  link(communicationAttachments: unknown, uploadId: string): { url: string; expiresAt: string } {
    if (!attachmentsOf(communicationAttachments).some((a) => a.uploadId === uploadId)) throw AppError.notFound();
    const { token, expiresAt } = signPrivateFile(this.env.LINK_SIGNING_KEY, 'mailfile', uploadId, 'attachment', this.clock.now());
    return { url: privateFilePath(token), expiresAt: expiresAt.toISOString() };
  }
}

/** `Communication.attachments` (01-domaine/05: `[{name, storageKey, sizeBytes, mimeType}]`, plus the upload it came from). */
export interface StoredAttachment {
  uploadId: string;
  name: string;
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
}

export function attachmentsOf(value: unknown): StoredAttachment[] {
  return Array.isArray(value) ? (value as StoredAttachment[]).filter((a) => a && typeof a.uploadId === 'string' && typeof a.storageKey === 'string') : [];
}
