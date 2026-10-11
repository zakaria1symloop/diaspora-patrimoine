// ADM-040, PAR-080, ROL-010 — operations commands for the Direction accounts. No account with a known password ever
// exists: every access starts with an invitation link sent by e-mail (local: a .eml file in .local/mail). The command
// prints its result without any secret (neither link nor token).
//
//   pnpm ops owner:invite --email <adresse> --first-name <prénom> --last-name <nom>
//        first Direction account, only while none exists (afterwards, invite from the Team screen, EA-96)
//   pnpm ops owner:resend-invitation --email <adresse>
//        a new invitation for a Direction account still « Invité » (the previous link dies, MOD-105)
//   pnpm ops owner:recover --email <adresse> [--new-email <adresse>] --request <référence de la demande écrite>
//        the only Direction account lost its access: password and second factor reset, sessions closed, new invitation;
//        audit `user.recovered` (reason = the request reference); every Direction and Administrator address is told.
//   pnpm ops setting:get --key <clé>
//   pnpm ops setting:set --key <clé> --value <valeur JSON> --reason <motif>
//        PAR-001 — read or change one setting (validated against its declaration; audit `setting.updated`), e.g.
//        `features.assistant.mode` "AI" once the provider of ASS-052 is configured, until the settings screen (EA-90).
//        The API sees the change within a minute (PAR-101).
import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { settingsRegistry, type SettingKey } from '@dp/contracts';
import { createTranslator } from '@dp/i18n';
import { mailProviderFor } from '../communication/communication.module.js';
import { MailerService } from '../communication/mailer.service.js';
import { loadEnv } from '../config/env.js';
import { AuthMailHandler, type AuthMailRequest } from '../identity/auth-mail.js';
import { TokensService } from '../identity/tokens.service.js';
import { Clock } from '../platform/clock.js';
import { newId } from '../platform/ids.js';
import { OutboxHandlers } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { teamChangeMailKey, teamChangeTexts } from '../back-office/team-events.handler.js';
import { createInvitedOwner, invitationRequest, normaliseOwner, ownerExists } from './owner.js';

const t = createTranslator('fr');

function args(argv: string[]): { command: string; flags: Record<string, string> } {
  const [command = '', ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else flags[a.slice(2)] = rest[++i] ?? '';
    }
  }
  return { command, flags };
}

