// EP-10 — Financements (EDI-020 … EDI-023). Anchors: #credit, #islamique, #expertise, #simulateurs, #parcours,
// #banques, #questions. Server-rendered; fallbacks decided here (ACC-090, ACC-091). Tags: content, catalogue, settings.
import type { Metadata } from 'next';
import type { ConceptSteps, HomeResponse, ListResponse, PublicBank, PublicChecklist } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { apiGet } from '@/lib/api';
import { getBlocks, text } from '@/lib/content';
import { getSettings } from '@/lib/settings';
import { callbackHref, description, editorialTitle, fillFields, objBlock, richBlock } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { CallCard, PageHead, RichText, SectionHeading } from '@/components/editorial/Parts';
import { BankCard } from '@/components/editorial/Cards';
import { Drawing } from '@/components/editorial/Drawing';
import { Disclosure } from '@/components/editorial/Disclosure';
import { FinancingTabs, type FinancingTab } from '@/components/editorial/FinancingTabs';
import { Journey } from '@/components/editorial/Journey';
import { QuickCalc } from '@/components/editorial/QuickCalc';
import { FaqSection } from '@/components/editorial/FaqSection';
import s from '@/components/editorial/editorial.module.css';

type FinancingItem = { key: 'credit' | 'islamic' | 'expertise'; overline: string; title: string; text: string; points: string[]; visible: boolean };

export async function generateMetadata(): Promise<Metadata> {
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks('Accueil')]);
  const sub = settings['features.islamicFinance']
    ? [text(blocks, 'home.financing.subtitle1'), text(blocks, 'home.financing.subtitle2')].filter(Boolean).join(' ')
    : text(blocks, 'home.financing.subtitleNoIslamic');
  return {
    title: { absolute: editorialTitle(t('ui.editorial.financing.title'), settings) },
    description: description(sub),
    alternates: { canonical: '/financements' },
  };
}

