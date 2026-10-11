// EP-20 — « Recevez votre projection » (DEM-013, D-031): the same two-step form as the home page (ACC-081), alone on a
// single-task page with its illustrated scene « Projection » (D-092, DSN-076). `features.projectionRequest` false: 404
// (NAV-003). Regions: those with published and available properties (DEM-013). Tags: content, settings, catalogue.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getBlocks, text } from '@/lib/content';
import { getSettings } from '@/lib/settings';
import { description, editorialTitle } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { ProjectionForm } from '@/components/forms/ProjectionForm';
import { GainList, TaskPage } from '@/components/task/TaskPage';
import { ProjectionScene } from '@/components/task/ProjectionScene';

type Items = { title: string; text: string }[];

function obj<T>(blocks: Record<string, unknown>, key: string, fallback: T): T {
  const v = blocks[key];
  return v && typeof v === 'object' ? (v as T) : fallback;
}

export async function generateMetadata(): Promise<Metadata> {
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks('Projection')]);
  if (!settings['features.projectionRequest']) return {};
  return {
    title: { absolute: editorialTitle(t('ui.projection.page.title'), settings) },
    description: description(text(blocks, 'projectionPage.intro')),
    alternates: { canonical: '/projection' },
  };
}

export default async function ProjectionPage() {
  const settings = await getSettings();
  if (!settings['features.projectionRequest']) notFound();
  const [blocks, regions] = await Promise.all([
    getBlocks('Projection', 'Accueil'),
    apiGet<{ data: { slug: string; name: string; count: number }[] }>('/public/regions', { tags: ['catalogue'] }),
  ]);
  const texts = obj(blocks, 'home.projection', { title: '', badge: '', text: '', button: '' });
  return (
    <TaskPage
      title={t('ui.projection.page.title')}
      intro={text(blocks, 'projectionPage.intro')}
      scene={<ProjectionScene />}
      aside={<GainList id="projection-contenu" title={t('ui.projection.page.contentsTitle')} items={obj<Items>(blocks, 'projectionPage.contents', [])} />}
    >
      <ProjectionForm settings={settings} regions={regions.data.map((r) => ({ slug: r.slug, name: r.name }))} texts={texts} headingLevel="h2" variant="page" />
    </TaskPage>
  );
}
