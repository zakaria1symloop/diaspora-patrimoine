// Package 3.8 « Tâches et rendez-vous » (EA-30, EA-31 — 04-back-office/09) — wire contracts of the tasks, the agenda
// and the appointments of the back office, and of the client's appointments (EC-14). One schema per request, used by
// the browser AND the API (ARC-030). Texts never travel: codes and values, translated by the screens (API-002).
import { z } from 'zod';
import type { AppointmentStatus, AppointmentType, Priority, TaskType } from './enums.js';

export const TASK_TYPES = ['CALL', 'FOLLOW_UP', 'DOC_REVIEW', 'BANK_FOLLOW_UP', 'VISIT', 'MEETING', 'CONTENT', 'OTHER'] as const;
export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const REMINDER_KINDS = ['NONE', 'AT_DUE', 'BEFORE_15M', 'BEFORE_1H', 'BEFORE_1D', 'CUSTOM'] as const;
export const APPOINTMENT_TYPES = ['CALL', 'VISIO', 'PROPERTY_VISIT', 'OFFICE_MEETING'] as const;
export const APPOINTMENT_STATUSES = ['REQUESTED', 'CONFIRMED', 'DONE', 'NO_SHOW', 'CANCELLED'] as const;

// ─── Tasks (EA-30) ──────────────────────────────────────────────────────────

/** TAC-002 — origin views: « Mes tâches » (default) · « À prendre » · « En retard » · « Terminées » (30 days) · « Toute l'équipe ». */
export const TASK_VIEWS = ['mine', 'to-take', 'late', 'done', 'team'] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

/** TAC-001 — the groups of the open tasks, computed by the server in the reader's time zone. */
export const TASK_GROUPS = ['OVERDUE', 'TODAY', 'TOMORROW', 'WEEK', 'LATER', 'NONE', 'CLOSED'] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number];

/** What a task is attached to (TAC-001 « Rattachée à »): its kind, a label, and the address of its page when it has one. */
export interface TaskAttachment {
  kind: 'DOSSIER' | 'CLIENT' | 'LEAD' | 'APPOINTMENT' | 'PROPERTY' | 'PROMOTER' | 'EVENT' | 'SUBMISSION' | 'BANK' | 'RESERVATION' | 'FEEDBACK';
  label: string;
  /** Path in the back office; the screen links it only when that page is delivered. */
  path: string | null;
}

/** BO-047 — false: forbidden by the role (absent); a reason: impossible in this state (greyed). */
export type TaskAbility = boolean | { reason: string };

export interface TaskItem {
  id: string;
  version: number;
  title: string;
  type: TaskType;
  priority: Priority;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  dueAt: string | null;
  dueHasTime: boolean;
  group: TaskGroup;
  overdue: boolean;
  attachments: TaskAttachment[];
  assignee: { id: string; name: string | null } | null;
  mine: boolean;
  origin: 'MANUAL' | 'WORKFLOW' | 'SYSTEM';
  /** TAC-006 — « Automatique » and the name of the rule. */
  ruleName: string | null;
  /** The template the action « Écrire » proposes (TAC-005), when the send window exists. */
  suggestedTemplateCode: string | null;
  completedAt: string | null;
  /** Closed by itself (AUT-035): « Terminée automatiquement : {raison} ». */
  closedAutomatically: boolean;
  completionNote: string | null;
  cancelReason: string | null;
  createdAt: string;
  can: { complete: TaskAbility; edit: TaskAbility; reassign: TaskAbility; cancel: TaskAbility; reopen: TaskAbility; take: TaskAbility };
}

export interface TaskList {
  data: TaskItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  views: Record<TaskView, number>;
  facets: { type: Record<string, number>; priority: Record<string, number>; origin: Record<string, number> };
  agents: { id: string; name: string }[];
}

export interface TaskDetail extends TaskItem {
  description: string | null;
  reminderKind: (typeof REMINDER_KINDS)[number];
  remindAt: string | null;
  createdBy: string | null;
  completedBy: string | null;
  links: { dossierId: string | null; clientId: string | null; leadId: string | null; appointmentId: string | null };
}

const csv = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(values as unknown as [T, ...T[]])).max(values.length));
const ids = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').filter(Boolean) : []))
  .pipe(z.array(z.union([z.uuid(), z.literal('none')])).max(50));
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE');
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'INVALID_DATE');

export const TASK_SORTS = ['due', '-due', 'priority', '-priority', 'createdAt', '-createdAt'] as const;

