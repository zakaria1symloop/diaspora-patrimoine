// AUT-020 « Résolution des objets », AUT-036 — what a rule sees of an event. The engine starts from the event
// (AUT-011: identifiers, never a copy of the data), READS the objects again and follows their links; an object no link
// reaches for this trigger is not available, and at execution an absent object leaves its fields without value.
//
// Two readings come out of it:
//   · `read(field)` — the fields of the closed list of AUT-020, for the conditions;
//   · `vars()` — the dynamic fields of titles and texts (AUT-036): an explicit selection per object, already formatted
//     (NOT-051). Columns that are not in the selection (hashes, secrets, notes) can never reach a title, whatever a rule
//     saved in the base cites.
import { Injectable } from '@nestjs/common';
import { createTranslator, hasMessage } from '@dp/i18n';
import type { TemplateVars } from '../communication/template-renderer.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import type { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import type { EventEnvelope } from './event-catalogue.js';
import { OBJECTS_BY_AGGREGATE } from './rule-definition.js';
import type { AgentIds } from './staff-directory.js';
import type { TaskLinks } from './tasks.service.js';
import { delayLabel } from './timing.js';
import type { DelayUnit } from './rule-definition.js';

type Db = Tx | PrismaService;
type Row = Record<string, unknown>;
const t = createTranslator('fr');

export type ObjectName =
  | 'lead' | 'client' | 'dossier' | 'candidate' | 'document' | 'submission' | 'reservation' | 'appointment' | 'cafe' | 'registration'
  | 'feedback' | 'conversation' | 'property' | 'program' | 'lot' | 'promoter' | 'bank' | 'product' | 'partnerDocument' | 'partner' | 'user';

/** Prisma model → name of the object in a rule (AUT-020, first line of the resolution table). */
const OBJECT_OF_MODEL: Readonly<Record<string, ObjectName>> = {
  Lead: 'lead', Client: 'client', Dossier: 'dossier', DossierCandidate: 'candidate', DossierDocument: 'document', BankSubmission: 'submission',
  Reservation: 'reservation', Appointment: 'appointment', EventRegistration: 'registration', Event: 'cafe', Feedback: 'feedback', Property: 'property',
  User: 'user', Promoter: 'promoter', Bank: 'bank', BankProduct: 'product', PartnerDocument: 'partnerDocument', Program: 'program', Lot: 'lot',
  Conversation: 'conversation',
};

const DELEGATE: Readonly<Record<ObjectName | 'message' | 'communication', string>> = {
  lead: 'lead', client: 'client', dossier: 'dossier', candidate: 'dossierCandidate', document: 'dossierDocument', submission: 'bankSubmission',
  reservation: 'reservation', appointment: 'appointment', cafe: 'event', registration: 'eventRegistration', feedback: 'feedback',
  conversation: 'conversation', property: 'property', program: 'program', lot: 'lot', promoter: 'promoter', bank: 'bank', product: 'bankProduct',
  partnerDocument: 'partnerDocument', partner: 'promoter', user: 'user', message: 'message', communication: 'communication',
};

/** AUT-036 — columns of each object a title or a text may cite (plus `id`, and the computed labels below). */
const VAR_COLUMNS: Readonly<Partial<Record<ObjectName, readonly string[]>>> = {
  lead: ['reference', 'kind', 'status', 'source'],
  client: ['firstName', 'lastName', 'phone', 'countryOfResidence'],
  dossier: ['reference', 'stage', 'status'],
  candidate: ['status'],
  document: ['label', 'status'],
  submission: ['reference', 'status'],
  reservation: ['status'],
  appointment: ['type', 'status'],
  cafe: ['title', 'reference', 'locationLabel', 'cityName', 'capacity', 'seatsTaken', 'attendedSeats'],
  registration: ['firstName', 'seats', 'status'],
  property: ['title', 'reference'],
  program: ['name'],
  lot: ['reference'],
  promoter: ['legalName', 'brandName'],
  bank: ['name'],
  product: ['name'],
  partnerDocument: ['label'],
  user: ['firstName'],
};

const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const fullName = (r: Row | undefined) => (r ? [r.firstName, r.lastName].filter((v) => typeof v === 'string' && v).join(' ') : '');

