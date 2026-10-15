'use client';
// EC-14 — the client's appointments (INT-040 … INT-044). « À venir » then « Passés », each appointment drawn for what the
// client needs: its state, when (TRV-031: a visit on site in the place's time first, then his own if it differs; a
// video or a call in his time, then the adviser's), with whom, where or the video link, who visits; then its actions —
// « Modifier mes souhaits » and « Annuler » while requested, « Ajouter à mon agenda » and « Annuler » once confirmed,
// « Reprendre rendez-vous » after a missed one. « Demander un rendez-vous » (A.8, `features.clientAppointments`) opens a
// panel on the right (D-098): type, property, who visits, one to three wishes in his own zone, details.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ClientAppointment, ClientAppointments } from '@dp/contracts';
import { Button, ButtonInner, Icon, Modal, buttonClass } from '@dp/ui';
import { CheckboxField, SelectField, TextArea, TextField } from '@/components/forms/fields';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { EmptyState } from '../EmptyState';
import { PageHeader } from '../PageHeader';
import { signalSpaceChanged, useSpace } from '../SpaceContext';
import { writeToAdvisorHref } from '../advisor-link';
import { SidePanel } from '../kit/SidePanel';
import { longDate } from '../texts';
import k from '../kit/kit.module.css';
import sp from '../space.module.css';
import s from './appointments.module.css';

type Candidate = { id: string; title: string; reference: string };
type Contact = { id: string; fullName: string };
type RequestType = 'PROPERTY_VISIT' | 'VISIO' | 'CALL';
type Wish = { date: string; slot: string };
const SLOTS = ['MORNING', 'NOON', 'AFTERNOON', 'EVENING', 'ANYTIME'] as const;
const TYPES: RequestType[] = ['PROPERTY_VISIT', 'VISIO', 'CALL'];
const DAY = 86_400_000;

