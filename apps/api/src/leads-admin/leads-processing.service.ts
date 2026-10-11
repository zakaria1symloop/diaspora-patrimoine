// Package 3.2 « Demandes : traitement » — 04-back-office/03 § 1 to 4 (CRM-004, CRM-011, CRM-020, CRM-025), 01-domaine/06
// § 1 (CYC-001 … CYC-009). Every gesture is ONE transaction (FIA-001): the request's row locked (FIA-020), its state
// checked again by `leadCan` (the same function that told the screen what it may offer, BO-047), the data, the audit
// row under the code of SEC-080, the domain events (AUT-010) — then the dispatcher is woken after the commit.
// The partner applications (ACP-084), « Créer la fiche partenaire » and the export (BO-041) are not handled here.
import { Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  leadAssignSchema,
  leadAttachSchema,
  leadBulkSchema,
  leadCloseSchema,
  leadReviewSchema,
  staffLeadCreateSchema,
  type LeadBulkResult,
  type LeadObjectOption,
  type StaffLeadCreated,
} from '@dp/contracts';
import { firstContactDueAt, type BusinessCalendar, type DossierStage } from '@dp/domain';
import { createTranslator } from '@dp/i18n';
import type { Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import { leadCan, type LeadState } from '../back-office/leads-admin.service.js';
import { clientScope, leadScope, staffName, StaffViews, type StaffView } from '../back-office/staff-view.js';
import { assertAdvisor, createClientByStaff } from '../crm/client-write.js';
import { syncFirstContact } from '../crm/first-contact.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { canHandleBy, loadAdvisors } from '../leads/assignment.js';
import { resolveObject } from '../leads/lead-objects.js';
import { OPENS_DOSSIER, openOrJoinDossier, privacyPolicyVersion, refreshClientCaches, upsertClientForLead, writeConsents } from '../leads/lead-records.js';
import { BusinessCalendarService, nextReference } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { currentRequestId } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { assignLeadByHand, attachLeadToDossier, openDossierForLead, releaseLeadByHand, type StageSlaDays } from './lead-effects.js';

const t = createTranslator('fr');
const STAGES: DossierStage[] = ['INTEREST', 'QUALIFICATION', 'MATCHING', 'DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION'];
/** CYC-006 — the acknowledgement leaves again on a restoration only within this window. */
export const RESTORE_ACK_HOURS = 48;

const LEAD_ROW = {
  id: true,
  reference: true,
  kind: true,
  status: true,
  source: true,
  clientId: true,
  dossierId: true,
  assignedAgentId: true,
  firstContactAt: true,
  needsReview: true,
  applicationStatus: true,
  closedById: true,
  closedAt: true,
  createdAt: true,
  propertyId: true,
  programId: true,
  lotId: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  payload: true,
} as const;

interface Ctx {
  staff: StaffView;
  actor: Actor;
  now: Date;
  requestId: string | null;
}

@Injectable()
export class LeadsProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly views: StaffViews,
    private readonly outbox: OutboxWriter,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  // ─── Shared ───────────────────────────────────────────────────────────────

  private async ctx(auth: AuthContext): Promise<Ctx> {
    const requestId = currentRequestId();
    return { staff: await this.views.of(auth), actor: auth.actor, now: this.clock.now(), requestId: requestId === 'req_none' ? null : requestId };
  }

  private async stageSlaDays(): Promise<StageSlaDays> {
    const out = {} as Record<DossierStage, number>;
    for (const s of STAGES) out[s] = await this.settings.get(`sla.stage.${s}`);
    return out;
  }

  /** The request, locked for the length of the gesture, within the caller's perimeter (else 404, BO-015). */
  async row(tx: Tx, staff: StaffView, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw AppError.notFound();
    await tx.$queryRawUnsafe(`SELECT id FROM leads WHERE id = $1::uuid FOR UPDATE`, id);
    const lead = await tx.lead.findFirst({ where: { AND: [{ id }, leadScope(staff)] }, select: LEAD_ROW });
    if (!lead) throw AppError.notFound();
    return lead;
  }

  private async liveDossiers(tx: Tx, lead: { clientId: string | null; dossierId: string | null }) {
    if (!lead.clientId) return [];
    return tx.dossier.findMany({
      where: { clientId: lead.clientId, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] }, ...(lead.dossierId ? { id: { not: lead.dossierId } } : {}) },
      select: { id: true, reference: true, stage: true, propertyId: true },
    });
  }

  /** BO-047 — the gesture must be possible NOW (the screen may be stale): 409 `CONFLICT_STATE` with the reason. */
  private async check(tx: Tx, c: Ctx, lead: LeadState & { clientId: string | null; dossierId: string | null }, action: keyof ReturnType<typeof leadCan>, params?: Record<string, unknown>): Promise<void> {
    const live = action === 'openDossier' || action === 'attach' ? (await this.liveDossiers(tx, lead)).length : 0;
    const state = leadCan({ ...lead, liveDossiers: live }, c.staff, c.now)[action];
    if (!state) throw new AppError(ErrorCode.FORBIDDEN);
    if (!state.allowed) throw AppError.conflictState(state.reason, params ?? null);
  }

  private audit(tx: Tx, c: Ctx, lead: { id: string; reference: string; clientId: string | null }, action: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null, reason?: string | null) {
    return writeAudit(tx, c.actor, c.now, { action, entityType: 'Lead', entityId: lead.id, entityLabel: lead.reference, clientId: lead.clientId, before, after, reason: reason ?? null });
  }

  private event(lead: { id: string; clientId: string | null; dossierId: string | null }, type: string, c: Ctx, data: Record<string, unknown> = {}) {
    return domainEvent({ type, aggregate: { type: 'Lead', id: lead.id }, actor: { type: 'USER', id: c.actor.userId }, clientId: lead.clientId, dossierId: lead.dossierId, data, requestId: c.requestId });
  }

  private async done<T>(work: Promise<T>): Promise<T> {
    const result = await work;
    this.dispatcher.wake();
    return result;
  }

  // ─── Prendre en charge · Affecter · Rendre (CYC-003, CYC-008) ─────────────

  /** `POST /admin/leads/{id}/take` (`lead.process`). Two at the same instant: the first wins (row lock), the second reads who. */
  async take(auth: AuthContext, id: string): Promise<{ id: string }> {
    const c = await this.ctx(auth);
    const [cal, sla] = await Promise.all([this.calendar.load(), this.stageSlaDays()]);
    return this.done(
      this.prisma.$transaction(async (tx) => {
        const lead = await this.row(tx, c.staff, id);
        if (lead.status === 'IN_PROGRESS' && lead.assignedAgentId && lead.assignedAgentId !== c.staff.userId) {
          const who = await tx.user.findUnique({ where: { id: lead.assignedAgentId }, select: { firstName: true } });
          throw AppError.conflictState('LEAD_ALREADY_TAKEN', { prenom: who?.firstName ?? '' });
        }
        await this.check(tx, c, lead, 'take');
        await assignLeadByHand(tx, this.outbox, { lead, agentId: c.staff.userId, actorId: c.staff.userId, requestId: c.requestId, now: c.now, cal, stageSlaDays: sla });
        await this.audit(tx, c, lead, 'lead.taken', { status: lead.status, assignedAgentId: null }, { status: 'IN_PROGRESS', assignedAgentId: c.staff.userId });
        return { id };
      }),
    );
  }

  /** CRM-011 — « un conseiller actif, non absent » (absent beyond the first-contact deadline: refused). */
  private async assertAssignable(tx: Tx, agentId: string, deadline: Date | null, now: Date, cal: BusinessCalendar): Promise<void> {
    await assertAdvisor(tx, agentId, 'agentId');
    const advisor = (await loadAdvisors(tx)).find((a) => a.userId === agentId);
    if (!advisor || !canHandleBy(advisor, deadline, now, cal)) throw AppError.validation([{ field: 'agentId', code: 'ADVISER_ABSENT' }]);
  }

  /** `POST /admin/leads/{id}/assign` (`lead.assign`) — « Affecter à… », « Réaffecter ». */
  async assign(auth: AuthContext, id: string, body: unknown): Promise<{ id: string }> {
    const { agentId } = parseOrThrow(leadAssignSchema, body);
    const c = await this.ctx(auth);
    const [cal, sla] = await Promise.all([this.calendar.load(), this.stageSlaDays()]);
    return this.done(this.prisma.$transaction(async (tx) => this.assignOne(tx, c, id, agentId, cal, sla)));
  }

  private async assignOne(tx: Tx, c: Ctx, id: string, agentId: string, cal: BusinessCalendar, sla: StageSlaDays): Promise<{ id: string }> {
    const lead = await this.row(tx, c.staff, id);
    await this.check(tx, c, lead, 'assign');
    if (lead.assignedAgentId === agentId) return { id };
    const due = await tx.lead.findUnique({ where: { id }, select: { slaDueAt: true } });
    await this.assertAssignable(tx, agentId, due?.slaDueAt ?? null, c.now, cal);
    await assignLeadByHand(tx, this.outbox, { lead, agentId, actorId: c.staff.userId, requestId: c.requestId, now: c.now, cal, stageSlaDays: sla });
    await this.audit(tx, c, lead, 'lead.assigned', { status: lead.status, assignedAgentId: lead.assignedAgentId }, { status: 'IN_PROGRESS', assignedAgentId: agentId });
    return { id };
  }

  /** `POST /admin/leads/{id}/release` (`lead.process`; a colleague's: Direction or Administrateur) — CYC-008. */
  async release(auth: AuthContext, id: string): Promise<{ id: string }> {
    const c = await this.ctx(auth);
    const [cal, sla] = await Promise.all([this.calendar.load(), this.stageSlaDays()]);
    return this.done(
      this.prisma.$transaction(async (tx) => {
        const lead = await this.row(tx, c.staff, id);
        await this.check(tx, c, lead, 'release');
        await releaseLeadByHand(tx, this.outbox, { lead: { ...lead, assignedAgentId: lead.assignedAgentId! }, actorId: c.staff.userId, requestId: c.requestId, now: c.now, cal, stageSlaDays: sla, reason: t('ui.admin-leads.history.released') });
        await this.audit(tx, c, lead, 'lead.released', { status: lead.status, assignedAgentId: lead.assignedAgentId }, { status: 'NEW', assignedAgentId: null });
        return { id };
      }),
    );
  }

  // ─── Clôturer · Rouvrir (CYC-005, CYC-008) ────────────────────────────────

  /** `POST /admin/leads/{id}/close` (`lead.process`) — an outcome is required, a note optional. */
  async close(auth: AuthContext, id: string, body: unknown): Promise<{ id: string }> {
    const input = parseOrThrow(leadCloseSchema, body);
    const c = await this.ctx(auth);
    return this.done(this.prisma.$transaction(async (tx) => this.closeOne(tx, c, id, input.outcome, input.note)));
  }

  private async closeOne(tx: Tx, c: Ctx, id: string, outcome: string, note: string | null): Promise<{ id: string }> {
    const lead = await this.row(tx, c.staff, id);
    await this.check(tx, c, lead, 'close');
    await tx.lead.update({ where: { id }, data: { status: 'CLOSED', outcome: outcome as never, closedAt: c.now, closedById: c.staff.userId, closeNote: note, updatedById: c.staff.userId, updatedAt: c.now } });
    await this.outbox.add(tx, this.event(lead, 'lead.closed', c, { outcome }), c.now);
    await this.audit(tx, c, lead, 'lead.closed', { status: lead.status }, { status: 'CLOSED', outcome }, note);
    return { id };
  }

  /** `POST /admin/leads/{id}/reopen` (`lead.process`) — closed by hand less than 90 days ago, not attached to a dossier. */
  async reopen(auth: AuthContext, id: string): Promise<{ id: string }> {
    const c = await this.ctx(auth);
    const [cal, sla] = await Promise.all([this.calendar.load(), this.stageSlaDays()]);
    return this.done(
      this.prisma.$transaction(async (tx) => {
        const lead = await this.row(tx, c.staff, id);
        await this.check(tx, c, lead, 'reopen');
        await tx.lead.update({ where: { id }, data: { status: 'IN_PROGRESS', outcome: null, closedAt: null, closedById: null, closeNote: null, updatedById: c.staff.userId, updatedAt: c.now } });
        await this.outbox.add(tx, this.event(lead, 'lead.reopened', c, { previousAgentId: lead.assignedAgentId }), c.now);
        // « affectée à qui la rouvre si elle n'a plus de conseiller actif »
        const advisors = await loadAdvisors(tx);
        if (!lead.assignedAgentId || !advisors.some((a) => a.userId === lead.assignedAgentId)) {
          await assignLeadByHand(tx, this.outbox, { lead: { ...lead, assignedAgentId: null }, agentId: c.staff.userId, actorId: c.staff.userId, requestId: c.requestId, now: c.now, cal, stageSlaDays: sla });
        }
        await this.audit(tx, c, lead, 'lead.reopened', { status: 'CLOSED' }, { status: 'IN_PROGRESS' });
        return { id };
      }),
    );
  }

  // ─── Indésirable · Restaurer · Vérifier (CYC-006, CRM-003) ────────────────

  /** `POST /admin/leads/{id}/spam` (`lead.process`). */
  async spam(auth: AuthContext, id: string): Promise<{ id: string }> {
    const c = await this.ctx(auth);
    return this.done(this.prisma.$transaction(async (tx) => this.spamOne(tx, c, id)));
  }

  private async spamOne(tx: Tx, c: Ctx, id: string, reviewed = false): Promise<{ id: string }> {
    const lead = await this.row(tx, c.staff, id);
    if (!reviewed) await this.check(tx, c, lead, 'spam');
    const after: Record<string, unknown> = { status: 'SPAM' };
    // CYC-006 — a record created by this request alone, and a dossier it opened that received no action, go to the trash.
    if (lead.clientId) {
      const client = await tx.client.findUnique({ where: { id: lead.clientId }, select: { id: true, userId: true, createdAt: true, _count: { select: { leads: true, dossiers: true, consents: true, communications: true, eventRegistrations: true, simulations: true } } } });
      const dossier = lead.dossierId ? await tx.dossier.findUnique({ where: { id: lead.dossierId }, select: { id: true, originLeadId: true, stage: true, assignedAgentId: true, _count: { select: { leadsAsDossier: true } } } }) : null;
      const untouchedDossier = dossier && dossier.originLeadId === lead.id && dossier.stage === 'INTEREST' && !dossier.assignedAgentId && dossier._count.leadsAsDossier === 1;
      if (untouchedDossier) {
        await tx.dossier.update({ where: { id: dossier.id }, data: { deletedAt: c.now, updatedAt: c.now } });
        after.trashedDossierId = dossier.id;
      }
      const createdByIt = client && !client.userId && Math.abs(client.createdAt.getTime() - lead.createdAt.getTime()) < 5000;
      const onlyThis = client && client._count.leads === 1 && client._count.communications === 0 && client._count.eventRegistrations === 0 && client._count.simulations === 0 && (client._count.dossiers === 0 || (untouchedDossier && client._count.dossiers === 1));
      if (createdByIt && onlyThis) {
        await tx.client.update({ where: { id: client.id }, data: { deletedAt: c.now, updatedAt: c.now } });
        after.trashedClientId = client.id;
      }
    }
    await tx.lead.update({ where: { id }, data: { status: 'SPAM', needsReview: false, ...(reviewed ? { reviewedById: c.staff.userId, reviewedAt: c.now } : {}), updatedById: c.staff.userId, updatedAt: c.now } });
    await this.outbox.add(tx, this.event(lead, 'lead.marked_spam', c), c.now);
    await this.audit(tx, c, lead, 'lead.marked_spam', { status: lead.status }, after);
    return { id };
  }

  /** `POST /admin/leads/{id}/restore` (`lead.process`) — CYC-006. */
  async restore(auth: AuthContext, id: string): Promise<{ id: string }> {
    const c = await this.ctx(auth);
    return this.done(this.prisma.$transaction(async (tx) => this.restoreOne(tx, c, id)));
  }

  private async restoreOne(tx: Tx, c: Ctx, id: string, reviewed = false): Promise<{ id: string }> {
    const lead = await this.row(tx, c.staff, id);
    if (!reviewed) await this.check(tx, c, lead, 'restore');
    const cal = await this.calendar.load();
    const lastSpam = await tx.auditLog.findFirst({ where: { entityType: 'Lead', entityId: id, action: 'lead.marked_spam' }, orderBy: { createdAt: 'desc' }, select: { after: true } });
    const trashed = (lastSpam?.after ?? {}) as { trashedClientId?: string; trashedDossierId?: string };
    let clientId = lead.clientId;
    let dossierId = lead.dossierId;
    let attachment = 'NONE';
    let ongoingDossierId: string | null = null;
    // Within `retention.trashDays` the record and the dossier come back as they were; beyond — or for a request classed
    // as spam at its creation, that created nothing — steps 1, 3, 4 and 5 of CYC-001 run as for a new request.
    if (trashed.trashedClientId) await tx.client.updateMany({ where: { id: trashed.trashedClientId, deletedAt: { not: null } }, data: { deletedAt: null, updatedAt: c.now } });
    if (trashed.trashedDossierId) await tx.dossier.updateMany({ where: { id: trashed.trashedDossierId, deletedAt: { not: null } }, data: { deletedAt: null, updatedAt: c.now } });
    if (!clientId && lead.email && lead.kind !== 'PARTNER_REQUEST') {
      const fields = ((lead.payload as { fields?: Record<string, unknown> })?.fields ?? {}) as Record<string, unknown>;
      const { client } = await upsertClientForLead(tx, this.outbox, {
        email: lead.email,
        facts: { firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone, whatsappOptIn: fields.whatsappOptIn === true, countryOfResidence: (fields.countryOfResidence as string | undefined) ?? null },
        locale: 'fr',
        utm: null,
        emailDoubtful: false,
        leadReference: lead.reference,
        now: c.now,
        auditReason: `lead:${lead.reference}:restored`,
      });
      clientId = client.id;
      await tx.lead.update({ where: { id }, data: { clientId } });
      if (typeof fields.consentKey === 'string') {
        await writeConsents(tx, this.outbox, { leadId: id, clientId, kind: lead.kind, contactKey: fields.consentKey as never, marketing: fields.marketingOptIn === true && typeof fields.marketingKey === 'string' ? { key: fields.marketingKey as never } : null, privacyVersion: await privacyPolicyVersion(tx, c.now), ipHash: null, userAgent: null, givenAt: lead.createdAt, now: c.now });
      }
      if (OPENS_DOSSIER.has(lead.kind)) {
        const object = await this.objectOf(tx, lead.propertyId, lead.programId, lead.kind === 'PROPERTY_INTEREST');
        const outcome = await openOrJoinDossier(tx, this.outbox, { lead: { id, reference: lead.reference, kind: lead.kind }, client, object, financingPreference: (fields.financingPreference as string | undefined) ?? null, now: c.now, cal, stageSlaDays: await this.stageSlaDays() });
        attachment = outcome.attachment;
        ongoingDossierId = outcome.ongoingDossierId;
        dossierId = outcome.dossier?.id ?? null;
      }
    }
    const slaDays = await this.settings.get('sla.firstContactBusinessDays');
    const slaDueAt = lead.kind === 'PARTNER_REQUEST' ? null : firstContactDueAt(c.now, cal, slaDays, null).dueAt;
    await tx.lead.update({ where: { id }, data: { status: 'NEW', needsReview: false, assignedAgentId: null, takenAt: null, slaDueAt, slaBreachedAt: null, ...(reviewed ? { reviewedById: c.staff.userId, reviewedAt: c.now } : {}), updatedById: c.staff.userId, updatedAt: c.now } });
    if (clientId) await refreshClientCaches(tx, clientId, c.now, await this.settings.get('clients.inactiveAfterDays'));
    await this.outbox.add(tx, this.event({ id, clientId, dossierId }, 'lead.restored', c), c.now);
    // The request starts again as if it had just arrived (alerts, rules of AUT-040); the acknowledgement only within 48 h.
    const fresh = c.now.getTime() - lead.createdAt.getTime() < RESTORE_ACK_HOURS * 3600_000;
    await this.outbox.add(tx, { type: 'lead.created', aggregateType: 'Lead', aggregateId: id, payload: { kind: lead.kind, source: lead.source, propertyId: lead.propertyId, attachment, ongoingDossierId, restored: true, sendAck: fresh, enteredById: c.staff.userId } }, c.now);
    await this.audit(tx, c, { ...lead, clientId }, 'lead.restored', { status: lead.status }, { status: 'NEW' });
    return { id };
  }

  /** `POST /admin/leads/{id}/review` (`lead.process`) — CRM-003 « Demande légitime » · « Indésirable ». */
  async review(auth: AuthContext, id: string, body: unknown): Promise<{ id: string }> {
    const { verdict } = parseOrThrow(leadReviewSchema, body);
    const c = await this.ctx(auth);
    return this.done(
      this.prisma.$transaction(async (tx) => {
        const lead = await this.row(tx, c.staff, id);
        await this.check(tx, c, lead, 'review');
        if (verdict === 'SPAM') {
          if (lead.status !== 'SPAM') await this.spamOne(tx, c, id, true);
          else await tx.lead.update({ where: { id }, data: { needsReview: false, reviewedById: c.staff.userId, reviewedAt: c.now, updatedAt: c.now } });
        } else if (lead.status === 'SPAM') {
          await this.restoreOne(tx, c, id, true);
        } else {
          await tx.lead.update({ where: { id }, data: { needsReview: false, reviewedById: c.staff.userId, reviewedAt: c.now, updatedAt: c.now } });
        }
        await this.audit(tx, c, lead, 'lead.reviewed', { needsReview: true, status: lead.status }, { needsReview: false, verdict });
        return { id };
      }),
    );
  }

  // ─── Dossier (CRM-011) ────────────────────────────────────────────────────

  private async objectOf(tx: Tx, propertyId: string | null, programId: string | null, required: boolean) {
    const [property, program] = await Promise.all([
      propertyId ? tx.property.findUnique({ where: { id: propertyId }, select: { reference: true } }) : null,
      programId ? tx.program.findUnique({ where: { id: programId }, select: { slug: true } }) : null,
    ]);
    if (!property && !program) return { property: null, program: null, lotId: null, outcome: null, candidateStatus: 'INTERESTED' as const };
    try {
      return await resolveObject(tx, { propertyReference: property?.reference, programSlug: property ? undefined : program?.slug } as never, required);
    } catch {
      // an object unpublished since: the request keeps it, no candidate is created
      return { property: null, program: null, lotId: null, outcome: null, candidateStatus: 'INTERESTED' as const };
    }
  }

  /** `POST /admin/leads/{id}/open-dossier` (`dossier.create`). */
  async openDossier(auth: AuthContext, id: string): Promise<{ id: string; dossierReference: string }> {
    const c = await this.ctx(auth);
    const [cal, sla] = await Promise.all([this.calendar.load(), this.stageSlaDays()]);
    return this.done(
      this.prisma.$transaction(async (tx) => {
        const lead = await this.row(tx, c.staff, id);
        await this.check(tx, c, lead, 'openDossier');
        const client = await tx.client.findUniqueOrThrow({ where: { id: lead.clientId! }, select: { id: true, preferredCountries: true, financingPreference: true, downPayment: true, downPaymentCurrency: true } });
        const object = await this.objectOf(tx, lead.propertyId, lead.programId, false);
        // MOD-310 — at most one live dossier per client and selected property
        if (object.property) {
          const held = await tx.dossier.findFirst({ where: { clientId: client.id, propertyId: object.property.id, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] } }, select: { reference: true } });
          if (held) throw AppError.conflictState('DOSSIER_ALREADY_OPEN_FOR_PROPERTY', { reference: held.reference });
        }
        const dossier = await openDossierForLead(tx, this.outbox, {
          lead,
          client,
          object: { propertyId: object.property?.id ?? null, propertyTitle: object.property?.title ?? null, lotId: object.lotId, candidateStatus: object.candidateStatus, countryCode: object.property?.countryCode ?? object.program?.countryCode ?? null },
          actorId: c.staff.userId,
          requestId: c.requestId,
          now: c.now,
          cal,
          stageSlaDays: sla,
        });
        await writeAudit(tx, c.actor, c.now, { action: 'dossier.created', entityType: 'Dossier', entityId: dossier.id, entityLabel: dossier.reference, clientId: client.id, after: { originLeadId: id } });
        await syncFirstContact(tx, this.outbox, { leadIds: [id], actor: c.actor, now: c.now });
        await refreshClientCaches(tx, client.id, c.now, await this.settings.get('clients.inactiveAfterDays'));
        return { id, dossierReference: dossier.reference };
      }),
    );
  }

  /** `POST /admin/leads/{id}/attach` (`dossier.create`) — a live dossier of the same client. */
  async attach(auth: AuthContext, id: string, body: unknown): Promise<{ id: string; dossierReference: string }> {
    const { dossierId } = parseOrThrow(leadAttachSchema, body);
    const c = await this.ctx(auth);
    return this.done(
      this.prisma.$transaction(async (tx) => {
        const lead = await this.row(tx, c.staff, id);
        await this.check(tx, c, lead, 'attach');
        const dossier = (await this.liveDossiers(tx, lead)).find((d) => d.id === dossierId);
        if (!dossier) throw AppError.validation([{ field: 'dossierId', code: 'INVALID_CHOICE' }]);
        const object = await this.objectOf(tx, lead.propertyId, lead.programId, false);
        await attachLeadToDossier(tx, this.outbox, { lead, dossier, object: { propertyId: object.property?.id ?? null, propertyTitle: object.property?.title ?? null, lotId: object.lotId, candidateStatus: object.candidateStatus }, actorId: c.staff.userId, requestId: c.requestId, now: c.now });
        await this.audit(tx, c, lead, 'lead.updated', { dossierId: null }, { dossierId });
        await syncFirstContact(tx, this.outbox, { leadIds: [id], actor: c.actor, now: c.now });
        return { id, dossierReference: dossier.reference };
      }),
    );
  }

  // ─── Actions groupées (CRM-004) ───────────────────────────────────────────

  /** `POST /admin/leads/bulk` — each request is its own transaction; the answer says which could not be done and why. */
  async bulk(auth: AuthContext, body: unknown): Promise<LeadBulkResult> {
    const input = parseOrThrow(leadBulkSchema, body);
    const c = await this.ctx(auth);
    if (input.action === 'assign' ? !c.staff.has('lead.assign') : !c.staff.has('lead.process')) throw new AppError(ErrorCode.FORBIDDEN);
    const [cal, sla] = await Promise.all([this.calendar.load(), this.stageSlaDays()]);
    const result: LeadBulkResult = { done: 0, failed: [] };
    for (const id of [...new Set(input.ids)]) {
      try {
        await this.prisma.$transaction(async (tx) => {
          if (input.action === 'assign') await this.assignOne(tx, c, id, input.agentId, cal, sla);
          else if (input.action === 'spam') await this.spamOne(tx, c, id);
          else await this.closeOne(tx, c, id, input.outcome, input.note);
        });
        result.done += 1;
      } catch (err) {
        const reference = (await this.prisma.lead.findFirst({ where: { AND: [{ id }, leadScope(c.staff)] }, select: { reference: true } }))?.reference ?? null;
        const e = err as AppError;
        const reason = e instanceof AppError ? (e.options.reason ?? e.options.details?.[0]?.code ?? e.code) : 'INTERNAL_ERROR';
        if (!(e instanceof AppError)) throw err;
        result.failed.push({ id, reference, reason });
      }
    }
    this.dispatcher.wake();
    return result;
  }

  // ─── Saisie par l'équipe (CRM-025) ────────────────────────────────────────

  /** `GET /admin/lead-objects?q=` (`lead.create`) — properties and programmes a request may be about. */
  async objects(rawQ: unknown): Promise<{ data: LeadObjectOption[] }> {
    const q = typeof rawQ === 'string' ? rawQ.trim().slice(0, 80) : '';
    if (q.length < 2) return { data: [] };
    const place = (city?: { nameFr: string } | null, region?: { nameFr: string } | null) => [city?.nameFr, region?.nameFr].filter(Boolean).join(', ') || null;
    const [properties, programs] = await Promise.all([
      this.prisma.property.findMany({
        where: { deletedAt: null, firstPublishedAt: { not: null }, OR: [{ reference: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }] },
        select: { id: true, reference: true, title: true, availability: true, publication: true, city: { select: { nameFr: true } }, region: { select: { nameFr: true } } },
        orderBy: [{ publication: 'desc' }, { reference: 'asc' }],
        take: 8,
      }),
      this.prisma.program.findMany({
        where: { deletedAt: null, firstPublishedAt: { not: null }, name: { contains: q, mode: 'insensitive' } },
        select: { id: true, name: true, publication: true, city: { select: { nameFr: true } }, region: { select: { nameFr: true } } },
        orderBy: { name: 'asc' },
        take: 5,
      }),
    ]);
    return {
      data: [
        ...properties.map((p) => ({ type: 'PROPERTY' as const, id: p.id, reference: p.reference, title: p.title, place: place(p.city, p.region), availability: p.availability, published: p.publication === 'PUBLISHED' })),
        ...programs.map((p) => ({ type: 'PROGRAM' as const, id: p.id, reference: null, title: p.name, place: place(p.city, p.region), availability: null, published: p.publication === 'PUBLISHED' })),
      ],
    };
  }

  /**
   * `POST /admin/leads` (`lead.create`) — CRM-025: a request received outside the site follows the same journey as a
   * request of the site (CYC-001), with the oral agreement recorded and no acknowledgement unless asked.
   */
  async create(auth: AuthContext, body: unknown): Promise<StaffLeadCreated> {
    const input = parseOrThrow(staffLeadCreateSchema, body);
    const c = await this.ctx(auth);
    const [cal, sla, slaDays, inactiveDays] = await Promise.all([this.calendar.load(), this.stageSlaDays(), this.settings.get('sla.firstContactBusinessDays'), this.settings.get('clients.inactiveAfterDays')]);
    const author = await this.prisma.user.findUniqueOrThrow({ where: { id: c.staff.userId }, select: { firstName: true, lastName: true } });
    return this.done(
      this.prisma.$transaction(async (tx) => {
        // 1. the record: found (within the perimeter) or created (CRM-041, MOD-302)
        let client: { id: string; email: string | null; phone: string | null; firstName: string | null; lastName: string | null; assignedAgentId: string | null };
        if (input.clientId) {
          const found = await tx.client.findFirst({ where: { AND: [{ id: input.clientId, deletedAt: null, mergedIntoId: null }, clientScope(c.staff)] }, select: { id: true, email: true, phone: true, firstName: true, lastName: true, assignedAgentId: true, archivedAt: true } });
          if (!found) throw AppError.validation([{ field: 'clientId', code: 'INVALID_CHOICE' }]);
          if (found.archivedAt) {
            await tx.client.update({ where: { id: found.id }, data: { archivedAt: null, archivedReason: null, version: { increment: 1 }, updatedAt: c.now } }); // CYC-061
            await this.outbox.add(tx, { type: 'client.unarchived', aggregateType: 'Client', aggregateId: found.id, payload: {} }, c.now);
          }
          client = found;
        } else {
          client = await createClientByStaff(tx, this.outbox, c.staff, c.actor, c.now, { ...input.client!, source: input.source, assignedAgentId: null }, 'client.');
        }
        if (input.assignedAgentId) await this.assertAssignable(tx, input.assignedAgentId, null, c.now, cal);
        const object = await this.objectOf(tx, input.propertyId, input.programId, false);
        if ((input.propertyId && !object.property) || (input.programId && !object.program)) throw AppError.validation([{ field: input.propertyId ? 'propertyId' : 'programId', code: 'INVALID_CHOICE' }]);

        // 2. the request, NEW, with its first-contact deadline (CAL-061)
        const id = newId();
        const reference = await nextReference(tx, 'LEAD', c.now, cal.timeZone);
        const alreadyContacted = input.alreadyContacted && input.source === 'PHONE';
        const sendAck = input.sendConfirmation && Boolean(client.email);
        await tx.lead.create({
          data: {
            id,
            reference,
            kind: input.kind,
            source: input.source,
            clientId: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            propertyId: object.property?.id ?? null,
            programId: object.property ? null : (object.program?.id ?? null),
            lotId: object.lotId,
            payload: { form: 'STAFF_ENTRY', fields: { ...(input.message ? { message: input.message } : {}) }, context: {}, step2: null, staffEntry: { enteredById: c.staff.userId, alreadyContacted, sendConfirmation: sendAck } } as never,
            message: input.message,
            locale: 'fr',
            spamScore: 0,
            spamSignals: [] as never,
            status: 'NEW',
            slaDueAt: firstContactDueAt(c.now, cal, slaDays, null).dueAt,
            createdById: c.staff.userId,
            updatedById: c.staff.userId,
            createdAt: c.now,
            updatedAt: c.now,
          },
        });

        // 3. the oral agreement (CRM-025 « Accord »): CONTACT_REQUEST always, MARKETING_EMAIL when checked
        const authorName = [author.firstName, author.lastName].filter(Boolean).join(' ');
        const dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: cal.timeZone }).format(c.now);
        const proofNote = t('ui.admin-leads.create.proofNote', { auteur: authorName, date: dateLabel, origine: t(`ui.enum.LeadSource.${input.source}`) });
        const documentVersion = await privacyPolicyVersion(tx, c.now);
        const consent = (type: 'CONTACT_REQUEST' | 'MARKETING_EMAIL', wording: string) =>
          tx.consent.create({ data: { id: newId(), type, granted: true, leadId: id, clientId: client.id, source: 'staff:lead', wording, documentVersion, recordedById: c.staff.userId, proofNote, givenAt: c.now, createdAt: c.now } });
        await consent('CONTACT_REQUEST', t('ui.admin-leads.create.consentContact'));
        if (input.marketingOptIn) {
          await consent('MARKETING_EMAIL', t('ui.admin-leads.create.consentMarketing'));
          await tx.client.update({ where: { id: client.id }, data: { marketingOptIn: true, updatedAt: c.now } });
          await this.outbox.add(tx, { type: 'consent.changed', aggregateType: 'Client', aggregateId: client.id, payload: { type: 'MARKETING_EMAIL', granted: true, by: 'STAFF', dossierId: null } }, c.now);
        }

        // 4. the dossier opened or joined (CYC-002), then the adviser (CRM-020: « moi, par défaut »)
        const fullClient = await tx.client.findUniqueOrThrow({ where: { id: client.id } });
        let attachment = 'NONE';
        let ongoingDossierId: string | null = null;
        let dossierId: string | null = null;
        if (OPENS_DOSSIER.has(input.kind)) {
          const outcome = await openOrJoinDossier(tx, this.outbox, { lead: { id, reference, kind: input.kind }, client: fullClient, object, financingPreference: null, now: c.now, cal, stageSlaDays: sla });
          attachment = outcome.attachment;
          ongoingDossierId = outcome.ongoingDossierId;
          dossierId = outcome.dossier?.id ?? null;
        }
        if (input.assignedAgentId) {
          await assignLeadByHand(tx, this.outbox, { lead: { id, clientId: client.id, dossierId, assignedAgentId: null }, agentId: input.assignedAgentId, actorId: c.staff.userId, requestId: c.requestId, now: c.now, cal, stageSlaDays: sla });
        }
        // CRM-025 « Échange déjà eu avec le client »: the first contact is the creation (CYC-004)
        if (alreadyContacted) await syncFirstContact(tx, this.outbox, { leadIds: [id], actor: c.actor, now: c.now });
        await refreshClientCaches(tx, client.id, c.now, inactiveDays);

        await writeAudit(tx, c.actor, c.now, { action: 'lead.created_by_staff', entityType: 'Lead', entityId: id, entityLabel: reference, clientId: client.id, after: { kind: input.kind, source: input.source, assignedAgentId: input.assignedAgentId, alreadyContacted, sendConfirmation: sendAck, marketingOptIn: input.marketingOptIn } });
        await this.outbox.add(tx, { type: 'lead.created', aggregateType: 'Lead', aggregateId: id, payload: { kind: input.kind, source: input.source, propertyId: object.property?.id ?? null, attachment, ongoingDossierId, sendAck, enteredById: c.staff.userId } }, c.now);

        const after = await tx.lead.findUniqueOrThrow({ where: { id }, select: { status: true, dossier: { select: { reference: true } } } });
        return { id, reference, clientId: client.id, status: after.status, dossierReference: after.dossier?.reference ?? null };
      }),
    );
  }

  /** The name of a staff member, for a sentence. */
  async staffFirstName(userId: string): Promise<string | null> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, status: true } });
    return staffName(u);
  }
}

