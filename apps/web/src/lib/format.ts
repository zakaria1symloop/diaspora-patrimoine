// Display helpers shared by the site (TRV-020: Intl only). Labels come from @dp/i18n.
import type { Money, PropertyCard, PublicDelivery } from '@dp/contracts';
import { formatMoney } from '@dp/i18n';
import { t } from './i18n';

/** Card amounts: whole currency units, no decimals (CAL-021/022 already applied by the API). */
export function money(m: Money | null): string | null {
  if (!m) return null;
  return formatMoney(Math.round(Number(m.amount)), m.currency, 'fr-FR', 0);
}

export function surfaceText(min: string | null, max: string | null): string | null {
  const f = (v: string) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v));
  if (min === null && max === null) return null;
  if (min !== null && max !== null && Math.round(Number(min)) !== Math.round(Number(max))) {
    return t('ui.catalogue.card.surfaceRange', { min: f(min), max: f(max) });
  }
  return t('ui.catalogue.card.surfaceValue', { surface: f((min ?? max)!) });
}

/** FIC-040 — delivery display. */
export function deliveryText(d: PublicDelivery): string {
  if (d.status === 'DELIVERED') return t('ui.catalogue.delivery.delivered');
  if (d.overdue) return t('ui.catalogue.delivery.overdue');
  if (!d.date) return t('ui.catalogue.delivery.overdue');
  const date = new Date(`${d.date}T00:00:00Z`);
  const year = date.getUTCFullYear();
  if (d.precision === 'YEAR') return t('ui.catalogue.delivery.year', { year: String(year) });
  if (d.precision === 'QUARTER') {
    return t('ui.catalogue.delivery.quarter', { q: String(Math.floor(date.getUTCMonth() / 3) + 1), year: String(year) });
  }
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  return t('ui.catalogue.delivery.month', { date: month });
}

/** « Appartement T3 » — type and rooms (D-040 prefix). */
export function typeRooms(type: PropertyCard['type'], rooms: number | null, prefix: string): string {
  const label = t(`ui.enum.PropertyType.${type}`);
  if (rooms === null || type === 'STUDIO' || type === 'LAND' || type === 'COMMERCIAL') return label;
  return t('ui.catalogue.search.typeRooms', { type: label, prefix, rooms: String(rooms) });
}
