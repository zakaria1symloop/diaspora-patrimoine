// EP-08 — « Promoteurs sélectionnés » (EDI-030): intro, « Comment nous sélectionnons » (hidden when empty), one card
// per ACTIVE and public promoter by sortOrder then name; none: the sentence of the spec. Tags: catalogue, content.
import type { Metadata } from 'next';
import type { ListResponse, PublicPromoterCard } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { apiGet } from '@/lib/api';
import { getBlocks, text } from '@/lib/content';
import { getSettings } from '@/lib/settings';
import { callbackHref, description, editorialTitle, richBlock } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { CallCard, EmptyState, PageHead, RichText, SectionHeading } from '@/components/editorial/Parts';
import { PromoterCard } from '@/components/editorial/Cards';
import s from '@/components/editorial/editorial.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks('Promoteurs')]);
  return {
    title: { absolute: editorialTitle(t('ui.editorial.promoters.title'), settings) },
    description: description(text(blocks, 'promoters.intro')),
    alternates: { canonical: '/promoteurs' },
  };
}

export default async function PromotersPage() {
  const [settings, blocks, promoters] = await Promise.all([
    getSettings(),
    getBlocks('Promoteurs'),
    apiGet<ListResponse<PublicPromoterCard>>('/public/promoters', { tags: ['catalogue'] }),
  ]);
  const selection = richBlock(blocks, 'promoters.selection');
  return (
    <>
      <PageHead title={t('ui.editorial.promoters.title')} intro={text(blocks, 'promoters.intro')} drawing="promoteurs" />

      {selection ? (
        <section className={s.section} aria-labelledby="selection">
          <div className="container">
            <div className={s.selection}>
              <span className={s.h2Icon}>
                <Icon name="badge" size={24} />
              </span>
              <div>
                <SectionHeading id="selection" title={t('ui.editorial.promoters.selectionTitle')} />
                <RichText html={selection} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className={`${s.section} ${s.bgIvoire}`} aria-labelledby="liste">
        <div className="container">
          <h2 id="liste" className="visually-hidden">
            {t('ui.editorial.promoters.title')}
          </h2>
          {promoters.data.length ? (
            <ul role="list" className={s.cardGrid}>
              {promoters.data.map((p) => (
                <li key={p.slug}>
                  <PromoterCard promoter={p} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text={t('ui.editorial.promoters.empty')} drawing="partenaire" />
          )}
        </div>
      </section>

      <CallCard href={callbackHref(settings)} />
    </>
  );
}
