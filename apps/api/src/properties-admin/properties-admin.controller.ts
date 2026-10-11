// API-100 `/admin` — routes of package 3.5 « Biens » (reads, duplicate, delete, financing eligibility, home pins).
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import type { Actor } from '../admin/actor.js';
import { CurrentActor, CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { PropertiesGesturesService } from './properties-gestures.service.js';
import { PropertiesReadService } from './properties-read.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin')
export class PropertiesAdminController {
  constructor(
    private readonly reads: PropertiesReadService,
    private readonly gestures: PropertiesGesturesService,
  ) {}

  @Get('properties') @RequirePermission('catalogue.read')
  list(@Query() query: Record<string, unknown>) { return this.reads.list(query); }
  @Get('properties/:id') @RequirePermission('catalogue.read')
  one(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.reads.detail(auth, id); }
  @Get('properties/:id/dossiers') @RequirePermission('catalogue.read')
  dossiers(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.reads.dossiers(auth, id); }
  @Post('properties/:id/duplicate') @RequirePermission('catalogue.write')
  duplicate(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.duplicate(id, body, actor); }
  @Delete('properties/:id') @HttpCode(200) @RequirePermission('catalogue.delete')
  remove(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.gestures.remove(id, actor); }

  // CTL-130 — financing eligibility
  @Get('programs/:id/eligibility') @RequirePermission('catalogue.read')
  programEligibility(@Param('id', uuid) id: string) { return this.reads.eligibility({ programId: id }); }
  @Put('programs/:id/eligibility/:bankId') @HttpCode(200) @RequirePermission('catalogue.eligibility.manage')
  setProgramEligibility(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Param('bankId', uuid) bankId: string, @Body() body: unknown) { return this.gestures.setEligibility({ programId: id }, bankId, body as never, actor); }
  @Get('properties/:id/eligibility') @RequirePermission('catalogue.read')
  propertyEligibility(@Param('id', uuid) id: string) { return this.reads.eligibility({ propertyId: id }); }
  @Put('properties/:id/eligibility/:bankId') @HttpCode(200) @RequirePermission('catalogue.eligibility.manage')
  setPropertyEligibility(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Param('bankId', uuid) bankId: string, @Body() body: unknown) { return this.gestures.setEligibility({ propertyId: id }, bankId, body as never, actor); }

  // CTL-150 — home pins (the pin itself: `POST /admin/properties/{id}/feature`)
  @Get('featured') @RequirePermission('catalogue.read')
  featured(@CurrentAuth() auth: AuthContext) { return this.reads.featured(auth); }
}
