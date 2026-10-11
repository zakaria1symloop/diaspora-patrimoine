// ARC-060 — `PdfRenderer`: the PDF documents of TRV-142 are described as a neutral model (title, meta lines, blocks,
// footer) and drawn by an implementation. `PdfkitRenderer` draws with pdfkit, in the brand fonts when their files are
// present (Red Hat Display for the text, Cinzel for the wordmark — WOFF files of @fontsource), else in Helvetica.
// The header carries the company name and the generation date, the footer the page number and the contact details.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { repoRoot } from '../../communication/mail-provider.js';

export type PdfBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string; tone?: 'normal' | 'muted' | 'notice' | 'strong' }
  | { kind: 'keyValues'; rows: [string, string][] }
  | { kind: 'figures'; items: { label: string; value: string; note?: string }[] }
  | { kind: 'table'; headers: string[]; rows: string[][]; align?: ('left' | 'right')[]; widths?: number[] };

export interface PdfDocumentModel {
  companyName: string;
  title: string;
  /** Under the title: date of generation, reference (TRV-142). */
  meta: string[];
  blocks: PdfBlock[];
  /** Notes printed at the end (TRV-023, TRV-024, CAL-106, SIM-005). */
  notes: string[];
  /** Contact details of the footer (`contact.legalName`, `address`, `phone`, `email`). */
  footer: string[];
  pageLabel: (n: number, total: number) => string;
}

export interface PdfRenderer {
  render(doc: PdfDocumentModel): Promise<Buffer>;
}

export const PDF_RENDERER = Symbol('PDF_RENDERER');

// Brand colours (DSN-010) — the PDF is not a web page: the tokens are copied here as the print palette.
const INK = '#0c1c47';
const SOFT = '#4a5580';
const ROYAL = '#06177a';
const GOLD = '#c9a06a';
const LINE = '#e8e1d5';
const NOTICE_BG = '#fbf0dc';
const ZEBRA = '#fbf8f3';

/** The brand font has no U+202F (Intl's French group separator): a no-break space is drawn instead. */
const clean = (t: string) => t.replace(/ /g, ' ');

/**
 * TRV-022 — « ≈ » is not in the brand font nor in WinAnsi: it is drawn with the standard Symbol font, whose byte 0xBB is
 * `approxequal` (pdfkit emits the WinAnsi byte of « » », U+00BB, which Symbol maps to ≈).
 */
function put(doc: PDFKit.PDFDocument, font: string, text: string, x: number | undefined, y: number | undefined, opts: PDFKit.Mixins.TextOptions): void {
  const parts = clean(text).split('≈');
  if (parts.length === 1) {
    if (x === undefined) doc.font(font).text(parts[0]!, opts);
    else doc.font(font).text(parts[0]!, x, y, opts);
    return;
  }
  parts.forEach((part, i) => {
    const last = i === parts.length - 1;
    const first = i === 0;
    if (part) {
      if (first && x !== undefined) doc.font(font).text(part, x, y, { ...opts, continued: !last || undefined });
      else doc.font(font).text(part, { ...opts, continued: !last });
    }
    if (!last) {
      if (first && !part && x !== undefined) doc.font('Symbol').text('»', x, y, { ...opts, continued: true });
      else doc.font('Symbol').text('»', { ...opts, continued: true });
    }
  });
}

function fontFiles(): { regular: string; bold: string; wordmark: string } | null {
  const dir = join(repoRoot(), 'packages', 'ui', 'node_modules', '@fontsource');
  const regular = join(dir, 'red-hat-display', 'files', 'red-hat-display-latin-400-normal.woff');
  const bold = join(dir, 'red-hat-display', 'files', 'red-hat-display-latin-700-normal.woff');
  const wordmark = join(dir, 'cinzel', 'files', 'cinzel-latin-600-normal.woff');
  return existsSync(regular) && existsSync(bold) ? { regular, bold, wordmark: existsSync(wordmark) ? wordmark : bold } : null;
}

export class PdfkitRenderer implements PdfRenderer {
  private readonly fonts = fontFiles();

