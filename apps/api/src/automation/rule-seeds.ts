// AUT-040…AUT-056 § 5 — the rules delivered with the modules that exist today, as starting data (`isSystem = true`:
// they can be disabled and adjusted, not deleted). Each line of the tables of the spec becomes one definition:
// its conditions (column « Conditions »), its delay, its actions (column « Actions », whose text is the description of
// the rule, cut at 500 characters). The titles are the spec's, their French markers replaced by the dynamic fields of
// AUT-036 ({client} → {{client.fullName}}, {référence} → {{lead.reference}}…).
//
// Seeded here: the rules whose trigger is emitted by delivered code AND whose actions can run today. The others come
// with their package (AUT-083, plan § 1.3): see README.md, « Règles à venir ».
// Order of the actions: the task first, then the alert — the alert takes the title of the task, opens it, and is not
// repeated when an open task already carries the key (AUT-033).
import type { RuleAction, ConditionGroup, DelayUnit } from './rule-definition.js';
import { LEAD_PROCESSING_RULE_SEEDS } from '../leads-admin/lead-rules.js';
import { AGENDA_RULE_SEEDS } from './rule-seeds-agenda.js';
import { DOSSIER_RULE_SEEDS } from './rule-seeds-dossier.js';
import { PARTNER_RULE_SEEDS } from '../promoters-admin/partner-rules.js';

export interface RuleSeed {
  code: string;
  /** What the rule does, a nominal group of 60 characters at most (AUT § 5). */
  name: string;
  /** The « Actions » column of the spec. */
  description: string;
  trigger: string;
  conditions: ConditionGroup | null;
  delayValue: number;
  delayUnit: DelayUnit;
  actions: RuleAction[];
  /** Position in the screen and among the rules of the same trigger. */
  sortOrder: number;
}

const eq = (field: string, value: string | number | boolean) => ({ field, op: 'eq' as const, value });

