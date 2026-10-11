// PAR-082 — demonstration data, created THROUGH the back-office use cases (no SQL insert, nothing hard-coded in the
// front end): promoters, a bank, programmes, properties and lots, illustration images, Cafés. Refused in production.
// Every created row is written in the audit log by the use case itself, actor SYSTEM, reason `demo`.
// Idempotent: natural keys (promoter / bank / programme slug, typology of a programme, lot reference, event slug,
// file name + checksum of a media). Run: pnpm --filter @dp/api demo   — removal: pnpm --filter @dp/api demo:remove
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../config/env.js';
import { localDate } from '../platform/holidays.service.js';
import { newId } from '../platform/ids.js';
import { slugify } from '../platform/slug.js';
import { DEMO_ACTOR } from '../admin/actor.js';
import { writeAudit } from '../admin/audit.js';
import { advanceSequence } from '../admin/sequences.js';
import { eventSlug, zonedTimeToUtc } from '../events-admin/events-rules.js';
import { buildAdminServices, type AdminServices } from './admin-services.js';
import {
  BANK,
  CAFE_CAPACITY,
  CAFE_HOURS,
  CAFE_IMAGE,
  CAFE_TIMEZONE,
  CAFES,
  dzd,
  PROGRAMS,
  PROMOTERS,
  type DemoProgram,
  type DemoProperty,
} from './demo-data.js';

const actor = DEMO_ACTOR;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ASSETS = join(REPO, 'Design', 'assets', 'demo');
const WEEK_MS = 7 * 86_400_000;

const report: string[] = [];
const note = (line: string) => report.push(line);

async function today(s: AdminServices): Promise<string> {
  return localDate(s.clock.now(), await s.settings.get('business.calendar.timezone'));
}

/** PAR-022 — only chief-town communes are installed; the demo adds the communes it needs (audited, reason demo). */
async function ensureCity(s: AdminServices, regionCode: string, name: string): Promise<{ regionId: string; cityId: string }> {
  const region = await s.prisma.region.findUniqueOrThrow({ where: { countryCode_code: { countryCode: 'DZ', code: regionCode } } });
  const slug = slugify(name);
  const existing = await s.prisma.city.findUnique({ where: { regionId_slug: { regionId: region.id, slug } } });
  if (existing) return { regionId: region.id, cityId: existing.id };
  const id = newId();
  await s.prisma.$transaction(async (tx) => {
    const now = s.clock.now();
    await tx.city.create({ data: { id, regionId: region.id, nameFr: name, slug, isActive: true, createdAt: now, updatedAt: now } });
    await writeAudit(tx, actor, now, { action: 'city.created', entityType: 'city', entityId: id, entityLabel: name, after: { regionId: region.id, slug } });
  });
  note(`Commune créée : ${name} (${region.nameFr}).`);
  return { regionId: region.id, cityId: id };
}

async function ensurePromoters(s: AdminServices): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const day = await today(s);
  for (const def of PROMOTERS) {
    let p = await s.prisma.promoter.findFirst({ where: { slug: slugify(def.legalName), deletedAt: null } });
    if (!p) {
      p = await s.partners.createPromoter({ legalName: def.legalName, countryCode: 'DZ' }, actor);
      note(`Promoteur créé : ${def.legalName}.`);
    }
    if (p.status === 'PROSPECT') {
      const region = await s.prisma.region.findUniqueOrThrow({ where: { countryCode_code: { countryCode: 'DZ', code: def.regionCode } } });
      p = await s.partners.updatePromoter(
        p.id,
        {
          regionId: region.id,
          registrationNumber: def.registrationNumber ?? null,
          foundedYear: def.foundedYear ?? null,
          descriptionPublic: def.descriptionPublic ?? null,
          referencesPublic: def.referencesPublic ?? null,
          vettedAt: p.vettedAt ? undefined : day,
          conventionSignedAt: p.conventionSignedAt ? undefined : day,
        },
        actor,
      );
      p = await s.partners.activatePromoter(p.id, {}, actor);
    }
    if (!p.isPublic && p.status === 'ACTIVE') p = await s.partners.updatePromoter(p.id, { isPublic: true }, actor);
    ids.set(def.legalName, p.id);
  }
  return ids;
}

