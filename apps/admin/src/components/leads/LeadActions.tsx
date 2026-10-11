'use client';
// CRM-011, BO-047 — the actions of a request (EA-11). The API says what THIS reader may do on THIS request now
// (`lead.can`): an action his role does not hold is absent; one impossible in the current state is greyed and says why.
// The main action follows the state — « Prendre en charge » for a request to take, « Clôturer » for one in progress,
// « Restaurer » for an undesirable one, the two buttons of « À vérifier » —; the others sit in « ⋯ ». Every window names
// the request and says what will happen (TRV-095). After a gesture the record reads itself again.
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LEAD_MANUAL_OUTCOMES, type LeadAction, type LeadActionState, type LeadDetail } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Button, Menu, Modal, useToast, type MenuItem } from '@dp/ui';
import { adminCall, type CallResult } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { AdvisorSelect } from '../crm/AdvisorSelect';
import { FailureDetails } from '../shell/ReadFailure';
import { TextArea, formStyles as f } from '../shell/forms';
import { isDeliveredPath } from '../shell/menu';
import { signalShellChanged } from '../shell/ShellContext';
import s from './leads.module.css';

type Dialog = 'assign' | 'close' | 'release' | 'reopen' | 'spam' | 'restore' | 'openDossier' | 'attach' | null;

export function blockedReason(state: LeadActionState | undefined): string | null {
  if (!state || state.allowed) return null;
  const key = `ui.admin-leads.blocked.${state.reason}`;
  return hasMessage(key) ? t(key as MessageKey) : t('ui.admin-leads.blocked.default');
}

export function LeadActions({ lead }: { lead: LeadDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, setPending] = useState<string | null>(null);
  const can = lead.can;
  const allowed = (a: LeadAction) => can[a]?.allowed === true;

  const done = (text: string) => {
    toast({ text });
    setDialog(null);
    signalShellChanged();
    router.refresh();
  };

  /** A gesture without a window (take, the two buttons of the review). */
  const quick = async (key: string, path: string, body: unknown, success: string) => {
    setPending(key);
    const r = await adminCall(`/admin/leads/${lead.id}/${path}`, { body });
    setPending(null);
    if (r.ok) return done(success);
    toast({ tone: 'error', text: errorText(r), action: { label: t('ui.common.retry'), run: () => void quick(key, path, body, success) } });
    router.refresh();
  };

  // ─── The main action ──────────────────────────────────────────────────────
  let main: React.ReactNode = null;
  const mainKey = lead.needsReview && allowed('review') ? 'review' : allowed('take') ? 'take' : lead.status === 'SPAM' && allowed('restore') ? 'restore' : allowed('close') ? 'close' : allowed('reopen') ? 'reopen' : null;
  if (lead.needsReview && allowed('review')) {
    main = (
      <>
        <Button variant="secondary" size="M" icon="trash" pending={pending === 'reviewSpam'} onClick={() => void quick('reviewSpam', 'review', { verdict: 'SPAM' }, t('ui.admin-leads.toast.markedSpam'))}>
          {t('ui.admin-leads.action.reviewSpam')}
        </Button>
        <Button variant="tool" size="M" icon="check" pending={pending === 'reviewOk'} onClick={() => void quick('reviewOk', 'review', { verdict: 'LEGITIMATE' }, t('ui.admin-leads.toast.reviewed'))}>
          {t('ui.admin-leads.action.reviewLegitimate')}
        </Button>
      </>
    );
  } else if (allowed('take')) {
    main = (
      <Button variant="tool" size="M" icon="user" pending={pending === 'take'} onClick={() => void quick('take', 'take', undefined, t('ui.admin-leads.toast.taken'))}>
        {t('ui.admin-leads.action.take')}
      </Button>
    );
  } else if (lead.status === 'SPAM' && allowed('restore')) {
    main = (
      <Button variant="tool" size="M" icon="arrow-left" onClick={() => setDialog('restore')}>
        {t('ui.admin-leads.action.restore')}
      </Button>
    );
  } else if (allowed('close')) {
    main = (
      <Button variant="tool" size="M" icon="check" onClick={() => setDialog('close')}>
        {t('ui.admin-leads.action.close')}
      </Button>
    );
  } else if (allowed('reopen')) {
    main = (
      <Button variant="tool" size="M" icon="arrow-left" onClick={() => setDialog('reopen')}>
        {t('ui.admin-leads.action.reopen')}
      </Button>
    );
  }

  // ─── « ⋯ » ────────────────────────────────────────────────────────────────
  const items: MenuItem[] = [];
  const add = (action: LeadAction, label: string, icon: MenuItem['icon'], open: Dialog, extra: Partial<MenuItem> = {}) => {
    const state = can[action];
    if (!state) return;
    items.push({ key: action, label, icon, disabledReason: blockedReason(state), onSelect: () => setDialog(open), ...extra });
  };
  if (mainKey !== 'take' && allowed('take')) items.push({ key: 'take', label: t('ui.admin-leads.action.take'), icon: 'user', onSelect: () => void quick('take', 'take', undefined, t('ui.admin-leads.toast.taken')) });
  if (lead.status === 'NEW' || lead.status === 'IN_PROGRESS') add('assign', lead.agentId ? t('ui.admin-leads.action.reassign') : t('ui.admin-leads.action.assign'), 'partners', 'assign');
  if (lead.status === 'IN_PROGRESS') add('release', t('ui.admin-leads.action.release'), 'arrow-left', 'release');
  if (mainKey !== 'close' && (lead.status === 'NEW' || lead.status === 'IN_PROGRESS')) add('close', t('ui.admin-leads.action.close'), 'check', 'close');
  if (mainKey !== 'reopen' && lead.status === 'CLOSED') add('reopen', t('ui.admin-leads.action.reopen'), 'arrow-left', 'reopen');
  if (mainKey !== 'restore' && lead.status === 'SPAM') add('restore', t('ui.admin-leads.action.restore'), 'arrow-left', 'restore');
  add('openDossier', lead.followUp.pendingDecision ? t('ui.admin-leads.action.openSecondDossier') : t('ui.admin-leads.action.openDossier'), 'folder', 'openDossier', { separated: true });
  add('attach', t('ui.admin-leads.action.attach'), 'folder', 'attach');
  if (!lead.needsReview) add('spam', t('ui.admin-leads.action.spam'), 'trash', 'spam', { danger: true, separated: true });

  return (
    <>
      {main}
      {items.length ? <Menu label={t('ui.admin-leads.action.more')} items={items} /> : null}
      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={dialog ? t(`ui.admin-leads.dialog.${dialog}.title`, { reference: lead.reference }) : ''} closeLabel={t('ui.common.close')} width={dialog === 'close' || dialog === 'attach' ? 560 : 480}>
        {dialog === 'assign' ? <AssignForm lead={lead} close={() => setDialog(null)} done={done} /> : null}
        {dialog === 'close' ? <CloseForm lead={lead} close={() => setDialog(null)} done={done} /> : null}
        {dialog === 'attach' ? <AttachForm lead={lead} close={() => setDialog(null)} done={done} /> : null}
        {dialog === 'release' || dialog === 'reopen' || dialog === 'spam' || dialog === 'restore' || dialog === 'openDossier' ? <ConfirmForm kind={dialog} lead={lead} close={() => setDialog(null)} done={done} /> : null}
      </Modal>
    </>
  );
}

