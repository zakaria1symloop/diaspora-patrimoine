// EA-104 « Profil » — `/preferences`.
import type { StaffProfile } from '@dp/contracts';
import { ProfileForm } from '@/components/preferences/Preferences';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet } from '@/components/shell/server';

export default async function Page() {
  const r = await adminGet<StaffProfile>('/admin/me/profile');
  if (!r.ok) return <ReadFailure result={r} />;
  return <ProfileForm profile={r.data} />;
}
