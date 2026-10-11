// EC-40 « Mes simulations » (SFA-010 … SFA-013) and SIM-033 (signed-in prefill, « Mettre à jour mon profil avec ces
// informations »): the saved simulations of the client and the projections his advisor sent him, read as computed
// (MOD-370: inputs, outputs and parameters are never recomputed), renamed, removed from the list (`isSaved = false`:
// nothing is erased by this gesture, AUT-091 purges what is attached to nothing), downloaded as PDF.
import { Inject, Injectable } from '@nestjs/common';
import {
  SAVED_SIMULATIONS_MAX,
  renameSimulationSchema,
  type ClientSimulationDetail,
  type ClientSimulationItem,
  type ClientSimulationList,
  type CreditResponse,
  type EligibilityInput,
  type SimulationHeadline,
  type SimulatorPrefill,
} from '@dp/contracts';
import type { EligibilityOutputs } from '@dp/domain';
import type { Simulation } from '../generated/prisma/client.js';
import { writeAudit } from '../admin/audit.js';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../files/object-storage.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { eligibilityDomainInputs, toEligibilityResult, type LinkedPrice } from './calc.js';
import { SimulationsService } from './simulations.service.js';

type StoredEligibility = EligibilityInput & { linkedPrice?: LinkedPrice | null };
type StoredCredit = { scenarios: { amount?: string; price?: string; downPayment?: string; currency: string; durationMonths: number; annualRateBps?: number; bankProductId?: string; propertyId?: string }[]; activeIndex: number };

const LISTED_TYPES = ['ELIGIBILITY', 'CREDIT', 'PROJECTION'] as const;

