// API-100 `/admin/dossiers` (package 3.7) and the client's answers `/client/candidates` (EC-12, EC-13). Every route
// declares its access (SEC-030): the permission of API-100 / API-101, or `@ClientAccess()`.
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClientAccess, CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { CandidatesService } from './candidates.service.js';
import { ClientAnswersService } from './client-answers.service.js';
import { DossierCommandsService } from './dossier-commands.service.js';
import { DossierReadService } from './dossier-read.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/dossiers')
export class DossiersAdminController {
  constructor(
    private readonly read: DossierReadService,
    private readonly commands: DossierCommandsService,
    private readonly candidates: CandidatesService,
  ) {}

  // ─── Reading (EA-21, EA-22) ───────────────────────────────────────────────
  @Get() @RequirePermission('dossier.read')
  list(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.read.list(auth, query); }
  @Get('pickers/clients') @RequirePermission('dossier.create')
  pickClients(@CurrentAuth() auth: AuthContext, @Query('q') q?: string) { return this.read.pickClients(auth, q); }
  @Get('pickers/properties') @RequirePermission('dossier.create')
  pickProperties(@Query('q') q?: string) { return this.read.pickProperties(q); }
  @Get('pickers/agents') @RequirePermission('dossier.read')
  pickAgents(@CurrentAuth() auth: AuthContext) { return this.read.agents(auth); }
  @Get(':id/timeline') @RequirePermission('dossier.read')
  timeline(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: { before?: string; type?: string }) { return this.read.timeline(auth, id, query); }
  @Get(':id/history') @RequirePermission('dossier.read')
  history(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.history(auth, id); }
  @Get(':id/effects') @RequirePermission('dossier.read')
  effects(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.effects(auth, id); }
  @Get(':id/qualification') @RequirePermission('dossier.read')
  qualification(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.read.qualification(auth, id); }
  @Get(':id/candidates') @RequirePermission('dossier.read')
  candidatesOf(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.candidates.list(auth, id); }
  @Get(':id/candidates/:cid/lots') @RequirePermission('dossier.read')
  candidateLots(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('cid', uuid) cid: string) { return this.candidates.lots(auth, id, cid); }
  @Get(':id/candidates/search') @RequirePermission('candidate.manage')
  search(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: Record<string, unknown>) { return this.candidates.search(auth, id, query); }
  @Get(':reference') @RequirePermission('dossier.read')
  detail(@CurrentAuth() auth: AuthContext, @Param('reference') reference: string) { return this.read.detail(auth, reference); }

  // ─── Writes on the dossier ────────────────────────────────────────────────
  @Post() @RequirePermission('dossier.create')
  async create(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    const r = await this.commands.create(auth, req, body);
    res.status(r.status);
    return r.body;
  }
  @Patch(':id') @HttpCode(200) @RequirePermission('dossier.update')
  update(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.commands.update(auth, id, body); }
  @Post(':id/assign') @HttpCode(200) @RequirePermission('dossier.assign')
  assign(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.commands.assign(auth, id, body); }
  @Post(':id/qualify') @HttpCode(200) @RequirePermission('dossier.transition')
  qualify(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.commands.qualify(auth, id, body); }
  @Post(':id/hold') @HttpCode(200) @RequirePermission('dossier.transition')
  hold(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.commands.hold(auth, id, body); }
  @Post(':id/resume') @HttpCode(200) @RequirePermission('dossier.transition')
  resume(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.commands.resume(auth, id); }
  @Post(':id/close') @HttpCode(200) @RequirePermission('dossier.close')
  close(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.commands.close(auth, id, body); }
  @Post(':id/reopen') @HttpCode(200) @RequirePermission('dossier.reopen')
  reopen(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.commands.reopen(auth, id, body); }
  @Post(':id/move-back') @HttpCode(200) @RequirePermission('dossier.transition.backward')
  moveBack(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.commands.moveBack(auth, id, body); }
  @Delete(':id') @HttpCode(204) @RequirePermission('dossier.delete')
  remove(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.commands.remove(auth, id, body); }

  // ─── The matching (PIP-030 … PIP-033) ─────────────────────────────────────
  @Post(':id/candidates/propose') @RequirePermission('candidate.manage')
  async propose(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) {
    const r = await this.candidates.propose(auth, req, id, body);
    res.status(r.status);
    return r.body;
  }
  @Post(':id/candidates/:cid/set-status') @HttpCode(200) @RequirePermission('candidate.manage')
  setStatus(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('cid', uuid) cid: string, @Body() body: unknown) { return this.candidates.setStatus(auth, id, cid, body); }
  @Patch(':id/candidates/:cid') @HttpCode(200) @RequirePermission('candidate.manage')
  note(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('cid', uuid) cid: string, @Body() body: unknown) { return this.candidates.note(auth, id, cid, body); }
  @Delete(':id/candidates/:cid') @HttpCode(204) @RequirePermission('candidate.manage')
  deleteDraft(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('cid', uuid) cid: string) { return this.candidates.deleteDraft(auth, id, cid); }
  @Post(':id/candidates/:cid/select') @HttpCode(200) @RequirePermission('candidate.manage')
  select(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('cid', uuid) cid: string, @Body() body: unknown) { return this.candidates.select(auth, id, cid, body); }
  @Post(':id/candidates/:cid/confirm-selection') @HttpCode(200) @RequirePermission('candidate.manage')
  confirmSelection(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('cid', uuid) cid: string, @Body() body: unknown) { return this.candidates.confirmSelection(auth, id, cid, body); }
  @Post(':id/candidates/:cid/decline-selection') @HttpCode(200) @RequirePermission('candidate.manage')
  declineSelection(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('cid', uuid) cid: string, @Body() body: unknown) { return this.candidates.declineSelection(auth, id, cid, body); }
  @Post(':id/candidates/:cid/unselect') @HttpCode(200) @RequirePermission('candidate.manage')
  unselect(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Param('cid', uuid) cid: string, @Body() body: unknown) { return this.candidates.unselect(auth, id, cid, body); }
}

/** EC-12, EC-13, EC-11 — the client's answers on a considered property and « Mon bien » (scoped to his record, ROL-030). */
@Controller('client')
@ClientAccess()
export class ClientCandidatesController {
  constructor(private readonly answers: ClientAnswersService) {}

  @Post('candidates/:id/interested') @HttpCode(200)
  interested(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.answers.interested(auth, id, body); }
  @Post('candidates/:id/decline') @HttpCode(200)
  decline(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.answers.decline(auth, id, body); }
  @Post('candidates/:id/select-request') @HttpCode(200)
  selectRequest(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.answers.selectRequest(auth, id, body); }
  @Post('candidates/:id/cancel-select') @HttpCode(200)
  cancelSelect(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.answers.cancelSelect(auth, id); }
  @Get('candidates/:id/lots')
  lots(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.answers.lots(auth, id); }
  @Get('dossiers/:reference/property')
  property(@CurrentAuth() auth: AuthContext, @Param('reference') reference: string) { return this.answers.property(auth, reference); }
}
