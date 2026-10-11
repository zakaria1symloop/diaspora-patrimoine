// 02-site-public/09 — guided assistant (EP-22, mode GUIDED). The choices of each question come from the published and
// available catalogue, given the earlier answers (ASS-010: « Un choix sans aucun bien n'est pas proposé »); the result
// is the catalogue search of the answers, relaxed in the order of CAT-061 when nothing matches (ASS-021).
// Reads the in-memory catalogue (CatalogueService): the counts are those of the catalogue page, criterion for criterion.
import { Injectable } from '@nestjs/common';
import {
  GUIDED_ROOMS,
  GUIDED_TYPES,
  PurchasePurpose,
  answersBefore,
  type CatalogueCriteria,
  type GuidedAnswers,
  type GuidedQuestionsResponse,
  type GuidedResultsResponse,
  type GuidedStep,
} from '@dp/contracts';
import { guidedCriteria, relaxationLadder } from '@dp/domain';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { AppError } from '../platform/errors.js';
import { SettingsService } from '../platform/settings.service.js';

/** ASS-020 — six cards at most. */
export const GUIDED_RESULT_CARDS = 6;

/**
 * Budget steps worth offering: the steps that give at least one property, cut after the first one that already gives
 * every property a budget can reach (the next ones would show the same list).
 */
export function usefulSteps(counts: { step: number; count: number }[]): number[] {
  const offered = counts.filter((c) => c.count > 0);
  const best = offered.reduce((m, c) => Math.max(m, c.count), 0);
  const cut = offered.findIndex((c) => c.count === best);
  return offered.slice(0, cut + 1).map((c) => c.step);
}

/** ASS-010 — a monthly budget is dropped when the monthly search is off (question 3 then offers the total only). */
export function withoutMonthly(answers: GuidedAnswers, monthlyOn: boolean): GuidedAnswers {
  if (monthlyOn || !answers.budget || answers.budget === 'UNKNOWN' || answers.budget.kind !== 'MONTHLY') return answers;
  const rest = { ...answers };
  delete rest.budget;
  return rest;
}

@Injectable()
export class GuidedSearchService {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly index: CatalogueIndex,
    private readonly settings: SettingsService,
  ) {}

  /** Mode switch — `OFF`: the assistant does not exist (404, NAV-003); the questionnaire also serves the mode `AI` as its fallback (ASS-050). */
  async mode(): Promise<'GUIDED' | 'AI'> {
    const mode = await this.settings.get('features.assistant.mode');
    if (mode === 'OFF') throw AppError.notFound();
    return mode;
  }

  private async year(): Promise<number> {
    return Number((await this.index.today()).slice(0, 4));
  }

  private async count(criteria: CatalogueCriteria): Promise<number> {
    return (await this.catalogue.list(criteria, false)).meta.total;
  }

  async questions(raw: GuidedAnswers): Promise<GuidedQuestionsResponse> {
    const mode = await this.mode();
    const [monthlyOn, monthlySteps, totalSteps, currency, year] = await Promise.all([
      this.settings.get('features.monthlyBudgetSearch'),
      this.settings.get('catalogue.monthlyBudgetSteps'),
      this.settings.get('catalogue.priceBudgetSteps'),
      this.settings.get('display.referenceCurrency'),
      this.year(),
    ]);
    const answers = withoutMonthly(raw, monthlyOn);
    const before = (step: GuidedStep) => guidedCriteria(answersBefore(answers, step), year);

    const [q1, q2, q2bis] = await Promise.all([
      this.catalogue.list(before('region'), true),
      this.catalogue.list(before('type'), true),
      this.catalogue.list(before('rooms'), true),
    ]);
    const has = (options: { value: string; count: number }[] | undefined, value: string) => (options ?? []).some((o) => o.value === value && o.count > 0);

    const budgetBase = before('budget');
    const stepCounts = (steps: number[], key: 'monthlyMax' | 'priceMax') =>
      Promise.all(steps.map(async (step) => ({ step, count: await this.count({ ...budgetBase, [key]: step }) })));
    const [monthly, total] = await Promise.all([monthlyOn ? stepCounts(monthlySteps, 'monthlyMax') : Promise.resolve(null), stepCounts(totalSteps, 'priceMax')]);

    const deliveryBase = before('delivery');
    const soon = ['delivered', String(year), String(year + 1), String(year + 2)];
    const [now, later] = await Promise.all([this.count({ ...deliveryBase, delivery: ['delivered'] }), this.count({ ...deliveryBase, delivery: soon })]);

    return {
      mode,
      regions: (q1.facets?.region ?? []).filter((o) => o.count > 0).map((o) => ({ slug: o.value, name: o.label })),
      types: GUIDED_TYPES.filter((t) => has(q2.facets?.type, t)),
      rooms: GUIDED_ROOMS.filter((r) => has(q2bis.facets?.rooms, r)),
      monthlySteps: monthly ? usefulSteps(monthly) : null,
      totalSteps: usefulSteps(total),
      delivery: [...(now > 0 ? (['NOW'] as const) : []), ...(later > 0 ? (['SOON'] as const) : [])],
      purposes: Object.values(PurchasePurpose),
      currency,
    };
  }

  async results(raw: GuidedAnswers): Promise<GuidedResultsResponse> {
    await this.mode();
    const answers = withoutMonthly(raw, await this.settings.get('features.monthlyBudgetSearch'));
    return this.search(guidedCriteria(answers, await this.year()));
  }

  /**
   * ASS-020, ASS-021 — the search of a set of criteria, relaxed in the order of CAT-061 when nothing matches. Shared with
   * the conversational mode (ASS-052: the same cards and actions).
   */
  async search(criteria: CatalogueCriteria): Promise<GuidedResultsResponse> {
    let applied = criteria;
    let res = await this.catalogue.list(criteria, false);
    let outcome: GuidedResultsResponse['outcome'] = 'EXACT';
    if (res.meta.total === 0) {
      outcome = 'NONE';
      for (const step of relaxationLadder(criteria)) {
        const relaxed = await this.catalogue.list(step, false);
        if (relaxed.meta.total > 0) {
          applied = step;
          res = relaxed;
          outcome = 'RELAXED';
          break;
        }
      }
    }
    const cards = outcome === 'NONE' ? [] : res.data.slice(0, GUIDED_RESULT_CARDS);
    return {
      outcome,
      total: outcome === 'NONE' ? 0 : res.meta.total,
      cards,
      // ASS-030 — the properties shown to the visitor (twenty at most).
      references: cards.map((c) => c.reference),
      criteria,
      appliedCriteria: applied,
      referenceDownPaymentPct: res.meta.referenceDownPaymentPct,
    };
  }
}
