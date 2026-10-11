// API-100 `/admin` — routes of package 3.6 « Médias » (CTL-080 … CTL-084, API-080). The routes declare
// `catalogue.read` (every staff role); the right on the owner — `catalogue.write`, `promoter.write` or
// `content.manage` — is checked by the service for each call (the owner is only known from the body or the media).
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import type { Actor } from '../admin/actor.js';
import { CurrentActor, CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { MediaAdminService } from './media-admin.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/media')
export class MediaAdminController {
  constructor(private readonly media: MediaAdminService) {}

  @Get() @RequirePermission('catalogue.read')
  list(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.media.list(auth, query); }
  @Get('library') @RequirePermission('catalogue.read')
  library(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.media.library(auth, query); }

  /** API-080 step 1. */
  @Post('uploads') @RequirePermission('catalogue.read')
  announce(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.media.announce(auth, body); }
  /** API-080 step 2 — local stand-in for the direct send to the storage (raw bytes, signed address). */
  @Put('uploads/:id/content') @HttpCode(204) @RequirePermission('catalogue.read')
  content(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: { e?: string; s?: string }, @Body() body: unknown) { return this.media.receive(auth, id, query, body); }
  /** API-080 step 3. */
  @Post('uploads/:id/complete') @HttpCode(200) @RequirePermission('catalogue.read')
  complete(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.media.complete(auth, actor, id, body); }

  @Post('videos') @RequirePermission('catalogue.read')
  video(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Body() body: unknown) { return this.media.addVideo(auth, actor, body); }
  @Post('reorder') @HttpCode(200) @RequirePermission('catalogue.read')
  reorder(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Body() body: unknown) { return this.media.reorder(auth, actor, body); }
  @Post('bulk') @HttpCode(200) @RequirePermission('catalogue.read')
  bulk(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Body() body: unknown) { return this.media.bulk(auth, actor, body); }
  @Patch(':id') @HttpCode(200) @RequirePermission('catalogue.read')
  update(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.media.update(auth, actor, id, body); }
  @Post(':id/retry') @HttpCode(200) @RequirePermission('catalogue.read')
  retry(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.media.retry(auth, actor, id); }
  @Delete(':id') @HttpCode(200) @RequirePermission('catalogue.read')
  remove(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.media.remove(auth, actor, id); }
}
