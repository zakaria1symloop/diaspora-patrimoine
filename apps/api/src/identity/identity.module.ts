// Package 1.6 « Identité » + 2.10 « Compte client » + A.14 « Inscription des partenaires ». Global: the access guard,
// the session reader and the decorators serve every module (see access.ts for how to use them).
import { Global, Inject, type MiddlewareConsumer, Module, type NestModule, type OnApplicationBootstrap, RequestMethod } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { raw } from 'express';
import { CommunicationModule } from '../communication/communication.module.js';
import { ENV, type Env } from '../config/env.js';
import { FilesModule } from '../files/files.module.js';
import { log } from '../platform/request-context.js';
import { ACCESS_KEY, AccessGuard, OptionalClientSession, StaffGuard } from './access.js';
import { ClientAccountController, ClientFavoritesMergeController, PartnerController, StaffAccountController } from './account.controllers.js';
import { AccountService } from './account.service.js';
import { AuthFlowService } from './auth-flow.service.js';
import { AuthMailHandler, AuthMailRequester } from './auth-mail.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { IdentityJobs } from './identity-jobs.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { MailLimits } from './mail-limits.js';
import { PartnerService } from './partner.service.js';
import { SessionsService } from './sessions.service.js';
import { SignupService } from './signup.service.js';
import { StaffSetupService } from './staff-setup.service.js';
import { TokensService } from './tokens.service.js';
import { TwoFactorService } from './two-factor.service.js';

@Global()
@Module({
  imports: [CommunicationModule, FilesModule, DiscoveryModule],
  controllers: [AuthController, ClientAccountController, ClientFavoritesMergeController, StaffAccountController, PartnerController],
  providers: [
    TokensService,
    SessionsService,
    AuthMailRequester,
    AuthMailHandler,
    LoginAttemptsService,
    MailLimits,
    TwoFactorService,
    AuthFlowService,
    AuthService,
    SignupService,
    AccountService,
    StaffSetupService,
    PartnerService,
    IdentityJobs,
    AccessGuard,
    StaffGuard,
    OptionalClientSession,
    { provide: APP_GUARD, useExisting: AccessGuard },
  ],
  exports: [SessionsService, AccessGuard, StaffGuard, OptionalClientSession, TokensService, AuthMailRequester, SignupService, AuthService, TwoFactorService],
})
export class IdentityModule implements NestModule, OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    // API-080 step 2 (local stand-in of the direct send to the storage): the bytes of one file, 11 MB at most.
    consumer.apply(raw({ type: () => true, limit: '11mb' })).forRoutes({ path: 'partner/application/uploads/:id/content', method: RequestMethod.PUT });
  }

  /** SEC-030 — a route of `/admin`, `/client` or `/partner` without declaration does not start. */
  onApplicationBootstrap(): void {
    const undeclared: string[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const type = wrapper.metatype as (new (...a: unknown[]) => unknown) | undefined;
      if (!type || !wrapper.instance) continue;
      const base = String(Reflect.getMetadata('path', type) ?? '').replace(/^\/+/, '');
      if (!/^(admin|client|partner)(\/|$)/.test(base)) continue;
      const proto = Object.getPrototypeOf(wrapper.instance) as Record<string, unknown>;
      for (const name of this.scanner.getAllMethodNames(proto)) {
        const handler = proto[name] as (...a: unknown[]) => unknown;
        if (Reflect.getMetadata('path', handler) === undefined) continue;
        const declared = this.reflector.getAllAndOverride(ACCESS_KEY, [handler, type]);
        if (!declared) undeclared.push(`${type.name}.${name}`);
      }
    }
    if (undeclared.length) {
      const message = `Routes without access declaration (SEC-030): ${undeclared.join(', ')}`;
      if (this.env.APP_ENV !== 'local') throw new Error(message);
      log('error', 'access.undeclared_routes', { routes: undeclared }); // local: they answer 403 (deny by default)
    }
  }
}
