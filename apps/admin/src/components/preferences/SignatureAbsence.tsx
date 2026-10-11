'use client';
// BO-070 « Signature » and « Absence » (package 3.2) — the text added under the name in hand-written e-mails (COM-021),
// shown live as the client will read it; and the absence of CRM-021: what it changes, said in plain words, the date of
// the last day, « Je suis de retour ». The account menu offers the same absence (BO-013).
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { STAFF_SIGNATURE_MAX, staffSignatureLines, type StaffProfile } from '@dp/contracts';
import { Banner, Button, Icon, Scene, useToast } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { longDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { TextArea, TextInput, formStyles as f, useUnsavedGuard } from '../shell/forms';
import { Surface } from '../shell/Page';
import { signalShellChanged } from '../shell/ShellContext';
import s from './preferences.module.css';

export function SignaturePanel({ profile }: { profile: StaffProfile }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState(profile.signature ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = text !== (profile.signature ?? '');
  useUnsavedGuard(dirty);
  const lines = useMemo(() => staffSignatureLines({ firstName: profile.firstName, lastName: profile.lastName, jobTitle: profile.jobTitle, signature: text.trim() || null }), [profile, text]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await adminCall<StaffProfile>('/admin/me', { method: 'PATCH', body: { signature: text } });
    setPending(false);
    if (!r.ok) return setError(fieldErrors(r.error).signature ?? errorText(r));
    toast({ text: t('ui.admin-preferences.signature.saved') });
    router.refresh();
  }

  return (
    <div className={s.split}>
      <Surface title={t('ui.admin-preferences.signature.title')}>
        <form className={f.form} onSubmit={submit} noValidate>
          <p className={f.muted}>{t('ui.admin-preferences.signature.intro')}</p>
          <TextArea label={t('ui.admin-preferences.signature.label')} value={text} onChange={(e) => setText(e.target.value)} maxLength={STAFF_SIGNATURE_MAX} rows={5} error={error} hint={t('ui.admin-preferences.signature.hint')} />
          <div className={`${f.actions} ${f.actionsEnd}`}>
            {dirty ? (
              <Button variant="secondary" size="M" onClick={() => setText(profile.signature ?? '')}>
                {t('ui.common.cancel')}
              </Button>
            ) : null}
            <Button type="submit" variant="tool" size="M" pending={pending} disabled={!dirty}>
              {t('ui.common.save')}
            </Button>
          </div>
        </form>
      </Surface>
      <aside className={s.mail} aria-label={t('ui.admin-preferences.signature.preview')}>
        <p className={s.mailHead}>
          <Icon name="mail" size={16} />
          {t('ui.admin-preferences.signature.preview')}
        </p>
        <div className={s.mailBody}>
          <p>{t('ui.admin-preferences.signature.sampleGreeting')}</p>
          <p className={s.mailFiller}>{t('ui.admin-preferences.signature.sampleText')}</p>
          <p className={s.mailSignature}>
            {lines.map((l, i) => (
              <span key={i} className={i === 0 ? s.mailName : undefined}>
                {l}
              </span>
            ))}
          </p>
        </div>
        {!profile.jobTitle ? <p className={s.mailHint}>{t('ui.admin-preferences.signature.noJobTitle')}</p> : null}
      </aside>
    </div>
  );
}

const today = () => new Intl.DateTimeFormat('en-CA').format(new Date());

export function AbsencePanel({ profile }: { profile: StaffProfile }) {
  const router = useRouter();
  const toast = useToast();
  const [day, setDay] = useState(profile.absentUntil ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(value: string | null) {
    setPending(true);
    setError(null);
    const r = await adminCall<StaffProfile>('/admin/me', { method: 'PATCH', body: { absentUntil: value } });
    setPending(false);
    if (!r.ok) return setError(fieldErrors(r.error).absentUntil ?? errorText(r));
    toast({ text: value ? t('ui.admin-preferences.absence.saved', { date: longDay(value) }) : t('ui.admin-preferences.absence.back') });
    if (!value) setDay('');
    signalShellChanged();
    router.refresh();
  }

  const absent = profile.absentUntil;
  return (
    <div className={s.split}>
      <Surface title={t('ui.admin-preferences.absence.title')}>
        <div className={f.form}>
          {absent ? (
            <Banner tone="warning" title={t('ui.admin-preferences.absence.currentTitle', { date: longDay(absent) })} action={<Button variant="secondary" size="S" pending={pending} onClick={() => void save(null)}>{t('ui.admin-preferences.absence.backButton')}</Button>}>
              {t('ui.admin-preferences.absence.currentText')}
            </Banner>
          ) : null}
          <form
            className={f.form}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!day) return setError(t('ui.validation.REQUIRED'));
              void save(day);
            }}
          >
            <TextInput type="date" label={t('ui.admin-preferences.absence.until')} value={day} min={today()} onChange={(e) => setDay(e.target.value)} error={error} hint={t('ui.admin-preferences.absence.untilHint')} />
            <div className={`${f.actions} ${f.actionsEnd}`}>
              <Button type="submit" variant="tool" size="M" pending={pending} disabled={!day || day === absent}>
                {absent ? t('ui.admin-preferences.absence.change') : t('ui.admin-preferences.absence.declare')}
              </Button>
            </div>
          </form>
        </div>
      </Surface>
      <aside className={s.explain}>
        <Scene name="attente" className={s.scene} />
        <p className={s.explainTitle}>{t('ui.admin-preferences.absence.whatTitle')}</p>
        <ul className={s.explainList}>
          {profile.handlesLeads ? <li>{t('ui.admin-preferences.absence.what1')}</li> : null}
          <li>{t('ui.admin-preferences.absence.what2')}</li>
          <li>{t('ui.admin-preferences.absence.what3')}</li>
          <li>{t('ui.admin-preferences.absence.what4')}</li>
        </ul>
      </aside>
    </div>
  );
}
