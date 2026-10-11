// ARC-073 — every request carries an id, repeated in its logs and returned on errors (TRV-111).
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentRequestId(): string {
  return requestContext.getStore()?.requestId ?? 'req_none';
}

function newRequestId(): string {
  return `req_${Date.now().toString(36)}${randomBytes(6).toString('hex')}`;
}

/** Replaces tokens in paths before they are logged (ARC-073, SEC-040). */
export function maskPath(path: string): string {
  return path
    .replace(/\/(activation|partage|preferences|alertes|enquete|inscription|registrations|shares|alerts|surveys|unsubscribe)\/[^/?]+/gi, '/$1/{jeton}')
    .replace(/([?&](token|jeton|preview)=)[^&]+/gi, '$1{jeton}');
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = newRequestId();
  res.setHeader('X-Request-Id', requestId);
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    log('info', 'http', {
      requestId,
      method: req.method,
      path: maskPath(req.originalUrl),
      status: res.statusCode,
      ms: Math.round(ms),
    });
  });
  requestContext.run({ requestId }, () => next());
}

/** Structured JSON log line, without personal data (ARC-073). */
export function log(level: 'debug' | 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, requestId: currentRequestId(), ...data });
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}
