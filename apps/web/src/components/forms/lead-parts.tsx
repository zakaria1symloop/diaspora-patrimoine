'use client';
// Pieces shared by the lead forms (DEM-011 … DEM-017): phone with dialling code (TRV-040, E.164), residence country
// (TRV-044, DEM-006), « Quand vous appeler ? » (DEM-008), the consent block (DEM-020, DEM-021), and the submission
// with its error handling (DEM-032 limits, DEM-040 errors).
import { useEffect, useMemo, useState } from 'react';
import { AsYouType, parsePhoneNumberFromString, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import {
  CURRENT_CONTACT_CONSENT_KEY,
  CURRENT_MARKETING_CONSENT_KEY,
  LEAD_HONEYPOT_FIELD,
  LEAD_SHORT_LIMIT_SECONDS,
  LeadConsentWording,
  type LeadSubmitInput,
  type LeadSubmitResponse,
  type PublicSettings,
} from '@dp/contracts';
import { hasMessage } from '@dp/i18n';
import { callbackDays, callbackSlots, browserTimeZone, dayOptionLabel, type Slot } from '@/lib/callback';
import { trackingPayload } from '@/lib/tracking';
import { usePublicForm } from '@/lib/public-form';
import { t } from '@/lib/i18n';
import { CheckboxField, SelectField, TextField } from './fields';
import s from './lead.module.css';

export interface PublicCountry {
  code: string;
  name: string;
  phonePrefix: string;
  frequent: boolean;
}

let countriesPromise: Promise<PublicCountry[]> | null = null;
export function useCountries(): PublicCountry[] {
  const [list, setList] = useState<PublicCountry[]>([]);
  useEffect(() => {
    countriesPromise ??= fetch('/api/v1/public/countries')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((b: { data: PublicCountry[] }) => b.data)
      .catch(() => []);
    void countriesPromise.then(setList);
  }, []);
  return list;
}

export function CountrySelect({ id, value, onChange, error, label = t('ui.lead.fields.country') }: { id: string; value: string; onChange: (v: string) => void; error?: string | null; label?: string }) {
  const countries = useCountries();
  const frequent = countries.filter((c) => c.frequent);
  const others = countries.filter((c) => !c.frequent);
  return (
    <SelectField id={id} label={label} value={value} onChange={(e) => onChange(e.target.value)} error={error} autoComplete="country">
      <option value="">{t('ui.lead.fields.countryPlaceholder')}</option>
      {frequent.length ? (
        <optgroup label="—">
          {frequent.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {others.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </SelectField>
  );
}

/** TRV-040 — dialling code + national number; the value given to the form is E.164 (or '' when empty). */
export function PhoneField({
  id,
  value,
  onChange,
  error,
  optional,
  defaultCountry = 'FR',
  onCountryDetected,
}: {
  id: string;
  value: string;
  onChange: (e164: string) => void;
  error?: string | null;
  optional?: boolean;
  defaultCountry?: string;
  onCountryDetected?: (code: string) => void;
}) {
  const countries = useCountries();
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  const [country, setCountry] = useState<string>(parsed?.country ?? defaultCountry);
  const [national, setNational] = useState<string>(parsed ? parsed.formatNational() : '');

  const emit = (code: string, raw: string) => {
    const digits = raw.replace(/[^\d+]/g, '');
    if (!digits) return onChange('');
    const p = digits.startsWith('+') ? parsePhoneNumberFromString(digits) : parsePhoneNumberFromString(digits, code as CountryCode);
    if (p?.country && p.country !== code) {
      setCountry(p.country);
    }
    onChange(p ? p.number : `+${safeCode(code)}${digits.replace(/^0+/, '')}`);
    if (p?.country) onCountryDetected?.(p.country);
  };

  return (
    <div className={s.phone}>
      <label htmlFor={id} className={s.label}>
        {t('ui.lead.fields.phone')}
        {optional ? <span className={s.optional}> {t('ui.common.optional')}</span> : null}
      </label>
      <div className={[s.phoneRow, error && s.invalid].filter(Boolean).join(' ')}>
        <select
          aria-label={t('ui.lead.fields.country')}
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            emit(e.target.value, national);
          }}
          className={s.dial}
        >
          {(countries.length ? countries : [{ code: defaultCountry, name: defaultCountry, phonePrefix: `+${safeCode(defaultCountry)}`, frequent: true }]).map((c) => (
            <option key={c.code} value={c.code}>
              {`${c.name} (${c.phonePrefix})`}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={t('ui.common.placeholder.phone')}
          value={national}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          onChange={(e) => {
            const formatted = new AsYouType(country as CountryCode).input(e.target.value);
            setNational(formatted);
            emit(country, e.target.value);
          }}
        />
      </div>
      <span id={`${id}-hint`} className={s.hint}>
        {t('ui.lead.fields.phoneHint')}
      </span>
      {error ? (
        <span id={`${id}-error`} className={s.error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

function safeCode(code: string): string {
  try {
    return getCountryCallingCode(code as CountryCode);
  } catch {
    return '33';
  }
}

/** DEM-008 — day and moment, both optional; no slot fits → the opening-hours sentence. */
export function CallbackWhen({
  settings,
  day,
  slot,
  onChange,
  idPrefix,
}: {
  settings: PublicSettings;
  day: string;
  slot: string;
  onChange: (patch: { day?: string; slot?: string }) => void;
  idPrefix: string;
}) {
  const [tz, setTz] = useState('Europe/Paris');
  useEffect(() => setTz(browserTimeZone()), []);
  const days = useMemo(() => callbackDays(settings), [settings]);
  const slots = useMemo(() => callbackSlots(settings, tz), [settings, tz]);
  return (
    <div className={s.when}>
      <SelectField id={`${idPrefix}-day`} label={t('ui.lead.when.day')} optional value={day} onChange={(e) => onChange({ day: e.target.value })}>
        <option value="">{t('ui.lead.when.dayAsap')}</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {dayOptionLabel(d)}
          </option>
        ))}
      </SelectField>
      {slots.length ? (
        <SelectField
          id={`${idPrefix}-slot`}
          label={t('ui.lead.when.slot')}
          optional
          hint={t('ui.lead.when.slotsLocal')}
          value={slot}
          onChange={(e) => onChange({ slot: e.target.value })}
        >
          <option value="">{t('ui.lead.when.slotAny')}</option>
          {slots.map((sl: Slot) => (
            <option key={sl} value={sl}>
              {t(`ui.lead.when.slotOptions.${sl}`)}
            </option>
          ))}
        </SelectField>
      ) : (
        <p className={s.hint}>{t('ui.lead.when.noSlot', { horaires: settings['contact.openingHoursLabel'] })}</p>
      )}
    </div>
  );
}

/** DEM-020, DEM-021 — consent (never pre-checked), news, « Créer mon espace client en même temps ». */
export function ConsentBlock({
  idPrefix,
  consent,
  marketing,
  createAccount,
  onChange,
  error,
  showAccount = true,
}: {
  idPrefix: string;
  consent: boolean;
  marketing: boolean;
  createAccount?: boolean;
  onChange: (patch: { consent?: boolean; marketing?: boolean; createAccount?: boolean }) => void;
  error?: string | null;
  showAccount?: boolean;
}) {
  return (
    <div className={s.consents}>
      <CheckboxField
        id={`${idPrefix}-consent`}
        checked={consent}
        onChange={(v) => onChange({ consent: v })}
        error={error}
        label={
          <>
            {/* DEM-020 — the exact proof sentence stored by the server (LeadConsentWording), link in place of its marker. */}
            {LeadConsentWording[CURRENT_CONTACT_CONSENT_KEY].text.replace(' [Politique de confidentialité]', '')}{' '}
            <a href="/confidentialite" target="_blank" rel="noopener">
              {t('ui.lead.fields.privacy')}
            </a>
          </>
        }
      />
      <CheckboxField
        id={`${idPrefix}-news`}
        checked={marketing}
        onChange={(v) => onChange({ marketing: v })}
        label={LeadConsentWording[CURRENT_MARKETING_CONSENT_KEY].text}
      />
      {showAccount ? (
        <div>
          <CheckboxField id={`${idPrefix}-account`} checked={Boolean(createAccount)} onChange={(v) => onChange({ createAccount: v })} label={t('ui.lead.fields.createAccount')} />
          <p className={s.hint}>{t('ui.lead.fields.createAccountHint')}</p>
        </div>
      ) : null}
      <p className={s.hint}>{t('ui.lead.fields.euHosting')}</p>
    </div>
  );
}

export const consentWire = (consent: boolean, marketing: boolean) => ({
  consentContact: consent,
  consentKey: CURRENT_CONTACT_CONSENT_KEY,
  marketingOptIn: marketing,
  marketingKey: CURRENT_MARKETING_CONSENT_KEY,
});

export type LeadErrors = { fields: Record<string, string>; banner: string | null };

/** Submits `POST /public/leads` and maps the outcome to field errors or one banner (DEM-040, DEM-032, TRV-110). */
export function useLeadSubmit(form: LeadSubmitInput['form'], settings: PublicSettings) {
  const { submit } = usePublicForm(form);
  return async (
    fields: Record<string, unknown>,
    context: Record<string, unknown> = {},
    honeypot = '',
  ): Promise<{ ok: true; data: LeadSubmitResponse } | { ok: false; errors: LeadErrors }> => {
    const res = await submit<LeadSubmitResponse>('/api/v1/public/leads', {
      form,
      fields,
      context,
      tracking: trackingPayload(),
      [LEAD_HONEYPOT_FIELD]: honeypot,
    });
    if (res.ok) return { ok: true, data: res.data };
    if (res.offline) return { ok: false, errors: { fields: {}, banner: t('ui.common.offline') } };
    const err = res.error;
    if (err?.code === 'VALIDATION_ERROR') {
      const out: Record<string, string> = {};
      for (const d of err.details) {
        const field = d.field.replace(/^fields\./, '');
        const key = `ui.validation.${d.code}`;
        out[field] = hasMessage(key) ? t(key, (d.params ?? undefined) as never) : t('ui.validation.INVALID_CHOICE');
      }
      return { ok: false, errors: { fields: out, banner: null } };
    }
    if (err?.code === 'RATE_LIMITED') {
      const seconds = Number((err.params as { retryAfterSeconds?: number } | null)?.retryAfterSeconds ?? res.retryAfter ?? 0);
      const contact = settings['contact.email'] || settings['contact.phone'];
      const banner =
        seconds > LEAD_SHORT_LIMIT_SECONDS
          ? contact
            ? t('ui.lead.errors.longLimitContact', { contact })
            : t('ui.lead.errors.longLimit')
          : t('ui.error.RATE_LIMITED');
      return { ok: false, errors: { fields: {}, banner } };
    }
    if (err?.code === 'INTERNAL_ERROR' || res.status >= 500) {
      return { ok: false, errors: { fields: {}, banner: t('ui.error.INTERNAL_ERROR', { identifiant: err?.requestId ?? '' }) } };
    }
    return { ok: false, errors: { fields: {}, banner: t('ui.error.BAD_REQUEST') } };
  };
}