/** `GET /admin/tasks` — TAC-001, TAC-002 (API-010 … API-012). An unknown parameter is refused (400). */
export const taskListQuerySchema = z.strictObject({
  view: z.enum(TASK_VIEWS).optional(),
  q: z.string().trim().max(120).optional(),
  type: csv(TASK_TYPES),
  priority: csv(TASK_PRIORITIES),
  origin: csv(['MANUAL', 'AUTOMATIC']),
  assigneeId: ids,
  /** Period of the due date. */
  due: csv(['OVERDUE', 'TODAY', 'TOMORROW', 'WEEK', 'LATER', 'NONE']),
  dossierId: z.uuid().optional(),
  clientId: z.uuid().optional(),
  leadId: z.uuid().optional(),
  sort: z.enum(TASK_SORTS).default('due'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .refine((n) => [25, 50, 100].includes(n))
    .default(50),
});

const blankNull = (v: unknown) => (v === '' || v === undefined ? null : v);

/** TAC-003 — create a task (`task.manage`). `assignee`: `me` (default), a colleague's id, or `team` (« L'équipe »). */
export const taskCreateSchema = z
  .strictObject({
    title: z.string().trim().min(1, 'REQUIRED').max(160),
    type: z.enum(TASK_TYPES).default('FOLLOW_UP'),
    priority: z.enum(TASK_PRIORITIES).default('NORMAL'),
    dueDate: z.preprocess(blankNull, day.nullable()).default(null),
    dueTime: z.preprocess(blankNull, hm.nullable()).default(null),
    reminderKind: z.enum(REMINDER_KINDS).default('AT_DUE'),
    /** A chosen reminder (`CUSTOM`): ISO instant. */
    remindAt: z.preprocess(blankNull, z.iso.datetime({ offset: true }).nullable()).default(null),
    assignee: z.union([z.literal('me'), z.literal('team'), z.uuid()]).default('me'),
    description: z.preprocess(blankNull, z.string().trim().max(2000).nullable()).default(null),
    links: z.strictObject({ dossierId: z.uuid().nullable().default(null), clientId: z.uuid().nullable().default(null), leadId: z.uuid().nullable().default(null) }).default({ dossierId: null, clientId: null, leadId: null }),
  })
  .superRefine((v, ctx) => {
    if (v.dueTime && !v.dueDate) ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'REQUIRED' });
    if (v.reminderKind === 'CUSTOM' && !v.remindAt) ctx.addIssue({ code: 'custom', path: ['remindAt'], message: 'REQUIRED' });
    // TAC-003 — « 15 minutes » and « 1 heure avant » only for a due date with hour; without due date, « Aucun » or a date.
    if ((v.reminderKind === 'BEFORE_15M' || v.reminderKind === 'BEFORE_1H') && !v.dueTime) ctx.addIssue({ code: 'custom', path: ['reminderKind'], message: 'INVALID_CHOICE' });
    if (!v.dueDate && !['NONE', 'CUSTOM'].includes(v.reminderKind)) ctx.addIssue({ code: 'custom', path: ['reminderKind'], message: 'INVALID_CHOICE' });
  });
export type TaskCreate = z.input<typeof taskCreateSchema>;