async function main(): Promise<void> {
  const { command, flags } = args(process.argv.slice(2));
  const env = loadEnv();
  const prisma = new PrismaService(env);
  const clock = new Clock(env);
  const settings = new SettingsService(prisma, clock);
  const mailer = new MailerService(prisma, clock, settings, env, mailProviderFor(env));
  const tokens = new TokensService(prisma, clock, env);
  const mail = new AuthMailHandler(prisma, mailer, tokens, settings, new OutboxHandlers(), env);
  const roleLabel = t('ui.enum.MembershipRole.OWNER');
  const send = async (req: AuthMailRequest) => mail.send({ ...req, dedupeKey: `${req.template}:ops:${newId()}:${req.to}` }, newId());

  try {
    if (command === 'owner:invite') {
      const owner = normaliseOwner({ email: flags.email, firstName: flags['first-name'], lastName: flags['last-name'] });
      const now = clock.now();
      const userId = await prisma.$transaction(async (tx) => {
        if (await ownerExists(tx)) throw new Error('Un compte Direction existe déjà : invitez depuis l’écran Équipe, ou utilisez owner:resend-invitation / owner:recover.');
        return createInvitedOwner(tx, owner, now, 'ops:owner:invite');
      });
      const outcome = await send(invitationRequest(userId, owner.email, roleLabel));
      process.stdout.write(`Compte Direction invité (${owner.email}). Invitation : ${outcome}.\n`);
      return;
    }

    if (command === 'owner:resend-invitation') {
      const email = normaliseOwner({ email: flags.email, firstName: 'x', lastName: 'x' }).email;
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, kind: true, status: true, membershipsAsUser: { where: { revokedAt: null }, select: { role: true } } } });
      if (!user || user.kind !== 'STAFF' || user.status !== 'INVITED' || !user.membershipsAsUser.some((m) => m.role === 'OWNER')) {
        throw new Error('Aucun compte Direction « Invité » à cette adresse.');
      }
      await prisma.auditLog.create({ data: { id: newId(), actorType: 'SYSTEM', action: 'user.invited', entityType: 'User', entityId: user.id, reason: 'ops:owner:resend-invitation', createdAt: clock.now() } });
      const outcome = await send(invitationRequest(user.id, email, roleLabel));
      process.stdout.write(`Nouvelle invitation envoyée à ${email} : ${outcome}. L’ancien lien ne sert plus.\n`);
      return;
    }

    if (command === 'owner:recover') {
      const email = normaliseOwner({ email: flags.email, firstName: 'x', lastName: 'x' }).email;
      const newEmail = flags['new-email'] ? normaliseOwner({ email: flags['new-email'], firstName: 'x', lastName: 'x' }).email : null;
      const request = (flags.request ?? '').trim();
      if (!request) throw new Error('--request <référence de la demande écrite> est obligatoire.');
      const now = clock.now();
      const target = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { email }, select: { id: true, kind: true, status: true, firstName: true, lastName: true, membershipsAsUser: { where: { revokedAt: null }, select: { role: true } } } });
        if (!user || user.kind !== 'STAFF' || user.status === 'DELETED' || !user.membershipsAsUser.some((m) => m.role === 'OWNER')) throw new Error('Aucun compte Direction à cette adresse.');
        if (newEmail && newEmail !== email && (await tx.user.findUnique({ where: { email: newEmail }, select: { id: true } }))) throw new Error('La nouvelle adresse est déjà utilisée par un compte.');
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: newEmail ?? email,
            pendingEmail: null,
            passwordHash: null,
            twoFactorEnabled: false,
            twoFactorSecret: null,
            twoFactorPendingSecret: null,
            failedLoginCount: 0,
            lockedUntil: null,
            status: 'INVITED',
            updatedAt: now,
          },
        });
        await tx.$executeRawUnsafe(`UPDATE users SET two_factor_recovery_hashes = NULL WHERE id = $1::uuid`, user.id);
        await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now, revokedReason: 'ADMIN', updatedAt: now } });
        await tx.authToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { expiresAt: now, updatedAt: now } });
        await tx.auditLog.create({ data: { id: newId(), actorType: 'SYSTEM', action: 'user.recovered', entityType: 'User', entityId: user.id, reason: request.slice(0, 500), createdAt: now } });
        const eventId = newId();
        await tx.outboxEvent.create({ data: { id: eventId, type: 'user.recovered', aggregateType: 'User', aggregateId: user.id, payload: { role: 'OWNER' } as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now } });
        return { id: user.id, email: newEmail ?? email, eventId, name: [user.firstName, user.lastName].filter(Boolean).join(' ') };
      });
      const outcome = await send(invitationRequest(target.id, target.email, roleLabel));
      // ROL-012, ADM-040 — every Direction and Administrator address is told (S_TEAM_CHANGE). The e-mail leaves from here,
      // so that it does not wait for the API; it carries the key of the `user.recovered` event, which the API's outbox
      // handler (back-office/team-events.handler.ts) uses too: nobody is told twice. The bell (NS_TEAM_CHANGE) is the handler's.
      const team = await prisma.membership.findMany({
        where: { revokedAt: null, role: { in: ['OWNER', 'ADMIN'] }, organization: { type: 'OPERATOR' }, user: { status: 'ACTIVE', id: { not: target.id } } },
        select: { user: { select: { id: true, email: true } } },
      });
      const texts = teamChangeTexts('recovered', null, target.name || t('ui.common.deletedUser'));
      for (const m of team) {
        await mail.send(
          {
            template: 'S_TEAM_CHANGE',
            userId: m.user.id,
            to: m.user.email,
            dedupeKey: teamChangeMailKey(target.eventId, m.user.email),
            vars: { action: { summary: texts.summary, isSystem: true, at: now.toISOString(), adminUrl: `${env.ADMIN_URL ?? env.WEB_URL}/equipe` }, actor: { fullName: null } },
          },
          target.eventId,
        );
      }
      process.stdout.write(`Compte Direction rétabli (${target.email}) : invitation ${outcome}, ${team.length} adresse(s) prévenue(s).\n`);
      return;
    }

    if (command === 'setting:get' || command === 'setting:set') {
      const key = (flags.key ?? '') as SettingKey;
      const decl = settingsRegistry[key];
      if (!decl) throw new Error(`Paramètre inconnu : ${key || '(vide)'}.`);
      const show = (v: unknown) => JSON.stringify(v); // settings hold no secret (secrets are environment variables, ENV-040)
      if (command === 'setting:get') {
        process.stdout.write(`${key} = ${show(await settings.get(key))}\n`);
        return;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(flags.value ?? '');
      } catch {
        throw new Error(`--value doit être une valeur JSON (une chaîne entre guillemets : '"AI"').`);
      }
      const parsed = decl.schema.safeParse(raw);
      if (!parsed.success) throw new Error(`Valeur refusée pour ${key}.`);
      const reason = (flags.reason ?? '').trim();
      if (!reason) throw new Error('--reason <motif> est obligatoire.');
      const now = clock.now();
      const before = await settings.get(key);
      await prisma.$transaction(async (tx) => {
        await tx.setting.upsert({ where: { key }, create: { key, value: parsed.data as never, createdAt: now, updatedAt: now }, update: { value: parsed.data as never, updatedAt: now } });
        await tx.auditLog.create({ data: { id: newId(), actorType: 'SYSTEM', action: 'setting.changed', entityType: 'Setting', entityLabel: key, before: before as never, after: parsed.data as never, reason: `ops:setting:set — ${reason}`.slice(0, 500), createdAt: now } });
        // AUT-010 `setting.changed` — what depends on a setting (AUT-080 recalculation…) follows, as after the settings screen
        await tx.outboxEvent.create({
          data: { id: newId(), type: 'setting.changed', aggregateType: 'Setting', aggregateId: settingAggregateId(key), payload: { key } as never, occurredAt: now, availableAt: now, createdAt: now, updatedAt: now },
        });
      });
      process.stdout.write(`${key} : ${show(before)} → ${show(parsed.data)} (pris en compte par l’API sous une minute).\n`);
      return;
    }

    process.stderr.write('Commandes : owner:invite --email --first-name --last-name · owner:resend-invitation --email · owner:recover --email [--new-email] --request\n');
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

/** A setting is keyed by its name, but an event's object is a UUID: the same name always gives the same UUID (name-based, RFC 9562 § 5.5). */
function settingAggregateId(key: string): string {
  const h = createHash('sha1').update(`setting:${key}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
