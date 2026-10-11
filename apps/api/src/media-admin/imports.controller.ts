// API-100 `/admin/imports` — the lot import (CTL-100 … CTL-102), `catalogue.import`: the two templates, the three-step
// upload (API-080), the job, `dry-run`, `confirm`, its detail as CSV and the list of the imports (ADM-085).
import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Actor } from '../admin/actor.js';
import { CurrentActor, CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { ImportsService } from './imports.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get('template.xlsx') @RequirePermission('catalogue.import')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="modele-lots.xlsx"')
  templateXlsx(@Res() res: Response) { res.send(this.imports.templateXlsx()); }
  @Get('template.csv') @RequirePermission('catalogue.import')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="modele-lots.csv"')
  templateCsv(@Res() res: Response) { res.send(this.imports.templateCsv()); }

  @Get() @RequirePermission('catalogue.import')
  list(@Query() query: Record<string, unknown>) { return this.imports.list(query); }
  @Post('uploads') @RequirePermission('catalogue.import')
  announce(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.imports.announce(auth, body); }
  @Put('uploads/:id/content') @HttpCode(204) @RequirePermission('catalogue.import')
  content(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: { e?: string; s?: string }, @Body() body: unknown) { return this.imports.receive(auth, id, query, body); }
  @Post() @RequirePermission('catalogue.import')
  create(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Body() body: unknown) { return this.imports.create(auth, actor, body); }
  @Get(':id') @RequirePermission('catalogue.import')
  one(@Param('id', uuid) id: string) { return this.imports.view(id); }
  @Get(':id/issues.csv') @RequirePermission('catalogue.import')
  async issues(@Param('id', uuid) id: string, @Res() res: Response) {
    const file = await this.imports.issuesFile(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.body);
  }
  @Post(':id/dry-run') @HttpCode(200) @RequirePermission('catalogue.import')
  dryRun(@Param('id', uuid) id: string, @Body() body: unknown) { return this.imports.dryRun(id, body); }
  @Post(':id/confirm') @HttpCode(200) @RequirePermission('catalogue.import')
  confirm(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.imports.confirm(actor, id); }
}
