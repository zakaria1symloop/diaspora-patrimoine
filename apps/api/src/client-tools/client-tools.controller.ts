// API-100 « Favoris, alertes » (client) — `GET /client/favorites` · `PUT`, `DELETE /client/favorites/{bien}` (EC-41) ·
// `GET`, `POST /client/alerts` · `PATCH`, `DELETE /client/alerts/{id}` (EC-42, CAT-093). The browser merge of
// favourites (`POST /client/favorites/merge`) stays in the identity module.
import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import type { AccountAlert, AccountAlertsResponse, AccountFavoritesResponse, CreateAccountAlertResult, FavoriteToggleResponse } from '@dp/contracts';
import type { Request, Response } from 'express';
import { ClientAccess, CurrentAuth } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { AccountAlertsService } from './account-alerts.service.js';
import { FavoritesService } from './favorites.service.js';

@Controller('client/favorites')
@ClientAccess()
export class ClientFavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentAuth() auth: AuthContext): Promise<AccountFavoritesResponse> {
    return this.favorites.list(auth);
  }

  @Put(':property')
  add(@CurrentAuth() auth: AuthContext, @Param('property') property: string): Promise<FavoriteToggleResponse> {
    return this.favorites.add(auth, property);
  }

  @Delete(':property')
  remove(@CurrentAuth() auth: AuthContext, @Param('property') property: string): Promise<FavoriteToggleResponse> {
    return this.favorites.remove(auth, property);
  }
}

@Controller('client/alerts')
@ClientAccess()
export class ClientAlertsController {
  constructor(private readonly alerts: AccountAlertsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentAuth() auth: AuthContext): Promise<AccountAlertsResponse> {
    return this.alerts.list(auth);
  }

  /** An alert (Idempotency-Key required, API-040) or a saved search (frequency NONE). */
  @Post()
  async create(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentAuth() auth: AuthContext, @Body() body: unknown): Promise<CreateAccountAlertResult> {
    const r = await this.alerts.create(req, auth, body);
    res.status(r.status);
    return r.body;
  }

  @Patch(':id')
  patch(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: unknown): Promise<AccountAlert> {
    return this.alerts.patch(auth, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.alerts.remove(auth, id);
  }
}
