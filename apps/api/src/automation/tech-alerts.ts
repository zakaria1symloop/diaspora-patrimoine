// AUT-076 — technical alerts: a notification `NS_TECH_ALERT` and the e-mail `S_TECH_ALERT` to the SUPPORT role and,
// always, the e-mail to `TECH_ALERT_EMAIL` (ENV-040), so that an alert has a recipient even before a first SUPPORT
// account is invited. At most one per hour and per CAUSE — the kind of alert and its object: `outbox:{eventId}`,
// `rule:{ruleId}`, `job:{jobName}`, `queue:{file}`… No personal data in the cause nor in the details.
// An alert never fails what raised it: every error here is logged and swallowed.
import { Inject, Injectable } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { MailerService } from '../communication/mailer.service.js';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { PrismaService } from '../platform/prisma.service.js';
import { currentRequestId, log } from '../platform/request-context.js';
import { StaffDirectory } from './staff-directory.js';
import { StaffNotifier } from './staff-notifications.service.js';

const t = createTranslator('fr');

export interface TechAlert {
  /** `rule:{ruleId}`, `job:{jobName}`, `outbox:{eventId}`, `queue:{file}`… */
  cause: string;
  /** The cause in plain words (« Exécution de règle en échec : R_DOC_REMINDER »). */
  label: string;
  /** What happened and the last error message, without any personal data. */
  details: string;
  /** Id of the request or of the work in question (TRV-111). */
  reference?: string | null;
}

/** An error message fit for an alert: one line, bounded, without addresses. */
export function safeError(err: unknown): string {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'error';
  return message.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[adresse]').replace(/\s+/g, ' ').slice(0, 300);
}

@Injectable()
export class TechAlerts {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly mailer: MailerService,
    private readonly staff: StaffDirectory,
    private readonly notifier: StaffNotifier,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Returns true when the alert left (false: already raised for this cause within the hour, or the sending failed). */
  async raise(alert: TechAlert): Promise<boolean> {
    try {
      const now = this.clock.now();
      const hour = now.toISOString().slice(0, 13);
      const origin = `${alert.cause}:${hour}`.slice(0, 120);
      const support = (await this.staff.load(this.prisma, now)).withRoles(['SUPPORT']);
      const told = await this.notifier.notify(this.prisma, now, {
        type: 'NS_TECH_ALERT',
        userIds: support.map((m) => m.userId),
        title: t('ui.notifications.NS_TECH_ALERT', { cause: alert.label }),
        link: '/diagnostic',
        originId: origin,
      });
      const reference = alert.reference ?? (currentRequestId() === 'req_none' ? alert.cause : currentRequestId());
      const recipients = new Map<string, { firstName: string | null; staffUserId: string | null }>();
      for (const m of support) recipients.set(m.email.toLowerCase(), { firstName: m.firstName, staffUserId: m.userId });
      if (this.env.TECH_ALERT_EMAIL && !recipients.has(this.env.TECH_ALERT_EMAIL.toLowerCase())) recipients.set(this.env.TECH_ALERT_EMAIL.toLowerCase(), { firstName: null, staffUserId: null });
      let sent = told.notified.length > 0;
      for (const [email, who] of recipients) {
        const outcome = await this.mailer.sendTemplate({
          templateCode: 'S_TECH_ALERT',
          to: email,
          dedupeKey: `S_TECH_ALERT:${origin}:${email}`.slice(0, 200),
          triggeredBy: 'SYSTEM',
          links: { staffUserId: who.staffUserId },
          vars: { staff: { firstName: who.firstName }, action: { cause: alert.label, details: alert.details, requestId: reference } },
          greetingName: who.firstName,
          render: { cause: alert.cause },
        });
        if (outcome === 'SENT') sent = true;
      }
      log('error', 'tech.alert', { cause: alert.cause, sent });
      return sent;
    } catch (err) {
      log('error', 'tech.alert_failed', { cause: alert.cause, message: safeError(err) });
      return false;
    }
  }
}
