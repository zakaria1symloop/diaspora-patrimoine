// PAR-050, PAR-051 — installation data: the default « Dossier client – standard » list (CLIENT_FILE, default, no filter)
// with its 14 pieces and their help texts (07-design/03 § 6). Created once, never rewritten (PAR-081: the team edits it
// in the back office, package 4.1). Natural key: the default CLIENT_FILE template.
import { newId } from '../platform/ids.js';
import type { Tx } from '../platform/tx.js';

type Category = 'IDENTITY' | 'RESIDENCE' | 'EMPLOYMENT' | 'INCOME' | 'BANKING' | 'PROPERTY';
type Role = 'PRIMARY' | 'CO_BORROWER' | 'GUARANTOR';

interface ItemSeed {
  code: string;
  label: string;
  labelWhenCash?: string;
  description: string;
  category: Category;
  isRequired: boolean;
  perParty: boolean;
  roles?: Role[];
  appliesWhen?: Record<string, unknown>;
  validityDays?: number;
  maxFiles?: number;
  providedBy?: 'CLIENT' | 'OPERATOR';
}

const ALL: Role[] = ['PRIMARY', 'CO_BORROWER', 'GUARANTOR'];
const BORROWERS: Role[] = ['PRIMARY', 'CO_BORROWER'];
const SALARIED = ['PERMANENT', 'FIXED_TERM', 'CIVIL_SERVANT'];

export const CHECKLIST_TEMPLATE_NAME = 'Dossier client – standard';
export const CHECKLIST_TEMPLATE_NOTE = 'Liste de départ à valider avec Diaspora Patrimoine (Q-008).';

export const CHECKLIST_ITEMS: ItemSeed[] = [
  { code: 'ID_PASSPORT', label: 'Passeport en cours de validité', description: 'La double page avec votre photo, bien lisible, sans reflet.', category: 'IDENTITY', isRequired: true, perParty: true, roles: ALL },
  {
    code: 'ID_RESIDENCE_PERMIT',
    label: 'Titre de séjour ou carte d’identité du pays de résidence',
    description: 'Le recto et le verso de votre titre de séjour, ou de votre carte d’identité si vous avez la nationalité de votre pays de résidence.',
    category: 'RESIDENCE',
    isRequired: true,
    perParty: true,
    roles: ALL,
    appliesWhen: { residencyStatus: ['NON_RESIDENT', 'EXPATRIATE'] },
  },
  { code: 'ID_CONSULAR_CARD', label: 'Carte consulaire', description: 'Le recto et le verso. Facultative : elle peut faciliter certaines démarches.', category: 'IDENTITY', isRequired: false, perParty: true, roles: BORROWERS, appliesWhen: { residencyStatus: ['NON_RESIDENT'] } },
  { code: 'CIVIL_BIRTH_CERT', label: 'Acte de naissance', description: 'Un extrait d’acte de naissance de moins d’un an.', category: 'IDENTITY', isRequired: true, perParty: true, roles: ALL, validityDays: 365 },
  { code: 'CIVIL_FAMILY_RECORD', label: 'Fiche familiale ou livret de famille', description: 'Les pages qui vous concernent.', category: 'IDENTITY', isRequired: false, perParty: false },
  {
    code: 'RES_PROOF_ADDRESS',
    label: 'Justificatif de domicile de moins de 3 mois',
    description: 'Une facture d’énergie, d’eau ou d’internet, ou une quittance de loyer, à votre nom, de moins de trois mois.',
    category: 'RESIDENCE',
    isRequired: true,
    perParty: true,
    roles: BORROWERS,
    validityDays: 90,
  },
  {
    code: 'EMP_CONTRACT',
    label: 'Contrat de travail ou attestation de l’employeur',
    description: 'Votre contrat de travail, ou une attestation de votre employeur de moins de trois mois qui indique votre poste et votre date d’entrée.',
    category: 'EMPLOYMENT',
    isRequired: true,
    perParty: true,
    roles: BORROWERS,
    appliesWhen: { employmentType: SALARIED, financingRequested: true },
    validityDays: 90,
  },
  {
    code: 'INC_PAYSLIPS',
    label: 'Trois derniers bulletins de salaire',
    description: 'Vos trois derniers bulletins de salaire, complets.',
    category: 'INCOME',
    isRequired: true,
    perParty: true,
    roles: BORROWERS,
    appliesWhen: { employmentType: SALARIED, financingRequested: true },
    validityDays: 90,
    maxFiles: 6,
  },
  { code: 'INC_TAX_NOTICE', label: 'Dernier avis d’imposition', description: 'Toutes les pages de votre dernier avis d’imposition.', category: 'INCOME', isRequired: true, perParty: true, roles: BORROWERS, appliesWhen: { financingRequested: true } },
  {
    code: 'INC_BUSINESS_ACCOUNTS',
    label: 'Deux derniers bilans ou déclarations de revenus professionnels',
    description: 'Vos deux derniers bilans, ou vos deux dernières déclarations de revenus professionnels.',
    category: 'INCOME',
    isRequired: true,
    perParty: true,
    roles: BORROWERS,
    appliesWhen: { employmentType: ['SELF_EMPLOYED', 'BUSINESS_OWNER'], financingRequested: true },
  },
  {
    code: 'INC_PENSION',
    label: 'Justificatif de pension de retraite',
    description: 'Votre dernier relevé ou votre attestation de pension.',
    category: 'INCOME',
    isRequired: true,
    perParty: true,
    roles: BORROWERS,
    appliesWhen: { employmentType: ['RETIRED'], financingRequested: true },
    validityDays: 365,
  },
  {
    code: 'BNK_STATEMENTS',
    label: 'Relevés de compte des trois derniers mois',
    description: 'Les relevés complets, toutes les pages, de tous vos comptes courants, sur les trois derniers mois.',
    category: 'BANKING',
    isRequired: true,
    perParty: true,
    roles: BORROWERS,
    appliesWhen: { financingRequested: true },
    validityDays: 90,
    maxFiles: 12,
  },
  {
    code: 'BNK_DOWN_PAYMENT_PROOF',
    label: 'Justificatif de l’apport',
    labelWhenCash: 'Justificatif des fonds',
    description: 'Un relevé d’épargne ou une attestation de votre banque montrant que la somme de votre apport est disponible.',
    category: 'BANKING',
    isRequired: true,
    perParty: false,
    validityDays: 90,
  },
  {
    code: 'PRP_RESERVATION_CONTRACT',
    label: 'Contrat de réservation signé',
    description: 'Le contrat de réservation signé avec le promoteur. Votre conseiller le dépose pour vous.',
    category: 'PROPERTY',
    isRequired: false,
    perParty: false,
    providedBy: 'OPERATOR',
  },
];