/** `PATCH /admin/tasks/{id}` — the fields of TAC-003, with the version read. */
export const taskUpdateSchema = z.strictObject({
  version: z.number().int().min(1),
  title: z.string().trim().min(1, 'REQUIRED').max(160).optional(),
  type: z.enum(TASK_TYPES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.preprocess(blankNull, day.nullable()).optional(),
  dueTime: z.preprocess(blankNull, hm.nullable()).optional(),
  reminderKind: z.enum(REMINDER_KINDS).optional(),
  remindAt: z.preprocess(blankNull, z.iso.datetime({ offset: true }).nullable()).optional(),
  description: z.preprocess(blankNull, z.string().trim().max(2000).nullable()).optional(),
});
export type TaskUpdate = z.input<typeof taskUpdateSchema>;

/** TAC-005 « Reporter »: tomorrow · in 3 days · next Monday · a date. The hour and `dueHasTime` are kept. */
export const taskPostponeSchema = z.strictObject({ to: z.union([z.enum(['TOMORROW', 'IN_3_DAYS', 'NEXT_WEEK']), day]) });
export const taskCompleteSchema = z.strictObject({ note: z.preprocess(blankNull, z.string().trim().max(1000).nullable()).default(null) });
export const taskCancelSchema = z.strictObject({ reason: z.preprocess(blankNull, z.string().trim().max(300).nullable()).default(null) });
/** TAC-005 « Réaffecter » — a colleague, or `null` for the team. */
export const taskAssignSchema = z.strictObject({ assigneeId: z.uuid().nullable() });
/** BO-035 — bulk actions, line by line under the rights of TAC-004. */
export const taskBulkSchema = z.strictObject({
  action: z.enum(['complete', 'cancel', 'assign']),
  ids: z.array(z.uuid()).min(1).max(100),
  assigneeId: z.uuid().nullable().optional(),
});
export interface TaskBulkResult {
  done: number;
  refused: { id: string; reason: string }[];
}

// ─── Appointments and agenda (EA-31) ────────────────────────────────────────

/** TAC-046 — views of the list of appointments. */
export const APPOINTMENT_VIEWS = ['to-confirm', 'upcoming', 'to-report', 'past'] as const;
export type AppointmentView = (typeof APPOINTMENT_VIEWS)[number];

export interface AppointmentItem {
  id: string;
  version: number;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: string | null;
  endsAt: string | null;
  /** The client's zone (`Appointment.timezone`) and the place's (`placeTimezone`, visit or meeting on site). */
  clientTimezone: string;
  placeTimezone: string | null;
  client: { id: string; name: string | null };
  dossier: { id: string; reference: string } | null;
  property: { id: string; title: string; reference: string } | null;
  candidateId: string | null;
  staff: { id: string; name: string | null } | null;
  location: string | null;
  meetingUrl: string | null;
  host: { name: string | null; phone: string | null };
  onBehalf: string | null;
  clientNote: string | null;
  internalNote: string | null;
  outcomeNote: string | null;
  cancelReason: string | null;
  cancelledBy: 'CLIENT' | 'STAFF' | 'SYSTEM' | null;
  /** CYC-080 — an e-mail informed the client; without it neither reminder nor cancellation e-mail leave. */
  clientNotified: boolean;
  requestedSlots: { date: string; slot: string }[];
  can: { confirm: TaskAbility; reschedule: TaskAbility; cancel: TaskAbility; done: TaskAbility; noShow: TaskAbility; correct: TaskAbility; edit: TaskAbility };
}

export interface AppointmentList {
  data: AppointmentItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  views: Record<AppointmentView, number>;
}

export const appointmentListQuerySchema = z.strictObject({
  view: z.enum(APPOINTMENT_VIEWS).optional(),
  staffUserId: ids,
  type: csv(APPOINTMENT_TYPES),
  dossierId: z.uuid().optional(),
  clientId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .refine((n) => [25, 50, 100].includes(n))
    .default(25),
});

/** TAC-035 — `GET /admin/agenda?from=&to=&staff=` — one or several colleagues (several: overlay of an administrator). */
export const agendaQuerySchema = z.strictObject({
  from: day,
  to: day,
  staff: ids,
});
export interface AgendaTask {
  id: string;
  title: string;
  dueAt: string;
  dueHasTime: boolean;
  priority: Priority;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  staffId: string | null;
}
export interface AgendaCafe {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  staffId: string | null;
}
export interface Agenda {
  from: string;
  to: string;
  timeZone: string;
  staff: { id: string; name: string; me: boolean }[];
  appointments: AppointmentItem[];
  tasks: AgendaTask[];
  cafes: AgendaCafe[];
  /** May the reader overlay colleagues (TAC-035: an administrator). */
  canOverlay: boolean;
}

/** TAC-040 — the client picked in the window, with his live dossiers and their considered properties (for a visit). */
export interface AppointmentClientPick {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  dossiers: { id: string; reference: string; status: string; candidates: { id: string; title: string; reference: string; countryTimezone: string | null }[] }[];
  /** PRO-040 — the trusted people who may visit on his behalf. */
  contacts: { id: string; name: string }[];
}

/** TAC-043 — warnings while typing, never blocking. */
export interface AppointmentWarnings {
  overlap: { startsAt: string; endsAt: string } | null;
  outsideHours: boolean;
  /** The local hour at the client's, when before 8:00 or after 21:00 (a call or a visio). */
  clientHour: string | null;
}

/** TAC-040, TAC-044 — create an appointment (`appointment.manage`). Date and hour are in `zone` (the place's, or mine). */
export const appointmentCreateSchema = z
  .strictObject({
    clientId: z.uuid({ error: 'REQUIRED' }),
    dossierId: z.uuid().nullable().default(null),
    candidateId: z.uuid().nullable().default(null),
    type: z.enum(APPOINTMENT_TYPES),
    date: day,
    time: hm,
    durationMinutes: z.number().int().min(5).max(600).default(30),
    /** The zone the date and hour are typed in: for a visit or an on-site meeting, the place's; otherwise the adviser's. */
    zone: z.string().min(1).max(64),
    staffUserId: z.uuid().nullable().default(null),
    location: z.preprocess(blankNull, z.string().trim().max(200).nullable()).default(null),
    meetingUrl: z.preprocess(blankNull, z.url().max(400).nullable()).default(null),
    onBehalfContactId: z.uuid().nullable().default(null),
    hostName: z.preprocess(blankNull, z.string().trim().max(160).nullable()).default(null),
    hostPhone: z.preprocess(blankNull, z.string().trim().max(20).nullable()).default(null),
    clientNote: z.preprocess(blankNull, z.string().trim().max(1000).nullable()).default(null),
    internalNote: z.preprocess(blankNull, z.string().trim().max(1000).nullable()).default(null),
    notifyClient: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'PROPERTY_VISIT' && !v.candidateId) ctx.addIssue({ code: 'custom', path: ['candidateId'], message: 'REQUIRED' });
  });
