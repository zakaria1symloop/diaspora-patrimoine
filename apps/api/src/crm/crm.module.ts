// Packages 3.2 and 3.3 — the kernel the requests, the exchanges and the clients of the back office share:
// `first-contact.ts` (CYC-004, CYC-005), `client-write.ts` (CRM-041, MOD-302), `advisors.ts` (CRM-011, CRM-021).
// Functions, not services: each use case calls them inside ITS transaction. One route lives here because every
// « Affecter à… » window needs it: `GET /admin/advisors`.
import { Controller, Get, Module } from '@nestjs/common';
import type { AdvisorOption } from '@dp/contracts';
import { RequirePermission } from '../identity/access.js';
import { Clock } from '../platform/clock.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { listAdvisorOptions } from './advisors.js';

@Controller('admin/advisors')
export class AdvisorsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly settings: SettingsService,
  ) {}

  /** API-101 — the team is read with `user.read` (every staff role holds it, ROL-022). */
  @Get() @RequirePermission('user.read')
  async list(): Promise<{ data: AdvisorOption[] }> {
    return { data: await listAdvisorOptions(this.prisma, this.clock.now(), await this.settings.get('business.calendar.timezone')) };
  }
}

@Module({ controllers: [AdvisorsController] })
export class CrmModule {}
