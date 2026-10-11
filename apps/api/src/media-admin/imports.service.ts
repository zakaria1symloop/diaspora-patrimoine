// EA-45 — the lot import of a programme (CTL-100 … CTL-102, `catalogue.import`):
//   1. the file arrives through API-080 (announce → PUT → `POST /admin/imports` with the programme): it is read once,
//      kept privately under `imports/{jobId}`, and the mapping of its columns is proposed;
//   2. `dry-run` (with the mapping, modifiable): every rule checked, NOTHING written; counters, errors and flags by line;
//   3. `confirm`: the import runs in the background and replays every check on the state of the moment (a lot may have
//      been sold or put under option since); its report (`ImportJob.report`) is authoritative; NS_IMPORT_FINISHED.
// One transaction for the execution: lots created or updated with their audit rows (`lot.price_changed` for MOD-231),
// typologies created as drafts, statuses changed only when CYC-100 allows it, a lot held by a dossier flagged and its
// adviser asked to verify (`lot.import_conflict`), caches recalculated once, `import.executed`, `import.finished`.
import { createHash, createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode, IMPORT_COLUMNS, importMappingSchema, type ImportCounters, type ImportIssue, type ImportJobList, type ImportJobView, type ImportColumn } from '@dp/contracts';
import { createTranslator, type MessageKey } from '@dp/i18n';
import { z } from 'zod';
import { ENV, type Env } from '../config/env.js';
import type { ImportJob } from '../generated/prisma/client.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { log } from '../platform/request-context.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { nextSequenceValue, propertyReference } from '../admin/sequences.js';
import { StaffNotifier } from '../automation/staff-notifications.service.js';
import { staffName } from '../back-office/staff-view.js';
import { CatalogueCaches } from '../catalogue-admin/catalogue-caches.js';
import { emitCatalogueEvent } from '../catalogue-admin/catalogue-events.js';
import { generateTitle, propertySlug, uniqueSlug, type PropertyTypeCode } from '../catalogue-admin/catalogue-texts.js';
import { programTags } from '../catalogue-admin/programs-admin.service.js';
import type { LotStatusCode } from '../catalogue-admin/catalogue-rules.js';
import { cleanFileName } from '../files/media-pipeline.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../files/object-storage.js';
import { VIRUS_SCANNER, type VirusScanner } from '../files/virus-scanner.js';
import { IMPORT_MAX_BYTES, issuesCsv, mappingComplete, planImport, proposeMapping, readGrid, readLine, type ExistingLot, type ExistingTypology, type ReadLine } from './lot-import.js';
import { writeXlsx } from './xlsx.js';

const t = createTranslator('fr');
const UPLOAD_TTL_MS = 15 * 60_000;
const announceSchema = z.object({ fileName: z.string().trim().min(1).max(200), contentType: z.string().max(100).optional(), size: z.number().int().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/) });
const createSchema = z.object({ uploadId: z.uuid(), programId: z.uuid() });

interface Report {
  headers: string[];
  counters: ImportCounters;
  issues: ImportIssue[];
}

