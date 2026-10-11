'use client';
// ECL-001 — « Biens » (phone tab) opens a page with two tabs, « Mes intérêts » (EC-12) then « Biens proposés » (EC-13),
// whose badge is EC-13's. Shown on every width: the two pages are siblings.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';
import { useSpace } from '../SpaceContext';
import sp from '../space.module.css';

export function BiensTabs() {
  const pathname = usePathname() ?? '';
  const { summary } = useSpace();
  const n = summary.badges.proposals;
  return (
    <nav aria-label={t('ui.client.properties.tabs.label')}>
      <ul role="list" className={sp.subTabs}>
        <li>
          <Link href="/espace-client/interets" className={sp.subTab} aria-current={pathname.startsWith('/espace-client/interets') ? 'page' : undefined}>
            {t('ui.client.properties.tabs.interests')}
          </Link>
        </li>
        <li>
          <Link href="/espace-client/biens-proposes" className={sp.subTab} aria-current={pathname.startsWith('/espace-client/biens-proposes') ? 'page' : undefined}>
            {t('ui.client.properties.tabs.proposals')}
            {n > 0 ? (
              <span className={sp.count} aria-label={t('ui.client.shell.badgeNew', { n })}>
                {n > 99 ? '99+' : n}
              </span>
            ) : null}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
