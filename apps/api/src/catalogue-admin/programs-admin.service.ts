// Programmes — 01-domaine/03 § 1, CTL-022…CTL-024, MOD-200/MOD-201 (inheritance), CYC-122, CYC-125, CYC-126.
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@dp/contracts';
import type { Prisma, Program } from '../generated/prisma/client.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { slugify } from '../platform/slug.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { diff, writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { CatalogueCaches } from './catalogue-caches.js';
import { programPublicationMissing } from './catalogue-rules.js';
import { firstDayOfPeriod, uniqueSlug } from './catalogue-texts.js';
import { emitCatalogueEvent } from './catalogue-events.js';
import { conflictVersion, missingConditions } from './partners-admin.service.js';
import { PropertyPublication } from './property-publication.js';
import { programCreateSchema, programUpdateSchema, type ProgramCreate, type ProgramUpdate } from './schemas.js';

const INHERITED = ['countryCode', 'regionId', 'cityId', 'standing'] as const;
const DELIVERY = ['deliveryStatus', 'deliveryDate', 'deliveryDatePrecision'] as const;

export const programTags = (id: string) => ['catalogue', 'home', `program:${id}`];

@Injectable()
export class ProgramsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly caches: CatalogueCaches,
    private readonly publication: PropertyPublication,
    private readonly notifier: ChangeNotifier,
  ) {}

  /** Location checks: catalogue country, region of that country, city of that region. */
  private async checkPlace(tx: Tx, countryCode: string, regionId: string, cityId: string | null | undefined): Promise<void> {
    const country = await tx.country.findUnique({ where: { code: countryCode } });
    if (!country?.isCatalogueActive) throw AppError.validation([{ field: 'countryCode', code: 'INVALID_CHOICE' }]);
    const region = await tx.region.findFirst({ where: { id: regionId, countryCode } });
    if (!region) throw AppError.validation([{ field: 'regionId', code: 'INVALID_CHOICE' }]);
    if (cityId && !(await tx.city.findFirst({ where: { id: cityId, regionId } }))) {
      throw AppError.validation([{ field: 'cityId', code: 'INVALID_CHOICE' }]);
    }
  }

  private async checkAmenities(codes: string[] | undefined): Promise<void> {
    if (!codes?.length) return;
    const known = new Set((await this.settings.get('catalogue.amenities')).filter((a) => a.isActive).map((a) => a.code));
    const bad = codes.findIndex((c) => !known.has(c));
    if (bad >= 0) throw AppError.validation([{ field: `amenities.${bad}`, code: 'INVALID_CHOICE' }]);
  }

  /** CTL-022 — a new programme is a DRAFT. */
  async create(input: ProgramCreate, actor: Actor): Promise<Program> {
    const data = parseOrThrow(programCreateSchema, input);
    await this.checkAmenities(data.amenities);
    const program = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const promoter = await tx.promoter.findFirst({ where: { id: data.promoterId, deletedAt: null } });
      // CTL-022 — only promoters whose relationship is not ended are proposed.
      if (!promoter || promoter.status === 'ENDED') throw AppError.validation([{ field: 'promoterId', code: 'INVALID_CHOICE' }]);
      await this.checkPlace(tx, data.countryCode, data.regionId, data.cityId);
      const slug = await uniqueSlug(slugify(data.name), 80, async (s) =>
        Boolean((await tx.program.findFirst({ where: { slug: s, deletedAt: null } })) ?? (await tx.slugHistory.findFirst({ where: { entityType: 'PROGRAM', slug: s } }))),
      );
      const created = await tx.program.create({
        data: {
          id: newId(),
          promoterId: data.promoterId,
          name: data.name,
          slug,
          tagline: data.tagline || null,
          description: data.description || null,
          standing: data.standing,
          countryCode: data.countryCode,
          regionId: data.regionId,
          cityId: data.cityId ?? null,
          addressLine: data.addressLine || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          deliveryStatus: data.deliveryStatus,
          deliveryDate: data.deliveryDate ? new Date(`${firstDayOfPeriod(data.deliveryDate, data.deliveryDatePrecision)}T00:00:00Z`) : null,
          deliveryDatePrecision: data.deliveryDatePrecision,
          totalUnits: data.totalUnits ?? null,
          amenities: data.amenities,
          guarantees: data.guarantees || null,
          highlightLabel: data.highlightLabel || null,
          highlightUntil: data.highlightUntil ? new Date(`${data.highlightUntil}T00:00:00Z`) : null,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
          publication: 'DRAFT',
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, {
        action: 'program.created',
        entityType: 'program',
        entityId: created.id,
        entityLabel: created.name,
        after: { name: created.name, slug, promoterId: created.promoterId, regionId: created.regionId, standing: created.standing },
      });
      return created;
    });
    return program;
  }

  /** MOD-201 — place, standing or delivery recomputed on the properties in the same transaction; CYC-122 checked. */
  async update(id: string, input: ProgramUpdate, actor: Actor): Promise<Program> {
    const data = parseOrThrow(programUpdateSchema, input);
    await this.checkAmenities(data.amenities);
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const before = await tx.program.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw AppError.notFound();
      if (data.version !== undefined && data.version !== before.version) throw conflictVersion(before.version, before.updatedAt);
      const { version: _v, deliveryDate, highlightUntil, ...rest } = data;
      const precision = data.deliveryDatePrecision ?? before.deliveryDatePrecision;
      const patch: Record<string, unknown> = { ...rest };
      if (deliveryDate !== undefined) patch.deliveryDate = deliveryDate ? new Date(`${firstDayOfPeriod(deliveryDate, precision)}T00:00:00Z`) : null;
      if (highlightUntil !== undefined) patch.highlightUntil = highlightUntil ? new Date(`${highlightUntil}T00:00:00Z`) : null;
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const changes = diff(before as unknown as Record<string, unknown>, clean);
      if (!changes) return before;
      const next = { ...before, ...clean } as Program;
      if (next.deliveryStatus !== 'DELIVERED' && !next.deliveryDate) throw AppError.validation([{ field: 'deliveryDate', code: 'REQUIRED' }]);
      if (INHERITED.some((k) => k in changes.after)) await this.checkPlace(tx, next.countryCode, next.regionId, next.cityId);
      // CTL-022 — only a promoter whose relationship is not ended; its properties follow (MOD-200).
      if ('promoterId' in changes.after) {
        const promoter = await tx.promoter.findFirst({ where: { id: next.promoterId, deletedAt: null } });
        if (!promoter || promoter.status === 'ENDED') throw AppError.validation([{ field: 'promoterId', code: 'INVALID_CHOICE' }]);
      }

      const updated = await tx.program.update({
        where: { id, version: before.version },
        data: { ...(clean as Prisma.ProgramUncheckedUpdateInput), version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      // MOD-200 — the properties inherit place and standing, and the delivery unless overridden.
      const inherit: Record<string, unknown> = {};
      for (const k of INHERITED) if (k in changes.after) inherit[k] = updated[k];
      if ('promoterId' in changes.after) inherit.promoterId = updated.promoterId;
      if (Object.keys(inherit).length) await tx.property.updateMany({ where: { programId: id, deletedAt: null }, data: { ...inherit, updatedAt: now } });
      if (DELIVERY.some((k) => k in changes.after)) {
        await tx.property.updateMany({
          where: { programId: id, deletedAt: null, deliveryOverridden: false },
          data: { deliveryStatus: updated.deliveryStatus, deliveryDate: updated.deliveryDate, deliveryDatePrecision: updated.deliveryDatePrecision, updatedAt: now },
        });
      }
      await writeAudit(tx, actor, now, { action: 'program.updated', entityType: 'program', entityId: id, entityLabel: updated.name, ...changes });
      await this.caches.recalcProgramTree(tx, id);
      // CYC-122 — a published programme, or one of its published properties, must stay publishable.
      if (updated.publication === 'PUBLISHED') {
        const missing = await this.publicationMissing(tx, id);
        if (missing.length) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'WOULD_UNPUBLISH' });
      }
      const broken = await this.publication.brokenPublishedChildren(tx, id);
      if (broken.length) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'WOULD_UNPUBLISH_CHILDREN', params: { liste: broken.map((b) => b.title).join(', ') } });
      return updated;
    });
    await this.notifier.committed(programTags(id));
    return result;
  }

  /** CYC-125 conditions of a programme as it is in the database (inside the transaction). */
  async publicationMissing(tx: Tx, id: string): Promise<string[]> {
    const p = await tx.program.findUniqueOrThrow({
      where: { id },
      include: { promoter: { select: { status: true, deletedAt: true } }, country: { select: { isCatalogueActive: true } } },
    });
    const media = await tx.media.count({
      where: { ownerType: 'PROGRAM', ownerId: id, kind: { in: ['PHOTO', 'RENDER_3D', 'PLAN'] }, processingStatus: 'READY', deletedAt: null },
    });
    return programPublicationMissing({
      name: p.name,
      regionId: p.regionId,
      standing: p.standing,
      deliveryStatus: p.deliveryStatus,
      deliveryDate: p.deliveryDate,
      descriptionLength: p.description?.trim().length ?? 0,
      promoterActive: p.promoter.status === 'ACTIVE' && !p.promoter.deletedAt,
      hasReadyMedia: media > 0,
      countryActive: p.country.isCatalogueActive,
    });
  }

  private async transition(
    id: string,
    actor: Actor,
    allowed: string[],
    apply: (tx: Tx, p: Program, now: Date) => Promise<{ action: string; after: Record<string, unknown>; propertyIds?: string[] }>,
  ): Promise<Program> {
    const tags: string[] = [];
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await tx.$queryRaw`SELECT id FROM programs WHERE id = ${id}::uuid FOR UPDATE`;
      const p = await tx.program.findFirst({ where: { id, deletedAt: null } });
      if (!p) throw AppError.notFound();
      if (!allowed.includes(p.publication)) throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      const { action, after, propertyIds = [] } = await apply(tx, p, now);
      await writeAudit(tx, actor, now, { action, entityType: 'program', entityId: id, entityLabel: p.name, before: { publication: p.publication }, after });
      // AUT-010 — program.published / unpublished / archived (unarchiving is not an event of the catalogue).
      if (action !== 'program.unarchived') await emitCatalogueEvent(tx, now, actor, action, { type: 'Program', id });
      await this.caches.recalcProgramTree(tx, id);
      tags.push(...programTags(id), ...propertyIds.map((pid) => `property:${pid}`));
      return tx.program.findUniqueOrThrow({ where: { id } });
    }, { timeout: 30_000 });
    await this.notifier.committed(tags);
    return result;
  }

  /**
   * CYC-125 — DRAFT or ARCHIVED → PUBLISHED. CYC-126: `republishProperties` puts back online the properties unpublished
   * with the programme (`programCascadeAt`); each one passes CYC-120 again, those that fail stay offline.
   */
  async publish(id: string, actor: Actor, options: { republishProperties?: boolean } = {}): Promise<Program> {
    return this.transition(id, actor, ['DRAFT', 'ARCHIVED'], async (tx, p, now) => {
      const missing = await this.publicationMissing(tx, id);
      if (missing.length) throw missingConditions('NOT_PUBLISHABLE', missing);
      await tx.program.update({
        where: { id },
        data: { publication: 'PUBLISHED', publishedAt: now, firstPublishedAt: p.firstPublishedAt ?? now, unpublishedBySuspensionAt: null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      const propertyIds: string[] = [];
      if (options.republishProperties) {
        const cascaded = await tx.property.findMany({ where: { programId: id, deletedAt: null, publication: 'DRAFT', programCascadeAt: { not: null } }, select: { id: true } });
        for (const c of cascaded) {
          if (await this.publication.tryPublishInTx(tx, c.id, actor, now)) propertyIds.push(c.id);
        }
      }
      return { action: 'program.published', after: { publication: 'PUBLISHED' }, propertyIds };
    });
  }

  /** CYC-126 — PUBLISHED → DRAFT, with its published properties (marked `programCascadeAt`). */
  async unpublish(id: string, actor: Actor): Promise<Program> {
    return this.transition(id, actor, ['PUBLISHED'], async (tx, _p, now) => {
      await tx.program.update({ where: { id }, data: { publication: 'DRAFT', unpublishedBySuspensionAt: null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      const props = await tx.property.findMany({ where: { programId: id, deletedAt: null, publication: 'PUBLISHED' }, select: { id: true, reference: true } });
      for (const prop of props) {
        await tx.property.update({
          where: { id: prop.id },
          data: { publication: 'DRAFT', unpublishedAt: now, programCascadeAt: now, unpublishedBySuspensionAt: null, version: { increment: 1 }, updatedAt: now },
        });
        await writeAudit(tx, actor, now, { action: 'property.unpublished', entityType: 'property', entityId: prop.id, entityLabel: prop.reference, before: { publication: 'PUBLISHED' }, after: { publication: 'DRAFT', cascade: true } });
        await emitCatalogueEvent(tx, now, actor, 'property.unpublished', { type: 'Property', id: prop.id });
      }
      return { action: 'program.unpublished', after: { publication: 'DRAFT', propertiesUnpublished: props.length }, propertyIds: props.map((x) => x.id) };
    });
  }

  /** CYC-126 — → ARCHIVED, with its properties not yet archived (marked `programCascadeAt`; pins removed, CTL-150). */
  async archive(id: string, actor: Actor): Promise<Program> {
    return this.transition(id, actor, ['DRAFT', 'PUBLISHED'], async (tx, _p, now) => {
      await tx.program.update({ where: { id }, data: { publication: 'ARCHIVED', version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      const props = await tx.property.findMany({ where: { programId: id, deletedAt: null, publication: { not: 'ARCHIVED' } }, select: { id: true, reference: true, publication: true } });
      for (const prop of props) {
        await tx.property.update({
          where: { id: prop.id },
          data: {
            publication: 'ARCHIVED',
            archivedAt: now,
            unpublishedAt: prop.publication === 'PUBLISHED' ? now : undefined,
            programCascadeAt: now,
            featuredRank: null,
            version: { increment: 1 },
            updatedAt: now,
          },
        });
        await writeAudit(tx, actor, now, { action: 'property.archived', entityType: 'property', entityId: prop.id, entityLabel: prop.reference, before: { publication: prop.publication }, after: { publication: 'ARCHIVED', cascade: true } });
        await emitCatalogueEvent(tx, now, actor, 'property.archived', { type: 'Property', id: prop.id });
      }
      return { action: 'program.archived', after: { publication: 'ARCHIVED', propertiesArchived: props.length }, propertyIds: props.map((x) => x.id) };
    });
  }

  /** CYC-121, CYC-126 — ARCHIVED → DRAFT; `unarchiveProperties` brings back the properties archived with it, as drafts. */
  async unarchive(id: string, actor: Actor, options: { unarchiveProperties?: boolean } = {}): Promise<Program> {
    return this.transition(id, actor, ['ARCHIVED'], async (tx, _p, now) => {
      await tx.program.update({ where: { id }, data: { publication: 'DRAFT', version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now } });
      const propertyIds: string[] = [];
      if (options.unarchiveProperties) {
        const props = await tx.property.findMany({ where: { programId: id, deletedAt: null, publication: 'ARCHIVED', programCascadeAt: { not: null } }, select: { id: true, reference: true } });
        for (const prop of props) {
          await tx.property.update({ where: { id: prop.id }, data: { publication: 'DRAFT', archivedAt: null, version: { increment: 1 }, updatedAt: now } });
          await writeAudit(tx, actor, now, { action: 'property.unarchived', entityType: 'property', entityId: prop.id, entityLabel: prop.reference, before: { publication: 'ARCHIVED' }, after: { publication: 'DRAFT', cascade: true } });
          propertyIds.push(prop.id);
        }
      }
      return { action: 'program.unarchived', after: { publication: 'DRAFT' }, propertyIds };
    });
  }
}
