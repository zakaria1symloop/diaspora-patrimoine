// Package 3.3 — the tab « Simulations » of a client record (CRM-046): what the client saved, what he received by
// e-mail, the projections, and what the team made for him; « Rattacher au dossier » / « Détacher » (a dossier of the
// same client, API-100); « Faire une simulation »: EP-11 and EP-12 in the back office, prefilled with the record and
// computed by the SAME calculations as the public simulators (SIM-001, `simulations/calc.ts`), saved on the record
// with `clientId` and `createdById`, `isSaved` false — the client does not see them in « Mes simulations » (SFA-010).
import { refreshClientCaches } from '../leads/lead-records.js';
import { SettingsService } from '../platform/settings.service.js';
import { Injectable } from '@nestjs/common';
import {
  adminSimulationComputeSchemaFor,
  adminSimulationCreateSchemaFor,
  simulationAttachSchema,
  type AdminSimulationComputed,
  type AdminSimulationList,
  type AdminSimulationPrefill,
  type AdminSimulationRow,
  type CreditInput,
  type CreditResponse,
  type EligibilityInput,
} from '@dp/contracts';
import { writeAudit } from '../admin/audit.js';
import { StaffViews, dossierScope, type StaffView } from '../back-office/staff-view.js';
import { liveClients } from '../clients-admin/clients-read.service.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { computeCreditScenarios, computeEligibility, toEligibilityResult, type LinkedPrice } from '../simulations/calc.js';
import { headlineOf } from '../simulations/client-simulations.service.js';
import { SimulationContextService, parametersSnapshot } from '../simulations/context.js';

const UUID = /^[0-9a-f-]{36}$/i;
const money = (d: { toFixed(n: number): string } | null) => (d ? d.toFixed(2) : null);

/** CRM-046 — what the tab lists: saved, received by e-mail, made by the team, projections (never a mere calculation). */
export function listedSimulation(r: { type: string; isSaved: boolean; createdById: string | null; sentAt: Date | null; emailed: boolean }): AdminSimulationRow['origin'] | null {
  if (r.type === 'PROJECTION') return 'PROJECTION';
  if (r.createdById) return 'TEAM';
  if (r.isSaved) return 'CLIENT';
  if (r.emailed || r.sentAt) return 'EMAILED';
  return null;
}

