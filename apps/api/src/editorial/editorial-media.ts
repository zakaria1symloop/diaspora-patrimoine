// MED-016, MED-023 — public images of the editorial pages (logos, covers, photos), loaded by id in one query.
import type { PublicImage } from '@dp/contracts';
import type { PrismaService } from '../platform/prisma.service.js';
import { toPublicImage, type MediaRow } from '../catalogue/media.js';

export const MEDIA_SELECT = {
  id: true, ownerType: true, ownerId: true, kind: true, isCover: true, isIllustration: true, sortOrder: true,
  width: true, height: true, alt: true, roomLabel: true, renditions: true,
} as const;

/** Ready, not deleted media by id; a missing one is simply absent from the map (the page shows its fallback). */
export async function imagesById(
  prisma: PrismaService,
  mediaUrl: string,
  wanted: { id: string | null; alt: string }[],
): Promise<Map<string, PublicImage>> {
  const ids = [...new Set(wanted.map((w) => w.id).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const rows = await prisma.media.findMany({
    where: { id: { in: ids }, processingStatus: 'READY', deletedAt: null },
    select: MEDIA_SELECT,
  });
  const altOf = new Map(wanted.filter((w) => w.id).map((w) => [w.id!, w.alt]));
  return new Map(rows.map((m) => [m.id, toPublicImage(mediaUrl, m as MediaRow, altOf.get(m.id) ?? '')]));
}
