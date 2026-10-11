// D-092, DSN-076 — the frame of a single-task page (projection EP-20, « Devenir partenaire » EP-23): breadcrumb,
// title, introduction and the task on the left; on the right a column of 480 px with the illustrated scene, on the soft
// gradient of the page, and what the visitor gains below it. On a phone the scene comes first, 200 px high, then the
// task, then the rest. Every sentence comes from a content block or a message key (TRV-002).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import e from '@/components/editorial/editorial.module.css';
import s from './task.module.css';

export function TaskPage({ title, intro, scene, aside, children }: { title: string; intro?: string | null; scene: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.page}>
      <div className={`container ${s.grid}`}>
        <div className={s.main}>
          <nav aria-label={t('ui.nav.breadcrumb')} className={e.breadcrumb}>
            <Link href="/">{t('ui.editorial.common.home')}</Link>
            <Icon name="chevron-right" size={16} />
            <span aria-current="page">{title}</span>
          </nav>
          <h1 className={e.title}>
            <span className={e.titleText}>{title}</span>
            <svg className={e.titleStroke} viewBox="0 0 320 18" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d="M4 14C70 6 190 2 316 6" stroke="var(--bo-fond-champagne)" strokeWidth="5" strokeLinecap="round" fill="none" />
              <path d="M4 14C60 8 130 5 200 4" stroke="var(--bo-accent-or)" strokeWidth="4" strokeLinecap="round" fill="none" />
            </svg>
          </h1>
          {intro ? <p className={e.intro}>{intro}</p> : null}
          <div className={s.task}>{children}</div>
        </div>
        <div className={s.scene}>{scene}</div>
        {aside ? <aside className={s.aside}>{aside}</aside> : null}
      </div>
    </div>
  );
}

/** A short list of what the visitor gains (content block `{title, text}[]`); hidden when the block is emptied (D-089). */
export function GainList({ id, title, items }: { id: string; title: string; items: { title: string; text: string }[] }) {
  const visible = items.filter((it) => it.title.trim());
  if (!visible.length) return null;
  return (
    <section className={s.gains} aria-labelledby={id}>
      <h2 id={id} className={s.gainsTitle}>
        {title}
      </h2>
      <ul className={s.gainList}>
        {visible.map((it) => (
          <li key={it.title} className={s.gain}>
            <span className={s.gainIcon}>
              <Icon name="check" size={16} />
            </span>
            <span>
              <strong className={s.gainName}>{it.title}</strong>
              {it.text ? <span className={s.gainText}>{it.text}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
