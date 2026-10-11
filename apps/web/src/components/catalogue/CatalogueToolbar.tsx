'use client';
// CAT-001 results header: count (from the server, TRV-106), summary (CAT-022), keyword search (CAT-010),
// « Filtres » with the number of active filters, « Trier : {tri} » (CAT-050). Changing a criterion resets the page.
import { usePathname, useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { SORTS, criteriaToSearch, type CatalogueCriteria, type CatalogueSort } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import { Dropdown } from '@/components/vitrine/Dropdown';
import { announceCatalogueSearch } from './ResultsPending';
import s from './catalogue.module.css';

export interface CatalogueToolbarProps {
  criteria: CatalogueCriteria;
  count: string;
  summary: string;
  filterCount: number;
  monthlyEnabled: boolean;
}

export function CatalogueToolbar({ criteria, count, summary, filterCount, monthlyEnabled }: CatalogueToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const [q, setQ] = useState(criteria.q ?? '');

  const navigate = (next: CatalogueCriteria, extra = '') => {
    const n = { ...next };
    delete n.page;
    const qs = criteriaToSearch(n);
    const url = `${pathname}${qs}${extra ? `${qs ? '&' : '?'}${extra}` : ''}`;
    announceCatalogueSearch(url);
    router.push(url);
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const value = q.trim();
    const next = { ...criteria };
    if (value.length >= 2) next.q = value;
    else delete next.q;
    navigate(next);
  };

  const sorts = SORTS.filter((x) => monthlyEnabled || x !== 'monthly_asc');
  const current = criteria.sort ?? 'relevance';

  return (
    <div className={s.toolbar}>
      <div className={s.countBlock}>
        <p className={s.count} aria-live="polite">
          {count}
        </p>
        <p className={s.summary}>{summary}</p>
      </div>
      <form className={s.keyword} role="search" onSubmit={onSearch}>
        <label htmlFor={`${id}-q`} className="visually-hidden">
          {t('ui.catalogue.page.keyword')}
        </label>
        <Icon name="search" size={20} className={s.keywordIcon} />
        <input
          id={`${id}-q`}
          type="search"
          value={q}
          minLength={2}
          maxLength={80}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('ui.catalogue.page.keywordPlaceholder')}
          className={s.keywordInput}
          enterKeyHint="search"
        />
      </form>
      <button type="button" className={s.toolButton} onClick={() => navigate(criteria, 'filtres=1')} aria-haspopup="dialog">
        <Icon name="sliders" size={20} />
        {filterCount ? t('ui.catalogue.page.filtersCount', { n: filterCount }) : t('ui.catalogue.page.filters')}
      </button>
      <Dropdown
        className={s.sort}
        align="end"
        label={t('ui.catalogue.page.sortLabel')}
        value={current}
        groups={[{ options: sorts.map((x) => ({ value: x, label: t(`ui.catalogue.sort.${x}`) })) }]}
        prefix={<span className={s.sortPrefix}>{`${t('ui.catalogue.page.sortPrefix')} `}</span>}
        onChange={(value) => {
          const sort = value as CatalogueSort;
          const next = { ...criteria };
          if (sort === 'relevance') delete next.sort;
          else next.sort = sort;
          navigate(next);
        }}
      />
    </div>
  );
}
