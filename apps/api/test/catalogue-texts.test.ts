import { describe, expect, it } from 'vitest';
import {
  deliveryPhrase,
  firstDayOfPeriod,
  generateDescription,
  generateTitle,
  propertySlug,
  searchText,
  uniqueSlug,
} from '../src/catalogue-admin/catalogue-texts.js';

const base = { surfaceM2: 85, cityName: null, regionName: 'Alger', roomsPrefix: 'T' };

describe('generated title', () => {
  it('MOD-210 — dwelling of a programme: « {Type} T{rooms} – {programme} »', () => {
    expect(generateTitle({ ...base, type: 'APARTMENT', rooms: 3, programName: 'Résidence El Yasmine' })).toBe('Appartement T3 – Résidence El Yasmine');
    expect(generateTitle({ ...base, type: 'DUPLEX', rooms: 5, programName: 'Résidence El Yasmine' })).toBe('Duplex T5 – Résidence El Yasmine');
  });
  it('MOD-210 — studio, standalone property, land; the prefix follows display.roomsPrefix', () => {
    expect(generateTitle({ ...base, type: 'STUDIO', rooms: 1, programName: 'Le Belvédère' })).toBe('Studio – Le Belvédère');
    expect(generateTitle({ ...base, type: 'VILLA', rooms: 5, programName: null, cityName: 'Chéraga' })).toBe('Villa T5 – Chéraga');
    expect(generateTitle({ ...base, type: 'VILLA', rooms: 5, programName: null })).toBe('Villa T5 – Alger');
    expect(generateTitle({ ...base, type: 'LAND', rooms: null, surfaceM2: '400.00', programName: null, cityName: 'Zéralda' })).toBe('Terrain 400 m² – Zéralda');
    expect(generateTitle({ ...base, type: 'APARTMENT', rooms: 3, programName: 'X', roomsPrefix: 'F' })).toBe('Appartement F3 – X');
  });
});

describe('generated description', () => {
  const delivery = { status: 'UNDER_CONSTRUCTION' as const, date: '2027-10-01', precision: 'QUARTER' as const };
  it('MOD-211 — « {Type} T{rooms} de {surface} m² à {ville} ({région}), {livraison}. {caractéristiques}. »', () => {
    expect(
      generateDescription({ ...base, type: 'APARTMENT', rooms: 3, cityName: 'Chéraga', delivery, featureLabels: ['Terrasse', 'Cuisine équipée', 'Place de parking'] }),
    ).toBe('Appartement T3 de 85 m² à Chéraga (Alger), livraison T4 2027. Terrasse, cuisine équipée, place de parking.');
  });
  it('MOD-211 — without a city: « … de {surface} m² à {région}, {livraison}. »', () => {
    expect(generateDescription({ ...base, type: 'APARTMENT', rooms: 2, surfaceM2: '62.50', delivery, featureLabels: [] })).toBe(
      'Appartement T2 de 62,5 m² à Alger, livraison T4 2027.',
    );
  });
  it('MOD-202 — the delivery is shown by its precision; the date is the first day of the period', () => {
    expect(deliveryPhrase({ status: 'ON_PLAN', date: '2027-06-01', precision: 'MONTH' })).toBe('livraison juin 2027');
    expect(deliveryPhrase({ status: 'ON_PLAN', date: '2027-01-01', precision: 'YEAR' })).toBe('livraison 2027');
    expect(deliveryPhrase({ status: 'DELIVERED', date: null, precision: 'QUARTER' })).toBe('livré');
    expect(firstDayOfPeriod('2027-11-20', 'QUARTER')).toBe('2027-10-01');
    expect(firstDayOfPeriod('2027-11-20', 'MONTH')).toBe('2027-11-01');
    expect(firstDayOfPeriod('2027-11-20', 'YEAR')).toBe('2027-01-01');
  });
});

describe('slugs and search text', () => {
  it('TRV-052 — property slug: title, region and reference', () => {
    expect(propertySlug('Appartement T3 – Résidence El Yasmine', 'Alger', 'DP-DZ-0142')).toBe('appartement-t3-residence-el-yasmine-alger-dp-dz-0142');
    expect(propertySlug('x'.repeat(200), 'Alger', 'DP-DZ-0142').length).toBeLessThanOrEqual(120);
  });
  it('TRV-052 — a taken slug gets a numeric suffix', async () => {
    const taken = new Set(['le-belvedere', 'le-belvedere-2']);
    expect(await uniqueSlug('le-belvedere', 80, async (s) => taken.has(s))).toBe('le-belvedere-3');
  });
  it('MOD-220 — searchText is unaccented and lower case', () => {
    expect(searchText(['Appartement T3 – Résidence El Yasmine', 'Bahia Promotion', 'Chéraga', null, 'DP-DZ-0142'])).toBe(
      'appartement t3 – residence el yasmine bahia promotion cheraga dp-dz-0142',
    );
  });
});
