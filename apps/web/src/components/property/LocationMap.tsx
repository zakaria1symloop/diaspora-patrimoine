'use client';
// FIC-060, FIC-061 — the map of the Location section: the approximate point drawn as a 600 m circle, or the town /
// region; loaded near the screen; without a style (MAP_STYLE_URL) or if the background does not answer, the place in
// text — never an empty zone. « Adresse exacte communiquée après qualification. » stays under it (the section says it).
import { useState, type ReactNode } from 'react';
import type { PublicLocation } from '@dp/contracts';
import { AreaMap } from '@dp/ui/map';
import { t } from '@/lib/i18n';

export function LocationMap({ location, styleUrl, fallback }: { location: PublicLocation; styleUrl: string | null; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const target = location.approx
    ? { center: location.approx, zoom: 14, circle: 600 }
    : location.area
      ? { center: { lat: location.area.lat, lng: location.area.lng }, zoom: location.area.zoom, circle: null }
      : null;
  if (!styleUrl || !target || failed) return <>{fallback}</>;
  const place = location.city ? `${location.city.name}, ${location.region.name}` : location.region.name;
  return (
    <figure style={{ margin: 0 }}>
      <AreaMap
        styleUrl={styleUrl}
        workerUrl="/maplibre/maplibre-gl-worker.mjs"
        center={target.center}
        zoom={target.zoom}
        circleRadiusM={target.circle}
        label={t('ui.property.locationMap.label', { lieu: place })}
        loadingLabel={t('ui.property.locationMap.loading')}
        onUnavailable={() => setFailed(true)}
      />
      <figcaption style={{ marginBlockStart: 'var(--sp-8)', fontSize: 'var(--fs-body-s)', color: 'var(--bo-texte-doux)' }}>
        {target.circle
          ? t('ui.property.locationMap.circle')
          : location.city
            ? t('ui.property.location.area', { ville: location.city.name })
            : location.region.name}
      </figcaption>
    </figure>
  );
}
