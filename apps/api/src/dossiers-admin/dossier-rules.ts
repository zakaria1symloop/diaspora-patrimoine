// CYC-020 … CYC-041, CYC-070 … CYC-073, API-102, CAL-062, PIP-021 — the PURE rules of the dossier (ARC-012): the
// conditions of each advance, where a step back or a reopening leads, the stage deadline in words, what the dossier is
// waiting for. No database here: every function takes values and answers values, so that each rule has its test.
//
// Delivery 3 (plan, § 1): the advances delivered are CYC-020 (taking in charge) and CYC-021 (qualification). CYC-022 and
// beyond arrive with Lot 4 (Q-077): their conditions are still computed and shown, their button is not.
import type { DossierMainAction, DossierNext, DossierSla, DossierStep, TransitionCondition } from '@dp/contracts';
import { businessMinutesBetween, workdayMinutes, type BusinessCalendar, type DossierStage } from '@dp/domain';

export const STAGES: readonly DossierStage[] = ['INTEREST', 'QUALIFICATION', 'MATCHING', 'DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION'];
export const stageIndex = (stage: string): number => STAGES.indexOf(stage as DossierStage);
export const isLive = (status: string): boolean => status === 'OPEN' || status === 'ON_HOLD';
export const isFinished = (status: string): boolean => status === 'WON' || status === 'LOST';

/** Statuses of a considered property that still count (« vivant »): everything but set aside and unavailable. */
export const LIVE_CANDIDATE = ['PROPOSED', 'VIEWED', 'INTERESTED', 'VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED', 'SELECTED'] as const;

// ─── Conditions of the advances (API-102) ───────────────────────────────────

export interface QualificationFacts {
  firstContactAt: Date | null;
  client: {
    firstName: string | null;
    lastName: string | null;
    countryOfResidence: string | null;
    residencyStatus: string | null;
    budgetMax: unknown;
    budgetMonthly: unknown;
    downPayment: unknown;
    financingPreference: string | null;
    purchaseTimeframe: string | null;
    doNotContact: boolean;
  };
}

const filled = (v: unknown): boolean => v !== null && v !== undefined && String(v).trim() !== '';

/** CYC-021 — (a) a first contact, (b) the client record, (c) the client may be contacted. A down payment of 0 is accepted. */
export function qualificationConditions(f: QualificationFacts): TransitionCondition[] {
  const c = f.client;
  return [
    { code: 'FIRST_CONTACT', met: f.firstContactAt !== null },
    { code: 'CLIENT_NAME', met: filled(c.firstName) && filled(c.lastName) },
    { code: 'CLIENT_RESIDENCE_COUNTRY', met: filled(c.countryOfResidence) },
    { code: 'CLIENT_RESIDENCY_STATUS', met: filled(c.residencyStatus) },
    { code: 'CLIENT_BUDGET', met: filled(c.budgetMax) || filled(c.budgetMonthly) },
    { code: 'CLIENT_DOWN_PAYMENT', met: filled(c.downPayment) },
    { code: 'CLIENT_FINANCING_PREFERENCE', met: filled(c.financingPreference) },
    { code: 'CLIENT_TIMEFRAME', met: filled(c.purchaseTimeframe) },
    { code: 'CLIENT_CONTACT_ALLOWED', met: !c.doNotContact },
  ];
}

export interface BuildFileFacts {
  selectedCount: number;
  /** The retained property is published, with an availability AVAILABLE (or RESERVED for this dossier). */
  propertyAvailable: boolean;
  employmentType: string | null;
  residencyStatus: string | null;
}

/** CYC-022 (a), (b), (d) — shown at MATCHING; the advance itself is delivered with Lot 4. */
export function buildFileConditions(f: BuildFileFacts): TransitionCondition[] {
  return [
    { code: 'SELECTED_CANDIDATE', met: f.selectedCount === 1 },
    { code: 'PROPERTY_AVAILABLE', met: f.selectedCount === 1 && f.propertyAvailable },
    { code: 'CLIENT_EMPLOYMENT', met: filled(f.employmentType) },
    { code: 'CLIENT_RESIDENCY_STATUS', met: filled(f.residencyStatus) },
  ];
}

