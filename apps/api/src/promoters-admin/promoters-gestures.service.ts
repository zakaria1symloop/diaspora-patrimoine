// The gestures of package 3.4 the write services of `catalogue-admin/` did not have yet:
//   · « Sélection » (vetting checklist and date, Q-003) · « Contacts » (one primary contact) — CTL-003;
//   · « Documents » (PartnerDocument): upload in three steps (API-080) — real type PDF/JPG/PNG, 25 MB, SHA-256, antivirus,
//     private key `partners/PROMOTER/{ownerId}/{documentId}` (MED-016) —, edit, delete, open through a signed address of
//     5 minutes with its trace `partner.document_viewed` (MED-030);
//   · « Suspendre », « Terminer » (reason required): the published programmes and properties are unpublished in the same
//     transaction, each marked `unpublishedBySuspensionAt` (MOD-110); « Reprendre la relation » (ENDED → PROSPECT);
//     « Les republier » after a suspension (CTL-004) — `promoter.status_changed`, `promoter.republished`;
//   · « Supprimer » (CTL-007, MOD-111): only without programme, property or dossier.
import { createHash, createHmac } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  ErrorCode,
  partnerDocumentSchema,
  promoterContactSchema,
  promoterReasonSchema,
  vettingSchema,
  type RepublishResult,
} from '@dp/contracts';
import { z } from 'zod';
import { ENV, type Env } from '../config/env.js';
import type { Promoter } from '../generated/prisma/client.js';
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
import { CatalogueCaches } from '../catalogue-admin/catalogue-caches.js';
import { emitCatalogueEvent } from '../catalogue-admin/catalogue-events.js';
import { conflictVersion } from '../catalogue-admin/partners-admin.service.js';
import { ProgramsAdminService } from '../catalogue-admin/programs-admin.service.js';
import { PropertyPublication } from '../catalogue-admin/property-publication.js';
import { cleanFileName } from '../files/media-pipeline.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../files/object-storage.js';
import { PrivateFileResolvers, privateFilePath, signPrivateFile } from '../files/private-files.js';
import { VIRUS_SCANNER, type VirusScanner } from '../files/virus-scanner.js';

const UPLOAD_TTL_MS = 15 * 60_000;
/** MED-010 — a partner's document: PDF, JPG, PNG, 25 MB. */
const DOC_MAX = 25 * 1024 * 1024;
const announceSchema = z.object({ fileName: z.string().trim().min(1).max(200), contentType: z.string().max(100).optional(), size: z.number().int().min(1).max(DOC_MAX), sha256: z.string().regex(/^[0-9a-f]{64}$/) });

