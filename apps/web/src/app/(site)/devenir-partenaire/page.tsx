// EP-23 — « Devenir partenaire » (DEM-019): the door of notaries, insurers, institutions and media; promoters and banks
// are sent to their own signup (EP-32, ACP-080), said at the top. Scene « Partenaire » (DSN-076, D-092).
// `features.partnerForm` false: 404 (NAV-003). Tags: content, settings.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Icon } from '@dp/ui';
import { getBlocks, text } from '@/lib/content';
import { getSettings } from '@/lib/settings';
import { description, editorialTitle } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { Drawing } from '@/components/editorial/Drawing';
import { PartnerForm } from '@/components/partner/PartnerForm';
import { GainList, TaskPage } from '@/components/task/TaskPage';
import task from '@/components/task/task.module.css';
import s from '@/components/partner/partner.module.css';

type Items = { title: string; text: string }[];

export async function generateMetadata(): Promise<Metadata> {
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks('Devenir partenaire')]);
  if (!settings['features.partnerForm']) return {};
  return {
    title: { absolute: editorialTitle(t('ui.partner.page.title'), settings) },
    description: description(text(blocks, 'partnerPage.intro')),
    alternates: { canonical: '/devenir-partenaire' },
  };
}

export default async function PartnerRequestPage() {
  const settings = await getSettings();
  if (!settings['features.partnerForm']) notFound();
  const blocks = await getBlocks('Devenir partenaire');
  const points = Array.isArray(blocks['partnerPage.points']) ? (blocks['partnerPage.points'] as Items) : [];
  const partnersEmail = settings['contact.partnersEmail'];
  return (
    <TaskPage
      title={t('ui.partner.page.title')}
      intro={text(blocks, 'partnerPage.intro')}
      scene={<Drawing name="partenaire" />}
      aside={
        <div className={s.stack}>
          <GainList id="partenaire-pourquoi" title={t('ui.partner.page.pointsTitle')} items={points} />
          {partnersEmail ? (
            <p className={task.note}>
              {t('ui.partner.form.contactLine')} <a href={`mailto:${partnersEmail}`}>{partnersEmail}</a>
            </p>
          ) : null}
        </div>
      }
    >
      <div className={s.stack}>
        <p className={s.door}>
          <span className={s.doorIcon}>
            <Icon name="building" size={20} />
          </span>
          <span className={s.doorText}>{t('ui.partner.door.text')}</span>
          <Link href="/partenaires/inscription" className={s.doorLink}>
            {t('ui.partner.door.link')}
            <Icon name="chevron-right" size={16} />
          </Link>
        </p>
        <Suspense fallback={null}>
          <PartnerForm settings={settings} />
        </Suspense>
      </div>
    </TaskPage>
  );
}
