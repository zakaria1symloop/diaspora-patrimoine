'use client';
// ACC-052, CAT-001 — search bar: Ville · Budget (monthly steps, then total steps, D-095) · Type de bien,
// « Rechercher » and « Filtres ». Options without any property are not offered (CAT-021). Choices are kept in
// session storage until « Rechercher » (TRV-092). Stacked on phones (ACC-100).
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { criteriaToSearch, type CatalogueCriteria, type SearchOptions } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { formatNumber } from '@dp/i18n';
import { t } from '@/lib/i18n';
import { typeRooms } from '@/lib/format';
import { Dropdown, type DropdownGroup } from './Dropdown';
import { announceCatalogueSearch } from '@/components/catalogue/ResultsPending';
import s from './SearchBar.module.css';

const KEY = 'dp_form_search';

const TYPE_SLUG: Record<string, string> = {
  APARTMENT: 'apartment',
  STUDIO: 'studio',
  DUPLEX: 'duplex',
  VILLA: 'villa',
  LAND: 'land',
  COMMERCIAL: 'commercial',
};

interface State {
  region: string;
  budget: string; // '' | 'm:500' | 'p:150000'
  type: string; // '' | 'APARTMENT:3' | 'STUDIO:'
}

export interface SearchBarProps {
  options: SearchOptions;
  monthlyEnabled: boolean;
  roomsPrefix: string;
  initial?: CatalogueCriteria;
  /** Persist choices across a detour (home only, ACC-052). */
  persist?: boolean;
  /** The fields one under the other at every width (TRV-122). */
  stacked?: boolean;
}

function fromCriteria(c?: CatalogueCriteria): State {
  const typeEnum = c?.type?.length === 1 ? Object.keys(TYPE_SLUG).find((k) => TYPE_SLUG[k] === c.type![0]) : undefined;
  return {
    region: c?.region?.length === 1 ? c.region[0]! : '',
    budget: c?.monthlyMax ? `m:${c.monthlyMax}` : c?.priceMax && c.priceMin === undefined ? `p:${c.priceMax}` : '',
    type: typeEnum ? `${typeEnum}:${c?.rooms?.length === 1 ? c.rooms[0] : ''}` : '',
  };
}

