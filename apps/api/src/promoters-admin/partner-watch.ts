// AUT-073, AUT-079, ACP-083 — the scheduled watch `partner.scan` (every day at 07:30) and the effects of the partner
// events written from the outbox (AUT-003):
//   · `partner.convention_expiring` — 30 days before `conventionExpiresAt` of an ACTIVE promoter or bank;
//   · `partner.document_expiring` — 30 days before `expiresAt` of a PartnerDocument of an ACTIVE partner;
//     both → NS_PARTNER_EXPIRING to the ADMINS (and the tasks of R_CONVENTION_EXPIRING, R_PARTNER_DOC_EXPIRING);
//   · `promoter.stock_check_due` — a promoter with something to verify and no open task `stock:{promoterId}`
//     (R_STOCK_CHECK); the task closes by itself when nothing is left to verify (`program.stock_confirmed`, and here);
//   · a PARTNER account whose application was DECLINED 30 days ago → DELETED (MOD-100);
//   · `promoter.status_changed` to SUSPENDED or ENDED → NS_PARTNER_SUSPENDED to the advisers of its open dossiers.
// Facts carry the key that names them (AUT-012): replaying a pass emits nothing twice.
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { emitFact } from '../automation/automation-jobs.js';
import { toEnvelope } from '../automation/event-catalogue.js';
import { Scheduler, type JobContext } from '../automation/scheduler.js';
import { StaffDirectory } from '../automation/staff-directory.js';
import { StaffNotifier } from '../automation/staff-notifications.service.js';
import { TaskAutoClose } from '../automation/task-effects.js';
import { TasksService } from '../automation/tasks.service.js';
import { SignupService } from '../identity/signup.service.js';
import { localDate } from '../platform/holidays.service.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { writeAudit } from '../admin/audit.js';
import { SYSTEM_ACTOR } from '../admin/actor.js';
import { stockChecksDue } from '../catalogue-admin/stock-check.js';

const t = createTranslator('fr');
const DAY = 86_400_000;
const dateLabel = (d: Date) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);

@Injectable()
export class PartnerWatch implements OnModuleInit, OutboxHandler {
  readonly name = 'promoters-admin.partner-watch';
  readonly types = ['partner.convention_expiring', 'partner.document_expiring', 'promoter.status_changed'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly scheduler: Scheduler,
    private readonly handlers: OutboxHandlers,
    private readonly notifier: StaffNotifier,
    private readonly directory: StaffDirectory,
    private readonly tasks: TasksService,
    private readonly autoClose: TaskAutoClose,
    private readonly signup: SignupService,
  ) {}

  onModuleInit(): void {
    this.scheduler.register({ name: 'partner.scan', schedule: { dailyAt: '07:30' }, run: (ctx) => this.scan(ctx) });
    this.handlers.register(this);
    // AUT-079 — the stock task of a promoter ends when none of its programmes is left to verify.
    this.autoClose.on('program.stock_confirmed', async (e, db) => {
      const promoterId = typeof e.data.promoterId === 'string' ? e.data.promoterId : null;
      if (!promoterId) return [];
      const left = await stockChecksDue(db, new Date(), await this.settings.get('catalogue.stockCheckDays'), promoterId);
      return left.length ? [] : [{ keys: [`stock:${promoterId}`], outcome: 'DONE', reason: t('ui.admin-promoters.watch.stockDone') }];
    });
  }

