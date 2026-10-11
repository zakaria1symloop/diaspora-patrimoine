// API-100 `/admin` — routes of the back-office foundation: `me` (shell, profile), `notifications`, `search`,
// `saved-views`, `notes`, `users` (team) and `leads` in reading with their timeline. Every route declares its access
// (SEC-030): a permission of the matrix (ROL-020), or `@StaffAccess()` for what belongs to the connected account.
// BO-005: changing a role and resetting the second factor of a colleague ask for a recent password (403 REAUTH_REQUIRED).
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentAuth, RequirePermission, RequireRecentPassword, StaffAccess } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { LeadsAdminService } from './leads-admin.service.js';
import { NotesTimelineService } from './notes-timeline.service.js';
import { SavedViewsService } from './saved-views.service.js';
import { SearchService } from './search.service.js';
import { ShellService } from './shell.service.js';
import { StaffNotificationsService } from './staff-notifications.service.js';
import { TeamService } from './team.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/me')
@StaffAccess()
export class StaffShellController {
  constructor(private readonly shell: ShellService) {}

  @Get('shell')
  get(@CurrentAuth() auth: AuthContext) { return this.shell.shell(auth); }
  @Get('profile')
  profile(@CurrentAuth() auth: AuthContext) { return this.shell.profile(auth); }
  @Patch() @HttpCode(200)
  update(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.shell.updateProfile(auth, body); }
}

@Controller('admin')
@StaffAccess()
export class StaffSocleController {
  constructor(
    private readonly notifications: StaffNotificationsService,
    private readonly searches: SearchService,
    private readonly savedViews: SavedViewsService,
  ) {}

  // The bell (BO-060)
  @Get('notifications')
  list(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.notifications.list(auth, query); }
  @Post('notifications/read') @HttpCode(200)
  read(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.notifications.read(auth, body); }
  @Post('notifications/read-all') @HttpCode(200)
  readAll(@CurrentAuth() auth: AuthContext) { return this.notifications.readAll(auth); }

  // Global search (BO-030) — each group follows the permission of its object
  @Get('search')
  search(@CurrentAuth() auth: AuthContext, @Query('q') q?: string, @Query('types') types?: string) { return this.searches.search(auth, q, types); }

  // Saved views (BO-040)
  @Get('saved-views')
  views(@CurrentAuth() auth: AuthContext, @Query('listKey') listKey?: string) { return this.savedViews.list(auth, listKey); }
  @Post('saved-views')
  createView(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.savedViews.create(auth, body); }
  @Put('saved-views/default') @HttpCode(200)
  defaultView(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.savedViews.setDefault(auth, body); }
  @Patch('saved-views/:id') @HttpCode(200)
  updateView(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.savedViews.update(auth, id, body); }
  @Post('saved-views/:id/share') @HttpCode(200) @RequirePermission('view.share')
  shareView(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.savedViews.share(auth, id, body); }
  @Delete('saved-views/:id') @HttpCode(204)
  removeView(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.savedViews.remove(auth, id); }
}

@Controller('admin/notes')
export class NotesController {
  constructor(private readonly notes: NotesTimelineService) {}

  @Get() @RequirePermission('note.read')
  list(@CurrentAuth() auth: AuthContext, @Query() query: { entityType?: string; entityId?: string }) { return this.notes.list(auth, query); }
  @Post() @RequirePermission('note.manage')
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.notes.create(auth, body); }
  @Patch(':id') @HttpCode(200) @RequirePermission('note.manage')
  update(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.notes.update(auth, id, body); }
  @Post(':id/pin') @HttpCode(200) @RequirePermission('note.manage')
  pin(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.notes.pin(auth, id, body); }
  @Delete(':id') @HttpCode(204) @RequirePermission('note.manage')
  remove(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.notes.remove(auth, id); }
}

@Controller('admin/users')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get() @RequirePermission('user.read')
  list(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.team.list(auth, query); }
  @Post('invite') @RequirePermission('user.manage')
  invite(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.team.invite(auth, body); }
  @Post(':id/resend-invitation') @HttpCode(200) @RequirePermission('user.manage')
  resend(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.team.resendInvitation(auth, id); }
  @Post(':id/cancel-invitation') @HttpCode(204) @RequirePermission('user.manage')
  cancel(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.team.cancelInvitation(auth, id); }
  @Post(':id/change-role') @HttpCode(200) @RequirePermission('user.manage') @RequireRecentPassword()
  changeRole(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.team.changeRole(auth, id, body); }
  @Patch(':id') @HttpCode(200) @RequirePermission('user.manage')
  update(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.team.update(auth, id, body); }
  @Post(':id/suspend') @HttpCode(200) @RequirePermission('user.manage')
  suspend(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.team.suspend(auth, id, body); }
  @Post(':id/reactivate') @HttpCode(200) @RequirePermission('user.manage')
  reactivate(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.team.reactivate(auth, id); }
  @Post(':id/reset-two-factor') @HttpCode(200) @RequirePermission('user.twofactor.reset') @RequireRecentPassword()
  resetTwoFactor(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.team.resetTwoFactor(auth, id, body); }
}

@Controller('admin/leads')
export class LeadsAdminController {
  constructor(
    private readonly leads: LeadsAdminService,
    private readonly timeline: NotesTimelineService,
  ) {}

  @Get() @RequirePermission('lead.read')
  list(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.leads.list(auth, query); }
  @Get(':id/timeline') @RequirePermission('lead.read')
  timelineOf(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: { before?: string; type?: string }) { return this.timeline.leadTimeline(auth, id, query); }
  @Get(':reference') @RequirePermission('lead.read')
  detail(@CurrentAuth() auth: AuthContext, @Param('reference') reference: string) { return this.leads.detail(auth, reference); }
}
