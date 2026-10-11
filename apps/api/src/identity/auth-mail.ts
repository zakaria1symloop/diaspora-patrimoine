// AUT-002, NOT-010, NOT-002 — account and security e-mails (01-domaine/09 § 4.1). An action never calls the mailer: it
// writes, in its own transaction, an outbox event `auth.email_requested` (technical event of the identity module, read
// by no automation rule) naming the template, the recipient and, for a link or a code, its PURPOSE — never the token.
// The handler mints the token (or the code) at the moment the e-mail really leaves (mailer `secrets`), so that a token
// exists in clear neither in the database nor in a queue, and the stored body is redacted (NOT-002).
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { ENV, type Env } from '../config/env.js';
import type { AuthTokenPurpose } from '../generated/prisma/client.js';
import { MailerService } from '../communication/mailer.service.js';
import { Clock } from '../platform/clock.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxHandlers, type EventDispatcher, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { TokensService } from './tokens.service.js';

export const AUTH_MAIL_EVENT = 'auth.email_requested';

export interface AuthMailRequest {
  /** Template code (`C_EMAIL_VERIFICATION`, `S_INVITATION`, `P_PARTNER_EMAIL_VERIFICATION`…). */
  template: string;
  to: string;
  userId?: string | null;
  clientId?: string | null;
  leadId?: string | null;
  /** NOT-040 — `SYSTEM` by default; `WORKFLOW` for a rule (R_VERIFICATION_REMINDER); `EVENT` for C_WELCOME. */
  triggeredBy?: 'SYSTEM' | 'WORKFLOW' | 'EVENT';
  /** NOT-011 — default `{template}:{eventId}:{to}`. */
  dedupeKey?: string;
  /** A link with a token minted at sending time: `path` holds `{token}`; `next` becomes `?suite=` (AUTH-040). */
  link?: { purpose: AuthTokenPurpose; host: 'web' | 'admin'; path: string; payload?: Record<string, unknown>; next?: string | null };
  /** AUTH-086 — a 6-digit code for this action. */
  code?: { action: string };
  /** Non-secret fields of the template (`action.*`, `actor.*`…). Instants as ISO strings are formatted by the handler. */
  vars?: Record<string, unknown>;
}

@Injectable()
export class AuthMailRequester {
  constructor(
    private readonly clock: Clock,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  /** Written in the caller's transaction (FIA-040): no commit, no e-mail. */
  async request(tx: Tx, req: AuthMailRequest): Promise<void> {
    const now = this.clock.now();
    await tx.outboxEvent.create({
      data: {
        id: newId(),
        type: AUTH_MAIL_EVENT,
        aggregateType: 'AuthMail',
        aggregateId: req.userId ?? newId(),
        payload: req as never,
        occurredAt: now,
        availableAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  /** After the commit: ask the dispatcher for a pass (the poller would pick it up anyway). */
  wake(): void {
    this.dispatcher.wake();
  }
}

@Injectable()
export class AuthMailHandler implements OnModuleInit {
  readonly name = 'auth.mail';
  readonly types = [AUTH_MAIL_EVENT] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly tokens: TokensService,
    private readonly settings: SettingsService,
    private readonly handlers: OutboxHandlers,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(event: OutboxRecord): Promise<void> {
    const req = event.payload as unknown as AuthMailRequest;
    await this.send(req, event.id);
  }

  /** Also called directly by the operations command (ADM-040), outside any request. */
  async send(req: AuthMailRequest, eventId: string): Promise<string> {
    const user = req.userId
      ? await this.prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, status: true, firstName: true, timezone: true, kind: true } })
      : null;
    // AUT-007 — nothing for a deleted account (the disowned sign-up, an erased person).
    if (user?.status === 'DELETED') return 'SUPPRESSED';
    const client = req.userId ? await this.prisma.client.findFirst({ where: { userId: req.userId }, select: { id: true, firstName: true, gdprErasedAt: true } }) : null;
    if (client?.gdprErasedAt) return 'SUPPRESSED';

    const companyName = await this.settings.get('contact.companyName');
    const phone = await this.settings.get('contact.phone');
    const contactEmail = await this.settings.get('contact.email');
    const timeZone = user?.timezone ?? (await this.settings.get('business.calendar.timezone'));
    const vars = this.formatInstants(structuredClone(req.vars ?? {}), timeZone);
    const firstName = client?.firstName ?? user?.firstName ?? null;
    const base = req.link?.host === 'admin' ? (this.env.ADMIN_URL ?? this.env.WEB_URL) : this.env.WEB_URL;

    const outcome = await this.mailer.sendTemplate({
      templateCode: req.template,
      to: req.to,
      dedupeKey: req.dedupeKey ?? `${req.template}:${eventId}:${req.to}`,
      triggeredBy: req.triggeredBy ?? 'SYSTEM',
      links: { clientId: req.clientId ?? client?.id ?? null, leadId: req.leadId ?? null, staffUserId: user?.kind === 'STAFF' ? user.id : null },
      vars: {
        ...vars,
        client: { firstName },
        staff: { firstName: user?.firstName ?? null },
        advisor: { firstName: t('ui.email.advisorFallback.firstName'), displayName: t('ui.email.advisorFallback.displayName', { company: companyName }) },
        company: { name: companyName, phone: phone || null, email: contactEmail || null, siteUrl: this.env.WEB_URL },
      },
      greetingName: firstName,
      render: { eventId, purpose: req.link?.purpose ?? (req.code ? 'ACTION_CODE' : null) },
      secrets: async () => {
        if (req.link) {
          const { token } = await this.tokens.issue({ purpose: req.link.purpose, userId: req.userId ?? null, email: req.to, payload: req.link.payload ?? null });
          const url = new URL(req.link.path.replace('{token}', token), base);
          if (req.link.next) url.searchParams.set('suite', req.link.next);
          return { action: { url: url.toString() } };
        }
        if (req.code) {
          const { code } = await this.tokens.issueCode({ purpose: 'ACTION_CODE', userId: req.userId ?? null, email: req.to, payload: { action: req.code.action } });
          return { action: { code } };
        }
        return {};
      },
    });
    return outcome;
  }

  /** NOT-051 — `action.at` (an instant) becomes `action.dateLabel`, in the recipient's time zone (TRV-020). */
  private formatInstants(vars: Record<string, unknown>, timeZone: string): Record<string, unknown> {
    const action = vars.action as Record<string, unknown> | undefined;
    if (action && typeof action.at === 'string') {
      const d = new Date(action.at);
      action.dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone })
        .format(d)
        .replace(/(\d{1,2}):(\d{2})/, '$1 h $2');
      delete action.at;
    }
    return vars;
  }
}

const t = createTranslator('fr');
