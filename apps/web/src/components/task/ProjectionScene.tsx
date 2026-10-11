// DSN-076 scene « Projection » (EP-20): a dotted arc leaves Paris and traces itself to Algiers, a small plane follows it;
// a building draws itself line by line, its windows light up one after the other; a curve rises to a « your
// projection » pill (a shape, never text in the image). Once on arrival, 2 400 ms, then still; reduced motion: shown
// finished (styles of the editorial scenes). Decorative: aria-hidden.
import s from '@/components/editorial/drawing.module.css';

const ROI = 'var(--bo-texte-roi)';
const OR = 'var(--bo-accent-or)';
const LIGNE = 'var(--bo-ligne-bleue)';
const OR_CLAIR = 'var(--bo-fond-or-clair)';
const CIEL = 'var(--bo-fond-ciel-pale)';
const CHAMPAGNE = 'var(--bo-fond-champagne-clair)';
const BLANC = 'var(--bo-fond-blanc)';

const line = { strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
const stroke = (color = ROI, width = 1.7) => ({ stroke: color, strokeWidth: width, pathLength: 1, className: s.draw, ...line });

/** Windows of the building: left to right, bottom to top, 120 ms apart after the strokes. */
const WINDOWS = [0, 1, 2, 3].flatMap((row) => [0, 1, 2].map((col) => ({ x: 286 + col * 30, y: 290 - row * 40, i: row * 3 + col })));

export function ProjectionScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 400" className={[s.scene, className].filter(Boolean).join(' ')} aria-hidden="true" focusable="false">
      <circle cx="250" cy="200" r="160" fill={CIEL} className={s.fill} />
      <path d="M30 340H450" {...stroke()} />

      {/* Paris: a small house, the start of the arc */}
      <rect x="54" y="296" width="62" height="44" rx="3" fill={BLANC} className={s.fill} />
      <path d="M54 340V296H116V340M48 300L85 270L122 300" {...stroke()} />
      <rect x="77" y="314" width="16" height="26" rx="3" fill={CHAMPAGNE} className={`${s.fill} ${s.d1}`} />

      {/* the dotted arc from Paris to Algiers, and the plane that follows it */}
      <path d="M86 262C120 110 230 70 300 150" stroke={OR} strokeWidth="2" strokeDasharray="4 7" className={s.dash} {...line} />
      <g className={s.fly}>
        <path d="M284 128l24 11-24 11 5-11z" fill={OR_CLAIR} stroke={ROI} strokeWidth="1.5" strokeLinejoin="round" />
      </g>

      {/* Algiers: the building draws itself, its windows light up one by one */}
      <rect x="270" y="170" width="104" height="170" rx="4" fill={BLANC} className={s.fill} />
      <rect x="270" y="170" width="104" height="170" rx="4" {...stroke()} />
      <path d="M270 200H374" {...stroke(LIGNE)} />
      {WINDOWS.map((w) => (
        <rect
          key={w.i}
          x={w.x}
          y={w.y}
          width="16"
          height="20"
          rx="2"
          fill={w.i % 3 === 1 ? CHAMPAGNE : OR_CLAIR}
          className={s.fill}
          style={{ animationDelay: `${1200 + w.i * 90}ms` }}
        />
      ))}

      {/* the curve rises to the pill of the projection */}
      <path d="M130 330C200 320 230 260 300 236S390 150 412 96" stroke={OR} strokeWidth="2.4" pathLength={1} className={s.draw} {...line} />
      <g className={`${s.rise} ${s.late}`}>
        <rect x="372" y="54" width="84" height="40" rx="20" fill={BLANC} stroke={OR} strokeWidth="2" />
        <circle cx="394" cy="74" r="10" fill={OR_CLAIR} />
        <path d="M389 74l4 4 7-8" stroke={ROI} strokeWidth="2.2" {...line} />
        <path d="M412 68H442M412 80H432" stroke={LIGNE} strokeWidth="3" {...line} />
      </g>
    </svg>
  );
}
