// EC-12, EC-13 — `GET /client/interests`, `GET /client/proposals`, `POST /client/candidates/{id}/view` (INT-001 …
// INT-023). The answers on a candidate (« Ce bien m'intéresse », « Je retiens ce bien »…) are package 3.7 (ECL-006).
import { Injectable } from '@nestjs/common';
import type { CandidateCard, ClientInterests, ClientProposals, ClientRequestRow, ProposalGroup } from '@dp/contracts';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { OutboxWriter, EVENT_DISPATCHER, type EventDispatcher } from '../platform/outbox.js';
import { Inject } from '@nestjs/common';
import { SpaceReader, PROMISE_SELECT } from './space-reader.js';

/** INT-001 — proposals that no longer wait for an answer join « Les biens qui m'intéressent ». */
const ANSWERED = ['INTERESTED', 'VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED', 'SELECTED'] as const;

const CANDIDATE_SELECT = {
  id: true,
  status: true,
  origin: true,
  propertyId: true,
  leadId: true,
  proposedById: true,
  message: true,
  sentAt: true,
  viewedAt: true,
  selectionRequestedAt: true,
  selectionDeclineNote: true,
  createdAt: true,
  statusChangedAt: true,
  dossier: { select: { reference: true, stage: true, assignedAgentId: true } },
} as const;

