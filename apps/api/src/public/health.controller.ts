// API-100, ENV-051 — health checks: outside the gate, maintenance and rate limits; never cached.
import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../platform/prisma.service.js';
import { APP_VERSION } from '../version.js';

@Controller('public/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async live(@Res() res: Response): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ok', version: APP_VERSION });
    } catch {
      res.status(503).json({ status: 'unavailable', version: APP_VERSION });
    }
  }

  /** Also checks Redis and storage once they are part of the environment (ENV-051). */
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready(@Res() res: Response): Promise<void> {
    return this.live(res);
  }
}
