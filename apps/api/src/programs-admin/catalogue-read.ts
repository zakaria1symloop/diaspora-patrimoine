// Packages 3.4 to 3.6 — what the reads of the catalogue back office share: the cover of an owner (MOD-203), the line
// « Disponibilités vérifiées » (CTL-064), the dossiers and requests of a set of properties (CTL-021, CTL-045), and a
// transaction rolled back to compute derived facts (CAL-050) without writing anything on a read.
import type { AdminImageRef, CatalogueDossiers, StockCheckView } from '@dp/contracts';
import type { MediaOwnerType, Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import { clientName, maskName, staffName, type StaffView } from '../back-office/staff-view.js';
import { adminImageRef } from '../catalogue-admin/catalogue-reference.js';
import { stockCheckDueAt, stockCheckState, type StockCheckFacts } from '../catalogue-admin/stock-check.js';

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const isoDay = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
export const dec = (v: { toString(): string } | null | undefined): string | null => (v === null || v === undefined ? null : v.toString());
export const promoterName = (p: { brandName: string | null; legalName: string }) => p.brandName || p.legalName;

/** Counts of a `groupBy` as a record. */
export function countsOf<K extends string>(rows: { _count: { _all: number } }[], key: K): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows as unknown as (Record<K, string | null> & { _count: { _all: number } })[]) out[String(r[key])] = r._count._all;
  return out;
}

/** MOD-203 — the cover of each owner: the media marked `isCover`, else the first ready PHOTO, then RENDER_3D. */
export async function coversOf(db: PrismaService | Tx, mediaUrl: string, ownerType: MediaOwnerType, ids: string[], size: 'thumb' | 'card' = 'thumb'): Promise<Map<string, AdminImageRef>> {
  const out = new Map<string, AdminImageRef>();
  if (!ids.length) return out;
  const rows = await db.media.findMany({
    where: { ownerType, ownerId: { in: ids }, kind: { in: ['PHOTO', 'RENDER_3D'] }, processingStatus: 'READY', deletedAt: null },
    select: { id: true, ownerType: true, ownerId: true, kind: true, isCover: true, sortOrder: true, width: true, height: true, alt: true, renditions: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  const rank = (m: (typeof rows)[number]) => (m.isCover ? 0 : m.kind === 'PHOTO' ? 1 : 2);
  const best = new Map<string, (typeof rows)[number]>();
  for (const m of rows) {
    const cur = best.get(m.ownerId);
    if (!cur || rank(m) < rank(cur)) best.set(m.ownerId, m);
  }
  for (const [ownerId, m] of best) {
    const ref = adminImageRef(mediaUrl, m, size);
    if (ref) out.set(ownerId, ref);
  }
  return out;
}

/** CTL-064 — the line above the lots of a programme or of a standalone property. */
export async function stockView(
  db: PrismaService | Tx,
  facts: StockCheckFacts & { stockConfirmedBy: string | null; promoterId: string },
  now: Date,
  days: number,
): Promise<StockCheckView> {
  const contacts = await db.promoterContact.findMany({
    where: { promoterId: facts.promoterId },
    orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }],
    select: { id: true, fullName: true, role: true },
  });
  return {
    state: stockCheckState(facts, now, days),
    confirmedAt: iso(facts.stockConfirmedAt),
    confirmedBy: facts.stockConfirmedBy,
    dueAt: iso(stockCheckDueAt(facts, days)),
    days,
    contacts: contacts.map((c) => ({ id: c.id, name: c.fullName, role: c.role })),
  };
}

class Rollback<T> extends Error {
  constructor(readonly value: T) {
    super('rollback');
  }
}

/** Runs `fn` in a transaction that is always rolled back: derived facts computed by the write helpers, nothing kept. */
export async function inRolledBackTx<T>(prisma: PrismaService, fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    await prisma.$transaction(async (tx) => {
      throw new Rollback(await fn(tx));
    }, { timeout: 20_000 });
  } catch (err) {
    if (err instanceof Rollback) return err.value as T;
    throw err;
  }
  throw new Error('unreachable');
}

const OPEN_DOSSIER: Prisma.DossierWhereInput = { status: { in: ['OPEN', 'ON_HOLD'] }, deletedAt: null };

