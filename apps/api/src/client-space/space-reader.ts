// Shared reads of the client space. ROL-030, SEC-031: every query is scoped to the caller's client record — an object
// of someone else answers 404, never 403 (no hint that it exists). ROL-031: nothing internal is ever selected here
// (notes, tasks, score, lost reason, bank or promoter contacts).
import { Injectable } from '@nestjs/common';
import type { AdvisorCard, CallbackPromise, PropertySummary } from '@dp/contracts';
import { CatalogueIndex } from '../catalogue/catalogue-index.js';
import { CatalogueService } from '../catalogue/catalogue.service.js';
import { toPublicImage, pickCover, type MediaRow } from '../catalogue/media.js';
import { loadAdvisors } from '../leads/assignment.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { AuthContext } from '../identity/sessions.service.js';

/** Lead statuses the client sees (INT-003: a request classed as spam never appears). */
export const VISIBLE_LEAD = { not: 'SPAM' as const };

export interface PromiseLead {
  reference: string;
  kind: string;
  status: string;
  firstContactAt: Date | null;
  slaBreachedAt: Date | null;
  preferredCallbackDate: Date | null;
  preferredSlot: string | null;
  callerTimezone: string | null;
  createdAt: Date;
}

export const PROMISE_SELECT = {
  reference: true,
  kind: true,
  status: true,
  firstContactAt: true,
  slaBreachedAt: true,
  preferredCallbackDate: true,
  preferredSlot: true,
  callerTimezone: true,
  createdAt: true,
} as const;

@Injectable()
export class SpaceReader {
  constructor(
    readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly index: CatalogueIndex,
    private readonly catalogue: CatalogueService,
  ) {}

  /** The caller's client record id; an account without record sees an empty space. */
  clientIdOf(auth: AuthContext): string | null {
    return auth.clientId;
  }

  /** ECL-030, ROL-030 — a dossier of this client, by its reference; anything else is 404. */
  async ownDossier(auth: AuthContext, reference: string) {
    if (!auth.clientId || !/^[A-Za-z0-9-]{3,20}$/.test(reference)) throw AppError.notFound();
    const d = await this.prisma.dossier.findFirst({ where: { reference: reference.toUpperCase(), clientId: auth.clientId, deletedAt: null } });
    if (!d) throw AppError.notFound();
    return d;
  }

  // ─── Advisors (ECL-012, TRV-145, NOT-018) ──────────────────────────────────