/** « 2026-10-14 » — the calendar day of an instant in a zone. */
const dayIn = (ms: number, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
/** « 14 h 30 » in a zone. */
const hourIn = (iso: string, timeZone: string) => new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)).replace(':', ' h ');
/** « heure : Algérie » — the CLDR generic name of the zone (as the callback label does), no grammar written by hand. */
function zoneName(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { timeZone, timeZoneName: 'shortGeneric' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}
/** « jeudi 15 octobre » — a calendar date, whatever the zone. */
const wishDay = (iso: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
const advisorOf = (a: ClientAppointment) => (a.advisor ? `${a.advisor.firstName}${a.advisor.lastInitial ? ` ${a.advisor.lastInitial}.` : ''}` : t('ui.client.nextStep.advisorFallback'));

/** TRV-031 — when, in the right zone first, then the other side's time when it differs. */
function whenLines(a: ClientAppointment): { date: string; time: string; other: string | null } | null {
  if (!a.startsAt) return null;
  const onSite = a.type === 'PROPERTY_VISIT' || a.type === 'OFFICE_MEETING';
  const first = onSite ? (a.placeTimezone ?? a.clientTimezone) : a.clientTimezone;
  const time = t('ui.client.appointments.time', { heure: hourIn(a.startsAt, first), zone: zoneName(first) });
  let other: string | null = null;
  if (onSite && first !== a.clientTimezone && hourIn(a.startsAt, first) !== hourIn(a.startsAt, a.clientTimezone)) {
    other = t('ui.client.appointments.timeElsewhere', { heure: hourIn(a.startsAt, a.clientTimezone) });
  } else if (!onSite && a.advisorTimezone && hourIn(a.startsAt, a.advisorTimezone) !== hourIn(a.startsAt, a.clientTimezone)) {
    other = t('ui.client.appointments.timeAdvisor', { heure: hourIn(a.startsAt, a.advisorTimezone), conseiller: advisorOf(a) });
  }
  return { date: longDate(a.startsAt, first), time, other };
}

export function AppointmentsBoard({ data, candidates, contacts, initialRequest }: { data: ClientAppointments; candidates: Candidate[]; contacts: Contact[]; initialRequest: string | null }) {
  const { summary, settings } = useSpace();
  const router = useRouter();
  const canRequest = settings.features.clientAppointments;
  const [panel, setPanel] = useState<null | { mode: 'new'; candidateId: string | null } | { mode: 'edit'; appointment: ClientAppointment }>(null);
  const [cancelling, setCancelling] = useState<ClientAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const ids = useId();

  // INT-004 « Demander une visite » from a property: `?demande=<candidat>` opens the panel on that property, once; the
  // address is cleaned so that reading the page again (after sending) does not open it a second time.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !canRequest || !initialRequest) return;
    opened.current = true;
    const known = candidates.some((c) => c.id === initialRequest);
    setPanel({ mode: 'new', candidateId: known ? initialRequest : null });
    router.replace('/espace-client/rendez-vous', { scroll: false });
  }, [canRequest, initialRequest, candidates, router]);

  const refresh = () => {
    signalSpaceChanged();
    router.refresh();
  };

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    const r = await apiCall<ClientAppointment>(`/client/appointments/${cancelling.id}/cancel`, { method: 'POST', body: { reason: cancelReason.trim() || null }, retryOnAuth: true });
    setBusy(false);
    if (r.ok) {
      showToast({ message: t('ui.client.appointments.cancelled', { conseiller: advisorOf(cancelling) }), tone: 'success' });
      setCancelling(null);
      setCancelReason('');
      refresh();
    } else {
      setCancelling(null);
      showToast({ message: t('ui.client.properties.answer.changed'), tone: 'info' });
      refresh();
    }
  }

  const requestButton = canRequest ? (
    <Button variant="tool" size="L" onClick={() => setPanel({ mode: 'new', candidateId: null })}>
      <Icon name="calendar" size={20} />
      {t('ui.client.appointments.request')}
    </Button>
  ) : null;
  const empty = data.upcoming.length === 0 && data.past.length === 0;

  return (
    <>
      <PageHeader title={t('ui.client.appointments.title')} intro={t('ui.client.appointments.intro')} actions={empty ? null : requestButton} />
      {empty ? (
        // INT-044
        <EmptyState
          icon="calendar"
          title={t('ui.client.appointments.emptyTitle')}
          text={canRequest ? t('ui.client.appointments.emptyText') : t('ui.client.appointments.emptyOff')}
          actions={
            canRequest ? (
              requestButton
            ) : (
              <Link href={writeToAdvisorHref({ from: 'ADVISOR' })} className={buttonClass('tool', 'M')}>
                <ButtonInner size="M">{t('ui.client.properties.write')}</ButtonInner>
              </Link>
            )
          }
        />
      ) : (
        <div className={s.columns}>
          <section aria-labelledby={`${ids}-up`} className={s.group}>
            <h2 id={`${ids}-up`} className={k.sectionTitle}>
              {t('ui.client.appointments.upcoming')} <span className={k.sectionCount}>{data.upcoming.length}</span>
            </h2>
            {data.upcoming.length === 0 ? <p className={s.none}>{t('ui.client.appointments.emptyTitle')}</p> : null}
            <ul className={s.list}>
              {data.upcoming.map((a, i) => (
                <AppointmentCard key={a.id} a={a} index={i} canRequest={canRequest} onEdit={() => setPanel({ mode: 'edit', appointment: a })} onCancel={() => setCancelling(a)} onResume={() => setPanel({ mode: 'new', candidateId: null })} />
              ))}
            </ul>
          </section>
          <section aria-labelledby={`${ids}-past`} className={s.group}>
            <h2 id={`${ids}-past`} className={k.sectionTitle}>
              {t('ui.client.appointments.past')} <span className={k.sectionCount}>{data.past.length}</span>
            </h2>
            {data.past.length === 0 ? <p className={s.none}>{t('ui.client.appointments.pastEmpty')}</p> : null}
            <ul className={s.list}>
              {data.past.map((a, i) => (
                <AppointmentCard key={a.id} a={a} index={i} canRequest={canRequest} onEdit={() => undefined} onCancel={() => undefined} onResume={() => setPanel({ mode: 'new', candidateId: null })} />
              ))}
            </ul>
          </section>
        </div>
      )}

      {panel ? (
        <RequestPanel
          key={panel.mode === 'edit' ? panel.appointment.id : `new-${panel.candidateId ?? ''}`}
          open
          mode={panel.mode}
          appointment={panel.mode === 'edit' ? panel.appointment : null}
          initialCandidate={panel.mode === 'new' ? panel.candidateId : null}
          candidates={candidates}
          contacts={contacts}
          timeZone={summary.timeZone}
          onClose={() => setPanel(null)}
          onDone={(message) => {
            setPanel(null);
            showToast({ message, tone: 'success' });
            refresh();
          }}
        />
      ) : null}

      {/* INT-042 */}
      <Modal
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={cancelling ? t('ui.client.appointments.cancelTitle', { date: cancelling.startsAt ? longDate(cancelling.startsAt, cancelling.placeTimezone ?? cancelling.clientTimezone) : wishDay(cancelling.requestedSlots[0]?.date ?? '') }) : ''}
        closeLabel={t('ui.client.appointments.form.close')}
        footer={
          <>
            <Button variant="secondary" size="M" onClick={() => setCancelling(null)} disabled={busy}>
              {t('ui.client.appointments.cancelKeep')}
            </Button>
            <Button variant="tool" size="M" onClick={() => void confirmCancel()} disabled={busy}>
              {t('ui.client.appointments.cancelConfirm')}
            </Button>
          </>
        }
      >
        <TextArea id={`${ids}-cr`} label={t('ui.client.appointments.cancelReason')} optional rows={2} maxLength={300} counter value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      </Modal>
    </>
  );
}

