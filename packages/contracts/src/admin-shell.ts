// Packages 1.8 / 3.1 « Socle du back-office » — wire contracts of what every screen of the `admin` application shares
// (04-back-office/01): the shell summary, « Mes préférences » (BO-070), the bell (BO-060), the global search (BO-030),
// saved views (BO-040), internal notes (BO-055) and the timeline (BO-050). One schema per request, used by the browser
// AND the API (ARC-030). Texts never travel: codes and values, translated by the screens (API-002).
import { z } from 'zod';
import type { Permission, StaffRole } from './permissions.js';
import { personNameSchema, phoneSchema } from './schemas/leads.js';

// ─── Shell (BO-010 … BO-015) ────────────────────────────────────────────────

/** BO-011 — the counters carried by the menu. A counter is absent when the role cannot read its list. */
export interface AdminBadges {
  /** Requests not taken in charge (state NEW, unassigned), within the caller's perimeter (ROL-018). */
  leadsToTake?: number;
  /** TAC-007 — my open tasks overdue (in my time zone). */
  overdueTasks?: number;
}

/** `GET /admin/me/shell` — what the frame shows around every page. */
export interface AdminShell {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
    timezone: string;
    /** CRM-021 — last day of the absence in progress (ISO day), else null: the account menu offers « Je suis de retour ». */
    absentUntil: string | null;
  };
  /** Effective role (MOD-104). */
  role: StaffRole;
  /** ROL-023 — the screens hide what the role cannot do; the API still checks every route (ROL-020). */
  permissions: Permission[];
  unreadNotifications: number;
  badges: AdminBadges;
  /** BO-014 — permanent banners. */
  banners: {
    environment: 'local' | 'preview' | 'staging' | 'production';
    /** ENV-032 — the application's « today » when the test clock is shifted (ISO day), else null. */
    shiftedClockDate: string | null;
    /** ROL-016 — end of the exceptional access in progress, else null. */
    elevatedUntil: string | null;
    maintenance: boolean;
    /** ROL-015 — the SUPPORT role reads with personal data masked. */
    masked: boolean;
  };
  /** CAL-060 — the business day, to read a duration in business time (« dans 1 j 4 h », CRM-002). */
  calendar: { workdayMinutes: number; timeZone: string };
  /** BO-004 — the session's deadlines, for the warning two minutes before the idle close. */
  session: { idleMinutes: number };
  /** BO-081 — who to reach, shown in the « ? » window (only the means that are set). */
  contact: { companyName: string; email: string | null; phone: string | null };
  /** ADM-040 — true while a single Direction account exists (« Désignez un second compte Direction. »). */
  singleOwner: boolean;
}

// ─── « Mes préférences » (BO-070: Profil) ───────────────────────────────────

export interface StaffProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  phone: string | null;
  timezone: string;
  role: StaffRole;
  twoFactorEnabled: boolean;
  /** Recovery codes still usable (SEC-011). */
  recoveryCodesLeft: number;
  passwordChangedAt: string | null;
  /** True while `security.staff.twoFactorRequired`: the second factor cannot be switched off (BO-070). */
  twoFactorRequired: boolean;
  /** BO-070 « Signature » — the text added under the name in hand-written e-mails (COM-021), line breaks kept. */
  signature: string | null;
  /** CRM-021 — last day of the absence declared (ISO day) while it is today or later, else null. */
  absentUntil: string | null;
  /** The role can be entrusted with requests (OWNER, ADMIN, AGENT): what the absence changes for it (CRM-020). */
  handlesLeads: boolean;
  /** « Reçoit des demandes » (ADM-030) — set by an administrator on the team list. */
  receivesLeads: boolean;
}

const optionalText = (max: number) =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.string().trim().max(max, { error: 'TOO_LONG' }).nullable());

/** An IANA time zone name (`Europe/Paris`); the API also checks that the runtime knows it. */
export const timezoneNameSchema = z
  .string({ error: 'REQUIRED' })
  .max(64, { error: 'TOO_LONG' })
  .regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/, { error: 'INVALID_CHOICE' });

/** `PATCH /admin/me` — the section « Profil » (BO-070). The e-mail address is changed by an administrator (ADM-030). */
export const staffProfileUpdateSchema = z.strictObject({
  firstName: personNameSchema,
  lastName: personNameSchema,
  jobTitle: optionalText(80),
  phone: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), phoneSchema.nullable()),
  timezone: timezoneNameSchema,
});
export type StaffProfileUpdate = z.input<typeof staffProfileUpdateSchema>;

export const STAFF_SIGNATURE_MAX = 500;
/** How long ahead an absence may be declared (Q: one year; the API also refuses a day already past). */
export const STAFF_ABSENCE_MAX_DAYS = 366;

/** BO-070 « Signature » — plain text, 500 characters, line breaks kept; empty: no signature text. */
export const staffSignatureSchema = z.preprocess(
  (v) => (v === null || v === undefined ? null : v),
  z
    .string()
    .transform((s) => s.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim())
    .pipe(z.string().max(STAFF_SIGNATURE_MAX, { error: 'TOO_LONG' }))
    .transform((s) => (s === '' ? null : s))
    .nullable(),
);

