// DEM-031 `DISPOSABLE_DOMAIN` — throwaway e-mail domains (« liste tenue à jour »). A small static list of the most
// common services; to be refreshed from a maintained source (e.g. the disposable-email-domains project) when the
// back office gets its reference-data screens. Lower case; a sub-domain of a listed domain matches too.
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  '33mail.com',
  'anonbox.net',
  'burnermail.io',
  'discard.email',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'fakemail.net',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxkitten.com',
  'jetable.org',
  'mail-temp.com',
  'mail.tm',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailinator.net',
  'mailnesia.com',
  'mintemail.com',
  'moakt.com',
  'mohmal.com',
  'mytemp.email',
  'nada.email',
  'sharklasers.com',
  'spam4.me',
  'spambox.us',
  'spamgourmet.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempinbox.com',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
]);

export function isDisposableDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  if (DISPOSABLE_DOMAINS.has(d)) return true;
  const parts = d.split('.');
  for (let i = 1; i < parts.length - 1; i++) if (DISPOSABLE_DOMAINS.has(parts.slice(i).join('.'))) return true;
  return false;
}
