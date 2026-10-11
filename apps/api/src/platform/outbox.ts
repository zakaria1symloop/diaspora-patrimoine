// FIA-040…FIA-042, AUT-002, AUT-003 — transactional outbox. An action writes its domain events in the SAME transaction
// as its data (`OutboxWriter.add`); a dispatcher claims committed events (`FOR UPDATE SKIP LOCKED`), hands them to the
// registered handlers, then marks them processed. Handlers must be idempotent (FIA-041: each effect carries its key).
//
// The in-process poller below stands for the `outbox` queue of ARC-050 while Redis/BullMQ are not part of the
// environment: it sits behind `EventDispatcher`, so a BullMQ implementation replaces it without touching the writers
// or the handlers.
import { Inject, Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { Clock } from './clock.js';
import { newId } from './ids.js';
import { PrismaService } from './prisma.service.js';
import { log } from './request-context.js';
import type { Tx } from './tx.js';

export interface DomainEvent {
  /** AUT-010 event type (`lead.created`). */
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  /** MOD-019 — optional key making the event itself unique. */
  dedupeKey?: string;
}

export interface OutboxRecord {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  attempts: number;
}

/** A group of effects of AUT-003 (system effects, notifications and e-mails, rules). Independent of the others. */
export interface OutboxHandler {
  /** Named in `lastError` when it fails (no personal data in the message). */
  readonly name: string;
  /** Event types handled; `*` for all. */
  readonly types: readonly string[];
  /**
   * AUT-003 — position among the groups of an event: system effects and notifications first (default 0), the rules of
   * automation last (100). Groups of the same position run in their registration order.
   */
  readonly order?: number;
  handle(event: OutboxRecord): Promise<void>;
}

/** The dispatching strategy (in-process poller now, BullMQ later). */
export interface EventDispatcher {
  /** Asks for a pass as soon as possible (after a commit). */
  wake(): void;
  /** Runs one pass; returns the number of events handled. */
  drain(): Promise<number>;
}

/** FIA-040 point 4 — retries after 1 min, 5 min, 30 min, 2 h, 6 h, then every 6 h; alert at the 5th failure, parked at the 10th. */
export const OUTBOX_BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000];
export const OUTBOX_ALERT_AT = 5;
export const OUTBOX_PARK_AT = 10;
/** FIA-040 point 2 — a claim older than 5 minutes without outcome is abandoned. */
export const OUTBOX_CLAIM_TIMEOUT_MS = 300_000;

export function outboxRetryDelay(attempts: number): number {
  return OUTBOX_BACKOFF_MS[Math.min(attempts, OUTBOX_BACKOFF_MS.length) - 1] ?? OUTBOX_BACKOFF_MS[OUTBOX_BACKOFF_MS.length - 1]!;
}

@Injectable()
export class OutboxWriter {
  constructor(private readonly clock: Clock) {}

  /** FIA-040 point 1 — written by the action's transaction: no commit, no event; commit, event. */
  async add(tx: Tx, event: DomainEvent, at: Date = this.clock.now()): Promise<string> {
    const id = newId();
    await tx.outboxEvent.create({
      data: {
        id,
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload as never,
        dedupeKey: event.dedupeKey ?? null,
        occurredAt: at,
        availableAt: at,
        createdAt: at,
        updatedAt: at,
      },
    });
    return id;
  }
}

@Injectable()
export class OutboxHandlers {
  private readonly handlers: OutboxHandler[] = [];

  register(handler: OutboxHandler): void {
    if (!this.handlers.some((h) => h.name === handler.name)) this.handlers.push(handler);
  }

  for(type: string): OutboxHandler[] {
    return this.handlers
      .filter((h) => h.types.includes('*') || h.types.includes(type))
      .map((h, i) => ({ h, i }))
      .sort((a, b) => (a.h.order ?? 0) - (b.h.order ?? 0) || a.i - b.i)
      .map((x) => x.h);
  }
}

interface ClaimedRow {
  id: string;
  type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
  attempts: number;
}

