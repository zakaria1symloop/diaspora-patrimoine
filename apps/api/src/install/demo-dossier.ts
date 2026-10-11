// PAR-082, plan 2.9 — « Mes pièces » only exists for a dossier that has a piece list; in delivery 2 that is a
// DEMONSTRATION dossier (real dossiers get their list with package 4.1). This part of the demo command gives the client
// account of an address (an account created through the site, never invented here) one dossier at the DOCUMENTS step
// on the demonstration property DP-DZ-0142, with the default list (GED-020) and a few pieces in different states, all
// through the domain functions (checklist, deposit made by the team, processing, validation, rejection).
//   pnpm --filter @dp/api demo -- --dossier-pour=adresse@exemple.fr
// The dossier also gets the story that led to it, as the team would have written it (INT-010, ECL-031, ECL-020): three
// properties proposed by the advisor (one retained, one opened, one not opened yet), the lines of « Suivi » and the
// dates of the steps — so that « Biens proposés », « Mes intérêts » and the timeline can be shown with content.
// Idempotent (one demonstration dossier per client), audited (actor SYSTEM, reason `demo`), removed by demo:remove
// (`removeDemoDossiers`), refused in production by the command itself. The address is never printed.
import PDFDocument from 'pdfkit';
import { DEMO_ACTOR } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { nextSequenceValue } from '../admin/sequences.js';
import { instantiateChecklist } from '../documents/checklist.js';
import { DocumentProcessing } from '../documents/document-processing.js';
import { createStaffVersion, rejectDocument, validateDocument } from '../documents/document-review.js';
import { scannerFor } from '../files/virus-scanner.js';
import { localDate } from '../platform/holidays.service.js';
import { newId } from '../platform/ids.js';
import { OutboxHandlers, OutboxWriter } from '../platform/outbox.js';
import type { Tx } from '../platform/tx.js';
import type { AdminServices } from './admin-services.js';

const actor = DEMO_ACTOR;

/** `--dossier-pour=adresse` (or `--dossier-pour adresse`). */
export function demoDossierEmail(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--dossier-pour=')) return a.slice('--dossier-pour='.length).trim().toLowerCase() || null;
    if (a === '--dossier-pour') return (argv[i + 1] ?? '').trim().toLowerCase() || null;
  }
  return null;
}

async function demoPdf(title: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 64, info: { Title: title, Producer: 'Diaspora Patrimoine' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));
  doc.fontSize(20).text('Document de démonstration', { align: 'left' });
  doc.moveDown().fontSize(13).text(title);
  doc.moveDown().fontSize(10).fillColor('#555').text('Fichier créé par la commande de démonstration (PAR-082). Il ne contient aucune donnée réelle.');
  doc.end();
  await done;
  return Buffer.concat(chunks);
}

