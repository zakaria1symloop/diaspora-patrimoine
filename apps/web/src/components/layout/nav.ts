// NAV-010, NAV-011, NAV-014 — main entries, their destination, icon, and which paths make them current.
import type { IconName } from '@dp/ui';
import type { MessageKey } from '@dp/i18n';

export interface NavEntry {
  href: string;
  label: MessageKey;
  icon: IconName;
  match: RegExp;
  cafe?: boolean;
}

export const mainNav: NavEntry[] = [
  { href: '/programmes', label: 'ui.nav.header.properties', icon: 'home', match: /^\/(programmes|biens|comparer)(\/|$)/ },
  { href: '/promoteurs', label: 'ui.nav.header.promoters', icon: 'building', match: /^\/promoteurs(\/|$)/ },
  { href: '/financements', label: 'ui.nav.header.financing', icon: 'coins', match: /^\/financements(\/|$)/ },
  { href: '/le-cafe', label: 'ui.nav.header.cafe', icon: 'cafe-cup', match: /^\/le-cafe(\/|$)/, cafe: true },
  { href: '/notre-concept', label: 'ui.nav.header.concept', icon: 'bulb', match: /^\/notre-concept(\/|$)/ },
  { href: '/nos-partenaires', label: 'ui.nav.header.partners', icon: 'partners', match: /^\/nos-partenaires(\/|$)/ },
];

/** NAV-014 — phone menu order. */
export const mobileNav: { href: string; label: MessageKey; icon: IconName; cafe?: boolean }[] = [
  { href: '/programmes', icon: 'home', label: 'ui.nav.header.properties' },
  { href: '/promoteurs', icon: 'building', label: 'ui.nav.header.promoters' },
  { href: '/financements', icon: 'coins', label: 'ui.nav.header.financing' },
  { href: '/le-cafe', icon: 'cafe-cup', label: 'ui.nav.header.cafe', cafe: true },
  { href: '/notre-concept', icon: 'bulb', label: 'ui.nav.header.concept' },
  { href: '/nos-partenaires', icon: 'partners', label: 'ui.nav.header.partners' },
  { href: '/faq', icon: 'chat', label: 'ui.nav.header.faq' },
  { href: '/contact', icon: 'mail', label: 'ui.nav.header.contact' },
];
