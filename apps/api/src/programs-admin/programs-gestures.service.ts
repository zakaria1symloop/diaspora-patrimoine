// The gestures of package 3.5 the write services of `catalogue-admin/` did not have yet: duplicate and delete a
// programme (CTL-024), « Disponibilités vérifiées » (CTL-064, AUT-079), delete and duplicate a lot (MOD-230), bulk price
// (CTL-061), « Marquer livrés » (CTL-060, Q-014), « À proximité » (CTL-140), « Chantier » (CTL-145). Every write: one
// transaction, input validated, audit row with the SEC-080 code, domain event in the transaction, public pages
// refreshed after the commit (ChangeNotifier).
import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  lotBulkPriceSchema,
  lotDeliveredSchema,
  poiListSchema,
  programUpdateInputSchema,
  stockConfirmSchema,
  type AdminPoi,
  type AdminProgramUpdate,
  type DuplicatedObject,
  type LotBulkPriceInput,
  type LotBulkPriceResult,
  type PoiListInput,
  type ProgramUpdateInput,
  type StockConfirmInput,
} from '@dp/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { localDate } from '../platform/holidays.service.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { slugify } from '../platform/slug.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { staffName } from '../back-office/staff-view.js';
import { CatalogueCaches } from '../catalogue-admin/catalogue-caches.js';
import { emitCatalogueEvent } from '../catalogue-admin/catalogue-events.js';
import { CatalogueReferenceService, adminImageRef } from '../catalogue-admin/catalogue-reference.js';
import { uniqueSlug } from '../catalogue-admin/catalogue-texts.js';
import { programTags } from '../catalogue-admin/programs-admin.service.js';
import { propertyTags } from '../catalogue-admin/properties-admin.service.js';

export type CatalogueScope = { programId: string } | { propertyId: string };

