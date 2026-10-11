// NAV-064 — same signature as the API (platform/gate.ts): HMAC-SHA256 keyed by SITE_GATE_PASSWORD.
// Web Crypto so it also runs in the proxy.
const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mac(password: string, expiresAtMs: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(`dp_gate:${expiresAtMs}`)));
}

export async function signGate(password: string, expiresAtMs: number): Promise<string> {
  return `${expiresAtMs}.${await mac(password, expiresAtMs)}`;
}

export async function verifyGate(password: string, value: string | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!value) return false;
  const [exp, given] = value.split('.');
  const expiresAt = Number(exp);
  if (!given || !Number.isFinite(expiresAt) || expiresAt < nowMs) return false;
  const expected = await mac(password, expiresAt);
  if (expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
