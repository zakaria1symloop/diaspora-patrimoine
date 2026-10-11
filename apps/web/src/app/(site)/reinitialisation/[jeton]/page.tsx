// EC-05 — /reinitialisation/{jeton} (AUTH-045).
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { ResetView } from '@/components/auth/TokenPages';
import { authMetadata } from '@/components/auth/meta';

export const dynamic = 'force-dynamic';
export const metadata = authMetadata(t('ui.auth.reset.title'));

export default async function ResetPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return (
    <AuthShell scene="acces">
      <ResetView token={jeton} audience="WEB" contact={await contactInfo()} />
    </AuthShell>
  );
}
