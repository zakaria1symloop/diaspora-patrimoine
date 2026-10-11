// EC-10 — Tableau de bord (ECL-010 … ECL-015). It leads with what the person needs to know and do NOW (D-098): the
// greeting with ONE encouragement that says where they stand (ECL-015), their figures (« Vos repères »), then the
// blocks in the order of ECL-010 — a block without content is hidden. What is shown depends on the situation
// (ECL-014): a dossier open or paused, a won one, only closed ones, a request without dossier, or nothing yet (ECL-013).
// The page uses the whole width: three columns on a wide screen, two on a computer, one on a phone (spec order).
import Link from 'next/link';
import { Suspense } from 'react';
import type { ClientDashboard } from '@dp/contracts';
import { buttonClass, ButtonInner, Celebration } from '@dp/ui';
import type { MessageKey } from '@dp/i18n';
import { t } from '@/lib/i18n';
import { getSettings } from '@/lib/settings';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { writeToAdvisorHref } from '@/components/client-space/advisor-link';
import { documentsPath, dossierPath } from '@/components/client-space/menu';
import { advisorName, longDate, nextStepSentence, promiseSentence, quand, type PromiseSettings } from '@/components/client-space/texts';
import { AdvisorBlock, CafeBlock, ProjectBlock, PropertyBlock, ShortcutsBlock, TodoBlock } from '@/components/client-space/dashboard/blocks';
import { NewsBlock } from '@/components/client-space/dashboard/NewsBlock';
import { SpaceTour } from '@/components/client-space/dashboard/SpaceTour';
import { EmailBounced } from '@/components/client-space/dashboard/EmailBounced';
import { Encouragement } from '@/components/client-space/kit/Encouragement';
import { StatTile, StatTiles } from '@/components/client-space/kit/Figures';
import s from '@/components/client-space/dashboard/dashboard.module.css';

export const metadata = { title: t('ui.client.menu.dashboard') };

function HeroArt() {
  return (
    <svg className={s.heroArt} viewBox="0 0 320 200" aria-hidden="true">
      <circle className={s.sun} cx="250" cy="70" r="38" />
      <path className={s.line} d="M10 190H310" pathLength={1} strokeWidth="1.5" />
      <path className={s.roi} d="M150 190V110L200 72L250 110V190" pathLength={1} />
      <rect className={s.roi} x="186" y="140" width="28" height="50" rx="2" pathLength={1} />
      <path className={s.roi} d="M60 190V130H120V190" pathLength={1} />
      <path className={s.line} d="M72 145H108M72 160H108M72 175H108" pathLength={1} strokeWidth="1.5" />
      <path className={s.gold} d="M200 72V48M188 56H212" pathLength={1} strokeWidth="2" />
      <path className={s.gold} d="M20 120C60 96 96 110 130 92" pathLength={1} strokeWidth="1.6" strokeDasharray="1" />
    </svg>
  );
}

