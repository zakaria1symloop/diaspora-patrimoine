import 'server-only';
import { cache } from 'react';
import type { PublicImage } from '@dp/contracts';
import { ApiError, apiGet } from './api';

export type BlockMap = Record<string, unknown>;

/** CMS-020, EDI-001 — the blocks of one or more groups, as {key: value}; tag `content`. */
export const getBlocks = cache(async (...groups: string[]): Promise<BlockMap> => {
  const res = await apiGet<{ blocks: BlockMap }>('/public/content-blocks', {
    tags: ['content'],
    searchParams: { group: groups.join(',') },
  });
  return res.blocks;
});

/** A TEXT block, or null when empty — an empty block hides its element (D-089). */
export function text(blocks: BlockMap, key: string): string | null {
  const v = blocks[key];
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/** CMS-020 — an IMAGE block stores `{mediaId, alt}`; the API turns the id into its renditions. Empty or gone: null. */
export async function image(blocks: BlockMap, key: string): Promise<PublicImage | null> {
  return resolveImage(blocks[key]);
}

export async function resolveImage(value: unknown): Promise<PublicImage | null> {
  if (!value || typeof value !== 'object') return null;
  const { mediaId, alt } = value as { mediaId?: unknown; alt?: unknown };
  if (typeof mediaId !== 'string' || mediaId === '') return null;
  try {
    const img = await apiGet<PublicImage>(`/public/media/${encodeURIComponent(mediaId)}`, { tags: ['content'] });
    return typeof alt === 'string' ? { ...img, alt } : img;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
