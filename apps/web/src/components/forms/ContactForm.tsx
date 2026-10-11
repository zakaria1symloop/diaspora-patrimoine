'use client';
// EP-19 form, DEM-015 — subject preselected by the address (?objet=rappel), a
// property or programme kept (&bien=, &programme=). Subject « Être rappelé »: phone required, message optional,
// day and moment offered, a real callback request (CALLBACK_REQUEST) on the server side.
import { useSearchParams } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { LeadSubmitResponse, PublicSettings } from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { formatPhone } from '@/lib/contact';
import { useDraft } from '@/lib/public-form';
import { recordOrigin } from '@/lib/tracking';
import { t } from '@/lib/i18n';
import { CheckboxField, Honeypot, SelectField, TextArea, TextField } from './fields';
import { CallbackWhen, ConsentBlock, PhoneField, consentWire, useLeadSubmit } from './lead-parts';
import { LeadDone } from './LeadDone';
import l from './lead.module.css';

const SUBJECTS = ['PROPERTY', 'FINANCING', 'CAFE', 'CALLBACK', 'OTHER'] as const;
const FROM_ADDRESS: Record<string, (typeof SUBJECTS)[number]> = {
  rappel: 'CALLBACK',
  bien: 'PROPERTY',
  financement: 'FINANCING',
  cafe: 'CAFE',
};

export function ContactForm({ settings }: { settings: PublicSettings }) {
  const id = useId();
  const params = useSearchParams();
  const [v, set, clear] = useDraft('contact', {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    whatsapp: false,
    subject: '',
    day: '',
    slot: '',
    message: '',
    consent: false,
    marketing: false,
    createAccount: false,
  });
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<LeadSubmitResponse | null>(null);
  const send = useLeadSubmit('CONTACT_MESSAGE', settings);

  useEffect(() => recordOrigin(), []);
  useEffect(() => {
    const preset = FROM_ADDRESS[params.get('objet') ?? ''];
    if (preset && (preset !== 'CAFE' || settings['features.cafe'])) set({ subject: preset });
  }, [params, set, settings]);

  const callback = v.subject === 'CALLBACK';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!v.firstName.trim()) local.firstName = t('ui.validation.REQUIRED');
    if (!v.lastName.trim()) local.lastName = t('ui.validation.REQUIRED');
    if (!v.email.trim()) local.email = t('ui.validation.REQUIRED');
    if (!v.subject) local.subject = t('ui.validation.REQUIRED');
    if (callback && !v.phone) local.phone = t('ui.validation.REQUIRED');
    if (!callback && v.message.trim().length < 10) local.message = v.message.trim() ? t('ui.validation.TOO_SHORT', { n: 10 }) : t('ui.validation.REQUIRED');
    if (!v.consent) local.consentContact = t('ui.validation.MUST_ACCEPT');
    setErrors(local);
    if (Object.keys(local).length) {
      document.getElementById(`${id}-${Object.keys(local)[0]}`)?.focus();
      return;
    }
    setPending(true);
    setBanner(null);
    const context: Record<string, string> = {};
    const bien = params.get('bien');
    const programme = params.get('programme');
    if (bien) context.propertyReference = bien;
    if (programme) context.programSlug = programme;
    const res = await send(
      {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        phone: v.phone || null,
        whatsappOptIn: v.phone ? v.whatsapp : false,
        subject: v.subject,
        preferredCallbackDate: callback ? v.day || null : null,
        preferredSlot: callback ? v.slot || null : null,
        message: v.message || null,
        ...consentWire(v.consent, v.marketing),
        createAccount: v.createAccount,
      },
      context,
      honeypot,
    );
    setPending(false);
    if (res.ok) {
      clear();
      setDone(res.data);
    } else {
      setErrors(res.errors.fields);
      setBanner(res.errors.banner);
    }
  }

  if (done) {
    return (
      <LeadDone
        result={done}
        firstContactBusinessDays={settings['sla.firstContactBusinessDays']}
        contactEmail={settings['contact.email']}
        contactPhone={settings['contact.phone'] ? formatPhone(settings['contact.phone']) : ''}
      />
    );
  }

  return (
    <form className={l.form} onSubmit={submit} noValidate>
      {banner ? (
        <p className={l.banner} role="alert">
          <Icon name="status-error" size={20} />
          {banner}
        </p>
      ) : null}
      <div className={l.row}>
        <TextField id={`${id}-firstName`} label={t('ui.lead.fields.firstName')} autoComplete="given-name" value={v.firstName} onChange={(e) => set({ firstName: e.target.value })} error={errors.firstName} />
        <TextField id={`${id}-lastName`} label={t('ui.lead.fields.lastName')} autoComplete="family-name" value={v.lastName} onChange={(e) => set({ lastName: e.target.value })} error={errors.lastName} />
      </div>
      <TextField id={`${id}-email`} type="email" inputMode="email" autoComplete="email" label={t('ui.lead.fields.email')} placeholder={t('ui.common.placeholder.email')} value={v.email} onChange={(e) => set({ email: e.target.value })} error={errors.email} />
      <PhoneField id={`${id}-phone`} value={v.phone} onChange={(phone) => set({ phone })} error={errors.phone} optional={!callback} />
      {v.phone ? <CheckboxField id={`${id}-wa`} label={t('ui.lead.fields.whatsapp')} checked={v.whatsapp} onChange={(whatsapp) => set({ whatsapp })} /> : null}
      <SelectField id={`${id}-subject`} label={t('ui.lead.contact.subject')} value={v.subject} onChange={(e) => set({ subject: e.target.value })} error={errors.subject}>
        <option value="" />
        {SUBJECTS.filter((x) => settings['features.cafe'] || x !== 'CAFE').map((x) => (
          <option key={x} value={x}>
            {t(`ui.lead.contact.subjects.${x}`)}
          </option>
        ))}
      </SelectField>
      {callback ? <CallbackWhen settings={settings} day={v.day} slot={v.slot} idPrefix={id} onChange={(p) => set(p)} /> : null}
      <TextArea
        id={`${id}-message`}
        label={t('ui.lead.fields.message')}
        optional={callback}
        hint={t('ui.lead.fields.messageHint')}
        maxLength={2000}
        counter
        value={v.message}
        onChange={(e) => set({ message: e.target.value })}
        error={errors.message}
      />
      <ConsentBlock idPrefix={id} consent={v.consent} marketing={v.marketing} createAccount={v.createAccount} error={errors.consentContact} onChange={(p) => set({ ...(p.consent !== undefined ? { consent: p.consent } : {}), ...(p.marketing !== undefined ? { marketing: p.marketing } : {}), ...(p.createAccount !== undefined ? { createAccount: p.createAccount } : {}) })} />
      <Honeypot name="homepageUrl" value={honeypot} onChange={setHoneypot} />
      <Button type="submit" variant="primary" size="L" fullWidth chevron pending={pending}>
        {t('ui.lead.contact.submit')}
      </Button>
    </form>
  );
}