/** ECL-015 — the one encouragement of the dashboard: the first true line, from the figures the server computed. */
function DashboardEncouragement({ d, ps }: { d: ClientDashboard; ps: PromiseSettings }) {
  const dossier = d.dossier;
  const conseiller = advisorName(d.advisor) ?? t('ui.client.nextStep.advisorFallback');
  if (d.situation === 'WON' && dossier) {
    return (
      <Encouragement
        tone="done"
        icon="medal"
        medal={<Celebration moment="dossier_won" objectId={dossier.reference} />}
        title={t('ui.client.dashboard.encourage.won.title')}
        text={dossier.nextStep ? nextStepSentence(dossier.nextStep, dossier.advisor, d.timeZone, ps) : undefined}
      />
    );
  }
  if (d.situation === 'LEAD_ONLY' && d.lead) {
    return (
      <Encouragement
        tone="calm"
        icon="status-success"
        title={t('ui.client.dashboard.encourage.lead.title')}
        text={
          <>
            <span>{t('ui.client.dashboard.lead.registered', { reference: d.lead.reference })}</span>
            {d.promise ? <span>{` ${promiseSentence(d.promise, ps)}`}</span> : null}
          </>
        }
      />
    );
  }
  if (d.situation !== 'ACTIVE' || !dossier) return null;
  const current = dossier.steps.find((x) => x.state === 'CURRENT')?.n ?? 2;
  const stepLabel = t((!dossier.financingRequested && current === 6 ? 'ui.client.steps.6.labelCash' : `ui.client.steps.${current}.label`) as MessageKey);
  if (dossier.status === 'ON_HOLD') {
    return (
      <Encouragement
        tone="calm"
        icon="pause"
        title={t('ui.client.dashboard.encourage.paused.title')}
        text={t('ui.client.banner.ON_HOLD')}
        actions={
          <Link href={writeToAdvisorHref({ from: 'RESUME_PROJECT', dossier: dossier.reference })} className={buttonClass('tool', 'M')}>
            <ButtonInner size="M">{t('ui.client.banner.resume')}</ButtonInner>
          </Link>
        }
      />
    );
  }
  const docs = dossier.documents;
  if (docs && dossier.stage === 'DOCUMENTS') {
    const left = docs.toProvide + docs.toRedo;
    const progress = {
      value: docs.satisfied,
      max: Math.max(docs.required, 1),
      label: t('ui.client.dashboard.project.completeness', { n: dossier.completenessPct ?? 0 }),
      legend: t('ui.client.dashboard.encourage.docsLegend', { x: docs.satisfied, y: docs.required }),
      legendEnd: <strong>{t('ui.client.dashboard.project.completenessShort', { n: dossier.completenessPct ?? 0 })}</strong>,
    };
    if (left > 0) {
      return (
        <Encouragement
          tone="progress"
          icon="upload"
          title={t('ui.client.dashboard.encourage.documentsLeft.title', { n: left })}
          text={t('ui.client.dashboard.encourage.documentsLeft.text')}
          progress={progress}
          actions={
            dossier.hasDocumentList ? (
              <Link href={documentsPath(dossier.reference)} className={buttonClass('tool', 'L')}>
                <ButtonInner size="L" chevron>
                  {t('ui.client.dashboard.encourage.documentsLeft.action')}
                </ButtonInner>
              </Link>
            ) : undefined
          }
        />
      );
    }
    if (docs.inReview > 0) {
      return <Encouragement tone="calm" icon="clock" title={t('ui.client.dashboard.encourage.documentsChecking.title')} text={t('ui.client.dashboard.encourage.documentsChecking.text')} progress={progress} />;
    }
    if (docs.required > 0 && docs.satisfied >= docs.required) {
      return (
        <Encouragement
          tone="done"
          icon="status-success"
          medal={<Celebration moment="dossier_complete" objectId={dossier.reference} />}
          title={t('ui.client.dashboard.encourage.complete.title')}
          text={dossier.nextStep ? nextStepSentence(dossier.nextStep, dossier.advisor, d.timeZone, ps) : undefined}
          progress={{ ...progress, tone: 'green' }}
        />
      );
    }
  }
  if (d.overview.proposalsNew > 0) {
    return (
      <Encouragement
        tone="attention"
        icon="sparkles"
        title={t('ui.client.dashboard.encourage.proposals.title', { n: d.overview.proposalsNew })}
        text={t('ui.client.dashboard.encourage.proposals.text', { n: d.overview.proposalsNew, conseiller })}
        actions={
          <Link href="/espace-client/biens-proposes" className={buttonClass('tool', 'L')}>
            <ButtonInner size="L" chevron>
              {t('ui.client.dashboard.encourage.proposals.action')}
            </ButtonInner>
          </Link>
        }
      />
    );
  }
  // ECL-011 line 9 — before the qualification, the useful thing to do is the profile.
  if (d.profileCompletePct < 100 && ['INTEREST', 'QUALIFICATION'].includes(dossier.stage)) {
    return (
      <Encouragement
        tone="progress"
        icon="user"
        title={t('ui.client.dashboard.encourage.profile.title')}
        text={t('ui.client.dashboard.todo.PROFILE_INCOMPLETE')}
        progress={{ value: d.profileCompletePct, label: t('ui.client.dashboard.profile.complete', { n: d.profileCompletePct }), legend: t('ui.client.dashboard.profile.complete', { n: d.profileCompletePct }) }}
        actions={
          <Link href="/espace-client/profil" className={buttonClass('tool', 'M')}>
            <ButtonInner size="M" chevron>
              {t('ui.client.dashboard.encourage.profile.action')}
            </ButtonInner>
          </Link>
        }
      />
    );
  }
  return (
    <Encouragement
      tone="calm"
      icon="key"
      title={t('ui.client.dashboard.encourage.started.title')}
      text={t('ui.client.dashboard.encourage.started.text', { n: current, etape: stepLabel })}
      progress={{ value: current, max: 6, label: t('ui.client.dashboard.encourage.stepLegend', { n: current }), legend: t('ui.client.dashboard.encourage.stepLegend', { n: current }) }}
    />
  );
}

