'use client';
// ARC-042, D-056 — the catalogue map (CAT-090), on MapLibre: the OpenStreetMap background of the provider named by
// MAP_STYLE_URL (FIC-060). One marker per programme at its approximate point; markers close on screen gather into a
// numbered badge that zooms in when clicked. Markers are real buttons, laid over the map in DOM order: they are reached
// with the keyboard and read by screen readers (the list stays the accessible equivalent of the map).
// Moving or zooming does not search again: `onAreaChange` lets the page offer « Rechercher dans cette zone ».
// The library is loaded only when the map is shown (dynamic import); a style that does not answer calls `onUnavailable`.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { Icon } from '../components/Icon';
import { clusterPoints } from './cluster';
import s from './map.module.css';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  count: number;
  /** Accessible name of the marker (« Résidence El Yasmine, Chéraga : 3 biens »). */
  label: string;
}

export type Bbox = [west: number, south: number, east: number, north: number];

export interface CatalogueMapProps {
  styleUrl: string;
  /** Address of the MapLibre worker module served by the site. */
  workerUrl: string;
  points: MapPoint[];
  /** The marker of the card hovered in the list grows (CAT-090). */
  highlighted?: string | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** The bubble of the selected marker (programme, town, « à partir de », count, « Voir les biens »). */
  renderBubble: (id: string) => ReactNode;
  /** Called after a move or zoom made by the person (not after a fit). */
  onAreaChange?: (bbox: Bbox) => void;
  /** Area to show first (the `bbox` of the address), else the markers. */
  initialBbox?: Bbox | null;
  onUnavailable: () => void;
  labels: { region: string; cluster: (n: number) => string; close: string; loading: string };
  className?: string;
}

const CLUSTER_RADIUS = 44;

/** Room around the markers; on phones the list panel covers the lower half of the map (CAT-090). */
function fitPadding(el: HTMLElement | null) {
  const h = el?.clientHeight ?? 0;
  const phone = typeof window !== 'undefined' && window.innerWidth < 1024;
  return phone ? { top: 64, left: 40, right: 56, bottom: Math.round(h * 0.5) + 32 } : 56;
}
const LOAD_TIMEOUT_MS = 12_000;

export function CatalogueMap({ styleUrl, workerUrl, points, highlighted, selected, onSelect, renderBubble, onAreaChange, initialBbox, onUnavailable, labels, className }: CatalogueMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState(0); // re-render on every move: markers follow the map
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const onAreaRef = useRef(onAreaChange);
  onAreaRef.current = onAreaChange;
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;

  const boundsOf = useCallback((list: MapPoint[]): Bbox | null => {
    if (!list.length) return null;
    const lngs = list.map((p) => p.lng);
    const lats = list.map((p) => p.lat);
    const pad = 0.02;
    return [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad];
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        const lib = await import('maplibre-gl');
        if (cancelled || !container.current) return;
        lib.setWorkerUrl(workerUrl);
        const start = initialBbox ?? boundsOf(pointsRef.current);
        const m = new lib.Map({
          container: container.current,
          style: styleUrl,
          ...(start ? { bounds: start, fitBoundsOptions: { padding: fitPadding(container.current), maxZoom: 13 } } : { center: [3.06, 36.75], zoom: 5 }),
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
        m.touchZoomRotate.disableRotation();
        m.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
        map.current = m;
        timer = setTimeout(() => {
          if (!m.loaded()) unavailableRef.current();
        }, LOAD_TIMEOUT_MS);
        m.on('load', () => {
          if (timer) clearTimeout(timer);
          if (!cancelled) setReady(true);
        });
        m.on('error', () => {
          // A tile that fails later is not fatal; a style that never loads is (FIC-061).
          if (!m.isStyleLoaded() && !m.loaded()) unavailableRef.current();
        });
        m.on('move', () => setFrame((f) => (f + 1) % 1_000_000));
        m.on('moveend', (e: { originalEvent?: unknown }) => {
          if (!e.originalEvent) return;
          const b = m.getBounds();
          onAreaRef.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
        });
      } catch {
        unavailableRef.current();
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      map.current?.remove();
      map.current = null;
    };
    // The map is created once; points and area changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl, workerUrl]);

  // New results (other criteria): show them all, unless the person chose an area.
  const pointsKey = points.map((p) => p.id).join('|');
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || initialBbox) return;
    const b = boundsOf(points);
    if (b) m.fitBounds(b, { padding: fitPadding(container.current), maxZoom: 13, duration: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, ready]);

  const projected = useMemo(() => {
    const m = map.current;
    if (!m || !ready) return [];
    return points.map((p) => {
      const pt = m.project([p.lng, p.lat]);
      return { id: p.id, x: pt.x, y: pt.y, count: p.count };
    });
    // `frame` changes on every move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, ready, frame]);

  const clusters = useMemo(() => clusterPoints(projected, CLUSTER_RADIUS), [projected]);
  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);

  const zoomTo = (ids: string[]) => {
    const m = map.current;
    const b = boundsOf(ids.map((id) => byId.get(id)!).filter(Boolean));
    if (m && b) m.fitBounds(b, { padding: 80, maxZoom: Math.min(m.getZoom() + 4, 15) });
  };

  const selectedPoint = selected ? projected.find((p) => p.id === selected) : null;
  const size = container.current ? { w: container.current.clientWidth, h: container.current.clientHeight } : { w: 0, h: 0 };
  const visible = (x: number, y: number) => x >= -20 && y >= -20 && x <= size.w + 20 && y <= size.h + 20;

  return (
    <div className={[s.wrap, className].filter(Boolean).join(' ')}>
      <div ref={container} className={s.canvas} role="region" aria-label={labels.region} />
      {!ready ? (
        <div className={s.loading} aria-live="polite">
          <span className={s.pulse} aria-hidden="true" />
          {labels.loading}
        </div>
      ) : null}
      <ul className={s.markers} role="list">
        {clusters
          .filter((c) => visible(c.x, c.y))
          .map((c) => {
            if (c.ids.length > 1) {
              return (
                <li key={c.ids.join('|')} className={s.at} style={{ transform: `translate(${c.x}px, ${c.y}px)` }}>
                  <button type="button" className={s.cluster} onClick={() => zoomTo(c.ids)} aria-label={labels.cluster(c.count)}>
                    {c.count}
                  </button>
                </li>
              );
            }
            const p = byId.get(c.ids[0]!)!;
            const on = selected === p.id;
            const hot = highlighted === p.id;
            return (
              <li key={p.id} className={s.at} style={{ transform: `translate(${c.x}px, ${c.y}px)` }}>
                <button
                  type="button"
                  className={[s.marker, on && s.markerOn, hot && s.markerHot].filter(Boolean).join(' ')}
                  aria-label={p.label}
                  aria-pressed={on}
                  onClick={() => onSelect(on ? null : p.id)}
                >
                  <span className={s.markerCount}>{p.count}</span>
                </button>
              </li>
            );
          })}
      </ul>
      {selectedPoint && visible(selectedPoint.x, selectedPoint.y) ? (
        <div className={s.bubbleAt} style={{ transform: `translate(${selectedPoint.x}px, ${selectedPoint.y}px)` }}>
          <div className={s.bubble} role="dialog" aria-label={byId.get(selectedPoint.id)?.label}>
            <button type="button" className={s.bubbleClose} onClick={() => onSelect(null)} aria-label={labels.close}>
              <Icon name="close" size={16} />
            </button>
            {renderBubble(selectedPoint.id)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
