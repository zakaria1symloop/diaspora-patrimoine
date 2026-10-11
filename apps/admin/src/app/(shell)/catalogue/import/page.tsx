// EA-45 — `/catalogue/import` (`catalogue.import`); `?programme={id}` chooses the programme, `?import={id}` opens a job.
import type { Metadata } from 'next';
import { LotImport } from '@/components/import/LotImport';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-media.import.title') };

export default async function Page() {
  if (!(await hasPermission('catalogue.import'))) return <Forbidden />;
  return <LotImport />;
}
