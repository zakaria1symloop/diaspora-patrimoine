// PAR-101 — public settings, cached one minute at most.
import { Controller, Get, Header } from '@nestjs/common';
import type { PublicSettings } from '@dp/contracts';
import { SettingsService } from '../platform/settings.service.js';
import { HolidaysService } from '../platform/holidays.service.js';

@Controller('public/settings')
export class PublicSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly holidays: HolidaysService,
  ) {}

  @Get('public')
  @Header('Cache-Control', 'public, max-age=60')
  async get(): Promise<PublicSettings> {
    const values = await this.settings.publicValues();
    return { ...values, holidays: await this.holidays.next60Days() } as PublicSettings;
  }
}
