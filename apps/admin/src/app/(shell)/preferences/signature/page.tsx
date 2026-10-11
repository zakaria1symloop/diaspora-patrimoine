// EA-104 « Signature » — `/preferences/signature` (BO-070, package 3.2).
import type { StaffProfile } from '@dp/contracts';
import { SignaturePanel } from '@/components/preferences/SignatureAbsence';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet } from '@/components/shell/server';

export default async function Page() {
  const r = await adminGet<StaffProfile>('/admin/me/profile');
  if (!r.ok) return <ReadFailure result={r} />;
  return <SignaturePanel profile={r.data} />;
}
