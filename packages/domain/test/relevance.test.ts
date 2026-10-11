import { describe, expect, test } from 'vitest';
import { compareRelevance, freshness, relevanceScore, similarProperties, type SimilarCandidate } from '../src/index.js';

const NOW = new Date('2026-10-09T10:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe('CAL-080 relevance', () => {
  test('CAL-080 freshness: 1 up to 14 days, linear to 0 at 180 days', () => {
    expect(freshness(daysAgo(0), NOW)).toBe(1);
    expect(freshness(daysAgo(14), NOW)).toBe(1);
    expect(freshness(daysAgo(97), NOW)).toBeCloseTo(0.5, 10);
    expect(freshness(daysAgo(180), NOW)).toBe(0);
    expect(freshness(daysAgo(400), NOW)).toBe(0);
    expect(freshness(null, NOW)).toBe(0);
  });

  test('CAL-080 score = 40 availability + 25 freshness + 20 completeness + 15 financing', () => {
    expect(relevanceScore({ availability: 'AVAILABLE', firstPublishedAt: daysAgo(3), completenessScore: 100, financingEligible: true }, NOW)).toBe(100);
    expect(relevanceScore({ availability: 'RESERVED', firstPublishedAt: daysAgo(97), completenessScore: 85, financingEligible: false }, NOW)).toBe(42); // 12 + 12.5 + 17 = 41.5 → 42
    expect(relevanceScore({ availability: 'SOLD', firstPublishedAt: daysAgo(200), completenessScore: 60, financingEligible: true }, NOW)).toBe(27);
  });

  test('CAL-080 order: pinned first (featuredRank ascending), then score descending, then first publication descending', () => {
    const items = [
      { id: 'a', featuredRank: null, relevanceScore: 90, firstPublishedAt: daysAgo(10) },
      { id: 'b', featuredRank: 2, relevanceScore: 10, firstPublishedAt: daysAgo(10) },
      { id: 'c', featuredRank: 1, relevanceScore: 5, firstPublishedAt: daysAgo(10) },
      { id: 'd', featuredRank: null, relevanceScore: 90, firstPublishedAt: daysAgo(2) },
      { id: 'e', featuredRank: null, relevanceScore: 95, firstPublishedAt: daysAgo(50) },
    ];
    expect([...items].sort(compareRelevance).map((i) => i.id)).toEqual(['c', 'b', 'e', 'd', 'a']);
  });
});

describe('CAL-081 similar properties', () => {
  const T: SimilarCandidate = { id: 't', countryCode: 'DZ', regionId: 'ALG', type: 'APARTMENT', isPublished: true, availability: 'AVAILABLE', priceFromRef: '150000' };
  const c = (id: string, extra: Partial<SimilarCandidate>): SimilarCandidate => ({ ...T, id, ...extra });

  test('CAL-081 same country and type, published, AVAILABLE, ± 25 %; same region first, then price gap; three at most', () => {
    const list = [
      T,
      c('oran-close', { regionId: 'ORA', priceFromRef: '151000' }),
      c('alg-far', { priceFromRef: '185000' }),
      c('alg-near', { priceFromRef: '158000' }),
      c('alg-edge', { priceFromRef: '112500' }),
      c('too-expensive', { priceFromRef: '187501' }),
      c('villa', { type: 'VILLA', priceFromRef: '150000' }),
      c('reserved', { availability: 'RESERVED' }),
      c('ma', { countryCode: 'MA' }),
      c('draft', { isPublished: false }),
      c('no-price', { priceFromRef: null }),
    ];
    expect(similarProperties(T, list).map((p) => p.id)).toEqual(['alg-near', 'alg-far', 'alg-edge']);
  });

  test('CAL-081 fewer than two: widened to ± 40 %, all types, same country', () => {
    const list = [c('one', { priceFromRef: '160000' }), c('villa', { type: 'VILLA', regionId: 'ORA', priceFromRef: '205000' }), c('far', { priceFromRef: '211000' })];
    expect(similarProperties(T, list).map((p) => p.id)).toEqual(['one', 'villa']);
  });

  test('CAL-081 still fewer than two: section hidden (empty list)', () => {
    expect(similarProperties(T, [c('one', { priceFromRef: '160000' })])).toEqual([]);
    expect(similarProperties({ ...T, priceFromRef: null }, [c('a', {}), c('b', {})])).toEqual([]);
  });
});
