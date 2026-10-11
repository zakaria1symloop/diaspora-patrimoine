'use client';
// TRV-080 — the results of the catalogue while a new search is on its way (filters applied, sort, keyword, a chip
// removed, another page): the cards give way to skeletons of the same shape until the page answers. The page itself is
// server-rendered and keeps its address rules (CAT-020, CAT-055); this only watches the navigations that start from it:
// a click on one of its links, or `announceCatalogueSearch()` before a `router.push`. The answer is known by `stamp`,
// the criteria the server applied — not by `useSearchParams`, which would put the results behind a Suspense boundary
// hydrated after the rest of the page (RevealOnScroll has already touched the lists by then).
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { PropertyGridSkeleton } from '@/components/vitrine/Skeletons';
import { t } from '@/lib/i18n';
import s from './catalogue.module.css';

const EVENT = 'dp:catalogue-search';
/** Parameters that open a window over the same results: no new search. */
const WINDOWS = ['filtres', 'alerte', 'enregistrer', 'rappel'];
/** Never leave skeletons for ever (the address may come back unchanged). */
const GIVE_UP_MS = 8000;

function searchKey(search: string): string {
  const qs = new URLSearchParams(search);
  for (const w of WINDOWS) qs.delete(w);
  qs.sort();
  return qs.toString();
}

/** To call right before a `router.push` / `router.replace` towards the catalogue. */
export function announceCatalogueSearch(url: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: url }));
}

export function ResultsPending({ count, stamp, children }: { count: number; stamp: string; children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  // the page has answered
  useEffect(() => setPending(false), [pathname, stamp]);

  useEffect(() => {
    const start = (url: string) => {
      let target: URL;
      try {
        target = new URL(url, window.location.href);
      } catch {
        return;
      }
      if (target.origin !== window.location.origin || target.pathname !== window.location.pathname) return;
      if (searchKey(target.search) !== searchKey(window.location.search)) setPending(true);
    };
    const onEvent = (e: Event) => start((e as CustomEvent<string>).detail);
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (a && !a.hasAttribute('download') && a.getAttribute('target') !== '_blank') start((a as HTMLAnchorElement).href);
    };
    window.addEventListener(EVENT, onEvent);
    // capture: the router has not yet taken the click over (it prevents the default before a bubbling listener sees it)
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener(EVENT, onEvent);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(false), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  if (!pending) return <>{children}</>;
  return <PropertyGridSkeleton className={s.grid} count={Math.min(Math.max(count, 3), 12)} label={t('ui.catalogue.page.loading')} />;
}
