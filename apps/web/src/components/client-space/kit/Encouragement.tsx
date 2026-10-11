// D-098 « des messages d'encouragement mis en forme » — never a bare sentence: a card with its medallion, a title that
// says where the person stands, one sentence about what comes next, an optional progress bar and the useful action.
// The texts come from `ui.client.encourage.*` (listed for the client's validation, Q-066); they describe what IS
// (figures computed by the server) and never promise a delay or a result the product cannot keep.
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@dp/ui';
import { Progress, type ProgressProps } from './Progress';
import s from './kit.module.css';

export interface EncouragementProps {
  /** progress: on the way · done: something achieved · calm: nothing expected from the person · attention: their turn. */
  tone?: 'progress' | 'done' | 'calm' | 'attention';
  icon: IconName;
  title: ReactNode;
  text?: ReactNode;
  progress?: ProgressProps;
  actions?: ReactNode;
  /** Replaces the icon medallion (the `Celebration` of DSN-073 on a real achievement). */
  medal?: ReactNode;
  id?: string;
}

export function Encouragement({ tone = 'progress', icon, title, text, progress, actions, medal, id }: EncouragementProps) {
  const cls = [s.encourage, tone === 'done' && s.encourageDone, tone === 'calm' && s.encourageCalm, tone === 'attention' && s.encourageAttention].filter(Boolean).join(' ');
  return (
    <aside className={cls} id={id} data-encouragement={tone}>
      {medal ?? (
        <span className={s.medal} aria-hidden="true">
          <Icon name={icon} size={24} />
        </span>
      )}
      <div className={s.encourageBody}>
        <p className={s.encourageTitle}>{title}</p>
        {text ? <p className={s.encourageText}>{text}</p> : null}
      </div>
      {progress || actions ? (
        <div className={s.encourageFoot}>
          {progress ? <Progress {...progress} /> : <span />}
          {actions ? <div className={s.encourageActions}>{actions}</div> : null}
        </div>
      ) : null}
    </aside>
  );
}
