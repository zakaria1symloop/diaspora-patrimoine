// DSN-076 `Illustration` — line scenes of single-task pages, drawn from the Figma export (Design/assets/illustrations).
// Decorative: aria-hidden, no information that is not also in the text. Colours are the tokens of DSN-076.
import s from './Scene.module.css';

export type SceneName = 'attente' | 'perdu' | 'acces' | 'courrier' | 'partenaire';

const ROI = 'var(--bo-texte-roi)';
const OR = 'var(--bo-accent-or)';
const LIGNE = 'var(--bo-ligne-bleue)';
const OR_CLAIR = 'var(--bo-fond-or-clair)';
const CIEL = 'var(--bo-fond-ciel-pale)';
const CHAMPAGNE = 'var(--bo-fond-champagne-clair)';

const line = { strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

function Attente() {
  return (
    <>
      {/* the sun rises behind */}
      <circle cx="380" cy="330" r="70" fill={OR_CLAIR} className={s.rise} />
      <path d="M40 330H440" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      <path d="M120 330V80" stroke={ROI} strokeWidth="2.4" pathLength={1} className={s.draw} {...line} />
      <path d="M340 90H100L140 120V90" stroke={ROI} strokeWidth="2" pathLength={1} className={s.draw} {...line} />
      <rect x="248" y="190" width="112" height="140" rx="4" fill="var(--bo-fond-blanc)" className={s.fill} />
      <rect x="248" y="190" width="112" height="140" rx="4" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} fill="none" />
      <path d="M248 225H360" stroke={LIGNE} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      <path d="M248 260H360" stroke={LIGNE} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      <path d="M248 295H360" stroke={LIGNE} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      {/* the crane lowers the last block onto the building */}
      <g className={s.lower}>
        <path d="M300 90V148" stroke={OR} strokeWidth="1.7" {...line} />
        <rect x="282" y="148" width="36" height="26" rx="3" fill={OR_CLAIR} stroke={ROI} strokeWidth="1.7" />
      </g>
    </>
  );
}

function Perdu() {
  return (
    <>
      <circle cx="230" cy="190" r="150" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      <circle cx="160" cy="170" r="69.15" fill="var(--bo-fond-blanc)" className={s.fill} />
      <circle cx="160" cy="170" r="69.15" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} fill="none" />
      <circle cx="160" cy="170" r="55.15" stroke={LIGNE} strokeWidth="1.7" pathLength={1} className={s.draw} fill="none" />
      {/* the compass searches, then settles */}
      <path d="M160 124L170 170H150L160 124Z" fill={OR} className={s.seek} />
      <path d="M150 170H170L160 216L150 170Z" fill={ROI} className={s.seekDown} />
      {/* a dotted path leads to a house */}
      <path d="M230 220C290 260 300 300 360 290" stroke={OR} strokeWidth="2" strokeDasharray="4 7" className={s.dash} {...line} />
      <rect x="356" y="262" width="70" height="68" rx="3" fill="var(--bo-fond-blanc)" stroke={ROI} strokeWidth="1.7" className={`${s.fill} ${s.d3}`} />
      <path d="M356 262L391 234L426 262" fill={OR_CLAIR} className={`${s.fill} ${s.d3}`} />
      <path d="M356 262L391 234L426 262" stroke={ROI} strokeWidth="1.7" className={`${s.fill} ${s.d3}`} {...line} />
      <rect x="382" y="296" width="18" height="34" rx="3" fill={CHAMPAGNE} stroke={ROI} strokeWidth="1.7" className={`${s.fill} ${s.d4}`} />
    </>
  );
}

/** Sign-in and sign-up of the client space (EC-01, EC-02, EC-04…EC-07): a door draws itself, a golden key turns, the
 *  door opens on a warm light; a small house waits on the hill behind. */