  /** Cards of the advisors who can still act; one who left (suspended, deleted, other role) shows as the team. */
  async advisorCards(ids: (string | null | undefined)[]): Promise<Map<string, AdvisorCard>> {
    const wanted = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    const out = new Map<string, AdvisorCard>();
    if (!wanted.length) return out;
    const able = new Set((await loadAdvisors(this.prisma)).map((a) => a.userId));
    const users = await this.prisma.user.findMany({
      where: { id: { in: wanted.filter((id) => able.has(id)) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        avatarMedia: {
          select: { id: true, ownerType: true, ownerId: true, kind: true, isCover: true, isIllustration: true, sortOrder: true, width: true, height: true, alt: true, roomLabel: true, renditions: true, processingStatus: true, deletedAt: true },
        },
      },
    });
    for (const u of users) {
      if (!u.firstName) continue;
      const m = u.avatarMedia && u.avatarMedia.processingStatus === 'READY' && !u.avatarMedia.deletedAt ? (u.avatarMedia as unknown as MediaRow) : null;
      out.set(u.id, {
        firstName: u.firstName,
        lastInitial: u.lastName ? u.lastName.trim().charAt(0).toUpperCase() : null,
        jobTitle: u.jobTitle,
        photo: m ? toPublicImage(this.index.mediaUrl, m, u.firstName) : null,
      });
    }
    return out;
  }

  async advisorCard(id: string | null | undefined): Promise<AdvisorCard | null> {
    if (!id) return null;
    return (await this.advisorCards([id])).get(id) ?? null;
  }

  // ─── NOT-053 / ECL-035 promise ─────────────────────────────────────────────

  async promiseOf(lead: PromiseLead | null, clientTimezone: string | null): Promise<CallbackPromise | null> {
    if (!lead) return null;
    return {
      leadReference: lead.reference,
      kind: lead.kind as CallbackPromise['kind'],
      preferredCallbackDate: lead.preferredCallbackDate ? lead.preferredCallbackDate.toISOString().slice(0, 10) : null,
      preferredSlot: (lead.preferredSlot as CallbackPromise['preferredSlot']) ?? null,
      timeZone: lead.callerTimezone ?? clientTimezone ?? (await this.settings.get('business.calendar.timezone')),
      breached: Boolean(lead.slaBreachedAt),
      createdAt: lead.createdAt.toISOString(),
    };
  }

  /** ECL-012 — the client's open request (NEW or IN_PROGRESS) without first contact, the most recent. */
  async openRequestWithoutContact(clientId: string): Promise<PromiseLead | null> {
    return this.prisma.lead.findFirst({
      where: { clientId, status: { in: ['NEW', 'IN_PROGRESS'] }, firstContactAt: null, kind: { not: 'PARTNER_REQUEST' } },
      orderBy: { createdAt: 'desc' },
      select: PROMISE_SELECT,
    });
  }

  // ─── Properties (CAT-040, INT-004, CYC-121) ────────────────────────────────

  /**
   * Summaries of properties by id: the public card data when the property is listed (online), else what the
   * database keeps (title, place, photo, price of the dossier) with « Fiche en cours de mise à jour » (offline) or
   * « Ce bien n'est plus proposé » (gone). Never an error page (INT-004).
   */
  async propertySummaries(ids: string[]): Promise<Map<string, PropertySummary>> {
    const out = new Map<string, PropertySummary>();
    const wanted = [...new Set(ids)];
    if (!wanted.length) return out;
    const rows = (await this.index.rows()).filter((r) => wanted.includes(r.id));
    const cards = await this.catalogue.toCards(rows);
    const downPaymentPct = cards.length ? (await this.settings.get('finance.reference.default')).downPaymentPct.toFixed(2) : null;
    for (const c of cards) {
      out.set(c.id, {
        reference: c.reference,
        title: c.title,
        slug: c.slug,
        region: c.region.name,
        city: c.city?.name ?? null,
        standing: c.standing,
        type: c.type,
        rooms: c.rooms,
        online: true,
        offline: false,
        gone: false,
        availability: c.availability,
        photo: c.cover,
        price: c.priceFromRef,
        priceIsFrom: c.priceIsFrom,
        monthly: c.monthlyFromRef,
        downPayment: c.downPaymentRef,
        downPaymentPct: c.downPaymentRef ? downPaymentPct : null,
        surfaceMin: c.surfaceMin,
        surfaceMax: c.surfaceMax,
      });
    }
    const missing = wanted.filter((id) => !out.has(id));
    if (!missing.length) return out;
    const props = await this.prisma.property.findMany({
      where: { id: { in: missing } },
      select: {
        id: true, reference: true, slug: true, title: true, type: true, rooms: true, standing: true, publication: true, archivedAt: true,
        deletedAt: true, firstPublishedAt: true, availability: true, priceFrom: true, priceTo: true, priceCurrency: true, surfaceMin: true,
        surfaceMax: true, programId: true, region: { select: { nameFr: true } }, city: { select: { nameFr: true } },
      },
    });
    const ownerIds = props.flatMap((p) => [p.id, p.programId].filter((x): x is string => Boolean(x)));
    const media = ownerIds.length
      ? await this.prisma.media.findMany({
          where: { ownerId: { in: ownerIds }, ownerType: { in: ['PROPERTY', 'PROGRAM'] }, kind: { in: ['PHOTO', 'RENDER_3D'] }, processingStatus: 'READY', deletedAt: null, isPublic: true },
          select: { id: true, ownerType: true, ownerId: true, kind: true, isCover: true, isIllustration: true, sortOrder: true, width: true, height: true, alt: true, roomLabel: true, renditions: true },
        })
      : [];
    for (const p of props) {
      const own = media.filter((m) => m.ownerId === p.id) as MediaRow[];
      const cover = pickCover(own) ?? pickCover(media.filter((m) => m.ownerId === p.programId) as MediaRow[]);
      const gone = Boolean(p.deletedAt) || p.publication === 'ARCHIVED' || p.availability === 'SOLD' || p.availability === 'WITHDRAWN';
      out.set(p.id, {
        reference: p.reference,
        title: p.title,
        slug: p.slug,
        region: p.region?.nameFr ?? null,
        city: p.city?.nameFr ?? null,
        standing: p.standing,
        type: p.type,
        rooms: p.rooms,
        online: false,
        offline: !gone && p.firstPublishedAt !== null,
        gone,
        availability: p.availability,
        photo: cover ? toPublicImage(this.index.mediaUrl, cover, p.title) : null,
        price: p.priceFrom === null ? null : { amount: p.priceFrom.toFixed(2), currency: p.priceCurrency },
        priceIsFrom: p.priceFrom !== null && p.priceTo !== null && !p.priceFrom.equals(p.priceTo),
        monthly: null,
        downPayment: null,
        downPaymentPct: null,
        surfaceMin: p.surfaceMin === null ? null : p.surfaceMin.toFixed(2),
        surfaceMax: p.surfaceMax === null ? null : p.surfaceMax.toFixed(2),
      });
    }
    return out;
  }
}
