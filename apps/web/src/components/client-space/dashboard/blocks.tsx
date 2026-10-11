// EC-10 blocks rendered on the server (ECL-010 … ECL-014, ECL-022, ECL-023, ECL-035). Every sentence comes from
// `ui.client.*` and the values of the API; a block without content is not rendered (D-089). Each block has ONE clear
// action; a row that leads somewhere is a whole link with its arrow (D-098).
import Link from 'next/link';
import type { AdvisorCard, CallbackPromise, DashboardCafe, DossierView, PropertySummary, TodoCard } from '@dp/contracts';
import { buttonClass, ButtonInner, HelpTip, Icon, type IconName } from '@dp/ui';
import { callbackLabel, type MessageKey } from '@dp/i18n';
import { Picture } from '@/components/Picture';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Steps } from '../Steps';
import { Avatar } from '../Avatar';
export { Avatar } from '../Avatar';
import { writeToAdvisorHref } from '../advisor-link';
import { documentsPath, dossierPath } from '../menu';
import { Figures } from '../kit/Figures';
import { PhotoNote } from '../kit/PhotoNote';
import { Progress } from '../kit/Progress';
import { advisorName, dateTime, longDate, nextStepSentence, promiseSentence, type PromiseSettings } from '../texts';
import k from '../kit/kit.module.css';
import sp from '../space.module.css';
import s from './dashboard.module.css';

/** ECL-006 — pages delivered with livraison 2; a card whose page comes later leads to the dossier instead. */
function deliveredHref(card: TodoCard, dossierRef: string | null): string | null {
  if (card.code === 'SURVEY') return null; // EC-54: livraison 5
  if (/\/(financement|bien)$/.test(card.href) || card.href.startsWith('/espace-client/rendez-vous')) return dossierRef ? dossierPath(dossierRef) : '/espace-client';
  return card.href;
}

const TODO_ICON: Record<TodoCard['code'], IconName> = {
  OFFER_WAITING: 'bank',
  CONSENT_NEEDED: 'shield',
  DOCUMENTS_TO_REDO: 'warning',
  BANK_INFO: 'bank',
  DOCUMENTS_TO_PROVIDE: 'upload',
  DOCUMENTS_TO_RENEW: 'clock',
  APPOINTMENT_SOON: 'calendar',
  PROPOSALS_NEW: 'sparkles',
  OPTION_ENDING: 'clock',
  SURVEY: 'star',
  PROFILE_INCOMPLETE: 'user',
};

function todoText(c: TodoCard, timeZone: string, advisor: AdvisorCard | null): string[] {
  const p = c.params;
  const date = p.date ? (p.date.length > 10 ? dateTime(p.date, timeZone).date : longDate(p.date, timeZone)) : undefined;
  switch (c.code) {
    case 'OFFER_WAITING':
      if (p.transmitted) return [t('ui.client.dashboard.todo.OFFER_WAITING_transmitted', { bank: p.bank ?? '', advisor: advisorName(advisor) ?? t('ui.client.nextStep.advisorFallback') })];
      return [t('ui.client.dashboard.todo.OFFER_WAITING', { bank: p.bank ?? '' }), ...(date ? [t('ui.client.dashboard.todo.OFFER_WAITING_until', { date })] : [])];
    case 'DOCUMENTS_TO_PROVIDE':
      return [date ? t('ui.client.dashboard.todo.DOCUMENTS_TO_PROVIDE_due', { n: p.n ?? 0, date }) : t('ui.client.dashboard.todo.DOCUMENTS_TO_PROVIDE', { n: p.n ?? 0 })];
    case 'APPOINTMENT_SOON': {
      const when = p.date ? dateTime(p.date, timeZone) : { date: '', time: '' };
      return [t('ui.client.dashboard.todo.APPOINTMENT_SOON', { type: t(`ui.enum.AppointmentType.${p.type}` as MessageKey), date: when.date, heure: when.time })];
    }
    default:
      return [t(`ui.client.dashboard.todo.${c.code}` as MessageKey, { n: p.n ?? 0, bank: p.bank ?? '', lot: p.lot ?? '', date: date ?? '' })];
  }
}

