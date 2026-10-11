// CRM-025 — `/demandes/nouvelle` (`lead.create`), « + Créer › Demande ».
import type { Metadata } from 'next';
import { LeadCreateForm } from '@/components/leads/LeadCreateForm';
import { Forbidden } from '@/components/shell/Page';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet, hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-leads.create.title') };

export default async function Page() {
  if (!(await hasPermission('lead.create'))) return <Forbidden />;
  const r = await adminGet<{ data: { code: string; name: string }[] }>('/public/countries');
  if (!r.ok) return <ReadFailure result={r} />;
  return <LeadCreateForm countries={r.data.data} />;
}
