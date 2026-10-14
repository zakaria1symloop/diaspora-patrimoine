'use client';
// Pieces shared by the lead forms (DEM-011 … DEM-017): phone with dialling code (TRV-040, E.164), residence country
// (TRV-044, DEM-006), « Quand vous appeler ? » (DEM-008), the consent block (DEM-020, DEM-021), the signed-in client's
// details in place of the contact fields (DEM-022), and the submission with its error handling (DEM-032, DEM-040).
import { useEffect, useMemo, useState } from 'react';
import { AsYouType, parsePhoneNumberFromString, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import {
  CURRENT_CONTACT_CONSENT_KEY,
  CURRENT_MARKETING_CONSENT_KEY,
  LEAD_HONEYPOT_FIELD,
  LEAD_SHORT_LIMIT_SECONDS,
  LeadConsentWording,
  SIGNED_IN_CONTACT_CONSENT_KEY,
  type ClientMe,
  type LeadSubmitInput,
  type LeadSubmitResponse,
  type PublicSettings,
} from '@dp/contracts';
import { hasMessage } from '@dp/i18n';
import { callbackDays, callbackSlots, browserTimeZone, dayOptionLabel, type Slot } from '@/lib/callback';
import { formatPhone } from '@/lib/contact';
import { useClientSession } from '@/lib/session-client';
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

// ─── DEM-022 — a signed-in client sends from his account ────────────────────

/** The signed-in client, else null (anonymous, or the session still loading: the anonymous form shows meanwhile). */
export function useSignedInClient(): ClientMe | null {
  const session = useClientSession();
  return session.status === 'authenticated' ? session.me : null;
}

/** What the request carries: the account's details, the form's only where the record has none (the server does the same). */
export function contactOf(
  me: ClientMe | null,
  v: { firstName?: string; lastName?: string; email?: string; phone?: string; country?: string },
): { firstName: string; lastName: string; email: string; phone: string; country: string } {
  return {
    firstName: me?.firstName || v.firstName || '',
    lastName: me?.lastName || v.lastName || '',
    email: me?.email || v.email || '',
    phone: me?.phone || v.phone || '',
    country: me?.countryOfResidence || v.country || '',
  };
}

/** The fields a signed-in client is still asked for: those his record lacks. Anonymous: all of them. */
export function askedOf(me: ClientMe | null): { name: boolean; email: boolean; phone: boolean; country: boolean } {
  return { name: !me?.firstName || !me?.lastName, email: !me, phone: !me?.phone, country: !me?.countryOfResidence };
}

/** « {Prénom Nom} · {e-mail} · {téléphone} » and « Modifier mes coordonnées », in place of the contact fields. */
export function SignedInContact({ me }: { me: ClientMe }) {
  const name = [me.firstName, me.lastName].filter(Boolean).join(' ');
  const line = [name, me.email, me.phone ? formatPhone(me.phone) : null].filter(Boolean).join(' · ');
  return (
    <div className={s.signedIn} data-testid="signed-in-contact">
      <span className={s.signedInLabel}>{t('ui.lead.fields.signedInAs')}</span>
      <span className={s.signedInLine}>{line}</span>
      <a href="/espace-client/profil" className={s.signedInEdit}>
        {t('ui.lead.fields.editDetails')}
      </a>
    </div>
  );
}

/** The sentence that replaces the consent box; the server records it as the consent (`lead.contact.signedIn.v1`). */
export function SignedInConsent() {
  return <p className={s.hint}>{LeadConsentWording[SIGNED_IN_CONTACT_CONSENT_KEY].text}</p>;
}

export const signedInConsentWire = () => ({
  consentContact: true as const,
  consentKey: SIGNED_IN_CONTACT_CONSENT_KEY,
  marketingOptIn: false,
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
