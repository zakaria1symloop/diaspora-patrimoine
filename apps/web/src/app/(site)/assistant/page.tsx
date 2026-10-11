// EP-22 — search assistant (02-site-public/09). `features.assistant.mode`: OFF → 404 and the links are hidden (ACC-090,
// NAV-003); GUIDED → the five-question questionnaire; AI → the conversation (ASS-050 to ASS-052) when the API says the
// model can answer (`GET /public/assistant/status`), else the questionnaire, its fallback. Not indexed (NAV-001, NAV-031).
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Icon } from '@dp/ui';
import type { AssistantStatusResponse } from '@dp/contracts';
import { apiGet } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { editorialTitle } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { AssistantSwitch } from '@/components/assistant/AssistantSwitch';
import { Drawing } from '@/components/editorial/Drawing';
import e from '@/components/editorial/editorial.module.css';
import s from '@/components/assistant/assistant.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  if (settings['features.assistant.mode'] === 'OFF') return {};
  return {
    title: { absolute: editorialTitle(t('ui.assistant.page.title'), settings) },
    description: t('ui.assistant.page.description'),
    robots: { index: false, follow: false },
  };
}

/** ASS-052 — AI only when the setting asks for it and the model can answer now (provider configured, budget left). */
async function aiAvailable(mode: string): Promise<boolean> {
  if (mode !== 'AI') return false;
  try {
    return (await apiGet<AssistantStatusResponse>('/public/assistant/status', { revalidate: 0 })).mode === 'AI';
  } catch {
    return false;
  }
}

export default async function AssistantPage() {
  const settings = await getSettings();
  if (settings['features.assistant.mode'] === 'OFF') notFound();
  const ai = await aiAvailable(settings['features.assistant.mode']);
  return (
    <div className={s.page}>
      <div className="container">
        <div className={s.head}>
          <div className={s.headText}>
            <nav aria-label={t('ui.nav.breadcrumb')} className={e.breadcrumb}>
              <Link href="/">{t('ui.editorial.common.home')}</Link>
              <Icon name="chevron-right" size={16} />
              <span aria-current="page">{t('ui.assistant.page.title')}</span>
            </nav>
            <h1 className={e.title}>
              <span className={e.titleText}>{t('ui.assistant.page.title')}</span>
              <svg
                className={e.titleStroke}
                viewBox="0 0 320 18"
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M4 14C70 6 190 2 316 6"
                  stroke="var(--bo-fond-champagne)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M4 14C60 8 130 5 200 4"
                  stroke="var(--bo-accent-or)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </h1>
          </div>
          {/* D-091 — a single-task page keeps its animated drawing */}
          <Drawing name="questions" className={s.headDrawing} />
        </div>
        <Suspense fallback={<div className={s.shell} aria-busy="true" />}>
          <AssistantSwitch settings={settings} aiAvailable={ai} />
        </Suspense>
      </div>
    </div>
  );
}
