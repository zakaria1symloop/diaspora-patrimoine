// Lots — 01-domaine/03 § 3, CTL-060…CTL-062, MOD-230/MOD-231, CYC-100/CYC-101, FIA-020 (row locks).
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@dp/contracts';
import type { Lot, Prisma } from '../generated/prisma/client.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { diff, writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { CatalogueCaches } from './catalogue-caches.js';
import { manualLotTransitionRefusal, type LotStatusCode } from './catalogue-rules.js';
import { emitCatalogueEvent } from './catalogue-events.js';
import { conflictVersion } from './partners-admin.service.js';
import { propertyTags } from './properties-admin.service.js';
import { lotCreateSchema, lotStatusSchema, lotUpdateSchema, type LotCreate, type LotStatusChange, type LotUpdate } from './schemas.js';

@Injectable()
export class LotsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly caches: CatalogueCaches,
    private readonly notifier: ChangeNotifier,
  ) {}

  /**
   * FIA-020 — the lot reference is unique in the programme (in the property for a standalone one) among non-deleted
   * lots: an application rule checked under the row lock of the Program (Property) — `409 DUPLICATE`.
   */
  private async lockScopeAndCheckReference(tx: Tx, property: { id: string; programId: string | null }, reference: string, exceptLotId?: string): Promise<void> {
    if (property.programId) await tx.$queryRaw`SELECT id FROM programs WHERE id = ${property.programId}::uuid FOR UPDATE`;
    else await tx.$queryRaw`SELECT id FROM properties WHERE id = ${property.id}::uuid FOR UPDATE`;
    const existing = await tx.lot.findFirst({
      where: {
        reference,
        deletedAt: null,
        ...(exceptLotId ? { NOT: { id: exceptLotId } } : {}),
        property: property.programId ? { programId: property.programId, deletedAt: null } : { id: property.id },
      },
      select: { id: true, reference: true },
    });
    if (existing) throw new AppError(ErrorCode.DUPLICATE, { params: { existingId: existing.id, existingReference: existing.reference } });
  }

  /** CTL-060 « ajouter un lot » — born AVAILABLE; caches of the property and the programme recalculated (MOD-220). */
  async create(propertyId: string, input: LotCreate, actor: Actor): Promise<Lot> {
    const data = parseOrThrow(lotCreateSchema, input);
    let tags: string[] = [];
    const lot = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null } });
      if (!property) throw AppError.notFound();
      // MOD-212 — a standalone property has exactly one lot.
      if (!property.programId) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      await this.lockScopeAndCheckReference(tx, property, data.reference);
      const last = await tx.lot.aggregate({ where: { propertyId, deletedAt: null }, _max: { sortOrder: true } });
      const created = await tx.lot.create({
        data: {
          id: newId(),
          propertyId,
          reference: data.reference,
          building: data.building || null,
          floor: data.floor ?? null,
          door: data.door || null,
          orientation: data.orientation ?? null,
          surfaceM2: data.surfaceM2.toFixed(2),
          terraceM2: data.terraceM2?.toFixed(2) ?? null,
          landM2: data.landM2?.toFixed(2) ?? null,
          price: data.price,
          priceUpdatedAt: now,
          status: 'AVAILABLE',
          statusChangedAt: now,
          parkingIncluded: data.parkingIncluded ?? null,
          extras: data.extras || null,
          sortOrder: data.sortOrder ?? (last._max.sortOrder ?? -1) + 1,
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, {
        action: 'lot.created',
        entityType: 'lot',
        entityId: created.id,
        entityLabel: `${property.reference} · ${created.reference}`,
        after: { propertyId, reference: created.reference, price: created.price, surfaceM2: created.surfaceM2, status: 'AVAILABLE' },
      });
      await this.caches.recalcPropertyAndProgram(tx, propertyId);
      tags = propertyTags(property);
      return created;
    });
    await this.notifier.committed(tags);
    return lot;
  }

  /** CTL-060, CTL-061 — fields of a lot; a price change is written with its old and new value (MOD-231). */
  async update(lotId: string, input: LotUpdate, actor: Actor): Promise<Lot> {
    const data = parseOrThrow(lotUpdateSchema, input);
    let tags: string[] = [];
    const lot = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const before = await tx.lot.findFirst({ where: { id: lotId, deletedAt: null }, include: { property: true } });
      if (!before) throw AppError.notFound();
      if (data.version !== undefined && data.version !== before.version) throw conflictVersion(before.version, before.updatedAt);
      if (data.reference && data.reference !== before.reference) {
        if (!before.property.programId) throw AppError.validation([{ field: 'reference', code: 'INVALID_CHOICE' }]); // MOD-212
        await this.lockScopeAndCheckReference(tx, before.property, data.reference, lotId);
      }
      const { version: _v, ...rest } = data;
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v === undefined) continue;
        patch[k] = typeof v === 'number' && ['surfaceM2', 'terraceM2', 'landM2'].includes(k) ? v.toFixed(2) : v === '' ? null : v;
      }
      if (patch.reference !== undefined && before.referencePending) patch.referencePending = false; // MOD-230
      const changes = diff(before as unknown as Record<string, unknown>, patch);
      if (!changes) return before;
      if ('price' in changes.after) patch.priceUpdatedAt = now;
      const updated = await tx.lot.update({
        where: { id: lotId, version: before.version },
        data: { ...(patch as Prisma.LotUncheckedUpdateInput), version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      const label = `${before.property.reference} · ${updated.reference}`;
      if ('price' in changes.after) {
        await writeAudit(tx, actor, now, { action: 'lot.price_changed', entityType: 'lot', entityId: lotId, entityLabel: label, before: { price: before.price }, after: { price: updated.price } });
        delete changes.before.price;
        delete changes.after.price;
      }
      if (Object.keys(changes.after).length) await writeAudit(tx, actor, now, { action: 'lot.updated', entityType: 'lot', entityId: lotId, entityLabel: label, ...changes });
      await this.caches.recalcPropertyAndProgram(tx, before.propertyId);
      tags = propertyTags(before.property);
      return updated;
    });
    await this.notifier.committed(tags);
    return lot;
  }

  /**
   * CYC-100 — a status changed by hand: off-platform reservation or sale (`externalSale`), withdrawal, back on sale,
   * correction of an off-platform sale entered by mistake (`lot.sale_corrected`). A note is required. The lot row is
   * locked (FIA-020); caches recalculated (CYC-101); a lot with an active reservation goes through its reservation.
   */
  async changeStatus(lotId: string, input: LotStatusChange, actor: Actor): Promise<Lot> {
    const data = parseOrThrow(lotStatusSchema, input);
    let tags: string[] = [];
    const lot = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM lots WHERE id = ${lotId}::uuid FOR UPDATE`;
      const before = await tx.lot.findFirst({ where: { id: lotId, deletedAt: null }, include: { property: true } });
      if (!before) throw AppError.notFound();
      if (data.version !== undefined && data.version !== before.version) throw conflictVersion(before.version, before.updatedAt);
      const activeReservation = await tx.reservation.count({ where: { lotId, status: { in: ['OPTION', 'RESERVED'] } } });
      const refusal = manualLotTransitionRefusal(before.status as LotStatusCode, data.status, {
        externalSale: before.externalSale,
        referencePending: before.referencePending,
        hasActiveReservation: activeReservation > 0,
      });
      if (refusal) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: refusal });
      const external = data.status === 'RESERVED' || data.status === 'SOLD';
      const updated = await tx.lot.update({
        where: { id: lotId, version: before.version },
        data: {
          status: data.status,
          statusChangedAt: now,
          statusNote: data.note,
          externalSale: external,
          version: { increment: 1 },
          updatedById: stampBy(actor),
          updatedAt: now,
        },
      });
      const correction = before.status === 'SOLD' && data.status === 'AVAILABLE';
      await writeAudit(tx, actor, now, {
        action: correction ? 'lot.sale_corrected' : 'lot.status_changed',
        entityType: 'lot',
        entityId: lotId,
        entityLabel: `${before.property.reference} · ${before.reference}`,
        before: { status: before.status, externalSale: before.externalSale },
        after: { status: data.status, externalSale: external, note: data.note },
        reason: correction ? data.note : undefined,
      });
      // AUT-010 — the advisers of the dossiers that targeted it hear of it (NS_LOT_TAKEN, CYC-102).
      await emitCatalogueEvent(tx, now, actor, 'lot.status_changed', { type: 'Lot', id: lotId }, { from: before.status, to: data.status, propertyId: before.propertyId, externalSale: external });
      await this.caches.recalcPropertyAndProgram(tx, before.propertyId);
      tags = propertyTags(before.property);
      return updated;
    });
    await this.notifier.committed(tags);
    return lot;
  }
}
