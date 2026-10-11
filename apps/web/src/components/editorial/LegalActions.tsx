'use client';
// EDI-061 — « Gérer mes cookies » reopens the consent choice (NAV-050, CookieConsent listens to `dp:consent-open`);
// the rights link leads a signed-in client to his space (PRO-050, EC-53), anyone else to /contact.
import Link from 'next/link';
import { buttonClass, ButtonInner } from '@dp/ui';
import { useClientSession } from '@/lib/session-client';

export function ManageCookies({ label }: { label: string }) {
  return (
    <button type="button" className={buttonClass('secondary', 'M')} onClick={() => window.dispatchEvent(new Event('dp:consent-open'))}>
      <ButtonInner size="M">{label}</ButtonInner>
    </button>
  );
}

export function RightsLinks({ space, contact }: { space: string; contact: string }) {
  const session = useClientSession();
  const signedIn = session.status === 'authenticated';
  return (
    <Link href={signedIn ? '/espace-client/profil/confidentialite' : '/contact'} className={buttonClass('secondary', 'M')}>
      <ButtonInner chevron size="M">
        {signedIn ? space : contact}
      </ButtonInner>
    </Link>
  );
}
