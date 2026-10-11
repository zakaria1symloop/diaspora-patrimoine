// Packages 3.4 to 3.6 — catalogue back office: pure rules. The access declared by each route (SEC-030, API-100), the lot
// import (CTL-100 … CTL-102: reading of the file and of each cell, the plan), the XLSX template (CTL-100), the form of a
// video address (CTL-080, SEC-062), the expiry of a convention or a document (AUT-073), the real type of a partner's
// document (MED-011), the provisional reference of a copied lot (MOD-230).
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { isPermission, lotBulkPriceSchema, programListQuerySchema, promoterListQuerySchema, propertyListQuerySchema, type Permission } from '@dp/contracts';
import { ACCESS_KEY, PERMISSION_KEY } from '../src/identity/access.js';
import { ImportsController } from '../src/media-admin/imports.controller.js';
import { fold, mappingComplete, planImport, proposeMapping, readGrid, readLine, readNumber, type ExistingLot, type ExistingTypology } from '../src/media-admin/lot-import.js';
import { MediaAdminController } from '../src/media-admin/media-admin.controller.js';
import { videoAddress } from '../src/media-admin/media-admin.service.js';
import { readXlsx, writeXlsx } from '../src/media-admin/xlsx.js';
import { ProgramsAdminController } from '../src/programs-admin/programs-admin.controller.js';
import { PropertiesAdminController } from '../src/properties-admin/properties-admin.controller.js';
import { PromotersAdminController } from '../src/promoters-admin/promoters-admin.controller.js';
import { documentType } from '../src/promoters-admin/promoters-gestures.service.js';
import { DEFAULT_VETTING, expiryState } from '../src/promoters-admin/promoters-read.service.js';
import { PARTNER_RULE_SEEDS } from '../src/promoters-admin/partner-rules.js';
import { parseRuleDefinition } from '../src/automation/rule-definition.js';

type Ctor = new (...args: never[]) => unknown;

