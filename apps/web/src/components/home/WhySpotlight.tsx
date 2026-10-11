'use client';
// ACC-045, D-101 — the six motivations as a spotlight instead of six static cards. On a computer: the list of the six on
// the left (tabs), the photo of the chosen one on the right, its text on a card over the photo; on a phone: the photo on
// top with story segments, the text under it, a swipe goes to the next one. The spotlight moves on by itself
// (DSN-072 « Défilement des motivations ») only while the section is on screen, the page visible and nobody points at
// it or has focus in it; it stops for good once the visitor picks a motivation, and never runs with reduced motion or
// in simplified display (TRV-122) — the progress bar's CSS animation drives it, so those cases simply have no animation.
// A pause button is always there (WCAG 2.2.2). Without JavaScript the first motivation shows and the tabs are inert.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { PublicImage } from '@dp/contracts';
import { Icon, type IconName } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { t } from '@/lib/i18n';
import s from './WhySpotlight.module.css';

export interface WhyItem {
  title: string;
  text: string;
  image: PublicImage | null;
  icon: IconName;
}

const two = (n: number) => String(n).padStart(2, '0');

export function WhySpotlight({ items, label }: { items: WhyItem[]; label: string }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [onScreen, setOnScreen] = useState(false);
  const [held, setHeld] = useState(false); // pointer over it or focus inside
  const [stopped, setStopped] = useState(false); // the visitor took over, or pressed pause
  const [visible, setVisible] = useState(true);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const count = items.length;

  useEffect(() => {
    const el = root.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(Boolean(e?.isIntersecting)), { threshold: 0.35 });
    io.observe(el);
    const vis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', vis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  const running = onScreen && visible && !held && !stopped;

  const pick = (i: number, focus = false) => {
    const next = (i + count) % count;
    setActive(next);
    setStopped(true);
    if (focus) tabs.current[next]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (e.key in keys) pick(active + keys[e.key]!, true);
    else if (e.key === 'Home') pick(0, true);
    else if (e.key === 'End') pick(count - 1, true);
    else return;
    e.preventDefault();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - start.y)) pick(active + (dx < 0 ? 1 : -1));
  };

  const advance = () => setActive((a) => (a + 1) % count);
  const current = items[active]!;

  return (
    <div
      ref={root}
      className={`${s.spotlight} ${running ? s.running : ''}`}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
      data-reveal=""
    >
      {/* computer: the list of the six */}
      <div className={s.list} role="tablist" aria-label={label} aria-orientation="vertical" onKeyDown={onKey}>
        {items.map((it, i) => {
          const on = i === active;
          return (
            <button
              key={it.title}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={on}
              aria-controls={`${id}-panel`}
              tabIndex={on ? 0 : -1}
              className={s.tab}
              onClick={() => pick(i)}
            >
              <span className={s.tabNumber} aria-hidden="true">
                {two(i + 1)}
              </span>
              <span className={s.tabIcon} aria-hidden="true">
                <Icon name={it.icon} size={20} />
              </span>
              <span className={s.tabTitle}>{it.title}</span>
              <Icon name="chevron-right" size={20} className={s.tabChevron} />
              {on ? <span key={`p${active}`} className={s.progress} onAnimationEnd={advance} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      {/* the photo and the text of the chosen one */}
      <div className={s.stage} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`}>
        <div
          className={s.frame}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
          onDragStart={(e) => e.preventDefault()}
        >
          {items.map((it, i) =>
            it.image ? (
              <div key={it.title} className={`${s.photo} ${i === active ? s.photoOn : ''}`} aria-hidden={i !== active}>
                <Picture image={it.image} alt={i === active ? undefined : ''} sizes="(max-width: 64rem) 100vw, 46rem" className={s.photoImage} />
              </div>
            ) : (
              <div key={it.title} className={`${s.photo} ${s.photoEmpty} ${i === active ? s.photoOn : ''}`} aria-hidden="true">
                <Icon name={it.icon} size={32} />
              </div>
            ),
          )}
          <span key={`w${active}`} className={s.watermark} aria-hidden="true">
            {two(active + 1)}
          </span>

          {/* phone: story segments */}
          <div className={s.segments}>
            {items.map((it, i) => (
              <button
                key={it.title}
                type="button"
                className={s.segment}
                aria-label={t('ui.home.why.show', { n: i + 1, total: count, title: it.title })}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => pick(i)}
              >
                <span className={s.segmentTrack} data-done={i < active ? '' : undefined}>
                  {i === active ? <span key={`s${active}`} className={s.segmentFill} onAnimationEnd={advance} /> : null}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={s.pause}
            aria-label={stopped ? t('ui.home.why.play') : t('ui.home.why.pause')}
            aria-pressed={stopped}
            onClick={() => setStopped((v) => !v)}
          >
            <Icon name={stopped ? 'play' : 'pause'} size={16} />
          </button>
        </div>

        <div className={s.caption} aria-live={stopped ? 'polite' : 'off'}>
          <div className={s.captionHead}>
            <span className={s.captionIcon} aria-hidden="true">
              <Icon name={current.icon} size={20} />
            </span>
            <h3 className={s.captionTitle}>{current.title}</h3>
            <span className={s.captionCount} aria-hidden="true">
              {two(active + 1)}
              <span className={s.captionTotal}>/{two(count)}</span>
            </span>
            <div className={s.captionNav}>
              <button type="button" className={s.navButton} aria-label={t('ui.home.why.prev')} onClick={() => pick(active - 1)}>
                <Icon name="arrow-left" size={20} />
              </button>
              <button type="button" className={s.navButton} aria-label={t('ui.home.why.next')} onClick={() => pick(active + 1)}>
                <Icon name="arrow-right" size={20} />
              </button>
            </div>
          </div>
          <p key={active} className={s.captionText}>
            {current.text}
          </p>
        </div>
      </div>
    </div>
  );
}
