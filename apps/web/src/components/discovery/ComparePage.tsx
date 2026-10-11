'use client';
// EP-31 (CAT-092) — the comparison table: one column per property — photo, title, town, price (reference currency and
// the property's), indicative monthly payment, surface, rooms, bathrooms, floors, delivery, standing, programme,
// promoter, lots available, features (✓ or —), nearby, flight times, 360° tour. « Afficher seulement les différences »;
// « Retirer » on top of a column, « Exprimer mon intérêt » and « Sauvegarder » under it. A row without any value is
// hidden; a property no longer available keeps its column, veiled, with its availability. Phones: two columns in view,
// snapped horizontal scrolling, the labels column sticky.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CompareItem } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { askSignInForFavorite, useCompare, showToast } from '@/lib/discovery';
import { useHearts } from '@/lib/account-favorites';
import { deliveryText, money, surfaceText } from '@/lib/format';
import { RowsSkeleton } from '@/components/vitrine/Skeletons';
import { t } from '@/lib/i18n';
import p from './pages.module.css';

/** « Revenir aux résultats » — back to the previous page if it was the catalogue (TRV-108), else the catalogue. */
export function BackToResults() {
  const router = useRouter();
  return (
    <Link
      href="/programmes"
      className={p.back}
      onClick={(e) => {
        try {
          const ref = document.referrer ? new URL(document.referrer) : null;
          if (ref && ref.origin === window.location.origin && ref.pathname.startsWith('/programmes') && window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        } catch {
          /* keep the link */
        }
      }}
    >
      <Icon name="arrow-left" size={16} />
      {t('ui.compare.page.back')}
    </Link>
  );
}

/** Without `biens` in the address: the browser's set, if any (the address then carries it, to be shared). */
export function CompareFromStorage({ empty }: { empty: ReactNode }) {
  const { refs } = useCompare();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setChecked(true);
    if (refs.length) router.replace(`/comparer?biens=${refs.join(',')}`);
  }, [refs, router]);
  if (!checked || refs.length) return <RowsSkeleton rows={Math.max(refs.length, 2)} label={t('ui.compare.page.loading')} />;
  return <>{empty}</>;
}

interface Row {
  key: string;
  label: string;
  values: ReactNode[];
  /** Comparable form of each value (diff-only); null: no value. */
  raw: (string | null)[];
  group?: boolean;
}

function floorsText(f: CompareItem['floors']): string | null {
  if (!f) return null;
  const one = (n: number) => (n === 0 ? t('ui.property.facts.floorGround') : t('ui.property.facts.floorN', { n }));
  return f.min === f.max ? one(f.min) : t('ui.property.facts.floorsRange', { min: one(f.min), max: one(f.max) });
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
}