describe('SEC-030, API-100 — every route of packages 3.4 to 3.6 declares its access', () => {
  const expected: [Ctor, Record<string, Permission>][] = [
    [
      ProgramsAdminController,
      {
        list: 'catalogue.read', one: 'catalogue.read', dossiers: 'catalogue.read', duplicate: 'catalogue.write', remove: 'catalogue.delete',
        programLots: 'catalogue.read', propertyLots: 'catalogue.read', priceHistory: 'catalogue.read', deleteLot: 'catalogue.write', duplicateLot: 'catalogue.write',
        bulkPrice: 'catalogue.write', markDelivered: 'catalogue.write', confirmProgramStock: 'catalogue.write', confirmPropertyStock: 'catalogue.write',
        programPois: 'catalogue.read', setProgramPois: 'catalogue.write', propertyPois: 'catalogue.read', setPropertyPois: 'catalogue.write',
        updates: 'catalogue.read', createUpdate: 'catalogue.write', editUpdate: 'catalogue.write', deleteUpdate: 'catalogue.write',
      },
    ],
    [
      PropertiesAdminController,
      {
        list: 'catalogue.read', one: 'catalogue.read', dossiers: 'catalogue.read', duplicate: 'catalogue.write', remove: 'catalogue.delete',
        programEligibility: 'catalogue.read', setProgramEligibility: 'catalogue.eligibility.manage', propertyEligibility: 'catalogue.read', setPropertyEligibility: 'catalogue.eligibility.manage', featured: 'catalogue.read',
      },
    ],
    [
      MediaAdminController,
      { list: 'catalogue.read', library: 'catalogue.read', announce: 'catalogue.read', content: 'catalogue.read', complete: 'catalogue.read', video: 'catalogue.read', reorder: 'catalogue.read', bulk: 'catalogue.read', update: 'catalogue.read', retry: 'catalogue.read', remove: 'catalogue.read' },
    ],
    [ImportsController, { templateXlsx: 'catalogue.import', templateCsv: 'catalogue.import', list: 'catalogue.import', announce: 'catalogue.import', content: 'catalogue.import', create: 'catalogue.import', one: 'catalogue.import', issues: 'catalogue.import', dryRun: 'catalogue.import', confirm: 'catalogue.import' }],
    [
      PromotersAdminController,
      {
        list: 'promoter.read', one: 'promoter.read', impact: 'promoter.read', relation: 'promoter.read', expectations: 'promoter.read', vetting: 'promoter.write',
        suspend: 'promoter.write', end: 'promoter.write', resume: 'promoter.write', republish: 'catalogue.publish', remove: 'promoter.delete',
        addContact: 'promoter.write', editContact: 'promoter.write', deleteContact: 'promoter.write',
        announceDocument: 'promoter.write', receiveDocument: 'promoter.write', completeDocument: 'promoter.write', editDocument: 'promoter.write', deleteDocument: 'promoter.write', openDocument: 'promoter.read',
        partnersList: 'content.manage', partner: 'content.manage', createPartner: 'content.manage', updatePartner: 'content.manage', movePartner: 'content.manage', deletePartner: 'content.manage',
        application: 'lead.read', applicationFile: 'lead.read', approve: 'lead.process', requestInfo: 'lead.process', decline: 'lead.process',
      },
    ],
  ];
  it('each handler is a STAFF route of the ADMIN audience, with the permission of API-100 / API-101', () => {
    for (const [controller, routes] of expected) {
      const declared = Object.getOwnPropertyNames(controller.prototype).filter((n) => n !== 'constructor' && Reflect.getMetadata('path', (controller.prototype as Record<string, unknown>)[n] as object) !== undefined);
      expect(declared.sort(), controller.name).toEqual(Object.keys(routes).sort());
      for (const [method, permission] of Object.entries(routes)) {
        const fn = (controller.prototype as Record<string, unknown>)[method] as object;
        expect(Reflect.getMetadata(ACCESS_KEY, fn), `${controller.name}.${method}`).toEqual({ audience: 'ADMIN', kind: 'STAFF' });
        expect(Reflect.getMetadata(PERMISSION_KEY, fn), `${controller.name}.${method}`).toBe(permission);
        expect(isPermission(permission)).toBe(true);
      }
    }
  });
});

describe('API-011 — the lists refuse an unknown parameter', () => {
  it('CTL-020, CTL-040, CTL-001 — the query schemas are strict', () => {
    expect(programListQuerySchema.safeParse({ foo: '1' }).success).toBe(false);
    expect(propertyListQuerySchema.safeParse({ view: 'no-real-photo', kind: 'standalone' }).success).toBe(true);
    expect(propertyListQuerySchema.safeParse({ pageSize: '30' }).success).toBe(false);
    expect(promoterListQuerySchema.safeParse({ convention: 'expiring,expired' }).success).toBe(true);
  });
});

describe('CTL-061 — bulk price', () => {
  it('« de −90 à +500 », two decimals at most; « Fixer à » a positive amount', () => {
    const ids = ['01a12018-0ff8-74ca-8236-b4525cb4739e'];
    expect(lotBulkPriceSchema.safeParse({ lotIds: ids, mode: 'PERCENT', value: '-90' }).success).toBe(true);
    expect(lotBulkPriceSchema.safeParse({ lotIds: ids, mode: 'PERCENT', value: '500' }).success).toBe(true);
    expect(lotBulkPriceSchema.safeParse({ lotIds: ids, mode: 'PERCENT', value: '-91' }).success).toBe(false);
    expect(lotBulkPriceSchema.safeParse({ lotIds: ids, mode: 'PERCENT', value: '2,555' }).success).toBe(false);
    expect(lotBulkPriceSchema.safeParse({ lotIds: ids, mode: 'SET', value: '22350000.50' }).success).toBe(true);
    expect(lotBulkPriceSchema.safeParse({ lotIds: ids, mode: 'SET', value: '0' }).success).toBe(false);
  });
});

