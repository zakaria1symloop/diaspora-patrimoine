// PAR-080, PAR-081 — installation data: the images of the home page's IMAGE content blocks, taken from the validated
// mockup (illustrations, Q-031). Each file goes through the media pipeline (MED-020) as a public CONTENT media owned by
// its block; natural key = block + file name + SHA-256, so a rerun creates nothing. The block's `value` AND
// `originValue` become `{ mediaId, alt }` only while the block still equals its previous origin: an administrator's
// change is never overwritten. Called once by install.ts, after its transaction (image processing is slow).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Clock } from '../platform/clock.js';
import type { PrismaService } from '../platform/prisma.service.js';
import { canonicalJson } from '../platform/tx.js';
import { SYSTEM_ACTOR } from '../admin/actor.js';
import { MediaPipeline, sha256 } from '../files/media-pipeline.js';
import { LocalObjectStorage } from '../files/object-storage.js';
import { scannerFor } from '../files/virus-scanner.js';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'Design', 'assets', 'content');

/** Neutral descriptions of the scenes (MED-023). */
const ALT = {
  hero: 'Salon lumineux ouvert sur une terrasse avec vue sur la mer',
  living: 'Salon lumineux d’un appartement neuf ouvert sur la mer',
  facade: 'Résidence neuve aux balcons vitrés face à la baie',
  street: 'Rue piétonne d’une résidence avec boulangerie, épicerie et école',
  cafe: 'Rencontre autour d’une table entre un promoteur, une banque, un notaire et des visiteurs',
  cup: 'Tasse de café posée sur une table, dans un intérieur lumineux',
};

const SINGLE: { key: string; file: string; alt: string }[] = [
  { key: 'home.hero.image', file: 'home-hero.jpg', alt: ALT.hero },
  { key: 'home.cafe.photo', file: 'home-cafe.jpg', alt: ALT.cafe },
];
/** `home.why.items`, in order (the six cards of ACC-030 « Motivations »): six different photos of the mockup, so that
 *  no two neighbouring cards repeat one. */
const WHY: { file: string; alt: string }[] = [
  { file: 'home-why-1.jpg', alt: ALT.living },
  { file: 'home-why-2.jpg', alt: ALT.facade },
  { file: 'home-why-3.jpg', alt: ALT.hero },
  { file: 'home-why-4.jpg', alt: ALT.street },
  { file: 'home-why-5.jpg', alt: ALT.cup },
  { file: 'home-why-6.jpg', alt: ALT.cafe },
];

type Image = { mediaId: string; alt: string };

export async function installContentMedia(prisma: PrismaClient, now: Date = new Date()): Promise<string[]> {
  const report: string[] = [];
  if (!existsSync(ASSETS)) return ['Images des contenus absentes (Design/assets/content) : blocs image laissés vides.'];
  const clock = { now: () => new Date() } as Clock;
  const pipeline = new MediaPipeline(prisma as PrismaService, clock, new LocalObjectStorage(), scannerFor(process.env.APP_ENV ?? 'local'));

  const ensureMedia = async (blockId: string, file: string, alt: string): Promise<Image | null> => {
    const path = join(ASSETS, file);
    if (!existsSync(path)) {
      report.push(`Image absente : ${file}.`);
      return null;
    }
    const body = await readFile(path);
    let media = await pipeline.findExisting('CONTENT', blockId, file, sha256(body));
    if (!media) {
      media = await pipeline.ingest({ ownerType: 'CONTENT', ownerId: blockId, kind: 'PHOTO', body, fileName: file, alt, isIllustration: true }, SYSTEM_ACTOR);
      report.push(`Image des contenus traitée : ${file} (${media.processingStatus}).`);
    }
    return media.processingStatus === 'READY' ? { mediaId: media.id, alt: media.alt ?? alt } : null;
  };

  /** PAR-081 — rewrite value and origin together, only if the value is still the previous origin. */
  const setOrigin = async (block: { id: string; key: string; value: unknown; originValue: unknown; version: number }, next: unknown) => {
    if (canonicalJson(block.value) === canonicalJson(next) && canonicalJson(block.originValue) === canonicalJson(next)) return;
    if (canonicalJson(block.value) !== canonicalJson(block.originValue ?? null)) {
      report.push(`Bloc ${block.key} modifié par un administrateur : laissé tel quel (PAR-081).`);
      return;
    }
    await prisma.contentBlock.update({
      where: { id: block.id, version: block.version },
      data: { value: next as never, originValue: next as never, version: { increment: 1 }, updatedAt: now },
    });
    report.push(`Bloc ${block.key} : image d’origine posée.`);
  };

  for (const s of SINGLE) {
    const block = await prisma.contentBlock.findUnique({ where: { key_locale: { key: s.key, locale: 'fr' } } });
    if (!block) {
      report.push(`Bloc ${s.key} absent : image non posée.`);
      continue;
    }
    const image = await ensureMedia(block.id, s.file, s.alt);
    if (image) await setOrigin(block, image);
  }

  const why = await prisma.contentBlock.findUnique({ where: { key_locale: { key: 'home.why.items', locale: 'fr' } } });
  if (!why) report.push('Bloc home.why.items absent : images non posées.');
  else {
    const origin = Array.isArray(why.originValue) ? (why.originValue as Record<string, unknown>[]) : [];
    const images: (Image | null)[] = [];
    for (const w of WHY) images.push(await ensureMedia(why.id, w.file, w.alt));
    const next = origin.map((item, i) => ({ ...item, image: images[i] ?? item.image ?? null }));
    if (next.length) await setOrigin(why, next);
  }
  return report;
}
