// EA-21 — `/dossiers` (`dossier.read`, ROL-023).
import type { Metadata } from 'next';
import { DossiersList } from '@/components/dossiers/DossiersList';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-dossiers.title') };

export default async function Page() {
  if (!(await hasPermission('dossier.read'))) return <Forbidden />;
  return <DossiersList />;
}