export class RuleContext {
  constructor(
    readonly event: EventEnvelope,
    readonly objects: Readonly<Partial<Record<ObjectName, Row>>>,
    /** Fields that are not a column: counted or derived at reading time. */
    readonly derived: ReadonlyMap<string, unknown>,
    readonly timeZone: string,
  ) {}

  /** AUT-020 — value of a condition field (`lead.status`, `client.hasAccount`, `event.data.days`). */
  read = (field: string): unknown => {
    if (this.derived.has(field)) return this.derived.get(field);
    const [object, ...rest] = field.split('.');
    if (object === 'event') return rest[0] === 'data' && rest[1] ? this.event.data[rest[1]] : undefined;
    return this.objects[object as ObjectName]?.[rest[0] ?? ''];
  };

  id(object: ObjectName): string | null {
    const v = this.objects[object]?.id;
    return typeof v === 'string' ? v : null;
  }

  /** AUT-020 « Personnes visées ». */
  agentIds(): AgentIds {
    const of = (o: ObjectName, key: string) => (isId(this.objects[o]?.[key]) ? (this.objects[o]![key] as string) : null);
    return {
      DOSSIER_AGENT: of('dossier', 'assignedAgentId'),
      LEAD_AGENT: of('lead', 'assignedAgentId'),
      CLIENT_AGENT: of('client', 'assignedAgentId'),
      APPOINTMENT_AGENT: of('appointment', 'staffUserId'),
      EVENT_HOST: of('cafe', 'hostUserId'),
    };
  }

  /** AUT-032 — a task is attached to the objects of the event. */
  taskLinks(): TaskLinks {
    return {
      dossierId: this.id('dossier'),
      clientId: this.id('client'),
      leadId: this.id('lead'),
      submissionId: this.id('submission'),
      eventId: this.id('cafe'),
      propertyId: this.id('property'),
      promoterId: this.id('promoter'),
      bankId: this.id('bank'),
      bankProductId: this.id('product'),
      appointmentId: this.id('appointment'),
      reservationId: this.id('reservation'),
      feedbackId: this.id('feedback'),
    };
  }

  /** The object of the event, as a rule names it — and what the link of an alert opens (AUT-033). */
  subject(): { object: ObjectName | null; entityType: string; entityId: string } {
    const object = OBJECT_OF_MODEL[this.event.aggregate.type] ?? null;
    return { object, entityType: this.event.aggregate.type, entityId: this.event.aggregate.id };
  }
}

@Injectable()
export class RuleContextLoader {
  constructor(private readonly calendar: BusinessCalendarService) {}

