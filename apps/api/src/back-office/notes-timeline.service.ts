// BO-050, BO-051, BO-055 — internal notes (`Note`) and the timeline of an object.
// Notes: 5 000 characters at most; read `note.read`, write `note.manage`; only the author changes or deletes his note,
// deleting a colleague's asks `note.moderate`; anyone who writes may pin one on top. A note is NEVER visible to the
// client (ROL-031). The object a note hangs on must be visible to the reader (ROL-018): outside his perimeter, 404.
// Timeline: the thread of what happened, most recent first, twenty entries per page (cursor). It gives no more rights
// than its sources: an entry appears only when the reader holds the permission of its type — filtered by the server,
// without an empty line nor a counter (ROL-019). Delivered sources (requests, package 3.1): the request itself, its
// supplements, the audit rows `lead.*`, the e-mails and logged exchanges, the notes. The other objects join with their
// screens (clients 3.3, dossiers 3.7).
import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  noteCreateSchema,
  notePinSchema,
  noteUpdateSchema,
  TIMELINE_TYPES,
  type AdminTimelineEntry,
  type AdminTimelinePage,
  type NoteEntity,
  type NoteItem,
  type Permission,
  type TimelineType,
} from '@dp/contracts';
import { writeAudit } from '../admin/audit.js';
import { COMMUNICATION_ENTRY_SELECT, communicationEntries } from '../crm/communication-entries.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { clientScope, dossierScope, leadScope, staffName, StaffViews, type StaffView } from './staff-view.js';

const PAGE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The read permission of the object a note hangs on. */
const ENTITY_READ: Record<NoteEntity, Permission> = {
  CLIENT: 'client.read',
  LEAD: 'lead.read',
  DOSSIER: 'dossier.read',
  SUBMISSION: 'submission.read',
  PROMOTER: 'promoter.read',
  BANK: 'bank.read',
  PROGRAM: 'catalogue.read',
  PROPERTY: 'catalogue.read',
  EVENT: 'event.read',
};

type NoteRow = { id: string; body: string; isPinned: boolean; authorId: string; createdAt: Date; updatedAt: Date; author: { firstName: string | null; lastName: string | null; status: string } };

