// ECL-033 — several dossiers (rare, CYC-002): the list — reference, property, step, state, last activity; the most
// recent active dossier first. With a single dossier, its page.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ClientSpaceSummary, DossierListItem } from '@dp/contracts';
import { buttonClass, ButtonInner } from '@dp/ui';
import { t } from '@/lib/i18n';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { PageHeader } from '@/components/client-space/PageHeader';
import { EmptyState } from '@/components/client-space/EmptyState';
import { dossierPath } from '@/components/client-space/menu';
import { DossierList } from '@/components/client-space/dossier/DossierList';

export const metadata = { title: t('ui.client.dossier.list.title') };

export default async function DossiersPage() {
  const [r, space] = await Promise.all([spaceGet<{ data: DossierListItem[] }>('/client/dossiers'), spaceGet<ClientSpaceSummary>('/client/space')]);
  if (!r.ok) return <SpaceReadFailure result={r} />;
  const list = r.data.data;
  if (list.length === 1) redirect(dossierPath(list[0]!.reference));
  const timeZone = space.ok ? space.data.timeZone : 'Europe/Paris';
  return (
    <>
      <PageHeader eyebrow={t('ui.client.dossier.eyebrow')} title={t('ui.client.dossier.list.title')} intro={list.length > 1 ? t('ui.client.dossier.list.intro') : undefined} />
      {list.length === 0 ? (
        <EmptyState
          icon="folder"
          title={t('ui.client.dashboard.welcome.title')}
          text={t('ui.client.dashboard.welcome.text')}
          actions={
            <Link href="/programmes" className={buttonClass('tool', 'L')}>
              <ButtonInner size="L" chevron>
                {t('ui.client.dashboard.welcome.browse')}
              </ButtonInner>
            </Link>
          }
        />
      ) : (
        <DossierList items={list} timeZone={timeZone} shownReference={space.ok ? space.data.shownDossierReference : null} />
      )}
    </>
  );
}
