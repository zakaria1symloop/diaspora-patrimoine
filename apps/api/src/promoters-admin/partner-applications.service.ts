// ACP-084 — the review of a partner application by the team, on its request (`PARTNER_REQUEST` with an application):
//   · the panel « Candidature partenaire »: company, person, state of the address and of the dossier (sections, files
//     opened through a signed address), the records it could be attached to (« Rattacher à {nom} »);
//   · « Accepter »: creates the promoter or the bank (PROSPECT) and its organisation (MOD-103) per the table of ACP-087,
//     or attaches the person to an existing record; the person becomes a contact (primary on a created record) with her
//     account, and member ADMIN of the organisation; the author becomes the account manager; files carried over as
//     PartnerDocument, the logo as the owner's LOGO media; the request is closed; `lead.application_approved`,
//     P_PARTNER_APPLICATION_APPROVED;
//   · « Demander un complément »: INFO_REQUESTED, the message word for word, `lead.application_info_requested`,
//     P_PARTNER_INFO_REQUESTED;
//   · « Refuser »: DECLINED, an internal reason and an optional sentence for the person, the request is closed,
//     `lead.application_declined`, P_PARTNER_APPLICATION_DECLINED.
// The three actions need `lead.process` AND `promoter.write` (promoter) or `bank.write` (bank).
import { Inject, Injectable } from '@nestjs/common';
import { approvePartnerSchema, declinePartnerSchema, ErrorCode, requestPartnerInfoSchema, type PartnerApplicationPanel } from '@dp/contracts';
import { ENV, type Env } from '../config/env.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { AuthMailRequester } from '../identity/auth-mail.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { slugify } from '../platform/slug.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { StaffViews } from '../back-office/staff-view.js';
import { domainEvent } from '../automation/event-catalogue.js';
import { CatalogueMediaService } from '../catalogue-admin/catalogue-media.service.js';
import { uniqueSlug } from '../catalogue-admin/catalogue-texts.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../files/object-storage.js';
import { PrivateFileResolvers, privateFilePath, signPrivateFile } from '../files/private-files.js';