export type AppointmentCreate = z.input<typeof appointmentCreateSchema>;

export const appointmentUpdateSchema = z.strictObject({
  version: z.number().int().min(1),
  location: z.preprocess(blankNull, z.string().trim().max(200).nullable()).optional(),
  meetingUrl: z.preprocess(blankNull, z.url().max(400).nullable()).optional(),
  hostName: z.preprocess(blankNull, z.string().trim().max(160).nullable()).optional(),
  hostPhone: z.preprocess(blankNull, z.string().trim().max(20).nullable()).optional(),
  clientNote: z.preprocess(blankNull, z.string().trim().max(1000).nullable()).optional(),
  internalNote: z.preprocess(blankNull, z.string().trim().max(1000).nullable()).optional(),
});
/** TAC-041 — confirm a request of the client: one of his wishes, or another slot. */
export const appointmentConfirmSchema = z.strictObject({
  date: day,
  time: hm,
  durationMinutes: z.number().int().min(5).max(600).default(30),
  zone: z.string().min(1).max(64),
  location: z.preprocess(blankNull, z.string().trim().max(200).nullable()).default(null),
  meetingUrl: z.preprocess(blankNull, z.url().max(400).nullable()).default(null),
});
/** TAC-042 « Déplacer ». */
export const appointmentRescheduleSchema = z.strictObject({ date: day, time: hm, durationMinutes: z.number().int().min(5).max(600).optional(), zone: z.string().min(1).max(64) });
/** TAC-042 « Annuler » (and the refusal of a request, TAC-041: the word to the client is then required). */
export const appointmentCancelSchema = z.strictObject({
  reason: z.preprocess(blankNull, z.string().trim().max(300).nullable()).default(null),
  clientWord: z.preprocess(blankNull, z.string().trim().max(1000).nullable()).default(null),
  notifyClient: z.boolean().default(true),
});
export const appointmentDoneSchema = z.strictObject({ outcomeNote: z.preprocess(blankNull, z.string().trim().max(1000).nullable()).default(null) });
/** TAC-042 « Corriger l'issue » — within 7 days, reason required. */
export const appointmentCorrectSchema = z.strictObject({ to: z.enum(['DONE', 'NO_SHOW', 'CANCELLED']), reason: z.string().trim().min(1, 'REQUIRED').max(300) });

// ─── The client's appointments (EC-14, INT-041 … INT-044) ───────────────────

export interface ClientAppointment {
  id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: string | null;
  endsAt: string | null;
  /** TRV-031 — for a visit on site, the place's zone first; otherwise the client's, then the adviser's. */
  placeTimezone: string | null;
  clientTimezone: string;
  advisorTimezone: string | null;
  advisor: { firstName: string; lastInitial: string | null } | null;
  property: { title: string; reference: string } | null;
  location: string | null;
  meetingUrl: string | null;
  host: { name: string; phone: string | null } | null;
  visitor: string | null;
  requestedSlots: { date: string; slot: string }[];
  cancelledBy: 'CLIENT' | 'STAFF' | 'SYSTEM' | null;
  cancelReason: string | null;
  /** INT-042 — until the start time. */
  canCancel: boolean;
  /** « Ajouter à mon agenda » (`.ics`) for a confirmed one. */
  calendarPath: string | null;
}
export interface ClientAppointments {
  upcoming: ClientAppointment[];
  past: ClientAppointment[];
}
export const clientAppointmentCancelSchema = z.strictObject({ reason: z.preprocess(blankNull, z.string().trim().max(300).nullable()).default(null) });
