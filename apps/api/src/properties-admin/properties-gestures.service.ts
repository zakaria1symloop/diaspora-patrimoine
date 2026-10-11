// The gestures of package 3.5 on a property the write services did not have yet: « Dupliquer » (CTL-044, with the
// « Copie » rules of CTL-024, MOD-212, MOD-230), « Supprimer » (CTL-044: refused when a request, a dossier or a
// reservation exists) and the financing eligibility of a programme or a property (CTL-130, MOD-240,
// `eligibility.changed`). One transaction each, audit row, public pages refreshed after the commit.
import { Injectable } from '@nestjs/common';
import { eligibilityInputSchema, ErrorCode, type AdminEligibilityInput, type DuplicatedObject } from '@dp/contracts';
import { z } from 'zod';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { localDate } from '../platform/holidays.service.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { nextSequenceValue, propertyReference } from '../admin/sequences.js';
import { CatalogueCaches } from '../catalogue-admin/catalogue-caches.js';
import { generateTitle, propertySlug, uniqueSlug, type PropertyTypeCode } from '../catalogue-admin/catalogue-texts.js';
import { programTags } from '../catalogue-admin/programs-admin.service.js';
import { propertyTags } from '../catalogue-admin/properties-admin.service.js';
import { provisionalReference } from '../programs-admin/programs-gestures.service.js';

const duplicateSchema = z.object({ withLots: z.boolean().default(false) });

