'use client';
// EP-27 (PRO-030, PRO-031) — e-mail preferences without signing in: « Indispensables » always on, with what it holds;
// one switch per group, saved at once (« Préférence enregistrée. »); « Ne garder que l'indispensable ». The one-click
// unsubscription (`?arret=1`) cuts the group of the e-mail first and says « C'est fait. Vous ne recevrez plus ces
// e-mails. », with « Gérer mes autres préférences ».
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ClientPreferenceGroup, PreferencesView, UnsubscribeResult } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { showToast } from '@/lib/discovery';
import { errorText, publicCall } from '@/lib/public-call';
import { t } from '@/lib/i18n';
import p from './pages.module.css';

export function PreferencesForm({ token, initial, unsubscribe }: { token: string; initial: PreferencesView; unsubscribe: boolean }) {
  const [view, setView] = useState(initial);
  const [stage, setStage] = useState<'unsubscribing' | 'unsubscribed' | 'list'>(unsubscribe ? 'unsubscribing' : 'list');
  const [group, setGroup] = useState<ClientPreferenceGroup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!unsubscribe || ran.current) return;
    ran.current = true;
    void (async () => {
      const r = await publicCall<UnsubscribeResult>('POST', `/unsubscribe/${token}`);
      if (!r.ok) {
        showToast({ message: errorText(r), tone: 'error' });
        return setStage('list');
      }
      setGroup(r.data.group);
      const fresh = await publicCall<PreferencesView>('GET', `/preferences/${token}`);
      if (fresh.ok) setView(fresh.data);
      setStage('unsubscribed');
    })();
  }, [token, unsubscribe]);

  const save = async (body: Record<string, unknown>, done: string) => {
    setBusy(JSON.stringify(body));
    const r = await publicCall<PreferencesView>('PATCH', `/preferences/${token}`, body);
    setBusy(null);
    if (!r.ok) return showToast({ message: errorText(r) || t('ui.preferences.page.error'), tone: 'error' });
    setView(r.data);
    showToast({ message: done });
  };

  if (stage === 'unsubscribing') {
    return (
      <p className={p.loading} role="status">
        <span className={p.dot} aria-hidden="true" />
        {t('ui.preferences.page.unsubscribing')}
      </p>
    );
  }
  if (stage === 'unsubscribed') {
    return (
      <div className={p.panel} role="status">
        <p className={p.doneTitle}>
          <Icon name="status-success" size={24} />
          {t('ui.preferences.page.unsubscribed')}
        </p>
        {group ? <p className={p.muted}>{t('ui.preferences.page.unsubscribedGroup', { groupe: t(`ui.preferences.groups.${group}.label`) })}</p> : null}
        <button type="button" className={p.linkButton} onClick={() => setStage('list')}>
          {t('ui.preferences.page.manageOthers')}
        </button>
      </div>
    );
  }

  const anyOn = view.groups.some((g) => g.emailEnabled);
  return (
    <div className={p.stack}>
      <p>{t('ui.preferences.page.intro', { email: view.emailMasked })}</p>
      <ul className={p.prefList} role="list">
        <li className={p.prefRow}>
          <div>
            <p className={p.prefLabel}>{t('ui.preferences.page.essential')}</p>
            <p className={p.muted}>{t('ui.preferences.page.essentialItems')}</p>
            <p className={p.muted}>{t('ui.preferences.page.essentialText')}</p>
          </div>
          <span className={p.always}>{t('ui.preferences.page.alwaysOn')}</span>
        </li>
        {view.groups.map((g) => (
          <li key={g.group} className={p.prefRow}>
            <div>
              <p className={p.prefLabel} id={`pref-${g.group}`}>
                {t(`ui.preferences.groups.${g.group}.label`)}
              </p>
              <p className={p.muted}>{t(`ui.preferences.groups.${g.group}.text`)}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={g.emailEnabled}
              aria-labelledby={`pref-${g.group}`}
              className={p.prefSwitch}
              disabled={busy !== null}
              onClick={() => void save({ group: g.group, emailEnabled: !g.emailEnabled }, t('ui.preferences.page.saved'))}
            >
              <span className={p.prefKnob} aria-hidden="true" />
              <span className={p.prefState}>
                {t('ui.preferences.page.email')} · {g.emailEnabled ? t('ui.preferences.page.on') : t('ui.preferences.page.off')}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {anyOn ? (
        <div>
          <Button variant="secondary" size="M" pending={busy === JSON.stringify({ essentialOnly: true })} onClick={() => void save({ essentialOnly: true }, t('ui.preferences.page.essentialOnlyDone'))}>
            {t('ui.preferences.page.essentialOnly')}
          </Button>
        </div>
      ) : null}
      <p className={p.muted}>
        <Link href="/contact">{t('ui.preferences.page.contact')}</Link>
      </p>
    </div>
  );
}
