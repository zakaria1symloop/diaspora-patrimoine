// Package 3.3 — API-100: `GET /admin/clients/{id}/simulations` (`simulation.read`), `GET …/simulations/prefill`,
// `POST /admin/simulations/compute`, `POST /admin/simulations`, `POST /admin/simulations/{id}/attach`, `…/detach`
// (`simulation.create`; CRM-046).
import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BackOfficeModule } from '../back-office/back-office.module.js';
import { idempotentCreate } from '../catalogue-admin/admin-idempotency.js';
import { CurrentAuth, RequirePermission } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { IdempotencyService } from '../platform/idempotency.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SimulationsModule } from '../simulations/simulations.module.js';
import { SimulationsAdminService } from './simulations-admin.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin')
export class SimulationsAdminController {
  constructor(
    private readonly sims: SimulationsAdminService,
    private readonly idempotency: IdempotencyService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('clients/:id/simulations') @RequirePermission('simulation.read')
  list(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.sims.list(auth, id); }
  @Get('clients/:id/simulations/prefill') @RequirePermission('simulation.create')
  prefill(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string) { return this.sims.prefill(auth, id); }
  @Post('simulations/compute') @HttpCode(200) @RequirePermission('simulation.create')
  compute(@CurrentAuth() auth: AuthContext, @Body() body: unknown) { return this.sims.compute(auth, body); }
  /** CRM-046, TRV-091 — « Enregistrer » sends its `Idempotency-Key`: a double click saves once. */
  @Post('simulations') @RequirePermission('simulation.create')
  create(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return idempotentCreate(this.idempotency, this.prisma, req, 'admin.simulations', auth.userId, () => this.sims.create(auth, body));
  }
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
