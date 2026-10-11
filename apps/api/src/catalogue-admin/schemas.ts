// ARC-030, TRV-060 — inputs of the catalogue use cases, validated on the server whoever calls (routes or demo).
// Bounds are those of 01-domaine/02 and 03 (and their CHECK constraints, FIA-002).
import { z } from 'zod';

const str = (max: number) => z.string().trim().min(1).max(max);
const optStr = (max: number) => z.string().trim().max(max).nullable().optional();
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE');
/** CAL-027 — up to 100 000 000 000, two decimals, strictly positive. */
const amount = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'INVALID_AMOUNT'))
  .refine((v) => Number(v) > 0, 'OUT_OF_RANGE');
const surface = z.union([z.string(), z.number()]).transform(Number).pipe(z.number().gt(0).max(100_000));
const coordinate = z.union([z.string(), z.number()]).transform(Number).pipe(z.number().min(-180).max(180));
const version = z.number().int().min(1).optional();
const countryCode = z.string().regex(/^[A-Z]{2}$/, 'INVALID_CHOICE');

export const standingSchema = z.enum(['COMFORT', 'STANDING', 'PREMIUM']);
export const deliveryStatusSchema = z.enum(['ON_PLAN', 'UNDER_CONSTRUCTION', 'DELIVERED']);
export const precisionSchema = z.enum(['MONTH', 'QUARTER', 'YEAR']);
export const propertyTypeSchema = z.enum(['APARTMENT', 'STUDIO', 'DUPLEX', 'VILLA', 'LAND', 'COMMERCIAL']);
export const orientationSchema = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

// ── Promoters, banks (CTL-002, CTL-003, CYC-240) ───────────────────────────────────────────────
export const promoterCreateSchema = z.object({
  legalName: str(160),
  brandName: optStr(160),
  countryCode,
});
export const promoterUpdateSchema = z.object({
  version,
  legalName: str(160).optional(),
  brandName: optStr(160),
  registrationNumber: optStr(60),
  taxId: optStr(60),
  licenseNumber: optStr(60),
  addressLine: optStr(200),
  regionId: z.uuid().nullable().optional(),
  cityId: z.uuid().nullable().optional(),
  website: optStr(200),
  email: z.email().nullable().optional(),
  phone: optStr(20),
  descriptionPublic: optStr(2000),
  referencesPublic: optStr(600),
  foundedYear: z.number().int().min(1900).max(2100).nullable().optional(),
  deliveredUnits: z.number().int().min(0).nullable().optional(),
  vettedAt: isoDateSchema.nullable().optional(),
  conventionSignedAt: isoDateSchema.nullable().optional(),
  conventionExpiresAt: isoDateSchema.nullable().optional(),
  /** CTL-003 « Convention » — internal text, `partner.convention.manage` only (checked by the route). */
  commissionTerms: optStr(2000),
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export const bankCreateSchema = z.object({
  name: str(160),
  shortName: optStr(40),
  countryCode,
  offersIslamicFinance: z.boolean().default(false),
  descriptionPublic: optStr(1500),
});
export const bankUpdateSchema = z.object({
  version,
  name: str(160).optional(),
  shortName: optStr(40),
  descriptionPublic: optStr(1500),
  offersIslamicFinance: z.boolean().optional(),
  conventionSignedAt: isoDateSchema.nullable().optional(),
  conventionExpiresAt: isoDateSchema.nullable().optional(),
  isPublic: z.boolean().optional(),
});
export const statusReasonSchema = z.object({ version, reason: z.string().trim().max(500).optional() });

// ── Programmes (01-domaine/03 § 1, CTL-022) ─────────────────────────────────────────────────────
const programFields = {
  name: str(120),
  tagline: optStr(160),
  description: optStr(5000),
  standing: standingSchema,
  countryCode,
  regionId: z.uuid(),
  cityId: z.uuid().nullable().optional(),
  addressLine: optStr(200),
  latitude: coordinate.nullable().optional(),
  longitude: coordinate.nullable().optional(),
  deliveryStatus: deliveryStatusSchema,
  deliveryDate: isoDateSchema.nullable().optional(),
  deliveryDatePrecision: precisionSchema,
  totalUnits: z.number().int().min(1).max(100_000).nullable().optional(),
  amenities: z.array(z.string().max(40)),
  guarantees: optStr(600),
  highlightLabel: optStr(40),
  highlightUntil: isoDateSchema.nullable().optional(),
  seoTitle: optStr(70),
  seoDescription: optStr(160),
};
export const programCreateSchema = z
  .object({
    promoterId: z.uuid(),
    ...programFields,
    deliveryDatePrecision: precisionSchema.default('QUARTER'),
    amenities: z.array(z.string().max(40)).default([]),
  })
  .refine((p) => p.deliveryStatus === 'DELIVERED' || Boolean(p.deliveryDate), { path: ['deliveryDate'], message: 'REQUIRED' });
export const programUpdateSchema = z.object(programFields).partial().extend({ version, promoterId: z.uuid().optional() });

// ── Properties (01-domaine/03 § 2, CTL-041, CTL-042) ────────────────────────────────────────────
const roomsRule = <T extends { type?: string; rooms?: number | null; bedrooms?: number | null }>(p: T, ctx: z.RefinementCtx) => {
  if (!p.type) return;
  if ((p.type === 'APARTMENT' || p.type === 'DUPLEX' || p.type === 'VILLA') && (p.rooms === null || p.rooms === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['rooms'], message: 'REQUIRED' });
  }
  if ((p.type === 'LAND' || p.type === 'COMMERCIAL') && p.rooms !== null && p.rooms !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['rooms'], message: 'INVALID_CHOICE' });
  }
  if (p.bedrooms !== null && p.bedrooms !== undefined && p.rooms && p.bedrooms >= p.rooms) {
    ctx.addIssue({ code: 'custom', path: ['bedrooms'], message: 'OUT_OF_RANGE' });
  }
};
const propertyFields = {
  type: propertyTypeSchema,
  rooms: z.number().int().min(1).max(12).nullable().optional(),
  bedrooms: z.number().int().min(0).max(11).nullable().optional(),
  bathrooms: z.number().int().min(0).max(10).nullable().optional(),
  surfaceM2: surface,
  terraceM2: surface.nullable().optional(),
  landM2: surface.nullable().optional(),
  features: z.array(z.string().max(40)),
  /** Typed title: `titleAuto` becomes false (MOD-210). */
  title: optStr(120),
  /** Typed description: `descriptionAuto` becomes false (MOD-211). */
  description: optStr(5000),
  highlightLabel: optStr(40),
  highlightUntil: isoDateSchema.nullable().optional(),
  seoTitle: optStr(70),
  seoDescription: optStr(160),
  /** Delivery override (MOD-200); for a standalone property, its delivery. */
  deliveryStatus: deliveryStatusSchema.optional(),
  deliveryDate: isoDateSchema.nullable().optional(),
  deliveryDatePrecision: precisionSchema.optional(),
};
export const propertyCreateSchema = z
  .object({
    programId: z.uuid().nullable().optional(),
    // Standalone property only (CTL-041, MOD-212):
    promoterId: z.uuid().optional(),
    countryCode: countryCode.optional(),
    regionId: z.uuid().optional(),
    cityId: z.uuid().nullable().optional(),
    standing: standingSchema.optional(),
    addressLine: optStr(200),
    latitude: coordinate.nullable().optional(),
    longitude: coordinate.nullable().optional(),
    price: amount.optional(),
    floor: z.number().int().min(-2).max(80).nullable().optional(),
    orientation: orientationSchema.nullable().optional(),
    parkingIncluded: z.boolean().nullable().optional(),
    ...propertyFields,
    features: z.array(z.string().max(40)).default([]),
  })
  .superRefine((p, ctx) => {
    roomsRule(p, ctx);
    if (!p.programId) {
      for (const f of ['promoterId', 'countryCode', 'regionId', 'standing', 'deliveryStatus', 'price'] as const) {
        if (p[f] === undefined || p[f] === null) ctx.addIssue({ code: 'custom', path: [f], message: 'REQUIRED' });
      }
    }
    if (p.deliveryStatus && p.deliveryStatus !== 'DELIVERED' && !p.deliveryDate) {
      ctx.addIssue({ code: 'custom', path: ['deliveryDate'], message: 'REQUIRED' });
    }
  });
