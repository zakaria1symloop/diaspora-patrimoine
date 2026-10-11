'use client';
// DSN-073 — success medallion: a check drawn in a bleu-roi circle, a gold ring closing, a discreet burst of twelve gold
// and blue dots (motion.celebrate), ONCE per moment and per browser (key dp_celebrated_{moment}_{objet}).
// Never for a negative or neutral event, never looped, never a sound. Reduced motion: shown checked, no burst.
import { useEffect, useState } from 'react';
import s from './Celebration.module.css';

export function Celebration({ moment, objectId = 'x' }: { moment: string; objectId?: string }) {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const key = `dp_celebrated_${moment}_${objectId}`;
    try {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        setPlay(true);
      }
    } catch {
      setPlay(true);
    }
  }, [moment, objectId]);
  const dots = Array.from({ length: 12 }, (_, i) => i);
  return (
    <span className={[s.wrap, play && s.play].filter(Boolean).join(' ')} aria-hidden="true">
      <svg viewBox="0 0 96 96" className={s.svg}>
        <circle cx="48" cy="48" r="44" className={s.ring} pathLength={1} />
        <circle cx="48" cy="48" r="34" className={s.disc} />
        <path d="M34 49l9 9 19-21" className={s.check} pathLength={1} />
      </svg>
      {play ? (
        <span className={s.burst}>
          {dots.map((i) => (
            <span key={i} className={i % 2 ? s.dotBlue : s.dotGold} style={{ ['--a' as string]: `${i * 30}deg` }} />
          ))}
        </span>
      ) : null}
    </span>
  );
}
