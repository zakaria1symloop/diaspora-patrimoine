// AUT-081 `event.scan` (every 5 minutes) and AUT-056 — what the Café does by itself, with time:
//   CYC-180  PUBLISHED → CLOSED at `registrationClosesAt` (`event.closed`); PUBLISHED or CLOSED → DONE at `endsAt`
//            (`event.done`);
//   AUT-010  `event.registration_opened` when the registrations open (at publication, or at `registrationOpensAt`);
//            `event.upcoming` seven days before, then the day before, at 10:00, time of the place (`days`: 7 or 1);
//            `event.followup_due` the day after the end, at 10:00, time of the place;
//            `event.checkin_missing` two business days after the end, without any check-in;
//   CYC-185  REGISTERED → NO_SHOW 24 hours after the end, ONLY IF at least one check-in was made for this Café
//            (`registration.no_show`); otherwise the registrations stay REGISTERED (presence unknown).
// Every ⏱ event carries the key of its fact (AUT-012): the pass can run twice, or catch up after a failure, without
// signalling anything twice. Dated reminders do not leave late when they have lost their meaning (AUT-082): the reminder
// of the day before is not sent once the Café has started, the one of the week before not after the day before.
//
// The rules of AUT-056 send the e-mails (automation engine); what their templates need beyond the Café itself — the
// manage link of a registration, the exact place for who holds a seat, the next Café — is composed here.
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { addBusinessDays } from '@dp/domain';
import { SYSTEM_ACTOR } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { emitFact, inTransaction } from '../automation/automation-jobs.js';
import { RuleMailComposers, type ComposeInput, type Composition } from '../automation/rule-mail.js';
import { Scheduler, type JobContext } from '../automation/scheduler.js';
import { addDays, localDay, zonedInstant } from '../automation/timing.js';
import { ENV, type Env } from '../config/env.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { EventsPublicService } from './events-public.service.js';
import { RegistrationDocuments } from './registration-documents.js';
import { cafeDateLabel, cafeTimeLabel } from './registration-rules.js';
import { lockEvent } from './waitlist.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** How long after its moment a fact of a finished Café is still worth signalling (catching up after a long stop). */
const CATCH_UP_DAYS = 14;

/** The dated facts of one Café at `now` (pure: the scan only adds the database around it). */
export function cafeMoments(e: { startsAt: Date; endsAt: Date; timezone: string; publishedAt: Date | null }, now: Date): { upcoming: (7 | 1)[]; followUp: boolean } {
  const day = localDay(e.startsAt, e.timezone);
  const week = zonedInstant(addDays(day, -7), '10:00', e.timezone);
  const eve = zonedInstant(addDays(day, -1), '10:00', e.timezone);
  const upcoming: (7 | 1)[] = [];
  // Seven days before — for a Café that was already published then; not after the reminder of the day before.
  if (now >= week && now < eve && e.publishedAt !== null && e.publishedAt <= week) upcoming.push(7);
  // The day before — never once the Café has started.
  if (now >= eve && now < e.startsAt) upcoming.push(1);
  const after = zonedInstant(addDays(localDay(e.endsAt, e.timezone), 1), '10:00', e.timezone);
  return { upcoming, followUp: now >= after && now.getTime() - after.getTime() < CATCH_UP_DAYS * DAY };
}

