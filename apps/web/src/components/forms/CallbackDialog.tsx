'use client';
// EP-21, DEM-014 — « Être rappelé » window, opened by ?rappel=1 on any page. From a property or programme page the
// request keeps its reference (data-lead-context). Under the button, when contact.phone is set: « Vous préférez
// appeler ? {téléphone} » (NAV-060).
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
import { QueryDialog, readLeadContext, useQueryFlag } from './QueryDialog';
import l from './lead.module.css';

const SUBJECTS = ['PROPERTY', 'FINANCING', 'CAFE', 'OTHER'] as const;

export function CallbackDialog({ settings }: { settings: PublicSettings }) {
  const [open, close] = useQueryFlag('rappel');
  useEffect(() => recordOrigin(), []);
  if (!settings['features.callbackRequest']) return null;
  return (
    <QueryDialog open={open} onClose={close} title={t('ui.lead.callbackForm.title')} closeLabel={t('ui.lead.callbackForm.close')}>
      <CallbackForm settings={settings} onClose={close} />
    </QueryDialog>
  );
}

function CallbackForm({ settings, onClose }: { settings: PublicSettings; onClose: () => void }) {
  const id = useId();
  const [v, set, clear] = useDraft('callback', {
    firstName: '',
    lastName: '',
    phone: '',
    whatsapp: false,
    email: '',
    day: '',
    slot: '',
    subject: '',
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
  const send = useLeadSubmit('CALLBACK_REQUEST', settings);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!v.firstName.trim()) local.firstName = t('ui.validation.REQUIRED');
    if (!v.phone) local.phone = t('ui.validation.REQUIRED');
    if (!v.email.trim()) local.email = t('ui.validation.REQUIRED');
    if (!v.consent) local.consentContact = t('ui.validation.MUST_ACCEPT');
    setErrors(local);
    if (Object.keys(local).length) return;
    setPending(true);
    setBanner(null);
    const res = await send(
      {
        firstName: v.firstName,
        lastName: v.lastName || null,
        phone: v.phone,
        whatsappOptIn: v.whatsapp,
        email: v.email,
        preferredCallbackDate: v.day || null,
        preferredSlot: v.slot || null,
        subject: v.subject || null,
        message: v.message || null,
        ...consentWire(v.consent, v.marketing),
        createAccount: v.createAccount,
      },
      readLeadContext(),
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
        onContinue={onClose}
      />
    );
  }

  return (
    <form className={l.form} onSubmit={submit} noValidate>
      <p>{t('ui.lead.callbackForm.intro')}</p>
      {banner ? (
        <p className={l.banner} role="alert">
          <Icon name="status-error" size={20} />
          {banner}
        </p>
      ) : null}
      <div className={l.row}>
        <TextField id={`${id}-fn`} label={t('ui.lead.fields.firstName')} autoComplete="given-name" value={v.firstName} onChange={(e) => set({ firstName: e.target.value })} error={errors.firstName} />
        <TextField id={`${id}-ln`} label={t('ui.lead.fields.lastName')} optional autoComplete="family-name" value={v.lastName} onChange={(e) => set({ lastName: e.target.value })} error={errors.lastName} />
      </div>
      <PhoneField id={`${id}-phone`} value={v.phone} onChange={(phone) => set({ phone })} error={errors.phone} />
      {v.phone ? <CheckboxField id={`${id}-wa`} label={t('ui.lead.fields.whatsapp')} checked={v.whatsapp} onChange={(whatsapp) => set({ whatsapp })} /> : null}
      <TextField id={`${id}-email`} type="email" inputMode="email" autoComplete="email" label={t('ui.lead.fields.email')} placeholder={t('ui.common.placeholder.email')} value={v.email} onChange={(e) => set({ email: e.target.value })} error={errors.email} />
      <CallbackWhen settings={settings} day={v.day} slot={v.slot} idPrefix={id} onChange={(p) => set(p)} />
      <SelectField id={`${id}-subject`} label={t('ui.lead.callbackForm.subject')} optional value={v.subject} onChange={(e) => set({ subject: e.target.value })}>
        <option value="" />
        {SUBJECTS.filter((x) => settings['features.cafe'] || x !== 'CAFE').map((x) => (
          <option key={x} value={x}>
            {t(`ui.lead.callbackForm.subjects.${x}`)}
          </option>
        ))}
      </SelectField>
      <TextArea id={`${id}-msg`} label={t('ui.lead.fields.message')} optional maxLength={2000} counter value={v.message} onChange={(e) => set({ message: e.target.value })} error={errors.message} />
      <ConsentBlock idPrefix={id} consent={v.consent} marketing={v.marketing} createAccount={v.createAccount} error={errors.consentContact} onChange={(p) => set({ ...(p.consent !== undefined ? { consent: p.consent } : {}), ...(p.marketing !== undefined ? { marketing: p.marketing } : {}), ...(p.createAccount !== undefined ? { createAccount: p.createAccount } : {}) })} />
      <Honeypot name="homepageUrl" value={honeypot} onChange={setHoneypot} />
      <Button type="submit" variant="primary" size="L" fullWidth chevron pending={pending}>
        {t('ui.lead.callbackForm.submit')}
      </Button>
      {settings['contact.phone'] ? (
        <p className={l.under}>
          {t('ui.lead.callbackForm.phoneNow', { telephone: formatPhone(settings['contact.phone']) })}
          {settings['contact.openingHoursLabel'] ? ` · ${settings['contact.openingHoursLabel']}` : null}
        </p>
      ) : null}
    </form>
  );
}
