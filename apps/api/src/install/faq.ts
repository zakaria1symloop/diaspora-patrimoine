// EDI-041 — starting questions of the FAQ, to be validated by Diaspora Patrimoine. PAR-081: only missing ones are
// created (natural key: slug), an existing question — maybe edited by an administrator — is never rewritten.
// « Publiée : non » = created hidden (its answer depends on an open question); « selon {indicateur} » = published with
// `requiredFeature`, so it appears and disappears with the feature (EDI-040). Placements: the financing questions also
// appear on Financements, the Café ones on Le Café (EDI-040). TRV-010 typography is applied to the literal texts.
import { newId } from '../platform/ids.js';
import { slugify } from '../platform/slug.js';
import type { Tx } from '../platform/tx.js';

type Category = 'BUYING' | 'FINANCING' | 'DOSSIER' | 'CAFE' | 'PLATFORM';
type Placement = 'FINANCEMENTS' | 'LE_CAFE' | 'NOTRE_CONCEPT';

interface FaqSeed {
  category: Category;
  question: string;
  answer: string;
  /** true · false · the feature flag it depends on. */
  published: true | false | 'features.cafe' | 'features.islamicFinance';
}

/** TRV-010: ’, and a no-break space before : ; ? ! % and inside « ». */
function typography(s: string): string {
  return s
    .replace(/'/g, '’')
    .replace(/ ([:;?!%»])/g, ' $1')
    .replace(/« /g, '« ')
    .replace(/(\d) (h|%)(?=[\s.,]|$)/g, '$1 $2');
}

const PLACEMENTS: Partial<Record<Category, Placement[]>> = { FINANCING: ['FINANCEMENTS'], CAFE: ['LE_CAFE'] };

export const FAQ_SEEDS: FaqSeed[] = [
  { category: 'BUYING', question: 'Qui peut acheter avec Diaspora Patrimoine ?', answer: "Toute personne qui souhaite acheter un bien immobilier neuf en Algérie, qu'elle vive à l'étranger ou sur place. La plateforme est pensée d'abord pour la diaspora : tout se fait à distance, avec un conseiller.", published: true },
  { category: 'BUYING', question: 'Comment sont choisis les promoteurs ?', answer: 'Nous examinons les références de chaque promoteur et les garanties de chaque programme avant de le présenter. Seuls les promoteurs avec lesquels une convention est signée figurent sur la plateforme.', published: true },
  { category: 'BUYING', question: 'Puis-je visiter un bien sans me déplacer ?', answer: 'Oui. Selon les programmes : photos, plans, vidéo, ou visite en visio avec votre conseiller. Un proche peut aussi visiter pour vous.', published: true },
  { category: 'CAFE', question: 'Dans quelle langue se passe un Café ?', answer: "En français ; les promoteurs et les banquiers présents parlent aussi l'arabe. Venez avec vos questions, dans la langue qui vous est la plus facile.", published: 'features.cafe' },
  { category: 'BUYING', question: 'Les prix sont-ils en euros ou en dinars ?', answer: "Le prix d'un bien est fixé par le promoteur en dinars algériens. Nous affichons son équivalent en euros, à titre indicatif, avec la date du taux utilisé.", published: true },
  { category: 'BUYING', question: 'Que signifie « sur plan » ?', answer: 'Le bien est vendu avant ou pendant sa construction. La fiche indique la date de livraison prévue.', published: true },
  { category: 'BUYING', question: 'Combien coûte le service de Diaspora Patrimoine ?', answer: 'À rédiger (Q-001, Q-002).', published: false },
  { category: 'BUYING', question: 'Que se passe-t-il si le promoteur livre en retard ?', answer: 'À rédiger (Q-014).', published: false },
  { category: 'BUYING', question: 'Dois-je me déplacer pour signer ?', answer: 'À rédiger (DP, JUR) : signature chez le notaire en Algérie, possibilité de procuration, documents à prévoir.', published: false },
  { category: 'FINANCING', question: "Puis-je obtenir un crédit en Algérie avec des revenus perçus à l'étranger ?", answer: "Des banques partenaires proposent des solutions pour des revenus perçus à l'étranger, selon la banque et le dossier. Le simulateur d'éligibilité vous donne une première estimation ; un conseiller l'affine avec vous.", published: true },
  { category: 'FINANCING', question: "Qu'est-ce que le financement islamique ?", answer: "Un financement sans intérêt : la banque achète le bien et vous le revend avec une marge connue à l'avance, payée par mensualités. Il est proposé par certaines banques partenaires.", published: 'features.islamicFinance' },
  { category: 'FINANCING', question: 'Quel apport faut-il prévoir ?', answer: "L'apport demandé dépend de la banque et de votre dossier. Nos exemples sont calculés avec un apport de 20 %.", published: true },
  { category: 'FINANCING', question: "Les simulateurs m'engagent-ils ?", answer: "Non. Ils donnent une estimation indicative et ne constituent pas une offre de crédit, qui relève de la banque.", published: true },
  { category: 'FINANCING', question: 'Quelles pièces devrai-je fournir ?', answer: "Une pièce d'identité, des justificatifs de domicile, de revenus et de situation professionnelle, des relevés de compte. La liste exacte dépend de votre situation ; elle vous est donnée dans votre espace.", published: true },
  { category: 'DOSSIER', question: "Comment suivre l'avancement de mon dossier ?", answer: "Dans votre espace : l'étape en cours, les pièces attendues, les messages de votre conseiller. Nous vous écrivons par e-mail dès que vous avez quelque chose à faire, et à chaque grande étape : dossier complet, réponse de la banque, réservation.", published: true },
  { category: 'DOSSIER', question: 'Mes documents sont-ils en sécurité ?', answer: "Oui. Ils sont chiffrés, hébergés dans l'Union européenne et accessibles seulement à vous et à l'équipe qui suit votre dossier. Ils ne sont transmis à une banque ou à un promoteur qu'avec votre accord.", published: true },
  { category: 'DOSSIER', question: 'Puis-je acheter à deux ?', answer: 'Oui. Un co-emprunteur peut être ajouté à votre dossier ; ses pièces se déposent dans le même espace.', published: true },
  { category: 'DOSSIER', question: "Comment se passe la réservation d'un bien ?", answer: "Votre conseiller demande au promoteur de tenir le lot pour vous (une option, jusqu'à une date). Vous signez ensuite un contrat de réservation avec le promoteur, qui peut demander un acompte. Cet acompte se verse au promoteur, jamais à Diaspora Patrimoine ; votre espace en garde la trace, et dit ce qu'il devient si le projet s'arrête.", published: true },
  { category: 'DOSSIER', question: 'Que se passe-t-il si la banque ne donne pas suite ?', answer: 'Votre conseiller étudie avec vous les autres solutions : une autre banque partenaire, un apport différent, un autre bien.', published: true },
  { category: 'CAFE', question: "Qu'est-ce que Le Café ?", answer: 'Une rencontre conviviale où un promoteur et un banquier répondent à vos questions. Vous venez avec votre projet, vous repartez avec une projection.', published: 'features.cafe' },
  { category: 'CAFE', question: 'Le Café est-il payant ?', answer: 'Non. Il est gratuit, sur inscription.', published: 'features.cafe' },
  { category: 'CAFE', question: 'Où a lieu Le Café ?', answer: "À Paris et dans le Sud de la France, au moins une fois par mois. Le lieu exact vous est envoyé par e-mail à l'inscription.", published: 'features.cafe' },
  { category: 'CAFE', question: 'Puis-je venir accompagné ?', answer: "Oui, jusqu'à quatre personnes par inscription.", published: 'features.cafe' },
  { category: 'PLATFORM', question: 'Faut-il créer un compte ?', answer: 'Non pour découvrir les biens, simuler ou envoyer une demande. Oui pour suivre votre dossier et déposer vos pièces.', published: true },
  { category: 'PLATFORM', question: 'Comment sont utilisées mes données ?', answer: 'Uniquement pour traiter votre demande et suivre votre projet. Vous pouvez à tout moment les consulter, les corriger ou demander leur suppression, depuis votre espace ou en nous écrivant.', published: true },
];

export async function installFaq(tx: Tx, now: Date): Promise<string[]> {
  const position = new Map<Category, number>();
  let created = 0;
  for (const seed of FAQ_SEEDS) {
    // sortOrder follows the table order within each category (10, 20, …).
    const rank = (position.get(seed.category) ?? 0) + 1;
    position.set(seed.category, rank);
    const question = typography(seed.question);
    const slug = slugify(question);
    const existing = await tx.faqItem.findFirst({ where: { slug, locale: 'fr' }, select: { id: true } });
    if (existing) continue;
    await tx.faqItem.create({
      data: {
        id: newId(),
        locale: 'fr',
        category: seed.category,
        question,
        slug,
        answer: typography(seed.answer),
        placements: PLACEMENTS[seed.category] ?? [],
        sortOrder: rank * 10,
        isPublished: seed.published !== false,
        requiredFeature: typeof seed.published === 'string' ? seed.published : null,
        createdAt: now,
        updatedAt: now,
      },
    });
    created++;
  }
  return created ? [`${created} questions fréquentes de départ créées (EDI-041).`] : [];
}
