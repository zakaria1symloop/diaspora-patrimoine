// TRV-020…TRV-031 — formats through Intl with the active locale.
export function formatMoney(amount: string | number, currency: string, locale = 'fr-FR', fractionDigits?: number): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  const digits = fractionDigits ?? (Number.isInteger(value) ? 0 : 2);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(value)
    // TRV-020 (display table): the dinar is written « DA » (« 22 275 000 DA »), not the ISO code Intl prints
    .replace(/DZD/g, 'DA');
}

export function formatNumber(value: number, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDate(
  date: Date | string,
  style: 'long' | 'short' | 'weekday' = 'long',
  timeZone = 'Europe/Paris',
  locale = 'fr-FR',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const opts: Intl.DateTimeFormatOptions =
    style === 'weekday'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric', timeZone }
        : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone };
  return new Intl.DateTimeFormat(locale, opts).format(d);
}

export function formatTime(date: Date | string, timeZone = 'Europe/Paris', locale = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(d).replace(':', ' h ');
}
