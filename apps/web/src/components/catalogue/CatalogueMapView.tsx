'use client';
// CAT-090 — the map view (`vue=carte`). Desktop: the list in compact cards on the left (40 %), the map on the right
// (60 %). Phones: the map fills the screen, the list sits in a panel that slides from the bottom (three heights).
// One marker per programme with the number of matching properties; hovering a card enlarges its marker; a marker opens
// a bubble (programme, town, « à partir de », count, « Voir les biens »). Moving the map does not search again: the
// button « Rechercher dans cette zone » sets `bbox` (CAT-020). The list stays the accessible equivalent of the map.
// The map unavailable (no answer from the background, FIC-061): the list alone, as in the list view.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { criteriaToSearch, type CatalogueCriteria, type CatalogueMap, type PropertyCard } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { CatalogueMap as MapCanvas, type Bbox } from '@dp/ui/map';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { CompactCard } from './CompactCard';
import s from './views.module.css';

type Sheet = 'peek' | 'half' | 'full';
const NEXT_SHEET: Record<Sheet, Sheet> = { peek: 'half', half: 'full', full: 'peek' };

export interface CatalogueMapViewProps {
  styleUrl: string;
  map: CatalogueMap;
  cards: PropertyCard[];
  criteria: CatalogueCriteria;
  monthlyEnabled: boolean;
  /** Pagination and notes, rendered under the list. */
  footer: ReactNode;
  /** The empty state when nothing matches. */
  empty: ReactNode | null;
}

const round = (v: number) => Math.round(v * 10_000) / 10_000;

export function CatalogueMapView({ styleUrl, map, cards, criteria, monthlyEnabled, footer, empty }: CatalogueMapViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [hoverRef, setHoverRef] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [area, setArea] = useState<Bbox | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<Sheet>('half');

  const markerOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const marker of map.markers) for (const ref of marker.references) m.set(ref, marker.key);
    return m;
  }, [map.markers]);
  const byKey = useMemo(() => new Map(map.markers.map((m) => [m.key, m])), [map.markers]);
  const points = useMemo(
    () =>
      map.markers.map((m) => ({
        id: m.key,
        lat: m.lat,
        lng: m.lng,
        count: m.count,
        label: t('ui.catalogue.map.marker', { nom: m.name, lieu: m.city ?? m.region, n: m.count }),
      })),
    [map.markers],
  );

  const searchArea = () => {
    if (!area) return;
    const next: CatalogueCriteria = { ...criteria, bbox: [round(area[0]), round(area[1]), round(area[2]), round(area[3])] };
    delete next.page;
    setArea(null);
    router.push(`${pathname}${criteriaToSearch(next)}`, { scroll: false });
  };
  const clearArea = () => {
    const next: CatalogueCriteria = { ...criteria };
    delete next.bbox;
    delete next.page;
    router.push(`${pathname}${criteriaToSearch(next)}`, { scroll: false });
  };

  const list = (
    <div className={s.mapList}>
      {criteria.bbox ? (
        <p className={s.areaChip}>
          <Icon name="map-pin" size={16} />
          {t('ui.catalogue.map.areaActive')}
          <button type="button" onClick={clearArea} className={s.areaClear}>
            {t('ui.catalogue.map.clearArea')}
          </button>
        </p>
      ) : null}
      {empty ?? (
        <ul className={s.compactList} role="list">
          {cards.map((c) => (
            <li key={c.id} id={`bien-${c.reference}`}>
              <CompactCard card={c} monthlyEnabled={monthlyEnabled} onHover={setHoverRef} />
            </li>
          ))}
        </ul>
      )}
      {map.unlocated ? <p className={s.mapNote}>{t('ui.catalogue.map.unlocated', { n: map.unlocated })}</p> : null}
      {footer}
    </div>
  );

  if (failed) {
    return (
      <div>
        <p className={s.mapNote} role="status">
          {t('ui.catalogue.map.unavailable')}
        </p>
        {list}
      </div>
    );
  }

  return (
    <div className={s.mapLayout} data-sheet={sheet}>
      <section className={s.mapPanel} aria-label={t('ui.catalogue.map.panel')}>
        <button type="button" className={s.sheetHandle} onClick={() => setSheet(NEXT_SHEET[sheet])} aria-label={t('ui.catalogue.map.panelHandle')} aria-expanded={sheet !== 'peek'}>
          <span aria-hidden="true" />
        </button>
        {list}
      </section>
      <div className={s.mapSide}>
        <MapCanvas
          className={s.mapCanvas}
          styleUrl={styleUrl}
          workerUrl="/maplibre/maplibre-gl-worker.mjs"
          points={points}
          highlighted={hoverRef ? (markerOf.get(hoverRef) ?? null) : null}
          selected={selected}
          onSelect={setSelected}
          initialBbox={criteria.bbox ?? null}
          onAreaChange={setArea}
          onUnavailable={() => setFailed(true)}
          labels={{
            region: t('ui.catalogue.map.region'),
            cluster: (n) => t('ui.catalogue.map.cluster', { n }),
            close: t('ui.catalogue.map.close'),
            loading: t('ui.catalogue.map.loading'),
          }}
          renderBubble={(key) => {
            const m = byKey.get(key);
            if (!m) return null;
            const price = money(m.priceFromRef);
            return (
              <div className={s.bubble}>
                <p className={s.bubbleName}>{m.name}</p>
                <p className={s.bubblePlace}>{m.city ? `${m.city}, ${m.region}` : m.region}</p>
                {price ? <p className={s.bubblePrice}>{t('ui.catalogue.map.from', { prix: price })}</p> : null}
                <p className={s.bubbleCount}>{t('ui.catalogue.map.count', { n: m.count })}</p>
                <Link href={m.href} className={buttonClass('primary', 'S', true)} scroll={false}>
                  <ButtonInner size="S">{m.kind === 'PROGRAM' ? t('ui.catalogue.map.see') : t('ui.catalogue.map.seeProperty')}</ButtonInner>
                </Link>
              </div>
            );
          }}
        />
        {area ? (
          <button type="button" className={s.searchArea} onClick={searchArea}>
            <Icon name="search" size={20} />
            {t('ui.catalogue.map.searchArea')}
          </button>
        ) : null}
        <p className={s.mapApprox}>{t('ui.catalogue.map.approx')}</p>
      </div>
    </div>
  );
}
