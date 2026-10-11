// CRM-041 — `/clients/nouveau` (`client.create`), « + Créer › Client ».
import type { Metadata } from 'next';
import { ClientCreateForm } from '@/components/clients/ClientCreateForm';
import { Forbidden } from '@/components/shell/Page';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet, hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-clients.create.title') };

export default async function Page() {
  if (!(await hasPermission('client.create'))) return <Forbidden />;
  const r = await adminGet<{ data: { code: string; name: string }[] }>('/public/countries');
  if (!r.ok) return <ReadFailure result={r} />;
  return <ClientCreateForm countries={r.data.data} />;
}
