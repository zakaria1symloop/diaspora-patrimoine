// AUTH-004, AUTH-020, SIM-032, SIM-034, MOD-371 — what a browser did anonymously (`dp_anon`) moves to the account.
// Exposed for the other modules: the simulators keep writing under `dp_anon`; identity calls these at sign-up, at the
// verification of the address and at sign-in.
import { Cookies } from '@dp/contracts';
import type { Request } from 'express';
import type { Tx } from '../platform/tx.js';

/** The anonymous id of this browser (`dp_anon`, 32 hex), read from the cookie — never from a body (AUTH-001). */
export function anonymousIdOf(req: Request): string | null {
  const v = (req.cookies as Record<string, unknown> | undefined)?.[Cookies.anon];
  return typeof v === 'string' && /^[0-9a-f]{32}$/.test(v) ? v : null;
}

/** SIM-034 — account creation: every anonymous simulation of this browser joins the client record. */
export async function attachAnonymousSimulations(tx: Tx, clientId: string, anonymousId: string | null, now: Date): Promise<number> {
  if (!anonymousId) return 0;
  const done = await tx.simulation.updateMany({ where: { anonymousId, clientId: null }, data: { clientId, updatedAt: now } });
  return done.count;
}

/**
 * SIM-032, AUTH-020 — « Enregistrer » then sign-in: only the simulation asked for joins, if it is still anonymous and
 * carries this browser's `dp_anon`; it becomes « saved ». `trustLink`: the id travelled in a verification link, which
 * proves the person (SIM-032 « même si le lien est ouvert sur un autre appareil »): no `dp_anon` check then.
 */
export async function attachSavedSimulation(
  tx: Tx,
  a: { clientId: string; simulationId: string | null | undefined; anonymousId: string | null; trustLink?: boolean; now: Date },
): Promise<boolean> {
  if (!a.simulationId) return false;
  if (!a.trustLink && !a.anonymousId) return false;
  const done = await tx.simulation.updateMany({
    where: { id: a.simulationId, clientId: null, ...(a.trustLink ? {} : { anonymousId: a.anonymousId }) },
    data: { clientId: a.clientId, isSaved: true, updatedAt: a.now },
  });
  if (done.count === 1) return true;
  // Already the client's (attached at sign-up with the other anonymous ones): it is still the one to save.
  const own = await tx.simulation.updateMany({ where: { id: a.simulationId, clientId: a.clientId }, data: { isSaved: true, updatedAt: a.now } });
  return own.count === 1;
}
