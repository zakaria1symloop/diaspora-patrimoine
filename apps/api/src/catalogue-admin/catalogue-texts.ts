// MOD-210 generated title, MOD-211 generated description, TRV-052 slugs, MOD-220 searchText — pure functions.
// Words come from @dp/i18n (enum labels, delivery phrases): no visible text is written here (TRV-002).
import { createTranslator, type MessageKey } from '@dp/i18n';
import { slugify } from '../platform/slug.js';

const t = createTranslator('fr');
const DASH = ' – '; // MOD-210: en dash surrounded by spaces.

export type PropertyTypeCode = 'APARTMENT' | 'STUDIO' | 'DUPLEX' | 'VILLA' | 'LAND' | 'COMMERCIAL';
export type DeliveryStatusCode = 'ON_PLAN' | 'UNDER_CONSTRUCTION' | 'DELIVERED';
export type DatePrecisionCode = 'MONTH' | 'QUARTER' | 'YEAR';

export function typeLabel(type: PropertyTypeCode): string {
  return t(`ui.enum.PropertyType.${type}` as MessageKey);
}

/** « 85 », « 85,5 » — French decimal comma, no trailing zeros. */
export function formatSurface(value: number | string): string {
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ',');
}

export interface TitleInput {
  type: PropertyTypeCode;
  rooms: number | null;
  surfaceM2: number | string;
  programName: string | null;
  cityName: string | null;
  regionName: string;
  /** `display.roomsPrefix` */
  roomsPrefix: string;
}

/** MOD-210 — « Appartement T3 – Résidence El Yasmine », « Villa T5 – Chéraga », « Terrain 400 m² – Zéralda ». */
export function generateTitle(p: TitleInput): string {
  const label = typeLabel(p.type);
  const place = p.cityName ?? p.regionName;
  let title: string;
  if (p.type === 'LAND' || p.type === 'COMMERCIAL') {
    title = `${label} ${formatSurface(p.surfaceM2)} m²${DASH}${p.programName ?? place}`;
  } else if (p.type === 'STUDIO') {
    title = `${label}${DASH}${p.programName ?? place}`;
  } else {
    title = `${label} ${p.roomsPrefix}${p.rooms ?? ''}${DASH}${p.programName ?? place}`;
  }
  return title.slice(0, 120);
}

export interface DeliveryInput {
  status: DeliveryStatusCode;
  /** First day of the announced period, YYYY-MM-DD. */
  date: string | null;
  precision: DatePrecisionCode;
}

/** « livraison T4 2027 », « livraison juin 2027 », « livraison 2027 », « livré ». */
export function deliveryPhrase(d: DeliveryInput): string {
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  if (d.status === 'DELIVERED' || !d.date) return lower(t('ui.catalogue.delivery.delivered'));
  const [y, m] = d.date.split('-').map(Number) as [number, number];
  if (d.precision === 'YEAR') return lower(t('ui.catalogue.delivery.year', { year: String(y) }));
  if (d.precision === 'QUARTER') return lower(t('ui.catalogue.delivery.quarter', { q: String(Math.floor((m - 1) / 3) + 1), year: String(y) }));
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
  return lower(t('ui.catalogue.delivery.month', { date: month }));
}

export interface DescriptionInput extends Omit<TitleInput, 'programName'> {
  delivery: DeliveryInput;
  /** Labels of the checked features (`catalogue.features`), in list order. */
  featureLabels: string[];
}

/**
 * MOD-211 — « {Type} T{rooms} de {surface} m² à {ville} ({région}), {livraison}. {Liste des caractéristiques}. »;
 * without a city: « … de {surface} m² à {région}, {livraison}. ».
 */
export function generateDescription(p: DescriptionInput): string {
  const label = typeLabel(p.type);
  const head = p.type === 'STUDIO' || p.type === 'LAND' || p.type === 'COMMERCIAL' || p.rooms === null ? label : `${label} ${p.roomsPrefix}${p.rooms}`;
  const place = p.cityName && p.cityName !== p.regionName ? `${p.cityName} (${p.regionName})` : p.regionName;
  let text = `${head} de ${formatSurface(p.surfaceM2)} m² à ${place}, ${deliveryPhrase(p.delivery)}.`;
  if (p.featureLabels.length) {
    const [first, ...rest] = p.featureLabels;
    text += ` ${[first!, ...rest.map((l) => l.charAt(0).toLowerCase() + l.slice(1))].join(', ')}.`;
  }
  return text.slice(0, 5000);
}

/** MOD-220 — unaccented, lower case, words separated by single spaces (matches `lower(f_unaccent(q))`). */
export function searchText(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** 01-domaine/03 § 2 — `appartement-t3-residence-el-yasmine-alger-dp-dz-0142` (120 characters at most, TRV-052). */
export function propertySlug(title: string, regionName: string, reference: string): string {
  const tail = slugify(`${regionName} ${reference}`, 120);
  const head = slugify(title, 120 - tail.length - 1);
  return `${head}-${tail}`;
}

/** TRV-052 — duplicates get a numeric suffix (`-2`, `-3`…), within the length limit. */
export async function uniqueSlug(base: string, max: number, taken: (slug: string) => Promise<boolean>): Promise<string> {
  if (!(await taken(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, max - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!(await taken(candidate))) return candidate;
  }
  throw new Error('no free slug');
}

/** 01-domaine/03 § 1 `deliveryDate` — the first day of the announced period. */
export function firstDayOfPeriod(isoDate: string, precision: DatePrecisionCode): string {
  const [y, m] = isoDate.split('-').map(Number) as [number, number];
  if (precision === 'YEAR') return `${y}-01-01`;
  if (precision === 'QUARTER') return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
  return `${y}-${String(m).padStart(2, '0')}-01`;
}
