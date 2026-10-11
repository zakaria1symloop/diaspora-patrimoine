'use client';
// NAV-013 — the header knows in the browser whether a client session is valid (pages stay cached and anonymous).
// `GET /client/me`; an expired access token is renewed once (auth-client) before concluding « anonymous ».
import { useEffect, useState } from 'react';
import type { ClientMe } from '@dp/contracts';
import { apiCall } from './auth-client';

export type ClientSession =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; firstName: string; lastName: string | null; unread: number; hasDossier: boolean; me: ClientMe };

let pending: Promise<ClientSession> | null = null;

async function load(): Promise<ClientSession> {
  const res = await apiCall<ClientMe>('/client/me', { retryOnAuth: true });
  if (!res.ok) return { status: 'anonymous' };
  const me = res.data;
  return { status: 'authenticated', firstName: me.firstName ?? '', lastName: me.lastName, unread: me.unreadNotifications, hasDossier: me.hasDossier, me };
}

export function refreshClientSession(): void {
  pending = null;
  window.dispatchEvent(new Event('dp:session'));
}

export function useClientSession(): ClientSession {
  const [session, setSession] = useState<ClientSession>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    const run = () => {
      pending ??= load();
      void pending.then((s) => alive && setSession(s));
    };
    const reset = () => {
      pending = null;
      run();
    };
    run();
    window.addEventListener('dp:session', reset);
    return () => {
      alive = false;
      window.removeEventListener('dp:session', reset);
    };
  }, []);
  return session;
}