  /**
   * Reads the objects of an event. `fields`: the condition fields the caller is about to evaluate — the ones that need
   * a count are read here, so that the evaluation itself stays pure.
   */
  async load(db: Db, event: EventEnvelope, fields: readonly string[] = []): Promise<RuleContext> {
    const delegates = db as unknown as Record<string, { findUnique(args: { where: { id: string } }): Promise<Row | null> }>;
    const find = async (name: keyof typeof DELEGATE, id: unknown): Promise<Row | undefined> => (isId(id) ? ((await delegates[DELEGATE[name]]!.findUnique({ where: { id } })) ?? undefined) : undefined);
    const available = new Set(OBJECTS_BY_AGGREGATE[event.aggregate.type] ?? []);
    const o: Partial<Record<ObjectName, Row>> = {};
    const data = event.data;
    const own = OBJECT_OF_MODEL[event.aggregate.type];
    if (own) o[own] = await find(own, event.aggregate.id);

    // Objects that are not the aggregate but named by the event.
    let communication: Row | undefined;
    if (event.aggregate.type === 'Communication') communication = await find('communication', event.aggregate.id);
    if (event.aggregate.type === 'Message') {
      const message = await find('message', event.aggregate.id);
      o.conversation = await find('conversation', message?.conversationId ?? data.conversationId);
    }
    if (!o.conversation && available.has('conversation')) o.conversation = await find('conversation', data.conversationId);
    if (!o.lead && available.has('lead')) o.lead = await find('lead', data.leadId ?? communication?.leadId);
    if (!o.document && available.has('document')) o.document = await find('document', data.documentId);
    if (!o.appointment && available.has('appointment')) o.appointment = await find('appointment', data.upcomingAppointmentId);
    if (!o.cafe && available.has('cafe')) o.cafe = await find('cafe', o.registration?.eventId);

    // `dossier`: the dossier of the event; for `lead.created` with PENDING_DECISION, the ongoing one.
    if (!o.dossier && available.has('dossier')) {
      const dossierId =
        event.dossierId ?? o.candidate?.dossierId ?? o.document?.dossierId ?? o.submission?.dossierId ?? o.reservation?.dossierId ?? o.appointment?.dossierId ??
        o.lead?.dossierId ?? o.feedback?.dossierId ?? o.conversation?.dossierId ?? communication?.dossierId ?? data.ongoingDossierId;
      o.dossier = await find('dossier', dossierId);
    }
    if (!o.client && available.has('client')) {
      const clientId =
        event.clientId ?? o.lead?.clientId ?? o.dossier?.clientId ?? o.registration?.clientId ?? o.appointment?.clientId ?? o.feedback?.clientId ??
        o.conversation?.clientId ?? communication?.clientId;
      o.client = await find('client', clientId);
    }
    if (!o.lot && available.has('lot')) o.lot = await find('lot', o.reservation?.lotId ?? o.dossier?.lotId);
    if (!o.property && available.has('property')) {
      o.property = await find('property', o.lead?.propertyId ?? o.candidate?.propertyId ?? o.appointment?.propertyId ?? o.feedback?.propertyId ?? o.lot?.propertyId ?? o.dossier?.propertyId);
    }
    if (!o.program && available.has('program')) o.program = await find('program', o.property?.programId ?? o.lead?.programId);
    if (!o.promoter && available.has('promoter')) {
      const viaDocument = o.partnerDocument?.ownerType === 'PROMOTER' ? o.partnerDocument.ownerId : undefined;
      o.promoter = await find('promoter', o.property?.promoterId ?? o.program?.promoterId ?? viaDocument);
    }
    if (!o.bank && available.has('bank')) {
      const viaDocument = o.partnerDocument?.ownerType === 'BANK' ? o.partnerDocument.ownerId : undefined;
      o.bank = await find('bank', o.submission?.bankId ?? data.bankId ?? o.product?.bankId ?? viaDocument);
    }
    if (available.has('partner')) o.partner = o.promoter ?? o.bank;
    if (!o.user && available.has('user')) o.user = await find('user', o.client?.userId);
    for (const key of Object.keys(o) as ObjectName[]) if (!o[key]) delete o[key];

    const derived = new Map<string, unknown>();
    if (o.client) {
      const status = o.user?.status;
      derived.set('client.hasAccount', Boolean(o.client.userId) && status !== 'DELETED');
      derived.set('client.accountStatus', status === 'INVITED' || status === 'ACTIVE' || status === 'SUSPENDED' ? status : 'NONE');
      derived.set('client.hasEmail', typeof o.client.email === 'string' && o.client.email !== '');
    }
    if (o.appointment) derived.set('appointment.clientNotified', o.appointment.clientNotifiedAt != null);
    if (o.cafe) {
      const capacity = Number(o.cafe.capacity);
      derived.set('cafe.fillPct', capacity > 0 ? Math.round((Number(o.cafe.seatsTaken) / capacity) * 100) : 0);
    }
    const wants = (field: string) => fields.includes(field);
    if (o.dossier) {
      const dossierId = o.dossier.id as string;
      if (wants('dossier.candidateCount')) derived.set('dossier.candidateCount', await db.dossierCandidate.count({ where: { dossierId } }));
      if (wants('dossier.unopenedProposalCount')) derived.set('dossier.unopenedProposalCount', await db.dossierCandidate.count({ where: { dossierId, status: 'PROPOSED', sentAt: { not: null } } }));
      if (wants('dossier.pendingProposalCount')) derived.set('dossier.pendingProposalCount', await db.dossierCandidate.count({ where: { dossierId, status: { in: ['PROPOSED', 'VIEWED'] }, sentAt: { not: null } } }));
      if (wants('dossier.sharingConsentGranted')) {
        const last = await db.consent.findFirst({ where: { clientId: o.dossier.clientId as string, type: 'DATA_SHARING_PARTNERS' }, orderBy: { givenAt: 'desc' }, select: { granted: true } });
        derived.set('dossier.sharingConsentGranted', Boolean(last?.granted));
      }
    }
    if (o.conversation && wants('conversation.awaitingStaffReply')) {
      // The last message written BY A PERSON comes from the client (SYSTEM messages do not count).
      const last = await db.message.findFirst({ where: { conversationId: o.conversation.id as string, deletedAt: null, senderType: { not: 'SYSTEM' } }, orderBy: { createdAt: 'desc' }, select: { senderType: true } });
      derived.set('conversation.awaitingStaffReply', last?.senderType === 'CLIENT');
    }
    if (o.submission && wants('submission.downloadCount')) {
      const sum = await db.secureShare.aggregate({ where: { package: { submissionId: o.submission.id as string } }, _sum: { downloadCount: true } });
      derived.set('submission.downloadCount', sum._sum.downloadCount ?? 0);
    }
    const cal = await this.calendar.load(db);
    return new RuleContext(event, o, derived, cal.timeZone);
  }

