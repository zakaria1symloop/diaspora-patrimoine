import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from '../config/env.js';
import { BusinessCalendarService } from './business-calendar.js';
import { Clock } from './clock.js';
import { HolidaysService } from './holidays.service.js';
import { IdempotencyService } from './idempotency.js';
import { EVENT_DISPATCHER, OutboxHandlers, OutboxWriter, PollingOutboxDispatcher } from './outbox.js';
import { PrismaService } from './prisma.service.js';
import { ClientIp, RateLimiter } from './rate-limit.js';
import { SettingsService } from './settings.service.js';

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    Clock,
    PrismaService,
    SettingsService,
    HolidaysService,
    RateLimiter,
    ClientIp,
    BusinessCalendarService,
    IdempotencyService,
    OutboxWriter,
    OutboxHandlers,
    PollingOutboxDispatcher,
    { provide: EVENT_DISPATCHER, useExisting: PollingOutboxDispatcher },
  ],
  exports: [
    ENV,
    Clock,
    PrismaService,
    SettingsService,
    HolidaysService,
    RateLimiter,
    ClientIp,
    BusinessCalendarService,
    IdempotencyService,
    OutboxWriter,
    OutboxHandlers,
    EVENT_DISPATCHER,
  ],
})
export class PlatformModule {}
