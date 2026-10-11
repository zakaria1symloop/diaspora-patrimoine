'use client';
// Public form plumbing shared by every form of the site:
// TRV-091 idempotency key — generated at opening; a refusal by the server (4xx) frees it (new key), a network cut or
// a 5xx keeps it (an already-arrived submission is not doubled); TRV-092 draft kept in session storage until success
// (never passwords); DEM-030 signed form token (`POST /public/form-token` → header X-Form-Token, renewed once if expired).
import { useCallback, useEffect, useRef, useState } from 'react';
import { isApiErrorBody, type ApiErrorBody } from '@dp/contracts';
import { newUuid } from '@dp/ui';

export type SubmitResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiErrorBody['error'] | null; offline?: boolean; retryAfter?: number };

function newKey(): string {
  return newUuid();
}

/** TRV-092 — keeps a form's values in session storage; `clear()` after a successful submission. */
export function useDraft<T extends object>(key: string, initial: T): [T, (patch: Partial<T>) => void, () => void] {
  const [values, setValues] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`dp_form_${key}`);
      if (saved) setValues((v) => ({ ...v, ...(JSON.parse(saved) as Partial<T>) }));
    } catch {
      /* storage unavailable */
    }
    loaded.current = true;
  }, [key]);
  const update = useCallback(
    (patch: Partial<T>) =>
      setValues((v) => {
        const next = { ...v, ...patch };
        if (loaded.current) {
          try {
            sessionStorage.setItem(`dp_form_${key}`, JSON.stringify(next));
          } catch {
            /* storage unavailable */
          }
        }
        return next;
      }),
    [key],
  );
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(`dp_form_${key}`);
    } catch {
      /* storage unavailable */
    }
  }, [key]);
  return [values, update, clear];
}

async function formToken(form: string): Promise<string | null> {
  try {
    const res = await fetch('/api/v1/public/form-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ form }),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { token: string }).token;
  } catch {
    return null;
  }
}

/** One instance per opened form. */
export function usePublicForm(form: string, options: { headers?: Record<string, string> } = {}) {
  const extraHeaders = useRef(options.headers);
  const key = useRef<string>('');
  const token = useRef<Promise<string | null> | null>(null);
  if (!key.current) key.current = typeof crypto !== 'undefined' ? newKey() : '';

  useEffect(() => {
    token.current = formToken(form);
  }, [form]);

  const submit = useCallback(
    async <T,>(url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST'): Promise<SubmitResult<T>> => {
      if (!key.current) key.current = newKey();
      const send = async (tok: string | null) =>
        fetch(url, {
          method,
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            'Idempotency-Key': key.current,
            ...(tok ? { 'X-Form-Token': tok } : {}),
            ...(extraHeaders.current ?? {}),
          },
          body: JSON.stringify(body),
        });
      let res: Response;
      try {
        res = await send(await (token.current ?? Promise.resolve(null)));
        // DEM-040 — expired form token (410): ask for a new one silently and replay once.
        if (res.status === 410 && !url.endsWith('/complete')) {
          token.current = formToken(form);
          res = await send(await token.current);
        }
      } catch {
        return { ok: false, status: 0, error: null, offline: true };
      }
      const text = await res.text();
      const json = text ? (JSON.parse(text) as unknown) : null;
      if (res.ok) return { ok: true, status: res.status, data: json as T };
      // A refusal frees the key; a 5xx keeps it (TRV-091).
      if (res.status < 500 && res.status !== 409) key.current = newKey();
      return {
        ok: false,
        status: res.status,
        error: isApiErrorBody(json) ? json.error : null,
        retryAfter: Number(res.headers.get('Retry-After') ?? '') || undefined,
      };
    },
    [form],
  );

  return { submit };
}
