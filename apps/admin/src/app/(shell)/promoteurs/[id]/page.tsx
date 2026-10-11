// EA-51 — `/promoteurs/{id}` (`promoter.read`); tabs by `?onglet=`.
import type { Metadata } from 'next';
import type { AdminPromoterDetail } from '@dp/contracts';
import { PromoterView } from '@/components/promoters/PromoterView';
import { Forbidden } from '@/components/shell/Page';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet, hasPermission } from '@/components/shell/server';
import { env } from '@/lib/env';
import { t } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await adminGet<AdminPromoterDetail>(`/admin/promoters/${encodeURIComponent(id)}`);
  return { title: r.ok ? r.data.name : t('ui.admin-promoters.title') };
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  if (!(await hasPermission('promoter.read'))) return <Forbidden />;
  const [{ id }, { onglet }] = await Promise.all([params, searchParams]);
  const r = await adminGet<AdminPromoterDetail>(`/admin/promoters/${encodeURIComponent(id)}`);
  if (!r.ok) return <ReadFailure result={r} />;
  return <PromoterView key={r.data.id} promoter={r.data} tab={onglet} webUrl={env().WEB_URL} />;
}
