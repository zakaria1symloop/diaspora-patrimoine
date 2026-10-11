// Package 1.4 « moteur des automatisations » — the rules of the engine that need no database: the validation of a rule
// definition (AUT-020, AUT-021, AUT-030), the evaluation of conditions, delays and new tries (AUT-004), quiet hours and
// the report to the next day (AUT-006, AUT-008), who receives (NOT-018, AUT-033), the form of an event (AUT-011), the
// seeded rules (AUT § 5) and the dated facts of a Café (AUT-056, AUT-082).
import { describe, expect, it } from 'vitest';
import type { BusinessCalendar } from '@dp/domain';
import { evaluateConditions } from '../src/automation/conditions.js';
import { DOMAIN_EVENTS, TECHNICAL_EVENTS, domainEvent, isRuleTrigger, toEnvelope } from '../src/automation/event-catalogue.js';
import { renderText } from '../src/automation/rule-actions.js';
import { citedConditionFields, isAllowedField, objectsOf, parseRuleDefinition, type ConditionGroup } from '../src/automation/rule-definition.js';
import { RULE_SEEDS, seedDefinition } from '../src/automation/rule-seeds.js';
import { StaffSnapshot, type StaffMember } from '../src/automation/staff-directory.js';
import { staffDedupeKey, staffTypeRank } from '../src/automation/staff-notifications.service.js';
import { clip, remindAtFor } from '../src/automation/tasks.service.js';
import { AUTOMATION_TEMPLATE_SEEDS } from '../src/automation/template-seeds.js';
import { ACTION_RETRY_MS, delayLabel, isQuiet, nextAttemptAt, nextDayStart, quietEnd, scheduledFor, zonedInstant } from '../src/automation/timing.js';
import { safeError } from '../src/automation/tech-alerts.js';
import { cafeMoments } from '../src/events/event-scan.js';
import { citedFields } from '../src/communication/template-renderer.js';