/** CYC-073, CYC-102 — open dossiers that consider these properties, and those that retained one of them. */
export async function dossierImpact(db: PrismaService | Tx, propertyIds: string[]): Promise<{ considering: number; selected: number; dossiers: number }> {
  if (!propertyIds.length) return { considering: 0, selected: 0, dossiers: 0 };
  const [considering, selected] = await Promise.all([
    db.dossier.count({ where: { ...OPEN_DOSSIER, OR: [{ propertyId: { in: propertyIds } }, { dossierCandidates: { some: { propertyId: { in: propertyIds }, status: { notIn: ['DECLINED', 'UNAVAILABLE'] } } } }] } }),
    db.dossier.count({ where: { ...OPEN_DOSSIER, propertyId: { in: propertyIds } } }),
  ]);
  return { considering, selected, dossiers: considering };
}

/** CTL-021 « Dossiers » · CTL-045 « Demandes et dossiers » — within the reader's perimeter, names masked for SUPPORT. */
export async function catalogueDossiers(db: PrismaService, staff: StaffView, propertyIds: string[], programId: string | null): Promise<CatalogueDossiers> {
  const scope: Prisma.DossierWhereInput = staff.scoped ? { assignedAgentId: staff.userId } : {};
  const name = (c: { firstName: string | null; lastName: string | null } | null) => (staff.masked ? maskName(c?.firstName, c?.lastName) : clientName(c));
  const ids = propertyIds.length ? propertyIds : ['00000000-0000-0000-0000-000000000000'];
  const [dossiers, leads, views, proposals, visits] = await Promise.all([
    db.dossier.findMany({
      where: {
        AND: [scope, { deletedAt: null }, { OR: [{ propertyId: { in: ids } }, { dossierCandidates: { some: { propertyId: { in: ids } } } }, ...(programId ? [{ programId }] : [])] }],
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }],
      take: 200,
      select: {
        id: true,
        reference: true,
        stage: true,
        status: true,
        propertyId: true,
        updatedAt: true,
        client: { select: { firstName: true, lastName: true } },
        assignedAgent: { select: { firstName: true, lastName: true, status: true } },
        property: { select: { reference: true, title: true } },
        lot: { select: { reference: true } },
        dossierCandidates: { where: { propertyId: { in: ids } }, select: { status: true, property: { select: { reference: true, title: true } }, lot: { select: { reference: true } } }, take: 1 },
      },
    }),
    db.lead.findMany({
      where: { AND: [staff.scoped ? { OR: [{ assignedAgentId: staff.userId }, { assignedAgentId: null }] } : {}, { OR: [{ propertyId: { in: ids } }, ...(programId ? [{ programId }] : [])] }, { status: { not: 'SPAM' } }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
      select: { id: true, reference: true, kind: true, status: true, createdAt: true, firstName: true, lastName: true, client: { select: { firstName: true, lastName: true } }, property: { select: { reference: true } } },
    }),
    db.property.aggregate({ where: { id: { in: ids } }, _sum: { viewCount: true, interestCount: true } }),
    db.dossierCandidate.count({ where: { propertyId: { in: ids }, origin: 'ADVISOR_PROPOSAL', sentAt: { not: null } } }),
    db.appointment.count({ where: { propertyId: { in: ids }, type: { in: ['PROPERTY_VISIT', 'VISIO'] }, status: 'DONE' } }),
  ]);
  return {
    dossiers: dossiers.map((d) => {
      const cand = d.dossierCandidates[0];
      const prop = d.property && ids.includes(d.propertyId ?? '') ? d.property : (cand?.property ?? d.property);
      return {
        id: d.id,
        reference: d.reference,
        clientName: name(d.client),
        propertyReference: prop?.reference ?? '',
        propertyTitle: prop?.title ?? '',
        lotReference: d.lot?.reference ?? cand?.lot?.reference ?? null,
        stage: d.stage,
        status: d.status,
        candidateStatus: cand?.status ?? null,
        selected: Boolean(d.propertyId && ids.includes(d.propertyId)),
        agentName: staffName(d.assignedAgent),
        updatedAt: d.updatedAt.toISOString(),
      };
    }),
    leads: leads.map((l) => ({
      id: l.id,
      reference: l.reference,
      kind: l.kind,
      status: l.status,
      clientName: name(l.client ?? { firstName: l.firstName, lastName: l.lastName }),
      propertyReference: l.property?.reference ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    counters: { views: views._sum.viewCount ?? 0, interests: views._sum.interestCount ?? 0, proposals, visits },
  };
}
