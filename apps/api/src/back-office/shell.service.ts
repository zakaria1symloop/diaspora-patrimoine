// BO-010 … BO-015, BO-070 (Profil), BO-081 — what the frame of the back office shows around every page (`GET
// /admin/me/shell`), and the section « Profil » of « Mes préférences » (`GET /admin/me/profile`, `PATCH /admin/me`).
// The password, the second factor and the devices are the identity module's routes (`/admin/me/*`, package 1.6).
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode, permissionsOf, staffAbsenceUpdateSchema, staffProfileUpdateSchema, staffSignatureUpdateSchema, type AdminShell, type StaffProfile, type StaffRole } from '@dp/contracts';
import { absenceToStore, currentAbsence, dayIn } from './absence.js';
import { diff, writeAudit } from '../admin/audit.js';
import { ENV, type Env } from '../config/env.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { groupOf } from '../tasks-admin/task-group.js';
import { LeadsAdminService } from './leads-admin.service.js';
import { StaffNotificationsService } from './staff-notifications.service.js';
import { StaffViews } from './staff-view.js';
import { TeamService } from './team.service.js';

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function knownTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class ShellService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly views: StaffViews,
    private readonly notifications: StaffNotificationsService,
    private readonly leads: LeadsAdminService,
    private readonly team: TeamService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** `GET /admin/me/shell` — any staff role. */
  async shell(auth: AuthContext): Promise<AdminShell> {
    const view = await this.views.of(auth);
    const all = await this.settings.all();
    const settingOn = (key: string) => (all as unknown as Record<string, unknown>)[key] === true;
    const now = this.clock.now();
    const [user, membership, unread, leadsToTake, singleOwner, overdueTasks] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { id: true, email: true, firstName: true, lastName: true, jobTitle: true, timezone: true } }),
      this.prisma.membership.findFirst({ where: { userId: auth.userId, revokedAt: null, organization: { type: 'OPERATOR' } }, select: { elevatedRole: true, elevatedUntil: true, absentUntil: true } }),
      this.notifications.unreadCount(auth.userId),
      view.has('lead.read') ? this.leads.countToTake(view) : Promise.resolve(undefined),
      view.has('user.manage') ? this.team.singleOwner() : Promise.resolve(false),
      view.has('task.read') ? this.overdueTasks(auth.userId, now) : Promise.resolve(undefined),
    ]);
    const shifted = this.clock.getOffsetDays() !== 0;
    const today = dayIn(now, all['business.calendar.timezone']);
    return {
      user: { ...user, absentUntil: currentAbsence(membership?.absentUntil, today) },
      role: view.role,
      permissions: permissionsOf(view.role as StaffRole, settingOn),
      unreadNotifications: unread,
      badges: { ...(leadsToTake === undefined ? {} : { leadsToTake }), ...(overdueTasks === undefined ? {} : { overdueTasks }) },
      banners: {
        environment: this.env.APP_ENV,
        shiftedClockDate: shifted ? new Intl.DateTimeFormat('en-CA', { timeZone: all['business.calendar.timezone'] }).format(now) : null,
        elevatedUntil: membership?.elevatedRole && membership.elevatedUntil && membership.elevatedUntil.getTime() > now.getTime() ? membership.elevatedUntil.toISOString() : null,
        maintenance: all['maintenance.enabled'] === true,
        masked: view.masked,
      },
      calendar: { workdayMinutes: minutesOf(all['business.calendar.end']) - minutesOf(all['business.calendar.start']), timeZone: all['business.calendar.timezone'] },
      session: { idleMinutes: all['security.staff.idleMinutes'] },
      contact: { companyName: all['contact.companyName'], email: all['contact.email'] || null, phone: all['contact.phone'] || null },
      singleOwner,
    };
  }

  /** TAC-007 — the counter of « Tâches »: my open tasks overdue in my zone (a task without hour is late the day after). */
  private async overdueTasks(userId: string, now: Date): Promise<number> {
    const rows = await this.prisma.task.findMany({ where: { deletedAt: null, status: 'OPEN', assigneeId: userId, dueAt: { lt: now } }, select: { status: true, dueAt: true, dueHasTime: true, assignee: { select: { timezone: true } } }, take: 500 });
    return rows.filter((r) => groupOf(r, now, r.assignee?.timezone ?? 'Europe/Paris') === 'OVERDUE').length;
  }

  /** `GET /admin/me/profile` — BO-070 « Profil » and what « Sécurité » shows about the account. */
  async profile(auth: AuthContext): Promise<StaffProfile> {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { id: true, email: true, firstName: true, lastName: true, jobTitle: true, phone: true, timezone: true, twoFactorEnabled: true, twoFactorRecoveryHashes: true, passwordChangedAt: true, signature: true },
    });
    const membership = await this.prisma.membership.findFirst({ where: { userId: auth.userId, revokedAt: null, organization: { type: 'OPERATOR' } }, select: { absentUntil: true, receivesLeads: true, role: true } });
    const today = dayIn(this.clock.now(), await this.settings.get('business.calendar.timezone'));
    const hashes = u.twoFactorRecoveryHashes;
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      jobTitle: u.jobTitle,
      phone: u.phone,
      timezone: u.timezone,
      role: auth.role as StaffRole,
      twoFactorEnabled: u.twoFactorEnabled,
      recoveryCodesLeft: Array.isArray(hashes) ? hashes.length : 0,
      passwordChangedAt: u.passwordChangedAt?.toISOString() ?? null,
      twoFactorRequired: await this.settings.get('security.staff.twoFactorRequired'),
      signature: u.signature,
      absentUntil: currentAbsence(membership?.absentUntil, today),
      handlesLeads: ['OWNER', 'ADMIN', 'AGENT'].includes(membership?.role ?? ''),
      receivesLeads: membership?.receivesLeads ?? false,
    };
  }

  /** `PATCH /admin/me` — first name, last name, function shown to clients, phone, time zone. */
  async updateProfile(auth: AuthContext, body: unknown): Promise<StaffProfile> {
    const keys = body && typeof body === 'object' ? Object.keys(body) : [];
    if (keys.length === 1 && keys[0] === 'signature') return this.updateSignature(auth, body);
    if (keys.length === 1 && keys[0] === 'absentUntil') return this.updateAbsence(auth, body);
    const input = parseOrThrow(staffProfileUpdateSchema, body);
    if (!knownTimeZone(input.timezone)) throw AppError.validation([{ field: 'timezone', code: 'INVALID_CHOICE' }]);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT id FROM users WHERE id = $1::uuid FOR UPDATE`, auth.userId);
      const before = await tx.user.findUnique({ where: { id: auth.userId }, select: { firstName: true, lastName: true, jobTitle: true, phone: true, timezone: true, status: true } });
      if (!before || before.status !== 'ACTIVE') throw new AppError(ErrorCode.FORBIDDEN);
      const next = { firstName: input.firstName, lastName: input.lastName, jobTitle: input.jobTitle, phone: input.phone, timezone: input.timezone };
      const changed = diff(before, next);
      if (!changed) return;
      await tx.user.update({ where: { id: auth.userId }, data: { ...next, updatedById: auth.userId, updatedAt: now } });
      // SEC-081 — the journal names the fields; a person's name or phone is not copied into it.
      const personal = new Set(['firstName', 'lastName', 'phone']);
      const strip = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, personal.has(k) ? '[modifié]' : v]));
      await writeAudit(tx, auth.actor, now, { action: 'user.updated', entityType: 'User', entityId: auth.userId, before: strip(changed.before), after: strip(changed.after) });
    });
    return this.profile(auth);
  }

  /** BO-070 « Signature » — the text under the name in hand-written e-mails (COM-021). */
  private async updateSignature(auth: AuthContext, body: unknown): Promise<StaffProfile> {
    const { signature } = parseOrThrow(staffSignatureUpdateSchema, body);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT id FROM users WHERE id = $1::uuid FOR UPDATE`, auth.userId);
      const before = await tx.user.findUnique({ where: { id: auth.userId }, select: { signature: true, status: true } });
      if (!before || before.status !== 'ACTIVE') throw new AppError(ErrorCode.FORBIDDEN);
      if (before.signature === signature) return;
      await tx.user.update({ where: { id: auth.userId }, data: { signature, updatedById: auth.userId, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'user.updated', entityType: 'User', entityId: auth.userId, after: { signature: '[modifié]' } });
    });
    return this.profile(auth);
  }

  /** CRM-021, BO-013 — « Je suis absent jusqu'au … » / « Je suis de retour » (null). */
  private async updateAbsence(auth: AuthContext, body: unknown): Promise<StaffProfile> {
    const { absentUntil } = parseOrThrow(staffAbsenceUpdateSchema, body);
    const now = this.clock.now();
    const today = dayIn(now, await this.settings.get('business.calendar.timezone'));
    const value = absenceToStore(absentUntil, today);
    await this.prisma.$transaction(async (tx) => {
      const m = await tx.membership.findFirst({ where: { userId: auth.userId, revokedAt: null, organization: { type: 'OPERATOR' } }, select: { id: true, absentUntil: true } });
      if (!m) throw new AppError(ErrorCode.FORBIDDEN);
      await tx.$queryRawUnsafe(`SELECT id FROM memberships WHERE id = $1::uuid FOR UPDATE`, m.id);
      const before = m.absentUntil?.toISOString().slice(0, 10) ?? null;
      if (before === absentUntil) return;
      await tx.membership.update({ where: { id: m.id }, data: { absentUntil: value, updatedById: auth.userId, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'user.updated', entityType: 'User', entityId: auth.userId, before: { absentUntil: before }, after: { absentUntil } });
    });
    return this.profile(auth);
  }
}
