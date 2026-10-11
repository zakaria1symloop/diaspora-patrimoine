'use client';
// EC-41 « Mes favoris » (SFA-022 … SFA-024) — a card drawn for THIS page (D-098), not the catalogue's: what the person
// does here is come back to a property set aside. So each card says what changed since it was added (AUT-062: price,
// last lots, availability), when it was added, the three figures that matter (price, down payment, indicative monthly
// payment with its asterisk — TRV-023), and offers ONE main action — « Exprimer mon intérêt », or « Suivre dans mes
// intérêts » once it is sent — then visibly secondary ones: see the property, write to my advisor about it, compare,
// remove (undone from the short message, TRV-081). The photo and the title open the property page.
// « Comparer » works here (it did nothing in the space: the comparison tray lives in the public chrome): the choice is
// the browser's set of CAT-092 (`dp_compare`, three at most, shared with the site), and the bar of this page leads to
// the comparator with the chosen references. The list is bounded (100, SFA-023): filter, search and sort happen
// here, their state in the address (TRV-101). A reserved or sold property stays, veiled; an archived one stays 30 days.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { COMPARE_MAX, type AccountFavorite, type AccountFavoritesResponse } from '@dp/contracts';
import { ButtonInner, Icon, buttonClass } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { setAccountFavorites, useHearts } from '@/lib/account-favorites';
import { showToast, useCompare } from '@/lib/discovery';
import { deliveryText, money, surfaceText } from '@/lib/format';
import { t } from '@/lib/i18n';
import { EmptyState } from '@/components/client-space/EmptyState';
import { useOptionalSpace } from '@/components/client-space/SpaceContext';
import { writeToAdvisorHref } from '@/components/client-space/advisor-link';
import { Encouragement } from '@/components/client-space/kit/Encouragement';
import { Figures } from '@/components/client-space/kit/Figures';
import { PhotoNote } from '@/components/client-space/kit/PhotoNote';
import { FilterChips, matches, NoMatch, ResultLine, SearchBox, SortSelect, Toolbar, useListState } from '@/components/client-space/kit/ListControls';
import k from '@/components/client-space/kit/kit.module.css';
import space from '@/components/client-space/space.module.css';
import { longDate } from './format';
import s from './favorites.module.css';

type Filter = '' | 'disponibles' | 'changes' | 'interet' | 'retires';
const isGone = (f: AccountFavorite) => f.state === 'GONE';
const isAvailable = (f: AccountFavorite) => f.state === 'ONLINE' && f.card.availability === 'AVAILABLE';
const price = (f: AccountFavorite) => (f.state === 'ONLINE' && f.card.priceFromRef ? Number(f.card.priceFromRef.amount) : Number.POSITIVE_INFINITY);
const monthlyOf = (f: AccountFavorite) => (f.state === 'ONLINE' && f.card.monthlyFromRef ? Number(f.card.monthlyFromRef.amount) : Number.POSITIVE_INFINITY);
const titleOf = (f: AccountFavorite) => (f.state === 'ONLINE' ? f.card.title : f.title);

