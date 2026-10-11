// MOD-203 cover image, MOD-236 property then programme media, MED-016 public rendition URLs, MED-023 alt text.
import type { PublicImage } from '@dp/contracts';

export interface MediaRow {
  id: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  isCover: boolean;
  isIllustration: boolean;
  sortOrder: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  roomLabel: string | null;
  renditions: unknown;
}

const IMAGE_KINDS = new Set(['PHOTO', 'RENDER_3D']);

export function mediaBase(mediaUrl: string, m: Pick<MediaRow, 'ownerType' | 'ownerId' | 'id'>): string {
  return `${mediaUrl.replace(/\/$/, '')}/media/${m.ownerType}/${m.ownerId}/${m.id}`;
}

export function toPublicImage(mediaUrl: string, m: MediaRow, fallbackAlt: string): PublicImage {
  const r = (m.renditions ?? {}) as Record<string, { formats?: string[] } | string>;
  const names = Object.keys(r).filter((k) => k !== 'blur' && typeof r[k] === 'object');
  const formats = names.length ? ((r[names[0]!] as { formats?: string[] }).formats ?? ['jpg']) : ['jpg'];
  const alt = m.alt ?? (m.roomLabel ? `${fallbackAlt} – ${m.roomLabel}` : fallbackAlt);
  return {
    id: m.id,
    base: mediaBase(mediaUrl, m),
    width: m.width,
    height: m.height,
    alt,
    blur: typeof r.blur === 'string' ? r.blur : null,
    isIllustration: m.isIllustration,
    isRender3d: m.kind === 'RENDER_3D',
    renditions: names,
    formats,
  };
}

/** MOD-203: the `isCover` media, else the first ready PHOTO, then RENDER_3D, in display order. */
export function pickCover(media: MediaRow[]): MediaRow | null {
  const images = media.filter((m) => IMAGE_KINDS.has(m.kind)).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    images.find((m) => m.isCover) ??
    images.find((m) => m.kind === 'PHOTO') ??
    images.find((m) => m.kind === 'RENDER_3D') ??
    null
  );
}
