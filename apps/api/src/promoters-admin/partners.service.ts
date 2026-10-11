// CTL-170 — « Autres partenaires » of the public page « Nos partenaires » (EDI-035): notaries, insurers, institutions,
// media. A simple list (`content.manage`): name · category · presentation (600) · website · logo · « Visible sur le
// site » · order (by hand). Create, edit, hide, delete (to the trash). Every change: `partner.changed`; the public page
// is refreshed (tag `catalogue`, the tag the page is cached under).
import { Injectable } from '@nestjs/common';
import { ErrorCode, PARTNER_VIEWS, partnerInputSchema, partnerListQuerySchema, type AdminPartner, type PartnerList } from '@dp/contracts';
import { z } from 'zod';
import type { Partner, Prisma } from '../generated/prisma/client.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { diff, writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { CatalogueReferenceService, adminImageRef } from '../catalogue-admin/catalogue-reference.js';

const moveSchema = z.object({ direction: z.enum(['up', 'down']) });

@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly notifier: ChangeNotifier,
    private readonly references: CatalogueReferenceService,
  ) {}

  private async view(rows: Partner[]): Promise<AdminPartner[]> {
    const logos = await this.prisma.media.findMany({ where: { id: { in: rows.map((r) => r.logoMediaId).filter((x): x is string => Boolean(x)) }, deletedAt: null } });
    const url = this.references.mediaUrl();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      descriptionPublic: r.descriptionPublic,
      url: r.url,
      isPublic: r.isPublic,
      sortOrder: r.sortOrder,
      logo: adminImageRef(url, logos.find((m) => m.id === r.logoMediaId) ?? null, 'thumb'),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /** `GET /admin/partners` (`content.manage`). */
  async list(rawQuery: unknown): Promise<PartnerList> {
    const parsed = partnerListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    const q = parsed.data;
    const viewWhere = (v: string): Prisma.PartnerWhereInput => (v === 'visible' ? { isPublic: true } : v === 'hidden' ? { isPublic: false } : {});
    const criteria = (skip?: 'category'): Prisma.PartnerWhereInput => ({
      AND: [{ deletedAt: null }, viewWhere(q.view ?? 'all'), q.q && q.q.length >= 2 ? { name: { contains: q.q, mode: 'insensitive' } } : {}, skip !== 'category' && q.category.length ? { category: { in: q.category } } : {}],
    });
    const dir = q.sort.startsWith('-') ? 'desc' : 'asc';
    const orderBy: Prisma.PartnerOrderByWithRelationInput[] = q.sort.includes('name') ? [{ name: dir }, { id: 'asc' }] : [{ sortOrder: dir }, { name: 'asc' }, { id: 'asc' }];
    const where = criteria();
    const [total, rows, byCategory, viewCounts] = await Promise.all([
      this.prisma.partner.count({ where }),
      this.prisma.partner.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.partner.groupBy({ by: ['category'], where: criteria('category'), _count: { _all: true } }),
      Promise.all(PARTNER_VIEWS.map((v) => this.prisma.partner.count({ where: { deletedAt: null, ...viewWhere(v) } }))),
    ]);
    return {
      data: await this.view(rows),
      meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
      views: Object.fromEntries(PARTNER_VIEWS.map((v, i) => [v, viewCounts[i]!])) as PartnerList['views'],
      facets: { category: Object.fromEntries(byCategory.map((r) => [r.category, r._count._all])) },
    };
  }

  async one(id: string): Promise<AdminPartner> {
    const p = await this.prisma.partner.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw AppError.notFound();
    return (await this.view([p]))[0]!;
  }

  async create(input: unknown, actor: Actor): Promise<AdminPartner> {
    const data = parseOrThrow(partnerInputSchema, input);
    const created = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const last = await tx.partner.aggregate({ where: { deletedAt: null }, _max: { sortOrder: true } });
      const p = await tx.partner.create({ data: { id: newId(), name: data.name, category: data.category, descriptionPublic: data.descriptionPublic || null, url: data.url || null, isPublic: data.isPublic, sortOrder: (last._max.sortOrder ?? 0) + 10, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'partner.changed', entityType: 'partner', entityId: p.id, entityLabel: p.name, after: { name: p.name, category: p.category, isPublic: p.isPublic, created: true } });
      return p;
    });
    await this.notifier.committed(['catalogue']);
    return (await this.view([created]))[0]!;
  }

  async update(id: string, input: unknown, actor: Actor): Promise<AdminPartner> {
    const data = parseOrThrow(partnerInputSchema.partial(), input);
    const updated = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const before = await tx.partner.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw AppError.notFound();
      const patch = Object.fromEntries(Object.entries({ ...data, descriptionPublic: data.descriptionPublic === undefined ? undefined : data.descriptionPublic || null, url: data.url === undefined ? undefined : data.url || null }).filter(([, v]) => v !== undefined));
      const changes = diff(before as unknown as Record<string, unknown>, patch);
      if (!changes) return before;
      const p = await tx.partner.update({ where: { id }, data: { ...patch, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'partner.changed', entityType: 'partner', entityId: id, entityLabel: p.name, ...changes });
      return p;
    });
    await this.notifier.committed(['catalogue']);
    return (await this.view([updated]))[0]!;
  }

  /** Order by hand: swaps with its neighbour. */
  async move(id: string, input: unknown, actor: Actor): Promise<{ saved: true }> {
    const { direction } = parseOrThrow(moveSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const all = await tx.partner.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }] });
      const i = all.findIndex((p) => p.id === id);
      if (i < 0) throw AppError.notFound();
      const j = direction === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= all.length) return;
      [all[i], all[j]] = [all[j]!, all[i]!];
      for (const [k, p] of all.entries()) if (p.sortOrder !== (k + 1) * 10) await tx.partner.update({ where: { id: p.id }, data: { sortOrder: (k + 1) * 10, updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'partner.changed', entityType: 'partner', entityId: id, entityLabel: all[j]!.name, after: { moved: direction } });
    });
    await this.notifier.committed(['catalogue']);
    return { saved: true };
  }

  /** « Supprimer » — to the trash (`deletedAt`). */
  async remove(id: string, actor: Actor): Promise<{ deleted: true }> {
    await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const p = await tx.partner.findFirst({ where: { id, deletedAt: null } });
      if (!p) throw AppError.notFound();
      await tx.partner.update({ where: { id }, data: { deletedAt: now, isPublic: false, updatedById: stampBy(actor), updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'partner.changed', entityType: 'partner', entityId: id, entityLabel: p.name, before: { isPublic: p.isPublic }, after: { deleted: true } });
    });
    await this.notifier.committed(['catalogue']);
    return { deleted: true };
  }
}
