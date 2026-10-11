// Packages 3.4 to 3.6 — what the catalogue screens of the back office share (04-back-office/04): the reference data
// of their forms and pickers (`GET /admin/catalogue/reference`) and the small shapes several modules exchange.
// Each module has its own file next to this one: `admin-promoters.ts`, `admin-programs.ts`, `admin-properties.ts`,
// `admin-media.ts`.

/** A code of a closed list of the settings (`catalogue.amenities`, `catalogue.features`) with its French label. */
export interface CatalogueOption {
  code: string;
  label: string;
}

/** `GET /admin/catalogue/reference` — read once by a form or a picker. */
export interface CatalogueReference {
  /** Countries of the catalogue first (`isCatalogueActive`), then the others (a promoter may sit anywhere). */
  countries: { code: string; name: string; currency: string; catalogueActive: boolean; regionLabel: string; cityLabel: string }[];
  /** Active regions of the catalogue countries. */
  regions: { id: string; countryCode: string; name: string }[];
  /** Active cities of those regions. */
  cities: { id: string; regionId: string; name: string }[];
  /** Active values of `catalogue.amenities` (programme) and `catalogue.features` (property). */
  amenities: CatalogueOption[];
  features: CatalogueOption[];
  /** CTL-081 — the closed list of rooms of a media, stored in full, in French. */
  roomLabels: string[];
  /** Promoters not deleted, for the pickers (CTL-022: an ENDED one is not proposed for a new programme). */
  promoters: { id: string; name: string; status: 'PROSPECT' | 'ACTIVE' | 'SUSPENDED' | 'ENDED' }[];
  /** Programmes not deleted, for the pickers (CTL-041). */
  programs: { id: string; name: string; promoterId: string; publication: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; currency: string }[];
  /** Banks `ACTIVE` (CTL-130: without any, the « Financement » tab does not exist). */
  banks: { id: string; name: string }[];
  settings: {
    referenceCurrency: string;
    roomsPrefix: 'T' | 'F';
    publishMinScore: number;
    completeScore: number;
    stockCheckDays: number;
    soldVisibleDays: number;
    tour360: boolean;
    poi: boolean;
    constructionProgress: boolean;
  };
}

/** CTL-081 — rooms of a media (`Media.roomLabel`), in the order of the list. */
export const MEDIA_ROOM_LABELS = [
  'Façade',
  'Séjour',
  'Cuisine',
  'Chambre 1',
  'Chambre 2',
  'Chambre 3',
  'Chambre 4',
  'Chambre 5',
  'Salle de bain',
  'Balcon ou terrasse',
  'Vue',
  'Parties communes',
  'Parking',
  'Extérieur',
  'Autre',
] as const;

/** A public image of the back office (logo, cover, thumbnail): its id and the address of a rendition. */
export interface AdminImageRef {
  id: string;
  /** Absolute path of the `card` (or `thumb`) rendition under the media host, e.g. `/media-files/media/…/card.webp`. */
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
}
