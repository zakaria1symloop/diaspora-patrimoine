'use client';
// TAC-040, TAC-044 — the window that creates an appointment. Opened from the agenda and from a record: `preset` fixes
// the client, and — from a considered property of a dossier — the dossier, the property and the type « Visite du bien ».
// The hour is typed in the zone of the place for a visit or a meeting at the office, otherwise in the adviser's zone;
// the window shows the same instant at the client's and at the adviser's (TRV-031). Warnings while typing never block
// (TAC-043): overlap in the adviser's agenda, outside working hours, early or late hour at the client's. A past date
// creates the appointment « Tenu », without e-mail (TAC-044). Without the client's e-mail: « Prévenez le client par
// téléphone. ».
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { APPOINTMENT_TYPES, type AgentPick, type AppointmentClientPick, type AppointmentWarnings } from '@dp/contracts';
import { Banner, Button, Icon, Modal, Skeleton } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { Checkbox, SelectInput, TextArea, TextInput, formStyles as f, useUnsavedGuard } from '../shell/forms';
import { useShell } from '../shell/ShellContext';
import { zoned } from '../tasks/TaskDialog';
import { enumLabel } from '../tasks/task-parts';
import s from './agenda.module.css';

type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export interface AppointmentPreset {
  clientId: string;
  clientName: string | null;
  dossierId?: string;
  /** A considered property of the dossier: the visit is about it (the type defaults to « Visite du bien »). */
  candidateId?: string;
  type?: AppointmentType;
}

export interface AppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  preset?: AppointmentPreset;
  /** A slot chosen on the agenda (`YYYY-MM-DD`, `HH:MM`, in the reader's zone). */
  presetDate?: string;
  presetTime?: string;
}

const TYPE_ICON: Record<AppointmentType, 'phone' | 'camera' | 'home' | 'building'> = { CALL: 'phone', VISIO: 'camera', PROPERTY_VISIT: 'home', OFFICE_MEETING: 'building' };

export function AppointmentDialog(props: AppointmentDialogProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={t('ui.admin-agenda.dialog.title')} closeLabel={t('ui.common.close')} width={720}>
      {props.open ? <AppointmentForm {...props} /> : null}
    </Modal>
  );
}

/** Wall-clock day and hour of an instant in a zone. */
export function wallClock(at: Date, timeZone: string): { date: string; time: string } {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const g = (k: string) => p.find((x) => x.type === k)?.value ?? '';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
}

/** « mar. 14 oct. · 14 h 30 (Paris) ». */
export function zoneLine(at: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(at);
  const hour = new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(at).replace(':', ' h ');
  return `${day} · ${hour} (${cityOf(timeZone)})`;
}
export const cityOf = (zone: string) => zone.split('/').pop()!.replace(/_/g, ' ');

