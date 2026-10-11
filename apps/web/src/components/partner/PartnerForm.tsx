'use client';
// EP-23, DEM-019 — « Devenir partenaire »: notaries, insurers, institutions and media write to the team (promoters and
// banks have their own door, EP-32, said at the top of the page). No client record is created; only the Direction and
// Administrator roles are notified (server side). Confirmation: « Nous revenons vers vous sous {n} jours ouvrés. »
import Link from 'next/link';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { CURRENT_CONTACT_CONSENT_KEY, LeadConsentWording, PartnerRequesterKind, type LeadSubmitResponse, type PublicSettings } from '@dp/contracts';
import { Button, Celebration, Icon, buttonClass, ButtonInner } from '@dp/ui';
import { useDraft } from '@/lib/public-form';
import { recordOrigin } from '@/lib/tracking';
import { t } from '@/lib/i18n';
import { CheckboxField, Honeypot, SelectField, TextArea, TextField } from '@/components/forms/fields';
import { CountrySelect, PhoneField, useLeadSubmit } from '@/components/forms/lead-parts';
import l from '@/components/forms/lead.module.css';
import s from './partner.module.css';

/** A site typed without its scheme (« www.exemple.fr ») is completed with https:// ; null when it cannot be an address. */
export function normaliseWebsite(raw: string): string | null {
  const v = raw.trim();
  if (!v) return '';
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes('.') ? withScheme : null;
  } catch {
    return null;
  }
}

const ORDER = ['company', 'requesterKind', 'firstName', 'lastName', 'jobTitle', 'email', 'phone', 'country', 'websiteUrl', 'message', 'consentContact'];

