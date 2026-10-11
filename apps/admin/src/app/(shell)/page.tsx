// BO-011 — before the dashboard (EA-01) is delivered, the landing page is the first entry of the menu the role can open.
import { redirect } from 'next/navigation';
import { landingPath } from '@/components/shell/menu';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { getShell } from '@/components/shell/server';

export default async function Page() {
  const shell = await getShell();
  if (!shell.ok) return <ReadFailure result={shell} />;
  redirect(landingPath(shell.data.permissions));
}
