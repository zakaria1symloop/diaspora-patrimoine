// CRM-080 — `/clients/{id}/fusion?avec={autre}` (`client.merge`).
import type { Metadata } from 'next';
import { MergeScreen } from '@/components/clients/merge/MergeScreen';
import { Forbidden, NotFoundState } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-client-merge.title') };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ avec?: string }> }) {
  if (!(await hasPermission('client.merge'))) return <Forbidden />;
  const [{ id }, { avec }] = await Promise.all([params, searchParams]);
  if (!avec) return <NotFoundState />;
  return <MergeScreen clientId={id} otherId={avec} />;
}
