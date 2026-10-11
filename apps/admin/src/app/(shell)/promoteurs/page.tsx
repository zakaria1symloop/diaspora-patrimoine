// EA-50 — `/promoteurs` (`promoter.read`, ROL-023).
import type { Metadata } from 'next';
import { PromotersList } from '@/components/promoters/PromotersList';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-promoters.title') };

export default async function Page() {
  if (!(await hasPermission('promoter.read'))) return <Forbidden />;
  return <PromotersList />;
}
