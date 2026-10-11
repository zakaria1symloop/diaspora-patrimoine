// NOT-060 — starting data of the client-space e-mails delivered with package 2.9 and EC-41 (01-domaine/09 § 6.4, § 6.6),
// in the format of NOT-061, created by the installer when missing (PAR-081). `{{> changes}}` of C_FAVORITE_UPDATE is a
// block built by the favourites job (one line per property: what changed).
import type { TemplateSeed } from '../install/email-templates.js';

/** NOT-060 — starting data of the client space's e-mails delivered with packages 2.9 / EC-41 (01-domaine/09 § 6). */
export const CLIENT_SPACE_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'C_FILE_REFUSED',
    name: 'Dépôt refusé par le contrôle de sécurité',
    description: 'Dépôt refusé par le contrôle de sécurité, en entier ou en partie, ou photos impossibles à réunir, quand le client a quitté l’écran (CYC-140)',
    category: 'DOCUMENTS',
    isSystem: false,
    subject: 'Un fichier n’a pas pu être reçu',
    body: [
      '{{#if deposit.isPartial}}Un des fichiers que vous avez déposés pour « {{documents.first.label}} » a été refusé par notre contrôle de sécurité ; les autres sont bien reçus. Vérifiez qu’il ne manque pas une page, et déposez-la à nouveau.{{else}}{{#if deposit.isUnreadable}}Nous n’avons pas pu lire une des photos déposées pour « {{documents.first.label}} » : le dépôt n’a pas été enregistré. Reprenez la photo et déposez à nouveau.{{else}}Le fichier que vous avez déposé pour « {{documents.first.label}} » a été refusé par notre contrôle de sécurité : il n’a pas été enregistré. Merci de le déposer à nouveau, si possible depuis un autre appareil.{{/if}}{{/if}} Si le problème persiste, répondez à cet e-mail.',
      '{{button "Déposer à nouveau" dossier.documentsUrl}}',
    ].join('\n\n'),
  },
  {
    code: 'C_FAVORITE_UPDATE',
    name: 'Favoris',
    description: 'AUT-062 — du nouveau sur les favoris du client (baisse de prix, derniers lots, bien plus disponible), un e-mail par jour',
    category: 'ALERTS',
    isSystem: false,
    preferenceGroup: 'ALERTS',
    subject: 'Du nouveau sur vos favoris',
    body: ['{{> changes}}', '{{button "Voir mes favoris" favorites.url}}'].join('\n\n'),
  },
];

