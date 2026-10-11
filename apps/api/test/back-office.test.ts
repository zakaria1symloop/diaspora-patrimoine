// Back-office foundation (packages 1.8, 1.9, 2.11, 3.1) — pure rules: the access declared by each route (SEC-030,
// API-100, API-101, BO-005), who may give which role (ROL-011), the masked forms of the SUPPORT role (SEC-032), the
// column « Premier contact » (CRM-002), the sentences of a team change (NOT-030 `NS_TEAM_CHANGE`).
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { grantOf, isPermission, leadListQuerySchema, savedViewConfigSchema, staffInviteSchema, teamListQuerySchema, type Permission, type StaffRole } from '@dp/contracts';
import type { BusinessCalendar } from '@dp/domain';
import { ACCESS_KEY, PERMISSION_KEY, REAUTH_KEY } from '../src/identity/access.js';
import { LeadsAdminController, NotesController, StaffShellController, StaffSocleController, TeamController } from '../src/back-office/back-office.controller.js';
import { firstContactOf, zonedDayStart } from '../src/back-office/leads-admin.service.js';
import { staffTargetOf } from '../src/back-office/staff-notifications.service.js';
import { clientName, leadScope, maskEmail, maskName, maskPhone, staffName, type StaffView } from '../src/back-office/staff-view.js';
import { teamChangeMailKey, teamChangeTexts } from '../src/back-office/team-events.handler.js';
import { assignableRoles } from '../src/back-office/team.service.js';

type Ctor = new (...args: never[]) => unknown;
const meta = (controller: Ctor, method: string, key: string) => Reflect.getMetadata(key, (controller.prototype as Record<string, unknown>)[method] as object) ?? Reflect.getMetadata(key, controller);

describe('SEC-030, API-100 — every route of the foundation declares its access', () => {
  const expected: [Ctor, Record<string, Permission | null>][] = [
    [StaffShellController, { get: null, profile: null, update: null }],
    [StaffSocleController, { list: null, read: null, readAll: null, search: null, views: null, createView: null, defaultView: null, updateView: null, shareView: 'view.share', removeView: null }],
    [NotesController, { list: 'note.read', create: 'note.manage', update: 'note.manage', pin: 'note.manage', remove: 'note.manage' }],
    [TeamController, { list: 'user.read', invite: 'user.manage', resend: 'user.manage', cancel: 'user.manage', changeRole: 'user.manage', update: 'user.manage', suspend: 'user.manage', reactivate: 'user.manage', resetTwoFactor: 'user.twofactor.reset' }],
    [LeadsAdminController, { list: 'lead.read', timelineOf: 'lead.read', detail: 'lead.read' }],
  ];

  it('each handler is a STAFF route of the ADMIN audience, with the permission of API-100 / API-101', () => {
    for (const [controller, routes] of expected) {
      const declared = Object.getOwnPropertyNames(controller.prototype).filter((n) => n !== 'constructor' && Reflect.getMetadata('path', (controller.prototype as Record<string, unknown>)[n] as object) !== undefined);
      expect(declared.sort(), controller.name).toEqual(Object.keys(routes).sort());
      for (const [method, permission] of Object.entries(routes)) {
        expect(meta(controller, method, ACCESS_KEY), `${controller.name}.${method}`).toEqual({ audience: 'ADMIN', kind: 'STAFF' });
        const actual = Reflect.getMetadata(PERMISSION_KEY, (controller.prototype as Record<string, unknown>)[method] as object) ?? null;
        expect(actual, `${controller.name}.${method}`).toBe(permission);
        if (permission) expect(isPermission(permission)).toBe(true);
      }
    }
  });

  it('BO-005 — changing a role and resetting a second factor ask for a recent password; nothing else of the team does', () => {
    const reauth = Object.keys(expected[3]![1]).filter((m) => meta(TeamController, m, REAUTH_KEY) === true);
    expect(reauth.sort()).toEqual(['changeRole', 'resetTwoFactor']);
  });

  it('ROL-022 — the team is read by every role, managed by Direction and administrators, the second factor reset by Direction only', () => {
    for (const role of ['OWNER', 'ADMIN', 'AGENT', 'VIEWER', 'SUPPORT'] as StaffRole[]) expect(grantOf(role, 'user.read')).toBeTruthy();
    expect(grantOf('ADMIN', 'user.manage')).toBe('own');
    expect(grantOf('AGENT', 'user.manage')).toBeUndefined();
    expect(grantOf('ADMIN', 'user.twofactor.reset')).toBeUndefined();
    expect(grantOf('SUPPORT', 'note.read')).toBeUndefined(); // ROL-015: never the content of a note
  });
});