@Injectable()
export class ClientSimulationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly sims: SimulationsService,
    private readonly index: CatalogueIndex,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private clientIdOf(ctx: AuthContext): string {
    if (!ctx.clientId) throw AppError.notFound();
    return ctx.clientId;
  }

  /** SFA-010 — saved simulations + projections sent (`sentAt`), most recent first. */
  private listedWhere(clientId: string) {
    return {
      clientId,
      type: { in: [...LISTED_TYPES] },
      OR: [{ isSaved: true, type: { in: ['ELIGIBILITY' as const, 'CREDIT' as const] } }, { type: 'PROJECTION' as const, sentAt: { not: null } }],
    };
  }

  private async own(ctx: AuthContext, id: string): Promise<Simulation> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw AppError.notFound();
    const sim = await this.prisma.simulation.findFirst({ where: { id, ...this.listedWhere(this.clientIdOf(ctx)) } });
    if (!sim) throw AppError.notFound();
    return sim;
  }

  async list(ctx: AuthContext): Promise<ClientSimulationList> {
    const rows = await this.prisma.simulation.findMany({ where: this.listedWhere(this.clientIdOf(ctx)), orderBy: { createdAt: 'desc' }, take: 100 });
    const items = await this.items(rows);
    return { data: items, max: SAVED_SIMULATIONS_MAX };
  }

  private async items(rows: Simulation[]): Promise<ClientSimulationItem[]> {
    const propertyIds = [...new Set(rows.map((r) => r.propertyId).filter((x): x is string => Boolean(x)))];
    const [props, online] = await Promise.all([
      propertyIds.length ? this.prisma.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, reference: true, title: true, slug: true } }) : [],
      this.index.rows(),
    ]);
    const onlineIds = new Set(online.map((r) => r.id));
    return rows.map((r) => {
      const p = props.find((x) => x.id === r.propertyId);
      return {
        id: r.id,
        type: r.type as ClientSimulationItem['type'],
        label: r.label,
        createdAt: r.createdAt.toISOString(),
        headline: headlineOf(r),
        property: p ? { reference: p.reference, title: p.title, slug: onlineIds.has(p.id) ? p.slug : null, online: onlineIds.has(p.id) } : null,
        canEdit: r.type !== 'PROJECTION',
      };
    });
  }

  /** SFA-011 « Ouvrir » — the result as computed, and what « Refaire avec les barèmes actuels » needs. */
  async detail(ctx: AuthContext, id: string): Promise<ClientSimulationDetail> {
    const sim = await this.own(ctx, id);
    const [item] = await this.items([sim]);
    const inputs = (sim.inputs ?? {}) as Record<string, unknown>;
    let productGone = false;
    if (sim.bankProductId) {
      const p = await this.prisma.bankProduct.findUnique({ where: { id: sim.bankProductId }, select: { isActive: true, deletedAt: true } });
      productGone = !p || !p.isActive || Boolean(p.deletedAt);
    }
    let eligibilityResult: Record<string, unknown> | null = null;
    if (sim.type === 'ELIGIBILITY') {
      const stored = inputs as StoredEligibility;
      try {
        eligibilityResult = toEligibilityResult(sim.outputs as unknown as EligibilityOutputs, eligibilityDomainInputs(stored, stored.linkedPrice ?? null)) as unknown as Record<string, unknown>;
      } catch {
        eligibilityResult = null;
      }
    }
    return {
      ...item!,
      inputs,
      outputs: (sim.outputs ?? {}) as Record<string, unknown>,
      productGone,
      propertyGone: Boolean(sim.propertyId) && !item!.property?.online,
      eligibilityResult,
    };
  }

  /** SFA-011 « Renommer » — free name, 120 characters; empty: « Simulation du {date} » (the screen composes it). */
  async rename(ctx: AuthContext, id: string, body: unknown): Promise<ClientSimulationItem> {
    const { label } = parseOrThrow(renameSimulationSchema, body ?? {});
    const sim = await this.own(ctx, id);
    if (sim.type === 'PROJECTION') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const updated = await this.prisma.simulation.update({ where: { id }, data: { label: label?.trim() || null, updatedAt: this.clock.now() } });
    return (await this.items([updated]))[0]!;
  }

  /** SFA-011 « Supprimer » — `isSaved = false`; nothing erased by this gesture (AUT-091, MOD-371). */
  async remove(ctx: AuthContext, id: string): Promise<void> {
    const sim = await this.own(ctx, id);
    if (sim.type === 'PROJECTION') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    await this.prisma.simulation.update({ where: { id }, data: { isSaved: false, updatedAt: this.clock.now() } });
  }

  /** SFA-011 « Télécharger (PDF) », SIM-040 — a projection's stored PDF, else the simulation's PDF from its stored result. */
  async pdf(ctx: AuthContext, id: string): Promise<{ filename: string; content: Buffer }> {
    const sim = await this.own(ctx, id);
    if (sim.pdfStorageKey) {
      const content = await this.storage.get('private', sim.pdfStorageKey);
      if (content) return { filename: `${sim.type === 'PROJECTION' ? 'projection' : 'simulation'}-${sim.createdAt.toISOString().slice(0, 10)}.pdf`, content };
    }
    if (sim.type === 'PROJECTION') throw AppError.notFound();
    return this.sims.storedPdf(sim);
  }

  // ─── SIM-033 ─────────────────────────────────────────────────────────────

  /** Steps 1 and 2 prefilled with what the record contains (situation, country, birth year, income, debts, down payment). */
  async prefill(ctx: AuthContext): Promise<SimulatorPrefill> {
    const c = await this.prisma.client.findUnique({
      where: { id: this.clientIdOf(ctx) },
      select: {
        preferredCountries: true,
        residencyStatus: true,
        countryOfResidence: true,
        birthDate: true,
        monthlyIncome: true,
        otherMonthlyIncome: true,
        monthlyDebts: true,
        incomeCurrency: true,
        downPayment: true,
        downPaymentCurrency: true,
        financingPreference: true,
      },
    });
    if (!c) throw AppError.notFound();
    const money = (d: { toFixed(n: number): string } | null) => (d ? d.toFixed(2) : null);
    return {
      propertyCountry: c.preferredCountries[0] ?? null,
      residencyStatus: c.residencyStatus,
      countryOfResidence: c.countryOfResidence,
      birthYear: c.birthDate ? c.birthDate.getUTCFullYear() : null,
      monthlyIncome: money(c.monthlyIncome),
      otherIncome: money(c.otherMonthlyIncome),
      monthlyDebts: money(c.monthlyDebts),
      incomeCurrency: c.incomeCurrency,
      downPayment: money(c.downPayment),
      downPaymentCurrency: c.downPaymentCurrency,
      financingPreference: c.financingPreference === 'CASH' ? null : c.financingPreference,
    };
  }

  /**
   * SIM-033 « Mettre à jour mon profil avec ces informations » (unchecked by default) — copies the inputs of the client's
   * own eligibility simulation into his record. The birth DATE is not written from a year (prudent: no invented day).
   */
  async applyToProfile(ctx: AuthContext, id: string): Promise<{ updated: string[] }> {
    const clientId = this.clientIdOf(ctx);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw AppError.notFound();
    const sim = await this.prisma.simulation.findFirst({ where: { id, clientId, type: 'ELIGIBILITY' } });
    if (!sim) throw AppError.notFound();
    const i = sim.inputs as StoredEligibility;
    const before = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    const data = {
      residencyStatus: i.residencyStatus,
      countryOfResidence: i.countryOfResidence,
      monthlyIncome: i.monthlyIncome,
      otherMonthlyIncome: i.otherIncome ?? null,
      monthlyDebts: i.monthlyDebts,
      incomeCurrency: i.incomeCurrency,
      downPayment: i.downPayment,
      downPaymentCurrency: i.downPaymentCurrency ?? i.incomeCurrency,
      ...(i.financingPreference && i.financingPreference !== 'NO_PREFERENCE' ? { financingPreference: i.financingPreference } : {}),
      ...(before.preferredCountries.length ? {} : { preferredCountries: [i.propertyCountry] }),
    };
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id: clientId }, data: { ...data, version: { increment: 1 }, updatedAt: now } });
      // SEC-033 sensitive values are not written to the audit log: the names of the fields only.
      await writeAudit(tx, ctx.actor, now, { action: 'client.updated', entityType: 'client', entityId: clientId, after: { fields: Object.keys(data), source: 'simulation' }, clientId });
    });
    return { updated: Object.keys(data) };
  }
}

