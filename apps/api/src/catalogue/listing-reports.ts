// DEM-018, FIC-055 — « Signaler une erreur sur cette fiche » (`POST /public/listing-reports`, API-100): a `Feedback` of
// nature LISTING_ERROR tied to the property, with what is wrong (`listingErrorKind`), the detail and, if given, an address
// for an answer; no client record. `feedback.received` leaves with it: R_LISTING_ERROR gives the team a task « Vérifier
// la fiche {bien} : erreur signalée ». Limits: those of the public forms (SEC-070, Q-102). A double send is one report.
import { Body, Controller, HttpCode, Inject, Injectable, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { listingReportSchema } from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import { domainEvent } from '../automation/event-catalogue.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { parseOrThrow } from '../platform/validation.js';

const t = createTranslator('fr');
/** SEC-070 « Demandes (tous formulaires publics) » — applied to a listing report (Q-102). */
const HOURLY = { limit: 5, windowSeconds: 3600 };
const DAILY = { limit: 20, windowSeconds: 86_400 };

@Injectable()
export class ListingReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly idempotency: IdempotencyService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    private readonly outbox: OutboxWriter,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  async report(req: Request, body: unknown): Promise<{ id: string }> {
    const input = parseOrThrow(listingReportSchema, body);
    const result = await this.idempotency.run<{ label: string }, { id: string }>(
      req,
      { route: 'public.listing-reports' },
      {
        prepare: async () => {
          const who = this.ip.hash(req);
          const wait = this.limiter.hit(`listing-report:h:${who}`, HOURLY) || this.limiter.hit(`listing-report:d:${who}`, DAILY);
          if (wait) throw AppError.rateLimited(wait);
          // a property that can be read on the site (published, or kept visible while sold)
          const p = await this.prisma.property.findFirst({ where: { id: input.propertyId, deletedAt: null, publication: 'PUBLISHED' }, select: { title: true, reference: true } });
          if (!p) throw AppError.validation([{ field: 'propertyId', code: 'INVALID_CHOICE' }]);
          return { label: `${p.title} (${p.reference})` };
        },
        execute: async (tx, prepared) => {
          const now = this.clock.now();
          const id = newId();
          await tx.feedback.create({
            data: { id, kind: 'LISTING_ERROR', propertyId: input.propertyId, listingErrorKind: input.kind, comment: input.comment, contactEmail: input.email, status: 'NEW', createdAt: now, updatedAt: now },
          });
          const ev = domainEvent({ type: 'feedback.received', aggregate: { type: 'Feedback', id }, actor: { type: 'ANONYMOUS', id: null }, data: { kind: 'LISTING_ERROR', label: prepared.label, kindLabel: t(`ui.enum.ListingErrorKind.${input.kind}`) } });
          await this.outbox.add(tx, { type: ev.type, aggregateType: ev.aggregateType, aggregateId: ev.aggregateId, payload: ev.payload }, now);
          return { id };
        },
      },
    );
    this.dispatcher.wake();
    return result.body;
  }
}

@Controller('public')
export class ListingReportsController {
  constructor(private readonly reports: ListingReportsService) {}

  /** DEM-018 — anonymous; « Merci. Nous vérifions cette fiche. » on the page. */
  @Post('listing-reports') @HttpCode(201)
  report(@Req() req: Request, @Body() body: unknown) { return this.reports.report(req, body); }
}
