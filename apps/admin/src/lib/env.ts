// ARC-072 — environment of the back office, validated once on the server. No secret lives here.
import { z } from 'zod';

const schema = z.object({
  APP_ENV: z.enum(['local', 'preview', 'staging', 'production']).default('local'),
  API_URL: z.url().default('http://localhost:4000'),
  ADMIN_URL: z.url().default('http://localhost:3001'),
  WEB_URL: z.url().default('http://localhost:3000'),
});

export type AdminEnv = z.infer<typeof schema>;

let cached: AdminEnv | null = null;

export function env(): AdminEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid admin environment: ${lines}`);
  }
  cached = parsed.data;
  return cached;
}
