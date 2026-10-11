// CYC-120 — the publication conditions of a property, evaluated on the database state inside a transaction
// (also used by CYC-122: a change must not break a published property, and by CYC-126: republish with the programme).
import { Injectable } from '@nestjs/common';
import { OutboxWriter } from '../platform/outbox.js';
import type { Tx } from '../platform/tx.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { CatalogueCaches, type CacheContext } from './catalogue-caches.js';
import { propertyPublicationMissing } from './catalogue-rules.js';

@Injectable()
export class PropertyPublication {
  constructor(
    private readonly caches: CatalogueCaches,
    private readonly outbox: OutboxWriter,
  ) {}

  /** Recalculates the property's caches (MOD-220) and returns every missing CYC-120 condition. */
  async missing(tx: Tx, propertyId: string, ctx?: CacheContext): Promise<string[]> {
    ctx ??= await this.caches.context(tx);
    const facts = await this.caches.recalcProperty(tx, propertyId, ctx);
    const p = await tx.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: {
        programId: true,
        promoter: { select: { status: true, deletedAt: true } },
        program: { select: { publication: true, deletedAt: true } },
        country: { select: { isCatalogueActive: true } },
      },
    });
    return propertyPublicationMissing({
      missingRequiredFields: facts.completeness.missingMandatory.filter((f) => f !== 'PRICE'),
      hasPricedLot: facts.hasPricedLot,
      hasReadyMedia: facts.hasReadyMedia,
      completenessScore: facts.completeness.score,
      publishMinScore: ctx.thresholds.publishMinScore,
      promoterActive: p.promoter.status === 'ACTIVE' && !p.promoter.deletedAt,
      programPublished: p.programId ? p.program?.publication === 'PUBLISHED' && !p.program.deletedAt : null,
      countryActive: p.country.isCatalogueActive,
    });
  }

  /** CYC-120 effects, without the checks (the caller has checked). */
  async applyPublish(tx: Tx, propertyId: string, actor: Actor, now: Date, before: { publication: string; firstPublishedAt: Date | null; reference: string }): Promise<void> {
    await tx.property.update({
      where: { id: propertyId },
      data: {
        publication: 'PUBLISHED',
        publishedAt: now,
        firstPublishedAt: before.firstPublishedAt ?? now,
        archivedAt: null,
        unpublishedAt: null,
        programCascadeAt: null,
        unpublishedBySuspensionAt: null,
        version: { increment: 1 },
        updatedById: stampBy(actor),
        updatedAt: now,
      },
    });
    await writeAudit(tx, actor, now, {
      action: 'property.published',
      entityType: 'property',
      entityId: propertyId,
      entityLabel: before.reference,
      before: { publication: before.publication },
      after: { publication: 'PUBLISHED' },
    });
    // AUT-060 — search alerts listen to `property.published`.
    await this.outbox.add(tx, { type: 'property.published', aggregateType: 'property', aggregateId: propertyId, payload: { reference: before.reference, isFirstPublication: !before.firstPublishedAt } }, now);
    // Relevance freshness starts at the first publication (CAL-080).
    await this.caches.recalcProperty(tx, propertyId);
  }

  /** CYC-126 — republish one property with its programme if it still passes CYC-120; `false` otherwise. */
  async tryPublishInTx(tx: Tx, propertyId: string, actor: Actor, now: Date): Promise<boolean> {
    const missing = await this.missing(tx, propertyId);
    if (missing.length) return false;
    const p = await tx.property.findUniqueOrThrow({ where: { id: propertyId }, select: { publication: true, firstPublishedAt: true, reference: true } });
    await this.applyPublish(tx, propertyId, actor, now, p);
    return true;
  }

  /** CYC-122 — published properties of a programme that would no longer pass CYC-120. */
  async brokenPublishedChildren(tx: Tx, programId: string): Promise<{ id: string; title: string }[]> {
    const ctx = await this.caches.context(tx);
    const props = await tx.property.findMany({ where: { programId, deletedAt: null, publication: 'PUBLISHED' }, select: { id: true, title: true } });
    const broken: { id: string; title: string }[] = [];
    for (const p of props) if ((await this.missing(tx, p.id, ctx)).length) broken.push(p);
    return broken;
  }
}
