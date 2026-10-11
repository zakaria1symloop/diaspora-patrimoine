// CYC-001 steps 1, 3 and 4 — the writes a request makes besides itself, inside the creation transaction (FIA-001):
// client record found or created (MOD-300), consents (DEM-020), dossier opened or joined (CYC-002), score (CAL-070),
// status (CYC-060). Used by the creation (DEM-002) and by the address correction of a projection (DEM-013).
import { LeadConsentWording, type LeadConsentKey } from '@dp/contracts';
import { prequalificationScore, stageDueAt, type BusinessCalendar, type DossierStage } from '@dp/domain';
import { nextReference } from '../platform/business-calendar.js';
import { newId } from '../platform/ids.js';
import type { OutboxWriter } from '../platform/outbox.js';
import type { Tx } from '../platform/tx.js';
import { clientStatus, completeClient, type ClientFacts, type ClientState } from './client-record.js';
import type { ResolvedObject } from './lead-objects.js';
import { writeLeadLine } from '../client-space/timeline.js';

/** CYC-002 — kinds that open or join a dossier. CONTACT_MESSAGE and PARTNER_REQUEST do not. */
export const OPENS_DOSSIER = new Set(['PROPERTY_INTEREST', 'PROJECTION_REQUEST', 'CALLBACK_REQUEST', 'GUIDED_SEARCH', 'SIMULATION_FOLLOWUP']);
const EARLY_STAGES = ['INTEREST', 'QUALIFICATION', 'MATCHING'];

/** The client record of an address: its e-mail, or an address absorbed by a merge (`alternateEmails`, CRM-080). */
export async function findClientByEmail(tx: Tx, email: string) {
  return tx.client.findFirst({
    where: { deletedAt: null, OR: [{ email }, { alternateEmails: { has: email } }] },
    orderBy: { createdAt: 'asc' },
  });
}

export type ClientRow = NonNullable<Awaited<ReturnType<typeof findClientByEmail>>>;

export interface ClientWriteInput {
  email: string;
  facts: ClientFacts;
  locale: 'fr' | 'ar' | 'en';
  utm: Record<string, unknown> | null;
  /** TRV-043 — the domain has no MX: « e-mail douteux ». */
  emailDoubtful: boolean;
  leadReference: string;
  now: Date;
  /** Origin of a created record (`Client.source`); default `WEB_FORM` — the Café passes `CAFE` (CAF-021). */
  source?: 'WEB_FORM' | 'CAFE';
  /** Audit reason when « Ne pas contacter » is lifted; default `lead:{leadReference}`. */
  auditReason?: string;
}

/**
 * CYC-001 step 1 — found by its e-mail (MOD-300: only empty fields completed) or created. CYC-009: a person who sends
 * a request herself lifts « Ne pas contacter », and an archived record is unarchived (CYC-061); a restricted record
 * stays restricted (an administrator decides).
 */
export async function upsertClientForLead(
  tx: Tx,
  outbox: OutboxWriter,
  input: ClientWriteInput,
): Promise<{ client: ClientRow; created: boolean; changedFields: string[] }> {
  const { now } = input;
  const source = input.source ?? 'WEB_FORM';
  const existing = await findClientByEmail(tx, input.email);
  if (!existing) {
    const id = newId();
    const initial = completeClient(null, input.facts);
    const client = await tx.client.create({
      data: {
        id,
        email: input.email,
        emailDoubtful: input.emailDoubtful,
        preferredLanguage: input.locale,
        source,
        utm: (input.utm ?? undefined) as never,
        status: 'PROSPECT',
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
        ...(initial as object),
      },
    });
    await outbox.add(tx, { type: 'client.created', aggregateType: 'Client', aggregateId: id, payload: { source } }, now);
    return { client, created: true, changedFields: [] };
  }

  const patch: Record<string, unknown> = completeClient(existing as unknown as ClientState, input.facts);
  const changedFields = Object.keys(patch);
  if (input.emailDoubtful && !existing.emailDoubtful) patch.emailDoubtful = true;
  if (existing.doNotContact) {
    // CYC-009 — the opposition is lifted by this request; the audit log keeps it (no personal value, SEC-081).
    Object.assign(patch, { doNotContact: false, doNotContactReason: null, doNotContactAt: null });
    await tx.auditLog.create({
      data: {
        id: newId(),
        actorType: 'ANONYMOUS',
        action: 'client.do_not_contact_lifted',
        entityType: 'Client',
        entityId: existing.id,
        clientId: existing.id,
        reason: input.auditReason ?? `lead:${input.leadReference}`,
        createdAt: now,
      },
    });
  }
  if (existing.archivedAt) Object.assign(patch, { archivedAt: null, archivedReason: null }); // CYC-061
  const client = await tx.client.update({
    where: { id: existing.id },
    data: { ...patch, lastActivityAt: now, version: { increment: 1 }, updatedAt: now },
  });
  if (changedFields.length) {
    await outbox.add(tx, { type: 'client.updated', aggregateType: 'Client', aggregateId: client.id, payload: { changedFields } }, now);
  }
  if (existing.archivedAt) await outbox.add(tx, { type: 'client.unarchived', aggregateType: 'Client', aggregateId: client.id, payload: {} }, now);
  return { client, created: false, changedFields };
}

