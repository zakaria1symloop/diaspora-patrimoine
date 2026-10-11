// The frame of every signed-in page of the back office (BO-010). The summary is read on the server with the staff
// member cookies, never cached; without a live session the page renews it in the browser or goes to the door.
import type { ReactNode } from 'react';
import { AdminFrame } from '@/components/shell/AdminFrame';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { getShell } from '@/components/shell/server';

export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const shell = await getShell();
  if (!shell.ok) {
    return (
      <main id="contenu" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
        <ReadFailure result={shell} />
      </main>
    );
  }
  return <AdminFrame shell={shell.data}>{children}</AdminFrame>;
}
