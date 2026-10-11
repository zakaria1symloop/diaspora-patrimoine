// API-100 — `GET /admin/{promoters|programs|properties}/{id}/timeline` (BO-050): the « Historique » tab of a record.
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { CatalogueTimelineService } from './catalogue-timeline.service.js';

const uuid = new ParseUUIDPipe();
type Q = { before?: string; type?: string };

@Controller('admin')
export class CatalogueTimelineController {
  constructor(private readonly timelines: CatalogueTimelineService) {}

  @Get('promoters/:id/timeline') @RequirePermission('promoter.read')
  promoter(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: Q) { return this.timelines.timeline(auth, 'PROMOTER', id, query); }
  @Get('programs/:id/timeline') @RequirePermission('catalogue.read')
  program(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: Q) { return this.timelines.timeline(auth, 'PROGRAM', id, query); }
  @Get('properties/:id/timeline') @RequirePermission('catalogue.read')
  property(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: Q) { return this.timelines.timeline(auth, 'PROPERTY', id, query); }
}
