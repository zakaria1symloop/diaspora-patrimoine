// EC-14 — « Rendez-vous » (03-espace-client/03 § 4; packages 3.8 and A.8): the list (INT-041), the cancellation
// (INT-042), the request (INT-040, `features.clientAppointments`). Private data: the visitor's cookies, never cached.
import type { Metadata } from 'next';
import type { ClientAppointments, ClientInterests, TrustedPerson } from '@dp/contracts';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { AppointmentsBoard } from '@/components/client-space/appointments/AppointmentsBoard';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: t('ui.client.appointments.seoTitle') };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ demande?: string }> }) {
  const [list, interests, contacts, params] = await Promise.all([
    spaceGet<ClientAppointments>('/client/appointments'),
    spaceGet<ClientInterests>('/client/interests'),
    spaceGet<{ data: TrustedPerson[] }>('/client/contacts'),
    searchParams,
  ]);
  if (!list.ok) return <SpaceReadFailure result={list} />;
  // INT-040 — a visit is about a property of the client's that may be visited: « Intérêt envoyé » or « Visité ».
  const candidates = interests.ok
    ? interests.data.properties
        .filter((c) => (c.status === 'INTERESTED' || c.status === 'VISITED') && !c.unavailable)
        .map((c) => ({ id: c.id, title: c.property.title, reference: c.property.reference }))
    : [];
  const people = contacts.ok ? contacts.data.data : [];
  return (
    <AppointmentsBoard
      data={list.data}
      candidates={candidates}
      contacts={people.filter((p) => p.canVisitOnBehalf).map((p) => ({ id: p.id, fullName: p.fullName }))}
      initialRequest={params.demande ?? null}
    />
  );
}
