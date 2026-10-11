// SEC-080 — who performs a use case: a staff member of the session (package 1.6, `CurrentActor`), the system, or an
// anonymous visitor (a failed sign-in, ROL-050).
export interface Actor {
  type: 'USER' | 'SYSTEM' | 'ANONYMOUS';
  /** `User.id` of a staff member; `null` for SYSTEM. */
  userId: string | null;
  /** Effective role (SEC-080), `null` for SYSTEM. */
  role: string | null;
  /** Reason written on every audit row of the action (PAR-082: `demo`), unless the action gives its own. */
  reason: string | null;
}

export const SYSTEM_ACTOR: Actor = { type: 'SYSTEM', userId: null, role: null, reason: null };

/** PAR-082 — demonstration data: actor SYSTEM, reason `demo` on every row. */
export const DEMO_ACTOR: Actor = { type: 'SYSTEM', userId: null, role: null, reason: 'demo' };

/** `createdById` / `updatedById` columns. */
export function stampBy(actor: Actor): string | null {
  return actor.type === 'USER' ? actor.userId : null;
}
