'use client';
// EA-22 — the windows of a dossier (PIP-021, PIP-026, PIP-080 … PIP-082, CRM-050). A window that is hard to undo NAMES
// the dossier and says what will happen before it happens (TRV-095): the pause lists what keeps running, the closing
// lists what it cancels with the numbers, the stepping back says where it leads.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  HOLD_REASONS,
  LOST_REASONS,
  type AgentPick,
  type DossierDetail,
  type DossierEffects,
  type QualificationState,
  type TransitionCondition,
} from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Button, Icon, Modal, Skeleton, StatusTag, useToast } from '@dp/ui';
import { adminCall, type CallResult } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { shortDateTime, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Checkbox, SelectInput, TextArea, TextInput, formStyles as f } from '../shell/forms';
import { FailureDetails } from '../shell/ReadFailure';
import { ConflictNotice } from '../shell/ConflictNotice';
import { useShell } from '../shell/ShellContext';
import { enumLabel, RecordLink } from './parts';
import s from './dossiers.module.css';

type Failure = Extract<CallResult<unknown>, { ok: false }>;

/** What every window shares: the call, its pending state, its error above the form (TRV-114), field errors of a 422. */
export function useAction<T>(onDone: (data: T) => void, success: string | null) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = async (call: () => Promise<CallResult<T>>) => {
    setPending(true);
    setFailure(null);
    setErrors({});
    const r = await call();
    setPending(false);
    if (r.ok) {
      if (success) toast({ text: success });
      onDone(r.data);
      return true;
    }
    if (r.aborted) return false;
    const fields = fieldErrors(r.error);
    if (Object.keys(fields).length) setErrors(fields);
    else setFailure(r);
    return false;
  };
  const conflict = failure?.error?.code === 'CONFLICT_VERSION';
  // TRV-094 — who changed the dossier and when, « Recharger »
  const banner = failure ? (
    conflict ? (
      <ConflictNotice error={failure.error} onReload={() => window.location.reload()} />
    ) : (
      <Banner tone="error">
        <p>{errorText(failure)}</p>
        <FailureDetails failure={failure} />
      </Banner>
    )
  ) : null;
  return { pending, errors, setErrors, run, banner, failure };
}

