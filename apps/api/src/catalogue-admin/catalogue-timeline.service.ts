// BO-050 — the timeline of a catalogue object (promoter, programme, property), « Historique » tab of CTL-003, CTL-021,
// CTL-042: what was done on the record and on what belongs to it (contacts and documents of a promoter; media and
// construction updates of a programme; lots and media of a property), the e-mails written to a promoter
// (`Communication.promoterId`, CTL-006) and the internal notes. Same entry shape as the timeline of a request
// (`AdminTimelineEntry`); the sentence of a code is `ui.admin-shell.timeline.event.{code}`.
// Sources follow the permission of the object (`promoter.read`, `catalogue.read`) — never `audit.read` (ROL-019);
// notes ask `note.read`, e-mails `communication.read`.
import { Injectable } from '@nestjs/common';
import { ErrorCode, TIMELINE_TYPES, type AdminTimelineEntry, type AdminTimelinePage, type TimelineType } from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import type { Prisma } from '../generated/prisma/client.js';
import { staffName, StaffViews } from '../back-office/staff-view.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';

const PAGE = 20;
const t = createTranslator('fr');

export type CatalogueTimelineOwner = 'PROMOTER' | 'PROGRAM' | 'PROPERTY';

type Json = Record<string, unknown> | null;
const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : null);

/** The « before → after » of the sentences that show one (a status, a price). Enum values are rendered here. */
export function timelineChange(action: string, before: Json, after: Json): { avant: string | null; apres: string | null } {
  const label = (ns: string, v: unknown) => {
    const code = text(v);
    if (!code) return null;
    try {
      return t(`ui.enum.${ns}.${code}` as never);
    } catch {
      return code;
    }
  };
  if (action === 'promoter.status_changed') return { avant: label('PartnerStatus', before?.status), apres: label('PartnerStatus', after?.status) };
  if (action === 'lot.status_changed' || action === 'lot.sale_corrected') return { avant: label('LotStatus', before?.status), apres: label('LotStatus', after?.status) };
  if (action === 'lot.price_changed') return { avant: text(before?.price), apres: text(after?.price) };
  return { avant: null, apres: null };
}

