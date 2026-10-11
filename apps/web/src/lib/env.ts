// ARC-072 — web environment, validated once on the server.
import { z } from 'zod';

const schema = z.object({
  APP_ENV: z.enum(['local', 'preview', 'staging', 'production']).default('local'),
  API_URL: z.url().default('http://localhost:4000'),
  WEB_URL: z.url().default('http://localhost:3000'),
  REVALIDATE_SECRET: z.string().min(32),
  SITE_GATE_PASSWORD: z.string().min(12).optional(),
  // ENV-040, FIC-060, FIC-061 — MapLibre style of the OpenStreetMap provider (commercial use allowed). Optional: without
  // it, location sections show the place as text and the catalogue offers no map view (CAT-090).
  MAP_STYLE_URL: z.url().optional(),
});

export type WebEnv = z.infer<typeof schema>;

let cached: WebEnv | null = null;

export function env(): WebEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid web environment: ${lines}`);
  }
  cached = parsed.data;
  return cached;
}
