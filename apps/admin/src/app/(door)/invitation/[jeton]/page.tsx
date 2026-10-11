// BO-003 — `/invitation/{jeton}`: the button of `S_INVITATION` (7 days). The token never leaves this page (SEC-040).
import type { Metadata } from 'next';
import { InvitationDoor } from '@/components/door/Doors';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-shell.setup.heading'), referrer: 'no-referrer' };

export default async function Page({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return <InvitationDoor token={jeton} />;
}
