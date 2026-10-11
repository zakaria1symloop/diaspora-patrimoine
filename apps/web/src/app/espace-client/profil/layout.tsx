// EC-50 … EC-53 — « Mon profil » and its sub-pages: Mes informations (EC-50), Sécurité (EC-51, `…/profil/securite`),
// Mes accords (EC-53, `…/profil/confidentialite`). « Notifications » (EC-52) arrives with package 5.1 (ECL-006).
import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/client-space/PageHeader';
import { ProfileTabs } from '@/components/client-space/profile/ProfileTabs';

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader eyebrow={t('ui.client.profile.eyebrow')} title={t('ui.client.profile.title')} />
      <ProfileTabs />
      {children}
    </>
  );
}
