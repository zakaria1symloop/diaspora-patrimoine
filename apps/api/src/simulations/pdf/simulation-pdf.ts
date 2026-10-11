// SIM-040, TRV-142 — PDF of a simulation: date, settings, result, schedule by year, compared scenarios, property reminder,
// the TRV-023 and TRV-024 notices, the acquisition-fees notice of an eligibility result (SIM-009), « barème indicatif »
// when it was used, and the contact details. One to three pages. Texts: namespace `sim` (and `enum`) of @dp/i18n.
import type { CreditInput, CreditResponse, EligibilityInput, EligibilityResult, Money, SimulatorProperty } from '@dp/contracts';
import { createTranslator, formatDate, formatMoney, type MessageKey } from '@dp/i18n';
import type { PdfBlock, PdfDocumentModel } from './pdf-renderer.js';

const t = createTranslator('fr');

export interface PdfCompany {
  companyName: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  monthlyFootnote: string;
  simulatorDisclaimer: string;
  feesExcludedNote: string;
}

// ─── Formats (TRV-020: Intl only) ───────────────────────────────────────────

export function amountText(m: Money | null | undefined, digits: 0 | 2 = 0, approx = false): string {
  if (!m) return t('ui.sim.pdf.none');
  const v = formatMoney(Number(m.amount), m.currency, 'fr-FR', digits);
  return approx ? `≈ ${v}` : v;
}

