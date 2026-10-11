'use client';
// PIP-060, TAC-031 — the tab « Tâches » of a dossier (EA-22): the tasks attached to it, with the same gestures as the
// tasks screen (« Ouvertes » / « Terminées »), then its appointments to come and past, each opened on the right.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppointmentItem, AppointmentList } from '@dp/contracts';
import { Button, Icon, StatusTag } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { staffLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { AppointmentDialog } from '../agenda/AppointmentDialog';
import { AppointmentPanel, STATUS_TONE } from '../agenda/AppointmentPanel';
import { useShell } from '../shell/ShellContext';
import { TasksBoard } from './TasksBoard';
import { enumLabel } from './task-parts';
import s from './tasks.module.css';

export interface DossierTasksProps {
  dossierId: string;
  dossierReference: string;
  clientId: string;
  /** PIP-090 — a finished dossier: reading only. */
  readOnly: boolean;
  /** Called after a change, so that the record refreshes its counters. */
  onChange?: () => void;
}

export function DossierTasks({ dossierId, dossierReference, clientId, readOnly, onChange }: DossierTasksProps) {
  const { timeZone, can } = useShell();
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const load = useCallback(async () => {
    if (!can('appointment.read')) return setAppointments([]);
    const [todo, up, past] = await Promise.all([
      adminCall<AppointmentList>('/admin/appointments', { query: { dossierId, view: 'to-report', pageSize: 25 } }),
      adminCall<AppointmentList>('/admin/appointments', { query: { dossierId, view: 'upcoming', pageSize: 25 } }),
      adminCall<AppointmentList>('/admin/appointments', { query: { dossierId, view: 'past', pageSize: 25 } }),
    ]);
    const all = [...(todo.ok ? todo.data.data : []), ...(up.ok ? up.data.data : []), ...(past.ok ? past.data.data : [])];
    setAppointments(all.filter((a, i) => all.findIndex((b) => b.id === a.id) === i));
  }, [dossierId, can]);
  useEffect(() => void load(), [load]);

  return (
    <div className={s.dossierTab}>
      <TasksBoard
        dossierId={dossierId}
        dossierReference={dossierReference}
        clientId={clientId}
        readOnly={readOnly}
        onChange={onChange}
        extraAction={
          !readOnly && can('appointment.manage') ? (
            <Button variant="secondary" size="S" onClick={() => setPlanning(true)}>
              <Icon name="calendar" size={16} />
              {t('ui.admin-agenda.create')}
            </Button>
          ) : null
        }
      />
      {appointments && appointments.length ? (
        <section className={s.surface} aria-labelledby="dossier-appointments">
          <h2 id="dossier-appointments" className={s.groupTitle}>
            {t('ui.admin-tasks.dossierAppointments')} <span className={s.groupCount}>{appointments.length}</span>
          </h2>
          <ul className={s.rows}>
            {appointments.map((a) => (
              <li key={a.id} className={[s.apptRow, a.id === open && s.rowOn].filter(Boolean).join(' ')}>
                <button type="button" className={s.rowMain} onClick={() => setOpen(a.id)}>
                  <span className={s.rowTitle}>
                    <span className={s.rowTitleText}>
                      {enumLabel('AppointmentType', a.type)}
                      {a.property ? ` · ${a.property.title}` : ''}
                    </span>
                  </span>
                  <span className={s.rowMeta}>
                    <span className={s.due}>{a.startsAt ? new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(a.startsAt)) : t('ui.admin-agenda.noSlotYet')}</span>
                    <span className={s.muted}>{a.staff ? staffLabel(a.staff.name) : ''}</span>
                  </span>
                </button>
                <StatusTag tone={STATUS_TONE[a.status] ?? 'neutral'}>{enumLabel('AppointmentStatus', a.status)}</StatusTag>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <AppointmentDialog
        open={planning}
        preset={{ clientId, clientName: null, dossierId }}
        onClose={() => setPlanning(false)}
        onDone={() => {
          setPlanning(false);
          void load();
          onChange?.();
        }}
      />
      <AppointmentPanel
        id={open}
        close={() => setOpen(null)}
        changed={() => {
          void load();
          onChange?.();
          router.refresh();
        }}
      />
    </div>
  );
}
