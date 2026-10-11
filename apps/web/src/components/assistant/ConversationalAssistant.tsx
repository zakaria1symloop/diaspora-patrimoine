'use client';
// EP-22, mode AI (ASS-050 to ASS-052, IA-010 to IA-013). The visitor writes with their words (or dictates, TRV-127);
// the answer is written as it comes (stream of `POST /public/assistant/messages`); the criteria understood show as pills
// the visitor can remove (IA-011); the properties come from the catalogue as the same cards and actions as the guided
// mode (ASS-020); « Réponse générée automatiquement » under each answer (IA-002); « Parler à un conseiller » always
// visible (DEM-017); « Je préfère répondre à des questions » goes to the questionnaire, which is also the silent
// fallback when the model cannot answer (ASS-052). The model's text is shown as plain text (never as HTML).
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  AI_MESSAGE_MAX_LENGTH,
  criteriaPills,
  criteriaToSearch,
  readAiEvents,
  typeSlugToEnum,
  withoutPill,
  type AiCriteriaNames,
  type AiCriteriaPill,
  type AiHandoffReason,
  type AiSource,
  type AiStreamEvent,
  type CatalogueCriteria,
  type GuidedResultsResponse,
  type PropertyTypeSlug,
  type PublicSettings,
} from '@dp/contracts';
import { formatMoney } from '@dp/i18n';
import { Button, ButtonInner, Icon, buttonClass } from '@dp/ui';
import { t } from '@/lib/i18n';
import { PropertyCard } from '@/components/vitrine/PropertyCard';
import { GuidedLeadForm } from './GuidedResults';
import s from './assistant.module.css';
import c from './conversation.module.css';
import { newUuid } from '@dp/ui';

interface Turn {
  id: string;
  /** The visitor's message; null for a pill edit. */
  message: string | null;
  answer: string;
  generated: boolean;
  results: GuidedResultsResponse | null;
  sources: AiSource[];
  handoff: AiHandoffReason | 'LIMIT' | null;
  pending: boolean;
}

interface Saved {
  conversationId: string | null;
  turns: Turn[];
  criteria: CatalogueCriteria;
  names: AiCriteriaNames;
}

const STORAGE_KEY = 'dp_assistant_ai';
const EMPTY: Saved = { conversationId: null, turns: [], criteria: {}, names: { region: {}, city: {} } };
const EXAMPLES = ['one', 'two', 'three'] as const;

function load(): Saved {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<Saved>;
    return {
      conversationId: typeof v.conversationId === 'string' ? v.conversationId : null,
      turns: Array.isArray(v.turns) ? v.turns.filter((x) => !x.pending).slice(-12) : [],
      criteria: v.criteria ?? {},
      names: v.names ?? { region: {}, city: {} },
    };
  } catch {
    return EMPTY;
  }
}
function save(v: Saved): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...v, turns: v.turns.filter((x) => !x.pending) }));
  } catch {
    /* storage unavailable: the conversation still works for this visit */
  }
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const newTurnId = () => newUuid();

