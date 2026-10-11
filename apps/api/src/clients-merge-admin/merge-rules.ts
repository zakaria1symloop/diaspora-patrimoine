// CRM-080 — the pure rules of a merge: which record is kept (rule 1), which value each field takes (rule 2), what
// protects the person (rule 4: always wins), which consent counts (the most recent line of each type). No I/O.
import type { MergeField, MergeValueKind } from '@dp/contracts';

export interface MergeSide {
  id: string;
  createdAt: Date;
  hasAccount: boolean;
  gdprErasedAt: Date | null;
  mergedIntoId: string | null;
  deletedAt: Date | null;
}

/** Rule 1 — the record with an account; none: the administrator's choice, the oldest by default; both: refused. */
export function keptRecord(a: MergeSide, b: MergeSide, chosen?: string | null): { keepId: string; rule: 'ACCOUNT' | 'CHOSEN' } | { refusal: 'BOTH_ACCOUNTS' } {
  if (a.hasAccount && b.hasAccount) return { refusal: 'BOTH_ACCOUNTS' };
  if (a.hasAccount) return { keepId: a.id, rule: 'ACCOUNT' };
  if (b.hasAccount) return { keepId: b.id, rule: 'ACCOUNT' };
  if (chosen === a.id || chosen === b.id) return { keepId: chosen, rule: 'CHOSEN' };
  return { keepId: a.createdAt.getTime() <= b.createdAt.getTime() ? a.id : b.id, rule: 'CHOSEN' };
}

/** A field (or a group of columns) of rule 2. `columns[0]` decides whether a side « has a value ». */
export interface FieldGroup {
  key: string;
  columns: string[];
  kind: MergeValueKind;
  enumName?: string;
  sensitive?: boolean;
}

export const MERGE_FIELDS: FieldGroup[] = [
  { key: 'firstName', columns: ['firstName'], kind: 'text' },
  { key: 'lastName', columns: ['lastName'], kind: 'text' },
  { key: 'phone', columns: ['phone', 'whatsappOptIn'], kind: 'text' },
  { key: 'countryOfResidence', columns: ['countryOfResidence'], kind: 'country' },
  { key: 'cityOfResidence', columns: ['cityOfResidence'], kind: 'text' },
  { key: 'nationalities', columns: ['nationalities'], kind: 'countries' },
  { key: 'timezone', columns: ['timezone'], kind: 'text' },
  { key: 'preferredContactChannel', columns: ['preferredContactChannel'], kind: 'enum', enumName: 'ContactChannel' },
  { key: 'preferredContactSlot', columns: ['preferredContactSlot'], kind: 'enum', enumName: 'ContactTimeSlot' },
  { key: 'residencyStatus', columns: ['residencyStatus'], kind: 'enum', enumName: 'ResidencyStatus' },
  { key: 'birthDate', columns: ['birthDate'], kind: 'date', sensitive: true },
  { key: 'employmentType', columns: ['employmentType'], kind: 'enum', enumName: 'EmploymentType', sensitive: true },
  { key: 'profession', columns: ['profession'], kind: 'text', sensitive: true },
  { key: 'employerName', columns: ['employerName'], kind: 'text', sensitive: true },
  { key: 'employedSince', columns: ['employedSince'], kind: 'date', sensitive: true },
  { key: 'income', columns: ['monthlyIncome', 'otherMonthlyIncome', 'monthlyDebts', 'incomeCurrency'], kind: 'money', sensitive: true },
  { key: 'downPayment', columns: ['downPayment', 'downPaymentCurrency'], kind: 'money', sensitive: true },
  { key: 'budgetMax', columns: ['budgetMax', 'budgetCurrency'], kind: 'money' },
  { key: 'budgetMonthly', columns: ['budgetMonthly', 'budgetMonthlyCurrency'], kind: 'money' },
  { key: 'purchaseTimeframe', columns: ['purchaseTimeframe'], kind: 'enum', enumName: 'PurchaseTimeframe' },
  { key: 'financingPreference', columns: ['financingPreference'], kind: 'enum', enumName: 'FinancingPreference' },
  { key: 'purchasePurpose', columns: ['purchasePurpose'], kind: 'enum', enumName: 'PurchasePurpose' },
  { key: 'minRooms', columns: ['minRooms'], kind: 'text' },
  { key: 'preferredRegionIds', columns: ['preferredRegionIds'], kind: 'regions' },
  { key: 'preferredTypes', columns: ['preferredTypes'], kind: 'types' },
  { key: 'source', columns: ['source'], kind: 'enum', enumName: 'LeadSource' },
];