function Acces() {
  return (
    <>
      <circle cx="330" cy="150" r="96" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      {/* the house on the hill */}
      <path d="M300 200L340 168L380 200V240H300Z" fill="var(--bo-fond-blanc)" className={`${s.fill} ${s.d2}`} />
      <path d="M300 200L340 168L380 200V240H300Z" stroke={LIGNE} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      <rect x="332" y="214" width="16" height="26" rx="2" fill={OR_CLAIR} className={`${s.fill} ${s.d3}`} />
      {/* the door frame and the light behind the door */}
      <rect x="140" y="110" width="120" height="220" rx="6" fill={OR_CLAIR} className={`${s.glow} ${s.d3}`} />
      <rect x="140" y="110" width="120" height="220" rx="6" stroke={ROI} strokeWidth="2" pathLength={1} className={s.draw} fill="none" />
      {/* the door leaf opens */}
      <g className={s.open}>
        <rect x="146" y="116" width="108" height="208" rx="4" fill={CHAMPAGNE} stroke={ROI} strokeWidth="1.7" />
        <path d="M168 150H232M168 190H232" stroke={LIGNE} strokeWidth="1.7" {...line} />
        <circle cx="236" cy="226" r="5" fill={OR} />
      </g>
      {/* the key turns once */}
      <g className={s.turn}>
        <circle cx="92" cy="226" r="16" stroke={OR} strokeWidth="3" fill="none" />
        <path d="M108 226H136M126 226V236M132 226V234" stroke={OR} strokeWidth="3" {...line} />
      </g>
    </>
  );
}

/** Pages that send an e-mail (verification, forgotten password, link): an envelope flies along a dotted arc to a mailbox
 *  whose flag rises. */
function Courrier() {
  return (
    <>
      <circle cx="240" cy="190" r="150" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      <path d="M90 250C150 120 300 100 350 200" stroke={OR} strokeWidth="2" strokeDasharray="4 7" className={s.dash} {...line} />
      {/* the mailbox */}
      <path d="M352 330V262" stroke={ROI} strokeWidth="2.4" pathLength={1} className={s.draw} {...line} />
      <path d="M318 262V226C318 212 330 202 344 202H372C386 202 398 212 398 226V262Z" fill="var(--bo-fond-blanc)" className={s.fill} />
      <path d="M318 262V226C318 212 330 202 344 202H372C386 202 398 212 398 226V262Z" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      <g className={s.raise}>
        <path d="M398 214V182H420V196H404" stroke={OR} strokeWidth="1.7" {...line} fill={OR_CLAIR} />
      </g>
      {/* the envelope arrives */}
      <g className={s.fly}>
        <rect x="200" y="128" width="84" height="58" rx="5" fill="var(--bo-fond-blanc)" stroke={ROI} strokeWidth="1.7" />
        <path d="M202 132L242 162L282 132" stroke={OR} strokeWidth="1.7" {...line} />
      </g>
    </>
  );
}

/** EP-32, EP-33, EP-23 (DSN-076 `Partenaire`): two buildings draw face to face; a dotted bridge links them; a golden key
 *  settles in the middle. */
function Partenaire() {
  return (
    <>
      <circle cx="240" cy="200" r="150" fill={CIEL} className={s.fill} />
      <path d="M40 330H440" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      <rect x="70" y="140" width="110" height="190" rx="4" fill="var(--bo-fond-blanc)" className={s.fill} />
      <rect x="70" y="140" width="110" height="190" rx="4" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} fill="none" />
      <path d="M90 175H160M90 210H160M90 245H160M90 280H160" stroke={LIGNE} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      <rect x="300" y="110" width="110" height="220" rx="4" fill="var(--bo-fond-blanc)" className={s.fill} />
      <rect x="300" y="110" width="110" height="220" rx="4" stroke={ROI} strokeWidth="1.7" pathLength={1} className={s.draw} fill="none" />
      <path d="M320 145H390M320 180H390M320 215H390M320 250H390M320 285H390" stroke={LIGNE} strokeWidth="1.7" pathLength={1} className={s.draw} {...line} />
      <rect x="118" y="300" width="18" height="30" rx="2" fill={CHAMPAGNE} className={`${s.fill} ${s.d2}`} />
      <rect x="346" y="300" width="18" height="30" rx="2" fill={CHAMPAGNE} className={`${s.fill} ${s.d2}`} />
      <path d="M180 200C220 170 260 170 300 200" stroke={OR} strokeWidth="2" strokeDasharray="4 7" className={s.dash} {...line} />
      <g className={s.lower}>
        <circle cx="224" cy="158" r="12" stroke={OR} strokeWidth="3" fill={OR_CLAIR} />
        <path d="M236 158H262M254 158V166M260 158V164" stroke={OR} strokeWidth="3" {...line} />
      </g>
    </>
  );
}

const scenes = { attente: Attente, perdu: Perdu, acces: Acces, courrier: Courrier, partenaire: Partenaire } as const;

export function Scene({ name, className }: { name: SceneName; className?: string }) {
  const Body = scenes[name];
  return (
    <svg viewBox="0 0 480 400" className={[s.scene, className].filter(Boolean).join(' ')} aria-hidden="true" focusable="false">
      <Body />
    </svg>
  );
}
