// DEM-013, D-095 — `POST /public/leads/complete`: the second screen of a projection, by the completion token handed
// out by the first submission (DEM-027), within 30 minutes. Two gestures:
// - the address alone (« Modifier »): the typo is corrected — on the request, and on the client record it is attached
//   to — and the acknowledgement leaves again to the right address; the token stays usable for the completion;
// - the other fields (« Compléter ma demande »): written once into `payload.step2` (or into the supplement it belongs
//   to, DEM-027), completing the EMPTY fields of the record (MOD-300); the token is then spent.
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode, LEAD_COMPLETION_MINUTES, leadCompleteSchema, type LeadCompleteResponse } from '@dp/contracts';
import { firstContactDueAt } from '@dp/domain';
import type { Request } from 'express';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { completeClient, type ClientState } from './client-record.js';
import type { Supplement } from './duplicate.js';
import { findClientByEmail, openOrJoinDossier, privacyPolicyVersion, refreshClientCaches, upsertClientForLead, writeConsents } from './lead-records.js';
import type { ResolvedObject } from './lead-objects.js';
import { hashToken, LEAD_RATE_RULES, validateCallbackDate } from './lead-input.js';

type Step2Fields = Record<string, unknown>;

const NO_OBJECT: ResolvedObject = { property: null, program: null, lotId: null, outcome: null, candidateStatus: 'INTERESTED' };

