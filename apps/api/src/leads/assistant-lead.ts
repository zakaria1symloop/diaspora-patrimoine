// ASS-030, ASS-052, IA-013 — a `GUIDED_SEARCH` request that ends a conversation with the assistant (mode AI). The server
// takes from the conversation it keeps: the criteria understood, the properties shown, and the summary of the search
// (the visitor's messages, personal data already masked; the reason of the handover). The browser's values are ignored.
// The conversation itself stays without identity and is purged at 30 days; only this copy joins the request.
import type { AiHandoffReason, AiLeadSummary, CatalogueCriteria, GuidedAnswers } from '@dp/contracts';
import { AI_HANDOFF_REASONS, GUIDED_ROOMS, GUIDED_TYPES } from '@dp/contracts';
import { AppError } from '../platform/errors.js';
import type { PrismaService } from '../platform/prisma.service.js';

export interface AssistantLeadData {
  criteria: CatalogueCriteria;
  propertyReferences: string[];
  summary: AiLeadSummary;
  /** ASS-031 — the criteria in the shape of the questionnaire's answers, to complete the client record. */
  answers: GuidedAnswers;
}

/** ASS-031 — criteria → answers (regions, types, rooms, budget); what the questionnaire cannot say is left out. */
export function answersFromCriteria(c: CatalogueCriteria): GuidedAnswers {
  const a: GuidedAnswers = {};
  if (c.region?.length) a.region = c.region.slice(0, 30);
  const types = (c.type ?? []).filter((t): t is (typeof GUIDED_TYPES)[number] => (GUIDED_TYPES as readonly string[]).includes(t));
  if (types.length) a.type = types;
  const rooms = (c.rooms ?? []).filter((r): r is (typeof GUIDED_ROOMS)[number] => (GUIDED_ROOMS as readonly string[]).includes(r));
  if (rooms.length) a.rooms = rooms;
  if (c.monthlyMax !== undefined) a.budget = { kind: 'MONTHLY', max: c.monthlyMax };
  else if (c.priceMax !== undefined) a.budget = { kind: 'TOTAL', max: c.priceMax };
  return a;
}

export async function loadAssistantLead(prisma: Pick<PrismaService, 'assistantConversation'>, id: string, now: Date): Promise<AssistantLeadData> {
  const row = await prisma.assistantConversation.findFirst({
    where: { id, expiresAt: { gt: now } },
    select: { id: true, messages: true, criteria: true, propertyReferences: true, handoffReason: true, visitorTurns: true },
  });
  // A purged or unknown conversation: the field is refused (the site then sends the request without it).
  if (!row) throw AppError.validation([{ field: 'fields.assistantConversationId', code: 'INVALID_CHOICE' }]);
  const messages = (row.messages as { role?: string; text?: string }[]).filter((m) => m.role === 'visitor' && typeof m.text === 'string');
  const criteria = row.criteria as CatalogueCriteria;
  const reason = (AI_HANDOFF_REASONS as readonly string[]).includes(row.handoffReason ?? '') ? (row.handoffReason as AiHandoffReason) : null;
  return {
    criteria,
    propertyReferences: row.propertyReferences.slice(0, 20),
    summary: { conversationId: row.id, visitorMessages: messages.map((m) => m.text!.slice(0, 500)), handoffReason: reason, turns: row.visitorTurns },
    answers: answersFromCriteria(criteria),
  };
}