/** In-process poller (ARC-050 `outbox` queue stand-in). Runs in `worker` and `all` roles, and in local `api` for convenience. */
@Injectable()
export class PollingOutboxDispatcher implements EventDispatcher, OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<number> | null = null;
  private stopped = false;
  readonly pollMs = 2_000;
  readonly batch = 20;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly handlers: OutboxHandlers,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap(): void {
    const enabled = this.env.APP_ROLE !== 'api' || this.env.APP_ENV === 'local';
    if (!enabled) return;
    this.timer = setInterval(() => this.wake(), this.pollMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  wake(): void {
    if (this.running || this.stopped) return;
    this.running = this.drain()
      .catch((err: unknown) => {
        log('error', 'outbox.drain_failed', { message: err instanceof Error ? err.message.slice(0, 300) : String(err) });
        return 0;
      })
      .finally(() => {
        this.running = null;
      });
  }

  async drain(): Promise<number> {
    let total = 0;
    for (;;) {
      const rows = await this.claim();
      if (rows.length === 0) return total;
      for (const row of rows) await this.process(row);
      total += rows.length;
      if (rows.length < this.batch) return total;
    }
  }

  /**
   * FIA-040 point 2 — claims available events by date, under SKIP LOCKED; an event is claimed only if no older event
   * of the same object is still unprocessed (reserved, available or waiting for a retry before its 5th failure, FIA-042).
   */
  private async claim(): Promise<ClaimedRow[]> {
    const now = this.clock.now();
    const stale = new Date(now.getTime() - OUTBOX_CLAIM_TIMEOUT_MS);
    return this.prisma.$queryRawUnsafe<ClaimedRow[]>(
      `WITH next AS (
         SELECT e.id FROM outbox_events e
          WHERE e.processed_at IS NULL AND e.parked_at IS NULL AND e.available_at <= $1
            AND (e.claimed_at IS NULL OR e.claimed_at < $2)
            AND NOT EXISTS (
              SELECT 1 FROM outbox_events o
               WHERE o.aggregate_type = e.aggregate_type AND o.aggregate_id = e.aggregate_id
                 AND o.processed_at IS NULL AND o.parked_at IS NULL AND o.attempts < $3
                 AND (o.occurred_at, o.id) < (e.occurred_at, e.id))
          ORDER BY e.occurred_at, e.id
          LIMIT $4
          FOR UPDATE SKIP LOCKED)
       UPDATE outbox_events u SET claimed_at = $1, updated_at = $1
         FROM next WHERE u.id = next.id
       RETURNING u.id, u.type, u.aggregate_type, u.aggregate_id, u.payload, u.occurred_at, u.attempts`,
      now,
      stale,
      OUTBOX_ALERT_AT,
      this.batch,
    );
  }

  /** AUT-003 — every handler runs, independently; the event is processed only when all succeeded. */
  private async process(row: ClaimedRow): Promise<void> {
    const event: OutboxRecord = {
      id: row.id,
      type: row.type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      payload: row.payload,
      occurredAt: row.occurred_at,
      attempts: row.attempts,
    };
    const failures: string[] = [];
    for (const handler of this.handlers.for(event.type)) {
      try {
        await handler.handle(event);
      } catch (err) {
        failures.push(`${handler.name}: ${err instanceof Error ? err.message.slice(0, 200) : 'error'}`);
      }
    }
    const now = this.clock.now();
    if (failures.length === 0) {
      await this.prisma.outboxEvent.update({ where: { id: event.id }, data: { processedAt: now, claimedAt: null, lastError: null, updatedAt: now } });
      return;
    }
    const attempts = event.attempts + 1;
    const parked = attempts >= OUTBOX_PARK_AT;
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        attempts,
        lastError: failures.join(' | ').slice(0, 500),
        claimedAt: null,
        availableAt: new Date(now.getTime() + outboxRetryDelay(attempts)),
        parkedAt: parked ? now : null,
        updatedAt: now,
      },
    });
    // AUT-076 — technical alert at the 5th failure and when parked (the alert e-mail S_TECH_ALERT comes with AUT-076).
    const level = attempts === OUTBOX_ALERT_AT || parked ? 'error' : 'warn';
    log(level, parked ? 'outbox.parked' : 'outbox.retry', { eventId: event.id, type: event.type, attempts, groups: failures.map((f) => f.split(':')[0]) });
  }
}

/** Injection token of the dispatcher (swap for a BullMQ implementation later). */
export const EVENT_DISPATCHER = Symbol('EVENT_DISPATCHER');
