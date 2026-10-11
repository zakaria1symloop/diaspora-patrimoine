// AUT-003 step 2, CYC-185, CAF-024 — e-mails of the Café registrations, sent from the outbox after the commit:
// `registration.created` → C_CAFE_REGISTERED · `registration.waitlisted` → C_CAFE_WAITLISTED · `registration.promoted`
// → C_CAFE_PROMOTED · `registration.cancelled` → C_CAFE_REGISTRATION_CANCELLED · `registration.confirmation_requested`
// (CAF-024, anonymous re-registration) → the confirmation of the CURRENT status again, with the manage link.
// REGISTERED confirmations carry the calendar file (CAF-050) and the QR code (CAF-051); the exact venue is cited only
// for a registration that holds its seats (TRV-045). The registration is READ AGAIN (FIA-042): a status that changed
// meanwhile sends nothing out of date. Every e-mail carries its key (NOT-011).
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createTranslator } from '@dp/i18n';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { ENV, type Env } from '../config/env.js';
import type { MailAttachment } from '../communication/mail-provider.js';
import { MailerService } from '../communication/mailer.service.js';
import { OutboxHandlers, type OutboxHandler, type OutboxRecord } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { EventsPublicService } from './events-public.service.js';
import { RegistrationDocuments } from './registration-documents.js';
import { cafeDateLabel, cafeTimeLabel } from './registration-rules.js';

const t = createTranslator('fr');

/** Which template an event sends, given the status read again (null: nothing to send any more). */
export function registrationTemplateFor(type: string, status: string): string | null {
  switch (type) {
    case 'registration.created':
      return status === 'REGISTERED' ? 'C_CAFE_REGISTERED' : null;
    case 'registration.waitlisted':
      return status === 'WAITLISTED' ? 'C_CAFE_WAITLISTED' : null;
    case 'registration.promoted':
      return status === 'REGISTERED' ? 'C_CAFE_PROMOTED' : null;
    case 'registration.cancelled':
      return status === 'CANCELLED' ? 'C_CAFE_REGISTRATION_CANCELLED' : null;
    case 'registration.confirmation_requested':
      return status === 'REGISTERED' ? 'C_CAFE_REGISTERED' : status === 'WAITLISTED' ? 'C_CAFE_WAITLISTED' : null;
    default:
      return null;
  }
}

@Injectable()
export class RegistrationMailHandler implements OutboxHandler, OnModuleInit {
  readonly name = 'registration.mail';
  readonly types = ['registration.created', 'registration.waitlisted', 'registration.promoted', 'registration.cancelled', 'registration.confirmation_requested'] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly settings: SettingsService,
    private readonly docs: RegistrationDocuments,
    private readonly events: EventsPublicService,
    private readonly handlers: OutboxHandlers,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(this);
  }

  async handle(event: OutboxRecord): Promise<void> {
    const reg = await this.prisma.eventRegistration.findUnique({
      where: { id: event.aggregateId },
      include: {
        event: true,
        client: { select: { gdprErasedAt: true } },
      },
    });
    if (!reg || reg.client.gdprErasedAt) return; // AUT-007
    const code = registrationTemplateFor(event.type, reg.status);
    if (!code) return;
    const e = reg.event;
    if (e.status === 'CANCELLED' && code !== 'C_CAFE_REGISTRATION_CANCELLED') return; // C_CAFE_CANCELLED says it all

    const [brand, companyName, companyPhone] = await Promise.all([
      this.settings.get('events.fullBrandName'),
      this.settings.get('contact.companyName'),
      this.settings.get('contact.phone'),
    ]);
    const holdsSeat = reg.status === 'REGISTERED';
    const cafe: Record<string, unknown> = {
      brandName: brand,
      title: e.title,
      capacity: e.capacity,
      locationLabel: e.locationLabel,
      dateLabel: cafeDateLabel(e.startsAt, e.timezone),
      timeLabel: cafeTimeLabel(e.startsAt, e.endsAt, e.timezone),
      url: `${this.env.WEB_URL}/le-cafe/${e.slug}`,
      // TRV-045 — the exact place only to whom holds a seat.
      ...(holdsSeat ? { venueName: e.venueName, venueAddress: e.venueAddress ?? e.locationLabel, venueNotes: e.venueNotes } : {}),
    };
    const next = (await this.events.upcoming(4)).find((c) => c.slug !== e.slug && c.state.kind !== 'CANCELLED' && c.state.kind !== 'CLOSED');
    const nextCafe = next
      ? { locationLabel: next.locationLabel, dateLabel: cafeDateLabel(new Date(next.startsAt), next.timezone), url: `${this.env.WEB_URL}/le-cafe/${next.slug}` }
      : null;

    const attachments: MailAttachment[] = [];
    if (holdsSeat && (code === 'C_CAFE_REGISTERED' || code === 'C_CAFE_PROMOTED')) {
      attachments.push(
        { filename: 'le-cafe.ics', contentType: 'text/calendar; charset=UTF-8; method=PUBLISH', content: Buffer.from(await this.docs.ics(reg, e), 'utf8') },
        { filename: `code-accueil-${reg.checkInCode}.png`, contentType: 'image/png', content: await this.docs.qrPng(e.reference, reg.checkInCode) },
      );
    }

    await this.mailer.sendTemplate({
      templateCode: code,
      to: reg.email,
      dedupeKey: `${code}:${event.id}:${reg.email}`,
      triggeredBy: 'EVENT',
      links: { clientId: reg.clientId, eventId: e.id, registrationId: reg.id },
      vars: {
        client: { firstName: reg.firstName },
        advisor: { firstName: t('ui.email.advisorFallback.firstName'), displayName: t('ui.email.advisorFallback.displayName', { company: companyName }) },
        company: { name: companyName, phone: companyPhone ? (parsePhoneNumberFromString(companyPhone)?.formatInternational() ?? companyPhone) : null, siteUrl: this.env.WEB_URL },
        cafe,
        registration: { seats: reg.seats, checkInCode: holdsSeat ? reg.checkInCode : null, manageUrl: this.docs.manageUrl(reg.id) },
        nextCafe,
      },
      greetingName: reg.firstName,
      attachments,
      render: { eventId: event.id, registrationId: reg.id },
    });
  }
}