const cal: BusinessCalendar = { timeZone: 'Europe/Paris', workdays: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', holidays: [] };
const reader = (values: Record<string, unknown>) => (field: string) => values[field];

describe('AUT-020 — conditions', () => {
  const group: ConditionGroup = {
    all: [
      { field: 'dossier.stage', op: 'in', value: ['DOCUMENTS', 'BANK_REVIEW'] },
      { field: 'client.countryOfResidence', op: 'eq', value: 'FR' },
      { any: [{ field: 'dossier.priority', op: 'eq', value: 'HIGH' }, { field: 'client.score', op: 'gte', value: 70 }] },
    ],
  };
  it('evaluates groups all / any on two levels', () => {
    expect(evaluateConditions(group, reader({ 'dossier.stage': 'DOCUMENTS', 'client.countryOfResidence': 'FR', 'dossier.priority': 'NORMAL', 'client.score': 82 }))).toBe(true);
    expect(evaluateConditions(group, reader({ 'dossier.stage': 'DOCUMENTS', 'client.countryOfResidence': 'FR', 'dossier.priority': 'NORMAL', 'client.score': 40 }))).toBe(false);
    expect(evaluateConditions(group, reader({ 'dossier.stage': 'MATCHING', 'client.countryOfResidence': 'FR', 'dossier.priority': 'HIGH' }))).toBe(false);
  });
  it('a rule without conditions always applies', () => {
    expect(evaluateConditions(null, reader({}))).toBe(true);
  });
  it('a field without value makes its comparison false, except when the comparison is about its absence', () => {
    const none = reader({ 'lead.firstContactAt': null });
    expect(evaluateConditions({ all: [{ field: 'lead.firstContactAt', op: 'isNull' }] }, none)).toBe(true);
    expect(evaluateConditions({ all: [{ field: 'lead.firstContactAt', op: 'isNotNull' }] }, none)).toBe(false);
    expect(evaluateConditions({ all: [{ field: 'lead.status', op: 'neq', value: 'NEW' }] }, none)).toBe(false);
    expect(evaluateConditions({ all: [{ field: 'lead.status', op: 'nin', value: ['NEW'] }] }, none)).toBe(false);
  });
  it('compares booleans, numbers and instants', () => {
    expect(evaluateConditions({ all: [{ field: 'event.data.granted', op: 'eq', value: false }] }, reader({ 'event.data.granted': false }))).toBe(true);
    expect(evaluateConditions({ all: [{ field: 'cafe.fillPct', op: 'lt', value: 50 }] }, reader({ 'cafe.fillPct': 0 }))).toBe(true);
    expect(evaluateConditions({ all: [{ field: 'cafe.fillPct', op: 'lt', value: 50 }] }, reader({ 'cafe.fillPct': 50 }))).toBe(false);
    const at = new Date('2026-10-12T09:00:00Z');
    expect(evaluateConditions({ all: [{ field: 'appointment.startsAt', op: 'gt', value: '2026-10-12T08:00:00Z' }] }, reader({ 'appointment.startsAt': at }))).toBe(true);
    expect(evaluateConditions({ all: [{ field: 'appointment.startsAt', op: 'lte', value: '2026-10-12T08:00:00Z' }] }, reader({ 'appointment.startsAt': at }))).toBe(false);
    expect(evaluateConditions({ all: [{ field: 'event.data.changedFields', op: 'contains', value: 'email' }] }, reader({ 'event.data.changedFields': ['phone', 'email'] }))).toBe(true);
  });
  it('lists the fields a group reads', () => {
    expect(citedConditionFields(group).sort()).toEqual(['client.countryOfResidence', 'client.score', 'dossier.priority', 'dossier.stage']);
  });
});

describe('AUT-021, AUT-030 — a rule definition is validated data', () => {
  const base = { trigger: 'document.rejected', conditions: null, delayValue: 0, delayUnit: 'MINUTES', actions: [{ type: 'NOTIFY_STAFF', recipients: 'ADMINS', title: 'x' }] };
  const codes = (input: unknown) => {
    const r = parseRuleDefinition(input);
    return r.ok ? [] : r.issues.map((i) => i.code);
  };
  it('accepts the example of the spec', () => {
    const r = parseRuleDefinition({
      ...base,
      trigger: 'document.reminders_exhausted',
      conditions: { all: [{ field: 'dossier.stage', op: 'in', value: ['DOCUMENTS', 'BANK_REVIEW'] }, { any: [{ field: 'dossier.priority', op: 'eq', value: 'HIGH' }, { field: 'client.score', op: 'gte', value: 70 }] }] },
      actions: [
        { type: 'SEND_EMAIL', template: 'C_DOC_REMINDER', to: 'CLIENT', respectQuietHours: true },
        { type: 'CREATE_TASK', title: 'Appeler {{client.fullName}} : pièces en attente', taskType: 'CALL', priority: 'HIGH', assignee: 'DOSSIER_AGENT', dueInBusinessDays: 1, dedupeKey: 'doc-call:{{dossier.id}}' },
        { type: 'NOTIFY_STAFF', recipients: 'ADMINS', title: 'Demande {{lead.reference}} non prise en charge depuis 4 h' },
      ],
    });
    expect(r.ok).toBe(true);
  });
  it('refuses an unknown trigger, and a technical event (AUT-013)', () => {
    expect(codes({ ...base, trigger: 'nothing.happened' })).toEqual(['INVALID_RULE_TRIGGER']);
    expect(codes({ ...base, trigger: 'auth.email_requested' })).toEqual(['INVALID_RULE_TRIGGER']);
    expect(isRuleTrigger('document.version_created')).toBe(false);
  });
  it('refuses an unknown field, an object absent from the trigger, data the event does not carry', () => {
    expect(codes({ ...base, conditions: { all: [{ field: 'client.passwordHash', op: 'eq', value: 'x' }] } })).toEqual(['INVALID_RULE_FIELD']);
    expect(codes({ ...base, conditions: { all: [{ field: 'reservation.status', op: 'eq', value: 'OPTION' }] } })).toEqual(['INVALID_RULE_FIELD']);
    expect(codes({ ...base, conditions: { all: [{ field: 'event.data.days', op: 'eq', value: 7 }] } })).toEqual(['INVALID_RULE_FIELD']);
    expect(isAllowedField('event.upcoming', 'event.data.days')).toBe(true);
    expect(isAllowedField('document.rejected', 'document.providedBy')).toBe(true);
    expect(objectsOf('document.rejected').has('dossier')).toBe(true);
  });
  it('refuses an unknown operator, a malformed value, a third level, code-like content', () => {
    expect(codes({ ...base, conditions: { all: [{ field: 'dossier.stage', op: 'matches', value: '.*' }] } })).toEqual(['INVALID_FORMAT']);
    expect(codes({ ...base, conditions: { all: [{ field: 'dossier.stage', op: 'in', value: 'DOCUMENTS' }] } })).toEqual(['INVALID_RULE_VALUE']);
    expect(codes({ ...base, conditions: { all: [{ field: 'dossier.stage', op: 'isNull', value: 'x' }] } })).toEqual(['INVALID_RULE_VALUE']);
    expect(codes({ ...base, conditions: { all: [{ field: 'dossier.completenessPct', op: 'gt', value: 'beaucoup' }] } })).toEqual(['INVALID_RULE_VALUE']);
    expect(codes({ ...base, conditions: { all: [{ any: [{ all: [{ field: 'dossier.stage', op: 'eq', value: 'X' }] }] }] } })[0]).toBe('INVALID_FORMAT');
    expect(codes({ ...base, conditions: { all: [{ field: 'dossier.stage', op: 'eq', value: 'X', script: 'process.exit()' }] } })[0]).toBe('INVALID_FORMAT');
  });
  it('one to five actions, of a known type, with known keys', () => {
    expect(codes({ ...base, actions: [] })[0]).toBe('INVALID_RULE_ACTION');
    expect(codes({ ...base, actions: Array.from({ length: 6 }, () => base.actions[0]) })[0]).toBe('INVALID_RULE_ACTION');
    expect(codes({ ...base, actions: [{ type: 'SET_FIELD', field: 'dossier.stage', value: 'WON' }] })[0]).toBe('INVALID_RULE_ACTION');
    expect(codes({ ...base, actions: [{ type: 'CREATE_TASK', title: 'x', eval: '1+1' }] })[0]).toBe('INVALID_RULE_ACTION');
    expect(codes({ ...base, actions: [{ type: 'CREATE_TASK', title: 'x', dueInDays: 1, dueInBusinessDays: 2 }] })[0]).toBe('INVALID_RULE_ACTION');
    expect(codes({ ...base, actions: [{ type: 'CREATE_TASK', title: 'x', dueAtField: 'appointment.startsAt' }] })).toEqual(['INVALID_RULE_FIELD']);
    expect(codes({ ...base, actions: [{ type: 'SEND_EMAIL', template: 'C_DOC_REJECTED', to: 'CLIENT', markField: 'gdprErasedAt' }] })[0]).toBe('INVALID_RULE_ACTION');
    expect(codes({ ...base, delayValue: 400 })[0]).toBe('INVALID_FORMAT');
  });
});

describe('AUT-004 — delay and new tries', () => {
  const friday = new Date('2026-10-09T15:00:00Z'); // Friday 17:00 in Paris
  it('counts MINUTES, HOURS and DAYS on the calendar', () => {
    expect(scheduledFor(friday, 0, 'MINUTES', cal)).toEqual(friday);
    expect(scheduledFor(friday, 30, 'MINUTES', cal).toISOString()).toBe('2026-10-09T15:30:00.000Z');
    expect(scheduledFor(friday, 24, 'HOURS', cal).toISOString()).toBe('2026-10-10T15:00:00.000Z');
    expect(scheduledFor(friday, 3, 'DAYS', cal).toISOString()).toBe('2026-10-12T15:00:00.000Z');
  });
  it('counts BUSINESS_HOURS and BUSINESS_DAYS on the business calendar (CAL-060)', () => {
    // One business hour left on Friday; three more on Monday, from 9:00 in Paris.
    expect(scheduledFor(friday, 4, 'BUSINESS_HOURS', cal).toISOString()).toBe('2026-10-12T10:00:00.000Z');
    expect(scheduledFor(friday, 1, 'BUSINESS_DAYS', cal).getTime()).toBeGreaterThan(new Date('2026-10-12T00:00:00Z').getTime());
    expect(scheduledFor(friday, 1, 'BUSINESS_DAYS', cal).getTime()).toBeLessThan(new Date('2026-10-13T00:00:00Z').getTime());
  });
  it('replays a failed action after 1 minute, 10 minutes, 1 hour, then gives up', () => {
    const now = new Date('2026-10-12T09:00:00Z');
    expect(ACTION_RETRY_MS).toEqual([60_000, 600_000, 3_600_000]);
    expect(nextAttemptAt(1, now)!.toISOString()).toBe('2026-10-12T09:01:00.000Z');
    expect(nextAttemptAt(2, now)!.toISOString()).toBe('2026-10-12T09:10:00.000Z');
    expect(nextAttemptAt(3, now)!.toISOString()).toBe('2026-10-12T10:00:00.000Z');
    expect(nextAttemptAt(4, now)).toBeNull();
  });
  it('labels the delay as the rule sets it (AUT-036 {délai})', () => {
    expect(delayLabel(4, 'BUSINESS_HOURS')).toBe('4 heures ouvrées');
    expect(delayLabel(1, 'BUSINESS_DAYS')).toBe('1 jour ouvré');
    expect(delayLabel(3, 'DAYS')).toBe('3 jours');
  });
});

describe('AUT-006, AUT-008 — quiet hours and the report to the next day', () => {
  const quiet = { start: '20:00', end: '08:00' };
  it('is quiet from 20:00 to 8:00 in the recipient’s time zone', () => {
    expect(isQuiet(new Date('2026-10-12T17:59:00Z'), quiet, 'Europe/Paris')).toBe(false); // 19:59
    expect(isQuiet(new Date('2026-10-12T18:00:00Z'), quiet, 'Europe/Paris')).toBe(true); // 20:00
    expect(isQuiet(new Date('2026-10-12T18:00:00Z'), quiet, 'America/Toronto')).toBe(false); // 14:00
    expect(isQuiet(new Date('2026-10-12T05:59:00Z'), quiet, 'Europe/Paris')).toBe(true); // 7:59
    expect(isQuiet(new Date('2026-10-12T06:00:00Z'), quiet, 'Europe/Paris')).toBe(false); // 8:00
  });
  it('waits for 8:00, the same morning or the next one', () => {
    expect(quietEnd(new Date('2026-10-12T21:00:00Z'), quiet, 'Europe/Paris').toISOString()).toBe('2026-10-13T06:00:00.000Z'); // 23:00 → tomorrow 8:00
    expect(quietEnd(new Date('2026-10-12T03:00:00Z'), quiet, 'Europe/Paris').toISOString()).toBe('2026-10-12T06:00:00.000Z'); // 5:00 → today 8:00
    expect(nextDayStart(new Date('2026-10-12T13:00:00Z'), quiet, 'Europe/Paris').toISOString()).toBe('2026-10-13T06:00:00.000Z');
  });
  it('finds the instant of a wall time across a change of hour (AUT-081)', () => {
    expect(zonedInstant('2026-10-24', '10:00', 'Europe/Paris').toISOString()).toBe('2026-10-24T08:00:00.000Z'); // summer time
    expect(zonedInstant('2026-10-26', '10:00', 'Europe/Paris').toISOString()).toBe('2026-10-26T09:00:00.000Z'); // winter time
    expect(zonedInstant('2026-10-12', '10:00', 'Africa/Algiers').toISOString()).toBe('2026-10-12T09:00:00.000Z');
  });
});

describe('NOT-018, AUT-033 — who receives', () => {
  const member = (userId: string, role: StaffMember['role'], absentUntil: Date | null = null): StaffMember => ({ userId, role, email: `${userId}@example.test`, firstName: userId, lastName: null, timezone: 'Europe/Paris', absentUntil });
  const staff = new StaffSnapshot([member('owner', 'OWNER'), member('admin', 'ADMIN'), member('agent', 'AGENT'), member('away', 'AGENT', new Date('2026-10-20')), member('viewer', 'VIEWER'), member('support', 'SUPPORT')], '2026-10-12');
  const agents = { DOSSIER_AGENT: null, LEAD_AGENT: null, CLIENT_AGENT: null, APPOINTMENT_AGENT: null, EVENT_HOST: null };
  const ids = (list: StaffMember[]) => list.map((m) => m.userId).sort();
  it('resolves the role groups', () => {
    expect(ids(staff.resolve(['ADMINS'], agents))).toEqual(['admin', 'owner']);
    expect(ids(staff.resolve(['OWNERS'], agents))).toEqual(['owner']);
    expect(ids(staff.resolve(['ALL_AGENTS'], agents))).toEqual(['admin', 'agent', 'away', 'owner']);
    expect(ids(staff.resolve(['SUPPORT'], agents))).toEqual(['support']);
  });
  it('notifies the advisor once, even when he is also an administrator', () => {
    expect(ids(staff.resolve(['LEAD_AGENT', 'ADMINS'], { ...agents, LEAD_AGENT: 'admin' }))).toEqual(['admin', 'owner']);
    expect(ids(staff.resolve(['LEAD_AGENT'], { ...agents, LEAD_AGENT: 'agent' }))).toEqual(['agent']);
  });
  it('an advisor who is not there, or cannot act, leaves his place to the ADMINS — or to the fallback of the rule', () => {
    expect(ids(staff.resolve(['DOSSIER_AGENT'], agents))).toEqual(['admin', 'owner']);
    expect(ids(staff.resolve(['DOSSIER_AGENT'], { ...agents, DOSSIER_AGENT: 'viewer' }))).toEqual(['admin', 'owner']); // no longer an advisor
    expect(ids(staff.resolve(['DOSSIER_AGENT'], { ...agents, DOSSIER_AGENT: 'gone' }))).toEqual(['admin', 'owner']); // suspended or deleted
    expect(ids(staff.resolve(['LEAD_AGENT'], agents, ['ALL_AGENTS']))).toEqual(['admin', 'agent', 'away', 'owner']);
  });
  it('an absent advisor receives, and the ADMINS too', () => {
    expect(ids(staff.resolve(['DOSSIER_AGENT'], { ...agents, DOSSIER_AGENT: 'away' }))).toEqual(['admin', 'away', 'owner']);
    expect(staff.isAbsent('away')).toBe(true);
    expect(staff.isAbsent('away', new Date('2026-10-21T10:00:00Z'))).toBe(false); // back before the due date
    expect(staff.isAbsent('agent')).toBe(false);
  });
  it('one of two advisors is enough: no fallback', () => {
    expect(ids(staff.resolve(['CLIENT_AGENT', 'DOSSIER_AGENT'], { ...agents, DOSSIER_AGENT: 'agent' }))).toEqual(['agent']);
  });
  it('NOT-035 — a type of the catalogue outranks the alert of a rule, which outranks NS_TASK_AUTO', () => {
    expect(staffTypeRank('NS_LEAD_NEW')).toBeGreaterThan(staffTypeRank('NS_RULE_ALERT'));
    expect(staffTypeRank('NS_RULE_ALERT')).toBeGreaterThan(staffTypeRank('NS_TASK_AUTO'));
    expect(staffDedupeKey('NS_LEAD_NEW', 'lead-1', 'req-1')).toBe('NS_LEAD_NEW:lead-1:req-1');
  });
});

describe('AUT-011 — the form of an event', () => {
  const at = new Date('2026-10-12T09:41:07Z');
  it('reads the common form', () => {
    const e = domainEvent({ type: 'document.rejected', aggregate: { type: 'DossierDocument', id: 'doc' }, actor: { type: 'USER', id: 'u' }, clientId: 'c', dossierId: 'd', data: { rejectionReason: 'ILLEGIBLE' }, requestId: 'req' });
    const env = toEnvelope({ id: 'ev', type: e.type, aggregateType: e.aggregateType, aggregateId: e.aggregateId, payload: e.payload, occurredAt: at });
    expect(env).toMatchObject({ eventId: 'ev', aggregate: { type: 'DossierDocument', id: 'doc' }, actor: { type: 'USER', id: 'u' }, clientId: 'c', dossierId: 'd', data: { rejectionReason: 'ILLEGIBLE' }, causation: null, originId: 'req' });
  });
  it('reads the payload of the writers delivered before the engine (data directly in the payload)', () => {
    const env = toEnvelope({ id: 'ev', type: 'consent.changed', aggregateType: 'Client', aggregateId: 'c', payload: { type: 'DATA_SHARING_PARTNERS', granted: false, by: 'CLIENT', dossierId: 'd' }, occurredAt: at });
    expect(env.data).toMatchObject({ type: 'DATA_SHARING_PARTNERS', granted: false });
    expect(env.dossierId).toBe('d');
    expect(env.originId).toBe('ev');
    expect(toEnvelope({ id: 'ev', type: 'event.published', aggregateType: 'event', aggregateId: 'e', payload: {}, occurredAt: at }).aggregate.type).toBe('Event');
  });
  it('keeps the causation of an event produced by a rule (no loop, AUT-005)', () => {
    const env = toEnvelope({ id: 'ev', type: 'task.assigned', aggregateType: 'Task', aggregateId: 't', payload: { causation: { ruleId: 'r', executionId: 'x' } }, occurredAt: at });
    expect(env.causation).toEqual({ ruleId: 'r', executionId: 'x' });
  });
  it('technical events are not triggers; every domain event names its object', () => {
    for (const type of TECHNICAL_EVENTS) expect(isRuleTrigger(type)).toBe(false);
    for (const [type, decl] of Object.entries(DOMAIN_EVENTS)) expect(decl.aggregates.length, type).toBeGreaterThan(0);
  });
});

describe('AUT § 5 — the seeded rules', () => {
  it('every seed passes the validation of AUT-021', () => {
    for (const seed of RULE_SEEDS) {
      const r = parseRuleDefinition(seedDefinition(seed));
      expect(r.ok ? [] : r.issues, seed.code).toEqual([]);
    }
  });
  it('codes are unique, names fit in 60 characters, descriptions in 500', () => {
    expect(new Set(RULE_SEEDS.map((s) => s.code)).size).toBe(RULE_SEEDS.length);
    for (const seed of RULE_SEEDS) {
      expect(seed.code).toMatch(/^R_[A-Z0-9_]+$/);
      expect(seed.name.length, seed.code).toBeLessThanOrEqual(60);
      expect(seed.description.length, seed.code).toBeLessThanOrEqual(500);
    }
  });
  it('AUT-032 — every task of a seeded rule carries its key', () => {
    for (const seed of RULE_SEEDS) for (const a of seed.actions) if (a.type === 'CREATE_TASK') expect(a.dedupeKey, seed.code).toBeTruthy();
  });
  it('AUT-033 — a rule that creates a task and alerts creates the task first', () => {
    for (const seed of RULE_SEEDS) {
      const task = seed.actions.findIndex((a) => a.type === 'CREATE_TASK');
      const alert = seed.actions.findIndex((a) => a.type === 'NOTIFY_STAFF');
      if (task >= 0 && alert >= 0) expect(task, seed.code).toBeLessThan(alert);
    }
  });
  it('the staff templates cite only fields the engine provides', () => {
    const provided = /^(staff|client|lead|company|advisor|action|task|actor)\./;
    for (const tpl of AUTOMATION_TEMPLATE_SEEDS) for (const field of [...citedFields(tpl.subject), ...citedFields(tpl.body)]) expect(field, tpl.code).toMatch(provided);
  });
});

describe('AUT-036 — dynamic fields of titles', () => {
  it('replaces the fields, as plain text on one line', () => {
    expect(renderText('Contacter {{client.fullName}} : délai de premier contact dépassé', { client: { fullName: 'Karima Benali' } })).toBe('Contacter Karima Benali : délai de premier contact dépassé');
    expect(renderText('partner-app:{{lead.id}}', { lead: { id: 'abc' } })).toBe('partner-app:abc');
    expect(renderText('{{#if client.phone}}Téléphone : {{client.phone}}{{/if}}', { client: { phone: null } })).toBe('');
  });
  it('AUT-032 — cuts a description beyond its length and ends it by « … »', () => {
    expect(clip('a'.repeat(10), 10)).toBe('a'.repeat(10));
    expect(clip('a'.repeat(11), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});

describe('TAC-003, TAC-030 — reminder of a task', () => {
  const due = new Date('2026-10-14T16:00:00Z'); // end of the working day in Paris
  it('follows the reminder setting', () => {
    expect(remindAtFor('NONE', due, true, 'Europe/Paris')).toBeNull();
    expect(remindAtFor('AT_DUE', due, true, 'Europe/Paris')).toEqual(due);
    expect(remindAtFor('BEFORE_15M', due, true, 'Europe/Paris')!.toISOString()).toBe('2026-10-14T15:45:00.000Z');
    expect(remindAtFor('BEFORE_1D', due, true, 'Europe/Paris')!.toISOString()).toBe('2026-10-13T16:00:00.000Z');
    expect(remindAtFor('AT_DUE', null, true, 'Europe/Paris')).toBeNull();
    const custom = new Date('2026-10-01T08:00:00Z');
    expect(remindAtFor('CUSTOM', null, true, 'Europe/Paris', custom)).toEqual(custom);
  });
  it('a due date without hour reminds at 9:00, in the person’s time zone', () => {
    expect(remindAtFor('AT_DUE', due, false, 'Europe/Paris')!.toISOString()).toBe('2026-10-14T07:00:00.000Z');
    expect(remindAtFor('BEFORE_1D', due, false, 'Europe/Paris')!.toISOString()).toBe('2026-10-13T07:00:00.000Z');
  });
});

describe('AUT-056, AUT-082 — the dated facts of a Café', () => {
  // Saturday 24 October 2026, 15:00–18:00 in Paris; published three weeks before.
  const cafe = { startsAt: new Date('2026-10-24T13:00:00Z'), endsAt: new Date('2026-10-24T16:00:00Z'), timezone: 'Europe/Paris', publishedAt: new Date('2026-10-01T08:00:00Z') };
  it('seven days before, then the day before, at 10:00, time of the place', () => {
    expect(cafeMoments(cafe, new Date('2026-10-17T07:59:00Z')).upcoming).toEqual([]);
    expect(cafeMoments(cafe, new Date('2026-10-17T08:00:00Z')).upcoming).toEqual([7]);
    expect(cafeMoments(cafe, new Date('2026-10-20T12:00:00Z')).upcoming).toEqual([7]); // catches up after a stop
    expect(cafeMoments(cafe, new Date('2026-10-23T08:00:00Z')).upcoming).toEqual([1]);
  });
  it('a dated reminder does not leave when it has lost its meaning', () => {
    expect(cafeMoments(cafe, new Date('2026-10-24T13:00:00Z')).upcoming).toEqual([]); // the Café has started
    // Published five days before: the moment of the week before had passed before it existed.
    expect(cafeMoments({ ...cafe, publishedAt: new Date('2026-10-19T08:00:00Z') }, new Date('2026-10-19T09:00:00Z')).upcoming).toEqual([]);
  });
  it('the follow-up is due the day after the end, at 10:00', () => {
    expect(cafeMoments(cafe, new Date('2026-10-25T08:59:00Z')).followUp).toBe(false); // winter time since that night: 9:59
    expect(cafeMoments(cafe, new Date('2026-10-25T09:00:00Z')).followUp).toBe(true);
    expect(cafeMoments(cafe, new Date('2026-12-01T09:00:00Z')).followUp).toBe(false);
  });
});

describe('AUT-076 — an alert carries no personal data', () => {
  it('removes addresses from an error message and bounds it', () => {
    expect(safeError(new Error('Mailbox karima.benali@example.com\n rejected'))).toBe('Mailbox [adresse] rejected');
    expect(safeError(new Error('x'.repeat(1000))).length).toBe(300);
  });
});
