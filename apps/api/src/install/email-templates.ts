// NOT-060 — starting data of the e-mail templates needed by work package 2.5 (public request forms): the texts of
// 01-domaine/09 § 6.2, written in the format of NOT-061 (the « Bouton » line becomes `{{button}}`), with the fields set
// by code (NOT-040, NOT-041, NOT-060): audience by prefix, category LEADS (PARTNERS for `P_`), isSystem for the
// acknowledgements, preferenceGroup, variables (cited fields + greeting and signature fields), requiredVariables,
// secretVariables. TRV-010 typography is applied to the literal text (’ and a no-break space before : ; ? !).
// PAR-081: only missing templates are created; an existing one — maybe edited by an administrator — is never rewritten,
// and the `origin*` fields keep the delivered text for « Revenir au texte d'origine ».
import { newId } from '../platform/ids.js';
import { citedFields } from '../communication/template-renderer.js';
import type { Tx } from '../platform/tx.js';
import { ALERT_TEMPLATE_SEEDS } from '../alerts/alert-templates.js';
import { CLIENT_SPACE_TEMPLATE_SEEDS } from '../documents/client-space-templates.js';
import { AUTOMATION_TEMPLATE_SEEDS } from '../automation/template-seeds.js';
import { LEAD_PROCESSING_TEMPLATE_SEEDS } from '../leads-admin/lead-templates.js';
import { DOSSIER_TEMPLATE_SEEDS } from '../dossiers-admin/dossier-templates.js';
import { AGENDA_TEMPLATE_SEEDS } from '../tasks-admin/agenda-templates.js';
import { CATALOGUE_TEMPLATE_SEEDS } from '../programs-admin/catalogue-templates.js';

export interface TemplateSeed {
  code: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  preferenceGroup?: string;
  isSystem: boolean;
  requiredVariables?: string[];
  /** Default: PARTNERS for `P_`, else LEADS. */
  category?: 'CAFE' | 'FINANCING' | 'ALERTS' | 'PRIVACY' | 'DOCUMENTS' | 'INTERNAL' | 'DOSSIER' | 'MANUAL';
  /** NOT-040 — default EVENT. */
  sentBy?: ('EVENT' | 'WORKFLOW' | 'SYSTEM' | 'MANUAL')[];
}

