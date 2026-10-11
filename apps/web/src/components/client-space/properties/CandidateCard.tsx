'use client';
// INT-002, INT-004, INT-010, INT-011, INT-022 — one property envisaged, as the client reads it IN HIS SPACE (a card
// drawn for this page, not the catalogue's — D-098): its state first, where it stands on the way to « Bien retenu »,
// the title and the place, the figures that matter (price, indicative monthly payment with its asterisk — TRV-023),
// what the advisor promised, then ONE main action and visibly secondary ones. The photo and the title lead to the
// property page like the main button. Actions of livraison 2 (ECL-006): « Voir le bien » and « Écrire à mon
// conseiller » (prefilled « Au sujet de {bien} (réf. {référence}) : »); the answers (« Je retiens ce bien »…) come
// with package 3.7. A property no longer online unfolds in place into its summary — never an error page. Opening a
// proposal marks it viewed (INT-011).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CandidateCard as Card } from '@dp/contracts';
import { buttonClass, ButtonInner, Icon } from '@dp/ui';
import { Picture } from '@/components/Picture';
import { apiCall } from '@/lib/auth-client';
import { money, surfaceText } from '@/lib/format';
import { t } from '@/lib/i18n';
import { writeToAdvisorHref } from '../advisor-link';
import { useSpace, signalSpaceChanged } from '../SpaceContext';
import { dossierPath } from '../menu';
import { advisorName, dateTime, longDate, promiseSentence } from '../texts';
import { Figures } from '../kit/Figures';
import { PhotoNote } from '../kit/PhotoNote';
import { StepDots } from '../kit/Progress';
import k from '../kit/kit.module.css';
import sp from '../space.module.css';
import s from './properties.module.css';

function statusLabel(c: Card, timeZone: string): { label: string; tone: string } {
  const st = c.status;
  if (c.unavailable) return { label: t('ui.client.properties.status.UNAVAILABLE'), tone: sp.tagNeutral! };
  if (st === 'INTERESTED' && c.fullyReserved) return { label: t('ui.client.properties.status.RESERVED'), tone: sp.tagWarning! };
  if (st === 'INTERESTED' && c.selectionRequestedAt) return { label: t('ui.client.properties.status.INTERESTED_requested'), tone: sp.tagInfo! };
  if (st === 'VISIT_PLANNED' && c.visitAt) return { label: t('ui.client.properties.status.VISIT_PLANNED', { date: dateTime(c.visitAt, timeZone).date }), tone: sp.tagInfo! };
  const tone = st === 'SELECTED' || st === 'INTERESTED' ? sp.tagSuccess! : st === 'DECLINED' ? sp.tagNeutral! : st === 'VISIT_REQUESTED' ? sp.tagWarning! : sp.tagInfo!;
  return { label: t(`ui.client.properties.status.${st}` as 'ui.client.properties.status.INTERESTED'), tone };
}

/** Where the property stands on the way to « Bien retenu » (1 interest · 2 visit · 3 retained); 0: not on that way. */
function journeyOf(c: Card): 0 | 1 | 2 | 3 {
  if (c.unavailable) return 0;
  if (c.status === 'SELECTED') return 3;
  if (['VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED'].includes(c.status)) return 2;
  if (c.status === 'INTERESTED') return 1;
  return 0;
}