@Injectable()
export class SimulationsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly views: StaffViews,
    private readonly context: SimulationContextService,
    private readonly settings: SettingsService,
  ) {}

  private year() {
    return this.clock.now().getUTCFullYear();
  }

  private async client(staff: StaffView, id: string) {
    if (!UUID.test(id)) throw AppError.notFound();
    const c = await this.prisma.client.findFirst({ where: { AND: [{ id }, liveClients(staff)] } });
    if (!c) throw AppError.notFound();
    return c;
  }

  private async linkedPrice(propertyId: string | undefined, lotId: string | undefined): Promise<LinkedPrice | null> {
    if (!propertyId) return null;
    const p = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { priceFrom: true, priceCurrency: true, lots: lotId ? { where: { id: lotId }, select: { price: true } } : false },
    });
    if (!p) return null;
    const lot = lotId && Array.isArray(p.lots) ? p.lots[0] : undefined;
    const amount = lot?.price ?? p.priceFrom;
    return amount ? { amount: amount.toString(), currency: p.priceCurrency } : null;
  }

  // ─── The tab (CRM-046) ────────────────────────────────────────────────────

  /** `GET /admin/clients/{id}/simulations` (`simulation.read`). */
  async list(auth: AuthContext, clientId: string): Promise<AdminSimulationList> {
    const staff = await this.views.of(auth);
    await this.client(staff, clientId);
    const rows = await this.prisma.simulation.findMany({
      where: { clientId, type: { in: ['ELIGIBILITY', 'CREDIT', 'PROJECTION'] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        property: { select: { reference: true, title: true } },
        dossier: { select: { id: true, reference: true, deletedAt: true } },
        _count: { select: { communications: true } },
      },
    });
    const data: AdminSimulationRow[] = [];
    for (const r of rows) {
      const origin = listedSimulation({ type: r.type, isSaved: r.isSaved, createdById: r.createdById, sentAt: r.sentAt, emailed: r._count.communications > 0 });
      if (!origin) continue;
      data.push({
        id: r.id,
        type: r.type as AdminSimulationRow['type'],
        label: r.label,
        createdAt: r.createdAt.toISOString(),
        origin,
        createdByName: r.createdBy ? [r.createdBy.firstName, r.createdBy.lastName].filter(Boolean).join(' ') || null : null,
        headline: headlineOf(r),
        property: r.property ? { reference: r.property.reference, title: r.property.title } : null,
        dossier: r.dossier && !r.dossier.deletedAt ? { id: r.dossier.id, reference: r.dossier.reference } : null,
      });
    }
    const dossiers = await this.prisma.dossier.findMany({
      where: { AND: [{ clientId, deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] } }, dossierScope(staff)] },
      orderBy: { createdAt: 'desc' },
      select: { id: true, reference: true, property: { select: { title: true } } },
    });
    return {
      data,
      dossiers: dossiers.map((d) => ({ id: d.id, reference: d.reference, label: d.property?.title ?? null })),
      can: { create: staff.has('simulation.create'), attach: staff.has('simulation.create') },
    };
  }

  /** `GET /admin/clients/{id}/simulations/prefill` (`simulation.create`) — the record's values (SIM-033 for the team). */
  async prefill(auth: AuthContext, clientId: string): Promise<AdminSimulationPrefill> {
    const staff = await this.views.of(auth);
    const c = await this.client(staff, clientId);
    const withheld = !staff.sensitive || staff.masked;
    return {
      clientName: [c.firstName, c.lastName].filter(Boolean).join(' ') || null,
      withheld,
      propertyCountry: c.preferredCountries[0] ?? null,
      residencyStatus: c.residencyStatus,
      countryOfResidence: c.countryOfResidence,
      birthYear: !withheld && c.birthDate ? c.birthDate.getUTCFullYear() : null,
      monthlyIncome: withheld ? null : money(c.monthlyIncome),
      otherIncome: withheld ? null : money(c.otherMonthlyIncome),
      monthlyDebts: withheld ? null : money(c.monthlyDebts),
      incomeCurrency: c.incomeCurrency,
      downPayment: withheld ? null : money(c.downPayment),
      downPaymentCurrency: c.downPaymentCurrency,
      financingPreference: c.financingPreference === 'CASH' ? null : c.financingPreference,
    };
  }

  // ─── « Faire une simulation » ─────────────────────────────────────────────

  private async computeEligibility(input: EligibilityInput) {
    const ctx = await this.context.load(this.clock.now(), input.propertyCountry);
    const linked = input.targetPriceLinked ? await this.linkedPrice(input.propertyId, input.lotId) : null;
    const { inputs, outputs } = computeEligibility(input, ctx, linked);
    return { ctx, linked, inputs, outputs, result: toEligibilityResult(outputs, inputs) };
  }

  private async computeCredit(scenarios: CreditInput[], activeIndex: number) {
    const ctx = await this.context.load(this.clock.now(), null);
    const linked = await Promise.all(scenarios.map((s) => (s.priceLinked && s.mode === 'FROM_PRICE' ? this.linkedPrice(s.propertyId, s.lotId) : Promise.resolve(null))));
    const response: CreditResponse = computeCreditScenarios({ scenarios, activeIndex: Math.min(activeIndex, scenarios.length - 1) }, ctx, (i) => linked[i] ?? null);
    return { ctx, linked, response };
  }

  /** `POST /admin/simulations/compute` (`simulation.create`) — the figures, nothing written. */
  async compute(auth: AuthContext, body: unknown): Promise<AdminSimulationComputed> {
    await this.views.of(auth);
    const input = parseOrThrow(adminSimulationComputeSchemaFor(this.year()), body ?? {});
    if (input.type === 'ELIGIBILITY') return { type: 'ELIGIBILITY', result: (await this.computeEligibility(input.input)).result };
    return { type: 'CREDIT', result: (await this.computeCredit(input.scenarios, input.activeIndex)).response };
  }

  /** `POST /admin/simulations` (`simulation.create`) — computed again, then saved on the record. */
  async create(auth: AuthContext, body: unknown): Promise<{ id: string } & AdminSimulationComputed> {
    const staff = await this.views.of(auth);
    const input = parseOrThrow(adminSimulationCreateSchemaFor(this.year()), body ?? {});
    const client = await this.client(staff, input.clientId);
    if (client.gdprErasedAt) throw AppError.conflictState('CLIENT_ERASED');
    const id = newId();
    const now = this.clock.now();
    if (input.type === 'ELIGIBILITY') {
      const c = await this.computeEligibility(input.input);
      await this.prisma.$transaction(async (tx) => {
        await tx.simulation.create({
          data: {
            id,
            type: 'ELIGIBILITY',
            clientId: client.id,
            createdById: auth.userId,
            label: input.label,
            propertyId: input.input.propertyId ?? null,
            lotId: input.input.lotId ?? null,
            bankProductId: c.outputs.bestProductId,
            inputs: { ...input.input, linkedPrice: c.linked } as never,
            outputs: c.outputs as never,
            parametersSnapshot: parametersSnapshot(c.ctx, c.outputs.products.map((x) => x.productId), c.outputs.rateDates) as never,
            isSaved: false,
            locale: 'fr',
            createdAt: now,
            updatedAt: now,
          },
        });
        await writeAudit(tx, auth.actor, now, { action: 'simulation.created', entityType: 'Simulation', entityId: id, clientId: client.id, after: { type: 'ELIGIBILITY' } });
        await refreshClientCaches(tx, client.id, now, await this.settings.get('clients.inactiveAfterDays')); // CAL-070
      });
      return { id, type: 'ELIGIBILITY', result: c.result };
    }
    const activeIndex = Math.min(input.activeIndex, input.scenarios.length - 1);
    const c = await this.computeCredit(input.scenarios, activeIndex);
    const active = input.scenarios[activeIndex]!;
    // the monthly detail is recomputed from the inputs when needed; the stored outputs keep the years (as SIM-032)
    const outputs = { ...c.response, scenarios: c.response.scenarios.map((s) => ({ ...s, schedule: s.schedule.map((y) => ({ ...y, months: [] })) })) };
    await this.prisma.$transaction(async (tx) => {
      await tx.simulation.create({
        data: {
          id,
          type: 'CREDIT',
          clientId: client.id,
          createdById: auth.userId,
          label: input.label,
          propertyId: active.propertyId ?? null,
          lotId: active.lotId ?? null,
          bankProductId: active.bankProductId ?? null,
          inputs: { scenarios: input.scenarios, activeIndex, linkedPrices: c.linked } as never,
          outputs: outputs as never,
          parametersSnapshot: parametersSnapshot(
            c.ctx,
            input.scenarios.map((s) => s.bankProductId ?? null),
            c.response.scenarios.some((s) => s.rateDate) ? Object.fromEntries(c.ctx.conversion.rates.map((r) => [`${r.base}/${r.quote}`, r.asOf])) : {},
          ) as never,
          isSaved: false,
          locale: 'fr',
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, auth.actor, now, { action: 'simulation.created', entityType: 'Simulation', entityId: id, clientId: client.id, after: { type: 'CREDIT' } });
    });
    return { id, type: 'CREDIT', result: c.response };
  }

  // ─── Attach, detach (CRM-046, API-100) ────────────────────────────────────

  private async simulationOf(tx: Pick<PrismaService, 'simulation' | '$queryRawUnsafe'>, staff: StaffView, id: string) {
    if (!UUID.test(id)) throw AppError.notFound();
    await tx.$queryRawUnsafe(`SELECT id FROM simulations WHERE id = $1::uuid FOR UPDATE`, id);
    const sim = await tx.simulation.findUnique({ where: { id }, select: { id: true, clientId: true, dossierId: true } });
    if (!sim?.clientId) throw AppError.notFound();
    const visible = await this.prisma.client.findFirst({ where: { AND: [{ id: sim.clientId }, liveClients(staff)] }, select: { id: true } });
    if (!visible) throw AppError.notFound();
    return sim as { id: string; clientId: string; dossierId: string | null };
  }

  /** `POST /admin/simulations/{id}/attach` (`simulation.create`) — `{dossierId}`: a live dossier of the same client. */
  async attach(auth: AuthContext, id: string, body: unknown): Promise<{ id: string; dossierId: string }> {
    const { dossierId } = parseOrThrow(simulationAttachSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const sim = await this.simulationOf(tx, staff, id);
      const dossier = await tx.dossier.findFirst({ where: { AND: [{ id: dossierId, deletedAt: null }, dossierScope(staff)] }, select: { id: true, clientId: true, status: true } });
      if (!dossier) throw AppError.validation([{ field: 'dossierId', code: 'INVALID_CHOICE' }]);
      if (dossier.clientId !== sim.clientId) throw AppError.validation([{ field: 'dossierId', code: 'INVALID_CHOICE' }]);
      if (sim.dossierId === dossier.id) return;
      await tx.simulation.update({ where: { id }, data: { dossierId: dossier.id, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'simulation.updated', entityType: 'Simulation', entityId: id, clientId: sim.clientId, dossierId: dossier.id, before: { dossierId: sim.dossierId }, after: { dossierId: dossier.id } });
    });
    return { id, dossierId };
  }

  /** `POST /admin/simulations/{id}/detach` (`simulation.create`). */
  async detach(auth: AuthContext, id: string): Promise<{ id: string }> {
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const sim = await this.simulationOf(tx, staff, id);
      if (!sim.dossierId) return;
      await tx.simulation.update({ where: { id }, data: { dossierId: null, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'simulation.updated', entityType: 'Simulation', entityId: id, clientId: sim.clientId, dossierId: sim.dossierId, before: { dossierId: sim.dossierId }, after: { dossierId: null } });
    });
    return { id };
  }
}
