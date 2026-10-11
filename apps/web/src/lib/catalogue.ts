// CAT-001 title, CAT-022 summary, active-filter chips (removal links), NAV-032/NAV-038 SEO of the catalogue.
import {
  criteriaToSearch,
  standingSlugToEnum,
  typeSlugToEnum,
  type CatalogueCriteria,
  type CatalogueFacets,
} from '@dp/contracts';
import { formatNumber } from '@dp/i18n';
import { t } from './i18n';

export interface Names {
  regions: Map<string, string>;
  cities: Map<string, string>;
  promoters: Map<string, string>;
}

/** Names of the slugs in the criteria; the search options' regions fill in a region the facets no longer list (zero result). */
export function namesFrom(facets: CatalogueFacets | undefined, regions: { slug: string; name: string }[] = []): Names {
  return {
    regions: new Map([...regions.map((r) => [r.slug, r.name] as const), ...(facets?.region ?? []).map((o) => [o.value, o.label] as const)]),
    cities: new Map((facets?.city ?? []).map((o) => [o.value, o.label])),
    promoters: new Map((facets?.promoter ?? []).map((o) => [o.value, o.label])),
  };
}

const typeLabel = (slug: string) => t(`ui.enum.PropertyType.${typeSlugToEnum[slug as keyof typeof typeSlugToEnum]}`);
const typePlural = (slug: string) => t(`ui.enum.PropertyType.${typeSlugToEnum[slug as keyof typeof typeSlugToEnum]}.plural`);

/** CAT-001 — page title; NAV-032 uses the same structure. `country` is the active catalogue country's name. */
export function catalogueTitle(c: CatalogueCriteria, names: Names, country: string): string {
  const region = c.region?.length === 1 ? (names.regions.get(c.region[0]!) ?? null) : null;
  const type = c.type?.length === 1 ? typePlural(c.type[0]!) : null;
  if ((c.region?.length ?? 0) > 1 || (c.type?.length ?? 0) > 1) return t('ui.catalogue.page.titleAll');
  if (type && region) return t('ui.catalogue.page.titleTypeRegion', { types: type, region });
  if (type) return t('ui.catalogue.page.titleType', { types: type, pays: country });
  if (region) return t('ui.catalogue.page.titleRegion', { region });
  return t('ui.catalogue.page.titleAll');
}

/**
 * CAT-001, Figma EP-02 — the title on two lines (DSN-022): the place (« à Alger », « en Algérie ») goes to the gold
 * line; without a place, the last word does (« Tous les » · « programmes »).
 */
export function titleLines(title: string): [string, string] {
  const at = Math.max(title.lastIndexOf(' à '), title.lastIndexOf(' en '));
  if (at > 0) return [title.slice(0, at), title.slice(at + 1)];
  const sp = title.lastIndexOf(' ');
  return sp > 0 ? [title.slice(0, sp), title.slice(sp + 1)] : ['', title];
}

/** The introduction on two lines, cut after its first comma (« …partenaires, » · « avec leur prix… »). */
export function introLines(intro: string | null): [string | null, string | null] {
  if (!intro) return [null, null];
  const at = intro.indexOf(', ');
  return at > 0 ? [intro.slice(0, at + 1), intro.slice(at + 2)] : [intro, null];
}

function euros(n: number): string {
  return `${formatNumber(n)} €`;
}

function roomsLabel(r: string, prefix: string): string {
  return r === '5plus' ? t('ui.catalogue.filters.roomsPlus', { prefix }) : t('ui.catalogue.filters.roomsValue', { prefix, n: r });
}

function deliveryLabel(d: string, year: number): string {
  if (d === 'delivered') return t('ui.catalogue.filters.deliveryDelivered');
  if (d === 'later') return t('ui.catalogue.filters.deliveryLater', { annee: String(year + 3) });
  return d;
}

export interface Chip {
  label: string;
  /** URL of the catalogue without this criterion (page reset to 1, CAT-003). */
  href: string;
}

