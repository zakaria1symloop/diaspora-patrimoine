// GED-020, MOD-340, MOD-342 — creating the piece list of a dossier from its template (at the DOCUMENTS step, CYC-022):
// the template is chosen (the most specific active CLIENT_FILE template whose filters match, else the default one), its
// lines of the noted version are evaluated, a « per borrower » line gives one piece per concerned person who meets the
// conditions; a condition whose data is UNKNOWN is not met (the piece is not created and the list reports the missing
// information). Every piece is born PENDING, due in `documents.defaultDueDays` days; one `document.requested` event.
// Used today by the demonstration (PAR-082); the stage change of the back office (package 4.1) calls the same function.
import type { ChecklistItem, Client, Dossier, DossierParty } from '../generated/prisma/client.js';
import type { Actor } from '../admin/actor.js';
import { stampBy } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { newId } from '../platform/ids.js';
import type { OutboxWriter } from '../platform/outbox.js';
import type { Tx } from '../platform/tx.js';
import { recomputeCompleteness } from './document-processing.js';

type Conditions = {
  employmentType?: string[];
  residencyStatus?: string[];
  financingType?: string[];
  financingRequested?: boolean;
  hasCoBorrower?: boolean;
};

export interface PersonFacts {
  employmentType: string | null;
  residencyStatus: string | null;
}

export interface DossierFacts {
  financingRequested: boolean;
  financingType: string | null;
  hasCoBorrower: boolean;
}

/** MOD-340 — a CONVENTIONAL or ISLAMIC dossier matches lines without type or of its type; others only lines without type. */
function typeMatches(wanted: string[] | undefined, dossierType: string | null): boolean {
  if (!wanted?.length) return true;
  return dossierType === 'CONVENTIONAL' || dossierType === 'ISLAMIC' ? wanted.includes(dossierType) : false;
}

/** `true` met · `false` not met · `'UNKNOWN'` a needed data is missing (GED-020). */
export function evaluate(when: Conditions | null, person: PersonFacts, dossier: DossierFacts): true | false | 'UNKNOWN' {
  if (!when) return true;
  let unknown = false;
  if (when.employmentType?.length) {
    if (!person.employmentType) unknown = true;
    else if (!when.employmentType.includes(person.employmentType)) return false;
  }
  if (when.residencyStatus?.length) {
    if (!person.residencyStatus) unknown = true;
    else if (!when.residencyStatus.includes(person.residencyStatus)) return false;
  }
  if (when.financingType && !typeMatches(when.financingType, dossier.financingType)) return false;
  if (typeof when.financingRequested === 'boolean' && when.financingRequested !== dossier.financingRequested) return false;
  if (typeof when.hasCoBorrower === 'boolean' && when.hasCoBorrower !== dossier.hasCoBorrower) return false;
  return unknown ? 'UNKNOWN' : true;
}

export interface PlannedPiece {
  item: ChecklistItem;
  partyId: string | null;
}

/** GED-020 points 2 — the pieces a template version gives to a dossier, and the people whose situation is missing. */
export function planChecklist(
  items: ChecklistItem[],
  parties: (Pick<DossierParty, 'id' | 'role' | 'employmentType' | 'residencyStatus'> & { facts?: PersonFacts })[],
  client: Pick<Client, 'employmentType' | 'residencyStatus'>,
  dossier: DossierFacts,
): { pieces: PlannedPiece[]; missingPartyIds: string[] } {
  const pieces: PlannedPiece[] = [];
  const missing = new Set<string>();
  const factsOf = (p: (typeof parties)[number]): PersonFacts =>
    p.role === 'PRIMARY' ? { employmentType: client.employmentType, residencyStatus: client.residencyStatus } : { employmentType: p.employmentType, residencyStatus: p.residencyStatus };
  const primary = parties.find((p) => p.role === 'PRIMARY');
  for (const item of items) {
    const when = (item.appliesWhen ?? null) as Conditions | null;
    if (item.perParty) {
      for (const p of parties) {
        if (!item.appliesToRoles.includes(p.role)) continue;
        const r = evaluate(when, factsOf(p), dossier);
        if (r === true) pieces.push({ item, partyId: p.id });
        else if (r === 'UNKNOWN') missing.add(p.id);
      }
    } else {
      const r = evaluate(when, primary ? factsOf(primary) : { employmentType: client.employmentType, residencyStatus: client.residencyStatus }, dossier);
      if (r === true) pieces.push({ item, partyId: null });
      else if (r === 'UNKNOWN' && primary) missing.add(primary.id);
    }
  }
  return { pieces, missingPartyIds: [...missing] };
}

/** `YYYY-MM-DD` + n days → Date at midnight UTC (a `@db.Date` column). */
function addDays(day: string, n: number): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000);
}

