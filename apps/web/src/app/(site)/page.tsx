// EP-01 — home page: server-rendered, cached with the tags home, catalogue, events, content, settings (ARC-040).
// Each fallback is decided here, on the server (ACC-091): nothing appears then disappears after loading.
import type { Metadata } from 'next';
import type { ComparisonBlock, HomeResponse } from '@dp/contracts';
import { apiGet } from '@/lib/api';
import { getBlocks, image, resolveImage, text } from '@/lib/content';
import { getSettings } from '@/lib/settings';
import { JsonLd, websiteLd } from '@/lib/json-ld';
import { t } from '@/lib/i18n';
import { Hero } from '@/components/home/Hero';
import { SimulateBlock } from '@/components/home/SimulateBlock';
import { HomeActionBar } from '@/components/home/HomeActionBar';
import { SimpleHome } from '@/components/home/SimpleHome';
import hs from '@/components/home/home.module.css';
import { ProjectionForm } from '@/components/forms/ProjectionForm';
import { CafeSection, FinalSection, FinancingSection, PropertiesSection, ServicesSection, WhySection } from '@/components/home/Sections';

export async function generateMetadata(): Promise<Metadata> {
  const [blocks, settings] = await Promise.all([getBlocks('Référencement'), getSettings()]);
  return {
    title: { absolute: text(blocks, 'home.seoTitle') ?? settings['seo.siteName'] },
    description: settings['seo.defaultDescription'],
    alternates: { canonical: '/' },
  };
}

function obj<T>(blocks: Record<string, unknown>, key: string, fallback: T): T {
  const v = blocks[key];
  return v && typeof v === 'object' ? (v as T) : fallback;
}

