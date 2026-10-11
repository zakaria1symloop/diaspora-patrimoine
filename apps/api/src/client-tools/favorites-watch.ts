// AUT-062, SFA-023 — a client is told when a property of his favourites:
//   · drops in price by at least `favorites.priceDropPct` IN ITS OWN CURRENCY (`property.price_changed`: a rate move is
//     not a price drop);
//   · has only two available lots left, or one (`property.availability_changed`, `lotsAvailable`);
//   · is no longer available (RESERVED, SOLD, WITHDRAWN, or archived).
// The in-app notification (NC_FAVORITE_UPDATE) is written at once (outbox handler; archiving is found by the
// `favorites.watch` pass every 15 minutes, `Property.archivedAt`); ONE e-mail C_FAVORITE_UPDATE per client and per day at
// 8:00 (business calendar time zone), grouping the changes since the previous daily pass — the notifications are the
// record of those changes. The daily pass also removes favourites archived for more than 30 days (SFA-022).
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { FAVORITE_GONE_DAYS } from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import { ENV, type Env } from '../config/env.js';
import { Scheduler } from '../automation/scheduler.js';
import { MailerService } from '../communication/mailer.service.js';
import { Clock } from '../platform/clock.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import { notifyClient } from './client-notify.js';

const t = createTranslator('fr');
const DAY = 86_400_000;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type FavoriteChange = 'PRICE_DROP' | 'LAST_LOTS' | 'UNAVAILABLE';

/** AUT-062 — which change an event means for the favourites (null: nothing to tell). */
export function favoriteChangeOf(type: string, payload: Record<string, unknown>, priceDropPct: number): { kind: FavoriteChange; lots?: number } | null {
  if (type === 'property.price_changed') {
    const from = Number(payload.from);
    const to = Number(payload.to);
    if (!(from > 0) || !(to >= 0)) return null;
    return ((from - to) / from) * 100 >= priceDropPct ? { kind: 'PRICE_DROP' } : null;
  }
  if (type === 'property.availability_changed') {
    const to = String(payload.to ?? '');
    if (['RESERVED', 'SOLD', 'WITHDRAWN'].includes(to) && payload.from !== to) return { kind: 'UNAVAILABLE' };
    const lots = Number(payload.lotsAvailable);
    const before = Number(payload.lotsAvailableBefore);
    if ((lots === 1 || lots === 2) && before > lots && to === 'AVAILABLE') return { kind: 'LAST_LOTS', lots };
  }
  return null;
}

/** EC-41 — the kind of change a NC_FAVORITE_UPDATE notification recorded, from its key (null: a key of before). */
export function favoriteChangeKindOf(dedupeKey: string | null): FavoriteChange | null {
  const m = /^NC_FAVORITE_UPDATE:(PRICE_DROP|LAST_LOTS|UNAVAILABLE):/.exec(dedupeKey ?? '');
  if (m) return m[1] as FavoriteChange;
  if (dedupeKey?.startsWith('NC_FAVORITE_UPDATE:property.price_changed:')) return 'PRICE_DROP';
  if (dedupeKey?.startsWith('NC_FAVORITE_UPDATE:archived:')) return 'UNAVAILABLE';
  return null;
}

@Injectable()
export class FavoritesWatch implements OutboxHandler, OnModuleInit {
  readonly name = 'favorites.watch';
  readonly types = ['property.price_changed', 'property.availability_changed'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly mailer: MailerService,
    private readonly handlers: OutboxHandlers,
    private readonly scheduler: Scheduler,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
    // AUT-081 — declared to the scheduler of the platform; each pass works « since the previous one » (`lastRunAt`).
    this.scheduler.register({ name: 'favorites.watch', schedule: { everyMinutes: 15 }, run: (ctx) => this.watch(ctx.lastRunAt) });
    this.scheduler.register({ name: 'favorites.daily', schedule: { dailyAt: '08:00' }, run: (ctx) => this.daily(ctx.lastRunAt) });
  }

  async handle(event: OutboxRecord): Promise<void> {
    if (!(await this.settings.get('features.favorites'))) return;
    const change = favoriteChangeOf(event.type, event.payload, Number(await this.settings.get('favorites.priceDropPct')));
    if (!change) return;
    await this.notifyAll(event.aggregateId, change, `${event.type}:${event.id}`);
  }