  /** `partner.scan` — conventions, documents, availabilities to verify, declined applicants' accounts. */
  async scan(ctx: JobContext): Promise<Record<string, number>> {
    const now = ctx.now;
    const limit = new Date(now.getTime() + 30 * DAY);
    let conventions = 0;
    let documents = 0;
    let stock = 0;
    let deleted = 0;
    // AUT-073 — conventions of ACTIVE promoters and banks expiring within 30 days (or past, not yet signalled).
    const [promoters, banks] = await Promise.all([
      this.prisma.promoter.findMany({ where: { deletedAt: null, status: 'ACTIVE', conventionExpiresAt: { not: null, lte: limit } }, select: { id: true, conventionExpiresAt: true } }),
      this.prisma.bank.findMany({ where: { deletedAt: null, status: 'ACTIVE', conventionExpiresAt: { not: null, lte: limit } }, select: { id: true, conventionExpiresAt: true } }),
    ]);
    for (const [type, rows] of [['Promoter', promoters], ['Bank', banks]] as const) {
      for (const r of rows) {
        const date = r.conventionExpiresAt!.toISOString();
        if (await emitFact(this.prisma, now, { type: 'partner.convention_expiring', aggregate: { type, id: r.id }, data: { ownerType: type === 'Promoter' ? 'PROMOTER' : 'BANK', expiresAt: date }, jobRunId: ctx.jobRunId, dedupeKey: `partner.convention_expiring:${type}:${r.id}:${date.slice(0, 10)}` })) conventions++;
      }
    }
    // AUT-073 — documents of ACTIVE partners expiring within 30 days.
    const docs = await this.prisma.partnerDocument.findMany({ where: { deletedAt: null, expiresAt: { not: null, lte: limit } }, select: { id: true, ownerType: true, ownerId: true, expiresAt: true } });
    const activePromoters = new Set((await this.prisma.promoter.findMany({ where: { id: { in: docs.filter((d) => d.ownerType === 'PROMOTER').map((d) => d.ownerId) }, status: 'ACTIVE', deletedAt: null }, select: { id: true } })).map((p) => p.id));
    const activeBanks = new Set((await this.prisma.bank.findMany({ where: { id: { in: docs.filter((d) => d.ownerType === 'BANK').map((d) => d.ownerId) }, status: 'ACTIVE', deletedAt: null }, select: { id: true } })).map((p) => p.id));
    for (const d of docs) {
      if (!(d.ownerType === 'PROMOTER' ? activePromoters : activeBanks).has(d.ownerId)) continue;
      const date = d.expiresAt!.toISOString();
      if (await emitFact(this.prisma, now, { type: 'partner.document_expiring', aggregate: { type: 'PartnerDocument', id: d.id }, data: { ownerType: d.ownerType, expiresAt: date }, jobRunId: ctx.jobRunId, dedupeKey: `partner.document_expiring:${d.id}:${date.slice(0, 10)}` })) documents++;
    }
    // AUT-079 — one task per promoter with something to verify; closed when nothing is left.
    const days = await this.settings.get('catalogue.stockCheckDays');
    const due = await stockChecksDue(this.prisma, now, days);
    const byPromoter = new Map<string, number>();
    for (const item of due) byPromoter.set(item.promoterId, (byPromoter.get(item.promoterId) ?? 0) + 1);
    const today = localDate(now, await this.settings.get('business.calendar.timezone'));
    for (const [promoterId, count] of byPromoter) {
      const open = await this.prisma.task.findFirst({ where: { dedupeKey: `stock:${promoterId}`, status: 'OPEN', deletedAt: null }, select: { id: true } });
      if (open) continue;
      if (await emitFact(this.prisma, now, { type: 'promoter.stock_check_due', aggregate: { type: 'Promoter', id: promoterId }, data: { programCount: count, accessLevel: 'MANAGED' }, jobRunId: ctx.jobRunId, dedupeKey: `promoter.stock_check_due:${promoterId}:${today}` })) stock++;
    }
    const openStock = await this.prisma.task.findMany({ where: { dedupeKey: { startsWith: 'stock:' }, status: 'OPEN', deletedAt: null }, select: { dedupeKey: true } });
    for (const task of openStock) {
      const promoterId = task.dedupeKey!.slice('stock:'.length);
      if (!byPromoter.has(promoterId)) await this.tasks.closeAutomatically(this.prisma, now, [task.dedupeKey!], 'DONE', t('ui.admin-promoters.watch.stockDone'));
    }
    // ACP-083, MOD-100 — the PARTNER account of an application declined 30 days ago is deleted.
    const declined = await this.prisma.lead.findMany({
      where: { applicationStatus: 'DECLINED', closedAt: { lte: new Date(now.getTime() - 30 * DAY) }, applicantUser: { kind: 'PARTNER', status: { not: 'DELETED' } } },
      select: { id: true, reference: true, applicantUserId: true },
      take: 500,
    });
    for (const l of declined) {
      await this.prisma.$transaction(async (tx) => {
        await this.signup.deleteAccount(tx, l.applicantUserId!, now);
        await writeAudit(tx, SYSTEM_ACTOR, now, { action: 'user.deleted', entityType: 'user', entityId: l.applicantUserId, entityLabel: l.reference, reason: 'ACP-083' });
      });
      deleted++;
    }
    return { conventions, documents, stock, deleted };
  }