export function ConversationalAssistant({ settings, onQuestions, onFallback }: { settings: PublicSettings; onQuestions: () => void; onFallback: () => void }) {
  const [state, setState] = useState<Saved | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'rateLimited' | 'tooLong' | null>(null);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const stateRef = useRef<Saved | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const id = useId();

  useEffect(() => {
    const v = load();
    stateRef.current = v;
    setState(v);
    return () => abortRef.current?.abort();
  }, []);

  const update = useCallback((fn: (v: Saved) => Saved) => {
    const next = fn(stateRef.current ?? EMPTY);
    stateRef.current = next;
    save(next);
    setState(next);
  }, []);

  const patchTurn = useCallback((turnId: string, fn: (turn: Turn) => Turn) => update((v) => ({ ...v, turns: v.turns.map((x) => (x.id === turnId ? fn(x) : x)) })), [update]);

  // The newest exchange comes into view.
  const turnCount = state?.turns.length ?? 0;
  useEffect(() => {
    if (turnCount) endRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }, [turnCount]);

  /** One request: a message, or a pill edit (`criteria`). Reads the stream event by event. */
  const send = useCallback(
    async (body: { message?: string; criteria?: string }) => {
      const current = stateRef.current ?? EMPTY;
      const turnId = newTurnId();
      update((v) => ({ ...v, turns: [...v.turns, { id: turnId, message: body.message ?? null, answer: '', generated: false, results: null, sources: [], handoff: null, pending: true }] }));
      setBusy(true);
      setNotice(null);
      const abort = new AbortController();
      abortRef.current = abort;
      let fellBack = false;
      const apply = (e: AiStreamEvent) => {
        switch (e.type) {
          case 'start':
            update((v) => ({ ...v, conversationId: e.conversationId }));
            break;
          case 'delta':
            patchTurn(turnId, (x) => ({ ...x, answer: x.answer + e.text }));
            break;
          case 'criteria':
            update((v) => ({ ...v, criteria: e.criteria, names: { region: { ...v.names.region, ...e.names.region }, city: { ...v.names.city, ...e.names.city } } }));
            break;
          case 'results':
            patchTurn(turnId, (x) => ({ ...x, results: e.results }));
            break;
          case 'sources':
            patchTurn(turnId, (x) => ({ ...x, sources: e.sources }));
            break;
          case 'handoff':
            patchTurn(turnId, (x) => ({ ...x, handoff: e.reason }));
            break;
          case 'limit':
            patchTurn(turnId, (x) => ({ ...x, handoff: 'LIMIT' }));
            break;
          case 'end':
            patchTurn(turnId, (x) => ({ ...x, generated: e.generated, pending: false }));
            break;
          case 'fallback':
            fellBack = true;
            break;
        }
      };
      try {
        const res = await fetch('/api/v1/public/assistant/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
          body: JSON.stringify({ ...(current.conversationId ? { conversationId: current.conversationId } : {}), ...body }),
          signal: abort.signal,
        });
        if (res.status === 429 || res.status === 422) {
          update((v) => ({ ...v, turns: v.turns.filter((x) => x.id !== turnId) }));
          setNotice(res.status === 429 ? 'rateLimited' : 'tooLong');
          if (body.message) setText(body.message);
          return;
        }
        if (!res.ok || !res.body) throw new Error(String(res.status));
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = readAiEvents(buffer);
          buffer = rest;
          for (const e of events) apply(e);
          if (fellBack) break;
        }
        if (!fellBack) patchTurn(turnId, (x) => ({ ...x, pending: false }));
      } catch {
        if (abort.signal.aborted) return;
        fellBack = true; // network cut, server error: the same silent fallback (ASS-052)
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
      if (fellBack) {
        update((v) => ({ ...v, turns: v.turns.filter((x) => x.id !== turnId) }));
        onFallback();
      }
    },
    [update, patchTurn, onFallback],
  );

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    if (message.length > AI_MESSAGE_MAX_LENGTH) return setNotice('tooLong');
    setText('');
    void send({ message });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const removePill = (pill: AiCriteriaPill) => {
    if (!state || busy) return;
    const next = withoutPill(state.criteria, pill);
    update((v) => ({ ...v, criteria: next }));
    void send({ criteria: criteriaToSearch(next).replace(/^\?/, '') });
  };

  const restart = () => {
    abortRef.current?.abort();
    update(() => EMPTY);
    setAdvisorOpen(false);
    setNotice(null);
    inputRef.current?.focus();
  };

  if (!state) return <div className={s.shell} aria-busy="true" />;

  const lastResults = [...state.turns].reverse().find((x) => x.results)?.results ?? null;
  const pills = criteriaPills(state.criteria);
  const started = state.turns.length > 0;

  return (
    <div className={s.shell}>
      <div className={s.bar}>
        <div className={`${s.barText} ${c.bar}`}>
          <span className={s.avatar} aria-hidden="true">
            <Icon name="sparkles" size={20} />
          </span>
          <p className={s.progressLabel}>{t('ui.assistant.page.title')}</p>
          <div className={c.barActions}>
            <button type="button" className={s.restart} onClick={() => setAdvisorOpen(true)} aria-expanded={advisorOpen} aria-controls={`${id}-advisor`}>
              <Icon name="phone" size={16} />
              {t('ui.assistant.ai.advisor')}
            </button>
            <button type="button" className={s.restart} onClick={onQuestions}>
              {t('ui.assistant.ai.toQuestions')}
            </button>
            {started ? (
              <button type="button" className={s.restart} onClick={restart}>
                <Icon name="arrow-left" size={16} />
                {t('ui.assistant.ai.restart')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ol className={s.thread} aria-label={t('ui.assistant.page.title')}>
        <li className={`${s.bubble} ${s.bot}`}>
          <span className="visually-hidden">{t('ui.assistant.chat.assistant')} : </span>
          {t('ui.assistant.ai.greeting')}
        </li>
        {state.turns.map((turn) => (
          <li key={turn.id} className={s.exchange}>
            <ol className={s.pair}>
              {turn.message ? (
                <li className={`${s.bubble} ${s.you}`}>
                  <span className="visually-hidden">{t('ui.assistant.chat.you')} : </span>
                  {turn.message}
                </li>
              ) : null}
              <TurnView turn={turn} settings={settings} conversationId={state.conversationId} />
            </ol>
          </li>
        ))}
        {advisorOpen ? (
          <li className={s.exchange} id={`${id}-advisor`}>
            <GuidedLeadForm
              settings={settings}
              answers={{}}
              precision=""
              result={lastResults ?? emptyResults(state.criteria)}
              assistantConversationId={state.conversationId ?? undefined}
              texts={{ title: t('ui.assistant.ai.form.title'), intro: t('ui.assistant.ai.form.intro'), submit: t('ui.assistant.ai.form.submit') }}
            />
          </li>
        ) : null}
      </ol>
      <div ref={endRef} />

      <div className={c.composer}>
        {pills.length ? (
          <div className={c.pills} role="group" aria-label={t('ui.assistant.ai.criteria.label')}>
            <span className={c.pillsLabel}>{t('ui.assistant.ai.criteria.label')}</span>
            <ul className={c.pillList}>
              {pills.map((pill) => {
                const label = pillLabel(pill, state.names, settings);
                return (
                  <li key={`${pill.key}:${pill.value}`}>
                    <button type="button" className={c.pill} onClick={() => removePill(pill)} disabled={busy} aria-label={t('ui.assistant.ai.criteria.remove', { critere: label })}>
                      <span>{label}</span>
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {!started ? (
          <div className={c.examples}>
            <p className={c.examplesLabel} id={`${id}-examples`}>
              {t('ui.assistant.ai.examplesLabel')}
            </p>
            <ul className={c.exampleList} aria-labelledby={`${id}-examples`}>
              {EXAMPLES.map((k) => (
                <li key={k}>
                  <button type="button" className={s.chip} onClick={() => void send({ message: t(`ui.assistant.ai.examples.${k}`) })} disabled={busy}>
                    {t(`ui.assistant.ai.examples.${k}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {notice ? (
          <p className={s.error} role="alert">
            <Icon name="status-error" size={16} />
            {notice === 'rateLimited' ? t('ui.assistant.ai.rateLimited') : t('ui.assistant.ai.tooLong')}
          </p>
        ) : null}

        <form className={c.form} onSubmit={submit} noValidate>
          <label htmlFor={`${id}-input`} className={c.inputLabel}>
            {t('ui.assistant.ai.inputLabel')}
          </label>
          <div className={c.inputRow}>
            <textarea
              ref={inputRef}
              id={`${id}-input`}
              className={c.input}
              rows={2}
              maxLength={AI_MESSAGE_MAX_LENGTH}
              placeholder={t('ui.assistant.ai.inputPlaceholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              aria-describedby={`${id}-privacy`}
            />
            <div className={c.inputActions}>
              <Dictate onText={(v) => setText((cur) => `${cur ? `${cur} ` : ''}${v}`.slice(0, AI_MESSAGE_MAX_LENGTH))} disabled={busy} />
              <Button type="submit" variant="primary" size="M" pending={busy} disabled={!text.trim()}>
                {t('ui.assistant.ai.send')}
              </Button>
            </div>
          </div>
          <p id={`${id}-privacy`} className={c.privacy}>
            {t('ui.assistant.ai.privacy')}
          </p>
        </form>
      </div>
    </div>
  );
}

function emptyResults(criteria: CatalogueCriteria): GuidedResultsResponse {
  return { outcome: 'EXACT', total: 0, cards: [], references: [], criteria, appliedCriteria: criteria, referenceDownPaymentPct: '0' };
}

/** One answer: text, then the cards and their actions (ASS-020), the sources, the handover. */
function TurnView({ turn, settings, conversationId }: { turn: Turn; settings: PublicSettings; conversationId: string | null }) {
  const [formOpen, setFormOpen] = useState(false);
  const res = turn.results;
  const monthlyOn = settings['features.monthlyBudgetSearch'];
  const handoffOpen = turn.handoff !== null || (res?.outcome === 'NONE' && !turn.pending);
  return (
    <>
      {turn.answer || turn.pending ? (
        <li className={`${s.bubble} ${s.bot} ${c.answer}`} aria-busy={turn.pending}>
          <span className="visually-hidden">{t('ui.assistant.chat.assistant')} : </span>
          {turn.answer ? <span className={c.answerText}>{turn.answer}</span> : <span className={s.typing}>{t('ui.assistant.ai.thinking')}</span>}
          {turn.answer && (turn.generated || !turn.pending) ? <span className={c.notice}>{t('ui.notice.ai')}</span> : null}
        </li>
      ) : null}

      {turn.sources.length ? (
        <li className={c.sources}>
          <p className={c.sourcesLabel}>{t('ui.assistant.ai.sources')}</p>
          <ul>
            {turn.sources.map((src) => (
              <li key={src.href}>
                <Link href={src.href}>{src.title}</Link>
              </li>
            ))}
          </ul>
        </li>
      ) : null}

      {res ? (
        <li className={`${s.current} ${s.results}`}>
          <p className={`${s.bubble} ${s.bot}`} role="status">
            {res.outcome === 'RELAXED' ? t('ui.assistant.ai.results.relaxed') : res.outcome === 'NONE' ? t('ui.assistant.ai.results.none') : t('ui.assistant.ai.results.count', { n: res.total })}
          </p>
          {res.cards.length ? (
            <>
              <ul className={s.cards} aria-label={t('ui.assistant.results.listLabel')}>
                {res.cards.map((card) => (
                  <li key={card.id}>
                    <PropertyCard card={card} downPaymentPct={res.referenceDownPaymentPct} monthlyEnabled={monthlyOn} illustrationNote={settings['legal.illustrationNote']} />
                  </li>
                ))}
              </ul>
              {monthlyOn && res.cards.some((x) => x.monthlyFromRef) ? <p className={s.footnote}>{settings['legal.monthlyFootnote']}</p> : null}
            </>
          ) : null}
          <ResultActions res={res} settings={settings} onReceive={() => setFormOpen(true)} formOpen={formOpen || handoffOpen} />
        </li>
      ) : null}

      {turn.handoff ? (
        <li className={`${s.bubble} ${s.bot}`}>
          <span className="visually-hidden">{t('ui.assistant.chat.assistant')} : </span>
          {t(`ui.assistant.ai.handoff.${turn.handoff}`)}
        </li>
      ) : null}

      {formOpen || handoffOpen ? (
        <li className={s.exchange}>
          <GuidedLeadForm
            settings={settings}
            answers={{}}
            precision=""
            result={res ?? emptyResults({})}
            assistantConversationId={conversationId ?? undefined}
            texts={
              turn.handoff
                ? { title: t('ui.assistant.ai.form.title'), intro: t('ui.assistant.ai.form.intro'), submit: t('ui.assistant.ai.form.submit') }
                : res?.outcome === 'NONE'
                  ? { title: t('ui.assistant.form.titleNone'), intro: t('ui.assistant.form.introNone'), submit: t('ui.assistant.form.submitNone') }
                  : undefined
            }
          />
        </li>
      ) : null}
    </>
  );
}

/** ASS-020 — « Voir tous les résultats » · « Recevoir ces biens et être accompagné » · « Créer une alerte ». */
function ResultActions({ res, settings, onReceive, formOpen }: { res: GuidedResultsResponse; settings: PublicSettings; onReceive: () => void; formOpen: boolean }) {
  const catalogueHref = `/programmes${criteriaToSearch(res.appliedCriteria)}`;
  const alertSearch = criteriaToSearch(res.criteria);
  const alertHref = `/programmes${alertSearch}${alertSearch ? '&' : '?'}alerte=1`;
  if (res.outcome === 'NONE' && !settings['features.searchAlerts']) return null;
  return (
    <div className={s.resultActions}>
      {res.outcome !== 'NONE' ? (
        <Link href={catalogueHref} className={buttonClass('secondary', 'M')}>
          <ButtonInner size="M">{t('ui.assistant.results.seeAll')}</ButtonInner>
        </Link>
      ) : null}
      {res.outcome !== 'NONE' && !formOpen ? (
        <Button variant="primary" size="M" chevron onClick={onReceive}>
          {t('ui.assistant.results.receive')}
        </Button>
      ) : null}
      {settings['features.searchAlerts'] ? (
        <Link href={alertHref} className={s.alertLink}>
          <Icon name="bell" size={16} />
          {t('ui.assistant.results.alert')}
        </Link>
      ) : null}
    </div>
  );
}

/** IA-011 — « Appartement · T3 · Alger · jusqu'à 500 € / mois ». */
function pillLabel(pill: AiCriteriaPill, names: AiCriteriaNames, settings: PublicSettings): string {
  const prefix = settings['display.roomsPrefix'];
  const currency = settings['display.referenceCurrency'];
  const money = (v: string) => formatMoney(Number(v), currency, 'fr-FR', 0);
  switch (pill.key) {
    case 'type':
      return t(`ui.enum.PropertyType.${typeSlugToEnum[pill.value as PropertyTypeSlug]}`);
    case 'rooms':
      return pill.value === '5plus' ? t('ui.assistant.ai.criteria.roomsFivePlus', { prefix }) : t('ui.assistant.ai.criteria.rooms', { prefix, n: pill.value });
    case 'region':
      return names.region[pill.value] ?? pill.value;
    case 'city':
      return names.city[pill.value] ?? pill.value;
    case 'monthlyMax':
      return t('ui.assistant.ai.criteria.monthlyMax', { montant: money(pill.value) });
    case 'priceMax':
      return t('ui.assistant.ai.criteria.priceMax', { montant: money(pill.value) });
    case 'priceMin':
      return t('ui.assistant.ai.criteria.priceMin', { montant: money(pill.value) });
    case 'surfaceMin':
      return t('ui.assistant.ai.criteria.surfaceMin', { n: pill.value });
    case 'delivery':
      return pill.value === 'delivered' ? t('ui.assistant.ai.criteria.delivered') : pill.value === 'later' ? t('ui.assistant.ai.criteria.later') : t('ui.assistant.ai.criteria.year', { annee: pill.value });
    case 'standing':
      return t(`ui.enum.Standing.${pill.value.toUpperCase() as 'COMFORT' | 'STANDING' | 'PREMIUM'}`);
    case 'financing':
      return t('ui.assistant.ai.criteria.financing');
    case 'islamic':
      return t('ui.assistant.ai.criteria.islamic');
  }
}

// ─── TRV-127 « Dicter » ──────────────────────────────────────────────────────────────────────────────────────────

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** The browser's speech recognition writes into the field, which the visitor reads again before sending. Hidden when the browser does not know it. */
function Dictate({ onText, disabled }: { onText: (text: string) => void; disabled: boolean }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => setSupported(recognitionCtor() !== null), []);
  useEffect(() => () => rec.current?.stop(), []);
  if (!supported) return null;
  const toggle = () => {
    if (listening) return rec.current?.stop();
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = 'fr-FR';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (said) onText(said);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };
  return (
    <button type="button" className={c.dictate} onClick={toggle} disabled={disabled} aria-pressed={listening}>
      <Icon name="mic" size={20} />
      <span>{listening ? t('ui.common.voice.listening') : t('ui.common.voice.dictate')}</span>
    </button>
  );
}
