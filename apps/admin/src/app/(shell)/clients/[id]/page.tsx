// EA-13 — `/clients/{id}` (`client.read`); outside the perimeter: 404 (BO-015); a record absorbed by a merge redirects to
// the record it was merged into (CRM-080 point 7).
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ClientDetailResponse } from '@dp/contracts';
import { ClientRecord } from '@/components/clients/ClientRecord';
import { Forbidden } from '@/components/shell/Page';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet, hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-clients.recordTitle') };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  if (!(await hasPermission('client.read'))) return <Forbidden />;
  const [{ id }, { onglet }] = await Promise.all([params, searchParams]);
  const r = await adminGet<ClientDetailResponse>(`/admin/clients/${encodeURIComponent(id)}`);
  if (!r.ok) return <ReadFailure result={r} />;
  if ('mergedIntoId' in r.data) redirect(`/clients/${r.data.mergedIntoId}${onglet ? `?onglet=${onglet}` : ''}`);
  return <ClientRecord client={r.data} tab={onglet ?? 'apercu'} />;
}
