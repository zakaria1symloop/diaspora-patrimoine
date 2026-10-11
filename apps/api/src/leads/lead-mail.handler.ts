// AUT-003 step 2, TRV-097, NOT-030 — e-mails of `lead.created` and `lead.supplemented`, sent from the outbox after the
// commit: the acknowledgement to the address just typed (C_LEAD_ACK_* / P_PARTNER_REQUEST_ACK) and, for a new request,
// `S_LEAD_NEW` to the staff (NOT-018). Every effect carries its key (NOT-011): replaying the event sends nothing twice.
// The request is READ AGAIN (FIA-042): a request classed as spam meanwhile sends nothing (AUT-007).
// Also TRV-043: an MX lookup that did not answer within 500 ms is redone here, in the background.
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { callbackLabel, createTranslator, type CallbackSlot } from '@dp/i18n';
import { addBusinessDays } from '@dp/domain';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { ENV, type Env } from '../config/env.js';
import { MailerService, recipientHash } from '../communication/mailer.service.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { log } from '../platform/request-context.js';
import { SettingsService } from '../platform/settings.service.js';
import { loadAdvisors } from './assignment.js';
import type { Supplement } from './duplicate.js';
import { checkMx, emailDomain } from './spam.js';
import { accountLinkForAck } from '../identity/lead-account.js';
import { toEnvelope } from '../automation/event-catalogue.js';
import { staffLink } from '../automation/staff-links.js';
import { StaffNotifier } from '../automation/staff-notifications.service.js';
import { TokensService } from '../identity/tokens.service.js';

/** NOT-040 § 4.2 — the acknowledgement of each kind. */
export function ackTemplateFor(kind: string, form: string | undefined): string {
  switch (kind) {
    case 'PROPERTY_INTEREST':
      return 'C_LEAD_ACK_INTEREST';
    case 'PROJECTION_REQUEST':
      return 'C_LEAD_ACK_PROJECTION';
    case 'CONTACT_MESSAGE':
      return 'C_LEAD_ACK_CONTACT';
    case 'PARTNER_REQUEST':
      return form === 'PARTNER_SIGNUP' ? '' : 'P_PARTNER_REQUEST_ACK';
    default:
      return 'C_LEAD_ACK_CALLBACK'; // CALLBACK_REQUEST, SIMULATION_FOLLOWUP, GUIDED_SEARCH
  }
}

const t = createTranslator('fr');

/** NOT-050 `advisor.displayName` — « Amel K. ». */
export function displayName(firstName: string | null, lastName: string | null): string | null {
  if (!firstName) return null;
  return lastName ? `${firstName} ${lastName.charAt(0).toUpperCase()}.` : firstName;
}

function international(phone: string): string {
  return parsePhoneNumberFromString(phone)?.formatInternational() ?? phone;
}

@Injectable()
export class LeadMailHandler implements OutboxHandler, OnModuleInit {
  readonly name = 'lead.mail';
  readonly types = ['lead.created', 'lead.supplemented'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly clock: Clock,
    private readonly handlers: OutboxHandlers,
    private readonly tokens: TokensService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
    this.handlers.register({ name: 'lead.mx-recheck', types: ['lead.created'], handle: (e) => this.recheckMx(e) });
  }

