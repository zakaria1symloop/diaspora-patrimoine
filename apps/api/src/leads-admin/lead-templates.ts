// NOT-060 — starting data of the e-mail templates of package 3.2 (01-domaine/09 § 6.2 `C_CALL_MISSED`, § 6.6 the
// manual templates of origin `C_MANUAL_BLANK`, `C_MANUAL_FOLLOW_UP`), in the format of NOT-061. Installed with the
// others by install/email-templates.ts (PAR-081: missing ones only).
import type { TemplateSeed } from '../install/email-templates.js';

export const LEAD_PROCESSING_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'C_CALL_MISSED',
    name: 'Appel sans réponse',
    description: 'R_CALL_MISSED — appel sortant sans réponse avant le premier contact',
    isSystem: false,
    sentBy: ['WORKFLOW'],
    subject: 'Nous avons essayé de vous joindre',
    body: [
      '{{advisor.firstName}} a tenté de vous appeler au sujet de votre projet, sans succès. Dites-nous quand vous êtes disponible : par message dans votre espace{{#if company.whatsappUrl}}, par WhatsApp{{/if}}, ou en répondant à cet e-mail.',
      '{{button "Proposer un créneau" /espace-client/messages}}',
    ].join('\n\n'),
  },
  {
    code: 'C_MANUAL_BLANK',
    name: 'Message libre du conseiller',
    description: 'Message libre du conseiller : objet et corps saisis à l’envoi (COM-020)',
    category: 'MANUAL',
    isSystem: false,
    sentBy: ['MANUAL'],
    subject: '',
    body: '',
  },
  {
    code: 'C_MANUAL_FOLLOW_UP',
    name: '« Je reviens vers vous »',
    description: '« Je reviens vers vous » — e-mail écrit à la main (COM-020)',
    category: 'MANUAL',
    isSystem: false,
    sentBy: ['MANUAL'],
    subject: 'Où en est votre projet ?',
    body: [
      'Je reviens vers vous au sujet de votre projet. Avez-vous eu le temps d’y réfléchir ? Je reste à votre disposition pour répondre à vos questions ou organiser un échange.',
      '{{button "Répondre à mon conseiller" /espace-client/messages}}',
    ].join('\n\n'),
  },
];
