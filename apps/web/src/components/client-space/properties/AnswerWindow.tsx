'use client';
// INT-020, INT-021, INT-030, INT-031 — the short windows of the client's answers on a property envisaged (D-099: the
// centred windows stay for short confirmations). « Ce bien m'intéresse » / « Finalement, il m'intéresse » take an
// optional comment; « Ce bien ne me convient pas » / « Ce bien ne m'intéresse plus » ask the reason (INT-021) and,
// when a visit is planned, have its cancellation confirmed (`VISIT_TO_CANCEL`, INT-004); « Je retiens ce bien » says
// what it means, offers the available lots when there are several and has the replacement of another pending choice
// confirmed (`SELECTION_PENDING`, INT-031). The form lives inside the window: it starts empty at every opening.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { DECLINE_REASONS, type CandidateCard as Card, type ClientCandidateAnswer, type ClientLotChoice } from '@dp/contracts';
import { Button, Icon, Modal } from '@dp/ui';
import { Banner, errorMessage } from '@/components/auth/kit';
import { TextArea } from '@/components/forms/fields';
import { apiCall } from '@/lib/auth-client';
import { money, surfaceText } from '@/lib/format';
import { t } from '@/lib/i18n';
import { dateTime, inSentence } from '../texts';
import s from './properties.module.css';

export type AnswerKind = 'interested' | 'interestedAgain' | 'decline' | 'declineFollowed' | 'select';

const ROUTE: Record<AnswerKind, string> = { interested: 'interested', interestedAgain: 'interested', decline: 'decline', declineFollowed: 'decline', select: 'select-request' };

interface WindowProps {
  card: Card;
  kind: AnswerKind | null;
  conseiller: string;
  timeZone: string;
  onClose: () => void;
  /** The answer is recorded: the card closes the window, says so and reloads the page's data. */
  onDone: () => void;
}

export function AnswerWindow(props: WindowProps) {
  const { kind, onClose } = props;
  return (
    <Modal open={kind !== null} onClose={onClose} title={kind ? t(`ui.client.properties.answer.${kind}`) : ''} closeLabel={t('ui.common.close')} width={560}>
      {kind ? <AnswerForm {...props} kind={kind} /> : null}
    </Modal>
  );
}

function lotLine(l: ClientLotChoice): { title: string; facts: string } {
  const floor = l.floor === null ? null : l.floor === 0 ? t('ui.client.properties.answer.lotGround') : t('ui.client.properties.answer.lotFloor', { n: l.floor });
  return { title: t('ui.client.properties.answer.lotLine', { reference: l.reference }), facts: [floor, surfaceText(l.surfaceM2, null), money(l.price)].filter(Boolean).join(' · ') };
}