/** The sentence of one issue (the screen and the CSV say the same). */
export function issueMessage(i: ImportIssue): string {
  const params = { ...i.params, raison: i.params.raison ? t(`ui.admin-media.import.issue.${i.params.raison}` as MessageKey) : '' };
  return t(`ui.admin-media.import.issue.${i.code}` as MessageKey, params);
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly caches: CatalogueCaches,
    private readonly notifier: ChangeNotifier,
    private readonly staffNotifier: StaffNotifier,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ─── Templates (CTL-100) ──────────────────────────────────────────────

  templateRows(): string[][] {
    return [[...IMPORT_COLUMNS], ['A-101', '', 'Appartement', '3', '85', '22 350 000', 'A', '1', '12', 'Sud-Est', '12', '', 'oui', 'Cave', 'Disponible']];
  }
  templateCsv(): Buffer {
    return Buffer.from(`﻿${this.templateRows().map((r) => r.join(';')).join('\r\n')}\r\n`, 'utf8');
  }
  templateXlsx(): Buffer {
    return writeXlsx(this.templateRows(), 'Lots');
  }

  // ─── Upload (API-080) and job creation ────────────────────────────────

  private signature(id: string, exp: number): string {
    return createHmac('sha256', this.env.LINK_SIGNING_KEY).update(`dp_import_upload:${id}:${exp}`).digest('base64url');
  }

  async announce(auth: AuthContext, body: unknown): Promise<{ id: string; uploadUrl: string; expiresAt: string }> {
    const input = parseOrThrow(announceSchema, body);
    if (input.size > IMPORT_MAX_BYTES) throw new AppError(ErrorCode.FILE_TOO_LARGE, { params: { maxMb: 5, n: 5 } });
    if (!/\.(csv|xlsx)$/i.test(input.fileName)) throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: ['csv', 'xlsx'] } });
    const now = this.clock.now();
    const id = newId();
    const expiresAt = new Date(now.getTime() + UPLOAD_TTL_MS);
    await this.prisma.upload.create({
      data: { id, ownerType: 'IMPORT', ownerId: id, requestedById: auth.userId, fileName: cleanFileName(input.fileName), declaredMimeType: input.contentType || 'application/octet-stream', declaredSizeBytes: BigInt(input.size), declaredSha256: input.sha256, storageKey: `uploads/${id}`, expiresAt, createdAt: now, updatedAt: now },
    });
    const exp = expiresAt.getTime();
    return { id, uploadUrl: `/api/v1/admin/imports/uploads/${id}/content?e=${exp}&s=${this.signature(id, exp)}`, expiresAt: expiresAt.toISOString() };
  }

  async receive(auth: AuthContext, id: string, query: { e?: string; s?: string }, body: unknown): Promise<void> {
    const exp = Number(query.e);
    if (!query.s || !Number.isFinite(exp) || exp < this.clock.now().getTime() || query.s !== this.signature(id, exp)) throw new AppError(ErrorCode.GONE);
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.requestedById !== auth.userId || upload.ownerType !== 'IMPORT') throw AppError.notFound();
    if (upload.status !== 'PENDING') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    if (!Buffer.isBuffer(body) || body.length !== Number(upload.declaredSizeBytes)) throw AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]);
    await this.storage.put('private', upload.storageKey, body, 'application/octet-stream');
  }

  /** `POST /admin/imports` — the file read once (MED-021: scanned first), kept, the mapping proposed (CTL-101 step 1). */
  async create(auth: AuthContext, actor: Actor, body: unknown): Promise<ImportJobView> {
    const input = parseOrThrow(createSchema, body);
    const upload = await this.prisma.upload.findUnique({ where: { id: input.uploadId } });
    if (!upload || upload.requestedById !== auth.userId || upload.ownerType !== 'IMPORT') throw AppError.notFound();
    if (upload.status === 'COMPLETED' && upload.resultFileId) return this.view(upload.resultFileId);
    const program = await this.prisma.program.findFirst({ where: { id: input.programId, deletedAt: null }, select: { id: true, name: true, publication: true } });
    if (!program) throw AppError.validation([{ field: 'programId', code: 'INVALID_CHOICE' }]);
    if (program.publication === 'ARCHIVED') throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const content = await this.storage.get('private', upload.storageKey);
    if (!content) throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
    if (createHash('sha256').update(content).digest('hex') !== upload.declaredSha256) throw AppError.validation([{ field: 'file', code: 'CHECKSUM_MISMATCH' }]);
    if ((await this.scanner.scan(content)) !== 'CLEAN') throw AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]);
    const grid = readGrid(content);
    if (!grid.ok) {
      if (grid.code === 'FILE_TOO_LARGE') throw new AppError(ErrorCode.FILE_TOO_LARGE, { params: { maxMb: 5, n: 5 } });
      if (grid.code === 'TOO_MANY_ROWS') throw AppError.validation([{ field: 'file', code: 'TOO_MANY_ROWS', params: { n: 2000 } }]);
      if (grid.code === 'UNSUPPORTED_FILE_TYPE') throw new AppError(ErrorCode.UNSUPPORTED_FILE_TYPE, { params: { allowed: ['csv', 'xlsx'] } });
      throw AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]);
    }
    const now = this.clock.now();
    const jobId = newId();
    await this.storage.put('private', `imports/${jobId}`, content, 'application/octet-stream');
    await this.storage.delete('private', upload.storageKey).catch(() => undefined);
    await this.prisma.$transaction(async (tx) => {
      await tx.importJob.create({
        data: {
          id: jobId,
          type: 'LOTS',
          status: 'PENDING',
          fileStorageKey: `imports/${jobId}`,
          fileName: upload.fileName,
          target: { programId: program.id } as never,
          mapping: proposeMapping(grid.headers) as never,
          dryRun: true,
          totalRows: grid.rows.filter((r) => r.some((c) => c.text.trim())).length,
          report: { headers: grid.headers, counters: null, issues: [] } as never,
          createdById: auth.userId,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.upload.update({ where: { id: upload.id }, data: { status: 'COMPLETED', completedAt: now, resultFileId: jobId, updatedAt: now } });
    });
    return this.view(jobId);
  }

  // ─── Reading ──────────────────────────────────────────────────────────

  async view(id: string): Promise<ImportJobView> {
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job) throw AppError.notFound();
    const programId = (job.target as { programId: string }).programId;
    const [program, author] = await Promise.all([
      this.prisma.program.findUnique({ where: { id: programId }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: job.createdById }, select: { firstName: true, lastName: true, status: true } }),
    ]);
    const report = (job.report ?? { headers: [], counters: null, issues: [] }) as unknown as Report;
    return {
      id: job.id,
      programId,
      programName: program?.name ?? '',
      fileName: job.fileName,
      status: job.status as ImportJobView['status'],
      dryRun: job.dryRun,
      headers: report.headers ?? [],
      mapping: job.mapping as Record<string, ImportColumn | null>,
      counters: report.counters ?? null,
      issues: report.issues ?? [],
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      author: staffName(author),
      canConfirm: job.status === 'PENDING' && job.dryRun && report.counters !== null && report.counters.toCreate + report.counters.toUpdate > 0,
    };
  }

  /** `GET /admin/imports?programId=` — ADM-085: each import leaves a trace (file, author, date, counters). */
  async list(query: Record<string, unknown>): Promise<ImportJobList> {
    const programId = typeof query.programId === 'string' && /^[0-9a-f-]{36}$/.test(query.programId) ? query.programId : null;
    if (Object.keys(query).some((k) => k !== 'programId')) throw new AppError(ErrorCode.BAD_REQUEST);
    const rows = await this.prisma.importJob.findMany({
      where: { type: 'LOTS', ...(programId ? { target: { path: ['programId'], equals: programId } } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    const programs = await this.prisma.program.findMany({ where: { id: { in: rows.map((r) => (r.target as { programId: string }).programId) } }, select: { id: true, name: true } });
    const authors = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.createdById) } }, select: { id: true, firstName: true, lastName: true, status: true } });
    return {
      data: rows.map((r) => {
        const pid = (r.target as { programId: string }).programId;
        return {
          id: r.id,
          programId: pid,
          programName: programs.find((p) => p.id === pid)?.name ?? '',
          fileName: r.fileName,
          status: r.status as ImportJobView['status'],
          dryRun: r.dryRun,
          counters: ((r.report ?? {}) as unknown as Partial<Report>).counters ?? null,
          createdAt: r.createdAt.toISOString(),
          author: staffName(authors.find((a) => a.id === r.createdById) ?? null),
        };
      }),
    };
  }

  /** CTL-101 — the detail as a CSV (`ligne ; colonne ; niveau ; code ; message`, UTF-8 with BOM, for Excel). */
  async issuesFile(id: string): Promise<{ name: string; body: Buffer }> {
    const v = await this.view(id);
    return { name: `import-${v.programName.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}-${v.createdAt.slice(0, 10)}.csv`, body: Buffer.from(issuesCsv(v.issues, issueMessage), 'utf8') };
  }

  // ─── The facts of the programme ───────────────────────────────────────

  private async facts(db: Tx | PrismaService, programId: string): Promise<{ lots: ExistingLot[]; typologies: ExistingTypology[] }> {
    const props = await db.property.findMany({ where: { programId, deletedAt: null }, select: { id: true, reference: true, type: true, rooms: true } });
    const lots = await db.lot.findMany({
      where: { deletedAt: null, propertyId: { in: props.map((p) => p.id) } },
      include: {
        property: { select: { reference: true } },
        reservations: { where: { status: { in: ['OPTION', 'RESERVED'] } }, select: { dossier: { select: { id: true, reference: true, assignedAgentId: true } } }, take: 1 },
      },
    });
    return {
      typologies: props.map((p) => ({ id: p.id, reference: p.reference, type: p.type, rooms: p.rooms })),
      lots: lots.map((l) => {
        const r = l.reservations[0];
        return {
          id: l.id,
          reference: l.reference,
          propertyId: l.propertyId,
          propertyReference: l.property.reference,
          status: l.status as LotStatusCode,
          externalSale: l.externalSale,
          referencePending: l.referencePending,
          heldBy: r ? { dossierId: r.dossier.id, dossierReference: r.dossier.reference, agentId: r.dossier.assignedAgentId } : null,
          hasActiveReservation: Boolean(r),
          values: {
            surfaceM2: l.surfaceM2.toString(),
            price: l.price.toString(),
            building: l.building,
            floor: l.floor,
            door: l.door,
            orientation: l.orientation,
            terraceM2: l.terraceM2?.toString() ?? null,
            landM2: l.landM2?.toString() ?? null,
            parkingIncluded: l.parkingIncluded,
            extras: l.extras,
          },
        };
      }),
    };
  }

  private async lines(job: ImportJob, mapping: Record<string, ImportColumn | null>): Promise<ReadLine[]> {
    const content = await this.storage.get('private', job.fileStorageKey);
    if (!content) throw AppError.conflictState('UPLOAD_NOT_RECEIVED');
    const grid = readGrid(content);
    if (!grid.ok) throw AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]);
    return grid.rows.map((cells, i) => ({ cells, line: i + 2 })).filter((r) => r.cells.some((c) => c.text.trim())).map((r) => readLine(r.line, r.cells, grid.headers, mapping));
  }

  // ─── Dry run (CTL-101 step 2) ─────────────────────────────────────────

  async dryRun(id: string, body: unknown): Promise<ImportJobView> {
    const { mapping } = parseOrThrow(importMappingSchema, body);
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job) throw AppError.notFound();
    if (job.status !== 'PENDING' || !job.dryRun) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    const fed = Object.values(mapping).filter(Boolean);
    if (new Set(fed).size !== fed.length) throw AppError.validation([{ field: 'mapping', code: 'INVALID_CHOICE' }]);
    if (!mappingComplete(mapping)) throw AppError.validation([{ field: 'mapping', code: 'REQUIRED' }]);
    const programId = (job.target as { programId: string }).programId;
    const lines = await this.lines(job, mapping);
    const plan = planImport(lines, ...((f) => [f.lots, f.typologies] as const)(await this.facts(this.prisma, programId)));
    const report = (job.report ?? {}) as unknown as Report;
    await this.prisma.importJob.update({
      where: { id },
      data: {
        mapping: mapping as never,
        validRows: plan.counters.toCreate + plan.counters.toUpdate,
        flaggedRows: plan.counters.flagged,
        errorRows: plan.counters.errors,
        report: { headers: report.headers, counters: plan.counters, issues: plan.issues } as never,
        updatedAt: this.clock.now(),
      },
    });
    return this.view(id);
  }

  // ─── Confirmation (CTL-101 step 3) ────────────────────────────────────

  async confirm(actor: Actor, id: string): Promise<ImportJobView> {
    const now = this.clock.now();
    const moved = await this.prisma.importJob.updateMany({ where: { id, status: 'PENDING', dryRun: true }, data: { status: 'RUNNING', dryRun: false, startedAt: now, updatedAt: now } });
    if (moved.count !== 1) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
    // In the background: the answer returns at once (the screen follows the job); errors mark it FAILED.
    setImmediate(() => {
      void this.execute(actor, id).catch(async (err) => {
        log('error', 'import.failed', { importJobId: id, error: err instanceof Error ? err.message : String(err) });
        await this.prisma.importJob.update({ where: { id }, data: { status: 'FAILED', finishedAt: this.clock.now(), updatedAt: this.clock.now() } }).catch(() => undefined);
      });
    });
    return this.view(id);
  }

  private async createTypology(tx: Tx, program: { id: string; name: string; promoterId: string; countryCode: string; regionId: string; cityId: string | null; standing: 'COMFORT' | 'STANDING' | 'PREMIUM'; deliveryStatus: 'ON_PLAN' | 'UNDER_CONSTRUCTION' | 'DELIVERED'; deliveryDate: Date | null; deliveryDatePrecision: 'MONTH' | 'QUARTER' | 'YEAR'; currency: string; regionName: string; cityName: string | null }, type: string, rooms: number | null, surface: number, actor: Actor, now: Date): Promise<string> {
    const reference = propertyReference(program.countryCode, await nextSequenceValue(tx, 'property', program.countryCode, now));
    const title = generateTitle({ type: type as PropertyTypeCode, rooms, surfaceM2: surface, programName: program.name, cityName: program.cityName, regionName: program.regionName, roomsPrefix: await this.settings.get('display.roomsPrefix') });
    const slug = await uniqueSlug(propertySlug(title, program.regionName, reference), 120, async (s) => Boolean((await tx.property.findFirst({ where: { slug: s, deletedAt: null } })) ?? (await tx.slugHistory.findFirst({ where: { entityType: 'PROPERTY', slug: s } }))));
    const id = newId();
    await tx.property.create({
      data: {
        id,
        reference,
        slug,
        promoterId: program.promoterId,
        programId: program.id,
        title,
        titleAuto: true,
        descriptionAuto: true,
        type: type as PropertyTypeCode,
        rooms,
        surfaceM2: surface.toFixed(2),
        features: [],
        standing: program.standing,
        deliveryStatus: program.deliveryStatus,
        deliveryDate: program.deliveryDate,
        deliveryDatePrecision: program.deliveryDatePrecision,
        deliveryOverridden: false,
        countryCode: program.countryCode,
        regionId: program.regionId,
        cityId: program.cityId,
        priceCurrency: program.currency,
        publication: 'DRAFT',
        availability: 'WITHDRAWN',
        availabilityChangedAt: now,
        searchText: '',
        createdById: stampBy(actor),
        updatedById: stampBy(actor),
        createdAt: now,
        updatedAt: now,
      },
    });
    await writeAudit(tx, actor, now, { action: 'property.created', entityType: 'property', entityId: id, entityLabel: reference, after: { reference, programId: program.id, type, rooms, byImport: true } });
    return id;
  }

  private async execute(actor: Actor, id: string): Promise<void> {
    const job = await this.prisma.importJob.findUniqueOrThrow({ where: { id } });
    const programId = (job.target as { programId: string }).programId;
    const mapping = job.mapping as Record<string, ImportColumn | null>;
    const lines = await this.lines(job, mapping);
    const outcome = await this.prisma.$transaction(
      async (tx) => {
        const now = this.clock.now();
        await tx.$queryRaw`SELECT id FROM programs WHERE id = ${programId}::uuid FOR UPDATE`;
        const p = await tx.program.findUniqueOrThrow({ where: { id: programId }, include: { region: { select: { nameFr: true } }, city: { select: { nameFr: true } }, country: { select: { currency: true } } } });
        // CTL-101 step 3 — every check replayed on the state of the moment.
        const facts = await this.facts(tx, programId);
        const plan = planImport(lines, facts.lots, facts.typologies);
        const created = new Map<string, string>();
        for (const [key, t2] of plan.newTypologies) {
          created.set(key, await this.createTypology(tx, { ...p, currency: p.country.currency, regionName: p.region.nameFr, cityName: p.city?.nameFr ?? null }, t2.type, t2.rooms, Number.isFinite(t2.surface) ? t2.surface : 1, actor, now));
        }
        const touched = new Set<string>(created.values());
        let createdCount = 0;
        let updatedCount = 0;
        for (const a of plan.actions) {
          if (a.kind === 'create') {
            const propertyId = a.propertyId ?? created.get(a.newTypologyKey!)!;
            const v = a.values;
            const status = v.statut ?? 'AVAILABLE';
            const lotId = newId();
            const last = await tx.lot.aggregate({ where: { propertyId, deletedAt: null }, _max: { sortOrder: true } });
            await tx.lot.create({
              data: {
                id: lotId,
                propertyId,
                reference: v.lot,
                building: v.batiment ?? null,
                floor: v.etage ?? null,
                door: v.porte ?? null,
                orientation: (v.orientation as never) ?? null,
                surfaceM2: v.surface!.toFixed(2),
                terraceM2: v.terrasse?.toFixed(2) ?? null,
                landM2: v.terrain?.toFixed(2) ?? null,
                price: v.prix!,
                priceUpdatedAt: now,
                status,
                statusChangedAt: now,
                statusNote: status !== 'AVAILABLE' ? t('ui.admin-media.import.title') : null,
                externalSale: status === 'RESERVED' || status === 'SOLD',
                parkingIncluded: v.parking ?? null,
                extras: v.options ?? null,
                sortOrder: (last._max.sortOrder ?? -1) + 1,
                createdById: stampBy(actor),
                updatedById: stampBy(actor),
                createdAt: now,
                updatedAt: now,
              },
            });
            const ref = facts.typologies.find((x) => x.id === propertyId)?.reference ?? '';
            await writeAudit(tx, actor, now, { action: 'lot.created', entityType: 'lot', entityId: lotId, entityLabel: `${ref} · ${v.lot}`.replace(/^ · /, ''), after: { propertyId, reference: v.lot, price: v.prix, status, importJobId: id } });
            touched.add(propertyId);
            createdCount++;
            continue;
          }
          const lot = a.lot;
          const label = `${lot.propertyReference} · ${lot.reference}`;
          let changed = false;
          if (Object.keys(a.patch).length) {
            await tx.lot.update({ where: { id: lot.id }, data: { ...a.patch, ...('price' in a.patch ? { priceUpdatedAt: now } : {}), version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
            if ('price' in a.patch) await writeAudit(tx, actor, now, { action: 'lot.price_changed', entityType: 'lot', entityId: lot.id, entityLabel: label, before: { price: lot.values.price }, after: { price: a.patch.price, importJobId: id } });
            const { price: _p, ...others } = a.patch;
            if (Object.keys(others).length) await writeAudit(tx, actor, now, { action: 'lot.updated', entityType: 'lot', entityId: lot.id, entityLabel: label, after: { ...others, importJobId: id } });
            changed = true;
          }
          if (a.status) {
            const external = a.status === 'RESERVED' || a.status === 'SOLD';
            await tx.lot.update({ where: { id: lot.id }, data: { status: a.status, statusChangedAt: now, statusNote: t('ui.admin-media.import.title'), externalSale: external, version: { increment: 1 }, updatedAt: now } });
            await writeAudit(tx, actor, now, { action: 'lot.status_changed', entityType: 'lot', entityId: lot.id, entityLabel: label, before: { status: lot.status }, after: { status: a.status, externalSale: external, importJobId: id } });
            await emitCatalogueEvent(tx, now, actor, 'lot.status_changed', { type: 'Lot', id: lot.id }, { from: lot.status, to: a.status, propertyId: lot.propertyId, externalSale: external });
            changed = true;
          }
          if (a.conflict && lot.heldBy) {
            // CTL-102, CYC-107 — the adviser of the dossier verifies (R_LOT_IMPORT_CONFLICT).
            await emitCatalogueEvent(tx, now, actor, 'lot.import_conflict', { type: 'Lot', id: lot.id }, { fileStatus: a.values.statut, dossierId: lot.heldBy.dossierId, importJobId: id }, `lot.import_conflict:${lot.id}:${id}`);
          }
          if (changed) {
            touched.add(lot.propertyId);
            updatedCount++;
          }
        }
        const ctx = await this.caches.context(tx);
        for (const pid of touched) await this.caches.recalcProperty(tx, pid, ctx);
        await this.caches.recalcProgram(tx, programId);
        const counters: ImportCounters = { ...plan.counters, toCreate: createdCount, toUpdate: updatedCount };
        const before = (job.report ?? {}) as unknown as Report;
        await tx.importJob.update({
          where: { id },
          data: { status: 'DONE', finishedAt: now, createdCount, updatedCount, validRows: createdCount + updatedCount, flaggedRows: counters.flagged, errorRows: counters.errors, report: { headers: before.headers, counters, issues: plan.issues } as never, updatedAt: now },
        });
        await writeAudit(tx, actor, now, { action: 'import.executed', entityType: 'import_job', entityId: id, entityLabel: job.fileName, after: { programId, fileName: job.fileName, ...counters } });
        await emitCatalogueEvent(tx, now, actor, 'import.finished', { type: 'ImportJob', id }, { status: 'DONE', programId });
        return counters;
      },
      { timeout: 180_000 },
    );
    await this.notifier.committed(programTags(programId));
    // NOT-030 § 3.2 — NS_IMPORT_FINISHED, for the person who asked.
    if (actor.userId) {
      await this.staffNotifier.notify(this.prisma, this.clock.now(), {
        type: 'NS_IMPORT_FINISHED',
        userIds: [actor.userId],
        title: t('ui.notifications.NS_IMPORT_FINISHED', { n: outcome.rows, s: outcome.flagged, m: outcome.errors }),
        link: `/catalogue/import?import=${id}`,
        entityType: 'ImportJob',
        entityId: id,
        originId: id,
      });
    }
  }
}
