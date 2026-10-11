// EP-02 — catalogue. All state is in the address (CAT-003, TRV-101); unknown or malformed criteria are removed
// from it (CAT-020); a page beyond the last redirects to the last (CAT-055). Server-rendered, tag `catalogue`.
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { PropertyCard as CardData } from '@dp/contracts';
import {
  activeFilterCount,
  criteriaToSearch,
  parseCatalogueCriteria,
  type CatalogueCriteria,
  type CatalogueResponse,
  type SearchOptions,
} from '@dp/contracts';
import { Icon, SectionTitle, buttonClass, ButtonInner } from '@dp/ui';
import { apiGet } from '@/lib/api';
import { getBlocks, text } from '@/lib/content';
import { getSettings } from '@/lib/settings';
import { t } from '@/lib/i18n';
import { activeChips, canonicalOf, catalogueTitle, criteriaSummary, introLines, isIndexable, namesFrom, titleLines } from '@/lib/catalogue';
import { PropertyCard } from '@/components/vitrine/PropertyCard';
import { SearchBar } from '@/components/vitrine/SearchBar';
import { CatalogueToolbar } from '@/components/catalogue/CatalogueToolbar';
import { FiltersDialog } from '@/components/catalogue/FiltersDialog';
import { Pagination } from '@/components/catalogue/Pagination';
import { CatalogueMapView } from '@/components/catalogue/CatalogueMapView';
import { GroupedResults } from '@/components/catalogue/GroupedResults';
import { ViewControls } from '@/components/catalogue/ViewControls';
import { AlertActions, AlertDialog, SaveSearchDialog } from '@/components/alerts/AlertDialogs';
import { AlertEditBanner } from '@/components/alerts/AlertEditBanner';
import { AlertForm } from '@/components/alerts/AlertForm';
import { env } from '@/lib/env';
import { Suspense } from 'react';
import s from '@/components/catalogue/catalogue.module.css';
import v from '@/components/catalogue/views.module.css';

type SP = Promise<Record<string, string | string[] | undefined>>;

function year(): number {
  return new Date().getFullYear();
}

