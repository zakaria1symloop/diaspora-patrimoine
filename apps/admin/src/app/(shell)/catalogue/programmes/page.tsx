// EA-40 — `/catalogue/programmes` (`catalogue.read`, ROL-023).
import type { Metadata } from 'next';
import { ProgramsList } from '@/components/programs/ProgramsList';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-programs.title') };

export default async function Page() {
  if (!(await hasPermission('catalogue.read'))) return <Forbidden />;
  return <ProgramsList />;
}
