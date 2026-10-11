// AUT-020, AUT-021, AUT-030…AUT-034 — the definition of a rule is DATA: its conditions and its actions are validated
// by these schemas when the starting data install it, when the back office saves it (COM-061) and again before every
// execution. Nothing read from the database is ever evaluated as code: a condition is a comparison of a field of a
// closed list with a literal value; an action is one of four known types with known keys.
import { z } from 'zod';
import { DOMAIN_EVENTS, isRuleTrigger } from './event-catalogue.js';

export const OPERATORS = ['eq', 'neq', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull', 'contains'] as const;
export type Operator = (typeof OPERATORS)[number];

export const DELAY_UNITS = ['MINUTES', 'HOURS', 'DAYS', 'BUSINESS_HOURS', 'BUSINESS_DAYS'] as const;
export type DelayUnit = (typeof DELAY_UNITS)[number];

/** AUT-020 — fields a condition may read, per object (closed list). */
export const CONDITION_FIELDS: Readonly<Record<string, readonly string[]>> = {
  lead: ['kind', 'status', 'source', 'assignedAgentId', 'firstContactAt', 'propertyId'],
  client: ['status', 'countryOfResidence', 'residencyStatus', 'score', 'hasAccount', 'accountStatus', 'hasEmail', 'marketingOptIn', 'preferredLanguage', 'assignedAgentId'],
  dossier: [
    'stage', 'status', 'priority', 'financingRequested', 'financingType', 'propertyCountryCode', 'completenessPct', 'assignedAgentId', 'candidateCount',
    'promoterId', 'firstContactAt', 'unopenedProposalCount', 'pendingProposalCount', 'sharingConsentGranted',
  ],
  candidate: ['status', 'origin'],
  document: ['status', 'category', 'providedBy', 'isRequired', 'source'],
  submission: ['status', 'bankId', 'transmissionMode', 'financingType', 'downloadCount', 'acceptedByClientAt'],
  reservation: ['status', 'contractDocumentId', 'optionAcknowledgedAt'],
  appointment: ['type', 'status', 'startsAt', 'clientNotified'],
  cafe: ['status', 'seatsTaken', 'capacity', 'attendedSeats', 'fillPct'],
  registration: ['status', 'seats', 'registeredAt'],
  feedback: ['kind', 'npsScore', 'csatScore', 'category'],
  conversation: ['awaitingStaffReply', 'unreadByStaff'],
  property: ['type', 'standing', 'availability', 'countryCode'],
  user: ['status', 'emailVerifiedAt'],
};

/**
 * AUT-020 « Résolution des objets » — the objects the engine can reach from the object of the event. A rule that
 * cites an object absent from its trigger cannot be saved (AUT-021).
 */
export const OBJECTS_BY_AGGREGATE: Readonly<Record<string, readonly string[]>> = {
  Lead: ['lead', 'client', 'dossier', 'property', 'program', 'promoter', 'user'],
  Client: ['client', 'user', 'dossier'],
  Communication: ['client', 'lead', 'dossier', 'user'],
  Dossier: ['dossier', 'client', 'property', 'program', 'lot', 'promoter', 'user', 'document', 'documents', 'bank'],
  DossierCandidate: ['candidate', 'dossier', 'client', 'property', 'program', 'promoter', 'appointment', 'user'],
  DossierDocument: ['document', 'documents', 'dossier', 'client', 'user', 'bank'],
  BankSubmission: ['submission', 'bank', 'dossier', 'client', 'user'],
  Reservation: ['reservation', 'lot', 'property', 'program', 'promoter', 'dossier', 'client', 'user'],
  Appointment: ['appointment', 'dossier', 'client', 'property', 'program', 'promoter', 'user'],
  Event: ['cafe'],
  EventRegistration: ['registration', 'cafe', 'client', 'user'],
  Feedback: ['feedback', 'client', 'dossier', 'property', 'program', 'promoter', 'user'],
  Message: ['conversation', 'client', 'dossier', 'user'],
  Conversation: ['conversation', 'client', 'dossier', 'user'],
  Property: ['property', 'program', 'promoter'],
  Program: ['program', 'promoter'],
  Lot: ['lot', 'property', 'program', 'promoter', 'dossier', 'client'],
  Promoter: ['promoter', 'partner'],
  Bank: ['bank', 'partner'],
  BankProduct: ['product', 'bank'],
  PartnerDocument: ['partnerDocument', 'promoter', 'bank', 'partner'],
  User: ['user'],
  DataRequest: ['client', 'user'],
};

/** Objects available to a trigger (the union over the objects its event may carry). */
export function objectsOf(trigger: string): Set<string> {
  const decl = DOMAIN_EVENTS[trigger];
  const out = new Set<string>();
  for (const aggregate of decl?.aggregates ?? []) for (const o of OBJECTS_BY_AGGREGATE[aggregate] ?? []) out.add(o);
  return out;
}

// ---------- conditions ----------

const scalar = z.union([z.string().max(200), z.number().finite(), z.boolean()]);
const fieldPath = z.string().regex(/^[a-z][A-Za-z]*(\.[A-Za-z][A-Za-z0-9]*){1,2}$/).max(80);

export const comparisonSchema = z
  .object({
    field: fieldPath,
    op: z.enum(OPERATORS),
    value: z.union([scalar, z.array(scalar).max(50)]).optional(),
  })
  .strict();
export type Comparison = z.infer<typeof comparisonSchema>;

const innerGroup = z.union([z.object({ all: z.array(comparisonSchema).min(1).max(20) }).strict(), z.object({ any: z.array(comparisonSchema).min(1).max(20) }).strict()]);
const element = z.union([comparisonSchema, innerGroup]);
/** AUT-020 — a group `all` or `any`; two levels at most. */
export const conditionsSchema = z.union([z.object({ all: z.array(element).min(1).max(20) }).strict(), z.object({ any: z.array(element).min(1).max(20) }).strict()]);
export type ConditionGroup = { all: ConditionNode[] } | { any: ConditionNode[] };
export type ConditionNode = Comparison | ConditionGroup;

// ---------- actions ----------

export const EMAIL_RECIPIENTS = [
  'CLIENT', 'REGISTRANT', 'REGISTRANTS', 'ATTENDEES', 'NOTIFY_REQUESTS', 'DOSSIER_AGENT', 'LEAD_AGENT', 'CLIENT_AGENT', 'APPOINTMENT_AGENT', 'EVENT_HOST', 'ADMINS', 'OWNERS',
] as const;
export type EmailRecipientRef = (typeof EMAIL_RECIPIENTS)[number];
export const AGENT_REFS = ['DOSSIER_AGENT', 'LEAD_AGENT', 'CLIENT_AGENT', 'APPOINTMENT_AGENT', 'EVENT_HOST'] as const;
export type AgentRef = (typeof AGENT_REFS)[number];
export const STAFF_RECIPIENTS = [...AGENT_REFS, 'ADMINS', 'OWNERS', 'ALL_AGENTS', 'SUPPORT'] as const;
export type StaffRecipientRef = (typeof STAFF_RECIPIENTS)[number];

/** AUT-031 `markField` — the sending marks the engine may write, per object. */
export const MARK_FIELDS: Readonly<Record<string, readonly string[]>> = {
  registration: ['reminder7SentAt', 'reminder1SentAt', 'followUpSentAt'],
  appointment: ['reminderSentAt'],
  notifyRequest: ['notifiedAt'],
};
const ALL_MARK_FIELDS = Object.values(MARK_FIELDS).flat();

const templateCode = z.string().regex(/^[A-Z][A-Z0-9_]{2,59}$/);
/** A text with dynamic fields (AUT-036); its length is checked again after the fields are replaced. */
const dynamicText = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const sendEmailSchema = z
  .object({
    type: z.literal('SEND_EMAIL'),
    template: templateCode,
    to: z.enum(EMAIL_RECIPIENTS),
    respectQuietHours: z.boolean().optional(),
    skipWhenOnHold: z.boolean().optional(),
    dedupeWindowHours: z.number().int().min(1).max(24 * 365).optional(),
    dedupeKey: dynamicText(160).optional(),
    registeredBeforeHours: z.number().int().min(1).max(24 * 365).optional(),
    markField: z.enum(ALL_MARK_FIELDS as [string, ...string[]]).optional(),
  })
  .strict();
export type SendEmailAction = z.infer<typeof sendEmailSchema>;

/** A number of business days, or the name of the setting that holds it (`partner.applicationReviewDays`, AUT-040). */
const daysOrSetting = z.union([z.number().int().min(0).max(365), z.object({ setting: z.string().regex(/^[a-zA-Z][A-Za-z0-9.]{2,79}$/) }).strict()]);

export const createTaskSchema = z
  .object({
    type: z.literal('CREATE_TASK'),
    title: dynamicText(300),
    description: dynamicText(4000).optional(),
    suggestedTemplate: templateCode.optional(),
    taskType: z.enum(['CALL', 'FOLLOW_UP', 'DOC_REVIEW', 'BANK_FOLLOW_UP', 'VISIT', 'MEETING', 'CONTENT', 'OTHER']).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    assignee: z.union([z.enum([...AGENT_REFS, 'TEAM']), uuid]).optional(),
    dueInBusinessDays: daysOrSetting.optional(),
    dueInDays: z.number().int().min(0).max(365).optional(),
    dueAtField: z.string().regex(/^[a-z][A-Za-z]*\.[A-Za-z][A-Za-z0-9]*$/).optional(),
    dedupeKey: dynamicText(120).optional(),
  })
  .strict()
  .refine((a) => [a.dueInBusinessDays, a.dueInDays, a.dueAtField].filter((v) => v !== undefined).length <= 1, { message: 'ONE_DUE_KEY' });
export type CreateTaskAction = z.infer<typeof createTaskSchema>;

const staffRefs = z.union([z.enum(STAFF_RECIPIENTS), z.array(z.enum(STAFF_RECIPIENTS)).min(1).max(STAFF_RECIPIENTS.length)]);

export const notifyStaffSchema = z
  .object({
    type: z.literal('NOTIFY_STAFF'),
    recipients: staffRefs,
    /** « à défaut » of the tables of § 5: who receives it when none of `recipients` can be reached. Default: ADMINS (AUT-033). */
    fallback: staffRefs.optional(),
    /** Optional: without it, the alert takes the title of the task the rule creates (AUT-033). */
    title: dynamicText(300).optional(),
    body: dynamicText(800).optional(),
  })
  .strict();
export type NotifyStaffAction = z.infer<typeof notifyStaffSchema>;

export const sendSurveySchema = z.object({ type: z.literal('SEND_SURVEY'), survey: z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/) }).strict();
export type SendSurveyAction = z.infer<typeof sendSurveySchema>;

