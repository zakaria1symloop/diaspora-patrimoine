// EC-12, EC-13 — the client's answers on a considered property (INT-004, INT-020, INT-021, INT-030, INT-031; CYC-070,
// CYC-071), and EC-11 « Mon bien » (ECL-032). ROL-030: every query is scoped to the caller's client record — someone
// else's property answers 404. A preview session (ROL-017) never reaches here: the guard refuses its writes.
//   POST /client/candidates/{id}/interested     « Ce bien m'intéresse » · « Finalement, il m'intéresse »
//   POST /client/candidates/{id}/decline        « Ce bien ne me convient pas » · « Ce bien ne m'intéresse plus »
//   POST /client/candidates/{id}/select-request « Je retiens ce bien »
//   POST /client/candidates/{id}/cancel-select  « Annuler mon choix »
//   GET  /client/candidates/{id}/lots           the available lots of the property (« Un lot vous attire en particulier ? »)
//   GET  /client/dossiers/{référence}/property  « Mon bien »
import { Inject, Injectable } from '@nestjs/common';
import {
  clientDeclineSchema,
  clientInterestedSchema,
  clientSelectRequestSchema,
  type ClientCandidateAnswer,
  type ClientDossierProperty,
  type ClientLotChoice,
} from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import { writeAudit } from '../admin/audit.js';
import type { Actor } from '../admin/actor.js';
import { TasksService } from '../automation/tasks.service.js';
import { SpaceReader } from '../client-space/space-reader.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { EVENT_DISPATCHER, OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import { parseOrThrow } from '../platform/validation.js';
import { cancelUpcomingVisitsOfCandidate, upcomingVisitOfCandidate } from '../tasks-admin/appointment-ops.js';
import { signalHoldActivity } from './candidate-effects.js';
import { emitCandidate } from './dossier-core.js';
import { clientActions, isGone } from './dossier-rules.js';
import { PropertyCards } from './property-cards.js';
import { advisorDisplayName } from '../client-space/timeline.js';