describe('CTL-100 — reading the grid', () => {
  const cell = (text: string, isNumber = false) => ({ text, isNumber });
  it('TRV-026 — « 22 350 000 », « 22.350.000 » and « 22350000 » are the same price; « 1.500 » is ambiguous', () => {
    for (const s of ['22 350 000', '22.350.000', '22350000', '22 350 000', '22,350,000']) expect(readNumber(cell(s), { max: 1e11 })).toEqual({ ok: true, value: 22350000 });
    expect(readNumber(cell('1.500'), { max: 1e11 }).ok).toBe(false);
    expect(readNumber(cell('85,5'), { max: 1e5 })).toEqual({ ok: true, value: 85.5 });
    expect(readNumber(cell('85.555'), { max: 1e5 }).ok).toBe(false);
    expect(readNumber(cell('12.5', true), { max: 1e5 })).toEqual({ ok: true, value: 12.5 }); // an XLSX number is taken as it is
  });
  it('a CSV with or without BOM, « ; » or « , » recognised on the header line', () => {
    const csv = Buffer.from('﻿lot;surface;prix\r\nA-1;62;"17 523 000"\r\n', 'utf8');
    const g = readGrid(csv);
    expect(g.ok && g.headers).toEqual(['lot', 'surface', 'prix']);
    expect(g.ok && g.rows[0]!.map((c) => c.text)).toEqual(['A-1', '62', '17 523 000']);
    const comma = readGrid(Buffer.from('Lot,Surface,Prix\nA-1,62,100\n'));
    expect(comma.ok && comma.headers).toEqual(['Lot', 'Surface', 'Prix']);
  });
  it('CTL-101 step 1 — the mapping is proposed from the headers, sans casse ni accent', () => {
    const m = proposeMapping(['Lot', 'Typologie', 'Pièces', 'Surface', 'Prix de vente', 'Étage', 'Statut', 'Divers']);
    expect(m).toEqual({ Lot: 'lot', Typologie: 'bien', Pièces: 'pieces', Surface: 'surface', 'Prix de vente': 'prix', Étage: 'etage', Statut: 'statut', Divers: null });
    expect(mappingComplete(m)).toBe(true);
    expect(mappingComplete({ Lot: 'lot', Surface: 'surface', Prix: 'prix' })).toBe(false); // neither bien nor type
    expect(fold('Rez-de-chaussée')).toBe('rezdechaussee');
  });
  it('CTL-100 — every column read as the rule says; an unreadable value, required or optional, is an error', () => {
    const headers = ['lot', 'type', 'pieces', 'surface', 'prix', 'etage', 'orientation', 'parking', 'statut'];
    const mapping = Object.fromEntries(headers.map((h) => [h, h as never]));
    const ok = readLine(2, ['A-1', 'Appartement', '3', '85', '22 350 000', 'RDC', 'nord est', 'x', 'Réservé'].map((t) => cell(t)), headers, mapping);
    expect(ok.issues).toEqual([]);
    expect(ok.values).toMatchObject({ lot: 'A-1', type: 'APARTMENT', pieces: 3, surface: 85, prix: '22350000.00', etage: 0, orientation: 'NE', parking: true, statut: 'RESERVED' });
    const bad = readLine(3, ['A-2', 'Appartement', '3', '85', '100', '3e', 'sud', 'peut-être', 'Sous option'].map((t) => cell(t)), headers, mapping);
    expect(bad.values).toBeNull();
    expect(bad.issues.map((i) => `${i.column}:${i.code}`).sort()).toEqual(['etage:INVALID_VALUE', 'parking:INVALID_VALUE', 'statut:INVALID_VALUE']);
    const missing = readLine(4, ['', 'Studio', '', '', '100', '', '', '', ''].map((t) => cell(t)), headers, mapping);
    expect(missing.issues.filter((i) => i.code === 'REQUIRED').map((i) => i.column).sort()).toEqual(['lot', 'surface']);
  });
});

