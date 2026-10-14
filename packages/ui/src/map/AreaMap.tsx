'use client';
// FIC-060, FIC-061 — the location map of a property or programme page: the approximate point (a ~500 m cell) drawn as
// a 600 m circle, without a pin; without coordinates, the town (zoom 12) or the region (zoom 9), without a circle.
// Loaded only when the section comes near the screen; if the style does not answer, `onUnavailable` lets the page show
// the place as text (never an empty zone). Scroll does not zoom (the page keeps scrolling); buttons and drag do.
// The circle always fits whole in the frame, whatever its width (a phone showed it cut on both sides), and the credits
// start folded behind their « i » so that they do not cover a small map.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { circleRing, foldAttribution } from './cluster';
import s from './map.module.css';

export interface AreaMapProps {
  styleUrl: string;
  workerUrl: string;
  center: { lat: number; lng: number };
  zoom: number;
  /** Metres; null: no circle (centred on a town or region). */
  circleRadiusM: number | null;
  label: string;
  loadingLabel: string;
  onUnavailable: () => void;
  className?: string;
}

const LOAD_TIMEOUT_MS = 12_000;

function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function AreaMap({ styleUrl, workerUrl, center, zoom, circleRadiusM, label, loadingLabel, onUnavailable, className }: AreaMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;

  // FIC-061 — nothing is loaded before the section approaches the screen.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        const lib = await import('maplibre-gl');
        if (cancelled || !container.current) return;
        lib.setWorkerUrl(workerUrl);
        const m = new lib.Map({
          container: container.current,
          style: styleUrl,
          center: [center.lng, center.lat],
          zoom: circleRadiusM ? 14 : zoom,
          attributionControl: { compact: true },
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          cooperativeGestures: false,
        });
        m.touchZoomRotate.disableRotation();
        m.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
        map.current = m;
        timer = setTimeout(() => !m.loaded() && unavailableRef.current(), LOAD_TIMEOUT_MS);
        m.on('error', () => {
          if (!m.isStyleLoaded() && !m.loaded()) unavailableRef.current();
        });
        m.on('load', () => {
          if (timer) clearTimeout(timer);
          if (cancelled) return;
          foldAttribution(container.current);
          if (circleRadiusM) {
            const ring = circleRing(center.lng, center.lat, circleRadiusM);
            const lngs = ring.map((c) => c[0]);
            const lats = ring.map((c) => c[1]);
            m.fitBounds(
              [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ],
              { padding: 32, maxZoom: 15, animate: false },
            );
            m.addSource('secteur', {
              type: 'geojson',
              data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } },
            });
            m.addLayer({ id: 'secteur-fond', type: 'fill', source: 'secteur', paint: { 'fill-color': token('--bo-accent-or', '#c8a24a'), 'fill-opacity': 0.22 } });
            m.addLayer({ id: 'secteur-trait', type: 'line', source: 'secteur', paint: { 'line-color': token('--bo-texte-roi', '#06177a'), 'line-width': 2, 'line-dasharray': [2, 1.5] } });
          }
          setReady(true);
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
  }, [near, styleUrl, workerUrl, center.lat, center.lng, zoom, circleRadiusM]);

  return (
    <div ref={box} className={[s.area, className].filter(Boolean).join(' ')}>
      <div ref={container} className={s.canvas} role="img" aria-label={label} />
      {!ready ? (
        <div className={s.loading}>
          <span className={s.pulse} aria-hidden="true" />
          {loadingLabel}
        </div>
      ) : null}
    </div>
  );
}
