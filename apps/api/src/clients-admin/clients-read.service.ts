// Package 3.3 « Clients », reading — EA-12 (CRM-040) and EA-13 (CRM-045 … CRM-047), 04-back-office/03 § 6 and § 7.
// What the reader may see is decided here: the adviser's perimeter in every query (ROL-018, SEC-031), the masking of
// the SUPPORT role (ROL-015, SEC-032), the sensitive amounts (ROL-019, SEC-033) — a value the reader may not read never
// leaves the API. A record absorbed by a merge answers its pointer (CRM-080 point 7); outside the perimeter: 404.
import { Injectable } from '@nestjs/common';
import {
  CLIENT_VIEWS,
  clientListQuerySchema,
  ErrorCode,
  scoreLevel,
  TIMELINE_TYPES,
  type AdminClientStatus,
  type AdminLeadKind,
  type AdminLeadSource,
  type AdminLeadStatus,
  type AdminTimelineEntry,
  type AdminTimelinePage,
  type ClientAccountState,
  type ClientConsentRow,
  type ClientContactsTab,
  type ClientDetail,
  type ClientDetailResponse,
  type ClientDossierRow,
  type ClientFavoritesTab,
  type ClientFeedbackRow,
  type ClientLeadRow,
  type ClientList,
  type ClientListItem,
  type ClientProjectTab,
  type ClientRegistrationRow,
  type ClientView,
  type TimelineType,
} from '@dp/contracts';
import { CLIENT_CONTACTS_MAX } from '@dp/contracts';
import { zonedDayStart } from '../back-office/leads-admin.service.js';
import { clientName, clientScope, maskEmail, maskName, maskPhone, staffName, StaffViews, type StaffView } from '../back-office/staff-view.js';
import { COMMUNICATION_ENTRY_SELECT, communicationEntries } from '../crm/communication-entries.js';
import { duplicatesForReader } from '../crm/duplicates.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { clientScoreDetail } from '../leads/lead-records.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

const LATE_STAGES = ['DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION'] as const;
const PAGE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dec = (v: Prisma.Decimal | null) => (v === null ? null : v.toFixed(2));
const day = (v: Date | null) => (v ? v.toISOString().slice(0, 10) : null);

/** The account state of a record (CRM-070): « Aucun compte » · « Invité » · « Actif » · « Suspendu ». */
export function accountState(user: { status: string } | null | undefined): ClientAccountState {
  if (!user || user.status === 'DELETED') return 'NONE';
  return user.status === 'INVITED' ? 'INVITED' : user.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
}

/** ROL-018 + never a deleted or absorbed record. */
export function liveClients(staff: StaffView): Prisma.ClientWhereInput {
  return { AND: [{ deletedAt: null, mergedIntoId: null }, clientScope(staff)] };
}

const LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  countryOfResidence: true,
  status: true,
  score: true,
  assignedAgentId: true,
  lastActivityAt: true,
  createdAt: true,
  source: true,
  doNotContact: true,
  userId: true,
  user: { select: { status: true } },
  assignedAgent: { select: { firstName: true, lastName: true, status: true } },
} satisfies Prisma.ClientSelect;