/** MED-011 — the real type of a partner's document. */
export function documentType(body: Buffer): string | null {
  if (body.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return 'image/jpeg';
  if (body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

const label = (p: Pick<Promoter, 'brandName' | 'legalName'>) => p.brandName || p.legalName;

@Injectable()
export class PromotersGesturesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly caches: CatalogueCaches,
    private readonly notifier: ChangeNotifier,
    private readonly programs: ProgramsAdminService,
    private readonly publication: PropertyPublication,
    private readonly resolvers: PrivateFileResolvers,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** MED-030 — the signed address of a partner's document resolves here: only a live, CLEAN file. */
  onModuleInit(): void {
    this.resolvers.register('partnerdoc', async (id) => this.prisma.partnerDocument.findFirst({ where: { id, deletedAt: null, scanStatus: 'CLEAN' }, select: { storageKey: true, fileName: true, mimeType: true } }));
  }

  private async promoter(tx: Tx | PrismaService, id: string): Promise<Promoter> {
    const p = await tx.promoter.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw AppError.notFound();
    return p;
  }

  // ─── Sélection (Q-003) ────────────────────────────────────────────────

  async vetting(id: string, input: unknown, actor: Actor): Promise<{ saved: true }> {
    const data = parseOrThrow(vettingSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const p = await this.promoter(tx, id);
      if (data.version !== undefined && data.version !== p.version) throw conflictVersion(p.version, p.updatedAt);
      const lines = data.lines.map((l) => ({ label: l.label, done: l.done, note: l.note || null }));
      const vettedAt = data.vettedAt === undefined ? p.vettedAt : data.vettedAt ? new Date(`${data.vettedAt}T00:00:00Z`) : null;
      await tx.promoter.update({ where: { id }, data: { vettingChecklist: lines as never, vettedAt, vettedById: vettedAt && !p.vettedAt ? stampBy(actor) : p.vettedById, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'promoter.updated', entityType: 'promoter', entityId: id, entityLabel: label(p), before: { vettingChecklist: p.vettingChecklist, vettedAt: p.vettedAt }, after: { vettingChecklist: lines, vettedAt } });
    });
    return { saved: true };
  }

  // ─── Contacts ─────────────────────────────────────────────────────────

  async saveContact(promoterId: string, contactId: string | null, input: unknown, actor: Actor): Promise<{ id: string }> {
    const data = parseOrThrow(promoterContactSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await this.promoter(tx, promoterId);
      const count = await tx.promoterContact.count({ where: { promoterId } });
      // One primary contact: the first contact is the primary one; choosing another one moves the mark.
      const isPrimary = data.isPrimary || count === 0 || (contactId !== null && count === 1);
      if (isPrimary) await tx.promoterContact.updateMany({ where: { promoterId, isPrimary: true, ...(contactId ? { NOT: { id: contactId } } : {}) }, data: { isPrimary: false, updatedAt: now } });
      const fields = { fullName: data.fullName, role: data.role || null, email: data.email || null, phone: data.phone || null, notes: data.notes || null, isPrimary };
      if (contactId) {
        const before = await tx.promoterContact.findFirst({ where: { id: contactId, promoterId } });
        if (!before) throw AppError.notFound();
        if (before.isPrimary && !isPrimary) {
          const others = await tx.promoterContact.findFirst({ where: { promoterId, NOT: { id: contactId } }, orderBy: { createdAt: 'asc' } });
          if (others) await tx.promoterContact.update({ where: { id: others.id }, data: { isPrimary: true, updatedAt: now } });
          else fields.isPrimary = true;
        }
        await tx.promoterContact.update({ where: { id: contactId }, data: { ...fields, updatedById: stampBy(actor), updatedAt: now } });
        await writeAudit(tx, actor, now, { action: 'promoter_contact.updated', entityType: 'promoter_contact', entityId: contactId, entityLabel: data.role ?? 'contact', before: { promoterId, role: before.role, isPrimary: before.isPrimary }, after: { promoterId, role: fields.role, isPrimary: fields.isPrimary } });
        return { id: contactId };
      }
      const id = newId();
      await tx.promoterContact.create({ data: { id, promoterId, ...fields, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
      // SEC-081 — the label of the row is never a person's name.
      await writeAudit(tx, actor, now, { action: 'promoter_contact.created', entityType: 'promoter_contact', entityId: id, entityLabel: fields.role ?? 'contact', after: { promoterId, role: fields.role, isPrimary: fields.isPrimary } });
      return { id };
    });
  }

  async deleteContact(promoterId: string, contactId: string, actor: Actor): Promise<{ deleted: true }> {
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const c = await tx.promoterContact.findFirst({ where: { id: contactId, promoterId } });
      if (!c) throw AppError.notFound();
      await tx.promoterContact.delete({ where: { id: contactId } });
      if (c.isPrimary) {
        const next = await tx.promoterContact.findFirst({ where: { promoterId }, orderBy: { createdAt: 'asc' } });
        if (next) await tx.promoterContact.update({ where: { id: next.id }, data: { isPrimary: true, updatedAt: now } });
      }
      await writeAudit(tx, actor, now, { action: 'promoter_contact.deleted', entityType: 'promoter_contact', entityId: contactId, entityLabel: c.role ?? 'contact', before: { promoterId, role: c.role, isPrimary: c.isPrimary } });
    });
    return { deleted: true };
  }

  // ─── Documents (API-080, MED-030) ─────────────────────────────────────

  private signature(id: string, exp: number): string {
    return createHmac('sha256', this.env.LINK_SIGNING_KEY).update(`dp_partnerdoc_upload:${id}:${exp}`).digest('base64url');
  }

  async announceDocument(auth: AuthContext, promoterId: string, body: unknown): Promise<{ id: string; uploadUrl: string; expiresAt: string }> {
    const input = parseOrThrow(announceSchema, body);
    await this.promoter(this.prisma, promoterId);
    if (input.contentType && !['application/pdf', 'image/jpeg', 'image/png'].includes(input.contentType)) throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: ['pdf', 'jpg', 'png'] } });
    const now = this.clock.now();
    const id = newId();
    const expiresAt = new Date(now.getTime() + UPLOAD_TTL_MS);
    await this.prisma.upload.create({ data: { id, ownerType: 'PARTNER_DOCUMENT', ownerId: promoterId, requestedById: auth.userId, fileName: cleanFileName(input.fileName), declaredMimeType: input.contentType || 'application/octet-stream', declaredSizeBytes: BigInt(input.size), declaredSha256: input.sha256, storageKey: `uploads/${id}`, expiresAt, createdAt: now, updatedAt: now } });
    const exp = expiresAt.getTime();
    return { id, uploadUrl: `/api/v1/admin/promoters/${promoterId}/document-uploads/${id}/content?e=${exp}&s=${this.signature(id, exp)}`, expiresAt: expiresAt.toISOString() };
  }

  async receiveDocument(auth: AuthContext, uploadId: string, query: { e?: string; s?: string }, body: unknown): Promise<void> {
    const exp = Number(query.e);
    if (!query.s || !Number.isFinite(exp) || exp < this.clock.now().getTime() || query.s !== this.signature(uploadId, exp)) throw new AppError(ErrorCode.GONE);
    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload || upload.requestedById !== auth.userId || upload.ownerType !== 'PARTNER_DOCUMENT') throw AppError.notFound();
    if (upload.status !== 'PENDING') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (!Buffer.isBuffer(body) || body.length !== Number(upload.declaredSizeBytes)) throw AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]);
    await this.storage.put('private', upload.storageKey, body, upload.declaredMimeType);
  }

  /** API-080 step 3 — real type, size and fingerprint checked, antivirus, then the document with its metadata. */
  async completeDocument(auth: AuthContext, actor: Actor, promoterId: string, uploadId: string, input: unknown): Promise<{ id: string }> {
    const meta = parseOrThrow(partnerDocumentSchema, input);
    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload || upload.requestedById !== auth.userId || upload.ownerType !== 'PARTNER_DOCUMENT' || upload.ownerId !== promoterId) throw AppError.notFound();
    if (upload.status === 'COMPLETED' && upload.resultFileId) return { id: upload.resultFileId };
    const now = this.clock.now();
    const content = await this.storage.get('private', upload.storageKey);
    if (!content) throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
    const reject = async (err: AppError): Promise<never> => {
      await this.prisma.upload.update({ where: { id: uploadId }, data: { status: 'REJECTED', updatedAt: now } });
      await this.storage.delete('private', upload.storageKey).catch(() => undefined);
      throw err;
    };
    const type = documentType(content);
    if (!type) await reject(new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: ['pdf', 'jpg', 'png'] } }));
    if (content.length !== Number(upload.declaredSizeBytes) || createHash('sha256').update(content).digest('hex') !== upload.declaredSha256) await reject(AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]));
    if (type === 'application/pdf' && /\/Encrypt\b/.test(content.subarray(0, Math.min(content.length, 2_000_000)).toString('latin1'))) await reject(AppError.validation([{ field: 'file', code: 'FILE_PASSWORD_PROTECTED' }]));
    const scan = await this.scanner.scan(content);
    if (scan === 'INFECTED') await reject(AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]));
    const id = newId();
    const key = `partners/PROMOTER/${promoterId}/${id}`;
    await this.storage.put('private', key, content, type!);
    await this.storage.delete('private', upload.storageKey).catch(() => undefined);
    await this.prisma.$transaction(async (tx) => {
      await this.promoter(tx, promoterId);
      await tx.partnerDocument.create({
        data: {
          id,
          ownerType: 'PROMOTER',
          ownerId: promoterId,
          label: meta.label,
          category: meta.category,
          storageKey: key,
          fileName: upload.fileName,
          mimeType: type!,
          sizeBytes: content.length,
          checksumSha256: upload.declaredSha256,
          scanStatus: scan === 'CLEAN' ? 'CLEAN' : 'PENDING',
          issuedAt: meta.issuedAt ? new Date(`${meta.issuedAt}T00:00:00Z`) : null,
          expiresAt: meta.expiresAt ? new Date(`${meta.expiresAt}T00:00:00Z`) : null,
          uploadedById: auth.userId,
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.upload.update({ where: { id: uploadId }, data: { status: 'COMPLETED', completedAt: now, resultFileId: id, updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'partner_document.created', entityType: 'partner_document', entityId: id, entityLabel: meta.label, after: { promoterId, label: meta.label, category: meta.category, expiresAt: meta.expiresAt ?? null } });
    });
    return { id };
  }

  async updateDocument(promoterId: string, documentId: string, input: unknown, actor: Actor): Promise<{ saved: true }> {
    const meta = parseOrThrow(partnerDocumentSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const d = await tx.partnerDocument.findFirst({ where: { id: documentId, ownerType: 'PROMOTER', ownerId: promoterId, deletedAt: null } });
      if (!d) throw AppError.notFound();
      await tx.partnerDocument.update({ where: { id: documentId }, data: { label: meta.label, category: meta.category, issuedAt: meta.issuedAt ? new Date(`${meta.issuedAt}T00:00:00Z`) : null, expiresAt: meta.expiresAt ? new Date(`${meta.expiresAt}T00:00:00Z`) : null, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'partner_document.updated', entityType: 'partner_document', entityId: documentId, entityLabel: meta.label, before: { promoterId, label: d.label, category: d.category, expiresAt: d.expiresAt }, after: { promoterId, ...meta } });
    });
    return { saved: true };
  }

  async deleteDocument(promoterId: string, documentId: string, actor: Actor): Promise<{ deleted: true }> {
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const d = await tx.partnerDocument.findFirst({ where: { id: documentId, ownerType: 'PROMOTER', ownerId: promoterId, deletedAt: null } });
      if (!d) throw AppError.notFound();
      await tx.partnerDocument.update({ where: { id: documentId }, data: { deletedAt: now, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'partner_document.deleted', entityType: 'partner_document', entityId: documentId, entityLabel: d.label, before: { promoterId, label: d.label, category: d.category } });
    });
    return { deleted: true };
  }

  /** MED-030 — `promoter.read`, a signed address of 5 minutes, and its trace (`partner.document_viewed`). */
  async openDocument(actor: Actor, promoterId: string, documentId: string, disposition: 'inline' | 'attachment'): Promise<{ url: string; expiresAt: string }> {
    const d = await this.prisma.partnerDocument.findFirst({ where: { id: documentId, ownerType: 'PROMOTER', ownerId: promoterId, deletedAt: null } });
    if (!d) throw AppError.notFound();
    if (d.scanStatus !== 'CLEAN') throw AppError.conflictState('DOCUMENT_SCANNING');
    const now = this.clock.now();
    const { token, expiresAt } = signPrivateFile(this.env.LINK_SIGNING_KEY, 'partnerdoc', d.id, disposition, now);
    await this.prisma.$transaction((tx) => writeAudit(tx, actor, now, { action: 'partner.document_viewed', entityType: 'partner_document', entityId: d.id, entityLabel: d.label, after: { promoterId, disposition } }));
    return { url: privateFilePath(token), expiresAt: expiresAt.toISOString() };
  }

  // ─── Status (CTL-004, CYC-240, MOD-110) ──────────────────────────────

  /** MOD-110 — the published programmes and properties go back to DRAFT, each marked `unpublishedBySuspensionAt`. */
  private async cascadeUnpublish(tx: Tx, promoterId: string, actor: Actor, now: Date): Promise<{ tags: string[]; programs: number; properties: number }> {
    const tags = new Set<string>(['catalogue', 'home']);
    const programs = await tx.program.findMany({ where: { promoterId, deletedAt: null, publication: 'PUBLISHED' }, select: { id: true, name: true } });
    for (const p of programs) {
      await tx.program.update({ where: { id: p.id }, data: { publication: 'DRAFT', unpublishedBySuspensionAt: now, version: { increment: 1 }, updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'program.unpublished', entityType: 'program', entityId: p.id, entityLabel: p.name, before: { publication: 'PUBLISHED' }, after: { publication: 'DRAFT', bySuspension: true } });
      await emitCatalogueEvent(tx, now, actor, 'program.unpublished', { type: 'Program', id: p.id });
      tags.add(`program:${p.id}`);
    }
    const properties = await tx.property.findMany({ where: { promoterId, deletedAt: null, publication: 'PUBLISHED' }, select: { id: true, reference: true, programId: true } });
    for (const p of properties) {
      await tx.property.update({ where: { id: p.id }, data: { publication: 'DRAFT', unpublishedAt: now, unpublishedBySuspensionAt: now, programCascadeAt: null, version: { increment: 1 }, updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'property.unpublished', entityType: 'property', entityId: p.id, entityLabel: p.reference, before: { publication: 'PUBLISHED' }, after: { publication: 'DRAFT', bySuspension: true } });
      await emitCatalogueEvent(tx, now, actor, 'property.unpublished', { type: 'Property', id: p.id });
      tags.add(`property:${p.id}`);
    }
    const ctx = await this.caches.context(tx);
    for (const p of properties) await this.caches.recalcProperty(tx, p.id, ctx);
    for (const pid of new Set([...programs.map((p) => p.id), ...properties.map((p) => p.programId).filter((x): x is string => Boolean(x))])) await this.caches.recalcProgram(tx, pid);
    return { tags: [...tags], programs: programs.length, properties: properties.length };
  }

  private async changeStatus(id: string, to: 'SUSPENDED' | 'ENDED' | 'PROSPECT', input: unknown, actor: Actor): Promise<{ status: string }> {
    const data = to === 'PROSPECT' ? { reason: null as string | null, version: (input as { version?: number } | null)?.version } : parseOrThrow(promoterReasonSchema, input);
    let tags: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM promoters WHERE id = ${id}::uuid FOR UPDATE`;
      const p = await this.promoter(tx, id);
      if (data.version !== undefined && data.version !== p.version) throw conflictVersion(p.version, p.updatedAt);
      const allowed = to === 'SUSPENDED' ? p.status === 'ACTIVE' : to === 'ENDED' ? p.status !== 'ENDED' : p.status === 'ENDED';
      if (!allowed) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      let effects = { programs: 0, properties: 0 };
      if (to === 'SUSPENDED' || to === 'ENDED') {
        const r = await this.cascadeUnpublish(tx, id, actor, now);
        tags = r.tags;
        effects = { programs: r.programs, properties: r.properties };
      }
      await tx.promoter.update({ where: { id }, data: { status: to, statusChangedAt: now, statusReason: data.reason ?? null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'promoter.status_changed', entityType: 'promoter', entityId: id, entityLabel: label(p), before: { status: p.status }, after: { status: to, ...effects }, reason: data.reason ?? undefined });
      // AUT-010 — the advisers of its open dossiers are told (NS_PARTNER_SUSPENDED).
      await emitCatalogueEvent(tx, now, actor, 'promoter.status_changed', { type: 'Promoter', id }, { from: p.status, to });
    }, { timeout: 60_000 });
    await this.notifier.committed(tags.length ? tags : ['catalogue']);
    return { status: to };
  }

  suspend(id: string, input: unknown, actor: Actor) {
    return this.changeStatus(id, 'SUSPENDED', input, actor);
  }
  end(id: string, input: unknown, actor: Actor) {
    return this.changeStatus(id, 'ENDED', input, actor);
  }
  resume(id: string, input: unknown, actor: Actor) {
    return this.changeStatus(id, 'PROSPECT', input, actor);
  }

  /**
   * CTL-004 « Les republier » — the records still marked `unpublishedBySuspensionAt` that still pass CYC-125 / CYC-120
   * are published again at once (programmes first); the others are listed with what they lack. `promoter.republished`.
   */
  async republish(id: string, actor: Actor): Promise<RepublishResult> {
    const tags = new Set<string>(['catalogue', 'home']);
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const p = await this.promoter(tx, id);
      if (p.status !== 'ACTIVE') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      const out: RepublishResult = { republished: 0, blocked: [] };
      const programs = await tx.program.findMany({ where: { promoterId: id, deletedAt: null, unpublishedBySuspensionAt: { not: null } }, select: { id: true, name: true, publication: true, firstPublishedAt: true } });
      for (const pr of programs) {
        if (pr.publication !== 'DRAFT') continue;
        const missing = await this.programs.publicationMissing(tx, pr.id);
        if (missing.length) {
          out.blocked.push({ kind: 'PROGRAM', id: pr.id, label: pr.name, missing });
          continue;
        }
        await tx.program.update({ where: { id: pr.id }, data: { publication: 'PUBLISHED', publishedAt: now, firstPublishedAt: pr.firstPublishedAt ?? now, unpublishedBySuspensionAt: null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
        await writeAudit(tx, actor, now, { action: 'program.published', entityType: 'program', entityId: pr.id, entityLabel: pr.name, before: { publication: 'DRAFT' }, after: { publication: 'PUBLISHED', afterSuspension: true } });
        await emitCatalogueEvent(tx, now, actor, 'program.published', { type: 'Program', id: pr.id });
        tags.add(`program:${pr.id}`);
        out.republished++;
      }
      const properties = await tx.property.findMany({ where: { promoterId: id, deletedAt: null, unpublishedBySuspensionAt: { not: null } }, select: { id: true, reference: true, publication: true, programId: true } });
      const ctx = await this.caches.context(tx);
      for (const pr of properties) {
        if (pr.publication !== 'DRAFT') continue;
        const missing = await this.publication.missing(tx, pr.id, ctx);
        if (missing.length) {
          out.blocked.push({ kind: 'PROPERTY', id: pr.id, label: pr.reference, missing });
          continue;
        }
        await this.publication.tryPublishInTx(tx, pr.id, actor, now);
        tags.add(`property:${pr.id}`);
        out.republished++;
      }
      for (const pid of new Set(properties.map((x) => x.programId).filter((x): x is string => Boolean(x)))) await this.caches.recalcProgram(tx, pid);
      await writeAudit(tx, actor, now, { action: 'promoter.republished', entityType: 'promoter', entityId: id, entityLabel: label(p), after: { republished: out.republished, blocked: out.blocked.length } });
      return out;
    }, { timeout: 60_000 });
    await this.notifier.committed([...tags]);
    return result;
  }

  /** CTL-007, MOD-111 — only without programme, property or dossier; otherwise « Terminer » the relationship. */
  async remove(id: string, actor: Actor): Promise<{ deleted: true }> {
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const p = await this.promoter(tx, id);
      const used = (await tx.program.count({ where: { promoterId: id, deletedAt: null } })) + (await tx.property.count({ where: { promoterId: id, deletedAt: null } })) + (await tx.dossier.count({ where: { promoterId: id } }));
      if (used > 0) throw AppError.conflictState('PROMOTER_HAS_CONTENT');
      await tx.promoter.update({ where: { id }, data: { deletedAt: now, isPublic: false, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'promoter.deleted', entityType: 'promoter', entityId: id, entityLabel: label(p), before: { legalName: p.legalName, status: p.status } });
    });
    await this.notifier.committed(['catalogue']);
    return { deleted: true };
  }
}