@Injectable()
export class EventScan implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly scheduler: Scheduler,
    private readonly ruleMails: RuleMailComposers,
    private readonly docs: RegistrationDocuments,
    private readonly events: EventsPublicService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.scheduler.register({ name: 'event.scan', schedule: { everyMinutes: 5 }, run: (ctx) => this.scan(ctx) });
    this.ruleMails.compose(['C_CAFE_OPENING', 'C_CAFE_REMINDER_7D', 'C_CAFE_REMINDER_1D', 'C_CAFE_THANKS', 'C_CAFE_MISSED'], (input) => this.compose(input));
  }

  /** `scope`: only these Cafés (tests on a shared database; never set by the scheduled task). */
  async scan(ctx: Pick<JobContext, 'now' | 'jobRunId'>, scope?: { eventIds: readonly string[] }): Promise<Record<string, number>> {
    const { now, jobRunId } = ctx;
    const counters = { scanned: 0, closed: 0, done: 0, opened: 0, upcoming: 0, followUp: 0, checkinMissing: 0, noShow: 0 };
    if (!(await this.settings.get('features.cafe'))) return counters; // PAR-011
    const cal = await this.calendar.load(this.prisma);
    const fact = (id: string) => ({ aggregate: { type: 'Event', id }, jobRunId });
    const only = scope ? { id: { in: [...scope.eventIds] } } : {};

    // ---- Cafés still to come or running ----
    const live = await this.prisma.event.findMany({
      where: { ...only, deletedAt: null, status: { in: ['PUBLISHED', 'CLOSED'] } },
      orderBy: { startsAt: 'asc' },
      take: 500,
      select: { id: true, reference: true, status: true, startsAt: true, endsAt: true, timezone: true, publishedAt: true, registrationOpensAt: true, registrationClosesAt: true },
    });
    for (const e of live) {
      counters.scanned++;
      if (e.endsAt <= now) {
        if (await this.transition(e.id, ['PUBLISHED', 'CLOSED'], 'DONE', 'event.done', now, jobRunId, (x) => x.endsAt <= now)) counters.done++;
        continue;
      }
      if (e.status === 'PUBLISHED' && e.registrationClosesAt <= now) {
        if (await this.transition(e.id, ['PUBLISHED'], 'CLOSED', 'event.closed', now, jobRunId, (x) => x.registrationClosesAt <= now)) counters.closed++;
      } else if (e.status === 'PUBLISHED' && (!e.registrationOpensAt || e.registrationOpensAt <= now)) {
        if (await emitFact(this.prisma, now, { type: 'event.registration_opened', ...fact(e.id), dedupeKey: `event.registration_opened:${e.id}` })) counters.opened++;
      }
      for (const days of cafeMoments(e, now).upcoming) {
        // A date that moved changes the key: the fact is signalled again, rightly (AUT-012).
        if (await emitFact(this.prisma, now, { type: 'event.upcoming', ...fact(e.id), data: { days }, dedupeKey: `event.upcoming:${e.id}:${e.startsAt.toISOString()}:${days}` })) counters.upcoming++;
      }
    }

    // ---- Cafés that took place ----
    const past = await this.prisma.event.findMany({
      where: { ...only, deletedAt: null, status: 'DONE', endsAt: { gt: new Date(now.getTime() - (CATCH_UP_DAYS + 2) * DAY), lte: now } },
      orderBy: { endsAt: 'asc' },
      take: 500,
      select: { id: true, startsAt: true, endsAt: true, timezone: true, publishedAt: true, attendedSeats: true, walkInSeats: true },
    });
    for (const e of past) {
      counters.scanned++;
      if (cafeMoments(e, now).followUp && (await emitFact(this.prisma, now, { type: 'event.followup_due', ...fact(e.id), dedupeKey: `event.followup_due:${e.id}` }))) counters.followUp++;
      const checkedIn = e.attendedSeats > 0 || e.walkInSeats > 0 || (await this.prisma.eventRegistration.count({ where: { eventId: e.id, status: 'ATTENDED' } })) > 0;
      if (!checkedIn && addBusinessDays(e.endsAt, 2, cal) <= now) {
        if (await emitFact(this.prisma, now, { type: 'event.checkin_missing', ...fact(e.id), dedupeKey: `event.checkin_missing:${e.id}` })) counters.checkinMissing++;
      }
      if (checkedIn && now.getTime() - e.endsAt.getTime() >= 24 * HOUR) counters.noShow += await this.markNoShows(e.id, now, jobRunId);
    }
    return counters;
  }

  /** CYC-180 — an automatic transition, under the Café's row lock, audited as the system's. */
  private async transition(
    id: string,
    from: ('PUBLISHED' | 'CLOSED')[],
    to: 'CLOSED' | 'DONE',
    eventType: string,
    now: Date,
    jobRunId: string,
    still: (e: { endsAt: Date; registrationClosesAt: Date }) => boolean,
  ): Promise<boolean> {
    return inTransaction(this.prisma, async (tx) => {
      if (!(await lockEvent(tx, { id }))) return false;
      const e = await tx.event.findUniqueOrThrow({ where: { id }, select: { status: true, reference: true, endsAt: true, registrationClosesAt: true } });
      // Read again under the lock: reopened, moved or cancelled meanwhile, nothing happens.
      if (!(from as string[]).includes(e.status) || !still(e)) return false;
      await tx.event.update({ where: { id }, data: { status: to, version: { increment: 1 }, updatedAt: now } });
      await writeAudit(tx, SYSTEM_ACTOR, now, { action: 'event.updated', entityType: 'event', entityId: id, entityLabel: e.reference, before: { status: e.status }, after: { status: to } });
      await emitFact(tx, now, { type: eventType, aggregate: { type: 'Event', id }, jobRunId, dedupeKey: `${eventType}:${id}:${now.toISOString()}` });
      return true;
    });
  }

  /** CYC-185 — the registrants nobody checked in, once at least one check-in exists for this Café. */
  private async markNoShows(eventId: string, now: Date, jobRunId: string): Promise<number> {
    return inTransaction(this.prisma, async (tx) => {
      if (!(await lockEvent(tx, { id: eventId }))) return 0;
      const absent = await tx.eventRegistration.findMany({ where: { eventId, status: 'REGISTERED' }, select: { id: true, seats: true, clientId: true } });
      if (absent.length === 0) return 0;
      let seats = 0;
      for (const r of absent) {
        seats += r.seats;
        await tx.eventRegistration.update({ where: { id: r.id }, data: { status: 'NO_SHOW', version: { increment: 1 }, updatedAt: now } });
        await writeAudit(tx, SYSTEM_ACTOR, now, { action: 'event_registration.updated', entityType: 'event_registration', entityId: r.id, before: { status: 'REGISTERED' }, after: { status: 'NO_SHOW' }, clientId: r.clientId });
        await emitFact(tx, now, { type: 'registration.no_show', aggregate: { type: 'EventRegistration', id: r.id }, clientId: r.clientId, data: { seats: r.seats }, jobRunId, dedupeKey: `registration.no_show:${r.id}` });
      }
      // `seatsTaken` (cache): the seats of the REGISTERED and ATTENDED registrations (FIA-070).
      await tx.event.update({ where: { id: eventId }, data: { seatsTaken: { decrement: seats } } });
      return absent.length;
    });
  }

  // ---------- e-mails of the rules of AUT-056 ----------

  /** NOT-050 `cafe.*`, `registration.*`, `nextCafe.*` — the same fields as the confirmation e-mails (registration-mail.handler.ts). */
  async compose(input: ComposeInput): Promise<Composition | null> {
    const e = input.ctx.objects.cafe;
    if (!e) return null;
    const startsAt = e.startsAt as Date;
    const endsAt = e.endsAt as Date;
    const tz = e.timezone as string;
    // AUT-082 — a dated reminder that arrives after its date means nothing.
    if ((input.template === 'C_CAFE_REMINDER_7D' || input.template === 'C_CAFE_REMINDER_1D') && input.now >= startsAt) return { skip: true };
    const reg = input.recipient.registration;
    const holdsSeat = reg?.status === 'REGISTERED' || reg?.status === 'ATTENDED';
    const cafe: Record<string, unknown> = {
      brandName: await this.settings.get('events.fullBrandName'),
      title: e.title,
      capacity: e.capacity,
      locationLabel: e.locationLabel,
      dateLabel: cafeDateLabel(startsAt, tz),
      timeLabel: cafeTimeLabel(startsAt, endsAt, tz),
      url: `${this.env.WEB_URL}/le-cafe/${String(e.slug)}`,
      // TRV-045 — the exact place only to whom holds a seat.
      ...(holdsSeat ? { venueName: e.venueName, venueAddress: e.venueAddress ?? e.locationLabel, venueNotes: e.venueNotes } : {}),
    };
    const next = (await this.events.upcoming(4)).find((c) => c.slug !== e.slug && c.state.kind !== 'CANCELLED' && c.state.kind !== 'CLOSED');
    return {
      vars: {
        cafe,
        registration: reg ? { seats: reg.seats, checkInCode: holdsSeat ? reg.checkInCode : null, manageUrl: this.docs.manageUrl(reg.id as string) } : null,
        nextCafe: next ? { locationLabel: next.locationLabel, dateLabel: cafeDateLabel(new Date(next.startsAt), next.timezone), url: `${this.env.WEB_URL}/le-cafe/${next.slug}` } : null,
      },
      links: { eventId: e.id as string, registrationId: reg ? (reg.id as string) : null },
    };
  }
}
