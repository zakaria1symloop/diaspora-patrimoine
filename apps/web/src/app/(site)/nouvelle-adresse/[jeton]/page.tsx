// EC-03 / AUTH-080 — /nouvelle-adresse/{jeton}: confirmation of a new address. The page signs nobody in.
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { EmailChangeView } from '@/components/auth/TokenPages';
import { authMetadata } from '@/components/auth/meta';

export const dynamic = 'force-dynamic';
export const metadata = authMetadata(t('ui.auth.emailChange.checking'));

export default async function NewAddressPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return (
    <AuthShell scene="courrier">
      <EmailChangeView token={jeton} contact={await contactInfo()} />
    </AuthShell>
  );
}
