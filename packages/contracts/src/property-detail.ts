// EP-04, EP-05 — public read models of a property page and a programme page (FIC-001 … FIC-112).
import type { Money } from './http.js';
import type { CardLabel, PropertyCard, PublicDelivery, PublicImage } from './catalogue.js';

export interface PublicMediaSet {
  /** Photos and 3D images: the property's first, then the programme's (MOD-236, FIC-011). Cover first. */
  images: (PublicImage & { caption: string | null; roomLabel: string | null })[];
  plans: (PublicImage & { caption: string | null })[];
  panos: (PublicImage & { roomLabel: string | null; caption: string | null })[];
  videos: { id: string; url: string; caption: string | null }[];
  brochure: { id: string; url: string; sizeBytes: number | null } | null;
}

export interface PublicListItem {
  code: string;
  label: string;
  icon: string | null;
}

export interface PublicLot {
  reference: string;
  floor: number | null;
  surfaceM2: string;
  terraceM2: string | null;
  orientation: string | null;
  priceRef: Money | null;
  price: Money;
  pricePerM2Ref: Money | null;
  parkingIncluded: boolean | null;
}

export interface PublicPromoter {
  slug: string;
  name: string;
  logo: PublicImage | null;
  referencesPublic: string | null;
  programCount: number;
}

export interface PublicLocation {
  region: { name: string; slug: string };
  city: { name: string; slug: string } | null;
  /** FIC-060 — centre of a ~500 m cell (0.005°), never the exact address; null → map centred on the town. */
  approx: { lat: number; lng: number } | null;
  /** FIC-060 — without coordinates: the town centre (zoom 12), else the region's (zoom 9); null when neither is known. */
  area?: { lat: number; lng: number; zoom: 9 | 12 } | null;
  pois: { label: string; category: string; minutes: number; mode: string }[];
  travelTimes: { fromCity: string; minutes: number; via: string | null }[];
}

export interface ConstructionProgress {
  stage: string;
  percent: number;
  publishedAt: string;
  note: string | null;
  photos: PublicImage[];
  history: { stage: string; publishedAt: string }[];
}

export interface PropertyDetail {
  id: string;
  reference: string;
  slug: string;
  title: string;
  description: string;
  descriptionAuto: boolean;
  type: PropertyCard['type'];
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surfaceMin: string | null;
  surfaceMax: string | null;
  terraceM2: string | null;
  landM2: string | null;
  standing: PropertyCard['standing'];
  delivery: PublicDelivery;
  availability: PropertyCard['availability'];
  label: CardLabel | null;
  features: PublicListItem[];
  priceFromRef: Money | null;
  priceIsFrom: boolean;
  priceFrom: Money | null;
  pricePerM2Ref: { min: Money; max: Money } | null;
  pricePerM2: { min: Money; max: Money } | null;
  rateDate: string | null;
  convertible: boolean;
  downPaymentRef: Money | null;
  monthlyFromRef: Money | null;
  referenceFinancing: { durationMonths: number; downPaymentPct: string; annualRateBps: number };
  financingEligible: boolean;
  islamicFinancingEligible: boolean;
  has360Tour: boolean;
  lotsAvailable: number;
  lots: PublicLot[];
  floors: { min: number; max: number } | null;
  parkingIncludedAll: boolean;
  media: PublicMediaSet;
  program: {
    slug: string;
    name: string;
    tagline: string | null;
    descriptionStart: string | null;
    totalUnits: number | null;
    amenities: PublicListItem[];
    guarantees: string | null;
    otherProperties: PropertyCard[];
  } | null;
  progress: ConstructionProgress | null;
  promoter: PublicPromoter;
  location: PublicLocation;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  isPreview: boolean;
}

export type CommercialState = 'UPCOMING' | 'ON_SALE' | 'ALL_RESERVED' | 'SOLD' | 'WITHDRAWN';

export interface ProgramDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  standing: PropertyCard['standing'];
  delivery: PublicDelivery;
  label: string | null;
  totalUnits: number | null;
  amenities: PublicListItem[];
  guarantees: string | null;
  priceFromRef: Money | null;
  monthlyFromRef: Money | null;
  lotsAvailable: number;
  state: CommercialState;
  properties: PropertyCard[];
  media: PublicMediaSet;
  progress: ConstructionProgress | null;
  promoter: PublicPromoter;
  location: PublicLocation;
  otherPrograms: { slug: string; name: string; region: string; priceFromRef: Money | null; cover: PublicImage | null }[];
  seoTitle: string | null;
  seoDescription: string | null;
  isPreview: boolean;
}

/** NAV-040 — an old slug answers with the current address (one redirect), FIC-090 an archived property 410. */
export interface DetailRedirect {
  redirect: string;
}
