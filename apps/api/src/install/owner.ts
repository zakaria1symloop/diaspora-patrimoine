// PAR-080, ADM-040, ROL-010 — the first Direction account: created INVITED (never with a password), membership OWNER of
// the operator organisation, its invitation sent by e-mail (S_INVITATION, 7 days). Shared by the installation command
// (SEED_OWNER_* variables) and the operations command (`pnpm ops owner:invite`).
import type { Prisma } from '../generated/prisma/client.js';
import { newId } from '../platform/ids.js';

type Tx = Prisma.TransactionClient;

export interface OwnerInput {
  email: string;
  firstName: string;
  lastName: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseOwner(input: { email?: string; firstName?: string; lastName?: string }): OwnerInput {
  const email = (input.email ?? '').trim().toLowerCase();
  const firstName = (input.firstName ?? '').trim().replace(/\s+/g, ' ');
  const lastName = (input.lastName ?? '').trim().replace(/\s+/g, ' ');
  if (!EMAIL_RE.test(email) || email.length > 254) throw new Error('Adresse e-mail invalide.');
  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80) throw new Error('Prénom et nom obligatoires (80 caractères au plus).');
  return { email, firstName, lastName };
}

/** True when a Direction account (active or invited) already exists. */
export async function ownerExists(tx: Tx): Promise<boolean> {
  const m = await tx.membership.findFirst({
    where: { role: 'OWNER', revokedAt: null, organization: { type: 'OPERATOR' }, user: { status: { in: ['ACTIVE', 'INVITED', 'SUSPENDED'] } } },
    select: { id: true },
  });
  return Boolean(m);
}

/**
 * Creates the invited OWNER and the outbox event that sends its invitation (the token is minted when the e-mail leaves,
 * NOT-010). Returns the user id. Refuses an address already used by any account (ROL-003).
 */
export async function createInvitedOwner(tx: Tx, input: OwnerInput, now: Date, reason: string): Promise<string> {
  const org = await tx.organization.findFirst({ where: { type: 'OPERATOR' }, select: { id: true } });
  if (!org) throw new Error("L'organisation Diaspora Patrimoine n'existe pas : lancez d'abord l'installation.");
  const taken = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (taken) throw new Error('Cette adresse est déjà utilisée par un compte.');
  const userId = newId();
  await tx.user.create({
    data: { id: userId, kind: 'STAFF', email: input.email, firstName: input.firstName, lastName: input.lastName, status: 'INVITED', locale: 'fr', createdAt: now, updatedAt: now },
  });
  await tx.membership.create({
    data: { id: newId(), userId, organizationId: org.id, role: 'OWNER', invitedAt: now, receivesLeads: false, createdAt: now, updatedAt: now },
  });
  await tx.auditLog.create({
    data: { id: newId(), actorType: 'SYSTEM', action: 'user.invited', entityType: 'User', entityId: userId, after: { role: 'OWNER' } as never, reason, createdAt: now },
  });
  await tx.outboxEvent.create({
    data: { id: newId(), type: 'user.invited', aggregateType: 'User', aggregateId: userId, payload: { role: 'OWNER', previousRole: null } as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now },
  });
  return userId;
}

/** The S_INVITATION request (the auth mail handler mints the link at sending time). */
export function invitationRequest(userId: string, email: string, roleLabel: string) {
  return {
    template: 'S_INVITATION',
    userId,
    to: email,
    link: { purpose: 'STAFF_INVITATION' as const, host: 'admin' as const, path: '/invitation/{token}' },
    vars: { action: { roleLabel }, actor: { fullName: null } },
  };
}
