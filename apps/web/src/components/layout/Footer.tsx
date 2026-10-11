// NAV-020 — footer: identity, navigation, actions, contact details, comfort, legal line, note.
import Link from 'next/link';
import type { PublicSettings } from '@dp/contracts';
import { Icon, TextSizeControl, buttonClass, ButtonInner } from '@dp/ui';
import { t } from '@/lib/i18n';
import { formatPhone, whatsappHref } from '@/lib/contact';
import { Brand } from './Brand';
import { mainNav } from './nav';
import { ManageCookiesButton } from './CookieConsent';
import { SimpleModeSwitch } from './SimpleMode';
import s from './Footer.module.css';

export interface FooterBlocks {
  tagline: string | null;
  cafeLine: string | null;
  note: string | null;
}

export interface FooterProps {
  settings: PublicSettings;
  blocks: FooterBlocks;
  year: number;
}

const SOCIALS = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'] as const;

export function Footer({ settings, blocks, year }: FooterProps) {
  const cafe = settings['features.cafe'];
  const callback = settings['features.callbackRequest'];
  const consentService = settings['analytics.enabled'];
  const entries = mainNav.filter((e) => e.href !== '/programmes' && (cafe || !e.cafe));
  const socials = SOCIALS.map((k) => [k, settings[`contact.social.${k}`]] as const).filter(([, url]) => Boolean(url));
  const phone = settings['contact.phone'];
  const email = settings['contact.email'];
  const whatsapp = settings['contact.whatsapp'];

  return (
    <footer className={`${s.footer} icons-dark`}>
      <div className="container">
        <div className={s.top}>
          <Brand tagline={blocks.tagline} homeLabel={t('ui.nav.header.home')} tone="dark" />
          <nav className={s.navs} aria-label={t('ui.nav.footer.nav')}>
            <ul className={s.mainNav} role="list">
              {entries.map((e) => (
                <li key={e.href}>
                  <Link href={e.href} className={[s.mainLink, e.cafe && s.cafe].filter(Boolean).join(' ')}>
                    <Icon name={e.icon} size={32} />
                    {t(e.label)}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className={s.secondaryNav} role="list">
              <li>
                <Link href="/programmes" className={s.smallLink}>
                  {t('ui.nav.footer.properties')}
                </Link>
              </li>
              <li>
                <Link href="/financements#simulateurs" className={s.smallLink}>
                  {t('ui.nav.footer.simulators')}
                </Link>
              </li>
              <li>
                <Link href="/faq" className={s.smallLink}>
                  {t('ui.nav.footer.faq')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className={s.smallLink}>
                  {t('ui.nav.footer.contact')}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <hr className={s.rule} />

        <div className={s.actions}>
          <ul className={s.contacts} role="list">
            <li>
              <Link href={callback ? '?rappel=1' : '/contact?objet=rappel'} className={s.contact} scroll={false}>
                <Icon name="phone" size={20} className={s.contactIcon} />
                {t('ui.nav.footer.callback')}
              </Link>
            </li>
            {phone ? (
              <li>
                <a href={`tel:${phone}`} className={s.contact}>
                  <Icon name="phone" size={20} className={s.contactIcon} />
                  {formatPhone(phone)}
                </a>
              </li>
            ) : null}
            {email ? (
              <li>
                <a href={`mailto:${email}`} className={s.contact}>
                  <Icon name="mail" size={20} className={s.contactIcon} />
                  {email}
                </a>
              </li>
            ) : null}
            {whatsapp ? (
              <li>
                <a href={whatsappHref(whatsapp)} className={s.contact} rel="noopener" target="_blank">
                  <Icon name="chat" size={20} className={s.contactIcon} />
                  {t('ui.nav.footer.whatsapp')}
                </a>
              </li>
            ) : null}
            {cafe && blocks.cafeLine ? (
              <li className={s.contact}>
                <Icon name="map-pin" size={20} className={s.contactIcon} />
                {blocks.cafeLine}
              </li>
            ) : null}
          </ul>
          {cafe ? (
            <Link href="/le-cafe" className={buttonClass('primary', 'M')}>
              <ButtonInner chevron size="M">
                {t('ui.nav.footer.cafeCta')}
              </ButtonInner>
            </Link>
          ) : null}
        </div>

        {socials.length > 0 ? (
          <div className={s.socialRow}>
            <span className={s.socialTitle}>{t('ui.nav.footer.social')}</span>
            {socials.map(([k, url]) => (
              <a key={k} href={url} className={s.socialLink} rel="noopener me" target="_blank">
                {t(`ui.nav.footer.socialNames.${k}`)}
              </a>
            ))}
          </div>
        ) : null}

        <div className={s.comfort}>
          <TextSizeControl
            tone="dark"
            labels={{
              title: t('ui.common.textSize.title'),
              normal: t('ui.common.textSize.normal'),
              large: t('ui.common.textSize.large'),
              xlarge: t('ui.common.textSize.xlarge'),
              sample: t('ui.common.textSize.sample'),
            }}
          />
          <SimpleModeSwitch tone="dark" />
        </div>

        <hr className={s.rule} />

        <div className={s.bottom}>
          <nav aria-label={t('ui.nav.footer.legalNav')}>
            <ul className={s.legalList} role="list">
              <li>{t('ui.nav.footer.copyright', { annee: String(year), societe: settings['contact.companyName'] })}</li>
              <li>
                <Link href="/mentions-legales" className={s.smallLink}>
                  {t('ui.nav.footer.legal')}
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className={s.smallLink}>
                  {t('ui.nav.footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href="/conditions-generales" className={s.smallLink}>
                  {t('ui.nav.footer.terms')}
                </Link>
              </li>
              <li>
                <Link href="/cookies" className={s.smallLink}>
                  {t('ui.nav.footer.cookies')}
                </Link>
              </li>
              {consentService ? (
                <li>
                  <ManageCookiesButton className={s.manage} label={t('ui.nav.footer.manageCookies')} />
                </li>
              ) : null}
              <li>
                <Link href="/partenaires/connexion" className={s.smallLink}>
                  {t('ui.nav.footer.partnerSpace')}
                </Link>
              </li>
              {settings['features.partnerForm'] ? (
                <li>
                  <Link href="/devenir-partenaire" className={s.smallLink}>
                    {t('ui.nav.footer.becomePartner')}
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>
          {blocks.note ? <p className={s.note}>{blocks.note}</p> : null}
        </div>
      </div>
    </footer>
  );
}
