// ECL-020 … ECL-023 — a dossier as the client reads it: six displayed steps with their dates, the « Prochaine étape »
// sentence (as a code and values, API-002), the banner of a particular state, the completeness bar. Only what the
// client may see is read (ROL-031): no notes, no tasks, no lost reason, no bank or promoter contact.
import { Injectable } from '@nestjs/common';
import type { DisplayedStep, DocumentsSummary, DossierBanner, DossierNextStep, DossierView } from '@dp/contracts';
import { Clock } from '../platform/clock.js';
import { SpaceReader, PROMISE_SELECT, type PromiseLead } from './space-reader.js';

/** ECL-020 — internal stage → displayed step. */
export const STEP_OF_STAGE: Record<string, 2 | 3 | 4 | 5 | 6> = {
  INTEREST: 2,
  QUALIFICATION: 3,
  MATCHING: 3,
  DOCUMENTS: 4,
  BANK_REVIEW: 5,
  APPROVED: 6,
  ACQUISITION: 6,
};

export interface DossierRow {
  id: string;
  reference: string;
  clientId: string;
  stage: string;
  status: string;
  financingRequested: boolean;
  assignedAgentId: string | null;
  propertyId: string | null;
  firstContactAt: Date | null;
  holdReason: string | null;
  holdUntil: Date | null;
  holdClientNote: string | null;
  signingScheduledFor: Date | null;
  keysHandedAt: Date | null;
  completenessPct: number;
  /** CAL-055 — the two counts behind the completeness. */
  requiredDocsCount: number;
  satisfiedDocsCount: number;
  clientNextStep: string | null;
  checklistInstantiatedAt: Date | null;
  lastActivityAt: Date;
  createdAt: Date;
}

/** Client documents to provide or redo (ECL-011 « Ce qui compte »: required, provided by the client, not internal). */
export interface DocCounts {
  total: number;
  toProvide: number;
  toRedo: number;
  received: number;
  nearestDue: Date | null;
}

@Injectable()
export class DossierViews {
  constructor(
    private readonly reader: SpaceReader,
    private readonly clock: Clock,
  ) {}

  private get prisma() {
    return this.reader.prisma;
  }

  async docCounts(dossierId: string): Promise<DocCounts> {
    const docs = await this.prisma.dossierDocument.findMany({
      where: { dossierId, isInternal: false },
      select: { status: true, isRequired: true, providedBy: true, dueAt: true },
    });
    const own = docs.filter((d) => d.providedBy === 'CLIENT' && d.isRequired);
    const due = own.filter((d) => d.status === 'PENDING' && d.dueAt).map((d) => d.dueAt!.getTime());
    return {
      total: docs.length,
      toProvide: own.filter((d) => d.status === 'PENDING' || d.status === 'EXPIRED').length,
      toRedo: own.filter((d) => d.status === 'REJECTED').length,
      received: own.filter((d) => d.status === 'RECEIVED').length,
      nearestDue: due.length ? new Date(Math.min(...due)) : null,
    };
  }

  async transmissionGiven(clientId: string): Promise<boolean> {
    const last = await this.prisma.consent.findFirst({ where: { clientId, type: 'DATA_SHARING_PARTNERS' }, orderBy: { givenAt: 'desc' }, select: { granted: true } });
    return Boolean(last?.granted);
  }

  /** ECL-020 — dates of the first arrival at each stage. */
  private async steps(d: DossierRow): Promise<DisplayedStep[]> {
    const history = await this.prisma.dossierStageHistory.findMany({
      where: { dossierId: d.id },
      orderBy: { changedAt: 'asc' },
      select: { toStage: true, changedAt: true },
    });
    const firstAt = (stages: string[]) => history.find((h) => stages.includes(h.toStage))?.changedAt.toISOString() ?? null;
    const reached: Record<number, string | null> = {
      1: d.createdAt.toISOString(),
      2: firstAt(['INTEREST']) ?? d.createdAt.toISOString(),
      3: firstAt(['QUALIFICATION', 'MATCHING']),
      4: firstAt(['DOCUMENTS']),
      5: firstAt(['BANK_REVIEW']),
      6: firstAt(['APPROVED', 'ACQUISITION']),
    };
    const won = d.status === 'WON';
    const current = STEP_OF_STAGE[d.stage] ?? 2;
    const wentThroughBank = reached[5] !== null;
    return ([1, 2, 3, 4, 5, 6] as const).map((n) => {
      let state: DisplayedStep['state'] = won || n < current ? 'DONE' : n === current ? 'CURRENT' : 'UPCOMING';
      // Without financing, step 5 is « Non concerné » — or stays done, with its date, if the dossier went through a bank.
      if (n === 5 && !d.financingRequested && !wentThroughBank) state = 'NOT_CONCERNED';
      return { n, state, reachedAt: state === 'DONE' || state === 'CURRENT' ? reached[n] ?? null : null };
    });
  }

