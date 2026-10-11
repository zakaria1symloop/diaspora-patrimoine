// EC-11, tab « Suivi » (ECL-031): what comes next and how complete the dossier is, then its history as the client may
// read it (filtered by family, server side); on the side, who follows it, the property with its figures, and the
// dossier in brief. Three zones on a wide screen, two on a computer, one on a phone.
import { notFound } from 'next/navigation';
import type { ClientSpaceSummary, DossierView, TimelineFamily, TimelinePage } from '@dp/contracts';
import { TIMELINE_FAMILY_KEYS } from '@dp/contracts';
import type { MessageKey } from '@dp/i18n';
import { t } from '@/lib/i18n';
import { getSettings } from '@/lib/settings';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { longDate, type PromiseSettings } from '@/components/client-space/texts';
import { AdvisorBlock, Completeness, NextStep, PropertyBlock } from '@/components/client-space/dashboard/blocks';
import { Timeline } from '@/components/client-space/dossier/Timeline';
import { Figures } from '@/components/client-space/kit/Figures';
import sp from '@/components/client-space/space.module.css';
import s from '@/components/client-space/dossier/dossier.module.css';

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return { title: t('ui.client.dossier.title', { reference: reference.toUpperCase() }) };
}

type Search = Record<string, string | string[] | undefined>;

export default async function DossierFollowUpPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<Search> }) {
  const { reference } = await params;
  const query = await searchParams;
  const ref = encodeURIComponent(reference);
  // TRV-101 — the family of the filter is in the address (`suivi=documents`).
  const asked = String(Array.isArray(query.suivi) ? query.suivi[0] : (query.suivi ?? '')).toUpperCase();
  const family = (TIMELINE_FAMILY_KEYS as string[]).includes(asked) ? (asked as TimelineFamily) : null;
  const [r, tl, settings, space] = await Promise.all([
    spaceGet<DossierView>(`/client/dossiers/${ref}`),
    spaceGet<TimelinePage>(`/client/dossiers/${ref}/timeline`, { family }),
    getSettings(),
    spaceGet<ClientSpaceSummary>('/client/space'),
  ]);
  if (!r.ok) return r.status === 404 ? notFound() : <SpaceReadFailure result={r} />;
  const d = r.data;
  const timeZone = space.ok ? space.data.timeZone : settings['business.calendar.timezone'];
  const ps: PromiseSettings = { firstContactBusinessDays: settings['sla.firstContactBusinessDays'], phone: settings['contact.phone'] || null, whatsapp: settings['contact.whatsapp'] || null };
  const current = d.steps.find((x) => x.state === 'CURRENT')?.n ?? (d.status === 'WON' ? 6 : 2);
  const stepLabel = t((!d.financingRequested && current === 6 ? 'ui.client.steps.6.labelCash' : `ui.client.steps.${current}.label`) as MessageKey);
  return (
    <div className={s.layout}>
      <div className={s.main}>
        {d.nextStep || d.completenessPct !== null ? (
          <section className={`${sp.block} ${s.now}`} aria-label={t('ui.client.dashboard.project.nextStep')}>
            <NextStep dossier={d} timeZone={timeZone} settings={ps} />
            <Completeness dossier={d} />
          </section>
        ) : null}
        <section className={sp.block} aria-labelledby="suivi">
          <div className={sp.blockHead}>
            <h2 id="suivi" className={sp.blockTitle}>
              {t('ui.client.dossier.timeline.title')}
            </h2>
          </div>
          {tl.ok ? <Timeline reference={d.reference} initial={tl.data} initialFamily={family} timeZone={timeZone} /> : <SpaceReadFailure result={tl} />}
        </section>
      </div>
      <div className={s.side}>
        <AdvisorBlock advisor={d.advisor} promise={null} settings={ps} whatsapp={ps.whatsapp} timeZone={timeZone} dossier={d.reference} />
        {d.property ? (
          <PropertyBlock property={d.property} footnote={settings['legal.monthlyFootnote']} monthlyEnabled={settings['features.monthlyBudgetSearch']} title={t('ui.client.dossier.property.title')} />
        ) : null}
        <section className={sp.block} aria-labelledby="en-bref">
          <h2 id="en-bref" className={`${sp.blockTitle} ${s.factsTitle}`}>
            {t('ui.client.dossier.facts.title')}
          </h2>
          <Figures
            dense
            items={[
              { label: t('ui.client.dossier.facts.step'), value: `${t('ui.client.dossier.facts.stepValue', { n: current })} · ${stepLabel}` },
              { label: t('ui.client.dossier.facts.financing'), value: d.financingRequested ? t('ui.client.dossier.facts.financingYes') : t('ui.client.dossier.facts.financingNo') },
              { label: t('ui.client.dossier.facts.opened'), value: longDate(d.createdAt, timeZone) },
              { label: t('ui.client.dossier.facts.lastActivity'), value: longDate(d.lastActivityAt, timeZone) },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
