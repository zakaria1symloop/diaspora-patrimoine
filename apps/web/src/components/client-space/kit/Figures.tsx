// D-098 « les données importantes d'abord » — figure tiles (a count that leads to its page) and the key figures of an
// object (price, down payment, indicative monthly payment). A figure without value is not rendered (TRV-025).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@dp/ui';
import s from './kit.module.css';

export interface StatTileProps {
  icon: IconName;
  value: ReactNode;
  label: ReactNode;
  href?: string;
  /** A small flag on the corner (« 2 nouveaux »). */
  flag?: ReactNode;
  tone?: 'blue' | 'gold';
  /** The value is a short text (« Étape 4 sur 6 »), not a number. */
  text?: boolean;
  index?: number;
}

export function StatTile({ icon, value, label, href, flag, tone = 'blue', text, index = 0 }: StatTileProps) {
  const inner = (
    <>
      <span className={s.statIcon} aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className={s.statBody}>
        <span className={s.statValue}>{value}</span>
        <span className={s.statLabel}>{label}</span>
      </span>
      {href ? <Icon name="chevron-right" size={16} className={s.statGo} /> : null}
      {flag ? <span className={s.statFlag}>{flag}</span> : null}
    </>
  );
  const cls = [s.stat, s.enter, tone === 'gold' && s.statGold, text && s.statText].filter(Boolean).join(' ');
  const style = { ['--i' as string]: index };
  return (
    <li>
      {href ? (
        <Link href={href} className={cls} style={style}>
          {inner}
        </Link>
      ) : (
        <span className={cls} style={style}>
          {inner}
        </span>
      )}
    </li>
  );
}

export function StatTiles({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul role="list" className={s.stats} aria-label={label}>
      {children}
    </ul>
  );
}

export interface Figure {
  label: ReactNode;
  value: ReactNode | null | undefined;
  accent?: boolean;
  /** A « ? » next to the label (TRV-126). */
  help?: ReactNode;
}

/** Label / value pairs; pairs without value are left out; nothing is rendered when none has a value. */
export function Figures({ items, footnote, dense }: { items: Figure[]; footnote?: ReactNode; dense?: boolean }) {
  const shown = items.filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
  if (!shown.length) return null;
  return (
    <>
      <dl className={[s.figures, dense && s.figuresDense].filter(Boolean).join(' ')}>
        {shown.map((f, i) => (
          <div key={i} className={[s.figure, f.accent && s.figureAccent].filter(Boolean).join(' ')}>
            <dt>
              {f.label}
              {f.help}
            </dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      {footnote ? <p className={s.footnote}>{footnote}</p> : null}
    </>
  );
}
