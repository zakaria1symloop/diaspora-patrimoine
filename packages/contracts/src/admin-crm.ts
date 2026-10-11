// Packages 3.2 and 3.3 — what the requests and the clients of the back office SHARE on the wire: a client record
// created by the team (CRM-025, CRM-041, MOD-302: the e-mail or the phone, one of the two is enough) and the check of
// coordinates already known (CRM-041). The screens of each module have their own contracts (`admin-leads`,
// `admin-clients`, `admin-exchanges`…).
import { z } from 'zod';
import { LEAD_SOURCES } from './admin-leads.js';
import { countryCodeSchema, emailSchema, personNameSchema, phoneSchema } from './schemas/leads.js';

const blankToNull = (v: unknown) => (v === '' || v === null || v === undefined ? null : v);

/** CRM-025 — origins a member of the team may give to what he enters by hand (never `WEB_FORM`, `MOBILE_APP`, `SIGNUP`, `IMPORT`). */
export const STAFF_ENTRY_SOURCES = ['PHONE', 'WHATSAPP', 'EMAIL', 'CAFE', 'PARTNER', 'ADMIN'] as const satisfies readonly (typeof LEAD_SOURCES)[number][];
export type StaffEntrySource = (typeof STAFF_ENTRY_SOURCES)[number];

/**
 * CRM-041 — « Créer un client »: prénom, nom, e-mail, téléphone, pays de résidence, origine, conseiller. The e-mail OR
 * the phone is required (MOD-302): without either, the field `email` carries `REQUIRED`.
 */
export const staffClientCreateSchema = z
  .strictObject({
    firstName: personNameSchema,
    lastName: personNameSchema,
    email: z.preprocess(blankToNull, emailSchema.nullable()).default(null),
    phone: z.preprocess(blankToNull, phoneSchema.nullable()).default(null),
    whatsappOptIn: z.boolean().default(false),
    countryOfResidence: z.preprocess(blankToNull, countryCodeSchema.nullable()).default(null),
    source: z.enum(STAFF_ENTRY_SOURCES, { error: 'REQUIRED' }),
    /** The referent adviser; null: nobody yet. */
    assignedAgentId: z.preprocess(blankToNull, z.uuid({ error: 'INVALID_CHOICE' }).nullable()).default(null),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) ctx.addIssue({ code: 'custom', path: ['email'], message: 'REQUIRED' });
  });
export type StaffClientCreate = z.input<typeof staffClientCreateSchema>;
export type StaffClientCreateData = z.output<typeof staffClientCreateSchema>;

/** A record named by a check: « NOM Prénom » and where it opens. */
export interface ContactOwner {
  id: string;
  name: string | null;
}

/**
 * CRM-041 — `GET /admin/clients/contact-check?email=&phone=&except=`. For each coordinate given:
 *   · e-mail — `TAKEN`: « Cette adresse appartient déjà à {nom}. Ouvrir sa fiche » (the creation is replaced);
 *   · phone — `SHARED`: « Ce numéro figure aussi sur la fiche de {nom} » (a warning, never a refusal);
 *   · `…_HIDDEN` — the record lies outside the reader's perimeter (ROL-018): no name is given.
 * A coordinate that was not asked is `null`.
 */
export interface ContactCheck {
  email: { state: 'FREE' } | { state: 'TAKEN'; client: ContactOwner } | { state: 'TAKEN_HIDDEN' } | null;
  phone: { state: 'FREE' } | { state: 'SHARED'; client: ContactOwner } | { state: 'SHARED_HIDDEN' } | null;
}

export const contactCheckQuerySchema = z.strictObject({
  email: z.string().trim().max(254).optional(),
  phone: z.string().trim().max(24).optional(),
  /** The record being edited: it is not its own twin. */
  except: z.uuid().optional(),
});

/** An adviser one may entrust a request, a client or a dossier to (CRM-011: active, and whether he is absent now). */
export interface AdvisorOption {
  id: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  /** ISO day of the last day of his absence (CRM-021), else null. */
  absentUntil: string | null;
  receivesLeads: boolean;
}
