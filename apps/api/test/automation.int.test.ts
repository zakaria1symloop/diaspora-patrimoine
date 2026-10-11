// Package 1.4 « moteur des automatisations » against the database: the execution of a rule (AUT-004, AUT-005), delays
// with the clock, new tries, quiet hours (AUT-006), deduplication keys, the notifications of NOT-035, the tasks
// (AUT-032, AUT-035, CYC-220), each seeded rule (AUT § 5), the installation (PAR-081) and the journal of the scheduler
// (AUT-082). Every row of the rule tests is written inside a transaction rolled back at the end; the scheduler tests
// write `JobRun` rows of tasks named for the test only, and delete them.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYSTEM_ACTOR, type Actor } from '../src/admin/actor.js';
import { AutomationJobs, emitFact } from '../src/automation/automation-jobs.js';
import { RuleTeamActions } from '../src/automation/rule-actions.js';
import { RuleContextLoader } from '../src/automation/rule-context.js';
import { RuleEngine } from '../src/automation/rule-engine.js';
import { RuleMailAction, RuleMailComposers } from '../src/automation/rule-mail.js';
import { RULE_SEEDS } from '../src/automation/rule-seeds.js';
import { Scheduler } from '../src/automation/scheduler.js';
import { StaffDirectory } from '../src/automation/staff-directory.js';
import { StaffNotifier } from '../src/automation/staff-notifications.service.js';
import { TaskAutoClose } from '../src/automation/task-effects.js';
import { TasksService } from '../src/automation/tasks.service.js';
import { TechAlerts } from '../src/automation/tech-alerts.js';
import { MemoryMailProvider } from '../src/communication/mail-provider.js';
import { MailerService } from '../src/communication/mailer.service.js';
import type { Env } from '../src/config/env.js';
import { EventScan } from '../src/events/event-scan.js';
import { EventsPublicService } from '../src/events/events-public.service.js';
import { RegistrationDocuments } from '../src/events/registration-documents.js';
import { AuthMailHandler } from '../src/identity/auth-mail.js';
import { IdentityJobs } from '../src/identity/identity-jobs.js';
import { TokensService } from '../src/identity/tokens.service.js';
import { installWorkflowRules } from '../src/install/workflow-rules.js';
import { BusinessCalendarService } from '../src/platform/business-calendar.js';
import { FixedClock } from '../src/platform/clock.js';
import { newId } from '../src/platform/ids.js';
import { OutboxHandlers, OutboxWriter, type OutboxRecord } from '../src/platform/outbox.js';
import { PrismaService } from '../src/platform/prisma.service.js';
import { SettingsService } from '../src/platform/settings.service.js';
import type { Tx } from '../src/platform/tx.js';

const API = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(API, '.env'), quiet: true });
const url = process.env.DATABASE_URL;

async function reachable(): Promise<boolean> {
  if (!url) return false;
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await c.connect();
    // The engine's rules are installation data: without them (installer not run) there is nothing to test against.
    const r = await c.query(`select count(*)::int as n from workflow_rules where code = any($1)`, [RULE_SEEDS.map((s) => s.code)]);
    return r.rows[0].n === RULE_SEEDS.length;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => undefined);
  }
}

const dbUp = await reachable();
class Rollback extends Error {}

