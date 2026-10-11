// FIC-090, TRV-084 — archived property: « Ce bien n'est plus proposé. », the search bar, a way back to the catalogue.
// (Similar properties need the archived property's data, which the public API no longer serves: the catalogue link
// and the search take their place.)
import Link from 'next/link';
import { Icon, buttonClass, ButtonInner } from '@dp/ui';
import { ErrorPage } from '@/components/ErrorPage';
import { t } from '@/lib/i18n';

export function GoneProperty({ slug }: { slug: string }) {
  return (
    <ErrorPage title={t('ui.pages.error.propertyGone.title')}>
      <form action="/programmes" method="get" role="search" style={{ display: 'flex', gap: 'var(--sp-12)', flexWrap: 'wrap' }}>
        <label htmlFor={`recherche-${slug}`} className="visually-hidden">
          {t('ui.pages.error.notFound.searchLabel')}
        </label>
        <input
          id={`recherche-${slug}`}
          name="q"
          type="search"
          minLength={2}
          placeholder={t('ui.pages.error.notFound.searchPlaceholder')}
          style={{
            flex: '1 1 16rem',
            height: 'var(--field-h)',
            paddingInline: 'var(--sp-20)',
            border: 'var(--stroke-field) solid var(--bo-ligne-bleue)',
            borderRadius: 'var(--radius-pill)',
          }}
        />
        <button type="submit" className={buttonClass('primary', 'M')}>
          <ButtonInner size="M" icon="search">
            {t('ui.common.search')}
          </ButtonInner>
        </button>
      </form>
      <Link href="/programmes" className={buttonClass('secondary', 'M')}>
        <ButtonInner size="M">
          <Icon name="home" size={20} />
          {t('ui.pages.error.notFound.properties')}
        </ButtonInner>
      </Link>
    </ErrorPage>
  );
}
