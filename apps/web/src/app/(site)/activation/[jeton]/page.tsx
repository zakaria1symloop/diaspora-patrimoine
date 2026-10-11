// EC-06 — /activation/{jeton}?suite=… (AUTH-040): the page aimed at travels in the link's address.
import { t } from '@/lib/i18n';
import { AuthShell, CLIENT_BENEFITS, contactInfo } from '@/components/auth/AuthShell';
import { ActivationView } from '@/components/auth/TokenPages';
import { authMetadata, nextParam } from '@/components/auth/meta';

export const dynamic = 'force-dynamic';
export const metadata = authMetadata(t('ui.auth.activation.submit'));

export default async function ActivationPage({
  params,
  searchParams,
}: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ jeton }, sp] = await Promise.all([params, searchParams]);
  return (
    <AuthShell scene="acces" benefits={CLIENT_BENEFITS}>
      <ActivationView token={jeton} next={nextParam(sp)} contact={await contactInfo()} />
    </AuthShell>
  );
}
