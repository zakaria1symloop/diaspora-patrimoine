// EA-21, EA-22 in reading — 04-back-office/06: PIP-010 (the list), PIP-015 (pickers of the creation), PIP-020 …
// PIP-026 (the record: header, frieze, « Ce qu'il manque », overview), PIP-060 (history), PIP-080 / PIP-081 (what the
// pause and closing windows announce), CRM-050 (state of the qualification), BO-050 (timeline of a dossier).
// What the reader may see is decided here: the adviser's perimeter IN THE QUERY (ROL-018, SEC-031), the SUPPORT masking
// (ROL-015, SEC-032) and the sensitive amounts (ROL-019, SEC-033) — a value the reader may not read never leaves.
import { Injectable } from '@nestjs/common';
import {
  DOSSIER_VIEWS,
  SIMULATOR_CURRENCIES,
  ErrorCode,
  TIMELINE_TYPES,
  dossierListQuerySchema,
  grantOf,
  type Ability,
  type AdminDossierList,
  type AdminDossierListItem,
  type AdminDossierView,
  type AdminTimelineEntry,
  type AdminTimelinePage,
  type AgentPick,
  type AuditRow,
  type ClientPick,
  type DossierBannerItem,
  type DossierDetail,
  type DossierEffects,
  type DossierHistory,
  type DossierNext,
  type PropertyPick,
  type QualificationState,
  type StageHistoryRow,
  type TimelineType,
  type TransitionCondition,
} from '@dp/contracts';
import { localDate, type BusinessCalendar } from '@dp/domain';
import { callbackLabel, createTranslator, hasMessage, type CallbackSlot, type MessageKey } from '@dp/i18n';
import { clientName, dossierScope, clientScope, maskEmail, maskName, maskPhone, staffName, StaffViews, type StaffView } from '../back-office/staff-view.js';
import { DossierViews } from '../client-space/dossier-view.js';
import { advisorDisplayName } from '../client-space/timeline.js';
import { COMMUNICATION_ENTRY_SELECT, communicationEntries } from '../crm/communication-entries.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { loadAdvisors } from '../leads/assignment.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { upcomingAppointmentsOfDossier } from '../tasks-admin/appointment-ops.js';
import {
  buildFileConditions,
  daysInStage,
  deletable,
  friezeOf,
  isFinished,
  isGone,
  isLive,
  mainAction,
  moveBackTarget,
  nextOf,
  qualificationConditions,
  slaOf,
  stageIndex,
  type NextFacts,
} from './dossier-rules.js';
import { PropertyCards, lotOption } from './property-cards.js';

const t = createTranslator('fr');
/** API-002 — the values of a timeline sentence go out already in words (enumerations rendered by the server). */
const label = (name: string, v: string | null | undefined): string | null => (v ? (hasMessage(`ui.enum.${name}.${v}`) ? t(`ui.enum.${name}.${v}` as MessageKey) : v) : null);
const reasonLabel = (code: string | null): string | null => (code ? (label('HoldReason', code) !== code ? label('HoldReason', code) : label('LostReason', code)) : null);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;
const PAGE = 20;
const LIVE: ('OPEN' | 'ON_HOLD')[] = ['OPEN', 'ON_HOLD'];

const LIST_SELECT = {
  id: true,
  reference: true,
  clientId: true,
  stage: true,
  status: true,
  priority: true,
  assignedAgentId: true,
  financingRequested: true,
  completenessPct: true,
  checklistInstantiatedAt: true,
  stageEnteredAt: true,
  slaDueAt: true,
  lastActivityAt: true,
  firstContactAt: true,
  holdUntil: true,
  createdAt: true,
  client: { select: { id: true, firstName: true, lastName: true, doNotContact: true } },
  property: { select: { reference: true, title: true } },
  promoter: { select: { brandName: true, legalName: true } },
  assignedAgent: { select: { id: true, firstName: true, lastName: true, status: true } },
} satisfies Prisma.DossierSelect;
type ListRow = Prisma.DossierGetPayload<{ select: typeof LIST_SELECT }>;

type CandidateFacts = NextFacts['candidates'];
const NO_CANDIDATES: CandidateFacts = { live: 0, drafts: 0, waitingAnswer: 0, selectionRequested: null, selected: null, interested: 0, nextVisit: null };

