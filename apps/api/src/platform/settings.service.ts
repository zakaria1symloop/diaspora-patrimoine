// PAR-001, PAR-003, PAR-101 — settings: declared in @dp/contracts, stored in `Setting`, default when absent.
import { Injectable } from '@nestjs/common';
import {
  publicSettingKeys,
  settingsRegistry,
  type PublicSettings,
  type SettingKey,
  type SettingValue,
} from '@dp/contracts';
import { PrismaService } from './prisma.service.js';
import { Clock } from './clock.js';
import { log } from './request-context.js';

const CACHE_MS = 60_000; // PAR-101: one minute at most; invalidated on every write.

type Values = { [K in SettingKey]: SettingValue<K> };

@Injectable()
export class SettingsService {
  private cache: { at: number; values: Values } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async all(): Promise<Values> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_MS) return this.cache.values;
    const rows = await this.prisma.setting.findMany({ select: { key: true, value: true } });
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    const values = {} as Record<string, unknown>;
    for (const key of Object.keys(settingsRegistry) as SettingKey[]) {
      const decl = settingsRegistry[key];
      if (stored.has(key)) {
        const parsed = decl.schema.safeParse(stored.get(key));
        if (parsed.success) {
          values[key] = parsed.data;
          continue;
        }
        // A stored value that no longer matches its declaration falls back to the default, loudly.
        log('warn', 'setting.invalid', { key });
      }
      values[key] = structuredClone(decl.default);
    }
    this.cache = { at: now, values: values as Values };
    this.clock.setOffsetDays((values as Values)['clock.offsetDays']);
    return this.cache.values;
  }

  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    return (await this.all())[key];
  }

  invalidate(): void {
    this.cache = null;
  }

  /** PAR-101 — exactly the public keys, plus `holidays` filled by the caller. */
  async publicValues(): Promise<Omit<PublicSettings, 'holidays'>> {
    const all = await this.all();
    const out: Record<string, unknown> = {};
    for (const key of publicSettingKeys) out[key] = all[key];
    return out as Omit<PublicSettings, 'holidays'>;
  }
}
