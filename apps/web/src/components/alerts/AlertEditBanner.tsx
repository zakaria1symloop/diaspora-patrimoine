'use client';
// SFA-031 « Modifier les critères » — from « Mes alertes et recherches », the catalogue opens with the alert's criteria
// (the page sets the target for the tab, TRV-092 — the catalogue keeps only its own criteria in the address); the banner says which alert is being changed and its main button is « Mettre à jour
// l'alerte » (« … la recherche » for a saved search). The target survives filter changes (kept for the tab session,
// TRV-092) until the update or « Annuler ». Signed-in clients only; nothing shows otherwise.
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { alertCriteriaOf, criteriaToSearch, type AccountAlert, type AccountAlertsResponse, type CatalogueCriteria } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import s from './alerts.module.css';

export const ALERT_EDIT_KEY = 'dp_alert_edit';
const KEY = ALERT_EDIT_KEY;
const UUID = /^[0-9a-f-]{36}$/i;

function readKey(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function writeKey(v: string | null) {
  try {
    if (v) sessionStorage.setItem(KEY, v);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage refused: the banner lives with the address only */
  }
}

export function AlertEditBanner({ criteria }: { criteria: CatalogueCriteria }) {
  const params = useSearchParams();
  const router = useRouter();
  const [alert, setAlert] = useState<AccountAlert | null>(null);
  const [pending, setPending] = useState(false);
  const fromUrl = params.get('modifier-alerte');

  useEffect(() => {
    const id = fromUrl && UUID.test(fromUrl) ? fromUrl : readKey();
    if (!id) return setAlert(null);
    let alive = true;
    void apiCall<AccountAlertsResponse>('/client/alerts', { retryOnAuth: true }).then((r) => {
      if (!alive) return;
      const found = r.ok ? [...r.data.alerts, ...r.data.searches].find((a) => a.id === id) ?? null : null;
      writeKey(found ? id : null);
      setAlert(found);
    });
    return () => {
      alive = false;
    };
  }, [fromUrl]);

  if (!alert) return null;
  const search = alert.kind === 'SEARCH';
  const done = () => {
    writeKey(null);
    setAlert(null);
    router.replace(`/programmes${criteriaToSearch(criteria)}`, { scroll: false });
  };
  const update = async () => {
    setPending(true);
    const body = Object.fromEntries(new URLSearchParams(criteriaToSearch(alertCriteriaOf(criteria))));
    const r = await apiCall<AccountAlert>(`/client/alerts/${alert.id}`, { method: 'PATCH', body: { criteria: body }, retryOnAuth: true });
    setPending(false);
    if (!r.ok) return showToast({ message: t('ui.clientTools.alerts.error'), tone: 'error' });
    showToast({ message: t('ui.clientTools.alerts.editBanner.updated'), tone: 'success', link: { label: t('ui.clientTools.alerts.saveSearch.see'), href: '/espace-client/alertes' } });
    done();
  };
  return (
    <div className={s.editBanner} role="region" aria-label={alert.label}>
      <Icon name="sliders" size={20} />
      <p>{t(search ? 'ui.clientTools.alerts.editBanner.searchText' : 'ui.clientTools.alerts.editBanner.text', { libelle: alert.label })}</p>
      <div className={s.editBannerActions}>
        <Button variant="tool" size="M" onClick={() => void update()} pending={pending}>
          {t(search ? 'ui.clientTools.alerts.editBanner.updateSearch' : 'ui.clientTools.alerts.editBanner.update')}
        </Button>
        <Button variant="tertiary" size="M" onClick={done}>
          {t('ui.clientTools.alerts.editBanner.cancel')}
        </Button>
      </div>
    </div>
  );
}
