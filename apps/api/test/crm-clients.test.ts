// Packages 3.2 « Demandes : traitement » and 3.3 « Clients » — pure rules: the access declared by each route (SEC-030,
// API-100, BO-005), what a caller may do on a request (BO-047, CRM-011, CYC-008) and on a client's account (CRM-070,
// CRM-075), the first contact (CYC-004), the merge (CRM-080: kept record, values, protections, consents), the
// hand-written e-mail templates (COM-020), the absence (BO-013), the simulations listed on the record (CRM-046).
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { clientAccountReasonSchema, clientChangeEmailSchema, clientPreviewCodeSchema, isPermission, previewExchangeSchema, staffClientCreateSchema, type Permission } from '@dp/contracts';
import { ACCESS_KEY, PERMISSION_KEY, REAUTH_KEY } from '../src/identity/access.js';
import { absenceToStore, currentAbsence } from '../src/back-office/absence.js';
import { LEAD_REOPEN_DAYS, leadCan, scoreLevel, type LeadState } from '../src/back-office/leads-admin.service.js';
import { ClientAccountAdminController, ClientPreviewController, PreviewExchangeController } from '../src/client-account-admin/client-account-admin.module.js';
import { accountCan, accountStateOf } from '../src/client-account-admin/client-account.service.js';
import { ClientsAdminController } from '../src/clients-admin/clients-admin.module.js';
import { accountState } from '../src/clients-admin/clients-read.service.js';
import { ClientsMergeController } from '../src/clients-merge-admin/clients-merge-admin.module.js';
import { keptRecord, latestConsents, mergeFields, protections, resolvedColumns, type MergeSide } from '../src/clients-merge-admin/merge-rules.js';
import { absentOn } from '../src/crm/advisors.js';
import { AdvisorsController } from '../src/crm/crm.module.js';
import { enteredAsAlreadyContacted, firstFactFor } from '../src/crm/first-contact.js';
import { ExchangesController, ManualEmailController } from '../src/exchanges-admin/exchanges-admin.module.js';
import { fillTemplate } from '../src/exchanges-admin/manual-email.service.js';
import { LEAD_PROCESSING_RULE_SEEDS } from '../src/leads-admin/lead-rules.js';
import { LEAD_PROCESSING_TEMPLATE_SEEDS } from '../src/leads-admin/lead-templates.js';
import { LeadObjectsController, LeadsProcessingController } from '../src/leads-admin/leads-admin.module.js';
import { SimulationsAdminController } from '../src/simulations-admin/simulations-admin.module.js';
import { listedSimulation } from '../src/simulations-admin/simulations-admin.service.js';

type Ctor = new (...args: never[]) => unknown;
const proto = (c: Ctor, m: string) => (c.prototype as Record<string, unknown>)[m] as object;
const meta = (c: Ctor, m: string, key: string) => Reflect.getMetadata(key, proto(c, m)) ?? Reflect.getMetadata(key, c);

