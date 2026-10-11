// TAC-001 — the group of a task in the reader's time zone (pure: also read by the menu counter of the shell, TAC-007).
import type { TaskGroup } from '@dp/contracts';
import { addDays, localDay } from '../automation/timing.js';

/** TAC-001 — the group of a task in a time zone. A due date without hour is late only the day after (TAC-003). */
export function groupOf(t: { status: string; dueAt: Date | null; dueHasTime: boolean }, now: Date, timeZone: string): TaskGroup {
  if (t.status !== 'OPEN') return 'CLOSED';
  if (!t.dueAt) return 'NONE';
  const today = localDay(now, timeZone);
  const day = localDay(t.dueAt, timeZone);
  if (t.dueHasTime ? t.dueAt.getTime() < now.getTime() : day < today) return 'OVERDUE';
  if (day === today) return 'TODAY';
  if (day === addDays(today, 1)) return 'TOMORROW';
  // « Cette semaine »: until Sunday of the current ISO week.
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
  return day <= addDays(today, 7 - weekday) ? 'WEEK' : 'LATER';
}
