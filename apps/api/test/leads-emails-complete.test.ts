// Package 3.2 completed — pure rules: the real type of a hand-written e-mail's attachment (MED-010, MED-011), the
// files of an e-mail as the timeline lists them (COM-020, COM-030; never to a masked reader, ROL-015), and when a caller
// may « Créer la fiche partenaire » from a request (CRM-011, BO-047).
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { Permission } from '@dp/contracts';
import { leadCan, type LeadState } from '../src/back-office/leads-admin.service.js';
import { communicationEntries, type CommunicationEntryRow } from '../src/crm/communication-entries.js';
import { attachmentsOf, sniffAttachmentType } from '../src/exchanges-admin/email-attachments.service.js';

describe('MED-010, MED-011 — the real type of an attachment, read in its content', () => {
  const zip = (entry: string) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(`....[Content_Types].xml ${entry} ....`, 'latin1')]);
  it('PDF, JPEG, PNG, Word and Excel are recognised', () => {
    expect(sniffAttachmentType(Buffer.from('%PDF-1.4\n...'))).toBe('application/pdf');
    expect(sniffAttachmentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(sniffAttachmentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffAttachmentType(zip('word/document.xml'))).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(sniffAttachmentType(zip('xl/workbook.xml'))).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
  it('anything else is refused — a renamed text file, a plain ZIP, an empty file', () => {
    expect(sniffAttachmentType(Buffer.from('hello'))).toBeNull();
    expect(sniffAttachmentType(zip('readme.txt'))).toBeNull();
    expect(sniffAttachmentType(Buffer.alloc(0))).toBeNull();
  });
  it('`Communication.attachments` keeps only well-formed entries', () => {
    expect(attachmentsOf(null)).toEqual([]);
    expect(attachmentsOf([{ uploadId: 'u1', name: 'a.pdf', storageKey: 'emails/c/u1', sizeBytes: 10, mimeType: 'application/pdf' }, { name: 'broken' }])).toHaveLength(1);
  });
});

describe('COM-020, COM-030, ROL-015 — the files of an e-mail in the timeline', () => {
  const row = (over: Partial<CommunicationEntryRow> = {}): CommunicationEntryRow =>
    ({
      id: 'c-1',
      channel: 'EMAIL',
      direction: 'INBOUND',
      subject: 'Mes pièces',
      templateCode: null,
      deliveryState: null,
      triggeredBy: 'MANUAL',
      occurredAt: new Date('2026-10-15T08:00:00Z'),
      body: 'Bonjour',
      callOutcome: null,
      durationMinutes: null,
      sentById: 'u-1',
      leadId: null,
      clientId: 'cl-1',
      dossierId: 'd-1',
      createdAt: new Date('2026-10-15T08:00:00Z'),
      scheduledFor: null,
      failureReason: null,
      attachments: [{ uploadId: 'up-1', name: 'avis.pdf', storageKey: 'emails/c-1/up-1', sizeBytes: 1200, mimeType: 'application/pdf' }],
      sentBy: { firstName: 'Samia', lastName: 'Kaci', status: 'ACTIVE' },
      ...over,
    }) as CommunicationEntryRow;
  const reader = (masked: boolean) => ({ userId: 'u-2', role: 'AGENT' as never, has: () => true, scoped: false, masked, sensitive: false });
  it('listed with their name and size — never the storage key', () => {
    const [entry] = communicationEntries([row()], reader(false));
    expect(entry!.email!.attachments).toEqual([{ uploadId: 'up-1', name: 'avis.pdf', sizeBytes: 1200 }]);
  });
  it('a masked reader (Support) sees none', () => {
    const [entry] = communicationEntries([row()], reader(true));
    expect(entry!.email!.attachments).toEqual([]);
  });
});

describe('CRM-011, BO-047 — « Créer la fiche partenaire »', () => {
  const NOW = new Date('2026-10-15T08:00:00Z');
  const staff = (perms: Permission[]) => ({ userId: 'u-me', role: 'ADMIN' as never, has: (p: Permission) => perms.includes(p) });
  const lead = (over: Partial<LeadState> = {}): LeadState => ({ kind: 'PARTNER_REQUEST', status: 'NEW', assignedAgentId: null, firstContactAt: null, needsReview: false, applicationStatus: null, dossierId: null, clientId: null, closedById: null, closedAt: null, liveDossiers: 0, ...over });
  const both: Permission[] = ['lead.process', 'content.manage'];
  it('offered on an open « Devenir partenaire » request to whoever holds content.manage and lead.process', () => {
    expect(leadCan(lead(), staff(both), NOW).createPartner).toEqual({ allowed: true });
    expect(leadCan(lead({ status: 'IN_PROGRESS' }), staff(both), NOW).createPartner).toEqual({ allowed: true });
  });
  it('absent without the right, on another nature, or on a partner sign-up (ACP-084 has its own gestures)', () => {
    expect(leadCan(lead(), staff(['lead.process']), NOW).createPartner).toBeUndefined();
    expect(leadCan(lead({ kind: 'CONTACT_MESSAGE' }), staff(both), NOW).createPartner).toBeUndefined();
    expect(leadCan(lead({ applicationStatus: 'PENDING' }), staff(both), NOW).createPartner).toBeUndefined();
  });
  it('refused with its reason once the request is closed', () => {
    expect(leadCan(lead({ status: 'CLOSED' }), staff(both), NOW).createPartner).toEqual({ allowed: false, reason: 'STATUS_CLOSED' });
  });
});
