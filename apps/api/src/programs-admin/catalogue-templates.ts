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
];
