// NOT-060 — starting data of the e-mail templates the engine and its seeded rules send (01-domaine/09 § 6.2 and § 6.9),
// in the format of NOT-061. Installed with the others by install/email-templates.ts (PAR-081: missing ones only).
import type { TemplateSeed } from '../install/email-templates.js';

export const AUTOMATION_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'C_LEAD_DELAYED',
    name: 'Premier contact en retard',
    description: 'Délai de premier contact dépassé (R_LEAD_SLA_BREACHED)',
    isSystem: false,
    sentBy: ['WORKFLOW'],
    subject: "Votre demande {{lead.reference}} n'est pas oubliée",
    body: [
      "Nous vous avions promis de vous {{#if action.isContactMessage}}répondre{{else}}appeler{{/if}} dans un délai que nous n'avons pas tenu, et nous vous prions de nous en excuser. Votre demande {{lead.reference}} est bien entre nos mains : un conseiller vous contacte au plus vite. {{#if company.phone}}Si vous préférez, appelez-nous au {{company.phone}}{{#if company.whatsappUrl}} ou écrivez-nous sur WhatsApp{{/if}}. {{else}}{{#if company.whatsappUrl}}Si vous préférez, écrivez-nous sur WhatsApp. {{/if}}{{/if}}Vous pouvez aussi simplement répondre à cet e-mail : nous le lisons.",
      '{{#if company.whatsappUrl}}{{button "Nous écrire sur WhatsApp" company.whatsappUrl}}{{/if}}',
    ].join('\n\n'),
  },
  {
    code: 'S_LEAD_SLA_BREACHED',
    name: 'Délai de premier contact dépassé',
    description: 'Délai de premier contact dépassé (R_LEAD_SLA_BREACHED)',
    category: 'INTERNAL',
    isSystem: false,
    preferenceGroup: 'STAFF_ALERTS',
    sentBy: ['WORKFLOW'],
    subject: 'Délai dépassé : {{client.fullName}} attend un premier contact',
    body: ["La demande {{lead.reference}} n'a pas reçu de premier contact dans le délai prévu. Conseiller : {{lead.agentLabel}}.", '{{button "Ouvrir la demande" action.adminUrl}}'].join('\n\n'),
  },
  {
    code: 'S_TASK_ASSIGNED',
    name: 'Tâche confiée',
    description: 'Tâche confiée par un collègue',
    category: 'INTERNAL',
    isSystem: false,
    preferenceGroup: 'STAFF_TASKS',
    subject: 'Nouvelle tâche : {{task.title}}',
    body: ['{{actor.fullName}} vous a confié cette tâche. {{#if task.dueLabel}}Échéance : {{task.dueLabel}}.{{/if}}', '{{button "Ouvrir la tâche" task.url}}'].join('\n\n'),
  },
  {
    code: 'S_TECH_ALERT',
    name: 'Alerte technique',
    description: 'Alerte technique (AUT-076)',
    category: 'INTERNAL',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: '[Alerte] {{action.cause}}',
    body: '{{action.details}} Identifiant : {{action.requestId}}.',
  },
];
