// Package 3.3 — the tab « Simulations » of a client record (CRM-046) and « Faire une simulation »: the two simulators
// of EP-11 and EP-12 in the back office, prefilled with the record, computed by the same calculations as the public
// simulators (SIM-001) and saved on the record with `clientId` and `createdById`, `isSaved` false (the client does not
// see them in « Mes simulations », and AUT-091 does not purge them).
import { z } from 'zod';
import type { SimulationHeadline, SimulatorPrefill } from './client-tools.js';
import { SIM_SCENARIOS_MAX, creditInputSchema, eligibilityInputSchemaFor, type CreditResponse, type EligibilityResult } from './schemas/simulations.js';

export type AdminSimulationOrigin = 'CLIENT' | 'TEAM' | 'EMAILED' | 'PROJECTION';

/** One line of `GET /admin/clients/{id}/simulations` (`simulation.read`). */
export interface AdminSimulationRow {
  id: string;
  type: 'ELIGIBILITY' | 'CREDIT' | 'PROJECTION';
  label: string | null;
  createdAt: string;
  /** Saved by the client · made by the team · received by e-mail · projection. */
  origin: AdminSimulationOrigin;
  createdByName: string | null;
  headline: SimulationHeadline | null;
  property: { reference: string; title: string } | null;
  dossier: { id: string; reference: string } | null;
}

export interface AdminSimulationList {
  data: AdminSimulationRow[];
  /** The live dossiers of the client: where « Rattacher au dossier » may attach (API-100: a dossier of the same client). */
  dossiers: { id: string; reference: string; label: string | null }[];
  can: { create: boolean; attach: boolean };
}

/** `GET /admin/clients/{id}/simulations/prefill` (`simulation.create`) — financial values only with `client.sensitive.read`. */
export interface AdminSimulationPrefill extends SimulatorPrefill {
  clientName: string | null;
  /** The financial values were withheld (ROL-019). */
  withheld: boolean;
}

export function adminSimulationComputeSchemaFor(currentYear: number) {
  return z.discriminatedUnion(
    'type',
    [
      z.object({ type: z.literal('ELIGIBILITY'), input: eligibilityInputSchemaFor(currentYear) }),
      z.object({
        type: z.literal('CREDIT'),
        scenarios: z.array(creditInputSchema).min(1, { error: 'REQUIRED' }).max(SIM_SCENARIOS_MAX, { error: 'OUT_OF_RANGE' }),
        activeIndex: z.number().int().min(0).max(SIM_SCENARIOS_MAX - 1).default(0),
      }),
    ],
    { error: 'INVALID_CHOICE' },
  );
}

/** `POST /admin/simulations/compute` — computed, nothing written. */
export type AdminSimulationComputed = { type: 'ELIGIBILITY'; result: EligibilityResult } | { type: 'CREDIT'; result: CreditResponse };

/** `POST /admin/simulations` (`simulation.create`) — the same body, plus the client (and an optional label). */
export function adminSimulationCreateSchemaFor(currentYear: number) {
  return z.intersection(
    adminSimulationComputeSchemaFor(currentYear),
    z.object({
      clientId: z.uuid(),
      label: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().trim().max(120, { error: 'TOO_LONG' }).nullable()).default(null),
    }),
  );
}

export const simulationAttachSchema = z.strictObject({ dossierId: z.uuid() });
