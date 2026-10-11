// BO-002 — `/mot-de-passe-oublie` (AUTH-045, templates `S_`).
import type { Metadata } from 'next';
import { ForgotDoor } from '@/components/door/Doors';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.auth.forgot.title') };

export default function Page() {
  return <ForgotDoor />;
}
