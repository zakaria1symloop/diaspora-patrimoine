// ASS-010, ASS-021, CAT-061 — from the answers of the guided assistant to catalogue criteria (CAT-020), and the ladder
// of relaxed criteria used when nothing matches. Pure.
import type { CatalogueCriteria, GuidedAnswers } from '@dp/contracts';
import { dec, priceStep } from './money.js';

/**
 * ASS-010 — the criteria produced by the answers. Question 4 « D'ici un à deux ans » = delivered, plus the current year
 * and the two years to come (the catalogue's yearly buckets, CAT-034); question 5 produces no criterion.
 * `currentYear` is the year of the business calendar.
 */
export function guidedCriteria(a: GuidedAnswers, currentYear: number): CatalogueCriteria {
  const c: CatalogueCriteria = {};
  if (Array.isArray(a.region) && a.region.length) c.region = [...a.region];
  if (Array.isArray(a.type) && a.type.length) {
    c.type = [...a.type];
    const roomsAsked = a.type.some((t) => t === 'apartment' || t === 'villa' || t === 'duplex');
    if (roomsAsked && Array.isArray(a.rooms) && a.rooms.length) c.rooms = [...a.rooms];
  }
  if (a.budget && a.budget !== 'UNKNOWN') {
    if (a.budget.kind === 'MONTHLY') c.monthlyMax = a.budget.max;
    else c.priceMax = a.budget.max;
  }
  if (a.delivery === 'NOW') c.delivery = ['delivered'];
  if (a.delivery === 'SOON') c.delivery = ['delivered', String(currentYear), String(currentYear + 1), String(currentYear + 2)];
  return c;
}

/**
 * CAT-060 / CAT-061 — a budget widened by 20 %, rounded UP like the bounds of the slider (CAT-034): a total price to the
 * CAL-021 step of the amount (1 000 above 100 000), a monthly payment to the ten (CAL-022).
 */
export function widenBudget(amount: number, kind: 'MONTHLY' | 'TOTAL'): number {
  const widened = dec(amount).mul('1.2');
  const step = kind === 'MONTHLY' ? dec(10) : priceStep(widened);
  return widened.div(step).ceil().mul(step).toNumber();
}

/**
 * CAT-061 — the relaxed criteria, in order, each step keeping the previous ones relaxed: the communes; the budget
 * (+20 %); the rooms; the delivery; the region. A step that changes nothing is skipped. The type is never relaxed.
 */
export function relaxationLadder(criteria: CatalogueCriteria): CatalogueCriteria[] {
  const steps: CatalogueCriteria[] = [];
  let current: CatalogueCriteria = { ...criteria };
  delete current.page;
  const push = (next: CatalogueCriteria, changed: boolean) => {
    current = next;
    if (changed) steps.push({ ...current });
  };
  {
    const next = { ...current };
    const changed = next.city !== undefined;
    delete next.city;
    push(next, changed);
  }
  {
    const next = { ...current };
    let changed = false;
    if (next.monthlyMax !== undefined) {
      next.monthlyMax = widenBudget(next.monthlyMax, 'MONTHLY');
      changed = true;
    }
    if (next.priceMax !== undefined) {
      next.priceMax = widenBudget(next.priceMax, 'TOTAL');
      changed = true;
    }
    push(next, changed);
  }
  for (const key of ['rooms', 'delivery', 'region'] as const) {
    const next = { ...current };
    const changed = next[key] !== undefined;
    delete next[key];
    push(next, changed);
  }
  return steps;
}
