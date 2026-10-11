// TRV-084, NAV-061 — maintenance page, served with 503 and Retry-After by the proxy.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatTime } from '@dp/i18n';
import { ErrorPage } from '@/components/ErrorPage';
import { getSettings } from '@/lib/settings';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  const settings = await getSettings();
  if (!settings['maintenance.enabled']) notFound();
  const until = settings['maintenance.until'];
  const tz = settings['business.calendar.timezone'];
  return (
    <ErrorPage title={t('ui.pages.error.maintenance.title')} scene="attente">
      {until ? <p>{t('ui.pages.error.maintenance.until', { heure: formatTime(until, tz) })}</p> : null}
    </ErrorPage>
  );
}
