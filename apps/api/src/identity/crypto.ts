// SEC-040, SEC-085 — primitives of the identity module: random tokens (256 bits), SHA-256 fingerprints stored instead
// of tokens, constant-time comparison, AES-256-GCM for the two-factor secret (MOD-016), keyed hashes.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** SEC-040 — an opaque token of 256 bits, base64url (43 characters). Shown once, never stored. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SEC-040 — the stored fingerprint of a token (`Char(64)`). */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacHex(key: string, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

export function hmacBase64url(key: string, value: string): string {
  return createHmac('sha256', key).update(value).digest('base64url');
}

/** Constant-time comparison of two strings (any length; different lengths compare as unequal without early exit). */
export function safeEqual(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y) && a.length === b.length;
}

/** AUTH-086 — a 6-digit code, uniformly drawn. */
export function sixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

// ─── AES-256-GCM (MOD-016, SEC-085) ─────────────────────────────────────────

export interface KeyRing {
  /** Key used to encrypt new values. */
  current: { id: string; key: Buffer };
  /** Every key able to decrypt (current and retired): renewal without loss. */
  all: Map<string, Buffer>;
}

/** `ENCRYPTION_KEY` (32 bytes, base64 or hex), `ENCRYPTION_KEY_ID`, optional `ENCRYPTION_KEYS_RETIRED` = "id:key,id:key". */
export function keyRingFrom(env: { ENCRYPTION_KEY: string; ENCRYPTION_KEY_ID: string; ENCRYPTION_KEYS_RETIRED?: string | undefined }): KeyRing {
  const decode = (raw: string): Buffer => {
    const b = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (b.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (base64 or hex)');
    return b;
  };
  const current = { id: env.ENCRYPTION_KEY_ID, key: decode(env.ENCRYPTION_KEY) };
  const all = new Map<string, Buffer>([[current.id, current.key]]);
  for (const pair of (env.ENCRYPTION_KEYS_RETIRED ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const at = pair.indexOf(':');
    if (at > 0) all.set(pair.slice(0, at), decode(pair.slice(at + 1)));
  }
  return { current, all };
}

/** `v1.{keyId}.{iv}.{tag}.{ciphertext}` (base64url parts): the key id travels with each value (SEC-085). */
export function encryptSecret(ring: KeyRing, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ring.current.key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', ring.current.id, iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptSecret(ring: KeyRing, sealed: string): string {
  const [v, keyId, iv, tag, data] = sealed.split('.');
  if (v !== 'v1' || !keyId || !iv || !tag || data === undefined) throw new Error('Unreadable secret');
  const key = ring.all.get(keyId);
  if (!key) throw new Error('Unknown key id');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
