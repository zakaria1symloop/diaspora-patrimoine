// Le Café — back-office use cases: EVT-003 create/update, EVT-004 partners, EVT-005 actions (CYC-180), EVT-011
// « Inscrire quelqu'un » (CYC-185 creation by staff, MOD-410 under the event row lock). Tags `events`, `home`.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@dp/contracts';
import { z } from 'zod';
import type { Event, EventPartner, EventRegistration, Media } from '../generated/prisma/client.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { OutboxWriter } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { diff, writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { MediaPipeline, sha256 } from '../files/media-pipeline.js';
import { uniqueSlug } from '../catalogue-admin/catalogue-texts.js';
import { conflictVersion, missingConditions } from '../catalogue-admin/partners-admin.service.js';
import { defaultLocationCode, eventPublicationMissing, eventReference, eventSlug, eventTitle } from './events-rules.js';

const instant = z.iso.datetime({ offset: true }).transform((s) => new Date(s));
const optStr = (max: number) => z.string().trim().max(max).nullable().optional();

export const eventCreateSchema = z
  .object({
    locationLabel: z.string().trim().min(1).max(80),
    cityName: z.string().trim().min(1).max(80),
    countryCode: z.string().regex(/^[A-Z]{2}$/).default('FR'),
    /** Code of the place in the reference (`PAR`, `MRS`); default: first three letters of the place. */
    locationCode: z.string().regex(/^[A-Za-z]{3}$/).optional(),
    venueName: optStr(160),
    venueAddress: optStr(300),
    venueNotes: optStr(500),
    startsAt: instant,
    endsAt: instant,
    timezone: z.string().max(64).default('Europe/Paris'),
    capacity: z.number().int().min(1).max(500).optional(),
    maxSeatsPerRegistration: z.number().int().min(1).max(10).optional(),
    registrationOpensAt: instant.nullable().optional(),
    registrationClosesAt: instant.optional(),
    title: optStr(120),
    description: optStr(3000),
    hostUserId: z.uuid().nullable().optional(),
  })
  .refine((e) => e.endsAt > e.startsAt, { path: ['endsAt'], message: 'OUT_OF_RANGE' })
  .refine((e) => !e.registrationClosesAt || e.registrationClosesAt <= e.startsAt, { path: ['registrationClosesAt'], message: 'OUT_OF_RANGE' });

export const eventUpdateSchema = z.object({
  version: z.number().int().min(1).optional(),
  venueName: optStr(160),
  venueAddress: optStr(300),
  venueNotes: optStr(500),
  capacity: z.number().int().min(1).max(500).optional(),
  maxSeatsPerRegistration: z.number().int().min(1).max(10).optional(),
  registrationOpensAt: instant.nullable().optional(),
  title: optStr(120),
  description: optStr(3000),
});

export const eventPartnerSchema = z
  .object({
    promoterId: z.uuid().optional(),
    bankId: z.uuid().optional(),
    partnerId: z.uuid().optional(),
    roleLabel: optStr(80),
    contactName: optStr(160),
    isPublic: z.boolean().default(true),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((p) => [p.promoterId, p.bankId, p.partnerId].filter(Boolean).length === 1, { path: ['promoterId'], message: 'REQUIRED' });

export const staffRegistrationSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  phone: optStr(20),
  seats: z.number().int().min(1).max(10),
  questions: optStr(1000),
});

export type EventCreate = z.input<typeof eventCreateSchema>;
export type EventUpdate = z.input<typeof eventUpdateSchema>;
export type EventPartnerInput = z.input<typeof eventPartnerSchema>;
export type StaffRegistration = z.input<typeof staffRegistrationSchema>;

