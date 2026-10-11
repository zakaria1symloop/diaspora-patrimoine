// EC-07 — /connexion/lien (AUTH-041): one e-mail field, then always the same sentence.
import Link from 'next/link';
import { Icon } from '@dp/ui';
import { t } from '@/lib/i18n';
import { AuthShell, contactInfo } from '@/components/auth/AuthShell';
import { EmailRequestForm } from '@/components/auth/EmailRequestForm';
import { ContactLine } from '@/components/auth/kit';
import { authMetadata, nextParam } from '@/components/auth/meta';
import s from '@/components/auth/auth.module.css';

export const metadata = authMetadata(t('ui.auth.magic.title'));

export default async function MagicLinkPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = nextParam(await searchParams);
  return (
    <AuthShell scene="courrier">
      <span className={s.eyebrow}>
        <Icon name="mail" size={16} />
        {t('ui.auth.login.title')}
      </span>
      <h1 className={s.title}>{t('ui.auth.magic.title')}</h1>
      <p className={s.intro}>{t('ui.auth.magic.intro')}</p>
      <EmailRequestForm endpoint="/auth/magic-link" submitLabel={t('ui.auth.magic.submit')} sentText={t('ui.auth.magic.sent')} next={next} />
      <Link href="/connexion" className={s.link}>
        {t('ui.auth.common.backToLogin')}
      </Link>
      <ContactLine {...await contactInfo()} />
    </AuthShell>
  );
}
