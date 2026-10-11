// CTL-102, CYC-107 — `lot.import_conflict`: the promoter's file says « Vendu », « Réservé » or « Retiré » for a lot a
// dossier holds under option or has reserved. The status did not change; the adviser of that dossier gets a priority
// task « Le fichier de {promoteur} donne le lot {lot} comme {statut}, alors que le dossier {référence} le tient : à
// vérifier. » — maybe a sale made on the promoter's side. A system effect written from the outbox (AUT-002), once per
// lot and per import (task key). The rule `R_LOT_IMPORT_CONFLICT` of the specs takes this over when the rule engine knows
// the Lot object (package 4.4); its key is the same, so no second task is ever created.
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { SYSTEM_ACTOR } from '../admin/actor.js';
import { TasksService } from '../automation/tasks.service.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

const t = createTranslator('fr');

@Injectable()
export class ImportConflictTasks implements OutboxHandler, OnModuleInit {
  readonly name = 'media-admin.import-conflict';
  readonly types = ['lot.import_conflict'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly handlers: OutboxHandlers,
    private readonly tasks: TasksService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(event: OutboxRecord): Promise<void> {
    const data = ((event.payload as { data?: Record<string, unknown> }).data ?? {}) as { fileStatus?: string; dossierId?: string; importJobId?: string };
    if (!data.dossierId) return;
    const [lot, dossier] = await Promise.all([
      this.prisma.lot.findUnique({ where: { id: event.aggregateId }, select: { id: true, reference: true, propertyId: true, property: { select: { promoter: { select: { id: true, brandName: true, legalName: true } } } } } }),
      this.prisma.dossier.findUnique({ where: { id: data.dossierId }, select: { id: true, reference: true, assignedAgentId: true } }),
    ]);
    if (!lot || !dossier) return;
    const promoter = lot.property.promoter;
    await this.tasks.create(this.prisma, SYSTEM_ACTOR, event.occurredAt, {
      title: t('ui.admin-media.import.conflictTask', {
        promoteur: promoter.brandName ?? promoter.legalName,
        lot: lot.reference,
        statut: t(`ui.enum.LotStatus.${(data.fileStatus ?? 'SOLD') as 'SOLD'}`).toLowerCase(),
        reference: dossier.reference,
      }),
      type: 'FOLLOW_UP',
      priority: 'HIGH',
      assigneeId: dossier.assignedAgentId,
      dueAt: event.occurredAt,
      dueHasTime: false,
      timeZone: await this.settings.get('business.calendar.timezone'),
      origin: 'SYSTEM',
      dedupeKey: `lot-import-conflict:${lot.id}:${data.importJobId ?? event.id}`,
      links: { dossierId: dossier.id, propertyId: lot.propertyId, promoterId: promoter.id },
    });
  }
}
