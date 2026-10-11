// EC-02 — /inscription (AUTH-001…AUTH-005).
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { AuthShell, CLIENT_BENEFITS, contactInfo } from '@/components/auth/AuthShell';
import { SignupForm } from '@/components/auth/SignupForm';
import { authMetadata, nextParam, simulationParam } from '@/components/auth/meta';
import s from '@/components/auth/auth.module.css';

export const metadata = authMetadata(t('ui.auth.signup.title'));

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <AuthShell scene="acces" benefits={CLIENT_BENEFITS}>
      <SignupForm next={nextParam(sp)} simulationId={simulationParam(sp)} contact={await contactInfo()} />
      <p className={s.door}>
        {t('ui.auth.common.partnerDoor')}
        <Link href="/partenaires/inscription" className={s.link}>
          {t('ui.auth.common.partnerDoorLink')}
        </Link>
      </p>
    </AuthShell>
  );
}