/** MOD-230 — « {référence}-copie », numbered when taken, unique in the programme (the property for a standalone one). */
export async function provisionalReference(tx: Tx, base: string, scope: { programId: string | null; propertyId: string }): Promise<string> {
  const stem = `${base}-copie`.slice(0, 34);
  for (let i = 1; i < 1000; i++) {
    const candidate = i === 1 ? stem : `${stem}-${i}`;
    const taken = await tx.lot.findFirst({
      where: { reference: candidate, deletedAt: null, property: scope.programId ? { programId: scope.programId, deletedAt: null } : { id: scope.propertyId } },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
}

@Injectable()
export class ProgramsGesturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly caches: CatalogueCaches,
    private readonly notifier: ChangeNotifier,
    private readonly references: CatalogueReferenceService,
  ) {}

  // ─── Programme: copy and delete (CTL-024) ─────────────────────────────

  /** CTL-024 « Copie » — « {nom} (copie) », DRAFT, new slug; neither properties nor media nor pins, SEO, dates, stock check, eligibility. */
  async duplicateProgram(id: string, actor: Actor): Promise<DuplicatedObject> {
    return this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const p = await tx.program.findFirst({ where: { id, deletedAt: null } });
      if (!p) throw AppError.notFound();
      const suffix = ' (copie)';
      const name = `${p.name.slice(0, 120 - suffix.length).trimEnd()}${suffix}`;
      const slug = await uniqueSlug(slugify(name), 80, async (s) =>
        Boolean((await tx.program.findFirst({ where: { slug: s, deletedAt: null } })) ?? (await tx.slugHistory.findFirst({ where: { entityType: 'PROGRAM', slug: s } }))),
      );
      const copyId = newId();
      await tx.program.create({
        data: {
          id: copyId,
          promoterId: p.promoterId,
          name,
          slug,
          tagline: p.tagline,
          description: p.description,
          standing: p.standing,
          countryCode: p.countryCode,
          regionId: p.regionId,
          cityId: p.cityId,
          addressLine: p.addressLine,
          latitude: p.latitude,
          longitude: p.longitude,
          deliveryStatus: p.deliveryStatus,
          deliveryDate: p.deliveryDate,
          deliveryDatePrecision: p.deliveryDatePrecision,
          totalUnits: p.totalUnits,
          amenities: p.amenities,
          guarantees: p.guarantees,
          publication: 'DRAFT',
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, { action: 'program.created', entityType: 'program', entityId: copyId, entityLabel: name, after: { name, slug, promoterId: p.promoterId, duplicatedFrom: id } });
      return { id: copyId };
    });
  }

  /** CTL-024 — only a programme without property (MOD-013); otherwise `409 PROGRAM_HAS_PROPERTIES`. */
  async deleteProgram(id: string, actor: Actor): Promise<{ deleted: true }> {
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM programs WHERE id = ${id}::uuid FOR UPDATE`;
      const p = await tx.program.findFirst({ where: { id, deletedAt: null } });
      if (!p) throw AppError.notFound();
      const properties = await tx.property.count({ where: { programId: id, deletedAt: null } });
      if (properties > 0) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'PROGRAM_HAS_PROPERTIES', params: { n: properties } });
      await tx.program.update({ where: { id }, data: { deletedAt: now, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'program.deleted', entityType: 'program', entityId: id, entityLabel: p.name, before: { name: p.name, publication: p.publication } });
    });
    await this.notifier.committed(programTags(id));
    return { deleted: true };
  }

  // ─── « Disponibilités vérifiées » (CTL-064, AUT-079) ──────────────────

  async confirmStock(scope: CatalogueScope, input: StockConfirmInput, actor: Actor): Promise<{ confirmedAt: string }> {
    const data = parseOrThrow(stockConfirmSchema, input ?? {});
    let tags: string[] = [];
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const target =
        'programId' in scope
          ? await tx.program.findFirst({ where: { id: scope.programId, deletedAt: null }, select: { id: true, promoterId: true, name: true, stockConfirmedAt: true } })
          : await tx.property.findFirst({ where: { id: scope.propertyId, deletedAt: null }, select: { id: true, promoterId: true, reference: true, programId: true, stockConfirmedAt: true } });
      if (!target) throw AppError.notFound();
      // CTL-064 — on a property, only a standalone one (a typology is verified with its programme).
      if ('programId' in target && target.programId) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      let who: string | null = data.name?.trim() || null;
      if (data.contactId) {
        const c = await tx.promoterContact.findFirst({ where: { id: data.contactId, promoterId: target.promoterId } });
        if (!c) throw AppError.validation([{ field: 'contactId', code: 'INVALID_CHOICE' }]);
        who = c.fullName;
      }
      const patch = { stockConfirmedAt: now, stockConfirmedBy: who, updatedAt: now };
      const isProgram = 'programId' in scope;
      if (isProgram) await tx.program.update({ where: { id: target.id }, data: patch });
      else await tx.property.update({ where: { id: target.id }, data: patch });
      const label = 'name' in target ? target.name : target.reference;
      await writeAudit(tx, actor, now, {
        action: 'program.stock_confirmed',
        entityType: isProgram ? 'program' : 'property',
        entityId: target.id,
        entityLabel: label,
        before: { stockConfirmedAt: target.stockConfirmedAt },
        after: { stockConfirmedAt: now, contactId: data.contactId ?? null },
      });
      // CTL-064 — the note becomes an internal note of the programme (or of the standalone property).
      if (data.note?.trim()) {
        await tx.note.create({
          data: {
            id: newId(),
            entityType: isProgram ? 'PROGRAM' : 'PROPERTY',
            entityId: target.id,
            body: `Disponibilités vérifiées : ${data.note.trim()}`.slice(0, 5000),
            authorId: actor.userId!,
            createdById: stampBy(actor),
            updatedById: stampBy(actor),
            createdAt: now,
            updatedAt: now,
          },
        });
      }
      // AUT-079 — the task of the promoter closes when nothing is left to verify (promoters package).
      await emitCatalogueEvent(tx, now, actor, 'program.stock_confirmed', { type: isProgram ? 'Program' : 'Property', id: target.id }, {
        route: 'ADMIN',
        programId: isProgram ? target.id : null,
        propertyId: isProgram ? null : target.id,
        promoterId: target.promoterId,
      });
      tags = isProgram ? [`program:${target.id}`] : [`property:${target.id}`];
    });
    await this.notifier.committed(tags);
    return { confirmedAt: now.toISOString() };
  }

  // ─── Lots (MOD-230, CTL-060, CTL-061) ─────────────────────────────────

  /**
   * MOD-230 — only an AVAILABLE or WITHDRAWN lot is deleted; one that carried a reservation or appears in a dossier is
   * withdrawn instead (its history keeps it). OPTIONED, RESERVED, SOLD: refused (« Passez par sa réservation »).
   */
  async deleteLot(lotId: string, actor: Actor): Promise<{ outcome: 'DELETED' | 'WITHDRAWN' }> {
    let tags: string[] = [];
    let outcome: 'DELETED' | 'WITHDRAWN' = 'DELETED';
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM lots WHERE id = ${lotId}::uuid FOR UPDATE`;
      const lot = await tx.lot.findFirst({ where: { id: lotId, deletedAt: null }, include: { property: true } });
      if (!lot) throw AppError.notFound();
      if (!lot.property.programId) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'STANDALONE_SINGLE_LOT' }); // MOD-212
      if (lot.status === 'OPTIONED' || lot.status === 'RESERVED' || lot.status === 'SOLD') throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'LOT_HELD' });
      const used = (await tx.reservation.count({ where: { lotId } })) + (await tx.dossier.count({ where: { lotId } })) + (await tx.dossierCandidate.count({ where: { lotId } }));
      const label = `${lot.property.reference} · ${lot.reference}`;
      if (used > 0) {
        outcome = 'WITHDRAWN';
        if (lot.status !== 'WITHDRAWN') {
          await tx.lot.update({ where: { id: lotId }, data: { status: 'WITHDRAWN', statusChangedAt: now, statusNote: 'Retiré au lieu d’être supprimé (MOD-230)', version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
          await writeAudit(tx, actor, now, { action: 'lot.status_changed', entityType: 'lot', entityId: lotId, entityLabel: label, before: { status: lot.status }, after: { status: 'WITHDRAWN', propertyId: lot.propertyId } });
          await emitCatalogueEvent(tx, now, actor, 'lot.status_changed', { type: 'Lot', id: lotId }, { from: lot.status, to: 'WITHDRAWN', propertyId: lot.propertyId });
        }
      } else {
        await tx.lot.update({ where: { id: lotId }, data: { deletedAt: now, updatedById: stampBy(actor), updatedAt: now } });
        await writeAudit(tx, actor, now, { action: 'lot.deleted', entityType: 'lot', entityId: lotId, entityLabel: label, before: { reference: lot.reference, price: lot.price, status: lot.status, propertyId: lot.propertyId } });
      }
      await this.caches.recalcPropertyAndProgram(tx, lot.propertyId);
      tags = propertyTags(lot.property);
    });
    await this.notifier.committed(tags);
    return { outcome };
  }

  /** CTL-060 « dupliquer un lot » — the copy is withdrawn, with a provisional reference (MOD-230). */
  async duplicateLot(lotId: string, actor: Actor): Promise<DuplicatedObject> {
    let tags: string[] = [];
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const lot = await tx.lot.findFirst({ where: { id: lotId, deletedAt: null }, include: { property: true } });
      if (!lot) throw AppError.notFound();
      if (!lot.property.programId) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'STANDALONE_SINGLE_LOT' });
      await tx.$queryRaw`SELECT id FROM programs WHERE id = ${lot.property.programId}::uuid FOR UPDATE`;
      const reference = await provisionalReference(tx, lot.reference, { programId: lot.property.programId, propertyId: lot.propertyId });
      const last = await tx.lot.aggregate({ where: { propertyId: lot.propertyId, deletedAt: null }, _max: { sortOrder: true } });
      const id = newId();
      await tx.lot.create({
        data: {
          id,
          propertyId: lot.propertyId,
          reference,
          referencePending: true,
          building: lot.building,
          floor: lot.floor,
          door: null,
          orientation: lot.orientation,
          surfaceM2: lot.surfaceM2,
          terraceM2: lot.terraceM2,
          landM2: lot.landM2,
          price: lot.price,
          priceUpdatedAt: now,
          status: 'WITHDRAWN',
          statusChangedAt: now,
          parkingIncluded: lot.parkingIncluded,
          extras: lot.extras,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, { action: 'lot.created', entityType: 'lot', entityId: id, entityLabel: `${lot.property.reference} · ${reference}`, after: { propertyId: lot.propertyId, reference, price: lot.price, status: 'WITHDRAWN', duplicatedFrom: lotId } });
      await this.caches.recalcPropertyAndProgram(tx, lot.propertyId);
      tags = propertyTags(lot.property);
      return { id };
    });
    await this.notifier.committed(tags);
    return result;
  }

  /**
   * CTL-061 — « Augmenter ou baisser de {x} % » (rounded to the unit of the currency) or « Fixer à {montant} » on the
   * selected lots; `preview` gives the summary without writing. Lots with an active reservation are included and
   * flagged: their public price changes, the agreed price of the reservation does not (MOD-313). Each change: its
   * `lot.price_changed` audit row (MOD-231).
   */
  async bulkPrice(input: LotBulkPriceInput, actor: Actor): Promise<LotBulkPriceResult> {
    const data = parseOrThrow(lotBulkPriceSchema, input);
    const tags = new Set<string>();
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const lots = await tx.lot.findMany({
        where: { id: { in: data.lotIds }, deletedAt: null },
        include: { property: { select: { id: true, reference: true, programId: true, priceCurrency: true } }, reservations: { where: { status: { in: ['OPTION', 'RESERVED'] } }, select: { id: true } } },
        orderBy: [{ propertyId: 'asc' }, { sortOrder: 'asc' }, { reference: 'asc' }],
      });
      if (lots.length !== new Set(data.lotIds).size) throw AppError.notFound();
      const lines = lots.map((l) => {
        const before = Number(l.price);
        const after = data.mode === 'SET' ? Number(data.value) : Math.round(before * (1 + Number(data.value) / 100));
        return { lot: l, before, after };
      });
      if (lines.some((x) => x.after <= 0 || x.after > 100_000_000_000)) throw AppError.validation([{ field: 'value', code: 'OUT_OF_RANGE' }]);
      if (!data.preview) {
        for (const x of lines) {
          if (x.after === x.before) continue;
          const price = x.after.toFixed(2);
          await tx.lot.update({ where: { id: x.lot.id }, data: { price, priceUpdatedAt: now, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
          await writeAudit(tx, actor, now, { action: 'lot.price_changed', entityType: 'lot', entityId: x.lot.id, entityLabel: `${x.lot.property.reference} · ${x.lot.reference}`, before: { price: x.lot.price }, after: { price, bulk: true } });
        }
        const ctx = await this.caches.context(tx);
        for (const pid of new Set(lots.map((l) => l.propertyId))) await this.caches.recalcProperty(tx, pid, ctx);
        for (const progId of new Set(lots.map((l) => l.property.programId).filter((x): x is string => Boolean(x)))) await this.caches.recalcProgram(tx, progId);
        for (const l of lots) for (const t of propertyTags({ id: l.property.id, programId: l.property.programId })) tags.add(t);
      }
      return {
        lines: lines.map((x) => ({ lotId: x.lot.id, reference: x.lot.reference, before: x.before.toFixed(2), after: x.after.toFixed(2), currency: x.lot.property.priceCurrency, reserved: x.lot.reservations.length > 0 })),
        applied: !data.preview,
      };
    }, { timeout: 30_000 });
    if (tags.size) await this.notifier.committed([...tags]);
    return result;
  }

  /** CTL-060 « Marquer livrés » — the real delivery date of the selected lots, never in the future (Q-014). */
  async markDelivered(input: unknown, actor: Actor): Promise<{ updated: number }> {
    const data = parseOrThrow(lotDeliveredSchema, input);
    const today = localDate(this.clock.now(), await this.settings.get('business.calendar.timezone'));
    if (data.date > today) throw AppError.validation([{ field: 'date', code: 'DATE_IN_FUTURE' }]);
    const tags = new Set<string>();
    const updated = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const lots = await tx.lot.findMany({ where: { id: { in: data.lotIds }, deletedAt: null }, include: { property: { select: { id: true, reference: true, programId: true } } } });
      if (lots.length !== new Set(data.lotIds).size) throw AppError.notFound();
      const at = new Date(`${data.date}T00:00:00Z`);
      for (const l of lots) {
        await tx.lot.update({ where: { id: l.id }, data: { deliveredAt: at, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
        await writeAudit(tx, actor, now, { action: 'lot.updated', entityType: 'lot', entityId: l.id, entityLabel: `${l.property.reference} · ${l.reference}`, before: { deliveredAt: l.deliveredAt }, after: { deliveredAt: data.date } });
        for (const t of propertyTags({ id: l.property.id, programId: l.property.programId })) tags.add(t);
      }
      return lots.length;
    });
    await this.notifier.committed([...tags]);
    return { updated };
  }

  // ─── « À proximité » (CTL-140) ────────────────────────────────────────

  private async scopeOwner(db: PrismaService | Tx, scope: CatalogueScope): Promise<{ where: Prisma.PropertyPoiWhereInput; tags: string[]; label: string; ids: { programId: string | null; propertyId: string | null } }> {
    if ('programId' in scope) {
      const p = await db.program.findFirst({ where: { id: scope.programId, deletedAt: null }, select: { id: true, name: true } });
      if (!p) throw AppError.notFound();
      return { where: { programId: p.id }, tags: programTags(p.id), label: p.name, ids: { programId: p.id, propertyId: null } };
    }
    const p = await db.property.findFirst({ where: { id: scope.propertyId, deletedAt: null }, select: { id: true, reference: true, programId: true } });
    if (!p) throw AppError.notFound();
    return { where: { propertyId: p.id }, tags: propertyTags(p), label: p.reference, ids: { programId: null, propertyId: p.id } };
  }

  async pois(scope: CatalogueScope): Promise<AdminPoi[]> {
    const owner = await this.scopeOwner(this.prisma, scope);
    const rows = await this.prisma.propertyPoi.findMany({ where: owner.where, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    return rows.map((r) => ({ id: r.id, label: r.label, category: r.category, minutes: r.minutes, mode: r.mode, sortOrder: r.sortOrder }));
  }

  /** `PUT …/pois` — the whole list in its order: rows kept, changed, added, removed (each with its audit row). */
  async replacePois(scope: CatalogueScope, input: PoiListInput, actor: Actor): Promise<AdminPoi[]> {
    const data = parseOrThrow(poiListSchema, input);
    let tags: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const owner = await this.scopeOwner(tx, scope);
      const existing = await tx.propertyPoi.findMany({ where: owner.where });
      const byId = new Map(existing.map((e) => [e.id, e]));
      const kept = new Set<string>();
      for (const [i, item] of data.items.entries()) {
        const fields = { label: item.label, category: item.category, minutes: item.minutes, mode: item.mode, sortOrder: i };
        const before = item.id ? byId.get(item.id) : undefined;
        if (item.id && !before) throw AppError.validation([{ field: `items.${i}.id`, code: 'INVALID_CHOICE' }]);
        if (before) {
          kept.add(before.id);
          const changed = before.label !== fields.label || before.category !== fields.category || before.minutes !== fields.minutes || before.mode !== fields.mode || before.sortOrder !== i;
          if (!changed) continue;
          await tx.propertyPoi.update({ where: { id: before.id }, data: { ...fields, updatedById: stampBy(actor), updatedAt: now } });
          await writeAudit(tx, actor, now, { action: 'property_poi.updated', entityType: 'property_poi', entityId: before.id, entityLabel: fields.label, before: { label: before.label, category: before.category, minutes: before.minutes, mode: before.mode, sortOrder: before.sortOrder, ...owner.ids }, after: { ...fields, ...owner.ids } });
        } else {
          const id = newId();
          await tx.propertyPoi.create({ data: { id, ...owner.ids, ...fields, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
          await writeAudit(tx, actor, now, { action: 'property_poi.created', entityType: 'property_poi', entityId: id, entityLabel: fields.label, after: { ...fields, ...owner.ids } });
        }
      }
      for (const e of existing) {
        if (kept.has(e.id)) continue;
        await tx.propertyPoi.delete({ where: { id: e.id } });
        await writeAudit(tx, actor, now, { action: 'property_poi.deleted', entityType: 'property_poi', entityId: e.id, entityLabel: e.label, before: { label: e.label, category: e.category, minutes: e.minutes, mode: e.mode, ...owner.ids } });
      }
      // CAL-050 — the POI points of the completeness.
      if (owner.ids.programId) await this.caches.recalcProgramTree(tx, owner.ids.programId);
      else await this.caches.recalcPropertyAndProgram(tx, owner.ids.propertyId!);
      tags = owner.tags;
    }, { timeout: 30_000 });
    await this.notifier.committed(tags);
    return this.pois(scope);
  }

  // ─── « Chantier » (CTL-145) ───────────────────────────────────────────

  async updates(programId: string): Promise<AdminProgramUpdate[]> {
    const p = await this.prisma.program.findFirst({ where: { id: programId, deletedAt: null }, select: { id: true } });
    if (!p) throw AppError.notFound();
    const rows = await this.prisma.programUpdate.findMany({ where: { programId, deletedAt: null }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }] });
    const ids = rows.map((r) => r.id);
    const [photos, authors] = await Promise.all([
      this.prisma.media.findMany({ where: { ownerType: 'PROGRAM_UPDATE', ownerId: { in: ids }, deletedAt: null, processingStatus: 'READY' }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.createdById).filter((x): x is string => Boolean(x)) } }, select: { id: true, firstName: true, lastName: true, status: true } }),
    ]);
    const mediaUrl = this.references.mediaUrl();
    const names = new Map(authors.map((a) => [a.id, staffName(a)]));
    return rows.map((r) => ({
      id: r.id,
      stage: r.stage,
      percent: r.percent,
      note: r.note,
      publishedAt: r.publishedAt.toISOString().slice(0, 10),
      photos: photos.filter((m) => m.ownerId === r.id).map((m) => adminImageRef(mediaUrl, m, 'thumb')).filter((x): x is NonNullable<typeof x> => Boolean(x)),
      author: r.createdById ? (names.get(r.createdById) ?? null) : null,
    }));
  }

  /** CTL-145 — the percentage never goes below the previous point (by date). */
  private async checkPercent(tx: Tx, programId: string, date: Date, percent: number, exceptId?: string): Promise<void> {
    const where: Prisma.ProgramUpdateWhereInput = { programId, deletedAt: null, ...(exceptId ? { NOT: { id: exceptId } } : {}) };
    const previous = await tx.programUpdate.findFirst({ where: { ...where, publishedAt: { lte: date } }, orderBy: [{ publishedAt: 'desc' }, { percent: 'desc' }] });
    if (previous && percent < previous.percent) throw AppError.validation([{ field: 'percent', code: 'OUT_OF_RANGE', params: { n: previous.percent } }]);
    const next = await tx.programUpdate.findFirst({ where: { ...where, publishedAt: { gt: date } }, orderBy: [{ publishedAt: 'asc' }, { percent: 'asc' }] });
    if (next && percent > next.percent) throw AppError.validation([{ field: 'percent', code: 'OUT_OF_RANGE', params: { n: next.percent } }]);
  }

  async createUpdate(programId: string, input: ProgramUpdateInput, actor: Actor): Promise<{ id: string }> {
    if (!(await this.settings.get('features.constructionProgress'))) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'FEATURE_DISABLED' });
    const data = parseOrThrow(programUpdateInputSchema, input);
    const today = localDate(this.clock.now(), await this.settings.get('business.calendar.timezone'));
    if (data.date > today) throw AppError.validation([{ field: 'date', code: 'DATE_IN_FUTURE' }]);
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const p = await tx.program.findFirst({ where: { id: programId, deletedAt: null }, select: { id: true, name: true } });
      if (!p) throw AppError.notFound();
      const at = new Date(`${data.date}T00:00:00Z`);
      await this.checkPercent(tx, programId, at, data.percent);
      const id = newId();
      await tx.programUpdate.create({ data: { id, programId, stage: data.stage, percent: data.percent, note: data.note || null, publishedAt: at, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'program_update.created', entityType: 'program_update', entityId: id, entityLabel: p.name, after: { programId, stage: data.stage, percent: data.percent, date: data.date, silent: data.silent } });
      // CTL-145 — the clients whose dossier is about this programme are told (NC_PROGRAM_UPDATE), unless « Ne pas prévenir ».
      if (!data.silent) await emitCatalogueEvent(tx, now, actor, 'program.update_published', { type: 'Program', id: programId }, { stage: data.stage, percent: data.percent, updateId: id });
      return { id };
    });
    await this.notifier.committed(programTags(programId));
    return result;
  }

  async editUpdate(updateId: string, input: Omit<ProgramUpdateInput, 'silent'>, actor: Actor): Promise<{ id: string }> {
    const data = parseOrThrow(programUpdateInputSchema, { ...input, silent: true });
    let programId = '';
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const u = await tx.programUpdate.findFirst({ where: { id: updateId, deletedAt: null }, include: { program: { select: { name: true } } } });
      if (!u) throw AppError.notFound();
      programId = u.programId;
      const at = new Date(`${data.date}T00:00:00Z`);
      await this.checkPercent(tx, u.programId, at, data.percent, u.id);
      await tx.programUpdate.update({ where: { id: u.id }, data: { stage: data.stage, percent: data.percent, note: data.note || null, publishedAt: at, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'program_update.updated', entityType: 'program_update', entityId: u.id, entityLabel: u.program.name, before: { programId: u.programId, stage: u.stage, percent: u.percent, date: u.publishedAt.toISOString().slice(0, 10) }, after: { programId: u.programId, stage: data.stage, percent: data.percent, date: data.date } });
    });
    await this.notifier.committed(programTags(programId));
    return { id: updateId };
  }

  async deleteUpdate(updateId: string, actor: Actor): Promise<{ deleted: true }> {
    let programId = '';
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const u = await tx.programUpdate.findFirst({ where: { id: updateId, deletedAt: null }, include: { program: { select: { name: true } } } });
      if (!u) throw AppError.notFound();
      programId = u.programId;
      await tx.programUpdate.update({ where: { id: u.id }, data: { deletedAt: now, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'program_update.deleted', entityType: 'program_update', entityId: u.id, entityLabel: u.program.name, before: { programId: u.programId, stage: u.stage, percent: u.percent } });
    });
    await this.notifier.committed(programTags(programId));
    return { deleted: true };
  }
}