export function Buttons({ close, pending, label, danger, disabled }: { close: () => void; pending: boolean; label: string; danger?: boolean; disabled?: boolean }) {
  return (
    <div className={`${f.actions} ${f.actionsEnd}`}>
      <Button variant="secondary" size="M" onClick={close}>
        {t('ui.common.cancel')}
      </Button>
      <Button type="submit" variant={danger ? 'danger' : 'tool'} size="M" pending={pending} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}

/** The advisers a dossier may be entrusted to (PIP-026), read once per window. */
export function useAgents(enabled: boolean): AgentPick[] | null {
  const [agents, setAgents] = useState<AgentPick[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void adminCall<{ data: AgentPick[] }>('/admin/dossiers/pickers/agents').then((r) => {
      if (alive) setAgents(r.ok ? r.data.data : []);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return agents;
}

export function AgentSelect({ value, onChange, agents, error, exclude, id }: { value: string; onChange: (v: string) => void; agents: AgentPick[] | null; error?: string; exclude?: string | null; id?: string }) {
  return (
    <SelectInput id={id} label={t('ui.admin-dossiers.field.agent')} value={value} onChange={(e) => onChange(e.target.value)} error={error} disabled={agents === null}>
      <option value="" disabled>
        {agents === null ? t('ui.common.loading') : t('ui.admin-dossiers.field.agentPlaceholder')}
      </option>
      {(agents ?? [])
        .filter((a) => a.id !== exclude)
        .map((a) => (
          // CRM-021 — an adviser whose absence is in progress cannot receive a dossier: greyed, and the line says until when
          <option key={a.id} value={a.id} disabled={a.absentUntil !== null}>
            {a.me ? t('ui.admin-dossiers.agent.me', { nom: a.name }) : a.name}
            {a.absentUntil ? ` — ${t('ui.admin-dossiers.agent.absent', { date: shortDay(a.absentUntil) })}` : ''}
          </option>
        ))}
    </SelectInput>
  );
}

// ─── The windows of the record ──────────────────────────────────────────────

export type DossierDialog = 'qualify' | 'hold' | 'resume' | 'close' | 'reopen' | 'moveBack' | 'delete' | 'assign' | null;

interface Props {
  dialog: DossierDialog;
  dossier: DossierDetail;
  close: () => void;
  /** The record after the change. */
  done: (next: DossierDetail) => void;
  deleted: () => void;
}

export function DossierDialogs({ dialog, dossier, close, done, deleted }: Props) {
  const title = dialog ? t(`ui.admin-dossiers.dialog.${dialog}.title`, { reference: dossier.reference }) : '';
  const wide = dialog === 'qualify' || dialog === 'close' || dialog === 'hold';
  return (
    <Modal open={dialog !== null} onClose={close} title={title} closeLabel={t('ui.common.close')} width={dialog === 'qualify' ? 720 : wide ? 560 : 480}>
      {dialog === 'qualify' ? <QualifyForm dossier={dossier} close={close} done={done} /> : null}
      {dialog === 'hold' ? <HoldForm dossier={dossier} close={close} done={done} /> : null}
      {dialog === 'resume' ? <ResumeForm dossier={dossier} close={close} done={done} /> : null}
      {dialog === 'close' ? <CloseForm dossier={dossier} close={close} done={done} /> : null}
      {dialog === 'reopen' || dialog === 'moveBack' ? <ReasonForm kind={dialog} dossier={dossier} close={close} done={done} /> : null}
      {dialog === 'delete' ? <DeleteForm dossier={dossier} close={close} deleted={deleted} /> : null}
      {dialog === 'assign' ? <AssignForm dossier={dossier} close={close} done={done} /> : null}
    </Modal>
  );
}

function useEffects(dossierId: string): DossierEffects | null | 'failed' {
  const [effects, setEffects] = useState<DossierEffects | null | 'failed'>(null);
  useEffect(() => {
    let alive = true;
    void adminCall<DossierEffects>(`/admin/dossiers/${dossierId}/effects`).then((r) => {
      if (alive) setEffects(r.ok ? r.data : 'failed');
    });
    return () => {
      alive = false;
    };
  }, [dossierId]);
  return effects;
}

// ─── Mettre en pause (PIP-080, CYC-031) ─────────────────────────────────────

function HoldForm({ dossier, close, done }: { dossier: DossierDetail; close: () => void; done: (d: DossierDetail) => void }) {
  const { timeZone } = useShell();
  const effects = useEffects(dossier.id);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [until, setUntil] = useState('');
  const [notify, setNotify] = useState(false);
  const [clientNote, setClientNote] = useState('');
  const { pending, errors, setErrors, run, banner } = useAction<DossierDetail>(done, t('ui.admin-dossiers.toast.held'));
  const waitingClient = reason === 'WAITING_CLIENT';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  const running = effects && effects !== 'failed' ? effects : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) return setErrors({ reason: t('ui.validation.REQUIRED') });
    void run(() =>
      adminCall<DossierDetail>(`/admin/dossiers/${dossier.id}/hold`, {
        body: { reason, note: note.trim() || null, until: until || null, notifyClient: waitingClient ? true : notify, clientNote: waitingClient ? clientNote.trim() || null : null },
      }),
    );
  }
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      {banner}
      <SelectInput label={t('ui.admin-dossiers.field.holdReason')} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} autoFocus>
        <option value="" disabled>
          {t('ui.admin-dossiers.field.choose')}
        </option>
        {HOLD_REASONS.map((r) => (
          <option key={r} value={r}>
            {enumLabel('HoldReason', r)}
          </option>
        ))}
      </SelectInput>
      <TextArea label={t('ui.admin-dossiers.field.note')} optional hint={t('ui.admin-dossiers.field.noteInternal')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} error={errors.note} />
      <TextInput label={t('ui.admin-dossiers.field.holdUntil')} optional type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} error={errors.until} hint={t('ui.admin-dossiers.field.holdUntilHint')} />
      {waitingClient ? (
        <TextArea label={t('ui.admin-dossiers.field.holdClientNote')} optional value={clientNote} onChange={(e) => setClientNote(e.target.value)} maxLength={300} rows={2} error={errors.clientNote} />
      ) : null}
      {dossier.client.email === null && !dossier.client.masked ? (
        <p className={f.muted}>{t('ui.admin-dossiers.hold.noEmail')}</p>
      ) : waitingClient ? (
        <p className={s.locked}>
          <Icon name="lock" size={16} />
          {t('ui.admin-dossiers.hold.notifyForced')}
        </p>
      ) : (
        <Checkbox label={t('ui.admin-dossiers.field.notifyClient')} checked={notify} onChange={setNotify} />
      )}
      <div className={s.effects}>
        <p className={s.effectsLead}>{t('ui.admin-dossiers.hold.frozen')}</p>
        {effects === null ? <Skeleton width="60%" /> : null}
        {running && (running.upcomingAppointments.length || running.reservation) ? (
          <>
            <p className={s.effectsTitle}>{t('ui.admin-dossiers.hold.running')}</p>
            <ul className={s.effectsList}>
              {running.reservation ? <li>{t('ui.admin-dossiers.hold.runningOption', { lot: running.reservation.lotReference, date: running.reservation.until ? shortDay(running.reservation.until.slice(0, 10)) : '—' })}</li> : null}
              {running.upcomingAppointments.map((a) => (
                <li key={a.id}>{t('ui.admin-dossiers.hold.runningAppointment', { date: shortDateTime(a.startsAt, timeZone) })}</li>
              ))}
            </ul>
            <p className={f.muted}>{t('ui.admin-dossiers.hold.runningNote')}</p>
          </>
        ) : null}
      </div>
      <Buttons close={close} pending={pending} label={t('ui.admin-dossiers.action.hold')} />
    </form>
  );
}

