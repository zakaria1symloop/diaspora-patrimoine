// EA-12 — `/clients` (`client.read`, ROL-023).
import type { Metadata } from 'next';
import { ClientsList } from '@/components/clients/ClientsList';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-clients.title') };

export default async function Page() {
  if (!(await hasPermission('client.read'))) return <Forbidden />;
  return <ClientsList />;
}
