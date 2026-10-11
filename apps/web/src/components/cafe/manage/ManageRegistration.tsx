'use client';
// EP-15 — CAF-030 … CAF-032: the state of the registration, its ticket, and the actions until the start of the Café —
// number of seats (CYC-187), questions and topics (« Enregistré. »), cancellation with its confirmation sentence and an
// optional reason (CYC-185), calendar file (CAF-050). « Donner mon avis » waits for the survey module (hidden).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { CAFE_CANCEL_REASON_MAX, CAFE_QUESTIONS_MAX, CAFE_TOPICS, isApiErrorBody, type ApiErrorBody, type CafeRegistrationView, type CafeTopic } from '@dp/contracts';
import { Button, Icon, buttonClass, ButtonInner } from '@dp/ui';
import { hasMessage } from '@dp/i18n';
import { CheckboxField, SelectField, TextArea } from '@/components/forms/fields';
import { QueryDialog } from '@/components/forms/QueryDialog';
import { eventDateParts } from '@/lib/events';
import { t } from '@/lib/i18n';
import { Ticket } from './Ticket';
import s from './manage.module.css';

const TOPIC_KEY = {
  PROGRAMS: 'ui.cafe.form.topicPrograms',
  FINANCING: 'ui.cafe.form.topicFinancing',
  ISLAMIC_FINANCING: 'ui.cafe.form.topicIslamic',
  PROCEDURES: 'ui.cafe.form.topicProcedures',
} as const satisfies Record<CafeTopic, string>;

type Result = { ok: true; view: CafeRegistrationView } | { ok: false; status: number; error: ApiErrorBody['error'] | null };

