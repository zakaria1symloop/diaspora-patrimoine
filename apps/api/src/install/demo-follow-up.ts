// PAR-082, Q-067 — packages 3.7 and 3.8 in the demonstration: for the client account of an address (an account created
// through the site, never invented here), one dossier FOLLOWED by the team, written through exactly the use cases of
// the back office (the same services as the routes): opened by the first Direction account (PIP-015), a call held
// (TAC-044, first contact CYC-004), qualified (CYC-021), three properties proposed and sent (PIP-031), a task to do
// (TAC-003) and an appointment to come (TAC-040). The client then reads « Biens proposés » and « Mes rendez-vous »
// in his space, the team the record EA-22, the tasks EA-30 and the agenda EA-31.
//   pnpm --filter @dp/api demo -- --suivi-pour=adresse@exemple.fr
// Idempotent (one followed dossier per client), every write audited with the actor SYSTEM and the reason `demo`;
// removed by demo:remove (`removeDemoFollowUps`); refused in production by the command itself. The address is never
// printed. The call is noted in the minute after the opening (a first contact follows the opening of the dossier):
// the command waits for the next minute.
import type { Request } from 'express';
import { DEMO_ACTOR } from '../admin/actor.js';
import { addDays, localDay } from '../automation/timing.js';
import { TasksService } from '../automation/tasks.service.js';
import { StaffViews } from '../back-office/staff-view.js';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { DossierViews } from '../client-space/dossier-view.js';
import { SpaceReader } from '../client-space/space-reader.js';
import { CandidatesService } from '../dossiers-admin/candidates.service.js';
import { DossierCommandsService } from '../dossiers-admin/dossier-commands.service.js';
import { DossierReadService } from '../dossiers-admin/dossier-read.service.js';
import { PropertyCards } from '../dossiers-admin/property-cards.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { BusinessCalendarService } from '../platform/business-calendar.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { OutboxWriter, type EventDispatcher } from '../platform/outbox.js';
import { ClientIp } from '../platform/rate-limit.js';
import type { Tx } from '../platform/tx.js';
import { AppointmentsService } from '../tasks-admin/appointments.service.js';
import { TasksAdminService } from '../tasks-admin/tasks-admin.service.js';
import type { AdminServices } from './admin-services.js';

/** `--suivi-pour=adresse` (or `--suivi-pour adresse`). */
export function demoFollowUpEmail(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--suivi-pour=')) return a.slice('--suivi-pour='.length).trim().toLowerCase() || null;
    if (a === '--suivi-pour') return (argv[i + 1] ?? '').trim().toLowerCase() || null;
  }
  return null;
}

/** The running API's dispatcher picks the events up from the outbox (ARC-050): nothing to wake in this process. */
const SLEEPING: EventDispatcher = { wake: () => undefined } as unknown as EventDispatcher;
const stubRequest = (): Request => ({ headers: {}, body: {} }) as unknown as Request;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function services(s: AdminServices) {
  const { prisma, clock, settings, env } = s;
  const calendar = new BusinessCalendarService(prisma, settings);
  const views = new StaffViews(settings);
  const outbox = new OutboxWriter(clock);
  const tasks = new TasksService(outbox);
  const idempotency = new IdempotencyService(prisma, clock, new ClientIp(env));
  const index = new CatalogueIndex(prisma, clock, settings, env);
  const cards = new PropertyCards(prisma, index);
  const reader = new SpaceReader(prisma, settings, index, new CatalogueService(index, prisma, settings, clock));
  const read = new DossierReadService(prisma, clock, settings, calendar, views, cards, new DossierViews(reader, clock));
  return {
    index,
    commands: new DossierCommandsService(prisma, clock, settings, calendar, views, outbox, tasks, idempotency, read, cards, SLEEPING),
    candidates: new CandidatesService(prisma, clock, settings, views, outbox, tasks, idempotency, index, cards, read, SLEEPING),
    tasks: new TasksAdminService(prisma, clock, calendar, views, tasks, SLEEPING),
    appointments: new AppointmentsService(prisma, clock, calendar, views, outbox, SLEEPING),
    read,
  };
}

/** The followed dossiers of the demonstration: those opened by the actor SYSTEM for the reason `demo` (Q-067). */
async function demoDossierIds(db: Tx | AdminServices['prisma']): Promise<string[]> {
  const marks = await db.auditLog.findMany({ where: { actorType: 'SYSTEM', reason: 'demo', action: 'dossier.created', entityType: 'Dossier', entityId: { not: null } }, select: { entityId: true } });
  return [...new Set(marks.map((m) => m.entityId!))];
}

