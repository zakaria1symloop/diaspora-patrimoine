// CAT-090 — markers close to one another on screen gather into one numbered badge. Pure and small: the catalogue has
// one marker per programme, a few hundred at most, so a greedy pass on screen coordinates is enough.

export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
  /** Properties carried by the marker. */
  count: number;
}

export interface ScreenCluster {
  /** The ids of the gathered markers (one id: a plain marker). */
  ids: string[];
  x: number;
  y: number;
  count: number;
}

/** Greedy clustering: the biggest markers first, each absorbing the free ones within `radius` pixels. */
export function clusterPoints(points: ScreenPoint[], radius: number): ScreenCluster[] {
  const order = [...points].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  const taken = new Set<string>();
  const out: ScreenCluster[] = [];
  const r2 = radius * radius;
  for (const p of order) {
    if (taken.has(p.id)) continue;
    taken.add(p.id);
    const members = [p];
    for (const q of order) {
      if (taken.has(q.id)) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      if (dx * dx + dy * dy <= r2) {
        taken.add(q.id);
        members.push(q);
      }
    }
    const count = members.reduce((n, m) => n + m.count, 0);
    out.push({
      ids: members.map((m) => m.id),
      // Weighted centre: the badge sits where most properties are.
      x: members.reduce((n, m) => n + m.x * m.count, 0) / count,
      y: members.reduce((n, m) => n + m.y * m.count, 0) / count,
      count,
    });
  }
  return out;
}

/** FIC-060 — a circle of `radiusM` metres around a point, as a closed GeoJSON ring (64 segments). */
/**
 * The compact credits of the map open by themselves when the map is created and cover a third of a phone-wide map:
 * fold them behind their « i » button (they stay one tap away, as the licence asks).
 */
export function foldAttribution(container: HTMLElement | null): void {
  const el = container?.querySelector('.maplibregl-ctrl-attrib');
  el?.classList.remove('maplibregl-compact-show');
  el?.removeAttribute('open');
}

export function circleRing(lng: number, lat: number, radiusM: number, steps = 64): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}