// ─── Reprendre (CYC-032) ────────────────────────────────────────────────────

function ResumeForm({ dossier, close, done }: { dossier: DossierDetail; close: () => void; done: (d: DossierDetail) => void }) {
  const { pending, run, banner } = useAction<DossierDetail>(done, t('ui.admin-dossiers.toast.resumed'));
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => adminCall<DossierDetail>(`/admin/dossiers/${dossier.id}/resume`, { method: 'POST' }));
      }}
    >
      <p>{t('ui.admin-dossiers.dialog.resume.text', { reference: dossier.reference })}</p>
      <p className={f.muted}>{t('ui.admin-dossiers.dialog.resume.effects')}</p>
      {banner}
      <Buttons close={close} pending={pending} label={t('ui.admin-dossiers.action.resume')} />
    </form>
  );
}

// ─── Clôturer (PIP-081, CYC-035) ────────────────────────────────────────────

const SILENT_REASONS = new Set(['DUPLICATE', 'CLIENT_WITHDREW']);

function CloseForm({ dossier, close, done }: { dossier: DossierDetail; close: () => void; done: (d: DossierDetail) => void }) {
  const effects = useEffects(dossier.id);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [touched, setTouched] = useState(false);
  const { pending, errors, setErrors, run, banner } = useAction<DossierDetail>(done, t('ui.admin-dossiers.toast.closed'));
  const e = effects && effects !== 'failed' ? effects : null;
  const hasEmail = e ? e.client.hasEmail : dossier.client.email !== null || dossier.client.masked;
  const informed = e?.upcomingAppointments.filter((a) => a.clientInformed).length ?? 0;

  // CYC-035 — ticked by default, except for « Doublon » and « Abandon du client », where the client already knows.
  useEffect(() => {
    if (!touched) setNotify(reason ? !SILENT_REASONS.has(reason) : true);
  }, [reason, touched]);

  function submit(ev: FormEvent) {
    ev.preventDefault();
    const next: Record<string, string> = {};
    if (!reason) next.reason = t('ui.validation.REQUIRED');
    if (reason === 'OTHER' && !note.trim()) next.note = t('ui.validation.REQUIRED');
    if (Object.keys(next).length) return setErrors(next);
    void run(() => adminCall<DossierDetail>(`/admin/dossiers/${dossier.id}/close`, { body: { reason, note: note.trim() || null, notifyClient: hasEmail ? notify : false } }));
  }
  const lines: string[] = [];
  if (e) {
    if (e.reservation) lines.push(t('ui.admin-dossiers.close.effect.reservation', { lot: e.reservation.lotReference }));
    if (e.submissions > 0) lines.push(t('ui.admin-dossiers.close.effect.submissions', { n: e.submissions }));
    if (e.openTasks > 0) lines.push(t('ui.admin-dossiers.close.effect.tasks', { n: e.openTasks }));
    if (e.upcomingAppointments.length > 0) lines.push(t('ui.admin-dossiers.close.effect.appointments', { n: e.upcomingAppointments.length }));
    if (informed > 0) lines.push(t('ui.admin-dossiers.close.effect.appointmentsMail', { n: informed, client: e.client.name ?? t('ui.admin-dossiers.theClient') }));
    if (e.openLeads > 0) lines.push(t('ui.admin-dossiers.close.effect.leads', { n: e.openLeads }));
  }
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      {banner}
      <SelectInput label={t('ui.admin-dossiers.field.lostReason')} value={reason} onChange={(ev) => setReason(ev.target.value)} error={errors.reason} hint={t('ui.admin-dossiers.close.reasonHint')} autoFocus>
        <option value="" disabled>
          {t('ui.admin-dossiers.field.choose')}
        </option>
        {LOST_REASONS.map((r) => (
          <option key={r} value={r}>
            {enumLabel('LostReason', r)}
          </option>
        ))}
      </SelectInput>
      <TextArea label={t('ui.admin-dossiers.field.note')} optional={reason !== 'OTHER'} value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={500} rows={2} error={errors.note} />
      <div className={s.effects}>
        <p className={s.effectsTitle}>{t('ui.admin-dossiers.close.effects')}</p>
        {effects === null ? <Skeleton width="70%" /> : null}
        {effects === 'failed' ? <p className={f.muted}>{t('ui.common.error.block')}</p> : null}
        {e ? (
          lines.length ? (
            <ul className={s.effectsList}>
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className={f.muted}>{t('ui.admin-dossiers.close.effect.none')}</p>
          )
        ) : null}
        <p className={f.muted}>{t('ui.admin-dossiers.close.reminders')}</p>
      </div>
      {hasEmail ? (
        <Checkbox
          label={t('ui.admin-dossiers.field.notifyClient')}
          checked={notify}
          onChange={(v) => {
            setTouched(true);
            setNotify(v);
          }}
        />
      ) : (
        <p className={f.muted}>{t('ui.admin-dossiers.close.noEmail')}</p>
      )}
      <Buttons close={close} pending={pending} label={t('ui.admin-dossiers.action.close')} danger />
    </form>
  );
}

