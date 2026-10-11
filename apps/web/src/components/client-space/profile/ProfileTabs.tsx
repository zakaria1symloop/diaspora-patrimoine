'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';
import sp from '../space.module.css';

const TABS = [
  { href: '/espace-client/profil', label: 'ui.client.profile.tabs.profile' as const },
  { href: '/espace-client/profil/securite', label: 'ui.client.profile.tabs.security' as const },
  { href: '/espace-client/profil/confidentialite', label: 'ui.client.profile.tabs.privacy' as const },
];

export function ProfileTabs() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label={t('ui.client.profile.tabs.label')}>
      <ul role="list" className={sp.subTabs}>
        {TABS.map((tab) => (
          <li key={tab.href}>
            <Link href={tab.href} className={sp.subTab} aria-current={pathname === tab.href ? 'page' : undefined}>
              {t(tab.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