export async function ensureDemoFollowUp(s: AdminServices, email: string): Promise<string[]> {
  const out: string[] = [];
  const client = await s.prisma.client.findFirst({ where: { email, deletedAt: null, gdprErasedAt: null }, select: { id: true, firstName: true, lastName: true, countryOfResidence: true, residencyStatus: true, budgetMax: true, budgetMonthly: true, downPayment: true, financingPreference: true, purchaseTimeframe: true, timezone: true } });
  if (!client) return ['Suivi de dossier : aucune fiche client pour cette adresse (créez d’abord le compte sur le site).'];
  const existing = await s.prisma.dossier.findFirst({ where: { id: { in: await demoDossierIds(s.prisma) }, clientId: client.id }, select: { reference: true } });
  if (existing) return [`Suivi de dossier : ${existing.reference} existe déjà pour ce client.`];
  const owner = await s.prisma.membership.findFirst({ where: { role: 'OWNER', revokedAt: null, user: { status: 'ACTIVE' } }, orderBy: { createdAt: 'asc' }, select: { user: { select: { id: true, email: true, firstName: true, lastName: true, timezone: true } } } });
  if (!owner) return ['Suivi de dossier : aucun compte Direction actif (pnpm ops owner:invite).'];
  const u = owner.user;
  const auth = { userId: u.id, kind: 'STAFF', audience: 'ADMIN', sessionId: 'demo', email: u.email, firstName: u.firstName, lastName: u.lastName, role: 'OWNER', clientId: null, passwordConfirmedAt: null, actor: DEMO_ACTOR, preview: null, refreshTokenHash: '', previousRefreshTokenHash: null, rotatedAt: null } as AuthContext;
  const x = services(s);

  // PIP-015 — the dossier, with a considered property, entrusted to the Direction account (CYC-020)
  const available = (await x.read.pickProperties(undefined)).data.filter((p) => p.availability === 'AVAILABLE');
  if (available.length < 3) return ['Suivi de dossier : moins de trois biens disponibles au catalogue (lancez d’abord la démonstration sans option).'];
  const created = await x.commands.create(auth, stubRequest(), { clientId: client.id, propertyId: available[0]!.id, financingRequested: true });
  const { id, reference } = created.body;
  out.push(`Suivi de dossier : ${reference} ouvert (qualification).`);

  // TAC-044, CYC-004 — a call held in the minute that follows the opening
  const zone = u.timezone || 'Europe/Paris';
  await sleep(61_000 - (Date.now() % 60_000));
  const wall = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(s.clock.now());
  const part = (k: string) => wall.find((p) => p.type === k)!.value;
  await x.appointments.create(auth, { clientId: client.id, dossierId: id, type: 'CALL', date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}`, durationMinutes: 15, zone, internalNote: 'Premier appel : projet et budget.' });

  // CYC-021, CRM-050 — only what the record misses is completed (a real account keeps what its owner typed)
  const fill: Record<string, string> = {};
  if (!client.countryOfResidence) fill.countryOfResidence = 'FR';
  if (!client.residencyStatus) fill.residencyStatus = 'NON_RESIDENT';
  if (client.budgetMax === null && client.budgetMonthly === null) Object.assign(fill, { budgetMax: '180000', budgetCurrency: 'EUR' });
  if (client.downPayment === null) Object.assign(fill, { downPayment: '30000', downPaymentCurrency: 'EUR' });
  if (!client.financingPreference) fill.financingPreference = 'CONVENTIONAL';
  if (!client.purchaseTimeframe) fill.purchaseTimeframe = 'M6_12';
  const detail = await x.read.detail(auth, reference);
  await x.commands.qualify(auth, id, { version: detail.version, client: fill });
  out.push(`${reference} qualifié : rapprochement.`);

  // PIP-031 — two more properties, sent with the first one, with a word
  await x.candidates.propose(auth, stubRequest(), id, { propertyIds: [available[1]!.id, available[2]!.id], message: 'Voici trois biens qui correspondent à votre projet. Dites-moi ceux qui vous intéressent.', send: true });
  out.push(`${reference} : trois biens proposés au client.`);

  // TAC-003, TAC-040 — a task for the adviser, a visio to come (informed by e-mail)
  const today = localDay(s.clock.now(), zone);
  await x.tasks.create(auth, { title: 'Appeler le client après sa lecture des propositions', type: 'CALL', priority: 'HIGH', dueDate: addDays(today, 2), dueTime: '10:00', reminderKind: 'BEFORE_1H', links: { dossierId: id, clientId: client.id, leadId: null } });
  await x.appointments.create(auth, { clientId: client.id, dossierId: id, type: 'VISIO', date: addDays(today, 3), time: '11:00', durationMinutes: 30, zone, meetingUrl: 'https://meet.example.test/diaspora-patrimoine', clientNote: 'Nous passerons en revue les biens proposés et votre financement.' });
  out.push(`${reference} : une tâche et un rendez-vous en visio dans trois jours.`);
  return out;
}

/** demo:remove — the followed dossiers, with their tasks and appointments (Restrict), then the dossiers themselves. */
export async function removeDemoFollowUps(tx: Tx): Promise<string[]> {
  const ids = (await tx.dossier.findMany({ where: { id: { in: await demoDossierIds(tx) } }, select: { id: true } })).map((d) => d.id);
  if (!ids.length) return [];
  await tx.task.deleteMany({ where: { dossierId: { in: ids } } });
  await tx.appointment.deleteMany({ where: { dossierId: { in: ids } } });
  await tx.lead.updateMany({ where: { dossierId: { in: ids } }, data: { dossierId: null } });
  return ids;
}
