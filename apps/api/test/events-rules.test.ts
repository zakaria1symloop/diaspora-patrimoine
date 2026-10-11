import { describe, expect, it } from 'vitest';
import { defaultLocationCode, eventPublicationMissing, eventReference, eventSlug, eventTitle, zonedTimeToUtc } from '../src/events-admin/events-rules.js';

describe('Café references and texts', () => {
  const start = zonedTimeToUtc('2026-10-17', '10:00', 'Europe/Paris');

  it('CYC-180 — 10 h in Paris is 08:00 UTC in October (summer time) and 09:00 UTC in November', () => {
    expect(start.toISOString()).toBe('2026-10-17T08:00:00.000Z');
    expect(zonedTimeToUtc('2026-11-14', '10:00', 'Europe/Paris').toISOString()).toBe('2026-11-14T09:00:00.000Z');
  });
  it('TRV-051 — reference CAF-{année}-{mois}-{code du lieu}', () => {
    expect(eventReference(start, 'Europe/Paris', 'PAR')).toBe('CAF-2026-10-PAR');
    expect(eventReference(zonedTimeToUtc('2026-11-14', '10:00', 'Europe/Paris'), 'Europe/Paris', 'mrs')).toBe('CAF-2026-11-MRS');
    expect(defaultLocationCode('Sud de la France')).toBe('SUD');
  });
  it('EVT-003 — slug {lieu}-{jour}-{mois}-{année} and default title', () => {
    expect(eventSlug('Paris', start, 'Europe/Paris')).toBe('paris-17-octobre-2026');
    expect(eventTitle('Le Café', 'Paris', start, 'Europe/Paris')).toBe('Le Café – Paris – samedi 17 octobre 2026');
  });
  it('CYC-180 — publication needs place, city, dates, capacity, venue address and a future start', () => {
    const now = new Date('2026-10-09T08:00:00Z');
    const ok = { locationLabel: 'Paris', cityName: 'Paris', startsAt: start, endsAt: new Date(start.getTime() + 3 * 3600_000), capacity: 30, venueAddress: '75004 Paris', now };
    expect(eventPublicationMissing(ok)).toEqual([]);
    expect(eventPublicationMissing({ ...ok, venueAddress: null, now: new Date('2026-10-18T00:00:00Z') })).toEqual(['VENUE_ADDRESS', 'STARTS_IN_FUTURE']);
  });
});
