// EA-10 — `/demandes` (`lead.read`, ROL-023), in reading (package 2.11).
import type { Metadata } from 'next';
import { LeadsList } from '@/components/leads/LeadsList';
import { Forbidden } from '@/components/shell/Page';
import { hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-leads.title') };

export default async function Page() {
  if (!(await hasPermission('lead.read'))) return <Forbidden />;
  return <LeadsList />;
}
