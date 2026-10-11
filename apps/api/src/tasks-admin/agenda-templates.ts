// NOT-060 § 6.3 (appointments) and § 6.7 (`S_DAILY_DIGEST`) — starting data of the e-mail templates of package 3.8, in
// the format of NOT-061. The appointment e-mails are service e-mails (no preference group): they tell of a date.
import type { TemplateSeed } from '../install/email-templates.js';

export const AGENDA_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'C_APPOINTMENT_CONFIRMED',
    name: 'Rendez-vous confirmé',
    description: 'Rendez-vous confirmé ou déplacé, quand le conseiller informe le client (TAC-040, CYC-080) ; fichier d’agenda joint',
    category: 'DOSSIER',
    isSystem: false,
    subject: '{{#if appointment.isRescheduled}}Nouvelle date : {{/if}}rendez-vous le {{appointment.dateLabel}} à {{appointment.timeLabel}}',
    body: [
      'Votre {{appointment.typeLabel}} avec {{advisor.displayName}} est confirmé le {{appointment.dateLabel}} à {{appointment.timeLabel}} ({{appointment.timezoneLabel}}). {{#if appointment.location}}Lieu : {{appointment.location}}.{{/if}} {{#if appointment.hostLabel}}Sur place, vous serez accueilli par {{appointment.hostLabel}}, à qui nous avons communiqué votre nom.{{/if}} {{#if appointment.meetingUrl}}Lien de la visio : {{appointment.meetingUrl}}.{{/if}} Un fichier d’agenda est joint.',
      '{{button "Voir mon rendez-vous" /espace-client/rendez-vous}}',
      'Un empêchement ? Prévenez-nous depuis votre espace.',
    ].join('\n\n'),
  },
  {
    code: 'C_APPOINTMENT_CANCELLED',
    name: 'Rendez-vous annulé',
    description: 'Rendez-vous annulé par le personnel ou à la clôture du dossier, quand le client avait été informé (CYC-080, CYC-035)',
    category: 'DOSSIER',
    isSystem: false,
    subject: 'Votre rendez-vous du {{appointment.dateLabel}} est annulé',
    body: [
      '{{#if appointment.dossierClosed}}Votre {{appointment.typeLabel}} du {{appointment.dateLabel}} est annulé, votre dossier étant clôturé. Si votre projet reprend, écrivez-nous : nous reprendrons rendez-vous.{{else}}Nous devons annuler votre {{appointment.typeLabel}} du {{appointment.dateLabel}}. {{#if appointment.staffNote}}« {{appointment.staffNote}} » {{/if}}{{advisor.firstName}} vous propose rapidement un autre créneau.{{/if}}',
      '{{button "Voir mes rendez-vous" /espace-client/rendez-vous}}',
    ].join('\n\n'),
  },
  {
    code: 'C_APPOINTMENT_REMINDER',
    name: 'Rappel de rendez-vous',
    description: 'Rappel 24 heures avant un rendez-vous confirmé dont le client a été informé (R_APPOINTMENT_REMINDER)',
    category: 'DOSSIER',
    isSystem: false,
    sentBy: ['WORKFLOW'],
    subject: 'Rappel : rendez-vous demain à {{appointment.timeLabel}}',
    body: [
      'Votre {{appointment.typeLabel}} avec {{advisor.displayName}} a lieu demain, {{appointment.dateLabel}}, à {{appointment.timeLabel}} ({{appointment.timezoneLabel}}). {{#if appointment.hostLabel}}Sur place, vous serez accueilli par {{appointment.hostLabel}}.{{/if}}',
      '{{button "Voir mon rendez-vous" /espace-client/rendez-vous}}',
    ].join('\n\n'),
  },
  {
    code: 'S_APPOINTMENT_CANCELLED',
    name: 'Rendez-vous annulé par le client',
    description: 'Le client annule un rendez-vous depuis son espace (INT-042)',
    category: 'INTERNAL',
    isSystem: false,
    preferenceGroup: 'STAFF_DOSSIERS',
    subject: '{{client.fullName}} a annulé le rendez-vous du {{appointment.dateLabel}}',
    body: '{{button "Ouvrir le dossier" action.adminUrl}}',
  },
  {
    code: 'S_DAILY_DIGEST',
    name: 'Résumé du matin',
    description: 'Résumé du matin du personnel, jours ouvrés à 8 h 30 (AUT-070) ; ne part pas s’il n’a rien à dire',
    category: 'INTERNAL',
    isSystem: false,
    preferenceGroup: 'STAFF_DIGEST',
    subject: 'Votre journée du {{digest.dateLabel}}',
    body: ['{{> digest}}', '{{button "Ouvrir ma journée" action.adminUrl}}'].join('\n\n'),
  },
];
