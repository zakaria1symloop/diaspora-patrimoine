// Package 3.3 « Compte du client » — CRM-070 (the tab « Compte »: state, invite and resend, suspend and reactivate,
// close the sessions, switch off the second factor, change the address of the account, devices read only) and CRM-075 /
// ROL-017 (« Voir comme le client »: a single-use code of one minute, exchanged by the client space for a READ-ONLY
// session of 30 minutes). The team never sees nor sets a client's password. Each write is ONE transaction with the
// record locked (FIA-020), the audit row under the code of SEC-080, its events and its e-mails by the outbox (FIA-040).
import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ErrorCode,
  clientAccountReasonSchema,
  clientChangeEmailSchema,
  clientPreviewCodeSchema,
  previewExchangeSchema,
  type ClientAccount,
  type ClientPreviewCode,
  type ClientPreviewState,
  type SessionResponse,
} from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import type { Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import { StaffViews, type StaffView } from '../back-office/staff-view.js';
import { liveClients } from '../clients-admin/clients-read.service.js';
import { ENV, type Env } from '../config/env.js';
import { clientOwningEmail } from '../crm/client-write.js';
import { AuthMailRequester } from '../identity/auth-mail.js';
import { LINK_PATHS } from '../identity/auth.service.js';
import { tokenPageHeaders } from '../identity/http.js';
import { ensureInvitedAccount } from '../identity/lead-account.js';
import { SessionsService, type AuthContext } from '../identity/sessions.service.js';
import { TokensService } from '../identity/tokens.service.js';
import { TwoFactorService } from '../identity/two-factor.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { OutboxWriter } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { currentRequestId } from '../platform/request-context.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';

const t = createTranslator('fr');

const USER_SELECT = {
  id: true,
  kind: true,
  email: true,
  status: true,
  emailVerifiedAt: true,
  pendingEmail: true,
  suspendedAt: true,
  suspendedReason: true,
  suspendedNote: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

type AccountUser = { id: string; kind: string; email: string; status: string; emailVerifiedAt: Date | null; pendingEmail: string | null; suspendedAt: Date | null; suspendedReason: 'STAFF_DECISION' | 'DELETION_PENDING' | null; suspendedNote: string | null; twoFactorEnabled: boolean; lastLoginAt: Date | null; createdAt: Date };

/** CRM-070 — the four states of the tab; a deleted account is « Aucun compte ». */
export function accountStateOf(user: { status: string } | null): ClientAccount['state'] {
  if (!user || user.status === 'DELETED') return 'NONE';
  return user.status === 'INVITED' ? 'INVITED' : user.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
}

/** BO-047 — what the caller may do on the account, from its state and his permissions (pure: tested alone). */
export function accountCan(
  staff: Pick<StaffView, 'has' | 'masked'>,
  state: ClientAccount['state'],
  user: Pick<AccountUser, 'twoFactorEnabled' | 'suspendedReason' | 'emailVerifiedAt'> | null,
  inviteBlocked: ClientAccount['inviteBlocked'],
): ClientAccount['can'] {
  const manage = staff.has('client.account.manage') && !staff.masked;
  const invite = staff.has('client.invite') && !staff.masked;
  return {
    invite: invite && state === 'NONE' && inviteBlocked === null,
    resend: invite && state === 'INVITED',
    suspend: manage && state === 'ACTIVE',
    // a suspension asked by the client's deletion is lifted by his retraction (PRO-060), never from this tab (Q-077)
    reactivate: manage && state === 'SUSPENDED' && user?.suspendedReason === 'STAFF_DECISION',
    revokeSessions: manage && (state === 'ACTIVE' || state === 'INVITED'),
    disableTwoFactor: manage && state !== 'NONE' && Boolean(user?.twoFactorEnabled),
    changeEmail: manage && (state === 'ACTIVE' || state === 'INVITED'),
    preview: staff.has('client.impersonate') && state === 'ACTIVE' && Boolean(user?.emailVerifiedAt),
  };
}

@Injectable()
export class ClientAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly views: StaffViews,
    private readonly sessions: SessionsService,
    private readonly tokens: TokensService,
    private readonly mail: AuthMailRequester,
    private readonly twoFactor: TwoFactorService,
    private readonly outbox: OutboxWriter,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private requestId() {
    const id = currentRequestId();
    return id === 'req_none' ? null : id;
  }

  private userEvent(type: string, userId: string, clientId: string, actor: Actor, data: Record<string, unknown> = {}) {
    return domainEvent({ type, aggregate: { type: 'User', id: userId }, actor: { type: 'USER', id: actor.userId }, clientId, data, requestId: this.requestId() });
  }

  /** The record within the perimeter (else 404), locked when `tx` writes; with its account. */
  private async target(db: Tx | PrismaService, staff: StaffView, id: string, lock: boolean) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw AppError.notFound();
    if (lock) await db.$queryRawUnsafe(`SELECT id FROM clients WHERE id = $1::uuid FOR UPDATE`, id);
    const c = await db.client.findFirst({
      where: { AND: [{ id }, liveClients(staff)] },
      select: { id: true, userId: true, email: true, firstName: true, lastName: true, phone: true, timezone: true, preferredLanguage: true, gdprErasedAt: true },
    });
    if (!c) throw AppError.notFound();
    const user = c.userId ? ((await db.user.findUnique({ where: { id: c.userId }, select: USER_SELECT })) as AccountUser | null) : null;
    return { client: c, user: user && user.status !== 'DELETED' ? user : null };
  }

  private async inviteBlocked(db: Tx | PrismaService, client: { id: string; email: string | null }, user: AccountUser | null): Promise<ClientAccount['inviteBlocked']> {
    if (user) return null;
    if (!client.email) return 'NO_EMAIL';
    const holder = await db.user.findUnique({ where: { email: client.email }, select: { id: true, status: true } });
    return holder && holder.status !== 'DELETED' ? 'EMAIL_TAKEN' : null;
  }

  // ─── Read (CRM-070) ───────────────────────────────────────────────────────

  /** `GET /admin/clients/{id}/account` (`client.read`). */
  async account(auth: AuthContext, id: string): Promise<ClientAccount> {
    const staff = await this.views.of(auth);
    const { client, user } = await this.target(this.prisma, staff, id, false);
    const state = accountStateOf(user);
    const blocked = await this.inviteBlocked(this.prisma, client, user);
    const now = this.clock.now();
    const devices = user
      ? await this.prisma.session.findMany({
          // the devices of the account itself: never a preview of the team (SEC-025)
          where: { userId: user.id, impersonatedById: null, revokedAt: null, expiresAt: { gt: now } },
          orderBy: { lastUsedAt: 'desc' },
          take: 10,
          select: { deviceLabel: true, lastUsedAt: true, createdAt: true },
        })
      : [];
    const masked = staff.masked;
    return {
      state,
      email: masked ? null : (user?.email ?? client.email),
      invitedAt: state === 'INVITED' && user ? user.createdAt.toISOString() : null,
      lastLoginAt: user?.lastLoginAt?.toISOString() ?? null,
      activatedAt: user?.emailVerifiedAt?.toISOString() ?? null,
      suspended: state === 'SUSPENDED' && user ? { at: user.suspendedAt?.toISOString() ?? null, kind: user.suspendedReason, reason: masked ? null : user.suspendedNote } : null,
      twoFactorEnabled: Boolean(user?.twoFactorEnabled),
      pendingEmail: masked ? null : (user?.pendingEmail ?? null),
      devices: devices.map((d) => ({ label: d.deviceLabel, lastUsedAt: d.lastUsedAt.toISOString(), createdAt: d.createdAt.toISOString() })),
      can: accountCan(staff, state, user, blocked),
      inviteBlocked: state === 'NONE' ? blocked : null,
    };
  }

  // ─── Invite, resend (CRM-070, CYC-200) ────────────────────────────────────

  /** `POST /admin/clients/{id}/invite` (`client.invite`) — creates the INVITED account, or sends the link again. */
  async invite(auth: AuthContext, id: string): Promise<ClientAccount> {
    const staff = await this.views.of(auth);
    if (staff.masked) throw new AppError(ErrorCode.FORBIDDEN);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const { client, user } = await this.target(tx, staff, id, true);
      if (client.gdprErasedAt) throw AppError.conflictState('CLIENT_ERASED');
      let userId: string;
      let email: string;
      let resent = false;
      if (user) {
        if (user.status !== 'INVITED') throw AppError.conflictState('ACCOUNT_ALREADY_ACTIVE');
        userId = user.id;
        email = user.email;
        resent = true;
      } else {
        const blocked = await this.inviteBlocked(tx, client, null);
        if (blocked === 'NO_EMAIL') throw AppError.conflictState('NO_EMAIL_ADDRESS');
        if (blocked === 'EMAIL_TAKEN') throw AppError.conflictState('EMAIL_TAKEN');
        const created = await ensureInvitedAccount(tx, client, now, 'STAFF');
        if (!created) throw AppError.conflictState('EMAIL_TAKEN');
        userId = created;
        email = client.email!;
      }
      // the link is minted when the e-mail really leaves (NOT-010); earlier links stay valid (MOD-105)
      await this.mail.request(tx, {
        template: 'C_ACCOUNT_ACTIVATION',
        userId,
        clientId: client.id,
        to: email,
        dedupeKey: `C_ACCOUNT_ACTIVATION:${client.id}:${now.getTime()}`,
        link: { purpose: 'ACCOUNT_ACTIVATION', host: 'web', path: LINK_PATHS.activation, payload: { fromSignup: false, next: null } },
        vars: { action: { fromSignup: false } },
      });
      await writeAudit(tx, auth.actor, now, { action: 'client.account_invited', entityType: 'Client', entityId: client.id, clientId: client.id, after: { resent } });
    });
    this.mail.wake();
    return this.account(auth, id);
  }

  // ─── Suspend, reactivate (CRM-070, CYC-200) ───────────────────────────────

  /** `POST /admin/clients/{id}/suspend` (`client.account.manage`) — reason required; every session closes. */
  async suspend(auth: AuthContext, id: string, body: unknown): Promise<ClientAccount> {
    const { reason } = parseOrThrow(clientAccountReasonSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const { client, user } = await this.target(tx, staff, id, true);
      if (!user || user.status !== 'ACTIVE') throw AppError.conflictState('ACCOUNT_NOT_ACTIVE');
      await tx.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED', suspendedAt: now, suspendedReason: 'STAFF_DECISION', suspendedNote: reason, updatedAt: now } });
      await this.sessions.revokeAll(user.id, 'SUSPENDED', null, tx);
      // a preview of the team ends too: there is no space left to look at
      await tx.session.updateMany({ where: { userId: user.id, revokedAt: null, impersonatedById: { not: null } }, data: { revokedAt: now, revokedReason: 'SUSPENDED', updatedAt: now } });
      await this.tokens.killAll(user.id, ['MAGIC_LOGIN', 'PASSWORD_RESET', 'CLIENT_PREVIEW'], tx);
      await writeAudit(tx, auth.actor, now, { action: 'client.account_suspended', entityType: 'Client', entityId: client.id, clientId: client.id, reason });
      await this.outbox.add(tx, this.userEvent('user.suspended', user.id, client.id, auth.actor, { role: null, previousRole: null }), now);
    });
    return this.account(auth, id);
  }

  /** `POST /admin/clients/{id}/reactivate` (`client.account.manage`) — reason required; a STAFF_DECISION only. */
  async reactivate(auth: AuthContext, id: string, body: unknown): Promise<ClientAccount> {
    const { reason } = parseOrThrow(clientAccountReasonSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const { client, user } = await this.target(tx, staff, id, true);
      if (!user || user.status !== 'SUSPENDED') throw AppError.conflictState('ACCOUNT_NOT_SUSPENDED');
      // Q-077 — a suspension asked by the deletion of the account is lifted by the client's retraction (PRO-060)
      if (user.suspendedReason !== 'STAFF_DECISION') throw AppError.conflictState('DELETION_PENDING');
      await tx.user.update({ where: { id: user.id }, data: { status: 'ACTIVE', suspendedAt: null, suspendedReason: null, suspendedNote: null, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'client.account_reactivated', entityType: 'Client', entityId: client.id, clientId: client.id, reason });
      await this.outbox.add(tx, this.userEvent('user.reactivated', user.id, client.id, auth.actor, { role: null, previousRole: null }), now);
    });
    return this.account(auth, id);
  }

  // ─── Sessions, second factor, address (CRM-070, AUTH-051, CRM-048) ────────

  /** `POST /admin/clients/{id}/revoke-sessions` (`client.account.manage`) — every device signs out. */
  async revokeSessions(auth: AuthContext, id: string): Promise<ClientAccount & { revoked: number }> {
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    const revoked = await this.prisma.$transaction(async (tx) => {
      const { client, user } = await this.target(tx, staff, id, true);
      if (!user) throw AppError.conflictState('NO_ACCOUNT');
      const n = await this.sessions.revokeAll(user.id, 'ADMIN', null, tx);
      await writeAudit(tx, auth.actor, now, { action: 'client.sessions_revoked', entityType: 'Client', entityId: client.id, clientId: client.id, after: { count: n } });
      return n;
    });
    return { ...(await this.account(auth, id)), revoked };
  }

  /** `POST /admin/clients/{id}/disable-two-factor` (`client.account.manage`, recent password) — after checking who calls. */
  async disableTwoFactor(auth: AuthContext, id: string, body: unknown): Promise<ClientAccount> {
    const { reason } = parseOrThrow(clientAccountReasonSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const { client, user } = await this.target(tx, staff, id, true);
      if (!user || !user.twoFactorEnabled) throw AppError.conflictState('TWO_FACTOR_NOT_ENABLED');
      await this.twoFactor.disable(user.id, tx);
      await writeAudit(tx, auth.actor, now, { action: 'auth.two_factor_reset', entityType: 'User', entityId: user.id, clientId: client.id, reason });
      await this.outbox.add(tx, this.userEvent('user.two_factor_changed', user.id, client.id, auth.actor, { enabled: false, byThirdParty: true }), now);
      // AUTH-051 — the client is told (a change of the account's security never goes unseen)
      await this.mail.request(tx, {
        template: 'C_TWO_FACTOR_CHANGED',
        userId: user.id,
        clientId: client.id,
        to: user.email,
        vars: { action: { stateLabel: t('ui.email.twoFactorState.disabledByTeam') } },
      });
    });
    this.mail.wake();
    return this.account(auth, id);
  }

  /** `POST /admin/clients/{id}/change-email` (`client.account.manage`) — the address changes at its confirmation only. */
  async changeEmail(auth: AuthContext, id: string, body: unknown): Promise<ClientAccount> {
    const { email } = parseOrThrow(clientChangeEmailSchema, body);
    const staff = await this.views.of(auth);
    if (staff.masked) throw new AppError(ErrorCode.FORBIDDEN);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const { client, user } = await this.target(tx, staff, id, true);
      if (!user || (user.status !== 'ACTIVE' && user.status !== 'INVITED')) throw AppError.conflictState('ACCOUNT_NOT_ACTIVE');
      if (email === user.email) throw AppError.validation([{ field: 'email', code: 'UNCHANGED' }]);
      const holder = await tx.user.findUnique({ where: { email }, select: { id: true, status: true } });
      if (holder && holder.status !== 'DELETED' && holder.id !== user.id) throw AppError.validation([{ field: 'email', code: 'ALREADY_USED' }]);
      const other = await clientOwningEmail(tx, email, client.id);
      if (other) throw AppError.validation([{ field: 'email', code: 'ALREADY_USED' }]);
      await tx.user.update({ where: { id: user.id }, data: { pendingEmail: email, updatedAt: now } });
      await this.mail.request(tx, {
        template: 'C_EMAIL_CHANGE_CONFIRM',
        userId: user.id,
        clientId: client.id,
        to: email,
        dedupeKey: `C_EMAIL_CHANGE_CONFIRM:${user.id}:${now.getTime()}`,
        link: { purpose: 'EMAIL_CHANGE', host: 'web', path: LINK_PATHS.emailChange, payload: { newEmail: email } },
      });
      await this.mail.request(tx, { template: 'C_EMAIL_CHANGE_NOTICE', userId: user.id, clientId: client.id, to: user.email, dedupeKey: `C_EMAIL_CHANGE_NOTICE:${user.id}:${now.getTime()}` });
      // SEC-081 — the journal says THAT the address of the account is being changed, never the address itself
      await writeAudit(tx, auth.actor, now, { action: 'client.updated', entityType: 'Client', entityId: client.id, clientId: client.id, after: { changedFields: ['pendingEmail'] } });
    });
    this.mail.wake();
    return this.account(auth, id);
  }

  // ─── « Voir comme le client » (CRM-075, ROL-017) ──────────────────────────

  /** `POST /admin/clients/{id}/preview-code` (`client.impersonate`) — a code of one minute, used once. */
  async previewCode(auth: AuthContext, id: string, body: unknown): Promise<ClientPreviewCode> {
    const { reason } = parseOrThrow(clientPreviewCodeSchema, body ?? {});
    const staff = await this.views.of(auth);
    const { client, user } = await this.target(this.prisma, staff, id, false);
    if (!user || user.status !== 'ACTIVE' || !user.emailVerifiedAt) throw AppError.conflictState('ACCOUNT_NOT_ACTIVE');
    const { token, expiresAt } = await this.tokens.issue({
      purpose: 'CLIENT_PREVIEW',
      userId: user.id,
      email: user.email,
      payload: { clientId: client.id, byUserId: auth.userId, role: auth.role, reason },
    });
    return { url: new URL(`/apercu/${token}`, this.env.WEB_URL).toString(), expiresAt: expiresAt.toISOString() };
  }

  /** `POST /auth/preview/exchange` (anonymous, client space only) — the code becomes the READ-ONLY session. */
  async exchange(req: Request, res: Response, body: unknown): Promise<SessionResponse> {
    tokenPageHeaders(res);
    const parsed = previewExchangeSchema.safeParse(body);
    const row = parsed.success ? await this.tokens.find(parsed.data.code, 'CLIENT_PREVIEW') : null;
    if (!row || !this.tokens.isAlive(row) || !row.userId) throw new AppError(ErrorCode.GONE);
    const p = row.payload as { clientId?: string; byUserId?: string; role?: string | null; reason?: string | null };
    if (!p.byUserId || !p.clientId) throw new AppError(ErrorCode.GONE);
    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, kind: true, email: true, status: true, firstName: true, lastName: true, lastLoginAt: true, locale: true, emailVerifiedAt: true } });
    if (!user || user.kind !== 'CLIENT' || user.status !== 'ACTIVE' || !user.emailVerifiedAt) throw new AppError(ErrorCode.GONE);
    // the member of the team must still be one, and still allowed (a code does not outlive a withdrawn right)
    const staffUser = await this.prisma.user.findUnique({ where: { id: p.byUserId }, select: { status: true, kind: true } });
    if (!staffUser || staffUser.kind !== 'STAFF' || staffUser.status !== 'ACTIVE') throw new AppError(ErrorCode.GONE);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.consume(row, tx))) throw new AppError(ErrorCode.GONE);
      // ROL-017 — the opening is traced; the client is told nothing
      await writeAudit(tx, { type: 'USER', userId: p.byUserId!, role: p.role ?? null, reason: null }, now, { action: 'client.impersonated', entityType: 'Client', entityId: p.clientId!, clientId: p.clientId!, reason: p.reason ?? null });
    });
    return this.sessions.openPreview(req, res, { user: { id: user.id, kind: 'CLIENT', email: user.email, status: user.status, firstName: user.firstName, lastName: user.lastName, lastLoginAt: user.lastLoginAt, locale: user.locale }, byUserId: p.byUserId });
  }

  /** `GET /client/preview` — the client space learns it is a preview (ECL-004): the band and its names. */
  async previewState(auth: AuthContext): Promise<ClientPreviewState> {
    if (!auth.preview) return { active: false, clientName: null, staffName: null, expiresAt: null };
    const staffUser = await this.prisma.user.findUnique({ where: { id: auth.preview.byUserId }, select: { firstName: true, lastName: true } });
    const clientName = [auth.firstName, auth.lastName].filter(Boolean).join(' ') || null;
    const staffName = staffUser ? [staffUser.firstName, staffUser.lastName].filter(Boolean).join(' ') || null : null;
    return { active: true, clientName, staffName, expiresAt: auth.preview.expiresAt.toISOString() };
  }
}