export function AccountFavorites({ initial, monthlyEnabled, footnote }: { initial: AccountFavoritesResponse; monthlyEnabled: boolean; footnote: string }) {
  const [items, setItems] = useState<AccountFavorite[]>(initial.data);
  const hearts = useHearts();
  const compare = useCompare();
  const tz = useOptionalSpace()?.summary.timeZone ?? 'Europe/Paris';
  const list = useListState({ tri: 'recent' });
  // The hearts of this page and of the site share one list.
  useEffect(() => setAccountFavorites(initial.references), [initial.references]);
  useEffect(() => setItems(initial.data), [initial.data]);
  // A favourite removed (here or by a heart): it leaves the list; « Annuler » puts it back.
  const visible = hearts.mode === 'account' ? items.filter((i) => hearts.has(i.reference)) : items;

  const filter = list.get('filtre') as Filter;
  const sort = list.get('tri');
  const q = list.get('q');
  const count = {
    disponibles: visible.filter(isAvailable).length,
    changes: visible.filter((f) => f.change).length,
    interet: visible.filter((f) => f.interest).length,
    retires: visible.filter(isGone).length,
  };
  let shown = visible.filter(
    (f) =>
      (filter === '' || (filter === 'disponibles' && isAvailable(f)) || (filter === 'changes' && f.change) || (filter === 'interet' && f.interest) || (filter === 'retires' && isGone(f))) &&
      matches([titleOf(f), f.reference, f.state === 'ONLINE' ? f.card.city?.name : null, f.state === 'ONLINE' ? f.card.region.name : null, f.state === 'ONLINE' ? f.card.program?.name : null], q),
  );
  if (sort === 'prix') shown = [...shown].sort((a, b) => price(a) - price(b));
  if (sort === 'mensualite') shown = [...shown].sort((a, b) => monthlyOf(a) - monthlyOf(b));
  const filtered = list.active(['filtre', 'q']);
  const clear = () => list.clear(['filtre', 'q']);

  const remove = async (item: AccountFavorite) => {
    const result = await hearts.toggle(item.reference);
    if (result === 'ERROR') return showToast({ message: t('ui.clientTools.favorites.error'), tone: 'error' });
    compare.remove(item.reference);
    showToast({ message: t('ui.clientTools.favorites.removed'), action: { label: t('ui.clientTools.favorites.undo'), onClick: () => void hearts.toggle(item.reference) } });
  };

  const toggleCompare = (item: AccountFavorite) => {
    if (compare.has(item.reference)) return compare.remove(item.reference);
    if (compare.add(item.reference) === 'FULL') showToast({ message: t('ui.clientTools.favorites.compare.full'), tone: 'info' });
  };

  if (!visible.length) {
    return (
      <EmptyState
        icon="heart"
        title={t('ui.clientTools.favorites.empty')}
        text={t('ui.clientTools.favorites.emptyText')}
        actions={
          <Link href="/programmes" className={buttonClass('tool', 'L')}>
            <ButtonInner size="L" chevron>
              {t('ui.clientTools.favorites.discover')}
            </ButtonInner>
          </Link>
        }
      />
    );
  }

  // The comparison counts only favourites still on the page and online.
  const comparable = visible.filter((f) => f.state === 'ONLINE').map((f) => f.reference);
  const chosen = compare.refs.filter((r) => comparable.includes(r));
  const anyMonthly = monthlyEnabled && shown.some((f) => f.state === 'ONLINE' && f.card.monthlyFromRef);

  return (
    <div className={s.page}>
      {count.changes > 0 && filter !== 'changes' ? (
        <Encouragement
          tone="attention"
          icon="bell"
          title={t('ui.clientTools.favorites.encourage.changed.title', { n: count.changes })}
          text={t('ui.clientTools.favorites.encourage.changed.text')}
          actions={
            <button type="button" className={buttonClass('tool', 'M')} onClick={() => list.set({ filtre: 'changes' }, { push: true })}>
              <ButtonInner size="M">{t('ui.clientTools.favorites.encourage.changed.action')}</ButtonInner>
            </button>
          }
        />
      ) : count.interet === 0 && count.disponibles > 0 ? (
        <Encouragement
          tone="calm"
          icon="heart"
          title={t('ui.clientTools.favorites.encourage.next.title', { n: visible.length })}
          text={`${t('ui.clientTools.favorites.encourage.next.text')}${comparable.length > 1 ? ` ${t('ui.clientTools.favorites.encourage.compare.text')}` : ''}`}
        />
      ) : null}

      <Toolbar
        end={
          <>
            {visible.length > 4 ? <SearchBox label={t('ui.clientTools.favorites.search')} value={q} onChange={(v) => list.set({ q: v })} /> : null}
            {visible.length > 1 ? (
              <SortSelect
                value={sort}
                onChange={(v) => list.set({ tri: v }, { push: true })}
                options={[
                  { value: 'recent', label: t('ui.clientTools.favorites.sort.recent') },
                  { value: 'prix', label: t('ui.clientTools.favorites.sort.priceAsc') },
                  ...(monthlyEnabled ? [{ value: 'mensualite', label: t('ui.clientTools.favorites.sort.monthlyAsc') }] : []),
                ]}
              />
            ) : null}
          </>
        }
      >
        <FilterChips
          label={t('ui.clientTools.favorites.filter.label')}
          value={filter}
          onChange={(v) => list.set({ filtre: v }, { push: true })}
          options={[
            { value: '', label: t('ui.clientTools.favorites.filter.all'), count: visible.length },
            { value: 'disponibles', label: t('ui.clientTools.favorites.filter.available'), count: count.disponibles },
            { value: 'changes', label: t('ui.clientTools.favorites.filter.changed'), count: count.changes },
            { value: 'interet', label: t('ui.clientTools.favorites.filter.interest'), count: count.interet },
            { value: 'retires', label: t('ui.clientTools.favorites.filter.gone'), count: count.retires },
          ].filter((o) => o.value === '' || o.value === 'disponibles' || o.count > 0 || o.value === filter)}
        />
      </Toolbar>
      <ResultLine shown={shown.length} total={visible.length} filtered={filtered} onClear={clear}>
        {!filtered ? <span>{t('ui.clientTools.favorites.count', { n: visible.length, max: initial.max })}</span> : null}
        {visible.length >= initial.max ? <span className={s.limit}>{t('ui.clientTools.favorites.limit', { n: initial.max })}</span> : null}
      </ResultLine>

      {shown.length === 0 ? (
        <NoMatch onClear={clear} />
      ) : (
        <ul role="list" className={s.grid}>
          {shown.map((item, i) => (
            <li key={item.reference}>
              <FavoriteCard
                item={item}
                index={i}
                tz={tz}
                monthlyEnabled={monthlyEnabled}
                downPaymentPct={initial.referenceDownPaymentPct}
                compared={compare.has(item.reference)}
                onCompare={() => toggleCompare(item)}
                onRemove={() => void remove(item)}
              />
            </li>
          ))}
        </ul>
      )}
      {anyMonthly ? <p className={k.footnote}>{footnote}</p> : null}

      {chosen.length ? (
        <aside className={s.compareBar} aria-label={t('ui.clientTools.favorites.compare.bar')} data-compare-bar>
          <span className={s.compareIcon} aria-hidden="true">
            <Icon name="scale" size={20} />
          </span>
          <p className={s.compareText} role="status">
            <strong>{t('ui.clientTools.favorites.compare.selected', { n: chosen.length })}</strong>
            {chosen.length < 2 ? <span>{t('ui.clientTools.favorites.compare.hint')}</span> : null}
          </p>
          <button type="button" className={k.quiet} onClick={() => chosen.forEach((r) => compare.remove(r))}>
            {t('ui.clientTools.favorites.compare.clear')}
          </button>
          {chosen.length >= 2 ? (
            <Link href={`/comparer?biens=${chosen.slice(0, COMPARE_MAX).join(',')}`} className={buttonClass('tool', 'M')}>
              <ButtonInner size="M" chevron>
                {t('ui.clientTools.favorites.compare.go', { n: chosen.length })}
              </ButtonInner>
            </Link>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

function FavoriteCard({
  item,
  index,
  tz,
  monthlyEnabled,
  downPaymentPct,
  compared,
  onCompare,
  onRemove,
}: {
  item: AccountFavorite;
  index: number;
  tz: string;
  monthlyEnabled: boolean;
  downPaymentPct: string;
  compared: boolean;
  onCompare: () => void;
  onRemove: () => void;
}) {
  const added = t('ui.clientTools.favorites.addedOn', { date: longDate(item.addedAt, tz) });
  const change = item.change ? (
    <p className={s.change}>
      <span className={`${space.tag} ${item.change.kind === 'PRICE_DROP' ? space.tagSuccess : space.tagWarning}`}>{t(`ui.clientTools.favorites.change.${item.change.kind ?? 'OTHER'}`)}</span>
      <span className={s.changeText}>
        {item.change.title} <span className={s.changeDate}>({t('ui.clientTools.favorites.changedOn', { date: longDate(item.change.at, tz) })})</span>
      </span>
    </p>
  ) : null;

  if (item.state === 'GONE') {
    return (
      <article className={`${s.card} ${s.gone} ${k.enter}`} style={{ ['--i' as string]: index }} data-favorite="GONE">
        <div className={s.body}>
          <div className={s.head}>
            <span className={`${space.tag} ${space.tagNeutral}`}>{t('ui.clientTools.favorites.gone')}</span>
            <span className={s.added}>{added}</span>
          </div>
          <h2 className={s.title}>{item.title}</h2>
          <p className={s.hint}>{t('ui.clientTools.favorites.goneHint')}</p>
          {change}
          <div className={s.actions}>
            <Link href="/programmes" className={buttonClass('secondary', 'M')}>
              <ButtonInner size="M">{t('ui.clientTools.favorites.discover')}</ButtonInner>
            </Link>
            <button type="button" className={`${k.quiet} ${k.quietDanger}`} onClick={onRemove} aria-label={t('ui.clientTools.favorites.removeTitled', { titre: item.title })}>
              <Icon name="trash" size={20} />
              {t('ui.clientTools.favorites.remove')}
            </button>
          </div>
        </div>
      </article>
    );
  }

  const c = item.card;
  const href = `/biens/${c.slug}`;
  const available = c.availability === 'AVAILABLE';
  const place = [c.city?.name, c.region.name].filter(Boolean).join(', ');
  const monthly = monthlyEnabled && available ? money(c.monthlyFromRef) : null;
  return (
    <article className={[s.card, k.enter, !available && s.veiled, compared && s.compared].filter(Boolean).join(' ')} style={{ ['--i' as string]: index }} data-favorite={c.availability}>
      <Link href={href} className={s.photo} tabIndex={-1} aria-hidden="true">
        {c.cover ? <Picture image={c.cover} sizes="(max-width: 639px) 92vw, 380px" className={s.img} alt="" /> : <Icon name="building" size={32} />}
        <PhotoNote image={c.cover} />
        {!available ? <span className={s.badge}>{t(`ui.clientTools.favorites.availability.${c.availability as 'RESERVED'}`)}</span> : null}
      </Link>
      <div className={s.body}>
        <div className={s.head}>
          {item.interest ? <span className={`${space.tag} ${space.tagSuccess}`}>{t('ui.clientTools.favorites.interestSent')}</span> : <span className={s.program}>{c.program?.name ?? t(`ui.enum.PropertyType.${c.type}`)}</span>}
          <span className={s.added}>{added}</span>
        </div>
        <h2 className={s.title}>
          <Link href={href}>{c.title}</Link>
        </h2>
        <p className={s.place}>
          <Icon name="map-pin" size={16} />
          {place}
        </p>
        <p className={s.facts}>{[surfaceText(c.surfaceMin, c.surfaceMax), deliveryText(c.delivery)].filter(Boolean).join(' · ')}</p>
        {change}
        <Figures
          items={[
            { label: c.priceIsFrom ? t('ui.clientTools.favorites.priceFrom') : t('ui.clientTools.favorites.price'), value: money(c.priceFromRef), accent: true },
            { label: t('ui.clientTools.favorites.downPayment', { pct: String(Math.round(Number(downPaymentPct))) }), value: available ? money(c.downPaymentRef) : null },
            { label: t('ui.clientTools.favorites.monthly'), value: monthly ? `${monthly} ${t('ui.common.perMonth')}` : null },
          ]}
        />
        {!available ? <p className={s.hint}>{t('ui.clientTools.favorites.notAvailable')}</p> : null}
        <div className={s.actions}>
          {item.interest ? (
            <Link href="/espace-client/interets" className={buttonClass('tool', 'M')}>
              <ButtonInner size="M" chevron>
                {t('ui.clientTools.favorites.followInterest')}
              </ButtonInner>
            </Link>
          ) : available ? (
            <Link href={`${href}?interet=1`} className={buttonClass('tool', 'M')}>
              <ButtonInner size="M" chevron>
                {t('ui.clientTools.favorites.interest')}
              </ButtonInner>
            </Link>
          ) : null}
          <Link href={href} className={buttonClass('secondary', 'M')} aria-label={t('ui.clientTools.favorites.seeTitled', { titre: c.title })}>
            <ButtonInner size="M">{t('ui.clientTools.favorites.see')}</ButtonInner>
          </Link>
        </div>
        <div className={s.tools}>
          <label className={[s.compare, compared && s.compareOn].filter(Boolean).join(' ')}>
            <input type="checkbox" className="visually-hidden" checked={compared} onChange={onCompare} aria-label={t('ui.clientTools.favorites.compare.toggleTitled', { titre: c.title })} />
            <span className={s.compareBox} aria-hidden="true">
              {compared ? <Icon name="check" size={16} /> : null}
            </span>
            {t('ui.clientTools.favorites.compare.toggle')}
          </label>
          <Link href={writeToAdvisorHref({ from: 'PROPERTY_ABOUT', property: { reference: c.reference, title: c.title } })} className={k.quiet} aria-label={t('ui.clientTools.favorites.writeAbout', { titre: c.title })}>
            <Icon name="chat" size={20} />
            {t('ui.clientTools.favorites.write')}
          </Link>
          <button type="button" className={`${k.quiet} ${k.quietDanger} ${s.remove}`} onClick={onRemove} aria-label={t('ui.clientTools.favorites.removeTitled', { titre: c.title })}>
            <Icon name="trash" size={20} />
            {t('ui.clientTools.favorites.remove')}
          </button>
        </div>
      </div>
    </article>
  );
}
