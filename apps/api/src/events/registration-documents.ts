// CAF-030, CAF-050, CAF-051 — what a registration carries outside the database: its manage link, its calendar file and
// the QR code of its access code. Shared by the EP-15 routes and the confirmation e-mails.
import { Inject, Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { SettingsService } from '../platform/settings.service.js';
import { buildIcs } from './ics.js';
import { cafeDateLabel, checkInUrl, manageToken, manageUrlPath } from './registration-rules.js';

export interface IcsEvent {
  slug: string;
  reference: string;
  locationLabel: string;
  cityName: string;
  venueName: string | null;
  venueAddress: string | null;
  venueNotes: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  version: number;
  status: string;
}

const QR_OPTIONS = { errorCorrectionLevel: 'M', margin: 1, width: 320, color: { dark: '#06177a', light: '#ffffff' } } as const;

@Injectable()
export class RegistrationDocuments {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  token(registrationId: string): string {
    return manageToken(this.env.LINK_SIGNING_KEY, registrationId);
  }

  /** Absolute « Gérer mon inscription » address (e-mails, calendar file). */
  manageUrl(registrationId: string): string {
    return new URL(manageUrlPath(this.token(registrationId)), this.env.WEB_URL).toString();
  }

  /** CAF-051 — the back-office check-in address (placeholder path, see `checkInUrl`). */
  checkInUrl(eventReference: string, code: string): string {
    return checkInUrl(this.env.ADMIN_URL ?? this.env.WEB_URL, eventReference, code);
  }

  qrDataUrl(eventReference: string, code: string): Promise<string> {
    return QRCode.toDataURL(this.checkInUrl(eventReference, code), { ...QR_OPTIONS, type: 'image/png' });
  }

  qrPng(eventReference: string, code: string): Promise<Buffer> {
    return QRCode.toBuffer(this.checkInUrl(eventReference, code), { ...QR_OPTIONS, type: 'png' });
  }

  /** CAF-050 — the calendar file of a REGISTERED registration. */
  async ics(reg: { id: string; checkInCode: string; seats: number }, e: IcsEvent): Promise<string> {
    const brand = await this.settings.get('events.fullBrandName');
    const manage = this.manageUrl(reg.id);
    const place = [e.venueName, e.venueAddress].filter(Boolean).join(', ') || `${e.locationLabel}, ${e.cityName}`;
    const description = [
      `${brand} – ${e.locationLabel}, ${cafeDateLabel(e.startsAt, e.timezone)}.`,
      e.venueNotes ? `Accès : ${e.venueNotes}` : null,
      `Votre code d’accueil : ${reg.checkInCode}`,
      `Gérer mon inscription : ${manage}`,
    ]
      .filter(Boolean)
      .join('\n');
    return buildIcs({
      uid: `${reg.id}@${new URL(this.env.WEB_URL).hostname}`,
      sequence: e.version,
      stamp: this.clock.now(),
      start: e.startsAt,
      end: e.endsAt,
      timeZone: e.timezone,
      summary: `${brand} – ${e.locationLabel}`,
      location: place,
      description,
      url: manage,
      alarmText: `Demain : ${brand} – ${e.locationLabel}`,
      cancelled: e.status === 'CANCELLED',
    });
  }
}
