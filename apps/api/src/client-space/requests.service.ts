// MSG-021 « Écrire à mon conseiller » before the messaging (livraison 5), and « Mes demandes » (INT-001, INT-003):
// `GET /client/advisor-contact`, `POST /client/leads`. The message is a request of kind CONTACT_MESSAGE, form
// CLIENT_SPACE_MESSAGE, attached to the client, which CARRIES the dossier it is written from (`contextDossierId`,
// never `dossierId`: nothing changes in that dossier, no `lead.attached`, CYC-002) — with its first-contact deadline
// (CAL-061), assigned like any request (CRM-020; it follows the dossier's advisor, CYC-040), announced to the staff by
// `lead.created` (S_LEAD_NEW, NS_LEAD_NEW) and acknowledged (C_LEAD_ACK_CONTACT, NC_LEAD_RECEIVED). No consent box,
// no `Consent` row: the client writes from his space. Limit: the messages' one (SEC-070, 30 per account / 10 min).
import { Inject, Injectable } from '@nestjs/common';
import { clientMessageRequestSchema, type ClientMessageContext, type ClientMessageResponse, type ClientMessageRequest } from '@dp/contracts';
import { firstContactDueAt, type DossierStage } from '@dp/domain';
import type { Request } from 'express';
import type { AuthContext } from '../identity/sessions.service.js';
import { applyAssignment, lastTakenAt, loadAdvisors, pickAssignee } from '../leads/assignment.js';
import { BusinessCalendarService, nextReference } from '../platform/business-calendar.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { newId } from '../platform/ids.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { ClientIp, RateLimiter } from '../platform/rate-limit.js';
import { SettingsService } from '../platform/settings.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { SpaceReader } from './space-reader.js';
import { writeLeadLine } from './timeline.js';

/** SEC-070 — « Écrire à mon conseiller » follows the messages' line. */
export const CLIENT_MESSAGE_RATE = { limit: 30, windowSeconds: 600 };
const STAGES: DossierStage[] = ['INTEREST', 'QUALIFICATION', 'MATCHING', 'DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION'];

