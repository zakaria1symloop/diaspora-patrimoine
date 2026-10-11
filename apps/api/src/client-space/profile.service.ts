// EC-50 — `GET /client/me/profile`, `PATCH /client/me` (one section at a time, PRO-001, PRO-002), trusted people
// `GET|POST|PATCH|DELETE /client/contacts` (PRO-040), and « Mon adresse est correcte » (AUT-071).
// PRO-004: a change by the client is written in the record's history (audit, field names only — SEC-081), recomputes
// his score (CAL-070) and emits `client.updated`. TRV-094: a stale version answers 409 CONFLICT_VERSION.
import { Inject, Injectable } from '@nestjs/common';
import {
  CLIENT_CONTACTS_MAX,
  ErrorCode,
  profileUpdateRequestSchema,
  trustedPersonCreateSchema,
  trustedPersonSchema,
  type ClientProfile,
  type TrustedPerson,
} from '@dp/contracts';
import { Prisma } from '../generated/prisma/client.js';
import { writeAudit } from '../admin/audit.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { refreshClientCaches } from '../leads/lead-records.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { profileCompletePct } from './space.service.js';
import { advisorDisplayName } from './timeline.js';

const dec = (v: Prisma.Decimal | null) => (v === null ? null : v.toFixed(2));
const day = (v: Date | null) => (v ? v.toISOString().slice(0, 10) : null);
const toDec = (v: string | null | undefined) => (v === null || v === undefined || v === '' ? null : new Prisma.Decimal(v));
const toDay = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00Z`) : null);

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly outbox: OutboxWriter,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  private clientId(auth: AuthContext): string {
    if (!auth.clientId) throw AppError.notFound();
    return auth.clientId;
  }

  async profile(auth: AuthContext): Promise<ClientProfile> {
    const id = this.clientId(auth);
    const [c, user, countries, regions, reference] = await Promise.all([
      this.prisma.client.findUniqueOrThrow({ where: { id } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { email: true, pendingEmail: true } }),
      this.prisma.country.findMany({ where: { isResidenceOption: true }, orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }], select: { code: true, nameFr: true, currency: true } }),
      this.prisma.region.findMany({ where: { isActive: true, country: { isCatalogueActive: true } }, orderBy: { nameFr: 'asc' }, select: { id: true, nameFr: true, countryCode: true } }),
      this.settings.get('display.referenceCurrency'),
    ]);
    const currencies = [...new Set([reference, 'EUR', ...countries.map((x) => x.currency)])].sort();
    return {
      version: c.version,
      email: user.email,
      pendingEmail: user.pendingEmail,
      identity: { firstName: c.firstName, lastName: c.lastName, birthDate: day(c.birthDate), nationalities: c.nationalities },
      contact: {
        phone: c.phone,
        whatsappOptIn: c.whatsappOptIn,
        countryOfResidence: c.countryOfResidence,
        cityOfResidence: c.cityOfResidence,
        preferredContactChannel: c.preferredContactChannel,
        preferredContactSlot: c.preferredContactSlot,
        timezone: c.timezone,
      },
      situation: { residencyStatus: c.residencyStatus, employmentType: c.employmentType, profession: c.profession, employerName: c.employerName, employedSince: day(c.employedSince) },
      project: {
        preferredRegionIds: c.preferredRegionIds,
        preferredTypes: c.preferredTypes,
        minRooms: c.minRooms,
        budgetMax: dec(c.budgetMax),
        // PRO-001 — preselected on the currency of « Mes finances », else the reference currency.
        budgetCurrency: c.budgetCurrency ?? c.incomeCurrency ?? reference,
        budgetMonthly: dec(c.budgetMonthly),
        budgetMonthlyCurrency: c.budgetMonthlyCurrency,
        purchasePurpose: c.purchasePurpose,
        purchaseTimeframe: c.purchaseTimeframe,
        financingPreference: c.financingPreference,
      },
      finances: {
        currency: c.incomeCurrency ?? c.downPaymentCurrency ?? null,
        monthlyIncome: dec(c.monthlyIncome),
        otherMonthlyIncome: dec(c.otherMonthlyIncome),
        monthlyDebts: dec(c.monthlyDebts),
        downPayment: dec(c.downPayment),
      },
      completePct: profileCompletePct(c),
      options: {
        countries: countries.map((x) => ({ code: x.code, name: x.nameFr })),
        regions: regions.map((r) => ({ id: r.id, name: r.nameFr, countryCode: r.countryCode })),
        currencies,
      },
    };
  }

  /** PRO-002 — one section; the others are untouched. */
  async update(auth: AuthContext, body: unknown): Promise<ClientProfile> {
    const id = this.clientId(auth);
    const input = parseOrThrow(profileUpdateRequestSchema, body);
    const data: Record<string, unknown> = {};
    const v = input.values as Record<string, unknown>;
    switch (input.section) {
      case 'identity':
        Object.assign(data, { firstName: v.firstName, lastName: v.lastName, birthDate: toDay(v.birthDate as string | null), nationalities: v.nationalities });
        break;
      case 'contact': {
        const country = v.countryOfResidence as string | null;
        if (country && !(await this.prisma.country.findUnique({ where: { code: country }, select: { code: true } }))) {
          throw AppError.validation([{ field: 'values.countryOfResidence', code: 'INVALID_CHOICE' }]);
        }
        const tz = v.timezone as string | null;
        if (tz && !isTimeZone(tz)) throw AppError.validation([{ field: 'values.timezone', code: 'INVALID_CHOICE' }]);
        Object.assign(data, v, { cityOfResidence: (v.cityOfResidence as string | null) || null, whatsappOptIn: Boolean(v.whatsappOptIn) && Boolean(v.phone) });
        break;
      }
      case 'situation':
        Object.assign(data, { ...v, profession: (v.profession as string | null) || null, employerName: (v.employerName as string | null) || null, employedSince: toDay(v.employedSince as string | null) });
        break;
      case 'project': {
        const ids = v.preferredRegionIds as string[];
        if (ids.length) {
          const found = await this.prisma.region.count({ where: { id: { in: ids }, isActive: true } });
          if (found !== new Set(ids).size) throw AppError.validation([{ field: 'values.preferredRegionIds', code: 'INVALID_CHOICE' }]);
        }
        const budgetMax = toDec(v.budgetMax as string | null);
        const budgetMonthly = toDec(v.budgetMonthly as string | null);
        const currency = (v.budgetCurrency as string | null) ?? null;
        if ((budgetMax || budgetMonthly) && !currency) throw AppError.validation([{ field: 'values.budgetCurrency', code: 'REQUIRED' }]);
        Object.assign(data, {
          preferredRegionIds: [...new Set(ids)],
          preferredTypes: [...new Set(v.preferredTypes as string[])],
          minRooms: v.minRooms,
          budgetMax,
          budgetCurrency: budgetMax || budgetMonthly ? currency : null,
          budgetMonthly,
          // PRO-001 — the monthly budget is in the same currency.
          budgetMonthlyCurrency: budgetMonthly ? currency : null,
          purchasePurpose: v.purchasePurpose,
          purchaseTimeframe: v.purchaseTimeframe,
          financingPreference: v.financingPreference,
        });
        break;
      }
      case 'finances': {
        const amounts = { monthlyIncome: toDec(v.monthlyIncome as string | null), otherMonthlyIncome: toDec(v.otherMonthlyIncome as string | null), monthlyDebts: toDec(v.monthlyDebts as string | null), downPayment: toDec(v.downPayment as string | null) };
        const any = Object.values(amounts).some((x) => x !== null);
        const currency = (v.currency as string | null) ?? null;
        if (any && !currency) throw AppError.validation([{ field: 'values.currency', code: 'REQUIRED' }]);
        // MOD-303 — one currency for the whole section: it fills incomeCurrency and downPaymentCurrency together.
        Object.assign(data, amounts, { incomeCurrency: any ? currency : null, downPaymentCurrency: amounts.downPayment ? currency : null });
        break;
      }
    }

    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.client.findUniqueOrThrow({ where: { id } });
      if (before.version !== input.version) await this.conflict(before.updatedById, before.updatedAt);
      const changed = Object.keys(data).filter((k) => !same((before as Record<string, unknown>)[k], data[k]));
      if (!changed.length) return;
      const done = await tx.client.updateMany({
        where: { id, version: input.version },
        data: { ...data, version: { increment: 1 }, updatedById: auth.userId, updatedAt: now, lastActivityAt: now },
      });
      if (done.count === 0) await this.conflict(before.updatedById, before.updatedAt);
      if (input.section === 'identity') {
        await tx.user.update({ where: { id: auth.userId }, data: { firstName: data.firstName as string, lastName: data.lastName as string, updatedAt: now } });
      }
      // PRO-004 — « Le client a modifié son profil : {champs} » (field names only, SEC-081).
      await writeAudit(tx, auth.actor, now, { action: 'client.updated', entityType: 'client', entityId: id, after: { changedFields: changed, by: 'CLIENT' }, clientId: id });
      await this.outbox.add(tx, { type: 'client.updated', aggregateType: 'Client', aggregateId: id, payload: { changedFields: changed, by: 'CLIENT' } }, now);
      await refreshClientCaches(tx, id, now, await this.settings.get('clients.inactiveAfterDays'));
    });
    this.dispatcher.wake();
    return this.profile(auth);
  }

  /** TRV-094 — « Cette fiche a été modifiée par {prénom} à {heure}. » */
  private async conflict(updatedById: string | null, updatedAt: Date): Promise<never> {
    const who = updatedById ? await this.prisma.user.findUnique({ where: { id: updatedById }, select: { firstName: true, lastName: true, kind: true } }) : null;
    throw new AppError(ErrorCode.CONFLICT_VERSION, {
      params: { prenom: who?.kind === 'STAFF' ? advisorDisplayName(who.firstName, who.lastName) : (who?.firstName ?? null), at: updatedAt.toISOString() },
    });
  }

  // ─── Trusted people (PRO-040) ─────────────────────────────────────────────

  private person(r: { id: string; fullName: string; relation: string | null; phone: string | null; email: string | null; canVisitOnBehalf: boolean; notes: string | null; informedConfirmedAt: Date | null }): TrustedPerson {
    return { ...r, informedConfirmedAt: r.informedConfirmedAt?.toISOString() ?? null };
  }

  async contacts(auth: AuthContext): Promise<{ data: TrustedPerson[] }> {
    const rows = await this.prisma.clientContact.findMany({ where: { clientId: this.clientId(auth) }, orderBy: { createdAt: 'asc' } });
    return { data: rows.map((r) => this.person(r)) };
  }

  async addContact(auth: AuthContext, body: unknown): Promise<TrustedPerson> {
    const clientId = this.clientId(auth);
    const input = parseOrThrow(trustedPersonCreateSchema, body);
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `client-contacts:${clientId}`);
      if ((await tx.clientContact.count({ where: { clientId } })) >= CLIENT_CONTACTS_MAX) throw AppError.conflictState('CONTACTS_LIMIT', { n: CLIENT_CONTACTS_MAX });
      const { informed: _informed, ...fields } = input;
      const r = await tx.clientContact.create({
        data: { id: newId(), clientId, ...fields, informedConfirmedAt: now, createdById: auth.userId, createdAt: now, updatedAt: now },
      });
      await writeAudit(tx, auth.actor, now, { action: 'client_contact.created', entityType: 'client_contact', entityId: r.id, clientId });
      return r;
    });
    return this.person(row);
  }

  async updateContact(auth: AuthContext, id: string, body: unknown): Promise<TrustedPerson> {
    const clientId = this.clientId(auth);
    const input = parseOrThrow(trustedPersonSchema, body);
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      const found = await tx.clientContact.findFirst({ where: { id, clientId }, select: { id: true } });
      if (!found) throw AppError.notFound();
      const r = await tx.clientContact.update({ where: { id }, data: { ...input, updatedById: auth.userId, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'client_contact.updated', entityType: 'client_contact', entityId: id, clientId });
      return r;
    });
    return this.person(row);
  }

  /** PRO-040 — a person linked to an upcoming appointment is not deleted. */
  async deleteContact(auth: AuthContext, id: string): Promise<void> {
    const clientId = this.clientId(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const found = await tx.clientContact.findFirst({ where: { id, clientId }, select: { id: true, fullName: true } });
      if (!found) throw AppError.notFound();
      const visit = await tx.appointment.findFirst({
        where: { onBehalfContactId: id, status: { in: ['REQUESTED', 'CONFIRMED'] }, OR: [{ startsAt: null }, { startsAt: { gt: now } }] },
        select: { startsAt: true },
      });
      if (visit) throw AppError.conflictState('CONTACT_HAS_VISIT', { nom: found.fullName, date: visit.startsAt?.toISOString() ?? null });
      await tx.clientContact.delete({ where: { id } });
      await writeAudit(tx, auth.actor, now, { action: 'client_contact.deleted', entityType: 'client_contact', entityId: id, clientId });
    });
  }

  /** AUT-071 — « Mon adresse est correcte »: the bounce mark is cleared. */
  async confirmEmailValid(auth: AuthContext): Promise<void> {
    const clientId = this.clientId(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const n = await tx.client.updateMany({ where: { id: clientId, emailBouncedAt: { not: null } }, data: { emailBouncedAt: null, updatedAt: now } });
      if (n.count) await writeAudit(tx, auth.actor, now, { action: 'client.email_confirmed_valid', entityType: 'client', entityId: clientId, clientId });
    });
  }
}

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function same(a: unknown, b: unknown): boolean {
  const norm = (x: unknown): unknown => {
    if (x === undefined) return null;
    if (x instanceof Date) return x.toISOString();
    if (x && typeof x === 'object' && 'toFixed' in (x as object)) return (x as Prisma.Decimal).toFixed(2);
    if (Array.isArray(x)) return JSON.stringify([...x].sort());
    return x;
  };
  return norm(a) === norm(b);
}
