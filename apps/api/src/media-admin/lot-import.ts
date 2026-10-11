// CTL-100 … CTL-102 — the rules of the lot import, pure (no database): read the file (CSV in UTF-8 with or without BOM,
// `;` or `,` recognised on the header line; XLSX first sheet), propose the mapping of its columns, read each cell
// (« sans casse ni accent », TRV-026 numbers, bounds of the Lot model), then plan each line against the programme as it
// is: create, update, flag, or refuse — never guess, never truncate, never erase (an empty optional cell changes
// nothing), never move a lot, never delete a lot absent from the file.
import { IMPORT_COLUMNS, type ImportColumn, type ImportCounters, type ImportIssue, type ImportIssueCode } from '@dp/contracts';
import { manualLotTransitionRefusal, type LotStatusCode } from '../catalogue-admin/catalogue-rules.js';
import { readXlsx, type SheetCell } from './xlsx.js';

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 2000;
const REQUIRED: ImportColumn[] = ['lot', 'surface', 'prix'];

/** « sans casse ni accent » — upper/lower case, accents, hyphens and spaces do not count. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\s\-_'’.]+/g, '');

// ─── Reading the file ───────────────────────────────────────────────────────

function parseCsv(text: string): SheetCell[][] {
  const body = text.replace(/^﻿/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: SheetCell[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row.map((t) => ({ text: t, isNumber: false })));
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row.map((t) => ({ text: t, isNumber: false })));
  }
  return rows;
}

export type FileReadResult = { ok: true; headers: string[]; rows: SheetCell[][] } | { ok: false; code: 'UNSUPPORTED_FILE_TYPE' | 'FILE_UNREADABLE' | 'TOO_MANY_ROWS' | 'FILE_TOO_LARGE' };

/** XLSX (a zip: `PK`) or CSV in UTF-8; blank lines dropped; the header is line 1. */
export function readGrid(buf: Buffer): FileReadResult {
  if (buf.length > IMPORT_MAX_BYTES) return { ok: false, code: 'FILE_TOO_LARGE' };
  let grid: SheetCell[][] | null;
  if (buf.subarray(0, 2).toString('latin1') === 'PK') grid = readXlsx(buf);
  else {
    const text = buf.toString('utf8');
    if (text.includes('�') || /[\u0000-\u0008]/.test(text)) return { ok: false, code: 'UNSUPPORTED_FILE_TYPE' };
    grid = parseCsv(text);
  }
  if (!grid || !grid.length) return { ok: false, code: 'FILE_UNREADABLE' };
  const headers = (grid[0] ?? []).map((c) => c.text.trim());
  const rows = grid.slice(1);
  // keep the line numbers of the file: a blank line stays (empty), the counters skip it
  if (rows.filter((r) => r.some((c) => c.text.trim() !== '')).length > IMPORT_MAX_ROWS) return { ok: false, code: 'TOO_MANY_ROWS' };
  if (!headers.some(Boolean)) return { ok: false, code: 'FILE_UNREADABLE' };
  return { ok: true, headers, rows };
}

const SYNONYMS: Record<ImportColumn, string[]> = {
  lot: ['lot', 'reference', 'referencelot', 'numerolot', 'numero', 'ref'],
  bien: ['bien', 'referencebien', 'typologie', 'property'],
  type: ['type', 'typedebien', 'nature'],
  pieces: ['pieces', 'piece', 'nbpieces', 'nombredepieces', 'rooms'],
  surface: ['surface', 'surfacem2', 'superficie', 'surfacehabitable'],
  prix: ['prix', 'price', 'prixdevente', 'montant'],
  batiment: ['batiment', 'bat', 'bloc', 'immeuble'],
  etage: ['etage', 'niveau', 'floor'],
  porte: ['porte', 'door', 'numeroporte'],
  orientation: ['orientation', 'exposition'],
  terrasse: ['terrasse', 'balcon', 'terrassem2', 'terrasseoubalcon'],
  terrain: ['terrain', 'terrainm2', 'jardin'],
  parking: ['parking', 'parkinginclus', 'garage'],
  options: ['options', 'option', 'extras', 'remarques'],
  statut: ['statut', 'status', 'etat', 'disponibilite'],
};

