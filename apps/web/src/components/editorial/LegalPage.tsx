// EP-24 — legal pages (EDI-060, EDI-061): the version in force (MOD-420), its title, « Version du {date d'effet} », its
// text sanitised again (EDI-003). The provisional version « 0.1 – projet » carries the banner and is not indexed.
// Mentions légales: publisher identity from the contact.* settings, above the text. Cookies: the table of NAV-051
// produced by the code, then « Gérer mes cookies ». Confidentialité: the link to exercise one's rights.
import 'server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isProvisionalLegalVersion, type LegalDocumentType, type PublicLegalDocument } from '@dp/contracts';
import { Icon } from '@dp/ui';
import { ApiError, apiGet } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { formatPhone } from '@/lib/contact';
import { callbackHref, description, editorialTitle, longDate, plainText, sanitizeRich } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { CallCard, PageHead, RichText } from './Parts';
import { ManageCookies, RightsLinks } from './LegalActions';
import s from './editorial.module.css';

export const LEGAL_PAGES: Record<string, LegalDocumentType> = {
  '/mentions-legales': 'LEGAL_NOTICE',
  '/confidentialite': 'PRIVACY_POLICY',
  '/conditions-generales': 'TERMS_OF_USE',
  '/cookies': 'COOKIE_POLICY',
  '/charte-partenaires': 'PARTNER_CHARTER',
};

/** NAV-051 — what is stored without consent; the `locale` cookie is [V2] and not used. */
const COOKIE_ROWS = [
  'session',
  'consent',
  'anon',
  'device',
  'csrf',
  'gate',
  'share',
  'signup',
  'step',
  'sessionStorage',
  'localStorage',
  'compare',
  'favorites',
  'simpleMode',
] as const;

async function load(type: LegalDocumentType): Promise<PublicLegalDocument> {
  try {
    return await apiGet<PublicLegalDocument>(`/public/legal/${type}`, { tags: ['content'] });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function legalMetadata(path: string): Promise<Metadata> {
  const [doc, settings] = await Promise.all([load(LEGAL_PAGES[path]!), getSettings()]);
  return {
    title: { absolute: editorialTitle(doc.title, settings) },
    description: description(plainText(doc.body)),
    alternates: { canonical: path },
    robots: isProvisionalLegalVersion(doc.version) ? { index: false, follow: true } : undefined,
  };
}

export async function LegalPage({ path }: { path: string }) {
  const type = LEGAL_PAGES[path]!;
  const [doc, settings] = await Promise.all([load(type), getSettings()]);
  const provisional = isProvisionalLegalVersion(doc.version);
  const publisher: { label: string; value: string }[] = [];
  if (type === 'LEGAL_NOTICE') {
    if (settings['contact.legalName']) publisher.push({ label: t('ui.editorial.legal.legalName'), value: settings['contact.legalName'] });
    if (settings['contact.registration']) publisher.push({ label: t('ui.editorial.legal.registration'), value: settings['contact.registration'] });
    if (settings['contact.address']) publisher.push({ label: t('ui.editorial.legal.address'), value: settings['contact.address'] });
    const contact = [settings['contact.email'], settings['contact.phone'] ? formatPhone(settings['contact.phone']) : ''].filter(Boolean).join(' · ');
    if (contact) publisher.push({ label: t('ui.editorial.legal.contact'), value: contact });
  }

  return (
    <>
      <PageHead title={doc.title} drawing="document">
        <p className={s.headMeta}>
          <span className={`${s.pill} ${s.pillBlue}`}>
            <Icon name="calendar" size={16} />
            {t('ui.editorial.legal.version', { date: longDate(doc.effectiveAt) })}
          </span>
        </p>
        {provisional ? (
          <p className={s.provisional} role="note">
            <Icon name="status-warning" size={20} />
            {t('ui.common.provisional')}
          </p>
        ) : null}
      </PageHead>

      <section className={`${s.section} ${s.bgIvoire}`} aria-label={doc.title}>
        <div className={`container ${s.legalLayout}`}>
          <article className={s.legalBody}>
            {publisher.length ? (
              <section className={s.publisher} aria-labelledby="editeur">
                <h2 id="editeur" className={s.publisherTitle}>
                  {t('ui.editorial.legal.publisher')}
                </h2>
                <dl className={s.publisherList}>
                {publisher.map((p) => (
                  <div key={p.label}>
                    <dt>{p.label}</dt>
                    <dd className={s.prewrap}>{p.value}</dd>
                  </div>
                ))}
                </dl>
              </section>
            ) : null}
            <RichText html={sanitizeRich(doc.body)} />
            {type === 'COOKIE_POLICY' ? (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <caption>{t('ui.editorial.legal.cookiesTitle')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('ui.editorial.legal.cookieName')}</th>
                      <th scope="col">{t('ui.editorial.legal.cookieRole')}</th>
                      <th scope="col">{t('ui.editorial.legal.cookieDuration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COOKIE_ROWS.map((r) => (
                      <tr key={r}>
                        <th scope="row">{t(`ui.editorial.legal.cookies.${r}.name`)}</th>
                        <td data-label={t('ui.editorial.legal.cookieRole')}>{t(`ui.editorial.legal.cookies.${r}.role`)}</td>
                        <td data-label={t('ui.editorial.legal.cookieDuration')}>{t(`ui.editorial.legal.cookies.${r}.duration`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={s.note}>{t('ui.editorial.legal.cookiesIntro')}</p>
              </div>
            ) : null}
          </article>
          <aside className={s.legalSide}>
            {type === 'COOKIE_POLICY' ? (
              <div className={s.sideCard}>
                <p className={s.sideTitle}>{t('ui.editorial.legal.cookiesTitle')}</p>
                <ManageCookies label={t('ui.editorial.legal.manageCookies')} />
              </div>
            ) : null}
            {type === 'PRIVACY_POLICY' ? (
              <div className={s.sideCard}>
                <p className={s.sideTitle}>{t('ui.editorial.legal.rightsTitle')}</p>
                <p className={s.cardText}>{t('ui.editorial.legal.rightsText')}</p>
                <RightsLinks space={t('ui.editorial.legal.rightsSpace')} contact={t('ui.editorial.legal.rightsContact')} />
              </div>
            ) : null}
            <nav className={s.sideCard} aria-label={t('ui.nav.footer.legalNav')}>
              <p className={s.sideTitle}>{t('ui.nav.footer.legalNav')}</p>
              <ul role="list" className={s.legalNav}>
                {(
                  [
                    ['/mentions-legales', 'ui.nav.footer.legal'],
                    ['/confidentialite', 'ui.nav.footer.privacy'],
                    ['/conditions-generales', 'ui.nav.footer.terms'],
                    ['/cookies', 'ui.nav.footer.cookies'],
                  ] as const
                ).map(([href, key]) => (
                  <li key={href}>
                    <a href={href} aria-current={href === path ? 'page' : undefined}>
                      {t(key)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </section>

      <CallCard href={callbackHref(settings)} />
    </>
  );
}
