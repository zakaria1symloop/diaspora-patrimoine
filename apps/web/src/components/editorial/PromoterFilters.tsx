// EDI-030, EDI-035 — the promoter filters of « Promoteurs sélectionnés » and « Nos partenaires »: name, region, « Avec
// des biens en vente ». An ordinary form sent by its button (D-102: nothing is searched while choosing), its state in
// the address (TRV-101), so the page is filtered on the server and works without JavaScript. The list is short and
// already cached (`/public/promoters`): filtering it here costs no request to the API.
import Link from 'next/link';
import type { PublicPromoterCard } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import { FormDropdown } from '@/components/vitrine/FormDropdown';
import s from './editorial.module.css';

export interface PromoterQuery {
  q: string;
  region: string;
  onSale: boolean;
  page: number;
}

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function readPromoterQuery(sp: Search): PromoterQuery {
  const page = Number.parseInt(one(sp.page), 10);
  return { q: one(sp.q).trim().slice(0, 80), region: one(sp.region), onSale: one(sp.vente) === '1', page: Number.isFinite(page) && page > 1 ? page : 1 };
}

/** Lower case, without accents: « djazair » finds « El Djazaïr Habitat ». */
const fold = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function filterPromoters(list: PublicPromoterCard[], q: PromoterQuery): PublicPromoterCard[] {
  const words = fold(q.q).split(/\s+/).filter(Boolean);
  return list.filter(
    (p) =>
      (!q.region || p.region === q.region) &&
      (!q.onSale || p.onSaleCount > 0) &&
      words.every((w) => fold(p.name).includes(w)),
  );
}

export const isFiltered = (q: PromoterQuery) => Boolean(q.q || q.region || q.onSale);

/** The address of a filtered list (page 1 dropped), with `keep` (the group chosen on Nos partenaires) kept. */
export function promoterHref(action: string, q: PromoterQuery, keep: Record<string, string> = {}): string {
  const p = new URLSearchParams(keep);
  if (q.q) p.set('q', q.q);
  if (q.region) p.set('region', q.region);
  if (q.onSale) p.set('vente', '1');
  if (q.page > 1) p.set('page', String(q.page));
  const qs = p.toString();
  return qs ? `${action}?${qs}` : action;
}

export function PromoterFilters({
  action,
  promoters,
  query,
  shown,
  keep = {},
  anchor,
}: {
  action: string;
  /** The whole list: the regions offered come from it. */
  promoters: PublicPromoterCard[];
  query: PromoterQuery;
  /** How many promoters match. */
  shown: number;
  keep?: Record<string, string>;
  /** Where the page scrolls back to after sending (the list). */
  anchor: string;
}) {
  const regions = [...new Set(promoters.map((p) => p.region).filter((r): r is string => Boolean(r)))].sort((a, b) => a.localeCompare(b, 'fr'));
  const anyOnSale = promoters.some((p) => p.onSaleCount > 0) && promoters.some((p) => p.onSaleCount === 0);
  return (
    <div className={s.filterBox}>
      <form action={`${action}#${anchor}`} method="get" role="search" aria-label={t('ui.editorial.promoters.filters.title')} className={s.filterForm}>
        {Object.entries(keep).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className={s.filterField}>
          <label htmlFor="promoteurs-nom" className={s.filterLabel}>
            {t('ui.editorial.promoters.filters.search')}
          </label>
          <span className={s.filterSearch}>
            <Icon name="search" size={20} />
            <input id="promoteurs-nom" name="q" type="search" defaultValue={query.q} maxLength={80} autoComplete="off" className={s.filterInput} />
          </span>
        </div>
        {regions.length >= 2 ? (
          <div className={s.filterField}>
            <span id="promoteurs-region-label" className={s.filterLabel}>
              {t('ui.editorial.promoters.filters.region')}
            </span>
            <FormDropdown
              id="promoteurs-region"
              name="region"
              defaultValue={regions.includes(query.region) ? query.region : ''}
              labelledBy="promoteurs-region-label promoteurs-region"
              groups={[
                {
                  options: [
                    { value: '', label: t('ui.editorial.promoters.filters.regionAll') },
                    ...regions.map((r) => ({ value: r, label: r, note: String(promoters.filter((p) => p.region === r).length) })),
                  ],
                },
              ]}
            />
          </div>
        ) : null}
        {anyOnSale ? (
          <label className={s.filterCheck}>
            <input type="checkbox" name="vente" value="1" defaultChecked={query.onSale} />
            <span>{t('ui.editorial.promoters.filters.onSale')}</span>
          </label>
        ) : null}
        <div className={s.filterActions}>
          <Button type="submit" variant="primary" size="M">
            {t('ui.editorial.promoters.filters.apply')}
          </Button>
          {isFiltered(query) ? (
            <Link href={`${promoterHref(action, { q: '', region: '', onSale: false, page: 1 }, keep)}#${anchor}`} className={s.textLink}>
              {t('ui.editorial.promoters.filters.reset')}
            </Link>
          ) : null}
        </div>
      </form>
      <p className={s.filterCount} role="status">
        {t('ui.editorial.promoters.filters.count', { n: shown })}
      </p>
    </div>
  );
}