// ─── Rouvrir · Reculer d'une étape (PIP-082) ────────────────────────────────

function ReasonForm({ kind, dossier, close, done }: { kind: 'reopen' | 'moveBack'; dossier: DossierDetail; close: () => void; done: (d: DossierDetail) => void }) {
  const [reason, setReason] = useState('');
  const { pending, errors, setErrors, run, banner } = useAction<DossierDetail>(done, t(kind === 'reopen' ? 'ui.admin-dossiers.toast.reopened' : 'ui.admin-dossiers.toast.movedBack'));
  const target = dossier.moveBackTarget ? enumLabel('DossierStage', dossier.moveBackTarget) : null;
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return setErrors({ reason: t('ui.validation.REQUIRED') });
        void run(() => adminCall<DossierDetail>(`/admin/dossiers/${dossier.id}/${kind === 'reopen' ? 'reopen' : 'move-back'}`, { body: { reason: reason.trim() } }));
      }}
    >
      {kind === 'reopen' ? (
        <>
          <p>{t('ui.admin-dossiers.dialog.reopen.text', { reference: dossier.reference })}</p>
          <p className={s.locked}>
            <Icon name="info" size={16} />
            {t('ui.admin-dossiers.dialog.reopen.nothingRestored')}
          </p>
        </>
      ) : (
        <>
          <p>{t('ui.admin-dossiers.dialog.moveBack.text', { reference: dossier.reference, de: enumLabel('DossierStage', dossier.stage) ?? '', vers: target ?? '' })}</p>
          <p className={f.muted}>{t('ui.admin-dossiers.dialog.moveBack.effects')}</p>
        </>
      )}
      {banner}
      <TextArea label={t('ui.admin-dossiers.field.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} error={errors.reason} autoFocus />
      <Buttons close={close} pending={pending} label={t(kind === 'reopen' ? 'ui.admin-dossiers.action.reopen' : 'ui.admin-dossiers.action.moveBack')} />
    </form>
  );
}

