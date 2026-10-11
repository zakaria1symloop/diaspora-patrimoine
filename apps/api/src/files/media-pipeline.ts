// MED-015…MED-023, MOD-235 — from a received file to a READY public media:
//   1. real type (MED-011), limits (MED-010), SHA-256 (FIA-100);
//   2. original stored in the private space `originals/{mediaId}` (outside any transaction, FIA-001);
//   3. transaction: `Media` row PENDING + audit `media.created`;
//   4. antivirus (MED-021) — INFECTED: file deleted, FAILED; ERROR: stays PENDING;
//   5. renditions (MED-020) written to the public space `media/{ownerType}/{ownerId}/{mediaId}/{rendition}.{format}`;
//   6. transaction: READY + dimensions + renditions (+ cover, MOD-203) + the owner's caches through `onReady` (MOD-220).
// The three-step HTTP upload of API-080 will feed the same `ingest` once identity exists; the demo and the
// installation feed it from local files.
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@dp/contracts';
import type { Media, MediaKind, MediaOwnerType } from '../generated/prisma/client.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { log } from '../platform/request-context.js';
import type { Tx } from '../platform/tx.js';
import type { Actor } from '../admin/actor.js';
import { stampBy } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { detectImage, processImage } from './image-pipeline.js';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.js';
import { VIRUS_SCANNER, type VirusScanner } from './virus-scanner.js';

/** MOD-235 — kinds allowed per owner. */
export const KINDS_BY_OWNER: Record<MediaOwnerType, MediaKind[]> = {
  PROGRAM: ['PHOTO', 'RENDER_3D', 'PLAN', 'BROCHURE', 'VIDEO'],
  PROPERTY: ['PHOTO', 'RENDER_3D', 'PLAN', 'PANO_360', 'VIDEO', 'BROCHURE'],
  LOT: ['PLAN'],
  PROGRAM_UPDATE: ['PHOTO'],
  PROMOTER: ['LOGO', 'PHOTO'],
  BANK: ['LOGO', 'PHOTO'],
  PARTNER: ['LOGO', 'PHOTO'],
  EVENT: ['PHOTO'],
  CONTENT: ['PHOTO', 'DOCUMENT'],
  USER: ['PHOTO'],
};

/** Kinds received as a file (a video is an address: `CatalogueMediaService.addVideo`). */
const FILE_KINDS: MediaKind[] = ['PHOTO', 'RENDER_3D', 'PLAN', 'LOGO', 'PANO_360', 'BROCHURE'];
/** MED-010 — kinds that may be a PDF (plan, brochure); a brochure is only a PDF. */
const PDF_KINDS: MediaKind[] = ['PLAN', 'BROCHURE'];

/** MED-010 — maximum sizes. */
export const MAX_BYTES: Partial<Record<MediaKind, number>> = { PHOTO: 20e6, RENDER_3D: 20e6, PLAN: 25e6, LOGO: 2e6, PANO_360: 50e6, BROCHURE: 25e6 };
/** MED-010 — a 360° view: equirectangular JPG, ratio 2:1, at least 4 096 × 2 048 px. */
export const PANO_MIN = { width: 4096, height: 2048 };

export const isPdf = (body: Buffer) => body.subarray(0, 5).toString('latin1') === '%PDF-';
/** MED-011 — an encrypted or password-protected PDF is refused. */
export const isEncryptedPdf = (body: Buffer) => /\/Encrypt\b/.test(body.subarray(0, Math.min(body.length, 2_000_000)).toString('latin1'));

export interface IngestInput {
  ownerType: MediaOwnerType;
  ownerId: string;
  kind: MediaKind;
  body: Buffer;
  fileName: string;
  alt?: string | null;
  caption?: string | null;
  roomLabel?: string | null;
  isIllustration?: boolean;
  isCover?: boolean;
  takenAt?: Date | null;
  isPublic?: boolean;
}

export interface MediaHooks {
  /** Inside the transaction that creates the PENDING row (owner checks, its own audit). */
  onCreated?(tx: Tx, media: Media): Promise<void>;
  /** Inside the transaction that marks the media READY (owner caches, MOD-220). */
  onReady?(tx: Tx, media: Media): Promise<void>;
}

