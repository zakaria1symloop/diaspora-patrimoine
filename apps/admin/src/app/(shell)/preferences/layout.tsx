// EA-104 — « Mes préférences » (BO-070), reached by the account menu (BO-013). Two delivered sections, each with its address.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PreferencesHeader } from '@/components/preferences/Preferences';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-preferences.title') };

export default function PreferencesLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <PreferencesHeader />
      {children}
    </div>
  );
}
