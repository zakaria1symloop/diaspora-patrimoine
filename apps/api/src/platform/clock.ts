// ARC-060, ENV-032 — the only source of the current time. Tests fix it; acceptance can shift it.
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';

const DAY_MS = 86_400_000;

@Injectable()
export class Clock {
  private offsetDays = 0;

  constructor(@Inject(ENV) private readonly env: Env) {}

  now(): Date {
    return new Date(Date.now() + this.offsetDays * DAY_MS);
  }

  /** Set from the `clock.offsetDays` setting; ignored unless CLOCK_OFFSET_ALLOWED (never in production). */
  setOffsetDays(days: number): void {
    this.offsetDays = this.env.CLOCK_OFFSET_ALLOWED ? days : 0;
  }

  getOffsetDays(): number {
    return this.offsetDays;
  }
}

/** Fixed clock for tests. */
export class FixedClock extends Clock {
  constructor(private fixed: Date) {
    super({ CLOCK_OFFSET_ALLOWED: false } as Env);
  }
  override now(): Date {
    return new Date(this.fixed);
  }
  set(date: Date): void {
    this.fixed = date;
  }
}
