// EP-33 — /partenaires/connexion: the partner door — sign-in, address to confirm, then the application (ACP-083).
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { PartnerSpace } from '@/components/auth/PartnerSpace';
import { authMetadata } from '@/components/auth/meta';

export const metadata = authMetadata(t('ui.auth.partner.login.title'));

export default async function PartnerLoginPage() {
  return (
    <AuthShell scene="partenaire">
      <PartnerSpace contact={await contactInfo(true)} />
    </AuthShell>
  );
}