async function load(searchParams: SP) {
  const raw = await searchParams;
  const criteria = parseCatalogueCriteria(raw, year());
  const [res, settings, options] = await Promise.all([
    apiGet<CatalogueResponse>('/public/properties', {
      tags: ['catalogue'],
      searchParams: { ...Object.fromEntries(new URLSearchParams(criteriaToSearch(criteria))), facets: 1 },
    }),
    getSettings(),
    apiGet<SearchOptions>('/public/search-options', { tags: ['catalogue'] }),
  ]);
  return { raw, criteria, res, settings, options, country: options.country?.name ?? '' };
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { criteria, res, settings, options, country } = await load(searchParams);
  const names = namesFrom(res.facets, options.regions);
  const title = catalogueTitle(criteria, names, country);
  const indexable = isIndexable(criteria) && !criteria.page;
  const seoTitle = title === t('ui.catalogue.page.titleAll') ? t('ui.catalogue.seo.titleAll', { pays: country }) : title;
  return {
    title: { absolute: cutAtWord(t('ui.catalogue.seo.suffix', { titre: seoTitle, site: settings['seo.siteName'] }), 70) },
    alternates: { canonical: canonicalOf(criteria) },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export default async function CataloguePage({ searchParams }: { searchParams: SP }) {
  const { raw, criteria, res, settings, options, country } = await load(searchParams);
  // CAT-061 — only under an empty filtered result
  const suggestions =
    res.data.length === 0 && res.meta.publishedCount > 0
      ? (
          await apiGet<{ data: CardData[] }>('/public/properties/suggestions', {
            tags: ['catalogue'],
            searchParams: Object.fromEntries(new URLSearchParams(criteriaToSearch(criteria))),
          }).catch(() => ({ data: [] as CardData[] }))
        ).data
      : [];

  // CAT-020 / CAT-055: normalise the address in one redirect.
  const applied: CatalogueCriteria = res.meta.criteria;
  const extra = new URLSearchParams();
  // Windows open in the address (CAT-003): filters, alert (CAT-070), saved search (CAT-093), callback.
  const FLAGS = ['filtres', 'alerte', 'enregistrer', 'rappel'];
  for (const f of FLAGS) if (raw[f] === '1') extra.set(f, '1');
  const canonicalQs = criteriaToSearch(applied);
  const currentQs = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (v === undefined || FLAGS.includes(k) ? [] : [[k, Array.isArray(v) ? v[0]! : v]])),
  ).toString();
  if (canonicalQs.replace(/^\?/, '') !== currentQs.replace(/%2C/g, ',')) {
    const join = canonicalQs ? '&' : '?';
    redirect(`/programmes${canonicalQs}${extra.size ? `${join}${extra.toString()}` : ''}`);
  }

  const blocks = await getBlocks('Catalogue');
  const monthly = settings['features.monthlyBudgetSearch'];
  const prefix = settings['display.roomsPrefix'];
  const names = namesFrom(res.facets, options.regions);
  const chips = activeChips(applied, names, prefix, year());
  const filterCount = activeFilterCount(applied);
  const callbackHref = settings['features.callbackRequest'] ? '?rappel=1' : '/contact?objet=rappel';
  const help = (blocks['listing.help'] ?? { title: '', text: '' }) as { title: string; text: string };
  const emptyCatalogue = res.meta.publishedCount === 0;
  const allReserved = !emptyCatalogue && res.meta.availableCount === 0 && filterCount === 0 && !applied.q;
  const notes: string[] = [];
  if (monthly && res.data.some((c) => c.monthlyFromRef)) notes.push(settings['legal.monthlyFootnote']);
  if (res.data.length) notes.push(settings['legal.convertedPricesNote']);
  if (res.data.some((c) => c.cover?.isIllustration)) notes.push(`${settings['legal.illustrationNote']}.`);
  // CAT-090 — the map exists only with a style (FIC-061: otherwise the « Carte » button is hidden).
  const mapStyleUrl = env().MAP_STYLE_URL ?? null;
  const onMap = Boolean(mapStyleUrl && applied.vue === 'carte' && res.map);
  const alertsOn = settings['features.searchAlerts'];
  const summary = criteriaSummary(applied, names, prefix, year());
  const chipLabels = chips.map((c) => c.label);
  const heading = titleLines(catalogueTitle(applied, names, country));
  const intro = introLines(text(blocks, monthly ? 'listing.introMonthly' : 'listing.intro'));
  if (applied.q) chipLabels.unshift(`« ${applied.q} »`);
  return (
    <div className={s.page}>
      {/* CAT-001, Figma EP-02 — the title built from the criteria, centred on two lines; no breadcrumb on a list (NAV-039). */}
      <header className={`container ${s.head}`}>
        <SectionTitle as="h1" line1={heading[0]} line2={heading[1]} sub1={intro[0]} sub2={intro[1]} />
      </header>

      {emptyCatalogue ? (
        <section className={`container ${s.empty}`}>
          <p className={s.emptyTitle}>{t('ui.catalogue.page.emptyCatalogue')}</p>
        </section>
      ) : (
        <>
          {/* Figma EP-02 390: on a phone the keyword field and the « Filtres » window replace the three-field bar */}
          <div className={`container ${s.searchWrap}`}>
            <SearchBar
              options={options}
              monthlyEnabled={monthly}
              roomsPrefix={prefix}
              initial={applied}
            />
          </div>
          <section className={`container ${s.results}`} aria-labelledby="resultats">
            <h2 id="resultats" className="visually-hidden">
              {t('ui.catalogue.page.results')}
            </h2>
            <CatalogueToolbar
              criteria={applied}
              count={
                filterCount === 0 && !applied.q
                  ? t('ui.catalogue.page.countAvailable', { n: res.meta.propertyCount ?? res.meta.total })
                  : t('ui.catalogue.page.countMatching', { n: res.meta.propertyCount ?? res.meta.total })
              }
              summary={summary}
              filterCount={filterCount}
              monthlyEnabled={monthly}
            />
            <div className={v.viewRow}>
            {res.quickFilters?.length ? (
              <ul className={s.quick} role="list">
                {res.quickFilters.map((q) => {
                  const on = quickActive(applied, q);
                  return (
                    <li key={q}>
                      <Link href={`/programmes${criteriaToSearch(toggleQuick(applied, q))}`} className={s.chip} aria-pressed={on} data-on={on || undefined}>
                        {t(`ui.catalogue.quick.${q}` as never)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
              <ViewControls criteria={applied} mapAvailable={Boolean(mapStyleUrl)} />
            </div>
            <Suspense fallback={null}>
              <AlertEditBanner criteria={applied} />
            </Suspense>
            {chips.length || applied.q ? (
              <div className={s.active}>
                <ul className={s.chips} role="list">
                  {chips.map((c) => (
                    <li key={c.label}>
                      <Link href={c.href} className={s.activeChip} aria-label={t('ui.catalogue.page.remove', { filtre: c.label })}>
                        {c.label}
                        <Icon name="close" size={16} />
                      </Link>
                    </li>
                  ))}
                </ul>
                {chips.length ? (
                  <Link href={applied.q ? `/programmes?q=${encodeURIComponent(applied.q)}` : '/programmes'} className={s.clear}>
                    {t('ui.catalogue.page.clearAll')}
                  </Link>
                ) : null}
                <AlertActions criteria={applied} alertsEnabled={alertsOn} />
              </div>
            ) : (
              <div className={s.active}>
                <AlertActions criteria={applied} alertsEnabled={alertsOn} />
              </div>
            )}

            {allReserved ? (
              <div className={s.emptyBox}>
                <p>{t('ui.catalogue.page.allReserved')}</p>
                <Link href={callbackHref} className={buttonClass('primary', 'M')} scroll={false}>
                  <ButtonInner chevron size="M">
                    {t('ui.catalogue.page.callback')}
                  </ButtonInner>
                </Link>
              </div>
            ) : res.data.length === 0 ? (
              <div className={s.emptyBox}>
                <p className={s.emptyTitle}>{t('ui.catalogue.page.emptyFiltered')}</p>
                <p>{settings['features.searchAlerts'] ? t('ui.catalogue.page.emptyFilteredAlerts') : t('ui.catalogue.page.emptyFilteredNoAlerts')}</p>
                <div className={s.emptyButtons}>
                  {applied.monthlyMax || applied.priceMax ? (
                    <Link href={`/programmes${criteriaToSearch(widen(applied))}`} className={buttonClass('primary', 'M')}>
                      <ButtonInner size="M">{t('ui.catalogue.page.widenBudget')}</ButtonInner>
                    </Link>
                  ) : null}
                  <Link href="/programmes" className={buttonClass('secondary', 'M')}>
                    <ButtonInner size="M">{t('ui.catalogue.page.resetFilters')}</ButtonInner>
                  </Link>
                  {alertsOn ? null : (
                    <Link href={callbackHref} className={buttonClass('secondary', 'M')} scroll={false}>
                      <ButtonInner size="M">{t('ui.catalogue.page.callback')}</ButtonInner>
                    </Link>
                  )}
                </div>
                {/* CAT-060 — the alert block, open from the start. */}
                {alertsOn ? <AlertForm criteria={applied} chips={chipLabels} summary={summary} variant="inline" /> : null}
                {/* CAT-061 — relaxed suggestions; nothing found: the block is hidden */}
                {suggestions.length ? (
                  <section className={s.suggestions} aria-labelledby="suggestions">
                    <h2 id="suggestions" className={s.suggestionsTitle}>
                      {t('ui.catalogue.page.suggestions')}
                    </h2>
                    <ul className={s.grid} role="list">
                      {suggestions.map((c) => (
                        <li key={c.reference}>
                          <PropertyCard card={c} downPaymentPct={res.meta.referenceDownPaymentPct} monthlyEnabled={monthly} illustrationNote={settings['legal.illustrationNote']} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            ) : onMap ? (
              <CatalogueMapView
                styleUrl={mapStyleUrl!}
                map={res.map!}
                cards={res.data}
                criteria={applied}
                monthlyEnabled={monthly}
                empty={null}
                footer={
                  <>
                    <Pagination criteria={applied} page={res.meta.page} totalPages={res.meta.totalPages} />
                    {notes.length ? <p className={s.note}>{notes.join(' ')}</p> : null}
                  </>
                }
              />
            ) : res.groups ? (
              <GroupedResults groups={res.groups} downPaymentPct={res.meta.referenceDownPaymentPct} monthlyEnabled={monthly} illustrationNote={settings['legal.illustrationNote']} />
            ) : (
              <ul className={s.grid} role="list" data-reveal="">
                {res.data.map((c) => (
                  <li key={c.id} id={`bien-${c.reference}`}>
                    <PropertyCard card={c} downPaymentPct={res.meta.referenceDownPaymentPct} monthlyEnabled={monthly} illustrationNote={settings['legal.illustrationNote']} />
                  </li>
                ))}
              </ul>
            )}
            {onMap && res.data.length ? null : (
              <>
                <Pagination criteria={applied} page={res.meta.page} totalPages={res.meta.totalPages} />
                {notes.length ? <p className={s.note}>{notes.join(' ')}</p> : null}
              </>
            )}
          </section>
          <Suspense fallback={null}>
            {alertsOn ? <AlertDialog criteria={applied} chips={chipLabels} summary={summary} /> : null}
            <SaveSearchDialog criteria={applied} summary={summary} alertsEnabled={alertsOn} />
          </Suspense>
        </>
      )}

      <section className={`container ${s.help}`}>
        <div className={s.helpCard}>
          <div>
            <h2 className={s.helpTitle}>{help.title}</h2>
            <p>{help.text}</p>
          </div>
          <div className={s.emptyButtons}>
            <Link href="/financements/simulateur-eligibilite" className={buttonClass('primary', 'M')}>
              <ButtonInner chevron size="M">
                {t('ui.catalogue.page.helpEligibility')}
              </ButtonInner>
            </Link>
            <Link href={callbackHref} className={buttonClass('secondary', 'M')} scroll={false}>
              <ButtonInner chevron size="M">
                {t('ui.catalogue.page.helpCallback')}
              </ButtonInner>
            </Link>
          </div>
        </div>
      </section>
      {!emptyCatalogue && res.facets ? <FiltersDialog criteria={applied} facets={res.facets} total={res.meta.total} monthlyEnabled={monthly} roomsPrefix={prefix} islamicEnabled={settings['features.islamicFinance']} tour360Enabled={settings['features.tour360']} newDays={settings['catalogue.newBadgeDays']} year={year()} /> : null}
    </div>
  );
}

function quickActive(c: CatalogueCriteria, q: string): boolean {
  switch (q) {
    case 'apartment':
    case 'villa':
      return c.type?.includes(q) ?? false;
    case 'delivered':
      return c.delivery?.includes('delivered') ?? false;
    case 'financing':
      return Boolean(c.financing);
    case 'new':
      return Boolean(c.new);
    case 'tour360':
      return Boolean(c.tour360);
    default:
      return false;
  }
}

/** CAT-012 — a quick filter toggles its criterion; the page goes back to 1 (CAT-003). */
function toggleQuick(c: CatalogueCriteria, q: string): CatalogueCriteria {
  const n: CatalogueCriteria = { ...c };
  delete n.page;
  const toggleList = (key: 'type' | 'delivery', v: string) => {
    const list = (n[key] as string[] | undefined) ?? [];
    const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    if (next.length) (n as Record<string, unknown>)[key] = next;
    else delete n[key];
  };
  if (q === 'apartment' || q === 'villa') toggleList('type', q);
  else if (q === 'delivered') toggleList('delivery', 'delivered');
  else if (q === 'financing' || q === 'new' || q === 'tour360') {
    if (n[q]) delete n[q];
    else n[q] = true;
  }
  return n;
}

/** CAT-060 — « Élargir le budget (+20 %) », rounded up like the slider bounds (CAT-034). */
function widen(c: CatalogueCriteria): CatalogueCriteria {
  const n: CatalogueCriteria = { ...c };
  delete n.page;
  if (n.monthlyMax) n.monthlyMax = Math.ceil((n.monthlyMax * 1.2) / 10) * 10;
  if (n.priceMax) {
    const v = n.priceMax * 1.2;
    const step = v > 100_000 ? 1000 : v > 10_000 ? 500 : 100;
    n.priceMax = Math.ceil(v / step) * step;
  }
  return n;
}

/** NAV-032 — a title too long is cut at a word, without an ellipsis. */
function cutAtWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max + 1);
  return cut.slice(0, cut.lastIndexOf(' ')).trim();
}