  /** AUT-036 — the dynamic fields of the titles and texts of the actions, already formatted (NOT-051). */
  vars(ctx: RuleContext, rule: { name: string; delayValue: number; delayUnit: DelayUnit }): TemplateVars {
    const date = (d: Date, timeZone = ctx.timeZone) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone }).format(d);
    const hour = (d: Date, timeZone = ctx.timeZone) => new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', timeZone }).format(d).replace(/(\d{1,2}):(\d{2})/, '$1 h $2');
    const scalar = (v: unknown): unknown => (v instanceof Date ? date(v) : typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : v == null ? null : String(v));
    const vars: Record<string, Record<string, unknown>> = {};
    for (const [name, row] of Object.entries(ctx.objects) as [ObjectName, Row][]) {
      const out: Record<string, unknown> = { id: row.id };
      for (const column of VAR_COLUMNS[name] ?? []) out[column] = scalar(row[column]);
      vars[name] = out;
    }
    const { lead, client, dossier, cafe, promoter, bank, appointment } = ctx.objects;
    if (lead) {
      vars.lead!.kindLabel = hasMessage(`ui.enum.LeadKind.${String(lead.kind)}`) ? t(`ui.enum.LeadKind.${String(lead.kind)}` as never) : lead.kind;
    }
    // {client} — the person of the record; for a request without record yet, the name typed on the request.
    const person = fullName(client) || fullName(lead) || fullName(ctx.objects.registration);
    vars.client = { ...(vars.client ?? {}), fullName: person || (typeof lead?.email === 'string' ? lead.email : '') || (typeof lead?.reference === 'string' ? lead.reference : '') };
    if (dossier) vars.dossier!.stageLabel = hasMessage(`ui.enum.DossierStage.${String(dossier.stage)}`) ? t(`ui.enum.DossierStage.${String(dossier.stage)}` as never) : dossier.stage;
    if (cafe) {
      const tz = typeof cafe.timezone === 'string' ? cafe.timezone : ctx.timeZone;
      if (cafe.startsAt instanceof Date) {
        vars.cafe!.dateLabel = date(cafe.startsAt, tz);
        vars.cafe!.timeLabel = hour(cafe.startsAt, tz);
      }
    }
    if (appointment?.startsAt instanceof Date) {
      vars.appointment!.dateLabel = date(appointment.startsAt);
      vars.appointment!.timeLabel = hour(appointment.startsAt);
    }
    if (promoter) vars.promoter!.name = promoter.brandName ?? promoter.legalName;
    if (ctx.objects.partner) vars.partner = { id: ctx.objects.partner.id, name: promoter ? (promoter.brandName ?? promoter.legalName) : bank?.name };
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ctx.event.data)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') data[k] = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? date(new Date(v)) : v;
    }
    return { ...vars, event: { id: ctx.event.eventId, data }, rule: { name: rule.name, delayLabel: delayLabel(rule.delayValue, rule.delayUnit) } };
  }
}
