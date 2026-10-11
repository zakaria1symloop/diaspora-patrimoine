// API-100 « Client » — the routes of package 2.8 (06-technique/02, § « Client »). Every route declares @ClientAccess()
// (SEC-030); the global AccessGuard checks the session, the kind and, on writes, the anti-forgery token (SEC-027).
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClientAccess, CurrentAuth } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { AgreementsService } from './agreements.service.js';
import { NotificationsService } from './notifications.service.js';
import { ProfileService } from './profile.service.js';
import { PropertiesService } from './properties.service.js';
import { RequestsService } from './requests.service.js';
import { SpaceService } from './space.service.js';

const uuid = new ParseUUIDPipe();

@Controller('client')
@ClientAccess()
export class ClientSpaceController {
  constructor(
    private readonly space: SpaceService,
    private readonly properties: PropertiesService,
    private readonly requests: RequestsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** ECL-001, ECL-002 — what the frame of every page needs. */
  @Get('space')
  summary(@CurrentAuth() auth: AuthContext) { return this.space.summary(auth); }
  @Get('dashboard')
  dashboard(@CurrentAuth() auth: AuthContext) { return this.space.dashboard(auth); }

  @Get('dossiers')
  dossiers(@CurrentAuth() auth: AuthContext) { return this.space.dossiers(auth); }
  @Get('dossiers/:reference')
  dossier(@CurrentAuth() auth: AuthContext, @Param('reference') reference: string) { return this.space.dossier(auth, reference); }
  @Get('dossiers/:reference/timeline')
  timeline(@CurrentAuth() auth: AuthContext, @Param('reference') reference: string, @Query() query: { before?: string; limit?: string; family?: string }) {
    return this.space.timeline(auth, reference, query);
  }

  @Get('interests')
  interests(@CurrentAuth() auth: AuthContext) { return this.properties.interests(auth); }
  @Get('proposals')
  proposals(@CurrentAuth() auth: AuthContext) { return this.properties.proposals(auth); }
  /** INT-011 */
  @Post('candidates/:id/view') @HttpCode(200)
  view(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.properties.view(auth, id); }

  /** MSG-021 — who « Écrire à mon conseiller » writes to. */
  @Get('advisor-contact')
  advisorContact(@CurrentAuth() auth: AuthContext) { return this.requests.context(auth); }
  @Post('leads')
  async lead(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    const r = await this.requests.send(req, auth, body);
    res.status(r.status);
    return r.body;
  }

  @Get('notifications')
  listNotifications(@CurrentAuth() auth: AuthContext, @Query() query: { limit?: string; unread?: string }) { return this.notifications.list(auth, query); }
  @Post('notifications/read') @HttpCode(200)
  read(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.notifications.read(auth, body); }
  @Post('notifications/read-all') @HttpCode(200)
  readAll(@CurrentAuth() auth: AuthContext) { return this.notifications.readAll(auth); }
}

/** EC-50, EC-53 — the account's own data (next to identity's `/client/me` routes). */
@Controller('client/me')
@ClientAccess()
export class ClientProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly agreements: AgreementsService,
  ) {}

  @Get('profile')
  get(@CurrentAuth() auth: AuthContext) { return this.profile.profile(auth); }
  /** PRO-001 — one section per call. */
  @Patch()
  update(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.profile.update(auth, body); }
  /** AUT-071 — « Mon adresse est correcte ». */
  @Post('email/confirm-valid') @HttpCode(204)
  confirmValid(@CurrentAuth() auth: AuthContext) { return this.profile.confirmEmailValid(auth); }
  @Get('consents')
  consents(@CurrentAuth() auth: AuthContext) { return this.agreements.list(auth); }
  @Post('consents') @HttpCode(200)
  changeConsent(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.agreements.change(req, auth, body); }
}

/** PRO-040 — trusted people. */
@Controller('client/contacts')
@ClientAccess()
export class ClientContactsController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) { return this.profile.contacts(auth); }
  @Post()
  add(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.profile.addContact(auth, body); }
  @Patch(':id')
  update(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.profile.updateContact(auth, id, body); }
  @Delete(':id') @HttpCode(204)
  remove(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.profile.deleteContact(auth, id); }
}
