'use client';
// TRV-122 « Affichage simplifié » on the public site: a switch in the footer and in the phone menu, kept in the browser
// (`dp_simple_mode`, the same key as the client space); the attribute `data-simple` on <html> is set before the first
// paint by `simpleModeBootScript` (no jump), and drives the CSS of the pages; a band under the header says it is on
// and gives the way back. The functions never change: only the display gets lighter.
import { useEffect, useState } from 'react';
import { LocalKeys } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import s from './SimpleMode.module.css';

const EVENT = 'dp:simple-mode';

/** Inline script for <head>: the public site only (the client space carries the attribute on its own frame). */
export const simpleModeBootScript = `try{if(!location.pathname.startsWith('/espace-client')&&localStorage.getItem('${LocalKeys.simpleMode}')==='1')document.documentElement.setAttribute('data-simple','')}catch(e){}`;

function read(): boolean {
  try {
    return localStorage.getItem(LocalKeys.simpleMode) === '1';
  } catch {
    return false;
  }
}

function write(on: boolean): void {
  try {
    if (on) localStorage.setItem(LocalKeys.simpleMode, '1');
    else localStorage.removeItem(LocalKeys.simpleMode);
  } catch {
    /* storage unavailable: the choice lasts for the page */
  }
  if (on) document.documentElement.setAttribute('data-simple', '');
  else document.documentElement.removeAttribute('data-simple');
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo({ top: 0 });
}

function useSimple(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(read());
    const sync = () => setOn(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return on;
}

export function SimpleModeSwitch({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const on = useSimple();
  return (
    <button type="button" role="switch" aria-checked={on} className={[s.switch, tone === 'dark' && s.dark].filter(Boolean).join(' ')} onClick={() => write(!on)}>
      <span className={s.label}>{t('ui.common.simpleMode.label')}</span>
      <span className={s.track} aria-hidden="true">
        <span className={s.thumb} />
      </span>
    </button>
  );
}

export function SimpleModeBand() {
  const on = useSimple();
  if (!on) return null;
  return (
    <div className={s.band} role="status">
      <Icon name="check" size={16} />
      <span>{t('ui.common.simpleMode.on')}</span>
      <button type="button" className={s.back} onClick={() => write(false)}>
        {t('ui.common.simpleMode.off')}
      </button>
    </div>
  );
}
