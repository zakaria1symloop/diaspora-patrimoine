// NOT-016, NOT-030 § 3.2, NOT-031, NOT-035 — the writer of the notifications of the team (`NS_*`).
//
// « One operation, one notification »: the key of a notification (`Notification.dedupeKey`, unique per account) is
// `{type}:{common object}:{origin}`, where the origin is the request the operation comes from — or the pass of the
// scheduled task, or the event when the writer knows nothing better. Writing it twice creates nothing twice.
// Priority (NOT-035): for the same origin, the same recipient and the same object, a type of the catalogue wins over
// the alert of a rule (`NS_RULE_ALERT`), which wins over `NS_TASK_AUTO`: the two last ask before writing.
// Grouping (NOT-016): `NS_DOC_RECEIVED` and `NS_MESSAGE_NEW` look for the UNREAD notification of the recipient for
// the object; found, its counter grows and it comes back to the top (`updatedAt`); its title never changes (NOT-031).
import { Injectable } from '@nestjs/common';
import { newId } from '../platform/ids.js';
import type { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';

type Db = Tx | PrismaService;

/** NOT-016 — the staff types that group, and they only. */
export const GROUPED_STAFF_TYPES: ReadonlySet<string> = new Set(['NS_DOC_RECEIVED', 'NS_MESSAGE_NEW']);

const RULE_ALERT = 'NS_RULE_ALERT';
const TASK_AUTO = 'NS_TASK_AUTO';

/** NOT-035 — rank of a type in the priority table (higher wins). */
export function staffTypeRank(type: string): number {
  return type === TASK_AUTO ? 0 : type === RULE_ALERT ? 1 : 2;
}

export interface StaffNotificationInput {
  /** NOT-030 code (`NS_LEAD_NEW`, `NS_RULE_ALERT`, `NS_TASK_AUTO`…). */
  type: string;
  userIds: readonly string[];
  /** Rendered in the recipient's language at creation, never changed afterwards (NOT-031). */
  title: string;
  /** NOT-016 — plural form of a grouped type, `{n}` left in place. */
  titlePlural?: string | null;
  body?: string | null;
  /** Path in the back office; leads to the object the notification names. */
  link: string | null;
  /** NOT-032 — the object the link opens (Prisma model name and id). */
  entityType?: string | null;
  entityId?: string | null;
  /** NOT-035 — request id, job pass id or event id of the operation. */
  originId: string;
  /**
   * What stands for « the common object » in the key, when it is not `entityId`: two rules that alert the same person
   * about the same object for the same event are two alerts (the rule and its action are the key part).
   */
  keyPart?: string | null;
  /**
   * For `NS_RULE_ALERT` and `NS_TASK_AUTO`: the object of the event they come from. A notification of a higher rank
   * written for the same origin AND this object replaces them (NOT-035); another object of the same pass does not.
   */
  factId?: string | null;
  /** NOT-018 — the author of an action is never notified of his own action. */
  exceptUserId?: string | null;
}

export interface StaffNotificationResult {
  /** Accounts for which a notification was created (or, for a grouped type, incremented). */
  notified: string[];
  /** Accounts skipped because a notification of a higher rank already tells them the same fact. */
  replaced: string[];
}

export function staffDedupeKey(type: string, entityId: string | null | undefined, originId: string): string {
  return `${type}:${entityId ?? '-'}:${originId}`.slice(0, 200);
}

@Injectable()
export class StaffNotifier {
  /**
   * Writes one notification per account. Returns who was really notified: a caller that also sends an e-mail sends it
   * to those only.
   */
  async notify(db: Db, at: Date, input: StaffNotificationInput): Promise<StaffNotificationResult> {
    const userIds = [...new Set(input.userIds)].filter((id) => id !== input.exceptUserId);
    const result: StaffNotificationResult = { notified: [], replaced: [] };
    if (userIds.length === 0) return result;
    const key = staffDedupeKey(input.type, input.keyPart ?? input.entityId, input.originId);
    const rank = staffTypeRank(input.type);
    const data = {
      type: input.type,
      title: input.title.slice(0, 160),
      titlePlural: input.titlePlural ? input.titlePlural.slice(0, 160) : null,
      body: input.body ? input.body.slice(0, 400) : null,
      link: input.link ? input.link.slice(0, 400) : null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    };

    // NOT-035 — who already knows, by a type of a higher rank, for this origin and this object.
    const outranked = new Set<string>();
    if (rank < 2) {
      const fact = input.factId ?? input.entityId ?? null;
      const others = await db.notification.findMany({
        where: { userId: { in: userIds }, dedupeKey: { endsWith: `:${input.originId}` }, type: { startsWith: 'NS_' } },
        select: { userId: true, type: true, entityId: true, dedupeKey: true },
      });
      for (const o of others) {
        if (staffTypeRank(o.type) > rank && (fact === null || o.entityId === fact || (o.dedupeKey ?? '').includes(fact))) outranked.add(o.userId);
      }
    }

    for (const userId of userIds) {
      if (outranked.has(userId)) {
        result.replaced.push(userId);
        continue;
      }
      if (GROUPED_STAFF_TYPES.has(input.type) && input.entityId) {
        const unread = await db.notification.findFirst({
          where: { userId, type: input.type, entityId: input.entityId, readAt: null },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, dedupeKey: true },
        });
        if (unread) {
          // The key moves to the latest origin: the same operation replayed (FIA-041) does not count twice.
          if (unread.dedupeKey !== key) {
            await db.notification.update({ where: { id: unread.id }, data: { count: { increment: 1 }, dedupeKey: key, updatedAt: at } });
            result.notified.push(userId);
          }
          continue;
        }
      }
      const created = await db.notification.createMany({
        data: [{ id: newId(), userId, dedupeKey: key, ...data, createdAt: at, updatedAt: at }],
        skipDuplicates: true,
      });
      if (created.count) result.notified.push(userId);
    }
    return result;
  }
}
