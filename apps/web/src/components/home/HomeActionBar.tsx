'use client';
// ACC-100 — on a phone, a fixed action bar appears once the hero has left the screen: « Je m'inscris au prochain café »
// (or its fallback). It slides away while the projection form or the footer is on screen, so that it never covers
// them. Its height never changes (D-098); it only slides (transform), and simply shows/hides with reduced motion.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buttonClass, ButtonInner } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './home.module.css';

export function HomeActionBar({ href, label, scroll = true }: { href: string; label: string; scroll?: boolean }) {
  const [past, setPast] = useState(false);
  const [covering, setCovering] = useState(false);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const hero = document.querySelector('[data-hero]');
    const avoid = Array.from(document.querySelectorAll('#projection form, footer'));
    const seen = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setPast(!e.isIntersecting && e.boundingClientRect.top < 0);
        else if (e.isIntersecting) seen.add(e.target);
        else seen.delete(e.target);
      }
      setCovering(seen.size > 0);
    });
    if (hero) io.observe(hero);
    avoid.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  const shown = past && !covering;
  return (
    <div className={s.actionBar} data-shown={shown || undefined} aria-hidden={!shown} role="region" aria-label={t('ui.home.stickyBar.label')}>
      <Link href={href} className={buttonClass('primary', 'L', true)} tabIndex={shown ? undefined : -1} scroll={scroll}>
        <ButtonInner chevron size="L">
          {label}
        </ButtonInner>
      </Link>
    </div>
  );
}
