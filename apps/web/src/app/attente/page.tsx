// EP-29 — waiting page before opening and in acceptance (NAV-064): logo and wordmark, « Notre plateforme ouvre
// bientôt. », the contact address if set (D-045), the discreet « Accès réservé » link. 200, noindex.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Scene } from '@dp/ui';
import { Brand } from '@/components/layout/Brand';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { t } from '@/lib/i18n';
import { GateForm } from './GateForm';
import s from './page.module.css';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function WaitingPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  if (!env().SITE_GATE_PASSWORD) notFound();
  const [{ suite }, settings] = await Promise.all([searchParams, getSettings().catch(() => null)]);
  const email = settings?.['contact.email'];
  // Only an internal path is followed after the gate (no open redirect).
  const next = suite && suite.startsWith('/') && !suite.startsWith('//') && suite !== '/attente' ? suite : '/';
  return (
    <main className={s.page}>
      <div className={s.card}>
        <Brand tagline={null} homeLabel="" asLink={false} priority />
        <h1 className={s.title}>{t('ui.pages.waiting.title')}</h1>
        {email ? (
          <p className={s.contact}>
            {t('ui.pages.waiting.contactLabel')} <a href={`mailto:${email}`}>{email}</a>
          </p>
        ) : null}
        <GateForm next={next} />
      </div>
      <Scene name="attente" className={s.scene} />
    </main>
  );
}