/** SFA-010 — the main result as it was computed (« ≈ » only before a converted amount). */
export function headlineOf(sim: Pick<Simulation, 'type' | 'inputs' | 'outputs'>): SimulationHeadline | null {
  if (sim.type === 'ELIGIBILITY') {
    const stored = sim.inputs as StoredEligibility;
    try {
      const r = toEligibilityResult(sim.outputs as unknown as EligibilityOutputs, eligibilityDomainInputs(stored, stored.linkedPrice ?? null));
      const converted = r.approx.figures;
      if (r.shown.maxBudget) return { kind: 'BUDGET', amount: r.shown.maxBudget, converted };
      if (r.shown.capacity) return { kind: 'CAPACITY', amount: r.shown.capacity, converted };
      return { kind: 'NOT_ELIGIBLE' };
    } catch {
      return null;
    }
  }
  const out = sim.outputs as unknown as CreditResponse | null;
  const inputs = sim.inputs as StoredCredit | null;
  const idx = inputs?.activeIndex ?? 0;
  const r = out?.scenarios?.[idx] ?? out?.scenarios?.[0];
  if (!r?.monthlyPayment) return null;
  return { kind: 'MONTHLY', amount: r.monthlyPayment, durationMonths: r.durationMonths, principal: r.amount, annualRateBps: r.annualRateBps, converted: Boolean(r.productCurrency) };
}
