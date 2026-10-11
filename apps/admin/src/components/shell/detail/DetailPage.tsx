// BO-045, BO-047, BO-048 — THE record template (« fiche ») of the back office: a header (title, reference, state tags,
// main action, « ⋯ » menu of the other actions), tabs whose address keeps the trace (`?onglet=`), a right column (key
// information, the adviser, related objects) and the content. The record uses the full width of the work zone; the
// right column goes under the content on a narrow screen. No hook: usable by a server page (the tabs are links).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader, type Crumb } from '../Page';
import s from './detail.module.css';

export interface DetailTab {
  key: string;
  label: string;
  /** A counter on the tab, given by the server. */
  count?: number | null;
}

export interface DetailPageProps {
  crumbs: Crumb[];
  title: string;
  /** Reference and state tags (`StatusTag`), under the title. */
  meta?: ReactNode;
  /** The main action (a `tool` button, size M) and the « ⋯ » `Menu` of the other actions. An action forbidden by the
   *  role is absent; one impossible in the current state is greyed and says why (BO-047: `MenuItem.disabledReason`). */
  actions?: ReactNode;
  /** A notice across the record (« Suivi dans le dossier … », a masked-data reminder). */
  notice?: ReactNode;
  tabs?: DetailTab[];
  /** Key of the tab shown (read from `searchParams.onglet` by the page). */
  activeTab?: string;
  /** Address of the record, without parameters: the tabs link to `{basePath}?onglet={key}`. */
  basePath?: string;
  /** Right column. */
  aside?: ReactNode;
  children: ReactNode;
}

export function DetailPage({ crumbs, title, meta, actions, notice, tabs, activeTab, basePath, aside, children }: DetailPageProps) {
  const current = activeTab ?? tabs?.[0]?.key;
  return (
    <div className={s.page}>
      <PageHeader title={title} crumbs={crumbs} meta={meta} actions={actions} />
      {notice ? <div className={s.notice}>{notice}</div> : null}
      {tabs?.length ? (
        <nav className={s.tabs} aria-label={title}>
          {tabs.map((tab, i) => (
            <Link key={tab.key} href={i === 0 ? (basePath ?? '?') : `${basePath ?? ''}?onglet=${tab.key}`} className={[s.tab, current === tab.key && s.tabActive].filter(Boolean).join(' ')} aria-current={current === tab.key ? 'page' : undefined} scroll={false}>
              {tab.label}
              {typeof tab.count === 'number' ? <span className={s.tabCount}>{tab.count}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}
      <div className={[s.body, aside && s.withAside].filter(Boolean).join(' ')}>
        <div className={s.main}>{children}</div>
        {aside ? <aside className={s.aside}>{aside}</aside> : null}
      </div>
    </div>
  );
}

/** Columns of equal weight inside the content of a record (CRM-010: three zones). They stack on a narrow screen. */
export function DetailColumns({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return <div className={[s.columns, columns === 3 && s.columns3].filter(Boolean).join(' ')}>{children}</div>;
}

export { s as detailStyles };