describe('SEC-030, API-100 — every route of packages 3.2 and 3.3 declares its access', () => {
  const expected: [Ctor, Record<string, Permission | null>][] = [
    [LeadsProcessingController, { create: 'lead.create', bulk: 'lead.process', take: 'lead.process', assign: 'lead.assign', release: 'lead.process', close: 'lead.process', reopen: 'lead.process', spam: 'lead.process', restore: 'lead.process', review: 'lead.process', openDossier: 'dossier.create', attach: 'dossier.create' }],
    [LeadObjectsController, { list: 'lead.create' }],
    [ExchangesController, { create: 'communication.log', received: 'communication.log', update: 'communication.log', remove: 'communication.log', announce: 'communication.log', content: 'communication.log', complete: 'communication.log', attachment: 'client.read' }],
    [ManualEmailController, { compose: 'email.send', preview: 'email.send', send: 'email.send', cancel: 'email.send', announce: 'email.send', content: 'email.send', complete: 'email.send' }],
    [AdvisorsController, { list: 'user.read' }],
    [
      ClientsAdminController,
      {
        list: 'client.read', check: 'client.read', create: 'client.create', bulk: 'client.read', detail: 'client.read', project: 'client.read', leads: 'client.read', dossiers: 'client.read', favorites: 'client.read', registrations: 'client.read', feedback: 'client.read', contacts: 'client.read', consents: 'client.read', timeline: 'client.read',
        update: 'client.update', doNotContact: 'client.update', confirmPhone: 'client.update', confirmEmail: 'client.update', archive: 'client.archive', unarchive: 'client.archive', assign: 'client.assign', addContact: 'client.update', updateContact: 'client.update', deleteContact: 'client.update',
      },
    ],
    [ClientsMergeController, { notDuplicate: 'client.update', preview: 'client.merge', doMerge: 'client.merge', differences: 'client.read', apply: 'client.update' }],
    [ClientAccountAdminController, { read: 'client.read', invite: 'client.invite', suspend: 'client.account.manage', reactivate: 'client.account.manage', revokeSessions: 'client.account.manage', disableTwoFactor: 'client.account.manage', changeEmail: 'client.account.manage', previewCode: 'client.impersonate' }],
    [SimulationsAdminController, { list: 'simulation.read', prefill: 'simulation.create', compute: 'simulation.create', create: 'simulation.create', attach: 'simulation.create', detach: 'simulation.create' }],
  ];

  it('each handler is a STAFF route of the ADMIN audience, with the permission of API-100 / API-101', () => {
    for (const [controller, routes] of expected) {
      const declared = Object.getOwnPropertyNames(controller.prototype).filter((n) => n !== 'constructor' && Reflect.getMetadata('path', proto(controller, n)) !== undefined);
      expect(declared.sort(), controller.name).toEqual(Object.keys(routes).sort());
      for (const [method, permission] of Object.entries(routes)) {
        expect(meta(controller, method, ACCESS_KEY), `${controller.name}.${method}`).toEqual({ audience: 'ADMIN', kind: 'STAFF' });
        expect(Reflect.getMetadata(PERMISSION_KEY, proto(controller, method)) ?? null, `${controller.name}.${method}`).toBe(permission);
        if (permission) expect(isPermission(permission)).toBe(true);
      }
    }
  });

  it('BO-005, AUTH-051 — switching off a client’s second factor asks for a recent password; nothing else of the account does', () => {
    const methods = Object.keys(expected[7]![1]);
    expect(methods.filter((m) => meta(ClientAccountAdminController, m, REAUTH_KEY) === true)).toEqual(['disableTwoFactor']);
  });

  it('ROL-017 — the preview state is read by a client session; the code is exchanged anonymously (the code is the proof)', () => {
    expect(meta(ClientPreviewController, 'state', ACCESS_KEY)).toEqual({ audience: 'WEB', kind: 'CLIENT' });
    expect(Reflect.getMetadata(ACCESS_KEY, proto(PreviewExchangeController, 'exchange')) ?? Reflect.getMetadata(ACCESS_KEY, PreviewExchangeController) ?? null).toBeNull();
  });
});

// ─── BO-047 on a request ─────────────────────────────────────────────────────

const NOW = new Date('2026-10-12T08:00:00Z');
const me = 'u-me';
const staffWith = (perms: Permission[], role = 'AGENT') => ({ userId: me, role: role as never, has: (p: Permission) => perms.includes(p) });
const AGENT = staffWith(['lead.process', 'lead.assign', 'dossier.create']);
const lead = (over: Partial<LeadState> = {}): LeadState => ({ kind: 'CONTACT_MESSAGE', status: 'NEW', assignedAgentId: null, firstContactAt: null, needsReview: false, applicationStatus: null, dossierId: null, clientId: 'c-1', closedById: null, closedAt: null, liveDossiers: 0, ...over });