export interface ConsentInput {
  leadId: string | null;
  /** CAF-021 — consents of a Café registration. */
  registrationId?: string | null;
  /** `Consent.source`; default `lead:{kind}` (CAF-021: `cafe:registration`). */
  source?: string;
  clientId: string | null;
  kind: string;
  contactKey: LeadConsentKey;
  marketing: { key: LeadConsentKey } | null;
  privacyVersion: string | null;
  ipHash: string | null;
  userAgent: string | null;
  givenAt: Date;
  now: Date;
}

/** DEM-020, MOD-106 — CONTACT_REQUEST with the exact sentence and the privacy policy version; MARKETING_EMAIL when checked. */
export async function writeConsents(tx: Tx, outbox: OutboxWriter, c: ConsentInput): Promise<void> {
  const base = {
    granted: true,
    leadId: c.leadId,
    registrationId: c.registrationId ?? null,
    clientId: c.clientId,
    source: c.source ?? `lead:${c.kind}`,
    givenAt: c.givenAt,
    ipHash: c.ipHash,
    userAgent: c.userAgent,
    createdAt: c.now,
  };
  await tx.consent.create({
    data: { id: newId(), type: 'CONTACT_REQUEST', documentVersion: c.privacyVersion, wording: LeadConsentWording[c.contactKey].text, ...base },
  });
  if (c.marketing) {
    await tx.consent.create({ data: { id: newId(), type: 'MARKETING_EMAIL', wording: LeadConsentWording[c.marketing.key].text, ...base } });
    if (c.clientId) {
      await tx.client.update({ where: { id: c.clientId }, data: { marketingOptIn: true, updatedAt: c.now } });
      await outbox.add(
        tx,
        { type: 'consent.changed', aggregateType: 'Client', aggregateId: c.clientId, payload: { type: 'MARKETING_EMAIL', granted: true, by: 'CLIENT', dossierId: null } },
        c.now,
      );
    }
  }
}

/** DEM-020 — version of the privacy policy in force (latest published, effective). */
export async function privacyPolicyVersion(tx: Tx, now: Date): Promise<string | null> {
  const doc = await tx.legalDocument.findFirst({
    where: { type: 'PRIVACY_POLICY', locale: 'fr', publishedAt: { not: null }, effectiveAt: { lte: now } },
    orderBy: { effectiveAt: 'desc' },
    select: { version: true },
  });
  return doc?.version ?? null;
}

export type Attachment = 'OPENED_DOSSIER' | 'JOINED_DOSSIER' | 'PENDING_DECISION' | 'NONE';

export interface DossierOutcome {
  attachment: Attachment;
  dossier: { id: string; stage: string; status: string; assignedAgentId: string | null; stageEnteredAt: Date; version: number } | null;
  ongoingDossierId: string | null;
}

/**
 * CYC-002 — no OPEN/ON_HOLD dossier: one is created at INTEREST · an OPEN one at INTEREST, QUALIFICATION or MATCHING
 * (the most recently active): joined · else an ON_HOLD one at those stages: joined · only dossiers at DOCUMENTS or
 * beyond: not attached (« Nouvelle demande pendant un dossier en cours »). For PROPERTY_INTEREST the property becomes a
 * candidate of the dossier (CYC-070 for an existing candidate).
 */
