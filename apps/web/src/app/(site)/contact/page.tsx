// EP-19 — Contact (EDI-050): the form on the left (DEM-015, work package 2.5), the contact details on the right — each
// only when its setting is filled (D-045) —, then the next Café when there is one (features.cafe). No map.
// Tags: content, settings; Cafés re-read on each display (NAV-042).
import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import type { CafeListResponse, PublicEventCard } from '@dp/contracts';
import { Icon, type IconName } from '@dp/ui';
import { apiGet } from '@/lib/api';
import { getBlocks, text } from '@/lib/content';
import { getSettings } from '@/lib/settings';
import { formatPhone, whatsappHref } from '@/lib/contact';
import { callbackHref, description, editorialTitle } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { ContactForm } from '@/components/forms/ContactForm';
import { EventCard } from '@/components/vitrine/EventCard';
import { CallCard, PageHead } from '@/components/editorial/Parts';
import { Drawing } from '@/components/editorial/Drawing';
import s from '@/components/editorial/editorial.module.css';

const SOCIALS = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks('Contact')]);
  return {
    title: { absolute: editorialTitle(t('ui.editorial.contact.title'), settings) },
    description: description(text(blocks, 'contactPage.intro')),
    alternates: { canonical: '/contact' },
  };
}

async function nextCafe(enabled: boolean): Promise<PublicEventCard | null> {
  if (!enabled) return null;
  try {
    const res = await apiGet<CafeListResponse>('/public/events', { revalidate: 0 });
    return res.data.find((e) => e.state.kind !== 'CANCELLED') ?? null;
  } catch {
    return null; // the section is optional: the page never fails for it
  }
}

export default async function ContactPage() {
  const [settings, blocks] = await Promise.all([getSettings(), getBlocks('Contact')]);
  const cafe = await nextCafe(settings['features.cafe']);
  const phone = settings['contact.phone'];
  const whatsapp = settings['contact.whatsapp'];
  const email = settings['contact.email'];
  const address = settings['contact.address'];
  const hours = settings['contact.openingHoursLabel'];
  const socials = SOCIALS.map((k) => [k, settings[`contact.social.${k}`]] as const).filter(([, url]) => Boolean(url));

  const rows: { icon: IconName; label: string; value: ReactNode }[] = [];
  if (phone) rows.push({ icon: 'phone', label: t('ui.editorial.contact.phone'), value: <a href={`tel:${phone}`} className={s.coordValue}>{formatPhone(phone)}</a> });
  if (whatsapp)
    rows.push({
      icon: 'chat',
      label: t('ui.editorial.contact.whatsapp'),
      value: (
        <a href={whatsappHref(whatsapp)} target="_blank" rel="noopener noreferrer" className={s.coordValue}>
          {t('ui.editorial.contact.whatsappAction')}
          <span className="visually-hidden"> {t('ui.editorial.common.newTab')}</span>
        </a>
      ),
    });
  if (email) rows.push({ icon: 'mail', label: t('ui.editorial.contact.email'), value: <a href={`mailto:${email}`} className={s.coordValue}>{email}</a> });
  if (address) rows.push({ icon: 'map-pin', label: t('ui.editorial.contact.address'), value: <span className={`${s.coordValue} ${s.prewrap}`}>{address}</span> });
  if (hours) rows.push({ icon: 'clock', label: t('ui.editorial.contact.hours'), value: <span className={s.coordValue}>{hours}</span> });
  if (socials.length)
    rows.push({
      icon: 'globe',
      label: t('ui.editorial.contact.social'),
      value: (
        <span className={s.socials}>
          {socials.map(([k, url]) => (
            <a key={k} href={url} target="_blank" rel="noopener noreferrer" className={s.coordValue}>
              {t(`ui.nav.footer.socialNames.${k}`)}
              <span className="visually-hidden"> {t('ui.editorial.common.newTab')}</span>
            </a>
          ))}
        </span>
      ),
    });

  return (
    <>
      <PageHead title={t('ui.editorial.contact.title')} intro={text(blocks, 'contactPage.intro')} drawing="contact" />

      <section className={`${s.section} ${s.bgIvoire}`} aria-label={t('ui.editorial.contact.title')}>
        <div className={`container ${s.contactGrid}`}>
          <div>
            <Suspense fallback={null}>
              <ContactForm settings={settings} />
            </Suspense>
          </div>
          <aside className={s.contactAside}>
            {rows.length ? (
              <div className={s.coordinates}>
                <h2 className={s.coordinatesTitle}>{t('ui.editorial.contact.coordinates')}</h2>
                {rows.map((r) => (
                  <div key={r.label} className={s.coord}>
                    <span className={s.coordIcon}>
                      <Icon name={r.icon} size={20} />
                    </span>
                    <div>
                      <span className={s.coordLabel}>{r.label}</span>
                      {r.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Drawing name="contact" className={s.contactDrawing} />
            )}
            {cafe ? (
              <div className={s.cafeBox}>
                <h2 className={s.coordinatesTitle}>{t('ui.editorial.contact.cafeTitle')}</h2>
                <EventCard event={cafe} next />
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <CallCard href={callbackHref(settings)} />
    </>
  );
}