function AppointmentForm({ onClose, onDone, preset, presetDate, presetTime }: AppointmentDialogProps) {
  const { shell, can, timeZone } = useShell();
  const officeZone = shell.calendar.timeZone;
  const next = useMemo(() => {
    const d = new Date(Date.now() + 24 * 3600_000);
    return wallClock(d, timeZone).date;
  }, [timeZone]);
  const [term, setTerm] = useState('');
  const [found, setFound] = useState<AppointmentClientPick[] | null>(null);
  const [client, setClient] = useState<AppointmentClientPick | null>(null);
  const [agents, setAgents] = useState<AgentPick[]>([]);
  const [v, setV] = useState({
    dossierId: preset?.dossierId ?? '',
    candidateId: preset?.candidateId ?? '',
    type: (preset?.type ?? (preset?.candidateId ? 'PROPERTY_VISIT' : 'CALL')) as AppointmentType,
    date: presetDate ?? next,
    time: presetTime ?? '10:00',
    duration: preset?.candidateId || preset?.type === 'PROPERTY_VISIT' ? 60 : 30,
    staffUserId: shell.user.id,
    location: '',
    meetingUrl: '',
    onBehalfContactId: '',
    hostName: '',
    hostPhone: '',
    clientNote: '',
    internalNote: '',
    notifyClient: true,
  });
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [warnings, setWarnings] = useState<AppointmentWarnings | null>(null);
  useUnsavedGuard(dirty);
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => (setV((cur) => ({ ...cur, [k]: value })), setDirty(true));

  // The client fixed by the record, or searched by name, e-mail or phone
  const presetClient = preset?.clientId ?? null;
  useEffect(() => {
    if (!presetClient) return;
    void adminCall<{ data: AppointmentClientPick[] }>('/admin/appointments/pickers/clients', { query: { id: presetClient } }).then((r) => {
      if (r.ok && r.data.data[0]) setClient(r.data.data[0]);
      else if (!r.ok) setFailure(errorText(r));
    });
  }, [presetClient]);
  useEffect(() => {
    if (presetClient || client) return;
    const timer = setTimeout(() => {
      void adminCall<{ data: AppointmentClientPick[] }>('/admin/appointments/pickers/clients', { query: term.trim().length >= 2 ? { q: term.trim() } : {} }).then((r) => r.ok && setFound(r.data.data));
    }, 250);
    return () => clearTimeout(timer);
  }, [term, presetClient, client]);
  const manageAll = can('task.manage.all');
  useEffect(() => {
    if (manageAll) void adminCall<{ data: AgentPick[] }>('/admin/dossiers/pickers/agents').then((r) => r.ok && setAgents(r.data.data));
  }, [manageAll]);

  const dossier = client?.dossiers.find((d) => d.id === v.dossierId) ?? null;
  const candidates = dossier?.candidates ?? [];
  const candidate = candidates.find((c) => c.id === v.candidateId) ?? null;
  const onSite = v.type === 'PROPERTY_VISIT' || v.type === 'OFFICE_MEETING';
  // TRV-031 — the zone the hour is typed in
  const zone = v.type === 'PROPERTY_VISIT' ? (candidate?.countryTimezone ?? officeZone) : v.type === 'OFFICE_MEETING' ? officeZone : timeZone;
  const startsAt = useMemo(() => (v.date && /^\d\d:\d\d$/.test(v.time) ? zoned(v.date, v.time, zone) : null), [v.date, v.time, zone]);
  const past = startsAt ? startsAt.getTime() < Date.now() : false;
  const noEmail = client ? !client.email : false;

  // TAC-043 — warnings while typing
  useEffect(() => {
    if (!startsAt || Number.isNaN(startsAt.getTime()) || past) return setWarnings(null);
    const timer = setTimeout(() => {
      const endsAt = new Date(startsAt.getTime() + v.duration * 60_000);
      void adminCall<AppointmentWarnings>('/admin/appointments/warnings', { query: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), staffUserId: v.staffUserId, type: v.type, ...(client ? { clientId: client.id } : {}) } }).then((r) => setWarnings(r.ok ? r.data : null));
    }, 300);
    return () => clearTimeout(timer);
  }, [startsAt, past, v.duration, v.staffUserId, v.type, client]);

  function pickType(type: AppointmentType) {
    setV((cur) => ({ ...cur, type, duration: type === 'PROPERTY_VISIT' ? Math.max(cur.duration, 60) : cur.duration === 60 && cur.type === 'PROPERTY_VISIT' ? 30 : cur.duration, candidateId: type === 'PROPERTY_VISIT' ? cur.candidateId : '' }));
    setDirty(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!client) return setErrors({ clientId: t('ui.validation.REQUIRED') });
    setPending(true);
    setFailure(null);
    setErrors({});
    const r = await adminCall('/admin/appointments', {
      body: {
        clientId: client.id,
        dossierId: v.dossierId || null,
        candidateId: v.type === 'PROPERTY_VISIT' ? v.candidateId || null : null,
        type: v.type,
        date: v.date,
        time: v.time,
        durationMinutes: v.duration,
        zone,
        staffUserId: v.staffUserId,
        location: onSite ? v.location : null,
        meetingUrl: v.type === 'VISIO' ? v.meetingUrl : null,
        onBehalfContactId: v.type === 'PROPERTY_VISIT' ? v.onBehalfContactId || null : null,
        hostName: v.type === 'PROPERTY_VISIT' ? v.hostName : null,
        hostPhone: v.type === 'PROPERTY_VISIT' ? v.hostPhone : null,
        clientNote: v.clientNote,
        internalNote: v.internalNote,
        notifyClient: v.notifyClient && !noEmail && !past,
      },
    });
    setPending(false);
    if (r.ok) {
      setDirty(false);
      return onDone();
    }
    const fields = fieldErrors(r.error);
    if (Object.keys(fields).length) setErrors(fields);
    else setFailure(errorText(r));
  }

  if (preset && !client && !failure) {
    return (
      <div className={f.form}>
        <Skeleton height="2.5rem" />
        <Skeleton height="8rem" />
      </div>
    );
  }

  return (
    <form className={f.form} onSubmit={(e) => void submit(e)} noValidate>
      {failure ? <Banner tone="error">{failure}</Banner> : null}

      {/* Client */}
      {client ? (
        <div className={s.pickedClient}>
          <span className={s.avatar} aria-hidden="true">
            <Icon name="user" size={20} />
          </span>
          <span className={s.pickedText}>
            <strong>{client.name ?? preset?.clientName ?? '—'}</strong>
            <span className={f.muted}>{[client.email, client.phone, client.timezone ? cityOf(client.timezone) : null].filter(Boolean).join(' · ')}</span>
          </span>
          {!preset ? (
            <Button variant="secondary" size="S" onClick={() => (setClient(null), setV((cur) => ({ ...cur, dossierId: '', candidateId: '', onBehalfContactId: '' })))}>
              {t('ui.admin-agenda.dialog.changeClient')}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={s.clientSearch}>
          <TextInput label={t('ui.admin-agenda.field.client')} value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('ui.admin-agenda.field.clientPlaceholder')} error={errors.clientId} autoFocus autoComplete="off" />
          <ul className={s.clientResults} role="listbox" aria-label={t('ui.admin-agenda.field.client')}>
            {found === null ? (
              <li className={f.muted}>…</li>
            ) : found.length === 0 ? (
              <li className={f.muted}>{t('ui.admin-agenda.dialog.noClient')}</li>
            ) : (
              found.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className={s.clientOption}
                    onClick={() => {
                      setClient(c);
                      const live = c.dossiers.filter((d) => d.status === 'OPEN' || d.status === 'ON_HOLD');
                      if (live.length === 1) setV((cur) => ({ ...cur, dossierId: live[0]!.id }));
                      setDirty(true);
                    }}
                  >
                    <strong>{c.name ?? '—'}</strong>
                    <span className={f.muted}>{[c.email, c.dossiers.map((d) => d.reference).join(', ')].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {client ? (
        <>
          {/* Type */}
          <fieldset className={s.types}>
            <legend className={s.legend}>{t('ui.admin-agenda.field.type')}</legend>
            {APPOINTMENT_TYPES.map((type) => {
              const off = type === 'PROPERTY_VISIT' && !client.dossiers.some((d) => d.candidates.length > 0);
              return (
                <label key={type} className={[s.typeChip, v.type === type && s.typeOn, off && s.typeOff].filter(Boolean).join(' ')} title={off ? t('ui.admin-agenda.dialog.visitNeedsCandidate') : undefined}>
                  <input type="radio" name="type" value={type} checked={v.type === type} disabled={off} onChange={() => pickType(type)} />
                  <Icon name={TYPE_ICON[type]} size={20} />
                  {enumLabel('AppointmentType', type)}
                </label>
              );
            })}
          </fieldset>
          {!client.dossiers.some((d) => d.candidates.length > 0) ? <p className={s.note}>{t('ui.admin-agenda.dialog.visitNeedsCandidate')}</p> : null}

          {/* Dossier and property */}
          <div className={f.row}>
            <SelectInput label={t('ui.admin-agenda.field.dossier')} optional={v.type !== 'PROPERTY_VISIT'} value={v.dossierId} onChange={(e) => (set('dossierId', e.target.value), set('candidateId', ''))} error={errors.dossierId} disabled={Boolean(preset?.dossierId)}>
              <option value="">{t('ui.admin-agenda.field.noDossier')}</option>
              {client.dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.reference}
                </option>
              ))}
            </SelectInput>
            {v.type === 'PROPERTY_VISIT' ? (
              <SelectInput label={t('ui.admin-agenda.field.property')} value={v.candidateId} onChange={(e) => set('candidateId', e.target.value)} error={errors.candidateId} disabled={!dossier}>
                <option value="" disabled>
                  {dossier ? t('ui.admin-agenda.field.chooseProperty') : t('ui.admin-agenda.field.chooseDossierFirst')}
                </option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} — {c.reference}
                  </option>
                ))}
              </SelectInput>
            ) : (
              <span />
            )}
          </div>

          {/* When */}
          <div className={s.whenRow}>
            <TextInput label={t('ui.admin-agenda.field.date')} type="date" value={v.date} onChange={(e) => set('date', e.target.value)} error={errors.date} />
            <TextInput label={t('ui.admin-agenda.field.time')} type="time" step={300} value={v.time} onChange={(e) => set('time', e.target.value)} error={errors.time} hint={t('ui.admin-agenda.field.timeIn', { ville: cityOf(zone) })} />
            <SelectInput label={t('ui.admin-agenda.field.duration')} value={String(v.duration)} onChange={(e) => set('duration', Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {t('ui.admin-agenda.duration', { n: m })}
                </option>
              ))}
            </SelectInput>
          </div>
          {startsAt && !Number.isNaN(startsAt.getTime()) ? (
            <ul className={s.zones} aria-label={t('ui.admin-agenda.dialog.zones')}>
              {onSite ? <li><span>{t('ui.admin-agenda.zone.place')}</span><strong>{zoneLine(startsAt, zone)}</strong></li> : null}
              {client.timezone ? <li><span>{t('ui.admin-agenda.zone.client')}</span><strong>{zoneLine(startsAt, client.timezone)}</strong></li> : null}
              <li><span>{t('ui.admin-agenda.zone.me')}</span><strong>{zoneLine(startsAt, timeZone)}</strong></li>
            </ul>
          ) : null}
          {past ? <Banner tone="info">{t('ui.admin-agenda.dialog.past')}</Banner> : null}
          {warnings && (warnings.overlap || warnings.outsideHours || warnings.clientHour) ? (
            <div className={s.warnings} role="status">
              {warnings.overlap ? <p><Icon name="status-warning" size={16} />{t('ui.admin-agenda.warning.overlap', { debut: zoneLine(new Date(warnings.overlap.startsAt), timeZone) })}</p> : null}
              {warnings.outsideHours ? <p><Icon name="status-warning" size={16} />{t('ui.admin-agenda.warning.outsideHours')}</p> : null}
              {warnings.clientHour ? <p><Icon name="status-warning" size={16} />{t('ui.admin-agenda.warning.clientHour', { heure: warnings.clientHour })}</p> : null}
            </div>
          ) : null}

          {/* Who and where */}
          <div className={f.row}>
            {manageAll && agents.length ? (
              <SelectInput label={t('ui.admin-agenda.field.staff')} value={v.staffUserId} onChange={(e) => set('staffUserId', e.target.value)} error={errors.staffUserId}>
                {agents.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.absentUntil !== null && !a.me}>
                    {a.me ? t('ui.admin-tasks.assignee.me') : a.name}
                  </option>
                ))}
              </SelectInput>
            ) : null}
            {v.type === 'VISIO' ? <TextInput label={t('ui.admin-agenda.field.meetingUrl')} optional type="url" value={v.meetingUrl} onChange={(e) => set('meetingUrl', e.target.value)} error={errors.meetingUrl} placeholder="https://" /> : null}
            {onSite ? <TextInput label={t('ui.admin-agenda.field.location')} optional value={v.location} onChange={(e) => set('location', e.target.value)} error={errors.location} maxLength={200} /> : null}
          </div>
          {v.type === 'PROPERTY_VISIT' ? (
            <div className={s.hostBox}>
              <p className={s.legend}>{t('ui.admin-agenda.dialog.onSite')}</p>
              <div className={s.whenRow}>
                <TextInput label={t('ui.admin-agenda.field.hostName')} optional value={v.hostName} onChange={(e) => set('hostName', e.target.value)} error={errors.hostName} maxLength={160} />
                <TextInput label={t('ui.admin-agenda.field.hostPhone')} optional type="tel" value={v.hostPhone} onChange={(e) => set('hostPhone', e.target.value)} error={errors.hostPhone} maxLength={20} />
                {client.contacts.length ? (
                  <SelectInput label={t('ui.admin-agenda.field.onBehalf')} optional value={v.onBehalfContactId} onChange={(e) => set('onBehalfContactId', e.target.value)}>
                    <option value="">{t('ui.admin-agenda.field.clientHimself')}</option>
                    {client.contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectInput>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={f.row}>
            <TextArea label={t('ui.admin-agenda.field.clientNote')} optional hint={t('ui.admin-agenda.field.clientNoteHint')} value={v.clientNote} onChange={(e) => set('clientNote', e.target.value)} maxLength={1000} rows={2} />
            <TextArea label={t('ui.admin-agenda.field.internalNote')} optional hint={t('ui.admin-agenda.field.internalNoteHint')} value={v.internalNote} onChange={(e) => set('internalNote', e.target.value)} maxLength={1000} rows={2} />
          </div>

          {past ? null : noEmail ? (
            <Banner tone="warning">{t('ui.admin-agenda.dialog.noEmail')}</Banner>
          ) : (
            <Checkbox label={t('ui.admin-agenda.field.notifyClient')} checked={v.notifyClient} onChange={(x) => set('notifyClient', x)} />
          )}
        </>
      ) : null}

      <div className={`${f.actions} ${f.actionsEnd}`}>
        <Button variant="secondary" size="M" onClick={onClose}>
          {t('ui.common.cancel')}
        </Button>
        <Button type="submit" variant="tool" size="M" pending={pending} disabled={!client || (v.type === 'PROPERTY_VISIT' && !v.candidateId)}>
          {past ? t('ui.admin-agenda.dialog.submitPast') : t('ui.admin-agenda.dialog.submit')}
        </Button>
      </div>
    </form>
  );
}
