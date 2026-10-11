// API-081 « Effets », MED-032, MED-035, CYC-140 — the background work of a new version (the `documents` queue of
// ARC-050, carried here by the outbox): `document.version_created` →
//   1. each file is copied to its final key (from `uploads/{uploadId}` — the original then erased — or from the kept
//      file's key: every version owns its objects);
//   2. antivirus on every file, kept ones included: INFECTED → erased, row kept and marked; ERROR (scanner down) → the
//      file stays PENDING and the event is retried later (the screen keeps « Vérification de sécurité en cours »);
//   3. the sane images are joined, in the chosen order, into ONE PDF (MED-032); impossible to join → DISCARDED;
//   4. CYC-140: at least one sane file → the version becomes the current one (IN_REVIEW, piece RECEIVED) or, for a
//      renewal of a validated piece, waits beside it (`renewalVersion`); none → DISCARDED, nothing else moves.
// A refused deposit (whole, partial, unreadable photos) notifies the client in his space (NC_FILE_REFUSED) and, if he
// has not seen it two minutes later, by e-mail (C_FILE_REFUSED, documents-mail.handler.ts).
import { createHash } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import type { DocumentFile } from '../generated/prisma/client.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../files/object-storage.js';
import { VIRUS_SCANNER, type VirusScanner } from '../files/virus-scanner.js';
import { notifyClient } from '../client-tools/client-notify.js';
import { Clock } from '../platform/clock.js';
import { newId } from '../platform/ids.js';
import { OutboxHandlers, OutboxWriter, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { log } from '../platform/request-context.js';
import type { Tx } from '../platform/tx.js';
import { completeness, isImageMime, type DocStatus } from './document-rules.js';
import { assemblePdf, UnreadableImageError } from './pdf-assembly.js';

const t = createTranslator('fr');

/** The e-mail waits this long: a client still on the screen reads the message there and the notification is read. */
export const REFUSED_MAIL_DELAY_MS = 2 * 60_000;

export type RefusalKind = 'REFUSED' | 'PARTIAL' | 'UNREADABLE';

export class ScanPendingError extends Error {
  constructor() {
    super('antivirus unavailable: files stay pending');
  }
}

/** The client's documents page of a dossier (links of notifications and e-mails). */
export const documentsPagePath = (reference: string) => `/espace-client/dossiers/${encodeURIComponent(reference)}/pieces`;

/** CAL-055 — recomputes the cached completeness of a dossier. */
export async function recomputeCompleteness(tx: Tx, dossierId: string, at: Date): Promise<void> {
  const docs = await tx.dossierDocument.findMany({
    where: { dossierId },
    select: { isRequired: true, isInternal: true, status: true, party: { select: { removedAt: true } } },
  });
  const c = completeness(docs.map((d) => ({ isRequired: d.isRequired, isInternal: d.isInternal, status: d.status as DocStatus, partyRemoved: Boolean(d.party?.removedAt) })));
  await tx.dossier.update({ where: { id: dossierId }, data: { requiredDocsCount: c.required, satisfiedDocsCount: c.satisfied, completenessPct: c.pct, updatedAt: at } });
}

@Injectable()
export class DocumentProcessing implements OutboxHandler, OnModuleInit {
  readonly name = 'documents.processing';
  readonly types = ['document.version_created'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly handlers: OutboxHandlers,
    private readonly outbox: OutboxWriter,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(event: OutboxRecord): Promise<void> {
    const versionId = String(event.payload.versionId ?? '');
    const sources = (event.payload.sources ?? {}) as Record<string, string>;
    await this.process(versionId, sources);
  }

  /** Idempotent: a version that already left SCANNING is left alone; files already checked are not scanned again. */
  async process(versionId: string, sources: Record<string, string>): Promise<'DONE' | 'SKIPPED'> {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: { include: { dossier: { select: { id: true, reference: true, clientId: true } } } }, documentFiles: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!version || version.outcome !== 'SCANNING' || version.deletedAt) return 'SKIPPED';

    // Steps 1 and 2 — copy, then scan, file by file.
    let pending = false;
    for (const file of version.documentFiles) {
      if (file.deletedAt || file.scanStatus !== 'PENDING') continue;
      const outcome = await this.copyAndScan(file, sources[file.id]);
      if (outcome === 'ERROR') pending = true;
    }
    if (pending) {
      log('warn', 'documents.scan_pending', { versionId });
      throw new ScanPendingError(); // retried by the outbox (1 min, 5 min, 30 min…)
    }

    const files = await this.prisma.documentFile.findMany({ where: { versionId }, orderBy: { sortOrder: 'asc' } });
    const sane = files.filter((f) => !f.deletedAt && f.scanStatus === 'CLEAN');
    const infected = files.filter((f) => f.scanStatus === 'INFECTED').length;
    let refusal: RefusalKind | null = sane.length === 0 ? 'REFUSED' : infected > 0 ? 'PARTIAL' : null;

    // Step 3 — MED-032.
    const images = sane.filter((f) => isImageMime(f.mimeType));
    let assembled: { id: string; key: string; pdf: Buffer; pages: number; sortOrder: number } | null = null;
    if (sane.length && images.length) {
      const bodies: Buffer[] = [];
      for (const img of images) {
        const body = await this.storage.get('private', img.storageKey);
        if (!body) {
          refusal = 'UNREADABLE';
          break;
        }
        bodies.push(body);
      }
      if (refusal !== 'UNREADABLE') {
        try {
          const { pdf, pages } = await assemblePdf(bodies, version.document.label);
          const id = newId();
          const key = `documents/${version.document.dossierId}/${version.documentId}/${id}`;
          await this.storage.put('private', key, pdf, 'application/pdf');
          assembled = { id, key, pdf, pages, sortOrder: images[0]!.sortOrder };
        } catch (err) {
          if (!(err instanceof UnreadableImageError)) throw err;
          refusal = 'UNREADABLE';
        }
      }
    }
    const discarded = sane.length === 0 || refusal === 'UNREADABLE';

    // Step 4 — CYC-140, in one transaction.
    const now = this.clock.now();
    const doc = version.document;
    const dossier = doc.dossier;
    await this.prisma.$transaction(
      async (tx) => {
        const fresh = await tx.documentVersion.findUnique({ where: { id: versionId }, select: { outcome: true } });
        if (fresh?.outcome !== 'SCANNING') return;
        if (assembled && !discarded) {
          await tx.documentFile.create({
            data: {
              id: assembled.id,
              versionId,
              documentId: version.documentId,
              sortOrder: assembled.sortOrder,
              storageKey: assembled.key,
              fileName: `${doc.label}.pdf`.slice(0, 200),
              mimeType: 'application/pdf',
              sizeBytes: BigInt(assembled.pdf.length),
              checksumSha256: createHash('sha256').update(assembled.pdf).digest('hex'),
              pageCount: assembled.pages,
              assembledFromImages: images.length,
              scanStatus: 'CLEAN', // MED-032 point 3: produced from checked images, not checked again
              scanCheckedAt: now,
              createdAt: now,
              updatedAt: now,
            },
          });
        }
        if (images.length && (assembled || discarded)) {
          await tx.documentFile.updateMany({ where: { id: { in: images.map((i) => i.id) } }, data: { deletedAt: now, updatedAt: now } });
        }
        if (discarded) {
          await tx.documentVersion.update({ where: { id: versionId }, data: { outcome: 'DISCARDED', updatedAt: now } });
        } else {
          const current = await tx.dossierDocument.findUniqueOrThrow({ where: { id: version.documentId } });
          const renewal = version.isRenewal && current.status === 'VALIDATED';
          if (renewal) {
            // CYC-141 — waits beside the validated piece; a renewal it replaces is REPLACED.
            if (current.renewalVersion) {
              await tx.documentVersion.updateMany({ where: { documentId: current.id, number: current.renewalVersion, outcome: 'IN_REVIEW' }, data: { outcome: 'REPLACED', updatedAt: now } });
            }
            await tx.dossierDocument.update({ where: { id: current.id }, data: { renewalVersion: version.number, version: { increment: 1 }, updatedAt: now } });
          } else {
            // CYC-140 — the version it replaces is REPLACED if it still waited for its check, keeps its outcome otherwise.
            if (current.currentVersion > 0) {
              await tx.documentVersion.updateMany({ where: { documentId: current.id, number: current.currentVersion, outcome: 'IN_REVIEW' }, data: { outcome: 'REPLACED', updatedAt: now } });
            }
            const keepsWaiver = current.status === 'WAIVED';
            await tx.dossierDocument.update({
              where: { id: current.id },
              data: {
                currentVersion: version.number,
                ...(keepsWaiver
                  ? {}
                  : {
                      status: 'RECEIVED',
                      statusChangedAt: now,
                      rejectionReason: null,
                      rejectionNote: null,
                      validatedById: null,
                      validatedAt: null,
                      issuedAt: null,
                      expiresAt: null,
                    }),
                reminderCount: 0,
                version: { increment: 1 },
                updatedAt: now,
              },
            });
          }
          await tx.documentVersion.update({ where: { id: versionId }, data: { outcome: 'IN_REVIEW', updatedAt: now } });
          await tx.dossier.update({ where: { id: dossier.id }, data: { lastActivityAt: now } });
          await recomputeCompleteness(tx, dossier.id, now);
          // `document.received` — the advisor's notification and verification task come with the back office (4.x).
          await this.outbox.add(tx, { type: 'document.received', aggregateType: 'Dossier', aggregateId: dossier.id, payload: { documentId: doc.id, versionId, isRenewal: renewal, by: version.uploadedVia } }, now);
        }
        // DOS-013, CYC-140 — the client is told, in his space and (unless he saw it) by e-mail. Staff deposits: later (NS_FILE_REFUSED).
        if (refusal && version.uploadedVia !== 'ADMIN') {
          const notificationId = await notifyClient(tx, now, {
            clientId: dossier.clientId,
            type: 'NC_FILE_REFUSED',
            title: t(`ui.documents.notify.${refusal === 'PARTIAL' ? 'partial' : refusal === 'UNREADABLE' ? 'unreadable' : 'refused'}`, { libelle: doc.label }),
            link: documentsPagePath(dossier.reference),
            entityType: 'Dossier',
            entityId: dossier.id,
            dedupeKey: `NC_FILE_REFUSED:${versionId}`,
          });
          await tx.outboxEvent.create({
            data: {
              id: newId(),
              type: 'document.file_refused',
              aggregateType: 'DocumentVersion',
              aggregateId: versionId,
              payload: { kind: refusal, notificationId } as never,
              dedupeKey: `document.file_refused:${versionId}`,
              occurredAt: now,
              availableAt: new Date(now.getTime() + REFUSED_MAIL_DELAY_MS),
              createdAt: now,
              updatedAt: now,
            },
          });
        }
      },
      { timeout: 30_000 },
    );
    // Images are erased from the storage once the PDF is written and recorded (MED-032 point 3), or when unusable.
    if (images.length && (assembled || discarded)) for (const img of images) await this.storage.delete('private', img.storageKey).catch(() => undefined);
    if (assembled && discarded) await this.storage.delete('private', assembled.key).catch(() => undefined);
    return 'DONE';
  }

  /** Steps 1–2 for one file. */
  private async copyAndScan(file: DocumentFile, source: string | undefined): Promise<'CLEAN' | 'INFECTED' | 'ERROR'> {
    let body = await this.storage.get('private', file.storageKey);
    if (!body && source) {
      body = await this.storage.get('private', source);
      if (body) {
        await this.storage.put('private', file.storageKey, body, file.mimeType);
        // An upload's original is erased once copied; a kept file's object stays with its own version.
        if (source.startsWith('uploads/')) await this.storage.delete('private', source).catch(() => undefined);
      }
    }
    const now = this.clock.now();
    if (!body) {
      // Nothing to scan (the upload expired and was purged): the file is unusable, like a refused one.
      await this.prisma.documentFile.update({ where: { id: file.id }, data: { scanStatus: 'ERROR', scanCheckedAt: now, deletedAt: now, updatedAt: now } });
      return 'INFECTED';
    }
    const scan = await this.scanner.scan(body);
    if (scan === 'INFECTED') {
      await this.storage.delete('private', file.storageKey).catch(() => undefined);
      await this.prisma.documentFile.update({ where: { id: file.id }, data: { scanStatus: 'INFECTED', scanCheckedAt: now, deletedAt: now, updatedAt: now } });
      log('warn', 'documents.file_infected', { fileId: file.id });
      return 'INFECTED';
    }
    if (scan === 'ERROR') {
      await this.prisma.documentFile.update({ where: { id: file.id }, data: { scanCheckedAt: now, updatedAt: now } });
      return 'ERROR';
    }
    await this.prisma.documentFile.update({ where: { id: file.id }, data: { scanStatus: 'CLEAN', scanCheckedAt: now, updatedAt: now } });
    return 'CLEAN';
  }
}
