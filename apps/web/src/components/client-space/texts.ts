// Sentences of the client space composed from API values (API-002): dates in the client's zone (TRV-031, TRV-020),
// relative dates (TRV-030), the advisor's name (TRV-145), and the first-contact promise with its overdue variant
// (NOT-053, ECL-035) — the same `{quand}` expression as the confirmation screen and the acknowledgement (DEM-008).
import type { AdvisorCard, CallbackPromise, DossierNextStep, TimelineEntry } from '@dp/contracts';
import { callbackLabel, hasMessage, type MessageKey } from '@dp/i18n';
import { t } from '@/lib/i18n';

export interface PromiseSettings {
  firstContactBusinessDays: number;
  phone: string | null;
  whatsapp: string | null;
}

/**
 * D-108 — « Votre conseiller » stands for an advisor not named yet; inside a sentence it is written « votre conseiller »
 * (« Merci, votre conseiller est prévenu. »). Every sentence that may carry it goes through here.
 */
export function inSentence(text: string): string {
  const name = t('ui.client.nextStep.advisorFallback');
  const lower = name.charAt(0).toLocaleLowerCase('fr') + name.slice(1);
  return text.split(name).reduce((out, part, i) => (i === 0 ? part : out + (/(^\s*|[.!?…]\s+)$/.test(out) ? name : lower) + part), '');
}

/** TRV-145 — « Amel K. ». */
export function advisorName(a: AdvisorCard | null | undefined): string | null {
  if (!a) return null;
  return a.lastInitial ? `${a.firstName} ${a.lastInitial}.` : a.firstName;
}

export function initialsOf(a: AdvisorCard): string {
  return `${a.firstName.charAt(0)}${a.lastInitial ?? ''}`.toUpperCase();
}

/** « 9 octobre 2026 » — a calendar date (`YYYY-MM-DD`) or an instant read in the client's zone. */
export function longDate(value: string, timeZone: string): string {
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: isDay ? 'UTC' : timeZone }).format(
    new Date(isDay ? `${value}T12:00:00Z` : value),
  );
}

/** « 9 oct. 2026 » — where room is short (the compact frieze, a table). */
export function shortDate(value: string, timeZone: string): string {
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: isDay ? 'UTC' : timeZone }).format(new Date(isDay ? `${value}T12:00:00Z` : value));
}

/** « jeudi 15 octobre à 14 h 30 » (TRV-020 hour style). */
export function dateTime(value: string, timeZone: string): { date: string; time: string } {
  const d = new Date(value);
  return {
    date: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(d),
    time: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(d).replace(':', ' h '),
  };
}

/** TRV-030 — « à l'instant », « il y a 12 min », « il y a 3 h », « hier », « il y a 4 jours », then the date. */
export function relativeTime(value: string, timeZone: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(value).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t('ui.common.time.now');
  if (min < 60) return t('ui.common.time.minutes', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('ui.common.time.hours', { n: h });
  const days = Math.floor(h / 24);
  if (days === 1) return t('ui.common.time.yesterday');
  if (days <= 7) return t('ui.common.time.days', { n: days });
  return longDate(value, timeZone);
}

/** NOT-053 — `{quand}` of one request. */
export function quand(p: CallbackPromise, s: PromiseSettings): string {
  return callbackLabel({
    preferredCallbackDate: p.preferredCallbackDate,
    preferredSlot: p.preferredSlot,
    firstContactBusinessDays: s.firstContactBusinessDays,
    timeZone: p.timeZone,
  });
}

/** ECL-035 — the promise replaced, once overdue: an apology, and every way to reach us that is filled in. */
export function overdueSentence(p: CallbackPromise, s: PromiseSettings): string {
  const first = p.kind === 'CONTACT_MESSAGE' ? t('ui.client.promise.breachedReply') : t('ui.client.promise.breachedCall');
  const second =
    s.phone && s.whatsapp
      ? t('ui.client.promise.breachedWritePhoneWhatsapp', { telephone: s.phone })
      : s.phone
        ? t('ui.client.promise.breachedWritePhone', { telephone: s.phone })
        : s.whatsapp
          ? t('ui.client.promise.breachedWriteWhatsapp')
          : t('ui.client.promise.breachedWrite');
  return `${first} ${second}`;
}

/** « Un conseiller vous appelle {quand}. » / « Nous vous répondons {quand}. » — or ECL-035 when overdue. */
export function promiseSentence(p: CallbackPromise, s: PromiseSettings): string {
  if (p.breached) return overdueSentence(p, s);
  return p.kind === 'CONTACT_MESSAGE' ? t('ui.client.dashboard.lead.replyPromise', { quand: quand(p, s) }) : t('ui.client.dashboard.lead.callPromise', { quand: quand(p, s) });
}

/** ECL-021 — the « Prochaine étape » sentence. */
export function nextStepSentence(n: DossierNextStep, advisor: AdvisorCard | null, timeZone: string, s: PromiseSettings): string {
  if (n.code === 'ADVISOR') return n.advisorText ?? '';
  const conseiller = advisorName(advisor) ?? t('ui.client.nextStep.advisorFallback');
  if ((n.code === 'INTEREST' || n.code === 'QUALIFICATION_CALL') && n.promise?.breached) return overdueSentence(n.promise, s);
  const values: Record<string, string | number> = { conseiller };
  if (n.promise) values.quand = quand(n.promise, s);
  if (n.params.n !== undefined) values.n = n.params.n;
  if (n.params.property) values.property = n.params.property;
  if (n.params.bank !== undefined) values.bank = n.params.bank;
  if (n.params.banks) values.banks = n.params.banks;
  if (n.params.date) values.date = n.params.date.length > 10 ? `${dateTime(n.params.date, timeZone).date}, ${dateTime(n.params.date, timeZone).time}` : longDate(n.params.date, timeZone);
  return inSentence(t(`ui.client.nextStep.${n.code}` as MessageKey, values));
}

/** ECL-031 — one line of the timeline, from its kind and its frozen values. */
export function timelineSentence(e: TimelineEntry, timeZone: string): string {
  const p = e.params;
  const values: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) if (v !== null && v !== undefined) values[k] = v;
  if (typeof p.nature === 'string') values.nature = hasMessage(`ui.enum.LeadKind.${p.nature}`) ? t(`ui.enum.LeadKind.${p.nature}` as MessageKey) : p.nature;
  if (typeof p.date === 'string') values.date = longDate(p.date, timeZone);
  if (values.conseiller === undefined) values.conseiller = t('ui.client.nextStep.advisorFallback');
  let key = `ui.client.dossier.timeline.${e.kind}`;
  if ((e.kind === 'LEAD_SENT' || e.kind === 'LEAD_SENT_AGAIN') && p.bien) key += '_property';
  if (e.kind === 'MILESTONE_REACHED' && typeof p.milestone === 'string') key = `ui.client.dossier.timeline.MILESTONE_${p.milestone}`;
  return hasMessage(key) ? inSentence(t(key as MessageKey, values)) : t('ui.client.dossier.timeline.unknown');
}
