// EC-40 (SFA-010 … SFA-013), SIM-033, EC-41 (SFA-020 … SFA-024), EC-42 (SFA-030, SFA-031) and CAT-093 — the client's
// own tools: saved simulations, favourites, alerts and saved searches. Shapes shared by the API and the site.
import { z } from 'zod';
import { ALERT_FREQUENCIES, type AlertSendFrequency } from './alerts.js';
import type { CatalogueCriteria, PropertyCard } from './catalogue.js';

interface MoneyValue {
  amount: string;
  currency: string;
}

// ---------- EC-40 — saved simulations ----------

/** SFA-012 — thirty saved simulations at most. */
export const SAVED_SIMULATIONS_MAX = 30;
export const SIMULATION_LABEL_MAX = 120;

export type ClientSimulationType = 'ELIGIBILITY' | 'CREDIT' | 'PROJECTION';

/** SFA-010 — the main result as it was computed. */
export type SimulationHeadline =
  | { kind: 'BUDGET'; amount: MoneyValue; converted: boolean }
  | { kind: 'CAPACITY'; amount: MoneyValue; converted: boolean }
  | { kind: 'MONTHLY'; amount: MoneyValue; durationMonths: number; principal: MoneyValue | null; annualRateBps: number | null; converted: boolean }
  | { kind: 'NOT_ELIGIBLE' };

export interface ClientSimulationItem {
  id: string;
  type: ClientSimulationType;
  /** Null: « Simulation du {date} » (SFA-011). */
  label: string | null;
  createdAt: string;
  headline: SimulationHeadline | null;
  property: { reference: string; title: string; slug: string | null; online: boolean } | null;
  /** A projection sent by the advisor is neither renamed nor deleted (SFA-011). */
  canEdit: boolean;
}

export interface ClientSimulationList {
  data: ClientSimulationItem[];
  max: number;
}

/** « Ouvrir » — the result as computed (MOD-370) and what « Refaire avec les barèmes actuels » needs. */
export interface ClientSimulationDetail extends ClientSimulationItem {
  /** Inputs as sent to the simulator (eligibility wire input, or the credit scenarios). */
  inputs: Record<string, unknown>;
  /** The stored outputs (eligibility domain result, or the credit response). */
  outputs: Record<string, unknown>;
  /** SFA-011 — the financing solution used then is no longer offered: the simulator starts from the indicative scale. */
  productGone: boolean;
  /** SFA-011 — the property is no longer online: the simulator opens without it, with the price of then. */
  propertyGone: boolean;
  /** The figures of the eligibility result screen, recomputed from the stored outputs (no new calculation). */
  eligibilityResult: Record<string, unknown> | null;
}

export const renameSimulationSchema = z.strictObject({
  label: z.string().trim().max(SIMULATION_LABEL_MAX).nullable(),
});

/** SIM-033 — what the client's record already knows, to prefill steps 1 and 2 of the eligibility simulator. */
export interface SimulatorPrefill {
  propertyCountry: string | null;
  residencyStatus: string | null;
  countryOfResidence: string | null;
  birthYear: number | null;
  monthlyIncome: string | null;
  otherIncome: string | null;
  monthlyDebts: string | null;
  incomeCurrency: string | null;
  downPayment: string | null;
  downPaymentCurrency: string | null;
  financingPreference: 'CONVENTIONAL' | 'ISLAMIC' | 'NO_PREFERENCE' | null;
}

// ---------- EC-41 — favourites of the account ----------

/** SFA-023 — one hundred favourites at most. */
export const FAVORITES_MAX_ACCOUNT = 100;
/** SFA-022 — an archived property stays 30 days with « Ce bien n'est plus proposé ». */
export const FAVORITE_GONE_DAYS = 30;

/** AUT-062 — what changed on a favourite since it was added (the last change the client was told about). */
export type FavoriteChangeKind = 'PRICE_DROP' | 'LAST_LOTS' | 'UNAVAILABLE';
export interface FavoriteChangeNote {
  /** Null for a change recorded before the kind was kept. */
  kind: FavoriteChangeKind | null;
  /** The sentence of the notification, rendered at the time in the client's language (NOT-031). */
  title: string;
  at: string;
}

/** SFA-022 — the client already told us this property interests him: the card leads to « Mes intérêts » instead. */
export interface FavoriteInterest {
  status: 'PROPOSED' | 'VIEWED' | 'INTERESTED' | 'DECLINED' | 'VISIT_REQUESTED' | 'VISIT_PLANNED' | 'VISITED' | 'SELECTED' | 'UNAVAILABLE';
  since: string;
}

interface FavoriteBase {
  propertyId: string;
  reference: string;
  addedAt: string;
  change: FavoriteChangeNote | null;
  interest: FavoriteInterest | null;
}

export type AccountFavorite =
  | (FavoriteBase & { state: 'ONLINE'; card: PropertyCard })
  | (FavoriteBase & { state: 'GONE'; title: string; archivedAt: string | null });

export interface AccountFavoritesResponse {
  data: AccountFavorite[];
  /** The references only, for the hearts of the pages (one light call). */
  references: string[];
  max: number;
  referenceDownPaymentPct: string;
}

export interface FavoriteToggleResponse {
  reference: string;
  favorite: boolean;
  count: number;
}

// ---------- EC-42 — alerts and saved searches of the account ----------

export type AccountAlertState = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';

export interface AccountAlert {
  id: string;
  /** `SEARCH`: a saved search (frequency NONE, sends nothing, CAT-093). */
  kind: 'ALERT' | 'SEARCH';
  label: string;
  criteria: CatalogueCriteria;
  /** `/programmes?…` with the criteria (« Voir les biens », « Lancer »). */
  resultsPath: string;
  frequency: AlertSendFrequency | null;
  state: AccountAlertState;
  expiresAt: string | null;
  pausedAt: string | null;
  lastSentAt: string | null;
  createdAt: string;
}

export interface AccountAlertsResponse {
  alerts: AccountAlert[];
  searches: AccountAlert[];
  limits: { alerts: number; searches: number; lifetimeDays: number };
}

export const createAccountAlertSchema = z.strictObject({
  /** NONE = « Enregistrer cette recherche » (CAT-093). */
  frequency: z.enum([...ALERT_FREQUENCIES, 'NONE']).default('DAILY'),
  criteria: z.record(z.string(), z.string().max(400)).default({}),
});

export interface CreateAccountAlertResult {
  outcome: 'ACTIVE' | 'SAVED' | 'ALREADY_EXISTS';
  alert: AccountAlert;
}

export const patchAccountAlertSchema = z.union([
  z.strictObject({ frequency: z.enum(ALERT_FREQUENCIES) }),
  z.strictObject({ paused: z.boolean() }),
  /** « Prolonger » (AUT-061) — also reactivates an expired alert. */
  z.strictObject({ extend: z.literal(true) }),
  /** A pending alert made without an account at the same address: the account proves the address. */
  z.strictObject({ confirm: z.literal(true) }),
  /** CAT-093 « Renommer » (a saved search). */
  z.strictObject({ label: z.string().trim().min(1).max(120) }),
  /** SFA-031 « Modifier les critères » → « Mettre à jour l'alerte ». */
  z.strictObject({ criteria: z.record(z.string(), z.string().max(400)) }),
]);
export type PatchAccountAlertInput = z.infer<typeof patchAccountAlertSchema>;
