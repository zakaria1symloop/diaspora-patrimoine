import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { signRevalidateBody } from '../src/admin/revalidation.js';
import { detectImage, processImage } from '../src/files/image-pipeline.js';
import { LocalObjectStorage } from '../src/files/object-storage.js';
import { LocalAlwaysCleanScanner, scannerFor } from '../src/files/virus-scanner.js';

async function photo(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 60 } } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: 'secret', Artist: 'GPS owner' } }, orientation: 1 })
    .toBuffer();
}

describe('image pipeline', () => {
  it('MED-020 — renditions thumb 320 · card 640 · large 1280 · xl 1920 · og 1200×630, in AVIF, WebP and JPEG', async () => {
    const out = await processImage(await photo(2400, 1600));
    const r = out.renditions as Record<string, { width: number; height: number; formats: string[]; bytes: number }>;
    expect([r.thumb!.width, r.card!.width, r.large!.width, r.xl!.width]).toEqual([320, 640, 1280, 1920]);
    expect(r.thumb!.height).toBe(213);
    expect([r.og!.width, r.og!.height]).toEqual([1200, 630]);
    expect(r.card!.formats).toEqual(['avif', 'webp', 'jpg']);
    expect(out.files).toHaveLength(15);
    expect(r.card!.bytes).toBe(out.files.filter((f) => f.rendition === 'card').reduce((s, f) => s + f.body.length, 0));
  });

  it('MED-020 — never upscaled; blur preview WebP 24 px, under 1 kB, inline', async () => {
    const out = await processImage(await photo(500, 400));
    const r = out.renditions as Record<string, { width: number }>;
    expect([r.thumb!.width, r.card!.width, r.xl!.width]).toEqual([320, 500, 500]);
    const blur = out.renditions.blur as string;
    expect(blur.startsWith('data:image/webp;base64,')).toBe(true);
    const bytes = Buffer.from(blur.split(',')[1]!, 'base64');
    expect(bytes.length).toBeLessThan(1000);
    expect((await sharp(bytes).metadata()).width).toBe(24);
  });

  it('MED-020 — every metadata is removed from the renditions', async () => {
    const out = await processImage(await photo(800, 600));
    for (const f of out.files.filter((x) => x.format !== 'avif')) {
      const meta = await sharp(f.body).metadata();
      expect(meta.exif, `${f.rendition}.${f.format}`).toBeUndefined();
    }
  });

  it('MED-011 — the real type is read from the content', async () => {
    expect(await detectImage(Buffer.from('%PDF-1.7 not an image'))).toBeNull();
    expect(await detectImage(Buffer.alloc(0))).toBeNull();
    expect(await detectImage(await photo(30, 20))).toMatchObject({ format: 'jpeg', mimeType: 'image/jpeg', width: 30, height: 20 });
  });
});

describe('storage, antivirus, revalidation', () => {
  const root = mkdtempSync(join(tmpdir(), 'dp-storage-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('MED-016 — keys stay inside their space', async () => {
    const s = new LocalObjectStorage(root);
    await s.put('public', 'media/PROPERTY/a/b/card.jpg', Buffer.from('x'), 'image/jpeg');
    expect(await s.exists('public', 'media/PROPERTY/a/b/card.jpg')).toBe(true);
    expect(await s.exists('private', 'media/PROPERTY/a/b/card.jpg')).toBe(false);
    await expect(s.put('public', '../escape', Buffer.from('x'), 'text/plain')).rejects.toThrow();
    await s.deletePrefix('public', 'media/PROPERTY/a/b');
    expect(await s.exists('public', 'media/PROPERTY/a/b/card.jpg')).toBe(false);
  });

  it('MED-021 — the always-clean scanner exists only in local; elsewhere a missing antivirus keeps files PENDING', async () => {
    expect(scannerFor('local')).toBeInstanceOf(LocalAlwaysCleanScanner);
    expect(await scannerFor('staging').scan(Buffer.from('x'))).toBe('ERROR');
  });

  it('ARC-040 — X-Signature is sha256=<hex HMAC of the raw body>', () => {
    expect(signRevalidateBody('k'.repeat(32), '{"tags":["home"]}')).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signRevalidateBody('k'.repeat(32), '{"tags":["home"]}')).toBe(signRevalidateBody('k'.repeat(32), '{"tags":["home"]}'));
  });
});
