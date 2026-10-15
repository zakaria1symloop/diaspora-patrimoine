// BO-050 — the entries of a timeline that come from `Communication` (e-mails, calls, WhatsApp exchanges, meetings),
// written once for every object that shows them: the request (`leads/{id}/timeline`), the client
// (`clients/{id}/timeline`), later the dossier. They follow `communication.read`; the caller checks it.
// SEC-032 — a subject and a report are free text: never sent to the SUPPORT role.
import { EXCHANGE_EDIT_HOURS, type AdminTimelineEntry, type TimelineType } from '@dp/contracts';
import { staffName, type StaffView } from '../back-office/staff-view.js';
import type { Prisma } from '../generated/prisma/client.js';

export const COMMUNICATION_ENTRY_SELECT = {
  id: true,
  channel: true,
  direction: true,
  subject: true,
  templateCode: true,
  deliveryState: true,
  triggeredBy: true,
  occurredAt: true,
  body: true,
  callOutcome: true,
  durationMinutes: true,
  sentById: true,
  leadId: true,
  clientId: true,
  dossierId: true,
  createdAt: true,
  scheduledFor: true,
  failureReason: true,
  attachments: true,
  sentBy: { select: { firstName: true, lastName: true, status: true } },
} satisfies Prisma.CommunicationSelect;
export type CommunicationEntryRow = Prisma.CommunicationGetPayload<{ select: typeof COMMUNICATION_ENTRY_SELECT }>;

/** The timeline type of a row: an e-mail, or an exchange noted by hand (shown under « Appels et échanges »). */
export function communicationType(row: Pick<CommunicationEntryRow, 'channel'>): TimelineType {
  return row.channel === 'EMAIL' ? 'EMAIL' : 'CALL';
}

/** The files of a hand-written or received e-mail (`email-attachments.service.ts`), as the timeline lists them. */
function manualFiles(value: unknown): { uploadId: string; name: string; sizeBytes: number }[] {
  return Array.isArray(value) ? (value as { uploadId?: unknown; name?: unknown; sizeBytes?: unknown }[]).flatMap((a) => (typeof a?.uploadId === 'string' && typeof a.name === 'string' ? [{ uploadId: a.uploadId, name: a.name, sizeBytes: Number(a.sizeBytes) || 0 }] : [])) : [];
}

/** One entry per row; `want` leaves out the types the reader filtered away. */
export function communicationEntries(rows: readonly CommunicationEntryRow[], staff: StaffView, want: (type: TimelineType) => boolean = () => true, now: Date = new Date()): AdminTimelineEntry[] {
  const out: AdminTimelineEntry[] = [];
  const recent = (c: CommunicationEntryRow) => c.sentById === staff.userId && now.getTime() - c.createdAt.getTime() <= EXCHANGE_EDIT_HOURS * 3600_000;
  for (const c of rows) {
    // an e-mail to the team (S_*) is not part of the client's story
    if (c.templateCode?.startsWith('S_')) continue;
    const type = communicationType(c);
    if (!want(type)) continue;
    out.push({
      id: `communication:${c.id}`,
      type,
      code: c.channel === 'EMAIL' ? (c.direction === 'INBOUND' ? 'email.RECEIVED' : `email.${c.deliveryState ?? 'SENT'}`) : `exchange.${c.channel}`,
      params: { template: c.templateCode, direction: c.direction },
      // a reminder or an automatic e-mail has no sender: « Automatique »
      author: c.sentBy ? { kind: 'STAFF', name: staffName(c.sentBy) } : { kind: 'SYSTEM', name: null },
      at: c.occurredAt.toISOString(),
      // The stored subject of an e-mail carries no personal link (NOT-002).
      detail: staff.masked ? null : c.channel === 'EMAIL' ? c.subject : c.body,
      ...(c.channel === 'EMAIL'
        ? {
            email: {
              id: c.id,
              direction: c.direction,
              manual: c.triggeredBy === 'MANUAL',
              scheduledFor: c.deliveryState === 'QUEUED' && c.scheduledFor ? c.scheduledFor.toISOString() : null,
              failureReason: c.failureReason,
              canCancel: c.triggeredBy === 'MANUAL' && c.deliveryState === 'QUEUED' && c.sentById === staff.userId,
              // COM-020, COM-030 — its files; personal: never shown to a masked reader (ROL-015)
              attachments: staff.masked ? [] : manualFiles(c.attachments),
            },
          }
        : { exchange: { id: c.id, channel: c.channel as 'CALL', direction: c.direction, outcome: c.callOutcome, durationMinutes: c.durationMinutes, canEdit: recent(c) && staff.has('communication.log'), canDelete: recent(c) && staff.has('communication.log') } }),
    });
  }
  return out;
}
