'use client';
// TAC-041, TAC-042, TAC-045 — an appointment opened on the right of the agenda (or of a list): what, when in the three
// zones, with whom, where, who hosts on site; and its gestures, each written in the panel itself without leaving the
// agenda: confirm a request (one of the client's wishes or another slot), move, cancel (the word to the client is
// required to refuse a request), note it held or not held, correct the outcome within 7 days, change the place, the
// host or the notes. The buttons follow the abilities of the API: absent when the role cannot, greyed with the reason.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AppointmentItem, TaskAbility } from '@dp/contracts';
import { Banner, Button, Icon, Menu, Skeleton, StatusTag, useToast, type MenuItem, type StatusTone } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { staffLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Checkbox, SelectInput, TextArea, TextInput, formStyles as f } from '../shell/forms';
import { isDeliveredPath } from '../shell/menu';
import { useShell } from '../shell/ShellContext';
import { allowed, enumLabel, item, shown, whyNot } from '../tasks/task-parts';
import { cityOf, wallClock, zoneLine } from './AppointmentDialog';
import s from './agenda.module.css';

export const STATUS_TONE: Record<string, StatusTone> = { REQUESTED: 'pending', CONFIRMED: 'info', DONE: 'success', NO_SHOW: 'error', CANCELLED: 'inactive' };

type Mode = 'confirm' | 'reschedule' | 'cancel' | 'done' | 'correct' | 'edit' | null;

