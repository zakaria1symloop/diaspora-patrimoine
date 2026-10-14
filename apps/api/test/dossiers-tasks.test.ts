// Packages 3.7 « Dossier » and 3.8 « Tâches et rendez-vous » — pure rules: the access of every route (SEC-030, API-100),
// the conditions of qualification (CYC-021, API-102), what the dossier waits for (PIP-021), the frieze (PIP-020), the
// stage deadline (CAL-062), stepping back and reopening (CYC-036, CYC-037), closing (CYC-035), deletion (MOD-312), the
// client's answers (INT-004, CYC-070, CYC-071), visits and their effect on a considered property (CYC-080), the groups
// and postponement of tasks (TAC-001, TAC-005), the client's hour (TAC-043), the morning summary (NOT-060 § 6.7), the
// rule seeds of both packages (AUT-032, AUT-043, AUT-051).
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { isPermission } from '@dp/contracts';
import type { BusinessCalendar } from '@dp/domain';
import { parseRuleDefinition } from '../src/automation/rule-definition.js';
import { AGENDA_RULE_SEEDS } from '../src/automation/rule-seeds-agenda.js';
import { DOSSIER_RULE_SEEDS } from '../src/automation/rule-seeds-dossier.js';
import { seedDefinition } from '../src/automation/rule-seeds.js';
import { visitEffectTarget } from '../src/dossiers-admin/candidate-effects.js';
import {
  clientActions,
  closeNotifiesByDefault,
  deletable,
  friezeOf,
  leadOutcomeOnClose,
  mainAction,
  moveBackTarget,
  nextOf,
  qualificationConditions,
  reopenStage,
  retainRefusal,
  slaOf,
  type NextFacts,
  type PropertyState,
} from '../src/dossiers-admin/dossier-rules.js';
import { ClientCandidatesController, DossiersAdminController } from '../src/dossiers-admin/dossiers-admin.controller.js';
import { ACCESS_KEY, PERMISSION_KEY } from '../src/identity/access.js';
import { digestBlock } from '../src/tasks-admin/agenda-jobs.js';
import { zoneLabel } from '../src/tasks-admin/agenda-notifications.js';
import { earlyOrLateHour, effectOf } from '../src/tasks-admin/appointments.service.js';
import { groupOf } from '../src/tasks-admin/task-group.js';
import { postponeDay } from '../src/tasks-admin/tasks-admin.service.js';
import { AppointmentsAdminController, ClientAppointmentsController, TasksAdminController } from '../src/tasks-admin/tasks-admin.controller.js';

type Ctor = new (...args: never[]) => unknown;
const handlers = (c: Ctor) => Object.getOwnPropertyNames(c.prototype).filter((n) => n !== 'constructor' && Reflect.getMetadata('path', (c.prototype as Record<string, unknown>)[n] as object) !== undefined);
const metaOf = (c: Ctor, m: string, key: string) => Reflect.getMetadata(key, (c.prototype as Record<string, unknown>)[m] as object) ?? Reflect.getMetadata(key, c);

describe('SEC-030, API-100 — every route of 3.7 and 3.8 declares its access', () => {
  it('back-office routes: STAFF of the ADMIN audience, each with a permission of the catalogue (ROL-020)', () => {
    for (const c of [DossiersAdminController, TasksAdminController, AppointmentsAdminController] as Ctor[]) {
      const names = handlers(c);
      expect(names.length, c.name).toBeGreaterThan(5);
      for (const m of names) {
        expect(metaOf(c, m, ACCESS_KEY), `${c.name}.${m}`).toEqual({ audience: 'ADMIN', kind: 'STAFF' });
        const p = Reflect.getMetadata(PERMISSION_KEY, (c.prototype as Record<string, unknown>)[m] as object);
        expect(isPermission(p), `${c.name}.${m} → ${p}`).toBe(true);
      }
    }
  });
  it('client routes: CLIENT of the WEB audience (EC-12, EC-13, EC-14)', () => {
    for (const c of [ClientCandidatesController, ClientAppointmentsController] as Ctor[]) for (const m of handlers(c)) expect(metaOf(c, m, ACCESS_KEY), `${c.name}.${m}`).toEqual({ audience: 'WEB', kind: 'CLIENT' });
  });
  it('the gestures follow their own permissions (PIP-021, TAC-004)', () => {
    const p = (c: Ctor, m: string) => Reflect.getMetadata(PERMISSION_KEY, (c.prototype as Record<string, unknown>)[m] as object);
    expect(p(DossiersAdminController, 'assign')).toBe('dossier.assign');
    expect(p(DossiersAdminController, 'close')).toBe('dossier.close');
    expect(p(DossiersAdminController, 'moveBack')).toBe('dossier.transition.backward');
    expect(p(DossiersAdminController, 'remove')).toBe('dossier.delete');
    expect(p(DossiersAdminController, 'confirmSelection')).toBe('candidate.manage');
    expect(p(TasksAdminController, 'list')).toBe('task.read');
    expect(p(TasksAdminController, 'bulk')).toBe('task.manage');
    expect(p(AppointmentsAdminController, 'agenda')).toBe('appointment.read');
    expect(p(AppointmentsAdminController, 'correct')).toBe('appointment.manage');
  });
});

