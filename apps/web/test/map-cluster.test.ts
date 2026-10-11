// CAT-090 — markers close on screen gather into one badge; FIC-060 — the 600 m circle.
import { describe, expect, it } from 'vitest';
import { circleRing, clusterPoints } from '../../../packages/ui/src/map/cluster';

describe('clusterPoints', () => {
  it('gathers markers within the radius, keeps the far ones apart, sums the counts', () => {
    const out = clusterPoints(
      [
        { id: 'a', x: 100, y: 100, count: 3 },
        { id: 'b', x: 120, y: 110, count: 1 },
        { id: 'c', x: 400, y: 300, count: 1 },
      ],
      44,
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ ids: ['a', 'b'], count: 4 });
    expect(out[1]).toMatchObject({ ids: ['c'], count: 1 });
  });
});

describe('circleRing', () => {
  it('is closed and about 600 m from the centre', () => {
    const ring = circleRing(3, 36.75, 600);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const [lng] = ring[0]!;
    expect(Math.round((lng - 3) * 111_320 * Math.cos((36.75 * Math.PI) / 180))).toBe(600);
  });
});
