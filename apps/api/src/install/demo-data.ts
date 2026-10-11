// PAR-082 — the demonstration set, taken from Design/donnees-de-reference.md (§ 3 biens, programmes, promoteurs;
// § 6 Le Café). Lot prices are in dinars (country currency, D-019) so that the reference rate 148,50 DA / € gives the
// euro figures of the file exactly (CAL-021): 22 275 000 DA = 150 000 €. Anything the file does not give (delivery of
// the Oran and Hydra programmes, surfaces other than B-304, lot numbers other than the seven T3, coordinates, texts)
// is a neutral illustrative value, marked as such here.

export const EUR_DZD = 148.5;
/** Euro figure of the file → price of the lot in DZD (exact at 148,50). */
export const dzd = (eur: number): string => (eur * EUR_DZD).toFixed(2);

export interface DemoPromoter {
  legalName: string;
  regionCode: string;
  registrationNumber?: string;
  foundedYear?: number;
  descriptionPublic?: string;
  referencesPublic?: string;
}

export const PROMOTERS: DemoPromoter[] = [
  {
    legalName: 'Bahia Promotion',
    regionCode: '16',
    registrationNumber: 'RC 16/00-1234567 B 21',
    foundedYear: 2009,
    descriptionPublic: 'Promoteur immobilier à Alger depuis 2009 : 17 ans d’activité, 4 programmes dont 3 en cours.',
    referencesPublic: 'Résidence El Yasmine (Chéraga).',
  },
  { legalName: 'El Djazaïr Habitat', regionCode: '16', descriptionPublic: 'Promoteur immobilier à Alger.' },
  { legalName: 'Sahel Immobilier', regionCode: '31', descriptionPublic: 'Promoteur immobilier à Oran.' },
  { legalName: 'Résidences du Littoral', regionCode: '31', descriptionPublic: 'Promoteur immobilier à Oran.' },
];

export const BANK = {
  name: 'Al Salam Bank Algeria',
  shortName: 'Al Salam Bank',
  offersIslamicFinance: true,
  descriptionPublic: 'Financement islamique « Mourabaha Habitat » (agrément BA-2008-014).',
};

export interface DemoLot {
  reference: string;
  building?: string;
  floor?: number;
  orientation?: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
  surfaceM2: number;
  terraceM2?: number;
  eur: number;
  parkingIncluded?: boolean;
  /** Off-platform status set by hand after creation (CYC-100). */
  status?: 'RESERVED' | 'SOLD';
}

export interface DemoProperty {
  type: 'APARTMENT' | 'DUPLEX';
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  surfaceM2: number;
  terraceM2?: number;
  features: string[];
  /** Typed description (≥ 300 characters, CAL-050); otherwise generated (MOD-211). */
  description?: string;
  /** Number of the reference in the file (`DP-DZ-0142` → 142): the Sequence is moved forward to it, never back. */
  referenceNumber?: number;
  /** Home pin (CTL-150). */
  featuredRank?: number;
  lots: DemoLot[];
}

export interface DemoImage {
  file: string;
  roomLabel: string;
  isCover?: boolean;
}

export interface DemoProgram {
  name: string;
  promoter: string;
  standing: 'COMFORT' | 'STANDING' | 'PREMIUM';
  regionCode: string;
  /** Commune; created in the region if the referential lacks it (PAR-022: only chief towns are installed). */
  city: string;
  tagline?: string;
  description: string;
  deliveryStatus: 'ON_PLAN' | 'UNDER_CONSTRUCTION' | 'DELIVERED';
  deliveryDate: string;
  totalUnits?: number;
  amenities: string[];
  guarantees?: string;
  latitude: number;
  longitude: number;
  images: DemoImage[];
  properties: DemoProperty[];
}

const GUARANTEES = 'Garanties annoncées par le promoteur ; votre conseiller vous en remet le détail sur demande.';