export function CandidateCard({ card, context, index = 0 }: { card: Card; context: 'interests' | 'proposals'; index?: number }) {
  const { summary, settings } = useSpace();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const p = card.property;
  const tz = summary.timeZone;
  const status = statusLabel(card, tz);
  const conseiller = advisorName(card.advisor) ?? t('ui.client.nextStep.advisorFallback');
  const isNew = context === 'proposals' && card.status === 'PROPOSED' && !card.viewedAt;
  const price = money(p.price);
  const monthly = money(p.monthly);
  const surface = surfaceText(p.surfaceMin, p.surfaceMax);
  const journey = context === 'interests' ? journeyOf(card) : 0;
  const followed = ['INTERESTED', 'VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED', 'SELECTED'].includes(card.status);
  const place = [p.city, p.region].filter(Boolean).join(', ');

  // INT-011 — opening the public page from the proposal marks it viewed (then the page opens).
  async function view(e: React.MouseEvent) {
    if (card.origin !== 'ADVISOR_PROPOSAL' || card.viewedAt) return;
    e.preventDefault();
    await apiCall(`/client/candidates/${card.id}/view`, { method: 'POST', retryOnAuth: true });
    signalSpaceChanged();
    router.push(`/biens/${p.slug}`);
  }
  async function unfold() {
    setOpen((v) => !v);
    if (!open && card.origin === 'ADVISOR_PROPOSAL' && !card.viewedAt) {
      await apiCall(`/client/candidates/${card.id}/view`, { method: 'POST', retryOnAuth: true });
      signalSpaceChanged();
    }
  }

  const notes: string[] = [];
  if (card.status === 'INTERESTED' && card.promise && !card.selectionRequestedAt) notes.push(promiseSentence(card.promise, settings));
  if (card.status === 'INTERESTED' && card.selectionDeclineNote) notes.push(t('ui.client.properties.detail.declined', { conseiller, raison: card.selectionDeclineNote }));
  if (card.status === 'VISIT_REQUESTED') notes.push(t('ui.client.properties.detail.VISIT_REQUESTED'));
  if (!card.unavailable && card.fullyReserved) {
    notes.push(
      card.status === 'SELECTED'
        ? t('ui.client.properties.reservedSelected', { conseiller })
        : card.status === 'INTERESTED'
          ? t('ui.client.properties.reservedInterested', { conseiller })
          : t('ui.client.properties.reserved'),
    );
  }
  if (p.offline) notes.push(t('ui.client.properties.offline'));

  const photo = (
    <>
      {p.photo ? <Picture image={p.photo} sizes="(max-width: 639px) 92vw, 360px" className={s.img} alt="" /> : <Icon name="building" size={32} />}
      <PhotoNote image={p.photo} />
      {isNew ? <span className={`${sp.tag} ${sp.tagNew} ${s.newTag}`}>{t('ui.client.proposals.new')}</span> : null}
      {card.unavailable ? <span className={s.veil}>{t('ui.client.properties.unavailable')}</span> : null}
    </>
  );
  // SELECTED: the dossier is where things happen now — it becomes the main action.
  const dossierFirst = card.status === 'SELECTED';
  const writeHref = writeToAdvisorHref({ from: 'PROPERTY_ABOUT', property: { reference: p.reference, title: p.title }, dossier: card.dossierReference });

  return (
    <article className={[s.card, k.enter, card.unavailable && s.veiled, isNew && s.cardNew].filter(Boolean).join(' ')} style={{ ['--i' as string]: index }} data-candidate={card.status}>
      {p.online ? (
        <Link href={`/biens/${p.slug}`} className={s.photo} onClick={(e) => void view(e)} tabIndex={-1} aria-hidden="true">
          {photo}
        </Link>
      ) : (
        <div className={s.photo}>{photo}</div>
      )}
      <div className={s.body}>
        <div className={s.head}>
          <span className={`${sp.tag} ${status.tone}`}>{status.label}</span>
          <span className={s.since}>{t('ui.client.properties.since', { date: longDate(card.since, tz) })}</span>
        </div>
        <h3 className={s.title}>
          {p.online ? (
            <Link href={`/biens/${p.slug}`} onClick={(e) => void view(e)}>
              {p.title}
            </Link>
          ) : (
            p.title
          )}
        </h3>
        {place ? (
          <p className={s.place}>
            <Icon name="map-pin" size={16} />
            {place}
          </p>
        ) : null}
        <Figures
          items={[
            { label: p.priceIsFrom ? t('ui.client.properties.priceFromLabel') : t('ui.client.properties.priceLabel'), value: price, accent: true },
            { label: t('ui.client.properties.monthly'), value: monthly ? `${monthly} ${t('ui.common.perMonth')}` : null },
            { label: t('ui.client.properties.surfaceLabel'), value: surface },
          ]}
        />
        {journey ? (
          <div className={s.journey}>
            <StepDots total={3} current={journey} done={journey === 3} />
            <span className={s.journeyText}>
              <span className="visually-hidden">{t('ui.client.properties.journey.label')} : </span>
              {[1, 2, 3].map((n) => (
                <span key={n} className={n === journey ? s.journeyOn : n < journey ? s.journeyDone : undefined}>
                  {t(`ui.client.properties.journey.${n}` as 'ui.client.properties.journey.1')}
                </span>
              ))}
            </span>
          </div>
        ) : null}
        {notes.map((n) => (
          <p key={n} className={s.note}>
            <Icon name="status-info" size={20} />
            <span>{n}</span>
          </p>
        ))}
        {open && !p.online ? (
          <div className={s.summary}>
            <p className={s.summaryState}>{p.gone ? t('ui.client.properties.gone') : t('ui.client.properties.offline')}</p>
            {surface ? <p>{`${t('ui.client.properties.surface')} : ${surface}`}</p> : null}
            {price ? <p>{price}</p> : null}
          </div>
        ) : null}
        <div className={s.actions}>
          {dossierFirst ? (
            <Link href={dossierPath(card.dossierReference)} className={buttonClass('tool', 'M')}>
              <ButtonInner size="M" chevron>
                {t('ui.client.properties.openDossier')}
              </ButtonInner>
            </Link>
          ) : null}
          {p.online ? (
            <Link href={`/biens/${p.slug}`} className={buttonClass(dossierFirst ? 'secondary' : 'tool', 'M')} onClick={(e) => void view(e)} aria-label={t('ui.client.properties.viewTitled', { titre: p.title })}>
              <ButtonInner size="M" chevron={!dossierFirst}>
                {t('ui.client.properties.view')}
              </ButtonInner>
            </Link>
          ) : (
            <button type="button" className={buttonClass('secondary', 'M')} aria-expanded={open} onClick={() => void unfold()}>
              <ButtonInner size="M">{open ? t('ui.client.properties.summaryClose') : t('ui.client.properties.summaryOpen')}</ButtonInner>
            </button>
          )}
          {card.unavailable && !p.online ? (
            // FIC-090 — the page of a property no longer offered shows three similar ones (CAL-081).
            <Link href={`/biens/${p.slug}`} className={k.quiet}>
              {t('ui.client.properties.similar')}
            </Link>
          ) : null}
          {context === 'proposals' && followed ? (
            <Link href="/espace-client/interets" className={k.quiet}>
              <Icon name="heart" size={20} />
              {t('ui.client.properties.seeInInterests')}
            </Link>
          ) : null}
          <Link href={writeHref} className={k.quiet} aria-label={t('ui.client.properties.writeAbout', { titre: p.title })}>
            <Icon name="chat" size={20} />
            {t('ui.client.properties.write')}
          </Link>
        </div>
      </div>
    </article>
  );
}
