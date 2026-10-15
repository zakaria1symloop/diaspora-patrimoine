// Package 3.2 « E-mail écrit à la main » — COM-020 … COM-022, NOT-006, NOT-014, NOT-043, NOT-061, CRM-060, ADM-063.
//   · the window (`compose`): the recipient — the client's address, never editable (absent: the window does not open,
//     MOD-302), or the applicant of a partner request —, the manual templates of the audience and « Message libre »,
//     their texts with the dynamic fields ALREADY replaced, the warnings, the signature (COM-021);
//   · `preview`: the e-mail in its real layout;
//   · `send`: now, or later (`scheduledFor`). The row `Communication` (MANUAL, QUEUED, subject and rendered content) is
//     written in the transaction; it leaves right after the commit, or from the scheduled task `emails.manual` — which
//     checks again, at departure, that the client did not object, was not archived nor erased (else SUPPRESSED and its
//     author notified, COM-020). A manual e-mail really sent to a client is a first contact (COM-022, CYC-004); one
//     that fails or bounces notifies its author (`NS_EMAIL_FAILED`) and the first contact is recomputed.
// Attachments (five files, 10 MB, MED-010) come through API-080 (`email-attachments.service.ts`), checked before they
// leave (MED-021), and are joined to the e-mail when it leaves — now or at its scheduled time.
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  ErrorCode,
  emailPreviewSchema,
  emailSendSchema,
  staffSignatureLines,
  type EmailComposeContext,
  type EmailPreview,
  type EmailSendResult,
  type EmailTemplateOption,
  type EmailWarning,
} from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { writeAudit } from '../admin/audit.js';
import { domainEvent, toEnvelope } from '../automation/event-catalogue.js';
import { Scheduler } from '../automation/scheduler.js';
import { staffLink } from '../automation/staff-links.js';
import { StaffNotifier } from '../automation/staff-notifications.service.js';
import { StaffViews, clientName, type StaffView } from '../back-office/staff-view.js';
import { emailReason, wrapEmail } from '../communication/email-layout.js';
import { MailerService } from '../communication/mailer.service.js';
import { EmailAttachmentsService, type StoredAttachment } from './email-attachments.service.js';
import { renderTemplate } from '../communication/template-renderer.js';
import { ENV, type Env } from '../config/env.js';
import { syncFirstContact } from '../crm/first-contact.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxHandlers, OutboxWriter, type EventDispatcher, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { currentRequestId, log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import { parseOrThrow } from '../platform/validation.js';
import { resolveTarget, type ExchangeTargetIds } from './exchanges.service.js';
import { SYSTEM_ACTOR } from '../admin/actor.js';

const t = createTranslator('fr');

/** NOT-050 `advisor.displayName` — « Amel K. ». */
const displayName = (first: string | null, last: string | null) => (first ? (last ? `${first} ${last.charAt(0).toUpperCase()}.` : first) : null);

/** A user's text never becomes a tag of the template language: `{{` is broken apart before rendering. */
const inert = (s: string) => s.replace(/\{\{/g, '{ {').replace(/\}\}/g, '} }');

type Vars = Record<string, unknown>;

/** The value of a dotted path in the variables. */
function lookup(vars: Vars, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => (acc !== null && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), vars);
}

/**
 * COM-020 — the text of a template with its dynamic fields replaced, still in restricted Markdown (the writer edits
 * it): conditions without nesting and fields; the button is taken apart.
 */