export const PROGRAMS: DemoProgram[] = [
  {
    name: 'Résidence El Yasmine',
    promoter: 'Bahia Promotion',
    standing: 'COMFORT',
    regionCode: '16',
    city: 'Chéraga',
    tagline: 'À quinze minutes du centre d’Alger',
    description:
      'Résidence fermée de 3 bâtiments de 5 étages à Chéraga, à quinze minutes du centre d’Alger : 64 logements du T2 au T5, ' +
      'gardiennage, ascenseur, parking en sous-sol, jardin et aire de jeux. Chantier avancé à 40 %, livraison prévue au quatrième trimestre 2027.',
    deliveryStatus: 'UNDER_CONSTRUCTION',
    deliveryDate: '2027-10-01', // T4 2027
    totalUnits: 64,
    amenities: ['GATED', 'SECURITY_24H', 'ELEVATOR', 'UNDERGROUND_PARKING', 'GREEN_SPACES', 'PLAYGROUND'],
    guarantees: GUARANTEES,
    latitude: 36.7563, // illustrative
    longitude: 2.9587,
    images: [
      { file: 'property-el-yasmine-1.jpg', roomLabel: 'Façade', isCover: true },
      { file: 'property-el-yasmine-2.jpg', roomLabel: 'Séjour' },
      { file: 'property-el-yasmine-3.jpg', roomLabel: 'Extérieur' },
    ],
    properties: [
      {
        type: 'APARTMENT',
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        surfaceM2: 85,
        terraceM2: 12,
        referenceNumber: 142,
        featuredRank: 1,
        features: ['TERRACE', 'EQUIPPED_KITCHEN', 'DOUBLE_GLAZING', 'ARMORED_DOOR', 'INTERCOM', 'PARKING_SPACE'],
        description:
          'Appartement de 85 m² avec 12 m² de terrasse dans la Résidence El Yasmine, à Chéraga : un séjour ouvert sur la terrasse, ' +
          'deux chambres, une salle de bain, une cuisine équipée et une place de parking en sous-sol. La résidence, fermée et gardée, ' +
          'réunit trois bâtiments de cinq étages autour d’un jardin et d’une aire de jeux, à quinze minutes du centre d’Alger. ' +
          'Livraison prévue au quatrième trimestre 2027.',
        lots: [
          { reference: 'B-304', building: 'B', floor: 3, orientation: 'E', surfaceM2: 85, terraceM2: 12, eur: 150_000, parkingIncluded: true },
          { reference: 'A-102', building: 'A', floor: 1, orientation: 'W', surfaceM2: 84, terraceM2: 12, eur: 152_000, parkingIncluded: true },
          { reference: 'B-404', building: 'B', floor: 4, orientation: 'E', surfaceM2: 85, terraceM2: 12, eur: 154_000, parkingIncluded: true },
          { reference: 'A-302', building: 'A', floor: 3, orientation: 'W', surfaceM2: 84, terraceM2: 12, eur: 156_000, parkingIncluded: true },
          { reference: 'B-504', building: 'B', floor: 5, orientation: 'E', surfaceM2: 85, terraceM2: 12, eur: 158_000, parkingIncluded: true },
          { reference: 'A-402', building: 'A', floor: 4, orientation: 'W', surfaceM2: 84, terraceM2: 12, eur: 161_000, parkingIncluded: true },
          { reference: 'A-502', building: 'A', floor: 5, orientation: 'W', surfaceM2: 84, terraceM2: 12, eur: 165_000, parkingIncluded: true },
        ],
      },
      {
        type: 'APARTMENT',
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        surfaceM2: 62, // illustrative
        features: ['BALCONY', 'EQUIPPED_KITCHEN', 'DOUBLE_GLAZING', 'ARMORED_DOOR', 'INTERCOM'],
        lots: [
          { reference: 'A-101', building: 'A', floor: 1, surfaceM2: 62, eur: 118_000 },
          { reference: 'C-201', building: 'C', floor: 2, surfaceM2: 63, eur: 121_000 },
          { reference: 'C-301', building: 'C', floor: 3, surfaceM2: 64, eur: 124_000 },
        ],
      },
      {
        type: 'APARTMENT',
        rooms: 4,
        bedrooms: 3,
        bathrooms: 2,
        surfaceM2: 105, // illustrative
        features: ['BALCONY', 'EQUIPPED_KITCHEN', 'DOUBLE_GLAZING', 'ARMORED_DOOR', 'INTERCOM', 'PARKING_SPACE'],
        lots: [{ reference: 'C-401', building: 'C', floor: 4, surfaceM2: 105, eur: 186_000, parkingIncluded: true, status: 'RESERVED' }],
      },
      {
        type: 'DUPLEX',
        rooms: 5,
        bedrooms: 4,
        bathrooms: 2,
        surfaceM2: 150, // illustrative
        terraceM2: 20,
        features: ['TERRACE', 'EQUIPPED_KITCHEN', 'DOUBLE_GLAZING', 'ARMORED_DOOR', 'INTERCOM', 'PARKING_SPACE', 'MASTER_SUITE', 'TOP_FLOOR'],
        lots: [
          { reference: 'A-505', building: 'A', floor: 4, surfaceM2: 150, terraceM2: 20, eur: 248_000, parkingIncluded: true },
          { reference: 'B-505', building: 'B', floor: 4, surfaceM2: 155, terraceM2: 20, eur: 255_000, parkingIncluded: true },
        ],
      },
    ],
  },
  {
    name: 'Le Belvédère',
    promoter: 'El Djazaïr Habitat',
    standing: 'PREMIUM',
    regionCode: '16',
    city: 'Hydra',
    tagline: 'Sur les hauteurs d’Hydra',
    description:
      'Résidence de très haut standing sur les hauteurs d’Hydra, à Alger : appartements spacieux aux vues dégagées, ' +
      'résidence fermée sous vidéosurveillance, gardiennage, ascenseurs, parking en sous-sol, salle de sport et groupe électrogène.',
    deliveryStatus: 'UNDER_CONSTRUCTION', // illustrative
    deliveryDate: '2028-01-01', // T1 2028, illustrative
    amenities: ['GATED', 'SECURITY_24H', 'VIDEO_SURVEILLANCE', 'ELEVATOR', 'UNDERGROUND_PARKING', 'GYM', 'GENERATOR'],
    guarantees: GUARANTEES,
    latitude: 36.744,
    longitude: 3.04,
    images: [{ file: 'property-belvedere-1.jpg', roomLabel: 'Séjour', isCover: true }],
    properties: [
      {
        type: 'APARTMENT',
        rooms: 4,
        bedrooms: 3,
        bathrooms: 2,
        surfaceM2: 140, // illustrative
        terraceM2: 25,
        referenceNumber: 177,
        featuredRank: 3,
        features: ['OPEN_VIEW', 'TERRACE', 'EQUIPPED_KITCHEN', 'AIR_CONDITIONING', 'CENTRAL_HEATING', 'MASTER_SUITE', 'PARKING_SPACE'],
        description:
          'Appartement de 140 m² avec 25 m² de terrasse au Belvédère, sur les hauteurs d’Hydra : un grand séjour ouvert sur la vue, ' +
          'trois chambres dont une suite parentale, deux salles de bain, une cuisine équipée, la climatisation et le chauffage central, ' +
          'et une place de parking en sous-sol. Résidence fermée sous vidéosurveillance, avec gardiennage et salle de sport.',
        lots: [{ reference: 'B-501', building: 'B', floor: 5, orientation: 'S', surfaceM2: 140, terraceM2: 25, eur: 410_000, parkingIncluded: true }],
      },
    ],
  },
  {
    name: 'Les Terrasses de la Baie',
    promoter: 'Sahel Immobilier',
    standing: 'STANDING',
    regionCode: '31',
    city: 'Oran',
    tagline: 'Face à la baie d’Oran',
    description:
      'Résidence de standing face à la baie d’Oran : appartements avec terrasse, résidence fermée et gardée, ascenseurs, ' +
      'parking en sous-sol, piscine et salle de sport.',
    deliveryStatus: 'UNDER_CONSTRUCTION', // illustrative
    deliveryDate: '2027-04-01', // T2 2027, illustrative
    amenities: ['GATED', 'SECURITY_24H', 'ELEVATOR', 'UNDERGROUND_PARKING', 'POOL', 'GYM'],
    guarantees: GUARANTEES,
    latitude: 35.709,
    longitude: -0.625,
    images: [{ file: 'property-terrasses-baie-1.jpg', roomLabel: 'Façade', isCover: true }],
    properties: [
      {
        type: 'APARTMENT',
        rooms: 3,
        bedrooms: 2,
        bathrooms: 2,
        surfaceM2: 95, // illustrative
        terraceM2: 15,
        referenceNumber: 203,
        featuredRank: 2,
        features: ['SEA_VIEW', 'TERRACE', 'EQUIPPED_KITCHEN', 'AIR_CONDITIONING', 'DOUBLE_GLAZING', 'PARKING_SPACE'],
        description:
          'Appartement de 95 m² avec 15 m² de terrasse aux Terrasses de la Baie, à Oran : un séjour ouvert sur la terrasse et la vue sur la mer, ' +
          'deux chambres, deux salles de bain, une cuisine équipée, la climatisation et une place de parking en sous-sol. ' +
          'La résidence, fermée et gardée, offre une piscine et une salle de sport.',
        lots: [{ reference: 'C-302', building: 'C', floor: 3, orientation: 'N', surfaceM2: 95, terraceM2: 15, eur: 240_000, parkingIncluded: true }],
      },
    ],
  },
];