@Injectable()
export class PropertiesGesturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly caches: CatalogueCaches,
    private readonly notifier: ChangeNotifier,
  ) {}

  /**
   * CTL-044 « Dupliquer » — a DRAFT with a new reference (TRV-051), its automatic title (MOD-210) and a new slug; not
   * copied: pin and highlight, SEO, publication dates and marks, counters and caches (recalculated), stock check,
   * eligibility, media. Lots, when asked: without their status; each copy gets a provisional reference and stays
   * withdrawn until it is replaced (MOD-230) — except the single lot of a standalone property, which takes the new
   * property's reference (MOD-212).
   */
  async duplicate(id: string, input: unknown, actor: Actor): Promise<DuplicatedObject> {
    const { withLots } = parseOrThrow(duplicateSchema, input ?? {});
    let tags: string[] = [];
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const src = await tx.property.findFirst({
        where: { id, deletedAt: null },
        include: { program: { select: { id: true, name: true, publication: true } }, region: { select: { nameFr: true } }, city: { select: { nameFr: true } }, lots: { where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
      });
      if (!src) throw AppError.notFound();
      if (src.program?.publication === 'ARCHIVED') throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      if (src.programId) await tx.$queryRaw`SELECT id FROM programs WHERE id = ${src.programId}::uuid FOR UPDATE`;
      const reference = propertyReference(src.countryCode, await nextSequenceValue(tx, 'property', src.countryCode, now));
      const title = generateTitle({
        type: src.type as PropertyTypeCode,
        rooms: src.rooms,
        surfaceM2: src.surfaceM2.toString(),
        programName: src.program?.name ?? null,
        cityName: src.city?.nameFr ?? null,
        regionName: src.region.nameFr,
        roomsPrefix: await this.settings.get('display.roomsPrefix'),
      });
      const slug = await uniqueSlug(propertySlug(title, src.region.nameFr, reference), 120, async (s) =>
        Boolean((await tx.property.findFirst({ where: { slug: s, deletedAt: null } })) ?? (await tx.slugHistory.findFirst({ where: { entityType: 'PROPERTY', slug: s } }))),
      );
      const copyId = newId();
      await tx.property.create({
        data: {
          id: copyId,
          reference,
          slug,
          promoterId: src.promoterId,
          programId: src.programId,
          title,
          titleAuto: true,
          description: src.descriptionAuto ? null : src.description,
          descriptionAuto: src.descriptionAuto,
          type: src.type,
          rooms: src.rooms,
          bedrooms: src.bedrooms,
          bathrooms: src.bathrooms,
          surfaceM2: src.surfaceM2,
          terraceM2: src.terraceM2,
          landM2: src.landM2,
          features: src.features,
          standing: src.standing,
          deliveryStatus: src.deliveryStatus,
          deliveryDate: src.deliveryDate,
          deliveryDatePrecision: src.deliveryDatePrecision,
          deliveryOverridden: src.deliveryOverridden,
          countryCode: src.countryCode,
          regionId: src.regionId,
          cityId: src.cityId,
          addressLine: src.addressLine,
          latitude: src.latitude,
          longitude: src.longitude,
          priceCurrency: src.priceCurrency,
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
      await writeAudit(tx, actor, now, { action: 'property.created', entityType: 'property', entityId: copyId, entityLabel: reference, after: { reference, slug, title, programId: src.programId, promoterId: src.promoterId, duplicatedFrom: id, withLots } });
      const copyLot = async (lot: (typeof src.lots)[number], lotReference: string, pending: boolean, order: number) => {
        const lotId = newId();
        await tx.lot.create({
          data: {
            id: lotId,
            propertyId: copyId,
            reference: lotReference,
            referencePending: pending,
            building: lot.building,
            floor: lot.floor,
            door: pending ? null : lot.door,
            orientation: lot.orientation,
            surfaceM2: lot.surfaceM2,
            terraceM2: lot.terraceM2,
            landM2: lot.landM2,
            price: lot.price,
            priceUpdatedAt: now,
            status: pending ? 'WITHDRAWN' : 'AVAILABLE',
            statusChangedAt: now,
            parkingIncluded: lot.parkingIncluded,
            extras: lot.extras,
            sortOrder: order,
            createdById: stampBy(actor),
            updatedById: stampBy(actor),
            createdAt: now,
            updatedAt: now,
          },
        });
        await writeAudit(tx, actor, now, { action: 'lot.created', entityType: 'lot', entityId: lotId, entityLabel: `${reference} · ${lotReference}`, after: { propertyId: copyId, reference: lotReference, price: lot.price, status: pending ? 'WITHDRAWN' : 'AVAILABLE', duplicatedFrom: lot.id } });
      };
      if (!src.programId) {
        // MOD-212 — a standalone property always has its single lot, under its own reference.
        const lot = src.lots[0];
        if (lot) await copyLot(lot, reference, false, 0);
      } else if (withLots) {
        for (const [i, lot] of src.lots.entries()) await copyLot(lot, await provisionalReference(tx, lot.reference, { programId: src.programId, propertyId: copyId }), true, i);
      }
      await this.caches.recalcPropertyAndProgram(tx, copyId);
      tags = propertyTags({ id: copyId, programId: src.programId });
      return { id: copyId };
    }, { timeout: 30_000 });
    await this.notifier.committed(tags);
    return result;
  }

  /** CTL-044 « Supprimer » (`catalogue.delete`) — refused when it has a request, a dossier or a reservation: it is archived instead. */
  async remove(id: string, actor: Actor): Promise<{ deleted: true }> {
    let tags: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM properties WHERE id = ${id}::uuid FOR UPDATE`;
      const p = await tx.property.findFirst({ where: { id, deletedAt: null } });
      if (!p) throw AppError.notFound();
      const used =
        (await tx.lead.count({ where: { propertyId: id } })) +
        (await tx.dossier.count({ where: { OR: [{ propertyId: id }, { dossierCandidates: { some: { propertyId: id } } }] } })) +
        (await tx.reservation.count({ where: { lot: { propertyId: id } } }));
      if (used > 0) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'PROPERTY_IN_USE' });
      await tx.lot.updateMany({ where: { propertyId: id, deletedAt: null }, data: { deletedAt: now, updatedAt: now } });
      await tx.property.update({ where: { id }, data: { deletedAt: now, featuredRank: null, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'property.deleted', entityType: 'property', entityId: id, entityLabel: p.reference, before: { reference: p.reference, title: p.title, publication: p.publication, programId: p.programId } });
      if (p.programId) await this.caches.recalcProgram(tx, p.programId);
      tags = propertyTags(p);
    });
    await this.notifier.committed(tags);
    return { deleted: true };
  }

  /** CTL-130 — one bank's line on a programme or a property; `accepted: null` removes it (« Non renseigné »). */
  async setEligibility(scope: { programId: string } | { propertyId: string }, bankId: string, input: AdminEligibilityInput, actor: Actor): Promise<{ saved: true }> {
    const data = parseOrThrow(eligibilityInputSchema, input);
    const today = localDate(this.clock.now(), await this.settings.get('business.calendar.timezone'));
    const checkedOn = data.checkedAt ?? today;
    if (checkedOn > today) throw AppError.validation([{ field: 'checkedAt', code: 'DATE_IN_FUTURE' }]);
    let tags: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const bank = await tx.bank.findFirst({ where: { id: bankId, deletedAt: null, status: 'ACTIVE' }, select: { id: true, name: true } });
      if (!bank) throw AppError.validation([{ field: 'bankId', code: 'INVALID_CHOICE' }]);
      const owner =
        'programId' in scope
          ? await tx.program.findFirst({ where: { id: scope.programId, deletedAt: null }, select: { id: true, name: true } })
          : await tx.property.findFirst({ where: { id: scope.propertyId, deletedAt: null }, select: { id: true, reference: true, programId: true } });
      if (!owner) throw AppError.notFound();
      const key = 'programId' in scope ? { bankId_programId: { bankId, programId: owner.id } } : { bankId_propertyId: { bankId, propertyId: owner.id } };
      const before = await tx.financingEligibility.findUnique({ where: key as never });
      const link = 'programId' in scope ? { programId: owner.id } : { propertyId: owner.id };
      if (data.accepted === null) {
        if (before) await tx.financingEligibility.delete({ where: { id: before.id } });
      } else if (before) {
        await tx.financingEligibility.update({ where: { id: before.id }, data: { accepted: data.accepted, note: data.note || null, checkedAt: new Date(`${checkedOn}T00:00:00Z`), checkedById: stampBy(actor), updatedById: stampBy(actor), updatedAt: now } });
      } else {
        await tx.financingEligibility.create({ data: { id: newId(), bankId, ...link, accepted: data.accepted, note: data.note || null, checkedAt: new Date(`${checkedOn}T00:00:00Z`), checkedById: stampBy(actor), createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
      }
      await writeAudit(tx, actor, now, {
        action: 'eligibility.changed',
        entityType: 'financing_eligibility',
        entityId: before?.id ?? null,
        entityLabel: bank.name,
        before: before ? { accepted: before.accepted, note: before.note, ...link, bankId } : { accepted: null, ...link, bankId },
        after: { accepted: data.accepted, note: data.note ?? null, checkedAt: checkedOn, ...link, bankId },
      });
      // MOD-240 — the public tag follows: the properties' caches.
      if ('programId' in scope) {
        await this.caches.recalcProgramTree(tx, owner.id);
        tags = programTags(owner.id);
      } else {
        await this.caches.recalcPropertyAndProgram(tx, owner.id);
        tags = propertyTags(owner as { id: string; programId: string | null });
      }
    }, { timeout: 30_000 });
    await this.notifier.committed(tags);
    return { saved: true };
  }
}
