// ARC-060 — `MailProvider`: every external service sits behind an interface. Implementations: `log` (local: one .eml
// file per e-mail under <repo>/.local/mail/), `memory` (automated tests), `smtp` (local Mailpit, ENV-040: not wired yet).
// The transactional provider of Q-030 adds its own implementation here.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

export interface OutgoingMail {
  from: { name: string; address: string };
  replyTo?: string | null;
  to: string;
  /** COM-020 — a second contact of the same partner, in copy (never for a client). */
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  /** Template code, for logs only. */
  templateCode: string;
  headers?: Record<string, string>;
  /** Files joined to the message (CAF-050: the `.ics` and the QR code of a Café registration). */
  attachments?: MailAttachment[];
}

export interface MailAttachment {
  filename: string;
  /** `text/calendar; method=PUBLISH`, `image/png`… */
  contentType: string;
  content: Buffer;
}

export interface MailProvider {
  readonly name: string;
  /** Hands the e-mail over. Throws `MailRejectedError` for a definitive refusal; any other error is transient. */
  send(mail: OutgoingMail): Promise<{ providerMessageId: string }>;
}

/** NOT-010 — the provider REFUSES the message (invalid address, rejected content): FAILED at once, no retry. */
export class MailRejectedError extends Error {}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

const b64 = (s: string) =>
  Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/.{76}/g, '$&\r\n');
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);

/** RFC 5322 message, multipart/alternative (text + HTML), UTF-8 bodies in base64; inside multipart/mixed when files are joined. */
export function toEml(mail: OutgoingMail, messageId: string, date: Date): string {
  const boundary = `dp_${randomBytes(8).toString('hex')}`;
  const files = mail.attachments ?? [];
  const mixed = files.length ? `dp_${randomBytes(8).toString('hex')}` : null;
  const headers = [
    `From: ${encodeHeader(mail.from.name)} <${mail.from.address}>`,
    `To: <${mail.to}>`,
    mail.cc?.length ? `Cc: ${mail.cc.map((a) => `<${a}>`).join(', ')}` : null,
    mail.replyTo ? `Reply-To: <${mail.replyTo}>` : null,
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${date.toUTCString()}`,
    `Message-ID: <${messageId}>`,
    `X-DP-Template: ${mail.templateCode}`,
    ...Object.entries(mail.headers ?? {}).map(([k, v]) => `${k}: ${encodeHeader(v)}`),
    'MIME-Version: 1.0',
    mixed ? `Content-Type: multipart/mixed; boundary="${mixed}"` : `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const alternative = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(mail.text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(mail.html),
    `--${boundary}--`,
  ];
  if (!mixed) return [...headers, '', ...alternative, ''].join('\r\n');
  const parts = files.flatMap((f) => [
    `--${mixed}`,
    `Content-Type: ${f.contentType}; name="${encodeHeader(f.filename)}"`,
    `Content-Disposition: attachment; filename="${encodeHeader(f.filename)}"`,
    'Content-Transfer-Encoding: base64',
    '',
    f.content.toString('base64').replace(/.{76}/g, '$&\r\n'),
  ]);
  return [...headers, '', `--${mixed}`, `Content-Type: multipart/alternative; boundary="${boundary}"`, '', ...alternative, ...parts, `--${mixed}--`, ''].join('\r\n');
}

/** The repository root (folder holding pnpm-workspace.yaml), else the working directory. */
export function repoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

/** Local: writes each e-mail as an .eml file (open it with any mail client). Logs only the template and a hashed recipient. */
export class LogMailProvider implements MailProvider {
  readonly name = 'log';
  constructor(
    private readonly dir: string,
    private readonly onSent: (info: { templateCode: string; file: string }) => void = () => undefined,
  ) {}

  async send(mail: OutgoingMail): Promise<{ providerMessageId: string }> {
    const date = new Date();
    const id = `${date.getTime().toString(36)}.${randomBytes(6).toString('hex')}@log.local`;
    mkdirSync(this.dir, { recursive: true });
    const file = join(this.dir, `${date.toISOString().replace(/[:.]/g, '-')}_${mail.templateCode}_${id.split('@')[0]}.eml`);
    writeFileSync(file, toEml(mail, id, date), 'utf8');
    this.onSent({ templateCode: mail.templateCode, file });
    return { providerMessageId: id };
  }
}

/** Automated tests (ARC-060). */
export class MemoryMailProvider implements MailProvider {
  readonly name = 'memory';
  readonly sent: (OutgoingMail & { providerMessageId: string })[] = [];
  failNext: 'transient' | 'rejected' | null = null;

  async send(mail: OutgoingMail): Promise<{ providerMessageId: string }> {
    if (this.failNext) {
      const kind = this.failNext;
      this.failNext = null;
      if (kind === 'rejected') throw new MailRejectedError('rejected');
      throw new Error('provider unavailable');
    }
    const providerMessageId = `mem-${this.sent.length + 1}`;
    this.sent.push({ ...mail, providerMessageId });
    return { providerMessageId };
  }
}

/** ENV-040 `MAIL_PROVIDER=smtp` (Mailpit). TODO(work package 2.x): SMTP transport; until then every send is transient. */
export class SmtpMailProvider implements MailProvider {
  readonly name = 'smtp';
  async send(): Promise<{ providerMessageId: string }> {
    throw new Error('SMTP mail provider not configured');
  }
}
