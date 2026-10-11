// CRM-075, ROL-017 — `/apercu/{code}`: the door of « Voir comme le client » (a one-minute code, used once).
import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import { AuthShell } from '@/components/auth/AuthShell';
import { PreviewOpen } from '@/components/preview/PreviewOpen';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: t('ui.preview.page.title'), robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function PreviewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <AuthShell scene="acces">
      <PreviewOpen code={code} />
    </AuthShell>
  );
}
