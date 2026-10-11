// EA-46 — `/catalogue/mise-en-avant` (`catalogue.read`; pins with `catalogue.publish`, CTL-150).
import type { Metadata } from 'next';
import { FeaturedView } from '@/components/properties/FeaturedView';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-properties.featured.title') };

export default async function Page() {
  if (!(await hasPermission('catalogue.read'))) return <Forbidden />;
  return <FeaturedView />;
}
