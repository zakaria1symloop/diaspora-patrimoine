// EA-31 — `/agenda` (`appointment.read`, ROL-023).
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AgendaPage } from '@/components/agenda/AgendaPage';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-agenda.title') };

export default async function Page() {
  if (!(await hasPermission('appointment.read'))) return <Forbidden />;
  return (
    <Suspense>
      <AgendaPage />
    </Suspense>
  );
}