/** Monday 12 October 2026, 10:00 in Paris: a working hour, outside the quiet hours. */
const T0 = new Date('2026-10-12T08:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe.skipIf(!dbUp)('automation engine against the database', () => {
  let prisma: PrismaService;
  const clock = new FixedClock(T0);
  const env = { DATABASE_URL: url!, APP_ENV: 'local', APP_ROLE: 'api', WEB_URL: 'https://site.test', ADMIN_URL: 'https://admin.test', LINK_SIGNING_KEY: 'l'.repeat(40), TECH_ALERT_EMAIL: undefined } as unknown as Env;
  let settings: SettingsService;

  beforeAll(async () => {
    prisma = new PrismaService(env);
    settings = new SettingsService(prisma, new FixedClock(T0));
    await settings.all();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Everything the engine is made of, on one transaction. */
  function world(tx: Tx) {
    const db = tx as unknown as PrismaService;
    const provider = new MemoryMailProvider();
    const mailer = new MailerService(db, clock, settings, env, provider);
    const calendar = new BusinessCalendarService(db, settings);
    const staff = new StaffDirectory();
    const notifier = new StaffNotifier();
    const tasks = new TasksService(new OutboxWriter(clock));
    const alerts = new TechAlerts(db, clock, mailer, staff, notifier, env);
    const composers = new RuleMailComposers();
    const handlers = new OutboxHandlers();
    const engine = new RuleEngine(db, clock, calendar, new RuleContextLoader(calendar), staff, new RuleMailAction(mailer, settings, composers, env), new RuleTeamActions(tasks, notifier, settings), alerts, handlers);
    const autoClose = new TaskAutoClose(db, clock, tasks, handlers);
    autoClose.onModuleInit();
    const scheduler = new Scheduler(db, clock, calendar, alerts, env);
    const jobs = new AutomationJobs(db, clock, settings, calendar, scheduler, engine, alerts);
    /** Ids of the events this test emitted: the only executions it lets the engine process. */
    const eventIds: string[] = [];
    return { db, provider, mailer, calendar, staff, notifier, tasks, alerts, composers, handlers, engine, autoClose, scheduler, jobs, eventIds };
  }
  type World = ReturnType<typeof world>;

  async function inRollback(fn: (tx: Tx, w: World) => Promise<void>): Promise<void> {
    clock.set(T0);
    await prisma
      .$transaction(
        async (tx) => {
          await fn(tx, world(tx));
          throw new Rollback();
        },
        { timeout: 60_000, maxWait: 10_000 },
      )
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) throw e;
      });
  }

  // ---------- fixtures (real rows, rolled back) ----------

  const stamps = () => ({ createdAt: clock.now(), updatedAt: clock.now() });

  async function staffUser(tx: Tx, role: 'OWNER' | 'ADMIN' | 'AGENT' | 'SUPPORT', extra: { absentUntil?: Date } = {}): Promise<string> {
    const org = await tx.organization.findFirstOrThrow({ where: { type: 'OPERATOR' }, select: { id: true } });
    const id = newId();
    await tx.user.create({ data: { id, kind: 'STAFF', email: `staff-${id}@example.test`, firstName: 'Amel', lastName: 'Kaci', status: 'ACTIVE', ...stamps() } });
    await tx.membership.create({ data: { id: newId(), userId: id, organizationId: org.id, role, invitedAt: clock.now(), receivesLeads: true, absentUntil: extra.absentUntil ?? null, ...stamps() } });
    return id;
  }

  async function client(tx: Tx, data: Record<string, unknown> = {}): Promise<{ id: string; email: string }> {
    const id = newId();
    const email = `client-${id}@example.test`;
    await tx.client.create({ data: { id, firstName: 'Karima', lastName: 'Benali', email, timezone: 'Europe/Paris', lastActivityAt: clock.now(), ...stamps(), ...data } as never });
    return { id, email };
  }

  async function lead(tx: Tx, data: Record<string, unknown> = {}): Promise<{ id: string; reference: string }> {
    const id = newId();
    const reference = `DEM-T-${id.slice(-8)}`;
    await tx.lead.create({ data: { id, reference, kind: 'CALLBACK_REQUEST', payload: {}, locale: 'fr', spamScore: 0, spamSignals: [], status: 'NEW', ...stamps(), ...data } as never });
    return { id, reference };
  }

  async function dossier(tx: Tx, clientId: string, data: Record<string, unknown> = {}): Promise<{ id: string; reference: string }> {
    const id = newId();
    const reference = `DOS-T-${id.slice(-8)}`;
    await tx.dossier.create({ data: { id, reference, clientId, financingRequested: true, stageEnteredAt: clock.now(), lastActivityAt: clock.now(), ...stamps(), ...data } as never });
    return { id, reference };
  }

  async function cafe(tx: Tx, data: Record<string, unknown> = {}): Promise<string> {
    const id = newId();
    const startsAt = new Date(T0.getTime() + 7 * 24 * HOUR);
    await tx.event.create({
      data: {
        id, reference: `CAF-T-${id.slice(-6)}`, slug: `cafe-test-${id.slice(-8)}`, title: 'Le Café', locationLabel: 'Lyon', cityName: 'Lyon', venueAddress: '1 rue de la République, Lyon',
        startsAt, endsAt: new Date(startsAt.getTime() + 3 * HOUR), timezone: 'Europe/Paris', capacity: 40, maxSeatsPerRegistration: 4,
        registrationClosesAt: new Date(startsAt.getTime() - HOUR), status: 'PUBLISHED', publishedAt: new Date(T0.getTime() - 30 * 24 * HOUR), ...stamps(), ...data,
      } as never,
    });
    return id;
  }

  async function registration(tx: Tx, eventId: string, registeredAt: Date, status = 'REGISTERED'): Promise<{ id: string; email: string; clientId: string }> {
    const c = await client(tx);
    const id = newId();
    await tx.eventRegistration.create({
      data: { id, eventId, clientId: c.id, firstName: 'Karima', lastName: 'Benali', email: c.email, seats: 2, status, source: 'WEB_FORM', manageTokenHash: id.replace(/-/g, '').padEnd(64, '0'), checkInCode: id.slice(-6).toUpperCase(), registeredAt, locale: 'fr', ...stamps() } as never,
    });
    return { id, email: c.email, clientId: c.id };
  }

  /** Writes the event in the outbox, as the action of a module would, and hands it to the engine. */
  async function emit(tx: Tx, w: World, type: string, aggregateType: string, aggregateId: string, payload: Record<string, unknown> = {}): Promise<OutboxRecord> {
    const id = await new OutboxWriter(clock).add(tx, { type, aggregateType, aggregateId, payload });
    const record: OutboxRecord = { id, type, aggregateType, aggregateId, payload, occurredAt: clock.now(), attempts: 0 };
    w.eventIds.push(id);
    await w.autoClose.handle(record); // AUT-003: system effects first
    await w.engine.handle(record);
    return record;
  }

  /**
   * `workflow.execute` for THIS test: only the executions of the events it emitted. The database is shared with the
   * running application and with other test runs — their pending executions are never processed here.
   */
  async function runDue(tx: Tx, w: World): Promise<Record<string, number>> {
    const mine = await tx.workflowExecution.findMany({ where: { triggerEventId: { in: w.eventIds } }, select: { id: true } });
    return w.engine.runDue(200, mine.map((e) => e.id));
  }

  const execution = (tx: Tx, code: string, eventId: string) => tx.workflowExecution.findFirst({ where: { triggerEventId: eventId, rule: { code } } });
  const alertsOf = (tx: Tx, userId: string, type = 'NS_RULE_ALERT') => tx.notification.findMany({ where: { userId, type }, orderBy: { createdAt: 'asc' } });
  const mails = (w: World, code: string) => w.provider.sent.filter((m) => m.templateCode === code);

  // ---------- AUT-004, AUT-005 ----------

  describe('execution of a rule', () => {
    it('AUT-004 — conditions false at the event: nothing is recorded', async () => {
      await inRollback(async (tx, w) => {
        const l = await lead(tx, { status: 'IN_PROGRESS' }); // assigned at once: R_LEAD_NOT_TAKEN does not apply
        const e = await emit(tx, w, 'lead.created', 'Lead', l.id, { kind: 'CALLBACK_REQUEST', attachment: 'NONE' });
        expect(await tx.workflowExecution.count({ where: { triggerEventId: e.id } })).toBe(0);
      });
    });

    it('AUT-004 — a delayed rule waits for its date, reads the object again, then acts (R_LEAD_NOT_TAKEN)', async () => {
      await inRollback(async (tx, w) => {
        const admin = await staffUser(tx, 'ADMIN');
        const l = await lead(tx);
        const e = await emit(tx, w, 'lead.created', 'Lead', l.id, { kind: 'CALLBACK_REQUEST', attachment: 'NONE' });
        const pending = (await execution(tx, 'R_LEAD_NOT_TAKEN', e.id))!;
        expect(pending.status).toBe('PENDING');
        // Monday 10:00 in Paris + 4 business hours = 14:00.
        expect(pending.scheduledFor.toISOString()).toBe('2026-10-12T12:00:00.000Z');
        expect(await alertsOf(tx, admin)).toHaveLength(0);

        clock.set(new Date('2026-10-12T11:59:00Z'));
        await runDue(tx, w);
        expect((await execution(tx, 'R_LEAD_NOT_TAKEN', e.id))!.status).toBe('PENDING'); // not due yet
        clock.set(new Date('2026-10-12T12:00:30Z'));
        await runDue(tx, w);
        expect((await execution(tx, 'R_LEAD_NOT_TAKEN', e.id))!.status).toBe('DONE');
        const [alert] = await alertsOf(tx, admin);
        expect(alert!.title).toBe(`La demande ${l.reference} attend depuis 4 heures ouvrées.`);
        expect(alert!.link).toBe(`/demandes/${l.reference}`);
        expect(alert!.entityType).toBe('Lead');
      });
    });

    it('AUT-004 — what no longer holds at the date is SKIPPED, with its reason', async () => {
      await inRollback(async (tx, w) => {
        const admin = await staffUser(tx, 'ADMIN');
        const l = await lead(tx);
        const e = await emit(tx, w, 'lead.created', 'Lead', l.id, { kind: 'CALLBACK_REQUEST', attachment: 'NONE' });
        await tx.lead.update({ where: { id: l.id }, data: { status: 'IN_PROGRESS' } }); // taken meanwhile
        clock.set(new Date('2026-10-12T12:01:00Z'));
        await runDue(tx, w);
        const done = (await execution(tx, 'R_LEAD_NOT_TAKEN', e.id))!;
        expect(done.status).toBe('SKIPPED');
        expect(done.skipReason).toBe('Conditions non remplies au moment de l’exécution');
        expect(await alertsOf(tx, admin)).toHaveLength(0);
      });
    });

    it('AUT-004 point 5 — a pending execution follows the rule as it is when it acts', async () => {
      await inRollback(async (tx, w) => {
        const admin = await staffUser(tx, 'ADMIN');
        const l = await lead(tx);
        const e = await emit(tx, w, 'lead.created', 'Lead', l.id, { kind: 'CALLBACK_REQUEST', attachment: 'NONE' });
        await tx.workflowRule.update({ where: { code: 'R_LEAD_NOT_TAKEN' }, data: { isActive: false } });
        clock.set(new Date('2026-10-12T12:01:00Z'));
        await runDue(tx, w);
        const skipped = (await execution(tx, 'R_LEAD_NOT_TAKEN', e.id))!;
        expect([skipped.status, skipped.skipReason]).toEqual(['SKIPPED', 'Règle désactivée']);
        expect(await alertsOf(tx, admin)).toHaveLength(0);

        // Disabled then enabled again before the date: it runs — with the rule's NEW actions, not its new delay.
        const l2 = await lead(tx);
        await tx.workflowRule.update({ where: { code: 'R_LEAD_NOT_TAKEN' }, data: { isActive: true } });
        const e2 = await emit(tx, w, 'lead.created', 'Lead', l2.id, { kind: 'CALLBACK_REQUEST', attachment: 'NONE' });
        const before = (await execution(tx, 'R_LEAD_NOT_TAKEN', e2.id))!;
        await tx.workflowRule.update({ where: { code: 'R_LEAD_NOT_TAKEN' }, data: { delayValue: 8, actions: [{ type: 'NOTIFY_STAFF', recipients: 'ADMINS', title: 'Demande {{lead.reference}} à prendre' }] } });
        expect((await execution(tx, 'R_LEAD_NOT_TAKEN', e2.id))!.scheduledFor).toEqual(before.scheduledFor);
        clock.set(new Date(before.scheduledFor.getTime() + MINUTE));
        await runDue(tx, w);
        expect((await alertsOf(tx, admin)).map((n) => n.title)).toEqual([`Demande ${l2.reference} à prendre`]);
      });
    });

    it('AUT-005 — a rule runs once per event, however many times the event is replayed', async () => {
      await inRollback(async (tx, w) => {
        const admin = await staffUser(tx, 'ADMIN');
        const l = await lead(tx, { kind: 'PARTNER_REQUEST' });
        const e = await emit(tx, w, 'lead.application_submitted', 'Lead', l.id, { partnerKind: 'PROMOTER', companyName: 'Résidences du Lac' });
        await w.engine.handle(e);
        await w.engine.handle(e);
        expect(await tx.workflowExecution.count({ where: { triggerEventId: e.id } })).toBe(1);
        expect(await tx.task.count({ where: { dedupeKey: `partner-app:${l.id}` } })).toBe(1);
        expect(await alertsOf(tx, admin)).toHaveLength(1);
      });
    });

    it('AUT-005 — no loop: an event produced by the action of a rule triggers no rule; AUT-013 — nor a technical event', async () => {
      await inRollback(async (tx, w) => {
        const l = await lead(tx);
        const caused = await emit(tx, w, 'lead.created', 'Lead', l.id, { kind: 'CALLBACK_REQUEST', attachment: 'NONE', causation: { ruleId: newId(), executionId: newId() } });
        expect(await tx.workflowExecution.count({ where: { triggerEventId: caused.id } })).toBe(0);
        const technical = await emit(tx, w, 'auth.email_requested', 'AuthMail', newId(), { template: 'C_MAGIC_LOGIN' });
        expect(await tx.workflowExecution.count({ where: { triggerEventId: technical.id } })).toBe(0);
      });
    });

    it('AUT-021 — a definition that no longer passes the validation is never run', async () => {
      await inRollback(async (tx, w) => {
        const admin = await staffUser(tx, 'ADMIN');
        await tx.workflowRule.update({ where: { code: 'R_LEAD_DURING_DOSSIER' }, data: { conditions: { all: [{ field: 'client.passwordHash', op: 'eq', value: 'x' }] } } });
        const l = await lead(tx);
        const e = await emit(tx, w, 'lead.created', 'Lead', l.id, { kind: 'CALLBACK_REQUEST', attachment: 'PENDING_DECISION' });
        expect(await execution(tx, 'R_LEAD_DURING_DOSSIER', e.id)).toBeNull();
        expect(await alertsOf(tx, admin)).toHaveLength(0);
      });
    });
  });

  // ---------- AUT-040 ----------

  describe('AUT-040 — rules of the requests', () => {
    it('R_PARTNER_APPLICATION_SUBMITTED — task for the team, alert to OWNERS and ADMINS, not repeated while the task is open', async () => {
      await inRollback(async (tx, w) => {
        const owner = await staffUser(tx, 'OWNER');
        const admin = await staffUser(tx, 'ADMIN');
        const agent = await staffUser(tx, 'AGENT');
        const l = await lead(tx, { kind: 'PARTNER_REQUEST' });
        const e = await emit(tx, w, 'lead.application_submitted', 'Lead', l.id, { partnerKind: 'PROMOTER', companyName: 'Résidences du Lac' });
        expect((await execution(tx, 'R_PARTNER_APPLICATION_SUBMITTED', e.id))!.status).toBe('DONE');
        const task = await tx.task.findFirstOrThrow({ where: { dedupeKey: `partner-app:${l.id}` } });
        expect(task).toMatchObject({ title: 'Examiner la candidature de Résidences du Lac', assigneeId: null, origin: 'WORKFLOW', status: 'OPEN', type: 'FOLLOW_UP', priority: 'NORMAL', leadId: l.id, dueHasTime: false });
        expect(task.ruleId).not.toBeNull();
        // `partner.applicationReviewDays` business days (5): Monday → the next Monday, end of the working day.
        expect(task.dueAt!.toISOString().slice(0, 10)).toBe('2026-10-19');
        for (const who of [owner, admin]) {
          const [alert] = await alertsOf(tx, who);
          expect(alert!.title).toBe('Candidature partenaire de Résidences du Lac à examiner.');
          expect(alert!.link).toBe(`/taches?tache=${task.id}`); // the alert opens the task (NOT-035)
          expect(await alertsOf(tx, who, 'NS_TASK_AUTO')).toHaveLength(0);
        }
        expect(await alertsOf(tx, agent)).toHaveLength(0);

        // A complement sent while the task is open: neither a second task nor a second alert (AUT-033).
        await emit(tx, w, 'lead.application_submitted', 'Lead', l.id, { partnerKind: 'PROMOTER', companyName: 'Résidences du Lac', addition: true });
        expect(await tx.task.count({ where: { dedupeKey: `partner-app:${l.id}` } })).toBe(1);
        expect(await alertsOf(tx, admin)).toHaveLength(1);

        // AUT-035 — closed when the application is decided.
        await emit(tx, w, 'lead.application_approved', 'Lead', l.id, { partnerKind: 'PROMOTER', companyName: 'Résidences du Lac' });
        expect(await tx.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ status: 'DONE', completedById: null, completionNote: 'Candidature acceptée ou refusée' });
      });
    });

    it('R_LEAD_DURING_DOSSIER — the referent and the advisor of the ongoing dossier', async () => {
      await inRollback(async (tx, w) => {
        const referent = await staffUser(tx, 'AGENT');
        const advisor = await staffUser(tx, 'AGENT');
        const c = await client(tx, { assignedAgentId: referent });
        const d = await dossier(tx, c.id, { assignedAgentId: advisor });
        const l = await lead(tx, { clientId: c.id });
        const e = await emit(tx, w, 'lead.created', 'Lead', l.id, { kind: 'CALLBACK_REQUEST', attachment: 'PENDING_DECISION', ongoingDossierId: d.id });
        expect((await execution(tx, 'R_LEAD_DURING_DOSSIER', e.id))!.status).toBe('DONE');
        for (const who of [referent, advisor]) expect((await alertsOf(tx, who)).map((n) => n.title)).toEqual(['Nouvelle demande de Karima Benali pendant un dossier en cours.']);

        // Another request without ongoing dossier: the condition on the data of the event is false.
        const other = await emit(tx, w, 'lead.created', 'Lead', (await lead(tx, { clientId: c.id })).id, { kind: 'CALLBACK_REQUEST', attachment: 'OPENED_DOSSIER' });
        expect(await execution(tx, 'R_LEAD_DURING_DOSSIER', other.id)).toBeNull();
      });
    });

    it('NOT-035 — a notification of the catalogue for the same event replaces the alert of the rule', async () => {
      await inRollback(async (tx, w) => {
        const referent = await staffUser(tx, 'AGENT');
        const advisor = await staffUser(tx, 'AGENT');
        const c = await client(tx, { assignedAgentId: referent });
        const d = await dossier(tx, c.id, { assignedAgentId: advisor });
        const l = await lead(tx, { clientId: c.id });
        const payload = { kind: 'CALLBACK_REQUEST', attachment: 'PENDING_DECISION', ongoingDossierId: d.id };
        const id = await new OutboxWriter(clock).add(tx, { type: 'lead.created', aggregateType: 'Lead', aggregateId: l.id, payload });
        // Step 2 of AUT-003: the referent receives NS_LEAD_NEW for this event.
        await w.notifier.notify(w.db, clock.now(), { type: 'NS_LEAD_NEW', userIds: [referent], title: 'Nouvelle demande : Demande de rappel – Karima Benali.', link: `/demandes/${l.reference}`, entityType: 'Lead', entityId: l.id, originId: id });
        await w.engine.handle({ id, type: 'lead.created', aggregateType: 'Lead', aggregateId: l.id, payload, occurredAt: clock.now(), attempts: 0 });
        expect(await alertsOf(tx, referent)).toHaveLength(0); // he already knows
        expect(await alertsOf(tx, advisor)).toHaveLength(1); // the alert keeps its use for another recipient
      });
    });

    it('R_LEAD_SLA_WARNING and `sla.scan` — one business day left, signalled once', async () => {
      await inRollback(async (tx, w) => {
        const agent = await staffUser(tx, 'AGENT');
        const c = await client(tx);
        const mine = await lead(tx, { clientId: c.id, assignedAgentId: agent, status: 'IN_PROGRESS', slaDueAt: new Date('2026-10-12T15:00:00Z') });
        const unassigned = await lead(tx, { clientId: c.id, slaDueAt: new Date('2026-10-12T15:30:00Z') });
        const far = await lead(tx, { clientId: c.id, slaDueAt: new Date('2026-10-15T15:00:00Z') });
        const scope = { leadIds: [mine.id, unassigned.id, far.id] };
        const counters = await w.jobs.slaScan({ now: clock.now(), jobRunId: newId() }, scope);
        expect(counters).toMatchObject({ warned: 2, breached: 0 });
        const facts = await tx.outboxEvent.findMany({ where: { type: 'lead.sla_warning', aggregateId: { in: [mine.id, unassigned.id, far.id] } } });
        expect(facts.map((f) => f.aggregateId).sort()).toEqual([mine.id, unassigned.id].sort());
        expect(facts.find((f) => f.aggregateId === mine.id)!.dedupeKey).toBe(`lead.sla_warning:${mine.id}`);
        // A second pass signals nothing twice (AUT-012).
        expect((await w.jobs.slaScan({ now: clock.now(), jobRunId: newId() }, scope)).warned).toBe(0);
        expect(await tx.outboxEvent.count({ where: { type: 'lead.sla_warning', aggregateId: mine.id } })).toBe(1);

        for (const f of facts) await w.engine.handle({ id: f.id, type: f.type, aggregateType: f.aggregateType, aggregateId: f.aggregateId, payload: f.payload as Record<string, unknown>, occurredAt: f.occurredAt, attempts: 0 });
        // The advisor of the request; without one, every advisor (« à défaut ALL_AGENTS »).
        expect((await alertsOf(tx, agent)).map((n) => n.title).sort()).toEqual(['Plus qu’un jour ouvré pour contacter Karima Benali.', 'Plus qu’un jour ouvré pour contacter Karima Benali.']);
        expect((await alertsOf(tx, agent)).map((n) => n.entityId).sort()).toEqual([mine.id, unassigned.id].sort());
      });
    });

    it('R_LEAD_SLA_BREACHED — `slaBreachedAt`, urgent task, one notification, e-mails; nothing twice', async () => {
      await inRollback(async (tx, w) => {
        const admin = await staffUser(tx, 'ADMIN');
        const agent = await staffUser(tx, 'AGENT');
        const c = await client(tx);
        const l = await lead(tx, { clientId: c.id, assignedAgentId: agent, status: 'IN_PROGRESS', slaDueAt: new Date('2026-10-12T07:00:00Z') });
        const contacted = await lead(tx, { clientId: c.id, status: 'IN_PROGRESS', slaDueAt: new Date('2026-10-12T07:00:00Z'), firstContactAt: new Date('2026-10-12T06:00:00Z') });
        expect(await w.jobs.slaScan({ now: clock.now(), jobRunId: newId() }, { leadIds: [l.id, contacted.id] })).toMatchObject({ breached: 1 });
        expect((await tx.lead.findUniqueOrThrow({ where: { id: l.id } })).slaBreachedAt).toEqual(T0); // CYC-007
        expect((await tx.lead.findUniqueOrThrow({ where: { id: contacted.id } })).slaBreachedAt).toBeNull();
        const fact = await tx.outboxEvent.findFirstOrThrow({ where: { type: 'lead.sla_breached', aggregateId: l.id } });
        expect(fact.dedupeKey).toBe(`lead.sla_breached:${l.id}`);
        const record: OutboxRecord = { id: fact.id, type: fact.type, aggregateType: fact.aggregateType, aggregateId: fact.aggregateId, payload: fact.payload as Record<string, unknown>, occurredAt: fact.occurredAt, attempts: 0 };
        await w.engine.handle(record);

        expect((await execution(tx, 'R_LEAD_SLA_BREACHED', fact.id))!).toMatchObject({ status: 'DONE', actionsDone: 4 });
        const task = await tx.task.findFirstOrThrow({ where: { dedupeKey: `lead-contact:${l.id}` } });
        expect(task).toMatchObject({ title: 'Contacter Karima Benali : délai de premier contact dépassé', type: 'CALL', priority: 'URGENT', assigneeId: agent, dueHasTime: true, clientId: c.id, leadId: l.id });
        expect(task.dueAt).toEqual(T0); // due at once
        // One notification each: the rule's, which takes the title of the task and opens it; no NS_TASK_AUTO (NOT-035).
        for (const who of [agent, admin]) {
          expect((await alertsOf(tx, who)).map((n) => [n.title, n.link])).toEqual([[task.title, `/taches?tache=${task.id}`]]);
          expect(await alertsOf(tx, who, 'NS_TASK_AUTO')).toHaveLength(0);
        }
        const staffMail = mails(w, 'S_LEAD_SLA_BREACHED');
        const adminEmail = (await tx.user.findUniqueOrThrow({ where: { id: admin } })).email;
        const toAdmin = staffMail.find((m) => m.to === adminEmail)!;
        expect(toAdmin.subject).toBe('Délai dépassé : Karima Benali attend un premier contact');
        expect(toAdmin.text).toContain(`La demande ${l.reference}`);
        expect(toAdmin.text).toMatch(/Conseiller\s: Amel Kaci\./);
        expect(toAdmin.text).toContain(`https://admin.test/demandes/${l.reference}`);
        const apology = mails(w, 'C_LEAD_DELAYED');
        expect(apology.map((m) => m.to)).toEqual([c.email]);
        expect(apology[0]!.subject).toBe(`Votre demande ${l.reference} n’est pas oubliée`);
        const row = await tx.communication.findUniqueOrThrow({ where: { dedupeKey: `C_LEAD_DELAYED:${l.id}` } });
        expect(row).toMatchObject({ deliveryState: 'SENT', triggeredBy: 'WORKFLOW', clientId: c.id, leadId: l.id });
        expect(row.ruleId).not.toBeNull(); // AUT-009: the rule is named on what it did

        // The same fact replayed, then another event for the same request: once per request.
        await w.engine.handle(record);
        const again = await emit(tx, w, 'lead.sla_breached', 'Lead', l.id, { slaDueAt: '2026-10-12T07:00:00.000Z' });
        expect((await execution(tx, 'R_LEAD_SLA_BREACHED', again.id))!.status).toBe('DONE');
        expect(mails(w, 'C_LEAD_DELAYED')).toHaveLength(1);
        expect(await tx.task.count({ where: { dedupeKey: `lead-contact:${l.id}` } })).toBe(1);
        expect(await alertsOf(tx, agent)).toHaveLength(1); // the alert is not repeated while the task is open

        // AUT-035 — the task closes by itself at the first contact.
        await emit(tx, w, 'lead.first_contact', 'Lead', l.id, { channel: 'PHONE' });
        expect((await tx.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('DONE');
      });
    });

    it('AUT-032 — an advisor who cannot act: the task is unassigned and the administrators are told', async () => {
      await inRollback(async (tx, w) => {
        const admin = await staffUser(tx, 'ADMIN');
        const gone = await staffUser(tx, 'AGENT');
        await tx.user.update({ where: { id: gone }, data: { status: 'SUSPENDED' } });
        const c = await client(tx, { email: null });
        const l = await lead(tx, { clientId: c.id, assignedAgentId: gone, status: 'IN_PROGRESS' });
        const e = await emit(tx, w, 'lead.sla_breached', 'Lead', l.id, { slaDueAt: '2026-10-12T07:00:00.000Z' });
        const task = await tx.task.findFirstOrThrow({ where: { dedupeKey: `lead-contact:${l.id}` } });
        expect(task.assigneeId).toBeNull();
        expect(await alertsOf(tx, admin)).toHaveLength(1); // the rule's alert reaches the ADMINS in his place
        expect(await alertsOf(tx, gone)).toHaveLength(0); // a suspended account receives nothing
        // AUT-007 — a client without address: no e-mail, a SUPPRESSED row keeps the trace; the task stands for it.
        expect(mails(w, 'C_LEAD_DELAYED')).toHaveLength(0);
        expect(await tx.communication.findUniqueOrThrow({ where: { dedupeKey: `C_LEAD_DELAYED:${l.id}` } })).toMatchObject({ deliveryState: 'SUPPRESSED', failureReason: 'NO_ADDRESS' });
        expect((await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!).toMatchObject({ status: 'DONE', skipReason: 'Pas d’adresse' });
      });
    });

    it('AUT-007 — commercial follow-up stops for a person whose processing is limited, and for a spam request', async () => {
      await inRollback(async (tx, w) => {
        const restricted = await client(tx, { restrictedAt: T0, restrictionReason: 'REQUEST' });
        const l = await lead(tx, { clientId: restricted.id, status: 'IN_PROGRESS' });
        const e = await emit(tx, w, 'lead.sla_breached', 'Lead', l.id, {});
        expect((await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!).toMatchObject({ status: 'SKIPPED', skipReason: 'Traitement limité', actionsDone: 0 });
        expect(await tx.task.count({ where: { leadId: l.id } })).toBe(0);

        const spam = await lead(tx, { kind: 'PARTNER_REQUEST', status: 'SPAM' });
        const s = await emit(tx, w, 'lead.application_submitted', 'Lead', spam.id, { companyName: 'X' });
        expect((await execution(tx, 'R_PARTNER_APPLICATION_SUBMITTED', s.id))!).toMatchObject({ status: 'SKIPPED', skipReason: 'Demande indésirable' });
      });
    });
  });

  // ---------- AUT-004 point 4, AUT-006 ----------

  describe('new tries and quiet hours', () => {
    async function breach(tx: Tx): Promise<{ leadId: string; email: string }> {
      await staffUser(tx, 'ADMIN');
      const c = await client(tx);
      const l = await lead(tx, { clientId: c.id, status: 'IN_PROGRESS' });
      return { leadId: l.id, email: c.email };
    }

    it('AUT-004 — a failed action is replayed after 1 minute; the actions already done are not done again', async () => {
      await inRollback(async (tx, w) => {
        const { leadId } = await breach(tx);
        w.provider.failNext = 'transient'; // the provider is down for the first e-mail
        const e = await emit(tx, w, 'lead.sla_breached', 'Lead', leadId, {});
        const waiting = (await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!;
        expect(waiting).toMatchObject({ status: 'PENDING', attempts: 1, actionsDone: 2 }); // task and alert done, the e-mail failed
        expect(waiting.nextAttemptAt!.getTime()).toBe(T0.getTime() + MINUTE);
        expect(waiting.error).toBe('provider unavailable');

        await runDue(tx, w);
        expect((await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!).toMatchObject({ status: 'PENDING', attempts: 1 }); // not before its date
        clock.set(new Date(T0.getTime() + MINUTE));
        await runDue(tx, w);
        expect((await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!).toMatchObject({ status: 'DONE', attempts: 1, actionsDone: 4, nextAttemptAt: null });
        expect(await tx.task.count({ where: { dedupeKey: `lead-contact:${leadId}` } })).toBe(1);
        expect(mails(w, 'C_LEAD_DELAYED')).toHaveLength(1);
      });
    });

    it('AUT-004 — after the third replay the execution is FAILED, its error recorded', async () => {
      await inRollback(async (tx, w) => {
        const { leadId } = await breach(tx);
        w.provider.failNext = 'transient';
        const e = await emit(tx, w, 'lead.sla_breached', 'Lead', leadId, {});
        for (const wait of [MINUTE, 10 * MINUTE, 60 * MINUTE]) {
          expect((await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!.status).toBe('PENDING');
          clock.set(new Date(clock.now().getTime() + wait));
          w.provider.failNext = 'transient';
          await runDue(tx, w);
        }
        expect((await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!).toMatchObject({ status: 'FAILED', attempts: 4, actionsDone: 2, nextAttemptAt: null, error: 'provider unavailable' });
        clock.set(new Date(clock.now().getTime() + 24 * HOUR));
        await runDue(tx, w);
        expect((await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!).toMatchObject({ status: 'FAILED', attempts: 4 }); // not taken again
      });
    });

    it('AUT-006 — outside 8:00–20:00 in the recipient’s time zone, the reminder waits for 8:00; staff effects do not wait', async () => {
      await inRollback(async (tx, w) => {
        const { leadId } = await breach(tx);
        clock.set(new Date('2026-10-12T21:00:00Z')); // 23:00 in Paris
        const e = await emit(tx, w, 'lead.sla_breached', 'Lead', leadId, {});
        const waiting = (await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!;
        expect(waiting).toMatchObject({ status: 'PENDING', attempts: 0, actionsDone: 3 }); // waiting is not a failed try
        expect(waiting.nextAttemptAt!.toISOString()).toBe('2026-10-13T06:00:00.000Z');
        expect(await tx.task.count({ where: { dedupeKey: `lead-contact:${leadId}` } })).toBe(1);
        expect(mails(w, 'S_LEAD_SLA_BREACHED').length).toBeGreaterThan(0);
        expect(mails(w, 'C_LEAD_DELAYED')).toHaveLength(0);

        clock.set(new Date('2026-10-13T06:00:10Z'));
        await runDue(tx, w);
        expect((await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!.status).toBe('DONE');
        expect(mails(w, 'C_LEAD_DELAYED')).toHaveLength(1);
      });
    });

    it('AUT-007 — the stop conditions are checked again when the e-mail leaves', async () => {
      await inRollback(async (tx, w) => {
        const { leadId } = await breach(tx);
        clock.set(new Date('2026-10-12T21:00:00Z'));
        const e = await emit(tx, w, 'lead.sla_breached', 'Lead', leadId, {});
        const l = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
        await tx.client.update({ where: { id: l.clientId! }, data: { emailBouncedAt: clock.now() } }); // the address was rejected during the night
        clock.set(new Date('2026-10-13T06:00:10Z'));
        await runDue(tx, w);
        expect(mails(w, 'C_LEAD_DELAYED')).toHaveLength(0);
        expect(await tx.communication.findUniqueOrThrow({ where: { dedupeKey: `C_LEAD_DELAYED:${leadId}` } })).toMatchObject({ deliveryState: 'SUPPRESSED', failureReason: 'ADDRESS_BOUNCED' });
        expect((await execution(tx, 'R_LEAD_SLA_BREACHED', e.id))!).toMatchObject({ status: 'DONE', skipReason: 'Adresse en erreur' });
      });
    });
  });

  // ---------- AUT-041, AUT-042, AUT-043 ----------

  describe('rules of the dossier', () => {
    it('R_CONSENT_WITHDRAWN — task and alert for the advisor; the task closes when the agreement is given again', async () => {
      await inRollback(async (tx, w) => {
        const agent = await staffUser(tx, 'AGENT');
        const c = await client(tx);
        const d = await dossier(tx, c.id, { assignedAgentId: agent });
        const e = await emit(tx, w, 'consent.changed', 'Client', c.id, { type: 'DATA_SHARING_PARTNERS', granted: false, by: 'CLIENT', dossierId: d.id });
        expect((await execution(tx, 'R_CONSENT_WITHDRAWN', e.id))!.status).toBe('DONE');
        const task = await tx.task.findFirstOrThrow({ where: { dedupeKey: `consent:${d.id}` } });
        expect(task).toMatchObject({ title: 'Karima Benali a retiré son accord de transmission', priority: 'HIGH', assigneeId: agent, dossierId: d.id, clientId: c.id, dueHasTime: false });
        expect(task.dueAt!.toISOString().slice(0, 10)).toBe('2026-10-13'); // one business day
        expect((await alertsOf(tx, agent)).map((n) => n.title)).toEqual([task.title]);
        expect(await alertsOf(tx, agent, 'NS_TASK_AUTO')).toHaveLength(0);

        // The other consent, or the agreement given: the rule does not apply.
        const marketing = await emit(tx, w, 'consent.changed', 'Client', c.id, { type: 'MARKETING_EMAIL', granted: false, by: 'CLIENT', dossierId: null });
        expect(await execution(tx, 'R_CONSENT_WITHDRAWN', marketing.id)).toBeNull();
        const given = await emit(tx, w, 'consent.changed', 'Client', c.id, { type: 'DATA_SHARING_PARTNERS', granted: true, by: 'CLIENT', dossierId: d.id });
        expect(await execution(tx, 'R_CONSENT_WITHDRAWN', given.id)).toBeNull();
        expect(await tx.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ status: 'DONE', completionNote: 'Accord de transmission donné' }); // AUT-035
      });
    });

    it('R_CONSENT_WITHDRAWN — a closed dossier: nothing', async () => {
      await inRollback(async (tx, w) => {
        const c = await client(tx);
        const d = await dossier(tx, c.id, { status: 'LOST' });
        const e = await emit(tx, w, 'consent.changed', 'Client', c.id, { type: 'DATA_SHARING_PARTNERS', granted: false, by: 'CLIENT', dossierId: d.id });
        expect(await execution(tx, 'R_CONSENT_WITHDRAWN', e.id)).toBeNull();
      });
    });

    it('R_DOC_REVIEW — one review task per dossier, closed when no piece is left to check', async () => {
      await inRollback(async (tx, w) => {
        const agent = await staffUser(tx, 'AGENT');
        const c = await client(tx);
        const d = await dossier(tx, c.id, { assignedAgentId: agent });
        const piece = async (status: string, providedBy = 'CLIENT') => {
          const id = newId();
          await tx.dossierDocument.create({ data: { id, dossierId: d.id, label: 'Passeport', category: 'IDENTITY', isRequired: true, providedBy, source: 'CHECKLIST', maxFiles: 1, status, statusChangedAt: clock.now(), ...stamps() } as never });
          return id;
        };
        const a = await piece('RECEIVED');
        const b = await piece('RECEIVED');
        await emit(tx, w, 'document.received', 'Dossier', d.id, { documentId: a, by: 'CLIENT' });
        await emit(tx, w, 'document.received', 'Dossier', d.id, { documentId: b, by: 'CLIENT' });
        const tasks = await tx.task.findMany({ where: { dedupeKey: `doc-review:${d.id}` } });
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!).toMatchObject({ title: 'Vérifier les pièces de Karima Benali', type: 'DOC_REVIEW', assigneeId: agent, priority: 'NORMAL' });
        expect(await alertsOf(tx, agent, 'NS_TASK_AUTO')).toHaveLength(0); // a NORMAL task: the morning digest, no notification

        await tx.dossierDocument.update({ where: { id: a }, data: { status: 'VALIDATED' } });
        await emit(tx, w, 'document.validated', 'Dossier', d.id, { documentId: a });
        expect((await tx.task.findUniqueOrThrow({ where: { id: tasks[0]!.id } })).status).toBe('OPEN'); // one piece still to check
        await tx.dossierDocument.update({ where: { id: b }, data: { status: 'REJECTED' } });
        const rejected = await emit(tx, w, 'document.rejected', 'Dossier', d.id, { documentId: b, reason: 'ILLEGIBLE' });
        expect(await tx.task.findUniqueOrThrow({ where: { id: tasks[0]!.id } })).toMatchObject({ status: 'DONE', completionNote: 'Plus aucune pièce à vérifier' });
        // A piece provided by the client: R_DOC_OPERATOR_REJECTED does not apply (the client is asked, not the team).
        expect(await execution(tx, 'R_DOC_OPERATOR_REJECTED', rejected.id)).toBeNull();
      });
    });

    it('R_DOC_OPERATOR_REJECTED — a piece of the team to redo; closed when it is back', async () => {
      await inRollback(async (tx, w) => {
        const agent = await staffUser(tx, 'AGENT');
        const c = await client(tx);
        const d = await dossier(tx, c.id, { assignedAgentId: agent });
        const id = newId();
        await tx.dossierDocument.create({ data: { id, dossierId: d.id, label: 'Attestation de réservation', category: 'PROPERTY', isRequired: true, providedBy: 'OPERATOR', source: 'CHECKLIST', maxFiles: 1, status: 'REJECTED', statusChangedAt: clock.now(), ...stamps() } as never });
        const e = await emit(tx, w, 'document.rejected', 'Dossier', d.id, { documentId: id, reason: 'ILLEGIBLE' });
        expect((await execution(tx, 'R_DOC_OPERATOR_REJECTED', e.id))!.status).toBe('DONE');
        const task = await tx.task.findFirstOrThrow({ where: { dedupeKey: `doc-redo:${id}` } });
        expect(task).toMatchObject({ title: `Pièce à refaire : Attestation de réservation (dossier ${d.reference})`, assigneeId: agent });
        await tx.dossierDocument.update({ where: { id }, data: { status: 'RECEIVED' } });
        await emit(tx, w, 'document.received', 'Dossier', d.id, { documentId: id, by: 'STAFF' });
        expect(await tx.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ status: 'DONE', completionNote: 'Pièce de nouveau reçue ou validée' });
      });
    });

    it('R_CLIENT_RESURFACED — a new request on a dossier in pause; NS_TASK_AUTO for a HIGH task nobody else announces', async () => {
      await inRollback(async (tx, w) => {
        const agent = await staffUser(tx, 'AGENT');
        const c = await client(tx);
        const paused = await dossier(tx, c.id, { status: 'ON_HOLD', assignedAgentId: agent });
        const l = await lead(tx, { clientId: c.id, dossierId: paused.id });
        const e = await emit(tx, w, 'lead.attached', 'Lead', l.id, { dossierId: paused.id });
        expect((await execution(tx, 'R_CLIENT_RESURFACED', e.id))!.status).toBe('DONE');
        const task = await tx.task.findFirstOrThrow({ where: { dedupeKey: `resurfaced:${paused.id}` } });
        expect(task).toMatchObject({ title: `Le client s’est manifesté : reprendre le dossier ${paused.reference} ?`, priority: 'HIGH', assigneeId: agent });
        const auto = await alertsOf(tx, agent, 'NS_TASK_AUTO');
        expect(auto.map((n) => [n.title, n.link, n.entityType])).toEqual([[`Nouvelle tâche : ${task.title}.`, `/taches?tache=${task.id}`, 'Task']]);

        const open = await dossier(tx, c.id, { assignedAgentId: agent });
        const other = await emit(tx, w, 'lead.attached', 'Lead', (await lead(tx, { clientId: c.id, dossierId: open.id })).id, { dossierId: open.id });
        expect(await execution(tx, 'R_CLIENT_RESURFACED', other.id)).toBeNull();
      });
    });
  });

  // ---------- AUT-045 ----------

  describe('AUT-045 — R_VERIFICATION_REMINDER', () => {
    async function account(tx: Tx, verified: boolean): Promise<{ userId: string; clientId: string; email: string }> {
      const userId = newId();
      const email = `signup-${userId}@example.test`;
      await tx.user.create({ data: { id: userId, kind: 'CLIENT', email, status: 'ACTIVE', emailVerifiedAt: verified ? clock.now() : null, ...stamps() } });
      const c = await client(tx, { userId, email });
      return { userId, clientId: c.id, email };
    }
    function identity(w: World): IdentityJobs {
      const auth = new AuthMailHandler(w.db, w.mailer, new TokensService(w.db, clock, env), settings, w.handlers, env);
      const jobs = new IdentityJobs(w.db, clock, auth, w.scheduler, w.composers);
      jobs.onModuleInit();
      return jobs;
    }

    it('24 hours after the sign-up, the address still unverified: the verification e-mail again, once, with a new link', async () => {
      await inRollback(async (tx, w) => {
        identity(w);
        const a = await account(tx, false);
        const e = await emit(tx, w, 'client.account_created', 'Client', a.clientId, {});
        expect((await execution(tx, 'R_VERIFICATION_REMINDER', e.id))!.scheduledFor.getTime()).toBe(T0.getTime() + 24 * HOUR);
        clock.set(new Date(T0.getTime() + 24 * HOUR + MINUTE));
        await runDue(tx, w);
        expect((await execution(tx, 'R_VERIFICATION_REMINDER', e.id))!.status).toBe('DONE');
        const sent = mails(w, 'C_EMAIL_VERIFICATION');
        expect(sent.map((m) => m.to)).toEqual([a.email]);
        expect(sent[0]!.text).toMatch(/https:\/\/site\.test\/\S+/); // a link, minted when the e-mail leaves
        // The key of the stand-in that ran before the engine (AUT-084): nothing is sent twice.
        const row = await tx.communication.findUniqueOrThrow({ where: { dedupeKey: `C_EMAIL_VERIFICATION:R_VERIFICATION_REMINDER:${a.userId}` } });
        expect(row).toMatchObject({ deliveryState: 'SENT', triggeredBy: 'WORKFLOW' });
        expect(row.body ?? '').not.toMatch(/https:\/\/site\.test\/verification\/[A-Za-z0-9_-]{20,}/); // NOT-002: the token is not stored
        expect(await tx.authToken.count({ where: { userId: a.userId, purpose: 'EMAIL_VERIFICATION' } })).toBe(1);
        // An account e-mail creates no NC_REMINDER (NOT-030).
        expect(await tx.notification.count({ where: { userId: a.userId, type: 'NC_REMINDER' } })).toBe(0);
      });
    });

    it('verified meanwhile: SKIPPED; verified at once: nothing recorded', async () => {
      await inRollback(async (tx, w) => {
        identity(w);
        const a = await account(tx, false);
        const e = await emit(tx, w, 'client.account_created', 'Client', a.clientId, {});
        await tx.user.update({ where: { id: a.userId }, data: { emailVerifiedAt: clock.now() } });
        clock.set(new Date(T0.getTime() + 24 * HOUR + MINUTE));
        await runDue(tx, w);
        expect((await execution(tx, 'R_VERIFICATION_REMINDER', e.id))!.status).toBe('SKIPPED');
        expect(mails(w, 'C_EMAIL_VERIFICATION')).toHaveLength(0);

        const b = await account(tx, true);
        const e2 = await emit(tx, w, 'client.account_created', 'Client', b.clientId, {});
        expect(await execution(tx, 'R_VERIFICATION_REMINDER', e2.id)).toBeNull();
      });
    });
  });

  // ---------- AUT-056 ----------

  describe('AUT-056 — rules of the Café', () => {
    function cafeWorld(w: World): EventScan {
      const scan = new EventScan(w.db, settings, w.calendar, w.scheduler, w.composers, new RegistrationDocuments(env, settings, clock), new EventsPublicService(w.db, clock, settings), env);
      scan.onModuleInit();
      return scan;
    }

    it('R_CAFE_OPENING — each « Me prévenir » request is served once', async () => {
      await inRollback(async (tx, w) => {
        cafeWorld(w);
        const id = await cafe(tx);
        const request = async (data: Record<string, unknown>) => {
          const rid = newId();
          const email = `notify-${rid}@example.test`;
          await tx.eventNotifyRequest.create({ data: { id: rid, email, unsubscribeTokenHash: rid.replace(/-/g, '').padEnd(64, '0'), ...stamps(), ...data } as never });
          return { rid, email };
        };
        const forThis = await request({ eventId: id });
        const forPlace = await request({ locationLabel: 'Lyon' });
        const elsewhere = await request({ locationLabel: 'Marseille' });
        const e = await emit(tx, w, 'event.registration_opened', 'Event', id, {});
        expect((await execution(tx, 'R_CAFE_OPENING', e.id))!.status).toBe('DONE');
        const sent = mails(w, 'C_CAFE_OPENING');
        expect(sent.map((m) => m.to)).toEqual(expect.arrayContaining([forThis.email, forPlace.email]));
        expect(sent.map((m) => m.to)).not.toContain(elsewhere.email);
        expect(sent.find((m) => m.to === forThis.email)!.subject).toMatch(/^Les inscriptions sont ouvertes : Café à Lyon le /);
        expect((await tx.eventNotifyRequest.findUniqueOrThrow({ where: { id: forThis.rid } })).notifiedAt).toEqual(T0);
        expect((await tx.eventNotifyRequest.findUniqueOrThrow({ where: { id: elsewhere.rid } })).notifiedAt).toBeNull();
        // Opened again later (closed then reopened): nobody is written to twice (CAF-041).
        await emit(tx, w, 'event.registration_opened', 'Event', id, {});
        expect(mails(w, 'C_CAFE_OPENING').filter((m) => m.to === forThis.email)).toHaveLength(1);
      });
    });

    it('R_CAFE_REMINDER_7D, R_CAFE_LOW_FILL — registrants of more than 48 hours; a half-empty Café is signalled', async () => {
      await inRollback(async (tx, w) => {
        cafeWorld(w);
        const host = await staffUser(tx, 'AGENT');
        const admin = await staffUser(tx, 'ADMIN');
        const id = await cafe(tx, { hostUserId: host, seatsTaken: 4 });
        const early = await registration(tx, id, new Date(T0.getTime() - 72 * HOUR));
        const recent = await registration(tx, id, new Date(T0.getTime() - HOUR));
        const waiting = await registration(tx, id, new Date(T0.getTime() - 72 * HOUR), 'WAITLISTED');
        const e = await emit(tx, w, 'event.upcoming', 'Event', id, { days: 7 });
        expect((await execution(tx, 'R_CAFE_REMINDER_7D', e.id))!.status).toBe('DONE');
        expect(await execution(tx, 'R_CAFE_REMINDER_1D', e.id)).toBeNull();
        const sent = mails(w, 'C_CAFE_REMINDER_7D');
        expect(sent.map((m) => m.to)).toEqual([early.email]);
        expect(sent[0]!.subject).toBe('Dans une semaine : Le Café à Lyon');
        expect(sent[0]!.text).toContain('/le-cafe/inscription/'); // « Gérer mon inscription »
        expect((await tx.eventRegistration.findUniqueOrThrow({ where: { id: early.id } })).reminder7SentAt).toEqual(T0); // markField
        expect((await tx.eventRegistration.findUniqueOrThrow({ where: { id: recent.id } })).reminder7SentAt).toBeNull();
        expect((await tx.eventRegistration.findUniqueOrThrow({ where: { id: waiting.id } })).reminder7SentAt).toBeNull();
        expect(await tx.communication.findFirstOrThrow({ where: { registrationId: early.id, templateCode: 'C_CAFE_REMINDER_7D' } })).toMatchObject({ deliveryState: 'SENT', eventId: id, clientId: early.clientId });

        expect((await execution(tx, 'R_CAFE_LOW_FILL', e.id))!.status).toBe('DONE'); // 4 seats out of 40
        for (const who of [host, admin]) expect((await alertsOf(tx, who))[0]!.title).toMatch(/^Le Café Lyon du 19 octobre 2026 compte 4 inscrits pour 40 places\.$/);
      });
    });

    it('R_CAFE_LOW_FILL — a Café half full or more: nothing', async () => {
      await inRollback(async (tx, w) => {
        cafeWorld(w);
        const id = await cafe(tx, { seatsTaken: 20 });
        const e = await emit(tx, w, 'event.upcoming', 'Event', id, { days: 7 });
        expect(await execution(tx, 'R_CAFE_LOW_FILL', e.id)).toBeNull();
      });
    });

    it('R_CAFE_REMINDER_1D — every registrant, with the place and the access code; a group cut by the person is respected', async () => {
      await inRollback(async (tx, w) => {
        cafeWorld(w);
        const id = await cafe(tx, { startsAt: new Date(T0.getTime() + 28 * HOUR), endsAt: new Date(T0.getTime() + 31 * HOUR) });
        const a = await registration(tx, id, new Date(T0.getTime() - 72 * HOUR));
        const b = await registration(tx, id, new Date(T0.getTime() - HOUR));
        const off = await registration(tx, id, new Date(T0.getTime() - HOUR));
        await tx.notificationPreference.create({ data: { id: newId(), clientId: off.clientId, group: 'CAFE', emailEnabled: false, pushEnabled: false, ...stamps() } });
        const e = await emit(tx, w, 'event.upcoming', 'Event', id, { days: 1 });
        expect((await execution(tx, 'R_CAFE_REMINDER_1D', e.id))!.status).toBe('DONE');
        const sent = mails(w, 'C_CAFE_REMINDER_1D');
        expect(sent.map((m) => m.to).sort()).toEqual([a.email, b.email].sort());
        expect(sent[0]!.text).toContain('1 rue de la République, Lyon'); // TRV-045: the exact place, to who holds a seat
        expect(sent.find((m) => m.to === a.email)!.text).toContain((await tx.eventRegistration.findUniqueOrThrow({ where: { id: a.id } })).checkInCode);
        expect((await tx.eventRegistration.findUniqueOrThrow({ where: { id: b.id } })).reminder1SentAt).toEqual(T0);
        expect(await tx.communication.findFirstOrThrow({ where: { registrationId: off.id } })).toMatchObject({ deliveryState: 'SUPPRESSED', failureReason: 'PREFERENCE_DISABLED' }); // NOT-020
      });
    });

    it('AUT-082 — a reminder that would arrive after the start of the Café is not sent', async () => {
      await inRollback(async (tx, w) => {
        cafeWorld(w);
        const id = await cafe(tx, { startsAt: new Date(T0.getTime() - HOUR), endsAt: new Date(T0.getTime() + 2 * HOUR) });
        await registration(tx, id, new Date(T0.getTime() - 72 * HOUR));
        const e = await emit(tx, w, 'event.upcoming', 'Event', id, { days: 1 });
        expect(mails(w, 'C_CAFE_REMINDER_1D')).toHaveLength(0);
        expect((await execution(tx, 'R_CAFE_REMINDER_1D', e.id))!).toMatchObject({ status: 'SKIPPED', skipReason: 'Échéance passée' });
      });
    });

    it('`event.scan` — closes, ends, signals the dated facts once; NO_SHOW only when a check-in exists; R_CAFE_MISSED, R_CAFE_CALLBACK', async () => {
      await inRollback(async (tx, w) => {
        const scan = cafeWorld(w);
        const host = await staffUser(tx, 'AGENT');
        // Tomorrow's Café, registrations closed since this morning.
        const soon = await cafe(tx, { startsAt: new Date(T0.getTime() + 26 * HOUR), endsAt: new Date(T0.getTime() + 29 * HOUR), registrationClosesAt: new Date(T0.getTime() - HOUR) });
        // A Café of last week, still PUBLISHED, where one person was checked in and one was not.
        const held = await cafe(tx, { hostUserId: host, startsAt: new Date(T0.getTime() - 50 * HOUR), endsAt: new Date(T0.getTime() - 47 * HOUR), registrationClosesAt: new Date(T0.getTime() - 60 * HOUR), seatsTaken: 4, attendedSeats: 2 });
        await registration(tx, held, new Date(T0.getTime() - 200 * HOUR), 'ATTENDED');
        const absent = await registration(tx, held, new Date(T0.getTime() - 200 * HOUR));
        // A Café nobody checked in: presence unknown.
        const unknown = await cafe(tx, { startsAt: new Date(T0.getTime() - 50 * HOUR), endsAt: new Date(T0.getTime() - 47 * HOUR), registrationClosesAt: new Date(T0.getTime() - 60 * HOUR), seatsTaken: 2 });
        const maybe = await registration(tx, unknown, new Date(T0.getTime() - 200 * HOUR));

        const scope = { eventIds: [soon, held, unknown] };
        const first = await scan.scan({ now: clock.now(), jobRunId: newId() }, scope);
        expect(first).toMatchObject({ closed: 1, done: 2, noShow: 1, upcoming: 1, followUp: 2 });
        expect((await tx.event.findUniqueOrThrow({ where: { id: soon } })).status).toBe('CLOSED'); // CYC-180
        expect((await tx.event.findUniqueOrThrow({ where: { id: held } })).status).toBe('DONE');
        expect(await tx.auditLog.count({ where: { entityType: 'event', entityId: held, action: 'event.updated', actorType: 'SYSTEM' } })).toBe(1);
        expect((await tx.eventRegistration.findUniqueOrThrow({ where: { id: absent.id } })).status).toBe('NO_SHOW'); // CYC-185
        expect((await tx.eventRegistration.findUniqueOrThrow({ where: { id: maybe.id } })).status).toBe('REGISTERED');
        expect((await tx.event.findUniqueOrThrow({ where: { id: held } })).seatsTaken).toBe(2); // cache: REGISTERED + ATTENDED
        const types = async (id: string) => (await tx.outboxEvent.findMany({ where: { aggregateId: id }, select: { type: true } })).map((r) => r.type).sort();
        expect(await types(soon)).toEqual(['event.closed', 'event.upcoming']);
        expect(await types(held)).toEqual(['event.done', 'event.followup_due']);
        expect(await types(unknown)).toEqual(['event.done', 'event.followup_due']);
        const second = await scan.scan({ now: clock.now(), jobRunId: newId() }, scope);
        expect([second.closed, second.done, second.upcoming, second.followUp, second.noShow]).toEqual([0, 0, 0, 0, 0]); // replayable (AUT-012)
        expect(await types(held)).toEqual(['event.done', 'event.followup_due']);
        // Two business days after the end, still no check-in for the third Café.
        clock.set(new Date(T0.getTime() + 2 * 24 * HOUR));
        const later = await scan.scan({ now: clock.now(), jobRunId: newId() }, scope);
        expect(later.checkinMissing).toBe(1);
        expect(await types(unknown)).toEqual(['event.checkin_missing', 'event.done', 'event.followup_due']);
        expect(await types(held)).toEqual(['event.done', 'event.followup_due']); // checked in: nothing is missing
        clock.set(T0);

        const run = async (type: string, aggregateId: string) => {
          const f = await tx.outboxEvent.findFirstOrThrow({ where: { type, aggregateId } });
          const record: OutboxRecord = { id: f.id, type: f.type, aggregateType: f.aggregateType, aggregateId: f.aggregateId, payload: f.payload as Record<string, unknown>, occurredAt: f.occurredAt, attempts: 0 };
          await w.engine.handle(record);
          return record;
        };
        const noShow = await run('registration.no_show', absent.id);
        expect((await execution(tx, 'R_CAFE_MISSED', noShow.id))!.status).toBe('DONE');
        expect(mails(w, 'C_CAFE_MISSED').map((m) => [m.to, m.subject])).toEqual([[absent.email, 'Nous ne vous avons pas vu au Café']]);
        const followUp = await run('event.followup_due', held);
        expect((await execution(tx, 'R_CAFE_CALLBACK', followUp.id))!.status).toBe('DONE');
        expect(await tx.task.findFirstOrThrow({ where: { dedupeKey: `cafe-callback:${held}` } })).toMatchObject({ type: 'CALL', assigneeId: host, eventId: held });
        const nobody = await run('event.followup_due', unknown);
        expect(await execution(tx, 'R_CAFE_CALLBACK', nobody.id)).toBeNull(); // nobody attended
      });
    });
  });

  // ---------- CYC-220, TAC-004, AUT-035 ----------

  describe('tasks', () => {
    const person = (userId: string, role: string): Actor => ({ type: 'USER', userId, role, reason: null });

    it('a person entrusts a task: audit, `task.assigned`; the assignee completes it; reopened within 30 days', async () => {
      await inRollback(async (tx, w) => {
        const author = await staffUser(tx, 'AGENT');
        const colleague = await staffUser(tx, 'AGENT');
        const stranger = await staffUser(tx, 'AGENT');
        const admin = await staffUser(tx, 'ADMIN');
        const due = new Date('2026-10-14T16:00:00Z');
        const made = await w.tasks.create(w.db, person(author, 'AGENT'), clock.now(), { title: 'Rappeler le notaire', assigneeId: colleague, dueAt: due, dueHasTime: false, timeZone: 'Europe/Paris', origin: 'MANUAL' });
        expect(made.created).toBe(true);
        const task = await tx.task.findUniqueOrThrow({ where: { id: made.id } });
        expect(task).toMatchObject({ status: 'OPEN', origin: 'MANUAL', createdById: author, assigneeId: colleague, reminderKind: 'AT_DUE' });
        expect(task.remindAt!.toISOString()).toBe('2026-10-14T07:00:00.000Z'); // 9:00 in Paris
        expect(await tx.auditLog.count({ where: { entityType: 'task', entityId: made.id, action: 'task.created', actorId: author } })).toBe(1);
        expect(await tx.outboxEvent.count({ where: { type: 'task.assigned', aggregateId: made.id } })).toBe(1);

        // TAC-004 — a third person cannot; with `task.manage.all` one can.
        await expect(w.tasks.complete(w.db, person(stranger, 'AGENT'), clock.now(), made.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await w.tasks.assign(w.db, person(admin, 'ADMIN'), clock.now(), made.id, null); // back to the team
        expect(await tx.outboxEvent.count({ where: { type: 'task.assigned', aggregateId: made.id } })).toBe(1); // nobody to tell
        await w.tasks.assign(w.db, person(stranger, 'AGENT'), clock.now(), made.id, stranger); // anyone may take an unassigned task
        await w.tasks.complete(w.db, person(stranger, 'AGENT'), clock.now(), made.id, 'Rendez-vous pris jeudi.');
        expect(await tx.task.findUniqueOrThrow({ where: { id: made.id } })).toMatchObject({ status: 'DONE', completedById: stranger, completionNote: 'Rendez-vous pris jeudi.', version: 4 });
        await expect(w.tasks.cancel(w.db, person(stranger, 'AGENT'), clock.now(), made.id)).rejects.toMatchObject({ code: 'CONFLICT_STATE' });

        clock.set(new Date(T0.getTime() + 29 * 24 * HOUR));
        await w.tasks.reopen(w.db, person(stranger, 'AGENT'), clock.now(), made.id);
        expect(await tx.task.findUniqueOrThrow({ where: { id: made.id } })).toMatchObject({ status: 'OPEN', completedAt: null, completedById: null });
        await w.tasks.cancel(w.db, person(stranger, 'AGENT'), clock.now(), made.id, 'Sans objet');
        clock.set(new Date(clock.now().getTime() + 31 * 24 * HOUR));
        await expect(w.tasks.reopen(w.db, person(stranger, 'AGENT'), clock.now(), made.id)).rejects.toMatchObject({ code: 'CONFLICT_STATE' });
        expect(await tx.auditLog.count({ where: { entityType: 'task', entityId: made.id, action: 'task.updated' } })).toBe(5);
      });
    });

    it('AUT-032 — a key is unique among OPEN tasks; AUT-035 — the key closes the task, DONE or CANCELLED', async () => {
      await inRollback(async (tx, w) => {
        const key = `lead-contact:${newId()}`;
        const input = { title: 'Contacter le client', assigneeId: null, timeZone: 'Europe/Paris', origin: 'SYSTEM' as const, dedupeKey: key };
        const first = await w.tasks.create(w.db, SYSTEM_ACTOR, clock.now(), input);
        const second = await w.tasks.create(w.db, SYSTEM_ACTOR, clock.now(), input);
        expect([first.created, second.created, second.id === first.id]).toEqual([true, false, true]);
        expect(await tx.outboxEvent.count({ where: { type: 'task.assigned', aggregateId: first.id } })).toBe(0); // never for an automatic task
        expect(await w.tasks.closeAutomatically(w.db, clock.now(), [key], 'CANCELLED', 'Demande clôturée ou indésirable')).toBe(1);
        expect(await tx.task.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: 'CANCELLED', cancelReason: 'Demande clôturée ou indésirable', completedById: null });
        // Once closed, the same key may open a new task.
        const third = await w.tasks.create(w.db, SYSTEM_ACTOR, clock.now(), input);
        expect(third.created).toBe(true);
        expect(await w.tasks.closeAutomatically(w.db, clock.now(), [key], 'DONE', 'Premier contact noté')).toBe(1);
        expect(await w.tasks.closeAutomatically(w.db, clock.now(), [key], 'DONE', 'Premier contact noté')).toBe(0);
      });
    });
  });

  // ---------- NOT-016, NOT-035 ----------

  describe('staff notifications', () => {
    it('NOT-035 — one operation, one notification; NOT-016 — a grouped type counts on the unread notification', async () => {
      await inRollback(async (tx, w) => {
        const agent = await staffUser(tx, 'AGENT');
        const other = await staffUser(tx, 'AGENT');
        const dossierId = newId();
        const base = { userIds: [agent, other], link: '/dossiers/DOS-1', entityType: 'Dossier', entityId: dossierId };
        const a = await w.notifier.notify(w.db, clock.now(), { ...base, type: 'NS_DOSSIER_COMPLETE', title: 'Le dossier DOS-1 est complet.', originId: 'req-1', exceptUserId: other });
        expect(a.notified).toEqual([agent]); // the author of the action is never notified (NOT-018)
        const again = await w.notifier.notify(w.db, clock.now(), { ...base, type: 'NS_DOSSIER_COMPLETE', title: 'Le dossier DOS-1 est complet.', originId: 'req-1', exceptUserId: other });
        expect(again.notified).toEqual([]);
        expect(await tx.notification.count({ where: { userId: agent, entityId: dossierId } })).toBe(1);
        // The alert of a rule and NS_TASK_AUTO for the same operation and the same object: replaced.
        const alert = await w.notifier.notify(w.db, clock.now(), { ...base, userIds: [agent], type: 'NS_RULE_ALERT', title: 'Alerte', originId: 'req-1' });
        expect(alert).toEqual({ notified: [], replaced: [agent] });
        // Another object of the same operation (the pass of a scheduled task): its own notification.
        const elsewhere = await w.notifier.notify(w.db, clock.now(), { ...base, userIds: [agent], entityId: newId(), type: 'NS_RULE_ALERT', title: 'Alerte', originId: 'req-1' });
        expect(elsewhere.notified).toEqual([agent]);

        const piece = { userIds: [agent], type: 'NS_DOC_RECEIVED', title: 'Karima Benali a déposé une pièce.', titlePlural: 'Karima Benali a déposé {n} pièces.', link: '/dossiers/DOS-1', entityType: 'Dossier', entityId: dossierId };
        await w.notifier.notify(w.db, clock.now(), { ...piece, originId: 'req-2' });
        clock.set(new Date(T0.getTime() + MINUTE));
        await w.notifier.notify(w.db, clock.now(), { ...piece, originId: 'req-3' });
        await w.notifier.notify(w.db, clock.now(), { ...piece, originId: 'req-3' }); // replayed: not counted twice
        const grouped = await tx.notification.findMany({ where: { userId: agent, type: 'NS_DOC_RECEIVED' } });
        expect(grouped).toHaveLength(1);
        expect(grouped[0]!).toMatchObject({ count: 2, title: 'Karima Benali a déposé une pièce.', titlePlural: 'Karima Benali a déposé {n} pièces.' });
        expect(grouped[0]!.updatedAt.getTime()).toBe(T0.getTime() + MINUTE); // it comes back to the top
        // Once read, the next deposit opens a new notification.
        await tx.notification.update({ where: { id: grouped[0]!.id }, data: { readAt: clock.now() } });
        await w.notifier.notify(w.db, clock.now(), { ...piece, originId: 'req-4' });
        expect(await tx.notification.count({ where: { userId: agent, type: 'NS_DOC_RECEIVED' } })).toBe(2);
      });
    });

    it('AUT-076 — a technical alert: SUPPORT is notified and written to, once per hour and per cause', async () => {
      await inRollback(async (tx, w) => {
        const support = await staffUser(tx, 'SUPPORT');
        const email = (await tx.user.findUniqueOrThrow({ where: { id: support } })).email;
        const alert = { cause: `rule:${newId()}`, label: 'Exécution de règle en échec : R_TEST', details: 'L’exécution a échoué après ses nouveaux essais.', reference: 'exec-1' };
        expect(await w.alerts.raise(alert)).toBe(true);
        await w.alerts.raise(alert);
        expect((await alertsOf(tx, support, 'NS_TECH_ALERT')).map((n) => n.title)).toEqual(['Alerte technique : Exécution de règle en échec : R_TEST.']);
        const sent = mails(w, 'S_TECH_ALERT').filter((m) => m.to === email);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.subject).toBe('[Alerte] Exécution de règle en échec : R_TEST');
        expect(sent[0]!.text).toMatch(/Identifiant\s: exec-1\./);
        clock.set(new Date(T0.getTime() + 61 * MINUTE)); // the next hour: raised again
        await w.alerts.raise(alert);
        expect(mails(w, 'S_TECH_ALERT').filter((m) => m.to === email)).toHaveLength(2);
      });
    });
  });

  // ---------- PAR-081 ----------

  describe('PAR-081 — installation of the rules', () => {
    it('replayed, it creates nothing; an adjusted rule keeps its setting, an untouched one follows the new original', async () => {
      await inRollback(async (tx) => {
        // Replayed on an installed base: no rule is created (a rule the team adjusted may only have its original moved).
        expect((await installWorkflowRules(tx, clock.now())).join(' ')).not.toContain('créées');
        await installWorkflowRules(tx, clock.now()); // origins now equal the seeds, whatever the base held
        const rules = await tx.workflowRule.findMany({ where: { code: { in: RULE_SEEDS.map((s) => s.code) } } });
        expect(rules).toHaveLength(RULE_SEEDS.length);
        expect(rules.every((r) => r.isSystem && r.originDefinition !== null)).toBe(true);

        // The team adjusts one rule (delay) and disables another.
        await tx.workflowRule.update({ where: { code: 'R_LEAD_NOT_TAKEN' }, data: { delayValue: 2 } });
        await tx.workflowRule.update({ where: { code: 'R_CAFE_LOW_FILL' }, data: { isActive: false } });
        const changed = RULE_SEEDS.map((s) =>
          s.code === 'R_LEAD_NOT_TAKEN' || s.code === 'R_CAFE_LOW_FILL' || s.code === 'R_CLIENT_RESURFACED' ? { ...s, delayValue: s.delayValue + 1, delayUnit: 'BUSINESS_HOURS' as const } : s,
        );
        const report = await installWorkflowRules(tx, clock.now(), changed);
        expect(report.join(' ')).toContain('R_CLIENT_RESURFACED');
        const adjusted = await tx.workflowRule.findUniqueOrThrow({ where: { code: 'R_LEAD_NOT_TAKEN' } });
        expect(adjusted.delayValue).toBe(2); // the team's setting stays
        expect((adjusted.originDefinition as { delayValue: number }).delayValue).toBe(5); // « Rétablir le réglage d'origine » offers the new one
        const untouched = await tx.workflowRule.findUniqueOrThrow({ where: { code: 'R_CLIENT_RESURFACED' } });
        expect([untouched.delayValue, untouched.delayUnit]).toEqual([1, 'BUSINESS_HOURS']);
        const disabled = await tx.workflowRule.findUniqueOrThrow({ where: { code: 'R_CAFE_LOW_FILL' } });
        expect([disabled.isActive, disabled.delayValue]).toEqual([false, 1]); // updated, and still disabled
      });
    });

    it('a seed that does not pass the validation stops the installation', async () => {
      await inRollback(async (tx) => {
        const bad = [{ ...RULE_SEEDS[0]!, code: 'R_TEST_BAD', conditions: { all: [{ field: 'client.passwordHash', op: 'eq' as const, value: 'x' }] } }];
        await expect(installWorkflowRules(tx, clock.now(), bad)).rejects.toThrow(/R_TEST_BAD is invalid: INVALID_RULE_FIELD/);
      });
    });
  });

  // ---------- AUT-012 ----------

  it('AUT-012 — a fact is signalled once, whatever the number of passes', async () => {
    await inRollback(async (tx, w) => {
      const id = newId();
      const fact = { type: 'lead.sla_breached', aggregate: { type: 'Lead', id }, data: {}, dedupeKey: `lead.sla_breached:${id}` };
      expect(await emitFact(w.db, clock.now(), fact)).toBe(true);
      expect(await emitFact(w.db, clock.now(), fact)).toBe(false);
      expect(await tx.outboxEvent.count({ where: { aggregateId: id } })).toBe(1);
    });
  });
});

// ---------- AUT-081, AUT-082 — the scheduler and its journal (committed rows of test-only tasks, deleted afterwards) ----------

describe.skipIf(!dbUp)('scheduler against the database', () => {
  let prisma: PrismaService;
  const clock = new FixedClock(T0);
  const env = { DATABASE_URL: url!, APP_ENV: 'local', APP_ROLE: 'api', WEB_URL: 'https://site.test', LINK_SIGNING_KEY: 'l'.repeat(40) } as unknown as Env;
  const suffix = newId().slice(-8);
  const name = (n: string) => `test.${n}.${suffix}`;
  let scheduler: Scheduler;

  beforeAll(() => {
    prisma = new PrismaService(env);
    const settings = new SettingsService(prisma, new FixedClock(T0));
    const calendar = new BusinessCalendarService(prisma, settings);
    // Alerts of failed test passes must reach nobody: an alert service that does nothing.
    const alerts = { raise: async () => false } as unknown as TechAlerts;
    scheduler = new Scheduler(prisma, clock, calendar, alerts, env);
  });
  afterAll(async () => {
    await prisma.jobRun.deleteMany({ where: { jobName: { endsWith: `.${suffix}` } } });
    await prisma.$disconnect();
  });

  const runs = (job: string) => prisma.jobRun.findMany({ where: { jobName: job }, orderBy: { startedAt: 'asc' } });

  it('AUT-082 — one pass, one JobRun: start, end, counters; a failed pass keeps its error', async () => {
    clock.set(T0);
    let seen: { lastRunAt: Date | null; jobRunId: string } | null = null;
    scheduler.register({ name: name('ok'), schedule: { everyMinutes: 5 }, run: async (ctx) => ((seen = ctx), { scanned: 3, changed: 1 }) });
    scheduler.register({ name: name('ko'), schedule: { everyMinutes: 5 }, run: async () => Promise.reject(new Error('boom for karima@example.com')) });
    expect(await scheduler.run(name('ok'))).toEqual({ scanned: 3, changed: 1 });
    expect(await scheduler.run(name('ko'))).toBeNull();
    const [ok] = await runs(name('ok'));
    expect(ok!).toMatchObject({ status: 'DONE', counters: { scanned: 3, changed: 1 }, error: null, triggeredById: null });
    expect([ok!.startedAt, ok!.finishedAt]).toEqual([T0, T0]);
    expect(seen!.lastRunAt).toBeNull();
    expect(seen!.jobRunId).toBe(ok!.id);
    const [ko] = await runs(name('ko'));
    expect(ko!).toMatchObject({ status: 'FAILED', error: 'boom for [adresse]' }); // no personal data in the journal
  });

  it('AUT-081 — an interval task is due after its interval, counted from the previous pass', async () => {
    const job = { name: name('interval'), schedule: { everyMinutes: 15 }, run: async () => ({}) };
    scheduler.register(job);
    clock.set(T0);
    expect(await scheduler.isDue(job, clock.now())).toBe(true); // never ran
    await scheduler.run(job.name);
    clock.set(new Date(T0.getTime() + 14 * MINUTE));
    expect(await scheduler.isDue(job, clock.now())).toBe(false);
    clock.set(new Date(T0.getTime() + 15 * MINUTE));
    expect(await scheduler.isDue(job, clock.now())).toBe(true);
    expect((await scheduler.nextRunAt(job, new Date(T0.getTime() + MINUTE)))!.getTime()).toBe(T0.getTime() + 15 * MINUTE);
  });

  it('AUT-081 — a daily task runs once per local date, at or after its hour; working days only when it says so', async () => {
    const daily = { name: name('daily'), schedule: { dailyAt: '08:00' }, run: async () => ({}) };
    const weekdays = { name: name('weekdays'), schedule: { dailyAt: '08:30', businessDaysOnly: true }, run: async () => ({}) };
    scheduler.register(daily);
    scheduler.register(weekdays);
    clock.set(new Date('2026-10-12T05:59:00Z')); // 7:59 in Paris
    expect(await scheduler.isDue(daily, clock.now())).toBe(false);
    clock.set(new Date('2026-10-12T06:00:00Z')); // 8:00
    expect(await scheduler.isDue(daily, clock.now())).toBe(true);
    await scheduler.run(daily.name);
    clock.set(new Date('2026-10-12T15:00:00Z'));
    expect(await scheduler.isDue(daily, clock.now())).toBe(false); // done today
    expect((await scheduler.nextRunAt(daily, clock.now()))!.toISOString()).toBe('2026-10-13T06:00:00.000Z');
    clock.set(new Date('2026-10-13T06:05:00Z')); // catches up: a pass missed at 8:00 runs at the next tick
    expect(await scheduler.isDue(daily, clock.now())).toBe(true);
    clock.set(new Date('2026-10-17T09:00:00Z')); // a Saturday
    expect(await scheduler.isDue(weekdays, clock.now())).toBe(false);
    expect((await scheduler.nextRunAt(weekdays, clock.now()))!.toISOString()).toBe('2026-10-19T06:30:00.000Z'); // Monday 8:30
  });

  it('AUT-082 — a pass still running prevents the next one, which writes no JobRun; « Lancer maintenant » is traced', async () => {
    clock.set(T0);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = { name: name('slow'), schedule: { everyMinutes: 1 }, run: async () => (await gate, { changed: 1 }) };
    scheduler.register(slow);
    const first = scheduler.run(slow.name);
    await new Promise((r) => setTimeout(r, 150));
    expect(await scheduler.run(slow.name)).toBeNull(); // skipped
    expect((await scheduler.status()).find((j) => j.name === slow.name)!.running).toBe(true);
    release();
    expect(await first).toEqual({ changed: 1 });
    expect(await runs(slow.name)).toHaveLength(1);

    // An abandoned pass (the process died) no longer blocks after 30 minutes, and is closed as failed.
    const stale = newId();
    await prisma.jobRun.create({ data: { id: stale, jobName: slow.name, status: 'RUNNING', startedAt: new Date(T0.getTime() + MINUTE), createdAt: T0, updatedAt: T0 } });
    clock.set(new Date(T0.getTime() + 20 * MINUTE));
    expect(await scheduler.run(slow.name)).toBeNull();
    clock.set(new Date(T0.getTime() + 32 * MINUTE));
    expect(await scheduler.run(slow.name)).toEqual({ changed: 1 });
    expect(await prisma.jobRun.findUniqueOrThrow({ where: { id: stale } })).toMatchObject({ status: 'FAILED', error: 'ABANDONED' });
  });

  it('AUT-091 — `purge` runs every line, whatever happens to the others', async () => {
    clock.set(T0);
    const isolated = new Scheduler(prisma, clock, new BusinessCalendarService(prisma, new SettingsService(prisma, clock)), { raise: async () => false } as unknown as TechAlerts, env);
    const purge = isolated.list().find((j) => j.name === 'purge')!;
    expect(purge.schedule).toEqual({ dailyAt: '04:30' });
    const ran: string[] = [];
    isolated.registerPurge('first', async () => (ran.push('first'), 4));
    isolated.registerPurge('broken', async () => Promise.reject(new Error('lock timeout')));
    isolated.registerPurge('last', async () => (ran.push('last'), 0));
    await expect(purge.run({ now: T0, lastRunAt: null, jobRunId: newId() })).rejects.toThrow(/broken: lock timeout/);
    expect(ran).toEqual(['first', 'last']);
  });
});
