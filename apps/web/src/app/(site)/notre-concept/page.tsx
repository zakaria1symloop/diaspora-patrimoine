// EP-16 — Notre concept (EDI-010, EDI-011, EDI-070, EDI-071). Fixed structure, texts from content blocks; a block
// emptied by the administrator hides its section (EDI-001). Tags: content, settings.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ConceptAnswers, ConceptSteps, KeyFigures as KeyFiguresBlock, ListResponse, PublicTestimonial } from '@dp/contracts';
import { Icon, type IconName } from '@dp/ui';
import { apiGet } from '@/lib/api';
import { getBlocks, text } from '@/lib/content';
import { getSettings } from '@/lib/settings';
import { callbackHref, description, editorialTitle, objBlock, richBlock } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { CallCard, PageHead, RichText, SectionHeading } from '@/components/editorial/Parts';
import { Drawing } from '@/components/editorial/Drawing';
import { KeyFigures, Testimonials } from '@/components/editorial/Cards';
import { FaqSection } from '@/components/editorial/FaqSection';
import s from '@/components/editorial/editorial.module.css';

// ACC-070 — the seven services of the home page, same icons, links and hiding rules.
const SERVICE_ICONS: IconName[] = ['sliders', 'chat', 'badge', 'diamond', 'cafe-cup', 'coins', 'file'];
const SERVICE_LINKS = ['/programmes', '/assistant', '/promoteurs', '/programmes', '/le-cafe', '/financements', '#accompagnement'];

export async function generateMetadata(): Promise<Metadata> {
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks('Notre concept')]);
  return {
    title: { absolute: editorialTitle(t('ui.editorial.concept.title'), settings) },
    description: description(text(blocks, 'concept.intro')),
    alternates: { canonical: '/notre-concept' },
  };
}

export default async function ConceptPage() {
  const [settings, blocks, testimonials] = await Promise.all([
    getSettings(),
    getBlocks('Notre concept', 'Accueil'),
    apiGet<ListResponse<PublicTestimonial>>('/public/testimonials', { tags: ['content'] }),
  ]);
  const cafe = settings['features.cafe'];
  const assistantOff = settings['features.assistant.mode'] === 'OFF';

  // Section 2 — the first answer (Le Café) is hidden while features.cafe is false.
  const answers = objBlock<ConceptAnswers>(blocks, 'concept.answers', [])
    .map((a, i) => ({ ...a, index: i }))
    .filter((a) => a.problem.trim() && a.answer.trim() && !(a.index === 0 && !cafe));
  const stepsBlock = objBlock<ConceptSteps | null>(blocks, 'concept.steps', null);
  const steps = (stepsBlock?.steps ?? [])
    .map((st, i) => ({ n: i + 1, title: st.title, text: cafe && st.textWithCafe?.trim() ? st.textWithCafe : st.text }))
    .filter((st) => st.title.trim());
  const services = objBlock<{ title: string; text: string }[]>(blocks, 'home.services.items', [])
    .map((it, i) => ({ ...it, icon: SERVICE_ICONS[i] ?? 'star', href: SERVICE_LINKS[i] ?? '/', index: i }))
    .filter((it) => it.title.trim() && !(it.index === 1 && assistantOff) && !(it.index === 4 && !cafe));
  const support = richBlock(blocks, 'concept.support');
  const figures = objBlock<KeyFiguresBlock>(blocks, 'concept.keyFigures', []);
  const figuresShown = figures.filter((f) => f.value.trim() && f.label.trim()).length >= 3;

  return (
    <>
      <PageHead title={t('ui.editorial.concept.title')} intro={text(blocks, 'concept.intro')} drawing="concept" />

      {answers.length ? (
        <section className={`${s.section} ${s.bgIvoire}`} aria-labelledby="freins">
          <div className="container">
            <SectionHeading id="freins" title={t('ui.editorial.concept.answersTitle')} icon="bulb" align="center" />
            <ul role="list" className={s.answers}>
              {answers.map((a) => (
                <li key={a.index} className={s.answer}>
                  <div className={s.answerProblem}>
                    <span className={s.label}>{t('ui.editorial.concept.problem')}</span>
                    <p>{a.problem}</p>
                  </div>
                  <div className={s.answerSolution}>
                    <span className={s.answerArrow} aria-hidden="true">
                      <Icon name="arrow-right" size={20} />
                    </span>
                    <span className={`${s.label} ${s.labelGold}`}>{t('ui.editorial.concept.answer')}</span>
                    <p>{a.answer}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {steps.length ? (
        <section className={`${s.section} ${s.bgCiel}`} aria-labelledby="etapes">
          <div className="container">
            <SectionHeading id="etapes" title={t('ui.editorial.concept.stepsTitle')} icon="sparkles" align="center" />
            <ol role="list" className={s.steps}>
              {steps.map((st) => (
                <li key={st.n} className={s.step}>
                  <span className={s.stepNumber} aria-hidden="true">
                    {st.n}
                  </span>
                  <span className="visually-hidden">{t('ui.editorial.concept.step', { n: st.n })}</span>
                  <h3 className={s.stepTitle}>{st.title}</h3>
                  <p className={s.cardText}>{st.text}</p>
                </li>
              ))}
            </ol>
            {stepsBlock?.reservation?.trim() ? (
              <p className={s.reservation}>
                <Icon name="key" size={24} />
                <span>{stepsBlock.reservation}</span>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {services.length ? (
        <section className={s.section} aria-labelledby="services">
          <div className="container">
            <SectionHeading id="services" title={t('ui.editorial.concept.servicesTitle')} icon="star" align="center" />
            <ul role="list" className={s.services}>
              {services.map((it) => (
                <li key={it.index} className={`${s.card} ${s.cardLink}`}>
                  <span className={`${s.serviceIcon} ${it.index === 4 ? s.serviceIconGold : ''}`}>
                    <Icon name={it.icon} size={24} />
                  </span>
                  <h3 className={s.cardTitle}>
                    <Link href={it.href} className={s.stretch}>
                      {it.title}
                    </Link>
                  </h3>
                  <p className={s.cardText}>{it.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {support ? (
        <section id="accompagnement" className={`${s.section} ${s.bgCreme}`} aria-labelledby="accompagnement-titre">
          <div className={`container ${s.supportGrid}`}>
            <div>
              <SectionHeading id="accompagnement-titre" title={t('ui.editorial.concept.supportTitle')} icon="file" />
              <RichText html={support} />
            </div>
            <Drawing name="document" />
          </div>
        </section>
      ) : null}

      {figuresShown ? (
        <section className={s.section} aria-labelledby="chiffres">
          <div className="container">
            <SectionHeading id="chiffres" title={t('ui.editorial.concept.figuresTitle')} icon="medal" align="center" />
            <KeyFigures items={figures} />
          </div>
        </section>
      ) : null}

      {testimonials.data.length >= 2 ? (
        <section className={`${s.section} ${s.bgIvoire}`} aria-labelledby="temoignages">
          <div className="container">
            <SectionHeading id="temoignages" title={t('ui.editorial.concept.testimonialsTitle')} icon="heart" align="center" />
            <Testimonials items={testimonials.data} />
          </div>
        </section>
      ) : null}

      <FaqSection placement="NOTRE_CONCEPT" />

      <CallCard href={callbackHref(settings)} />
    </>
  );
}
