// AUT-010, AUT-011, AUT-013 — the catalogue of the events of the outbox: the domain events a rule may take as trigger
// (with the Prisma model of their object and the names of their data), and the technical events no rule subscribes to.
// Append-only: a module that emits a new event type adds its line here (see README.md, « Déclarer un événement »).
//
// AUT-011 gives the common form of `OutboxEvent.payload`; the writers delivered before the engine put the data of the
// event directly in the payload. `toEnvelope` reads both, so that no emitter had to change.
import type { OutboxRecord } from '../platform/outbox.js';

export interface EventDeclaration {
  /** Prisma model of the object of the event (`aggregate.type`). Several when the event exists for several objects. */
  aggregates: readonly string[];
  /** AUT-010 column « Données » — the only `event.data.*` fields a condition may read (AUT-021). */
  data: readonly string[];
  /** ⏱ — emitted by a scheduled task (AUT-012), with a key that names the fact. */
  scheduled: boolean;
}

const e = (aggregates: string, data = '', scheduled = false): EventDeclaration => ({
  aggregates: aggregates.split('|'),
  data: data ? data.split(' ') : [],
  scheduled,
});
const s = (aggregates: string, data = ''): EventDeclaration => e(aggregates, data, true);

/** AUT-010 — domain events (values of `OutboxEvent.type` and `WorkflowRule.trigger`). */
export const DOMAIN_EVENTS: Readonly<Record<string, EventDeclaration>> = {
  // § 2.1 Demandes et clients
  'lead.created': e('Lead', 'kind source propertyId attachment ongoingDossierId'),
  'lead.attached': e('Lead', 'dossierId'),
  'lead.taken': e('Lead', 'agentId previousAgentId'),
  'lead.released': e('Lead', 'previousAgentId'),
  'lead.reopened': e('Lead', 'previousAgentId'),
  'lead.supplemented': e('Lead', 'changedFields'),
  'lead.first_contact': e('Lead', 'channel'),
  'lead.closed': e('Lead', 'outcome'),
  'lead.marked_spam': e('Lead'),
  'lead.restored': e('Lead'),
  'lead.application_submitted': e('Lead', 'partnerKind companyName'),
  'lead.application_info_requested': e('Lead', 'partnerKind companyName note'),
  'lead.application_approved': e('Lead', 'partnerKind companyName promoterId bankId'),
  'lead.application_declined': e('Lead', 'partnerKind companyName note'),
  'lead.sla_warning': s('Lead', 'slaDueAt'),
  'lead.sla_breached': s('Lead', 'slaDueAt'),
  'client.created': e('Client', 'source'),
  'client.updated': e('Client', 'changedFields'),
  'client.qualified': e('Client'),
  'client.merged': e('Client', 'mergedClientId'),
  'client.archived': e('Client'),
  'client.unarchived': e('Client'),
  'client.account_created': e('Client'),
  'client.account_invited': e('Client', 'reason'),
  'client.account_activated': e('Client'),
  'client.email_bounced': e('Client', 'address'),
  'consent.changed': e('Client', 'type granted by dossierId'),
  'communication.call_logged': e('Communication', 'direction callOutcome leadId dossierId'),
  'communication.email_sent': e('Communication', 'templateCode'),
  // § 2.2 Dossier, rapprochement, réservation
  'dossier.opened': e('Dossier', 'originLeadId'),
  'dossier.assigned': e('Dossier', 'agentId previousAgentId notifyClient'),
  'dossier.stage_changed': e('Dossier', 'fromStage toStage isBackward'),
  'dossier.put_on_hold': e('Dossier', 'holdReason holdUntil'),
  'dossier.resumed': e('Dossier', 'holdReason holdUntil'),
  'dossier.hold_ended': s('Dossier'),
  'dossier.activity_on_hold': e('Dossier', 'what'),
  'dossier.financing_mode_changed': e('Dossier', 'financingRequested'),
  'dossier.completed': e('Dossier'),
  'dossier.all_banks_declined': e('Dossier'),
  'dossier.won': e('Dossier', 'saleAmount saleCurrency'),
  'dossier.lost': e('Dossier', 'lostReason notifyClient'),
  'dossier.reopened': e('Dossier'),
  'dossier.inactive': s('Dossier', 'days'),
  'dossier.sla_breached': s('Dossier', 'stage'),
  'dossier.checklist_reevaluated': e('Dossier', 'added removed by applied'),
  'candidate.proposed': e('DossierCandidate|Dossier', 'candidateIds isFirstOfDossier'),
  'candidate.viewed': e('DossierCandidate', 'by declineReason'),
  'candidate.interested': e('DossierCandidate', 'by declineReason'),
  'candidate.declined': e('DossierCandidate', 'by declineReason'),
  'candidate.selection_requested': e('DossierCandidate'),
  'candidate.selection_declined': e('DossierCandidate'),
  'candidate.selected': e('DossierCandidate'),
  'candidate.unselected': e('DossierCandidate'),
  'candidate.unavailable': e('DossierCandidate', 'wasSelected hasUpcomingVisit upcomingAppointmentId'),
  'reservation.option_placed': e('Reservation', 'lotId optionExpiresAt acknowledged accessLevel'),
  'reservation.option_extended': e('Reservation', 'lotId optionExpiresAt acknowledged accessLevel'),
  'reservation.option_acknowledged': e('Reservation', 'route refusalReason lotOutcome'),
  'reservation.option_refused': e('Reservation', 'route refusalReason lotOutcome'),
  'reservation.released': e('Reservation', 'lotId accessLevel'),
  'reservation.option_expiring': s('Reservation'),
  'reservation.confirmed': e('Reservation', 'notifyClient cancelReason dossierStage wasOption lotOutcome'),
  'reservation.cancelled': e('Reservation', 'notifyClient cancelReason dossierStage wasOption lotOutcome'),
  'reservation.expired': e('Reservation', 'notifyClient cancelReason dossierStage wasOption lotOutcome'),
  'reservation.completed': e('Reservation', 'notifyClient cancelReason dossierStage wasOption lotOutcome'),
  'reservation.deposit_refund_due': e('Reservation', 'depositAmount depositCurrency refundStatus'),
  'reservation.deposit_settled': e('Reservation', 'depositAmount depositCurrency refundStatus'),
  'appointment.requested': e('Appointment', 'type cancelledBy hadHost accessLevel'),
  'appointment.confirmed': e('Appointment', 'type cancelledBy hadHost accessLevel'),
  'appointment.rescheduled': e('Appointment', 'type cancelledBy hadHost accessLevel'),
  'appointment.cancelled': e('Appointment', 'type cancelledBy hadHost accessLevel'),
  'appointment.done': e('Appointment', 'type cancelledBy hadHost accessLevel'),
  'appointment.no_show': e('Appointment', 'type cancelledBy hadHost accessLevel'),
  'appointment.upcoming': s('Appointment'),
  'appointment.outcome_missing': s('Appointment'),
  // § 2.3 Pièces et financement — the delivered writers name the dossier as the object and the piece in the data.
  'document.requested': e('Dossier|DossierDocument', 'documentIds source bankId notifyClient'),
  'document.received': e('Dossier|DossierDocument', 'documentId by'),
  'document.validated': e('Dossier|DossierDocument', 'documentId rejectionReason isRenewal'),
  'document.rejected': e('Dossier|DossierDocument', 'documentId rejectionReason isRenewal'),
  'document.waived': e('Dossier|DossierDocument', 'documentId rejectionReason isRenewal'),
  'document.validation_reverted': e('Dossier|DossierDocument', 'documentId'),
  'document.expired': e('Dossier|DossierDocument', 'documentId manual'),
  'document.expiring_soon': s('Dossier|DossierDocument', 'documentId expiresAt'),
  'document.reminder_due': s('Dossier', 'documentIds reminderNumber manual'),
  'document.reminders_exhausted': s('Dossier|DossierDocument', 'documentIds'),
  'document.file_infected': e('Dossier|DossierDocument', 'documentId by versionDiscarded cause'),
  'document.version_deleted': e('Dossier|DossierDocument', 'documentId wasCurrent'),
  'submission.created': e('BankSubmission', 'bankId'),
  'submission.submitted': e('BankSubmission', 'transmissionMode'),
  'submission.send_failed': e('BankSubmission', 'reason documentId'),
  'submission.under_review': e('BankSubmission'),
  'submission.info_requested': e('BankSubmission'),
  'submission.info_provided': e('BankSubmission'),
  'submission.approved': e('BankSubmission', 'isFirstDecisionOfDossier'),
  'submission.rejected': e('BankSubmission', 'isFirstDecisionOfDossier'),
  'submission.withdrawn': e('BankSubmission', 'declinedByClient'),
  'submission.package_downloaded': e('BankSubmission', 'shareId'),
  'submission.decision_overdue': s('BankSubmission', 'expectedDecisionAt followUpNumber daysWaiting'),
  'submission.offer_expiring': s('BankSubmission'),
  'submission.offer_expired': e('BankSubmission'),
  'submission.offer_accept_requested': e('BankSubmission'),
  'submission.offer_accept_withdrawn': e('BankSubmission'),
  'submission.offer_unaccepted': e('BankSubmission'),
  'submission.offer_accepted': e('BankSubmission'),
  'submission.offer_declined': e('BankSubmission'),
  'submission.offer_updated': e('BankSubmission', 'what'),
  'submission.decision_reverted': e('BankSubmission', 'previousStatus clientWasNotified'),
  'simulation.saved': e('Simulation', 'type status'),
  'simulation.projection_sent': e('Simulation'),
  // § 2.4 Messagerie, satisfaction
  'message.sent': e('Message|Conversation', 'senderType conversationId'),
  'survey.invitation_created': e('SurveyInvitation', 'surveyCode scheduledFor'),
  'feedback.received': e('Feedback', 'kind npsScore csatScore surveyTrigger'),
  'feedback.handled': e('Feedback'),
  // § 2.5 Catalogue et partenaires
  'property.published': e('Property', 'isFirstPublication'),
  'property.unpublished': e('Property'),
  'property.archived': e('Property'),
  'property.availability_changed': e('Property', 'from to lotsAvailable'),
  'property.price_changed': e('Property', 'from to currency'),
  'program.published': e('Program'),
  'program.unpublished': e('Program'),
  'program.archived': e('Program'),
  'program.update_published': e('Program', 'stage percent'),
  'program.delivery_overdue': s('Program|Property'),
  'program.sold_out_review': s('Program'),
  'lot.status_changed': e('Lot', 'from to'),
  'lot.import_conflict': e('Lot', 'fileStatus dossierId'),
  'promoter.status_changed': e('Promoter', 'from to'),
  'bank.status_changed': e('Bank', 'from to'),
  'partner.access_level_changed': e('Promoter|Bank', 'ownerType from to'),
  'promoter.stock_check_due': s('Promoter', 'programCount accessLevel'),
  'program.stock_confirmed': e('Program|Property', 'route programId propertyId'),
  'bankproduct.check_due': s('BankProduct', 'ageDays accessLevel'),
  'bankproduct.rates_confirmed': e('BankProduct', 'route'),
  'partner.convention_expiring': s('Promoter|Bank', 'ownerType expiresAt'),
  'partner.document_expiring': s('PartnerDocument', 'ownerType expiresAt'),
  'exchange_rate.created': e('ExchangeRate', 'fromCurrency toCurrency'),
  'exchange_rate.voided': e('ExchangeRate', 'fromCurrency toCurrency'),
  'exchange_rate.stale': s('ExchangeRate', 'fromCurrency toCurrency asOf ageDays'),
  // § 2.6 Le Café
  'event.published': e('Event'),
  'event.closed': e('Event'),
  'event.cancelled': e('Event'),
  'event.done': e('Event'),
  'event.registration_opened': e('Event'),
  'event.updated': e('Event', 'changedFields'),
  'event.upcoming': s('Event', 'days'),
  'event.followup_due': s('Event'),
  'event.checkin_missing': s('Event'),
  'registration.created': e('EventRegistration', 'seats cancelledBy'),
  'registration.waitlisted': e('EventRegistration', 'seats cancelledBy'),
  'registration.promoted': e('EventRegistration', 'seats cancelledBy'),
  'registration.cancelled': e('EventRegistration', 'seats cancelledBy'),
  'registration.attended': e('EventRegistration', 'seats cancelledBy'),
  'registration.no_show': e('EventRegistration', 'seats cancelledBy'),
  // § 2.7 Comptes, données, plateforme
  'user.invited': e('User', 'role previousRole'),
  'user.role_changed': e('User', 'role previousRole'),
  'user.suspended': e('User', 'role previousRole'),
  'user.reactivated': e('User', 'role previousRole'),
  'user.deleted': e('User', 'role previousRole'),
  'user.recovered': e('User', 'role previousRole'),
  'user.password_changed': e('User'),
  'user.two_factor_changed': e('User'),
  'user.email_changed': e('User'),
  'user.new_device_login': e('User', 'deviceLabel'),
  'support.elevation_granted': e('User', 'until reason'),
  'support.elevation_ended': e('User', 'until reason'),
  'data_request.received': e('DataRequest', 'type status'),
  'data_request.completed': e('DataRequest', 'type status'),
  'data_request.rejected': e('DataRequest', 'type status'),
  'data_request.due_soon': s('DataRequest'),
  'task.assigned': e('Task'),
  'task.due': s('Task'),
  'import.finished': e('ImportJob', 'status'),
  'export.ready': e('ExportJob', 'status'),
  'email.bounced': e('Communication', 'communicationId'),
  'email.complained': e('Communication', 'communicationId'),
  'setting.changed': e('Setting', 'key'),
  'system.cache_drift': e('System', 'entity count'),
  'system.job_failed': e('System', 'job'),
};

