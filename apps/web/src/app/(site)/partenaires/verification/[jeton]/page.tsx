// ACP-082, AUTH-013 — the partner's verification link, back on /partenaires/connexion.
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { VerifyEmailView } from '@/components/auth/TokenPages';
import { authMetadata } from '@/components/auth/meta';

export const dynamic = 'force-dynamic';
export const metadata = authMetadata(t('ui.auth.verifyWait.title'));

export default async function PartnerVerifyPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return (
    <AuthShell scene="partenaire">
      <VerifyEmailView token={jeton} audience="PARTNER" contact={await contactInfo(true)} />
    </AuthShell>
  );
}
