// EP-33 « mot de passe oublié » — the client rules (ACP-085, AUTH-045), at the partner door.
import Link from 'next/link';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { EmailRequestForm } from '@/components/auth/EmailRequestForm';
import { ContactLine } from '@/components/auth/kit';
import { authMetadata } from '@/components/auth/meta';
import s from '@/components/auth/auth.module.css';

export const metadata = authMetadata(t('ui.auth.forgot.title'));

export default async function PartnerForgotPage() {
  return (
    <AuthShell scene="partenaire">
      <span className={s.eyebrow}>
        <Icon name="key" size={16} />
        {t('ui.auth.partner.eyebrow')}
      </span>
      <h1 className={s.title}>{t('ui.auth.forgot.title')}</h1>
      <p className={s.intro}>{t('ui.auth.forgot.intro')}</p>
      <EmailRequestForm endpoint="/auth/password/forgot" audience="PARTNER" submitLabel={t('ui.auth.forgot.submit')} sentText={t('ui.auth.forgot.sent')} />
      <Link href="/partenaires/connexion" className={s.link}>
        {t('ui.auth.common.backToLogin')}
      </Link>
      <ContactLine {...await contactInfo(true)} />
    </AuthShell>
  );
}