// ─── Supprimer (CYC-038, MOD-312) ───────────────────────────────────────────

function DeleteForm({ dossier, close, deleted }: { dossier: DossierDetail; close: () => void; deleted: () => void }) {
  const [reason, setReason] = useState('');
  const { pending, errors, setErrors, run, banner } = useAction<unknown>(deleted, t('ui.admin-dossiers.toast.deleted', { reference: dossier.reference }));
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return setErrors({ reason: t('ui.validation.REQUIRED') });
        void run(() => adminCall(`/admin/dossiers/${dossier.id}`, { method: 'DELETE', body: { reason: reason.trim() } }));
      }}
    >
      <p>{t('ui.admin-dossiers.dialog.delete.text', { reference: dossier.reference })}</p>
      <p className={f.muted}>{t('ui.admin-dossiers.dialog.delete.effects')}</p>
      {banner}
      <TextArea label={t('ui.admin-dossiers.field.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} error={errors.reason} autoFocus />
      <Buttons close={close} pending={pending} label={t('ui.admin-dossiers.action.delete')} danger />
    </form>
  );
}

// ─── Changer de conseiller (PIP-026, CYC-040) ───────────────────────────────

function AssignForm({ dossier, close, done }: { dossier: DossierDetail; close: () => void; done: (d: DossierDetail) => void }) {
  const agents = useAgents(true);
  const [agentId, setAgentId] = useState('');
  const [silent, setSilent] = useState(false);
  const { pending, errors, setErrors, run, banner } = useAction<DossierDetail>(done, t('ui.admin-dossiers.toast.assigned'));
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!agentId) return setErrors({ agentId: t('ui.validation.REQUIRED') });
        void run(() => adminCall<DossierDetail>(`/admin/dossiers/${dossier.id}/assign`, { body: { agentId, silent } }));
      }}
    >
      <p>{dossier.agent ? t('ui.admin-dossiers.dialog.assign.text', { reference: dossier.reference, nom: dossier.agent.name ?? t('ui.common.deletedUser') }) : t('ui.admin-dossiers.dialog.assign.textNone', { reference: dossier.reference })}</p>
      {banner}
      <AgentSelect value={agentId} onChange={setAgentId} agents={agents} error={errors.agentId} exclude={dossier.agent?.id} />
      <p className={f.muted}>{t('ui.admin-dossiers.dialog.assign.effects')}</p>
      {dossier.agent ? <Checkbox label={t('ui.admin-dossiers.field.silent')} checked={silent} onChange={setSilent} /> : null}
      <Buttons close={close} pending={pending} label={t('ui.admin-dossiers.dialog.assign.submit')} />
    </form>
  );
}

// ─── Marquer comme qualifié (CYC-021, CRM-050) ──────────────────────────────

type ClientValues = Record<'firstName' | 'lastName' | 'countryOfResidence' | 'residencyStatus' | 'budgetMax' | 'budgetCurrency' | 'budgetMonthly' | 'budgetMonthlyCurrency' | 'downPayment' | 'downPaymentCurrency' | 'financingPreference' | 'purchaseTimeframe', string>;

