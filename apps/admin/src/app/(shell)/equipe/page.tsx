// EA-96 — `/equipe` (`user.read`, ROL-023).
import type { Metadata } from 'next';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { TeamList } from '@/components/team/TeamList';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-team.title') };

export default async function Page() {
  if (!(await hasPermission('user.read'))) return <Forbidden />;
  return <TeamList />;
}
