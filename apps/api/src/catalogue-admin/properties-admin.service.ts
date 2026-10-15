// Properties — 01-domaine/03 § 2, CTL-041…CTL-044, MOD-200, MOD-210…MOD-213, CYC-120…CYC-122, CTL-150 (pin).
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@dp/contracts';
import type { Prisma, Property } from '../generated/prisma/client.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { diff, writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { nextSequenceValue, propertyReference } from '../admin/sequences.js';
import { CatalogueCaches } from './catalogue-caches.js';
import { firstDayOfPeriod, generateTitle, propertySlug, uniqueSlug, type PropertyTypeCode } from './catalogue-texts.js';
import { emitCatalogueEvent } from './catalogue-events.js';
import { conflictVersion, missingConditions } from './partners-admin.service.js';
import { PropertyPublication } from './property-publication.js';
import { featureSchema, propertyCreateSchema, propertyUpdateSchema, type PropertyCreate, type PropertyUpdate } from './schemas.js';

export const propertyTags = (p: { id: string; programId: string | null }) => [
  'catalogue',
  'home',
  `property:${p.id}`,
  ...(p.programId ? [`program:${p.programId}`] : []),
];

const date = (iso: string | null | undefined) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

@Injectable()
export class PropertiesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly caches: CatalogueCaches,
    private readonly publication: PropertyPublication,
    private readonly notifier: ChangeNotifier,
  ) {}

  private async checkFeatures(codes: string[] | undefined): Promise<void> {
    if (!codes?.length) return;
    const known = new Set((await this.settings.get('catalogue.features')).filter((f) => f.isActive).map((f) => f.code));
    const bad = codes.findIndex((c) => !known.has(c));
    if (bad >= 0) throw AppError.validation([{ field: `features.${bad}`, code: 'INVALID_CHOICE' }]);
  }

  /**
   * CTL-041 — a typology of a programme (place, standing, promoter, delivery inherited, MOD-200) or a standalone
   * property with exactly one lot created with it (MOD-212). Reference `DP-{pays}-{n}` from the Sequence (TRV-051),
   * generated title (MOD-210) unless typed, generated description (MOD-211) unless typed, slug title-region-reference.
   */
  async create(input: PropertyCreate, actor: Actor): Promise<Property> {
    const data = parseOrThrow(propertyCreateSchema, input);
    await this.checkFeatures(data.features);
    const property = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      let base: {
        promoterId: string;
        countryCode: string;
        regionId: string;
        cityId: string | null;
        standing: 'COMFORT' | 'STANDING' | 'PREMIUM';
        deliveryStatus: 'ON_PLAN' | 'UNDER_CONSTRUCTION' | 'DELIVERED';
        deliveryDate: Date | null;
        deliveryDatePrecision: 'MONTH' | 'QUARTER' | 'YEAR';
        programName: string | null;
      };
      let deliveryOverridden = false;
      if (data.programId) {
        await tx.$queryRaw`SELECT id FROM programs WHERE id = ${data.programId}::uuid FOR UPDATE`;
        const program = await tx.program.findFirst({ where: { id: data.programId, deletedAt: null } });
        if (!program) throw AppError.validation([{ field: 'programId', code: 'INVALID_CHOICE' }]);
        if (program.publication === 'ARCHIVED') throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
        deliveryOverridden = Boolean(data.deliveryStatus);
        const precision = data.deliveryDatePrecision ?? program.deliveryDatePrecision;
        base = {
          promoterId: program.promoterId,
          countryCode: program.countryCode,
          regionId: program.regionId,
          cityId: program.cityId,
          standing: program.standing,
          deliveryStatus: data.deliveryStatus ?? program.deliveryStatus,
          deliveryDate: data.deliveryStatus ? date(data.deliveryDate && firstDayOfPeriod(data.deliveryDate, precision)) : program.deliveryDate,
          deliveryDatePrecision: data.deliveryStatus ? precision : program.deliveryDatePrecision,
          programName: program.name,
        };
      } else {
        const promoter = await tx.promoter.findFirst({ where: { id: data.promoterId!, deletedAt: null } });
        if (!promoter || promoter.status === 'ENDED') throw AppError.validation([{ field: 'promoterId', code: 'INVALID_CHOICE' }]);
        const country = await tx.country.findUnique({ where: { code: data.countryCode! } });
        if (!country?.isCatalogueActive) throw AppError.validation([{ field: 'countryCode', code: 'INVALID_CHOICE' }]);
        if (!(await tx.region.findFirst({ where: { id: data.regionId!, countryCode: data.countryCode! } }))) throw AppError.validation([{ field: 'regionId', code: 'INVALID_CHOICE' }]);
        if (data.cityId && !(await tx.city.findFirst({ where: { id: data.cityId, regionId: data.regionId! } }))) throw AppError.validation([{ field: 'cityId', code: 'INVALID_CHOICE' }]);
        const precision = data.deliveryDatePrecision ?? 'QUARTER';
        base = {
          promoterId: data.promoterId!,
          countryCode: data.countryCode!,
          regionId: data.regionId!,
          cityId: data.cityId ?? null,
          standing: data.standing!,
          deliveryStatus: data.deliveryStatus!,
          deliveryDate: date(data.deliveryDate && firstDayOfPeriod(data.deliveryDate, precision)),
          deliveryDatePrecision: precision,
          programName: null,
        };
      }
      const country = await tx.country.findUniqueOrThrow({ where: { code: base.countryCode } });
      const region = await tx.region.findUniqueOrThrow({ where: { id: base.regionId } });
      const city = base.cityId ? await tx.city.findUnique({ where: { id: base.cityId } }) : null;
      const rooms = data.type === 'STUDIO' ? 1 : data.type === 'LAND' || data.type === 'COMMERCIAL' ? null : (data.rooms ?? null);

      const reference = propertyReference(base.countryCode, await nextSequenceValue(tx, 'property', base.countryCode, now));
      const title =
        data.title ||
        generateTitle({
          type: data.type as PropertyTypeCode,
          rooms,
          surfaceM2: data.surfaceM2,
          programName: base.programName,
          cityName: city?.nameFr ?? null,
          regionName: region.nameFr,
          roomsPrefix: await this.settings.get('display.roomsPrefix'),
        });
      const slug = await uniqueSlug(propertySlug(title, region.nameFr, reference), 120, async (s) =>
        Boolean((await tx.property.findFirst({ where: { slug: s, deletedAt: null } })) ?? (await tx.slugHistory.findFirst({ where: { entityType: 'PROPERTY', slug: s } }))),
      );
      const id = newId();
      const created = await tx.property.create({
        data: {
          id,
          reference,
          slug,
          promoterId: base.promoterId,
          programId: data.programId ?? null,
          title,
          titleAuto: !data.title,
          description: data.description || null,
          descriptionAuto: !data.description,
          type: data.type,
          rooms,
          bedrooms: data.bedrooms ?? null,
          bathrooms: data.bathrooms ?? null,
          surfaceM2: data.surfaceM2.toFixed(2),
          terraceM2: data.terraceM2?.toFixed(2) ?? null,
          landM2: data.landM2?.toFixed(2) ?? null,
          features: data.features,
          standing: base.standing,
          deliveryStatus: base.deliveryStatus,
          deliveryDate: base.deliveryDate,
          deliveryDatePrecision: base.deliveryDatePrecision,
          deliveryOverridden,
          countryCode: base.countryCode,
          regionId: base.regionId,
          cityId: base.cityId,
          addressLine: data.programId ? null : data.addressLine || null,
          latitude: data.programId ? null : (data.latitude ?? null),
          longitude: data.programId ? null : (data.longitude ?? null),
          priceCurrency: country.currency,
          highlightLabel: data.highlightLabel || null,
          highlightUntil: date(data.highlightUntil),
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
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
      await writeAudit(tx, actor, now, {
        action: 'property.created',
        entityType: 'property',
        entityId: id,
        entityLabel: reference,
        after: { reference, slug, title, programId: created.programId, promoterId: created.promoterId, type: created.type, rooms },
      });
      // MOD-212 — the single lot of a standalone property: its reference and surfaces are the property's.
      if (!data.programId) {
        const lotId = newId();
        await tx.lot.create({
          data: {
            id: lotId,
            propertyId: id,
            reference,
            floor: data.floor ?? null,
            orientation: data.orientation ?? null,
            surfaceM2: data.surfaceM2.toFixed(2),
            terraceM2: data.terraceM2?.toFixed(2) ?? null,
            landM2: data.landM2?.toFixed(2) ?? null,
            price: data.price!,
            priceUpdatedAt: now,
            status: 'AVAILABLE',
            statusChangedAt: now,
            parkingIncluded: data.parkingIncluded ?? null,
            sortOrder: 0,
            createdById: stampBy(actor),
            updatedById: stampBy(actor),
            createdAt: now,
            updatedAt: now,
          },
        });
        await writeAudit(tx, actor, now, { action: 'lot.created', entityType: 'lot', entityId: lotId, entityLabel: reference, after: { propertyId: id, price: data.price, status: 'AVAILABLE' } });
      }
      await this.caches.recalcPropertyAndProgram(tx, id);
      return tx.property.findUniqueOrThrow({ where: { id } });
    });
    await this.notifier.committed(propertyTags(property));
    return property;
  }

  /** CTL-042 — fields of the property; MOD-213 locks; CYC-122: a published property must stay publishable. */
  async update(id: string, input: PropertyUpdate, actor: Actor): Promise<Property> {
    const data = parseOrThrow(propertyUpdateSchema, input);
    await this.checkFeatures(data.features);
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const before = await tx.property.findFirst({ where: { id, deletedAt: null }, include: { program: true } });
      if (!before) throw AppError.notFound();
      if (data.version !== undefined && data.version !== before.version) throw conflictVersion(before.version, before.updatedAt);
      const patch: Record<string, unknown> = {};
      // MOD-213 — type and rooms are locked after the first publication once the property received a request.
      if ((data.type !== undefined && data.type !== before.type) || (data.rooms !== undefined && data.rooms !== before.rooms)) {
        if (before.firstPublishedAt && before.interestCount > 0) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      }
      for (const k of ['type', 'rooms', 'bedrooms', 'bathrooms', 'features', 'highlightLabel', 'seoTitle', 'seoDescription'] as const) {
        if (data[k] !== undefined) patch[k] = data[k];
      }
      for (const k of ['surfaceM2', 'terraceM2', 'landM2'] as const) {
        if (data[k] !== undefined) patch[k] = data[k] === null ? null : data[k]!.toFixed(2);
      }
      if (data.highlightUntil !== undefined) patch.highlightUntil = date(data.highlightUntil);
      if (data.title) Object.assign(patch, { title: data.title, titleAuto: false });
      if (data.titleAuto) patch.titleAuto = true;
      if (data.description) Object.assign(patch, { description: data.description, descriptionAuto: false });
      if (data.descriptionAuto) Object.assign(patch, { descriptionAuto: true });
      // MOD-200 — delivery: overridden, or taken back from the programme.
      if (data.deliveryOverridden === false && before.program) {
        Object.assign(patch, {
          deliveryOverridden: false,
          deliveryStatus: before.program.deliveryStatus,
          deliveryDate: before.program.deliveryDate,
          deliveryDatePrecision: before.program.deliveryDatePrecision,
        });
      } else if (data.deliveryStatus !== undefined || data.deliveryDate !== undefined || data.deliveryDatePrecision !== undefined) {
        const status = data.deliveryStatus ?? before.deliveryStatus;
        const precision = data.deliveryDatePrecision ?? before.deliveryDatePrecision;
        const iso = data.deliveryDate !== undefined ? data.deliveryDate : before.deliveryDate?.toISOString().slice(0, 10) ?? null;
        if (status !== 'DELIVERED' && !iso) throw AppError.validation([{ field: 'deliveryDate', code: 'REQUIRED' }]);
        Object.assign(patch, {
          deliveryStatus: status,
          deliveryDate: date(iso && firstDayOfPeriod(iso, precision)),
          deliveryDatePrecision: precision,
          deliveryOverridden: Boolean(before.programId),
        });
      }
      // CTL-042 « Localisation », standing and promoter — a standalone property only (MOD-200: a typology inherits them).
      const placeKeys = ['promoterId', 'standing', 'countryCode', 'regionId', 'cityId', 'addressLine', 'latitude', 'longitude'] as const;
      if (placeKeys.some((k) => data[k] !== undefined)) {
        if (before.programId) throw AppError.validation(placeKeys.filter((k) => data[k] !== undefined).map((k) => ({ field: k, code: 'INVALID_CHOICE' })));
        for (const k of placeKeys) if (data[k] !== undefined) patch[k] = k === 'addressLine' ? data[k] || null : data[k];
        const countryCodeNext = (patch.countryCode ?? before.countryCode) as string;
        const regionNext = (patch.regionId ?? before.regionId) as string;
        const cityNext = (patch.cityId !== undefined ? patch.cityId : before.cityId) as string | null;
        if ('countryCode' in patch || 'regionId' in patch || 'cityId' in patch) {
          const country = await tx.country.findUnique({ where: { code: countryCodeNext } });
          if (!country?.isCatalogueActive) throw AppError.validation([{ field: 'countryCode', code: 'INVALID_CHOICE' }]);
          if (!(await tx.region.findFirst({ where: { id: regionNext, countryCode: countryCodeNext } }))) throw AppError.validation([{ field: 'regionId', code: 'INVALID_CHOICE' }]);
          if (cityNext && !(await tx.city.findFirst({ where: { id: cityNext, regionId: regionNext } }))) throw AppError.validation([{ field: 'cityId', code: 'INVALID_CHOICE' }]);
          // Q (packages 3.4–3.6) — a country with another currency would re-label the price of its lot: refused.
          if (country.currency !== before.priceCurrency) throw AppError.validation([{ field: 'countryCode', code: 'INVALID_CHOICE' }]);
        }
        if (patch.promoterId && patch.promoterId !== before.promoterId) {
          const promoter = await tx.promoter.findFirst({ where: { id: patch.promoterId as string, deletedAt: null } });
          if (!promoter || promoter.status === 'ENDED') throw AppError.validation([{ field: 'promoterId', code: 'INVALID_CHOICE' }]);
        }
      }
      const nextType = (patch.type ?? before.type) as string;
      if (nextType === 'STUDIO') patch.rooms = 1;
      if (nextType === 'LAND' || nextType === 'COMMERCIAL') patch.rooms = null;
      const changes = diff(before as unknown as Record<string, unknown>, patch);
      if (!changes) return before;
      const updated = await tx.property.update({
        where: { id, version: before.version },
        data: { ...(patch as Prisma.PropertyUncheckedUpdateInput), version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      // MOD-212 — the single lot of a standalone property copies its surfaces.
      if (!before.programId && ('surfaceM2' in changes.after || 'terraceM2' in changes.after || 'landM2' in changes.after)) {
        await tx.lot.updateMany({ where: { propertyId: id, deletedAt: null }, data: { surfaceM2: updated.surfaceM2, terraceM2: updated.terraceM2, landM2: updated.landM2, updatedAt: now } });
      }
      await writeAudit(tx, actor, now, { action: 'property.updated', entityType: 'property', entityId: id, entityLabel: before.reference, ...changes });
      if (updated.publication === 'PUBLISHED') {
        const missing = await this.publication.missing(tx, id);
        if (missing.length) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'WOULD_UNPUBLISH' });
      }
      await this.caches.recalcPropertyAndProgram(tx, id);
      return tx.property.findUniqueOrThrow({ where: { id } });
    });
    await this.notifier.committed(propertyTags(result));
    return result;
  }

  private async transition(
    id: string,
    actor: Actor,
    allowed: string[],
    apply: (tx: Tx, p: Property, now: Date) => Promise<void>,
  ): Promise<Property> {
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM properties WHERE id = ${id}::uuid FOR UPDATE`;
      const p = await tx.property.findFirst({ where: { id, deletedAt: null } });
      if (!p) throw AppError.notFound();
      if (!allowed.includes(p.publication)) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      await apply(tx, p, now);
      await this.caches.recalcPropertyAndProgram(tx, id);
      return tx.property.findUniqueOrThrow({ where: { id } });
    });
    await this.notifier.committed(propertyTags(result));
    return result;
  }

  /** CYC-120 — DRAFT or ARCHIVED → PUBLISHED; refused with every missing condition (`NOT_PUBLISHABLE`). */
  async publish(id: string, actor: Actor): Promise<Property> {
    return this.transition(id, actor, ['DRAFT', 'ARCHIVED'], async (tx, p, now) => {
      const missing = await this.publication.missing(tx, id);
      if (missing.length) throw missingConditions('NOT_PUBLISHABLE', missing);
      await this.publication.applyPublish(tx, id, actor, now, p);
    });
  }

  /** CYC-121 — PUBLISHED → DRAFT (the page answers 404); `unpublishedAt` dates the « hors ligne » banner. */
  async unpublish(id: string, actor: Actor): Promise<Property> {
    return this.transition(id, actor, ['PUBLISHED'], async (tx, p, now) => {
      await tx.property.update({
        where: { id },
        data: { publication: 'DRAFT', unpublishedAt: now, programCascadeAt: null, unpublishedBySuspensionAt: null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      await writeAudit(tx, actor, now, { action: 'property.unpublished', entityType: 'property', entityId: id, entityLabel: p.reference, before: { publication: 'PUBLISHED' }, after: { publication: 'DRAFT' } });
      await emitCatalogueEvent(tx, now, actor, 'property.unpublished', { type: 'Property', id });
    });
  }

  /**
   * TRV-052 — « Régénérer l'adresse »: a new slug from the title of now (region and reference kept in it); the old one
   * joins the history, so its address answers 301 to the new one (NAV-040). Nothing changes when the slug is the same.
   */
  async regenerateSlug(id: string, actor: Actor): Promise<Property> {
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM properties WHERE id = ${id}::uuid FOR UPDATE`;
      const p = await tx.property.findFirst({ where: { id, deletedAt: null } });
      if (!p) throw AppError.notFound();
      const region = p.regionId ? await tx.region.findUnique({ where: { id: p.regionId }, select: { nameFr: true } }) : null;
      const slug = await uniqueSlug(propertySlug(p.title, region?.nameFr ?? '', p.reference), 120, async (s) =>
        s !== p.slug && Boolean((await tx.property.findFirst({ where: { slug: s, deletedAt: null, id: { not: id } } })) ?? (await tx.slugHistory.findFirst({ where: { entityType: 'PROPERTY', slug: s, entityId: { not: id } } }))),
      );
      if (slug === p.slug) return p;
      await tx.slugHistory.deleteMany({ where: { entityType: 'PROPERTY', entityId: id, slug } }); // back to one of its own old addresses
      await tx.slugHistory.createMany({ data: [{ id: newId(), entityType: 'PROPERTY', entityId: id, slug: p.slug, createdAt: now, updatedAt: now }], skipDuplicates: true });
      const updated = await tx.property.update({ where: { id }, data: { slug, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'property.updated', entityType: 'property', entityId: id, entityLabel: p.reference, before: { slug: p.slug }, after: { slug } });
      return updated;
    });
    await this.notifier.committed(propertyTags(result));
    return result;
  }

  /** CYC-121 — → ARCHIVED (the page answers 410); archiving removes the home pin (CTL-150). */
  async archive(id: string, actor: Actor): Promise<Property> {
    return this.transition(id, actor, ['DRAFT', 'PUBLISHED'], async (tx, p, now) => {
      await tx.property.update({
        where: { id },
        data: {
          publication: 'ARCHIVED',
          archivedAt: now,
          unpublishedAt: p.publication === 'PUBLISHED' ? now : p.unpublishedAt,
          programCascadeAt: null,
          featuredRank: null,
          version: { increment: 1 },
          updatedById: stampBy(actor),
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, { action: 'property.archived', entityType: 'property', entityId: id, entityLabel: p.reference, before: { publication: p.publication, featuredRank: p.featuredRank }, after: { publication: 'ARCHIVED', featuredRank: null } });
      await emitCatalogueEvent(tx, now, actor, 'property.archived', { type: 'Property', id });
    });
  }

  /** CYC-121 — ARCHIVED → DRAFT, to be reworked then republished through CYC-120. */
  async unarchive(id: string, actor: Actor): Promise<Property> {
    return this.transition(id, actor, ['ARCHIVED'], async (tx, p, now) => {
      await tx.property.update({ where: { id }, data: { publication: 'DRAFT', archivedAt: null, programCascadeAt: null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'property.unarchived', entityType: 'property', entityId: id, entityLabel: p.reference, before: { publication: 'ARCHIVED' }, after: { publication: 'DRAFT' } });
    });
  }

  /**
   * CTL-150 — pin on the home page (rank 1–3) or unpin (`null`). Only a published property is pinned; at most three
   * pins: a fourth requires removing one (`MAX_REACHED`); a rank already used moves the other pin out.
   */
  async feature(id: string, input: { rank: number | null }, actor: Actor): Promise<Property> {
    const { rank } = parseOrThrow(featureSchema, input);
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const p = await tx.property.findFirst({ where: { id, deletedAt: null } });
      if (!p) throw AppError.notFound();
      if (rank !== null && p.publication !== 'PUBLISHED') throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      if (rank !== null) {
        const pinned = await tx.property.findMany({ where: { featuredRank: { not: null }, deletedAt: null, NOT: { id } }, select: { id: true, featuredRank: true } });
        const sameRank = pinned.find((x) => x.featuredRank === rank);
        if (!sameRank && pinned.length >= 3) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'MAX_REACHED', params: { n: 3 } });
        if (sameRank) await tx.property.update({ where: { id: sameRank.id }, data: { featuredRank: null, updatedAt: now } });
      }
      const updated = await tx.property.update({ where: { id }, data: { featuredRank: rank, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'property.pinned', entityType: 'property', entityId: id, entityLabel: p.reference, before: { featuredRank: p.featuredRank }, after: { featuredRank: rank } });
      return updated;
    });
    await this.notifier.committed(['home', `property:${id}`]);
    return result;
  }
}