/** ECL-010 « Vos repères » — the counts the server computed; a count at zero has no tile, each tile opens its page. */
function Overview({ d }: { d: ClientDashboard }) {
  const o = d.overview;
  const dossier = d.dossier;
  const tiles: React.ReactNode[] = [];
  let i = 0;
  if (dossier && d.situation === 'ACTIVE') {
    const current = dossier.steps.find((x) => x.state === 'CURRENT')?.n ?? 2;
    const label = t((!dossier.financingRequested && current === 6 ? 'ui.client.steps.6.labelCash' : `ui.client.steps.${current}.label`) as MessageKey);
    tiles.push(<StatTile key="step" index={i++} icon="key" tone="gold" text value={t('ui.client.dashboard.overview.step', { n: current })} label={label} href={dossierPath(dossier.reference)} />);
    const left = dossier.documents ? dossier.documents.toProvide + dossier.documents.toRedo : 0;
    if (left > 0 && dossier.hasDocumentList) {
      tiles.push(<StatTile key="docs" index={i++} icon="upload" tone="gold" value={left} label={t('ui.client.dashboard.overview.documents', { n: left })} href={documentsPath(dossier.reference)} />);
    }
  }
  if (o.proposalsNew > 0) {
    tiles.push(
      <StatTile key="prop" index={i++} icon="sparkles" value={o.proposalsNew} label={t('ui.client.dashboard.overview.proposals', { n: o.proposalsNew })} href="/espace-client/biens-proposes" flag={t('ui.client.dashboard.overview.new')} />,
    );
  }
  if (o.interests > 0) tiles.push(<StatTile key="int" index={i++} icon="heart" value={o.interests} label={t('ui.client.dashboard.overview.interests', { n: o.interests })} href="/espace-client/interets" />);
  if (o.openRequests > 0) {
    tiles.push(<StatTile key="req" index={i++} icon="chat" value={o.openRequests} label={t('ui.client.dashboard.overview.requests', { n: o.openRequests })} href="/espace-client/interets?demandes=en-cours#demandes" />);
  }
  if (o.favorites) tiles.push(<StatTile key="fav" index={i++} icon="star" value={o.favorites} label={t('ui.client.dashboard.overview.favorites', { n: o.favorites })} href="/espace-client/favoris" />);
  if (o.simulations > 0) tiles.push(<StatTile key="sim" index={i++} icon="calculator" value={o.simulations} label={t('ui.client.dashboard.overview.simulations', { n: o.simulations })} href="/espace-client/simulations" />);
  if (o.alerts) tiles.push(<StatTile key="ale" index={i++} icon="bell" value={o.alerts} label={t('ui.client.dashboard.overview.alerts', { n: o.alerts })} href="/espace-client/alertes" />);
  if (tiles.length < 2) return null;
  // One row on a computer: the six first, in the order of what matters now (the others are in the menu).
  tiles.length = Math.min(tiles.length, 6);
  return (
    <section className={s.overview} aria-label={t('ui.client.dashboard.overview.label')}>
      <StatTiles label={t('ui.client.dashboard.overview.label')}>{tiles}</StatTiles>
    </section>
  );
}