  render(model: PdfDocumentModel): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 72, left: 48, right: 48 }, bufferPages: true, info: { Title: model.title, Author: model.companyName } });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    const F = { regular: 'Helvetica', bold: 'Helvetica-Bold', wordmark: 'Helvetica-Bold' };
    if (this.fonts) {
      doc.registerFont('dp-regular', this.fonts.regular);
      doc.registerFont('dp-bold', this.fonts.bold);
      doc.registerFont('dp-wordmark', this.fonts.wordmark);
      Object.assign(F, { regular: 'dp-regular', bold: 'dp-bold', wordmark: 'dp-wordmark' });
    }
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
    const ensure = (h: number) => {
      if (doc.y + h > bottomLimit()) doc.addPage();
    };

    // Header (TRV-142): wordmark, gold rule, title, meta lines.
    doc.font(F.wordmark).fontSize(15).fillColor(ROYAL).text(model.companyName.toUpperCase(), left, 40, { characterSpacing: 1.5 });
    doc.moveTo(left, doc.y + 4).lineTo(left + 64, doc.y + 4).lineWidth(2).strokeColor(GOLD).stroke();
    doc.moveDown(1.2);
    doc.fontSize(20).fillColor(INK);
    put(doc, F.bold, model.title, left, doc.y, { width });
    doc.fontSize(9.5).fillColor(SOFT);
    put(doc, F.regular, model.meta.join('  ·  '), undefined, undefined, { width });
    doc.moveDown(0.8);

    for (const b of model.blocks) {
      switch (b.kind) {
        case 'heading':
          ensure(40);
          doc.moveDown(0.6);
          doc.fontSize(12.5).fillColor(ROYAL);
          put(doc, F.bold, b.text, left, doc.y, { width });
          doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).lineWidth(0.6).strokeColor(LINE).stroke();
          doc.moveDown(0.5);
          break;
        case 'paragraph': {
          const tone = b.tone ?? 'normal';
          doc.font(tone === 'strong' ? F.bold : F.regular).fontSize(tone === 'muted' ? 8.5 : 10).fillColor(tone === 'muted' ? SOFT : INK);
          const h = doc.heightOfString(clean(b.text).replace(/≈/g, '~'), { width: width - (tone === 'notice' ? 16 : 0) });
          ensure(h + 12);
          if (tone === 'notice') {
            doc.rect(left, doc.y - 4, width, h + 10).fill(NOTICE_BG);
            doc.fillColor(INK);
            put(doc, F.regular, b.text, left + 8, doc.y, { width: width - 16 });
            doc.x = left;
          } else {
            put(doc, tone === 'strong' ? F.bold : F.regular, b.text, left, doc.y, { width });
          }
          doc.moveDown(0.4);
          break;
        }
        case 'keyValues':
          doc.fontSize(10);
          for (const [k, v] of b.rows) {
            ensure(16);
            const y = doc.y;
            doc.fillColor(SOFT);
            put(doc, F.regular, k, left, y, { width: width * 0.55 });
            const hk = doc.y - y;
            doc.fillColor(INK);
            put(doc, F.bold, v, left + width * 0.55, y, { width: width * 0.45, align: 'right' });
            doc.y = Math.max(doc.y, y + hk) + 3;
          }
          doc.x = left;
          break;
        case 'figures': {
          const cols = Math.min(3, b.items.length);
          const w = width / cols;
          for (let i = 0; i < b.items.length; i += cols) {
            ensure(54);
            const y = doc.y;
            let maxY = y;
            b.items.slice(i, i + cols).forEach((it, j) => {
              const x = left + j * w;
              doc.fontSize(8.5).fillColor(SOFT);
              put(doc, F.regular, it.label, x, y, { width: w - 10 });
              doc.fontSize(15).fillColor(INK);
              put(doc, F.bold, it.value, x, doc.y + 1, { width: w - 10 });
              if (it.note) {
                doc.fontSize(8).fillColor(SOFT);
                put(doc, F.regular, it.note, x, doc.y, { width: w - 10 });
              }
              maxY = Math.max(maxY, doc.y);
            });
            doc.y = maxY + 8;
          }
          doc.x = left;
          break;
        }
        case 'table': {
          const n = b.headers.length;
          const widths = b.widths ?? b.headers.map(() => 1 / n);
          const xs = widths.reduce<number[]>((acc, _w, i) => [...acc, i === 0 ? left : acc[i - 1]! + widths[i - 1]! * width], []);
          const row = (cells: string[], header: boolean, zebra: boolean) => {
            doc.font(header ? F.bold : F.regular).fontSize(header ? 8.5 : 8.5);
            const h = Math.max(...cells.map((c, i) => doc.heightOfString(clean(c).replace(/≈/g, '~'), { width: widths[i]! * width - 8 }))) + 6;
            if (doc.y + h > bottomLimit()) {
              doc.addPage();
              if (!header) row(b.headers, true, false);
            }
            const y = doc.y;
            if (zebra) doc.rect(left, y, width, h).fill(ZEBRA);
            if (header) doc.rect(left, y, width, h).fill('#eaf3fd');
            cells.forEach((c, i) => {
              doc.fillColor(header ? ROYAL : INK);
              put(doc, header ? F.bold : F.regular, c, xs[i]! + 4, y + 3, { width: widths[i]! * width - 8, align: b.align?.[i] ?? 'left' });
            });
            doc.y = y + h;
          };
          ensure(40);
          row(b.headers, true, false);
          b.rows.forEach((r, i) => row(r, false, i % 2 === 1));
          doc.x = left;
          doc.moveDown(0.4);
          break;
        }
      }
    }

    if (model.notes.length) {
      doc.moveDown(0.8);
      for (const note of model.notes) {
        doc.font(F.regular).fontSize(8).fillColor(SOFT);
        ensure(doc.heightOfString(clean(note), { width }) + 6);
        put(doc, F.regular, note, left, doc.y, { width });
        doc.moveDown(0.3);
      }
    }

    // Footer of every page (TRV-142): contact details and « Page n sur N ».
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const y = doc.page.height - 50;
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // writing in the margin must not open a new page
      doc.moveTo(left, y - 6).lineTo(left + width, y - 6).lineWidth(0.5).strokeColor(LINE).stroke();
      doc.font(F.regular).fontSize(7.5).fillColor(SOFT);
      doc.text(clean(model.footer.join('  ·  ')), left, y, { width: width - 70, lineBreak: true });
      doc.text(clean(model.pageLabel(i - range.start + 1, range.count)), left + width - 70, y, { width: 70, align: 'right' });
      doc.page.margins.bottom = savedBottom;
    }
    doc.end();
    return done;
  }
}