export async function openOrJoinDossier(
  tx: Tx,
  outbox: OutboxWriter,
  a: {
    lead: { id: string; reference: string; kind: string };
    client: ClientRow;
    object: ResolvedObject;
    financingPreference: string | null;
    now: Date;
    cal: BusinessCalendar;
    stageSlaDays: Readonly<Record<DossierStage, number>>;
  },
): Promise<DossierOutcome> {
  const { now } = a;
  const live = await tx.dossier.findMany({
    where: { clientId: a.client.id, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] } },
    orderBy: { lastActivityAt: 'desc' },
    select: { id: true, stage: true, status: true, assignedAgentId: true, stageEnteredAt: true, version: true },
  });
  const target =
    live.find((d) => d.status === 'OPEN' && EARLY_STAGES.includes(d.stage)) ?? live.find((d) => d.status === 'ON_HOLD' && EARLY_STAGES.includes(d.stage));

  let outcome: DossierOutcome;
  if (target) {
    await tx.lead.update({ where: { id: a.lead.id }, data: { dossierId: target.id } });
    await outbox.add(tx, { type: 'lead.attached', aggregateType: 'Lead', aggregateId: a.lead.id, payload: { dossierId: target.id } }, now);
    // ECL-031 « Seconde demande » — written when it joins.
    await writeLeadLine(tx, { dossierId: target.id, again: true, kind: a.lead.kind, propertyTitle: a.object.property?.title ?? null, leadReference: a.lead.reference, at: now });
    // ON_HOLD: the task « Le client s'est manifesté » belongs to the rule R_CLIENT_RESURFACED (automation module).
    outcome = { attachment: 'JOINED_DOSSIER', dossier: target, ongoingDossierId: null };
  } else if (live.length > 0) {
    outcome = { attachment: 'PENDING_DECISION', dossier: null, ongoingDossierId: live[0]!.id };
  } else {
    const id = newId();
    const reference = await nextReference(tx, 'DOSSIER', now, a.cal.timeZone);
    const financing = a.financingPreference ?? a.client.financingPreference ?? null;
    const c = a.client;
    await tx.dossier.create({
      data: {
        id,
        reference,
        clientId: c.id,
        originLeadId: a.lead.id,
        stage: 'INTEREST',
        status: 'OPEN',
        propertyCountryCode: a.object.property?.countryCode ?? a.object.program?.countryCode ?? c.preferredCountries[0] ?? null,
        financingRequested: financing !== 'CASH', // CYC-041
        financingType: (financing as never) ?? null,
        downPayment: c.downPayment ?? null,
        downPaymentCurrency: c.downPayment !== null ? c.downPaymentCurrency : null,
        stageEnteredAt: now,
        slaDueAt: stageDueAt(now, 'INTEREST', a.cal, a.stageSlaDays),
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    // MOD-320 — exactly one PRIMARY party, created with the dossier; it reads everything from the client (MOD-322).
    await tx.dossierParty.create({ data: { id: newId(), dossierId: id, role: 'PRIMARY', clientId: c.id, sortOrder: 0, createdAt: now, updatedAt: now } });
    await tx.dossierStageHistory.create({
      data: { id: newId(), dossierId: id, fromStage: null, toStage: 'INTEREST', fromStatus: null, toStatus: 'OPEN', isBackward: false, actorType: 'SYSTEM', changedAt: now, createdAt: now },
    });
    await tx.lead.update({ where: { id: a.lead.id }, data: { dossierId: id } });
    await outbox.add(tx, { type: 'dossier.opened', aggregateType: 'Dossier', aggregateId: id, payload: { originLeadId: a.lead.id } }, now);
    // ECL-031 « Demande envoyée » — the origin request, written at the opening.
    await writeLeadLine(tx, { dossierId: id, again: false, kind: a.lead.kind, propertyTitle: a.object.property?.title ?? null, leadReference: a.lead.reference, at: now });
    outcome = { attachment: 'OPENED_DOSSIER', dossier: { id, stage: 'INTEREST', status: 'OPEN', assignedAgentId: null, stageEnteredAt: now, version: 1 }, ongoingDossierId: null };
  }

  const property = a.object.property;
  if (outcome.dossier && a.lead.kind === 'PROPERTY_INTEREST' && property) {
    const existing = await tx.dossierCandidate.findUnique({ where: { dossierId_propertyId: { dossierId: outcome.dossier.id, propertyId: property.id } } });
    if (!existing) {
      await tx.dossierCandidate.create({
        data: {
          id: newId(),
          dossierId: outcome.dossier.id,
          propertyId: property.id,
          lotId: a.object.lotId,
          origin: 'CLIENT_INTEREST',
          leadId: a.lead.id,
          status: a.object.candidateStatus,
          statusChangedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    } else if (['PROPOSED', 'VIEWED', 'DECLINED'].includes(existing.status) && a.object.candidateStatus === 'INTERESTED') {
      // CYC-070 — an interest sent from the property page is the client's « Ce bien m'intéresse ». Other statuses are kept.
      await tx.dossierCandidate.update({
        where: { id: existing.id },
        data: { status: 'INTERESTED', statusChangedAt: now, lotId: existing.lotId ?? a.object.lotId, version: { increment: 1 }, updatedAt: now },
      });
      await outbox.add(
        tx,
        { type: 'candidate.interested', aggregateType: 'Dossier', aggregateId: outcome.dossier.id, payload: { candidateId: existing.id, by: 'CLIENT' } },
        now,
      );
    }
  }
  return outcome;
}

/** CAL-070 — the score of a record and its four blocks (CRM-047), computed from what the record says today. */
export async function clientScoreDetail(tx: Tx, clientId: string) {
  const c = await tx.client.findUniqueOrThrow({ where: { id: clientId }, include: { user: { select: { emailVerifiedAt: true } } } });
  const [simulation, interest, registrations, dossiers] = await Promise.all([
    tx.simulation.findFirst({ where: { clientId, type: 'ELIGIBILITY' }, orderBy: { createdAt: 'desc' }, select: { outputs: true } }),
    tx.lead.count({ where: { clientId, kind: 'PROPERTY_INTEREST' } }),
    tx.eventRegistration.findMany({ where: { clientId, status: { in: ['REGISTERED', 'ATTENDED'] } }, select: { status: true } }),
    tx.dossier.findMany({ where: { clientId, deletedAt: null }, select: { status: true, stage: true } }),
  ]);
  const simStatus = (simulation?.outputs as { status?: string } | null)?.status;
  const result = prequalificationScore({
    phoneValid: Boolean(c.phone) && !c.phoneCheckNeeded,
    emailVerified: Boolean(c.user?.emailVerifiedAt),
    reachableOnWhatsapp: c.whatsappOptIn && Boolean(c.phone),
    timeframe: (c.purchaseTimeframe as 'LT_6M' | 'M6_12' | 'GT_12M' | 'UNDEFINED' | null) ?? null,
    latestEligibilityStatus: simStatus === 'ELIGIBLE' || simStatus === 'CONDITIONAL' || simStatus === 'NOT_ELIGIBLE' ? simStatus : null,
    cashPurchase: c.financingPreference === 'CASH',
    budgetMax: c.budgetMax?.toString() ?? null,
    downPaymentInBudgetCurrency: c.downPayment !== null && c.downPaymentCurrency === c.budgetCurrency ? c.downPayment.toString() : null,
    incomeKnown: c.monthlyIncome !== null,
    accountCreated: c.userId !== null,
    hasPropertyInterest: interest > 0,
    cafe: registrations.some((r) => r.status === 'ATTENDED') ? 'ATTENDED' : registrations.length ? 'REGISTERED' : 'NONE',
  });
  return { client: c, dossiers, ...result };
}

/** CAL-070 and CYC-060 — score and status of the client, recomputed after the request. */
export async function refreshClientCaches(tx: Tx, clientId: string, now: Date, inactiveAfterDays: number): Promise<void> {
  const { client: c, dossiers, score } = await clientScoreDetail(tx, clientId);
  const status = clientStatus({ archivedAt: c.archivedAt, qualifiedAt: c.qualifiedAt, lastActivityAt: c.lastActivityAt, dossiers, inactiveAfterDays, now });
  if (score !== c.score || status !== c.status) {
    await tx.client.update({ where: { id: clientId }, data: { score, status, updatedAt: now } });
  }
}