/** CRM-021 — the LAST day of the absence (`AAAA-MM-JJ`); null: « Je suis de retour ». */
export const absentUntilSchema = z.preprocess((v) => (v === '' ? null : v), z.string({ error: 'REQUIRED' }).regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'INVALID_DATE' }).nullable());

/** `PATCH /admin/me` with the signature alone. */
export const staffSignatureUpdateSchema = z.strictObject({ signature: staffSignatureSchema });
/** `PATCH /admin/me` with the absence alone (BO-013, BO-070 « Absence »). */
export const staffAbsenceUpdateSchema = z.strictObject({ absentUntil: absentUntilSchema });

/** COM-021 — how a hand-written e-mail is signed: « Prénom N. — fonction », then the signature text. */
export function staffSignatureLines(user: { firstName: string | null; lastName: string | null; jobTitle: string | null; signature: string | null }): string[] {
  const name = user.firstName ? (user.lastName ? `${user.firstName} ${user.lastName.charAt(0).toUpperCase()}.` : user.firstName) : null;
  const head = [name, user.jobTitle].filter(Boolean).join(' — ');
  return [...(head ? [head] : []), ...(user.signature ? user.signature.split('\n') : [])];
}

// ─── The bell (BO-060, NOT-030 § 3.2, NOT-032, NOT-033) ─────────────────────

/** BO-060 — the icon follows the object the notification names. */
export type StaffNotificationTarget = 'LEAD' | 'DOSSIER' | 'SUBMISSION' | 'TASK' | 'RECORD' | 'THREAD' | 'PARTNER' | 'OTHER';

export interface StaffNotificationItem {
  id: string;
  type: string;
  /** Rendered at creation in the recipient's language, never changed afterwards (NOT-031). */
  title: string;
  /** NOT-016 — the plural form, with `{n}` left in place; shown when `count` exceeds 1. */
  titlePlural: string | null;
  body: string | null;
  /** Internal path of the back office, or null. */
  link: string | null;
  target: StaffNotificationTarget;
  count: number;
  read: boolean;
  updatedAt: string;
}

export interface StaffNotificationList {
  data: StaffNotificationItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  unread: number;
}

export const STAFF_NOTIFICATION_ENTITIES = ['Lead', 'Dossier', 'BankSubmission', 'Task', 'Client', 'Conversation', 'Promoter', 'Bank', 'User', 'Event'] as const;

/** `POST /admin/notifications/read` — `{ids}` (a click) or `{entityType, entityId}` (the object opened, NOT-032). */
export const staffNotificationReadSchema = z.union([
  z.strictObject({ ids: z.array(z.uuid()).min(1).max(100) }),
  z.strictObject({ entityType: z.enum(STAFF_NOTIFICATION_ENTITIES), entityId: z.uuid() }),
]);

// ─── Global search (BO-030) ─────────────────────────────────────────────────

export const SEARCH_TYPES = ['CLIENT', 'LEAD', 'DOSSIER', 'SUBMISSION', 'PROPERTY', 'PROGRAM', 'PROMOTER', 'BANK', 'EVENT'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export interface SearchHit {
  type: SearchType;
  id: string;
  /** What the object's address is built from (a reference, a slug) — never a person's data (SEC-040). */
  key: string;
  /** First line of the result (« NOM Prénom », a reference, a name). */
  title: string;
  /** Second line, already composed of non-translatable values (e-mail, title of a property, region…). */
  subtitle: string | null;
  /** A state code of the object, translated by the screen (`enum.{Enum}.{VALUE}`), with its enumeration. */
  status: { enum: string; value: string } | null;
  /** ISO instant shown with the result (a request's date, a Café's date). */
  date: string | null;
  /** BO-030 — an exact reference comes first, and Enter opens it. */
  exact: boolean;
}

export interface SearchResponse {
  /** Five hits at most per type; `more` says that the filtered list holds others. */
  groups: { type: SearchType; hits: SearchHit[]; more: boolean }[];
}

// ─── Saved views (BO-040) ───────────────────────────────────────────────────

/** What a view keeps: filters, sort, columns (shown, in order) and page size — never the search text (TRV-105). */
export const savedViewConfigSchema = z.strictObject({
  filters: z.record(z.string().max(40), z.array(z.string().max(120)).max(50)).default({}),
  sort: z.string().max(40).nullable().default(null),
  columns: z.array(z.string().max(40)).max(40).nullable().default(null),
  pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(25),
});
export type SavedViewConfig = z.infer<typeof savedViewConfigSchema>;

const listKeySchema = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/, { error: 'INVALID_CHOICE' });
const viewNameSchema = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(80, { error: 'TOO_LONG' }));