const t = createTranslator('fr');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ClientAnswersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly outbox: OutboxWriter,
    private readonly tasks: TasksService,
    private readonly cards: PropertyCards,
    private readonly reader: SpaceReader,
    @Inject(EVENT_DISPATCHER) private readonly dispatcher: EventDispatcher,
  ) {}

  /** The client acts for himself: the audit row names his account (SEC-080, actor of kind USER with the client's id). */
  private actor(auth: AuthContext): Actor {
    return auth.actor ?? { type: 'USER', userId: auth.userId, role: null, reason: null };
  }

  /** The candidate of one of the caller's dossiers, locked with its dossier; 404 otherwise (ROL-030). */
  private async own(tx: Tx, auth: AuthContext, id: string) {
    if (!auth.clientId || !UUID.test(id)) throw AppError.notFound();
    const found = await tx.dossierCandidate.findFirst({ where: { id, dossier: { clientId: auth.clientId, deletedAt: null } }, select: { dossierId: true } });
    if (!found) throw AppError.notFound();
    await tx.$queryRawUnsafe(`SELECT id FROM dossiers WHERE id = $1::uuid FOR UPDATE`, found.dossierId);
    const c = await tx.dossierCandidate.findUniqueOrThrow({ where: { id }, include: { dossier: { select: { id: true, reference: true, stage: true, status: true, clientId: true } }, property: { select: { id: true, title: true, publication: true, deletedAt: true, archivedAt: true, availability: true, lotsAvailable: true } } } });
    const state = this.cards.state(c.property, await this.cards.onlineIds());
    return { c, state, can: clientActions(c, c.dossier, state) };
  }

  private answer(c: { id: string; status: string; selectionRequestedAt: Date | null }): ClientCandidateAnswer {
    return { id: c.id, status: c.status as ClientCandidateAnswer['status'], selectionRequestedAt: c.selectionRequestedAt?.toISOString() ?? null };
  }

  private async run(fn: (tx: Tx, now: Date) => Promise<ClientCandidateAnswer>): Promise<ClientCandidateAnswer> {
    const now = this.clock.now();
    const out = await this.prisma.$transaction((tx) => fn(tx, now), { timeout: 30_000 });
    this.dispatcher.wake();
    return out;
  }

  private async audit(tx: Tx, auth: AuthContext, now: Date, c: { id: string; status: string; dossierId: string; property: { title: string } }, clientId: string, after: Record<string, unknown>): Promise<void> {
    await writeAudit(tx, this.actor(auth), now, { action: 'candidate.status_changed', entityType: 'DossierCandidate', entityId: c.id, entityLabel: c.property.title, before: { status: c.status }, after: { ...after, by: 'CLIENT' }, clientId, dossierId: c.dossierId });
  }

  /** INT-020, INT-021 — « Ce bien m'intéresse » (from a proposal) · « Finalement, il m'intéresse » (from « Écarté »). */
  async interested(auth: AuthContext, id: string, body: unknown): Promise<ClientCandidateAnswer> {
    const input = parseOrThrow(clientInterestedSchema, body);
    return this.run(async (tx, now) => {
      const { c, can } = await this.own(tx, auth, id);
      if (!can.interested) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      const next = await tx.dossierCandidate.update({
        where: { id: c.id },
        data: { status: 'INTERESTED', statusChangedAt: now, viewedAt: c.viewedAt ?? now, ...(input.comment ? { clientComment: input.comment } : {}), declineReason: null, declineNote: null, version: { increment: 1 }, updatedAt: now },
      });
      await this.audit(tx, auth, now, c, c.dossier.clientId, { status: 'INTERESTED', event: 'interested' });
      await emitCandidate(tx, this.outbox, c, c.dossier.clientId, 'candidate.interested', { type: 'USER', id: auth.userId }, now, { by: 'CLIENT' });
      await signalHoldActivity(tx, this.outbox, { dossierId: c.dossierId, what: 'PROPOSAL_ANSWER', now });
      return this.answer(next);
    });
  }

  /** INT-021, INT-004 — the reason is required; a visit to come is cancelled after confirmation (`cancelVisit`). */
  async decline(auth: AuthContext, id: string, body: unknown): Promise<ClientCandidateAnswer> {
    const input = parseOrThrow(clientDeclineSchema, body);
    return this.run(async (tx, now) => {
      const { c, can } = await this.own(tx, auth, id);
      if (!can.decline) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      const visit = await upcomingVisitOfCandidate(tx, c.id, now);
      // The screen asks « Votre visite du {date} sera annulée. » first; without that confirmation, nothing changes.
      if (visit && !input.cancelVisit) throw AppError.conflictState('VISIT_TO_CANCEL', { date: visit.startsAt.toISOString() });
      await cancelUpcomingVisitsOfCandidate(tx, this.outbox, { candidateId: c.id, by: 'CLIENT', actor: this.actor(auth), now });
      const next = await tx.dossierCandidate.update({
        where: { id: c.id },
        data: { status: 'DECLINED', statusChangedAt: now, viewedAt: c.viewedAt ?? now, declineReason: input.reason, declineNote: input.note, selectionRequestedAt: null, version: { increment: 1 }, updatedAt: now },
      });
      if (c.selectionRequestedAt) await this.tasks.closeAutomatically(tx, now, [`selection:${c.id}`], 'CANCELLED', t('ui.automation.close.selectionWithdrawn'));
      await this.audit(tx, auth, now, c, c.dossier.clientId, { status: 'DECLINED', event: 'declined', declineReason: input.reason });
      await emitCandidate(tx, this.outbox, c, c.dossier.clientId, 'candidate.declined', { type: 'USER', id: auth.userId }, now, { by: 'CLIENT', declineReason: input.reason });
      await signalHoldActivity(tx, this.outbox, { dossierId: c.dossierId, what: 'PROPOSAL_ANSWER', now });
      return this.answer(next);
    });
  }

  /**
   * INT-030, INT-031 — « Je retiens ce bien »: the choice waits for the adviser (the status does not change). One choice
   * pending per dossier: another one is replaced after confirmation (`replace`), else `409 SELECTION_PENDING`.
   */
  async selectRequest(auth: AuthContext, id: string, body: unknown): Promise<ClientCandidateAnswer> {
    const input = parseOrThrow(clientSelectRequestSchema, body);
    return this.run(async (tx, now) => {
      const { c, can } = await this.own(tx, auth, id);
      if (!can.selectRequest) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      const other = await tx.dossierCandidate.findFirst({ where: { dossierId: c.dossierId, id: { not: c.id }, selectionRequestedAt: { not: null }, status: { not: 'SELECTED' } }, include: { property: { select: { title: true } } } });
      if (other && !input.replace) throw AppError.conflictState('SELECTION_PENDING', { bien: other.property.title });
      if (input.lotId) {
        const lot = await tx.lot.findFirst({ where: { id: input.lotId, propertyId: c.propertyId, deletedAt: null, status: 'AVAILABLE' }, select: { id: true } });
        if (!lot) throw AppError.validation([{ field: 'lotId', code: 'INVALID_CHOICE' }]);
      }
      if (other) {
        await tx.dossierCandidate.update({ where: { id: other.id }, data: { selectionRequestedAt: null, version: { increment: 1 }, updatedAt: now } });
        await this.tasks.closeAutomatically(tx, now, [`selection:${other.id}`], 'CANCELLED', t('ui.automation.close.selectionWithdrawn'));
      }
      const next = await tx.dossierCandidate.update({
        where: { id: c.id },
        data: { selectionRequestedAt: now, selectionDeclineNote: null, lotId: input.lotId ?? c.lotId, ...(input.comment ? { clientComment: input.comment } : {}), viewedAt: c.viewedAt ?? now, version: { increment: 1 }, updatedAt: now },
      });
      await this.audit(tx, auth, now, c, c.dossier.clientId, { status: c.status, event: 'selection_requested' });
      // Notification and task for the adviser: rule R_SELECTION_REQUESTED (AUT-043).
      await emitCandidate(tx, this.outbox, c, c.dossier.clientId, 'candidate.selection_requested', { type: 'USER', id: auth.userId }, now);
      await signalHoldActivity(tx, this.outbox, { dossierId: c.dossierId, what: 'PROPOSAL_ANSWER', now });
      return this.answer(next);
    });
  }

  /** INT-031 — « Annuler mon choix », as long as the adviser has not confirmed it. */
  async cancelSelect(auth: AuthContext, id: string): Promise<ClientCandidateAnswer> {
    return this.run(async (tx, now) => {
      const { c, can } = await this.own(tx, auth, id);
      if (!can.cancelSelect) throw AppError.conflictState('TRANSITION_NOT_ALLOWED');
      const next = await tx.dossierCandidate.update({ where: { id: c.id }, data: { selectionRequestedAt: null, version: { increment: 1 }, updatedAt: now } });
      await this.tasks.closeAutomatically(tx, now, [`selection:${c.id}`], 'CANCELLED', t('ui.automation.close.selectionWithdrawn'));
      await this.audit(tx, auth, now, c, c.dossier.clientId, { status: c.status, event: 'selection_cancelled' });
      return this.answer(next);
    });
  }

  /** INT-030 — the available lots: reference, floor, surface, price (in the currency of the property). */
  async lots(auth: AuthContext, id: string): Promise<{ data: ClientLotChoice[] }> {
    if (!auth.clientId || !UUID.test(id)) throw AppError.notFound();
    const c = await this.prisma.dossierCandidate.findFirst({ where: { id, dossier: { clientId: auth.clientId, deletedAt: null } }, select: { propertyId: true } });
    if (!c) throw AppError.notFound();
    const lots = await this.cards.lots(c.propertyId, true);
    return { data: lots.map((l) => ({ id: l.id, reference: l.reference, floor: l.floor, surfaceM2: l.surfaceM2, price: l.price })) };
  }

  /** ECL-032 — « Mon bien »: the retained property, the intended lot, the one price of the project (MOD-313). */
  async property(auth: AuthContext, reference: string): Promise<ClientDossierProperty> {
    const d = await this.reader.ownDossier(auth, reference);
    const empty: ClientDossierProperty = { property: null, photos: [], unavailable: false, lot: null, lotLost: false, price: null, advisorName: null };
    if (!d.propertyId) return empty;
    const [summaries, row, lot, reservation, advisor, media] = await Promise.all([
      this.reader.propertySummaries([d.propertyId]),
      this.prisma.property.findUnique({ where: { id: d.propertyId }, select: { programId: true, publication: true, deletedAt: true, archivedAt: true, availability: true } }),
      d.lotId ? this.prisma.lot.findUnique({ where: { id: d.lotId }, select: { id: true, reference: true, floor: true, surfaceM2: true, orientation: true, status: true } }) : Promise.resolve(null),
      this.prisma.reservation.findFirst({ where: { dossierId: d.id, status: { in: ['OPTION', 'RESERVED', 'COMPLETED'] } }, select: { status: true, lotId: true } }),
      this.reader.advisorCard(d.assignedAgentId),
      this.photos(d.propertyId),
    ]);
    const summary = summaries.get(d.propertyId) ?? null;
    const live = d.status === 'OPEN' || d.status === 'ON_HOLD';
    const gone = row ? isGone(row) : true;
    const state = reservation && lot && reservation.lotId === lot.id ? (reservation.status === 'OPTION' ? 'OPTION' : 'RESERVED') : 'INTENDED';
    // CYC-102 — the intended lot taken by someone else meanwhile: the line gives way to « Le lot envisagé n'est plus libre ».
    const lotLost = Boolean(lot && state === 'INTENDED' && lot.status !== 'AVAILABLE');
    return {
      property: summary,
      photos: media,
      unavailable: live && gone && !reservation,
      lot: lot && !lotLost ? { reference: lot.reference, floor: lot.floor, surfaceM2: lot.surfaceM2.toFixed(2), orientation: lot.orientation, state } : null,
      lotLost,
      price: d.purchasePrice && d.purchaseCurrency ? { amount: { amount: d.purchasePrice.toFixed(2), currency: d.purchaseCurrency }, agreed: Boolean(reservation), equivalent: null } : null,
      advisorName: advisor ? advisorDisplayName(advisor.firstName, advisor.lastInitial ? `${advisor.lastInitial}.` : null) : null,
    };
  }

  private async photos(propertyId: string) {
    const card = (await this.cards.cards([propertyId])).get(propertyId);
    return card?.photo ? [card.photo] : [];
  }
}