describe('CTL-102 — the plan against the programme', () => {
  const typologies: ExistingTypology[] = [
    { id: 't2', reference: 'DP-DZ-0001', type: 'APARTMENT', rooms: 2 },
    { id: 't3a', reference: 'DP-DZ-0002', type: 'APARTMENT', rooms: 3 },
    { id: 't3b', reference: 'DP-DZ-0003', type: 'APARTMENT', rooms: 3 },
  ];
  const lot = (over: Partial<ExistingLot>): ExistingLot => ({
    id: 'l1', reference: 'A-1', propertyId: 't2', propertyReference: 'DP-DZ-0001', status: 'AVAILABLE', externalSale: false, referencePending: false, heldBy: null, hasActiveReservation: false,
    values: { surfaceM2: '62.00', price: '100.00', building: null, floor: 1, door: null, orientation: null, terraceM2: null, landM2: null, parkingIncluded: null, extras: null },
    ...over,
  });
  const line = (n: number, values: Record<string, unknown>) => ({ line: n, values: values as never, issues: [] });
  it('an existing lot is updated; an empty optional cell changes nothing; importing the same values twice changes nothing', () => {
    const plan = planImport([line(2, { lot: 'A-1', surface: 62, prix: '100.00' })], [lot({})], typologies);
    expect(plan.counters.toUpdate).toBe(0);
    const priced = planImport([line(2, { lot: 'a-1', surface: 62, prix: '120.00' })], [lot({})], typologies);
    expect(priced.counters.toUpdate).toBe(1);
    expect(priced.actions[0]).toMatchObject({ kind: 'update', patch: { price: '120.00' } });
  });
  it('a new lot: by `bien`, or by type and rooms; a missing typology is created, several are ambiguous', () => {
    const plan = planImport(
      [line(2, { lot: 'N-1', bien: 'DP-DZ-0001', surface: 60, prix: '1' }), line(3, { lot: 'N-2', type: 'DUPLEX', pieces: 5, surface: 150, prix: '1' }), line(4, { lot: 'N-3', type: 'DUPLEX', pieces: 5, surface: 140, prix: '1' }), line(5, { lot: 'N-4', type: 'APARTMENT', pieces: 3, surface: 80, prix: '1' })],
      [],
      typologies,
    );
    expect(plan.counters).toMatchObject({ toCreate: 3, typologiesToCreate: 1, errors: 1 });
    expect(plan.newTypologies.get('DUPLEX:5')).toEqual({ type: 'DUPLEX', rooms: 5, surface: 140 }); // the smallest surface of its lots
    expect(plan.issues.find((i) => i.line === 5)?.code).toBe('AMBIGUOUS_TYPOLOGY');
  });
  it('the same lot twice: the second line is in error; an import never moves a lot (LOT_ELSEWHERE); a different typology is flagged', () => {
    const plan = planImport([line(2, { lot: 'A-1', surface: 62, prix: '100.00' }), line(3, { lot: 'A-1', surface: 62, prix: '100.00' }), line(4, { lot: 'B-1', bien: 'DP-DZ-0002', surface: 62, prix: '1' })], [lot({}), lot({ id: 'l2', reference: 'B-1' })], typologies);
    expect(plan.issues.map((i) => `${i.line}:${i.code}`)).toEqual(['3:DUPLICATE_LOT', '4:LOT_ELSEWHERE']);
    const mismatch = planImport([line(2, { lot: 'A-1', type: 'APARTMENT', pieces: 3, surface: 62, prix: '100.00' })], [lot({})], [typologies[0]!, typologies[1]!]);
    expect(mismatch.issues[0]).toMatchObject({ code: 'TYPOLOGY_MISMATCH', level: 'FLAG', params: { bien: 'DP-DZ-0001' } });
  });
  it('statuses: only the changes CYC-100 allows by hand; a lot held by a dossier keeps its status and its adviser checks; a sold lot never comes back', () => {
    const held = planImport([line(2, { lot: 'A-1', surface: 62, prix: '150.00', statut: 'SOLD' })], [lot({ status: 'OPTIONED', heldBy: { dossierId: 'd', dossierReference: 'DOS-1', agentId: null }, hasActiveReservation: true })], typologies);
    expect(held.issues.map((i) => i.code)).toEqual(['RESERVATION_PRICE', 'HELD_BY_DOSSIER']);
    expect(held.actions[0]).toMatchObject({ kind: 'update', status: null, conflict: true, patch: { price: '150.00' } });
    const sold = planImport([line(2, { lot: 'A-1', surface: 62, prix: '100.00', statut: 'AVAILABLE' })], [lot({ status: 'SOLD', externalSale: true })], typologies);
    expect(sold.issues[0]).toMatchObject({ code: 'STATUS_UNCHANGED', params: { raison: 'reasonSold' } });
    const withdraw = planImport([line(2, { lot: 'A-1', surface: 62, prix: '100.00', statut: 'WITHDRAWN' })], [lot({})], typologies);
    expect(withdraw.actions[0]).toMatchObject({ status: 'WITHDRAWN' });
  });
  it('the lots absent from the file are counted, never touched', () => {
    const plan = planImport([line(2, { lot: 'A-1', surface: 62, prix: '100.00' })], [lot({}), lot({ id: 'l2', reference: 'B-1' }), lot({ id: 'l3', reference: 'C-1' })], typologies);
    expect(plan.counters.absent).toBe(2);
    expect(plan.actions.every((a) => a.kind !== 'update' || a.lot.reference === 'A-1')).toBe(true);
  });
});

