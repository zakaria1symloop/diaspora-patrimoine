'use client';
// Packages 3.4 to 3.6 — the reference data of the catalogue forms and pickers (`GET /admin/catalogue/reference`), read
// once per page load and shared by every component that needs it:
//
//   const ref = useCatalogueReference();        // null while loading
//   ref?.regions.filter((r) => r.countryCode === countryCode)
//
// `refreshCatalogueReference()` after a write that changes a picker (a promoter or a programme created or renamed).
import { useEffect, useState } from 'react';
import type { CatalogueReference } from '@dp/contracts';
import { adminCall } from '@/lib/admin-client';

let cached: CatalogueReference | null = null;
let pending: Promise<CatalogueReference | null> | null = null;
const listeners = new Set<(r: CatalogueReference | null) => void>();

function load(): Promise<CatalogueReference | null> {
  pending ??= adminCall<CatalogueReference>('/admin/catalogue/reference').then((r) => {
    pending = null;
    if (r.ok) {
      cached = r.data;
      for (const l of listeners) l(cached);
    }
    return cached;
  });
  return pending;
}

export function refreshCatalogueReference(): void {
  void load();
}

export function useCatalogueReference(): CatalogueReference | null {
  const [value, setValue] = useState<CatalogueReference | null>(cached);
  useEffect(() => {
    listeners.add(setValue);
    if (cached) setValue(cached);
    else void load();
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
