// GET /public/media/{id} — an image of the editable content (IMAGE blocks store `{mediaId, alt}`, CMS-020):
// the web resolves the id to the rendition URLs. CONTENT media only, public and READY; anything else is 404.
import { Controller, Get, Header, Inject, Param } from '@nestjs/common';
import type { PublicImage } from '@dp/contracts';
import { ENV, type Env } from '../config/env.js';
import { toPublicImage, type MediaRow } from '../catalogue/media.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Base of the public renditions. Hosted: MEDIA_URL (the CDN). Local development without MEDIA_URL: the path
 * `/media-files` alone — the web applications proxy it to the API (next.config), so the images also load for a
 * developer who opens the site through this machine's network address (where `localhost` would be his own machine).
 */
export function mediaUrlOf(env: Pick<Env, 'MEDIA_URL' | 'API_URL' | 'APP_ENV'>): string {
  return env.MEDIA_URL ?? (env.APP_ENV === 'local' ? '/media-files' : `${env.API_URL}/media-files`);
}

@Controller('public/media')
export class PublicMediaController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get(':id')
  @Header('Cache-Control', 'public, max-age=300')
  async one(@Param('id') id: string): Promise<PublicImage> {
    if (!UUID.test(id)) throw AppError.notFound();
    const m = await this.prisma.media.findFirst({
      where: { id, ownerType: 'CONTENT', isPublic: true, processingStatus: 'READY', deletedAt: null },
      select: {
        id: true, ownerType: true, ownerId: true, kind: true, isCover: true, isIllustration: true, sortOrder: true,
        width: true, height: true, alt: true, roomLabel: true, renditions: true,
      },
    });
    if (!m) throw AppError.notFound();
    return toPublicImage(mediaUrlOf(this.env), m as MediaRow, m.alt ?? '');
  }
}
