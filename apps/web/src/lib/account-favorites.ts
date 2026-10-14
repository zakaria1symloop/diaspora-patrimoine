'use client';
// SFA-020, SFA-021, EC-41, D-103 — the heart belongs to the account: without a session, adding a favourite answers
// `SIGN_IN` (the caller opens the « Connectez-vous » window, askSignInForFavorite). The favourites a browser kept from
// before (`dp_favorites`, lib/discovery.ts) still show, can be removed, and join the account at sign-in.
// With a client session they live on the account (`GET /client/favorites` once, then `PUT` /
// `DELETE /client/favorites/{référence}`), updated at once on the screen and put back if the API refuses (TRV-081).
// Every heart of the page reads the same store; « Mes favoris » points to the right page.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { FAVORITES_MAX_ACCOUNT, FAVORITES_MAX_ANONYMOUS, type AccountFavoritesResponse, type FavoriteToggleResponse } from '@dp/contracts';
import { apiCall } from './auth-client';
import { useFavorites, type FavoriteToggleResult } from './discovery';
import { useClientSession } from './session-client';

type Listener = () => void;
const listeners = new Set<Listener>();
let refs: string[] = [];
let loaded: Promise<void> | null = null;
let loadedFor: string | null = null;

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => refs;
const EMPTY: string[] = [];
const server = () => EMPTY;

function load(userKey: string): Promise<void> {
  if (loaded && loadedFor === userKey) return loaded;
  loadedFor = userKey;
  loaded = apiCall<AccountFavoritesResponse>('/client/favorites', { retryOnAuth: true }).then((r) => {
    if (r.ok) {
      refs = r.data.references;
      emit();
    }
  });
  return loaded;
}

/** After a merge or a change made elsewhere (the favourites page), read the account's list again. */
export function refreshAccountFavorites(): void {
  loaded = null;
  if (loadedFor) void load(loadedFor);
}

/** The account's list was changed by a page that already knows it (EC-41 page): keep the hearts in step. */
export function setAccountFavorites(next: string[]): void {
  refs = next;
  emit();
}

export type HeartResult = FavoriteToggleResult | 'ERROR' | 'SIGN_IN';

export interface Hearts {
  mode: 'loading' | 'browser' | 'account';
  has: (ref: string) => boolean;
  count: number;
  max: number;
  /** « Mes favoris » of this visitor. */
  href: string;
  toggle: (ref: string) => Promise<HeartResult>;
}

export function useHearts(): Hearts {
  const session = useClientSession();
  const browser = useFavorites();
  const accountRefs = useSyncExternalStore(subscribe, snapshot, server);
  const signedIn = session.status === 'authenticated';
  const userKey = signedIn ? session.me.id : null;
  useEffect(() => {
    if (userKey) void load(userKey);
  }, [userKey]);

  const toggleAccount = useCallback(async (ref: string): Promise<HeartResult> => {
    const had = refs.includes(ref);
    if (!had && refs.length >= FAVORITES_MAX_ACCOUNT) return 'FULL';
    refs = had ? refs.filter((r) => r !== ref) : [ref, ...refs];
    emit();
    const r = await apiCall<FavoriteToggleResponse>(`/client/favorites/${encodeURIComponent(ref)}`, { method: had ? 'DELETE' : 'PUT', retryOnAuth: true });
    if (r.ok) return had ? 'REMOVED' : 'ADDED';
    refs = had ? [ref, ...refs] : refs.filter((x) => x !== ref);
    emit();
    return r.error?.reason === 'FAVORITES_LIMIT' ? 'FULL' : 'ERROR';
  }, []);

  if (session.status === 'loading') {
    // A click before the session is known: ask once, then act in the right home.
    const toggle = async (ref: string): Promise<HeartResult> => {
      const me = await apiCall<{ id: string }>('/client/me', { retryOnAuth: true });
      if (!me.ok) return browser.has(ref) ? browser.toggle(ref) : 'SIGN_IN';
      await load(me.data.id);
      return toggleAccount(ref);
    };
    return { mode: 'loading', has: (ref) => accountRefs.includes(ref) || browser.has(ref), count: browser.count, max: FAVORITES_MAX_ANONYMOUS, href: '/favoris', toggle };
  }
  if (signedIn) {
    return { mode: 'account', has: (ref) => accountRefs.includes(ref), count: accountRefs.length, max: FAVORITES_MAX_ACCOUNT, href: '/espace-client/favoris', toggle: toggleAccount };
  }
  return { mode: 'browser', has: browser.has, count: browser.count, max: FAVORITES_MAX_ANONYMOUS, href: '/favoris', toggle: async (ref) => (browser.has(ref) ? browser.toggle(ref) : 'SIGN_IN') };
}
