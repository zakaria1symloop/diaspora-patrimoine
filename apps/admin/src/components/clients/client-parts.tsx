'use client';
// Pieces shared by the list (EA-12) and the record (EA-13) of the clients: the score chip and its four-line detail
// (CAL-070, CRM-047 — never shown to the client), the country names, the local time of the client (TRV-031).
import { useRef, useState } from 'react';
import type { ClientScore, ScoreLevel } from '@dp/contracts';
import type { MessageKey } from '@dp/i18n';
import { useDismiss } from '@dp/ui';
import { DASH } from '@/lib/format';
import { t } from '@/lib/i18n';
import s from './clients.module.css';

let countries: Intl.DisplayNames | null = null;
export function countryName(code: string): string {
  try {
    countries ??= new Intl.DisplayNames(['fr'], { type: 'region' });
    return countries.of(code) ?? code;
  } catch {
    return code;
  }
}

/** TRV-031 — « 14 h 05 à Montréal ». */
export function localTime(timeZone: string | null, now = new Date()): string | null {
  if (!timeZone) return null;
  try {
    const hour = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone }).format(now).replace(':', ' h ');
    const city = (timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ');
    return t('ui.admin-clients.localTime', { heure: hour, ville: city });
  } catch {
    return null;
  }
}

export function ScoreChip({ score, level }: { score: number | null; level: ScoreLevel | null }) {
  if (score === null || !level) return <span className={s.muted}>{DASH}</span>;
  return (
    <span className={`${s.score} ${s[`score${level}`] ?? ''}`}>
      <span className={s.scoreValue}>{score}</span>
      {t(`ui.admin-clients.score.${level}` as MessageKey)}
    </span>
  );
}

const BLOCKS: { key: keyof ClientScore['blocks']; max: number }[] = [
  { key: 'reachable', max: 20 },
  { key: 'project', max: 20 },
  { key: 'financing', max: 40 },
  { key: 'engagement', max: 20 },
];

/** CRM-047 — the chip opens the detail: four lines, each with its bar (« Financement 25 / 40 »). */
export function ScoreButton({ score }: { score: ClientScore }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [ref]);
  return (
    <div className={s.scoreWrap} ref={ref}>
      <button type="button" className={`${s.score} ${s.scoreButton} ${s[`score${score.level}`] ?? ''}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={s.scoreValue}>{score.value}</span>
        {t(`ui.admin-clients.score.${score.level}` as MessageKey)}
      </button>
      {open ? (
        <div className={s.scorePanel} role="dialog" aria-label={t('ui.admin-clients.scoreDetail.title')}>
          <p className={s.scoreTitle}>{t('ui.admin-clients.scoreDetail.title')}</p>
          <ul className={s.scoreBlocks}>
            {BLOCKS.map((b) => (
              <li key={b.key}>
                <span className={s.scoreLine}>
                  <span>{t(`ui.admin-clients.scoreDetail.${b.key}` as MessageKey)}</span>
                  <strong>
                    {score.blocks[b.key]} / {b.max}
                  </strong>
                </span>
                <span className={s.bar}>
                  <span className={s.barFill} style={{ width: `${Math.round((score.blocks[b.key] / b.max) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
          <p className={s.scoreNote}>{t('ui.admin-clients.scoreDetail.note')}</p>
        </div>
      ) : null}
    </div>
  );
}
