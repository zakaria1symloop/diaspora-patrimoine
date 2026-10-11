// DSN-076, D-092 (pages alive) — line drawings of the discovery pages, in the style of the editorial scenes: 1.7 px
// strokes in roi and or, soft fills; strokes trace once, then one element moves, then still; never looped; reduced
// motion shows them finished. Decorative (aria-hidden): no information that is not also in the text.
//   heart   — favourites: a house, a heart settles on its roof
//   compare — comparator: three cards side by side, a balance above
//   bell    — alert: a house, a bell rings once and an envelope leaves
//   letter  — preferences: an open envelope and a switch
import s from './lineart.module.css';

export type LineArtName = 'heart' | 'compare' | 'bell' | 'letter';

const ROI = 'var(--bo-texte-roi)';
const OR = 'var(--bo-accent-or)';
const LIGNE = 'var(--bo-ligne-bleue)';
const OR_CLAIR = 'var(--bo-fond-or-clair)';
const CIEL = 'var(--bo-fond-ciel-pale)';
const BLANC = 'var(--bo-fond-blanc)';
const line = { strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
const stroke = (color = ROI, width = 1.7) => ({ stroke: color, strokeWidth: width, pathLength: 1, className: s.draw, ...line });

function House() {
  return (
    <>
      <circle cx="240" cy="190" r="140" fill={CIEL} className={s.fill} />
      <path d="M60 320H420" {...stroke()} />
      <path d="M150 320V190L240 120L330 190V320" {...stroke()} />
      <rect x="215" y="250" width="50" height="70" rx="4" fill={OR_CLAIR} className={s.fill} />
      <path d="M215 320V250H265V320" {...stroke()} />
      <rect x="170" y="205" width="34" height="30" rx="3" fill={BLANC} className={s.fill} />
      <rect x="276" y="205" width="34" height="30" rx="3" fill={BLANC} className={s.fill} />
      <path d="M170 205H204V235H170Z M276 205H310V235H276Z" {...stroke(LIGNE)} />
    </>
  );
}

function Heart() {
  return (
    <>
      <House />
      <g className={s.drop}>
        <path d="M240 112s-30-18-36-36c-4-13 5-25 18-25 8 0 14 5 18 11 4-6 10-11 18-11 13 0 22 12 18 25-6 18-36 36-36 36z" fill="var(--bo-accent-corail)" stroke={ROI} strokeWidth="1.7" />
      </g>
      <path d="M130 120l8-8M352 120l-8-8M120 160h-12M360 160h12" {...stroke(OR, 2)} />
    </>
  );
}

function Compare() {
  return (
    <>
      <circle cx="240" cy="210" r="150" fill={CIEL} className={s.fill} />
      <path d="M60 330H420" {...stroke()} />
      {[90, 195, 300].map((x, i) => (
        <g key={x} className={i === 1 ? s.rise : undefined}>
          <rect x={x} y="190" width="90" height="130" rx="10" fill={BLANC} className={s.fill} />
          <rect x={x} y="190" width="90" height="130" rx="10" {...stroke()} />
          <rect x={x + 10} y="200" width="70" height="44" rx="6" fill={i === 1 ? OR_CLAIR : CIEL} className={s.fill} />
          <path d={`M${x + 12} 262H${x + 78}M${x + 12} 280H${x + 60}M${x + 12} 298H${x + 70}`} {...stroke(LIGNE)} />
        </g>
      ))}
      <path d="M240 80V150M170 110H310" {...stroke()} />
      <path d="M170 110l-22 40h44zM310 110l-22 40h44z" {...stroke(OR, 2)} />
    </>
  );
}

function Bell() {
  return (
    <>
      <House />
      <g className={s.ring}>
        <path d="M240 58c-18 0-30 14-30 32v18l-8 12h76l-8-12V90c0-18-12-32-30-32z" fill={OR_CLAIR} stroke={ROI} strokeWidth="1.7" />
        <path d="M232 126a8 8 0 0016 0" stroke={ROI} strokeWidth="1.7" fill="none" />
      </g>
      <g className={s.fly}>
        <rect x="330" y="80" width="56" height="38" rx="4" fill={BLANC} stroke={OR} strokeWidth="2" />
        <path d="M330 84l28 18 28-18" stroke={OR} strokeWidth="2" fill="none" />
      </g>
    </>
  );
}

function Letter() {
  return (
    <>
      <circle cx="240" cy="200" r="150" fill={CIEL} className={s.fill} />
      <path d="M60 330H420" {...stroke()} />
      <rect x="130" y="170" width="220" height="150" rx="10" fill={BLANC} className={s.fill} />
      <path d="M130 180V310a10 10 0 0010 10h200a10 10 0 0010-10V180" {...stroke()} />
      <path d="M130 180l110 80 110-80" {...stroke()} />
      <g className={s.rise}>
        <rect x="170" y="90" width="140" height="110" rx="8" fill={OR_CLAIR} stroke={ROI} strokeWidth="1.7" />
        <path d="M190 120H290M190 145H260" stroke={LIGNE} strokeWidth="1.7" strokeLinecap="round" />
        <rect x="190" y="162" width="44" height="22" rx="11" fill={OR} />
        <circle cx="223" cy="173" r="8" fill={BLANC} />
      </g>
    </>
  );
}

const scenes: Record<LineArtName, () => React.JSX.Element> = { heart: Heart, compare: Compare, bell: Bell, letter: Letter };

export function LineArt({ name, className }: { name: LineArtName; className?: string }) {
  const Body = scenes[name];
  return (
    <svg viewBox="0 0 480 400" className={[s.scene, className].filter(Boolean).join(' ')} aria-hidden="true" focusable="false">
      <Body />
    </svg>
  );
}
