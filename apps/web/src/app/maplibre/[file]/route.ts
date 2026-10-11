// ARC-042 — the MapLibre worker, served by the site itself (same origin: no third-party script, the gate cookie
// applies). The library computes its worker address from its own file, which a bundled chunk breaks: the map bricks of
// @dp/ui point it here (`setWorkerUrl`). Only the two files the worker needs are served, read from the version of
// maplibre-gl installed for @dp/ui (no copy to keep in sync).
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';

const FILES = new Set(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']);

let distDir: string | null = null;
function dist(): string {
  // apps/web/node_modules/@dp/ui → packages/ui (workspace link) → its maplibre-gl.
  distDir ??= join(realpathSync(join(process.cwd(), 'node_modules', '@dp', 'ui')), 'node_modules', 'maplibre-gl', 'dist');
  return distDir;
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await params;
  if (!FILES.has(file)) return new Response('Not found', { status: 404 });
  try {
    const body = await readFile(join(dist(), file));
    return new Response(new Uint8Array(body), {
      headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=86400' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
