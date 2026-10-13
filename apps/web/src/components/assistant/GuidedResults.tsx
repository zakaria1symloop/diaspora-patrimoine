'use client';
// ASS-020, ASS-021 — the conclusion of the guided assistant: « Voici {n} biens… », six cards at most by relevance, then
// « Voir tous les résultats » · « Recevoir ces biens et être accompagné » (DEM-017) · « Créer une alerte » (if
// features.searchAlerts). Nothing exact: the nearest ones (CAT-061 order); nothing at all: the form, open.
import Link from 'next/link';
import { useEffect, useId, useState, type RefObject } from 'react';
import { criteriaToSearch, guidedAnswersToSearch, type GuidedAnswers, type GuidedResultsResponse, type LeadSubmitResponse, type PublicSettings } from '@dp/contracts';
import { Button, ButtonInner, Icon, buttonClass } from '@dp/ui';
import { formatPhone } from '@/lib/contact';
import { useDraft } from '@/lib/public-form';
import { recordOrigin } from '@/lib/tracking';
import { t } from '@/lib/i18n';
import { CheckboxField, Honeypot, TextField } from '@/components/forms/fields';
import { ConsentBlock, PhoneField, SignedInConsent, SignedInContact, askedOf, consentWire, contactOf, signedInConsentWire, useLeadSubmit, useSignedInClient } from '@/components/forms/lead-parts';
import { LeadDone } from '@/components/forms/LeadDone';
import { PropertyCard } from '@/components/vitrine/PropertyCard';
import l from '@/components/forms/lead.module.css';
import s from './assistant.module.css';

