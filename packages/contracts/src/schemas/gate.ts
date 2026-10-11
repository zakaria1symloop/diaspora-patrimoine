// NAV-064 — reserved access to the site before opening and in acceptance.
import { z } from 'zod';

export const gateRequestSchema = z.object({
  password: z.string().min(1, { error: 'REQUIRED' }).max(200),
});
export type GateRequest = z.infer<typeof gateRequestSchema>;