const TAGS = (e: { slug: string }) => ['events', 'home', `event:${e.slug}`];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class EventsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly outbox: OutboxWriter,
    private readonly pipeline: MediaPipeline,
    private readonly notifier: ChangeNotifier,
  ) {}

  /** EVT-003 — reference and page address created at the first save; title proposed. */
  async create(input: EventCreate, actor: Actor): Promise<Event> {
    const data = parseOrThrow(eventCreateSchema, input);
    const s = await this.settings.all();
    return this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const baseRef = eventReference(data.startsAt, data.timezone, data.locationCode ?? defaultLocationCode(data.cityName));
      // TRV-051 — « + suffixe si doublon ».
      let reference = baseRef;
      for (let i = 2; await tx.event.findFirst({ where: { reference, deletedAt: null } }); i++) reference = `${baseRef}-${i}`;
      const slug = await uniqueSlug(eventSlug(data.locationLabel, data.startsAt, data.timezone), 80, async (sl) =>
        Boolean((await tx.event.findFirst({ where: { slug: sl, deletedAt: null } })) ?? (await tx.slugHistory.findFirst({ where: { entityType: 'EVENT', slug: sl } }))),
      );
      const closes = data.registrationClosesAt ?? new Date(data.startsAt.getTime() - s['events.closeHoursBefore'] * 3_600_000);
      const event = await tx.event.create({
        data: {
          id: newId(),
          reference,
          slug,
          title: data.title || eventTitle(s['events.brandName'], data.locationLabel, data.startsAt, data.timezone),
          locationLabel: data.locationLabel,
          cityName: data.cityName,
          countryCode: data.countryCode,
          venueName: data.venueName || null,
          venueAddress: data.venueAddress || null,
          venueNotes: data.venueNotes || null,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          timezone: data.timezone,
          capacity: data.capacity ?? s['events.defaultCapacity'],
          maxSeatsPerRegistration: data.maxSeatsPerRegistration ?? s['events.maxSeatsPerRegistration'],
          registrationOpensAt: data.registrationOpensAt ?? null,
          registrationClosesAt: closes > data.startsAt ? data.startsAt : closes,
          description: data.description || null,
          hostUserId: data.hostUserId ?? null,
          status: 'DRAFT',
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, {
        action: 'event.created',
        entityType: 'event',
        entityId: event.id,
        entityLabel: reference,
        after: { reference, slug, startsAt: event.startsAt, locationLabel: event.locationLabel, capacity: event.capacity },
      });
      return event;
    });
  }

  /** EVT-005 « Modifier » / « Changer la capacité » — never below the seats taken (CYC-182, CAPACITY_BELOW_TAKEN). */
  async update(id: string, input: EventUpdate, actor: Actor): Promise<Event> {
    const data = parseOrThrow(eventUpdateSchema, input);
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.event.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw AppError.notFound();
      if (data.version !== undefined && data.version !== before.version) throw conflictVersion(before.version, before.updatedAt);
      if (data.capacity !== undefined && data.capacity < before.seatsTaken) {
        throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'CAPACITY_BELOW_TAKEN', params: { n: before.seatsTaken } });
      }
      const { version: _v, ...rest } = data;
      const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      const changes = diff(before as unknown as Record<string, unknown>, clean);
      if (!changes) return before;
      const updated = await tx.event.update({ where: { id, version: before.version }, data: { ...clean, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'event.updated', entityType: 'event', entityId: id, entityLabel: before.reference, ...changes });
      return updated;
    });
    await this.notifier.committed(TAGS(result));
    return result;
  }

  /** EVT-004 — a promoter, bank or other partner present (exactly one of the three). */
  async addPartner(eventId: string, input: EventPartnerInput, actor: Actor): Promise<EventPartner> {
    const data = parseOrThrow(eventPartnerSchema, input);
    let slug = '';
    const partner = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const event = await tx.event.findFirst({ where: { id: eventId, deletedAt: null } });
      if (!event) throw AppError.notFound();
      slug = event.slug;
      if (data.promoterId && !(await tx.promoter.findFirst({ where: { id: data.promoterId, deletedAt: null } }))) throw AppError.validation([{ field: 'promoterId', code: 'INVALID_CHOICE' }]);
      if (data.bankId && !(await tx.bank.findFirst({ where: { id: data.bankId, deletedAt: null } }))) throw AppError.validation([{ field: 'bankId', code: 'INVALID_CHOICE' }]);
      if (data.partnerId && !(await tx.partner.findFirst({ where: { id: data.partnerId, deletedAt: null } }))) throw AppError.validation([{ field: 'partnerId', code: 'INVALID_CHOICE' }]);
      const last = await tx.eventPartner.aggregate({ where: { eventId }, _max: { sortOrder: true } });
      const created = await tx.eventPartner.create({
        data: {
          id: newId(),
          eventId,
          promoterId: data.promoterId ?? null,
          bankId: data.bankId ?? null,
          partnerId: data.partnerId ?? null,
          roleLabel: data.roleLabel || null,
          contactName: data.contactName || null,
          isPublic: data.isPublic,
          sortOrder: data.sortOrder ?? (last._max.sortOrder ?? -1) + 1,
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, {
        action: 'event_partner.created',
        entityType: 'event_partner',
        entityId: created.id,
        entityLabel: event.reference,
        after: { eventId, promoterId: created.promoterId, bankId: created.bankId, partnerId: created.partnerId, isPublic: created.isPublic },
      });
      return created;
    });
    await this.notifier.committed(['events', 'home', `event:${slug}`]);
    return partner;
  }

  /** EVT-003 « Image » — a PHOTO of the event through MED-020, set as `coverMediaId` once READY. Idempotent per file. */
  async attachCover(eventId: string, file: { filePath?: string; body?: Buffer; fileName?: string; alt?: string | null; isIllustration?: boolean }, actor: Actor): Promise<{ media: Media; created: boolean }> {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, deletedAt: null } });
    if (!event) throw AppError.notFound();
    const body = file.body ?? (file.filePath ? await readFile(file.filePath) : null);
    if (!body) throw AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]);
    const fileName = file.fileName ?? (file.filePath ? basename(file.filePath) : 'image');
    const existing = await this.pipeline.findExisting('EVENT', eventId, fileName, sha256(body));
    if (existing) return { media: existing, created: false };
    const media = await this.pipeline.ingest(
      { ownerType: 'EVENT', ownerId: eventId, kind: 'PHOTO', body, fileName, alt: file.alt ?? null, isIllustration: file.isIllustration, isCover: true },
      actor,
      {
        onReady: async (tx, m) => {
          await tx.event.update({ where: { id: eventId }, data: { coverMediaId: m.id, version: { increment: 1 }, updatedAt: this.clock.now() } });
          await writeAudit(tx, actor, this.clock.now(), { action: 'event.updated', entityType: 'event', entityId: eventId, entityLabel: event.reference, before: { coverMediaId: event.coverMediaId }, after: { coverMediaId: m.id } });
        },
      },
    );
    await this.notifier.committed(TAGS(event));
    return { media, created: true };
  }

  private async transition(id: string, actor: Actor, apply: (tx: Tx, e: Event, now: Date) => Promise<{ action: string; before: Record<string, unknown>; after: Record<string, unknown>; reason?: string }>): Promise<Event> {
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${id}::uuid FOR UPDATE`;
      const e = await tx.event.findFirst({ where: { id, deletedAt: null } });
      if (!e) throw AppError.notFound();
      const audit = await apply(tx, e, now);
      await writeAudit(tx, actor, now, { entityType: 'event', entityId: id, entityLabel: e.reference, ...audit });
      return tx.event.findUniqueOrThrow({ where: { id } });
    });
    await this.notifier.committed(TAGS(result));
    return result;
  }

  /** CYC-180 DRAFT → PUBLISHED — every missing condition listed (`MISSING_CONDITIONS`). */
  async publish(id: string, actor: Actor): Promise<Event> {
    return this.transition(id, actor, async (tx, e, now) => {
      if (e.status !== 'DRAFT') throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      const missing = eventPublicationMissing({ ...e, now });
      if (missing.length) throw missingConditions('MISSING_CONDITIONS', missing);
      await tx.event.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: now, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await this.outbox.add(tx, { type: 'event.published', aggregateType: 'event', aggregateId: id, payload: { reference: e.reference } }, now);
      return { action: 'event.updated', before: { status: e.status }, after: { status: 'PUBLISHED' } };
    });
  }

  /** CYC-180 PUBLISHED → CLOSED, by hand (no more public registration; staff can still register). */
  async close(id: string, actor: Actor): Promise<Event> {
    return this.transition(id, actor, async (tx, e, now) => {
      if (e.status !== 'PUBLISHED') throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      await tx.event.update({ where: { id }, data: { status: 'CLOSED', version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      return { action: 'event.updated', before: { status: e.status }, after: { status: 'CLOSED' } };
    });
  }

  /** CYC-180 CLOSED → PUBLISHED, by hand, while the Café has not started. */
  async reopen(id: string, actor: Actor): Promise<Event> {
    return this.transition(id, actor, async (tx, e, now) => {
      if (e.status !== 'CLOSED' || e.startsAt <= now) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      await tx.event.update({ where: { id }, data: { status: 'PUBLISHED', version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      return { action: 'event.updated', before: { status: e.status }, after: { status: 'PUBLISHED' } };
    });
  }

  /**
   * CYC-180 DRAFT, PUBLISHED or CLOSED → CANCELLED — reason required (shown to registrants). REGISTERED and WAITLISTED
   * registrations become CANCELLED (`cancelledBy = STAFF`); `event.cancelled` carries the C_CAFE_CANCELLED e-mails.
   */
  async cancel(id: string, input: { reason: string }, actor: Actor): Promise<Event> {
    const { reason } = parseOrThrow(z.object({ reason: z.string().trim().min(1).max(500) }), input);
    return this.transition(id, actor, async (tx, e, now) => {
      if (!['DRAFT', 'PUBLISHED', 'CLOSED'].includes(e.status)) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      const regs = await tx.eventRegistration.updateMany({
        where: { eventId: id, status: { in: ['REGISTERED', 'WAITLISTED'] } },
        data: { status: 'CANCELLED', cancelledAt: now, cancelledBy: 'STAFF', cancelReason: reason.slice(0, 300), updatedAt: now },
      });
      await tx.event.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason, seatsTaken: 0, waitlistSeats: 0, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      await this.outbox.add(tx, { type: 'event.cancelled', aggregateType: 'event', aggregateId: id, payload: { reference: e.reference, registrationsCancelled: regs.count } }, now);
      return { action: 'event.updated', before: { status: e.status }, after: { status: 'CANCELLED', registrationsCancelled: regs.count }, reason };
    });
  }

  /**
   * EVT-011 « Inscrire quelqu'un » — the client file is found by e-mail or created; REGISTERED only if the seats fit:
   * the capacity is never exceeded (MOD-410), checked under the event row lock (FIA-020). Possible after closing.
   * The confirmation e-mail (C_CAFE_REGISTERED) leaves through `event_registration.created` in the outbox.
   */
  async registerByStaff(eventId: string, input: StaffRegistration, actor: Actor): Promise<EventRegistration> {
    const data = parseOrThrow(staffRegistrationSchema, input);
    let slug = '';
    const reg = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
      const e = await tx.event.findFirst({ where: { id: eventId, deletedAt: null } });
      if (!e) throw AppError.notFound();
      slug = e.slug;
      if (e.status !== 'PUBLISHED' && e.status !== 'CLOSED') throw new AppError(ErrorCode.CONFLICT_STATE, { reason: e.status === 'CANCELLED' ? 'EVENT_CANCELLED' : 'TRANSITION_NOT_ALLOWED' });
      if (data.seats > e.maxSeatsPerRegistration) throw AppError.validation([{ field: 'seats', code: 'OUT_OF_RANGE', params: { max: e.maxSeatsPerRegistration } }]);
      const left = e.capacity - e.seatsTaken;
      if (data.seats > left) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: left > 0 ? 'NOT_ENOUGH_SEATS' : 'EVENT_FULL', params: { n: left } });
      const email = data.email.toLowerCase();
      if (await tx.eventRegistration.findFirst({ where: { eventId, email, status: { not: 'CANCELLED' } } })) throw new AppError(ErrorCode.DUPLICATE);
      let client = await tx.client.findFirst({ where: { email, deletedAt: null } });
      if (!client) {
        client = await tx.client.create({
          data: { id: newId(), email, firstName: data.firstName, lastName: data.lastName, phone: data.phone || null, lastActivityAt: now, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now },
        });
        await writeAudit(tx, actor, now, { action: 'client.created', entityType: 'client', entityId: client.id, clientId: client.id, after: { source: 'ADMIN' } });
      }
      let checkInCode = '';
      do checkInCode = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
      while (await tx.eventRegistration.findFirst({ where: { eventId, checkInCode } }));
      const created = await tx.eventRegistration.create({
        data: {
          id: newId(),
          eventId,
          clientId: client.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          phone: data.phone || null,
          seats: data.seats,
          status: 'REGISTERED',
          questions: data.questions || null,
          source: 'ADMIN',
          manageTokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
          checkInCode,
          registeredAt: now,
          locale: 'fr',
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.event.update({ where: { id: eventId }, data: { seatsTaken: { increment: data.seats }, updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'event_registration.created', entityType: 'event_registration', entityId: created.id, entityLabel: e.reference, clientId: client.id, after: { seats: data.seats, status: 'REGISTERED', source: 'ADMIN' } });
      await this.outbox.add(tx, { type: 'registration.created', aggregateType: 'EventRegistration', aggregateId: created.id, payload: { eventId, seats: data.seats } }, now);
      return created;
    });
    await this.notifier.committed(['events', 'home', `event:${slug}`]);
    return reg;
  }
}
