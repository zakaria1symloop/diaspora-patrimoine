// API-100 `GET /public/countries` — TRV-044: the residence countries, the frequent ones first (display.frequentCountries),
// then all the others in French alphabetical order; with the dialling code for the phone field (TRV-040).
import { Controller, Get, Header } from '@nestjs/common';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';

export interface PublicCountry {
  code: string;
  name: string;
  phonePrefix: string;
  frequent: boolean;
}

@Controller('public/countries')
export class CountriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=3600')
  async list(): Promise<{ data: PublicCountry[] }> {
    const [rows, frequent] = await Promise.all([
      this.prisma.country.findMany({ where: { isResidenceOption: true }, select: { code: true, nameFr: true, phonePrefix: true } }),
      this.settings.get('display.frequentCountries'),
    ]);
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const top = frequent.map((c) => byCode.get(c)).filter((r): r is NonNullable<typeof r> => Boolean(r));
    const rest = rows.filter((r) => !frequent.includes(r.code)).sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr'));
    return {
      data: [
        ...top.map((r) => ({ code: r.code, name: r.nameFr, phonePrefix: r.phonePrefix, frequent: true })),
        ...rest.map((r) => ({ code: r.code, name: r.nameFr, phonePrefix: r.phonePrefix, frequent: false })),
      ],
    };
  }
}
