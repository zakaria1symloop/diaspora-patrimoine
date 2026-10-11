// ARC-072, ENV-040 — environment validated at start; a missing or malformed variable stops the process.
import { z } from 'zod';

const minSecret = z.string().min(32);

const schema = z
  .object({
    APP_ENV: z.enum(['local', 'preview', 'staging', 'production']),
    APP_ROLE: z.enum(['api', 'worker', 'all']).default('api'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().startsWith('postgresql://'),
    WEB_URL: z.url(),
    ADMIN_URL: z.url().optional(),
    API_URL: z.url(),
    MEDIA_URL: z.url().optional(),
    REVALIDATE_SECRET: minSecret,
    JWT_SIGNING_KEY: minSecret,
    IP_HASH_KEY: minSecret,
    LINK_SIGNING_KEY: minSecret,
    // SEC-085, MOD-016 — application encryption of the two-factor secret (32 bytes, base64 or hex) and its key id;
    // retired keys stay able to decrypt: "id:key,id:key".
    ENCRYPTION_KEY: z.string().min(32),
    ENCRYPTION_KEY_ID: z.string().regex(/^[A-Za-z0-9_-]{1,16}$/),
    ENCRYPTION_KEYS_RETIRED: z.string().optional(),
    // PAR-080, ADM-040 — first Direction account created (invited) by the installation command, all three together.
    SEED_OWNER_EMAIL: z.email().optional(),
    SEED_OWNER_FIRST_NAME: z.string().min(1).max(80).optional(),
    SEED_OWNER_LAST_NAME: z.string().min(1).max(80).optional(),
    SITE_GATE_PASSWORD: z.string().min(12).optional(),
    CLOCK_OFFSET_ALLOWED: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
    TRUSTED_PROXIES: z.string().optional(),
    // ARC-060, NOT-003, NOT-013 — e-mail. `log` (default in local) writes .eml files; `memory` is for automated tests.
    MAIL_PROVIDER: z.enum(['log', 'smtp', 'memory']).optional(),
    MAIL_FROM_ADDRESS: z.email().optional(),
    MAIL_REPLY_TO: z.email().optional(),
    MAIL_SANDBOX_RECIPIENT: z.email().optional(),
    MAIL_LOG_DIR: z.string().optional(),
    // AUT-076, ENV-040 — technical alerts always have a recipient, even before a first SUPPORT account exists.
    TECH_ALERT_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    // DEM-030 point 4 — optional challenge service (Q-034).
    CHALLENGE_SITE_KEY: z.string().optional(),
    CHALLENGE_SECRET: z.string().optional(),
    // ASS-052, ENV-040 — conversational assistant (mode AI). Empty: the assistant stays guided. The key may also come
    // from ANTHROPIC_API_KEY (the variable the provider's own tools read) when the provider is `anthropic`.
    AI_PROVIDER: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['anthropic']).optional()),
    AI_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(20).optional()),
    ANTHROPIC_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(20).optional()),
    AI_MODEL: z.preprocess((v) => (v === '' ? undefined : v), z.string().regex(/^[a-z0-9][a-z0-9.@:_-]{2,79}$/).optional()),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === 'production' && env.CLOCK_OFFSET_ALLOWED) {
      ctx.addIssue({ code: 'custom', path: ['CLOCK_OFFSET_ALLOWED'], message: 'forbidden in production (ENV-040)' });
    }
    if (env.APP_ENV !== 'production' && env.APP_ENV !== 'local' && !env.SITE_GATE_PASSWORD) {
      ctx.addIssue({ code: 'custom', path: ['SITE_GATE_PASSWORD'], message: 'required outside production (ENV-040)' });
    }
    if (env.APP_ENV === 'production' && env.MAIL_SANDBOX_RECIPIENT) {
      ctx.addIssue({ code: 'custom', path: ['MAIL_SANDBOX_RECIPIENT'], message: 'forbidden in production (ENV-040)' });
    }
    if ((env.APP_ENV === 'preview' || env.APP_ENV === 'staging') && !env.MAIL_SANDBOX_RECIPIENT) {
      ctx.addIssue({ code: 'custom', path: ['MAIL_SANDBOX_RECIPIENT'], message: 'required outside production (ENV-040, NOT-013)' });
    }
    if (env.APP_ENV === 'production' && env.APP_ROLE === 'all') {
      ctx.addIssue({ code: 'custom', path: ['APP_ROLE'], message: "'all' is allowed in local and preview only" });
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    // Clear message, then stop (ARC-072). No value is printed: some are secrets.
    process.stderr.write(`Invalid environment configuration:\n${lines.join('\n')}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