export function sha256(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

/** MED-012 — display name only: no path, no control character, 200 characters at most. */
export function cleanFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return (name.split(/[\\/]/).pop() ?? 'fichier').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) || 'fichier';
}

export function renditionPrefix(m: Pick<Media, 'ownerType' | 'ownerId' | 'id'>): string {
  return `media/${m.ownerType}/${m.ownerId}/${m.id}`;
}

@Injectable()
export class MediaPipeline {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
  ) {}

  /** Natural key of an already received file (idempotent installation and demo). */
  async findExisting(ownerType: MediaOwnerType, ownerId: string, fileName: string, checksum: string): Promise<Media | null> {
    return this.prisma.media.findFirst({
      where: { ownerType, ownerId, fileName: cleanFileName(fileName), checksumSha256: checksum, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** MED-010, MED-011 — the real type and the limits of a received file; returns its MIME type. */
  async check(kind: MediaKind, body: Buffer): Promise<string> {
    const max = MAX_BYTES[kind] ?? 20e6;
    if (!body.length) throw AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]);
    if (body.length > max) throw new AppError(ErrorCode.FILE_TOO_LARGE, { params: { maxMb: Math.round(max / 1e6), n: Math.round(max / 1e6) } });
    if (isPdf(body)) {
      if (!PDF_KINDS.includes(kind)) throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: allowedOf(kind) } });
      if (isEncryptedPdf(body)) throw AppError.validation([{ field: 'file', code: 'FILE_PASSWORD_PROTECTED' }]);
      return 'application/pdf';
    }
    if (kind === 'BROCHURE') throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: allowedOf(kind) } });
    const detected = await detectImage(body, { svg: kind === 'LOGO' });
    if (!detected) throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: allowedOf(kind) } });
    if (kind === 'PANO_360') {
      if (detected.format !== 'jpeg') throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: ['jpg'] } });
      if (Math.abs(detected.width / detected.height - 2) > 0.02) throw AppError.validation([{ field: 'file', code: 'PANO_RATIO' }]);
      if (detected.width < PANO_MIN.width || detected.height < PANO_MIN.height) throw AppError.validation([{ field: 'file', code: 'PANO_TOO_SMALL', params: { width: PANO_MIN.width, height: PANO_MIN.height } }]);
    }
    if (kind === 'LOGO' && !['png', 'svg', 'webp'].includes(detected.format)) throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: allowedOf(kind) } });
    return detected.mimeType;
  }

  async ingest(input: IngestInput, actor: Actor, hooks: MediaHooks = {}): Promise<Media> {
    if (!KINDS_BY_OWNER[input.ownerType].includes(input.kind) || !FILE_KINDS.includes(input.kind)) {
      throw AppError.validation([{ field: 'kind', code: 'INVALID_CHOICE' }]);
    }
    if (input.isCover && input.kind !== 'PHOTO' && input.kind !== 'RENDER_3D') {
      throw AppError.validation([{ field: 'isCover', code: 'INVALID_CHOICE' }]);
    }
    const detected = { mimeType: await this.check(input.kind, input.body) };

    const id = newId();
    const storageKey = `originals/${id}`;
    const checksum = sha256(input.body);
    await this.storage.put('private', storageKey, input.body, detected.mimeType);

    const created = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const last = await tx.media.aggregate({
        where: { ownerType: input.ownerType, ownerId: input.ownerId, deletedAt: null },
        _max: { sortOrder: true },
      });
      const media = await tx.media.create({
        data: {
          id,
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          kind: input.kind,
          isPublic: input.isPublic ?? true,
          storageKey,
          fileName: cleanFileName(input.fileName),
          mimeType: detected.mimeType,
          sizeBytes: BigInt(input.body.length),
          checksumSha256: checksum,
          alt: input.alt ?? null,
          caption: input.caption ?? null,
          roomLabel: input.roomLabel ?? null,
          isCover: false,
          isIllustration: input.isIllustration ?? false,
          takenAt: input.takenAt ?? null,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
          processingStatus: 'PENDING',
          uploadedById: stampBy(actor),
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, {
        action: 'media.created',
        entityType: 'media',
        entityId: media.id,
        entityLabel: media.fileName,
        after: { ownerType: media.ownerType, ownerId: media.ownerId, kind: media.kind, isIllustration: media.isIllustration },
      });
      await hooks.onCreated?.(tx, media);
      return media;
    });

    return this.process(created, input.body, actor, hooks, input.isCover ?? false);
  }

  /** Steps 4–6; also the `retry` of a FAILED media (CTL-082) once its original is still stored. */
  async process(media: Media, body: Buffer, actor: Actor, hooks: MediaHooks, makeCover: boolean): Promise<Media> {
    const scan = await this.scanner.scan(body);
    if (scan === 'INFECTED') {
      await this.storage.delete('private', media.storageKey!);
      return this.fail(media, 'Fichier refusé par le contrôle de sécurité', actor);
    }
    if (scan === 'ERROR') {
      log('warn', 'media.scan_pending', { mediaId: media.id });
      return media; // MED-035: stays PENDING, retried later.
    }
    // A PDF plan or brochure is published as it is, after the antivirus: `…/{mediaId}/original.pdf`.
    if (media.mimeType === 'application/pdf') {
      await this.storage.put('public', `${renditionPrefix(media)}/original.pdf`, body, 'application/pdf');
      return this.prisma.$transaction(async (tx) => {
        const now = this.clock.now();
        const ready = await tx.media.update({
          where: { id: media.id },
          data: { processingStatus: 'READY', processingError: null, renditions: { document: 'original.pdf' } as never, updatedById: stampBy(actor), updatedAt: now },
        });
        await hooks.onReady?.(tx, ready);
        return ready;
      }, { timeout: 30_000 });
    }
    let processed: Awaited<ReturnType<typeof processImage>>;
    try {
      processed = await processImage(body);
    } catch {
      return this.fail(media, 'Image illisible', actor);
    }
    const prefix = renditionPrefix(media);
    for (const f of processed.files) {
      await this.storage.put('public', `${prefix}/${f.rendition}.${f.format}`, f.body, f.contentType);
    }
    return this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      if (makeCover) {
        // MOD-203 — at most one cover per owner.
        await tx.media.updateMany({
          where: { ownerType: media.ownerType, ownerId: media.ownerId, isCover: true, deletedAt: null, NOT: { id: media.id } },
          data: { isCover: false, updatedAt: now },
        });
      }
      const ready = await tx.media.update({
        where: { id: media.id },
        data: {
          processingStatus: 'READY',
          processingError: null,
          width: processed.width,
          height: processed.height,
          renditions: processed.renditions as never,
          isCover: makeCover && (media.kind === 'PHOTO' || media.kind === 'RENDER_3D'),
          updatedById: stampBy(actor),
          updatedAt: now,
        },
      });
      await hooks.onReady?.(tx, ready);
      return ready;
    }, { timeout: 30_000 });
  }

  private async fail(media: Media, reason: string, actor: Actor): Promise<Media> {
    return this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const failed = await tx.media.update({
        where: { id: media.id },
        data: { processingStatus: 'FAILED', processingError: reason, updatedById: stampBy(actor), updatedAt: now },
      });
      await writeAudit(tx, actor, now, {
        action: 'media.updated',
        entityType: 'media',
        entityId: media.id,
        before: { processingStatus: media.processingStatus },
        after: { processingStatus: 'FAILED', processingError: reason },
      });
      return failed;
    });
  }

  /** Physical removal of a media's files (purge, demo removal). The row is deleted by the caller. */
  async purgeFiles(media: Pick<Media, 'ownerType' | 'ownerId' | 'id' | 'storageKey'>): Promise<void> {
    if (media.storageKey) await this.storage.delete('private', media.storageKey);
    await this.storage.deletePrefix('public', renditionPrefix(media));
  }
}

function allowedOf(kind: MediaKind): string[] {
  if (kind === 'BROCHURE') return ['pdf'];
  if (kind === 'PLAN') return ['pdf', 'jpg', 'png'];
  if (kind === 'PANO_360') return ['jpg'];
  if (kind === 'LOGO') return ['png', 'svg', 'webp'];
  return ['jpg', 'png', 'webp', 'heic'];
}