/** PIP-021 — the main action of the record. On hold it is « Reprendre le dossier », whatever the stage (CYC-034). */
export function mainAction(d: { stage: string; status: string }): DossierMainAction {
  if (d.status === 'ON_HOLD') return 'RESUME';
  if (d.status !== 'OPEN') return null;
  if (d.stage === 'INTEREST') return 'TAKE';
  if (d.stage === 'QUALIFICATION') return 'QUALIFY';
  return null;
}

// ─── The frieze (PIP-020) ───────────────────────────────────────────────────

/**
 * The seven stages with the date each was entered. A stage the dossier went through keeps the date of its LAST entry;
 * the bank stages of a dossier without financing are « SKIPPED » (CYC-024).
 */
export function friezeOf(
  d: { stage: string; status: string; financingRequested: boolean; stageEnteredAt: Date },
  history: readonly { toStage: string; changedAt: Date }[],
): DossierStep[] {
  const current = stageIndex(d.stage);
  const entered = new Map<string, Date>();
  for (const h of history) entered.set(h.toStage, h.changedAt); // ascending: the last entry wins
  entered.set(d.stage, d.stageEnteredAt);
  return STAGES.map((stage, i) => {
    const skipped = !d.financingRequested && (stage === 'BANK_REVIEW' || stage === 'APPROVED');
    const state: DossierStep['state'] = i === current ? (d.status === 'WON' ? 'DONE' : 'CURRENT') : i < current ? (skipped ? 'SKIPPED' : 'DONE') : skipped ? 'SKIPPED' : 'TODO';
    return { stage, state, enteredAt: i <= current && state !== 'SKIPPED' ? (entered.get(stage)?.toISOString() ?? null) : null };
  });
}

// ─── The stage deadline (CAL-062, PIP-002) ──────────────────────────────────

/** In business days: « dans 3 j » / « en retard de 2 j » (business days elapsed since `slaDueAt`). */
export function slaOf(d: { status: string; slaDueAt: Date | null }, now: Date, cal: BusinessCalendar): DossierSla {
  if (d.status === 'ON_HOLD') return { state: 'PAUSED' };
  if (d.status !== 'OPEN' || !d.slaDueAt) return { state: 'NONE' };
  const perDay = workdayMinutes(cal) || 540;
  if (d.slaDueAt.getTime() < now.getTime()) {
    return { state: 'LATE', dueAt: d.slaDueAt.toISOString(), businessDaysLate: Math.max(1, Math.ceil(businessMinutesBetween(d.slaDueAt, now, cal) / perDay)) };
  }
  return { state: 'DUE', dueAt: d.slaDueAt.toISOString(), businessDaysLeft: Math.ceil(businessMinutesBetween(now, d.slaDueAt, cal) / perDay) };
}

/** PIP-002 — calendar days since the stage was entered, pauses included. */
export function daysInStage(stageEnteredAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - stageEnteredAt.getTime()) / 86_400_000));
}

// ─── What the dossier is waiting for ────────────────────────────────────────

export interface NextFacts {
  stage: string;
  status: string;
  assignedAgentId: string | null;
  firstContactAt: Date | null;
  holdUntil: Date | null;
  /** Considered properties, by what they need. */
  candidates: {
    live: number;
    drafts: number;
    waitingAnswer: number;
    selectionRequested: { title: string } | null;
    selected: { title: string } | null;
    interested: number;
    nextVisit: { at: Date; title: string } | null;
  };
}

