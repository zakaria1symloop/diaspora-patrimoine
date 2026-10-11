// TRV-124 « savoir où l'on est » — every page of the space has a visible title that says where one is. An optional
// eyebrow (small line above), an introduction, and actions on the right (stacked under on a phone).
import type { ReactNode } from 'react';
import s from './space.module.css';

export interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  /** Small links row above the title (« ← Mes dossiers »). */
  back?: ReactNode;
}

export function PageHeader({ title, eyebrow, intro, actions, back }: PageHeaderProps) {
  return (
    <header className={s.pageHeader}>
      {back ? <div className={s.pageBack}>{back}</div> : null}
      <div className={s.pageHeaderRow}>
        <div className={s.pageHeaderText}>
          {eyebrow ? <p className={s.eyebrow}>{eyebrow}</p> : null}
          <h1 className={s.pageTitle}>{title}</h1>
          {intro ? <p className={s.pageIntro}>{intro}</p> : null}
        </div>
        {actions ? <div className={s.pageActions}>{actions}</div> : null}
      </div>
    </header>
  );
}
