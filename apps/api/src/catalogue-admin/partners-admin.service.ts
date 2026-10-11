// Promoters (CTL-002…CTL-004, MOD-103, MOD-110, CYC-240) and banks (minimal: what the Cafés and MOD-240 need).
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@dp/contracts';
import type { Bank, Promoter } from '../generated/prisma/client.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { slugify } from '../platform/slug.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { stampBy, type Actor } from '../admin/actor.js';
import { diff, writeAudit } from '../admin/audit.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { CatalogueCaches } from './catalogue-caches.js';
import { emitCatalogueEvent } from './catalogue-events.js';
import { uniqueSlug } from './catalogue-texts.js';
import {
  bankCreateSchema,
  bankUpdateSchema,
  promoterCreateSchema,
  promoterUpdateSchema,
  statusReasonSchema,
  type BankCreate,
  type BankUpdate,
  type PromoterCreate,
  type PromoterUpdate,
} from './schemas.js';

const day = (iso: string | null | undefined) => (iso === undefined ? undefined : iso === null ? null : new Date(`${iso}T00:00:00Z`));

export function missingConditions(reason: string, codes: string[]): AppError {
  return new AppError(ErrorCode.CONFLICT_STATE, { reason, details: codes.map((field) => ({ field, code: 'MISSING_CONDITION' })) });
}

export function conflictVersion(current: number, updatedAt: Date): AppError {
  return new AppError(ErrorCode.CONFLICT_VERSION, { params: { currentVersion: current, updatedByFirstName: null, updatedAt: updatedAt.toISOString() } });
}

