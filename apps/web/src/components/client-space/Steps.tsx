// ECL-020 — the six steps the client sees (seven internal stages): past steps checked with their date, the current one
// highlighted with its explanation, the next ones faded. Without financing: step 5 « Non concerné » (no sentence),
// step 6 « Acquisition ». On a phone the frieze is vertical and only the current step shows its sentence.
import type { DisplayedStep } from '@dp/contracts';
import { Icon } from '@dp/ui';
import type { MessageKey } from '@dp/i18n';
import { t } from '@/lib/i18n';
import { longDate, shortDate } from './texts';
import s from './steps.module.css';

export function Steps({ steps, financing, timeZone, compact }: { steps: DisplayedStep[]; financing: boolean; timeZone: string; compact?: boolean }) {
  return (
    <ol className={[s.steps, compact && s.compact].filter(Boolean).join(' ')} aria-label={t('ui.client.steps.title')}>
      {steps.map((st) => {
        const cash = !financing && st.n === 6;
        const label = t((cash ? 'ui.client.steps.6.labelCash' : `ui.client.steps.${st.n}.label`) as MessageKey);
        const hint = st.state === 'NOT_CONCERNED' ? null : t((cash ? 'ui.client.steps.6.hintCash' : `ui.client.steps.${st.n}.hint`) as MessageKey);
        return (
          <li key={st.n} className={`${s.step} ${s[st.state]}`} aria-current={st.state === 'CURRENT' ? 'step' : undefined}>
            <span className={s.marker} aria-hidden="true">
              {st.state === 'DONE' ? <Icon name="check" size={16} /> : st.n}
            </span>
            <span className={s.text}>
              <span className={s.label}>{label}</span>
              {st.state === 'NOT_CONCERNED' ? <span className={s.meta}>{t('ui.client.steps.notConcerned')}</span> : null}
              {st.state === 'DONE' && st.reachedAt ? <span className={s.meta}>{compact ? shortDate(st.reachedAt, timeZone) : t('ui.client.steps.done', { date: longDate(st.reachedAt, timeZone) })}</span> : null}
              {st.state === 'CURRENT' ? <span className={s.current}>{t('ui.client.steps.current')}</span> : null}
              {hint && (!compact || st.state === 'CURRENT') ? <span className={s.hint}>{hint}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