@Injectable()
export class CatalogueTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly views: StaffViews,
  ) {}

  /** The audit rows that tell the life of the object: its own and those of what belongs to it. */
  private async auditScope(owner: CatalogueTimelineOwner, id: string): Promise<Prisma.AuditLogWhereInput[]> {
    const p = this.prisma;
    if (owner === 'PROMOTER') {
      const [contacts, documents, media] = await Promise.all([
        p.promoterContact.findMany({ where: { promoterId: id }, select: { id: true } }),
        p.partnerDocument.findMany({ where: { ownerType: 'PROMOTER', ownerId: id }, select: { id: true } }),
        p.media.findMany({ where: { ownerType: 'PROMOTER', ownerId: id }, select: { id: true } }),
      ]);
      return [
        { entityType: 'promoter', entityId: id },
        // a contact removed for good keeps its rows through the promoter id written in them
        { entityType: 'promoter_contact', OR: [{ entityId: { in: contacts.map((c) => c.id) } }, { after: { path: ['promoterId'], equals: id } }, { before: { path: ['promoterId'], equals: id } }] },
        { entityType: 'partner_document', entityId: { in: documents.map((d) => d.id) } },
        { entityType: 'media', entityId: { in: media.map((m) => m.id) } },
      ];
    }
    if (owner === 'PROGRAM') {
      const [media, updates] = await Promise.all([
        p.media.findMany({ where: { ownerType: 'PROGRAM', ownerId: id }, select: { id: true } }),
        p.programUpdate.findMany({ where: { programId: id }, select: { id: true } }),
      ]);
      return [
        { entityType: 'program', entityId: id },
        { entityType: 'media', entityId: { in: media.map((m) => m.id) } },
        { entityType: 'program_update', entityId: { in: updates.map((u) => u.id) } },
        { entityType: 'property_poi', after: { path: ['programId'], equals: id } },
        { entityType: 'property_poi', before: { path: ['programId'], equals: id } },
        { entityType: 'financing_eligibility', after: { path: ['programId'], equals: id } },
        { entityType: 'import_job', after: { path: ['programId'], equals: id } },
      ];
    }
    const lots = await p.lot.findMany({ where: { propertyId: id }, select: { id: true } });
    const media = await p.media.findMany({ where: { OR: [{ ownerType: 'PROPERTY', ownerId: id }, { ownerType: 'LOT', ownerId: { in: lots.map((l) => l.id) } }] }, select: { id: true } });
    return [
      { entityType: 'property', entityId: id },
      { entityType: 'lot', entityId: { in: lots.map((l) => l.id) } },
      { entityType: 'media', entityId: { in: media.map((m) => m.id) } },
      { entityType: 'property_poi', after: { path: ['propertyId'], equals: id } },
      { entityType: 'property_poi', before: { path: ['propertyId'], equals: id } },
      { entityType: 'financing_eligibility', after: { path: ['propertyId'], equals: id } },
    ];
  }

  /** `GET /admin/{promoters|programs|properties}/{id}/timeline?before=&type=` — cursor pagination, filter by type. */
  async timeline(auth: AuthContext, owner: CatalogueTimelineOwner, id: string, query: { before?: unknown; type?: unknown }): Promise<AdminTimelinePage> {
    const staff = await this.views.of(auth);
    const where = { id, deletedAt: null };
    const found =
      owner === 'PROMOTER' ? await this.prisma.promoter.findFirst({ where, select: { id: true } })
      : owner === 'PROGRAM' ? await this.prisma.program.findFirst({ where, select: { id: true } })
      : await this.prisma.property.findFirst({ where, select: { id: true } });
    if (!found) throw AppError.notFound();

    const wanted = typeof query.type === 'string' && query.type ? new Set(query.type.split(',').filter((x): x is TimelineType => (TIMELINE_TYPES as readonly string[]).includes(x))) : null;
    const want = (x: TimelineType) => !wanted || wanted.has(x);
    let before: Date | null = null;
    if (typeof query.before === 'string' && query.before) {
      before = new Date(query.before);
      if (Number.isNaN(before.getTime())) throw new AppError(ErrorCode.BAD_REQUEST);
    }
    const until = before ? { lt: before } : undefined;
    const entries: AdminTimelineEntry[] = [];
    const system = { kind: 'SYSTEM' as const, name: null };
    const staffAuthor = (u: { firstName: string | null; lastName: string | null; status: string } | null | undefined) => (u ? { kind: 'STAFF' as const, name: staffName(u) } : system);

    if (want('RECORD')) {
      const audits = await this.prisma.auditLog.findMany({
        where: { OR: await this.auditScope(owner, id), ...(until ? { createdAt: until } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE + 1,
        select: { id: true, action: true, actorId: true, entityLabel: true, before: true, after: true, reason: true, createdAt: true },
      });
      const actors = await this.prisma.user.findMany({ where: { id: { in: audits.map((a) => a.actorId).filter((v): v is string => Boolean(v)) } }, select: { id: true, firstName: true, lastName: true, status: true } });
      for (const a of audits) {
        const { avant, apres } = timelineChange(a.action, a.before as Json, a.after as Json);
        entries.push({
          id: `audit:${a.id}`,
          type: 'RECORD',
          code: a.action,
          // `label`: a lot reference, the label of a document — never a person's name (SEC-081)
          params: { label: a.entityLabel?.split(' · ').pop() ?? null, avant, apres },
          author: staffAuthor(actors.find((u) => u.id === a.actorId)),
          at: a.createdAt.toISOString(),
          detail: staff.masked ? null : a.reason && a.reason !== 'demo' ? a.reason : null,
        });
      }
    }

    if (owner === 'PROMOTER' && staff.has('communication.read') && want('EMAIL')) {
      const rows = await this.prisma.communication.findMany({
        where: { promoterId: id, channel: 'EMAIL', ...(until ? { occurredAt: until } : {}) },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: PAGE + 1,
        select: { id: true, direction: true, subject: true, templateCode: true, deliveryState: true, occurredAt: true, sentBy: { select: { firstName: true, lastName: true, status: true } } },
      });
      for (const c of rows) {
        entries.push({ id: `communication:${c.id}`, type: 'EMAIL', code: `email.${c.deliveryState ?? 'SENT'}`, params: { template: c.templateCode, direction: c.direction }, author: staffAuthor(c.sentBy), at: c.occurredAt.toISOString(), detail: staff.masked ? null : c.subject });
      }
    }

    if (staff.has('note.read') && want('NOTE')) {
      const rows = await this.prisma.note.findMany({
        where: { entityType: owner, entityId: id, deletedAt: null, ...(until ? { createdAt: until } : {}) },
        include: { author: { select: { firstName: true, lastName: true, status: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE + 1,
      });
      const canWrite = staff.has('note.manage');
      for (const n of rows) {
        const mine = n.authorId === staff.userId;
        entries.push({
          id: `note:${n.id}`,
          type: 'NOTE',
          code: 'note.written',
          params: {},
          author: { kind: 'STAFF', name: staffName(n.author) },
          at: n.createdAt.toISOString(),
          detail: n.body,
          pinned: n.isPinned,
          note: { id: n.id, canEdit: mine && canWrite, canDelete: (mine && canWrite) || staff.has('note.moderate'), editedAt: n.updatedAt.getTime() - n.createdAt.getTime() > 1000 ? n.updatedAt.toISOString() : null },
        });
      }
    }

    entries.sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at)));
    const page = entries.slice(0, PAGE);
    return { data: page, meta: { nextCursor: entries.length > PAGE ? page[page.length - 1]!.at : null } };
  }
}
