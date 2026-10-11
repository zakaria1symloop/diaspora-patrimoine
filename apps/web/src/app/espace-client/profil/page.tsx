// EC-50 — Mes informations: five sections (PRO-001 … PRO-004) and the trusted people (PRO-040).
import type { ClientMe, ClientProfile, ClientSpaceSummary, TrustedPerson } from '@dp/contracts';
import { t } from '@/lib/i18n';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { ProfileForm } from '@/components/client-space/profile/ProfileForm';
import { TrustedPeople } from '@/components/client-space/profile/TrustedPeople';

export const metadata = { title: t('ui.client.profile.title') };

export default async function ProfilePage() {
  const [profile, me, contacts, space] = await Promise.all([
    spaceGet<ClientProfile>('/client/me/profile'),
    spaceGet<ClientMe>('/client/me'),
    spaceGet<{ data: TrustedPerson[] }>('/client/contacts'),
    spaceGet<ClientSpaceSummary>('/client/space'),
  ]);
  if (!profile.ok) return <SpaceReadFailure result={profile} />;
  if (!me.ok) return <SpaceReadFailure result={me} />;
  return (
    <ProfileForm profile={profile.data} hasPassword={me.data.hasPassword}>
      {contacts.ok ? <TrustedPeople initial={contacts.data.data} timeZone={space.ok ? space.data.timeZone : 'Europe/Paris'} /> : <SpaceReadFailure result={contacts} />}
    </ProfileForm>
  );
}
