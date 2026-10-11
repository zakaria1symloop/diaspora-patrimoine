// Package 3.6 « Médias » — CTL-080 … CTL-084, MED-010 … MED-023, API-080. The media of a programme, a property, a lot,
// a point of progress, a promoter or another partner:
//   · upload in three steps (announce with SHA-256 → PUT of the bytes to a signed address → complete: real type, size,
//     fingerprint, antivirus, renditions through the MED-020 pipeline); the team's uploads are not limited per hour
//     (SEC-070), one hundred files per batch;
//   · a video is an address whose FORM only is checked (YouTube, Vimeo), never fetched (SEC-062): READY at once;
//   · nature, room, caption, alt text, date, « Image d'illustration », « Couverture » (one per owner, MOD-203), order;
//   · delete: refused when it is the last image a published property has, or would bring one under the publication
//     threshold (CTL-083, CYC-122) — checked in the transaction, which is rolled back when it would;
//   · « Réessayer » a failed processing (CTL-082), bulk actions (CTL-084), and the library of every media (EA-44).
// Rights: the catalogue (`catalogue.write`), a promoter (`promoter.write`), a partner (`content.manage`); reading with
// the read permission of the owner.
import { createHash, createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  MEDIA_KINDS_BY_OWNER,
  MEDIA_LIBRARY_VIEWS,
  MEDIA_RULES,
  SMALL_IMAGE,
  mediaBulkSchema,
  mediaCompleteSchema,
  mediaLibraryQuerySchema,
  mediaReorderSchema,
  mediaUpdateSchema,
  mediaUploadSchema,
  mediaVideoSchema,
  type AdminMedia,
  type AdminMediaOwner,
  type MediaBulkResult,
  type MediaLibrary,
  type MediaListResponse,
  type MediaUploadResponse,
  type Permission,
} from '@dp/contracts';
import { ENV, type Env } from '../config/env.js';
import type { Media, MediaKind, Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { StaffViews } from '../back-office/staff-view.js';
import { CatalogueMediaService, type CatalogueOwnerType } from '../catalogue-admin/catalogue-media.service.js';
import { CatalogueReferenceService, adminImageRef } from '../catalogue-admin/catalogue-reference.js';
import { PropertyPublication } from '../catalogue-admin/property-publication.js';
import { mediaBase } from '../catalogue/media.js';
import { cleanFileName, KINDS_BY_OWNER, MediaPipeline } from '../files/media-pipeline.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../files/object-storage.js';

/** API-080 — an announced upload must be sent within 15 minutes. */
const UPLOAD_TTL_MS = 15 * 60_000;
const IMAGE = new Set(['PHOTO', 'RENDER_3D']);

const WRITE: Record<AdminMediaOwner, Permission> = { PROGRAM: 'catalogue.write', PROPERTY: 'catalogue.write', LOT: 'catalogue.write', PROGRAM_UPDATE: 'catalogue.write', PROMOTER: 'promoter.write', PARTNER: 'content.manage' };
const READ: Record<AdminMediaOwner, Permission> = { PROGRAM: 'catalogue.read', PROPERTY: 'catalogue.read', LOT: 'catalogue.read', PROGRAM_UPDATE: 'catalogue.read', PROMOTER: 'promoter.read', PARTNER: 'content.manage' };

/** CTL-080 — the form of a YouTube or Vimeo address; its canonical form, or null. Nothing is fetched (SEC-062). */
export function videoAddress(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const yt = /^[A-Za-z0-9_-]{11}$/;
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1);
    return yt.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v');
    if (u.pathname === '/watch' && v && yt.test(v)) return `https://www.youtube.com/watch?v=${v}`;
    const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})$/);
    return m ? `https://www.youtube.com/watch?v=${m[1]}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/^\/(?:video\/)?(\d{6,12})$/);
    return m ? `https://vimeo.com/${m[1]}` : null;
  }
  return null;
}

