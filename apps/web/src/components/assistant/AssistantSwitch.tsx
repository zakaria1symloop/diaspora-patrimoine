'use client';
// EP-22 — which assistant the visitor sees (ASS-050). Mode AI available: the conversation first; « Je préfère répondre
// à des questions » opens the questionnaire, which stays in place. When the model cannot answer (not configured, cap
// reached, error, too slow), the questionnaire takes over without an error message (ASS-052). The choice is kept for the
// visit (session storage); a questionnaire address (`?q=`) opens the questionnaire.
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PublicSettings } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import { ConversationalAssistant } from './ConversationalAssistant';
import { GuidedAssistant } from './GuidedAssistant';
import s from './assistant.module.css';
import c from './conversation.module.css';

const CHOICE_KEY = 'dp_assistant_mode';

function storedChoice(): 'GUIDED' | null {
  try {
    return sessionStorage.getItem(CHOICE_KEY) === 'GUIDED' ? 'GUIDED' : null;
  } catch {
    return null;
  }
}
function storeChoice(v: 'GUIDED' | null): void {
  try {
    if (v) sessionStorage.setItem(CHOICE_KEY, v);
    else sessionStorage.removeItem(CHOICE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function AssistantSwitch({ settings, aiAvailable }: { settings: PublicSettings; aiAvailable: boolean }) {
  const params = useSearchParams();
  const [mode, setMode] = useState<'AI' | 'GUIDED' | null>(aiAvailable ? null : 'GUIDED');
  // Fallback for this visit: the model failed once, the questionnaire stays (no switch back offered).
  const [fellBack, setFellBack] = useState(false);

  useEffect(() => {
    if (!aiAvailable) return;
    setMode(params.get('q') !== null || storedChoice() === 'GUIDED' ? 'GUIDED' : 'AI');
    // only on arrival: the questionnaire then drives its own address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiAvailable]);

  const toQuestions = useCallback(() => {
    storeChoice('GUIDED');
    setMode('GUIDED');
  }, []);
  const fallback = useCallback(() => {
    setFellBack(true);
    setMode('GUIDED');
  }, []);

  if (mode === null) return <div className={s.shell} aria-busy="true" />;
  if (mode === 'AI') return <ConversationalAssistant settings={settings} onQuestions={toQuestions} onFallback={fallback} />;
  return (
    <>
      {aiAvailable && !fellBack ? (
        <div className={c.switchBack}>
          <button
            type="button"
            className={s.restart}
            onClick={() => {
              storeChoice(null);
              setMode('AI');
            }}
          >
            <Icon name="chat" size={16} />
            {t('ui.assistant.ai.toConversation')}
          </button>
        </div>
      ) : null}
      <GuidedAssistant settings={settings} />
    </>
  );
}