/** AUT-013 — technical events: they carry a sending or a processing; no rule subscribes to them. */
export const TECHNICAL_EVENTS: ReadonlySet<string> = new Set([
  'auth.email_requested',
  'alert.created',
  'alert.confirmation_requested',
  'alert.confirmed',
  'alert.links_requested',
  'preferences.link_requested',
  'registration.confirmation_requested',
  'document.version_created',
  'document.file_refused',
]);

/** True for a type a rule may take as trigger (COM-062). */
export function isRuleTrigger(type: string): boolean {
  return type in DOMAIN_EVENTS && !TECHNICAL_EVENTS.has(type);
}

/** AUT-011 — the common form of an event, whatever the writer put in the payload. */
export interface EventEnvelope {
  eventId: string;
  type: string;
  occurredAt: Date;
  actor: { type: string; id: string | null } | null;
  aggregate: { type: string; id: string };
  clientId: string | null;
  dossierId: string | null;
  data: Record<string, unknown>;
  /** Set on an event produced by the action of a rule: no rule is triggered by it (AUT-005). */
  causation: { ruleId: string; executionId: string } | null;
  /**
   * NOT-035 — what stands for « the request of origin »: the request id when the writer gave it, the pass of the
   * scheduled task for a ⏱ event, else the event itself.
   */
  originId: string;
}

