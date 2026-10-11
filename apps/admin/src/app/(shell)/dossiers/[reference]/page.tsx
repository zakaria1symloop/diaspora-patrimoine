// EA-22 — `/dossiers/{référence}` (`dossier.read`); outside the perimeter of the reader: 404 (BO-015). The tab is in
// the address (`?onglet=`, BO-048).
import type { Metadata } from 'next';
import type { DossierDetail } from '@dp/contracts';
import { DossierView, type DossierTab } from '@/components/dossiers/DossierView';
import { Forbidden } from '@/components/shell/Page';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet, hasPermission } from '@/components/shell/server';
import { env } from '@/lib/env';
import { t } from '@/lib/i18n';

const TABS: DossierTab[] = ['apercu', 'biens', 'echanges', 'taches', 'historique'];

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }): Promise<Metadata> {
  const { reference } = await params;
  return { title: t('ui.admin-dossiers.detail.metaTitle', { reference: reference.toUpperCase() }) };
}

export default async function Page({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ onglet?: string }> }) {
  if (!(await hasPermission('dossier.read'))) return <Forbidden />;
  const [{ reference }, { onglet }] = await Promise.all([params, searchParams]);
  const r = await adminGet<DossierDetail>(`/admin/dossiers/${encodeURIComponent(reference)}`);
  if (!r.ok) return <ReadFailure result={r} />;
  const tab = TABS.includes(onglet as DossierTab) ? (onglet as DossierTab) : 'apercu';
  return <DossierView initial={r.data} tab={tab} webUrl={env().WEB_URL} />;
}
