'use client';
// EP-22, mode GUIDED (02-site-public/09). A conversation thread over ordinary forms (ASS-005): one question at a time,
// « Question {n} sur 5 », « Retour » under each question with the answer kept (ASS-002); the step is in the address
// (`?q=`, TRV-101), so the browser's Back button goes to the previous question. Every question has its neutral way out
// (ASS-003). The answers live in session storage (ASS-004): leaving and coming back resumes at the last question;
// « Recommencer » clears everything. The choices come from the API (published and available properties, given the
// earlier answers); no artificial wait; no movement when reduced motion is asked (ASS-005).
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  guidedAnswersToSearch,
  guidedQuestionNumber,
  guidedSteps,
  typeSlugToEnum,
  type GuidedAnswers,
  type GuidedQuestionsResponse,
  type GuidedResultsResponse,
  type GuidedStep,
  type PublicSettings,
} from '@dp/contracts';
import { formatMoney } from '@dp/i18n';
import { Button, Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import { TextArea } from '@/components/forms/fields';
import { GuidedResults } from './GuidedResults';
import s from './assistant.module.css';

/** Positions of the thread: the questions, then the free text (ASS-011), then the result (ASS-020). */
type Position = GuidedStep | 'precision' | 'results';
const Q_OF: Record<Position, string> = { region: '1', type: '2', rooms: '2bis', budget: '3', delivery: '4', purpose: '5', precision: 'precision', results: 'resultats' };
const POSITION_OF: Record<string, Position> = Object.fromEntries(Object.entries(Q_OF).map(([k, v]) => [v, k as Position]));

const STORAGE_KEY = 'dp_assistant';
interface Saved {
  answers: GuidedAnswers;
  precision: string;
  precisionDone: boolean;
}
const EMPTY: Saved = { answers: {}, precision: '', precisionDone: false };

function load(): Saved {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<Saved>;
    return { answers: v.answers ?? {}, precision: typeof v.precision === 'string' ? v.precision.slice(0, 500) : '', precisionDone: v.precisionDone === true };
  } catch {
    return EMPTY;
  }
}
function save(v: Saved): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable: the thread still works for this visit */
  }
}

function sequence(answers: GuidedAnswers): Position[] {
  return [...guidedSteps(answers), 'precision', 'results'];
}
function isAnswered(p: Position, v: Saved): boolean {
  if (p === 'precision') return v.precisionDone;
  if (p === 'results') return false;
  return v.answers[p] !== undefined;
}
/** The first position not answered yet: where a visitor coming back resumes (ASS-004). */
function firstOpen(v: Saved): Position {
  return sequence(v.answers).find((p) => !isAnswered(p, v)) ?? 'results';
}

