// The frame of every account page (EC-01…EC-09, EP-32, EP-33): the task on a card, a drawn scene that plays once
// (D-092, DSN-076), a short list of what the space brings (D-093: little text), the other door (ACP-080), and the
// contact line of AUTH-020 / AUTH-098. Server component: the contact settings are read here.
import type { ReactNode } from 'react';
import { Icon, Scene, type IconName, type SceneName } from '@dp/ui';
import { formatPhone } from '@/lib/contact';
import { t } from '@/lib/i18n';
import { getSettings } from '@/lib/settings';
import type { ContactInfo } from './kit';
import s from './auth.module.css';

export async function contactInfo(partner = false): Promise<ContactInfo> {
  const settings = await getSettings().catch(() => null);
  const phone = settings?.['contact.phone'] || null;
  const email = (partner ? settings?.['contact.partnersEmail'] : null) || settings?.['contact.email'] || null;
  return { phone, phoneLabel: phone ? formatPhone(phone) : null, email };
}

export function AuthShell({
  scene,
  children,
  benefits,
}: {
  scene: SceneName;
  children: ReactNode;
  benefits?: { icon: IconName; text: string }[];
}) {
  return (
    <div className={s.page}>
      <div className={`container ${s.grid}`}>
        <div className={s.card}>{children}</div>
        <div className={s.side}>
          <Scene name={scene} className={s.scene} />
          {benefits?.length ? (
            <ul className={s.benefits}>
              {benefits.map((b) => (
                <li key={b.text}>
                  <Icon name={b.icon} size={24} />
                  {b.text}
                </li>
              ))}
            </ul>
          ) : null}
          <p className={s.secure}>
            <Icon name="shield" size={16} />
            {t('ui.auth.common.secure')}
          </p>
        </div>
      </div>
    </div>
  );
}

/** The client space's three promises (EC-01, EC-02). */
export const CLIENT_BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'check', text: t('ui.auth.signup.benefits.follow') },
  { icon: 'calculator', text: t('ui.auth.signup.benefits.simulations') },
  { icon: 'lock', text: t('ui.auth.signup.benefits.documents') },
];

/** ACP-081 — the three lines for the hurried partner (no figure, D-048). */
export const PARTNER_BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'check', text: t('ui.auth.partner.signup.free') },
  { icon: 'file', text: t('ui.auth.partner.signup.convention') },
  { icon: 'user', text: t('ui.auth.partner.signup.contact') },
];
