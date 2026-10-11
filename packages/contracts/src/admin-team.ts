// Package 1.9 « Équipe » (EA-96, 04-back-office/13 § 3: ADM-030, ADM-032, ADM-040; ROL-010 … ROL-013) — wire contracts
// of `/admin/users`. Delivered now: list, invitation (send, resend, cancel), role, function, suspension, reset of the
// second factor. With later packages: « Reçoit des demandes », absence (3.2); deletion with reassignment, change of
// address (5.x).
import { z } from 'zod';
import { absentUntilSchema } from './admin-shell.js';
import { StaffRole } from './permissions.js';
import { emailSchema, personNameSchema } from './schemas/leads.js';

export const TEAM_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED'] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

/** ADM-030 — sortable: Nom (default), Rôle, État, Dernière connexion. */
export const TEAM_SORTS = ['name', '-name', 'role', '-role', 'status', '-status', 'lastLoginAt', '-lastLoginAt'] as const;
export const TEAM_PAGE_SIZES = [25, 50, 100] as const;

export interface TeamMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  jobTitle: string | null;
  role: StaffRole;
  /** ROL-016 — end of an exceptional access in progress, else null. */
  elevatedUntil: string | null;
  status: TeamStatus;
  /** « Oui » · « Non » · null (« — ») for an invited account (ADM-030). */
  twoFactorEnabled: boolean | null;
  lastLoginAt: string | null;
  invitedAt: string;
  /** An invited account whose link no longer works: « Renvoyer l'invitation » (CYC-201). */
  invitationExpired: boolean;
  suspendedAt: string | null;
  /** The reason typed at the suspension — null for a reader who has no right to read it (ROL-015). */
  suspendedNote: string | null;
  isSelf: boolean;
  /** ADM-030 « Reçoit des demandes » — by distribution (CRM-020); null (« — ») for a role that never handles requests. */
  receivesLeads: boolean | null;
  /** CRM-021 — last day of the absence in progress (ISO day), else null. */
  absentUntil: string | null;
  /** ADM-030 « En cours » — open requests, open or paused dossiers, open tasks entrusted to the account. */
  workload: { leads: number; dossiers: number; tasks: number };
  /** What the caller may do on THIS account (ROL-010, ROL-011): the screen hides the rest; the API checks again. */
  can: {
    edit: boolean;
    changeRole: boolean;
    suspend: boolean;
    reactivate: boolean;
    resendInvitation: boolean;
    cancelInvitation: boolean;
    resetTwoFactor: boolean;
  };
}

export interface TeamList {
  data: TeamMember[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  /** TRV-106 — counts of each filter value, computed by the server on the list without that filter. */
  facets: { role: Record<string, number>; status: Record<string, number> };
  /** ROL-011 — the roles the caller may give when inviting or changing a role (empty: he manages no account). */
  assignableRoles: StaffRole[];
  /** ADM-040 — « Désignez un second compte Direction. » while a single one exists. */
  singleOwner: boolean;
  /**
   * CRM-021, ADM-030 — for those who manage the team: the members whose work in progress waits while they cannot do
   * it — absent, suspended, or moved to a role that handles nothing (Lecture seule, Support). Whole team, not the page.
   */
  notices: TeamNotice[];
}

export interface TeamNotice {
  id: string;
  firstName: string | null;
  lastName: string | null;
  kind: 'ABSENT' | 'SUSPENDED' | 'ROLE';
  /** For `ABSENT`: the last day of the absence. */
  absentUntil: string | null;
  leads: number;
  dossiers: number;
  tasks: number;
}

const csv = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(values as unknown as [T, ...T[]])).max(values.length));

/** `GET /admin/users` — API-010, API-011, API-012. An unknown parameter is refused (400). */
export const teamListQuerySchema = z.strictObject({
  q: z.string().trim().max(120).optional(),
  role: csv(Object.values(StaffRole)),
  status: csv(TEAM_STATUSES),
  sort: z.enum(TEAM_SORTS).default('name'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .refine((n) => (TEAM_PAGE_SIZES as readonly number[]).includes(n))
    .default(25),
});

const roleSchema = z.enum(StaffRole, { error: 'REQUIRED' });
const jobTitleSchema = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.string().trim().max(80, { error: 'TOO_LONG' }).nullable());
const reasonSchema = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(300, { error: 'TOO_LONG' }));

/** ADM-030 « Inviter » — Prénom, nom, e-mail, rôle, fonction. */
export const staffInviteSchema = z.strictObject({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema,
  role: roleSchema,
  jobTitle: jobTitleSchema,
});
export type StaffInvite = z.input<typeof staffInviteSchema>;

/** ADM-030 « Modifier » — the function, « Reçoit des demandes », the absence. A field left out is not changed. */
export const staffUpdateSchema = z.strictObject({
  jobTitle: jobTitleSchema.optional(),
  receivesLeads: z.boolean().optional(),
  absentUntil: absentUntilSchema.optional(),
});
export const staffChangeRoleSchema = z.strictObject({ role: roleSchema });
/** ADM-030 « Suspendre » — a reason is required. */
export const staffSuspendSchema = z.strictObject({ reason: reasonSchema });
/** ADM-032 — reason required. */
export const staffResetTwoFactorSchema = z.strictObject({ reason: reasonSchema });