export function fillTemplate(source: string, vars: Vars, siteUrl: string): { text: string; button: { label: string; href: string } | null } {
  let button: { label: string; href: string } | null = null;
  let text = source.replace(/\{\{\s*button\s+"([^"]*)"\s+(\S+?)\s*\}\}/g, (_, label: string, target: string) => {
    if (!button) {
      const [field, ...rest] = target.split('/');
      const href = target.startsWith('/') || /^(https?:|mailto:|tel:)/.test(target) ? target : `${String(lookup(vars, field!) ?? '')}${rest.length ? `/${rest.join('/')}` : ''}`;
      if (href) button = { label, href: href.startsWith('/') ? `${siteUrl.replace(/\/$/, '')}${href}` : href };
    }
    return '';
  });
  for (let i = 0; i < 5; i += 1) {
    const before = text;
    text = text.replace(/\{\{#if\s+([\w.]+)\s*\}\}((?:(?!\{\{#if)[\s\S])*?)(?:\{\{else\}\}((?:(?!\{\{#if)[\s\S])*?))?\{\{\/if\}\}/g, (_, path: string, yes: string, no?: string) => {
      const v = lookup(vars, path);
      return v === undefined || v === null || v === '' || v === false ? (no ?? '') : yes;
    });
    if (text === before) break;
  }
  text = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => String(lookup(vars, path) ?? ''));
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), button };
}

