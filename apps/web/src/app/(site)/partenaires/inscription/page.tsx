// EP-32 — /partenaires/inscription (ACP-080, ACP-081, ACP-082): two short steps, no document.
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { PartnerSignupForm } from '@/components/auth/PartnerSignupForm';
import { authMetadata } from '@/components/auth/meta';
import s from '@/components/auth/auth.module.css';

export const metadata = authMetadata(t('ui.auth.partner.signup.title'));

export default async function PartnerSignupPage() {
  return (
    <AuthShell scene="partenaire">
      <PartnerSignupForm contact={await contactInfo(true)} />
      <p className={s.door}>
        {t('ui.auth.common.clientDoor')}
        <Link href="/inscription" className={s.link}>
          {t('ui.auth.common.clientDoorLink')}
        </Link>
      </p>
    </AuthShell>
  );
}
