// DEM-024 — a second identical request: same e-mail, same kind, same object (same property, or same program, or none),
// less than 24 hours after the first, the first not closed. No new request: what differs is kept as a supplement.
import { canonicalJson } from '../platform/tx.js';

export const DUPLICATE_WINDOW_MS = 24 * 3600_000;

export interface LeadObject {
  propertyId: string | null;
  programId: string | null;
}

/** « même objet (même bien, ou même programme, ou aucun) ». */
export function sameObject(a: LeadObject, b: LeadObject): boolean {
  if (a.propertyId || b.propertyId) return a.propertyId === b.propertyId;
  return (a.programId ?? null) === (b.programId ?? null);
}

export interface EarlierLead extends LeadObject {
  kind: string;
  email: string | null;
  status: string;
  createdAt: Date;
}

/** « première non clôturée »: NEW or IN_PROGRESS — a closed request, or one classed as spam, is never supplemented. */
export function isDuplicateOf(
  earlier: EarlierLead,
  next: LeadObject & { kind: string; email: string },
  now: Date,
): boolean {
  return (
    earlier.kind === next.kind &&
    (earlier.email ?? '').toLowerCase() === next.email.toLowerCase() &&
    (earlier.status === 'NEW' || earlier.status === 'IN_PROGRESS') &&
    now.getTime() - earlier.createdAt.getTime() < DUPLICATE_WINDOW_MS &&
    sameObject(earlier, next)
  );
}

/** Keys never compared: proof of consent and technical flags carry no new information for the advisor. */
const IGNORED = new Set(['consentContact', 'consentKey', 'marketingKey']);

/**
 * « Tout ce que ce second envoi dit de différent » — the fields of `next` whose value differs from `previous`
 * (absent in `next` = not said: not a difference). Values as sent.
 */
export function changedFields(previous: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (IGNORED.has(key) || value === undefined || value === null || value === '') continue;
    if (canonicalJson(previous[key] ?? null) !== canonicalJson(value)) out[key] = value;
  }
  return out;
}

export interface Supplement {
  receivedAt: string;
  fields: Record<string, unknown>;
  message: string | null;
  /** DEM-027 — the second screen of a projection, when the supplement is completed. */
  step2?: { receivedAt: string; fields: Record<string, unknown> } | null;
}

/** `Lead.supplements` entry: date, differing fields, message (only when it differs from the first one). */
export function buildSupplement(
  previousFields: Record<string, unknown>,
  previousMessage: string | null,
  nextFields: Record<string, unknown>,
  now: Date,
  withStep2: boolean,
): Supplement {
  const { message, ...rest } = nextFields as { message?: string };
  const fields = changedFields(previousFields, rest);
  const msg = message && message !== previousMessage ? message : null;
  return { receivedAt: now.toISOString(), fields, message: msg, ...(withStep2 ? { step2: null } : {}) };
}