/** CTL-101 step 1 — the proposed mapping: a header that names a field (sans casse ni accent) feeds it, once. */
export function proposeMapping(headers: string[]): Record<string, ImportColumn | null> {
  const used = new Set<ImportColumn>();
  const out: Record<string, ImportColumn | null> = {};
  for (const h of headers) {
    if (!h) continue;
    const f = fold(h);
    const col = (IMPORT_COLUMNS as readonly ImportColumn[]).find((c) => !used.has(c) && SYNONYMS[c].includes(f)) ?? null;
    if (col) used.add(col);
    out[h] = col;
  }
  return out;
}

/** A mapping is usable when the required fields are fed, and `bien` or `type` + `pieces`. */
export function mappingComplete(mapping: Record<string, ImportColumn | null>): boolean {
  const fed = new Set(Object.values(mapping).filter(Boolean));
  return REQUIRED.every((c) => fed.has(c)) && (fed.has('bien') || fed.has('type'));
}

// ─── Reading one cell ───────────────────────────────────────────────────────

type Read<T> = { ok: true; value: T } | { ok: false };

/**
 * TRV-026 — « 22 350 000 », « 22.350.000 » and « 22350000 » are the same; « 1.500 » (one group of three after one
 * separator) is ambiguous and refused rather than guessed; two decimals at most.
 */
export function readNumber(cell: SheetCell, opts: { max: number; min?: number; integer?: boolean }): Read<number> {
  let s = cell.text.trim();
  let n: number;
  if (cell.isNumber) n = Number(s);
  else {
    s = s.replace(/[\s  ]/g, '');
    if (/^\d+$/.test(s)) n = Number(s);
    else if (/^-\d+$/.test(s) && opts.integer) n = Number(s);
    else if (/^\d{1,3}(\.\d{3}){2,}$/.test(s) || /^\d{1,3}(,\d{3}){2,}$/.test(s)) n = Number(s.replace(/[.,]/g, ''));
    else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'));
    else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) n = Number(s.replace(/,/g, ''));
    else if (/^\d+[.,]\d{3}$/.test(s)) return { ok: false }; // « 1.500 » / « 1,500 »: ambiguous
    else if (/^\d+[.,]\d{1,2}$/.test(s)) n = Number(s.replace(',', '.'));
    else return { ok: false };
  }
  if (!Number.isFinite(n)) return { ok: false };
  if (!opts.integer && Math.round(n * 100) / 100 !== n) return { ok: false }; // two decimals at most
  if (opts.integer && !Number.isInteger(n)) return { ok: false };
  if (n > opts.max || n < (opts.min ?? 0) || (!opts.integer && n <= 0)) return { ok: false };
  return { ok: true, value: n };
}

const TYPE_CODES: Record<string, string> = { appartement: 'APARTMENT', apartment: 'APARTMENT', studio: 'STUDIO', duplex: 'DUPLEX', villa: 'VILLA', terrain: 'LAND', land: 'LAND', localcommercial: 'COMMERCIAL', commercial: 'COMMERCIAL', local: 'COMMERCIAL' };
const ORIENTATIONS: Record<string, string> = { n: 'N', nord: 'N', ne: 'NE', nordest: 'NE', e: 'E', est: 'E', se: 'SE', sudest: 'SE', s: 'S', sud: 'S', sw: 'SW', so: 'SW', sudouest: 'SW', w: 'W', o: 'W', ouest: 'W', nw: 'NW', no: 'NW', nordouest: 'NW' };
const STATUSES: Record<string, LotStatusCode> = { disponible: 'AVAILABLE', available: 'AVAILABLE', reserve: 'RESERVED', reserved: 'RESERVED', vendu: 'SOLD', sold: 'SOLD', retire: 'WITHDRAWN', withdrawn: 'WITHDRAWN' };

export interface LotValues {
  lot: string;
  bien?: string;
  type?: string;
  pieces?: number | null;
  surface?: number;
  prix?: string;
  batiment?: string;
  etage?: number;
  porte?: string;
  orientation?: string;
  terrasse?: number;
  terrain?: number;
  parking?: boolean;
  options?: string;
  statut?: LotStatusCode;
}

export interface ReadLine {
  line: number;
  values: LotValues | null;
  issues: ImportIssue[];
}

const issue = (line: number, column: string | null, code: ImportIssueCode, level: 'ERROR' | 'FLAG' = 'ERROR', params: Record<string, string> = {}): ImportIssue => ({ line, column, level, code, params });

