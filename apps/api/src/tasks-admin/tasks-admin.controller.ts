// API-100 `/admin/tasks`, `/admin/appointments`, `/admin/agenda` (package 3.8) and the client's appointments
// `/client/appointments` (EC-14). Every route declares its access (SEC-030).
import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ClientAccess, CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { ErrorCode } from '@dp/contracts';
import { AppError } from '../platform/errors.js';
import { SettingsService } from '../platform/settings.service.js';
import { AppointmentsService } from './appointments.service.js';
import { TasksAdminService } from './tasks-admin.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/tasks')
export class TasksAdminController {
  constructor(private readonly tasks: TasksAdminService) {}

  @Get() @RequirePermission('task.read')
  list(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.tasks.list(auth, query); }
  @Post() @RequirePermission('task.manage')
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.tasks.create(auth, body); }
  @Post('bulk') @HttpCode(200) @RequirePermission('task.manage')
  bulk(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.tasks.bulk(auth, body); }
  @Get(':id') @RequirePermission('task.read')
  detail(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.tasks.detail(auth, id); }
  @Patch(':id') @HttpCode(200) @RequirePermission('task.manage')
  update(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.tasks.update(auth, id, body); }
  @Post(':id/postpone') @HttpCode(200) @RequirePermission('task.manage')
  postpone(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.tasks.postpone(auth, id, body); }
  @Post(':id/complete') @HttpCode(200) @RequirePermission('task.manage')
  complete(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.tasks.complete(auth, id, body); }
  @Post(':id/cancel') @HttpCode(200) @RequirePermission('task.manage')
  cancel(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.tasks.cancel(auth, id, body); }
  @Post(':id/reopen') @HttpCode(200) @RequirePermission('task.manage')
  reopen(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.tasks.reopen(auth, id); }
  @Post(':id/take') @HttpCode(200) @RequirePermission('task.manage')
  take(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.tasks.take(auth, id); }
  @Post(':id/assign') @HttpCode(200) @RequirePermission('task.manage')
  assign(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.tasks.assign(auth, id, body); }
}

@Controller('admin')
export class AppointmentsAdminController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('agenda') @RequirePermission('appointment.read')
  agenda(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.appointments.agenda(auth, query); }
  @Get('appointments') @RequirePermission('appointment.read')
  list(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.appointments.list(auth, query); }
  @Get('appointments/pickers/clients') @RequirePermission('appointment.manage')
  pickClients(@CurrentAuth() auth: AuthContext, @Query('q') q?: string, @Query('id') id?: string) { return this.appointments.pickClients(auth, q, id); }
  @Get('appointments/warnings') @RequirePermission('appointment.manage')
  warnings(@CurrentAuth() auth: AuthContext, @Query() query: Record<string, unknown>) { return this.appointments.warnings(auth, query); }
  @Post('appointments') @RequirePermission('appointment.manage')
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.appointments.create(auth, body); }
  @Get('appointments/:id') @RequirePermission('appointment.read')
  detail(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.appointments.detail(auth, id); }
  @Patch('appointments/:id') @HttpCode(200) @RequirePermission('appointment.manage')
  update(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.appointments.update(auth, id, body); }
  @Post('appointments/:id/confirm') @HttpCode(200) @RequirePermission('appointment.manage')
  confirm(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.appointments.confirm(auth, id, body); }
  @Post('appointments/:id/reschedule') @HttpCode(200) @RequirePermission('appointment.manage')
  reschedule(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.appointments.reschedule(auth, id, body); }
  @Post('appointments/:id/cancel') @HttpCode(200) @RequirePermission('appointment.manage')
  cancel(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.appointments.cancel(auth, id, body); }
  @Post('appointments/:id/done') @HttpCode(200) @RequirePermission('appointment.manage')
  done(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.appointments.done(auth, id, body); }
  @Post('appointments/:id/no-show') @HttpCode(200) @RequirePermission('appointment.manage')
  noShow(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.appointments.noShow(auth, id); }
  @Post('appointments/:id/correct-outcome') @HttpCode(200) @RequirePermission('appointment.manage')
  correct(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.appointments.correct(auth, id, body); }
}

/** EC-14 — the client's appointments (INT-040 … INT-044); the request by the client (INT-040) is package A.8. */
@Controller('client/appointments')
@ClientAccess()
export class ClientAppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) { return this.appointments.clientList(auth); }
  /** A.8 — INT-040 « Demander un rendez-vous », only while `features.clientAppointments` is on. */
  @Post()
  async request(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    if (!(await this.settings.get('features.clientAppointments'))) throw new AppError(ErrorCode.FORBIDDEN);
    return this.appointments.clientRequest(auth, body);
  }
  @Patch(':id')
  wishes(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.appointments.clientUpdateWishes(auth, id, body); }
  @Post(':id/cancel') @HttpCode(200)
  cancel(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.appointments.clientCancel(auth, id, body); }
  @Get(':id/calendar')
  async calendar(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.appointments.clientCalendar(auth, id, await this.settings.get('contact.companyName'));
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8; method=PUBLISH', 'Content-Disposition': `attachment; filename="${file.filename}"`, 'Cache-Control': 'private, no-store' });
    return file.body;
  }
}
