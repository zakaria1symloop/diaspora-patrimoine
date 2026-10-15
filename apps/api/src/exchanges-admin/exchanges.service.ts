// Package 3.2 « Échanges » — CRM-030, CRM-031, COM-030, MOD-400, CYC-004. What is noted by hand on a request, a client
// or a dossier: a call (direction, outcome, moment, duration, report, the follow-up « Me rappeler de… »), a WhatsApp
// exchange, a meeting, an e-mail received (COM-030). Each write is ONE transaction (FIA-001) that ends with
// `syncFirstContact` (crm/first-contact.ts): the first contact is set — and RECOMPUTED after a correction or a
// deletion (CYC-004). « Faux numéro » marks the record (`phoneCheckNeeded`). A report is corrected or deleted by its
// author within 24 hours (MOD-400). Audit: generic codes (`communication.created|updated|deleted`), never the text.
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode, EXCHANGE_EDIT_HOURS, exchangeCreateSchema, exchangeUpdateSchema, receivedEmailSchema, type ExchangeResult } from '@dp/contracts';
import type { Actor } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent } from '../automation/event-catalogue.js';
import { TasksService } from '../automation/tasks.service.js';
import { zonedDayStart } from '../back-office/leads-admin.service.js';
import { clientScope, dossierScope, leadScope, StaffViews, type StaffView } from '../back-office/staff-view.js';
import { syncFirstContact } from '../crm/first-contact.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { currentRequestId } from '../platform/request-context.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { EmailAttachmentsService, type StoredAttachment } from './email-attachments.service.js';

export interface ExchangeTargetIds {
  leadId: string | null;
  clientId: string | null;
  dossierId: string | null;
}

/**
 * The object an exchange hangs on, within the caller's perimeter (else 404): a request gives its client and its
 * dossier; a dossier its client. A partner application has no client: the exchange hangs on the request alone.
 */
export async function resolveTarget(db: Tx | PrismaService, staff: StaffView, input: ExchangeTargetIds): Promise<ExchangeTargetIds> {
  let { leadId, clientId, dossierId } = input;
  if (leadId) {
    const lead = await db.lead.findFirst({ where: { AND: [{ id: leadId }, leadScope(staff)] }, select: { id: true, clientId: true, dossierId: true, contextDossierId: true } });
    if (!lead) throw AppError.notFound();
    clientId = clientId ?? lead.clientId;
    dossierId = dossierId ?? lead.dossierId ?? lead.contextDossierId;
    if (input.clientId && lead.clientId && input.clientId !== lead.clientId) throw AppError.validation([{ field: 'clientId', code: 'INVALID_CHOICE' }]);
  }
  if (dossierId) {
    const dossier = await db.dossier.findFirst({ where: { AND: [{ id: dossierId, deletedAt: null }, dossierScope(staff)] }, select: { clientId: true } });
    if (!dossier) throw AppError.notFound();
    if (clientId && clientId !== dossier.clientId) throw AppError.validation([{ field: 'dossierId', code: 'INVALID_CHOICE' }]);
    clientId = dossier.clientId;
  }
  if (clientId && !leadId) {
    const client = await db.client.findFirst({ where: { AND: [{ id: clientId, deletedAt: null }, clientScope(staff)] }, select: { id: true } });
    if (!client) throw AppError.notFound();
  }
  return { leadId, clientId, dossierId };
}

