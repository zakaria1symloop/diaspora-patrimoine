// EC-01 — /connexion (AUTH-020…AUTH-033), with the steps EC-08, EC-03 and EC-09 of AUTH-022 on the same page.
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { AuthShell, CLIENT_BENEFITS, contactInfo } from '@/components/auth/AuthShell';
import { ClientLogin } from '@/components/auth/ClientLogin';
import { authMetadata, nextParam, simulationParam } from '@/components/auth/meta';
import s from '@/components/auth/auth.module.css';

export const metadata = authMetadata(t('ui.auth.login.title'));

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = nextParam(sp);
  const simulationId = simulationParam(sp);
  const signupQuery = new URLSearchParams({ ...(next ? { suite: next } : {}), ...(simulationId ? { simulation: simulationId } : {}) }).toString();
  return (
    <AuthShell scene="acces" benefits={CLIENT_BENEFITS}>
      <ClientLogin
        next={next}
        simulationId={simulationId}
        contact={await contactInfo()}
        footer={
          <>
            <p className={s.door}>
              {t('ui.auth.login.signupPrompt')}
              <Link href={signupQuery ? `/inscription?${signupQuery}` : '/inscription'} className={s.link}>
                {t('ui.auth.login.signup')}
              </Link>
            </p>
            <p className={s.door}>
              {t('ui.auth.common.partnerDoor')}
              <Link href="/partenaires/connexion" className={s.link}>
                {t('ui.auth.common.partnerDoorLink')}
              </Link>
            </p>
          </>
        }
      />
    </AuthShell>
  );
}
