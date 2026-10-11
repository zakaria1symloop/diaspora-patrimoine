'use client';
// CAT-070 « Créer une alerte » (window `?alerte=1`, also opened by the guided assistant's link) and CAT-093
// « Enregistrer cette recherche » (window `?enregistrer=1`). The open window is in the address (CAT-003) and leaves it
// when closed. A saved search needs an account: without one, the window offers to sign in or create a space, and the
// search is saved on return (the window opens again with the session); signed in, it is saved at once on the account
// (`POST /client/alerts`, frequency NONE, CAT-093) — meanwhile it offers the alert, which needs no account.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { alertCriteriaOf, criteriaToSearch, type CatalogueCriteria, type CreateAccountAlertResult } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { useClientSession } from '@/lib/session-client';
import { QueryDialog, useQueryFlag } from '@/components/forms/QueryDialog';
import { t } from '@/lib/i18n';
import { AlertForm } from './AlertForm';
import s from './alerts.module.css';

export function AlertDialog({ criteria, chips, summary }: { criteria: CatalogueCriteria; chips: string[]; summary: string }) {
  const [open, close] = useQueryFlag('alerte');
  return (
    <QueryDialog open={open} onClose={close} title={t('ui.alerts.dialog.title')} closeLabel={t('ui.alerts.dialog.close')} width={480}>
      <AlertForm criteria={criteria} chips={chips} summary={summary} onClose={close} />
    </QueryDialog>
  );
}

export function SaveSearchDialog({ criteria, summary, alertsEnabled }: { criteria: CatalogueCriteria; summary: string; alertsEnabled: boolean }) {
  const [open, close] = useQueryFlag('enregistrer');
  const pathname = usePathname();
  const params = useSearchParams();
  // After signing in, back to this very search with the window open: the client space saves it (CAT-093).
  const back = `${pathname}?${params.toString()}`;
  const alertHref = `/programmes${criteriaToSearch(criteria)}${criteriaToSearch(criteria) ? '&' : '?'}alerte=1`;
  const session = useClientSession();
  return (
    <QueryDialog open={open} onClose={close} title={t('ui.alerts.saveSearch.title')} closeLabel={t('ui.alerts.dialog.close')} width={480}>
      {session.status === 'loading' ? (
        <p role="status">{t('ui.clientTools.alerts.saveSearch.saving')}</p>
      ) : session.status === 'authenticated' ? (
        <SaveOnAccount criteria={criteria} summary={summary} onClose={close} />
      ) : (
      <div className={s.form}>
        <p className={s.summaryLine}>
          <Icon name="search" size={20} />
          {t('ui.alerts.saveSearch.summary', { libelle: summary })}
        </p>
        <p>{t('ui.alerts.saveSearch.text')}</p>
        <div className={s.buttons}>
          <Link href={`/connexion?suite=${encodeURIComponent(back)}`} className={buttonClass('primary', 'M', true)}>
            <ButtonInner chevron size="M">
              {t('ui.alerts.saveSearch.login')}
            </ButtonInner>
          </Link>
          <Link href={`/inscription?suite=${encodeURIComponent(back)}`} className={buttonClass('secondary', 'M', true)}>
            <ButtonInner size="M">{t('ui.alerts.saveSearch.signup')}</ButtonInner>
          </Link>
        </div>
        {alertsEnabled ? (
          <p className={s.alternative}>
            {t('ui.alerts.saveSearch.orAlert')}{' '}
            <Link href={alertHref} scroll={false} replace>
              {t('ui.alerts.saveSearch.alert')}
            </Link>
          </p>
        ) : null}
      </div>
      )}
    </QueryDialog>
  );
}

/** CAT-093 — signed in: the search is saved on the account at once (named after CAT-022, renamable in EC-42). */
function SaveOnAccount({ criteria, summary, onClose }: { criteria: CatalogueCriteria; summary: string; onClose: () => void }) {
  const [state, setState] = useState<'saving' | 'SAVED' | 'ALREADY_EXISTS' | 'LIMIT' | 'ERROR'>('saving');
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const params = Object.fromEntries(new URLSearchParams(criteriaToSearch(alertCriteriaOf(criteria))));
    void apiCall<CreateAccountAlertResult>('/client/alerts', { body: { frequency: 'NONE', criteria: params }, retryOnAuth: true }).then((r) => {
      if (r.ok) setState(r.data.outcome === 'ALREADY_EXISTS' ? 'ALREADY_EXISTS' : 'SAVED');
      else setState(r.error?.reason === 'SEARCH_LIMIT' ? 'LIMIT' : 'ERROR');
    });
  }, [criteria]);
  if (state === 'saving') return <p role="status">{t('ui.clientTools.alerts.saveSearch.saving')}</p>;
  const ok = state === 'SAVED' || state === 'ALREADY_EXISTS';
  return (
    <div className={s.done} role="status">
      <span className={s.doneIcon} aria-hidden="true">
        <Icon name={ok ? 'star' : 'status-warning'} size={32} />
      </span>
      <p className={s.doneTitle}>
        {state === 'SAVED'
          ? t('ui.clientTools.alerts.saveSearch.saved')
          : state === 'ALREADY_EXISTS'
            ? t('ui.clientTools.alerts.saveSearch.exists')
            : state === 'LIMIT'
              ? t('ui.clientTools.alerts.searchLimit')
              : t('ui.clientTools.alerts.error')}
      </p>
      {ok ? <p>{t('ui.alerts.saveSearch.summary', { libelle: summary })}</p> : null}
      {state === 'SAVED' ? <p>{t('ui.clientTools.alerts.saveSearch.savedText')}</p> : null}
      <div className={s.buttons}>
        <Link href="/espace-client/alertes" className={buttonClass('primary', 'M', true)}>
          <ButtonInner chevron size="M">
            {t('ui.clientTools.alerts.saveSearch.see')}
          </ButtonInner>
        </Link>
        <button type="button" className={buttonClass('secondary', 'M', true)} onClick={onClose}>
          <ButtonInner size="M">{t('ui.clientTools.alerts.saveSearch.close')}</ButtonInner>
        </button>
      </div>
    </div>
  );
}

/** The two actions of the active-filters row (CAT-001) — the only labels of these actions; on phones too. */
export function AlertActions({ criteria, alertsEnabled }: { criteria: CatalogueCriteria; alertsEnabled: boolean }) {
  const qs = criteriaToSearch(criteria);
  const join = qs ? '&' : '?';
  return (
    <div className={s.actions}>
      {alertsEnabled ? (
        <Link href={`/programmes${qs}${join}alerte=1`} scroll={false} className={s.action}>
          <Icon name="bell" size={20} />
          {t('ui.catalogue.page.createAlert')}
        </Link>
      ) : null}
      <Link href={`/programmes${qs}${join}enregistrer=1`} scroll={false} className={s.actionQuiet}>
        <Icon name="star" size={20} />
        {t('ui.catalogue.page.saveSearch')}
      </Link>
    </div>
  );
}
