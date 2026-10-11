'use client';
// TRV-127 « Écouter cette page » — at the head of the content of every public page: the browser's speech synthesis
// reads the main text in French (rate 0.9), sentence after sentence; the sentence being read is highlighted (CSS
// Custom Highlight API where the browser has it) and kept in view; « Pause » / « Reprendre » and « Arrêter ». Nothing
// leaves the browser. A browser without speech synthesis shows no button. Leaving the page stops the reading.
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './ListenButton.module.css';

type State = 'idle' | 'reading' | 'paused';
interface Sentence {
  text: string;
  range: Range | null;
  block: Element;
}

const SKIP = 'nav, button, select, input, textarea, svg, script, style, noscript, [aria-hidden="true"], [hidden], .visually-hidden, [data-listen-skip], dialog:not([open])';
const BLOCKS = 'p, h1, h2, h3, h4, h5, h6, li, dt, dd, th, td, figcaption, blockquote, label, legend, summary';
const HIGHLIGHT = 'dp-listen';

/** The readable sentences of the main content, each with the range that covers it on the page. */
function collect(root: Element): Sentence[] {
  const out: Sentence[] = [];
  const blocks = Array.from(root.querySelectorAll(BLOCKS)).filter(
    (b) => !b.closest(SKIP) && !b.parentElement?.closest(BLOCKS) && (b as HTMLElement).offsetParent !== null,
  );
  for (const block of blocks) {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    const full = nodes.map((n) => n.data).join('');
    if (!full.trim()) continue;
    const re = /[^.!?…]+[.!?…]*["»”)]*\s*/g;
    for (let m = re.exec(full); m; m = re.exec(full)) {
      const text = m[0].replace(/\s+/g, ' ').trim();
      if (!text) continue;
      out.push({ text, block, range: rangeOf(nodes, m.index, m.index + m[0].trimEnd().length) });
    }
  }
  return out;
}

function rangeOf(nodes: Text[], start: number, end: number): Range | null {
  let pos = 0;
  const r = document.createRange();
  let started = false;
  for (const n of nodes) {
    const len = n.data.length;
    if (!started && start < pos + len) {
      r.setStart(n, start - pos);
      started = true;
    }
    if (started && end <= pos + len) {
      r.setEnd(n, end - pos);
      return r;
    }
    pos += len;
  }
  return null;
}

function frenchVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'fr-FR') ?? voices.find((v) => v.lang.startsWith('fr')) ?? null;
}

export function ListenButton() {
  const pathname = usePathname();
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<State>('idle');
  const queue = useRef<Sentence[]>([]);
  const index = useRef(0);
  const session = useRef(0);

  const clearHighlight = () => {
    const h = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
    h?.delete(HIGHLIGHT);
  };

  const stop = useCallback(() => {
    session.current++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    clearHighlight();
    setState('idle');
  }, []);

  useEffect(() => setSupported('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window), []);
  useEffect(() => stop, [pathname, stop]); // a new page: the reading stops
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && state !== 'idle' && stop();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, stop]);

  const speak = useCallback((id: number) => {
    if (id !== session.current) return;
    const item = queue.current[index.current];
    if (!item) {
      clearHighlight();
      setState('idle');
      return;
    }
    const h = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
    const HighlightCtor = (globalThis as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (h && HighlightCtor && item.range) h.set(HIGHLIGHT, new HighlightCtor(item.range));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rect = item.block.getBoundingClientRect();
    if (rect.top < 90 || rect.bottom > window.innerHeight - 40) item.block.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'fr-FR';
    u.rate = 0.9;
    const voice = frenchVoice();
    if (voice) u.voice = voice;
    u.onend = () => {
      if (id !== session.current) return;
      index.current++;
      speak(id);
    };
    u.onerror = () => id === session.current && stop();
    window.speechSynthesis.speak(u);
  }, [stop]);

  const start = () => {
    const root = document.querySelector('main#contenu');
    if (!root) return;
    window.speechSynthesis.cancel();
    queue.current = collect(root);
    index.current = 0;
    const id = ++session.current;
    setState('reading');
    speak(id);
  };

  const pause = () => {
    window.speechSynthesis.pause();
    setState('paused');
  };
  const resume = () => {
    window.speechSynthesis.resume();
    setState('reading');
  };

  if (!supported) return null;
  if (state === 'idle')
    return (
      <button type="button" className={s.listen} onClick={start}>
        <Icon name="speaker" size={20} />
        {t('ui.common.voice.listenPage')}
      </button>
    );
  return (
    <div className={s.player} role="group" aria-label={t('ui.common.voice.listenPage')}>
      <span className={s.status} aria-live="polite">
        <Icon name="speaker" size={20} />
        {state === 'paused' ? t('ui.common.voice.paused') : t('ui.common.voice.reading')}
      </span>
      {state === 'reading' ? (
        <button type="button" className={s.control} onClick={pause}>
          <Icon name="pause" size={16} />
          {t('ui.common.voice.pause')}
        </button>
      ) : (
        <button type="button" className={s.control} onClick={resume}>
          <Icon name="play" size={16} />
          {t('ui.common.voice.resume')}
        </button>
      )}
      <button type="button" className={`${s.control} ${s.stop}`} onClick={stop}>
        <Icon name="close" size={16} />
        {t('ui.common.voice.stop')}
      </button>
    </div>
  );
}