export default async function HomePage() {
  const [home, blocks, settings] = await Promise.all([
    apiGet<HomeResponse>('/public/home', { tags: ['home', 'catalogue', 'events'] }),
    getBlocks('Accueil'),
    getSettings(),
  ]);
  const cafe = settings['features.cafe'];
  const whyItems = obj<{ title: string; text: string; image?: unknown }[]>(blocks, 'home.why.items', []);
  const [heroImage, cafePhoto, whyImages] = await Promise.all([
    image(blocks, 'home.hero.image'),
    cafe ? image(blocks, 'home.cafe.photo') : null,
    Promise.all(whyItems.map((it) => resolveImage(it.image))),
  ]);
  const islamic = settings['features.islamicFinance'];
  const projection = settings['features.projectionRequest'];
  const monthly = settings['features.monthlyBudgetSearch'];
  const callbackHref = settings['features.callbackRequest'] ? '?rappel=1' : '/contact?objet=rappel';
  const year = String(new Date().getFullYear());
  const lines = (prefix: string) => ({
    title1: text(blocks, `${prefix}.title1`),
    title2: text(blocks, `${prefix}.title2`)?.replace('{année}', year) ?? null,
    sub1: text(blocks, `${prefix}.subtitle1`),
    sub2: text(blocks, `${prefix}.subtitle2`),
  });
  const simFallback = obj(blocks, 'home.projection.fallback', { title: '', text: '' });
  const projectionTexts = obj(blocks, 'home.projection', { title: '', badge: '', text: '', button: '' });
  const regionsForForm = home.search.regions.map((r) => ({ slug: r.slug, name: r.name }));
  // ACC-081 / ACC-090 — the projection form, or its « Simulez votre projet » fallback.
  const projectionBlock = projection ? (
    <ProjectionForm settings={settings} regions={regionsForForm} texts={projectionTexts} />
  ) : (
    <SimulateBlock title={simFallback.title} text={simFallback.text} />
  );
  const financingItems = obj<{ key: string; overline: string; title: string; text: string; points: string[]; visible: boolean }[]>(
    blocks,
    'home.financing.items',
    [],
  ).filter((it) => it.visible && (islamic || it.key !== 'islamic'));
  const financingLines = lines('home.financing');
  if (!islamic) {
    financingLines.sub1 = text(blocks, 'home.financing.subtitleNoIslamic');
    financingLines.sub2 = null;
  }
  // ACC-054 — the note under the cards, made of the configured notices only.
  const notes: string[] = [];
  if (monthly && home.featured.some((c) => c.monthlyFromRef)) notes.push(settings['legal.monthlyFootnote']);
  if (home.featured.some((c) => c.cover?.isIllustration)) notes.push(`${settings['legal.illustrationNote']}.`);

  return (
    <>
      <JsonLd data={websiteLd(settings)} />
      <SimpleHome
        title={[text(blocks, 'home.hero.line1'), text(blocks, 'home.hero.line2'), text(blocks, 'home.hero.line3')].filter(Boolean).join(' ')}
        search={home.search}
        monthlyEnabled={monthly}
        roomsPrefix={settings['display.roomsPrefix']}
        callbackHref={callbackHref}
      />
      <div className={hs.fullHome}>
      <Hero
        lines={[text(blocks, 'home.hero.line1'), text(blocks, 'home.hero.line2'), text(blocks, 'home.hero.line3')]}
        home={home}
        cafeEnabled={cafe}
        islamicEnabled={islamic}
        callbackHref={callbackHref}
        cafeCard={obj(blocks, 'home.hero.cafeCard', { overline: '', brand: '', text1: '', text2: '', place1: '', place2: '' })}
        fallbackCard={obj(blocks, 'home.hero.fallbackCard', { title: '', text: '' })}
        mentions={obj(blocks, 'home.hero.mentions', { credit: '', islamic: '' })}
        comparison={obj<(ComparisonBlock & Record<string, string>) | null>(blocks, 'home.comparison', null)}
        monthlyFootnote={settings['legal.monthlyFootnote']}
        image={heroImage}
        cafePhoto={cafePhoto}
      />
      <WhySection lines={lines('home.why')} items={whyItems.map((it, i) => ({ title: it.title, text: it.text, image: whyImages[i] ?? null }))} />
      <PropertiesSection
        lines={lines('home.properties')}
        home={home}
        assistant={{
          line1: text(blocks, 'home.assistant.line1'),
          line2: text(blocks, 'home.assistant.line2'),
          enabled: settings['features.assistant.mode'] !== 'OFF',
        }}
        monthlyEnabled={monthly}
        roomsPrefix={settings['display.roomsPrefix']}
        notes={notes}
        illustrationNote={settings['legal.illustrationNote']}
        callbackHref={callbackHref}
        fallback={<div id="projection">{projectionBlock}</div>}
      />
      {cafe ? (
        <CafeSection
          lines={lines('home.cafe')}
          cafes={home.cafes}
          places={obj(blocks, 'home.cafe.places', { place1: '', place2: '', rhythm: '' })}
          note={text(blocks, 'home.cafe.note')}
          photo={cafePhoto}
        />
      ) : null}
      <ServicesSection
        lines={lines('home.services')}
        items={obj(blocks, 'home.services.items', [])}
        cta={obj(blocks, 'home.services.cta', { title: '', text: '', button: '' })}
        hide={{ assistant: settings['features.assistant.mode'] === 'OFF', cafe: !cafe }}
        callbackHref={callbackHref}
      />
      <FinancingSection lines={financingLines} items={financingItems} downPaymentPct={home.referenceDownPaymentPct} cafeEnabled={cafe}>
        <div id="projection">{home.featured.length ? projectionBlock : null}</div>
      </FinancingSection>
      <FinalSection
        title1={text(blocks, 'home.final.title1')}
        title2={text(blocks, 'home.final.title2')}
        text={!cafe && !projection ? text(blocks, 'home.final.textFallback') : text(blocks, 'home.final.text')}
        nextCafe={home.nextCafe}
        cafeEnabled={cafe}
        projectionEnabled={projection}
        photo={heroImage}
      />
      {/* ACC-100 — the phone action bar: the next Café, or a callback when Le Café is off */}
      {cafe ? (
        <HomeActionBar href={home.nextCafe ? `/le-cafe/${home.nextCafe.slug}#inscription` : '/le-cafe'} label={t('ui.home.final.register')} />
      ) : (
        <HomeActionBar href={callbackHref} label={t('ui.home.properties.callback')} scroll={false} />
      )}
      </div>
    </>
  );
}
