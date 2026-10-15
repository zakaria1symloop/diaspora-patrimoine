// API-100 `/admin` catalogue routes (programs, properties, lots, promoters, banks). API-051: one action route per
// transition, the response is the object up to date. Every route requires a staff session holding the
// permission it declares (SEC-030, ROL-020); the actor of each action is the staff member of the session (SEC-080).
import { Body, Controller, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IdempotencyService } from '../platform/idempotency.js';
import { Clock } from '../platform/clock.js';
import { ENV, type Env } from '../config/env.js';
import { signPreview } from '../catalogue/preview-token.js';
import { PrismaService } from '../platform/prisma.service.js';
import { idempotentCreate } from './admin-idempotency.js';
import type { Actor } from '../admin/actor.js';
import { CurrentActor, CurrentAuth, RequirePermission, StaffGuard } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { ErrorCode } from '@dp/contracts';
import { AppError } from '../platform/errors.js';
import { StaffViews } from '../back-office/staff-view.js';
import { LotsAdminService } from './lots-admin.service.js';
import { PartnersAdminService } from './partners-admin.service.js';
import { ProgramsAdminService } from './programs-admin.service.js';
import { PropertiesAdminService } from './properties-admin.service.js';

const uuid = new ParseUUIDPipe();

@Controller('admin')
@UseGuards(StaffGuard)
export class CatalogueAdminController {
  constructor(
    private readonly partners: PartnersAdminService,
    private readonly programs: ProgramsAdminService,
    private readonly properties: PropertiesAdminService,
    private readonly lots: LotsAdminService,
    private readonly idempotency: IdempotencyService,
    private readonly prisma: PrismaService,
    private readonly views: StaffViews,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** TRV-091 — a creating form sends its `Idempotency-Key`: the same key replays the first answer. */
  private once<T>(req: Request, route: string, actor: Actor, run: () => Promise<T>): Promise<T> {
    return idempotentCreate(this.idempotency, this.prisma, req, route, actor.userId, run);
  }

  // Promoters (CTL-002…CTL-004)
  @Post('promoters') @RequirePermission('promoter.write')
  createPromoter(@Req() req: Request, @CurrentActor() actor: Actor, @Body() body: unknown) { return this.once(req, 'admin.promoters', actor, () => this.partners.createPromoter(body as never, actor)); }
  @Patch('promoters/:id') @RequirePermission('promoter.write')
  async updatePromoter(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) {
    // CTL-003 — the convention (dates, commission terms) is changed with `partner.convention.manage` only.
    const keys = body && typeof body === 'object' ? Object.keys(body) : [];
    const convention = (await this.views.of(auth)).has('partner.convention.manage');
    if (keys.some((k) => k === 'conventionSignedAt' || k === 'conventionExpiresAt' || k === 'commissionTerms') && !convention) throw new AppError(ErrorCode.FORBIDDEN);
    const { commissionTerms, ...rest } = await this.partners.updatePromoter(id, body as never, actor);
    return convention ? { ...rest, commissionTerms } : rest;
  }
  @Post('promoters/:id/activate') @HttpCode(200) @RequirePermission('promoter.write')
  activatePromoter(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.partners.activatePromoter(id, (body ?? {}) as never, actor); }

  // Banks (minimal)
  @Post('banks') @RequirePermission('bank.write')
  createBank(@CurrentActor() actor: Actor, @Body() body: unknown) { return this.partners.createBank(body as never, actor); }
  @Patch('banks/:id') @RequirePermission('bank.write')
  updateBank(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.partners.updateBank(id, body as never, actor); }
  @Post('banks/:id/activate') @HttpCode(200) @RequirePermission('bank.write')
  activateBank(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.partners.activateBank(id, actor); }

  // Programmes (CTL-022…CTL-024)
  @Post('programs') @RequirePermission('catalogue.write')
  createProgram(@Req() req: Request, @CurrentActor() actor: Actor, @Body() body: unknown) { return this.once(req, 'admin.programs', actor, () => this.programs.create(body as never, actor)); }
  @Patch('programs/:id') @RequirePermission('catalogue.write')
  updateProgram(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.programs.update(id, body as never, actor); }
  @Post('programs/:id/publish') @HttpCode(200) @RequirePermission('catalogue.publish')
  publishProgram(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: { republishProperties?: boolean } = {}) { return this.programs.publish(id, actor, { republishProperties: body?.republishProperties === true }); }
  @Post('programs/:id/unpublish') @HttpCode(200) @RequirePermission('catalogue.publish')
  unpublishProgram(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.programs.unpublish(id, actor); }
  /** FIC-120 — « Aperçu »: the public page of a programme that is not online, by a link signed for one hour. */
  @Post('programs/:id/preview-link') @HttpCode(200) @RequirePermission('catalogue.read')
  async programPreview(@Param('id', uuid) id: string) {
    const p = await this.prisma.program.findFirst({ where: { id, deletedAt: null }, select: { id: true, slug: true } });
    if (!p) throw AppError.notFound();
    const { token, expiresAt } = signPreview(this.env.LINK_SIGNING_KEY, 'PROGRAM', p.id, this.clock.now());
    return { url: `${this.env.WEB_URL}/programmes/${p.slug}?apercu=${token}`, expiresAt: expiresAt.toISOString() };
  }
  /** FIC-120 — « Aperçu » of a property. */
  @Post('properties/:id/preview-link') @HttpCode(200) @RequirePermission('catalogue.read')
  async propertyPreview(@Param('id', uuid) id: string) {
    const p = await this.prisma.property.findFirst({ where: { id, deletedAt: null }, select: { id: true, slug: true } });
    if (!p) throw AppError.notFound();
    const { token, expiresAt } = signPreview(this.env.LINK_SIGNING_KEY, 'PROPERTY', p.id, this.clock.now());
    return { url: `${this.env.WEB_URL}/biens/${p.slug}?apercu=${token}`, expiresAt: expiresAt.toISOString() };
  }
  /** TRV-052 — « Régénérer l'adresse »: the old one answers 301 (NAV-040). */
  @Post('programs/:id/regenerate-slug') @HttpCode(200) @RequirePermission('catalogue.write')
  regenerateProgramSlug(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.programs.regenerateSlug(id, actor); }
  @Post('programs/:id/archive') @HttpCode(200) @RequirePermission('catalogue.publish')
  archiveProgram(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.programs.archive(id, actor); }
  @Post('programs/:id/unarchive') @HttpCode(200) @RequirePermission('catalogue.publish')
  unarchiveProgram(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: { unarchiveProperties?: boolean } = {}) { return this.programs.unarchive(id, actor, { unarchiveProperties: body?.unarchiveProperties === true }); }

  // Properties (CTL-041…CTL-044, CTL-150)
  @Post('properties') @RequirePermission('catalogue.write')
  createProperty(@Req() req: Request, @CurrentActor() actor: Actor, @Body() body: unknown) { return this.once(req, 'admin.properties', actor, () => this.properties.create(body as never, actor)); }
  @Patch('properties/:id') @RequirePermission('catalogue.write')
  updateProperty(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.properties.update(id, body as never, actor); }
  @Post('properties/:id/publish') @HttpCode(200) @RequirePermission('catalogue.publish')
  publishProperty(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.properties.publish(id, actor); }
  @Post('properties/:id/unpublish') @HttpCode(200) @RequirePermission('catalogue.publish')
  unpublishProperty(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.properties.unpublish(id, actor); }
  /** TRV-052 — « Régénérer l'adresse » of a property. */
  @Post('properties/:id/regenerate-slug') @HttpCode(200) @RequirePermission('catalogue.write')
  regeneratePropertySlug(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.properties.regenerateSlug(id, actor); }
  @Post('properties/:id/archive') @HttpCode(200) @RequirePermission('catalogue.publish')
  archiveProperty(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.properties.archive(id, actor); }
  @Post('properties/:id/unarchive') @HttpCode(200) @RequirePermission('catalogue.publish')
  unarchiveProperty(@CurrentActor() actor: Actor, @Param('id', uuid) id: string) { return this.properties.unarchive(id, actor); }
  @Post('properties/:id/feature') @HttpCode(200) @RequirePermission('catalogue.publish')
  featureProperty(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.properties.feature(id, body as never, actor); }

  // Lots (CTL-060…CTL-062, CYC-100)
  @Post('properties/:id/lots') @RequirePermission('catalogue.write')
  createLot(@Req() req: Request, @CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.once(req, `admin.lots:${id}`, actor, () => this.lots.create(id, body as never, actor)); }
  @Patch('lots/:id') @RequirePermission('catalogue.write')
  updateLot(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.lots.update(id, body as never, actor); }
  @Post('lots/:id/change-status') @HttpCode(200) @RequirePermission('catalogue.write')
  changeLotStatus(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: unknown) { return this.lots.changeStatus(id, body as never, actor); }
  @Post('lots/:id/correct-sale') @HttpCode(200) @RequirePermission('catalogue.publish')
  correctSale(@CurrentActor() actor: Actor, @Param('id', uuid) id: string, @Body() body: { note?: string; version?: number }) {
    return this.lots.changeStatus(id, { status: 'AVAILABLE', note: body?.note ?? '', version: body?.version }, actor);
  }
}
