// EP-08 — « Promoteurs sélectionnés » (EDI-030): intro, « Comment nous sélectionnons » (hidden when empty), one card
// per ACTIVE and public promoter by sortOrder then name; none: the sentence of the spec. Filters (name, region, « Avec
// des biens en vente ») and pages of nine, all in the address (D-105). Tags: catalogue, content.
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
import { PromoterFilters, filterPromoters, promoterHref, readPromoterQuery } from '@/components/editorial/PromoterFilters';
import { PageNav } from '@/components/catalogue/Pagination';
import s from '@/components/editorial/editorial.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks('Promoteurs')]);
  return {
    title: { absolute: editorialTitle(t('ui.editorial.promoters.title'), settings) },
    description: description(text(blocks, 'promoters.intro')),
    alternates: { canonical: '/promoteurs' },
  };
}

/** Nine cards: three full rows on a computer. */
const PAGE_SIZE = 9;

export default async function PromotersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [settings, blocks, promoters, sp] = await Promise.all([
    getSettings(),
    getBlocks('Promoteurs'),
    apiGet<ListResponse<PublicPromoterCard>>('/public/promoters', { tags: ['catalogue'] }),
    searchParams,
  ]);
  const query = readPromoterQuery(sp);
  const matching = filterPromoters(promoters.data, query);
  const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  const shown = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
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
            <>
              {promoters.data.length >= 2 ? (
                <PromoterFilters action="/promoteurs" anchor="liste" promoters={promoters.data} query={query} shown={matching.length} />
              ) : null}
              {shown.length ? (
                <ul role="list" className={s.cardGrid}>
                  {shown.map((p) => (
                    <li key={p.slug}>
                      <PromoterCard promoter={p} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={s.filterNone}>{t('ui.editorial.promoters.filters.none')}</p>
              )}
              <PageNav
                page={page}
                totalPages={totalPages}
                href={(n) => `${promoterHref('/promoteurs', { ...query, page: n })}#liste`}
                loadMore={t('ui.editorial.promoters.loadMore')}
              />
            </>
          ) : (
            <EmptyState text={t('ui.editorial.promoters.empty')} drawing="partenaire" />
          )}
        </div>
      </section>

      <CallCard href={callbackHref(settings)} />
    </>
  );
}
