// CTL-145, NOT-030 § 3.1 — `program.update_published` → NC_PROGRAM_UPDATE and C_PROGRAM_UPDATE for the clients whose
// open dossier (OPEN or ON_HOLD) is about this programme (its programme, or one of its properties retained). Written
// from the outbox after the commit (AUT-003), once per dossier and per point (NOT-035 keys).
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { notifyClient } from '../client-tools/client-notify.js';
import { MailerService } from '../communication/mailer.service.js';
import { ENV, type Env } from '../config/env.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';

const t = createTranslator('fr');

@Injectable()
export class ProgramUpdateNotifications implements OutboxHandler, OnModuleInit {
  readonly name = 'programs-admin.program-update';
  readonly types = ['program.update_published'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly handlers: OutboxHandlers,
    private readonly mailer: MailerService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(event: OutboxRecord): Promise<void> {
    const payload = event.payload as { data?: { updateId?: string } };
    const updateId = payload.data?.updateId;
    const update = updateId ? await this.prisma.programUpdate.findFirst({ where: { id: updateId, deletedAt: null } }) : null;
    const program = await this.prisma.program.findFirst({ where: { id: event.aggregateId, deletedAt: null }, select: { id: true, name: true, publication: true } });
    if (!update || !program) return; // corrected away before the dispatch: nothing to say
    const dossiers = await this.prisma.dossier.findMany({
      where: { deletedAt: null, status: { in: ['OPEN', 'ON_HOLD'] }, OR: [{ programId: program.id }, { property: { programId: program.id } }] },
      select: { id: true, reference: true, client: { select: { id: true, email: true, firstName: true } } },
    });
    const etape = t(`ui.enum.ConstructionStage.${update.stage}` as never);
    for (const d of dossiers) {
      const path = `/espace-client/dossiers/${encodeURIComponent(d.reference)}`;
      await notifyClient(this.prisma, event.occurredAt, {
        clientId: d.client.id,
        type: 'NC_PROGRAM_UPDATE',
        title: t('ui.notifications.NC_PROGRAM_UPDATE', { programme: program.name, etape, n: update.percent }),
        link: path,
        entityType: 'Dossier',
        entityId: d.id,
        dedupeKey: `NC_PROGRAM_UPDATE:${update.id}:${d.id}`,
      });
      await this.mailer.sendTemplate({
        templateCode: 'C_PROGRAM_UPDATE',
        to: d.client.email,
        dedupeKey: `C_PROGRAM_UPDATE:${event.id}:${d.client.email ?? d.id}`,
        triggeredBy: 'EVENT',
        links: { clientId: d.client.id, dossierId: d.id },
        vars: {
          property: { programName: program.name },
          action: { stageLabel: etape, percent: String(update.percent), note: update.note ?? '' },
          dossier: { reference: d.reference, url: `${this.env.WEB_URL}${path}` },
        },
        greetingName: d.client.firstName,
        render: { eventId: event.id, programId: program.id, updateId: update.id },
      });
    }
  }
}
