// MED-016, MED-022 — the PUBLIC space served read-only under /media-files (the CDN's role in hosted environments):
// an address never changes (it carries the media id), so it is cached one year, immutable; no directory listing,
// no index file, no redirect, no dotfile; anything else is the API's 404.
import express, { type RequestHandler } from 'express';
import { defaultLocalStorageRoot } from './object-storage.js';
import { join } from 'node:path';

export const MEDIA_FILES_PATH = '/media-files';

export function mountMediaFiles(app: { use: (path: string, handler: RequestHandler) => unknown }, root: string = defaultLocalStorageRoot()): void {
  app.use(
    MEDIA_FILES_PATH,
    express.static(join(root, 'public'), {
      index: false,
      redirect: false,
      dotfiles: 'deny',
      fallthrough: true, // a missing file falls to the bare 404 below (no stack page)
      etag: true,
      lastModified: false,
      maxAge: '365d',
      immutable: true,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );
  // Anything not found under /media-files: a bare 404, never a listing or an error page.
  app.use(MEDIA_FILES_PATH, ((_req, res) => {
    res.status(404).setHeader('Cache-Control', 'no-store');
    res.end();
  }) as RequestHandler);
}
