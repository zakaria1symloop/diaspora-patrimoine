// CTL-022 — `/catalogue/programmes/nouveau` (`catalogue.write`).
import type { Metadata } from 'next';
import { ProgramCreate } from '@/components/programs/ProgramCreate';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-programs.createPage.title') };

export default async function Page({ searchParams }: { searchParams: Promise<{ promoteur?: string }> }) {
  if (!(await hasPermission('catalogue.write'))) return <Forbidden />;
  const { promoteur } = await searchParams;
  return <ProgramCreate promoterId={promoteur ?? null} />;
}
