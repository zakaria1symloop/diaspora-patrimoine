// NOT-060, 01-domaine/09 § 4.1 and § 6.1 — starting data of the account and security templates (packages 1.6, 1.7, 2.10)
// and of the partner sign-up (A.14, § 6.2 `P_PARTNER_EMAIL_VERIFICATION`, `P_PARTNER_APPLICATION_ACK`). Written in the
// format of NOT-061 (« Bouton » → `{{button}}`); fields set by code: audience by prefix, category ACCOUNT (PARTNERS for
// `P_`), isSystem for the « Système » ones, sentBy, variables, requiredVariables, secretVariables (NOT-002).
// PAR-081: only missing templates are created; an existing one is never rewritten.
import { citedFields } from '../communication/template-renderer.js';
import { newId } from '../platform/ids.js';
import type { Tx } from '../platform/tx.js';
import { typography } from './email-templates.js';

interface AuthTemplateSeed {
  code: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  isSystem: boolean;
  sentBy: ('SYSTEM' | 'EVENT' | 'WORKFLOW')[];
  /** Default: ACCOUNT (PARTNERS for `P_`). */
  category?: 'INTERNAL';
}

const SECRET_FIELDS = ['action.url', 'action.code'];

const IGNORE = "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : rien ne change.";

export const AUTH_TEMPLATE_SEEDS: AuthTemplateSeed[] = [
  {
    code: 'C_EMAIL_VERIFICATION',
    name: 'Inscription',
    description: 'Inscription ; rappel à 24 h (R_VERIFICATION_REMINDER)',
    isSystem: true,
    sentBy: ['SYSTEM', 'WORKFLOW'],
    subject: 'Confirmez votre adresse e-mail',
    body: [
      "Merci d'avoir créé votre espace {{company.name}}. Pour l'ouvrir, confirmez votre adresse. Ce lien est valable 24 heures. Si vous l'ouvrez sur un autre appareil que celui de votre inscription, votre mot de passe vous sera demandé.",
      '{{button "Confirmer mon adresse" action.url}}',
      "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.",
    ].join('\n\n'),
  },
  {
    code: 'C_WELCOME',
    name: 'Compte activé ou vérifié pour la première fois',
    description: 'Compte activé ou vérifié pour la première fois',
    isSystem: true,
    sentBy: ['EVENT'],
    subject: 'Bienvenue dans votre espace',
    body: [
      'Votre espace est ouvert. Vous y retrouvez vos intérêts, les biens que nous vous proposons, vos simulations et, le moment venu, votre dossier et ses pièces.',
      '{{button "Ouvrir mon espace" /espace-client}}',
    ].join('\n\n'),
  },
  {
    code: 'C_ACCOUNT_ACTIVATION',
    name: 'Compte créé à l’état INVITED',
    description:
      'Compte créé à l’état INVITED sans qu’un autre e-mail porte déjà le lien d’activation : invitation par l’équipe (CRM-070), inscription sur une fiche existante (AUTH-003)',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Activez votre espace {{company.name}}',
    body: [
      "{{#if action.fromSignup}}Vous venez de créer votre espace {{company.name}}, et cette adresse nous était déjà connue. Par sécurité, nous vous demandons de choisir votre mot de passe **depuis cet e-mail** : c'est ce qui prouve que cette adresse est bien la vôtre. Ce que vous nous avez déjà confié vous attend dans votre espace.{{else}}Nous avons préparé votre espace personnel. Vous y suivrez votre projet et y déposerez vos pièces en toute sécurité. Choisissez votre mot de passe pour l'activer.{{/if}} Ce lien est valable 7 jours.",
      '{{button "Activer mon espace" action.url}}',
    ].join('\n\n'),
  },
  {
    code: 'C_ACCOUNT_EXISTS',
    name: 'Inscription avec une adresse qui a déjà un compte',
    description: 'Inscription avec une adresse qui a déjà un compte (AUTH-003)',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Vous avez déjà un espace {{company.name}}',
    body: [
      "Quelqu'un — sans doute vous — vient de demander à utiliser cette adresse pour un espace {{company.name}}. Vous en avez déjà un avec cette adresse : il suffit de vous connecter. Mot de passe oublié ? Vous pouvez en choisir un nouveau depuis la page de connexion. Si vous vouliez réunir deux espaces, contactez-nous : nous regroupons vos informations.",
      '{{button "Me connecter" /connexion}}',
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : rien n'a changé.",
    ].join('\n\n'),
  },
  {
    code: 'C_PASSWORD_RESET',
    name: '« Mot de passe oublié »',
    description: '« Mot de passe oublié »',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Réinitialisez votre mot de passe',
    body: [
      'Vous avez demandé un nouveau mot de passe. Ce lien est valable 1 heure et ne sert qu’une fois.',
      '{{button "Choisir un nouveau mot de passe" action.url}}',
      "Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe actuel reste valable.",
    ].join('\n\n'),
  },
  {
    code: 'C_PASSWORD_CHANGED',
    name: 'Mot de passe modifié',
    description: 'Mot de passe modifié',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Votre mot de passe a été modifié',
    body: [
      'Le mot de passe de votre espace vient d’être modifié. Si c’est vous, tout va bien. Sinon, réinitialisez-le tout de suite et contactez-nous.',
      '{{button "Ce n\'est pas moi" /mot-de-passe-oublie}}',
    ].join('\n\n'),
  },
  {
    code: 'C_MAGIC_LOGIN',
    name: '« Recevoir un lien de connexion »',
    description: '« Recevoir un lien de connexion »',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Votre lien de connexion',
    body: ['Voici votre lien pour vous connecter sans mot de passe. Il est valable 15 minutes et ne sert qu’une fois.', '{{button "Me connecter" action.url}}'].join('\n\n'),
  },
  {
    code: 'C_EMAIL_CHANGE_CONFIRM',
    name: 'Changement d’adresse : vers la nouvelle adresse',
    description: 'Changement d’adresse : vers la nouvelle adresse',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Confirmez votre nouvelle adresse e-mail',
    body: [
      'Vous avez demandé à utiliser cette adresse pour votre espace. Confirmez-la : le changement prendra effet aussitôt. Ce lien est valable 24 heures.',
      '{{button "Confirmer cette adresse" action.url}}',
    ].join('\n\n'),
  },
  {
    code: 'C_EMAIL_CHANGE_NOTICE',
    name: 'Changement d’adresse : vers l’ancienne adresse',
    description: 'Changement d’adresse : vers l’ancienne adresse',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: "Changement d'adresse e-mail demandé",
    body: [
      "Un changement d'adresse e-mail a été demandé pour votre espace. Tant qu'il n'est pas confirmé depuis la nouvelle adresse, rien ne change. Si vous n'êtes pas à l'origine de cette demande, modifiez votre mot de passe et contactez-nous.",
      '{{button "Sécuriser mon compte" /espace-client/profil/securite}}',
    ].join('\n\n'),
  },
  {
    code: 'C_NEW_DEVICE_LOGIN',
    name: 'Connexion depuis un nouvel appareil',
    description: 'Connexion depuis un nouvel appareil',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Nouvelle connexion à votre espace',
    body: [
      "Une connexion à votre espace vient d'avoir lieu depuis un nouvel appareil : {{action.deviceLabel}}, le {{action.dateLabel}}. Si c'est vous, vous n'avez rien à faire.",
      '{{button "Ce n\'est pas moi" /espace-client/profil/securite}}',
    ].join('\n\n'),
  },
  {
    code: 'C_TWO_FACTOR_CHANGED',
    name: 'Double authentification activée ou désactivée',
    description: 'Double authentification activée ou désactivée',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'La sécurité de votre compte a changé',
    body: [
      "La double authentification de votre espace vient d'être {{action.stateLabel}}. Si vous n'êtes pas à l'origine de ce changement, modifiez votre mot de passe et contactez-nous.",
      '{{button "Vérifier ma sécurité" /espace-client/profil/securite}}',
    ].join('\n\n'),
  },
  {
    code: 'C_ACTION_CODE',
    name: 'Code de confirmation d’une action sensible',
    description: 'Code de confirmation d’une action sensible, pour un compte sans mot de passe (AUTH-086)',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Votre code de confirmation',
    body: `Pour confirmer l'action que vous venez de demander dans votre espace, saisissez ce code : **{{action.code}}**. Il est valable 10 minutes. ${IGNORE}`,
  },
  {
    code: 'S_INVITATION',
    name: 'Invitation d’un membre du personnel',
    description: 'Invitation d’un membre du personnel',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Votre invitation sur {{company.name}}',
    body: [
      '{{#if actor.fullName}}{{actor.fullName}} vous invite à rejoindre l’équipe. {{/if}}Votre rôle sur la plateforme : {{action.roleLabel}}. Choisissez votre mot de passe, puis configurez la double authentification. Ce lien est valable 7 jours.',
      '{{button "Rejoindre l\'équipe" action.url}}',
    ].join('\n\n'),
  },
  {
    code: 'S_PASSWORD_RESET',
    name: '« Mot de passe oublié » (personnel)',
    description: '« Mot de passe oublié », pour le personnel',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Réinitialisez votre mot de passe',
    body: [
      'Vous avez demandé un nouveau mot de passe. Ce lien est valable 1 heure et ne sert qu’une fois.',
      '{{button "Choisir un nouveau mot de passe" action.url}}',
      "Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe actuel reste valable.",
    ].join('\n\n'),
  },
  {
    code: 'S_PASSWORD_CHANGED',
    name: 'Mot de passe modifié (personnel)',
    description: 'Mot de passe modifié, pour le personnel',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Votre mot de passe a été modifié',
    body: [
      'Le mot de passe de votre compte vient d’être modifié. Si c’est vous, tout va bien. Sinon, réinitialisez-le tout de suite et contactez-nous.',
      '{{button "Ce n\'est pas moi" action.adminUrl}}',
    ].join('\n\n'),
  },
  {
    code: 'S_NEW_DEVICE_LOGIN',
    name: 'Connexion depuis un nouvel appareil (personnel)',
    description: 'Connexion depuis un nouvel appareil, pour le personnel (BO-007)',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Nouvelle connexion à votre compte',
    body: [
      "Une connexion à votre compte vient d'avoir lieu depuis un nouvel appareil : {{action.deviceLabel}}, le {{action.dateLabel}}. Si c'est vous, vous n'avez rien à faire.",
      '{{button "Ce n\'est pas moi" action.adminUrl}}',
    ].join('\n\n'),
  },
  {
    code: 'S_EMAIL_CHANGE_CONFIRM',
    name: 'Changement d’adresse : vers la nouvelle adresse (personnel)',
    description: 'Changement d’adresse d’un membre du personnel : vers la nouvelle adresse (ADM-030)',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Confirmez votre nouvelle adresse e-mail',
    body: [
      'Vous avez demandé à utiliser cette adresse pour votre compte. Confirmez-la : le changement prendra effet aussitôt. Ce lien est valable 24 heures.',
      '{{button "Confirmer cette adresse" action.url}}',
    ].join('\n\n'),
  },
  {
    code: 'S_EMAIL_CHANGE_NOTICE',
    name: 'Changement d’adresse : vers l’ancienne adresse (personnel)',
    description: 'Changement d’adresse d’un membre du personnel : vers l’ancienne adresse',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: "Changement d'adresse e-mail demandé",
    body: [
      "Un changement d'adresse e-mail a été demandé pour votre compte. Tant qu'il n'est pas confirmé depuis la nouvelle adresse, rien ne change. Si vous n'êtes pas à l'origine de cette demande, modifiez votre mot de passe et contactez-nous.",
      '{{button "Sécuriser mon compte" action.adminUrl}}',
    ].join('\n\n'),
  },
  {
    code: 'S_TWO_FACTOR_CHANGED',
    name: 'Double authentification modifiée (personnel)',
    description: 'Double authentification reconfigurée, nouveaux codes de secours (BO-070)',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'La sécurité de votre compte a changé',
    body: [
      "La double authentification de votre compte vient d'être {{action.stateLabel}}. Si vous n'êtes pas à l'origine de ce changement, modifiez votre mot de passe et contactez-nous.",
      '{{button "Vérifier ma sécurité" action.adminUrl}}',
    ].join('\n\n'),
  },
  {
    // 01-domaine/09 § 4.7, § 6.7 — ROL-012, NS_TEAM_CHANGE (package 1.9). `action.summary`, `action.isSystem` (ADM-040).
    code: 'S_TEAM_CHANGE',
    name: 'Changement dans l’équipe',
    description: 'Invitation, rôle, suspension, réactivation, suppression, rétablissement, adresse ou double authentification d’un compte du personnel (ROL-012)',
    isSystem: true,
    sentBy: ['SYSTEM'],
    category: 'INTERNAL',
    subject: 'Équipe : {{action.summary}}',
    body: ['{{#if actor.fullName}}{{actor.fullName}}{{/if}}{{#if action.isSystem}}La plateforme{{/if}} a {{action.summary}} le {{action.dateLabel}}.', '{{button "Voir l\'équipe" action.adminUrl}}'].join('\n\n'),
  },
  {
    code: 'P_PARTNER_EMAIL_VERIFICATION',
    name: 'Inscription d’un partenaire',
    description: 'Inscription d’un partenaire (ACP-082) ; variante « adresse déjà utilisée » (ACP-080)',
    isSystem: true,
    sentBy: ['SYSTEM'],
    subject: 'Confirmez votre adresse pour votre candidature',
    body: [
      "{{#if action.addressInUse}}Cette adresse est déjà celle d'un compte {{company.name}}. Une adresse ne sert qu'à un seul compte : pour inscrire votre société, utilisez une autre adresse professionnelle, ou écrivez-nous.{{else}}Merci de votre candidature au réseau de partenaires de {{company.name}}. Pour que nous puissions l'étudier, confirmez votre adresse. Ce lien est valable 24 heures.\n\n{{button \"Confirmer mon adresse\" action.url}}{{/if}}",
      "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.",
    ].join('\n\n'),
  },
  {
    code: 'P_PARTNER_APPLICATION_ACK',
    name: 'Adresse d’une inscription partenaire confirmée',
    description: 'Adresse d’une inscription partenaire confirmée : l’espace est ouvert, le dossier est à compléter (ACP-082)',
    isSystem: true,
    sentBy: ['EVENT'],
    subject: 'Votre espace partenaire est ouvert',
    body: [
      "Votre adresse est confirmée : votre espace partenaire est ouvert. Il reste une étape : compléter votre dossier (votre activité et un justificatif d'immatriculation ou d'agrément). Vous pouvez le faire en plusieurs fois. Dès qu'il est envoyé, nous l'étudions et vous répondons sous {{action.reviewDaysLabel}}.",
      '{{button "Compléter mon dossier" /partenaires/connexion}}',
    ].join('\n\n'),
  },
];

