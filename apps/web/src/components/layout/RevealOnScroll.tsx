'use client';
// DSN-072 (row « Cartes d'une liste de la vitrine », D-100) — the cards of a list marked `data-reveal` come in one after
// the other (fade and 12 px, motion.base, 40 ms apart) when the list enters the screen, once. Only lists still below
// the screen at load are prepared: nothing visible ever disappears, nothing is hidden without JavaScript, and nothing
// moves with « réduire les animations » or « Affichage simplifié » (DSN-074, TRV-122). Re-scans after a navigation.
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function RevealOnScroll() {
  const pathname = usePathname();
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.documentElement.hasAttribute('data-simple')) return;
    const lists = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal="in"])'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.reveal = 'in';
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    for (const el of lists) {
      if (el.getBoundingClientRect().top < window.innerHeight) continue; // already on screen: leave it as it is
      el.dataset.reveal = 'wait';
      io.observe(el);
    }
    return () => {
      io.disconnect();
      for (const el of lists) if (el.dataset.reveal === 'wait') el.dataset.reveal = '';
    };
  }, [pathname]);
  return null;
}