describe('CTL-100 — the XLSX template', () => {
  it('a written workbook reads back the same (first sheet, text cells)', () => {
    const rows = [['lot', 'prix'], ['A-101', '22 350 000'], ['Étage « RDC »', '&<>']];
    const back = readXlsx(writeXlsx(rows, 'Lots'));
    expect(back?.map((r) => r.map((c) => c.text))).toEqual(rows);
    expect(readXlsx(Buffer.from('not a zip'))).toBeNull();
  });
});

describe('CTL-080, SEC-062 — the form of a video address', () => {
  it('YouTube and Vimeo addresses are recognised and put in canonical form; anything else is refused', () => {
    expect(videoAddress('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(videoAddress('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(videoAddress('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(videoAddress('https://vimeo.com/123456789')).toBe('https://vimeo.com/123456789');
    expect(videoAddress('https://player.vimeo.com/video/123456789')).toBe('https://vimeo.com/123456789');
    expect(videoAddress('https://example.com/video.mp4')).toBeNull();
    expect(videoAddress('javascript:alert(1)')).toBeNull();
  });
});

describe('AUT-073, Q-003, MED-011 — promoters', () => {
  it('AUT-073 — a convention or a document: expired, expiring within 30 days, valid, without date', () => {
    expect(expiryState(new Date('2026-10-01T00:00:00Z'), '2026-10-11')).toBe('EXPIRED');
    expect(expiryState(new Date('2026-11-10T00:00:00Z'), '2026-10-11')).toBe('EXPIRING');
    expect(expiryState(new Date('2026-12-31T00:00:00Z'), '2026-10-11')).toBe('OK');
    expect(expiryState(null, '2026-10-11')).toBe('NONE');
  });
  it('Q-003 — the six lines proposed at creation', () => {
    expect(DEFAULT_VETTING).toHaveLength(6);
    expect(DEFAULT_VETTING[0]).toBe('Registre de commerce vérifié');
  });
  it('MED-011 — the real type of a partner document: PDF, JPG, PNG only', () => {
    expect(documentType(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
    expect(documentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(documentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(documentType(Buffer.from('<svg/>'))).toBeNull();
  });
  it('AUT-073, AUT-079 — the three partner rules are valid definitions', () => {
    for (const seed of PARTNER_RULE_SEEDS) expect(parseRuleDefinition({ trigger: seed.trigger, conditions: seed.conditions, delayValue: seed.delayValue, delayUnit: seed.delayUnit, actions: seed.actions }), seed.code).toMatchObject({ ok: true });
    expect(PARTNER_RULE_SEEDS.map((s) => s.code)).toEqual(['R_CONVENTION_EXPIRING', 'R_PARTNER_DOC_EXPIRING', 'R_STOCK_CHECK']);
  });
});