@Injectable()
export class PropertiesService {
  constructor(
    private readonly reader: SpaceReader,
    private readonly clock: Clock,
    private readonly outbox: OutboxWriter,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  private get prisma() {
    return this.reader.prisma;
  }

  private async cards(
    rows: Array<{
      id: string;
      status: string;
      origin: string;
      propertyId: string;
      leadId: string | null;
      sentAt: Date | null;
      viewedAt: Date | null;
      selectionRequestedAt: Date | null;
      selectionDeclineNote: string | null;
      createdAt: Date;
      dossier: { reference: string; stage: string; assignedAgentId: string | null };
    }>,
    clientTimezone: string | null,
  ): Promise<CandidateCard[]> {
    if (!rows.length) return [];
    const now = this.clock.now();
    const [props, advisors, visits, leads] = await Promise.all([
      this.reader.propertySummaries(rows.map((r) => r.propertyId)),
      this.reader.advisorCards(rows.map((r) => r.dossier.assignedAgentId)),
      this.prisma.appointment.findMany({
        where: { candidateId: { in: rows.map((r) => r.id) }, status: 'CONFIRMED', startsAt: { gt: now } },
        select: { candidateId: true, startsAt: true },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.lead.findMany({
        where: { id: { in: rows.map((r) => r.leadId).filter((x): x is string => Boolean(x)) }, status: { in: ['NEW', 'IN_PROGRESS'] }, firstContactAt: null },
        select: { id: true, ...PROMISE_SELECT },
      }),
    ]);
    const out: CandidateCard[] = [];
    for (const r of rows) {
      const property = props.get(r.propertyId);
      if (!property) continue;
      const lead = leads.find((l) => l.id === r.leadId) ?? null;
      out.push({
        id: r.id,
        dossierReference: r.dossier.reference,
        dossierStage: r.dossier.stage as CandidateCard['dossierStage'],
        status: r.status as CandidateCard['status'],
        origin: r.origin as CandidateCard['origin'],
        property,
        fullyReserved: property.availability === 'RESERVED',
        unavailable: r.status === 'UNAVAILABLE' || property.gone,
        since: (r.origin === 'ADVISOR_PROPOSAL' ? r.sentAt : null)?.toISOString() ?? r.createdAt.toISOString(),
        viewedAt: r.viewedAt?.toISOString() ?? null,
        selectionRequestedAt: r.selectionRequestedAt?.toISOString() ?? null,
        selectionDeclineNote: r.status === 'INTERESTED' ? r.selectionDeclineNote : null,
        visitAt: visits.find((v) => v.candidateId === r.id)?.startsAt?.toISOString() ?? null,
        promise: r.status === 'INTERESTED' ? await this.reader.promiseOf(lead, clientTimezone) : null,
        advisor: (r.dossier.assignedAgentId && advisors.get(r.dossier.assignedAgentId)) || null,
      });
    }
    return out;
  }

  async interests(auth: AuthContext): Promise<ClientInterests> {
    if (!auth.clientId) return { properties: [], requests: [] };
    const client = await this.prisma.client.findUnique({ where: { id: auth.clientId }, select: { timezone: true, assignedAgentId: true } });
    const rows = await this.prisma.dossierCandidate.findMany({
      where: {
        dossier: { clientId: auth.clientId, deletedAt: null },
        OR: [{ origin: 'CLIENT_INTEREST' }, { origin: 'ADVISOR_PROPOSAL', sentAt: { not: null }, status: { in: [...ANSWERED] } }],
      },
      orderBy: { statusChangedAt: 'desc' },
      select: CANDIDATE_SELECT,
    });
    const properties = await this.cards(rows, client?.timezone ?? null);

    // « Mes demandes » — the other requests; an interest that created a candidate is shown as its card instead.
    const leads = await this.prisma.lead.findMany({
      where: { clientId: auth.clientId, status: { not: 'SPAM' }, kind: { not: 'PARTNER_REQUEST' } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        reference: true,
        kind: true,
        status: true,
        createdAt: true,
        assignedAgentId: true,
        payload: true,
        property: { select: { title: true } },
        program: { select: { name: true } },
        dossierCandidates: { select: { id: true }, take: 1 },
      },
    });
    const shown = leads.filter((l) => !(l.kind === 'PROPERTY_INTEREST' && l.dossierCandidates.length > 0));
    const advisors = await this.reader.advisorCards(shown.map((l) => l.assignedAgentId));
    const requests: ClientRequestRow[] = shown.map((l) => ({
      reference: l.reference,
      kind: l.kind,
      status: l.status as ClientRequestRow['status'],
      createdAt: l.createdAt.toISOString(),
      advisor: (l.assignedAgentId && advisors.get(l.assignedAgentId)) || null,
      subject: l.property?.title ?? l.program?.name ?? null,
      noCandidate: l.kind === 'PROPERTY_INTEREST' && Boolean(l.property),
      fromSpace: (l.payload as { form?: string } | null)?.form === 'CLIENT_SPACE_MESSAGE',
    }));
    return { properties, requests };
  }

  async proposals(auth: AuthContext): Promise<ClientProposals> {
    if (!auth.clientId) return { qualified: false, groups: [] };
    const [client, dossiers] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: auth.clientId }, select: { timezone: true, qualifiedAt: true } }),
      this.prisma.dossier.findMany({ where: { clientId: auth.clientId, deletedAt: null }, select: { stage: true, qualifiedAt: true } }),
    ]);
    const qualified = Boolean(client?.qualifiedAt) || dossiers.some((d) => d.qualifiedAt || !['INTEREST', 'QUALIFICATION'].includes(d.stage));
    const rows = await this.prisma.dossierCandidate.findMany({
      where: { dossier: { clientId: auth.clientId, deletedAt: null }, origin: 'ADVISOR_PROPOSAL', sentAt: { not: null } },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'asc' }],
      select: CANDIDATE_SELECT,
    });
    const cards = await this.cards(rows, client?.timezone ?? null);
    const advisors = await this.reader.advisorCards(rows.map((r) => r.proposedById));
    // INT-010 — grouped by sending: same instant, same advisor.
    const groups = new Map<string, ProposalGroup>();
    for (const r of rows) {
      const card = cards.find((c) => c.id === r.id);
      if (!card) continue;
      const key = `${r.sentAt!.toISOString()}|${r.proposedById ?? ''}`;
      let g = groups.get(key);
      if (!g) {
        g = { sentAt: r.sentAt!.toISOString(), advisor: (r.proposedById && advisors.get(r.proposedById)) || null, message: null, items: [] };
        groups.set(key, g);
      }
      g.message ??= r.message;
      g.items.push(card);
    }
    return { qualified, groups: [...groups.values()] };
  }

  /** INT-011 — opening a proposed property (its detail, or its public page from the proposal) marks it viewed. */
  async view(auth: AuthContext, id: string): Promise<{ status: string }> {
    if (!auth.clientId) throw AppError.notFound();
    const c = await this.prisma.dossierCandidate.findFirst({
      where: { id, dossier: { clientId: auth.clientId, deletedAt: null } },
      select: { id: true, status: true, viewedAt: true, dossierId: true },
    });
    if (!c) throw AppError.notFound(); // ROL-030
    if (c.viewedAt) return { status: c.status };
    const now = this.clock.now();
    const toViewed = c.status === 'PROPOSED';
    await this.prisma.$transaction(async (tx) => {
      const done = await tx.dossierCandidate.updateMany({
        where: { id: c.id, viewedAt: null },
        data: { viewedAt: now, ...(toViewed ? { status: 'VIEWED', statusChangedAt: now } : {}), version: { increment: 1 }, updatedAt: now },
      });
      if (done.count && toViewed) {
        await this.outbox.add(tx, { type: 'candidate.viewed', aggregateType: 'Dossier', aggregateId: c.dossierId, payload: { candidateId: c.id, by: 'CLIENT' } }, now);
      }
    });
    this.dispatcher.wake();
    return { status: toViewed ? 'VIEWED' : c.status };
  }
}
