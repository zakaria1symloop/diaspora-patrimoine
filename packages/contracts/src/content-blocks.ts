// CMS-001, CMS-020 — the list of content blocks is fixed by the code; the back office changes values, never keys.
// `origin` is the text of the validated mockup (PAR-080, PAR-081): installed once, kept as `originValue`.
// Blocks are added here with the screens that use them (PAR-080, last paragraph).
import { z } from 'zod';

import type { ContentBlockType } from './enums.js';

export interface ContentBlockDeclaration {
  group: string;
  label: string;
  type: ContentBlockType;
  origin: unknown;
  /** Validates a value written by the back office (MOD-012). */
  schema: z.ZodType;
}

const text = z.string().max(2000);
const richText = z.string().max(50_000);
const image = z.object({ mediaId: z.uuid(), alt: z.string().max(200) }).nullable();

const comparisonColumn = z.object({
  label: z.string().max(40),
  title: z.string().max(120),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  downPayment: z.string().regex(/^\d+(\.\d{1,2})?$/),
  monthly: z.string().regex(/^\d+(\.\d{1,2})?$/),
  durationMonths: z.number().int().min(12).max(480).nullable(),
  annualRateBps: z.number().int().min(0).max(3000).nullable(),
});
export const comparisonBlockSchema = z.object({
  currency: z.string().length(3),
  left: comparisonColumn,
  right: comparisonColumn,
  propertyId: z.uuid().nullable(),
  visible: z.boolean().default(true),
});
export type ComparisonBlock = z.infer<typeof comparisonBlockSchema>;

const titledItems = z.array(z.object({ title: z.string().max(120), text: z.string().max(600) }));
export const whyItemsSchema = z.array(
  z.object({ title: z.string().max(60), text: z.string().max(600), image: image.optional() }),
);
export const financingItemsSchema = z.array(
  z.object({
    key: z.enum(['credit', 'islamic', 'expertise']),
    overline: z.string().max(60),
    title: z.string().max(120),
    text: z.string().max(400),
    points: z.array(z.string().max(120)).max(3),
    visible: z.boolean(),
  }),
);

function block(group: string, label: string, type: ContentBlockType, origin: unknown, schema: z.ZodType): ContentBlockDeclaration {
  return { group, label, type, origin, schema };
}

const G_BRAND = 'Marque';
const G_HOME = 'Accueil';
const G_FOOTER = 'Pied de page';
const G_SEO = 'Référencement';
const G_CONCEPT = 'Notre concept';
const G_FINANCING = 'Financements';
const G_PROMOTERS = 'Promoteurs';
const G_CONTACT = 'Contact';

// Editorial pages (EDI-010, EDI-011, EDI-070)
export const conceptAnswersSchema = z.array(z.object({ problem: z.string().max(200), answer: z.string().max(200) })).length(2);
export const conceptStepsSchema = z.object({
  steps: z
    .array(z.object({ title: z.string().max(80), text: z.string().max(300), textWithCafe: z.string().max(300).nullable() }))
    .length(6),
  reservation: z.string().max(600),
});
export const keyFiguresSchema = z.array(z.object({ value: z.string().max(20), label: z.string().max(80) })).length(4);
export type ConceptAnswers = z.infer<typeof conceptAnswersSchema>;
export type ConceptSteps = z.infer<typeof conceptStepsSchema>;
export type KeyFigures = z.infer<typeof keyFiguresSchema>;

