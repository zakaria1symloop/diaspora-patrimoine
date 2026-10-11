// NOT-060 § 6.3 « Dossier », § 6.2 (`S_ASSIGNED`) — starting data of the e-mail templates of package 3.7, in the format
// of NOT-061 (the « Bouton » line becomes `{{button}}`; `{{> properties}}` is the block of the proposed properties).
import type { TemplateSeed } from '../install/email-templates.js';

export const DOSSIER_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'C_PROPOSAL_NEW',
    name: 'Biens proposés',
    description: 'Biens proposés par le conseiller : un e-mail par envoi (PIP-031, NOT-016)',
    category: 'DOSSIER',
    isSystem: false,
    preferenceGroup: 'PROJECT_NEWS',
    subject: '{{advisor.firstName}} vous propose {{properties.countLabel}}',
    body: [
      "D'après votre projet, {{advisor.firstName}} a sélectionné pour vous {{properties.countLabel}}. {{#if action.advisorMessage}}« {{action.advisorMessage}} »{{/if}} Dites-nous ce que vous en pensez : c'est ce qui nous permet d'affiner.",
      '{{> properties}}',
      '{{button "Voir les biens proposés" action.url}}',
    ].join('\n\n'),
  },
  {
    code: 'C_PROPOSAL_REMINDER',
    name: 'Biens proposés : relance',
    description: 'Biens proposés jamais ouverts (R_PROPOSAL_REMINDER)',
    category: 'DOSSIER',
    isSystem: false,
    preferenceGroup: 'REMINDERS',
    sentBy: ['WORKFLOW'],
    subject: 'Des biens vous attendent',
    body: ["{{advisor.firstName}} vous a proposé des biens il y a quelques jours. Un coup d'œil suffit pour nous dire s'ils vous plaisent.", '{{button "Voir les biens proposés" /espace-client/biens-proposes}}'].join('\n\n'),
  },
  {
    code: 'C_ADVISOR_CHANGED',
    name: 'Changement de conseiller',
    description: 'Le dossier change de conseiller (CYC-040), sauf « Ne pas informer le client »',
    category: 'DOSSIER',
    isSystem: false,
    subject: 'Votre conseiller change',
    body: ['Votre projet est désormais suivi par {{advisor.displayName}}. Tout votre historique lui a été transmis : vous n\'avez rien à refaire.', // The label of a button is literal (NOT-061): « Écrire à {prénom} » becomes « Écrire à mon conseiller » (deviation logged).
      '{{button "Écrire à mon conseiller" /espace-client/messages}}'].join('\n\n'),
  },
  {
    code: 'C_DOSSIER_CLOSED',
    name: 'Dossier clôturé',
    description: 'Dossier clôturé, case « Informer le client » cochée (CYC-035)',
    category: 'DOSSIER',
    isSystem: false,
    subject: 'Votre dossier {{dossier.reference}}',
    body: ['Nous clôturons votre dossier {{dossier.reference}}. Votre espace et vos documents restent accessibles. Votre projet peut reprendre à tout moment : il suffit de nous écrire.', '{{button "Nous écrire" /espace-client/messages}}'].join('\n\n'),
  },
  {
    code: 'C_DOSSIER_ON_HOLD',
    name: 'Dossier en pause',
    description: 'Dossier mis en pause, case « Informer le client » cochée (d’office quand le motif est « En attente du client », CYC-031)',
    category: 'DOSSIER',
    isSystem: false,
    subject: 'Votre projet est en pause',
    body: [
      "Votre dossier {{dossier.reference}} est mis en pause{{#if action.waitingClient}} : nous attendons de vos nouvelles pour avancer{{#if action.holdClientNote}} — {{action.holdClientNote}}{{/if}}{{/if}}. {{#if action.holdUntilLabel}}Reprise prévue le {{action.holdUntilLabel}}. {{/if}}Rien n'est perdu : vos pièces et votre historique sont conservés. Pour reprendre, il suffit de nous écrire.",
      '{{button "Reprendre mon projet" /espace-client/messages}}',
    ].join('\n\n'),
  },
  {
    code: 'S_ASSIGNED',
    name: 'Demande ou dossier confié',
    description: 'Une demande ou un dossier confié par un collègue (NS_ASSIGNED)',
    category: 'INTERNAL',
    isSystem: false,
    preferenceGroup: 'STAFF_LEADS',
    subject: '{{actor.fullName}} vous a confié {{action.objectLabel}}',
    body: '{{button "Ouvrir" action.adminUrl}}',
  },
];
