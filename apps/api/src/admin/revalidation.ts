// ARC-040, NAV-042 — after a committed write, the API tells the web app which cache tags changed:
// POST {WEB_URL}/api/revalidate, body {tags}, header `X-Signature: sha256=<hex HMAC of the raw body>` (REVALIDATE_SECRET).
// A failure is only logged for now; the outbox will replay it (FIA-040) once the `web.revalidate` handler exists.
import { createHmac } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { log } from '../platform/request-context.js';

export function signRevalidateBody(secret: string, raw: string): string {
  return `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
}

export interface RevalidationTarget {
  revalidate(tags: string[]): Promise<boolean>;
}

@Injectable()
export class WebRevalidator implements RevalidationTarget {
  constructor(@Inject(ENV) private readonly env: Pick<Env, 'WEB_URL' | 'REVALIDATE_SECRET'>) {}

  async revalidate(tags: string[]): Promise<boolean> {
    const unique = [...new Set(tags)].slice(0, 200);
    if (!unique.length) return true;
    const raw = JSON.stringify({ tags: unique });
    try {
      const res = await fetch(`${this.env.WEB_URL.replace(/\/$/, '')}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Signature': signRevalidateBody(this.env.REVALIDATE_SECRET, raw) },
        body: raw,
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        log('warn', 'web.revalidate_failed', { status: res.status, tags: unique.length });
        return false;
      }
      return true;
    } catch (err) {
      log('warn', 'web.revalidate_failed', { error: err instanceof Error ? err.name : 'unknown', tags: unique.length });
      return false;
    }
  }
}

/** What every committed catalogue or Café write does next (ARC-075 in-memory index, ARC-040 web tags). */
@Injectable()
export class ChangeNotifier {
  constructor(
    private readonly web: WebRevalidator,
    @Optional() private readonly index?: CatalogueIndex,
  ) {}

  async committed(tags: string[]): Promise<void> {
    if (tags.some((t) => t === 'catalogue' || t.startsWith('property:') || t.startsWith('program:'))) this.index?.invalidate();
    await this.web.revalidate(tags);
  }
}
