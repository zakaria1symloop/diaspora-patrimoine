// PIP-030 … PIP-033, CYC-070 … CYC-072, CYC-242 — the matching of a dossier, the tab « Biens » of EA-22: the
// considered properties, the search panel prefilled from the client's project (PIP-031) with its suggestions
// (PIP-032, CAL-080), the proposals (saved in preparation, then sent together: one sending = one event, AUT-043),
// what the adviser does in the client's name, retaining a property (CYC-071) and the lot it aims at, confirming or
// refusing the choice the client asked for, withdrawing the choice (CYC-242). Every write: one transaction, its audit
// rows (`candidate.status_changed`, SEC-080), its events, its lines of the client timeline (ECL-031).
import { Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  candidateDeclineSelectionSchema,
  candidateNoteSchema,
  candidateProposeSchema,
  candidateSearchQuerySchema,
  candidateSelectSchema,
  candidateSetStatusSchema,
  candidateUnselectSchema,
  type Ability,
  type CandidateList,
  type CandidateProposed,
  type CandidateRow,
  type CandidateSearch,
  type CandidateSearchItem,
  type CandidateStatus,
  type LotOption,
} from '@dp/contracts';
import type { Request } from 'express';
import { stampBy, type Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { TasksService } from '../automation/tasks.service.js';
import { clientName, maskName, staffName, StaffViews, type StaffView } from '../back-office/staff-view.js';
import { CatalogueIndex, type IndexedProperty } from '../catalogue/catalogue-index.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { cancelUpcomingVisitsOfCandidate } from '../tasks-admin/appointment-ops.js';
import { advisorLabel, clientLine, emitCandidate, eventActor, lockDossier, type DossierRow } from './dossier-core.js';
import { DossierReadService } from './dossier-read.service.js';
import { CAN_BECOME, isGone, isLive, retainRefusal, stageIndex } from './dossier-rules.js';
import { PropertyCards, lotOption } from './property-cards.js';

const SEARCH_PAGE = 12;
const SUGGESTIONS = 5;

type CandidateRowDb = Prisma.DossierCandidateGetPayload<{ include: { proposedBy: { select: { firstName: true; lastName: true; status: true } }; lot: { select: { id: true; reference: true; floor: true; surfaceM2: true; price: true; status: true } } } }>;

const amount = (v: unknown): number | null => {
  if (typeof v === 'string' && v) return Number(v);
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'amount' in v) return Number((v as { amount: unknown }).amount);
  return null;
};

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly views: StaffViews,
    private readonly outbox: OutboxWriter,
    private readonly tasks: TasksService,
    private readonly idempotency: IdempotencyService,
    private readonly index: CatalogueIndex,
    private readonly cards: PropertyCards,
    private readonly read: DossierReadService,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  // ─── The tab « Biens » ────────────────────────────────────────────────────

  /** `GET /admin/dossiers/{id}/candidates` (`dossier.read`). */
  async list(auth: AuthContext, id: string): Promise<CandidateList> {
    const staff = await this.views.of(auth);
    const { id: dossierId } = await this.read.visible(staff, id);
    const d = await this.prisma.dossier.findUniqueOrThrow({ where: { id: dossierId }, include: { client: { select: { firstName: true, lastName: true, email: true, userId: true } } } });
    const now = this.clock.now();
    const rows = await this.prisma.dossierCandidate.findMany({
      where: { dossierId },
      orderBy: [{ statusChangedAt: 'desc' }, { id: 'asc' }],
      include: { proposedBy: { select: { firstName: true, lastName: true, status: true } }, lot: { select: { id: true, reference: true, floor: true, surfaceM2: true, price: true, status: true } } },
    });
    const ids = rows.map((r) => r.propertyId);
    const [cards, props, online, visits, lots] = await Promise.all([
      this.cards.cards(ids),
      this.cards.rows(ids),
      this.cards.onlineIds(),
      this.prisma.appointment.findMany({ where: { candidateId: { in: rows.map((r) => r.id) }, status: 'CONFIRMED', startsAt: { gt: now } }, orderBy: { startsAt: 'asc' }, select: { candidateId: true, startsAt: true } }),
      d.propertyId ? this.cards.lots(d.propertyId, true) : Promise.resolve([]),
    ]);
    const canManage = staff.has('candidate.manage');
    const reserved = (await this.prisma.reservation.count({ where: { dossierId, status: { in: ['OPTION', 'RESERVED'] } } })) > 0;
    const data: CandidateRow[] = [];
    for (const r of rows) {
      const card = cards.get(r.propertyId);
      const p = props.get(r.propertyId);
      if (!card || !p) continue;
      data.push(this.row(r, card, this.cards.state(p, online), d, staff, canManage, reserved, visits.find((v) => v.candidateId === r.id)?.startsAt ?? null));
    }
    const finished = !isLive(d.status);
    return {
      data,
      drafts: rows.filter((r) => r.origin === 'ADVISOR_PROPOSAL' && r.sentAt === null).length,
      lots,
      client: { name: staff.masked ? maskName(d.client.firstName, d.client.lastName) : clientName(d.client), hasEmail: Boolean(d.client.email), hasAccount: Boolean(d.client.userId) },
      canPropose: !canManage ? false : finished ? { reason: 'DOSSIER_CLOSED' } : !d.assignedAgentId ? { reason: 'AGENT_NOT_ASSIGNED' } : true,
    };
  }

  private row(
    r: CandidateRowDb,
    card: CandidateRow['property'],
    state: ReturnType<PropertyCards['state']>,
    d: Pick<DossierRow, 'stage' | 'status' | 'propertyId' | 'assignedAgentId'>,
    staff: StaffView,
    canManage: boolean,
    reserved: boolean,
    visitAt: Date | null,
  ): CandidateRow {
    const live = isLive(d.status);
    const gate = (ok: boolean, reason: string): Ability => (!canManage ? false : !live ? { reason: 'DOSSIER_CLOSED' } : ok ? true : { reason });
    const status = r.status as CandidateStatus;
    const refusal = retainRefusal(state);
    const early = stageIndex(d.stage) < stageIndex('DOCUMENTS');
    const draft = r.origin === 'ADVISOR_PROPOSAL' && r.sentAt === null;
    const retained = status === 'SELECTED';
    return {
      id: r.id,
      version: r.version,
      origin: r.origin,
      status,
      statusChangedAt: r.statusChangedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      proposedBy: staffName(r.proposedBy),
      sentAt: r.sentAt?.toISOString() ?? null,
      viewedAt: r.viewedAt?.toISOString() ?? null,
      message: r.message,
      property: card,
      preferredLot: r.lot ? lotOption(r.lot, card.priceFrom?.currency ?? '') : null,
      clientComment: staff.masked ? null : r.clientComment,
      declineReason: r.declineReason,
      declineNote: staff.masked ? null : r.declineNote,
      advisorNote: staff.masked ? null : r.advisorNote,
      selectionRequestedAt: retained ? null : (r.selectionRequestedAt?.toISOString() ?? null),
      selectionDeclineNote: r.selectionDeclineNote,
      visitAt: visitAt?.toISOString() ?? null,
      retained,
      can: {
        setInterested: gate(!draft && (CAN_BECOME.INTERESTED_BY_STAFF as readonly string[]).includes(status) && !(status === 'UNAVAILABLE' && isGone(state)), 'TRANSITION_NOT_ALLOWED'),
        decline: gate(!draft && (CAN_BECOME.DECLINED as readonly string[]).includes(status), 'TRANSITION_NOT_ALLOWED'),
        select: retained ? false : gate(!draft && (CAN_BECOME.SELECTED_BY_STAFF as readonly string[]).includes(status) && refusal === null && early && !reserved, !early ? 'STAGE_NOT_DELIVERED' : reserved ? 'DOSSIER_HAS_RESERVATION' : (refusal ?? 'TRANSITION_NOT_ALLOWED')),
        unselect: retained ? gate(early && !reserved, reserved ? 'DOSSIER_HAS_RESERVATION' : 'TRANSITION_NOT_ALLOWED') : false,
        confirmSelection: r.selectionRequestedAt && !retained ? gate(refusal === null && early && !reserved, refusal ?? (reserved ? 'DOSSIER_HAS_RESERVATION' : 'STAGE_NOT_DELIVERED')) : false,
        declineSelection: r.selectionRequestedAt && !retained ? gate(true, '') : false,
        deleteDraft: draft ? gate(true, '') : false,
        planVisit: !staff.has('appointment.manage') || draft ? false : !live ? { reason: 'DOSSIER_CLOSED' } : ['DECLINED', 'UNAVAILABLE'].includes(status) ? { reason: 'TRANSITION_NOT_ALLOWED' } : true,
        chooseLot: retained && staff.has('dossier.update') ? (live ? (reserved ? { reason: 'DOSSIER_HAS_RESERVATION' } : true) : { reason: 'DOSSIER_CLOSED' }) : false,
      },
    };
  }

  /** `GET …/candidates/{cid}/lots` (`dossier.read`) — the AVAILABLE lots of a considered property (CYC-071 window). */
  async lots(auth: AuthContext, id: string, cid: string): Promise<{ data: LotOption[] }> {
    const staff = await this.views.of(auth);
    const { id: dossierId } = await this.read.visible(staff, id);
    const c = await this.prisma.dossierCandidate.findFirst({ where: { id: cid, dossierId }, select: { propertyId: true } });
    if (!c) throw AppError.notFound();
    return { data: await this.cards.lots(c.propertyId, true) };
  }

  // ─── The proposal panel (PIP-031, PIP-032) ────────────────────────────────

  /** `GET /admin/dossiers/{id}/candidates/search` (`candidate.manage`). */
  async search(auth: AuthContext, id: string, rawQuery: unknown): Promise<CandidateSearch> {
    const staff = await this.views.of(auth);
    const parsed = candidateSearchQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    const q = parsed.data;
    const { id: dossierId, clientId } = await this.read.visible(staff, id);
    const [client, simulation, existing, rows, currency] = await Promise.all([
      this.prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { preferredRegionIds: true, preferredTypes: true, minRooms: true, budgetMax: true, budgetCurrency: true } }),
      this.prisma.simulation.findFirst({ where: { clientId, type: 'ELIGIBILITY' }, orderBy: { createdAt: 'desc' }, select: { outputs: true } }),
      this.prisma.dossierCandidate.findMany({ where: { dossierId }, select: { id: true, propertyId: true, status: true, sentAt: true, origin: true, property: { select: { title: true, reference: true } } } }),
      this.index.rows(),
      this.settings.get('display.referenceCurrency'),
    ]);
    const already = new Map(existing.map((e) => [e.propertyId, e.status as CandidateStatus]));
    // PIP-031 — prefilled from the project: regions and types wished, rooms, budget; with an eligibility simulation, its
    // maximal budget in the reference currency (`maxBudgetRef`).
    const simBudget = amount((simulation?.outputs as Record<string, unknown> | null)?.maxBudgetRef);
    const ownBudget = client.budgetMax && client.budgetCurrency === currency ? Number(client.budgetMax) : null;
    const criteria = q.explicit
      ? { regionId: q.regionId ?? null, type: q.type, minRooms: q.minRooms ?? null, maxPrice: q.maxPrice ?? null, currency }
      : {
          regionId: q.regionId ?? client.preferredRegionIds[0] ?? null,
          type: q.type.length ? q.type : [...client.preferredTypes],
          minRooms: q.minRooms ?? client.minRooms ?? null,
          maxPrice: q.maxPrice ?? simBudget ?? ownBudget,
          currency,
        };
    const term = q.q ? q.q.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() : null;
    const available = rows.filter((r) => r.availability === 'AVAILABLE');
    const matches = (r: IndexedProperty) =>
      (!criteria.regionId || r.region.id === criteria.regionId) &&
      (!criteria.type.length || criteria.type.includes(r.type)) &&
      (!criteria.minRooms || (r.rooms ?? 0) >= criteria.minRooms) &&
      (!criteria.maxPrice || (r.priceFromRef !== null && r.priceFromRef <= criteria.maxPrice)) &&
      (!term || `${r.reference} ${r.title} ${r.city?.name ?? ''} ${r.region.name} ${r.program?.name ?? ''}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().includes(term));
    const found = available.filter(matches).sort((a, b) => b.relevanceScore - a.relevanceScore || a.reference.localeCompare(b.reference));
    // PIP-032 — the five most relevant for this project, among those not yet considered (CAL-080).
    const suggested = found.filter((r) => !already.has(r.id)).slice(0, SUGGESTIONS);
    const page = found.slice((q.page - 1) * SEARCH_PAGE, q.page * SEARCH_PAGE);
    const cards = await this.cards.cards([...suggested, ...page].map((r) => r.id));
    const item = (r: IndexedProperty): CandidateSearchItem | null => {
      const card = cards.get(r.id);
      return card ? { ...card, rooms: r.rooms, surfaceMin: r.surfaceMin === null ? null : r.surfaceMin.toFixed(2), already: already.get(r.id) ?? null } : null;
    };
    const regions = new Map<string, string>();
    for (const r of rows) regions.set(r.region.id, r.region.name);
    return {
      criteria,
      regions: [...regions.entries()].map(([rid, name]) => ({ id: rid, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      suggestions: suggested.map(item).filter((x): x is CandidateSearchItem => x !== null),
      data: page.map(item).filter((x): x is CandidateSearchItem => x !== null),
      meta: { page: q.page, pageSize: SEARCH_PAGE, total: found.length, totalPages: Math.max(1, Math.ceil(found.length / SEARCH_PAGE)) },
      drafts: existing.filter((e) => e.origin === 'ADVISOR_PROPOSAL' && e.sentAt === null).map((e) => ({ id: e.id, title: e.property.title, reference: e.property.reference })),
    };
  }

  // ─── Writes ───────────────────────────────────────────────────────────────

  private async act<T>(auth: AuthContext, id: string, fn: (tx: Tx, c: { staff: StaffView; actor: Actor; now: Date; d: DossierRow }) => Promise<T>): Promise<T> {
    const staff = await this.views.of(auth);
    await this.read.visible(staff, id);
    const now = this.clock.now();
    const out = await this.prisma.$transaction(async (tx) => fn(tx, { staff, actor: auth.actor, now, d: await lockDossier(tx, id) }), { timeout: 30_000 });
    this.dispatcher.wake();
    return out;
  }

  private assertLive(d: DossierRow): void {
    if (!isLive(d.status)) throw AppError.conflictState('DOSSIER_CLOSED');
  }

  private async candidate(tx: Tx, d: DossierRow, cid: string) {
    const c = await tx.dossierCandidate.findFirst({ where: { id: cid, dossierId: d.id }, include: { property: { select: { title: true } } } });
    if (!c) throw AppError.notFound();
    return c;
  }

  /** The row as the tab shows it, after a change. */
  private async rowOf(auth: AuthContext, id: string, cid: string): Promise<CandidateRow> {
    const list = await this.list(auth, id);
    const row = list.data.find((r) => r.id === cid);
    if (!row) throw AppError.notFound();
    return row;
  }

  /** One audit row per change of a considered property (SEC-080 `candidate.status_changed`); the timeline reads it (BO-050). */
  private async audit(tx: Tx, actor: Actor, now: Date, c: { id: string; status: string; property: { title: string } }, d: DossierRow, after: Record<string, unknown>, reason: string | null = null): Promise<void> {
    await writeAudit(tx, actor, now, { action: 'candidate.status_changed', entityType: 'DossierCandidate', entityId: c.id, entityLabel: c.property.title, before: { status: c.status }, after, clientId: d.clientId, dossierId: d.id, reason });
  }

  /** `POST …/candidates/propose` (`candidate.manage`) — PIP-031. One sending: every proposal in preparation leaves with it. */
  async propose(auth: AuthContext, req: Request, id: string, body: unknown): Promise<{ status: number; body: CandidateProposed }> {
    const input = parseOrThrow(candidateProposeSchema, body);
    const staff = await this.views.of(auth);
    await this.read.visible(staff, id);
    const online = new Map((await this.index.rows()).map((r) => [r.id, r]));
    for (const pid of input.propertyIds) {
      const p = online.get(pid);
      // « Seuls les biens publiés et disponibles (disponibilité AVAILABLE) sont proposés. »
      if (!p || p.availability !== 'AVAILABLE') throw AppError.validation([{ field: 'propertyIds', code: 'INVALID_CHOICE' }]);
    }
    const result = await this.idempotency.run<void, CandidateProposed>(req, { route: 'admin.candidates.propose', userId: auth.userId, required: false }, {
      status: 200,
      execute: async (tx) => {
        const now = this.clock.now();
        const actor = auth.actor;
        const d = await lockDossier(tx, id);
        this.assertLive(d);
        if (!d.assignedAgentId) throw AppError.conflictState('AGENT_NOT_ASSIGNED');
        const existing = new Set((await tx.dossierCandidate.findMany({ where: { dossierId: d.id }, select: { propertyId: true } })).map((c) => c.propertyId));
        let added = 0;
        for (const pid of input.propertyIds) {
          if (existing.has(pid)) continue; // already considered: marked in the panel, never twice (unique per dossier)
          const cid = newId();
          await tx.dossierCandidate.create({ data: { id: cid, dossierId: d.id, propertyId: pid, origin: 'ADVISOR_PROPOSAL', proposedById: stampBy(actor), status: 'PROPOSED', statusChangedAt: now, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
          await this.audit(tx, actor, now, { id: cid, status: 'NONE', property: { title: online.get(pid)!.title } }, d, { status: 'PROPOSED', event: 'drafted' });
          added++;
        }
        let sent = 0;
        if (input.send) {
          const drafts = await tx.dossierCandidate.findMany({ where: { dossierId: d.id, origin: 'ADVISOR_PROPOSAL', sentAt: null, status: 'PROPOSED' }, include: { property: { select: { title: true } } } });
          if (!drafts.length) throw AppError.validation([{ field: 'propertyIds', code: 'REQUIRED' }]);
          const first = (await tx.dossierCandidate.count({ where: { dossierId: d.id, origin: 'ADVISOR_PROPOSAL', sentAt: { not: null } } })) === 0;
          await tx.dossierCandidate.updateMany({ where: { id: { in: drafts.map((x) => x.id) } }, data: { sentAt: now, message: input.message, proposedById: stampBy(actor), version: { increment: 1 }, updatedAt: now } });
          await tx.dossier.update({ where: { id: d.id }, data: { lastActivityAt: now } });
          await writeAudit(tx, actor, now, { action: 'candidate.status_changed', entityType: 'Dossier', entityId: d.id, entityLabel: d.reference, after: { event: 'sent', count: drafts.length }, clientId: d.clientId, dossierId: d.id });
          await clientLine(tx, d.id, 'PROPERTIES_PROPOSED', { conseiller: await advisorLabel(tx, d.assignedAgentId), n: drafts.length }, now);
          // AUT-043, NOT-035 — one sending, one event (and one notification, one e-mail), whatever the number of properties.
          await this.outbox.add(tx, { type: 'candidate.proposed', aggregateType: 'Dossier', aggregateId: d.id, payload: { type: 'candidate.proposed', actor: eventActor(actor), aggregate: { type: 'Dossier', id: d.id }, clientId: d.clientId, dossierId: d.id, data: { candidateIds: drafts.map((x) => x.id), isFirstOfDossier: first } } }, now);
          sent = drafts.length;
        }
        const client = await tx.client.findUniqueOrThrow({ where: { id: d.clientId }, select: { email: true } });
        return { added, sent, clientHasEmail: Boolean(client.email) };
      },
    });
    this.dispatcher.wake();
    return { status: result.status, body: result.body };
  }

  /** `POST …/candidates/{cid}/set-status` (`candidate.manage`) — PIP-033: « Intéressé », « Écarté » (with the reason), in the client's name. */
  async setStatus(auth: AuthContext, id: string, cid: string, body: unknown): Promise<CandidateRow> {
    const input = parseOrThrow(candidateSetStatusSchema, body);
    await this.act(auth, id, async (tx, { actor, now, d }) => {
      this.assertLive(d);
      const c = await this.candidate(tx, d, cid);
      if (c.origin === 'ADVISOR_PROPOSAL' && c.sentAt === null) throw AppError.conflictState('TRANSITION_NOT_ALLOWED'); // a draft is deleted, not answered
      if (input.status === 'INTERESTED') {
        if (!(CAN_BECOME.INTERESTED_BY_STAFF as readonly string[]).includes(c.status)) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
        if (c.status === 'UNAVAILABLE') {
          // CYC-073 — « remis par le conseiller » once the property is available again.
          const p = (await this.cards.rows([c.propertyId], tx)).get(c.propertyId);
          if (!p || isGone(p)) throw AppError.conflictState('PROPERTY_NOT_AVAILABLE');
        }
        await tx.dossierCandidate.update({ where: { id: c.id }, data: { status: 'INTERESTED', statusChangedAt: now, viewedAt: c.viewedAt ?? now, declineReason: null, declineNote: null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
        await this.audit(tx, actor, now, c, d, { status: 'INTERESTED', event: 'interested' });
        await emitCandidate(tx, this.outbox, c, d.clientId, 'candidate.interested', eventActor(actor), now, { by: 'STAFF' });
      } else {
        if (!(CAN_BECOME.DECLINED as readonly string[]).includes(c.status)) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
        await cancelUpcomingVisitsOfCandidate(tx, this.outbox, { candidateId: c.id, by: 'STAFF', actor, now });
        await tx.dossierCandidate.update({ where: { id: c.id }, data: { status: 'DECLINED', statusChangedAt: now, viewedAt: c.viewedAt ?? now, declineReason: input.declineReason, declineNote: input.declineNote, selectionRequestedAt: null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
        await this.audit(tx, actor, now, c, d, { status: 'DECLINED', event: 'declined', declineReason: input.declineReason });
        await emitCandidate(tx, this.outbox, c, d.clientId, 'candidate.declined', eventActor(actor), now, { by: 'STAFF', declineReason: input.declineReason });
      }
    });
    return this.rowOf(auth, id, cid);
  }

  /** `PATCH …/candidates/{cid}` (`candidate.manage`) — the internal note of the adviser. */
  async note(auth: AuthContext, id: string, cid: string, body: unknown): Promise<CandidateRow> {
    const input = parseOrThrow(candidateNoteSchema, body);
    await this.act(auth, id, async (tx, { actor, now, d }) => {
      const c = await this.candidate(tx, d, cid);
      await tx.dossierCandidate.update({ where: { id: c.id }, data: { advisorNote: input.advisorNote || null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'dossier_candidate.updated', entityType: 'DossierCandidate', entityId: c.id, entityLabel: c.property.title, after: { advisorNote: '[modifié]' }, clientId: d.clientId, dossierId: d.id });
    });
    return this.rowOf(auth, id, cid);
  }

  /** `DELETE …/candidates/{cid}` (`candidate.manage`) — a proposal in preparation; a sent proposal is never deleted. */
  async deleteDraft(auth: AuthContext, id: string, cid: string): Promise<void> {
    await this.act(auth, id, async (tx, { actor, now, d }) => {
      const c = await this.candidate(tx, d, cid);
      if (c.origin !== 'ADVISOR_PROPOSAL' || c.sentAt !== null) throw AppError.conflictState('CANDIDATE_ALREADY_SENT');
      await tx.dossierCandidate.delete({ where: { id: c.id } });
      await writeAudit(tx, actor, now, { action: 'dossier_candidate.deleted', entityType: 'DossierCandidate', entityId: c.id, entityLabel: c.property.title, before: { status: c.status }, clientId: d.clientId, dossierId: d.id });
    });
  }

  /**
   * CYC-071 — retaining a property (`select` by the adviser, or `confirm-selection` of the client's choice). The lot: the
   * one chosen in the window, else — when the client's choice is confirmed — his preferred lot if still AVAILABLE.
   */
  private async retain(tx: Tx, actor: Actor, now: Date, d: DossierRow, cid: string, lotId: string | null, confirming: boolean): Promise<void> {
    this.assertLive(d);
    if (stageIndex(d.stage) >= stageIndex('DOCUMENTS')) throw AppError.conflictState('STAGE_NOT_DELIVERED'); // CYC-072: Lot 4
    const c = await this.candidate(tx, d, cid);
    if (confirming && !c.selectionRequestedAt) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (c.status === 'SELECTED') return;
    if (c.origin === 'ADVISOR_PROPOSAL' && c.sentAt === null) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (!(CAN_BECOME.SELECTED_BY_STAFF as readonly string[]).includes(c.status)) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (await tx.reservation.count({ where: { dossierId: d.id, status: { in: ['OPTION', 'RESERVED'] } } })) throw AppError.conflictState('DOSSIER_HAS_RESERVATION');
    const p = await tx.property.findUniqueOrThrow({ where: { id: c.propertyId }, select: { id: true, title: true, programId: true, promoterId: true, countryCode: true, priceFrom: true, priceCurrency: true, publication: true, deletedAt: true, archivedAt: true, availability: true, lotsAvailable: true } });
    const refusal = retainRefusal(this.cards.state(p, await this.cards.onlineIds()));
    if (refusal) throw AppError.conflictState(refusal);
    let lot: { id: string; reference: string; price: Prisma.Decimal } | null = null;
    if (lotId) {
      const l = await tx.lot.findFirst({ where: { id: lotId, propertyId: p.id, deletedAt: null }, select: { id: true, reference: true, price: true, status: true } });
      if (!l) throw AppError.validation([{ field: 'lotId', code: 'INVALID_CHOICE' }]);
      if (l.status !== 'AVAILABLE') throw AppError.conflictState('LOT_NOT_AVAILABLE');
      lot = l;
    } else if (confirming && c.lotId) {
      const l = await tx.lot.findFirst({ where: { id: c.lotId, deletedAt: null, status: 'AVAILABLE' }, select: { id: true, reference: true, price: true } });
      lot = l;
    }
    // A single retained property: the former one goes back to « Intéressé ».
    const previous = await tx.dossierCandidate.findFirst({ where: { dossierId: d.id, status: 'SELECTED', id: { not: c.id } }, include: { property: { select: { title: true } } } });
    if (previous) {
      await tx.dossierCandidate.update({ where: { id: previous.id }, data: { status: 'INTERESTED', statusChangedAt: now, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await this.audit(tx, actor, now, previous, d, { status: 'INTERESTED', event: 'interested' });
    }
    await tx.dossierCandidate.update({ where: { id: c.id }, data: { status: 'SELECTED', statusChangedAt: now, viewedAt: c.viewedAt ?? now, selectionRequestedAt: null, selectionDeclineNote: null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
    const price = lot?.price ?? p.priceFrom;
    const loan = price && d.downPayment && d.downPaymentCurrency === p.priceCurrency && !d.loanAmountRequested ? price.minus(d.downPayment) : undefined;
    await tx.dossier.update({
      where: { id: d.id },
      data: {
        propertyId: p.id,
        programId: p.programId,
        promoterId: p.promoterId,
        propertyCountryCode: p.countryCode,
        lotId: lot?.id ?? null,
        purchasePrice: price, // MOD-313 — prefilled: the lot's price, else the « à partir de » of the property
        purchaseCurrency: p.priceCurrency,
        ...(loan && loan.greaterThan(0) ? { loanAmountRequested: loan, loanCurrency: p.priceCurrency } : {}),
        lastActivityAt: now,
        version: { increment: 1 },
        updatedById: stampBy(actor),
        updatedAt: now,
      },
    });
    await this.audit(tx, actor, now, c, d, { status: 'SELECTED', event: confirming ? 'selection_confirmed' : 'selected', lot: lot?.reference ?? null });
    await clientLine(tx, d.id, 'PROPERTY_SELECTED', { bien: p.title }, now);
    await emitCandidate(tx, this.outbox, c, d.clientId, 'candidate.selected', eventActor(actor), now);
  }

  /** `POST …/candidates/{cid}/select` (`candidate.manage`). */
  async select(auth: AuthContext, id: string, cid: string, body: unknown): Promise<CandidateRow> {
    const { lotId } = parseOrThrow(candidateSelectSchema, body);
    await this.act(auth, id, (tx, { actor, now, d }) => this.retain(tx, actor, now, d, cid, lotId, false));
    return this.rowOf(auth, id, cid);
  }

  /** `POST …/candidates/{cid}/confirm-selection` (`candidate.manage`) — PIP-030 « Confirmer ». */
  async confirmSelection(auth: AuthContext, id: string, cid: string, body: unknown): Promise<CandidateRow> {
    const { lotId } = parseOrThrow(candidateSelectSchema, body);
    await this.act(auth, id, (tx, { actor, now, d }) => this.retain(tx, actor, now, d, cid, lotId, true));
    return this.rowOf(auth, id, cid);
  }

  /** `POST …/candidates/{cid}/decline-selection` (`candidate.manage`) — PIP-030 « Refuser »: the reason is shown to the client. */
  async declineSelection(auth: AuthContext, id: string, cid: string, body: unknown): Promise<CandidateRow> {
    const { reason } = parseOrThrow(candidateDeclineSelectionSchema, body);
    await this.act(auth, id, async (tx, { actor, now, d }) => {
      this.assertLive(d);
      const c = await this.candidate(tx, d, cid);
      if (!c.selectionRequestedAt || c.status === 'SELECTED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      await tx.dossierCandidate.update({ where: { id: c.id }, data: { selectionRequestedAt: null, selectionDeclineNote: reason, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await this.audit(tx, actor, now, c, d, { status: c.status, event: 'selection_declined' }, reason);
      await clientLine(tx, d.id, 'SELECTION_DECLINED', { conseiller: await advisorLabel(tx, d.assignedAgentId), bien: c.property.title, raison: reason }, now);
      await emitCandidate(tx, this.outbox, c, d.clientId, 'candidate.selection_declined', eventActor(actor), now);
    });
    return this.rowOf(auth, id, cid);
  }

  /** `POST …/candidates/{cid}/unselect` (`candidate.manage`) — CYC-242: before DOCUMENTS only, never with an active option. */
  async unselect(auth: AuthContext, id: string, cid: string, body: unknown): Promise<CandidateRow> {
    const { reason } = parseOrThrow(candidateUnselectSchema, body);
    await this.act(auth, id, async (tx, { actor, now, d }) => {
      this.assertLive(d);
      const c = await this.candidate(tx, d, cid);
      if (c.status !== 'SELECTED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      if (stageIndex(d.stage) >= stageIndex('DOCUMENTS')) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      if (await tx.reservation.count({ where: { dossierId: d.id, status: { in: ['OPTION', 'RESERVED'] } } })) throw AppError.conflictState('DOSSIER_HAS_RESERVATION');
      const client = await tx.client.findUniqueOrThrow({ where: { id: d.clientId }, select: { preferredCountries: true } });
      await tx.dossierCandidate.update({ where: { id: c.id }, data: { status: 'INTERESTED', statusChangedAt: now, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await tx.dossier.update({
        where: { id: d.id },
        data: { propertyId: null, lotId: null, programId: null, promoterId: null, purchasePrice: null, purchaseCurrency: null, propertyCountryCode: client.preferredCountries[0] ?? null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      await this.audit(tx, actor, now, c, d, { status: 'INTERESTED', event: 'unselected' }, reason);
      await clientLine(tx, d.id, 'SELECTION_WITHDRAWN', { bien: c.property.title }, now);
      await emitCandidate(tx, this.outbox, c, d.clientId, 'candidate.unselected', eventActor(actor), now);
    });
    return this.rowOf(auth, id, cid);
  }

  /** The auto-closing of `selection:{candidateId}` when the client withdraws his choice (no event in AUT-010 for it). */
  async closeSelectionTask(tx: Tx, candidateId: string, now: Date, reason: string): Promise<void> {
    await this.tasks.closeAutomatically(tx, now, [`selection:${candidateId}`], 'CANCELLED', reason);
  }
}
