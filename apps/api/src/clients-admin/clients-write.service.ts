// Package 3.3 « Clients », writing — CRM-041 (create, with the check of known coordinates), CRM-048 (edit by section,
// same validations as the client's profile; the address of a client WITH an account is never edited here), CRM-060
// (« Ne pas contacter », reason required, kept with its date), CRM-065 / CYC-061 (archive, refused with an open
// dossier; unarchive), CRM-040 (referent adviser, bulk), CRM-045 / AUT-071 (« Numéro vérifié », « Adresse vérifiée »),
// PRO-040 (trusted persons, entered by the team). Each write is ONE transaction with the row locked (FIA-020), the
// optimistic `version` checked where the screen edits (TRV-094), the audit row under the code of SEC-080, the events
// (AUT-010), then the score and the status recomputed (CAL-070, CYC-060).
import { Inject, Injectable } from '@nestjs/common';
import {
  CLIENT_CONTACTS_MAX,
  ErrorCode,
  clientArchiveSchema,
  clientAssignSchema,
  clientBulkSchema,
  clientContactSchema,
  clientDoNotContactSchema,
  clientUpdateSchema,
  contactCheckQuerySchema,
  staffClientCreateSchema,
  type ClientBulkResult,
  type ContactCheck,
  type TrustedPerson,
} from '@dp/contracts';
import type { Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import { StaffViews, type StaffView } from '../back-office/staff-view.js';
import { assertAdvisor, clientOwningEmail, contactCheck, createClientByStaff } from '../crm/client-write.js';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { refreshClientCaches } from '../leads/lead-records.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { currentRequestId } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { liveClients } from './clients-read.service.js';

const toDec = (v: string | null | undefined) => (v === null || v === undefined || v === '' ? null : new Prisma.Decimal(v));
const toDay = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00Z`) : null);
const same = (a: unknown, b: unknown) => JSON.stringify(a instanceof Prisma.Decimal ? a.toFixed(2) : a instanceof Date ? a.toISOString() : a) === JSON.stringify(b instanceof Prisma.Decimal ? b.toFixed(2) : b instanceof Date ? b.toISOString() : b);

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The sensitive sections and fields (ROL-019): written only with `client.sensitive.read`. */
const SENSITIVE_SECTIONS = new Set(['finances', 'situation']);

@Injectable()
export class ClientsWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly views: StaffViews,
    private readonly outbox: OutboxWriter,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  private requestId() {
    const id = currentRequestId();
    return id === 'req_none' ? null : id;
  }

  private event(type: string, clientId: string, actor: Actor, data: Record<string, unknown> = {}) {
    return domainEvent({ type, aggregate: { type: 'Client', id: clientId }, actor: { type: 'USER', id: actor.userId }, clientId, data, requestId: this.requestId() });
  }

  /** The record locked for the gesture, within the perimeter (else 404). */
  private async lock(tx: Tx, staff: StaffView, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw AppError.notFound();
    await tx.$queryRawUnsafe(`SELECT id FROM clients WHERE id = $1::uuid FOR UPDATE`, id);
    const c = await tx.client.findFirst({ where: { AND: [{ id }, liveClients(staff)] } });
    if (!c) throw AppError.notFound();
    if (c.gdprErasedAt) throw AppError.conflictState('CLIENT_ERASED');
    return c;
  }

  /** API-050, TRV-094 — the version of now, who saved it and when (`params` of API-020). */
  private async conflict(tx: Tx, id: string): Promise<never> {
    const c = await tx.client.findUniqueOrThrow({ where: { id }, select: { version: true, updatedById: true, updatedAt: true } });
    const who = c.updatedById ? await tx.user.findUnique({ where: { id: c.updatedById }, select: { firstName: true } }) : null;
    throw new AppError(ErrorCode.CONFLICT_VERSION, { params: { currentVersion: c.version, updatedByFirstName: who?.firstName ?? null, updatedAt: c.updatedAt.toISOString() } });
  }

  private async done(clientId: string, tx: Tx, now: Date) {
    await refreshClientCaches(tx, clientId, now, await this.settings.get('clients.inactiveAfterDays'));
  }

  // ─── Creation (CRM-041) ───────────────────────────────────────────────────

  /** `GET /admin/clients/contact-check` (`client.read`). */
  async check(auth: AuthContext, rawQuery: unknown): Promise<ContactCheck> {
    const parsed = contactCheckQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    const staff = await this.views.of(auth);
    const email = parsed.data.email?.trim().toLowerCase() || null;
    const phone = parsed.data.phone?.replace(/[\s.()-]/g, '') || null;
    return contactCheck(this.prisma, staff, { email: email && /.+@.+\..+/.test(email) ? email : null, phone: phone && /^\+[1-9]\d{6,14}$/.test(phone) ? phone : null, exceptId: parsed.data.except ?? null });
  }

  /** `POST /admin/clients` (`client.create`). */
  async create(auth: AuthContext, body: unknown): Promise<{ id: string }> {
    const input = parseOrThrow(staffClientCreateSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    const created = await this.prisma.$transaction(async (tx) => {
      const c = await createClientByStaff(tx, this.outbox, staff, auth.actor, now, input);
      await this.done(c.id, tx, now);
      return c;
    });
    this.dispatcher.wake();
    return { id: created.id };
  }

  // ─── Edit by section (CRM-048) ────────────────────────────────────────────

  /** `PATCH /admin/clients/{id}` (`client.update`). */
  async update(auth: AuthContext, id: string, body: unknown): Promise<{ id: string; version: number }> {
    const input = parseOrThrow(clientUpdateSchema, body);
    const staff = await this.views.of(auth);
    if (SENSITIVE_SECTIONS.has(input.section) && !staff.sensitive) throw new AppError(ErrorCode.FORBIDDEN);
    if (staff.masked) throw new AppError(ErrorCode.FORBIDDEN);
    const v = input.values as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    switch (input.section) {
      case 'identity':
        Object.assign(data, { firstName: v.firstName, lastName: v.lastName, nationalities: v.nationalities, ...(staff.sensitive ? { birthDate: toDay(v.birthDate as string | null) } : {}) });
        break;
      case 'contact': {
        const country = v.countryOfResidence as string | null;
        if (country && !(await this.prisma.country.findUnique({ where: { code: country }, select: { code: true } }))) throw AppError.validation([{ field: 'values.countryOfResidence', code: 'INVALID_CHOICE' }]);
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
        if (ids.length && (await this.prisma.region.count({ where: { id: { in: ids }, isActive: true } })) !== new Set(ids).size) throw AppError.validation([{ field: 'values.preferredRegionIds', code: 'INVALID_CHOICE' }]);
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
        Object.assign(data, amounts, { incomeCurrency: any ? currency : null, downPaymentCurrency: amounts.downPayment ? currency : null }); // MOD-303
        break;
      }
      case 'email':
        data.email = v.email ?? null;
        break;
    }
    const now = this.clock.now();
    const result = await this.prisma.$transaction(async (tx) => {
      const before = await this.lock(tx, staff, id);
      if (before.version !== input.version) await this.conflict(tx, id);
      if (input.section === 'email') {
        // CRM-048 — the address of a client WITH an account is changed by the client (AUTH-080) or by « Changer l'adresse du compte »
        const user = before.userId ? await tx.user.findUnique({ where: { id: before.userId }, select: { status: true } }) : null;
        if (user && user.status !== 'DELETED') throw AppError.conflictState('CLIENT_HAS_ACCOUNT');
        const email = data.email as string | null;
        if (!email && !before.phone) throw AppError.validation([{ field: 'values.email', code: 'REQUIRED' }]); // MOD-302
        if (email && email !== before.email) {
          await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `lead:${email}`);
          const owner = await clientOwningEmail(tx, email, id);
          if (owner) {
            const visible = await tx.client.findFirst({ where: { AND: [{ id: owner.id }, liveClients(staff)] }, select: { id: true } });
            throw new AppError(ErrorCode.VALIDATION_ERROR, { details: [{ field: 'values.email', code: 'ALREADY_USED', params: visible ? { clientId: owner.id, clientName: [owner.lastName?.toLocaleUpperCase('fr'), owner.firstName].filter(Boolean).join(' ') } : { hidden: 1 } }] });
          }
        }
        // AUT-071 — correcting the address lifts « E-mail rejeté »; a new address is not « douteuse » any more
        if (email !== before.email) Object.assign(data, { emailBouncedAt: null, emailDoubtful: false });
      }
      if (input.section === 'contact' && data.phone !== before.phone) data.phoneCheckNeeded = false; // CRM-030: « jusqu'à ce que le numéro soit modifié »
      const changed = Object.keys(data).filter((k) => !same((before as Record<string, unknown>)[k], data[k]));
      if (!changed.length) return { version: before.version };
      const done = await tx.client.updateMany({ where: { id, version: input.version }, data: { ...data, version: { increment: 1 }, updatedById: auth.userId, updatedAt: now, lastActivityAt: now } });
      if (done.count === 0) await this.conflict(tx, id);
      if (input.section === 'identity' && before.userId) await tx.user.update({ where: { id: before.userId }, data: { firstName: data.firstName as string, lastName: data.lastName as string, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'client.updated', entityType: 'Client', entityId: id, clientId: id, after: { changedFields: changed, by: 'STAFF' } });
      await this.outbox.add(tx, this.event('client.updated', id, auth.actor, { changedFields: changed }), now);
      await this.done(id, tx, now);
      return { version: before.version + 1 };
    });
    this.dispatcher.wake();
    return { id, version: result.version };
  }

  // ─── Ne pas contacter (CRM-060) ───────────────────────────────────────────

  /** `POST /admin/clients/{id}/do-not-contact` (`client.update`). */
  async doNotContact(auth: AuthContext, id: string, body: unknown): Promise<{ id: string }> {
    const input = parseOrThrow(clientDoNotContactSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const c = await this.lock(tx, staff, id);
      if (c.doNotContact === input.enabled) return;
      const data = input.enabled ? { doNotContact: true, doNotContactReason: input.reason, doNotContactAt: now } : { doNotContact: false, doNotContactReason: null, doNotContactAt: null };
      await tx.client.update({ where: { id }, data: { ...data, version: { increment: 1 }, updatedById: auth.userId, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'client.do_not_contact_changed', entityType: 'Client', entityId: id, clientId: id, before: { doNotContact: c.doNotContact }, after: { doNotContact: input.enabled }, reason: input.enabled ? input.reason : null });
      await this.outbox.add(tx, this.event('client.updated', id, auth.actor, { changedFields: ['doNotContact'] }), now);
    });
    this.dispatcher.wake();
    return { id };
  }

  // ─── Archive (CRM-065, CYC-061) ───────────────────────────────────────────

  private async archiveOne(tx: Tx, staff: StaffView, actor: Actor, id: string, reason: string | null, now: Date): Promise<'DONE' | 'ALREADY' | 'HAS_OPEN_DOSSIER'> {
    const c = await this.lock(tx, staff, id);
    if (c.archivedAt) return 'ALREADY';
    const open = await tx.dossier.count({ where: { clientId: id, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] } } });
    if (open) return 'HAS_OPEN_DOSSIER';
    await tx.client.update({ where: { id }, data: { archivedAt: now, archivedReason: reason, version: { increment: 1 }, updatedById: actor.userId, updatedAt: now } });
    // CYC-061 — his alerts are switched off
    await tx.searchAlert.updateMany({ where: { clientId: id, isActive: true }, data: { isActive: false, deactivatedAt: now, deactivatedReason: 'ADMIN', updatedAt: now } });
    await writeAudit(tx, actor, now, { action: 'client.archived', entityType: 'Client', entityId: id, clientId: id, reason });
    await this.outbox.add(tx, this.event('client.archived', id, actor), now);
    await this.done(id, tx, now);
    return 'DONE';
  }

  /** `POST /admin/clients/{id}/archive` (`client.archive`). */
  async archive(auth: AuthContext, id: string, body: unknown): Promise<{ id: string }> {
    const { reason } = parseOrThrow(clientArchiveSchema, body ?? {});
    const staff = await this.views.of(auth);
    const outcome = await this.prisma.$transaction((tx) => this.archiveOne(tx, staff, auth.actor, id, reason, this.clock.now()));
    if (outcome === 'HAS_OPEN_DOSSIER') throw AppError.conflictState('HAS_OPEN_DOSSIER');
    this.dispatcher.wake();
    return { id };
  }

  /** `POST /admin/clients/{id}/unarchive` (`client.archive`). */
  async unarchive(auth: AuthContext, id: string): Promise<{ id: string }> {
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const c = await this.lock(tx, staff, id);
      if (!c.archivedAt) return;
      await tx.client.update({ where: { id }, data: { archivedAt: null, archivedReason: null, version: { increment: 1 }, updatedById: auth.userId, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'client.unarchived', entityType: 'Client', entityId: id, clientId: id });
      await this.outbox.add(tx, this.event('client.unarchived', id, auth.actor), now);
      await this.done(id, tx, now);
    });
    this.dispatcher.wake();
    return { id };
  }

  // ─── Referent adviser (CRM-040) ───────────────────────────────────────────

  private async assignOne(tx: Tx, staff: StaffView, actor: Actor, id: string, agentId: string | null, now: Date): Promise<'DONE' | 'ALREADY'> {
    const c = await this.lock(tx, staff, id);
    if (c.assignedAgentId === agentId) return 'ALREADY';
    await tx.client.update({ where: { id }, data: { assignedAgentId: agentId, version: { increment: 1 }, updatedById: actor.userId, updatedAt: now } });
    await writeAudit(tx, actor, now, { action: 'client.assigned', entityType: 'Client', entityId: id, clientId: id, before: { assignedAgentId: c.assignedAgentId }, after: { assignedAgentId: agentId } });
    await this.outbox.add(tx, this.event('client.updated', id, actor, { changedFields: ['assignedAgentId'] }), now);
    return 'DONE';
  }

  /** `POST /admin/clients/{id}/assign` (`client.assign`) — null: nobody. */
  async assign(auth: AuthContext, id: string, body: unknown): Promise<{ id: string }> {
    const { agentId } = parseOrThrow(clientAssignSchema, body);
    const staff = await this.views.of(auth);
    await this.prisma.$transaction(async (tx) => {
      if (agentId) await assertAdvisor(tx, agentId, 'agentId');
      await this.assignOne(tx, staff, auth.actor, id, agentId, this.clock.now());
    });
    this.dispatcher.wake();
    return { id };
  }

  /** `POST /admin/clients/bulk` — change the referent adviser (`client.assign`) · archive (`client.archive`). */
  async bulk(auth: AuthContext, body: unknown): Promise<ClientBulkResult> {
    const input = parseOrThrow(clientBulkSchema, body);
    const staff = await this.views.of(auth);
    if (!staff.has(input.action === 'assign' ? 'client.assign' : 'client.archive')) throw new AppError(ErrorCode.FORBIDDEN);
    if (input.action === 'assign') await assertAdvisor(this.prisma, input.agentId, 'agentId');
    const result: ClientBulkResult = { done: 0, skipped: [] };
    for (const id of [...new Set(input.ids)]) {
      try {
        const outcome = await this.prisma.$transaction((tx) => (input.action === 'assign' ? this.assignOne(tx, staff, auth.actor, id, input.agentId, this.clock.now()) : this.archiveOne(tx, staff, auth.actor, id, null, this.clock.now())));
        if (outcome === 'DONE') result.done += 1;
        else result.skipped.push({ id, reason: outcome });
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        result.skipped.push({ id, reason: err.code === 'NOT_FOUND' ? 'NOT_FOUND' : (err.options.reason ?? err.code) });
      }
    }
    this.dispatcher.wake();
    return result;
  }

  // ─── « Numéro vérifié », « Adresse vérifiée » (CRM-030, CRM-048, AUT-071) ──

  async confirmPhone(auth: AuthContext, id: string): Promise<{ id: string }> {
    return this.flag(auth, id, 'phone');
  }
  async confirmEmail(auth: AuthContext, id: string): Promise<{ id: string }> {
    return this.flag(auth, id, 'email');
  }

  private async flag(auth: AuthContext, id: string, what: 'phone' | 'email'): Promise<{ id: string }> {
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const c = await this.lock(tx, staff, id);
      if (what === 'phone' ? !c.phoneCheckNeeded : !c.emailBouncedAt && !c.emailDoubtful) return;
      await tx.client.update({ where: { id }, data: { ...(what === 'phone' ? { phoneCheckNeeded: false } : { emailBouncedAt: null, emailDoubtful: false }), version: { increment: 1 }, updatedById: auth.userId, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'client.updated', entityType: 'Client', entityId: id, clientId: id, after: { confirmed: what } });
      if (what === 'phone') await this.done(id, tx, now);
    });
    return { id };
  }

  // ─── Trusted persons (PRO-040, CRM-046 « Proches ») ───────────────────────

  private person(r: { id: string; fullName: string; relation: string | null; phone: string | null; email: string | null; canVisitOnBehalf: boolean; notes: string | null; informedConfirmedAt: Date | null }): TrustedPerson {
    return { ...r, informedConfirmedAt: r.informedConfirmedAt?.toISOString() ?? null };
  }

  async addContact(auth: AuthContext, id: string, body: unknown): Promise<TrustedPerson> {
    const input = parseOrThrow(clientContactSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, staff, id);
      if ((await tx.clientContact.count({ where: { clientId: id } })) >= CLIENT_CONTACTS_MAX) throw AppError.conflictState('CONTACTS_LIMIT', { n: CLIENT_CONTACTS_MAX });
      const created = await tx.clientContact.create({ data: { id: newId(), clientId: id, ...input, createdById: auth.userId, updatedById: auth.userId, createdAt: now, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'client_contact.created', entityType: 'ClientContact', entityId: created.id, clientId: id });
      return created;
    });
    return this.person(row);
  }

  async updateContact(auth: AuthContext, id: string, contactId: string, body: unknown): Promise<TrustedPerson> {
    const input = parseOrThrow(clientContactSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, staff, id);
      const existing = await tx.clientContact.findFirst({ where: { id: contactId, clientId: id }, select: { id: true } });
      if (!existing) throw AppError.notFound();
      const updated = await tx.clientContact.update({ where: { id: contactId }, data: { ...input, updatedById: auth.userId, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'client_contact.updated', entityType: 'ClientContact', entityId: contactId, clientId: id });
      return updated;
    });
    return this.person(row);
  }

  async deleteContact(auth: AuthContext, id: string, contactId: string): Promise<void> {
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, staff, id);
      const existing = await tx.clientContact.findFirst({ where: { id: contactId, clientId: id }, select: { id: true } });
      if (!existing) throw AppError.notFound();
      await tx.clientContact.delete({ where: { id: contactId } });
      await writeAudit(tx, auth.actor, now, { action: 'client_contact.deleted', entityType: 'ClientContact', entityId: contactId, clientId: id });
    });
  }
}
