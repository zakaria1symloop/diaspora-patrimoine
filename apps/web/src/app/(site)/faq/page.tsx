// EP-18 — Questions fréquentes (EDI-040): served questions by category (Acheter · Financement · Votre dossier · Le Café ·
// La plateforme), search while typing, `#q-{slug}` anchors, then « Vous n'avez pas trouvé votre réponse ? » → /contact.
// JSON-LD FAQPage with the published questions of the page (NAV-035). Tags: content, settings.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { getSettings } from '@/lib/settings';
import { callbackHref, description, editorialTitle } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { CallCard, EmptyState, PageHead } from '@/components/editorial/Parts';
import { FaqList } from '@/components/editorial/FaqList';
import { faqGroups, getFaq } from '@/components/editorial/FaqSection';
import s from '@/components/editorial/editorial.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const [settings, items] = await Promise.all([getSettings(), getFaq()]);
  return {
    title: { absolute: editorialTitle(t('ui.editorial.faq.title'), settings) },
    description: description(items.map((i) => i.question).join(' ')),
    alternates: { canonical: '/faq' },
  };
}

export default async function FaqPage() {
  const [settings, items] = await Promise.all([getSettings(), getFaq()]);
  const groups = faqGroups(items);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((g) =>
      g.items.map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.text } })),
    ),
  };
  return (
    <>
      {items.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /> : null}
      <PageHead title={t('ui.editorial.faq.title')} drawing="questions" />

      <section className={`${s.section} ${s.bgIvoire}`} aria-label={t('ui.editorial.faq.title')}>
        <div className="container">
          <div className={s.faqWrap}>
          {groups.length ? <FaqList groups={groups} search /> : <EmptyState text={t('ui.editorial.faq.empty')} drawing="questions" />}
          </div>
        </div>
      </section>

      <section className={s.sectionTight} aria-labelledby="pas-trouve">
        <div className={`container ${s.notFound}`}>
          <Icon name="mail" size={32} />
          <h2 id="pas-trouve" className={s.notFoundTitle}>
            {t('ui.editorial.faq.notFoundTitle')}
          </h2>
          <Link href="/contact" className={buttonClass('secondary', 'L')}>
            <ButtonInner chevron size="L">
              {t('ui.editorial.faq.notFoundButton')}
            </ButtonInner>
          </Link>
        </div>
      </section>

      <CallCard href={callbackHref(settings)} />
    </>
  );
}
