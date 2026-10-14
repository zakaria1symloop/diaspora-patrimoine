'use client';
// SIM-032 — actions on a result: « Être rappelé par un conseiller » (DEM-016 form unfolded under the actions; the DEM-023
// confirmation replaces it, the result staying on screen), « Recevoir par e-mail » (address « la vôtre, ou celle d'un
// proche », C_SIMULATION_RESULT with the PDF), « Enregistrer » (written at once, then « Créez votre espace pour la
// retrouver »: the id travels in the sign-up / sign-in links), « Télécharger (PDF) » (nothing written).
// The simulation is written first when an action needs it (`ensureId`), SIM-032 « Routes ».
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useClientSession } from '@/lib/session-client';
import {
  CURRENT_CONTACT_CONSENT_KEY,
  CURRENT_MARKETING_CONSENT_KEY,
  LEAD_HONEYPOT_FIELD,
  LEAD_SHORT_LIMIT_SECONDS,
  type LeadSubmitResponse,
  type PublicSettings,
} from '@dp/contracts';
import { Button, Icon, buttonClass, ButtonInner } from '@dp/ui';
import { formatPhone } from '@/lib/contact';
import { usePublicForm } from '@/lib/public-form';
import { trackingPayload, recordOrigin } from '@/lib/tracking';
import { t } from '@/lib/i18n';
import { CheckboxField, Honeypot, TextField } from '@/components/forms/fields';
import { CallbackWhen, ConsentBlock, PhoneField, SignedInConsent, SignedInContact, askedOf, contactOf, signedInConsentWire, useSignedInClient } from '@/components/forms/lead-parts';
import { LeadDone } from '@/components/forms/LeadDone';
import { fieldMessage, postJson, useDownload } from './shared';
import s from './sim.module.css';

export interface ResultActionsProps {
  settings: PublicSettings;
  /** Returns the id of the simulation, writing it when it is not yet (credit: `isSaved` as asked). */
  ensureId: (isSaved: boolean) => Promise<string | null>;
  pdfBody: () => unknown;
  propertyReference?: string | null;
  /** « Voir les biens dans mon budget » (catalogue filtered). */
  budgetLink?: { href: string; label: string } | null;
  /** Bumped by the page to unfold the callback form (SIM-014 « Être rappelé par un conseiller »). */
  openCallback?: number;
  children?: ReactNode;
}

type Panel = 'none' | 'email' | 'callback';