/** TRV-010 on literal text only: tags `{{…}}` (button labels, paths) are left untouched. */
export function typography(source: string): string {
  return source
    .split(/(\{\{[\s\S]*?\}\})/g)
    .map((part) => (part.startsWith('{{') ? part : part.replace(/'/g, '’').replace(/ ([:;?!])/g, ' $1')))
    .join('');
}

const SECRET_FIELDS = ['action.url', 'action.code', 'message.excerpt', 'registration.manageUrl', 'alert.manageUrl', 'alert.extendUrl', 'survey.url'];

/**
 * DEM-021, NOT-024 — « Créer mon espace » ticked on any request form: the activation link (minted when the e-mail
 * leaves), or the invitation to sign in when an active account exists. C_LEAD_ACK_INTEREST carries it in the spec; the
 * other acknowledgements get the same paragraph (decision recorded with the code deviations).
 */
const ACCOUNT_BLOCK =
  '{{#if action.url}}{{button "Activer mon espace" action.url}}\n\nVotre espace vous permet de suivre votre demande.{{/if}}{{#if action.hasAccount}}Vous avez déjà un espace : connectez-vous pour y suivre votre demande.{{/if}}';

export const LEAD_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'C_LEAD_ACK_INTEREST',
    name: 'Demande PROPERTY_INTEREST',
    description: 'Demande PROPERTY_INTEREST',
    isSystem: true,
    subject: 'Votre demande pour {{#if property.title}}{{property.title}}{{else}}{{program.name}}{{/if}} est bien reçue',
    body: [
      "{{#if property.title}}Nous avons bien reçu votre intérêt pour {{property.title}} ({{property.cityRegion}}, réf. {{property.reference}}).{{else}}Nous avons bien reçu votre intérêt pour le programme {{program.name}} ({{program.cityRegion}}). Votre conseiller vous présentera les biens du programme qui correspondent à votre projet.{{/if}} Un conseiller vous contacte {{lead.callbackLabel}} pour faire le point sur votre projet. {{#if company.phone}}L'appel viendra du {{company.phone}} : enregistrez-le pour le reconnaître. {{/if}}Votre demande porte la référence {{lead.reference}}.",
      '{{#if action.url}}{{button "Activer mon espace" action.url}}{{else}}{{#if property.url}}{{button "Revoir ce bien" property.url}}{{else}}{{button "Revoir ce programme" program.url}}{{/if}}{{/if}}',
      '{{#if action.url}}Votre espace vous permet de suivre votre demande. {{#if property.url}}Revoir ce bien : {{property.url}}{{else}}Revoir ce programme : {{program.url}}{{/if}}{{/if}}{{#if action.hasAccount}}Vous avez déjà un espace : connectez-vous pour y suivre votre demande.{{/if}}',
    ].join('\n\n'),
  },
  {
    code: 'C_LEAD_ACK_PROJECTION',
    name: 'Demande PROJECTION_REQUEST',
    description: 'Demande PROJECTION_REQUEST',
    isSystem: true,
    subject: 'Votre projection est en préparation',
    body: [
      'Merci. Un conseiller prépare votre projection personnalisée : budget, mensualité, solutions de financement et exemples de biens. Vous la recevez {{lead.callbackLabel}}. Référence : {{lead.reference}}.',
      '{{button "Découvrir les programmes" /programmes}}',
      ACCOUNT_BLOCK,
    ].join('\n\n'),
  },
  {
    code: 'C_LEAD_ACK_CALLBACK',
    name: 'Demandes CALLBACK_REQUEST, SIMULATION_FOLLOWUP, GUIDED_SEARCH',
    description: 'Demandes CALLBACK_REQUEST, SIMULATION_FOLLOWUP, GUIDED_SEARCH',
    isSystem: true,
    subject: 'Votre demande de rappel est bien reçue',
    body: [
      'Votre demande est enregistrée (référence {{lead.reference}}). Un conseiller vous appelle {{lead.callbackLabel}}. {{#if company.phone}}L\'appel viendra du {{company.phone}}.{{/if}}',
      '{{button "Découvrir les programmes" /programmes}}',
      ACCOUNT_BLOCK,
    ].join('\n\n'),
  },
  {
    code: 'C_LEAD_ACK_CONTACT',
    name: 'Demande CONTACT_MESSAGE',
    description: 'Demande CONTACT_MESSAGE',
    isSystem: true,
    subject: 'Votre message est bien reçu',
    body: ['Nous avons bien reçu votre message (référence {{lead.reference}}) et vous répondons {{lead.callbackLabel}}.', ACCOUNT_BLOCK].join('\n\n'),
  },
  {
    code: 'P_PARTNER_REQUEST_ACK',
    name: 'Demande PARTNER_REQUEST déposée par « Devenir partenaire »',
    description: 'Demande PARTNER_REQUEST déposée par « Devenir partenaire » (EP-23, payload.form = PARTNER_REQUEST) ; jamais pour une inscription partenaire',
    isSystem: true,
    subject: 'Votre demande de partenariat est bien reçue',
    body: 'Merci de votre intérêt pour {{company.name}}. Notre équipe étudie votre demande et revient vers vous.',
  },
  {
    code: 'S_LEAD_NEW',
    name: 'Nouvelle demande',
    description: 'Nouvelle demande',
    isSystem: false,
    preferenceGroup: 'STAFF_LEADS',
    subject: 'Nouvelle demande : {{lead.kindLabel}} – {{client.fullName}}',
    body: [
      'Demande {{lead.reference}}, reçue le {{lead.createdDate}}. {{#if property.title}}Bien : {{property.title}}.{{/if}} Premier contact attendu avant le {{lead.slaLabel}}.',
      '{{button "Ouvrir la demande" action.adminUrl}}',
    ].join('\n\n'),
  },
];

/**
 * NOT-060 — the Café templates of 01-domaine/09 § 4.5 and § 6.5 (CAF-021, CYC-182, CYC-185, AUT-056). Literal text of
 * the spec; a field that can be empty is wrapped in `{{#if}}` (NOT-012: a field cited outside any block is required —
 * `cafe.venueName` and `cafe.venueNotes` are optional on the Café). C_CAFE_PROMOTED spells out « suite identique à
 * C_CAFE_REGISTERED ».
 */
const CAFE_VENUE = 'Lieu : {{#if cafe.venueName}}{{cafe.venueName}}, {{/if}}{{cafe.venueAddress}}.{{#if cafe.venueNotes}} {{cafe.venueNotes}}{{/if}}';
const CAFE_ON_SITE =
  "Sur place : un promoteur et un banquier répondent à vos questions, autour d'un café. Votre code d'accueil : **{{registration.checkInCode}}** (QR code joint). Un fichier d'agenda est joint.";
const MANAGE_BUTTON = '{{button "Gérer mon inscription" registration.manageUrl}}';
const NEXT_CAFE = '{{#if nextCafe.dateLabel}}Prochain Café : {{nextCafe.locationLabel}}, {{nextCafe.dateLabel}}.{{/if}}';
const NEXT_BUTTON = '{{button "Voir les prochains Cafés" /le-cafe}}';

export const CAFE_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'C_CAFE_REGISTERED',
    name: 'Inscription confirmée',
    description: 'Inscription à un Café confirmée (registration.created) ; renvoyée à une adresse déjà inscrite (CAF-024)',
    category: 'CAFE',
    isSystem: true,
    subject: 'Votre place au Café du {{cafe.dateLabel}} est réservée',
    body: ["C'est noté : {{registration.seats}} place(s) pour {{cafe.brandName}}, {{cafe.dateLabel}}, {{cafe.timeLabel}}.", CAFE_VENUE, CAFE_ON_SITE, MANAGE_BUTTON].join('\n\n'),
  },
  {
    code: 'C_CAFE_WAITLISTED',
    name: "Inscription en liste d'attente",
    description: "Inscription à un Café sur liste d'attente (registration.waitlisted)",
    category: 'CAFE',
    isSystem: true,
    subject: "Vous êtes sur la liste d'attente du Café du {{cafe.dateLabel}}",
    body: [
      "Ce Café est complet. Vous êtes inscrit sur la liste d'attente pour {{registration.seats}} place(s) : dès qu'une place se libère, elle vous est attribuée et nous vous prévenons aussitôt.",
      MANAGE_BUTTON,
    ].join('\n\n'),
  },
  {
    code: 'C_CAFE_PROMOTED',
    name: "Sortie de liste d'attente",
    description: "Sortie de liste d'attente (registration.promoted, CYC-185)",
    category: 'CAFE',
    isSystem: true,
    subject: "Une place s'est libérée : vous êtes inscrit au Café du {{cafe.dateLabel}}",
    body: [
      'Bonne nouvelle : vos {{registration.seats}} place(s) sont confirmées pour {{cafe.brandName}}, {{cafe.dateLabel}}, {{cafe.timeLabel}}.',
      CAFE_VENUE,
      CAFE_ON_SITE,
      MANAGE_BUTTON,
    ].join('\n\n'),
  },
  {
    code: 'C_CAFE_REGISTRATION_CANCELLED',
    name: "Annulation d'une inscription",
    description: "Annulation d'une inscription à un Café (registration.cancelled)",
    category: 'CAFE',
    isSystem: true,
    subject: 'Votre inscription au Café du {{cafe.dateLabel}} est annulée',
    body: [`Votre inscription est annulée. ${NEXT_CAFE}`, NEXT_BUTTON].join('\n\n'),
  },
  {
    code: 'C_CAFE_UPDATED',
    name: 'Date, heure ou lieu modifiés',
    description: "Date, heure ou lieu d'un Café modifiés (CYC-182)",
    category: 'CAFE',
    isSystem: true,
    subject: 'Changement pour le Café du {{cafe.dateLabel}}',
    body: [
      "Le Café auquel vous êtes inscrit change : {{cafe.changes}}. Votre inscription reste valable. Si la nouvelle organisation ne vous convient pas, vous pouvez l'annuler.",
      MANAGE_BUTTON,
    ].join('\n\n'),
  },
  {
    code: 'C_CAFE_CANCELLED',
    name: 'Café annulé',
    description: 'Café annulé (CYC-180)',
    category: 'CAFE',
    isSystem: true,
    subject: 'Le Café du {{cafe.dateLabel}} est annulé',
    body: [`Nous sommes désolés : le Café prévu le {{cafe.dateLabel}} à {{cafe.locationLabel}} est annulé. {{cafe.cancelReason}} ${NEXT_CAFE}`, NEXT_BUTTON].join('\n\n'),
  },
  {
    code: 'C_CAFE_OPENING',
    name: 'Ouverture des inscriptions',
    description: 'Ouverture des inscriptions (R_CAFE_OPENING) ; porte son propre lien de désinscription',
    category: 'CAFE',
    isSystem: false,
    sentBy: ['WORKFLOW'],
    subject: 'Les inscriptions sont ouvertes : Café à {{cafe.locationLabel}} le {{cafe.dateLabel}}',
    body: [
      'Vous nous avez demandé de vous prévenir. Les inscriptions au prochain Café sont ouvertes : {{cafe.locationLabel}}, {{cafe.dateLabel}}, {{cafe.timeLabel}}. Les places sont limitées.',
      '{{button "Je m’inscris" cafe.url}}',
    ].join('\n\n'),
  },
  {
    code: 'C_CAFE_REMINDER_7D',
    name: 'Rappel à une semaine',
    description: 'Rappel une semaine avant le Café (R_CAFE_REMINDER_7D)',
    category: 'CAFE',
    isSystem: false,
    preferenceGroup: 'CAFE',
    sentBy: ['WORKFLOW'],
    subject: 'Dans une semaine : Le Café à {{cafe.locationLabel}}',
    body: [
      "Rendez-vous {{cafe.dateLabel}}, {{cafe.timeLabel}}. Pensez à vos questions pour le promoteur et le banquier : budget, financement, délais. Un empêchement ? Libérez votre place pour quelqu'un d'autre.",
      MANAGE_BUTTON,
    ].join('\n\n'),
  },
  {
    code: 'C_CAFE_REMINDER_1D',
    name: 'Rappel la veille',
    description: 'Rappel la veille du Café (R_CAFE_REMINDER_1D)',
    category: 'CAFE',
    isSystem: false,
    preferenceGroup: 'CAFE',
    sentBy: ['WORKFLOW'],
    subject: "C'est demain : Le Café à {{cafe.locationLabel}}",
    body: [
      "À demain, {{cafe.timeLabel}}. Lieu : {{#if cafe.venueName}}{{cafe.venueName}}, {{/if}}{{cafe.venueAddress}}.{{#if cafe.venueNotes}} {{cafe.venueNotes}}{{/if}} Votre code d'accueil : **{{registration.checkInCode}}**.",
      '{{button "Voir mon inscription" registration.manageUrl}}',
    ].join('\n\n'),
  },
  {
    code: 'C_CAFE_THANKS',
    name: "Merci d'être venu",
    description: "Remerciement après le Café, avec le lien de l'enquête (R_CAFE_THANKS)",
    category: 'CAFE',
    isSystem: false,
    preferenceGroup: 'CAFE',
    sentBy: ['WORKFLOW'],
    subject: "Merci d'être venu au Café",
    body: [
      'Merci de votre présence. Un conseiller vous rappelle dans les prochains jours pour donner suite à vos échanges. En attendant, dites-nous en deux minutes ce que vous avez pensé de ce Café.',
      '{{button "Donner mon avis" survey.url}}',
    ].join('\n\n'),
  },
  {
    code: 'C_CAFE_MISSED',
    name: 'Absence au Café',
    description: 'Inscrit absent (R_CAFE_MISSED)',
    category: 'CAFE',
    isSystem: false,
    preferenceGroup: 'CAFE',
    sentBy: ['WORKFLOW'],
    subject: 'Nous ne vous avons pas vu au Café',
    body: [`Vous n'avez pas pu venir : ce n'est que partie remise. ${NEXT_CAFE} Vous pouvez aussi être rappelé par un conseiller.`, NEXT_BUTTON].join('\n\n'),
  },
];

