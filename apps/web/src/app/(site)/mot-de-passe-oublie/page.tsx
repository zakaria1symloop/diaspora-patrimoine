// EC-04 — /mot-de-passe-oublie (AUTH-045): one e-mail field, then always the same sentence (TRV-112).
import Link from 'next/link';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { EmailRequestForm } from '@/components/auth/EmailRequestForm';
import { ContactLine } from '@/components/auth/kit';
import { authMetadata } from '@/components/auth/meta';
import s from '@/components/auth/auth.module.css';

export const metadata = authMetadata(t('ui.auth.forgot.title'));

export default async function ForgotPage() {
  return (
    <AuthShell scene="courrier">
      <span className={s.eyebrow}>
        <Icon name="key" size={16} />
        {t('ui.auth.login.title')}
      </span>
      <h1 className={s.title}>{t('ui.auth.forgot.title')}</h1>
      <p className={s.intro}>{t('ui.auth.forgot.intro')}</p>
      <EmailRequestForm endpoint="/auth/password/forgot" submitLabel={t('ui.auth.forgot.submit')} sentText={t('ui.auth.forgot.sent')} />
      <Link href="/connexion" className={s.link}>
        {t('ui.auth.common.backToLogin')}
      </Link>
      <ContactLine {...await contactInfo()} />
    </AuthShell>
  );
}