function audienceOf(code: string): 'CLIENT' | 'STAFF' | 'PARTNER' {
  return code.startsWith('S_') ? 'STAFF' : code.startsWith('P_') ? 'PARTNER' : 'CLIENT';
}

/** NOT-060 `variables`: the cited fields plus those of the greeting and the signature (NOT-006). */
function variablesOf(seed: AuthTemplateSeed): string[] {
  const greeting = audienceOf(seed.code) === 'STAFF' ? ['staff.firstName'] : ['client.firstName', 'advisor.displayName'];
  return [...new Set([...citedFields(seed.subject), ...citedFields(seed.body), ...greeting])].sort();
}

/** NOT-060 `requiredVariables`: `action.url` when the button leads there outside any block, `action.code` when cited. */
function requiredOf(seed: AuthTemplateSeed): string[] {
  const out: string[] = [];
  const outside = seed.body.replace(/\{\{#if[\s\S]*?\{\{\/if\}\}/g, '');
  if (/\{\{button "[^"]*" action\.url\}\}/.test(outside)) out.push('action.url');
  if (outside.includes('{{action.code}}')) out.push('action.code');
  return out;
}

export async function installAuthEmailTemplates(tx: Tx, now: Date): Promise<string[]> {
  const created: string[] = [];
  for (const seed of AUTH_TEMPLATE_SEEDS) {
    const existing = await tx.emailTemplate.findFirst({ where: { code: seed.code, locale: 'fr', deletedAt: null }, select: { id: true } });
    if (existing) continue;
    const subject = typography(seed.subject);
    const body = typography(seed.body);
    const variables = variablesOf(seed);
    const id = newId();
    await tx.emailTemplate.create({
      data: {
        id,
        code: seed.code,
        locale: 'fr',
        audience: audienceOf(seed.code),
        category: seed.category ?? (seed.code.startsWith('P_') ? 'PARTNERS' : 'ACCOUNT'),
        name: seed.name.slice(0, 120),
        description: seed.description.slice(0, 300),
        subject,
        preheader: null,
        bodyHtml: body,
        bodyText: null,
        variables,
        requiredVariables: requiredOf(seed),
        secretVariables: variables.filter((v) => SECRET_FIELDS.includes(v)),
        preferenceGroup: null,
        originSubject: subject,
        originPreheader: null,
        originBodyHtml: body,
        isSystem: seed.isSystem,
        isActive: true,
        sentBy: seed.sentBy,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.emailTemplateVersion.create({ data: { id: newId(), templateId: id, version: 1, subject, preheader: null, bodyHtml: body, createdAt: now } });
    created.push(seed.code);
  }
  return created.length ? [`Modèles d’e-mail du compte créés : ${created.join(', ')}.`] : [];
}
