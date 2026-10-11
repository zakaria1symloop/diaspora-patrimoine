// CTL-041 — `/catalogue/biens/nouveau` (`catalogue.write`); `?programme={id}` chooses the programme.
import type { Metadata } from 'next';
import { PropertyCreate } from '@/components/properties/PropertyCreate';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-properties.createPage.title') };

export default async function Page({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  if (!(await hasPermission('catalogue.write'))) return <Forbidden />;
  const { programme } = await searchParams;
  return <PropertyCreate programId={programme ?? null} />;
}
