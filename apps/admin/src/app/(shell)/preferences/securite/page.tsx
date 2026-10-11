// EA-104 « Sécurité » — `/preferences/securite` (the address the security e-mails lead to).
import type { StaffProfile } from '@dp/contracts';
import { SecurityPanel } from '@/components/preferences/Preferences';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet } from '@/components/shell/server';

export default async function Page() {
  const r = await adminGet<StaffProfile>('/admin/me/profile');
  if (!r.ok) return <ReadFailure result={r} />;
  return <SecurityPanel profile={r.data} />;
}
