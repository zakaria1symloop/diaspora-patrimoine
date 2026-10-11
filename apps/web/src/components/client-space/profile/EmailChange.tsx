'use client';
// AUTH-080 — the address is shown; « Modifier » asks the new address and the proof (AUTH-086). Nothing changes until
// the link sent to the new address is opened (24 hours): « Un e-mail de confirmation vient d'être envoyé à {adresse}. »
import { useId, useState } from 'react';
import { Button } from '@dp/ui';
import { apiCall } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import { TextField } from '@/components/forms/fields';
import { Banner, errorMessage, fieldErrors } from '@/components/auth/kit';
import { Proof, type ProofValue } from './Proof';
import s from './profile.module.css';

export function EmailChange({ email, pendingEmail, hasPassword }: { email: string; pendingEmail: string | null; hasPassword: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState('');
  const [proof, setProof] = useState<ProofValue>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setFailure(null);
    setErrors({});
    setPending(true);
    const res = await apiCall<{ email: string }>('/client/me/email', { method: 'PATCH', body: { email: next.trim(), ...proof }, retryOnAuth: true });
    setPending(false);
    if (!res.ok) {
      const fe = fieldErrors(res.error);
      if (res.error?.code === 'INVALID_CREDENTIALS') fe.proof = t('ui.client.security.proof.wrongPassword');
      else if (res.error?.code === 'GONE') fe.proof = t('ui.client.security.proof.gone');
      else if (res.error?.code === 'INVALID_CODE') fe.proof = errorMessage(res.error);
      if (fe.password || fe.actionCode) fe.proof = fe.password ?? fe.actionCode!;
      if (Object.keys(fe).length) setErrors(fe);
      else setFailure(errorMessage(res.error, { offline: res.offline, status: res.status }));
      return;
    }
    setSent(res.data.email);
    setOpen(false);
    setProof({});
  }

  return (
    <div className={s.email}>
      <div className={s.emailLine}>
        <span>
          <span className={s.labelSmall}>{t('ui.client.profile.fields.email')}</span>
          <span className={s.emailValue}>{email}</span>
        </span>
        {!open ? (
          <Button variant="secondary" size="S" onClick={() => setOpen(true)}>
            {t('ui.client.profile.email.change')}
          </Button>
        ) : null}
      </div>
      {sent ? <Banner tone="success">{t('ui.client.profile.email.sent', { adresse: sent })}</Banner> : pendingEmail ? <Banner tone="info">{t('ui.client.profile.email.pending', { adresse: pendingEmail })}</Banner> : null}
      {open ? (
        <div className={s.inlinePanel}>
          <p className={s.panelTitle}>{t('ui.client.profile.email.title')}</p>
          <p className={s.help}>{t('ui.client.profile.email.intro')}</p>
          {failure ? <Banner tone="error">{failure}</Banner> : null}
          <TextField id={id} type="email" autoComplete="email" label={t('ui.client.profile.email.new')} value={next} onChange={(e) => setNext(e.target.value)} error={errors.email} />
          <Proof hasPassword={hasPassword} action="EMAIL_CHANGE" email={email} value={proof} onChange={setProof} error={errors.proof} />
          <div className={s.panelActions}>
            <Button variant="tool" size="M" pending={pending} onClick={() => void submit()}>
              {t('ui.client.profile.email.submit')}
            </Button>
            <Button variant="tertiary" size="M" onClick={() => setOpen(false)}>
              {t('ui.common.cancel')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
