'use client';
// CRM-041 — « Créer un client »: prénom, nom, e-mail, téléphone, pays de résidence, origine, conseiller. The e-mail OR the
// phone (MOD-302). While typing: an address that belongs to a record replaces the creation by « Cette adresse
// appartient déjà à {nom}. Ouvrir sa fiche »; a phone carried by another record only warns; a record outside the
// reader's perimeter is never named.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { STAFF_ENTRY_SOURCES, staffClientCreateSchema, type ContactCheck } from '@dp/contracts';
import type { MessageKey } from '@dp/i18n';
import { Banner, Button, ButtonInner, buttonClass, ErrorSummary, Icon, useToast } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { checkSchema, errorText, fieldErrors } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { AdvisorSelect } from '../crm/AdvisorSelect';
import { PageHeader } from '../shell/Page';
import { Checkbox, SelectInput, TextInput, useUnsavedGuard } from '../shell/forms';
import { useShell } from '../shell/ShellContext';
import s from './clients.module.css';

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function ClientCreateForm({ countries }: { countries: { code: string; name: string }[] }) {
  const { shell, can } = useShell();
  const router = useRouter();
  const toast = useToast();
  const [key] = useState(newIdempotencyKey);
  const [v, setV] = useState({ firstName: '', lastName: '', email: '', phone: '', whatsappOptIn: false, countryOfResidence: '', source: 'PHONE', assignedAgentId: can('client.assign') ? '' : shell.user.id });
  const [check, setCheck] = useState<ContactCheck | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saved = useRef(false);
  useUnsavedGuard(!saved.current && Boolean(v.firstName || v.lastName || v.email || v.phone));

  const email = useDebounced(v.email.trim().toLowerCase());
  const phone = useDebounced(v.phone.replace(/[\s.()-]/g, ''));
  useEffect(() => {
    const e = /.+@.+\..+/.test(email) ? email : undefined;
    const p = /^\+\d{7,15}$/.test(phone) ? phone : undefined;
    if (!e && !p) return setCheck(null);
    const ctrl = new AbortController();
    void adminCall<ContactCheck>('/admin/clients/contact-check', { query: { email: e, phone: p }, signal: ctrl.signal }).then((r) => {
      if (r.ok) setCheck(r.data);
    });
    return () => ctrl.abort();
  }, [email, phone]);

  const taken = check?.email && check.email.state !== 'FREE' ? check.email : null;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const body = { ...v, email: v.email || null, phone: v.phone || null, countryOfResidence: v.countryOfResidence || null, assignedAgentId: v.assignedAgentId || null };
  const labels: Record<string, string> = { firstName: t('ui.admin-clients.create.firstName'), lastName: t('ui.admin-clients.create.lastName'), email: t('ui.admin-clients.create.email'), phone: t('ui.admin-clients.create.phone'), source: t('ui.admin-clients.create.source') };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);
    if (taken) return;
    const checked = checkSchema(staffClientCreateSchema, body);
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    setPending(true);
    const r = await adminCall<{ id: string }>('/admin/clients', { body, idempotencyKey: key });
    setPending(false);
    if (!r.ok) {
      const fields = fieldErrors(r.error);
      if (Object.keys(fields).length) return setErrors(fields);
      return setFailure(errorText(r));
    }
    saved.current = true;
    toast({ text: t('ui.admin-clients.create.done') });
    router.push(`/clients/${r.data.id}`);
  }

  const items = Object.entries(errors).map(([field, message]) => ({ fieldId: `client-${field}`, label: labels[field] ?? field, message }));
  return (
    <div className={s.createPage}>
      <PageHeader title={t('ui.admin-clients.create.title')} crumbs={[{ label: t('ui.admin-shell.menu.group.crm') }, { label: t('ui.admin-clients.title'), href: '/clients' }, { label: t('ui.admin-clients.create.crumb') }]} intro={t('ui.admin-clients.create.intro')} />
      <form className={s.createLayout} onSubmit={submit} noValidate>
        <section className={s.createCard}>
          {failure ? <Banner tone="error">{failure}</Banner> : null}
          <ErrorSummary title={t('ui.common.error.summary', { n: items.length })} items={items} />
          <div className={s.grid2}>
            <TextInput id="client-firstName" label={labels.firstName!} value={v.firstName} onChange={set('firstName')} error={errors.firstName} autoComplete="off" autoFocus />
            <TextInput id="client-lastName" label={labels.lastName!} value={v.lastName} onChange={set('lastName')} error={errors.lastName} autoComplete="off" />
            <TextInput id="client-email" type="email" inputMode="email" label={labels.email!} optional value={v.email} onChange={set('email')} error={errors.email} hint={t('ui.admin-clients.create.emailOrPhone')} autoComplete="off" />
            <TextInput id="client-phone" type="tel" inputMode="tel" label={labels.phone!} optional value={v.phone} onChange={set('phone')} error={errors.phone} hint={t('ui.admin-clients.create.phoneHint')} autoComplete="off" />
          </div>
          {taken ? (
            <div className={s.taken} role="status">
              <Icon name="user" size={20} />
              {taken.state === 'TAKEN' ? (
                <p>
                  {t('ui.admin-clients.create.taken', { nom: taken.client.name ?? '' })}{' '}
                  <Link href={`/clients/${taken.client.id}`} className={s.inlineLink}>
                    {t('ui.admin-clients.create.openRecord')}
                  </Link>
                </p>
              ) : (
                <p>{t('ui.admin-clients.create.hidden')}</p>
              )}
            </div>
          ) : null}
          {check?.phone?.state === 'SHARED' ? (
            <p className={s.warn}>
              {t('ui.admin-clients.create.phoneShared', { nom: check.phone.client.name ?? '' })}{' '}
              <Link href={`/clients/${check.phone.client.id}`} className={s.inlineLink}>
                {t('ui.admin-clients.create.see')}
              </Link>
            </p>
          ) : check?.phone?.state === 'SHARED_HIDDEN' ? (
            <p className={s.warn}>{t('ui.admin-clients.create.hidden')}</p>
          ) : null}
          <div className={s.grid2}>
            <SelectInput label={t('ui.admin-clients.create.country')} value={v.countryOfResidence} onChange={set('countryOfResidence')} optional>
              <option value="">{t('ui.admin-clients.create.countryUnknown')}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="client-source" label={labels.source!} value={v.source} onChange={set('source')} error={errors.source}>
              {STAFF_ENTRY_SOURCES.map((x) => (
                <option key={x} value={x}>
                  {t(`ui.enum.LeadSource.${x}` as MessageKey)}
                </option>
              ))}
            </SelectInput>
          </div>
          <Checkbox label={t('ui.admin-clients.create.whatsapp')} checked={v.whatsappOptIn} onChange={(x) => setV((y) => ({ ...y, whatsappOptIn: x }))} />
          {can('client.assign') ? <AdvisorSelect value={v.assignedAgentId} onChange={(id) => setV((y) => ({ ...y, assignedAgentId: id }))} allowNone label={t('ui.admin-clients.create.agent')} /> : null}
          <div className={s.createActions}>
            <Link href="/clients" className={buttonClass('secondary', 'M')}>
              <ButtonInner size="M">{t('ui.common.cancel')}</ButtonInner>
            </Link>
            <Button type="submit" variant="tool" size="M" icon="check" pending={pending} disabled={Boolean(taken)}>
              {t('ui.admin-clients.create.submit')}
            </Button>
          </div>
        </section>
        <aside className={s.createAside}>
          <p className={s.asideTitle}>{t('ui.admin-clients.create.asideTitle')}</p>
          <ul className={s.asideList}>
            <li>{t('ui.admin-clients.create.aside1')}</li>
            <li>{t('ui.admin-clients.create.aside2')}</li>
            <li>{t('ui.admin-clients.create.aside3')}</li>
          </ul>
        </aside>
      </form>
    </div>
  );
}
