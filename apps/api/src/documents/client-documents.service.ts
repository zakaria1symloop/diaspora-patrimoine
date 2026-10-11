// EC-20, EC-21 — the pieces of a dossier on the client side (03-espace-client/04 § 1, § 2, § 4):
//   · the list as the client reads it (DOS-001 … DOS-006), with the transmission consent (DOS-040);
//   · the three-step upload of API-080 (announce · send to the storage · confirm), each file confirmed on its own;
//   · the version of a piece (API-081, DOS-012, DOS-014): created from the confirmed uploads, processed in the
//     background (document-processing.ts: copy to the final key, antivirus, photos joined in one PDF, CYC-140);
//   · reading a file through a signed 5-minute address (MED-030, DOS-005).
// Ownership is checked on every route: the dossier must be the client's (SEC-031) and the piece one of its pieces.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  DEPOSIT_MAX_IMAGES,
  ErrorCode,
  announceUploadSchema,
  createVersionSchema,
  partyAuthorizationSchema,
  transmissionConsentSchema,
  type AnnounceUploadResponse,
  type ClientDepositOutcome,
  type ClientDocument,
  type ClientDocumentFile,
  type ClientDocumentVersion,
  type ClientDocumentsView,
  type ClientDossierParty,
  type CompletedUpload,
  type DocumentCategoryCode,
  type SignedFileUrl,
} from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import type { Request } from 'express';
import type { Dossier, DossierDocument, DocumentFile, DocumentVersion, Upload } from '../generated/prisma/client.js';
import { writeAudit } from '../admin/audit.js';
import { ENV, type Env } from '../config/env.js';
import { cleanFileName } from '../files/media-pipeline.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../files/object-storage.js';
import { PrivateFileResolvers, privateFilePath, signPrivateFile, type Disposition } from '../files/private-files.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { localDate } from '../platform/holidays.service.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { OutboxWriter } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import {
  allowedMimes,
  clientActions,
  clientState,
  dayOf,
  depositKind,
  formatList,
  isEncryptedPdf,
  isImageMime,
  pdfLooksReadable,
  pdfPageCount,
  planVersion,
  shownValidity,
  sniffDocumentType,
  type DocStatus,
  type DossierStatusCode,
} from './document-rules.js';
import { imageReadable } from './pdf-assembly.js';

const t = createTranslator('fr');

/** API-080 — an announced upload must be sent within 15 minutes. */
export const UPLOAD_TTL_MS = 15 * 60_000;
/** SEC-070 — 20 deposits and 200 files per account per hour (photos counted one by one). */
export const DEPOSIT_RATE = { limit: 20, windowSeconds: 3600 };
export const FILE_RATE = { limit: 200, windowSeconds: 3600 };
/** The outcome of a refused deposit is shown on the line for a day (DOS-013). */
const OUTCOME_SHOWN_MS = 24 * 3600_000;

const CATEGORY_ORDER: DocumentCategoryCode[] = ['IDENTITY', 'RESIDENCE', 'EMPLOYMENT', 'INCOME', 'BANKING', 'PROPERTY', 'FINANCING', 'OTHER'];

/** MED-016 — final key of a piece's file: identifiers only. */
export const documentFileKey = (dossierId: string, documentId: string, fileId: string) => `documents/${dossierId}/${documentId}/${fileId}`;

/** DOS-040 — the exact sentence recorded with the consent (`Consent.wording`). */
export function transmissionWording(): string {
  return `${t('ui.documents.consent.text')} — ${t('ui.documents.consent.checkbox')}`;
}

type VersionWithFiles = DocumentVersion & { documentFiles: DocumentFile[] };

interface ViewContext {
  dossier: Dossier;
  today: string;
  warningDays: number;
  restrictedParties: Set<string>;
}