export function SearchBar({ options, monthlyEnabled, roomsPrefix, initial, persist, stacked }: SearchBarProps) {
  const router = useRouter();
  const id = useId();
  const [state, setState] = useState<State>(() => fromCriteria(initial));

  useEffect(() => {
    if (!persist) return;
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) setState(JSON.parse(saved) as State);
    } catch {
      /* storage unavailable */
    }
  }, [persist]);

  // The catalogue bar reflects the criteria in place continuously (CAT-001, TRV-107).
  useEffect(() => {
    if (!persist) setState(fromCriteria(initial));
  }, [initial, persist]);

  const update = (patch: Partial<State>) => {
    const next = { ...state, ...patch };
    setState(next);
    if (persist) {
      try {
        sessionStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
    }
  };

  const criteria = (): CatalogueCriteria => {
    const c: CatalogueCriteria = {};
    if (state.region) c.region = [state.region];
    if (state.budget.startsWith('m:')) c.monthlyMax = Number(state.budget.slice(2));
    if (state.budget.startsWith('p:')) c.priceMax = Number(state.budget.slice(2));
    if (state.type) {
      const [type, rooms] = state.type.split(':');
      c.type = [TYPE_SLUG[type!] as never];
      if (rooms) c.rooms = [(Number(rooms) >= 5 ? '5plus' : rooms) as never];
    }
    return c;
  };

  const go = (filters: boolean) => {
    const c = criteria();
    if (persist) {
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        /* storage unavailable */
      }
    }
    const qs = criteriaToSearch(c);
    const url = `/programmes${qs}${filters ? `${qs ? '&' : '?'}filtres=1` : ''}`;
    announceCatalogueSearch(url);
    router.push(url);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(false);
  };

  const monthlySteps = monthlyEnabled ? options.monthlyBudgetSteps : [];
  const fmt = (n: number) => formatNumber(n);

  const budgetGroups: DropdownGroup[] = [{ options: [{ value: '', label: t('ui.catalogue.search.budgetAny') }] }];
  if (monthlySteps.length > 0) {
    budgetGroups.push({
      label: t('ui.catalogue.search.budgetGroupMonthly'),
      options: monthlySteps.map((n) => ({ value: `m:${n}`, label: t('ui.catalogue.search.budgetMonthlyStep', { n: fmt(n) }) })),
    });
  }
  if (options.priceBudgetSteps.length > 0) {
    budgetGroups.push({
      label: t('ui.catalogue.search.budgetGroupTotal'),
      options: options.priceBudgetSteps.map((n) => ({
        value: `p:${n}`,
        label: monthlyEnabled ? t('ui.catalogue.search.budgetPriceStep', { n: fmt(n) }) : t('ui.catalogue.search.budgetPriceStepShort', { n: fmt(n) }),
      })),
    });
  }

  return (
    <form className={[s.bar, stacked && s.stacked].filter(Boolean).join(' ')} role="search" onSubmit={submit} aria-label={t('ui.catalogue.search.label')}>
      <div className={s.field}>
        <Icon name="map-pin" size={24} className={s.gold} />
        <span className={s.text}>
          <label className={s.label} id={`${id}-region-label`} htmlFor={`${id}-region`}>
            {t('ui.catalogue.search.city')}
          </label>
          <Dropdown
            id={`${id}-region`}
            labelledBy={`${id}-region-label ${id}-region`}
            variant="bare"
            value={state.region}
            onChange={(region) => update({ region })}
            groups={[{ options: [{ value: '', label: t('ui.catalogue.search.cityAll') }, ...options.regions.map((r) => ({ value: r.slug, label: r.name, note: fmt(r.count) }))] }]}
          />
        </span>
      </div>
      <span className={s.sep} aria-hidden="true" />
      <div className={s.field}>
        <Icon name="coins" size={24} />
        <span className={s.text}>
          <label className={s.label} id={`${id}-budget-label`} htmlFor={`${id}-budget`}>
            {monthlyEnabled ? t('ui.catalogue.search.budgetMonthly') : t('ui.catalogue.search.budget')}
          </label>
          <Dropdown
            id={`${id}-budget`}
            labelledBy={`${id}-budget-label ${id}-budget`}
            variant="bare"
            value={state.budget}
            onChange={(budget) => update({ budget })}
            groups={budgetGroups}
          />
        </span>
      </div>
      <span className={s.sep} aria-hidden="true" />
      <div className={s.field}>
        <Icon name="home" size={24} />
        <span className={s.text}>
          <label className={s.label} id={`${id}-type-label`} htmlFor={`${id}-type`}>
            {t('ui.catalogue.search.type')}
          </label>
          <Dropdown
            id={`${id}-type`}
            labelledBy={`${id}-type-label ${id}-type`}
            variant="bare"
            value={state.type}
            onChange={(type) => update({ type })}
            groups={[
              {
                options: [
                  { value: '', label: t('ui.catalogue.search.typeAll') },
                  ...options.types.map((o) => ({ value: `${o.type}:${o.rooms ?? ''}`, label: typeRooms(o.type, o.rooms, roomsPrefix), note: fmt(o.count) })),
                ],
              },
            ]}
          />
        </span>
      </div>
      <div className={s.actions}>
        <button type="button" className={s.filters} onClick={() => go(true)}>
          <Icon name="sliders" size={20} />
          {t('ui.catalogue.search.filters')}
        </button>
        <button type="submit" className={buttonClass('primary', 'M', false, false, s.submit)}>
          <ButtonInner chevron size="M">
            {t('ui.catalogue.search.submit')}
          </ButtonInner>
        </button>
      </div>
    </form>
  );
}
