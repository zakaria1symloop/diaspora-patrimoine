// « Pertinence » sort of the catalogue (CAL-080) and similar properties (CAL-081).
import { dec, type DecimalInput } from './money.js';
import type { PropertyType } from './completeness.js';

export type Availability = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN';

export interface RelevanceInput {
  availability: Availability;
  /** `firstPublishedAt`: a republication does not make a property younger. */
  firstPublishedAt: Date | null;
  /** CAL-050, 0–100. */
  completenessScore: number;
  financingEligible: boolean;
}

const DAY_MS = 86_400_000;

/** CAL-080 — freshness: 1 up to 14 days after the first publication, then linear decrease to 0 at 180 days. */
export function freshness(firstPublishedAt: Date | null, now: Date): number {
  if (firstPublishedAt === null) return 0;
  const days = (now.getTime() - firstPublishedAt.getTime()) / DAY_MS;
  if (days <= 14) return 1;
  if (days >= 180) return 0;
  return (180 - days) / (180 - 14);
}

/**
 * CAL-080 — `Property.relevanceScore` (integer 0–100, rounded half up):
 * 40 × availability (AVAILABLE 1 · RESERVED 0.3 · otherwise 0) + 25 × freshness + 20 × completeness ÷ 100
 * + 15 × financing (1 if `financingEligible`).
 */
export function relevanceScore(p: RelevanceInput, now: Date): number {
  const availability = p.availability === 'AVAILABLE' ? 1 : p.availability === 'RESERVED' ? 0.3 : 0;
  const raw = 40 * availability + 25 * freshness(p.firstPublishedAt, now) + (20 * p.completenessScore) / 100 + (p.financingEligible ? 15 : 0);
  return Math.min(100, Math.max(0, Math.floor(raw + 0.5 + 1e-9)));
}

/**
 * CAL-080 — order of the « Pertinence » sort: pinned properties first (`featuredRank` ascending), then
 * `relevanceScore` descending, then first publication date descending. Usable with `Array.prototype.sort`.
 */
export function compareRelevance(
  a: { featuredRank: number | null; relevanceScore: number; firstPublishedAt: Date | null },
  b: { featuredRank: number | null; relevanceScore: number; firstPublishedAt: Date | null },
): number {
  if (a.featuredRank !== null || b.featuredRank !== null) {
    if (a.featuredRank === null) return 1;
    if (b.featuredRank === null) return -1;
    if (a.featuredRank !== b.featuredRank) return a.featuredRank - b.featuredRank;
  }
  if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;
  return (b.firstPublishedAt?.getTime() ?? 0) - (a.firstPublishedAt?.getTime() ?? 0);
}

export interface SimilarCandidate {
  id: string;
  countryCode: string;
  regionId: string | null;
  type: PropertyType;
  isPublished: boolean;
  availability: Availability;
  priceFromRef: DecimalInput | null;
}

function pick<T extends SimilarCandidate>(target: SimilarCandidate, candidates: readonly T[], tolerance: string, sameType: boolean): T[] {
  if (target.priceFromRef === null) return [];
  const p0 = dec(target.priceFromRef);
  const max = p0.mul(tolerance);
  return candidates
    .filter(
      (c) =>
        c.id !== target.id &&
        c.countryCode === target.countryCode &&
        (!sameType || c.type === target.type) &&
        c.isPublished &&
        c.availability === 'AVAILABLE' &&
        c.priceFromRef !== null &&
        dec(c.priceFromRef).sub(p0).abs().lte(max),
    )
    .map((c) => ({ c, sameRegion: target.regionId !== null && c.regionId === target.regionId, gap: dec(c.priceFromRef!).sub(p0).abs() }))
    .sort((x, y) => Number(y.sameRegion) - Number(x.sameRegion) || x.gap.cmp(y.gap))
    .slice(0, 3)
    .map((x) => x.c);
}

/**
 * CAL-081 — similar properties: same country, same type, published, `AVAILABLE`, `priceFromRef` within ± 25 %, not the
 * property itself; same region first, then increasing price gap; three at most. Fewer than two: widened to ± 40 %, all
 * types (same country). Still fewer than two: `[]` — the section is hidden.
 */
export function similarProperties<T extends SimilarCandidate>(target: SimilarCandidate, candidates: readonly T[]): T[] {
  const narrow = pick(target, candidates, '0.25', true);
  if (narrow.length >= 2) return narrow;
  const wide = pick(target, candidates, '0.40', false);
  return wide.length >= 2 ? wide : [];
}
