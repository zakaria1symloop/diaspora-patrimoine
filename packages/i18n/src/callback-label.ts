// NOT-053 — `lead.callbackLabel`: when the person will be called, as ONE expression shared by the confirmation screen
// (DEM-023), the acknowledgement e-mail and the client space. Composed from the chosen day and moment (DEM-008),
// in the person's time zone; never « 48 h » when a later day was chosen (CAL-061).
import { createTranslator } from './translator.js';
import type { Locale } from './messages.generated.js';

export type CallbackSlot = 'MORNING' | 'NOON' | 'AFTERNOON' | 'EVENING' | 'ANYTIME';

export interface CallbackLabelInput {
  /** `YYYY-MM-DD`; null/absent = « Dès que possible ». */
  preferredCallbackDate?: string | null;
  /** null/absent/`ANYTIME` = « Peu importe ». */
  preferredSlot?: CallbackSlot | null;
  /** `sla.firstContactBusinessDays` (2 → « 48 h », 1 → « 24 h », 3 and more → « {n} jours ouvrés »). */
  firstContactBusinessDays: number;
  /** The person's time zone (`Lead.callerTimezone`, else `Client.timezone`, else the business calendar's). */
  timeZone: string;
  /** `screen` (the screen explains « ouvrées » itself, `07-design/03` § 1) or `email` (the explanation is inline). */
  variant?: 'screen' | 'email';
  /** `business.calendar.workdays` (1 = Monday … 7 = Sunday), for the e-mail variant. */
  workdays?: readonly number[];
  locale?: Locale;
}

const intlLocale = (locale: Locale) => (locale === 'fr' ? 'fr-FR' : locale);

/** « jeudi 15 octobre » — a calendar date, independent of any time zone. */
function dayLabel(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );
}

/** « heure : France » — CLDR generic name of the zone, so that no country grammar is written by hand. */
function zoneLabel(timeZone: string, locale: Locale): string {
  try {
    const part = new Intl.DateTimeFormat(intlLocale(locale), { timeZone, timeZoneName: 'shortGeneric' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/** `common.businessDays` `{jours}` — « du lundi au vendredi » for a contiguous week, else « lundi, mardi et jeudi ». */
export function workdaysLabel(workdays: readonly number[], locale: Locale = 'fr'): string {
  const t = createTranslator(locale);
  const sorted = [...new Set(workdays)].sort((a, b) => a - b);
  // 2024-01-01 is a Monday: day n of the week is 2024-01-0n.
  const name = (n: number) =>
    new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, n, 12)));
  if (sorted.length === 0) return '';
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (contiguous && sorted.length >= 3) {
    return t('ui.lead.callback.workdaysRange', { first: name(sorted[0]!), last: name(sorted[sorted.length - 1]!) });
  }
  return new Intl.ListFormat(intlLocale(locale), { type: 'conjunction' }).format(sorted.map(name));
}

/** NOT-053 — the expression completing « Un conseiller vous appelle … ». */
export function callbackLabel(input: CallbackLabelInput): string {
  const locale = input.locale ?? 'fr';
  const t = createTranslator(locale);
  const days = input.firstContactBusinessDays;
  let base: string;
  if (input.preferredCallbackDate) {
    base = dayLabel(input.preferredCallbackDate, locale);
  } else if (days >= 3) {
    base = t('ui.lead.callback.withinDays', { days });
  } else if (input.variant === 'email') {
    base = t('ui.lead.callback.withinHoursEmail', { hours: days * 24, days, workdays: workdaysLabel(input.workdays ?? [1, 2, 3, 4, 5], locale) });
  } else {
    base = t('ui.lead.callback.withinHours', { hours: days * 24 });
  }
  const slot = input.preferredSlot;
  if (!slot || slot === 'ANYTIME') return base;
  return t('ui.lead.callback.preferably', {
    when: base,
    slot: t(`ui.lead.callback.slot.${slot}` as const),
    zone: zoneLabel(input.timeZone, locale),
  });
}
