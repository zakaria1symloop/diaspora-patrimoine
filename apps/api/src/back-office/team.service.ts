// EA-96, 04-back-office/13 § 3 (ADM-030, ADM-032), ROL-010 … ROL-013, CYC-200, MOD-100, MOD-105 — the team: list,
// invitation (send, resend, cancel), role, function, suspension and reactivation, reset of a colleague's second factor.
// Every action is ONE transaction (FIA-001): the data, its audit row under the code of SEC-080, and the domain event
// (`user.*`, AUT-010) that the outbox turns into `NS_TEAM_CHANGE` / `S_TEAM_CHANGE` for the Direction (ROL-012).
// The invitation link is minted when the e-mail leaves (NOT-010): no token is ever written here.
import { Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  StaffRole,
  staffChangeRoleSchema,
  staffInviteSchema,
  staffResetTwoFactorSchema,
  staffSuspendSchema,
  staffUpdateSchema,
  teamListQuerySchema,
  type TeamList,
  type TeamMember,
  type TeamNotice,
  type TeamStatus,
} from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import { writeAudit } from '../admin/audit.js';
import { ENV, type Env } from '../config/env.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuthMailRequester } from '../identity/auth-mail.js';
import { SessionsService, type AuthContext } from '../identity/sessions.service.js';
import { TOKEN_TTL_MS, TokensService } from '../identity/tokens.service.js';
import { TwoFactorService } from '../identity/two-factor.service.js';
import { invitationRequest } from '../install/owner.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { OutboxWriter } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { staffName, StaffViews, type StaffView } from './staff-view.js';
import { absenceToStore, currentAbsence, dayIn } from './absence.js';
import { SettingsService } from '../platform/settings.service.js';

const HANDLES_LEADS = ['OWNER', 'ADMIN', 'AGENT'];
export type Workload = { leads: number; dossiers: number; tasks: number };
const NO_WORK: Workload = { leads: 0, dossiers: 0, tasks: 0 };

const t = createTranslator('fr');

const MEMBER_SELECT = {
  id: true,
  role: true,
  invitedAt: true,
  receivesLeads: true,
  absentUntil: true,
  elevatedRole: true,
  elevatedUntil: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      status: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
      suspendedAt: true,
      suspendedNote: true,
      authTokens: { where: { purpose: 'STAFF_INVITATION', usedAt: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { expiresAt: true } },
    },
  },
} satisfies Prisma.MembershipSelect;
type MemberRow = Prisma.MembershipGetPayload<{ select: typeof MEMBER_SELECT }>;

/** Staff accounts of the operator, deleted ones left out (ADM-030). */
const TEAM_WHERE = { revokedAt: null, organization: { type: 'OPERATOR' }, user: { kind: 'STAFF', status: { not: 'DELETED' } } } satisfies Prisma.MembershipWhereInput;

/** ROL-011 — the roles a caller may give: every role for the Direction, every role but Direction for an administrator. */
export function assignableRoles(view: Pick<StaffView, 'role' | 'has'>): StaffRole[] {
  if (!view.has('user.manage')) return [];
  const all = Object.values(StaffRole);
  return view.role === 'OWNER' ? all : all.filter((r) => r !== 'OWNER');
}

