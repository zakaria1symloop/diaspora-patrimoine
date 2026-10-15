// EA-10, EA-11 in reading (package 2.11) — 04-back-office/03 § 1 and § 2: CRM-001 … CRM-003, CRM-010, CRM-012; MSG-021.
// `GET /admin/leads` (the team's inbox: filters, origin views with their counts, sort, pagination — all by the server,
// TRV-100) and `GET /admin/leads/{référence}`. Read only: nothing is written here. What the reader may see is decided
// here: the adviser's perimeter in the query (ROL-018, SEC-031), the SUPPORT masking (ROL-015, SEC-032) and the
// sensitive values of the form (ROL-019, SEC-033) — a value the reader may not read never leaves the API.
import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  LEAD_VIEWS,
  leadListQuerySchema,
  type AdminLeadKind,
  type AdminLeadSource,
  type AdminLeadStatus,
  type LeadDetail,
  type LeadFieldValue,
  type LeadCan,
  type LeadFirstContact,
  type LeadList,
  type LeadListItem,
  type LeadView,
} from '@dp/contracts';
import { addBusinessDays, businessMinutesBetween, localDate, workdayMinutes, type BusinessCalendar } from '@dp/domain';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { duplicatesForReader } from '../crm/duplicates.js';
import { OPENS_DOSSIER } from '../leads/lead-records.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import {
  clientName,
  dossierScope,
  LEAD_FREE_TEXT_FIELDS,
  LEAD_HIDDEN_FIELDS,
  LEAD_PERSON_FIELDS,
  LEAD_SENSITIVE_FIELDS,
  LEAD_SUPPORT_READABLE_FIELDS,
  leadScope,
  maskEmail,
  maskName,
  maskPhone,
  staffName,
  StaffViews,
  type StaffView,
} from './staff-view.js';

const OPEN: AdminLeadStatus[] = ['NEW', 'IN_PROGRESS'];

const LIST_SELECT = {
  id: true,
  reference: true,
  createdAt: true,
  kind: true,
  status: true,
  source: true,
  firstName: true,
  lastName: true,
  assignedAgentId: true,
  slaDueAt: true,
  firstContactAt: true,
  preferredCallbackDate: true,
  needsReview: true,
  applicationStatus: true,
  outcome: true,
  dossierId: true,
  closedById: true,
  closedAt: true,
  client: { select: { firstName: true, lastName: true } },
  property: { select: { title: true, reference: true } },
  program: { select: { name: true } },
  assignedAgent: { select: { firstName: true, lastName: true, status: true } },
} satisfies Prisma.LeadSelect;
type ListRow = Prisma.LeadGetPayload<{ select: typeof LIST_SELECT }>;

