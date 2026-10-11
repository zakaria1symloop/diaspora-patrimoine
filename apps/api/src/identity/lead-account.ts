// DEM-021, NOT-024, CYC-200 — « Créer mon espace client en même temps »: hooks used by the request forms (leads module).
// At the request's transaction: an INVITED account for a record without one. At the acknowledgement's sending: the link
// the e-mail carries (activation for an INVITED account, verification for an unconfirmed sign-up), minted then (NOT-010).
import { newId } from '../platform/ids.js';
import type { Tx } from '../platform/tx.js';
import type { PrismaService } from '../platform/prisma.service.js';
import type { TokensService } from './tokens.service.js';

interface ClientForAccount {
  id: string;
  userId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  timezone: string | null;
  preferredLanguage: 'fr' | 'ar' | 'en';
}

/** Creates the INVITED account of a record that has none (and no account holds the address). Returns its id or null. */
export async function ensureInvitedAccount(tx: Tx, client: ClientForAccount, now: Date, reason: 'LEAD' | 'STAFF' = 'LEAD'): Promise<string | null> {
  if (!client.email) return null;
  if (client.userId) {
    const linked = await tx.user.findUnique({ where: { id: client.userId }, select: { status: true } });
    if (linked && linked.status !== 'DELETED') return null;
  }
  const holder = await tx.user.findUnique({ where: { email: client.email }, select: { id: true } });
  if (holder) return null; // an account of any kind already uses it (ROL-003): nothing to create
  const userId = newId();
  await tx.user.create({
    data: {
      id: userId,
      kind: 'CLIENT',
      email: client.email,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      locale: client.preferredLanguage,
      timezone: client.timezone ?? 'Europe/Paris',
      status: 'INVITED',
      createdAt: now,
      updatedAt: now,
    },
  });
  await tx.client.update({ where: { id: client.id }, data: { userId, updatedAt: now } });
  await tx.outboxEvent.create({
    data: { id: newId(), type: 'client.account_invited', aggregateType: 'Client', aggregateId: client.id, payload: { reason } as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now },
  });
  return userId;
}

/**
 * DEM-021 — the `action` fields of an acknowledgement: `hasAccount` for an active and verified account (« connectez-vous »),
 * else a `secrets` function minting, at sending time, the activation link (INVITED; earlier links stay valid, MOD-105)
 * or the verification link (unconfirmed sign-up, AUTH-013).
 */
export async function accountLinkForAck(
  prisma: PrismaService,
  tokens: TokensService,
  webUrl: string,
  email: string,
): Promise<{ hasAccount: boolean; secrets?: () => Promise<{ action: { url: string } }> }> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, kind: true, status: true, emailVerifiedAt: true } });
  if (!user || user.kind !== 'CLIENT') return { hasAccount: false };
  if (user.status === 'ACTIVE' && user.emailVerifiedAt) return { hasAccount: true };
  if (user.status === 'INVITED') {
    return {
      hasAccount: false,
      secrets: async () => {
        const { token } = await tokens.issue({ purpose: 'ACCOUNT_ACTIVATION', userId: user.id, email, payload: { fromSignup: false, next: null } });
        return { action: { url: new URL(`/activation/${token}`, webUrl).toString() } };
      },
    };
  }
  if (user.status === 'ACTIVE' && !user.emailVerifiedAt) {
    return {
      hasAccount: false,
      secrets: async () => {
        const { token } = await tokens.issue({ purpose: 'EMAIL_VERIFICATION', userId: user.id, email, payload: { next: null } });
        return { action: { url: new URL(`/verification/${token}`, webUrl).toString() } };
      },
    };
  }
  return { hasAccount: false };
}
