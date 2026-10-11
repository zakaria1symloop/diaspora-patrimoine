'use client';
// NAV-053 — origin of the visit: on arrival, the utm_* parameters, the referring DOMAIN and the first page seen are kept
// in session storage, and joined to any request sent during the session (Lead.utm, referrer, landingPath).
// Nothing is kept beyond the session nor sent without a request.
import type { LeadTracking } from '@dp/contracts';
import { browserTimeZone } from './callback';

const KEY = 'dp_origin';

export function recordOrigin(): void {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const url = new URL(window.location.href);
    const utm: Record<string, string> = {};
    for (const k of ['source', 'medium', 'campaign', 'term', 'content']) {
      const v = url.searchParams.get(`utm_${k}`);
      if (v) utm[k] = v.slice(0, 200);
    }
    let referrer: string | undefined;
    try {
      const r = document.referrer ? new URL(document.referrer) : null;
      if (r && r.host !== url.host) referrer = r.host;
    } catch {
      /* invalid referrer */
    }
    sessionStorage.setItem(KEY, JSON.stringify({ utm: Object.keys(utm).length ? utm : undefined, referrer, landingPath: url.pathname }));
  } catch {
    /* storage unavailable */
  }
}

export function trackingPayload(): LeadTracking {
  let origin: { utm?: Record<string, string>; referrer?: string; landingPath?: string } = {};
  try {
    origin = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
  } catch {
    /* storage unavailable */
  }
  return {
    locale: 'fr',
    callerTimezone: browserTimeZone(),
    landingPath: origin.landingPath,
    submittedFromPath: window.location.pathname,
    referrer: origin.referrer,
    utm: origin.utm,
  } as LeadTracking;
}