/** The start of a calendar day in a time zone, as an instant. */
export function zonedDayStart(day: string, timeZone: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

/** TRV-103 — the form `Client.searchText` is stored in: unaccented, lower case. */
function fold(q: string): string {
  return q.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * CRM-002 — the column « Premier contact », in business time (CAL-060, CAL-061). Never a red delay on a request that
 * expects nothing any more: closed without contact, spam and partner applications answer `NONE` (« — »).
 */
export function firstContactOf(
  lead: { kind: string; status: string; createdAt: Date; slaDueAt: Date | null; firstContactAt: Date | null; preferredCallbackDate: Date | null },
  now: Date,
  cal: BusinessCalendar,
  firstContactBusinessDays: number,
): LeadFirstContact {
  if (lead.kind === 'PARTNER_REQUEST' || lead.status === 'SPAM') return { state: 'NONE' };
  if (lead.firstContactAt) return { state: 'DONE', businessMinutes: businessMinutesBetween(lead.createdAt, lead.firstContactAt, cal) };
  if (lead.status === 'CLOSED' || !lead.slaDueAt) return { state: 'NONE' };
  if (lead.slaDueAt.getTime() < now.getTime()) return { state: 'LATE', dueAt: lead.slaDueAt.toISOString(), businessMinutes: businessMinutesBetween(lead.slaDueAt, now, cal) };
  // the person chose a later day: the deadline is that day, and the column says so
  const day = lead.preferredCallbackDate?.toISOString().slice(0, 10) ?? null;
  if (day && day > localDate(addBusinessDays(lead.createdAt, firstContactBusinessDays, cal), cal) && day > localDate(now, cal)) return { state: 'CALLBACK', day };
  const left = businessMinutesBetween(now, lead.slaDueAt, cal);
  return { state: 'DUE', dueAt: lead.slaDueAt.toISOString(), businessMinutes: left, soon: left < workdayMinutes(cal) };
}

/** CRM-047 — Chaud (70 and more), Tiède (40 to 69), Froid (under 40). */
export function scoreLevel(score: number | null | undefined): 'HOT' | 'WARM' | 'COLD' | null {
  if (score === null || score === undefined) return null;
  return score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD';
}

/** CYC-008 — a request closed by hand may be reopened within this many days. */
export const LEAD_REOPEN_DAYS = 90;

export interface LeadState {
  kind: string;
  status: string;
  assignedAgentId: string | null;
  firstContactAt: Date | null;
  needsReview: boolean;
  applicationStatus: string | null;
  dossierId: string | null;
  clientId: string | null;
  closedById: string | null;
  closedAt: Date | null;
  /** The client has live dossiers the request is not attached to (« Rattacher au dossier »). */
  liveDossiers?: number;
}

/**
 * CRM-011, BO-047 — what THIS caller may do on THIS request now. An action the role does not hold is ABSENT from the
 * map; one impossible in the current state is present with the reason the screen says (`ui.admin-leads.blocked.*`).
 * The use cases of package 3.2 check the same function before writing (one rule, two readers).
 */
export function leadCan(lead: LeadState, staff: Pick<StaffView, 'userId' | 'role' | 'has'>, now: Date): LeadCan {
  const can: LeadCan = {};
  const ok = { allowed: true } as const;
  const no = (reason: string) => ({ allowed: false as const, reason });
  const open = lead.status === 'NEW' || lead.status === 'IN_PROGRESS';
  const application = lead.applicationStatus !== null; // partner sign-ups: ACP-084, not here
  const mine = lead.assignedAgentId === staff.userId;
  const unrestrictedAssign = staff.role === 'OWNER' || staff.role === 'ADMIN';
  if (staff.has('lead.process')) {
    if (!application) {
      can.take = lead.status !== 'NEW' ? no(lead.status === 'IN_PROGRESS' ? (mine ? 'ALREADY_MINE' : 'ALREADY_TAKEN') : `STATUS_${lead.status}`) : lead.assignedAgentId ? no('ALREADY_TAKEN') : ok;
      if (mine || unrestrictedAssign) {
        can.release = lead.status !== 'IN_PROGRESS' ? no('NOT_IN_PROGRESS') : lead.firstContactAt ? no('FIRST_CONTACT_DONE') : ok;
      }
      can.close = open ? ok : no(`STATUS_${lead.status}`);
      if (lead.status === 'CLOSED') {
        can.reopen = lead.dossierId ? no('ATTACHED_TO_DOSSIER') : !lead.closedById ? no('CLOSED_AUTOMATICALLY') : lead.closedAt && now.getTime() - lead.closedAt.getTime() > LEAD_REOPEN_DAYS * 86_400_000 ? no('TOO_OLD') : ok;
      }
    }
    if (open) can.spam = ok;
    if (lead.status === 'SPAM') can.restore = ok;
    if (lead.needsReview) can.review = ok;
  }
  if (staff.has('lead.assign') && !application) can.assign = open ? ok : no(`STATUS_${lead.status}`);
  // CRM-011 « Créer la fiche partenaire » — a « Devenir partenaire » request (EP-23: notary, insurer, institution, media,
  // other — promoters and banks sign up on EP-32) becomes an other partner (CTL-170, `content.manage`); it then closes.
  if (staff.has('content.manage') && staff.has('lead.process') && lead.kind === 'PARTNER_REQUEST' && !application) can.createPartner = open ? ok : no(`STATUS_${lead.status}`);
  if (staff.has('dossier.create') && lead.kind !== 'PARTNER_REQUEST') {
    const state = !lead.clientId ? no('NO_CLIENT') : lead.dossierId ? no('HAS_DOSSIER') : lead.status === 'SPAM' ? no('STATUS_SPAM') : null;
    if (lead.kind === 'CONTACT_MESSAGE' || (lead.liveDossiers ?? 0) > 0) can.openDossier = state ?? ok;
    if ((lead.liveDossiers ?? 0) > 0 || lead.dossierId) can.attach = state ?? (lead.status === 'CLOSED' ? no('STATUS_CLOSED') : ok);
  }
  return can;
}

/**
 * The fields of a form as a flat list, in the order they were sent; what the reader may not read is left out. EA-11
 * shows what the person SENT: the search criteria the server derives from a guided search's answers (ASS-030) are
 * not part of it, and a region is shown by its name, not its slug (D-108).
 */
export function leadFields(source: Record<string, unknown> | null | undefined, staff: StaffView, withheld: Set<string>, regions: Map<string, string> = new Map()): LeadFieldValue[] {
  const out: LeadFieldValue[] = [];
  const regionName = (v: unknown) => (typeof v === 'string' && regions.has(v) ? regions.get(v)! : v);
  const push = (key: string, leaf: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'criteria') return;
    if (LEAD_PERSON_FIELDS.has(leaf) || LEAD_HIDDEN_FIELDS.has(leaf) || LEAD_FREE_TEXT_FIELDS.has(leaf)) return;
    if (LEAD_SENSITIVE_FIELDS.has(leaf) && !staff.sensitive) {
      withheld.add(key);
      return;
    }
    // a group (the answers of a guided search) is opened: SEC-032 masks value by value, not the whole group
    if (typeof value === 'object' && !Array.isArray(value)) return walk(value, key);
    if (leaf === 'region' || leaf === 'regionSlug') value = Array.isArray(value) ? value.map(regionName) : regionName(value);
    if (staff.masked && !LEAD_SUPPORT_READABLE_FIELDS.has(leaf)) {
      out.push({ key, value: '•••' });
      return;
    }
    if (Array.isArray(value)) {
      if (value.every((v) => typeof v === 'string' || typeof v === 'number')) out.push({ key, value: value.map(String) });
      else value.forEach((v, i) => walk(v, `${key}.${i + 1}`));
      return;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out.push({ key, value });
  };
  const walk = (node: unknown, prefix: string) => {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) push(prefix ? `${prefix}.${k}` : k, k, v);
  };
  walk(source ?? {}, '');
  return out;
}

@Injectable()
export class LeadsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly views: StaffViews,
  ) {}

  // ─── Origin views (CRM-003) ───────────────────────────────────────────────

  /** The preset of an origin view. Partner sign-ups have their own view: they are not « à prendre en charge ». */
  private viewWhere(view: LeadView, staff: StaffView, now: Date): Prisma.LeadWhereInput {
    switch (view) {
      case 'to-take':
        return { status: 'NEW', assignedAgentId: null, applicationStatus: null };
      case 'mine':
        return { assignedAgentId: staff.userId, status: { in: OPEN } };
      case 'late':
        return { status: { in: OPEN }, firstContactAt: null, slaDueAt: { lt: now }, kind: { not: 'PARTNER_REQUEST' } };
      case 'to-review':
        return { needsReview: true };
      case 'partner-applications':
        return { applicationStatus: { not: null } };
      case 'spam':
        return { status: 'SPAM' };
      case 'all':
      default:
        return { status: { not: 'SPAM' } };
    }
  }

  /** BO-011 — the badge of the menu: requests not taken in charge, within the reader's perimeter. */
  async countToTake(staff: StaffView): Promise<number> {
    return this.prisma.lead.count({ where: { AND: [leadScope(staff), this.viewWhere('to-take', staff, this.clock.now())] } });
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

  // ─── List (EA-10) ─────────────────────────────────────────────────────────

  private item(row: ListRow, staff: StaffView, now: Date, cal: BusinessCalendar, slaDays: number): LeadListItem {
    const person = row.client ?? { firstName: row.firstName, lastName: row.lastName };
    return {
      id: row.id,
      reference: row.reference,
      createdAt: row.createdAt.toISOString(),
      kind: row.kind as AdminLeadKind,
      status: row.status as AdminLeadStatus,
      source: row.source as AdminLeadSource,
      clientName: staff.masked ? maskName(person.firstName, person.lastName) : clientName(person),
      object: row.property ? { type: 'PROPERTY', title: row.property.title, reference: row.property.reference } : row.program ? { type: 'PROGRAM', title: row.program.name, reference: null } : null,
      agentName: staffName(row.assignedAgent),
      mine: row.assignedAgentId === staff.userId,
      firstContact: firstContactOf(row, now, cal, slaDays),
      needsReview: row.needsReview,
      applicationStatus: row.applicationStatus,
      outcome: row.outcome,
      hasDossier: row.dossierId !== null,
      canTake: leadCan({ ...row, firstContactAt: row.firstContactAt, clientId: null }, staff, now).take?.allowed === true,
    };
  }

  /** `GET /admin/leads` (`lead.read`). */
  async list(auth: AuthContext, rawQuery: unknown): Promise<LeadList> {
    const staff = await this.views.of(auth);
    const parsed = leadListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST); // API-011
    const query = parsed.data;
    const now = this.clock.now();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { timezone: true } });

    // API-012 — `q` on the reference and the client's name. ROL-015: a SUPPORT account searches by reference only, so
    // that a masked value cannot be guessed by trial.
    const q = query.q && query.q.length >= 2 ? query.q : null;
    let search: Prisma.LeadWhereInput = {};
    if (q) {
      const byReference: Prisma.LeadWhereInput = { reference: { contains: q, mode: 'insensitive' } };
      if (staff.masked) search = byReference;
      else {
        const clientIds = await this.clientIdsMatching(q);
        const words = fold(q).split(/\s+/).filter(Boolean);
        search = {
          OR: [
            byReference,
            ...(clientIds.length ? [{ clientId: { in: clientIds } }] : []),
            // a request without a record (classed as spam at creation): the name as it was sent
            { clientId: null, AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: 'insensitive' as const } }, { lastName: { contains: w, mode: 'insensitive' as const } }] })) },
          ],
        };
      }
    }

    const agents = query.assignedAgentId.filter((v) => v !== 'none');
    const created: Prisma.DateTimeFilter = {};
    if (query.createdFrom) created.gte = zonedDayStart(query.createdFrom, user.timezone);
    if (query.createdTo) created.lt = new Date(zonedDayStart(query.createdTo, user.timezone).getTime() + 86_400_000);

    /** The criteria of the address, with one filter left out to count its values (TRV-106). */
    const criteria = (skip?: 'status' | 'kind' | 'source' | 'country' | 'property' | 'program'): Prisma.LeadWhereInput => ({
      AND: [
        leadScope(staff),
        query.view ? this.viewWhere(query.view, staff, now) : query.status.length ? {} : { status: { not: 'SPAM' } },
        search,
        skip !== 'status' && query.status.length ? { status: { in: query.status } } : {},
        skip !== 'kind' && query.kind.length ? { kind: { in: query.kind } } : {},
        skip !== 'source' && query.source.length ? { source: { in: query.source } } : {},
        query.assignedAgentId.length ? { OR: [...(agents.length ? [{ assignedAgentId: { in: agents } }] : []), ...(query.assignedAgentId.includes('none') ? [{ assignedAgentId: null }] : [])] } : {},
        query.createdFrom || query.createdTo ? { createdAt: created } : {},
        skip !== 'property' && query.propertyId ? { propertyId: query.propertyId } : {},
        skip !== 'program' && query.programId ? { programId: query.programId } : {},
        skip !== 'country' && query.countryOfResidence.length ? { client: { countryOfResidence: { in: query.countryOfResidence } } } : {},
        query.hasDossier ? { dossierId: query.hasDossier === 'true' ? { not: null } : null } : {},
      ],
    });

    // TRV-102 — stable sort: the id is the second criterion.
    const desc = query.sort.startsWith('-');
    const dir = desc ? 'desc' : 'asc';
    const key = query.sort.replace(/^-/, '') as 'createdAt' | 'slaDueAt' | 'kind' | 'status';
    const orderBy: Prisma.LeadOrderByWithRelationInput[] =
      key === 'slaDueAt' ? [{ slaDueAt: { sort: dir, nulls: 'last' } }, { id: 'asc' }] : key === 'createdAt' ? [{ createdAt: dir }, { id: dir }] : [{ [key]: dir }, { createdAt: 'desc' }, { id: 'asc' }];

    const where = criteria();
    const [total, rows, cal, slaDays, byStatus, byKind, bySource, viewCounts, agentRows] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({ where, select: LIST_SELECT, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.calendar.load(),
      this.settings.get('sla.firstContactBusinessDays'),
      this.prisma.lead.groupBy({ by: ['status'], where: criteria('status'), _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['kind'], where: criteria('kind'), _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['source'], where: criteria('source'), _count: { _all: true } }),
      Promise.all(LEAD_VIEWS.map((v) => this.prisma.lead.count({ where: { AND: [leadScope(staff), this.viewWhere(v, staff, now)] } }))),
      this.prisma.membership.findMany({
        where: { revokedAt: null, suspendedAt: null, organization: { type: 'OPERATOR' }, role: { in: ['OWNER', 'ADMIN', 'AGENT'] }, user: { kind: 'STAFF', status: 'ACTIVE' } },
        select: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      }),
    ]);

    // TRV-106 — the countries of the records of the list without the country filter, each with its number of requests
    const countryWhere = criteria('country');
    const countries = await this.prisma.client.groupBy({ by: ['countryOfResidence'], where: { countryOfResidence: { not: null }, leads: { some: countryWhere } }, _count: { _all: true }, orderBy: { _count: { countryOfResidence: 'desc' } }, take: 40 });
    const byCountry: Record<string, number> = {};
    await Promise.all(
      countries.map(async (c) => {
        byCountry[c.countryOfResidence!] = await this.prisma.lead.count({ where: { AND: [countryWhere, { client: { countryOfResidence: c.countryOfResidence } }] } });
      }),
    );
    // CRM-001 — « Bien » and « Programme » filters: the properties and programmes the requests of the list are about,
    // without that filter, each with its number of requests (TRV-106); the 30 most asked.
    const [byProperty, byProgram] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['propertyId'], where: { AND: [criteria('property'), { propertyId: { not: null } }] }, _count: { _all: true }, orderBy: { _count: { propertyId: 'desc' } }, take: 30 }),
      this.prisma.lead.groupBy({ by: ['programId'], where: { AND: [criteria('program'), { programId: { not: null } }] }, _count: { _all: true }, orderBy: { _count: { programId: 'desc' } }, take: 30 }),
    ]);
    const [facetProps, facetProgs] = await Promise.all([
      this.prisma.property.findMany({ where: { id: { in: byProperty.map((r) => r.propertyId!) } }, select: { id: true, reference: true, title: true } }),
      this.prisma.program.findMany({ where: { id: { in: byProgram.map((r) => r.programId!) } }, select: { id: true, name: true } }),
    ]);
    const objectFacets: LeadList['objectFacets'] = [
      ...byProperty.flatMap((r) => {
        const p = facetProps.find((x) => x.id === r.propertyId);
        return p ? [{ id: p.id, type: 'PROPERTY' as const, label: `${p.reference} · ${p.title}`, count: r._count._all }] : [];
      }),
      ...byProgram.flatMap((r) => {
        const p = facetProgs.find((x) => x.id === r.programId);
        return p ? [{ id: p.id, type: 'PROGRAM' as const, label: p.name, count: r._count._all }] : [];
      }),
    ];
    const objects: LeadList['objects'] = [];
    if (query.propertyId) {
      const prop = await this.prisma.property.findUnique({ where: { id: query.propertyId }, select: { id: true, reference: true, title: true } });
      if (prop) objects.push({ id: prop.id, type: 'PROPERTY', label: `${prop.reference} · ${prop.title}` });
    }
    if (query.programId) {
      const prog = await this.prisma.program.findUnique({ where: { id: query.programId }, select: { id: true, name: true } });
      if (prog) objects.push({ id: prog.id, type: 'PROGRAM', label: prog.name });
    }

    const counts = <T extends string>(rowsOf: { _count: { _all: number } }[], keyOf: (r: never) => T) => Object.fromEntries(rowsOf.map((r) => [keyOf(r as never), r._count._all]));
    return {
      data: rows.map((r) => this.item(r, staff, now, cal, slaDays)),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
      views: Object.fromEntries(LEAD_VIEWS.map((v, i) => [v, viewCounts[i]!])) as Record<LeadView, number>,
      facets: {
        status: counts(byStatus, (r: { status: string }) => r.status),
        kind: counts(byKind, (r: { kind: string }) => r.kind),
        source: counts(bySource, (r: { source: string }) => r.source),
        countryOfResidence: byCountry,
      },
      objects,
      objectFacets,
      bulk: { assign: staff.has('lead.assign'), process: staff.has('lead.process') },
      agents: agentRows.map((m) => ({ id: m.user.id, name: staffName(m.user) ?? '' })).filter((a) => a.name),
    };
  }

  // ─── One request (EA-11) ──────────────────────────────────────────────────

  /** `GET /admin/leads/{référence}` (`lead.read`) — outside the reader's perimeter: 404 (BO-015). */
  async detail(auth: AuthContext, reference: string): Promise<LeadDetail> {
    const staff = await this.views.of(auth);
    if (!/^[A-Za-z0-9-]{3,20}$/.test(reference)) throw AppError.notFound();
    const lead = await this.prisma.lead.findFirst({
      where: { AND: [{ reference: reference.toUpperCase() }, leadScope(staff)] },
      include: {
        client: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, countryOfResidence: true, status: true, score: true, doNotContact: true, restrictedAt: true, emailDoubtful: true, emailBouncedAt: true, notDuplicateOfIds: true, mergedIntoId: true } },
        property: { select: { title: true, reference: true, slug: true, publication: true, availability: true, deletedAt: true } },
        program: { select: { name: true, slug: true, publication: true, deletedAt: true } },
        dossier: { select: { id: true, reference: true, stage: true, status: true, originLeadId: true } },
        contextDossier: { select: { reference: true } },
        assignedAgent: { select: { firstName: true, lastName: true, status: true } },
      },
    });
    if (!lead) throw AppError.notFound();
    const now = this.clock.now();
    const [cal, slaDays, regionRows] = await Promise.all([
      this.calendar.load(),
      this.settings.get('sla.firstContactBusinessDays'),
      this.prisma.region.findMany({ select: { slug: true, nameFr: true } }),
    ]);
    const regions = new Map(regionRows.map((r) => [r.slug, r.nameFr]));

    const payload = (lead.payload ?? {}) as { form?: string; fields?: Record<string, unknown>; context?: Record<string, string | undefined>; step2?: { receivedAt: string; fields: Record<string, unknown> } | null };
    const withheld = new Set<string>();
    const ctx = payload.context ?? {};
    const currency = ctx.currencyShown ?? null;
    const seen =
      ctx.propertyTitle || ctx.programName || ctx.priceShown
        ? {
            propertyTitle: ctx.propertyTitle ?? null,
            propertyReference: ctx.propertyReference ?? null,
            lotReference: ctx.lotReference ?? null,
            programName: ctx.programName ?? null,
            price: ctx.priceShown && currency ? { amount: ctx.priceShown, currency } : null,
            monthly: ctx.monthlyShown && currency ? { amount: ctx.monthlyShown, currency } : null,
          }
        : null;

    type Supp = { receivedAt: string; fields: Record<string, unknown>; message: string | null; step2?: { receivedAt: string; fields: Record<string, unknown> } | null };
    const supplements: LeadDetail['sent']['supplements'] = [];
    if (payload.step2) supplements.push({ at: payload.step2.receivedAt, fields: leadFields(payload.step2.fields, staff, withheld, regions), message: null });
    for (const s of (lead.supplements as Supp[] | null) ?? []) {
      supplements.push({ at: s.receivedAt, fields: leadFields(s.fields, staff, withheld, regions), message: staff.masked ? null : s.message });
      if (s.step2) supplements.push({ at: s.step2.receivedAt, fields: leadFields(s.step2.fields, staff, withheld, regions), message: null });
    }
    supplements.sort((a, b) => a.at.localeCompare(b.at));

    // CRM-010 — alerts of the zone « Client et suite ».
    const alerts: LeadDetail['followUp']['alerts'] = [];
    let duplicates: { id: string; name: string | null }[] = [];
    const c = lead.client;
    if (c) {
      const sentPhone = (payload.fields?.phone as string | undefined) ?? lead.phone;
      const sentCountry = payload.fields?.countryOfResidence as string | undefined;
      const sentFirst = (payload.fields?.firstName as string | undefined) ?? lead.firstName;
      const sentLast = (payload.fields?.lastName as string | undefined) ?? lead.lastName;
      const differs = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && fold(a.trim()) !== fold(b.trim()));
      // MOD-300 — a value sent differs from the one already on the record.
      if (differs(sentPhone, c.phone) || differs(sentCountry, c.countryOfResidence) || differs(sentFirst, c.firstName) || differs(sentLast, c.lastName)) alerts.push('DIFFERENT_INFO');
      // MOD-301 — another record carries the same phone with another address (never merged automatically).
      duplicates = await duplicatesForReader(this.prisma, staff, c);
      if (duplicates.length) alerts.push('POSSIBLE_DUPLICATE');
      if (c.emailDoubtful) alerts.push('EMAIL_DOUBTFUL');
      if (c.emailBouncedAt) alerts.push('EMAIL_BOUNCED');
    }

    const others = lead.clientId
      ? await this.prisma.lead.findMany({
          where: { AND: [{ clientId: lead.clientId, id: { not: lead.id } }, leadScope(staff)] },
          select: { reference: true, kind: true, status: true, createdAt: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 20,
        })
      : [];

    const liveDossiers = lead.clientId
      ? await this.prisma.dossier.findMany({
          where: { AND: [{ clientId: lead.clientId, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] }, ...(lead.dossierId ? { id: { not: lead.dossierId } } : {}) }, dossierScope(staff)] },
          select: { id: true, reference: true, stage: true, status: true },
          orderBy: { lastActivityAt: 'desc' },
          take: 10,
        })
      : [];
    const can = leadCan({ ...lead, liveDossiers: liveDossiers.length }, staff, now);
    const utm = (lead.utm ?? null) as Record<string, string> | null;
    const person = { firstName: lead.firstName, lastName: lead.lastName, email: lead.email, phone: lead.phone };
    const published = (p: { publication: string; deletedAt: Date | null }) => p.publication === 'PUBLISHED' && !p.deletedAt;
    return {
      id: lead.id,
      reference: lead.reference,
      kind: lead.kind as AdminLeadKind,
      status: lead.status as AdminLeadStatus,
      source: lead.source as AdminLeadSource,
      createdAt: lead.createdAt.toISOString(),
      firstContact: firstContactOf(lead, now, cal, slaDays),
      agentName: staffName(lead.assignedAgent),
      agentId: lead.assignedAgentId,
      mine: lead.assignedAgentId === staff.userId,
      outcome: lead.outcome,
      closedAt: lead.closedAt?.toISOString() ?? null,
      closeNote: staff.masked ? null : lead.closeNote,
      can,
      needsReview: lead.needsReview,
      applicationStatus: lead.applicationStatus,
      sent: {
        form: payload.form ?? null,
        person: staff.masked
          ? { firstName: null, lastName: maskName(person.firstName, person.lastName), email: maskEmail(person.email), phone: maskPhone(person.phone) }
          : person,
        fields: leadFields(payload.fields, staff, withheld, regions),
        withheld: [...withheld],
        message: staff.masked ? null : lead.message,
        subject: lead.subject,
        seen,
        callback: lead.preferredCallbackDate || lead.preferredSlot ? { day: lead.preferredCallbackDate?.toISOString().slice(0, 10) ?? null, slot: lead.preferredSlot, callerTimezone: lead.callerTimezone } : null,
        supplements,
        masked: staff.masked,
      },
      context: {
        property: lead.property
          ? { title: lead.property.title, reference: lead.property.reference, publicPath: published(lead.property) ? `/biens/${lead.property.slug}` : null, availability: lead.property.availability, status: lead.property.publication }
          : null,
        program: lead.program ? { name: lead.program.name, publicPath: published(lead.program) ? `/programmes/${lead.program.slug}` : null, status: lead.program.publication } : null,
        hasSimulation: lead.simulationId !== null,
        submittedFromPath: lead.submittedFromPath,
        campaign: utm ? { source: utm.utm_source ?? utm.source ?? null, medium: utm.utm_medium ?? utm.medium ?? null, campaign: utm.utm_campaign ?? utm.campaign ?? null } : null,
        referrer: lead.referrer,
        locale: lead.locale,
        spamScore: lead.spamScore,
        // stored as `[{ code, points }]` (CAL-070); the screen shows the label of each code (`SpamSignal`)
        spamSignals: Array.isArray(lead.spamSignals) ? (lead.spamSignals as unknown[]).map((s) => (typeof s === 'string' ? s : typeof (s as { code?: unknown })?.code === 'string' ? (s as { code: string }).code : null)).filter((s): s is string => s !== null) : [],
      },
      followUp: {
        client: c
          ? {
              id: staff.masked ? null : c.id,
              name: staff.masked ? maskName(c.firstName, c.lastName) : clientName(c),
              status: c.status,
              score: c.score,
              scoreLevel: scoreLevel(c.score),
              withoutEmail: !c.email,
              doNotContact: c.doNotContact,
              restricted: c.restrictedAt !== null,
            }
          : null,
        alerts,
        duplicates,
        liveDossiers: liveDossiers.map((d) => ({ id: d.id, reference: d.reference, stage: d.stage, status: d.status })),
        pendingDecision: !lead.dossierId && OPENS_DOSSIER.has(lead.kind) && lead.status !== 'SPAM' && liveDossiers.length > 0,
        dossier: lead.dossier
          ? {
              id: lead.dossier.id,
              reference: lead.dossier.reference,
              stage: lead.dossier.stage,
              status: lead.dossier.status,
              closableWithLead: lead.dossier.originLeadId === lead.id && ['OPEN', 'ON_HOLD'].includes(lead.dossier.status) && staff.has('dossier.close'),
            }
          : null,
        writtenFromDossier: lead.contextDossier?.reference ?? null,
        otherLeads: others.map((o) => ({ reference: o.reference, kind: o.kind as AdminLeadKind, status: o.status as AdminLeadStatus, createdAt: o.createdAt.toISOString() })),
      },
    };
  }

  /** The id of a request the reader may see (for its timeline and its notes); 404 otherwise. */
  async visibleId(staff: StaffView, id: string): Promise<string> {
    const lead = await this.prisma.lead.findFirst({ where: { AND: [{ id }, leadScope(staff)] }, select: { id: true } });
    if (!lead) throw AppError.notFound();
    return lead.id;
  }
}
