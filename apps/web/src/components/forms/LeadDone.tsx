'use client';
// DEM-023 — confirmation in place of the form: thanks, (reference for a signed-in client), « Et maintenant ? » with the
// NOT-053 expression {quand}, the DEM-026 property outcome, « Continuer ma visite » · « Simuler mon financement ».
import Link from 'next/link';
import type { LeadSubmitResponse } from '@dp/contracts';
import { callbackLabel } from '@dp/i18n';
import { Celebration } from '@dp/ui';
import { buttonClass, ButtonInner } from '@dp/ui';
import { browserTimeZone } from '@/lib/callback';
import { t } from '@/lib/i18n';
import s from './lead.module.css';

export interface LeadDoneProps {
  result: LeadSubmitResponse;
  firstContactBusinessDays: number;
  contactEmail: string;
  contactPhone: string;
  channel?: 'CALL' | 'WHATSAPP' | 'EMAIL';
  onContinue?: () => void;
}

export function LeadDone({ result, firstContactBusinessDays, contactEmail, contactPhone, channel = 'CALL', onContinue }: LeadDoneProps) {
  const quand = callbackLabel({
    preferredCallbackDate: result.preferredCallbackDate,
    preferredSlot: result.preferredSlot,
    firstContactBusinessDays,
    timeZone: browserTimeZone(),
  });
  const step2 =
    result.kind === 'PROJECTION_REQUEST'
      ? t('ui.lead.done.step2Projection', { quand })
      : result.kind === 'CONTACT_MESSAGE'
        ? t('ui.lead.done.step2Message', { quand })
        : channel === 'WHATSAPP'
          ? t('ui.lead.done.step2Whatsapp', { quand })
          : channel === 'EMAIL'
            ? t('ui.lead.done.step2Email', { quand })
            : contactPhone
              ? t('ui.lead.done.step2CallFrom', { quand, telephone: contactPhone })
              : t('ui.lead.done.step2Call', { quand });
  return (
    <div className={s.done} role="status" aria-live="polite">
      <Celebration moment="lead" />
      <h2 className={s.doneTitle}>
        {result.firstName ? t('ui.lead.done.title', { prenom: result.firstName }) : t('ui.lead.done.titleAnonymous')}
      </h2>
      {result.reference ? <p className={s.muted}>{t('ui.lead.done.reference', { reference: result.reference })}</p> : null}
      {result.propertyOutcome === 'RESERVED' ? <p className={s.notice}>{t('ui.lead.done.reserved')}</p> : null}
      {result.propertyOutcome === 'UNAVAILABLE' ? <p className={s.notice}>{t('ui.lead.done.unavailable')}</p> : null}
      <h3 className={s.next}>{t('ui.lead.done.next')}</h3>
      <ol className={s.steps}>
        <li>
          <span>{t('ui.lead.done.step1', { email: result.email })}</span>
          <small className={s.muted}>
            {contactEmail ? t('ui.lead.done.step1HintContact', { contact: contactEmail }) : t('ui.lead.done.step1Hint')}
          </small>
        </li>
        <li>{step2}</li>
        <li>{t('ui.lead.done.step3')}</li>
      </ol>
      {result.accountHint ? <p className={s.notice}>{t('ui.lead.done.account')}</p> : null}
      <div className={s.buttons}>
        {onContinue ? (
          <button type="button" className={buttonClass('secondary', 'M')} onClick={onContinue}>
            <ButtonInner size="M">{t('ui.lead.done.continue')}</ButtonInner>
          </button>
        ) : (
          <Link href="/programmes" className={buttonClass('secondary', 'M')}>
            <ButtonInner size="M">{t('ui.lead.done.continue')}</ButtonInner>
          </Link>
        )}
        <Link href="/financements/simulateur-eligibilite" className={buttonClass('primary', 'M')}>
          <ButtonInner chevron size="M">
            {t('ui.lead.done.simulate')}
          </ButtonInner>
        </Link>
      </div>
    </div>
  );
}