function AnswerForm({ card, kind, conseiller, timeZone, onClose, onDone }: WindowProps & { kind: AnswerKind }) {
  const uid = useId();
  const declining = kind === 'decline' || kind === 'declineFollowed';
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState<(typeof DECLINE_REASONS)[number] | ''>('');
  const [note, setNote] = useState('');
  const [lotId, setLotId] = useState('');
  const [lots, setLots] = useState<ClientLotChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  /** INT-004 — the visit to come, whose cancellation the client confirms by sending again. */
  const [visitToCancel, setVisitToCancel] = useState<string | null>(null);
  /** INT-031 — the other property whose pending choice this one replaces, after confirmation. */
  const [otherChoice, setOtherChoice] = useState<string | null>(null);

  // INT-030 — the available lots (« Un lot vous attire en particulier ? » only when there are several). Not loaded:
  // the choice is sent without a lot, which stays optional.
  useEffect(() => {
    if (kind !== 'select') return;
    let live = true;
    void apiCall<{ data: ClientLotChoice[] }>(`/client/candidates/${card.id}/lots`, { retryOnAuth: true }).then((r) => {
      if (live && r.ok) setLots(r.data.data);
    });
    return () => {
      live = false;
    };
  }, [kind, card.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (declining && !reason) {
      setReasonError(t('ui.client.properties.answer.reasonRequired'));
      document.getElementById(`${uid}-reason-${DECLINE_REASONS[0]}`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const body =
      kind === 'select'
        ? { lotId: lotId || null, comment: comment.trim() || null, replace: otherChoice !== null }
        : declining
          ? { reason, note: note.trim() || null, cancelVisit: visitToCancel !== null }
          : { comment: comment.trim() || null };
    const res = await apiCall<ClientCandidateAnswer>(`/client/candidates/${card.id}/${ROUTE[kind]}`, { method: 'POST', body, retryOnAuth: true });
    setBusy(false);
    if (res.ok) return onDone();
    const params = (res.error?.params ?? {}) as Record<string, unknown>;
    if (res.error?.reason === 'VISIT_TO_CANCEL' && typeof params.date === 'string') return setVisitToCancel(params.date);
    if (res.error?.reason === 'SELECTION_PENDING' && typeof params.bien === 'string') return setOtherChoice(params.bien);
    setError(errorMessage(res.error, { offline: res.offline }));
  }

  const shownLots = lots.length > 1 ? lots : [];
  const submitLabel = visitToCancel
    ? t('ui.client.properties.answer.visitToCancelSend')
    : otherChoice
      ? t('ui.client.properties.answer.replaceSend')
      : kind === 'select'
        ? t('ui.client.properties.answer.selectSend')
        : t('ui.client.properties.answer.send');

  return (
    <form className={s.answerForm} onSubmit={(e) => void submit(e)} noValidate>
      <p className={s.answerProperty}>
        <Icon name="building" size={20} />
        {card.property.title}
      </p>
      {kind === 'select' ? (
        <p className={s.answerText}>
          {inSentence(t('ui.client.properties.answer.selectText', { conseiller }))} <strong>{t('ui.client.properties.answer.selectNoCommit')}</strong>
        </p>
      ) : null}

      {declining ? (
        <fieldset className={s.choices} aria-describedby={`${uid}-reason-hint${reasonError ? ` ${uid}-reason-error` : ''}`}>
          <legend>{t('ui.client.properties.answer.reason')}</legend>
          <p id={`${uid}-reason-hint`} className={s.choicesHint}>
            {inSentence(t('ui.client.properties.answer.reasonHint', { conseiller }))}
          </p>
          {DECLINE_REASONS.map((r) => (
            <label key={r} className={s.choice}>
              <input
                id={`${uid}-reason-${r}`}
                type="radio"
                name={`${uid}-reason`}
                value={r}
                checked={reason === r}
                onChange={() => (setReason(r), setReasonError(null))}
                aria-invalid={reasonError ? true : undefined}
              />
              <span>{t(`ui.enum.DeclineReason.${r}`)}</span>
            </label>
          ))}
          {reasonError ? (
            <p id={`${uid}-reason-error`} className={s.choiceError} role="alert">
              <Icon name="status-error" size={16} />
              {reasonError}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {kind === 'select' && shownLots.length ? (
        <fieldset className={s.choices}>
          <legend>
            {t('ui.client.properties.answer.lot')} <span className={s.optional}>{t('ui.common.optional')}</span>
          </legend>
          <label className={s.choice}>
            <input type="radio" name={`${uid}-lot`} value="" checked={lotId === ''} onChange={() => setLotId('')} />
            <span>{t('ui.client.properties.answer.lotNone')}</span>
          </label>
          {shownLots.map((l) => {
            const line = lotLine(l);
            return (
              <label key={l.id} className={s.choice}>
                <input type="radio" name={`${uid}-lot`} value={l.id} checked={lotId === l.id} onChange={() => setLotId(l.id)} />
                <span className={s.choiceText}>
                  <span>{line.title}</span>
                  {line.facts ? <span className={s.choiceSub}>{line.facts}</span> : null}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {declining ? (
        <TextArea id={`${uid}-note`} label={t('ui.client.properties.answer.note')} optional maxLength={500} counter rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      ) : (
        <TextArea
          id={`${uid}-comment`}
          label={kind === 'select' ? t('ui.client.properties.answer.selectComment') : t('ui.client.properties.answer.comment')}
          optional
          maxLength={1000}
          counter
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      )}

      {visitToCancel ? <Banner tone="info">{t('ui.client.properties.answer.visitToCancel', { date: dateTime(visitToCancel, timeZone).date })}</Banner> : null}
      {otherChoice ? <Banner tone="info">{t('ui.client.properties.answer.replace', { bien: otherChoice })}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      <div className={s.answerButtons}>
        <Button variant="secondary" size="M" onClick={onClose}>
          {t('ui.common.cancel')}
        </Button>
        <Button type="submit" variant="tool" size="M" pending={busy} disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