/** One line of the file, read through the mapping. An unreadable value, in a required OR optional column, is an error. */
export function readLine(line: number, cells: SheetCell[], headers: string[], mapping: Record<string, ImportColumn | null>): ReadLine {
  const at = (col: ImportColumn): SheetCell | null => {
    const h = headers.findIndex((x) => x && mapping[x] === col);
    if (h < 0) return null;
    const c = cells[h];
    return c ? { text: c.text.trim(), isNumber: c.isNumber } : { text: '', isNumber: false };
  };
  const issues: ImportIssue[] = [];
  const v: Partial<LotValues> = {};
  const bad = (col: ImportColumn, raw: string) => issues.push(issue(line, col, 'INVALID_VALUE', 'ERROR', { valeur: raw.slice(0, 60) }));
  const text = (col: ImportColumn, max: number): string | undefined => {
    const c = at(col);
    if (!c || c.text === '') return undefined;
    if (c.text.length > max) {
      bad(col, c.text);
      return undefined;
    }
    return c.text;
  };
  // required
  for (const col of REQUIRED) if (!at(col) || at(col)!.text === '') issues.push(issue(line, col, 'REQUIRED'));
  v.lot = text('lot', 40);
  const surface = at('surface');
  if (surface?.text) {
    const r = readNumber(surface, { max: 100_000 });
    if (r.ok) v.surface = r.value;
    else bad('surface', surface.text);
  }
  const prix = at('prix');
  if (prix?.text) {
    const r = readNumber(prix, { max: 100_000_000_000 });
    if (r.ok) v.prix = r.value.toFixed(2);
    else bad('prix', prix.text);
  }
  // one of the two: bien, or type + pieces
  const bien = text('bien', 40);
  if (bien !== undefined) v.bien = bien.toUpperCase();
  const type = at('type');
  if (type?.text) {
    const code = TYPE_CODES[fold(type.text)] ?? (['APARTMENT', 'STUDIO', 'DUPLEX', 'VILLA', 'LAND', 'COMMERCIAL'].includes(type.text.toUpperCase()) ? type.text.toUpperCase() : undefined);
    if (code) v.type = code;
    else bad('type', type.text);
  }
  const pieces = at('pieces');
  if (pieces?.text) {
    const r = readNumber(pieces, { min: 1, max: 12, integer: true });
    if (r.ok) v.pieces = r.value;
    else bad('pieces', pieces.text);
  }
  // optional
  v.batiment = text('batiment', 40);
  v.porte = text('porte', 20);
  v.options = text('options', 300);
  const etage = at('etage');
  if (etage?.text) {
    if (['rdc', 'rezdechaussee'].includes(fold(etage.text))) v.etage = 0;
    else {
      const r = readNumber(etage, { min: -2, max: 80, integer: true });
      if (r.ok) v.etage = r.value;
      else bad('etage', etage.text);
    }
  }
  const orientation = at('orientation');
  if (orientation?.text) {
    const code = ORIENTATIONS[fold(orientation.text)];
    if (code) v.orientation = code;
    else bad('orientation', orientation.text);
  }
  for (const col of ['terrasse', 'terrain'] as const) {
    const c = at(col);
    if (!c?.text) continue;
    const r = readNumber(c, { max: 100_000 });
    if (r.ok) v[col] = r.value;
    else bad(col, c.text);
  }
  const parking = at('parking');
  if (parking?.text) {
    const f = fold(parking.text);
    if (['oui', 'x', '1', 'yes'].includes(f)) v.parking = true;
    else if (['non', '0', 'no'].includes(f)) v.parking = false;
    else bad('parking', parking.text);
  }
  const statut = at('statut');
  if (statut?.text) {
    const f = fold(statut.text);
    const code = STATUSES[f] ?? (['AVAILABLE', 'RESERVED', 'SOLD', 'WITHDRAWN'].includes(statut.text.toUpperCase()) ? (statut.text.toUpperCase() as LotStatusCode) : undefined);
    if (code) v.statut = code;
    else bad('statut', statut.text); // « Sous option » included: an option is set from a dossier
  }
  return { line, values: issues.some((i) => i.level === 'ERROR') ? null : (v as LotValues), issues };
}

// ─── Planning against the programme ─────────────────────────────────────────

export interface ExistingLot {
  id: string;
  reference: string;
  propertyId: string;
  propertyReference: string;
  status: LotStatusCode;
  externalSale: boolean;
  referencePending: boolean;
  /** An OPTION or RESERVED reservation of a dossier holds it. */
  heldBy: { dossierId: string; dossierReference: string; agentId: string | null } | null;
  hasActiveReservation: boolean;
  values: { surfaceM2: string; price: string; building: string | null; floor: number | null; door: string | null; orientation: string | null; terraceM2: string | null; landM2: string | null; parkingIncluded: boolean | null; extras: string | null };
}