/** Work package 2.6 — simulators (01-domaine/09 § 6.2): the result sent by « Recevoir par e-mail », PDF attached (SIM-032). */
export const SIMULATION_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'C_SIMULATION_RESULT',
    name: 'Résultat d’une simulation',
    description: 'Le visiteur clique « Recevoir par e-mail » sur un résultat de simulateur (EP-11, EP-12) ; le PDF est joint',
    isSystem: true,
    category: 'FINANCING',
    subject: 'Votre simulation',
    body: [
      "Voici le résultat de votre simulation, en pièce jointe. C'est une estimation indicative : un conseiller peut l'affiner avec les banques partenaires.",
      '{{button "Être rappelé par un conseiller" simulation.callbackPath}}',
    ].join('\n\n'),
  },
];

function audienceOf(code: string): 'CLIENT' | 'STAFF' | 'PARTNER' {
  return code.startsWith('S_') ? 'STAFF' : code.startsWith('P_') ? 'PARTNER' : 'CLIENT';
}

/** NOT-060 `variables`: the cited fields plus those of the greeting and the signature (NOT-006). */
function variablesOf(seed: TemplateSeed): string[] {
  const greeting = audienceOf(seed.code) === 'STAFF' ? ['staff.firstName'] : ['client.firstName', 'advisor.displayName'];
  return [...new Set([...citedFields(seed.subject), ...citedFields(seed.body), ...greeting])].sort();
}

