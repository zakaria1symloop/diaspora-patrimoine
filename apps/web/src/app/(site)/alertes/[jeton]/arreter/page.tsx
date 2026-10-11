// NOT-022, NAV-061 — the one-click way out of an alert made without an account: the page stops the alert as soon as it
// opens in a browser and says it is done. Open in maintenance (the proxy lets `/alertes/{jeton}/arreter` through).
import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { StopAlert } from '@/components/discovery/AlertManage';
import { LineArt } from '@/components/discovery/LineArt';
import p from '@/components/discovery/pages.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: t('ui.alerts.page.stopTitle'),
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function StopAlertPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return (
    <div className={p.tokenPage}>
      <div className={`container ${p.tokenGrid}`}>
        <div className={p.tokenContent}>
          <p className={p.eyebrow}>{t('ui.alerts.page.eyebrow')}</p>
          <h1 className={p.title}>{t('ui.alerts.page.stopTitle')}</h1>
          <StopAlert token={jeton} />
        </div>
        <LineArt name="letter" className={p.tokenArt} />
      </div>
    </div>
  );
}