export function pctText(value: string | number): string {
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} %`;
}

/** A percentage without its sign, for the messages that write « {pct} % » (« 20 », « 2,5 »). */
export const pctNum = (value: string | number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value));

export const rateText = (bps: number) => pctText(bps / 100);

export function durationText(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return t('ui.sim.common.years', { n: years });
  if (years === 0) return t('ui.sim.common.months', { n: rest });
  return t('ui.sim.common.yearsAndMonths', { ans: t('ui.sim.common.years', { n: years }), mois: t('ui.sim.common.months', { n: rest }) });
}

const plain = (amount: string | undefined | null, currency: string, digits: 0 | 2 = 0) =>
  amount === undefined || amount === null ? t('ui.sim.pdf.none') : formatMoney(Number(amount), currency, 'fr-FR', digits);

function base(company: PdfCompany, title: string, reference: string | null, now: Date, timeZone: string): Omit<PdfDocumentModel, 'blocks' | 'notes'> {
  return {
    companyName: company.companyName,
    title,
    meta: [t('ui.sim.pdf.generated', { date: formatDate(now, 'long', timeZone) }), reference ? t('ui.sim.pdf.reference', { reference }) : t('ui.sim.pdf.notSaved')],
    footer: [company.legalName || company.companyName, company.address, company.phone, company.email].filter(Boolean),
    pageLabel: (n, total) => t('ui.sim.pdf.page', { n, total }),
  };
}

function propertyBlocks(p: SimulatorProperty | null): PdfBlock[] {
  if (!p) return [];
  return [
    { kind: 'heading', text: t('ui.sim.pdf.property') },
    { kind: 'paragraph', text: `${p.title} — ${p.cityRegion} (${p.reference})`, tone: 'strong' },
    ...(p.priceRef ? [{ kind: 'paragraph' as const, text: t('ui.sim.common.propertyPrice', { prix: amountText(p.priceRef) }) }] : []),
  ];
}

// ─── EP-11 ──────────────────────────────────────────────────────────────────

export function eligibilityPdfModel(a: {
  company: PdfCompany;
  input: EligibilityInput;
  result: EligibilityResult;
  reference: string | null;
  now: Date;
  timeZone: string;
  countryName: (code: string) => string;
  property: SimulatorProperty | null;
}): PdfDocumentModel {
  const { input: i, result: r } = a;
  const cur = i.incomeCurrency;
  const settings: [string, string][] = [
    [t('ui.sim.elig.fields.residencyStatus'), t(`ui.enum.ResidencyStatus.${i.residencyStatus}` as MessageKey)],
    [t('ui.sim.elig.fields.countryOfResidence'), a.countryName(i.countryOfResidence)],
    [t('ui.sim.elig.fields.propertyCountry'), a.countryName(i.propertyCountry)],
    [t('ui.sim.elig.fields.birthYear'), String(i.birthYear)],
    [t('ui.sim.elig.fields.income'), plain(i.monthlyIncome, cur)],
    ...(i.coBorrowerIncome ? [[t('ui.sim.elig.fields.coBorrowerIncome'), plain(i.coBorrowerIncome, cur)] as [string, string]] : []),
    ...(i.otherIncome ? [[t('ui.sim.elig.fields.otherIncome'), plain(i.otherIncome, cur)] as [string, string]] : []),
    [t('ui.sim.elig.fields.debts'), plain(i.monthlyDebts, cur)],
    [t('ui.sim.elig.fields.downPayment'), plain(i.downPayment, i.downPaymentCurrency)],
    [t('ui.sim.elig.fields.duration'), i.desiredDurationMonths ? durationText(i.desiredDurationMonths) : t('ui.sim.elig.fields.durationLongest')],
    [t('ui.sim.elig.fields.financingType'), t(`ui.sim.elig.financing.${i.financingPreference}` as MessageKey)],
    ...(r.target ? [[t('ui.sim.elig.fields.targetPrice'), amountText(r.target.price, 0, r.approx.target)] as [string, string]] : []),
  ];
  const ax = r.approx.figures;
  const blocks: PdfBlock[] = [...propertyBlocks(a.property), { kind: 'heading', text: t('ui.sim.pdf.settings') }, { kind: 'keyValues', rows: settings }];
  blocks.push({ kind: 'heading', text: t('ui.sim.pdf.result') });
  blocks.push({ kind: 'paragraph', text: t(`ui.sim.elig.titles.${r.status}` as MessageKey), tone: 'strong' });
  if (r.indicative) blocks.push({ kind: 'paragraph', text: t('ui.sim.common.indicativeBanner'), tone: 'notice' });
  if (r.missingTypeNote) blocks.push({ kind: 'paragraph', text: t(`ui.sim.elig.missingType.${r.missingTypeNote}` as MessageKey) });

  if (r.status === 'NOT_ELIGIBLE') {
    for (const sentence of [...new Set(r.reasons.map((x) => t(`ui.sim.elig.reasons.${x}` as MessageKey)))]) blocks.push({ kind: 'paragraph', text: sentence });
    blocks.push({ kind: 'paragraph', text: t('ui.sim.elig.notEligibleConclusion') });
  } else {
    const figures: { label: string; value: string; note?: string }[] = [];
    if (r.shown.maxBudget) {
      figures.push({
        label: t('ui.sim.elig.budget'),
        value: amountText(r.shown.maxBudget, 0, ax),
        note: r.feesIncluded && r.shown.fees && Number(r.shown.fees.amount) > 0
          ? t('ui.sim.elig.budgetDetailFees', { apport: amountText({ amount: i.downPayment, currency: i.downPaymentCurrency }), financement: amountText(r.shown.maxLoan, 0, ax), frais: amountText(r.shown.fees, 0, ax) })
          : t('ui.sim.elig.budgetDetail', { apport: amountText({ amount: i.downPayment, currency: i.downPaymentCurrency }), financement: amountText(r.shown.maxLoan, 0, ax) }),
      });
    }
    figures.push({ label: t('ui.sim.elig.capacity'), value: amountText(r.shown.capacity, 0, ax) });
    figures.push({ label: t('ui.sim.elig.maxMonthly'), value: t('ui.sim.common.monthly', { montant: amountText(r.maxMonthlyPayment, 2, ax) }) });
    if (r.durationMonths) {
      figures.push({
        label: t('ui.sim.elig.duration'),
        value: durationText(r.durationMonths),
        ...(r.durationNote ? { note: t(`ui.sim.elig.durationNotes.${r.durationNote}` as MessageKey) } : {}),
      });
    }
    blocks.push({ kind: 'figures', items: figures });
    if (r.shown.maxBudget) {
      blocks.push({
        kind: 'paragraph',
        text:
          r.limitingFactor === 'DOWN_PAYMENT'
            ? t('ui.sim.elig.limits.DOWN_PAYMENT', { pct: pctNum(r.minDownPaymentPct ?? 0), apport: amountText(r.advisedDownPayment, 0, ax), budget: amountText(r.shown.reachableBudget, 0, ax) })
            : t('ui.sim.elig.limits.INCOME'),
      });
      if (r.budgetMonthlyPayment) blocks.push({ kind: 'paragraph', text: t('ui.sim.elig.budgetMonthly', { montant: amountText(r.budgetMonthlyPayment, 2, ax) }) });
    } else if (r.advisedDownPayment) {
      blocks.push({
        kind: 'paragraph',
        text: t('ui.sim.elig.conditional', { pct: pctNum(r.minDownPaymentPct ?? 0), apport: amountText(r.advisedDownPayment, 0, ax), budget: amountText(r.shown.reachableBudget, 0, ax) }),
      });
    }
    if (r.target) blocks.push({ kind: 'paragraph', text: targetSentence(r), tone: 'strong' });
    const sol = r.solutions;
    const lines = (['CONVENTIONAL', 'ISLAMIC'] as const).filter((k) => (sol[k] ?? 0) > 0).map((k) => t(`ui.sim.elig.solutions.${k}`, { n: sol[k]! }));
    if (!r.indicative && lines.length) blocks.push({ kind: 'paragraph', text: lines.join(' · ') });
  }
  const notes = [a.company.monthlyFootnote, a.company.simulatorDisclaimer];
  if (r.status !== 'NOT_ELIGIBLE') notes.push(r.feesIncluded ? t('ui.sim.common.feesIncluded', { pct: pctNum(r.acquisitionFeesPct) }) : a.company.feesExcludedNote);
  if (r.rateDate) notes.push(t('ui.common.rateDate', { date: formatDate(`${r.rateDate}T12:00:00Z`, 'short', 'UTC') }));
  return { ...base(a.company, t('ui.sim.pdf.titleEligibility'), a.reference, a.now, a.timeZone), blocks, notes };
}

/** SIM-013 — the sentence of the « Votre bien » block (shared by the screen logic and the PDF). */
export function targetSentence(r: EligibilityResult): string {
  const tg = r.target!;
  const ax = r.approx.target;
  switch (tg.case) {
    case 'FINANCEABLE':
      return t('ui.sim.elig.target.FINANCEABLE', { montant: amountText(tg.monthlyPayment, 2, ax), duree: durationText(r.durationMonths ?? 0) });
    case 'DOWN_PAYMENT_SHORT':
      return tg.requiredMonthlyPayment
        ? t('ui.sim.elig.target.BOTH_SHORT', { montant: amountText(tg.missingDownPayment, 0, ax), x: amountText(tg.requiredMonthlyPayment, 2, ax), y: amountText(r.maxMonthlyPayment, 2, r.approx.figures) })
        : t('ui.sim.elig.target.DOWN_PAYMENT_SHORT', { montant: amountText(tg.missingDownPayment, 0, ax) });
    case 'PAYMENT_TOO_HIGH':
      return t('ui.sim.elig.target.PAYMENT_TOO_HIGH', { x: amountText(tg.requiredMonthlyPayment, 2, ax), y: amountText(r.maxMonthlyPayment, 2, r.approx.figures) });
    case 'AMOUNT_BELOW_MIN':
      return t('ui.sim.elig.target.AMOUNT_BELOW_MIN', { x: amountText(tg.loan, 0, ax) });
    default:
      return t(r.feesIncluded ? 'ui.sim.elig.target.NO_FINANCING_NEEDED_FEES' : 'ui.sim.elig.target.NO_FINANCING_NEEDED');
  }
}

// ─── EP-12 ──────────────────────────────────────────────────────────────────

export function creditProductLabel(p: { bankName: string | null; productName: string | null; ordinal: number; financingType: 'CONVENTIONAL' | 'ISLAMIC' } | null): string {
  if (!p) return t('ui.sim.common.indicativeLabel');
  if (p.bankName && p.productName) return t('ui.sim.credit.productName', { banque: p.bankName, produit: p.productName });
  return t(`ui.sim.credit.productOrdinal.${p.financingType}`, { n: p.ordinal });
}

export function creditPdfModel(a: {
  company: PdfCompany;
  scenarios: CreditInput[];
  activeIndex: number;
  response: CreditResponse;
  reference: string | null;
  now: Date;
  timeZone: string;
  productLabel: (id: string | null) => string;
  property: SimulatorProperty | null;
}): PdfDocumentModel {
  const i = a.scenarios[a.activeIndex]!;
  const r = a.response.scenarios[a.activeIndex]!;
  const islamic = r.financingType === 'ISLAMIC';
  const vocab = (k: 'rate' | 'interest' | 'creditCost') => t(`ui.sim.vocab.${islamic ? 'islamic' : 'conventional'}.${k}`);
  const ax = r.productCurrency !== null;
  const settings: [string, string][] = [
    [t('ui.sim.credit.mode'), t(`ui.enum.CreditMode.${i.mode}`)],
    ...(i.mode === 'FROM_PRICE'
      ? ([
          [t('ui.sim.credit.price'), plain(i.price, i.currency)],
          [t('ui.sim.credit.downPayment'), plain(i.downPayment ?? '0', i.currency)],
        ] as [string, string][])
      : []),
    [t('ui.sim.credit.amount'), r.amount ? amountText(r.amount, 2) : plain(i.amount, i.currency, 2)],
    [t('ui.sim.credit.duration'), durationText(r.durationMonths)],
    [t('ui.sim.credit.solution'), a.productLabel(i.bankProductId ?? null)],
    ...(r.annualRateBps !== null ? [[vocab('rate'), rateText(r.annualRateBps)] as [string, string]] : []),
    ...(i.insuranceRateBps ? [[t('ui.sim.credit.insurance'), rateText(i.insuranceRateBps)] as [string, string]] : []),
  ];
  const blocks: PdfBlock[] = [...propertyBlocks(a.property), { kind: 'heading', text: t('ui.sim.pdf.settings') }, { kind: 'keyValues', rows: settings }];
  blocks.push({ kind: 'heading', text: t('ui.sim.pdf.result') });
  if (!i.bankProductId) blocks.push({ kind: 'paragraph', text: t('ui.sim.common.indicativeBanner'), tone: 'notice' });
  if (r.nothingToFinance) {
    blocks.push({ kind: 'paragraph', text: t('ui.sim.credit.warnings.NOTHING'), tone: 'strong' });
  } else {
    if (r.productCurrency) blocks.push({ kind: 'paragraph', text: t('ui.sim.credit.productCurrency', { devise: r.productCurrency }), tone: 'muted' });
    blocks.push({
      kind: 'figures',
      items: [
        {
          label: t('ui.sim.credit.compare.monthly'),
          value: t('ui.sim.common.monthly', { montant: amountText(r.monthlyPayment, 2, ax) }),
          ...(r.monthlyInsurance && Number(r.monthlyInsurance.amount) > 0 ? { note: t('ui.sim.credit.monthlyWithInsurance', { total: amountText(r.monthlyTotal, 2, ax) }) } : {}),
        },
        { label: t('ui.sim.credit.totalCost'), value: amountText(r.totalCost, 2, ax) },
        { label: t('ui.sim.credit.totalRepaid'), value: amountText(r.totalRepaid, 2, ax) },
      ],
    });
    blocks.push({
      kind: 'keyValues',
      rows: [
        [t('ui.sim.credit.amountFinanced'), amountText(r.amount, 2, ax)],
        [vocab('creditCost'), amountText(r.totalInterest, 2, ax)],
        [t('ui.sim.credit.insuranceTotal'), amountText(r.totalInsurance, 2, ax)],
        ...(r.fees && Number(r.fees.amount) > 0 ? [[t('ui.sim.credit.fees'), amountText(r.fees, 2, ax)] as [string, string]] : []),
      ],
    });
    if (r.otherFeesNote) blocks.push({ kind: 'paragraph', text: r.otherFeesNote, tone: 'muted' });
    for (const w of r.warnings) blocks.push({ kind: 'paragraph', text: warningText(w, i.currency), tone: 'notice' });
    const c = (v: string) => formatMoney(Number(v), r.currency, 'fr-FR', 2);
    blocks.push({ kind: 'heading', text: t('ui.sim.pdf.schedule') });
    blocks.push({
      kind: 'table',
      headers: [t('ui.sim.credit.col.period'), t('ui.sim.credit.col.payments'), t('ui.sim.credit.col.principal'), vocab('interest'), t('ui.sim.credit.col.insurance'), t('ui.sim.credit.col.remaining')],
      align: ['left', 'right', 'right', 'right', 'right', 'right'],
      widths: [0.12, 0.18, 0.17, 0.17, 0.15, 0.21],
      rows: r.schedule.map((y) => [t('ui.sim.credit.year', { n: y.year }), c(y.payments), c(y.principal), c(y.interest), c(y.insurance), c(y.remaining)]),
    });
  }
  if (a.scenarios.length > 1) {
    const cmp = a.response.comparison;
    const cell = (k: number, f: (x: (typeof a.response.scenarios)[number]) => string) => {
      const x = a.response.scenarios[k]!;
      return x.nothingToFinance ? t('ui.sim.pdf.none') : f(x);
    };
    const mark = (k: number, which: 'm' | 'c') =>
      cmp && (which === 'm' ? cmp.lowestMonthlyIndex === k : cmp.lowestCostIndex === k) ? ` (${t(which === 'm' ? 'ui.sim.credit.compare.lowestMonthly' : 'ui.sim.credit.compare.lowestCost')})` : '';
    const cols = a.scenarios.map((_, k) => k);
    blocks.push({ kind: 'heading', text: t('ui.sim.pdf.scenarios') });
    blocks.push({
      kind: 'table',
      headers: ['', ...cols.map((k) => t('ui.sim.credit.compare.column', { n: k + 1 }))],
      align: ['left', ...cols.map(() => 'right' as const)],
      widths: [0.25, ...cols.map(() => 0.75 / cols.length)],
      rows: [
        [t('ui.sim.credit.compare.downPayment'), ...cols.map((k) => (a.scenarios[k]!.mode === 'FROM_PRICE' ? plain(a.scenarios[k]!.downPayment ?? '0', a.scenarios[k]!.currency) : t('ui.sim.pdf.none')))],
        [t('ui.sim.credit.compare.duration'), ...cols.map((k) => durationText(a.response.scenarios[k]!.durationMonths))],
        [t('ui.sim.credit.compare.rate'), ...cols.map((k) => cell(k, (x) => (x.annualRateBps === null ? t('ui.sim.pdf.none') : rateText(x.annualRateBps))))],
        [t('ui.sim.credit.compare.monthly'), ...cols.map((k) => cell(k, (x) => amountText(x.monthlyPayment, 2) + mark(k, 'm')))],
        [t('ui.sim.credit.compare.totalCost'), ...cols.map((k) => cell(k, (x) => amountText(x.totalCost, 2) + mark(k, 'c')))],
        [t('ui.sim.credit.compare.totalRepaid'), ...cols.map((k) => cell(k, (x) => amountText(x.totalRepaid, 2)))],
      ],
    });
  }
  const notes = [a.company.monthlyFootnote, a.company.simulatorDisclaimer];
  if (r.rateDate) notes.push(t('ui.common.rateDate', { date: formatDate(`${r.rateDate}T12:00:00Z`, 'short', 'UTC') }));
  return { ...base(a.company, t('ui.sim.pdf.titleCredit'), a.reference, a.now, a.timeZone), blocks, notes };
}

export function warningText(w: { code: string; params: Record<string, string | number> }, currency: string): string {
  const m = (v: string | number) => formatMoney(Number(v), currency, 'fr-FR', 0);
  switch (w.code) {
    case 'AMOUNT_OUT_OF_PRODUCT_BOUNDS':
      return t('ui.sim.credit.warnings.AMOUNT_OUT_OF_PRODUCT_BOUNDS', { min: m(w.params.min!), max: m(w.params.max!) });
    case 'DURATION_OUT_OF_PRODUCT_BOUNDS':
      return t('ui.sim.credit.warnings.DURATION_OUT_OF_PRODUCT_BOUNDS', { min: durationText(Number(w.params.min)), max: durationText(Number(w.params.max)) });
    default:
      return t('ui.sim.credit.warnings.DOWN_PAYMENT_BELOW_MIN', {
        pct: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(w.params.pct)),
        montant: m(w.params.amount!),
      });
  }
}