@Injectable()
export class MediaAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly views: StaffViews,
    private readonly pipeline: MediaPipeline,
    private readonly catalogueMedia: CatalogueMediaService,
    private readonly publication: PropertyPublication,
    private readonly references: CatalogueReferenceService,
    private readonly notifier: ChangeNotifier,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async assertMay(auth: AuthContext, ownerType: AdminMediaOwner, write: boolean): Promise<void> {
    const staff = await this.views.of(auth);
    if (!staff.has((write ? WRITE : READ)[ownerType])) throw new AppError(ErrorCode.FORBIDDEN);
  }

  /** The name of the owner (alt texts, MED-023) and the property/programme a lot or a point belongs to. */
  private async ownerLabel(ownerType: string, ownerId: string): Promise<string> {
    if (ownerType === 'PROGRAM') return (await this.prisma.program.findUnique({ where: { id: ownerId }, select: { name: true } }))?.name ?? '';
    if (ownerType === 'PROPERTY') return (await this.prisma.property.findUnique({ where: { id: ownerId }, select: { title: true } }))?.title ?? '';
    if (ownerType === 'LOT') {
      const l = await this.prisma.lot.findUnique({ where: { id: ownerId }, select: { reference: true, property: { select: { title: true } } } });
      return l ? `${l.property.title} – ${l.reference}` : '';
    }
    if (ownerType === 'PROGRAM_UPDATE') return (await this.prisma.programUpdate.findUnique({ where: { id: ownerId }, select: { program: { select: { name: true } } } }))?.program.name ?? '';
    if (ownerType === 'PROMOTER') {
      const p = await this.prisma.promoter.findUnique({ where: { id: ownerId }, select: { brandName: true, legalName: true } });
      return p ? (p.brandName ?? p.legalName) : '';
    }
    return (await this.prisma.partner.findUnique({ where: { id: ownerId }, select: { name: true } }))?.name ?? '';
  }

  view(m: Media, label: string): AdminMedia {
    const mediaUrl = this.references.mediaUrl();
    const isDoc = m.mimeType === 'application/pdf';
    return {
      id: m.id,
      ownerType: m.ownerType as AdminMediaOwner,
      ownerId: m.ownerId,
      kind: m.kind as AdminMedia['kind'],
      processingStatus: m.processingStatus as AdminMedia['processingStatus'],
      processingError: m.processingError,
      // CTL-082 — no retry when the antivirus refused the file: it is deleted, it must be uploaded again.
      canRetry: m.processingStatus === 'FAILED' && m.kind !== 'VIDEO' && !/sécurité/.test(m.processingError ?? ''),
      fileName: m.fileName,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes === null ? null : Number(m.sizeBytes),
      width: m.width,
      height: m.height,
      small: !isDoc && m.kind !== 'VIDEO' && m.kind !== 'LOGO' && m.width !== null && m.height !== null && (m.width < SMALL_IMAGE.width || m.height < SMALL_IMAGE.height) && Math.max(m.width, m.height) < SMALL_IMAGE.width,
      thumb: adminImageRef(mediaUrl, m, 'thumb'),
      url: m.kind === 'VIDEO' ? m.externalUrl : isDoc && m.processingStatus === 'READY' ? `${mediaBase(mediaUrl, m)}/original.pdf` : null,
      alt: m.alt,
      altProposed: m.roomLabel ? `${label} – ${m.roomLabel}` : label,
      caption: m.caption,
      roomLabel: m.roomLabel,
      isCover: m.isCover,
      isIllustration: m.isIllustration,
      takenAt: m.takenAt ? m.takenAt.toISOString().slice(0, 10) : null,
      sortOrder: m.sortOrder,
      createdAt: m.createdAt.toISOString(),
    };
  }

  /** `GET /admin/media?ownerType=&ownerId=` — CTL-080. */
  async list(auth: AuthContext, query: Record<string, unknown>): Promise<MediaListResponse> {
    const ownerType = String(query.ownerType ?? '') as AdminMediaOwner;
    const ownerId = String(query.ownerId ?? '');
    if (!(ownerType in WRITE) || !/^[0-9a-f-]{36}$/.test(ownerId) || Object.keys(query).some((k) => k !== 'ownerType' && k !== 'ownerId')) throw new AppError(ErrorCode.BAD_REQUEST);
    await this.assertMay(auth, ownerType, false);
    await this.catalogueMedia.checkOwner(ownerType as CatalogueOwnerType, ownerId);
    const [rows, label, staff] = await Promise.all([
      this.prisma.media.findMany({ where: { ownerType, ownerId, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] }),
      this.ownerLabel(ownerType, ownerId),
      this.views.of(auth),
    ]);
    let usesProgramPhotos = false;
    if (ownerType === 'PROPERTY') {
      const p = await this.prisma.property.findUnique({ where: { id: ownerId }, select: { programId: true } });
      usesProgramPhotos = Boolean(p?.programId) && !rows.some((m) => IMAGE.has(m.kind) && m.processingStatus === 'READY');
    }
    return { data: rows.map((m) => this.view(m, label)), owner: { type: ownerType, id: ownerId, label }, usesProgramPhotos, canWrite: staff.has(WRITE[ownerType]) };
  }

  // ─── Upload (API-080) ─────────────────────────────────────────────────

  private signature(id: string, exp: number): string {
    return createHmac('sha256', this.env.LINK_SIGNING_KEY).update(`dp_media_upload:${id}:${exp}`).digest('base64url');
  }

  /** API-080 step 1 — rights and limits checked (413, 415, MED-010); a signed address valid 15 minutes. */
  async announce(auth: AuthContext, body: unknown): Promise<MediaUploadResponse> {
    const input = parseOrThrow(mediaUploadSchema, body);
    await this.assertMay(auth, input.ownerType, true);
    if (!MEDIA_KINDS_BY_OWNER[input.ownerType].includes(input.kind)) throw AppError.validation([{ field: 'kind', code: 'INVALID_CHOICE' }]);
    await this.catalogueMedia.checkOwner(input.ownerType as CatalogueOwnerType, input.ownerId);
    const rule = MEDIA_RULES[input.kind as keyof typeof MEDIA_RULES];
    if (input.size > rule.maxMb * 1e6) throw new AppError(ErrorCode.FILE_TOO_LARGE, { params: { maxMb: rule.maxMb, n: rule.maxMb } });
    if (input.contentType && !rule.types.includes(input.contentType.toLowerCase())) throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: rule.types } });
    const now = this.clock.now();
    const id = newId();
    const expiresAt = new Date(now.getTime() + UPLOAD_TTL_MS);
    await this.prisma.upload.create({
      data: {
        id,
        ownerType: 'MEDIA',
        ownerId: input.ownerId,
        requestedById: auth.userId,
        // the owner type and the kind travel with the upload row; the storage key never holds the name (MED-012)
        fileName: `${input.ownerType}:${input.kind}:${cleanFileName(input.fileName)}`.slice(0, 200),
        declaredMimeType: input.contentType || 'application/octet-stream',
        declaredSizeBytes: BigInt(input.size),
        declaredSha256: input.sha256,
        storageKey: `uploads/${id}`,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      },
    });
    const exp = expiresAt.getTime();
    return { id, uploadUrl: `/api/v1/admin/media/uploads/${id}/content?e=${exp}&s=${this.signature(id, exp)}`, expiresAt: expiresAt.toISOString() };
  }

  /** API-080 step 2 — local stand-in for the direct send to the storage (MED-016): the bytes under `uploads/{id}`. */
  async receive(auth: AuthContext, id: string, query: { e?: string; s?: string }, body: unknown): Promise<void> {
    const exp = Number(query.e);
    if (!query.s || !Number.isFinite(exp) || exp < this.clock.now().getTime() || query.s !== this.signature(id, exp)) throw new AppError(ErrorCode.GONE);
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.requestedById !== auth.userId || upload.ownerType !== 'MEDIA') throw AppError.notFound();
    if (upload.status !== 'PENDING') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (!Buffer.isBuffer(body) || body.length === 0) throw AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]);
    if (body.length !== Number(upload.declaredSizeBytes)) throw AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]);
    await this.storage.put('private', upload.storageKey, body, upload.declaredMimeType);
  }

  /** API-080 step 3 — the file read back, size and fingerprint compared (FIA-100), then the MED-020 pipeline. */
  async complete(auth: AuthContext, actor: Actor, id: string, body: unknown): Promise<AdminMedia> {
    const extra = parseOrThrow(mediaCompleteSchema, body ?? {});
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.requestedById !== auth.userId || upload.ownerType !== 'MEDIA') throw AppError.notFound();
    const [ownerType, kind, ...rest] = upload.fileName.split(':') as [AdminMediaOwner, MediaKind, ...string[]];
    const fileName = rest.join(':');
    await this.assertMay(auth, ownerType, true);
    if (upload.status === 'COMPLETED' && upload.resultFileId) {
      const m = await this.prisma.media.findUnique({ where: { id: upload.resultFileId } });
      if (m) return this.view(m, await this.ownerLabel(m.ownerType, m.ownerId)); // same answer, nothing redone
    }
    if (upload.status === 'REJECTED') throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
    const now = this.clock.now();
    const content = await this.storage.get('private', upload.storageKey);
    if (!content) {
      if (upload.expiresAt.getTime() < now.getTime()) throw new AppError(ErrorCode.GONE);
      throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
    }
    const reject = async (err: unknown): Promise<never> => {
      await this.prisma.upload.update({ where: { id }, data: { status: 'REJECTED', updatedAt: now } });
      await this.storage.delete('private', upload.storageKey).catch(() => undefined);
      throw err;
    };
    if (content.length !== Number(upload.declaredSizeBytes) || createHash('sha256').update(content).digest('hex') !== upload.declaredSha256) {
      await reject(AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]));
    }
    if (!KINDS_BY_OWNER[ownerType].includes(kind)) await reject(AppError.validation([{ field: 'kind', code: 'INVALID_CHOICE' }]));
    // CTL-081 — the room is required for a 360° view; filled afterwards when not given here.
    let media: Media;
    try {
      media = await this.pipeline.ingest(
        { ownerType, ownerId: upload.ownerId, kind, body: content, fileName, roomLabel: extra.roomLabel ?? null, caption: extra.caption ?? null, isIllustration: extra.isIllustration ?? false },
        actor,
        this.catalogueMedia.hooks(),
      );
    } catch (err) {
      return reject(err);
    }
    await this.storage.delete('private', upload.storageKey).catch(() => undefined);
    await this.prisma.upload.update({ where: { id }, data: { status: 'COMPLETED', completedAt: now, resultFileId: media.id, updatedAt: now } });
    await this.notifier.committed(await this.catalogueMedia.ownerTags(ownerType, upload.ownerId));
    return this.view(media, await this.ownerLabel(ownerType, upload.ownerId));
  }

  /** CTL-080 — a YouTube or Vimeo video: READY at once once the form of its address is accepted. */
  async addVideo(auth: AuthContext, actor: Actor, body: unknown): Promise<AdminMedia> {
    const input = parseOrThrow(mediaVideoSchema, body);
    await this.assertMay(auth, input.ownerType, true);
    await this.catalogueMedia.checkOwner(input.ownerType, input.ownerId);
    const url = videoAddress(input.url);
    if (!url) throw AppError.validation([{ field: 'url', code: 'VIDEO_URL' }]);
    const media = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const last = await tx.media.aggregate({ where: { ownerType: input.ownerType, ownerId: input.ownerId, deletedAt: null }, _max: { sortOrder: true } });
      const m = await tx.media.create({
        data: {
          id: newId(),
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          kind: 'VIDEO',
          isPublic: true,
          externalUrl: url,
          caption: input.caption || null,
          isCover: false,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
          processingStatus: 'READY',
          uploadedById: stampBy(actor),
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, { action: 'media.created', entityType: 'media', entityId: m.id, entityLabel: 'VIDEO', after: { ownerType: m.ownerType, ownerId: m.ownerId, kind: 'VIDEO', url } });
      await this.catalogueMedia.recalcOwner(tx, m.ownerType, m.ownerId);
      return m;
    });
    await this.notifier.committed(await this.catalogueMedia.ownerTags(input.ownerType, input.ownerId));
    return this.view(media, await this.ownerLabel(media.ownerType, media.ownerId));
  }

  // ─── Edit, order, cover (CTL-081) ─────────────────────────────────────

  private async loadForWrite(auth: AuthContext, id: string): Promise<Media> {
    const m = await this.prisma.media.findFirst({ where: { id, deletedAt: null } });
    if (!m || !(m.ownerType in WRITE)) throw AppError.notFound();
    await this.assertMay(auth, m.ownerType as AdminMediaOwner, true);
    return m;
  }

  /**
   * CYC-122, CTL-083 — inside the transaction of a change that removes or turns away an image: the published properties
   * that depend on these owners must stay publishable; otherwise `409 CONFLICT_STATE` `MEDIA_NEEDED` with their titles.
   */
  private async assertStillPublishable(tx: Tx, owners: { ownerType: string; ownerId: string }[]): Promise<void> {
    const propertyIds = new Set<string>();
    for (const o of owners) {
      if (o.ownerType === 'PROPERTY') propertyIds.add(o.ownerId);
      if (o.ownerType === 'LOT') {
        const lot = await tx.lot.findUnique({ where: { id: o.ownerId }, select: { propertyId: true } });
        if (lot) propertyIds.add(lot.propertyId);
      }
      if (o.ownerType === 'PROGRAM') for (const p of await tx.property.findMany({ where: { programId: o.ownerId, deletedAt: null, publication: 'PUBLISHED' }, select: { id: true } })) propertyIds.add(p.id);
    }
    const broken: string[] = [];
    for (const pid of propertyIds) {
      const p = await tx.property.findUnique({ where: { id: pid }, select: { publication: true, title: true } });
      if (p?.publication !== 'PUBLISHED') continue;
      if ((await this.publication.missing(tx, pid)).length) broken.push(p.title);
    }
    if (broken.length) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'MEDIA_NEEDED', params: { n: broken.length, liste: broken.join(', ') } });
  }

  /** `PATCH /admin/media/{id}` — CTL-081. */
  async update(auth: AuthContext, actor: Actor, id: string, body: unknown): Promise<AdminMedia> {
    const data = parseOrThrow(mediaUpdateSchema, body);
    const before = await this.loadForWrite(auth, id);
    const ownerType = before.ownerType as AdminMediaOwner;
    if (data.kind !== undefined && data.kind !== before.kind) {
      // A kind is changed only within its family: an image stays an image, a document a document (MOD-235).
      const family = (k: string) => (k === 'VIDEO' ? 'video' : before.mimeType === 'application/pdf' ? 'pdf' : k === 'PANO_360' ? 'pano' : k === 'BROCHURE' ? 'pdf' : 'image');
      if (!MEDIA_KINDS_BY_OWNER[ownerType].includes(data.kind) || family(data.kind) !== family(before.kind)) throw AppError.validation([{ field: 'kind', code: 'INVALID_CHOICE' }]);
    }
    if (data.isCover && (!IMAGE.has(data.kind ?? before.kind) || before.processingStatus !== 'READY')) throw AppError.validation([{ field: 'isCover', code: 'INVALID_CHOICE' }]);
    if (data.roomLabel === null && (data.kind ?? before.kind) === 'PANO_360') throw AppError.validation([{ field: 'roomLabel', code: 'REQUIRED' }]);
    const updated = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const patch: Prisma.MediaUncheckedUpdateInput = {};
      if (data.kind !== undefined) patch.kind = data.kind;
      if (data.roomLabel !== undefined) patch.roomLabel = data.roomLabel;
      if (data.caption !== undefined) patch.caption = data.caption || null;
      if (data.alt !== undefined) patch.alt = data.alt || null;
      if (data.takenAt !== undefined) patch.takenAt = data.takenAt ? new Date(`${data.takenAt}T00:00:00Z`) : null;
      if (data.isIllustration !== undefined) patch.isIllustration = data.isIllustration;
      if (data.isCover) {
        // MOD-203 — one cover per owner.
        await tx.media.updateMany({ where: { ownerType: before.ownerType, ownerId: before.ownerId, isCover: true, deletedAt: null, NOT: { id } }, data: { isCover: false, updatedAt: now } });
        patch.isCover = true;
      }
      if (patch.kind && !IMAGE.has(patch.kind as string)) patch.isCover = false;
      const m = await tx.media.update({ where: { id }, data: { ...patch, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, {
        action: 'media.updated',
        entityType: 'media',
        entityId: id,
        entityLabel: before.fileName ?? before.kind,
        before: { kind: before.kind, roomLabel: before.roomLabel, caption: before.caption, alt: before.alt, isIllustration: before.isIllustration, isCover: before.isCover, ownerType: before.ownerType, ownerId: before.ownerId },
        after: { ...data, ownerType: before.ownerType, ownerId: before.ownerId },
      });
      await this.catalogueMedia.recalcOwner(tx, m.ownerType, m.ownerId);
      if (data.kind !== undefined && data.kind !== before.kind) await this.assertStillPublishable(tx, [m]);
      return m;
    });
    await this.notifier.committed(await this.catalogueMedia.ownerTags(updated.ownerType, updated.ownerId));
    return this.view(updated, await this.ownerLabel(updated.ownerType, updated.ownerId));
  }

  /** `POST /admin/media/reorder` — CTL-081: the order set by drag and drop, for the whole owner. */
  async reorder(auth: AuthContext, actor: Actor, body: unknown): Promise<{ saved: true }> {
    const data = parseOrThrow(mediaReorderSchema, body);
    await this.assertMay(auth, data.ownerType, true);
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const rows = await tx.media.findMany({ where: { ownerType: data.ownerType, ownerId: data.ownerId, deletedAt: null }, select: { id: true, sortOrder: true } });
      const known = new Set(rows.map((r) => r.id));
      if (data.ids.some((x) => !known.has(x)) || new Set(data.ids).size !== data.ids.length) throw AppError.validation([{ field: 'ids', code: 'INVALID_CHOICE' }]);
      const order = [...data.ids, ...rows.filter((r) => !data.ids.includes(r.id)).sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.id)];
      for (const [i, mid] of order.entries()) await tx.media.update({ where: { id: mid }, data: { sortOrder: i + 1, updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'media.updated', entityType: 'media', entityId: data.ids[0]!, entityLabel: 'order', after: { ownerType: data.ownerType, ownerId: data.ownerId, order } });
      await this.catalogueMedia.recalcOwner(tx, data.ownerType, data.ownerId);
    });
    await this.notifier.committed(await this.catalogueMedia.ownerTags(data.ownerType, data.ownerId));
    return { saved: true };
  }

  /** `DELETE /admin/media/{id}` — CTL-083 (in the trash: `deletedAt`; audit `media.deleted`). */
  async remove(auth: AuthContext, actor: Actor, id: string): Promise<{ deleted: true }> {
    const m = await this.loadForWrite(auth, id);
    await this.removeMany(actor, [m]);
    return { deleted: true };
  }

  private async removeMany(actor: Actor, list: Media[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      for (const m of list) {
        await tx.media.update({ where: { id: m.id }, data: { deletedAt: now, isCover: false, updatedById: stampBy(actor), updatedAt: now } });
        await writeAudit(tx, actor, now, { action: 'media.deleted', entityType: 'media', entityId: m.id, entityLabel: m.fileName ?? m.kind, before: { ownerType: m.ownerType, ownerId: m.ownerId, kind: m.kind, isCover: m.isCover } });
        // A slot that loses its image is emptied.
        if (m.ownerType === 'PROMOTER' && m.kind === 'LOGO') await tx.promoter.updateMany({ where: { id: m.ownerId, logoMediaId: m.id }, data: { logoMediaId: null } });
        if (m.ownerType === 'PROMOTER' && m.kind === 'PHOTO') await tx.promoter.updateMany({ where: { id: m.ownerId, coverMediaId: m.id }, data: { coverMediaId: null } });
        if (m.ownerType === 'PARTNER') await tx.partner.updateMany({ where: { id: m.ownerId, logoMediaId: m.id }, data: { logoMediaId: null } });
      }
      const owners = [...new Map(list.map((m) => [`${m.ownerType}:${m.ownerId}`, { ownerType: m.ownerType, ownerId: m.ownerId }])).values()];
      for (const o of owners) await this.catalogueMedia.recalcOwner(tx, o.ownerType, o.ownerId);
      await this.assertStillPublishable(tx, owners);
    }, { timeout: 30_000 });
    const tags = new Set<string>();
    for (const m of list) for (const t of await this.catalogueMedia.ownerTags(m.ownerType, m.ownerId)) tags.add(t);
    await this.notifier.committed([...tags]);
  }

  /** CTL-082 « Réessayer » — the control and the processing of the file already received, again. */
  async retry(auth: AuthContext, actor: Actor, id: string): Promise<AdminMedia> {
    const m = await this.loadForWrite(auth, id);
    if (m.processingStatus !== 'FAILED' || !m.storageKey) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const body = await this.storage.get('private', m.storageKey);
    if (!body) throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
    await this.prisma.media.update({ where: { id }, data: { processingStatus: 'PENDING', processingError: null, updatedAt: this.clock.now() } });
    const done = await this.pipeline.process({ ...m, processingStatus: 'PENDING' }, body, actor, this.catalogueMedia.hooks(), false);
    await this.notifier.committed(await this.catalogueMedia.ownerTags(m.ownerType, m.ownerId));
    return this.view(done, await this.ownerLabel(m.ownerType, m.ownerId));
  }

  /** `POST /admin/media/bulk` — CTL-084: change the kind, mark « Image d'illustration », delete; one refusal does not stop the others. */
  async bulk(auth: AuthContext, actor: Actor, body: unknown): Promise<MediaBulkResult> {
    const data = parseOrThrow(mediaBulkSchema, body);
    const rows = await this.prisma.media.findMany({ where: { id: { in: data.ids }, deletedAt: null } });
    const result: MediaBulkResult = { done: 0, refused: [] };
    for (const m of rows) {
      try {
        if (data.action === 'delete') await this.removeMany(actor, [await this.loadForWrite(auth, m.id)]);
        else if (data.action === 'kind') await this.update(auth, actor, m.id, { kind: data.kind });
        else await this.update(auth, actor, m.id, { isIllustration: data.isIllustration ?? true });
        result.done++;
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        result.refused.push({ id: m.id, reason: err.options.reason ?? err.code, ...(err.options.params ? { params: err.options.params as Record<string, string | number> } : {}) });
      }
    }
    return result;
  }

  // ─── The library (EA-44) ──────────────────────────────────────────────

  /** `GET /admin/media/library` — every media of the programmes and properties, filtered and paged by the server. */
  async library(auth: AuthContext, rawQuery: unknown): Promise<MediaLibrary> {
    const parsed = mediaLibraryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    const q = parsed.data;
    await this.assertMay(auth, 'PROGRAM', false);
    const viewWhere = (v: string): Prisma.MediaWhereInput =>
      v === 'failed' ? { processingStatus: 'FAILED' }
      : v === 'pending' ? { processingStatus: 'PENDING' }
      : v === 'small' ? { kind: { in: ['PHOTO', 'RENDER_3D'] }, processingStatus: 'READY', width: { lt: SMALL_IMAGE.width } }
      : v === 'no-room' ? { kind: { in: ['PHOTO', 'PANO_360'] }, roomLabel: null }
      : {};
    let ownerIds: string[] | null = null;
    if (q.q && q.q.length >= 2) {
      const [programs, properties] = await Promise.all([
        this.prisma.program.findMany({ where: { deletedAt: null, name: { contains: q.q, mode: 'insensitive' } }, select: { id: true }, take: 200 }),
        this.prisma.property.findMany({ where: { deletedAt: null, OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { reference: { contains: q.q, mode: 'insensitive' } }] }, select: { id: true }, take: 500 }),
      ]);
      ownerIds = [...programs, ...properties].map((x) => x.id);
    }
    const criteria = (skip?: 'kind' | 'ownerType'): Prisma.MediaWhereInput => ({
      AND: [
        { deletedAt: null, ownerType: { in: ['PROGRAM', 'PROPERTY'] } },
        viewWhere(q.view ?? 'all'),
        ownerIds ? { ownerId: { in: ownerIds } } : {},
        skip !== 'kind' && q.kind.length ? { kind: { in: q.kind } } : {},
        skip !== 'ownerType' && q.ownerType.length ? { ownerType: { in: q.ownerType } } : {},
      ],
    });
    const dir = q.sort.startsWith('-') ? 'desc' : 'asc';
    const orderBy: Prisma.MediaOrderByWithRelationInput[] = q.sort.includes('sizeBytes') ? [{ sizeBytes: { sort: dir, nulls: 'last' } }, { id: 'asc' }] : [{ createdAt: dir }, { id: dir }];
    const where = criteria();
    const [total, rows, byKind, byOwner, viewCounts] = await Promise.all([
      this.prisma.media.count({ where }),
      this.prisma.media.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.media.groupBy({ by: ['kind'], where: criteria('kind'), _count: { _all: true } }),
      this.prisma.media.groupBy({ by: ['ownerType'], where: criteria('ownerType'), _count: { _all: true } }),
      Promise.all(MEDIA_LIBRARY_VIEWS.map((v) => this.prisma.media.count({ where: { deletedAt: null, ownerType: { in: ['PROGRAM', 'PROPERTY'] }, ...viewWhere(v) } }))),
    ]);
    const programIds = rows.filter((r) => r.ownerType === 'PROGRAM').map((r) => r.ownerId);
    const propertyIds = rows.filter((r) => r.ownerType === 'PROPERTY').map((r) => r.ownerId);
    const [programs, properties] = await Promise.all([
      this.prisma.program.findMany({ where: { id: { in: programIds } }, select: { id: true, name: true } }),
      this.prisma.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, title: true, reference: true } }),
    ]);
    const label = (r: Media) => (r.ownerType === 'PROGRAM' ? (programs.find((p) => p.id === r.ownerId)?.name ?? '') : (properties.find((p) => p.id === r.ownerId)?.title ?? ''));
    return {
      data: rows.map((r) => ({
        ...this.view(r, label(r)),
        owner: { type: r.ownerType as 'PROGRAM' | 'PROPERTY', id: r.ownerId, label: label(r), reference: r.ownerType === 'PROPERTY' ? (properties.find((p) => p.id === r.ownerId)?.reference ?? null) : null },
      })),
      meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
      views: Object.fromEntries(MEDIA_LIBRARY_VIEWS.map((v, i) => [v, viewCounts[i]!])) as MediaLibrary['views'],
      facets: { kind: Object.fromEntries(byKind.map((r) => [r.kind, r._count._all])), ownerType: Object.fromEntries(byOwner.map((r) => [r.ownerType, r._count._all])) },
    };
  }
}
