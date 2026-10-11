// 02-site-public/05 — pure helpers of the public request forms: kind of a submission (DEM-015), response (DEM-027),
// day validation (DEM-008), referrer (NAV-053), facts for the client record (MOD-300), limits (DEM-032).
import { createHash } from 'node:crypto';
import { leadSubmitSchema, preferredChannelToContactChannel, type LeadKind, type LeadSubmitRequest, type LeadSubmitResponse } from '@dp/contracts';
import { addBusinessDays, isWorkingDay, localDate, type BusinessCalendar } from '@dp/domain';
import { AppError } from '../platform/errors.js';
import type { RateRule } from '../platform/rate-limit.js';
import { parseOrThrow } from '../platform/validation.js';
import type { ClientFacts } from './client-record.js';
import type { ResolvedObject } from './lead-objects.js';

/** DEM-032 — per IP: 5 an hour and 20 a day, all forms together; per e-mail address: 5 a day. */
export const LEAD_RATE_RULES = {
  ipHour: { limit: 5, windowSeconds: 3600 },
  ipDay: { limit: 20, windowSeconds: 86_400 },
  emailDay: { limit: 5, windowSeconds: 86_400 },
} as const satisfies Record<string, RateRule>;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** DEM-015 — « Être rappelé » from the contact page is a real callback request. */
export function kindOf(input: LeadSubmitRequest): LeadKind {
  if (input.form === 'CONTACT_MESSAGE' && input.fields.subject === 'CALLBACK') return 'CALLBACK_REQUEST';
  return input.form;
}

/** DEM-027 — exactly the same shape for every anonymous outcome (created, supplemented, spam). */
export function buildResponse(
  kind: LeadKind,
  fields: Record<string, unknown>,
  outcome: ResolvedObject['outcome'],
  completionToken: string | null,
): LeadSubmitResponse {
  const response: LeadSubmitResponse = {
    kind,
    firstName: (fields.firstName as string | undefined) ?? null,
    email: fields.email as string,
    preferredCallbackDate: (fields.preferredCallbackDate as string | undefined) ?? null,
    preferredSlot: (fields.preferredSlot as LeadSubmitResponse['preferredSlot'] | undefined) ?? null,
    accountHint: fields.createAccount === true,
    propertyOutcome: outcome,
  };
  if (kind === 'PROJECTION_REQUEST' && completionToken) response.completionToken = completionToken;
  return response;
}

export const asDate = (iso: string | null | undefined) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

/** Schema check (TRV-064 codes) of every public form, SIMULATION_FOLLOWUP included (DEM-016). */
export function parseLead(body: unknown): LeadSubmitRequest {
  return parseOrThrow(leadSubmitSchema, body);
}

/**
 * DEM-008 — the day is « Dès que possible » or one of the next working days of the team calendar (PAR-030). Prudent
 * reading: today up to the 5th working day after today, with one day of tolerance at each end for time zones.
 */
export function validateCallbackDate(iso: string | undefined, now: Date, cal: BusinessCalendar): void {
  if (!iso) return;
  const today = localDate(now, cal);
  const yesterday = new Date(new Date(`${today}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  if (iso < yesterday) throw AppError.validation([{ field: 'fields.preferredCallbackDate', code: 'DATE_NOT_FUTURE' }]);
  const last = localDate(addBusinessDays(new Date(`${today}T12:00:00Z`), 6, cal), cal);
  if (iso > last || !isWorkingDay(iso, cal)) throw AppError.validation([{ field: 'fields.preferredCallbackDate', code: 'INVALID_CHOICE' }]);
}

/** NAV-053 — only the DOMAIN of the referring site is kept. */
export function referrerDomain(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.slice(0, 400) || null;
  } catch {
    return null;
  }
}

/** What a form says about the person, for the client record (MOD-300). */
export function clientFacts(input: LeadSubmitRequest, f: Record<string, unknown>, regionId: string | null, currency: string): ClientFacts {
  const s = (k: string) => (f[k] as string | undefined) ?? null;
  const facts: ClientFacts = {
    firstName: s('firstName'),
    lastName: s('lastName'),
    phone: s('phone'),
    whatsappOptIn: f.whatsappOptIn === true,
    countryOfResidence: s('countryOfResidence'),
    residencyStatus: s('residencyStatus'),
    purchaseTimeframe: s('purchaseTimeframe'),
    financingPreference: s('financingPreference'),
    preferredContactSlot: s('preferredSlot'),
    timezone: input.tracking.callerTimezone ?? null,
    regionId,
  };
  const channel = s('preferredChannel') as keyof typeof preferredChannelToContactChannel | null;
  if (channel) facts.preferredContactChannel = preferredChannelToContactChannel[channel];
  if (f.budget) facts.budget = { amount: f.budget as string, currency, kind: (f.budgetKind as 'TOTAL' | 'MONTHLY') ?? 'TOTAL' };
  if (f.downPayment) facts.downPayment = { amount: f.downPayment as string, currency };
  if (f.monthlyBudget) facts.monthlyBudget = { amount: f.monthlyBudget as string, currency };
  return facts;
}