async function ensureBank(s: AdminServices): Promise<string> {
  let b = await s.prisma.bank.findFirst({ where: { slug: slugify(BANK.name), deletedAt: null } });
  if (!b) {
    b = await s.partners.createBank({ name: BANK.name, shortName: BANK.shortName, countryCode: 'DZ', offersIslamicFinance: BANK.offersIslamicFinance, descriptionPublic: BANK.descriptionPublic }, actor);
    note(`Banque créée : ${BANK.name}.`);
  }
  if (b.status === 'PROSPECT') {
    if (!b.conventionSignedAt) b = await s.partners.updateBank(b.id, { conventionSignedAt: await today(s) }, actor);
    b = await s.partners.activateBank(b.id, actor);
  }
  if (!b.isPublic && b.status === 'ACTIVE') b = await s.partners.updateBank(b.id, { isPublic: true }, actor);
  return b.id;
}

async function ensureProperty(s: AdminServices, programId: string, def: DemoProperty): Promise<string> {
  let prop = await s.prisma.property.findFirst({ where: { programId, type: def.type, rooms: def.rooms, deletedAt: null } });
  if (!prop) {
    if (def.referenceNumber) {
      // The file's reference (`DP-DZ-0142`): the counter moves forward to it — a gap, never a reuse (FIA-030).
      await s.prisma.$transaction((tx) => advanceSequence(tx, 'property', 'DZ', def.referenceNumber!, s.clock.now()));
    }
    prop = await s.properties.create(
      {
        programId,
        type: def.type,
        rooms: def.rooms,
        bedrooms: def.bedrooms,
        bathrooms: def.bathrooms,
        surfaceM2: def.surfaceM2,
        terraceM2: def.terraceM2 ?? null,
        features: def.features,
        description: def.description ?? null,
      },
      actor,
    );
    note(`Bien créé : ${prop.reference} · ${prop.title}.`);
  }
  for (const l of def.lots) {
    let lot = await s.prisma.lot.findFirst({ where: { propertyId: prop.id, reference: l.reference, deletedAt: null } });
    if (!lot) {
      lot = await s.lots.create(
        prop.id,
        {
          reference: l.reference,
          building: l.building ?? null,
          floor: l.floor ?? null,
          orientation: l.orientation ?? null,
          surfaceM2: l.surfaceM2,
          terraceM2: l.terraceM2 ?? null,
          price: dzd(l.eur),
          parkingIncluded: l.parkingIncluded ?? null,
        },
        actor,
      );
    }
    if (l.status && lot.status === 'AVAILABLE') {
      await s.lots.changeStatus(lot.id, { status: l.status, note: 'Réservé hors plateforme (données de démonstration).' }, actor);
    }
  }
  return prop.id;
}

async function ensureProgram(s: AdminServices, def: DemoProgram, promoterId: string): Promise<{ programId: string; propertyIds: string[] }> {
  const { regionId, cityId } = await ensureCity(s, def.regionCode, def.city);
  let program = await s.prisma.program.findFirst({ where: { slug: slugify(def.name), deletedAt: null } });
  if (!program) {
    program = await s.programs.create(
      {
        promoterId,
        name: def.name,
        tagline: def.tagline ?? null,
        description: def.description,
        standing: def.standing,
        countryCode: 'DZ',
        regionId,
        cityId,
        latitude: def.latitude,
        longitude: def.longitude,
        deliveryStatus: def.deliveryStatus,
        deliveryDate: def.deliveryDate,
        deliveryDatePrecision: 'QUARTER',
        totalUnits: def.totalUnits ?? null,
        amenities: def.amenities,
        guarantees: def.guarantees ?? null,
      },
      actor,
    );
    note(`Programme créé : ${def.name}.`);
  }
  // Illustration images of the validated mockup (Q-031: `isIllustration`), on the programme: its typologies use them (MOD-236).
  for (const img of def.images) {
    const path = join(ASSETS, img.file);
    if (!existsSync(path)) continue;
    const { created, media } = await s.media.attach(
      { ownerType: 'PROGRAM', ownerId: program.id, kind: 'PHOTO', filePath: path, roomLabel: img.roomLabel, isIllustration: true, isCover: img.isCover },
      actor,
    );
    if (created) note(`Image ajoutée : ${img.file} → ${def.name} (${media.processingStatus}).`);
  }
  if (program.publication !== 'PUBLISHED') {
    try {
      program = await s.programs.publish(program.id, actor);
      note(`Programme publié : ${def.name}.`);
    } catch (err) {
      note(`Programme NON publié : ${def.name} — ${describe(err)}`);
    }
  }
  const propertyIds: string[] = [];
  for (const p of def.properties) {
    const id = await ensureProperty(s, program.id, p);
    propertyIds.push(id);
    const prop = await s.prisma.property.findUniqueOrThrow({ where: { id } });
    if (prop.publication !== 'PUBLISHED') {
      try {
        const published = await s.properties.publish(id, actor);
        note(`Bien publié : ${published.reference} (complétude ${published.completenessScore}, ${published.priceFromRef} € → ${published.monthlyFromRef} € / mois).`);
      } catch (err) {
        note(`Bien NON publié : ${prop.reference} — ${describe(err)}`);
        continue;
      }
    }
    if (p.featuredRank && prop.featuredRank !== p.featuredRank) await s.properties.feature(id, { rank: p.featuredRank }, actor);
  }
  return { programId: program.id, propertyIds };
}

