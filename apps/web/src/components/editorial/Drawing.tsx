// DSN-076 — line scenes of the editorial pages, in the style of `Illustration` (1.7 px strokes, roi and or, soft
// fills): `partenaire` is the scene of the spec (EDI-020 fallback of the expertise photo, EP-17); the others give each
// page head its own drawing (D-092, pages alive). Strokes trace once, then elements move one after the other, then
// still; never looped; reduced motion shows them finished. Decorative: aria-hidden, no text in the image.
import s from './drawing.module.css';

export type DrawingName = 'partenaire' | 'concept' | 'promoteurs' | 'questions' | 'contact' | 'document' | 'financement';

const ROI = 'var(--bo-texte-roi)';
const OR = 'var(--bo-accent-or)';
const LIGNE = 'var(--bo-ligne-bleue)';
const OR_CLAIR = 'var(--bo-fond-or-clair)';
const CIEL = 'var(--bo-fond-ciel-pale)';
const CHAMPAGNE = 'var(--bo-fond-champagne-clair)';
const BLANC = 'var(--bo-fond-blanc)';

const line = { strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
const stroke = (color = ROI, width = 1.7) => ({ stroke: color, strokeWidth: width, pathLength: 1, className: s.draw, ...line });

function Building({ x, w, h, windows, delay }: { x: number; w: number; h: number; windows: number; delay?: string }) {
  const top = 330 - h;
  const rows = Array.from({ length: windows }, (_, i) => top + 26 + i * 34).filter((y) => y < 300);
  return (
    <>
      <rect x={x} y={top} width={w} height={h} rx="4" fill={BLANC} className={s.fill} />
      <rect x={x} y={top} width={w} height={h} rx="4" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} fill="none" />
      {rows.map((y, i) => (
        <g key={y}>
          <rect x={x + 14} y={y} width="16" height="16" rx="2" fill={i % 2 ? CHAMPAGNE : OR_CLAIR} className={`${s.fill} ${delay ?? ""}`} />
          <rect x={x + w - 30} y={y} width="16" height="16" rx="2" fill={i % 2 ? OR_CLAIR : CIEL} className={`${s.fill} ${delay ?? ""}`} />
        </g>
      ))}
    </>
  );
}

function Partenaire() {
  return (
    <>
      <circle cx="240" cy="200" r="150" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" {...stroke()} />
      <Building x={70} w={110} h={190} windows={5} delay={s.d1} />
      <Building x={300} w={110} h={160} windows={4} delay={s.d2} />
      {/* a dotted bridge links the two buildings */}
      <path d="M180 200C220 170 260 170 300 200" stroke={OR} strokeWidth="2" strokeDasharray="4 7" className={s.dash} {...line} />
      {/* a golden key settles in the middle */}
      <g className={s.drop}>
        <circle cx="240" cy="236" r="14" fill={OR_CLAIR} stroke={OR} strokeWidth="2" />
        <path d="M240 250V290M240 272H252M240 284H250" stroke={OR} strokeWidth="2.4" {...line} />
      </g>
    </>
  );
}

function Concept() {
  return (
    <>
      <circle cx="250" cy="190" r="150" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" {...stroke()} />
      {/* from Paris to Algiers: a dotted arc, a small plane follows it */}
      <path d="M70 250C140 90 300 70 390 170" stroke={OR} strokeWidth="2" strokeDasharray="4 7" className={s.dash} {...line} />
      <circle cx="70" cy="250" r="7" fill={BLANC} stroke={ROI} strokeWidth="1.7" className={s.fill} />
      <g className={s.fly}>
        <path d="M372 150l22 10-22 10 4-10z" fill={OR_CLAIR} stroke={ROI} strokeWidth="1.5" strokeLinejoin="round" />
      </g>
      <Building x={330} w={90} h={130} windows={3} delay={s.d3} />
      <rect x="66" y="270" width="70" height="60" rx="3" fill={BLANC} className={s.fill} />
      <path d="M66 330V270H136V330M66 270L101 244L136 270" {...stroke()} />
      <rect x="92" y="296" width="18" height="34" rx="3" fill={CHAMPAGNE} className={`${s.fill} ${s.d2}`} />
    </>
  );
}

function Promoteurs() {
  return (
    <>
      <circle cx="240" cy="190" r="150" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" {...stroke()} />
      <Building x={60} w={100} h={150} windows={4} delay={s.d1} />
      <Building x={180} w={120} h={230} windows={6} delay={s.d2} />
      <Building x={320} w={100} h={180} windows={5} delay={s.d3} />
      {/* the badge of selection rises above */}
      <g className={s.rise}>
        <circle cx="240" cy="80" r="26" fill={OR_CLAIR} stroke={OR} strokeWidth="2" />
        <path d="M228 80l8 8 16-17" stroke={ROI} strokeWidth="2.4" {...line} />
      </g>
    </>
  );
}

