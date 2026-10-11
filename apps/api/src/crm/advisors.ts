// CRM-011, CRM-020, CRM-021 — the advisers a request, a client or a dossier may be entrusted to: active OWNER, ADMIN
// and AGENT accounts of the operator (never VIEWER nor SUPPORT), with what the screens need to choose well — whether
// the person is absent now and until when, whether he receives requests by distribution.
import type { AdvisorOption } from '@dp/contracts';
import { staffName } from '../back-office/staff-view.js';
import type { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';

/** `absentUntil` is the LAST day of the absence (CRM-021): absent today when it is today or later, in the calendar's time zone. */
export function absentOn(absentUntil: Date | null, now: Date, timeZone: string): string | null {
  if (!absentUntil) return null;
  const last = absentUntil.toISOString().slice(0, 10);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
  return last >= today ? last : null;
}

export async function listAdvisorOptions(db: Tx | PrismaService, now: Date, timeZone: string): Promise<AdvisorOption[]> {
  const rows = await db.membership.findMany({
    where: { revokedAt: null, suspendedAt: null, role: { in: ['OWNER', 'ADMIN', 'AGENT'] }, organization: { type: 'OPERATOR' }, user: { kind: 'STAFF', status: 'ACTIVE' } },
    select: { role: true, receivesLeads: true, absentUntil: true, user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  });
  return rows
    .map((r) => ({ id: r.user.id, name: staffName(r.user) ?? '', role: r.role as AdvisorOption['role'], absentUntil: absentOn(r.absentUntil, now, timeZone), receivesLeads: r.receivesLeads }))
    .filter((a) => a.name);
}
