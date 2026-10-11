// BO-060, NOT-030 § 3.2, NOT-031 … NOT-033 — the bell of the team (EA-105): the caller's own notifications, the ten
// latest in the panel, all of them on the page (25 lines, « Non lues »), marked read on a click, by object (NOT-032) or
// all at once. Creation: `StaffNotifier` of the automation module — title rendered at creation, one fact one notification (NOT-035).
// The grouping by counter (NOT-016) and the preferences arrive with package 5.1: `count` and `titlePlural` are already
// read here, so a grouped notification shows its plural form as soon as a writer groups.
import { Injectable } from '@nestjs/common';
import { ErrorCode, staffNotificationReadSchema, type StaffNotificationItem, type StaffNotificationList, type StaffNotificationTarget } from '@dp/contracts';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';

const TARGETS: Record<string, StaffNotificationTarget> = {
  Lead: 'LEAD',
  Dossier: 'DOSSIER',
  BankSubmission: 'SUBMISSION',
  Task: 'TASK',
  Client: 'RECORD',
  User: 'RECORD',
  Conversation: 'THREAD',
  Promoter: 'PARTNER',
  Bank: 'PARTNER',
  Partner: 'PARTNER',
};

/** BO-060 — the icon follows the object the notification names; without one, a bell. */
export function staffTargetOf(entityType: string | null): StaffNotificationTarget {
  return (entityType && TARGETS[entityType]) || 'OTHER';
}

/** SEC-062 — only an internal path of the back office is ever handed to the screen. */
function safeLink(link: string | null): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//') || /[\\\u0000-\u001f]/.test(link)) return null;
  return link;
}

@Injectable()
export class StaffNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  private async since(): Promise<Date> {
    const days = await this.settings.get('retention.notificationDays');
    return new Date(this.clock.now().getTime() - Number(days) * 86_400_000);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null, updatedAt: { gte: await this.since() } } });
  }

  /** `GET /admin/notifications` — `page`, `pageSize` (10 for the panel, 25, 50), `unread=1`. Sorted on `updatedAt` (NOT-016). */
  async list(auth: AuthContext, query: Record<string, unknown>): Promise<StaffNotificationList> {
    const known = new Set(['page', 'pageSize', 'unread']);
    if (Object.keys(query).some((k) => !known.has(k))) throw new AppError(ErrorCode.BAD_REQUEST);
    const page = Math.max(1, Math.min(10_000, Number(query.page) || 1));
    const size = Number(query.pageSize) || 25;
    if (![10, 25, 50].includes(size)) throw new AppError(ErrorCode.BAD_REQUEST);
    const where = { userId: auth.userId, updatedAt: { gte: await this.since() }, ...(query.unread === '1' ? { readAt: null } : {}) };
    const [total, rows, unread] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * size, take: size }),
      this.unreadCount(auth.userId),
    ]);
    const data: StaffNotificationItem[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      titlePlural: n.titlePlural,
      body: n.body,
      link: safeLink(n.link),
      target: staffTargetOf(n.entityType),
      count: n.count,
      read: n.readAt !== null,
      updatedAt: n.updatedAt.toISOString(),
    }));
    return { data, meta: { page, pageSize: size, total, totalPages: Math.max(1, Math.ceil(total / size)) }, unread };
  }

  /** `POST /admin/notifications/read` — `{ids}` (a click), or `{entityType, entityId}` (the object opened, NOT-032). */
  async read(auth: AuthContext, body: unknown): Promise<{ unread: number }> {
    const input = parseOrThrow(staffNotificationReadSchema, body);
    const where = 'ids' in input ? { id: { in: input.ids } } : { entityType: input.entityType, entityId: input.entityId };
    // only the caller's own rows are ever touched
    await this.prisma.notification.updateMany({ where: { userId: auth.userId, readAt: null, ...where }, data: { readAt: this.clock.now() } });
    return { unread: await this.unreadCount(auth.userId) };
  }

  /** `POST /admin/notifications/read-all` — « Tout marquer comme lu ». */
  async readAll(auth: AuthContext): Promise<{ unread: number }> {
    await this.prisma.notification.updateMany({ where: { userId: auth.userId, readAt: null }, data: { readAt: this.clock.now() } });
    return { unread: 0 };
  }
}
