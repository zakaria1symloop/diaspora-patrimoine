'use client';
// EDI-020 § 3 — the financing journey: steps 4 to 6 of EDI-011 on a horizontal timeline (vertical on a phone). The line
// that links them draws itself when the timeline enters the screen, once (DSN-072, motion.slow).
import { useEffect, useRef, useState } from 'react';
import s from './interactive.module.css';

export function Journey({ steps }: { steps: { n: number; title: string; text: string }[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!('IntersectionObserver' in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return (
    <ol ref={ref} role="list" className={s.journey} data-seen={seen || undefined}>
      <span className={s.journeyLine} aria-hidden="true" />
      {steps.map((st) => (
        <li key={st.n} className={s.journeyStep}>
          <span className={s.journeyDot} aria-hidden="true">
            {st.n}
          </span>
          <h3 className={s.journeyTitle}>{st.title}</h3>
          <p className={s.journeyText}>{st.text}</p>
        </li>
      ))}
    </ol>
  );
}
