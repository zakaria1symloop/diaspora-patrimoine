// ARC-060 — object storage behind an interface (S3-compatible in hosted environments, ENV-040). MED-016: two spaces,
// `public` (served by the CDN — here by the API under /media-files) and `private` (never served directly).
// The key alone is recorded (`storageKey`); it is made of identifiers only (MED-012).
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type StorageSpace = 'public' | 'private';

export interface ObjectStorage {
  put(space: StorageSpace, key: string, body: Buffer, contentType: string): Promise<void>;
  get(space: StorageSpace, key: string): Promise<Buffer | null>;
  exists(space: StorageSpace, key: string): Promise<boolean>;
  delete(space: StorageSpace, key: string): Promise<void>;
  /** Deletes every object whose key starts with `prefix` (a media's renditions folder). */
  deletePrefix(space: StorageSpace, prefix: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/** `<repo>/.local/storage` — this file sits in `apps/api/{src|dist}/files/`. Overridable by STORAGE_LOCAL_ROOT. */
export function defaultLocalStorageRoot(): string {
  if (process.env.STORAGE_LOCAL_ROOT) return resolve(process.env.STORAGE_LOCAL_ROOT);
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..', '..', '.local', 'storage');
}

const KEY = /^[A-Za-z0-9_\-./]+$/;

/** Local filesystem implementation, for `local` (and tests). Keys never escape their space. */
export class LocalObjectStorage implements ObjectStorage {
  constructor(readonly root: string = defaultLocalStorageRoot()) {}

  spaceDir(space: StorageSpace): string {
    return join(this.root, space);
  }

  private path(space: StorageSpace, key: string): string {
    if (!KEY.test(key) || key.includes('..') || key.startsWith('/')) throw new Error('invalid storage key');
    const base = this.spaceDir(space);
    const full = resolve(base, ...key.split('/'));
    if (!full.startsWith(base + sep)) throw new Error('invalid storage key');
    return full;
  }

  async put(space: StorageSpace, key: string, body: Buffer, _contentType?: string): Promise<void> {
    const p = this.path(space, key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  async get(space: StorageSpace, key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.path(space, key));
    } catch {
      return null;
    }
  }

  async exists(space: StorageSpace, key: string): Promise<boolean> {
    try {
      return (await stat(this.path(space, key))).isFile();
    } catch {
      return false;
    }
  }

  async delete(space: StorageSpace, key: string): Promise<void> {
    await rm(this.path(space, key), { force: true });
  }

  async deletePrefix(space: StorageSpace, prefix: string): Promise<void> {
    await rm(this.path(space, prefix.replace(/\/$/, '')), { recursive: true, force: true });
  }

  stream(space: StorageSpace, key: string) {
    return createReadStream(this.path(space, key));
  }
}