export default async function FinancingPage() {
  const [settings, blocks, home, banks, checklist] = await Promise.all([
    getSettings(),
    getBlocks('Accueil', 'Financements', 'Notre concept'),
    apiGet<HomeResponse>('/public/home', { tags: ['home', 'catalogue', 'events'] }),
    apiGet<ListResponse<PublicBank>>('/public/banks', { tags: ['catalogue'] }),
    apiGet<PublicChecklist>('/public/checklist/public', { tags: ['content'] }),
  ]);
  const islamic = settings['features.islamicFinance'];
  const callback = callbackHref(settings);
  const pct = home.referenceDownPaymentPct;
  const items = objBlock<FinancingItem[]>(blocks, 'home.financing.items', []);
  const item = (key: FinancingItem['key']) => items.find((i) => i.key === key && i.visible) ?? null;

  // Section 2 — tabs (EDI-022: no islamic tab, anchor nor link without the feature).
  const tabs: FinancingTab[] = [];
  const credit = item('credit');
  if (credit) {
    tabs.push({
      key: 'credit',
      anchor: 'credit',
      overline: credit.overline,
      title: credit.title,
      text: credit.text,
      points: credit.points.map((p) => fillFields(p, { downPaymentPct: pct })),
      bodyHtml: richBlock(blocks, 'financing.credit.body', { downPaymentPct: pct }),
    });
  }
  const isl = islamic ? item('islamic') : null;
  if (isl) {
    tabs.push({
      key: 'islamic',
      anchor: 'islamique',
      overline: isl.overline,
      title: isl.title,
      text: isl.text,
      points: isl.points.map((p) => fillFields(p, { downPaymentPct: pct })),
      bodyHtml: richBlock(blocks, 'financing.islamic.body', { downPaymentPct: pct }),
    });
  }
  const expertiseBody = richBlock(blocks, 'financing.expertise.body', { downPaymentPct: pct });

  // Section 3 — steps 4 to 6 of EDI-011 (the same block as Notre concept).
  const steps = objBlock<ConceptSteps | null>(blocks, 'concept.steps', null)?.steps ?? [];
  const journey = steps
    .map((st, i) => ({ n: i + 1, title: st.title, text: st.text }))
    .slice(3, 6)
    .filter((st) => st.title.trim());
  const banksIntro = text(blocks, 'financing.banks.intro');

  const heading = { line1: text(blocks, 'home.financing.title1'), line2: text(blocks, 'home.financing.title2') };
  const intro = islamic
    ? [text(blocks, 'home.financing.subtitle1'), text(blocks, 'home.financing.subtitle2')].filter(Boolean).join(' ')
    : text(blocks, 'home.financing.subtitleNoIslamic');

  return (
    <>
      <PageHead
        title={t('ui.editorial.financing.title')}
        heading={heading.line1 || heading.line2 ? heading : undefined}
        intro={intro}
        aside={
          <div id="simulateurs">
            <QuickCalc currency={settings['display.referenceCurrency']} callbackHref={callback} />
          </div>
        }
      >
        <Drawing name="financement" className={s.headDrawingInline} />
      </PageHead>

      {tabs.length || expertiseBody ? (
        <section className={`${s.section} ${s.bgIvoire}`} aria-labelledby="facons">
          <div className="container">
            <SectionHeading id="facons" title={t('ui.editorial.financing.waysTitle')} icon="bank" align="center" />
            <FinancingTabs
              tabs={tabs}
              label={t('ui.editorial.financing.waysTitle')}
              after={
                <div id="expertise" className={s.expertise}>
                  <Drawing name="partenaire" className={s.expertiseDrawing} />
                  <div className={s.expertiseText}>
                    <p className={s.expertiseLine}>{t('ui.editorial.financing.expertise')}</p>
                    {expertiseBody ? (
                      <Disclosure label={t('ui.editorial.common.readMore')} openLabel={t('ui.editorial.common.readLess')}>
                        <RichText html={expertiseBody} />
                      </Disclosure>
                    ) : null}
                  </div>
                </div>
              }
            />
          </div>
        </section>
      ) : null}

      {journey.length ? (
        <section id="parcours" className={s.section} aria-labelledby="parcours-titre">
          <div className="container">
            <SectionHeading id="parcours-titre" title={t('ui.editorial.financing.journeyTitle')} icon="folder" align="center" />
            <Journey steps={journey} />
            {checklist.groups.length ? (
              <div className={s.documents}>
                <Disclosure label={t('ui.editorial.financing.documentsToggle')} variant="panel">
                  <div>
                    <div className={s.documentGroups}>
                      {checklist.groups.map((g) => (
                        <div key={g.category}>
                          <h3 className={s.documentCategory}>{t(`ui.enum.DocumentCategory.${g.category}`)}</h3>
                          <ul className={s.documentList}>
                            {g.labels.map((l) => (
                              <li key={l}>{l}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <p className={s.note}>{t('ui.editorial.financing.documentsNote')}</p>
                  </div>
                </Disclosure>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {banks.data.length || banksIntro ? (
        <section id="banques" className={`${s.section} ${s.bgCiel}`} aria-labelledby="banques-titre">
          <div className="container">
            <SectionHeading id="banques-titre" title={t('ui.editorial.financing.banksTitle')} icon="partners" />
            {banksIntro ? <p className={s.lead}>{banksIntro}</p> : null}
            {banks.data.length ? (
              <ul role="list" className={s.bankWall}>
                {banks.data.map((b) => (
                  <li key={b.slug}>
                    <BankCard bank={b} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      <FaqSection placement="FINANCEMENTS" className={s.bgIvoire} />

      <section className={s.sectionTight} aria-label={t('ui.editorial.financing.title')}>
        <div className={`container ${s.mentions}`}>
          <Icon name="info" size={20} />
          <div>
            <p>{settings['legal.simulatorDisclaimer']}</p>
            <p>{settings['legal.monthlyFootnote']}</p>
          </div>
        </div>
      </section>

      <CallCard
        href={callback}
        secondary={
          settings['features.projectionRequest']
            ? { href: '/projection', label: t('ui.editorial.financing.projection') }
            : { href: '/financements/simulateur-eligibilite', label: t('ui.editorial.financing.simulate') }
        }
      />
    </>
  );
}
