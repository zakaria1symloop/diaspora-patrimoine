// CRM-081, MOD-301 — detection of a POSSIBLE duplicate, computed at reading time (never stored): two records carry
// the same phone, or the same last name, first name and country of residence. Names are compared after the
// normalisation of TRV-042 (trimmed, inner spaces collapsed), case and accents ignored. Among records that are neither
// deleted, nor absorbed by a merge, nor archived, and outside `notDuplicateOfIds` (« Ce n'est pas un doublon », kept by
// both records). A signal NEVER merges anything by itself.
import { clientName, clientScope, type StaffView } from '../back-office/staff-view.js';
import type { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';

type Db = Tx | PrismaService;

export interface DuplicateSubject {
  id: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  countryOfResidence: string | null;
  notDuplicateOfIds: string[];
}

export interface PossibleDuplicate {
  id: string;
  firstName: string | null;
  lastName: string | null;
  /** Why the two records look alike. */
  reason: 'PHONE' | 'NAME';
}

const collapse = (s: string | null) => (s ? s.trim().replace(/\s+/g, ' ') : null);

/** The records that look like this one (five at most, the oldest first). */
export async function findPossibleDuplicates(db: Db, subject: DuplicateSubject): Promise<PossibleDuplicate[]> {
  const first = collapse(subject.firstName);
  const last = collapse(subject.lastName);
  const byName = Boolean(first && last && subject.countryOfResidence);
  if (!subject.phone && !byName) return [];
  const excluded = [subject.id, ...subject.notDuplicateOfIds];
  const rows = await db.$queryRaw<{ id: string; first_name: string | null; last_name: string | null; by_phone: boolean }[]>`
    SELECT c.id, c.first_name, c.last_name, (${subject.phone}::text IS NOT NULL AND c.phone = ${subject.phone}) AS by_phone
    FROM clients c
    WHERE c.deleted_at IS NULL AND c.merged_into_id IS NULL AND c.archived_at IS NULL AND c.gdpr_erased_at IS NULL
      AND c.id <> ALL(${excluded}::uuid[])
      AND NOT (${subject.id}::uuid = ANY(c.not_duplicate_of_ids))
      AND (
        (${subject.phone}::text IS NOT NULL AND c.phone = ${subject.phone})
        OR (
          ${byName}::boolean
          AND c.country_of_residence = ${subject.countryOfResidence}
          AND lower(public.f_unaccent(regexp_replace(btrim(c.first_name), '\s+', ' ', 'g'))) = lower(public.f_unaccent(${first ?? ''}))
          AND lower(public.f_unaccent(regexp_replace(btrim(c.last_name), '\s+', ' ', 'g'))) = lower(public.f_unaccent(${last ?? ''}))
        )
      )
    ORDER BY c.created_at ASC
    LIMIT 5`;
  return rows.map((r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, reason: r.by_phone ? 'PHONE' : 'NAME' }));
}

/** What a reader may be told about a twin: its name when it lies in his perimeter (ROL-018), nothing else otherwise. */
export interface DuplicateForReader {
  id: string;
  /** « NOM Prénom »; null when the record is outside the reader's perimeter or the reader reads masked data. */
  name: string | null;
  reason: 'PHONE' | 'NAME';
}

export async function duplicatesForReader(db: Db, staff: StaffView, subject: DuplicateSubject): Promise<DuplicateForReader[]> {
  const twins = await findPossibleDuplicates(db, subject);
  if (!twins.length) return [];
  const visible = staff.masked ? new Set<string>() : new Set((await db.client.findMany({ where: { AND: [{ id: { in: twins.map((t) => t.id) } }, clientScope(staff)] }, select: { id: true } })).map((c) => c.id));
  return twins.map((t) => ({ id: t.id, name: visible.has(t.id) ? clientName(t) : null, reason: t.reason }));
}
