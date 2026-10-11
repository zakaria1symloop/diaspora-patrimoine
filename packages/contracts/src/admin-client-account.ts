// Package 3.3 « Compte du client » (CRM-070) and « Voir comme le client » (CRM-075, ROL-017) — wire contracts of
// `/admin/clients/{id}/account`, its actions, `…/preview-code`, `POST /auth/preview/exchange` and `GET /client/preview`.
import { z } from 'zod';
import { emailSchema } from './schemas/leads.js';

export interface ClientAccountDevice {
  label: string | null;
  lastUsedAt: string;
  createdAt: string;
}

/** `GET /admin/clients/{id}/account` (`client.read`). */
export interface ClientAccount {
  /** « Aucun compte » · « Invité le {date} » · « Actif, dernière connexion le {date} » · « Suspendu ». */
  state: 'NONE' | 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  email: string | null;
  invitedAt: string | null;
  lastLoginAt: string | null;
  activatedAt: string | null;
  suspended: { at: string | null; kind: 'STAFF_DECISION' | 'DELETION_PENDING' | null; reason: string | null } | null;
  twoFactorEnabled: boolean;
  /** A change of address waiting for its confirmation (CRM-048). */
  pendingEmail: string | null;
  /** Read only — never a preview session (ROL-017). */
  devices: ClientAccountDevice[];
  /** What THIS caller may do now (BO-047); `null` reason: allowed. */
  can: {
    invite: boolean;
    resend: boolean;
    suspend: boolean;
    reactivate: boolean;
    revokeSessions: boolean;
    disableTwoFactor: boolean;
    changeEmail: boolean;
    preview: boolean;
  };
  /** Why the invitation is impossible: no e-mail (MOD-302), or the address already holds another account (ROL-003). */
  inviteBlocked: 'NO_EMAIL' | 'EMAIL_TAKEN' | null;
}

const reason = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(300, { error: 'TOO_LONG' }));

export const clientAccountReasonSchema = z.strictObject({ reason });
export const clientChangeEmailSchema = z.strictObject({ email: emailSchema });
export const clientPreviewCodeSchema = z.strictObject({ reason: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().trim().max(300, { error: 'TOO_LONG' }).nullable()).default(null) });

/** `POST /admin/clients/{id}/preview-code` — a single-use code of one minute; the screen opens `{webUrl}/apercu/{code}`. */
export interface ClientPreviewCode {
  url: string;
  expiresAt: string;
}

export const previewExchangeSchema = z.strictObject({ code: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/) });

/** `GET /client/preview` — the client space knows it is a read-only preview (ECL-004). */
export interface ClientPreviewState {
  active: boolean;
  clientName: string | null;
  staffName: string | null;
  expiresAt: string | null;
}
