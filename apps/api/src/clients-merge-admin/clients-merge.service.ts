// Package 3.3 « Doublons et fusion » — CRM-080, CRM-081, CRM-045 « Mettre à jour la fiche » (MOD-300).
//   · « Ce n'est pas un doublon »: each record keeps the other in `notDuplicateOfIds`, durably;
//   · the merge preview and the merge itself, ONE transaction, both rows locked in a stable order. Rule 3 — everything
//     that carries the client's identifier moves: the columns are read from the database catalogue (every foreign key
//     to `clients.id`, present or to come), with the special cases that cannot simply be moved (favourites and trusted
//     persons without duplicate, general threads united, notification preferences where an «off» stays off, survey
//     invitations, notes). Irreversible; traced with the names of the fields chosen;
//   · the differences of the last request, and taking chosen values from it.
import { Inject, Injectable } from '@nestjs/common';
import {
  applyLeadValuesSchema,
  clientMergeSchema,
  clientNotDuplicateSchema,
  ErrorCode,
  type LeadDifferences,
  type MergePreview,
  type MergeRecordSummary,
} from '@dp/contracts';
import type { Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import { clientName, clientScope, maskName, staffName, StaffViews, type StaffView } from '../back-office/staff-view.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { refreshClientCaches } from '../leads/lead-records.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { currentRequestId } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { keptRecord, latestConsents, MERGE_FIELDS, mergeFields, protections, resolvedColumns } from './merge-rules.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tables handled before the generic move (they hold a unique key with the client, or must be united). */
export const SPECIAL_TABLES = new Set(['favorites', 'client_contacts', 'conversations', 'notification_preferences', 'survey_invitations', 'search_alerts', 'clients']);

/** Tables whose unique key on the client could collide, prevented by a refusal of the preview (rule 5): the two open dossiers on one property. */
export const REFUSAL_GUARDED_TABLES: Readonly<Record<string, 'SAME_PROPERTY'>> = { dossiers: 'SAME_PROPERTY' };

/** Every column of the database that references `clients.id` (rule 3: « présent ou à venir »). */
export async function clientForeignKeys(db: Tx | PrismaService): Promise<{ table: string; column: string }[]> {
  return db.$queryRaw<{ table: string; column: string }[]>`
    SELECT kcu.table_name AS "table", kcu.column_name AS "column"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'clients' AND ccu.column_name = 'id' AND tc.table_schema = 'public'
    ORDER BY kcu.table_name, kcu.column_name`;
}

@Injectable()
export class ClientsMergeService {
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

  private async visible(db: Tx | PrismaService, staff: StaffView, id: string) {
    if (!UUID.test(id)) throw AppError.notFound();
    const c = await db.client.findFirst({ where: { AND: [{ id, deletedAt: null }, clientScope(staff)] }, include: { user: { select: { status: true } } } });
    if (!c) throw AppError.notFound();
    return c;
  }

  // ─── « Ce n'est pas un doublon » (CRM-081) ────────────────────────────────

  async notDuplicate(auth: AuthContext, id: string, body: unknown): Promise<{ id: string }> {
    const { otherId } = parseOrThrow(clientNotDuplicateSchema, body);
    if (otherId === id) throw AppError.validation([{ field: 'otherId', code: 'INVALID_CHOICE' }]);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const [a, b] = await Promise.all([this.visible(tx, staff, id), tx.client.findFirst({ where: { id: otherId, deletedAt: null }, select: { id: true, notDuplicateOfIds: true } })]);
      if (!b) throw AppError.validation([{ field: 'otherId', code: 'INVALID_CHOICE' }]);
      if (!a.notDuplicateOfIds.includes(otherId)) await tx.client.update({ where: { id }, data: { notDuplicateOfIds: { push: otherId }, updatedAt: now } });
      if (!b.notDuplicateOfIds.includes(id)) await tx.client.update({ where: { id: otherId }, data: { notDuplicateOfIds: { push: id }, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'client.not_duplicate_marked', entityType: 'Client', entityId: id, clientId: id, after: { otherId } });
    });
    return { id };
  }

  // ─── Preview (CRM-080) ────────────────────────────────────────────────────

  private async summary(db: Tx | PrismaService, c: Awaited<ReturnType<ClientsMergeService['visible']>>, staff: StaffView): Promise<MergeRecordSummary> {
    const [leads, dossiers, simulations, registrations, notes, agent] = await Promise.all([
      db.lead.count({ where: { clientId: c.id } }),
      db.dossier.count({ where: { clientId: c.id, deletedAt: null } }),
      db.simulation.count({ where: { clientId: c.id } }),
      db.eventRegistration.count({ where: { clientId: c.id } }),
      db.note.count({ where: { entityType: 'CLIENT', entityId: c.id, deletedAt: null } }),
      c.assignedAgentId ? db.user.findUnique({ where: { id: c.assignedAgentId }, select: { firstName: true, lastName: true, status: true } }) : null,
    ]);
    return {
      id: c.id,
      name: staff.masked ? maskName(c.firstName, c.lastName) : clientName(c),
      email: staff.masked ? null : c.email,
      phone: staff.masked ? null : c.phone,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      hasAccount: Boolean(c.userId && c.user && c.user.status !== 'DELETED'),
      agentName: staffName(agent),
      version: c.version,
      counts: { leads, dossiers, simulations, registrations, notes },
      flags: { doNotContact: c.doNotContact, restricted: Boolean(c.restrictedAt), phoneCheckNeeded: c.phoneCheckNeeded, emailBounced: Boolean(c.emailBouncedAt) },
    };
  }

  /** Refusals known in advance: an erased record, both with an account, an open dossier on the same property (MOD-310). */
  private async refusal(db: Tx | PrismaService, a: { id: string; gdprErasedAt: Date | null; mergedIntoId: string | null }, b: typeof a): Promise<{ code: MergePreview['refusal']; detail: string[] | null }> {
    if (a.id === b.id) return { code: 'SAME_RECORD', detail: null };
    if (a.gdprErasedAt || b.gdprErasedAt) return { code: 'ERASED', detail: null };
    if (a.mergedIntoId || b.mergedIntoId) return { code: 'ALREADY_MERGED', detail: null };
    const open = await db.dossier.findMany({ where: { clientId: { in: [a.id, b.id] }, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] }, propertyId: { not: null } }, select: { clientId: true, propertyId: true, reference: true } });
    const same = open.filter((d) => d.clientId === a.id && open.some((e) => e.clientId === b.id && e.propertyId === d.propertyId));
    if (same.length) return { code: 'SAME_PROPERTY', detail: open.filter((d) => same.some((s) => s.propertyId === d.propertyId)).map((d) => d.reference) };
    return { code: null, detail: null };
  }

  async preview(auth: AuthContext, id: string, query: Record<string, unknown>): Promise<MergePreview> {
    const staff = await this.views.of(auth);
    const otherId = typeof query.with === 'string' ? query.with : '';
    const chosen = typeof query.keep === 'string' ? query.keep : null;
    const [a, b] = await Promise.all([this.visible(this.prisma, staff, id), this.visible(this.prisma, staff, otherId)]);
    const sideOf = (c: typeof a) => ({ id: c.id, createdAt: c.createdAt, hasAccount: Boolean(c.userId && c.user && c.user.status !== 'DELETED'), gdprErasedAt: c.gdprErasedAt, mergedIntoId: c.mergedIntoId, deletedAt: c.deletedAt });
    const rule = keptRecord(sideOf(a), sideOf(b), chosen);
    const known = await this.refusal(this.prisma, a, b);
    const keepId = 'keepId' in rule ? rule.keepId : a.createdAt <= b.createdAt ? a.id : b.id;
    const keep = keepId === a.id ? a : b;
    const absorbed = keepId === a.id ? b : a;
    const [keepSummary, absorbedSummary, fks] = await Promise.all([this.summary(this.prisma, keep, staff), this.summary(this.prisma, absorbed, staff), clientForeignKeys(this.prisma)]);
    // what moves (rule 3), counted per table
    const moves: Record<string, number> = {};
    for (const fk of fks) {
      if (fk.table === 'clients') continue;
      const rows = await this.prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${fk.table}" WHERE "${fk.column}" = $1::uuid`, absorbed.id);
      if (rows[0]?.n) moves[fk.table] = (moves[fk.table] ?? 0) + rows[0].n;
    }
    const notes = await this.prisma.note.count({ where: { entityType: 'CLIENT', entityId: absorbed.id, deletedAt: null } });
    if (notes) moves.notes = notes;
    const prot: MergePreview['protections'] = [];
    if (a.doNotContact || b.doNotContact) prot.push('DO_NOT_CONTACT');
    if (a.restrictedAt || b.restrictedAt) prot.push('RESTRICTED');
    if (a.phoneCheckNeeded || b.phoneCheckNeeded) prot.push('PHONE_CHECK');
    if (a.emailBouncedAt || b.emailBouncedAt) prot.push('EMAIL_BOUNCED');
    prot.push('CONSENTS', 'PREFERENCES');
    return {
      keep: keepSummary,
      absorbed: absorbedSummary,
      keepRule: 'refusal' in rule ? 'ACCOUNT' : rule.rule,
      fields: staff.masked ? [] : mergeFields(keep as never, absorbed as never, staff.sensitive),
      moves,
      protections: prot,
      absorbedEmail: absorbed.email ? { address: staff.masked ? '' : absorbed.email, becomes: keep.email ? 'ALTERNATE' : 'MAIN' } : null,
      refusal: 'refusal' in rule ? rule.refusal : known.code,
      refusalDetail: known.detail,
    };
  }

  // ─── The merge (CRM-080) ──────────────────────────────────────────────────

  async merge(auth: AuthContext, id: string, body: unknown): Promise<{ id: string }> {
    const input = parseOrThrow(clientMergeSchema, body);
    const staff = await this.views.of(auth);
    if (staff.masked) throw new AppError(ErrorCode.FORBIDDEN);
    if (input.keepId !== id && input.keepId !== input.otherId) throw AppError.validation([{ field: 'keepId', code: 'INVALID_CHOICE' }]);
    const now = this.clock.now();
    const keepId = await this.prisma.$transaction(
      async (tx) => {
        // both rows locked in a stable order (FIA-020)
        for (const lockId of [id, input.otherId].sort()) await tx.$queryRawUnsafe(`SELECT id FROM clients WHERE id = $1::uuid FOR UPDATE`, lockId);
        const [a, b] = await Promise.all([this.visible(tx, staff, id), this.visible(tx, staff, input.otherId)]);
        const sideOf = (c: typeof a) => ({ id: c.id, createdAt: c.createdAt, hasAccount: Boolean(c.userId && c.user && c.user.status !== 'DELETED'), gdprErasedAt: c.gdprErasedAt, mergedIntoId: c.mergedIntoId, deletedAt: c.deletedAt });
        const rule = keptRecord(sideOf(a), sideOf(b), input.keepId);
        if ('refusal' in rule) throw AppError.conflictState('BOTH_ACCOUNTS');
        if (rule.keepId !== input.keepId) throw AppError.conflictState('KEPT_RECORD_IMPOSED');
        const known = await this.refusal(tx, a, b);
        if (known.code) throw AppError.conflictState(known.code === 'SAME_PROPERTY' ? 'DOSSIER_ALREADY_OPEN_FOR_PROPERTY' : known.code, known.detail ? { reference: known.detail.join(', ') } : null);
        const keep = rule.keepId === a.id ? a : b;
        const absorbed = rule.keepId === a.id ? b : a;
        if (keep.version !== input.versions.keep || absorbed.version !== input.versions.absorbed) throw new AppError(ErrorCode.CONFLICT_VERSION);
        const sensitiveChoices = staff.sensitive ? input.choices : Object.fromEntries(Object.entries(input.choices).filter(([k]) => !MERGE_FIELDS.find((g) => g.key === k)?.sensitive));

        // rule 2 — the fields; rule 5 — the address; rule 4 — the protections; rule 6 — the referent
        const columns = resolvedColumns(keep as never, absorbed as never, sensitiveChoices);
        const finalEmail = keep.email ?? absorbed.email ?? null;
        const alternates = new Set([...keep.alternateEmails, ...absorbed.alternateEmails]);
        if (keep.email && absorbed.email && absorbed.email.toLowerCase() !== keep.email.toLowerCase()) alternates.add(absorbed.email);
        if (finalEmail) alternates.delete(finalEmail);

        await this.moveEverything(tx, keep.id, absorbed.id, now);

        // consents: the most recent line of each type counts — the cache `marketingOptIn` follows it
        const consents = await tx.consent.findMany({ where: { clientId: keep.id }, select: { type: true, givenAt: true, granted: true } });
        const marketing = latestConsents(consents).get('MARKETING_EMAIL');

        // rule 7 — the absorbed record becomes a pointer, emptied (it frees its address before the kept one takes it)
        await tx.client.update({
          where: { id: absorbed.id },
          data: { deletedAt: now, mergedIntoId: keep.id, email: null, alternateEmails: [], phone: null, firstName: null, lastName: null, userId: null, notDuplicateOfIds: [], assignedAgentId: null, version: { increment: 1 }, updatedAt: now, updatedById: auth.userId },
        });
        await tx.client.updateMany({ where: { mergedIntoId: absorbed.id }, data: { mergedIntoId: keep.id } });
        await tx.client.update({
          where: { id: keep.id },
          data: {
            ...columns,
            email: finalEmail,
            alternateEmails: [...alternates],
            ...protections(keep as never, absorbed as never, finalEmail),
            marketingOptIn: marketing ? marketing.granted : keep.marketingOptIn || absorbed.marketingOptIn,
            assignedAgentId: keep.assignedAgentId ?? absorbed.assignedAgentId,
            userId: keep.userId ?? absorbed.userId,
            notDuplicateOfIds: [...new Set([...keep.notDuplicateOfIds, ...absorbed.notDuplicateOfIds])].filter((x) => x !== keep.id && x !== absorbed.id),
            archivedAt: keep.archivedAt && absorbed.archivedAt ? keep.archivedAt : null,
            lastActivityAt: keep.lastActivityAt > absorbed.lastActivityAt ? keep.lastActivityAt : absorbed.lastActivityAt,
            version: { increment: 1 },
            updatedById: auth.userId,
            updatedAt: now,
          } as never,
        });
        await refreshClientCaches(tx, keep.id, now, await this.settings.get('clients.inactiveAfterDays'));
        // SEC-081 — the names of the fields chosen, never their values
        await writeAudit(tx, auth.actor, now, { action: 'client.merged', entityType: 'Client', entityId: keep.id, clientId: keep.id, after: { mergedClientId: absorbed.id, chosenFields: Object.entries(sensitiveChoices).filter(([, side]) => side === 'OTHER').map(([k]) => k), keepRule: rule.rule } });
        await this.outbox.add(tx, domainEvent({ type: 'client.merged', aggregate: { type: 'Client', id: keep.id }, actor: { type: 'USER', id: auth.userId }, clientId: keep.id, data: { mergedClientId: absorbed.id }, requestId: this.requestId() }), now);
        return keep.id;
      },
      { timeout: 60_000 },
    );
    this.dispatcher.wake();
    return { id: keepId };
  }

  /** Rule 3 — the special cases first, then every column that references `clients.id`. */
  private async moveEverything(tx: Tx, keepId: string, absorbedId: string, now: Date): Promise<void> {
    // favourites without duplicate (primary key client + property)
    await tx.$executeRaw`DELETE FROM favorites f WHERE f.client_id = ${absorbedId}::uuid AND EXISTS (SELECT 1 FROM favorites k WHERE k.client_id = ${keepId}::uuid AND k.property_id = f.property_id)`;
    // trusted persons without duplicate (same name)
    await tx.$executeRaw`DELETE FROM client_contacts c WHERE c.client_id = ${absorbedId}::uuid AND EXISTS (SELECT 1 FROM client_contacts k WHERE k.client_id = ${keepId}::uuid AND lower(k.full_name) = lower(c.full_name))`;
    // alerts without duplicate (same criteria)
    await tx.$executeRaw`DELETE FROM search_alerts a WHERE a.client_id = ${absorbedId}::uuid AND EXISTS (SELECT 1 FROM search_alerts k WHERE k.client_id = ${keepId}::uuid AND k.criteria = a.criteria)`;
    // notification preferences: a group switched off on either stays off
    await tx.$executeRaw`UPDATE notification_preferences k SET email_enabled = k.email_enabled AND a.email_enabled, updated_at = ${now} FROM notification_preferences a WHERE k.client_id = ${keepId}::uuid AND a.client_id = ${absorbedId}::uuid AND a."group" = k."group"`;
    await tx.$executeRaw`DELETE FROM notification_preferences a WHERE a.client_id = ${absorbedId}::uuid AND EXISTS (SELECT 1 FROM notification_preferences k WHERE k.client_id = ${keepId}::uuid AND k."group" = a."group")`;
    // survey invitations already sent for the same context
    await tx.$executeRaw`DELETE FROM survey_invitations s WHERE s.client_id = ${absorbedId}::uuid AND EXISTS (SELECT 1 FROM survey_invitations k WHERE k.client_id = ${keepId}::uuid AND k.survey_id = s.survey_id AND k.dossier_id IS NOT DISTINCT FROM s.dossier_id AND k.event_id IS NOT DISTINCT FROM s.event_id)`;
    // threads: the general thread (and any thread of the same key) united, messages in date order
    const threads = await tx.conversation.findMany({ where: { clientId: absorbedId } });
    for (const th of threads) {
      const twin = await tx.conversation.findFirst({ where: { clientId: keepId, dossierId: th.dossierId, partnerOrganizationId: th.partnerOrganizationId } });
      if (!twin) continue;
      await tx.message.updateMany({ where: { conversationId: th.id }, data: { conversationId: twin.id } });
      const last = await tx.message.findFirst({ where: { conversationId: twin.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, body: true } });
      await tx.conversation.update({ where: { id: twin.id }, data: { unreadByClient: twin.unreadByClient + th.unreadByClient, unreadByStaff: twin.unreadByStaff + th.unreadByStaff, lastMessageAt: last?.createdAt ?? twin.lastMessageAt, lastMessagePreview: last ? last.body.slice(0, 160) : twin.lastMessagePreview, updatedAt: now } });
      await tx.conversation.delete({ where: { id: th.id } });
    }
    // every other column referencing the client
    for (const fk of await clientForeignKeys(tx)) {
      if (fk.table === 'clients') continue;
      await tx.$executeRawUnsafe(`UPDATE "${fk.table}" SET "${fk.column}" = $1::uuid WHERE "${fk.column}" = $2::uuid`, keepId, absorbedId);
    }
    // notes hang on the record by a polymorphic key
    await tx.note.updateMany({ where: { entityType: 'CLIENT', entityId: absorbedId }, data: { entityId: keepId } });
  }

  // ─── « Mettre à jour la fiche » (CRM-045, MOD-300) ────────────────────────

  private async lastLead(db: Tx | PrismaService, clientId: string) {
    return db.lead.findFirst({ where: { clientId, status: { not: 'SPAM' } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, reference: true, createdAt: true, firstName: true, lastName: true, phone: true, payload: true } });
  }

  private differences(c: { firstName: string | null; lastName: string | null; phone: string | null; countryOfResidence: string | null }, lead: NonNullable<Awaited<ReturnType<ClientsMergeService['lastLead']>>>): LeadDifferences['fields'] {
    const fields = ((lead.payload as { fields?: Record<string, unknown> })?.fields ?? {}) as Record<string, unknown>;
    const sent = {
      firstName: (fields.firstName as string | undefined) ?? lead.firstName,
      lastName: (fields.lastName as string | undefined) ?? lead.lastName,
      phone: (fields.phone as string | undefined) ?? lead.phone,
      countryOfResidence: (fields.countryOfResidence as string | undefined) ?? null,
    };
    const fold = (s: string) => s.trim().toLocaleLowerCase('fr').normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const out: LeadDifferences['fields'] = [];
    for (const key of ['firstName', 'lastName', 'phone', 'countryOfResidence'] as const) {
      const value = sent[key];
      if (value && c[key] && fold(value) !== fold(c[key]!)) out.push({ key, record: c[key], lead: value });
    }
    return out;
  }

  async leadDifferences(auth: AuthContext, id: string): Promise<LeadDifferences> {
    const staff = await this.views.of(auth);
    const c = await this.visible(this.prisma, staff, id);
    if (staff.masked) return { lead: null, fields: [] };
    const lead = await this.lastLead(this.prisma, id);
    if (!lead) return { lead: null, fields: [] };
    const fields = this.differences(c, lead);
    return { lead: fields.length ? { id: lead.id, reference: lead.reference, createdAt: lead.createdAt.toISOString() } : null, fields };
  }

  async applyLeadValues(auth: AuthContext, id: string, body: unknown): Promise<{ id: string }> {
    const input = parseOrThrow(applyLeadValuesSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT id FROM clients WHERE id = $1::uuid FOR UPDATE`, id);
      const c = await this.visible(tx, staff, id);
      const lead = await this.lastLead(tx, id);
      if (!lead || lead.id !== input.leadId) throw AppError.conflictState('LEAD_NOT_LATEST');
      const diffs = this.differences(c, lead).filter((d) => input.fields.includes(d.key));
      if (!diffs.length) return;
      if (diffs.some((d) => d.key === 'countryOfResidence')) {
        const code = diffs.find((d) => d.key === 'countryOfResidence')!.lead;
        if (!(await tx.country.findUnique({ where: { code }, select: { code: true } }))) throw AppError.validation([{ field: 'fields', code: 'INVALID_CHOICE' }]);
      }
      const data: Record<string, unknown> = Object.fromEntries(diffs.map((d) => [d.key, d.lead]));
      if ('phone' in data) data.phoneCheckNeeded = false;
      await tx.client.update({ where: { id }, data: { ...data, version: { increment: 1 }, updatedById: auth.userId, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'client.updated', entityType: 'Client', entityId: id, clientId: id, after: { changedFields: diffs.map((d) => d.key), fromLead: lead.reference } });
      await this.outbox.add(tx, domainEvent({ type: 'client.updated', aggregate: { type: 'Client', id }, actor: { type: 'USER', id: auth.userId }, clientId: id, data: { changedFields: diffs.map((d) => d.key) }, requestId: this.requestId() }), now);
      await refreshClientCaches(tx, id, now, await this.settings.get('clients.inactiveAfterDays'));
    });
    this.dispatcher.wake();
    return { id };
  }
}

export type { Actor };
