// EDI-040 — the FAQ data of the site (tag `content`) and the « Questions fréquentes » section of a placement page:
// six questions at most, in category order then `sortOrder`, then « Toutes les questions ». Hidden without questions.
import 'server-only';
import Link from 'next/link';
import { FAQ_CATEGORY_ORDER, FAQ_PLACEMENT_LIMIT, type FaqPlacement, type ListResponse, type PublicFaqItem } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { apiGet } from '@/lib/api';
import { plainText, richOrText } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { FaqList, type FaqGroup } from './FaqList';
import { SectionHeading } from './Parts';
import s from './editorial.module.css';

export async function getFaq(placement?: FaqPlacement): Promise<PublicFaqItem[]> {
  const res = await apiGet<ListResponse<PublicFaqItem>>('/public/faq', { tags: ['content', 'settings'], searchParams: { placement } });
  return res.data;
}

export function faqGroups(items: PublicFaqItem[]): FaqGroup[] {
  return FAQ_CATEGORY_ORDER.map((category) => ({
    category,
    label: t(`ui.enum.FaqCategory.${category}`),
    items: items
      .filter((i) => i.category === category)
      .map((i) => {
        const html = richOrText(i.answer);
        return { slug: i.slug, question: i.question, html, text: plainText(html) };
      }),
  })).filter((g) => g.items.length > 0);
}

export async function FaqSection({ placement, id = 'questions', className }: { placement: FaqPlacement; id?: string; className?: string }) {
  const items = (await getFaq(placement)).slice(0, FAQ_PLACEMENT_LIMIT);
  if (items.length === 0) return null;
  return (
    <section id={id} className={[s.section, className].filter(Boolean).join(' ')} aria-labelledby={`${id}-titre`}>
      <div className="container">
        <SectionHeading id={`${id}-titre`} title={t('ui.editorial.common.faqTitle')} icon="chat" />
        <FaqList groups={faqGroups(items)} headingLevel={3} />
        <div className={s.center}>
          <Link href="/faq" className={s.textLink}>
            {t('ui.editorial.common.allQuestions')}
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