describe('CRM-011, BO-047 — what a caller may do on a request', () => {
  it('« Prendre » a new unassigned request; refused with its reason once taken', () => {
    expect(leadCan(lead(), AGENT, NOW).take).toEqual({ allowed: true });
    expect(leadCan(lead({ status: 'IN_PROGRESS', assignedAgentId: 'u-other' }), AGENT, NOW).take).toEqual({ allowed: false, reason: 'ALREADY_TAKEN' });
    expect(leadCan(lead({ status: 'IN_PROGRESS', assignedAgentId: me }), AGENT, NOW).take).toEqual({ allowed: false, reason: 'ALREADY_MINE' });
  });

  it('CYC-003 — « Libérer » only mine (or Direction / administrator), in progress, before the first contact', () => {
    expect(leadCan(lead({ status: 'IN_PROGRESS', assignedAgentId: me }), AGENT, NOW).release).toEqual({ allowed: true });
    expect(leadCan(lead({ status: 'IN_PROGRESS', assignedAgentId: me, firstContactAt: NOW }), AGENT, NOW).release).toEqual({ allowed: false, reason: 'FIRST_CONTACT_DONE' });
    expect(leadCan(lead({ status: 'IN_PROGRESS', assignedAgentId: 'u-other' }), AGENT, NOW).release).toBeUndefined();
    expect(leadCan(lead({ status: 'IN_PROGRESS', assignedAgentId: 'u-other' }), staffWith(['lead.process'], 'ADMIN'), NOW).release).toEqual({ allowed: true });
  });

  it('CYC-008 — reopened within 90 days when closed by hand, never when attached to a dossier or closed automatically', () => {
    const closedAt = new Date(NOW.getTime() - 10 * 86_400_000);
    expect(leadCan(lead({ status: 'CLOSED', closedById: me, closedAt }), AGENT, NOW).reopen).toEqual({ allowed: true });
    expect(leadCan(lead({ status: 'CLOSED', closedById: null, closedAt }), AGENT, NOW).reopen).toEqual({ allowed: false, reason: 'CLOSED_AUTOMATICALLY' });
    expect(leadCan(lead({ status: 'CLOSED', closedById: me, closedAt, dossierId: 'd-1' }), AGENT, NOW).reopen).toEqual({ allowed: false, reason: 'ATTACHED_TO_DOSSIER' });
    expect(leadCan(lead({ status: 'CLOSED', closedById: me, closedAt: new Date(NOW.getTime() - (LEAD_REOPEN_DAYS + 1) * 86_400_000) }), AGENT, NOW).reopen).toEqual({ allowed: false, reason: 'TOO_OLD' });
  });

  it('CYC-006 — undesirable while open, restored from SPAM; an action the role does not hold is absent', () => {
    expect(leadCan(lead(), AGENT, NOW).spam).toEqual({ allowed: true });
    expect(leadCan(lead({ status: 'SPAM' }), AGENT, NOW).restore).toEqual({ allowed: true });
    const viewer = leadCan(lead(), staffWith([], 'VIEWER'), NOW);
    expect(Object.keys(viewer)).toEqual([]);
  });

  it('CRM-012 — « Ouvrir un dossier » for a contact message or when the client has dossiers; « Rattacher » needs a live dossier', () => {
    expect(leadCan(lead(), AGENT, NOW).openDossier).toEqual({ allowed: true });
    expect(leadCan(lead(), AGENT, NOW).attach).toBeUndefined();
    expect(leadCan(lead({ liveDossiers: 1 }), AGENT, NOW).attach).toEqual({ allowed: true });
    expect(leadCan(lead({ clientId: null }), AGENT, NOW).openDossier).toEqual({ allowed: false, reason: 'NO_CLIENT' });
    expect(leadCan(lead({ kind: 'PARTNER_REQUEST' }), AGENT, NOW).openDossier).toBeUndefined();
  });

  it('a partner application is never taken, released, closed or assigned here (ACP-084)', () => {
    const can = leadCan(lead({ applicationStatus: 'PENDING' }), AGENT, NOW);
    expect(can.take).toBeUndefined();
    expect(can.close).toBeUndefined();
    expect(can.assign).toBeUndefined();
  });

  it('CAL-070 — the score level: hot from 70, warm from 40, cold below', () => {
    expect(scoreLevel(85)).toBe('HOT');
    expect(scoreLevel(55)).toBe('WARM');
    expect(scoreLevel(10)).toBe('COLD');
    expect(scoreLevel(null)).toBeNull();
  });
});

// ─── CYC-004 first contact ───────────────────────────────────────────────────

