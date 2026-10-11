// CAT-022, CAT-072, SFA-035, AUT-060, AUT-061, NOT-022 — pure parts of the alerts and preferences: link tokens, label,
// states, quiet hours, the `{{> block}}` of C_ALERT_MATCHES and its redaction, the catalogue's approximate point.
import { describe, expect, it } from 'vitest';
import { alertCriteriaOf, parseCatalogueCriteria, parseRefs } from '@dp/contracts';
import {
  alertManageToken,
  emailPrint,
  signAlertToken,
  signPreferencesToken,
  verifyAlertToken,
  verifyPreferencesToken,
} from '../src/communication/link-tokens.js';
import { renderTemplate } from '../src/communication/template-renderer.js';
import { alertLabel } from '../src/alerts/alert-label.js';
import { alertState, maskEmail } from '../src/alerts/alerts.service.js';
import { inQuietHours, localClock } from '../src/alerts/alerts-jobs.js';
import { propertiesBlock } from '../src/alerts/alerts-mail.handler.js';
import { approxCoord } from '../src/catalogue/catalogue.service.js';
import { ALERT_TEMPLATE_SEEDS } from '../src/alerts/alert-templates.js';

const KEY = 'k'.repeat(40);
const ID = '01a12045-35b4-749b-87ff-032e7d68508f';
const NOW = new Date('2026-10-09T10:00:00Z');

describe('link tokens (NOT-007, TRV-053, NAV-002)', () => {
  it('an alert token is lower-case hex, carries no address, and verifies with its purpose', () => {
    const token = signAlertToken(KEY, 'confirm', ID, new Date(NOW.getTime() + 7 * 86_400_000));
    expect(token).toMatch(/^ac[0-9a-f]+$/);
    expect(token).not.toContain('@');
    expect(verifyAlertToken(KEY, token, NOW)).toEqual({ ok: true, purpose: 'confirm', alertId: ID });
  });

  it('CAT-071 — a confirmation link expires after its 7 days; a forged or tampered one is invalid', () => {
    const token = signAlertToken(KEY, 'confirm', ID, new Date(NOW.getTime() + 1000));
    expect(verifyAlertToken(KEY, token, new Date(NOW.getTime() + 2000))).toMatchObject({ ok: false, reason: 'EXPIRED', alertId: ID });
    const tampered = token.slice(0, 5) + (token[5] === 'a' ? 'b' : 'a') + token.slice(6);
    expect(verifyAlertToken(KEY, tampered, NOW)).toEqual({ ok: false, reason: 'INVALID' });
    expect(verifyAlertToken('x'.repeat(40), token, NOW)).toEqual({ ok: false, reason: 'INVALID' });
    expect(verifyAlertToken(KEY, 'AC' + token.slice(2), NOW)).toEqual({ ok: false, reason: 'INVALID' });
  });

  it('the management token never expires and is deterministic (its hash is stored, never the token)', () => {
    expect(alertManageToken(KEY, ID)).toBe(alertManageToken(KEY, ID));
    expect(verifyAlertToken(KEY, alertManageToken(KEY, ID), new Date('2040-01-01'))).toMatchObject({ ok: true, purpose: 'manage' });
  });

  it('NOT-022 — a preferences token carries the record, the group, the e-mail row; it dies with a change of address', () => {
    const comm = '01a12045-0000-7000-8000-000000000001';
    const token = signPreferencesToken(KEY, ID, 'ALERTS', comm, 'Amel@Example.fr');
    expect(token).toMatch(/^p[0-9a-f]+$/);
    const check = verifyPreferencesToken(KEY, token);
    expect(check).toEqual({ ok: true, clientId: ID, group: 'ALERTS', communicationId: comm, emailPrint: emailPrint('amel@example.fr') });
    expect(check.ok && check.emailPrint === emailPrint('autre@example.fr')).toBe(false);
    expect(verifyPreferencesToken(KEY, signPreferencesToken(KEY, ID, 'NEWS', null, 'a@b.fr'))).toMatchObject({ ok: true, communicationId: null });
    expect(verifyPreferencesToken(KEY, token.replace(/.$/, (c) => (c === '0' ? '1' : '0')))).toEqual({ ok: false });
  });
});

