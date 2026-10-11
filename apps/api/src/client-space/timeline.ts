// ECL-031 — the client timeline: one `ClientTimelineEntry` per fact the client may read, written IN THE TRANSACTION of
// the gesture that produces it, with the values of its sentence frozen that day (`params`). Never recomputed.
// Kinds: `ClientTimelineKind` (technical, never displayed); the screen composes the sentence (API-002).
import { newId } from '../platform/ids.js';
import type { Tx } from '../platform/tx.js';

export type TimelineKind =
  | 'LEAD_SENT'
  | 'LEAD_SENT_AGAIN'
  | 'AGENT_ASSIGNED'
  | 'QUALIFIED'
  | 'PROPERTIES_PROPOSED'
  | 'CONSENT_GIVEN'
  | 'CONSENT_WITHDRAWN';

export async function writeClientTimeline(
  tx: Tx,
  entry: { dossierId: string; kind: TimelineKind; params: Record<string, string | number | null>; at: Date },
): Promise<void> {
  await tx.clientTimelineEntry.create({
    data: { id: newId(), dossierId: entry.dossierId, kind: entry.kind, occurredAt: entry.at, params: entry.params as never, createdAt: entry.at },
  });
}

/** TRV-145 — « Amel K. »: first name and initial of the last name. */
export function advisorDisplayName(firstName: string | null, lastName: string | null): string | null {
  if (!firstName) return null;
  return lastName ? `${firstName} ${lastName.trim().charAt(0).toUpperCase()}.` : firstName;
}

/** « Demande envoyée » / « Seconde demande » — `nature` is the request kind, `bien` the property title of that day. */
export async function writeLeadLine(
  tx: Tx,
  a: { dossierId: string; again: boolean; kind: string; propertyTitle: string | null; leadReference: string; at: Date },
): Promise<void> {
  await writeClientTimeline(tx, {
    dossierId: a.dossierId,
    kind: a.again ? 'LEAD_SENT_AGAIN' : 'LEAD_SENT',
    params: { nature: a.kind, bien: a.propertyTitle, reference: a.leadReference },
    at: a.at,
  });
}

/** « {conseiller} suit votre projet. » */
export async function writeAdvisorLine(tx: Tx, a: { dossierId: string; agentId: string; at: Date }): Promise<void> {
  const user = await tx.user.findUnique({ where: { id: a.agentId }, select: { firstName: true, lastName: true } });
  await writeClientTimeline(tx, {
    dossierId: a.dossierId,
    kind: 'AGENT_ASSIGNED',
    params: { conseiller: advisorDisplayName(user?.firstName ?? null, user?.lastName ?? null) },
    at: a.at,
  });
}
