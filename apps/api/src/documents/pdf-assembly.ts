// MED-032 — the images of a deposit become ONE PDF, in the order chosen by the depositor: one image per page, turned
// upright from its orientation, brought down to 2 000 px on its long side, every metadata removed (position included:
// sharp writes none unless asked), HEIC converted. A page has the image's proportions (no blank margins to print).
import PDFDocument from 'pdfkit';
import sharp from 'sharp';

/** MED-032 — long side of an assembled page image. */
export const ASSEMBLY_MAX_SIDE = 2000;

export class UnreadableImageError extends Error {
  constructor(readonly index: number) {
    super('unreadable image');
  }
}

/** Decodes and normalises one image (JPEG q85, ≤ 2000 px, upright, no metadata); throws when it cannot be read. */
export async function normaliseImage(body: Buffer): Promise<{ jpeg: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(body, { failOn: 'error' })
    .rotate()
    .resize({ width: ASSEMBLY_MAX_SIDE, height: ASSEMBLY_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb')
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height };
}

/** True when the image can be decoded (checked at the confirmation of an upload: FILE_UNREADABLE otherwise). */
export async function imageReadable(body: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(body, { failOn: 'error' }).metadata();
    if (!meta.width || !meta.height) return false;
    // A truncated file can have a valid header: decoding a small version proves the pixels are there.
    await sharp(body, { failOn: 'error' }).resize({ width: 16 }).toBuffer();
    return true;
  } catch {
    return false;
  }
}

/** Joins images (in order) into one PDF. Throws `UnreadableImageError` with the index of the first unreadable image. */
export async function assemblePdf(images: Buffer[], title: string): Promise<{ pdf: Buffer; pages: number }> {
  const pages: { jpeg: Buffer; width: number; height: number }[] = [];
  for (const [index, body] of images.entries()) {
    try {
      pages.push(await normaliseImage(body));
    } catch {
      throw new UnreadableImageError(index);
    }
  }
  const doc = new PDFDocument({ autoFirstPage: false, info: { Title: title.slice(0, 120), Producer: 'Diaspora Patrimoine', Creator: 'Diaspora Patrimoine' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    doc.on('end', () => resolve());
    doc.on('error', reject);
  });
  for (const p of pages) {
    // 72 dpi points: a 2000 px side becomes ~ 70 cm; scale so the long side is an A4 long side (842 pt).
    const scale = 842 / Math.max(p.width, p.height);
    const w = Math.round(p.width * scale);
    const h = Math.round(p.height * scale);
    doc.addPage({ size: [w, h], margin: 0 });
    doc.image(p.jpeg, 0, 0, { width: w, height: h });
  }
  doc.end();
  await done;
  return { pdf: Buffer.concat(chunks), pages: pages.length };
}
