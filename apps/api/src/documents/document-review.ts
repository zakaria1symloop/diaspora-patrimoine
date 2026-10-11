// CYC-142, CYC-143, GED-055 — the team's side of a piece, kept to what the demonstration needs today (PAR-082) and
// reused by the back office (package 4.x): a deposit made for the client (`uploadedVia = ADMIN`), the validation (with
// the document's date and its validity) and the rejection (reason, note, new due date).
import type { Actor } from '../admin/actor.js';
import { stampBy } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import type { ObjectStorage } from '../files/object-storage.js';
import { cleanFileName } from '../files/media-pipeline.js';
import { newId } from '../platform/ids.js';
import type { OutboxWriter } from '../platform/outbox.js';
import type { Tx } from '../platform/tx.js';
import { documentFileKey } from './client-documents.service.js';
import { recomputeCompleteness } from './document-processing.js';
import { daysUntil, pdfPageCount, sniffDocumentType } from './document-rules.js';
import { createHash } from 'node:crypto';

export class ReviewError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * GED-055 — a deposit made by the team for the client: the files are written to their final keys, the version is born
 * SCANNING and the `documents` work (document-processing.ts) checks and installs it. On a validated piece it is a
 * renewal (CYC-141). Returns the version id and the sources for the processing.
 */
export async function createStaffVersion(
  tx: Tx,
  storage: ObjectStorage,
  outbox: OutboxWriter,
  input: { documentId: string; files: { body: Buffer; fileName: string }[]; actor: Actor; now: Date },
): Promise<{ versionId: string; sources: Record<string, string> }> {
  const doc = await tx.dossierDocument.findUniqueOrThrow({ where: { id: input.documentId } });
  const last = await tx.documentVersion.aggregate({ where: { documentId: doc.id }, _max: { number: true } });
  const versionId = newId();
  await tx.documentVersion.create({
    data: {
      id: versionId,
      documentId: doc.id,
      number: (last._max.number ?? 0) + 1,
      uploadedById: stampBy(input.actor),
      uploadedVia: 'ADMIN',
      uploadedAt: input.now,
      outcome: 'SCANNING',
      isRenewal: doc.status === 'VALIDATED',
      createdAt: input.now,
      updatedAt: input.now,
    },
  });
  let order = 0;
  for (const f of input.files) {
    const mime = sniffDocumentType(f.body);
    if (!mime) throw new ReviewError('UNSUPPORTED_FILE_TYPE');
    const id = newId();
    const key = documentFileKey(doc.dossierId, doc.id, id);
    await storage.put('private', key, f.body, mime);
    await tx.documentFile.create({
      data: {
        id,
        versionId,
        documentId: doc.id,
        sortOrder: ++order,
        storageKey: key,
        fileName: cleanFileName(f.fileName),
        mimeType: mime,
        sizeBytes: BigInt(f.body.length),
        checksumSha256: createHash('sha256').update(f.body).digest('hex'),
        pageCount: mime === 'application/pdf' ? pdfPageCount(f.body) : null,
        scanStatus: 'PENDING',
        createdAt: input.now,
        updatedAt: input.now,
      },
    });
  }
  await writeAudit(tx, input.actor, input.now, { action: 'document.uploaded', entityType: 'dossier_document', entityId: doc.id, after: { files: order, via: 'ADMIN' } });
  await outbox.add(tx, { type: 'document.version_created', aggregateType: 'DossierDocument', aggregateId: doc.id, payload: { versionId, sources: {} } }, input.now);
  return { versionId, sources: {} };
}

/**
 * CYC-142 — RECEIVED → VALIDATED (or the renewal waiting beside a validated piece). `issuedAt` (`YYYY-MM-DD`): the
 * document's date, else the deposit date; with a validity, `expiresAt` = date + validityDays, refused when not in the
 * future (`DOCUMENT_TOO_OLD`).
 */
