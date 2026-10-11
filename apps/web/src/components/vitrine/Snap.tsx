'use client';
// ACC-100, Figma EP-01 390 — under 768 px a list of cards becomes a horizontal snapping scroller, one card and a bit of
// the next visible, with position dots; on a computer it stays the grid given by `className`. Every card stays reachable
// with the keyboard (the list scrolls to the focused card) and by a screen reader (a plain list). The dots are buttons
// of 44 px (TRV-121) that bring their card into view; the current one follows the scroll.
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '@/lib/i18n';
import s from './Snap.module.css';

export function Snap({ children, className, label, wide }: { children: ReactNode; className?: string; label: string; wide?: boolean }) {
  const ref = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const count = Children.count(children);

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const items = Array.from(el.children);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(items.indexOf(e.target));
      },
      { root: el, threshold: 0.6 },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, [count]);

  const go = (i: number) => {
    const el = ref.current;
    const item = el?.children[i] as HTMLElement | undefined;
    if (!el || !item) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pad = parseFloat(getComputedStyle(el).paddingInlineStart) || 0;
    el.scrollTo({ left: item.offsetLeft - pad, behavior: reduce ? 'auto' : 'smooth' });
    setActive(i);
  };

  return (
    <div className={s.wrap}>
      <ul ref={ref} className={[className, s.snap, wide && s.wide].filter(Boolean).join(' ')} role="list" aria-label={label} data-reveal="">
        {children}
      </ul>
      {count > 1 ? (
        <div className={s.dots}>
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              className={s.dot}
              aria-label={t('ui.home.carousel.goTo', { n: i + 1, total: count })}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
