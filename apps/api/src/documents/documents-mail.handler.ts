// DOS-013, CYC-140, NOT-030 — `document.file_refused` (written two minutes after the outcome): the e-mail
// C_FILE_REFUSED leaves only if the client has not read the matching notification — reading « Mes pièces » marks the
// dossier's notifications read (NOT-032): a client still on the screen already read the message there.
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { ENV, type Env } from '../config/env.js';
import { MailerService } from '../communication/mailer.service.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

const t = createTranslator('fr');

@Injectable()
export class DocumentsMailHandler implements OutboxHandler, OnModuleInit {
  readonly name = 'documents.mail';
  readonly types = ['document.file_refused'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly settings: SettingsService,
    private readonly handlers: OutboxHandlers,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(event: OutboxRecord): Promise<void> {
    const kind = String(event.payload.kind ?? 'REFUSED');
    const notificationId = typeof event.payload.notificationId === 'string' ? event.payload.notificationId : null;
    if (notificationId) {
      const n = await this.prisma.notification.findUnique({ where: { id: notificationId }, select: { readAt: true } });
      if (n?.readAt) return; // seen in the space: no e-mail
    }
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: event.aggregateId },
      select: {
        id: true,
        document: {
          select: { label: true, dossier: { select: { id: true, reference: true, client: { select: { id: true, email: true, firstName: true, doNotContact: true, restrictedAt: true, gdprErasedAt: true, emailBouncedAt: true } } } } },
        },
      },
    });
    const client = version?.document.dossier.client;
    // AUT-007 — an erased or restricted record receives nothing.
    if (!version || !client || client.gdprErasedAt || client.restrictedAt) return;
    const dossier = version.document.dossier;
    const companyName = await this.settings.get('contact.companyName');
    const dossierUrl = `${this.env.WEB_URL}/espace-client/dossiers/${encodeURIComponent(dossier.reference)}`;
    await this.mailer.sendTemplate({
      templateCode: 'C_FILE_REFUSED',
      to: client.email,
      dedupeKey: `C_FILE_REFUSED:${event.id}:${client.id}`,
      triggeredBy: 'EVENT',
      links: { clientId: client.id, dossierId: dossier.id },
      vars: {
        advisor: { firstName: t('ui.email.advisorFallback.firstName'), displayName: t('ui.email.advisorFallback.displayName', { company: companyName }) },
        company: { name: companyName, siteUrl: this.env.WEB_URL },
        documents: { first: { label: version.document.label } },
        deposit: { isPartial: kind === 'PARTIAL', isUnreadable: kind === 'UNREADABLE' },
        dossier: { reference: dossier.reference, url: dossierUrl, documentsUrl: `${dossierUrl}/pieces` },
      },
      greetingName: client.firstName,
      render: { eventId: event.id, versionId: version.id },
    });
  }
}
