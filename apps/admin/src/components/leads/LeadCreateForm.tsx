'use client';
// CRM-025 — « + Créer › Demande »: a request received outside the site (phone, WhatsApp, e-mail, Café…). One page in
// three steps read from top to bottom — who (an existing record found by search, or a new one: the e-mail OR the
// phone, MOD-302, with the live check of known coordinates of CRM-041), what (origin, nature, property or programme,
// message), what follows (adviser — me by default —, the oral agreement, required; the news, optional; « Échange déjà
// eu avec le client » for a phone call; the confirmation e-mail, absent without an address). The column on the right
// says, as the form is filled, what will happen when it is saved. The request then follows the journey of a request
// of the site (CYC-001).
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { STAFF_LEAD_KINDS, STAFF_LEAD_SOURCES, staffLeadCreateSchema, type ContactCheck, type LeadObjectOption, type SearchResponse, type StaffLeadCreated } from '@dp/contracts';
import type { MessageKey } from '@dp/i18n';
import { Banner, Button, ErrorSummary, Icon, StatusTag, useToast } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { checkSchema, errorText, fieldErrors } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { AdvisorSelect } from '../crm/AdvisorSelect';
import { PageHeader } from '../shell/Page';
import { Checkbox, TextArea, TextInput, useUnsavedGuard } from '../shell/forms';
import { useShell } from '../shell/ShellContext';
import { leadPath } from './LeadsList';
import s from './lead-create.module.css';

type ClientChoice = { id: string; title: string; subtitle: string | null } | null;

