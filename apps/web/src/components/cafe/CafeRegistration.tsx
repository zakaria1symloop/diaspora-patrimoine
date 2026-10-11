'use client';
// CAF-020 … CAF-025 — registration form, its « only {n} seats left » choice, and the confirmation in place of the form.
import Link from 'next/link';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Button, Icon, buttonClass, ButtonInner } from '@dp/ui';
import { CheckboxField, ErrorSummary, Honeypot, SelectField, TextArea, TextField } from '@/components/forms/fields';
import { usePublicForm, useDraft } from '@/lib/public-form';
import { hasMessage } from '@dp/i18n';
import { CURRENT_CAFE_CONTACT_CONSENT_KEY, CURRENT_MARKETING_CONSENT_KEY, LEAD_HONEYPOT_FIELD, LeadConsentWording } from '@dp/contracts';
import { t } from '@/lib/i18n';
import s from './cafe.module.css';

interface Values {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsappOptIn: boolean;
  seats: number;
  topics: string[];
  questions: string;
  consent: boolean;
  marketingOptIn: boolean;
}

interface Registered {
  status: 'REGISTERED' | 'WAITLISTED';
  outcome: 'NEW' | 'UPDATED' | 'SENT';
  firstName: string;
  seats: number;
  accessCode: string | null;
  manageUrl: string | null;
  icsUrl: string | null;
  venue: { name: string; address: string; notes: string | null } | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
}

const TOPICS = ['PROGRAMS', 'FINANCING', 'ISLAMIC_FINANCING', 'PROCEDURES'] as const;
const TOPIC_KEY = {
  PROGRAMS: 'ui.cafe.form.topicPrograms',
  FINANCING: 'ui.cafe.form.topicFinancing',
  ISLAMIC_FINANCING: 'ui.cafe.form.topicIslamic',
  PROCEDURES: 'ui.cafe.form.topicProcedures',
} as const;

