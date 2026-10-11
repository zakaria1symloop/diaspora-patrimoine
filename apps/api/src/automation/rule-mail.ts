// AUT-031, AUT-006, AUT-007, AUT-008, NOT-030 (`NC_REMINDER`) — the action `SEND_EMAIL` of a rule.
//
// The engine knows WHO receives (the references of `EmailRecipientRef`), WHETHER the e-mail may leave now (stop
// conditions, quiet hours, ceiling, window) and UNDER WHICH KEY (NOT-011). WHAT the template needs beyond the objects of
// the event belongs to the module that owns the template: it registers a composer (`RuleMailComposers.compose`) — the
// Café adds the manage link and the next Café — or, when the e-mail must leave through its own chain, a sender
// (`RuleMailComposers.send`) — identity mints the token of `C_EMAIL_VERIFICATION` when the e-mail really leaves.
import { Inject, Injectable } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { notifyClient } from '../client-tools/client-notify.js';
import { MailerService, SuppressionReason, type SendOutcome, type SendTemplateInput } from '../communication/mailer.service.js';
import { renderTemplate, type TemplateVars } from '../communication/template-renderer.js';
import { ENV, type Env } from '../config/env.js';
import type { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { RuleContext } from './rule-context.js';
import { AGENT_REFS, type SendEmailAction } from './rule-definition.js';
import { ROLE_GROUPS, type StaffMember, type StaffSnapshot } from './staff-directory.js';
import { staffLink } from './staff-links.js';
import { dayStart, isQuiet, nextDayStart, quietEnd } from './timing.js';

const t = createTranslator('fr');
type Row = Record<string, unknown>;

/** AUT-008 — the three DEADLINE reminders neither count nor wait: a reminder that arrives after the date means nothing. */
export const DEADLINE_REMINDERS: ReadonlySet<string> = new Set(['C_OPTION_EXPIRING', 'C_OFFER_EXPIRING', 'C_APPOINTMENT_REMINDER']);
/** NOT-030 `NC_REMINDER` — never for an account e-mail. */
const ACCOUNT_MAILS: ReadonlySet<string> = new Set(['C_ACCOUNT_ACTIVATION_REMINDER', 'C_EMAIL_VERIFICATION']);
/** AUT-007 — what is attached to a closed dossier is ignored, except what follows these events. */
const CLOSED_DOSSIER_TRIGGERS: ReadonlySet<string> = new Set(['dossier.won', 'dossier.lost', 'message.sent', 'reservation.deposit_refund_due', 'reservation.deposit_settled']);

export interface MailRecipient {
  kind: 'CLIENT' | 'REGISTRANT' | 'NOTIFY_REQUEST' | 'STAFF';
  email: string | null;
  firstName: string | null;
  timeZone: string;
  /** The client record of a CLIENT or REGISTRANT recipient. */
  client?: Row | null;
  registration?: Row;
  notifyRequest?: Row;
  staff?: StaffMember;
}

export interface ComposeInput {
  template: string;
  ctx: RuleContext;
  recipient: MailRecipient;
  /** The fields the engine provides: objects of the event, `company`, `advisor`, `client`/`staff`, `action.adminUrl`. */
  vars: TemplateVars;
  now: Date;
}

/** What a module adds for its template. Everything is optional: the engine's fields stay. */
export interface Composition {
  vars?: TemplateVars;
  secrets?: SendTemplateInput['secrets'];
  blocks?: SendTemplateInput['blocks'];
  attachments?: SendTemplateInput['attachments'];
  unsubscribe?: SendTemplateInput['unsubscribe'];
  links?: Partial<SendTemplateInput['links']>;
  /** The e-mail has lost its meaning for this recipient (a reminder after the date, AUT-082): nothing is sent. */
  skip?: boolean;
}
export type RuleMailComposer = (input: ComposeInput) => Promise<Composition | null> | Composition | null;

export interface OwnSendInput extends ComposeInput {
  dedupeKey: string;
  ruleId: string;
}
/** A module that sends the template through its own chain; returns the outcome of the mailer. */
export type RuleMailSender = (input: OwnSendInput) => Promise<SendOutcome | string>;

@Injectable()
export class RuleMailComposers {
  private readonly composers = new Map<string, RuleMailComposer>();
  private readonly senders = new Map<string, RuleMailSender>();

  /** Declares what a template needs beyond the objects of the event. */
  compose(templateCode: string | readonly string[], composer: RuleMailComposer): void {
    for (const code of typeof templateCode === 'string' ? [templateCode] : templateCode) this.composers.set(code, composer);
  }

  /** Declares that a template leaves through the module's own sending chain. */
  send(templateCode: string, sender: RuleMailSender): void {
    this.senders.set(templateCode, sender);
  }

  composerOf(code: string): RuleMailComposer | null {
    return this.composers.get(code) ?? null;
  }

  senderOf(code: string): RuleMailSender | null {
    return this.senders.get(code) ?? null;
  }
}

export type ActionResult =
  | { status: 'DONE'; note?: string }
  /** The action is ignored, with its reason (AUT-007); the following actions run. */
  | { status: 'SKIPPED'; reason: string }
  /** The action waits (quiet hours, ceiling): the execution resumes at `until`, without counting a try. */
  | { status: 'DEFERRED'; until: Date };

export interface MailActionInput {
  action: SendEmailAction;
  index: number;
  ctx: RuleContext;
  vars: TemplateVars;
  rule: { id: string; code: string | null; trigger: string };
  executionId: string;
  staff: StaffSnapshot;
  now: Date;
}

const skip = (key: Parameters<typeof t>[0]): ActionResult => ({ status: 'SKIPPED', reason: t(key) });

@Injectable()
export class RuleMailAction {
  constructor(
    private readonly mailer: MailerService,
    private readonly settings: SettingsService,
    private readonly composers: RuleMailComposers,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async run(db: PrismaService, input: MailActionInput): Promise<ActionResult> {
    const { action, ctx, now } = input;
    const template = await db.emailTemplate.findFirst({
      where: { code: action.template, locale: 'fr', deletedAt: null },
      select: { code: true, isActive: true, isSystem: true, preferenceGroup: true, subject: true, bodyHtml: true, audience: true },
    });
    const recipients = await this.recipients(db, input);
    if (recipients.length === 0) {
      // A list that is simply empty (no registrant, no « Me prévenir » request) is not a missing recipient.
      return ['REGISTRANTS', 'ATTENDEES', 'NOTIFY_REQUESTS'].includes(action.to) ? { status: 'DONE', note: 'NO_ONE' } : skip('ui.automation.skip.noRecipient');
    }

    // AUT-007 — a request classed as spam: nothing leaves for it.
    if (ctx.objects.lead?.status === 'SPAM') return skip('ui.automation.skip.spam');

    const single = recipients.length === 1 ? recipients[0]! : null;
    const toPerson = single !== null && (single.kind === 'CLIENT' || single.kind === 'REGISTRANT');
    const manual = ctx.event.data.manual === true; // AUT-020: only the manual reminder of R_DOC_REMINDER lifts both.
    const quiet = await this.settings.get('mail.quietHours');

    if (toPerson && template?.isActive && !manual) {
      const stop = this.stopReason(input, single, template);
      if (!stop) {
        // AUT-006 — a reminder leaves between 8:00 and 20:00 in the recipient's time zone; outside, it waits for 8:00.
        if ((action.respectQuietHours ?? true) && isQuiet(now, quiet, single.timeZone)) {
          await this.remind(db, input, single, template);
          return { status: 'DEFERRED', until: quietEnd(now, quiet, single.timeZone) };
        }
        // AUT-008 — no more than `mail.maxRemindersPerDay` automatic reminders a day, all dossiers together.
        if (single.kind === 'CLIENT' && single.client && !template.isSystem && !DEADLINE_REMINDERS.has(template.code)) {
          const sentToday = await db.communication.count({
            where: {
              clientId: single.client.id as string,
              channel: 'EMAIL',
              triggeredBy: 'WORKFLOW',
              deliveryState: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED'] },
              sentAt: { gte: dayStart(now, single.timeZone) },
              templateCode: { notIn: [...DEADLINE_REMINDERS] },
            },
          });
          if (sentToday >= (await this.settings.get('mail.maxRemindersPerDay'))) {
            await this.remind(db, input, single, template);
            return { status: 'DEFERRED', until: nextDayStart(now, quiet, single.timeZone) };
          }
        }
      }
    }

    let sent = 0;
    let lastReason: string | null = null;
    for (const recipient of recipients) {
      const outcome = await this.sendOne(db, input, recipient, template);
      if (outcome.sent) sent++;
      else lastReason = outcome.reason ?? lastReason;
    }
    if (sent === 0 && lastReason) return { status: 'SKIPPED', reason: lastReason };
    return { status: 'DONE' };
  }

  // ---------- recipients ----------

  private async recipients(db: PrismaService, input: MailActionInput): Promise<MailRecipient[]> {
    const { action, ctx, staff, now } = input;
    const o = ctx.objects;
    const zone = (v: unknown) => (typeof v === 'string' && v ? v : ctx.timeZone);
    const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
    switch (action.to) {
      case 'CLIENT': {
        if (o.client) return [{ kind: 'CLIENT', email: str(o.client.email), firstName: str(o.client.firstName), timeZone: zone(o.client.timezone), client: o.client }];
        // A request whose record does not exist (yet): the address typed on the request.
        if (o.lead) return [{ kind: 'CLIENT', email: str(o.lead.email), firstName: str(o.lead.firstName), timeZone: zone(o.lead.callerTimezone), client: null }];
        return [];
      }
      case 'REGISTRANT': {
        const r = o.registration;
        if (!r) return [];
        return [{ kind: 'REGISTRANT', email: str(r.email), firstName: str(r.firstName), timeZone: zone(o.cafe?.timezone), client: o.client ?? null, registration: r }];
      }
      case 'REGISTRANTS':
      case 'ATTENDEES': {
        if (!o.cafe) return [];
        const rows = await db.eventRegistration.findMany({
          where: {
            eventId: o.cafe.id as string,
            status: action.to === 'ATTENDEES' ? 'ATTENDED' : 'REGISTERED',
            ...(action.registeredBeforeHours ? { registeredAt: { lte: new Date(now.getTime() - action.registeredBeforeHours * 3_600_000) } } : {}),
          },
          include: { client: true },
          orderBy: { registeredAt: 'asc' },
        });
        return rows.map((r) => ({ kind: 'REGISTRANT' as const, email: r.email, firstName: r.firstName, timeZone: zone(o.cafe?.timezone), client: r.client as unknown as Row, registration: r as unknown as Row }));
      }
      case 'NOTIFY_REQUESTS': {
        if (!o.cafe) return [];
        // CAF-041 — the requests for this Café, those for its place, those without place; each served once.
        const rows = await db.eventNotifyRequest.findMany({
          where: { notifiedAt: null, OR: [{ eventId: o.cafe.id as string }, { eventId: null, locationLabel: o.cafe.locationLabel as string }, { eventId: null, locationLabel: null }] },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map((r) => ({ kind: 'NOTIFY_REQUEST' as const, email: r.email, firstName: null, timeZone: zone(o.cafe?.timezone), notifyRequest: r as unknown as Row }));
      }
      default: {
        // Staff: a recipient that cannot be found (a dossier without advisor) → the action is ignored (AUT-031).
        const members: StaffMember[] = (AGENT_REFS as readonly string[]).includes(action.to)
          ? [staff.get(ctx.agentIds()[action.to as (typeof AGENT_REFS)[number]])].filter((m): m is StaffMember => m !== null)
          : staff.withRoles(ROLE_GROUPS[action.to as 'ADMINS' | 'OWNERS']);
        return members.map((m) => ({ kind: 'STAFF' as const, email: m.email, firstName: m.firstName, timeZone: m.timezone, staff: m }));
      }
    }
  }

  // ---------- stop conditions (AUT-007), in the order of the table ----------

  /** Reason code that stops the e-mail to a person, or null. `erased` and `spam` write nothing at all. */
  private stopReason(
    input: MailActionInput,
    r: MailRecipient,
    template: { isSystem: boolean; preferenceGroup: string | null; code: string },
  ): keyof typeof SuppressionReason | 'ERASED' | 'NOT_INFORMED' | null {
    const { action, ctx, rule } = input;
    const client = r.client ?? null;
    const user = ctx.objects.user;
    const dossier = ctx.objects.dossier;
    if (client?.gdprErasedAt) return 'ERASED';
    if (client) {
      const closed = user && client.userId === user.id && (user.status === 'DELETED' || user.status === 'SUSPENDED');
      // A processing limited AT THE PERSON'S REQUEST keeps the account and security e-mails (ADM-063).
      const ownRestriction = client.restrictedAt && client.restrictionReason === 'REQUEST' && !closed && template.isSystem;
      if (client.restrictedAt && !ownRestriction) return 'RESTRICTED';
      if (closed) return 'ACCOUNT_CLOSED';
    }
    if (!r.email) return 'NO_ADDRESS';
    if (client?.emailBouncedAt && !template.isSystem) return 'ADDRESS_BOUNCED';
    if (r.kind === 'CLIENT' && ctx.objects.appointment && ctx.objects.appointment.clientNotifiedAt == null) return 'NOT_INFORMED';
    if (client?.doNotContact) {
      const service = !template.preferenceGroup && (dossier?.status === 'OPEN' || dossier?.status === 'ON_HOLD');
      if (!service && !template.isSystem) return 'DO_NOT_CONTACT';
    }
    if (r.kind === 'CLIENT' && dossier) {
      if (dossier.status === 'ON_HOLD' && (action.skipWhenOnHold ?? true)) return 'DOSSIER_ON_HOLD';
      if ((dossier.status === 'WON' || dossier.status === 'LOST') && !CLOSED_DOSSIER_TRIGGERS.has(rule.trigger)) return 'DOSSIER_CLOSED';
    }
    return null;
  }

  // ---------- one recipient ----------

  private async sendOne(
    db: PrismaService,
    input: MailActionInput,
    r: MailRecipient,
    template: { code: string; isActive: boolean; isSystem: boolean; preferenceGroup: string | null; subject: string; bodyHtml: string } | null,
  ): Promise<{ sent: boolean; reason?: string }> {
    const { action, ctx, rule, now } = input;
    const person = r.kind === 'CLIENT' || r.kind === 'REGISTRANT';
    const clientId = r.client ? (r.client.id as string) : null;
    const many = ['REGISTRANTS', 'ATTENDEES', 'NOTIFY_REQUESTS', 'ADMINS', 'OWNERS'].includes(action.to);
    const custom = action.dedupeKey ? renderTemplate({ subject: action.dedupeKey, body: '' }, input.vars, { siteUrl: this.env.WEB_URL }).subject : null;
    // NOT-011 — `{code}:{event}:{recipient}`, unless the starting data fixed the key of this e-mail (AUT-031).
    const dedupeKey = (custom ? (many ? `${custom}:${r.email ?? '-'}` : custom) : `${action.template}:${ctx.event.eventId}:${r.email ?? r.staff?.userId ?? clientId ?? '-'}`).slice(0, 200);
    const links: SendTemplateInput['links'] = {
      clientId,
      leadId: ctx.id('lead'),
      dossierId: ctx.id('dossier'),
      eventId: ctx.id('cafe'),
      registrationId: r.registration ? (r.registration.id as string) : null,
      staffUserId: r.staff?.userId ?? null,
      ruleId: rule.id,
    };
    const suppress = async (reason: keyof typeof SuppressionReason, text: Parameters<typeof t>[0]) => {
      await this.mailer.sendTemplate({ templateCode: action.template, to: r.email, dedupeKey, triggeredBy: 'WORKFLOW', links, vars: {}, greetingName: null, suppress: reason, render: { eventId: ctx.event.eventId, ruleId: rule.id } });
      return { sent: false, reason: t(text) };
    };

    if (!template || !template.isActive) return suppress(template ? 'TEMPLATE_INACTIVE' : 'TEMPLATE_MISSING', 'ui.automation.skip.templateInactive');
    const tpl = template;

    if (person) {
      const stop = this.stopReason(input, r, tpl);
      // A person whose data are erased: nothing is written (AUT-007, last sentence).
      if (stop === 'ERASED') return { sent: false, reason: t('ui.automation.skip.erased') };
      if (stop === 'NOT_INFORMED') return { sent: false, reason: t('ui.automation.skip.notInformed') };
      if (stop) {
        await this.remind(db, input, r, tpl);
        return suppress(stop, STOP_TEXT[stop]);
      }
      // AUT-031 `dedupeWindowHours` — the same template is not sent again to the same recipient in this window.
      if (action.dedupeWindowHours && r.email) {
        const recent = await db.communication.findFirst({
          where: {
            templateCode: tpl.code,
            toAddress: r.email,
            dossierId: links.dossierId ?? undefined,
            deliveryState: { notIn: ['SUPPRESSED', 'FAILED', 'CANCELLED'] },
            createdAt: { gt: new Date(now.getTime() - action.dedupeWindowHours * 3_600_000) },
            dedupeKey: { not: dedupeKey },
          },
          select: { id: true },
        });
        if (recent) return { sent: false, reason: t('ui.automation.skip.window') };
      }
    } else if (r.staff && tpl.preferenceGroup) {
      // NOT-020 — a staff group cut by its owner: the row keeps the trace, the notification stays.
      const off = await db.notificationPreference.findFirst({ where: { userId: r.staff.userId, group: tpl.preferenceGroup, emailEnabled: false }, select: { id: true } });
      if (off) return suppress('PREFERENCE_DISABLED', 'ui.automation.skip.preferenceOff');
    }

    const vars = await this.baseVars(input, r);
    const compose: ComposeInput = { template: tpl.code, ctx, recipient: r, vars, now };
    const own = this.composers.senderOf(tpl.code);
    let outcome: string;
    if (own) outcome = await own({ ...compose, dedupeKey, ruleId: rule.id });
    else {
      const extra = (await this.composers.composerOf(tpl.code)?.(compose)) ?? null;
      if (extra?.skip) return { sent: false, reason: t('ui.automation.skip.tooLate') };
      outcome = await this.mailer.sendTemplate({
        templateCode: tpl.code,
        to: r.email,
        dedupeKey,
        triggeredBy: 'WORKFLOW',
        links: { ...links, ...(extra?.links ?? {}) },
        vars: mergeDeep(vars, extra?.vars ?? {}),
        secrets: extra?.secrets,
        blocks: extra?.blocks,
        attachments: extra?.attachments,
        unsubscribe: extra?.unsubscribe,
        greetingName: r.firstName,
        signature: person ? ((vars.advisor as { signature?: string | null } | undefined)?.signature ?? null) : null,
        render: { eventId: ctx.event.eventId, ruleId: rule.id, executionId: input.executionId },
      });
    }
    const left = outcome === 'SENT' || outcome === 'ALREADY_DONE';
    // AUT-031 `markField` — written by the engine when the e-mail is queued; there is no « write a field » action.
    if (left && action.markField) await this.mark(db, action.markField, r, ctx, now);
    if (left && r.kind === 'NOTIFY_REQUEST' && r.notifyRequest) await db.eventNotifyRequest.updateMany({ where: { id: r.notifyRequest.id as string, notifiedAt: null }, data: { notifiedAt: now, updatedAt: now } });
    if (person) await this.remind(db, input, r, tpl);
    if (left) return { sent: true };
    return { sent: false, reason: outcome === 'SUPPRESSED' ? t('ui.automation.skip.preferenceOff') : undefined };
  }

  private async mark(db: PrismaService, field: string, r: MailRecipient, ctx: RuleContext, now: Date): Promise<void> {
    if (r.registration && (field === 'reminder7SentAt' || field === 'reminder1SentAt' || field === 'followUpSentAt')) {
      await db.eventRegistration.updateMany({ where: { id: r.registration.id as string, [field]: null }, data: { [field]: now } });
    } else if (field === 'reminderSentAt' && ctx.id('appointment')) {
      await db.appointment.updateMany({ where: { id: ctx.id('appointment')!, reminderSentAt: null }, data: { reminderSentAt: now } });
    }
  }

  /**
   * NOT-030 `NC_REMINDER` — every SEND_EMAIL of a rule towards a client whose account is ACTIVE, when the action runs:
   * whether the e-mail leaves, waits or is set aside. Title: the subject of the e-mail; link: the path of its button
   * (the dashboard when the button carries a link with a token).
   */
  private async remind(db: PrismaService, input: MailActionInput, r: MailRecipient, template: { code: string; isSystem: boolean; subject: string; bodyHtml: string }): Promise<void> {
    if (!r.client || template.isSystem || ACCOUNT_MAILS.has(template.code)) return;
    if (input.ctx.read('client.accountStatus') !== 'ACTIVE' && r.kind === 'CLIENT') return;
    const vars = await this.baseVars(input, r);
    const subject = renderTemplate({ subject: template.subject, body: '' }, vars, { siteUrl: this.env.WEB_URL }).subject;
    if (!subject) return;
    const button = template.bodyHtml.match(/\{\{\s*button\s+"[^"]*"\s+(\/[^\s}]*)\s*\}\}/);
    const dossierId = input.ctx.id('dossier');
    await notifyClient(db, input.now, {
      clientId: r.client.id as string,
      type: 'NC_REMINDER',
      title: subject,
      link: button?.[1] ?? '/espace-client',
      entityType: dossierId ? 'Dossier' : null,
      entityId: dossierId,
      dedupeKey: `NC_REMINDER:${input.executionId}:${input.index}`,
    });
  }

  /** The fields every template may cite: objects of the event, `company`, `advisor`, the recipient, `action.*`. */
  private async baseVars(input: MailActionInput, r: MailRecipient): Promise<TemplateVars> {
    const { ctx, staff } = input;
    const [companyName, phone, email, whatsapp] = await Promise.all([
      this.settings.get('contact.companyName'),
      this.settings.get('contact.phone'),
      this.settings.get('contact.email'),
      this.settings.get('contact.whatsapp'),
    ]);
    const agents = ctx.agentIds();
    // NOT-050 — the advisor of the object (dossier, then request, then record), if he can act; else the team.
    const advisorId = [agents.DOSSIER_AGENT, agents.LEAD_AGENT, agents.CLIENT_AGENT].find((id) => staff.canAct(id));
    const advisor = staff.get(advisorId);
    const display = (m: StaffMember | null) => (m?.firstName ? (m.lastName ? `${m.firstName} ${m.lastName.charAt(0).toUpperCase()}.` : m.firstName) : null);
    const leadAgent = staff.get(agents.LEAD_AGENT);
    const subject = ctx.subject();
    const base = this.env.ADMIN_URL ?? this.env.WEB_URL;
    const path = staffLink(subject.entityType, ctx.objects[subject.object ?? 'lead'] ?? {});
    const vars = input.vars as Record<string, Record<string, unknown> | undefined>;
    return mergeDeep(input.vars, {
      company: {
        name: companyName,
        phone: phone ? (parsePhoneNumberFromString(phone)?.formatInternational() ?? phone) : null,
        email: email || null,
        whatsappUrl: whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : null,
        siteUrl: this.env.WEB_URL,
      },
      advisor: advisor && display(advisor)
        ? { firstName: advisor.firstName, displayName: display(advisor), signature: `${display(advisor)} — ${companyName}` }
        : { firstName: t('ui.email.advisorFallback.firstName'), displayName: t('ui.email.advisorFallback.displayName', { company: companyName }), signature: null },
      client: { ...(vars.client ?? {}), firstName: r.kind === 'STAFF' ? (vars.client?.firstName ?? null) : r.firstName },
      staff: { firstName: r.staff?.firstName ?? null },
      ...(vars.lead ? { lead: { ...vars.lead, agentLabel: (leadAgent ? [leadAgent.firstName, leadAgent.lastName].filter(Boolean).join(' ') : '') || t('ui.automation.mail.noAgent') } } : {}),
      action: { adminUrl: path ? `${base}${path}` : base, isContactMessage: ctx.objects.lead?.kind === 'CONTACT_MESSAGE' },
    });
  }
}

const STOP_TEXT: Record<keyof typeof SuppressionReason, Parameters<typeof t>[0]> = {
  TEMPLATE_INACTIVE: 'ui.automation.skip.templateInactive',
  TEMPLATE_MISSING: 'ui.automation.skip.templateInactive',
  NO_ADDRESS: 'ui.automation.skip.noEmail',
  PREFERENCE_DISABLED: 'ui.automation.skip.preferenceOff',
  ADDRESS_BOUNCED: 'ui.automation.skip.bounced',
  DO_NOT_CONTACT: 'ui.automation.skip.doNotContact',
  RESTRICTED: 'ui.automation.skip.restricted',
  ACCOUNT_CLOSED: 'ui.automation.skip.accountClosed',
  DOSSIER_ON_HOLD: 'ui.automation.skip.onHold',
  DOSSIER_CLOSED: 'ui.automation.skip.dossierClosed',
};

/** Deep merge of template variables (objects merged key by key; the right side wins). */
export function mergeDeep(a: TemplateVars, b: TemplateVars): TemplateVars {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    out[k] = prev && v && typeof prev === 'object' && typeof v === 'object' && !Array.isArray(prev) && !Array.isArray(v) ? mergeDeep(prev as TemplateVars, v as TemplateVars) : v;
  }
  return out;
}