export default async function DashboardPage() {
  const [r, settings] = await Promise.all([spaceGet<ClientDashboard>('/client/dashboard'), getSettings()]);
  if (!r.ok) return <SpaceReadFailure result={r} />;
  const d = r.data;
  const timeZone = d.timeZone;
  const ps: PromiseSettings = {
    firstContactBusinessDays: settings['sla.firstContactBusinessDays'],
    phone: settings['contact.phone'] || null,
    whatsapp: settings['contact.whatsapp'] || null,
  };
  const hello = d.firstName ? t('ui.client.dashboard.hello', { prenom: d.firstName }) : t('ui.client.dashboard.helloNoName');
  const callbackHref = settings['features.callbackRequest'] ? '/espace-client?rappel=1' : '/contact';

  // ECL-013 — the three buttons of a space without project: one primary, the others visibly secondary.
  const welcomeButtons = (
    <div className={s.heroActions}>
      <Link href="/programmes" className={buttonClass('tool', 'L')}>
        <ButtonInner chevron size="L">
          {t('ui.client.dashboard.welcome.browse')}
        </ButtonInner>
      </Link>
      <Link href="/financements/simulateur-eligibilite" className={buttonClass('secondary', 'L')}>
        <ButtonInner size="L">{t('ui.client.dashboard.welcome.simulate')}</ButtonInner>
      </Link>
      <Link href={callbackHref} className={buttonClass('tertiary', 'L')} scroll={false}>
        <ButtonInner size="L">{t('ui.client.dashboard.welcome.callback')}</ButtonInner>
      </Link>
    </div>
  );

  let heroBody: React.ReactNode = <p className={s.heroText}>{t('ui.client.dashboard.intro')}</p>;
  if (d.situation === 'NOTHING') {
    heroBody = (
      <>
        <p className={s.leadRef}>{t('ui.client.dashboard.welcome.title')}</p>
        <p className={s.heroText}>{t('ui.client.dashboard.welcome.text')}</p>
        {welcomeButtons}
      </>
    );
  } else if (d.situation === 'LEAD_ONLY' && d.lead) {
    heroBody = welcomeButtons;
  } else if (d.situation === 'CLOSED_ONLY' && d.closedDossierReference) {
    const name = advisorName(d.advisor);
    heroBody = (
      <>
        <p className={s.leadRef}>{t('ui.client.dashboard.closed.banner', { reference: d.closedDossierReference })}</p>
        <p className={s.heroText}>{name ? t('ui.client.banner.LOST', { conseiller: name }) : t('ui.client.banner.LOST_team')}</p>
        {d.lead ? (
          <p className={s.heroText}>
            {d.promise && !d.promise.breached
              ? t('ui.client.dashboard.closed.messageReceived', { date: longDate(d.lead.createdAt, timeZone), conseiller: name ?? t('ui.client.nextStep.advisorFallback'), quand: quand(d.promise, ps) })
              : t('ui.client.dashboard.closed.messageReceivedPlain', { date: longDate(d.lead.createdAt, timeZone) })}
            {d.promise?.breached ? ` ${promiseSentence(d.promise, ps)}` : ''}
          </p>
        ) : null}
        <div className={s.heroActions}>
          <Link href={writeToAdvisorHref({ from: 'RELAUNCH_PROJECT', dossier: d.closedDossierReference })} className={buttonClass('tool', 'L')}>
            <ButtonInner chevron size="L">
              {t('ui.client.banner.relaunch')}
            </ButtonInner>
          </Link>
          <Link href="/programmes" className={buttonClass('secondary', 'L')}>
            <ButtonInner size="L">{t('ui.client.dashboard.welcome.browse')}</ButtonInner>
          </Link>
          <Link href="/financements/simulateur-eligibilite" className={buttonClass('tertiary', 'L')}>
            <ButtonInner size="L">{t('ui.client.dashboard.welcome.simulate')}</ButtonInner>
          </Link>
          <Link href={callbackHref} className={buttonClass('tertiary', 'L')} scroll={false}>
            <ButtonInner size="L">{t('ui.client.dashboard.welcome.callback')}</ButtonInner>
          </Link>
        </div>
      </>
    );
  } else if (d.situation === 'WON') {
    heroBody = (
      <>
        <p className={s.heroText}>{t('ui.client.dashboard.won.newProject')}</p>
        <div className={s.heroActions}>
          <Link href="/programmes" className={buttonClass('secondary', 'M')}>
            <ButtonInner chevron size="M">
              {t('ui.client.dashboard.won.browse')}
            </ButtonInner>
          </Link>
        </div>
      </>
    );
  }

  const active = d.situation === 'ACTIVE' || d.situation === 'WON';
  const encouragement = <DashboardEncouragement d={d} ps={ps} />;
  return (
    <>
      <section className={s.hero} aria-labelledby="bonjour">
        <HeroArt />
        <div className={s.heroHead}>
          <p className={s.eyebrow}>{t('ui.client.menu.dashboard')}</p>
          <h1 id="bonjour" className={s.hello}>
            {hello}
          </h1>
          {heroBody}
        </div>
        <div className={s.heroSide}>{encouragement}</div>
      </section>
      <EmailBounced />
      <Overview d={d} />
      <div className={s.grid}>
        <div className={s.colMain}>
          {d.situation === 'ACTIVE' ? <TodoBlock todo={d.todo} dossierRef={d.dossier?.reference ?? null} timeZone={timeZone} advisor={d.advisor} /> : null}
          {active && d.dossier ? <ProjectBlock dossier={d.dossier} timeZone={timeZone} settings={ps} otherDossiers={d.otherDossiersCount} /> : null}
        </div>
        <div className={s.colNews}>
          <Suspense fallback={null}>
            <NewsBlock initial={d.news} />
          </Suspense>
          <ShortcutsBlock />
        </div>
        <div className={s.colSide}>
          {d.situation !== 'NOTHING' ? (
            <AdvisorBlock advisor={d.advisor} promise={d.situation === 'ACTIVE' && !d.advisor ? d.promise : null} settings={ps} whatsapp={ps.whatsapp} timeZone={timeZone} />
          ) : null}
          {active && d.dossier?.property ? <PropertyBlock property={d.dossier.property} footnote={settings['legal.monthlyFootnote']} monthlyEnabled={settings['features.monthlyBudgetSearch']} /> : null}
          {d.cafe ? <CafeBlock cafe={d.cafe} /> : null}
        </div>
      </div>
      <Suspense fallback={null}>
        <SpaceTour />
      </Suspense>
    </>
  );
}
