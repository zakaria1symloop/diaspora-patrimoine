// MED-030, MED-031 — reading a PRIVATE file: never a public or lasting address. A route of the owning module checks the
// session, the right on the object and writes the trace; it then hands out a signed address valid 5 minutes, for that
// reading only. The signature fixes the kind of file and its id (resolved here to the storage key, the name and the
// type) and the disposition — the address carries identifiers only, never a file name (no personal data in URLs or
// logs). `inline` accepts several `Range` requests during its 5 minutes (a PDF viewer needs them for pages and zoom).
//
// Each module registers a resolver for its kind (`doc` for the pieces of a dossier) through `PrivateFileResolvers`.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Inject, Injectable, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { AppError } from '../platform/errors.js';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.js';

/** MED-030 — 5 minutes. */
export const PRIVATE_LINK_TTL_MS = 5 * 60_000;

export type Disposition = 'inline' | 'attachment';

export interface ResolvedPrivateFile {
  storageKey: string;
  fileName: string;
  mimeType: string;
}

/** Returns the file to serve, or null when it is gone, unreadable (scan not CLEAN) or deleted. */
export type PrivateFileResolver = (id: string) => Promise<ResolvedPrivateFile | null>;

@Injectable()
export class PrivateFileResolvers {
  private readonly map = new Map<string, PrivateFileResolver>();
  register(kind: string, resolver: PrivateFileResolver): void {
    this.map.set(kind, resolver);
  }
  get(kind: string): PrivateFileResolver | undefined {
    return this.map.get(kind);
  }
}

const KIND = /^[a-z]{2,12}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^([a-z]{2,12})\.([0-9a-f-]{36})\.([ia])\.([0-9a-z]{1,12})\.([A-Za-z0-9_-]{43})$/;

function mac(key: string, body: string): string {
  return createHmac('sha256', key).update(`dp_private_file:${body}`).digest('base64url');
}

/** `{kind}.{id}.{i|a}.{expiry base36}.{mac}` — identifiers only. */
export function signPrivateFile(key: string, kind: string, id: string, disposition: Disposition, now: Date): { token: string; expiresAt: Date } {
  if (!KIND.test(kind) || !UUID.test(id)) throw new Error('invalid private file reference');
  const expiresAt = new Date(now.getTime() + PRIVATE_LINK_TTL_MS);
  const body = `${kind}.${id}.${disposition === 'inline' ? 'i' : 'a'}.${Math.floor(expiresAt.getTime() / 1000).toString(36)}`;
  return { token: `${body}.${mac(key, body)}`, expiresAt };
}

export function verifyPrivateFile(key: string, token: string, now: Date): { kind: string; id: string; disposition: Disposition } | null {
  const m = TOKEN.exec(token);
  if (!m) return null;
  const body = token.slice(0, token.lastIndexOf('.'));
  const expected = mac(key, body);
  if (expected.length !== m[5]!.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(m[5]!))) return null;
  if (parseInt(m[4]!, 36) * 1000 <= now.getTime()) return null;
  return { kind: m[1]!, id: m[2]!, disposition: m[3] === 'i' ? 'inline' : 'attachment' };
}

export const privateFilePath = (token: string) => `/api/v1/files/private/${token}`;

/** RFC 6266 — an ASCII fallback and the UTF-8 name. */
export function contentDisposition(disposition: Disposition, fileName: string): string {
  const ascii = fileName.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '').trim() || 'document';
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Only types that are safe to display; anything else is downloaded as bytes. */
const SAFE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

/** `bytes=start-end` → a range inside `size`, or null (whole file), or 'invalid' (416). */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return null;
  let start: number;
  let end: number;
  if (!m[1]) {
    const suffix = Number(m[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

/**
 * `GET /files/private/{token}` — outside the protected families: the signed token IS the authorisation (MED-030);
 * an expired or forged token is 410. Never cached anywhere (`no-store`), never indexed, never sniffed.
 */
@Controller('files/private')
export class PrivateFilesController {
  constructor(
    private readonly resolvers: PrivateFileResolvers,
    private readonly clock: Clock,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get(':token')
  async serve(@Param('token') token: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const check = verifyPrivateFile(this.env.LINK_SIGNING_KEY, token.slice(0, 200), this.clock.now());
    if (!check) throw new AppError('GONE', { reason: 'LINK_EXPIRED' });
    const resolver = this.resolvers.get(check.kind);
    const file = resolver ? await resolver(check.id) : null;
    if (!file) throw new AppError('GONE', { reason: 'LINK_EXPIRED' });
    const body = await this.storage.get('private', file.storageKey);
    if (!body) throw new AppError('GONE', { reason: 'LINK_EXPIRED' });
    const type = SAFE_TYPES.has(file.mimeType) ? file.mimeType : 'application/octet-stream';
    const disposition: Disposition = type === 'application/octet-stream' ? 'attachment' : check.disposition;
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', contentDisposition(disposition, file.fileName));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Accept-Ranges', 'bytes');
    const range = disposition === 'inline' ? parseRange(req.headers.range, body.length) : null;
    if (range === 'invalid') {
      res.status(416).setHeader('Content-Range', `bytes */${body.length}`).end();
      return;
    }
    if (range) {
      res.status(206).setHeader('Content-Range', `bytes ${range.start}-${range.end}/${body.length}`);
      res.setHeader('Content-Length', String(range.end - range.start + 1));
      res.end(body.subarray(range.start, range.end + 1));
      return;
    }
    res.status(200).setHeader('Content-Length', String(body.length));
    res.end(body);
  }
}
