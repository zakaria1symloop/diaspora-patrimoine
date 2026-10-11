// BO-010, BO-015, TRV-080, TRV-084 — the building blocks of a page of the work zone: the header (breadcrumb, title,
// actions of the page), a white surface with a `ligne/bleue` border (DSN-090), and the page-wide states « Vous n'avez
// pas accès à cette page. » (403) and « Cet élément est introuvable. » (404). No hook here: usable by a server page.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState, Icon, buttonClass, ButtonInner } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './page.module.css';

export interface Crumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  /** The visible title of the page (one `h1` per page). */
  title: string;
  /** Breadcrumb: the group and the list the page belongs to; the last item is the page itself (no link). */
  crumbs?: Crumb[];
  /** Under the title: a reference, state tags… */
  meta?: ReactNode;
  intro?: ReactNode;
  /** The actions of the page, right-aligned: the main one as a `tool` button of size M (DSN-091). */
  actions?: ReactNode;
}

export function PageHeader({ title, crumbs, meta, intro, actions }: PageHeaderProps) {
  return (
    <header className={s.header}>
      {crumbs?.length ? (
        <nav aria-label={t('ui.admin-shell.page.breadcrumb')} className={s.crumbs}>
          <ol>
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`}>
                {i > 0 ? <Icon name="chevron-right" size={16} className={s.crumbSep} /> : null}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className={s.headRow}>
        <div className={s.headText}>
          <h1 className={s.title}>{title}</h1>
          {meta ? <div className={s.meta}>{meta}</div> : null}
          {intro ? <p className={s.intro}>{intro}</p> : null}
        </div>
        {actions ? <div className={s.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}

/** A white surface: cards have a border only, no shadow (DSN-034). */
export function Surface({ title, actions, children, flush, as: Tag = 'section', className }: { title?: string; actions?: ReactNode; children: ReactNode; flush?: boolean; as?: 'section' | 'div' | 'aside'; className?: string }) {
  return (
    <Tag className={[s.surface, className].filter(Boolean).join(' ')}>
      {title || actions ? (
        <header className={s.surfaceHead}>
          {title ? <h2 className={s.surfaceTitle}>{title}</h2> : <span />}
          {actions ? <div className={s.surfaceActions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={flush ? undefined : s.surfaceBody}>{children}</div>
    </Tag>
  );
}

/** A label and its value, for the key information of a record; a missing value reads « — » (TRV-025). */
export function Facts({ items, columns = 1 }: { items: { label: string; value: ReactNode; help?: ReactNode }[]; columns?: 1 | 2 }) {
  return (
    <dl className={[s.facts, columns === 2 && s.facts2].filter(Boolean).join(' ')}>
      {items.map((it) => (
        <div key={it.label} className={s.fact}>
          <dt>
            {it.label}
            {it.help}
          </dt>
          <dd>{it.value === null || it.value === undefined || it.value === '' ? '—' : it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HomeLink() {
  return (
    <Link href="/" className={buttonClass('tool', 'M')}>
      <ButtonInner size="M">{t('ui.admin-shell.page.home')}</ButtonInner>
    </Link>
  );
}

/** BO-015 — an address opened without the needed right. */
export function Forbidden() {
  return (
    <div className={s.state}>
      <EmptyState icon="lock" title={t('ui.admin-shell.page.forbidden')} text={t('ui.admin-shell.page.forbiddenText')} actions={<HomeLink />} />
    </div>
  );
}

/** BO-015 — an object that does not exist, or lies outside the perimeter of the reader. */
export function NotFoundState() {
  return (
    <div className={s.state}>
      <EmptyState icon="search" title={t('ui.admin-shell.page.notFound')} text={t('ui.error.NOT_FOUND')} actions={<HomeLink />} />
    </div>
  );
}

export { s as pageStyles };
