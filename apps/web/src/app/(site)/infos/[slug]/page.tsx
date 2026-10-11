// EP-24 — free page `/infos/{slug}` (EDI-002): served when published, 404 otherwise; in no menu. Title and description
// for search engines: its own fields, else NAV-032 (« {title} – {site} », the start of the text). Tag: content.
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { DetailRedirect, PublicPage } from '@dp/contracts';
import { ApiError, apiGet } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { callbackHref, cutAtWord, description, editorialTitle, plainText, sanitizeRich } from '@/lib/editorial';
import { CallCard, PageHead, RichText } from '@/components/editorial/Parts';
import s from '@/components/editorial/editorial.module.css';

type Params = Promise<{ slug: string }>;

async function load(slug: string): Promise<PublicPage> {
  try {
    const res = await apiGet<PublicPage | DetailRedirect>(`/public/pages/${encodeURIComponent(slug)}`, { tags: ['content'] });
    if ('redirect' in res) permanentRedirect(res.redirect);
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [page, settings] = await Promise.all([load(slug), getSettings()]);
  return {
    title: { absolute: page.seoTitle ? cutAtWord(page.seoTitle, 70) : editorialTitle(page.title, settings) },
    description: page.seoDescription ?? description(plainText(page.body)),
    alternates: { canonical: `/infos/${page.slug}` },
  };
}

export default async function FreePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [page, settings] = await Promise.all([load(slug), getSettings()]);
  return (
    <>
      <PageHead title={page.title} drawing="document" />
      <section className={`${s.section} ${s.bgIvoire}`} aria-label={page.title}>
        <div className="container">
          <article className={s.legalBody}>
            <RichText html={sanitizeRich(page.body)} />
          </article>
        </div>
      </section>
      <CallCard href={callbackHref(settings)} />
    </>
  );
}
