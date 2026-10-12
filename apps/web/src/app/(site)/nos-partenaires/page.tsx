// EP-17 — Nos partenaires (EDI-035): three groups, each hidden when empty — promoters (the cards of « Promoteurs », with
// their filters), public banks, other public partners by category; « Afficher » shows one group (D-105); all empty: the
// sentence of the spec. Then the two calls.
// Tags: catalogue, settings.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ListResponse, PartnerCategory, PublicBank, PublicPartner, PublicPromoterCard } from '@dp/contracts';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { apiGet } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { callbackHref, editorialTitle } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { CallCard, EmptyState, Logo, PageHead, SectionHeading } from '@/components/editorial/Parts';
import { BankCard, PromoterCard } from '@/components/editorial/Cards';
import { PromoterFilters, filterPromoters, readPromoterQuery } from '@/components/editorial/PromoterFilters';
import s from '@/components/editorial/editorial.module.css';

const CATEGORY_ORDER: PartnerCategory[] = ['NOTARY', 'INSURER', 'INSTITUTION', 'MEDIA', 'OTHER'];
type Group = 'promoteurs' | 'banques' | 'autres';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: { absolute: editorialTitle(t('ui.editorial.partners.title'), settings) },
    alternates: { canonical: '/nos-partenaires' },
  };
}

export default async function PartnersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [settings, promoters, banks, partners, sp] = await Promise.all([
    getSettings(),
    apiGet<ListResponse<PublicPromoterCard>>('/public/promoters', { tags: ['catalogue'] }),
    apiGet<ListResponse<PublicBank>>('/public/banks', { tags: ['catalogue'] }),
    apiGet<ListResponse<PublicPartner>>('/public/partners', { tags: ['catalogue'] }),
    searchParams,
  ]);
  const allEmpty = !promoters.data.length && !banks.data.length && !partners.data.length;
  const categories = CATEGORY_ORDER.map((c) => ({ category: c, items: partners.data.filter((p) => p.category === c) })).filter((g) => g.items.length);

  // EDI-035, D-105 — « Afficher » : all partners, or one group; the promoters can be filtered like on their page.
  const groups: { key: Group; label: string; count: number }[] = [
    { key: 'promoteurs' as const, label: t('ui.editorial.partners.promoters'), count: promoters.data.length },
    { key: 'banques' as const, label: t('ui.editorial.partners.banks'), count: banks.data.length },
    { key: 'autres' as const, label: t('ui.editorial.partners.others'), count: partners.data.length },
  ].filter((g) => g.count > 0);
  const asked = Array.isArray(sp.groupe) ? sp.groupe[0] : sp.groupe;
  const group = groups.find((g) => g.key === asked)?.key ?? null;
  const showing = (g: Group) => group === null || group === g;
  const query = readPromoterQuery(sp);
  const matching = filterPromoters(promoters.data, query);
  const keep: Record<string, string> = group ? { groupe: group } : {};

  return (
    <>
      <PageHead title={t('ui.editorial.partners.title')} drawing="partenaire" />

      <section id="partenaires" className={`${s.section} ${s.bgIvoire}`} aria-label={t('ui.editorial.partners.title')}>
        <div className="container">
          {allEmpty ? <EmptyState text={t('ui.editorial.partners.empty')} drawing="promoteurs" /> : null}

          {groups.length >= 2 ? (
            <nav className={s.groupChips} aria-label={t('ui.editorial.partners.show')}>
              <ul role="list">
                {[{ key: null, label: t('ui.editorial.partners.all'), count: groups.reduce((n, g) => n + g.count, 0) }, ...groups].map((g) => (
                  <li key={g.key ?? 'tous'}>
                    <Link
                      href={`${g.key ? `/nos-partenaires?groupe=${g.key}` : '/nos-partenaires'}#partenaires`}
                      className={s.groupChip}
                      aria-current={group === g.key ? 'true' : undefined}
                      scroll={false}
                    >
                      {g.label}
                      <span className={s.groupChipCount}>{g.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {promoters.data.length && showing('promoteurs') ? (
            <section className={s.group} aria-labelledby="groupe-promoteurs">
              <SectionHeading id="groupe-promoteurs" title={t('ui.editorial.partners.promoters')} icon="building" />
              {promoters.data.length >= 2 ? (
                <PromoterFilters action="/nos-partenaires" anchor="groupe-promoteurs" keep={keep} promoters={promoters.data} query={query} shown={matching.length} />
              ) : null}
              {matching.length ? (
                <ul role="list" className={s.cardGrid}>
                  {matching.map((p) => (
                    <li key={p.slug}>
                      <PromoterCard promoter={p} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={s.filterNone}>{t('ui.editorial.promoters.filters.none')}</p>
              )}
            </section>
          ) : null}

          {banks.data.length && showing('banques') ? (
            <section className={s.group} aria-labelledby="groupe-banques">
              <SectionHeading id="groupe-banques" title={t('ui.editorial.partners.banks')} icon="bank" />
              <ul role="list" className={s.bankWall}>
                {banks.data.map((b) => (
                  <li key={b.slug}>
                    <BankCard bank={b} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {categories.length && showing('autres') ? (
            <section className={s.group} aria-labelledby="groupe-autres">
              <SectionHeading id="groupe-autres" title={t('ui.editorial.partners.others')} icon="partners" />
              {categories.map((g) => (
                <div key={g.category} className={s.group}>
                  <h3 className={s.groupTitle}>{t(`ui.editorial.partners.category.${g.category}`)}</h3>
                  <ul role="list" className={s.cardGrid}>
                    {g.items.map((p) => (
                      <li key={p.id} className={s.card}>
                        <div className={s.promoterTop}>
                          <Logo image={p.logo} name={p.name} size="s" />
                          <h4 className={s.cardTitle}>{p.name}</h4>
                        </div>
                        {p.description ? <p className={s.cardText}>{p.description}</p> : null}
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className={s.textLink}>
                            {t('ui.editorial.partners.website')}
                            <Icon name="external-link" size={16} />
                            <span className="visually-hidden">{t('ui.editorial.common.newTab')}</span>
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </section>

      <section className={s.section} aria-label={t('ui.editorial.partners.partnerTitle')}>
        <div className={`container ${s.partnerCtas}`}>
          <div className={`${s.partnerCta} ${s.partnerCtaDark} icons-dark`}>
            <Icon name="building" size={32} />
            <h2 className={s.partnerCtaTitle}>{t('ui.editorial.partners.partnerTitle')}</h2>
            <Link href="/partenaires/inscription" className={buttonClass('primary', 'L')}>
              <ButtonInner chevron size="L">
                {t('ui.editorial.partners.partnerButton')}
              </ButtonInner>
            </Link>
            <Link href="/partenaires/connexion" className={s.textLink}>
              {t('ui.editorial.partners.partnerLogin')}
              <Icon name="chevron-right" size={16} />
            </Link>
          </div>
          <div className={s.partnerCta}>
            <Icon name="partners" size={32} />
            <h2 className={s.partnerCtaTitle}>{t('ui.editorial.partners.otherTitle')}</h2>
            <Link href={settings['features.partnerForm'] ? '/devenir-partenaire' : '/contact'} className={buttonClass('secondary', 'L')}>
              <ButtonInner chevron size="L">
                {t('ui.editorial.partners.otherButton')}
              </ButtonInner>
            </Link>
          </div>
        </div>
      </section>

      <CallCard href={callbackHref(settings)} />
    </>
  );
}