export const RULE_SEEDS: RuleSeed[] = [
  // ---------- § 5.1 Demandes (AUT-040) ----------
  {
    code: 'R_PARTNER_APPLICATION_SUBMITTED',
    name: "Candidature partenaire à examiner",
    description:
      "Notifier OWNERS et ADMINS : « Candidature partenaire de {société} à examiner. » Tâche « Examiner la candidature de {société} », TEAM, échéance partner.applicationReviewDays jours ouvrés, clé partner-app:{leadId} (fermée à l'acceptation ou au refus).",
    trigger: 'lead.application_submitted',
    conditions: null,
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [
      { type: 'CREATE_TASK', title: 'Examiner la candidature de {{event.data.companyName}}', assignee: 'TEAM', dueInBusinessDays: { setting: 'partner.applicationReviewDays' }, dedupeKey: 'partner-app:{{lead.id}}' },
      { type: 'NOTIFY_STAFF', recipients: ['OWNERS', 'ADMINS'], title: 'Candidature partenaire de {{event.data.companyName}} à examiner.' },
    ],
    sortOrder: 100,
  },
  {
    code: 'R_LEAD_NOT_TAKEN',
    name: 'Demande non prise en charge',
    description: 'Notifier ADMINS : « La demande {référence} attend depuis {délai}. »',
    trigger: 'lead.created',
    conditions: { all: [eq('lead.status', 'NEW')] },
    delayValue: 4,
    delayUnit: 'BUSINESS_HOURS',
    actions: [{ type: 'NOTIFY_STAFF', recipients: 'ADMINS', title: 'La demande {{lead.reference}} attend depuis {{rule.delayLabel}}.' }],
    sortOrder: 110,
  },
  {
    code: 'R_LEAD_DURING_DOSSIER',
    name: 'Nouvelle demande pendant un dossier en cours',
    description: "Notifier CLIENT_AGENT et DOSSIER_AGENT — le conseiller du dossier en cours, s'il n'est pas le référent — : « Nouvelle demande de {client} pendant un dossier en cours. »",
    trigger: 'lead.created',
    conditions: { all: [eq('event.data.attachment', 'PENDING_DECISION')] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'NOTIFY_STAFF', recipients: ['CLIENT_AGENT', 'DOSSIER_AGENT'], title: 'Nouvelle demande de {{client.fullName}} pendant un dossier en cours.' }],
    sortOrder: 120,
  },
  {
    code: 'R_LEAD_SLA_WARNING',
    name: 'Délai de premier contact bientôt atteint',
    description: "Notifier LEAD_AGENT (à défaut ALL_AGENTS) : « Plus qu'un jour ouvré pour contacter {client}. »",
    trigger: 'lead.sla_warning',
    conditions: { all: [{ field: 'lead.firstContactAt', op: 'isNull' }] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'NOTIFY_STAFF', recipients: 'LEAD_AGENT', fallback: 'ALL_AGENTS', title: "Plus qu'un jour ouvré pour contacter {{client.fullName}}." }],
    sortOrder: 130,
  },
  {
    code: 'R_LEAD_SLA_BREACHED',
    name: 'Délai de premier contact dépassé',
    description:
      "Notifier LEAD_AGENT et ADMINS. E-mail S_LEAD_SLA_BREACHED aux ADMINS. Tâche « Contacter {client} : délai de premier contact dépassé », CALL, URGENT, LEAD_AGENT, échéance immédiate, clé lead-contact:{leadId}. E-mail C_LEAD_DELAYED au client, une seule fois par demande : sa clé est C_LEAD_DELAYED:{leadId}, à la place de celle de NOT-011 ; client sans adresse e-mail : rien de plus, la tâche ci-dessus en tient lieu (NOT-025).",
    trigger: 'lead.sla_breached',
    conditions: { all: [{ field: 'lead.firstContactAt', op: 'isNull' }] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [
      { type: 'CREATE_TASK', title: 'Contacter {{client.fullName}} : délai de premier contact dépassé', taskType: 'CALL', priority: 'URGENT', assignee: 'LEAD_AGENT', dueInBusinessDays: 0, dedupeKey: 'lead-contact:{{lead.id}}' },
      { type: 'NOTIFY_STAFF', recipients: ['LEAD_AGENT', 'ADMINS'] },
      { type: 'SEND_EMAIL', template: 'S_LEAD_SLA_BREACHED', to: 'ADMINS' },
      { type: 'SEND_EMAIL', template: 'C_LEAD_DELAYED', to: 'CLIENT', dedupeKey: 'C_LEAD_DELAYED:{{lead.id}}', skipWhenOnHold: false },
    ],
    sortOrder: 140,
  },
  // ---------- § 5.2 Financement (AUT-041) ----------
  {
    code: 'R_CONSENT_WITHDRAWN',
    name: "Retrait de l'accord de transmission",
    description: 'Notifier DOSSIER_AGENT. Tâche « {client} a retiré son accord de transmission », HIGH, échéance 1 jour ouvré, clé consent:{dossierId}.',
    trigger: 'consent.changed',
    conditions: { all: [eq('event.data.type', 'DATA_SHARING_PARTNERS'), eq('event.data.granted', false), { field: 'dossier.status', op: 'in', value: ['OPEN', 'ON_HOLD'] }] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [
      { type: 'CREATE_TASK', title: '{{client.fullName}} a retiré son accord de transmission', priority: 'HIGH', dueInBusinessDays: 1, dedupeKey: 'consent:{{dossier.id}}' },
      { type: 'NOTIFY_STAFF', recipients: 'DOSSIER_AGENT' },
    ],
    sortOrder: 200,
  },
  // ---------- § 5.3 Pièces (AUT-042) ----------
  {
    code: 'R_DOC_REVIEW',
    name: 'Pièces reçues à vérifier',
    description: 'Tâche « Vérifier les pièces de {client} », DOC_REVIEW, DOSSIER_AGENT, échéance 1 jour ouvré, clé doc-review:{dossierId}.',
    trigger: 'document.received',
    conditions: null,
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'CREATE_TASK', title: 'Vérifier les pièces de {{client.fullName}}', taskType: 'DOC_REVIEW', assignee: 'DOSSIER_AGENT', dueInBusinessDays: 1, dedupeKey: 'doc-review:{{dossier.id}}' }],
    sortOrder: 300,
  },
  {
    code: 'R_DOC_OPERATOR_REJECTED',
    name: "Pièce de l'équipe à refaire",
    description: 'Tâche « Pièce à refaire : {libellé} (dossier {référence}) », DOSSIER_AGENT, clé doc-redo:{documentId}.',
    trigger: 'document.rejected',
    conditions: { all: [{ field: 'document.providedBy', op: 'neq', value: 'CLIENT' }] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'CREATE_TASK', title: 'Pièce à refaire : {{document.label}} (dossier {{dossier.reference}})', assignee: 'DOSSIER_AGENT', dedupeKey: 'doc-redo:{{document.id}}' }],
    sortOrder: 310,
  },
  // ---------- § 5.4 Rapprochement et dossier (AUT-043) ----------
  {
    code: 'R_CLIENT_RESURFACED',
    name: 'Client de retour sur un dossier en pause',
    description: "Tâche « Le client s'est manifesté : reprendre le dossier {référence} ? », HIGH, clé resurfaced:{dossierId}.",
    trigger: 'lead.attached',
    conditions: { all: [eq('dossier.status', 'ON_HOLD')] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'CREATE_TASK', title: "Le client s'est manifesté : reprendre le dossier {{dossier.reference}} ?", priority: 'HIGH', dedupeKey: 'resurfaced:{{dossier.id}}' }],
    sortOrder: 400,
  },
  // ---------- § 5.6 Compte (AUT-045) ----------
  {
    code: 'R_VERIFICATION_REMINDER',
    name: "Relance de la vérification de l'adresse",
    description: 'E-mail C_EMAIL_VERIFICATION, avec un nouveau lien. Une seule fois.',
    trigger: 'client.account_created',
    conditions: { all: [{ field: 'user.emailVerifiedAt', op: 'isNull' }] },
    delayValue: 24,
    delayUnit: 'HOURS',
    // An account e-mail leaves at once, at any hour (AUT-006). The key is the one the in-process stand-in used (AUT-084).
    actions: [{ type: 'SEND_EMAIL', template: 'C_EMAIL_VERIFICATION', to: 'CLIENT', respectQuietHours: false, skipWhenOnHold: false, dedupeKey: 'C_EMAIL_VERIFICATION:R_VERIFICATION_REMINDER:{{user.id}}' }],
    sortOrder: 600,
  },
  // ---------- § 5.8 Le Café (AUT-056) ----------
  {
    code: 'R_CAFE_OPENING',
    name: 'Ouverture des inscriptions du Café',
    description: 'E-mail C_CAFE_OPENING à NOTIFY_REQUESTS ; notifiedAt renseigné sur chaque demande servie.',
    trigger: 'event.registration_opened',
    conditions: null,
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'SEND_EMAIL', template: 'C_CAFE_OPENING', to: 'NOTIFY_REQUESTS', markField: 'notifiedAt' }],
    sortOrder: 800,
  },
  {
    code: 'R_CAFE_REMINDER_7D',
    name: 'Rappel du Café à une semaine',
    description: 'E-mail C_CAFE_REMINDER_7D aux inscrits REGISTERED depuis plus de 48 heures (to : REGISTRANTS, registeredBeforeHours 48), marque reminder7SentAt.',
    trigger: 'event.upcoming',
    conditions: { all: [eq('event.data.days', 7), { field: 'cafe.status', op: 'in', value: ['PUBLISHED', 'CLOSED'] }] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'SEND_EMAIL', template: 'C_CAFE_REMINDER_7D', to: 'REGISTRANTS', registeredBeforeHours: 48, markField: 'reminder7SentAt' }],
    sortOrder: 810,
  },
  {
    code: 'R_CAFE_REMINDER_1D',
    name: 'Rappel du Café la veille',
    description: 'E-mail C_CAFE_REMINDER_1D à tous les inscrits REGISTERED. reminder1SentAt renseigné.',
    trigger: 'event.upcoming',
    conditions: { all: [eq('event.data.days', 1), { field: 'cafe.status', op: 'in', value: ['PUBLISHED', 'CLOSED'] }] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'SEND_EMAIL', template: 'C_CAFE_REMINDER_1D', to: 'REGISTRANTS', markField: 'reminder1SentAt' }],
    sortOrder: 820,
  },
  {
    code: 'R_CAFE_LOW_FILL',
    name: 'Café peu rempli à une semaine',
    description: 'Notifier EVENT_HOST et ADMINS : « Le Café {lieu} du {date} compte {n} inscrits pour {capacité} places. »',
    trigger: 'event.upcoming',
    conditions: { all: [eq('event.data.days', 7), { field: 'cafe.fillPct', op: 'lt', value: 50 }] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'NOTIFY_STAFF', recipients: ['EVENT_HOST', 'ADMINS'], title: 'Le Café {{cafe.locationLabel}} du {{cafe.dateLabel}} compte {{cafe.seatsTaken}} inscrits pour {{cafe.capacity}} places.' }],
    sortOrder: 830,
  },
  {
    code: 'R_CAFE_MISSED',
    name: 'Absence au Café',
    description: "E-mail C_CAFE_MISSED à l'inscrit, avec la date du prochain Café s'il y en a un.",
    trigger: 'registration.no_show',
    conditions: null,
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'SEND_EMAIL', template: 'C_CAFE_MISSED', to: 'REGISTRANT' }],
    sortOrder: 850,
  },
  {
    code: 'R_CAFE_CALLBACK',
    name: 'Rappel des participants du Café',
    description: 'Tâche « Rappeler les participants du Café {lieu} du {date} », CALL, EVENT_HOST (à défaut TEAM), échéance 3 jours ouvrés, clé cafe-callback:{eventId}.',
    trigger: 'event.followup_due',
    conditions: { all: [{ field: 'cafe.attendedSeats', op: 'gt', value: 0 }] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'CREATE_TASK', title: 'Rappeler les participants du Café {{cafe.locationLabel}} du {{cafe.dateLabel}}', taskType: 'CALL', assignee: 'EVENT_HOST', dueInBusinessDays: 3, dedupeKey: 'cafe-callback:{{cafe.id}}' }],
    sortOrder: 860,
  },
  // ---------- § 5.4 Rapprochement et dossier (AUT-043, package 3.7) · § 5.7 Rendez-vous (AUT-051, package 3.8) ----------
  ...DOSSIER_RULE_SEEDS,
  ...AGENDA_RULE_SEEDS,
  // ---------- § 5.1 Demandes, package 3.2 (lead.released, communication.call_logged) ----------
  ...LEAD_PROCESSING_RULE_SEEDS,
  // ---------- § 5.9 Partenaires (AUT-073, AUT-079, package 3.4: the facts of `partner.scan`) ----------
  ...PARTNER_RULE_SEEDS,
];

/** The definition part of a seed, as stored in `WorkflowRule.originDefinition` (PAR-081). */
export function seedDefinition(seed: RuleSeed) {
  return { trigger: seed.trigger, conditions: seed.conditions, delayValue: seed.delayValue, delayUnit: seed.delayUnit, actions: seed.actions };
}