@Injectable()
export class ClientsReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly views: StaffViews,
  ) {}

  // ─── List (EA-12, CRM-040) ────────────────────────────────────────────────

  /** CRM-040 — the presets of the origin views. */
  private viewWhere(view: ClientView, staff: StaffView): Prisma.ClientWhereInput {
    switch (view) {
      case 'mine':
        return { assignedAgentId: staff.userId, archivedAt: null };
      case 'hot':
        return { archivedAt: null, score: { gte: 70 }, dossiers: { none: { deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] }, stage: { in: [...LATE_STAGES] } } } };
      case 'active':
        return { status: 'ACTIVE' };
      case 'customers':
        return { status: 'CUSTOMER' };
      case 'inactive':
        return { status: 'INACTIVE' };
      case 'archived':
        return { archivedAt: { not: null } };
      case 'all':
      default:
        return { archivedAt: null };
    }
  }

  private async idsMatching(q: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM clients c
      WHERE c.deleted_at IS NULL AND (
        c.search_text LIKE '%' || lower(public.f_unaccent(${q})) || '%'
        OR word_similarity(lower(public.f_unaccent(${q})), c.search_text) >= 0.6
        OR c.phone LIKE '%' || regexp_replace(${q}, '[^0-9+]', '', 'g') || '%' AND length(regexp_replace(${q}, '[^0-9]', '', 'g')) >= 6
      )
      LIMIT 1000`;
    return rows.map((r) => r.id);
  }

  private item(c: Prisma.ClientGetPayload<{ select: typeof LIST_SELECT }>, staff: StaffView): ClientListItem {
    return {
      id: c.id,
      name: staff.masked ? maskName(c.firstName, c.lastName) : clientName(c),
      email: staff.masked ? maskEmail(c.email) : c.email,
      phone: staff.masked ? maskPhone(c.phone) : c.phone,
      countryOfResidence: c.countryOfResidence,
      status: c.status as AdminClientStatus,
      score: c.score,
      scoreLevel: scoreLevel(c.score),
      agentName: staffName(c.assignedAgent),
      mine: c.assignedAgentId === staff.userId,
      lastActivityAt: c.lastActivityAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
      source: (c.source as AdminLeadSource | null) ?? null,
      noEmail: !c.email,
      doNotContact: c.doNotContact,
      hasAccount: accountState(c.user) !== 'NONE',
    };
  }

  /** `GET /admin/clients` (`client.read`). */
  async list(auth: AuthContext, rawQuery: unknown): Promise<ClientList> {
    const staff = await this.views.of(auth);
    const parsed = clientListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    const query = parsed.data;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { timezone: true } });
    const q = query.q && query.q.length >= 2 ? query.q : null;
    // ROL-015 — a SUPPORT account does not search people by what is masked to it
    const search: Prisma.ClientWhereInput = q ? (staff.masked ? { id: { in: [] } } : { id: { in: await this.idsMatching(q) } }) : {};
    const range = (from?: string, to?: string): Prisma.DateTimeFilter | undefined =>
      from || to ? { ...(from ? { gte: zonedDayStart(from, user.timezone) } : {}), ...(to ? { lt: new Date(zonedDayStart(to, user.timezone).getTime() + 86_400_000) } : {}) } : undefined;
    const created = range(query.createdFrom, query.createdTo);
    const activity = range(query.activityFrom, query.activityTo);
    const agents = query.assignedAgentId.filter((v) => v !== 'none');
    const scoreFilter: Prisma.ClientWhereInput = query.score.length
      ? { OR: query.score.map((l) => (l === 'HOT' ? { score: { gte: 70 } } : l === 'WARM' ? { score: { gte: 40, lt: 70 } } : { score: { lt: 40 } })) }
      : {};

    const criteria = (skip?: 'status' | 'source' | 'score' | 'country'): Prisma.ClientWhereInput => ({
      AND: [
        liveClients(staff),
        query.view ? this.viewWhere(query.view, staff) : query.status.includes('ARCHIVED') ? {} : { archivedAt: null },
        search,
        skip !== 'status' && query.status.length ? { status: { in: query.status } } : {},
        skip !== 'source' && query.source.length ? { source: { in: query.source } } : {},
        skip !== 'score' ? scoreFilter : {},
        skip !== 'country' && query.countryOfResidence.length ? { countryOfResidence: { in: query.countryOfResidence } } : {},
        query.assignedAgentId.length ? { OR: [...(agents.length ? [{ assignedAgentId: { in: agents } }] : []), ...(query.assignedAgentId.includes('none') ? [{ assignedAgentId: null }] : [])] } : {},
        query.hasAccount ? (query.hasAccount === 'true' ? { user: { status: { not: 'DELETED' } } } : { OR: [{ userId: null }, { user: { status: 'DELETED' } }] }) : {},
        query.marketingOptIn ? { marketingOptIn: query.marketingOptIn === 'true' } : {},
        created ? { createdAt: created } : {},
        activity ? { lastActivityAt: activity } : {},
      ],
    });

    const desc = query.sort.startsWith('-');
    const dir = desc ? 'desc' : 'asc';
    const key = query.sort.replace(/^-/, '');
    const orderBy: Prisma.ClientOrderByWithRelationInput[] =
      key === 'name'
        ? [{ lastName: { sort: dir, nulls: 'last' } }, { firstName: { sort: dir, nulls: 'last' } }, { id: 'asc' }]
        : key === 'score'
          ? [{ score: { sort: dir, nulls: 'last' } }, { id: 'asc' }]
          : [{ [key]: dir }, { id: 'asc' }];

    const where = criteria();
    const [total, rows, byStatus, bySource, byCountry, scoreCounts, viewCounts, agentRows] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({ where, select: LIST_SELECT, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.client.groupBy({ by: ['status'], where: criteria('status'), _count: { _all: true } }),
      this.prisma.client.groupBy({ by: ['source'], where: criteria('source'), _count: { _all: true } }),
      this.prisma.client.groupBy({ by: ['countryOfResidence'], where: { AND: [criteria('country'), { countryOfResidence: { not: null } }] }, _count: { _all: true } }),
      Promise.all([{ gte: 70 }, { gte: 40, lt: 70 }, { lt: 40 }].map((score) => this.prisma.client.count({ where: { AND: [criteria('score'), { score }] } }))),
      Promise.all(CLIENT_VIEWS.map((v) => this.prisma.client.count({ where: { AND: [liveClients(staff), this.viewWhere(v, staff)] } }))),
      this.prisma.membership.findMany({
        where: { revokedAt: null, suspendedAt: null, organization: { type: 'OPERATOR' }, role: { in: ['OWNER', 'ADMIN', 'AGENT'] }, user: { kind: 'STAFF', status: 'ACTIVE' } },
        select: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      }),
    ]);
    return {
      data: rows.map((r) => this.item(r, staff)),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
      views: Object.fromEntries(CLIENT_VIEWS.map((v, i) => [v, viewCounts[i]!])) as Record<ClientView, number>,
      facets: {
        status: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
        source: Object.fromEntries(bySource.filter((r) => r.source).map((r) => [r.source!, r._count._all])),
        score: { HOT: scoreCounts[0]!, WARM: scoreCounts[1]!, COLD: scoreCounts[2]! },
        countryOfResidence: Object.fromEntries(byCountry.map((r) => [r.countryOfResidence!, r._count._all])),
      },
      agents: agentRows.map((m) => ({ id: m.user.id, name: staffName(m.user) ?? '' })).filter((a) => a.name),
      can: { assign: staff.has('client.assign'), archive: staff.has('client.archive'), create: staff.has('client.create') },
    };
  }

  // ─── The record (EA-13) ───────────────────────────────────────────────────

  /** The id of a record the reader may see — or 404. */
  async visibleId(staff: StaffView, id: string): Promise<string> {
    if (!UUID.test(id)) throw AppError.notFound();
    const c = await this.prisma.client.findFirst({ where: { AND: [{ id }, liveClients(staff)] }, select: { id: true } });
    if (!c) throw AppError.notFound();
    return c.id;
  }

  /** `GET /admin/clients/{id}` (`client.read`). */
  async detail(auth: AuthContext, id: string): Promise<ClientDetailResponse> {
    const staff = await this.views.of(auth);
    if (!UUID.test(id)) throw AppError.notFound();
    const pointer = await this.prisma.client.findFirst({ where: { id, mergedIntoId: { not: null } }, select: { mergedIntoId: true } });
    if (pointer?.mergedIntoId) return { mergedIntoId: pointer.mergedIntoId };
    const found = await this.prisma.client.findFirst({ where: { AND: [{ id }, liveClients(staff)] }, select: { id: true } });
    if (!found) throw AppError.notFound();
    const now = this.clock.now();
    const { client: c, blocks, score } = await clientScoreDetail(this.prisma, id);
    const [user, agent, currentDossier, lastLead, counts, openDossiers, duplicates, nextTask, nextAppointment] = await Promise.all([
      c.userId ? this.prisma.user.findUnique({ where: { id: c.userId }, select: { status: true, suspendedReason: true, suspendedAt: true } }) : null,
      c.assignedAgentId ? this.prisma.user.findUnique({ where: { id: c.assignedAgentId }, select: { id: true, firstName: true, lastName: true, status: true } }) : null,
      this.prisma.dossier.findFirst({ where: { clientId: id, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] } }, orderBy: { lastActivityAt: 'desc' }, select: { reference: true, stage: true, status: true } }),
      this.prisma.lead.findFirst({ where: { clientId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { reference: true, kind: true, status: true, createdAt: true } }),
      Promise.all([
        this.prisma.lead.count({ where: { clientId: id } }),
        this.prisma.dossier.count({ where: { clientId: id, deletedAt: null } }),
        this.prisma.clientContact.count({ where: { clientId: id } }),
        this.prisma.favorite.count({ where: { clientId: id } }),
        this.prisma.eventRegistration.count({ where: { clientId: id } }),
        this.prisma.feedback.count({ where: { clientId: id } }),
      ]),
      this.prisma.dossier.count({ where: { clientId: id, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] } } }),
      duplicatesForReader(this.prisma, staff, c),
      staff.has('task.read') ? this.prisma.task.findFirst({ where: { clientId: id, status: 'OPEN', deletedAt: null }, orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }], select: { id: true, title: true, dueAt: true } }) : undefined,
      staff.has('appointment.read') ? this.prisma.appointment.findFirst({ where: { clientId: id, status: { in: ['REQUESTED', 'CONFIRMED'] }, OR: [{ startsAt: null }, { startsAt: { gte: now } }] }, orderBy: [{ startsAt: { sort: 'asc', nulls: 'last' } }], select: { id: true, type: true, startsAt: true } }) : undefined,
    ]);
    const account = accountState(user);
    const masked = staff.masked;
    const hasAccount = account !== 'NONE';
    const fullName = masked ? maskName(c.firstName, c.lastName) : [c.firstName, c.lastName].filter(Boolean).join(' ') || null;
    const detail: ClientDetail = {
      id,
      version: c.version,
      firstName: masked ? null : c.firstName,
      lastName: masked ? null : c.lastName,
      fullName,
      status: c.status as AdminClientStatus,
      score: { value: score, level: scoreLevel(score)!, blocks },
      agent: agent ? { id: agent.id, name: staffName(agent) } : null,
      mine: c.assignedAgentId === staff.userId,
      account,
      source: (c.source as AdminLeadSource | null) ?? null,
      createdAt: c.createdAt.toISOString(),
      lastActivityAt: c.lastActivityAt.toISOString(),
      masked,
      coordinates: {
        email: masked ? maskEmail(c.email) : c.email,
        phone: masked ? maskPhone(c.phone) : c.phone,
        whatsappOptIn: c.whatsappOptIn,
        countryOfResidence: c.countryOfResidence,
        cityOfResidence: masked ? null : c.cityOfResidence,
        timezone: c.timezone,
        preferredContactChannel: c.preferredContactChannel,
        preferredContactSlot: c.preferredContactSlot,
        preferredLanguage: c.preferredLanguage,
        marketingOptIn: c.marketingOptIn,
      },
      banners: {
        doNotContact: c.doNotContact ? { reason: masked ? null : c.doNotContactReason, at: c.doNotContactAt?.toISOString() ?? null } : null,
        restricted: c.restrictedAt ? { at: c.restrictedAt.toISOString(), reason: c.restrictionReason } : null,
        noEmail: !c.email,
        emailBouncedAt: c.emailBouncedAt?.toISOString() ?? null,
        emailDoubtful: c.emailDoubtful,
        phoneCheckNeeded: c.phoneCheckNeeded,
        deletionRequestedAt: user?.suspendedReason === 'DELETION_PENDING' ? (user.suspendedAt?.toISOString() ?? null) : null,
        archived: c.archivedAt ? { at: c.archivedAt.toISOString(), reason: masked ? null : c.archivedReason } : null,
        duplicates: duplicates.map((d) => ({ id: d.id, name: d.name })),
      },
      overview: {
        currentDossier,
        lastLead: lastLead ? { reference: lastLead.reference, kind: lastLead.kind as AdminLeadKind, status: lastLead.status as AdminLeadStatus, createdAt: lastLead.createdAt.toISOString() } : null,
        ...(nextTask !== undefined ? { nextTask: nextTask ? { id: nextTask.id, title: masked ? null : nextTask.title, dueAt: nextTask.dueAt?.toISOString() ?? null } : null } : {}),
        ...(nextAppointment !== undefined ? { nextAppointment: nextAppointment ? { id: nextAppointment.id, type: nextAppointment.type, startsAt: nextAppointment.startsAt?.toISOString() ?? null } : null } : {}),
      },
      counts: { leads: counts[0], dossiers: counts[1], contacts: counts[2], favorites: counts[3], registrations: counts[4], feedback: counts[5] },
      can: {
        update: staff.has('client.update') && !c.gdprErasedAt,
        editEmail: staff.has('client.update') && !hasAccount && !c.gdprErasedAt,
        assign: staff.has('client.assign'),
        archive: staff.has('client.archive') && !c.archivedAt,
        unarchive: staff.has('client.archive') && Boolean(c.archivedAt),
        archiveBlocked: openDossiers > 0 ? 'HAS_OPEN_DOSSIER' : null,
        merge: staff.has('client.merge'),
        sensitive: staff.sensitive,
      },
    };
    return detail;
  }

  // ─── Tabs, loaded on demand (BO-083) ──────────────────────────────────────

  /** « Projet et finances » — PRO-001 sections; the sensitive amounts with `client.sensitive.read` only (ROL-019). */
  async project(auth: AuthContext, id: string): Promise<ClientProjectTab> {
    const staff = await this.views.of(auth);
    await this.visibleId(staff, id);
    const [c, countries, regions, reference, eligibility] = await Promise.all([
      this.prisma.client.findUniqueOrThrow({ where: { id } }),
      this.prisma.country.findMany({ where: { isResidenceOption: true }, orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }], select: { code: true, nameFr: true, currency: true } }),
      this.prisma.region.findMany({ where: { isActive: true, country: { isCatalogueActive: true } }, orderBy: { nameFr: 'asc' }, select: { id: true, nameFr: true, countryCode: true } }),
      this.settings.get('display.referenceCurrency'),
      this.prisma.simulation.findFirst({ where: { clientId: id, type: 'ELIGIBILITY' }, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true, outputs: true } }),
    ]);
    const masked = staff.masked;
    const sensitive = staff.sensitive && !masked;
    const withheld = sensitive ? [] : ['birthDate', 'monthlyIncome', 'otherMonthlyIncome', 'monthlyDebts', 'downPayment', 'employerName', 'profession', 'employedSince', 'employmentType'];
    return {
      version: c.version,
      identity: { firstName: masked ? null : c.firstName, lastName: masked ? null : c.lastName, birthDate: sensitive ? day(c.birthDate) : null, nationalities: c.nationalities },
      contact: {
        phone: masked ? maskPhone(c.phone) : c.phone,
        whatsappOptIn: c.whatsappOptIn,
        countryOfResidence: c.countryOfResidence,
        cityOfResidence: masked ? null : c.cityOfResidence,
        preferredContactChannel: c.preferredContactChannel,
        preferredContactSlot: c.preferredContactSlot,
        timezone: c.timezone,
      },
      situation: { residencyStatus: c.residencyStatus, employmentType: sensitive ? c.employmentType : null, profession: sensitive ? c.profession : null, employerName: sensitive ? c.employerName : null, employedSince: sensitive ? day(c.employedSince) : null },
      project: {
        preferredRegionIds: c.preferredRegionIds,
        preferredTypes: c.preferredTypes,
        minRooms: c.minRooms,
        budgetMax: dec(c.budgetMax),
        budgetCurrency: c.budgetCurrency ?? c.incomeCurrency ?? reference,
        budgetMonthly: dec(c.budgetMonthly),
        budgetMonthlyCurrency: c.budgetMonthlyCurrency,
        purchasePurpose: c.purchasePurpose,
        purchaseTimeframe: c.purchaseTimeframe,
        financingPreference: c.financingPreference,
      } as ClientProjectTab['project'],
      finances: sensitive ? { currency: c.incomeCurrency ?? c.downPaymentCurrency ?? null, monthlyIncome: dec(c.monthlyIncome), otherMonthlyIncome: dec(c.otherMonthlyIncome), monthlyDebts: dec(c.monthlyDebts), downPayment: dec(c.downPayment) } : null,
      withheld,
      lastEligibility: eligibility ? { id: eligibility.id, createdAt: eligibility.createdAt.toISOString(), status: (eligibility.outputs as { status?: string } | null)?.status ?? null } : null,
      options: {
        countries: countries.map((x) => ({ code: x.code, name: x.nameFr })),
        regions: regions.map((r) => ({ id: r.id, name: r.nameFr, countryCode: r.countryCode })),
        currencies: [...new Set([reference, 'EUR', ...countries.map((x) => x.currency)])].sort(),
      },
    } as ClientProjectTab;
  }

  async leads(auth: AuthContext, id: string): Promise<{ data: ClientLeadRow[] }> {
    const staff = await this.views.of(auth);
    await this.visibleId(staff, id);
    if (!staff.has('lead.read')) return { data: [] };
    const rows = await this.prisma.lead.findMany({
      where: { clientId: id, ...(staff.scoped ? { OR: [{ assignedAgentId: staff.userId }, { assignedAgentId: null }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: { reference: true, kind: true, status: true, outcome: true, createdAt: true, property: { select: { reference: true, title: true } }, program: { select: { name: true } }, assignedAgent: { select: { firstName: true, lastName: true, status: true } } },
    });
    return {
      data: rows.map((r) => ({
        reference: r.reference,
        kind: r.kind as AdminLeadKind,
        status: r.status as AdminLeadStatus,
        outcome: r.outcome,
        createdAt: r.createdAt.toISOString(),
        object: r.property ? `${r.property.reference} · ${r.property.title}` : (r.program?.name ?? null),
        agentName: staffName(r.assignedAgent),
      })),
    };
  }

  async dossiers(auth: AuthContext, id: string): Promise<{ data: ClientDossierRow[] }> {
    const staff = await this.views.of(auth);
    await this.visibleId(staff, id);
    if (!staff.has('dossier.read')) return { data: [] };
    const rows = await this.prisma.dossier.findMany({
      where: { clientId: id, deletedAt: null, ...(staff.scoped ? { assignedAgentId: staff.userId } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { reference: true, stage: true, status: true, createdAt: true, property: { select: { title: true } }, assignedAgent: { select: { firstName: true, lastName: true, status: true } } },
    });
    return { data: rows.map((r) => ({ reference: r.reference, stage: r.stage, status: r.status, createdAt: r.createdAt.toISOString(), agentName: staffName(r.assignedAgent), propertyTitle: r.property?.title ?? null })) };
  }

  async favorites(auth: AuthContext, id: string): Promise<ClientFavoritesTab> {
    const staff = await this.views.of(auth);
    await this.visibleId(staff, id);
    const [favorites, alerts] = await Promise.all([
      this.prisma.favorite.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, property: { select: { reference: true, title: true, slug: true, publication: true, deletedAt: true } } } }),
      this.prisma.searchAlert.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' }, select: { id: true, label: true, frequency: true, isActive: true, criteria: true, createdAt: true } }),
    ]);
    return {
      favorites: favorites.map((f) => ({ reference: f.property.reference, title: f.property.title, publicPath: f.property.publication === 'PUBLISHED' && !f.property.deletedAt ? `/biens/${f.property.slug}` : null, addedAt: f.createdAt.toISOString() })),
      alerts: alerts.map((a) => ({ id: a.id, label: a.label, frequency: a.frequency, isActive: a.isActive, criteria: (a.criteria ?? {}) as Record<string, unknown>, createdAt: a.createdAt.toISOString() })),
    };
  }

  async registrations(auth: AuthContext, id: string): Promise<{ data: ClientRegistrationRow[] }> {
    const staff = await this.views.of(auth);
    await this.visibleId(staff, id);
    const rows = await this.prisma.eventRegistration.findMany({ where: { clientId: id }, orderBy: { registeredAt: 'desc' }, select: { id: true, seats: true, status: true, attendedAt: true, event: { select: { title: true, locationLabel: true, startsAt: true, timezone: true } } } });
    return { data: rows.map((r) => ({ id: r.id, eventTitle: r.event.title, locationLabel: r.event.locationLabel, startsAt: r.event.startsAt.toISOString(), timezone: r.event.timezone, seats: r.seats, status: r.status, attendedAt: r.attendedAt?.toISOString() ?? null })) };
  }

  async feedback(auth: AuthContext, id: string): Promise<{ data: ClientFeedbackRow[] }> {
    const staff = await this.views.of(auth);
    await this.visibleId(staff, id);
    const rows = await this.prisma.feedback.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, kind: true, npsScore: true, csatScore: true, comment: true, status: true, createdAt: true } });
    return { data: rows.map((r) => ({ id: r.id, kind: r.kind, npsScore: r.npsScore, csatScore: r.csatScore, comment: staff.masked ? null : r.comment, status: r.status, createdAt: r.createdAt.toISOString() })) };
  }

  async contacts(auth: AuthContext, id: string): Promise<ClientContactsTab> {
    const staff = await this.views.of(auth);
    await this.visibleId(staff, id);
    const rows = await this.prisma.clientContact.findMany({ where: { clientId: id }, orderBy: { createdAt: 'asc' } });
    return {
      data: rows.map((r) => ({ id: r.id, fullName: staff.masked ? (maskName(r.fullName, null) ?? '') : r.fullName, relation: r.relation, phone: staff.masked ? maskPhone(r.phone) : r.phone, email: staff.masked ? maskEmail(r.email) : r.email, canVisitOnBehalf: r.canVisitOnBehalf, notes: staff.masked ? null : r.notes, informedConfirmedAt: r.informedConfirmedAt?.toISOString() ?? null })),
      max: CLIENT_CONTACTS_MAX,
    };
  }

  async consents(auth: AuthContext, id: string): Promise<{ data: ClientConsentRow[] }> {
    const staff = await this.views.of(auth);
    await this.visibleId(staff, id);
    const rows = await this.prisma.consent.findMany({ where: { clientId: id }, orderBy: [{ givenAt: 'desc' }, { id: 'desc' }], take: 200, select: { id: true, type: true, granted: true, givenAt: true, wording: true, documentVersion: true, source: true, proofNote: true, recordedBy: { select: { firstName: true, lastName: true, status: true } } } });
    return { data: rows.map((r) => ({ id: r.id, type: r.type, granted: r.granted, givenAt: r.givenAt.toISOString(), wording: r.wording, documentVersion: r.documentVersion, source: r.source, recordedByName: staffName(r.recordedBy), proofNote: staff.masked ? null : r.proofNote })) };
  }

  // ─── Timeline (BO-050; route `clients/{id}/timeline`) ─────────────────────

  async timeline(auth: AuthContext, id: string, query: { before?: unknown; type?: unknown }): Promise<AdminTimelinePage> {
    const staff = await this.views.of(auth);
    await this.visibleId(staff, id);
    const wanted = typeof query.type === 'string' && query.type ? new Set(query.type.split(',').filter((t): t is TimelineType => (TIMELINE_TYPES as readonly string[]).includes(t))) : null;
    const want = (t: TimelineType) => !wanted || wanted.has(t);
    let before: Date | null = null;
    if (typeof query.before === 'string' && query.before) {
      before = new Date(query.before);
      if (Number.isNaN(before.getTime())) throw new AppError(ErrorCode.BAD_REQUEST);
    }
    const until = before ? { lt: before } : undefined;
    const entries: AdminTimelineEntry[] = [];
    const author = (u: { firstName: string | null; lastName: string | null; status: string; kind?: string } | undefined) =>
      u ? (u.kind && u.kind !== 'STAFF' ? { kind: 'CLIENT' as const, name: null } : { kind: 'STAFF' as const, name: staffName(u) }) : { kind: 'SYSTEM' as const, name: null };

    if (want('SYSTEM')) {
      const audits = await this.prisma.auditLog.findMany({
        where: { entityId: id, entityType: { in: ['Client', 'client'] }, action: { startsWith: 'client.' }, ...(until ? { createdAt: until } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE + 1,
        select: { id: true, action: true, actorId: true, reason: true, createdAt: true },
      });
      const actors = await this.prisma.user.findMany({ where: { id: { in: audits.map((a) => a.actorId).filter((v): v is string => Boolean(v)) } }, select: { id: true, firstName: true, lastName: true, status: true, kind: true } });
      for (const a of audits) {
        entries.push({ id: `audit:${a.id}`, type: 'SYSTEM', code: a.action, params: {}, author: author(actors.find((u) => u.id === a.actorId)), at: a.createdAt.toISOString(), detail: staff.masked ? null : a.reason });
      }
    }
    if (want('LEAD') && staff.has('lead.read')) {
      const leads = await this.prisma.lead.findMany({ where: { clientId: id, ...(until ? { createdAt: until } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: PAGE + 1, select: { id: true, reference: true, kind: true, source: true, createdAt: true } });
      for (const l of leads) entries.push({ id: `lead:${l.id}`, type: 'LEAD', code: 'lead.receivedRef', params: { kind: l.kind, source: l.source, reference: l.reference }, author: { kind: 'CLIENT', name: null }, at: l.createdAt.toISOString(), detail: null });
    }
    if (staff.has('communication.read') && (want('EMAIL') || want('CALL'))) {
      const rows = await this.prisma.communication.findMany({ where: { clientId: id, ...(until ? { occurredAt: until } : {}) }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: PAGE + 1, select: COMMUNICATION_ENTRY_SELECT });
      entries.push(...communicationEntries(rows, staff, want, this.clock.now()));
    }
    if (staff.has('note.read') && want('NOTE')) {
      const rows = await this.prisma.note.findMany({ where: { entityType: 'CLIENT', entityId: id, deletedAt: null, ...(until ? { createdAt: until } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: PAGE + 1, include: { author: { select: { firstName: true, lastName: true, status: true } } } });
      for (const n of rows) {
        const mine = n.authorId === staff.userId && staff.has('note.manage');
        entries.push({
          id: `note:${n.id}`,
          type: 'NOTE',
          code: 'note.written',
          params: {},
          author: { kind: 'STAFF', name: staffName(n.author) },
          at: n.createdAt.toISOString(),
          detail: n.body,
          pinned: n.isPinned,
          note: { id: n.id, canEdit: mine, canDelete: mine || staff.has('note.moderate'), editedAt: n.updatedAt.getTime() - n.createdAt.getTime() > 1000 ? n.updatedAt.toISOString() : null },
        });
      }
    }
    entries.sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at)));
    const page = entries.slice(0, PAGE);
    return { data: page, meta: { nextCursor: entries.length > PAGE ? page[page.length - 1]!.at : null } };
  }
}
