// AUT-040 — the rules of the requests that wait for the events of package 3.2 (`lead.released`,
// `communication.call_logged`). Starting data (PAR-081), appended to `RULE_SEEDS`.
import type { RuleSeed } from '../automation/rule-seeds.js';

export const LEAD_PROCESSING_RULE_SEEDS: RuleSeed[] = [
  {
    code: 'R_LEAD_RELEASED',
    name: 'Demande de nouveau à prendre',
    description: 'Notifier ALL_AGENTS : « La demande {référence} est de nouveau à prendre. »',
    trigger: 'lead.released',
    conditions: null,
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'NOTIFY_STAFF', recipients: 'ALL_AGENTS', title: 'La demande {{lead.reference}} est de nouveau à prendre.' }],
    sortOrder: 115,
  },
  {
    code: 'R_CALL_MISSED',
    name: 'Appel sans réponse',
    description:
      'Appel sortant, issue NO_ANSWER ou VOICEMAIL ; à l’exécution : ni la demande ni le dossier n’a de premier contact. E-mail C_CALL_MISSED au client, au plus un par 72 heures.',
    trigger: 'communication.call_logged',
    conditions: {
      all: [
        { field: 'event.data.direction', op: 'eq', value: 'OUTBOUND' },
        { field: 'event.data.callOutcome', op: 'in', value: ['NO_ANSWER', 'VOICEMAIL'] },
        { field: 'lead.firstContactAt', op: 'isNull' },
        { field: 'dossier.firstContactAt', op: 'isNull' },
      ],
    },
    delayValue: 0,
    delayUnit: 'MINUTES',
    actions: [{ type: 'SEND_EMAIL', template: 'C_CALL_MISSED', to: 'CLIENT', dedupeWindowHours: 72 }],
    sortOrder: 150,
  },
];
