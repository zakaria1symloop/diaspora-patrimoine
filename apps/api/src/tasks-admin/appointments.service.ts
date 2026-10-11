// EA-31 — the appointments of the team (TAC-040 … TAC-047, CYC-080) and the agenda (TAC-035, TAC-036), plus the client's
// appointments (EC-14: INT-041, INT-042). Times: for a visit on site or a meeting the hour is the PLACE's
// (`placeTimezone`, the zone of the property's country; otherwise the business calendar's); for a call or a visio it is
// typed in the adviser's zone and the client's local hour is shown next to it. `clientNotifiedAt`: an e-mail informed
// the client; without it, neither reminder nor cancellation e-mail leave — the appointment is still in his space.
// Effects on the considered property (CYC-070) through `applyVisitEffect`; « Tenu » counts as first contact (CYC-004)
// through `syncFirstContact`. Every write: one transaction, its audit row (`appointment.created`, `appointment.updated`,
// `appointment.outcome_corrected`), its event.
import { Inject, Injectable } from '@nestjs/common';
import {
  APPOINTMENT_VIEWS,
  ErrorCode,
  agendaQuerySchema,
  appointmentCancelSchema,
  appointmentConfirmSchema,
  appointmentCorrectSchema,
  appointmentCreateSchema,
  appointmentDoneSchema,
  appointmentListQuerySchema,
  appointmentRescheduleSchema,
  appointmentUpdateSchema,
  clientAppointmentCancelSchema,
  grantOf,
  type Agenda,
  type AppointmentClientPick,
  type AppointmentItem,
  type AppointmentList,
  type AppointmentView,
  type AppointmentWarnings,
  type ClientAppointment,
  type ClientAppointments,
  type TaskAbility,
} from '@dp/contracts';
import { isBusinessInstant } from '@dp/domain';
import { stampBy, type Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import { localDay, zonedInstant } from '../automation/timing.js';
import { clientName, clientScope, dossierScope, maskName, staffName, StaffViews, type StaffView } from '../back-office/staff-view.js';
import { advisorDisplayName } from '../client-space/timeline.js';
import { syncFirstContact } from '../crm/first-contact.js';
import { applyVisitEffect, signalHoldActivity, touchDossier, type VisitEffect } from '../dossiers-admin/candidate-effects.js';
import { buildIcs } from '../events/ics.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { loadAdvisors } from '../leads/assignment.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { currentRequestId } from '../platform/request-context.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';

const DAY = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** TAC-042 « Corriger l'issue » — within 7 days. */
export const CORRECT_DAYS = 7;
/** TAC-043 — the client's hour is announced before 8:00 and after 21:00. */
export const CLIENT_HOURS = { from: 8, to: 21 } as const;

const INCLUDE = {
  client: { select: { id: true, firstName: true, lastName: true, timezone: true, email: true } },
  dossier: { select: { id: true, reference: true, status: true } },
  property: { select: { id: true, title: true, reference: true } },
  staffUser: { select: { id: true, firstName: true, lastName: true, status: true, timezone: true } },
  onBehalfContact: { select: { fullName: true } },
} satisfies Prisma.AppointmentInclude;
type Row = Prisma.AppointmentGetPayload<{ include: typeof INCLUDE }>;

/** What a change of status does to the considered property (CYC-070, CYC-080). */
export function effectOf(to: 'CONFIRMED' | 'DONE' | 'NO_SHOW' | 'CANCELLED' | 'REQUESTED'): VisitEffect {
  return to === 'DONE' ? 'DONE' : to === 'CONFIRMED' ? 'PLANNED' : to === 'REQUESTED' ? 'REQUESTED' : 'RELEASED';
}

/** TAC-043 — the client's local hour (« 6 h 30 ») when it is before 8:00 or after 21:00, else null. */
export function earlyOrLateHour(at: Date, timeZone: string): string | null {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return h < CLIENT_HOURS.from || h >= CLIENT_HOURS.to ? `${h} h ${m}` : null;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendarService,
    private readonly views: StaffViews,
    private readonly outbox: OutboxWriter,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  /** ROL-018 — an appointment follows its dossier, else its client; an adviser in restricted mode also sees his own. */
  scope(staff: StaffView): Prisma.AppointmentWhereInput {
    if (!staff.scoped && grantOf(staff.role, 'appointment.read') !== 'scoped') return {};
    if (!staff.scoped) return {};
    return { OR: [{ staffUserId: staff.userId }, { dossier: dossierScope(staff) }, { dossierId: null, client: clientScope(staff) }] };
  }

  private abilities(staff: StaffView, a: Row, now: Date): AppointmentItem['can'] {
    const manage = staff.has('appointment.manage');
    const g = (ok: boolean, reason: string): TaskAbility => (!manage ? false : ok ? true : { reason });
    const started = a.startsAt ? a.startsAt.getTime() <= now.getTime() : false;
    const finished = ['DONE', 'NO_SHOW', 'CANCELLED'].includes(a.status);
    return {
      confirm: a.status === 'REQUESTED' ? g(true, '') : false,
      reschedule: a.status === 'CONFIRMED' ? g(true, '') : false,
      cancel: finished ? false : g(!started || a.status === 'REQUESTED', 'APPOINTMENT_STARTED'),
      done: a.status === 'CONFIRMED' ? g(started, 'APPOINTMENT_NOT_STARTED') : false,
      noShow: a.status === 'CONFIRMED' ? g(started, 'APPOINTMENT_NOT_STARTED') : false,
      correct: finished ? g(now.getTime() - a.updatedAt.getTime() <= CORRECT_DAYS * DAY, 'CORRECTION_TOO_LATE') : false,
      edit: finished ? false : g(true, ''),
    };
  }

  item(a: Row, staff: StaffView, now: Date): AppointmentItem {
    const masked = staff.masked;
    return {
      id: a.id,
      version: a.version,
      type: a.type,
      status: a.status,
      startsAt: a.startsAt?.toISOString() ?? null,
      endsAt: a.endsAt?.toISOString() ?? null,
      clientTimezone: a.timezone,
      placeTimezone: a.placeTimezone,
      client: { id: a.client.id, name: masked ? maskName(a.client.firstName, a.client.lastName) : clientName(a.client) },
      dossier: a.dossier ? { id: a.dossier.id, reference: a.dossier.reference } : null,
      property: a.property,
      candidateId: a.candidateId,
      staff: a.staffUser ? { id: a.staffUser.id, name: staffName(a.staffUser) } : null,
      location: masked ? null : a.locationText,
      meetingUrl: masked ? null : a.meetingUrl,
      host: { name: masked ? null : a.hostName, phone: masked ? null : a.hostPhone },
      onBehalf: masked ? null : (a.onBehalfContact?.fullName ?? null),
      clientNote: masked ? null : a.clientNote,
      internalNote: masked ? null : a.internalNote,
      outcomeNote: masked ? null : a.outcomeNote,
      cancelReason: masked ? null : a.cancelReason,
      cancelledBy: a.cancelledBy,
      clientNotified: a.clientNotifiedAt !== null,
      requestedSlots: Array.isArray(a.requestedSlots) ? (a.requestedSlots as { date: string; slot: string }[]) : [],
      can: this.abilities(staff, a, now),
    };
  }

  // ─── Reading ──────────────────────────────────────────────────────────────

  private viewWhere(view: AppointmentView, now: Date): Prisma.AppointmentWhereInput {
    switch (view) {
      case 'to-confirm':
        return { status: 'REQUESTED' };
      case 'upcoming':
        return { status: 'CONFIRMED', startsAt: { gte: now } };
      case 'to-report':
        return { status: 'CONFIRMED', startsAt: { lt: now } };
      default:
        return { status: { in: ['DONE', 'NO_SHOW', 'CANCELLED'] } };
    }
  }

  /** `GET /admin/appointments` (`appointment.read`) — TAC-046. */
  async list(auth: AuthContext, rawQuery: unknown): Promise<AppointmentList> {
    const staff = await this.views.of(auth);
    const parsed = appointmentListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    const q = parsed.data;
    const now = this.clock.now();
    const view = q.view ?? 'upcoming';
    const agents = q.staffUserId.filter((v) => v !== 'none');
    const where: Prisma.AppointmentWhereInput = {
      AND: [
        this.scope(staff),
        this.viewWhere(view, now),
        agents.length ? { staffUserId: { in: agents } } : {},
        q.type.length ? { type: { in: q.type } } : {},
        q.dossierId ? { dossierId: q.dossierId } : {},
        q.clientId ? { clientId: q.clientId } : {},
      ],
    };
    const order: Prisma.AppointmentOrderByWithRelationInput[] = view === 'past' ? [{ startsAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }] : [{ startsAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }];
    const [total, rows, counts] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({ where, include: INCLUDE, orderBy: order, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      Promise.all(APPOINTMENT_VIEWS.map((v) => this.prisma.appointment.count({ where: { AND: [this.scope(staff), this.viewWhere(v, now)] } }))),
    ]);
    return {
      data: rows.map((r) => this.item(r, staff, now)),
      meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
      views: Object.fromEntries(APPOINTMENT_VIEWS.map((v, i) => [v, counts[i]!])) as Record<AppointmentView, number>,
    };
  }

  private async visible(staff: StaffView, id: string): Promise<Row> {
    if (!UUID.test(id)) throw AppError.notFound();
    const a = await this.prisma.appointment.findFirst({ where: { AND: [{ id }, this.scope(staff)] }, include: INCLUDE });
    if (!a) throw AppError.notFound();
    return a;
  }

  /** `GET /admin/appointments/{id}` (`appointment.read`). */
  async detail(auth: AuthContext, id: string): Promise<AppointmentItem> {
    const staff = await this.views.of(auth);
    return this.item(await this.visible(staff, id), staff, this.clock.now());
  }

  /** `GET /admin/agenda` (`appointment.read`) — TAC-035: appointments, dated tasks, Cafés hosted, in the member's zone. */
  async agenda(auth: AuthContext, rawQuery: unknown): Promise<Agenda> {
    const staff = await this.views.of(auth);
    const parsed = agendaQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    const q = parsed.data;
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { timezone: true } });
    const timeZone = me.timezone;
    const from = zonedInstant(q.from, '00:00', timeZone);
    const to = new Date(zonedInstant(q.to, '00:00', timeZone).getTime() + DAY);
    // TAC-035 — an administrator overlays colleagues; the others read their own agenda.
    const canOverlay = staff.has('task.manage.all');
    const wanted = q.staff.filter((v) => v !== 'none');
    const staffIds = canOverlay && wanted.length ? wanted : [auth.userId];
    const now = this.clock.now();
    const [appointments, tasks, cafes, advisors] = await Promise.all([
      this.prisma.appointment.findMany({ where: { AND: [this.scope(staff), { staffUserId: { in: staffIds } }, { OR: [{ startsAt: { gte: from, lt: to } }, { status: 'REQUESTED', startsAt: null }] }] }, include: INCLUDE, orderBy: { startsAt: 'asc' } }),
      staff.has('task.read')
        ? this.prisma.task.findMany({ where: { deletedAt: null, assigneeId: { in: staffIds }, dueAt: { gte: from, lt: to }, status: { in: ['OPEN', 'DONE'] } }, select: { id: true, title: true, dueAt: true, dueHasTime: true, priority: true, status: true, assigneeId: true, origin: true }, orderBy: { dueAt: 'asc' } })
        : Promise.resolve([]),
      this.prisma.event.findMany({ where: { deletedAt: null, hostUserId: { in: staffIds }, startsAt: { gte: from, lt: to }, status: { not: 'DRAFT' } }, select: { id: true, title: true, startsAt: true, endsAt: true, timezone: true, hostUserId: true } }),
      loadAdvisors(this.prisma as unknown as Tx),
    ]);
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set([...advisors.map((a) => a.userId), auth.userId])] } }, select: { id: true, firstName: true, lastName: true } });
    return {
      from: q.from,
      to: q.to,
      timeZone,
      staff: users.map((u) => ({ id: u.id, name: staffName({ ...u, status: 'ACTIVE' }) ?? '', me: u.id === auth.userId })).filter((u) => u.name).sort((a, b) => (a.me ? -1 : b.me ? 1 : a.name.localeCompare(b.name, 'fr'))),
      appointments: appointments.map((a) => this.item(a, staff, now)),
      tasks: tasks.map((t) => ({ id: t.id, title: staff.masked && t.origin === 'MANUAL' ? '•••' : t.title, dueAt: t.dueAt!.toISOString(), dueHasTime: t.dueHasTime, priority: t.priority, status: t.status, staffId: t.assigneeId })),
      cafes: cafes.map((c) => ({ id: c.id, title: c.title, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString(), timezone: c.timezone, staffId: c.hostUserId })),
      canOverlay,
    };
  }

  /** `GET /admin/appointments/pickers/clients?q=` (`appointment.manage`) — TAC-040: the client, his live dossiers and their considered properties. */
  async pickClients(auth: AuthContext, q: unknown, id?: unknown): Promise<{ data: AppointmentClientPick[] }> {
    const staff = await this.views.of(auth);
    const term = typeof q === 'string' ? q.trim().slice(0, 120) : '';
    let ids: string[] | null = null;
    if (typeof id === 'string' && UUID.test(id)) ids = [id];
    else if (term.length >= 2) {
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT c.id FROM clients c WHERE c.deleted_at IS NULL AND (c.search_text LIKE '%' || lower(public.f_unaccent(${term})) || '%' OR word_similarity(lower(public.f_unaccent(${term})), c.search_text) >= 0.6) LIMIT 200`;
      ids = rows.map((r) => r.id);
      if (!ids.length) return { data: [] };
    }
    const clients = await this.prisma.client.findMany({
      where: { AND: [{ deletedAt: null, mergedIntoId: null, gdprErasedAt: null }, clientScope(staff), ids ? { id: { in: ids } } : {}] },
      orderBy: [{ lastActivityAt: 'desc' }, { id: 'asc' }],
      take: 12,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        timezone: true,
        clientContacts: { select: { id: true, fullName: true } },
        dossiers: {
          where: { deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] } },
          orderBy: [{ status: 'asc' }, { lastActivityAt: 'desc' }],
          select: { id: true, reference: true, status: true, dossierCandidates: { where: { status: { notIn: ['DECLINED', 'UNAVAILABLE'] }, OR: [{ origin: 'CLIENT_INTEREST' }, { sentAt: { not: null } }] }, select: { id: true, property: { select: { title: true, reference: true, country: { select: { timezone: true } } } } } } },
        },
      },
    });
    return {
      data: clients.map((c) => ({
        id: c.id,
        name: clientName(c),
        email: c.email,
        phone: c.phone,
        timezone: c.timezone,
        contacts: c.clientContacts.map((x) => ({ id: x.id, name: x.fullName })),
        dossiers: c.dossiers.map((d) => ({ id: d.id, reference: d.reference, status: d.status, candidates: d.dossierCandidates.map((x) => ({ id: x.id, title: x.property.title, reference: x.property.reference, countryTimezone: x.property.country?.timezone ?? null })) })),
      })),
    };
  }

  /** `GET /admin/appointments/warnings` (`appointment.manage`) — TAC-043: overlap, outside working hours, the client's hour. */
  async warnings(auth: AuthContext, query: Record<string, unknown>): Promise<AppointmentWarnings> {
    const startsAt = typeof query.startsAt === 'string' ? new Date(query.startsAt) : null;
    const endsAt = typeof query.endsAt === 'string' ? new Date(query.endsAt) : null;
    if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new AppError(ErrorCode.BAD_REQUEST);
    const staffUserId = typeof query.staffUserId === 'string' && UUID.test(query.staffUserId) ? query.staffUserId : auth.userId;
    const exceptId = typeof query.except === 'string' && UUID.test(query.except) ? query.except : undefined;
    const [overlap, cal, client] = await Promise.all([
      this.prisma.appointment.findFirst({ where: { staffUserId, status: 'CONFIRMED', startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { startsAt: true, endsAt: true } }),
      this.calendar.load(),
      typeof query.clientId === 'string' && UUID.test(query.clientId) ? this.prisma.client.findUnique({ where: { id: query.clientId }, select: { timezone: true } }) : null,
    ]);
    const remote = query.type === 'CALL' || query.type === 'VISIO';
    return {
      overlap: overlap ? { startsAt: overlap.startsAt!.toISOString(), endsAt: overlap.endsAt!.toISOString() } : null,
      outsideHours: !isBusinessInstant(startsAt, cal) || !isBusinessInstant(new Date(endsAt.getTime() - 60_000), cal),
      clientHour: remote && client?.timezone ? earlyOrLateHour(startsAt, client.timezone) : null,
    };
  }

  // ─── Writes ───────────────────────────────────────────────────────────────

  private async emit(tx: Tx, a: { id: string; clientId: string; dossierId: string | null; type: string; hostName: string | null }, type: string, actor: Actor, now: Date, data: Record<string, unknown> = {}): Promise<void> {
    await this.outbox.add(
      tx,
      domainEvent({ type, aggregate: { type: 'Appointment', id: a.id }, actor: actor.type === 'USER' ? { type: 'USER', id: actor.userId } : { type: 'SYSTEM', id: null }, clientId: a.clientId, dossierId: a.dossierId, data: { type: a.type, hadHost: Boolean(a.hostName), ...data }, requestId: currentRequestId() }),
      now,
    );
  }

  /** CYC-004 — « Tenu » is a first contact; a correction recomputes it. */
  private async firstContact(tx: Tx, clientId: string, actor: Actor, now: Date): Promise<void> {
    await syncFirstContact(tx, this.outbox, { clientId, actor, now });
  }

  /** ECL-031 « {Type de rendez-vous} avec {conseiller}. » — a held appointment of a dossier. */
  private async heldLine(tx: Tx, a: { dossierId: string | null; type: string; staffUserId: string | null }, now: Date): Promise<void> {
    if (!a.dossierId) return;
    const u = a.staffUserId ? await tx.user.findUnique({ where: { id: a.staffUserId }, select: { firstName: true, lastName: true } }) : null;
    await tx.clientTimelineEntry.create({ data: { id: newId(), dossierId: a.dossierId, kind: 'APPOINTMENT_DONE', occurredAt: now, params: { type: a.type, conseiller: advisorDisplayName(u?.firstName ?? null, u?.lastName ?? null) } as never, createdAt: now } });
  }

  private async act(auth: AuthContext, id: string, fn: (tx: Tx, a: Row, staff: StaffView, now: Date) => Promise<void>): Promise<AppointmentItem> {
    const staff = await this.views.of(auth);
    await this.visible(staff, id);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT id FROM appointments WHERE id = $1::uuid FOR UPDATE`, id);
      const a = await tx.appointment.findUniqueOrThrow({ where: { id }, include: INCLUDE });
      await fn(tx, a, staff, now);
    }, { timeout: 30_000 });
    this.dispatcher.wake();
    return this.detail(auth, id);
  }

  /** `POST /admin/appointments` (`appointment.manage`) — TAC-040; a past date creates it « Tenu », without e-mail (TAC-044). */
  async create(auth: AuthContext, body: unknown): Promise<AppointmentItem> {
    const input = parseOrThrow(appointmentCreateSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    const client = await this.prisma.client.findFirst({ where: { AND: [{ id: input.clientId, deletedAt: null, gdprErasedAt: null }, clientScope(staff)] }, select: { id: true, timezone: true, email: true } });
    if (!client) throw AppError.validation([{ field: 'clientId', code: 'INVALID_CHOICE' }]);
    let dossierId: string | null = null;
    if (input.dossierId) {
      const d = await this.prisma.dossier.findFirst({ where: { id: input.dossierId, clientId: client.id, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] } }, select: { id: true } });
      if (!d) throw AppError.validation([{ field: 'dossierId', code: 'INVALID_CHOICE' }]);
      dossierId = d.id;
    }
    let propertyId: string | null = null;
    if (input.candidateId) {
      const c = await this.prisma.dossierCandidate.findFirst({ where: { id: input.candidateId, dossierId: dossierId ?? '00000000-0000-0000-0000-000000000000', status: { notIn: ['DECLINED', 'UNAVAILABLE'] } }, select: { propertyId: true } });
      // BO-047 / TAC-040 — « Ajoutez d'abord le bien aux biens envisagés du dossier. »
      if (!c) throw AppError.validation([{ field: 'candidateId', code: 'INVALID_CHOICE' }]);
      propertyId = c.propertyId;
    }
    const staffUserId = input.staffUserId ?? auth.userId;
    if (!(await loadAdvisors(this.prisma as unknown as Tx)).some((a) => a.userId === staffUserId)) throw AppError.validation([{ field: 'staffUserId', code: 'INVALID_CHOICE' }]);
    if (input.onBehalfContactId && !(await this.prisma.clientContact.findFirst({ where: { id: input.onBehalfContactId, clientId: client.id }, select: { id: true } }))) throw AppError.validation([{ field: 'onBehalfContactId', code: 'INVALID_CHOICE' }]);
    const startsAt = zonedInstant(input.date, input.time, input.zone);
    if (Number.isNaN(startsAt.getTime())) throw AppError.validation([{ field: 'zone', code: 'INVALID_CHOICE' }]);
    const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
    const onSite = input.type === 'PROPERTY_VISIT' || input.type === 'OFFICE_MEETING';
    const past = startsAt.getTime() < now.getTime();
    const informed = !past && input.notifyClient && Boolean(client.email); // TAC-040 — without e-mail: « Prévenez le client par téléphone. »
    const cal = await this.calendar.load();
    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      const status = past ? 'DONE' : 'CONFIRMED';
      const a = await tx.appointment.create({
        data: {
          id,
          type: input.type,
          status,
          clientId: client.id,
          dossierId,
          candidateId: input.candidateId,
          propertyId,
          staffUserId,
          startsAt,
          endsAt,
          timezone: client.timezone ?? cal.timeZone,
          placeTimezone: onSite ? input.zone : null,
          clientNotifiedAt: informed ? now : null,
          locationText: input.location,
          meetingUrl: input.meetingUrl,
          hostName: input.hostName,
          hostPhone: input.hostPhone,
          onBehalfContactId: input.onBehalfContactId,
          clientNote: input.clientNote,
          internalNote: input.internalNote,
          createdById: stampBy(auth.actor),
          updatedById: stampBy(auth.actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, auth.actor, now, { action: 'appointment.created', entityType: 'appointment', entityId: id, after: { type: input.type, status, startsAt, clientNotified: informed }, clientId: client.id, dossierId });
      if (input.candidateId) await applyVisitEffect(tx, { candidateId: input.candidateId, effect: past ? 'DONE' : 'PLANNED', actor: auth.actor, now });
      if (dossierId) await touchDossier(tx, dossierId, now);
      if (past) {
        await this.firstContact(tx, client.id, auth.actor, now);
        await this.heldLine(tx, a, now);
        await this.emit(tx, a, 'appointment.done', auth.actor, now);
      } else await this.emit(tx, a, 'appointment.confirmed', auth.actor, now, { notifyClient: informed });
    }, { timeout: 30_000 });
    this.dispatcher.wake();
    return this.detail(auth, id);
  }

  /** `PATCH /admin/appointments/{id}` (`appointment.manage`) — place, link, who hosts on site (TAC-045, `VISIT_HOST`), notes. */
  async update(auth: AuthContext, id: string, body: unknown): Promise<AppointmentItem> {
    const input = parseOrThrow(appointmentUpdateSchema, body);
    return this.act(auth, id, async (tx, a, _s, now) => {
      if (a.version !== input.version) throw new AppError(ErrorCode.CONFLICT_VERSION);
      if (['DONE', 'NO_SHOW', 'CANCELLED'].includes(a.status)) throw AppError.conflictState('APPOINTMENT_FINISHED');
      const data: Prisma.AppointmentUncheckedUpdateInput = {};
      if (input.location !== undefined) data.locationText = input.location;
      if (input.meetingUrl !== undefined) data.meetingUrl = input.meetingUrl;
      if (input.hostName !== undefined) data.hostName = input.hostName;
      if (input.hostPhone !== undefined) data.hostPhone = input.hostPhone;
      if (input.clientNote !== undefined) data.clientNote = input.clientNote;
      if (input.internalNote !== undefined) data.internalNote = input.internalNote;
      await tx.appointment.update({ where: { id }, data: { ...data, version: { increment: 1 }, updatedById: stampBy(auth.actor), updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'appointment.updated', entityType: 'appointment', entityId: id, after: Object.fromEntries(Object.keys(data).map((k) => [k, '[modifié]'])), clientId: a.clientId, dossierId: a.dossierId });
    });
  }

  /** `POST …/{id}/confirm` (`appointment.manage`) — TAC-041: the client asked, he is always informed. */
  async confirm(auth: AuthContext, id: string, body: unknown): Promise<AppointmentItem> {
    const input = parseOrThrow(appointmentConfirmSchema, body);
    return this.act(auth, id, async (tx, a, _s, now) => {
      if (a.status !== 'REQUESTED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      const startsAt = zonedInstant(input.date, input.time, input.zone);
      const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
      await tx.appointment.update({ where: { id }, data: { status: 'CONFIRMED', startsAt, endsAt, staffUserId: a.staffUserId ?? auth.userId, locationText: input.location ?? a.locationText, meetingUrl: input.meetingUrl ?? a.meetingUrl, clientNotifiedAt: a.clientNotifiedAt ?? now, version: { increment: 1 }, updatedById: stampBy(auth.actor), updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'appointment.updated', entityType: 'appointment', entityId: id, before: { status: a.status }, after: { status: 'CONFIRMED', startsAt }, clientId: a.clientId, dossierId: a.dossierId });
      if (a.candidateId) await applyVisitEffect(tx, { candidateId: a.candidateId, effect: 'PLANNED', actor: auth.actor, now });
      await this.emit(tx, a, 'appointment.confirmed', auth.actor, now, { notifyClient: true });
    });
  }

  /** `POST …/{id}/reschedule` (`appointment.manage`) — TAC-042 « Déplacer »: « Nouvelle date » to an informed client; the reminder is re-armed. */
  async reschedule(auth: AuthContext, id: string, body: unknown): Promise<AppointmentItem> {
    const input = parseOrThrow(appointmentRescheduleSchema, body);
    return this.act(auth, id, async (tx, a, _s, now) => {
      if (a.status !== 'CONFIRMED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      const startsAt = zonedInstant(input.date, input.time, input.zone);
      const duration = input.durationMinutes ?? (a.startsAt && a.endsAt ? Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000) : 30);
      await tx.appointment.update({ where: { id }, data: { startsAt, endsAt: new Date(startsAt.getTime() + duration * 60_000), reminderSentAt: null, version: { increment: 1 }, updatedById: stampBy(auth.actor), updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'appointment.updated', entityType: 'appointment', entityId: id, before: { startsAt: a.startsAt }, after: { startsAt }, clientId: a.clientId, dossierId: a.dossierId });
      await this.emit(tx, a, 'appointment.rescheduled', auth.actor, now, { notifyClient: a.clientNotifiedAt !== null });
    });
  }

  /** `POST …/{id}/cancel` (`appointment.manage`) — TAC-042, and the refusal of a request (TAC-041: a word to the client). */
  async cancel(auth: AuthContext, id: string, body: unknown): Promise<AppointmentItem> {
    const input = parseOrThrow(appointmentCancelSchema, body);
    return this.act(auth, id, async (tx, a, _s, now) => {
      if (a.status !== 'REQUESTED' && a.status !== 'CONFIRMED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      if (a.status === 'CONFIRMED' && a.startsAt && a.startsAt.getTime() <= now.getTime()) throw AppError.conflictState('APPOINTMENT_STARTED');
      if (a.status === 'REQUESTED' && !input.clientWord) throw AppError.validation([{ field: 'clientWord', code: 'REQUIRED' }]);
      const notifyClient = a.clientNotifiedAt !== null && (a.status === 'REQUESTED' || input.notifyClient);
      await tx.appointment.update({ where: { id }, data: { status: 'CANCELLED', cancelledBy: 'STAFF', cancelReason: input.reason ?? input.clientWord, version: { increment: 1 }, updatedById: stampBy(auth.actor), updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'appointment.updated', entityType: 'appointment', entityId: id, before: { status: a.status }, after: { status: 'CANCELLED', cancelledBy: 'STAFF', notifyClient }, clientId: a.clientId, dossierId: a.dossierId, reason: input.reason });
      if (a.candidateId) await applyVisitEffect(tx, { candidateId: a.candidateId, effect: 'RELEASED', actor: auth.actor, now });
      await this.emit(tx, a, 'appointment.cancelled', auth.actor, now, { cancelledBy: 'STAFF', notifyClient, staffNote: input.clientWord });
    });
  }

  /** `POST …/{id}/done` (`appointment.manage`) — after the start; counts as first contact (CYC-004). */
  async done(auth: AuthContext, id: string, body: unknown): Promise<AppointmentItem> {
    const { outcomeNote } = parseOrThrow(appointmentDoneSchema, body);
    return this.act(auth, id, async (tx, a, _s, now) => {
      if (a.status !== 'CONFIRMED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      if (!a.startsAt || a.startsAt.getTime() > now.getTime()) throw AppError.conflictState('APPOINTMENT_NOT_STARTED');
      await tx.appointment.update({ where: { id }, data: { status: 'DONE', outcomeNote, version: { increment: 1 }, updatedById: stampBy(auth.actor), updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'appointment.updated', entityType: 'appointment', entityId: id, before: { status: a.status }, after: { status: 'DONE' }, clientId: a.clientId, dossierId: a.dossierId });
      if (a.candidateId) await applyVisitEffect(tx, { candidateId: a.candidateId, effect: 'DONE', actor: auth.actor, now });
      if (a.dossierId) await touchDossier(tx, a.dossierId, now);
      await this.firstContact(tx, a.clientId, auth.actor, now);
      await this.heldLine(tx, a, now);
      await this.emit(tx, a, 'appointment.done', auth.actor, now);
    });
  }

  /** `POST …/{id}/no-show` (`appointment.manage`) — task « Recontacter le client » (`R_APPOINTMENT_NO_SHOW`). */
  async noShow(auth: AuthContext, id: string): Promise<AppointmentItem> {
    return this.act(auth, id, async (tx, a, _s, now) => {
      if (a.status !== 'CONFIRMED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      if (!a.startsAt || a.startsAt.getTime() > now.getTime()) throw AppError.conflictState('APPOINTMENT_NOT_STARTED');
      await tx.appointment.update({ where: { id }, data: { status: 'NO_SHOW', version: { increment: 1 }, updatedById: stampBy(auth.actor), updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'appointment.updated', entityType: 'appointment', entityId: id, before: { status: a.status }, after: { status: 'NO_SHOW' }, clientId: a.clientId, dossierId: a.dossierId });
      if (a.candidateId) await applyVisitEffect(tx, { candidateId: a.candidateId, effect: 'RELEASED', actor: auth.actor, now });
      await this.emit(tx, a, 'appointment.no_show', auth.actor, now);
    });
  }

  /**
   * `POST …/{id}/correct-outcome` (`appointment.manage`) — TAC-042: within 7 days, with a reason. The effects on the
   * property and on the first contact are replayed; nothing else: no event, no e-mail, no task.
   */
  async correct(auth: AuthContext, id: string, body: unknown): Promise<AppointmentItem> {
    const input = parseOrThrow(appointmentCorrectSchema, body);
    return this.act(auth, id, async (tx, a, _s, now) => {
      if (!['DONE', 'NO_SHOW', 'CANCELLED'].includes(a.status) || a.status === input.to) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      if (now.getTime() - a.updatedAt.getTime() > CORRECT_DAYS * DAY) throw AppError.conflictState('CORRECTION_TOO_LATE');
      await tx.appointment.update({ where: { id }, data: { status: input.to, ...(input.to === 'CANCELLED' ? { cancelledBy: a.cancelledBy ?? 'STAFF' } : {}), version: { increment: 1 }, updatedById: stampBy(auth.actor), updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'appointment.outcome_corrected', entityType: 'appointment', entityId: id, before: { status: a.status }, after: { status: input.to }, clientId: a.clientId, dossierId: a.dossierId, reason: input.reason });
      if (a.candidateId) await applyVisitEffect(tx, { candidateId: a.candidateId, effect: effectOf(input.to), actor: auth.actor, now });
      await this.firstContact(tx, a.clientId, auth.actor, now);
    });
  }

  // ─── The client's side (EC-14) ────────────────────────────────────────────

  private clientItem(a: Row & { staffUser: Row['staffUser'] }, now: Date): ClientAppointment {
    const confirmed = a.status === 'CONFIRMED';
    return {
      id: a.id,
      type: a.type,
      status: a.status,
      startsAt: a.startsAt?.toISOString() ?? null,
      endsAt: a.endsAt?.toISOString() ?? null,
      placeTimezone: a.placeTimezone,
      clientTimezone: a.timezone,
      advisorTimezone: a.staffUser?.timezone ?? null,
      advisor: a.staffUser?.firstName ? { firstName: a.staffUser.firstName, lastInitial: a.staffUser.lastName ? a.staffUser.lastName.trim().charAt(0).toUpperCase() : null } : null,
      property: a.property ? { title: a.property.title, reference: a.property.reference } : null,
      location: a.locationText,
      meetingUrl: confirmed ? a.meetingUrl : null,
      host: a.hostName ? { name: a.hostName, phone: a.hostPhone } : null,
      visitor: a.onBehalfContact?.fullName ?? null,
      requestedSlots: Array.isArray(a.requestedSlots) ? (a.requestedSlots as { date: string; slot: string }[]) : [],
      cancelledBy: a.cancelledBy,
      // INT-041 — the reason, when it was given to the client (the word of a refusal, a cancellation by the client).
      cancelReason: a.status === 'CANCELLED' && a.cancelledBy !== 'SYSTEM' ? a.cancelReason : null,
      canCancel: (a.status === 'REQUESTED' || confirmed) && (!a.startsAt || a.startsAt.getTime() > now.getTime()),
      calendarPath: confirmed ? `/client/appointments/${a.id}/calendar` : null,
    };
  }

  /** `GET /client/appointments` — INT-041: « À venir » and « Passés »; all of them, informed by e-mail or not. */
  async clientList(auth: AuthContext): Promise<ClientAppointments> {
    if (!auth.clientId) return { upcoming: [], past: [] };
    const now = this.clock.now();
    const rows = await this.prisma.appointment.findMany({ where: { clientId: auth.clientId }, include: INCLUDE, orderBy: [{ startsAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }] });
    const items = rows.map((r) => this.clientItem(r, now));
    const isUpcoming = (a: ClientAppointment) => (a.status === 'REQUESTED' || a.status === 'CONFIRMED') && (!a.startsAt || new Date(a.startsAt).getTime() > now.getTime() - 2 * 3_600_000);
    return { upcoming: items.filter(isUpcoming), past: items.filter((a) => !isUpcoming(a)).reverse() };
  }

  /** `POST /client/appointments/{id}/cancel` — INT-042: until the start time; the adviser receives a notification and an e-mail. */
  async clientCancel(auth: AuthContext, id: string, body: unknown): Promise<ClientAppointment> {
    const { reason } = parseOrThrow(clientAppointmentCancelSchema, body);
    if (!auth.clientId || !UUID.test(id)) throw AppError.notFound();
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const a = await tx.appointment.findFirst({ where: { id, clientId: auth.clientId! }, include: INCLUDE });
      if (!a) throw AppError.notFound();
      if (a.status !== 'REQUESTED' && a.status !== 'CONFIRMED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      if (a.startsAt && a.startsAt.getTime() <= now.getTime()) throw AppError.conflictState('APPOINTMENT_STARTED');
      await tx.appointment.update({ where: { id }, data: { status: 'CANCELLED', cancelledBy: 'CLIENT', cancelReason: reason, version: { increment: 1 }, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'appointment.updated', entityType: 'appointment', entityId: id, before: { status: a.status }, after: { status: 'CANCELLED', cancelledBy: 'CLIENT' }, clientId: a.clientId, dossierId: a.dossierId });
      if (a.candidateId) await applyVisitEffect(tx, { candidateId: a.candidateId, effect: 'RELEASED', actor: auth.actor, now });
      await this.emit(tx, a, 'appointment.cancelled', auth.actor, now, { cancelledBy: 'CLIENT', notifyClient: false });
      if (a.dossierId) await signalHoldActivity(tx, this.outbox, { dossierId: a.dossierId, what: 'APPOINTMENT', now });
    });
    this.dispatcher.wake();
    const row = await this.prisma.appointment.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    return this.clientItem(row, now);
  }

  /** `GET /client/appointments/{id}/calendar` — « Ajouter à mon agenda » (`.ics`, in the zone the appointment is held in). */
  async clientCalendar(auth: AuthContext, id: string, siteName: string): Promise<{ filename: string; body: string }> {
    if (!auth.clientId || !UUID.test(id)) throw AppError.notFound();
    const a = await this.prisma.appointment.findFirst({ where: { id, clientId: auth.clientId, status: 'CONFIRMED' }, include: INCLUDE });
    if (!a?.startsAt || !a.endsAt) throw AppError.notFound();
    return { filename: `rendez-vous-${localDay(a.startsAt, a.placeTimezone ?? a.timezone)}.ics`, body: appointmentIcs(a, siteName, this.clock.now()) };
  }
}

/** The calendar file of an appointment (joined to `C_APPOINTMENT_CONFIRMED`, downloaded from the client's space). */
export function appointmentIcs(a: { id: string; version: number; type: string; startsAt: Date | null; endsAt: Date | null; placeTimezone: string | null; timezone: string; locationText: string | null; meetingUrl: string | null; property?: { title: string } | null; staffUser?: { firstName: string | null; lastName: string | null } | null }, siteName: string, now: Date, cancelled = false): string {
  const labels: Record<string, string> = { CALL: 'Appel', VISIO: 'Visio', PROPERTY_VISIT: 'Visite', OFFICE_MEETING: 'Rendez-vous' };
  const advisor = advisorDisplayName(a.staffUser?.firstName ?? null, a.staffUser?.lastName ?? null);
  const summary = [labels[a.type] ?? 'Rendez-vous', a.property?.title, siteName].filter(Boolean).join(' – ');
  return buildIcs({
    uid: `appointment-${a.id}@diaspora-patrimoine`,
    sequence: a.version,
    stamp: now,
    start: a.startsAt!,
    end: a.endsAt!,
    timeZone: a.placeTimezone ?? a.timezone,
    summary,
    location: a.locationText ?? a.meetingUrl,
    description: [advisor ? `Avec ${advisor}` : null, a.meetingUrl].filter(Boolean).join('\n'),
    url: a.meetingUrl,
    alarmText: summary,
    cancelled,
  });
}
