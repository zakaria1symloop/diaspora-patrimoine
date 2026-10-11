// ASS-010, ASS-021, CAT-061 — answers of the guided assistant → catalogue criteria, and the relaxation ladder.
import { describe, expect, it } from 'vitest';
import { guidedCriteria, relaxationLadder, widenBudget } from '../src/guided-search.js';

describe('guidedCriteria', () => {
  it('ASS-010 neutral answers produce no criterion', () => {
    expect(guidedCriteria({ region: 'ANY', type: 'ANY', budget: 'UNKNOWN', delivery: 'ANY', purpose: 'NO_ANSWER' }, 2026)).toEqual({});
  });
  it('ASS-010 regions, types, rooms, monthly budget, delivery « d’ici un à deux ans »', () => {
    expect(
      guidedCriteria({ region: ['alger', 'oran'], type: ['apartment'], rooms: ['3', '5plus'], budget: { kind: 'MONTHLY', max: 800 }, delivery: 'SOON', purpose: 'FAMILY' }, 2026),
    ).toEqual({ region: ['alger', 'oran'], type: ['apartment'], rooms: ['3', '5plus'], monthlyMax: 800, delivery: ['delivered', '2026', '2027', '2028'] });
  });
  it('ASS-010 total budget → priceMax; « Disponible tout de suite » → delivered', () => {
    expect(guidedCriteria({ budget: { kind: 'TOTAL', max: 150000 }, delivery: 'NOW' }, 2026)).toEqual({ priceMax: 150000, delivery: ['delivered'] });
  });
  it('ASS-010 2 bis — rooms are ignored when no apartment, villa or duplex is chosen', () => {
    expect(guidedCriteria({ type: ['land'], rooms: ['3'] }, 2026)).toEqual({ type: ['land'] });
  });
});

describe('widenBudget', () => {
  it('CAT-060 +20 %, rounded up: monthly to the ten, total to the CAL-021 step', () => {
    expect(widenBudget(800, 'MONTHLY')).toBe(960);
    expect(widenBudget(655, 'MONTHLY')).toBe(790); // 786 → 790
    expect(widenBudget(150000, 'TOTAL')).toBe(180000);
    expect(widenBudget(84000, 'TOTAL')).toBe(101000); // 100 800 ≥ 100 000 → step 1 000
    expect(widenBudget(9000, 'TOTAL')).toBe(11000); // 10 800 → step 500 → 11 000
    expect(widenBudget(5000, 'TOTAL')).toBe(6000);
  });
});

describe('relaxationLadder', () => {
  it('CAT-061 communes, budget +20 %, rooms, delivery, region — cumulative, type never relaxed', () => {
    const ladder = relaxationLadder({ region: ['alger'], city: ['hydra'], type: ['apartment'], rooms: ['3'], monthlyMax: 800, delivery: ['delivered'] });
    expect(ladder).toEqual([
      { region: ['alger'], type: ['apartment'], rooms: ['3'], monthlyMax: 800, delivery: ['delivered'] },
      { region: ['alger'], type: ['apartment'], rooms: ['3'], monthlyMax: 960, delivery: ['delivered'] },
      { region: ['alger'], type: ['apartment'], monthlyMax: 960, delivery: ['delivered'] },
      { region: ['alger'], type: ['apartment'], monthlyMax: 960 },
      { type: ['apartment'], monthlyMax: 960 },
    ]);
  });
  it('CAT-061 a step that changes nothing is skipped', () => {
    expect(relaxationLadder({ type: ['villa'], priceMax: 200000 })).toEqual([{ type: ['villa'], priceMax: 240000 }]);
    expect(relaxationLadder({ type: ['villa'] })).toEqual([]);
  });
});
