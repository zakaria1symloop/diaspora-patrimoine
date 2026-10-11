'use client';
// The client space's shared state in the browser: the shell summary (names, counters, dossiers), the public settings
// it needs, and `refresh()`. ECL-003 — without a live stream, the counters and the page are read again every 60 s
// while the tab is visible, and on each return to the tab (TRV-107).
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ClientSpaceSummary } from '@dp/contracts';
import { apiCall } from '@/lib/auth-client';
import type { MenuContext } from './menu';

export interface SpaceSettings {
  companyName: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  firstContactBusinessDays: number;
  calendarTimeZone: string;
  workdays: number[];
  /** FIC-012 — the mentions carried by an illustration or a 3D render, on cards as on pages. */
  illustrationNote: string;
  render3dNote: string;
  features: MenuContext['features'];
}

interface SpaceValue {
  summary: ClientSpaceSummary;
  settings: SpaceSettings;
  menu: MenuContext;
  /** Reads the summary again (counters) and, unless `soft`, re-renders the server components of the page. */
  refresh: (opts?: { soft?: boolean }) => Promise<void>;
  /** Lowers the bell immediately after a read (the server is the reference at the next refresh). */
  setUnread: (n: number) => void;
}

const Ctx = createContext<SpaceValue | null>(null);

export function useSpace(): SpaceValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSpace() outside the client space');
  return v;
}

/** Same, but null outside the space (components shared with the public site). */
export const useOptionalSpace = () => useContext(Ctx);

const POLL_MS = 60_000;

export function SpaceProvider({ initial, settings, children }: { initial: ClientSpaceSummary; settings: SpaceSettings; children: ReactNode }) {
  const [summary, setSummary] = useState(initial);
  const router = useRouter();
  const busy = useRef(false);

  // A server re-render brings a new summary: take it.
  useEffect(() => setSummary(initial), [initial]);

  const refresh = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const res = await apiCall<ClientSpaceSummary>('/client/space', { retryOnAuth: true });
        if (res.ok) setSummary(res.data);
        else if (res.status === 401) router.refresh(); // the page renders the renewal / sign-in path
        if (!opts?.soft) router.refresh();
      } finally {
        busy.current = false;
      }
    },
    [router],
  );

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    const onChanged = () => void refresh({ soft: true });
    window.addEventListener('dp:space-changed', onChanged);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('dp:space-changed', onChanged);
    };
  }, [refresh]);

  const setUnread = useCallback((n: number) => setSummary((s) => ({ ...s, unreadNotifications: Math.max(0, n) })), []);

  const value = useMemo<SpaceValue>(
    () => ({ summary, settings, menu: { summary, features: settings.features }, refresh, setUnread }),
    [summary, settings, refresh, setUnread],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Tells the shell that something it counts changed (a proposal opened, a notification read…). */
export function signalSpaceChanged(): void {
  window.dispatchEvent(new Event('dp:space-changed'));
}