  /** NC_FAVORITE_UPDATE for every client who keeps this property (one per client and per fact). */
  async notifyAll(propertyId: string, change: { kind: FavoriteChange; lots?: number }, factKey: string): Promise<number> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, select: { title: true, slug: true } });
    if (!property) return 0;
    const favs = await this.prisma.favorite.findMany({ where: { propertyId }, select: { clientId: true } });
    const title =
      change.kind === 'PRICE_DROP'
        ? t('ui.clientTools.favorites.notify.priceDrop', { titre: property.title })
        : change.kind === 'LAST_LOTS'
          ? t('ui.clientTools.favorites.notify.lastLots', { titre: property.title, n: change.lots ?? 1 })
          : t('ui.clientTools.favorites.notify.unavailable', { titre: property.title });
    const now = this.clock.now();
    let n = 0;
    for (const f of favs) {
      const id = await notifyClient(this.prisma, now, {
        clientId: f.clientId,
        type: 'NC_FAVORITE_UPDATE',
        title,
        link: `/biens/${property.slug}`,
        // NOT-032 — a property page has no object of the client's space: only its click marks it read.
        entityType: 'Property',
        entityId: propertyId,
        // The kind is kept in the key: « Mes favoris » reads it back (EC-41, `favoriteChangeKindOf`).
        dedupeKey: `NC_FAVORITE_UPDATE:${change.kind}:${factKey}`,
      });
      if (id) n++;
    }
    return n;
  }

  // ---------- scheduled passes ----------

  /** `favorites.watch` — favourites whose property was archived since the previous pass. */
  async watch(since: Date | null): Promise<Record<string, number>> {
    const counters = { archived: 0, notified: 0 };
    if (!(await this.settings.get('features.favorites'))) return counters;
    const from = since ?? new Date(this.clock.now().getTime() - DAY);
    const props = await this.prisma.property.findMany({ where: { archivedAt: { gt: from }, favorites: { some: {} } }, select: { id: true } });
    for (const p of props) {
      counters.archived++;
      counters.notified += await this.notifyAll(p.id, { kind: 'UNAVAILABLE' }, `archived:${p.id}`);
    }
    return counters;
  }

  /** `favorites.daily` — one C_FAVORITE_UPDATE per client for the changes since the previous pass; SFA-022 cleanup. */
  async daily(since: Date | null): Promise<Record<string, number>> {
    const counters = { clients: 0, sent: 0, removed: 0 };
    const now = this.clock.now();
    counters.removed = (
      await this.prisma.favorite.deleteMany({ where: { property: { archivedAt: { lt: new Date(now.getTime() - FAVORITE_GONE_DAYS * DAY) } } } })
    ).count;
    if (!(await this.settings.get('features.favorites'))) return counters;
    const from = since ?? new Date(now.getTime() - DAY);
    const rows = await this.prisma.notification.findMany({
      where: { type: 'NC_FAVORITE_UPDATE', createdAt: { gt: from, lte: now } },
      orderBy: { createdAt: 'asc' },
      select: { userId: true, title: true, entityId: true, link: true },
    });
    const byUser = new Map<string, typeof rows>();
    for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
    const companyName = await this.settings.get('contact.companyName');
    for (const [userId, list] of byUser) {
      counters.clients++;
      const client = await this.prisma.client.findFirst({ where: { userId, deletedAt: null }, select: { id: true, email: true, firstName: true, doNotContact: true, restrictedAt: true, gdprErasedAt: true } });
      if (!client?.email || client.restrictedAt || client.gdprErasedAt || client.doNotContact) continue;
      const lines = [...new Map(list.map((l) => [l.title, l])).values()];
      const html = `<ul>${lines.map((l) => `<li><a href="${esc(`${this.env.WEB_URL}${l.link ?? '/espace-client/favoris'}`)}">${esc(l.title)}</a></li>`).join('')}</ul>`;
      const text = lines.map((l) => `- ${l.title} (${this.env.WEB_URL}${l.link ?? '/espace-client/favoris'})`).join('\n');
      try {
        const outcome = await this.mailer.sendTemplate({
          templateCode: 'C_FAVORITE_UPDATE',
          to: client.email,
          // NOT-011 — grouped e-mail: the key names the common object (the client and the day).
          dedupeKey: `C_FAVORITE_UPDATE:${client.id}:${now.toISOString().slice(0, 10)}`,
          triggeredBy: 'EVENT',
          links: { clientId: client.id },
          vars: {
            advisor: { firstName: t('ui.email.advisorFallback.firstName'), displayName: t('ui.email.advisorFallback.displayName', { company: companyName }) },
            company: { name: companyName, siteUrl: this.env.WEB_URL },
            favorites: { url: `${this.env.WEB_URL}/espace-client/favoris`, count: lines.length },
          },
          blocks: { changes: { html, text } },
          greetingName: client.firstName,
          render: { propertyIds: lines.map((l) => l.entityId) },
        });
        if (outcome === 'SENT' || outcome === 'ALREADY_DONE') counters.sent++;
      } catch (err) {
        log('warn', 'favorites.mail_failed', { message: err instanceof Error ? err.message.slice(0, 200) : 'error' });
      }
    }
    return counters;
  }
}
