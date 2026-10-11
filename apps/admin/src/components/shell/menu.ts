// BO-011, BO-012, BO-030, ROL-023 — ONE definition of what the frame of the back office leads to: the side menu, the
// « + Créer » menu, the types of the global search and the addresses of each object. An entry appears only when the
// role holds its permission AND its screen is delivered (`delivered: true`): at each delivery the menu shows only what
// exists — nothing leads to a function that is not delivered (plan, § 2 point 9).
//
// A module that delivers its screen: sets `delivered: true` on its entry (the address below is the agreed one — the
// e-mails and the notifications of the API already use it), adds its create action to `CREATE_ACTIONS` and, when the
// object has a page, its type to `OBJECT_PATHS`.
import type { AdminBadges, Permission, SearchType } from '@dp/contracts';
import type { MessageKey } from '@dp/i18n';
import type { IconName } from '@dp/ui';

export interface MenuEntry {
  key: string;
  label: MessageKey;
  href: string;
  icon: IconName;
  /** ROL-023 — the read permission of the module; null: open to every role (the dashboard). Several: any of them. */
  permission: Permission | Permission[] | null;
  delivered: boolean;
  /** BO-011 — a counter of `AdminShell.badges` carried by the entry. */
  badge?: keyof AdminBadges;
}

export interface MenuGroup {
  key: string;
  /** null: no heading (the dashboard). */
  label: MessageKey | null;
  entries: MenuEntry[];
}

const e = (key: string, href: string, icon: IconName, permission: MenuEntry['permission'], delivered = false, badge?: keyof AdminBadges): MenuEntry => ({
  key,
  label: `ui.admin-shell.menu.${key}` as MessageKey,
  href,
  icon,
  permission,
  delivered,
  ...(badge ? { badge } : {}),
});

export const ADMIN_MENU: MenuGroup[] = [
  { key: 'home', label: null, entries: [e('dashboard', '/tableau-de-bord', 'home', null)] },
  {
    key: 'crm',
    label: 'ui.admin-shell.menu.group.crm',
    entries: [e('leads', '/demandes', 'mail', 'lead.read', true, 'leadsToTake'), e('clients', '/clients', 'user', 'client.read', true)],
  },
  {
    key: 'dossiers',
    label: 'ui.admin-shell.menu.group.dossiers',
    entries: [e('pipeline', '/dossiers/pipeline', 'sliders', 'dossier.read'), e('dossiers', '/dossiers', 'folder', 'dossier.read', true)],
  },
  {
    key: 'organisation',
    label: 'ui.admin-shell.menu.group.organisation',
    entries: [e('tasks', '/taches', 'check', 'task.read', true, 'overdueTasks'), e('agenda', '/agenda', 'calendar', 'appointment.read', true)],
  },
  {
    key: 'catalogue',
    label: 'ui.admin-shell.menu.group.catalogue',
    entries: [
      e('programs', '/catalogue/programmes', 'building', 'catalogue.read', true),
      e('properties', '/catalogue/biens', 'key', 'catalogue.read', true),
      e('media', '/catalogue/medias', 'camera', 'catalogue.read', true),
      e('lotImport', '/catalogue/import', 'upload', 'catalogue.import', true),
      e('featured', '/catalogue/mise-en-avant', 'star', 'catalogue.read', true),
      e('promoters', '/promoteurs', 'partners', 'promoter.read', true),
      e('partners', '/partenaires', 'badge', 'content.manage', true),
    ],
  },
  {
    key: 'financing',
    label: 'ui.admin-shell.menu.group.financing',
    entries: [
      e('submissions', '/soumissions', 'send', 'submission.read'),
      e('banks', '/banques', 'bank', 'bank.read'),
      e('exchangeRates', '/taux-de-change', 'coins', 'settings.read'),
      e('referenceFinancing', '/financement-de-reference', 'scale', 'settings.read'),
      e('projections', '/projections', 'calculator', 'simulation.read'),
    ],
  },
  {
    key: 'documents',
    label: 'ui.admin-shell.menu.group.documents',
    entries: [e('documentsReview', '/pieces/a-verifier', 'eye', 'document.read'), e('documentsSearch', '/pieces', 'file', 'document.read'), e('checklists', '/pieces/modeles', 'copy', 'checklist.manage')],
  },
  {
    key: 'communication',
    label: 'ui.admin-shell.menu.group.communication',
    entries: [
      e('messaging', '/messagerie', 'chat', 'message.read'),
      e('sendings', '/envois', 'mail', 'communication.read'),
      e('bulk', '/envois/groupe', 'send', 'email.bulk'),
      e('templates', '/modeles', 'edit', 'template.manage'),
      e('automations', '/automatisations', 'sparkles', 'workflow.manage'),
    ],
  },
  { key: 'cafe', label: 'ui.admin-shell.menu.group.cafe', entries: [e('cafes', '/cafes', 'cafe-cup', 'event.read')] },
  {
    key: 'satisfaction',
    label: 'ui.admin-shell.menu.group.satisfaction',
    entries: [e('feedback', '/retours', 'heart', 'feedback.read'), e('surveys', '/enquetes', 'star', 'survey.manage')],
  },
  {
    key: 'content',
    label: 'ui.admin-shell.menu.group.content',
    entries: [
      e('siteTexts', '/contenus/textes', 'edit', 'content.manage'),
      e('pages', '/contenus/pages', 'file', 'content.manage'),
      e('faq', '/contenus/faq', 'info', 'content.manage'),
      e('testimonials', '/contenus/temoignages', 'chat', 'content.manage'),
      e('legalTexts', '/contenus/textes-legaux', 'scale', 'content.manage'),
      e('redirects', '/contenus/redirections', 'external-link', 'content.manage'),
    ],
  },
  { key: 'steering', label: 'ui.admin-shell.menu.group.steering', entries: [e('reports', '/rapports', 'surface', 'report.read')] },
  {
    key: 'administration',
    label: 'ui.admin-shell.menu.group.administration',
    entries: [
      e('team', '/equipe', 'partners', 'user.read', true),
      e('settings', '/parametres', 'sliders', 'settings.read'),
      e('referentials', '/referentiels', 'globe', 'settings.read'),
      e('audit', '/journal', 'shield', 'audit.read'),
      e('personalData', '/donnees-personnelles', 'lock', 'gdpr.manage'),
      e('trash', '/corbeille', 'trash', 'trash.manage'),
      e('importsExports', '/imports-exports', 'download', ['catalogue.import', 'client.export', 'dossier.export', 'registration.export', 'report.export', 'audit.export']),
      e('diagnostics', '/diagnostic', 'bulb', 'support.diagnostics'),
    ],
  },
];

