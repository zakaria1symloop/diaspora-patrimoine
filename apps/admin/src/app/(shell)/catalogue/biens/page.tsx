// EA-42 — `/catalogue/biens` (`catalogue.read`, ROL-023).
import type { Metadata } from 'next';
import { PropertiesList } from '@/components/properties/PropertiesList';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-properties.title') };

export default async function Page() {
  if (!(await hasPermission('catalogue.read'))) return <Forbidden />;
  return <PropertiesList />;
}
