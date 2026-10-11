// ECL-001, ECL-006, NAV-013 — the menu of the client space: one definition for the side menu (computer), the five tabs
// and the « Plus » sheet (phone). An entry appears only if what it opens is delivered AND active (ECL-006): entries of
// screens delivered later (Rendez-vous EC-14: package 3.8; Mes Cafés EC-43, Mon avis EC-54: livraison 5) are absent.
// To plug a page: add (or un-hide) its entry here, with the spec's address — nothing else in the shell changes.
import type { IconName } from '@dp/ui';
import type { MessageKey } from '@dp/i18n';
import type { ClientSpaceSummary } from '@dp/contracts';

export interface MenuContext {
  summary: ClientSpaceSummary;
  features: { favorites: boolean; searchAlerts: boolean; cafe: boolean; callback: boolean };
}

export interface MenuEntry {
  key: string;
  label: MessageKey;
  icon: IconName;
  /** Destination (may depend on the dossiers). */
  href: (ctx: MenuContext) => string;
  /** Paths that make the entry current. */
  match: RegExp;
  visible: (ctx: MenuContext) => boolean;
  badge?: (ctx: MenuContext) => number;
  /** Sub-entries shown under it in the side menu (e.g. « Mes pièces » under « Mon dossier »). */
  children?: MenuEntry[];
}

export const SPACE_ROOT = '/espace-client';

/** The dossier the menu and the « Dossier » tab open: the one the dashboard shows (ECL-014), else the most recent. */
export function shownDossier(summary: ClientSpaceSummary) {
  return summary.dossiers.find((d) => d.reference === summary.shownDossierReference) ?? summary.dossiers[0] ?? null;
}

/** ECL-033 — one dossier: its page; several: the list. */
export function dossierHref(summary: ClientSpaceSummary): string {
  if (summary.dossiers.length > 1) return `${SPACE_ROOT}/dossiers`;
  const d = shownDossier(summary);
  return d ? dossierPath(d.reference) : SPACE_ROOT;
}

/** NAV-002 — addresses are lower case (the proxy redirects otherwise); the API accepts either case. */
export const dossierPath = (reference: string) => `${SPACE_ROOT}/dossiers/${encodeURIComponent(reference.toLowerCase())}`;
/** EC-20 (package 2.9) — the « Pièces » tab of a dossier (ECL-030). */
export const documentsPath = (reference: string) => `${dossierPath(reference)}/pieces`;

const always = () => true;

export const SPACE_MENU: MenuEntry[] = [
  { key: 'dashboard', label: 'ui.client.menu.dashboard', icon: 'home', href: () => SPACE_ROOT, match: /^\/espace-client$/, visible: always },
  {
    key: 'dossier',
    label: 'ui.client.menu.dossier',
    icon: 'folder',
    href: (c) => dossierHref(c.summary),
    match: /^\/espace-client\/dossiers(\/|$)/,
    visible: (c) => c.summary.dossiers.length > 0,
    children: [
      {
        // 2.9 — « Mes pièces » appears only on a dossier that has a list of documents.
        key: 'documents',
        label: 'ui.client.menu.documents',
        icon: 'file',
        href: (c) => documentsPath(shownDossier(c.summary)!.reference),
        match: /^\/espace-client\/dossiers\/[^/]+\/pieces(\/|$)/,
        visible: (c) => Boolean(shownDossier(c.summary)?.hasDocumentList),
      },
    ],
  },
  { key: 'interests', label: 'ui.client.menu.interests', icon: 'heart', href: () => `${SPACE_ROOT}/interets`, match: /^\/espace-client\/interets(\/|$)/, visible: always },
  {
    key: 'proposals',
    label: 'ui.client.menu.proposals',
    icon: 'sparkles',
    href: () => `${SPACE_ROOT}/biens-proposes`,
    match: /^\/espace-client\/biens-proposes(\/|$)/,
    visible: always,
    badge: (c) => c.summary.badges.proposals,
  },
  // D-096 — « Messages » from the first delivery of the space: before the messaging, its page is the form of MSG-021.
  { key: 'messages', label: 'ui.client.menu.messages', icon: 'chat', href: () => `${SPACE_ROOT}/messages`, match: /^\/espace-client\/messages(\/|$)/, visible: always },
  // Package 2.9 (EC-40), built in parallel.
  { key: 'simulations', label: 'ui.client.menu.simulations', icon: 'calculator', href: () => `${SPACE_ROOT}/simulations`, match: /^\/espace-client\/simulations(\/|$)/, visible: always },
  {
    key: 'favorites',
    label: 'ui.client.menu.favorites',
    icon: 'star',
    href: () => `${SPACE_ROOT}/favoris`,
    match: /^\/espace-client\/favoris(\/|$)/,
    visible: (c) => c.features.favorites,
  },
  {
    key: 'alerts',
    label: 'ui.client.menu.alerts',
    icon: 'bell',
    href: () => `${SPACE_ROOT}/alertes`,
    match: /^\/espace-client\/alertes(\/|$)/,
    visible: (c) => c.features.searchAlerts,
  },
  { key: 'profile', label: 'ui.client.menu.profile', icon: 'user', href: () => `${SPACE_ROOT}/profil`, match: /^\/espace-client\/profil(\/|$)/, visible: always },
];

/** The phone's five tabs: Accueil · Dossier · Biens · Messages · Plus (ECL-001). */
export interface PhoneTab {
  key: 'home' | 'dossier' | 'properties' | 'messages' | 'more';
  label: MessageKey;
  icon: IconName;
  href: ((ctx: MenuContext) => string) | null;
  match: RegExp;
  badge?: (ctx: MenuContext) => number;
}

export const PHONE_TABS: PhoneTab[] = [
  { key: 'home', label: 'ui.client.tabs.home', icon: 'home', href: () => SPACE_ROOT, match: /^\/espace-client$/ },
  // Without a dossier, « Dossier » leads to the dashboard.
  { key: 'dossier', label: 'ui.client.tabs.dossier', icon: 'folder', href: (c) => dossierHref(c.summary), match: /^\/espace-client\/dossiers(\/|$)/ },
  // « Biens » opens a page with two tabs, « Mes intérêts » then « Biens proposés »; its badge is EC-13's.
  {
    key: 'properties',
    label: 'ui.client.tabs.properties',
    icon: 'building',
    href: () => `${SPACE_ROOT}/interets`,
    match: /^\/espace-client\/(interets|biens-proposes)(\/|$)/,
    badge: (c) => c.summary.badges.proposals,
  },
  { key: 'messages', label: 'ui.client.tabs.messages', icon: 'chat', href: () => `${SPACE_ROOT}/messages`, match: /^\/espace-client\/messages(\/|$)/ },
  { key: 'more', label: 'ui.client.tabs.more', icon: 'menu', href: null, match: /^\/espace-client\/(simulations|favoris|alertes|profil)(\/|$)/ },
];

/** Entries listed in « Plus »: the side menu's others, in their order, with their badges (profile comes last). */
export const MORE_KEYS = ['simulations', 'favorites', 'alerts'];

export function visibleMenu(ctx: MenuContext): MenuEntry[] {
  return SPACE_MENU.filter((e) => e.visible(ctx)).map((e) => ({ ...e, children: e.children?.filter((c) => c.visible(ctx)) }));
}