export interface DemoCafe {
  locationLabel: string;
  cityName: string;
  locationCode: string;
  date: string; // Saturday, local
  venueName: string;
  /** Required to publish (CYC-180); illustrative — the exact address is sent to registrants. */
  venueAddress: string;
  registrationOpensOn?: string;
  /** Seats taken through staff registrations (EVT-011): capacity 30 − 18 = « Il reste 12 places ». */
  seatsTaken: number;
  withBank: boolean;
}

export const CAFES: DemoCafe[] = [
  {
    locationLabel: 'Paris',
    cityName: 'Paris',
    locationCode: 'PAR',
    date: '2026-10-17',
    venueName: 'Salon de thé du Marais',
    venueAddress: 'Le Marais, 75004 Paris (adresse d’exemple)',
    seatsTaken: 18,
    withBank: true,
  },
  {
    locationLabel: 'Marseille',
    cityName: 'Marseille',
    locationCode: 'MRS',
    date: '2026-11-14',
    venueName: 'Salon de thé',
    venueAddress: '13001 Marseille (adresse d’exemple)',
    seatsTaken: 0,
    withBank: false,
  },
  {
    locationLabel: 'Paris',
    cityName: 'Paris',
    locationCode: 'PAR',
    date: '2026-12-12',
    venueName: 'Salon de thé',
    venueAddress: '75004 Paris (adresse d’exemple)',
    registrationOpensOn: '2026-11-01',
    seatsTaken: 0,
    withBank: true,
  },
];

export const CAFE_TIMEZONE = 'Europe/Paris';
export const CAFE_HOURS = { start: '10:00', end: '13:00' };
export const CAFE_CAPACITY = 30;
export const CAFE_IMAGE = { file: 'cafe-1.jpg', alt: 'Échange autour d’une table entre un promoteur, une banque, un notaire et des visiteurs' };