  /** ECL-022 */
  private banner(d: DossierRow): DossierBanner | null {
    if (d.status === 'ON_HOLD') {
      return {
        kind: 'ON_HOLD',
        holdReason: (d.holdReason as DossierBanner['holdReason']) ?? null,
        holdUntil: d.holdReason === 'CLIENT_REQUEST' && d.holdUntil ? d.holdUntil.toISOString().slice(0, 10) : null,
        holdClientNote: d.holdClientNote,
        filesPurged: false,
      };
    }
    if (d.status === 'LOST') return { kind: 'LOST', holdReason: null, holdUntil: null, holdClientNote: null, filesPurged: false };
    if (d.status === 'WON') return { kind: 'WON', holdReason: null, holdUntil: null, holdClientNote: null, filesPurged: false };
    return null;
  }

  /** ECL-021 — first true line; the advisor's own sentence wins; nothing on a closed dossier. */
  async nextStep(d: DossierRow, promiseLead: PromiseLead | null, clientTimezone: string | null): Promise<DossierNextStep | null> {
    const make = (code: DossierNextStep['code'], params: DossierNextStep['params'] = {}, promise: DossierNextStep['promise'] = null): DossierNextStep => ({
      code,
      advisorText: null,
      params,
      promise,
    });
    if (d.status === 'LOST') return null;
    if (d.status === 'WON') return d.keysHandedAt ? make('WON_KEYS', { date: d.keysHandedAt.toISOString().slice(0, 10) }) : make('WON');
    if (d.clientNextStep?.trim()) return { code: 'ADVISOR', advisorText: d.clientNextStep.trim(), params: {}, promise: null };
    const now = this.clock.now();
    const promise = await this.reader.promiseOf(promiseLead, clientTimezone);

    switch (d.stage) {
      case 'INTEREST':
        return promise ? make('INTEREST', {}, promise) : make('INTEREST_PLAIN');
      case 'QUALIFICATION':
        return !d.firstContactAt && promise ? make('QUALIFICATION_CALL', {}, promise) : make('QUALIFICATION');
      case 'MATCHING': {
        const cands = await this.prisma.dossierCandidate.findMany({
          where: { dossierId: d.id },
          select: { status: true, sentAt: true, selectionRequestedAt: true, property: { select: { title: true } } },
          orderBy: { statusChangedAt: 'desc' },
        });
        if (cands.some((c) => c.status === 'SELECTED')) return make('MATCHING_SELECTED');
        const asked = cands.find((c) => c.status === 'INTERESTED' && c.selectionRequestedAt);
        if (asked) return make('MATCHING_SELECTION_REQUESTED', { property: asked.property.title });
        if (cands.some((c) => (c.status === 'PROPOSED' || c.status === 'VIEWED') && c.sentAt)) return make('MATCHING_PROPOSALS');
        const visit = await this.prisma.appointment.findFirst({
          where: { dossierId: d.id, type: 'PROPERTY_VISIT', status: 'CONFIRMED', startsAt: { gt: now } },
          orderBy: { startsAt: 'asc' },
          select: { startsAt: true },
        });
        if (visit?.startsAt) return make('MATCHING_VISIT', { date: visit.startsAt.toISOString() });
        if (cands.some((c) => ['INTERESTED', 'VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED'].includes(c.status))) return make('MATCHING_INTERESTED');
        return make('MATCHING_PREPARING');
      }
      case 'DOCUMENTS': {
        if (d.propertyId) {
          const p = await this.prisma.property.findUnique({ where: { id: d.propertyId }, select: { availability: true, publication: true, deletedAt: true } });
          const gone = !p || p.deletedAt || p.publication === 'ARCHIVED' || p.availability === 'SOLD' || p.availability === 'WITHDRAWN';
          const held = await this.prisma.reservation.count({ where: { dossierId: d.id, status: { in: ['OPTION', 'RESERVED', 'COMPLETED'] } } });
          if (gone && held === 0) return make('DOCUMENTS_UNAVAILABLE');
        }
        if (!d.checklistInstantiatedAt) return make('DOCUMENTS_LIST_PENDING');
        const c = await this.docCounts(d.id);
        if (c.toProvide + c.toRedo > 0) return make('DOCUMENTS_TO_PROVIDE', { n: c.toProvide + c.toRedo });
        if (c.received > 0) return make('DOCUMENTS_CHECKING');
        if (d.financingRequested) {
          return (await this.transmissionGiven(d.clientId)) ? make('DOCUMENTS_COMPLETE_FINANCING') : make('DOCUMENTS_CONSENT');
        }
        return make('DOCUMENTS_COMPLETE_CASH');
      }
      case 'BANK_REVIEW': {
        const subs = await this.publishedSubmissions(d.id);
        const info = subs.find((s) => s.status === 'INFO_REQUESTED');
        if (info) {
          const n = await this.prisma.dossierDocument.count({ where: { dossierId: d.id, submissionId: info.id, providedBy: 'CLIENT', isInternal: false, status: { in: ['PENDING', 'REJECTED'] } } });
          return make('BANK_INFO', { bank: info.bank, n });
        }
        const studying = subs.filter((s) => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW');
        if (studying.length) return make('BANK_STUDY', { banks: [...new Set(studying.map((s) => s.bank))].join(', ') });
        return make('BANK_OTHER');
      }
      case 'APPROVED': {
        const subs = await this.publishedSubmissions(d.id);
        const approved = subs.find((s) => s.status === 'APPROVED');
        if (approved?.acceptRequestedAt) return make('APPROVED_ACCEPT', { bank: approved.bank });
        return make('APPROVED', { bank: approved?.bank ?? '' });
      }
      case 'ACQUISITION': {
        const active = await this.prisma.reservation.count({ where: { dossierId: d.id, status: { in: ['OPTION', 'RESERVED', 'COMPLETED'] } } });
        const cancelled = await this.prisma.reservation.count({ where: { dossierId: d.id, status: 'CANCELLED' } });
        if (!active && cancelled) return make('ACQUISITION_CANCELLED');
        if (d.signingScheduledFor) return make('ACQUISITION_SIGNING', { date: d.signingScheduledFor.toISOString() });
        return make('ACQUISITION');
      }
      default:
        return null;
    }
  }

  /** CYC-165 — a bank decision counts only once published: before that, the submission reads as under review. */
  async publishedSubmissions(dossierId: string) {
    const rows = await this.prisma.bankSubmission.findMany({
      where: { dossierId, status: { not: 'DRAFT' } },
      select: { id: true, status: true, decisionPublishedAt: true, acceptRequestedAt: true, offerValidUntil: true, bank: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((s) => ({
      id: s.id,
      bank: s.bank.name,
      status: (s.status === 'APPROVED' || s.status === 'REJECTED') && !s.decisionPublishedAt ? 'UNDER_REVIEW' : s.status,
      acceptRequestedAt: s.acceptRequestedAt,
      offerValidUntil: s.offerValidUntil,
    }));
  }

  /** The request ECL-012 retains for a client (open, without first contact, most recent). */
  async promiseLeadFor(clientId: string): Promise<PromiseLead | null> {
    return this.prisma.lead.findFirst({
      where: { clientId, status: { in: ['NEW', 'IN_PROGRESS'] }, firstContactAt: null, kind: { not: 'PARTNER_REQUEST' } },
      orderBy: { createdAt: 'desc' },
      select: PROMISE_SELECT,
    });
  }

  async view(d: DossierRow, clientTimezone: string | null, promiseLead?: PromiseLead | null): Promise<DossierView> {
    const lead = promiseLead === undefined ? await this.promiseLeadFor(d.clientId) : promiseLead;
    const atDocuments = ['DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION'].includes(d.stage);
    const showsCompleteness = atDocuments && d.status !== 'LOST' && d.status !== 'WON';
    const [steps, nextStep, advisor, props, docCount] = await Promise.all([
      this.steps(d),
      this.nextStep(d, lead, clientTimezone),
      this.reader.advisorCard(d.assignedAgentId),
      d.propertyId ? this.reader.propertySummaries([d.propertyId]) : Promise.resolve(new Map()),
      this.prisma.dossierDocument.count({ where: { dossierId: d.id, isInternal: false } }),
    ]);
    // ECL-023 — the figures behind the bar, in the words of ECL-011 « Ce qui compte ».
    let documents: DocumentsSummary | null = null;
    if (showsCompleteness && docCount > 0) {
      const c = await this.docCounts(d.id);
      documents = {
        required: d.requiredDocsCount,
        satisfied: d.satisfiedDocsCount,
        toProvide: c.toProvide,
        toRedo: c.toRedo,
        inReview: c.received,
        nearestDue: c.nearestDue ? c.nearestDue.toISOString().slice(0, 10) : null,
      };
    }
    return {
      id: d.id,
      reference: d.reference,
      stage: d.stage as DossierView['stage'],
      status: d.status as DossierView['status'],
      financingRequested: d.financingRequested,
      steps,
      nextStep,
      banner: this.banner(d),
      // ECL-023 — from DOCUMENTS on, not on a closed dossier.
      completenessPct: showsCompleteness ? d.completenessPct : null,
      documents,
      property: d.propertyId ? (props.get(d.propertyId) ?? null) : null,
      advisor,
      hasDocumentList: docCount > 0,
      lastActivityAt: d.lastActivityAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    };
  }
}

export const DOSSIER_SELECT = {
  id: true,
  reference: true,
  clientId: true,
  stage: true,
  status: true,
  financingRequested: true,
  assignedAgentId: true,
  propertyId: true,
  firstContactAt: true,
  holdReason: true,
  holdUntil: true,
  holdClientNote: true,
  signingScheduledFor: true,
  keysHandedAt: true,
  completenessPct: true,
  requiredDocsCount: true,
  satisfiedDocsCount: true,
  clientNextStep: true,
  checklistInstantiatedAt: true,
  lastActivityAt: true,
  createdAt: true,
} as const;