  async handle(event: OutboxRecord): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: event.aggregateId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, timezone: true, assignedAgentId: true, gdprErasedAt: true } },
        property: { select: { title: true, reference: true, slug: true, city: { select: { nameFr: true } }, region: { select: { nameFr: true } } } },
        program: { select: { name: true, slug: true, city: { select: { nameFr: true } }, region: { select: { nameFr: true } } } },
        dossier: { select: { id: true, assignedAgentId: true } },
      },
    });
    if (!lead || lead.status === 'SPAM' || !lead.email) return; // AUT-007: nothing leaves for a spam request.
    if (lead.client?.gdprErasedAt) return; // AUT-007: nothing for an erased person.

    const payload = lead.payload as { form?: string; fields?: Record<string, unknown> };
    const cal = await this.calendar.load();
    const companyName = await this.settings.get('contact.companyName');
    const companyPhone = await this.settings.get('contact.phone');
    const whatsapp = await this.settings.get('contact.whatsapp');
    const company = {
      name: companyName,
      phone: companyPhone ? international(companyPhone) : null,
      email: (await this.settings.get('contact.email')) || null,
      whatsappUrl: whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : null,
      siteUrl: this.env.WEB_URL,
    };
    const place = (city?: { nameFr: string } | null, region?: { nameFr: string } | null) => [city?.nameFr, region?.nameFr].filter(Boolean).join(', ');
    const property = lead.property
      ? { title: lead.property.title, reference: lead.property.reference, cityRegion: place(lead.property.city, lead.property.region), url: `${this.env.WEB_URL}/biens/${lead.property.slug}` }
      : null;
    const program = lead.program ? { name: lead.program.name, cityRegion: place(lead.program.city, lead.program.region), url: `${this.env.WEB_URL}/programmes/${lead.program.slug}` } : null;

    // NOT-053 — the moment of the call, in the person's time zone; a supplement may have chosen another moment.
    const ev = event.payload as { supplementIndex?: number | null; attachment?: string };
    const supplement = typeof ev.supplementIndex === 'number' ? ((lead.supplements as Supplement[] | null) ?? [])[ev.supplementIndex] : undefined;
    const day = (supplement?.fields.preferredCallbackDate as string | undefined) ?? lead.preferredCallbackDate?.toISOString().slice(0, 10) ?? null;
    const slot = ((supplement?.fields.preferredSlot as string | undefined) ?? lead.preferredSlot ?? null) as CallbackSlot | null;
    const leadVars = {
      reference: lead.reference,
      callbackLabel: callbackLabel({
        preferredCallbackDate: day,
        preferredSlot: slot,
        firstContactBusinessDays: await this.settings.get('sla.firstContactBusinessDays'),
        timeZone: lead.callerTimezone ?? lead.client?.timezone ?? cal.timeZone,
        variant: 'email',
        workdays: cal.workdays,
      }),
    };

    // NOT-050 — the advisor of the request (dossier, then request, then record), if he can act; else the team.
    const advisors = await loadAdvisors(this.prisma);
    const advisorId = [lead.dossier?.assignedAgentId, lead.assignedAgentId, lead.client?.assignedAgentId].find((id) => id && advisors.some((a) => a.userId === id));
    const advisorUser = advisorId ? await this.prisma.user.findUnique({ where: { id: advisorId }, select: { firstName: true, lastName: true } }) : null;
    const advisorName = advisorUser ? displayName(advisorUser.firstName, advisorUser.lastName) : null;
    const advisor = advisorName
      ? { firstName: advisorUser!.firstName, displayName: advisorName }
      : { firstName: t('ui.email.advisorFallback.firstName'), displayName: t('ui.email.advisorFallback.displayName', { company: companyName }) };

    // DEM-021, NOT-024 — « Créer mon espace »: an active account is invited to sign in; an INVITED one (created with the
    // request) or an unconfirmed sign-up gets its link in the acknowledgement, minted when the e-mail leaves (NOT-010).
    let hasAccount = false;
    let secrets: (() => Promise<{ action: { url: string } }>) | undefined;
    if (payload.fields?.createAccount === true) {
      const link = await accountLinkForAck(this.prisma, this.tokens, this.env.WEB_URL, lead.email);
      hasAccount = link.hasAccount;
      secrets = link.secrets;
    }

    // CRM-025 — a request entered by the team sends no acknowledgement, unless the box was checked (`sendAck`); a
    // request restored more than 48 hours after its arrival neither (CYC-006): the adviser writes.
    const sendAck = (event.payload as { sendAck?: boolean }).sendAck !== false;
    const code = sendAck ? ackTemplateFor(lead.kind, payload.form) : '';
    if (code) {
      await this.mailer.sendTemplate({
        templateCode: code,
        to: lead.email,
        dedupeKey: `${code}:${event.id}:${lead.email}`,
        triggeredBy: 'EVENT',
        links: { clientId: lead.clientId, leadId: lead.id, dossierId: lead.dossierId },
        vars: { client: { firstName: lead.firstName ?? lead.client?.firstName ?? null }, advisor, lead: leadVars, property, program, company, action: { hasAccount } },
        secrets,
        greetingName: lead.firstName ?? lead.client?.firstName ?? null,
        signature: advisorName ? `${advisorName} — ${companyName}` : null,
        render: { eventId: event.id, leadId: lead.id },
      });
    }

    if (event.type !== 'lead.created') return;
    await this.alertStaff(event, lead, advisors, { companyName, property, cal });
  }

  /** NOT-030 `NS_LEAD_NEW` / `S_LEAD_NEW`, recipients of NOT-018. */
  private async alertStaff(
    event: OutboxRecord,
    lead: { id: string; reference: string; kind: string; createdAt: Date; slaDueAt: Date | null; assignedAgentId: string | null; firstName: string | null; lastName: string | null; email: string | null; clientId: string | null; dossierId: string | null; dossier: { assignedAgentId: string | null } | null },
    advisors: Awaited<ReturnType<typeof loadAdvisors>>,
    ctx: { companyName: string; property: { title: string } | null; cal: Awaited<ReturnType<BusinessCalendarService['load']>> },
  ): Promise<void> {
    const attachment = (event.payload as { attachment?: string }).attachment;
    // A request that joined a dossier whose advisor took it: NS_LEAD_ATTACHED replaces NS_LEAD_NEW (no e-mail).
    if (attachment === 'JOINED_DOSSIER' && lead.assignedAgentId && lead.assignedAgentId === lead.dossier?.assignedAgentId) return;
    // NOT-018 — the author of a request entered by hand is never told of his own entry.
    const author = (event.payload as { enteredById?: string | null }).enteredById ?? null;
    let recipients = (lead.assignedAgentId ? advisors.filter((a) => a.userId === lead.assignedAgentId) : advisors).filter((a) => a.userId !== author);
    if (lead.kind === 'PARTNER_REQUEST') recipients = recipients.filter((a) => a.role === 'OWNER' || a.role === 'ADMIN'); // DEM-019
    if (recipients.length === 0) {
      log('info', 'lead.staff_alert_skipped', { leadId: lead.id, reason: 'NO_STAFF' });
      return;
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: recipients.map((r) => r.userId) } },
      select: { id: true, email: true, firstName: true, timezone: true, notificationPreferences: { where: { group: 'STAFF_LEADS' }, select: { emailEnabled: true } } },
    });
    // DEM-019 — a partner application has no first-contact deadline: the promised reply time stands for it.
    const due = lead.slaDueAt ?? addBusinessDays(lead.createdAt, await this.settings.get('partner.applicationReviewDays'), ctx.cal);
    const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || lead.reference;

    // NOT-030 `NS_LEAD_NEW`, NOT-035 — the bell of each recipient: one notification for the request, whatever the number
    // of events of the gesture (assigned at creation: « Elle vous est confiée. », neither NS_ASSIGNED nor S_ASSIGNED).
    const ongoing = (event.payload as { ongoingDossierId?: string | null }).ongoingDossierId;
    const ongoingRef = ongoing ? (await this.prisma.dossier.findUnique({ where: { id: ongoing }, select: { reference: true } }))?.reference : null;
    const nature = t(`ui.enum.LeadKind.${lead.kind}` as never);
    const title = ongoingRef
      ? t('ui.notifications.NS_LEAD_NEW.duringDossier', { nature, client: fullName, reference: ongoingRef })
      : lead.assignedAgentId
        ? t('ui.notifications.NS_LEAD_NEW.assigned', { nature, client: fullName })
        : t('ui.notifications.NS_LEAD_NEW.new', { nature, client: fullName });
    await new StaffNotifier().notify(this.prisma, this.clock.now(), {
      type: 'NS_LEAD_NEW',
      userIds: users.map((u) => u.id),
      title,
      link: staffLink('Lead', { id: lead.id, reference: lead.reference }),
      entityType: 'Lead',
      entityId: lead.id,
      originId: toEnvelope(event).originId,
    });

    for (const user of users) {
      // NOT-051 — formatted in the recipient's time zone; TRV-020 hour style « 11 h 42 ».
      const dateTime = (d: Date, withTime: boolean) =>
        new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', ...(withTime ? { timeStyle: 'short' } : {}), timeZone: user.timezone })
          .format(d)
          .replace(/(\d{1,2}):(\d{2})/, '$1 h $2');
      const disabled = user.notificationPreferences.some((p) => !p.emailEnabled); // NOT-020 group STAFF_LEADS
      await this.mailer.sendTemplate({
        templateCode: 'S_LEAD_NEW',
        to: user.email,
        dedupeKey: `S_LEAD_NEW:${event.id}:${user.email}`,
        triggeredBy: 'EVENT',
        links: { leadId: lead.id, clientId: lead.clientId, dossierId: lead.dossierId, staffUserId: user.id },
        suppress: disabled ? 'PREFERENCE_DISABLED' : null,
        vars: {
          staff: { firstName: user.firstName },
          lead: {
            reference: lead.reference,
            kindLabel: t(`ui.enum.LeadKind.${lead.kind}` as never),
            createdDate: dateTime(lead.createdAt, false),
            slaLabel: dateTime(due, true),
          },
          client: { fullName },
          property: ctx.property,
          action: { adminUrl: `${this.env.ADMIN_URL ?? this.env.WEB_URL}/demandes/${lead.reference}` },
        },
        greetingName: user.firstName,
        render: { eventId: event.id, leadId: lead.id },
      });
    }
  }

  /** TRV-043 — the domain check redone without the 500 ms limit; no MX marks the record « e-mail douteux ». */
  private async recheckMx(event: OutboxRecord): Promise<void> {
    if ((event.payload as { mxRecheck?: boolean }).mxRecheck !== true) return;
    const lead = await this.prisma.lead.findUnique({ where: { id: event.aggregateId }, select: { email: true, clientId: true } });
    if (!lead?.email || !lead.clientId) return;
    const status = await checkMx(emailDomain(lead.email), 5_000);
    if (status === 'NONE') {
      await this.prisma.client.updateMany({ where: { id: lead.clientId, email: lead.email }, data: { emailDoubtful: true, updatedAt: this.clock.now() } });
      log('info', 'lead.email_doubtful', { to: recipientHash(lead.email) });
    }
  }
}
