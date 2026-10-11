// EP-33 — new password of a partner account (AUTH-045 via ACP-085).
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { ResetView } from '@/components/auth/TokenPages';
import { authMetadata } from '@/components/auth/meta';

export const dynamic = 'force-dynamic';
export const metadata = authMetadata(t('ui.auth.reset.title'));

export default async function PartnerResetPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return (
    <AuthShell scene="partenaire">
      <ResetView token={jeton} audience="PARTNER" contact={await contactInfo(true)} />
    </AuthShell>
  );
}
