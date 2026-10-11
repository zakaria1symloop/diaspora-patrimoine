// ROL-022, 00-cadre/02 § 4 — the staff permission matrix, hard-coded (no role editor in Phase 1) and tested (SEC-034).
// The server checks it on every route (ROL-020); the back office reads it to hide forbidden actions (ROL-023).
//
// Values: `true` (●) · `'scoped'` (◐ limited to the agent's perimeter: ROL-014, ROL-018, notes 1/3/5/6/9 of the matrix —
// the object filter applies it, SEC-031) · `'masked'` (◐² SUPPORT reads with personal data masked, ROL-015) ·
// `'own'` (◐⁷ every account but OWNER, ROL-011; ◐⁸ audit families Connexion and Système) ·
// `{ setting }` (◐⁴ granted when the boolean setting is true). Absent: refused (—).

export const StaffRole = { OWNER: 'OWNER', ADMIN: 'ADMIN', AGENT: 'AGENT', VIEWER: 'VIEWER', SUPPORT: 'SUPPORT' } as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];

export type Grant = true | 'scoped' | 'masked' | 'own' | { setting: string };
type Row = Partial<Record<StaffRole, Grant>>;

const ALL: Row = { OWNER: true, ADMIN: true, AGENT: true, VIEWER: true, SUPPORT: true };
const OA: Row = { OWNER: true, ADMIN: true };
const OAA: Row = { OWNER: true, ADMIN: true, AGENT: true };
const READ_SCOPED_MASKED: Row = { OWNER: true, ADMIN: true, AGENT: 'scoped', VIEWER: true, SUPPORT: 'masked' };

export const PERMISSIONS = {
  // 4.1 Demandes, clients, dossiers
  'lead.read': READ_SCOPED_MASKED,
  'lead.create': OAA,
  'lead.assign': { OWNER: true, ADMIN: true, AGENT: 'scoped' },
  'lead.process': OAA,
  'client.read': READ_SCOPED_MASKED,
  'client.sensitive.read': OAA,
  'client.create': OAA,
  'client.update': OAA,
  'client.assign': { OWNER: true, ADMIN: true, AGENT: 'scoped' },
  'client.invite': OAA,
  'client.account.manage': OA,
  'client.merge': OA,
  'client.archive': OA,
  'client.export': OA,
  'client.impersonate': OAA,
  'dossier.read': READ_SCOPED_MASKED,
  'dossier.create': OAA,
  'dossier.update': OAA,
  'dossier.assign': { OWNER: true, ADMIN: true, AGENT: 'scoped' },
  'dossier.transition': OAA,
  'dossier.transition.backward': OA,
  'dossier.close': OAA,
  'dossier.reopen': OA,
  'dossier.delete': OA,
  'dossier.export': OA,
  'dossier.commission.manage': OA,
  'candidate.manage': OAA,
  'reservation.manage': OAA,
  'reservation.override': OA,
  'note.read': { OWNER: true, ADMIN: true, AGENT: true, VIEWER: true },
  'note.manage': OAA,
  'note.moderate': OA,
  // 4.2 Pièces et financement
  'document.read': READ_SCOPED_MASKED,
  'document.file.read': { OWNER: true, ADMIN: true, AGENT: 'scoped' },
  'document.request': OAA,
  'document.upload': OAA,
  'document.validate': OAA,
  'document.waive': OAA,
  'document.delete': OA,
  'consent.record': OAA,
  'checklist.manage': OA,
  'submission.read': READ_SCOPED_MASKED,
  'submission.manage': OAA,
  'submission.share': OAA,
  'submission.decide': OAA,
  'simulation.read': { OWNER: true, ADMIN: true, AGENT: 'scoped', VIEWER: 'scoped' },
  'simulation.create': OAA,
  // 4.3 Catalogue et partenaires
  'catalogue.read': ALL,
  'catalogue.write': { OWNER: true, ADMIN: true, AGENT: { setting: 'access.agentCanEditCatalogue' } },
  'catalogue.publish': OA,
  'catalogue.eligibility.manage': OA,
  'catalogue.import': OA,
  'catalogue.delete': OA,
  'promoter.read': ALL,
  'promoter.write': OA,
  'promoter.delete': { OWNER: true },
  'partner.convention.manage': OA,
  'partner.access.manage': OA,
  'bank.read': ALL,
  'bank.write': OA,
  'bankproduct.write': OA,
  'bank.delete': { OWNER: true },
  // 4.4 Communication, tâches, événements
  'message.read': { OWNER: true, ADMIN: true, AGENT: 'scoped' },
  'message.send': OAA,
  'email.send': OAA,
  'email.bulk': OA,
  'communication.read': READ_SCOPED_MASKED,
  'communication.log': OAA,
  'template.manage': OA,
  'task.read': { OWNER: true, ADMIN: true, AGENT: 'scoped', VIEWER: true },
  'task.manage': OAA,
  'task.manage.all': OA,
  'appointment.read': { OWNER: true, ADMIN: true, AGENT: 'scoped', VIEWER: true },
  'appointment.manage': OAA,
  'view.share': OA,
  'event.read': { OWNER: true, ADMIN: true, AGENT: true, VIEWER: true, SUPPORT: 'masked' },
  'event.manage': OA,
  'registration.manage': OAA,
  'registration.export': OA,
  'feedback.read': { OWNER: true, ADMIN: true, AGENT: 'scoped', VIEWER: true },
  'feedback.manage': OAA,
  'survey.manage': OA,
  // 4.5 Contenus, pilotage, administration
  'content.manage': OA,
  'report.read': { OWNER: true, ADMIN: true, AGENT: 'scoped', VIEWER: true },
  'report.export': OA,
  'workflow.manage': OA,
  'settings.read': { OWNER: true, ADMIN: true, SUPPORT: true },
  'settings.manage': OA,
  'settings.sensitive.manage': { OWNER: true },
  'maintenance.manage': { OWNER: true, ADMIN: true, SUPPORT: true },
  'user.read': ALL,
  'user.manage': { OWNER: true, ADMIN: 'own' },
  'user.twofactor.reset': { OWNER: true },
  'support.elevate': { OWNER: true },
  'audit.read': { OWNER: true, ADMIN: true, SUPPORT: 'own' },
  'audit.export': { OWNER: true },
  'trash.manage': OA,
  'gdpr.manage': OA,
  'support.diagnostics': { OWNER: true, ADMIN: true, SUPPORT: true },
} as const satisfies Record<string, Row>;

export type Permission = keyof typeof PERMISSIONS;

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

/** The grant of a role for a permission (`undefined`: refused). */
export function grantOf(role: StaffRole, permission: Permission): Grant | undefined {
  return (PERMISSIONS[permission] as Row)[role];
}

/** True when the role holds the permission; a setting-dependent grant asks the caller for the setting's value. */
export function roleHasPermission(role: StaffRole, permission: Permission, setting: (key: string) => boolean = () => false): boolean {
  const g = grantOf(role, permission);
  if (g === undefined) return false;
  if (typeof g === 'object') return setting(g.setting);
  return true;
}

/** Every permission a role holds (for `GET /admin/me` and the menu of ROL-023). */
export function permissionsOf(role: StaffRole, setting: (key: string) => boolean = () => false): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => roleHasPermission(role, p, setting));
}