function AppointmentCard({ a, index, canRequest, onEdit, onCancel, onResume }: { a: ClientAppointment; index: number; canRequest: boolean; onEdit: () => void; onCancel: () => void; onResume: () => void }) {
  const when = whenLines(a);
  const conseiller = advisorOf(a);
  const tone = a.status === 'CONFIRMED' ? sp.tagSuccess : a.status === 'REQUESTED' ? sp.tagWarning : a.status === 'DONE' ? sp.tagInfo : sp.tagNeutral;
  const icon = a.type === 'CALL' ? 'phone' : a.type === 'VISIO' ? 'camera' : 'map-pin';
  const cancelledLine =
    a.status === 'CANCELLED'
      ? a.cancelledBy === 'CLIENT'
        ? t('ui.client.appointments.cancelledByClient')
        : a.cancelledBy === 'SYSTEM'
          ? t('ui.client.appointments.cancelledBySystem')
          : t('ui.client.appointments.cancelledByStaff', { conseiller })
      : null;
  return (
    <li className={[s.card, k.enter, a.status === 'CONFIRMED' && s.cardConfirmed].filter(Boolean).join(' ')} style={{ ['--i' as string]: index }} data-appointment={a.status} data-appointment-id={a.id}>
      <div className={s.date} aria-hidden="true">
        <Icon name={icon} size={24} />
      </div>
      <div className={s.body}>
        <div className={s.head}>
          <span className={`${sp.tag} ${tone}`}>{t(`ui.client.appointments.status.${a.status}`)}</span>
          <span className={s.type}>{t(`ui.client.appointments.type.${a.type}`)}</span>
        </div>
        {when ? (
          <p className={s.when}>
            <strong>{when.date}</strong> · {when.time}
            {when.other ? <span className={s.other}> — {when.other}</span> : null}
          </p>
        ) : null}
        {a.status === 'REQUESTED' && a.requestedSlots.length ? (
          <div className={s.wishes}>
            <span className={s.wishesTitle}>{t('ui.client.appointments.wishes')}</span>
            <ul>
              {a.requestedSlots.map((w) => (
                <li key={`${w.date}-${w.slot}`}>{t('ui.client.appointments.wishLine', { jour: wishDay(w.date), moment: t(`ui.enum.ContactTimeSlot.${w.slot}` as 'ui.enum.ContactTimeSlot.MORNING') })}</li>
              ))}
            </ul>
            <p className={s.pending}>{t('ui.client.appointments.pendingConfirm', { conseiller })}</p>
          </div>
        ) : null}
        <ul className={s.facts}>
          <li>
            <Icon name="user" size={16} />
            {t('ui.client.appointments.with', { conseiller })}
          </li>
          {a.property ? (
            <li>
              <Icon name="building" size={16} />
              {t('ui.client.appointments.about', { bien: a.property.title })}
            </li>
          ) : null}
          {a.location ? (
            <li>
              <Icon name="map-pin" size={16} />
              {t('ui.client.appointments.place', { lieu: a.location })}
            </li>
          ) : null}
          {a.host ? (
            <li>
              <Icon name="partners" size={16} />
              {t('ui.client.appointments.host', { nom: a.host.phone ? `${a.host.name} (${a.host.phone})` : a.host.name })}
            </li>
          ) : null}
          {a.visitor ? (
            <li>
              <Icon name="key" size={16} />
              {t('ui.client.appointments.visitor', { nom: a.visitor })}
            </li>
          ) : null}
        </ul>
        {cancelledLine ? (
          <p className={s.cancelled}>
            {cancelledLine}
            {a.cancelReason ? ` · ${t('ui.client.appointments.reason', { raison: a.cancelReason })}` : null}
          </p>
        ) : null}
        <div className={s.actions}>
          {a.status === 'CONFIRMED' && a.meetingUrl ? (
            <a href={a.meetingUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('tool', 'M')}>
              <ButtonInner size="M" icon="external-link">
                {t('ui.client.appointments.join')}
              </ButtonInner>
            </a>
          ) : null}
          {a.calendarPath ? (
            <a href={`/api/v1${a.calendarPath}`} className={buttonClass(a.meetingUrl ? 'secondary' : 'tool', 'M')} download>
              <ButtonInner size="M" icon="calendar">
                {t('ui.client.appointments.addCalendar')}
              </ButtonInner>
            </a>
          ) : null}
          {a.status === 'REQUESTED' ? (
            <button type="button" className={buttonClass('secondary', 'M')} onClick={onEdit}>
              <ButtonInner size="M" icon="edit">
                {t('ui.client.appointments.editWishes')}
              </ButtonInner>
            </button>
          ) : null}
          {a.status === 'NO_SHOW' ? (
            canRequest ? (
              <button type="button" className={buttonClass('tool', 'M')} onClick={onResume}>
                <ButtonInner size="M">{t('ui.client.appointments.resume')}</ButtonInner>
              </button>
            ) : (
              <Link href={writeToAdvisorHref({ from: 'APPOINTMENT_AGAIN' })} className={buttonClass('tool', 'M')}>
                <ButtonInner size="M">{t('ui.client.appointments.resume')}</ButtonInner>
              </Link>
            )
          ) : null}
          {a.canCancel ? (
            <button type="button" className={`${k.quiet} ${k.quietDanger}`} onClick={onCancel}>
              <Icon name="close" size={20} />
              {t('ui.client.appointments.cancel')}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function RequestPanel({
  open,
  mode,
  appointment,
  initialCandidate,
  candidates,
  contacts,
  timeZone,
  onClose,
  onDone,
}: {
  open: boolean;
  mode: 'new' | 'edit';
  appointment: ClientAppointment | null;
  initialCandidate: string | null;
  candidates: Candidate[];
  contacts: Contact[];
  timeZone: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const ids = useId();
  const { min, max } = useMemo(() => ({ min: dayIn(Date.now() + DAY, timeZone), max: dayIn(Date.now() + 60 * DAY, timeZone) }), [timeZone]);
  const [type, setType] = useState<RequestType>(initialCandidate || candidates.length ? 'PROPERTY_VISIT' : 'CALL');
  const [candidateId, setCandidateId] = useState<string>(initialCandidate ?? (candidates.length === 1 ? candidates[0]!.id : ''));
  const [visitor, setVisitor] = useState<string>('ME');
  const [other, setOther] = useState({ fullName: '', relation: '', phone: '', informed: false });
  const [wishes, setWishes] = useState<Wish[]>(appointment?.requestedSlots.length ? appointment.requestedSlots : [{ date: '', slot: '' }]);
  const [note, setNote] = useState(appointment?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const editing = mode === 'edit';
  const needsProperty = !editing && type !== 'CALL';
  const conseiller = appointment ? advisorOf(appointment) : t('ui.client.nextStep.advisorFallback');

  const setWish = (i: number, patch: Partial<Wish>) => setWishes((w) => w.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function localCheck(): Record<string, string> {
    const e: Record<string, string> = {};
    if (needsProperty && !candidateId) e.candidateId = t('ui.client.appointments.form.errors.REQUIRED');
    wishes.forEach((w, i) => {
      if (!w.date) e[`slots.${i}.date`] = t('ui.client.appointments.form.errors.REQUIRED');
      else if (w.date < min || w.date > max) e[`slots.${i}.date`] = t('ui.client.appointments.form.errors.OUT_OF_RANGE');
      if (!w.slot) e[`slots.${i}.slot`] = t('ui.client.appointments.form.errors.REQUIRED');
    });
    if (!editing && type === 'PROPERTY_VISIT' && visitor === 'OTHER') {
      if (other.fullName.trim().length < 2) e.otherName = t('ui.client.appointments.form.errors.REQUIRED');
      if (!other.informed) e.otherInformed = t('ui.client.profile.contacts.informedRequired');
    }
    return e;
  }

  async function submit() {
    const e = localCheck();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const slots = wishes.map((w) => ({ date: w.date, slot: w.slot }));
    if (editing && appointment) {
      const r = await apiCall<ClientAppointment>(`/client/appointments/${appointment.id}`, { method: 'PATCH', body: { slots, note: note.trim() || null }, retryOnAuth: true });
      setBusy(false);
      if (r.ok) return onDone(t('ui.client.appointments.form.saved'));
      return fail(r.error);
    }
    let onBehalfContactId: string | null = null;
    if (type === 'PROPERTY_VISIT' && visitor !== 'ME') {
      if (visitor === 'OTHER') {
        // INT-040 — « Une autre personne » is added to the profile (PRO-040) as someone who may visit for the client.
        const c = await apiCall<{ id: string }>('/client/contacts', {
          method: 'POST',
          body: { fullName: other.fullName.trim(), relation: other.relation.trim() || null, phone: other.phone.replace(/[\s.()-]/g, '') || null, email: null, canVisitOnBehalf: true, notes: null, informed: true },
          retryOnAuth: true,
        });
        if (!c.ok) {
          setBusy(false);
          setErrors({ otherPhone: t('ui.client.profile.fields.phoneHint') });
          return;
        }
        onBehalfContactId = c.data.id;
      } else onBehalfContactId = visitor;
    }
    const r = await apiCall<ClientAppointment>('/client/appointments', {
      method: 'POST',
      body: { type, candidateId: type === 'CALL' ? null : candidateId, onBehalfContactId, slots, note: note.trim() || null },
      retryOnAuth: true,
    });
    setBusy(false);
    if (r.ok) return onDone(t('ui.client.appointments.form.sent', { conseiller: advisorOf(r.data) }));
    fail(r.error);
  }

  function fail(error: { code?: string; reason?: string | null; details?: { field: string; code: string }[] } | null) {
    if (error?.reason === 'APPOINTMENT_PENDING') return setErrors({ candidateId: t('ui.client.appointments.form.errors.APPOINTMENT_PENDING') });
    if (error?.details?.length) {
      const e: Record<string, string> = {};
      for (const d of error.details) e[d.field] = d.code === 'OUT_OF_RANGE' ? t('ui.client.appointments.form.errors.OUT_OF_RANGE') : t('ui.client.appointments.form.errors.REQUIRED');
      return setErrors(e);
    }
    setErrors({ form: t('ui.client.appointments.form.errors.failed') });
  }

  return (
    <SidePanel open={open} onClose={onClose} title={editing ? t('ui.client.appointments.form.editTitle') : t('ui.client.appointments.form.title')}>
      <form
        className={s.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {!editing ? (
          <fieldset className={s.choices}>
            <legend className={s.legend}>{t('ui.client.appointments.form.type')}</legend>
            {TYPES.map((x) => (
              <label key={x} className={[s.choice, type === x && s.choiceOn].filter(Boolean).join(' ')}>
                <input type="radio" name={`${ids}-type`} value={x} checked={type === x} onChange={() => setType(x)} />
                <Icon name={x === 'CALL' ? 'phone' : x === 'VISIO' ? 'camera' : 'map-pin'} size={20} />
                {t(`ui.client.appointments.type.${x}`)}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className={s.formLead}>
            {t(`ui.client.appointments.type.${appointment!.type}`)}
            {appointment!.property ? ` · ${appointment!.property.title}` : ''}
          </p>
        )}

        {needsProperty ? (
          candidates.length ? (
            <SelectField id={`${ids}-p`} label={t('ui.client.appointments.form.property')} value={candidateId} onChange={(e) => setCandidateId(e.target.value)} error={errors.candidateId}>
              <option value="">{t('ui.client.appointments.form.propertyChoose')}</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </SelectField>
          ) : (
            <p className={s.hint} role="note">
              <Icon name="status-info" size={20} />
              {t('ui.client.appointments.form.noProperty')}
            </p>
          )
        ) : null}

        {!editing && type === 'PROPERTY_VISIT' ? (
          <fieldset className={s.choices}>
            <legend className={s.legend}>{t('ui.client.appointments.form.visitor')}</legend>
            {[{ id: 'ME', label: t('ui.client.appointments.form.me') }, ...contacts.map((c) => ({ id: c.id, label: c.fullName })), { id: 'OTHER', label: t('ui.client.appointments.form.other') }].map((o) => (
              <label key={o.id} className={[s.choice, visitor === o.id && s.choiceOn].filter(Boolean).join(' ')}>
                <input type="radio" name={`${ids}-v`} value={o.id} checked={visitor === o.id} onChange={() => setVisitor(o.id)} />
                {o.label}
              </label>
            ))}
          </fieldset>
        ) : null}
        {!editing && type === 'PROPERTY_VISIT' && visitor === 'OTHER' ? (
          <div className={s.other}>
            <p className={s.hintText}>{t('ui.client.appointments.form.otherHint')}</p>
            <TextField id={`${ids}-on`} label={t('ui.client.profile.contacts.fullName')} value={other.fullName} onChange={(e) => setOther({ ...other, fullName: e.target.value })} error={errors.otherName} />
            <TextField id={`${ids}-or`} label={t('ui.client.profile.contacts.relation')} optional value={other.relation} onChange={(e) => setOther({ ...other, relation: e.target.value })} />
            <TextField id={`${ids}-op`} type="tel" label={t('ui.client.profile.contacts.phone')} optional hint={t('ui.client.profile.fields.phoneHint')} value={other.phone} onChange={(e) => setOther({ ...other, phone: e.target.value })} error={errors.otherPhone} />
            <CheckboxField id={`${ids}-oi`} label={t('ui.client.profile.contacts.informed')} checked={other.informed} onChange={(v) => setOther({ ...other, informed: v })} error={errors.otherInformed} />
          </div>
        ) : null}

        <fieldset className={s.wishesForm}>
          <legend className={s.legend}>{t('ui.client.appointments.form.wishes')}</legend>
          <p className={s.hintText}>
            {t('ui.client.appointments.form.wishesHint')} {t('ui.client.appointments.form.zone', { fuseau: zoneName(timeZone) })}
          </p>
          {wishes.map((w, i) => (
            <div key={i} className={s.wishRow}>
              <span className={s.wishLabel}>{t('ui.client.appointments.form.wish', { n: i + 1 })}</span>
              <TextField id={`${ids}-d${i}`} type="date" label={t('ui.client.appointments.form.day')} min={min} max={max} value={w.date} onChange={(e) => setWish(i, { date: e.target.value })} error={errors[`slots.${i}.date`]} />
              <SelectField id={`${ids}-s${i}`} label={t('ui.client.appointments.form.moment')} value={w.slot} onChange={(e) => setWish(i, { slot: e.target.value })} error={errors[`slots.${i}.slot`]}>
                <option value="">{t('ui.client.appointments.form.moment')}</option>
                {SLOTS.map((x) => (
                  <option key={x} value={x}>
                    {t(`ui.enum.ContactTimeSlot.${x}`)}
                  </option>
                ))}
              </SelectField>
              {wishes.length > 1 ? (
                <button type="button" className={k.quiet} onClick={() => setWishes((ws) => ws.filter((_, j) => j !== i))}>
                  <Icon name="close" size={20} />
                  {t('ui.client.appointments.form.removeWish')}
                </button>
              ) : null}
            </div>
          ))}
          {wishes.length < 3 ? (
            <button type="button" className={k.quiet} onClick={() => setWishes((ws) => [...ws, { date: '', slot: '' }])}>
              <Icon name="plus" size={20} />
              {t('ui.client.appointments.form.addWish')}
            </button>
          ) : null}
        </fieldset>

        <TextArea id={`${ids}-n`} label={t('ui.client.appointments.form.note')} optional rows={3} maxLength={1000} counter value={note} onChange={(e) => setNote(e.target.value)} />
        {errors.form ? (
          <p className={s.formError} role="alert">
            <Icon name="status-error" size={16} />
            {errors.form}
          </p>
        ) : null}
        <div className={s.formActions}>
          <Button variant="tool" size="L" type="submit" disabled={busy || (needsProperty && candidates.length === 0)}>
            {editing ? t('ui.client.appointments.form.save') : t('ui.client.appointments.form.send')}
          </Button>
          <Button variant="secondary" size="L" onClick={onClose} disabled={busy}>
            {t('ui.client.appointments.form.cancel')}
          </Button>
        </div>
        {editing ? <p className={s.hintText}>{t('ui.client.appointments.pendingConfirm', { conseiller })}</p> : null}
      </form>
    </SidePanel>
  );
}
