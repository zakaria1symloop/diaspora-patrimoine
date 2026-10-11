// EC-03 — /verification: the waiting screen of an unconfirmed address (AUTH-012), or « Recevoir un nouveau lien ».
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { VerificationWait } from '@/components/auth/ClientLogin';
import { authMetadata } from '@/components/auth/meta';

export const metadata = authMetadata(t('ui.auth.verifyWait.title'));

export default async function VerificationPage() {
  return (
    <AuthShell scene="courrier">
      <VerificationWait contact={await contactInfo()} />
    </AuthShell>
  );
}
