// MOD-300, MOD-303 — what a request writes on the client record: only EMPTY fields are completed; a value already
// present is never overwritten (the advisor sees the difference in the request and decides). Amounts are completed only
// in the currency of their group: when the record already holds another currency for that group, the amount would
// have to be converted (CAL-010); this module does not convert — the amount stays in `Lead.payload` only (prudent
// reading of « sans cours, il n'est pas repris »). Pure.
export interface ClientFacts {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  whatsappOptIn?: boolean;
  countryOfResidence?: string | null;
  residencyStatus?: string | null;
  purchaseTimeframe?: string | null;
  financingPreference?: string | null;
  preferredContactChannel?: string | null;
  preferredContactSlot?: string | null;
  timezone?: string | null;
  /** DEM-011 budget: total → `budgetMax`, monthly → `budgetMonthly`. */
  budget?: { amount: string; currency: string; kind: 'TOTAL' | 'MONTHLY' } | null;
  /** DEM-013 projection. */
  downPayment?: { amount: string; currency: string } | null;
  monthlyBudget?: { amount: string; currency: string } | null;
  /** DEM-016 — income group of a simulation (revenus, autres revenus, charges), one currency. */
  income?: { monthlyIncome?: string | null; otherMonthlyIncome?: string | null; monthlyDebts?: string | null; currency: string } | null;
  regionId?: string | null;
  /** ASS-031 — the guided assistant: preferred regions and types, rooms, purpose of the purchase. */
  preferredRegionIds?: string[] | null;
  preferredTypes?: string[] | null;
  minRooms?: number | null;
  purchasePurpose?: string | null;
}

export interface ClientState {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  whatsappOptIn: boolean;
  countryOfResidence: string | null;
  residencyStatus: string | null;
  purchaseTimeframe: string | null;
  financingPreference: string | null;
  preferredContactChannel: string | null;
  preferredContactSlot: string | null;
  timezone: string | null;
  budgetMax: unknown;
  budgetCurrency: string | null;
  budgetMonthly: unknown;
  budgetMonthlyCurrency: string | null;
  downPayment: unknown;
  downPaymentCurrency: string | null;
  preferredRegionIds: string[];
  monthlyIncome?: unknown;
  otherMonthlyIncome?: unknown;
  monthlyDebts?: unknown;
  incomeCurrency?: string | null;
  preferredTypes?: string[];
  minRooms?: number | null;
  purchasePurpose?: string | null;
}

const empty = (v: unknown) => v === null || v === undefined || v === '';

/** Fields to write on an existing record (MOD-300), or the initial values of a new one (`current` null). */
export function completeClient(current: ClientState | null, facts: ClientFacts): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const fill = (field: keyof ClientState, value: unknown) => {
    if (empty(value)) return;
    if (current === null || empty(current[field])) out[field] = value;
  };
  fill('firstName', facts.firstName);
  fill('lastName', facts.lastName);
  if (!empty(facts.phone) && (current === null || empty(current.phone))) {
    out.phone = facts.phone;
    // The WhatsApp box speaks about THIS number: it follows the phone written now.
    if (facts.whatsappOptIn) out.whatsappOptIn = true;
  } else if (facts.whatsappOptIn && current && !current.whatsappOptIn && current.phone === facts.phone) {
    out.whatsappOptIn = true;
  }
  fill('countryOfResidence', facts.countryOfResidence);
  fill('residencyStatus', facts.residencyStatus);
  fill('purchaseTimeframe', facts.purchaseTimeframe);
  fill('financingPreference', facts.financingPreference);
  fill('preferredContactChannel', facts.preferredContactChannel);
  if (facts.preferredContactSlot !== 'ANYTIME') fill('preferredContactSlot', facts.preferredContactSlot);
  fill('timezone', facts.timezone);

  const money = (amountField: keyof ClientState, currencyField: keyof ClientState, m: { amount: string; currency: string } | null | undefined) => {
    if (!m) return;
    if (current !== null && !empty(current[amountField])) return;
    const groupCurrency = current?.[currencyField] as string | null | undefined;
    if (groupCurrency && groupCurrency !== m.currency) return; // MOD-303: never two currencies in one group.
    out[amountField] = m.amount;
    out[currencyField] = m.currency;
  };
  if (facts.budget) {
    if (facts.budget.kind === 'MONTHLY') money('budgetMonthly', 'budgetMonthlyCurrency', facts.budget);
    else money('budgetMax', 'budgetCurrency', facts.budget);
  }
  money('downPayment', 'downPaymentCurrency', facts.downPayment);
  money('budgetMonthly', 'budgetMonthlyCurrency', out.budgetMonthly ? null : facts.monthlyBudget);
  if (facts.income) {
    // MOD-303 — the income group has one currency: amounts in another one never complete it (converted upstream).
    const groupCurrency = current?.incomeCurrency ?? null;
    if (!groupCurrency || groupCurrency === facts.income.currency) {
      let wrote = false;
      for (const field of ['monthlyIncome', 'otherMonthlyIncome', 'monthlyDebts'] as const) {
        const value = facts.income[field];
        if (empty(value) || (current !== null && !empty(current[field]))) continue;
        out[field] = value;
        wrote = true;
      }
      if (wrote && !groupCurrency) out.incomeCurrency = facts.income.currency;
    }
  }
  if (facts.regionId && (current === null || current.preferredRegionIds.length === 0)) out.preferredRegionIds = [facts.regionId];
  // ASS-031 — the answers of the guided assistant complete the EMPTY preference fields only.
  if (facts.preferredRegionIds?.length && !out.preferredRegionIds && (current === null || current.preferredRegionIds.length === 0)) {
    out.preferredRegionIds = [...facts.preferredRegionIds];
  }
  if (facts.preferredTypes?.length && (current === null || !current.preferredTypes?.length)) out.preferredTypes = [...facts.preferredTypes];
  fill('minRooms', facts.minRooms);
  fill('purchasePurpose', facts.purchasePurpose);
  return out;
}

/** CYC-060 — client status: first true rule. */
export function clientStatus(input: {
  archivedAt: Date | null;
  qualifiedAt: Date | null;
  lastActivityAt: Date;
  dossiers: { status: string; stage: string }[];
  inactiveAfterDays: number;
  now: Date;
}): 'ARCHIVED' | 'CUSTOMER' | 'ACTIVE' | 'INACTIVE' | 'QUALIFIED' | 'PROSPECT' {
  const late = ['DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION'];
  const live = input.dossiers.filter((d) => d.status === 'OPEN' || d.status === 'ON_HOLD');
  if (input.archivedAt) return 'ARCHIVED';
  if (input.dossiers.some((d) => d.status === 'WON')) return 'CUSTOMER';
  if (live.some((d) => late.includes(d.stage))) return 'ACTIVE';
  if (live.length === 0 && input.now.getTime() - input.lastActivityAt.getTime() > input.inactiveAfterDays * 86_400_000) return 'INACTIVE';
  if (input.qualifiedAt) return 'QUALIFIED';
  return 'PROSPECT';
}
