// EP-27 — « Préférences d'e-mail sans connexion » (PRO-031, NOT-022): the groups of the record the link belongs to.
// Open in maintenance (NAV-061), never cached nor indexed, no referrer (TRV-053). A revoked token (address changed,
// record erased) answers 410: « Ce lien a expiré ou a déjà été utilisé. » with « Recevoir un nouveau lien ».
import type { Metadata } from 'next';
import Link from 'next/link';
import type { PreferencesView } from '@dp/contracts';
import { ApiError, apiGet } from '@/lib/api';
import { t } from '@/lib/i18n';
import { NewLinkForm } from '@/components/discovery/AlertManage';
import { PreferencesForm } from '@/components/discovery/PreferencesForm';
import { LineArt } from '@/components/discovery/LineArt';
import p from '@/components/discovery/pages.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: t('ui.preferences.page.seoTitle'),
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

async function load(token: string): Promise<PreferencesView | 'gone'> {
  try {
    return await apiGet<PreferencesView>(`/public/preferences/${encodeURIComponent(token)}`, { revalidate: 0 });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 410 || e.status === 404)) return 'gone';
    throw e;
  }
}

export default async function PreferencesPage({ params, searchParams }: { params: Promise<{ jeton: string }>; searchParams: Promise<{ arret?: string }> }) {
  const [{ jeton }, { arret }] = await Promise.all([params, searchParams]);
  const view = await load(jeton);
  return (
    <div className={p.tokenPage}>
      <div className={`container ${p.tokenGrid}`}>
        <div className={p.tokenContent}>
          <p className={p.eyebrow}>{t('ui.preferences.page.eyebrow')}</p>
          {view === 'gone' ? (
            <>
              <h1 className={p.title}>{t('ui.preferences.page.goneTitle')}</h1>
              <p>{t('ui.preferences.page.goneText')}</p>
              <NewLinkForm path="/preferences/links" label={t('ui.preferences.page.newLinkEmail')} sentText={t('ui.preferences.page.newLinkSent')} />
              <p className={p.muted}>
                <Link href="/contact">{t('ui.preferences.page.contact')}</Link>
              </p>
            </>
          ) : (
            <>
              <h1 className={p.title}>{t('ui.preferences.page.title')}</h1>
              <PreferencesForm token={jeton} initial={view} unsubscribe={arret === '1'} />
            </>
          )}
        </div>
        <LineArt name="letter" className={p.tokenArt} />
      </div>
    </div>
  );
}