const client = { firstName: 'Nadia', lastName: 'Benali', countryOfResidence: 'FR', residencyStatus: 'NON_RESIDENT', budgetMax: '180000', budgetMonthly: null, downPayment: '0', financingPreference: 'CONVENTIONAL', purchaseTimeframe: 'M6_12', doNotContact: false };

describe('CYC-021, API-102 — the conditions of qualification', () => {
  it('all met with a first contact and a complete record; a down payment of 0 counts', () => {
    expect(qualificationConditions({ firstContactAt: new Date(), client }).every((c) => c.met)).toBe(true);
  });
  it('lists each missing condition by its code', () => {
    const missing = qualificationConditions({ firstContactAt: null, client: { ...client, budgetMax: null, purchaseTimeframe: ' ', doNotContact: true } })
      .filter((c) => !c.met)
      .map((c) => c.code);
    expect(missing).toEqual(['FIRST_CONTACT', 'CLIENT_BUDGET', 'CLIENT_TIMEFRAME', 'CLIENT_CONTACT_ALLOWED']);
  });
  it('a monthly budget is enough', () => {
    expect(qualificationConditions({ firstContactAt: new Date(), client: { ...client, budgetMax: null, budgetMonthly: 900 } }).find((c) => c.code === 'CLIENT_BUDGET')?.met).toBe(true);
  });
});

describe('PIP-021, CYC-034 — the main action and what the dossier waits for', () => {
  const base: NextFacts = { stage: 'MATCHING', status: 'OPEN', assignedAgentId: 'a', firstContactAt: new Date(), holdUntil: null, candidates: { live: 0, drafts: 0, waitingAnswer: 0, selectionRequested: null, selected: null, interested: 0, nextVisit: null } };
  it('main action', () => {
    expect(mainAction({ stage: 'INTEREST', status: 'OPEN' })).toBe('TAKE');
    expect(mainAction({ stage: 'QUALIFICATION', status: 'OPEN' })).toBe('QUALIFY');
    expect(mainAction({ stage: 'MATCHING', status: 'ON_HOLD' })).toBe('RESUME');
    expect(mainAction({ stage: 'MATCHING', status: 'LOST' })).toBeNull();
  });
  it('the next step, in the order of PIP-021', () => {
    expect(nextOf({ ...base, stage: 'QUALIFICATION', firstContactAt: null }).code).toBe('FIRST_CONTACT');
    expect(nextOf({ ...base, stage: 'QUALIFICATION' }).code).toBe('QUALIFY');
    expect(nextOf({ ...base, assignedAgentId: null }).code).toBe('TAKE');
    expect(nextOf(base).code).toBe('PROPOSE');
    expect(nextOf({ ...base, candidates: { ...base.candidates, drafts: 2 } }).code).toBe('SEND_PROPOSALS');
    expect(nextOf({ ...base, candidates: { ...base.candidates, waitingAnswer: 2 } })).toMatchObject({ code: 'AWAIT_ANSWER', waitingOn: 'CLIENT' });
    expect(nextOf({ ...base, candidates: { ...base.candidates, interested: 1, waitingAnswer: 1 } }).code).toBe('SELECT');
    expect(nextOf({ ...base, candidates: { ...base.candidates, selectionRequested: { title: 'T3' }, selected: { title: 'T2' } } })).toMatchObject({ code: 'CONFIRM_SELECTION', property: 'T3' });
    expect(nextOf({ ...base, candidates: { ...base.candidates, selected: { title: 'T2' } } }).code).toBe('BUILD_FILE');
    expect(nextOf({ ...base, status: 'ON_HOLD', holdUntil: new Date('2026-11-02T00:00:00Z') })).toMatchObject({ code: 'RESUME', at: '2026-11-02' });
    expect(nextOf({ ...base, status: 'WON' }).code).toBe('NONE');
  });
});