export function ResultActions({ settings, ensureId, pdfBody, propertyReference, budgetLink, openCallback = 0, children }: ResultActionsProps) {
  const id = useId();
  const [panel, setPanel] = useState<Panel>('none');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'pdf' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const download = useDownload();
  const panelRef = useRef<HTMLDivElement>(null);
  const signedIn = useClientSession().status === 'authenticated';

  useEffect(() => {
    if (openCallback > 0) {
      setPanel('callback');
      window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, [openCallback]);

  async function save() {
    setBusy('save');
    setMessage(null);
    const sim = await ensureId(true);
    const res = sim ? await postJson<{ id: string }>(`/api/v1/public/simulations/${sim}/save`, {}) : null;
    setBusy(null);
    if (res?.ok) setSavedId(sim);
    // SFA-012 — thirty saved simulations at most (signed in).
    else if (res && !res.ok && res.error?.reason === 'SIMULATIONS_LIMIT') setMessage({ tone: 'error', text: t('ui.clientTools.simulations.limit') });
    else setMessage({ tone: 'error', text: t('ui.sim.actions.failed') });
  }

  async function pdf() {
    setBusy('pdf');
    setMessage(null);
    const r = await download(pdfBody());
    setBusy(null);
    if (r === 'limit') setMessage({ tone: 'error', text: t('ui.sim.actions.pdfLimit') });
    else if (r === 'error') setMessage({ tone: 'error', text: t('ui.sim.actions.failed') });
  }

  return (
    <section className={s.actions} aria-labelledby={`${id}-titre`}>
      <h2 id={`${id}-titre`} className={s.subTitle}>
        {t('ui.sim.actions.title')}
      </h2>
      <div className={s.actionRow}>
        <button type="button" className={buttonClass(panel === 'callback' ? 'secondary' : 'primary', 'M')} aria-expanded={panel === 'callback'} onClick={() => setPanel(panel === 'callback' ? 'none' : 'callback')}>
          <ButtonInner size="M" icon="phone">
            {t('ui.sim.actions.callback')}
          </ButtonInner>
        </button>
        <button type="button" className={buttonClass('secondary', 'M')} aria-expanded={panel === 'email'} onClick={() => setPanel(panel === 'email' ? 'none' : 'email')}>
          <ButtonInner size="M" icon="mail">
            {t('ui.sim.actions.email')}
          </ButtonInner>
        </button>
        <button type="button" className={buttonClass('tertiary', 'M')} onClick={save} disabled={busy === 'save' || savedId !== null}>
          <ButtonInner size="M" icon="heart">
            {t('ui.sim.actions.save')}
          </ButtonInner>
        </button>
        <button type="button" className={buttonClass('tertiary', 'M')} onClick={pdf} disabled={busy === 'pdf'}>
          <ButtonInner size="M" icon="download">
            {t('ui.sim.actions.pdf')}
          </ButtonInner>
        </button>
        {budgetLink ? (
          <Link href={budgetLink.href} className={buttonClass('tertiary', 'M')}>
            <ButtonInner size="M" chevron>
              {budgetLink.label}
            </ButtonInner>
          </Link>
        ) : null}
        {children}
      </div>
      {message ? (
        <p className={message.tone === 'ok' ? s.success : s.banner} role="alert">
          <Icon name={message.tone === 'ok' ? 'status-success' : 'status-error'} size={20} />
          {message.text}
        </p>
      ) : null}
      {savedId && signedIn ? (
        // SIM-032 — signed in: saved in « Mes simulations » (attached to the open dossier by the API).
        <div className={s.panel} role="status">
          <p className={s.success}>
            <Icon name="status-success" size={20} />
            {t('ui.clientTools.simulations.savedSignedIn')}
          </p>
          <div className={s.buttons}>
            <Link href="/espace-client/simulations" className={buttonClass('primary', 'M')}>
              <ButtonInner size="M" chevron>
                {t('ui.clientTools.simulations.seeList')}
              </ButtonInner>
            </Link>
          </div>
        </div>
      ) : savedId ? (
        <div className={s.panel} role="status">
          <p className={s.success}>
            <Icon name="status-success" size={20} />
            {t('ui.sim.actions.saved')}
          </p>
          <p className={s.subTitle}>{t('ui.sim.actions.createSpace')}</p>
          <div className={s.buttons}>
            <Link href={`/inscription?simulation=${savedId}`} className={buttonClass('primary', 'M')}>
              <ButtonInner size="M" chevron>
                {t('ui.sim.actions.createSpaceButton')}
              </ButtonInner>
            </Link>
            <Link href={`/connexion?simulation=${savedId}`} className={buttonClass('secondary', 'M')}>
              <ButtonInner size="M">{t('ui.sim.actions.login')}</ButtonInner>
            </Link>
          </div>
        </div>
      ) : null}
      <div ref={panelRef}>
        {panel === 'email' ? <EmailPanel ensureId={ensureId} /> : null}
        {panel === 'callback' ? <FollowupForm settings={settings} ensureId={ensureId} propertyReference={propertyReference ?? null} onClose={() => setPanel('none')} /> : null}
      </div>
    </section>
  );
}

function EmailPanel({ ensureId }: { ensureId: (isSaved: boolean) => Promise<string | null> }) {
  const id = useId();
  const [email, setEmail] = useState('');
  // a signed-in client: his account's address, prefilled and still editable
  const session = useClientSession();
  const accountEmail = session.status === 'authenticated' ? session.me.email : null;
  useEffect(() => {
    if (accountEmail) setEmail((e) => e || accountEmail);
  }, [accountEmail]);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'pending' | 'sent'>('idle');
  const [banner, setBanner] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    if (!email.trim()) return setError(t('ui.validation.REQUIRED'));
    setError(null);
    setState('pending');
    const sim = await ensureId(false);
    if (!sim) {
      setState('idle');
      return setBanner(t('ui.sim.actions.failed'));
    }
    const res = await postJson<null>(`/api/v1/public/simulations/${sim}/email`, { email });
    if (res.ok) {
      setSentTo(email.trim().toLowerCase());
      setState('sent');
      return;
    }
    setState('idle');
    if (res.error?.code === 'VALIDATION_ERROR') setError(fieldMessage(res.error.details[0]?.code ?? 'INVALID_EMAIL'));
    else if (res.error?.code === 'RATE_LIMITED') setBanner(t('ui.sim.actions.emailLimit'));
    else setBanner(t('ui.sim.actions.failed'));
  }

  if (state === 'sent') {
    return (
      <p className={s.success} role="status">
        <Icon name="status-success" size={20} />
        {t('ui.sim.actions.emailSent', { email: sentTo })}
      </p>
    );
  }
  return (
    <form className={s.panel} onSubmit={submit} noValidate>
      {banner ? (
        <p className={s.banner} role="alert">
          <Icon name="status-error" size={20} />
          {banner}
        </p>
      ) : null}
      <div className={s.emailRow}>
        <TextField
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          label={t('ui.sim.actions.emailLabel')}
          hint={t('ui.sim.actions.emailHint')}
          placeholder={t('ui.common.placeholder.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <Button type="submit" variant="primary" size="M" pending={state === 'pending'}>
          {t('ui.sim.actions.emailSend')}
        </Button>
      </div>
      <p className={s.legal}>{t('ui.sim.actions.emailPromise')}</p>
    </form>
  );
}

/** DEM-016 — Prénom · Nom · E-mail · Téléphone (case WhatsApp) · Quand vous appeler ? · Consentement. */
function FollowupForm({
  settings,
  ensureId,
  propertyReference,
  onClose,
}: {
  settings: PublicSettings;
  ensureId: (isSaved: boolean) => Promise<string | null>;
  propertyReference: string | null;
  onClose: () => void;
}) {
  const id = useId();
  const { submit } = usePublicForm('SIMULATION_FOLLOWUP');
  const [v, setV] = useState({ firstName: '', lastName: '', email: '', phone: '', whatsapp: false, day: '', slot: '', consent: false, marketing: false, createAccount: false });
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<LeadSubmitResponse | null>(null);
  const me = useSignedInClient(); // DEM-022
  const asked = askedOf(me);
  useEffect(() => recordOrigin(), []);

  async function send(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    const c = contactOf(me, v);
    if (!c.firstName.trim()) local.firstName = t('ui.validation.REQUIRED');
    if (!c.lastName.trim()) local.lastName = t('ui.validation.REQUIRED');
    if (!c.email.trim()) local.email = t('ui.validation.REQUIRED');
    if (!c.phone) local.phone = t('ui.validation.REQUIRED');
    if (!me && !v.consent) local.consentContact = t('ui.validation.MUST_ACCEPT');
    setErrors(local);
    setBanner(null);
    if (Object.keys(local).length) return;
    setPending(true);
    const simulationId = await ensureId(false);
    if (!simulationId) {
      setPending(false);
      return setBanner(t('ui.sim.actions.failed'));
    }
    const res = await submit<LeadSubmitResponse>('/api/v1/public/leads', {
      form: 'SIMULATION_FOLLOWUP',
      simulationId,
      fields: {
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        whatsappOptIn: v.whatsapp,
        preferredCallbackDate: v.day || null,
        preferredSlot: v.slot || null,
        ...(me
          ? signedInConsentWire()
          : { consentContact: v.consent, consentKey: CURRENT_CONTACT_CONSENT_KEY, marketingOptIn: v.marketing, marketingKey: CURRENT_MARKETING_CONSENT_KEY }),
        createAccount: me ? false : v.createAccount,
      },
      context: propertyReference ? { propertyReference } : {},
      tracking: trackingPayload(),
      [LEAD_HONEYPOT_FIELD]: honeypot,
    });
    setPending(false);
    if (res.ok) return setDone(res.data);
    if (res.offline) return setBanner(t('ui.common.offline'));
    const err = res.error;
    if (err?.code === 'VALIDATION_ERROR') {
      const out: Record<string, string> = {};
      for (const d of err.details) out[d.field.replace(/^fields\./, '')] = fieldMessage(d.code, d.params as Record<string, unknown> | null);
      if (out.simulationId) setBanner(t('ui.sim.actions.failed'));
      return setErrors(out);
    }
    if (err?.code === 'RATE_LIMITED') {
      const seconds = Number((err.params as { retryAfterSeconds?: number } | null)?.retryAfterSeconds ?? res.retryAfter ?? 0);
      const contact = settings['contact.email'] || settings['contact.phone'];
      return setBanner(
        seconds > LEAD_SHORT_LIMIT_SECONDS ? (contact ? t('ui.lead.errors.longLimitContact', { contact }) : t('ui.lead.errors.longLimit')) : t('ui.error.RATE_LIMITED'),
      );
    }
    setBanner(res.status >= 500 ? t('ui.error.INTERNAL_ERROR', { identifiant: err?.requestId ?? '' }) : t('ui.error.BAD_REQUEST'));
  }

  if (done) {
    return (
      <div className={s.panel}>
        <LeadDone
          result={done}
          firstContactBusinessDays={settings['sla.firstContactBusinessDays']}
          contactEmail={settings['contact.email']}
          contactPhone={settings['contact.phone'] ? formatPhone(settings['contact.phone']) : ''}
          onContinue={onClose}
        />
      </div>
    );
  }
  return (
    <form className={s.panel} onSubmit={send} noValidate aria-label={t('ui.sim.actions.callback')}>
      <p className={s.info}>
        <Icon name="status-info" size={20} />
        {t('ui.sim.actions.callbackNote')}
      </p>
      {banner ? (
        <p className={s.banner} role="alert">
          <Icon name="status-error" size={20} />
          {banner}
        </p>
      ) : null}
      {me ? <SignedInContact me={me} /> : null}
      {asked.name ? (
      <div className={s.row}>
        <TextField id={`${id}-fn`} label={t('ui.lead.fields.firstName')} autoComplete="given-name" value={v.firstName} onChange={(e) => set({ firstName: e.target.value })} error={errors.firstName} />
        <TextField id={`${id}-ln`} label={t('ui.lead.fields.lastName')} autoComplete="family-name" value={v.lastName} onChange={(e) => set({ lastName: e.target.value })} error={errors.lastName} />
      </div>
      ) : null}
      {asked.email ? (
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
      ) : null}
      {asked.phone ? <PhoneField id={`${id}-phone`} value={v.phone} onChange={(phone) => set({ phone })} error={errors.phone} /> : null}
      {contactOf(me, v).phone ? <CheckboxField id={`${id}-wa`} label={t('ui.lead.fields.whatsapp')} checked={v.whatsapp} onChange={(whatsapp) => set({ whatsapp })} /> : null}
      <CallbackWhen settings={settings} day={v.day} slot={v.slot} idPrefix={id} onChange={(p) => set(p)} />
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
      <Honeypot name={LEAD_HONEYPOT_FIELD} value={honeypot} onChange={setHoneypot} />
      <Button type="submit" variant="primary" size="L" chevron pending={pending}>
        {t('ui.sim.actions.callbackSubmit')}
      </Button>
    </form>
  );
}
