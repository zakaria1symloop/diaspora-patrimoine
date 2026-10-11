// DEM-016 — « Être rappelé par un conseiller » from a simulator result (`SIMULATION_FOLLOWUP`). The simulation was
// written first (SIM-032 « Routes »); here it is checked (same `dp_anon` browser, API-100), joined to the request
// (`Lead.simulationId`), attached to the client record, and its data (income, debts, down payment, budget) completes the
// EMPTY fields of the record (MOD-300) in ONE currency per group: amounts in another currency than the record's are
// converted into it and rounded to the unit; without a rate they are not taken (MOD-303). SIM-034 / MOD-371: the other
// anonymous simulations of the same browser join the record too, the latest eligibility one marked saved.
import { Cookies, type CreditInput, type EligibilityInput } from '@dp/contracts';
import { convert, roundDp, type ConversionContext, type EligibilityOutputs } from '@dp/domain';
import type { Request } from 'express';
import { AppError } from '../platform/errors.js';
import type { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import type { ClientFacts } from './client-record.js';

export interface FollowupSimulation {
  id: string;
  type: 'ELIGIBILITY' | 'CREDIT';
  anonymousId: string;
  inputs: unknown;
  outputs: unknown;
}

export function anonymousIdOf(req: Request): string | null {
  const v = (req.cookies as Record<string, unknown> | undefined)?.[Cookies.anon];
  return typeof v === 'string' && /^[0-9a-f]{32}$/.test(v) ? v : null;
}

/** API-100 — only a simulation of the same `dp_anon` (no session yet in Phase 1 public forms) can be joined. */
export async function loadFollowupSimulation(prisma: PrismaService, id: string, anon: string | null): Promise<FollowupSimulation> {
  const sim = anon
    ? await prisma.simulation.findFirst({
        where: { id, anonymousId: anon, type: { in: ['ELIGIBILITY', 'CREDIT'] } },
        select: { id: true, type: true, anonymousId: true, inputs: true, outputs: true },
      })
    : null;
  if (!sim) throw AppError.validation([{ field: 'simulationId', code: 'INVALID_CHOICE' }]);
  return sim as FollowupSimulation;
}

type Group = { amounts: Record<string, string | null | undefined>; currency: string };

/** MOD-303 — the amounts of a group in the record's currency for that group (converted, unit), or null without a rate. */
function inCurrency(group: Group, target: string | null | undefined, ctx: ConversionContext): Group | null {
  if (!target || target === group.currency) return group;
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(group.amounts)) {
    if (v === null || v === undefined || v === '') {
      out[k] = null;
      continue;
    }
    const c = convert(v, group.currency, target, ctx);
    if (!c) return null;
    out[k] = roundDp(c.amount, 0).toFixed(0);
  }
  return { amounts: out, currency: target };
}

/** What the simulation tells about the person, for the record (MOD-300), converted per MOD-303. */
export function simulationFacts(
  sim: FollowupSimulation,
  record: { incomeCurrency?: string | null; downPaymentCurrency?: string | null; budgetCurrency?: string | null } | null,
  ctx: ConversionContext,
): Partial<ClientFacts> {
  const facts: Partial<ClientFacts> = {};
  if (sim.type === 'ELIGIBILITY') {
    const i = sim.inputs as EligibilityInput;
    const o = sim.outputs as EligibilityOutputs;
    facts.residencyStatus = i.residencyStatus;
    facts.countryOfResidence = i.countryOfResidence;
    facts.financingPreference = i.financingPreference;
    const income = inCurrency(
      { amounts: { monthlyIncome: i.monthlyIncome, otherMonthlyIncome: i.otherIncome ?? null, monthlyDebts: i.monthlyDebts }, currency: i.incomeCurrency },
      record?.incomeCurrency,
      ctx,
    );
    if (income) facts.income = { ...(income.amounts as Record<'monthlyIncome' | 'otherMonthlyIncome' | 'monthlyDebts', string | null>), currency: income.currency };
    const down = inCurrency({ amounts: { amount: i.downPayment }, currency: i.downPaymentCurrency }, record?.downPaymentCurrency, ctx);
    if (down?.amounts.amount) facts.downPayment = { amount: down.amounts.amount, currency: down.currency };
    if (o.maxBudget) {
      const budget = inCurrency({ amounts: { amount: o.maxBudget }, currency: o.displayCurrency }, record?.budgetCurrency, ctx);
      if (budget?.amounts.amount) facts.budget = { amount: budget.amounts.amount, currency: budget.currency, kind: 'TOTAL' };
    }
  } else {
    const stored = sim.inputs as { scenarios: CreditInput[]; activeIndex: number };
    const s = stored.scenarios[stored.activeIndex] ?? stored.scenarios[0];
    if (s?.mode === 'FROM_PRICE' && s.price) {
      const budget = inCurrency({ amounts: { amount: s.price }, currency: s.currency }, record?.budgetCurrency, ctx);
      if (budget?.amounts.amount) facts.budget = { amount: budget.amounts.amount, currency: budget.currency, kind: 'TOTAL' };
      const down = inCurrency({ amounts: { amount: s.downPayment ?? '0' }, currency: s.currency }, record?.downPaymentCurrency, ctx);
      if (down?.amounts.amount && Number(down.amounts.amount) > 0) facts.downPayment = { amount: down.amounts.amount, currency: down.currency };
    }
  }
  return facts;
}

/** The facts of the form first, the simulation's only where the form said nothing. */
export function mergeFacts(form: ClientFacts, fromSimulation: Partial<ClientFacts>): ClientFacts {
  const out: ClientFacts = { ...form };
  for (const [k, v] of Object.entries(fromSimulation) as [keyof ClientFacts, unknown][]) {
    if (out[k] === null || out[k] === undefined || out[k] === '') (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** DEM-016, SIM-034, MOD-371 — the simulation (and the other anonymous ones of the browser) joins the record. */
export async function attachSimulations(tx: Tx, sim: FollowupSimulation, clientId: string | null, now: Date): Promise<void> {
  if (!clientId) return;
  await tx.simulation.updateMany({ where: { anonymousId: sim.anonymousId, clientId: null }, data: { clientId, updatedAt: now } });
  const latest = await tx.simulation.findFirst({
    where: { anonymousId: sim.anonymousId, clientId, type: 'ELIGIBILITY' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (latest) await tx.simulation.update({ where: { id: latest.id }, data: { isSaved: true, updatedAt: now } });
}
