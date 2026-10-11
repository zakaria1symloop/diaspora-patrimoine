'use client';
// EA-104 « Mes préférences » (BO-070) — the sections delivered with the account: « Profil » (first name, last name,
// function shown to clients, phone, time zone) and « Sécurité » (password, second factor, recovery codes, connected
// devices — as PRO-021). « Signature » and « Absence » arrive with the processing of requests (3.2), « Notifications »
// with the preferences (5.1): a section that is not delivered is absent from the screen.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { staffProfileUpdateSchema, type RecoveryCodesResponse, type SessionItem, type StaffProfile, type TwoFactorSetupResponse } from '@dp/contracts';
import { Banner, Button, EmptyState, ErrorSummary, Icon, Modal, StatusTag, useToast } from '@dp/ui';
import { adminCall, type CallResult } from '@/lib/admin-client';
import { checkSchema, errorText, fieldErrors } from '@/lib/errors';
import { relativeTime, shortDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { RecoveryCodes, TwoFactorEnrol } from '../door/TwoFactorEnrol';
import { CodeInput, PasswordInput, SelectInput, TextInput, formStyles as f, useUnsavedGuard } from '../shell/forms';
import { PageHeader, Surface } from '../shell/Page';
import { signalShellChanged, useShell } from '../shell/ShellContext';
import s from './preferences.module.css';

export function PreferencesHeader() {
  const pathname = usePathname() ?? '';
  const tabs = [
    { href: '/preferences', label: t('ui.admin-preferences.tab.profile') },
    { href: '/preferences/securite', label: t('ui.admin-preferences.tab.security') },
    { href: '/preferences/signature', label: t('ui.admin-preferences.tab.signature') },
    { href: '/preferences/absence', label: t('ui.admin-preferences.tab.absence') },
  ];
  return (
    <>
      <PageHeader title={t('ui.admin-preferences.title')} intro={t('ui.admin-preferences.intro')} />
      <nav className={s.tabs} aria-label={t('ui.admin-preferences.title')}>
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={[s.tab, pathname === tab.href && s.tabActive].filter(Boolean).join(' ')} aria-current={pathname === tab.href ? 'page' : undefined}>
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

// ─── Profil ─────────────────────────────────────────────────────────────────

function timeZones(current: string): string[] {
  let all: string[] = [];
  try {
    all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    all = [];
  }
  const preferred = ['Europe/Paris', 'Africa/Algiers', 'Europe/London', 'America/Montreal', 'America/New_York'];
  return [...new Set([current, ...preferred, ...all])];
}

export function ProfileForm({ profile }: { profile: StaffProfile }) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => ({ firstName: profile.firstName ?? '', lastName: profile.lastName ?? '', jobTitle: profile.jobTitle ?? '', phone: profile.phone ?? '', timezone: profile.timezone }), [profile]);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useUnsavedGuard(dirty);
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const labels: Record<string, string> = {
    firstName: t('ui.admin-preferences.profile.firstName'),
    lastName: t('ui.admin-preferences.profile.lastName'),
    jobTitle: t('ui.admin-preferences.profile.jobTitle'),
    phone: t('ui.admin-preferences.profile.phone'),
    timezone: t('ui.admin-preferences.profile.timezone'),
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const checked = checkSchema(staffProfileUpdateSchema, values);
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    setFailure(null);
    setPending(true);
    const r = await adminCall<StaffProfile>('/admin/me', { method: 'PATCH', body: values });
    setPending(false);
    if (!r.ok) {
      const fields = fieldErrors(r.error);
      if (Object.keys(fields).length) return setErrors(fields);
      return setFailure(errorText(r));
    }
    toast({ text: t('ui.common.saved') });
    signalShellChanged(); // the name and the time zone of the frame follow
    router.refresh();
  }

  return (
    <Surface title={t('ui.admin-preferences.tab.profile')}>
      <form className={`${f.form} ${s.form}`} onSubmit={submit} noValidate>
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <ErrorSummary title={t('ui.common.error.summary', { n: Object.keys(errors).length })} items={Object.entries(errors).map(([field, message]) => ({ fieldId: `profile-${field}`, label: labels[field] ?? field, message }))} />
        <div className={f.row}>
          <TextInput id="profile-firstName" label={labels.firstName!} value={values.firstName} onChange={set('firstName')} error={errors.firstName} autoComplete="given-name" />
          <TextInput id="profile-lastName" label={labels.lastName!} value={values.lastName} onChange={set('lastName')} error={errors.lastName} autoComplete="family-name" />
        </div>
        <TextInput label={t('ui.admin-preferences.profile.email')} value={profile.email} readOnly hint={t('ui.admin-preferences.profile.emailHint')} />
        <div className={f.row}>
          <TextInput id="profile-jobTitle" label={labels.jobTitle!} optional value={values.jobTitle} onChange={set('jobTitle')} error={errors.jobTitle} maxLength={80} help={{ label: t('ui.admin-preferences.profile.jobTitleHelpLabel'), text: t('ui.admin-preferences.profile.jobTitleHelp') }} />
          <TextInput id="profile-phone" label={labels.phone!} optional type="tel" inputMode="tel" value={values.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" hint={t('ui.admin-preferences.profile.phoneHint')} />
        </div>
        <SelectInput id="profile-timezone" label={labels.timezone!} value={values.timezone} onChange={set('timezone')} error={errors.timezone} hint={t('ui.admin-preferences.profile.timezoneHint')}>
          {timeZones(profile.timezone).map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </SelectInput>
        <div className={f.actions}>
          <Button type="submit" variant="tool" size="M" pending={pending} disabled={!dirty}>
            {t('ui.common.save')}
          </Button>
          {dirty ? (
            <Button variant="secondary" size="M" onClick={() => setValues(initial)}>
              {t('ui.common.cancel')}
            </Button>
          ) : null}
        </div>
      </form>
    </Surface>
  );
}

// ─── Sécurité ───────────────────────────────────────────────────────────────

export function SecurityPanel({ profile }: { profile: StaffProfile }) {
  return (
    <div className={s.security}>
      <PasswordSection changedAt={profile.passwordChangedAt} />
      <TwoFactorSection profile={profile} />
      <DevicesSection />
    </div>
  );
}

function PasswordSection({ changedAt }: { changedAt: string | null }) {
  const { timeZone } = useShell();
  const toast = useToast();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!current) errs.currentPassword = t('ui.validation.REQUIRED');
    if (!next) errs.newPassword = t('ui.validation.REQUIRED');
    if (Object.keys(errs).length) return setErrors(errs);
    setErrors({});
    setFailure(null);
    setPending(true);
    const r = await adminCall('/admin/me/password', { method: 'PATCH', body: { currentPassword: current, newPassword: next } });
    setPending(false);
    if (!r.ok) {
      const fields = fieldErrors(r.error);
      if (Object.keys(fields).length) return setErrors(fields);
      if (r.error?.code === 'INVALID_CREDENTIALS') return setErrors({ currentPassword: t('ui.admin-preferences.password.wrong') });
      return setFailure(errorText(r));
    }
    setCurrent('');
    setNext('');
    toast({ text: t('ui.admin-preferences.password.changed') });
    router.refresh();
  }

  return (
    <Surface title={t('ui.admin-preferences.password.title')}>
      <form className={`${f.form} ${s.form}`} onSubmit={submit} noValidate>
        <p className={f.muted}>{changedAt ? t('ui.admin-preferences.password.changedAt', { date: shortDateTime(changedAt, timeZone) }) : t('ui.admin-preferences.password.intro')}</p>
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <PasswordInput label={t('ui.admin-preferences.password.current')} autoComplete="current-password" value={current} onValue={setCurrent} error={errors.currentPassword} />
        <PasswordInput label={t('ui.auth.password.newLabel')} hint={t('ui.auth.password.hint')} autoComplete="new-password" value={next} onValue={setNext} error={errors.newPassword} meter />
        <p className={f.muted}>{t('ui.admin-preferences.password.effect')}</p>
        <div className={f.actions}>
          <Button type="submit" variant="tool" size="M" pending={pending}>
            {t('ui.admin-preferences.password.submit')}
          </Button>
        </div>
      </form>
    </Surface>
  );
}

function TwoFactorSection({ profile }: { profile: StaffProfile }) {
  const toast = useToast();
  const router = useRouter();
  const [dialog, setDialog] = useState<'reconfigure' | 'codes' | null>(null);
  return (
    <Surface title={t('ui.admin-preferences.twoFactor.title')}>
      <div className={s.block}>
        <p className={s.stateLine}>
          <StatusTag tone={profile.twoFactorEnabled ? 'success' : 'warning'} icon={profile.twoFactorEnabled ? 'shield' : 'warning'}>
            {profile.twoFactorEnabled ? t('ui.admin-preferences.twoFactor.on') : t('ui.admin-preferences.twoFactor.off')}
          </StatusTag>
          {profile.twoFactorEnabled ? <span className={f.muted}>{t('ui.admin-preferences.twoFactor.codesLeft', { n: profile.recoveryCodesLeft })}</span> : null}
        </p>
        {/* BO-070 — the second factor cannot be switched off while it is mandatory for the staff */}
        <p className={f.muted}>{profile.twoFactorRequired ? t('ui.admin-preferences.twoFactor.required') : t('ui.admin-preferences.twoFactor.intro')}</p>
        {profile.twoFactorEnabled ? (
          <div className={f.actions}>
            <Button variant="secondary" size="M" icon="key" onClick={() => setDialog('reconfigure')}>
              {t('ui.admin-preferences.twoFactor.reconfigure')}
            </Button>
            <Button variant="secondary" size="M" icon="copy" onClick={() => setDialog('codes')}>
              {t('ui.admin-preferences.twoFactor.newCodes')}
            </Button>
          </div>
        ) : null}
      </div>
      <Modal open={dialog === 'reconfigure'} onClose={() => setDialog(null)} title={t('ui.admin-preferences.twoFactor.reconfigure')} closeLabel={t('ui.common.close')} width={560}>
        {dialog === 'reconfigure' ? (
          <Reconfigure
            onDone={() => {
              setDialog(null);
              toast({ text: t('ui.admin-preferences.twoFactor.reconfigured') });
              router.refresh();
            }}
          />
        ) : null}
      </Modal>
      <Modal open={dialog === 'codes'} onClose={() => setDialog(null)} title={t('ui.admin-preferences.twoFactor.newCodes')} closeLabel={t('ui.common.close')} width={560}>
        {dialog === 'codes' ? (
          <NewCodes
            onClose={() => {
              setDialog(null);
              router.refresh();
            }}
          />
        ) : null}
      </Modal>
    </Surface>
  );
}

/** BO-070 — the password typed for this gesture, then a code of the current application (or a recovery code), then PRO-020 steps 2 to 4. */
function Reconfigure({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!password) errs.password = t('ui.validation.REQUIRED');
    if (!code) errs.code = t('ui.validation.REQUIRED');
    if (Object.keys(errs).length) return setErrors(errs);
    setErrors({});
    setFailure(null);
    setPending(true);
    const r = await adminCall<TwoFactorSetupResponse>('/admin/me/two-factor/reconfigure', { body: { password, code } });
    setPending(false);
    if (r.ok) return setSetup(r.data);
    if (r.error?.code === 'INVALID_CREDENTIALS') return setErrors({ password: t('ui.admin-preferences.password.wrong') });
    if (r.error?.code === 'INVALID_CODE') return setErrors({ code: t('ui.auth.twoFactor.wrong') });
    const fields = fieldErrors(r.error);
    if (Object.keys(fields).length) return setErrors(fields);
    setFailure(errorText(r));
  }

  if (setup) {
    return (
      <TwoFactorEnrol<null>
        initial={setup}
        confirm={(c) => adminCall<RecoveryCodesResponse>('/admin/me/two-factor/confirm', { body: { code: c } })}
        enable={() => adminCall<null>('/admin/me/two-factor/enable', { body: { saved: true } }) as Promise<CallResult<null>>}
        onDone={onDone}
      />
    );
  }
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      <p className={f.muted}>{t('ui.admin-preferences.twoFactor.reconfigureIntro')}</p>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <PasswordInput label={t('ui.auth.password.label')} autoComplete="current-password" value={password} onValue={setPassword} error={errors.password} autoFocus />
      <CodeInput label={t('ui.admin-preferences.twoFactor.currentCode')} hint={t('ui.admin-preferences.twoFactor.currentCodeHint')} value={code} onValue={setCode} error={errors.code} />
      <div className={`${f.actions} ${f.actionsEnd}`}>
        <Button type="submit" variant="tool" size="M" pending={pending}>
          {t('ui.common.continue')}
        </Button>
      </div>
    </form>
  );
}

