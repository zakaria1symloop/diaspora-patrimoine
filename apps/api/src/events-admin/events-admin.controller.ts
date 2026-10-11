// API-100 `/admin/events` — EVT-003…EVT-005, EVT-011. Staff session and declared permission required (SEC-030, ROL-020).
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { Actor } from '../admin/actor.js';
import { CurrentActor, RequirePermission, StaffGuard } from '../identity/access.js';
import { EventsAdminService } from './events-admin.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin/events')
@UseGuards(StaffGuard)
export class EventsAdminController {
  constructor(private readonly events: EventsAdminService) {}

  @Post() @RequirePermission('event.manage')
  create(@CurrentActor() actor: Actor, @Body() body: unknown) { return this.events.create(body as never, actor); }
  @Patch(':id') @RequirePermission('event.manage')
  update(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.events.update(id, body as never, actor); }
  @Post(':id/partners') @RequirePermission('event.manage')
  addPartner(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.events.addPartner(id, body as never, actor); }
  @Post(':id/publish') @HttpCode(200) @RequirePermission('event.manage')
  publish(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.events.publish(id, actor); }
  @Post(':id/close') @HttpCode(200) @RequirePermission('event.manage')
  close(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.events.close(id, actor); }
  @Post(':id/reopen') @HttpCode(200) @RequirePermission('event.manage')
  reopen(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.events.reopen(id, actor); }
  @Post(':id/cancel') @HttpCode(200) @RequirePermission('event.manage')
  cancel(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.events.cancel(id, body as never, actor); }
  @Post(':id/registrations') @RequirePermission('registration.manage')
  register(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.events.registerByStaff(id, body as never, actor); }
}
