// IA-003 — the data sent to a model are reduced to what is needed; IA-013 — conversations are kept without identity.
// The visitor's text is masked before it is stored or sent: e-mail addresses, phone numbers, bank account numbers and
// any other long run of digits (identity card, passport, card number). The assistant never asks for them (IA-012); this
// covers a visitor who writes them anyway. Amounts stay (« 600 € par mois » is a criterion).
export const MASK = '[***]';

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu;
/** IBAN: two letters, two check digits, then 11 to 30 alphanumerics, spaces allowed every four. */
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/gi;
/** A phone number: optional +, then at least 8 digits with spaces, dots, dashes or brackets between them. */
const PHONE = /(?:\+|00)?\d(?:[\s.\-()]*\d){7,}/g;
/** A passport-like code: letters and at least 6 digits glued together. */
const DOCUMENT_NUMBER = /\b(?=[A-Z0-9]*\d{6})[A-Z]{1,3}\d{6,}\b/gi;

/** True when a run of digits reads as a criterion the visitor may give: an amount (« 150 000 », « 150000 € »), two years. */
function looksLikeAmount(match: string, after: string): boolean {
  if (/^(?:19|20)\d{2}[\s\-/]+(?:19|20)\d{2}$/.test(match.trim())) return true; // « 2027-2028 »: two years
  const digits = match.replace(/\D/g, '');
  if (digits.length > 9) return false;
  if (/^\s*(€|eur|euros?|da|dzd|dinars?|mad|dh|dirhams?|k\b|m\b|millions?|mille|\/\s*mois|par mois|m²|m2)/i.test(after)) return true;
  // « 150 000 » written with thousands separators: groups of three after the first group.
  return /^\d{1,3}(?:[ .  ]\d{3})+$/.test(match.trim()) && digits.length <= 9;
}

export function redactPersonalData(text: string): string {
  let out = text.replace(EMAIL, MASK).replace(IBAN, MASK).replace(DOCUMENT_NUMBER, MASK);
  out = out.replace(PHONE, (match, offset: number, whole: string) => (looksLikeAmount(match, whole.slice(offset + match.length)) ? match : MASK));
  return out;
}