export const actionSchema = z.union([sendEmailSchema, createTaskSchema, notifyStaffSchema, sendSurveySchema]);
export type RuleAction = z.infer<typeof actionSchema>;
/** AUT-030 — one to five actions, run in order. */
export const actionsSchema = z.array(actionSchema).min(1).max(5);

export const ruleDefinitionSchema = z
  .object({
    trigger: z.string().max(60),
    conditions: conditionsSchema.nullable(),
    delayValue: z.number().int().min(0).max(365),
    delayUnit: z.enum(DELAY_UNITS),
    actions: actionsSchema,
  })
  .strict();
export type RuleDefinition = z.infer<typeof ruleDefinitionSchema> & { conditions: ConditionGroup | null };

export interface RuleIssue {
  /** TRV-064 field codes: `INVALID_RULE_FIELD`, `INVALID_RULE_TRIGGER`, `INVALID_RULE_VALUE`, `INVALID_RULE_ACTION`, `INVALID_FORMAT`. */
  code: 'INVALID_RULE_FIELD' | 'INVALID_RULE_TRIGGER' | 'INVALID_RULE_VALUE' | 'INVALID_RULE_ACTION' | 'INVALID_FORMAT';
  path: string;
}

function comparisons(node: ConditionNode, out: Comparison[] = []): Comparison[] {
  if ('field' in node) out.push(node);
  else for (const child of 'all' in node ? node.all : node.any) comparisons(child, out);
  return out;
}