/** ECL-011 — « À faire »: five cards at most, by priority; the first one is the one to do first. */
export function TodoBlock({ todo, dossierRef, timeZone, advisor }: { todo: TodoCard[]; dossierRef: string | null; timeZone: string; advisor: AdvisorCard | null }) {
  const cards = todo.map((c) => ({ c, href: deliveredHref(c, dossierRef) })).filter((x) => x.href !== null);
  return (
    <section className={`${sp.block} ${s.todo}`} aria-labelledby="bloc-a-faire" data-tour="todo">
      <div className={sp.blockHead}>
        <h2 id="bloc-a-faire" className={sp.blockTitle}>
          {t('ui.client.dashboard.todo.title')}
        </h2>
        {cards.length ? <span className={k.sectionCount}>{cards.length}</span> : null}
      </div>
      {cards.length === 0 ? (
        <p className={s.calm}>
          <span className={s.calmIcon} aria-hidden="true">
            <Icon name="status-success" size={24} />
          </span>
          {t('ui.client.dashboard.todo.none')}
        </p>
      ) : (
        <ol role="list" className={s.todoList}>
          {cards.map(({ c, href }, i) => (
            <li key={`${c.code}-${i}`} className={k.enter} style={{ ['--i' as string]: i }}>
              <Link href={href!} className={[s.todoCard, k.linkCard, i === 0 && s.todoFirst].filter(Boolean).join(' ')}>
                <span className={s.todoIcon} aria-hidden="true">
                  <Icon name={TODO_ICON[c.code]} size={24} />
                </span>
                <span className={s.todoText}>
                  {todoText(c, timeZone, advisor).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
                <span className={k.go} aria-hidden="true">
                  <Icon name="chevron-right" size={20} />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** ECL-022 — the banner of a paused, closed or completed dossier, with its fallback action (MSG-021). */
export function DossierBannerView({ dossier, timeZone }: { dossier: DossierView; timeZone: string }) {
  const b = dossier.banner;
  if (!b) return null;
  if (b.kind === 'ON_HOLD') {
    return (
      <div className={`${s.banner} ${s.bannerHold}`}>
        <Icon name="pause" size={24} />
        <div className={s.bannerBody}>
          <p className={s.bannerTitle}>{t('ui.client.banner.ON_HOLD')}</p>
          {b.holdUntil ? <p>{t('ui.client.banner.ON_HOLD_until', { date: longDate(b.holdUntil, timeZone) })}</p> : null}
          {b.holdClientNote ? <p>{t('ui.client.banner.ON_HOLD_note', { note: b.holdClientNote })}</p> : null}
        </div>
        <Link href={writeToAdvisorHref({ from: 'RESUME_PROJECT', dossier: dossier.reference })} className={buttonClass('tool', 'M')}>
          <ButtonInner size="M">{t('ui.client.banner.resume')}</ButtonInner>
        </Link>
      </div>
    );
  }
  if (b.kind === 'LOST') {
    const name = advisorName(dossier.advisor);
    return (
      <div className={`${s.banner} ${s.bannerLost}`}>
        <Icon name="folder" size={24} />
        <div className={s.bannerBody}>
          <p>{name ? t('ui.client.banner.LOST', { conseiller: name }) : t('ui.client.banner.LOST_team')}</p>
        </div>
        <Link href={writeToAdvisorHref({ from: 'RELAUNCH_PROJECT', dossier: dossier.reference })} className={buttonClass('tool', 'M')}>
          <ButtonInner size="M">{t('ui.client.banner.relaunch')}</ButtonInner>
        </Link>
      </div>
    );
  }
  return (
    <div className={`${s.banner} ${s.bannerWon}`}>
      <Icon name="medal" size={24} />
      <div className={s.bannerBody}>
        <p className={s.bannerTitle}>{t('ui.client.banner.WON')}</p>
      </div>
    </div>
  );
}

/** ECL-021 — « Prochaine étape »: what comes, in one sentence, with the page it leads to when there is one. */
export function NextStep({ dossier, timeZone, settings }: { dossier: DossierView; timeZone: string; settings: PromiseSettings }) {
  if (!dossier.nextStep) return null;
  return (
    <div className={s.next}>
      <span className={s.nextIcon} aria-hidden="true">
        <Icon name="arrow-right" size={20} />
      </span>
      <div className={s.nextBody}>
        <span className={s.nextLabel}>{t('ui.client.dashboard.project.nextStep')}</span>
        <p className={s.nextText}>{nextStepSentence(dossier.nextStep, dossier.advisor, timeZone, settings)}</p>
        {dossier.nextStep.code === 'DOCUMENTS_LIST_PENDING' ? (
          <Link href="/espace-client/profil" className={sp.blockLink}>
            {t('ui.client.dashboard.profile.completeLink')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** ECL-023 — the completeness bar with the figures behind it and « Voir mes pièces ». */
export function Completeness({ dossier, withLink = true }: { dossier: DossierView; withLink?: boolean }) {
  if (dossier.completenessPct === null) return null;
  const docs = dossier.documents;
  const sentence = t('ui.client.dashboard.project.completeness', { n: dossier.completenessPct });
  return (
    <div className={s.completeness}>
      <div className={s.completenessHead}>
        <p className={s.completenessTitle}>
          {sentence}
          <HelpTip label={t('ui.client.dossier.helpCompleteness')}>{t('ui.help.completeness')}</HelpTip>
        </p>
        {withLink && dossier.hasDocumentList ? (
          <Link href={documentsPath(dossier.reference)} className={sp.blockLink}>
            {t('ui.client.dashboard.project.seeDocuments')}
            <Icon name="chevron-right" size={16} />
          </Link>
        ) : null}
      </div>
      <Progress
        value={dossier.completenessPct}
        label={sentence}
        tone={dossier.completenessPct >= 100 ? 'green' : 'gold'}
        legend={docs ? t('ui.client.dashboard.encourage.docsLegend', { x: docs.satisfied, y: docs.required }) : undefined}
      />
    </div>
  );
}

/** ECL-010 block 3 — the six steps and the next step, for the dossier shown (ECL-014). */
export function ProjectBlock({
  dossier,
  timeZone,
  settings,
  otherDossiers,
}: {
  dossier: DossierView;
  timeZone: string;
  settings: PromiseSettings;
  otherDossiers: number;
}) {
  return (
    <section className={`${sp.block} ${s.project}`} aria-labelledby="bloc-projet" data-tour="steps">
      <div className={sp.blockHead}>
        <h2 id="bloc-projet" className={sp.blockTitle}>
          {t('ui.client.dashboard.project.title')}
          <span className={s.ref}>{t('ui.client.dossier.title', { reference: dossier.reference })}</span>
        </h2>
        <Link href={dossierPath(dossier.reference)} className={buttonClass('secondary', 'S')}>
          <ButtonInner size="S">{t('ui.client.dashboard.project.open')}</ButtonInner>
        </Link>
      </div>
      <DossierBannerView dossier={dossier} timeZone={timeZone} />
      <Steps steps={dossier.steps} financing={dossier.financingRequested} timeZone={timeZone} compact />
      <NextStep dossier={dossier} timeZone={timeZone} settings={settings} />
      <Completeness dossier={dossier} />
      {otherDossiers > 0 ? (
        <p className={s.others}>
          <Link href="/espace-client/dossiers" className={sp.blockLink}>
            {t('ui.client.dashboard.project.others')}
            <Icon name="chevron-right" size={16} />
          </Link>
        </p>
      ) : null}
    </section>
  );
}

/**
 * ECL-012 — photo or initials, « Prénom N. », function, the reply time (the promise of MSG-021, NOT-053), « Écrire »
 * and WhatsApp; without advisor, the team. Never a personal number.
 */
export function AdvisorBlock({
  advisor,
  promise,
  settings,
  whatsapp,
  timeZone,
  dossier,
}: {
  advisor: AdvisorCard | null;
  promise: CallbackPromise | null;
  settings: PromiseSettings;
  whatsapp: string | null;
  timeZone: string;
  dossier?: string;
}) {
  const name = advisorName(advisor);
  const quand = callbackLabel({ firstContactBusinessDays: settings.firstContactBusinessDays, timeZone });
  return (
    <section className={`${sp.block} ${s.advisor}`} aria-labelledby="bloc-conseiller" data-tour="advisor">
      <h2 id="bloc-conseiller" className={sp.blockTitle}>
        {t('ui.client.dashboard.advisor.title')}
      </h2>
      <div className={s.advisorRow}>
        <Avatar advisor={advisor} />
        <div>
          <p className={s.advisorName}>{name ?? t('ui.client.dashboard.advisor.team')}</p>
          {advisor ? <p className={s.advisorJob}>{advisor.jobTitle || t('ui.client.dashboard.advisor.defaultJob')}</p> : null}
        </div>
      </div>
      <p className={s.promise}>
        <Icon name="clock" size={20} />
        <span>{promise ? promiseSentence(promise, settings) : name ? t('ui.client.dashboard.advisor.replies', { conseiller: name, quand }) : t('ui.client.dashboard.advisor.repliesTeam', { quand })}</span>
      </p>
      <div className={s.advisorActions}>
        <Link href={writeToAdvisorHref({ from: 'ADVISOR', dossier })} className={buttonClass('tool', 'M')}>
          <ButtonInner size="M" icon="chat">
            {t('ui.client.dashboard.advisor.write')}
          </ButtonInner>
        </Link>
        {whatsapp ? (
          <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} className={buttonClass('secondary', 'M')} target="_blank" rel="noopener noreferrer">
            <ButtonInner size="M" icon="phone">
              {t('ui.client.dashboard.advisor.whatsapp')}
            </ButtonInner>
          </a>
        ) : null}
      </div>
    </section>
  );
}

/**
 * ECL-010 block 5 — the property retained: its photo, where it is, and the three figures that matter (CAT-040) — price,
 * down payment of the reference financing, indicative monthly payment with its asterisk and its note (TRV-023).
 * The whole card opens the property page when it is online.
 */
export function PropertyBlock({ property, footnote, monthlyEnabled, title }: { property: PropertySummary; footnote: string; monthlyEnabled: boolean; title?: string }) {
  const place = [property.city, property.region].filter(Boolean).join(', ');
  const monthly = monthlyEnabled ? money(property.monthly) : null;
  const body = (
    <>
      <div className={s.propertyPhoto}>
        {property.photo ? <Picture image={property.photo} sizes="(max-width: 1099px) 92vw, 420px" className={s.cover} alt="" /> : <Icon name="building" size={32} />}
        <PhotoNote image={property.photo} />
        {property.online ? (
          <span className={`${k.go} ${s.propertyGo}`} aria-hidden="true">
            <Icon name="chevron-right" size={20} />
          </span>
        ) : null}
      </div>
      <div className={s.propertyBody}>
        <p className={s.propertyTitle}>{property.title}</p>
        {place ? (
          <p className={s.propertyPlace}>
            <Icon name="map-pin" size={16} />
            {place}
          </p>
        ) : null}
      </div>
    </>
  );
  return (
    <section className={`${sp.block} ${s.property}`} aria-labelledby="bloc-bien">
      <h2 id="bloc-bien" className={sp.blockTitle}>
        {title ?? t('ui.client.dashboard.property.title')}
      </h2>
      {property.online ? (
        <Link href={`/biens/${property.slug}`} className={`${s.propertyLink} ${k.linkCard}`} aria-label={`${t('ui.client.dashboard.property.open')} : ${property.title}`}>
          {body}
        </Link>
      ) : (
        <div className={s.propertyLink}>{body}</div>
      )}
      {property.offline ? <p className={sp.help}>{t('ui.client.properties.offline')}</p> : null}
      <Figures
        items={[
          { label: property.priceIsFrom ? t('ui.client.dashboard.property.priceFrom') : t('ui.client.dashboard.property.price'), value: money(property.price), accent: true },
          {
            label: t('ui.client.dashboard.property.downPayment', { pct: property.downPaymentPct ? String(Math.round(Number(property.downPaymentPct))) : '' }),
            value: property.downPaymentPct ? money(property.downPayment) : null,
            help: <HelpTip label={t('ui.client.dashboard.property.helpDownPayment')}>{t('ui.help.downPayment')}</HelpTip>,
          },
          {
            label: t('ui.client.dashboard.property.monthly'),
            value: monthly ? `${monthly} ${t('ui.common.perMonth')}` : null,
            help: <HelpTip label={t('ui.client.dashboard.property.helpMonthly')} align="end">{t('ui.help.monthlyIndicative')}</HelpTip>,
          },
        ]}
        footnote={monthly ? footnote : undefined}
      />
    </section>
  );
}

/** ECL-010 block 6 — his next Café, or the next one with « Je m'inscris ». */
export function CafeBlock({ cafe }: { cafe: DashboardCafe }) {
  const when = dateTime(cafe.startsAt, cafe.timezone);
  const date = `${when.date}, ${when.time}`;
  const lieu = [...new Set([cafe.venue, cafe.city].filter(Boolean))].join(', ');
  return (
    <section className={`${sp.block} ${s.cafe}`} aria-labelledby="bloc-cafe">
      <h2 id="bloc-cafe" className={sp.blockTitle}>
        <Icon name="cafe-cup" size={24} />
        {t('ui.client.dashboard.cafe.title')}
      </h2>
      <p className={s.cafeTitle}>{cafe.registered ? t('ui.client.dashboard.cafe.registered', { titre: cafe.title }) : cafe.title}</p>
      <p className={s.cafeWhen}>
        <Icon name="calendar" size={16} />
        {t('ui.client.dashboard.cafe.when', { date, lieu })}
      </p>
      <Link href={`/le-cafe/${cafe.slug}`} className={buttonClass(cafe.registered ? 'secondary' : 'tool', 'M')}>
        <ButtonInner size="M" chevron={!cafe.registered}>
          {cafe.registered ? t('ui.client.dashboard.cafe.see') : t('ui.client.dashboard.cafe.register')}
        </ButtonInner>
      </Link>
    </section>
  );
}

/** ECL-010 block 8 — two doors back to the site, each a whole link. */
export function ShortcutsBlock() {
  const links: { href: string; icon: IconName; label: string }[] = [
    { href: '/programmes', icon: 'building', label: t('ui.client.dashboard.shortcuts.browse') },
    { href: '/financements/simulateur-eligibilite', icon: 'calculator', label: t('ui.client.dashboard.shortcuts.simulate') },
  ];
  return (
    <section className={`${sp.block} ${s.shortcuts}`} aria-labelledby="bloc-raccourcis">
      <h2 id="bloc-raccourcis" className={sp.blockTitle}>
        {t('ui.client.dashboard.shortcuts.title')}
      </h2>
      <div className={s.shortcutRow}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`${s.shortcut} ${k.linkCard}`}>
            <span className={s.shortcutIcon} aria-hidden="true">
              <Icon name={l.icon} size={24} />
            </span>
            <span className={s.shortcutLabel}>{l.label}</span>
            <span className={k.go} aria-hidden="true">
              <Icon name="chevron-right" size={20} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
