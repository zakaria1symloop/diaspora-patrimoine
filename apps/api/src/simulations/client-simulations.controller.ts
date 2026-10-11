// API-100 « Simulations » (client) — `GET /client/simulations` · `GET`, `PATCH`, `DELETE /client/simulations/{id}` ·
// `GET …/{id}/pdf` (EC-40); and, proposed to API-100 for SIM-033, `GET /client/simulations/prefill` and
// `POST /client/simulations/{id}/profile` (« Mettre à jour mon profil avec ces informations »). Saving itself stays on
// the public routes (`POST /public/simulations`, `…/{id}/save`), which know the session (SIM-032).
import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Res } from '@nestjs/common';
import type { ClientSimulationDetail, ClientSimulationItem, ClientSimulationList, SimulatorPrefill } from '@dp/contracts';
import type { Response } from 'express';
import { ClientAccess, CurrentAuth } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { ClientSimulationsService } from './client-simulations.service.js';

@Controller('client/simulations')
@ClientAccess()
export class ClientSimulationsController {
  constructor(private readonly sims: ClientSimulationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentAuth() auth: AuthContext): Promise<ClientSimulationList> {
    return this.sims.list(auth);
  }

  @Get('prefill')
  @Header('Cache-Control', 'private, no-store')
  prefill(@CurrentAuth() auth: AuthContext): Promise<SimulatorPrefill> {
    return this.sims.prefill(auth);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detail(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<ClientSimulationDetail> {
    return this.sims.detail(auth, id);
  }

  @Patch(':id')
  rename(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: unknown): Promise<ClientSimulationItem> {
    return this.sims.rename(auth, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.sims.remove(auth, id);
  }

  @Get(':id/pdf')
  async pdf(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const file = await this.sims.pdf(auth, id);
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
      .setHeader('Cache-Control', 'private, no-store')
      .send(file.content);
  }

  @Post(':id/profile')
  @HttpCode(200)
  profile(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<{ updated: string[] }> {
    return this.sims.applyToProfile(auth, id);
  }
}