interface ApplicationJson {
  companyName: string;
  country: string;
  city: string;
  jobTitle: string;
  activity?: Record<string, unknown> | null;
  image?: { presentation?: string; message?: string } | null;
  infoRequestNote?: string | null;
  declineNote?: string | null;
  decision?: { by: string; at: string; reason?: string | null; result?: { type: 'PROMOTER' | 'BANK'; id: string } } | null;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

@Injectable()
export class PartnerApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly views: StaffViews,
    private readonly mail: AuthMailRequester,
    private readonly media: CatalogueMediaService,
    private readonly notifier: ChangeNotifier,
    private readonly resolvers: PrivateFileResolvers,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(ENV) private readonly env: Env,
  ) {
    // MED-030 — a supporting file of an application opens through a signed address; only a CLEAN file is served.
    this.resolvers.register('leadfile', async (fid) => this.prisma.leadFile.findFirst({ where: { id: fid, deletedAt: null, scanStatus: 'CLEAN' }, select: { storageKey: true, fileName: true, mimeType: true } }));
  }

  private async lead(id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, applicationStatus: { not: null } },
      include: { leadFiles: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } }, applicantUser: { select: { id: true, email: true, emailVerifiedAt: true, firstName: true, lastName: true, phone: true } } },
    });
    if (!lead) throw AppError.notFound();
    return lead;
  }

  private async mayDecide(auth: AuthContext, kind: string): Promise<boolean> {
    const staff = await this.views.of(auth);
    return staff.has('lead.process') && staff.has(kind === 'BANK' ? 'bank.write' : 'promoter.write');
  }

  /** `GET /admin/leads/{id}/partner-application` (`lead.read`). */
  async panel(auth: AuthContext, id: string): Promise<PartnerApplicationPanel> {
    const lead = await this.lead(id);
    const app = (lead.application ?? {}) as unknown as ApplicationJson;
    const kind = (lead.partnerKind ?? 'PROMOTER') as 'PROMOTER' | 'BANK';
    const activity = (app.activity ?? {}) as Record<string, unknown>;
    const regNo = typeof activity.registrationNumber === 'string' ? activity.registrationNumber : typeof activity.licenseNumber === 'string' ? activity.licenseNumber : null;
    const files = lead.leadFiles;
    const country = app.country ? await this.prisma.country.findUnique({ where: { code: app.country }, select: { nameFr: true } }) : null;
    // « Rattacher à {nom} » — same name (folded) or same registration number.
    const name = fold(app.companyName ?? '');
    let matches: PartnerApplicationPanel['matches'] = [];
    if (kind === 'PROMOTER') {
      const all = await this.prisma.promoter.findMany({ where: { deletedAt: null }, select: { id: true, legalName: true, brandName: true, status: true, registrationNumber: true } });
      matches = all.filter((p) => (name && (fold(p.legalName) === name || fold(p.brandName ?? '') === name)) || (regNo && p.registrationNumber && fold(p.registrationNumber) === fold(regNo))).map((p) => ({ id: p.id, name: p.brandName ?? p.legalName, status: p.status }));
    } else {
      const all = await this.prisma.bank.findMany({ where: { deletedAt: null }, select: { id: true, name: true, shortName: true, status: true } });
      matches = all.filter((b) => name && (fold(b.name) === name || fold(b.shortName ?? '') === name)).map((b) => ({ id: b.id, name: b.name, status: b.status }));
    }
    const answers: PartnerApplicationPanel['answers'] = [];
    const push = (label: string, v: unknown) => {
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return;
      answers.push({ label, value: Array.isArray(v) ? v.join(', ') : String(v) });
    };
    if (kind === 'PROMOTER') {
      push('ongoingPrograms', activity.ongoingPrograms);
      const regionIds = Array.isArray(activity.regionIds) ? (activity.regionIds as string[]) : [];
      if (regionIds.length) push('regions', (await this.prisma.region.findMany({ where: { id: { in: regionIds } }, select: { nameFr: true } })).map((r) => r.nameFr));
    } else {
      push('financingTypes', activity.financingTypes);
      push('clientCountries', activity.clientCountries);
      push('agency', activity.agency);
    }
    push('presentation', app.image?.presentation);
    push('message', app.image?.message);
    const decision = app.decision?.result ?? null;
    let result: PartnerApplicationPanel['result'] = null;
    if (decision) {
      const rec = decision.type === 'PROMOTER' ? await this.prisma.promoter.findUnique({ where: { id: decision.id }, select: { legalName: true, brandName: true } }) : await this.prisma.bank.findUnique({ where: { id: decision.id }, select: { name: true } });
      if (rec) result = { type: decision.type, id: decision.id, name: 'name' in rec ? rec.name : (rec.brandName ?? rec.legalName) };
    }
    return {
      leadId: lead.id,
      kind,
      status: lead.applicationStatus!,
      emailVerified: Boolean(lead.applicantUser?.emailVerifiedAt),
      company: { name: app.companyName ?? '', country: country?.nameFr ?? app.country ?? null, city: app.city ?? null, website: typeof activity.website === 'string' ? activity.website : null, registrationNumber: regNo, foundedYear: typeof activity.foundedYear === 'number' ? activity.foundedYear : null },
      person: { firstName: lead.firstName, lastName: lead.lastName, role: app.jobTitle ?? null, email: lead.email, phone: lead.phone },
      sections: [
        { key: 'activity', done: Boolean(app.activity) },
        { key: 'documents', done: files.some((f) => f.label === 'REGISTRATION' && f.scanStatus !== 'INFECTED') },
        { key: 'image', done: Boolean(app.image?.presentation || app.image?.message || files.some((f) => f.label === 'LOGO')) },
      ],
      answers,
      files: files.map((f) => ({ id: f.id, label: f.label, fileName: f.fileName, sizeBytes: f.sizeBytes, scanStatus: f.scanStatus })),
      matches,
      result,
      can: { decide: (lead.applicationStatus === 'SUBMITTED' || lead.applicationStatus === 'INFO_REQUESTED') && (await this.mayDecide(auth, kind)) },
    };
  }

  /** MED-030 — a supporting file of the application, through a signed address of 5 minutes (traced). */
  async openFile(actor: Actor, leadId: string, fileId: string): Promise<{ url: string; expiresAt: string }> {
    const f = await this.prisma.leadFile.findFirst({ where: { id: fileId, leadId, deletedAt: null } });
    if (!f) throw AppError.notFound();
    if (f.scanStatus !== 'CLEAN') throw AppError.conflictState('DOCUMENT_SCANNING');
    const now = this.clock.now();
    const { token, expiresAt } = signPrivateFile(this.env.LINK_SIGNING_KEY, 'leadfile', f.id, 'inline', now);
    const lead = await this.prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { reference: true } });
    await this.prisma.$transaction((tx) => writeAudit(tx, actor, now, { action: 'lead.file_viewed', entityType: 'lead', entityId: leadId, entityLabel: lead.reference, after: { fileId } }));
    return { url: privateFilePath(token), expiresAt: expiresAt.toISOString() };
  }

  private async decide(auth: AuthContext, id: string): Promise<Awaited<ReturnType<PartnerApplicationsService['lead']>>> {
    const lead = await this.lead(id);
    if (!(await this.mayDecide(auth, lead.partnerKind ?? 'PROMOTER'))) throw new AppError(ErrorCode.FORBIDDEN);
    if (lead.applicationStatus !== 'SUBMITTED' && lead.applicationStatus !== 'INFO_REQUESTED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    return lead;
  }

  private async organization(tx: Tx, type: 'PROMOTER' | 'BANK', name: string, slug: string, actor: Actor, now: Date): Promise<string> {
    const orgSlug = await uniqueSlug(slug, 80, async (s) => Boolean(await tx.organization.findUnique({ where: { slug: s } })));
    const orgId = newId();
    await tx.organization.create({ data: { id: orgId, type, name: name.slice(0, 160), slug: orgSlug, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
    await writeAudit(tx, actor, now, { action: 'organization.created', entityType: 'organization', entityId: orgId, entityLabel: name, after: { type, slug: orgSlug, fromApplication: true } });
    return orgId;
  }

  /** `POST /admin/leads/{id}/approve-partner` — ACP-084 « Accepter » (create, or « Rattacher à {nom} »). */
  async approve(auth: AuthContext, actor: Actor, id: string, body: unknown): Promise<PartnerApplicationPanel> {
    const input = parseOrThrow(approvePartnerSchema, body ?? {});
    const lead = await this.decide(auth, id);
    const app = (lead.application ?? {}) as unknown as ApplicationJson;
    const kind = (lead.partnerKind ?? 'PROMOTER') as 'PROMOTER' | 'BANK';
    const activity = (app.activity ?? {}) as Record<string, unknown>;
    const now = this.clock.now();
    const copies: { from: string; to: string; mime: string }[] = [];
    let logo: { storageKey: string; fileName: string } | null = null;
    const result = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.lead.updateMany({ where: { id, applicationStatus: { in: ['SUBMITTED', 'INFO_REQUESTED'] } }, data: { applicationStatus: 'APPROVED', updatedAt: now } });
      if (moved.count !== 1) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      const country = (await tx.country.findUnique({ where: { code: app.country } })) ? app.country : 'DZ';
      const city = app.city ? await tx.city.findFirst({ where: { nameFr: { equals: app.city, mode: 'insensitive' }, region: { countryCode: country } }, select: { id: true, regionId: true } }) : null;
      let recordId: string;
      let orgId: string;
      let created = false;
      if (kind === 'PROMOTER') {
        if (input.attachToId) {
          const p = await tx.promoter.findFirst({ where: { id: input.attachToId, deletedAt: null } });
          if (!p) throw AppError.validation([{ field: 'attachToId', code: 'INVALID_CHOICE' }]);
          recordId = p.id;
          orgId = p.organizationId;
        } else {
          const slug = await uniqueSlug(slugify(app.companyName), 80, async (s) => Boolean(await tx.promoter.findFirst({ where: { slug: s, deletedAt: null } })));
          orgId = await this.organization(tx, 'PROMOTER', app.companyName, slug, actor, now);
          recordId = newId();
          created = true;
          await tx.promoter.create({
            data: {
              id: recordId,
              organizationId: orgId,
              legalName: app.companyName.slice(0, 160),
              slug,
              countryCode: country,
              addressLine: app.city || null,
              cityId: city?.id ?? null,
              regionId: city?.regionId ?? null,
              website: typeof activity.website === 'string' ? activity.website : null,
              registrationNumber: typeof activity.registrationNumber === 'string' ? activity.registrationNumber : null,
              foundedYear: typeof activity.foundedYear === 'number' ? activity.foundedYear : null,
              descriptionPublic: app.image?.presentation || null,
              status: 'PROSPECT',
              statusChangedAt: now,
              accountManagerId: actor.userId,
              createdById: stampBy(actor),
              updatedById: stampBy(actor),
              createdAt: now,
              updatedAt: now,
            },
          });
          await writeAudit(tx, actor, now, { action: 'promoter.created', entityType: 'promoter', entityId: recordId, entityLabel: app.companyName, after: { legalName: app.companyName, status: 'PROSPECT', fromApplication: lead.reference } });
        }
        if (!created) await tx.promoter.update({ where: { id: recordId }, data: { accountManagerId: actor.userId, updatedAt: now } });
        const contactId = newId();
        await tx.promoterContact.create({ data: { id: contactId, promoterId: recordId, fullName: [lead.firstName, lead.lastName].filter(Boolean).join(' ').slice(0, 120) || app.companyName, role: app.jobTitle || null, email: lead.email, phone: lead.phone, isPrimary: created, userId: lead.applicantUserId, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
        await writeAudit(tx, actor, now, { action: 'promoter_contact.created', entityType: 'promoter_contact', entityId: contactId, entityLabel: app.jobTitle || 'contact', after: { promoterId: recordId, isPrimary: created, fromApplication: true } });
      } else {
        if (input.attachToId) {
          const b = await tx.bank.findFirst({ where: { id: input.attachToId, deletedAt: null } });
          if (!b) throw AppError.validation([{ field: 'attachToId', code: 'INVALID_CHOICE' }]);
          recordId = b.id;
          orgId = b.organizationId;
          await tx.bank.update({ where: { id: b.id }, data: { accountManagerId: actor.userId, updatedAt: now } });
        } else {
          const slug = await uniqueSlug(slugify(app.companyName), 80, async (s) => Boolean(await tx.bank.findFirst({ where: { slug: s, deletedAt: null } })));
          orgId = await this.organization(tx, 'BANK', app.companyName, slug, actor, now);
          recordId = newId();
          created = true;
          const last = await tx.bank.aggregate({ _max: { sortOrder: true } });
          await tx.bank.create({
            data: {
              id: recordId,
              organizationId: orgId,
              name: app.companyName.slice(0, 160),
              slug,
              countryCode: country,
              offersIslamicFinance: Array.isArray(activity.financingTypes) && (activity.financingTypes as string[]).includes('ISLAMIC'),
              descriptionPublic: app.image?.presentation || null,
              status: 'PROSPECT',
              statusChangedAt: now,
              accountManagerId: actor.userId,
              sortOrder: (last._max.sortOrder ?? 0) + 10,
              createdById: stampBy(actor),
              updatedById: stampBy(actor),
              createdAt: now,
              updatedAt: now,
            },
          });
          await writeAudit(tx, actor, now, { action: 'bank.created', entityType: 'bank', entityId: recordId, entityLabel: app.companyName, after: { name: app.companyName, status: 'PROSPECT', fromApplication: lead.reference } });
        }
        const contactId = newId();
        await tx.bankContact.create({ data: { id: contactId, bankId: recordId, fullName: [lead.firstName, lead.lastName].filter(Boolean).join(' ').slice(0, 120) || app.companyName, role: app.jobTitle || null, email: lead.email, phone: lead.phone, isPrimary: created, agency: typeof activity.agency === 'string' ? activity.agency : null, userId: lead.applicantUserId, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
        await writeAudit(tx, actor, now, { action: 'bank_contact.created', entityType: 'bank_contact', entityId: contactId, entityLabel: app.jobTitle || 'contact', after: { bankId: recordId, isPrimary: created, fromApplication: true } });
      }
      // The person: member ADMIN of her organisation (ACP-084, ACP-085).
      if (lead.applicantUserId) {
        const existing = await tx.membership.findFirst({ where: { userId: lead.applicantUserId, organizationId: orgId, revokedAt: null } });
        if (!existing) await tx.membership.create({ data: { id: newId(), userId: lead.applicantUserId, organizationId: orgId, role: 'ADMIN', invitedById: stampBy(actor), invitedAt: now, acceptedAt: now, receivesLeads: false, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
      }
      // Supporting files → PartnerDocument (« Registre de commerce » / « Agrément », « Autre » for the presentation).
      for (const f of lead.leadFiles) {
        if (f.scanStatus === 'INFECTED') continue;
        if (f.label === 'LOGO') {
          logo = { storageKey: f.storageKey, fileName: f.fileName };
          continue;
        }
        const docId = newId();
        const key = `partners/${kind}/${recordId}/${docId}`;
        copies.push({ from: f.storageKey, to: key, mime: f.mimeType });
        const category = f.label === 'REGISTRATION' ? (kind === 'BANK' ? 'Agrément' : 'Registre de commerce') : 'Autre';
        await tx.partnerDocument.create({ data: { id: docId, ownerType: kind, ownerId: recordId, label: category === 'Autre' ? f.fileName.slice(0, 160) : category, category, storageKey: key, fileName: f.fileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes, checksumSha256: f.checksumSha256, scanStatus: f.scanStatus, uploadedById: f.uploadedById ?? actor.userId!, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
        await writeAudit(tx, actor, now, { action: 'partner_document.created', entityType: 'partner_document', entityId: docId, entityLabel: category, after: { [kind === 'BANK' ? 'bankId' : 'promoterId']: recordId, category, fromApplication: true } });
      }
      const decision = { by: actor.userId ?? 'system', at: now.toISOString(), result: { type: kind, id: recordId } };
      await tx.lead.update({ where: { id }, data: { application: { ...app, decision } as never, status: 'CLOSED', outcome: 'ANSWERED', closedAt: now, closedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'lead.application_approved', entityType: 'lead', entityId: id, entityLabel: lead.reference, after: { partnerKind: kind, recordId, attached: !created } });
      const ev = domainEvent({ type: 'lead.application_approved', aggregate: { type: 'Lead', id }, actor: { type: 'USER', id: actor.userId }, data: { partnerKind: kind, companyName: app.companyName, ...(kind === 'BANK' ? { bankId: recordId } : { promoterId: recordId }) } });
      await tx.outboxEvent.create({ data: { id: newId(), type: ev.type, aggregateType: ev.aggregateType, aggregateId: ev.aggregateId, payload: ev.payload as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now } });
      const manager = actor.userId ? await tx.user.findUnique({ where: { id: actor.userId }, select: { firstName: true, lastName: true } }) : null;
      if (lead.email) await this.mail.request(tx, { template: 'P_PARTNER_APPLICATION_APPROVED', to: lead.email, userId: lead.applicantUserId, leadId: id, triggeredBy: 'EVENT', dedupeKey: `P_PARTNER_APPLICATION_APPROVED:${id}`, vars: { action: { managerName: [manager?.firstName, manager?.lastName].filter(Boolean).join(' ') } } });
      return { recordId };
    }, { timeout: 30_000 });
    // The files are copied out of the transaction (FIA-001), from the request's space to the partner's.
    for (const c of copies) {
      const body = await this.storage.get('private', c.from);
      if (body) await this.storage.put('private', c.to, body, c.mime);
    }
    const logoFile = logo as { storageKey: string; fileName: string } | null;
    if (logoFile) {
      const body = await this.storage.get('private', logoFile.storageKey);
      if (body) await this.media.attach({ ownerType: kind, ownerId: result.recordId, kind: 'LOGO', body, fileName: logoFile.fileName }, actor).catch(() => undefined);
    }
    await this.notifier.committed(['catalogue']);
    return this.panel(auth, id);
  }

  /** `POST /admin/leads/{id}/request-partner-info` — ACP-084 « Demander un complément ». */
  async requestInfo(auth: AuthContext, actor: Actor, id: string, body: unknown): Promise<PartnerApplicationPanel> {
    const input = parseOrThrow(requestPartnerInfoSchema, body);
    const lead = await this.decide(auth, id);
    const app = (lead.application ?? {}) as unknown as ApplicationJson;
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.lead.update({ where: { id }, data: { applicationStatus: 'INFO_REQUESTED', application: { ...app, infoRequestNote: input.message } as never, updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'lead.application_info_requested', entityType: 'lead', entityId: id, entityLabel: lead.reference, after: { applicationStatus: 'INFO_REQUESTED' } });
      const ev = domainEvent({ type: 'lead.application_info_requested', aggregate: { type: 'Lead', id }, actor: { type: 'USER', id: actor.userId }, data: { partnerKind: lead.partnerKind, companyName: app.companyName, note: input.message } });
      await tx.outboxEvent.create({ data: { id: newId(), type: ev.type, aggregateType: ev.aggregateType, aggregateId: ev.aggregateId, payload: ev.payload as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now } });
      if (lead.email) await this.mail.request(tx, { template: 'P_PARTNER_INFO_REQUESTED', to: lead.email, userId: lead.applicantUserId, leadId: id, triggeredBy: 'EVENT', dedupeKey: `P_PARTNER_INFO_REQUESTED:${id}:${now.getTime()}`, vars: { action: { note: input.message } } });
    });
    return this.panel(auth, id);
  }

  /** `POST /admin/leads/{id}/decline-partner` — ACP-084 « Refuser ». */
  async decline(auth: AuthContext, actor: Actor, id: string, body: unknown): Promise<PartnerApplicationPanel> {
    const input = parseOrThrow(declinePartnerSchema, body);
    const lead = await this.decide(auth, id);
    const app = (lead.application ?? {}) as unknown as ApplicationJson;
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const moved = await tx.lead.updateMany({ where: { id, applicationStatus: { in: ['SUBMITTED', 'INFO_REQUESTED'] } }, data: { applicationStatus: 'DECLINED', application: { ...app, declineNote: input.message || null, decision: { by: actor.userId ?? 'system', at: now.toISOString(), reason: input.reason } } as never, status: 'CLOSED', outcome: 'ANSWERED', closedAt: now, closedById: stampBy(actor), updatedAt: now } });
      if (moved.count !== 1) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      await writeAudit(tx, actor, now, { action: 'lead.application_declined', entityType: 'lead', entityId: id, entityLabel: lead.reference, after: { applicationStatus: 'DECLINED' }, reason: input.reason });
      const ev = domainEvent({ type: 'lead.application_declined', aggregate: { type: 'Lead', id }, actor: { type: 'USER', id: actor.userId }, data: { partnerKind: lead.partnerKind, companyName: app.companyName, note: input.message ?? null } });
      await tx.outboxEvent.create({ data: { id: newId(), type: ev.type, aggregateType: ev.aggregateType, aggregateId: ev.aggregateId, payload: ev.payload as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now } });
      if (lead.email) await this.mail.request(tx, { template: 'P_PARTNER_APPLICATION_DECLINED', to: lead.email, userId: lead.applicantUserId, leadId: id, triggeredBy: 'EVENT', dedupeKey: `P_PARTNER_APPLICATION_DECLINED:${id}`, vars: { action: { note: input.message || '' } } });
    });
    return this.panel(auth, id);
  }
}