describe('PIP-020 — the frieze', () => {
  it('done, current, to do; the bank stages of a dossier without financing are skipped (CYC-024)', () => {
    const at = (d: string) => new Date(`2026-10-${d}T10:00:00Z`);
    const steps = friezeOf({ stage: 'MATCHING', status: 'OPEN', financingRequested: false, stageEnteredAt: at('05') }, [
      { toStage: 'INTEREST', changedAt: at('01') },
      { toStage: 'QUALIFICATION', changedAt: at('02') },
      { toStage: 'MATCHING', changedAt: at('03') },
    ]);
    expect(steps.map((s) => s.state)).toEqual(['DONE', 'DONE', 'CURRENT', 'TODO', 'SKIPPED', 'SKIPPED', 'TODO']);
    expect(steps[2]!.enteredAt).toBe(at('05').toISOString());
    expect(steps[3]!.enteredAt).toBeNull();
  });
});

describe('CAL-062 — the stage deadline in business days', () => {
  const cal: BusinessCalendar = { timeZone: 'Europe/Paris', workdays: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', holidays: [] };
  it('paused on hold, none when closed, due or late otherwise', () => {
    const now = new Date('2026-10-14T10:00:00Z'); // a Wednesday
    expect(slaOf({ status: 'ON_HOLD', slaDueAt: now }, now, cal)).toEqual({ state: 'PAUSED' });
    expect(slaOf({ status: 'LOST', slaDueAt: now }, now, cal)).toEqual({ state: 'NONE' });
    expect(slaOf({ status: 'OPEN', slaDueAt: new Date('2026-10-16T10:00:00Z') }, now, cal)).toMatchObject({ state: 'DUE', businessDaysLeft: 2 });
    expect(slaOf({ status: 'OPEN', slaDueAt: new Date('2026-10-12T10:00:00Z') }, now, cal)).toMatchObject({ state: 'LATE', businessDaysLate: 2 });
  });
});

describe('CYC-035, CYC-036, CYC-037, MOD-312 — closing, reopening, stepping back, deleting', () => {
  it('step back targets', () => {
    expect(moveBackTarget('MATCHING', true)).toBe('QUALIFICATION');
    expect(moveBackTarget('ACQUISITION', true)).toBe('APPROVED');
    expect(moveBackTarget('ACQUISITION', false)).toBe('DOCUMENTS');
    expect(moveBackTarget('APPROVED', true)).toBeNull();
    expect(moveBackTarget('INTEREST', true)).toBeNull();
  });
  it('reopening: the most advanced stage whose conditions hold, never beyond the stage at closing', () => {
    const f = { closedAt: 'MATCHING', retainedAvailable: false, hasRetained: false, clientQualified: true, dossierQualified: true, agentActive: true };
    expect(reopenStage(f)).toBe('MATCHING');
    expect(reopenStage({ ...f, closedAt: 'QUALIFICATION' })).toBe('QUALIFICATION');
    expect(reopenStage({ ...f, clientQualified: false, dossierQualified: false })).toBe('QUALIFICATION');
    expect(reopenStage({ ...f, agentActive: false })).toBe('INTEREST');
    expect(reopenStage({ ...f, closedAt: 'BANK_REVIEW', hasRetained: true, retainedAvailable: true })).toBe('DOCUMENTS');
  });
  it('the requests of a closed dossier, and the e-mail ticked by default', () => {
    expect(leadOutcomeOnClose('UNREACHABLE')).toBe('UNREACHABLE');
    expect(leadOutcomeOnClose('BOUGHT_ELSEWHERE')).toBe('NOT_INTERESTED');
    expect(leadOutcomeOnClose('BUDGET')).toBe('ANSWERED');
    expect(closeNotifiesByDefault('DUPLICATE')).toBe(false);
    expect(closeNotifiesByDefault('CLIENT_WITHDREW')).toBe(false);
    expect(closeNotifiesByDefault('BUDGET')).toBe(true);
  });
  it('deletion only at INTEREST or QUALIFICATION, without piece nor submission', () => {
    expect(deletable({ stage: 'QUALIFICATION', status: 'OPEN' }, 0, 0)).toBe(true);
    expect(deletable({ stage: 'MATCHING', status: 'OPEN' }, 0, 0)).toBe(false);
    expect(deletable({ stage: 'INTEREST', status: 'OPEN' }, 1, 0)).toBe(false);
  });
});

describe('INT-004, CYC-070, CYC-071, CYC-121 — the client answers a proposal', () => {
  const p: PropertyState = { publication: 'PUBLISHED', deletedAt: null, archivedAt: null, availability: 'AVAILABLE', lotsAvailable: 2, online: true };
  const sent = { status: 'PROPOSED', origin: 'STAFF', sentAt: new Date(), selectionRequestedAt: null };
  const matching = { stage: 'MATCHING', status: 'OPEN' };
  it('a property may be retained only published with an available lot', () => {
    expect(retainRefusal(p)).toBeNull();
    expect(retainRefusal({ ...p, online: false })).toBe('PROPERTY_OFFLINE');
    expect(retainRefusal({ ...p, lotsAvailable: 0 })).toBe('PROPERTY_NOT_AVAILABLE');
    expect(retainRefusal({ ...p, availability: 'SOLD' })).toBe('PROPERTY_NOT_AVAILABLE');
  });
  it('« Ce bien m’intéresse », « Ne m’intéresse plus », « Je retiens ce bien », « Annuler mon choix »', () => {
    expect(clientActions(sent, matching, p)).toEqual({ interested: true, decline: true, selectRequest: false, cancelSelect: false, visit: false });
    expect(clientActions({ ...sent, status: 'INTERESTED' }, matching, p)).toMatchObject({ interested: false, selectRequest: true });
    expect(clientActions({ ...sent, status: 'INTERESTED', selectionRequestedAt: new Date() }, matching, p)).toMatchObject({ selectRequest: false, cancelSelect: true });
    expect(clientActions({ ...sent, status: 'DECLINED' }, matching, p)).toMatchObject({ interested: true, decline: false });
    // a draft never reaches the client; a dossier on hold accepts no « Je retiens »
    expect(clientActions({ ...sent, sentAt: null }, matching, p)).toEqual({ interested: false, decline: false, selectRequest: false, cancelSelect: false, visit: false });
    expect(clientActions({ ...sent, status: 'INTERESTED' }, { stage: 'MATCHING', status: 'ON_HOLD' }, p).selectRequest).toBe(false);
    expect(clientActions({ ...sent, status: 'INTERESTED' }, { stage: 'MATCHING', status: 'LOST' }, p).interested).toBe(false);
  });
  it('« Demander une visite » on an interest or a property visited, still offered, on a live dossier', () => {
    expect(clientActions({ ...sent, status: 'INTERESTED' }, matching, p).visit).toBe(true);
    expect(clientActions({ ...sent, status: 'VISITED' }, matching, p).visit).toBe(true);
    // a visit already asked or planned has its own state; a property no longer offered cannot be visited
    expect(clientActions({ ...sent, status: 'VISIT_PLANNED' }, matching, p).visit).toBe(false);
    expect(clientActions({ ...sent, status: 'INTERESTED' }, matching, { ...p, availability: 'SOLD' }).visit).toBe(false);
    expect(clientActions({ ...sent, status: 'INTERESTED' }, { stage: 'MATCHING', status: 'WON' }, p).visit).toBe(false);
  });
});

describe('CYC-080, TAC-042 — an appointment and its considered property', () => {
  it('confirmed → visit planned, held → visited, cancelled or not held → back to interested', () => {
    expect(effectOf('CONFIRMED')).toBe('PLANNED');
    expect(effectOf('DONE')).toBe('DONE');
    expect(effectOf('NO_SHOW')).toBe('RELEASED');
    expect(visitEffectTarget('INTERESTED', 'PLANNED')).toBe('VISIT_PLANNED');
    expect(visitEffectTarget('VISIT_PLANNED', 'DONE')).toBe('VISITED');
    expect(visitEffectTarget('VISIT_PLANNED', 'RELEASED')).toBe('INTERESTED');
    expect(visitEffectTarget('SELECTED', 'RELEASED')).toBeNull();
    expect(visitEffectTarget('DECLINED', 'PLANNED')).toBeNull();
  });
  it('TAC-043 — the client’s hour is announced before 8:00 and from 21:00', () => {
    expect(earlyOrLateHour(new Date('2026-10-14T05:30:00Z'), 'Europe/Paris')).toBe('7 h 30');
    expect(earlyOrLateHour(new Date('2026-10-14T19:00:00Z'), 'Europe/Paris')).toBe('21 h 00');
    expect(earlyOrLateHour(new Date('2026-10-14T08:00:00Z'), 'Europe/Paris')).toBeNull();
  });
  it('TRV-031 — the zone in words', () => {
    expect(zoneLabel('Europe/Paris')).toBe('heure de Paris');
    expect(zoneLabel('Africa/Algiers')).toMatch(/^heure d’/);
  });
});

describe('TAC-001, TAC-005 — groups and postponement of tasks', () => {
  const now = new Date('2026-10-14T10:00:00Z'); // Wednesday, 12:00 in Paris
  const tz = 'Europe/Paris';
  it('a task without hour is late only the day after; with an hour, as soon as it passed', () => {
    expect(groupOf({ status: 'OPEN', dueAt: new Date('2026-10-13T22:00:00Z'), dueHasTime: false }, now, tz)).toBe('TODAY');
    expect(groupOf({ status: 'OPEN', dueAt: new Date('2026-10-14T08:00:00Z'), dueHasTime: true }, now, tz)).toBe('OVERDUE');
    expect(groupOf({ status: 'OPEN', dueAt: new Date('2026-10-12T22:00:00Z'), dueHasTime: false }, now, tz)).toBe('OVERDUE');
    expect(groupOf({ status: 'OPEN', dueAt: new Date('2026-10-15T08:00:00Z'), dueHasTime: true }, now, tz)).toBe('TOMORROW');
    expect(groupOf({ status: 'OPEN', dueAt: new Date('2026-10-18T08:00:00Z'), dueHasTime: true }, now, tz)).toBe('WEEK');
    expect(groupOf({ status: 'OPEN', dueAt: new Date('2026-10-19T08:00:00Z'), dueHasTime: true }, now, tz)).toBe('LATER');
    expect(groupOf({ status: 'OPEN', dueAt: null, dueHasTime: false }, now, tz)).toBe('NONE');
    expect(groupOf({ status: 'DONE', dueAt: null, dueHasTime: false }, now, tz)).toBe('CLOSED');
  });
  it('« Reporter » : demain, dans 3 jours, lundi prochain, une date', () => {
    expect(postponeDay('TOMORROW', '2026-10-14')).toBe('2026-10-15');
    expect(postponeDay('IN_3_DAYS', '2026-10-14')).toBe('2026-10-17');
    expect(postponeDay('NEXT_WEEK', '2026-10-14')).toBe('2026-10-19');
    expect(postponeDay('NEXT_WEEK', '2026-10-19')).toBe('2026-10-26');
    expect(postponeDay('2026-11-03', '2026-10-14')).toBe('2026-11-03');
  });
});

describe('NOT-060 § 6.7 — the morning summary', () => {
  it('leaves out the empty sections, counts each one, escapes the lines', () => {
    expect(digestBlock([{ key: 'overdue', lines: [] }])).toBeNull();
    const b = digestBlock([
      { key: 'overdue', lines: ['Appeler <Nadia>'] },
      { key: 'today', lines: [] },
    ])!;
    expect(b.text).toContain('(1)');
    expect(b.text).not.toContain('aujourd');
    expect(b.html).toContain('&lt;Nadia&gt;');
  });
});

describe('AUT-032, AUT-043, AUT-051 — the rules seeded by 3.7 and 3.8 are valid definitions', () => {
  it('each seed parses', () => {
    const seeds = [...DOSSIER_RULE_SEEDS, ...AGENDA_RULE_SEEDS];
    expect(seeds.map((s) => s.code)).toEqual(expect.arrayContaining(['R_SELECTION_REQUESTED', 'R_PROPOSAL_REMINDER', 'R_APPOINTMENT_REMINDER', 'R_VISIT_HOST_CANCELLED', 'R_EMAIL_BOUNCED']));
    for (const seed of seeds) {
      const r = parseRuleDefinition(seedDefinition(seed));
      expect(r.ok, `${seed.code}: ${JSON.stringify(r)}`).toBe(true);
    }
  });
});