interface FormProps {
  lead: LeadDetail;
  close: () => void;
  done: (text: string) => void;
}

function useCall(done: (text: string) => void) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Extract<CallResult<unknown>, { ok: false }> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = async (call: () => Promise<CallResult<unknown>>, success: string | ((data: unknown) => string)) => {
    setPending(true);
    setFailure(null);
    setErrors({});
    const r = await call();
    setPending(false);
    if (r.ok) return done(typeof success === 'string' ? success : success(r.data));
    if (r.aborted) return;
    const fields = fieldErrors(r.error);
    if (Object.keys(fields).length) setErrors(fields);
    else setFailure(r);
  };
  const banner = failure ? (
    <Banner tone="error">
      <p>{errorText(failure)}</p>
      <FailureDetails failure={failure} />
    </Banner>
  ) : null;
  return { pending, errors, setErrors, run, banner };
}

function Buttons({ close, pending, label, danger, disabled }: { close: () => void; pending: boolean; label: string; danger?: boolean; disabled?: boolean }) {
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

function AssignForm({ lead, close, done }: FormProps) {
  const [agentId, setAgentId] = useState('');
  const { pending, errors, setErrors, run, banner } = useCall(done);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!agentId) return setErrors({ agentId: t('ui.validation.REQUIRED') });
    void run(() => adminCall(`/admin/leads/${lead.id}/assign`, { body: { agentId } }), t('ui.admin-leads.toast.assigned'));
  };
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      <p>{lead.agentName ? t('ui.admin-leads.dialog.assign.textReassign', { nom: lead.agentName }) : t('ui.admin-leads.dialog.assign.text')}</p>
      {banner}
      <AdvisorSelect value={agentId} onChange={setAgentId} error={errors.agentId} disableAbsent exclude={lead.agentId ? [lead.agentId] : []} hint={t('ui.admin-leads.dialog.assign.hint')} autoFocus />
      {lead.followUp.dossier ? <p className={f.muted}>{t('ui.admin-leads.dialog.assign.dossierFollows', { reference: lead.followUp.dossier.reference })}</p> : null}
      <Buttons close={close} pending={pending} label={t('ui.admin-leads.dialog.assign.submit')} />
    </form>
  );
}