const MODEL_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  [
    'Lead', 'Client', 'Dossier', 'DossierCandidate', 'DossierDocument', 'BankSubmission', 'Reservation', 'Appointment',
    'Event', 'EventRegistration', 'Feedback', 'Property', 'Program', 'Lot', 'User', 'Promoter', 'Bank', 'BankProduct',
    'PartnerDocument', 'Communication', 'Conversation', 'Message', 'Task', 'DataRequest', 'Simulation', 'ExchangeRate',
    'SurveyInvitation', 'ImportJob', 'ExportJob', 'Setting', 'System',
  ].map((name) => [name.toLowerCase(), name]),
);

/** `event`, `event_registration`, `dossierDocument` → the Prisma model name. */
export function modelName(aggregateType: string): string {
  return MODEL_NAMES[aggregateType.replace(/_/g, '').toLowerCase()] ?? aggregateType;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const obj = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export function toEnvelope(record: Pick<OutboxRecord, 'id' | 'type' | 'aggregateType' | 'aggregateId' | 'payload' | 'occurredAt'>): EventEnvelope {
  const p = record.payload ?? {};
  // AUT-011 form: `data` is an object next to the header fields; otherwise the payload IS the data.
  const wrapped = obj(p.data) !== null && (obj(p.aggregate) !== null || typeof p.eventId === 'string' || typeof p.occurredAt === 'string');
  const data = wrapped ? obj(p.data)! : p;
  const actor = obj(p.actor);
  const causation = obj(p.causation);
  return {
    eventId: record.id,
    type: record.type,
    occurredAt: record.occurredAt,
    actor: actor && typeof actor.type === 'string' ? { type: actor.type, id: str(actor.id) } : null,
    aggregate: { type: modelName(record.aggregateType), id: record.aggregateId },
    clientId: str(p.clientId) ?? str(data.clientId),
    dossierId: str(p.dossierId) ?? str(data.dossierId),
    data,
    causation: causation && typeof causation.ruleId === 'string' && typeof causation.executionId === 'string' ? { ruleId: causation.ruleId, executionId: causation.executionId } : null,
    originId: str(p.requestId) ?? str(p.jobRunId) ?? record.id,
  };
}

export interface NewDomainEvent {
  type: string;
  aggregate: { type: string; id: string };
  actor?: { type: 'USER' | 'SYSTEM' | 'WEBHOOK' | 'ANONYMOUS' | 'LINK'; id: string | null } | null;
  clientId?: string | null;
  dossierId?: string | null;
  data?: Record<string, unknown>;
  /** NOT-035 — id of the request, or of the pass of the scheduled task, the event comes from. */
  requestId?: string | null;
  jobRunId?: string | null;
  /** AUT-012 — key of the fact for a ⏱ event. */
  dedupeKey?: string;
}

/** Builds the `DomainEvent` of `OutboxWriter.add` in the form of AUT-011 (new emitters should use it). */
export function domainEvent(ev: NewDomainEvent): { type: string; aggregateType: string; aggregateId: string; payload: Record<string, unknown>; dedupeKey?: string } {
  return {
    type: ev.type,
    aggregateType: ev.aggregate.type,
    aggregateId: ev.aggregate.id,
    payload: {
      type: ev.type,
      actor: ev.actor ?? { type: 'SYSTEM', id: null },
      aggregate: ev.aggregate,
      clientId: ev.clientId ?? null,
      dossierId: ev.dossierId ?? null,
      data: ev.data ?? {},
      ...(ev.requestId ? { requestId: ev.requestId } : {}),
      ...(ev.jobRunId ? { jobRunId: ev.jobRunId } : {}),
    },
    ...(ev.dedupeKey ? { dedupeKey: ev.dedupeKey } : {}),
  };
}