describe('ROL-011 — who may give which role', () => {
  const view = (role: StaffRole, manage: boolean) => ({ role, has: (p: Permission) => (p === 'user.manage' ? manage : false) });
  it('the Direction gives every role', () => {
    expect(assignableRoles(view('OWNER', true))).toEqual(['OWNER', 'ADMIN', 'AGENT', 'VIEWER', 'SUPPORT']);
  });
  it('an administrator gives every role but Direction', () => {
    expect(assignableRoles(view('ADMIN', true))).toEqual(['ADMIN', 'AGENT', 'VIEWER', 'SUPPORT']);
  });
  it('a role without `user.manage` gives none', () => {
    expect(assignableRoles(view('AGENT', false))).toEqual([]);
  });
});

describe('SEC-032 — masked forms of the SUPPORT role', () => {
  it('a name keeps its initials: N••••• B•••••', () => {
    expect(maskName('Karima', 'Benali')).toBe('B••••• K•••••');
    expect(maskName(null, 'benali')).toBe('B•••••');
    expect(maskName(null, null)).toBeNull();
  });
  it('an e-mail keeps its first letter and its extension: n•••@•••.fr', () => {
    expect(maskEmail('nadia.b@exemple.fr')).toBe('n•••@•••.fr');
    expect(maskEmail(null)).toBeNull();
  });
  it('a phone keeps its country code and its last two digits', () => {
    expect(maskPhone('+33612345678')).toBe('+33 • •• •• •• 78');
    expect(maskPhone('+213551234567')).toBe('+213 • •• •• •• 67');
    expect(maskPhone(null)).toBeNull();
  });
  it('names as the back office reads them: « NOM Prénom » for a client, « Prénom Nom » for a colleague, nothing for a deleted account (MOD-100)', () => {
    expect(clientName({ firstName: 'Karima', lastName: 'Benali' })).toBe('BENALI Karima');
    expect(staffName({ firstName: 'Amel', lastName: 'Kaci' })).toBe('Amel Kaci');
    expect(staffName({ firstName: null, lastName: null, status: 'DELETED' })).toBeNull();
  });
});

describe('ROL-018 — the perimeter of an adviser in ASSIGNED_ONLY', () => {
  const base = { userId: 'u1', role: 'AGENT', has: () => true, masked: false, sensitive: true } as unknown as StaffView;
  it('sees the requests assigned to him and the unassigned ones', () => {
    expect(leadScope({ ...base, scoped: true })).toEqual({ OR: [{ assignedAgentId: 'u1' }, { assignedAgentId: null }] });
  });
  it('sees everything in mode ALL', () => {
    expect(leadScope({ ...base, scoped: false })).toEqual({});
  });
});

