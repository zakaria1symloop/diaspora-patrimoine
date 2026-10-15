// 08-automatisations § 5.8 — the rules fed by the scheduled task `catalogue.nightly` (AUT-074, AUT-078) and by a listing
// error reported from a public page (DEM-018). Each task carries the key that names it: the same fact, emitted again the
// next night, does not open a second task while the first is open.
import type { RuleSeed } from '../automation/rule-seeds.js';

const eq = (field: string, value: string | number | boolean) => ({ field, op: 'eq' as const, value });

export const CATALOGUE_RULE_SEEDS: RuleSeed[] = [
  {
    code: 'R_LISTING_ERROR',
    name: 'Erreur signalée sur une fiche',
    description: 'Tâche « Vérifier la fiche {bien} : erreur signalée », description « {ce qui est inexact} : {précision} », CONTENT, TEAM, échéance 2 jours ouvrés, clé listing-error:{feedbackId}.',
    trigger: 'feedback.received',
    conditions: { all: [eq('feedback.kind', 'LISTING_ERROR')] },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'CREATE_TASK', title: 'Vérifier la fiche {{event.data.label}} : erreur signalée', description: '{{event.data.kindLabel}} : {{feedback.comment}}', taskType: 'CONTENT', assignee: 'TEAM', dueInBusinessDays: 2, dedupeKey: 'listing-error:{{feedback.id}}' }],
    sortOrder: 940,
  },
  {
    code: 'R_DELIVERY_OVERDUE',
    name: 'Livraison dépassée',
    description: 'Tâche « Mettre à jour la livraison de {programme ou bien} », CONTENT, TEAM, échéance 5 jours ouvrés, clé delivery:{id}.',
    trigger: 'program.delivery_overdue',
    conditions: null,
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'CREATE_TASK', title: 'Mettre à jour la livraison de {{event.data.label}}', taskType: 'CONTENT', assignee: 'TEAM', dueInBusinessDays: 5, dedupeKey: 'delivery:{{event.data.id}}' }],
    sortOrder: 950,
  },
  {
    code: 'R_PROGRAM_SOLD_OUT',
    name: 'Programme entièrement vendu',
    description: 'Notifier les administrateurs. Tâche « Programme {nom} entièrement vendu depuis 6 mois : l’archiver ? », CONTENT, TEAM, clé program-sold:{id}.',
    trigger: 'program.sold_out_review',
    conditions: null,
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [
      { type: 'CREATE_TASK', title: 'Programme {{event.data.label}} entièrement vendu depuis 6 mois : l’archiver ?', taskType: 'CONTENT', assignee: 'TEAM', dedupeKey: 'program-sold:{{event.data.id}}' },
      { type: 'NOTIFY_STAFF', recipients: 'ADMINS', title: 'Programme {{event.data.label}} entièrement vendu depuis 6 mois : l’archiver ?' },
    ],
    sortOrder: 960,
  },
];
