import { describe, expect, it } from 'vitest';
import { isDisposableDomain } from '../src/leads/disposable-domains.js';
import {
  checkMx,
  countLinks,
  isAllCaps,
  phoneCountryMismatch,
  spamScore,
  spamSignals,
  spamVerdict,
  type SpamFacts,
} from '../src/leads/spam.js';

const clean: SpamFacts = {
  honeypotFilled: false,
  elapsedMs: 20_000,
  message: 'Bonjour, je souhaite des informations sur ce bien.',
  email: 'yacine@gmail.com',
  recentFromIp: 0,
  duplicateMessage: false,
  mx: 'OK',
  phone: '+33612345678',
  countryOfResidence: 'FR',
};

const codes = (f: Partial<SpamFacts>) => spamSignals({ ...clean, ...f }).map((s) => s.code);

describe('spam score', () => {
  it('DEM-031 a normal request has no signal and scores 0', () => {
    expect(spamSignals(clean)).toEqual([]);
    expect(spamVerdict([], 70)).toBe('NORMAL');
  });

  it('DEM-031 each signal carries its points', () => {
    expect(spamSignals({ ...clean, honeypotFilled: true })).toEqual([{ code: 'HONEYPOT', points: 100 }]);
    expect(codes({ elapsedMs: 2_999 })).toEqual(['FAST_SUBMIT']);
    expect(codes({ elapsedMs: 3_000 })).toEqual([]);
    expect(codes({ message: 'voir https://a.x https://b.x www.c.x' })).toEqual(['MANY_LINKS']);
    expect(codes({ message: 'voir https://a.x et https://b.x' })).toEqual([]);
    expect(codes({ email: 'x@yopmail.com' })).toEqual(['DISPOSABLE_DOMAIN']);
    expect(codes({ recentFromIp: 3 })).toEqual(['IP_BURST']);
    expect(codes({ recentFromIp: 2 })).toEqual([]);
    expect(codes({ duplicateMessage: true })).toEqual(['DUPLICATE_MESSAGE']);
    expect(codes({ mx: 'NONE' })).toEqual(['NO_MX']);
    expect(codes({ mx: 'UNKNOWN' })).toEqual([]);
    expect(codes({ phone: '+213550123456', countryOfResidence: 'FR' })).toEqual(['PHONE_COUNTRY_MISMATCH']);
    expect(codes({ message: 'JE VEUX ACHETER UN APPARTEMENT' })).toEqual(['ALL_CAPS']);
  });

  it('DEM-031 the score is the sum, capped at 100', () => {
    const all = spamSignals({ ...clean, honeypotFilled: true, elapsedMs: 10, mx: 'NONE', email: 'x@yopmail.com' });
    expect(spamScore(all)).toBe(100);
    expect(spamScore([{ code: 'FAST_SUBMIT', points: 35 }, { code: 'NO_MX', points: 20 }])).toBe(55);
  });

  it('DEM-031 no ordinary signal alone, nor two, reaches the threshold: the two heaviest make 65', () => {
    const two = spamSignals({ ...clean, elapsedMs: 100, email: 'x@yopmail.com' });
    expect(spamScore(two)).toBe(65);
    expect(spamVerdict(two, 70)).toBe('CHALLENGE');
    const three = spamSignals({ ...clean, elapsedMs: 100, email: 'x@yopmail.com', duplicateMessage: true });
    expect(spamVerdict(three, 70)).toBe('SPAM_REVIEW');
  });

  it('DEM-031 verdicts: honeypot → SPAM, ≥ threshold → SPAM_REVIEW, 40 to threshold → CHALLENGE, below 40 → NORMAL', () => {
    expect(spamVerdict([{ code: 'HONEYPOT', points: 100 }], 70)).toBe('SPAM');
    expect(spamVerdict([{ code: 'FAST_SUBMIT', points: 35 }, { code: 'IP_BURST', points: 20 }, { code: 'NO_MX', points: 20 }], 70)).toBe('SPAM_REVIEW');
    expect(spamVerdict([{ code: 'FAST_SUBMIT', points: 35 }, { code: 'ALL_CAPS', points: 10 }], 70)).toBe('CHALLENGE');
    expect(spamVerdict([{ code: 'FAST_SUBMIT', points: 35 }], 70)).toBe('NORMAL');
    // `leads.spamThreshold` is a setting.
    expect(spamVerdict([{ code: 'FAST_SUBMIT', points: 35 }, { code: 'ALL_CAPS', points: 10 }], 45)).toBe('SPAM_REVIEW');
  });

  it('DEM-031 helpers: links, capitals, phone country, disposable sub-domains', () => {
    expect(countLinks('https://a.fr http://b.fr www.c.fr')).toBe(3);
    expect(isAllCaps('OK MERCI')).toBe(false); // too short to judge
    expect(isAllCaps('Bonjour MADAME')).toBe(false);
    expect(phoneCountryMismatch('+15145550123', 'CA')).toBe(false);
    expect(phoneCountryMismatch('+15145550123', 'US')).toBe(false); // same calling code
    expect(phoneCountryMismatch(null, 'FR')).toBe(false);
    expect(isDisposableDomain('mail.yopmail.com')).toBe(true);
    expect(isDisposableDomain('gmail.com')).toBe(false);
  });

  it('TRV-043 MX lookup: no record → NONE, records → OK, no answer within the delay → UNKNOWN (0 point)', async () => {
    expect(await checkMx('a.fr', 50, async () => [{ exchange: 'mx.a.fr' }])).toBe('OK');
    expect(await checkMx('a.fr', 50, async () => [])).toBe('NONE');
    expect(await checkMx('a.fr', 50, () => Promise.reject(Object.assign(new Error('x'), { code: 'ENOTFOUND' })))).toBe('NONE');
    expect(await checkMx('a.fr', 50, () => Promise.reject(Object.assign(new Error('x'), { code: 'ESERVFAIL' })))).toBe('UNKNOWN');
    expect(await checkMx('a.fr', 20, () => new Promise((r) => setTimeout(() => r([{ exchange: 'mx' }]), 200)))).toBe('UNKNOWN');
  });
});
