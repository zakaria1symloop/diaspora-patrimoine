// NOT-002, NOT-003, NOT-010…NOT-013 — the e-mail sending chain. (1) A `Communication` row is created QUEUED, without
// content, keyed by `dedupeKey` (NOT-011: nothing is created twice). (2) The e-mail is rendered at sending time with the
// template in force (NOT-012), wrapped (NOT-004), redirected to the sandbox outside production (NOT-013), handed to
// the provider; the row receives the subject, the REDACTED body (NOT-002) and `templateVersion`, state SENT.
// A transient provider failure throws: the caller (outbox event) is retried; after 72 h the row becomes FAILED.
// Reasons written in `failureReason` are stable codes, translated by the back office.
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { newId } from '../platform/ids.js';
import { PrismaService } from '../platform/prisma.service.js';
import { log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import { isUniqueViolation } from '../platform/tx.js';
import { createTranslator } from '@dp/i18n';
import { CLIENT_PREFERENCE_GROUPS, type ClientPreferenceGroup } from '@dp/contracts';
import { emailReason, teamSignature, wrapEmail } from './email-layout.js';
import { preferencesPagePath, signPreferencesToken, unsubscribeApiPath } from './link-tokens.js';
import { MAIL_PROVIDER, MailRejectedError, type MailAttachment, type MailProvider } from './mail-provider.js';
import { redactVars, renderTemplate, type RenderedBlock, type TemplateVars } from './template-renderer.js';

/** NOT-010 — a transient failure is retried for 72 hours. */
export const MAIL_RETRY_WINDOW_MS = 72 * 3600_000;
/** NOT-003 — last-resort sender in local, when neither `mail.fromAddress` nor MAIL_FROM_ADDRESS is set. */
export const LOCAL_FROM_ADDRESS = 'no-reply@diaspora-patrimoine.local';

/** NOT-002 — what replaces a secret value in the stored body. Stored data, shown as such in the e-mail log. */
const REDACTED = { link: '[lien personnel]', code: '[code]' } as const;

export const SuppressionReason = {
  TEMPLATE_INACTIVE: 'TEMPLATE_INACTIVE',
  TEMPLATE_MISSING: 'TEMPLATE_MISSING',
  NO_ADDRESS: 'NO_ADDRESS',
  PREFERENCE_DISABLED: 'PREFERENCE_DISABLED',
  // AUT-007 — stop conditions checked by the rule engine before an e-mail to a client.
  ADDRESS_BOUNCED: 'ADDRESS_BOUNCED',
  DO_NOT_CONTACT: 'DO_NOT_CONTACT',
  RESTRICTED: 'RESTRICTED',
  ACCOUNT_CLOSED: 'ACCOUNT_CLOSED',
  DOSSIER_ON_HOLD: 'DOSSIER_ON_HOLD',
  DOSSIER_CLOSED: 'DOSSIER_CLOSED',
} as const;

export interface SendTemplateInput {
  templateCode: string;
  to: string | null;
  /** NOT-011 — `{code}:{eventId}:{recipient}`. */
  dedupeKey: string;
  triggeredBy: 'EVENT' | 'SYSTEM' | 'WORKFLOW' | 'MANUAL';
  links: {
    clientId?: string | null;
    leadId?: string | null;
    dossierId?: string | null;
    staffUserId?: string | null;
    eventId?: string | null;
    registrationId?: string | null;
    simulationId?: string | null;
    /** AUT-009 — the rule whose action sends the e-mail (`triggeredBy` WORKFLOW). */
    ruleId?: string | null;
  };
  /** Files joined to the e-mail (CAF-050). Only their names, types and sizes are kept on the row. */
  attachments?: MailAttachment[];
  /** Template fields (NOT-050), values already formatted (NOT-051). */
  vars: TemplateVars;
  /** First name of the greeting (NOT-006). */
  greetingName: string | null;
  /** NOT-006 — the advisor's signature when there is one, else the team's. */
  signature?: string | null;
  /** NOT-010 — non-secret references kept in `metadata.render` (event id, objects cited). */
  render?: Record<string, unknown>;
  /** AUT-007 — when set, the e-mail is not sent and the row is SUPPRESSED with this reason. */
  suppress?: keyof typeof SuppressionReason | null;
  /**
   * NOT-010 — secret fields (a link with its token, a code) produced only when the e-mail really leaves: called after the
   * dedupe and suppression checks, right before rendering; its values are merged into `vars` (and redacted on the row).
   */
  secrets?: () => Promise<TemplateVars>;
  /**
   * NOT-061 `{{> block}}` — blocks built by the calling module (`properties`…), already escaped HTML and text;
   * `redacted` is the version stored on the row when the block carries links with a token (NOT-002).
   */
  blocks?: Record<string, RenderedBlock & { redacted?: RenderedBlock }>;
  /**
   * NOT-022 — an e-mail with its OWN way out (an alert made without an account): the one-click address of the
   * `List-Unsubscribe` header. When absent, an e-mail of a preference group sent to a client record gets the
   * « Gérer mes préférences » link and the one-click header of its group.
   */
  unsubscribe?: { oneClickPath: string } | null;
}

/** Deep merge of template variables (objects merged key by key; the right side wins). */
function mergeVars(a: TemplateVars, b: TemplateVars): TemplateVars {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    out[k] = prev && v && typeof prev === 'object' && typeof v === 'object' && !Array.isArray(prev) && !Array.isArray(v) ? mergeVars(prev as TemplateVars, v as TemplateVars) : v;
  }
  return out;
}