/** The file's dates; if one is already past (Clock), the whole set moves forward by whole weeks (weekdays kept). */
function cafeShiftWeeks(nowMs: number): number {
  const closeHours = 24;
  let weeks = 0;
  const first = Math.min(...CAFES.map((c) => zonedTimeToUtc(c.date, CAFE_HOURS.start, CAFE_TIMEZONE).getTime()));
  while (first + weeks * WEEK_MS - closeHours * 3_600_000 <= nowMs) weeks++;
  return weeks;
}

function shiftDate(isoDate: string, weeks: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

async function ensureCafes(s: AdminServices, promoterId: string, bankId: string): Promise<void> {
  const weeks = cafeShiftWeeks(s.clock.now().getTime());
  if (weeks) note(`Dates des Cafés décalées de ${weeks} semaine(s) (la première était passée) : mêmes jours de la semaine.`);
  const imagePath = join(ASSETS, CAFE_IMAGE.file);
  for (const [i, c] of CAFES.entries()) {
    const day = shiftDate(c.date, weeks);
    const startsAt = zonedTimeToUtc(day, CAFE_HOURS.start, CAFE_TIMEZONE);
    const slug = eventSlug(c.locationLabel, startsAt, CAFE_TIMEZONE);
    let event = await s.prisma.event.findFirst({ where: { slug, deletedAt: null } });
    if (!event) {
      event = await s.events.create(
        {
          locationLabel: c.locationLabel,
          cityName: c.cityName,
          countryCode: 'FR',
          locationCode: c.locationCode,
          venueName: c.venueName,
          venueAddress: c.venueAddress,
          startsAt: startsAt.toISOString(),
          endsAt: zonedTimeToUtc(day, CAFE_HOURS.end, CAFE_TIMEZONE).toISOString(),
          timezone: CAFE_TIMEZONE,
          capacity: CAFE_CAPACITY,
          registrationOpensAt: c.registrationOpensOn ? zonedTimeToUtc(shiftDate(c.registrationOpensOn, weeks), '10:00', CAFE_TIMEZONE).toISOString() : null,
        },
        actor,
      );
      await s.events.addPartner(event.id, { promoterId, roleLabel: 'Promoteur', isPublic: true }, actor);
      if (c.withBank) await s.events.addPartner(event.id, { bankId, roleLabel: 'Banque', isPublic: true }, actor);
      note(`Café créé : ${event.reference} · ${event.title}.`);
    }
    if (existsSync(imagePath) && !event.coverMediaId) {
      await s.events.attachCover(event.id, { filePath: imagePath, alt: CAFE_IMAGE.alt, isIllustration: true }, actor);
    }
    if (event.status === 'DRAFT') {
      event = await s.events.publish(event.id, actor);
      note(`Café publié : ${event.reference}.`);
    }
    // Seats taken through staff registrations (EVT-011) of demo people (`@demo.invalid`, PAR-082).
    for (let n = 1; event.seatsTaken < c.seatsTaken && n <= 20; n++) {
      const email = `invite.${i + 1}.${n}@demo.invalid`;
      if (await s.prisma.eventRegistration.findFirst({ where: { eventId: event.id, email, status: { not: 'CANCELLED' } } })) continue;
      await s.events.registerByStaff(event.id, { firstName: 'Invité', lastName: `Démo ${n}`, email, seats: Math.min(3, c.seatsTaken - event.seatsTaken) }, actor);
      event = await s.prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    }
  }
}

function describe(err: unknown): string {
  const e = err as { code?: string; options?: { reason?: string; details?: { field: string }[] } };
  if (e?.code) return `${e.code}${e.options?.reason ? ` ${e.options.reason}` : ''}${e.options?.details?.length ? ` [${e.options.details.map((d) => d.field).join(', ')}]` : ''}`;
  return err instanceof Error ? err.message : String(err);
}

/**
 * ACC-040, PAR-100 — the home comparison describes the El Yasmine T3 (DP-DZ-0142): link it, so its column leads to the
 * property and shows its cover. Only while the block has no property yet (an administrator's choice is kept). The content
 * editing use case comes with the back office (CMS-020); until then a direct, audited update of `propertyId` alone.
 */
async function linkComparison(s: AdminServices): Promise<void> {
  const property = await s.prisma.property.findFirst({ where: { reference: 'DP-DZ-0142', deletedAt: null }, select: { id: true } });
  const block = await s.prisma.contentBlock.findUnique({ where: { key_locale: { key: 'home.comparison', locale: 'fr' } } });
  if (!property || !block || !block.value || typeof block.value !== 'object' || Array.isArray(block.value)) return;
  const value = block.value as Record<string, unknown>;
  if (value.propertyId) return;
  const now = s.clock.now();
  await s.prisma.$transaction(async (tx) => {
    await tx.contentBlock.update({
      where: { id: block.id },
      data: { value: { ...value, propertyId: property.id } as object, version: { increment: 1 }, updatedAt: now },
    });
    await writeAudit(tx, actor, now, { action: 'content.changed', entityType: 'content_block', entityId: block.id, entityLabel: 'home.comparison · propertyId' });
  });
  await s.notifier.committed(['content', 'home']);
  note('Comparatif de l’accueil relié au bien DP-DZ-0142.');
}

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.APP_ENV === 'production') {
    process.stderr.write('Commande refusée : les données de démonstration ne peuvent pas être créées en production (PAR-082).\n');
    process.exit(1);
  }
  const s = await buildAdminServices(env);
  try {
    if (!existsSync(ASSETS)) note('Aucune image dans Design/assets/demo : biens créés sans média (repli « Photos en cours de préparation »).');
    const promoters = await ensurePromoters(s);
    const bankId = await ensureBank(s);
    for (const def of PROGRAMS) await ensureProgram(s, def, promoters.get(def.promoter)!);
    await ensureCafes(s, promoters.get('Bahia Promotion')!, bankId);
    await linkComparison(s);
    // Plan 2.9 — a demonstration dossier with its piece list for one client account (`--dossier-pour=adresse`).
    const dossierFor = (await import('./demo-dossier.js')).demoDossierEmail(process.argv.slice(2));
    if (dossierFor) for (const line of await (await import('./demo-dossier.js')).ensureDemoDossier(s, dossierFor)) note(line);
    // Plan 3.7, 3.8 — a dossier followed by the team (proposals, task, appointment) for one client account (`--suivi-pour=adresse`).
    const followFor = (await import('./demo-follow-up.js')).demoFollowUpEmail(process.argv.slice(2));
    if (followFor) for (const line of await (await import('./demo-follow-up.js')).ensureDemoFollowUp(s, followFor)) note(line);
    const sent = await s.notifier.flush();
    if (!sent) note('Revalidation du site non reçue (site arrêté ?) : les pages se mettront à jour sous 60 s (ARC-040).');
  } finally {
    await s.close();
  }
  process.stdout.write(report.length ? `Données de démonstration :\n- ${report.join('\n- ')}\n` : 'Données de démonstration : rien à créer, tout est en place.\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`Démonstration en échec : ${describe(err)}\n${err instanceof Error && err.stack ? err.stack.split('\n').slice(1, 6).join('\n') : ''}\n`);
  process.exit(1);
});