  async handle(event: OutboxRecord): Promise<void> {
    const e = toEnvelope(event);
    const snapshot = await this.directory.load(this.prisma, event.occurredAt);
    if (event.type === 'promoter.status_changed') {
      const to = String(e.data.to ?? '');
      if (to !== 'SUSPENDED' && to !== 'ENDED') return;
      const p = await this.prisma.promoter.findUnique({ where: { id: event.aggregateId }, select: { id: true, brandName: true, legalName: true } });
      if (!p) return;
      const dossiers = await this.prisma.dossier.findMany({ where: { status: { in: ['OPEN', 'ON_HOLD'] }, deletedAt: null, OR: [{ promoterId: p.id }, { property: { promoterId: p.id } }] }, select: { assignedAgentId: true } });
      const perAgent = new Map<string, number>();
      for (const d of dossiers) if (d.assignedAgentId) perAgent.set(d.assignedAgentId, (perAgent.get(d.assignedAgentId) ?? 0) + 1);
      for (const [agentId, n] of perAgent) {
        const to2 = snapshot.resolve(['DOSSIER_AGENT'], { DOSSIER_AGENT: agentId } as never);
        await this.notifier.notify(this.prisma, event.occurredAt, {
          type: 'NS_PARTNER_SUSPENDED',
          userIds: to2.map((m) => m.userId),
          title: t(to === 'SUSPENDED' ? 'ui.notifications.NS_PARTNER_SUSPENDED.suspended' : 'ui.notifications.NS_PARTNER_SUSPENDED.ended', { nom: p.brandName ?? p.legalName, n }),
          link: `/promoteurs/${p.id}`,
          entityType: 'Promoter',
          entityId: p.id,
          originId: e.originId,
          exceptUserId: e.actor?.id ?? undefined,
        });
      }
      return;
    }
    // NS_PARTNER_EXPIRING — to the ADMINS.
    const admins = snapshot.resolve(['ADMINS'], {} as never).map((m) => m.userId);
    const expiresAt = typeof e.data.expiresAt === 'string' ? new Date(e.data.expiresAt) : null;
    if (!expiresAt) return;
    let partner: { name: string; link: string; entityType: string; entityId: string } | null = null;
    let title: string;
    if (event.type === 'partner.convention_expiring') {
      if (event.aggregateType === 'Bank') {
        const b = await this.prisma.bank.findUnique({ where: { id: event.aggregateId }, select: { id: true, name: true } });
        partner = b ? { name: b.name, link: `/banques/${b.id}`, entityType: 'Bank', entityId: b.id } : null;
      } else {
        const p = await this.prisma.promoter.findUnique({ where: { id: event.aggregateId }, select: { id: true, brandName: true, legalName: true } });
        partner = p ? { name: p.brandName ?? p.legalName, link: `/promoteurs/${p.id}?onglet=convention`, entityType: 'Promoter', entityId: p.id } : null;
      }
      if (!partner) return;
      title = t('ui.notifications.NS_PARTNER_EXPIRING.convention', { partenaire: partner.name, date: dateLabel(expiresAt) });
    } else {
      const d = await this.prisma.partnerDocument.findUnique({ where: { id: event.aggregateId }, select: { ownerType: true, ownerId: true } });
      if (!d) return;
      if (d.ownerType === 'BANK') {
        const b = await this.prisma.bank.findUnique({ where: { id: d.ownerId }, select: { id: true, name: true } });
        partner = b ? { name: b.name, link: `/banques/${b.id}`, entityType: 'Bank', entityId: b.id } : null;
      } else {
        const p = await this.prisma.promoter.findUnique({ where: { id: d.ownerId }, select: { id: true, brandName: true, legalName: true } });
        partner = p ? { name: p.brandName ?? p.legalName, link: `/promoteurs/${p.id}?onglet=documents`, entityType: 'Promoter', entityId: p.id } : null;
      }
      if (!partner) return;
      title = t('ui.notifications.NS_PARTNER_EXPIRING.document', { partenaire: partner.name, date: dateLabel(expiresAt) });
    }
    await this.notifier.notify(this.prisma, event.occurredAt, { type: 'NS_PARTNER_EXPIRING', userIds: admins, title, link: partner.link, entityType: partner.entityType, entityId: partner.entityId, keyPart: event.aggregateId, originId: e.originId });
  }
}
