'use client';
// NAV-051 — what the visitor keeps in the browser without an account, written only when they ask for it:
//   `dp_compare`   the three properties at most set aside for the comparator (CAT-092): references only;
//   `dp_favorites` the favourites of a visitor without an account (SFA-021): references and the date each was added
//                  (SFA-022 shows it), twenty at most; brought over to the account at sign-in/sign-up (EC-41, later).
// Every component of the page sees the same list (one store per key, synchronised across tabs by the `storage` event).
// Storage may be refused (private window): the lists then live for the page only, nothing breaks.
import { useCallback, useSyncExternalStore } from 'react';
import { COMPARE_MAX, FAVORITES_MAX_ANONYMOUS, LocalKeys, type StoredFavorite } from '@dp/contracts';

type Listener = () => void;

function createStore<T>(key: string, parse: (raw: unknown) => T, empty: T) {
  const listeners = new Set<Listener>();
  let memory: string | null = null; // used when storage is refused
  let cacheRaw: string | null | undefined;
  let cacheValue: T = empty;

  const readRaw = (): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return memory;
    }
  };
  const snapshot = (): T => {
    const raw = readRaw();
    if (raw === cacheRaw) return cacheValue;
    cacheRaw = raw;
    try {
      cacheValue = raw ? parse(JSON.parse(raw)) : empty;
    } catch {
      cacheValue = empty;
    }
    return cacheValue;
  };
  const write = (value: T | null) => {
    const raw = value === null ? null : JSON.stringify(value);
    try {
      if (raw === null) localStorage.removeItem(key);
      else localStorage.setItem(key, raw);
    } catch {
      memory = raw;
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: Listener) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => e.key === key && l();
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener('storage', onStorage);
    };
  };
  return { snapshot, write, subscribe, server: () => empty };
}

const REF = /^[A-Z0-9][A-Z0-9-]{2,39}$/;

const compareStore = createStore<string[]>(
  LocalKeys.compare,
  (raw) => (Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string' && REF.test(r)).slice(0, COMPARE_MAX) : []),
  [],
);

const favoritesStore = createStore<StoredFavorite[]>(
  LocalKeys.favorites,
  (raw) =>
    Array.isArray(raw)
      ? raw
          .filter((f): f is StoredFavorite => Boolean(f) && typeof f.ref === 'string' && REF.test(f.ref) && typeof f.at === 'number')
          .slice(0, FAVORITES_MAX_ANONYMOUS)
      : [],
  [],
);

// ---------- CAT-092 — comparator ----------

export type CompareAddResult = 'ADDED' | 'ALREADY' | 'FULL';

export function useCompare() {
  const refs = useSyncExternalStore(compareStore.subscribe, compareStore.snapshot, compareStore.server);
  const add = useCallback((ref: string): CompareAddResult => {
    const now = compareStore.snapshot();
    if (now.includes(ref)) return 'ALREADY';
    if (now.length >= COMPARE_MAX) return 'FULL';
    compareStore.write([...now, ref]);
    return 'ADDED';
  }, []);
  const remove = useCallback((ref: string) => {
    const next = compareStore.snapshot().filter((r) => r !== ref);
    compareStore.write(next.length ? next : null);
  }, []);
  /** « Tout retirer »: the key disappears (NAV-051: kept until the visitor removes the properties). */
  const clear = useCallback(() => compareStore.write(null), []);
  const replace = useCallback((next: string[]) => compareStore.write(next.length ? next.slice(0, COMPARE_MAX) : null), []);
  return { refs, add, remove, clear, replace, has: (ref: string) => refs.includes(ref) };
}

// ---------- SFA-021 — favourites without an account ----------

export type FavoriteToggleResult = 'ADDED' | 'REMOVED' | 'FULL';

export function useFavorites() {
  const items = useSyncExternalStore(favoritesStore.subscribe, favoritesStore.snapshot, favoritesStore.server);
  const toggle = useCallback((ref: string): FavoriteToggleResult => {
    const now = favoritesStore.snapshot();
    if (now.some((f) => f.ref === ref)) {
      const next = now.filter((f) => f.ref !== ref);
      favoritesStore.write(next.length ? next : null);
      return 'REMOVED';
    }
    if (now.length >= FAVORITES_MAX_ANONYMOUS) return 'FULL';
    favoritesStore.write([{ ref, at: Date.now() }, ...now]);
    return 'ADDED';
  }, []);
  /** « Annuler » after a removal puts the favourite back with its original date. */
  const restore = useCallback((item: StoredFavorite) => {
    const now = favoritesStore.snapshot();
    if (now.some((f) => f.ref === item.ref) || now.length >= FAVORITES_MAX_ANONYMOUS) return;
    favoritesStore.write([...now, item].sort((a, b) => b.at - a.at));
  }, []);
  const remove = useCallback((refs: string[]) => {
    const next = favoritesStore.snapshot().filter((f) => !refs.includes(f.ref));
    favoritesStore.write(next.length ? next : null);
  }, []);
  return { items, toggle, restore, remove, has: (ref: string) => items.some((f) => f.ref === ref), count: items.length };
}

/** Read once without subscribing (event handlers). */
export const readFavorites = () => favoritesStore.snapshot();

// ---------- TRV-081 — short messages ----------

export interface ToastInput {
  message: string;
  action?: { label: string; onClick: () => void };
  link?: { label: string; href: string };
  tone?: 'success' | 'info' | 'error';
}

export function showToast(toast: ToastInput): void {
  window.dispatchEvent(new CustomEvent<ToastInput>('dp:toast', { detail: toast }));
}