@Injectable()
export class ExchangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly views: StaffViews,
    private readonly outbox: OutboxWriter,
    private readonly tasks: TasksService,
    private readonly files: EmailAttachmentsService,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  private requestId(): string | null {
    const id = currentRequestId();
    return id === 'req_none' ? null : id;
  }

  /** « Maintenant », by default; never in the future (a minute of tolerance for the clocks). */
  private moment(value: string | null, now: Date, field = 'occurredAt'): Date {
    if (!value) return now;
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) throw AppError.validation([{ field, code: 'INVALID_DATE' }]);
    if (at.getTime() > now.getTime() + 60_000) throw AppError.validation([{ field, code: 'DATE_IN_FUTURE' }]);
    return at;
  }

  private async afterWrite(tx: Tx, actor: Actor, now: Date, target: ExchangeTargetIds) {
    if (target.clientId) await tx.client.update({ where: { id: target.clientId }, data: { lastActivityAt: now } });
    if (target.dossierId) await tx.dossier.updateMany({ where: { id: target.dossierId }, data: { lastActivityAt: now } });
    return syncFirstContact(tx, this.outbox, { leadIds: target.leadId ? [target.leadId] : [], clientId: target.clientId, actor, now });
  }

  /** `POST /admin/communications` (`communication.log`) — a call, a WhatsApp exchange, a meeting. */
  async create(auth: AuthContext, body: unknown): Promise<ExchangeResult> {
    const input = parseOrThrow(exchangeCreateSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    const occurredAt = this.moment(input.occurredAt, now);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { timezone: true } });
    const result = await this.prisma.$transaction(async (tx) => {
      const target = await resolveTarget(tx, staff, input);
      const id = newId();
      const isCall = input.channel === 'CALL';
      await tx.communication.create({
        data: {
          id,
          channel: input.channel,
          direction: input.direction,
          leadId: target.leadId,
          clientId: target.clientId,
          dossierId: target.dossierId,
          callOutcome: isCall ? input.callOutcome : null,
          durationMinutes: input.durationMinutes,
          body: input.body,
          deliveryState: null,
          triggeredBy: 'MANUAL',
          sentById: auth.userId,
          staffUserId: auth.userId,
          occurredAt,
          ccAddresses: [],
          createdAt: now,
          updatedAt: now,
        },
      });
      if (isCall && input.callOutcome === 'WRONG_NUMBER' && target.clientId) {
        await tx.client.update({ where: { id: target.clientId }, data: { phoneCheckNeeded: true, version: { increment: 1 }, updatedAt: now } });
      }
      let taskId: string | null = null;
      if (input.followUp) {
        const dueAt = input.followUp.dueTime
          ? new Date(zonedDayStart(input.followUp.dueDate, user.timezone).getTime() + (Number(input.followUp.dueTime.slice(0, 2)) * 60 + Number(input.followUp.dueTime.slice(3))) * 60_000)
          : zonedDayStart(input.followUp.dueDate, user.timezone);
        const task = await this.tasks.create(tx, auth.actor, now, {
          title: input.followUp.title,
          type: 'CALL',
          assigneeId: auth.userId,
          dueAt,
          dueHasTime: Boolean(input.followUp.dueTime),
          timeZone: user.timezone,
          origin: 'MANUAL',
          links: { leadId: target.leadId, clientId: target.clientId, dossierId: target.dossierId },
        });
        taskId = task.id;
      }
      await writeAudit(tx, auth.actor, now, { action: 'communication.created', entityType: 'Communication', entityId: id, clientId: target.clientId, after: { channel: input.channel, direction: input.direction, callOutcome: input.callOutcome, leadId: target.leadId, dossierId: target.dossierId } });
      if (isCall) {
        await this.outbox.add(
          tx,
          domainEvent({ type: 'communication.call_logged', aggregate: { type: 'Communication', id }, actor: { type: 'USER', id: auth.userId }, clientId: target.clientId, dossierId: target.dossierId, data: { direction: input.direction, callOutcome: input.callOutcome, leadId: target.leadId, dossierId: target.dossierId }, requestId: this.requestId() }),
          now,
        );
      }
      const sync = await this.afterWrite(tx, auth.actor, now, target);
      return { id, taskId, sync };
    });
    this.dispatcher.wake();
    return { id: result.id, taskId: result.taskId, firstContact: { leadIds: result.sync.leads.filter((l) => l.firstContactAt).map((l) => l.id), closedLeadIds: result.sync.leads.filter((l) => l.closed).map((l) => l.id) } };
  }

  /** The exchange, locked, if the caller is its author and it is younger than 24 hours (MOD-400). */
  private async editable(tx: Tx, staff: StaffView, id: string, now: Date) {
    await tx.$queryRawUnsafe(`SELECT id FROM communications WHERE id = $1::uuid FOR UPDATE`, id);
    const row = await tx.communication.findUnique({ where: { id }, select: { id: true, channel: true, direction: true, callOutcome: true, durationMinutes: true, occurredAt: true, body: true, leadId: true, clientId: true, dossierId: true, sentById: true, createdAt: true } });
    if (!row || row.channel === 'EMAIL' || row.channel === 'SMS') throw AppError.notFound();
    await resolveTarget(tx, staff, { leadId: row.leadId, clientId: row.leadId ? null : row.clientId, dossierId: row.leadId ? null : row.dossierId });
    if (row.sentById !== staff.userId) throw new AppError(ErrorCode.FORBIDDEN);
    if (now.getTime() - row.createdAt.getTime() > EXCHANGE_EDIT_HOURS * 3600_000) throw AppError.conflictState('EXCHANGE_EDIT_EXPIRED');
    return row;
  }

  /** `PATCH /admin/communications/{id}` — its author, within 24 hours; the first contact is recomputed. */
  async update(auth: AuthContext, id: string, body: unknown): Promise<ExchangeResult> {
    const input = parseOrThrow(exchangeUpdateSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    const result = await this.prisma.$transaction(async (tx) => {
      const row = await this.editable(tx, staff, id, now);
      const isCall = row.channel === 'CALL';
      const outcome = isCall ? input.callOutcome : null;
      if (isCall && !outcome) throw AppError.validation([{ field: 'callOutcome', code: 'REQUIRED' }]);
      if (!input.body && (!isCall || outcome === 'REACHED')) throw AppError.validation([{ field: 'body', code: 'REQUIRED' }]);
      const occurredAt = input.occurredAt ? this.moment(input.occurredAt, now) : row.occurredAt;
      await tx.communication.update({ where: { id }, data: { direction: input.direction, callOutcome: outcome, occurredAt, durationMinutes: input.durationMinutes, body: input.body, updatedAt: now } });
      if (outcome === 'WRONG_NUMBER' && row.callOutcome !== 'WRONG_NUMBER' && row.clientId) await tx.client.update({ where: { id: row.clientId }, data: { phoneCheckNeeded: true, version: { increment: 1 }, updatedAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'communication.updated', entityType: 'Communication', entityId: id, clientId: row.clientId, before: { callOutcome: row.callOutcome, occurredAt: row.occurredAt, direction: row.direction }, after: { callOutcome: outcome, occurredAt, direction: input.direction } });
      return this.afterWrite(tx, auth.actor, now, row);
    });
    this.dispatcher.wake();
    return { id, taskId: null, firstContact: { leadIds: result.leads.filter((l) => l.firstContactAt).map((l) => l.id), closedLeadIds: result.leads.filter((l) => l.closed).map((l) => l.id) } };
  }

  /** `DELETE /admin/communications/{id}` — its author, within 24 hours; the first contact is recomputed (CYC-004). */
  async remove(auth: AuthContext, id: string): Promise<void> {
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const row = await this.editable(tx, staff, id, now);
      await tx.communication.delete({ where: { id } });
      await writeAudit(tx, auth.actor, now, { action: 'communication.deleted', entityType: 'Communication', entityId: id, clientId: row.clientId, before: { channel: row.channel, callOutcome: row.callOutcome, occurredAt: row.occurredAt } });
      await this.afterWrite(tx, auth.actor, now, row);
    });
    this.dispatcher.wake();
  }

  /** `POST /admin/communications/received-email` — COM-030: an incoming e-mail kept as a trace (it is not a first contact). */
  async receivedEmail(auth: AuthContext, body: unknown): Promise<{ id: string }> {
    const input = parseOrThrow(receivedEmailSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    const occurredAt = this.moment(input.occurredAt, now);
    const id = newId();
    let attachments: StoredAttachment[] | null = null;
    await this.prisma.$transaction(async (tx) => {
      const target = await resolveTarget(tx, staff, input);
      attachments = await this.files.claim(tx, auth.userId, input.attachmentIds, id, now); // COM-030 « fichiers éventuels »
      await tx.communication.create({
        data: { id, channel: 'EMAIL', direction: 'INBOUND', attachments: (attachments ?? undefined) as never, leadId: target.leadId, clientId: target.clientId, dossierId: target.dossierId, subject: input.subject, body: input.body, deliveryState: 'DELIVERED' /* Q-101: an e-mail row always has a state (check constraint); a received one has arrived */, triggeredBy: 'MANUAL', sentById: auth.userId, staffUserId: auth.userId, occurredAt, ccAddresses: [], createdAt: now, updatedAt: now },
      });
      if (target.clientId) await tx.client.update({ where: { id: target.clientId }, data: { lastActivityAt: now } });
      await writeAudit(tx, auth.actor, now, { action: 'communication.created', entityType: 'Communication', entityId: id, clientId: target.clientId, after: { channel: 'EMAIL', direction: 'INBOUND', leadId: target.leadId, attachments: attachments?.length ?? 0 } });
    });
    await this.files.dropTemporary(attachments);
    return { id };
  }

  /**
   * `GET /admin/communications/{id}/attachments/{uploadId}` — MED-030: a link of 5 minutes to one file of an e-mail the
   * reader may see (its request, client or dossier in his perimeter). Personal files: never to a masked reader (ROL-015).
   */
  async attachmentLink(auth: AuthContext, id: string, uploadId: string): Promise<{ url: string; expiresAt: string }> {
    const staff = await this.views.of(auth);
    if (staff.masked) throw new AppError(ErrorCode.FORBIDDEN);
    const row = await this.prisma.communication.findFirst({ where: { id }, select: { leadId: true, clientId: true, dossierId: true, attachments: true } });
    if (!row || (!row.leadId && !row.clientId && !row.dossierId)) throw AppError.notFound();
    await resolveTarget(this.prisma, staff, { leadId: row.leadId, clientId: row.leadId ? null : row.clientId, dossierId: row.leadId ? null : row.dossierId });
    return this.files.link(row.attachments, uploadId);
  }
}
