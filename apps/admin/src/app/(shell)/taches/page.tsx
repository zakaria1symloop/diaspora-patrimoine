// EA-30 — `/taches` (`task.read`, ROL-023).
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { TasksBoard } from '@/components/tasks/TasksBoard';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-tasks.title') };

export default async function Page() {
  if (!(await hasPermission('task.read'))) return <Forbidden />;
  return (
    <Suspense>
      <TasksBoard />
    </Suspense>
  );
}
