'use client';
// CRM-030, CRM-031 — « Noter un appel » / « Noter un échange » (WhatsApp or meeting), and COM-030 « Noter un e-mail
// reçu ». The outcome of a call is chosen among large cards; the moment defaults to now and never lies in the future;
// the report is required when the person was reached; « Me rappeler de… » creates a call task for its author.
import { useEffect, useState, type FormEvent } from 'react';
import { CALL_OUTCOMES, type ExchangeResult } from '@dp/contracts';
import type { MessageKey } from '@dp/i18n';
import { Banner, Button, Icon, Modal, useToast, type IconName } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { Checkbox, TextArea, TextInput, formStyles as f } from '../shell/forms';
import type { ExchangeTarget } from './ExchangeActions';
import s from './exchanges.module.css';

const OUTCOME_ICON: Record<string, IconName> = { REACHED: 'check', NO_ANSWER: 'phone', VOICEMAIL: 'mail', WRONG_NUMBER: 'status-error' };

/** `AAAA-MM-JJTHH:MM` of now, in the browser's time: the value of a `datetime-local` field. */
function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
const tomorrow = () => {
  const d = new Date(Date.now() + 86_400_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

interface Props {
  open: boolean;
  target: ExchangeTarget;
  close: () => void;
  done: () => void;
}

export function CallDialog({ open, mode, target, close, done }: Props & { mode: 'call' | 'exchange' }) {
  const toast = useToast();
  const [channel, setChannel] = useState<'CALL' | 'WHATSAPP' | 'MEETING'>('CALL');
  const [direction, setDirection] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');
  const [outcome, setOutcome] = useState<string>('');
  const [occurredAt, setOccurredAt] = useState(nowLocal);
  // « Maintenant » by default: an untouched field sends nothing and the API takes its own clock (a field of minutes would
  // otherwise place the call before a request created seconds ago, CYC-004)
  const [openedAt, setOpenedAt] = useState(nowLocal);
  const [duration, setDuration] = useState('');
  const [body, setBody] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [fu, setFu] = useState({ title: '', dueDate: tomorrow(), dueTime: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!open) return;
    setChannel(mode === 'call' ? 'CALL' : 'WHATSAPP');
    setDirection('OUTBOUND');
    setOutcome('');
    const now = nowLocal();
    setOccurredAt(now);
    setOpenedAt(now);
    setDuration('');
    setBody('');
    setFollowUp(false);
    setFu({ title: t('ui.admin-exchanges.call.followUpDefault', { nom: target.personName ?? '' }), dueDate: tomorrow(), dueTime: '' });
    setErrors({});
    setFailure(null);
    setKey(newIdempotencyKey());
  }, [open, mode, target.personName]);

  const isCall = channel === 'CALL';
  const reportRequired = !isCall || outcome === 'REACHED';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (isCall && !outcome) local.callOutcome = t('ui.validation.REQUIRED');
    if (reportRequired && !body.trim()) local.body = t('ui.admin-exchanges.call.reportRequired');
    if (occurredAt && new Date(occurredAt).getTime() > Date.now() + 60_000) local.occurredAt = t('ui.validation.DATE_IN_FUTURE');
    if (followUp && !fu.title.trim()) local['followUp.title'] = t('ui.validation.REQUIRED');
    if (Object.keys(local).length) return setErrors(local);
    setPending(true);
    setErrors({});
    setFailure(null);
    const r = await adminCall<ExchangeResult>('/admin/communications', {
      body: {
        leadId: target.leadId ?? null,
        clientId: target.leadId ? null : (target.clientId ?? null),
        dossierId: target.dossierId ?? null,
        channel,
        direction: isCall ? direction : 'OUTBOUND',
        callOutcome: isCall ? outcome : null,
        occurredAt: occurredAt && occurredAt !== openedAt ? new Date(occurredAt).toISOString() : null,
        durationMinutes: duration ? Number(duration) : null,
        body: body || null,
        followUp: followUp ? { title: fu.title, dueDate: fu.dueDate, dueTime: fu.dueTime || null } : null,
      },
      idempotencyKey: key,
    });
    setPending(false);
    if (!r.ok) {
      const fields = fieldErrors(r.error);
      if (Object.keys(fields).length) return setErrors(fields);
      return setFailure(errorText(r));
    }
    toast({ text: r.data.firstContact.leadIds.length ? t('ui.admin-exchanges.toast.firstContact') : t('ui.admin-exchanges.toast.noted') });
    done();
  }

  const title = isCall ? t('ui.admin-exchanges.call.title') : t('ui.admin-exchanges.exchange.title');
  return (
    <Modal open={open} onClose={close} title={title} closeLabel={t('ui.common.close')} width={720}>
      <form className={f.form} onSubmit={submit} noValidate>
        {target.personName ? <p className={s.who}>{t('ui.admin-exchanges.with', { nom: target.personName })}</p> : null}
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        {mode === 'exchange' ? (
          <div className={s.segmented} role="radiogroup" aria-label={t('ui.admin-exchanges.exchange.channel')}>
            {(['WHATSAPP', 'MEETING'] as const).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={channel === c} className={channel === c ? s.segOn : s.seg} onClick={() => setChannel(c)}>
                {t(`ui.enum.Channel.${c}` as MessageKey)}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={s.segmented} role="radiogroup" aria-label={t('ui.admin-exchanges.call.direction')}>
              {(['OUTBOUND', 'INBOUND'] as const).map((d) => (
                <button key={d} type="button" role="radio" aria-checked={direction === d} className={direction === d ? s.segOn : s.seg} onClick={() => setDirection(d)}>
                  {t(`ui.admin-exchanges.call.${d}` as MessageKey)}
                </button>
              ))}
            </div>
            <fieldset className={s.outcomes}>
              <legend className={s.legend}>{t('ui.admin-exchanges.call.outcome')}</legend>
              {CALL_OUTCOMES.map((o) => (
                <button key={o} type="button" aria-pressed={outcome === o} className={[s.outcome, outcome === o && s.outcomeOn, s[`outcome${o}`]].filter(Boolean).join(' ')} onClick={() => setOutcome(o)}>
                  <Icon name={OUTCOME_ICON[o] ?? 'phone'} size={20} />
                  <span>
                    <strong>{t(`ui.enum.CallOutcome.${o}` as MessageKey)}</strong>
                    <span className={s.outcomeHelp}>{t(`ui.admin-exchanges.call.help.${o}` as MessageKey)}</span>
                  </span>
                </button>
              ))}
              {errors.callOutcome ? <span className={s.error}>{errors.callOutcome}</span> : null}
            </fieldset>
          </>
        )}
        <div className={s.row}>
          <TextInput type="datetime-local" label={t('ui.admin-exchanges.call.when')} value={occurredAt} max={nowLocal()} onChange={(e) => setOccurredAt(e.target.value)} error={errors.occurredAt} />
          <TextInput type="number" inputMode="numeric" min={0} max={600} label={t('ui.admin-exchanges.call.duration')} optional value={duration} onChange={(e) => setDuration(e.target.value)} error={errors.durationMinutes} />
        </div>
        <TextArea label={t('ui.admin-exchanges.call.report')} optional={!reportRequired} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={5} error={errors.body} hint={t('ui.admin-exchanges.call.reportHint')} />
        <div className={s.followUp}>
          <Checkbox label={<strong>{t('ui.admin-exchanges.call.followUp')}</strong>} checked={followUp} onChange={setFollowUp} />
          {followUp ? (
            <div className={s.followUpFields}>
              <TextInput label={t('ui.admin-exchanges.call.followUpTitle')} value={fu.title} onChange={(e) => setFu({ ...fu, title: e.target.value })} maxLength={160} error={errors['followUp.title']} />
              <div className={s.row}>
                <TextInput type="date" label={t('ui.admin-exchanges.call.followUpDate')} value={fu.dueDate} onChange={(e) => setFu({ ...fu, dueDate: e.target.value })} error={errors['followUp.dueDate']} />
                <TextInput type="time" label={t('ui.admin-exchanges.call.followUpTime')} optional value={fu.dueTime} onChange={(e) => setFu({ ...fu, dueTime: e.target.value })} />
              </div>
            </div>
          ) : null}
        </div>
        <div className={`${f.actions} ${f.actionsEnd}`}>
          <Button variant="secondary" size="M" onClick={close}>
            {t('ui.common.cancel')}
          </Button>
          <Button type="submit" variant="tool" size="M" pending={pending}>
            {t('ui.admin-exchanges.call.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ReceivedEmailDialog({ open, target, close, done }: Props) {
  const toast = useToast();
  const [occurredAt, setOccurredAt] = useState(nowLocal);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!open) return;
    setOccurredAt(nowLocal());
    setSubject('');
    setBody('');
    setErrors({});
    setFailure(null);
  }, [open]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!subject.trim()) local.subject = t('ui.validation.REQUIRED');
    if (!body.trim()) local.body = t('ui.validation.REQUIRED');
    if (Object.keys(local).length) return setErrors(local);
    setPending(true);
    const r = await adminCall('/admin/communications/received-email', { body: { leadId: target.leadId ?? null, clientId: target.leadId ? null : (target.clientId ?? null), dossierId: target.dossierId ?? null, occurredAt: new Date(occurredAt).toISOString(), subject, body } });
    setPending(false);
    if (!r.ok) {
      const fields = fieldErrors(r.error);
      if (Object.keys(fields).length) return setErrors(fields);
      return setFailure(errorText(r));
    }
    toast({ text: t('ui.admin-exchanges.toast.received') });
    done();
  }
  return (
    <Modal open={open} onClose={close} title={t('ui.admin-exchanges.received.title')} closeLabel={t('ui.common.close')} width={720}>
      <form className={f.form} onSubmit={submit} noValidate>
        <p className={f.muted}>{t('ui.admin-exchanges.received.intro')}</p>
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <div className={s.row}>
          <TextInput type="datetime-local" label={t('ui.admin-exchanges.received.when')} value={occurredAt} max={nowLocal()} onChange={(e) => setOccurredAt(e.target.value)} error={errors.occurredAt} />
          <TextInput label={t('ui.admin-exchanges.received.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} error={errors.subject} />
        </div>
        <TextArea label={t('ui.admin-exchanges.received.body')} value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} rows={8} error={errors.body} />
        <div className={`${f.actions} ${f.actionsEnd}`}>
          <Button variant="secondary" size="M" onClick={close}>
            {t('ui.common.cancel')}
          </Button>
          <Button type="submit" variant="tool" size="M" pending={pending}>
            {t('ui.admin-exchanges.received.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
