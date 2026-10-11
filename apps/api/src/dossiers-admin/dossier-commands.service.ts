// PIP-015, PIP-021, PIP-025, PIP-026, PIP-080 … PIP-082 — the writes on a dossier: creation, taking in charge and
// change of adviser (CYC-020, CYC-040), qualification (CYC-021, CRM-050), the plan and the « prochaine étape »
// (PATCH), pause and resumption (CYC-031, CYC-032), closing (CYC-035), reopening (CYC-036), stepping back (CYC-037),
// deletion (CYC-038, MOD-312). One action = one transaction (FIA-001): the row is locked, the journal of stages,
// the client timeline, the audit rows and the events are written with the data.
//
// Delivery 3 (Q-077): reservations and bank submissions do not exist yet; a dossier that carries one (impossible through
// the screens of this delivery) is refused the gestures that would have to undo them (`STAGE_NOT_DELIVERED`).
import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  dossierAssignSchema,
  dossierCloseSchema,
  dossierCreateSchema,
  dossierHoldSchema,
  dossierQualifySchema,
  dossierReasonSchema,
  dossierUpdateSchema,
  grantOf,
  type DossierCreated,
  type DossierDetail,
} from '@dp/contracts';
import { localDate, stageDueAt, type BusinessCalendar } from '@dp/domain';
import type { Request } from 'express';
import { SYSTEM_ACTOR, stampBy, type Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { TasksService } from '../automation/tasks.service.js';
import { clientScope, dossierScope, StaffViews, type StaffView } from '../back-office/staff-view.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { loadAdvisors, canHandleBy } from '../leads/assignment.js';
import { refreshClientCaches } from '../leads/lead-records.js';
import { BusinessCalendarService, nextReference } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';
import type { Tx } from '../platform/tx.js';
import { cancelAppointmentsOfClosedDossier, reassignUpcomingAppointments } from '../tasks-admin/appointment-ops.js';
import { Inject } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import {
  advisorLabel,
  clientLine,
  dueAfterResume,
  emitDossier,
  eventActor,
  loadStageSla,
  lockDossier,
  moveStage,
  remainingBusinessMinutes,
  writeHistory,
  type DossierRow,
  type StageSla,
} from './dossier-core.js';
import { DossierReadService } from './dossier-read.service.js';
import { deletable, isGone, isLive, leadOutcomeOnClose, moveBackTarget, qualificationConditions, reopenStage, stageIndex } from './dossier-rules.js';
import { PropertyCards } from './property-cards.js';

const t = createTranslator('fr');

interface Ctx {
  staff: StaffView;
  actor: Actor;
  now: Date;
  cal: BusinessCalendar;
  sla: StageSla;
}

/** MOD § 2.3 — the reason of a pause or a closing: its code, then its note. */
const codedReason = (code: string, note: string | null | undefined) => (note ? `${code} — ${note}` : code);

@Injectable()
export class DossierCommandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly views: StaffViews,
    private readonly outbox: OutboxWriter,
    private readonly tasks: TasksService,
    private readonly idempotency: IdempotencyService,
    private readonly read: DossierReadService,
    private readonly cards: PropertyCards,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  private async ctx(auth: AuthContext): Promise<Ctx> {
    const [staff, cal, sla] = await Promise.all([this.views.of(auth), this.calendar.load(), loadStageSla(this.settings)]);
    return { staff, actor: auth.actor, now: this.clock.now(), cal, sla };
  }

  /** Runs a use case in its transaction, wakes the outbox after the commit, answers the record read again. */
  private async act(auth: AuthContext, id: string, fn: (tx: Tx, c: Ctx) => Promise<void>): Promise<DossierDetail> {
    const c = await this.ctx(auth);
    await this.read.visible(c.staff, id);
    await this.prisma.$transaction((tx) => fn(tx, c), { timeout: 30_000 });
    this.dispatcher.wake();
    return this.read.detail(auth, id);
  }

  private inactiveAfterDays() {
    return this.settings.get('clients.inactiveAfterDays');
  }

  // ─── Advisers (CRM-021, PIP-026) ──────────────────────────────────────────

  /** An adviser one may entrust a dossier to: active OWNER, ADMIN or AGENT, not absent now (CRM-021). */
  private async assertAdviser(agentId: string, c: Ctx): Promise<void> {
    const advisors = await loadAdvisors(this.prisma as unknown as Tx);
    const a = advisors.find((x) => x.userId === agentId);
    if (!a) throw AppError.validation([{ field: 'agentId', code: 'INVALID_CHOICE' }]);
    if (!canHandleBy(a, null, c.now, c.cal)) throw AppError.conflictState('AGENT_NOT_AVAILABLE');
  }

  /** ROL note 3 — an adviser (grant `scoped`) entrusts only to himself. */
  private assertMayEntrust(c: Ctx, agentId: string): void {
    if (grantOf(c.staff.role, 'dossier.assign') !== true && agentId !== c.staff.userId) throw new AppError(ErrorCode.FORBIDDEN);
  }

  // ─── Creation (PIP-015) ───────────────────────────────────────────────────

  /** `POST /admin/dossiers` (`dossier.create`) — born at INTEREST, it passes at once to QUALIFICATION (CYC-020). */
  async create(auth: AuthContext, req: Request, body: unknown): Promise<{ status: number; body: DossierCreated }> {
    const input = parseOrThrow(dossierCreateSchema, body);
    const c = await this.ctx(auth);
    const agentId = input.assignedAgentId ?? auth.userId;
    this.assertMayEntrust(c, agentId);
    await this.assertAdviser(agentId, c);
    const client = await this.prisma.client.findFirst({
      where: { AND: [{ id: input.clientId, deletedAt: null, mergedIntoId: null, gdprErasedAt: null }, clientScope(c.staff)] },
      select: { id: true, financingPreference: true, downPayment: true, downPaymentCurrency: true, preferredCountries: true, assignedAgentId: true, archivedAt: true },
    });
    if (!client) throw AppError.validation([{ field: 'clientId', code: 'INVALID_CHOICE' }]);
    const property = input.propertyId
      ? await this.prisma.property.findFirst({ where: { id: input.propertyId, deletedAt: null, publication: 'PUBLISHED' }, select: { id: true, title: true, countryCode: true } })
      : null;
    if (input.propertyId && !property) throw AppError.validation([{ field: 'propertyId', code: 'INVALID_CHOICE' }]);
    if (property) {
      const live = await this.prisma.dossier.findMany({ where: { clientId: client.id, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] } }, select: { reference: true, propertyId: true, dossierCandidates: { where: { propertyId: property.id }, select: { id: true } } } });
      const retained = live.find((d) => d.propertyId === property.id);
      if (retained) throw AppError.conflictState('DOSSIER_ALREADY_OPEN_FOR_PROPERTY', { reference: retained.reference }); // MOD-310
      const considers = live.find((d) => d.dossierCandidates.length > 0);
      if (considers && !input.confirmDuplicate) throw AppError.conflictState('DOSSIER_CONSIDERS_PROPERTY', { reference: considers.reference });
    }
    const result = await this.idempotency.run<void, DossierCreated>(req, { route: 'admin.dossiers', userId: auth.userId, required: false }, {
      execute: async (tx) => {
        const { now, actor, cal, sla } = c;
        const id = newId();
        const reference = await nextReference(tx, 'DOSSIER', now, cal.timeZone);
        const cash = !input.financingRequested;
        const pref = client.financingPreference;
        await tx.dossier.create({
          data: {
            id,
            reference,
            clientId: client.id,
            stage: 'INTEREST',
            status: 'OPEN',
            propertyCountryCode: property?.countryCode ?? client.preferredCountries[0] ?? null,
            financingRequested: input.financingRequested,
            financingType: cash ? 'CASH' : pref && pref !== 'CASH' ? pref : 'NO_PREFERENCE',
            downPayment: client.downPayment,
            downPaymentCurrency: client.downPayment !== null ? client.downPaymentCurrency : null,
            stageEnteredAt: now,
            slaDueAt: stageDueAt(now, 'INTEREST', cal, sla),
            lastActivityAt: now,
            createdById: stampBy(actor),
            updatedById: stampBy(actor),
            createdAt: now,
            updatedAt: now,
          },
        });
        // MOD-320 — exactly one PRIMARY party, created with the dossier (MOD-322: it reads everything from the client).
        await tx.dossierParty.create({ data: { id: newId(), dossierId: id, role: 'PRIMARY', clientId: client.id, sortOrder: 0, createdById: stampBy(actor), createdAt: now, updatedAt: now } });
        await tx.dossierStageHistory.create({ data: { id: newId(), dossierId: id, fromStage: null, toStage: 'INTEREST', fromStatus: null, toStatus: 'OPEN', isBackward: false, actorType: 'USER', changedById: stampBy(actor), changedAt: now, createdAt: now } });
        await writeAudit(tx, actor, now, { action: 'dossier.created', entityType: 'Dossier', entityId: id, entityLabel: reference, after: { stage: 'INTEREST', financingRequested: input.financingRequested, propertyId: property?.id ?? null }, clientId: client.id });
        await emitDossier(tx, this.outbox, { id, clientId: client.id }, 'dossier.opened', actor, now, { originLeadId: null });
        // The property entered by hand: a CONSIDERED property, never a retained one; the client is told nothing.
        if (property) {
          const cid = newId();
          await tx.dossierCandidate.create({ data: { id: cid, dossierId: id, propertyId: property.id, origin: 'CLIENT_INTEREST', leadId: null, status: 'INTERESTED', statusChangedAt: now, createdById: stampBy(actor), createdAt: now, updatedAt: now } });
          await writeAudit(tx, actor, now, { action: 'candidate.status_changed', entityType: 'DossierCandidate', entityId: cid, entityLabel: property.title, after: { status: 'INTERESTED', event: 'added' }, clientId: client.id, dossierId: id });
        }
        // CYC-020 — it has an adviser: INTEREST → QUALIFICATION at once.
        const row = await tx.dossier.findUniqueOrThrow({ where: { id } });
        await this.entrust(tx, row, agentId, { notifyClient: false }, c);
        await refreshClientCaches(tx, client.id, now, await this.inactiveAfterDays());
        return { id, reference };
      },
    });
    this.dispatcher.wake();
    return { status: result.status, body: result.body };
  }

  // ─── Taking in charge, change of adviser (CYC-020, CYC-040) ───────────────

  /**
   * Gives the dossier to `agentId`. At INTEREST (open): the advance of CYC-020. Otherwise the change of CYC-040: the open
   * tasks, the appointments to come and the open requests follow; the client's referent follows when he was only so
   * through this dossier.
   */
  private async entrust(tx: Tx, d: DossierRow, agentId: string, opts: { notifyClient: boolean }, c: Ctx): Promise<void> {
    const { now, actor } = c;
    const previous = d.assignedAgentId;
    if (previous === agentId) return;
    if (d.stage === 'INTEREST' && d.status === 'OPEN') {
      await moveStage(tx, this.outbox, d, { toStage: 'QUALIFICATION', data: { assignedAgentId: agentId } }, c);
      // « Demandes du dossier → IN_PROGRESS », with the dossier's adviser (CYC-020).
      await tx.lead.updateMany({ where: { dossierId: d.id, status: 'NEW' }, data: { status: 'IN_PROGRESS', assignedAgentId: agentId, takenAt: now, updatedAt: now } });
    } else {
      await tx.dossier.update({ where: { id: d.id }, data: { assignedAgentId: agentId, lastActivityAt: now, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
    }
    if (previous) {
      // CYC-040 — open tasks, appointments to come and open requests pass from the former adviser to the new one.
      const tasks = await tx.task.findMany({ where: { dossierId: d.id, status: 'OPEN', deletedAt: null, assigneeId: previous }, select: { id: true } });
      for (const task of tasks) {
        await tx.task.update({ where: { id: task.id }, data: { assigneeId: agentId, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
        await writeAudit(tx, actor, now, { action: 'task.updated', entityType: 'task', entityId: task.id, before: { assigneeId: previous }, after: { assigneeId: agentId }, clientId: d.clientId, reason: 'dossier.assigned' });
      }
      await reassignUpcomingAppointments(tx, { dossierId: d.id, toAgentId: agentId, actor, now });
    }
    await tx.lead.updateMany({ where: { OR: [{ dossierId: d.id }, { contextDossierId: d.id }], status: { in: ['NEW', 'IN_PROGRESS'] } }, data: { assignedAgentId: agentId, updatedAt: now } });
    // The referent: the new adviser when the client had none, or when the former one followed him only through this dossier.
    const client = await tx.client.findUniqueOrThrow({ where: { id: d.clientId }, select: { assignedAgentId: true } });
    if (!client.assignedAgentId) await tx.client.update({ where: { id: d.clientId }, data: { assignedAgentId: agentId, version: { increment: 1 }, updatedAt: now } });
    else if (previous && client.assignedAgentId === previous) {
      const other = await tx.dossier.count({ where: { clientId: d.clientId, id: { not: d.id }, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] }, assignedAgentId: previous } });
      if (other === 0) await tx.client.update({ where: { id: d.clientId }, data: { assignedAgentId: agentId, version: { increment: 1 }, updatedAt: now } });
    }
    const agentName = await advisorLabel(tx, agentId);
    await clientLine(tx, d.id, 'AGENT_ASSIGNED', { conseiller: agentName }, now); // ECL-031 « {conseiller} suit votre projet. »
    const full = await tx.user.findUnique({ where: { id: agentId }, select: { firstName: true, lastName: true } });
    await writeAudit(tx, actor, now, {
      action: 'dossier.assigned',
      entityType: 'Dossier',
      entityId: d.id,
      entityLabel: d.reference,
      before: { assignedAgentId: previous },
      after: { assignedAgentId: agentId, agentName: [full?.firstName, full?.lastName].filter(Boolean).join(' ') },
      clientId: d.clientId,
    });
    await emitDossier(tx, this.outbox, d, 'dossier.assigned', actor, now, { agentId, previousAgentId: previous, notifyClient: opts.notifyClient && previous !== null });
  }

  /** `POST /admin/dossiers/{id}/assign` (`dossier.assign`) — PIP-026; « Prendre en charge » is the same gesture to oneself. */
  async assign(auth: AuthContext, id: string, body: unknown): Promise<DossierDetail> {
    const input = parseOrThrow(dossierAssignSchema, body);
    return this.act(auth, id, async (tx, c) => {
      this.assertMayEntrust(c, input.agentId);
      const d = await lockDossier(tx, id);
      if (!isLive(d.status)) throw AppError.conflictState('DOSSIER_CLOSED');
      // ROL note 3 — an adviser takes a dossier that has no adviser; he does not take a colleague's.
      if (grantOf(c.staff.role, 'dossier.assign') !== true && d.assignedAgentId !== null && d.assignedAgentId !== auth.userId) throw new AppError(ErrorCode.FORBIDDEN);
      await this.assertAdviser(input.agentId, c);
      await this.entrust(tx, d, input.agentId, { notifyClient: !input.silent }, c);
    });
  }

  // ─── Qualification (CYC-021, CRM-050) ─────────────────────────────────────

  /** `POST /admin/dossiers/{id}/qualify` (`dossier.transition`) — the values completed in the window go on the client record first. */
  async qualify(auth: AuthContext, id: string, body: unknown): Promise<DossierDetail> {
    const input = parseOrThrow(dossierQualifySchema, body);
    return this.act(auth, id, async (tx, c) => {
      const { now, actor } = c;
      const d = await lockDossier(tx, id, input.version);
      if (d.status === 'ON_HOLD') throw AppError.conflictState('DOSSIER_ON_HOLD');
      if (d.status !== 'OPEN') throw AppError.conflictState('DOSSIER_CLOSED');
      if (d.stage !== 'QUALIFICATION') throw AppError.conflictState(stageIndex(d.stage) < stageIndex('QUALIFICATION') ? 'CANNOT_SKIP_STAGE' : 'TRANSITION_NOT_ALLOWED');

      // CRM-050 — what the window completed on the spot.
      const typed = Object.fromEntries(Object.entries(input.client).filter(([, v]) => v !== undefined && v !== null)) as Record<string, string>;
      if (('downPayment' in typed || 'downPaymentCurrency' in typed) && !c.staff.sensitive) throw new AppError(ErrorCode.FORBIDDEN); // ROL-019
      if (Object.keys(typed).length) {
        const before = await tx.client.findUniqueOrThrow({ where: { id: d.clientId }, select: { budgetCurrency: true, budgetMonthlyCurrency: true, downPaymentCurrency: true } });
        const reference = await this.settings.get('display.referenceCurrency');
        const data: Prisma.ClientUncheckedUpdateInput = { ...typed, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now };
        if (typed.budgetMax && !typed.budgetCurrency && !before.budgetCurrency) data.budgetCurrency = reference;
        if (typed.budgetMonthly && !typed.budgetMonthlyCurrency && !before.budgetMonthlyCurrency) data.budgetMonthlyCurrency = reference;
        if (typed.downPayment && !typed.downPaymentCurrency && !before.downPaymentCurrency) data.downPaymentCurrency = reference;
        await tx.client.update({ where: { id: d.clientId }, data });
        // SEC-081 — the journal names the fields; values of a person are not copied.
        await writeAudit(tx, actor, now, { action: 'client.updated', entityType: 'Client', entityId: d.clientId, after: Object.fromEntries(Object.keys(typed).map((k) => [k, '[modifié]'])), clientId: d.clientId, reason: 'qualification' });
      }
      const client = await tx.client.findUniqueOrThrow({ where: { id: d.clientId } });
      const conditions = qualificationConditions({ firstContactAt: d.firstContactAt, client });
      const missing = conditions.filter((x) => !x.met);
      if (missing.length) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'MISSING_CONDITIONS', details: missing.map((m) => ({ field: m.code, code: 'MISSING_CONDITION' })) });

      // CYC-037 — when the dossier advances again, the effects of a first entry are not replayed.
      const already = await tx.dossierStageHistory.count({ where: { dossierId: d.id, toStage: 'MATCHING' } });
      if (!client.qualifiedAt) await tx.client.update({ where: { id: client.id }, data: { qualifiedAt: now, qualifiedById: stampBy(actor), updatedAt: now } });
      await moveStage(tx, this.outbox, d, { toStage: 'MATCHING', data: { qualifiedAt: now } }, c);
      if (!already) {
        await clientLine(tx, d.id, 'QUALIFIED', { conseiller: await advisorLabel(tx, d.assignedAgentId) }, now);
        await this.outbox.add(tx, { type: 'client.qualified', aggregateType: 'Client', aggregateId: client.id, payload: { type: 'client.qualified', actor: eventActor(actor), aggregate: { type: 'Client', id: client.id }, clientId: client.id, dossierId: d.id, data: {} } }, now);
      }
      await refreshClientCaches(tx, client.id, now, await this.inactiveAfterDays()); // CAL-070 score, CYC-060 status
    });
  }

  // ─── Changes (PATCH, PIP-025, PIP-026, PIP-033 « Choisir le lot ») ─────────

  /** `PATCH /admin/dossiers/{id}` (`dossier.update`). */
  async update(auth: AuthContext, id: string, body: unknown): Promise<DossierDetail> {
    const input = parseOrThrow(dossierUpdateSchema, body);
    return this.act(auth, id, async (tx, c) => {
      const { now, actor } = c;
      const d = await lockDossier(tx, id, input.version);
      if (!isLive(d.status)) throw AppError.conflictState('DOSSIER_CLOSED'); // PIP-090
      const data: Prisma.DossierUncheckedUpdateInput = {};
      const extra: Record<string, unknown> = {};
      if (input.priority !== undefined) data.priority = input.priority;
      if (input.clientNextStep !== undefined) data.clientNextStep = input.clientNextStep ? input.clientNextStep : null;
      if (input.durationMonths !== undefined) data.durationMonths = input.durationMonths;
      if (input.financingType !== undefined) {
        if (!d.financingRequested && input.financingType !== null) throw AppError.validation([{ field: 'financingType', code: 'INVALID_CHOICE' }]);
        data.financingType = input.financingType;
      }
      const sensitive = input.downPayment !== undefined || input.downPaymentCurrency !== undefined || input.loanAmountRequested !== undefined;
      if (sensitive && !c.staff.sensitive) throw new AppError(ErrorCode.FORBIDDEN); // SEC-033
      const reservation = await tx.reservation.count({ where: { dossierId: d.id, status: { in: ['OPTION', 'RESERVED'] } } });
      if (input.lotId !== undefined) {
        if (reservation > 0) throw AppError.conflictState('DOSSIER_HAS_RESERVATION');
        if (input.lotId === null) data.lotId = null;
        else {
          if (!d.propertyId) throw AppError.validation([{ field: 'lotId', code: 'INVALID_CHOICE' }]);
          const lot = await tx.lot.findFirst({ where: { id: input.lotId, propertyId: d.propertyId, deletedAt: null }, select: { id: true, reference: true, price: true, status: true } });
          if (!lot) throw AppError.validation([{ field: 'lotId', code: 'INVALID_CHOICE' }]);
          if (lot.status !== 'AVAILABLE') throw AppError.conflictState('LOT_NOT_AVAILABLE');
          data.lotId = lot.id;
          extra.lot = lot.reference;
          extra.event = 'lot_chosen';
          // MOD-313 — the price of the project is prefilled with the price of the lot.
          if (input.purchasePrice === undefined) data.purchasePrice = lot.price;
        }
      }
      if (input.purchasePrice !== undefined) {
        if (!d.propertyId) throw AppError.validation([{ field: 'purchasePrice', code: 'INVALID_CHOICE' }]); // « Retenez d'abord un bien. »
        data.purchasePrice = input.purchasePrice;
      }
      if (input.downPayment !== undefined) data.downPayment = input.downPayment;
      if (input.downPaymentCurrency !== undefined) data.downPaymentCurrency = input.downPaymentCurrency;
      if (input.loanAmountRequested !== undefined) {
        data.loanAmountRequested = input.loanAmountRequested;
        data.loanCurrency = input.loanAmountRequested === null ? null : (d.purchaseCurrency ?? input.downPaymentCurrency ?? d.downPaymentCurrency);
      }
      if (!Object.keys(data).length) return;
      await tx.dossier.update({ where: { id: d.id }, data: { ...data, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      const before = Object.fromEntries(Object.keys(data).map((k) => [k, (d as Record<string, unknown>)[k] ?? null]));
      await writeAudit(tx, actor, now, { action: 'dossier.updated', entityType: 'Dossier', entityId: d.id, entityLabel: d.reference, before, after: { ...data, ...extra }, clientId: d.clientId });
    });
  }

  // ─── Pause, resumption (CYC-031 … CYC-034, PIP-080) ───────────────────────

  /** `POST /admin/dossiers/{id}/hold` (`dossier.transition`). */
  async hold(auth: AuthContext, id: string, body: unknown): Promise<DossierDetail> {
    const input = parseOrThrow(dossierHoldSchema, body);
    return this.act(auth, id, async (tx, c) => {
      const { now, actor, cal } = c;
      const d = await lockDossier(tx, id);
      if (d.status === 'ON_HOLD') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      if (d.status !== 'OPEN') throw AppError.conflictState('DOSSIER_CLOSED');
      if (input.until && input.until < localDate(now, cal)) throw AppError.validation([{ field: 'until', code: 'INVALID_DATE' }]);
      const waiting = input.reason === 'WAITING_CLIENT';
      const notifyClient = waiting || input.notifyClient; // « cochée d'office et non modifiable » for WAITING_CLIENT
      await writeHistory(tx, d, { toStage: d.stage, toStatus: 'ON_HOLD', reason: codedReason(input.reason, input.note) }, c);
      await tx.dossier.update({
        where: { id: d.id },
        data: {
          status: 'ON_HOLD',
          holdReason: input.reason,
          holdNote: input.note,
          holdUntil: input.until ? new Date(`${input.until}T00:00:00Z`) : null,
          holdClientNote: waiting ? input.clientNote : null,
          heldAt: now,
          slaPausedRemainingMinutes: remainingBusinessMinutes(d.slaDueAt, now, cal),
          slaDueAt: null,
          lastActivityAt: now,
          version: { increment: 1 },
          updatedById: stampBy(actor),
          updatedAt: now,
        },
      });
      await clientLine(tx, d.id, 'PUT_ON_HOLD', {}, now);
      await writeAudit(tx, actor, now, { action: 'dossier.held', entityType: 'Dossier', entityId: d.id, entityLabel: d.reference, before: { status: d.status }, after: { status: 'ON_HOLD', holdReason: input.reason, holdUntil: input.until, notifyClient }, clientId: d.clientId, reason: input.note });
      await emitDossier(tx, this.outbox, d, 'dossier.put_on_hold', actor, now, { holdReason: input.reason, holdUntil: input.until, notifyClient });
    });
  }

  /** `POST /admin/dossiers/{id}/resume` (`dossier.transition`) — CYC-032. */
  async resume(auth: AuthContext, id: string): Promise<DossierDetail> {
    return this.act(auth, id, async (tx, c) => {
      const { now, actor, cal } = c;
      const d = await lockDossier(tx, id);
      if (d.status !== 'ON_HOLD') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      await writeHistory(tx, d, { toStage: d.stage, toStatus: 'OPEN' }, c);
      await tx.dossier.update({
        where: { id: d.id },
        data: {
          status: 'OPEN',
          slaDueAt: dueAfterResume(d.slaPausedRemainingMinutes, now, cal) ?? stageDueAt(now, d.stage, cal, c.sla),
          slaPausedRemainingMinutes: null,
          holdReason: null,
          holdNote: null,
          holdUntil: null,
          holdClientNote: null,
          heldAt: null,
          lastActivityAt: now,
          version: { increment: 1 },
          updatedById: stampBy(actor),
          updatedAt: now,
        },
      });
      // CYC-032 — the reminders of the pieces start again from today; a passed due date gets today + the default delay.
      const dueDays = await this.settings.get('documents.defaultDueDays');
      const due = new Date(`${localDate(new Date(now.getTime() + dueDays * 86_400_000), cal)}T00:00:00Z`);
      await tx.dossierDocument.updateMany({ where: { dossierId: d.id, status: { in: ['PENDING', 'REJECTED'] }, dueAt: { lt: new Date(`${localDate(now, cal)}T00:00:00Z`) } }, data: { dueAt: due } });
      await tx.dossierDocument.updateMany({ where: { dossierId: d.id, status: { in: ['PENDING', 'REJECTED'] } }, data: { reminderBaseAt: now } });
      await clientLine(tx, d.id, 'RESUMED', {}, now);
      await writeAudit(tx, actor, now, { action: 'dossier.resumed', entityType: 'Dossier', entityId: d.id, entityLabel: d.reference, before: { status: 'ON_HOLD', holdReason: d.holdReason }, after: { status: 'OPEN' }, clientId: d.clientId });
      await emitDossier(tx, this.outbox, d, 'dossier.resumed', actor, now, { holdReason: d.holdReason, holdUntil: d.holdUntil ? d.holdUntil.toISOString().slice(0, 10) : null });
    });
  }

  // ─── Closing (CYC-035, PIP-081) ───────────────────────────────────────────

  /** `POST /admin/dossiers/{id}/close` (`dossier.close`). */
  async close(auth: AuthContext, id: string, body: unknown): Promise<DossierDetail> {
    const input = parseOrThrow(dossierCloseSchema, body);
    return this.act(auth, id, async (tx, c) => {
      const { now, actor } = c;
      const d = await lockDossier(tx, id);
      if (!isLive(d.status)) throw AppError.conflictState('DOSSIER_CLOSED');
      const [reservation, submissions] = await Promise.all([
        tx.reservation.count({ where: { dossierId: d.id, status: { in: ['OPTION', 'RESERVED'] } } }),
        tx.bankSubmission.count({ where: { dossierId: d.id, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED'] } } }),
      ]);
      if (reservation || submissions) throw AppError.conflictState('STAGE_NOT_DELIVERED'); // Q-077 — undone with Lot 4
      // 3. open tasks → cancelled.
      const tasks = await tx.task.findMany({ where: { dossierId: d.id, status: 'OPEN', deletedAt: null }, select: { id: true } });
      for (const task of tasks) await this.tasks.cancel(tx, SYSTEM_ACTOR, now, task.id, t('ui.automation.close.dossierClosed'));
      // 4. appointments to come → cancelled (the client is told in the « dossier clôturé » version, if he was informed).
      await cancelAppointmentsOfClosedDossier(tx, this.outbox, { dossierId: d.id, now });
      // 5.
      await writeHistory(tx, d, { toStage: d.stage, toStatus: 'LOST', reason: codedReason(input.reason, input.note) }, c);
      await tx.dossier.update({
        where: { id: d.id },
        data: { status: 'LOST', lostAt: now, lostReason: input.reason, lostNote: input.note, slaDueAt: null, slaPausedRemainingMinutes: null, holdReason: null, holdNote: null, holdUntil: null, holdClientNote: null, heldAt: null, lastActivityAt: now, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      // 6. open requests of the dossier → closed, with the outcome that answers the reason.
      const outcome = leadOutcomeOnClose(input.reason);
      const leads = await tx.lead.findMany({ where: { dossierId: d.id, status: { in: ['NEW', 'IN_PROGRESS'] } }, select: { id: true, reference: true, status: true } });
      for (const lead of leads) {
        await tx.lead.update({ where: { id: lead.id }, data: { status: 'CLOSED', outcome, closedAt: now, closedById: stampBy(actor), updatedAt: now } });
        await writeAudit(tx, actor, now, { action: 'lead.closed', entityType: 'Lead', entityId: lead.id, entityLabel: lead.reference, before: { status: lead.status }, after: { status: 'CLOSED', outcome }, clientId: d.clientId, reason: 'dossier.closed' });
        await this.outbox.add(tx, { type: 'lead.closed', aggregateType: 'Lead', aggregateId: lead.id, payload: { type: 'lead.closed', actor: eventActor(actor), aggregate: { type: 'Lead', id: lead.id }, clientId: d.clientId, dossierId: d.id, data: { outcome } } }, now);
      }
      await clientLine(tx, d.id, 'CLOSED', {}, now);
      await writeAudit(tx, actor, now, { action: 'dossier.closed', entityType: 'Dossier', entityId: d.id, entityLabel: d.reference, before: { status: d.status }, after: { status: 'LOST', lostReason: input.reason, notifyClient: input.notifyClient }, clientId: d.clientId, reason: input.note });
      await emitDossier(tx, this.outbox, d, 'dossier.lost', actor, now, { lostReason: input.reason, notifyClient: input.notifyClient });
      await refreshClientCaches(tx, d.clientId, now, await this.inactiveAfterDays()); // CYC-060
    });
  }

  // ─── Reopening (CYC-036) ──────────────────────────────────────────────────

  /** `POST /admin/dossiers/{id}/reopen` (`dossier.reopen`). */
  async reopen(auth: AuthContext, id: string, body: unknown): Promise<DossierDetail> {
    const { reason } = parseOrThrow(dossierReasonSchema, body);
    return this.act(auth, id, async (tx, c) => {
      const { now, actor, cal, sla } = c;
      const d = await lockDossier(tx, id);
      if (d.status !== 'LOST') throw AppError.conflictState('TRANSITION_NOT_ALLOWED'); // a WON dossier never reopens
      const [client, advisors, online] = await Promise.all([tx.client.findUniqueOrThrow({ where: { id: d.clientId }, select: { qualifiedAt: true, preferredCountries: true } }), loadAdvisors(tx), this.cards.onlineIds()]);
      const agentActive = Boolean(d.assignedAgentId && advisors.some((a) => a.userId === d.assignedAgentId));
      const retained = d.propertyId ? (await this.cards.rows([d.propertyId], tx)).get(d.propertyId) : undefined;
      const retainedAvailable = Boolean(retained && online.has(retained.id) && !isGone(retained) && retained.availability === 'AVAILABLE');
      const target = reopenStage({ closedAt: d.stage, hasRetained: Boolean(retained), retainedAvailable, clientQualified: Boolean(client.qualifiedAt), dossierQualified: Boolean(d.qualifiedAt), agentActive });
      const data: Prisma.DossierUncheckedUpdateInput = {};
      if (!agentActive) data.assignedAgentId = null;
      // MATCHING — the retained property that is no longer available becomes UNAVAILABLE, and the dossier loses it.
      if (retained && !retainedAvailable && stageIndex(target) <= stageIndex('MATCHING')) {
        await tx.dossierCandidate.updateMany({ where: { dossierId: d.id, propertyId: retained.id, status: 'SELECTED' }, data: { status: 'UNAVAILABLE', statusChangedAt: now, version: { increment: 1 }, updatedAt: now } });
        Object.assign(data, { propertyId: null, lotId: null, programId: null, promoterId: null, purchasePrice: null, purchaseCurrency: null, propertyCountryCode: client.preferredCountries[0] ?? null });
      }
      await writeHistory(tx, d, { toStage: target, toStatus: 'OPEN', isBackward: stageIndex(target) < stageIndex(d.stage), reason }, c);
      await tx.dossier.update({
        where: { id: d.id },
        data: { ...data, status: 'OPEN', stage: target, stageEnteredAt: now, slaDueAt: stageDueAt(now, target, cal, sla), lostAt: null, lostReason: null, lostNote: null, lastActivityAt: now, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      await clientLine(tx, d.id, 'REOPENED', {}, now);
      await writeAudit(tx, actor, now, { action: 'dossier.reopened', entityType: 'Dossier', entityId: d.id, entityLabel: d.reference, before: { status: 'LOST', stage: d.stage }, after: { status: 'OPEN', stage: target }, clientId: d.clientId, reason });
      await emitDossier(tx, this.outbox, d, 'dossier.reopened', actor, now);
      if (target !== d.stage) await emitDossier(tx, this.outbox, d, 'dossier.stage_changed', actor, now, { fromStage: d.stage, toStage: target, isBackward: stageIndex(target) < stageIndex(d.stage) });
      await refreshClientCaches(tx, d.clientId, now, await this.inactiveAfterDays());
    });
  }

  // ─── Stepping back (CYC-037) ──────────────────────────────────────────────

  /** `POST /admin/dossiers/{id}/move-back` (`dossier.transition.backward`) — no e-mail to the client, nothing deleted. */
  async moveBack(auth: AuthContext, id: string, body: unknown): Promise<DossierDetail> {
    const { reason } = parseOrThrow(dossierReasonSchema, body);
    return this.act(auth, id, async (tx, c) => {
      const { now } = c;
      const d = await lockDossier(tx, id);
      if (d.status === 'ON_HOLD') throw AppError.conflictState('DOSSIER_ON_HOLD');
      if (d.status !== 'OPEN') throw AppError.conflictState('DOSSIER_CLOSED');
      const target = moveBackTarget(d.stage, d.financingRequested);
      if (!target) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      if (d.stage === 'ACQUISITION' && d.financingRequested) throw AppError.conflictState('STAGE_NOT_DELIVERED'); // the accepted offer: Lot 4
      const unfinished = await tx.bankSubmission.count({ where: { dossierId: d.id, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED'] } } });
      if ((d.stage === 'DOCUMENTS' || d.stage === 'BANK_REVIEW') && unfinished) throw AppError.conflictState('SUBMISSION_IN_PROGRESS');
      if (d.stage === 'DOCUMENTS' && (await tx.reservation.count({ where: { dossierId: d.id, status: 'RESERVED' } }))) throw AppError.conflictState('RESERVATION_ACTIVE');
      const data: Prisma.DossierUncheckedUpdateInput = {};
      if (d.stage === 'QUALIFICATION') data.assignedAgentId = null;
      if (d.stage === 'MATCHING') data.qualifiedAt = null; // the client record keeps its qualification
      if (d.stage === 'ACQUISITION') data.conditionsAcceptedAt = null;
      await moveStage(tx, this.outbox, d, { toStage: target, isBackward: true, reason, data }, c);
      // CYC-037 / CYC-008 — the adviser leaves the client too, when he was his referent only through this dossier.
      if (d.stage === 'QUALIFICATION' && d.assignedAgentId) {
        const client = await tx.client.findUniqueOrThrow({ where: { id: d.clientId }, select: { assignedAgentId: true } });
        if (client.assignedAgentId === d.assignedAgentId) {
          const [dossiers, leads] = await Promise.all([
            tx.dossier.count({ where: { clientId: d.clientId, id: { not: d.id }, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] }, assignedAgentId: d.assignedAgentId } }),
            tx.lead.count({ where: { clientId: d.clientId, status: { in: ['NEW', 'IN_PROGRESS'] }, assignedAgentId: d.assignedAgentId, dossierId: { not: d.id } } }),
          ]);
          if (!dossiers && !leads) await tx.client.update({ where: { id: d.clientId }, data: { assignedAgentId: null, version: { increment: 1 }, updatedAt: now } });
        }
      }
    });
  }

  // ─── Deletion (CYC-038, MOD-312) ──────────────────────────────────────────

  /** `DELETE /admin/dossiers/{id}` (`dossier.delete`) — a dossier opened by mistake; logical deletion (restorable, Lot 6). */
  async remove(auth: AuthContext, id: string, body: unknown): Promise<void> {
    const { reason } = parseOrThrow(dossierReasonSchema, body);
    const c = await this.ctx(auth);
    const found = await this.prisma.dossier.findFirst({ where: { AND: [{ id, deletedAt: null }, dossierScope(c.staff)] }, select: { id: true } });
    if (!found) throw AppError.notFound();
    await this.prisma.$transaction(async (tx) => {
      const { now, actor } = c;
      const d = await lockDossier(tx, id);
      const [deposited, submissions] = await Promise.all([tx.documentVersion.count({ where: { document: { dossierId: d.id } } }), tx.bankSubmission.count({ where: { dossierId: d.id } })]);
      if (!deletable(d, deposited, submissions)) throw AppError.conflictState('DOSSIER_NOT_DELETABLE');
      const tasks = await tx.task.findMany({ where: { dossierId: d.id, status: 'OPEN', deletedAt: null }, select: { id: true } });
      for (const task of tasks) await this.tasks.cancel(tx, SYSTEM_ACTOR, now, task.id, t('ui.automation.close.dossierDeleted'));
      await cancelAppointmentsOfClosedDossier(tx, this.outbox, { dossierId: d.id, now });
      // CYC-038 — the requests attached become unattached again.
      await tx.lead.updateMany({ where: { dossierId: d.id }, data: { dossierId: null, updatedAt: now } });
      await tx.dossier.update({ where: { id: d.id }, data: { deletedAt: now, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'dossier.deleted', entityType: 'Dossier', entityId: d.id, entityLabel: d.reference, before: { stage: d.stage, status: d.status }, clientId: d.clientId, reason });
      await refreshClientCaches(tx, d.clientId, now, await this.inactiveAfterDays());
    });
    this.dispatcher.wake();
  }
}
