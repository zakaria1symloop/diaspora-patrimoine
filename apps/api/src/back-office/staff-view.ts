// ROL-014, ROL-015, ROL-018, ROL-019, SEC-031 … SEC-033 — how the caller of a back-office route may READ: his permissions
// (the matrix of @dp/contracts, with the settings that open a grant), his perimeter (an adviser in `ASSIGNED_ONLY`),
// the masking of the SUPPORT role and the sensitive fields. One place, used by every read of the back office: the
// object filter is applied IN THE QUERY (SEC-031), the masking by the server (SEC-032) — a masked value never leaves.
import { Injectable } from '@nestjs/common';
import { grantOf, roleHasPermission, type Permission, type StaffRole } from '@dp/contracts';
import type { AuthContext } from '../identity/sessions.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { SettingsService } from '../platform/settings.service.js';

export interface StaffView {
  userId: string;
  role: StaffRole;
  has(permission: Permission): boolean;
  /** ROL-014 — an adviser limited to what is assigned to him (plus unassigned requests). */
  scoped: boolean;
  /** ROL-015 — SUPPORT: personal data and free text masked. */
  masked: boolean;
  /** ROL-019 — `client.sensitive.read`. */
  sensitive: boolean;
}

@Injectable()
export class StaffViews {
  constructor(private readonly settings: SettingsService) {}

  async of(auth: AuthContext): Promise<StaffView> {
    const all = (await this.settings.all()) as unknown as Record<string, unknown>;
    const role = auth.role as StaffRole;
    const has = (p: Permission) => roleHasPermission(role, p, (key) => all[key] === true);
    return {
      userId: auth.userId,
      role,
      has,
      scoped: role === 'AGENT' && all['access.agentScope'] === 'ASSIGNED_ONLY',
      masked: grantOf(role, 'lead.read') === 'masked',
      sensitive: has('client.sensitive.read'),
    };
  }
}

/** ROL-018 — a request assigned to the adviser, or to nobody. */
export function leadScope(view: StaffView): Prisma.LeadWhereInput {
  return view.scoped ? { OR: [{ assignedAgentId: view.userId }, { assignedAgentId: null }] } : {};
}

/** ROL-018 — a dossier he is the adviser of. */
export function dossierScope(view: StaffView): Prisma.DossierWhereInput {
  return view.scoped ? { assignedAgentId: view.userId } : {};
}

/** ROL-018 — a client he is the referent of, or whose dossier or request he follows. */
export function clientScope(view: StaffView): Prisma.ClientWhereInput {
  return view.scoped
    ? { OR: [{ assignedAgentId: view.userId }, { dossiers: { some: { assignedAgentId: view.userId, deletedAt: null } } }, { leads: { some: { assignedAgentId: view.userId } } }] }
    : {};
}

// ─── Names ──────────────────────────────────────────────────────────────────

/** A staff member as the team reads him: « Prénom Nom »; null for a deleted account (« Utilisateur supprimé », MOD-100). */
export function staffName(u: { firstName: string | null; lastName: string | null; status?: string } | null | undefined): string | null {
  if (!u || u.status === 'DELETED') return null;
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || null;
}

/** A client in a list of the back office: « NOM Prénom » (BO-030). */
export function clientName(c: { firstName: string | null; lastName: string | null } | null | undefined): string | null {
  if (!c) return null;
  const last = c.lastName ? c.lastName.toLocaleUpperCase('fr') : null;
  return [last, c.firstName].filter(Boolean).join(' ') || null;
}

// ─── SEC-032 — the masked forms of the SUPPORT role ─────────────────────────

const DOTS = '•••••';

/** `N••••• B•••••` — the initial of each part. */
export function maskName(first: string | null | undefined, last: string | null | undefined): string | null {
  const parts = [last, first].filter((p): p is string => Boolean(p && p.trim()));
  if (!parts.length) return null;
  return parts.map((p) => `${p.trim().charAt(0).toLocaleUpperCase('fr')}${DOTS}`).join(' ');
}

/** `n•••@•••.fr`. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at < 1) return '•••';
  const tld = email.slice(email.lastIndexOf('.') + 1);
  return `${email.charAt(0).toLowerCase()}•••@•••.${tld.toLowerCase()}`;
}

/** `+33 • •• •• •• 78` — the country code and the last two digits. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '•••';
  const cc = phone.startsWith('+') ? `+${digits.slice(0, digits.length > 11 ? 3 : 2)}` : '';
  return `${cc} • •• •• •• ${digits.slice(-2)}`.trim();
}

// ─── SEC-033 — sensitive values of a request (ROL-019); SEC-032 for the SUPPORT role ──

/** Keys of `Lead.payload.fields`, of `step2` and of the supplements that are sensitive: down payment, comfortable instalment, income, debts. */
export const LEAD_SENSITIVE_FIELDS = new Set([
  'downPayment',
  'downPaymentCurrency',
  'monthlyBudget',
  'comfortableMonthly',
  'monthlyIncome',
  'otherMonthlyIncome',
  'monthlyDebts',
  'incomeCurrency',
  'employmentType',
  'employerName',
  'employedSince',
  'profession',
  'birthDate',
]);

/** The person's identity and coordinates: shown apart from the other fields (and masked for SUPPORT). */
export const LEAD_PERSON_FIELDS = new Set(['firstName', 'lastName', 'email', 'phone']);
/** Free text of a form (SEC-032 « Texte libre »): `message` has its own place on the screen. */
export const LEAD_FREE_TEXT_FIELDS = new Set(['message']);
/** Technical keys never shown as a field: consent proofs (read on the client record), tokens, the trap field. */
export const LEAD_HIDDEN_FIELDS = new Set(['consentContact', 'consentKey', 'marketingOptIn', 'marketingKey', 'createAccount', 'assistantConversationId', 'completionToken', 'challengeToken', 'simulationId', 'homepageUrl', 'accountHint', 'token']);
/**
 * SEC-032 — what a SUPPORT account still reads of a form: states, types, dates and choices. Every other value (names,
 * coordinates, city, amounts, company, free text) is replaced by `•••` — an unknown key is masked by default.
 */
export const LEAD_SUPPORT_READABLE_FIELDS = new Set([
  'whatsappOptIn',
  'countryOfResidence',
  'country',
  'preferredChannel',
  'residencyStatus',
  'purchaseTimeframe',
  'budgetKind',
  'financingPreference',
  'preferredCallbackDate',
  'preferredSlot',
  'wantsVideoVisit',
  'subject',
  'regionSlug',
  'requesterKind',
  'kind',
  'type',
  'propertyOutcome',
]);