function fold(q: string): string {
  return q.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** `WAITING_CLIENT — note` (MOD § 2.3): the code of a hold or lost reason, then its note. */
export function splitReason(reason: string | null): { code: string | null; text: string | null } {
  if (!reason) return { code: null, text: null };
  const m = /^([A-Z][A-Z_]+)(?: — ([\s\S]*))?$/.exec(reason);
  return m ? { code: m[1]!, text: m[2] ?? null } : { code: null, text: reason };
}

@Injectable()
export class DossierReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly views: StaffViews,
    private readonly cards: PropertyCards,
    private readonly clientViews: DossierViews,
  ) {}

  // ─── Shared reads ─────────────────────────────────────────────────────────

  /** The id of a dossier the reader may see (ROL-018); 404 otherwise (BO-015). */
  async visible(staff: StaffView, id: string): Promise<{ id: string; reference: string; clientId: string }> {
    if (!UUID.test(id)) throw AppError.notFound();
    const d = await this.prisma.dossier.findFirst({ where: { AND: [{ id, deletedAt: null }, dossierScope(staff)] }, select: { id: true, reference: true, clientId: true } });
    if (!d) throw AppError.notFound();
    return d;
  }

  /** What the considered properties of each dossier need — for « ce que le dossier attend » (`next`). */
  async candidateFacts(dossierIds: readonly string[], now: Date): Promise<Map<string, CandidateFacts>> {
    const out = new Map<string, CandidateFacts>();
    if (!dossierIds.length) return out;
    const [candidates, visits] = await Promise.all([
      this.prisma.dossierCandidate.findMany({
        where: { dossierId: { in: [...dossierIds] } },
        select: { id: true, dossierId: true, status: true, origin: true, sentAt: true, selectionRequestedAt: true, property: { select: { title: true } } },
      }),
      this.prisma.appointment.findMany({
        where: { dossierId: { in: [...dossierIds] }, status: 'CONFIRMED', startsAt: { gt: now }, candidateId: { not: null } },
        orderBy: { startsAt: 'asc' },
        select: { dossierId: true, startsAt: true, candidate: { select: { property: { select: { title: true } } } } },
      }),
    ]);
    for (const c of candidates) {
      const f = out.get(c.dossierId) ?? { ...NO_CANDIDATES };
      const draft = c.origin === 'ADVISOR_PROPOSAL' && c.sentAt === null && c.status === 'PROPOSED';
      if (draft) f.drafts++;
      else if (c.status === 'PROPOSED' || c.status === 'VIEWED') f.waitingAnswer++;
      if (c.status !== 'DECLINED' && c.status !== 'UNAVAILABLE') f.live++;
      if (['INTERESTED', 'VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED'].includes(c.status)) f.interested++;
      if (c.status === 'SELECTED') f.selected = { title: c.property.title };
      if (c.selectionRequestedAt && c.status !== 'SELECTED') f.selectionRequested = { title: c.property.title };
      out.set(c.dossierId, f);
    }
    for (const v of visits) {
      if (!v.dossierId) continue;
      const f = out.get(v.dossierId) ?? { ...NO_CANDIDATES };
      f.nextVisit ??= { at: v.startsAt!, title: v.candidate?.property.title ?? '' };
      out.set(v.dossierId, f);
    }
    return out;
  }

  // ─── The list (EA-21, PIP-010) ────────────────────────────────────────────

  private viewWhere(view: AdminDossierView, staff: StaffView, now: Date, inactivityDays: number): Prisma.DossierWhereInput {
    switch (view) {
      case 'mine':
        return { assignedAgentId: staff.userId, status: { in: LIVE } };
      case 'late':
        return { status: 'OPEN', slaDueAt: { lt: now } };
      case 'on-hold':
        return { status: 'ON_HOLD' };
      case 'inactive':
        return { status: 'OPEN', lastActivityAt: { lt: new Date(now.getTime() - inactivityDays * DAY) } };
      case 'lost':
        return { status: 'LOST' };
      default:
        return {};
    }
  }

  private async clientIdsMatching(q: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM clients c
      WHERE c.deleted_at IS NULL AND (
        c.search_text LIKE '%' || lower(public.f_unaccent(${q})) || '%'
        OR word_similarity(lower(public.f_unaccent(${q})), c.search_text) >= 0.6
      )
      LIMIT 500`;
    return rows.map((r) => r.id);
  }

  private item(row: ListRow, staff: StaffView, now: Date, cal: BusinessCalendar, inactivityDays: number, facts: CandidateFacts | undefined, overdueTasks: number): AdminDossierListItem {
    return {
      id: row.id,
      reference: row.reference,
      client: { id: row.client.id, name: staff.masked ? maskName(row.client.firstName, row.client.lastName) : clientName(row.client) },
      property: row.property,
      promoterName: row.promoter ? (row.promoter.brandName ?? row.promoter.legalName) : null,
      stage: row.stage,
      status: row.status,
      priority: row.priority,
      agent: row.assignedAgent ? { id: row.assignedAgent.id, name: staffName(row.assignedAgent) } : null,
      mine: row.assignedAgentId === staff.userId,
      financingRequested: row.financingRequested,
      completenessPct: row.checklistInstantiatedAt ? row.completenessPct : null,
      stageEnteredAt: row.stageEnteredAt.toISOString(),
      daysInStage: daysInStage(row.stageEnteredAt, now),
      sla: slaOf(row, now, cal),
      lastActivityAt: row.lastActivityAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      next: nextOf({ stage: row.stage, status: row.status, assignedAgentId: row.assignedAgentId, firstContactAt: row.firstContactAt, holdUntil: row.holdUntil, candidates: facts ?? NO_CANDIDATES }),
      signals: {
        overdueTasks,
        doNotContact: row.client.doNotContact,
        inactive: row.status === 'OPEN' && now.getTime() - row.lastActivityAt.getTime() > inactivityDays * DAY,
      },
    };
  }

  /** `GET /admin/dossiers` (`dossier.read`). */
  async list(auth: AuthContext, rawQuery: unknown): Promise<AdminDossierList> {
    const staff = await this.views.of(auth);
    const parsed = dossierListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST); // API-011
    const query = parsed.data;
    const now = this.clock.now();
    const inactivityDays = await this.settings.get('dossier.inactivityDays');

    // API-012 — `q` on the reference and the client's name. ROL-015: a SUPPORT account searches by reference only.
    const q = query.q && query.q.length >= 2 ? query.q : null;
    let search: Prisma.DossierWhereInput = {};
    if (q) {
      const byReference: Prisma.DossierWhereInput = { reference: { contains: q, mode: 'insensitive' } };
      if (staff.masked) search = byReference;
      else {
        const clientIds = await this.clientIdsMatching(q);
        search = { OR: [byReference, ...(clientIds.length ? [{ clientId: { in: clientIds } }] : [])] };
      }
    }
    const agents = query.assignedAgentId.filter((v) => v !== 'none');
    const promoters = query.promoterId.filter((v) => v !== 'none');
    const base: Prisma.DossierWhereInput = { AND: [{ deletedAt: null }, dossierScope(staff)] };

    /** The criteria of the address, with one filter left out to count its values (TRV-106). */
    const criteria = (skip?: 'stage' | 'status' | 'priority' | 'financing'): Prisma.DossierWhereInput => ({
      AND: [
        base,
        query.view ? this.viewWhere(query.view, staff, now, inactivityDays) : {},
        search,
        skip !== 'stage' && query.stage.length ? { stage: { in: query.stage } } : {},
        skip !== 'status' && query.status.length ? { status: { in: query.status } } : {},
        skip !== 'priority' && query.priority.length ? { priority: { in: query.priority } } : {},
        skip !== 'financing' && query.financing ? { financingRequested: query.financing === 'with' } : {},
        query.assignedAgentId.length ? { OR: [...(agents.length ? [{ assignedAgentId: { in: agents } }] : []), ...(query.assignedAgentId.includes('none') ? [{ assignedAgentId: null }] : [])] } : {},
        query.promoterId.length ? { OR: [...(promoters.length ? [{ promoterId: { in: promoters } }] : []), ...(query.promoterId.includes('none') ? [{ promoterId: null }] : [])] } : {},
        query.late ? { status: 'OPEN', slaDueAt: { lt: now } } : {},
        query.clientId ? { clientId: query.clientId } : {},
        query.propertyId ? { OR: [{ propertyId: query.propertyId }, { dossierCandidates: { some: { propertyId: query.propertyId } } }] } : {},
      ],
    });

    // TRV-102 — stable sort: the id is the last criterion. A paused or finished dossier has no deadline: last.
    const desc = query.sort.startsWith('-');
    const dir = desc ? 'desc' : 'asc';
    const key = query.sort.replace(/^-/, '') as 'reference' | 'createdAt' | 'lastActivityAt' | 'slaDueAt' | 'stageEnteredAt' | 'priority' | 'stage';
    const orderBy: Prisma.DossierOrderByWithRelationInput[] =
      key === 'slaDueAt' ? [{ slaDueAt: { sort: dir, nulls: 'last' } }, { id: 'asc' }] : key === 'priority' || key === 'stage' ? [{ [key]: dir }, { lastActivityAt: 'desc' }, { id: 'asc' }] : [{ [key]: dir }, { id: dir }];

    const where = criteria();
    const [total, rows, cal, byStage, byStatus, byPriority, withFinancing, withoutFinancing, viewCounts, advisors, promoterRows] = await Promise.all([
      this.prisma.dossier.count({ where }),
      this.prisma.dossier.findMany({ where, select: LIST_SELECT, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.calendar.load(),
      this.prisma.dossier.groupBy({ by: ['stage'], where: criteria('stage'), _count: { _all: true } }),
      this.prisma.dossier.groupBy({ by: ['status'], where: criteria('status'), _count: { _all: true } }),
      this.prisma.dossier.groupBy({ by: ['priority'], where: criteria('priority'), _count: { _all: true } }),
      this.prisma.dossier.count({ where: { AND: [criteria('financing'), { financingRequested: true }] } }),
      this.prisma.dossier.count({ where: { AND: [criteria('financing'), { financingRequested: false }] } }),
      Promise.all(DOSSIER_VIEWS.map((v) => this.prisma.dossier.count({ where: { AND: [base, this.viewWhere(v, staff, now, inactivityDays)] } }))),
      this.agentRows(),
      this.prisma.promoter.findMany({ where: { deletedAt: null, dossiers: { some: { AND: [base] } } }, select: { id: true, brandName: true, legalName: true }, orderBy: { legalName: 'asc' }, take: 200 }),
    ]);

    const ids = rows.map((r) => r.id);
    const [facts, overdue] = await Promise.all([
      this.candidateFacts(ids, now),
      ids.length ? this.prisma.task.groupBy({ by: ['dossierId'], where: { dossierId: { in: ids }, status: 'OPEN', deletedAt: null, dueAt: { lt: now } }, _count: { _all: true } }) : Promise.resolve([]),
    ]);
    const overdueOf = new Map(overdue.map((o) => [o.dossierId, o._count._all]));
    const counts = (list: { _count: { _all: number } }[], keyOf: (r: never) => string) => Object.fromEntries(list.map((r) => [keyOf(r as never), r._count._all]));
    return {
      data: rows.map((r) => this.item(r, staff, now, cal, inactivityDays, facts.get(r.id), overdueOf.get(r.id) ?? 0)),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
      views: Object.fromEntries(DOSSIER_VIEWS.map((v, i) => [v, viewCounts[i]!])) as Record<AdminDossierView, number>,
      facets: {
        stage: counts(byStage, (r: { stage: string }) => r.stage),
        status: counts(byStatus, (r: { status: string }) => r.status),
        priority: counts(byPriority, (r: { priority: string }) => r.priority),
        financing: { with: withFinancing, without: withoutFinancing },
      },
      agents: advisors.map((a) => ({ id: a.id, name: a.name })),
      promoters: promoterRows.map((p) => ({ id: p.id, name: p.brandName ?? p.legalName })),
    };
  }

  /** BO-011 — the dossiers of the reader whose stage deadline has passed (badge of the menu). */
  async countLate(staff: StaffView): Promise<number> {
    return this.prisma.dossier.count({ where: { AND: [{ deletedAt: null, status: 'OPEN', slaDueAt: { lt: this.clock.now() } }, dossierScope(staff), staff.role === 'AGENT' ? { assignedAgentId: staff.userId } : {}] } });
  }

  // ─── Pickers (PIP-015, PIP-026) ───────────────────────────────────────────

  private async agentRows(): Promise<{ id: string; name: string; role: 'OWNER' | 'ADMIN' | 'AGENT'; absentUntil: Date | null }[]> {
    const advisors = await loadAdvisors(this.prisma);
    const users = await this.prisma.user.findMany({ where: { id: { in: advisors.map((a) => a.userId) } }, select: { id: true, firstName: true, lastName: true } });
    return advisors
      .map((a) => ({ id: a.userId, name: staffName(users.find((u) => u.id === a.userId)) ?? '', role: a.role, absentUntil: a.absentUntil, sortName: a.sortName }))
      .filter((a) => a.name)
      .sort((x, y) => x.sortName.localeCompare(y.sortName, 'fr'));
  }

  /** `GET /admin/dossiers/pickers/agents` — PIP-026: active accounts that hold `dossier.update`; an absence in progress is told. */
  async agents(auth: AuthContext): Promise<{ data: AgentPick[] }> {
    const cal = await this.calendar.load();
    const today = localDate(this.clock.now(), cal);
    const rows = await this.agentRows();
    return {
      data: rows.map((a) => {
        const until = a.absentUntil ? a.absentUntil.toISOString().slice(0, 10) : null;
        return { id: a.id, name: a.name, role: a.role, absentUntil: until && until >= today ? until : null, me: a.id === auth.userId };
      }),
    };
  }

  /** `GET /admin/dossiers/pickers/clients?q=` (`dossier.create`) — within the reader's perimeter; SUPPORT never reaches it. */
  async pickClients(auth: AuthContext, q: unknown): Promise<{ data: ClientPick[] }> {
    const staff = await this.views.of(auth);
    const term = typeof q === 'string' ? q.trim().slice(0, 120) : '';
    const ids = term.length >= 2 ? await this.clientIdsMatching(term) : null;
    if (ids && !ids.length) return { data: [] };
    const rows = await this.prisma.client.findMany({
      where: { AND: [{ deletedAt: null, mergedIntoId: null, gdprErasedAt: null, archivedAt: null }, clientScope(staff), ids ? { id: { in: ids } } : {}] },
      orderBy: [{ lastActivityAt: 'desc' }, { id: 'asc' }],
      take: 12,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, countryOfResidence: true, dossiers: { where: { deletedAt: null, status: { in: LIVE } }, select: { reference: true, stage: true, status: true }, orderBy: { lastActivityAt: 'desc' } } },
    });
    return { data: rows.map((c) => ({ id: c.id, name: clientName(c), email: c.email, phone: c.phone, countryOfResidence: c.countryOfResidence, liveDossiers: c.dossiers })) };
  }

  /** `GET /admin/dossiers/pickers/properties?q=` (`dossier.create`) — published properties (PIP-015: « un bien publié »). */
  async pickProperties(q: unknown): Promise<{ data: PropertyPick[] }> {
    const term = typeof q === 'string' ? fold(q.trim().slice(0, 120)) : '';
    const rows = (await this.cardsIndex()).filter((r) => !term || fold(`${r.reference} ${r.title} ${r.city?.name ?? ''} ${r.program?.name ?? ''}`).includes(term));
    const props = await this.cards.rows(rows.slice(0, 12).map((r) => r.id));
    return {
      data: rows.slice(0, 12).map((r) => {
        const p = props.get(r.id);
        return { id: r.id, reference: r.reference, title: r.title, city: r.city?.name ?? null, availability: r.availability, priceFrom: p?.priceFrom ? { amount: p.priceFrom.toFixed(2), currency: p.priceCurrency } : null };
      }),
    };
  }

  private async cardsIndex() {
    const online = await this.cards.onlineIds();
    // `CatalogueIndex.rows()` through the card reader keeps one definition of « publié et en ligne ».
    const rows = await this.prisma.property.findMany({
      where: { id: { in: [...online] } },
      orderBy: [{ relevanceScore: 'desc' }, { reference: 'asc' }],
      select: { id: true, reference: true, title: true, availability: true, city: { select: { nameFr: true } }, program: { select: { name: true } } },
    });
    return rows.map((r) => ({ id: r.id, reference: r.reference, title: r.title, availability: r.availability, city: r.city ? { name: r.city.nameFr } : null, program: r.program }));
  }

  // ─── The record (EA-22) ───────────────────────────────────────────────────

  /** `GET /admin/dossiers/{référence}` (`dossier.read`) — outside the reader's perimeter: 404 (BO-015). */
  async detail(auth: AuthContext, reference: string): Promise<DossierDetail> {
    const staff = await this.views.of(auth);
    if (!UUID.test(reference) && !/^[A-Za-z0-9-]{3,20}$/.test(reference)) throw AppError.notFound();
    const where: Prisma.DossierWhereInput = UUID.test(reference) ? { id: reference } : { reference: reference.toUpperCase() };
    const d = await this.prisma.dossier.findFirst({
      where: { AND: [where, { deletedAt: null }, dossierScope(staff)] },
      include: {
        client: { include: { user: { select: { status: true } } } },
        assignedAgent: { select: { id: true, firstName: true, lastName: true, status: true } },
        lot: { select: { id: true, reference: true, floor: true, surfaceM2: true, price: true, status: true } },
        property: { select: { priceCurrency: true, priceFrom: true, unpublishedAt: true } },
        leadsAsDossier: { select: { id: true, reference: true, kind: true, status: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d) throw AppError.notFound();
    const now = this.clock.now();
    const [cal, inactivityDays, history, facts, tasks, overdueTasks, openTasks, appointment, cards, recent, deposited, submissions, reservations, online, holdTask] = await Promise.all([
      this.calendar.load(),
      this.settings.get('dossier.inactivityDays'),
      this.prisma.dossierStageHistory.findMany({ where: { dossierId: d.id }, orderBy: [{ changedAt: 'asc' }, { createdAt: 'asc' }], select: { toStage: true, changedAt: true, fromStage: true } }),
      this.candidateFacts([d.id], now),
      staff.has('task.read')
        ? this.prisma.task.findMany({
            where: { dossierId: d.id, status: 'OPEN', deletedAt: null },
            orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
            take: 6,
            select: { id: true, title: true, priority: true, dueAt: true, dueHasTime: true, origin: true, assignee: { select: { firstName: true, lastName: true, status: true } } },
          })
        : Promise.resolve([]),
      this.prisma.task.count({ where: { dossierId: d.id, status: 'OPEN', deletedAt: null, dueAt: { lt: now } } }),
      this.prisma.task.count({ where: { dossierId: d.id, status: 'OPEN', deletedAt: null } }),
      staff.has('appointment.read')
        ? this.prisma.appointment.findFirst({
            where: { dossierId: d.id, OR: [{ status: 'CONFIRMED', startsAt: { gt: now } }, { status: 'REQUESTED' }] },
            orderBy: { startsAt: { sort: 'asc', nulls: 'first' } },
            select: { id: true, type: true, status: true, startsAt: true, property: { select: { title: true } }, staffUser: { select: { firstName: true, lastName: true, status: true } } },
          })
        : Promise.resolve(null),
      this.cards.cards(d.propertyId ? [d.propertyId] : []),
      this.timelineEntries(staff, d, null, null, 5),
      this.prisma.documentVersion.count({ where: { document: { dossierId: d.id } } }),
      this.prisma.bankSubmission.count({ where: { dossierId: d.id } }),
      this.prisma.reservation.findMany({ where: { dossierId: d.id, status: { in: ['OPTION', 'RESERVED'] } }, select: { status: true } }),
      this.cards.onlineIds(),
      this.prisma.task.findFirst({ where: { dedupeKey: `resurfaced:${d.id}`, status: 'OPEN', deletedAt: null }, select: { title: true } }),
    ]);
    const c = d.client;
    const candidates = facts.get(d.id) ?? NO_CANDIDATES;
    const property = d.propertyId ? (cards.get(d.propertyId) ?? null) : null;
    const live = isLive(d.status);
    const finished = isFinished(d.status);

    // « Ce qu'il manque » (PIP-021, API-102) — the conditions of the NEXT advance.
    let conditions: TransitionCondition[] = [];
    if (d.status === 'OPEN') {
      if (d.stage === 'INTEREST') conditions = [{ code: 'AGENT_ASSIGNED', met: d.assignedAgentId !== null }];
      else if (d.stage === 'QUALIFICATION') conditions = qualificationConditions({ firstContactAt: d.firstContactAt, client: c });
      else if (d.stage === 'MATCHING') {
        const selected = await this.prisma.dossierCandidate.findMany({ where: { dossierId: d.id, status: 'SELECTED' }, select: { propertyId: true } });
        const sel = selected.length === 1 ? (await this.cards.rows([selected[0]!.propertyId])).get(selected[0]!.propertyId) : undefined;
        conditions = buildFileConditions({
          selectedCount: selected.length,
          propertyAvailable: Boolean(sel && online.has(sel.id) && !isGone(sel) && (sel.availability === 'AVAILABLE' || reservations.length > 0)),
          employmentType: c.employmentType,
          residencyStatus: c.residencyStatus,
        });
      }
    }

    // PIP-025 — banners, in display order.
    const banners: DossierBannerItem[] = [];
    const today = localDate(now, cal);
    if (d.status === 'ON_HOLD') {
      banners.push({ code: 'ON_HOLD', params: { date: d.heldAt?.toISOString() ?? null, reason: d.holdReason, note: d.holdNote, until: d.holdUntil ? d.holdUntil.toISOString().slice(0, 10) : null } });
      if (d.holdUntil && d.holdUntil.toISOString().slice(0, 10) <= today) banners.push({ code: 'RESUME_DUE', params: {} });
      if (holdTask) banners.push({ code: 'ACTIVITY_ON_HOLD', params: { title: holdTask.title } });
    }
    if (d.status === 'LOST') banners.push({ code: 'LOST', params: { date: d.lostAt?.toISOString() ?? null, reason: d.lostReason } });
    if (d.status === 'WON') banners.push({ code: 'WON', params: { date: d.wonAt?.toISOString() ?? null } });
    const pending = live ? await this.prisma.dossierCandidate.findFirst({ where: { dossierId: d.id, selectionRequestedAt: { not: null }, status: { not: 'SELECTED' } }, select: { lotId: true, lot: { select: { reference: true, status: true } }, property: { select: { title: true } } } }) : null;
    if (pending) banners.push({ code: 'SELECTION_REQUESTED', params: { bien: pending.property.title, lot: pending.lot?.reference ?? null, lotLost: pending.lot && pending.lot.status !== 'AVAILABLE' ? 1 : 0 } });
    let lotLost = false;
    if (live && d.propertyId && property) {
      const row = (await this.cards.rows([d.propertyId])).get(d.propertyId);
      if (row && isGone(row)) banners.push({ code: 'PROPERTY_UNAVAILABLE', params: { bien: property.title } });
      else if (!property.online) banners.push({ code: 'PROPERTY_OFFLINE', params: { bien: property.title, date: d.property?.unpublishedAt?.toISOString() ?? null } });
      else if (property.availability === 'RESERVED' && reservations.length === 0) banners.push({ code: 'PROPERTY_RESERVED', params: { bien: property.title } });
      // CYC-102 — the dossier lost its intended lot: the last audit row that emptied `lotId` was written by the system.
      if (!d.lotId) {
        const lost = await this.prisma.auditLog.findFirst({ where: { entityType: 'Dossier', entityId: d.id, action: 'dossier.updated', reason: 'lot_taken' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
        const chosen = lost ? await this.prisma.auditLog.count({ where: { entityType: 'Dossier', entityId: d.id, createdAt: { gt: lost.createdAt }, action: { in: ['dossier.updated', 'candidate.status_changed'] }, reason: { not: 'lot_taken' } } }) : 1;
        lotLost = Boolean(lost) && chosen === 0;
      }
    }
    if (c.doNotContact) banners.push({ code: 'DO_NOT_CONTACT', params: { reason: staff.masked ? null : c.doNotContactReason, date: c.doNotContactAt?.toISOString() ?? null } });
    if (!c.email) banners.push({ code: 'NO_EMAIL', params: {} });
    else if (c.emailBouncedAt) banners.push({ code: 'EMAIL_BOUNCED', params: { date: c.emailBouncedAt.toISOString() } });
    if (c.restrictedAt) banners.push({ code: 'RESTRICTED', params: { date: c.restrictedAt.toISOString() } });
    const inactiveDays = d.status === 'OPEN' ? Math.floor((now.getTime() - d.lastActivityAt.getTime()) / DAY) : 0;
    if (inactiveDays >= inactivityDays) banners.push({ code: 'INACTIVE', params: { n: inactiveDays } });

    // PIP-025 « Plan de financement » — MOD-313; the amounts follow `client.sensitive.read` (SEC-033).
    const currency = d.purchaseCurrency ?? d.property?.priceCurrency ?? null;
    const money = (v: { toFixed(n: number): string } | null, cur: string | null) => (v !== null && cur ? { amount: v.toFixed(2), currency: cur } : null);
    const publicPrice = d.lot && currency ? { amount: d.lot.price.toFixed(2), currency } : money(d.property?.priceFrom ?? null, d.property?.priceCurrency ?? null);
    let gap = null as DossierDetail['financing']['gap'];
    if (staff.sensitive && d.purchasePrice && d.loanAmountRequested && d.downPayment && currency && d.downPaymentCurrency === currency && (d.loanCurrency ?? currency) === currency) {
      const diff = d.purchasePrice.minus(d.loanAmountRequested).minus(d.downPayment);
      if (diff.abs().greaterThan(1)) gap = { amount: diff.toFixed(2), currency };
    }

    // The default sentence the client reads (ECL-021), with its values ready for `ui.client.nextStep.{code}`.
    const defaultStep = await this.defaultClientStep(d, c.timezone);

    const can = this.abilities(staff, d, { deposited, submissions, reserved: reservations.some((r) => r.status === 'RESERVED') });
    const asMoney = money;
    return {
      id: d.id,
      reference: d.reference,
      version: d.version,
      stage: d.stage,
      status: d.status,
      priority: d.priority,
      createdAt: d.createdAt.toISOString(),
      stageEnteredAt: d.stageEnteredAt.toISOString(),
      daysInStage: daysInStage(d.stageEnteredAt, now),
      lastActivityAt: d.lastActivityAt.toISOString(),
      sla: slaOf(d, now, cal),
      steps: friezeOf(d, history),
      next: nextOf({ stage: d.stage, status: d.status, assignedAgentId: d.assignedAgentId, firstContactAt: d.firstContactAt, holdUntil: d.holdUntil, candidates }),
      leads: staff.has('lead.read') ? d.leadsAsDossier.map((l) => ({ reference: l.reference, kind: l.kind, status: l.status, createdAt: l.createdAt.toISOString(), origin: l.id === d.originLeadId })) : [],
      client: {
        id: c.id,
        name: staff.masked ? maskName(c.firstName, c.lastName) : clientName(c),
        email: staff.masked ? maskEmail(c.email) : c.email,
        phone: staff.masked ? maskPhone(c.phone) : c.phone,
        countryOfResidence: c.countryOfResidence,
        status: c.status,
        score: c.score,
        preferredChannel: c.preferredContactChannel,
        preferredSlot: c.preferredContactSlot,
        timezone: c.timezone,
        doNotContact: c.doNotContact,
        hasAccount: Boolean(c.userId) && c.user?.status !== 'DELETED',
        masked: staff.masked,
      },
      agent: d.assignedAgent ? { id: d.assignedAgent.id, name: staffName(d.assignedAgent) } : null,
      mine: d.assignedAgentId === staff.userId,
      property,
      lot: d.lot && currency ? lotOption(d.lot, currency) : null,
      lotLost,
      hold: d.status === 'ON_HOLD' && d.holdReason ? { reason: d.holdReason, note: staff.masked ? null : d.holdNote, until: d.holdUntil ? d.holdUntil.toISOString().slice(0, 10) : null, clientNote: staff.masked ? null : d.holdClientNote, heldAt: (d.heldAt ?? d.updatedAt).toISOString() } : null,
      lost: d.status === 'LOST' && d.lostReason ? { reason: d.lostReason, note: staff.masked ? null : d.lostNote, at: (d.lostAt ?? d.updatedAt).toISOString() } : null,
      financing: {
        requested: d.financingRequested,
        type: d.financingType,
        purchasePrice: asMoney(d.purchasePrice, currency),
        publicPrice,
        downPayment: staff.sensitive ? asMoney(d.downPayment, d.downPaymentCurrency) : null,
        loanAmount: staff.sensitive ? asMoney(d.loanAmountRequested, d.loanCurrency ?? currency) : null,
        durationMonths: d.durationMonths,
        gap,
        sensitive: staff.sensitive,
      },
      clientNextStep: { custom: d.clientNextStep?.trim() || null, defaultCode: defaultStep.code, defaultParams: defaultStep.params },
      action: staff.has('dossier.transition') || (d.stage === 'INTEREST' && staff.has('dossier.assign')) ? this.allowedAction(staff, d) : null,
      conditions,
      banners,
      todo: {
        tasks: tasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority, dueAt: t.dueAt?.toISOString() ?? null, dueHasTime: t.dueHasTime, overdue: Boolean(t.dueAt && t.dueAt.getTime() < now.getTime()), assigneeName: staffName(t.assignee), automatic: t.origin !== 'MANUAL' })),
        nextAppointment: appointment ? { id: appointment.id, type: appointment.type, status: appointment.status, startsAt: appointment.startsAt?.toISOString() ?? null, propertyTitle: appointment.property?.title ?? null, staffName: staffName(appointment.staffUser) } : null,
      },
      recent,
      counts: { candidates: candidates.live, proposalsWaiting: candidates.waitingAnswer + (candidates.selectionRequested ? 1 : 0), openTasks, overdueTasks },
      moveBackTarget: d.status === 'OPEN' ? moveBackTarget(d.stage, d.financingRequested) : null,
      can: { ...can, createTask: staff.has('task.manage') && !finished, createAppointment: staff.has('appointment.manage') && live, writeNote: staff.has('note.manage'), readAudit: staff.has('audit.read') },
    };
  }

  /** PIP-021 — the main action the READER may take: « Prendre en charge » asks `dossier.assign`, the others `dossier.transition`. */
  private allowedAction(staff: StaffView, d: { stage: string; status: string }): DossierDetail['action'] {
    const action = mainAction(d);
    if (action === 'TAKE') return staff.has('dossier.assign') ? 'TAKE' : null;
    return action && staff.has('dossier.transition') ? action : null;
  }

  /** BO-047 — forbidden by the role: `false` (absent); impossible in this state: its reason (greyed). */
  private abilities(staff: StaffView, d: { stage: string; status: string; financingRequested: boolean; assignedAgentId: string | null }, f: { deposited: number; submissions: number; reserved: boolean }) {
    const when = (permission: Parameters<StaffView['has']>[0], reason: string | null): Ability => (!staff.has(permission) ? false : reason ? { reason } : true);
    const live = isLive(d.status);
    const closed = isFinished(d.status) ? 'DOSSIER_CLOSED' : null;
    const others = grantOf(staff.role, 'dossier.assign') === true;
    const target = moveBackTarget(d.stage, d.financingRequested);
    const backReason = d.status !== 'OPEN' ? (d.status === 'ON_HOLD' ? 'DOSSIER_ON_HOLD' : 'DOSSIER_CLOSED') : !target ? 'TRANSITION_NOT_ALLOWED' : stageIndex(d.stage) > stageIndex('DOCUMENTS') ? 'STAGE_NOT_DELIVERED' : f.submissions > 0 ? 'SUBMISSION_IN_PROGRESS' : f.reserved ? 'RESERVATION_ACTIVE' : null;
    return {
      update: when('dossier.update', closed),
      // ROL note 3 — an adviser only takes a dossier that has no adviser.
      assign: !staff.has('dossier.assign') ? false : closed ? { reason: closed } : !others && d.assignedAgentId !== null ? false : true,
      assignToOthers: others,
      hold: when('dossier.transition', d.status === 'OPEN' ? null : d.status === 'ON_HOLD' ? 'DOSSIER_ON_HOLD' : 'DOSSIER_CLOSED'),
      resume: when('dossier.transition', d.status === 'ON_HOLD' ? null : 'TRANSITION_NOT_ALLOWED'),
      close: when('dossier.close', live ? null : 'DOSSIER_CLOSED'),
      reopen: when('dossier.reopen', d.status === 'LOST' ? null : 'TRANSITION_NOT_ALLOWED'),
      moveBack: when('dossier.transition.backward', backReason),
      delete: when('dossier.delete', deletable(d, f.deposited, f.submissions) ? null : 'DOSSIER_NOT_DELETABLE'),
      manageCandidates: when('candidate.manage', closed ?? (d.assignedAgentId === null ? 'AGENT_NOT_ASSIGNED' : null)),
    };
  }

  /** ECL-021 — the default « Prochaine étape » sentence of the client space, its values already in words. */
  private async defaultClientStep(d: Parameters<DossierViews['nextStep']>[0] & { assignedAgentId: string | null; clientId: string }, clientTimezone: string | null): Promise<{ code: string; params: Record<string, string | number | null> }> {
    const lead = await this.clientViews.promiseLeadFor(d.clientId);
    const step = await this.clientViews.nextStep({ ...d, clientNextStep: null }, lead, clientTimezone);
    if (!step) return { code: 'NONE', params: {} };
    const agent = d.assignedAgentId ? await this.prisma.user.findUnique({ where: { id: d.assignedAgentId }, select: { firstName: true, lastName: true } }) : null;
    const tz = clientTimezone ?? (await this.settings.get('business.calendar.timezone'));
    const params: Record<string, string | number | null> = { conseiller: advisorDisplayName(agent?.firstName ?? null, agent?.lastName ?? null) };
    if (step.params.n !== undefined) params.n = step.params.n;
    if (step.params.property) params.property = step.params.property;
    if (step.params.bank) params.bank = step.params.bank;
    if (step.params.banks) params.banks = step.params.banks;
    if (step.params.date) {
      const at = new Date(step.params.date);
      params.date = new Intl.DateTimeFormat('fr-FR', step.params.date.length > 10 ? { dateStyle: 'long', timeStyle: 'short', timeZone: tz } : { dateStyle: 'long', timeZone: 'UTC' }).format(at);
    }
    if (step.promise) {
      params.quand = callbackLabel({
        preferredCallbackDate: step.promise.preferredCallbackDate,
        preferredSlot: (step.promise.preferredSlot as CallbackSlot | null) ?? null,
        firstContactBusinessDays: await this.settings.get('sla.firstContactBusinessDays'),
        timeZone: step.promise.timeZone,
      });
    }
    return { code: step.code, params };
  }

  // ─── Qualification (CRM-050) ──────────────────────────────────────────────

  /** `GET /admin/dossiers/{id}/qualification` (`dossier.read`). */
  async qualification(auth: AuthContext, id: string): Promise<QualificationState> {
    const staff = await this.views.of(auth);
    const { id: dossierId } = await this.visible(staff, id);
    const d = await this.prisma.dossier.findUniqueOrThrow({ where: { id: dossierId }, select: { firstContactAt: true, client: true } });
    const c = d.client;
    const [countries, currencies] = await Promise.all([
      this.prisma.country.findMany({ where: { isResidenceOption: true }, orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }], select: { code: true, nameFr: true } }),
      Promise.resolve(SIMULATOR_CURRENCIES),
    ]);
    return {
      conditions: qualificationConditions({ firstContactAt: d.firstContactAt, client: c }),
      client: {
        version: c.version,
        firstName: staff.masked ? null : c.firstName,
        lastName: staff.masked ? null : c.lastName,
        countryOfResidence: c.countryOfResidence,
        residencyStatus: c.residencyStatus,
        budgetMax: c.budgetMax?.toFixed(2) ?? null,
        budgetCurrency: c.budgetCurrency,
        budgetMonthly: c.budgetMonthly?.toFixed(2) ?? null,
        budgetMonthlyCurrency: c.budgetMonthlyCurrency,
        downPayment: staff.sensitive ? (c.downPayment?.toFixed(2) ?? null) : null,
        downPaymentCurrency: staff.sensitive ? c.downPaymentCurrency : null,
        downPaymentWithheld: !staff.sensitive,
        financingPreference: c.financingPreference,
        purchaseTimeframe: c.purchaseTimeframe,
        doNotContact: c.doNotContact,
      },
      firstContactAt: d.firstContactAt?.toISOString() ?? null,
      currencies: [...currencies],
      countries: countries.map((x: { code: string; nameFr: string }) => ({ code: x.code, name: x.nameFr })),
    };
  }

  // ─── Effects announced by the pause and closing windows (PIP-080, PIP-081) ─

  /** `GET /admin/dossiers/{id}/effects` (`dossier.read`). */
  async effects(auth: AuthContext, id: string): Promise<DossierEffects> {
    const staff = await this.views.of(auth);
    const { id: dossierId, clientId } = await this.visible(staff, id);
    const now = this.clock.now();
    const [appointments, openTasks, openLeads, reservation, submissions, client] = await Promise.all([
      upcomingAppointmentsOfDossier(this.prisma, dossierId, now),
      this.prisma.task.count({ where: { dossierId, status: 'OPEN', deletedAt: null } }),
      this.prisma.lead.count({ where: { dossierId, status: { in: ['NEW', 'IN_PROGRESS'] } } }),
      this.prisma.reservation.findFirst({ where: { dossierId, status: { in: ['OPTION', 'RESERVED'] } }, select: { status: true, optionExpiresAt: true, lot: { select: { reference: true } } } }),
      this.prisma.bankSubmission.count({ where: { dossierId, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED'] } } }),
      this.prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { firstName: true, lastName: true, email: true } }),
    ]);
    return {
      upcomingAppointments: appointments.map((a) => ({ id: a.id, startsAt: a.startsAt.toISOString(), type: a.type, clientInformed: a.clientInformed })),
      openTasks,
      openLeads,
      reservation: reservation ? { lotReference: reservation.lot.reference, status: reservation.status, until: reservation.optionExpiresAt?.toISOString() ?? null } : null,
      submissions,
      client: { name: staff.masked ? maskName(client.firstName, client.lastName) : clientName(client), hasEmail: Boolean(client.email) },
    };
  }

  // ─── History (PIP-060) ────────────────────────────────────────────────────

  /** `GET /admin/dossiers/{id}/history` (`dossier.read`) — the journal of stages; the audit rows with `audit.read`. */
  async history(auth: AuthContext, id: string): Promise<DossierHistory> {
    const staff = await this.views.of(auth);
    const { id: dossierId } = await this.visible(staff, id);
    const rows = await this.prisma.dossierStageHistory.findMany({
      where: { dossierId },
      orderBy: [{ changedAt: 'desc' }, { createdAt: 'desc' }],
      include: { changedBy: { select: { firstName: true, lastName: true, status: true } } },
    });
    const stages: StageHistoryRow[] = rows.map((r) => {
      const reason = splitReason(r.reason);
      return {
        id: r.id,
        fromStage: r.fromStage,
        toStage: r.toStage,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        isBackward: r.isBackward,
        reasonCode: reason.code,
        reasonText: staff.masked ? null : reason.text, // SEC-032: free text
        author: r.changedBy ? { kind: 'STAFF', name: staffName(r.changedBy) } : { kind: 'SYSTEM', name: null },
        at: r.changedAt.toISOString(),
        businessMinutesInPreviousStage: r.businessMinutesInPreviousStage === null ? null : Number(r.businessMinutesInPreviousStage),
      };
    });
    let audit: AuditRow[] | null = null;
    if (staff.has('audit.read')) {
      const logs = await this.prisma.auditLog.findMany({
        where: { OR: [{ entityType: { in: ['Dossier', 'dossier'] }, entityId: dossierId }, { dossierId }] },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
        select: { id: true, action: true, actorType: true, before: true, after: true, reason: true, createdAt: true, actor: { select: { firstName: true, lastName: true, status: true, kind: true } } },
      });
      audit = logs.map((a) => ({
        id: a.id,
        action: a.action,
        author: a.actor && a.actor.kind === 'STAFF' ? { kind: 'STAFF', name: staffName(a.actor) } : { kind: 'SYSTEM', name: null },
        at: a.createdAt.toISOString(),
        fields: Object.keys({ ...((a.before as Record<string, unknown> | null) ?? {}), ...((a.after as Record<string, unknown> | null) ?? {}) }),
        reason: a.reason,
      }));
    }
    return { stages, audit };
  }

  // ─── Timeline (BO-050; route `dossiers/{id}/timeline`) ────────────────────

  /** `GET /admin/dossiers/{id}/timeline?before=&type=` (`dossier.read`) — cursor pagination, filter by type of entry. */
  async timeline(auth: AuthContext, id: string, query: { before?: unknown; type?: unknown }): Promise<AdminTimelinePage> {
    const staff = await this.views.of(auth);
    const d = await this.visible(staff, id);
    const wanted = typeof query.type === 'string' && query.type ? new Set(query.type.split(',').filter((t): t is TimelineType => (TIMELINE_TYPES as readonly string[]).includes(t))) : null;
    let before: Date | null = null;
    if (typeof query.before === 'string' && query.before) {
      before = new Date(query.before);
      if (Number.isNaN(before.getTime())) throw new AppError(ErrorCode.BAD_REQUEST);
    }
    const entries = await this.timelineEntries(staff, d, before, wanted, PAGE + 1);
    const page = entries.slice(0, PAGE);
    return { data: page, meta: { nextCursor: entries.length > PAGE ? page[page.length - 1]!.at : null } };
  }

  /**
   * The entries of a dossier, most recent first. Each source is read only when the reader holds its permission
   * (ROL-019): stages and properties follow the dossier; requests `lead.read`; e-mails and exchanges
   * `communication.read`; notes `note.read`; tasks `task.read`; appointments `appointment.read`.
   */
  private async timelineEntries(staff: StaffView, d: { id: string }, before: Date | null, wanted: Set<TimelineType> | null, take: number): Promise<AdminTimelineEntry[]> {
    const want = (t: TimelineType) => !wanted || wanted.has(t);
    const until = before ? { lt: before } : undefined;
    const entries: AdminTimelineEntry[] = [];
    const system = { kind: 'SYSTEM' as const, name: null };
    type Person = { firstName: string | null; lastName: string | null; status: string; kind?: string } | null | undefined;
    const author = (u: Person): AdminTimelineEntry['author'] => (u ? (u.kind && u.kind !== 'STAFF' ? { kind: 'CLIENT', name: null } : { kind: 'STAFF', name: staffName(u) }) : system);

    // Stages and states (source: `DossierStageHistory`).
    if (want('STAGE')) {
      const rows = await this.prisma.dossierStageHistory.findMany({
        where: { dossierId: d.id, ...(until ? { changedAt: until } : {}) },
        orderBy: [{ changedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        include: { changedBy: { select: { firstName: true, lastName: true, status: true, kind: true } } },
      });
      for (const r of rows) {
        const reason = splitReason(r.reason);
        const code =
          r.fromStage === null
            ? 'stage.opened'
            : r.toStatus === 'ON_HOLD' && r.fromStatus !== 'ON_HOLD'
              ? 'stage.held'
              : r.fromStatus === 'ON_HOLD' && r.toStatus === 'OPEN' && r.fromStage === r.toStage
                ? 'stage.resumed'
                : r.toStatus === 'LOST'
                  ? 'stage.closed'
                  : r.toStatus === 'WON'
                    ? 'stage.won'
                    : r.fromStatus === 'LOST'
                      ? 'stage.reopened'
                      : r.isBackward
                        ? 'stage.moved_back'
                        : 'stage.advanced';
        entries.push({ id: `stage:${r.id}`, type: 'STAGE', code, params: { from: label('DossierStage', r.fromStage), to: label('DossierStage', r.toStage), reason: reasonLabel(reason.code) }, author: author(r.changedBy), at: r.changedAt.toISOString(), detail: staff.masked ? null : reason.text });
      }
    }

    // Considered properties, change of adviser, plan: `AuditLog` rows of the dossier (SEC-080) — they follow `dossier.read`.
    if (want('PROPERTY') || want('ACTIVITY')) {
      const rows = await this.prisma.auditLog.findMany({
        where: {
          ...(until ? { createdAt: until } : {}),
          OR: [
            { dossierId: d.id, action: 'candidate.status_changed' },
            { entityType: 'Dossier', entityId: d.id, action: { in: ['dossier.assigned', 'dossier.updated', 'dossier.created'] } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        select: { id: true, action: true, entityLabel: true, before: true, after: true, reason: true, createdAt: true, actor: { select: { firstName: true, lastName: true, status: true, kind: true } } },
      });
      for (const a of rows) {
        const after = (a.after ?? {}) as Record<string, unknown>;
        if (a.action === 'candidate.status_changed') {
          if (!want('PROPERTY')) continue;
          const event = typeof after.event === 'string' ? after.event : typeof after.status === 'string' ? after.status.toLowerCase() : 'updated';
          entries.push({ id: `audit:${a.id}`, type: 'PROPERTY', code: `candidate.${event}`, params: { bien: a.entityLabel, n: typeof after.count === 'number' ? after.count : null, lot: typeof after.lot === 'string' ? after.lot : null, reason: typeof after.declineReason === 'string' ? label('DeclineReason', after.declineReason) : null }, author: author(a.actor), at: a.createdAt.toISOString(), detail: staff.masked ? null : a.reason });
        } else if (want('ACTIVITY')) {
          if (a.action === 'dossier.created') continue; // told by the journal of stages
          const fields = Object.keys(after).filter((k) => k !== 'event');
          const code = a.action === 'dossier.assigned' ? 'dossier.assigned' : typeof after.event === 'string' ? `dossier.${after.event}` : 'dossier.updated';
          entries.push({ id: `audit:${a.id}`, type: 'ACTIVITY', code, params: { conseiller: typeof after.agentName === 'string' ? after.agentName : null, fields: fields.join(', ') || null, lot: typeof after.lot === 'string' ? after.lot : null }, author: author(a.actor), at: a.createdAt.toISOString(), detail: staff.masked ? null : a.reason });
        }
      }
    }

    // Tasks and appointments: their audit rows are their only history (BO-050) — `task.read`, `appointment.read`.
    if (want('ACTIVITY')) {
      const [tasks, appointments] = await Promise.all([
        staff.has('task.read') ? this.prisma.task.findMany({ where: { dossierId: d.id }, select: { id: true, title: true }, take: 500 }) : Promise.resolve([]),
        staff.has('appointment.read') ? this.prisma.appointment.findMany({ where: { dossierId: d.id }, select: { id: true, type: true }, take: 500 }) : Promise.resolve([]),
      ]);
      const ids = [...tasks.map((t) => t.id), ...appointments.map((a) => a.id)];
      if (ids.length) {
        const rows = await this.prisma.auditLog.findMany({
          where: { entityId: { in: ids }, OR: [{ action: { startsWith: 'task.' } }, { action: { startsWith: 'appointment.' } }], ...(until ? { createdAt: until } : {}) },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: { id: true, action: true, entityId: true, after: true, reason: true, createdAt: true, actor: { select: { firstName: true, lastName: true, status: true, kind: true } } },
        });
        for (const a of rows) {
          const after = (a.after ?? {}) as Record<string, unknown>;
          const task = tasks.find((t) => t.id === a.entityId);
          const appointment = appointments.find((x) => x.id === a.entityId);
          const status = typeof after.status === 'string' ? after.status : null;
          if (task) {
            const code = a.action === 'task.created' ? 'task.created' : status === 'DONE' ? 'task.done' : status === 'CANCELLED' ? 'task.cancelled' : status === 'OPEN' ? 'task.reopened' : 'assigneeId' in after ? 'task.assigned' : 'task.updated';
            entries.push({ id: `audit:${a.id}`, type: 'ACTIVITY', code, params: { title: task.title }, author: author(a.actor), at: a.createdAt.toISOString(), detail: staff.masked ? null : a.reason });
          } else if (appointment) {
            const code = a.action === 'appointment.created' ? 'appointment.created' : a.action === 'appointment.outcome_corrected' ? 'appointment.outcome_corrected' : status ? `appointment.${status.toLowerCase()}` : 'appointment.updated';
            entries.push({ id: `audit:${a.id}`, type: 'ACTIVITY', code, params: { type: label('AppointmentType', appointment.type) }, author: author(a.actor), at: a.createdAt.toISOString(), detail: staff.masked ? null : a.reason });
          }
        }
      }
    }

    // Requests attached to the dossier (source: `Lead`) — `lead.read`.
    if (want('LEAD') && staff.has('lead.read')) {
      const leads = await this.prisma.lead.findMany({ where: { dossierId: d.id, status: { not: 'SPAM' }, ...(until ? { createdAt: until } : {}) }, orderBy: { createdAt: 'desc' }, take, select: { id: true, reference: true, kind: true, source: true, createdAt: true, createdBy: { select: { firstName: true, lastName: true, status: true, kind: true } } } });
      for (const l of leads) {
        entries.push({ id: `lead:${l.id}`, type: 'LEAD', code: 'lead.receivedRef', params: { kind: l.kind, source: l.source, reference: l.reference }, author: l.createdBy ? author(l.createdBy) : { kind: 'CLIENT', name: null }, at: l.createdAt.toISOString(), detail: null });
      }
    }

    // E-mails and logged exchanges (source: `Communication`) — `communication.read`.
    if (staff.has('communication.read') && (want('EMAIL') || want('CALL'))) {
      const rows = await this.prisma.communication.findMany({ where: { dossierId: d.id, ...(until ? { occurredAt: until } : {}) }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take, select: COMMUNICATION_ENTRY_SELECT });
      entries.push(...communicationEntries(rows, staff, want));
    }

    // Notes (source: `Note`) — `note.read`.
    if (staff.has('note.read') && want('NOTE')) {
      const rows = await this.prisma.note.findMany({
        where: { entityType: 'DOSSIER', entityId: d.id, deletedAt: null, ...(until ? { createdAt: until } : {}) },
        include: { author: { select: { firstName: true, lastName: true, status: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
      });
      const canWrite = staff.has('note.manage');
      for (const n of rows) {
        const mine = n.authorId === staff.userId;
        entries.push({
          id: `note:${n.id}`,
          type: 'NOTE',
          code: 'note.written',
          params: {},
          author: { kind: 'STAFF', name: staffName(n.author) },
          at: n.createdAt.toISOString(),
          detail: n.body,
          pinned: n.isPinned,
          note: { id: n.id, canEdit: mine && canWrite, canDelete: (mine && canWrite) || staff.has('note.moderate'), editedAt: n.updatedAt.getTime() - n.createdAt.getTime() > 1000 ? n.updatedAt.toISOString() : null },
        });
      }
    }

    entries.sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at)));
    return entries.slice(0, take);
  }
}