/** The next step and who must make it — the team, the client, or nobody. */
export function nextOf(f: NextFacts): DossierNext {
  const none = (code: DossierNext['code'], waitingOn: DossierNext['waitingOn'], at: string | null = null, property: string | null = null): DossierNext => ({ code, waitingOn, at, property });
  if (f.status === 'WON' || f.status === 'LOST') return none('NONE', 'NONE');
  if (f.status === 'ON_HOLD') return none('RESUME', 'TEAM', f.holdUntil ? f.holdUntil.toISOString().slice(0, 10) : null);
  if (!f.assignedAgentId || f.stage === 'INTEREST') return none('TAKE', 'TEAM');
  if (f.stage === 'QUALIFICATION') return f.firstContactAt ? none('QUALIFY', 'TEAM') : none('FIRST_CONTACT', 'TEAM');
  if (f.stage === 'MATCHING') {
    const c = f.candidates;
    if (c.selectionRequested) return none('CONFIRM_SELECTION', 'TEAM', null, c.selectionRequested.title);
    if (c.selected) return none('BUILD_FILE', 'TEAM', null, c.selected.title);
    if (c.nextVisit) return none('VISIT', 'NONE', c.nextVisit.at.toISOString(), c.nextVisit.title);
    if (c.drafts > 0 && c.waitingAnswer === 0 && c.interested === 0) return none('SEND_PROPOSALS', 'TEAM');
    if (c.interested > 0) return none('SELECT', 'TEAM');
    if (c.waitingAnswer > 0) return none('AWAIT_ANSWER', 'CLIENT');
    return none('PROPOSE', 'TEAM');
  }
  return none('FOLLOW', 'TEAM');
}

// ─── Stepping back, reopening (CYC-036, CYC-037) ────────────────────────────

/** CYC-037 — the stage a step back leads to; null: never by hand (APPROVED), or nowhere (INTEREST). */
export function moveBackTarget(stage: string, financingRequested: boolean): DossierStage | null {
  switch (stage) {
    case 'QUALIFICATION':
      return 'INTEREST';
    case 'MATCHING':
      return 'QUALIFICATION';
    case 'DOCUMENTS':
      return 'MATCHING';
    case 'BANK_REVIEW':
      return 'DOCUMENTS';
    case 'ACQUISITION':
      return financingRequested ? 'APPROVED' : 'DOCUMENTS';
    default:
      return null;
  }
}

export interface ReopenFacts {
  /** The stage the dossier had when it was closed. */
  closedAt: string;
  /** CYC-022 (b) — the retained property is still published and available. */
  retainedAvailable: boolean;
  hasRetained: boolean;
  clientQualified: boolean;
  dossierQualified: boolean;
  agentActive: boolean;
}

/**
 * CYC-036 — the most advanced stage whose conditions still hold, never beyond the one the dossier was in. DOCUMENTS is
 * the ceiling of a dossier that had reached it: the closing withdrew the submissions and cancelled the reservation.
 */
export function reopenStage(f: ReopenFacts): DossierStage {
  const ceiling = stageIndex(f.closedAt);
  const cap = (stage: DossierStage): DossierStage => (stageIndex(stage) <= ceiling ? stage : (STAGES[ceiling] ?? 'INTEREST'));
  if (ceiling >= stageIndex('DOCUMENTS') && f.hasRetained && f.retainedAvailable) return 'DOCUMENTS';
  if (f.agentActive && (f.clientQualified || f.dossierQualified)) return cap('MATCHING');
  if (f.agentActive) return cap('QUALIFICATION');
  return 'INTEREST';
}

/** CYC-035 point 6 — the outcome of the requests still open when their dossier closes. */
export function leadOutcomeOnClose(reason: string): 'UNREACHABLE' | 'DUPLICATE' | 'NOT_INTERESTED' | 'ANSWERED' {
  if (reason === 'UNREACHABLE') return 'UNREACHABLE';
  if (reason === 'DUPLICATE') return 'DUPLICATE';
  if (reason === 'CLIENT_WITHDREW' || reason === 'BOUGHT_ELSEWHERE') return 'NOT_INTERESTED';
  return 'ANSWERED';
}

