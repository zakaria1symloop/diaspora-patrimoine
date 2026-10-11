// BO-040 — saved views of a list (`SavedView`, `SavedViewDefault`): a view keeps filters, sort, columns and page size
// under a name; it is PERSONAL, and an administrator may share it with the team (`view.share`). Each user chooses HIS
// default view of each list, among his views, the shared ones and the origin views of the list (`origin:{key}`).
// Changing or deleting a shared view asks for its owner or an administrator. Never the search text (TRV-105).
import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  savedViewConfigSchema,
  savedViewCreateSchema,
  savedViewDefaultSchema,
  savedViewShareSchema,
  savedViewUpdateSchema,
  type SavedViewItem,
  type SavedViewsResponse,
} from '@dp/contracts';
import { writeAudit } from '../admin/audit.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { isUniqueViolation } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { staffName, StaffViews, type StaffView } from './staff-view.js';

const LIST_KEY = /^[a-z][a-z0-9-]{1,39}$/;
const MAX_VIEWS_PER_LIST = 30;

type Row = { id: string; listKey: string; name: string; ownerId: string; isShared: boolean; config: unknown; owner: { firstName: string | null; lastName: string | null; status: string } };

@Injectable()
export class SavedViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly views: StaffViews,
  ) {}

  private item(row: Row, staff: StaffView): SavedViewItem {
    const mine = row.ownerId === staff.userId;
    const config = savedViewConfigSchema.safeParse(row.config);
    return {
      id: row.id,
      listKey: row.listKey,
      name: row.name,
      shared: row.isShared,
      mine,
      editable: mine || (row.isShared && staff.has('view.share')),
      ownerName: mine ? null : staffName(row.owner),
      config: config.success ? config.data : savedViewConfigSchema.parse({}),
    };
  }

  private readonly include = { owner: { select: { firstName: true, lastName: true, status: true } } } as const;

  /** `GET /admin/saved-views?listKey=` — the caller's views and the shared ones, with his default. */
  async list(auth: AuthContext, listKey: unknown): Promise<SavedViewsResponse> {
    if (typeof listKey !== 'string' || !LIST_KEY.test(listKey)) throw new AppError(ErrorCode.BAD_REQUEST);
    const staff = await this.views.of(auth);
    const [rows, def] = await Promise.all([
      this.prisma.savedView.findMany({ where: { listKey, OR: [{ ownerId: auth.userId }, { isShared: true }] }, include: this.include, orderBy: [{ isShared: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.savedViewDefault.findUnique({ where: { userId_listKey: { userId: auth.userId, listKey } }, select: { viewKey: true } }),
    ]);
    return { data: rows.map((r) => this.item(r, staff)), defaultViewKey: def?.viewKey ?? null };
  }

  /** `POST /admin/saved-views` — « Enregistrer cette vue ». */
  async create(auth: AuthContext, body: unknown): Promise<SavedViewItem> {
    const staff = await this.views.of(auth);
    const input = parseOrThrow(savedViewCreateSchema, body);
    const now = this.clock.now();
    if ((await this.prisma.savedView.count({ where: { ownerId: auth.userId, listKey: input.listKey } })) >= MAX_VIEWS_PER_LIST) {
      throw AppError.conflictState('MAX_REACHED', { n: MAX_VIEWS_PER_LIST });
    }
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.savedView.create({ data: { id: newId(), listKey: input.listKey, name: input.name, ownerId: auth.userId, config: input.config as never, createdAt: now, updatedAt: now }, include: this.include });
        await writeAudit(tx, auth.actor, now, { action: 'saved_view.created', entityType: 'SavedView', entityId: created.id, entityLabel: `${input.listKey} · ${input.name}` });
        return created;
      });
      return this.item(row, staff);
    } catch (err) {
      // BO-040 — a name is unique per owner and list
      if (isUniqueViolation(err)) throw AppError.validation([{ field: 'name', code: 'ALREADY_USED' }]);
      throw err;
    }
  }

  private async editable(auth: AuthContext, id: string): Promise<{ staff: StaffView; row: Row }> {
    const staff = await this.views.of(auth);
    const row = await this.prisma.savedView.findUnique({ where: { id }, include: this.include });
    // a personal view of someone else does not exist for the caller
    if (!row || (row.ownerId !== auth.userId && !row.isShared)) throw AppError.notFound();
    if (row.ownerId !== auth.userId && !staff.has('view.share')) throw new AppError(ErrorCode.FORBIDDEN);
    return { staff, row };
  }

  /** `PATCH /admin/saved-views/{id}` — rename, or keep the current filters, sort, columns and page size. */
  async update(auth: AuthContext, id: string, body: unknown): Promise<SavedViewItem> {
    const input = parseOrThrow(savedViewUpdateSchema, body);
    const { staff, row } = await this.editable(auth, id);
    const now = this.clock.now();
    try {
      const next = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.savedView.update({ where: { id }, data: { ...(input.name ? { name: input.name } : {}), ...(input.config ? { config: input.config as never } : {}), updatedAt: now }, include: this.include });
        await writeAudit(tx, auth.actor, now, { action: 'saved_view.updated', entityType: 'SavedView', entityId: id, entityLabel: `${row.listKey} · ${updated.name}`, after: { renamed: Boolean(input.name && input.name !== row.name), config: Boolean(input.config) } });
        return updated;
      });
      return this.item(next, staff);
    } catch (err) {
      if (isUniqueViolation(err)) throw AppError.validation([{ field: 'name', code: 'ALREADY_USED' }]);
      throw err;
    }
  }

  /** `POST /admin/saved-views/{id}/share` (`view.share`) — share with the team, or stop sharing. */
  async share(auth: AuthContext, id: string, body: unknown): Promise<SavedViewItem> {
    const { shared } = parseOrThrow(savedViewShareSchema, body);
    const { staff, row } = await this.editable(auth, id);
    const now = this.clock.now();
    const next = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.savedView.update({ where: { id }, data: { isShared: shared, updatedAt: now }, include: this.include });
      // a view no longer shared stops being the default of the others
      if (!shared) await tx.savedViewDefault.deleteMany({ where: { listKey: row.listKey, viewKey: id, userId: { not: row.ownerId } } });
      await writeAudit(tx, auth.actor, now, { action: 'saved_view.updated', entityType: 'SavedView', entityId: id, entityLabel: `${row.listKey} · ${row.name}`, before: { isShared: row.isShared }, after: { isShared: shared } });
      return updated;
    });
    return this.item(next, staff);
  }

  /** `DELETE /admin/saved-views/{id}` — its owner, or an administrator for a shared one. */
  async remove(auth: AuthContext, id: string): Promise<void> {
    const { row } = await this.editable(auth, id);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.savedViewDefault.deleteMany({ where: { listKey: row.listKey, viewKey: id } });
      await tx.savedView.delete({ where: { id } });
      await writeAudit(tx, auth.actor, now, { action: 'saved_view.deleted', entityType: 'SavedView', entityId: id, entityLabel: `${row.listKey} · ${row.name}` });
    });
  }

  /** `PUT /admin/saved-views/default` — the caller's default view of a list; `null`: the list's own default. */
  async setDefault(auth: AuthContext, body: unknown): Promise<{ defaultViewKey: string | null }> {
    const input = parseOrThrow(savedViewDefaultSchema, body);
    const now = this.clock.now();
    if (input.viewKey === null) {
      await this.prisma.savedViewDefault.deleteMany({ where: { userId: auth.userId, listKey: input.listKey } });
      return { defaultViewKey: null };
    }
    if (!/^origin:[a-z][a-z0-9-]{1,40}$/.test(input.viewKey)) {
      const view = await this.prisma.savedView.findFirst({ where: { id: input.viewKey, listKey: input.listKey, OR: [{ ownerId: auth.userId }, { isShared: true }] }, select: { id: true } }).catch(() => null);
      if (!view) throw AppError.validation([{ field: 'viewKey', code: 'INVALID_CHOICE' }]);
    }
    await this.prisma.savedViewDefault.upsert({
      where: { userId_listKey: { userId: auth.userId, listKey: input.listKey } },
      create: { userId: auth.userId, listKey: input.listKey, viewKey: input.viewKey, createdAt: now, updatedAt: now },
      update: { viewKey: input.viewKey, updatedAt: now },
    });
    return { defaultViewKey: input.viewKey };
  }
}
