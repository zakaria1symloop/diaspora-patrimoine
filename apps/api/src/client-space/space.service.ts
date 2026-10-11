// `GET /client/space`, `GET /client/dashboard`, `GET /client/dossiers[/{référence}[/timeline]]` — ECL-001, ECL-010 …
// ECL-014, ECL-031, ECL-033. Read-only; every query is scoped to the caller's client record (ROL-030).
import { Injectable } from '@nestjs/common';
import {
  TIMELINE_FAMILIES,
  TIMELINE_FAMILY_KEYS,
  timelineFamilyOf,
  type TimelineFamily,
} from '@dp/contracts';
import type {
  ClientDashboard,
  ClientSpaceSummary,
  DashboardCafe,
  DashboardOverview,
  DossierListItem,
  DossierView,
  LeadKind,
  TimelinePage,
  TodoCard,
} from '@dp/contracts';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { SettingsService } from '../platform/settings.service.js';
import { DossierViews, DOSSIER_SELECT, STEP_OF_STAGE, type DossierRow } from './dossier-view.js';
import { NotificationsService } from './notifications.service.js';
import { SpaceReader } from './space-reader.js';

const DAY = 86_400_000;
const LIVE = ['OPEN', 'ON_HOLD'];
const BEYOND_MATCHING = ['DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION'];
const BEYOND_QUALIFICATION = ['MATCHING', ...BEYOND_MATCHING];

/** PRO-003 — nine pieces of information; the budget counts once, total or monthly. */
export function profileCompletePct(c: {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  countryOfResidence: string | null;
  residencyStatus: string | null;
  purchaseTimeframe: string | null;
  budgetMax: unknown;
  budgetMonthly: unknown;
  downPayment: unknown;
  financingPreference: string | null;
}): number {
  const filled = [
    c.firstName,
    c.lastName,
    c.phone,
    c.countryOfResidence,
    c.residencyStatus,
    c.purchaseTimeframe,
    c.budgetMax ?? c.budgetMonthly,
    c.downPayment,
    c.financingPreference,
  ].filter((v) => v !== null && v !== undefined && v !== '').length;
  return Math.floor((100 * filled) / 9);
}

export const PROFILE_FACTS_SELECT = {
  firstName: true,
  lastName: true,
  phone: true,
  countryOfResidence: true,
  residencyStatus: true,
  purchaseTimeframe: true,
  budgetMax: true,
  budgetMonthly: true,
  downPayment: true,
  financingPreference: true,
} as const;

