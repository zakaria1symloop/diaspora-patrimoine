// Package 3.3 « Doublons et fusion » (04-back-office/03 § 8: CRM-080, CRM-081; CRM-045 « Mettre à jour la fiche »,
// MOD-300) — wire contracts of `/admin/clients/{id}/not-duplicate`, `…/merge-preview`, `…/merge`, `…/lead-differences`,
// `…/apply-lead-values`.
import { z } from 'zod';

/** How a value of a record reads on the merge screen (the screen formats it). */
export type MergeValueKind = 'text' | 'enum' | 'money' | 'date' | 'country' | 'countries' | 'regions' | 'types' | 'bool';

/** One choice of rule 2 — a field, or a group of fields that travel together (an amount and its currency). */
export interface MergeField {
  key: string;
  kind: MergeValueKind;
  /** For `enum`: the enumeration of `ui.enum.{Enum}`. */
  enumName?: string;
  /** The values, already reduced to what the screen shows (`null`: empty). For `money`: `{ amount, currency }`. */
  keep: unknown;
  other: unknown;
  /** Both have a value and they differ: the administrator chooses (rule 2). */
  differs: boolean;
  /** The side rule 2 takes by default: the kept record's value when it has one, else the other's. */
  defaultSide: 'KEEP' | 'OTHER';
  /** ROL-019 — a sensitive value the reader may not read: both sides `null`, the default applies. */
  withheld?: boolean;
}

export interface MergeRecordSummary {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  hasAccount: boolean;
  agentName: string | null;
  version: number;
  counts: { leads: number; dossiers: number; simulations: number; registrations: number; notes: number };
  flags: { doNotContact: boolean; restricted: boolean; phoneCheckNeeded: boolean; emailBounced: boolean };
}

export type MergeRefusal = 'BOTH_ACCOUNTS' | 'SAME_PROPERTY' | 'ERASED' | 'ALREADY_MERGED' | 'SAME_RECORD';

/** `GET /admin/clients/{id}/merge-preview?with=&keep=` (`client.merge`). */
export interface MergePreview {
  keep: MergeRecordSummary;
  absorbed: MergeRecordSummary;
  /** Rule 1 — `ACCOUNT`: the record with an account is kept; `CHOSEN`: the administrator chooses (the oldest by default). */
  keepRule: 'ACCOUNT' | 'CHOSEN';
  fields: MergeField[];
  /** What moves to the kept record, per kind (rule 3). */
  moves: Record<string, number>;
  /** Rule 4 — the protections that will apply whatever is chosen (codes translated by the screen). */
  protections: ('DO_NOT_CONTACT' | 'RESTRICTED' | 'PHONE_CHECK' | 'EMAIL_BOUNCED' | 'CONSENTS' | 'PREFERENCES')[];
  /** Rule 5 — the address that joins `alternateEmails`, or becomes the address when the kept record has none. */
  absorbedEmail: { address: string; becomes: 'ALTERNATE' | 'MAIN' } | null;
  refusal: MergeRefusal | null;
  /** For `SAME_PROPERTY`: the two dossiers. */
  refusalDetail: string[] | null;
}

export const MERGE_CONFIRMATION = 'FUSIONNER';

/** `POST /admin/clients/{id}/merge` — `{id}` and `otherId` are the two records; `keepId` one of them. */
export const clientMergeSchema = z.strictObject({
  otherId: z.uuid(),
  keepId: z.uuid(),
  /** Rule 2 — the side chosen for each differing field (absent: the default). */
  choices: z.record(z.string().max(40), z.enum(['KEEP', 'OTHER'])).default({}),
  /** TRV-095 — the word typed. */
  confirmation: z.literal(MERGE_CONFIRMATION, { error: 'MUST_ACCEPT' }),
  versions: z.strictObject({ keep: z.number().int().positive(), absorbed: z.number().int().positive() }),
});
export type ClientMerge = z.input<typeof clientMergeSchema>;

export const clientNotDuplicateSchema = z.strictObject({ otherId: z.uuid() });

/** MOD-300, CRM-045 — what the last request says differently from the record, field by field. */
export interface LeadDifferences {
  lead: { id: string; reference: string; createdAt: string } | null;
  fields: { key: 'firstName' | 'lastName' | 'phone' | 'countryOfResidence'; record: string | null; lead: string }[];
}

export const applyLeadValuesSchema = z.strictObject({
  leadId: z.uuid(),
  fields: z.array(z.enum(['firstName', 'lastName', 'phone', 'countryOfResidence'])).min(1).max(4),
});