type Row = Record<string, unknown>;

export const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const norm = (v: unknown): unknown => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v && 'toFixed' in v) return (v as { toFixed(n: number): string }).toFixed(2);
  if (Array.isArray(v)) return [...v].map(String).sort();
  if (typeof v === 'string') return v.trim().toLocaleLowerCase('fr').normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return v;
};

/** The shown value of a group on one side. */
export function shownValue(g: FieldGroup, row: Row): unknown {
  if (g.kind === 'money') {
    const amounts = g.columns.slice(0, -1).map((c) => row[c]);
    const currency = row[g.columns[g.columns.length - 1]!] as string | null;
    if (amounts.every(isEmpty)) return null;
    return g.key === 'income'
      ? { amounts: amounts.map((a) => (isEmpty(a) ? null : norm(a))), currency }
      : { amount: norm(amounts[0]), currency };
  }
  const v = row[g.columns[0]!];
  if (isEmpty(v)) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v && 'toFixed' in v) return (v as { toFixed(n: number): string }).toFixed(2);
  return v;
}

/** Rule 2 for every group: both values, whether they differ, the default side. */
export function mergeFields(keep: Row, other: Row, canSensitive: boolean): MergeField[] {
  return MERGE_FIELDS.map((g) => {
    const k = shownValue(g, keep);
    const o = shownValue(g, other);
    const differs = k !== null && o !== null && JSON.stringify(normShown(k)) !== JSON.stringify(normShown(o));
    const field: MergeField = { key: g.key, kind: g.kind, ...(g.enumName ? { enumName: g.enumName } : {}), keep: k, other: o, differs, defaultSide: k !== null ? 'KEEP' : 'OTHER' };
    if (g.sensitive && !canSensitive) return { ...field, keep: null, other: null, differs: false, withheld: true };
    return field;
  });
}

function normShown(v: unknown): unknown {
  if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.entries(v as Row).map(([k, x]) => [k, norm(x)]));
  return norm(v);
}

/** The columns the kept record receives (rule 2): for each group, the chosen side's columns. */
export function resolvedColumns(keep: Row, other: Row, choices: Record<string, 'KEEP' | 'OTHER'>): Row {
  const out: Row = {};
  for (const g of MERGE_FIELDS) {
    const hasKeep = shownValue(g, keep) !== null;
    const hasOther = shownValue(g, other) !== null;
    const side = hasKeep && hasOther ? (choices[g.key] ?? 'KEEP') : hasKeep ? 'KEEP' : 'OTHER';
    const from = side === 'KEEP' ? keep : other;
    for (const c of g.columns) out[c] = from[c];
  }
  return out;
}

/** Rule 4 — what protects the person wins, whatever was chosen. */
export function protections(keep: Row, other: Row, finalEmail: string | null): Row {
  const dnc = keep.doNotContact ? keep : other.doNotContact ? other : null;
  const restricted = keep.restrictedAt ? keep : other.restrictedAt ? other : null;
  const bounced = [keep, other].find((r) => r.emailBouncedAt && r.email && finalEmail && String(r.email).toLowerCase() === finalEmail.toLowerCase()) ?? null;
  return {
    doNotContact: Boolean(dnc),
    doNotContactReason: dnc ? dnc.doNotContactReason : null,
    doNotContactAt: dnc ? dnc.doNotContactAt : null,
    restrictedAt: restricted ? restricted.restrictedAt : null,
    restrictionReason: restricted ? restricted.restrictionReason : null,
    phoneCheckNeeded: Boolean(keep.phoneCheckNeeded || other.phoneCheckNeeded),
    emailBouncedAt: bounced ? bounced.emailBouncedAt : null,
  };
}

/** For each consent type, the most recent line of the two records counts (a recent withdrawal beats an old agreement). */
export function latestConsents<T extends { type: string; givenAt: Date; granted: boolean }>(rows: readonly T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const r of rows) {
    const cur = out.get(r.type);
    if (!cur || r.givenAt.getTime() > cur.givenAt.getTime()) out.set(r.type, r);
  }
  return out;
}
