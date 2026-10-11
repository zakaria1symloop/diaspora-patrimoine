// PAR-001 — every setting key is declared here: type (schema), default, level, public exposure (PAR-101).
// A key absent from the table takes its default; an unknown key is refused.
import { z } from 'zod';

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const dec = (min: number, max: number) => z.number().min(min).max(max);
const text = (max = 200) => z.string().max(max);
const email = z.union([z.literal(''), z.email()]);
const phone = z.union([z.literal(''), z.string().regex(/^\+[1-9]\d{6,14}$/)]);
const httpsUrl = z.union([z.literal(''), z.url().startsWith('https://')]);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const increasing = (arr: number[]) => arr.every((v, i) => i === 0 || v > arr[i - 1]!);
const intList = (min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z.array(z.number().int().min(min).max(max)).refine(increasing, { message: 'NOT_INCREASING' });

const pricingMethod = z.enum(['AMORTIZED_RATE', 'FLAT_MARGIN']);

export const referenceFinancingSchema = z.object({
  downPaymentPct: dec(0, 90),
  durationMonths: int(12, 480),
  annualRateBps: int(0, 3000),
  pricingMethod,
});
export type ReferenceFinancing = z.infer<typeof referenceFinancingSchema>;

export const indicativeScaleSchema = z
  .object({
    annualRateBps: int(100, 3000),
    minDurationMonths: int(12, 240),
    maxDurationMonths: int(12, 480),
    pricingMethod,
    maxDebtRatioPct: dec(10, 60),
    minDownPaymentPct: dec(0, 90),
    maxAgeAtEnd: int(50, 90).nullable(),
    minAmount: int(1000, 1_000_000),
  })
  .refine((v) => v.maxDurationMonths >= v.minDurationMonths, { message: 'MAX_BELOW_MIN' });
export type IndicativeScale = z.infer<typeof indicativeScaleSchema>;

const catalogueListItem = z.object({
  code: z.string().min(1).max(60),
  labelFr: z.string().min(1).max(120),
  icon: z.string().max(60).nullable().optional(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

interface SettingDeclaration<S extends z.ZodType = z.ZodType> {
  schema: S;
  default: z.infer<S>;
  /** 🔐 sensitive: needs settings.sensitive.manage (PAR-002). */
  sensitive?: boolean;
  /** Served by GET /public/settings/public (PAR-101). */
  public?: boolean;
}

function decl<S extends z.ZodType, P extends boolean = false>(
  d: SettingDeclaration<S> & { public?: P },
): SettingDeclaration<S> & { public: P } {
  return { ...d, public: (d.public ?? false) as P };
}

export const settingsRegistry = {
  // 1.1 Accès et organisation
  'access.agentScope': decl({ schema: z.enum(['ALL', 'ASSIGNED_ONLY']), default: 'ALL', sensitive: true }),
  'access.agentCanEditCatalogue': decl({ schema: z.boolean(), default: false, sensitive: true }),
  'leads.assignmentMode': decl({ schema: z.enum(['MANUAL', 'ROUND_ROBIN']), default: 'MANUAL' }),
  'leads.spamThreshold': decl({ schema: int(0, 100), default: 70 }),
  'dossier.maxCoBorrowers': decl({ schema: int(0, 3), default: 1 }),
  'dossier.maxGuarantors': decl({ schema: int(0, 3), default: 1 }),
  'dossier.inactivityDays': decl({ schema: int(7, 180), default: 30 }),
  'clients.inactiveAfterDays': decl({ schema: int(30, 730), default: 180 }),
  'acquisition.requireReservation': decl({ schema: z.boolean(), default: true }),
  'reservation.optionDays': decl({ schema: int(1, 60), default: 7 }),
  'reservation.maxExtensions': decl({ schema: int(0, 10), default: 2 }),
  'partner.linkValidityDays': decl({ schema: int(1, 60), default: 14 }),
  'partner.applicationReviewDays': decl({ schema: int(1, 30), default: 5, public: true }), // DEM-019: said on the confirmation
  'partner.reminderBusinessDays': decl({ schema: int(0, 30), default: 2 }),

  // 1.2 / § 3 Calendrier et délais
  'business.calendar.timezone': decl({ schema: z.string().max(64), default: 'Europe/Paris', sensitive: true, public: true }),
  'business.calendar.workdays': decl({ schema: intList(1, 7), default: [1, 2, 3, 4, 5], public: true }),
  'business.calendar.start': decl({ schema: time, default: '09:00', public: true }),
  'business.calendar.end': decl({ schema: time, default: '18:00', public: true }),
  'sla.firstContactBusinessDays': decl({ schema: int(1, 365), default: 2, public: true }),
  'sla.messageReplyBusinessDays': decl({ schema: int(1, 365), default: 1 }),
  'sla.stage.INTEREST': decl({ schema: int(1, 365), default: 1 }),
  'sla.stage.QUALIFICATION': decl({ schema: int(1, 365), default: 5 }),
  'sla.stage.MATCHING': decl({ schema: int(1, 365), default: 20 }),
  'sla.stage.DOCUMENTS': decl({ schema: int(1, 365), default: 30 }),
  'sla.stage.BANK_REVIEW': decl({ schema: int(1, 365), default: 45 }),
  'sla.stage.APPROVED': decl({ schema: int(1, 365), default: 10 }),
  'sla.stage.ACQUISITION': decl({ schema: int(1, 365), default: 90 }),

  // 1.3 Financement — PAR-041 (6,50 % : reference data, ACC-040), PAR-044
  'finance.reference.default': decl({
    schema: referenceFinancingSchema,
    default: { downPaymentPct: 20, durationMonths: 300, annualRateBps: 650, pricingMethod: 'AMORTIZED_RATE' },
  }),
  'finance.exchangeRateKind': decl({ schema: z.enum(['OFFICIAL', 'INDICATIVE']), default: 'OFFICIAL' }),
  'finance.exchangeRateMaxAgeDays': decl({ schema: int(1, 90), default: 7 }),
  'finance.indicative': decl({
    schema: indicativeScaleSchema,
    default: {
      annualRateBps: 650,
      minDurationMonths: 60,
      maxDurationMonths: 300,
      pricingMethod: 'AMORTIZED_RATE',
      maxDebtRatioPct: 35,
      minDownPaymentPct: 20,
      maxAgeAtEnd: 70,
      minAmount: 10000,
    },
  }),
  'finance.showApr': decl({ schema: z.boolean(), default: false }),
  'finance.productCheckDays': decl({ schema: int(0, 365), default: 90 }),
  'submission.shareValidityDays': decl({ schema: int(1, 30), default: 7 }),
  'submission.shareMaxDownloads': decl({ schema: int(1, 20), default: 5 }),
  'submission.packageRetentionDays': decl({ schema: int(7, 180), default: 30 }),
  'submission.defaultReviewDays': decl({ schema: int(1, 120), default: 15 }),
  'submission.followUpEveryDays': decl({ schema: int(1, 30), default: 7 }),

  // 1.4 Pièces
  'documents.defaultDueDays': decl({ schema: int(1, 60), default: 10 }),
  'documents.reminderDays': decl({ schema: intList(0).refine((a) => a.length <= 5), default: [3, 7, 14] }),
  'documents.reminderMinGapDays': decl({ schema: int(1, 14), default: 2 }),
  'documents.escalateAfterDays': decl({ schema: int(1, 30), default: 5 }),
  'documents.expiryWarningDays': decl({ schema: int(1, 60), default: 15 }),
  'documents.maxFileSizeMb': decl({ schema: int(1, 50), default: 15 }),

  // 1.5 Catalogue et affichage
  'display.referenceCurrency': decl({ schema: z.string().length(3), default: 'EUR', sensitive: true, public: true }),
  'display.roomsPrefix': decl({ schema: z.enum(['T', 'F']), default: 'T', public: true }),
  'display.frequentCountries': decl({
    schema: z.array(z.string().length(2)),
    default: ['FR', 'BE', 'CH', 'CA', 'DE', 'GB', 'ES', 'IT', 'US', 'AE', 'DZ'],
    public: true,
  }),
  'catalogue.publishMinScore': decl({ schema: int(0, 100), default: 60 }),
  'catalogue.completeScore': decl({ schema: int(0, 100), default: 85 }),
  'catalogue.soldVisibleDays': decl({ schema: int(0, 365), default: 30 }),
  'catalogue.newBadgeDays': decl({ schema: int(0, 90), default: 14, public: true }),
  'catalogue.stockCheckDays': decl({ schema: int(0, 180), default: 30 }),
  'catalogue.partnerPriceTolerancePct': decl({ schema: int(0, 100), default: 20 }),
  'catalogue.lowStockThreshold': decl({ schema: int(0, 50), default: 10 }),
  'catalogue.monthlyBudgetSteps': decl({
    schema: intList(1),
    default: [300, 400, 500, 650, 800, 1000, 1500, 2000, 3000],
    public: true,
  }),
  'catalogue.priceBudgetSteps': decl({
    schema: intList(1),
    default: [50000, 75000, 100000, 150000, 200000, 300000, 500000],
    public: true,
  }),
  // § 6 lists (PAR-060): defaults of the code, no Setting row at installation (PAR-080).
  'catalogue.amenities': decl({
    schema: z.array(catalogueListItem),
    default: [
      { code: 'GATED', labelFr: 'Résidence fermée', icon: 'lock', sortOrder: 10, isActive: true },
      { code: 'SECURITY_24H', labelFr: 'Gardiennage 24 h/24', icon: 'shield', sortOrder: 20, isActive: true },
      { code: 'VIDEO_SURVEILLANCE', labelFr: 'Vidéosurveillance', icon: 'camera', sortOrder: 30, isActive: true },
      { code: 'ELEVATOR', labelFr: 'Ascenseur', icon: 'building', sortOrder: 40, isActive: true },
      { code: 'PARKING', labelFr: 'Parking', icon: 'key', sortOrder: 50, isActive: true },
      { code: 'UNDERGROUND_PARKING', labelFr: 'Parking en sous-sol', icon: 'key', sortOrder: 60, isActive: true },
      { code: 'GREEN_SPACES', labelFr: 'Espaces verts', icon: 'tree', sortOrder: 70, isActive: true },
      { code: 'WATER_TANK', labelFr: 'Réserve d’eau', icon: 'home', sortOrder: 80, isActive: true },
      { code: 'PLAYGROUND', labelFr: 'Aire de jeux', icon: 'star', sortOrder: 90, isActive: true },
      { code: 'POOL', labelFr: 'Piscine', icon: 'sparkles', sortOrder: 100, isActive: true },
      { code: 'GYM', labelFr: 'Salle de sport', icon: 'medal', sortOrder: 110, isActive: true },
      { code: 'SHOPS', labelFr: 'Commerces en pied d’immeuble', icon: 'building', sortOrder: 120, isActive: true },
      { code: 'SCHOOL_NEARBY', labelFr: 'École à proximité', icon: 'bulb', sortOrder: 130, isActive: true },
      { code: 'MOSQUE_NEARBY', labelFr: 'Mosquée à proximité', icon: 'crescent', sortOrder: 140, isActive: true },
      { code: 'GENERATOR', labelFr: 'Groupe électrogène', icon: 'bulb', sortOrder: 150, isActive: true },
      { code: 'FIBER', labelFr: 'Fibre optique', icon: 'globe', sortOrder: 160, isActive: true },
    ],
  }),
  'catalogue.features': decl({
    schema: z.array(catalogueListItem),
    default: [
      { code: 'BALCONY', labelFr: 'Balcon', icon: 'home', sortOrder: 10, isActive: true },
      { code: 'TERRACE', labelFr: 'Terrasse', icon: 'sofa', sortOrder: 20, isActive: true },
      { code: 'GARDEN', labelFr: 'Jardin', icon: 'tree', sortOrder: 30, isActive: true },
      { code: 'SEA_VIEW', labelFr: 'Vue mer', icon: 'eye', sortOrder: 40, isActive: true },
      { code: 'OPEN_VIEW', labelFr: 'Vue dégagée', icon: 'eye', sortOrder: 50, isActive: true },
      { code: 'EQUIPPED_KITCHEN', labelFr: 'Cuisine équipée', icon: 'home', sortOrder: 60, isActive: true },
      { code: 'AIR_CONDITIONING', labelFr: 'Climatisation', icon: 'sparkles', sortOrder: 70, isActive: true },
      { code: 'CENTRAL_HEATING', labelFr: 'Chauffage central', icon: 'home', sortOrder: 80, isActive: true },
      { code: 'DOUBLE_GLAZING', labelFr: 'Double vitrage', icon: 'shield', sortOrder: 90, isActive: true },
      { code: 'FITTED_WARDROBES', labelFr: 'Placards intégrés', icon: 'folder', sortOrder: 100, isActive: true },
      { code: 'ARMORED_DOOR', labelFr: 'Porte blindée', icon: 'lock', sortOrder: 110, isActive: true },
      { code: 'INTERCOM', labelFr: 'Visiophone', icon: 'camera', sortOrder: 120, isActive: true },
      { code: 'PARKING_SPACE', labelFr: 'Place de parking', icon: 'key', sortOrder: 130, isActive: true },
      { code: 'GARAGE', labelFr: 'Garage', icon: 'key', sortOrder: 140, isActive: true },
      { code: 'CELLAR', labelFr: 'Cave', icon: 'folder', sortOrder: 150, isActive: true },
      { code: 'MASTER_SUITE', labelFr: 'Suite parentale', icon: 'bed', sortOrder: 160, isActive: true },
      { code: 'DUAL_ASPECT', labelFr: 'Traversant', icon: 'surface', sortOrder: 170, isActive: true },
      { code: 'TOP_FLOOR', labelFr: 'Dernier étage', icon: 'building', sortOrder: 180, isActive: true },
      { code: 'TURNKEY', labelFr: 'Livré fini, clés en main', icon: 'key', sortOrder: 190, isActive: true },
      { code: 'SEMI_FINISHED', labelFr: 'Livré semi-fini', icon: 'edit', sortOrder: 200, isActive: true },
    ],
  }),
  'favorites.priceDropPct': decl({ schema: dec(1, 50), default: 3 }),
  'alerts.lifetimeDays': decl({ schema: int(30, 730), default: 180 }),

  // 1.6 Le Café
  'events.brandName': decl({ schema: text(60), default: 'Le Café', public: true }),
  'events.fullBrandName': decl({ schema: text(120), default: 'Le Café Diaspora Patrimoine', public: true }),
  'events.defaultCapacity': decl({ schema: int(1, 500), default: 30 }),
  'events.maxSeatsPerRegistration': decl({ schema: int(1, 10), default: 4, public: true }),
  'events.closeHoursBefore': decl({ schema: int(0, 168), default: 24 }),
  'events.showSeatsBelow': decl({ schema: int(0, 500), default: 20, public: true }),

  // 1.7 E-mails et enquêtes
  'mail.fromName': decl({ schema: text(120), default: 'Diaspora Patrimoine' }),
  'mail.fromAddress': decl({ schema: email, default: '', sensitive: true }),
  'mail.replyTo': decl({ schema: email, default: '' }),
  'mail.quietHours': decl({ schema: z.object({ start: time, end: time }), default: { start: '20:00', end: '08:00' } }),
  'mail.maxRemindersPerDay': decl({ schema: int(1, 10), default: 2 }),
  'mail.bulkMaxRecipients': decl({ schema: int(1, 5000), default: 500 }),
  'mail.trackOpens': decl({ schema: z.boolean(), default: false, sensitive: true }),
  'mail.trackClicks': decl({ schema: z.boolean(), default: false, sensitive: true }),
  'surveys.minGapDays': decl({ schema: int(0, 90), default: 14 }),
  'surveys.reminderAfterDays': decl({ schema: int(1, 30), default: 5 }),

  // 1.8 Coordonnées et identité — an empty value is not displayed (Q-023)
  'contact.companyName': decl({ schema: z.string().min(1).max(120), default: 'Diaspora Patrimoine', public: true }),
  'contact.legalName': decl({ schema: text(), default: '', public: true }),
  'contact.registration': decl({ schema: text(), default: '', public: true }),
  'contact.address': decl({ schema: text(300), default: '', public: true }),
  'contact.phone': decl({ schema: phone, default: '', public: true }),
  'contact.whatsapp': decl({ schema: phone, default: '', public: true }),
  'contact.email': decl({ schema: email, default: '', public: true }),
  'contact.partnersEmail': decl({ schema: email, default: '', public: true }),
  'contact.openingHoursLabel': decl({
    schema: text(),
    default: 'Du lundi au vendredi, de 9 h à 18 h (heure de Paris)',
    public: true,
  }),
  'contact.social.facebook': decl({ schema: httpsUrl, default: '', public: true }),
  'contact.social.instagram': decl({ schema: httpsUrl, default: '', public: true }),
  'contact.social.linkedin': decl({ schema: httpsUrl, default: '', public: true }),
  'contact.social.youtube': decl({ schema: httpsUrl, default: '', public: true }),
  'contact.social.tiktok': decl({ schema: httpsUrl, default: '', public: true }),
  'seo.siteName': decl({ schema: text(80), default: 'Diaspora Patrimoine', public: true }),
  'seo.defaultDescription': decl({
    schema: text(160),
    default:
      'Achetez un bien immobilier neuf en Algérie depuis l’étranger : promoteurs sélectionnés, financement, accompagnement de A à Z.',
    public: true,
  }),
  'seo.allowIndexing': decl({ schema: z.boolean(), default: false, sensitive: true, public: true }),
  'analytics.enabled': decl({ schema: z.boolean(), default: false, sensitive: true, public: true }),

  // 1.9 Textes légaux courts — the only source of these notices
  'legal.monthlyFootnote': decl({
    schema: text(400),
    default:
      '*Exemple indicatif et non contractuel : mensualité hors assurance, selon la banque, la durée et le dossier.',
    sensitive: true,
    public: true,
  }),
  'legal.simulatorDisclaimer': decl({
    schema: text(400),
    default:
      'Les simulateurs fournissent une estimation indicative et ne constituent pas une offre de crédit, laquelle relève exclusivement de la banque.',
    sensitive: true,
    public: true,
  }),
  'legal.convertedPricesNote': decl({
    schema: text(),
    default: 'Prix convertis à titre indicatif.',
    sensitive: true,
    public: true,
  }),
  'legal.feesExcludedNote': decl({
    schema: text(400),
    default:
      'Hors frais d’acquisition (notaire, droits d’enregistrement), à prévoir en plus : votre conseiller vous les précise.',
    sensitive: true,
    public: true,
  }),
  'legal.illustrationNote': decl({ schema: text(80), default: 'Image d’illustration', public: true }),
  'legal.render3dNote': decl({ schema: text(80), default: 'Image 3D non contractuelle', public: true }),

  // 1.10 Sécurité, conservation, langues, maintenance
  'security.password.minLength': decl({ schema: int(8, 64), default: 10, sensitive: true }),
  'security.login.maxAttempts': decl({ schema: int(3, 20), default: 5, sensitive: true }),
  'security.login.lockMinutes': decl({ schema: int(1, 1440), default: 15, sensitive: true }),
  'security.staff.twoFactorRequired': decl({ schema: z.boolean(), default: true, sensitive: true }),
  'security.staff.idleMinutes': decl({ schema: int(5, 480), default: 60, sensitive: true }),
  'retention.trashDays': decl({ schema: int(1, 365), default: 30, sensitive: true }),
  'retention.spamDays': decl({ schema: int(1, 365), default: 90, sensitive: true }),
  'retention.anonymousSimulationDays': decl({ schema: int(1, 365), default: 30, sensitive: true }),
  'retention.unverifiedAccountDays': decl({ schema: int(1, 365), default: 30, sensitive: true }),
  'retention.notificationDays': decl({ schema: int(30, 730), default: 180, sensitive: true }),
  'retention.outboxDays': decl({ schema: int(7, 365), default: 30, sensitive: true }),
  'retention.prospectYears': decl({ schema: int(1, 10), default: 3, sensitive: true }),
  'retention.dossierYears': decl({ schema: int(1, 30), default: 5, sensitive: true }),
  'retention.auditYears': decl({ schema: int(1, 10), default: 5, sensitive: true }),
  'retention.closedDossierFilesMonths': decl({ schema: int(1, 120), default: 12, sensitive: true }),
  'retention.oldVersionMonths': decl({ schema: int(1, 120), default: 12, sensitive: true }),
  'retention.inactiveAccountYears': decl({ schema: int(1, 10), default: 3, sensitive: true }),
  'retention.partnerApplicationYears': decl({ schema: int(1, 10), default: 2, sensitive: true }),
  'retention.dataRequestYears': decl({ schema: int(1, 10), default: 5, sensitive: true }),
  'retention.maxPerRun': decl({ schema: int(50, 10000), default: 500, sensitive: true }),
  'launch.confirmations': decl({
    schema: z.record(z.string(), z.object({ byId: z.string(), at: z.string(), reason: z.string().nullable() })),
    default: {},
    sensitive: true,
  }),
  'i18n.activeLocales': decl({ schema: z.array(z.enum(['fr', 'ar', 'en'])).min(1), default: ['fr'], sensitive: true, public: true }),
  'ai.assistant.monthlyBudget': decl({ schema: dec(0, 5000), default: 150, sensitive: true }),
  'maintenance.enabled': decl({ schema: z.boolean(), default: false, public: true }),
  'maintenance.until': decl({ schema: z.iso.datetime().nullable(), default: null, public: true }),
  'clock.offsetDays': decl({ schema: int(0, 365), default: 0 }),

  // 1.11 Indicateurs de fonctionnalités — true by default (D-089)
  'features.cafe': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.multiCountry': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.islamicFinance': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.projectionRequest': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.callbackRequest': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.assistant.mode': decl({ schema: z.enum(['OFF', 'GUIDED', 'AI']), default: 'GUIDED', sensitive: true, public: true }),
  'features.monthlyBudgetSearch': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.tour360': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.constructionProgress': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.poi': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.favorites': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.searchAlerts': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.clientAppointments': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
  'features.partnerForm': decl({ schema: z.boolean(), default: true, sensitive: true, public: true }),
} as const;

export type SettingKey = keyof typeof settingsRegistry;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingsRegistry)[K]['schema']>;

/** Pattern keys (PAR-001): the variable part must be an existing Country code. */
export const settingPatterns = {
  'finance.reference.{country}': { schema: referenceFinancingSchema },
  'finance.acquisitionFeesPct.{country}': { schema: dec(0, 30) },
} as const;

export const publicSettingKeys = (Object.keys(settingsRegistry) as SettingKey[]).filter(
  (k) => (settingsRegistry[k] as SettingDeclaration).public === true,
);

export type PublicSettings = { [K in SettingKey as (typeof settingsRegistry)[K] extends { public: true } ? K : never]: SettingValue<K> } & {
  /** Holidays of the next 60 days (PAR-101), YYYY-MM-DD. */
  holidays: string[];
};
