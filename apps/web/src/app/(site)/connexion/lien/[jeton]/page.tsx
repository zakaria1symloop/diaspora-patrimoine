// EC-07 — /connexion/lien/{jeton}: the link signs in (after the two-factor code if enabled) and proves the address.
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { MagicConsumeView } from '@/components/auth/TokenPages';
import { authMetadata } from '@/components/auth/meta';

export const dynamic = 'force-dynamic';
export const metadata = authMetadata(t('ui.auth.magic.title'));

export default async function MagicConsumePage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return (
    <AuthShell scene="acces">
      <MagicConsumeView token={jeton} contact={await contactInfo()} />
    </AuthShell>
  );
}