function Questions() {
  return (
    <>
      <circle cx="240" cy="200" r="150" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" {...stroke()} />
      <rect x="70" y="90" width="210" height="110" rx="22" fill={BLANC} className={s.fill} />
      <path d="M92 90H258A22 22 0 0 1 280 112V178A22 22 0 0 1 258 200H140L104 232V200H92A22 22 0 0 1 70 178V112A22 22 0 0 1 92 90Z" {...stroke()} />
      <path d="M100 130H250M100 160H210" {...stroke(LIGNE)} />
      <g className={s.rise}>
        <rect x="220" y="196" width="190" height="96" rx="22" fill={OR_CLAIR} />
        <path d="M242 196H388A22 22 0 0 1 410 218V270A22 22 0 0 1 388 292H376V318L346 292H242A22 22 0 0 1 220 270V218A22 22 0 0 1 242 196Z" stroke={OR} strokeWidth="1.7" {...line} />
        <circle cx="275" cy="244" r="6" fill={ROI} />
        <circle cx="315" cy="244" r="6" fill={ROI} />
        <circle cx="355" cy="244" r="6" fill={ROI} />
      </g>
    </>
  );
}

function Contact() {
  return (
    <>
      <circle cx="240" cy="200" r="150" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" {...stroke()} />
      <rect x="90" y="150" width="200" height="130" rx="10" fill={BLANC} className={s.fill} />
      <rect x="90" y="150" width="200" height="130" rx="10" {...stroke()} />
      <path d="M92 156L190 226L288 156" {...stroke(OR, 2)} />
      {/* the phone rings twice, a bubble appears */}
      <g className={s.ring}>
        <rect x="310" y="120" width="80" height="150" rx="14" fill={OR_CLAIR} stroke={ROI} strokeWidth="1.7" />
        <path d="M336 250H364" stroke={ROI} strokeWidth="2" {...line} />
      </g>
      <g className={`${s.rise} ${s.late}`}>
        <rect x="250" y="70" width="110" height="52" rx="18" fill={BLANC} stroke={OR} strokeWidth="1.7" />
        <path d="M275 96H335" stroke={LIGNE} strokeWidth="1.7" {...line} />
      </g>
    </>
  );
}

function Document() {
  return (
    <>
      <circle cx="240" cy="200" r="150" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" {...stroke()} />
      <rect x="140" y="60" width="200" height="260" rx="8" fill={BLANC} className={s.fill} />
      <path d="M140 68A8 8 0 0 1 148 60H300L340 100V312A8 8 0 0 1 332 320H148A8 8 0 0 1 140 312Z" {...stroke()} />
      <path d="M300 60V100H340" {...stroke()} />
      <path d="M170 130H310M170 160H310M170 190H280M170 220H300" {...stroke(LIGNE)} />
      {/* the seal is pressed at the bottom */}
      <g className={s.drop}>
        <circle cx="290" cy="275" r="24" fill={OR_CLAIR} stroke={OR} strokeWidth="2" />
        <path d="M280 275l7 7 13-14" stroke={ROI} strokeWidth="2.2" {...line} />
      </g>
    </>
  );
}

function Financement() {
  return (
    <>
      <circle cx="240" cy="200" r="150" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" {...stroke()} />
      <path d="M80 160H400L240 90Z" fill={OR_CLAIR} className={s.fill} />
      <path d="M80 160H400L240 90Z" {...stroke()} />
      {[110, 180, 260, 330].map((x) => (
        <rect key={x} x={x} y="172" width="40" height="140" rx="4" fill={BLANC} stroke={ROI} strokeWidth="1.7" className={s.fill} />
      ))}
      <path d="M70 318H410" {...stroke(ROI, 2.4)} />
      <g className={s.rise}>
        <circle cx="240" cy="132" r="14" fill={BLANC} stroke={OR} strokeWidth="2" />
      </g>
    </>
  );
}

const scenes = {
  partenaire: Partenaire,
  concept: Concept,
  promoteurs: Promoteurs,
  questions: Questions,
  contact: Contact,
  document: Document,
  financement: Financement,
} as const;

export function Drawing({ name, className }: { name: DrawingName; className?: string }) {
  const Body = scenes[name];
  return (
    <svg viewBox="0 0 480 400" className={[s.scene, className].filter(Boolean).join(' ')} aria-hidden="true" focusable="false">
      <Body />
    </svg>
  );
}
