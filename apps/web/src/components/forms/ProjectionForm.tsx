'use client';
// ACC-081, DEM-013 — « Recevez votre projection »: four fields (region optional, down payment, comfortable monthly
// payment, e-mail) + consent → the request is CREATED; then the second screen (optional, 30 minutes, once):
// first name, last name, phone (+ WhatsApp), country, « Quand vous appeler ? »; the e-mail can be corrected (D-095).
// Used on the home page (ACC-081) and on `/projection` (EP-20); both end on the DEM-023 confirmation.
import { useId, useState, type FormEvent } from 'react';
import { isApiErrorBody, leadCompleteSchema, type LeadCompleteResponse, type LeadSubmitResponse, type PublicSettings } from '@dp/contracts';
import { callbackLabel, hasMessage } from '@dp/i18n';
import { Button, Celebration, Icon } from '@dp/ui';
import { browserTimeZone } from '@/lib/callback';
import { useDraft } from '@/lib/public-form';
import { t } from '@/lib/i18n';
import { CheckboxField, Honeypot, SelectField, TextField } from './fields';
import { CallbackWhen, ConsentBlock, CountrySelect, PhoneField, SignedInConsent, SignedInContact, askedOf, consentWire, signedInConsentWire, useLeadSubmit, useSignedInClient } from './lead-parts';
import { LeadDone } from './LeadDone';
import { formatPhone } from '@/lib/contact';
import s from './projection.module.css';
import l from './lead.module.css';

export interface ProjectionFormProps {
  settings: PublicSettings;
  regions: { slug: string; name: string }[];
  texts: { title: string; badge: string; text: string; button: string };
  /** The form's title is an h3 under a home section, an h2 under the page title of `/projection`. */
  headingLevel?: 'h2' | 'h3';
  /** `band`: the four fields on one row (home, full width); `page`: two columns, in the column of `/projection`. */
  variant?: 'band' | 'page';
}

function toAmount(raw: string): string {
  return raw.replace(/[\s  ]/g, '').replace(',', '.');
}

