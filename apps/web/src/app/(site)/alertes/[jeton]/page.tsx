// EP-26 — « Confirmer, prolonger ou arrêter une alerte » (SFA-035), reached from the alert e-mails, without signing in.
// Never cached, never indexed, no referrer (the address carries a token, TRV-053). Unknown, expired or stopped link:
// « Ce lien a expiré ou a déjà été utilisé. » with « Recevoir un nouveau lien » (TRV-125) and the way to the catalogue.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { AlertView } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { ApiError, apiGet } from '@/lib/api';
import { t } from '@/lib/i18n';
import { AlertManage, NewLinkForm } from '@/components/discovery/AlertManage';
import { LineArt } from '@/components/discovery/LineArt';
import p from '@/components/discovery/pages.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: t('ui.alerts.page.seoTitle'),
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Params = Promise<{ jeton: string }>;

async function load(token: string): Promise<AlertView | 'gone'> {
  try {
    return await apiGet<AlertView>(`/public/alerts/${encodeURIComponent(token)}`, { revalidate: 0 });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 410 || e.status === 404)) return 'gone';
    throw e;
  }
}

export default async function AlertPage({ params }: { params: Params }) {
  const { jeton } = await params;
  const view = await load(jeton);
  return (
    <div className={p.tokenPage}>
      <div className={`container ${p.tokenGrid}`}>
        <div className={p.tokenContent}>
          <p className={p.eyebrow}>{t('ui.alerts.page.eyebrow')}</p>
          {view === 'gone' ? (
            <>
              <h1 className={p.title}>{t('ui.alerts.page.goneTitle')}</h1>
              <p>{t('ui.alerts.page.goneText')}</p>
              <NewLinkForm path="/alerts/links" label={t('ui.alerts.page.newLinkEmail')} sentText={t('ui.alerts.page.newLinkSent')} />
              <p className={p.muted}>
                <Link href="/inscription?suite=%2Fespace-client%2Falertes">{t('ui.alerts.page.createSpace')}</Link>
              </p>
              <Link href="/programmes" className={p.cta}>
                {t('ui.alerts.page.backToCatalogue')}
                <Icon name="chevron-right" size={16} />
              </Link>
            </>
          ) : (
            <>
              <h1 className={p.title}>{t('ui.alerts.page.seoTitle')}</h1>
              <AlertManage token={jeton} initial={view} />
            </>
          )}
        </div>
        <LineArt name="bell" className={p.tokenArt} />
      </div>
    </div>
  );
}