/** Every field a group of conditions reads. */
export function citedConditionFields(conditions: ConditionGroup | null): string[] {
  return conditions ? [...new Set(comparisons(conditions).map((c) => c.field))] : [];
}

/** AUT-021 — is `field` readable by a rule of this trigger? */
export function isAllowedField(trigger: string, field: string): boolean {
  const [object, ...rest] = field.split('.');
  if (object === 'event') return rest.length === 2 && rest[0] === 'data' && (DOMAIN_EVENTS[trigger]?.data ?? []).includes(rest[1]!);
  if (rest.length !== 1) return false;
  return objectsOf(trigger).has(object!) && (CONDITION_FIELDS[object!] ?? []).includes(rest[0]!);
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/;

function valueIssue(c: Comparison): boolean {
  const list = Array.isArray(c.value);
  switch (c.op) {
    case 'isNull':
    case 'isNotNull':
      return c.value !== undefined;
    case 'in':
    case 'nin':
      return !list || (c.value as unknown[]).length === 0;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return !(typeof c.value === 'number' || (typeof c.value === 'string' && ISO_INSTANT.test(c.value)));
    default:
      return c.value === undefined || list; // eq, neq, contains: one literal
  }
}

/**
 * Parses and validates a rule definition (AUT-021). Returns the typed definition, or the issues: a rule with an
 * unknown trigger, field or operator, an object absent from its trigger or a malformed value is neither saved nor run.
 */
export function parseRuleDefinition(input: unknown): { ok: true; definition: RuleDefinition } | { ok: false; issues: RuleIssue[] } {
  const parsed = ruleDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => ({ code: i.path[0] === 'actions' ? 'INVALID_RULE_ACTION' : 'INVALID_FORMAT', path: i.path.join('.') })) };
  }
  const def = parsed.data as RuleDefinition;
  const issues: RuleIssue[] = [];
  if (!isRuleTrigger(def.trigger)) issues.push({ code: 'INVALID_RULE_TRIGGER', path: 'trigger' });
  else {
    for (const c of def.conditions ? comparisons(def.conditions) : []) {
      if (!isAllowedField(def.trigger, c.field)) issues.push({ code: 'INVALID_RULE_FIELD', path: `conditions.${c.field}` });
      else if (valueIssue(c)) issues.push({ code: 'INVALID_RULE_VALUE', path: `conditions.${c.field}` });
    }
    const available = objectsOf(def.trigger);
    def.actions.forEach((a, i) => {
      if (a.type === 'CREATE_TASK' && a.dueAtField && !available.has(a.dueAtField.split('.')[0]!)) issues.push({ code: 'INVALID_RULE_FIELD', path: `actions.${i}.dueAtField` });
      if (a.type === 'SEND_EMAIL' && a.markField) {
        const target = a.to === 'NOTIFY_REQUESTS' ? 'notifyRequest' : a.to === 'CLIENT' ? 'appointment' : 'registration';
        if (!(MARK_FIELDS[target] ?? []).includes(a.markField)) issues.push({ code: 'INVALID_RULE_FIELD', path: `actions.${i}.markField` });
      }
    });
  }
  return issues.length ? { ok: false, issues } : { ok: true, definition: def };
}
