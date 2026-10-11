// AUT-079, CTL-064 — « disponibilités à vérifier »: ONE definition, used by the header of the lots table (CTL-064), by
// the block « Ce que nous attendons de lui » of a promoter (ACP-015, CTL-005), by the scheduled watch that creates the
// task (`promoter.stock_check_due`) and by the closing of that task when nothing is left to verify.
//
// A published programme (or a published standalone property) is TO VERIFY when it has at least one AVAILABLE lot, its
// promoter is ACTIVE, and `stockConfirmedAt` — failing that, its first publication — is older than
// `catalogue.stockCheckDays` days. `0` switches the verification off.
import type { Prisma } from '../generated/prisma/client.js';
import type { Tx } from '../platform/tx.js';

type Db = Tx | { program: Tx['program']; property: Tx['property'] };

export type StockCheckState = 'DUE' | 'OK' | 'NOT_CONCERNED';

export interface StockCheckFacts {
  publication: string;
  /** AVAILABLE lots counted on published properties (`Program.lotsAvailable`, `Property.lotsAvailable`). */
  lotsAvailable: number;
  promoterStatus: string;
  stockConfirmedAt: Date | null;
  firstPublishedAt: Date | null;
}

/** The instant from which the next verification is counted: the last confirmation, else the first publication. */
export function stockCheckBase(f: Pick<StockCheckFacts, 'stockConfirmedAt' | 'firstPublishedAt'>): Date | null {
  return f.stockConfirmedAt ?? f.firstPublishedAt;
}

/** The day the verification becomes due, or null when the object is not concerned. */
export function stockCheckDueAt(f: StockCheckFacts, days: number): Date | null {
  if (days <= 0 || f.publication !== 'PUBLISHED' || f.lotsAvailable < 1 || f.promoterStatus !== 'ACTIVE') return null;
  const base = stockCheckBase(f);
  return base ? new Date(base.getTime() + days * 86_400_000) : null;
}

export function stockCheckState(f: StockCheckFacts, now: Date, days: number): StockCheckState {
  const dueAt = stockCheckDueAt(f, days);
  if (!dueAt) return 'NOT_CONCERNED';
  return dueAt.getTime() <= now.getTime() ? 'DUE' : 'OK';
}

export interface StockCheckItem {
  kind: 'PROGRAM' | 'PROPERTY';
  id: string;
  /** Name of the programme, or reference of the standalone property. */
  label: string;
  promoterId: string;
  /** Since when the verification is due. */
  dueAt: Date;
  stockConfirmedAt: Date | null;
  stockConfirmedBy: string | null;
}

/**
 * The programmes and the standalone properties whose availabilities are to verify — of one promoter, or of all.
 * Ordered by the oldest due date.
 */
export async function stockChecksDue(db: Db, now: Date, days: number, promoterId?: string): Promise<StockCheckItem[]> {
  if (days <= 0) return [];
  const limit = new Date(now.getTime() - days * 86_400_000);
  const old = { OR: [{ stockConfirmedAt: { lte: limit } }, { stockConfirmedAt: null, firstPublishedAt: { lte: limit } }] };
  const promoter: Prisma.PromoterWhereInput = { status: 'ACTIVE', deletedAt: null };
  const [programs, properties] = await Promise.all([
    db.program.findMany({
      where: { deletedAt: null, publication: 'PUBLISHED', lotsAvailable: { gt: 0 }, promoter, ...(promoterId ? { promoterId } : {}), ...old },
      select: { id: true, name: true, promoterId: true, stockConfirmedAt: true, stockConfirmedBy: true, firstPublishedAt: true },
    }),
    db.property.findMany({
      where: { deletedAt: null, programId: null, publication: 'PUBLISHED', lotsAvailable: { gt: 0 }, promoter, ...(promoterId ? { promoterId } : {}), ...old },
      select: { id: true, reference: true, promoterId: true, stockConfirmedAt: true, stockConfirmedBy: true, firstPublishedAt: true },
    }),
  ]);
  const due = (x: { stockConfirmedAt: Date | null; firstPublishedAt: Date | null }) => new Date((x.stockConfirmedAt ?? x.firstPublishedAt)!.getTime() + days * 86_400_000);
  const items: StockCheckItem[] = [
    ...programs.map((p) => ({ kind: 'PROGRAM' as const, id: p.id, label: p.name, promoterId: p.promoterId, dueAt: due(p), stockConfirmedAt: p.stockConfirmedAt, stockConfirmedBy: p.stockConfirmedBy })),
    ...properties.map((p) => ({ kind: 'PROPERTY' as const, id: p.id, label: p.reference, promoterId: p.promoterId, dueAt: due(p), stockConfirmedAt: p.stockConfirmedAt, stockConfirmedBy: p.stockConfirmedBy })),
  ];
  return items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