describe('CRM-002 — the column « Premier contact »', () => {
  const cal: BusinessCalendar = { timeZone: 'Europe/Paris', workdays: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', holidays: [] };
  const created = new Date('2026-10-05T08:00:00Z'); // Monday 10:00 in Paris
  const due = new Date('2026-10-07T08:00:00Z'); // Wednesday 10:00
  const lead = { kind: 'CALLBACK_REQUEST', status: 'NEW', createdAt: created, slaDueAt: due, firstContactAt: null as Date | null, preferredCallbackDate: null as Date | null };

  it('time left in business time; less than one business day is « soon »', () => {
    const far = firstContactOf(lead, new Date('2026-10-05T09:00:00Z'), cal, 2);
    expect(far).toMatchObject({ state: 'DUE', soon: false });
    expect((far as { businessMinutes: number }).businessMinutes).toBe(17 * 60); // 7 h Monday + 9 h Tuesday + 1 h Wednesday
    const near = firstContactOf(lead, new Date('2026-10-07T05:00:00Z'), cal, 2);
    expect(near).toMatchObject({ state: 'DUE', soon: true, businessMinutes: 60 });
  });
  it('overdue: late, in business hours', () => {
    expect(firstContactOf(lead, new Date('2026-10-07T13:00:00Z'), cal, 2)).toMatchObject({ state: 'LATE', businessMinutes: 5 * 60 });
  });
  it('once contacted: the time it took', () => {
    expect(firstContactOf({ ...lead, status: 'IN_PROGRESS', firstContactAt: new Date('2026-10-05T14:00:00Z') }, new Date('2026-10-09T08:00:00Z'), cal, 2)).toEqual({ state: 'DONE', businessMinutes: 6 * 60 });
  });
  it('a later callback day replaces the deadline and the column says so', () => {
    const chosen = { ...lead, slaDueAt: new Date('2026-10-15T16:00:00Z'), preferredCallbackDate: new Date('2026-10-15T00:00:00Z') };
    expect(firstContactOf(chosen, new Date('2026-10-06T08:00:00Z'), cal, 2)).toEqual({ state: 'CALLBACK', day: '2026-10-15' });
  });
  it('never a red delay on a request that expects nothing: closed without contact, spam, partner application → « — »', () => {
    const late = new Date('2026-10-20T08:00:00Z');
    expect(firstContactOf({ ...lead, status: 'CLOSED' }, late, cal, 2)).toEqual({ state: 'NONE' });
    expect(firstContactOf({ ...lead, status: 'SPAM' }, late, cal, 2)).toEqual({ state: 'NONE' });
    expect(firstContactOf({ ...lead, kind: 'PARTNER_REQUEST', slaDueAt: null }, late, cal, 2)).toEqual({ state: 'NONE' });
  });
  it('a period filter starts at midnight of the reader’s time zone', () => {
    expect(zonedDayStart('2026-10-11', 'Europe/Paris').toISOString()).toBe('2026-10-10T22:00:00.000Z');
    expect(zonedDayStart('2026-01-15', 'America/Montreal').toISOString()).toBe('2026-01-15T05:00:00.000Z');
  });
});

describe('API-011 — list parameters: an unknown one is refused, sorts are declared', () => {
  it('leads', () => {
    expect(leadListQuerySchema.safeParse({ view: 'to-take', status: 'NEW,IN_PROGRESS', sort: '-slaDueAt', page: '2', pageSize: '50' }).success).toBe(true);
    expect(leadListQuerySchema.safeParse({ unknown: '1' }).success).toBe(false);
    expect(leadListQuerySchema.safeParse({ sort: 'email' }).success).toBe(false);
    expect(leadListQuerySchema.safeParse({ pageSize: '30' }).success).toBe(false); // TRV-100: 25, 50 or 100
    expect(leadListQuerySchema.parse({}).sort).toBe('-createdAt'); // CRM-001: the most recent first
  });
  it('team', () => {
    expect(teamListQuerySchema.parse({}).sort).toBe('name'); // ADM-030
    expect(teamListQuerySchema.safeParse({ role: 'OWNER,BOSS' }).success).toBe(false);
  });
  it('ADM-030 — an invitation needs first name, last name, e-mail and role; the function is optional', () => {
    expect(staffInviteSchema.safeParse({ firstName: 'Amel', lastName: 'Kaci', email: 'Amel.K@Example.test ', role: 'AGENT', jobTitle: '' }).success).toBe(true);
    expect(staffInviteSchema.parse({ firstName: 'Amel', lastName: 'Kaci', email: 'Amel.K@Example.test ', role: 'AGENT', jobTitle: '' })).toMatchObject({ email: 'amel.k@example.test', jobTitle: null });
    expect(staffInviteSchema.safeParse({ firstName: 'Amel', lastName: 'Kaci', email: 'amel', role: 'AGENT' }).success).toBe(false);
    expect(staffInviteSchema.safeParse({ firstName: 'Amel', lastName: 'Kaci', email: 'a@example.test', role: 'BOSS' }).success).toBe(false);
  });
  it('BO-040 — a saved view keeps filters, sort, columns and page size, nothing else', () => {
    expect(savedViewConfigSchema.parse({})).toEqual({ filters: {}, sort: null, columns: null, pageSize: 25 });
    expect(savedViewConfigSchema.safeParse({ q: 'benali' }).success).toBe(false); // TRV-105: never the search text
    expect(savedViewConfigSchema.safeParse({ pageSize: 30 }).success).toBe(false);
  });
});

describe('NOT-030 `NS_TEAM_CHANGE`, § 6.7 `S_TEAM_CHANGE`', () => {
  it('the title names the author and the account', () => {
    expect(teamChangeTexts('suspended', 'Amina Direction', 'Amel Kaci')).toEqual({ title: 'Amina Direction a suspendu le compte de Amel Kaci.', summary: 'suspendu le compte de Amel Kaci' });
    expect(teamChangeTexts('twoFactorReset', 'Amina Direction', 'Amel Kaci').title).toBe('La double authentification de Amel Kaci a été réinitialisée par Amina Direction.');
    expect(teamChangeTexts('emailChanged', null, 'Amel Kaci').title).toBe('L’adresse du compte de Amel Kaci a changé.');
  });
  it('ADM-040 — a recovery has no author: « La plateforme »', () => {
    expect(teamChangeTexts('recovered', null, 'Amina Direction').title).toBe('La plateforme a rétabli le compte de Amina Direction.');
  });
  it('NOT-011 — one key per event and address, shared with the operations command', () => {
    expect(teamChangeMailKey('evt', 'a@example.test')).toBe('S_TEAM_CHANGE:evt:a@example.test');
  });
  it('BO-060 — the icon follows the object the notification names', () => {
    expect(staffTargetOf('Lead')).toBe('LEAD');
    expect(staffTargetOf('User')).toBe('RECORD');
    expect(staffTargetOf(null)).toBe('OTHER');
  });
});