export const contentBlocks = {
  // Marque
  'brand.tagline': block(G_BRAND, 'Devise sous le mot-symbole', 'TEXT', 'La plateforme de l’immobilier neuf en Afrique', text),

  // Pied de page (NAV-020)
  'footer.cafeLine': block(G_FOOTER, 'Ligne du Café', 'TEXT', 'Le Café : à Paris et dans le Sud de la France', text),
  'footer.note': block(G_FOOTER, 'Note', 'TEXT', '*Exemples chiffrés indicatifs et non contractuels.', text),

  // Catalogue (CAT-001)
  'listing.intro': block('Catalogue', 'Introduction', 'TEXT', 'Des biens neufs sélectionnés auprès de promoteurs partenaires, avec leur prix.', text),
  'listing.introMonthly': block(
    'Catalogue',
    'Introduction avec mensualités',
    'TEXT',
    'Des biens neufs sélectionnés auprès de promoteurs partenaires, avec leur prix et leur mensualité indicative.',
    text,
  ),
  'listing.help': block(
    'Catalogue',
    'Appel « Vous ne trouvez pas le bien idéal ? »',
    'JSON',
    {
      title: 'Vous ne trouvez pas le bien idéal ?',
      text: 'Décrivez votre projet et votre budget : un conseiller vous rappelle et vous propose des biens adaptés à votre capacité de financement.',
    },
    z.object({ title: text, text }),
  ),

  // Fiche (FIC-052, FIC-020)
  'propertyPage.reassurance': block(
    'Fiche',
    'Réassurance sous les boutons',
    'JSON',
    { line1: 'Un conseiller vous rappelle sous 48 h ouvrées', line2: 'Sans engagement' },
    z.object({ line1: text, line2: text }),
  ),

  // Le Café (CAF-001, CAF-010)
  'cafe.intro': block(
    'Le Café',
    'Présentation',
    'TEXT',
    'Vous venez avec vos questions, vous repartez avec une projection. À Paris et dans le Sud de la France, au moins une fois par mois.',
    text,
  ),
  'cafe.steps': block(
    'Le Café',
    'Trois temps',
    'JSON',
    [
      { title: 'Vous vous inscrivez', text: 'En deux minutes. Le lieu exact vous est envoyé par e-mail.' },
      { title: 'Vous échangez', text: 'Un promoteur et un banquier répondent à vos questions, autour d’un café.' },
      { title: 'Vous repartez avec votre projection', text: 'Budget, mensualité, biens possibles : votre projet prend forme.' },
    ],
    titledItems.length(3),
  ),
  'cafe.defaultDescription': block(
    'Le Café',
    'Description par défaut d’un Café',
    'RICH_TEXT',
    '<p>Un moment convivial pour poser toutes vos questions sur l’achat d’un bien neuf en Algérie : les programmes, le financement depuis l’étranger, les délais et les démarches. Un promoteur et un banquier vous répondent, autour d’un café.</p>',
    richText,
  ),

  // Référencement (NAV-032, NAV-036)
  'home.seoTitle': block(G_SEO, 'Titre de l’accueil pour les moteurs', 'TEXT', 'Immobilier neuf en Algérie pour la diaspora – Diaspora Patrimoine', z.string().max(70)),
  'brand.shareImage': block(G_SEO, 'Image de partage', 'IMAGE', null, image),

  // Accueil — héros (ACC-010 … ACC-012)
  'home.hero.line1': block(G_HOME, 'Héros · ligne 1', 'TEXT', 'Votre projet immobilier', text),
  'home.hero.line2': block(G_HOME, 'Héros · ligne 2', 'TEXT', 'en Afrique', text),
  'home.hero.line3': block(G_HOME, 'Héros · ligne 3', 'TEXT', 'prend vie ici', text),
  'home.hero.image': block(G_HOME, 'Héros · image', 'IMAGE', null, image),
  'home.hero.cafeCard': block(
    G_HOME,
    'Héros · carte du Café',
    'JSON',
    {
      overline: 'Le Café',
      brand: 'Diaspora Patrimoine',
      text1: 'Vous venez avec vos questions, promoteur et banquier vous accueillent dans leurs espaces quand vous le souhaitez pour vous répondre.',
      text2: 'Vous repartez avec une projection, l’histoire de votre projet commence.',
      place1: 'À Paris',
      place2: 'et dans le Sud de la France',
    },
    z.object({ overline: text, brand: text, text1: text, text2: text, place1: text, place2: text }),
  ),
  'home.hero.fallbackCard': block(
    G_HOME,
    'Héros · carte de repli',
    'JSON',
    { title: 'Parlons de votre projet', text: 'Un conseiller vous rappelle, au moment qui vous convient.' },
    z.object({ title: text, text }),
  ),
  'home.hero.mentions': block(
    G_HOME,
    'Héros · mentions sous le comparatif',
    'JSON',
    { credit: 'Un crédit bancaire, une vraie garantie', islamic: 'Des solutions de financements islamiques' },
    z.object({ credit: text, islamic: text }),
  ),
  'home.comparison': block(
    G_HOME,
    'Comparatif',
    'JSON',
    {
      title1: '2 biens équivalents, 1 même apport, 2 mensualités,',
      title2: '1 seule belle opportunité de constituer ou accroître son patrimoine.',
      gapLabel: 'chaque mois',
      currency: 'EUR',
      left: { label: 'À Alger', title: 'Appartement T3 – Résidence El Yasmine', price: '150000', downPayment: '30000', monthly: '810', durationMonths: 300, annualRateBps: 650 },
      right: { label: 'En France', title: 'Appartement T3 équivalent', price: '350000', downPayment: '30000', monthly: '1600', durationMonths: 300, annualRateBps: 350 },
      leftPlace: 'Alger',
      rightPlace: 'France',
      propertyId: null,
      visible: true,
    },
    comparisonBlockSchema.extend({ title1: text, title2: text, gapLabel: text, leftPlace: text, rightPlace: text }),
  ),

  // Six motivations (ACC-045)
  'home.why.title1': block(G_HOME, 'Motivations · titre ligne 1', 'TEXT', 'Pourquoi acheter en Algérie', text),
  'home.why.title2': block(G_HOME, 'Motivations · titre ligne 2', 'TEXT', 'en {année} ?', text),
  'home.why.subtitle1': block(G_HOME, 'Motivations · sous-titre 1', 'TEXT', '6 motivations possibles pour la diaspora algérienne,', text),
  'home.why.subtitle2': block(G_HOME, 'Motivations · sous-titre 2', 'TEXT', 'et sans doute la vôtre parmi elles.', text),
  'home.why.items': block(
    G_HOME,
    'Motivations · cartes',
    'JSON',
    [
      { title: 'Sécurité', text: 'Avoir un logement à soi pour ses séjours et préparer, si on le souhaite, un retour futur. Constituer un patrimoine familial.', image: null },
      { title: 'Fierté', text: 'Concrétiser un projet dans son pays d’origine et en partager la fierté avec ses proches.', image: null },
      { title: 'Nouveauté', text: 'Découvrir des résidences contemporaines aux prestations évoluées, avec l’arrivée récente du crédit bancaire classique et islamique : une possibilité de financement avec des revenus perçus à l’étranger, selon la banque et le dossier.', image: null },
      { title: 'Confort', text: 'Choisir un appartement contemporain, décoré avec goût, ou une résidence où boulangerie, épicerie et salle de sport sont accessibles à pied, selon les programmes.', image: null },
      { title: 'Budget', text: 'Comparer ce que son budget permet d’acheter en Algérie et dans son pays de résidence, avec parfois davantage d’espace ou de prestations.', image: null },
      { title: 'Racines', text: 'Garder un lien concret avec ses racines et transmettre un lieu de repère à ses enfants.', image: null },
    ],
    whyItemsSchema,
  ),

  // Biens (ACC-050, ACC-053)
  'home.properties.title1': block(G_HOME, 'Biens · titre ligne 1', 'TEXT', 'Des biens pour', text),
  'home.properties.title2': block(G_HOME, 'Biens · titre ligne 2', 'TEXT', 'différents budgets', text),
  'home.properties.subtitle1': block(G_HOME, 'Biens · sous-titre 1', 'TEXT', 'De l’habitat confortable aux résidences de très haut standing,', text),
  'home.properties.subtitle2': block(G_HOME, 'Biens · sous-titre 2', 'TEXT', 'selon les offres de nos promoteurs sélectionnés.', text),
  'home.assistant.line1': block(G_HOME, 'Assistant · ligne 1', 'TEXT', 'Vous préférez le dire avec vos mots ?', text),
  'home.assistant.line2': block(G_HOME, 'Assistant · ligne 2', 'TEXT', 'Notre assistant vous écoute et cherche pour vous', text),

  // Le Café (ACC-060, ACC-061)
  'home.cafe.title1': block(G_HOME, 'Café · titre ligne 1', 'TEXT', 'Rencontrez promoteur et banquier', text),
  'home.cafe.title2': block(G_HOME, 'Café · titre ligne 2', 'TEXT', 'autour d’un café', text),
  'home.cafe.subtitle1': block(G_HOME, 'Café · sous-titre 1', 'TEXT', 'Vous venez avec vos questions, vous repartez avec une projection,', text),
  'home.cafe.subtitle2': block(G_HOME, 'Café · sous-titre 2', 'TEXT', 'l’histoire de votre projet commence.', text),
  'home.cafe.note': block(G_HOME, 'Café · note', 'TEXT', 'Gratuit, sur inscription. Le lieu exact vous est communiqué à l’inscription.', text),
  'home.cafe.places': block(
    G_HOME,
    'Café · lieux',
    'JSON',
    { place1: 'À Paris', place2: 'et dans le Sud de la France', rhythm: 'Au moins une fois par mois' },
    z.object({ place1: text, place2: text, rhythm: text }),
  ),
  'home.cafe.photo': block(G_HOME, 'Café · photo', 'IMAGE', null, image),

  // Services (ACC-070, ACC-071)
  'home.services.title1': block(G_HOME, 'Services · titre ligne 1', 'TEXT', 'Pourquoi choisir', text),
  'home.services.title2': block(G_HOME, 'Services · titre ligne 2', 'TEXT', 'Diaspora Patrimoine ?', text),
  'home.services.subtitle1': block(G_HOME, 'Services · sous-titre 1', 'TEXT', 'Une plateforme de mise en relation sélective', text),
  'home.services.subtitle2': block(G_HOME, 'Services · sous-titre 2', 'TEXT', 'pour acheter un bien neuf en Afrique depuis l’étranger.', text),
  'home.services.items': block(
    G_HOME,
    'Services · cartes',
    'JSON',
    [
      { title: 'Recherche autonome', text: 'Grâce à des filtres détaillés, trouvez les programmes selon la ville, votre budget et vos exigences.' },
      { title: 'Recherche avec un chatbot', text: 'Un agent est là pour vous écouter et trouver le bien que vous recherchez selon vos critères.' },
      { title: 'Promoteurs sélectionnés', text: 'Notre plateforme choisit les promoteurs et examine leurs références ainsi que les garanties de chaque programme.' },
      { title: 'Des biens pour différents budgets', text: 'De l’habitat confortable aux résidences de très haut standing, selon les offres.' },
      { title: 'Cafés Promoteurs – Diaspora', text: 'Les promoteurs viennent à votre rencontre à Paris et dans le sud de la France, autour d’un café et dans un lieu convivial, au moins une fois par mois.' },
      { title: 'Expertise financière', text: 'Un conseiller financier peut vous accompagner dans vos démarches bancaires, de manière à obtenir la meilleure offre auprès des banques partenaires européennes ou africaines.' },
      { title: 'Accompagnement administratif et consulaire', text: 'Vous avez la possibilité de nous déléguer la tâche de constitution de certaines pièces ou éléments auprès de certains services consulaires pour la constitution de votre dossier.' },
    ],
    titledItems.length(7),
  ),
  'home.services.cta': block(
    G_HOME,
    'Services · carte d’appel',
    'JSON',
    { title: 'Parlons de votre projet', text: 'Un conseiller vous rappelle, au moment qui vous convient.', button: 'Être rappelé' },
    z.object({ title: text, text, button: text }),
  ),

  // Financement et projection (ACC-080, ACC-081)
  'home.financing.title1': block(G_HOME, 'Financement · titre ligne 1', 'TEXT', 'Un crédit bancaire,', text),
  'home.financing.title2': block(G_HOME, 'Financement · titre ligne 2', 'TEXT', 'une vraie garantie', text),
  'home.financing.subtitle1': block(G_HOME, 'Financement · sous-titre 1', 'TEXT', 'Crédit classique ou financement islamique,', text),
  'home.financing.subtitle2': block(G_HOME, 'Financement · sous-titre 2', 'TEXT', 'avec des revenus perçus à l’étranger, selon la banque et le dossier.', text),
  'home.financing.subtitleNoIslamic': block(G_HOME, 'Financement · sous-titre sans financement islamique', 'TEXT', 'Avec des revenus perçus à l’étranger, selon la banque et le dossier.', text),
  'home.financing.items': block(
    G_HOME,
    'Financement · cartes',
    'JSON',
    [
      { key: 'credit', overline: 'Crédit bancaire', title: 'Un crédit bancaire, une vraie garantie', text: 'Un prêt classique auprès d’une banque partenaire, européenne ou africaine.', points: ['Des revenus perçus à l’étranger', 'Un apport de {apport} % dans notre exemple', 'Une offre étudiée selon votre dossier'], visible: true },
      { key: 'islamic', overline: 'Financement islamique', title: 'Des solutions de financements islamiques', text: 'Une alternative au crédit classique, proposée par certaines banques partenaires.', points: ['Des revenus perçus à l’étranger', 'Des solutions selon la banque', 'Une offre étudiée selon votre dossier'], visible: true },
      { key: 'expertise', overline: 'Expertise financière', title: 'Un conseiller financier à vos côtés', text: 'Il peut vous accompagner dans vos démarches bancaires, de manière à obtenir la meilleure offre.', points: ['Des banques partenaires européennes ou africaines', 'Présent aux Cafés, avec le banquier', 'Un seul interlocuteur pour votre dossier'], visible: true },
    ],
    financingItemsSchema,
  ),
  'home.projection': block(
    G_HOME,
    'Formulaire de projection',
    'JSON',
    {
      title: 'Recevez votre projection',
      badge: 'Gratuit · sans engagement',
      text: 'Trois réponses suffisent. Un conseiller vous l’envoie sous 48 h ouvrées, sans engagement.',
      button: 'Recevoir ma projection',
    },
    z.object({ title: text, badge: text, text, button: text }),
  ),
  'home.projection.fallback': block(
    G_HOME,
    'Repli « Simulez votre projet »',
    'JSON',
    { title: 'Simulez votre projet', text: 'Capacité d’emprunt, mensualité, coût total : faites le point en 2 minutes.' },
    z.object({ title: text, text }),
  ),
  'home.final.title1': block(G_HOME, 'Appel final · titre ligne 1', 'TEXT', 'L’histoire de votre projet', text),
  'home.final.title2': block(G_HOME, 'Appel final · titre ligne 2', 'TEXT', 'commence ici', text),
  'home.final.text': block(G_HOME, 'Appel final · phrase', 'TEXT', 'Venez avec vos questions, repartez avec votre projection.', text),
  'home.final.textFallback': block(G_HOME, 'Appel final · phrase de repli', 'TEXT', 'Simulez votre projet en 2 minutes, puis parlez-en avec un conseiller.', text),

  // Notre concept (EDI-010, EDI-011, EDI-070)
  'concept.intro': block(
    G_CONCEPT,
    'Introduction',
    'TEXT',
    'Une plateforme de mise en relation sélective pour acheter un bien neuf en Afrique depuis l’étranger.',
    text,
  ),
  'concept.answers': block(
    G_CONCEPT,
    'Deux freins, deux réponses',
    'JSON',
    [
      { problem: 'Vous ne rencontrez les promoteurs qu’une fois par an.', answer: 'Le Café : un promoteur et un banquier, chaque mois, près de chez vous.' },
      { problem: 'Vous ne connaissez pas le parcours bancaire.', answer: 'Un conseiller, six étapes claires, un dossier suivi en ligne.' },
    ],
    conceptAnswersSchema,
  ),
  'concept.steps': block(
    G_CONCEPT,
    'Comment ça marche · six étapes',
    'JSON',
    {
      steps: [
        {
          title: 'Découverte des biens',
          text: 'Parcourez les programmes, simulez votre financement.',
          textWithCafe: 'Parcourez les programmes, simulez votre financement, venez à un Café.',
        },
        { title: 'Expression d’intérêt', text: 'Un formulaire simple, avec ou sans compte.', textWithCafe: null },
        {
          title: 'Qualification et mise en relation',
          text: 'Un conseiller vous rappelle sous 48 h ouvrées, précise votre projet et vous propose des biens.',
          textWithCafe: null,
        },
        { title: 'Constitution du dossier', text: 'Vous déposez vos pièces en ligne ; nous les vérifions une à une.', textWithCafe: null },
        { title: 'Soumission à la banque', text: 'Nous présentons votre dossier aux banques partenaires et suivons leur réponse.', textWithCafe: null },
        { title: 'Octroi du crédit et acquisition', text: 'Accord de la banque, conditions, signature : vous êtes propriétaire.', textWithCafe: null },
      ],
      reservation:
        'Réserver un bien : votre conseiller demande au promoteur de tenir le lot pour vous (une option, jusqu’à une date). Vous signez ensuite un contrat de réservation avec le promoteur, qui peut demander un acompte. Rien ne se verse à Diaspora Patrimoine.',
    },
    conceptStepsSchema,
  ),
  'concept.support': block(
    G_CONCEPT,
    'Accompagnement administratif et consulaire',
    'RICH_TEXT',
    '<p>Vous avez la possibilité de nous déléguer la tâche de constitution de certaines pièces ou éléments auprès de certains services consulaires pour la constitution de votre dossier.</p>',
    richText,
  ),
  'concept.keyFigures': block(
    G_CONCEPT,
    'Chiffres clés',
    'JSON',
    [
      { value: '', label: '' },
      { value: '', label: '' },
      { value: '', label: '' },
      { value: '', label: '' },
    ],
    keyFiguresSchema,
  ),

  // Financements (EDI-020, EDI-022)
  'financing.credit.body': block(
    G_FINANCING,
    'Crédit classique · texte long',
    'RICH_TEXT',
    '<p>Des banques partenaires proposent des solutions pour des revenus perçus à l’étranger, selon la banque et le dossier. Le simulateur d’éligibilité vous donne une première estimation ; un conseiller l’affine avec vous.</p><p>L’apport demandé dépend de la banque et de votre dossier. Nos exemples sont calculés avec un apport de {apport} %.</p>',
    richText,
  ),
  'financing.islamic.body': block(
    G_FINANCING,
    'Financement islamique · texte long',
    'RICH_TEXT',
    '<p>Un financement sans intérêt : la banque achète le bien et vous le revend avec une marge connue à l’avance, payée par mensualités. Il est proposé par certaines banques partenaires.</p>',
    richText,
  ),
  'financing.expertise.body': block(
    G_FINANCING,
    'Expertise financière · texte long',
    'RICH_TEXT',
    '<p>Un conseiller financier peut vous accompagner dans vos démarches bancaires, de manière à obtenir la meilleure offre auprès des banques partenaires européennes ou africaines.</p>',
    richText,
  ),
  'financing.expertise.photo': block(G_FINANCING, 'Photo « Un conseiller financier à vos côtés »', 'IMAGE', null, image),
  'financing.banks.intro': block(
    G_FINANCING,
    'Banques partenaires · phrase',
    'TEXT',
    'Nous travaillons avec des banques partenaires européennes et africaines.',
    text,
  ),

  // Promoteurs (EDI-030)
  'promoters.intro': block(
    G_PROMOTERS,
    'Introduction',
    'TEXT',
    'Notre plateforme choisit les promoteurs et examine leurs références ainsi que les garanties de chaque programme.',
    text,
  ),
  'promoters.selection': block(
    G_PROMOTERS,
    'Comment nous sélectionnons',
    'RICH_TEXT',
    '<p>Nous examinons les références de chaque promoteur et les garanties de chaque programme avant de le présenter. Seuls les promoteurs avec lesquels une convention est signée figurent sur la plateforme.</p>',
    richText,
  ),

  // Contact (EDI-050)
  'contactPage.intro': block(
    G_CONTACT,
    'Introduction',
    'TEXT',
    'Une question sur un bien, le financement ou votre dossier ? Écrivez-nous : un conseiller vous répond sous 48 h ouvrées.',
    text,
  ),

  // Recevez votre projection (EP-20, DEM-013) — the form itself keeps the texts of `home.projection` (same form).
  'projectionPage.intro': block(
    'Projection',
    'Introduction',
    'TEXT',
    'Votre apport, la mensualité qui vous convient : un conseiller calcule ce que vous pouvez acheter et vous envoie les biens qui entrent dans ce budget. Gratuit et sans engagement.',
    text,
  ),
  'projectionPage.contents': block(
    'Projection',
    'Ce que contient la projection',
    'JSON',
    [
      { title: 'Votre budget d’achat', text: 'Ce que votre apport et votre mensualité permettent d’acheter.' },
      { title: 'Une mensualité indicative', text: 'Une estimation de remboursement selon la durée, à confirmer avec la banque.' },
      { title: 'Des biens à votre portée', text: 'Une sélection de biens du catalogue qui entrent dans ce budget.' },
    ],
    titledItems.max(4),
  ),

  // Devenir partenaire (EP-23, DEM-019)
  'partnerPage.intro': block(
    'Devenir partenaire',
    'Introduction',
    'TEXT',
    'Notaire, assureur, institution ou média : travaillons ensemble pour accompagner la diaspora dans son projet immobilier.',
    text,
  ),
  'partnerPage.points': block(
    'Devenir partenaire',
    'Pourquoi travailler ensemble',
    'JSON',
    [
      { title: 'Des acquéreurs accompagnés', text: 'Des clients de la diaspora, conseillés à chaque étape de leur projet.' },
      { title: 'Un interlocuteur unique', text: 'Un membre de notre équipe suit votre partenariat et répond à vos questions.' },
      { title: 'Une présence choisie', text: 'Votre présentation sur la page « Nos partenaires », si vous le souhaitez.' },
    ],
    titledItems.max(4),
  ),
  // BO-003 — the charter accepted at the first sign-in of a staff member (provisional text, PAR-083).
  'admin.charter': block(
    'Back-office',
    'Charte d’utilisation du back-office',
    'RICH_TEXT',
    '<h2>Charte d’utilisation du back-office</h2><ol><li>Mon compte est personnel : je ne prête ni mon mot de passe ni mon second facteur.</li><li>Je ne consulte les fiches et les dossiers que pour mon travail.</li><li>Les pièces des clients — identité, revenus, relevés — restent dans la plateforme : je ne les télécharge et ne les transmets que pour les besoins du dossier.</li><li>Un dossier ne part chez une banque ou chez un promoteur que par les moyens de la plateforme, et avec l’accord du client.</li><li>Ce que j’écris dans une note ou un message peut être communiqué à la personne concernée si elle le demande : j’écris des faits, avec respect.</li><li>Je signale sans attendre à la Direction un appareil perdu, un accès suspect ou un envoi fait par erreur.</li><li>Mes actions sont tracées dans un journal que la Direction peut consulter.</li></ol>',
    richText,
  ),
} as const satisfies Record<string, ContentBlockDeclaration>;

export type ContentBlockKey = keyof typeof contentBlocks;

export function isContentBlockKey(key: string): key is ContentBlockKey {
  return key in contentBlocks;
}

/** Rich text keys accept sanitised HTML only (SEC-060). */
export const richTextSchema = richText;