describe('CYC-004 — the first contact of a request', () => {
  const created = new Date('2026-10-10T10:00:00Z');
  const base = { id: 'l-1', createdAt: created, closedAt: null, payload: {} };

  it('CRM-025 — a request entered as « déjà contactée » is contacted at its creation', () => {
    expect(enteredAsAlreadyContacted({ staffEntry: { alreadyContacted: true } })).toBe(true);
    expect(enteredAsAlreadyContacted({ staffEntry: { alreadyContacted: false } })).toBe(false);
    expect(firstFactFor({ ...base, payload: { staffEntry: { alreadyContacted: true } } }, [])).toEqual({ at: created, channel: 'STAFF_ENTRY', leadId: 'l-1' });
  });

  it('a fact before the request never counts; one on another request does not either', () => {
    const before = { at: new Date(created.getTime() - 60_000), channel: 'PHONE', leadId: null };
    const other = { at: new Date(created.getTime() + 60_000), channel: 'PHONE', leadId: 'l-2' };
    expect(firstFactFor(base, [before, other])).toBeNull();
  });

  it('a fact on the client while the request is open counts; after its closing, no longer', () => {
    const after = { at: new Date(created.getTime() + 3_600_000), channel: 'PHONE', leadId: null };
    expect(firstFactFor(base, [after])).toEqual(after);
    expect(firstFactFor({ ...base, closedAt: new Date(created.getTime() + 60_000) }, [after])).toBeNull();
  });
});

// ─── CRM-080 merge ───────────────────────────────────────────────────────────

describe('CRM-080 — merge rules', () => {
  const side = (id: string, over: Partial<MergeSide> = {}): MergeSide => ({ id, createdAt: new Date('2026-01-01T00:00:00Z'), hasAccount: false, gdprErasedAt: null, mergedIntoId: null, deletedAt: null, ...over });

  it('rule 1 — the record with an account is kept; both with an account: refused; none: chosen, else the oldest', () => {
    expect(keptRecord(side('a'), side('b', { hasAccount: true }))).toEqual({ keepId: 'b', rule: 'ACCOUNT' });
    expect(keptRecord(side('a', { hasAccount: true }), side('b', { hasAccount: true }))).toEqual({ refusal: 'BOTH_ACCOUNTS' });
    expect(keptRecord(side('a', { createdAt: new Date('2026-05-01T00:00:00Z') }), side('b'))).toEqual({ keepId: 'b', rule: 'CHOSEN' });
    expect(keptRecord(side('a'), side('b'), 'b')).toEqual({ keepId: 'b', rule: 'CHOSEN' });
    // with an account the choice is ignored
    expect(keptRecord(side('a', { hasAccount: true }), side('b'), 'b')).toEqual({ keepId: 'a', rule: 'ACCOUNT' });
  });

  it('rule 2 — a value present on one side only is taken; two different values are a choice, the kept one by default', () => {
    const keep = { firstName: 'Samir', lastName: 'Benali', phone: null, countryOfResidence: 'FR' };
    const other = { firstName: 'Samir', lastName: 'Ben Ali', phone: '+33612345678', countryOfResidence: 'FR' };
    const fields = mergeFields(keep, other, true);
    expect(fields.find((f) => f.key === 'lastName')).toMatchObject({ differs: true, defaultSide: 'KEEP' });
    expect(fields.find((f) => f.key === 'firstName')).toMatchObject({ differs: false });
    expect(fields.find((f) => f.key === 'phone')).toMatchObject({ differs: false, keep: null, other: '+33612345678', defaultSide: 'OTHER' });
    const cols = resolvedColumns(keep, other, { lastName: 'OTHER' });
    expect(cols).toMatchObject({ lastName: 'Ben Ali', phone: '+33612345678', firstName: 'Samir' });
  });

  it('ROL-019 — the sensitive fields are withheld without `client.sensitive.read`', () => {
    const f = mergeFields({ downPayment: '1000.00', downPaymentCurrency: 'EUR' }, { downPayment: '2000.00', downPaymentCurrency: 'EUR' }, false).find((x) => x.key === 'downPayment');
    expect(f).toMatchObject({ withheld: true, keep: null, other: null, differs: false });
  });

  it('rule 4 — what protects the person wins: « Ne pas contacter », the limitation, « Téléphone à vérifier »', () => {
    const p = protections({ doNotContact: false, phoneCheckNeeded: false }, { doNotContact: true, doNotContactReason: 'Demande orale', doNotContactAt: NOW, restrictedAt: NOW, restrictionReason: 'REQUEST', phoneCheckNeeded: true }, null);
    expect(p).toMatchObject({ doNotContact: true, doNotContactReason: 'Demande orale', restrictionReason: 'REQUEST', phoneCheckNeeded: true });
  });

  it('a rejection of the address is kept only for the address that stays', () => {
    const at = new Date('2026-09-01T00:00:00Z');
    expect(protections({ email: 'a@example.test' }, { email: 'b@example.test', emailBouncedAt: at }, 'a@example.test').emailBouncedAt).toBeNull();
    expect(protections({ email: 'a@example.test', emailBouncedAt: at }, { email: 'b@example.test' }, 'a@example.test').emailBouncedAt).toEqual(at);
  });

  it('consents — for each type the most recent line counts (a recent withdrawal beats an old agreement)', () => {
    const rows = [
      { type: 'MARKETING', givenAt: new Date('2026-01-01T00:00:00Z'), granted: true },
      { type: 'MARKETING', givenAt: new Date('2026-06-01T00:00:00Z'), granted: false },
      { type: 'TERMS', givenAt: new Date('2026-02-01T00:00:00Z'), granted: true },
    ];
    const latest = latestConsents(rows);
    expect(latest.get('MARKETING')?.granted).toBe(false);
    expect(latest.get('TERMS')?.granted).toBe(true);
  });
});

