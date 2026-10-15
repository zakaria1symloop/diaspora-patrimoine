// NOT-060 — starting data of the e-mail templates of packages 3.4 to 3.6 (01-domaine/09 § 6), in the format of
// NOT-061 (the « Bouton » line becomes `{{button}}`). Installed with the others by `install/email-templates.ts`.
import type { TemplateSeed } from '../install/email-templates.js';

export const CATALOGUE_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'C_PROGRAM_UPDATE',
    name: 'Avancement du chantier',
    description: 'Nouveau point d’avancement du chantier d’un programme (CTL-145), sauf « Ne pas prévenir les clients »',
    category: 'DOSSIER',
    isSystem: false,
    preferenceGroup: 'PROJECT_NEWS',
    subject: 'Le chantier de {{property.programName}} avance',
    body: [
      "Nouveau point d'avancement : {{action.stageLabel}}, {{action.percent}} %. {{#if action.note}}{{action.note}}{{/if}}",
      '{{button "Voir les photos du chantier" dossier.url}}',
    ].join('\n\n'),
  },
  // CTL-006 — « Écrire au promoteur » (01-domaine/09 § 6): manual templates of the promoter's contacts. The greeting
  // (« Bonjour {contact}, ») is written by the layout (NOT-061), so the texts start after it.
  {
    code: 'P_PROMOTER_OPTION_REQUEST',
    name: 'Demande d’option à un promoteur',
    description: 'Demande d’option sur un lot ou un bien pour un client (CTL-006)',
    category: 'MANUAL',
    isSystem: false,
    sentBy: ['MANUAL'],
    subject: "Demande d'option – {{#if property.programName}}lot {{lot.reference}}, {{property.programName}}{{else}}bien {{property.reference}}{{/if}}",
    body: "Nous souhaitons poser une option sur {{#if property.programName}}le lot {{lot.reference}} du programme {{property.programName}}{{else}}le bien {{property.reference}} ({{property.title}}){{/if}} pour l'un de nos clients, jusqu'au {{action.untilLabel}}. Pouvez-vous nous la confirmer ?",
  },
  {
    code: 'P_PROMOTER_VISIT_REQUEST',
    name: 'Demande de visite à un promoteur',
    description: 'Demande de visite d’un bien pour un client (CTL-006)',
    category: 'MANUAL',
    isSystem: false,
    sentBy: ['MANUAL'],
    subject: 'Demande de visite – {{property.title}}',
    body: "L'un de nos clients souhaite visiter {{property.title}}. Créneaux souhaités : {{action.slotsLabel}}. Pouvez-vous nous confirmer une date ?",
  },
  {
    code: 'P_PROMOTER_STOCK_CHECK',
    name: 'Vérification des disponibilités',
    description: 'Vérification des disponibilités et des prix des programmes d’un promoteur (CTL-006, AUT-079)',
    category: 'MANUAL',
    isSystem: false,
    sentBy: ['MANUAL'],
    subject: 'Vos disponibilités sont-elles à jour ?',
    body: "Voici ce que nous présentons aujourd'hui pour vos programmes : {{action.lotsLabel}}. Pouvez-vous nous confirmer que ces disponibilités et ces prix sont à jour, ou nous indiquer ce qui a changé ? Merci d'avance.",
  },
];