/** Creates the missing templates (and their first version, NOT-052). Returns the report lines of PAR-080. */
export async function installEmailTemplates(tx: Tx, now: Date): Promise<string[]> {
  const created: string[] = [];
  const updated: string[] = [];
  const originOnly: string[] = [];
  for (const seed of [...LEAD_TEMPLATE_SEEDS, ...CAFE_TEMPLATE_SEEDS, ...SIMULATION_TEMPLATE_SEEDS, ...ALERT_TEMPLATE_SEEDS, ...CLIENT_SPACE_TEMPLATE_SEEDS, ...AUTOMATION_TEMPLATE_SEEDS, ...DOSSIER_TEMPLATE_SEEDS, ...AGENDA_TEMPLATE_SEEDS, ...CATALOGUE_TEMPLATE_SEEDS, ...LEAD_PROCESSING_TEMPLATE_SEEDS]) {
    const subject = typography(seed.subject);
    const body = typography(seed.body);
    const variables = variablesOf(seed);
    const existing = await tx.emailTemplate.findFirst({
      where: { code: seed.code, locale: 'fr', deletedAt: null },
      select: { id: true, version: true, subject: true, bodyHtml: true, originSubject: true, originBodyHtml: true },
    });
    if (existing) {
      // PAR-081 — a newer original replaces the stored one only while the template still equals its previous original
      // (never an administrator's wording).
      const untouched = existing.subject === existing.originSubject && existing.bodyHtml === existing.originBodyHtml;
      const changed = existing.originSubject !== subject || existing.originBodyHtml !== body;
      if (untouched && changed) {
        const version = existing.version + 1;
        await tx.emailTemplate.update({
          where: { id: existing.id },
          data: {
            subject,
            bodyHtml: body,
            originSubject: subject,
            originBodyHtml: body,
            variables,
            secretVariables: variables.filter((v) => SECRET_FIELDS.includes(v)),
            version,
            updatedAt: now,
          },
        });
        await tx.emailTemplateVersion.create({ data: { id: newId(), templateId: existing.id, version, subject, preheader: null, bodyHtml: body, createdAt: now } });
        updated.push(seed.code);
      } else if (changed) {
        // PAR-081 — edited by an administrator: his text stays; only the original moves, so that the templates screen
        // can offer « Comparer » and « Rétablir le texte d'origine ».
        await tx.emailTemplate.update({ where: { id: existing.id }, data: { originSubject: subject, originBodyHtml: body, updatedAt: now } });
        originOnly.push(seed.code);
      }
      continue;
    }
    const id = newId();
    await tx.emailTemplate.create({
      data: {
        id,
        code: seed.code,
        locale: 'fr',
        audience: audienceOf(seed.code),
        category: seed.category ?? (seed.code.startsWith('P_') ? 'PARTNERS' : 'LEADS'),
        name: seed.name.slice(0, 120),
        description: seed.description.slice(0, 300),
        subject,
        preheader: null,
        bodyHtml: body,
        bodyText: null,
        variables,
        requiredVariables: seed.requiredVariables ?? [],
        secretVariables: variables.filter((v) => SECRET_FIELDS.includes(v)),
        preferenceGroup: seed.preferenceGroup ?? null,
        originSubject: subject,
        originPreheader: null,
        originBodyHtml: body,
        isSystem: seed.isSystem,
        isActive: true,
        sentBy: seed.sentBy ?? ['EVENT'],
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.emailTemplateVersion.create({ data: { id: newId(), templateId: id, version: 1, subject, preheader: null, bodyHtml: body, createdAt: now } });
    created.push(seed.code);
  }
  return [
    ...(created.length ? [`Modèles d’e-mail créés : ${created.join(', ')}.`] : []),
    ...(updated.length ? [`Modèles d’e-mail mis à jour (texte d’origine) : ${updated.join(', ')}.`] : []),
    ...(originOnly.length ? [`Modèles d’e-mail modifiés par l’administrateur, texte d’origine seul mis à jour : ${originOnly.join(', ')}.`] : []),
  ];
}
