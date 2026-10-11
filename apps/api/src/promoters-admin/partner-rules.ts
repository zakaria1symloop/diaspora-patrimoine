// AUT-073, AUT-079 — the rules of package 3.4, from the table of 01-domaine/08 § 5 (their triggers are the facts of the
// scheduled watch `partner.scan`, emitted only for an ACTIVE partner or a promoter with something to verify).
import type { RuleSeed } from '../automation/rule-seeds.js';

export const PARTNER_RULE_SEEDS: RuleSeed[] = [
  {
    code: 'R_CONVENTION_EXPIRING',
    name: 'Convention à renouveler',
    description: 'Tâche « Renouveler la convention de {partenaire} (échéance le {date}) », TEAM, échéance 10 jours ouvrés, clé convention:{type}:{id}.',
    trigger: 'partner.convention_expiring',
    conditions: null,
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'CREATE_TASK', title: 'Renouveler la convention de {{partner.name}} (échéance le {{event.data.expiresAt}})', assignee: 'TEAM', dueInBusinessDays: 10, dedupeKey: 'convention:{{event.data.ownerType}}:{{partner.id}}' }],
    sortOrder: 900,
  },
  {
    code: 'R_PARTNER_DOC_EXPIRING',
    name: 'Document de partenaire à renouveler',
    description: 'Tâche « Renouveler un document de {partenaire} : {libellé} (échéance le {date}) », TEAM, échéance 10 jours ouvrés, clé partner-doc:{id}.',
    trigger: 'partner.document_expiring',
    conditions: null,
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'CREATE_TASK', title: 'Renouveler un document de {{partner.name}} : {{partnerDocument.label}} (échéance le {{event.data.expiresAt}})', assignee: 'TEAM', dueInBusinessDays: 10, dedupeKey: 'partner-doc:{{partnerDocument.id}}' }],
    sortOrder: 910,
  },
  {
    code: 'R_STOCK_CHECK',
    name: 'Disponibilités à vérifier',
    description: 'Tâche « Vérifier les disponibilités avec {promoteur} : {n} programmes », CONTENT, TEAM, échéance 5 jours ouvrés, clé stock:{promoterId}, modèle proposé P_PROMOTER_STOCK_CHECK.',
    trigger: 'promoter.stock_check_due',
    conditions: null,
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'CREATE_TASK', title: 'Vérifier les disponibilités avec {{promoter.name}} : {{event.data.programCount}} programmes', taskType: 'CONTENT', assignee: 'TEAM', dueInBusinessDays: 5, dedupeKey: 'stock:{{promoter.id}}', suggestedTemplate: 'P_PROMOTER_STOCK_CHECK' }],
    sortOrder: 920,
  },
];
