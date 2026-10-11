// EP-09 — promoter page (EDI-031): logo, cover, name, « Promoteur sélectionné depuis {année} », presentation,
// references, facts (each only when filled), programmes (current ones, then « Programmes réalisés »), call. A promoter
// no longer ACTIVE or public answers 404. No private field ever reaches this page (EDI-032). NAV-032, NAV-035, NAV-039.
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { DetailRedirect, PublicPromoterDetail } from '@dp/contracts';
import { Icon, type IconName } from '@dp/ui';
import { ApiError, apiGet } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';
import { callbackHref, cutAtWord, description } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { Picture } from '@/components/Picture';
import { CallCard, Logo, PageHead, SectionHeading } from '@/components/editorial/Parts';
import { ProgramCard } from '@/components/editorial/Cards';
import s from '@/components/editorial/editorial.module.css';

type Params = Promise<{ slug: string }>;

async function load(slug: string): Promise<PublicPromoterDetail> {
  try {
    const res = await apiGet<PublicPromoterDetail | DetailRedirect>(`/public/promoters/${encodeURIComponent(slug)}`, { tags: ['catalogue'] });
    if ('redirect' in res) permanentRedirect(res.redirect);
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [p, settings] = await Promise.all([load(slug), getSettings()]);
  return {
    title: { absolute: cutAtWord(t('ui.editorial.promoters.seoTitle', { nom: p.name, site: settings['seo.siteName'] }), 70) },
    description: description(p.referencesPublic ?? p.descriptionPublic),
    alternates: { canonical: `/promoteurs/${p.slug}` },
  };
}

export default async function PromoterPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [p, settings] = await Promise.all([load(slug), getSettings()]);
  const facts: { icon: IconName; text: string }[] = [];
  if (p.foundedYear) facts.push({ icon: 'calendar', text: t('ui.editorial.promoters.since', { annee: String(p.foundedYear) }) });
  if (p.deliveredUnits) facts.push({ icon: 'key', text: t('ui.editorial.promoters.delivered', { n: p.deliveredUnits }) });
  if (p.programCount) facts.push({ icon: 'building', text: t('ui.editorial.promoters.inCatalogue', { n: p.programCount }) });
  const current = p.programs.filter((pr) => pr.state !== 'SOLD');
  const sold = p.programs.filter((pr) => pr.state === 'SOLD');
  const base = env().WEB_URL.replace(/\/$/, '');
  // NAV-035 — BreadcrumbList « Promoteurs › {nom} » (NAV-039).
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('ui.nav.header.promoters'), item: `${base}/promoteurs` },
      { '@type': 'ListItem', position: 2, name: p.name, item: `${base}/promoteurs/${p.slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, '\\u003c') }} />
      <PageHead title={p.name} crumbs={[{ href: '/promoteurs', label: t('ui.nav.header.promoters') }]} drawing={p.cover ? undefined : 'promoteurs'}>
        <div className={s.identity}>
          <Logo image={p.logo} name={p.name} size="l" />
          <div className={s.headMeta}>
            {p.selectedSince ? (
              <span className={s.pill}>
                <Icon name="badge" size={16} />
                {t('ui.editorial.promoters.selectedSince', { annee: String(p.selectedSince) })}
              </span>
            ) : null}
            {p.region ? (
              <span className={`${s.pill} ${s.pillBlue}`}>
                <Icon name="map-pin" size={16} />
                {p.region}
              </span>
            ) : null}
          </div>
        </div>
      </PageHead>

      {p.cover ? (
        <div className="container">
          <div className={s.cover}>
            <Picture image={p.cover} sizes="(max-width: 1440px) 100vw, 1344px" className={s.coverImg} priority alt="" />
          </div>
        </div>
      ) : null}

      {facts.length || p.descriptionPublic || p.referencesPublic ? (
        <section className={s.section} aria-labelledby="presentation">
          <div className="container">
            {facts.length ? (
              <ul role="list" className={s.keyFacts}>
                {facts.map((f) => (
                  <li key={f.text} className={s.keyFact}>
                    <span className={s.h2Icon}>
                      <Icon name={f.icon} size={20} />
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className={s.split}>
              {p.descriptionPublic ? (
                <div>
                  <SectionHeading id="presentation" title={t('ui.editorial.promoters.presentation')} />
                  <p className={`${s.rich} ${s.prewrap}`}>
                    {p.descriptionPublic}
                  </p>
                </div>
              ) : (
                <h2 id="presentation" className="visually-hidden">
                  {t('ui.editorial.promoters.presentation')}
                </h2>
              )}
              {p.referencesPublic ? (
                <div className={s.sideCard}>
                  <h3 className={s.sideTitle}>{t('ui.editorial.promoters.references')}</h3>
                  <p className={`${s.rich} ${s.prewrap}`}>
                    {p.referencesPublic}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {current.length ? (
        <section className={`${s.section} ${s.bgIvoire}`} aria-labelledby="en-cours">
          <div className="container">
            <SectionHeading id="en-cours" title={t('ui.editorial.promoters.currentTitle')} icon="building" />
            <ul role="list" className={s.cardGrid}>
              {current.map((pr) => (
                <li key={pr.slug}>
                  <ProgramCard program={pr} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {sold.length ? (
        <section className={s.section} aria-labelledby="realises">
          <div className="container">
            <SectionHeading id="realises" title={t('ui.editorial.promoters.soldTitle')} icon="medal" />
            <ul role="list" className={s.cardGrid}>
              {sold.map((pr) => (
                <li key={pr.slug}>
                  <ProgramCard program={pr} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <CallCard href={callbackHref(settings, `/promoteurs/${p.slug}`)} />
    </>
  );
}
