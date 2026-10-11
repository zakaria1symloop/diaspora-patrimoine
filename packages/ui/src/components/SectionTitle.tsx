// DSN-022 — the two-line title of the showcase: line 1 in title.section (roi), line 2 in display.lead (gold),
// underlined by the gold brush stroke; one single heading for screen readers (ACC-003). Then a two-line lead.
import type { ElementType } from 'react';
import s from './SectionTitle.module.css';

export interface SectionTitleProps {
  line1?: string | null;
  line2?: string | null;
  sub1?: string | null;
  sub2?: string | null;
  as?: ElementType;
  align?: 'center' | 'start';
  id?: string;
  size?: 'section' | 'hero';
}

export function SectionTitle({ line1, line2, sub1, sub2, as: Tag = 'h2', align = 'center', id, size = 'section' }: SectionTitleProps) {
  if (!line1 && !line2) return null;
  return (
    <div className={[s.wrap, align === 'start' && s.start, size === 'hero' && s.hero].filter(Boolean).join(' ')}>
      <Tag className={s.title} id={id}>
        {line1 ? <span className={s.line1}>{line1}</span> : null}
        {line1 && line2 ? ' ' : null}
        {line2 ? (
          <span className={s.line2}>
            {line2}
            <svg className={s.stroke} viewBox="0 0 320 18" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d="M4 14C70 6 190 2 316 6" stroke="var(--bo-fond-champagne)" strokeWidth="5" strokeLinecap="round" fill="none" />
              <path d="M4 14C60 8 130 5 200 4" stroke="var(--bo-accent-or)" strokeWidth="4" strokeLinecap="round" fill="none" />
            </svg>
          </span>
        ) : null}
      </Tag>
      {sub1 || sub2 ? (
        <p className={s.sub}>
          {sub1 ? <span className={s.sub1}>{sub1}</span> : null}
          {sub1 && sub2 ? ' ' : null}
          {sub2 ? <span className={s.sub2}>{sub2}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
