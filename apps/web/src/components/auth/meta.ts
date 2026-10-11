// The account pages are never indexed (03-espace-client/01: « ne sont pas indexées »).
import type { Metadata } from 'next';
import { isSafeNextPath } from '@dp/contracts';

export function authMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}

/** AUTH-023 — `?suite=` (or `?next=`): an internal path only; anything else is ignored. */
export function nextParam(sp: Record<string, string | string[] | undefined>): string | null {
  const raw = sp.suite ?? sp.next;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return isSafeNextPath(v) ? v : null;
}

/** SIM-032 — `?simulation={id}` from « Enregistrer » on a simulator. */
export function simulationParam(sp: Record<string, string | string[] | undefined>): string | null {
  const raw = sp.simulation;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v.toLowerCase() : null;
}
