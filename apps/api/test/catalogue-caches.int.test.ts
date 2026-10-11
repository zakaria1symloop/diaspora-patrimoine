// Integration tests against the local database (apps/api/.env). Each scenario runs inside a transaction that is
// rolled back; the demo idempotence test reruns the compiled command. Skipped when the database is unreachable.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CatalogueCaches } from '../src/catalogue-admin/catalogue-caches.js';
import { FixedClock } from '../src/platform/clock.js';
import { newId } from '../src/platform/ids.js';
import { PrismaService } from '../src/platform/prisma.service.js';
import { SettingsService } from '../src/platform/settings.service.js';
import type { Tx } from '../src/platform/tx.js';
import type { Env } from '../src/config/env.js';
import { dzd, PROGRAMS } from '../src/install/demo-data.js';

const API = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(API, '.env'), quiet: true });
const url = process.env.DATABASE_URL;

async function reachable(): Promise<boolean> {
  if (!url) return false;
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await c.connect();
    await c.query('select 1 from properties limit 1');
    return true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => undefined);
  }
}

const dbUp = await reachable();
class Rollback extends Error {}

describe.skipIf(!dbUp)('catalogue caches against the database', () => {
  let prisma: PrismaService;
  let caches: CatalogueCaches;
  const clock = new FixedClock(new Date('2026-10-09T09:00:00Z'));

  beforeAll(async () => {
    prisma = new PrismaService({ DATABASE_URL: url } as Env);
    caches = new CatalogueCaches(new SettingsService(prisma, clock), clock);
  });
  afterAll(async () => prisma?.$disconnect());

  /** A promoter, a programme and the T3 typology of El Yasmine with its 7 lots — inside `tx`. */
  async function fixture(tx: Tx) {
    const now = clock.now();
    const stamps = { createdAt: now, updatedAt: now };
    const region = await tx.region.findUniqueOrThrow({ where: { countryCode_code: { countryCode: 'DZ', code: '16' } } });
    const orgId = newId();
    await tx.organization.create({ data: { id: orgId, type: 'PROMOTER', name: 'Test', slug: `test-${orgId}`, ...stamps } });
    const promoterId = newId();
    await tx.promoter.create({ data: { id: promoterId, organizationId: orgId, legalName: 'Promoteur Test', slug: `promoteur-test-${orgId}`, countryCode: 'DZ', status: 'ACTIVE', ...stamps } });
    const programId = newId();
    await tx.program.create({
      data: { id: programId, promoterId, name: 'Programme Test', slug: `programme-test-${programId}`, standing: 'COMFORT', countryCode: 'DZ', regionId: region.id, deliveryStatus: 'UNDER_CONSTRUCTION', deliveryDate: new Date('2027-10-01'), publication: 'PUBLISHED', ...stamps },
    });
    const propertyId = newId();
    await tx.property.create({
      data: {
        id: propertyId, reference: `DP-ZZ-${propertyId.slice(-6)}`, slug: `test-${propertyId}`, promoterId, programId, title: 'x', titleAuto: true, descriptionAuto: true,
        type: 'APARTMENT', rooms: 3, surfaceM2: '85.00', features: [], standing: 'COMFORT', deliveryStatus: 'UNDER_CONSTRUCTION', deliveryDate: new Date('2027-10-01'),
        deliveryDatePrecision: 'QUARTER', deliveryOverridden: false, countryCode: 'DZ', regionId: region.id, priceCurrency: 'DZD', publication: 'PUBLISHED',
        firstPublishedAt: now, availability: 'WITHDRAWN', availabilityChangedAt: new Date('2026-01-01'), searchText: '', ...stamps,
      },
    });
    const lots = PROGRAMS[0]!.properties[0]!.lots;
    const lotIds: Record<string, string> = {};
    for (const [i, l] of lots.entries()) {
      lotIds[l.reference] = newId();
      await tx.lot.create({
        data: { id: lotIds[l.reference]!, propertyId, reference: l.reference, surfaceM2: l.surfaceM2.toFixed(2), price: dzd(l.eur), priceUpdatedAt: now, status: 'AVAILABLE', statusChangedAt: now, sortOrder: i, ...stamps },
      });
    }
    return { programId, propertyId, lotIds };
  }

  async function inRolledBackTx(fn: (tx: Tx) => Promise<void>): Promise<void> {
    await expect(prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    }, { timeout: 30_000 })).rejects.toBeInstanceOf(Rollback);
  }

  it('MOD-220 / CAL-030 — B-304 at 22 275 000 DA gives 150 000 €, 30 000 € down payment, 810 € a month', async () => {
    await inRolledBackTx(async (tx) => {
      const { programId, propertyId } = await fixture(tx);
      await caches.recalcPropertyAndProgram(tx, propertyId);
      const p = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
      expect(p.title).toBe('Appartement T3 – Programme Test');
      expect(p.description).toBe('Appartement T3 de 85 m² à Alger, livraison T4 2027.');
      expect(p).toMatchObject({ lotsTotal: 7, lotsAvailable: 7, lotsTaken: 0, availability: 'AVAILABLE', photoCount: 0, hasPlan: false });
      expect(p.availabilityChangedAt.toISOString()).toBe(clock.now().toISOString());
      expect([p.priceFrom?.toFixed(2), p.priceTo?.toFixed(2)]).toEqual(['22275000.00', '24502500.00']);
      expect([p.surfaceMin?.toFixed(0), p.surfaceMax?.toFixed(0)]).toEqual(['84', '85']);
      expect([p.priceFromRef?.toFixed(2), p.downPaymentRef?.toFixed(2), p.monthlyFromRef?.toFixed(2)]).toEqual(['150000.00', '30000.00', '810.00']);
      expect(p.searchText).toMatch(/^appartement t3 – programme test programme test promoteur test alger dp-zz-/);
      // CAL-050: the 8 mandatory fields (40 points), no photo, no description, features, coordinates: 40 / 100.
      expect(p.completenessScore).toBe(40);
      // CAL-080: 40 × 1 + 25 × 1 (published today) + 20 × 0.40 + 0 = 73.
      expect(p.relevanceScore).toBe(73);
      const prog = await tx.program.findUniqueOrThrow({ where: { id: programId } });
      expect(prog).toMatchObject({ lotsTotal: 7, lotsAvailable: 7, lotsHeld: 0, lotsSold: 0, listedPropertyCount: 1 });
      expect([prog.priceFrom?.toFixed(2), prog.priceFromRef?.toFixed(2)]).toEqual(['22275000.00', '150000.00']);
    });
  });

  it('CYC-110 / MOD-220 — B-304 sold off-platform: the price starts at A-102 (152 000 €); all taken: RESERVED, then SOLD', async () => {
    await inRolledBackTx(async (tx) => {
      const { programId, propertyId, lotIds } = await fixture(tx);
      await tx.lot.update({ where: { id: lotIds['B-304']! }, data: { status: 'SOLD', externalSale: true, statusChangedAt: clock.now() } });
      await caches.recalcPropertyAndProgram(tx, propertyId);
      let p = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
      expect([p.lotsAvailable, p.lotsTaken, p.priceFromRef?.toFixed(0), p.monthlyFromRef?.toFixed(0)]).toEqual([6, 1, '152000', '820']);
      await tx.lot.updateMany({ where: { propertyId, status: 'AVAILABLE' }, data: { status: 'RESERVED', externalSale: true } });
      await caches.recalcPropertyAndProgram(tx, propertyId);
      p = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
      expect(p.availability).toBe('RESERVED');
      expect(p.priceFrom?.toFixed(2)).toBe('22275000.00'); // no AVAILABLE lot: range of the lots not withdrawn
      let prog = await tx.program.findUniqueOrThrow({ where: { id: programId } });
      expect([prog.lotsAvailable, prog.lotsHeld, prog.lotsSold, prog.priceFromRef]).toEqual([0, 6, 1, null]); // CAL-028: no available property, no price
      await tx.lot.updateMany({ where: { propertyId }, data: { status: 'SOLD' } });
      await caches.recalcPropertyAndProgram(tx, propertyId);
      p = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
      prog = await tx.program.findUniqueOrThrow({ where: { id: programId } });
      expect([p.availability, prog.lotsSold, prog.lotsTotal]).toEqual(['SOLD', 7, 7]);
    });
  });

  it('CYC-127 — a draft property does not count in its programme', async () => {
    await inRolledBackTx(async (tx) => {
      const { programId, propertyId } = await fixture(tx);
      await tx.property.update({ where: { id: propertyId }, data: { publication: 'DRAFT' } });
      await caches.recalcPropertyAndProgram(tx, propertyId);
      const prog = await tx.program.findUniqueOrThrow({ where: { id: programId } });
      expect([prog.lotsTotal, prog.listedPropertyCount, prog.priceFromRef]).toEqual([0, 0, null]);
    });
  });
});

const demoBuilt = existsSync(join(API, 'dist', 'install', 'demo.js'));

describe.skipIf(!dbUp || !demoBuilt)('demonstration data', () => {
  it('PAR-082 — rerunning the demo creates nothing new (natural keys)', async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    const count = async () => (await c.query("select (select count(*) from properties) p, (select count(*) from lots) l, (select count(*) from media) m, (select count(*) from events) e, (select count(*) from audit_logs where reason = 'demo') a")).rows[0];
    try {
      execFileSync(process.execPath, ['--env-file-if-exists=.env', 'dist/install/demo.js'], { cwd: API, stdio: 'pipe', timeout: 240_000 });
      const before = await count();
      const out = execFileSync(process.execPath, ['--env-file-if-exists=.env', 'dist/install/demo.js'], { cwd: API, encoding: 'utf8', timeout: 240_000 });
      expect(out).toContain('rien à créer');
      expect(await count()).toEqual(before);
      const marks = await c.query("select count(*)::int n from audit_logs where reason = 'demo' and actor_type = 'SYSTEM' and action = 'property.created'");
      expect(marks.rows[0].n).toBeGreaterThanOrEqual(6);
    } finally {
      await c.end();
    }
  }, 300_000);
});