/** CYC-035 — « Informer le client par e-mail » is ticked by default, except for DUPLICATE and CLIENT_WITHDREW. */
export function closeNotifiesByDefault(reason: string): boolean {
  return reason !== 'DUPLICATE' && reason !== 'CLIENT_WITHDREW';
}

/** MOD-312 — a dossier is deleted only at INTEREST or QUALIFICATION, without any deposited piece nor submission. */
export function deletable(d: { stage: string; status: string }, deposited: number, submissions: number): boolean {
  return (d.stage === 'INTEREST' || d.stage === 'QUALIFICATION') && deposited === 0 && submissions === 0;
}

// ─── The matching (CYC-070, CYC-071, INT-004) ───────────────────────────────

/** CYC-070 — statuses from which the adviser, or the client, may move a considered property. */
export const CAN_BECOME = {
  /** « Ce bien m'intéresse » · « Finalement, il m'intéresse » · « remis par le conseiller » (UNAVAILABLE). */
  INTERESTED_BY_CLIENT: ['PROPOSED', 'VIEWED', 'DECLINED'],
  INTERESTED_BY_STAFF: ['PROPOSED', 'VIEWED', 'DECLINED', 'UNAVAILABLE'],
  DECLINED: ['PROPOSED', 'VIEWED', 'INTERESTED', 'VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED'],
  SELECTED_BY_STAFF: ['PROPOSED', 'VIEWED', 'INTERESTED', 'VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED'],
  /** INT-030 — the client ASKS, from INTERESTED or VISITED. */
  SELECTION_REQUEST: ['INTERESTED', 'VISITED'],
} as const;

export interface PropertyState {
  publication: string;
  deletedAt: Date | null;
  archivedAt: Date | null;
  availability: string;
  lotsAvailable: number;
  /** Listed by the public catalogue now (published, active country and promoter): CYC-121 « hors ligne » otherwise. */
  online: boolean;
}

/** CYC-073 — sold, withdrawn or archived: no longer offered. */
export const isGone = (p: Pick<PropertyState, 'deletedAt' | 'archivedAt' | 'availability' | 'publication'>): boolean =>
  Boolean(p.deletedAt) || Boolean(p.archivedAt) || p.publication === 'ARCHIVED' || p.availability === 'SOLD' || p.availability === 'WITHDRAWN';

/**
 * CYC-071 — a property may be retained when it is published and has at least one AVAILABLE lot. Answers the reason
 * of the refusal: `PROPERTY_NOT_AVAILABLE` (gone, or entirely reserved), `PROPERTY_OFFLINE` (CYC-121), else null.
 */
export function retainRefusal(p: PropertyState): 'PROPERTY_NOT_AVAILABLE' | 'PROPERTY_OFFLINE' | null {
  if (isGone(p)) return 'PROPERTY_NOT_AVAILABLE';
  if (!p.online) return 'PROPERTY_OFFLINE';
  if (p.lotsAvailable < 1) return 'PROPERTY_NOT_AVAILABLE';
  return null;
}

/** INT-004 — what the client may do on a considered property now. */
export function clientActions(c: { status: string; origin: string; sentAt: Date | null; selectionRequestedAt: Date | null }, d: { stage: string; status: string }, p: PropertyState) {
  const live = isLive(d.status);
  const gone = isGone(p);
  const visible = c.origin === 'CLIENT_INTEREST' || c.sentAt !== null;
  return {
    interested: live && visible && !gone && (CAN_BECOME.INTERESTED_BY_CLIENT as readonly string[]).includes(c.status),
    decline: live && visible && (CAN_BECOME.DECLINED as readonly string[]).includes(c.status),
    selectRequest:
      live && visible && d.status === 'OPEN' && d.stage === 'MATCHING' && c.selectionRequestedAt === null && (CAN_BECOME.SELECTION_REQUEST as readonly string[]).includes(c.status) && retainRefusal(p) === null,
    cancelSelect: live && c.selectionRequestedAt !== null && c.status !== 'SELECTED',
  };
}
