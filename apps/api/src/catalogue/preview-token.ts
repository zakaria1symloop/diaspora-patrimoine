// FIC-120 — « Aperçu » of a property or a programme that is not online: a link signed for ONE hour, naming the object
// (its kind and id) — never a name or personal data. The public detail accepts it and answers the page as it would be
// published, marked `preview` (the page then shows its band, is not indexed, counts no view, accepts no request).
import { createHmac, timingSafeEqual } from 'node:crypto';

export const PREVIEW_TTL_MS = 60 * 60_000;
type Kind = 'PROPERTY' | 'PROGRAM';

function mac(key: string, body: string): string {
  return createHmac('sha256', key).update(`dp_listing_preview:${body}`).digest('base64url');
}

/** `{expiry base36}.{mac}` — the id and the kind are bound by the signature, not carried. */
export function signPreview(key: string, kind: Kind, id: string, now: Date): { token: string; expiresAt: Date } {
  const expiresAt = new Date(now.getTime() + PREVIEW_TTL_MS);
  const exp = Math.floor(expiresAt.getTime() / 1000).toString(36);
  return { token: `${exp}.${mac(key, `${kind}:${id}:${exp}`)}`, expiresAt };
}

export function verifyPreview(key: string, kind: Kind, id: string, token: string | undefined, now: Date): boolean {
  if (!token || !/^[0-9a-z]{1,12}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [exp, sig] = token.split('.') as [string, string];
  if (parseInt(exp, 36) * 1000 <= now.getTime()) return false;
  const expected = mac(key, `${kind}:${id}:${exp}`);
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
