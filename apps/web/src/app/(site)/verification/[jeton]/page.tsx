// EC-03 — /verification/{jeton} (AUTH-013): opened in the browser of the sign-up, it verifies and signs in; elsewhere,
// the password is asked, with « Ce n'est pas moi » and « Choisir un nouveau mot de passe ».
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { VerifyEmailView } from '@/components/auth/TokenPages';
import { authMetadata } from '@/components/auth/meta';

export const dynamic = 'force-dynamic';
export const metadata = authMetadata(t('ui.auth.verifyWait.title'));

export default async function VerifyPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return (
    <AuthShell scene="courrier">
      <VerifyEmailView token={jeton} audience="WEB" contact={await contactInfo()} />
    </AuthShell>
  );
}