/** BO-070 — « Nouveaux codes de secours »: the password; the old codes die; `S_TWO_FACTOR_CHANGED` leaves. */
function NewCodes({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setError(t('ui.validation.REQUIRED'));
    setError(null);
    setFailure(null);
    setPending(true);
    const r = await adminCall<RecoveryCodesResponse>('/admin/me/two-factor/recovery-codes', { body: { password } });
    setPending(false);
    if (r.ok) return setCodes(r.data.recoveryCodes);
    if (r.error?.code === 'INVALID_CREDENTIALS') return setError(t('ui.admin-preferences.password.wrong'));
    const fields = fieldErrors(r.error);
    if (fields.password) return setError(fields.password);
    setFailure(errorText(r));
  }

  if (codes) {
    return (
      <div className={f.form}>
        <Banner tone="success">{t('ui.admin-preferences.twoFactor.codesReady')}</Banner>
        <RecoveryCodes codes={codes} />
        <div className={`${f.actions} ${f.actionsEnd}`}>
          <Button variant="tool" size="M" onClick={onClose}>
            {t('ui.admin-preferences.twoFactor.codesKept')}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      <p className={f.muted}>{t('ui.admin-preferences.twoFactor.newCodesIntro')}</p>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <PasswordInput label={t('ui.auth.password.label')} autoComplete="current-password" value={password} onValue={setPassword} error={error} autoFocus />
      <div className={`${f.actions} ${f.actionsEnd}`}>
        <Button type="submit" variant="tool" size="M" pending={pending}>
          {t('ui.admin-preferences.twoFactor.generate')}
        </Button>
      </div>
    </form>
  );
}

/** PRO-021 — connected devices: this one, the others, « Déconnecter » one or all the others. */
function DevicesSection() {
  const { timeZone } = useShell();
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = async () => {
    const r = await adminCall<{ data: SessionItem[] }>('/admin/me/sessions');
    if (r.ok) {
      setSessions(r.data.data);
      setFailed(null);
    } else if (!r.aborted) setFailed(errorText(r));
  };
  useEffect(() => {
    void load();
  }, []);

  const revoke = async (id: string | null) => {
    const r = await adminCall(id ? `/admin/me/sessions/${id}` : '/admin/me/sessions', { method: 'DELETE' });
    if (r.ok) {
      toast({ text: id ? t('ui.admin-preferences.devices.revoked') : t('ui.admin-preferences.devices.revokedAll') });
      void load();
    } else toast({ tone: 'error', text: errorText(r), action: { label: t('ui.common.retry'), run: () => void revoke(id) } });
  };

  const now = Date.now();
  const others = sessions?.filter((x) => !x.current).length ?? 0;
  return (
    <Surface
      title={t('ui.admin-preferences.devices.title')}
      actions={
        others > 0 ? (
          <Button variant="secondary" size="S" onClick={() => void revoke(null)}>
            {t('ui.admin-preferences.devices.revokeOthers')}
          </Button>
        ) : undefined
      }
      flush
    >
      {failed ? (
        <EmptyState compact icon="status-error" title={t('ui.common.error.block')} text={failed} actions={<Button variant="secondary" size="S" onClick={() => void load()}>{t('ui.common.retry')}</Button>} />
      ) : sessions === null ? (
        <p className={s.loading} role="status">
          {t('ui.common.loading')}
        </p>
      ) : (
        <ul className={s.devices}>
          {sessions.map((x) => (
            <li key={x.id} className={s.device}>
              <span className={s.deviceIcon} aria-hidden="true">
                <Icon name="key" size={20} />
              </span>
              <span className={s.deviceText}>
                <span className={s.deviceName}>
                  {x.deviceLabel ?? t('ui.admin-preferences.devices.unknown')}
                  {x.current ? <StatusTag tone="success">{t('ui.admin-preferences.devices.current')}</StatusTag> : null}
                </span>
                <span className={f.muted} title={shortDateTime(x.lastUsedAt, timeZone)}>
                  {t('ui.admin-preferences.devices.lastUsed', { quand: relativeTime(x.lastUsedAt, now, timeZone) })}
                  {' · '}
                  {t('ui.admin-preferences.devices.since', { date: shortDateTime(x.createdAt, timeZone) })}
                </span>
              </span>
              {x.current ? null : (
                <Button variant="secondary" size="S" onClick={() => void revoke(x.id)}>
                  {t('ui.admin-preferences.devices.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
