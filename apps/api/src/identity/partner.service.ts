// 00-cadre/06 ACP-080…ACP-087, D-091 — the partners' own door: sign-up in two short steps without any document (an
// account of kind PARTNER and an application, a request PARTNER_REQUEST), the address confirmed like a client's
// (AUTH-013, back on /partenaires/connexion), then the application file completed from the partner space (EP-33): three
// sections saved one by one, files announced, sent and confirmed (API-080), « Envoyer mon dossier pour examen ».
import { createHash, createHmac } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  bankActivitySchema,
  CURRENT_CONTACT_CONSENT_KEY,
  AuthConsentWording,
  ErrorCode,
  LEAD_HONEYPOT_FIELD,
  LeadConsentWording,
  PARTNER_FILE_RULES,
  partnerImageSchema,
  partnerSignupRequestSchema,
  partnerUploadRequestSchema,
  promoterActivitySchema,
  type PartnerApplicationResponse,
  type PartnerFileSlot,
  type PartnerUploadResponse,
  type SentResponse,
} from '@dp/contracts';
import type { Request, Response } from 'express';
import { writeAudit } from '../admin/audit.js';
import { ENV, type Env } from '../config/env.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../files/object-storage.js';
import { VIRUS_SCANNER, type VirusScanner } from '../files/virus-scanner.js';
import { BusinessCalendarService, nextReference } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { OutboxHandlers, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp } from '../platform/rate-limit.js';
import { log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { addBusinessDays } from '@dp/domain';
import { AuthMailRequester } from './auth-mail.js';
import { LINK_PATHS } from './auth.service.js';
import { sha256Hex } from './crypto.js';
import { audienceOf } from './http.js';
import { MailLimits } from './mail-limits.js';
import { hashPassword, passwordProblem } from './password.js';
import type { AuthContext } from './sessions.service.js';
import { SignupService } from './signup.service.js';

/** API-080 — an announced upload must be sent within 15 minutes. */
const UPLOAD_TTL_MS = 15 * 60_000;

interface ApplicationJson {
  companyName: string;
  country: string;
  city: string;
  jobTitle: string;
  activity?: Record<string, unknown> | null;
  image?: { presentation?: string; message?: string } | null;
  /** Written by the team (ACP-084): the complement asked, word for word; the sentence for the person at a refusal. */
  infoRequestNote?: string | null;
  declineNote?: string | null;
  additions?: { at: string; message: string }[];
}

const SECTION_OF: Record<PartnerFileSlot, 'documents' | 'image'> = { REGISTRATION: 'documents', PRESENTATION: 'documents', LOGO: 'image' };

/** MED-011 — the type observed from the content, never the declared one. */
export function sniffType(buf: Buffer): string | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

@Injectable()
export class PartnerService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly idempotency: IdempotencyService,
    private readonly ip: ClientIp,
    private readonly limits: MailLimits,
    private readonly mail: AuthMailRequester,
    private readonly signups: SignupService,
    private readonly handlers: OutboxHandlers,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    // R_PARTNER_APPLICATION_SUBMITTED is a rule of the automation engine now (automation/rule-seeds.ts): the notification
    // of OWNERS and ADMINS and the task `partner-app:{leadId}` leave from there, with the key the stand-in used (AUT-084).
  }

  // ─── Sign-up (ACP-080…ACP-082) ────────────────────────────────────────────

  async signup(req: Request, res: Response, body: unknown): Promise<{ status: number; body: SentResponse }> {
    if (audienceOf(req, this.env) !== 'PARTNER') throw new AppError(ErrorCode.BAD_REQUEST);
    const cookie = this.signups.signupCookie(req, res);
    const signupKeyHash = sha256Hex(cookie);
    const result = await this.idempotency.run(req, { route: 'auth.partner-signup' }, {
      status: 202,
      prepare: async () => {
        this.signups.checkFormToken(req, 'PARTNER_SIGNUP');
        const input = parseOrThrow(partnerSignupRequestSchema, body);
        this.signups.checkSignupRate(req);
        const country = await this.prisma.country.findUnique({ where: { code: input.country }, select: { code: true } });
        if (!country) throw AppError.validation([{ field: 'country', code: 'INVALID_CHOICE' }]);
        const problem = passwordProblem(input.password, { minLength: await this.settings.get('security.password.minLength'), email: input.email, firstName: input.firstName, lastName: input.lastName });
        if (problem) throw AppError.validation([problem]);
        const honeypot = typeof input[LEAD_HONEYPOT_FIELD] === 'string' && input[LEAD_HONEYPOT_FIELD]!.trim() !== '';
        return { input, honeypot, passwordHash: await hashPassword(input.password), cal: await this.calendar.load() };
      },
      execute: async (tx, p) => {
        if (p.honeypot) return { status: 'SENT' as const };
        await this.applySignup(tx, req, p.input, p.passwordHash, signupKeyHash, p.cal.timeZone);
        return { status: 'SENT' as const };
      },
    });
    if (!result.replayed) this.signups.recordSignup(req);
    this.mail.wake();
    return { status: result.status, body: result.body };
  }

  private async applySignup(tx: Tx, req: Request, input: ReturnType<typeof partnerSignupRequestSchema.parse>, passwordHash: string, signupKeyHash: string, timeZone: string): Promise<void> {
    const now = this.clock.now();
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `lead:${input.email}`);
    const existing = await tx.user.findUnique({ where: { email: input.email }, select: { id: true, status: true } });
    if (existing && existing.status !== 'DELETED') {
      // ACP-080 — one address, one account: the e-mail to that address explains, the screen does not change.
      if (this.limits.tryTake(req, 'signup', input.email)) {
        await this.mail.request(tx, { template: 'P_PARTNER_EMAIL_VERIFICATION', userId: null, to: input.email, vars: { action: { addressInUse: true } } });
      }
      return;
    }
    const userId = newId();
    await tx.user.create({
      data: {
        id: userId,
        kind: 'PARTNER',
        email: input.email,
        passwordHash,
        passwordChangedAt: now,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        jobTitle: input.jobTitle,
        locale: input.locale,
        timezone: input.timezone ?? 'Europe/Paris',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    });
    const leadId = newId();
    const ipHash = this.ip.fingerprint(req);
    const userAgent = (req.headers['user-agent'] ?? '').slice(0, 400) || null;
    const { password: _pw, [LEAD_HONEYPOT_FIELD]: _hp, ...fields } = input;
    const application: ApplicationJson = { companyName: input.companyName, country: input.country, city: input.city, jobTitle: input.jobTitle, activity: null, image: null };
    await tx.lead.create({
      data: {
        id: leadId,
        reference: await nextReference(tx, 'LEAD', now, timeZone),
        kind: 'PARTNER_REQUEST',
        source: 'WEB_FORM',
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        applicantUserId: userId,
        partnerKind: input.partnerKind,
        applicationStatus: 'EMAIL_UNVERIFIED',
        application: application as never,
        payload: { form: 'PARTNER_SIGNUP', formVersion: 1, fields, context: null } as never,
        locale: input.locale,
        ipHash,
        userAgent,
        spamScore: 0,
        spamSignals: [] as never,
        status: 'NEW',
        createdAt: now,
        updatedAt: now,
      },
    });
    const charter = await tx.legalDocument.findFirst({
      where: { type: 'PARTNER_CHARTER', locale: 'fr', publishedAt: { not: null, lte: now }, effectiveAt: { lte: now } },
      orderBy: { effectiveAt: 'desc' },
      select: { version: true },
    });
    const privacy = await tx.legalDocument.findFirst({
      where: { type: 'PRIVACY_POLICY', locale: 'fr', publishedAt: { not: null, lte: now }, effectiveAt: { lte: now } },
      orderBy: { effectiveAt: 'desc' },
      select: { version: true },
    });
    const base = { granted: true, userId, leadId, source: 'partner-signup', givenAt: now, ipHash, userAgent, createdAt: now };
    await tx.consent.create({ data: { id: newId(), type: 'PARTNER_CHARTER', documentVersion: charter?.version ?? null, wording: AuthConsentWording['partner.charter.v1'], ...base } });
    await tx.consent.create({ data: { id: newId(), type: 'CONTACT_REQUEST', documentVersion: privacy?.version ?? null, wording: LeadConsentWording[CURRENT_CONTACT_CONSENT_KEY].text, ...base } });
    await writeAudit(tx, { type: 'ANONYMOUS', userId: null, role: null, reason: null }, now, { action: 'lead.created', entityType: 'Lead', entityId: leadId, after: { kind: 'PARTNER_REQUEST', form: 'PARTNER_SIGNUP' } });
    await this.mail.request(tx, {
      template: 'P_PARTNER_EMAIL_VERIFICATION',
      userId,
      leadId,
      to: input.email,
      link: { purpose: 'EMAIL_VERIFICATION', host: 'web', path: LINK_PATHS.verifyPartner, payload: { signupKeyHash, next: null } },
      vars: { action: { addressInUse: false } },
    });
  }

  // ─── The application (ACP-083, ACP-087) ───────────────────────────────────

  private async lead(ctx: AuthContext) {
    const lead = await this.prisma.lead.findFirst({
      where: { applicantUserId: ctx.userId, kind: 'PARTNER_REQUEST' },
      orderBy: { createdAt: 'desc' },
      include: { leadFiles: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
    });
    if (!lead) throw AppError.notFound();
    return lead;
  }

  private editable(status: string | null): boolean {
    return status === 'DRAFT' || status === 'INFO_REQUESTED';
  }

  async application(ctx: AuthContext): Promise<PartnerApplicationResponse> {
    const lead = await this.lead(ctx);
    const app = (lead.application ?? {}) as unknown as ApplicationJson;
    const files = lead.leadFiles.map((f) => ({ id: f.id, slot: f.label as PartnerFileSlot, fileName: f.fileName, sizeBytes: f.sizeBytes, scanStatus: f.scanStatus }));
    const activityDone = Boolean(app.activity);
    const documentsDone = files.some((f) => f.slot === 'REGISTRATION' && f.scanStatus !== 'INFECTED');
    const imageDone = Boolean(app.image?.presentation || app.image?.message || files.some((f) => f.slot === 'LOGO'));
    const status = (lead.applicationStatus ?? 'DRAFT') as PartnerApplicationResponse['status'];
    return {
      partnerKind: (lead.partnerKind ?? 'PROMOTER') as PartnerApplicationResponse['partnerKind'],
      status,
      firstName: lead.firstName,
      companyName: app.companyName ?? '',
      sections: {
        activity: { complete: activityDone, values: app.activity ?? null },
        documents: { complete: documentsDone, files: files.filter((f) => SECTION_OF[f.slot] === 'documents' || f.slot === 'LOGO') },
        image: { complete: imageDone, values: app.image ?? null },
      },
      requiredDone: Number(activityDone) + Number(documentsDone),
      canSubmit: status === 'DRAFT' && activityDone && documentsDone,
      submittedAt: lead.applicationSubmittedAt?.toISOString() ?? null,
      teamMessage: status === 'INFO_REQUESTED' ? (app.infoRequestNote ?? null) : status === 'DECLINED' ? (app.declineNote ?? null) : null,
      reviewDays: await this.settings.get('partner.applicationReviewDays'),
    };
  }

  async regions(): Promise<{ data: { id: string; name: string }[] }> {
    const rows = await this.prisma.region.findMany({
      where: { isActive: true, country: { isCatalogueActive: true } },
      orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }],
      select: { id: true, nameFr: true },
    });
    return { data: rows.map((r) => ({ id: r.id, name: r.nameFr })) };
  }

  /** `PATCH /partner/application/sections/{activity|image}` — « Enregistré. » */
  async saveSection(ctx: AuthContext, section: string, body: unknown): Promise<PartnerApplicationResponse> {
    const lead = await this.lead(ctx);
    if (!this.editable(lead.applicationStatus)) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const app = { ...((lead.application ?? {}) as unknown as ApplicationJson) };
    if (section === 'activity') {
      if (lead.partnerKind === 'BANK') {
        const v = parseOrThrow(bankActivitySchema, body);
        if (v.financingTypes.includes('ISLAMIC') && !(await this.settings.get('features.islamicFinance'))) throw AppError.validation([{ field: 'financingTypes', code: 'INVALID_CHOICE' }]);
        app.activity = v;
      } else {
        const v = parseOrThrow(promoterActivitySchema, body);
        const found = await this.prisma.region.count({ where: { id: { in: v.regionIds } } });
        if (found !== new Set(v.regionIds).size) throw AppError.validation([{ field: 'regionIds', code: 'INVALID_CHOICE' }]);
        app.activity = v;
      }
    } else if (section === 'image') {
      app.image = parseOrThrow(partnerImageSchema, body);
    } else {
      throw AppError.notFound();
    }
    const now = this.clock.now();
    await this.prisma.lead.update({ where: { id: lead.id }, data: { application: app as never, updatedAt: now } });
    return this.application(ctx);
  }

  /** API-080 step 1 — announce one file: rights and limits checked (413, 415), a signed address valid 15 minutes. */
  async announceUpload(ctx: AuthContext, body: unknown): Promise<PartnerUploadResponse> {
    const lead = await this.lead(ctx);
    if (!this.editable(lead.applicationStatus)) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const input = parseOrThrow(partnerUploadRequestSchema, body);
    const rule = PARTNER_FILE_RULES[input.slot];
    if (input.size > rule.maxMb * 1024 * 1024) throw new AppError(ErrorCode.FILE_TOO_LARGE, { params: { maxMb: rule.maxMb, n: rule.maxMb } });
    if (!rule.types.includes(input.contentType)) throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: rule.types } });
    const now = this.clock.now();
    const id = newId();
    const expiresAt = new Date(now.getTime() + UPLOAD_TTL_MS);
    await this.prisma.upload.create({
      data: {
        id,
        ownerType: 'PARTNER_DOCUMENT',
        ownerId: lead.id,
        requestedById: ctx.userId,
        fileName: input.fileName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 200),
        declaredMimeType: input.contentType,
        declaredSizeBytes: BigInt(input.size),
        declaredSha256: input.sha256,
        storageKey: `uploads/${id}`,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      },
    });
    const sig = this.uploadSignature(id, expiresAt.getTime());
    return { id, uploadUrl: `/api/v1/partner/application/uploads/${id}/content?e=${expiresAt.getTime()}&s=${sig}`, expiresAt: expiresAt.toISOString() };
  }

  private uploadSignature(id: string, exp: number): string {
    return createHmac('sha256', this.env.LINK_SIGNING_KEY).update(`dp_upload:${id}:${exp}`).digest('base64url');
  }

  /** API-080 step 2 — local stand-in for the direct send to the storage (MED-016): the bytes under `uploads/{id}`. */
  async receiveContent(ctx: AuthContext, id: string, query: { e?: string; s?: string }, body: unknown): Promise<void> {
    const exp = Number(query.e);
    if (!query.s || !Number.isFinite(exp) || exp < this.clock.now().getTime() || query.s !== this.uploadSignature(id, exp)) throw new AppError(ErrorCode.GONE);
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.requestedById !== ctx.userId) throw AppError.notFound();
    if (upload.status !== 'PENDING') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (!Buffer.isBuffer(body) || body.length === 0) throw AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]);
    if (body.length > Number(upload.declaredSizeBytes)) throw AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]);
    await this.storage.put('private', upload.storageKey, body, upload.declaredMimeType);
  }

  /** API-080 step 3 — the file read back, its real type, size and fingerprint checked, scanned, then attached. */
  async completeUpload(ctx: AuthContext, id: string, body: unknown): Promise<PartnerApplicationResponse> {
    const lead = await this.lead(ctx);
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.requestedById !== ctx.userId || upload.ownerId !== lead.id) throw AppError.notFound();
    if (upload.status === 'COMPLETED') return this.application(ctx); // same answer, nothing redone
    if (upload.status === 'REJECTED') throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
    const slot = (body as { slot?: string } | null)?.slot as PartnerFileSlot | undefined;
    if (!slot || !(slot in PARTNER_FILE_RULES)) throw AppError.validation([{ field: 'slot', code: 'INVALID_CHOICE' }]);
    const now = this.clock.now();
    const content = await this.storage.get('private', upload.storageKey);
    if (!content) {
      if (upload.expiresAt.getTime() < now.getTime()) throw new AppError(ErrorCode.GONE);
      throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
    }
    const reject = async (err: AppError) => {
      await this.prisma.upload.update({ where: { id }, data: { status: 'REJECTED', updatedAt: now } });
      await this.storage.delete('private', upload.storageKey).catch(() => undefined);
      throw err;
    };
    const rule = PARTNER_FILE_RULES[slot];
    const type = sniffType(content);
    if (!type || !rule.types.includes(type)) await reject(new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: rule.types } }));
    if (content.length !== Number(upload.declaredSizeBytes) || createHash('sha256').update(content).digest('hex') !== upload.declaredSha256) {
      await reject(AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]));
    }
    if (type === 'application/pdf' && /\/Encrypt\b/.test(content.subarray(0, Math.min(content.length, 2_000_000)).toString('latin1'))) {
      await reject(AppError.validation([{ field: 'file', code: 'FILE_PASSWORD_PROTECTED' }]));
    }
    const scan = await this.scanner.scan(content);
    const fileId = newId();
    const key = `leads/${lead.id}/${fileId}`;
    await this.storage.put('private', key, content, type!);
    await this.storage.delete('private', upload.storageKey).catch(() => undefined);
    await this.prisma.$transaction(async (tx) => {
      // One file per slot: a new one replaces the previous (kept in the trash).
      await tx.leadFile.updateMany({ where: { leadId: lead.id, label: slot, deletedAt: null }, data: { deletedAt: now, updatedAt: now } });
      await tx.leadFile.create({
        data: {
          id: fileId,
          leadId: lead.id,
          section: SECTION_OF[slot],
          label: slot,
          storageKey: key,
          fileName: upload.fileName,
          mimeType: type!,
          sizeBytes: content.length,
          checksumSha256: upload.declaredSha256,
          scanStatus: scan === 'CLEAN' ? 'CLEAN' : scan === 'INFECTED' ? 'INFECTED' : 'PENDING',
          uploadedById: ctx.userId,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.upload.update({ where: { id }, data: { status: 'COMPLETED', completedAt: now, resultFileId: fileId, updatedAt: now } });
    });
    if (scan === 'INFECTED') log('warn', 'partner.file_infected', { leadId: lead.id });
    return this.application(ctx);
  }

  async deleteFile(ctx: AuthContext, fileId: string): Promise<PartnerApplicationResponse> {
    const lead = await this.lead(ctx);
    if (!this.editable(lead.applicationStatus)) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const done = await this.prisma.leadFile.updateMany({ where: { id: fileId, leadId: lead.id, deletedAt: null }, data: { deletedAt: this.clock.now() } });
    if (done.count === 0) throw AppError.notFound();
    return this.application(ctx);
  }

  /** « Envoyer mon dossier pour examen » — 409 APPLICATION_INCOMPLETE when a required section is missing. */
  async submit(ctx: AuthContext): Promise<PartnerApplicationResponse> {
    const state = await this.application(ctx);
    const lead = await this.lead(ctx);
    if (lead.applicationStatus !== 'DRAFT') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (!state.canSubmit) throw AppError.conflictState('APPLICATION_INCOMPLETE');
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.lead.updateMany({ where: { id: lead.id, applicationStatus: 'DRAFT' }, data: { applicationStatus: 'SUBMITTED', applicationSubmittedAt: now, updatedAt: now } });
      if (moved.count !== 1) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      await tx.outboxEvent.create({
        data: {
          id: newId(),
          type: 'lead.application_submitted',
          aggregateType: 'Lead',
          aggregateId: lead.id,
          payload: { partnerKind: lead.partnerKind, companyName: state.companyName } as never,
          occurredAt: now,
          availableAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    });
    this.mail.wake();
    return this.application(ctx);
  }

  /** ACP-083 « Complément demandé » — a message (and files already attached); back to « En cours d'examen ». */
  async addition(ctx: AuthContext, body: unknown): Promise<PartnerApplicationResponse> {
    const lead = await this.lead(ctx);
    if (lead.applicationStatus !== 'INFO_REQUESTED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const message = parseOrThrow(partnerImageSchema.pick({ message: true }), body).message ?? '';
    const now = this.clock.now();
    const app = { ...((lead.application ?? {}) as unknown as ApplicationJson) };
    app.additions = [...(app.additions ?? []), { at: now.toISOString(), message }];
    await this.prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: lead.id }, data: { application: app as never, applicationStatus: 'SUBMITTED', updatedAt: now } });
      await tx.outboxEvent.create({
        data: { id: newId(), type: 'lead.application_submitted', aggregateType: 'Lead', aggregateId: lead.id, payload: { partnerKind: lead.partnerKind, companyName: app.companyName, addition: true } as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now },
      });
    });
    return this.application(ctx);
  }
}