export function AppointmentPanel({ id, close, changed }: { id: string | null; close: () => void; changed: () => void }) {
  const toast = useToast();
  const { timeZone, can } = useShell();
  const [a, setA] = useState<AppointmentItem | null | 'failed'>(null);
  const [mode, setMode] = useState<Mode>(null);
  const load = useCallback(async () => {
    if (!id) return;
    const r = await adminCall<AppointmentItem>(`/admin/appointments/${id}`);
    setA(r.ok ? r.data : 'failed');
  }, [id]);
  useEffect(() => {
    setA(null);
    setMode(null);
    void load();
  }, [load]);
  const manage = can('appointment.manage');

  async function quick(path: string, success: string) {
    const r = await adminCall<AppointmentItem>(path, { method: 'POST', body: {} });
    if (!r.ok) return toast({ tone: 'error', text: errorText(r) });
    setA(r.data);
    toast({ text: success });
    changed();
  }

  const d = a && a !== 'failed' ? a : null;
  const onSite = d ? d.type === 'PROPERTY_VISIT' || d.type === 'OFFICE_MEETING' : false;
  const zone = d ? (onSite && d.placeTimezone ? d.placeTimezone : timeZone) : timeZone;
  const starts = d?.startsAt ? new Date(d.startsAt) : null;
  const menu: MenuItem[] = d
    ? [
        ...item(d.can.reschedule, { key: 'reschedule', label: t('ui.admin-agenda.action.reschedule'), icon: 'clock', onSelect: () => setMode('reschedule') }),
        ...item(d.can.edit, { key: 'edit', label: t('ui.admin-agenda.action.edit'), icon: 'edit', onSelect: () => setMode('edit') }),
        ...item(d.can.correct, { key: 'correct', label: t('ui.admin-agenda.action.correct'), icon: 'arrow-left', onSelect: () => setMode('correct') }),
        ...item(d.can.cancel, { key: 'cancel', label: d.status === 'REQUESTED' ? t('ui.admin-agenda.action.refuse') : t('ui.admin-agenda.action.cancel'), icon: 'close', danger: true, separated: true, onSelect: () => setMode('cancel') }),
      ]
    : [];

  return (
    <aside className={[s.panel, id && s.panelOpen].filter(Boolean).join(' ')} aria-label={t('ui.admin-agenda.panel')} hidden={!id}>
      <header className={s.panelHead}>
        <span className={s.panelKicker}>{d ? enumLabel('AppointmentType', d.type) : ''}</span>
        <Button variant="secondary" size="S" onClick={close} aria-label={t('ui.common.close')}>
          <Icon name="close" size={16} />
        </Button>
      </header>
      {a === null ? (
        <div className={s.panelBody}>
          <Skeleton height="2rem" />
          <Skeleton height="8rem" />
        </div>
      ) : a === 'failed' ? (
        <div className={s.panelBody}>
          <Banner tone="error">{t('ui.admin-agenda.notFound')}</Banner>
        </div>
      ) : d ? (
        <div className={s.panelBody}>
          <div>
            <h2 className={s.panelTitle}>{d.client.name ?? '—'}</h2>
            <p className={s.panelWhen}>{starts ? zoneLine(starts, zone) : t('ui.admin-agenda.noSlotYet')}</p>
          </div>
          <div className={s.panelTags}>
            <StatusTag tone={STATUS_TONE[d.status] ?? 'neutral'}>{enumLabel('AppointmentStatus', d.status)}</StatusTag>
            {d.status !== 'CANCELLED' && d.status !== 'DONE' && d.status !== 'NO_SHOW' ? <StatusTag tone={d.clientNotified ? 'success' : 'neutral'} icon={d.clientNotified ? 'mail' : undefined}>{d.clientNotified ? t('ui.admin-agenda.notified') : t('ui.admin-agenda.notNotified')}</StatusTag> : null}
          </div>

          {/* Main gesture first */}
          {manage && mode === null ? (
            <div className={s.panelActions}>
              {shown(d.can.confirm) ? <Primary ability={d.can.confirm} icon="check" label={t('ui.admin-agenda.action.confirm')} onClick={() => setMode('confirm')} /> : null}
              {shown(d.can.done) ? <Primary ability={d.can.done} icon="check" label={t('ui.admin-agenda.action.done')} onClick={() => setMode('done')} /> : null}
              {shown(d.can.noShow) ? (
                <Button variant="secondary" size="M" disabled={!allowed(d.can.noShow)} title={whyNot(d.can.noShow) ?? undefined} onClick={() => void quick(`/admin/appointments/${d.id}/no-show`, t('ui.admin-agenda.toast.noShow'))}>
                  {t('ui.admin-agenda.action.noShow')}
                </Button>
              ) : null}
              {menu.length ? <Menu label={t('ui.admin-agenda.more')} items={menu} /> : null}
            </div>
          ) : null}
          {mode ? <ModeForm mode={mode} a={d} zone={zone} cancel={() => setMode(null)} saved={(next, msg) => (setA(next), setMode(null), toast({ text: msg }), changed())} /> : null}

          {starts ? (
            <ul className={s.zones}>
              {onSite && d.placeTimezone ? <li><span>{t('ui.admin-agenda.zone.place')}</span><strong>{zoneLine(starts, d.placeTimezone)}</strong></li> : null}
              <li><span>{t('ui.admin-agenda.zone.client')}</span><strong>{zoneLine(starts, d.clientTimezone)}</strong></li>
              <li><span>{t('ui.admin-agenda.zone.me')}</span><strong>{zoneLine(starts, timeZone)}</strong></li>
            </ul>
          ) : d.requestedSlots.length ? (
            <div className={s.slots}>
              <p className={s.legend}>{t('ui.admin-agenda.wishes')}</p>
              <ul>
                {d.requestedSlots.map((w) => (
                  <li key={`${w.date}-${w.slot}`}>
                    {new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${w.date}T12:00:00Z`))} · {enumLabel('ContactTimeSlot', w.slot) ?? w.slot}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <dl className={s.facts}>
            <dt>{t('ui.admin-agenda.field.client')}</dt>
            <dd>{isDeliveredPath(`/clients/${d.client.id}`) ? <Link href={`/clients/${d.client.id}`} className={s.link}>{d.client.name ?? '—'}</Link> : (d.client.name ?? '—')}</dd>
            {d.dossier ? (
              <>
                <dt>{t('ui.admin-agenda.field.dossier')}</dt>
                <dd>
                  <Link href={`/dossiers/${d.dossier.reference.toLowerCase()}`} className={s.link}>
                    {d.dossier.reference}
                  </Link>
                </dd>
              </>
            ) : null}
            {d.property ? (
              <>
                <dt>{t('ui.admin-agenda.field.property')}</dt>
                <dd>
                  {d.property.title} <span className={f.muted}>{d.property.reference}</span>
                </dd>
              </>
            ) : null}
            <dt>{t('ui.admin-agenda.field.staff')}</dt>
            <dd>{d.staff ? staffLabel(d.staff.name) : '—'}</dd>
            {d.location ? (
              <>
                <dt>{t('ui.admin-agenda.field.location')}</dt>
                <dd>{d.location}</dd>
              </>
            ) : null}
            {d.meetingUrl ? (
              <>
                <dt>{t('ui.admin-agenda.field.meetingUrl')}</dt>
                <dd>
                  <a href={d.meetingUrl} target="_blank" rel="noreferrer" className={s.link}>
                    {d.meetingUrl.replace(/^https?:\/\//, '')}
                  </a>
                </dd>
              </>
            ) : null}
            {d.type === 'PROPERTY_VISIT' ? (
              <>
                <dt>{t('ui.admin-agenda.field.hostName')}</dt>
                <dd>{d.host.name ? `${d.host.name}${d.host.phone ? ` · ${d.host.phone}` : ''}` : <span className={f.muted}>{t('ui.admin-agenda.noHost')}</span>}</dd>
              </>
            ) : null}
            {d.onBehalf ? (
              <>
                <dt>{t('ui.admin-agenda.field.onBehalf')}</dt>
                <dd>{d.onBehalf}</dd>
              </>
            ) : null}
          </dl>
          {d.clientNote ? <Note title={t('ui.admin-agenda.field.clientNote')} text={d.clientNote} /> : null}
          {d.internalNote ? <Note title={t('ui.admin-agenda.field.internalNote')} text={d.internalNote} /> : null}
          {d.outcomeNote ? <Note title={t('ui.admin-agenda.field.outcomeNote')} text={d.outcomeNote} /> : null}
          {d.status === 'CANCELLED' ? <Note title={t(`ui.admin-agenda.cancelledBy.${d.cancelledBy ?? 'STAFF'}` as never)} text={d.cancelReason ?? t('ui.admin-agenda.noReason')} /> : null}
        </div>
      ) : null}
    </aside>
  );
}

function Primary({ ability, icon, label, onClick }: { ability: TaskAbility; icon: 'check'; label: string; onClick: () => void }) {
  return (
    <Button variant="tool" size="M" disabled={!allowed(ability)} title={whyNot(ability) ?? undefined} onClick={onClick}>
      <Icon name={icon} size={16} />
      {label}
    </Button>
  );
}

function Note({ title, text }: { title: string; text: string }) {
  return (
    <div className={s.note}>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function ModeForm({ mode, a, zone, cancel, saved }: { mode: Exclude<Mode, null>; a: AppointmentItem; zone: string; cancel: () => void; saved: (a: AppointmentItem, msg: string) => void }) {
  const start = a.startsAt ? wallClock(new Date(a.startsAt), zone) : { date: a.requestedSlots[0]?.date ?? '', time: ({ NOON: '12:00', AFTERNOON: '14:00', EVENING: '18:00' } as Record<string, string>)[a.requestedSlots[0]?.slot ?? ''] ?? '10:00' };
  const length = a.startsAt && a.endsAt ? Math.round((Date.parse(a.endsAt) - Date.parse(a.startsAt)) / 60_000) : a.type === 'PROPERTY_VISIT' ? 60 : 30;
  const [v, setV] = useState({
    date: start.date,
    time: start.time,
    duration: length,
    reason: '',
    clientWord: '',
    notifyClient: a.clientNotified,
    outcomeNote: '',
    to: 'DONE',
    location: a.location ?? '',
    meetingUrl: a.meetingUrl ?? '',
    hostName: a.host.name ?? '',
    hostPhone: a.host.phone ?? '',
    clientNote: a.clientNote ?? '',
    internalNote: a.internalNote ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }));
  const onSite = a.type === 'PROPERTY_VISIT' || a.type === 'OFFICE_MEETING';

  async function submit() {
    setPending(true);
    setErrors({});
    setFailure(null);
    const base = `/admin/appointments/${a.id}`;
    const call =
      mode === 'confirm'
        ? adminCall<AppointmentItem>(`${base}/confirm`, { body: { date: v.date, time: v.time, durationMinutes: Number(v.duration), zone, location: onSite ? v.location : null, meetingUrl: a.type === 'VISIO' ? v.meetingUrl : null } })
        : mode === 'reschedule'
          ? adminCall<AppointmentItem>(`${base}/reschedule`, { body: { date: v.date, time: v.time, durationMinutes: Number(v.duration), zone } })
          : mode === 'cancel'
            ? adminCall<AppointmentItem>(`${base}/cancel`, { body: { reason: v.reason, clientWord: v.clientWord, notifyClient: a.status === 'REQUESTED' ? true : v.notifyClient } })
            : mode === 'done'
              ? adminCall<AppointmentItem>(`${base}/done`, { body: { outcomeNote: v.outcomeNote } })
              : mode === 'correct'
                ? adminCall<AppointmentItem>(`${base}/correct-outcome`, { body: { to: v.to, reason: v.reason } })
                : adminCall<AppointmentItem>(base, { method: 'PATCH', body: { version: a.version, location: v.location, meetingUrl: a.type === 'VISIO' ? v.meetingUrl : undefined, hostName: a.type === 'PROPERTY_VISIT' ? v.hostName : undefined, hostPhone: a.type === 'PROPERTY_VISIT' ? v.hostPhone : undefined, clientNote: v.clientNote, internalNote: v.internalNote } });
    const r = await call;
    setPending(false);
    if (r.ok) return saved(r.data, t(`ui.admin-agenda.toast.${mode}` as never));
    const fields = fieldErrors(r.error);
    if (Object.keys(fields).length) setErrors(fields);
    else setFailure(errorText(r));
  }

  const ready = mode === 'correct' ? v.reason.trim().length > 0 : mode === 'cancel' && a.status === 'REQUESTED' ? v.clientWord.trim().length > 0 : mode === 'confirm' || mode === 'reschedule' ? Boolean(v.date && v.time) : true;
  return (
    <div className={s.modeBox}>
      <p className={s.legend}>{t(`ui.admin-agenda.mode.${mode}` as never)}</p>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      {mode === 'confirm' || mode === 'reschedule' ? (
        <>
          <div className={s.whenRow}>
            <TextInput label={t('ui.admin-agenda.field.date')} type="date" value={v.date} onChange={set('date')} error={errors.date} />
            <TextInput label={t('ui.admin-agenda.field.time')} type="time" step={300} value={v.time} onChange={set('time')} error={errors.time} hint={t('ui.admin-agenda.field.timeIn', { ville: cityOf(zone) })} />
            <SelectInput label={t('ui.admin-agenda.field.duration')} value={String(v.duration)} onChange={set('duration')}>
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {t('ui.admin-agenda.duration', { n: m })}
                </option>
              ))}
            </SelectInput>
          </div>
          {mode === 'confirm' && a.type === 'VISIO' ? <TextInput label={t('ui.admin-agenda.field.meetingUrl')} optional type="url" value={v.meetingUrl} onChange={set('meetingUrl')} error={errors.meetingUrl} /> : null}
          {mode === 'confirm' && onSite ? <TextInput label={t('ui.admin-agenda.field.location')} optional value={v.location} onChange={set('location')} error={errors.location} /> : null}
          {a.clientNotified || mode === 'confirm' ? <p className={f.muted}>{t('ui.admin-agenda.mode.clientInformed')}</p> : null}
        </>
      ) : null}
      {mode === 'cancel' ? (
        <>
          <TextInput label={t('ui.admin-agenda.field.cancelReason')} optional value={v.reason} onChange={set('reason')} error={errors.reason} maxLength={300} />
          {a.status === 'REQUESTED' ? <TextArea label={t('ui.admin-agenda.field.clientWord')} hint={t('ui.admin-agenda.field.clientWordHint')} value={v.clientWord} onChange={set('clientWord')} error={errors.clientWord} maxLength={1000} rows={3} /> : null}
          {a.status !== 'REQUESTED' && a.clientNotified ? <Checkbox label={t('ui.admin-agenda.field.notifyCancel')} checked={v.notifyClient} onChange={(x) => setV((cur) => ({ ...cur, notifyClient: x }))} /> : null}
          {a.status !== 'REQUESTED' && !a.clientNotified ? <p className={f.muted}>{t('ui.admin-agenda.mode.phoneClient')}</p> : null}
        </>
      ) : null}
      {mode === 'done' ? <TextArea label={t('ui.admin-agenda.field.outcomeNote')} optional hint={t('ui.admin-agenda.field.outcomeHint')} value={v.outcomeNote} onChange={set('outcomeNote')} maxLength={1000} rows={3} /> : null}
      {mode === 'correct' ? (
        <>
          <SelectInput label={t('ui.admin-agenda.field.correctTo')} value={v.to} onChange={set('to')}>
            {(['DONE', 'NO_SHOW', 'CANCELLED'] as const)
              .filter((x) => x !== a.status)
              .map((x) => (
                <option key={x} value={x}>
                  {enumLabel('AppointmentStatus', x)}
                </option>
              ))}
          </SelectInput>
          <TextInput label={t('ui.admin-agenda.field.correctReason')} value={v.reason} onChange={set('reason')} error={errors.reason} maxLength={300} />
        </>
      ) : null}
      {mode === 'edit' ? (
        <>
          {onSite ? <TextInput label={t('ui.admin-agenda.field.location')} optional value={v.location} onChange={set('location')} error={errors.location} maxLength={200} /> : null}
          {a.type === 'VISIO' ? <TextInput label={t('ui.admin-agenda.field.meetingUrl')} optional type="url" value={v.meetingUrl} onChange={set('meetingUrl')} error={errors.meetingUrl} /> : null}
          {a.type === 'PROPERTY_VISIT' ? (
            <div className={f.row}>
              <TextInput label={t('ui.admin-agenda.field.hostName')} optional value={v.hostName} onChange={set('hostName')} error={errors.hostName} maxLength={160} />
              <TextInput label={t('ui.admin-agenda.field.hostPhone')} optional type="tel" value={v.hostPhone} onChange={set('hostPhone')} error={errors.hostPhone} maxLength={20} />
            </div>
          ) : null}
          <TextArea label={t('ui.admin-agenda.field.clientNote')} optional value={v.clientNote} onChange={set('clientNote')} maxLength={1000} rows={2} />
          <TextArea label={t('ui.admin-agenda.field.internalNote')} optional value={v.internalNote} onChange={set('internalNote')} maxLength={1000} rows={2} />
        </>
      ) : null}
      <div className={s.panelActions}>
        <Button variant={mode === 'cancel' ? 'danger' : 'tool'} size="M" pending={pending} disabled={!ready} onClick={() => void submit()}>
          {t(`ui.admin-agenda.mode.${mode}Submit` as never)}
        </Button>
        <Button variant="secondary" size="M" onClick={cancel}>
          {t('ui.common.cancel')}
        </Button>
      </div>
    </div>
  );
}
