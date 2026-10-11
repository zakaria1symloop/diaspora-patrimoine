'use client';
// EA-30 « Tâches » (TAC-001 … TAC-007) and the tab « Tâches » of a dossier (TAC-031). The open tasks are grouped by due
// date — En retard · Aujourd'hui · Demain · Cette semaine · Plus tard · Sans échéance —, by priority then due date
// inside a group. One click on the round box completes a task, « Annuler » for 5 seconds; the row opens its detail on
// the right without leaving the list. Views with their counts, inline filters, bulk actions (complete, reassign,
// cancel — line by line under the rights of TAC-004), state in the address (`?view=`, `?tache=`, `?nouvelle=1`).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TASK_GROUPS, TASK_PRIORITIES, TASK_TYPES, TASK_VIEWS, type AgentPick, type TaskBulkResult, type TaskDetail, type TaskItem, type TaskList, type TaskView } from '@dp/contracts';
import { Banner, Button, EmptyState, FilterBar, Icon, Menu, Modal, Skeleton, StatusTag, useToast, type FilterValues, type MenuItem } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { shortDateTime, shortDay, staffLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { SelectInput, TextArea, TextInput, formStyles as f } from '../shell/forms';
import { PageHeader } from '../shell/Page';
import { signalShellChanged, useShell } from '../shell/ShellContext';
import { TaskDialog } from './TaskDialog';
import { allowed, Attachments, DueLabel, enumLabel, item, PRIORITY_TONE, shown, TYPE_ICON, whyNot } from './task-parts';
import s from './tasks.module.css';

type Win = { kind: 'postpone' | 'assign' | 'cancel'; task: TaskItem } | { kind: 'bulkAssign'; ids: string[] } | null;

export interface TasksBoardProps {
  /** The tab of a dossier: its tasks only, no views but « Ouvertes » / « Terminées », no address state. */
  dossierId?: string;
  dossierReference?: string;
  clientId?: string;
  readOnly?: boolean;
  onChange?: () => void;
  /** Another button of the tab, after « Tâche » (« Rendez-vous » in a dossier). */
  extraAction?: ReactNode;
}

export function TasksBoard({ dossierId, dossierReference, clientId, readOnly, onChange, extraAction }: TasksBoardProps) {
  const embedded = Boolean(dossierId);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const { timeZone, can, shell } = useShell();
  const [localView, setLocalView] = useState<'team' | 'done'>('team');
  const view: TaskView = embedded ? localView : ((params.get('view') as TaskView) ?? 'mine');
  const [filters, setFilters] = useState<FilterValues>(() => (embedded ? {} : readFilters(params)));
  const [q, setQ] = useState(embedded ? '' : (params.get('q') ?? ''));
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TaskList | null | 'failed'>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [win, setWin] = useState<Win>(null);
  const [creating, setCreating] = useState(!embedded && params.get('nouvelle') === '1');
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    if (!embedded && params.get('nouvelle') === '1') setCreating(true);
  }, [embedded, params]);
  const openId = embedded ? null : params.get('tache');
  const [panelId, setPanelId] = useState<string | null>(openId);
  useEffect(() => setPanelId(openId), [openId]);

  const setAddress = useCallback(
    (patch: Record<string, string | null>) => {
      if (embedded) return;
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) if (v === null || v === '') next.delete(k);
      else next.set(k, v);
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    },
    [embedded, params, pathname, router],
  );

  const query = useMemo(() => {
    const out: Record<string, string | number> = { view, page, pageSize: 50 };
    if (q.trim().length >= 2) out.q = q.trim();
    for (const [k, v] of Object.entries(filters)) if (v?.length) out[k] = v.join(',');
    if (dossierId) out.dossierId = dossierId;
    return out;
  }, [view, page, q, filters, dossierId]);

  const load = useCallback(async () => {
    const r = await adminCall<TaskList>('/admin/tasks', { query });
    setData(r.ok ? r.data : r.aborted ? null : 'failed');
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => document.visibilityState === 'visible' && void load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const changed = () => {
    void load();
    signalShellChanged();
    onChange?.();
  };

  async function act(path: string, body: unknown, success: string, undo?: () => Promise<void>) {
    const r = await adminCall(path, { body });
    if (!r.ok) return toast({ tone: 'error', text: errorText(r), action: { label: t('ui.common.retry'), run: () => void act(path, body, success, undo) } });
    toast({ text: success, ...(undo ? { action: { label: t('ui.common.cancel'), run: () => void undo().then(changed) } } : {}) });
    changed();
  }
  const complete = (task: TaskItem) => act(`/admin/tasks/${task.id}/complete`, {}, t('ui.admin-tasks.toast.done'), async () => void (await adminCall(`/admin/tasks/${task.id}/reopen`, { method: 'POST' })));

  async function bulk(action: 'complete' | 'cancel' | 'assign', ids: string[], assigneeId?: string | null) {
    const r = await adminCall<TaskBulkResult>('/admin/tasks/bulk', { body: { action, ids, assigneeId } });
    if (!r.ok) return toast({ tone: 'error', text: errorText(r) });
    toast({ text: r.data.refused.length ? t('ui.admin-tasks.toast.bulkPartial', { n: r.data.done, k: r.data.refused.length }) : t('ui.admin-tasks.toast.bulk', { n: r.data.done }) });
    setSelected(new Set());
    changed();
  }

  const list = data && data !== 'failed' ? data : null;
  const groups = useMemo(() => {
    if (!list) return [];
    return TASK_GROUPS.map((g) => ({ key: g, items: list.data.filter((x) => x.group === g) })).filter((g) => g.items.length);
  }, [list]);

  const rowMenu = (task: TaskItem): MenuItem[] => [
    ...item(task.can.edit, { key: 'edit', label: t('ui.admin-tasks.action.edit'), icon: 'edit', onSelect: () => setEditing(task.id) }),
    ...item(task.can.edit, { key: 'tomorrow', label: t('ui.admin-tasks.postpone.TOMORROW'), icon: 'clock', separated: true, onSelect: () => void act(`/admin/tasks/${task.id}/postpone`, { to: 'TOMORROW' }, t('ui.admin-tasks.toast.postponed')) }),
    ...item(task.can.edit, { key: 'in3', label: t('ui.admin-tasks.postpone.IN_3_DAYS'), icon: 'clock', onSelect: () => void act(`/admin/tasks/${task.id}/postpone`, { to: 'IN_3_DAYS' }, t('ui.admin-tasks.toast.postponed')) }),
    ...item(task.can.edit, { key: 'week', label: t('ui.admin-tasks.postpone.NEXT_WEEK'), icon: 'clock', onSelect: () => void act(`/admin/tasks/${task.id}/postpone`, { to: 'NEXT_WEEK' }, t('ui.admin-tasks.toast.postponed')) }),
    ...item(task.can.edit, { key: 'date', label: t('ui.admin-tasks.postpone.DATE'), icon: 'calendar', onSelect: () => setWin({ kind: 'postpone', task }) }),
    ...(task.can.take ? [{ key: 'take', label: t('ui.admin-tasks.action.take'), icon: 'user' as const, separated: true, onSelect: () => void act(`/admin/tasks/${task.id}/take`, {}, t('ui.admin-tasks.toast.taken')) }] : []),
    ...item(task.can.reassign, { key: 'assign', label: t('ui.admin-tasks.action.reassign'), icon: 'partners', separated: !task.can.take, onSelect: () => setWin({ kind: 'assign', task }) }),
    ...item(task.can.reopen, { key: 'reopen', label: t('ui.admin-tasks.action.reopen'), icon: 'arrow-left', onSelect: () => void act(`/admin/tasks/${task.id}/reopen`, {}, t('ui.admin-tasks.toast.reopened')) }),
    ...item(task.can.cancel, { key: 'cancel', label: t('ui.admin-tasks.action.cancel'), icon: 'close', danger: true, separated: true, onSelect: () => setWin({ kind: 'cancel', task }) }),
  ];

  const manage = can('task.manage') && !readOnly;
  const header = embedded ? null : (
    <PageHeader
      title={t('ui.admin-tasks.title')}
      crumbs={[{ label: t('ui.admin-shell.menu.group.organisation') }, { label: t('ui.admin-tasks.title') }]}
      intro={t('ui.admin-tasks.intro')}
      actions={
        manage ? (
          <Button variant="tool" size="M" onClick={() => setCreating(true)}>
            <Icon name="plus" size={20} />
            {t('ui.admin-tasks.create')}
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className={[s.board, embedded && s.boardEmbedded].filter(Boolean).join(' ')}>
      {header}
      <div className={s.surface}>
        <div className={s.views} role="tablist" aria-label={t('ui.admin-tasks.views')}>
          {(embedded ? (['team', 'done'] as const) : TASK_VIEWS).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={[s.view, view === v && s.viewOn].filter(Boolean).join(' ')}
              onClick={() => {
                setPage(1);
                setSelected(new Set());
                if (embedded) setLocalView(v as 'team' | 'done');
                else setAddress({ view: v });
              }}
            >
              {embedded ? t(`ui.admin-tasks.dossierView.${v as 'team' | 'done'}`) : t(`ui.admin-tasks.view.${v}`)}
              {!embedded && list ? <span className={s.viewCount}>{list.views[v]}</span> : null}
            </button>
          ))}
          {embedded && (manage || extraAction) ? (
            <span className={s.viewAction}>
              {manage ? (
                <Button variant="secondary" size="S" onClick={() => setCreating(true)}>
                  <Icon name="plus" size={16} />
                  {t('ui.admin-tasks.create')}
                </Button>
              ) : null}
              {extraAction}
            </span>
          ) : null}
        </div>
        {!embedded ? (
          <div className={s.filters}>
            <FilterBar
              filters={[
                { key: 'type', label: t('ui.admin-tasks.column.type'), kind: 'options', options: TASK_TYPES.map((x) => ({ value: x, label: enumLabel('TaskType', x) ?? x, count: list?.facets.type[x] ?? 0 })) },
                { key: 'priority', label: t('ui.admin-tasks.column.priority'), kind: 'options', options: TASK_PRIORITIES.map((x) => ({ value: x, label: enumLabel('Priority', x) ?? x, count: list?.facets.priority[x] ?? 0 })) },
                { key: 'origin', label: t('ui.admin-tasks.column.origin'), kind: 'options', options: (['MANUAL', 'AUTOMATIC'] as const).map((x) => ({ value: x, label: t(`ui.admin-tasks.origin.${x}`), count: list?.facets.origin[x] ?? 0 })) },
                { key: 'assigneeId', label: t('ui.admin-tasks.column.assignee'), kind: 'options', options: [{ value: 'none', label: t('ui.admin-tasks.assignee.team') }, ...(list?.agents ?? []).map((a) => ({ value: a.id, label: a.name }))] },
                { key: 'due', label: t('ui.admin-tasks.filter.due'), kind: 'options', rare: true, options: (['OVERDUE', 'TODAY', 'TOMORROW', 'WEEK', 'LATER', 'NONE'] as const).map((x) => ({ value: x, label: t(`ui.admin-tasks.group.${x}`) })) },
              ]}
              values={filters}
              onChange={(next) => {
                setFilters(next);
                setPage(1);
                setAddress(Object.fromEntries(['type', 'priority', 'origin', 'assigneeId', 'due'].map((k) => [k, next[k]?.join(',') ?? null])));
              }}
              labels={{
                clearAll: t('ui.common.clearAll'),
                moreFilters: t('ui.common.list.moreFilters'),
                remove: (name) => t('ui.admin-shell.list.removeFilter', { filtre: name }),
                searchInList: t('ui.common.search'),
                noOption: t('ui.admin-shell.list.noOption'),
                datePresets: { today: t('ui.admin-shell.list.date.today'), last7: t('ui.admin-shell.list.date.last7'), month: t('ui.admin-shell.list.date.month') },
                between: t('ui.admin-shell.list.date.between'),
                from: t('ui.admin-shell.list.date.from'),
                to: t('ui.admin-shell.list.date.to'),
                formatDay: shortDay,
                dateRange: () => '',
              }}
              search={
                <label className={s.search}>
                  <Icon name="search" size={16} />
                  <input type="search" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder={t('ui.admin-tasks.search')} aria-label={t('ui.admin-tasks.search')} />
                </label>
              }
            />
          </div>
        ) : null}
        {selected.size ? (
          <div className={s.bulkBar} role="region" aria-label={t('ui.admin-tasks.bulk.label')}>
            <strong>{t('ui.admin-tasks.bulk.selected', { n: selected.size })}</strong>
            <Button variant="secondary" size="S" onClick={() => void bulk('complete', [...selected])}>
              {t('ui.admin-tasks.action.complete')}
            </Button>
            <Button variant="secondary" size="S" onClick={() => setWin({ kind: 'bulkAssign', ids: [...selected] })}>
              {t('ui.admin-tasks.action.reassign')}
            </Button>
            <Button variant="secondary" size="S" onClick={() => void bulk('cancel', [...selected])}>
              {t('ui.admin-tasks.action.cancel')}
            </Button>
            <Button variant="secondary" size="S" onClick={() => setSelected(new Set())}>
              {t('ui.admin-tasks.bulk.clear')}
            </Button>
          </div>
        ) : null}

        <div className={s.listArea}>
          {data === null ? (
            <div className={s.skeletons}>
              <Skeleton height="3rem" />
              <Skeleton height="3rem" />
              <Skeleton height="3rem" />
            </div>
          ) : data === 'failed' ? (
            <Banner tone="error" action={<Button variant="secondary" size="S" onClick={() => void load()}>{t('ui.common.retry')}</Button>}>{t('ui.common.error.block')}</Banner>
          ) : !groups.length ? (
            <EmptyState icon="check" title={t(`ui.admin-tasks.empty.${embedded ? 'dossier' : view}` as never)} text={t('ui.admin-tasks.empty.text')} />
          ) : (
            groups.map((g) => (
              <section key={g.key} className={s.group} aria-labelledby={`g-${g.key}`}>
                <h2 id={`g-${g.key}`} className={[s.groupTitle, g.key === 'OVERDUE' && s.groupLate].filter(Boolean).join(' ')}>
                  {t(`ui.admin-tasks.group.${g.key}`)} <span className={s.groupCount}>{g.items.length}</span>
                </h2>
                <ul className={s.rows}>
                  {g.items.map((task) => (
                    <li key={task.id} className={[s.row, task.id === panelId && s.rowOn, task.status !== 'OPEN' && s.rowClosed].filter(Boolean).join(' ')} data-task={task.id}>
                      {manage && task.status === 'OPEN' && (allowed(task.can.complete) || allowed(task.can.reassign)) ? (
                        <input type="checkbox" className={s.select} aria-label={t('ui.admin-tasks.select', { titre: task.title })} checked={selected.has(task.id)} onChange={() => setSelected((cur) => toggle(cur, task.id))} />
                      ) : (
                        <span className={s.select} />
                      )}
                      {task.status === 'OPEN' && shown(task.can.complete) ? (
                        <button type="button" className={s.done} onClick={() => void complete(task)} disabled={!allowed(task.can.complete)} title={whyNot(task.can.complete) ?? t('ui.admin-tasks.action.complete')} aria-label={t('ui.admin-tasks.completeOne', { titre: task.title })}>
                          <Icon name="check" size={16} />
                        </button>
                      ) : (
                        <span className={[s.done, task.status === 'DONE' && s.doneOn].filter(Boolean).join(' ')} aria-hidden="true">
                          {task.status === 'DONE' ? <Icon name="check" size={16} /> : <Icon name="close" size={16} />}
                        </span>
                      )}
                      <button type="button" className={s.rowMain} onClick={() => (setPanelId(task.id), setAddress({ tache: task.id }))}>
                        <span className={s.rowTitle}>
                          <Icon name={TYPE_ICON[task.type] ?? 'check'} size={16} />
                          <span className={s.rowTitleText}>{task.title}</span>
                        </span>
                        <span className={s.rowMeta}>
                          <DueLabel task={task} timeZone={timeZone} />
                          {task.origin !== 'MANUAL' ? <span className={s.auto}>{t('ui.admin-tasks.automatic')}</span> : null}
                          <span className={s.rowAttach}>
                            <Attachments items={task.attachments.filter((a) => !(embedded && (a.kind === 'DOSSIER' || a.kind === 'CLIENT')))} />
                          </span>
                          {task.status !== 'OPEN' ? <span className={s.muted}>{task.closedAutomatically ? t('ui.admin-tasks.closedAuto', { raison: task.completionNote ?? task.cancelReason ?? '' }) : enumLabel('TaskStatus', task.status)}</span> : null}
                        </span>
                      </button>
                      <span className={s.rowPriority}>{task.priority === 'HIGH' || task.priority === 'URGENT' ? <StatusTag tone={PRIORITY_TONE[task.priority] ?? 'neutral'}>{enumLabel('Priority', task.priority)}</StatusTag> : null}</span>
                      <span className={s.rowWho}>{task.assignee ? (task.mine ? t('ui.admin-tasks.assignee.meShort') : staffLabel(task.assignee.name)) : <span className={s.team}>{t('ui.admin-tasks.assignee.team')}</span>}</span>
                      <span className={s.rowMenu}>{manage && rowMenu(task).length ? <Menu label={t('ui.admin-tasks.menu', { titre: task.title })} items={rowMenu(task)} /> : null}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
          {list && list.meta.totalPages > 1 ? (
            <div className={s.pager}>
              <Button variant="secondary" size="S" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('ui.admin-tasks.previous')}
              </Button>
              <span className={s.muted}>{t('ui.admin-tasks.page', { page, total: list.meta.totalPages, n: list.meta.total })}</span>
              <Button variant="secondary" size="S" disabled={page >= list.meta.totalPages} onClick={() => setPage(page + 1)}>
                {t('ui.admin-tasks.next')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <TaskPanel id={panelId} timeZone={timeZone} manage={manage} close={() => (setPanelId(null), setAddress({ tache: null }))} edit={(id) => setEditing(id)} changed={changed} rowMenu={rowMenu} />
      <TaskDialog open={creating} onClose={() => (setCreating(false), setAddress({ nouvelle: null }))} onDone={() => (setCreating(false), setAddress({ nouvelle: null }), toast({ text: t('ui.admin-tasks.toast.created') }), changed())} links={dossierId ? { dossierId, clientId, label: t('ui.admin-tasks.dossierLabel', { reference: dossierReference ?? '' }) } : undefined} />
      <TaskDialog open={editing !== null} taskId={editing ?? undefined} onClose={() => setEditing(null)} onDone={() => (setEditing(null), toast({ text: t('ui.common.saved') }), changed())} />
      <TaskWindows win={win} close={() => setWin(null)} done={() => (setWin(null), changed())} bulk={bulk} me={shell.user.id} />
    </div>
  );
}

const toggle = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

function readFilters(params: URLSearchParams): FilterValues {
  const out: FilterValues = {};
  for (const k of ['type', 'priority', 'origin', 'assigneeId', 'due']) {
    const v = params.get(k);
    if (v) out[k] = v.split(',');
  }
  return out;
}

// ─── The detail of a task, on the right (TAC-005, TAC-006) ──────────────────

function TaskPanel({ id, timeZone, manage, close, edit, changed, rowMenu }: { id: string | null; timeZone: string; manage: boolean; close: () => void; edit: (id: string) => void; changed: () => void; rowMenu: (t: TaskItem) => MenuItem[] }) {
  const toast = useToast();
  const [task, setTask] = useState<TaskDetail | null | 'failed'>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    if (!id) return;
    const r = await adminCall<TaskDetail>(`/admin/tasks/${id}`);
    setTask(r.ok ? r.data : 'failed');
  }, [id]);
  useEffect(() => {
    setTask(null);
    setNote('');
    void load();
  }, [load]);

  async function complete() {
    if (!task || task === 'failed') return;
    setPending(true);
    const r = await adminCall(`/admin/tasks/${task.id}/complete`, { body: { note: note.trim() || null } });
    setPending(false);
    if (!r.ok) return toast({ tone: 'error', text: errorText(r) });
    toast({ text: t('ui.admin-tasks.toast.done') });
    changed();
    void load();
  }

  const d = task && task !== 'failed' ? task : null;
  return (
    <aside className={[s.panel, id && s.panelOpen].filter(Boolean).join(' ')} aria-label={t('ui.admin-tasks.panel')} hidden={!id}>
      <header className={s.panelHead}>
        <span className={s.panelKicker}>{d ? enumLabel('TaskType', d.type) : ''}</span>
        <Button variant="secondary" size="S" onClick={close} aria-label={t('ui.common.close')}>
          <Icon name="close" size={16} />
        </Button>
      </header>
      {task === null ? (
        <div className={s.panelBody}>
          <Skeleton height="2rem" />
          <Skeleton height="6rem" />
        </div>
      ) : task === 'failed' ? (
        <div className={s.panelBody}>
          <Banner tone="error">{t('ui.admin-tasks.notFound')}</Banner>
        </div>
      ) : d ? (
        <div className={s.panelBody}>
          <h2 className={s.panelTitle}>{d.title}</h2>
          <div className={s.panelTags}>
            <StatusTag tone={d.status === 'OPEN' ? (d.overdue ? 'error' : 'info') : d.status === 'DONE' ? 'success' : 'inactive'}>{d.status === 'OPEN' && d.overdue ? t('ui.admin-tasks.group.OVERDUE') : enumLabel('TaskStatus', d.status)}</StatusTag>
            <StatusTag tone={PRIORITY_TONE[d.priority] ?? 'neutral'}>{enumLabel('Priority', d.priority)}</StatusTag>
            {d.origin !== 'MANUAL' ? <StatusTag tone="neutral" icon="sparkles">{d.ruleName ? t('ui.admin-tasks.automaticRule', { regle: d.ruleName }) : t('ui.admin-tasks.automatic')}</StatusTag> : null}
          </div>
          <dl className={s.facts}>
            <dt>{t('ui.admin-tasks.column.due')}</dt>
            <dd>
              <DueLabel task={d} timeZone={timeZone} />
            </dd>
            <dt>{t('ui.admin-tasks.field.reminder')}</dt>
            <dd>{d.reminderKind === 'NONE' ? t('ui.admin-tasks.reminder.NONE') : d.remindAt ? shortDateTime(d.remindAt, timeZone) : t(`ui.admin-tasks.reminder.${d.reminderKind}`)}</dd>
            <dt>{t('ui.admin-tasks.column.assignee')}</dt>
            <dd>{d.assignee ? staffLabel(d.assignee.name) : t('ui.admin-tasks.assignee.team')}</dd>
            <dt>{t('ui.admin-tasks.column.attached')}</dt>
            <dd>
              <Attachments items={d.attachments} />
            </dd>
            <dt>{t('ui.admin-tasks.createdBy')}</dt>
            <dd>{d.origin === 'MANUAL' ? staffLabel(d.createdBy) : t('ui.common.automatic')} · {shortDateTime(d.createdAt, timeZone)}</dd>
          </dl>
          {d.description ? <p className={s.description}>{d.description}</p> : null}
          {d.status !== 'OPEN' ? (
            <div className={s.closedBox}>
              <strong>{d.closedAutomatically ? t('ui.admin-tasks.closedAuto', { raison: d.completionNote ?? d.cancelReason ?? '' }) : d.status === 'DONE' ? t('ui.admin-tasks.closedBy', { nom: staffLabel(d.completedBy), date: d.completedAt ? shortDateTime(d.completedAt, timeZone) : '' }) : t('ui.admin-tasks.cancelled')}</strong>
              {!d.closedAutomatically && (d.completionNote || d.cancelReason) ? <p>{d.completionNote ?? d.cancelReason}</p> : null}
            </div>
          ) : null}
          {d.status === 'OPEN' && manage && shown(d.can.complete) ? (
            <div className={s.completeBox}>
              <TextArea label={t('ui.admin-tasks.field.completionNote')} optional hint={t('ui.admin-tasks.field.completionHint')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} />
              <div className={s.panelActions}>
                <Button variant="tool" size="M" pending={pending} disabled={!allowed(d.can.complete)} onClick={() => void complete()}>
                  <Icon name="check" size={16} />
                  {t('ui.admin-tasks.action.complete')}
                </Button>
                {allowed(d.can.edit) ? (
                  <Button variant="secondary" size="M" onClick={() => edit(d.id)}>
                    {t('ui.admin-tasks.action.edit')}
                  </Button>
                ) : null}
                <Menu label={t('ui.admin-tasks.menu', { titre: d.title })} items={rowMenu(d).filter((m) => m.key !== 'edit')} />
              </div>
            </div>
          ) : manage && rowMenu(d).length ? (
            <div className={s.panelActions}>
              <Menu label={t('ui.admin-tasks.menu', { titre: d.title })} items={rowMenu(d)} />
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

// ─── Windows: postpone to a date, reassign, cancel ──────────────────────────

function TaskWindows({ win, close, done, bulk, me }: { win: Win; close: () => void; done: () => void; bulk: (a: 'assign', ids: string[], assigneeId: string | null) => Promise<void>; me: string }) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [agents, setAgents] = useState<AgentPick[]>([]);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setValue('');
    if (win?.kind === 'assign' || win?.kind === 'bulkAssign') void adminCall<{ data: AgentPick[] }>('/admin/dossiers/pickers/agents').then((r) => r.ok && setAgents(r.data.data));
  }, [win]);
  if (!win) return <Modal open={false} onClose={close} title="" closeLabel={t('ui.common.close')}>{null}</Modal>;
  const title = t(`ui.admin-tasks.win.${win.kind}` as never);
  async function submit() {
    if (!win) return;
    setPending(true);
    if (win.kind === 'bulkAssign') {
      await bulk('assign', win.ids, value === 'team' ? null : value === 'me' ? me : value);
      setPending(false);
      return close();
    }
    const path = `/admin/tasks/${win.task.id}/${win.kind === 'postpone' ? 'postpone' : win.kind === 'assign' ? 'assign' : 'cancel'}`;
    const body = win.kind === 'postpone' ? { to: value } : win.kind === 'assign' ? { assigneeId: value === 'team' ? null : value === 'me' ? me : value } : { reason: value.trim() || null };
    const r = await adminCall(path, { body });
    setPending(false);
    if (!r.ok) return toast({ tone: 'error', text: errorText(r) });
    toast({ text: t(win.kind === 'postpone' ? 'ui.admin-tasks.toast.postponed' : win.kind === 'assign' ? 'ui.admin-tasks.toast.reassigned' : 'ui.admin-tasks.toast.cancelled') });
    done();
  }
  const ready = win.kind === 'cancel' || Boolean(value);
  return (
    <Modal open onClose={close} title={title} closeLabel={t('ui.common.close')}>
      <div className={f.form}>
        {'task' in win ? <p className={f.muted}>{win.task.title}</p> : null}
        {win.kind === 'postpone' ? <TextInput label={t('ui.admin-tasks.field.newDate')} type="date" value={value} onChange={(e) => setValue(e.target.value)} autoFocus hint={t('ui.admin-tasks.field.newDateHint')} /> : null}
        {win.kind === 'assign' || win.kind === 'bulkAssign' ? (
          <SelectInput label={t('ui.admin-tasks.field.assignee')} value={value} onChange={(e) => setValue(e.target.value)} autoFocus>
            <option value="" disabled>
              {t('ui.admin-tasks.field.choose')}
            </option>
            <option value="me">{t('ui.admin-tasks.assignee.me')}</option>
            <option value="team">{t('ui.admin-tasks.assignee.team')}</option>
            {agents
              .filter((a) => !a.me)
              .map((a) => (
                <option key={a.id} value={a.id} disabled={a.absentUntil !== null}>
                  {a.name}
                </option>
              ))}
          </SelectInput>
        ) : null}
        {win.kind === 'cancel' ? <TextArea label={t('ui.admin-tasks.field.cancelReason')} optional value={value} onChange={(e) => setValue(e.target.value)} maxLength={300} rows={2} autoFocus /> : null}
        <div className={`${f.actions} ${f.actionsEnd}`}>
          <Button variant="secondary" size="M" onClick={close}>
            {t('ui.common.cancel')}
          </Button>
          <Button variant={win.kind === 'cancel' ? 'danger' : 'tool'} size="M" pending={pending} disabled={!ready} onClick={() => void submit()}>
            {t(`ui.admin-tasks.win.${win.kind}Submit` as never)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
