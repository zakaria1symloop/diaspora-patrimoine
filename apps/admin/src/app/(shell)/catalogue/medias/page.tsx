// EA-44 — `/catalogue/medias` (`catalogue.read`).
import type { Metadata } from 'next';
import { MediaLibrary } from '@/components/media/MediaLibrary';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-media.title') };

export default async function Page() {
  if (!(await hasPermission('catalogue.read'))) return <Forbidden />;
  return <MediaLibrary />;
}
