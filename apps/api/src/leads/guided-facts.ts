// ASS-030, ASS-031 — the guided assistant request (`GUIDED_SEARCH`): the criteria stored with it are recomputed from the
// answers (what is kept is what the visitor was asked), and the answers complete the EMPTY fields of the client record:
// preferred regions and types, rooms, budget, purpose of the purchase (MOD-300). Pure.
import { typeSlugToEnum, type CatalogueCriteria, type GuidedAnswers } from '@dp/contracts';
import { guidedCriteria } from '@dp/domain';
import type { ClientFacts } from './client-record.js';

/** ASS-030 — criteria produced by the answers (ASS-010); a monthly budget is ignored when the monthly search is off. */
export function guidedLeadCriteria(answers: GuidedAnswers, currentYear: number, monthlyOn: boolean): CatalogueCriteria {
  const a = { ...answers };
  if (!monthlyOn && a.budget && a.budget !== 'UNKNOWN' && a.budget.kind === 'MONTHLY') delete a.budget;
  return guidedCriteria(a, currentYear);
}

/**
 * ASS-031 — facts for the client record. `regionIds` are the ids of the answered region slugs (unknown slugs dropped
 * by the caller). Rooms: the smallest chosen (« T5 et plus » = 5), only when the rooms question was asked.
 */
export function guidedFacts(answers: GuidedAnswers, regionIds: string[], currency: string, monthlyOn: boolean): ClientFacts {
  const facts: ClientFacts = {};
  if (regionIds.length) facts.preferredRegionIds = regionIds;
  if (Array.isArray(answers.type)) facts.preferredTypes = answers.type.map((t) => typeSlugToEnum[t]);
  const roomsAsked = Array.isArray(answers.type) && answers.type.some((t) => t === 'apartment' || t === 'villa' || t === 'duplex');
  if (roomsAsked && Array.isArray(answers.rooms) && answers.rooms.length) {
    facts.minRooms = Math.min(...answers.rooms.map((r) => (r === '5plus' ? 5 : Number(r))));
  }
  if (answers.budget && answers.budget !== 'UNKNOWN' && (monthlyOn || answers.budget.kind === 'TOTAL')) {
    facts.budget = { amount: String(answers.budget.max), currency, kind: answers.budget.kind };
  }
  if (answers.purpose && answers.purpose !== 'NO_ANSWER') facts.purchasePurpose = answers.purpose;
  return facts;
}
