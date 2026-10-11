'use client';
// Browser calls of the public routes without a form token (alerts, preferences, links with a token). TRV-091: a key
// per opened action, kept on a network cut or a 5xx (an arrived request is not doubled), freed by a refusal.
// TRV-110: the screen shows a sentence chosen from the error code, never a raw message.
import { isApiErrorBody, type ApiErrorBody } from '@dp/contracts';
import { hasMessage } from '@dp/i18n';
import { t } from './i18n';
import { newUuid } from '@dp/ui';

export type CallResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiErrorBody['error'] | null; offline?: boolean };

export async function publicCall<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, idempotencyKey?: string): Promise<CallResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/public${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, error: null, offline: true };
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (res.ok) return { ok: true, status: res.status, data: json as T };
  return { ok: false, status: res.status, error: isApiErrorBody(json) ? json.error : null };
}

/** The sentence of an error (reason first, then code); offline: TRV-082's sentence. */
export function errorText(r: Extract<CallResult<unknown>, { ok: false }>): string {
  if (r.offline) return t('ui.common.offline');
  const e = r.error;
  if (e?.reason) {
    const key = `ui.error.reason.${e.reason}`;
    if (hasMessage(key)) return t(key, (e.params ?? undefined) as never);
  }
  if (e?.code) {
    const key = `ui.error.${e.code}`;
    if (hasMessage(key)) return t(key, (e.params ?? undefined) as never);
  }
  return t('ui.error.INTERNAL_ERROR', { identifiant: e?.requestId ?? '—' });
}

export function newIdempotencyKey(): string {
  return newUuid();
}
