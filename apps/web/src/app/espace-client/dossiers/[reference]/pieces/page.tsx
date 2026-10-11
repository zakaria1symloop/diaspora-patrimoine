// EC-20, EC-21 — the « Pièces » tab of « Mon dossier » (ECL-030; package 2.9). Rendered under the dossier's header and
// tabs (layout of package 2.8). Private data: read with the visitor's cookies, never cached.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ClientDocumentsView } from '@dp/contracts';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { DocumentsBoard } from '@/components/client-documents/DocumentsBoard';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: t('ui.documents.page.seoTitle') };

export default async function DocumentsPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const r = await spaceGet<ClientDocumentsView>(`/client/dossiers/${encodeURIComponent(reference)}/documents`);
  if (!r.ok) return r.status === 404 ? notFound() : <SpaceReadFailure result={r} />;
  return <DocumentsBoard initial={r.data} />;
}