@Injectable()
export class NotesTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly views: StaffViews,
  ) {}

  // ─── Visibility of the object ─────────────────────────────────────────────

  /** 403 without the read permission of the object; 404 when it does not exist or lies outside the reader's perimeter. */
  private async assertVisible(staff: StaffView, entityType: NoteEntity, entityId: string): Promise<void> {
    if (!staff.has(ENTITY_READ[entityType])) throw new AppError(ErrorCode.FORBIDDEN);
    const p = this.prisma;
    let found: { id: string } | null;
    switch (entityType) {
      case 'LEAD':
        found = await p.lead.findFirst({ where: { AND: [{ id: entityId }, leadScope(staff)] }, select: { id: true } });
        break;
      case 'CLIENT':
        found = await p.client.findFirst({ where: { AND: [{ id: entityId, deletedAt: null }, clientScope(staff)] }, select: { id: true } });
        break;
      case 'DOSSIER':
        found = await p.dossier.findFirst({ where: { AND: [{ id: entityId, deletedAt: null }, dossierScope(staff)] }, select: { id: true } });
        break;
      case 'SUBMISSION':
        found = await p.bankSubmission.findFirst({ where: { id: entityId, dossier: { AND: [{ deletedAt: null }, dossierScope(staff)] } }, select: { id: true } });
        break;
      case 'PROMOTER':
        found = await p.promoter.findFirst({ where: { id: entityId, deletedAt: null }, select: { id: true } });
        break;
      case 'BANK':
        found = await p.bank.findFirst({ where: { id: entityId, deletedAt: null }, select: { id: true } });
        break;
      case 'PROGRAM':
        found = await p.program.findFirst({ where: { id: entityId, deletedAt: null }, select: { id: true } });
        break;
      case 'PROPERTY':
        found = await p.property.findFirst({ where: { id: entityId, deletedAt: null }, select: { id: true } });
        break;
      default:
        found = await p.event.findFirst({ where: { id: entityId, deletedAt: null }, select: { id: true } });
    }
    if (!found) throw AppError.notFound();
  }

  // ─── Notes (BO-055) ───────────────────────────────────────────────────────

  private note(row: NoteRow, staff: StaffView): NoteItem {
    const mine = row.authorId === staff.userId;
    const canWrite = staff.has('note.manage');
    return {
      id: row.id,
      body: row.body,
      pinned: row.isPinned,
      authorName: staffName(row.author),
      createdAt: row.createdAt.toISOString(),
      editedAt: row.updatedAt.getTime() - row.createdAt.getTime() > 1000 ? row.updatedAt.toISOString() : null,
      canEdit: mine && canWrite,
      canDelete: (mine && canWrite) || staff.has('note.moderate'),
    };
  }

  private readonly include = { author: { select: { firstName: true, lastName: true, status: true } } } as const;

  /** `GET /admin/notes?entityType=&entityId=` (`note.read`) — pinned first, then the most recent. */
  async list(auth: AuthContext, query: { entityType?: unknown; entityId?: unknown }): Promise<{ data: NoteItem[] }> {
    const staff = await this.views.of(auth);
    const parsed = noteCreateSchema.pick({ entityType: true, entityId: true }).safeParse(query);
    if (!parsed.success) throw new AppError(ErrorCode.BAD_REQUEST);
    await this.assertVisible(staff, parsed.data.entityType, parsed.data.entityId);
    const rows = await this.prisma.note.findMany({ where: { entityType: parsed.data.entityType, entityId: parsed.data.entityId, deletedAt: null }, include: this.include, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], take: 200 });
    return { data: rows.map((r) => this.note(r, staff)) };
  }

  /** `POST /admin/notes` (`note.manage`). */
  async create(auth: AuthContext, body: unknown): Promise<NoteItem> {
    const staff = await this.views.of(auth);
    const input = parseOrThrow(noteCreateSchema, body);
    await this.assertVisible(staff, input.entityType, input.entityId);
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.note.create({ data: { id: newId(), entityType: input.entityType, entityId: input.entityId, body: input.body, authorId: auth.userId, createdById: auth.userId, updatedById: auth.userId, createdAt: now, updatedAt: now }, include: this.include });
      // SEC-081 — the journal keeps the fact, never the text of the note
      await writeAudit(tx, auth.actor, now, { action: 'note.created', entityType: 'Note', entityId: created.id, after: { entityType: input.entityType, entityId: input.entityId } });
      return created;
    });
    return this.note(row, staff);
  }

  private async own(auth: AuthContext, id: string): Promise<{ staff: StaffView; row: NoteRow & { entityType: NoteEntity; entityId: string } }> {
    if (!UUID.test(id)) throw AppError.notFound();
    const staff = await this.views.of(auth);
    const row = await this.prisma.note.findFirst({ where: { id, deletedAt: null }, include: this.include });
    if (!row) throw AppError.notFound();
    await this.assertVisible(staff, row.entityType as NoteEntity, row.entityId);
    return { staff, row: row as never };
  }

  /** `PATCH /admin/notes/{id}` (`note.manage`) — only the author changes his note. */
  async update(auth: AuthContext, id: string, body: unknown): Promise<NoteItem> {
    const input = parseOrThrow(noteUpdateSchema, body);
    const { staff, row } = await this.own(auth, id);
    if (row.authorId !== auth.userId) throw new AppError(ErrorCode.FORBIDDEN);
    const now = this.clock.now();
    const next = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.note.update({ where: { id }, data: { body: input.body, updatedById: auth.userId, updatedAt: now }, include: this.include });
      await writeAudit(tx, auth.actor, now, { action: 'note.updated', entityType: 'Note', entityId: id, after: { entityType: row.entityType, entityId: row.entityId } });
      return updated;
    });
    return this.note(next, staff);
  }

  /** `POST /admin/notes/{id}/pin` (`note.manage`) — anyone who writes may pin a note on top. */
  async pin(auth: AuthContext, id: string, body: unknown): Promise<NoteItem> {
    const { pinned } = parseOrThrow(notePinSchema, body);
    const { staff, row } = await this.own(auth, id);
    // `updatedAt` is left alone: pinning is not an edit of the text
    const next = await this.prisma.note.update({ where: { id }, data: { isPinned: pinned }, include: this.include });
    await writeAudit(this.prisma as never, auth.actor, this.clock.now(), { action: 'note.updated', entityType: 'Note', entityId: id, before: { isPinned: row.isPinned }, after: { isPinned: pinned } });
    return this.note(next, staff);
  }

  /** `DELETE /admin/notes/{id}` — the author (`note.manage`), or `note.moderate` for a colleague's. Logical deletion (TRV-096). */
  async remove(auth: AuthContext, id: string): Promise<void> {
    const { staff, row } = await this.own(auth, id);
    const mine = row.authorId === auth.userId && staff.has('note.manage');
    if (!mine && !staff.has('note.moderate')) throw new AppError(ErrorCode.FORBIDDEN);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.note.update({ where: { id }, data: { deletedAt: now, updatedById: auth.userId } });
      await writeAudit(tx, auth.actor, now, { action: 'note.deleted', entityType: 'Note', entityId: id, after: { entityType: row.entityType, entityId: row.entityId, byModerator: !mine } });
    });
  }

  // ─── Timeline of a request (BO-050; route `leads/{id}/timeline`) ──────────

  /** `GET /admin/leads/{id}/timeline?before=&type=` (`lead.read`) — cursor pagination, filter by type of entry. */
  async leadTimeline(auth: AuthContext, id: string, query: { before?: unknown; type?: unknown }): Promise<AdminTimelinePage> {
    const staff = await this.views.of(auth);
    const lead = await this.prisma.lead.findFirst({
      where: { AND: [{ id }, leadScope(staff)] },
      select: { id: true, createdAt: true, kind: true, source: true, supplements: true, createdBy: { select: { firstName: true, lastName: true, status: true } } },
    });
    if (!lead) throw AppError.notFound();

    const wanted = typeof query.type === 'string' && query.type ? new Set(query.type.split(',').filter((t): t is TimelineType => (TIMELINE_TYPES as readonly string[]).includes(t))) : null;
    const want = (t: TimelineType) => !wanted || wanted.has(t);
    let before: Date | null = null;
    if (typeof query.before === 'string' && query.before) {
      before = new Date(query.before);
      if (Number.isNaN(before.getTime())) throw new AppError(ErrorCode.BAD_REQUEST);
    }
    const until = before ? { lt: before } : undefined;
    const entries: AdminTimelineEntry[] = [];
    const system = { kind: 'SYSTEM' as const, name: null };
    const staffAuthor = (u: { firstName: string | null; lastName: string | null; status: string } | null | undefined) => (u ? { kind: 'STAFF' as const, name: staffName(u) } : system);

    // The request itself and what the person added afterwards (source: `Lead`).
    if (want('LEAD')) {
      if (!before || lead.createdAt < before) {
        entries.push({
          id: `lead:${lead.id}`,
          type: 'LEAD',
          code: 'lead.received',
          params: { kind: lead.kind, source: lead.source },
          author: lead.createdBy ? staffAuthor(lead.createdBy) : { kind: 'CLIENT', name: null },
          at: lead.createdAt.toISOString(),
          detail: null,
        });
      }
      const supplements = (lead.supplements as { receivedAt: string }[] | null) ?? [];
      supplements.forEach((s, i) => {
        if (!before || new Date(s.receivedAt) < before) entries.push({ id: `supplement:${lead.id}:${i}`, type: 'LEAD', code: 'lead.supplemented', params: {}, author: { kind: 'CLIENT', name: null }, at: s.receivedAt, detail: null });
      });
      // the rest of a request's life: `AuditLog` `lead.*` (SEC-080) — it follows `lead.read`, never `audit.read`
      const audits = await this.prisma.auditLog.findMany({
        where: { entityType: 'Lead', entityId: lead.id, action: { startsWith: 'lead.' }, ...(until ? { createdAt: until } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE + 1,
        select: { id: true, action: true, actorType: true, actorId: true, reason: true, createdAt: true },
      });
      const actors = await this.prisma.user.findMany({ where: { id: { in: audits.map((a) => a.actorId).filter((v): v is string => Boolean(v)) } }, select: { id: true, firstName: true, lastName: true, status: true, kind: true } });
      for (const a of audits) {
        if (a.action === 'lead.created') continue; // already told by the request itself
        const actor = actors.find((u) => u.id === a.actorId);
        entries.push({
          id: `audit:${a.id}`,
          type: 'LEAD',
          code: a.action,
          params: {},
          author: actor ? (actor.kind === 'STAFF' ? staffAuthor(actor) : { kind: 'CLIENT', name: null }) : system,
          at: a.createdAt.toISOString(),
          detail: staff.masked ? null : a.reason, // SEC-032: a typed reason is free text
        });
      }
    }

    // E-mails and logged exchanges (source: `Communication`) — `communication.read`.
    if (staff.has('communication.read') && (want('EMAIL') || want('CALL'))) {
      const rows = await this.prisma.communication.findMany({
        where: { leadId: lead.id, ...(until ? { occurredAt: until } : {}) },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: PAGE + 1,
        select: COMMUNICATION_ENTRY_SELECT,
      });
      entries.push(...communicationEntries(rows, staff, want));
    }

    // Notes (source: `Note`) — `note.read`.
    if (staff.has('note.read') && want('NOTE')) {
      const rows = await this.prisma.note.findMany({
        where: { entityType: 'LEAD', entityId: lead.id, deletedAt: null, ...(until ? { createdAt: until } : {}) },
        include: this.include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE + 1,
      });
      for (const n of rows) {
        const item = this.note(n, staff);
        entries.push({ id: `note:${n.id}`, type: 'NOTE', code: 'note.written', params: {}, author: { kind: 'STAFF', name: item.authorName }, at: item.createdAt, detail: item.body, pinned: item.pinned, note: { id: item.id, canEdit: item.canEdit, canDelete: item.canDelete, editedAt: item.editedAt } });
      }
    }

    entries.sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at)));
    const page = entries.slice(0, PAGE);
    return { data: page, meta: { nextCursor: entries.length > PAGE ? page[page.length - 1]!.at : null } };
  }
}