@Injectable()
export class PartnersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly caches: CatalogueCaches,
    private readonly notifier: ChangeNotifier,
  ) {}

  /** MOD-103 — the organisation slug is unique among ALL organisations: suffixed if taken by another type. */
  private async createOrganization(tx: Tx, type: 'PROMOTER' | 'BANK', name: string, slug: string, actor: Actor, now: Date): Promise<string> {
    const orgSlug = await uniqueSlug(slug, 80, async (s) => Boolean(await tx.organization.findUnique({ where: { slug: s } })));
    const id = newId();
    await tx.organization.create({
      data: { id, type, name: name.slice(0, 160), slug: orgSlug, createdById: stampBy(actor), updatedById: stampBy(actor), createdAt: now, updatedAt: now },
    });
    await writeAudit(tx, actor, now, { action: 'organization.created', entityType: 'organization', entityId: id, entityLabel: name, after: { type, slug: orgSlug } });
    return id;
  }

  private async country(tx: Tx, code: string) {
    const c = await tx.country.findUnique({ where: { code } });
    if (!c) throw AppError.validation([{ field: 'countryCode', code: 'INVALID_CHOICE' }]);
    return c;
  }

  // ── Promoters ──────────────────────────────────────────────────────────────────────────────

  /** CTL-002 — born PROSPECT, with its organisation and its slug (brand name, else legal name; TRV-052). */
  async createPromoter(input: PromoterCreate, actor: Actor): Promise<Promoter> {
    const data = parseOrThrow(promoterCreateSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await this.country(tx, data.countryCode);
      const name = data.brandName || data.legalName;
      const slug = await uniqueSlug(slugify(name), 80, async (s) => Boolean(await tx.promoter.findFirst({ where: { slug: s, deletedAt: null } })));
      const organizationId = await this.createOrganization(tx, 'PROMOTER', name, slug, actor, now);
      const promoter = await tx.promoter.create({
        data: {
          id: newId(),
          organizationId,
          legalName: data.legalName,
          brandName: data.brandName || null,
          slug,
          countryCode: data.countryCode,
          status: 'PROSPECT',
          statusChangedAt: now,
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, {
        action: 'promoter.created',
        entityType: 'promoter',
        entityId: promoter.id,
        entityLabel: name,
        after: { legalName: promoter.legalName, brandName: promoter.brandName, slug, countryCode: promoter.countryCode, status: 'PROSPECT' },
      });
      return promoter;
    });
  }

  async updatePromoter(id: string, input: PromoterUpdate, actor: Actor): Promise<Promoter> {
    const data = parseOrThrow(promoterUpdateSchema, input);
    let renamed = false;
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const before = await tx.promoter.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw AppError.notFound();
      if (data.version !== undefined && data.version !== before.version) throw conflictVersion(before.version, before.updatedAt);
      // CTL-004, 01-domaine/02 § 3.1 — the public page is switched on only for an ACTIVE promoter.
      if (data.isPublic === true && !before.isPublic && before.status !== 'ACTIVE') {
        throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      }
      const { version: _v, vettedAt, conventionSignedAt, conventionExpiresAt, ...rest } = data;
      const patch = { ...rest, vettedAt: day(vettedAt), conventionSignedAt: day(conventionSignedAt), conventionExpiresAt: day(conventionExpiresAt) };
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const changes = diff(before as unknown as Record<string, unknown>, clean);
      if (!changes) return before;
      const updated = await tx.promoter.update({
        where: { id, version: before.version },
        data: { ...clean, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      await writeAudit(tx, actor, now, { action: 'promoter.updated', entityType: 'promoter', entityId: id, entityLabel: updated.brandName ?? updated.legalName, ...changes });
      // MOD-220 — a renamed promoter changes the searchText of its properties.
      renamed = 'legalName' in changes.after || 'brandName' in changes.after;
      if (renamed) {
        const ctx = await this.caches.context(tx);
        const props = await tx.property.findMany({ where: { promoterId: id, deletedAt: null }, select: { id: true } });
        for (const p of props) await this.caches.recalcProperty(tx, p.id, ctx);
      }
      return updated;
    });
    await this.notifier.committed(renamed ? ['catalogue', 'home'] : []);
    return result;
  }

  /** CYC-240 — PROSPECT → ACTIVE needs `vettedAt` and `conventionSignedAt`; SUSPENDED → ACTIVE republishes nothing. */
  async activatePromoter(id: string, input: { version?: number } = {}, actor: Actor): Promise<Promoter> {
    const data = parseOrThrow(statusReasonSchema, input);
    const result = await this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const p = await tx.promoter.findFirst({ where: { id, deletedAt: null } });
      if (!p) throw AppError.notFound();
      if (data.version !== undefined && data.version !== p.version) throw conflictVersion(p.version, p.updatedAt);
      if (p.status !== 'PROSPECT' && p.status !== 'SUSPENDED') throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      if (p.status === 'PROSPECT') {
        const missing = [...(p.vettedAt ? [] : ['VETTED_AT']), ...(p.conventionSignedAt ? [] : ['CONVENTION_SIGNED'])];
        if (missing.length) throw missingConditions('MISSING_CONDITIONS', missing);
      }
      const updated = await tx.promoter.update({
        where: { id, version: p.version },
        data: { status: 'ACTIVE', statusChangedAt: now, statusReason: data.reason ?? null, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      await writeAudit(tx, actor, now, {
        action: 'promoter.status_changed',
        entityType: 'promoter',
        entityId: id,
        entityLabel: p.brandName ?? p.legalName,
        before: { status: p.status },
        after: { status: 'ACTIVE' },
      });
      await emitCatalogueEvent(tx, now, actor, 'promoter.status_changed', { type: 'Promoter', id }, { from: p.status, to: 'ACTIVE' });
      return updated;
    });
    await this.notifier.committed(['catalogue', 'home']);
    return result;
  }

  // ── Banks ──────────────────────────────────────────────────────────────────────────────────

  async createBank(input: BankCreate, actor: Actor): Promise<Bank> {
    const data = parseOrThrow(bankCreateSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      await this.country(tx, data.countryCode);
      const slug = await uniqueSlug(slugify(data.name), 80, async (s) => Boolean(await tx.bank.findFirst({ where: { slug: s, deletedAt: null } })));
      const organizationId = await this.createOrganization(tx, 'BANK', data.name, slug, actor, now);
      const last = await tx.bank.aggregate({ _max: { sortOrder: true } });
      const bank = await tx.bank.create({
        data: {
          id: newId(),
          organizationId,
          name: data.name,
          shortName: data.shortName || null,
          slug,
          countryCode: data.countryCode,
          offersIslamicFinance: data.offersIslamicFinance,
          descriptionPublic: data.descriptionPublic || null,
          status: 'PROSPECT',
          statusChangedAt: now,
          sortOrder: (last._max.sortOrder ?? 0) + 10,
          createdById: stampBy(actor),
          updatedById: stampBy(actor),
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, actor, now, {
        action: 'bank.created',
        entityType: 'bank',
        entityId: bank.id,
        entityLabel: bank.name,
        after: { name: bank.name, slug, countryCode: bank.countryCode, offersIslamicFinance: bank.offersIslamicFinance, status: 'PROSPECT' },
      });
      return bank;
    });
  }

  async updateBank(id: string, input: BankUpdate, actor: Actor): Promise<Bank> {
    const data = parseOrThrow(bankUpdateSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const before = await tx.bank.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw AppError.notFound();
      if (data.version !== undefined && data.version !== before.version) throw conflictVersion(before.version, before.updatedAt);
      if (data.isPublic === true && !before.isPublic && before.status !== 'ACTIVE') {
        throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      }
      const { version: _v, conventionSignedAt, conventionExpiresAt, ...rest } = data;
      const clean = Object.fromEntries(
        Object.entries({ ...rest, conventionSignedAt: day(conventionSignedAt), conventionExpiresAt: day(conventionExpiresAt) }).filter(([, v]) => v !== undefined),
      );
      const changes = diff(before as unknown as Record<string, unknown>, clean);
      if (!changes) return before;
      const updated = await tx.bank.update({
        where: { id, version: before.version },
        data: { ...clean, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      await writeAudit(tx, actor, now, { action: 'bank.updated', entityType: 'bank', entityId: id, entityLabel: updated.name, ...changes });
      return updated;
    });
  }

  /** CYC-240 — bank PROSPECT → ACTIVE needs `conventionSignedAt`. */
  async activateBank(id: string, actor: Actor): Promise<Bank> {
    return this.prisma.$transaction(async (tx) => {
      const now = this.clock.now();
      const b = await tx.bank.findFirst({ where: { id, deletedAt: null } });
      if (!b) throw AppError.notFound();
      if (b.status !== 'PROSPECT' && b.status !== 'SUSPENDED') throw new AppError(ErrorCode.CONFLICT_STATE, { reason: 'TRANSITION_NOT_ALLOWED' });
      if (b.status === 'PROSPECT' && !b.conventionSignedAt) throw missingConditions('MISSING_CONDITIONS', ['CONVENTION_SIGNED']);
      const updated = await tx.bank.update({
        where: { id, version: b.version },
        data: { status: 'ACTIVE', statusChangedAt: now, version: { increment: 1 }, updatedById: stampBy(actor), updatedAt: now },
      });
      await writeAudit(tx, actor, now, { action: 'bank.status_changed', entityType: 'bank', entityId: id, entityLabel: b.name, before: { status: b.status }, after: { status: 'ACTIVE' } });
      return updated;
    });
  }
}