export function CafeRegistration({ slug, maxSeats, waitlist, islamicEnabled }: { slug: string; maxSeats: number; waitlist: boolean; islamicEnabled: boolean }) {
  const id = useId();
  const [v, set, clear] = useDraft<Values>(`cafe_${slug}`, {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    whatsappOptIn: false,
    seats: 1,
    topics: [],
    questions: '',
    consent: false,
    marketingOptIn: false,
  });
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [partial, setPartial] = useState<{ left: number } | null>(null);
  const [done, setDone] = useState<Registered | null>(null);
  const [pending, setPending] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const { submit } = usePublicForm('CAFE_REGISTRATION');

  const labels: Record<string, string> = {
    [`${id}-firstName`]: t('ui.cafe.form.firstName'),
    [`${id}-lastName`]: t('ui.cafe.form.lastName'),
    [`${id}-email`]: t('ui.cafe.form.email'),
    [`${id}-consent`]: t('ui.cafe.form.consent'),
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!v.firstName.trim()) e[`${id}-firstName`] = t('ui.validation.REQUIRED');
    if (!v.lastName.trim()) e[`${id}-lastName`] = t('ui.validation.REQUIRED');
    if (!v.email.trim()) e[`${id}-email`] = t('ui.validation.REQUIRED');
    else if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e[`${id}-email`] = t('ui.validation.INVALID_EMAIL');
    if (!v.consent) e[`${id}-consent`] = t('ui.validation.MUST_ACCEPT');
    return e;
  };

  async function send(choice?: { seats?: number; waitlist?: boolean }) {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.getElementById('resume-erreurs')?.focus());
      return;
    }
    setPending(true);
    setBanner(null);
    const res = await submit<Registered>(`/api/v1/public/events/${encodeURIComponent(slug)}/registrations`, {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim() || null,
      whatsappOptIn: v.whatsappOptIn,
      seats: choice?.seats ?? v.seats,
      topics: v.topics,
      questions: v.questions.trim() || null,
      consentContact: v.consent,
      consentKey: CURRENT_CAFE_CONTACT_CONSENT_KEY,
      marketingOptIn: v.marketingOptIn,
      marketingKey: CURRENT_MARKETING_CONSENT_KEY,
      waitlist: choice?.waitlist ?? waitlist,
      [LEAD_HONEYPOT_FIELD]: honeypot,
    });
    setPending(false);
    if (res.ok) {
      clear();
      setDone(res.data);
      return;
    }
    if (res.offline) {
      setBanner(t('ui.common.offline'));
      return;
    }
    const err = res.error;
    if (err?.code === 'VALIDATION_ERROR') {
      const mapped: Record<string, string> = {};
      for (const d of err.details) {
        const key = `ui.validation.${d.code}`;
        mapped[`${id}-${d.field === 'consentContact' ? 'consent' : d.field}`] = hasMessage(key) ? t(key) : t('ui.validation.INVALID_CHOICE');
      }
      setErrors(mapped);
      return;
    }
    if (err?.code === 'CONFLICT_STATE' && err.reason === 'NOT_ENOUGH_SEATS') {
      setPartial({ left: Number((err.params as { n?: number } | null)?.n ?? 0) });
      return;
    }
    if (err?.code === 'CONFLICT_STATE' && err.reason === 'EVENT_FULL') {
      setPartial({ left: 0 });
      return;
    }
    if (err?.code === 'CONFLICT_STATE' && err.reason === 'REGISTRATION_REFUSED') {
      setBanner(t('ui.cafe.form.spam')); // CAF-026
      return;
    }
    if (err?.code === 'CONFLICT_STATE' && err.reason && hasMessage(`ui.error.reason.${err.reason}`)) {
      setBanner(t(`ui.error.reason.${err.reason}` as never));
      return;
    }
    if (err?.code === 'RATE_LIMITED') {
      setBanner(t('ui.error.RATE_LIMITED'));
      return;
    }
    setBanner(err?.code === 'INTERNAL_ERROR' ? t('ui.error.INTERNAL_ERROR', { identifiant: err.requestId }) : t('ui.error.BAD_REQUEST'));
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  if (done) {
    const when = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: done.timezone }).format(new Date(done.startsAt));
    const hour = (iso: string) =>
      new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: done.timezone }).format(new Date(iso)).replace(':00', ' h').replace(':', ' h ');
    return (
      <div className={s.done} role="status" aria-live="polite">
        {done.outcome === 'SENT' ? (
          <p className={s.doneTitle}>{t('ui.cafe.form.doneAnonymous')}</p>
        ) : done.status === 'WAITLISTED' ? (
          <p className={s.doneTitle}>{t('ui.cafe.form.doneWaitlist')}</p>
        ) : (
          <>
            {done.outcome === 'UPDATED' ? <p>{t('ui.cafe.form.doneUpdated')}</p> : null}
            <p className={s.doneTitle}>
              {done.seats > 1 ? t('ui.cafe.form.doneTitleN', { prenom: done.firstName, n: done.seats }) : t('ui.cafe.form.doneTitle', { prenom: done.firstName })}
            </p>
            <p>{t('ui.cafe.form.doneWhen', { date: when, debut: hour(done.startsAt), fin: hour(done.endsAt) })}</p>
            {done.venue ? (
              <p>
                <strong>{done.venue.name}</strong>, {done.venue.address}
                {done.venue.notes ? <span className={s.muted}> — {done.venue.notes}</span> : null}
              </p>
            ) : null}
            {done.accessCode ? <p className={s.code}>{t('ui.cafe.form.doneCode', { code: done.accessCode })}</p> : null}
            <p className={s.muted}>{t('ui.cafe.form.doneEmail')}</p>
          </>
        )}
        <div className={s.doneButtons}>
          {done.icsUrl ? (
            <a href={done.icsUrl} className={buttonClass('secondary', 'M')} download>
              <ButtonInner size="M" icon="calendar">
                {t('ui.cafe.form.agenda')}
              </ButtonInner>
            </a>
          ) : null}
          {done.manageUrl ? (
            <Link href={done.manageUrl} className={buttonClass('secondary', 'M')}>
              <ButtonInner size="M">{t('ui.cafe.form.manage')}</ButtonInner>
            </Link>
          ) : null}
          <Link href="/programmes" className={buttonClass('tertiary', 'M')}>
            <ButtonInner size="M">{t('ui.cafe.form.discover')}</ButtonInner>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={onSubmit} noValidate>
      <div ref={summaryRef}>
        <ErrorSummary errors={errors} labels={labels} />
      </div>
      {banner ? (
        <p className={s.formBanner} role="alert">
          <Icon name="status-error" size={20} />
          {banner}
        </p>
      ) : null}
      {partial ? (
        <div className={s.partial} role="alert">
          <p>{partial.left > 0 ? t('ui.cafe.form.onlyLeft', { n: partial.left }) : t('ui.cafe.form.justFull')}</p>
          <div className={s.doneButtons}>
            {partial.left > 0 ? (
              <Button variant="primary" size="M" onClick={() => void send({ seats: partial.left, waitlist: false })} pending={pending}>
                {t('ui.cafe.form.reserveN', { n: partial.left })}
              </Button>
            ) : null}
            <Button variant="secondary" size="M" onClick={() => void send({ waitlist: true })} pending={pending}>
              {partial.left > 0 ? t('ui.cafe.form.waitlistN', { n: v.seats }) : t('ui.cafe.form.waitlistOnly')}
            </Button>
          </div>
        </div>
      ) : null}
      <div className={s.row}>
        <TextField id={`${id}-firstName`} label={t('ui.cafe.form.firstName')} autoComplete="given-name" value={v.firstName} onChange={(e) => set({ firstName: e.target.value })} error={errors[`${id}-firstName`]} maxLength={80} />
        <TextField id={`${id}-lastName`} label={t('ui.cafe.form.lastName')} autoComplete="family-name" value={v.lastName} onChange={(e) => set({ lastName: e.target.value })} error={errors[`${id}-lastName`]} maxLength={80} />
      </div>
      <TextField
        id={`${id}-email`}
        type="email"
        inputMode="email"
        label={t('ui.cafe.form.email')}
        hint={t('ui.cafe.form.emailHint')}
        autoComplete="email"
        placeholder={t('ui.common.placeholder.email')}
        value={v.email}
        onChange={(e) => set({ email: e.target.value })}
        error={errors[`${id}-email`]}
      />
      <TextField
        id={`${id}-phone`}
        type="tel"
        inputMode="tel"
        label={t('ui.cafe.form.phone')}
        optional
        autoComplete="tel"
        placeholder={t('ui.common.placeholder.phone')}
        value={v.phone}
        onChange={(e) => set({ phone: e.target.value })}
        error={errors[`${id}-phone`]}
      />
      {v.phone.trim() ? <CheckboxField id={`${id}-wa`} label={t('ui.cafe.form.whatsapp')} checked={v.whatsappOptIn} onChange={(x) => set({ whatsappOptIn: x })} /> : null}
      <SelectField id={`${id}-seats`} label={t('ui.cafe.form.seats')} value={v.seats} onChange={(e) => set({ seats: Number(e.target.value) })}>
        {Array.from({ length: Math.max(1, maxSeats) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {t('ui.cafe.form.seatsOption', { n })}
          </option>
        ))}
      </SelectField>
      <fieldset className={s.fieldset}>
        <legend>
          {t('ui.cafe.form.topics')} <span className={s.muted}>{t('ui.common.optional')}</span>
        </legend>
        {TOPICS.filter((tp) => islamicEnabled || tp !== 'ISLAMIC_FINANCING').map((tp) => (
          <CheckboxField
            key={tp}
            id={`${id}-topic-${tp}`}
            label={t(TOPIC_KEY[tp])}
            checked={v.topics.includes(tp)}
            onChange={(x) => set({ topics: x ? [...v.topics, tp] : v.topics.filter((y) => y !== tp) })}
          />
        ))}
      </fieldset>
      <TextArea id={`${id}-questions`} label={t('ui.cafe.form.questions')} optional maxLength={1000} counter value={v.questions} onChange={(e) => set({ questions: e.target.value })} />
      <CheckboxField
        id={`${id}-consent`}
        checked={v.consent}
        onChange={(x) => set({ consent: x })}
        error={errors[`${id}-consent`]}
        label={
          <>
            {/* MOD-106 — the exact proof sentence stored by the server, link in place of its marker. */}
            {LeadConsentWording[CURRENT_CAFE_CONTACT_CONSENT_KEY].text.replace(' [Politique de confidentialité]', '')}{' '}
            <a href="/confidentialite" target="_blank" rel="noopener">
              {t('ui.cafe.form.privacy')}
            </a>
          </>
        }
      />
      <CheckboxField id={`${id}-news`} label={LeadConsentWording[CURRENT_MARKETING_CONSENT_KEY].text} checked={v.marketingOptIn} onChange={(x) => set({ marketingOptIn: x })} />
      <Honeypot name={LEAD_HONEYPOT_FIELD} value={honeypot} onChange={setHoneypot} />
      <Button type="submit" variant="primary" size="L" fullWidth pending={pending} chevron>
        {waitlist ? t('ui.cafe.form.submitWaitlist') : t('ui.cafe.form.submit')}
      </Button>
      <p className={s.muted}>{t('ui.cafe.form.euHosting')}</p>
    </form>
  );
}
