// CTL-100 — just enough of the XLSX format for the lot grid, without a dependency (the machine's disk is nearly full):
// an XLSX file is a zip of XML parts. Reading takes the FIRST sheet (cell values, shared strings, inline strings,
// numbers as written); writing produces a one-sheet workbook of text cells (the downloadable template).
import { crc32, inflateRawSync } from 'node:zlib';

// ─── Zip ────────────────────────────────────────────────────────────────────

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function entries(buf: Buffer): ZipEntry[] {
  // End of central directory: signature 0x06054b50, searched from the end (a comment may follow it).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    out.push({ name: buf.subarray(p + 46, p + 46 + nameLen).toString('utf8'), method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function read(buf: Buffer, e: ZipEntry): Buffer {
  const p = e.localOffset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('bad local header');
  const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const data = buf.subarray(start, start + e.compressedSize);
  if (e.method === 0) return data;
  if (e.method === 8) return inflateRawSync(data, { maxOutputLength: 64 * 1024 * 1024 });
  throw new Error('unsupported compression');
}

// ─── Reading ────────────────────────────────────────────────────────────────

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');

/** The text of an `<si>` or an inline `<is>`: every `<t>` it holds, joined (rich text runs). */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1]!)).join('');

/** Column letters → index (A → 0, AB → 27). */
function columnIndex(ref: string): number {
  let n = 0;
  for (const c of ref.replace(/\d+$/, '')) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

export interface SheetCell {
  text: string;
  /** A cell of type number in the file: taken as it is (CTL-100). */
  isNumber: boolean;
}

/** `null` when the file is not a readable XLSX. */
export function readXlsx(buf: Buffer): SheetCell[][] | null {
  try {
    const list = entries(buf);
    const get = (name: string) => list.find((e) => e.name === name);
    const workbook = get('xl/workbook.xml');
    if (!workbook) return null;
    // The first sheet in the workbook order, through its relationship.
    const wb = read(buf, workbook).toString('utf8');
    const firstRid = wb.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
    let sheetPath = 'xl/worksheets/sheet1.xml';
    const rels = get('xl/_rels/workbook.xml.rels');
    if (firstRid && rels) {
      const relXml = read(buf, rels).toString('utf8');
      const target = [...relXml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${firstRid}"`))?.match(/Target="([^"]+)"/)?.[1];
      if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    }
    const sheetEntry = get(sheetPath);
    if (!sheetEntry) return null;
    const shared: string[] = [];
    const sst = get('xl/sharedStrings.xml');
    if (sst) for (const m of read(buf, sst).toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]!));
    const xml = read(buf, sheetEntry).toString('utf8');
    const rows: SheetCell[][] = [];
    for (const r of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const rowNumber = Number(r[1]!.match(/\br="(\d+)"/)?.[1] ?? rows.length + 1);
      const row: SheetCell[] = [];
      for (const c of r[2]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1]!;
        const inner = c[2] ?? '';
        const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
        const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? 'n';
        const value = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let cell: SheetCell = { text: '', isNumber: false };
        if (type === 's' && value !== undefined) cell = { text: shared[Number(value)] ?? '', isNumber: false };
        else if (type === 'inlineStr') cell = { text: textOf(inner), isNumber: false };
        else if (type === 'str' || type === 'e') cell = { text: unescape(value ?? ''), isNumber: false };
        else if (type === 'b') cell = { text: value === '1' ? '1' : '0', isNumber: false };
        else if (value !== undefined) cell = { text: value, isNumber: true };
        row[ref ? columnIndex(ref) : row.length] = cell;
      }
      rows[rowNumber - 1] = Array.from(row, (x) => x ?? { text: '', isNumber: false });
    }
    return Array.from(rows, (x) => x ?? []);
  } catch {
    return null;
  }
}

// ─── Writing (the template) ─────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const letters = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : letters(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

function zip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const crc = crc32(f.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, f.data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(f.data.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + f.data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

/** A one-sheet workbook of text cells, the first row bold (the column names of CTL-100). */
export function writeXlsx(rows: string[][], sheetName: string): Buffer {
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows
      .map(
        (row, r) =>
          `<row r="${r + 1}">${row.map((v, c) => `<c r="${letters(c)}${r + 1}" t="inlineStr"${r === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`,
      )
      .join('') +
    '</sheetData></worksheet>';
  const x = (s: string) => Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`, 'utf8');
  return zip([
    {
      name: '[Content_Types].xml',
      data: x(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      ),
    },
    { name: '_rels/.rels', data: x('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    {
      name: 'xl/workbook.xml',
      data: x(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: x('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    },
    {
      name: 'xl/styles.xml',
      data: x(
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>',
      ),
    },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheet, 'utf8') },
  ]);
}
