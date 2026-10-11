// NOT-060 — starting data of the alert e-mails (01-domaine/09 § 6.6), in the format of NOT-061, created by the
// installer when missing (PAR-081). Two templates are not in the § 6.6 list and are proposed to the specs:
// `C_ALERT_MANAGE` (SFA-035 « Recevoir un nouveau lien » for alerts already confirmed: « l'e-mail de gestion repart »)
// and `C_PREFERENCES_LINK` (PRO-031 « Recevoir un nouveau lien » on the preferences page).
import type { TemplateSeed } from '../install/email-templates.js';

const MANAGE_LINK = '[Modifier ou arrêter cette alerte]({{alert.manageUrl}})';

export const ALERT_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'C_ALERT_CONFIRM',
    name: 'Alerte créée sans compte : confirmation de l’adresse',
    description: 'Alerte créée sans compte : confirmation de l’adresse (CAT-071)',
    category: 'ALERTS',
    isSystem: true,
    subject: 'Confirmez votre alerte',
    body: [
      "Vous avez demandé à être prévenu des nouveaux biens correspondant à : {{alert.label}}. Confirmez votre adresse pour activer l'alerte. Ce lien est valable 7 jours.",
      '{{button "Activer mon alerte" action.url}}',
    ].join('\n\n'),
  },
  {
    code: 'C_ALERT_MATCHES',
    name: 'Alertes de recherche',
    description: 'AUT-060 — nouveaux biens correspondant à une alerte (six au plus)',
    category: 'ALERTS',
    isSystem: false,
    preferenceGroup: 'ALERTS',
    subject: '{{alert.totalCount}} nouveaux biens pour « {{alert.label}} »',
    body: ['{{> properties}}', '{{button "Voir tous les biens" alert.resultsUrl}}', MANAGE_LINK].join('\n\n'),
  },
  {
    code: 'C_ALERT_EXPIRING',
    name: 'Durée de vie d’une alerte',
    description: 'AUT-061 — l’alerte arrive à échéance dans 15 jours',
    category: 'ALERTS',
    isSystem: false,
    preferenceGroup: 'ALERTS',
    subject: 'Votre alerte « {{alert.label}} » se termine bientôt',
    body: [
      "Votre alerte arrive à échéance dans 15 jours. Si votre recherche est toujours d'actualité, prolongez-la d'un clic.",
      '{{button "Prolonger mon alerte" alert.extendUrl}}',
      MANAGE_LINK,
    ].join('\n\n'),
  },
  {
    code: 'C_ALERT_MANAGE',
    name: 'Liens de gestion des alertes',
    description: 'SFA-035 — « Recevoir un nouveau lien » pour des alertes déjà confirmées : le lien de gestion de chacune',
    category: 'ALERTS',
    isSystem: true,
    subject: 'Vos alertes de recherche',
    body: [
      "Voici le lien de chacune de vos alertes : vous pouvez y changer la fréquence des e-mails, mettre l'alerte en pause ou l'arrêter.",
      '{{> alerts}}',
    ].join('\n\n'),
  },
  {
    code: 'C_PREFERENCES_LINK',
    name: 'Nouveau lien de préférences',
    description: 'PRO-031 — « Recevoir un nouveau lien » sur la page des préférences d’e-mail',
    category: 'PRIVACY',
    isSystem: true,
    subject: "Vos préférences d'e-mail",
    body: ['Voici un nouveau lien pour choisir les e-mails que vous recevez de notre part.', '{{button "Gérer mes préférences" action.url}}'].join('\n\n'),
  },
];