/** Active filters as removable chips, in the order of the summary (CAT-022). */
export function activeChips(c: CatalogueCriteria, names: Names, prefix: string, year: number): Chip[] {
  const base: CatalogueCriteria = { ...c };
  delete base.page;
  const without = (patch: Partial<Record<keyof CatalogueCriteria, unknown>>) => {
    const next = { ...base, ...patch } as CatalogueCriteria;
    for (const k of Object.keys(patch) as (keyof CatalogueCriteria)[]) if (patch[k] === undefined) delete next[k];
    return `/programmes${criteriaToSearch(next)}`;
  };
  const listChips = <K extends keyof CatalogueCriteria>(key: K, label: (v: string) => string) =>
    ((c[key] as string[] | undefined) ?? []).map((v) => {
      const rest = (c[key] as string[]).filter((x) => x !== v);
      const patch: Partial<Record<keyof CatalogueCriteria, unknown>> = { [key]: rest.length ? rest : undefined };
      if (key === 'region') patch.city = undefined; // city only makes sense with one region (CAT-020)
      return { label: label(v), href: without(patch) };
    });
  const chips: Chip[] = [];
  chips.push(...listChips('type', typeLabel));
  chips.push(...listChips('rooms', (r) => roomsLabel(r, prefix)));
  chips.push(...listChips('region', (r) => names.regions.get(r) ?? r));
  chips.push(...listChips('city', (r) => names.cities.get(r) ?? r));
  if (c.monthlyMax !== undefined) chips.push({ label: t('ui.catalogue.filters.monthlyUpTo', { n: formatNumber(c.monthlyMax) }), href: without({ monthlyMax: undefined }) });
  if (c.priceMin !== undefined || c.priceMax !== undefined) {
    chips.push({
      label:
        c.priceMin !== undefined && c.priceMax !== undefined
          ? t('ui.catalogue.filters.priceRange', { min: formatNumber(c.priceMin), max: formatNumber(c.priceMax) })
          : c.priceMax !== undefined
            ? t('ui.catalogue.search.budgetPriceStepShort', { n: formatNumber(c.priceMax) })
            : `≥ ${euros(c.priceMin!)}`,
      href: without({ priceMin: undefined, priceMax: undefined }),
    });
  }
  if (c.surfaceMin !== undefined || c.surfaceMax !== undefined) {
    chips.push({
      label: t('ui.catalogue.filters.surfaceRange', { min: String(c.surfaceMin ?? 0), max: String(c.surfaceMax ?? '…') }),
      href: without({ surfaceMin: undefined, surfaceMax: undefined }),
    });
  }
  chips.push(...listChips('delivery', (d) => deliveryLabel(d, year)));
  chips.push(...listChips('standing', (s) => t(`ui.enum.Standing.${standingSlugToEnum[s as keyof typeof standingSlugToEnum]}`)));
  chips.push(...listChips('promoter', (p) => names.promoters.get(p) ?? p));
  if (c.financing) chips.push({ label: t('ui.catalogue.filters.optFinancing'), href: without({ financing: undefined }) });
  if (c.islamic) chips.push({ label: t('ui.catalogue.filters.optIslamic'), href: without({ islamic: undefined }) });
  if (c.tour360) chips.push({ label: t('ui.catalogue.filters.optTour360'), href: without({ tour360: undefined }) });
  if (c.new) chips.push({ label: t('ui.catalogue.quick.new'), href: without({ new: undefined }) });
  if (c.availability === 'all') chips.push({ label: t('ui.catalogue.page.includeGone'), href: without({ availability: undefined }) });
  return chips;
}

/** CAT-022 — one-line summary; also the label of an alert. */
export function criteriaSummary(c: CatalogueCriteria, names: Names, prefix: string, year: number): string {
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
  return parts.length ? parts.join(' · ') : t('ui.catalogue.page.summaryNone');
}

/** NAV-038 — indexable: no filter, one region, one type, one region and one type; nothing else, page 1 only. */
export function isIndexable(c: CatalogueCriteria): boolean {
  const keys = Object.keys(c).filter((k) => k !== 'sort' && k !== 'vue');
  const allowed = keys.every((k) => k === 'region' || k === 'type');
  return allowed && (c.region?.length ?? 0) <= 1 && (c.type?.length ?? 0) <= 1 && !c.sort;
}

/** NAV-038 — canonical of the nearest indexable combination, keys in fixed order. */
export function canonicalOf(c: CatalogueCriteria): string {
  const k: CatalogueCriteria = {};
  if (c.region?.length === 1) k.region = c.region;
  if (c.type?.length === 1) k.type = c.type;
  return `/programmes${criteriaToSearch(k)}`;
}
