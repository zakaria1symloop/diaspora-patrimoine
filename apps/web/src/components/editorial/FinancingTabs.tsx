'use client';
// EDI-020 § 2, EDI-022 — « Deux façons de financer »: two tabs (labels = overlines of the cards), `#credit` and
// `#islamique` open their tab; without islamic finance, no tablist: the classic credit alone. Under the tab: the card's
// catchphrase, its three points, then « En savoir plus » unfolds the long text. DSN-072: the old content fades out,
// the new one slides 12 px into place (motion.base); the underline slides to the chosen tab.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '@dp/ui';
import { t } from '@/lib/i18n';
import { Disclosure } from './Disclosure';
import s from './interactive.module.css';

export interface FinancingTab {
  key: 'credit' | 'islamic';
  anchor: 'credit' | 'islamique';
  overline: string;
  title: string;
  text: string;
  points: string[];
  /** Sanitised long text (financing.credit.body, financing.islamic.body), or null when emptied. */
  bodyHtml: string | null;
}

const ICONS: Record<FinancingTab['key'], IconName> = { credit: 'bank', islamic: 'crescent' };

function Panel({ tab }: { tab: FinancingTab }) {
  return (
    <div className={s.tabCard}>
      <div className={`${s.tabVisual} ${s[`tabVisual_${tab.key}`] ?? ''} icons-dark`}>
        <Icon name={ICONS[tab.key]} size={32} />
        <span className={s.tabOverline}>{tab.overline}</span>
      </div>
      <div className={s.tabContent}>
        <h3 className={s.tabTitle}>{tab.title}</h3>
        <p className={s.tabText}>{tab.text}</p>
        {tab.points.length ? (
          <ul role="list" className={s.checks}>
            {tab.points.map((p) => (
              <li key={p}>
                <span className={s.check}>
                  <Icon name="check" size={16} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        ) : null}
        {tab.bodyHtml ? (
          <Disclosure label={t('ui.editorial.common.readMore')} openLabel={t('ui.editorial.common.readLess')}>
            <div className={s.richSmall} dangerouslySetInnerHTML={{ __html: tab.bodyHtml }} />
          </Disclosure>
        ) : null}
      </div>
    </div>
  );
}

export function FinancingTabs({ tabs, label, after }: { tabs: FinancingTab[]; label: string; after?: ReactNode }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const fromHash = () => {
      const i = tabs.findIndex((tab) => `#${tab.anchor}` === window.location.hash);
      if (i >= 0) setActive(i);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [tabs]);

  if (tabs.length === 0) return null;
  if (tabs.length === 1) {
    return (
      <div id={tabs[0]!.anchor} className={s.tabsSingle}>
        <Panel tab={tabs[0]!} />
        {after}
      </div>
    );
  }

  const choose = (i: number) => {
    setActive(i);
    history.replaceState(null, '', `#${tabs[i]!.anchor}`);
  };
  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const rtl = document.documentElement.dir === 'rtl' ? -1 : 1;
    const next = (active + dir * rtl + tabs.length) % tabs.length;
    choose(next);
    refs.current[next]?.focus();
  };

  return (
    <div className={s.tabs}>
      {/* the anchors exist for the links of the site (#credit, #islamique) */}
      {tabs.map((tab) => (
        <span key={tab.anchor} id={tab.anchor} className={s.anchor} />
      ))}
      <div role="tablist" aria-label={label} className={s.tablist} onKeyDown={onKey} style={{ ['--tab' as string]: active }}>
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`onglet-${tab.anchor}`}
            aria-selected={i === active}
            aria-controls={`panneau-${tab.anchor}`}
            tabIndex={i === active ? 0 : -1}
            className={s.tab}
            onClick={() => choose(i)}
          >
            <Icon name={ICONS[tab.key]} size={20} />
            {tab.overline}
          </button>
        ))}
        <span className={s.tabIndicator} aria-hidden="true" />
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`panneau-${tab.anchor}`}
          aria-labelledby={`onglet-${tab.anchor}`}
          hidden={i !== active}
          className={s.tabPanel}
          tabIndex={0}
        >
          <Panel tab={tab} />
        </div>
      ))}
      {after}
    </div>
  );
}
