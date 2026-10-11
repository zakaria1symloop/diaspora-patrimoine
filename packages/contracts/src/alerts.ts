// CAT-070 … CAT-072 (alert from the catalogue), SFA-035 (EP-26 page with a token), PRO-031 / NOT-020 … NOT-022
// (EP-27 e-mail preferences without signing in) — shapes shared by the API and the site.
import { z } from 'zod';
import type { CatalogueCriteria } from './catalogue.js';

export const ALERT_FREQUENCIES = ['INSTANT', 'DAILY', 'WEEKLY'] as const;
export type AlertSendFrequency = (typeof ALERT_FREQUENCIES)[number];

/** CAT-072, Q-055 — keys never stored in an alert (nor in a saved search, CAT-093). */
export const ALERT_IGNORED_KEYS = ['sort', 'page', 'availability', 'vue', 'groupe', 'bbox'] as const satisfies readonly (keyof CatalogueCriteria)[];

/** The criteria an alert keeps: the catalogue criteria without the presentation keys of Q-055. */
export function alertCriteriaOf(c: CatalogueCriteria): CatalogueCriteria {
  const out: CatalogueCriteria = { ...c };
  for (const k of ALERT_IGNORED_KEYS) delete out[k];
  return out;
}

/** Ten active alerts per address (CAT-072); saved searches have their own limit (CAT-093, Q-051). */
export const ALERTS_MAX_ACTIVE = 10;
export const SAVED_SEARCHES_MAX = 20;
/** CAT-071 — the confirmation link lives 7 days. */
export const ALERT_CONFIRM_DAYS = 7;

export const createAlertSchema = z.object({
  email: z.email({ error: 'INVALID_EMAIL' }).max(254),
  frequency: z.enum(ALERT_FREQUENCIES).default('DAILY'),
  /** The catalogue address parameters (CAT-020); parsed again by the server, unknown keys ignored. */
  criteria: z.record(z.string(), z.string().max(400)).default({}),
});
export type CreateAlertInput = z.input<typeof createAlertSchema>;

export interface CreateAlertResult {
  /** CAT-071: e-mail sent (also for an unconfirmed duplicate, TRV-112) · active at once (signed-in client) · CAT-072 duplicate. */
  outcome: 'CONFIRMATION_SENT' | 'ACTIVE' | 'ALREADY_EXISTS';
}

export type AlertState = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';

/** EP-26 — what the page with a token shows. Never the address itself in clear (masked). */
export interface AlertView {
  /** The long-lived management token: the page keeps working after a 7-day confirmation link (SFA-035). */
  token: string;
  label: string;
  criteria: CatalogueCriteria;
  /** `/programmes?…` with the alert's criteria (« Voir les biens »). */
  resultsPath: string;
  frequency: AlertSendFrequency;
  state: AlertState;
  emailMasked: string;
  expiresAt: string;
  pausedAt: string | null;
  lastSentAt: string | null;
  hasAccount: boolean;
}

/** What an action reached through a link did (SFA-035 table). */
export interface AlertActionResult {
  view: AlertView;
  done: 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'EXTENDED' | 'SAVED' | 'STOPPED' | 'RESTORED';
}

export const patchAlertSchema = z.union([
  z.object({ frequency: z.enum(ALERT_FREQUENCIES) }).strict(),
  z.object({ paused: z.boolean() }).strict(),
  /** « Annuler » after « Supprimer l'alerte » (TRV-081): within 10 minutes of the stop. */
  z.object({ restore: z.literal(true) }).strict(),
]);
export type PatchAlertInput = z.infer<typeof patchAlertSchema>;

/** « Recevoir un nouveau lien » — same answer for every address (TRV-112). */
export const linkRequestSchema = z.object({ email: z.email({ error: 'INVALID_EMAIL' }).max(254) });

// ---------- e-mail preferences (NOT-020, PRO-030, PRO-031) ----------

/** Client groups of NOT-020, in the order of the screen. « Indispensables » is not a group (always sent). */
export const CLIENT_PREFERENCE_GROUPS = ['REMINDERS', 'MESSAGES', 'PROJECT_NEWS', 'CAFE', 'ALERTS', 'SURVEYS', 'NEWS'] as const;
export type ClientPreferenceGroup = (typeof CLIENT_PREFERENCE_GROUPS)[number];

export interface PreferencesView {
  emailMasked: string;
  /** Groups that concern this person (PRO-031): all of them with an account, else news, alerts, Café (+ project groups with a dossier). */
  groups: { group: ClientPreferenceGroup; emailEnabled: boolean }[];
  hasAccount: boolean;
}

export const patchPreferencesSchema = z.union([
  z.object({ group: z.enum(CLIENT_PREFERENCE_GROUPS), emailEnabled: z.boolean() }).strict(),
  /** « Ne garder que l'indispensable » */
  z.object({ essentialOnly: z.literal(true) }).strict(),
]);
export type PatchPreferencesInput = z.infer<typeof patchPreferencesSchema>;

export interface UnsubscribeResult {
  kind: 'GROUP' | 'ALERT';
  group: ClientPreferenceGroup | null;
}