export type SendOutcome = 'SENT' | 'ALREADY_DONE' | 'SUPPRESSED' | 'FAILED';

export const recipientHash = (address: string) => createHash('sha256').update(address.toLowerCase()).digest('hex').slice(0, 12);

@Injectable()
export class MailerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
  ) {}

  async sendTemplate(input: SendTemplateInput): Promise<SendOutcome> {
    const now = this.clock.now();
    let row = await this.prisma.communication.findUnique({ where: { dedupeKey: input.dedupeKey } });
    if (row && row.deliveryState !== 'QUEUED') return 'ALREADY_DONE';

    const template = await this.prisma.emailTemplate.findFirst({ where: { code: input.templateCode, locale: 'fr', deletedAt: null } });
    const suppress = input.suppress ?? (!input.to ? 'NO_ADDRESS' : !template ? 'TEMPLATE_MISSING' : !template.isActive ? 'TEMPLATE_INACTIVE' : null);

    if (!row) {
      try {
        row = await this.prisma.communication.create({
          data: {
            id: newId(),
            channel: 'EMAIL',
            direction: 'OUTBOUND',
            clientId: input.links.clientId ?? null,
            leadId: input.links.leadId ?? null,
            dossierId: input.links.dossierId ?? null,
            staffUserId: input.links.staffUserId ?? null,
            eventId: input.links.eventId ?? null,
            registrationId: input.links.registrationId ?? null,
            simulationId: input.links.simulationId ?? null,
            ruleId: input.links.ruleId ?? null,
            attachments: input.attachments?.length
              ? (input.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, size: a.content.length })) as never)
              : undefined,
            templateCode: input.templateCode,
            toAddress: input.to,
            ccAddresses: [],
            deliveryState: suppress ? 'SUPPRESSED' : 'QUEUED',
            failureReason: suppress ?? null,
            triggeredBy: input.triggeredBy,
            occurredAt: now,
            dedupeKey: input.dedupeKey,
            metadata: { render: input.render ?? {} } as never,
            stateHistory: [{ state: suppress ? 'SUPPRESSED' : 'QUEUED', at: now.toISOString() }] as never,
            createdAt: now,
            updatedAt: now,
          },
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        return 'ALREADY_DONE'; // Another worker created it (FIA-041).
      }
    }
    if (suppress) return 'SUPPRESSED';
    if (!template || !input.to) return 'SUPPRESSED';

    // NOT-020, NOT-022 — an e-mail of a preference group: the group cut by the person is not sent; otherwise its foot
    // carries « Gérer mes préférences » and the one-click header of the group (the link is never stored, NOT-002).
    const group = (CLIENT_PREFERENCE_GROUPS as readonly string[]).includes(template.preferenceGroup ?? '') ? (template.preferenceGroup as ClientPreferenceGroup) : null;
    const footerLinks: { label: string; href: string }[] = [];
    const headers: Record<string, string> = {};
    if (group && input.links.clientId && !input.unsubscribe) {
      const pref = await this.preference(input.links.clientId, group);
      if (pref && !pref.enabled) {
        await this.finish(row.id, row.stateHistory, 'SUPPRESSED', { failureReason: SuppressionReason.PREFERENCE_DISABLED });
        return 'SUPPRESSED';
      }
      if (pref?.email) {
        const token = signPreferencesToken(this.env.LINK_SIGNING_KEY, input.links.clientId, group, row.id, pref.email);
        footerLinks.push({ label: createTranslator('fr')('ui.email.preferences'), href: `${this.env.WEB_URL}${preferencesPagePath(token)}` });
        headers['List-Unsubscribe'] = `<${this.env.WEB_URL}${unsubscribeApiPath(token)}>`;
        headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
      }
    } else if (input.unsubscribe) {
      headers['List-Unsubscribe'] = `<${this.env.WEB_URL}${input.unsubscribe.oneClickPath}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    const companyName = await this.settings.get('contact.companyName');
    const siteUrl = this.env.WEB_URL;
    const vars = input.secrets ? mergeVars(input.vars, await input.secrets()) : input.vars;
    const rendered = renderTemplate({ subject: template.subject, preheader: template.preheader, body: template.bodyHtml }, vars, { siteUrl, partials: input.blocks });
    if (rendered.missing.length) {
      // NOT-012 — a required field without value: not sent, FAILED, technical alert.
      await this.finish(row.id, row.stateHistory, 'FAILED', { failureReason: `MISSING_FIELD:${rendered.missing[0]}`.slice(0, 300), failedAt: now });
      log('error', 'mail.missing_field', { template: input.templateCode, field: rendered.missing[0] });
      return 'FAILED';
    }

    const footer = {
      companyName,
      legalName: (await this.settings.get('contact.legalName')) || undefined,
      address: (await this.settings.get('contact.address')) || undefined,
      phone: (await this.settings.get('contact.phone')) || undefined,
      email: (await this.settings.get('contact.email')) || undefined,
      reason: emailReason(template.audience, template.category, companyName, template.code),
      links: footerLinks,
    };
    const signature = input.signature || teamSignature(companyName);
    const full = wrapEmail({ subject: rendered.subject, preheader: rendered.preheader, contentHtml: rendered.html, contentText: rendered.text, greetingName: input.greetingName, signature, footer });

    // NOT-013 — outside production, every e-mail goes to the sandbox box, the original recipient in the subject.
    const sandbox = this.env.APP_ENV !== 'production' ? this.env.MAIL_SANDBOX_RECIPIENT : undefined;
    const to = sandbox ?? input.to;
    const subject = sandbox ? `[→ ${input.to}] ${rendered.subject}` : rendered.subject;
    const fromAddress = (await this.settings.get('mail.fromAddress')) || this.env.MAIL_FROM_ADDRESS || LOCAL_FROM_ADDRESS;
    const replyTo = (await this.settings.get('mail.replyTo')) || this.env.MAIL_REPLY_TO || null;
    const fromName = await this.settings.get('mail.fromName');

    try {
      const { providerMessageId } = await this.provider.send({
        from: { name: fromName, address: fromAddress },
        replyTo,
        to,
        subject,
        html: full.html,
        text: full.text,
        templateCode: template.code,
        attachments: input.attachments,
        headers: Object.keys(headers).length ? headers : undefined,
      });
      // NOT-002 — the stored body never holds a secret value.
      const redacted = renderTemplate(
        { subject: template.subject, preheader: template.preheader, body: template.bodyHtml },
        redactVars(vars, template.secretVariables, (p) => (p.endsWith('code') ? REDACTED.code : REDACTED.link)),
        { siteUrl, partials: input.blocks ? Object.fromEntries(Object.entries(input.blocks).map(([k, b]) => [k, b.redacted ?? b])) : undefined },
      );
      const sentAt = this.clock.now();
      await this.finish(row.id, row.stateHistory, 'SENT', {
        sentAt,
        providerMessageId,
        subject: rendered.subject.slice(0, 200),
        body: redacted.text,
        templateVersion: template.version,
        fromAddress,
        replyTo,
      });
      log('info', 'mail.sent', { template: template.code, to: recipientHash(input.to), provider: this.provider.name });
      return 'SENT';
    } catch (err) {
      if (err instanceof MailRejectedError) {
        await this.finish(row.id, row.stateHistory, 'FAILED', { failureReason: 'PROVIDER_REJECTED', failedAt: this.clock.now() });
        log('warn', 'mail.rejected', { template: template.code, to: recipientHash(input.to) });
        return 'FAILED';
      }
      if (now.getTime() - row.createdAt.getTime() > MAIL_RETRY_WINDOW_MS) {
        await this.finish(row.id, row.stateHistory, 'FAILED', { failureReason: 'PROVIDER_UNAVAILABLE', failedAt: this.clock.now() });
        log('error', 'mail.failed', { template: template.code, to: recipientHash(input.to) });
        return 'FAILED';
      }
      throw err; // Transient: the event is retried (FIA-043).
    }
  }

  /**
   * COM-020 … COM-022 — a HAND-WRITTEN e-mail (`triggeredBy = MANUAL`): its row exists already, QUEUED, with the subject
   * as the writer typed it; the caller gives the body already rendered (restricted Markdown → HTML and text). Same
   * envelope as every e-mail: the wrapper, the sandbox outside production (NOT-013), the platform's sender and
   * `mail.replyTo` (COM-021). A refusal of the provider marks it FAILED; a transient failure throws while the e-mail
   * is younger than 72 hours — the caller tries again (NOT-010).
   */
  async sendManual(input: {
    communicationId: string;
    contentHtml: string;
    contentText: string;
    greetingName: string | null;
    /** « {Prénom N.} — {fonction} », then the lines of the adviser's signature. */
    signature: string;
    audience: 'CLIENT' | 'PARTNER';
  }): Promise<SendOutcome> {
    const now = this.clock.now();
    const row = await this.prisma.communication.findUnique({ where: { id: input.communicationId } });
    if (!row || row.triggeredBy !== 'MANUAL' || row.channel !== 'EMAIL' || row.deliveryState !== 'QUEUED') return 'ALREADY_DONE';
    if (!row.toAddress || !row.subject) {
      await this.finish(row.id, row.stateHistory, 'FAILED', { failureReason: row.toAddress ? 'MISSING_FIELD:subject' : SuppressionReason.NO_ADDRESS, failedAt: now });
      return 'FAILED';
    }
    const companyName = await this.settings.get('contact.companyName');
    const code = row.templateCode ?? 'C_MANUAL_BLANK';
    const footer = {
      companyName,
      legalName: (await this.settings.get('contact.legalName')) || undefined,
      address: (await this.settings.get('contact.address')) || undefined,
      phone: (await this.settings.get('contact.phone')) || undefined,
      email: (await this.settings.get('contact.email')) || undefined,
      reason: emailReason(input.audience, 'MANUAL', companyName, input.audience === 'PARTNER' ? 'P_PARTNER_MANUAL' : code),
      links: [],
    };
    const full = wrapEmail({ subject: row.subject, preheader: null, contentHtml: input.contentHtml, contentText: input.contentText, greetingName: input.greetingName, signature: input.signature, footer });
    const sandbox = this.env.APP_ENV !== 'production' ? this.env.MAIL_SANDBOX_RECIPIENT : undefined;
    const fromAddress = (await this.settings.get('mail.fromAddress')) || this.env.MAIL_FROM_ADDRESS || LOCAL_FROM_ADDRESS;
    const replyTo = (await this.settings.get('mail.replyTo')) || this.env.MAIL_REPLY_TO || null;
    try {
      const { providerMessageId } = await this.provider.send({
        from: { name: await this.settings.get('mail.fromName'), address: fromAddress },
        replyTo,
        to: sandbox ?? row.toAddress,
        subject: sandbox ? `[→ ${row.toAddress}] ${row.subject}` : row.subject,
        html: full.html,
        text: full.text,
        templateCode: code,
      });
      const sentAt = this.clock.now();
      await this.finish(row.id, row.stateHistory, 'SENT', { sentAt, occurredAt: sentAt, providerMessageId, body: input.contentText, fromAddress, replyTo });
      log('info', 'mail.sent', { template: code, to: recipientHash(row.toAddress), provider: this.provider.name, manual: true });
      return 'SENT';
    } catch (err) {
      const since = (row.scheduledFor ?? row.createdAt).getTime();
      if (err instanceof MailRejectedError || now.getTime() - since > MAIL_RETRY_WINDOW_MS) {
        await this.finish(row.id, row.stateHistory, 'FAILED', { failureReason: err instanceof MailRejectedError ? 'PROVIDER_REJECTED' : 'PROVIDER_UNAVAILABLE', failedAt: this.clock.now() });
        log('warn', 'mail.failed', { template: code, to: recipientHash(row.toAddress), manual: true });
        return 'FAILED';
      }
      throw err; // transient: tried again by the scheduled task
    }
  }

  /** A hand-written e-mail that must not leave (COM-020: cancelled by its author, or stopped at departure). */
  async closeManual(communicationId: string, state: 'CANCELLED' | 'SUPPRESSED', reason: string | null): Promise<boolean> {
    const row = await this.prisma.communication.findUnique({ where: { id: communicationId }, select: { id: true, stateHistory: true, deliveryState: true, triggeredBy: true } });
    if (!row || row.triggeredBy !== 'MANUAL' || row.deliveryState !== 'QUEUED') return false;
    const now = this.clock.now();
    const list = Array.isArray(row.stateHistory) ? row.stateHistory : [];
    // the state is part of the condition: an e-mail that left meanwhile is never marked cancelled (FIA-020)
    const done = await this.prisma.communication.updateMany({
      where: { id: row.id, deliveryState: 'QUEUED' },
      data: { deliveryState: state, failureReason: reason, ...(state === 'CANCELLED' ? { cancelledAt: now } : {}), stateHistory: [...list, { state, at: now.toISOString() }] as never, updatedAt: now },
    });
    return done.count === 1;
  }

  /**
   * NOT-020 — the e-mail switch of a group for a client record: the stored row, else the default (on, except `NEWS`,
   * which follows the marketing consent). Null when the record cannot receive anything (erased, unknown).
   */
  private async preference(clientId: string, group: ClientPreferenceGroup): Promise<{ enabled: boolean; email: string | null } | null> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { email: true, gdprErasedAt: true, marketingOptIn: true } });
    if (!client || client.gdprErasedAt) return null;
    const row = await this.prisma.notificationPreference.findFirst({ where: { clientId, group }, orderBy: { updatedAt: 'desc' }, select: { emailEnabled: true } });
    return { enabled: row ? row.emailEnabled : group === 'NEWS' ? client.marketingOptIn : true, email: client.email };
  }

  private async finish(id: string, history: unknown, state: 'SENT' | 'FAILED' | 'SUPPRESSED', data: Record<string, unknown>): Promise<void> {
    const now = this.clock.now();
    const list = Array.isArray(history) ? history : [];
    await this.prisma.communication.update({
      where: { id },
      data: { ...data, deliveryState: state, stateHistory: [...list, { state, at: now.toISOString() }] as never, updatedAt: now },
    });
  }
}
