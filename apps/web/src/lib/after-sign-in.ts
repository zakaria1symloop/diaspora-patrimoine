'use client';
// SFA-021 — right after a client session opens (sign-in, verification, activation, link), what the browser kept without
// an account joins it: the favourites of `dp_favorites` (`POST /client/favorites/merge`, without duplicates). The key is
// removed once merged; a failure keeps it for the next sign-in. Simulations move on the server side (AUTH-004, SIM-034).
import { LocalKeys } from '@dp/contracts';
import { apiCall } from './auth-client';
import { refreshAccountFavorites } from './account-favorites';

export async function bringOverAnonymousData(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LocalKeys.favorites);
  } catch {
    return;
  }
  if (!raw) return;
  let items: { ref: string; at: number }[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      items = parsed
        .filter((f): f is { ref: string; at: number } => Boolean(f) && typeof (f as { ref?: unknown }).ref === 'string' && typeof (f as { at?: unknown }).at === 'number')
        .slice(0, 20)
        .map((f) => ({ ref: f.ref, at: Math.trunc(f.at) }));
    }
  } catch {
    return;
  }
  if (!items.length) return;
  const res = await apiCall<{ merged: number }>('/client/favorites/merge', { body: { items }, retryOnAuth: true });
  if (res.ok) {
    refreshAccountFavorites(); // the hearts read the account's list again (EC-41)
    try {
      localStorage.removeItem(LocalKeys.favorites);
      window.dispatchEvent(new StorageEvent('storage', { key: LocalKeys.favorites }));
    } catch {
      /* storage unavailable */
    }
  }
}
