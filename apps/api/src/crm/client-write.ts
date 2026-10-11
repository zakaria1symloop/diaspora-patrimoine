// CRM-025, CRM-041, MOD-302 — a client record created BY THE TEAM (from « + Créer › Client », or while entering a
// request received outside the site), and the check of coordinates already known. Shared by the requests (package 3.2)
// and the clients (package 3.3): one rule of uniqueness, written once.
//
//   · the e-mail OR the phone is required; a record without e-mail exists only when created here (MOD-302);
//   · an e-mail that belongs to a record — its own address, or one absorbed by a merge (`alternateEmails`, CRM-080) —
//     is refused: the screen offers to open that record instead;
//   · a phone carried by another record is only a warning (MOD-301): the creation goes on;
//   · outside the reader's perimeter (ROL-018) no name is ever given.
import { ErrorCode, type ContactCheck, type StaffClientCreateData } from '@dp/contracts';
import type { Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import { clientName, clientScope, type StaffView } from '../back-office/staff-view.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import type { OutboxWriter } from '../platform/outbox.js';
import type { PrismaService } from '../platform/prisma.service.js';
import { currentRequestId } from '../platform/request-context.js';
import type { Tx } from '../platform/tx.js';

type Db = Tx | PrismaService;

const LIVE = { deletedAt: null, mergedIntoId: null } as const;

/** The live record that owns an address: its e-mail, or an address absorbed by a merge. */
export async function clientOwningEmail(db: Db, email: string, exceptId?: string | null) {
  return db.client.findFirst({
    where: { ...LIVE, ...(exceptId ? { id: { not: exceptId } } : {}), OR: [{ email }, { alternateEmails: { has: email } }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true, firstName: true, lastName: true },
  });
}

/** CRM-041 — what is already known about an e-mail and a phone, as the reader may see it. */
export async function contactCheck(db: Db, staff: StaffView, input: { email?: string | null; phone?: string | null; exceptId?: string | null }): Promise<ContactCheck> {
  const visible = async (id: string) => Boolean(await db.client.findFirst({ where: { AND: [{ id }, clientScope(staff)] }, select: { id: true } }));
  const out: ContactCheck = { email: null, phone: null };
  if (input.email) {
    const owner = await clientOwningEmail(db, input.email, input.exceptId);
    if (!owner) out.email = { state: 'FREE' };
    else if (staff.masked || !(await visible(owner.id))) out.email = { state: 'TAKEN_HIDDEN' };
    else out.email = { state: 'TAKEN', client: { id: owner.id, name: clientName(owner) } };
  }
  if (input.phone) {
    const twin = await db.client.findFirst({
      where: { ...LIVE, archivedAt: null, phone: input.phone, ...(input.exceptId ? { id: { not: input.exceptId } } : {}) },
      orderBy: { createdAt: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!twin) out.phone = { state: 'FREE' };
    else if (staff.masked || !(await visible(twin.id))) out.phone = { state: 'SHARED_HIDDEN' };
    else out.phone = { state: 'SHARED', client: { id: twin.id, name: clientName(twin) } };
  }
  return out;
}

/** The adviser named must be an active OWNER, ADMIN or AGENT account of the operator (CRM-020). */
export async function assertAdvisor(db: Db, userId: string, field = 'assignedAgentId'): Promise<void> {
  const found = await db.membership.findFirst({
    where: { userId, revokedAt: null, suspendedAt: null, role: { in: ['OWNER', 'ADMIN', 'AGENT'] }, organization: { type: 'OPERATOR' }, user: { kind: 'STAFF', status: 'ACTIVE' } },
    select: { id: true },
  });
  if (!found) throw AppError.validation([{ field, code: 'INVALID_CHOICE' }]);
}

export interface CreatedClient {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  assignedAgentId: string | null;
}

/**
 * CRM-041 — creates the record, inside the caller's transaction. Refusals: `422` on `email` with `ALREADY_USED` when
 * the address belongs to a record (params: `clientId` and `clientName` when the reader may see it — CRM-041), `422`
 * `INVALID_CHOICE` for an unknown country or adviser. Audit `client.created`; event `client.created`.
 * `fieldPrefix`: where the fields live in the caller's form (`client.` when the record is created with a request).
 */
export async function createClientByStaff(
  tx: Tx,
  outbox: OutboxWriter,
  staff: StaffView,
  actor: Actor,
  now: Date,
  input: StaffClientCreateData,
  fieldPrefix = '',
): Promise<CreatedClient> {
  const field = (name: string) => `${fieldPrefix}${name}`;
  if (!input.email && !input.phone) throw AppError.validation([{ field: field('email'), code: 'REQUIRED' }]);
  if (input.email) {
    // one creation at a time per address (the public forms take the same lock: `lead:{email}`)
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `lead:${input.email}`);
    const check = await contactCheck(tx, staff, { email: input.email });
    if (check.email && check.email.state !== 'FREE') {
      const owner = check.email.state === 'TAKEN' ? check.email.client : null;
      throw new AppError(ErrorCode.VALIDATION_ERROR, { details: [{ field: field('email'), code: 'ALREADY_USED', params: owner ? { clientId: owner.id, clientName: owner.name ?? '' } : { hidden: 1 } }] });
    }
  }
  if (input.countryOfResidence) {
    const country = await tx.country.findUnique({ where: { code: input.countryOfResidence }, select: { code: true } });
    if (!country) throw AppError.validation([{ field: field('countryOfResidence'), code: 'INVALID_CHOICE' }]);
  }
  if (input.assignedAgentId) await assertAdvisor(tx, input.assignedAgentId, field('assignedAgentId'));

  const id = newId();
  const created = await tx.client.create({
    data: {
      id,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      whatsappOptIn: Boolean(input.phone) && input.whatsappOptIn,
      countryOfResidence: input.countryOfResidence,
      source: input.source,
      assignedAgentId: input.assignedAgentId,
      status: 'PROSPECT',
      lastActivityAt: now,
      createdById: actor.userId,
      updatedById: actor.userId,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, email: true, phone: true, firstName: true, lastName: true, assignedAgentId: true },
  });
  // SEC-081 — the journal names the fields set, never a person's name or coordinates.
  await writeAudit(tx, actor, now, {
    action: 'client.created',
    entityType: 'Client',
    entityId: id,
    clientId: id,
    after: { source: input.source, withEmail: Boolean(input.email), withPhone: Boolean(input.phone), countryOfResidence: input.countryOfResidence, assignedAgentId: input.assignedAgentId },
  });
  await outbox.add(tx, domainEvent({ type: 'client.created', aggregate: { type: 'Client', id }, actor: { type: 'USER', id: actor.userId }, clientId: id, data: { source: input.source }, requestId: currentRequestId() }), now);
  return created;
}
