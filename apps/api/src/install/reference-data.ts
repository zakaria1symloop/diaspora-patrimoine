// PAR-020, PAR-021, PAR-031, PAR-042, § 11 — installation data required for the platform to work.
// Not demonstration data (PAR-082): no promoter, property, client or event is created here.

export const WILAYAS: [code: string, name: string][] = [
  ['01', 'Adrar'], ['02', 'Chlef'], ['03', 'Laghouat'], ['04', 'Oum El Bouaghi'], ['05', 'Batna'], ['06', 'Béjaïa'],
  ['07', 'Biskra'], ['08', 'Béchar'], ['09', 'Blida'], ['10', 'Bouira'], ['11', 'Tamanrasset'], ['12', 'Tébessa'],
  ['13', 'Tlemcen'], ['14', 'Tiaret'], ['15', 'Tizi Ouzou'], ['16', 'Alger'], ['17', 'Djelfa'], ['18', 'Jijel'],
  ['19', 'Sétif'], ['20', 'Saïda'], ['21', 'Skikda'], ['22', 'Sidi Bel Abbès'], ['23', 'Annaba'], ['24', 'Guelma'],
  ['25', 'Constantine'], ['26', 'Médéa'], ['27', 'Mostaganem'], ['28', 'M’Sila'], ['29', 'Mascara'], ['30', 'Ouargla'],
  ['31', 'Oran'], ['32', 'El Bayadh'], ['33', 'Illizi'], ['34', 'Bordj Bou Arréridj'], ['35', 'Boumerdès'], ['36', 'El Tarf'],
  ['37', 'Tindouf'], ['38', 'Tissemsilt'], ['39', 'El Oued'], ['40', 'Khenchela'], ['41', 'Souk Ahras'], ['42', 'Tipaza'],
  ['43', 'Mila'], ['44', 'Aïn Defla'], ['45', 'Naâma'], ['46', 'Aïn Témouchent'], ['47', 'Ghardaïa'], ['48', 'Relizane'],
  ['49', 'Timimoun'], ['50', 'Bordj Badji Mokhtar'], ['51', 'Ouled Djellal'], ['52', 'Béni Abbès'], ['53', 'In Salah'],
  ['54', 'In Guezzam'], ['55', 'Touggourt'], ['56', 'Djanet'], ['57', 'El M’Ghair'], ['58', 'El Meniaa'],
];

/** PAR-031 — French calendar. Recurring days are stored with the year 2000. */
export const HOLIDAYS: { date: string; label: string; recurring: boolean }[] = [
  { date: '2000-01-01', label: 'Jour de l’an', recurring: true },
  { date: '2000-05-01', label: 'Fête du Travail', recurring: true },
  { date: '2000-05-08', label: 'Victoire 1945', recurring: true },
  { date: '2000-07-14', label: 'Fête nationale', recurring: true },
  { date: '2000-08-15', label: 'Assomption', recurring: true },
  { date: '2000-11-01', label: 'Toussaint', recurring: true },
  { date: '2000-11-11', label: 'Armistice 1918', recurring: true },
  { date: '2000-12-25', label: 'Noël', recurring: true },
  { date: '2026-04-06', label: 'Lundi de Pâques', recurring: false },
  { date: '2026-05-14', label: 'Ascension', recurring: false },
  { date: '2026-05-25', label: 'Lundi de Pentecôte', recurring: false },
  { date: '2027-03-29', label: 'Lundi de Pâques', recurring: false },
  { date: '2027-05-06', label: 'Ascension', recurring: false },
  { date: '2027-05-17', label: 'Lundi de Pentecôte', recurring: false },
  { date: '2028-04-17', label: 'Lundi de Pâques', recurring: false },
  { date: '2028-05-25', label: 'Ascension', recurring: false },
  { date: '2028-06-05', label: 'Lundi de Pentecôte', recurring: false },
];

/** PAR-042 — starting exchange rate, an indicative example the dashboard flags. */
export const EXCHANGE_RATE = { from: 'EUR', to: 'DZD', kind: 'OFFICIAL' as const, rate: '148.50', source: 'exemple indicatif' };

const ol = (items: [string, string][]) =>
  `<ol>${items.map(([title, body]) => `<li><strong>${title}</strong> ${body}</li>`).join('')}</ol>`;
const ul = (items: [string, string][]) =>
  `<ul>${items.map(([title, body]) => `<li><strong>${title}</strong> ${body}</li>`).join('')}</ul>`;