export const savedViewCreateSchema = z.strictObject({ listKey: listKeySchema, name: viewNameSchema, config: savedViewConfigSchema });
export const savedViewUpdateSchema = z.strictObject({ name: viewNameSchema.optional(), config: savedViewConfigSchema.optional() });
export const savedViewShareSchema = z.strictObject({ shared: z.boolean() });
/** `PUT /admin/saved-views/default` — `viewKey`: `origin:{key}` for an origin view of the list, or the id of a saved view; null: back to the list's own default. */
export const savedViewDefaultSchema = z.strictObject({ listKey: listKeySchema, viewKey: z.string().max(60).nullable() });

export interface SavedViewItem {
  id: string;
  listKey: string;
  name: string;
  shared: boolean;
  /** The caller owns it (he may rename, change or delete it). */
  mine: boolean;
  /** The caller may change it: its owner, or an administrator for a shared one (BO-040). */
  editable: boolean;
  ownerName: string | null;
  config: SavedViewConfig;
}

export interface SavedViewsResponse {
  data: SavedViewItem[];
  /** The caller's default view for this list (`origin:{key}` or a saved view id), else null. */
  defaultViewKey: string | null;
}

// ─── Notes (BO-055) ─────────────────────────────────────────────────────────

export const NOTE_ENTITY_TYPES = ['CLIENT', 'LEAD', 'DOSSIER', 'SUBMISSION', 'PROMOTER', 'BANK', 'PROGRAM', 'PROPERTY', 'EVENT'] as const;
export type NoteEntity = (typeof NOTE_ENTITY_TYPES)[number];
export const NOTE_MAX_LENGTH = 5000;

const noteBodySchema = z
  .string({ error: 'REQUIRED' })
  .transform((s) => s.replace(/\r\n/g, '\n').trim())
  .pipe(z.string().min(1, { error: 'REQUIRED', abort: true }).max(NOTE_MAX_LENGTH, { error: 'TOO_LONG' }));

export const noteCreateSchema = z.strictObject({ entityType: z.enum(NOTE_ENTITY_TYPES, { error: 'INVALID_CHOICE' }), entityId: z.uuid(), body: noteBodySchema });
export const noteUpdateSchema = z.strictObject({ body: noteBodySchema });
export const notePinSchema = z.strictObject({ pinned: z.boolean() });

export interface NoteItem {
  id: string;
  body: string;
  pinned: boolean;
  /** « Utilisateur supprimé » when the author's account is deleted (MOD-100): `null`. */
  authorName: string | null;
  createdAt: string;
  /** Set when the text was changed after its creation. */
  editedAt: string | null;
  /** Only the author changes his note (BO-055). */
  canEdit: boolean;
  /** The author, or a role holding `note.moderate`. */
  canDelete: boolean;
}

// ─── Timeline (BO-050) ──────────────────────────────────────────────────────

/** `RECORD`: a change of the record itself (catalogue objects, partners — packages 3.4 to 3.6). */
export const TIMELINE_TYPES = ['EMAIL', 'MESSAGE', 'CALL', 'NOTE', 'DOCUMENT', 'STAGE', 'PROPERTY', 'FINANCING', 'ACTIVITY', 'LEAD', 'SYSTEM', 'RECORD'] as const;
export type TimelineType = (typeof TIMELINE_TYPES)[number];

export interface AdminTimelineEntry {
  /** Stable across pages: `{source}:{id}`. */
  id: string;
  type: TimelineType;
  /** What happened, as a code the screen translates (`ui.admin-shell.timeline.event.{code}`). */
  code: string;
  /** Values of the sentence (references, labels already rendered by the server, enum values). */
  params: Record<string, string | number | null>;
  /** The author: a staff member's name, `null` for « Automatique »; `client` when the person did it herself. */
  author: { kind: 'STAFF' | 'CLIENT' | 'SYSTEM'; name: string | null };
  at: string;
  /** Unfoldable detail (the text of a note, the subject of an e-mail…), absent when there is none. */
  detail: string | null;
  /** The entry belongs to a pinned note (shown first). */
  pinned?: boolean;
  /** Present for a note: what the reader may do with it. */
  note?: Pick<NoteItem, 'id' | 'canEdit' | 'canDelete' | 'editedAt'>;
  /** Present for a call, a WhatsApp exchange or a meeting noted by hand (CRM-030, CRM-031): its facts, and what the reader may do (MOD-400). */
  exchange?: {
    id: string;
    channel: 'CALL' | 'WHATSAPP' | 'MEETING' | 'SMS';
    direction: 'OUTBOUND' | 'INBOUND';
    outcome: string | null;
    durationMinutes: number | null;
    /** Its author, within 24 hours. */
    canEdit: boolean;
    canDelete: boolean;
  };
  /** Present for an e-mail: where it stands, and whether the reader may still cancel a scheduled one (COM-020). */
  email?: {
    id: string;
    direction: 'OUTBOUND' | 'INBOUND';
    /** Written by hand by a member of the team (COM-020), or noted as received (COM-030). */
    manual: boolean;
    /** ISO instant of a sending planned for later that has not left yet. */
    scheduledFor: string | null;
    /** Stable code of why it did not leave or was not delivered. */
    failureReason: string | null;
    canCancel: boolean;
  };
}

export interface AdminTimelinePage {
  data: AdminTimelineEntry[];
  meta: { nextCursor: string | null };
}
