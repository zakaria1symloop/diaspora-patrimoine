// SEC-030, ROL-004, ROL-020…ROL-022, SEC-027, BO-005 — everything is refused by default. Every route of the `/admin`,
// `/client` and `/partner` families declares its audience, the kind of account it admits and, for staff, the permission
// it requires; four checks in this order: valid session · right kind and audience · permission of the effective role ·
// right on the object (done in the query by each use case, SEC-031). Writes from a browser carry the anti-forgery token.
//
// How other modules use it:
//   @Controller('admin/x') + @RequirePermission('x.manage') on each handler        → staff of the back office (ADMIN)
//   @ClientAccess() on a controller or handler under /client                      → a signed-in client (WEB)
//   @PartnerAccess() under /partner                                               → a partner account (PARTNER)
//   @RequireRecentPassword() with @RequirePermission                              → BO-005 (403 REAUTH_REQUIRED)
//   handler params: @CurrentAuth() auth: AuthContext · @CurrentActor() actor: Actor
//   public routes: @UseGuards(OptionalClientSession) then @CurrentAuth() → AuthContext | null (never fails)
import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, isPermission, roleHasPermission, type BrowserAudience, type StaffRole } from '@dp/contracts';
import type { Request } from 'express';
import type { Actor } from '../admin/actor.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { SettingsService } from '../platform/settings.service.js';
import { SessionsService, type AuthContext } from './sessions.service.js';

export const ACCESS_KEY = 'dp:access';
export const PERMISSION_KEY = 'dp:permission';
export const REAUTH_KEY = 'dp:reauth';
/** BO-005 — the password typed less than 15 minutes ago. */
export const REAUTH_WINDOW_MS = 15 * 60_000;

export interface AccessRule {
  audience: BrowserAudience;
  kind: 'CLIENT' | 'STAFF' | 'PARTNER';
}

/** ROL-020 — the permission a staff route requires (also declares the route as a back-office route). */
export const RequirePermission = (permission: string) =>
  applyDecorators(SetMetadata(PERMISSION_KEY, permission), SetMetadata(ACCESS_KEY, { audience: 'ADMIN', kind: 'STAFF' } satisfies AccessRule));
/** A back-office route open to every staff role (the account's own preferences, BO-070). */
export const StaffAccess = () => SetMetadata(ACCESS_KEY, { audience: 'ADMIN', kind: 'STAFF' } satisfies AccessRule);
export const ClientAccess = () => SetMetadata(ACCESS_KEY, { audience: 'WEB', kind: 'CLIENT' } satisfies AccessRule);
export const PartnerAccess = () => SetMetadata(ACCESS_KEY, { audience: 'PARTNER', kind: 'PARTNER' } satisfies AccessRule);
export const RequireRecentPassword = () => SetMetadata(REAUTH_KEY, true);

type Family = 'admin' | 'client' | 'partner' | 'other';
export function familyOf(path: string): Family {
  const p = path.replace(/^\/api\/v1/, '');
  if (p === '/admin' || p.startsWith('/admin/')) return 'admin';
  if (p === '/client' || p.startsWith('/client/')) return 'client';
  if (p === '/partner' || p.startsWith('/partner/')) return 'partner';
  return 'other';
}

const FAMILY_RULE: Record<Exclude<Family, 'other'>, AccessRule> = {
  admin: { audience: 'ADMIN', kind: 'STAFF' },
  client: { audience: 'WEB', kind: 'CLIENT' },
  partner: { audience: 'PARTNER', kind: 'PARTNER' },
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

type AuthedRequest = Request & { auth?: AuthContext | null };

/** Global guard (APP_GUARD). */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const family = familyOf(req.path ?? req.originalUrl ?? '');
    const declared = this.reflector.getAllAndOverride<AccessRule | undefined>(ACCESS_KEY, [context.getHandler(), context.getClass()]);
    if (family === 'other' && !declared) return true;
    // SEC-030 — a route of a protected family without declaration is refused.
    if (!declared) throw new AppError(ErrorCode.FORBIDDEN);
    if (family !== 'other' && (declared.audience !== FAMILY_RULE[family].audience || declared.kind !== FAMILY_RULE[family].kind)) {
      throw new AppError(ErrorCode.FORBIDDEN);
    }

    const ctx = req.auth?.audience === declared.audience ? req.auth : await this.sessions.authenticate(req, declared.audience);
    if (!ctx) throw new AppError(ErrorCode.UNAUTHENTICATED);
    // ROL-004 — a session of another kind is refused (403).
    if (ctx.kind !== declared.kind) throw new AppError(ErrorCode.FORBIDDEN);
    if (!SAFE_METHODS.has(req.method) && !this.sessions.csrfValid(req, ctx)) throw new AppError(ErrorCode.FORBIDDEN);
    // ROL-017 — a preview session (« Voir comme le client ») writes nothing, and marks nothing read or seen
    if (ctx.preview && !SAFE_METHODS.has(req.method)) throw new AppError(ErrorCode.FORBIDDEN, { reason: 'PREVIEW_READ_ONLY' });

    if (declared.kind === 'STAFF') {
      const permission = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
      if (permission) {
        if (!isPermission(permission)) throw new AppError(ErrorCode.FORBIDDEN);
        const all = await this.settings.all();
        const ok = roleHasPermission(ctx.role as StaffRole, permission, (key) => (all as unknown as Record<string, unknown>)[key] === true);
        if (!ok) throw new AppError(ErrorCode.FORBIDDEN);
      }
      const reauth = this.reflector.getAllAndOverride<boolean | undefined>(REAUTH_KEY, [context.getHandler(), context.getClass()]);
      if (reauth) {
        const at = ctx.passwordConfirmedAt?.getTime() ?? 0;
        if (this.clock.now().getTime() - at > REAUTH_WINDOW_MS) throw new AppError(ErrorCode.FORBIDDEN, { reason: 'REAUTH_REQUIRED' });
      }
    }
    req.auth = ctx;
    return true;
  }
}

/**
 * The staff guard named by the back-office controllers (`@UseGuards(StaffGuard)`): the global guard already decided;
 * this one only makes sure a staff context is present, so that a controller moved out of `/admin` stays protected.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly access: AccessGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.auth?.kind === 'STAFF') return true;
    return this.access.canActivate(context);
  }
}

/** For public routes (`/public/*`): reads a client session when there is one, never fails without it. */
@Injectable()
export class OptionalClientSession implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.auth === undefined) {
      try {
        const ctx = await this.sessions.authenticate(req, 'WEB');
        // ROL-017 — a preview session never acts on a public form in the client's name
        req.auth = ctx && ctx.kind === 'CLIENT' && !(ctx.preview && !SAFE_METHODS.has(req.method)) ? ctx : null;
      } catch {
        req.auth = null;
      }
    }
    return true;
  }
}

/** The caller of a guarded route (or null on a public route behind `OptionalClientSession`). */
export const CurrentAuth = createParamDecorator((_: unknown, context: ExecutionContext): AuthContext | null => {
  return context.switchToHttp().getRequest<AuthedRequest>().auth ?? null;
});

/** SEC-080 — the actor of a back-office use case: the staff member of the session, with his effective role. */
export const CurrentActor = createParamDecorator((_: unknown, context: ExecutionContext): Actor => {
  const auth = context.switchToHttp().getRequest<AuthedRequest>().auth;
  if (!auth) throw new AppError(ErrorCode.UNAUTHENTICATED);
  return auth.actor;
});
