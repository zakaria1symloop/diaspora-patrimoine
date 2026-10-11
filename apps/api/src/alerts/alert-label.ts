// CAT-022 — the one-line summary of the criteria, which is also the label of an alert (`SearchAlert.label`). Computed
// by the server from the parsed criteria (never a text sent by the browser: it is written in e-mails). Same order and
// words as the catalogue's summary (apps/web/src/lib/catalogue.ts `criteriaSummary`), with the names read here.
import { standingSlugToEnum, typeSlugToEnum, type CatalogueCriteria } from '@dp/contracts';
import { createTranslator, formatNumber } from '@dp/i18n';

const t = createTranslator('fr');

export interface LabelNames {
  regions: Map<string, string>;
  cities: Map<string, string>;
  promoters: Map<string, string>;
}

const typeLabel = (slug: string) => t(`ui.enum.PropertyType.${typeSlugToEnum[slug as keyof typeof typeSlugToEnum]}`);
const roomsLabel = (r: string, prefix: string) =>
  r === '5plus' ? t('ui.catalogue.filters.roomsPlus', { prefix }) : t('ui.catalogue.filters.roomsValue', { prefix, n: r });
const deliveryLabel = (d: string, year: number) =>
  d === 'delivered' ? t('ui.catalogue.filters.deliveryDelivered') : d === 'later' ? t('ui.catalogue.filters.deliveryLater', { annee: String(year + 3) }) : d;

/** CAT-022 — « Appartement T3 · Alger (Chéraga) · jusqu'à 500 € / mois … »; without criteria « Tous les biens ». */
export function alertLabel(c: CatalogueCriteria, names: LabelNames, prefix: string, year: number): string {
  const parts: string[] = [];
  if (c.type?.length) {
    const rooms = c.rooms?.length === 1 ? ` ${roomsLabel(c.rooms[0]!, prefix)}` : '';
    parts.push(c.type.map(typeLabel).join(', ') + rooms);
  } else if (c.rooms?.length) parts.push(c.rooms.map((r) => roomsLabel(r, prefix)).join(', '));
  if (c.region?.length) {
    const region = c.region.map((r) => names.regions.get(r) ?? r).join(', ');
    const cities = c.city?.length ? (c.city.length > 2 ? ` (${c.city.length})` : ` (${c.city.map((x) => names.cities.get(x) ?? x).join(', ')})`) : '';
    parts.push(region + cities);
  }
  if (c.monthlyMax !== undefined) parts.push(t('ui.catalogue.filters.monthlyUpTo', { n: formatNumber(c.monthlyMax) }));
  if (c.priceMin !== undefined && c.priceMax !== undefined) parts.push(t('ui.catalogue.filters.priceRange', { min: formatNumber(c.priceMin), max: formatNumber(c.priceMax) }));
  else if (c.priceMax !== undefined) parts.push(t('ui.catalogue.search.budgetPriceStepShort', { n: formatNumber(c.priceMax) }));
  if (c.surfaceMin !== undefined || c.surfaceMax !== undefined)
    parts.push(t('ui.catalogue.filters.surfaceRange', { min: String(c.surfaceMin ?? 0), max: String(c.surfaceMax ?? '…') }));
  if (c.delivery?.length) parts.push(c.delivery.map((d) => deliveryLabel(d, year)).join(', '));
  if (c.standing?.length) parts.push(c.standing.map((s) => t(`ui.enum.Standing.${standingSlugToEnum[s as keyof typeof standingSlugToEnum]}`)).join(', '));
  if (c.promoter?.length) parts.push(c.promoter.map((p) => names.promoters.get(p) ?? p).join(', '));
  const options = [
    c.financing && t('ui.catalogue.filters.optFinancing'),
    c.islamic && t('ui.catalogue.filters.optIslamic'),
    c.tour360 && t('ui.catalogue.filters.optTour360'),
    c.new && t('ui.catalogue.quick.new'),
  ].filter(Boolean);
  if (options.length) parts.push(options.join(', '));
  if (c.q) parts.unshift(`« ${c.q} »`);
  const label = parts.length ? parts.join(' · ') : t('ui.catalogue.page.summaryNone');
  // SearchAlert.label is 120 characters at most.
  return label.length > 120 ? `${label.slice(0, 119).trimEnd()}…` : label;
}