export const propertyUpdateSchema = z
  .object(propertyFields)
  .partial()
  .extend({
    version,
    /** « Revenir au titre automatique » / « Description automatique » (MOD-210, MOD-211). */
    titleAuto: z.literal(true).optional(),
    descriptionAuto: z.literal(true).optional(),
    /** `false`: « Reprendre la livraison du programme » (CTL-042). */
    deliveryOverridden: z.boolean().optional(),
    // CTL-042 « Localisation » and CTL-041 — a standalone property only (a typology inherits them, MOD-200).
    promoterId: z.uuid().optional(),
    standing: standingSchema.optional(),
    countryCode: countryCode.optional(),
    regionId: z.uuid().optional(),
    cityId: z.uuid().nullable().optional(),
    addressLine: optStr(200),
    latitude: coordinate.nullable().optional(),
    longitude: coordinate.nullable().optional(),
  })
  .superRefine((p, ctx) => roomsRule(p, ctx));
export const featureSchema = z.object({ rank: z.number().int().min(1).max(3).nullable() });

// ── Lots (01-domaine/03 § 3, CTL-060…CTL-062, CYC-100) ──────────────────────────────────────────
const lotFields = {
  reference: str(40),
  building: optStr(40),
  floor: z.number().int().min(-2).max(80).nullable().optional(),
  door: optStr(20),
  orientation: orientationSchema.nullable().optional(),
  surfaceM2: surface,
  terraceM2: surface.nullable().optional(),
  landM2: surface.nullable().optional(),
  price: amount,
  parkingIncluded: z.boolean().nullable().optional(),
  extras: optStr(300),
  sortOrder: z.number().int().min(0).optional(),
};
export const lotCreateSchema = z.object(lotFields);
export const lotUpdateSchema = z.object(lotFields).partial().extend({ version });
export const lotStatusSchema = z.object({
  version,
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'WITHDRAWN']),
  /** CYC-100 — « Une note est demandée ». */
  note: z.string().trim().min(1).max(300),
});

export type PromoterCreate = z.input<typeof promoterCreateSchema>;
export type PromoterUpdate = z.input<typeof promoterUpdateSchema>;
export type BankCreate = z.input<typeof bankCreateSchema>;
export type BankUpdate = z.input<typeof bankUpdateSchema>;
export type ProgramCreate = z.input<typeof programCreateSchema>;
export type ProgramUpdate = z.input<typeof programUpdateSchema>;
export type PropertyCreate = z.input<typeof propertyCreateSchema>;
export type PropertyUpdate = z.input<typeof propertyUpdateSchema>;
export type LotCreate = z.input<typeof lotCreateSchema>;
export type LotUpdate = z.input<typeof lotUpdateSchema>;
export type LotStatusChange = z.input<typeof lotStatusSchema>;
