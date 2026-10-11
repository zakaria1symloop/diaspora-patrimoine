// NOT-030, NOT-031 — an in-app notification for a client (the bell, « Dernières nouvelles »): written for the client's
// account, its title rendered at creation in the recipient's language and never changed afterwards. A notification
// carries a key (`dedupeKey`) when the same fact must not notify twice (one event = one notification, NOT-035).
// A client without an account (no `userId`) has no notification: the e-mail is his only channel.
import { newId } from '../platform/ids.js';
import type { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';

export interface ClientNotification {
  clientId: string;
  /** NOT-030 code (`NC_FILE_REFUSED`, `NC_ALERT_MATCHES`, `NC_FAVORITE_UPDATE`…). */
  type: string;
  title: string;
  body?: string | null;
  link: string | null;
  /** NOT-032 — the object the link opens (the dossier for a dossier event); none for a page without object. */
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
}

/** Writes the notification (once per key); returns its id, or null when the client has no account. */
export async function notifyClient(db: Tx | PrismaService, at: Date, n: ClientNotification): Promise<string | null> {
  const client = await db.client.findUnique({ where: { id: n.clientId }, select: { userId: true, deletedAt: true, gdprErasedAt: true } });
  if (!client?.userId || client.deletedAt || client.gdprErasedAt) return null;
  const data = {
    type: n.type,
    title: n.title.slice(0, 160),
    body: n.body ? n.body.slice(0, 400) : null,
    link: n.link,
    entityType: n.entityType ?? null,
    entityId: n.entityId ?? null,
  };
  if (n.dedupeKey) {
    const row = await db.notification.upsert({
      where: { userId_dedupeKey: { userId: client.userId, dedupeKey: n.dedupeKey } },
      create: { id: newId(), userId: client.userId, dedupeKey: n.dedupeKey, ...data, createdAt: at, updatedAt: at },
      update: {},
      select: { id: true },
    });
    return row.id;
  }
  const id = newId();
  await db.notification.create({ data: { id, userId: client.userId, ...data, createdAt: at, updatedAt: at } });
  return id;
}
