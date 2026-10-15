'use client';
// TAC-003 — the window that creates or modifies a task. Opened from the tasks screen and from any record (« Tâche » of
// the quick-add bar, BO-051): `links` attaches the task to the record it is created from, and the window says so.
// Rules shown in the window: a due date without hour is due « in the day » (late only the day after, reminder at 9:00);
// « 15 minutes » and « 1 heure avant » are offered only with an hour; without due date only « Aucun » or a chosen date.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { REMINDER_KINDS, TASK_PRIORITIES, TASK_TYPES, type AgentPick, type ApiErrorBody, type TaskDetail } from '@dp/contracts';
import { Banner, Button, Icon, Modal, Skeleton } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { SelectInput, TextArea, TextInput, formStyles as f, useUnsavedGuard } from '../shell/forms';
import { useShell } from '../shell/ShellContext';
import { changesText, ConflictNotice, isConflict } from '../shell/ConflictNotice';
import { enumLabel } from './task-parts';
import s from './tasks.module.css';

export interface TaskDialogLinks {
  dossierId?: string;
  clientId?: string;
  leadId?: string;
  /** What the window says the task is attached to (« Dossier DOS-2026-0042 »). */
  label?: string;
}

export interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful save (the caller reloads what shows tasks). */
  onDone: () => void;
  links?: TaskDialogLinks;
  /** Modify this task instead of creating one. */
  taskId?: string;
  /** A date chosen on the agenda (`YYYY-MM-DD`) and an hour (`HH:MM`). */
  presetDate?: string;
  presetTime?: string;
}

interface Values {
  title: string;
  type: string;
  priority: string;
  dueDate: string;
  dueTime: string;
  reminderKind: string;
  remindAt: string;
  assignee: string;
  description: string;
}

const EMPTY: Values = { title: '', type: 'FOLLOW_UP', priority: 'NORMAL', dueDate: '', dueTime: '', reminderKind: 'AT_DUE', remindAt: '', assignee: 'me', description: '' };

export function TaskDialog({ open, onClose, onDone, links, taskId, presetDate, presetTime }: TaskDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={taskId ? t('ui.admin-tasks.dialog.editTitle') : t('ui.admin-tasks.dialog.createTitle')} closeLabel={t('ui.common.close')} width={560}>
      {open ? <TaskForm onClose={onClose} onDone={onDone} links={links} taskId={taskId} presetDate={presetDate} presetTime={presetTime} /> : null}
    </Modal>
  );
}

