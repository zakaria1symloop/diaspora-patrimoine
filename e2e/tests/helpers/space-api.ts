// Calls to the API as the signed-in browser (same cookies), with the anti-forgery header on writes (SEC-027), and the
// demonstration command of plan 2.9 (`--dossier-pour`), which gives an account a dossier with its piece list.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIResponse, Page } from '@playwright/test';

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'apps', 'api');

export async function api(page: Page, method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<APIResponse> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name.endsWith('dp_web_csrf'))?.value ?? '';
  return page.request.fetch(`/api/v1${path}`, {
    method,
    data: body === undefined ? undefined : body,
    headers: { 'X-CSRF-Token': decodeURIComponent(csrf), ...extra },
  });
}

export const idem = () => ({ 'Idempotency-Key': randomUUID() });
export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** `pnpm --filter @dp/api demo -- --dossier-pour=…` — returns the reference of the account's demonstration dossier. */
export function demoDossierFor(email: string): void {
  execFileSync(process.execPath, ['--env-file=.env', 'dist/install/demo.js', `--dossier-pour=${email}`], { cwd: API_DIR, stdio: 'pipe', timeout: 120_000 });
}

/** A minimal readable PDF of one page. */
export function tinyPdf(text = 'Document'): Buffer {
  const objs = [
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<<>>>>endobj',
    `4 0 obj<</Length ${text.length + 20}>>stream\nBT /F1 12 Tf (${text}) Tj ET\nendstream endobj`,
  ];
  return Buffer.from(`%PDF-1.4\n${objs.join('\n')}\ntrailer<</Root 1 0 R>>\n%%EOF\n`, 'latin1');
}

/** A real PNG of `w`×`h` pixels (one colour), encoded here: filter 0 rows, zlib, CRC-32. */
export function tinyPng(w = 64, h = 48, rgb: [number, number, number] = [200, 40, 40]): Buffer {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** API-080: announce, send, confirm one file; returns the upload id. */
export async function uploadFile(page: Page, reference: string, documentId: string, body: Buffer, fileName: string, contentType: string): Promise<string> {
  const announce = await api(page, 'POST', `/client/dossiers/${reference}/documents/${documentId}/uploads`, { files: [{ fileName, contentType, size: body.length, sha256: sha256(body) }] });
  if (!announce.ok()) throw new Error(`announce ${announce.status()} ${await announce.text()}`);
  const { uploads } = (await announce.json()) as { uploads: { id: string; uploadUrl: string }[] };
  const u = uploads[0]!;
  const cookies = await page.context().cookies();
  const csrf = decodeURIComponent(cookies.find((c) => c.name.endsWith('dp_web_csrf'))?.value ?? '');
  const put = await page.request.fetch(u.uploadUrl, { method: 'PUT', data: body, headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': csrf } });
  if (put.status() !== 204) throw new Error(`put ${put.status()} ${await put.text()}`);
  const done = await api(page, 'POST', `/client/dossiers/${reference}/documents/${documentId}/uploads/${u.id}/complete`, {});
  if (!done.ok()) throw new Error(`complete ${done.status()} ${await done.text()}`);
  return u.id;
}