@Injectable()
export class RequestsService {
  constructor(
    private readonly reader: SpaceReader,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly calendar: BusinessCalendarService,
    private readonly outbox: OutboxWriter,
    private readonly idempotency: IdempotencyService,
    private readonly limiter: RateLimiter,
    private readonly ip: ClientIp,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  private get prisma() {
    return this.reader.prisma;
  }

  /** MSG-001 / MSG-021 — who the form writes to, and « À propos de » (open or paused dossiers first). */
  async context(auth: AuthContext): Promise<ClientMessageContext> {
    if (!auth.clientId) return { advisor: null, dossiers: [], defaultDossierReference: null };
    const [client, dossiers] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: auth.clientId }, select: { assignedAgentId: true } }),
      this.prisma.dossier.findMany({
        where: { clientId: auth.clientId, deletedAt: null },
        orderBy: { lastActivityAt: 'desc' },
        select: { reference: true, status: true, assignedAgentId: true, property: { select: { title: true } } },
      }),
    ]);
    const live = dossiers.find((d) => d.status === 'OPEN' || d.status === 'ON_HOLD') ?? null;
    const shown = live ?? dossiers.find((d) => d.status === 'WON') ?? dossiers[0] ?? null;
    return {
      advisor: await this.reader.advisorCard(shown?.assignedAgentId ?? client?.assignedAgentId),
      dossiers: dossiers.map((d) => ({ reference: d.reference, propertyTitle: d.property?.title ?? null, status: d.status })),
      defaultDossierReference: live?.reference ?? null,
    };
  }

  async send(req: Request, auth: AuthContext, body: unknown): Promise<{ status: number; body: ClientMessageResponse }> {
    if (!auth.clientId) throw AppError.notFound();
    const key = `client-message:${auth.userId}`;
    const result = await this.idempotency.run(req, { route: 'client.leads', userId: auth.userId }, {
      prepare: async () => {
        const input = parseOrThrow(clientMessageRequestSchema, body);
        const wait = this.limiter.hit(key, CLIENT_MESSAGE_RATE);
        if (wait > 0) throw AppError.rateLimited(wait);
        return input;
      },
      execute: (tx, input: ClientMessageRequest) => this.create(tx, req, auth, input),
    });
    if (!result.replayed) this.dispatcher.wake();
    return { status: result.status, body: result.body };
  }

  private async create(tx: Tx, req: Request, auth: AuthContext, input: ClientMessageRequest): Promise<ClientMessageResponse> {
    const now = this.clock.now();
    const client = await tx.client.findUniqueOrThrow({
      where: { id: auth.clientId! },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, assignedAgentId: true, preferredLanguage: true, timezone: true },
    });
    let dossier: { id: string; reference: string; assignedAgentId: string | null } | null = null;
    if (input.dossierReference) {
      dossier = await tx.dossier.findFirst({
        where: { reference: input.dossierReference, clientId: client.id, deletedAt: null },
        select: { id: true, reference: true, assignedAgentId: true },
      });
      if (!dossier) throw AppError.validation([{ field: 'dossierReference', code: 'INVALID_CHOICE' }]); // ROL-030
    }
    const cal = await this.calendar.load(tx);
    const reference = await nextReference(tx, 'LEAD', now, cal.timeZone);
    const slaDueAt = firstContactDueAt(now, cal, await this.settings.get('sla.firstContactBusinessDays'), null).dueAt;
    const message = input.message!.trim();
    const lead = await tx.lead.create({
      data: {
        id: newId(),
        reference,
        kind: 'CONTACT_MESSAGE',
        source: 'WEB_FORM',
        clientId: client.id,
        // Coordinates of the request: those of the record, copied at sending.
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email ?? auth.email,
        phone: client.phone,
        payload: {
          form: 'CLIENT_SPACE_MESSAGE',
          formVersion: 1,
          fields: { message, prefilledFrom: input.prefilledFrom ?? null },
          context: { dossierReference: dossier?.reference ?? null },
        } as never,
        message,
        subject: dossier ? 'DOSSIER' : 'OTHER',
        contextDossierId: dossier?.id ?? null,
        locale: client.preferredLanguage,
        callerTimezone: client.timezone,
        submittedFromPath: input.submittedFromPath ?? null,
        ipHash: this.ip.fingerprint(req),
        userAgent: (req.headers['user-agent'] ?? '').slice(0, 400) || null,
        spamScore: 0,
        spamSignals: [] as never,
        status: 'NEW',
        slaDueAt,
        createdAt: now,
        updatedAt: now,
      },
    });
    // ECL-031 « Seconde demande » — a request that carries the dossier, written at its creation.
    if (dossier) await writeLeadLine(tx, { dossierId: dossier.id, again: true, kind: 'CONTACT_MESSAGE', propertyTitle: null, leadReference: reference, at: now });
    await tx.client.update({ where: { id: client.id }, data: { lastActivityAt: now } });

    // CRM-020 — assigned like any request; CYC-040: it follows the dossier's advisor.
    const advisors = await loadAdvisors(tx);
    let agentId: string | null = null;
    if (advisors.length) {
      const mode = await this.settings.get('leads.assignmentMode');
      agentId = pickAssignee({
        joinedDossierAgentId: dossier?.assignedAgentId ?? null,
        referentId: client.assignedAgentId,
        advisors,
        mode,
        lastTakenAt: mode === 'ROUND_ROBIN' ? await lastTakenAt(tx, advisors.map((a) => a.userId)) : new Map(),
        deadline: slaDueAt,
        now,
        cal,
      });
      if (agentId) {
        const stageSlaDays = {} as Record<DossierStage, number>;
        for (const s of STAGES) stageSlaDays[s] = await this.settings.get(`sla.stage.${s}`);
        await applyAssignment(tx, this.outbox, { leadId: lead.id, agentId, clientId: client.id, dossier: null, now, cal, stageSlaDays });
      }
    }
    await this.outbox.add(
      tx,
      {
        type: 'lead.created',
        aggregateType: 'Lead',
        aggregateId: lead.id,
        payload: { kind: 'CONTACT_MESSAGE', source: 'WEB_FORM', propertyId: null, attachment: 'NONE', ongoingDossierId: null, contextDossierId: dossier?.id ?? null, mxRecheck: false },
      },
      now,
    );
    return { reference, advisor: await this.reader.advisorCard(agentId ?? dossier?.assignedAgentId ?? client.assignedAgentId) };
  }
}