/** ROL-011 — the caller may act on this account: an OWNER on anyone, the others never on an OWNER. */
function manages(view: Pick<StaffView, 'role' | 'has'>, targetRole: string): boolean {
  return view.has('user.manage') && (view.role === 'OWNER' || targetRole !== 'OWNER');
}

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly views: StaffViews,
    private readonly sessions: SessionsService,
    private readonly tokens: TokensService,
    private readonly mail: AuthMailRequester,
    private readonly outbox: OutboxWriter,
    private readonly twoFactor: TwoFactorService,
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ─── Reads ────────────────────────────────────────────────────────────────

  private member(row: MemberRow, view: StaffView, now: Date, today: string, workload: Workload = NO_WORK): TeamMember {
    const u = row.user;
    const status = u.status as TeamStatus;
    const isSelf = u.id === view.userId;
    const role = row.role as StaffRole;
    const manage = manages(view, role) && !isSelf;
    const token = u.authTokens[0];
    const invitationExpired = status === 'INVITED' && (token ? token.expiresAt.getTime() <= now.getTime() : now.getTime() - row.invitedAt.getTime() > TOKEN_TTL_MS.STAFF_INVITATION);
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      jobTitle: u.jobTitle,
      role,
      elevatedUntil: row.elevatedRole && row.elevatedUntil && row.elevatedUntil.getTime() > now.getTime() ? row.elevatedUntil.toISOString() : null,
      status,
      twoFactorEnabled: status === 'INVITED' ? null : u.twoFactorEnabled,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      invitedAt: row.invitedAt.toISOString(),
      invitationExpired,
      suspendedAt: u.suspendedAt?.toISOString() ?? null,
      // SEC-032 — a typed reason is free text: not sent to the SUPPORT role; nor to a reader who manages nobody.
      suspendedNote: status === 'SUSPENDED' && !view.masked && view.has('user.manage') ? u.suspendedNote : null,
      isSelf,
      receivesLeads: HANDLES_LEADS.includes(role) ? row.receivesLeads : null,
      absentUntil: currentAbsence(row.absentUntil, today),
      workload,
      can: {
        edit: manages(view, role),
        changeRole: manage,
        suspend: manage && status === 'ACTIVE',
        reactivate: manage && status === 'SUSPENDED',
        resendInvitation: manage && status === 'INVITED',
        cancelInvitation: manage && status === 'INVITED',
        resetTwoFactor: view.has('user.twofactor.reset') && !isSelf && status === 'ACTIVE' && u.twoFactorEnabled,
      },
    };
  }

  /** TRV-103 — name or e-mail, case and accents ignored, one typo tolerated on the name. */
  private async idsMatching(q: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT u.id FROM users u
      WHERE u.kind = 'STAFF' AND u.status <> 'DELETED' AND (
        lower(public.f_unaccent(concat_ws(' ', u.first_name, u.last_name, u.email::text))) LIKE '%' || lower(public.f_unaccent(${q})) || '%'
        OR lower(public.f_unaccent(concat_ws(' ', u.last_name, u.first_name))) LIKE '%' || lower(public.f_unaccent(${q})) || '%'
        OR word_similarity(lower(public.f_unaccent(${q})), lower(public.f_unaccent(concat_ws(' ', u.first_name, u.last_name)))) >= 0.6
      )
      LIMIT 500`;
    return rows.map((r) => r.id);
  }

  /** ADM-030 « En cours » — open requests, live dossiers, open tasks of each account (one grouped query each). */
  async workloads(userIds: string[]): Promise<Map<string, Workload>> {
    const out = new Map<string, Workload>();
    if (!userIds.length) return out;
    const [leads, dossiers, tasks] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['assignedAgentId'], where: { assignedAgentId: { in: userIds }, status: { in: ['NEW', 'IN_PROGRESS'] } }, _count: { _all: true } }),
      this.prisma.dossier.groupBy({ by: ['assignedAgentId'], where: { assignedAgentId: { in: userIds }, status: { in: ['OPEN', 'ON_HOLD'] }, deletedAt: null }, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['assigneeId'], where: { assigneeId: { in: userIds }, status: 'OPEN', deletedAt: null }, _count: { _all: true } }),
    ]);
    const get = (id: string) => out.get(id) ?? out.set(id, { ...NO_WORK }).get(id)!;
    for (const r of leads) if (r.assignedAgentId) get(r.assignedAgentId).leads = r._count._all;
    for (const r of dossiers) if (r.assignedAgentId) get(r.assignedAgentId).dossiers = r._count._all;
    for (const r of tasks) if (r.assigneeId) get(r.assigneeId).tasks = r._count._all;
    return out;
  }

  /** CRM-021, ADM-030 — members whose work waits while they cannot do it: absent, suspended, or in a role that handles nothing. */
  private async notices(view: StaffView, today: string): Promise<TeamNotice[]> {
    if (!view.has('user.manage')) return [];
    const rows = await this.prisma.membership.findMany({
      where: { revokedAt: null, organization: { type: 'OPERATOR' }, user: { kind: 'STAFF', status: { in: ['ACTIVE', 'SUSPENDED'] } } },
      select: { role: true, absentUntil: true, user: { select: { id: true, firstName: true, lastName: true, status: true } } },
    });
    const candidates: Omit<TeamNotice, 'leads' | 'dossiers' | 'tasks'>[] = [];
    for (const r of rows) {
      const absent = currentAbsence(r.absentUntil, today);
      const kind: TeamNotice['kind'] | null = r.user.status === 'SUSPENDED' ? 'SUSPENDED' : !HANDLES_LEADS.includes(r.role) ? 'ROLE' : absent ? 'ABSENT' : null;
      if (kind) candidates.push({ id: r.user.id, firstName: r.user.firstName, lastName: r.user.lastName, kind, absentUntil: kind === 'ABSENT' ? absent : null });
    }
    const loads = await this.workloads(candidates.map((c) => c.id));
    return candidates
      .map((c) => ({ ...c, ...(loads.get(c.id) ?? NO_WORK) }))
      // an absence is always worth a word; a suspension or a role change only when work is left behind
      .filter((n) => n.kind === 'ABSENT' || n.leads + n.dossiers + n.tasks > 0);
  }

  async singleOwner(db: Tx | PrismaService = this.prisma): Promise<boolean> {
    const owners = await db.membership.count({ where: { ...TEAM_WHERE, role: 'OWNER', user: { kind: 'STAFF', status: { in: ['ACTIVE', 'INVITED'] } } } });
    return owners < 2;
  }

  /** `GET /admin/users` (`user.read`) — ADM-030. */
  async list(auth: AuthContext, rawQuery: unknown): Promise<TeamList> {
    const view = await this.views.of(auth);
    const parsed = teamListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST); // API-011: an unknown parameter is refused
    const query = parsed.data;
    const now = this.clock.now();

    const q = query.q && query.q.length >= 2 ? query.q : null; // API-012
    const ids = q ? await this.idsMatching(q) : null;
    const userBase: Prisma.UserWhereInput = { kind: 'STAFF', status: { not: 'DELETED' }, ...(ids ? { id: { in: ids } } : {}) };
    const where = (opts: { role: boolean; status: boolean }): Prisma.MembershipWhereInput => ({
      revokedAt: null,
      organization: { type: 'OPERATOR' },
      ...(opts.role && query.role.length ? { role: { in: query.role } } : {}),
      user: { ...userBase, ...(opts.status && query.status.length ? { status: { in: query.status } } : {}) },
    });

    const desc = query.sort.startsWith('-');
    const dir = desc ? 'desc' : 'asc';
    const byName: Prisma.MembershipOrderByWithRelationInput[] = [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }, { id: 'asc' }];
    const key = query.sort.replace(/^-/, '');
    const orderBy: Prisma.MembershipOrderByWithRelationInput[] =
      key === 'name'
        ? [{ user: { lastName: dir } }, { user: { firstName: dir } }, { id: 'asc' }]
        : key === 'role'
          ? [{ role: dir }, ...byName]
          : key === 'status'
            ? [{ user: { status: dir } }, ...byName]
            : [{ user: { lastLoginAt: { sort: dir, nulls: 'last' } } }, ...byName];

    const full = where({ role: true, status: true });
    const today = dayIn(now, await this.settings.get('business.calendar.timezone'));
    const [total, rows, byRole, statusRows, singleOwner] = await Promise.all([
      this.prisma.membership.count({ where: full }),
      this.prisma.membership.findMany({ where: full, select: MEMBER_SELECT, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.membership.groupBy({ by: ['role'], where: where({ role: false, status: true }), _count: { _all: true } }),
      this.prisma.membership.findMany({ where: where({ role: true, status: false }), select: { user: { select: { status: true } } } }),
      this.singleOwner(),
    ]);
    const status: Record<string, number> = {};
    for (const r of statusRows) status[r.user.status] = (status[r.user.status] ?? 0) + 1;

    const loads = await this.workloads(rows.map((r) => r.user.id));
    return {
      data: rows.map((r) => this.member(r, view, now, today, loads.get(r.user.id))),
      meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
      facets: { role: Object.fromEntries(byRole.map((r) => [r.role, r._count._all])), status },
      assignableRoles: assignableRoles(view),
      singleOwner,
      notices: await this.notices(view, today),
    };
  }

  // ─── Shared by the actions ────────────────────────────────────────────────

  private async target(tx: Tx, id: string): Promise<MemberRow> {
    // FIA-020 — the account's row is locked for the length of the action.
    await tx.$queryRawUnsafe(`SELECT id FROM users WHERE id = $1::uuid FOR UPDATE`, id);
    const row = await tx.membership.findFirst({ where: { ...TEAM_WHERE, userId: id }, select: MEMBER_SELECT });
    if (!row) throw AppError.notFound();
    return row;
  }

  /** ROL-011 — refused (403) when the caller does not manage this account; an action on one's own account is refused too. */
  private guard(view: StaffView, row: MemberRow, opts: { self?: boolean } = {}): void {
    if (!manages(view, row.role)) throw new AppError(ErrorCode.FORBIDDEN);
    if (!opts.self && row.user.id === view.userId) throw AppError.conflictState('OWN_ACCOUNT');
  }

  /**
   * ROL-010 — at least one active Direction account remains. Checked UNDER LOCK (FIA-020): the OWNER memberships are
   * locked, so two Directions removing each other at the same instant cannot both pass.
   */
  private async keepOneOwner(tx: Tx, leavingUserId: string): Promise<void> {
    await tx.$queryRawUnsafe(
      `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.organization_id
       WHERE o.type = 'OPERATOR' AND m.role = 'OWNER' AND m.revoked_at IS NULL ORDER BY m.id FOR UPDATE OF m`,
    );
    const others = await tx.membership.count({
      where: { revokedAt: null, suspendedAt: null, role: 'OWNER', organization: { type: 'OPERATOR' }, userId: { not: leavingUserId }, user: { kind: 'STAFF', status: 'ACTIVE' } },
    });
    if (others < 1) throw AppError.conflictState('LAST_OWNER');
  }

  private async event(tx: Tx, type: string, userId: string, auth: AuthContext, payload: Record<string, unknown>, at: Date): Promise<void> {
    await this.outbox.add(tx, { type, aggregateType: 'User', aggregateId: userId, payload: { actorId: auth.userId, ...payload } }, at);
  }

  private async answer(auth: AuthContext, id: string): Promise<TeamMember> {
    const view = await this.views.of(auth);
    const row = await this.prisma.membership.findFirst({ where: { ...TEAM_WHERE, userId: id }, select: MEMBER_SELECT });
    if (!row) throw AppError.notFound();
    const now = this.clock.now();
    const loads = await this.workloads([id]);
    return this.member(row, view, now, dayIn(now, await this.settings.get('business.calendar.timezone')), loads.get(id));
  }

  // ─── Invitation (ADM-030) ─────────────────────────────────────────────────

  /** `POST /admin/users/invite` (`user.manage`). */
  async invite(auth: AuthContext, body: unknown): Promise<TeamMember> {
    const view = await this.views.of(auth);
    const input = parseOrThrow(staffInviteSchema, body);
    if (!assignableRoles(view).includes(input.role)) throw new AppError(ErrorCode.FORBIDDEN); // ROL-011
    const now = this.clock.now();
    const actorName = staffName(auth);
    const userId = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findFirst({ where: { type: 'OPERATOR' }, select: { id: true } });
      if (!org) throw new AppError(ErrorCode.INTERNAL_ERROR);
      // ROL-003 — one address, one account, whatever its kind (the unique index is the last word: FIA-002).
      const taken = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (taken) throw AppError.validation([{ field: 'email', code: 'ALREADY_USED' }]);
      const id = newId();
      await tx.user.create({
        data: { id, kind: 'STAFF', email: input.email, firstName: input.firstName, lastName: input.lastName, jobTitle: input.jobTitle, status: 'INVITED', locale: 'fr', createdById: auth.userId, updatedById: auth.userId, createdAt: now, updatedAt: now },
      });
      await tx.membership.create({
        // MOD — `receivesLeads`: true for an adviser, false for the other roles (01-domaine/02).
        data: { id: newId(), userId: id, organizationId: org.id, role: input.role, invitedById: auth.userId, invitedAt: now, receivesLeads: input.role === 'AGENT', createdById: auth.userId, updatedById: auth.userId, createdAt: now, updatedAt: now },
      });
      await writeAudit(tx, auth.actor, now, { action: 'user.invited', entityType: 'User', entityId: id, after: { role: input.role, jobTitle: input.jobTitle } });
      await this.event(tx, 'user.invited', id, auth, { role: input.role, previousRole: null }, now);
      await this.mail.request(tx, { ...invitationRequest(id, input.email, t(`ui.enum.MembershipRole.${input.role}`)), vars: { action: { roleLabel: t(`ui.enum.MembershipRole.${input.role}`) }, actor: { fullName: actorName } } });
      return id;
    });
    this.mail.wake();
    return this.answer(auth, userId);
  }

  /** `POST /admin/users/{id}/resend-invitation` — a new link that kills the previous one (MOD-105); traced, not notified again. */
  async resendInvitation(auth: AuthContext, id: string): Promise<TeamMember> {
    const view = await this.views.of(auth);
    const now = this.clock.now();
    const actorName = staffName(auth);
    await this.prisma.$transaction(async (tx) => {
      const row = await this.target(tx, id);
      this.guard(view, row);
      if (row.user.status !== 'INVITED') throw AppError.conflictState('NOT_INVITED');
      await tx.membership.update({ where: { id: row.id }, data: { invitedAt: now, invitedById: auth.userId, updatedById: auth.userId, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'user.invited', entityType: 'User', entityId: id, after: { role: row.role, resent: true } });
      await this.mail.request(tx, { ...invitationRequest(id, row.user.email, t(`ui.enum.MembershipRole.${row.role}`)), vars: { action: { roleLabel: t(`ui.enum.MembershipRole.${row.role}`) }, actor: { fullName: actorName } } });
    });
    this.mail.wake();
    return this.answer(auth, id);
  }

  /** `POST /admin/users/{id}/cancel-invitation` — an account still « Invité » only: DELETED, membership revoked, link dead (CYC-200, MOD-100). */
  async cancelInvitation(auth: AuthContext, id: string): Promise<void> {
    const view = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const row = await this.target(tx, id);
      this.guard(view, row);
      if (row.user.status !== 'INVITED') throw AppError.conflictState('NOT_INVITED');
      const name = staffName(row.user);
      await tx.authToken.updateMany({ where: { userId: id, usedAt: null }, data: { expiresAt: now, updatedAt: now } });
      await this.sessions.revokeAll(id, 'ADMIN', null, tx);
      await tx.membership.update({ where: { id: row.id }, data: { revokedAt: now, updatedById: auth.userId, updatedAt: now } });
      // MOD-100 — personal fields erased; the row stays for the integrity of the journals.
      await tx.user.update({
        where: { id },
        data: { status: 'DELETED', email: `deleted+${id}@invalid`, pendingEmail: null, firstName: null, lastName: null, phone: null, jobTitle: null, signature: null, passwordHash: null, twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null, updatedById: auth.userId, updatedAt: now },
      });
      await tx.$executeRawUnsafe(`UPDATE users SET two_factor_recovery_hashes = NULL WHERE id = $1::uuid`, id);
      await writeAudit(tx, auth.actor, now, { action: 'user.deleted', entityType: 'User', entityId: id, before: { status: 'INVITED', role: row.role }, after: { status: 'DELETED' }, reason: 'invitation.cancelled' });
      // the name is erased with the account: the event carries it for the sentence of the notification (ROL-012)
      await this.event(tx, 'user.deleted', id, auth, { role: row.role, targetName: name, invitationCancelled: true }, now);
    });
  }

  // ─── Role, function (ADM-030, ROL-010 … ROL-013) ──────────────────────────

  /** `POST /admin/users/{id}/change-role` (`user.manage`, BO-005) — immediate; the account's sessions are closed (ROL-013). */
  async changeRole(auth: AuthContext, id: string, body: unknown): Promise<TeamMember> {
    const view = await this.views.of(auth);
    const { role } = parseOrThrow(staffChangeRoleSchema, body);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const row = await this.target(tx, id);
      this.guard(view, row);
      if (!assignableRoles(view).includes(role)) throw new AppError(ErrorCode.FORBIDDEN); // ROL-011
      if (row.role === role) return;
      if (row.role === 'OWNER') await this.keepOneOwner(tx, id);
      await tx.membership.update({
        where: { id: row.id },
        // `receivesLeads` follows the role's default when the account leaves or joins the advisers.
        data: { role, receivesLeads: role === 'AGENT', elevatedRole: null, elevatedUntil: null, elevationReason: null, updatedById: auth.userId, updatedAt: now },
      });
      await this.sessions.revokeAll(id, 'ROLE_CHANGED', null, tx);
      await writeAudit(tx, auth.actor, now, { action: 'user.role_changed', entityType: 'User', entityId: id, before: { role: row.role }, after: { role } });
      await this.event(tx, 'user.role_changed', id, auth, { role, previousRole: row.role }, now);
    });
    return this.answer(auth, id);
  }

  /** `PATCH /admin/users/{id}` (`user.manage`) — the function; the name and the password belong to the person (ADM-030). */
  async update(auth: AuthContext, id: string, body: unknown): Promise<TeamMember> {
    const view = await this.views.of(auth);
    const input = parseOrThrow(staffUpdateSchema, body);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const row = await this.target(tx, id);
      this.guard(view, row, { self: true });
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.jobTitle !== undefined && row.user.jobTitle !== input.jobTitle) {
        await tx.user.update({ where: { id }, data: { jobTitle: input.jobTitle, updatedById: auth.userId, updatedAt: now } });
        before.jobTitle = row.user.jobTitle;
        after.jobTitle = input.jobTitle;
      }
      const membership: Record<string, unknown> = {};
      if (input.receivesLeads !== undefined && input.receivesLeads !== row.receivesLeads) {
        if (!HANDLES_LEADS.includes(row.role)) throw AppError.validation([{ field: 'receivesLeads', code: 'INVALID_CHOICE' }]);
        membership.receivesLeads = input.receivesLeads;
        before.receivesLeads = row.receivesLeads;
        after.receivesLeads = input.receivesLeads;
      }
      if (input.absentUntil !== undefined) {
        const today = dayIn(now, await this.settings.get('business.calendar.timezone'));
        const current = row.absentUntil?.toISOString().slice(0, 10) ?? null;
        if (current !== input.absentUntil) {
          membership.absentUntil = absenceToStore(input.absentUntil, today);
          before.absentUntil = current;
          after.absentUntil = input.absentUntil;
        }
      }
      if (Object.keys(membership).length) await tx.membership.update({ where: { id: row.id }, data: { ...membership, updatedById: auth.userId, updatedAt: now } });
      if (Object.keys(after).length) await writeAudit(tx, auth.actor, now, { action: 'user.updated', entityType: 'User', entityId: id, before, after });
    });
    return this.answer(auth, id);
  }

  // ─── Suspension (ADM-030, CYC-200) ────────────────────────────────────────

  /** `POST /admin/users/{id}/suspend` — an ACTIVE account only; reason required; its sessions are closed. */
  async suspend(auth: AuthContext, id: string, body: unknown): Promise<TeamMember> {
    const view = await this.views.of(auth);
    const { reason } = parseOrThrow(staffSuspendSchema, body);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const row = await this.target(tx, id);
      this.guard(view, row);
      if (row.user.status !== 'ACTIVE') throw AppError.conflictState(row.user.status === 'INVITED' ? 'INVITED_NOT_SUSPENDABLE' : 'ALREADY_SUSPENDED');
      if (row.role === 'OWNER') await this.keepOneOwner(tx, id);
      await tx.user.update({ where: { id }, data: { status: 'SUSPENDED', suspendedAt: now, suspendedReason: 'STAFF_DECISION', suspendedNote: reason, updatedById: auth.userId, updatedAt: now } });
      await this.sessions.revokeAll(id, 'SUSPENDED', null, tx);
      await tx.authToken.updateMany({ where: { userId: id, usedAt: null }, data: { expiresAt: now, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'user.suspended', entityType: 'User', entityId: id, before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED' }, reason });
      await this.event(tx, 'user.suspended', id, auth, { role: row.role }, now);
    });
    return this.answer(auth, id);
  }

  /** `POST /admin/users/{id}/reactivate` — back to ACTIVE; the person signs in again. */
  async reactivate(auth: AuthContext, id: string): Promise<TeamMember> {
    const view = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const row = await this.target(tx, id);
      this.guard(view, row);
      if (row.user.status !== 'SUSPENDED') throw AppError.conflictState('NOT_SUSPENDED');
      await tx.user.update({ where: { id }, data: { status: 'ACTIVE', suspendedAt: null, suspendedReason: null, suspendedNote: null, failedLoginCount: 0, lockedUntil: null, updatedById: auth.userId, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'user.reactivated', entityType: 'User', entityId: id, before: { status: 'SUSPENDED' }, after: { status: 'ACTIVE' } });
      await this.event(tx, 'user.reactivated', id, auth, { role: row.role }, now);
    });
    return this.answer(auth, id);
  }

  // ─── Second factor of a colleague (ADM-032, BO-006) ───────────────────────

  /**
   * `POST /admin/users/{id}/reset-two-factor` (`user.twofactor.reset`, BO-005) — reason required; the sessions are
   * closed; at the next sign-in the person configures it again before entering (BO-003).
   */
  async resetTwoFactor(auth: AuthContext, id: string, body: unknown): Promise<TeamMember> {
    const view = await this.views.of(auth);
    const { reason } = parseOrThrow(staffResetTwoFactorSchema, body);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const row = await this.target(tx, id);
      if (row.user.id === view.userId) throw AppError.conflictState('OWN_ACCOUNT'); // one's own: « Mes préférences » (BO-070)
      if (row.user.status !== 'ACTIVE' || !row.user.twoFactorEnabled) throw AppError.conflictState('TWO_FACTOR_NOT_ENABLED');
      await this.twoFactor.disable(id, tx);
      await this.sessions.revokeAll(id, 'ADMIN', null, tx);
      await writeAudit(tx, auth.actor, now, { action: 'auth.two_factor_reset', entityType: 'User', entityId: id, reason });
      await this.event(tx, 'user.two_factor_changed', id, auth, { role: row.role, byThirdParty: true }, now);
      // the person is told too (S_TWO_FACTOR_CHANGED): a change of the account's security never goes unseen
      await this.mail.request(tx, {
        template: 'S_TWO_FACTOR_CHANGED',
        to: row.user.email,
        userId: id,
        vars: { action: { stateLabel: t('ui.email.twoFactorState.resetByAdmin'), adminUrl: `${this.env.ADMIN_URL ?? this.env.WEB_URL}/connexion` } },
      });
    });
    this.mail.wake();
    return this.answer(auth, id);
  }
}
