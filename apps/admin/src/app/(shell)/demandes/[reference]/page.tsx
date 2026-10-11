// EA-11 — `/demandes/{référence}` (`lead.read`); outside the perimeter of the reader: 404 (BO-015).
import type { Metadata } from 'next';
import type { LeadDetail } from '@dp/contracts';
import { LeadDetailView } from '@/components/leads/LeadDetailView';
import { Forbidden } from '@/components/shell/Page';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet, hasPermission } from '@/components/shell/server';
import { env } from '@/lib/env';
import { t } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }): Promise<Metadata> {
  const { reference } = await params;
  return { title: t('ui.admin-leads.detail.title', { reference: reference.toUpperCase() }) };
}

export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  if (!(await hasPermission('lead.read'))) return <Forbidden />;
  const { reference } = await params;
  const r = await adminGet<LeadDetail>(`/admin/leads/${encodeURIComponent(reference)}`);
  if (!r.ok) return <ReadFailure result={r} />;
  return <LeadDetailView lead={r.data} webUrl={env().WEB_URL} />;
}
