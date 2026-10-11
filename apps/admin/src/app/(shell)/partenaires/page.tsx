// EA-47 — `/partenaires` (`content.manage`, CTL-170).
import type { Metadata } from 'next';
import { PartnersList } from '@/components/partners/PartnersList';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-promoters.partners.title') };

export default async function Page() {
  if (!(await hasPermission('content.manage'))) return <Forbidden />;
  return <PartnersList />;
}
