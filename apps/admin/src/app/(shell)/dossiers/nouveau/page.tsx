// PIP-015 — `/dossiers/nouveau` (`dossier.create`).
import type { Metadata } from 'next';
import { DossierCreate } from '@/components/dossiers/DossierCreate';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-dossiers.create.title') };

export default async function Page() {
  if (!(await hasPermission('dossier.create'))) return <Forbidden />;
  return <DossierCreate />;
}