const list = (items: string[]) => new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' }).format(items);

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function GuidedAssistant({ settings }: { settings: PublicSettings }) {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<Saved | null>(null);
  const [data, setData] = useState<{ key: string; value: GuidedQuestionsResponse } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const currentRef = useRef<HTMLDivElement>(null);
  const prefix = settings['display.roomsPrefix'];

  useEffect(() => setState(load()), []);

  const update = useCallback((next: Saved) => {
    save(next);
    setState(next);
  }, []);

  // The position asked by the address, never beyond the first open question (a shared or stale link resumes there).
  const position: Position | null = useMemo(() => {
    if (!state) return null;
    const seq = sequence(state.answers);
    const wanted = POSITION_OF[params.get('q') ?? ''] ?? null;
    const open = firstOpen(state);
    if (!wanted || !seq.includes(wanted)) return open;
    return seq.indexOf(wanted) <= seq.indexOf(open) ? wanted : open;
  }, [state, params]);

  // Keep the address in line with the position shown (replace: no extra history entry).
  useEffect(() => {
    if (!position) return;
    const q = params.get('q');
    if (q !== Q_OF[position] && !(q === null && position === 'region')) router.replace(`/assistant?q=${Q_OF[position]}`, { scroll: false });
  }, [position, params, router]);

  const search = state ? guidedAnswersToSearch(state.answers) : null;
  useEffect(() => {
    if (search === null) return;
    let live = true;
    setLoadError(false);
    fetch(`/api/v1/public/assistant/questions${search}`, { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<GuidedQuestionsResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((value) => live && setData({ key: search, value }))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, [search, attempt]);

  // The new question receives the focus (screen readers hear it), and comes into view.
  const lastPosition = useRef<Position | null>(null);
  useEffect(() => {
    if (!position || lastPosition.current === position) return;
    const first = lastPosition.current === null;
    lastPosition.current = position;
    if (first) return;
    const el = currentRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }, [position, data]);

  const go = useCallback((p: Position) => router.push(`/assistant?q=${Q_OF[p]}`, { scroll: false }), [router]);

  if (!state || !position) {
    return <div className={s.shell} aria-busy="true" />;
  }

  const seq = sequence(state.answers);
  const index = seq.indexOf(position);
  const previous = index > 0 ? seq[index - 1]! : null;
  const fresh = data && data.key === search ? data.value : null;
  const options = fresh ?? data?.value ?? null;

  const answer = (step: GuidedStep, value: GuidedAnswers[GuidedStep]) => {
    const answers = { ...state.answers, [step]: value } as GuidedAnswers;
    if (step === 'type' && !guidedSteps(answers).includes('rooms')) delete answers.rooms;
    update({ ...state, answers });
    const nextSeq = sequence(answers);
    go(nextSeq[nextSeq.indexOf(step) + 1]!);
  };

  const restart = () => {
    update(EMPTY);
    go('region');
  };

  const label = (p: Position): string => summary(p, state, options, prefix);
  const questionNumber = position === 'precision' || position === 'results' ? 5 : guidedQuestionNumber(position);
  const progress = position === 'results' ? 1 : position === 'precision' ? 5 / 5 : (questionNumber - 1) / 5;

  return (
    <div className={s.shell}>
      <div className={s.bar}>
        <div className={s.barText}>
          <span className={s.avatar} aria-hidden="true">
            <Icon name="sparkles" size={20} />
          </span>
          <p className={s.progressLabel} aria-live="polite">
            {t('ui.assistant.chat.progress', { n: questionNumber })}
          </p>
          {Object.keys(state.answers).length || state.precisionDone ? (
            <button type="button" className={s.restart} onClick={restart}>
              <Icon name="arrow-left" size={16} />
              {t('ui.assistant.chat.restart')}
            </button>
          ) : null}
        </div>
        <span className={s.progress} aria-hidden="true">
          <span className={s.progressFill} style={{ transform: `scaleX(${Math.max(progress, 0.04)})` }} />
        </span>
      </div>

      <ol className={s.thread} aria-label={t('ui.assistant.page.title')}>
        <Bubble who="assistant">{t('ui.assistant.chat.greeting')}</Bubble>
        {seq.slice(0, index).map((p) => (
          <li key={p} className={s.exchange}>
            <ol className={s.pair}>
              <Bubble who="assistant">{questionText(p)}</Bubble>
              <Bubble who="you">{label(p)}</Bubble>
            </ol>
          </li>
        ))}
        <li className={s.exchange}>
          {position === 'results' ? (
            <GuidedResults
              key={search}
              settings={settings}
              answers={state.answers}
              precision={state.precisionDone ? state.precision : ''}
              currentRef={currentRef}
              onRestart={restart}
            />
          ) : (
            <div ref={currentRef} tabIndex={-1} className={s.current}>
              {loadError && !options ? (
                <Bubble who="assistant" alone>
                  <span>{t('ui.assistant.chat.loadError')}</span>{' '}
                  <button type="button" className={s.inlineAction} onClick={() => setAttempt((n) => n + 1)}>
                    {t('ui.assistant.chat.retry')}
                  </button>
                </Bubble>
              ) : position === 'precision' ? (
                <PrecisionStep
                  initial={state.precision}
                  onSubmit={(precision) => {
                    update({ ...state, precision, precisionDone: true });
                    go('results');
                  }}
                  onBack={previous ? () => go(previous) : undefined}
                />
              ) : !fresh ? (
                <Bubble who="assistant" alone>
                  <span className={s.typing}>{t('ui.assistant.chat.loading')}</span>
                </Bubble>
              ) : (
                <QuestionStep
                  key={position}
                  step={position}
                  options={fresh}
                  value={state.answers[position]}
                  prefix={prefix}
                  onAnswer={(v) => answer(position, v)}
                  onBack={previous ? () => go(previous) : undefined}
                />
              )}
            </div>
          )}
        </li>
      </ol>
    </div>
  );
}

function Bubble({ who, children, alone }: { who: 'assistant' | 'you'; children: ReactNode; alone?: boolean }) {
  const Tag = alone ? 'div' : 'li';
  return (
    <Tag className={`${s.bubble} ${who === 'you' ? s.you : s.bot}`}>
      <span className="visually-hidden">{who === 'you' ? t('ui.assistant.chat.you') : t('ui.assistant.chat.assistant')} : </span>
      {children}
    </Tag>
  );
}

function questionText(p: Position): string {
  if (p === 'results') return '';
  return t(`ui.assistant.questions.${p}`);
}

function budgetLabel(kind: 'MONTHLY' | 'TOTAL', max: number, currency: string): string {
  const montant = formatMoney(max, currency, 'fr-FR', 0);
  return kind === 'MONTHLY' ? t('ui.assistant.choices.monthlyStep', { montant }) : t('ui.assistant.choices.totalStep', { montant });
}

function roomsLabel(r: string, prefix: string): string {
  return r === '5plus' ? t('ui.assistant.choices.roomsFivePlus', { prefix }) : t('ui.assistant.choices.rooms', { prefix, n: r });
}

/** The visitor's answer, as the message of the thread. */
function summary(p: Position, v: Saved, options: GuidedQuestionsResponse | null, prefix: string): string {
  const a = v.answers;
  const any = t('ui.assistant.choices.any');
  switch (p) {
    case 'region':
      return a.region === 'ANY' || !a.region ? any : list(a.region.map((slug) => options?.regions.find((r) => r.slug === slug)?.name ?? slug));
    case 'type':
      return a.type === 'ANY' || !a.type ? any : list(a.type.map((x) => t(`ui.enum.PropertyType.${typeSlugToEnum[x]}`)));
    case 'rooms':
      return a.rooms === 'ANY' || !a.rooms ? any : list(a.rooms.map((r) => roomsLabel(r, prefix)));
    case 'budget':
      return !a.budget || a.budget === 'UNKNOWN' ? t('ui.assistant.choices.unknown') : budgetLabel(a.budget.kind, a.budget.max, options?.currency ?? settingsCurrencyFallback);
    case 'delivery':
      return !a.delivery || a.delivery === 'ANY' ? any : t(`ui.assistant.choices.delivery.${a.delivery}`);
    case 'purpose':
      return !a.purpose || a.purpose === 'NO_ANSWER' ? t('ui.assistant.choices.noAnswer') : t(`ui.enum.PurchasePurpose.${a.purpose}`);
    case 'precision':
      return v.precision.trim() ? v.precision.trim() : t('ui.assistant.precision.none');
    default:
      return '';
  }
}
/** Only used before the first answer of the API arrives (the stored amount is in the reference currency, DEM-007). */
const settingsCurrencyFallback = 'EUR';

// ─── One question ────────────────────────────────────────────────────────────────────────────────────────────────

interface Choice {
  value: string;
  label: string;
}

function QuestionStep({
  step,
  options,
  value,
  prefix,
  onAnswer,
  onBack,
}: {
  step: GuidedStep;
  options: GuidedQuestionsResponse;
  value: GuidedAnswers[GuidedStep];
  prefix: string;
  onAnswer: (v: GuidedAnswers[GuidedStep]) => void;
  onBack?: () => void;
}) {
  const legendId = `assistant-${step}`;
  const [error, setError] = useState(false);
  const multiple = step === 'region' || step === 'type' || step === 'rooms';

  // Choices offered for this question (ASS-010) and its neutral way out (ASS-003).
  const monthlyOffered = options.monthlySteps !== null && options.monthlySteps.length > 0;
  const initialKind: 'MONTHLY' | 'TOTAL' = value && value !== 'UNKNOWN' && typeof value === 'object' && 'kind' in value ? value.kind : monthlyOffered ? 'MONTHLY' : 'TOTAL';
  const [kind, setKind] = useState<'MONTHLY' | 'TOTAL'>(monthlyOffered ? initialKind : 'TOTAL');

  const choices: Choice[] = useMemo(() => {
    switch (step) {
      case 'region':
        return options.regions.map((r) => ({ value: r.slug, label: r.name }));
      case 'type':
        return options.types.map((x) => ({ value: x, label: t(`ui.enum.PropertyType.${typeSlugToEnum[x]}`) }));
      case 'rooms':
        return options.rooms.map((r) => ({ value: r, label: roomsLabel(r, prefix) }));
      case 'budget': {
        const steps = kind === 'MONTHLY' ? (options.monthlySteps ?? []) : options.totalSteps;
        return steps.map((n) => ({ value: `${kind}:${n}`, label: budgetLabel(kind, n, options.currency) }));
      }
      case 'delivery':
        return options.delivery.map((d) => ({ value: d, label: t(`ui.assistant.choices.delivery.${d}`) }));
      case 'purpose':
        return options.purposes.map((p) => ({ value: p, label: t(`ui.enum.PurchasePurpose.${p}`) }));
    }
  }, [step, options, kind, prefix]);
  const neutral: Choice =
    step === 'budget'
      ? { value: 'UNKNOWN', label: t('ui.assistant.choices.unknown') }
      : step === 'purpose'
        ? { value: 'NO_ANSWER', label: t('ui.assistant.choices.noAnswer') }
        : { value: 'ANY', label: t('ui.assistant.choices.any') };

  // The kept answer, reduced to what is still offered (an earlier answer may have changed the list).
  const initial = useMemo(() => {
    if (value === undefined) return [];
    if (typeof value === 'string') return value === neutral.value || choices.some((c) => c.value === value) ? [value] : [];
    if (Array.isArray(value)) return value.filter((x) => choices.some((c) => c.value === x));
    return [`${value.kind}:${value.max}`].filter((x) => choices.some((c) => c.value === x));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [picked, setPicked] = useState<string[]>(initial);

  const toggle = (v: string, checked: boolean) => {
    setError(false);
    if (!multiple) return setPicked(checked ? [v] : []);
    if (v === neutral.value) return setPicked(checked ? [v] : []);
    setPicked((cur) => {
      const rest = cur.filter((x) => x !== neutral.value && x !== v);
      return checked ? [...rest, v] : rest;
    });
  };

  const submit = () => {
    const valid = picked.filter((x) => x === neutral.value || choices.some((c) => c.value === x));
    if (!valid.length) return setError(true);
    if (valid.includes(neutral.value)) return onAnswer(neutral.value as never);
    if (multiple) return onAnswer(valid as never);
    if (step === 'budget') {
      const [k, n] = valid[0]!.split(':');
      return onAnswer({ kind: k as 'MONTHLY' | 'TOTAL', max: Number(n) });
    }
    onAnswer(valid[0] as never);
  };

  const all = [...choices, neutral];
  return (
    <form
      className={s.question}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <fieldset className={s.fieldset} aria-describedby={error ? `${legendId}-error` : multiple ? `${legendId}-hint` : undefined}>
        <legend id={legendId} className={`${s.bubble} ${s.bot} ${s.legend}`}>
          <span className="visually-hidden">{t('ui.assistant.chat.assistant')} : </span>
          {t(`ui.assistant.questions.${step}`)}
        </legend>
        {step === 'budget' && monthlyOffered ? (
          <div className={s.kind} role="radiogroup" aria-label={t('ui.assistant.choices.budgetKind')}>
            {(['MONTHLY', 'TOTAL'] as const).map((k) => (
              <label key={k} className={s.kindOption}>
                <input
                  type="radio"
                  name={`${legendId}-kind`}
                  checked={kind === k}
                  onChange={() => {
                    setKind(k);
                    setPicked((cur) => cur.filter((x) => x === neutral.value));
                  }}
                />
                <span>{t(k === 'MONTHLY' ? 'ui.assistant.choices.monthly' : 'ui.assistant.choices.total')}</span>
              </label>
            ))}
          </div>
        ) : null}
        {multiple ? (
          <p id={`${legendId}-hint`} className={s.hint}>
            {t('ui.assistant.chat.several')}
          </p>
        ) : null}
        <div className={s.choices}>
          {all.map((c) => (
            <label key={c.value} className={`${s.chip} ${c.value === neutral.value ? s.chipNeutral : ''}`}>
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={legendId}
                value={c.value}
                checked={picked.includes(c.value)}
                onChange={(e) => toggle(c.value, e.target.checked)}
                className={s.chipInput}
              />
              <span className={s.chipMark} aria-hidden="true">
                <Icon name="check" size={16} />
              </span>
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        {error ? (
          <p id={`${legendId}-error`} className={s.error} role="alert">
            <Icon name="status-error" size={16} />
            {t('ui.assistant.chat.pickOne')}
          </p>
        ) : null}
      </fieldset>
      <div className={s.actions}>
        <Button type="submit" variant="primary" size="M" chevron>
          {t('ui.assistant.chat.continue')}
        </Button>
        {onBack ? (
          <button type="button" className={s.back} onClick={onBack}>
            <Icon name="chevron-left" size={16} />
            {t('ui.assistant.chat.back')}
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** ASS-011 — the optional free text: not interpreted, passed as it is to the advisor if contact details follow. */
function PrecisionStep({ initial, onSubmit, onBack }: { initial: string; onSubmit: (v: string) => void; onBack?: () => void }) {
  const [text, setText] = useState(initial);
  return (
    <form
      className={s.question}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text.trim().slice(0, 500));
      }}
      noValidate
    >
      <p className={`${s.bubble} ${s.bot} ${s.legend}`}>
        <span className="visually-hidden">{t('ui.assistant.chat.assistant')} : </span>
        {t('ui.assistant.questions.precision')}
      </p>
      <TextArea
        id="assistant-precision"
        label={t('ui.assistant.precision.label')}
        optional
        hint={t('ui.assistant.precision.hint')}
        maxLength={500}
        counter
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className={s.actions}>
        <Button type="submit" variant="primary" size="M" chevron>
          {t('ui.assistant.precision.submit')}
        </Button>
        {onBack ? (
          <button type="button" className={s.back} onClick={onBack}>
            <Icon name="chevron-left" size={16} />
            {t('ui.assistant.chat.back')}
          </button>
        ) : null}
      </div>
    </form>
  );
}
