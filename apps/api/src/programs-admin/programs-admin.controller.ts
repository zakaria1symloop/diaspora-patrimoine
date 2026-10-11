// API-100 `/admin` — routes of package 3.5 « Programmes et lots » (reads and the gestures added to `catalogue-admin/`).
// Every route declares its permission (SEC-030); the actor of each action is the staff member of the session (SEC-080).
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import type { Actor } from '../admin/actor.js';
import { CurrentActor, CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { ProgramsGesturesService } from './programs-gestures.service.js';
import { ProgramsReadService } from './programs-read.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin')
export class ProgramsAdminController {
  constructor(
    private readonly reads: ProgramsReadService,
    private readonly gestures: ProgramsGesturesService,
  ) {}

  // Programmes (CTL-020 … CTL-024)
  @Get('programs') @RequirePermission('catalogue.read')
  list(@Query() query: Record<string, unknown>) { return this.reads.list(query); }
  @Get('programs/:id') @RequirePermission('catalogue.read')
  one(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.reads.detail(auth, id); }
  @Get('programs/:id/dossiers') @RequirePermission('catalogue.read')
  dossiers(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.reads.dossiers(auth, id); }
  @Post('programs/:id/duplicate') @RequirePermission('catalogue.write')
  duplicate(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.gestures.duplicateProgram(id, actor); }
  @Delete('programs/:id') @HttpCode(200) @RequirePermission('catalogue.delete')
  remove(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.gestures.deleteProgram(id, actor); }

  // Lots (CTL-060 … CTL-064)
  @Get('programs/:id/lots') @RequirePermission('catalogue.read')
  programLots(@Param('id', uuid) id: string) { return this.reads.lots({ programId: id }); }
  @Get('properties/:id/lots') @RequirePermission('catalogue.read')
  propertyLots(@Param('id', uuid) id: string) { return this.reads.lots({ propertyId: id }); }
  @Get('lots/:id/price-history') @RequirePermission('catalogue.read')
  priceHistory(@Param('id', uuid) id: string) { return this.reads.priceHistory(id); }
  @Delete('lots/:id') @HttpCode(200) @RequirePermission('catalogue.write')
  deleteLot(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.gestures.deleteLot(id, actor); }
  @Post('lots/:id/duplicate') @RequirePermission('catalogue.write')
  duplicateLot(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.gestures.duplicateLot(id, actor); }
  @Post('lots/bulk-price') @HttpCode(200) @RequirePermission('catalogue.write')
  bulkPrice(@CurrentActor() actor: Actor, @Body() body: unknown) { return this.gestures.bulkPrice(body as never, actor); }
  @Post('lots/mark-delivered') @HttpCode(200) @RequirePermission('catalogue.write')
  markDelivered(@CurrentActor() actor: Actor, @Body() body: unknown) { return this.gestures.markDelivered(body, actor); }
  @Post('programs/:id/confirm-stock') @HttpCode(200) @RequirePermission('catalogue.write')
  confirmProgramStock(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.confirmStock({ programId: id }, body as never, actor); }
  @Post('properties/:id/confirm-stock') @HttpCode(200) @RequirePermission('catalogue.write')
  confirmPropertyStock(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.confirmStock({ propertyId: id }, body as never, actor); }

  // « À proximité » (CTL-140)
  @Get('programs/:id/pois') @RequirePermission('catalogue.read')
  programPois(@Param('id', uuid) id: string) { return this.gestures.pois({ programId: id }); }
  @Put('programs/:id/pois') @HttpCode(200) @RequirePermission('catalogue.write')
  setProgramPois(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.replacePois({ programId: id }, body as never, actor); }
  @Get('properties/:id/pois') @RequirePermission('catalogue.read')
  propertyPois(@Param('id', uuid) id: string) { return this.gestures.pois({ propertyId: id }); }
  @Put('properties/:id/pois') @HttpCode(200) @RequirePermission('catalogue.write')
  setPropertyPois(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.replacePois({ propertyId: id }, body as never, actor); }

  // « Chantier » (CTL-145)
  @Get('programs/:id/updates') @RequirePermission('catalogue.read')
  updates(@Param('id', uuid) id: string) { return this.gestures.updates(id); }
  @Post('programs/:id/updates') @RequirePermission('catalogue.write')
  createUpdate(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.createUpdate(id, body as never, actor); }
  @Patch('program-updates/:id') @HttpCode(200) @RequirePermission('catalogue.write')
  editUpdate(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.gestures.editUpdate(id, body as never, actor); }
  @Delete('program-updates/:id') @HttpCode(200) @RequirePermission('catalogue.write')
  deleteUpdate(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.gestures.deleteUpdate(id, actor); }
}
