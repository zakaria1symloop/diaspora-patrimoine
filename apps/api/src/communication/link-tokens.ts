// NOT-007, NOT-022, SFA-035, TRV-053 — opaque tokens of the links that must work without signing in: search alerts
// (confirm, extend, manage, stop) and e-mail preferences. Signed with LINK_SIGNING_KEY (HMAC-SHA256, 128 bits kept),
// they carry identifiers only — never an address or a name — and are written in lower-case hex, because site
// addresses are lower case (NAV-002 redirects any capital letter).
//
//   alert       a{purpose}{alertId:32}{expiresAt:8}{mac:32}       purpose: c confirm · x extend · m manage · s stop
//   preferences p{clientId:32}{group:2}{communicationId:32}{emailPrint:8}{mac:32}
//
// The management token of an alert is deterministic (no expiry): its SHA-256 is `SearchAlert.unsubscribeTokenHash`, so
// every later e-mail can carry it without it ever being stored readable (as CAF-030 does for the Café). A preferences
// token has no end (D-095) but dies when the address of the record changes (`emailPrint`) or the record is erased.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { CLIENT_PREFERENCE_GROUPS, type ClientPreferenceGroup } from '@dp/contracts';

export type AlertLinkPurpose = 'confirm' | 'extend' | 'manage' | 'stop';
const PURPOSE_CODE: Record<AlertLinkPurpose, string> = { confirm: 'c', extend: 'x', manage: 'm', stop: 's' };
const CODE_PURPOSE = Object.fromEntries(Object.entries(PURPOSE_CODE).map(([k, v]) => [v, k])) as Record<string, AlertLinkPurpose>;

const ALERT_RE = /^a([cxms])([0-9a-f]{32})([0-9a-f]{8})([0-9a-f]{32})$/;
const PREF_RE = /^p([0-9a-f]{32})([0-9a-f]{2})([0-9a-f]{32})([0-9a-f]{8})([0-9a-f]{32})$/;
const NO_COMMUNICATION = '0'.repeat(32);

const mac = (key: string, body: string) => createHmac('sha256', key).update(`dp_link:${body}`).digest('hex').slice(0, 32);
const hex = (uuid: string) => uuid.replace(/-/g, '').toLowerCase();
const uuid = (h: string) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
const sameMac = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const tokenSha256 = (token: string) => createHash('sha256').update(token).digest('hex');
/** First 8 hex characters of the SHA-256 of the lower-cased address: binds a preferences token to one address. */
export const emailPrint = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 8);

export function signAlertToken(key: string, purpose: AlertLinkPurpose, alertId: string, expiresAt: Date | null): string {
  const exp = expiresAt ? Math.floor(expiresAt.getTime() / 1000).toString(16).padStart(8, '0').slice(-8) : '00000000';
  const body = `a${PURPOSE_CODE[purpose]}${hex(alertId)}${exp}`;
  return body + mac(key, body);
}

/** The long-lived management token of an alert (SFA-035 « Gestion »). */
export const alertManageToken = (key: string, alertId: string) => signAlertToken(key, 'manage', alertId, null);

export type AlertTokenCheck =
  | { ok: true; purpose: AlertLinkPurpose; alertId: string }
  | { ok: false; reason: 'INVALID' | 'EXPIRED'; alertId?: string };

export function verifyAlertToken(key: string, token: string, now: Date): AlertTokenCheck {
  const m = ALERT_RE.exec(token);
  if (!m) return { ok: false, reason: 'INVALID' };
  const body = token.slice(0, -32);
  if (!sameMac(mac(key, body), m[4]!)) return { ok: false, reason: 'INVALID' };
  const alertId = uuid(m[2]!);
  const exp = parseInt(m[3]!, 16);
  if (exp !== 0 && exp * 1000 <= now.getTime()) return { ok: false, reason: 'EXPIRED', alertId };
  return { ok: true, purpose: CODE_PURPOSE[m[1]!]!, alertId };
}

export function signPreferencesToken(key: string, clientId: string, group: ClientPreferenceGroup, communicationId: string | null, email: string): string {
  const g = CLIENT_PREFERENCE_GROUPS.indexOf(group).toString(16).padStart(2, '0');
  const body = `p${hex(clientId)}${g}${communicationId ? hex(communicationId) : NO_COMMUNICATION}${emailPrint(email)}`;
  return body + mac(key, body);
}

export type PreferencesTokenCheck =
  | { ok: true; clientId: string; group: ClientPreferenceGroup; communicationId: string | null; emailPrint: string }
  | { ok: false };

export function verifyPreferencesToken(key: string, token: string): PreferencesTokenCheck {
  const m = PREF_RE.exec(token);
  if (!m) return { ok: false };
  if (!sameMac(mac(key, token.slice(0, -32)), m[5]!)) return { ok: false };
  const group = CLIENT_PREFERENCE_GROUPS[parseInt(m[2]!, 16)];
  if (!group) return { ok: false };
  return { ok: true, clientId: uuid(m[1]!), group, communicationId: m[3] === NO_COMMUNICATION ? null : uuid(m[3]!), emailPrint: m[4]! };
}

export const alertPagePath = (token: string) => `/alertes/${token}`;
export const alertStopPagePath = (token: string) => `/alertes/${token}/arreter`;
export const preferencesPagePath = (token: string) => `/preferences/${token}`;
/** NOT-022 — the one-click address of the `List-Unsubscribe` header (RFC 8058), through the site's own origin. */
export const unsubscribeApiPath = (token: string) => `/api/v1/public/unsubscribe/${token}`;