export function GuidedResults({
  settings,
  answers,
  precision,
  currentRef,
  onRestart,
}: {
  settings: PublicSettings;
  answers: GuidedAnswers;
  precision: string;
  currentRef: RefObject<HTMLDivElement | null>;
  onRestart: () => void;
}) {
  const [res, setRes] = useState<GuidedResultsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const search = guidedAnswersToSearch(answers);

  useEffect(() => {
    let live = true;
    setFailed(false);
    fetch(`/api/v1/public/assistant/results${search}`, { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<GuidedResultsResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((v) => {
        if (!live) return;
        setRes(v);
        if (v.outcome === 'NONE') setFormOpen(true); // ASS-021: the form, open
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [search, attempt]);

  if (failed) {
    return (
      <div ref={currentRef} tabIndex={-1} className={s.current}>
        <div className={`${s.bubble} ${s.bot}`} role="alert">
          <span>{t('ui.assistant.results.error')}</span>{' '}
          <button type="button" className={s.inlineAction} onClick={() => setAttempt((n) => n + 1)}>
            {t('ui.assistant.results.retry')}
          </button>
        </div>
      </div>
    );
  }
  if (!res) {
    return (
      <div ref={currentRef} tabIndex={-1} className={s.current} aria-busy="true">
        <div className={`${s.bubble} ${s.bot}`}>
          <span className={s.typing}>{t('ui.assistant.results.searching')}</span>
        </div>
      </div>
    );
  }

  const monthlyOn = settings['features.monthlyBudgetSearch'];
  const catalogueHref = `/programmes${criteriaToSearch(res.appliedCriteria)}`;
  const alertSearch = criteriaToSearch(res.criteria);
  const alertHref = `/programmes${alertSearch}${alertSearch ? '&' : '?'}alerte=1`;
  const showsMonthly = monthlyOn && res.cards.some((c) => c.monthlyFromRef);

  return (
    <div ref={currentRef} tabIndex={-1} className={`${s.current} ${s.results}`}>
      <div className={`${s.bubble} ${s.bot}`} role="status">
        <span className="visually-hidden">{t('ui.assistant.chat.assistant')} : </span>
        {res.outcome === 'EXACT' ? (
          <>
            {t('ui.assistant.results.exact', { n: res.total })}
            {res.total > res.cards.length ? <> {t('ui.assistant.results.showing', { n: res.cards.length })}</> : null}
          </>
        ) : res.outcome === 'RELAXED' ? (
          t('ui.assistant.results.relaxed')
        ) : (
          t('ui.assistant.results.none')
        )}
      </div>

      {res.cards.length ? (
        <>
          <ul className={s.cards} aria-label={t('ui.assistant.results.listLabel')}>
            {res.cards.map((card) => (
              <li key={card.id}>
                <PropertyCard card={card} downPaymentPct={res.referenceDownPaymentPct} monthlyEnabled={monthlyOn} illustrationNote={settings['legal.illustrationNote']} />
              </li>
            ))}
          </ul>
          {showsMonthly ? <p className={s.footnote}>{settings['legal.monthlyFootnote']}</p> : null}
        </>
      ) : null}

      {res.outcome !== 'NONE' || settings['features.searchAlerts'] ? (
        <div className={s.resultActions}>
          {res.outcome !== 'NONE' ? (
            <Link href={catalogueHref} className={buttonClass('secondary', 'M')}>
              <ButtonInner size="M">{t('ui.assistant.results.seeAll')}</ButtonInner>
            </Link>
          ) : null}
          {res.outcome !== 'NONE' && !formOpen ? (
            <Button variant="primary" size="M" chevron onClick={() => setFormOpen(true)}>
              {t('ui.assistant.results.receive')}
            </Button>
          ) : null}
          {settings['features.searchAlerts'] ? (
            <Link href={alertHref} className={s.alertLink}>
              <Icon name="bell" size={16} />
              {t('ui.assistant.results.alert')}
            </Link>
          ) : null}
        </div>
      ) : null}

      {formOpen ? <GuidedLeadForm settings={settings} answers={answers} precision={precision} result={res} /> : null}

      <button type="button" className={s.back} onClick={onRestart}>
        <Icon name="arrow-left" size={16} />
        {t('ui.assistant.chat.restart')}
      </button>
    </div>
  );
}

/**
 * DEM-017 — Prénom · E-mail · Téléphone (facultatif) · Consentement; the request carries the answers (ASS-030). Also the
 * « Être rappelé » of the conversational mode (ASS-052): `assistantConversationId` lets the server take the criteria,
 * the properties shown and the summary from the conversation; `texts` replace the title, intro and button.
 */
export function GuidedLeadForm({
  settings,
  answers,
  precision,
  result,
  assistantConversationId,
  texts,
}: {
  settings: PublicSettings;
  answers: GuidedAnswers;
  precision: string;
  result: GuidedResultsResponse;
  assistantConversationId?: string;
  texts?: { title: string; intro: string; submit: string };
}) {
  const id = useId();
  const [v, set, clear] = useDraft('assistant-lead', { firstName: '', email: '', phone: '', whatsapp: false, consent: false, marketing: false, createAccount: false });
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ data: LeadSubmitResponse; phone: boolean } | null>(null);
  const send = useLeadSubmit('GUIDED_SEARCH', settings);
  const none = result.outcome === 'NONE';
  const me = useSignedInClient(); // DEM-022
  const asked = askedOf(me);

  useEffect(() => recordOrigin(), []);

  if (done) {
    return (
      <div className={s.formCard}>
        <LeadDone
          result={done.data}
          firstContactBusinessDays={settings['sla.firstContactBusinessDays']}
          contactEmail={settings['contact.email']}
          contactPhone={settings['contact.phone'] ? formatPhone(settings['contact.phone']) : ''}
          channel={done.phone ? 'CALL' : 'EMAIL'}
        />
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    const c = contactOf(me, v);
    if (!c.firstName.trim()) local.firstName = t('ui.validation.REQUIRED');
    if (!c.email.trim()) local.email = t('ui.validation.REQUIRED');
    if (!me && !v.consent) local.consentContact = t('ui.validation.MUST_ACCEPT');
    setErrors(local);
    const first = ['firstName', 'email', 'consentContact'].find((k) => local[k]);
    if (first) return document.getElementById(`${id}-${first === 'consentContact' ? 'consent' : first}`)?.focus();
    setPending(true);
    setBanner(null);
    const res = await send(
      {
        firstName: c.firstName,
        email: c.email,
        phone: c.phone || null,
        whatsappOptIn: c.phone ? v.whatsapp : false,
        answers,
        criteria: result.criteria,
        propertyReferences: result.references,
        freeText: precision || null,
        ...(assistantConversationId ? { assistantConversationId } : {}),
        ...(me ? signedInConsentWire() : consentWire(v.consent, v.marketing)),
        createAccount: me ? false : v.createAccount,
      },
      {},
      honeypot,
    );
    setPending(false);
    if (res.ok) {
      clear();
      setDone({ data: res.data, phone: Boolean(c.phone) });
    } else {
      setErrors(res.errors.fields);
      setBanner(res.errors.banner);
    }
  }

  return (
    <form className={`${s.formCard} ${l.form}`} onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.formTitle}>
        {texts ? texts.title : none ? t('ui.assistant.form.titleNone') : t('ui.assistant.form.title')}
      </h2>
      <p className={s.formIntro}>{texts ? texts.intro : none ? t('ui.assistant.form.introNone') : t('ui.assistant.form.intro')}</p>
      {banner ? (
        <p className={l.banner} role="alert">
          <Icon name="status-error" size={20} />
          {banner}
        </p>
      ) : null}
      {me ? <SignedInContact me={me} /> : null}
      {me ? null : (
      <div className={l.row}>
        <TextField id={`${id}-firstName`} label={t('ui.lead.fields.firstName')} autoComplete="given-name" value={v.firstName} onChange={(e) => set({ firstName: e.target.value })} error={errors.firstName} />
        <TextField
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          label={t('ui.lead.fields.email')}
          placeholder={t('ui.common.placeholder.email')}
          value={v.email}
          onChange={(e) => set({ email: e.target.value })}
          error={errors.email}
        />
      </div>
      )}
      {me && asked.name ? (
        <TextField id={`${id}-firstName`} label={t('ui.lead.fields.firstName')} autoComplete="given-name" value={v.firstName} onChange={(e) => set({ firstName: e.target.value })} error={errors.firstName} />
      ) : null}
      {asked.phone ? <PhoneField id={`${id}-phone`} value={v.phone} onChange={(phone) => set({ phone })} error={errors.phone} optional /> : null}
      {asked.phone && v.phone ? <CheckboxField id={`${id}-wa`} label={t('ui.lead.fields.whatsapp')} checked={v.whatsapp} onChange={(whatsapp) => set({ whatsapp })} /> : null}
      {me ? (
        <SignedInConsent />
      ) : (
        <ConsentBlock
          idPrefix={id}
          consent={v.consent}
          marketing={v.marketing}
          createAccount={v.createAccount}
          error={errors.consentContact}
          onChange={(p) => set({ ...(p.consent !== undefined ? { consent: p.consent } : {}), ...(p.marketing !== undefined ? { marketing: p.marketing } : {}), ...(p.createAccount !== undefined ? { createAccount: p.createAccount } : {}) })}
        />
      )}
      <Honeypot name="homepageUrl" value={honeypot} onChange={setHoneypot} />
      <Button type="submit" variant="primary" size="L" fullWidth chevron pending={pending}>
        {texts ? texts.submit : none ? t('ui.assistant.form.submitNone') : t('ui.assistant.form.submit')}
      </Button>
    </form>
  );
}
