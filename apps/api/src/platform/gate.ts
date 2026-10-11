// NAV-064 — one gate before opening and in acceptance, driven by SITE_GATE_PASSWORD.
// Cookie `dp_gate` = "{expiresAtMs}.{hmac}" signed with the password itself: changing the password
// closes every open device; the web app verifies it the same way (no extra shared secret).
import { createHmac, timingSafeEqual } from 'node:crypto';

export const GATE_COOKIE_DAYS = 30;

export function signGate(password: string, expiresAtMs: number): string {
  const mac = createHmac('sha256', password).update(`dp_gate:${expiresAtMs}`).digest('base64url');
  return `${expiresAtMs}.${mac}`;
}

export function verifyGate(password: string, value: string | undefined, nowMs: number): boolean {
  if (!value) return false;
  const [exp, mac] = value.split('.');
  const expiresAt = Number(exp);
  if (!mac || !Number.isFinite(expiresAt) || expiresAt < nowMs) return false;
  const expected = signGate(password, expiresAt).split('.')[1]!;
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function passwordMatches(password: string, attempt: string): boolean {
  const a = createHmac('sha256', 'dp_gate_cmp').update(password).digest();
  const b = createHmac('sha256', 'dp_gate_cmp').update(attempt).digest();
  return timingSafeEqual(a, b);
}