const holds = (permissions: readonly Permission[], wanted: MenuEntry['permission']) =>
  wanted === null || (Array.isArray(wanted) ? wanted.some((p) => permissions.includes(p)) : permissions.includes(wanted));

/** The menu of a role: delivered entries it may open; empty groups are left out. */
export function menuFor(permissions: readonly Permission[]): MenuGroup[] {
  return ADMIN_MENU.map((g) => ({ ...g, entries: g.entries.filter((x) => x.delivered && holds(permissions, x.permission)) })).filter((g) => g.entries.length > 0);
}

/** BO-011 — the landing page: the first entry of the menu the role can open; « Mes préférences » when it has none. */
export function landingPath(permissions: readonly Permission[]): string {
  return menuFor(permissions)[0]?.entries[0]?.href ?? '/preferences';
}

// ─── « + Créer » (BO-012) ───────────────────────────────────────────────────

export interface CreateAction {
  key: string;
  label: MessageKey;
  icon: IconName;
  permission: Permission;
  href: string;
  delivered: boolean;
}

/** Demande · Client · Dossier · Tâche · Rendez-vous · Programme · Bien · Café — each appears with its form. */
export const CREATE_ACTIONS: CreateAction[] = [
  { key: 'lead', label: 'ui.admin-shell.create.lead', icon: 'mail', permission: 'lead.create', href: '/demandes/nouvelle', delivered: true },
  { key: 'client', label: 'ui.admin-shell.create.client', icon: 'user', permission: 'client.create', href: '/clients/nouveau', delivered: true },
  { key: 'dossier', label: 'ui.admin-shell.create.dossier', icon: 'folder', permission: 'dossier.create', href: '/dossiers/nouveau', delivered: true },
  { key: 'task', label: 'ui.admin-shell.create.task', icon: 'check', permission: 'task.manage', href: '/taches?nouvelle=1', delivered: true },
  { key: 'appointment', label: 'ui.admin-shell.create.appointment', icon: 'calendar', permission: 'appointment.manage', href: '/agenda?nouveau=1', delivered: true },
  { key: 'program', label: 'ui.admin-shell.create.program', icon: 'building', permission: 'catalogue.write', href: '/catalogue/programmes/nouveau', delivered: true },
  { key: 'property', label: 'ui.admin-shell.create.property', icon: 'key', permission: 'catalogue.write', href: '/catalogue/biens/nouveau', delivered: true },
  { key: 'cafe', label: 'ui.admin-shell.create.cafe', icon: 'cafe-cup', permission: 'event.manage', href: '/cafes/nouveau', delivered: false },
];

export function createActionsFor(permissions: readonly Permission[]): CreateAction[] {
  return CREATE_ACTIONS.filter((a) => a.delivered && permissions.includes(a.permission));
}

// ─── Addresses of the objects (search results, notifications) ───────────────

/**
 * The page of an object, by the type of the global search (BO-030). A type appears in the search — and a notification
 * becomes a link — only when its page is delivered here. `list` is where « Voir tous les résultats » leads, with `q`.
 */
export const OBJECT_PATHS: Partial<Record<SearchType, { page: (key: string) => string; list: string; icon: IconName }>> = {
  LEAD: { page: (reference) => `/demandes/${reference.toLowerCase()}`, list: '/demandes', icon: 'mail' },
  CLIENT: { page: (id) => `/clients/${id}`, list: '/clients', icon: 'user' },
  DOSSIER: { page: (reference) => `/dossiers/${reference.toLowerCase()}`, list: '/dossiers', icon: 'folder' },
  PROGRAM: { page: (id) => `/catalogue/programmes/${id}`, list: '/catalogue/programmes', icon: 'building' },
  PROPERTY: { page: (id) => `/catalogue/biens/${id}`, list: '/catalogue/biens', icon: 'key' },
  PROMOTER: { page: (id) => `/promoteurs/${id}`, list: '/promoteurs', icon: 'partners' },
};

/** Types the search may show to this role now. */
export function searchTypes(): SearchType[] {
  return Object.keys(OBJECT_PATHS) as SearchType[];
}

/** True when an internal path leads to a delivered screen (a notification is a link only then). */
export function isDeliveredPath(path: string): boolean {
  const clean = path.split(/[?#]/)[0] ?? '';
  if (clean === '/preferences' || clean.startsWith('/preferences/') || clean === '/notifications') return true;
  return ADMIN_MENU.some((g) => g.entries.some((x) => x.delivered && (clean === x.href || clean.startsWith(`${x.href}/`))));
}
