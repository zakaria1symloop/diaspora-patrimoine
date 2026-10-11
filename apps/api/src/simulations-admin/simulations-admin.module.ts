// Package 3.3 — API-100: `GET /admin/clients/{id}/simulations` (`simulation.read`), `GET …/simulations/prefill`,
// `POST /admin/simulations/compute`, `POST /admin/simulations`, `POST /admin/simulations/{id}/attach`, `…/detach`
// (`simulation.create`; CRM-046).
import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { SimulationsModule } from '../simulations/simulations.module.js';
import { SimulationsAdminService } from './simulations-admin.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin')
export class SimulationsAdminController {
  constructor(private readonly sims: SimulationsAdminService) {}

  @Get('clients/:id/simulations') @RequirePermission('simulation.read')
  list(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.sims.list(auth, id); }
  @Get('clients/:id/simulations/prefill') @RequirePermission('simulation.create')
  prefill(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.sims.prefill(auth, id); }
  @Post('simulations/compute') @HttpCode(200) @RequirePermission('simulation.create')
  compute(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.sims.compute(auth, body); }
  @Post('simulations') @RequirePermission('simulation.create')
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.sims.create(auth, body); }
  @Post('simulations/:id/attach') @HttpCode(200) @RequirePermission('simulation.create')
  attach(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Body() body: unknown) { return this.sims.attach(auth, id, body); }
  @Post('simulations/:id/detach') @HttpCode(200) @RequirePermission('simulation.create')
  detach(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.sims.detach(auth, id); }
}

@Module({
  imports: [BackOfficeModule, SimulationsModule],
  controllers: [SimulationsAdminController],
  providers: [SimulationsAdminService],
})
export class SimulationsAdminModule {}
