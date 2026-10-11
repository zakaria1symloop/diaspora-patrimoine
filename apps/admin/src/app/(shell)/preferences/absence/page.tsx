// EA-104 « Absence » — `/preferences/absence` (BO-070, package 3.2).
import type { StaffProfile } from '@dp/contracts';
import { AbsencePanel } from '@/components/preferences/SignatureAbsence';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet } from '@/components/shell/server';

export default async function Page() {
  const r = await adminGet<StaffProfile>('/admin/me/profile');
  if (!r.ok) return <ReadFailure result={r} />;
  return <AbsencePanel profile={r.data} />;
}
