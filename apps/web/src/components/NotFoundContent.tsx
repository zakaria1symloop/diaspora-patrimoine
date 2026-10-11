// TRV-084 — the content of the 404: a property search field, links to the home page, the properties and — if Le
// Café is on — Le Café. Rendered inside the site frame by `(site)/not-found.tsx` (an unknown property, programme,
// promoter or Café: the frame is already there) and wrapped in it by the root `not-found.tsx` (any other address).
import Link from 'next/link';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { ErrorPage } from '@/components/ErrorPage';
import { getSettings } from '@/lib/settings';
import { t } from '@/lib/i18n';
import s from '@/app/not-found.module.css';

export async function NotFoundContent() {
  const settings = await getSettings().catch(() => null);
  return (
    <ErrorPage title={t('ui.pages.error.notFound.title')}>
      <form action="/programmes" method="get" role="search" className={s.search}>
        <label htmlFor="recherche-404" className={s.label}>
          {t('ui.pages.error.notFound.searchLabel')}
        </label>
        <div className={s.row}>
          <input
            id="recherche-404"
            name="q"
            type="search"
            minLength={2}
            className={s.input}
            placeholder={t('ui.pages.error.notFound.searchPlaceholder')}
          />
          <button type="submit" className={buttonClass('primary', 'M')}>
            <ButtonInner size="M" icon="search">
              {t('ui.common.search')}
            </ButtonInner>
          </button>
        </div>
      </form>
      <p className={s.text}>{t('ui.pages.error.notFound.text')}</p>
      <ul className={s.links} role="list">
        <li>
          <Link href="/" className={s.link}>
            <Icon name="home" size={20} />
            {t('ui.pages.error.notFound.home')}
          </Link>
        </li>
        <li>
          <Link href="/programmes" className={s.link}>
            <Icon name="building" size={20} />
            {t('ui.pages.error.notFound.properties')}
          </Link>
        </li>
        {settings?.['features.cafe'] ? (
          <li>
            <Link href="/le-cafe" className={s.link}>
              <Icon name="cafe-cup" size={20} />
              {t('ui.pages.error.notFound.cafe')}
            </Link>
          </li>
        ) : null}
      </ul>
    </ErrorPage>
  );
}
