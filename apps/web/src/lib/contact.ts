// Display helpers for contact settings (contact.*, D-045). Links keep the E.164 value.

/** +33123456789 → +33 1 23 45 67 89 ; other numbers are grouped by two after the country code. */
export function formatPhone(e164: string): string {
  const fr = e164.match(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (fr) return `+33 ${fr[1]} ${fr[2]} ${fr[3]} ${fr[4]} ${fr[5]}`;
  const dz = e164.match(/^\+213(\d{3})(\d{2})(\d{2})(\d{2})$/);
  if (dz) return `+213 ${dz[1]} ${dz[2]} ${dz[3]} ${dz[4]}`;
  return e164;
}

export function whatsappHref(e164: string): string {
  return `https://wa.me/${e164.replace(/^\+/, '')}`;
}
