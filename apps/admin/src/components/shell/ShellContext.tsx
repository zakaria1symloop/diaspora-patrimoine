'use client';
// What every client component of the back office may ask the frame: who is signed in, what the role may do (ROL-023 —
// hide what it cannot do; the API still checks), the staff member's time zone (BO-082), the counters of the menu and
// of the bell. The summary is read again every 60 seconds while the tab is visible and on each return to it (TRV-107,
// until the live stream of API-070), and at once after `signalShellChanged()`.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AdminShell, Permission } from '@dp/contracts';
import { adminCall } from '@/lib/admin-client';

export interface ShellState {
  shell: AdminShell;
  /** True when the role holds the permission. */
  can: (permission: Permission) => boolean;
  timeZone: string;
  refresh: () => Promise<void>;
}

const Context = createContext<ShellState | null>(null);

/** After a write that changes a counter of the frame (a request taken, a notification read elsewhere). */
export function signalShellChanged(): void {
  window.dispatchEvent(new Event('dp:shell-changed'));
}

export function ShellProvider({ initial, children }: { initial: AdminShell; children: ReactNode }) {
  const [shell, setShell] = useState(initial);
  const alive = useRef(true);
  useEffect(() => setShell(initial), [initial]);

  const refresh = useCallback(async () => {
    const r = await adminCall<AdminShell>('/admin/me/shell');
    if (r.ok && alive.current) setShell(r.data);
  }, []);

  useEffect(() => {
    alive.current = true;
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('dp:shell-changed', tick);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('dp:shell-changed', tick);
    };
  }, [refresh]);

  const value = useMemo<ShellState>(() => {
    const set = new Set(shell.permissions);
    return { shell, can: (p) => set.has(p), timeZone: shell.user.timezone, refresh };
  }, [shell, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useShell(): ShellState {
  const value = useContext(Context);
  if (!value) throw new Error('useShell must be used inside the back-office shell');
  return value;
}

/** Renders its children only when the role holds the permission (an action forbidden by the role is ABSENT, BO-047). */
export function IfCan({ permission, children }: { permission: Permission; children: ReactNode }) {
  return useShell().can(permission) ? <>{children}</> : null;
}