function CloseForm({ lead, close, done }: FormProps) {
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const { pending, errors, setErrors, run, banner } = useCall(done);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!outcome) return setErrors({ outcome: t('ui.validation.REQUIRED') });
    void run(() => adminCall(`/admin/leads/${lead.id}/close`, { body: { outcome, note } }), t('ui.admin-leads.toast.closed'));
  };
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      <p>{t('ui.admin-leads.dialog.close.text')}</p>
      {banner}
      <fieldset className={s.choices} aria-describedby={errors.outcome ? 'close-outcome-error' : undefined}>
        <legend className={s.choicesLegend}>{t('ui.admin-leads.dialog.close.outcome')}</legend>
        {LEAD_MANUAL_OUTCOMES.map((o) => (
          <label key={o} className={[s.choice, outcome === o && s.choiceOn].filter(Boolean).join(' ')}>
            <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} />
            <span className={s.choiceText}>
              <strong>{t(`ui.enum.LeadOutcome.${o}` as MessageKey)}</strong>
              <span className={s.sub}>{t(`ui.admin-leads.outcomeHelp.${o}` as MessageKey)}</span>
            </span>
          </label>
        ))}
        {errors.outcome ? (
          <span id="close-outcome-error" className={s.choiceError}>
            {errors.outcome}
          </span>
        ) : null}
      </fieldset>
      <TextArea label={t('ui.admin-leads.dialog.close.note')} optional value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} error={errors.note} hint={t('ui.admin-leads.dialog.close.noteHint')} />
      {lead.followUp.dossier && (outcome === 'UNREACHABLE' || outcome === 'NOT_INTERESTED') ? (
        <Banner tone="info">{t('ui.admin-leads.dialog.close.dossierStays', { reference: lead.followUp.dossier.reference })}</Banner>
      ) : null}
      <Buttons close={close} pending={pending} label={t('ui.admin-leads.dialog.close.submit')} />
    </form>
  );
}

function AttachForm({ lead, close, done }: FormProps) {
  const [dossierId, setDossierId] = useState(lead.followUp.liveDossiers[0]?.id ?? '');
  const { pending, run, banner } = useCall(done);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => adminCall(`/admin/leads/${lead.id}/attach`, { body: { dossierId } }), (d) => t('ui.admin-leads.toast.attached', { reference: (d as { dossierReference: string }).dossierReference }));
  };
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      <p>{t('ui.admin-leads.dialog.attach.text')}</p>
      {banner}
      <div className={s.choices} role="radiogroup" aria-label={t('ui.admin-leads.dialog.attach.title', { reference: lead.reference })}>
        {lead.followUp.liveDossiers.map((d) => (
          <label key={d.id} className={[s.choice, dossierId === d.id && s.choiceOn].filter(Boolean).join(' ')}>
            <input type="radio" name="dossier" value={d.id} checked={dossierId === d.id} onChange={() => setDossierId(d.id)} />
            <span className={s.choiceText}>
              <strong>{d.reference}</strong>
              <span className={s.sub}>
                {t(`ui.enum.DossierStage.${d.stage}` as MessageKey)} · {t(`ui.enum.DossierStatus.${d.status}` as MessageKey)}
              </span>
            </span>
          </label>
        ))}
      </div>
      <Buttons close={close} pending={pending} label={t('ui.admin-leads.dialog.attach.submit')} disabled={!dossierId} />
    </form>
  );
}

function ConfirmForm({ kind, lead, close, done }: FormProps & { kind: 'release' | 'reopen' | 'spam' | 'restore' | 'openDossier' }) {
  const router = useRouter();
  const path = { release: 'release', reopen: 'reopen', spam: 'spam', restore: 'restore', openDossier: 'open-dossier' }[kind];
  const { pending, run, banner } = useCall((text) => {
    done(text);
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(
      () => adminCall(`/admin/leads/${lead.id}/${path}`, { method: 'POST' }),
      (data) => {
        if (kind === 'openDossier') {
          const ref = (data as { dossierReference: string }).dossierReference;
          if (isDeliveredPath('/dossiers')) setTimeout(() => router.push(`/dossiers/${ref.toLowerCase()}`), 600);
          return t('ui.admin-leads.toast.dossierOpened', { reference: ref });
        }
        return t(`ui.admin-leads.toast.${kind}` as MessageKey);
      },
    );
  };
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      <p>{t(`ui.admin-leads.dialog.${kind}.text` as MessageKey, { reference: lead.reference, nom: lead.agentName ?? '' })}</p>
      {banner}
      <Buttons close={close} pending={pending} label={t(`ui.admin-leads.dialog.${kind}.submit` as MessageKey)} danger={kind === 'spam'} />
    </form>
  );
}