@Injectable()
export class CompleteLeadService {
  constructor(
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly outbox: OutboxWriter,
    private readonly idempotency: IdempotencyService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  async complete(req: Request, body: unknown): Promise<LeadCompleteResponse> {
    const input = parseOrThrow(leadCompleteSchema, body);
    const fields = Object.fromEntries(Object.entries(input.fields).filter(([, v]) => v !== undefined)) as Step2Fields;
    const now = this.clock.now();
    const cal = await this.calendar.load();
    validateCallbackDate(fields.preferredCallbackDate as string | undefined, now, cal);
    const newEmail = fields.email as string | undefined;
    if (newEmail) {
      // DEM-032 — the corrected address is an address that will receive an e-mail: same allowance.
      const wait = this.limiter.retryAfter(`lead:email:d:${this.ip.keyHash(newEmail)}`, LEAD_RATE_RULES.emailDay);
      if (wait > 0) throw AppError.rateLimited(wait);
    }
    // Not a creating route: the key is honoured when sent, not required (API-040).
    const result = await this.idempotency.run(req, { route: 'public.leads.complete', required: false }, {
      status: 200,
      execute: (tx) => this.execute(tx, hashToken(input.completionToken), fields, cal),
    });
    if (!result.replayed) {
      if (newEmail) this.limiter.record(`lead:email:d:${this.ip.keyHash(newEmail)}`, LEAD_RATE_RULES.emailDay);
      this.dispatcher.wake();
    }
    return result.body;
  }

  private async execute(tx: Tx, tokenHash: string, fields: Step2Fields, cal: Awaited<ReturnType<BusinessCalendarService['load']>>): Promise<LeadCompleteResponse> {
    const now = this.clock.now();
    const found = await tx.lead.findFirst({ where: { completionTokenHash: tokenHash }, select: { id: true } });
    if (!found) throw new AppError(ErrorCode.GONE);
    await tx.$queryRawUnsafe(`SELECT id FROM leads WHERE id = $1::uuid FOR UPDATE`, found.id);
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: found.id } });
    if (lead.completionTokenHash !== tokenHash) throw new AppError(ErrorCode.GONE);
    if (!lead.completionExpiresAt || lead.completionExpiresAt.getTime() <= now.getTime()) {
      await tx.lead.update({ where: { id: lead.id }, data: { completionTokenHash: null, completionExpiresAt: null, updatedAt: now } });
      throw new AppError(ErrorCode.GONE);
    }

    // DEM-027 — the token of a supplement completes that supplement: its 30 minutes start at its reception.
    const supplements = ((lead.supplements as Supplement[] | null) ?? []).slice();
    const startedAt = lead.completionExpiresAt.getTime() - LEAD_COMPLETION_MINUTES * 60_000;
    const supplementIndex = supplements.findIndex((s) => new Date(s.receivedAt).getTime() === startedAt);
    const payload = structuredClone(lead.payload) as { fields: Record<string, unknown>; step2: unknown; corrections?: unknown[] };

    const { email: newEmail, ...step2 } = fields as { email?: string } & Step2Fields;
    const changed: string[] = [];
    let email = lead.email ?? '';
    let clientId = lead.clientId;

    if (newEmail && newEmail !== lead.email) {
      if (supplementIndex >= 0) {
        // A supplement shares the first request's address: the correction is kept for the advisor, nothing is resent
        // (the acknowledgement would carry the reference of a request the new address never made).
        supplements[supplementIndex] = { ...supplements[supplementIndex]!, fields: { ...supplements[supplementIndex]!.fields, correctedEmail: newEmail } };
      } else {
        payload.corrections = [...(payload.corrections ?? []), { at: now.toISOString(), field: 'email', from: lead.email, to: newEmail }];
        email = newEmail;
        if (lead.status !== 'SPAM') clientId = await this.moveToAddress(tx, lead, newEmail, now, cal);
        changed.push('email');
      }
    }

    const isCompletion = Object.keys(step2).length > 0;
    const data: Record<string, unknown> = {};
    if (isCompletion) {
      const entry = { receivedAt: now.toISOString(), fields: step2 };
      if (supplementIndex >= 0) supplements[supplementIndex] = { ...supplements[supplementIndex]!, step2: entry };
      else {
        payload.step2 = entry;
        // The request had no name, phone nor day (projection): the second screen gives them (DEM-013).
        if (!lead.firstName && step2.firstName) data.firstName = step2.firstName;
        if (!lead.lastName && step2.lastName) data.lastName = step2.lastName;
        if (!lead.phone && step2.phone) data.phone = step2.phone;
        if (!lead.preferredCallbackDate && step2.preferredCallbackDate) {
          data.preferredCallbackDate = new Date(`${step2.preferredCallbackDate as string}T00:00:00Z`);
          // CAL-061 — a later chosen day moves the deadline to the end of that day.
          const slaDays = await this.settings.get('sla.firstContactBusinessDays');
          if (lead.slaDueAt) data.slaDueAt = firstContactDueAt(lead.createdAt, cal, slaDays, step2.preferredCallbackDate as string).dueAt;
        }
        if (!lead.preferredSlot && step2.preferredSlot) data.preferredSlot = step2.preferredSlot;
      }
      // Spent: « une seule fois » (DEM-013).
      Object.assign(data, { completionTokenHash: null, completionExpiresAt: null });
      if (clientId && lead.status !== 'SPAM') await this.completeRecord(tx, clientId, step2, lead.callerTimezone, now);
    }

    await tx.lead.update({
      where: { id: lead.id },
      data: { ...data, email, payload: payload as never, supplements: supplements.length ? (supplements as never) : undefined, updatedAt: now },
    });
    if (changed.length && lead.status !== 'SPAM') {
      // TRV-097 — the acknowledgement leaves again, to the corrected address.
      await this.outbox.add(tx, { type: 'lead.supplemented', aggregateType: 'Lead', aggregateId: lead.id, payload: { changedFields: changed, supplementIndex: null } }, now);
    }

    const fieldsOut = { ...payload.fields, ...((payload.step2 as { fields?: Step2Fields } | null)?.fields ?? {}) };
    return {
      kind: lead.kind,
      firstName: (fieldsOut.firstName as string | undefined) ?? null,
      email,
      preferredCallbackDate: (fieldsOut.preferredCallbackDate as string | undefined) ?? null,
      preferredSlot: (fieldsOut.preferredSlot as LeadCompleteResponse['preferredSlot'] | undefined) ?? null,
      accountHint: payload.fields.createAccount === true,
      propertyOutcome: null,
    };
  }

  /** MOD-300 — the second screen completes the empty fields of the record. */
  private async completeRecord(tx: Tx, clientId: string, f: Step2Fields, callerTimezone: string | null, now: Date): Promise<void> {
    const current = await tx.client.findUniqueOrThrow({ where: { id: clientId } });
    if (f.countryOfResidence) {
      const country = await tx.country.findUnique({ where: { code: f.countryOfResidence as string }, select: { code: true } });
      if (!country) throw AppError.validation([{ field: 'fields.countryOfResidence', code: 'INVALID_CHOICE' }]);
    }
    const patch = completeClient(current as unknown as ClientState, {
      firstName: (f.firstName as string | undefined) ?? null,
      lastName: (f.lastName as string | undefined) ?? null,
      phone: (f.phone as string | undefined) ?? null,
      whatsappOptIn: f.whatsappOptIn === true,
      countryOfResidence: (f.countryOfResidence as string | undefined) ?? null,
      preferredContactSlot: (f.preferredSlot as string | undefined) ?? null,
      timezone: callerTimezone,
    });
    if (Object.keys(patch).length) {
      await tx.client.update({ where: { id: clientId }, data: { ...patch, lastActivityAt: now, version: { increment: 1 }, updatedAt: now } });
      await this.outbox.add(tx, { type: 'client.updated', aggregateType: 'Client', aggregateId: clientId, payload: { changedFields: Object.keys(patch) } }, now);
    }
    await refreshClientCaches(tx, clientId, now, await this.settings.get('clients.inactiveAfterDays'));
  }

  /**
   * D-095 — the request moves to the record of the corrected address. A record created by this very request (and used
   * by nothing else) simply takes the new address when it is free; otherwise the request goes to the record of the
   * new address (found or created, MOD-300), its consent proof is written for that person, and the dossier it opened
   * — still untouched — is withdrawn and opened again for the right person (CYC-002). Consent lines are immutable
   * (MOD-106): those written for the mistyped address stay, attached to the request.
   */
  private async moveToAddress(
    tx: Tx,
    lead: { id: string; reference: string; kind: string; clientId: string | null; createdAt: Date; dossierId: string | null; payload: unknown; callerTimezone: string | null; locale: 'fr' | 'ar' | 'en'; ipHash: string | null; userAgent: string | null },
    newEmail: string,
    now: Date,
    cal: Awaited<ReturnType<BusinessCalendarService['load']>>,
  ): Promise<string | null> {
    if (!lead.clientId) return null;
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `lead:${newEmail}`);
    const current = await tx.client.findUniqueOrThrow({ where: { id: lead.clientId } });
    const others = await tx.lead.count({ where: { clientId: current.id, id: { not: lead.id } } });
    const createdByThisLead = current.createdAt.getTime() === lead.createdAt.getTime() && others === 0 && !current.userId;
    const owner = await findClientByEmail(tx, newEmail);

    if (!owner && createdByThisLead) {
      await tx.client.update({ where: { id: current.id }, data: { email: newEmail, emailDoubtful: false, version: { increment: 1 }, updatedAt: now } });
      return current.id;
    }
    if (owner?.id === current.id) return current.id;

    const fields = (lead.payload as { fields?: Record<string, unknown> }).fields ?? {};
    const target = await upsertClientForLead(tx, this.outbox, {
      email: newEmail,
      facts: {
        downPayment: fields.downPayment ? { amount: fields.downPayment as string, currency: (fields.budgetCurrency as string) ?? 'EUR' } : null,
        monthlyBudget: fields.monthlyBudget ? { amount: fields.monthlyBudget as string, currency: (fields.budgetCurrency as string) ?? 'EUR' } : null,
        timezone: lead.callerTimezone,
      },
      locale: lead.locale,
      utm: null,
      emailDoubtful: false,
      leadReference: lead.reference,
      now,
    });

    // The dossier opened by this request for the wrong person is withdrawn while nothing happened on it (MOD-312).
    let reopen = false;
    if (lead.dossierId) {
      const d = await tx.dossier.findUniqueOrThrow({ where: { id: lead.dossierId }, select: { id: true, originLeadId: true, stage: true } });
      const otherLeads = await tx.lead.count({ where: { dossierId: d.id, id: { not: lead.id } } });
      if (d.originLeadId === lead.id && otherLeads === 0 && (d.stage === 'INTEREST' || d.stage === 'QUALIFICATION')) {
        await tx.dossier.update({ where: { id: d.id }, data: { deletedAt: now, updatedAt: now } });
      }
      reopen = true;
    }
    await tx.lead.update({ where: { id: lead.id }, data: { clientId: target.client.id, dossierId: null, updatedAt: now } });
    if (reopen) {
      const stageSlaDays = {
        INTEREST: await this.settings.get('sla.stage.INTEREST'),
        QUALIFICATION: await this.settings.get('sla.stage.QUALIFICATION'),
        MATCHING: await this.settings.get('sla.stage.MATCHING'),
        DOCUMENTS: await this.settings.get('sla.stage.DOCUMENTS'),
        BANK_REVIEW: await this.settings.get('sla.stage.BANK_REVIEW'),
        APPROVED: await this.settings.get('sla.stage.APPROVED'),
        ACQUISITION: await this.settings.get('sla.stage.ACQUISITION'),
      };
      await openOrJoinDossier(tx, this.outbox, {
        lead: { id: lead.id, reference: lead.reference, kind: lead.kind },
        client: target.client,
        object: NO_OBJECT,
        financingPreference: null,
        now,
        cal,
        stageSlaDays,
      });
    }
    const consents = await tx.consent.findMany({ where: { leadId: lead.id, clientId: current.id }, orderBy: { createdAt: 'asc' } });
    const contact = consents.find((c) => c.type === 'CONTACT_REQUEST');
    if (contact) {
      await writeConsents(tx, this.outbox, {
        leadId: lead.id,
        clientId: target.client.id,
        kind: lead.kind,
        contactKey: (fields.consentKey as never) ?? 'lead.contact.v1',
        marketing: consents.some((c) => c.type === 'MARKETING_EMAIL') ? { key: (fields.marketingKey as never) ?? 'lead.marketing.v1' } : null,
        privacyVersion: contact.documentVersion ?? (await privacyPolicyVersion(tx, now)),
        ipHash: lead.ipHash,
        userAgent: lead.userAgent,
        givenAt: contact.givenAt,
        now,
      });
    }
    if (createdByThisLead) {
      // The record of the mistyped address served nothing else: logically deleted (as for a spam, CYC-006).
      await tx.client.update({ where: { id: current.id }, data: { deletedAt: now, updatedAt: now } });
    } else {
      await refreshClientCaches(tx, current.id, now, await this.settings.get('clients.inactiveAfterDays'));
    }
    await refreshClientCaches(tx, target.client.id, now, await this.settings.get('clients.inactiveAfterDays'));
    return target.client.id;
  }
}
