// NOT-016, NOT-030 … NOT-033, MSG-040 … MSG-046 — the client's notifications: read in « Dernières nouvelles »
// (ECL-010) until EC-31 (package 5.1), marked read on a click, by object (NOT-032) or all at once.
// Creation: `notifyClient()` of client-tools (shared with package 2.9) — title rendered at creation (NOT-031).
import { Injectable } from '@nestjs/common';
import { notificationReadRequestSchema, type ClientNotificationItem, type ClientNotificationList, type NotificationTarget } from '@dp/contracts';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';

/** MSG-040 — the icon follows the destination of the link (column « Lien » of NOT-030). */
export function targetOf(link: string | null): NotificationTarget {
  if (!link) return 'OTHER';
  if (/\/pieces(\/|$|\?)/.test(link)) return 'DOCUMENT';
  if (/\/financement(\/|$|\?)/.test(link)) return 'FINANCING';
  if (/^\/espace-client\/messages/.test(link)) return 'MESSAGE';
  if (/^\/espace-client\/rendez-vous/.test(link)) return 'APPOINTMENT';
  if (/^\/espace-client\/(interets|biens-proposes|favoris)|^\/biens\//.test(link)) return 'PROPERTY';
  if (/^\/espace-client\/cafes|^\/le-cafe/.test(link)) return 'CAFE';
  if (/^\/espace-client\/dossiers\//.test(link)) return 'DOSSIER';
  return 'OTHER';
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  private async since(): Promise<Date> {
    const days = await this.settings.get('retention.notificationDays');
    return new Date(this.clock.now().getTime() - Number(days) * 86_400_000);
  }

  private item(n: { id: string; type: string; title: string; titlePlural: string | null; body: string | null; link: string | null; count: number; readAt: Date | null; updatedAt: Date }): ClientNotificationItem {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      titlePlural: n.titlePlural,
      body: n.body,
      link: n.link,
      target: targetOf(n.link),
      count: n.count,
      read: n.readAt !== null,
      updatedAt: n.updatedAt.toISOString(),
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null, updatedAt: { gte: await this.since() } } });
  }

  /** ECL-010 block 7 — the latest ones, unread first. */
  async latest(userId: string, limit: number): Promise<ClientNotificationItem[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId, updatedAt: { gte: await this.since() } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    rows.sort((a, b) => Number(a.readAt !== null) - Number(b.readAt !== null) || b.updatedAt.getTime() - a.updatedAt.getTime());
    return rows.slice(0, limit).map((r) => this.item(r));
  }

  /** `GET /client/notifications` — `limit` (10 by default, 50 at most), `unread=1` filter (MSG-041). */
  async list(auth: AuthContext, query: { limit?: string; unread?: string }): Promise<ClientNotificationList> {
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const since = await this.since();
    const rows = await this.prisma.notification.findMany({
      where: { userId: auth.userId, updatedAt: { gte: since }, ...(query.unread === '1' ? { readAt: null } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return { data: rows.map((r) => this.item(r)), unread: await this.unreadCount(auth.userId) };
  }

  /** `POST /client/notifications/read` — `{ids}` (a click), or `{entityType, entityId}` (the object opened, NOT-032). */
  async read(auth: AuthContext, body: unknown): Promise<{ unread: number }> {
    const input = parseOrThrow(notificationReadRequestSchema, body);
    const now = this.clock.now();
    const where = 'ids' in input ? { id: { in: input.ids } } : { entityType: input.entityType, entityId: input.entityId };
    // ROL-030 — only the caller's own rows are touched.
    await this.prisma.notification.updateMany({ where: { userId: auth.userId, readAt: null, ...where }, data: { readAt: now } });
    return { unread: await this.unreadCount(auth.userId) };
  }

  /** `POST /client/notifications/read-all` — « Tout marquer comme lu ». */
  async readAll(auth: AuthContext): Promise<{ unread: number }> {
    await this.prisma.notification.updateMany({ where: { userId: auth.userId, readAt: null }, data: { readAt: this.clock.now() } });
    return { unread: 0 };
  }
}