@Injectable()
export class ClientDocumentsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly idempotency: IdempotencyService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    private readonly outbox: OutboxWriter,
    private readonly resolvers: PrivateFileResolvers,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** MED-030 — the signed address of a piece's file resolves here: only a live, CLEAN file is ever served. */
  onModuleInit(): void {
    this.resolvers.register('doc', async (id) => {
      const f = await this.prisma.documentFile.findFirst({
        where: { id, deletedAt: null, scanStatus: 'CLEAN', version: { deletedAt: null, filesPurgedAt: null } },
        select: { storageKey: true, fileName: true, mimeType: true },
      });
      return f;
    });
  }

  // ─── Ownership ───────────────────────────────────────────────────────────

  private clientIdOf(ctx: AuthContext): string {
    if (!ctx.clientId) throw AppError.notFound();
    return ctx.clientId;
  }

  /** SEC-031 — the dossier of this client, by its reference; anything else is 404 (never 403: nothing to learn). */
  private async dossierOf(db: Tx | PrismaService, ctx: AuthContext, reference: string): Promise<Dossier> {
    const clientId = this.clientIdOf(ctx);
    const dossier = await db.dossier.findFirst({ where: { reference: reference.toUpperCase().slice(0, 20), clientId, deletedAt: null } });
    if (!dossier) throw AppError.notFound();
    return dossier;
  }

  private async documentOf(db: Tx | PrismaService, dossierId: string, documentId: string): Promise<DossierDocument> {
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) throw AppError.notFound();
    const doc = await db.dossierDocument.findFirst({ where: { id: documentId, dossierId, isInternal: false } });
    if (!doc) throw AppError.notFound();
    return doc;
  }

  private async today(): Promise<string> {
    return localDate(this.clock.now(), await this.settings.get('business.calendar.timezone'));
  }

  /**
   * API-081 points 1 to 3 — also applied when announcing (no file goes to a piece it cannot enter): the client provides
   * this piece, the dossier is not closed, the person is neither restricted nor without the client's authorisation, no
   * version is in its security check, and the piece accepts a deposit of this nature.
   */
  private async guard(db: Tx | PrismaService, dossier: Dossier, doc: DossierDocument, isRenewal: boolean): Promise<'REPLACEMENT' | 'RENEWAL'> {
    if (doc.providedBy !== 'CLIENT') throw AppError.notFound();
    if (dossier.status === 'WON' || dossier.status === 'LOST') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (doc.partyId) {
      const party = await db.dossierParty.findUnique({ where: { id: doc.partyId }, select: { role: true, firstName: true, restrictedAt: true } });
      if (party?.restrictedAt) throw AppError.conflictState('PARTY_RESTRICTED', { prenom: party.firstName ?? '' });
      if (party && party.role !== 'PRIMARY') {
        const consent = await db.consent.findFirst({ where: { partyId: doc.partyId, type: 'PARTY_AUTHORIZATION' }, orderBy: { givenAt: 'desc' }, select: { granted: true } });
        if (!consent?.granted) throw AppError.conflictState('PARTY_CONSENT_MISSING', { prenom: party.firstName ?? '' });
      }
    }
    const scanning = await db.documentVersion.count({ where: { documentId: doc.id, outcome: 'SCANNING', deletedAt: null } });
    if (scanning) throw AppError.conflictState('DOCUMENT_SCANNING');
    const kind = depositKind({
      status: doc.status as DocStatus,
      expiresAt: dayOf(doc.expiresAt),
      dossierStage: dossier.stage,
      dossierStatus: dossier.status as DossierStatusCode,
      today: await this.today(),
      warningDays: await this.settings.get('documents.expiryWarningDays'),
      isRenewal,
    });
    if (kind === 'LOCKED') throw AppError.conflictState('DOCUMENT_LOCKED');
    return kind;
  }

  // ─── EC-20 — the list ────────────────────────────────────────────────────

  async view(ctx: AuthContext, reference: string): Promise<ClientDocumentsView> {
    const dossier = await this.dossierOf(this.prisma, ctx, reference);
    return this.buildView(dossier);
  }

  private async buildView(dossier: Dossier): Promise<ClientDocumentsView> {
    const [docs, parties, client, consents, maxFileSizeMb, warningDays, today] = await Promise.all([
      this.prisma.dossierDocument.findMany({ where: { dossierId: dossier.id, isInternal: false } }),
      this.prisma.dossierParty.findMany({ where: { dossierId: dossier.id, removedAt: null }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.client.findUnique({ where: { id: dossier.clientId }, select: { employmentType: true, residencyStatus: true } }),
      this.prisma.consent.findMany({
        where: { OR: [{ clientId: dossier.clientId, type: 'DATA_SHARING_PARTNERS' }, { party: { dossierId: dossier.id }, type: 'PARTY_AUTHORIZATION' }] },
        orderBy: { givenAt: 'desc' },
        select: { type: true, granted: true, givenAt: true, partyId: true, recordedBy: { select: { firstName: true } } },
      }),
      this.settings.get('documents.maxFileSizeMb'),
      this.settings.get('documents.expiryWarningDays'),
      this.today(),
    ]);
    const versions = docs.length
      ? await this.prisma.documentVersion.findMany({
          where: { documentId: { in: docs.map((d) => d.id) }, deletedAt: null },
          include: { documentFiles: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { number: 'asc' },
        })
      : [];
    const byDoc = new Map<string, VersionWithFiles[]>();
    for (const v of versions) byDoc.set(v.documentId, [...(byDoc.get(v.documentId) ?? []), v]);
    const restrictedParties = new Set(parties.filter((p) => p.restrictedAt).map((p) => p.id));
    const vc: ViewContext = { dossier, today, warningDays, restrictedParties };

    const removedParties = new Set(
      (await this.prisma.dossierParty.findMany({ where: { dossierId: dossier.id, removedAt: { not: null } }, select: { id: true } })).map((p) => p.id),
    );
    const visibleDocs = docs.filter((d) => !d.partyId || !removedParties.has(d.partyId) || d.status !== 'WAIVED');
    const documents = visibleDocs
      .map((d) => this.toClientDocument(d, byDoc.get(d.id) ?? [], vc))
      .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || docs.findIndex((d) => d.id === a.id) - docs.findIndex((d) => d.id === b.id));

    const transmission = consents.find((c) => c.type === 'DATA_SHARING_PARTNERS');
    const missingFields = await this.conditionalFields(dossier);
    const partyViews: ClientDossierParty[] = parties.map((p) => {
      const authorization = consents.find((c) => c.type === 'PARTY_AUTHORIZATION' && c.partyId === p.id);
      const employment = p.role === 'PRIMARY' ? client?.employmentType : p.employmentType;
      const residency = p.role === 'PRIMARY' ? client?.residencyStatus : p.residencyStatus;
      return {
        id: p.id,
        role: p.role,
        firstName: p.role === 'PRIMARY' ? null : p.firstName,
        lastName: p.role === 'PRIMARY' ? null : p.lastName,
        restricted: Boolean(p.restrictedAt),
        authorizationGiven: p.role === 'PRIMARY' || Boolean(authorization?.granted),
        missingSituation: (missingFields.employment && !employment) || (missingFields.residency && !residency),
      };
    });
    const purged = versions.filter((v) => v.filesPurgedAt).map((v) => v.filesPurgedAt!.getTime());
    return {
      dossier: {
        id: dossier.id,
        reference: dossier.reference,
        stage: dossier.stage,
        status: dossier.status,
        financingRequested: dossier.financingRequested,
        readOnly: dossier.status === 'WON' || dossier.status === 'LOST',
        filesPurgedAt: (dossier.status === 'WON' || dossier.status === 'LOST') && purged.length ? new Date(Math.max(...purged)).toISOString() : null,
        completenessPct: dossier.completenessPct,
        satisfiedCount: dossier.satisfiedDocsCount,
        requiredCount: dossier.requiredDocsCount,
      },
      consent: {
        given: Boolean(transmission?.granted),
        givenAt: transmission?.granted ? transmission.givenAt.toISOString() : null,
        recordedBy: transmission?.granted ? (transmission.recordedBy?.firstName ?? null) : null,
      },
      parties: partyViews,
      documents,
      limits: { maxFileSizeMb, maxImagesPerDeposit: DEPOSIT_MAX_IMAGES, expiryWarningDays: warningDays },
    };
  }

  /** GED-020 — which situations the dossier's piece list depends on (lines with a condition on them). */
  private async conditionalFields(dossier: Dossier): Promise<{ employment: boolean; residency: boolean }> {
    if (!dossier.checklistTemplateId) return { employment: false, residency: false };
    const version = dossier.checklistTemplateVersion ?? 1;
    const items = await this.prisma.checklistItem.findMany({
      where: { templateId: dossier.checklistTemplateId, addedInVersion: { lte: version }, OR: [{ retiredInVersion: null }, { retiredInVersion: { gt: version } }] },
      select: { appliesWhen: true },
    });
    const has = (key: string) => items.some((i) => i.appliesWhen && typeof i.appliesWhen === 'object' && key in (i.appliesWhen as Record<string, unknown>));
    return { employment: has('employmentType'), residency: has('residencyStatus') };
  }

  private toVersion(v: VersionWithFiles): ClientDocumentVersion {
    const files: ClientDocumentFile[] = v.documentFiles
      .filter((f) => !f.deletedAt)
      .map((f) => ({
        id: f.id,
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeBytes: Number(f.sizeBytes),
        pageCount: f.pageCount,
        assembledFromImages: f.assembledFromImages,
        readable: f.scanStatus === 'CLEAN' && !v.filesPurgedAt,
      }));
    return { number: v.number, uploadedAt: v.uploadedAt.toISOString(), files, viaMessage: v.uploadedVia === 'CONVERSATION' };
  }

  /** DOS-003 — one line. */
  toClientDocument(d: DossierDocument, versions: VersionWithFiles[], vc: ViewContext): ClientDocument {
    const current = d.currentVersion > 0 ? versions.find((v) => v.number === d.currentVersion) ?? null : null;
    const renewal = d.renewalVersion ? versions.find((v) => v.number === d.renewalVersion) ?? null : null;
    const scanning = [...versions].reverse().find((v) => v.outcome === 'SCANNING') ?? null;
    const latest = versions[versions.length - 1] ?? null;
    const now = this.clock.now().getTime();
    let lastOutcome: ClientDepositOutcome | null = null;
    if (latest && now - latest.uploadedAt.getTime() < OUTCOME_SHOWN_MS && latest.uploadedVia !== 'ADMIN') {
      const infected = latest.documentFiles.filter((f) => f.scanStatus === 'INFECTED').length;
      if (latest.outcome === 'DISCARDED') {
        lastOutcome = { number: latest.number, at: latest.updatedAt.toISOString(), kind: infected === latest.documentFiles.filter((f) => !f.assembledFromImages).length ? 'REFUSED' : 'UNREADABLE' };
      } else if (latest.outcome !== 'SCANNING' && infected > 0) {
        lastOutcome = { number: latest.number, at: latest.updatedAt.toISOString(), kind: 'PARTIAL' };
      }
    }
    const status = d.status as DocStatus;
    const expiresAt = dayOf(d.expiresAt);
    const base = { status, expiresAt, dossierStage: vc.dossier.stage, dossierStatus: vc.dossier.status as DossierStatusCode, today: vc.today, warningDays: vc.warningDays };
    const currentView = current ? this.toVersion(current) : null;
    // CYC-141 — a renewal rejected after the current version: its reason is shown while the piece is to renew.
    const rejectedRenewal = status === 'VALIDATED' && !renewal ? [...versions].reverse().find((v) => v.isRenewal && v.outcome === 'REJECTED' && v.number > d.currentVersion) : undefined;
    return {
      id: d.id,
      partyId: d.partyId,
      label: d.label,
      description: d.description,
      category: d.category,
      isRequired: d.isRequired,
      providedBy: d.providedBy,
      status,
      state: clientState({ ...base, scanning: Boolean(scanning), hasRenewal: Boolean(renewal) }),
      statusChangedAt: d.statusChangedAt.toISOString(),
      dueAt: dayOf(d.dueAt),
      validUntil: shownValidity({ status, expiresAt, today: vc.today }),
      rejection: status === 'REJECTED' && d.rejectionReason ? { reason: d.rejectionReason, note: d.rejectionNote } : null,
      renewalRejection: rejectedRenewal?.rejectionReason ? { reason: rejectedRenewal.rejectionReason, note: rejectedRenewal.rejectionNote } : null,
      current: currentView,
      renewal: renewal ? this.toVersion(renewal) : null,
      scanning: scanning ? { number: scanning.number, uploadedAt: scanning.uploadedAt.toISOString(), isRenewal: scanning.isRenewal } : null,
      lastOutcome,
      maxFiles: d.maxFiles,
      acceptedFormats: formatList(d.acceptedFormats),
      actions: clientActions({
        ...base,
        providedBy: d.providedBy,
        isInternal: d.isInternal,
        scanning: Boolean(scanning),
        hasCurrentFiles: Boolean(currentView?.files.length),
        partyRestricted: Boolean(d.partyId && vc.restrictedParties.has(d.partyId)),
        filesPurged: Boolean(current?.filesPurgedAt),
      }),
    };
  }

  private async documentView(dossier: Dossier, documentId: string): Promise<ClientDocument> {
    const view = await this.buildView(dossier);
    const doc = view.documents.find((d) => d.id === documentId);
    if (!doc) throw AppError.notFound();
    return doc;
  }

  // ─── API-080 — announce, send, confirm ───────────────────────────────────

  private uploadSignature(id: string, exp: number): string {
    return createHmac('sha256', this.env.LINK_SIGNING_KEY).update(`dp_doc_upload:${id}:${exp}`).digest('base64url');
  }

  /** Step 1 — rights and limits (413, 415), one `Upload` per file, a signed address valid 15 minutes each. */
  async announce(ctx: AuthContext, reference: string, documentId: string, body: unknown): Promise<AnnounceUploadResponse> {
    const input = parseOrThrow(announceUploadSchema, body ?? {});
    const dossier = await this.dossierOf(this.prisma, ctx, reference);
    const doc = await this.documentOf(this.prisma, dossier.id, documentId);
    await this.guard(this.prisma, dossier, doc, input.isRenewal);
    const maxMb = await this.settings.get('documents.maxFileSizeMb');
    const allowed = allowedMimes(doc.acceptedFormats);
    for (const f of input.files) {
      if (f.size > maxMb * 1024 * 1024) throw new AppError(ErrorCode.FILE_TOO_LARGE, { params: { maxMb, n: maxMb } });
      const type = normaliseMime(f.contentType);
      if (!allowed.has(type)) throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: formatList(doc.acceptedFormats) } });
    }
    // SEC-070 — 200 files per account per hour (each photo counts).
    const key = `documents.files:${ctx.userId}`;
    if (this.limiter.retryAfter(key, { ...FILE_RATE, limit: FILE_RATE.limit - input.files.length + 1 })) {
      throw AppError.rateLimited(this.limiter.retryAfter(key, FILE_RATE) || 60);
    }
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + UPLOAD_TTL_MS);
    const uploads = input.files.map((f) => ({ id: newId(), f }));
    await this.prisma.upload.createMany({
      data: uploads.map(({ id, f }) => ({
        id,
        ownerType: 'DOCUMENT' as const,
        ownerId: doc.id,
        requestedById: ctx.userId,
        fileName: cleanFileName(f.fileName),
        declaredMimeType: normaliseMime(f.contentType),
        declaredSizeBytes: BigInt(f.size),
        declaredSha256: f.sha256,
        storageKey: `uploads/${id}`,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })),
    });
    for (let i = 0; i < input.files.length; i++) this.limiter.record(key, FILE_RATE);
    return {
      uploads: uploads.map(({ id }) => ({
        id,
        uploadUrl: `/api/v1/client/uploads/${id}/content?e=${expiresAt.getTime()}&s=${this.uploadSignature(id, expiresAt.getTime())}`,
        expiresAt: expiresAt.toISOString(),
      })),
    };
  }

  /** Step 2 — local stand-in for the direct send to the storage (MED-016): the bytes under `uploads/{id}`. */
  async receiveContent(ctx: AuthContext, id: string, query: { e?: string; s?: string }, body: unknown): Promise<void> {
    const exp = Number(query.e);
    const sig = typeof query.s === 'string' ? query.s : '';
    const expected = this.uploadSignature(id, exp);
    if (!sig || !Number.isFinite(exp) || exp < this.clock.now().getTime() || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new AppError(ErrorCode.GONE);
    }
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.requestedById !== ctx.userId || upload.ownerType !== 'DOCUMENT') throw AppError.notFound();
    if (upload.status !== 'PENDING') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (!Buffer.isBuffer(body) || body.length === 0) throw AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]);
    // The signed address fixes the exact size expected: the storage refuses anything else (MED-015).
    if (body.length !== Number(upload.declaredSizeBytes)) throw AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]);
    await this.storage.put('private', upload.storageKey, body, upload.declaredMimeType);
  }

  /**
   * Step 3 — the file read back: real type (MED-011), size and fingerprint against the announce, empty, unreadable or
   * protected file (TRV-064). For a piece the confirmation only marks the upload COMPLETED: the version creates the files.
   * After this point `declaredMimeType` holds the type observed in the content (used by the version).
   */
  async complete(ctx: AuthContext, reference: string, documentId: string, uploadId: string): Promise<CompletedUpload> {
    const dossier = await this.dossierOf(this.prisma, ctx, reference);
    const doc = await this.documentOf(this.prisma, dossier.id, documentId);
    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload || upload.requestedById !== ctx.userId || upload.ownerType !== 'DOCUMENT' || upload.ownerId !== doc.id) throw AppError.notFound();
    const done = (u: Upload): CompletedUpload => ({ id: u.id, fileName: u.fileName, mimeType: u.declaredMimeType, sizeBytes: Number(u.declaredSizeBytes), isImage: isImageMime(u.declaredMimeType) });
    if (upload.status === 'COMPLETED') return done(upload);
    if (upload.status === 'REJECTED') throw new AppError(ErrorCode.GONE);
    const now = this.clock.now();
    const content = await this.storage.get('private', upload.storageKey);
    if (!content) {
      if (upload.expiresAt.getTime() < now.getTime()) throw new AppError(ErrorCode.GONE);
      throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
    }
    const reject = async (err: AppError): Promise<never> => {
      await this.prisma.upload.update({ where: { id: upload.id }, data: { status: 'REJECTED', updatedAt: now } });
      await this.storage.delete('private', upload.storageKey).catch(() => undefined);
      throw err;
    };
    if (content.length === 0) await reject(AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]));
    const type = sniffDocumentType(content);
    if (!type || !allowedMimes(doc.acceptedFormats).has(type)) {
      await reject(new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: formatList(doc.acceptedFormats) } }));
    }
    if (content.length !== Number(upload.declaredSizeBytes) || createHash('sha256').update(content).digest('hex') !== upload.declaredSha256) {
      await reject(AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]));
    }
    if (type === 'application/pdf') {
      if (isEncryptedPdf(content)) await reject(AppError.validation([{ field: 'file', code: 'FILE_PASSWORD_PROTECTED' }]));
      if (!pdfLooksReadable(content)) await reject(AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]));
    } else if (!(await imageReadable(content))) {
      await reject(AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]));
    }
    const updated = await this.prisma.upload.update({
      where: { id: upload.id },
      data: { status: 'COMPLETED', completedAt: now, declaredMimeType: type!, updatedAt: now },
    });
    return done(updated);
  }

  // ─── API-081 — the version ───────────────────────────────────────────────

  async createVersion(req: Request, ctx: AuthContext, reference: string, documentId: string, body: unknown): Promise<{ status: number; body: ClientDocument }> {
    const result = await this.idempotency.run<{ input: ReturnType<typeof createVersionSchema.parse> }, { documentId: string; dossierId: string }>(
      req,
      { route: 'client.documents.versions', userId: ctx.userId },
      {
        prepare: async () => {
          const input = parseOrThrow(createVersionSchema, body ?? {});
          // SEC-070 — each call counts as one deposit.
          const wait = this.limiter.hit(`documents.deposits:${ctx.userId}`, DEPOSIT_RATE);
          if (wait) throw AppError.rateLimited(wait);
          return { input };
        },
        execute: async (tx, { input }) => {
          const now = this.clock.now();
          const dossier = await this.dossierOf(tx, ctx, reference);
          const doc = await this.documentOf(tx, dossier.id, documentId);
          // Serialises deposits on one piece (the version number and the SCANNING check).
          await tx.$queryRaw`SELECT id FROM dossier_documents WHERE id = ${doc.id}::uuid FOR UPDATE`;
          const kind = await this.guard(tx, dossier, doc, input.isRenewal);
          if (kind === 'RENEWAL' && input.mode !== 'REPLACE_ALL') throw AppError.validation([{ field: 'mode', code: 'INVALID_CHOICE' }]);

          const currentFiles =
            doc.currentVersion > 0 && kind === 'REPLACEMENT'
              ? await tx.documentFile.findMany({
                  where: { documentId: doc.id, deletedAt: null, version: { number: doc.currentVersion, deletedAt: null, filesPurgedAt: null } },
                  orderBy: { sortOrder: 'asc' },
                })
              : [];
          const uploads = input.uploadIds.length ? await tx.upload.findMany({ where: { id: { in: input.uploadIds } } }) : [];
          for (const id of input.uploadIds) {
            const u = uploads.find((x) => x.id === id);
            if (!u || u.requestedById !== ctx.userId || u.ownerType !== 'DOCUMENT' || u.ownerId !== doc.id || u.resultFileId || u.status === 'REJECTED') throw AppError.notFound();
            if (u.status === 'PENDING') throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
          }
          const plan = planVersion({
            mode: input.mode,
            keptFileIds: input.keptFileIds,
            uploadIds: input.uploadIds,
            currentFileIds: currentFiles.map((f) => f.id),
            uploads: new Map(uploads.map((u) => [u.id, { mimeType: u.declaredMimeType }])),
            keptMime: new Map(currentFiles.map((f) => [f.id, f.mimeType])),
            maxFiles: doc.maxFiles,
          });
          if (!plan.ok) {
            if (plan.error === 'TOO_MANY_IMAGES') throw AppError.conflictState('TOO_MANY_IMAGES', { n: DEPOSIT_MAX_IMAGES });
            if (plan.error === 'TOO_MANY_FILES') throw AppError.conflictState('TOO_MANY_FILES', { n: doc.maxFiles });
            throw AppError.validation([{ field: plan.error === 'MODE_INVALID' ? 'mode' : 'keptFileIds', code: 'INVALID_CHOICE' }]);
          }
          const last = await tx.documentVersion.aggregate({ where: { documentId: doc.id }, _max: { number: true } });
          const number = (last._max.number ?? 0) + 1;
          const versionId = newId();
          await tx.documentVersion.create({
            data: {
              id: versionId,
              documentId: doc.id,
              number,
              uploadedById: ctx.userId,
              uploadedVia: 'WEB',
              uploadedAt: now,
              outcome: 'SCANNING',
              isRenewal: kind === 'RENEWAL',
              createdAt: now,
              updatedAt: now,
            },
          });
          const sources: Record<string, string> = {};
          let order = 0;
          for (const keptId of plan.kept) {
            const f = currentFiles.find((x) => x.id === keptId)!;
            const id = newId();
            sources[id] = f.storageKey;
            await tx.documentFile.create({
              data: {
                id,
                versionId,
                documentId: doc.id,
                sortOrder: ++order,
                storageKey: documentFileKey(dossier.id, doc.id, id),
                fileName: f.fileName,
                mimeType: f.mimeType,
                sizeBytes: f.sizeBytes,
                checksumSha256: f.checksumSha256,
                pageCount: f.pageCount,
                assembledFromImages: f.assembledFromImages,
                scanStatus: 'PENDING',
                createdAt: now,
                updatedAt: now,
              },
            });
          }
          for (const uploadId of plan.uploads) {
            const u = uploads.find((x) => x.id === uploadId)!;
            const id = newId();
            sources[id] = u.storageKey;
            await tx.documentFile.create({
              data: {
                id,
                versionId,
                documentId: doc.id,
                sortOrder: ++order,
                storageKey: documentFileKey(dossier.id, doc.id, id),
                fileName: u.fileName,
                mimeType: u.declaredMimeType,
                sizeBytes: u.declaredSizeBytes,
                checksumSha256: u.declaredSha256,
                scanStatus: 'PENDING',
                createdAt: now,
                updatedAt: now,
              },
            });
            await tx.upload.update({ where: { id: u.id }, data: { resultFileId: id, updatedAt: now } });
          }
          await tx.dossier.update({ where: { id: dossier.id }, data: { lastActivityAt: now } });
          await writeAudit(tx, ctx.actor, now, {
            action: 'document.uploaded',
            entityType: 'dossier_document',
            entityId: doc.id,
            entityLabel: dossier.reference,
            after: { version: number, mode: input.mode, files: order, isRenewal: kind === 'RENEWAL' },
            clientId: dossier.clientId,
          });
          await this.outbox.add(tx, { type: 'document.version_created', aggregateType: 'DossierDocument', aggregateId: doc.id, payload: { versionId, sources } }, now);
          return { documentId: doc.id, dossierId: dossier.id };
        },
        status: 201,
      },
    );
    const dossier = await this.prisma.dossier.findUniqueOrThrow({ where: { id: result.body.dossierId } });
    return { status: result.status, body: await this.documentView(dossier, result.body.documentId) };
  }

  /** One line again (polling while a security check runs). */
  async one(ctx: AuthContext, reference: string, documentId: string): Promise<ClientDocument> {
    const dossier = await this.dossierOf(this.prisma, ctx, reference);
    await this.documentOf(this.prisma, dossier.id, documentId);
    return this.documentView(dossier, documentId);
  }

  // ─── MED-030, DOS-005 — reading a file ───────────────────────────────────

  async fileLink(ctx: AuthContext, reference: string, documentId: string, fileId: string, disposition: Disposition): Promise<SignedFileUrl> {
    const dossier = await this.dossierOf(this.prisma, ctx, reference);
    const doc = await this.documentOf(this.prisma, dossier.id, documentId);
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw AppError.notFound();
    // MOD-351 — the client sees the current version and, if any, the renewal waiting for its check; nothing older.
    const numbers = [doc.currentVersion, doc.renewalVersion].filter((n): n is number => typeof n === 'number' && n > 0);
    const file = await this.prisma.documentFile.findFirst({
      where: { id: fileId, documentId: doc.id, deletedAt: null, scanStatus: 'CLEAN', version: { number: { in: numbers }, deletedAt: null, filesPurgedAt: null } },
      select: { id: true },
    });
    if (!file) throw AppError.notFound();
    const now = this.clock.now();
    const { token, expiresAt } = signPrivateFile(this.env.LINK_SIGNING_KEY, 'doc', file.id, disposition, now);
    await this.prisma.$transaction((tx) =>
      writeAudit(tx, ctx.actor, now, { action: disposition === 'attachment' ? 'document.file_downloaded' : 'document.file_viewed', entityType: 'document_file', entityId: file.id, entityLabel: dossier.reference, after: { disposition }, clientId: dossier.clientId }),
    );
    return { url: privateFilePath(token), expiresAt: expiresAt.toISOString() };
  }

  // ─── DOS-040, DOS-032 — consents ─────────────────────────────────────────

  /** DOS-040 — `Consent` DATA_SHARING_PARTNERS with the exact sentence, source `dossier:documents`. Once is enough. */
  async giveTransmissionConsent(req: Request, ctx: AuthContext, reference: string, body: unknown): Promise<ClientDocumentsView['consent']> {
    parseOrThrow(transmissionConsentSchema, body ?? {});
    const dossier = await this.dossierOf(this.prisma, ctx, reference);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const last = await tx.consent.findFirst({ where: { clientId: dossier.clientId, type: 'DATA_SHARING_PARTNERS' }, orderBy: { givenAt: 'desc' }, select: { granted: true } });
      if (last?.granted) return;
      const id = newId();
      await tx.consent.create({
        data: {
          id,
          type: 'DATA_SHARING_PARTNERS',
          granted: true,
          userId: ctx.userId,
          clientId: dossier.clientId,
          wording: transmissionWording(),
          source: 'dossier:documents',
          givenAt: now,
          ipHash: this.ip.hash(req),
          userAgent: (req.headers['user-agent'] ?? '').slice(0, 400) || null,
          createdAt: now,
        },
      });
      await writeAudit(tx, ctx.actor, now, { action: 'consent.changed', entityType: 'consent', entityId: id, entityLabel: dossier.reference, after: { type: 'DATA_SHARING_PARTNERS', granted: true }, clientId: dossier.clientId });
      await this.outbox.add(tx, { type: 'consent.changed', aggregateType: 'Client', aggregateId: dossier.clientId, payload: { type: 'DATA_SHARING_PARTNERS', granted: true, by: 'CLIENT', dossierId: dossier.id } }, now);
    });
    return (await this.buildView(dossier)).consent;
  }

  /** DOS-032 — « Je confirme avoir l'accord de {prénom} pour transmettre ses documents. », once per person. */
  async authorizeParty(req: Request, ctx: AuthContext, reference: string, partyId: string, body: unknown): Promise<ClientDossierParty> {
    parseOrThrow(partyAuthorizationSchema, body ?? {});
    const dossier = await this.dossierOf(this.prisma, ctx, reference);
    if (!/^[0-9a-f-]{36}$/i.test(partyId)) throw AppError.notFound();
    const party = await this.prisma.dossierParty.findFirst({ where: { id: partyId, dossierId: dossier.id, removedAt: null } });
    if (!party || party.role === 'PRIMARY') throw AppError.notFound();
    if (party.restrictedAt) throw AppError.conflictState('PARTY_RESTRICTED', { prenom: party.firstName ?? '' });
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const last = await tx.consent.findFirst({ where: { partyId, type: 'PARTY_AUTHORIZATION' }, orderBy: { givenAt: 'desc' }, select: { granted: true } });
      if (last?.granted) return;
      const id = newId();
      await tx.consent.create({
        data: {
          id,
          type: 'PARTY_AUTHORIZATION',
          granted: true,
          userId: ctx.userId,
          clientId: dossier.clientId,
          partyId,
          wording: t('ui.documents.party.authorization', { prenom: party.firstName ?? '' }),
          source: 'dossier:documents',
          givenAt: now,
          ipHash: this.ip.hash(req),
          userAgent: (req.headers['user-agent'] ?? '').slice(0, 400) || null,
          createdAt: now,
        },
      });
      await writeAudit(tx, ctx.actor, now, { action: 'consent.changed', entityType: 'consent', entityId: id, entityLabel: dossier.reference, after: { type: 'PARTY_AUTHORIZATION', granted: true }, clientId: dossier.clientId });
    });
    const view = await this.buildView(dossier);
    return view.parties.find((p) => p.id === partyId)!;
  }
}

/** Browsers announce a few aliases. */
export function normaliseMime(raw: string): string {
  const m = raw.trim().toLowerCase().split(';')[0]!;
  if (m === 'image/jpg' || m === 'image/pjpeg') return 'image/jpeg';
  if (m === 'image/heif' || m === 'image/heic-sequence' || m === 'image/heif-sequence') return 'image/heic';
  return m;
}
