// NOT-018, AUT-032, AUT-033 — who, in the team, receives a notification or a task. « The advisor » of an object is its
// `assignedAgentId`; when it is empty, or when that account cannot act (suspended, deleted, a role that is no longer an
// advisor's), what was meant for him goes to the active OWNER and ADMIN accounts — what is entrusted to someone who is
// no longer there always reaches someone. An absent advisor (CRM-021) still receives, and the administrators too.
import { Injectable } from '@nestjs/common';
import type { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import type { StaffRecipientRef } from './rule-definition.js';

export type StaffRole = 'OWNER' | 'ADMIN' | 'AGENT' | 'VIEWER' | 'SUPPORT';
export const ADVISOR_ROLES: readonly StaffRole[] = ['OWNER', 'ADMIN', 'AGENT'];

export interface StaffMember {
  userId: string;
  role: StaffRole;
  email: string;
  firstName: string | null;
  lastName: string | null;
  timezone: string;
  /** `Membership.absentUntil` (a date, CRM-021). */
  absentUntil: Date | null;
}

type Db = Tx | PrismaService;

/** The agent ids the references of a rule may point at, read from the objects of the event. */
export interface AgentIds {
  DOSSIER_AGENT: string | null;
  LEAD_AGENT: string | null;
  CLIENT_AGENT: string | null;
  APPOINTMENT_AGENT: string | null;
  EVENT_HOST: string | null;
}

export const ROLE_GROUPS: Readonly<Record<'ADMINS' | 'OWNERS' | 'ALL_AGENTS' | 'SUPPORT', readonly StaffRole[]>> = {
  ADMINS: ['OWNER', 'ADMIN'],
  OWNERS: ['OWNER'],
  ALL_AGENTS: ['OWNER', 'ADMIN', 'AGENT'],
  SUPPORT: ['SUPPORT'],
};

export class StaffSnapshot {
  private readonly byId: Map<string, StaffMember>;

  constructor(
    readonly members: readonly StaffMember[],
    private readonly today: string,
  ) {
    this.byId = new Map(members.map((m) => [m.userId, m]));
  }

  get(userId: string | null | undefined): StaffMember | null {
    return userId ? (this.byId.get(userId) ?? null) : null;
  }

  withRoles(roles: readonly StaffRole[]): StaffMember[] {
    return this.members.filter((m) => roles.includes(m.role));
  }

  /** NOT-018 — an active account whose role is an advisor's. */
  canAct(userId: string | null | undefined): boolean {
    const m = this.get(userId);
    return m !== null && ADVISOR_ROLES.includes(m.role);
  }

  /** CRM-021 — absent today (`absentUntil` is the last day of the absence). */
  isAbsent(userId: string, until?: Date | null): boolean {
    const m = this.get(userId);
    if (!m?.absentUntil) return false;
    const last = m.absentUntil.toISOString().slice(0, 10);
    return last >= (until ? until.toISOString().slice(0, 10) : this.today);
  }

  /**
   * AUT-033 — the accounts a list of references reaches, each once. An advisor who cannot act is replaced by
   * `fallback` (ADMINS by default); an absent one receives, and the ADMINS too (NOT-018).
   */
  resolve(refs: readonly StaffRecipientRef[], agents: AgentIds, fallback: readonly StaffRecipientRef[] = ['ADMINS']): StaffMember[] {
    const out = new Map<string, StaffMember>();
    const add = (list: readonly StaffMember[]) => list.forEach((m) => out.set(m.userId, m));
    const group = (ref: StaffRecipientRef) => (ref in ROLE_GROUPS ? this.withRoles(ROLE_GROUPS[ref as keyof typeof ROLE_GROUPS]) : []);
    let missingAgent = false;
    let reachedAgent = false;
    for (const ref of refs) {
      if (ref in ROLE_GROUPS) {
        add(group(ref));
        continue;
      }
      const id = agents[ref as keyof AgentIds];
      if (id && this.canAct(id)) {
        reachedAgent = true;
        add([this.get(id)!]);
        if (this.isAbsent(id)) add(this.withRoles(ROLE_GROUPS.ADMINS));
      } else missingAgent = true;
    }
    // « à défaut »: only when no advisor named by the rule could be reached.
    if (missingAgent && !reachedAgent) {
      for (const ref of fallback) {
        if (ref in ROLE_GROUPS) add(group(ref));
        else {
          const id = agents[ref as keyof AgentIds];
          if (id && this.canAct(id)) add([this.get(id)!]);
        }
      }
      if (out.size === 0) add(this.withRoles(ROLE_GROUPS.ADMINS));
    }
    return [...out.values()];
  }
}

@Injectable()
export class StaffDirectory {
  /** Active accounts of the operator (a suspended account receives nothing, NOT-018). */
  async load(db: Db, now: Date): Promise<StaffSnapshot> {
    const rows = await db.membership.findMany({
      where: { revokedAt: null, suspendedAt: null, organization: { type: 'OPERATOR' }, user: { kind: 'STAFF', status: 'ACTIVE' } },
      select: { userId: true, role: true, absentUntil: true, user: { select: { email: true, firstName: true, lastName: true, timezone: true } } },
    });
    return new StaffSnapshot(
      rows.map((r) => ({ userId: r.userId, role: r.role as StaffRole, email: r.user.email, firstName: r.user.firstName, lastName: r.user.lastName, timezone: r.user.timezone, absentUntil: r.absentUntil })),
      now.toISOString().slice(0, 10),
    );
  }
}
