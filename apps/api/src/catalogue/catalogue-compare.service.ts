// CAT-092 (comparator, `GET /public/properties/compare?refs=`) and SFA-021/SFA-022 (favourites kept in the browser,
// read back by `GET /public/properties/cards?refs=`). Both read the database for the few references asked: a property
// that left the listable catalogue (withdrawn, sold long ago, archived) must still be described, which the 30 s index
// does not do.
import { Injectable } from '@nestjs/common';
import {
  COMPARE_MAX,
  FAVORITES_MAX_ANONYMOUS,
  type CompareItem,
  type CompareResponse,
  type FavoriteEntry,
  type FavoritesResponse,
  type PropertyCard,
  type PropertyDetail,
} from '@dp/contracts';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { CatalogueDetailService } from './catalogue-detail.service.js';
import { CatalogueIndex } from './catalogue-index.js';
import { CatalogueService } from './catalogue.service.js';

@Injectable()
export class CatalogueCompareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly detail: CatalogueDetailService,
    private readonly catalogue: CatalogueService,
    private readonly index: CatalogueIndex,
    private readonly settings: SettingsService,
  ) {}

  private async downPaymentPct(): Promise<string> {
    return (await this.settings.get('finance.reference.default')).downPaymentPct.toFixed(2);
  }

  /** CAT-092 — one column per property; an unknown or archived reference is omitted and counted in `missing`. */
  async compare(refs: string[]): Promise<CompareResponse> {
    const wanted = refs.slice(0, COMPARE_MAX);
    const rows = wanted.length
      ? await this.prisma.property.findMany({ where: { reference: { in: wanted }, deletedAt: null }, select: { reference: true, slug: true, publication: true } })
      : [];
    const data: CompareItem[] = [];
    let missing = 0;
    for (const ref of wanted) {
      const row = rows.find((r) => r.reference === ref);
      if (!row || row.publication !== 'PUBLISHED') {
        missing++;
        continue;
      }
      let d: PropertyDetail;
      try {
        const res = await this.detail.property(row.slug);
        if ('redirect' in res) {
          missing++;
          continue;
        }
        d = res;
      } catch (e) {
        if (e instanceof AppError) {
          missing++;
          continue;
        }
        throw e;
      }
      data.push(this.toItem(d));
    }
    return { data, missing, referenceDownPaymentPct: await this.downPaymentPct() };
  }

  private toItem(d: PropertyDetail): CompareItem {
    const withdrawn = d.availability === 'WITHDRAWN';
    const cover = d.media.images[0];
    const card: PropertyCard = {
      id: d.id,
      reference: d.reference,
      slug: d.slug,
      title: d.title,
      type: d.type,
      rooms: d.rooms,
      standing: d.standing,
      region: d.location.region,
      city: d.location.city,
      program: d.program ? { name: d.program.name, slug: d.program.slug } : null,
      surfaceMin: d.surfaceMin,
      surfaceMax: d.surfaceMax,
      delivery: d.delivery,
      availability: d.availability,
      // FIC-082 — a withdrawn property shows no price.
      priceFromRef: withdrawn ? null : d.priceFromRef,
      priceIsFrom: d.priceIsFrom,
      downPaymentRef: d.availability === 'AVAILABLE' ? d.downPaymentRef : null,
      // CAT-043 — the monthly payment of a property that is no longer available is hidden; CAL-022 rounding as on cards.
      monthlyFromRef: d.availability === 'AVAILABLE' ? d.monthlyFromRef : null,
      label: d.label,
      cover: cover
        ? { id: cover.id, base: cover.base, width: cover.width, height: cover.height, alt: cover.alt, blur: cover.blur, isIllustration: cover.isIllustration, isRender3d: cover.isRender3d, renditions: cover.renditions, formats: cover.formats }
        : null,
      has360Tour: d.has360Tour,
      financingEligible: d.financingEligible,
    };
    return {
      card,
      priceFrom: withdrawn ? null : d.priceFrom,
      bathrooms: d.bathrooms,
      floors: d.floors,
      lotsAvailable: d.lotsAvailable,
      promoter: { slug: d.promoter.slug, name: d.promoter.name },
      program: d.program ? { slug: d.program.slug, name: d.program.name } : null,
      features: d.features.map((f) => ({ code: f.code, label: f.label })),
      pois: d.location.pois,
      travelTimes: d.location.travelTimes,
    };
  }

  /** SFA-022 — the browser's favourites read back, in the order given (the site orders them by date added). */
  async favorites(refs: string[]): Promise<FavoritesResponse> {
    const wanted = refs.slice(0, FAVORITES_MAX_ANONYMOUS);
    const [rows, listable] = await Promise.all([
      wanted.length
        ? this.prisma.property.findMany({
            where: { reference: { in: wanted }, deletedAt: null },
            select: { id: true, reference: true, title: true, publication: true, archivedAt: true, firstPublishedAt: true },
          })
        : Promise.resolve([]),
      this.index.rows(),
    ]);
    const onlineRows = listable.filter((p) => wanted.includes(p.reference));
    const cards = new Map((await this.catalogue.toCards(onlineRows)).map((c) => [c.reference, c]));
    const data: FavoriteEntry[] = wanted.map((reference) => {
      const card = cards.get(reference);
      if (card) return { reference, state: 'ONLINE', card };
      const row = rows.find((r) => r.reference === reference);
      // Never published: nothing to say about it publicly.
      if (!row || !row.firstPublishedAt) return { reference, state: 'UNKNOWN' };
      return { reference, state: 'GONE', title: row.title, archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null };
    });
    return { data, referenceDownPaymentPct: await this.downPaymentPct() };
  }
}
