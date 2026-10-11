// EA-105 — `/notifications`: every notification of the signed-in staff member (BO-060).
import type { Metadata } from 'next';
import { NotificationsPage } from '@/components/notifications/NotificationsPage';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-shell.bell.title') };

export default function Page() {
  return <NotificationsPage />;
}
