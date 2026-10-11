// DEM-011, DEM-012, DEM-014, DEM-015 — the object of a request (property, lot, program), resolved from what the form
// sent in `context`, and DEM-026: what happened to the property between the display and the submission.
import { AppError } from '../platform/errors.js';
import type { Tx } from '../platform/tx.js';
import type { LeadContext, LeadPropertyOutcome } from '@dp/contracts';

export interface ObjectProperty {
  id: string;
  reference: string;
  slug: string;
  title: string;
  programId: string | null;
  countryCode: string;
  cityRegion: string;
  availability: string;
}

export interface ObjectProgram {
  id: string;
  slug: string;
  name: string;
  cityRegion: string;
  countryCode: string;
}

export interface ResolvedObject {
  property: ObjectProperty | null;
  program: ObjectProgram | null;
  lotId: string | null;
  /** DEM-026 / DEM-027 `propertyOutcome`. */
  outcome: LeadPropertyOutcome;
  /** DEM-026 — status of the candidate the property becomes (PROPERTY_INTEREST). */
  candidateStatus: 'INTERESTED' | 'UNAVAILABLE';
}

/** DEM-026 table: entirely reserved → RESERVED (candidate INTERESTED: an option can fall); sold, withdrawn or archived → UNAVAILABLE; offline → nothing. */
export function propertyOutcome(p: { availability: string; archivedAt: Date | null }): { outcome: LeadPropertyOutcome; candidateStatus: 'INTERESTED' | 'UNAVAILABLE' } {
  if (p.archivedAt || p.availability === 'SOLD' || p.availability === 'WITHDRAWN') return { outcome: 'UNAVAILABLE', candidateStatus: 'UNAVAILABLE' };
  if (p.availability === 'RESERVED') return { outcome: 'RESERVED', candidateStatus: 'INTERESTED' };
  return { outcome: null, candidateStatus: 'INTERESTED' };
}

const place = (city: string | null | undefined, region: string | null | undefined) => [city, region].filter(Boolean).join(', ');

/**
 * Unknown references are field errors (422). A property or program never published does not exist for the public
 * (SEC-071). A lot that is not available any more is ignored (DEM-011: « un lot indisponible est ignoré »).
 */
export async function resolveObject(tx: Tx, context: LeadContext, required: boolean): Promise<ResolvedObject> {
  const none: ResolvedObject = { property: null, program: null, lotId: null, outcome: null, candidateStatus: 'INTERESTED' };
  if (context.propertyReference) {
    const p = await tx.property.findFirst({
      where: { reference: context.propertyReference, deletedAt: null, firstPublishedAt: { not: null } },
      select: {
        id: true,
        reference: true,
        slug: true,
        title: true,
        programId: true,
        countryCode: true,
        availability: true,
        archivedAt: true,
        city: { select: { nameFr: true } },
        region: { select: { nameFr: true } },
      },
    });
    if (!p) throw AppError.validation([{ field: 'context.propertyReference', code: 'INVALID_CHOICE' }]);
    let lotId: string | null = null;
    if (context.lotReference) {
      const lot = await tx.lot.findFirst({ where: { propertyId: p.id, reference: context.lotReference, deletedAt: null, status: 'AVAILABLE' }, select: { id: true } });
      lotId = lot?.id ?? null;
    }
    return {
      property: {
        id: p.id,
        reference: p.reference,
        slug: p.slug,
        title: p.title,
        programId: p.programId,
        countryCode: p.countryCode,
        cityRegion: place(p.city?.nameFr, p.region.nameFr),
        availability: p.availability,
      },
      program: null,
      lotId,
      ...propertyOutcome(p),
    };
  }
  if (context.programSlug) {
    const g = await tx.program.findFirst({
      where: { slug: context.programSlug, deletedAt: null, firstPublishedAt: { not: null } },
      select: { id: true, slug: true, name: true, countryCode: true, city: { select: { nameFr: true } }, region: { select: { nameFr: true } } },
    });
    if (!g) throw AppError.validation([{ field: 'context.programSlug', code: 'INVALID_CHOICE' }]);
    return { ...none, program: { id: g.id, slug: g.slug, name: g.name, countryCode: g.countryCode, cityRegion: place(g.city?.nameFr, g.region.nameFr) } };
  }
  // PROPERTY_INTEREST: a property, or else a program (DEM-012, CHECK leads_property_interest_check).
  if (required) throw AppError.validation([{ field: 'context.propertyReference', code: 'REQUIRED' }]);
  return none;
}