/** PAR-050 — creates the default list when no default CLIENT_FILE template exists. */
export async function installChecklistTemplate(tx: Tx, now: Date): Promise<string[]> {
  const existing = await tx.checklistTemplate.findFirst({ where: { scope: 'CLIENT_FILE', isDefault: true, deletedAt: null }, select: { id: true } });
  if (existing) return [];
  const templateId = newId();
  await tx.checklistTemplate.create({
    data: {
      id: templateId,
      name: CHECKLIST_TEMPLATE_NAME,
      scope: 'CLIENT_FILE',
      residencyFilter: [],
      isDefault: true,
      isActive: true,
      version: 1,
      notes: CHECKLIST_TEMPLATE_NOTE,
      createdAt: now,
      updatedAt: now,
    },
  });
  for (const [i, item] of CHECKLIST_ITEMS.entries()) {
    await tx.checklistItem.create({
      data: {
        id: newId(),
        templateId,
        addedInVersion: 1,
        code: item.code,
        label: item.label,
        labelWhenCash: item.labelWhenCash ?? null,
        description: item.description,
        category: item.category,
        isRequired: item.isRequired,
        perParty: item.perParty,
        appliesToRoles: item.roles ?? BORROWERS,
        appliesWhen: (item.appliesWhen ?? undefined) as never,
        providedBy: item.providedBy ?? 'CLIENT',
        maxFiles: item.maxFiles ?? 5,
        acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png', 'heic'],
        validityDays: item.validityDays ?? null,
        sortOrder: i + 1,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  return [`Liste de pièces de départ créée : « ${CHECKLIST_TEMPLATE_NAME} », ${CHECKLIST_ITEMS.length} pièces (PAR-050).`];
}
