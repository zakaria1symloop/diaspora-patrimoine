// EA-43 — `/catalogue/biens/{id}` (`catalogue.read`); tabs by `?onglet=`.
import type { Metadata } from 'next';
import type { AdminPropertyDetail } from '@dp/contracts';
import { PropertyView } from '@/components/properties/PropertyView';
import { Forbidden } from '@/components/shell/Page';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet, hasPermission } from '@/components/shell/server';
import { env } from '@/lib/env';
import { t } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await adminGet<AdminPropertyDetail>(`/admin/properties/${encodeURIComponent(id)}`);
  return { title: r.ok ? `${r.data.reference} · ${r.data.title}` : t('ui.admin-properties.title') };
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  if (!(await hasPermission('catalogue.read'))) return <Forbidden />;
  const [{ id }, { onglet }] = await Promise.all([params, searchParams]);
  const r = await adminGet<AdminPropertyDetail>(`/admin/properties/${encodeURIComponent(id)}`);
  if (!r.ok) return <ReadFailure result={r} />;
  return <PropertyView key={r.data.id} property={r.data} tab={onglet} webUrl={env().WEB_URL} />;
}
