// MOD-202 — a delivery date is the first day of the announced period; it is overdue when the end of the period
// has passed without the status DELIVERED. CAT-020 `delivery`: delivered · a year · `later` (current year + 3 and after);
// an overdue delivery is filed under the current year.

export type DatePrecision = 'MONTH' | 'QUARTER' | 'YEAR';
export type DeliveryStatus = 'ON_PLAN' | 'UNDER_CONSTRUCTION' | 'DELIVERED';

export function periodEnd(date: Date, precision: DatePrecision): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  if (precision === 'YEAR') return new Date(Date.UTC(y, 11, 31));
  if (precision === 'QUARTER') {
    const lastMonth = Math.floor(m / 3) * 3 + 2;
    return new Date(Date.UTC(y, lastMonth + 1, 0));
  }
  return new Date(Date.UTC(y, m + 1, 0));
}

/** `today` is the business-calendar date (YYYY-MM-DD). */
export function isOverdue(status: DeliveryStatus, date: Date | null, precision: DatePrecision, today: string): boolean {
  if (status === 'DELIVERED' || !date) return false;
  return periodEnd(date, precision).toISOString().slice(0, 10) < today;
}

export function deliveryBucket(
  status: DeliveryStatus,
  date: Date | null,
  precision: DatePrecision,
  today: string,
): string {
  if (status === 'DELIVERED') return 'delivered';
  const currentYear = Number(today.slice(0, 4));
  if (!date) return 'later';
  if (isOverdue(status, date, precision, today)) return String(currentYear);
  const year = date.getUTCFullYear();
  if (year >= currentYear + 3) return 'later';
  return String(Math.max(year, currentYear));
}
