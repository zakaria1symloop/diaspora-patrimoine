// EC-53 — Mes accords (PRO-051). « Mes données » (export, other requests) and the deletion of the account arrive with
// package 6.5 (ECL-006: nothing leads to a function that is not there).
import type { ClientAgreements, ClientSpaceSummary } from '@dp/contracts';
import { t } from '@/lib/i18n';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { AgreementsPanel } from '@/components/client-space/profile/AgreementsPanel';

export const metadata = { title: t('ui.client.privacy.title') };

export default async function AgreementsPage() {
  const [r, space] = await Promise.all([spaceGet<ClientAgreements>('/client/me/consents'), spaceGet<ClientSpaceSummary>('/client/space')]);
  if (!r.ok) return <SpaceReadFailure result={r} />;
  return <AgreementsPanel initial={r.data} timeZone={space.ok ? space.data.timeZone : 'Europe/Paris'} />;
}
