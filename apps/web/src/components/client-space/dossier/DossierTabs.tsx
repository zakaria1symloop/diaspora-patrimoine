'use client';
// ECL-030 — the tabs of a dossier, their address keeps track: « Suivi » always; « Pièces » when the dossier has a list
// of documents (package 2.9), with what is left to deposit. « Financement » and « Mon bien » are absent until their
// packages (ECL-006).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@dp/ui';
import { t } from '@/lib/i18n';
import { documentsPath, dossierPath } from '../menu';
import sp from '../space.module.css';

export function DossierTabs({ reference, documents, documentsLeft = 0 }: { reference: string; documents: boolean; documentsLeft?: number }) {
  const pathname = usePathname() ?? '';
  const base = dossierPath(reference);
  const tabs: { href: string; label: string; icon: IconName; current: boolean; count?: number }[] = [{ href: base, label: t('ui.client.dossier.tabs.followUp'), icon: 'clock', current: pathname === base }];
  if (documents) tabs.push({ href: documentsPath(reference), label: t('ui.client.dossier.tabs.documents'), icon: 'file', current: pathname.startsWith(documentsPath(reference)), count: documentsLeft });
  if (tabs.length < 2) return null;
  return (
    <nav aria-label={t('ui.client.dossier.tabs.label')}>
      <ul role="list" className={sp.subTabs}>
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link href={tab.href} className={sp.subTab} aria-current={tab.current ? 'page' : undefined}>
              <Icon name={tab.icon} size={20} />
              {tab.label}
              {tab.count ? (
                <span className={sp.count} aria-label={t('ui.client.dossier.tabs.documentsLeft', { n: tab.count })}>
                  {tab.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
