'use client';
// EC-01 at the client door, and the standalone EC-03 waiting page.
import { useEffect, useState, type ReactNode } from 'react';
import type { LoginResponse } from '@dp/contracts';
import { apiCall } from '@/lib/auth-client';
import { t } from '@/lib/i18n';
import { EmailRequestForm } from './EmailRequestForm';
import { ContactLine, type ContactInfo } from './kit';
import { LoginFlow } from './LoginFlow';
import { VerifyWaitStep } from './Steps';
import s from './auth.module.css';

export function ClientLogin({ next, simulationId, contact, footer }: { next: string | null; simulationId: string | null; contact: ContactInfo; footer: ReactNode }) {
  const magic = next ? `/connexion/lien?suite=${encodeURIComponent(next)}` : '/connexion/lien';
  return (
    <LoginFlow
      audience="WEB"
      next={next}
      simulationId={simulationId}
      contact={contact}
      footer={footer}
      forgotHref="/mot-de-passe-oublie"
      magicHref={magic}
      eyebrow={t('ui.auth.space.eyebrow')}
      title={t('ui.auth.login.title')}
      intro={t('ui.auth.login.intro')}
    />
  );
}

/** EC-03 « Attente » — the waiting step when there is one; otherwise « Recevoir un nouveau lien » by address. */
export function VerificationWait({ contact }: { contact: ContactInfo }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void apiCall<LoginResponse>('/auth/step').then((r) => setEmail(r.ok && r.data.status === 'STEP' && r.data.nextStep === 'EMAIL_VERIFICATION' ? (r.data.email ?? '') : null));
  }, []);
  if (email === undefined) return <p className={s.muted}>{t('ui.auth.common.loading')}</p>;
  if (email !== null) return <VerifyWaitStep audience="WEB" email={email} onExpired={() => setEmail(null)} contact={contact} />;
  return (
    <>
      <h1 className={s.title}>{t('ui.auth.verifyWait.title')}</h1>
      <p className={s.intro}>{t('ui.auth.verify.resendEmail')}</p>
      <EmailRequestForm endpoint="/auth/verify-email/resend" submitLabel={t('ui.auth.common.newLink')} sentText={t('ui.auth.common.newLinkSent')} />
      <ContactLine {...contact} />
    </>
  );
}
