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
    router.push(`/programmes${qs}${filters ? `${qs ? '&' : '?'}filtres=1` : ''}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(false);
  };

  const monthlySteps = monthlyEnabled ? options.monthlyBudgetSteps : [];
  const fmt = (n: number) => formatNumber(n);

  return (
    <form className={[s.bar, stacked && s.stacked].filter(Boolean).join(' ')} role="search" onSubmit={submit} aria-label={t('ui.catalogue.search.label')}>
      <label className={s.field} htmlFor={`${id}-region`}>
        <Icon name="map-pin" size={24} className={s.gold} />
        <span className={s.text}>
          <span className={s.label}>{t('ui.catalogue.search.city')}</span>
          <select id={`${id}-region`} className={s.select} value={state.region} onChange={(e) => update({ region: e.target.value })}>
            <option value="">{t('ui.catalogue.search.cityAll')}</option>
            {options.regions.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      <span className={s.sep} aria-hidden="true" />
      <label className={s.field} htmlFor={`${id}-budget`}>
        <Icon name="coins" size={24} />
        <span className={s.text}>
          <span className={s.label}>{monthlyEnabled ? t('ui.catalogue.search.budgetMonthly') : t('ui.catalogue.search.budget')}</span>
          <select id={`${id}-budget`} className={s.select} value={state.budget} onChange={(e) => update({ budget: e.target.value })}>
            <option value="">{t('ui.catalogue.search.budgetAny')}</option>
            {monthlySteps.length > 0 ? (
              <optgroup label={t('ui.catalogue.search.budgetGroupMonthly')}>
                {monthlySteps.map((n) => (
                  <option key={`m${n}`} value={`m:${n}`}>
                    {t('ui.catalogue.search.budgetMonthlyStep', { n: fmt(n) })}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {options.priceBudgetSteps.length > 0 ? (
              <optgroup label={t('ui.catalogue.search.budgetGroupTotal')}>
                {options.priceBudgetSteps.map((n) => (
                  <option key={`p${n}`} value={`p:${n}`}>
                    {monthlyEnabled
                      ? t('ui.catalogue.search.budgetPriceStep', { n: fmt(n) })
                      : t('ui.catalogue.search.budgetPriceStepShort', { n: fmt(n) })}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </span>
      </label>
      <span className={s.sep} aria-hidden="true" />
      <label className={s.field} htmlFor={`${id}-type`}>
        <Icon name="home" size={24} />
        <span className={s.text}>
          <span className={s.label}>{t('ui.catalogue.search.type')}</span>
          <select id={`${id}-type`} className={s.select} value={state.type} onChange={(e) => update({ type: e.target.value })}>
            <option value="">{t('ui.catalogue.search.typeAll')}</option>
            {options.types.map((o) => (
              <option key={`${o.type}:${o.rooms ?? ''}`} value={`${o.type}:${o.rooms ?? ''}`}>
                {typeRooms(o.type, o.rooms, roomsPrefix)}
              </option>
            ))}
          </select>
        </span>
      </label>
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