const EMPTY: ClientValues = { firstName: '', lastName: '', countryOfResidence: '', residencyStatus: '', budgetMax: '', budgetCurrency: '', budgetMonthly: '', budgetMonthlyCurrency: '', downPayment: '', downPaymentCurrency: '', financingPreference: '', purchaseTimeframe: '' };
const isAmount = (v: string) => /^\d{1,12}([.,]\d{1,2})?$/.test(v.trim());

/** True when what is typed in the window fulfils a condition the record does not fulfil yet. */
function completedHere(code: string, v: ClientValues, state: QualificationState): boolean {
  switch (code) {
    case 'CLIENT_NAME':
      return Boolean((v.firstName.trim() || state.client.firstName) && (v.lastName.trim() || state.client.lastName));
    case 'CLIENT_RESIDENCE_COUNTRY':
      return Boolean(v.countryOfResidence);
    case 'CLIENT_RESIDENCY_STATUS':
      return Boolean(v.residencyStatus);
    case 'CLIENT_BUDGET':
      return (isAmount(v.budgetMax) && Boolean(v.budgetCurrency)) || (isAmount(v.budgetMonthly) && Boolean(v.budgetMonthlyCurrency));
    case 'CLIENT_DOWN_PAYMENT':
      return isAmount(v.downPayment) && Boolean(v.downPaymentCurrency);
    case 'CLIENT_FINANCING_PREFERENCE':
      return Boolean(v.financingPreference);
    case 'CLIENT_TIMEFRAME':
      return Boolean(v.purchaseTimeframe);
    default:
      return false;
  }
}