export function PartnerForm({ settings }: { settings: PublicSettings }) {
  const id = useId();
  const [v, set, clear] = useDraft('partner', {
    company: '',
    requesterKind: '',
    firstName: '',
    lastName: '',
    jobTitle: '',
    email: '',
    phone: '',
    country: '',
    websiteUrl: '',
    message: '',
    consent: false,
  });
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<LeadSubmitResponse | null>(null);
  const send = useLeadSubmit('PARTNER_REQUEST', settings);

  useEffect(() => recordOrigin(), []);

  const focusFirst = (errs: Record<string, string>) => {
    const first = ORDER.find((k) => errs[k]);
    if (first) document.getElementById(`${id}-${first}`)?.focus();
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    const required = ['company', 'requesterKind', 'firstName', 'lastName', 'email', 'phone', 'country', 'message'] as const;
    for (const k of required) if (!String(v[k]).trim()) local[k] = t('ui.validation.REQUIRED');
    const website = normaliseWebsite(v.websiteUrl);
    if (website === null) local.websiteUrl = t('ui.partner.form.websiteInvalid');
    if (!v.consent) local.consentContact = t('ui.validation.MUST_ACCEPT');
    setErrors(local);
    if (Object.keys(local).length) return focusFirst(local);
    setPending(true);
    setBanner(null);
    const res = await send(
      {
        company: v.company,
        requesterKind: v.requesterKind,
        firstName: v.firstName,
        lastName: v.lastName,
        jobTitle: v.jobTitle || null,
        email: v.email,
        phone: v.phone,
        country: v.country,
        websiteUrl: website || null,
        message: v.message,
        consentContact: v.consent,
        consentKey: CURRENT_CONTACT_CONSENT_KEY,
      },
      {},
      honeypot,
    );
    setPending(false);
    if (res.ok) {
      clear();
      setDone(res.data);
      return;
    }
    const fields = { ...res.errors.fields };
    if (fields.websiteUrl) fields.websiteUrl = t('ui.partner.form.websiteInvalid');
    setErrors(fields);
    setBanner(res.errors.banner);
    focusFirst(fields);
  }

  if (done) {
    return (
      <div className={`${s.card} ${l.done}`} role="status" aria-live="polite">
        <Celebration moment="lead" objectId="partner" />
        <h2 className={l.doneTitle}>{done.firstName ? t('ui.partner.done.title', { prenom: done.firstName }) : t('ui.lead.done.titleAnonymous')}</h2>
        <p className={s.doneLine}>{t('ui.partner.done.review', { n: settings['partner.applicationReviewDays'] })}</p>
        <p className={l.muted}>{t('ui.partner.done.email', { email: done.email })}</p>
        <div className={l.buttons}>
          <Link href="/" className={buttonClass('secondary', 'M')}>
            <ButtonInner size="M">{t('ui.partner.done.home')}</ButtonInner>
          </Link>
          <Link href="/nos-partenaires" className={buttonClass('primary', 'M')}>
            <ButtonInner size="M" chevron>
              {t('ui.partner.done.partners')}
            </ButtonInner>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className={`${s.card} ${l.form}`} onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.title}>
        {t('ui.partner.form.title')}
      </h2>
      {banner ? (
        <p className={l.banner} role="alert">
          <Icon name="status-error" size={20} />
          {banner}
        </p>
      ) : null}
      <div className={l.row}>
        <TextField id={`${id}-company`} label={t('ui.partner.form.company')} autoComplete="organization" value={v.company} onChange={(e) => set({ company: e.target.value })} error={errors.company} maxLength={120} />
        <SelectField id={`${id}-requesterKind`} label={t('ui.partner.form.requesterKind')} value={v.requesterKind} onChange={(e) => set({ requesterKind: e.target.value })} error={errors.requesterKind}>
          <option value="" />
          {PartnerRequesterKind.map((k) => (
            <option key={k} value={k}>
              {t(`ui.partner.form.kinds.${k}`)}
            </option>
          ))}
        </SelectField>
      </div>
      <div className={l.row}>
        <TextField id={`${id}-firstName`} label={t('ui.lead.fields.firstName')} autoComplete="given-name" value={v.firstName} onChange={(e) => set({ firstName: e.target.value })} error={errors.firstName} />
        <TextField id={`${id}-lastName`} label={t('ui.lead.fields.lastName')} autoComplete="family-name" value={v.lastName} onChange={(e) => set({ lastName: e.target.value })} error={errors.lastName} />
      </div>
      <TextField id={`${id}-jobTitle`} label={t('ui.partner.form.jobTitle')} optional autoComplete="organization-title" value={v.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} error={errors.jobTitle} maxLength={80} />
      <TextField
        id={`${id}-email`}
        type="email"
        inputMode="email"
        autoComplete="work email"
        label={t('ui.partner.form.email')}
        placeholder={t('ui.common.placeholder.email')}
        value={v.email}
        onChange={(e) => set({ email: e.target.value })}
        error={errors.email}
      />
      <PhoneField id={`${id}-phone`} value={v.phone} onChange={(phone) => set({ phone })} error={errors.phone} onCountryDetected={(c) => (v.country ? undefined : set({ country: c }))} />
      <CountrySelect id={`${id}-country`} label={t('ui.partner.form.country')} value={v.country} onChange={(country) => set({ country })} error={errors.country} />
      <TextField
        id={`${id}-websiteUrl`}
        type="url"
        inputMode="url"
        autoComplete="url"
        label={t('ui.partner.form.website')}
        optional
        hint={t('ui.partner.form.websiteHint')}
        value={v.websiteUrl}
        onChange={(e) => set({ websiteUrl: e.target.value })}
        error={errors.websiteUrl}
        maxLength={200}
      />
      <TextArea
        id={`${id}-message`}
        label={t('ui.partner.form.message')}
        hint={t('ui.partner.form.messageHint')}
        maxLength={2000}
        counter
        value={v.message}
        onChange={(e) => set({ message: e.target.value })}
        error={errors.message}
      />
      <div className={l.consents}>
        <CheckboxField
          id={`${id}-consentContact`}
          checked={v.consent}
          onChange={(consent) => set({ consent })}
          error={errors.consentContact}
          label={
            <>
              {/* DEM-020 — the exact proof sentence stored by the server, link in place of its marker. */}
              {LeadConsentWording[CURRENT_CONTACT_CONSENT_KEY].text.replace(' [Politique de confidentialité]', '')}{' '}
              <a href="/confidentialite" target="_blank" rel="noopener">
                {t('ui.lead.fields.privacy')}
              </a>
            </>
          }
        />
        <p className={l.hint}>{t('ui.lead.fields.euHosting')}</p>
      </div>
      <Honeypot name="homepageUrl" value={honeypot} onChange={setHoneypot} />
      <Button type="submit" variant="primary" size="L" fullWidth chevron pending={pending}>
        {t('ui.partner.form.submit')}
      </Button>
    </form>
  );
}
