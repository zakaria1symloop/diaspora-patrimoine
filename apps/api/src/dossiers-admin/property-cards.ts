// PIP-020, PIP-030, PIP-050 — a property and its lots as the dossier screens of the back office show them: photo,
// title, place, price « à partir de », publication, availability, whether its public page is online (CYC-121), its
// promoter. One reader for the record header, the tab « Biens », the proposal panel and the pickers.
import { Injectable } from '@nestjs/common';
import type { DossierPropertyCard, LotOption } from '@dp/contracts';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { pickCover, toPublicImage, type MediaRow } from '../catalogue/media.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import type { PropertyState } from './dossier-rules.js';

const PROPERTY_SELECT = {
  id: true,
  reference: true,
  slug: true,
  title: true,
  type: true,
  programId: true,
  publication: true,
  availability: true,
  archivedAt: true,
  deletedAt: true,
  priceFrom: true,
  priceCurrency: true,
  lotsAvailable: true,
  countryCode: true,
  promoterId: true,
  region: { select: { nameFr: true } },
  city: { select: { nameFr: true } },
  promoter: { select: { brandName: true, legalName: true } },
} satisfies Prisma.PropertySelect;
export type PropertyRow = Prisma.PropertyGetPayload<{ select: typeof PROPERTY_SELECT }>;

const MEDIA_SELECT = { id: true, ownerType: true, ownerId: true, kind: true, isCover: true, isIllustration: true, sortOrder: true, width: true, height: true, alt: true, roomLabel: true, renditions: true } as const;

export function lotOption(lot: { id: string; reference: string; floor: number | null; surfaceM2: { toFixed(n: number): string }; price: { toFixed(n: number): string }; status: string }, currency: string): LotOption {
  return { id: lot.id, reference: lot.reference, floor: lot.floor, surfaceM2: lot.surfaceM2.toFixed(2), price: { amount: lot.price.toFixed(2), currency }, status: lot.status as LotOption['status'] };
}

@Injectable()
export class PropertyCards {
  constructor(
    private readonly prisma: PrismaService,
    private readonly index: CatalogueIndex,
  ) {}

  /** Ids of the properties the public catalogue lists now (published, active country and promoter). */
  async onlineIds(): Promise<Set<string>> {
    return new Set((await this.index.rows()).map((r) => r.id));
  }

  /** CYC-071, CYC-121 — the state of a property for the rules (`retainRefusal`, `clientActions`). */
  state(p: Pick<PropertyRow, 'id' | 'publication' | 'deletedAt' | 'archivedAt' | 'availability' | 'lotsAvailable'>, online: Set<string>): PropertyState {
    return { publication: p.publication, deletedAt: p.deletedAt, archivedAt: p.archivedAt, availability: p.availability, lotsAvailable: p.lotsAvailable, online: online.has(p.id) };
  }

  async rows(ids: readonly string[], db: Tx | PrismaService = this.prisma): Promise<Map<string, PropertyRow>> {
    const wanted = [...new Set(ids)];
    if (!wanted.length) return new Map();
    const rows = await db.property.findMany({ where: { id: { in: wanted } }, select: PROPERTY_SELECT });
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** Cards by property id. A property deleted or archived keeps its card: the dossier still names it. */
  async cards(ids: readonly string[]): Promise<Map<string, DossierPropertyCard>> {
    const rows = await this.rows(ids);
    const out = new Map<string, DossierPropertyCard>();
    if (!rows.size) return out;
    const list = [...rows.values()];
    const ownerIds = list.flatMap((p) => [p.id, p.programId].filter((x): x is string => Boolean(x)));
    const [online, media] = await Promise.all([
      this.onlineIds(),
      this.prisma.media.findMany({ where: { ownerId: { in: ownerIds }, ownerType: { in: ['PROPERTY', 'PROGRAM'] }, kind: { in: ['PHOTO', 'RENDER_3D'] }, processingStatus: 'READY', deletedAt: null, isPublic: true }, select: MEDIA_SELECT }),
    ]);
    for (const p of list) {
      const cover = pickCover(media.filter((m) => m.ownerId === p.id) as MediaRow[]) ?? pickCover(media.filter((m) => m.ownerId === p.programId) as MediaRow[]);
      const isOnline = online.has(p.id);
      out.set(p.id, {
        id: p.id,
        reference: p.reference,
        title: p.title,
        city: p.city?.nameFr ?? null,
        region: p.region?.nameFr ?? null,
        type: p.type,
        photo: cover ? toPublicImage(this.index.mediaUrl, cover, p.title) : null,
        publication: p.publication,
        availability: p.availability,
        online: isOnline,
        publicPath: isOnline ? `/biens/${p.slug}` : null,
        priceFrom: p.priceFrom === null ? null : { amount: p.priceFrom.toFixed(2), currency: p.priceCurrency },
        lotsAvailable: p.lotsAvailable,
        promoterName: p.promoter.brandName ?? p.promoter.legalName,
      });
    }
    return out;
  }

  /** The lots of a property, AVAILABLE ones first when `onlyAvailable` is false. */
  async lots(propertyId: string, onlyAvailable: boolean): Promise<LotOption[]> {
    const [lots, p] = await Promise.all([
      this.prisma.lot.findMany({ where: { propertyId, deletedAt: null, ...(onlyAvailable ? { status: 'AVAILABLE' } : {}) }, orderBy: [{ sortOrder: 'asc' }, { reference: 'asc' }], select: { id: true, reference: true, floor: true, surfaceM2: true, price: true, status: true } }),
      this.prisma.property.findUnique({ where: { id: propertyId }, select: { priceCurrency: true } }),
    ]);
    return lots.map((l) => lotOption(l, p?.priceCurrency ?? ''));
  }
}