export interface ExistingTypology {
  id: string;
  reference: string;
  type: string;
  rooms: number | null;
}

export type PlannedAction =
  | { kind: 'create'; line: number; values: LotValues; propertyId: string | null; newTypologyKey: string | null }
  | { kind: 'update'; line: number; values: LotValues; lot: ExistingLot; patch: Record<string, unknown>; status: LotStatusCode | null; conflict: boolean };

export interface Plan {
  actions: PlannedAction[];
  /** Typologies to create: `{type}:{rooms}` → the smallest surface of their lots in the file. */
  newTypologies: Map<string, { type: string; rooms: number | null; surface: number }>;
  issues: ImportIssue[];
  counters: ImportCounters;
}

const sameDecimal = (a: string | null, b: number | undefined) => b === undefined || (a !== null && Number(a) === b);

export function planImport(lines: ReadLine[], lots: ExistingLot[], typologies: ExistingTypology[]): Plan {
  const issues: ImportIssue[] = lines.flatMap((l) => l.issues);
  const actions: PlannedAction[] = [];
  const newTypologies = new Map<string, { type: string; rooms: number | null; surface: number }>();
  const byRef = new Map(lots.map((l) => [l.reference.toUpperCase(), l]));
  const seen = new Set<string>();
  const errorLines = new Set(lines.filter((l) => !l.values).map((l) => l.line));
  for (const l of lines) {
    if (!l.values) continue;
    const v = l.values;
    const key = v.lot.toUpperCase();
    // the same lot twice in the file: the second line is in error
    if (seen.has(key)) {
      issues.push(issue(l.line, 'lot', 'DUPLICATE_LOT'));
      errorLines.add(l.line);
      continue;
    }
    seen.add(key);
    const existing = byRef.get(key);
    const typologyOf = (): { id: string | null; error?: ImportIssue; flagMismatch?: boolean; newKey?: string } => {
      if (v.bien) {
        const t = typologies.find((x) => x.reference.toUpperCase() === v.bien);
        if (!t) return { id: null, error: issue(l.line, 'bien', 'INVALID_VALUE', 'ERROR', { valeur: v.bien }) };
        return { id: t.id };
      }
      if (v.type) {
        const rooms = v.type === 'LAND' || v.type === 'COMMERCIAL' ? null : v.type === 'STUDIO' ? 1 : (v.pieces ?? null);
        const matches = typologies.filter((x) => x.type === v.type && (x.rooms ?? null) === rooms);
        if (matches.length > 1) return { id: null, error: issue(l.line, 'type', 'AMBIGUOUS_TYPOLOGY') };
        if (matches.length === 1) return { id: matches[0]!.id };
        if (rooms === null && v.type !== 'LAND' && v.type !== 'COMMERCIAL') return { id: null, error: issue(l.line, 'pieces', 'REQUIRED') };
        return { id: null, newKey: `${v.type}:${rooms ?? ''}` };
      }
      return { id: null, error: issue(l.line, 'bien', 'REQUIRED') };
    };

    if (!existing) {
      const t = typologyOf();
      if (t.error) {
        issues.push(t.error);
        errorLines.add(l.line);
        continue;
      }
      if (t.newKey) {
        const [type, rooms] = t.newKey.split(':');
        const cur = newTypologies.get(t.newKey);
        newTypologies.set(t.newKey, { type: type!, rooms: rooms ? Number(rooms) : null, surface: Math.min(cur?.surface ?? Infinity, v.surface ?? Infinity) });
      }
      actions.push({ kind: 'create', line: l.line, values: v, propertyId: t.id, newTypologyKey: t.newKey ?? null });
      continue;
    }

    // An existing lot is updated in place: an import never moves a lot.
    if (v.bien && v.bien !== existing.propertyReference.toUpperCase()) {
      issues.push(issue(l.line, 'bien', 'LOT_ELSEWHERE', 'ERROR', { bien: existing.propertyReference }));
      errorLines.add(l.line);
      continue;
    }
    if (!v.bien && v.type) {
      const t = typologyOf();
      if (t.id !== existing.propertyId) issues.push(issue(l.line, 'type', 'TYPOLOGY_MISMATCH', 'FLAG', { bien: existing.propertyReference }));
    }
    const ev = existing.values;
    const patch: Record<string, unknown> = {};
    if (!sameDecimal(ev.surfaceM2, v.surface)) patch.surfaceM2 = v.surface!.toFixed(2);
    if (v.prix !== undefined && Number(ev.price) !== Number(v.prix)) patch.price = v.prix;
    if (v.batiment !== undefined && v.batiment !== ev.building) patch.building = v.batiment;
    if (v.etage !== undefined && v.etage !== ev.floor) patch.floor = v.etage;
    if (v.porte !== undefined && v.porte !== ev.door) patch.door = v.porte;
    if (v.orientation !== undefined && v.orientation !== ev.orientation) patch.orientation = v.orientation;
    if (v.terrasse !== undefined && !sameDecimal(ev.terraceM2, v.terrasse)) patch.terraceM2 = v.terrasse.toFixed(2);
    if (v.terrain !== undefined && !sameDecimal(ev.landM2, v.terrain)) patch.landM2 = v.terrain.toFixed(2);
    if (v.parking !== undefined && v.parking !== ev.parkingIncluded) patch.parkingIncluded = v.parking;
    if (v.options !== undefined && v.options !== ev.extras) patch.extras = v.options;
    // MOD-313 — the public price of a reserved lot changes; the agreed price of its reservation does not.
    if ('price' in patch && existing.hasActiveReservation) issues.push(issue(l.line, 'prix', 'RESERVATION_PRICE', 'FLAG'));
    let status: LotStatusCode | null = null;
    let conflict = false;
    if (v.statut && v.statut !== existing.status) {
      if (existing.heldBy && v.statut !== 'AVAILABLE') {
        // CTL-102, CYC-107 — maybe a sale made on the promoter's side: the adviser verifies (R_LOT_IMPORT_CONFLICT).
        issues.push(issue(l.line, 'statut', 'HELD_BY_DOSSIER', 'FLAG', { reference: existing.heldBy.dossierReference }));
        conflict = true;
      } else if (existing.status === 'SOLD' && v.statut === 'AVAILABLE') {
        // CTL-102 — a sold lot does not come back on sale through an import (« Annuler cette vente » is a gesture of its own).
        issues.push(issue(l.line, 'statut', 'STATUS_UNCHANGED', 'FLAG', { raison: 'reasonSold' }));
      } else {
        const refusal = manualLotTransitionRefusal(existing.status, v.statut, { externalSale: existing.externalSale, referencePending: existing.referencePending, hasActiveReservation: existing.hasActiveReservation });
        if (refusal) {
          const raison = refusal === 'LOT_HAS_ACTIVE_RESERVATION' ? 'reasonHeld' : refusal === 'SALE_NOT_EXTERNAL' ? 'reasonSold' : refusal === 'LOT_REFERENCE_PENDING' ? 'reasonPending' : 'reasonNotAllowed';
          issues.push(issue(l.line, 'statut', 'STATUS_UNCHANGED', 'FLAG', { raison }));
        } else status = v.statut;
      }
    }
    actions.push({ kind: 'update', line: l.line, values: v, lot: existing, patch, status, conflict });
  }
  const flaggedLines = new Set(issues.filter((i) => i.level === 'FLAG').map((i) => i.line));
  const rows = lines.length;
  return {
    actions,
    newTypologies,
    issues: issues.sort((a, b) => a.line - b.line || (a.column ?? '').localeCompare(b.column ?? '')),
    counters: {
      rows,
      toCreate: actions.filter((a) => a.kind === 'create').length,
      toUpdate: actions.filter((a) => a.kind === 'update' && (Object.keys(a.patch).length > 0 || a.status !== null)).length,
      typologiesToCreate: newTypologies.size,
      flagged: [...flaggedLines].filter((l) => !errorLines.has(l)).length,
      errors: errorLines.size,
      absent: lots.filter((x) => !seen.has(x.reference.toUpperCase())).length,
    },
  };
}

/** CTL-101 — the detail of the dry run or of the report: `ligne ; colonne ; niveau ; code ; message`, UTF-8 with BOM. */
export function issuesCsv(issues: ImportIssue[], message: (i: ImportIssue) => string): string {
  const q = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = ['ligne;colonne;niveau;code;message', ...issues.map((i) => [String(i.line), i.column ?? '', i.level === 'ERROR' ? 'erreur' : 'signalement', i.code, message(i)].map(q).join(';'))];
  return `﻿${lines.join('\r\n')}\r\n`;
}
