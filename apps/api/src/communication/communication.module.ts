// ARC-060 — e-mail sending. `MAIL_PROVIDER`: `log` (default in local), `smtp`, `memory`.
import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ENV, type Env } from '../config/env.js';
import { log } from '../platform/request-context.js';
import { LogMailProvider, MAIL_PROVIDER, MemoryMailProvider, SmtpMailProvider, repoRoot, type MailProvider } from './mail-provider.js';
import { MailerService } from './mailer.service.js';

export function mailProviderFor(env: Env): MailProvider {
  const kind = env.MAIL_PROVIDER ?? (env.APP_ENV === 'local' ? 'log' : 'smtp');
  if (kind === 'memory') return new MemoryMailProvider();
  if (kind === 'smtp') return new SmtpMailProvider();
  const dir = env.MAIL_LOG_DIR ?? join(repoRoot(), '.local', 'mail');
  return new LogMailProvider(dir, ({ templateCode, file }) => log('info', 'mail.logged', { template: templateCode, file: file.split(/[\\/]/).pop() }));
}

@Module({
  providers: [{ provide: MAIL_PROVIDER, inject: [ENV], useFactory: (env: Env) => mailProviderFor(env) }, MailerService],
  exports: [MailerService, MAIL_PROVIDER],
})
export class CommunicationModule {}