function QualifyForm({ dossier, close, done }: { dossier: DossierDetail; close: () => void; done: (d: DossierDetail) => void }) {
  const { timeZone } = useShell();
  const [state, setState] = useState<QualificationState | null | 'failed'>(null);
  const [v, setV] = useState<ClientValues>(EMPTY);
  const { pending, errors, run, banner, failure } = useAction<DossierDetail>(done, t('ui.admin-dossiers.toast.qualified'));

  const load = () =>
    adminCall<QualificationState>(`/admin/dossiers/${dossier.id}/qualification`).then((r) => {
      if (!r.ok) return setState('failed');
      setState(r.data);
      const c = r.data.client;
      const first = r.data.currencies[0] ?? '';
      setV((cur) => ({ ...cur, budgetCurrency: cur.budgetCurrency || c.budgetCurrency || first, budgetMonthlyCurrency: cur.budgetMonthlyCurrency || c.budgetMonthlyCurrency || first, downPaymentCurrency: cur.downPaymentCurrency || c.downPaymentCurrency || first }));
    });
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossier.id]);

  // The API answered « il manque » although the window thought everything was there: the lines are read again.
  const refused = failure?.error?.reason === 'MISSING_CONDITIONS';
  useEffect(() => {
    if (refused) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refused]);

  const set = (k: keyof ClientValues) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }));
  const ready = state && state !== 'failed' ? state : null;
  const lines = useMemo(() => (ready ? ready.conditions.map((c) => ({ ...c, here: !c.met && completedHere(c.code, v, ready) })) : []), [ready, v]);
  const missing = lines.filter((c) => !c.met && !c.here);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || missing.length) return;
    const client: Record<string, string> = {};
    const want = new Set(lines.filter((c) => c.here).map((c) => c.code));
    if (want.has('CLIENT_NAME')) {
      if (v.firstName.trim()) client.firstName = v.firstName.trim();
      if (v.lastName.trim()) client.lastName = v.lastName.trim();
    }
    if (want.has('CLIENT_RESIDENCE_COUNTRY')) client.countryOfResidence = v.countryOfResidence;
    if (want.has('CLIENT_RESIDENCY_STATUS')) client.residencyStatus = v.residencyStatus;
    if (want.has('CLIENT_BUDGET')) {
      if (isAmount(v.budgetMax)) Object.assign(client, { budgetMax: v.budgetMax.trim(), budgetCurrency: v.budgetCurrency });
      if (isAmount(v.budgetMonthly)) Object.assign(client, { budgetMonthly: v.budgetMonthly.trim(), budgetMonthlyCurrency: v.budgetMonthlyCurrency });
    }
    if (want.has('CLIENT_DOWN_PAYMENT')) Object.assign(client, { downPayment: v.downPayment.trim(), downPaymentCurrency: v.downPaymentCurrency });
    if (want.has('CLIENT_FINANCING_PREFERENCE')) client.financingPreference = v.financingPreference;
    if (want.has('CLIENT_TIMEFRAME')) client.purchaseTimeframe = v.purchaseTimeframe;
    void run(() => adminCall<DossierDetail>(`/admin/dossiers/${dossier.id}/qualify`, { body: { version: dossier.version, client } }));
  }

  if (state === null)
    return (
      <div className={f.form}>
        <Skeleton height="2.5rem" />
        <Skeleton height="2.5rem" />
        <Skeleton height="2.5rem" />
      </div>
    );
  if (state === 'failed') return <Banner tone="error">{t('ui.common.error.block')}</Banner>;

  const currencySelect = (key: 'budgetCurrency' | 'budgetMonthlyCurrency' | 'downPaymentCurrency', label: string) => (
    <SelectInput label={label} value={v[key]} onChange={set(key)} error={errors[`client.${key}`]}>
      {state.currencies.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </SelectInput>
  );

  const field = (c: TransitionCondition): ReactNode => {
    switch (c.code) {
      case 'FIRST_CONTACT':
        return <p className={s.condHint}>{t('ui.admin-dossiers.qualify.firstContactHint')}</p>;
      case 'CLIENT_CONTACT_ALLOWED':
        return (
          <p className={s.condHint}>
            {t('ui.admin-dossiers.qualify.doNotContactHint')} <RecordLink href={`/clients/${dossier.client.id}`}>{t('ui.admin-dossiers.qualify.openClient')}</RecordLink>
          </p>
        );
      case 'CLIENT_NAME':
        return (
          <div className={f.row}>
            <TextInput label={t('ui.admin-dossiers.field.firstName')} value={v.firstName} onChange={set('firstName')} placeholder={state.client.firstName ?? undefined} maxLength={80} error={errors['client.firstName']} />
            <TextInput label={t('ui.admin-dossiers.field.lastName')} value={v.lastName} onChange={set('lastName')} placeholder={state.client.lastName ?? undefined} maxLength={80} error={errors['client.lastName']} />
          </div>
        );
      case 'CLIENT_RESIDENCE_COUNTRY':
        return (
          <SelectInput label={t('ui.admin-dossiers.field.country')} value={v.countryOfResidence} onChange={set('countryOfResidence')} error={errors['client.countryOfResidence']}>
            <option value="">{t('ui.admin-dossiers.field.choose')}</option>
            {state.countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        );
      case 'CLIENT_RESIDENCY_STATUS':
        return (
          <SelectInput label={t('ui.admin-dossiers.field.residencyStatus')} value={v.residencyStatus} onChange={set('residencyStatus')} error={errors['client.residencyStatus']}>
            <option value="">{t('ui.admin-dossiers.field.choose')}</option>
            {(['NON_RESIDENT', 'EXPATRIATE', 'RESIDENT', 'OTHER'] as const).map((r) => (
              <option key={r} value={r}>
                {t(`ui.admin-dossiers.residency.${r}`)}
              </option>
            ))}
          </SelectInput>
        );
      case 'CLIENT_BUDGET':
        return (
          <div className={s.condGrid}>
            <TextInput label={t('ui.admin-dossiers.field.budgetMax')} inputMode="decimal" value={v.budgetMax} onChange={set('budgetMax')} error={errors['client.budgetMax']} />
            {currencySelect('budgetCurrency', t('ui.admin-dossiers.field.currency'))}
            <TextInput label={t('ui.admin-dossiers.field.budgetMonthly')} inputMode="decimal" value={v.budgetMonthly} onChange={set('budgetMonthly')} error={errors['client.budgetMonthly']} />
            {currencySelect('budgetMonthlyCurrency', t('ui.admin-dossiers.field.currency'))}
          </div>
        );
      case 'CLIENT_DOWN_PAYMENT':
        return state.client.downPaymentWithheld ? (
          <p className={s.condHint}>{t('ui.admin-dossiers.qualify.downPaymentWithheld')}</p>
        ) : (
          <div className={s.condGrid}>
            <TextInput label={t('ui.admin-dossiers.field.downPayment')} inputMode="decimal" value={v.downPayment} onChange={set('downPayment')} hint={t('ui.admin-dossiers.field.downPaymentHint')} error={errors['client.downPayment']} />
            {currencySelect('downPaymentCurrency', t('ui.admin-dossiers.field.currency'))}
          </div>
        );
      case 'CLIENT_FINANCING_PREFERENCE':
        return (
          <SelectInput label={t('ui.admin-dossiers.field.financingPreference')} value={v.financingPreference} onChange={set('financingPreference')} error={errors['client.financingPreference']}>
            <option value="">{t('ui.admin-dossiers.field.choose')}</option>
            {(['CONVENTIONAL', 'ISLAMIC', 'NO_PREFERENCE', 'CASH'] as const).map((r) => (
              <option key={r} value={r}>
                {enumLabel('FinancingPreference', r)}
              </option>
            ))}
          </SelectInput>
        );
      case 'CLIENT_TIMEFRAME':
        return (
          <SelectInput label={t('ui.admin-dossiers.field.timeframe')} value={v.purchaseTimeframe} onChange={set('purchaseTimeframe')} error={errors['client.purchaseTimeframe']}>
            <option value="">{t('ui.admin-dossiers.field.choose')}</option>
            {(['LT_6M', 'M6_12', 'GT_12M', 'UNDEFINED'] as const).map((r) => (
              <option key={r} value={r}>
                {t(`ui.admin-dossiers.timeframe.${r}`)}
              </option>
            ))}
          </SelectInput>
        );
      default:
        return null;
    }
  };

  return (
    <form className={f.form} onSubmit={submit} noValidate>
      <p className={f.muted}>{t('ui.admin-dossiers.qualify.intro', { client: dossier.client.name ?? t('ui.admin-dossiers.theClient') })}</p>
      {banner}
      <ol className={s.condList}>
        {lines.map((c) => (
          <li key={c.code} className={[s.cond, c.met ? s.condMet : c.here ? s.condHere : s.condMissing].join(' ')} data-condition={c.code} data-state={c.met ? 'met' : c.here ? 'here' : 'missing'}>
            <div className={s.condHead}>
              <Icon name={c.met || c.here ? 'status-success' : 'status-warning'} size={16} />
              <span className={s.condLabel}>{conditionLabel(c.code)}</span>
              <StatusTag tone={c.met ? 'success' : c.here ? 'info' : 'warning'}>{t(c.met ? 'ui.admin-dossiers.qualify.done' : c.here ? 'ui.admin-dossiers.qualify.here' : 'ui.admin-dossiers.qualify.missing')}</StatusTag>
            </div>
            {c.code === 'FIRST_CONTACT' && c.met && state.firstContactAt ? <p className={s.condHint}>{t('ui.admin-dossiers.qualify.firstContactAt', { date: shortDateTime(state.firstContactAt, timeZone) })}</p> : null}
            {!c.met ? <div className={s.condBody}>{field(c)}</div> : null}
          </li>
        ))}
      </ol>
      {missing.length ? (
        <p className={s.condSummary} role="status">
          <Icon name="status-warning" size={16} />
          {t('ui.admin-dossiers.qualify.stillMissing', { liste: missing.map((c) => conditionLabel(c.code, false)).join(', ') })}
        </p>
      ) : null}
      <Buttons close={close} pending={pending} label={t('ui.admin-dossiers.action.qualify')} disabled={missing.length > 0} />
    </form>
  );
}

/** `ui.condition.{code}` — written as the end of « Il manque : … »; capitalised when it stands alone on a line. */
export function conditionLabel(code: string, capital = true): string {
  const key = `ui.condition.${code}`;
  const text = hasMessage(key) ? t(key as MessageKey) : code;
  return capital ? text.charAt(0).toLocaleUpperCase('fr') + text.slice(1) : text;
}