const SOURCE_ICON: Record<string, 'phone' | 'chat' | 'mail' | 'cafe-cup' | 'partners' | 'edit'> = { PHONE: 'phone', WHATSAPP: 'chat', EMAIL: 'mail', CAFE: 'cafe-cup', PARTNER: 'partners', ADMIN: 'edit' };

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function LeadCreateForm({ countries }: { countries: { code: string; name: string }[] }) {
  const { shell, can } = useShell();
  const router = useRouter();
  const toast = useToast();
  const [key] = useState(newIdempotencyKey);
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [client, setClient] = useState<ClientChoice>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchResponse['groups'][number]['hits'] | null>(null);
  const [person, setPerson] = useState({ firstName: '', lastName: '', email: '', phone: '', whatsappOptIn: false, countryOfResidence: '' });
  const [check, setCheck] = useState<ContactCheck | null>(null);
  const [source, setSource] = useState<string>('PHONE');
  const [kind, setKind] = useState<string>('CALLBACK_REQUEST');
  const [objectQuery, setObjectQuery] = useState('');
  const [objects, setObjects] = useState<LeadObjectOption[] | null>(null);
  const [object, setObject] = useState<LeadObjectOption | null>(null);
  const [message, setMessage] = useState('');
  const [agentId, setAgentId] = useState(can('lead.process') ? shell.user.id : '');
  const [consentContact, setConsentContact] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [alreadyContacted, setAlreadyContacted] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saved = useRef(false);
  const dirty = !saved.current && Boolean(client || person.firstName || person.lastName || person.email || person.phone || message || object);
  useUnsavedGuard(dirty);

  // ─── Search of a record (BO-030 search, type CLIENT) ──────────────────────
  const q = useDebounced(query.trim());
  useEffect(() => {
    if (mode !== 'search' || q.length < 2) return setHits(null);
    const ctrl = new AbortController();
    void adminCall<SearchResponse>('/admin/search', { query: { q, types: 'CLIENT' }, signal: ctrl.signal }).then((r) => {
      if (r.ok) setHits(r.data.groups.find((g) => g.type === 'CLIENT')?.hits ?? []);
    });
    return () => ctrl.abort();
  }, [q, mode]);

  // ─── CRM-041 — known coordinates, while typing ────────────────────────────
  const email = useDebounced(person.email.trim().toLowerCase());
  const phone = useDebounced(person.phone.replace(/[\s.()-]/g, ''));
  useEffect(() => {
    if (mode !== 'new' || (!/.+@.+\..+/.test(email) && !/^\+\d{7,15}$/.test(phone))) return setCheck(null);
    const ctrl = new AbortController();
    void adminCall<ContactCheck>('/admin/clients/contact-check', { query: { email: /.+@.+\..+/.test(email) ? email : undefined, phone: /^\+\d{7,15}$/.test(phone) ? phone : undefined }, signal: ctrl.signal }).then((r) => {
      if (r.ok) setCheck(r.data);
    });
    return () => ctrl.abort();
  }, [email, phone, mode]);

  // ─── Property or programme ────────────────────────────────────────────────
  const oq = useDebounced(objectQuery.trim());
  useEffect(() => {
    if (oq.length < 2 || object) return setObjects(null);
    const ctrl = new AbortController();
    void adminCall<{ data: LeadObjectOption[] }>('/admin/lead-objects', { query: { q: oq }, signal: ctrl.signal }).then((r) => {
      if (r.ok) setObjects(r.data.data);
    });
    return () => ctrl.abort();
  }, [oq, object]);

  const hasEmail = mode === 'search' ? Boolean(client?.subtitle?.includes('@')) : Boolean(person.email.trim());
  const emailTaken = check?.email && check.email.state !== 'FREE';

  const body = useMemo(
    () => ({
      source,
      kind,
      clientId: mode === 'search' ? (client?.id ?? null) : null,
      client: mode === 'new' ? { ...person, countryOfResidence: person.countryOfResidence || null, email: person.email || null, phone: person.phone || null } : null,
      propertyId: object?.type === 'PROPERTY' ? object.id : null,
      programId: object?.type === 'PROGRAM' ? object.id : null,
      message: message || null,
      assignedAgentId: agentId || null,
      consentContact,
      marketingOptIn,
      sendConfirmation: hasEmail && sendConfirmation,
      alreadyContacted: source === 'PHONE' && alreadyContacted,
    }),
    [source, kind, mode, client, person, object, message, agentId, consentContact, marketingOptIn, sendConfirmation, alreadyContacted, hasEmail],
  );

  const labels: Record<string, string> = {
    clientId: t('ui.admin-leads.create.who'),
    'client.firstName': t('ui.admin-leads.create.firstName'),
    'client.lastName': t('ui.admin-leads.create.lastName'),
    'client.email': t('ui.admin-leads.create.email'),
    'client.phone': t('ui.admin-leads.create.phone'),
    propertyId: t('ui.admin-leads.create.object'),
    consentContact: t('ui.admin-leads.create.consentShort'),
    assignedAgentId: t('ui.admin-crm.advisor.label'),
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);
    const checked = checkSchema(staffLeadCreateSchema, body);
    if (!checked.ok) return setErrors(checked.errors);
    if (emailTaken) return setErrors({ 'client.email': t('ui.admin-leads.create.emailTaken') });
    setErrors({});
    setPending(true);
    const r = await adminCall<StaffLeadCreated>('/admin/leads', { body, idempotencyKey: key });
    setPending(false);
    if (!r.ok) {
      const fields = fieldErrors(r.error);
      if (Object.keys(fields).length) return setErrors(fields);
      return setFailure(errorText(r));
    }
    saved.current = true;
    toast({ text: t('ui.admin-leads.create.done', { reference: r.data.reference }) });
    router.push(leadPath(r.data.reference));
  }

  const summary: string[] = [];
  summary.push(agentId ? (agentId === shell.user.id ? t('ui.admin-leads.create.sumMine') : t('ui.admin-leads.create.sumAssigned')) : t('ui.admin-leads.create.sumToTake'));
  summary.push(kind === 'CONTACT_MESSAGE' ? t('ui.admin-leads.create.sumNoDossier') : t('ui.admin-leads.create.sumDossier'));
  summary.push(source === 'PHONE' && alreadyContacted ? t('ui.admin-leads.create.sumContacted') : t('ui.admin-leads.create.sumDeadline'));
  summary.push(hasEmail && sendConfirmation ? t('ui.admin-leads.create.sumAck') : t('ui.admin-leads.create.sumNoAck'));
  const errorItems = Object.entries(errors).map(([field, msg]) => ({ fieldId: `lead-${field.replace('.', '-')}`, label: labels[field] ?? field, message: msg }));

  return (
    <div className={s.page}>
      <PageHeader
        title={t('ui.admin-leads.create.title')}
        crumbs={[{ label: t('ui.admin-shell.menu.group.crm') }, { label: t('ui.admin-leads.title'), href: '/demandes' }, { label: t('ui.admin-leads.create.crumb') }]}
        intro={t('ui.admin-leads.create.intro')}
      />
      <form className={s.layout} onSubmit={submit} noValidate>
        <div className={s.main}>
          {failure ? <Banner tone="error">{failure}</Banner> : null}
          <ErrorSummary title={t('ui.common.error.summary', { n: errorItems.length })} items={errorItems} />

          {/* ─── 1. Qui ─── */}
          <section className={s.step}>
            <header className={s.stepHead}>
              <span className={s.stepNumber}>1</span>
              <h2 className={s.stepTitle}>{t('ui.admin-leads.create.who')}</h2>
              <div className={s.segmented} role="tablist" aria-label={t('ui.admin-leads.create.who')}>
                <button type="button" role="tab" aria-selected={mode === 'search'} className={mode === 'search' ? s.segOn : s.seg} onClick={() => setMode('search')}>
                  {t('ui.admin-leads.create.existing')}
                </button>
                <button type="button" role="tab" aria-selected={mode === 'new'} className={mode === 'new' ? s.segOn : s.seg} onClick={() => setMode('new')}>
                  {t('ui.admin-leads.create.newClient')}
                </button>
              </div>
            </header>
            {mode === 'search' ? (
              client ? (
                <div className={s.picked} id="lead-clientId">
                  <span className={s.avatar} aria-hidden="true">
                    <Icon name="user" size={20} />
                  </span>
                  <span className={s.pickedText}>
                    <strong>{client.title}</strong>
                    {client.subtitle ? <span className={s.muted}>{client.subtitle}</span> : null}
                  </span>
                  <Button variant="tertiary" size="S" onClick={() => setClient(null)}>
                    {t('ui.admin-leads.create.change')}
                  </Button>
                </div>
              ) : (
                <div className={s.search}>
                  <TextInput id="lead-clientId" label={t('ui.admin-leads.create.searchLabel')} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('ui.admin-leads.create.searchPlaceholder')} error={errors.clientId} autoComplete="off" autoFocus />
                  {hits ? (
                    <ul className={s.results} role="listbox" aria-label={t('ui.admin-leads.create.searchLabel')}>
                      {hits.map((h) => (
                        <li key={h.id}>
                          <button type="button" className={s.result} onClick={() => setClient({ id: h.id, title: h.title, subtitle: h.subtitle })}>
                            <Icon name="user" size={16} />
                            <span className={s.pickedText}>
                              <strong>{h.title}</strong>
                              {h.subtitle ? <span className={s.muted}>{h.subtitle}</span> : null}
                            </span>
                            {h.status ? <StatusTag tone="neutral">{t(`ui.enum.${h.status.enum}.${h.status.value}` as MessageKey)}</StatusTag> : null}
                          </button>
                        </li>
                      ))}
                      {hits.length === 0 ? (
                        <li className={s.noResult}>
                          {t('ui.admin-leads.create.noResult')}{' '}
                          <button type="button" className={s.linkButton} onClick={() => setMode('new')}>
                            {t('ui.admin-leads.create.createInstead')}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              )
            ) : (
              <div className={s.grid}>
                <TextInput id="lead-client-firstName" label={labels['client.firstName']!} value={person.firstName} onChange={(e) => setPerson({ ...person, firstName: e.target.value })} error={errors['client.firstName']} autoComplete="off" autoFocus />
                <TextInput id="lead-client-lastName" label={labels['client.lastName']!} value={person.lastName} onChange={(e) => setPerson({ ...person, lastName: e.target.value })} error={errors['client.lastName']} autoComplete="off" />
                <div>
                  <TextInput id="lead-client-email" type="email" inputMode="email" label={labels['client.email']!} optional value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} error={errors['client.email']} hint={t('ui.admin-leads.create.emailOrPhone')} autoComplete="off" />
                  {check?.email?.state === 'TAKEN' ? (
                    <p className={s.known}>
                      {t('ui.admin-leads.create.emailBelongs', { nom: check.email.client.name ?? '' })}{' '}
                      <button type="button" className={s.linkButton} onClick={() => { const c = check.email as { client: { id: string; name: string | null } }; setMode('search'); setClient({ id: c.client.id, title: c.client.name ?? '', subtitle: person.email }); }}>
                        {t('ui.admin-leads.create.useRecord')}
                      </button>
                    </p>
                  ) : check?.email?.state === 'TAKEN_HIDDEN' ? (
                    <p className={s.known}>{t('ui.admin-leads.create.hiddenRecord')}</p>
                  ) : null}
                </div>
                <div>
                  <TextInput id="lead-client-phone" type="tel" inputMode="tel" label={labels['client.phone']!} optional value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} error={errors['client.phone']} hint={t('ui.admin-leads.create.phoneHint')} autoComplete="off" />
                  {check?.phone?.state === 'SHARED' ? <p className={s.warn}>{t('ui.admin-leads.create.phoneShared', { nom: check.phone.client.name ?? '' })}</p> : check?.phone?.state === 'SHARED_HIDDEN' ? <p className={s.warn}>{t('ui.admin-leads.create.hiddenRecord')}</p> : null}
                </div>
                <label className={s.selectField}>
                  <span className={s.label}>{t('ui.admin-leads.create.country')}</span>
                  <select className={s.select} value={person.countryOfResidence} onChange={(e) => setPerson({ ...person, countryOfResidence: e.target.value })}>
                    <option value="">{t('ui.admin-leads.create.countryUnknown')}</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={s.checkCell}>
                  <Checkbox label={t('ui.admin-leads.create.whatsapp')} checked={person.whatsappOptIn} onChange={(v) => setPerson({ ...person, whatsappOptIn: v })} />
                </div>
              </div>
            )}
          </section>

          {/* ─── 2. La demande ─── */}
          <section className={s.step}>
            <header className={s.stepHead}>
              <span className={s.stepNumber}>2</span>
              <h2 className={s.stepTitle}>{t('ui.admin-leads.create.what')}</h2>
            </header>
            <fieldset className={s.chipGroup}>
              <legend className={s.label}>{t('ui.admin-leads.create.source')}</legend>
              <div className={s.chips}>
                {STAFF_LEAD_SOURCES.map((v) => (
                  <button key={v} type="button" className={source === v ? s.chipOn : s.chip} aria-pressed={source === v} onClick={() => setSource(v)}>
                    <Icon name={SOURCE_ICON[v] ?? 'edit'} size={16} />
                    {t(`ui.enum.LeadSource.${v}` as MessageKey)}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className={s.chipGroup}>
              <legend className={s.label}>{t('ui.admin-leads.create.kind')}</legend>
              <div className={s.chips}>
                {STAFF_LEAD_KINDS.map((v) => (
                  <button key={v} type="button" className={kind === v ? s.chipOn : s.chip} aria-pressed={kind === v} onClick={() => setKind(v)}>
                    {t(`ui.enum.LeadKind.${v}` as MessageKey)}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className={s.search}>
              {object ? (
                <div className={s.picked} id="lead-propertyId">
                  <span className={s.avatar} aria-hidden="true">
                    <Icon name={object.type === 'PROPERTY' ? 'key' : 'building'} size={20} />
                  </span>
                  <span className={s.pickedText}>
                    <strong>{[object.reference, object.title].filter(Boolean).join(' · ')}</strong>
                    {object.place ? <span className={s.muted}>{object.place}</span> : null}
                  </span>
                  <Button variant="tertiary" size="S" onClick={() => setObject(null)}>
                    {t('ui.admin-leads.create.change')}
                  </Button>
                </div>
              ) : (
                <>
                  <TextInput id="lead-propertyId" label={t('ui.admin-leads.create.object')} optional={kind !== 'PROPERTY_INTEREST'} value={objectQuery} onChange={(e) => setObjectQuery(e.target.value)} placeholder={t('ui.admin-leads.create.objectPlaceholder')} error={errors.propertyId} autoComplete="off" />
                  {objects ? (
                    <ul className={s.results}>
                      {objects.map((o) => (
                        <li key={`${o.type}-${o.id}`}>
                          <button type="button" className={s.result} onClick={() => setObject(o)}>
                            <Icon name={o.type === 'PROPERTY' ? 'key' : 'building'} size={16} />
                            <span className={s.pickedText}>
                              <strong>{[o.reference, o.title].filter(Boolean).join(' · ')}</strong>
                              {o.place ? <span className={s.muted}>{o.place}</span> : null}
                            </span>
                            {o.availability ? <StatusTag tone={o.availability === 'AVAILABLE' ? 'success' : 'neutral'}>{t(`ui.enum.Availability.${o.availability}` as MessageKey)}</StatusTag> : null}
                          </button>
                        </li>
                      ))}
                      {objects.length === 0 ? <li className={s.noResult}>{t('ui.admin-leads.create.noObject')}</li> : null}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
            <TextArea label={t('ui.admin-leads.create.message')} optional value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={4} hint={t('ui.admin-leads.create.messageHint')} />
          </section>

          {/* ─── 3. La suite ─── */}
          <section className={s.step}>
            <header className={s.stepHead}>
              <span className={s.stepNumber}>3</span>
              <h2 className={s.stepTitle}>{t('ui.admin-leads.create.next')}</h2>
            </header>
            <AdvisorSelect id="lead-assignedAgentId" value={agentId} onChange={setAgentId} allowNone noneLabel={t('ui.admin-leads.create.toTake')} disableAbsent error={errors.assignedAgentId} />
            <div className={[s.consent, errors.consentContact && s.consentError].filter(Boolean).join(' ')} id="lead-consentContact">
              <Checkbox label={<strong>{t('ui.admin-leads.create.consentContact')}</strong>} checked={consentContact} onChange={setConsentContact} error={errors.consentContact} />
              <p className={s.muted}>{t('ui.admin-leads.create.consentProof')}</p>
            </div>
            <Checkbox label={t('ui.admin-leads.create.consentMarketing')} checked={marketingOptIn} onChange={setMarketingOptIn} />
            {source === 'PHONE' ? <Checkbox label={t('ui.admin-leads.create.alreadyContacted')} checked={alreadyContacted} onChange={setAlreadyContacted} /> : null}
            {hasEmail ? <Checkbox label={t('ui.admin-leads.create.sendConfirmation')} checked={sendConfirmation} onChange={setSendConfirmation} /> : <p className={s.muted}>{t('ui.admin-leads.create.noEmailNoAck')}</p>}
          </section>
        </div>

        <aside className={s.aside} aria-label={t('ui.admin-leads.create.summary')}>
          <div className={s.summary}>
            <p className={s.summaryTitle}>{t('ui.admin-leads.create.summary')}</p>
            <ul className={s.summaryList}>
              {summary.map((line) => (
                <li key={line}>
                  <Icon name="check" size={16} />
                  {line}
                </li>
              ))}
            </ul>
            <div className={s.summaryActions}>
              <Button type="submit" variant="tool" size="M" icon="check" pending={pending} fullWidth>
                {t('ui.admin-leads.create.submit')}
              </Button>
              <Link href="/demandes" className={s.cancel}>
                {t('ui.common.cancel')}
              </Link>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