function TaskForm({ onClose, onDone, links, taskId, presetDate, presetTime }: Omit<TaskDialogProps, 'open'>) {
  const { timeZone, shell } = useShell();
  const [v, setV] = useState<Values>({ ...EMPTY, dueDate: presetDate ?? '', dueTime: presetTime ?? '' });
  const [initial, setInitial] = useState<Values | null>(taskId ? null : { ...EMPTY, dueDate: presetDate ?? '', dueTime: presetTime ?? '' });
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [agents, setAgents] = useState<AgentPick[]>([]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ApiErrorBody['error'] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [key] = useState(newIdempotencyKey);
  useUnsavedGuard(initial !== null && JSON.stringify(v) !== JSON.stringify(initial));

  useEffect(() => {
    void adminCall<{ data: AgentPick[] }>('/admin/dossiers/pickers/agents').then((r) => r.ok && setAgents(r.data.data));
    if (!taskId) return;
    void adminCall<TaskDetail>(`/admin/tasks/${taskId}`).then((r) => {
      if (!r.ok) return setFailure(errorText(r));
      const d = r.data;
      const day = d.dueAt ? new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(d.dueAt)) : '';
      const hour = d.dueAt && d.dueHasTime ? new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d.dueAt)) : '';
      const next: Values = { title: d.title, type: d.type, priority: d.priority, dueDate: day, dueTime: hour, reminderKind: d.reminderKind, remindAt: d.remindAt && d.reminderKind === 'CUSTOM' ? toLocalInput(d.remindAt, timeZone) : '', assignee: d.assignee ? (d.assignee.id === shell.user.id ? 'me' : d.assignee.id) : 'team', description: d.description ?? '' };
      setTask(d);
      setV(next);
      setInitial(next);
    });
  }, [taskId, timeZone, shell.user.id]);

  // TAC-003 — the reminders the due date allows.
  const reminders = useMemo(() => REMINDER_KINDS.filter((k) => (!v.dueDate ? k === 'NONE' || k === 'CUSTOM' : v.dueTime ? true : k !== 'BEFORE_15M' && k !== 'BEFORE_1H')), [v.dueDate, v.dueTime]);
  useEffect(() => {
    if (!reminders.includes(v.reminderKind as (typeof REMINDER_KINDS)[number])) setV((cur) => ({ ...cur, reminderKind: cur.dueDate ? 'AT_DUE' : 'NONE' }));
  }, [reminders, v.reminderKind]);

  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.title.trim()) return setErrors({ title: t('ui.validation.REQUIRED') });
    setPending(true);
    setFailure(null);
    setErrors({});
    const remindAt = v.reminderKind === 'CUSTOM' && v.remindAt ? fromLocalInput(v.remindAt, timeZone) : null;
    const common = { title: v.title.trim(), type: v.type, priority: v.priority, dueDate: v.dueDate || null, dueTime: v.dueDate ? v.dueTime || null : null, reminderKind: v.reminderKind, remindAt, description: v.description.trim() || null };
    const r = task
      ? await adminCall(`/admin/tasks/${task.id}`, { method: 'PATCH', body: { version: task.version, ...common } })
      : await adminCall('/admin/tasks', { body: { ...common, assignee: v.assignee, links: { dossierId: links?.dossierId ?? null, clientId: links?.clientId ?? null, leadId: links?.leadId ?? null } }, idempotencyKey: key });
    // Reassigning an existing task is its own gesture (TAC-005 « Réaffecter »).
    const wanted = v.assignee === 'team' ? null : v.assignee === 'me' ? shell.user.id : v.assignee;
    if (r.ok && task && (task.assignee?.id ?? null) !== wanted) await adminCall(`/admin/tasks/${task.id}/assign`, { body: { assigneeId: wanted } });
    setPending(false);
    if (r.ok) return onDone();
    if (r.aborted) return;
    const fields = fieldErrors(r.error);
    if (Object.keys(fields).length) setErrors(fields);
    else if (isConflict(r.error)) setConflict(r.error ?? null); // TRV-094
    else setFailure(errorText(r));
  }

  if (taskId && !task && !failure)
    return (
      <div className={f.form}>
        <Skeleton height="2.5rem" />
        <Skeleton height="2.5rem" />
      </div>
    );
  const attached = links?.label ?? task?.attachments.map((a) => a.label).join(' · ');
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      {conflict ? <ConflictNotice error={conflict} onReload={() => window.location.reload()} changes={() => changesText(v as unknown as Record<string, unknown>)} /> : null}
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      {attached ? (
        <p className={s.attached}>
          <Icon name="folder" size={16} />
          {t('ui.admin-tasks.dialog.attachedTo', { objet: attached })}
        </p>
      ) : null}
      <TextInput label={t('ui.admin-tasks.field.title')} value={v.title} onChange={set('title')} maxLength={160} error={errors.title} autoFocus />
      <div className={f.row}>
        <SelectInput label={t('ui.admin-tasks.field.type')} value={v.type} onChange={set('type')}>
          {TASK_TYPES.map((x) => (
            <option key={x} value={x}>
              {enumLabel('TaskType', x)}
            </option>
          ))}
        </SelectInput>
        <SelectInput label={t('ui.admin-tasks.field.priority')} value={v.priority} onChange={set('priority')}>
          {TASK_PRIORITIES.map((x) => (
            <option key={x} value={x}>
              {enumLabel('Priority', x)}
            </option>
          ))}
        </SelectInput>
      </div>
      <div className={f.row}>
        <TextInput label={t('ui.admin-tasks.field.dueDate')} optional type="date" value={v.dueDate} onChange={set('dueDate')} error={errors.dueDate} />
        <TextInput label={t('ui.admin-tasks.field.dueTime')} optional type="time" value={v.dueTime} onChange={set('dueTime')} disabled={!v.dueDate} hint={v.dueDate && !v.dueTime ? t('ui.admin-tasks.field.inTheDay') : undefined} error={errors.dueTime} />
      </div>
      <div className={f.row}>
        <SelectInput label={t('ui.admin-tasks.field.reminder')} value={v.reminderKind} onChange={set('reminderKind')} error={errors.reminderKind}>
          {reminders.map((x) => (
            <option key={x} value={x}>
              {t(`ui.admin-tasks.reminder.${x}`)}
            </option>
          ))}
        </SelectInput>
        {v.reminderKind === 'CUSTOM' ? <TextInput label={t('ui.admin-tasks.field.remindAt')} type="datetime-local" value={v.remindAt} onChange={set('remindAt')} error={errors.remindAt} /> : <span />}
      </div>
      <SelectInput label={t('ui.admin-tasks.field.assignee')} value={v.assignee} onChange={set('assignee')}>
        <option value="me">{t('ui.admin-tasks.assignee.me')}</option>
        <option value="team">{t('ui.admin-tasks.assignee.team')}</option>
        {agents
          .filter((a) => !a.me)
          .map((a) => (
            <option key={a.id} value={a.id} disabled={a.absentUntil !== null}>
              {a.name}
              {a.absentUntil ? ` — ${t('ui.admin-tasks.assignee.absent')}` : ''}
            </option>
          ))}
      </SelectInput>
      <TextArea label={t('ui.admin-tasks.field.description')} optional value={v.description} onChange={set('description')} maxLength={2000} rows={3} />
      <div className={`${f.actions} ${f.actionsEnd}`}>
        <Button variant="secondary" size="M" onClick={onClose}>
          {t('ui.common.cancel')}
        </Button>
        <Button type="submit" variant="tool" size="M" pending={pending}>
          {task ? t('ui.common.save') : t('ui.admin-tasks.dialog.create')}
        </Button>
      </div>
    </form>
  );
}

/** `2026-10-12T09:30` in the staff member's zone ↔ an ISO instant. */
function toLocalInput(iso: string, timeZone: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const g = (k: string) => p.find((x) => x.type === k)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}
export function fromLocalInput(local: string, timeZone: string): string {
  const [date, hm] = local.split('T');
  return zoned(date!, hm!, timeZone).toISOString();
}
/** The instant of a wall-clock time in a zone (two passes absorb a change of offset). */
export function zoned(date: string, hm: string, timeZone: string): Date {
  const guess = new Date(`${date}T${hm}:00Z`);
  const offset = (d: Date) => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - d.getTime();
  };
  const first = new Date(guess.getTime() - offset(guess));
  return new Date(guess.getTime() - offset(first));
}