@Injectable()
export class SpaceService {
  constructor(
    private readonly reader: SpaceReader,
    private readonly views: DossierViews,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  private get prisma() {
    return this.reader.prisma;
  }

  private async dossiersOf(clientId: string): Promise<DossierRow[]> {
    return this.prisma.dossier.findMany({ where: { clientId, deletedAt: null }, orderBy: { lastActivityAt: 'desc' }, select: DOSSIER_SELECT });
  }

  /** ECL-014 — the dossier the dashboard shows: the most recently active open or paused one, else the last won one. */
  private shown(dossiers: DossierRow[]): DossierRow | null {
    return dossiers.find((d) => LIVE.includes(d.status)) ?? dossiers.find((d) => d.status === 'WON') ?? null;
  }

  // ─── Shell ────────────────────────────────────────────────────────────────

  async summary(auth: AuthContext): Promise<ClientSpaceSummary> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { email: true } });
    const client = auth.clientId
      ? await this.prisma.client.findUnique({ where: { id: auth.clientId }, select: { firstName: true, lastName: true, emailBouncedAt: true, timezone: true } })
      : null;
    const dossiers = auth.clientId
      ? await this.prisma.dossier.findMany({
          where: { clientId: auth.clientId, deletedAt: null },
          orderBy: { lastActivityAt: 'desc' },
          select: { id: true, reference: true, stage: true, status: true, lastActivityAt: true, property: { select: { title: true } } },
        })
      : [];
    const ids = dossiers.map((d) => d.id);
    const [unread, docs, proposals] = await Promise.all([
      this.notifications.unreadCount(auth.userId),
      ids.length ? this.prisma.dossierDocument.groupBy({ by: ['dossierId'], where: { dossierId: { in: ids }, isInternal: false }, _count: { _all: true } }) : Promise.resolve([]),
      ids.length ? this.prisma.dossierCandidate.count({ where: { dossierId: { in: ids }, origin: 'ADVISOR_PROPOSAL', sentAt: { not: null }, viewedAt: null, status: 'PROPOSED' } }) : Promise.resolve(0),
    ]);
    const withDocs = new Set(docs.map((d) => d.dossierId));
    const shown = dossiers.find((d) => LIVE.includes(d.status)) ?? dossiers.find((d) => d.status === 'WON') ?? null;
    return {
      firstName: client?.firstName ?? auth.firstName,
      lastName: client?.lastName ?? auth.lastName,
      email: user.email,
      timeZone: client?.timezone ?? (await this.settings.get('business.calendar.timezone')),
      unreadNotifications: unread,
      emailBounced: Boolean(client?.emailBouncedAt),
      dossiers: dossiers.map((d) => ({
        reference: d.reference,
        stage: d.stage,
        status: d.status,
        propertyTitle: d.property?.title ?? null,
        hasDocumentList: withDocs.has(d.id),
        lastActivityAt: d.lastActivityAt.toISOString(),
      })),
      shownDossierReference: shown?.reference ?? null,
      badges: { proposals },
    };
  }

  // ─── Dashboard (EC-10) ────────────────────────────────────────────────────

  async dashboard(auth: AuthContext): Promise<ClientDashboard> {
    const news = await this.notifications.latest(auth.userId, 10);
    const calendarZone = await this.settings.get('business.calendar.timezone');
    const empty: ClientDashboard = {
      firstName: auth.firstName,
      timeZone: calendarZone,
      situation: 'NOTHING',
      dossier: null,
      otherDossiersCount: 0,
      todo: [],
      advisor: null,
      promise: null,
      lead: null,
      closedDossierReference: null,
      profileCompletePct: 0,
      cafe: null,
      overview: { interests: 0, proposalsNew: 0, openRequests: 0, favorites: null, simulations: 0, alerts: null },
      news,
    };
    if (!auth.clientId) return empty;
    const client = await this.prisma.client.findUniqueOrThrow({
      where: { id: auth.clientId },
      select: { ...PROFILE_FACTS_SELECT, timezone: true, assignedAgentId: true },
    });
    const dossiers = await this.dossiersOf(auth.clientId);
    const promiseLead = await this.views.promiseLeadFor(auth.clientId);
    const base: ClientDashboard = { ...empty, firstName: client.firstName, timeZone: client.timezone ?? calendarZone, profileCompletePct: profileCompletePct(client) };
    base.cafe = await this.cafe(auth.clientId, dossiers);
    base.overview = await this.overview(auth.clientId, dossiers.map((d) => d.id));

    const shown = this.shown(dossiers);
    if (shown) {
      const view = await this.views.view(shown, client.timezone, promiseLead);
      const advisorId = shown.assignedAgentId ?? client.assignedAgentId;
      const advisor = await this.reader.advisorCard(advisorId);
      return {
        ...base,
        situation: LIVE.includes(shown.status) ? 'ACTIVE' : 'WON',
        dossier: view,
        otherDossiersCount: dossiers.length - 1,
        todo: LIVE.includes(shown.status) ? await this.todo(shown, base.profileCompletePct) : [],
        advisor,
        promise: await this.reader.promiseOf(promiseLead, client.timezone),
      };
    }

    const lost = dossiers.find((d) => d.status === 'LOST');
    if (lost) {
      // ECL-014 — a message written since the closure is not invisible, while that request is open.
      const lostAt = (await this.prisma.dossier.findUnique({ where: { id: lost.id }, select: { lostAt: true } }))?.lostAt ?? lost.lastActivityAt;
      const since = await this.prisma.lead.findFirst({
        where: { clientId: auth.clientId, status: { in: ['NEW', 'IN_PROGRESS'] }, createdAt: { gt: lostAt } },
        orderBy: { createdAt: 'desc' },
        select: { reference: true, kind: true, createdAt: true, firstContactAt: true },
      });
      return {
        ...base,
        situation: 'CLOSED_ONLY',
        closedDossierReference: lost.reference,
        otherDossiersCount: dossiers.length - 1,
        advisor: await this.reader.advisorCard(lost.assignedAgentId ?? client.assignedAgentId),
        lead: since ? { reference: since.reference, kind: since.kind, createdAt: since.createdAt.toISOString() } : null,
        promise: since && !since.firstContactAt && promiseLead?.reference === since.reference ? await this.reader.promiseOf(promiseLead, client.timezone) : null,
      };
    }

    const openLead =
      promiseLead ??
      (await this.prisma.lead.findFirst({
        where: { clientId: auth.clientId, status: { in: ['NEW', 'IN_PROGRESS'] }, kind: { not: 'PARTNER_REQUEST' } },
        orderBy: { createdAt: 'desc' },
        select: { reference: true, kind: true, createdAt: true },
      }));
    if (openLead) {
      const agent = await this.prisma.lead.findFirst({ where: { reference: openLead.reference }, select: { assignedAgentId: true } });
      return {
        ...base,
        situation: 'LEAD_ONLY',
        lead: { reference: openLead.reference, kind: openLead.kind as LeadKind, createdAt: openLead.createdAt.toISOString() },
        advisor: await this.reader.advisorCard(agent?.assignedAgentId ?? client.assignedAgentId),
        promise: await this.reader.promiseOf(promiseLead, client.timezone),
      };
    }
    return base;
  }

  /**
   * ECL-010 — the counts the dashboard leads with, each the count of the page it opens (INT-001, INT-003, EC-13,
   * SFA-010, SFA-022, SFA-030); computed here (TRV-106). A function switched off answers null: its tile is absent.
   */
  private async overview(clientId: string, dossierIds: string[]): Promise<DashboardOverview> {
    const now = this.clock.now();
    const [favoritesOn, alertsOn] = await Promise.all([this.settings.get('features.favorites'), this.settings.get('features.searchAlerts')]);
    const candidates = dossierIds.length ? { dossierId: { in: dossierIds } } : null;
    const [interests, proposalsNew, openRequests, favorites, simulations, alerts] = await Promise.all([
      candidates
        ? this.prisma.dossierCandidate.count({
            where: {
              ...candidates,
              OR: [{ origin: 'CLIENT_INTEREST' }, { origin: 'ADVISOR_PROPOSAL', sentAt: { not: null }, status: { in: ['INTERESTED', 'VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED', 'SELECTED'] } }],
            },
          })
        : 0,
      candidates ? this.prisma.dossierCandidate.count({ where: { ...candidates, origin: 'ADVISOR_PROPOSAL', sentAt: { not: null }, viewedAt: null, status: 'PROPOSED' } }) : 0,
      this.prisma.lead.count({ where: { clientId, status: { in: ['NEW', 'IN_PROGRESS'] }, kind: { not: 'PARTNER_REQUEST' } } }),
      favoritesOn ? this.prisma.favorite.count({ where: { clientId, property: { deletedAt: null } } }) : null,
      this.prisma.simulation.count({ where: { clientId, isSaved: true } }),
      alertsOn ? this.activeAlerts(clientId, now) : null,
    ]);
    return { interests, proposalsNew, openRequests, favorites, simulations, alerts };
  }

  /** SFA-030 — alerts that send: confirmed, active, not saved searches (those of the client, and of his address). */
  private async activeAlerts(clientId: string, _now: Date): Promise<number> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { email: true } });
    return this.prisma.searchAlert.count({
      where: {
        OR: [{ clientId }, ...(client?.email ? [{ email: client.email.toLowerCase() }] : [])],
        frequency: { not: 'NONE' },
        isActive: true,
        confirmedAt: { not: null },
        deactivatedReason: null,
      },
    });
  }

  /** ECL-011 — five cards at most, by priority; only from an open dossier (a paused one keeps offer, option, appointment). */
  private async todo(d: DossierRow, profilePct: number): Promise<TodoCard[]> {
    const cards: TodoCard[] = [];
    const ref = encodeURIComponent(d.reference.toLowerCase()); // NAV-002: lower-case addresses
    const dossierHref = `/espace-client/dossiers/${ref}`;
    const piecesHref = `${dossierHref}/pieces`;
    const open = d.status === 'OPEN';
    const now = this.clock.now();

    const subs = await this.views.publishedSubmissions(d.id);
    for (const s of subs.filter((x) => x.status === 'APPROVED')) {
      cards.push({
        code: 'OFFER_WAITING',
        params: { bank: s.bank, date: s.offerValidUntil?.toISOString().slice(0, 10), transmitted: Boolean(s.acceptRequestedAt) },
        href: `${dossierHref}/financement`,
      });
    }
    if (open) {
      const counts = await this.views.docCounts(d.id);
      if (d.stage === 'DOCUMENTS' && d.financingRequested && counts.total > 0 && counts.toProvide + counts.toRedo + counts.received === 0 && !(await this.views.transmissionGiven(d.clientId))) {
        cards.push({ code: 'CONSENT_NEEDED', params: {}, href: piecesHref });
      }
      if (counts.toRedo > 0) cards.push({ code: 'DOCUMENTS_TO_REDO', params: { n: counts.toRedo }, href: piecesHref });
      for (const s of subs.filter((x) => x.status === 'INFO_REQUESTED')) cards.push({ code: 'BANK_INFO', params: { bank: s.bank }, href: piecesHref });
      if (counts.toProvide > 0) {
        cards.push({ code: 'DOCUMENTS_TO_PROVIDE', params: { n: counts.toProvide, date: counts.nearestDue?.toISOString().slice(0, 10) }, href: piecesHref });
      }
      if (d.stage === 'DOCUMENTS') {
        // CYC-141 — validated pieces that end within `documents.expiryWarningDays`, without a renewal deposited.
        const days = await this.settings.get('documents.expiryWarningDays').catch(() => 15);
        const until = new Date(now.getTime() + Number(days) * DAY);
        const renew = await this.prisma.dossierDocument.findMany({
          where: { dossierId: d.id, isInternal: false, providedBy: 'CLIENT', status: 'VALIDATED', renewalVersion: null, expiresAt: { not: null, lte: until } },
          select: { expiresAt: true },
          orderBy: { expiresAt: 'asc' },
        });
        if (renew.length) cards.push({ code: 'DOCUMENTS_TO_RENEW', params: { n: renew.length, date: renew[0]!.expiresAt!.toISOString().slice(0, 10) }, href: piecesHref });
      }
    }
    const appt = await this.prisma.appointment.findFirst({
      where: { dossierId: d.id, status: 'CONFIRMED', startsAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY) } },
      orderBy: { startsAt: 'asc' },
      select: { type: true, startsAt: true },
    });
    if (appt?.startsAt) cards.push({ code: 'APPOINTMENT_SOON', params: { type: appt.type, date: appt.startsAt.toISOString() }, href: '/espace-client/rendez-vous' });
    if (open) {
      const fresh = await this.prisma.dossierCandidate.count({ where: { dossierId: d.id, origin: 'ADVISOR_PROPOSAL', sentAt: { not: null }, status: 'PROPOSED', viewedAt: null } });
      if (fresh > 0) cards.push({ code: 'PROPOSALS_NEW', params: { n: fresh }, href: '/espace-client/biens-proposes' });
    }
    const option = await this.prisma.reservation.findFirst({
      where: { dossierId: d.id, status: 'OPTION', optionAcknowledgedAt: { not: null }, optionExpiresAt: { gt: now, lte: new Date(now.getTime() + 3 * DAY) } },
      select: { optionExpiresAt: true, lot: { select: { reference: true } } },
    });
    if (option?.optionExpiresAt) cards.push({ code: 'OPTION_ENDING', params: { lot: option.lot.reference, date: option.optionExpiresAt.toISOString().slice(0, 10) }, href: `${dossierHref}/bien` });
    if (open && profilePct < 100 && !BEYOND_QUALIFICATION.includes(d.stage)) cards.push({ code: 'PROFILE_INCOMPLETE', params: {}, href: '/espace-client/profil' });
    return cards.slice(0, 5);
  }

  /** ECL-010 block 6 — his next Café, else (no dossier beyond MATCHING) the next one open to registration. */
  private async cafe(clientId: string, dossiers: DossierRow[]): Promise<DashboardCafe | null> {
    if (!(await this.settings.get('features.cafe'))) return null;
    const now = this.clock.now();
    const reg = await this.prisma.eventRegistration.findFirst({
      where: { clientId, status: { in: ['REGISTERED', 'WAITLISTED'] }, event: { startsAt: { gt: now }, status: { in: ['PUBLISHED', 'CLOSED'] }, deletedAt: null } },
      orderBy: { event: { startsAt: 'asc' } },
      select: { event: { select: { slug: true, title: true, startsAt: true, timezone: true, cityName: true, venueName: true, locationLabel: true } } },
    });
    if (reg) {
      const e = reg.event;
      return { registered: true, slug: e.slug, title: e.title, startsAt: e.startsAt.toISOString(), timezone: e.timezone, city: e.cityName, venue: e.venueName ?? e.locationLabel };
    }
    if (dossiers.some((d) => BEYOND_MATCHING.includes(d.stage) && d.status !== 'LOST')) return null;
    const next = await this.prisma.event.findFirst({
      where: { status: 'PUBLISHED', deletedAt: null, startsAt: { gt: now }, registrationClosesAt: { gt: now } },
      orderBy: { startsAt: 'asc' },
      select: { slug: true, title: true, startsAt: true, timezone: true, cityName: true, locationLabel: true },
    });
    return next
      ? { registered: false, slug: next.slug, title: next.title, startsAt: next.startsAt.toISOString(), timezone: next.timezone, city: next.cityName, venue: next.locationLabel }
      : null;
  }

  // ─── Dossiers (EC-11, ECL-030 … ECL-033) ──────────────────────────────────

  async dossiers(auth: AuthContext): Promise<{ data: DossierListItem[] }> {
    if (!auth.clientId) return { data: [] };
    const rows = await this.prisma.dossier.findMany({
      where: { clientId: auth.clientId, deletedAt: null },
      select: { reference: true, stage: true, status: true, lastActivityAt: true, createdAt: true, propertyId: true, completenessPct: true, property: { select: { title: true } } },
      orderBy: { lastActivityAt: 'desc' },
    });
    // ECL-033 — the most recent active dossier first.
    rows.sort((a, b) => Number(LIVE.includes(b.status)) - Number(LIVE.includes(a.status)));
    const props = await this.reader.propertySummaries(rows.map((d) => d.propertyId).filter((x): x is string => Boolean(x)));
    return {
      data: rows.map((d) => ({
        reference: d.reference,
        stage: d.stage,
        status: d.status,
        propertyTitle: d.property?.title ?? null,
        lastActivityAt: d.lastActivityAt.toISOString(),
        property: (d.propertyId && props.get(d.propertyId)) || null,
        step: d.status === 'WON' ? 6 : (STEP_OF_STAGE[d.stage] ?? 2),
        // ECL-023 — from DOCUMENTS on, not on a closed dossier.
        completenessPct: BEYOND_MATCHING.includes(d.stage) && LIVE.includes(d.status) ? d.completenessPct : null,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }

  async dossier(auth: AuthContext, reference: string): Promise<DossierView> {
    const d = await this.reader.ownDossier(auth, reference);
    const row = (await this.prisma.dossier.findUniqueOrThrow({ where: { id: d.id }, select: DOSSIER_SELECT })) as DossierRow;
    const client = await this.prisma.client.findUnique({ where: { id: d.clientId }, select: { timezone: true } });
    return this.views.view(row, client?.timezone ?? null);
  }

  /**
   * ECL-031 — most recent first (`occurredAt`, then `id`), 20 lines, cursor pagination (API-010). `family` keeps the
   * lines of one family (TIMELINE_FAMILIES); the counters of every family come with each page (TRV-100, TRV-106).
   */
  async timeline(auth: AuthContext, reference: string, query: { before?: string; limit?: string; family?: string }): Promise<TimelinePage> {
    const d = await this.reader.ownDossier(auth, reference);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    let cursor: { at: Date; id: string } | null = null;
    if (query.before) {
      const [at, id] = Buffer.from(query.before, 'base64url').toString('utf8').split('|');
      const date = new Date(at ?? '');
      if (!id || Number.isNaN(date.getTime())) throw AppError.validation([{ field: 'before', code: 'INVALID_CHOICE' }]);
      cursor = { at: date, id };
    }
    let family: TimelineFamily | null = null;
    if (query.family) {
      if (!(TIMELINE_FAMILY_KEYS as string[]).includes(query.family)) throw AppError.validation([{ field: 'family', code: 'INVALID_CHOICE' }]);
      family = query.family as TimelineFamily;
    }
    const byKind = await this.prisma.clientTimelineEntry.groupBy({ by: ['kind'], where: { dossierId: d.id }, _count: { _all: true } });
    const counts = Object.fromEntries(TIMELINE_FAMILY_KEYS.map((f) => [f, 0])) as Record<TimelineFamily, number>;
    for (const g of byKind) counts[timelineFamilyOf(g.kind)] += g._count._all;
    const rows = await this.prisma.clientTimelineEntry.findMany({
      where: {
        dossierId: d.id,
        ...(family ? { kind: { in: [...TIMELINE_FAMILIES[family]] as never } } : {}),
        ...(cursor ? { OR: [{ occurredAt: { lt: cursor.at } }, { occurredAt: cursor.at, id: { lt: cursor.id } }] } : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      data: page.map((r) => ({ id: r.id, kind: r.kind, occurredAt: r.occurredAt.toISOString(), params: (r.params ?? {}) as Record<string, string | number | null> })),
      meta: {
        nextCursor: rows.length > limit && last ? Buffer.from(`${last.occurredAt.toISOString()}|${last.id}`).toString('base64url') : null,
        total: byKind.reduce((n, g) => n + g._count._all, 0),
        counts,
      },
    };
  }
}