@Injectable()
export class ManualEmailService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly views: StaffViews,
    private readonly outbox: OutboxWriter,
    private readonly mailer: MailerService,
    private readonly notifier: StaffNotifier,
    private readonly scheduler: Scheduler,
    private readonly handlers: OutboxHandlers,
    private readonly files: EmailAttachmentsService,
    @Inject(ENV) private readonly env: Env,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  onModuleInit(): void {
    this.scheduler.register({ name: 'emails.manual', schedule: { everyMinutes: 1 }, run: () => this.runDue() });
    this.handlers.register({ name: 'emails.manual-bounce', types: ['email.bounced', 'email.complained'], handle: (e) => this.onBounce(e) });
  }

  // ─── The window ───────────────────────────────────────────────────────────

  private async recipientOf(target: ExchangeTargetIds) {
    const client = target.clientId
      ? await this.prisma.client.findUnique({ where: { id: target.clientId }, select: { id: true, email: true, firstName: true, lastName: true, emailBouncedAt: true, emailDoubtful: true, doNotContact: true, doNotContactReason: true, doNotContactAt: true, restrictedAt: true, gdprErasedAt: true, assignedAgentId: true, deletedAt: true } })
      : null;
    const lead = target.leadId ? await this.prisma.lead.findUnique({ where: { id: target.leadId }, select: { kind: true, email: true, firstName: true, lastName: true, assignedAgentId: true } }) : null;
    return { client, lead };
  }

  private async company() {
    const whatsapp = await this.settings.get('contact.whatsapp');
    const phone = await this.settings.get('contact.phone');
    return {
      name: await this.settings.get('contact.companyName'),
      phone: phone ? (parsePhoneNumberFromString(phone)?.formatInternational() ?? phone) : null,
      email: (await this.settings.get('contact.email')) || null,
      whatsappUrl: whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : null,
      siteUrl: this.env.WEB_URL,
    };
  }

  /** `GET /admin/emails/compose?leadId=&clientId=&dossierId=` (`email.send`). */
  async compose(auth: AuthContext, query: Record<string, unknown>): Promise<EmailComposeContext> {
    const staff = await this.views.of(auth);
    const id = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { firstName: true, lastName: true, jobTitle: true, signature: true, timezone: true } });
    const lines = staffSignatureLines(me);
    const base = {
      signature: { line: lines[0] ?? '', text: me.signature },
      sender: { fromName: await this.settings.get('mail.fromName'), replyTo: (await this.settings.get('mail.replyTo')) || this.env.MAIL_REPLY_TO || null },
      timeZone: me.timezone,
      contacts: null,
      contactId: null,
    };
    // CTL-006 — « Écrire au promoteur »: one of his contacts, his manual templates (P_PROMOTER_*) and « Message libre »
    if (id(query.promoterId)) {
      const p = await this.partnerContext(staff, { promoterId: id(query.promoterId)!, dossierId: id(query.dossierId), contactId: id(query.contactId) });
      if (!p.contact) return { ...base, blocked: 'NO_ADDRESS', recipient: null, warnings: [], templates: [], contacts: p.contacts };
      const rows = await this.prisma.emailTemplate.findMany({
        where: { locale: 'fr', deletedAt: null, isActive: true, OR: [{ code: 'C_MANUAL_BLANK' }, { audience: 'PARTNER', sentBy: { has: 'MANUAL' }, code: { startsWith: 'P_PROMOTER_' } }] },
        select: { code: true, name: true, subject: true, bodyHtml: true },
        orderBy: { name: 'asc' },
      });
      const vars = { ...(await this.partnerVars(p)), advisor: { firstName: me.firstName, displayName: displayName(me.firstName, me.lastName), jobTitle: me.jobTitle }, company: await this.company() };
      const list = [...rows.filter((r) => r.code === 'C_MANUAL_BLANK'), ...rows.filter((r) => r.code !== 'C_MANUAL_BLANK')];
      const templates: EmailTemplateOption[] = list.map((r) => {
        const body = fillTemplate(r.bodyHtml, vars, this.env.WEB_URL);
        return { code: r.code, name: r.name, subject: fillTemplate(r.subject, vars, this.env.WEB_URL).text, body: body.text, button: body.button };
      });
      return { ...base, blocked: null, recipient: { address: p.contact.email, name: p.contact.name, firstName: firstNameOf(p.contact.name), kind: 'PARTNER' }, warnings: [], templates, contacts: p.contacts, contactId: p.contact.id };
    }
    const target = await resolveTarget(this.prisma, staff, { leadId: id(query.leadId), clientId: id(query.clientId), dossierId: id(query.dossierId) });
    const { client, lead } = await this.recipientOf(target);
    const applicant = !client && lead?.kind === 'PARTNER_REQUEST';
    if (client?.gdprErasedAt) return { blocked: 'ERASED', recipient: null, warnings: [], templates: [], ...base };
    const address = client ? client.email : applicant ? lead!.email : null;
    if (!address) return { blocked: 'NO_ADDRESS', recipient: null, warnings: [], templates: [], ...base };
    const firstName = client ? client.firstName : lead!.firstName;
    const warnings: EmailWarning[] = [];
    if (client?.emailBouncedAt) warnings.push({ code: 'ADDRESS_BOUNCED', date: client.emailBouncedAt.toISOString() });
    if (client?.doNotContact) warnings.push({ code: 'DO_NOT_CONTACT', reason: staff.masked ? null : client.doNotContactReason, date: client.doNotContactAt?.toISOString() ?? null });
    if (client?.restrictedAt) warnings.push({ code: 'RESTRICTED', date: client.restrictedAt.toISOString() });
    if (client?.emailDoubtful) warnings.push({ code: 'EMAIL_DOUBTFUL' });

    // COM-020 — the manual templates of the audience, and « Message libre »
    const rows = await this.prisma.emailTemplate.findMany({
      where: { locale: 'fr', deletedAt: null, isActive: true, audience: applicant ? 'PARTNER' : 'CLIENT', sentBy: { has: 'MANUAL' }, ...(applicant ? {} : {}) },
      select: { code: true, name: true, subject: true, bodyHtml: true },
      orderBy: { name: 'asc' },
    });
    const blank = await this.prisma.emailTemplate.findFirst({ where: { code: 'C_MANUAL_BLANK', locale: 'fr', deletedAt: null }, select: { code: true, name: true, subject: true, bodyHtml: true } });
    const vars = { client: { firstName }, advisor: { firstName: me.firstName, displayName: displayName(me.firstName, me.lastName), jobTitle: me.jobTitle }, company: await this.company() };
    const list = applicant ? (blank ? [blank] : []) : [...(blank ? [blank] : []), ...rows.filter((r) => r.code !== 'C_MANUAL_BLANK')];
    const templates: EmailTemplateOption[] = list.map((r) => {
      const subject = fillTemplate(r.subject, vars, this.env.WEB_URL).text;
      const body = fillTemplate(r.bodyHtml, vars, this.env.WEB_URL);
      return { code: r.code, name: r.name, subject, body: body.text, button: body.button };
    });
    const name = client ? clientName(client) : [lead?.lastName?.toLocaleUpperCase('fr'), lead?.firstName].filter(Boolean).join(' ') || null;
    return { blocked: null, recipient: { address, name, firstName, kind: client ? 'CLIENT' : 'APPLICANT' }, warnings, templates, ...base };
  }

  /** Restricted Markdown of the writer (NOT-061) → HTML and text; the template's button kept or not. */
  /** CTL-006 — the promoter, his contacts with an address, the one written to; the dossier it may start from (his). */
  private async partnerContext(staff: StaffView, input: { promoterId: string; dossierId: string | null; contactId: string | null }) {
    const promoter = await this.prisma.promoter.findFirst({ where: { id: input.promoterId, deletedAt: null }, select: { id: true, legalName: true, brandName: true } });
    if (!promoter) throw AppError.notFound();
    let dossier: { id: string; property: { reference: string; title: string; program: { name: string } | null } | null; lot: { reference: string } | null } | null = null;
    if (input.dossierId) {
      await resolveTarget(this.prisma, staff, { leadId: null, clientId: null, dossierId: input.dossierId }); // in the reader's perimeter
      const d = await this.prisma.dossier.findUnique({ where: { id: input.dossierId }, select: { id: true, promoterId: true, property: { select: { reference: true, title: true, program: { select: { name: true } } } }, lot: { select: { reference: true } } } });
      if (!d || d.promoterId !== promoter.id) throw AppError.validation([{ field: 'promoterId', code: 'INVALID_CHOICE' }]);
      dossier = d;
    }
    const contacts = (
      await this.prisma.promoterContact.findMany({ where: { promoterId: promoter.id, email: { not: null } }, orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }], select: { id: true, fullName: true, email: true, isPrimary: true } })
    ).map((c) => ({ id: c.id, name: c.fullName, email: c.email!, isPrimary: c.isPrimary }));
    const contact = input.contactId ? contacts.find((c) => c.id === input.contactId) : contacts[0];
    if (input.contactId && !contact) throw AppError.validation([{ field: 'contactId', code: 'INVALID_CHOICE' }]);
    return { promoter, dossier, contacts, contact: contact ?? null };
  }

  /** The dynamic fields of the promoter's templates (01-domaine/09: P_PROMOTER_OPTION_REQUEST, …_VISIT_REQUEST, …_STOCK_CHECK). */
  private async partnerVars(p: { promoter: { id: string }; dossier: { property: { reference: string; title: string; program: { name: string } | null } | null; lot: { reference: string } | null } | null; contact: { name: string } | null }) {
    const tz = await this.settings.get('business.calendar.timezone');
    const optionDays = await this.settings.get('reservation.optionDays');
    const until = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: tz }).format(new Date(this.clock.now().getTime() + optionDays * 86_400_000));
    const programs = await this.prisma.program.findMany({ where: { promoterId: p.promoter.id, deletedAt: null, publication: 'PUBLISHED' }, select: { name: true, lotsAvailable: true, lotsTotal: true }, orderBy: { name: 'asc' } });
    return {
      property: p.dossier?.property ? { reference: p.dossier.property.reference, title: p.dossier.property.title, programName: p.dossier.property.program?.name ?? null } : null,
      lot: p.dossier?.lot ? { reference: p.dossier.lot.reference } : null,
      action: {
        recipientName: p.contact?.name ?? '',
        untilLabel: until,
        slotsLabel: t('ui.admin-exchanges.partner.slotsToAgree'),
        lotsLabel: programs.length ? programs.map((x) => t('ui.admin-exchanges.partner.programLots', { programme: x.name, n: x.lotsAvailable, total: x.lotsTotal })).join(' ; ') : t('ui.admin-exchanges.partner.noProgram'),
      },
    };
  }

  private async content(input: { templateCode: string; body: string; includeButton: boolean }) {
    const template = await this.prisma.emailTemplate.findFirst({ where: { code: input.templateCode, locale: 'fr', deletedAt: null, isActive: true, sentBy: { has: 'MANUAL' } }, select: { code: true, bodyHtml: true, audience: true } });
    if (!template) throw AppError.validation([{ field: 'templateCode', code: 'INVALID_CHOICE' }]);
    const button = input.includeButton ? fillTemplate(template.bodyHtml, {}, this.env.WEB_URL).button : null;
    const source = inert(input.body) + (button ? `\n\n{{button "${button.label.replace(/"/g, '”')}" ${button.href}}}` : '');
    const rendered = renderTemplate({ subject: 'x', body: source }, {}, { siteUrl: this.env.WEB_URL });
    return { html: rendered.html, text: rendered.text, audience: template.audience as 'CLIENT' | 'PARTNER' };
  }

  private async signatureOf(userId: string): Promise<string> {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, lastName: true, jobTitle: true, signature: true } });
    const company = await this.settings.get('contact.companyName');
    const lines = staffSignatureLines(me);
    return lines.length ? lines.join('\n') : t('ui.email.signatureTeam', { company });
  }

  /** `POST /admin/emails/preview` (`email.send`) — the e-mail in its layout. */
  async preview(auth: AuthContext, body: unknown): Promise<EmailPreview> {
    const input = parseOrThrow(emailPreviewSchema, body);
    const staff = await this.views.of(auth);
    const partner = input.promoterId ? await this.partnerContext(staff, { promoterId: input.promoterId, dossierId: input.dossierId, contactId: input.contactId }) : null;
    const target = partner ? null : await resolveTarget(this.prisma, staff, input);
    const { client, lead } = target ? await this.recipientOf(target) : { client: null, lead: null };
    const content = await this.content(input);
    if (partner) content.audience = 'PARTNER';
    const companyName = await this.settings.get('contact.companyName');
    const subject = input.subject.trim() || '…';
    const full = wrapEmail({
      subject,
      preheader: null,
      contentHtml: content.html,
      contentText: content.text,
      greetingName: partner ? firstNameOf(partner.contact?.name ?? null) : (client?.firstName ?? lead?.firstName ?? null),
      signature: await this.signatureOf(auth.userId),
      footer: { companyName, legalName: (await this.settings.get('contact.legalName')) || undefined, address: (await this.settings.get('contact.address')) || undefined, phone: (await this.settings.get('contact.phone')) || undefined, email: (await this.settings.get('contact.email')) || undefined, reason: emailReason(content.audience, 'MANUAL', companyName, input.templateCode), links: [] },
    });
    return { subject, html: full.html };
  }

  /** `POST /admin/emails/send` (`email.send`) — COM-020: now, or later. */
  async send(auth: AuthContext, body: unknown): Promise<EmailSendResult> {
    const input = parseOrThrow(emailSendSchema, body);
    const staff = await this.views.of(auth);
    const now = this.clock.now();
    if (input.promoterId) return this.sendToPartner(auth, staff, input, now);
    const target = await resolveTarget(this.prisma, staff, input);
    const context = await this.compose(auth, { ...target });
    if (context.blocked || !context.recipient) throw AppError.conflictState(context.blocked === 'ERASED' ? 'CLIENT_ERASED' : 'NO_EMAIL_ADDRESS');
    // CRM-060, ADM-063 — « {client} a demandé à ne pas être contacté : {raison}. Envoyer quand même ? »
    const unconfirmed = context.warnings.filter((w) => (w.code === 'DO_NOT_CONTACT' || w.code === 'RESTRICTED') && !input.confirmed.includes(w.code));
    if (unconfirmed.length) throw AppError.conflictState('CONFIRMATION_REQUIRED', { warnings: unconfirmed.map((w) => w.code).join(',') });
    let scheduledFor: Date | null = null;
    if (input.scheduledFor) {
      scheduledFor = new Date(input.scheduledFor);
      if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < now.getTime() + 60_000) throw AppError.validation([{ field: 'scheduledFor', code: 'DATE_NOT_FUTURE' }]);
    }
    const content = await this.content(input);
    const signature = await this.signatureOf(auth.userId);
    const id = newId();
    let attachments: StoredAttachment[] | null = null;
    await this.prisma.$transaction(async (tx) => {
      attachments = await this.files.claim(tx, auth.userId, input.attachmentIds, id, now);
      await tx.communication.create({
        data: {
          id,
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          attachments: (attachments ?? undefined) as never,
          leadId: target.leadId,
          clientId: target.clientId,
          dossierId: target.dossierId,
          templateCode: input.templateCode,
          subject: input.subject.slice(0, 200),
          body: content.text,
          toAddress: context.recipient!.address,
          ccAddresses: [],
          deliveryState: 'QUEUED',
          triggeredBy: 'MANUAL',
          sentById: auth.userId,
          staffUserId: auth.userId,
          scheduledFor,
          occurredAt: scheduledFor ?? now,
          stateHistory: [{ state: 'QUEUED', at: now.toISOString() }] as never,
          // a hand-written e-mail carries no token: its rendered content waits here until it leaves
          metadata: { manual: { html: content.html, text: content.text, signature, greetingName: context.recipient!.firstName, audience: content.audience, confirmed: input.confirmed } } as never,
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, auth.actor, now, { action: 'email.sent_manually', entityType: 'Communication', entityId: id, clientId: target.clientId, after: { templateCode: input.templateCode, leadId: target.leadId, dossierId: target.dossierId, scheduledFor, attachments: attachments?.length ?? 0 } });
    });
    await this.files.dropTemporary(attachments);
    if (scheduledFor) return { id, state: 'QUEUED', scheduledFor: scheduledFor.toISOString() };
    const state = await this.deliver(id);
    return { id, state: state === 'SENT' ? 'SENT' : state === 'FAILED' ? 'FAILED' : 'QUEUED', scheduledFor: null };
  }

  /** `POST /admin/emails/{id}/cancel` (`email.send`) — a scheduled e-mail of its author, while it has not left. */
  async cancel(auth: AuthContext, id: string): Promise<{ id: string }> {
    const row = await this.prisma.communication.findUnique({ where: { id }, select: { sentById: true, triggeredBy: true, deliveryState: true, clientId: true } });
    if (!row || row.triggeredBy !== 'MANUAL') throw AppError.notFound();
    if (row.sentById !== auth.userId) throw new AppError(ErrorCode.FORBIDDEN);
    if (row.deliveryState !== 'QUEUED' || !(await this.mailer.closeManual(id, 'CANCELLED', null))) throw AppError.conflictState('EMAIL_ALREADY_SENT');
    await this.prisma.$transaction((tx) => writeAudit(tx, auth.actor, this.clock.now(), { action: 'communication.updated', entityType: 'Communication', entityId: id, clientId: row.clientId, after: { deliveryState: 'CANCELLED' } }));
    return { id };
  }

  // ─── Departure ────────────────────────────────────────────────────────────

  /** COM-020 — checked again at departure: an objection, an archive or an erasure since the writing stops it. */
  private async stopReason(row: { clientId: string | null; metadata: unknown }): Promise<string | null> {
    if (!row.clientId) return null;
    const c = await this.prisma.client.findUnique({ where: { id: row.clientId }, select: { doNotContact: true, archivedAt: true, gdprErasedAt: true, deletedAt: true, restrictedAt: true } });
    if (!c || c.gdprErasedAt || c.deletedAt) return 'RESTRICTED';
    const confirmed = ((row.metadata as { manual?: { confirmed?: string[] } } | null)?.manual?.confirmed ?? []) as string[];
    if (c.doNotContact && !confirmed.includes('DO_NOT_CONTACT')) return 'DO_NOT_CONTACT';
    if (c.restrictedAt && !confirmed.includes('RESTRICTED')) return 'RESTRICTED';
    if (c.archivedAt) return 'CLIENT_ARCHIVED';
    return null;
  }

  /**
   * CTL-006 — to a promoter's contact, a second one in copy: the e-mail belongs to the promoter (`promoterId`) and, sent
   * from a dossier, to the dossier's history — never to the client's (no `clientId`). A rejected address warns the
   * author and touches no client record (AUT-071).
   */
  private async sendToPartner(auth: AuthContext, staff: StaffView, input: ReturnType<typeof emailSendSchema.parse>, now: Date): Promise<EmailSendResult> {
    const p = await this.partnerContext(staff, { promoterId: input.promoterId!, dossierId: input.dossierId, contactId: input.contactId });
    if (!p.contact) throw AppError.conflictState('NO_EMAIL_ADDRESS');
    const cc = input.ccContactId ? p.contacts.find((c) => c.id === input.ccContactId && c.id !== p.contact!.id) : null;
    if (input.ccContactId && !cc) throw AppError.validation([{ field: 'ccContactId', code: 'INVALID_CHOICE' }]);
    let scheduledFor: Date | null = null;
    if (input.scheduledFor) {
      scheduledFor = new Date(input.scheduledFor);
      if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < now.getTime() + 60_000) throw AppError.validation([{ field: 'scheduledFor', code: 'DATE_NOT_FUTURE' }]);
    }
    const content = await this.content(input);
    const signature = await this.signatureOf(auth.userId);
    const id = newId();
    let attachments: StoredAttachment[] | null = null;
    await this.prisma.$transaction(async (tx) => {
      attachments = await this.files.claim(tx, auth.userId, input.attachmentIds, id, now);
      await tx.communication.create({
        data: {
          id,
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          attachments: (attachments ?? undefined) as never,
          promoterId: p.promoter.id,
          dossierId: p.dossier?.id ?? null,
          templateCode: input.templateCode,
          subject: input.subject.slice(0, 200),
          body: content.text,
          toAddress: p.contact!.email,
          ccAddresses: cc ? [cc.email] : [],
          deliveryState: 'QUEUED',
          triggeredBy: 'MANUAL',
          sentById: auth.userId,
          staffUserId: auth.userId,
          scheduledFor,
          occurredAt: scheduledFor ?? now,
          stateHistory: [{ state: 'QUEUED', at: now.toISOString() }] as never,
          metadata: { manual: { html: content.html, text: content.text, signature, greetingName: firstNameOf(p.contact!.name), audience: 'PARTNER', confirmed: [] } } as never,
          createdAt: now,
          updatedAt: now,
        },
      });
      await writeAudit(tx, auth.actor, now, { action: 'email.sent_manually', entityType: 'Communication', entityId: id, after: { templateCode: input.templateCode, promoterId: p.promoter.id, dossierId: p.dossier?.id ?? null, scheduledFor, cc: cc ? 1 : 0, attachments: attachments?.length ?? 0 } });
    });
    await this.files.dropTemporary(attachments);
    if (scheduledFor) return { id, state: 'QUEUED', scheduledFor: scheduledFor.toISOString() };
    const state = await this.deliver(id);
    return { id, state: state === 'SENT' ? 'SENT' : state === 'FAILED' ? 'FAILED' : 'QUEUED', scheduledFor: null };
  }

  /** Sends one queued manual e-mail; effects of the outcome (first contact, NS_EMAIL_FAILED). */
  async deliver(id: string): Promise<'SENT' | 'FAILED' | 'SUPPRESSED' | 'WAITING'> {
    const row = await this.prisma.communication.findUnique({ where: { id }, select: { id: true, clientId: true, leadId: true, dossierId: true, sentById: true, metadata: true, deliveryState: true, toAddress: true, attachments: true } });
    if (!row || row.deliveryState !== 'QUEUED') return 'WAITING';
    const stop = await this.stopReason(row);
    if (stop) {
      if (await this.mailer.closeManual(id, 'SUPPRESSED', stop)) await this.failed(row, 'suppressed');
      return 'SUPPRESSED';
    }
    const m = (row.metadata as { manual?: { html: string; text: string; signature: string; greetingName: string | null; audience: 'CLIENT' | 'PARTNER' } }).manual;
    if (!m) return 'WAITING';
    let outcome;
    try {
      const attachments = await this.files.contents(row.attachments);
      outcome = await this.mailer.sendManual({ communicationId: id, contentHtml: m.html, contentText: m.text, greetingName: m.greetingName, signature: m.signature, audience: m.audience, attachments });
    } catch {
      log('warn', 'mail.manual_retry', { id });
      return 'WAITING'; // transient: the scheduled task tries again (NOT-010)
    }
    if (outcome === 'SENT') {
      const now = this.clock.now();
      await this.prisma.$transaction(async (tx) => {
        await this.outbox.add(tx, domainEvent({ type: 'communication.email_sent', aggregate: { type: 'Communication', id }, actor: { type: 'USER', id: row.sentById }, clientId: row.clientId, dossierId: row.dossierId, data: { templateCode: 'MANUAL' }, requestId: currentRequestId() === 'req_none' ? null : currentRequestId() }), now);
        if (row.clientId) await tx.client.update({ where: { id: row.clientId }, data: { lastActivityAt: now } });
        // COM-022 — a manual e-mail sent to a client is a first contact (CYC-004)
        if (row.clientId || row.leadId) await syncFirstContact(tx, this.outbox, { leadIds: row.leadId ? [row.leadId] : [], clientId: row.clientId, actor: SYSTEM_ACTOR, now });
      });
      this.dispatcher.wake();
      return 'SENT';
    }
    if (outcome === 'FAILED') await this.failed(row, 'failed');
    return outcome === 'FAILED' ? 'FAILED' : 'WAITING';
  }

  /** NS_EMAIL_FAILED — « L'e-mail envoyé à {client} n'a pas pu être remis. » to its author. */
  private async failed(row: { id: string; clientId: string | null; leadId: string | null; sentById: string | null; toAddress: string | null }, kind: 'failed' | 'suppressed'): Promise<void> {
    if (!row.sentById) return;
    const client = row.clientId ? await this.prisma.client.findUnique({ where: { id: row.clientId }, select: { id: true, firstName: true, lastName: true } }) : null;
    const lead = row.leadId ? await this.prisma.lead.findUnique({ where: { id: row.leadId }, select: { id: true, reference: true } }) : null;
    const name = (client && [client.firstName, client.lastName].filter(Boolean).join(' ')) || row.toAddress || '';
    await this.notifier.notify(this.prisma, this.clock.now(), {
      type: 'NS_EMAIL_FAILED',
      userIds: [row.sentById],
      title: kind === 'failed' ? t('ui.notifications.NS_EMAIL_FAILED', { client: name }) : t('ui.admin-exchanges.notification.suppressed', { client: name }),
      link: client ? staffLink('Client', client) : lead ? staffLink('Lead', lead) : null,
      entityType: client ? 'Client' : lead ? 'Lead' : null,
      entityId: client?.id ?? lead?.id ?? null,
      originId: `email:${row.id}`,
    });
  }

  /** The scheduled task: the e-mails whose time has come, and those waiting for a new try. */
  async runDue(): Promise<Record<string, number>> {
    const now = this.clock.now();
    const due = await this.prisma.communication.findMany({
      where: { channel: 'EMAIL', triggeredBy: 'MANUAL', direction: 'OUTBOUND', deliveryState: 'QUEUED', OR: [{ scheduledFor: { lte: now } }, { scheduledFor: null, createdAt: { lt: new Date(now.getTime() - 60_000) } }] },
      select: { id: true },
      take: 100,
    });
    const counters = { scanned: due.length, sent: 0, failed: 0, suppressed: 0, waiting: 0 };
    for (const r of due) {
      const s = await this.deliver(r.id);
      if (s === 'SENT') counters.sent += 1;
      else if (s === 'FAILED') counters.failed += 1;
      else if (s === 'SUPPRESSED') counters.suppressed += 1;
      else counters.waiting += 1;
    }
    return counters;
  }

  /** COM-022, CYC-004 — a manual e-mail rejected afterwards: its author is told, the first contact recomputed. */
  async onBounce(record: OutboxRecord): Promise<void> {
    const e = toEnvelope(record);
    const id = typeof e.data.communicationId === 'string' ? e.data.communicationId : e.aggregate.id;
    const row = await this.prisma.communication.findUnique({ where: { id }, select: { id: true, triggeredBy: true, clientId: true, leadId: true, sentById: true, toAddress: true } });
    if (!row || row.triggeredBy !== 'MANUAL') return;
    if (record.type === 'email.bounced') await this.failed(row, 'failed');
    if (row.clientId || row.leadId) {
      await this.prisma.$transaction((tx) => syncFirstContact(tx, this.outbox, { leadIds: row.leadId ? [row.leadId] : [], clientId: row.clientId, actor: SYSTEM_ACTOR, now: this.clock.now() }));
    }
  }
}

/** « Bonjour Amel, » — the first word of a contact's full name (the layout writes the greeting). */
function firstNameOf(fullName: string | null): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first || null;
}