export function CompareTable({
  items,
  refs,
  prefix,
  monthlyEnabled,
  footnote,
  convertedNote,
}: {
  items: CompareItem[];
  refs: string[];
  prefix: string;
  monthlyEnabled: boolean;
  footnote: string;
  convertedNote: string;
}) {
  const router = useRouter();
  const compare = useCompare();
  const favorites = useHearts();
  const [diffOnly, setDiffOnly] = useState(false);

  const removeColumn = (ref: string) => {
    if (compare.has(ref)) compare.remove(ref);
    const rest = refs.filter((r) => r !== ref);
    router.replace(rest.length ? `/comparer?biens=${rest.join(',')}` : '/comparer', { scroll: false });
  };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const add = (key: string, label: string, raw: (string | null)[], values?: ReactNode[]) => out.push({ key, label, raw, values: values ?? raw.map((v) => v ?? '—') });
    const cards = items.map((i) => i.card);
    if (items.some((i) => i.card.availability !== 'AVAILABLE')) add('availability', t('ui.compare.page.rows.availability'), cards.map((c) => t(`ui.compare.page.availability.${c.availability}`)));
    add('city', t('ui.compare.page.rows.city'), cards.map((c) => (c.city ? `${c.city.name}, ${c.region.name}` : c.region.name)));
    add(
      'price',
      t('ui.compare.page.rows.price'),
      items.map((i) => money(i.card.priceFromRef) ?? money(i.priceFrom)),
      items.map((i) => {
        const ref = money(i.card.priceFromRef);
        const native = money(i.priceFrom);
        if (!ref && !native) return '—';
        return (
          <span className={p.priceCell}>
            {i.card.priceIsFrom ? <span className={p.muted}>{t('ui.catalogue.card.priceFrom')} </span> : null}
            <strong>{ref ?? native}</strong>
            {ref && native ? <span className={p.muted}>{native}</span> : null}
          </span>
        );
      }),
    );
    if (monthlyEnabled) add('monthly', t('ui.compare.page.rows.monthly'), cards.map((c) => (money(c.monthlyFromRef) ? t('ui.property.financing.perMonth', { montant: money(c.monthlyFromRef)! }) : null)));
    add('surface', t('ui.compare.page.rows.surface'), cards.map((c) => surfaceText(c.surfaceMin, c.surfaceMax)));
    add('rooms', t('ui.compare.page.rows.rooms'), cards.map((c) => (c.rooms !== null && c.type !== 'LAND' && c.type !== 'COMMERCIAL' ? t('ui.property.facts.roomsValue', { prefix, rooms: String(c.rooms) }) : null)));
    add('bathrooms', t('ui.compare.page.rows.bathrooms'), items.map((i) => (i.bathrooms !== null ? String(i.bathrooms) : null)));
    add('floors', t('ui.compare.page.rows.floors'), items.map((i) => floorsText(i.floors)));
    add('delivery', t('ui.compare.page.rows.delivery'), cards.map((c) => deliveryText(c.delivery)));
    add('standing', t('ui.compare.page.rows.standing'), cards.map((c) => t(`ui.enum.Standing.${c.standing}`)));
    add(
      'program',
      t('ui.compare.page.rows.program'),
      items.map((i) => i.program?.name ?? null),
      items.map((i) => (i.program ? <Link href={`/programmes/${i.program.slug}`}>{i.program.name}</Link> : '—')),
    );
    add(
      'promoter',
      t('ui.compare.page.rows.promoter'),
      items.map((i) => i.promoter.name),
      items.map((i) => <Link href={`/promoteurs/${i.promoter.slug}`}>{i.promoter.name}</Link>),
    );
    add('lots', t('ui.compare.page.rows.lots'), items.map((i) => t('ui.compare.page.lotsValue', { n: i.lotsAvailable })));
    // Features: one line per feature present in at least one property (✓ or —).
    const features = new Map<string, string>();
    for (const i of items) for (const f of i.features) features.set(f.code, f.label);
    if (features.size) {
      out.push({ key: 'features', label: t('ui.compare.page.rows.features'), values: items.map(() => ''), raw: items.map(() => 'x'), group: true });
      for (const [code, label] of features) {
        const has = items.map((i) => i.features.some((f) => f.code === code));
        out.push({
          key: `f-${code}`,
          label,
          raw: has.map((h) => (h ? 'yes' : 'no')),
          values: has.map((h) =>
            h ? (
              <span className={p.yes}>
                <Icon name="check" size={16} label={t('ui.compare.page.yes')} />
              </span>
            ) : (
              <span className={p.no} aria-label={t('ui.compare.page.no')}>
                —
              </span>
            ),
          ),
        });
      }
    }
    const list = (entries: string[]) => (entries.length ? <ul className={p.cellList}>{entries.map((e) => <li key={e}>{e}</li>)}</ul> : '—');
    const nearby = items.map((i) => i.pois.map((poi) => t('ui.property.location.poi', { label: poi.label, minutes: poi.minutes, mode: t(`ui.property.location.modes.${poi.mode as 'CAR' | 'WALK' | 'TRANSIT'}`) })));
    add('nearby', t('ui.compare.page.rows.nearby'), nearby.map((n) => (n.length ? n.join('|') : null)), nearby.map(list));
    const flights = items.map((i) => i.travelTimes.map((tt) => (tt.via ? t('ui.property.location.via', { ville: tt.fromCity, duree: duration(tt.minutes), via: tt.via }) : t('ui.property.location.flight', { ville: tt.fromCity, duree: duration(tt.minutes) }))));
    add('flights', t('ui.compare.page.rows.flights'), flights.map((f) => (f.length ? f.join('|') : null)), flights.map(list));
    add('tour360', t('ui.compare.page.rows.tour360'), cards.map((c) => (c.has360Tour ? t('ui.compare.page.yes') : t('ui.compare.page.no'))));
    // CAT-092 — a row without any value for any property is hidden.
    return out.filter((r) => r.group || r.raw.some((v) => v !== null));
  }, [items, monthlyEnabled, prefix]);

  const shown = rows.filter((r) => {
    if (!diffOnly || items.length < 2) return true;
    if (r.group) return true;
    return new Set(r.raw.map((v) => v ?? '')).size > 1;
  });
  // Drop a features title left without lines.
  const visible = shown.filter((r, i) => !r.group || (shown[i + 1] && shown[i + 1]!.key.startsWith('f-')));

  return (
    <div className={p.compare}>
      <div className={p.compareTools}>
        {items.length >= 2 ? (
          <label className={p.switchLabel}>
            <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} />
            <span className={p.switch} aria-hidden="true" />
            {t('ui.compare.page.diffOnly')}
          </label>
        ) : (
          <p className={p.notice}>
            <Icon name="status-info" size={20} />
            {t('ui.compare.page.one')}
          </p>
        )}
      </div>
      <div className={p.scroller} style={{ ['--cols' as string]: items.length }}>
        <table className={p.table}>
          <caption className="visually-hidden">{t('ui.compare.page.title')}</caption>
          <thead>
            <tr>
              <th scope="col" className={p.corner}>
                {t('ui.compare.page.criterion')}
              </th>
              {items.map((i) => {
                const veiled = i.card.availability !== 'AVAILABLE';
                return (
                  <th key={i.card.reference} scope="col" className={[p.colHead, veiled && p.veiled].filter(Boolean).join(' ')}>
                    <div className={p.colPhoto}>
                      {i.card.cover ? <Picture image={i.card.cover} sizes="(max-width: 767px) 45vw, 320px" className={p.colImg} /> : <Icon name="camera" size={32} />}
                      {veiled ? <span className={p.veilTag}>{t(`ui.compare.page.availability.${i.card.availability}`)}</span> : null}
                      <button type="button" className={p.removeCol} onClick={() => removeColumn(i.card.reference)} aria-label={t('ui.compare.page.removeAria', { titre: i.card.title })}>
                        <Icon name="close" size={16} />
                        <span>{t('ui.compare.page.remove')}</span>
                      </button>
                    </div>
                    <Link href={`/biens/${i.card.slug}`} className={p.colTitle}>
                      {i.card.title}
                    </Link>
                    <span className={p.colStanding}>{t(`ui.enum.Standing.${i.card.standing}`)}</span>
                  </th>
                );
              })}
              {items.length < 3 ? (
                <th scope="col" className={p.addCol}>
                  <Link href="/programmes" className={p.addLink}>
                    <Icon name="plus" size={24} />
                    <strong>{t('ui.compare.page.add')}</strong>
                    <span>{t('ui.compare.page.addHint')}</span>
                  </Link>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) =>
              r.group ? (
                <tr key={r.key} className={p.groupRow}>
                  <th scope="rowgroup" colSpan={items.length + 1 + (items.length < 3 ? 1 : 0)}>
                    {r.label}
                  </th>
                </tr>
              ) : (
                <tr key={r.key}>
                  <th scope="row" className={p.rowHead}>
                    {r.label}
                  </th>
                  {r.values.map((v, idx) => (
                    <td key={idx} className={items[idx]!.card.availability !== 'AVAILABLE' ? p.veiledCell : undefined}>
                      {v}
                    </td>
                  ))}
                  {items.length < 3 ? <td aria-hidden="true" /> : null}
                </tr>
              ),
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className={p.rowHead} />
              {items.map((i) => {
                const saved = favorites.has(i.card.reference);
                return (
                  <td key={i.card.reference}>
                    <div className={p.colActions}>
                      {i.card.availability === 'AVAILABLE' ? (
                        <Link href={`/biens/${i.card.slug}?interet=1`} className={buttonClass('primary', 'S', true)}>
                          <ButtonInner size="S">{t('ui.compare.page.interest')}</ButtonInner>
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className={buttonClass('secondary', 'S', true)}
                        aria-pressed={saved}
                        onClick={async () => {
                          if (saved) return;
                          const r = await favorites.toggle(i.card.reference);
                          if (r === 'SIGN_IN') return askSignInForFavorite(i.card.reference);
                          if (r === 'ERROR') return showToast({ message: t('ui.clientTools.favorites.error'), tone: 'error' });
                          showToast(r === 'FULL' ? { message: t('ui.favorites.toast.full', { n: favorites.max }), tone: 'info' } : { message: t('ui.favorites.toast.added'), link: { label: t('ui.favorites.toast.see'), href: favorites.href } });
                        }}
                      >
                        <ButtonInner size="S" icon={saved ? 'check' : 'heart'}>
                          {saved ? t('ui.compare.page.saved') : t('ui.compare.page.save')}
                        </ButtonInner>
                      </button>
                    </div>
                  </td>
                );
              })}
              {items.length < 3 ? <td aria-hidden="true" /> : null}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={p.footnote}>{[monthlyEnabled && items.some((i) => i.card.monthlyFromRef) ? footnote : null, convertedNote].filter(Boolean).join(' ')}</p>
    </div>
  );
}
