// Server-side reads shared by the two simulator pages: options (bounds, currencies, products) and the SIM-030 property.
import 'server-only';
import type { SimulatorOptions, SimulatorProperty } from '@dp/contracts';
import { apiGet } from '@/lib/api';

export type SP = Promise<Record<string, string | string[] | undefined>>;

export const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)?.slice(0, 40);

export function loadOptions(): Promise<SimulatorOptions> {
  return apiGet<SimulatorOptions>('/public/simulations/options', { tags: ['settings', 'catalogue'] });
}

/** SIM-030 — a property that no longer exists opens the simulator empty, without an error message. */
export async function loadProperty(reference: string | undefined): Promise<SimulatorProperty | null> {
  if (!reference || !/^[A-Za-z0-9-]{3,80}$/.test(reference)) return null;
  try {
    return await apiGet<SimulatorProperty>(`/public/simulations/property/${encodeURIComponent(reference)}`, { tags: ['catalogue'] });
  } catch {
    return null;
  }
}