describe('alert criteria and label (CAT-022, Q-055)', () => {
  it('sort, page, availability, vue, groupe and bbox are never stored in an alert', () => {
    const c = parseCatalogueCriteria({ region: 'alger', sort: 'price_asc', page: '2', availability: 'all', vue: 'carte', groupe: 'programme', bbox: '2.9,36.6,3.2,36.8' }, 2026);
    expect(alertCriteriaOf(c)).toEqual({ region: ['alger'] });
  });

  it('the label follows the order of the catalogue summary; without criteria « Tous les biens »', () => {
    const names = { regions: new Map([['alger', 'Alger']]), cities: new Map([['cheraga', 'Chéraga']]), promoters: new Map() };
    const c = parseCatalogueCriteria({ type: 'apartment', rooms: '3', region: 'alger', city: 'cheraga', monthlyMax: '900', financing: '1' }, 2026);
    const label = alertLabel(c, names, 'T', 2026);
    expect(label.startsWith('Appartement T3 · Alger (Chéraga) · ')).toBe(true);
    expect(label).toContain('900');
    expect(label.endsWith(' · Éligible au financement')).toBe(true);
    expect(alertLabel({}, names, 'T', 2026)).toBe('Tous les biens');
    expect(alertLabel({ q: 'x'.repeat(80), region: ['alger'], promoter: ['a'.repeat(60)] }, names, 'T', 2026).length).toBeLessThanOrEqual(120);
  });
});

describe('alert states and masks (SFA-035)', () => {
  it('pending, active, paused, expired, stopped', () => {
    const at = new Date();
    expect(alertState({ isActive: false, confirmedAt: null, deactivatedReason: null })).toBe('PENDING');
    expect(alertState({ isActive: true, confirmedAt: at, deactivatedReason: null })).toBe('ACTIVE');
    expect(alertState({ isActive: false, confirmedAt: at, deactivatedReason: null })).toBe('PAUSED');
    expect(alertState({ isActive: false, confirmedAt: at, deactivatedReason: 'EXPIRED' })).toBe('EXPIRED');
    expect(alertState({ isActive: false, confirmedAt: at, deactivatedReason: 'BOUNCE' })).toBe('EXPIRED');
    expect(alertState({ isActive: false, confirmedAt: at, deactivatedReason: 'USER' })).toBe('STOPPED');
  });
  it('the page never shows the full address', () => {
    expect(maskEmail('amel.kaci@example.fr')).toBe('a•••@example.fr');
  });
});

describe('sending rules (AUT-006, AUT-060)', () => {
  it('quiet hours over midnight', () => {
    const quiet = { start: '20:00', end: '08:00' };
    expect(inQuietHours('19:59', quiet)).toBe(false);
    expect(inQuietHours('20:00', quiet)).toBe(true);
    expect(inQuietHours('03:10', quiet)).toBe(true);
    expect(inQuietHours('08:00', quiet)).toBe(false);
  });
  it('local clock in the business time zone, Monday = 1', () => {
    expect(localClock(new Date('2026-10-12T06:30:00Z'), 'Europe/Paris')).toEqual({ hm: '08:30', weekday: 1, date: '2026-10-12' });
  });
  it('C_ALERT_MATCHES — the properties block is inserted as its own paragraph, the stored copy is redacted', () => {
    const seed = ALERT_TEMPLATE_SEEDS.find((s) => s.code === 'C_ALERT_MATCHES')!;
    const block = propertiesBlock([{ title: 'T3 <vue>', url: 'https://www.example.fr/biens/t3', place: 'Oran', price: '150 000 €', monthly: '810 €', image: null }], 'Note*');
    const vars = { alert: { label: 'Oran', totalCount: 1, resultsUrl: 'https://www.example.fr/programmes', manageUrl: 'https://www.example.fr/alertes/am00' } };
    const r = renderTemplate({ subject: seed.subject, body: seed.body }, vars, { siteUrl: 'https://www.example.fr', partials: { properties: block } });
    expect(r.missing).toEqual([]);
    expect(r.html).toContain('T3 &lt;vue&gt;');
    expect(r.html).toContain('810 € / mois*');
    expect(r.text).toContain('Note*');
    expect(r.text).toContain('Voir tous les biens : https://www.example.fr/programmes');
    const none = renderTemplate({ subject: seed.subject, body: seed.body }, vars, { siteUrl: 'https://www.example.fr' });
    expect(none.html).not.toContain('T3');
  });
});

describe('catalogue (FIC-060, CAT-092)', () => {
  it('the approximate point is the centre of a 0.005° cell', () => {
    expect(approxCoord(36.7563)).toBe(36.755);
    expect(approxCoord(2.9587)).toBe(2.96);
    expect(approxCoord(-0.6249)).toBe(-0.625);
  });
  it('compare references: upper-cased, deduplicated, three at most, malformed dropped', () => {
    expect(parseRefs('dp-dz-0142,DP-DZ-0142,<x>,DP-DZ-0203,DP-DZ-0177,DP-DZ-0001', 3)).toEqual(['DP-DZ-0142', 'DP-DZ-0203', 'DP-DZ-0177']);
  });
});
