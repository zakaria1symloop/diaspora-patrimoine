// D-092 — a page with a single task is not a bare form: a drawing of what is being made. A folder opens, a house and a
// key come out of it, drawn in the colours of the « Outil » register; it moves once, slowly, and stays still afterwards
// (DSN-071; nothing moves for a person who asked the system to reduce motion).
import s from './dossiers.module.css';

export function DossierIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={[s.illustration, className].filter(Boolean).join(' ')} aria-hidden="true" focusable="false">
      <rect x="40" y="52" width="160" height="92" rx="10" className={s.illBack} />
      <g className={s.illHouse}>
        <path d="M92 96 L120 72 L148 96 V124 H92 Z" className={s.illHouseBody} />
        <rect x="112" y="104" width="16" height="20" rx="2" className={s.illDoor} />
        <circle cx="158" cy="74" r="7" className={s.illKey} />
        <path d="M158 81 V100 M158 92 H164 M158 97 H163" className={s.illKeyStem} />
      </g>
      <path d="M40 76 H96 L106 66 H200 V134 a10 10 0 0 1 -10 10 H50 a10 10 0 0 1 -10 -10 Z" className={s.illFront} />
      <path d="M58 118 H128 M58 128 H104" className={s.illLines} />
    </svg>
  );
}