export async function validateDocument(
  tx: Tx,
  outbox: OutboxWriter,
  input: { documentId: string; actor: Actor; now: Date; today: string; issuedAt?: string | null },
): Promise<void> {
  const doc = await tx.dossierDocument.findUniqueOrThrow({ where: { id: input.documentId } });
  const renewal = doc.status === 'VALIDATED' && doc.renewalVersion !== null;
  const number = renewal ? doc.renewalVersion! : doc.currentVersion;
  if (!renewal && (doc.status !== 'RECEIVED' || number < 1)) throw new ReviewError('TRANSITION_NOT_ALLOWED');
  const version = await tx.documentVersion.findUniqueOrThrow({ where: { documentId_number: { documentId: doc.id, number } } });
  if (version.outcome !== 'IN_REVIEW') throw new ReviewError('TRANSITION_NOT_ALLOWED');
  const issued = input.issuedAt ?? version.uploadedAt.toISOString().slice(0, 10);
  const expires = doc.validityDays ? addDays(issued, doc.validityDays) : null;
  if (expires && daysUntil(expires, input.today) <= 0) throw new ReviewError('DOCUMENT_TOO_OLD');
  const by = stampBy(input.actor);
  if (renewal) {
    await tx.documentVersion.updateMany({ where: { documentId: doc.id, number: doc.currentVersion, outcome: 'VALIDATED' }, data: { outcome: 'REPLACED', updatedAt: input.now } });
  }
  await tx.documentVersion.update({ where: { id: version.id }, data: { outcome: 'VALIDATED', decidedById: by, decidedAt: input.now, updatedAt: input.now } });
  await tx.dossierDocument.update({
    where: { id: doc.id },
    data: {
      status: 'VALIDATED',
      statusChangedAt: renewal ? doc.statusChangedAt : input.now,
      currentVersion: number,
      renewalVersion: null,
      validatedById: by,
      validatedAt: input.now,
      issuedAt: dayDate(issued),
      expiresAt: expires ? dayDate(expires) : null,
      version: { increment: 1 },
      updatedById: by,
      updatedAt: input.now,
    },
  });
  await recomputeCompleteness(tx, doc.dossierId, input.now);
  await writeAudit(tx, input.actor, input.now, { action: 'document.validated', entityType: 'dossier_document', entityId: doc.id, after: { version: number, issuedAt: issued, expiresAt: expires, renewal } });
  await outbox.add(tx, { type: 'document.validated', aggregateType: 'Dossier', aggregateId: doc.dossierId, payload: { documentId: doc.id, isRenewal: renewal } }, input.now);
}

/** CYC-143 — RECEIVED → REJECTED with its reason (note required for OTHER), new due date; a renewal only loses itself. */
export async function rejectDocument(
  tx: Tx,
  outbox: OutboxWriter,
  input: { documentId: string; actor: Actor; now: Date; today: string; dueDays: number; reason: 'ILLEGIBLE' | 'INCOMPLETE' | 'TOO_OLD' | 'WRONG_DOCUMENT' | 'OTHER'; note?: string | null },
): Promise<void> {
  if (input.reason === 'OTHER' && !input.note?.trim()) throw new ReviewError('NOTE_REQUIRED');
  const doc = await tx.dossierDocument.findUniqueOrThrow({ where: { id: input.documentId } });
  const renewal = doc.status === 'VALIDATED' && doc.renewalVersion !== null;
  const number = renewal ? doc.renewalVersion! : doc.currentVersion;
  if (!renewal && (doc.status !== 'RECEIVED' || number < 1)) throw new ReviewError('TRANSITION_NOT_ALLOWED');
  const by = stampBy(input.actor);
  const note = input.note?.trim() || null;
  await tx.documentVersion.updateMany({
    where: { documentId: doc.id, number, outcome: 'IN_REVIEW' },
    data: { outcome: 'REJECTED', decidedById: by, decidedAt: input.now, rejectionReason: input.reason, rejectionNote: note, updatedAt: input.now },
  });
  await tx.dossierDocument.update({
    where: { id: doc.id },
    data: renewal
      ? { renewalVersion: null, version: { increment: 1 }, updatedById: by, updatedAt: input.now }
      : {
          status: 'REJECTED',
          statusChangedAt: input.now,
          rejectionReason: input.reason,
          rejectionNote: note,
          dueAt: dayDate(addDays(input.today, input.dueDays)),
          reminderBaseAt: input.now,
          version: { increment: 1 },
          updatedById: by,
          updatedAt: input.now,
        },
  });
  await recomputeCompleteness(tx, doc.dossierId, input.now);
  await writeAudit(tx, input.actor, input.now, { action: 'document.rejected', entityType: 'dossier_document', entityId: doc.id, after: { version: number, reason: input.reason, renewal } });
  await outbox.add(tx, { type: 'document.rejected', aggregateType: 'Dossier', aggregateId: doc.dossierId, payload: { documentId: doc.id, isRenewal: renewal, reason: input.reason } }, input.now);
}