/** § 11 — version « 0.1 – projet » of each text, in force from installation (PAR-083). */
export const LEGAL_VERSION = '0.1 – projet';
export const LEGAL_TEXTS: { type: 'TERMS_OF_USE' | 'PRIVACY_POLICY' | 'LEGAL_NOTICE' | 'COOKIE_POLICY' | 'PARTNER_CHARTER'; title: string; body: string }[] = [
  {
    type: 'TERMS_OF_USE',
    title: 'Conditions générales d’utilisation',
    body: ol([
      ['Objet.', 'Le site présente des biens immobiliers proposés par des promoteurs partenaires et permet d’être accompagné dans un projet d’acquisition, y compris dans la recherche d’un financement. Ces conditions encadrent l’usage du site et de l’espace client.'],
      ['Espace client.', 'Il est personnel. Vous gardez votre mot de passe secret et fournissez des informations exactes.'],
      ['Informations indicatives.', 'Prix, disponibilités, mensualités et résultats des simulateurs sont donnés à titre indicatif. Seuls les documents remis par le promoteur et l’offre écrite d’une banque font foi.'],
      ['Aucun engagement.', 'Une demande, une simulation ou l’ouverture d’un espace n’engagent ni vous, ni Diaspora Patrimoine, ni un promoteur, ni une banque.'],
      ['Service.', 'Nous veillons à la disponibilité du site, sans pouvoir la garantir en permanence.'],
      ['Données personnelles.', 'Leur traitement est décrit dans la politique de confidentialité.'],
      ['Évolution.', 'Une nouvelle version de ces conditions vous est présentée à votre prochaine connexion.'],
    ]),
  },
  {
    type: 'PRIVACY_POLICY',
    title: 'Politique de confidentialité',
    body: ol([
      ['Responsable du traitement :', 'Diaspora Patrimoine, dont l’identité figure dans les mentions légales. Son prestataire technique, SYMLOOP, traite les données pour son compte.'],
      ['Données :', 'votre identité et vos coordonnées, les informations sur votre projet et, si vous constituez un dossier, les pièces utiles à son financement.'],
      ['Finalités :', 'répondre à vos demandes ; suivre votre projet et votre dossier ; le transmettre à une banque ou à un promoteur, avec votre accord ; vous envoyer nos actualités si vous l’avez accepté ; assurer la sécurité de la plateforme.'],
      ['Destinataires :', 'l’équipe de Diaspora Patrimoine ; avec votre accord, la banque ou le promoteur concerné par votre dossier ; nos prestataires techniques (hébergement dans l’Union européenne, envoi des e-mails), liés par contrat.'],
      ['Durée :', 'le temps nécessaire à ces finalités, puis celui que la loi impose.'],
      ['Vos droits :', 'accès, rectification, effacement, limitation, opposition, portabilité, et retrait de votre consentement à tout moment. Vous pouvez aussi saisir l’autorité de protection des données compétente.'],
    ]),
  },
  {
    type: 'LEGAL_NOTICE',
    title: 'Mentions légales',
    body: ul([
      ['Éditeur :', 'Diaspora Patrimoine, identifié en tête de cette page. Directeur de la publication : son représentant légal.'],
      ['Conception et réalisation :', 'SYMLOOP.'],
      ['Hébergement :', 'un prestataire établi dans l’Union européenne, dont le nom et l’adresse sont précisés dans la version définitive.'],
      ['Propriété :', 'les textes, photographies et marques du site ne peuvent être reproduits sans autorisation ; les visuels fournis par les promoteurs restent leur propriété.'],
    ]),
  },
  {
    type: 'COOKIE_POLICY',
    title: 'Politique de cookies',
    body: '<p>Le site dépose les seuls cookies nécessaires à son fonctionnement : connexion à l’espace client, sécurité des formulaires, mémorisation de vos choix, simulations faites sans compte. Aucun ne sert à la publicité. La mesure d’audience, si elle est activée, n’est déposée qu’avec votre accord, que vous pouvez retirer à tout moment par « Gérer mes cookies ». La liste des cookies et leur durée figurent ci-dessous.</p>',
  },
  {
    type: 'PARTNER_CHARTER',
    title: 'Charte des partenaires',
    body: ol([
      ['Objet.', 'Cette charte s’applique aux promoteurs et aux banques qui créent un espace partenaire. La convention signée après l’acceptation d’une candidature la complète et prévaut sur elle.'],
      ['Inscription.', 'Elle est gratuite et n’engage à rien avant la convention. Les informations et les justificatifs fournis sont exacts ; Diaspora Patrimoine les examine et peut refuser une candidature.'],
      ['Le client a un seul interlocuteur.', 'Les échanges avec les clients passent par l’équipe de Diaspora Patrimoine. Les coordonnées du partenaire ne sont pas publiées sur le site.'],
      ['Informations exactes.', 'Les prix, les disponibilités et les descriptifs transmis par un promoteur, les conditions transmises par une banque, sont exacts et tenus à jour. Ce qui est montré au public ou au client est relu par l’équipe avant d’être publié.'],
      ['Confidentialité.', 'Les informations reçues sur un client et son dossier ne servent qu’à l’étude de son projet, et sont protégées comme le veut la réglementation sur les données personnelles.'],
      ['Évolution.', 'Une nouvelle version de cette charte est présentée au partenaire à sa prochaine connexion.'],
    ]),
  },
];
