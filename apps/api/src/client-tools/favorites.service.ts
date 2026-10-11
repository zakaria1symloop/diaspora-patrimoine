// EC-41 (SFA-020 … SFA-024) — the favourites of an account: listed as cards (CAT-040), most recently added first, with
// the date added; a reserved or sold property stays (veiled, its banner on the card); an archived one stays 30 days with
// « Ce bien n'est plus proposé », then leaves (the daily job removes the row). One hundred at most. The heart adds or
// removes one (`PUT`, `DELETE /client/favorites/{bien}` — the property's id or its reference, both accepted).
import { Injectable } from '@nestjs/common';
import {
  FAVORITE_GONE_DAYS,
  FAVORITES_MAX_ACCOUNT,
  ErrorCode,
  type AccountFavorite,
  type AccountFavoritesResponse,
  type FavoriteChangeNote,
  type FavoriteInterest,
  type FavoriteToggleResponse,
} from '@dp/contracts';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { favoriteChangeKindOf } from './favorites-watch.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/;
const DAY = 86_400_000;

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly catalogue: CatalogueService,
    private readonly index: CatalogueIndex,
  ) {}

  private async featureOn(): Promise<void> {
    if (!(await this.settings.get('features.favorites'))) throw new AppError(ErrorCode.NOT_FOUND, { reason: 'FEATURE_DISABLED' });
  }

  private clientIdOf(ctx: AuthContext): string {
    if (!ctx.clientId) throw AppError.notFound();
    return ctx.clientId;
  }

  /** A property that has been published (never a draft nobody saw), by id or reference. */
  private async property(key: string) {
    const where = UUID.test(key) ? { id: key } : REF.test(key) ? { reference: key.toUpperCase() } : null;
    if (!where) throw AppError.notFound();
    const p = await this.prisma.property.findFirst({ where: { ...where, deletedAt: null, firstPublishedAt: { not: null } }, select: { id: true, reference: true, publication: true } });
    if (!p) throw AppError.notFound();
    return p;
  }

  async list(ctx: AuthContext): Promise<AccountFavoritesResponse> {
    await this.featureOn();
    const clientId = this.clientIdOf(ctx);
    const now = this.clock.now();
    const rows = await this.prisma.favorite.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { property: { select: { id: true, reference: true, title: true, archivedAt: true, deletedAt: true, publication: true } } },
    });
    const listable = await this.index.rows();
    const byId = new Map(listable.map((r) => [r.id, r]));
    const online = rows.filter((r) => byId.has(r.propertyId)).map((r) => byId.get(r.propertyId)!);
    const cards = new Map((await this.catalogue.toCards(online)).map((c) => [c.reference, c]));
    const [changes, interests] = await Promise.all([this.changes(ctx.userId, rows), this.interests(clientId, rows.map((r) => r.propertyId))]);
    const data: AccountFavorite[] = [];
    for (const r of rows) {
      const p = r.property;
      if (p.deletedAt) continue;
      const card = cards.get(p.reference);
      const addedAt = r.createdAt.toISOString();
      const base = { propertyId: p.id, reference: p.reference, addedAt, change: changes.get(p.id) ?? null, interest: interests.get(p.id) ?? null };
      if (card) {
        data.push({ ...base, state: 'ONLINE', card });
        continue;
      }
      // SFA-022 — archived: 30 days with « Ce bien n'est plus proposé », then out of the list.
      if (p.archivedAt && now.getTime() - p.archivedAt.getTime() > FAVORITE_GONE_DAYS * DAY) continue;
      data.push({ ...base, state: 'GONE', title: p.title, archivedAt: p.archivedAt?.toISOString() ?? null });
    }
    return {
      data,
      references: data.map((d) => d.reference),
      max: FAVORITES_MAX_ACCOUNT,
      referenceDownPaymentPct: (await this.settings.get('finance.reference.default')).downPaymentPct.toFixed(2),
    };
  }

  /**
   * AUT-062 — what changed on each favourite since it was added: the last NC_FAVORITE_UPDATE the client was sent for
   * that property (the notifications are the record of those changes). Scoped to the caller's own account.
   */
  private async changes(userId: string, rows: { propertyId: string; createdAt: Date }[]): Promise<Map<string, FavoriteChangeNote>> {
    const out = new Map<string, FavoriteChangeNote>();
    if (!rows.length) return out;
    const notes = await this.prisma.notification.findMany({
      where: { userId, type: 'NC_FAVORITE_UPDATE', entityType: 'Property', entityId: { in: rows.map((r) => r.propertyId) } },
      orderBy: { createdAt: 'desc' },
      select: { entityId: true, title: true, createdAt: true, dedupeKey: true },
    });
    const addedAt = new Map(rows.map((r) => [r.propertyId, r.createdAt.getTime()]));
    for (const n of notes) {
      if (!n.entityId || out.has(n.entityId)) continue;
      if (n.createdAt.getTime() < (addedAt.get(n.entityId) ?? 0)) continue; // a change of before the property was kept
      out.set(n.entityId, { kind: favoriteChangeKindOf(n.dedupeKey), title: n.title, at: n.createdAt.toISOString() });
    }
    return out;
  }

  /** SFA-022 — the favourites the client already expressed an interest for (a property envisaged in one of his dossiers). */
  private async interests(clientId: string, propertyIds: string[]): Promise<Map<string, FavoriteInterest>> {
    const out = new Map<string, FavoriteInterest>();
    if (!propertyIds.length) return out;
    const rows = await this.prisma.dossierCandidate.findMany({
      where: {
        propertyId: { in: propertyIds },
        dossier: { clientId, deletedAt: null },
        // INT-001 — an interest of the client, or a proposal he answered (not one that still waits for his answer).
        OR: [{ origin: 'CLIENT_INTEREST' }, { origin: 'ADVISOR_PROPOSAL', sentAt: { not: null }, status: { in: ['INTERESTED', 'VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED', 'SELECTED'] } }],
      },
      orderBy: { statusChangedAt: 'desc' },
      select: { propertyId: true, status: true, createdAt: true },
    });
    for (const r of rows) if (!out.has(r.propertyId)) out.set(r.propertyId, { status: r.status, since: r.createdAt.toISOString() });
    return out;
  }

  /** SFA-020 — idempotent: adding a favourite twice is one favourite. 409 FAVORITES_LIMIT at one hundred (SFA-023). */
  async add(ctx: AuthContext, key: string): Promise<FavoriteToggleResponse> {
    await this.featureOn();
    const clientId = this.clientIdOf(ctx);
    const p = await this.property(key);
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.favorite.findUnique({ where: { clientId_propertyId: { clientId, propertyId: p.id } }, select: { clientId: true } });
      if (!existing) {
        if (p.publication !== 'PUBLISHED') throw AppError.notFound();
        const count = await tx.favorite.count({ where: { clientId } });
        if (count >= FAVORITES_MAX_ACCOUNT) throw AppError.conflictState('FAVORITES_LIMIT', { n: FAVORITES_MAX_ACCOUNT });
        await tx.favorite.create({ data: { clientId, propertyId: p.id, createdAt: now, updatedAt: now } });
      }
      return { reference: p.reference, favorite: true, count: await tx.favorite.count({ where: { clientId } }) };
    });
  }

  async remove(ctx: AuthContext, key: string): Promise<FavoriteToggleResponse> {
    await this.featureOn();
    const clientId = this.clientIdOf(ctx);
    const p = await this.property(key);
    await this.prisma.favorite.deleteMany({ where: { clientId, propertyId: p.id } });
    return { reference: p.reference, favorite: false, count: await this.prisma.favorite.count({ where: { clientId } }) };
  }
}