async function send(token: string, method: 'PATCH' | 'DELETE', body: unknown): Promise<Result> {
  try {
    const res = await fetch(`/api/v1/public/registrations/${encodeURIComponent(token)}`, {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (res.ok) return { ok: true, view: json as CafeRegistrationView };
    return { ok: false, status: res.status, error: isApiErrorBody(json) ? json.error : null };
  } catch {
    return { ok: false, status: 0, error: null };
  }
}

/** TRV-110 — the sentence of an error: a reason of CONFLICT_STATE when it has one, else the code. */
function errorText(r: Extract<Result, { ok: false }>): string {
  if (r.status === 0) return t('ui.common.offline');
  const e = r.error;
  if (!e) return t('ui.error.INTERNAL_ERROR', { identifiant: '—' });
  if (e.code === 'CONFLICT_STATE' && e.reason === 'NOT_ENOUGH_SEATS') return t('ui.cafe.form.onlyLeft', { n: Number((e.params as { n?: number } | null)?.n ?? 0) });
  if (e.code === 'CONFLICT_STATE' && e.reason && hasMessage(`ui.error.reason.${e.reason}`)) return t(`ui.error.reason.${e.reason}` as never);
  if (e.code === 'INTERNAL_ERROR') return t('ui.error.INTERNAL_ERROR', { identifiant: e.requestId });
  return hasMessage(`ui.error.${e.code}`) ? t(`ui.error.${e.code}` as never) : t('ui.error.BAD_REQUEST');
}

function Saved({ show }: { show: boolean }) {
  return (
    <span className={s.saved} role="status" aria-live="polite">
      {show ? (
        <>
          <Icon name="status-success" size={16} />
          {t('ui.cafe.manage.saved')}
        </>
      ) : null}
    </span>
  );
}

export function ManageRegistration({
  token,
  view: initial,
  brand,
  fullBrand,
  islamicEnabled,
  daysUntil,
}: {
  token: string;
  view: CafeRegistrationView;
  brand: string;
  fullBrand: string;
  islamicEnabled: boolean;
  daysUntil: number;
}) {
  const id = useId();
  const router = useRouter();
  const [view, setView] = useState(initial);
  useEffect(() => setView(initial), [initial]);

  const [seats, setSeats] = useState(initial.seats);
  const [seatsState, setSeatsState] = useState<{ pending: boolean; saved: boolean; error: string | null }>({ pending: false, saved: false, error: null });
  const [topics, setTopics] = useState<CafeTopic[]>(initial.topics);
  const [questions, setQuestions] = useState(initial.questions ?? '');
  const [answersState, setAnswersState] = useState<{ pending: boolean; saved: boolean; error: string | null }>({ pending: false, saved: false, error: null });
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelState, setCancelState] = useState<{ pending: boolean; error: string | null }>({ pending: false, error: null });

  const c = view.cafe;
  const dateLong = eventDateParts({ ...c, state: { kind: 'OPEN' }, hasPromoter: false, hasBank: false }).long;
  const a = view.actions;
  const upcoming = view.phase === 'UPCOMING' && view.status !== 'CANCELLED';

  const apply = (next: CafeRegistrationView) => {
    setView(next);
    setSeats(next.seats);
  };
  const gone = (r: Extract<Result, { ok: false }>) => {
    if (r.status === 410) router.refresh(); // the link no longer exists: the page shows « Ce lien a expiré »
  };

  async function saveSeats() {
    setSeatsState({ pending: true, saved: false, error: null });
    const r = await send(token, 'PATCH', { seats });
    if (r.ok) {
      apply(r.view);
      setSeatsState({ pending: false, saved: true, error: null });
      router.refresh();
      return;
    }
    gone(r);
    setSeatsState({ pending: false, saved: false, error: errorText(r) });
  }

  async function saveAnswers() {
    setAnswersState({ pending: true, saved: false, error: null });
    const r = await send(token, 'PATCH', { topics, questions: questions.trim() || null });
    if (r.ok) {
      setView(r.view);
      setAnswersState({ pending: false, saved: true, error: null });
      return;
    }
    gone(r);
    setAnswersState({ pending: false, saved: false, error: errorText(r) });
  }

  async function cancel() {
    setCancelState({ pending: true, error: null });
    const r = await send(token, 'DELETE', { reason: reason.trim() || null });
    if (r.ok) {
      apply(r.view);
      setConfirming(false);
      setCancelState({ pending: false, error: null });
      router.refresh(); // next Cafés appear
      requestAnimationFrame(() => document.getElementById('etat-inscription')?.focus());
      return;
    }
    gone(r);
    setCancelState({ pending: false, error: errorText(r) });
  }

  // ─── Heading by state (CAF-032) ───────────────────────────────────────────
  let title: string;
  let text: string | null = null;
  if (view.phase === 'EVENT_CANCELLED') {
    title = t('ui.cafe.manage.eventCancelled');
    text = c.cancelReason;
  } else if (view.phase === 'PAST') {
    title = t('ui.cafe.manage.past');
    text = t('ui.cafe.manage.pastText');
  } else if (view.status === 'CANCELLED') {
    title = t('ui.cafe.manage.cancelled');
    text = t('ui.cafe.manage.cancelledText');
  } else if (view.status === 'WAITLISTED') {
    title = t('ui.cafe.manage.waitlisted');
    text = t('ui.cafe.manage.waitlistedText');
  } else {
    title = t('ui.cafe.manage.registered', { n: view.seats });
  }
  const countdown =
    upcoming && daysUntil >= 0
      ? daysUntil === 0
        ? t('ui.cafe.manage.countdownToday')
        : daysUntil === 1
          ? t('ui.cafe.manage.countdownTomorrow')
          : t('ui.cafe.manage.countdownDays', { n: daysUntil })
      : null;

  const seatOptions = Array.from({ length: Math.max(1, a.maxSeats) }, (_, i) => i + 1);
  const hasActions = a.changeSeats || a.editAnswers || a.cancel;

  return (
    <section className={`container ${s.wrap}`} aria-labelledby="etat-inscription">
      <header className={s.head}>
        <p className={s.eyebrow}>
          <Icon name="cafe-cup" size={20} className={s.brandIcon} />
          {t('ui.cafe.manage.eyebrow')} · {brand}
        </p>
        <h1 id="etat-inscription" className={s.title} tabIndex={-1}>
          <span className={s.hello}>{t('ui.cafe.manage.hello', { prenom: view.firstName })},</span> {title}
        </h1>
        {text ? <p className={s.lead}>{text}</p> : null}
        <div className={s.headRow}>
          {countdown ? (
            <span className={s.countdown}>
              <span className={s.pulse} aria-hidden="true" />
              {countdown}
            </span>
          ) : null}
          {a.addToCalendar && view.icsUrl ? (
            <a href={view.icsUrl} className={buttonClass('secondary', 'M')} download>
              <ButtonInner size="M" icon="calendar">
                {t('ui.cafe.manage.calendar')}
              </ButtonInner>
            </a>
          ) : null}
          {a.reRegister ? (
            <Link href={`/le-cafe/${c.slug}#inscription`} className={buttonClass('primary', 'M')}>
              <ButtonInner size="M" chevron>
                {t('ui.cafe.manage.reRegister')}
              </ButtonInner>
            </Link>
          ) : null}
          {view.phase === 'PAST' ? (
            <Link href="/contact" className={buttonClass('secondary', 'M')}>
              <ButtonInner size="M" icon="mail">
                {t('ui.cafe.manage.contact')}
              </ButtonInner>
            </Link>
          ) : null}
          {/* SFA-040 — « Donner mon avis » joins here once the survey module exists (actions.feedback). */}
        </div>
      </header>

      <div className={[s.grid, !hasActions && s.gridSingle].filter(Boolean).join(' ')}>
        <div className={s.ticketCol}>
          <Ticket view={view} fullBrand={fullBrand} />
          <p className={s.onSite}>
            {upcoming ? <Icon name="chat" size={20} /> : null}
            {upcoming ? <span>{t('ui.cafe.page.questions')} ·</span> : null}
            <Link href={`/le-cafe/${c.slug}`} className={s.textLink}>
              {t('ui.cafe.manage.seeCafe')}
            </Link>
          </p>
        </div>

        {hasActions ? (
          <div className={s.actions} aria-label={t('ui.cafe.manage.actions')} role="region">
            {a.changeSeats ? (
              <div className={s.panel}>
                <h2 className={s.panelTitle}>{t('ui.cafe.manage.seatsTitle')}</h2>
                <p className={s.panelHelp}>{t('ui.cafe.manage.seatsHelp')}</p>
                <div className={s.inline}>
                  <SelectField
                    id={`${id}-seats`}
                    label={t('ui.cafe.form.seats')}
                    value={seats}
                    error={seatsState.error}
                    onChange={(e) => {
                      setSeats(Number(e.target.value));
                      setSeatsState({ pending: false, saved: false, error: null });
                    }}
                  >
                    {seatOptions.map((n) => (
                      <option key={n} value={n}>
                        {t('ui.cafe.form.seatsOption', { n })}
                      </option>
                    ))}
                  </SelectField>
                  <Button variant="secondary" size="M" onClick={() => void saveSeats()} pending={seatsState.pending} disabled={seats === view.seats}>
                    {t('ui.cafe.manage.save')}
                  </Button>
                </div>
                <Saved show={seatsState.saved} />
              </div>
            ) : null}

            {a.editAnswers ? (
              <div className={s.panel}>
                <h2 className={s.panelTitle}>{t('ui.cafe.manage.answersTitle')}</h2>
                <p className={s.panelHelp}>{t('ui.cafe.manage.answersHelp')}</p>
                <fieldset className={s.fieldset}>
                  <legend className={s.legend}>{t('ui.cafe.form.topics')}</legend>
                  <div className={s.topics}>
                    {CAFE_TOPICS.filter((tp) => islamicEnabled || tp !== 'ISLAMIC_FINANCING' || topics.includes(tp)).map((tp) => (
                      <CheckboxField
                        key={tp}
                        id={`${id}-topic-${tp}`}
                        label={t(TOPIC_KEY[tp])}
                        checked={topics.includes(tp)}
                        onChange={(x) => {
                          setTopics(x ? [...topics, tp] : topics.filter((y) => y !== tp));
                          setAnswersState({ pending: false, saved: false, error: null });
                        }}
                      />
                    ))}
                  </div>
                </fieldset>
                <TextArea
                  id={`${id}-questions`}
                  label={t('ui.cafe.form.questions')}
                  optional
                  maxLength={CAFE_QUESTIONS_MAX}
                  counter
                  rows={4}
                  value={questions}
                  error={answersState.error}
                  onChange={(e) => {
                    setQuestions(e.target.value);
                    setAnswersState({ pending: false, saved: false, error: null });
                  }}
                />
                <div className={s.inlineEnd}>
                  <Saved show={answersState.saved} />
                  <Button variant="secondary" size="M" onClick={() => void saveAnswers()} pending={answersState.pending}>
                    {t('ui.cafe.manage.save')}
                  </Button>
                </div>
              </div>
            ) : null}

            {a.cancel ? (
              <div className={`${s.panel} ${s.panelQuiet}`}>
                <h2 className={s.panelTitle}>{t('ui.cafe.manage.cancelTitle')}</h2>
                <p className={s.panelHelp}>{t('ui.cafe.manage.cancelHelp')}</p>
                <div>
                  <Button variant="tertiary" size="M" onClick={() => setConfirming(true)}>
                    {t('ui.cafe.manage.cancel')}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <QueryDialog open={confirming} onClose={() => setConfirming(false)} title={t('ui.cafe.manage.cancel')} closeLabel={t('ui.common.close')} width={480}>
        <div className={s.confirm}>
          <p className={s.confirmText}>{t('ui.cafe.manage.cancelConfirm', { date: dateLong })}</p>
          <TextArea
            id={`${id}-reason`}
            label={t('ui.cafe.manage.cancelReason')}
            optional
            rows={3}
            maxLength={CAFE_CANCEL_REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {cancelState.error ? (
            <p className={s.error} role="alert">
              <Icon name="status-error" size={16} />
              {cancelState.error}
            </p>
          ) : null}
          <div className={s.confirmButtons}>
            <Button variant="danger" size="M" onClick={() => void cancel()} pending={cancelState.pending}>
              {t('ui.cafe.manage.cancelYes')}
            </Button>
            <Button variant="secondary" size="M" onClick={() => setConfirming(false)}>
              {t('ui.cafe.manage.cancelNo')}
            </Button>
          </div>
        </div>
      </QueryDialog>
    </section>
  );
}
