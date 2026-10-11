// CAT-055 — « Précédent » · 1 · 2 · 3 · … · {last} · « Suivant »; the current page is marked; page=1 is removed
// from the address. Under 640px the numbered pagination gives way to « Voir les 12 biens suivants » (TRV-107 exception).
import Link from 'next/link';
import { criteriaToSearch, type CatalogueCriteria } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './catalogue.module.css';

function pages(current: number, total: number): (number | '…')[] {
  const set = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (typeof prev === 'number' && p - prev > 1) out.push('…');
    out.push(p);
  }
  return out;
}

export function Pagination({ criteria, page, totalPages }: { criteria: CatalogueCriteria; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const c: CatalogueCriteria = { ...criteria };
    if (p > 1) c.page = p;
    else delete c.page;
    return `/programmes${criteriaToSearch(c)}#resultats`;
  };
  return (
    <nav className={s.pagination} aria-label={t('ui.catalogue.page.pagination')}>
      <ul role="list" className={s.pageList}>
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} className={s.pageNav} rel="prev">
              <Icon name="chevron-left" size={16} />
              {t('ui.catalogue.page.previous')}
            </Link>
          ) : (
            <span className={s.pageNav} aria-disabled="true">
              <Icon name="chevron-left" size={16} />
              {t('ui.catalogue.page.previous')}
            </span>
          )}
        </li>
        {pages(page, totalPages).map((p, i) =>
          p === '…' ? (
            <li key={`gap${i}`} className={s.pageGap} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                className={s.pageNumber}
                aria-current={p === page ? 'page' : undefined}
                aria-label={t('ui.catalogue.page.page', { n: p })}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link href={href(page + 1)} className={s.pageNav} rel="next">
              {t('ui.catalogue.page.next')}
              <Icon name="chevron-right" size={16} />
            </Link>
          ) : (
            <span className={s.pageNav} aria-disabled="true">
              {t('ui.catalogue.page.next')}
              <Icon name="chevron-right" size={16} />
            </span>
          )}
        </li>
      </ul>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={s.loadMore} scroll={false}>
          {t('ui.catalogue.page.loadMore')}
        </Link>
      ) : null}
    </nav>
  );
}
