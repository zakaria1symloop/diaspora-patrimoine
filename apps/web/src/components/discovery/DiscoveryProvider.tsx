'use client';
// The switches of the « discovery » tools for every client component of the page: favourites (`features.favorites`,
// SFA-020) and search alerts (`features.searchAlerts`). Set once by the site frame from the public settings.
import { createContext, useContext, type ReactNode } from 'react';

export interface DiscoveryFlags {
  favorites: boolean;
  alerts: boolean;
}

const Ctx = createContext<DiscoveryFlags>({ favorites: true, alerts: true });

export function DiscoveryProvider({ flags, children }: { flags: DiscoveryFlags; children: ReactNode }) {
  return <Ctx.Provider value={flags}>{children}</Ctx.Provider>;
}

export const useDiscoveryFlags = () => useContext(Ctx);