export function ProjectionForm({ settings, regions, texts, headingLevel = 'h3', variant = 'band' }: ProjectionFormProps) {
  const Heading = headingLevel;
  const id = useId();
  const [v, set, clear] = useDraft('projection', { regionSlug: '', downPayment: '', monthlyBudget: '', email: '', consent: false, marketing: false, createAccount: false });
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<LeadSubmitResponse | null>(null);
  const send = useLeadSubmit('PROJECTION_REQUEST', settings);
  const me = useSignedInClient(); // DEM-022

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!v.downPayment.trim()) local.downPayment = t('ui.validation.REQUIRED');
    if (!v.monthlyBudget.trim()) local.monthlyBudget = t('ui.validation.REQUIRED');
    if (!me && !v.email.trim()) local.email = t('ui.validation.REQUIRED');
    if (!me && !v.consent) local.consentContact = t('ui.validation.MUST_ACCEPT');
    setErrors(local);
    if (Object.keys(local).length) return;
    setPending(true);
    setBanner(null);
    const res = await send({
      regionSlug: v.regionSlug || null,
      downPayment: toAmount(v.downPayment),
      monthlyBudget: toAmount(v.monthlyBudget),
      email: me ? me.email : v.email,
      ...(me ? signedInConsentWire() : consentWire(v.consent, v.marketing)),
      createAccount: me ? false : v.createAccount,
    }, {}, honeypot);
    setPending(false);
    if (res.ok) {
      clear();
      setResult(res.data);
    } else {
      setErrors(res.errors.fields);
      setBanner(res.errors.banner);
    }
  }

  if (result) return <ProjectionNext result={result} settings={settings} />;

  return (
    <form className={s.card} onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <div className={s.head}>
        {/* On `/projection` the page title already says it: the form keeps it for assistive technologies only. */}
        <Heading id={`${id}-title`} className={variant === 'page' ? 'visually-hidden' : s.title}>
          {texts.title}
        </Heading>
        <span className={s.badge}>{texts.badge}</span>
      </div>
      <p className={s.text}>{texts.text}</p>
      {banner ? (
        <p className={l.banner} role="alert">
          <Icon name="status-error" size={20} />
          {banner}
        </p>
      ) : null}
      <div className={variant === 'page' ? `${s.fields} ${s.fieldsPage}` : s.fields}>
        <SelectField id={`${id}-region`} label={t('ui.lead.projection.region')} optional value={v.regionSlug} onChange={(e) => set({ regionSlug: e.target.value })} error={errors.regionSlug}>
          <option value="">{t('ui.lead.projection.regionAny')}</option>
          {regions.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${id}-down`}
          label={t('ui.lead.projection.downPayment')}
          inputMode="decimal"
          placeholder={t('ui.common.placeholder.downPayment')}
          suffix="€"
          value={v.downPayment}
          onChange={(e) => set({ downPayment: e.target.value })}
          error={errors.downPayment}
          icon={<Icon name="diamond" size={20} />}
        />
        <TextField
          id={`${id}-monthly`}
          label={t('ui.lead.projection.monthly')}
          inputMode="decimal"
          placeholder={t('ui.common.placeholder.monthly')}
          suffix={`€ ${t('ui.lead.projection.perMonth')}`}
          value={v.monthlyBudget}
          onChange={(e) => set({ monthlyBudget: e.target.value })}
          error={errors.monthlyBudget}
          icon={<Icon name="coins" size={20} />}
        />
        {me ? null : (
        <TextField
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          label={t('ui.lead.projection.email')}
          placeholder={t('ui.common.placeholder.email')}
          value={v.email}
          onChange={(e) => set({ email: e.target.value })}
          error={errors.email}
          icon={<Icon name="mail" size={20} />}
        />
        )}
        <Button type="submit" variant="primary" size="L" chevron pending={pending} className={s.submit}>
          {texts.button}
        </Button>
      </div>
      {me ? <SignedInContact me={me} /> : null}
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
    </form>
  );
}

/** DEM-013 second screen, then the DEM-023 confirmation (« Compléter ma demande » or « Terminer »). */
function ProjectionNext({ result, settings }: { result: LeadSubmitResponse; settings: PublicSettings }) {
  const id = useId();
  const [email, setEmail] = useState(result.email);
  const [draftEmail, setDraftEmail] = useState(result.email);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ firstName: '', lastName: '', phone: '', whatsapp: false, country: '', day: '', slot: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<LeadCompleteResponse | null>(null);
  const [expired, setExpired] = useState(false);
  const me = useSignedInClient(); // DEM-022 — the e-mail is the account's; only what the record lacks is asked
  const asked = askedOf(me);
  const quand = callbackLabel({
    preferredCallbackDate: null,
    preferredSlot: null,
    firstContactBusinessDays: settings['sla.firstContactBusinessDays'],
    timeZone: browserTimeZone(),
  });

  /** `POST /public/leads/complete` — 410: the 30 minutes are over, or the completion was already made (DEM-013). */
  async function complete(fields: Record<string, unknown>): Promise<LeadCompleteResponse | null> {
    const body = { completionToken: result.completionToken, fields };
    const parsed = leadCompleteSchema.safeParse(body);
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) out[String(i.path[1] ?? i.path[0])] = t(`ui.validation.${i.message}` as never);
      setErrors(out);
      return null;
    }
    setErrors({});
    setBanner(null);
    setPending(true);
    try {
      const res = await fetch('/api/v1/public/leads/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json: unknown = await res.json().catch(() => null);
      if (res.ok) return json as LeadCompleteResponse;
      if (res.status === 410) {
        setExpired(true);
        return null;
      }
      if (isApiErrorBody(json) && json.error.code === 'VALIDATION_ERROR') {
        const out: Record<string, string> = {};
        for (const d of json.error.details) {
          const key = `ui.validation.${d.code}`;
          out[d.field.replace(/^fields\./, '')] = hasMessage(key) ? t(key, (d.params ?? undefined) as never) : t('ui.validation.INVALID_CHOICE');
        }
        setErrors(out);
        return null;
      }
      setBanner(t('ui.projection.complete.failed'));
      return null;
    } catch {
      setBanner(t('ui.common.offline'));
      return null;
    } finally {
      setPending(false);
    }
  }

  const doneProps = {
    firstContactBusinessDays: settings['sla.firstContactBusinessDays'],
    contactEmail: settings['contact.email'],
    contactPhone: settings['contact.phone'] ? formatPhone(settings['contact.phone']) : '',
  };
  if (done) return <LeadDone result={done} {...doneProps} />;
  if (expired) {
    return (
      <div className={s.after}>
        <p className={l.notice} role="status">
          {t('ui.projection.complete.expired')}
        </p>
        <LeadDone result={{ ...result, email }} {...doneProps} />
      </div>
    );
  }

  return (
    <div className={s.card} role="status" aria-live="polite">
      <Celebration moment="lead" objectId="projection" />
      <p className={s.title}>{t('ui.lead.projection.doneTitle', { quand, email })}</p>
      {banner ? (
        <p className={l.banner} role="alert">
          <Icon name="status-error" size={20} />
          {banner}
        </p>
      ) : null}
      {me ? null : editing ? (
        <div className={s.emailEdit}>
          <TextField
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            label={t('ui.lead.projection.email')}
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            error={errors.email}
          />
          <Button
            variant="secondary"
            size="M"
            pending={pending}
            onClick={async () => {
              if (draftEmail.trim().toLowerCase() === email) return setEditing(false);
              const res = await complete({ email: draftEmail });
              if (res) {
                setEmail(res.email);
                setEditing(false);
              }
            }}
          >
            {t('ui.lead.projection.save')}
          </Button>
        </div>
      ) : (
        <button type="button" className={l.toggle} onClick={() => setEditing(true)}>
          <Icon name="edit" size={16} />
          {t('ui.lead.projection.edit')}
        </button>
      )}
      <p className={s.text}>{t('ui.lead.projection.doneMore')}</p>
      {result.completionToken ? (
        <div className={l.form}>
          {asked.name ? (
          <div className={l.row}>
            <TextField id={`${id}-fn`} label={t('ui.lead.fields.firstName')} autoComplete="given-name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} error={errors.firstName} />
            <TextField id={`${id}-ln`} label={t('ui.lead.fields.lastName')} autoComplete="family-name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} error={errors.lastName} />
          </div>
          ) : null}
          {asked.phone ? <PhoneField id={`${id}-phone`} value={f.phone} onChange={(phone) => setF((x) => ({ ...x, phone }))} error={errors.phone} onCountryDetected={(c) => setF((x) => (x.country ? x : { ...x, country: c }))} /> : null}
          {asked.phone && f.phone ? <CheckboxField id={`${id}-wa`} label={t('ui.lead.fields.whatsapp')} checked={f.whatsapp} onChange={(w) => setF({ ...f, whatsapp: w })} /> : null}
          {asked.country ? <CountrySelect id={`${id}-country`} value={f.country} onChange={(country) => setF({ ...f, country })} error={errors.countryOfResidence} /> : null}
          <CallbackWhen settings={settings} day={f.day} slot={f.slot} idPrefix={id} onChange={(p) => setF((x) => ({ ...x, ...(p.day !== undefined ? { day: p.day } : {}), ...(p.slot !== undefined ? { slot: p.slot } : {}) }))} />
          <div className={l.buttons}>
            <Button
              variant="primary"
              size="M"
              pending={pending}
              onClick={async () => {
                const filled = {
                  firstName: f.firstName || undefined,
                  lastName: f.lastName || undefined,
                  phone: f.phone || undefined,
                  whatsappOptIn: f.phone ? f.whatsapp : undefined,
                  countryOfResidence: f.country || undefined,
                  preferredCallbackDate: f.day || undefined,
                  preferredSlot: f.slot || undefined,
                };
                // Nothing typed: « Compléter » ends like « Terminer ».
                if (Object.values(filled).every((v) => v === undefined)) return setDone({ ...result, email });
                const res = await complete(filled);
                if (res) setDone(res);
              }}
            >
              {t('ui.lead.projection.complete')}
            </Button>
            <Button variant="tertiary" size="M" onClick={() => setDone({ ...result, email })}>
              {t('ui.lead.projection.finish')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
