// DEM-031 — spam score (0–100, capped sum of the retained signals) and what happens next. Pure, except `checkMx`
// (DNS, 500 ms at most, TRV-043). The signals are stored with the request and never recomputed (`Lead.spamSignals`).
import { promises as dns } from 'node:dns';
import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import type { SpamSignal } from '@dp/contracts';
import { isDisposableDomain } from './disposable-domains.js';

export const SPAM_POINTS: Readonly<Record<SpamSignal, number>> = {
  HONEYPOT: 100,
  FAST_SUBMIT: 35,
  MANY_LINKS: 30,
  DISPOSABLE_DOMAIN: 30,
  IP_BURST: 20,
  DUPLICATE_MESSAGE: 30,
  NO_MX: 20,
  PHONE_COUNTRY_MISMATCH: 10,
  ALL_CAPS: 10,
};

/** DEM-030 point 2 — submitted less than 3 seconds after the form was displayed. */
export const FAST_SUBMIT_MS = 3_000;
/** DEM-031 — more than three requests from the same IP in 10 minutes. */
export const IP_BURST_WINDOW_MS = 600_000;
export const IP_BURST_MAX_PREVIOUS = 3;
/** DEM-030 point 4 — challenge zone: from 40 up to the threshold (excluded). */
export const CHALLENGE_FROM = 40;

export type MxStatus = 'OK' | 'NONE' | 'UNKNOWN';

export interface SpamFacts {
  honeypotFilled: boolean;
  /** Milliseconds between the form display (token) and the submission; null when unknown. */
  elapsedMs: number | null;
  message?: string | null;
  email: string;
  /** Requests already received from this IP in the last 10 minutes. */
  recentFromIp: number;
  /** The same message was received from another address in the last 24 hours. */
  duplicateMessage: boolean;
  mx: MxStatus;
  phone?: string | null;
  countryOfResidence?: string | null;
}

export interface SpamSignalHit {
  code: SpamSignal;
  points: number;
}

/** « Plus de deux liens dans le message » — URLs and bare www. addresses. */
export function countLinks(message: string): number {
  return (message.match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) ?? []).length;
}

/** « Message entièrement en capitales » — at least 8 letters, none in lower case. */
export function isAllCaps(message: string): boolean {
  const letters = message.match(/\p{L}/gu) ?? [];
  if (letters.length < 8) return false;
  const cased = letters.filter((l) => l.toLowerCase() !== l.toUpperCase());
  return cased.length >= 8 && cased.every((l) => l === l.toUpperCase());
}

/** « Indicatif du téléphone sans rapport avec le pays de résidence » — calling codes compared (+1 covers US and CA). */
export function phoneCountryMismatch(phone: string | null | undefined, country: string | null | undefined): boolean {
  if (!phone || !country) return false;
  const parsed = parsePhoneNumberFromString(phone);
  if (!parsed) return false;
  let expected: string;
  try {
    expected = getCountryCallingCode(country as CountryCode);
  } catch {
    return false; // Unknown country for the library: no signal.
  }
  return parsed.countryCallingCode !== expected;
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

export function spamSignals(f: SpamFacts): SpamSignalHit[] {
  const hits: SpamSignal[] = [];
  if (f.honeypotFilled) hits.push('HONEYPOT');
  if (f.elapsedMs !== null && f.elapsedMs < FAST_SUBMIT_MS) hits.push('FAST_SUBMIT');
  const message = f.message ?? '';
  if (message && countLinks(message) > 2) hits.push('MANY_LINKS');
  if (isDisposableDomain(emailDomain(f.email))) hits.push('DISPOSABLE_DOMAIN');
  // « Plus de trois demandes en 10 minutes »: this one is at least the fourth.
  if (f.recentFromIp >= IP_BURST_MAX_PREVIOUS) hits.push('IP_BURST');
  if (message && f.duplicateMessage) hits.push('DUPLICATE_MESSAGE');
  if (f.mx === 'NONE') hits.push('NO_MX');
  if (phoneCountryMismatch(f.phone, f.countryOfResidence)) hits.push('PHONE_COUNTRY_MISMATCH');
  if (message && isAllCaps(message)) hits.push('ALL_CAPS');
  return hits.map((code) => ({ code, points: SPAM_POINTS[code] }));
}

export function spamScore(signals: readonly SpamSignalHit[]): number {
  return Math.min(100, signals.reduce((s, h) => s + h.points, 0));
}

/**
 * DEM-031 table — `SPAM` (honeypot: created directly as spam, nothing else) · `SPAM_REVIEW` (≥ threshold: same, with
 * `needsReview`) · `CHALLENGE` (40 to the threshold: challenge when a service is configured, then normal + review) ·
 * `NORMAL`.
 */
export type SpamVerdict = 'SPAM' | 'SPAM_REVIEW' | 'CHALLENGE' | 'NORMAL';

export function spamVerdict(signals: readonly SpamSignalHit[], threshold: number): SpamVerdict {
  if (signals.some((s) => s.code === 'HONEYPOT')) return 'SPAM';
  const score = spamScore(signals);
  if (score >= threshold) return 'SPAM_REVIEW';
  if (score >= CHALLENGE_FROM) return 'CHALLENGE';
  return 'NORMAL';
}

type MxResolver = (domain: string) => Promise<{ exchange: string }[]>;

/**
 * TRV-043 — MX lookup within `timeoutMs` (500 ms during the submission). `NONE`: the domain answers without mail server
 * (or does not exist). `UNKNOWN`: no answer in time, or a resolver failure — 0 point, re-checked in the background.
 */
export async function checkMx(domain: string, timeoutMs = 500, resolve: MxResolver = (d) => dns.resolveMx(d)): Promise<MxStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<MxStatus>((r) => {
    timer = setTimeout(() => r('UNKNOWN'), timeoutMs);
  });
  const lookup = resolve(domain).then(
    (records): MxStatus => (records.some((r) => r.exchange && r.exchange !== '.') ? 'OK' : 'NONE'),
    (err: { code?: string }): MxStatus => (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA' ? 'NONE' : 'UNKNOWN'),
  );
  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