// ─── CRM-070, CRM-075 account ────────────────────────────────────────────────

describe('CRM-070, CRM-075 — the account of a client', () => {
  const OA = { has: (p: Permission) => ['client.invite', 'client.account.manage', 'client.impersonate'].includes(p), masked: false };
  const AG = { has: (p: Permission) => ['client.invite', 'client.impersonate'].includes(p), masked: false };
  const verified = { twoFactorEnabled: false, suspendedReason: null, emailVerifiedAt: NOW };

  it('the four states: no account, invited, active, suspended; a deleted account is « Aucun compte »', () => {
    expect(accountStateOf(null)).toBe('NONE');
    expect(accountStateOf({ status: 'DELETED' })).toBe('NONE');
    expect(accountStateOf({ status: 'INVITED' })).toBe('INVITED');
    expect(accountStateOf({ status: 'ACTIVE' })).toBe('ACTIVE');
    expect(accountStateOf({ status: 'SUSPENDED' })).toBe('SUSPENDED');
    expect(accountState({ status: 'SUSPENDED' })).toBe('SUSPENDED');
  });

  it('« Inviter » without account and with a free address; absent without e-mail (MOD-302) or when the address holds an account', () => {
    expect(accountCan(OA, 'NONE', null, null).invite).toBe(true);
    expect(accountCan(OA, 'NONE', null, 'NO_EMAIL').invite).toBe(false);
    expect(accountCan(OA, 'NONE', null, 'EMAIL_TAKEN').invite).toBe(false);
    expect(accountCan(OA, 'INVITED', { ...verified, emailVerifiedAt: null }, null)).toMatchObject({ invite: false, resend: true });
  });

  it('an adviser invites and previews, but does not manage the account (`client.account.manage`: Direction and administrators)', () => {
    const can = accountCan(AG, 'ACTIVE', verified, null);
    expect(can).toMatchObject({ suspend: false, revokeSessions: false, disableTwoFactor: false, changeEmail: false, preview: true });
  });

  it('CRM-075 — « Voir comme le client » only with an active, verified account', () => {
    expect(accountCan(OA, 'ACTIVE', verified, null).preview).toBe(true);
    expect(accountCan(OA, 'ACTIVE', { ...verified, emailVerifiedAt: null }, null).preview).toBe(false);
    expect(accountCan(OA, 'INVITED', verified, null).preview).toBe(false);
    expect(accountCan(OA, 'SUSPENDED', verified, null).preview).toBe(false);
  });

  it('CYC-200, Q-077 — « Réactiver » a suspension decided by the team, never one asked by a deletion', () => {
    expect(accountCan(OA, 'SUSPENDED', { ...verified, suspendedReason: 'STAFF_DECISION' }, null).reactivate).toBe(true);
    expect(accountCan(OA, 'SUSPENDED', { ...verified, suspendedReason: 'DELETION_PENDING' }, null).reactivate).toBe(false);
  });

  it('AUTH-051 — the second factor is switched off only when it is on', () => {
    expect(accountCan(OA, 'ACTIVE', verified, null).disableTwoFactor).toBe(false);
    expect(accountCan(OA, 'ACTIVE', { ...verified, twoFactorEnabled: true }, null).disableTwoFactor).toBe(true);
  });

  it('SEC-032 — the SUPPORT role (masked) never acts on an account', () => {
    const can = accountCan({ ...OA, masked: true }, 'ACTIVE', { ...verified, twoFactorEnabled: true }, null);
    expect([can.invite, can.suspend, can.revokeSessions, can.disableTwoFactor, can.changeEmail]).toEqual([false, false, false, false, false]);
  });

  it('CYC-200 — a suspension and a reactivation give their reason; the preview reason is optional; the code has the shape of a token', () => {
    expect(clientAccountReasonSchema.safeParse({ reason: '  ' }).success).toBe(false);
    expect(clientAccountReasonSchema.parse({ reason: ' Fraude  avérée ' }).reason).toBe('Fraude avérée');
    expect(clientPreviewCodeSchema.parse({}).reason).toBeNull();
    expect(clientPreviewCodeSchema.parse({ reason: '' }).reason).toBeNull();
    expect(previewExchangeSchema.safeParse({ code: 'short' }).success).toBe(false);
    expect(clientChangeEmailSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});

// ─── CRM-046 simulations listed on the record ────────────────────────────────

describe('CRM-046 — the simulations of the record', () => {
  const base = { type: 'CREDIT', isSaved: false, createdById: null, sentAt: null, emailed: false };
  it('saved by the client, made by the team, received by e-mail, projections; a mere calculation is not listed', () => {
    expect(listedSimulation({ ...base, isSaved: true })).toBe('CLIENT');
    expect(listedSimulation({ ...base, createdById: 'u-1' })).toBe('TEAM');
    expect(listedSimulation({ ...base, emailed: true })).toBe('EMAILED');
    expect(listedSimulation({ ...base, type: 'PROJECTION' })).toBe('PROJECTION');
    expect(listedSimulation(base)).toBeNull();
  });
});

// ─── COM-020 templates, BO-013 absence, CRM-041 ──────────────────────────────

describe('COM-020 — a hand-written e-mail from a template', () => {
  it('fields are replaced, conditions resolved, the button taken apart with an absolute address', () => {
    const out = fillTemplate('Bonjour {{client.firstName}},{{#if dossier.reference}} votre dossier {{dossier.reference}}{{else}} votre projet{{/if}}.\n\n{{button "Voir mon espace" /espace-client}}', { client: { firstName: 'Nadia' }, dossier: { reference: null } }, 'https://site.test/');
    expect(out.text).toBe('Bonjour Nadia, votre projet.');
    expect(out.button).toEqual({ label: 'Voir mon espace', href: 'https://site.test/espace-client' });
  });

  it('PAR-081 — the templates and rules of the package are installation data, each with its code', () => {
    expect(LEAD_PROCESSING_TEMPLATE_SEEDS.map((x) => x.code).sort()).toEqual(['C_CALL_MISSED', 'C_MANUAL_BLANK', 'C_MANUAL_FOLLOW_UP']);
    expect(LEAD_PROCESSING_RULE_SEEDS.map((x) => x.code).sort()).toEqual(['R_CALL_MISSED', 'R_LEAD_RELEASED']);
  });
});

describe('BO-013, CRM-021 — the absence of an adviser', () => {
  it('an absence ends at the end of its last day, in the calendar time zone', () => {
    expect(currentAbsence(new Date('2026-10-15T00:00:00Z'), '2026-10-12')).toBe('2026-10-15');
    expect(currentAbsence(new Date('2026-10-11T00:00:00Z'), '2026-10-12')).toBeNull();
    expect(currentAbsence(null, '2026-10-12')).toBeNull();
    expect(absentOn(new Date('2026-10-15T00:00:00Z'), NOW, 'Europe/Paris')).toBe('2026-10-15');
    expect(absentOn(null, NOW, 'Europe/Paris')).toBeNull();
  });

  it('an absence cannot end in the past', () => {
    expect(() => absenceToStore('2026-10-01', '2026-10-12')).toThrow();
    expect(absenceToStore(null, '2026-10-12')).toBeNull();
  });
});

describe('CRM-041 — a record created by the team', () => {
  it('a person without e-mail is accepted with a phone (MOD-302); without both, refused', () => {
    const base = { firstName: 'Samir', lastName: 'Benali', source: 'PHONE' };
    expect(staffClientCreateSchema.safeParse({ ...base, phone: '+33612345678' }).success).toBe(true);
    expect(staffClientCreateSchema.safeParse({ ...base }).success).toBe(false);
  });
});
