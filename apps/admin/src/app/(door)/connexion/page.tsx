// EA-00 — `/connexion` (BO-002). `suite`: the internal page asked for before the sign-in (AUTH-023).
import type { Metadata } from 'next';
import { isSafeNextPath } from '@dp/contracts';
import { LoginDoor } from '@/components/door/Doors';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-shell.door.title') };

export default async function Page({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  return <LoginDoor next={isSafeNextPath(suite) ? suite : null} />;
}
