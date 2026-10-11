'use client';
// EP-33 — the partner space: sign-in (and its address step) when there is no partner session; then the application
// according to its state (ACP-083): file to complete (three sections saved one by one, ACP-087), under review, complement
// asked, accepted, declined. Always the block « Une question ? » (the team can help complete the file).
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AUDIENCE_HEADER,
  CSRF_HEADER,
  csrfCookieName,
  PARTNER_FILE_RULES,
  type PartnerApplicationResponse,
  type PartnerFileSlot,
  type PartnerUploadResponse,
} from '@dp/contracts';
import { Button, Icon } from '@dp/ui';
import { apiCall, signOut } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import { CheckboxField, TextArea, TextField } from '../forms/fields';
import { useCountries } from '../forms/lead-parts';
import { Banner, ContactLine, errorMessage, fieldErrors, type ContactInfo } from './kit';
import { LoginFlow } from './LoginFlow';
import s from './auth.module.css';
import { sha256Hex as sha256OfBytes } from '@dp/ui';

const P = { audience: 'PARTNER' as const, retryOnAuth: true };

export function PartnerSpace({ contact }: { contact: ContactInfo }) {
  const [app, setApp] = useState<PartnerApplicationResponse | null | undefined>(undefined);

  const load = useCallback(async () => {
    const r = await apiCall<PartnerApplicationResponse>('/partner/application', P);
    setApp(r.ok ? r.data : null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (app === undefined) return <p className={s.muted}>{t('ui.auth.common.loading')}</p>;
  if (app === null) {
    return (
      <LoginFlow
        audience="PARTNER"
        next={null}
        simulationId={null}
        contact={contact}
        onSession={() => void load()}
        forgotHref="/partenaires/mot-de-passe-oublie"
        eyebrow={t('ui.auth.partner.eyebrow')}
        title={t('ui.auth.partner.login.title')}
        intro={t('ui.auth.partner.login.intro')}
        footer={
          <>
            <p className={s.door}>
              {t('ui.auth.partner.login.signupPrompt')}
              <Link href="/partenaires/inscription" className={s.link}>
                {t('ui.auth.partner.login.signup')}
              </Link>
            </p>
            <p className={s.door}>
              {t('ui.auth.common.clientDoor')}
              <Link href="/connexion" className={s.link}>
                {t('ui.auth.common.clientDoorLink')}
              </Link>
            </p>
          </>
        }
      />
    );
  }
  return <Application app={app} onChange={setApp} contact={contact} onLogout={() => setApp(null)} />;
}

function Question({ contact }: { contact: ContactInfo }) {
  return (
    <div className={s.section}>
      <span className={s.sectionHead}>
        <span>
          <Icon name="chat" size={20} /> {t('ui.auth.partner.question')}
        </span>
      </span>
      <p className={s.muted}>{t('ui.auth.partner.questionText')}</p>
      <p className={s.contact}>
        {contact.phone ? <a href={`tel:${contact.phone}`}>{contact.phoneLabel}</a> : null}
        {contact.phone && contact.email ? <span aria-hidden="true">·</span> : null}
        {contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}
      </p>
    </div>
  );
}

function Application({ app, onChange, contact, onLogout }: { app: PartnerApplicationResponse; onChange: (a: PartnerApplicationResponse) => void; contact: ContactInfo; onLogout: () => void }) {
  const [open, setOpen] = useState<'activity' | 'documents' | 'image' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const editable = app.status === 'DRAFT' || app.status === 'INFO_REQUESTED';

  async function submit() {
    setPending(true);
    setError(null);
    const r = await apiCall<PartnerApplicationResponse>('/partner/application/submit', { ...P, method: 'POST' });
    setPending(false);
    if (r.ok) return onChange(r.data);
    setError(errorMessage(r.error, r));
  }

  async function logout() {
    await signOut('PARTNER');
    onLogout();
  }

  const header = (
    <span className={s.eyebrow}>
      <Icon name="partners" size={16} />
      {t('ui.auth.partner.eyebrow')} · {app.companyName}
    </span>
  );
  const footer = (
    <>
      <Question contact={contact} />
      <button type="button" className={s.link} onClick={() => void logout()}>
        <Icon name="logout" size={16} /> {t('ui.auth.space.logout')}
      </button>
    </>
  );

  if (app.status === 'EMAIL_UNVERIFIED') {
    return (
      <>
        {header}
        <h1 className={s.title}>{t('ui.auth.verifyWait.title')}</h1>
        <p className={s.intro}>{t('ui.auth.partner.verifyWait')}</p>
        {footer}
      </>
    );
  }
  if (app.status === 'SUBMITTED') {
    return (
      <>
        {header}
        <h1 className={s.title}>{t('ui.auth.partner.app.review.title')}</h1>
        <p className={s.intro}>{t('ui.auth.partner.app.review.delay', { n: app.reviewDays })}</p>
        <Summary app={app} />
        {footer}
      </>
    );
  }
  if (app.status === 'APPROVED') {
    return (
      <>
        {header}
        <h1 className={s.title}>{t('ui.auth.partner.app.approved.title')}</h1>
        <p className={s.intro}>{t('ui.auth.partner.app.approved.text')}</p>
        <p className={s.muted}>{t('ui.auth.partner.app.approved.next')}</p>
        {footer}
      </>
    );
  }
  if (app.status === 'DECLINED') {
    return (
      <>
        {header}
        <h1 className={s.title}>{t('ui.auth.partner.app.declined.title')}</h1>
        {app.teamMessage ? <p className={s.intro}>{app.teamMessage}</p> : null}
        <Link href="/contact" className={s.link}>
          {t('ui.auth.partner.app.declined.write')}
        </Link>
        {footer}
      </>
    );
  }

  return (
    <>
      {header}
      <h1 className={s.title}>{app.firstName ? t('ui.auth.partner.app.welcome', { prenom: app.firstName }) : t('ui.auth.partner.app.welcomeNoName')}</h1>
      {app.status === 'INFO_REQUESTED' ? (
        <Banner tone="info">
          <p>
            <strong>{t('ui.auth.partner.app.info.title')}</strong>
          </p>
          {app.teamMessage ? <p>{app.teamMessage}</p> : null}
        </Banner>
      ) : null}
      <p className={s.steps}>{t('ui.auth.partner.app.progress', { n: app.requiredDone })}</p>
      <div className={s.progress} aria-hidden="true">
        <span style={{ width: `${(app.requiredDone / 2) * 100}%` }} />
      </div>
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      <Section title={t('ui.auth.partner.app.activity.title')} done={app.sections.activity.complete} open={open === 'activity'} onToggle={() => setOpen(open === 'activity' ? null : 'activity')} editable={editable}>
        <ActivityForm
          app={app}
          onSaved={(a) => {
            onChange(a);
            setNotice(t('ui.auth.partner.app.saved'));
            setOpen(null);
          }}
        />
      </Section>
      <Section title={t('ui.auth.partner.app.documents.title')} done={app.sections.documents.complete} open={open === 'documents'} onToggle={() => setOpen(open === 'documents' ? null : 'documents')} editable={editable}>
        <FileSlot app={app} slot="REGISTRATION" label={app.partnerKind === 'BANK' ? t('ui.auth.partner.app.documents.license') : t('ui.auth.partner.app.documents.registration')} hint={t('ui.auth.partner.app.documents.registrationHint')} onChange={onChange} />
        <FileSlot app={app} slot="PRESENTATION" label={t('ui.auth.partner.app.documents.presentation')} hint={t('ui.auth.partner.app.documents.presentationHint')} onChange={onChange} optional />
      </Section>
      <Section
        title={t('ui.auth.partner.app.image.title')}
        done={app.sections.image.complete}
        open={open === 'image'}
        onToggle={() => setOpen(open === 'image' ? null : 'image')}
        editable={editable}
        optional
      >
        <FileSlot app={app} slot="LOGO" label={t('ui.auth.partner.app.image.logo')} hint={t('ui.auth.partner.app.image.logoHint')} onChange={onChange} optional />
        <ImageForm
          app={app}
          onSaved={(a) => {
            onChange(a);
            setNotice(t('ui.auth.partner.app.saved'));
          }}
        />
      </Section>

      {app.status === 'INFO_REQUESTED' ? (
        <AdditionForm onSent={onChange} />
      ) : (
        <>
          <Button size="L" fullWidth chevron disabled={!app.canSubmit} pending={pending} onClick={() => void submit()}>
            {t('ui.auth.partner.app.submit')}
          </Button>
          {!app.canSubmit ? <p className={s.muted}>{t('ui.auth.partner.app.submitHint')}</p> : null}
        </>
      )}
      {footer}
    </>
  );
}

function Section({ title, done, open, onToggle, editable, optional, children }: { title: string; done: boolean; open: boolean; onToggle: () => void; editable: boolean; optional?: boolean; children: React.ReactNode }) {
  const id = useId();
  return (
    <section className={s.section} aria-labelledby={`${id}-t`}>
      <div className={s.sectionHead}>
        <span id={`${id}-t`}>
          {title} {optional ? <span className={s.muted}>{t('ui.auth.partner.app.optional')}</span> : null}
        </span>
        <span className={s.state} data-done={done}>
          <Icon name={done ? 'status-success' : 'clock'} size={16} />
          {done ? t('ui.auth.partner.app.done') : t('ui.auth.partner.app.todo')}
        </span>
      </div>
      {editable ? (
        <button type="button" className={s.link} aria-expanded={open} onClick={onToggle}>
          {open ? t('ui.auth.verifyWait.cancel') : done ? t('ui.auth.partner.app.edit') : t('ui.auth.partner.app.todo')}
        </button>
      ) : null}
      {open ? children : null}
    </section>
  );
}

function ActivityForm({ app, onSaved }: { app: PartnerApplicationResponse; onSaved: (a: PartnerApplicationResponse) => void }) {
  const v = (app.sections.activity.values ?? {}) as Record<string, unknown>;
  const bank = app.partnerKind === 'BANK';
  const countries = useCountries();
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>(v);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!bank) void apiCall<{ data: { id: string; name: string }[] }>('/partner/regions', P).then((r) => r.ok && setRegions(r.data.data));
  }, [bank]);

  const set = (k: string, val: unknown) => setValues((x) => ({ ...x, [k]: val }));
  const toggle = (k: string, item: string) => {
    const list = Array.isArray(values[k]) ? (values[k] as string[]) : [];
    set(k, list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };
  const list = (k: string) => (Array.isArray(values[k]) ? (values[k] as string[]) : []);
  const str = (k: string) => (values[k] === undefined || values[k] === null ? '' : String(values[k]));

  async function save(e: FormEvent) {
    e.preventDefault();
    const body = bank
      ? { licenseNumber: str('licenseNumber'), financingTypes: list('financingTypes'), clientCountries: list('clientCountries'), agency: str('agency'), website: str('website') }
      : { registrationNumber: str('registrationNumber'), foundedYear: Number(str('foundedYear')) || null, ongoingPrograms: str('ongoingPrograms') === '' ? null : Number(str('ongoingPrograms')), regionIds: list('regionIds'), website: str('website') };
    setPending(true);
    setError(null);
    const r = await apiCall<PartnerApplicationResponse>('/partner/application/sections/activity', { ...P, method: 'PATCH', body });
    setPending(false);
    if (r.ok) return onSaved(r.data);
    const fe = fieldErrors(r.error);
    setErrors(fe);
    if (!Object.keys(fe).length) setError(errorMessage(r.error, r));
  }

  return (
    <form className={s.form} onSubmit={save} noValidate>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {bank ? (
        <>
          <TextField id={`${id}-lic`} label={t('ui.auth.partner.app.activity.licenseNumber')} value={str('licenseNumber')} onChange={(e) => set('licenseNumber', e.target.value)} error={errors.licenseNumber} />
          <fieldset className={s.section}>
            <legend className={s.sectionHead}>{t('ui.auth.partner.app.activity.financingTypes')}</legend>
            <CheckboxField id={`${id}-classic`} label={t('ui.auth.partner.app.activity.classic')} checked={list('financingTypes').includes('CLASSIC')} onChange={() => toggle('financingTypes', 'CLASSIC')} />
            <CheckboxField id={`${id}-islamic`} label={t('ui.auth.partner.app.activity.islamic')} checked={list('financingTypes').includes('ISLAMIC')} onChange={() => toggle('financingTypes', 'ISLAMIC')} error={errors.financingTypes} />
          </fieldset>
          <fieldset className={s.section}>
            <legend className={s.sectionHead}>{t('ui.auth.partner.app.activity.clientCountries')}</legend>
            <p className={s.muted}>{t('ui.auth.partner.app.activity.pickHint')}</p>
            <div className={s.checks}>
              {countries.filter((c) => c.frequent).concat(countries.filter((c) => !c.frequent)).map((c) => (
                <CheckboxField key={c.code} id={`${id}-c-${c.code}`} label={c.name} checked={list('clientCountries').includes(c.code)} onChange={() => toggle('clientCountries', c.code)} />
              ))}
            </div>
            {errors.clientCountries ? <Banner tone="error">{errors.clientCountries}</Banner> : null}
          </fieldset>
          <TextField id={`${id}-agency`} label={t('ui.auth.partner.app.activity.agency')} optional value={str('agency')} onChange={(e) => set('agency', e.target.value)} error={errors.agency} />
        </>
      ) : (
        <>
          <TextField id={`${id}-rc`} label={t('ui.auth.partner.app.activity.registrationNumber')} value={str('registrationNumber')} onChange={(e) => set('registrationNumber', e.target.value)} error={errors.registrationNumber} />
          <div className={s.row}>
            <TextField id={`${id}-year`} label={t('ui.auth.partner.app.activity.foundedYear')} inputMode="numeric" value={str('foundedYear')} onChange={(e) => set('foundedYear', e.target.value.replace(/\D/g, '').slice(0, 4))} error={errors.foundedYear} />
            <TextField id={`${id}-prog`} label={t('ui.auth.partner.app.activity.ongoingPrograms')} inputMode="numeric" value={str('ongoingPrograms')} onChange={(e) => set('ongoingPrograms', e.target.value.replace(/\D/g, '').slice(0, 3))} error={errors.ongoingPrograms} />
          </div>
          <fieldset className={s.section}>
            <legend className={s.sectionHead}>{t('ui.auth.partner.app.activity.regions')}</legend>
            <p className={s.muted}>{t('ui.auth.partner.app.activity.pickHint')}</p>
            <div className={s.checks}>
              {regions.map((r) => (
                <CheckboxField key={r.id} id={`${id}-r-${r.id}`} label={r.name} checked={list('regionIds').includes(r.id)} onChange={() => toggle('regionIds', r.id)} />
              ))}
            </div>
            {errors.regionIds ? <Banner tone="error">{errors.regionIds}</Banner> : null}
          </fieldset>
        </>
      )}
      <TextField id={`${id}-web`} label={t('ui.auth.partner.app.activity.website')} optional type="url" inputMode="url" value={str('website')} onChange={(e) => set('website', e.target.value)} error={errors.website} />
      <Button type="submit" size="M" pending={pending}>
        {t('ui.auth.partner.app.save')}
      </Button>
    </form>
  );
}

function ImageForm({ app, onSaved }: { app: PartnerApplicationResponse; onSaved: (a: PartnerApplicationResponse) => void }) {
  const v = (app.sections.image.values ?? {}) as { presentation?: string; message?: string };
  const [presentation, setPresentation] = useState(v.presentation ?? '');
  const [message, setMessage] = useState(v.message ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const id = useId();
  async function save(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const r = await apiCall<PartnerApplicationResponse>('/partner/application/sections/image', { ...P, method: 'PATCH', body: { presentation, message } });
    setPending(false);
    if (r.ok) return onSaved(r.data);
    setErrors(fieldErrors(r.error));
  }
  return (
    <form className={s.form} onSubmit={save} noValidate>
      <TextArea id={`${id}-pres`} label={t('ui.auth.partner.app.image.presentation')} optional value={presentation} onChange={(e) => setPresentation(e.target.value)} maxLength={200} counter error={errors.presentation} />
      <TextArea id={`${id}-msg`} label={t('ui.auth.partner.app.image.message')} optional value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} counter error={errors.message} />
      <Button type="submit" size="M" pending={pending}>
        {t('ui.auth.partner.app.save')}
      </Button>
    </form>
  );
}

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

async function sha256Hex(file: File): Promise<string> {
  return sha256OfBytes(await file.arrayBuffer());
}

/** API-080 — announce, send, confirm; the server checks the real type, the size and the fingerprint. */
function FileSlot({ app, slot, label, hint, onChange, optional }: { app: PartnerApplicationResponse; slot: PartnerFileSlot; label: string; hint: string; onChange: (a: PartnerApplicationResponse) => void; optional?: boolean }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = app.sections.documents.files.find((f) => f.slot === slot);
  const rule = PARTNER_FILE_RULES[slot];

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    if (f.size > rule.maxMb * 1024 * 1024) return setError(t('ui.error.FILE_TOO_LARGE', { n: rule.maxMb }));
    setBusy(true);
    try {
      const announce = await apiCall<PartnerUploadResponse>('/partner/application/uploads', { ...P, body: { slot, fileName: f.name, contentType: f.type || 'application/octet-stream', size: f.size, sha256: await sha256Hex(f) } });
      if (!announce.ok) throw announce;
      const put = await fetch(announce.data.uploadUrl, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/octet-stream', [AUDIENCE_HEADER]: 'PARTNER', [CSRF_HEADER]: readCookie(csrfCookieName('PARTNER')) ?? '' },
        body: f,
      });
      if (!put.ok) throw { ok: false, status: put.status, error: null };
      const done = await apiCall<PartnerApplicationResponse>(`/partner/application/uploads/${announce.data.id}/complete`, { ...P, body: { slot } });
      if (!done.ok) throw done;
      onChange(done.data);
    } catch (err) {
      const e = err as { error?: Parameters<typeof errorMessage>[0]; status?: number };
      const fe = fieldErrors(e.error ?? null);
      setError(Object.values(fe)[0] ?? errorMessage(e.error ?? null, { status: e.status }));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!file) return;
    const r = await apiCall<PartnerApplicationResponse>(`/partner/application/files/${file.id}`, { ...P, method: 'DELETE' });
    if (r.ok) onChange(r.data);
  }

  return (
    <div className={s.form}>
      <label htmlFor={id} className={s.sectionHead} style={{ fontWeight: 600 }}>
        <span>
          {label} {optional ? <span className={s.muted}>{t('ui.auth.partner.app.optional')}</span> : null}
        </span>
      </label>
      <span className={s.muted}>{hint}</span>
      {file ? (
        <div className={s.file}>
          <span>
            <Icon name="file" size={16} /> {file.fileName}
            {file.scanStatus === 'PENDING' ? ` · ${t('ui.auth.partner.app.documents.checking')}` : ''}
          </span>
          <button type="button" className={s.link} onClick={() => void remove()}>
            {t('ui.auth.partner.app.documents.remove')}
          </button>
        </div>
      ) : null}
      <input id={id} type="file" accept={rule.types.join(',')} disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} />
      {busy ? <p className={s.muted}>{t('ui.auth.partner.app.documents.uploading')}</p> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </div>
  );
}

function AdditionForm({ onSent }: { onSent: (a: PartnerApplicationResponse) => void }) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  async function send(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const r = await apiCall<PartnerApplicationResponse>('/partner/application/additions', { ...P, body: { message } });
    setPending(false);
    if (r.ok) return onSent(r.data);
    setError(errorMessage(r.error, r));
  }
  return (
    <form className={s.form} onSubmit={send} noValidate>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <TextArea id={`${id}-reply`} label={t('ui.auth.partner.app.info.reply')} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} counter />
      <Button type="submit" size="L" fullWidth pending={pending}>
        {t('ui.auth.partner.app.info.send')}
      </Button>
    </form>
  );
}

function Summary({ app }: { app: PartnerApplicationResponse }) {
  const files = app.sections.documents.files;
  return (
    <div className={s.section}>
      <span className={s.sectionHead}>{t('ui.auth.partner.app.review.summary')}</span>
      <ul className={s.reassure} style={{ flexDirection: 'column' }}>
        <li>
          <Icon name="building" size={16} /> {app.companyName}
        </li>
        {files.map((f) => (
          <li key={f.id}>
            <Icon name="file" size={16} /> {f.fileName}
          </li>
        ))}
      </ul>
    </div>
  );
}