/**
 * GED-020 — creates the list of `dossier` (no-op when it already has one). Returns the number of pieces created.
 * `today` is the calendar day (business time zone).
 */
export async function instantiateChecklist(
  tx: Tx,
  outbox: OutboxWriter,
  dossier: Dossier,
  opts: { actor: Actor; now: Date; today: string; dueDays: number },
): Promise<number> {
  if (dossier.checklistInstantiatedAt) return 0;
  const candidates = await tx.checklistTemplate.findMany({ where: { scope: 'CLIENT_FILE', isActive: true, deletedAt: null }, orderBy: { updatedAt: 'desc' } });
  const client = await tx.client.findUniqueOrThrow({ where: { id: dossier.clientId }, select: { employmentType: true, residencyStatus: true } });
  const matches = candidates.filter(
    (tpl) =>
      !tpl.isDefault &&
      (!tpl.countryCode || tpl.countryCode === dossier.propertyCountryCode) &&
      (!tpl.residencyFilter.length || (client.residencyStatus !== null && tpl.residencyFilter.includes(client.residencyStatus))) &&
      typeMatches(tpl.financingTypeFilter ? [tpl.financingTypeFilter] : undefined, dossier.financingType),
  );
  const specificity = (tpl: (typeof candidates)[number]) => Number(Boolean(tpl.countryCode)) + Number(tpl.residencyFilter.length > 0) + Number(Boolean(tpl.financingTypeFilter));
  const template = matches.sort((a, b) => specificity(b) - specificity(a))[0] ?? candidates.find((tpl) => tpl.isDefault);
  if (!template) throw Object.assign(new Error('NO_CHECKLIST_TEMPLATE'), { reason: 'NO_CHECKLIST_TEMPLATE' });
  const items = await tx.checklistItem.findMany({
    where: { templateId: template.id, addedInVersion: { lte: template.version }, OR: [{ retiredInVersion: null }, { retiredInVersion: { gt: template.version } }] },
    orderBy: { sortOrder: 'asc' },
  });
  const parties = await tx.dossierParty.findMany({ where: { dossierId: dossier.id, removedAt: null }, orderBy: { sortOrder: 'asc' } });
  const { pieces } = planChecklist(items, parties, client, {
    financingRequested: dossier.financingRequested,
    financingType: dossier.financingType,
    hasCoBorrower: parties.some((p) => p.role === 'CO_BORROWER'),
  });
  const existing = await tx.dossierDocument.findMany({ where: { dossierId: dossier.id }, select: { id: true, code: true, partyId: true } });
  const by = stampBy(opts.actor);
  let created = 0;
  for (const { item, partyId } of pieces) {
    const same = existing.find((d) => d.code === item.code && d.partyId === partyId);
    if (same) {
      // GED-020 point 3 — a piece deposited before the list is adopted, its status and versions kept.
      await tx.dossierDocument.update({ where: { id: same.id }, data: { source: 'CHECKLIST', checklistItemId: item.id, isRequired: item.isRequired, updatedAt: opts.now } });
      continue;
    }
    await tx.dossierDocument.create({
      data: {
        id: newId(),
        dossierId: dossier.id,
        partyId,
        checklistItemId: item.id,
        code: item.code,
        label: !dossier.financingRequested && item.labelWhenCash ? item.labelWhenCash : item.label,
        description: item.description,
        category: item.category,
        isRequired: item.isRequired,
        providedBy: item.providedBy,
        source: 'CHECKLIST',
        maxFiles: item.maxFiles,
        acceptedFormats: item.acceptedFormats,
        validityDays: item.validityDays,
        status: 'PENDING',
        statusChangedAt: opts.now,
        dueAt: item.providedBy === 'CLIENT' ? addDays(opts.today, opts.dueDays) : null,
        reminderBaseAt: opts.now,
        createdById: by,
        updatedById: by,
        createdAt: opts.now,
        updatedAt: opts.now,
      },
    });
    created++;
  }
  await tx.dossier.update({
    where: { id: dossier.id },
    data: { checklistTemplateId: template.id, checklistTemplateVersion: template.version, checklistInstantiatedAt: opts.now, updatedById: by, updatedAt: opts.now },
  });
  await recomputeCompleteness(tx, dossier.id, opts.now);
  await writeAudit(tx, opts.actor, opts.now, {
    action: 'dossier.updated',
    entityType: 'dossier',
    entityId: dossier.id,
    entityLabel: dossier.reference,
    after: { checklistTemplateId: template.id, checklistTemplateVersion: template.version, pieces: created },
    clientId: dossier.clientId,
  });
  await outbox.add(tx, { type: 'document.requested', aggregateType: 'Dossier', aggregateId: dossier.id, payload: { count: created, initial: true } }, opts.now);
  return created;
}
