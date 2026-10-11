// EC-51 — Sécurité: password, second factor (4 steps), connected devices (PRO-020, PRO-021).
import type { ClientMe, ClientSpaceSummary, SessionItem } from '@dp/contracts';
import { t } from '@/lib/i18n';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { SecurityPanel } from '@/components/client-space/profile/SecurityPanel';

export const metadata = { title: t('ui.client.security.title') };

export default async function SecurityPage() {
  const [me, sessions, space] = await Promise.all([spaceGet<ClientMe>('/client/me'), spaceGet<{ data: SessionItem[] }>('/client/me/sessions'), spaceGet<ClientSpaceSummary>('/client/space')]);
  if (!me.ok) return <SpaceReadFailure result={me} />;
  if (!sessions.ok) return <SpaceReadFailure result={sessions} />;
  return (
    <SecurityPanel
      email={me.data.email}
      hasPassword={me.data.hasPassword}
      twoFactorEnabled={me.data.twoFactorEnabled}
      sessions={sessions.data.data}
      timeZone={space.ok ? space.data.timeZone : 'Europe/Paris'}
    />
  );
}
