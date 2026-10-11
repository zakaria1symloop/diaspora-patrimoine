// MED-020 — image processing: auto-orient, sRGB, every metadata removed (sharp writes none unless asked), renditions
// thumb 320 · card 640 · large 1280 · xl 1920 (width, never upscaled) · og 1200×630 (cover, centred), each in AVIF q50,
// WebP q80, JPEG q82; plus a 24 px WebP blur kept inline. MED-011: the real type is read from the content.
import sharp, { type ResizeOptions, type Sharp } from 'sharp';

export const RENDITIONS = [
  { name: 'thumb', width: 320 },
  { name: 'card', width: 640 },
  { name: 'large', width: 1280 },
  { name: 'xl', width: 1920 },
  { name: 'og', width: 1200, height: 630 },
] as const;

export const FORMATS = ['avif', 'webp', 'jpg'] as const;
export type ImageFormat = (typeof FORMATS)[number];

/** MED-010 — photo / 3D image formats (real type). HEIC is converted like the others. */
const ACCEPTED = new Map<string, string>([
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['heif', 'image/heic'],
]);

export interface DetectedImage {
  format: string;
  mimeType: string;
  width: number;
  height: number;
}

/**
 * MED-011 — `null` when the content is not an accepted image (UNSUPPORTED_FILE_TYPE / FILE_UNREADABLE). `svg`: a logo
 * may be an SVG; the renditions rasterise it, so no script of the file ever reaches a page.
 */
export async function detectImage(body: Buffer, opts: { svg?: boolean } = {}): Promise<DetectedImage | null> {
  if (!body.length) return null;
  try {
    const meta = await sharp(body, { failOn: 'error' }).metadata();
    const mime = meta.format === 'svg' ? (opts.svg ? 'image/svg+xml' : undefined) : meta.format ? ACCEPTED.get(meta.format) : undefined;
    if (!mime || !meta.width || !meta.height) return null;
    const rotated = (meta.orientation ?? 1) >= 5;
    return { format: meta.format!, mimeType: mime, width: rotated ? meta.height : meta.width, height: rotated ? meta.width : meta.height };
  } catch {
    return null;
  }
}

export interface RenditionInfo {
  width: number;
  height: number;
  /** MED-071 — cumulated size of its formats. */
  bytes: number;
  formats: ImageFormat[];
}

export interface ProcessedImage {
  width: number;
  height: number;
  /** `Media.renditions` (01-domaine/03 § 4). */
  renditions: Record<string, RenditionInfo | string>;
  files: { rendition: string; format: ImageFormat; body: Buffer; contentType: string }[];
}

const CONTENT_TYPES: Record<ImageFormat, string> = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg' };

function encode(img: Sharp, format: ImageFormat): Sharp {
  if (format === 'avif') return img.avif({ quality: 50, effort: 4 });
  if (format === 'webp') return img.webp({ quality: 80 });
  return img.jpeg({ quality: 82, mozjpeg: true });
}

export async function processImage(body: Buffer): Promise<ProcessedImage> {
  // Auto-orient once, to sRGB; the normalised master keeps no metadata.
  const master = await sharp(body, { failOn: 'error' }).rotate().toColourspace('srgb').png({ compressionLevel: 1 }).toBuffer({ resolveWithObject: true });
  const width = master.info.width;
  const height = master.info.height;
  const renditions: ProcessedImage['renditions'] = {};
  const files: ProcessedImage['files'] = [];

  for (const r of RENDITIONS) {
    const resize: ResizeOptions =
      'height' in r
        ? { width: r.width, height: r.height, fit: 'cover', position: 'centre', withoutEnlargement: true }
        : { width: r.width, withoutEnlargement: true };
    let bytes = 0;
    let dims = { width: 0, height: 0 };
    for (const format of FORMATS) {
      const out = await encode(sharp(master.data).resize(resize), format).toBuffer({ resolveWithObject: true });
      dims = { width: out.info.width, height: out.info.height };
      bytes += out.data.length;
      files.push({ rendition: r.name, format, body: out.data, contentType: CONTENT_TYPES[format] });
    }
    renditions[r.name] = { ...dims, bytes, formats: [...FORMATS] };
  }

  // MED-020 point 4 — blur preview: WebP, 24 px wide, under 1 kB, inline.
  let quality = 50;
  let blur = await sharp(master.data).resize({ width: 24 }).webp({ quality }).toBuffer();
  while (blur.length > 1000 && quality > 10) {
    quality -= 15;
    blur = await sharp(master.data).resize({ width: 24 }).webp({ quality }).toBuffer();
  }
  renditions.blur = `data:image/webp;base64,${blur.toString('base64')}`;
  return { width, height, renditions, files };
}