/** Creates (once) the demonstration dossier of the account at `email`. Returns report lines. */
export async function ensureDemoDossier(s: AdminServices, email: string): Promise<string[]> {
  const client = await s.prisma.client.findFirst({ where: { email, userId: { not: null }, deletedAt: null, mergedIntoId: null }, select: { id: true, financingPreference: true } });
  if (!client) return ['Dossier de démonstration : aucun espace client à cette adresse (créez d’abord le compte sur le site).'];
  const marks = await s.prisma.auditLog.findMany({ where: { actorType: 'SYSTEM', reason: 'demo', action: 'dossier.created', clientId: client.id }, select: { entityId: true } });
  const existing = marks.length ? await s.prisma.dossier.findFirst({ where: { id: { in: marks.map((m) => m.entityId!) } }, select: { id: true, reference: true, assignedAgentId: true, propertyId: true, createdAt: true } }) : null;
  if (existing) return (await ensureDemoStory(s, existing)) ? [`Dossier de démonstration ${existing.reference} : biens proposés et suivi ajoutés.`] : [];
  const property = await s.prisma.property.findFirst({
    where: { reference: 'DP-DZ-0142', deletedAt: null },
    select: { id: true, programId: true, promoterId: true, countryCode: true, priceFrom: true, priceCurrency: true },
  });
  if (!property) return ['Dossier de démonstration : le bien DP-DZ-0142 manque (lancez d’abord la démonstration du catalogue).'];
  const agent = await s.prisma.membership.findFirst({
    where: { revokedAt: null, suspendedAt: null, role: { in: ['OWNER', 'ADMIN', 'AGENT'] }, organization: { type: 'OPERATOR' }, user: { status: 'ACTIVE' } },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });
  const tz = await s.settings.get('business.calendar.timezone');
  const dueDays = await s.settings.get('documents.defaultDueDays');
  const outbox = new OutboxWriter(s.clock);
  const now = s.clock.now();
  const today = localDate(now, tz);
  const year = Number(today.slice(0, 4));

  const dossier = await s.prisma.$transaction(
    async (tx) => {
      const n = await nextSequenceValue(tx, 'dossier', String(year), now);
      const reference = `DOS-${year}-${String(n).padStart(4, '0')}`;
      const id = newId();
      const created = await tx.dossier.create({
        data: {
          id,
          reference,
          clientId: client.id,
          stage: 'DOCUMENTS',
          status: 'OPEN',
          assignedAgentId: agent?.userId ?? null,
          propertyId: property.id,
          programId: property.programId,
          promoterId: property.promoterId,
          propertyCountryCode: property.countryCode,
          financingRequested: client.financingPreference !== 'CASH',
          financingType: client.financingPreference === 'ISLAMIC' ? 'ISLAMIC' : 'CONVENTIONAL',
          purchasePrice: property.priceFrom,
          purchaseCurrency: property.priceCurrency,
          stageEnteredAt: now,
          lastActivityAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.dossierParty.create({ data: { id: newId(), dossierId: id, role: 'PRIMARY', clientId: client.id, sortOrder: 1, createdAt: now, updatedAt: now } });
      await writeAudit(tx, actor, now, { action: 'dossier.created', entityType: 'dossier', entityId: id, entityLabel: reference, after: { stage: 'DOCUMENTS', propertyId: property.id }, clientId: client.id });
      await instantiateChecklist(tx, outbox, created, { actor, now, today, dueDays });
      return created;
    },
    { timeout: 60_000 },
  );

  // A few pieces in different states, as the team would make them (GED-055, CYC-142, CYC-143).
  const processing = new DocumentProcessing(s.prisma, s.clock, new OutboxHandlers(), outbox, s.storage, scannerFor(s.env.APP_ENV));
  const docs = await s.prisma.dossierDocument.findMany({ where: { dossierId: dossier.id, providedBy: 'CLIENT' }, select: { id: true, code: true, label: true } });
  const plan: { code: string; then: (tx: Tx, id: string) => Promise<void> }[] = [
    { code: 'ID_PASSPORT', then: (tx, id) => validateDocument(tx, outbox, { documentId: id, actor, now: s.clock.now(), today }) },
    // Issued 355 days ago with a validity of 365 days: « à renouveler » within 10 days (CYC-141).
    { code: 'CIVIL_BIRTH_CERT', then: (tx, id) => validateDocument(tx, outbox, { documentId: id, actor, now: s.clock.now(), today, issuedAt: shiftDay(today, -355) }) },
    { code: 'RES_PROOF_ADDRESS', then: (tx, id) => rejectDocument(tx, outbox, { documentId: id, actor, now: s.clock.now(), today, dueDays, reason: 'ILLEGIBLE', note: 'Le bas de la facture est coupé : l’adresse n’est pas lisible.' }) },
    { code: 'BNK_DOWN_PAYMENT_PROOF', then: async () => undefined },
  ];
  for (const step of plan) {
    const doc = docs.find((d) => d.code === step.code);
    if (!doc) continue;
    const body = await demoPdf(doc.label);
    const { versionId, sources } = await s.prisma.$transaction((tx) =>
      createStaffVersion(tx, s.storage, outbox, { documentId: doc.id, files: [{ body, fileName: `${doc.code!.toLowerCase()}-demonstration.pdf` }], actor, now: s.clock.now() }),
    );
    await processing.process(versionId, sources); // the API's outbox would do it too; whichever comes first, once
    await waitProcessed(s, versionId);
    await s.prisma.$transaction((tx) => step.then(tx, doc.id));
  }
  await ensureDemoStory(s, { id: dossier.id, reference: dossier.reference, assignedAgentId: dossier.assignedAgentId, propertyId: dossier.propertyId, createdAt: dossier.createdAt });
  return [`Dossier de démonstration ${dossier.reference} créé pour l’espace client demandé, avec sa liste de pièces (« Mes pièces »), ses biens proposés et son suivi.`];
}

/**
 * The story of the demonstration dossier (once): the advisor proposed three properties twelve days ago, the client
 * retained DP-DZ-0142, the pieces were asked for. Dates are those of the story, before the dossier's creation.
 */
async function ensureDemoStory(s: AdminServices, dossier: { id: string; reference: string; assignedAgentId: string | null; propertyId: string | null; createdAt: Date }): Promise<boolean> {
  if (await s.prisma.dossierCandidate.count({ where: { dossierId: dossier.id, origin: 'ADVISOR_PROPOSAL' } })) return false;
  const others = await s.prisma.property.findMany({
    where: { deletedAt: null, publication: 'PUBLISHED', availability: 'AVAILABLE', ...(dossier.propertyId ? { id: { not: dossier.propertyId } } : {}) },
    orderBy: { reference: 'asc' },
    take: 2,
    select: { id: true },
  });
  const retained = dossier.propertyId ? await s.prisma.property.findUnique({ where: { id: dossier.propertyId }, select: { id: true, title: true } }) : null;
  const agent = dossier.assignedAgentId ? await s.prisma.user.findUnique({ where: { id: dossier.assignedAgentId }, select: { firstName: true, lastName: true } }) : null;
  const conseiller = agent?.firstName ? (agent.lastName ? `${agent.firstName} ${agent.lastName.trim().charAt(0).toUpperCase()}.` : agent.firstName) : null;
  const requested = await s.prisma.dossierDocument.count({ where: { dossierId: dossier.id, providedBy: 'CLIENT', isInternal: false } });
  const at = (days: number, hour = 10) => new Date(Date.UTC(dossier.createdAt.getUTCFullYear(), dossier.createdAt.getUTCMonth(), dossier.createdAt.getUTCDate() - days, hour));
  const [opened, qualified, proposed, selected] = [at(16), at(14), at(12), at(5)];
  const message = 'Trois biens qui correspondent à votre budget et à votre souhait d’être près de la mer. Dites-moi ce que vous en pensez.';

  await s.prisma.$transaction(async (tx) => {
    const candidate = (propertyId: string, status: 'PROPOSED' | 'VIEWED' | 'SELECTED', viewedAt: Date | null, changedAt: Date) =>
      tx.dossierCandidate.upsert({
        where: { dossierId_propertyId: { dossierId: dossier.id, propertyId } },
        create: {
          id: newId(), dossierId: dossier.id, propertyId, origin: 'ADVISOR_PROPOSAL', proposedById: dossier.assignedAgentId, message, sentAt: proposed,
          status, statusChangedAt: changedAt, viewedAt, createdAt: proposed, updatedAt: changedAt,
        },
        update: {},
      });
    if (retained) await candidate(retained.id, 'SELECTED', at(11), selected);
    if (others[0]) await candidate(others[0].id, 'VIEWED', at(11), at(11));
    if (others[1]) await candidate(others[1].id, 'PROPOSED', null, proposed);

    const line = (kind: 'AGENT_ASSIGNED' | 'QUALIFIED' | 'PROPERTIES_PROPOSED' | 'PROPERTY_SELECTED' | 'DOCUMENTS_REQUESTED', params: Record<string, string | number | null>, when: Date) =>
      tx.clientTimelineEntry.create({ data: { id: newId(), dossierId: dossier.id, kind, occurredAt: when, params: params as never, createdAt: when } });
    if (conseiller) await line('AGENT_ASSIGNED', { conseiller }, opened);
    await line('QUALIFIED', { conseiller }, qualified);
    await line('PROPERTIES_PROPOSED', { conseiller, n: (retained ? 1 : 0) + others.length }, proposed);
    if (retained) await line('PROPERTY_SELECTED', { bien: retained.title }, selected);
    if (requested) await line('DOCUMENTS_REQUESTED', { n: requested }, dossier.createdAt);

    // ECL-020 — the dates of the steps the dossier went through.
    const stage = (toStage: 'INTEREST' | 'QUALIFICATION' | 'MATCHING' | 'DOCUMENTS', fromStage: 'INTEREST' | 'QUALIFICATION' | 'MATCHING' | null, when: Date) =>
      tx.dossierStageHistory.create({
        data: { id: newId(), dossierId: dossier.id, fromStage, toStage, fromStatus: fromStage ? 'OPEN' : null, toStatus: 'OPEN', isBackward: false, reason: 'demo', actorType: 'SYSTEM', changedAt: when, createdAt: when },
      });
    if (!(await tx.dossierStageHistory.count({ where: { dossierId: dossier.id } }))) {
      await stage('INTEREST', null, opened);
      await stage('QUALIFICATION', 'INTEREST', qualified);
      await stage('MATCHING', 'QUALIFICATION', proposed);
      await stage('DOCUMENTS', 'MATCHING', dossier.createdAt);
    }
    await tx.dossier.update({ where: { id: dossier.id }, data: { createdAt: opened, firstContactAt: qualified, qualifiedAt: qualified } });
    await writeAudit(tx, actor, s.clock.now(), { action: 'dossier.updated', entityType: 'dossier', entityId: dossier.id, entityLabel: dossier.reference, after: { demoStory: true } });
  });
  return true;
}

function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

async function waitProcessed(s: AdminServices, versionId: string): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const v = await s.prisma.documentVersion.findUnique({ where: { id: versionId }, select: { outcome: true } });
    if (v && v.outcome !== 'SCANNING') return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('demonstration deposit still in its security check');
}

/**
 * PAR-082 removal — the demonstration dossiers (found through the audit log) with their pieces, versions, files,
 * consents of their people and links; called inside demo:remove's transaction, BEFORE the properties. Returns the
 * storage keys to erase after the commit.
 */
export async function removeDemoDossiers(tx: Tx, dossierIds: string[], now: Date): Promise<{ count: number; keys: string[] }> {
  const ids = (await tx.dossier.findMany({ where: { id: { in: dossierIds } }, select: { id: true } })).map((d) => d.id);
  if (!ids.length) return { count: 0, keys: [] };
  const files = await tx.documentFile.findMany({ where: { document: { dossierId: { in: ids } } }, select: { storageKey: true } });
  await tx.consent.deleteMany({ where: { party: { dossierId: { in: ids } } } });
  await tx.simulation.updateMany({ where: { dossierId: { in: ids } }, data: { dossierId: null, updatedAt: now } });
  await tx.communication.updateMany({ where: { dossierId: { in: ids } }, data: { dossierId: null } });
  await tx.notification.deleteMany({ where: { entityType: 'Dossier', entityId: { in: ids } } });
  await tx.dossier.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) await writeAudit(tx, actor, now, { action: 'dossier.deleted', entityType: 'dossier', entityId: id });
  return { count: ids.length, keys: files.map((f) => f.storageKey) };
}
