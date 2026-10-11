// BO-002 — `/reinitialisation/{jeton}`: the button of `S_PASSWORD_RESET` (1 hour, once).
import type { Metadata } from 'next';
import { ResetDoor } from '@/components/door/Doors';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.auth.reset.title'), referrer: 'no-referrer' };

export default async function Page({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return <ResetDoor token={jeton} />;
}
